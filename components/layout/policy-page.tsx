import { getLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { PolicyBody } from "@/components/layout/policy-body";
import { pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";
import type { Policies, PolicyDoc } from "@/types/content";

type PolicyKey = Exclude<keyof Policies, "idPolicy">;

export async function PolicyPage({ doc, extra }: { doc: PolicyDoc; extra?: React.ReactNode }) {
  const locale = await getLocale();
  const title = tr(doc.title, locale);
  return (
    <>
      <PageHeader title={title} crumbs={[{ name: title }]} />
      <section className="section-y !pt-12">
        <div className="container-page grid gap-10">
          <PolicyBody body={tr(doc.body, locale)} />
          {extra}
        </div>
      </section>
    </>
  );
}

/** generateMetadata + page for a policy edited in Admin → Website → Policies. */
export function policyRoute(key: PolicyKey, path: string) {
  return {
    async generateMetadata() {
      const settings = await getSettings();
      const doc = settings.policies[key];
      return pageMetadata(settings, {
        title: doc.title,
        description: {
          en: `${doc.title.en} for ${settings.hotel.name}, ${settings.hotel.locality}, ${settings.hotel.city}.`,
          hi: `${doc.title.hi || doc.title.en} – ${settings.hotel.name}, ${settings.hotel.city}`,
        },
        path,
      });
    },
    async Page() {
      const settings = await getSettings();
      return <PolicyPage doc={settings.policies[key]} />;
    },
  };
}
