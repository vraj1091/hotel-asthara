/** Amenity catalogue. `core` amenities are what the hotel states it offers today and are on by default.
 *  Extras are off until the owner switches them on in Admin → Website → Amenities, so the site never
 *  claims something the hotel does not have. */
export type AmenityDef = {
  key: string;
  label: string;
  labelHi: string;
  icon: string; // lucide-react icon name, resolved in components/ui/amenity-icon.tsx
  core: boolean;
  blurb?: string;
  blurbHi?: string;
};

export const AMENITY_CATALOG: AmenityDef[] = [
  {
    key: "ac",
    label: "Air conditioning",
    labelHi: "एयर कंडीशनिंग",
    icon: "Snowflake",
    core: true,
    blurb: "Individually controlled in every room.",
    blurbHi: "हर कमरे में अलग से नियंत्रित।",
  },
  {
    key: "wifi",
    label: "Free WiFi",
    labelHi: "मुफ़्त वाई-फ़ाई",
    icon: "Wifi",
    core: true,
    blurb: "Complimentary for all guests.",
    blurbHi: "सभी मेहमानों के लिए निःशुल्क।",
  },
  { key: "tv", label: "LED TV", labelHi: "एलईडी टीवी", icon: "Tv", core: true },
  {
    key: "room-service",
    label: "Room service",
    labelHi: "रूम सर्विस",
    icon: "ConciergeBell",
    core: true,
  },
  {
    key: "bathroom",
    label: "Private bathroom with toiletries",
    labelHi: "प्राइवेट बाथरूम व टॉयलेटरीज़",
    icon: "ShowerHead",
    core: true,
  },
  { key: "wardrobe", label: "Wardrobe", labelHi: "अलमारी", icon: "DoorClosed", core: true },
  { key: "desk", label: "Work desk", labelHi: "वर्क डेस्क", icon: "LampDesk", core: true },
  { key: "family-rooms", label: "Family rooms", labelHi: "फ़ैमिली रूम", icon: "Users", core: true },
  {
    key: "couple-friendly",
    label: "Couple friendly",
    labelHi: "कपल फ्रेंडली",
    icon: "Heart",
    core: true,
  },
  // Extras – off by default
  {
    key: "front-desk",
    label: "24-hour front desk",
    labelHi: "24 घंटे फ्रंट डेस्क",
    icon: "Clock",
    core: true,
  },
  { key: "parking", label: "Parking", labelHi: "पार्किंग", icon: "CarFront", core: false },
  { key: "power-backup", label: "Power backup", labelHi: "पावर बैकअप", icon: "Zap", core: false },
  {
    key: "cctv",
    label: "CCTV in common areas",
    labelHi: "सीसीटीवी",
    icon: "ShieldCheck",
    core: false,
  },
  { key: "lift", label: "Lift", labelHi: "लिफ़्ट", icon: "ArrowUpDown", core: false },
  { key: "breakfast", label: "Breakfast", labelHi: "नाश्ता", icon: "Coffee", core: false },
  { key: "laundry", label: "Laundry", labelHi: "लॉन्ड्री", icon: "Shirt", core: false },
  {
    key: "hot-water",
    label: "24-hour hot water",
    labelHi: "24 घंटे गर्म पानी",
    icon: "Droplets",
    core: false,
  },
];

export const AMENITY_BY_KEY = Object.fromEntries(AMENITY_CATALOG.map((a) => [a.key, a]));
export const DEFAULT_ENABLED_AMENITIES = AMENITY_CATALOG.filter((a) => a.core).map((a) => a.key);

/** Amenities that can be attached to an individual room type. */
export const ROOM_AMENITY_KEYS = AMENITY_CATALOG.filter(
  (a) => !["family-rooms", "couple-friendly", "front-desk"].includes(a.key),
).map((a) => a.key);
