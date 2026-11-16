import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getGalleryImages } from "@/features/cms/queries";
import { tr } from "@/lib/settings";
import { cn } from "@/lib/utils";
import type { SectionContent } from "@/types/content";

// Bento placements for the first six photos on a 4-column grid
const PLACEMENT = [
  "col-span-2 row-span-2",
  "col-span-1 row-span-1",
  "col-span-1 row-span-2",
  "col-span-1 row-span-1",
  "col-span-2 row-span-1",
  "col-span-2 row-span-1",
];

export async function GalleryPreview({ content }: { content: SectionContent["GALLERY"] }) {
  const [locale, t, images] = await Promise.all([
    getLocale(),
    getTranslations("nav"),
    getGalleryImages(),
  ]);
  if (images.length === 0) return null;
  const shown = images.slice(0, Math.min(content.limit || 6, 6));
  return (
    <section id="gallery" className="section-y">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
          <Button asChild variant="outline">
            <Link href="/gallery">{t("gallery")}</Link>
          </Button>
        </div>
        <Reveal className="mt-12 grid auto-rows-[10rem] grid-cols-2 gap-3 md:auto-rows-[12rem] md:grid-cols-4 md:gap-4">
          {shown.map((img, i) => (
            <Photo
              key={img.id}
              src={img.url}
              alt={img.alt || "Hotel Asthara"}
              sizes="(min-width: 768px) 25vw, 50vw"
              className={cn("rounded-2xl", PLACEMENT[i])}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
