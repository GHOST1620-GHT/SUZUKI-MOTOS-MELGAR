"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import type { Category } from "@/lib/format";
import {
  addMovement, LoyaltyError, makeReferralCode, notify, payReferral, recalcLevel, redeemReward, registerPurchase, runDailyJobs, setRedemptionStatus,
} from "@/lib/loyalty";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/settings";

const S = schema;

/* ---------- utilidades ---------- */
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;
const int = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(/[^\d-]/g, "");
  return v ? parseInt(v, 10) : null;
};
const money = (fd: FormData, k: string) => Number(str(fd, k).replace(/\D/g, "")) || 0;
const dateOf = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v ? new Date(`${v}T12:00:00-05:00`) : null;
};
function go(path: string, msg: { ok?: string; error?: string }): never {
  const sep = path.includes("?") ? "&" : "?";
  const q = msg.ok ? `ok=${encodeURIComponent(msg.ok)}` : `error=${encodeURIComponent(msg.error ?? "")}`;
  revalidatePath("/admin", "layout");
  redirect(`${path}${sep}${q}`);
}
function errMsg(e: unknown) {
  if (e instanceof LoyaltyError) return e.message;
  const m = String((e as Error)?.message ?? e);
  if (m.includes("unique") || m.includes("duplicate")) return "Ya existe un registro con ese dato único (cédula, placa, correo o factura).";
  console.error(e);
  return "Ocurrió un error inesperado. Intente de nuevo.";
}

/* ---------- Clientes ---------- */

export async function createCustomer(fd: FormData) {
  const user = await requireStaff();
  const s = await getSettings();
  let id = "";
  try {
    const document = str(fd, "document").replace(/\D/g, "");
    if (!document || !str(fd, "firstName") || !str(fd, "phone")) throw new LoyaltyError("Cédula, nombre y celular son obligatorios.");
    const exists = await db.query.customers.findFirst({ where: eq(S.customers.document, document) });
    if (exists) throw new LoyaltyError(`Ya existe un cliente con la cédula ${document}.`);
    const refCode = str(fd, "referralCode").toUpperCase();
    const referrer = refCode ? await db.query.customers.findFirst({ where: eq(S.customers.referralCode, refCode) }) : null;
    if (refCode && !referrer) throw new LoyaltyError(`El código de referido ${refCode} no existe.`);
    const [lvl] = await db.select().from(S.levels).orderBy(S.levels.minPoints).limit(1);

    id = await db.transaction(async (tx) => {
      const [c] = await tx
        .insert(S.customers)
        .values({
          documentType: str(fd, "documentType") || "CC",
          document,
          firstName: str(fd, "firstName"),
          lastName: str(fd, "lastName"),
          phone: str(fd, "phone").replace(/\D/g, ""),
          email: opt(fd, "email")?.toLowerCase(),
          birthDate: dateOf(fd, "birthDate"),
          city: opt(fd, "city"),
          address: opt(fd, "address"),
          notes: opt(fd, "notes"),
          acceptsMarketing: fd.get("acceptsMarketing") === "on",
          referralCode: makeReferralCode(str(fd, "firstName")),
          referredById: referrer?.id ?? null,
          levelId: lvl?.id,
        })
        .returning();
      if (s.welcomeBonus > 0) await addMovement(tx, { customerId: c.id, type: "BIENVENIDA", points: s.welcomeBonus, description: "Bono de bienvenida al programa", createdById: user.id });
      await notify(tx, c.id, `¡Bienvenido al Club ${s.businessName}! 🏍️`, `Te regalamos ${s.welcomeBonus} puntos para empezar. Acumula en motos, repuestos, accesorios y taller.`);
      if (referrer) {
        await tx.insert(S.referrals).values({ referrerId: referrer.id, name: `${c.firstName} ${c.lastName}`, phone: c.phone, referredCustomerId: c.id, status: "CONTACTADO" });
      }
      const model = str(fd, "motoModel");
      if (model) {
        await tx.insert(S.motorcycles).values({
          customerId: c.id,
          model,
          plate: opt(fd, "motoPlate")?.toUpperCase().replace(/\s/g, ""),
          year: int(fd, "motoYear"),
          purchaseDate: dateOf(fd, "motoPurchaseDate") ?? new Date(),
          currentKm: int(fd, "motoKm") ?? 0,
        });
      }
      return c.id;
    });
  } catch (e) {
    go("/admin/clientes/nuevo", { error: errMsg(e) });
  }
  go(`/admin/clientes/${id}`, { ok: "Cliente registrado con bono de bienvenida" });
}

