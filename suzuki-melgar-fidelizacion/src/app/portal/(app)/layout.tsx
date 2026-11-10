import { Suspense } from "react";
import { and, count, eq } from "drizzle-orm";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { Flash } from "@/components/client";
import { PortalNav } from "@/components/portal-nav";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const c = await requireCustomer();
  const [{ n }] = await db.select({ n: count() }).from(S.notifications).where(and(eq(S.notifications.customerId, c.id), eq(S.notifications.read, false)));
  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10">
      <Suspense><Flash /></Suspense>
      <PortalNav unread={n} name={c.firstName} />
      <main className="mx-auto max-w-4xl px-4 py-5">{children}</main>
    </div>
  );
}
