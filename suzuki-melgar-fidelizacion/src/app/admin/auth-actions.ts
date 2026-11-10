"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createSession, destroySession, STAFF_COOKIE } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function staffLogin(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/admin/login?error=" + encodeURIComponent("Correo o contraseña incorrectos"));
  }
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await createSession(STAFF_COOKIE, { sub: user.id, kind: "staff", role: user.role });
  redirect("/admin");
}

export async function staffLogout() {
  await destroySession(STAFF_COOKIE);
  redirect("/admin/login");
}
