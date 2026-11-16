"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, type ActionResult } from "@/lib/action";
import {
  adminAction,
  formObject,
  zCheckbox,
  zDayString,
  zInt,
  zOptionalRupees,
  zRupees,
} from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import {
  changeBookingStatus,
  changeStay,
  createBooking,
  paidPaise,
  quoteSelection,
  roomsForStay,
  type RoomForStay,
  type SelectionQuote,
} from "@/lib/booking-engine";
import { sendBookingEmails, sendCancellationEmails } from "@/lib/booking-notify";
import { db } from "@/lib/db";
import { getRazorpayConfig, refundRazorpayPayment } from "@/lib/razorpay";
import { zEmail, zMobile, zOptionalText, zText } from "@/lib/sanitize";
import { requireAction } from "@/lib/session";
import { isDayString, parseDay } from "@/lib/utils";

const zId = z.string().min(1).max(40);
const revalidate = (id?: string) => {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/bookings/calendar");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/bookings/${id}`);
};

/* ───────── Read helpers for the client forms ───────── */

function stayDates(checkIn: string, checkOut: string) {
  if (!isDayString(checkIn) || !isDayString(checkOut)) throw new ActionError("Choose valid dates.");
  const a = parseDay(checkIn);
  const b = parseDay(checkOut);
  if (b <= a) throw new ActionError("Check-out must be after check-in.");
  if ((b.getTime() - a.getTime()) / 86_400_000 > 90) throw new ActionError("Stays are limited to 90 nights.");
  return { checkIn: a, checkOut: b };
}

export async function loadRoomsForStay(args: {
  checkIn: string;
  checkOut: string;
  excludeBookingId?: string;
}): Promise<ActionResult<RoomForStay[]>> {
  return adminAction("bookings:write", async () => {
    const { checkIn, checkOut } = stayDates(args.checkIn, args.checkOut);
    return roomsForStay(checkIn, checkOut, { excludeBookingId: args.excludeBookingId });
  });
}

export async function previewQuote(args: {
  checkIn: string;
  checkOut: string;
  roomIds: string[];
  ratePaise?: number | null;
  couponCode?: string;
  discountPaise?: number | null;
}): Promise<ActionResult<SelectionQuote>> {
  return adminAction("bookings:write", async () => {
    const { checkIn, checkOut } = stayDates(args.checkIn, args.checkOut);
    if (!args.roomIds.length) throw new ActionError("Choose at least one room.");
    return quoteSelection({
      checkIn,
      checkOut,
      roomIds: args.roomIds.slice(0, 30),
      rateOverridePaise: args.ratePaise ?? null,
      couponCode: args.couponCode?.slice(0, 40) ?? null,
      manualDiscountPaise: args.discountPaise ?? null,
    });
  });
}

export type GuestMatch = { id: string; name: string; phone: string; email: string | null; city: string | null; bookings: number };

export async function searchGuests(q: string): Promise<ActionResult<GuestMatch[]>> {
  return adminAction("bookings:write", async () => {
    const term = q.trim().slice(0, 60);
    if (term.length < 3) return [];
    const digits = term.replace(/\D/g, "");
    const rows = await db.guest.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          { name: { contains: term, mode: "insensitive" as const } },
          { email: { contains: term, mode: "insensitive" as const } },
        ],
      },
      include: { _count: { select: { bookings: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    });
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phone,
      email: g.email,
      city: g.city,
      bookings: g._count.bookings,
    }));
  });
}

/* ───────── Create (walk-in / phone) ───────── */

