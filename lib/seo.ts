import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { tr } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import type { L, SiteSettings } from "@/types/content";

/** English lives at the plain URL, Hindi at ?lang=hi (middleware switches the language cookie). */
export function localizedUrl(path: string, locale: string) {
  const url = new URL(absoluteUrl(path));
  if (locale === "hi") url.searchParams.set("lang", "hi");
  return url.toString();
}

export async function pageMetadata(
  settings: SiteSettings,
  page: {
    key?: string;
    title?: string | L;
    description?: string | L;
    path: string;
    image?: string;
    noIndex?: boolean;
  },
): Promise<Metadata> {
  const locale = await getLocale();
  const preset = page.key ? settings.seo.pages[page.key] : undefined;
  const title =
    tr(page.title, locale) || tr(preset?.title, locale) || tr(settings.seo.defaultTitle, locale);
  const description =
    tr(page.description, locale) ||
    tr(preset?.description, locale) ||
    tr(settings.seo.defaultDescription, locale);
  const image = page.image || settings.seo.ogImageUrl || absoluteUrl("/opengraph-image");
  const url = localizedUrl(page.path, locale);
  return {
    title: page.path === "/" ? { absolute: tr(settings.seo.defaultTitle, locale) } : title,
    description,
    keywords: settings.seo.keywords,
    alternates: {
      canonical: url,
      languages: {
        "en-IN": localizedUrl(page.path, "en"),
        "hi-IN": localizedUrl(page.path, "hi"),
        "x-default": localizedUrl(page.path, "en"),
      },
    },
    robots: page.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      siteName: settings.hotel.name,
      locale: locale === "hi" ? "hi_IN" : "en_IN",
      alternateLocale: locale === "hi" ? ["en_IN"] : ["hi_IN"],
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: settings.hotel.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** schema.org Hotel (a LocalBusiness subtype). aggregateRating is emitted only when the admin has set a real rating. */
export function hotelJsonLd(
  settings: SiteSettings,
  rooms: { name: string; summary: string; slug: string }[] = [],
) {
  const { hotel, contact, rating, amenities } = settings;
  const sameAs = [
    contact.instagram && `https://www.instagram.com/${contact.instagram}/`,
    contact.facebook,
    contact.googleBusinessUrl,
  ].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": ["Hotel", "LocalBusiness"],
    "@id": absoluteUrl("/#hotel"),
    name: hotel.name,
    description: settings.seo.defaultDescription.en,
    url: absoluteUrl("/"),
    ...(contact.phone ? { telephone: contact.phone } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    image: settings.seo.ogImageUrl || absoluteUrl("/opengraph-image"),
    priceRange: "₹₹",
    address: {
      "@type": "PostalAddress",
      streetAddress: `${hotel.addressLine}, ${hotel.locality}`,
      addressLocality: hotel.city,
      addressRegion: hotel.state,
      postalCode: hotel.postalCode,
      addressCountry: hotel.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: hotel.latitude, longitude: hotel.longitude },
    checkinTime: hotel.checkInTime,
    checkoutTime: hotel.checkOutTime,
    openingHoursSpecification: hotel.alwaysOpenFrontDesk
      ? [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ],
            opens: "00:00",
            closes: "23:59",
          },
        ]
      : undefined,
    amenityFeature: amenities.enabled.map((key) => ({
      "@type": "LocationFeatureSpecification",
      name: key,
      value: true,
    })),
    ...(sameAs.length ? { sameAs } : {}),
    ...(rating.value && rating.count
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.value,
            reviewCount: rating.count,
            bestRating: 5,
          },
        }
      : {}),
    ...(rooms.length
      ? {
          makesOffer: rooms.map((r) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "HotelRoom",
              name: r.name,
              description: r.summary,
              url: absoluteUrl(`/rooms/${r.slug}`),
            },
          })),
        }
      : {}),
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

export function breadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}
