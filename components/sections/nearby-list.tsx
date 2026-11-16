import { getLocale } from "next-intl/server";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { tr } from "@/lib/settings";
import type { NearbyPlace } from "@/types/content";

export async function NearbyList({ places }: { places: NearbyPlace[] }) {
  const locale = await getLocale();
  return (
    <ul className="grid gap-3">
      {places.map((p) => {
        const note = tr(p.note, locale);
        return (
          <li key={p.id} className="card flex items-start gap-4 p-4 shadow-none">
            <span className="theme-dark bg-bg text-accent grid size-11 shrink-0 place-items-center rounded-xl">
              <AmenityIcon name={p.icon} className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">{tr(p.name, locale)}</p>
              <p className="text-muted text-sm">
                {tr(p.distance, locale)}
                {note ? `. ${note}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
