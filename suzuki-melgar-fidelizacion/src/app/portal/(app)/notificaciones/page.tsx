import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { MarkRead } from "@/components/mark-read";
import { markNotificationsRead } from "../../actions";

export const metadata = { title: "Notificaciones" };

export default async function Notificaciones() {
  const c = await requireCustomer();
  const rows = await db.select().from(S.notifications).where(eq(S.notifications.customerId, c.id)).orderBy(desc(S.notifications.createdAt)).limit(100);
  const unread = rows.some((r) => !r.read);
  return (
    <div className="space-y-4">
      {unread && <MarkRead action={markNotificationsRead} />}
      <h1 className="text-2xl font-bold text-slate-900">Notificaciones</h1>
      {rows.length === 0 ? <div className="card"><EmptyState icon={Bell} title="Sin notificaciones" /></div> : (
        <div className="card divide-y divide-slate-100">
          {rows.map((n) => (
            <div key={n.id} className={`flex gap-3 px-5 py-4 ${n.read ? "" : "bg-brand-50/60"}`}>
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent-500"}`} />
              <div>
                <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                <p className="text-sm text-slate-600">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{dateTime(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
