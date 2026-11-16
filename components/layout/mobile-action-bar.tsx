import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MessageCircle, Phone } from "lucide-react";
import { telHref, whatsappHref } from "@/lib/utils";
import type { SiteSettings } from "@/types/content";

/** Sticky bottom bar on phones: Call, WhatsApp, Book now. Buttons only appear for contact details the hotel has set. */
export async function MobileActionBar({ settings }: { settings: SiteSettings }) {
  const [t, tc] = await Promise.all([getTranslations("nav"), getTranslations("contact")]);
  const { phone, whatsapp } = settings.contact;
  const item =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-ink transition-colors active:bg-surface-3";
  return (
    <div className="theme-dark border-line bg-bg/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden print:hidden">
      <div className="flex items-stretch">
        {phone ? (
          <a href={telHref(phone)} className={item}>
            <Phone className="size-5" aria-hidden />
            {t("call")}
          </a>
        ) : null}
        {whatsapp ? (
          <a
            href={whatsappHref(whatsapp, tc("whatsappPrompt"))}
            target="_blank"
            rel="noopener noreferrer"
            className={item}
          >
            <MessageCircle className="size-5" aria-hidden />
            {t("whatsapp")}
          </a>
        ) : null}
        <Link
          href="/rooms"
          className="bg-accent text-on-accent m-2 flex min-h-12 flex-[1.6] items-center justify-center rounded-full px-4 text-base font-medium"
        >
          {t("bookNow")}
        </Link>
      </div>
    </div>
  );
}
