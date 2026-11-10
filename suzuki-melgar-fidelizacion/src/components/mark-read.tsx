"use client";
import { useEffect } from "react";

/** Marca las notificaciones como leídas al abrir la página. */
export function MarkRead({ action }: { action: () => Promise<void> }) {
  useEffect(() => {
    const t = setTimeout(() => action(), 1500);
    return () => clearTimeout(t);
  }, [action]);
  return null;
}
