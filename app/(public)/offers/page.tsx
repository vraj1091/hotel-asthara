import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { OfferCard } from "@/components/sections/offers";
import { getActiveOffers } from "@/features/cms/queries";
import { pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";

export async function generateMetadata() {
  return pageMetadata(await getSettings(), { key: "offers", path: "/offers" });
}

export default async function OffersPage() {
  const [settings, offers, t, locale] = await Promise.all([
    getSettings(),
    getActiveOffers(),
    getTranslations("nav"),
    getLocale(),
  ]);
  return (
    <>
      <PageHeader
        title={t("offers")}
        intro={tr(settings.seo.pages.offers?.description, locale)}
        crumbs={[{ name: t("offers") }]}
      />
      <section className="section-y !pt-10">
        <div className="container-page">
          {offers.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          ) : (
            <p className="text-muted max-w-prose text-lg">
              There are no offers running right now. Our direct rates are shown on the rooms page,
              and the front desk can tell you about longer-stay rates.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
