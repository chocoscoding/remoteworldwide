import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Remote Worldwide",
    short_name: "Remote worldwide",
    description: "Get worldwide remote jobs",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#222325", // Using primary color
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
