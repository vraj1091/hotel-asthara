import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { inter, notoSansDeva, notoSerifDeva, playfair } from "@/app/fonts";
import { Toaster } from "@/components/ui/toaster";
import { BRAND } from "@/lib/brand";
import { getSettings, tr } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, locale] = await Promise.all([getSettings(), getLocale()]);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: tr(settings.seo.defaultTitle, locale), template: settings.seo.titleTemplate },
    description: tr(settings.seo.defaultDescription, locale),
    applicationName: settings.hotel.name,
    formatDetection: { telephone: true, address: true, email: true },
  };
}

export const viewport: Viewport = {
  themeColor: BRAND.navy,
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html
      lang={locale}
      className={`${playfair.variable} ${inter.variable} ${notoSansDeva.variable} ${notoSerifDeva.variable}`}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
