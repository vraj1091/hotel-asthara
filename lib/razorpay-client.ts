"use client";

import { BRAND } from "@/lib/brand";

/** Browser side of Razorpay Checkout: loads checkout.js on demand and resolves with how the guest left it. */

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, cb: (resp: unknown) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<boolean> | null = null;
function loadCheckout() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  loading ??= new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(!!window.Razorpay);
    s.onerror = () => {
      loading = null;
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return loading;
}

export type CheckoutOutcome =
  | { status: "paid"; orderId: string; paymentId: string; signature: string }
  | { status: "cancelled" | "failed" | "unavailable" };

export async function openRazorpay(opts: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  notes?: Record<string, string>;
}): Promise<CheckoutOutcome> {
  if (!(await loadCheckout()) || !window.Razorpay) return { status: "unavailable" };
  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    const done = (o: CheckoutOutcome) => {
      if (!settled) {
        settled = true;
        resolve(o);
      }
    };
    const rzp = new window.Razorpay!({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amountPaise,
      currency: "INR",
      name: opts.name,
      description: opts.description,
      prefill: opts.prefill,
      notes: opts.notes ?? {},
      theme: { color: BRAND.navy },
      handler: (resp: RazorpayResponse) =>
        done({
          status: "paid",
          orderId: resp.razorpay_order_id,
          paymentId: resp.razorpay_payment_id,
          signature: resp.razorpay_signature,
        }),
      modal: { ondismiss: () => done({ status: "cancelled" }), confirm_close: true },
    });
    // A failed attempt keeps the modal open so the guest can try another method; we only note it.
    rzp.on("payment.failed", () => undefined);
    rzp.open();
  });
}
