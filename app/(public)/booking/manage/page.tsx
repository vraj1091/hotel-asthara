import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/settings";
import { pageMetadata } from "@/lib/seo";
import { telHref } from "@/lib/utils";
import { LookupForm } from "./lookup-form";

export async function generateMetadata() {
  return pageMetadata(await getSettings(), {
    title: { en: "Manage your booking", hi: "अपनी बुकिंग प्रबंधित करें" },
    description: {
      en: "View, pay for or cancel your Hotel Asthara booking with your booking reference.",
      hi: "अपने बुकिंग रेफ़रेंस से होटल अस्थारा की बुकिंग देखें, भुगतान करें या रद्द करें।",
    },
    path: "/booking/manage",
  });
}

export default async function ManageBookingPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ ref }, t, settings] = await Promise.all([searchParams, getTranslations("manage"), getSettings()]);
  const reference = ref && /^[A-Za-z0-9-]{6,20}$/.test(ref) ? ref.toUpperCase() : "";
  return (
    <>
      <PageHeader title={t("lookupTitle")} intro={t("lookupIntro")} crumbs={[{ name: t("crumb") }]} />
      <section className="section-y !pt-10">
        <div className="container-page grid max-w-2xl gap-6">
          <LookupForm defaultReference={reference} />
          {settings.contact.phone ? (
            <p className="text-muted">
              {t("lookupHelp")}{" "}
              <a href={telHref(settings.contact.phone)} className="link-underline text-ink">
                {settings.contact.phone}
              </a>
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