const optionalEmail = z.union([zEmail, z.literal("")]).optional();
const newSchema = z
  .object({
    checkIn: zDayString,
    checkOut: zDayString,
    adults: zInt(1, 40),
    children: zInt(0, 40),
    roomIds: z.array(zId).min(1, "Choose at least one room.").max(30),
    guestId: z.string().max(40).optional(),
    name: zText(2, 100),
    phone: zMobile,
    email: optionalEmail,
    city: zOptionalText(80),
    idType: z.enum(["AADHAAR", "PASSPORT", "DRIVING_LICENCE", "VOTER_ID", "OTHER_GOVT_ID", ""]).optional(),
    idNumber: z
      .string()
      .trim()
      .max(30)
      .regex(/^[A-Za-z0-9 -]*$/, "Use letters and numbers only.")
      .optional(),
    source: z.enum(["WALK_IN", "PHONE", "WHATSAPP", "OTHER"]),
    status: z.enum(["CONFIRMED", "CHECKED_IN"]),
    rate: zOptionalRupees,
    couponCode: z.string().trim().max(40).optional(),
    discount: zOptionalRupees,
    payMethod: z.enum(["", "CASH", "UPI", "CARD", "BANK_TRANSFER"]).optional(),
    payAmount: zOptionalRupees,
    payNote: zOptionalText(200),
    specialRequests: zOptionalText(1000),
    internalNotes: zOptionalText(1000),
    sendEmail: zCheckbox,
  })
  .superRefine((v, ctx) => {
    if (v.checkOut <= v.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in." });
    if (v.idNumber && !v.idType) ctx.addIssue({ code: "custom", path: ["idType"], message: "Choose the ID type." });
    if (v.payAmount && !v.payMethod) ctx.addIssue({ code: "custom", path: ["payMethod"], message: "Choose how the guest paid." });
    if (v.sendEmail && !v.email) ctx.addIssue({ code: "custom", path: ["email"], message: "Add an email address to send a confirmation." });
  });

export async function createWalkInBooking(_prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const result = await adminAction("bookings:write", async (staff) => {
    const raw = { ...formObject(formData), roomIds: formData.getAll("roomIds").map(String) };
    const input = newSchema.parse(raw);
    if (input.payAmount) await requireAction("payments:write");
    const booking = await createBooking({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      selection: { roomIds: input.roomIds },
      guest: {
        id: input.guestId || null,
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        city: input.city ?? null,
        idType: input.idType || null,
        idNumber: input.idNumber || null,
      },
      couponCode: input.couponCode || null,
      manualDiscountPaise: input.discount,
      paymentMethod: input.payMethod || "PAY_AT_HOTEL",
      status: input.status,
      source: input.source,
      specialRequests: input.specialRequests ?? null,
      internalNotes: input.internalNotes ?? null,
      rateOverridePaise: input.rate,
      userId: staff.id,
    });
    if (input.payAmount && input.payMethod) {
      await db.payment.create({
        data: {
          bookingId: booking.id,
          method: input.payMethod,
          status: "PAID",
          amountPaise: Math.min(input.payAmount, booking.totalPaise),
          note: input.payNote ?? "Taken at booking",
          receivedById: staff.id,
          paidAt: new Date(),
        },
      });
    }
    await writeAudit({
      userId: staff.id,
      action: "booking.create",
      entity: "Booking",
      entityId: booking.id,
      meta: { reference: booking.reference, source: input.source, status: input.status, rooms: booking.rooms.map((r) => r.room.number) },
    });
    if (input.sendEmail) await sendBookingEmails(booking.id);
    revalidate(booking.id);
    return { id: booking.id };
  });
  if (result.ok) redirect(`/admin/bookings/${result.data.id}?created=1`);
  return result;
}

/* ───────── Status ───────── */

const statusSchema = z.object({ id: zId, to: z.enum(["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"]) });
const STATUS_MESSAGE = {
  CONFIRMED: "Booking confirmed.",
  CHECKED_IN: "Guest checked in.",
  CHECKED_OUT: "Guest checked out.",
  NO_SHOW: "Marked as no-show. The rooms are free again.",
} as const;

export async function setBookingStatus(formData: FormData) {
  const peek = statusSchema.safeParse(formObject(formData));
  return adminAction("bookings:write", async (staff) => {
    const { id, to } = statusSchema.parse(formObject(formData));
    const before = await db.booking.findUnique({ where: { id }, select: { status: true } });
    await changeBookingStatus(id, to);
    await writeAudit({ userId: staff.id, action: `booking.${to.toLowerCase()}`, entity: "Booking", entityId: id, meta: { from: before?.status, to } });
    revalidate(id);
  }, peek.success ? STATUS_MESSAGE[peek.data.to] : undefined);
}

const cancelSchema = z.object({ id: zId, reason: zOptionalText(500), notify: zCheckbox });

export async function cancelBooking(formData: FormData) {
  return adminAction("bookings:cancel", async (staff) => {
    const input = cancelSchema.parse(formObject(formData));
    await changeBookingStatus(input.id, "CANCELLED", { reason: input.reason ?? null });
    await writeAudit({ userId: staff.id, action: "booking.cancel", entity: "Booking", entityId: input.id, meta: { reason: input.reason ?? null, notified: input.notify } });
    if (input.notify) await sendCancellationEmails(input.id, false);
    revalidate(input.id);
  }, "Booking cancelled. The rooms are free again.");
}

/* ───────── Payments ───────── */

const paymentSchema = z.object({
  id: zId,
  kind: z.enum(["payment", "refund"]),
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "RAZORPAY"]),
  amount: zRupees(1, 10_000_000),
  note: zOptionalText(200),
});

