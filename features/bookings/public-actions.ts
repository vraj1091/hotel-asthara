"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, runAction, type ActionResult } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { getAvailability, quoteRoomType } from "@/lib/availability";
import { canGuestCancel, changeBookingStatus, checkCoupon, createBooking } from "@/lib/booking-engine";
import { fieldErrorKeys, guestDetailsSchema, lookupSchema } from "@/lib/booking-form";
import { sendBookingEmails, sendCancellationEmails } from "@/lib/booking-notify";
import { db } from "@/lib/db";
import { contactMatches, grantBookingAccess, hasBookingAccess } from "@/lib/guest-access";
import { createOnlinePayment, markRazorpayPaid } from "@/lib/payments";
import { applyDiscount } from "@/lib/pricing";
import { clientIp, LIMITS, rateLimit } from "@/lib/rate-limit";
import { getRazorpayConfig, refundRazorpayPayment, verifyPaymentSignature } from "@/lib/razorpay";
import { getSettings } from "@/lib/settings";
import { parseStay } from "@/lib/stay-search";

const zStay = z.object({
  room: z.string().max(80).regex(/^[a-z0-9-]+$/),
  checkIn: z.string().max(10),
  checkOut: z.string().max(10),
  rooms: z.coerce.number().int().min(1).max(10),
  guests: z.coerce.number().int().min(1).max(40),
});

async function limit(bucket: keyof typeof LIMITS) {
  const res = await rateLimit(bucket, clientIp(await headers()), LIMITS[bucket]);
  if (!res.ok) throw new ActionError("tooMany");
}

async function resolveStay(input: z.infer<typeof zStay>) {
  const settings = await getSettings();
  const parsed = parseStay(input, settings.booking);
  if (!parsed.ok) throw new ActionError(parsed.error);
  const room = await db.roomType.findFirst({ where: { slug: input.room, active: true, deletedAt: null } });
  if (!room) throw new ActionError("roomGone");
  return { settings, stay: parsed.stay, room };
}

export type QuoteView = {
  nights: number;
  rooms: number;
  available: number;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  coupon: { code: string; label: string } | null;
  couponError: string | null;
};

/** Live price for the checkout summary, including a promo code. Nothing is reserved. */
export async function quoteBooking(input: {
  room: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  couponCode?: string;
}): Promise<ActionResult<QuoteView>> {
  return runAction(async () => {
    if (input.couponCode) await limit("coupon");
    const { settings, stay, room } = await resolveStay(zStay.parse(input));
    const [avail, quote] = await Promise.all([
      getAvailability(stay.checkIn, stay.checkOut, { roomTypeId: room.id }),
      quoteRoomType({ roomTypeId: room.id, baseRatePaise: room.baseRatePaise, checkIn: stay.checkIn, checkOut: stay.checkOut, gst: settings.gst }),
    ]);
    const subtotal = quote.subtotalPaise * stay.rooms;
    const tax = quote.taxPaise * stay.rooms;
    let coupon: QuoteView["coupon"] = null;
    let couponError: string | null = null;
    let discount = 0;
    const code = input.couponCode?.trim().slice(0, 40);
    if (code) {
      const check = await checkCoupon(db, code, { subtotalPaise: subtotal, nights: stay.nights });
      if (check.ok) {
        coupon = { code: check.code, label: check.label };
        discount = check.discountPaise;
      } else couponError = check.error;
    }
    const totals = applyDiscount(subtotal, tax, discount);
    return {
      nights: stay.nights,
      rooms: stay.rooms,
      available: avail.get(room.id)?.available ?? 0,
      subtotalPaise: totals.subtotalPaise,
      discountPaise: totals.discountPaise,
      taxPaise: totals.taxPaise,
      totalPaise: totals.totalPaise,
      coupon,
      couponError,
    };
  });
}

export type PlaceResult =
  | { mode: "confirmed"; reference: string }
  | {
      mode: "razorpay";
      reference: string;
      orderId: string;
      keyId: string;
      amountPaise: number;
      prefill: { name: string; email: string; contact: string };
      holdMinutes: number;
    };

