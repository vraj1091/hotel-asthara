import { getLocale } from "next-intl/server";
import { MobileActionBar } from "@/components/layout/mobile-action-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { getRoomTypes } from "@/features/rooms/queries";
import { hotelJsonLd } from "@/lib/seo";
import { getSettings, tr } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [settings, locale, rooms] = await Promise.all([
    getSettings(),
    getLocale(),
    getRoomTypes().catch(() => []),
  ]);
  const jsonLd = hotelJsonLd(
    settings,
    rooms.map((r) => ({ name: r.name, summary: r.summary, slug: r.slug })),
  );
  return (
    <>
      <SiteHeader settings={settings} />
      <main id="content" className="min-h-[60vh] outline-none" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter settings={settings} tagline={tr(settings.hotel.tagline, locale)} />
      <MobileActionBar settings={settings} />
      <WhatsAppFloat number={settings.contact.whatsapp} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
