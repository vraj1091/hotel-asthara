import { Amenities } from "@/components/sections/amenities";
import { ContactSection } from "@/components/sections/contact-section";
import { Cta } from "@/components/sections/cta";
import { Faq } from "@/components/sections/faq";
import { GalleryPreview } from "@/components/sections/gallery-preview";
import { Hero } from "@/components/sections/hero";
import { InstagramFeed } from "@/components/sections/instagram-feed";
import { Location } from "@/components/sections/location";
import { Offers } from "@/components/sections/offers";
import { RoomsGrid } from "@/components/sections/rooms-grid";
import { Testimonials } from "@/components/sections/testimonials";
import { WhyChooseUs } from "@/components/sections/why-choose-us";
import type { SectionContent, SectionKey, SectionRow, SiteSettings } from "@/types/content";

/** Renders one homepage section by key. The admin controls order and visibility through PageSection rows. */
export function renderSection(section: SectionRow, settings: SiteSettings) {
  const c = section.content as SectionContent[SectionKey];
  switch (section.key) {
    case "HERO":
      return <Hero key={section.key} content={c as SectionContent["HERO"]} settings={settings} />;
    case "ROOMS_GRID":
      return <RoomsGrid key={section.key} content={c as SectionContent["ROOMS_GRID"]} />;
    case "AMENITIES":
      return (
        <Amenities
          key={section.key}
          content={c as SectionContent["AMENITIES"]}
          settings={settings}
        />
      );
    case "WHY_CHOOSE_US":
      return <WhyChooseUs key={section.key} content={c as SectionContent["WHY_CHOOSE_US"]} />;
    case "OFFERS":
      return <Offers key={section.key} content={c as SectionContent["OFFERS"]} />;
    case "GALLERY":
      return <GalleryPreview key={section.key} content={c as SectionContent["GALLERY"]} />;
    case "TESTIMONIALS":
      return (
        <Testimonials
          key={section.key}
          content={c as SectionContent["TESTIMONIALS"]}
          settings={settings}
        />
      );
    case "LOCATION":
      return (
        <Location key={section.key} content={c as SectionContent["LOCATION"]} settings={settings} />
      );
    case "INSTAGRAM_FEED":
      return (
        <InstagramFeed
          key={section.key}
          content={c as SectionContent["INSTAGRAM_FEED"]}
          settings={settings}
        />
      );
    case "FAQ":
      return <Faq key={section.key} content={c as SectionContent["FAQ"]} settings={settings} />;
    case "CONTACT":
      return (
        <ContactSection
          key={section.key}
          content={c as SectionContent["CONTACT"]}
          settings={settings}
        />
      );
    case "CTA":
      return <Cta key={section.key} content={c as SectionContent["CTA"]} />;
    default:
      return null;
  }
}
