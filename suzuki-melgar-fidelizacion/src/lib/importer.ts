/**
 * Importación de facturas desde MasControl (archivo Excel/CSV o API).
 * Cada fila = una factura. Si el cliente no existe se crea automáticamente.
 */
import { and, eq } from "drizzle-orm";
import { db, schema as S } from "./db";
import type { Category } from "./format";
import { addMovement, LoyaltyError, makeReferralCode, registerPurchase } from "./loyalty";
import { getSettings } from "./settings";
import { resolveMechanic } from "./mechanics";

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

      const category = guessCategory(r.category, opts.defaultCategory);
      const when = parseDate(r.date) ?? new Date();
      const plate = String(r.plate ?? "").toUpperCase().replace(/[\s-]/g, "") || null;
      const model = String(r.model ?? "").trim() || null;
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
        if (existing && existing.customerId !== customer.id) {
          result.warnings.push(`${line}: la placa ${plate} pertenece a otro cliente; no se asoció la moto`);
        } else if (existing) {
          motorcycleId = existing.id;
        } else {
          const [m] = await db
            .insert(S.motorcycles)
            .values({ customerId: customer.id, model: model ?? "Por definir", plate, purchaseDate: category === "MOTO" ? when : null, currentKm: km ?? 0 })
            .returning();
          motorcycleId = m.id;
          result.newMotos++;
        }
      }

      // Si la moto se había creado sin modelo, completa el modelo
      if (motorcycleId && model) {
        await db.update(S.motorcycles).set({ model }).where(and(eq(S.motorcycles.id, motorcycleId), eq(S.motorcycles.model, "Por definir")));
      }

      const mechanicId = category === "TALLER" ? await resolveMechanic(r.mechanic) : null;

      if (dup) {
        // Factura ya registrada: no suma puntos otra vez, solo completa lo que faltaba
        const patch: { mechanicId?: string; motorcycleId?: string } = {};
        if (!dup.mechanicId && mechanicId && dup.category === "TALLER") patch.mechanicId = mechanicId;
        if (!dup.motorcycleId && motorcycleId) patch.motorcycleId = motorcycleId;
        if (Object.keys(patch).length) {
          await db.update(S.purchases).set(patch).where(eq(S.purchases.id, dup.id));
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

function toTitle(s: string) {
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
