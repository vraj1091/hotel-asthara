import { getTranslations } from "next-intl/server";
import { Clock, Instagram, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime, telHref, whatsappHref } from "@/lib/utils";
import type { SiteSettings } from "@/types/content";

export async function ContactDetails({ settings }: { settings: SiteSettings }) {
  const [t, tn, tc] = await Promise.all([
    getTranslations("common"),
    getTranslations("nav"),
    getTranslations("contact"),
  ]);
  const { hotel, contact } = settings;
  const row = "flex items-start gap-3";
  const icon = "mt-1 size-5 shrink-0 text-accent";
  return (
    <div className="grid content-start gap-6">
      <ul className="grid gap-4">
        <li className={row}>
          <MapPin className={icon} aria-hidden />
          <address className="not-italic">
            {hotel.addressLine}, {hotel.locality}, {hotel.city}, {hotel.state} {hotel.postalCode}
          </address>
        </li>
        <li className={row}>
          <Clock className={icon} aria-hidden />
          <span>
            {t("frontDesk")}:{" "}
            {hotel.alwaysOpenFrontDesk
              ? t("open24")
              : `${formatTime(hotel.deskOpens)} – ${formatTime(hotel.deskCloses)}`}
          </span>
        </li>
        {contact.phone ? (
          <li className={row}>
            <Phone className={icon} aria-hidden />
            <a href={telHref(contact.phone)} className="link-underline">
              {contact.phone}
            </a>
          </li>
        ) : null}
        {contact.email ? (
          <li className={row}>
            <Mail className={icon} aria-hidden />
            <a href={`mailto:${contact.email}`} className="link-underline break-all">
              {contact.email}
            </a>
          </li>
        ) : null}
        {contact.instagram ? (
          <li className={row}>
            <Instagram className={icon} aria-hidden />
            <a
              href={`https://www.instagram.com/${contact.instagram}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
            >
              @{contact.instagram}
            </a>
          </li>
        ) : null}
      </ul>
      <div className="flex flex-wrap gap-3">
        {contact.phone ? (
          <Button asChild size="lg">
            <a href={telHref(contact.phone)}>
              <Phone aria-hidden />
              {t("callFrontDesk")}
            </a>
          </Button>
        ) : null}
        {contact.whatsapp ? (
          <Button asChild size="lg" variant="outline">
            <a
              href={whatsappHref(contact.whatsapp, tc("whatsappPrompt"))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden />
              {tn("whatsapp")}
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
