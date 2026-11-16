"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ActionError } from "@/lib/action";
import { adminAction, bilingual, zCheckbox, zInt, zRupees } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { emailConfigured, emailLayout, sendEmail } from "@/lib/email";
import { getRazorpayConfig, SECRETS_KEY, type StoredSecrets } from "@/lib/razorpay";
import { zText } from "@/lib/sanitize";
import { getRawSetting, getSettings } from "@/lib/settings";
import { updateSetting } from "@/lib/settings-write";

const form = (fd: FormData) => Object.fromEntries(fd) as Record<string, string>;

/* ───────── Hotel ───────── */

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const hotelSchema = z.object({
  name: zText(2, 80),
  legalName: zText(2, 150),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || GSTIN.test(v), "A GSTIN has 15 characters, e.g. 06ABCDE1234F1Z5."),
});

export async function saveHotelSettings(_prev: unknown, fd: FormData) {
  return adminAction("settings:manage", async (staff) => {
    const input = hotelSchema.parse(form(fd));
    const tagline = bilingual(fd, "tagline", 120);
    if (!tagline.en) throw new ActionError("Add an English tagline.", { taglineEn: ["English text is required."] });
    await updateSetting("hotel", { name: input.name, tagline, currency: "INR" });
    await updateSetting("gst", { legalName: input.legalName, gstin: input.gstin });
    await writeAudit({ userId: staff.id, action: "settings.hotel", entity: "Setting", entityId: "hotel", meta: input });
    revalidatePath("/admin", "layout");
  }, "Hotel details saved.");
}

/* ───────── Taxes ───────── */

const taxSchema = z
  .object({
    lowPercent: zInt(0, 28),
    highPercent: zInt(0, 28),
    threshold: zRupees(1, 1_000_000),
    sacCode: z.string().trim().regex(/^\d{4,8}$/, "Use the 4 to 8 digit SAC code, e.g. 996311."),
    invoicePrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{1,8}$/, "Use up to 8 letters, numbers or hyphens."),
  })
  .refine((v) => v.highPercent >= v.lowPercent, {
    message: "The higher slab cannot be lower than the lower slab.",
    path: ["highPercent"],
  });

export async function saveTaxSettings(_prev: unknown, fd: FormData) {
  return adminAction("settings:manage", async (staff) => {
    const input = taxSchema.parse(form(fd));
    await updateSetting("gst", {
      lowPercent: input.lowPercent,
      highPercent: input.highPercent,
      thresholdPaise: input.threshold,
      sacCode: input.sacCode,
      invoicePrefix: input.invoicePrefix,
    });
    await writeAudit({ userId: staff.id, action: "settings.taxes", entity: "Setting", entityId: "gst", meta: input });
  }, "Tax settings saved. New bookings use them; existing bookings keep their prices.");
}

/* ───────── Booking rules ───────── */

const bookingSchema = z.object({
  maxNights: zInt(1, 90),
  maxRoomsPerBooking: zInt(1, 20),
  advanceBookingDays: zInt(1, 730),
  holdMinutes: zInt(5, 120),
  freeCancelHours: zInt(0, 720),
});

export async function saveBookingRules(_prev: unknown, fd: FormData) {
  return adminAction("settings:manage", async (staff) => {
    const input = bookingSchema.parse(form(fd));
    await updateSetting("booking", input);
    await writeAudit({ userId: staff.id, action: "settings.booking", entity: "Setting", entityId: "booking", meta: input });
  }, "Booking rules saved.");
}

/* ───────── Payments ───────── */

const paymentSchema = z.object({
  onlineEnabled: zCheckbox,
  payAtHotelEnabled: zCheckbox,
  keyId: z
    .string()
    .trim()
    .refine((v) => v === "" || /^rzp_(test|live)_[A-Za-z0-9]{8,32}$/.test(v), "A Razorpay key id looks like rzp_live_XXXXXXXXXXXXXX."),
  keySecret: z.string().trim().max(200),
  webhookSecret: z.string().trim().max(200),
  clearKeySecret: zCheckbox,
  clearWebhookSecret: zCheckbox,
});

