/**
 * Reglas de negocio del programa de fidelización.
 * Todo cambio de puntos pasa por addMovement() para mantener saldo e historial consistentes.
 */
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema, type DB, type Tx } from "./db";
import { getSettings, type Settings } from "./settings";
import type { Category } from "./format";
import type { Motorcycle } from "@/db/schema";

const { customers, levels, pointMovements, purchases, notifications, motorcycles, serviceRecords, referrals, rewards, redemptions } = schema;
type Q = DB | Tx;

const EARNING_TYPES = ["COMPRA", "BONO", "REFERIDO", "CUMPLEANOS", "BIENVENIDA", "AJUSTE"];

export class LoyaltyError extends Error {}

export function pesosPerPoint(category: Category, s: Settings) {
  return s[`pesosPerPoint${category}` as keyof Settings] as number;
}

export function calcPoints(amount: number, category: Category, multiplier: number, s: Settings) {
  const base = Math.floor(amount / Math.max(1, pesosPerPoint(category, s)));
  return Math.floor(base * (multiplier || 1));
}

export function makeReferralCode(firstName: string) {
  const clean = firstName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 5)
    .padEnd(3, "X");
  return `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
}

export function makeRedemptionCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return `SM-${c}`;
}

export async function notify(q: Q, customerId: string, title: string, body: string, createdAt?: Date) {
  await q.insert(notifications).values({ customerId, title, body, ...(createdAt ? { createdAt } : {}) });
}

export async function addMovement(
  q: Q,
  m: {
    customerId: string;
    type: string;
    points: number;
    description: string;
    purchaseId?: string;
    redemptionId?: string;
    createdById?: string | null;
    createdAt?: Date;
  },
) {
  const countsForLevel = m.points > 0 && EARNING_TYPES.includes(m.type);
  const [c] = await q
    .update(customers)
    .set({
      pointsBalance: sql`${customers.pointsBalance} + ${m.points}`,
      ...(countsForLevel ? { lifetimePoints: sql`${customers.lifetimePoints} + ${m.points}` } : {}),
    })
    .where(eq(customers.id, m.customerId))
    .returning();
  await q.insert(pointMovements).values({
    customerId: m.customerId,
    type: m.type,
    points: m.points,
    balanceAfter: c.pointsBalance,
    description: m.description,
    purchaseId: m.purchaseId,
    redemptionId: m.redemptionId,
    createdById: m.createdById ?? null,
    ...(m.createdAt ? { createdAt: m.createdAt } : {}),
  });
  return c;
}

/** Recalcula el nivel según puntos históricos y notifica si sube. */
export async function recalcLevel(q: Q, customerId: string) {
  const [c] = await q.select().from(customers).where(eq(customers.id, customerId));
  const all = await q.select().from(levels).orderBy(desc(levels.minPoints));
  if (!all.length) return null;
  const target = all.find((l) => c.lifetimePoints >= l.minPoints) ?? all[all.length - 1];
  if (target.id !== c.levelId) {
    const prev = all.find((l) => l.id === c.levelId);
    await q.update(customers).set({ levelId: target.id }).where(eq(customers.id, customerId));
    if (prev && target.minPoints > prev.minPoints) {
      await notify(q, customerId, `¡Subiste a nivel ${target.name}! 🏆`, `Ahora ganas puntos x${target.multiplier} y tienes nuevos beneficios exclusivos.`);
    }
  }
  return target;
}

export async function getLevelProgress(lifetimePoints: number) {
  const all = await db.select().from(levels).orderBy(asc(levels.minPoints));
  const current = [...all].reverse().find((l) => lifetimePoints >= l.minPoints) ?? all[0];
  const next = all.find((l) => l.minPoints > lifetimePoints) ?? null;
  const progress = next && current
    ? Math.min(100, Math.round(((lifetimePoints - current.minPoints) / (next.minPoints - current.minPoints)) * 100))
    : 100;
  return { current, next, progress, missing: next ? next.minPoints - lifetimePoints : 0, levels: all };
}

export const CATEGORY_LABEL: Record<Category, string> = {
  MOTO: "Compra de moto",
  REPUESTOS: "Repuestos",
  ACCESORIOS: "Accesorios",
  TALLER: "Servicio de taller",
};

export async function registerPurchase(input: {
  customerId: string;
  category: Category;
  amount: number;
  date?: Date;
  invoiceNumber?: string | null;
  motorcycleId?: string | null;
  serviceKm?: number | null;
  serviceType?: string | null;
  notes?: string | null;
  source?: "MANUAL" | "IMPORTACION" | "API";
  createdById?: string | null;
  settings?: Settings;
  silent?: boolean;
}) {
  const s = input.settings ?? (await getSettings());
  if (!(input.amount > 0)) throw new LoyaltyError("El valor de la compra debe ser mayor a cero.");
  if (input.invoiceNumber) {
    const dup = await db.query.purchases.findFirst({ where: eq(purchases.invoiceNumber, input.invoiceNumber) });
    if (dup) throw new LoyaltyError(`La factura ${input.invoiceNumber} ya fue registrada.`);
  }
  return db.transaction(async (tx) => {
    const customer = await tx.query.customers.findFirst({ where: eq(customers.id, input.customerId), with: { level: true } });
    if (!customer) throw new LoyaltyError("Cliente no encontrado.");
    const multiplier = customer.level?.multiplier ?? 1;
    const points = calcPoints(input.amount, input.category, multiplier, s);
    const when = input.date ?? new Date();

    const [purchase] = await tx
      .insert(purchases)
      .values({
        customerId: customer.id,
        category: input.category,
        amount: input.amount,
        pointsEarned: points,
        date: when,
        invoiceNumber: input.invoiceNumber || null,
        motorcycleId: input.motorcycleId || null,
        notes: input.notes || null,
        source: input.source ?? "MANUAL",
        createdById: input.createdById ?? null,
      })
      .returning();

    await tx
      .update(customers)
      .set({
        lifetimeSpend: sql`${customers.lifetimeSpend} + ${input.amount}`,
        lastVisitAt: customer.lastVisitAt && customer.lastVisitAt > when ? customer.lastVisitAt : when,
      })
      .where(eq(customers.id, customer.id));

    if (points > 0) {
      await addMovement(tx, {
        customerId: customer.id,
        type: "COMPRA",
        points,
        description: `${CATEGORY_LABEL[input.category]}${input.invoiceNumber ? ` · Factura ${input.invoiceNumber}` : ""}${multiplier > 1 ? ` (x${multiplier} ${customer.level?.name})` : ""}`,
        purchaseId: purchase.id,
        createdById: input.createdById,
        createdAt: when,
      });
    }

    // Servicio de taller => queda registrado el mantenimiento en la moto
    if (input.category === "TALLER" && input.motorcycleId) {
      const [moto] = await tx.select().from(motorcycles).where(eq(motorcycles.id, input.motorcycleId));
      if (moto) {
        const km = input.serviceKm ?? moto.currentKm;
        await tx.insert(serviceRecords).values({
          motorcycleId: moto.id,
          date: when,
          km,
          type: input.serviceType || "Mantenimiento preventivo",
          notes: input.notes,
          purchaseId: purchase.id,
          createdById: input.createdById ?? null,
        });
        await tx
          .update(motorcycles)
          .set({ lastServiceDate: when, lastServiceKm: km, currentKm: Math.max(km, moto.currentKm) })
          .where(eq(motorcycles.id, moto.id));
      }
    }

    // Primera compra de moto de un cliente referido => bono para quien lo refirió
    if (input.category === "MOTO" && customer.referredById) {
      const paid = await tx.query.referrals.findFirst({
        where: and(eq(referrals.referredCustomerId, customer.id), eq(referrals.status, "COMPRO")),
      });
      if (!paid) {
        const pending = await tx.query.referrals.findFirst({
          where: and(
            eq(referrals.referrerId, customer.referredById),
            inArray(referrals.status, ["PENDIENTE", "CONTACTADO"]),
            or(eq(referrals.referredCustomerId, customer.id), eq(referrals.phone, customer.phone)),
          ),
        });
        await payReferral(tx, {
          referralId: pending?.id,
          referrerId: customer.referredById,
          referredCustomerId: customer.id,
          referredName: `${customer.firstName} ${customer.lastName}`,
          referredPhone: customer.phone,
          bonus: s.referralBonus,
          createdById: input.createdById,
          when,
        });
      }
    }

    await recalcLevel(tx, customer.id);
    if (points > 0 && !input.silent) {
      await notify(tx, customer.id, `Ganaste ${points.toLocaleString("es-CO")} puntos`, `Por tu compra de ${CATEGORY_LABEL[input.category].toLowerCase()} en ${s.businessName}. ¡Gracias por preferirnos!`, when);
    }
    return { purchase, points };
  });
}

export async function payReferral(
  q: Q,
  r: {
    referralId?: string;
    referrerId: string;
    referredCustomerId?: string;
    referredName: string;
    referredPhone: string;
    bonus: number;
    createdById?: string | null;
    when?: Date;
  },
) {
  const data = { status: "COMPRO", referredCustomerId: r.referredCustomerId, bonusPoints: r.bonus, convertedAt: r.when ?? new Date(), ...(r.when ? { createdAt: r.when } : {}) };
  if (r.referralId) await q.update(referrals).set(data).where(eq(referrals.id, r.referralId));
  else await q.insert(referrals).values({ ...data, referrerId: r.referrerId, name: r.referredName, phone: r.referredPhone });
  await addMovement(q, {
    customerId: r.referrerId,
    type: "REFERIDO",
    points: r.bonus,
    description: `Referido: ${r.referredName} compró su moto`,
    createdById: r.createdById,
    createdAt: r.when,
  });
  await notify(q, r.referrerId, "¡Tu referido compró! 🎉", `${r.referredName} compró su moto. Te abonamos ${r.bonus.toLocaleString("es-CO")} puntos.`, r.when);
  await recalcLevel(q, r.referrerId);
}

export async function redeemReward(input: {
  customerId: string;
  rewardId: string;
  channel: "PORTAL" | "MOSTRADOR";
  createdById?: string | null;
  notes?: string;
}) {
  return db.transaction(async (tx) => {
    const customer = await tx.query.customers.findFirst({ where: eq(customers.id, input.customerId), with: { level: true } });
    const reward = await tx.query.rewards.findFirst({ where: eq(rewards.id, input.rewardId), with: { minLevel: true } });
    if (!customer || !reward) throw new LoyaltyError("Cliente o premio no encontrado.");
    if (!reward.active) throw new LoyaltyError("Este premio no está disponible.");
    if (reward.stock !== null && reward.stock <= 0) throw new LoyaltyError("Este premio está agotado.");
    if (customer.pointsBalance < reward.pointsCost)
      throw new LoyaltyError(`Puntos insuficientes: tiene ${customer.pointsBalance.toLocaleString("es-CO")} y necesita ${reward.pointsCost.toLocaleString("es-CO")}.`);
    if (reward.minLevel && (customer.level?.minPoints ?? 0) < reward.minLevel.minPoints)
      throw new LoyaltyError(`Este premio es exclusivo para nivel ${reward.minLevel.name} o superior.`);

    let code = makeRedemptionCode();
    while (await tx.query.redemptions.findFirst({ where: eq(redemptions.code, code) })) code = makeRedemptionCode();

    const counter = input.channel === "MOSTRADOR";
    const [redemption] = await tx
      .insert(redemptions)
      .values({
        code,
        customerId: customer.id,
        rewardId: reward.id,
        points: reward.pointsCost,
        channel: input.channel,
        status: counter ? "ENTREGADO" : "PENDIENTE",
        deliveredAt: counter ? new Date() : null,
        handledById: input.createdById ?? null,
        notes: input.notes,
      })
      .returning();
    if (reward.stock !== null) await tx.update(rewards).set({ stock: sql`${rewards.stock} - 1` }).where(eq(rewards.id, reward.id));
    await addMovement(tx, {
      customerId: customer.id,
      type: "CANJE",
      points: -reward.pointsCost,
      description: `Canje: ${reward.name} (${code})`,
      redemptionId: redemption.id,
      createdById: input.createdById,
    });
    await notify(
      tx,
      customer.id,
      counter ? "Canje entregado ✅" : "Solicitud de canje recibida",
      counter ? `Recibiste ${reward.name}. ¡Disfrútalo!` : `Tu código es ${code}. Preséntalo en el concesionario para reclamar ${reward.name}.`,
    );
    return redemption;
  });
}

export async function setRedemptionStatus(id: string, status: "APROBADO" | "ENTREGADO" | "CANCELADO", userId?: string | null) {
  return db.transaction(async (tx) => {
    const r = await tx.query.redemptions.findFirst({ where: eq(redemptions.id, id), with: { reward: true } });
    if (!r) throw new LoyaltyError("Canje no encontrado.");
    if (r.status === "CANCELADO" || r.status === "ENTREGADO") throw new LoyaltyError("Este canje ya fue cerrado.");
    await tx
      .update(redemptions)
      .set({ status, handledById: userId ?? null, ...(status === "ENTREGADO" ? { deliveredAt: new Date() } : {}) })
      .where(eq(redemptions.id, id));
    if (status === "CANCELADO") {
      if (r.reward.stock !== null) await tx.update(rewards).set({ stock: sql`${rewards.stock} + 1` }).where(eq(rewards.id, r.rewardId));
      await addMovement(tx, {
        customerId: r.customerId,
        type: "DEVOLUCION",
        points: r.points,
        description: `Devolución por canje cancelado (${r.code})`,
        redemptionId: r.id,
        createdById: userId,
      });
      await notify(tx, r.customerId, "Canje cancelado", `Te devolvimos ${r.points.toLocaleString("es-CO")} puntos del canje ${r.code}.`);
    } else if (status === "APROBADO") {
      await notify(tx, r.customerId, "Tu premio está listo 🎁", `Ya puedes reclamar ${r.reward.name} en el concesionario con el código ${r.code}.`);
    } else {
      await notify(tx, r.customerId, "Canje entregado ✅", `Entregamos ${r.reward.name}. ¡Gracias por ser parte del programa!`);
    }
  });
}

/* ---------------- Mantenimientos ---------------- */

export type MaintenanceState = "VENCIDO" | "PROXIMO" | "AL_DIA";

export function maintenanceStatus(
  m: Pick<Motorcycle, "lastServiceDate" | "lastServiceKm" | "purchaseDate" | "createdAt" | "currentKm" | "serviceIntervalDays" | "serviceIntervalKm" | "avgKmPerMonth">,
  leadDays = 10,
) {
  const base = m.lastServiceDate ?? m.purchaseDate ?? m.createdAt;
  const baseKm = m.lastServiceKm ?? 0;
  const nextKm = baseKm + m.serviceIntervalKm;
  const byDays = new Date(base.getTime() + m.serviceIntervalDays * 86400000);
  const kmPerDay = Math.max(1, m.avgKmPerMonth) / 30;
  const byKm = new Date(base.getTime() + Math.round(m.serviceIntervalKm / kmPerDay) * 86400000);
  const dueDate = byDays < byKm ? byDays : byKm;
  const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
  let state: MaintenanceState = "AL_DIA";
  if (daysLeft < 0 || m.currentKm >= nextKm) state = "VENCIDO";
  else if (daysLeft <= leadDays) state = "PROXIMO";
  return { dueDate, nextKm, daysLeft, state, reason: byDays < byKm ? "tiempo" : "kilometraje" };
}

/* ---------------- Tareas automáticas (diarias) ---------------- */

/** Abona bono de cumpleaños (una vez al año) y vence puntos de clientes inactivos. */
export async function runDailyJobs() {
  const s = await getSettings();
  const now = new Date();
  const bogota = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const year = bogota.getFullYear();
  let birthdays = 0;
  let expired = 0;

  if (s.birthdayBonus > 0) {
    const list = await db.select().from(customers).where(isNotNull(customers.birthDate));
    for (const c of list) {
      const b = c.birthDate!;
      if (b.getUTCMonth() === bogota.getMonth() && b.getUTCDate() === bogota.getDate() && c.lastBirthdayBonusYear !== year) {
        await db.transaction(async (tx) => {
          await addMovement(tx, { customerId: c.id, type: "CUMPLEANOS", points: s.birthdayBonus, description: `Bono de cumpleaños ${year} 🎂` });
          await tx.update(customers).set({ lastBirthdayBonusYear: year }).where(eq(customers.id, c.id));
          await notify(tx, c.id, `¡Feliz cumpleaños, ${c.firstName}! 🎂`, `Te regalamos ${s.birthdayBonus} puntos. Todo el equipo de ${s.businessName} te desea un gran día.`);
          await recalcLevel(tx, c.id);
        });
        birthdays++;
      }
    }
  }

  if (s.expirationMonths > 0) {
    const limit = new Date(now);
    limit.setMonth(limit.getMonth() - s.expirationMonths);
    const list = await db
      .select()
      .from(customers)
      .where(and(gt(customers.pointsBalance, 0), or(lt(customers.lastVisitAt, limit), and(isNull(customers.lastVisitAt), lt(customers.createdAt, limit)))));
    for (const c of list) {
      await db.transaction(async (tx) => {
        await addMovement(tx, { customerId: c.id, type: "VENCIMIENTO", points: -c.pointsBalance, description: `Vencimiento por ${s.expirationMonths} meses sin compras` });
        await notify(tx, c.id, "Tus puntos vencieron", `Por ${s.expirationMonths} meses sin compras, tus puntos vencieron. ¡Vuelve y empieza a acumular de nuevo!`);
      });
      expired++;
    }
  }
  return { birthdays, expired };
}
