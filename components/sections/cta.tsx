import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { tr } from "@/lib/settings";
import type { SectionContent } from "@/types/content";

export async function Cta({ content }: { content: SectionContent["CTA"] }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("nav")]);
  return (
    <section id="book" className="section-y">
      <div className="container-page">
        <Reveal className="theme-dark relative isolate overflow-hidden rounded-[2rem] px-6 py-16 text-center md:px-16 md:py-24">
          <svg
            viewBox="0 0 400 560"
            fill="none"
            className="text-accent absolute -bottom-10 left-1/2 -z-10 h-[140%] -translate-x-1/2 opacity-25"
            aria-hidden
          >
            <path d="M16 560V202A184 184 0 0 1 384 202V560" stroke="currentColor" strokeWidth="1" />
            <path
              d="M42 560V202A158 158 0 0 1 358 202V560"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.6"
            />
          </svg>
          <h2 className="text-h1 mx-auto max-w-2xl">{tr(content.title, locale)}</h2>
          <p className="text-muted mx-auto mt-4 max-w-[46ch] text-lg">{tr(content.body, locale)}</p>
          <Button asChild size="lg" className="mt-9">
            <Link href="/rooms">{t("bookNow")}</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
