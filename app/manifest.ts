import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { getSettings } from "@/lib/settings";

/** Lets guests add the site to their phone's home screen. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();
  return {
    name: settings.hotel.name,
    short_name: settings.hotel.name.replace(/^Hotel\s+/i, ""),
    description: settings.seo.defaultDescription.en,
    start_url: "/",
    display: "standalone",
    background_color: BRAND.navy,
    theme_color: BRAND.navy,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Rooms and rates", url: "/rooms" },
      { name: "Contact", url: "/contact" },
    ],
  };
}
