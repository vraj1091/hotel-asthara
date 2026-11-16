import { ActionForm, Checkbox, FormField, SubmitButton } from "@/components/admin/forms";
import { AdminCard } from "@/components/admin/ui";
import { WebsiteHeader } from "@/components/admin/website/website-header";
import { Input } from "@/components/ui/input";
import { saveContact } from "@/features/cms/admin-actions";
import { loadSetting } from "@/features/cms/admin-shared";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Contact & hours | Website editor" };

export default async function ContactEditorPage() {
  await requirePage("content:write");
  const [contact, hotel] = await Promise.all([loadSetting("contact"), loadSetting("hotel")]);
  return (
    <>
      <WebsiteHeader
        current="contact"
        viewHref="/contact"
        description="Phone, WhatsApp, email and social links, plus front-desk and check-in times. Buttons for empty fields are hidden on the site."
      />
      <ActionForm action={saveContact} className="grid gap-6 xl:grid-cols-2">
        <AdminCard title="Contact details">
          <div className="grid gap-5">
            <FormField name="phone" label="Phone (click to call)" optional hint="With STD code, e.g. 0124-6201611.">
              <Input type="tel" inputMode="tel" maxLength={20} defaultValue={contact.phone} autoComplete="off" />
            </FormField>
            <FormField
              name="whatsapp"
              label="WhatsApp number"
              optional
              hint="A 10-digit mobile number that has WhatsApp. Landlines cannot receive WhatsApp."
            >
              <Input type="tel" inputMode="tel" maxLength={16} defaultValue={contact.whatsapp} autoComplete="off" />
            </FormField>
            <FormField name="email" label="Email" optional hint="Shown on the site; also gets booking and enquiry alerts unless other addresses are set in Settings.">
              <Input type="email" maxLength={254} defaultValue={contact.email} autoComplete="off" />
            </FormField>
            <FormField name="instagram" label="Instagram handle" optional>
              <Input maxLength={60} placeholder="hotelasthara_rohtak" defaultValue={contact.instagram} />
            </FormField>
            <FormField name="facebook" label="Facebook page" optional>
              <Input type="url" maxLength={500} placeholder="https://www.facebook.com/…" defaultValue={contact.facebook} />
            </FormField>
            <FormField name="googleBusinessUrl" label="Google Business profile" optional hint="Used in search-engine data and the review link.">
              <Input type="url" maxLength={500} placeholder="https://g.page/…" defaultValue={contact.googleBusinessUrl} />
            </FormField>
          </div>
        </AdminCard>
        <div className="grid content-start gap-6">
          <AdminCard title="Check-in and check-out">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField name="checkInTime" label="Check-in from">
                <Input type="time" required defaultValue={hotel.checkInTime} />
              </FormField>
              <FormField name="checkOutTime" label="Check-out by">
                <Input type="time" required defaultValue={hotel.checkOutTime} />
              </FormField>
            </div>
            <p className="text-muted mt-4 text-sm">
              Also mentioned in the FAQs and the check-in policy. Update those texts if you change the times.
            </p>
          </AdminCard>
          <AdminCard title="Front desk hours" description="Drives “Front desk open now” on the homepage.">
            <div className="grid gap-5">
              <Checkbox name="alwaysOpenFrontDesk" label="Open 24 hours" defaultChecked={hotel.alwaysOpenFrontDesk} />
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField name="deskOpens" label="Opens" hint="Used when not open 24 hours.">
                  <Input type="time" required defaultValue={hotel.deskOpens} />
                </FormField>
                <FormField name="deskCloses" label="Closes">
                  <Input type="time" required defaultValue={hotel.deskCloses} />
                </FormField>
              </div>
            </div>
          </AdminCard>
        </div>
        <div className="xl:col-span-2">
          <SubmitButton>Save contact details and hours</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
