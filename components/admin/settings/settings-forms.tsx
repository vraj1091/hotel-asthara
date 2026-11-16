"use client";

import { useState } from "react";
import { Check, Copy, PlugZap, Send } from "lucide-react";
import { toast } from "sonner";
import {
  ActionButton,
  ActionForm,
  BilingualField,
  Checkbox,
  FormField,
  SubmitButton,
  useFormErrors,
} from "@/components/admin/forms";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  saveBookingRules,
  saveHotelSettings,
  saveNotificationSettings,
  savePaymentSettings,
  saveTaxSettings,
  sendTestEmail,
  testRazorpayConnection,
} from "@/features/settings/actions";
import type { L } from "@/types/content";

const grid = "grid gap-5 md:grid-cols-2";

/* ───────── Hotel ───────── */

export function HotelForm({ v }: { v: { name: string; legalName: string; gstin: string; tagline: L; currency: string } }) {
  return (
    <ActionForm action={saveHotelSettings} successMessage="Hotel details saved." className="grid gap-6">
      <div className={grid}>
        <FormField name="name" label="Hotel name" hint="Shown in the header, emails, invoices and search results.">
          <Input defaultValue={v.name} required minLength={2} maxLength={80} />
        </FormField>
        <FormField name="legalName" label="Legal business name" hint="Printed on GST invoices.">
          <Input defaultValue={v.legalName} required minLength={2} maxLength={150} />
        </FormField>
        <FormField name="gstin" label="GSTIN" optional hint="15 characters, e.g. 06ABCDE1234F1Z5. Printed on invoices.">
          <Input defaultValue={v.gstin} maxLength={15} autoCapitalize="characters" pattern="[0-9A-Za-z]{15}" title="15 letters and numbers" />
        </FormField>
        <FormField
          name="currency"
          label="Currency"
          hint="Razorpay payments and GST invoices are always in Indian rupees, so this cannot be changed."
        >
          <Input value={`${v.currency} – Indian rupee (₹)`} readOnly disabled />
        </FormField>
      </div>
      <BilingualField name="tagline" label="Tagline" defaultValue={v.tagline} maxLength={120} hint="Shown in the footer and the default page description." />
      <SubmitButton className="w-fit" />
    </ActionForm>
  );
}

/* ───────── Taxes ───────── */

export function TaxForm({
  v,
  example,
}: {
  v: { lowPercent: number; highPercent: number; thresholdRupees: number; sacCode: string; invoicePrefix: string };
  example: { fy: string };
}) {
  const [prefix, setPrefix] = useState(v.invoicePrefix);
  return (
    <ActionForm action={saveTaxSettings} successMessage={null} className="grid gap-6">
      <div className="grid gap-5 md:grid-cols-3">
        <FormField name="lowPercent" label="GST up to the threshold (%)">
          <Input type="number" inputMode="numeric" min={0} max={28} step={1} defaultValue={v.lowPercent} required />
        </FormField>
        <FormField name="threshold" label="Threshold per night (₹)" hint="Room tariff per night, before tax.">
          <Input type="number" inputMode="decimal" min={1} step="1" defaultValue={v.thresholdRupees} required />
        </FormField>
        <FormField name="highPercent" label="GST above the threshold (%)">
          <Input type="number" inputMode="numeric" min={0} max={28} step={1} defaultValue={v.highPercent} required />
        </FormField>
      </div>
      <p className="bg-surface-2 text-muted rounded-xl px-4 py-3 text-sm">
        The slab is chosen for each night from that night&apos;s tariff. Confirm the rates with your accountant;
        existing bookings keep the tax they were priced with.
      </p>
      <div className={grid}>
        <FormField name="sacCode" label="SAC code" hint="996311 is room accommodation services.">
          <Input defaultValue={v.sacCode} required inputMode="numeric" pattern="\d{4,8}" maxLength={8} />
        </FormField>
        <FormField name="invoicePrefix" label="Invoice number prefix" hint={`Next invoices look like ${prefix || "INV"}/${example.fy}/0001.`}>
          <Input
            defaultValue={v.invoicePrefix}
            required
            maxLength={8}
            pattern="[A-Za-z0-9\-]{1,8}"
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          />
        </FormField>
      </div>
      <SubmitButton className="w-fit" />
    </ActionForm>
  );
}

/* ───────── Booking rules ───────── */

export function BookingRulesForm({
  v,
}: {
  v: { maxNights: number; maxRoomsPerBooking: number; advanceBookingDays: number; holdMinutes: number; freeCancelHours: number };
}) {
  const num = (name: keyof typeof v, label: string, min: number, max: number, hint: string) => (
    <FormField name={name} label={label} hint={hint}>
      <Input type="number" inputMode="numeric" min={min} max={max} step={1} defaultValue={v[name]} required />
    </FormField>
  );
  return (
    <ActionForm action={saveBookingRules} className="grid gap-6">
      <div className={grid}>
        {num("maxNights", "Longest online stay (nights)", 1, 90, "Longer stays are asked to call the front desk.")}
        {num("maxRoomsPerBooking", "Rooms per online booking", 1, 20, "Groups larger than this call the front desk.")}
        {num("advanceBookingDays", "Book up to (days ahead)", 1, 730, "How far ahead the calendar opens.")}
        {num("holdMinutes", "Payment hold (minutes)", 5, 120, "Rooms are held this long while a guest pays online, then released.")}
        {num("freeCancelHours", "Free cancellation (hours before check-in)", 0, 720, "Guests can cancel online until then. Keep the cancellation policy text in step.")}
      </div>
      <SubmitButton className="w-fit" />
    </ActionForm>
  );
}

