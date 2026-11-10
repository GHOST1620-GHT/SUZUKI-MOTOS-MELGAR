/* Datos de ejemplo para demostración. Ejecute: npm run db:seed  (BORRA los datos existentes) */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, lt, sql } from "drizzle-orm";
import { closeDb, db, schema } from "../src/lib/db";
import { addMovement, makeReferralCode, recalcLevel, redeemReward, registerPurchase } from "../src/lib/loyalty";
import { DEFAULT_SETTINGS, getSettings } from "../src/lib/settings";
import type { Category } from "../src/lib/format";

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const between = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
const L = () => String.fromCharCode(65 + between(0, 25));

const FIRST = ["Carlos", "Andrés", "Juan", "Luis", "Jorge", "Diego", "Camilo", "Sebastián", "Felipe", "Óscar", "Miguel", "Julián", "Daniel", "Santiago", "Alejandro", "María", "Laura", "Paola", "Diana", "Natalia", "Carolina", "Valentina", "Sandra", "Angélica", "Yeison", "Brayan", "Wilson", "Fabián", "Nelson", "Esteban"];
const LAST = ["Rodríguez", "Gómez", "González", "Martínez", "López", "Hernández", "Díaz", "Pérez", "Sánchez", "Ramírez", "Torres", "Rojas", "Vargas", "Moreno", "Castro", "Ortiz", "Rubio", "Cárdenas", "Herrera", "Medina", "Guzmán", "Murillo", "Lozano", "Barrios"];
const CITIES = ["Melgar", "Melgar", "Melgar", "Carmen de Apicalá", "Icononzo", "Girardot", "Flandes", "Cunday", "Ibagué"];
const MODELS: [string, number][] = [
  ["Gixxer 150 FI", 9890000], ["Gixxer 250 SF", 17990000], ["GN 125", 6690000], ["DR 150 FI", 10490000],
  ["AX4 115", 5790000], ["Best 125", 6290000], ["Viva R Style", 5890000], ["V-Strom 250 SX", 19990000],
  ["Burgman Street 125", 8990000], ["Avenis 125", 8490000], ["DR 650", 39990000], ["GSX-S750", 49990000],
];
const COLORS = ["Azul", "Negro", "Rojo", "Blanco", "Gris", "Amarillo"];
const S = schema;

