import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Suzuki Melgar · Club de Fidelización", template: "%s · Suzuki Melgar" },
  description: "Programa de fidelización de clientes Suzuki Melgar: puntos, niveles, premios y mantenimientos.",
  appleWebApp: { capable: true, title: "Club Suzuki Melgar", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0f2f9c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
