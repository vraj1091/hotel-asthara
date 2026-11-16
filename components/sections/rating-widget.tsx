import { getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import type { RatingInfo } from "@/types/content";

/** Shows the rating the admin entered. Renders nothing until a real value exists. */
export async function RatingWidget({ rating }: { rating: RatingInfo }) {
  if (!rating.value) return null;
  const t = await getTranslations("reviews");
  const inner = (
    <div className="border-line inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-full border px-5 py-2.5">
      <span className="flex items-center gap-1.5">
        <Star className="fill-accent text-accent size-5" aria-hidden />
        <span className="font-heading text-2xl leading-none">{rating.value.toFixed(1)}</span>
        <span className="sr-only">{t("ratingLabel", { rating: rating.value.toFixed(1) })}</span>
      </span>
      <span className="text-muted text-sm">
        {rating.count ? t("basedOn", { count: rating.count }) : null}
        {rating.source ? ` ${t("viaSource", { source: rating.source })}` : null}
      </span>
    </div>
  );
  return rating.sourceUrl ? (
    <a href={rating.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
      {inner}
    </a>
  ) : (
    inner
  );
}
