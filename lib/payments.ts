import "server-only";
import { changeBookingStatus } from "@/lib/booking-engine";
import { sendBookingEmails } from "@/lib/booking-notify";
import { db } from "@/lib/db";
import { emailLayout, sendEmail } from "@/lib/email";
import { createRazorpayOrder, getRazorpayConfig } from "@/lib/razorpay";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";

/** Creates a Razorpay order for what is still owed on a booking and records a PENDING payment for it. */
export async function createOnlinePayment(bookingId: string) {
  const cfg = await getRazorpayConfig();
  if (!cfg) throw new Error("Online payment is not configured.");
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { payments: true, guest: true },
  });
  const paid = booking.payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amountPaise, 0);
  const due = booking.totalPaise - paid;
  if (due <= 0) throw new Error("Nothing left to pay on this booking.");
  const { orderId } = await createRazorpayOrder(cfg, {
    amountPaise: due,
    receipt: booking.reference,
    notes: { reference: booking.reference, bookingId: booking.id },
  });
  // Older unfinished attempts are superseded by this one.
  await db.payment.updateMany({
    where: { bookingId, status: "PENDING", method: "RAZORPAY" },
    data: { status: "FAILED", note: "Superseded by a new payment attempt" },
  });
  await db.payment.create({
    data: { bookingId, method: "RAZORPAY", status: "PENDING", amountPaise: due, razorpayOrderId: orderId },
  });
  return { orderId, amountPaise: due, keyId: cfg.keyId, booking };
}

/**
 * Marks a Razorpay order as paid. Called from the checkout success handler (after signature check) and from the
 * webhook, so it is idempotent: the second call does nothing.
 */
export async function markRazorpayPaid(args: {
  orderId: string;
  paymentId: string;
  signature?: string | null;
  source: "checkout" | "webhook";
}) {
  const payment = await db.payment.findUnique({
    where: { razorpayOrderId: args.orderId },
    include: { booking: true },
  });
  if (!payment) return { ok: false as const, reason: "unknown-order" };
  if (payment.status === "PAID") return { ok: true as const, booking: payment.booking, already: true };

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: "PAID",
      razorpayPaymentId: args.paymentId,
      razorpaySignature: args.signature ?? null,
      paidAt: new Date(),
      note: args.source === "webhook" ? "Confirmed by Razorpay webhook" : null,
    },
  });

  const booking = payment.booking;
  if (booking.status === "PENDING") {
    await db.booking.update({ where: { id: booking.id }, data: { paymentMethod: "RAZORPAY" } });
    await changeBookingStatus(booking.id, "CONFIRMED");
    await sendBookingEmails(booking.id);
  } else if (booking.status === "CANCELLED" || booking.status === "NO_SHOW") {
    // Paid after the hold ran out: keep the money on record and ask the front desk to rebook or refund.
    await db.booking.update({
      where: { id: booking.id },
      data: {
        internalNotes: `${booking.internalNotes ? `${booking.internalNotes}\n` : ""}Online payment ${args.paymentId} arrived after the booking was ${booking.status.toLowerCase()}. Rebook the guest or refund.`,
      },
    });
    const settings = await getSettings();
    const to = settings.notifications.hotelEmails.length
      ? settings.notifications.hotelEmails
      : settings.contact.email
        ? [settings.contact.email]
        : [];
    if (to.length) {
      const { html, text } = emailLayout({
        hotelName: settings.hotel.name,
        title: "Payment received for a cancelled booking",
        rows: [
          ["Booking", booking.reference],
          ["Razorpay payment", args.paymentId],
        ],
        paragraphs: ["Call the guest to rebook, or refund the payment from the booking page."],
        button: { label: "Open booking", url: absoluteUrl(`/admin/bookings/${booking.id}`) },
      });
      await sendEmail({ kind: "booking.hotel", to, subject: `Action needed: late payment for ${booking.reference}`, html, text, bookingId: booking.id });
    }
    return { ok: true as const, booking, late: true };
  }
  return { ok: true as const, booking: await db.booking.findUniqueOrThrow({ where: { id: booking.id } }) };
}
