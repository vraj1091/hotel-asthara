import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { PolicyBody } from "@/components/layout/policy-body";
import { Button } from "@/components/ui/button";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { Photo } from "@/components/ui/photo";
import { namedPhoto } from "@/features/media/photos";
import { AMENITY_CATALOG } from "@/lib/amenities";
import { pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";
import { formatTime } from "@/lib/utils";

export async function generateMetadata() {
  const settings = await getSettings();
  return pageMetadata(settings, { key: "about", path: "/about", image: settings.about.imageUrl || undefined });
}

export default async function AboutPage() {
  const [settings, t, ta, locale] = await Promise.all([
    getSettings(),
    getTranslations("nav"),
    getTranslations("about"),
    getLocale(),
  ]);
  const { hotel, about } = settings;
  const [photo, exterior, reception] = await Promise.all([
    namedPhoto("about", about.imageUrl),
    namedPhoto("exterior"),
    namedPhoto("reception"),
  ]);
  const amenities = AMENITY_CATALOG.filter((a) => settings.amenities.enabled.includes(a.key));
  const deskText = hotel.alwaysOpenFrontDesk
    ? ta("desk24")
    : ta("deskHours", { opens: formatTime(hotel.deskOpens), closes: formatTime(hotel.deskCloses) });

  return (
    <>
      <PageHeader title={tr(about.title, locale)} intro={tr(about.intro, locale)} crumbs={[{ name: t("about") }]} />
      <section className="section-y !pt-12">
        <div className="container-page grid gap-14 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <div className="grid content-start gap-8">
            <PolicyBody body={tr(about.body, locale)} />
            <ul className="text-muted grid gap-1 text-[0.95rem]">
              <li>
                {ta("times", { checkIn: formatTime(hotel.checkInTime), checkOut: formatTime(hotel.checkOutTime) })}
              </li>
              <li>{deskText}</li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/rooms">{t("bookNow")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/nearby">{t("nearby")}</Link>
              </Button>
            </div>
          </div>
          <div className="grid content-start gap-8">
            <Photo
              src={photo}
              alt={tr(about.title, locale)}
              className="aspect-[4/5] rounded-t-full rounded-b-2xl"
              sizes="(min-width: 1024px) 35vw, 100vw"
            />
            <div>
              <h2 className="text-h3">{ta("included")}</h2>
              <hr className="hairline-solid mt-4 w-12" />
              <ul className="mt-6 grid gap-4">
                {amenities.map((a) => (
                  <li key={a.key} className="flex items-center gap-3">
                    <span className="theme-dark bg-bg text-accent grid size-10 shrink-0 place-items-center rounded-xl">
                      <AmenityIcon name={a.icon} className="size-5" />
                    </span>
                    {locale === "hi" ? a.labelHi : a.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        {exterior || reception ? (
          <div className="container-page mt-14 grid gap-4 sm:grid-cols-2">
            {exterior ? <Photo src={exterior} alt={`${hotel.name} – ${ta("exterior")}`} className="aspect-[4/3] rounded-2xl" sizes="(min-width: 640px) 50vw, 100vw" /> : null}
            {reception ? <Photo src={reception} alt={`${hotel.name} – ${ta("reception")}`} className="aspect-[4/3] rounded-2xl" sizes="(min-width: 640px) 50vw, 100vw" /> : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