export async function updateCustomer(fd: FormData) {
  await requireStaff();
  const id = str(fd, "id");
  try {
    await db
      .update(S.customers)
      .set({
        documentType: str(fd, "documentType") || "CC",
        document: str(fd, "document").replace(/\D/g, ""),
        firstName: str(fd, "firstName"),
        lastName: str(fd, "lastName"),
        phone: str(fd, "phone").replace(/\D/g, ""),
        email: opt(fd, "email")?.toLowerCase() ?? null,
        birthDate: dateOf(fd, "birthDate"),
        city: opt(fd, "city"),
        address: opt(fd, "address"),
        notes: opt(fd, "notes"),
        acceptsMarketing: fd.get("acceptsMarketing") === "on",
      })
      .where(eq(S.customers.id, id));
  } catch (e) {
    go(`/admin/clientes/${id}`, { error: errMsg(e) });
  }
  go(`/admin/clientes/${id}`, { ok: "Datos actualizados" });
}

export async function deleteCustomer(fd: FormData) {
  await requireStaff(["ADMIN"]);
  await db.delete(S.customers).where(eq(S.customers.id, str(fd, "id")));
  go("/admin/clientes", { ok: "Cliente eliminado" });
}

export async function setPortalPassword(fd: FormData) {
  await requireStaff(["ADMIN", "ASESOR"]);
  const id = str(fd, "id");
  const pwd = str(fd, "password");
  if (pwd.length < 6) go(`/admin/clientes/${id}`, { error: "La contraseña debe tener mínimo 6 caracteres" });
  await db.update(S.customers).set({ passwordHash: await bcrypt.hash(pwd, 10), portalActivatedAt: new Date() }).where(eq(S.customers.id, id));
  go(`/admin/clientes/${id}`, { ok: "Acceso al portal configurado" });
}

export async function adjustPoints(fd: FormData) {
  const user = await requireStaff(["ADMIN", "ASESOR"]);
  const id = str(fd, "customerId");
  const pts = int(fd, "points") ?? 0;
  const sign = str(fd, "direction") === "restar" ? -1 : 1;
  const reason = str(fd, "reason");
  try {
    if (!pts || pts <= 0) throw new LoyaltyError("Indique una cantidad de puntos válida.");
    if (!reason) throw new LoyaltyError("Indique el motivo del ajuste.");
    await db.transaction(async (tx) => {
      const [c] = await tx.select().from(S.customers).where(eq(S.customers.id, id));
      if (sign < 0 && c.pointsBalance < pts) throw new LoyaltyError("El cliente no tiene suficientes puntos para restar.");
      const type = sign > 0 ? str(fd, "type") || "BONO" : "AJUSTE";
      await addMovement(tx, { customerId: id, type, points: sign * pts, description: reason, createdById: user.id });
      if (sign > 0) await notify(tx, id, `Recibiste ${pts.toLocaleString("es-CO")} puntos`, reason);
      await recalcLevel(tx, id);
    });
  } catch (e) {
    go(`/admin/clientes/${id}`, { error: errMsg(e) });
  }
  go(`/admin/clientes/${id}`, { ok: "Puntos ajustados" });
}

/* ---------- Motos y mantenimientos ---------- */

