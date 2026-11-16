import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { BookingBar } from "@/components/sections/booking-bar";
import { RoomCard, type RoomCardStatus } from "@/components/sections/room-card";
import { SpotlightGroup } from "@/components/ui/spotlight-group";
import { getRoomTypes } from "@/features/rooms/queries";
import { getAvailability, loadPriceRules } from "@/lib/availability";
import { bookingDefaults } from "@/lib/booking-defaults";
import { quoteStay } from "@/lib/pricing";
import { pageMetadata } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";
import { parseStay, stayQuery } from "@/lib/stay-search";
import { formatDay, pluralize } from "@/lib/utils";

export async function generateMetadata() {
  return pageMetadata(await getSettings(), { key: "rooms", path: "/rooms" });
}

type SearchParams = Promise<{
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  rooms?: string;
}>;

export default async function RoomsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [settings, rooms, t, tb, locale] = await Promise.all([
    getSettings(),
    getRoomTypes(),
    getTranslations("rooms"),
    getTranslations("booking"),
    getLocale(),
  ]);
  const searched = !!(params.checkIn || params.checkOut);
  const result = searched ? parseStay(params, settings.booking) : null;
  const stay = result?.ok ? result.stay : null;

  let statusById = new Map<string, RoomCardStatus>();
  let rateById = new Map<string, number>();
  if (stay) {
    const [availability, rules] = await Promise.all([
      getAvailability(stay.checkIn, stay.checkOut),
      loadPriceRules(),
    ]);
    statusById = new Map(
      [...availability].map(([id, a]) => [id, { available: a.available, total: a.total }]),
    );
    rateById = new Map(
      rooms.map((r) => [
        r.id,
        quoteStay({
          roomTypeId: r.id,
          baseRatePaise: r.baseRatePaise,
          rules,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          gst: settings.gst,
        }).averageRatePaise,
      ]),
    );
  }

  // Rooms that are free for the dates come first; sold-out rooms stay visible so guests understand why.
  const sorted = stay
    ? [...rooms].sort(
        (a, b) =>
          Number((statusById.get(b.id)?.available ?? 0) > 0) -
          Number((statusById.get(a.id)?.available ?? 0) > 0),
      )
    : rooms;
  const anyAvailable = sorted.some(
    (r) => (statusById.get(r.id)?.available ?? 0) >= (stay?.rooms ?? 1),
  );
  const query = stay ? stayQuery(stay) : "";

  return (
    <>
      <PageHeader
        title={tr(settings.seo.pages.rooms?.title, locale) || "Rooms"}
        intro={
          stay
            ? `${tb("summary", { checkIn: formatDay(stay.checkIn, locale === "hi" ? "hi-IN" : "en-IN"), checkOut: formatDay(stay.checkOut, locale === "hi" ? "hi-IN" : "en-IN") })}, ${tb("nightCount", { count: stay.nights })}`
            : t("pickDates")
        }
        crumbs={[{ name: "Rooms" }]}
      />
      <section className="section-y !pt-10">
        <div className="container-page grid gap-10">
          <BookingBar
            variant="page"
            defaults={bookingDefaults(params)}
            maxRooms={settings.booking.maxRoomsPerBooking}
            maxNights={settings.booking.maxNights}
          />
          {result && !result.ok ? (
            <p
              role="alert"
              className="border-danger/40 bg-danger/10 text-danger rounded-xl border px-4 py-3"
            >
              {result.error}
            </p>
          ) : null}
          {stay && !anyAvailable && rooms.length > 0 ? (
            <p role="status" className="border-line bg-surface-2 rounded-xl border px-4 py-3">
              {t("empty")}
              {stay.rooms > 1 ? ` (${pluralize(stay.rooms, "room")})` : ""}
            </p>
          ) : null}
          {rooms.length === 0 ? (
            <p className="text-muted">{t("noRooms")}</p>
          ) : (
            <SpotlightGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sorted.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  query={query}
                  status={
                    stay
                      ? (statusById.get(room.id) ?? { available: 0, total: room._count.rooms })
                      : null
                  }
                  ratePaise={rateById.get(room.id)}
                  rateIsAverage={!!stay}
                  note={
                    stay && stay.guests > (room.maxAdults + room.maxChildren) * stay.rooms
                      ? t("fitsUpTo", {
                          count: (room.maxAdults + room.maxChildren) * stay.rooms,
                          rooms: stay.rooms,
                          guests: stay.guests,
                        })
                      : undefined
                  }
                />
              ))}
            </SpotlightGroup>
          )}
        </div>
      </section>
    </>
  );
}