export async function recordPayment(_prev: unknown, formData: FormData) {
  return adminAction("payments:write", async (staff) => {
    const input = paymentSchema.parse(formObject(formData));
    const booking = await db.booking.findFirst({ where: { id: input.id, deletedAt: null }, include: { payments: true } });
    if (!booking) throw new ActionError("That booking no longer exists.");
    const paid = paidPaise(booking.payments);
    if (input.kind === "refund" && input.amount > paid)
      throw new ActionError("You cannot refund more than has been paid.", { amount: [`At most ₹${(paid / 100).toLocaleString("en-IN")}.`] });
    await db.payment.create({
      data: {
        bookingId: booking.id,
        method: input.method,
        status: input.kind === "refund" ? "REFUNDED" : "PAID",
        amountPaise: input.amount,
        note: input.note ?? null,
        receivedById: staff.id,
        paidAt: new Date(),
      },
    });
    await writeAudit({
      userId: staff.id,
      action: input.kind === "refund" ? "booking.refund" : "booking.payment",
      entity: "Booking",
      entityId: booking.id,
      meta: { method: input.method, amountPaise: input.amount },
    });
    revalidate(booking.id);
  }, formData.get("kind") === "refund" ? "Refund recorded." : "Payment recorded.");
}

export async function refundViaRazorpay(formData: FormData) {
  return adminAction("payments:write", async (staff) => {
    const { paymentId } = z.object({ paymentId: zId }).parse(formObject(formData));
    const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { booking: { include: { payments: true } } } });
    if (!payment || payment.status !== "PAID" || !payment.razorpayPaymentId)
      throw new ActionError("Only a completed Razorpay payment can be refunded online.");
    const cfg = await getRazorpayConfig();
    if (!cfg) throw new ActionError("Razorpay keys are not configured. Refund in the Razorpay dashboard and record it manually.");
    const refunded = payment.booking.payments
      .filter((p) => p.status === "REFUNDED" && p.note?.includes(payment.razorpayPaymentId!))
      .reduce((s, p) => s + p.amountPaise, 0);
    const amount = payment.amountPaise - refunded;
    if (amount <= 0) throw new ActionError("This payment has already been refunded.");
    let refundId: string;
    try {
      ({ refundId } = await refundRazorpayPayment(cfg, payment.razorpayPaymentId, amount));
    } catch (e) {
      throw new ActionError(e instanceof Error ? e.message : "Razorpay refused the refund.");
    }
    await db.payment.create({
      data: {
        bookingId: payment.bookingId,
        method: "RAZORPAY",
        status: "REFUNDED",
        amountPaise: amount,
        note: `Razorpay refund ${refundId} for ${payment.razorpayPaymentId}`,
        receivedById: staff.id,
        paidAt: new Date(),
      },
    });
    await writeAudit({ userId: staff.id, action: "booking.refund_razorpay", entity: "Booking", entityId: payment.bookingId, meta: { refundId, amountPaise: amount } });
    revalidate(payment.bookingId);
  }, "Refund sent through Razorpay.");
}

/* ───────── Edits ───────── */

