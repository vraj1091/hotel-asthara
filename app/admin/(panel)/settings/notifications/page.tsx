import { NotificationsForm } from "@/components/admin/settings/settings-forms";
import { SettingsHeader } from "@/components/admin/settings/settings-tabs";
import { AdminCard } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { emailConfigured } from "@/lib/email";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const staff = await requirePage("settings:manage");
  const { notifications } = await getSettings();
  const ready = emailConfigured();
  return (
    <>
      <SettingsHeader current="notifications" />
      <AdminCard
        title="Email notifications"
        actions={ready ? <Badge tone="success">Email sending is on</Badge> : <Badge tone="warning">Email not set up</Badge>}
        description={
          ready
            ? `Sending from ${process.env.EMAIL_FROM || "the default Resend address"}.`
            : "Set RESEND_API_KEY and EMAIL_FROM in the environment to send emails. Until then every email is recorded in the Email log as skipped."
        }
      >
        <NotificationsForm v={notifications} emailReady={ready} myEmail={staff.email} />
      </AdminCard>
    </>
  );
}
