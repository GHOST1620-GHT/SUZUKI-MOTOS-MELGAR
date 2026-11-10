import { NextResponse } from "next/server";
import { and, eq, exists, ilike, or, sql } from "drizzle-orm";
import { readSession, STAFF_COOKIE } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";

export async function GET(req: Request) {
  const session = await readSession(STAFF_COOKIE);
  if (!session) return NextResponse.json([], { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);
  const like = `%${q}%`;
  const rows = await db.query.customers.findMany({
    where: or(
      ilike(sql`${S.customers.firstName} || ' ' || ${S.customers.lastName}`, like),
      ilike(S.customers.document, like),
      ilike(S.customers.phone, like),
      exists(db.select().from(S.motorcycles).where(and(eq(S.motorcycles.customerId, S.customers.id), ilike(S.motorcycles.plate, like)))),
    ),
    limit: 8,
    with: { level: true, motorcycles: true },
  });
  return NextResponse.json(
    rows.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      document: c.document,
      phone: c.phone,
      points: c.pointsBalance,
      level: c.level?.name ?? null,
      color: c.level?.color ?? null,
      plates: c.motorcycles.map((m) => m.plate).filter(Boolean).join(", "),
    })),
  );
}