export async function saveMotorcycle(fd: FormData) {
  await requireStaff();
  const id = str(fd, "id");
  const customerId = str(fd, "customerId");
  const values = {
    brand: str(fd, "brand") || "Suzuki",
    model: str(fd, "model"),
    plate: opt(fd, "plate")?.toUpperCase().replace(/\s/g, "") ?? null,
    year: int(fd, "year"),
    vin: opt(fd, "vin"),
    color: opt(fd, "color"),
    purchaseDate: dateOf(fd, "purchaseDate"),
    currentKm: int(fd, "currentKm") ?? 0,
    serviceIntervalKm: int(fd, "serviceIntervalKm") ?? 3000,
    serviceIntervalDays: int(fd, "serviceIntervalDays") ?? 120,
    avgKmPerMonth: int(fd, "avgKmPerMonth") ?? 800,
  };
  try {
    if (!values.model) throw new LoyaltyError("El modelo es obligatorio.");
    if (id) await db.update(S.motorcycles).set(values).where(eq(S.motorcycles.id, id));
    else await db.insert(S.motorcycles).values({ ...values, customerId });
  } catch (e) {
    go(`/admin/clientes/${customerId}`, { error: errMsg(e) });
  }
  go(`/admin/clientes/${customerId}`, { ok: id ? "Moto actualizada" : "Moto agregada" });
}

export async function deleteMotorcycle(fd: FormData) {
  await requireStaff(["ADMIN"]);
  await db.delete(S.motorcycles).where(eq(S.motorcycles.id, str(fd, "id")));
  go(`/admin/clientes/${str(fd, "customerId")}`, { ok: "Moto eliminada" });
}

/** Registra un servicio. Si tiene valor, se crea como compra de TALLER y suma puntos. */
export async function registerService(fd: FormData) {
  const user = await requireStaff();
  const motoId = str(fd, "motorcycleId");
  const back = str(fd, "back") || "/admin/mantenimientos";
  const km = int(fd, "km");
  const amount = money(fd, "amount");
  const when = dateOf(fd, "date") ?? new Date();
  let earned = 0;
  try {
    const moto = await db.query.motorcycles.findFirst({ where: eq(S.motorcycles.id, motoId) });
    if (!moto) throw new LoyaltyError("Moto no encontrada.");
    if (km === null) throw new LoyaltyError("Indique el kilometraje actual.");
    if (amount > 0) {
      const r = await registerPurchase({
        customerId: moto.customerId,
        category: "TALLER",
        amount,
        date: when,
        invoiceNumber: opt(fd, "invoiceNumber"),
        motorcycleId: moto.id,
        serviceKm: km,
        serviceType: str(fd, "type"),
        notes: opt(fd, "notes"),
        createdById: user.id,
      });
      earned = r.points;
    } else {
      await db.insert(S.serviceRecords).values({ motorcycleId: moto.id, date: when, km, type: str(fd, "type") || "Mantenimiento preventivo", notes: opt(fd, "notes"), createdById: user.id });
      await db.update(S.motorcycles).set({ lastServiceDate: when, lastServiceKm: km, currentKm: Math.max(km, moto.currentKm) }).where(eq(S.motorcycles.id, moto.id));
      await db.update(S.customers).set({ lastVisitAt: when }).where(eq(S.customers.id, moto.customerId));
    }
  } catch (e) {
    go(back, { error: errMsg(e) });
  }
  go(back, { ok: earned ? `Servicio registrado · +${earned.toLocaleString("es-CO")} puntos` : "Servicio registrado" });
}

export async function updateKm(fd: FormData) {
  await requireStaff();
  const back = str(fd, "back") || "/admin/mantenimientos";
  await db.update(S.motorcycles).set({ currentKm: int(fd, "km") ?? 0 }).where(eq(S.motorcycles.id, str(fd, "motorcycleId")));
  go(back, { ok: "Kilometraje actualizado" });
}

export async function logReminder(input: { customerId: string; motorcycleId?: string | null; kind: string; message: string }) {
  const user = await requireStaff();
  await db.insert(S.reminderLogs).values({ ...input, motorcycleId: input.motorcycleId ?? null, sentById: user.id });
  revalidatePath("/admin/mantenimientos");
}

/* ---------- Compras ---------- */

