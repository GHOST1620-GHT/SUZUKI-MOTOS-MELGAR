import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, subtitle, actions, padded = true, id }: { children: React.ReactNode; className?: string; id?: string; title?: React.ReactNode; subtitle?: string; actions?: React.ReactNode; padded?: boolean }) {
  return (
    <section id={id} className={cx("card", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

const toneMap: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
  pink: "bg-pink-50 text-pink-700 ring-pink-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap", toneMap[tone], className)}>{children}</span>;
}

export function LevelBadge({ level, size = "sm" }: { level?: { name: string; color: string } | null; size?: "sm" | "lg" }) {
  if (!level) return <Badge>Sin nivel</Badge>;
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full font-bold text-white shadow-sm whitespace-nowrap", size === "lg" ? "px-3.5 py-1 text-sm" : "px-2.5 py-0.5 text-xs")}
      style={{ background: `linear-gradient(135deg, ${level.color}, ${level.color}cc)` }}
    >
      ★ {level.name}
    </span>
  );
}

const statTones: Record<string, string> = {
  blue: "bg-brand-50 text-brand-700",
  red: "bg-red-50 text-accent-500",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-violet-50 text-violet-600",
  cyan: "bg-cyan-50 text-cyan-600",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "blue", href }: { label: string; value: React.ReactNode; icon: LucideIcon; hint?: React.ReactNode; tone?: keyof typeof statTones; href?: string }) {
  const body = (
    <div className="card flex h-full items-start gap-4 p-5 transition hover:shadow-md">
      <div className={cx("flex size-11 shrink-0 items-center justify-center rounded-xl", statTones[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Avatar({ name, color = "#0f2f9c", size = 40 }: { name: string; color?: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: color }}>
      {ini}
    </span>
  );
}

export function Progress({ value, color = "#0f2f9c", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cx("h-2.5 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="size-6" />
      </div>
      <p className="font-semibold text-slate-700">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-slate-500">
        Página {page} de {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link className="btn btn-secondary btn-sm" href={makeHref(page - 1)}>
            Anterior
          </Link>
        )}
        {page < pages && (
          <Link className="btn btn-secondary btn-sm" href={makeHref(page + 1)}>
            Siguiente
          </Link>
        )}
      </div>
    </div>
  );
}

export function Points({ value, className }: { value: number; className?: string }) {
  const pos = value >= 0;
  return <span className={cx("font-semibold tabular-nums", pos ? "text-emerald-600" : "text-red-600", className)}>{pos ? "+" : ""}{value.toLocaleString("es-CO")}</span>;
}
