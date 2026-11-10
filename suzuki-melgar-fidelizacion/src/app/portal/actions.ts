"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, CUSTOMER_COOKIE, destroySession, requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { LoyaltyError, redeemReward } from "@/lib/loyalty";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
function go(path: string, msg: { ok?: string; error?: string }): never {
  revalidatePath("/portal", "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}${msg.ok ? `ok=${encodeURIComponent(msg.ok)}` : `error=${encodeURIComponent(msg.error ?? "")}`}`);
}

export async function customerLogin(fd: FormData) {
  const document = str(fd, "document").replace(/\D/g, "");
  const c = await db.query.customers.findFirst({ where: eq(S.customers.document, document) });
  if (!c?.passwordHash) go("/portal/login", { error: c ? "Aún no ha activado su cuenta. Actívela abajo." : "No encontramos esa cédula en el programa." });
  if (!(await bcrypt.compare(str(fd, "password"), c.passwordHash))) go("/portal/login", { error: "Contraseña incorrecta" });
  await createSession(CUSTOMER_COOKIE, { sub: c.id, kind: "customer" });
  redirect("/portal");
}

/** Activación: el cliente confirma su identidad con cédula + celular registrado en el concesionario. */
export async function activateAccount(fd: FormData) {
  const document = str(fd, "document").replace(/\D/g, "");
  const phone = str(fd, "phone").replace(/\D/g, "");
  const pwd = str(fd, "password");
  if (pwd.length < 6) go("/portal/activar", { error: "La contraseña debe tener mínimo 6 caracteres" });
  if (pwd !== str(fd, "password2")) go("/portal/activar", { error: "Las contraseñas no coinciden" });
  const c = await db.query.customers.findFirst({ where: eq(S.customers.document, document) });
  if (!c || c.phone.slice(-10) !== phone.slice(-10)) go("/portal/activar", { error: "Los datos no coinciden con nuestros registros. Acérquese al concesionario para actualizarlos." });
  await db.update(S.customers).set({ passwordHash: await bcrypt.hash(pwd, 10), portalActivatedAt: new Date() }).where(eq(S.customers.id, c.id));
  await createSession(CUSTOMER_COOKIE, { sub: c.id, kind: "customer" });
  redirect("/portal?ok=" + encodeURIComponent("¡Cuenta activada! Bienvenido al Club"));
}

export async function customerLogout() {
  await destroySession(CUSTOMER_COOKIE);
  redirect("/portal/login");
}

export async function requestRedemption(fd: FormData) {
  const c = await requireCustomer();
  let code = "";
  try {
    const r = await redeemReward({ customerId: c.id, rewardId: str(fd, "rewardId"), channel: "PORTAL" });
    code = r.code;
  } catch (e) {
    go("/portal/premios", { error: e instanceof LoyaltyError ? e.message : "No se pudo completar el canje" });
  }
  go("/portal/canjes", { ok: `¡Canje solicitado! Tu código es ${code}` });
}

export async function referFriend(fd: FormData) {
  const c = await requireCustomer();
  const name = str(fd, "name");
  const phone = str(fd, "phone").replace(/\D/g, "");
  if (!name || phone.length < 7) go("/portal/referidos", { error: "Escribe el nombre y celular de tu amigo" });
  await db.insert(S.referrals).values({ referrerId: c.id, name, phone, interest: str(fd, "interest") || null });
  go("/portal/referidos", { ok: "¡Gracias! Un asesor contactará a tu amigo" });
}

export async function updateProfile(fd: FormData) {
  const c = await requireCustomer();
  const phone = str(fd, "phone").replace(/\D/g, "");
  if (phone.length < 7) go("/portal/perfil", { error: "Celular inválido" });
  await db
    .update(S.customers)
    .set({ phone, email: str(fd, "email").toLowerCase() || null, address: str(fd, "address") || null, city: str(fd, "city") || null, acceptsMarketing: fd.get("acceptsMarketing") === "on" })
    .where(eq(S.customers.id, c.id));
  go("/portal/perfil", { ok: "Datos actualizados" });
}

export async function changePassword(fd: FormData) {
  const c = await requireCustomer();
  if (!c.passwordHash || !(await bcrypt.compare(str(fd, "current"), c.passwordHash))) go("/portal/perfil", { error: "La contraseña actual no es correcta" });
  const pwd = str(fd, "password");
  if (pwd.length < 6) go("/portal/perfil", { error: "La nueva contraseña debe tener mínimo 6 caracteres" });
  await db.update(S.customers).set({ passwordHash: await bcrypt.hash(pwd, 10) }).where(eq(S.customers.id, c.id));
  go("/portal/perfil", { ok: "Contraseña actualizada" });
}

export async function markNotificationsRead() {
  const c = await requireCustomer();
  await db.update(S.notifications).set({ read: true }).where(and(eq(S.notifications.customerId, c.id), eq(S.notifications.read, false)));
  revalidatePath("/portal", "layout");
}