const staySchema = z
  .object({
    id: zId,
    checkIn: zDayString,
    checkOut: zDayString,
    roomIds: z.array(zId).min(1, "Choose at least one room.").max(30),
    rate: zOptionalRupees,
  })
  .refine((v) => v.checkOut > v.checkIn, { path: ["checkOut"], message: "Check-out must be after check-in." });

export async function updateStay(_prev: unknown, formData: FormData) {
  return adminAction("bookings:write", async (staff) => {
    const input = staySchema.parse({ ...formObject(formData), roomIds: formData.getAll("roomIds").map(String) });
    const before = await db.booking.findUnique({ where: { id: input.id }, include: { rooms: { include: { room: true } } } });
    await changeStay(input.id, { checkIn: input.checkIn, checkOut: input.checkOut, roomIds: input.roomIds, rateOverridePaise: input.rate });
    await writeAudit({
      userId: staff.id,
      action: "booking.change_stay",
      entity: "Booking",
      entityId: input.id,
      meta: {
        from: before ? { checkIn: before.checkIn, checkOut: before.checkOut, rooms: before.rooms.map((r) => r.room.number), totalPaise: before.totalPaise } : null,
        rate: input.rate,
      },
    });
    revalidate(input.id);
  }, "Stay updated and re-priced.");
}

const guestSchema = z.object({
  id: zId,
  name: zText(2, 100),
  phone: zMobile,
  email: optionalEmail,
  city: zOptionalText(80),
  adults: zInt(1, 40),
  children: zInt(0, 40),
});

export async function updateBookingGuest(_prev: unknown, formData: FormData) {
  return adminAction("bookings:write", async (staff) => {
    const input = guestSchema.parse(formObject(formData));
    const booking = await db.booking.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!booking) throw new ActionError("That booking no longer exists.");
    await db.$transaction([
      db.guest.update({
        where: { id: booking.guestId },
        data: { name: input.name, phone: input.phone, email: input.email || null, city: input.city ?? null },
      }),
      db.booking.update({ where: { id: booking.id }, data: { adults: input.adults, children: input.children } }),
    ]);
    await writeAudit({ userId: staff.id, action: "booking.edit_guest", entity: "Booking", entityId: booking.id });
    revalidate(booking.id);
  }, "Guest details saved.");
}

const notesSchema = z.object({ id: zId, specialRequests: zOptionalText(1000), internalNotes: zOptionalText(2000) });

export async function updateBookingNotes(_prev: unknown, formData: FormData) {
  return adminAction("bookings:write", async (staff) => {
    const input = notesSchema.parse(formObject(formData));
    await db.booking.update({
      where: { id: input.id },
      data: { specialRequests: input.specialRequests ?? null, internalNotes: input.internalNotes ?? null },
    });
    await writeAudit({ userId: staff.id, action: "booking.edit_notes", entity: "Booking", entityId: input.id });
    revalidate(input.id);
  }, "Notes saved.");
}

export async function resendConfirmation(formData: FormData) {
  return adminAction("bookings:write", async (staff) => {
    const { id } = z.object({ id: zId }).parse(formObject(formData));
    const booking = await db.booking.findUnique({ where: { id }, include: { guest: true } });
    if (!booking) throw new ActionError("That booking no longer exists.");
    if (!booking.guest.email) throw new ActionError("This guest has no email address. Add one under Guest first.");
    if (["CANCELLED", "NO_SHOW"].includes(booking.status)) throw new ActionError("This booking is not active.");
    await sendBookingEmails(id);
    const last = await db.emailLog.findFirst({ where: { bookingId: id, kind: "booking.guest" }, orderBy: { createdAt: "desc" } });
    await writeAudit({ userId: staff.id, action: "booking.resend_email", entity: "Booking", entityId: id, meta: { status: last?.status ?? null } });
    revalidate(id);
    if (last?.status === "SKIPPED") throw new ActionError("Email sending is not set up (RESEND_API_KEY), so nothing was sent. The attempt is in the email log.");
    if (last?.status === "FAILED") throw new ActionError("The email could not be sent. See the email log below.");
  }, "Confirmation email sent.");
}
