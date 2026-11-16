/** Shapes of everything the admin can edit from Website editor / Settings. */

export type L = { en: string; hi: string };

export type HotelProfile = {
  name: string;
  tagline: L;
  addressLine: string;
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  mapsPlaceUrl: string; // optional "Open in Google Maps" link, falls back to coordinates
  checkInTime: string; // "12:00"
  checkOutTime: string; // "11:00"
  alwaysOpenFrontDesk: boolean;
  deskOpens: string; // used only when alwaysOpenFrontDesk is false, "08:00"
  deskCloses: string; // "23:00"
  currency: string; // display currency; payments and GST invoices are always INR
};

export type ContactInfo = {
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string; // handle without @
  facebook: string;
  googleBusinessUrl: string;
};

export type RatingInfo = {
  value: number | null; // never hard-coded; null hides the widget
  count: number | null;
  source: string; // e.g. "Google"
  sourceUrl: string;
};

export type GstSettings = {
  lowPercent: number; // tariff <= threshold
  highPercent: number; // tariff > threshold
  thresholdPaise: number;
  gstin: string;
  legalName: string;
  sacCode: string; // 996311 = room accommodation services
  invoicePrefix: string; // "AST"
};

export type NearbyPlace = {
  id: string;
  name: L;
  distance: L;
  note: L;
  icon: string;
};
export type Faq = { id: string; q: L; a: L };

export type PolicyDoc = { title: L; body: L }; // body: paragraphs separated by blank lines, "- " bullets
export type Policies = {
  idPolicy: L;
  cancellation: PolicyDoc;
  checkIn: PolicyDoc;
  terms: PolicyDoc;
  privacy: PolicyDoc;
};

export type SeoPage = { title: L; description: L };
export type SeoSettings = {
  titleTemplate: string;
  defaultTitle: L;
  defaultDescription: L;
  keywords: string[];
  ogImageUrl: string;
  pages: Record<string, SeoPage>;
};

export type BookingRules = {
  maxNights: number;
  maxRoomsPerBooking: number;
  advanceBookingDays: number;
  holdMinutes: number; // unpaid online bookings are released after this
  freeCancelHours: number; // guests can cancel online up to this many hours before check-in
};

export type PaymentSettings = {
  onlineEnabled: boolean; // Razorpay, only offered when keys are configured
  payAtHotelEnabled: boolean;
};

export type NotificationSettings = {
  hotelEmails: string[]; // new bookings and enquiries are sent here
  sendGuestConfirmation: boolean;
};

export type AboutContent = {
  title: L;
  intro: L;
  body: L; // paragraphs separated by blank lines
  imageUrl: string;
};

export type GalleryCategory = { key: string; label: L };

export type SiteSettings = {
  hotel: HotelProfile;
  contact: ContactInfo;
  rating: RatingInfo;
  gst: GstSettings;
  amenities: { enabled: string[] };
  nearby: NearbyPlace[];
  faqs: Faq[];
  policies: Policies;
  seo: SeoSettings;
  booking: BookingRules;
  payments: PaymentSettings;
  notifications: NotificationSettings;
  about: AboutContent;
  gallery: { categories: GalleryCategory[] };
};

export type SectionKey =
  | "HERO"
  | "ROOMS_GRID"
  | "AMENITIES"
  | "WHY_CHOOSE_US"
  | "OFFERS"
  | "GALLERY"
  | "TESTIMONIALS"
  | "LOCATION"
  | "INSTAGRAM_FEED"
  | "FAQ"
  | "CONTACT"
  | "CTA";

export type SectionContent = {
  HERO: { headline: L; subhead: L; imageUrl: string; videoUrl: string; posterUrl: string };
  ROOMS_GRID: { title: L; intro: L; limit: number };
  AMENITIES: { title: L; intro: L };
  WHY_CHOOSE_US: { title: L; intro: L; points: { id: string; icon: string; title: L; body: L }[] };
  OFFERS: { title: L; intro: L };
  GALLERY: { title: L; intro: L; limit: number };
  TESTIMONIALS: { title: L; intro: L };
  LOCATION: { title: L; intro: L };
  INSTAGRAM_FEED: {
    title: L;
    intro: L;
    posts: { id: string; imageUrl: string; link: string; alt: string }[];
  };
  FAQ: { title: L; intro: L; limit: number };
  CONTACT: { title: L; intro: L };
  CTA: { title: L; body: L };
};

export type SectionRow<K extends SectionKey = SectionKey> = {
  key: K;
  enabled: boolean;
  sortOrder: number;
  content: SectionContent[K];
};
