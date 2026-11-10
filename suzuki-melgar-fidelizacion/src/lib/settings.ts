import { db, schema } from "./db";

export const DEFAULT_SETTINGS = {
  businessName: "Suzuki Melgar",
  /** WhatsApp del concesionario, formato internacional sin "+" */
  businessPhone: "573000000000",
  businessAddress: "Melgar, Tolima",
  /** Pesos (COP) necesarios para ganar 1 punto, por categoría */
  pesosPerPointMOTO: 10000,
  pesosPerPointREPUESTOS: 2000,
  pesosPerPointACCESORIOS: 2000,
  pesosPerPointTALLER: 1500,
  /** Valor de referencia de 1 punto en COP (para reportes de pasivo) */
  pointValueCOP: 50,
  welcomeBonus: 200,
  referralBonus: 1500,
  birthdayBonus: 300,
  /** Meses sin compras tras los cuales vencen los puntos (0 = nunca) */
  expirationMonths: 18,
  /** Días sin compras para considerar a un cliente inactivo */
  inactiveDays: 120,
  /** Días de anticipación para avisar el mantenimiento */
  reminderLeadDays: 10,
};

export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(schema.settings);
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (!(r.key in DEFAULT_SETTINGS)) continue;
    const def = DEFAULT_SETTINGS[r.key as keyof Settings];
    s[r.key] = typeof def === "number" ? Number(r.value) : r.value;
  }
  return s as Settings;
}

export async function saveSettings(values: Partial<Record<keyof Settings, string | number>>) {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
    await db
      .insert(schema.settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: String(value) } });
  }
}
