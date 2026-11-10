"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";

/** Muestra mensajes ?ok= / ?error= que dejan las acciones del servidor. */
export function Flash() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  useEffect(() => {
    const ok = params.get("ok");
    const error = params.get("error");
    if (ok || error) {
      setMsg({ ok: ok ?? undefined, error: error ?? undefined });
      const p = new URLSearchParams(params.toString());
      p.delete("ok");
      p.delete("error");
      router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
      const t = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [params, pathname, router]);

  if (!msg) return null;
  const isErr = !!msg.error;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
      <div className={`animate-toast pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ${isErr ? "bg-red-50 text-red-800 ring-red-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"}`}>
        {isErr ? <XCircle className="mt-0.5 size-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0" />}
        <span>{msg.error ?? msg.ok}</span>
        <button onClick={() => setMsg(null)} className="ml-2 opacity-60 hover:opacity-100" aria-label="Cerrar">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function SubmitButton({ children, className = "btn btn-primary", pendingText = "Guardando…", confirm }: { children: React.ReactNode; className?: string; pendingText?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Ventana modal con botón disparador. */
export function Modal({ trigger, title, children, triggerClassName = "btn btn-primary", size = "md" }: { trigger: React.ReactNode; title: string; children: React.ReactNode; triggerClassName?: string; size?: "md" | "lg" }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        className={`animate-pop m-auto w-[calc(100%-2rem)] ${size === "lg" ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm`}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={() => ref.current?.close()} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5" onSubmit={() => setTimeout(() => ref.current?.close(), 50)}>
          {children}
        </div>
      </dialog>
    </>
  );
}

/** Abre WhatsApp y registra el envío en el servidor. */
export function WhatsAppButton({ href, onSend, children, className = "btn btn-whatsapp btn-sm" }: { href: string; onSend?: () => Promise<void>; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => {
        onSend?.();
      }}
    >
      <WhatsAppIcon /> {children}
    </a>
  );
}

export function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5.01c0-5.19 4.23-9.41 9.42-9.41 2.51 0 4.88.98 6.65 2.76a9.35 9.35 0 0 1 2.76 6.66c0 5.19-4.23 9.41-9.42 9.41m8.02-17.43A11.27 11.27 0 0 0 12.05.75C5.8.75.7 5.84.7 12.1c0 2 .52 3.95 1.52 5.67L.6 23.25l5.6-1.47a11.3 11.3 0 0 0 5.84 1.5c6.25 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02" />
    </svg>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {}
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? "¡Copiado!" : label}
    </button>
  );
}

/** Calcula en vivo los puntos que ganará una compra. */
export function PointsPreview({ rates, multiplier }: { rates: Record<string, number>; multiplier: number }) {
  const [state, setState] = useState({ amount: 0, category: "REPUESTOS" });
  useEffect(() => {
    const form = document.getElementById("purchase-form") as HTMLFormElement | null;
    if (!form) return;
    const update = () => {
      const fd = new FormData(form);
      setState({ amount: Number(String(fd.get("amount") ?? "").replace(/\D/g, "")) || 0, category: String(fd.get("category") ?? "REPUESTOS") });
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, []);
  const p = Math.floor(Math.floor(state.amount / (rates[state.category] || 1)) * multiplier);
  return (
    <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-brand-800">
      <span className="text-sm font-medium">Puntos a otorgar{multiplier > 1 ? ` (x${multiplier})` : ""}</span>
      <span className="text-2xl font-bold tabular-nums">+{p.toLocaleString("es-CO")}</span>
    </div>
  );
}

/** Muestra campos extra solo cuando la categoría es TALLER. */
export function ShowWhenCategory({ value, children }: { value: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const form = document.getElementById("purchase-form") as HTMLFormElement | null;
    if (!form) return;
    const update = () => setShow(new FormData(form).get("category") === value);
    form.addEventListener("change", update);
    update();
    return () => form.removeEventListener("change", update);
  }, [value]);
  return show ? <>{children}</> : null;
}

export function MoneyInput({ name, defaultValue, required }: { name: string; defaultValue?: number; required?: boolean }) {
  const [v, setV] = useState(defaultValue ? defaultValue.toLocaleString("es-CO") : "");
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">$</span>
      <input
        className="input pl-7 tabular-nums"
        inputMode="numeric"
        name={name}
        required={required}
        value={v}
        placeholder="0"
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "");
          setV(d ? Number(d).toLocaleString("es-CO") : "");
        }}
      />
    </div>
  );
}
