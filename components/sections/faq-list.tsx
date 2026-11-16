import { getLocale } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqJsonLd } from "@/lib/seo";
import { tr } from "@/lib/settings";
import type { Faq } from "@/types/content";

export async function FaqList({ faqs, withJsonLd = true }: { faqs: Faq[]; withJsonLd?: boolean }) {
  const locale = await getLocale();
  const items = faqs.map((f) => ({ id: f.id, q: tr(f.q, locale), a: tr(f.a, locale) }));
  return (
    <>
      <Accordion type="single" collapsible className="border-line border-t">
        {items.map((f) => (
          <AccordionItem key={f.id} value={f.id}>
            <AccordionTrigger>{f.q}</AccordionTrigger>
            <AccordionContent>{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      {withJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd(items)).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
    </>
  );
}
