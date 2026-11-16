import { getLocale } from "next-intl/server";
import { MapEmbed } from "@/components/sections/map-embed";
import { NearbyList } from "@/components/sections/nearby-list";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { tr } from "@/lib/settings";
import type { SectionContent, SiteSettings } from "@/types/content";

export async function Location({
  content,
  settings,
}: {
  content: SectionContent["LOCATION"];
  settings: SiteSettings;
}) {
  const locale = await getLocale();
  const { hotel, nearby } = settings;
  return (
    <section id="location" className="section-y">
      <div className="container-page">
        <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
        <Reveal className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          <MapEmbed hotel={hotel} />
          <div className="grid content-start gap-5">
            <address className="text-muted not-italic">
              {hotel.addressLine}, {hotel.locality}, {hotel.city}, {hotel.state} {hotel.postalCode}
            </address>
            <NearbyList places={nearby} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
