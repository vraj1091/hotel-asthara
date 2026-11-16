/** Role-based access control. Permissions are plain strings so they can live in the database and be edited
 *  from the "Staff & roles" permission matrix. This file is edge-safe (imported by middleware). */

export const PERMISSIONS = [
  { key: "dashboard:view", label: "View dashboard" },
  { key: "bookings:read", label: "View bookings" },
  { key: "bookings:write", label: "Create and edit bookings" },
  { key: "bookings:cancel", label: "Cancel bookings" },
  { key: "payments:write", label: "Record payments and refunds" },
  { key: "rooms:read", label: "View rooms and inventory" },
  { key: "rooms:write", label: "Edit rooms, rates and blocks" },
  { key: "guests:read", label: "View guests" },
  { key: "guests:write", label: "Edit guests" },
  { key: "guests:id", label: "Reveal guest ID numbers" },
  { key: "guests:export", label: "Export guest data" },
  { key: "enquiries:read", label: "View enquiries" },
  { key: "enquiries:write", label: "Reply to enquiries" },
  { key: "offers:write", label: "Manage offers and coupons" },
  { key: "content:write", label: "Edit gallery, reviews and website content" },
  { key: "staff:manage", label: "Manage staff and roles" },
  { key: "settings:manage", label: "Change hotel settings and payment keys" },
  { key: "audit:read", label: "View audit log" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key) as Permission[];

export type RoleKey = "SUPER_ADMIN" | "MANAGER" | "RECEPTIONIST";

export const DEFAULT_ROLES: Record<RoleKey, { name: string; permissions: Permission[] }> = {
  SUPER_ADMIN: { name: "Super Admin", permissions: ALL_PERMISSIONS },
  MANAGER: {
    name: "Manager",
    permissions: [
      "dashboard:view",
      "bookings:read",
      "bookings:write",
      "bookings:cancel",
      "payments:write",
      "rooms:read",
      "rooms:write",
      "guests:read",
      "guests:write",
      "guests:id",
      "guests:export",
      "enquiries:read",
      "enquiries:write",
      "offers:write",
      "content:write",
      "audit:read",
    ],
  },
  RECEPTIONIST: {
    name: "Front Desk",
    permissions: [
      "dashboard:view",
      "bookings:read",
      "bookings:write",
      "payments:write",
      "rooms:read",
      "guests:read",
      "guests:write",
      "guests:id",
      "enquiries:read",
      "enquiries:write",
    ],
  },
};

export function can(permissions: readonly string[] | undefined | null, permission: Permission) {
  return !!permissions?.includes(permission);
}

/** Which permission is needed to open each admin area. Longest matching prefix wins. */
export const ADMIN_ROUTE_PERMISSIONS: [prefix: string, permission: Permission][] = [
  ["/admin/bookings", "bookings:read"],
  ["/admin/rooms", "rooms:read"],
  ["/admin/guests", "guests:read"],
  ["/admin/enquiries", "enquiries:read"],
  ["/admin/offers", "offers:write"],
  ["/admin/website", "content:write"],
  ["/admin/media", "content:write"],
  ["/admin/staff", "staff:manage"],
  ["/admin/activity", "audit:read"],
  ["/admin/settings", "settings:manage"],
  ["/admin/account", "dashboard:view"],
  ["/admin", "dashboard:view"],
];

/** Display names for the built-in roles (the key stays stable in the database). */
export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  RECEPTIONIST: "Front Desk",
};

export function permissionForPath(pathname: string): Permission | null {
  const hit = ADMIN_ROUTE_PERMISSIONS.filter(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  ).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : null;
}