async function main() {
  console.log("Limpiando base de datos…");
  await db.execute(sql`TRUNCATE notifications, reminder_logs, point_movements, service_records, redemptions, referrals, purchases, motorcycles, customers, rewards, levels, import_batches, users, settings CASCADE`);

  const hash = (p: string) => bcrypt.hashSync(p, 8);
  const [admin, asesor, taller] = await db
    .insert(S.users)
    .values([
      { name: "Administrador", email: "admin@suzukimelgar.com", passwordHash: hash("admin123"), role: "ADMIN" },
      { name: "Paula Martínez", email: "asesor@suzukimelgar.com", passwordHash: hash("asesor123"), role: "ASESOR" },
      { name: "Hernán Ruiz", email: "taller@suzukimelgar.com", passwordHash: hash("taller123"), role: "TALLER" },
    ])
    .returning();
  const staff = [admin, asesor, asesor, taller];

  await db.insert(S.settings).values(Object.entries(DEFAULT_SETTINGS).map(([key, v]) => ({ key, value: String(v) })));
  const settings = await getSettings();

  const lv = await db
    .insert(S.levels)
    .values([
      { name: "Bronce", minPoints: 0, multiplier: 1, color: "#b45309", sortOrder: 1, benefits: "Acumula puntos en todas tus compras\nBono de cumpleaños\nRecordatorios de mantenimiento" },
      { name: "Plata", minPoints: 2000, multiplier: 1.1, color: "#64748b", sortOrder: 2, benefits: "10% más puntos en cada compra\nLavada gratis en cada mantenimiento\nRevisión de 20 puntos sin costo" },
      { name: "Oro", minPoints: 5000, multiplier: 1.25, color: "#ca8a04", sortOrder: 3, benefits: "25% más puntos en cada compra\nPrioridad en agenda de taller\n5% de descuento en repuestos\nAcceso a premios exclusivos" },
      { name: "Platino", minPoints: 10000, multiplier: 1.5, color: "#1e3a8a", sortOrder: 4, benefits: "50% más puntos en cada compra\nMantenimiento a domicilio en Melgar\n10% de descuento en accesorios\nInvitación a rodadas y eventos VIP" },
    ])
    .returning();
  const [bronce, plata, oro] = lv;

  const rewardRows = await db
    .insert(S.rewards)
    .values([
      { name: "Lavada y polichada", category: "SERVICIO", pointsCost: 400, emoji: "🧽", description: "Lavada completa con polichado de tanque y llantas." },
      { name: "Cambio de aceite gratis", category: "SERVICIO", pointsCost: 1200, emoji: "🛢️", description: "Incluye aceite Suzuki Ecstar 10W-40 y mano de obra." },
      { name: "Mantenimiento preventivo", category: "SERVICIO", pointsCost: 3500, emoji: "🔧", description: "Mano de obra del mantenimiento preventivo según manual." },
      { name: "Kit de arrastre 50% dcto", category: "DESCUENTO", pointsCost: 2500, emoji: "⛓️", description: "50% de descuento en kit de arrastre (cadena, piñón y corona)." },
      { name: "Bono $50.000 en repuestos", category: "DESCUENTO", pointsCost: 1000, emoji: "🎟️", description: "Bono redimible en repuestos originales." },
      { name: "Guantes de moto", category: "ACCESORIO", pointsCost: 1500, emoji: "🧤", description: "Guantes con protección en nudillos.", stock: 15 },
      { name: "Impermeable 2 piezas", category: "ACCESORIO", pointsCost: 1800, emoji: "🧥", description: "Chaqueta y pantalón impermeable reflectivo.", stock: 12 },
      { name: "Chaleco reflectivo", category: "ACCESORIO", pointsCost: 600, emoji: "🦺", description: "Chaleco reglamentario con número de placa.", stock: 30 },
      { name: "Casco certificado", category: "ACCESORIO", pointsCost: 6000, emoji: "⛑️", description: "Casco integral certificado.", stock: 6, minLevelId: plata.id },
      { name: "Gorra Suzuki Melgar", category: "ACCESORIO", pointsCost: 350, emoji: "🧢", description: "Gorra oficial del concesionario.", stock: 40 },
      { name: "Rodada VIP al Nevado", category: "EXPERIENCIA", pointsCost: 9000, emoji: "🏔️", description: "Rodada guiada con almuerzo e hidratación.", stock: 10, minLevelId: oro.id },
      { name: "Curso de manejo seguro", category: "EXPERIENCIA", pointsCost: 2800, emoji: "🎓", description: "Curso práctico de 4 horas con instructor certificado.", stock: 20 },
    ])
    .returning();

  console.log("Creando clientes, motos y compras…");
  type Ev = { date: Date; customerId: string; category: Category; amount: number; motoId?: string; km?: number; inv: string };
  const events: Ev[] = [];
  const created: (typeof S.customers.$inferSelect)[] = [];
  let inv = 10000;

  for (let i = 0; i < 48; i++) {
    const demo = i === 0;
    const firstName = demo ? "Andrés" : pick(FIRST);
    const lastName = demo ? "Rodríguez Gómez" : `${pick(LAST)} ${pick(LAST)}`;
    const createdDays = demo ? 420 : between(20, 480);
    const now = new Date();
    const birth = demo ? new Date(Date.UTC(1990, now.getMonth(), now.getDate() + 6)) : new Date(Date.UTC(between(1965, 2004), between(0, 11), between(1, 28)));
    const [c] = await db
      .insert(S.customers)
      .values({
        document: demo ? "1234567890" : String(between(10000000, 1199999999)),
        firstName,
        lastName,
        phone: demo ? "3001234567" : `3${between(0, 2)}${between(0, 9)}${between(1000000, 9999999)}`,
        email: rand() > 0.3 || demo ? `${firstName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}${i}@correo.com` : null,
        birthDate: birth,
        city: demo ? "Melgar" : pick(CITIES),
        address: `Calle ${between(1, 30)} # ${between(1, 40)}-${between(1, 99)}`,
        referralCode: makeReferralCode(firstName),
        createdAt: daysAgo(createdDays),
        levelId: bronce.id,
        passwordHash: demo || rand() > 0.55 ? hash("cliente123") : null,
        portalActivatedAt: demo ? daysAgo(300) : null,
        referredById: i > 5 && rand() > 0.75 && created.length ? pick(created).id : null,
      })
      .returning();
    if (c.passwordHash && !c.portalActivatedAt) await db.update(S.customers).set({ portalActivatedAt: daysAgo(between(1, createdDays)) }).where(eq(S.customers.id, c.id));
    created.push(c);

    const nMotos = demo ? 2 : rand() > 0.85 ? 2 : 1;
    for (let m = 0; m < nMotos; m++) {
      const [model, price] = demo ? (m === 0 ? MODELS[1] : MODELS[8]) : pick(MODELS);
      const bought = demo ? (m === 0 ? 410 : 150) : Math.max(5, createdDays - between(0, 10) - m * between(60, 200));
      const [moto] = await db
        .insert(S.motorcycles)
        .values({
          customerId: c.id,
          model,
          year: daysAgo(bought).getFullYear(),
          plate: `${L()}${L()}${L()}${between(10, 99)}${L()}`,
          color: pick(COLORS),
          purchaseDate: daysAgo(bought),
          avgKmPerMonth: between(500, 1400),
          serviceIntervalKm: price > 15000000 ? 5000 : 3000,
          serviceIntervalDays: 120,
          createdAt: daysAgo(bought),
        })
        .returning();
      events.push({ date: daysAgo(bought), customerId: c.id, category: "MOTO", amount: price, motoId: moto.id, inv: `FV-${inv++}` });
      let km = 0;
      for (let d = bought - between(70, 130); d > 3; d -= between(70, 160)) {
        if (rand() > 0.8 && !demo) break; // clientes que dejan de venir
        km += between(2200, 4500);
        events.push({ date: daysAgo(d), customerId: c.id, category: "TALLER", amount: between(9, 38) * 10000, motoId: moto.id, km, inv: `FV-${inv++}` });
        if (rand() > 0.45) events.push({ date: daysAgo(d), customerId: c.id, category: "REPUESTOS", amount: between(4, 45) * 10000, inv: `FV-${inv++}` });
        if (rand() > 0.75) events.push({ date: daysAgo(Math.max(0, d - 1)), customerId: c.id, category: "ACCESORIOS", amount: between(5, 60) * 10000, inv: `FV-${inv++}` });
      }
      await db.update(S.motorcycles).set({ currentKm: km + between(300, 1800) }).where(eq(S.motorcycles.id, moto.id));
    }
    await addMovement(db, { customerId: c.id, type: "BIENVENIDA", points: settings.welcomeBonus, description: "Bono de bienvenida al programa", createdAt: c.createdAt });
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const e of events) {
    await registerPurchase({
      customerId: e.customerId,
      category: e.category,
      amount: e.amount,
      date: e.date,
      invoiceNumber: e.inv,
      motorcycleId: e.motoId,
      serviceKm: e.km,
      source: rand() > 0.5 ? "IMPORTACION" : "MANUAL",
      createdById: pick(staff).id,
      settings,
    });
  }

  console.log("Canjes, referidos y notificaciones…");
  const fresh = await db.select().from(S.customers);
  for (const c of fresh) {
    if (rand() > 0.5) {
      const affordable = rewardRows.filter((r) => r.pointsCost <= c.pointsBalance * 0.6 && !r.minLevelId);
      if (affordable.length) {
        const r = await redeemReward({ customerId: c.id, rewardId: pick(affordable).id, channel: rand() > 0.5 ? "PORTAL" : "MOSTRADOR", createdById: asesor.id });
        const when = daysAgo(between(0, 300));
        await db.update(S.pointMovements).set({ createdAt: when }).where(eq(S.pointMovements.redemptionId, r.id));
        if (r.channel === "PORTAL") {
          const st = rand();
          await db
            .update(S.redemptions)
            .set({ status: st > 0.6 ? "ENTREGADO" : st > 0.35 ? "APROBADO" : "PENDIENTE", deliveredAt: st > 0.6 ? when : null, requestedAt: when })
            .where(eq(S.redemptions.id, r.id));
        } else {
          await db.update(S.redemptions).set({ requestedAt: when, deliveredAt: when }).where(eq(S.redemptions.id, r.id));
        }
      }
    }
    await recalcLevel(db, c.id);
  }

  const refStatuses = ["PENDIENTE", "PENDIENTE", "CONTACTADO", "DESCARTADO"];
  for (let i = 0; i < 10; i++) {
    await db.insert(S.referrals).values({
      referrerId: i < 2 ? created[0].id : pick(created).id,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      phone: `3${between(10, 29)}${between(1000000, 9999999)}`,
      interest: pick(MODELS)[0],
      status: pick(refStatuses),
      createdAt: daysAgo(between(1, 90)),
    });
  }

  await db.update(S.notifications).set({ read: true }).where(lt(S.notifications.createdAt, daysAgo(20)));
  await db.insert(S.importBatches).values({ fileName: "ventas_mascontrol_octubre.xlsx", totalRows: 86, imported: 82, skipped: 4, newCustomers: 3, log: "4 filas omitidas: factura ya registrada", createdById: admin.id, createdAt: daysAgo(12) });

  console.log(`Listo: ${fresh.length} clientes, ${events.length} compras.`);
  console.log("Personal: admin@suzukimelgar.com / admin123  ·  asesor@suzukimelgar.com / asesor123  ·  taller@suzukimelgar.com / taller123");
  console.log("Cliente demo (portal): cédula 1234567890 / cliente123");
  await closeDb();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
