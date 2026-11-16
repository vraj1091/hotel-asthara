import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FaqList } from "@/components/sections/faq-list";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { tr } from "@/lib/settings";
import type { SectionContent, SiteSettings } from "@/types/content";

export async function Faq({
  content,
  settings,
}: {
  content: SectionContent["FAQ"];
  settings: SiteSettings;
}) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("nav")]);
  if (settings.faqs.length === 0) return null;
  return (
    <section id="faq" className="section-y bg-surface-2">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionHeading
            title={tr(content.title, locale)}
            intro={tr(content.intro, locale) || undefined}
          />
          <Button asChild variant="outline" className="mt-8">
            <Link href="/faq">{t("faq")}</Link>
          </Button>
        </div>
        <FaqList faqs={settings.faqs.slice(0, Math.max(1, content.limit))} />
      </div>
    </section>
  );
}
