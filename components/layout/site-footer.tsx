import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Logo } from "@/components/layout/logo";
import { formatTime, telHref } from "@/lib/utils";
import type { SiteSettings } from "@/types/content";

export async function SiteFooter({
  settings,
  tagline,
}: {
  settings: SiteSettings;
  tagline: string;
}) {
  const [t, tn, tc] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
    getTranslations("common"),
  ]);
  const { hotel, contact } = settings;
  const link = "link-underline w-fit py-0.5 text-muted transition-colors hover:text-ink";
  return (
    <footer className="theme-dark border-line border-t pb-[4.5rem] md:pb-0 print:hidden">
      <div className="container-page grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-5">
          <Logo name={hotel.name} />
          <p className="font-heading text-ink mt-5 max-w-sm text-xl">{tagline}</p>
          <address className="text-muted mt-4 flex max-w-sm gap-3 text-sm not-italic">
            <MapPin className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {hotel.addressLine}, {hotel.locality}, {hotel.city}, {hotel.state} {hotel.postalCode}
            </span>
          </address>
          <p className="text-muted mt-4 max-w-sm text-sm">{t("idNote")}</p>
        </div>

        <nav aria-label="Explore" className="grid content-start gap-2 text-[0.95rem] md:col-span-4 lg:col-span-2">
          <p className="font-heading mb-1 text-lg">{t("explore")}</p>
          <Link href="/rooms" className={link}>
            {tn("rooms")}
          </Link>
          <Link href="/gallery" className={link}>
            {tn("gallery")}
          </Link>
          <Link href="/about" className={link}>
            {tn("about")}
          </Link>
          <Link href="/nearby" className={link}>
            {tn("nearby")}
          </Link>
          <Link href="/offers" className={link}>
            {tn("offers")}
          </Link>
          <Link href="/faq" className={link}>
            {tn("faq")}
          </Link>
          <Link href="/contact" className={link}>
            {tn("contact")}
          </Link>
          <Link href="/booking/manage" className={link}>
            {tn("manageBooking")}
          </Link>
        </nav>

        <nav
          aria-label="Policies"
          className="grid content-start gap-2 text-[0.95rem] md:col-span-4 lg:col-span-2"
        >
          <p className="font-heading mb-1 text-lg">{t("policies")}</p>
          <Link href="/cancellation-policy" className={link}>
            {t("cancellation")}
          </Link>
          <Link href="/check-in-policy" className={link}>
            {t("checkInPolicy")}
          </Link>
          <Link href="/terms" className={link}>
            {t("terms")}
          </Link>
          <Link href="/privacy" className={link}>
            {t("privacy")}
          </Link>
        </nav>

        <div className="grid content-start gap-3 text-[0.95rem] md:col-span-4 lg:col-span-3">
          <p className="font-heading mb-1 text-lg">{t("visit")}</p>
          {contact.phone ? (
            <a href={telHref(contact.phone)} className={`${link} flex items-center gap-2.5`}>
              <Phone className="text-accent size-4" aria-hidden />
              {contact.phone}
            </a>
          ) : null}
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className={`${link} flex items-center gap-2.5`}>
              <Mail className="text-accent size-4" aria-hidden />
              {contact.email}
            </a>
          ) : null}
          {contact.instagram ? (
            <a
              href={`https://www.instagram.com/${contact.instagram}/`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${link} flex items-center gap-2.5`}
            >
              <Instagram className="text-accent size-4" aria-hidden />@{contact.instagram}
            </a>
          ) : null}
          <p className="text-muted flex items-center gap-2.5">
            <Clock className="text-accent size-4" aria-hidden />
            {tc("frontDesk")}:{" "}
            {hotel.alwaysOpenFrontDesk
              ? tc("open24")
              : `${formatTime(hotel.deskOpens)} – ${formatTime(hotel.deskCloses)}`}
          </p>
          <LanguageSwitcher className="mt-2 w-fit" />
        </div>
      </div>
      <div className="container-page">
        <hr className="hairline" />
        <p className="text-muted py-6 text-sm">
          © {new Date().getFullYear()} {hotel.name}, {hotel.city}. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
