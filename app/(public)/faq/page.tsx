import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { FaqList } from "@/components/sections/faq-list";
import { pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";

export async function generateMetadata() {
  return pageMetadata(await getSettings(), { key: "faq", path: "/faq" });
}

export default async function FaqPage() {
  const [settings, t, locale] = await Promise.all([
    getSettings(),
    getTranslations("nav"),
    getLocale(),
  ]);
  return (
    <>
      <PageHeader
        title={tr(settings.seo.pages.faq?.title, locale) || t("faq")}
        intro={tr(settings.seo.pages.faq?.description, locale)}
        crumbs={[{ name: t("faq") }]}
      />
      <section className="section-y !pt-10">
        <div className="container-page max-w-3xl">
          <FaqList faqs={settings.faqs} />
        </div>
      </section>
    </>
  );
}
