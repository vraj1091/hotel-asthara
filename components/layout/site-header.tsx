import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { HeaderCenter } from "@/components/layout/header-center";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Logo } from "@/components/layout/logo";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { bookingDefaults } from "@/lib/booking-defaults";
import type { SiteSettings } from "@/types/content";

export async function SiteHeader({ settings }: { settings: SiteSettings }) {
  const t = await getTranslations("nav");
  return (
    <header
      className="theme-dark border-line bg-bg sticky top-0 z-40 border-b print:hidden"
      style={{ ["--header-h" as string]: "4.5rem" }}
    >
      <a
        href="#content"
        className="focus:bg-accent focus:text-on-accent sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:px-4 focus:py-2"
      >
        {t("skip")}
      </a>
      <div className="container-page flex h-[var(--header-h)] items-center justify-between gap-6">
        <Logo name={settings.hotel.name} />
        <HeaderCenter
          defaults={bookingDefaults()}
          maxRooms={settings.booking.maxRoomsPerBooking}
          maxNights={settings.booking.maxNights}
        />
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <Button asChild className="header-book hidden sm:inline-flex">
            <Link href="/rooms">{t("bookNow")}</Link>
          </Button>
          <MobileMenu hotelName={settings.hotel.name} />
        </div>
      </div>
      <div className="scroll-progress" aria-hidden />
    </header>
  );
}