export async function savePaymentSettings(_prev: unknown, fd: FormData) {
  return adminAction("settings:manage", async (staff) => {
    const input = paymentSchema.parse({
      ...form(fd),
      onlineEnabled: fd.get("onlineEnabled") ?? undefined,
      payAtHotelEnabled: fd.get("payAtHotelEnabled") ?? undefined,
      clearKeySecret: fd.get("clearKeySecret") ?? undefined,
      clearWebhookSecret: fd.get("clearWebhookSecret") ?? undefined,
    });
    if (!input.onlineEnabled && !input.payAtHotelEnabled)
      throw new ActionError("Keep at least one way to pay switched on.", {
        payAtHotelEnabled: ["Guests need at least one way to pay."],
      });
    if (input.keySecret && input.keySecret.length < 10)
      throw new ActionError("That key secret looks too short.", { keySecret: ["Paste the full key secret."] });

    const stored = (await getRawSetting<StoredSecrets>(SECRETS_KEY)) ?? {};
    const next: StoredSecrets = { ...stored, razorpayKeyId: input.keyId || undefined };
    if (input.clearKeySecret) delete next.razorpayKeySecretEnc;
    else if (input.keySecret) next.razorpayKeySecretEnc = encryptText(input.keySecret);
    if (input.clearWebhookSecret) delete next.razorpayWebhookSecretEnc;
    else if (input.webhookSecret) next.razorpayWebhookSecretEnc = encryptText(input.webhookSecret);
    if (!next.razorpayKeyId) delete next.razorpayKeyId;

    await db.setting.upsert({
      where: { key: SECRETS_KEY },
      create: { key: SECRETS_KEY, value: next as Prisma.InputJsonValue },
      update: { value: next as Prisma.InputJsonValue },
    });
    await updateSetting("payments", { onlineEnabled: input.onlineEnabled, payAtHotelEnabled: input.payAtHotelEnabled });
    // Never log secret values, only what changed.
    await writeAudit({
      userId: staff.id,
      action: "settings.payments",
      entity: "Setting",
      entityId: "payments",
      meta: {
        onlineEnabled: input.onlineEnabled,
        payAtHotelEnabled: input.payAtHotelEnabled,
        keyId: input.keyId || null,
        keySecret: input.clearKeySecret ? "cleared" : input.keySecret ? "replaced" : "unchanged",
        webhookSecret: input.clearWebhookSecret ? "cleared" : input.webhookSecret ? "replaced" : "unchanged",
      },
    });
    revalidatePath("/admin/settings/payments");
  }, "Payment settings saved.");
}

export async function testRazorpayConnection() {
  return adminAction("settings:manage", async () => {
    const cfg = await getRazorpayConfig();
    if (!cfg)
      throw new ActionError(
        "No Razorpay keys are set. Add the key id and key secret above (or RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in the environment), save, then test again.",
      );
    let res: Response;
    try {
      res = await fetch("https://api.razorpay.com/v1/orders?count=1", {
        headers: { Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ActionError("Could not reach Razorpay. Check the server's internet connection and try again.");
    }
    if (res.ok) return { mode: cfg.keyId.startsWith("rzp_live_") ? "live" : "test" };
    const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
    throw new ActionError(
      res.status === 401
        ? "Razorpay rejected these keys. Check the key id and key secret match the same mode (test or live)."
        : `Razorpay said: ${json.error?.description ?? res.statusText}`,
    );
  }).then((r) => (r.ok ? { ...r, message: `Connected to Razorpay in ${r.data.mode} mode.` } : r));
}

/* ───────── Notifications ───────── */

export async function saveNotificationSettings(_prev: unknown, fd: FormData) {
  return adminAction("settings:manage", async (staff) => {
    const raw = String(fd.get("hotelEmails") ?? "");
    const list = [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
    const bad = list.filter((e) => !z.string().email().max(254).safeParse(e).success);
    if (bad.length)
      throw new ActionError("Check the email addresses.", { hotelEmails: [`Not a valid email: ${bad.join(", ")}`] });
    if (list.length > 10) throw new ActionError("Add up to 10 addresses.", { hotelEmails: ["Up to 10 addresses."] });
    const sendGuestConfirmation = fd.get("sendGuestConfirmation") === "on";
    await updateSetting("notifications", { hotelEmails: list, sendGuestConfirmation });
    await writeAudit({
      userId: staff.id,
      action: "settings.notifications",
      entity: "Setting",
      entityId: "notifications",
      meta: { hotelEmails: list, sendGuestConfirmation },
    });
  }, "Notification settings saved.");
}

export async function sendTestEmail() {
  return adminAction("settings:manage", async (staff) => {
    if (!emailConfigured())
      throw new ActionError("Email is not set up. Add RESEND_API_KEY and EMAIL_FROM to the environment, then redeploy.");
    const settings = await getSettings();
    const { html, text } = emailLayout({
      hotelName: settings.hotel.name,
      title: "Test email",
      intro: `Hello ${staff.name.split(" ")[0]},`,
      paragraphs: ["If you can read this, booking confirmations and enquiry alerts will be delivered."],
    });
    const sent = await sendEmail({ kind: "enquiry.hotel", to: staff.email, subject: `Test email from ${settings.hotel.name}`, html, text });
    if (!sent.ok) throw new ActionError("The email could not be sent. The Email log tab shows the reason.");
    return { to: staff.email };
  }).then((r) => (r.ok ? { ...r, message: `Test email sent to ${r.data.to}.` } : r));
}