export async function createPurchase(fd: FormData) {
  const user = await requireStaff();
  const customerId = str(fd, "customerId");
  const back = str(fd, "back") || "/admin/compras/nueva";
  let points = 0;
  try {
    if (!customerId) throw new LoyaltyError("Seleccione un cliente.");
    const category = str(fd, "category") as Category;
    if (category === "MOTO" && str(fd, "newMotoModel")) {
      const [m] = await db
        .insert(S.motorcycles)
        .values({ customerId, model: str(fd, "newMotoModel"), plate: opt(fd, "newMotoPlate")?.toUpperCase().replace(/\s/g, ""), year: int(fd, "newMotoYear"), purchaseDate: dateOf(fd, "date") ?? new Date() })
        .returning();
      fd.set("motorcycleId", m.id);
    }
    const r = await registerPurchase({
      customerId,
      category,
      amount: money(fd, "amount"),
      date: dateOf(fd, "date") ?? new Date(),
      invoiceNumber: opt(fd, "invoiceNumber"),
      motorcycleId: opt(fd, "motorcycleId"),
      serviceKm: int(fd, "serviceKm"),
      serviceType: opt(fd, "serviceType"),
      notes: opt(fd, "notes"),
      createdById: user.id,
    });
    points = r.points;
  } catch (e) {
    go(`${back}${back.includes("?") ? "&" : "?"}cliente=${customerId}`, { error: errMsg(e) });
  }
  go(back.startsWith("/admin/clientes") ? back : `/admin/clientes/${customerId}`, { ok: `Compra registrada · +${points.toLocaleString("es-CO")} puntos` });
}

export async function voidPurchase(fd: FormData) {
  const user = await requireStaff(["ADMIN"]);
  const id = str(fd, "id");
  const back = str(fd, "back") || "/admin/compras";
  try {
    await db.transaction(async (tx) => {
      const [p] = await tx.select().from(S.purchases).where(eq(S.purchases.id, id));
      if (!p) throw new LoyaltyError("Compra no encontrada.");
      if (p.pointsEarned > 0) {
        await addMovement(tx, { customerId: p.customerId, type: "AJUSTE", points: -p.pointsEarned, description: `Anulación de compra${p.invoiceNumber ? ` ${p.invoiceNumber}` : ""}`, createdById: user.id });
        await tx.update(S.customers).set({ lifetimePoints: sql`GREATEST(0, ${S.customers.lifetimePoints} - ${p.pointsEarned})` }).where(eq(S.customers.id, p.customerId));
      }
      await tx.update(S.customers).set({ lifetimeSpend: sql`GREATEST(0, ${S.customers.lifetimeSpend} - ${p.amount})` }).where(eq(S.customers.id, p.customerId));
      await tx.delete(S.purchases).where(eq(S.purchases.id, id));
      await recalcLevel(tx, p.customerId);
    });
  } catch (e) {
    go(back, { error: errMsg(e) });
  }
  go(back, { ok: "Compra anulada y puntos revertidos" });
}

/* ---------- Canjes ---------- */

export async function staffRedeem(fd: FormData) {
  const user = await requireStaff();
  const customerId = str(fd, "customerId");
  let code = "";
  try {
    const r = await redeemReward({ customerId, rewardId: str(fd, "rewardId"), channel: "MOSTRADOR", createdById: user.id, notes: opt(fd, "notes") ?? undefined });
    code = r.code;
  } catch (e) {
    go(`/admin/clientes/${customerId}`, { error: errMsg(e) });
  }
  go(`/admin/clientes/${customerId}`, { ok: `Premio entregado · código ${code}` });
}

export async function changeRedemption(fd: FormData) {
  const user = await requireStaff();
  const back = str(fd, "back") || "/admin/canjes";
  const status = str(fd, "status") as "APROBADO" | "ENTREGADO" | "CANCELADO";
  try {
    await setRedemptionStatus(str(fd, "id"), status, user.id);
  } catch (e) {
    go(back, { error: errMsg(e) });
  }
  go(back, { ok: status === "CANCELADO" ? "Canje cancelado y puntos devueltos" : status === "ENTREGADO" ? "Canje marcado como entregado" : "Canje aprobado: el cliente fue notificado" });
}

