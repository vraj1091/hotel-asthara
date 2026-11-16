import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { decryptText } from "@/lib/crypto";
import { getRawSetting } from "@/lib/settings";

/**
 * Razorpay over its REST API (no SDK).
 * Keys come from Admin → Settings → Payments (stored encrypted with ID_ENCRYPTION_KEY) or, if those are empty,
 * from RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET. With no keys, online payment is simply not
 * offered and guests can still book with "Pay at hotel".
 */

export const SECRETS_KEY = "secrets";
export type StoredSecrets = {
  razorpayKeyId?: string;
  razorpayKeySecretEnc?: string;
  razorpayWebhookSecretEnc?: string;
};

export type RazorpayConfig = { keyId: string; keySecret: string; webhookSecret: string | null };

function safeDecrypt(v?: string) {
  if (!v) return "";
  try {
    return decryptText(v);
  } catch {
    return "";
  }
}

export async function getRazorpayConfig(): Promise<RazorpayConfig | null> {
  const stored = (await getRawSetting<StoredSecrets>(SECRETS_KEY).catch(() => null)) ?? {};
  const keyId = stored.razorpayKeyId || process.env.RAZORPAY_KEY_ID || "";
  const keySecret = safeDecrypt(stored.razorpayKeySecretEnc) || process.env.RAZORPAY_KEY_SECRET || "";
  const webhookSecret =
    safeDecrypt(stored.razorpayWebhookSecretEnc) || process.env.RAZORPAY_WEBHOOK_SECRET || null;
  return keyId && keySecret ? { keyId, keySecret, webhookSecret } : null;
}

export async function createRazorpayOrder(
  cfg: RazorpayConfig,
  args: { amountPaise: number; receipt: string; notes?: Record<string, string> },
) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: args.amountPaise,
      currency: "INR",
      receipt: args.receipt.slice(0, 40),
      notes: args.notes ?? {},
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as { id?: string; error?: { description?: string } };
  if (!res.ok || !json.id)
    throw new Error(`Razorpay order failed: ${json.error?.description ?? res.statusText}`);
  return { orderId: json.id };
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout success handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyPaymentSignature(
  cfg: RazorpayConfig,
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const expected = createHmac("sha256", cfg.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(secret: string, rawBody: string, signature: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Refund a captured payment (used when a paid booking is cancelled in time). */
export async function refundRazorpayPayment(cfg: RazorpayConfig, paymentId: string, amountPaise: number) {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountPaise }),
    cache: "no-store",
  });
  const json = (await res.json()) as { id?: string; error?: { description?: string } };
  if (!res.ok || !json.id)
    throw new Error(`Razorpay refund failed: ${json.error?.description ?? res.statusText}`);
  return { refundId: json.id };
}
