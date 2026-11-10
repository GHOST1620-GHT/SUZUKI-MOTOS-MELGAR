export const CATEGORIES = {
  MOTO: { label: "Moto", color: "#1d4ed8" },
  REPUESTOS: { label: "Repuestos", color: "#0891b2" },
  ACCESORIOS: { label: "Accesorios", color: "#7c3aed" },
  TALLER: { label: "Taller / Servicio", color: "#ea580c" },
} as const;
export type Category = keyof typeof CATEGORIES;

export const MOVEMENT_TYPES: Record<string, { label: string; tone: Tone }> = {
  COMPRA: { label: "Compra", tone: "blue" },
  CANJE: { label: "Canje", tone: "red" },
  BONO: { label: "Bono", tone: "green" },
  REFERIDO: { label: "Referido", tone: "purple" },
  CUMPLEANOS: { label: "Cumpleaños", tone: "pink" },
  BIENVENIDA: { label: "Bienvenida", tone: "green" },
  AJUSTE: { label: "Ajuste", tone: "gray" },
  VENCIMIENTO: { label: "Vencimiento", tone: "amber" },
  DEVOLUCION: { label: "Devolución", tone: "amber" },
};

export const REDEMPTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDIENTE: { label: "Pendiente", tone: "amber" },
  APROBADO: { label: "Listo para entregar", tone: "blue" },
  ENTREGADO: { label: "Entregado", tone: "green" },
  CANCELADO: { label: "Cancelado", tone: "gray" },
};

export const REFERRAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDIENTE: { label: "Pendiente", tone: "amber" },
  CONTACTADO: { label: "Contactado", tone: "blue" },
  COMPRO: { label: "Compró", tone: "green" },
  DESCARTADO: { label: "Descartado", tone: "gray" },
};

export const ROLES: Record<string, string> = {
  ADMIN: "Administrador",
  ASESOR: "Asesor comercial",
  TALLER: "Taller",
};

export const REWARD_CATEGORIES: Record<string, string> = {
  SERVICIO: "Servicio de taller",
  ACCESORIO: "Accesorio",
  DESCUENTO: "Descuento",
  EXPERIENCIA: "Experiencia",
};

export type Tone = "blue" | "red" | "green" | "purple" | "pink" | "gray" | "amber";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("es-CO");

export const money = (n: number) => cop.format(n);
export const pts = (n: number) => num.format(n);

export function date(d: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CO", opts ?? { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" });
}

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
}

export function relative(d: Date | string | null | undefined) {
  if (!d) return "Nunca";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${months} ${months === 1 ? "mes" : "meses"}`;
  const y = Math.floor(months / 12);
  return `Hace ${y} ${y === 1 ? "año" : "años"}`;
}

export function toInputDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
