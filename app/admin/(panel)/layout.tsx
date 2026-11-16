import type { Metadata } from "next";
import { signOut } from "@/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_NAV } from "@/components/admin/nav";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requirePage();
  const nav = ADMIN_NAV.filter((n) => can(staff.permissions, n.permission));
  const [settings, enquiries, pending] = await Promise.all([
    getSettings(),
    can(staff.permissions, "enquiries:read")
      ? db.enquiry.count({ where: { status: "NEW", deletedAt: null } })
      : 0,
    can(staff.permissions, "bookings:read")
      ? db.booking.count({
          where: {
            status: "PENDING",
            deletedAt: null,
            OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
          },
        })
      : 0,
  ]);

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <AdminShell
      hotelName={settings.hotel.name}
      staff={{ name: staff.name, roleName: staff.roleName }}
      nav={nav}
      badges={{ enquiries, pending }}
      signOut={doSignOut}
    >
      {children}
    </AdminShell>
  );
}
