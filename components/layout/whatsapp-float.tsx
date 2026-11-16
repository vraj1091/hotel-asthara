import { getTranslations } from "next-intl/server";
import { whatsappHref } from "@/lib/utils";

/** Floating WhatsApp chat button for tablets and desktops (phones get it in the bottom action bar). Hidden until a
 *  WhatsApp number is set in Admin → Website → Contact. */
export async function WhatsAppFloat({ number }: { number: string }) {
  if (!number) return null;
  const [t, tc] = await Promise.all([getTranslations("nav"), getTranslations("contact")]);
  return (
    <a
      href={whatsappHref(number, tc("whatsappPrompt"))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsappChat")}
      className="theme-dark bg-bg text-ink shadow-lift hover:bg-surface-3 fixed right-5 bottom-5 z-30 hidden items-center gap-2.5 rounded-full border border-[color-mix(in_oklab,var(--color-accent)_55%,transparent)] py-2.5 pr-5 pl-3 text-sm font-medium transition-colors md:flex print:hidden"
    >
      <svg viewBox="0 0 32 32" className="text-accent size-7" aria-hidden fill="currentColor">
        <path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.8 2 6.8L3 29l6.6-1.9c1.9 1 4.1 1.6 6.4 1.6 7.2 0 13-5.7 13-12.8S23.2 3 16 3Zm0 23.4c-2.1 0-4.1-.6-5.8-1.7l-.4-.2-3.9 1.1 1.1-3.8-.3-.4a10.4 10.4 0 0 1-1.7-5.6C5 10 9.9 5.3 16 5.3S27 10 27 15.8s-4.9 10.6-11 10.6Zm6-7.9c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2l-1 1.3c-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.7-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6.4-.6v-.6l-1.1-2.5c-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.7 5.8 5.1 2.9 1.1 3.4.9 4 .8.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.3-.6-.4Z" />
      </svg>
      {t("whatsappChat")}
    </a>
  );
}
