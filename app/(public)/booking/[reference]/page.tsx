import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, MapPin, MessageCircle, Phone, Printer, UsersRound, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { directionsUrl } from "@/components/sections/map-embed";
import { Button } from "@/components/ui/button";
import { canGuestCancel, paidPaise, releaseExpiredHolds } from "@/lib/booking-engine";
import { db } from "@/lib/db";
import { hasBookingAccess } from "@/lib/guest-access";
import { getRazorpayConfig } from "@/lib/razorpay";
import { getSettings, tr } from "@/lib/settings";
import { cn, formatDay, formatINR, formatTime, telHref, whatsappHref } from "@/lib/utils";
import { BookingActions } from "./booking-actions";
import { CopyReference } from "./copy-reference";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ new?: string; paid?: string; payment?: string }>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const [{ reference: rawRef }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(rawRef).toUpperCase();
  if (!/^AST-\d{6}-[A-Z0-9]{4,6}$/.test(reference)) notFound();
  if (!(await hasBookingAccess(reference))) redirect(`/booking/manage?ref=${encodeURIComponent(reference)}`);

  await releaseExpiredHolds();
  const [booking, settings, locale, t, tb] = await Promise.all([
    db.booking.findUnique({
      where: { reference },
      include: { guest: true, rooms: { include: { roomType: true } }, payments: { orderBy: { createdAt: "asc" } } },
    }),
    getSettings(),
    getLocale(),
    getTranslations("manage"),
    getTranslations("booking"),
  ]);
  if (!booking || booking.deletedAt) notFound();
  const razorpay = await getRazorpayConfig().catch(() => null);

  const fmt = locale === "hi" ? "hi-IN" : "en-IN";
  const paid = paidPaise(booking.payments);
  const balance = Math.max(0, booking.totalPaise - paid);
  const active = booking.status === "PENDING" || booking.status === "CONFIRMED";
  const holdLive = booking.status === "PENDING" && !!booking.holdExpiresAt && booking.holdExpiresAt > new Date();
  const canPayOnline = settings.payments.onlineEnabled && !!razorpay && balance > 0 && (holdLive || booking.status === "CONFIRMED");
  const canSwitch = holdLive && settings.payments.payAtHotelEnabled;
  const canCancel = canGuestCancel(booking, settings.booking.freeCancelHours, settings.hotel.checkInTime);
  const roomTypes = new Map<string, { name: string; count: number }>();
  for (const r of booking.rooms) {
    const name = (locale === "hi" && r.roomType.nameHi) || r.roomType.name;
    const e = roomTypes.get(r.roomTypeId) ?? { name, count: 0 };
    e.count += 1;
    roomTypes.set(r.roomTypeId, e);
  }
  const { hotel, contact } = settings;

  const banner = (() => {
    if (booking.status === "CANCELLED")
      return { tone: "danger", icon: XCircle, title: t("cancelledTitle"), body: booking.cancelReason ? t("cancelledBody", { reason: booking.cancelReason }) : undefined };
    if (booking.status === "NO_SHOW") return { tone: "danger", icon: XCircle, title: t("noShowTitle"), body: undefined };
    if (booking.status === "PENDING")
      return {
        tone: "warning",
        icon: AlertTriangle,
        title: t("pendingTitle"),
        body:
          query.payment === "cancelled" ? t("paymentClosed") : query.payment === "failed" ? t("paymentFailed") : query.payment === "unavailable" ? t("paymentUnavailable") : t("pendingBody"),
      };
    if (booking.status === "CHECKED_OUT") return { tone: "neutral", icon: CheckCircle2, title: t("checkedOutTitle"), body: t("checkedOutBody", { hotel: hotel.name }) };
    if (booking.status === "CHECKED_IN") return { tone: "success", icon: CheckCircle2, title: t("checkedInTitle"), body: undefined };
    return {
      tone: "success",
      icon: CheckCircle2,
      title: query.paid ? t("paidTitle") : t("confirmedTitle"),
      body: booking.guest.email ? t("emailSent", { email: booking.guest.email }) : t("noEmail"),
    };
  })();
  const BannerIcon = banner.icon;

  return (
    <>
      <PageHeader title={t("title")} crumbs={[{ name: t("crumb") }]} />
      <section className="section-y !pt-10">
        <div className="container-page grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
          <div className="grid content-start gap-6">
            <div
              role="status"
              className={cn(
                "card flex gap-4 p-6",
                banner.tone === "success" && "border-success/40 bg-success/10",
                banner.tone === "warning" && "border-warning/40 bg-warning/10",
                banner.tone === "danger" && "border-danger/40 bg-danger/10",
              )}
            >
              <BannerIcon
                className={cn(
                  "mt-0.5 size-7 shrink-0",
                  banner.tone === "success" && "text-success",
                  banner.tone === "warning" && "text-warning",
                  banner.tone === "danger" && "text-danger",
                  banner.tone === "neutral" && "text-accent",
                )}
                aria-hidden
              />
              <div className="grid gap-1">
                <h2 className="text-h3">{banner.title}</h2>
                {banner.body ? <p className="text-muted">{banner.body}</p> : null}
              </div>
            </div>

            <div className="card grid gap-5 p-6 md:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-muted text-sm">{t("reference")}</p>
                  <p className="font-mono text-2xl font-semibold tracking-wider md:text-3xl">{booking.reference}</p>
                </div>
                <CopyReference reference={booking.reference} />
              </div>
              <hr className="hairline-solid" />
              <ul className="grid gap-3">
                <li className="flex items-start gap-3">
                  <CalendarDays className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
                  <span>
                    {formatDay(booking.checkIn, fmt, { year: "numeric" })} → {formatDay(booking.checkOut, fmt, { year: "numeric" })}
                    <span className="text-muted block text-sm">
                      {tb("nightCount", { count: booking.nights })} · {t("times", { checkIn: formatTime(hotel.checkInTime), checkOut: formatTime(hotel.checkOutTime) })}
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <UsersRound className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
                  <span>
                    {[...roomTypes.values()].map((r) => `${tb("roomCount", { count: r.count })} × ${r.name}`).join(", ")}
                    <span className="text-muted block text-sm">
                      {tb("guestCount", { count: booking.adults + booking.children })} · {booking.guest.name}, {booking.guest.phone}
                    </span>
                  </span>
                </li>
              </ul>
              {booking.specialRequests ? (
                <p className="bg-surface-2 rounded-xl p-4 text-sm">
                  <span className="text-muted">{t("yourNote")}: </span>
                  {booking.specialRequests}
                </p>
              ) : null}
            </div>

            <div className="card grid gap-3 p-6 md:p-8">
              <h2 className="text-h3">{t("payment")}</h2>
              <dl className="grid gap-2 [&>div]:flex [&>div]:justify-between [&>div]:gap-6 [&_dd]:tabular-nums [&_dt]:text-muted">
                <div>
                  <dt>{t("roomCharges")}</dt>
                  <dd>{formatINR(booking.subtotalPaise, true)}</dd>
                </div>
                {booking.discountPaise ? (
                  <div>
                    <dt>
                      {t("discount")}
                      {booking.couponCode ? ` (${booking.couponCode})` : ""}
                    </dt>
                    <dd>− {formatINR(booking.discountPaise, true)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t("gst")}</dt>
                  <dd>{formatINR(booking.taxPaise, true)}</dd>
                </div>
                <div className="border-line border-t pt-2 text-lg">
                  <dt className="!text-ink font-medium">{t("total")}</dt>
                  <dd className="font-semibold">{formatINR(booking.totalPaise, true)}</dd>
                </div>
                <div>
                  <dt>{t("paid")}</dt>
                  <dd>{formatINR(paid, true)}</dd>
                </div>
                {active || booking.status === "CHECKED_IN" ? (
                  <div>
                    <dt>{t("balance")}</dt>
                    <dd className="font-medium">{formatINR(balance, true)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-muted text-sm">
                {booking.paymentMethod === "PAY_AT_HOTEL" && balance > 0 && active ? t("payAtHotelNote") : null}
              </p>
            </div>

            <BookingActions
              reference={booking.reference}
              hotelName={hotel.name}
              description={[...roomTypes.values()].map((r) => `${r.count} × ${r.name}`).join(", ")}
              holdExpiresAt={holdLive ? booking.holdExpiresAt!.toISOString() : null}
              canPayOnline={canPayOnline}
              balanceLabel={formatINR(balance, true)}
              canSwitch={canSwitch}
              canCancel={canCancel}
              freeCancelHours={settings.booking.freeCancelHours}
            />
            {booking.status === "CONFIRMED" || booking.status === "CHECKED_IN" || booking.status === "CHECKED_OUT" ? (
              <Button asChild variant="outline" className="w-fit">
                <Link href={`/booking/${booking.reference}/receipt`}>
                  <Printer aria-hidden />
                  {t("receipt")}
                </Link>
              </Button>
            ) : null}
          </div>

          <aside className="grid content-start gap-6 lg:sticky lg:top-28 lg:self-start">
            <div className="card theme-dark grid gap-4 p-6">
              <h2 className="text-h3">{hotel.name}</h2>
              <p className="text-muted flex gap-3 text-sm">
                <MapPin className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
                {hotel.addressLine}, {hotel.locality}, {hotel.city} {hotel.postalCode}
              </p>
              <p className="text-muted flex gap-3 text-sm">
                <Clock className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
                {t("times", { checkIn: formatTime(hotel.checkInTime), checkOut: formatTime(hotel.checkOutTime) })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={directionsUrl(hotel)} target="_blank" rel="noopener noreferrer">
                    <MapPin aria-hidden /> {t("directions")}
                  </a>
                </Button>
                {contact.phone ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={telHref(contact.phone)}>
                      <Phone aria-hidden /> {t("call")}
                    </a>
                  </Button>
                ) : null}
                {contact.whatsapp ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={whatsappHref(contact.whatsapp, t("whatsappText", { reference: booking.reference }))} target="_blank" rel="noopener noreferrer">
                      <MessageCircle aria-hidden /> WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="bg-surface-2 text-muted rounded-2xl p-5 text-sm">{tr(settings.policies.idPolicy, locale)}</div>
            <p className="text-muted text-sm">
              {t.rich("policyLinks", {
                cancellation: (c) => (
                  <Link href="/cancellation-policy" className="link-underline text-ink">
                    {c}
                  </Link>
                ),
                checkin: (c) => (
                  <Link href="/check-in-policy" className="link-underline text-ink">
                    {c}
                  </Link>
                ),
              })}
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
