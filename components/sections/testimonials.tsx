import { getLocale } from "next-intl/server";
import { Star } from "lucide-react";
import { RatingWidget } from "@/components/sections/rating-widget";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getApprovedTestimonials } from "@/features/cms/queries";
import { tr } from "@/lib/settings";
import type { SectionContent, SiteSettings } from "@/types/content";

export async function Testimonials({
  content,
  settings,
}: {
  content: SectionContent["TESTIMONIALS"];
  settings: SiteSettings;
}) {
  const [locale, items] = await Promise.all([getLocale(), getApprovedTestimonials()]);
  if (items.length === 0 && !settings.rating.value) return null;
  return (
    <section id="reviews" className="section-y bg-surface-2">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
          <RatingWidget rating={settings.rating} />
        </div>
        {items.length ? (
          <Reveal className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.slice(0, 6).map((r) => (
              <figure key={r.id} className="card flex flex-col gap-4 p-6">
                <div className="flex gap-0.5" role="img" aria-label={`${r.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={
                        i < r.rating ? "fill-accent text-accent size-4" : "text-line-strong size-4"
                      }
                      aria-hidden
                    />
                  ))}
                </div>
                <blockquote className="text-lg leading-relaxed">{r.body}</blockquote>
                <figcaption className="text-muted mt-auto text-sm">
                  <span className="text-ink font-medium">{r.name}</span>
                  {r.location ? `, ${r.location}` : ""}
                  {r.source ? ` on ${r.source}` : ""}
                </figcaption>
              </figure>
            ))}
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}