export async function findRedemptionByCode(fd: FormData) {
  await requireStaff();
  const code = str(fd, "code").toUpperCase().replace(/\s/g, "");
  const full = code.startsWith("SM-") ? code : `SM-${code}`;
  const r = await db.query.redemptions.findFirst({ where: eq(S.redemptions.code, full) });
  if (!r) go("/admin/canjes", { error: `No existe el código ${full}` });
  redirect(`/admin/canjes?codigo=${full}`);
}

/* ---------- Premios ---------- */

export async function saveReward(fd: FormData) {
  await requireStaff(["ADMIN", "ASESOR"]);
  const id = str(fd, "id");
  const stockRaw = str(fd, "stock");
  const values = {
    name: str(fd, "name"),
    description: str(fd, "description"),
    category: str(fd, "category") || "ACCESORIO",
    pointsCost: int(fd, "pointsCost") ?? 0,
    stock: stockRaw === "" ? null : parseInt(stockRaw, 10),
    emoji: str(fd, "emoji") || "🎁",
    imageUrl: opt(fd, "imageUrl"),
    minLevelId: opt(fd, "minLevelId"),
    active: fd.get("active") === "on",
  };
  try {
    if (!values.name || values.pointsCost <= 0) throw new LoyaltyError("Nombre y costo en puntos son obligatorios.");
    if (id) await db.update(S.rewards).set(values).where(eq(S.rewards.id, id));
    else await db.insert(S.rewards).values(values);
  } catch (e) {
    go("/admin/premios", { error: errMsg(e) });
  }
  go("/admin/premios", { ok: id ? "Premio actualizado" : "Premio creado" });
}

export async function toggleReward(fd: FormData) {
  await requireStaff(["ADMIN", "ASESOR"]);
  const id = str(fd, "id");
  const [r] = await db.select().from(S.rewards).where(eq(S.rewards.id, id));
  await db.update(S.rewards).set({ active: !r.active }).where(eq(S.rewards.id, id));
  go("/admin/premios", { ok: r.active ? "Premio desactivado" : "Premio activado" });
}

/* ---------- Niveles ---------- */

export async function saveLevel(fd: FormData) {
  await requireStaff(["ADMIN"]);
  const id = str(fd, "id");
  const values = {
    name: str(fd, "name"),
    minPoints: int(fd, "minPoints") ?? 0,
    multiplier: Number(str(fd, "multiplier").replace(",", ".")) || 1,
    color: str(fd, "color") || "#64748b",
    benefits: str(fd, "benefits"),
    sortOrder: int(fd, "sortOrder") ?? 0,
  };
  try {
    if (!values.name) throw new LoyaltyError("El nombre es obligatorio.");
    if (id) await db.update(S.levels).set(values).where(eq(S.levels.id, id));
    else await db.insert(S.levels).values(values);
    await recalcAll();
  } catch (e) {
    go("/admin/niveles", { error: errMsg(e) });
  }
  go("/admin/niveles", { ok: "Nivel guardado y clientes recalculados" });
}

export async function deleteLevel(fd: FormData) {
  await requireStaff(["ADMIN"]);
  const id = str(fd, "id");
  const others = await db.select().from(S.levels).where(ne(S.levels.id, id));
  if (!others.length) go("/admin/niveles", { error: "Debe existir al menos un nivel" });
  await db.update(S.customers).set({ levelId: null }).where(eq(S.customers.levelId, id));
  await db.update(S.rewards).set({ minLevelId: null }).where(eq(S.rewards.minLevelId, id));
  await db.delete(S.levels).where(eq(S.levels.id, id));
  await recalcAll();
  go("/admin/niveles", { ok: "Nivel eliminado" });
}

async function recalcAll() {
  const all = await db.select({ id: S.customers.id }).from(S.customers);
  for (const c of all) await recalcLevel(db, c.id);
}

/* ---------- Referidos ---------- */

export async function createReferral(fd: FormData) {
  await requireStaff();
  const referrerId = str(fd, "referrerId");
  const back = str(fd, "back") || "/admin/referidos";
  if (!referrerId || !str(fd, "name") || !str(fd, "phone")) go(back, { error: "Complete quién refiere, nombre y celular" });
  await db.insert(S.referrals).values({ referrerId, name: str(fd, "name"), phone: str(fd, "phone").replace(/\D/g, ""), interest: opt(fd, "interest"), notes: opt(fd, "notes") });
  go(back, { ok: "Referido registrado" });
}