/** Creates the booking. Pay at hotel → confirmed now. Pay online → rooms held while the guest pays. */
export async function placeBooking(
  _prev: ActionResult<PlaceResult> | null,
  formData: FormData,
): Promise<ActionResult<PlaceResult>> {
  return runAction(async () => {
    const raw = Object.fromEntries(formData) as Record<string, string>;
    if (raw.website) return { mode: "confirmed", reference: "" } as PlaceResult; // honeypot: bots get nothing
    await limit("booking");
    const details = guestDetailsSchema.safeParse({
      name: raw.name ?? "",
      phone: raw.phone ?? "",
      email: raw.email ?? "",
      city: raw.city ?? "",
      note: raw.note ?? "",
      payment: raw.payment,
      terms: raw.terms,
    });
    if (!details.success) {
      const keys = fieldErrorKeys(details.error);
      throw new ActionError("checkFields", Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, [v]])));
    }
    const d = details.data;
    const { settings, stay, room } = await resolveStay(
      zStay.parse({ room: raw.room, checkIn: raw.checkIn, checkOut: raw.checkOut, rooms: raw.rooms, guests: raw.guests }),
    );

    const razorpay = await getRazorpayConfig();
    const onlineOk = settings.payments.onlineEnabled && !!razorpay;
    const hotelOk = settings.payments.payAtHotelEnabled || !onlineOk; // never leave a guest with no way to book
    if (d.payment === "online" && !onlineOk) throw new ActionError("onlineUnavailable", { payment: ["payment"] });
    if (d.payment === "hotel" && !hotelOk) throw new ActionError("hotelUnavailable", { payment: ["payment"] });

    const online = d.payment === "online";
    const booking = await createBooking({
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: stay.guests,
      children: 0,
      selection: { roomTypeId: room.id, rooms: stay.rooms },
      guest: { name: d.name, phone: d.phone, email: d.email || null, city: d.city || null },
      couponCode: raw.couponCode?.trim() || null,
      paymentMethod: online ? "RAZORPAY" : "PAY_AT_HOTEL",
      status: online ? "PENDING" : "CONFIRMED",
      source: "WEBSITE",
      holdMinutes: online ? settings.booking.holdMinutes : null,
      specialRequests: d.note || null,
    });
    await grantBookingAccess(booking.reference);
    await writeAudit({ action: "booking.create_web", entity: "Booking", entityId: booking.id, meta: { reference: booking.reference, payment: d.payment } });

    if (!online) {
      await sendBookingEmails(booking.id);
      return { mode: "confirmed", reference: booking.reference } as PlaceResult;
    }
    try {
      const order = await createOnlinePayment(booking.id);
      return {
        mode: "razorpay",
        reference: booking.reference,
        orderId: order.orderId,
        keyId: order.keyId,
        amountPaise: order.amountPaise,
        prefill: { name: d.name, email: d.email, contact: `+91${d.phone}` },
        holdMinutes: settings.booking.holdMinutes,
      } as PlaceResult;
    } catch (error) {
      console.error("[booking] Razorpay order failed", error);
      // The booking exists and is held; the guest can retry payment or switch to pay at hotel on the next page.
      return { mode: "confirmed", reference: booking.reference } as PlaceResult;
    }
  });
}

async function bookingForGuest(reference: string) {
  const ref = z.string().max(20).parse(reference);
  if (!(await hasBookingAccess(ref))) throw new ActionError("noAccess");
  const booking = await db.booking.findUnique({ where: { reference: ref }, include: { payments: true } });
  if (!booking || booking.deletedAt) throw new ActionError("notFound");
  return booking;
}

/** Retry or start online payment from the booking page. */
export async function payBookingOnline(reference: string): Promise<
  ActionResult<Extract<PlaceResult, { mode: "razorpay" }>>
> {
  return runAction(async () => {
    await limit("payment");
    const booking = await bookingForGuest(reference);
    const settings = await getSettings();
    if (!settings.payments.onlineEnabled || !(await getRazorpayConfig())) throw new ActionError("onlineUnavailable");
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) throw new ActionError("cannotPay");
    if (booking.status === "PENDING" && booking.holdExpiresAt && booking.holdExpiresAt < new Date())
      throw new ActionError("holdExpired");
    const guest = await db.guest.findUniqueOrThrow({ where: { id: booking.guestId } });
    const order = await createOnlinePayment(booking.id);
    return {
      mode: "razorpay" as const,
      reference: booking.reference,
      orderId: order.orderId,
      keyId: order.keyId,
      amountPaise: order.amountPaise,
      prefill: { name: guest.name, email: guest.email ?? "", contact: `+91${guest.phone.replace(/\D/g, "").slice(-10)}` },
      holdMinutes: settings.booking.holdMinutes,
    };
  });
}

