/**
 * Importación de facturas desde MasControl (archivo Excel/CSV o API).
 * Cada fila = una factura. Si el cliente no existe se crea automáticamente.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, schema as S } from "./db";
import type { Category } from "./format";
import { addMovement, CATEGORY_LABEL, LoyaltyError, makeReferralCode, pesosPerPoint, recalcLevel, registerPurchase } from "./loyalty";
import { getSettings, type Settings } from "./settings";
import { resolveMechanic, titleCase } from "./mechanics";

export type ImportRow = {
  invoiceNumber: string;
  date?: string | null;
  document: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  amount: number | string;
  category?: string | null;
  plate?: string | null;
  /** Nombre del mecánico (solo cuenta en servicios de taller) */
  mechanic?: string | null;
  /** Modelo de la moto (para crearla si la placa es nueva o si es una venta de moto) */
  model?: string | null;
  /** Kilometraje de la moto al momento del servicio */
  km?: number | string | null;
};

/** Devuelve la categoría si el texto la indica claramente; null si no (p. ej. si trae un modelo de moto). */
export function detectCategory(raw: string | null | undefined): Category | null {
  const t = (raw ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!t) return null;
  if (["moto", "motos", "motocicleta", "venta moto", "venta de moto"].includes(t)) return "MOTO";
  if (/taller|servicio|mano de obra|mantenimiento|revision|reparacion|^mo$/.test(t)) return "TALLER";
  if (/repuesto|^parte|aceite|lubricante|llanta|filtro|accesorio/.test(t)) return "REPUESTOS";
  if (/^(venta de )?motocicleta|^moto nueva/.test(t)) return "MOTO";
  return null;
}

export function guessCategory(raw: string | null | undefined, fallback: Category): Category {
  const t = (raw ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!t) return fallback;
  if (/(^|\b)(moto|motocicleta|vehiculo)s?\b/.test(t) && !/repuesto|accesorio|parte/.test(t)) return "MOTO";
  if (/taller|servicio|mano de obra|mantenimiento|revision|reparacion/.test(t)) return "TALLER";
  // Suzuki Melgar Moto no vende accesorios: cualquier artículo se clasifica como repuesto
  if (/repuesto|parte|aceite|lubricante|llanta|filtro|kit|freno|accesorio|casco|guante|chaqueta|impermeable|maleta|baul|lujo/.test(t)) return "REPUESTOS";
  if (["MOTO", "REPUESTOS", "TALLER"].includes(t.toUpperCase())) return t.toUpperCase() as Category;
  return fallback;
}

export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400000) + 5 * 3600000); // serial de Excel
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/); // dd/mm/aaaa
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(`${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T12:00:00-05:00`);
  }
  const d = new Date(s.length === 10 ? `${s}T12:00:00-05:00` : s);
  return isNaN(d.getTime()) ? null : d;
}

export function parseAmount(v: unknown) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[$\s]/g, "");
  // "1.234.567,89" o "1,234,567.89" o "1234567"
  const normalized = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/[.,](?=\d{3}(\D|$))/g, "");
  return Number(normalized) || 0;
}

