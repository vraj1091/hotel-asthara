import type { Permission } from "@/lib/permissions";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string; // resolved in admin-shell.tsx
  permission: Permission;
  badge?: "enquiries" | "pending";
  group: "Front desk" | "Property" | "Website" | "Admin";
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", permission: "dashboard:view", group: "Front desk" },
  { href: "/admin/bookings", label: "Bookings", icon: "bookings", permission: "bookings:read", badge: "pending", group: "Front desk" },
  { href: "/admin/bookings/calendar", label: "Calendar", icon: "calendar", permission: "bookings:read", group: "Front desk" },
  { href: "/admin/guests", label: "Guests", icon: "guests", permission: "guests:read", group: "Front desk" },
  { href: "/admin/enquiries", label: "Enquiries", icon: "enquiries", permission: "enquiries:read", badge: "enquiries", group: "Front desk" },
  { href: "/admin/rooms", label: "Rooms & rates", icon: "rooms", permission: "rooms:read", group: "Property" },
  { href: "/admin/offers", label: "Offers & promo codes", icon: "offers", permission: "offers:write", group: "Property" },
  { href: "/admin/website", label: "Website editor", icon: "website", permission: "content:write", group: "Website" },
  { href: "/admin/media", label: "Media library", icon: "media", permission: "content:write", group: "Website" },
  { href: "/admin/staff", label: "Staff & roles", icon: "staff", permission: "staff:manage", group: "Admin" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "settings:manage", group: "Admin" },
  { href: "/admin/activity", label: "Activity log", icon: "activity", permission: "audit:read", group: "Admin" },
];
