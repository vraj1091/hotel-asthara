import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/ui/photo";
import { roomText, type RoomTypeView } from "@/features/rooms/queries";
import { roomPhotos } from "@/features/media/photos";
import { AMENITY_BY_KEY } from "@/lib/amenities";
import { cn, formatINR } from "@/lib/utils";

export type RoomCardStatus = { available: number; total: number };

/** `feature` = large photo with overlaid text (home bento); `row` = compact horizontal card; `grid` = listing card. */
export async function RoomCard({
  room,
  layout = "grid",
  query = "",
  status,
  ratePaise,
  rateIsAverage = false,
  note,
}: {
  room: RoomTypeView;
  layout?: "feature" | "row" | "grid";
  query?: string;
  status?: RoomCardStatus | null;
  ratePaise?: number;
  rateIsAverage?: boolean;
  note?: string;
}) {
  const [locale, t, tc] = await Promise.all([
    getLocale(),
    getTranslations("rooms"),
    getTranslations("common"),
  ]);
  const text = roomText(room, locale);
  const href = `/rooms/${room.slug}${query ? `?${query}` : ""}`;
  const rate = ratePaise ?? room.baseRatePaise;
  const soldOut = status ? status.available === 0 : false;
  const amenityKeys = room.amenities.filter((k) => AMENITY_BY_KEY[k]).slice(0, 4);
  const cover = (await roomPhotos(room))[0];

  const price = (
    <p className="font-sans">
      <span className="text-muted text-sm">{rateIsAverage ? "" : `${tc("from")} `}</span>
      <span className="text-ink text-xl font-semibold tabular-nums">{formatINR(rate)}</span>
      <span className="text-muted text-sm">
        {" "}
        {tc("perNight")}, {tc("plusTax")}
      </span>
    </p>
  );

  const stateBadge = status ? (
    soldOut ? (
      <Badge tone="dark">{t("soldOut")}</Badge>
    ) : status.available <= 3 ? (
      <Badge tone="gold">{t("left", { count: status.available })}</Badge>
    ) : null
  ) : null;

  const meta = (
    <ul className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <li>{t("size", { size: room.sizeSqFt })}</li>
      <li>{room.bedType}</li>
      <li>{t("sleeps", { adults: room.maxAdults, children: room.maxChildren })}</li>
    </ul>
  );

  const icons = (
    <ul className="flex gap-2" aria-label={t("amenities")}>
      {amenityKeys.map((k) => (
        <li
          key={k}
          title={AMENITY_BY_KEY[k]?.label}
          className="bg-surface-2 text-ink grid size-9 place-items-center rounded-full"
        >
          <AmenityIcon name={AMENITY_BY_KEY[k]?.icon ?? ""} className="size-4" />
        </li>
      ))}
    </ul>
  );

  if (layout === "feature") {
    return (
      <article className="group shadow-soft relative isolate flex min-h-[26rem] overflow-hidden rounded-[1.5rem] lg:h-full lg:min-h-[34rem]">
        <Photo
          src={cover?.url}
          alt={cover?.alt || text.name}
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="absolute inset-0 -z-10 transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <div className="theme-dark from-bg via-bg/85 mt-auto w-full bg-transparent bg-gradient-to-t to-transparent p-6 pt-24 md:p-8 md:pt-32">
          {stateBadge}
          <h3 className="text-h2 text-ink mt-2">
            <Link href={href} className="after:absolute after:inset-0">
              {text.name}
            </Link>
          </h3>
          <p className="text-muted mt-2 max-w-[50ch]">{text.summary}</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">{price}</div>
        </div>
      </article>
    );
  }

  if (layout === "row") {
    return (
      <article className="card group relative grid overflow-hidden sm:grid-cols-[11rem_1fr]">
        <Photo
          src={cover?.url}
          alt={cover?.alt || text.name}
          sizes="(min-width: 640px) 180px, 100vw"
          className="aspect-[16/10] sm:aspect-auto sm:h-full"
        />
        <div className="grid content-between gap-4 p-5">
          <div>
            {stateBadge}
            <h3 className="text-h3 mt-1">
              <Link href={href} className="after:absolute after:inset-0">
                {text.name}
              </Link>
            </h3>
            <div className="mt-1">{meta}</div>
          </div>
          {price}
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "card spot group relative flex flex-col overflow-hidden",
        soldOut && "opacity-80",
      )}
    >
      <Photo
        src={cover?.url}
        alt={cover?.alt || text.name}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="aspect-[4/3]"
        imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          {stateBadge}
          <h3 className="text-h3 mt-1">
            <Link href={href} className="after:absolute after:inset-0">
              {text.name}
            </Link>
          </h3>
          <p className="text-muted mt-2">{text.summary}</p>
        </div>
        {meta}
        {note ? (
          <p role="note" className="bg-warning/10 text-warning rounded-xl px-3 py-2 text-sm">
            {note}
          </p>
        ) : null}
        {icons}
        <hr className="hairline-solid" />
        <div className="mt-auto">{price}</div>
      </div>
    </article>
  );
}