export async function importRows(rows: ImportRow[], opts: { defaultCategory: Category; createdById?: string | null; source: "IMPORTACION" | "API"; createMissing?: boolean }) {
  const s = await getSettings();
  const result = { total: rows.length, imported: 0, skipped: 0, updated: 0, newCustomers: 0, newMotos: 0, newMechanics: 0, points: 0, errors: [] as string[], warnings: [] as string[] };
  const [firstLevel] = await db.select().from(S.levels).orderBy(S.levels.minPoints).limit(1);
  const mechanicsBefore = (await db.select({ id: S.mechanics.id }).from(S.mechanics)).length;

  for (const [i, r] of rows.entries()) {
    const line = `Fila ${i + 2}`;
    try {
      const document = String(r.document ?? "").replace(/\D/g, "");
      const invoice = String(r.invoiceNumber ?? "").trim();
      const amount = parseAmount(r.amount);
      if (!invoice) throw new LoyaltyError("sin número de factura");
      if (!document) throw new LoyaltyError("sin cédula/NIT del cliente");
      if (amount <= 0) throw new LoyaltyError("valor inválido");
      if (amount < 1000) result.warnings.push(`${line}: valor muy bajo (${amount}); revise si falta escribir los miles`);

      // Categoría: si la columna trae un modelo de moto (ej. "GIXXER 150") se usa como modelo.
      // Una fila con mecánico es un servicio de taller.
      const detected = detectCategory(r.category);
      const hasMechanic = !!String(r.mechanic ?? "").trim();
      const category: Category = detected ?? (hasMechanic ? "TALLER" : opts.defaultCategory);
      // El texto puede ser un modelo ("GIXXER 150"), un año ("2007") o una marca ("HONDA")
      const extra = !detected && r.category ? String(r.category).trim() : "";
      const yearFromCategory = /^(19|20)\d{2}$/.test(extra) ? Number(extra) : null;
      const brandFromCategory = BRANDS[extra.toUpperCase()] ?? null;
      const modelFromCategory = extra && !yearFromCategory && !brandFromCategory ? titleCase(extra) : null;
      const when = parseDate(r.date) ?? new Date();
      const plate = String(r.plate ?? "").toUpperCase().replace(/[\s-]/g, "") || null;
      const model = String(r.model ?? "").trim() || modelFromCategory || null;
      const km = r.km === null || r.km === undefined || r.km === "" ? null : Math.round(parseAmount(r.km)) || null;
      const phone = String(r.phone ?? "").replace(/\D/g, "");
      const dup = await db.query.purchases.findFirst({ where: eq(S.purchases.invoiceNumber, invoice) });

      // Cliente: el de la factura ya registrada, o búsqueda por cédula (se crea si no existe)
      let customer = dup
        ? await db.query.customers.findFirst({ where: eq(S.customers.id, dup.customerId) })
        : await db.query.customers.findFirst({ where: eq(S.customers.document, document) });
      if (!customer) {
        if (opts.createMissing === false) throw new LoyaltyError(`cliente ${document} no existe`);
        const parts = String(r.name ?? "Cliente").trim().split(/\s+/);
        const firstName = parts.length > 2 ? parts.slice(0, 2).join(" ") : parts[0];
        const lastName = parts.length > 2 ? parts.slice(2).join(" ") : parts.slice(1).join(" ");
        customer = await db.transaction(async (tx) => {
          const [c] = await tx
            .insert(S.customers)
            .values({ document, firstName: toTitle(firstName), lastName: toTitle(lastName), phone, email: r.email || null, referralCode: makeReferralCode(firstName), levelId: firstLevel?.id })
            .returning();
          if (s.welcomeBonus > 0) await addMovement(tx, { customerId: c.id, type: "BIENVENIDA", points: s.welcomeBonus, description: "Bono de bienvenida al programa" });
          return c;
        });
        result.newCustomers++;
      } else if ((!customer.phone && phone) || (!customer.email && r.email)) {
        // Completa datos de contacto que faltaban
        await db.update(S.customers).set({ ...(!customer.phone && phone ? { phone } : {}), ...(!customer.email && r.email ? { email: String(r.email) } : {}) }).where(eq(S.customers.id, customer.id));
      }

      // Moto: por placa (se crea si es nueva) o, en una venta de moto sin placa, por modelo
      let motorcycleId: string | null = dup?.motorcycleId ?? null;
      if (!motorcycleId && (plate || (category === "MOTO" && model))) {
        const existing = plate ? await db.query.motorcycles.findFirst({ where: eq(S.motorcycles.plate, plate) }) : null;
        if (existing) {
          // La moto puede traerla otra persona: el servicio se asocia a la moto y los puntos a quien pagó
          motorcycleId = existing.id;
        } else {
          const [m] = await db
            .insert(S.motorcycles)
            .values({ customerId: customer.id, brand: brandFromCategory ?? "Suzuki", model: model ?? "Por definir", year: yearFromCategory, plate, purchaseDate: category === "MOTO" ? when : null, currentKm: km ?? 0 })
            .returning();
          motorcycleId = m.id;
          result.newMotos++;
        }
      }

      // Completa o corrige los datos de una moto que quedó sin modelo (o con un año o marca como modelo)
      if (motorcycleId) {
        const [m] = await db.select().from(S.motorcycles).where(eq(S.motorcycles.id, motorcycleId));
        const badModel = m.model === "Por definir" || /^(19|20)\d{2}$/.test(m.model) || !!BRANDS[m.model.toUpperCase()];
        const fix: { model?: string; year?: number; brand?: string } = {};
        if (badModel && /^(19|20)\d{2}$/.test(m.model) && !m.year) fix.year = Number(m.model);
        if (badModel && BRANDS[m.model.toUpperCase()]) fix.brand = BRANDS[m.model.toUpperCase()];
        if (badModel) fix.model = model ?? "Por definir";
        if (yearFromCategory && !m.year) fix.year = yearFromCategory;
        const finalModel = fix.model ?? m.model;
        if (brandFromCategory && m.brand === "Suzuki" && finalModel === "Por definir") fix.brand = brandFromCategory;
        if (Object.keys(fix).length && (fix.model !== m.model || fix.year || fix.brand)) {
          await db.update(S.motorcycles).set(fix).where(eq(S.motorcycles.id, motorcycleId));
        }
      }

      const mechanicId = category === "TALLER" ? await resolveMechanic(r.mechanic) : null;

      if (dup) {
        // Factura ya registrada: no suma puntos otra vez, solo completa o corrige lo que faltaba
        const fixedToTaller = category === "TALLER" && dup.category !== "TALLER" && dup.source !== "MANUAL" && hasMechanic;
        if (fixedToTaller) {
          await reclassifyAsTaller(dup.id, { mechanicId, motorcycleId, km, settings: s });
          result.updated++;
          continue;
        }
        const patch: { mechanicId?: string; motorcycleId?: string } = {};
        if (!dup.mechanicId && mechanicId && dup.category === "TALLER") patch.mechanicId = mechanicId;
        if (!dup.motorcycleId && motorcycleId) patch.motorcycleId = motorcycleId;
        if (Object.keys(patch).length) {
          await db.update(S.purchases).set(patch).where(eq(S.purchases.id, dup.id));
          if (patch.motorcycleId && dup.category === "TALLER") await addServiceRecord(dup.id, patch.motorcycleId, dup.date, km);
          result.updated++;
        } else {
          result.skipped++;
        }
        continue;
      }

      const res = await registerPurchase({
        customerId: customer.id,
        category,
        mechanicId,
        amount,
        date: when,
        invoiceNumber: invoice,
        motorcycleId,
        serviceKm: category === "TALLER" ? km : null,
        source: opts.source,
        createdById: opts.createdById,
        settings: s,
      });
      result.imported++;
      result.points += res.points;
    } catch (e) {
      result.errors.push(`${line}: ${e instanceof LoyaltyError ? e.message : String((e as Error).message ?? e)}`);
    }
  }
  result.newMechanics = (await db.select({ id: S.mechanics.id }).from(S.mechanics)).length - mechanicsBefore;
  return result;
}