export async function updateReferral(fd: FormData) {
  const user = await requireStaff();
  const id = str(fd, "id");
  const status = str(fd, "status");
  try {
    const ref = await db.query.referrals.findFirst({ where: eq(S.referrals.id, id) });
    if (!ref) throw new LoyaltyError("Referido no encontrado.");
    if (ref.status === "COMPRO") throw new LoyaltyError("Este referido ya fue pagado.");
    if (status === "COMPRO") {
      const s = await getSettings();
      await db.transaction((tx) =>
        payReferral(tx, { referralId: id, referrerId: ref.referrerId, referredCustomerId: ref.referredCustomerId ?? undefined, referredName: ref.name, referredPhone: ref.phone, bonus: s.referralBonus, createdById: user.id }),
      );
    } else {
      await db.update(S.referrals).set({ status }).where(eq(S.referrals.id, id));
    }
  } catch (e) {
    go("/admin/referidos", { error: errMsg(e) });
  }
  go("/admin/referidos", { ok: status === "COMPRO" ? "Referido convertido: puntos abonados" : "Estado actualizado" });
}

/* ---------- Configuración y usuarios ---------- */

export async function saveSettingsAction(fd: FormData) {
  await requireStaff(["ADMIN"]);
  const values: Record<string, string> = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (fd.has(k)) values[k] = str(fd, k).replace(/\./g, "");
  // Campos de texto no deben perder puntos
  for (const k of ["businessName", "businessAddress"]) if (fd.has(k)) values[k] = str(fd, k);
  await saveSettings(values);
  go("/admin/configuracion", { ok: "Configuración guardada" });
}

export async function runJobsAction() {
  await requireStaff(["ADMIN"]);
  const r = await runDailyJobs();
  go("/admin/configuracion", { ok: `Tareas ejecutadas: ${r.birthdays} bonos de cumpleaños, ${r.expired} saldos vencidos` });
}

export async function saveUser(fd: FormData) {
  const me = await requireStaff(["ADMIN"]);
  const id = str(fd, "id");
  const pwd = str(fd, "password");
  try {
    const base = { name: str(fd, "name"), email: str(fd, "email").toLowerCase(), role: str(fd, "role") || "ASESOR", active: id === me.id ? true : fd.get("active") === "on" };
    if (!base.name || !base.email) throw new LoyaltyError("Nombre y correo son obligatorios.");
    if (id) {
      await db.update(S.users).set({ ...base, ...(pwd ? { passwordHash: await bcrypt.hash(pwd, 10) } : {}) }).where(eq(S.users.id, id));
    } else {
      if (pwd.length < 6) throw new LoyaltyError("La contraseña debe tener mínimo 6 caracteres.");
      await db.insert(S.users).values({ ...base, passwordHash: await bcrypt.hash(pwd, 10) });
    }
  } catch (e) {
    go("/admin/configuracion#usuarios", { error: errMsg(e) });
  }
  go("/admin/configuracion", { ok: id ? "Usuario actualizado" : "Usuario creado" });
}

/* ---------- Notificación masiva ---------- */

export async function broadcastNotification(fd: FormData) {
  await requireStaff(["ADMIN", "ASESOR"]);
  const title = str(fd, "title");
  const body = str(fd, "body");
  const levelId = str(fd, "levelId");
  if (!title || !body) go("/admin/configuracion", { error: "Título y mensaje son obligatorios" });
  const list = await db
    .select({ id: S.customers.id })
    .from(S.customers)
    .where(and(eq(S.customers.acceptsMarketing, true), levelId ? eq(S.customers.levelId, levelId) : undefined));
  if (list.length) await db.insert(S.notifications).values(list.map((c) => ({ customerId: c.id, title, body })));
  go("/admin/configuracion", { ok: `Notificación enviada a ${list.length} clientes en el portal` });
}
