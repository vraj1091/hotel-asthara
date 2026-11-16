/** Constants shared by the Website editor's server actions and its client components. */

/** Icons supported by components/ui/amenity-icon.tsx. */
export const ICON_NAMES = [
  "MapPin", "Heart", "Clock", "Phone", "BedDouble", "Users", "ShieldCheck", "Sparkles", "Wifi", "Snowflake",
  "Tv", "ConciergeBell", "ShowerHead", "DoorClosed", "LampDesk", "CarFront", "Zap", "ArrowUpDown", "Coffee",
  "Shirt", "Droplets", "GraduationCap", "Store", "TrainFront", "Route",
] as const;

export const SEO_PAGE_KEYS = ["rooms", "gallery", "about", "nearby", "contact", "offers", "faq"] as const;

export const SEO_PAGE_INFO: Record<(typeof SEO_PAGE_KEYS)[number], { label: string; path: string }> = {
  rooms: { label: "Rooms", path: "/rooms" },
  gallery: { label: "Gallery", path: "/gallery" },
  about: { label: "About", path: "/about" },
  nearby: { label: "Location", path: "/nearby" },
  contact: { label: "Contact", path: "/contact" },
  offers: { label: "Offers", path: "/offers" },
  faq: { label: "FAQ", path: "/faq" },
};

export const POLICY_INFO = {
  cancellation: { label: "Cancellation policy", path: "/cancellation-policy" },
  checkIn: { label: "Check-in policy", path: "/check-in-policy" },
  terms: { label: "Terms of use", path: "/terms" },
  privacy: { label: "Privacy policy", path: "/privacy" },
} as const;
