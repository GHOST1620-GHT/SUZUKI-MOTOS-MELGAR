/**
 * Mensajes de WhatsApp. Por defecto se abren con enlaces wa.me (sin costo, el asesor da "Enviar").
 * Para envío automático, conecte WhatsApp Business Cloud API en sendWhatsAppAutomatic().
 */
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

export function waLink(phone: string, message: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export const templates = {
  maintenance: (name: string, model: string, plate: string | null, business: string) =>
    `Hola ${name} 👋, te saludamos de ${business}. Tu ${model}${plate ? ` (${plate})` : ""} ya está próxima a su mantenimiento preventivo 🔧. ¿Te agendamos una cita en el taller? Recuerda que cada servicio te suma puntos en nuestro programa de fidelización.`,
  inactive: (name: string, points: number, business: string) =>
    `Hola ${name}, te extrañamos en ${business} 🏍️. Tienes ${points.toLocaleString("es-CO")} puntos disponibles para canjear por servicios y accesorios. ¡Te esperamos!`,
  birthday: (name: string, business: string, bonus: number) =>
    `¡Feliz cumpleaños ${name}! 🎂 En ${business} te regalamos ${bonus} puntos. Pasa por el concesionario y consiéntete con un premio.`,
  points: (name: string, points: number, level: string, business: string) =>
    `Hola ${name}, tu saldo en el programa de fidelización de ${business} es de ${points.toLocaleString("es-CO")} puntos (nivel ${level}). Consulta tus premios en el portal de clientes.`,
  redemptionReady: (name: string, reward: string, code: string, business: string) =>
    `Hola ${name}, tu canje "${reward}" (código ${code}) ya está listo para reclamar en ${business}. ✅`,
};

export async function sendWhatsAppAutomatic(_phone: string, _message: string) {
  // Punto de integración para WhatsApp Business Cloud API (Meta).
  // Requiere WHATSAPP_TOKEN y WHATSAPP_PHONE_ID y plantillas aprobadas por Meta.
  return { sent: false, reason: "No configurado" };
}
