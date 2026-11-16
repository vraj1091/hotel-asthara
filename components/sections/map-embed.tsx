import { getTranslations } from "next-intl/server";
import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HotelProfile } from "@/types/content";

export const directionsUrl = (h: HotelProfile) =>
  h.mapsPlaceUrl ||
  `https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`;

/** With NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY set, the official Maps Embed API is used (place pin with name and
 *  reviews); without it, the key-free embed still shows the exact location. */
function mapSrc(h: HotelProfile) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  if (key)
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(`${h.name}, ${h.locality}, ${h.city}`)}&center=${h.latitude},${h.longitude}&zoom=17`;
  return `https://www.google.com/maps?q=${h.latitude},${h.longitude}&z=17&output=embed`;
}

export async function MapEmbed({ hotel, className }: { hotel: HotelProfile; className?: string }) {
  const t = await getTranslations("common");
  return (
    <div className={cn("grid gap-4", className)}>
      <div className="border-line bg-surface-3 shadow-soft relative aspect-[4/3] overflow-hidden rounded-2xl border md:aspect-[16/11]">
        <iframe
          title={`Map showing ${hotel.name}, ${hotel.locality}, ${hotel.city}`}
          src={mapSrc(hotel)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 size-full border-0"
          allowFullScreen
        />
      </div>
      <Button asChild size="lg" className="w-full sm:w-fit">
        <a href={directionsUrl(hotel)} target="_blank" rel="noopener noreferrer">
          <Navigation aria-hidden />
          {t("getDirections")}
        </a>
      </Button>
    </div>
  );
}
