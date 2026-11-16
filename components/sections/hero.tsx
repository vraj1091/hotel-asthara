import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BedDouble, Clock, Phone, Star } from "lucide-react";
import { BookingBar } from "@/components/sections/booking-bar";
import { HeroArch } from "@/components/sections/hero-arch";
import { HeroClock } from "@/components/sections/hero-clock";
import { heroPhoto } from "@/features/media/photos";
import { Button } from "@/components/ui/button";
import { bookingDefaults } from "@/lib/booking-defaults";
import { tr } from "@/lib/settings";
import { clockIST, daypartIST, getTonight } from "@/lib/tonight";
import { formatINR, formatTime, telHref } from "@/lib/utils";
import type { SectionContent, SiteSettings } from "@/types/content";

/** Split a headline into two balanced lines so each can rise in turn. */
function twoLines(text: string): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export async function Hero({
  content,
  settings,
}: {
  content: SectionContent["HERO"];
  settings: SiteSettings;
}) {
  const [locale, t, tb, th, tonight] = await Promise.all([
    getLocale(),
    getTranslations("nav"),
    getTranslations("common"),
    getTranslations("hero"),
    getTonight(),
  ]);
  const headline = tr(content.headline, locale);
  const lines = twoLines(headline);
  const { hotel, contact, rating } = settings;
  const defaults = bookingDefaults();
  const hasVideo = !!content.videoUrl;
  const photo = hasVideo ? null : await heroPhoto(content.imageUrl);

  return (
    <section
      id="hero"
      className="theme-dark relative isolate flex min-h-[calc(100svh-4.5rem)] flex-col overflow-hidden"
    >
      {hasVideo ? (
        <>
          <video
            className="absolute inset-0 -z-20 size-full object-cover"
            src={content.videoUrl}
            poster={content.posterUrl || undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          />
          <div
            className="from-bg via-bg/80 to-bg/30 absolute inset-0 -z-10 bg-gradient-to-r"
            aria-hidden
          />
        </>
      ) : null}

      {/* Arch: faint and partly off-screen on phones, full on desktop */}
      <div className="pointer-events-none absolute -right-24 bottom-0 -z-10 w-[22rem] opacity-40 sm:-right-10 sm:w-[26rem] sm:opacity-60 lg:right-[6%] lg:w-[min(30rem,38vw)] lg:opacity-100">
        <HeroArch
          imageUrl={photo ?? undefined}
          alt={hotel.name}
          daypart={daypartIST()}
        />
      </div>

      <div className="container-page flex flex-1 flex-col justify-center pt-14 pb-10 lg:pt-20">
        <div className="max-w-2xl">
          <h1 className="text-display text-ink">
            {lines.map((line, i) => (
              <span key={line} className="line-mask">
                <span
                  className="line-rise"
                  style={{ ["--delay" as string]: `${0.15 + i * 0.14}s` }}
                >
                  {line}
                </span>
              </span>
            ))}
          </h1>
          <p className="text-muted mt-6 max-w-[52ch] text-lg lg:text-xl">
            {tr(content.subhead, locale)}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/rooms">{t("bookNow")}</Link>
            </Button>
            {contact.phone ? (
              <Button asChild size="lg" variant="outline">
                <a href={telHref(contact.phone)}>
                  <Phone aria-hidden />
                  {contact.phone}
                </a>
              </Button>
            ) : null}
          </div>
          <ul className="text-muted mt-9 flex flex-wrap gap-x-7 gap-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Clock className="text-accent size-4" aria-hidden />
              {tb("checkIn")} {formatTime(hotel.checkInTime)}, {tb("checkOut")}{" "}
              {formatTime(hotel.checkOutTime)}
            </li>
            <li>
              <HeroClock
                initial={clockIST()}
                alwaysOpen={hotel.alwaysOpenFrontDesk}
                opens={hotel.deskOpens}
                closes={hotel.deskCloses}
              />
            </li>
            {tonight ? (
              <li>
                <Link
                  href={
                    tonight.free > 0
                      ? `/rooms?checkIn=${tonight.date}&checkOut=${tonight.nextDate}&guests=2&rooms=1`
                      : "/rooms"
                  }
                  className="link-underline text-ink flex items-center gap-2"
                >
                  <BedDouble className="text-accent size-4" aria-hidden />
                  {tonight.free > 0 && tonight.minRatePaise
                    ? th("freeTonight", { price: formatINR(tonight.minRatePaise) })
                    : th("fullTonight")}
                </Link>
              </li>
            ) : null}
            {rating.value ? (
              <li className="flex items-center gap-1.5">
                <Star className="fill-accent text-accent size-4" aria-hidden />
                <span className="text-ink font-medium">{rating.value.toFixed(1)}</span>
                {rating.source ? <span>{rating.source}</span> : null}
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="container-page relative z-10 pb-8">
        <BookingBar
          defaults={defaults}
          maxRooms={settings.booking.maxRoomsPerBooking}
          maxNights={settings.booking.maxNights}
        />
      </div>
    </section>
  );
}
