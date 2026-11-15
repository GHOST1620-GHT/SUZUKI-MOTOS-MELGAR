import { revalidatePath } from "next/cache";

/** revalidatePath tolerante: si el entorno perdió el contexto de la petición (p. ej. StackBlitz), no rompe la acción. */
export function safeRevalidate(path: string, type?: "layout" | "page") {
  try {
    revalidatePath(path, type);
  } catch {
    // Las páginas son dinámicas: el redirect posterior ya muestra datos actualizados.
  }
}
