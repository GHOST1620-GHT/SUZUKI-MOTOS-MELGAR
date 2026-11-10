import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Club Suzuki Melgar",
    short_name: "Club Suzuki",
    description: "Tus puntos, premios y mantenimientos Suzuki Melgar",
    start_url: "/portal",
    display: "standalone",
    background_color: "#0a1c57",
    theme_color: "#0f2f9c",
    lang: "es-CO",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
