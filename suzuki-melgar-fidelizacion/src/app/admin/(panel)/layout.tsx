import { Suspense } from "react";
import { count, eq, inArray } from "drizzle-orm";
import { requireStaff } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ROLES } from "@/lib/format";
import { maintenanceStatus } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { AdminNav } from "@/components/admin-nav";
import { Flash } from "@/components/client";
import { staffLogout } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const s = await getSettings();
  const [[redeem], [refs], motos] = await Promise.all([
    db.select({ n: count() }).from(schema.redemptions).where(inArray(schema.redemptions.status, ["PENDIENTE", "APROBADO"])),
    db.select({ n: count() }).from(schema.referrals).where(eq(schema.referrals.status, "PENDIENTE")),
    db.select().from(schema.motorcycles),
  ]);
  const maint = motos.filter((m) => maintenanceStatus(m, s.reminderLeadDays).state === "VENCIDO").length;

  return (
    <div className="min-h-screen">
      <Suspense>
        <Flash />
      </Suspense>
      <AdminNav user={{ name: user.name, role: user.role, roleLabel: ROLES[user.role] ?? user.role }} counts={{ maint, redeem: redeem.n, refs: refs.n }} logout={staffLogout} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