/* ───────── Payments ───────── */

function SecretField({ name, label, isSet, hint }: { name: string; label: string; isSet: boolean; hint: string }) {
  const [replacing, setReplacing] = useState(!isSet);
  const clearName = name === "keySecret" ? "clearKeySecret" : "clearWebhookSecret";
  return (
    <div className="grid content-start gap-2">
      {replacing ? (
        <FormField name={name} label={label} optional={isSet} hint={isSet ? "Leave empty to keep the current value." : hint}>
          <Input type="password" autoComplete="new-password" spellCheck={false} maxLength={200} />
        </FormField>
      ) : (
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">{label}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-surface-2 rounded-xl px-3 py-2.5 font-mono text-sm">Set ••••••••</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setReplacing(true)}>
              Replace
            </Button>
          </div>
          <p className="text-muted text-sm">{hint}</p>
        </div>
      )}
      {isSet ? <Checkbox name={clearName} label="Remove this secret" /> : null}
    </div>
  );
}

function CopyLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label="Webhook URL" className="h-10 font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-10"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error("Copy failed. Select the URL and copy it manually.");
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function PayToggles({ online, atHotel }: { online: boolean; atHotel: boolean }) {
  const { errors } = useFormErrors();
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">Ways guests can pay</legend>
      <Checkbox name="onlineEnabled" defaultChecked={online} label="Pay online (UPI, cards, net banking)" hint="Offered only while Razorpay keys are set." />
      <Checkbox name="payAtHotelEnabled" defaultChecked={atHotel} label="Pay at hotel" hint="The booking is confirmed now and paid at check-in." />
      {errors.payAtHotelEnabled?.[0] ? (
        <p role="alert" className="text-danger text-sm">
          {errors.payAtHotelEnabled[0]}
        </p>
      ) : null}
    </fieldset>
  );
}

export function PaymentsForm({
  v,
}: {
  v: {
    onlineEnabled: boolean;
    payAtHotelEnabled: boolean;
    keyId: string;
    keySecretSet: boolean;
    webhookSecretSet: boolean;
    webhookUrl: string;
  };
}) {
  return (
    <div className="grid gap-8">
      <ActionForm action={savePaymentSettings} successMessage="Payment settings saved." className="grid gap-6">
        <PayToggles online={v.onlineEnabled} atHotel={v.payAtHotelEnabled} />
        <hr className="border-line" />
        <div className={grid}>
          <FormField name="keyId" label="Razorpay key id" optional hint="Dashboard → Account & settings → API keys. Starts with rzp_live_ or rzp_test_.">
            <Input defaultValue={v.keyId} spellCheck={false} autoComplete="off" maxLength={60} placeholder="rzp_live_…" />
          </FormField>
          <SecretField name="keySecret" label="Razorpay key secret" isSet={v.keySecretSet} hint="Shown once in Razorpay when you generate the key. Stored encrypted." />
          <SecretField name="webhookSecret" label="Webhook secret" isSet={v.webhookSecretSet} hint="The secret you type when creating the webhook in Razorpay. Stored encrypted." />
        </div>
        <SubmitButton className="w-fit" />
      </ActionForm>
      <div className="bg-surface-2 grid gap-3 rounded-2xl p-5">
        <p className="font-medium">Webhook (recommended)</p>
        <p className="text-muted text-sm">
          In Razorpay, go to Account &amp; settings → Webhooks → Add new webhook, paste this URL, set a secret, and tick
          the events <code className="font-mono">payment.captured</code> and <code className="font-mono">order.paid</code>.
          It confirms bookings even if a guest closes the page right after paying.
        </p>
        <CopyLine value={v.webhookUrl} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton action={testRazorpayConnection} variant="dark">
          <PlugZap aria-hidden /> Test connection
        </ActionButton>
        <p className="text-muted text-sm">Checks the saved keys with Razorpay without charging anything.</p>
      </div>
    </div>
  );
}

/* ───────── Notifications ───────── */

export function NotificationsForm({
  v,
  emailReady,
  myEmail,
}: {
  v: { hotelEmails: string[]; sendGuestConfirmation: boolean };
  emailReady: boolean;
  myEmail: string;
}) {
  return (
    <div className="grid gap-8">
      <ActionForm action={saveNotificationSettings} className="grid gap-6">
        <FormField
          name="hotelEmails"
          label="Send new bookings and enquiries to"
          hint="One address per line, or separated by commas. If empty, the contact email from the Website editor is used."
        >
          <Textarea rows={4} className="min-h-0 font-mono text-sm" defaultValue={v.hotelEmails.join("\n")} placeholder={"frontdesk@example.com\nowner@example.com"} />
        </FormField>
        <Checkbox
          name="sendGuestConfirmation"
          defaultChecked={v.sendGuestConfirmation}
          label="Email guests a booking confirmation"
          hint="Sent when a guest gave an email address."
        />
        <SubmitButton className="w-fit" />
      </ActionForm>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton action={sendTestEmail} variant="dark" disabled={!emailReady}>
          <Send aria-hidden /> Send test email
        </ActionButton>
        <p className="text-muted text-sm">
          {emailReady ? `Sends a test message to ${myEmail}.` : "Available once RESEND_API_KEY is set."}
        </p>
      </div>
    </div>
  );
}
