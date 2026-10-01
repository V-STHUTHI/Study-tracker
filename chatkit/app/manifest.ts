import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Daymark Study Tracker",
    short_name: "Daymark",
    description: "Share study sessions with your partner and track progress together.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1011",
    theme_color: "#0b1011",
    icons: [
      { src: "/icons/daymark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
