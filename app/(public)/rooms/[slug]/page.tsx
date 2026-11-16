import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { PageHeader } from "@/components/layout/page-header";
import { RoomAvailability } from "@/components/sections/room-availability";
import { RoomGallery } from "@/components/sections/room-gallery";
import { getRoomTypeBySlug, roomText } from "@/features/rooms/queries";
import { roomPhotos } from "@/features/media/photos";
import { AMENITY_BY_KEY } from "@/lib/amenities";
import { bookingDefaults } from "@/lib/booking-defaults";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";
import { absoluteUrl, formatINR } from "@/lib/utils";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [room, settings] = await Promise.all([getRoomTypeBySlug(slug), getSettings()]);
  if (!room) return {};
  return pageMetadata(settings, {
    title: `${room.name} in Model Town, Rohtak`,
    description: `${room.summary} From ${formatINR(room.baseRatePaise)} per night plus GST. Book direct at ${settings.hotel.name}.`,
    path: `/rooms/${room.slug}`,
    image: (await roomPhotos(room))[0]?.url,
  });
}

export default async function RoomDetailPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [room, settings, locale, t, tc] = await Promise.all([
    getRoomTypeBySlug(slug),
    getSettings(),
    getLocale(),
    getTranslations("rooms"),
    getTranslations("common"),
  ]);
  if (!room) notFound();
  const text = roomText(room, locale);
  const photos = await roomPhotos(room);
  const amenities = room.amenities
    .map((k) => AMENITY_BY_KEY[k])
    .filter((a): a is NonNullable<typeof a> => !!a);

  const jsonLd = [
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Rooms", path: "/rooms" },
      { name: room.name, path: `/rooms/${room.slug}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "HotelRoom",
      name: room.name,
      description: room.description,
      url: absoluteUrl(`/rooms/${room.slug}`),
      image: photos.map((i) => absoluteUrl(i.url.split("?")[0]!)),
      bed: { "@type": "BedDetails", typeOfBed: room.bedType },
      occupancy: { "@type": "QuantitativeValue", maxValue: room.maxAdults + room.maxChildren },
      floorSize: { "@type": "QuantitativeValue", value: room.sizeSqFt, unitCode: "FTK" },
      containedInPlace: { "@id": absoluteUrl("/#hotel") },
    },
  ];

  return (
    <>
      <PageHeader
        title={text.name}
        intro={text.summary}
        crumbs={[{ name: "Rooms", href: "/rooms" }, { name: text.name }]}
      />
      <section className="section-y !pt-10">
        <div className="container-page grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
          <div className="grid content-start gap-10">
            <RoomGallery
              images={photos.map((i) => ({ id: i.id, url: i.url, alt: i.alt }))}
              name={text.name}
            />
            <div>
              <ul className="text-muted flex flex-wrap gap-x-6 gap-y-2">
                <li>{t("size", { size: room.sizeSqFt })}</li>
                <li>{room.bedType}</li>
                <li>{t("sleeps", { adults: room.maxAdults, children: room.maxChildren })}</li>
              </ul>
              <p className="mt-6 max-w-[62ch] text-lg leading-relaxed">{text.description}</p>
              {room.extraBedPaise ? (
                <p className="text-muted mt-3">
                  Extra bed {formatINR(room.extraBedPaise)} per night, on request.
                </p>
              ) : null}
            </div>
            <div>
              <h2 className="text-h3">{t("amenities")}</h2>
              <hr className="hairline-solid mt-4 w-12" />
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {amenities.map((a) => (
                  <li key={a.key} className="flex items-center gap-3">
                    <span className="theme-dark bg-bg text-accent grid size-10 shrink-0 place-items-center rounded-xl">
                      <AmenityIcon name={a.icon} className="size-5" />
                    </span>
                    {locale === "hi" ? a.labelHi : a.label}
                  </li>
                ))}
              </ul>
            </div>
            <p className="bg-surface-2 text-muted rounded-2xl p-5 text-sm">
              {tr(settings.policies.idPolicy, locale)}
            </p>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start" aria-label={tc("checkIn")}>
            <p className="mb-3 font-sans">
              <span className="text-muted text-sm">{tc("from")} </span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatINR(room.baseRatePaise)}
              </span>
              <span className="text-muted text-sm">
                {" "}
                {tc("perNight")}, {tc("plusTax")}
              </span>
            </p>
            <RoomAvailability
              slug={room.slug}
              defaults={bookingDefaults(query)}
              maxRooms={settings.booking.maxRoomsPerBooking}
              maxNights={settings.booking.maxNights}
            />
          </aside>
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
