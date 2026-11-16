import { NextResponse } from "next/server";
import { markRazorpayPaid } from "@/lib/payments";
import { getRazorpayConfig, verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay webhook (enable payment.captured and order.paid in the Razorpay dashboard and paste the webhook secret in
 * Admin → Settings → Payments). It confirms bookings even if the guest closes the browser right after paying.
 * Authenticated by the HMAC signature, so it needs no session and no CSRF check.
 */
export async function POST(request: Request) {
  const cfg = await getRazorpayConfig();
  if (!cfg?.webhookSecret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !verifyWebhookSignature(cfg.webhookSecret, raw, signature))
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; status?: string } };
      order?: { entity?: { id?: string } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id ?? event.payload?.order?.entity?.id;
    if (orderId && payment?.id) {
      const res = await markRazorpayPaid({ orderId, paymentId: payment.id, source: "webhook" });
      if (!res.ok) console.warn(`[razorpay-webhook] no booking for order ${orderId}`);
    }
  }
  // Always 200 for events we do not act on, so Razorpay does not keep retrying them.
  return NextResponse.json({ ok: true });
}
