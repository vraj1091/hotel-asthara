import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { MapEmbed } from "@/components/sections/map-embed";
import { NearbyList } from "@/components/sections/nearby-list";
import { pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";

export async function generateMetadata() {
  return pageMetadata(await getSettings(), { key: "nearby", path: "/nearby" });
}

export default async function NearbyPage() {
  const [settings, t, locale] = await Promise.all([
    getSettings(),
    getTranslations("nav"),
    getLocale(),
  ]);
  const { hotel, nearby } = settings;
  return (
    <>
      <PageHeader
        title={tr(settings.seo.pages.nearby?.title, locale) || t("nearby")}
        intro={`${hotel.addressLine}, ${hotel.locality}, ${hotel.city}, ${hotel.state} ${hotel.postalCode}`}
        crumbs={[{ name: t("nearby") }]}
      />
      <section className="section-y !pt-10">
        <div className="container-page grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
          <MapEmbed hotel={hotel} />
          <div>
            <h2 className="text-h3">Nearby</h2>
            <hr className="hairline-solid mt-4 mb-6 w-12" />
            <NearbyList places={nearby} />
          </div>
        </div>
      </section>
    </>
  );
}