/** Marcas que a veces llegan en lugar del modelo. */
const BRANDS: Record<string, string> = {
  HONDA: "Honda", YAMAHA: "Yamaha", AUTECO: "Auteco", BAJAJ: "Bajaj", KAWASAKI: "Kawasaki", AKT: "AKT", TVS: "TVS",
  KYMCO: "Kymco", HERO: "Hero", VICTORY: "Victory", KTM: "KTM", SUZUKI: "Suzuki", BMW: "BMW", DUCATI: "Ducati",
};

/**
 * Corrige una factura importada con la categoría equivocada para que quede como servicio de TALLER:
 * recalcula los puntos con la tarifa de taller (mismo multiplicador de nivel), ajusta el saldo del cliente
 * con la diferencia, asigna mecánico y moto, y registra el servicio en el control de mantenimiento.
 */
async function reclassifyAsTaller(purchaseId: string, o: { mechanicId: string | null; motorcycleId: string | null; km: number | null; settings: Settings }) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(S.purchases).where(eq(S.purchases.id, purchaseId));
    const oldBase = Math.floor(p.amount / Math.max(1, pesosPerPoint(p.category as Category, o.settings)));
    const multiplier = oldBase > 0 && p.pointsEarned > 0 ? p.pointsEarned / oldBase : 1;
    const newPoints = Math.floor(Math.floor(p.amount / Math.max(1, pesosPerPoint("TALLER", o.settings))) * multiplier);
    const delta = newPoints - p.pointsEarned;
    const motorcycleId = p.motorcycleId ?? o.motorcycleId;
    await tx.update(S.purchases).set({ category: "TALLER", pointsEarned: newPoints, mechanicId: o.mechanicId ?? p.mechanicId, motorcycleId }).where(eq(S.purchases.id, p.id));
    await tx
      .update(S.pointMovements)
      .set({ description: sql`replace(${S.pointMovements.description}, ${CATEGORY_LABEL[p.category as Category] ?? ""}, ${CATEGORY_LABEL.TALLER})` })
      .where(and(eq(S.pointMovements.purchaseId, p.id), eq(S.pointMovements.type, "COMPRA")));
    if (delta !== 0) {
      await addMovement(tx, {
        customerId: p.customerId,
        type: "AJUSTE",
        points: delta,
        description: `Corrección: factura ${p.invoiceNumber ?? ""} es servicio de taller`,
        purchaseId: p.id,
        createdAt: p.date,
      });
      if (delta < 0) {
        await tx.update(S.customers).set({ lifetimePoints: sql`GREATEST(0, ${S.customers.lifetimePoints} + ${delta})` }).where(eq(S.customers.id, p.customerId));
      }
    }
    await recalcLevel(tx, p.customerId);
  });
  const [p] = await db.select().from(S.purchases).where(eq(S.purchases.id, purchaseId));
  if (p.motorcycleId) await addServiceRecord(p.id, p.motorcycleId, p.date, o.km);
}

/** Registra el servicio de una factura de taller en el historial de la moto (si aún no existe). */
async function addServiceRecord(purchaseId: string, motorcycleId: string, date: Date, kmIn: number | null) {
  const exists = await db.select({ id: S.serviceRecords.id }).from(S.serviceRecords).where(eq(S.serviceRecords.purchaseId, purchaseId));
  if (exists.length) return;
  const [moto] = await db.select().from(S.motorcycles).where(eq(S.motorcycles.id, motorcycleId));
  const km = kmIn ?? moto.currentKm;
  await db.insert(S.serviceRecords).values({ motorcycleId, date, km, type: "Servicio de taller", purchaseId });
  if (!moto.lastServiceDate || moto.lastServiceDate < date) {
    await db.update(S.motorcycles).set({ lastServiceDate: date, lastServiceKm: km, currentKm: Math.max(km, moto.currentKm) }).where(eq(S.motorcycles.id, motorcycleId));
  }
}

function toTitle(s: string) {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
