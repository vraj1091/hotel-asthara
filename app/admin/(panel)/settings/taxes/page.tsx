import { TaxForm } from "@/components/admin/settings/settings-forms";
import { SettingsHeader } from "@/components/admin/settings/settings-tabs";
import { AdminCard } from "@/components/admin/ui";
import { financialYear } from "@/lib/booking-engine";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Taxes & invoices" };

export default async function TaxSettingsPage() {
  await requirePage("settings:manage");
  const { gst } = await getSettings();
  return (
    <>
      <SettingsHeader current="taxes" />
      <AdminCard title="GST and invoice numbers">
        <TaxForm
          v={{
            lowPercent: gst.lowPercent,
            highPercent: gst.highPercent,
            thresholdRupees: gst.thresholdPaise / 100,
            sacCode: gst.sacCode,
            invoicePrefix: gst.invoicePrefix,
          }}
          example={{ fy: financialYear() }}
        />
      </AdminCard>
    </>
  );
}
