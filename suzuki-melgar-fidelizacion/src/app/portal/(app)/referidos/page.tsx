import { desc, eq } from "drizzle-orm";
import { requireCustomer } from "@/lib/auth";
import { db, schema as S } from "@/lib/db";
import { date, pts, REFERRAL_STATUS } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { CopyButton, SubmitButton, WhatsAppIcon } from "@/components/client";
import { Badge } from "@/components/ui";
import { referFriend } from "../../actions";

export const metadata = { title: "Referidos" };

export default async function Referidos() {
  const c = await requireCustomer();
  const s = await getSettings();
  const rows = await db.select().from(S.referrals).where(eq(S.referrals.referrerId, c.id)).orderBy(desc(S.referrals.createdAt));
  const won = rows.filter((r) => r.status === "COMPRO").reduce((a, r) => a + r.bonusPoints, 0);
  const share = `¡Hola! Te recomiendo ${s.businessName} para comprar tu moto 🏍️. Diles que vas de mi parte con el código ${c.referralCode} y entra al Club de Fidelización.`;
  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-violet-600 to-brand-700 p-6 text-center text-white">
          <p className="text-4xl">🤝</p>
          <h1 className="mt-2 text-2xl font-extrabold">Gana {pts(s.referralBonus)} puntos por cada amigo</h1>
          <p className="mt-1 text-sm text-white/80">Cuando tu referido compre su moto en {s.businessName}, te abonamos los puntos automáticamente.</p>
        </div>
        <div className="p-5">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-slate-500">Tu código</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 px-5 py-2 font-mono text-2xl font-extrabold tracking-widest text-brand-900">{c.referralCode}</span>
            <CopyButton text={c.referralCode} />
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" className="btn btn-whatsapp mt-4 w-full"><WhatsAppIcon /> Compartir por WhatsApp</a>
        </div>
      </div>

      <div className="card p-5">
        <p className="font-semibold text-slate-900">Recomienda a un amigo</p>
        <p className="text-sm text-slate-500">Déjanos sus datos y un asesor lo contacta.</p>
        <form action={referFriend} className="mt-4 space-y-3">
          <input name="name" required className="input py-3" placeholder="Nombre de tu amigo" />
          <input name="phone" required inputMode="tel" className="input py-3" placeholder="Celular" />
          <input name="interest" className="input py-3" placeholder="¿Qué moto le interesa? (opcional)" />
          <SubmitButton className="btn btn-primary w-full py-3">Enviar referido</SubmitButton>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-3">
          <p className="font-semibold text-slate-900">Mis referidos ({rows.length})</p>
          <p className="text-sm text-emerald-600">+{pts(won)} pts ganados</p>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.length === 0 && <p className="px-5 pb-5 text-sm text-slate-500">Todavía no has referido a nadie.</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-500">{date(r.createdAt)}{r.interest ? ` · ${r.interest}` : ""}</p>
              </div>
              <Badge tone={REFERRAL_STATUS[r.status].tone}>{r.status === "COMPRO" ? `+${pts(r.bonusPoints)} pts` : REFERRAL_STATUS[r.status].label}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
