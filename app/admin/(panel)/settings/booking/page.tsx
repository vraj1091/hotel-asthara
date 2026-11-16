import { BookingRulesForm } from "@/components/admin/settings/settings-forms";
import { SettingsHeader } from "@/components/admin/settings/settings-tabs";
import { AdminCard } from "@/components/admin/ui";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Booking rules" };

export default async function BookingRulesPage() {
  await requirePage("settings:manage");
  const { booking } = await getSettings();
  return (
    <>
      <SettingsHeader current="booking" />
      <AdminCard title="Online booking rules" description="These limits apply to bookings made on the website. The front desk can override them for walk-ins.">
        <BookingRulesForm v={booking} />
      </AdminCard>
    </>
  );
}
