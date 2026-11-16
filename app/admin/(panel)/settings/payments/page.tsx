import { PaymentsForm } from "@/components/admin/settings/settings-forms";
import { SettingsHeader } from "@/components/admin/settings/settings-tabs";
import { AdminCard } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { SECRETS_KEY, type StoredSecrets } from "@/lib/razorpay";
import { requirePage } from "@/lib/session";
import { getRawSetting, getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";

export const metadata = { title: "Payments" };

/** Where each Razorpay value comes from. Secret values themselves never leave the server. */
function source(admin: boolean, env: boolean) {
  return admin ? "admin" : env ? "environment" : "missing";
}

export default async function PaymentSettingsPage() {
  await requirePage("settings:manage");
  const [settings, stored] = await Promise.all([getSettings(), getRawSetting<StoredSecrets>(SECRETS_KEY)]);
  const s = stored ?? {};
  const keyId = source(!!s.razorpayKeyId, !!process.env.RAZORPAY_KEY_ID);
  const keySecret = source(!!s.razorpayKeySecretEnc, !!process.env.RAZORPAY_KEY_SECRET);
  const webhook = source(!!s.razorpayWebhookSecretEnc, !!process.env.RAZORPAY_WEBHOOK_SECRET);
  const ready = keyId !== "missing" && keySecret !== "missing";
  const activeKeyId = s.razorpayKeyId || process.env.RAZORPAY_KEY_ID || "";
  const mode = activeKeyId.startsWith("rzp_live_") ? "Live" : activeKeyId.startsWith("rzp_test_") ? "Test" : null;
  const label = { admin: "set here", environment: "from environment variables", missing: "not set" } as const;

  return (
    <>
      <SettingsHeader current="payments" />
      <AdminCard
        title="Payments"
        actions={
          ready ? (
            <Badge tone="success">Razorpay ready{mode ? ` · ${mode} mode` : ""}</Badge>
          ) : (
            <Badge tone="warning">Online payment unavailable</Badge>
          )
        }
        description={
          <>
            Key id {label[keyId]}, key secret {label[keySecret]}, webhook secret {label[webhook]}.
            {ready ? "" : " Until both keys are set, guests can only choose Pay at hotel."} Values entered here override
            the environment.
          </>
        }
      >
        <PaymentsForm
          v={{
            onlineEnabled: settings.payments.onlineEnabled,
            payAtHotelEnabled: settings.payments.payAtHotelEnabled,
            keyId: s.razorpayKeyId ?? "",
            keySecretSet: !!s.razorpayKeySecretEnc,
            webhookSecretSet: !!s.razorpayWebhookSecretEnc,
            webhookUrl: absoluteUrl("/api/payments/razorpay/webhook"),
          }}
        />
      </AdminCard>
    </>
  );
}
