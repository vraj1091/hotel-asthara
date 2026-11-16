import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MobileActionBar } from "@/components/layout/mobile-action-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { getSettings, tr } from "@/lib/settings";
import { getLocale } from "next-intl/server";

export default async function NotFound() {
  const [settings, t, locale] = await Promise.all([
    getSettings(),
    getTranslations("notFound"),
    getLocale(),
  ]);
  const tc = await getTranslations("common");
  return (
    <>
      <SiteHeader settings={settings} />
      <main id="content" className="grid min-h-[60vh] place-items-center px-5 py-24 text-center">
        <div className="max-w-lg">
          <svg
            viewBox="0 0 120 150"
            className="text-accent mx-auto h-28 w-auto"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 148V62C12 30 33 8 60 8s48 22 48 54v86"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M28 148V64c0-24 14-42 32-42s32 18 32 42v84"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity="0.5"
            />
          </svg>
          <h1 className="text-h1 mt-8">{t("title")}</h1>
          <p className="text-muted mt-4 text-lg">{t("body")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/">{tc("backHome")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/rooms">{t("rooms")}</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter settings={settings} tagline={tr(settings.hotel.tagline, locale)} />
      <MobileActionBar settings={settings} />
    </>
  );
}
