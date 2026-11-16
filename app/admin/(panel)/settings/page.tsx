import { HotelForm } from "@/components/admin/settings/settings-forms";
import { SettingsHeader } from "@/components/admin/settings/settings-tabs";
import { AdminCard } from "@/components/admin/ui";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function HotelSettingsPage() {
  await requirePage("settings:manage");
  const s = await getSettings();
  return (
    <>
      <SettingsHeader current="hotel" />
      <AdminCard
        title="Hotel details"
        description="Address, map, contact details and check-in times are edited in Website editor → Location and Contact."
      >
        <HotelForm
          v={{
            name: s.hotel.name,
            legalName: s.gst.legalName,
            gstin: s.gst.gstin,
            tagline: s.hotel.tagline,
            currency: s.hotel.currency || "INR",
          }}
        />
      </AdminCard>
    </>
  );
}
