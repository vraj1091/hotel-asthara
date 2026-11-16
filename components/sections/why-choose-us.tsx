import { getLocale } from "next-intl/server";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { tr } from "@/lib/settings";
import type { SectionContent } from "@/types/content";

export async function WhyChooseUs({ content }: { content: SectionContent["WHY_CHOOSE_US"] }) {
  const locale = await getLocale();
  return (
    <section id="why" className="theme-dark section-y">
      <div className="container-page">
        <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
        <Reveal className="md:divide-accent/40 mt-14 grid gap-12 md:grid-cols-3 md:gap-0 md:divide-x">
          {content.points.map((p) => (
            <div key={p.id} className="md:px-10 md:first:pl-0 md:last:pr-0">
              <AmenityIcon name={p.icon} className="text-accent size-9" />
              <h3 className="text-h3 mt-6">{tr(p.title, locale)}</h3>
              <p className="text-muted mt-3 max-w-[38ch]">{tr(p.body, locale)}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
