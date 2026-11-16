import { getLocale } from "next-intl/server";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { SpotlightGroup } from "@/components/ui/spotlight-group";
import { SectionHeading } from "@/components/ui/section-heading";
import { AMENITY_CATALOG } from "@/lib/amenities";
import { tr } from "@/lib/settings";
import { cn } from "@/lib/utils";
import type { SectionContent, SiteSettings } from "@/types/content";

/** Bento tiles: the first two are wide and carry a short note, the rest fill rows of three without leaving a gap. */
function spanFor(index: number, total: number) {
  if (index < 2) return "col-span-2 lg:col-span-3";
  const rest = total - 2;
  const pos = index - 2;
  const lastRow = rest % 3;
  if (lastRow === 1 && pos === rest - 1) return "col-span-2 lg:col-span-6";
  if (lastRow === 2 && pos >= rest - 2) return "col-span-1 lg:col-span-3";
  return "col-span-1 lg:col-span-2";
}

export async function Amenities({
  content,
  settings,
}: {
  content: SectionContent["AMENITIES"];
  settings: SiteSettings;
}) {
  const locale = await getLocale();
  const items = AMENITY_CATALOG.filter((a) => settings.amenities.enabled.includes(a.key));
  if (items.length === 0) return null;
  return (
    <section id="amenities" className="section-y bg-surface-2">
      <div className="container-page">
        <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
        <SpotlightGroup className="reveal mt-12 grid grid-cols-2 gap-4 lg:grid-cols-6">
          {items.map((a, i) => {
            const wide = i < 2;
            const blurb = locale === "hi" ? a.blurbHi || a.blurb : a.blurb;
            return (
              <div
                key={a.key}
                className={cn(
                  "card spot flex gap-4 p-5",
                  wide
                    ? "flex-col justify-between gap-8 p-6 sm:min-h-44"
                    : "flex-col sm:flex-row sm:items-center",
                  spanFor(i, items.length),
                )}
              >
                <span className="theme-dark bg-bg text-accent grid size-12 shrink-0 place-items-center rounded-xl">
                  <AmenityIcon name={a.icon} className="size-6" />
                </span>
                <div>
                  <p className={cn("font-heading", wide ? "text-h3" : "text-lg leading-snug")}>
                    {locale === "hi" ? a.labelHi : a.label}
                  </p>
                  {wide && blurb ? <p className="text-muted mt-1">{blurb}</p> : null}
                </div>
              </div>
            );
          })}
        </SpotlightGroup>
      </div>
    </section>
  );
}
