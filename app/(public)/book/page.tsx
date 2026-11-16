import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, MessageCircle, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { getRoomTypeBySlug, roomText } from "@/features/rooms/queries";
import { roomPhotos } from "@/features/media/photos";
import { getAvailability, quoteRoomType } from "@/lib/availability";
import { getRazorpayConfig } from "@/lib/razorpay";
import { getSettings, tr } from "@/lib/settings";
import { parseStay, stayQuery } from "@/lib/stay-search";
import { dayKey, formatDay, formatINR, formatTime, whatsappHref } from "@/lib/utils";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Complete your booking",
  robots: { index: false, follow: false },
};

type Params = Promise<{ room?: string; checkIn?: string; checkOut?: string; rooms?: string; guests?: string }>;

export default async function BookPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const [settings, locale, t, tb] = await Promise.all([
    getSettings(),
    getLocale(),
    getTranslations("checkout"),
    getTranslations("booking"),
  ]);
  const result = parseStay(params, settings.booking);
  const room = params.room && /^[a-z0-9-]+$/.test(params.room) ? await getRoomTypeBySlug(params.room) : null;
  if (!room) redirect("/rooms");
  if (!result.ok) redirect(`/rooms/${room.slug}`);
  const { stay } = result;

  const [availability, quote, photos, razorpay] = await Promise.all([
    getAvailability(stay.checkIn, stay.checkOut, { roomTypeId: room.id }),
    quoteRoomType({ roomTypeId: room.id, baseRatePaise: room.baseRatePaise, checkIn: stay.checkIn, checkOut: stay.checkOut, gst: settings.gst }),
    roomPhotos(room),
    getRazorpayConfig().catch(() => null),
  ]);
  const free = availability.get(room.id)?.available ?? 0;
  const text = roomText(room, locale);
  const fmt = locale === "hi" ? "hi-IN" : "en-IN";
  const backHref = `/rooms/${room.slug}?${stayQuery(stay)}`;
  const capacity = (room.maxAdults + room.maxChildren) * stay.rooms;
  const onlineOk = settings.payments.onlineEnabled && !!razorpay;
  const hotelOk = settings.payments.payAtHotelEnabled || !onlineOk;
  const cover = photos[0];

  return (
    <>
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        crumbs={[
          { name: t("crumbRooms"), href: "/rooms" },
          { name: text.name, href: backHref },
          { name: t("title") },
        ]}
      />
      <section className="section-y !pt-10">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
          <aside className="card grid content-start overflow-hidden lg:sticky lg:top-28 lg:self-start" aria-labelledby="stay-heading">
            <Photo src={cover?.url} alt={cover?.alt || text.name} className="aspect-[16/9]" sizes="(min-width: 1024px) 40vw, 100vw" />
            <div className="grid gap-4 p-6">
              <div>
                <p className="text-muted text-sm">{t("yourStay")}</p>
                <h2 id="stay-heading" className="text-h3">
                  {tb("roomCount", { count: stay.rooms })} × {text.name}
                </h2>
              </div>
              <ul className="text-muted grid gap-2 text-sm">
                <li className="flex items-center gap-2">
                  <CalendarDays className="text-accent size-4" aria-hidden />
                  {formatDay(stay.checkIn, fmt)} → {formatDay(stay.checkOut, fmt)}, {tb("nightCount", { count: stay.nights })}
                </li>
                <li className="flex items-center gap-2">
                  <UsersRound className="text-accent size-4" aria-hidden />
                  {tb("guestCount", { count: stay.guests })}
                </li>
              </ul>
              <p className="text-muted text-sm">
                {t("times", { checkIn: formatTime(settings.hotel.checkInTime), checkOut: formatTime(settings.hotel.checkOutTime) })}
              </p>
              <Link href={backHref} className="link-underline w-fit text-sm">
                {t("change")}
              </Link>
            </div>
          </aside>

          <div className="grid content-start gap-6">
            {free < stay.rooms ? (
              <div role="alert" className="card grid gap-4 p-8">
                <p className="text-lg">{free > 0 ? t("onlyLeft", { count: free }) : t("soldOut")}</p>
                <Button asChild className="w-fit">
                  <Link href={`/rooms?${stayQuery(stay)}`}>{t("otherRooms")}</Link>
                </Button>
              </div>
            ) : stay.guests > capacity ? (
              <div role="alert" className="card grid gap-4 p-8">
                <p className="text-lg">{t("tooMany", { capacity, rooms: stay.rooms })}</p>
                <Button asChild className="w-fit">
                  <Link href={`/book?${new URLSearchParams({ room: room.slug, checkIn: dayKey(stay.checkIn), checkOut: dayKey(stay.checkOut), guests: String(stay.guests), rooms: String(Math.min(settings.booking.maxRoomsPerBooking, stay.rooms + 1)) })}`}>
                    {t("addRoom")}
                  </Link>
                </Button>
              </div>
            ) : (
              <CheckoutForm
                stay={{
                  room: room.slug,
                  checkIn: dayKey(stay.checkIn),
                  checkOut: dayKey(stay.checkOut),
                  rooms: stay.rooms,
                  guests: stay.guests,
                }}
                roomName={text.name}
                hotelName={settings.hotel.name}
                nights={quote.nights.map((n) => ({ date: n.date, ratePaise: n.ratePaise, rule: n.rule }))}
                initial={{
                  nights: stay.nights,
                  rooms: stay.rooms,
                  available: free,
                  subtotalPaise: quote.subtotalPaise * stay.rooms,
                  discountPaise: 0,
                  taxPaise: quote.taxPaise * stay.rooms,
                  totalPaise: quote.totalPaise * stay.rooms,
                  coupon: null,
                  couponError: null,
                }}
                payment={{ online: onlineOk, hotel: hotelOk, holdMinutes: settings.booking.holdMinutes }}
                idPolicy={tr(settings.policies.idPolicy, locale)}
                freeCancelHours={settings.booking.freeCancelHours}
              />
            )}
            {settings.contact.whatsapp ? (
              <Button asChild variant="outline" size="lg" className="w-full sm:w-fit">
                <a
                  href={whatsappHref(
                    settings.contact.whatsapp,
                    t("whatsappText", { rooms: stay.rooms, room: room.name, guests: stay.guests, checkIn: formatDay(stay.checkIn), checkOut: formatDay(stay.checkOut) }),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle aria-hidden />
                  {t("whatsapp")}
                </a>
              </Button>
            ) : null}
            <p className="text-muted text-sm">
              {t("priceNote", { amount: formatINR(room.baseRatePaise) })}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