/** Called by the Razorpay checkout success handler. The signature proves the payment is genuine. */
export async function confirmOnlinePayment(input: {
  reference: string;
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<ActionResult<{ late: boolean }>> {
  return runAction(async () => {
    const data = z
      .object({ reference: z.string().max(20), orderId: z.string().max(60), paymentId: z.string().max(60), signature: z.string().max(200) })
      .parse(input);
    await bookingForGuest(data.reference);
    const cfg = await getRazorpayConfig();
    if (!cfg || !verifyPaymentSignature(cfg, data.orderId, data.paymentId, data.signature))
      throw new ActionError("paymentUnverified");
    const res = await markRazorpayPaid({ orderId: data.orderId, paymentId: data.paymentId, signature: data.signature, source: "checkout" });
    if (!res.ok) throw new ActionError("paymentUnverified");
    return { late: "late" in res && !!res.late };
  });
}

/** A guest who could not pay online keeps the booking and pays at check-in instead. */
export async function switchToPayAtHotel(reference: string): Promise<ActionResult> {
  return runAction(async () => {
    const booking = await bookingForGuest(reference);
    const settings = await getSettings();
    if (!settings.payments.payAtHotelEnabled) throw new ActionError("hotelUnavailable");
    if (booking.status !== "PENDING") throw new ActionError("cannotSwitch");
    if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) throw new ActionError("holdExpired");
    await db.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING" }, data: { status: "FAILED", note: "Guest chose to pay at the hotel" } });
    await db.booking.update({ where: { id: booking.id }, data: { paymentMethod: "PAY_AT_HOTEL" } });
    await changeBookingStatus(booking.id, "CONFIRMED");
    await writeAudit({ action: "booking.switch_pay_at_hotel", entity: "Booking", entityId: booking.id });
    await sendBookingEmails(booking.id);
  });
}

/** Free cancellation by the guest, within the window set in Settings → Booking rules. */
export async function cancelBookingAsGuest(reference: string): Promise<ActionResult<{ refunded: boolean }>> {
  return runAction(async () => {
    await limit("guestCancel");
    const booking = await bookingForGuest(reference);
    const settings = await getSettings();
    if (!canGuestCancel(booking, settings.booking.freeCancelHours, settings.hotel.checkInTime))
      throw new ActionError("cannotCancel");
    await changeBookingStatus(booking.id, "CANCELLED", { reason: "Cancelled by the guest online" });
    await writeAudit({ action: "booking.cancel_guest", entity: "Booking", entityId: booking.id });

    let refunded = false;
    const paid = booking.payments.filter((p) => p.status === "PAID" && p.method === "RAZORPAY" && p.razorpayPaymentId);
    const cfg = paid.length ? await getRazorpayConfig() : null;
    for (const p of paid) {
      if (!cfg) break;
      try {
        const { refundId } = await refundRazorpayPayment(cfg, p.razorpayPaymentId!, p.amountPaise);
        await db.payment.create({
          data: { bookingId: booking.id, method: "RAZORPAY", status: "REFUNDED", amountPaise: p.amountPaise, note: `Automatic refund ${refundId} (guest cancelled online)`, paidAt: new Date() },
        });
        refunded = true;
      } catch (error) {
        console.error("[cancel] refund failed", error);
        await db.booking.update({
          where: { id: booking.id },
          data: { internalNotes: `${booking.internalNotes ? `${booking.internalNotes}\n` : ""}Automatic refund failed for ${p.razorpayPaymentId}. Refund manually.` },
        });
      }
    }
    await sendCancellationEmails(booking.id, true);
    return { refunded };
  });
}

/** Manage booking: reference + phone or email → access to the booking page. */
export async function lookupBooking(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await limit("lookup");
    const parsed = lookupSchema.safeParse({ reference: formData.get("reference") ?? "", contact: formData.get("contact") ?? "" });
    if (!parsed.success) {
      const keys = fieldErrorKeys(parsed.error);
      throw new ActionError("checkFields", Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, [v]])));
    }
    const booking = await db.booking.findUnique({
      where: { reference: parsed.data.reference },
      include: { guest: { select: { phone: true, email: true } } },
    });
    // Same message whether the reference or the contact is wrong, so references cannot be probed.
    if (!booking || booking.deletedAt || !contactMatches(parsed.data.contact, booking.guest))
      throw new ActionError("lookupFailed");
    await grantBookingAccess(booking.reference);
    redirect(`/booking/${booking.reference}`);
  });
}
