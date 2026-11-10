import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret");
export const STAFF_COOKIE = "sm_staff";
export const CUSTOMER_COOKIE = "sm_cliente";

type SessionPayload = { sub: string; kind: "staff" | "customer"; role?: string };

export async function createSession(cookieName: string, payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function readSession(cookieName: string): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession(cookieName: string) {
  const store = await cookies();
  store.delete(cookieName);
}

export async function requireStaff(roles?: string[]) {
  const s = await readSession(STAFF_COOKIE);
  if (!s || s.kind !== "staff") redirect("/admin/login");
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, s.sub) });
  if (!user || !user.active) redirect("/admin/login");
  if (roles && !roles.includes(user.role)) redirect("/admin?error=Sin+permisos+para+esta+sección");
  return user;
}

export async function requireCustomer() {
  const s = await readSession(CUSTOMER_COOKIE);
  if (!s || s.kind !== "customer") redirect("/portal/login");
  const customer = await db.query.customers.findFirst({
    where: eq(schema.customers.id, s.sub),
    with: { level: true },
  });
  if (!customer) redirect("/portal/login");
  return customer;
}
