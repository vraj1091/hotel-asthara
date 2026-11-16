import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { RoomShowcase, type ShowcaseRoom } from "@/components/sections/room-showcase";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getRoomTypes, roomText } from "@/features/rooms/queries";
import { roomPhotos } from "@/features/media/photos";
import { AMENITY_BY_KEY } from "@/lib/amenities";
import { tr } from "@/lib/settings";
import { getTonight } from "@/lib/tonight";
import type { SectionContent } from "@/types/content";

export async function RoomsGrid({ content }: { content: SectionContent["ROOMS_GRID"] }) {
  const [locale, t, tr2, rooms, tonight] = await Promise.all([
    getLocale(),
    getTranslations("common"),
    getTranslations("rooms"),
    getRoomTypes(),
    getTonight(),
  ]);
  if (rooms.length === 0) return null;
  const shown = rooms.slice(0, Math.max(1, content.limit));
  const featured = shown.find((r) => r.featured) ?? shown[0]!;

  const covers = await Promise.all(shown.map((r) => roomPhotos(r).then((p) => p[0] ?? null)));
  const data: ShowcaseRoom[] = shown.map((room, idx) => {
    const text = roomText(room, locale);
    const live = tonight?.byType[room.id];
    return {
      id: room.id,
      slug: room.slug,
      name: text.name,
      summary: text.summary,
      meta: [
        tr2("size", { size: room.sizeSqFt }),
        room.bedType,
        tr2("sleeps", { adults: room.maxAdults, children: room.maxChildren }),
      ],
      ratePaise: live?.ratePaise ?? room.baseRatePaise,
      cover: covers[idx] ? { url: covers[idx]!.url, alt: covers[idx]!.alt } : null,
      tonight: live ? live.free : null,
      amenities: room.amenities
        .map((k) => AMENITY_BY_KEY[k])
        .filter((a): a is NonNullable<typeof a> => !!a)
        .slice(0, 5)
        .map((a) => ({ key: a.key, label: locale === "hi" ? a.labelHi : a.label, icon: a.icon })),
    };
  });

  return (
    <section id="rooms" className="section-y">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
          <Button asChild variant="outline">
            <Link href="/rooms">{t("viewAll")}</Link>
          </Button>
        </div>
        <Reveal className="mt-12">
          <RoomShowcase rooms={data} initialId={featured.id} />
        </Reveal>
      </div>
    </section>
  );
}
