import { getLocale } from "next-intl/server";
import { ContactDetails } from "@/components/sections/contact-details";
import { ContactForm } from "@/components/sections/contact-form";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { tr } from "@/lib/settings";
import type { SectionContent, SiteSettings } from "@/types/content";

export async function ContactSection({
  content,
  settings,
}: {
  content: SectionContent["CONTACT"];
  settings: SiteSettings;
}) {
  const locale = await getLocale();
  return (
    <section id="contact" className="section-y">
      <div className="container-page">
        <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
        <Reveal className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <ContactDetails settings={settings} />
          <ContactForm />
        </Reveal>
      </div>
    </section>
  );
}
