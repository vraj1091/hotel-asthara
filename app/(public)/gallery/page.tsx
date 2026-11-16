import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { GalleryGrid } from "@/components/sections/gallery-grid";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { galleryPhotos } from "@/features/media/photos";
import { pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";

export async function generateMetadata() {
  return pageMetadata(await getSettings(), { key: "gallery", path: "/gallery" });
}

export default async function GalleryPage() {
  const [settings, photos, t, tg, locale] = await Promise.all([
    getSettings(),
    galleryPhotos(),
    getTranslations("nav"),
    getTranslations("gallery"),
    getLocale(),
  ]);
  const labels = Object.fromEntries(
    settings.gallery.categories.map((c) => [c.key, tr(c.label, locale)]),
  );
  return (
    <>
      <PageHeader
        title={tr(settings.seo.pages.gallery?.title, locale) || t("gallery")}
        intro={tr(settings.seo.pages.gallery?.description, locale)}
        crumbs={[{ name: t("gallery") }]}
      />
      <section className="section-y !pt-10">
        <div className="container-page">
          {photos.length ? (
            <GalleryGrid
              items={photos.map((p) => ({
                id: p.id,
                url: p.url,
                alt: (locale === "hi" && p.altHi) || p.alt || settings.hotel.name,
                category: p.category,
              }))}
              labels={labels}
              order={settings.gallery.categories.map((c) => c.key)}
              allLabel={tg("all")}
            />
          ) : (
            <div className="grid gap-8">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => (
                  <Photo key={i} alt="" className={i === 0 ? "aspect-[4/5] rounded-2xl" : "aspect-[4/3] rounded-2xl"} />
                ))}
              </div>
              <div className="grid max-w-prose gap-4">
                <p className="text-muted text-lg">{tg("empty")}</p>
                <Button asChild variant="outline" className="w-fit">
                  <Link href="/rooms">{t("rooms")}</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
