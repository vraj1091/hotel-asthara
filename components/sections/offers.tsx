import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { getActiveOffers } from "@/features/cms/queries";
import { tr } from "@/lib/settings";
import { formatINR } from "@/lib/utils";
import type { SectionContent } from "@/types/content";

export type OfferView = Awaited<ReturnType<typeof getActiveOffers>>[number];

export function discountLabel(coupon: NonNullable<OfferView["coupon"]>) {
  return coupon.kind === "PERCENT" ? `${coupon.value}% off` : `${formatINR(coupon.value)} off`;
}

export async function OfferCard({ offer }: { offer: OfferView }) {
  const locale = await getLocale();
  const title = (locale === "hi" && offer.titleHi) || offer.title;
  const body = (locale === "hi" && offer.descriptionHi) || offer.description;
  return (
    <article className="card flex flex-col overflow-hidden">
      {offer.imageUrl ? (
        <Photo
          src={offer.imageUrl}
          alt={title}
          className="aspect-[16/9]"
          sizes="(min-width: 768px) 33vw, 100vw"
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-6">
        {offer.coupon ? (
          <Badge tone="gold" className="w-fit">
            <Tag className="size-3" aria-hidden />
            {discountLabel(offer.coupon)}
          </Badge>
        ) : null}
        <h3 className="text-h3">{title}</h3>
        <p className="text-muted">{body}</p>
        {offer.coupon ? (
          <p className="mt-auto pt-2 text-sm">
            Code{" "}
            <code className="bg-surface-3 rounded-md px-2 py-1 font-mono text-[0.95em] tracking-wider">
              {offer.coupon.code}
            </code>
          </p>
        ) : null}
      </div>
    </article>
  );
}

export async function Offers({ content }: { content: SectionContent["OFFERS"] }) {
  const [locale, t, offers] = await Promise.all([
    getLocale(),
    getTranslations("nav"),
    getActiveOffers(),
  ]);
  if (offers.length === 0) return null;
  return (
    <section id="offers" className="section-y">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading title={tr(content.title, locale)} intro={tr(content.intro, locale)} />
          <Button asChild variant="outline">
            <Link href="/offers">{t("offers")}</Link>
          </Button>
        </div>
        <Reveal className="mt-12 grid gap-5 md:grid-cols-3">
          {offers.slice(0, 3).map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
