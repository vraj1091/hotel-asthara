import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ContactDetails } from "@/components/sections/contact-details";
import { ContactForm } from "@/components/sections/contact-form";
import { MapEmbed } from "@/components/sections/map-embed";
import { pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";

export async function generateMetadata() {
  return pageMetadata(await getSettings(), { key: "contact", path: "/contact" });
}

export default async function ContactPage() {
  const [settings, t, locale] = await Promise.all([
    getSettings(),
    getTranslations("nav"),
    getLocale(),
  ]);
  return (
    <>
      <PageHeader
        title={t("contact")}
        intro={tr(settings.seo.pages.contact?.description, locale)}
        crumbs={[{ name: t("contact") }]}
      />
      <section className="section-y !pt-12">
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="grid content-start gap-10">
            <ContactDetails settings={settings} />
            <MapEmbed hotel={settings.hotel} />
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
