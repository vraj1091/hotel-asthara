import { AdminPageHeader, LinkTabs } from "@/components/admin/ui";

const TABS = [
  { key: "hotel", label: "Hotel", href: "/admin/settings" },
  { key: "taxes", label: "Taxes & invoices", href: "/admin/settings/taxes" },
  { key: "booking", label: "Booking rules", href: "/admin/settings/booking" },
  { key: "payments", label: "Payments", href: "/admin/settings/payments" },
  { key: "notifications", label: "Notifications", href: "/admin/settings/notifications" },
  { key: "email-log", label: "Email log", href: "/admin/settings/email-log" },
] as const;

export type SettingsTab = (typeof TABS)[number]["key"];

export function SettingsHeader({ current }: { current: SettingsTab }) {
  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Hotel details, taxes, booking rules, payments and notifications. Website text and photos are in the Website editor."
      />
      <LinkTabs tabs={[...TABS]} current={current} />
    </>
  );
}
