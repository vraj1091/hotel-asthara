import "server-only";
import type { BookingSource, BookingStatus, IdType, PaymentMethod, Prisma } from "@prisma/client";
import { ActionError } from "@/lib/action";
import { getAvailability, loadPriceRules } from "@/lib/availability";
import { encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { applyDiscount, couponDiscount, gstPercentFor, quoteStay, type NightlyRate } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { addDays, dayKey, eachNight, nightsBetween, todayIST } from "@/lib/utils";

/**
 * The booking engine. Every booking, from the website or the front desk, goes through here.
 *
 * Double-booking protection has two layers:
 *  1. Each write runs in a transaction that first takes a transaction-scoped PostgreSQL advisory lock, then
 *     re-checks availability. Two guests clicking "Book" for the last room at the same moment are serialised and
 *     the second one gets a friendly "just sold out" message.
 *  2. prisma/sql/constraints.sql adds an exclusion constraint so the database itself rejects two active
 *     BookingRoom rows for the same room with overlapping dates, even if a bug slipped past layer 1.
 */

type Tx = Prisma.TransactionClient;
const LOCK_ID = 727_274; // any constant; one hotel, one inventory lock
const TX_OPTS = { maxWait: 10_000, timeout: 20_000 };

async function lockInventory(tx: Tx) {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_ID})`);
}

function isOverlapError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("booking_room_no_overlap") || msg.includes("exclusion constraint");
}

/* ───────── Expired online holds ───────── */

/** Unpaid online bookings whose hold has run out are cancelled and their rooms released. */
export async function releaseExpiredHolds(client: Tx | typeof db = db) {
  const expired = await client.booking.findMany({
    where: { status: "PENDING", holdExpiresAt: { lt: new Date() }, deletedAt: null },
    select: { id: true, couponId: true },
  });
  if (expired.length === 0) return 0;
  const ids = expired.map((b) => b.id);
  await client.bookingRoom.updateMany({ where: { bookingId: { in: ids } }, data: { active: false } });
  await client.booking.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "Online payment was not completed in time.",
      holdExpiresAt: null,
    },
  });
  await client.payment.updateMany({
    where: { bookingId: { in: ids }, status: "PENDING" },
    data: { status: "FAILED", note: "Hold expired before payment" },
  });
  for (const b of expired) {
    if (b.couponId)
      await client.coupon.updateMany({
        where: { id: b.couponId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
  }
  return ids.length;
}

/* ───────── Coupons ───────── */

export type CouponCheck =
  | { ok: true; couponId: string; code: string; discountPaise: number; label: string }
  | { ok: false; error: string };

export async function checkCoupon(
  client: Tx | typeof db,
  rawCode: string,
  ctx: { subtotalPaise: number; nights: number },
): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a promo code." };
  const now = new Date();
  const coupon = await client.coupon.findFirst({ where: { code, deletedAt: null } });
  if (!coupon || !coupon.active) return { ok: false, error: "That promo code is not valid." };
  if (coupon.startsAt && coupon.startsAt > now)
    return { ok: false, error: "That promo code is not active yet." };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, error: "That promo code has expired." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, error: "That promo code has been fully used." };
  if (ctx.nights < coupon.minNights)
    return {
      ok: false,
      error: `That promo code needs a stay of at least ${coupon.minNights} nights.`,
    };
  if (ctx.subtotalPaise < coupon.minAmountPaise)
    return {
      ok: false,
      error: `That promo code needs a booking of at least ₹${Math.round(coupon.minAmountPaise / 100).toLocaleString("en-IN")} before tax.`,
    };
  const discountPaise = couponDiscount(coupon, ctx.subtotalPaise);
  const label =
    coupon.kind === "PERCENT"
      ? `${coupon.value}% off`
      : `₹${Math.round(coupon.value / 100).toLocaleString("en-IN")} off`;
  return { ok: true, couponId: coupon.id, code: coupon.code, discountPaise, label };
}

/* ───────── References and invoice numbers ───────── */

const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I

function randomRef(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return s;
}

async function newReference(tx: Tx) {
  const d = dayKey(todayIST()).slice(2).replace(/-/g, ""); // 261116
  for (let i = 0; i < 8; i++) {
    const ref = `AST-${d}-${randomRef(4)}`;
    if (!(await tx.booking.findUnique({ where: { reference: ref }, select: { id: true } })))
      return ref;
  }
  return `AST-${d}-${randomRef(6)}`;
}

/** Indian financial year for a date: April–March, e.g. "2026-27". */
export function financialYear(date = todayIST()) {
  const y = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Gives a booking its GST invoice number the first time one is needed. Sequential per financial year. */
export async function ensureInvoiceNumber(bookingId: string) {
  const existing = await db.booking.findUnique({
    where: { id: bookingId },
    select: { invoiceNumber: true },
  });
  if (!existing) throw new ActionError("That booking no longer exists.");
  if (existing.invoiceNumber) return existing.invoiceNumber;
  const settings = await getSettings();
  const fy = financialYear();
  return db.$transaction(async (tx) => {
    const again = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { invoiceNumber: true },
    });
    if (again?.invoiceNumber) return again.invoiceNumber;
    const counter = await tx.counter.upsert({
      where: { key: `invoice:${fy}` },
      create: { key: `invoice:${fy}`, value: 1 },
      update: { value: { increment: 1 } },
    });
    const number = `${settings.gst.invoicePrefix || "INV"}/${fy}/${String(counter.value).padStart(4, "0")}`;
    await tx.booking.update({ where: { id: bookingId }, data: { invoiceNumber: number } });
    return number;
  }, TX_OPTS);
}

/* ───────── Pricing helpers ───────── */

type RoomPick = { id: string; roomTypeId: string; baseRatePaise: number; number: string };

function priceRoom(
  room: RoomPick,
  checkIn: Date,
  checkOut: Date,
  rules: Awaited<ReturnType<typeof loadPriceRules>>,
  gst: Awaited<ReturnType<typeof getSettings>>["gst"],
  rateOverridePaise?: number | null,
) {
  if (rateOverridePaise && rateOverridePaise > 0) {
    const nights: NightlyRate[] = eachNight(checkIn, checkOut).map((d) => ({
      date: dayKey(d),
      ratePaise: rateOverridePaise,
      taxPaise: Math.round((rateOverridePaise * gstPercentFor(rateOverridePaise, gst)) / 100),
      rule: "Front desk rate",
    }));
    const subtotalPaise = nights.reduce((s, n) => s + n.ratePaise, 0);
    const taxPaise = nights.reduce((s, n) => s + n.taxPaise, 0);
    return { nights, subtotalPaise, taxPaise };
  }
  const q = quoteStay({
    roomTypeId: room.roomTypeId,
    baseRatePaise: room.baseRatePaise,
    rules,
    checkIn,
    checkOut,
    gst,
  });
  return { nights: q.nights, subtotalPaise: q.subtotalPaise, taxPaise: q.taxPaise };
}

/* ───────── Create ───────── */

export type GuestInput = {
  id?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  idType?: IdType | null;
  idNumber?: string | null;
};

export type CreateBookingInput = {
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  selection: { roomTypeId: string; rooms: number } | { roomIds: string[] };
  guest: GuestInput;
  couponCode?: string | null;
  manualDiscountPaise?: number | null; // front desk only
  paymentMethod: PaymentMethod;
  status: "PENDING" | "CONFIRMED" | "CHECKED_IN";
  source: BookingSource;
  holdMinutes?: number | null; // online payment: rooms are held this long while the guest pays
  specialRequests?: string | null;
  internalNotes?: string | null;
  rateOverridePaise?: number | null; // front desk negotiated nightly rate, before GST
  userId?: string | null;
};

async function upsertGuest(tx: Tx, g: GuestInput) {
  const idData =
    g.idNumber && g.idType
      ? {
          idType: g.idType,
          idNumberEnc: encryptText(g.idNumber.trim()),
          idNumberLast4: g.idNumber.trim().slice(-4),
        }
      : {};
  if (g.id) {
    const found = await tx.guest.findFirst({ where: { id: g.id, deletedAt: null } });
    if (!found) throw new ActionError("That guest profile no longer exists.");
    return tx.guest.update({
      where: { id: g.id },
      data: {
        name: g.name,
        phone: g.phone,
        ...(g.email ? { email: g.email } : {}),
        ...(g.city ? { city: g.city } : {}),
        ...idData,
      },
    });
  }
  const existing = await tx.guest.findFirst({
    where: { phone: g.phone, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    return tx.guest.update({
      where: { id: existing.id },
      data: {
        name: g.name || existing.name,
        ...(g.email ? { email: g.email } : {}),
        ...(g.city ? { city: g.city } : {}),
        ...idData,
      },
    });
  }
  return tx.guest.create({
    data: {
      name: g.name,
      phone: g.phone,
      email: g.email || null,
      city: g.city || null,
      ...idData,
    },
  });
}

export async function createBooking(input: CreateBookingInput) {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights < 1) throw new ActionError("Check-out must be after check-in.");
  const settings = await getSettings();
  const rules = await loadPriceRules();

  try {
    return await db.$transaction(async (tx) => {
      await lockInventory(tx);
      await releaseExpiredHolds(tx);

      // Which physical rooms?
      let picks: RoomPick[];
      if ("roomIds" in input.selection) {
        const ids = [...new Set(input.selection.roomIds)];
        if (ids.length === 0) throw new ActionError("Choose at least one room.");
        const avail = await getAvailability(input.checkIn, input.checkOut, { tx });
        const free = new Set([...avail.values()].flatMap((a) => a.roomIds));
        const rooms = await tx.room.findMany({
          where: { id: { in: ids }, deletedAt: null },
          include: { roomType: true },
        });
        if (rooms.length !== ids.length) throw new ActionError("One of those rooms no longer exists.");
        const taken = rooms.filter((r) => !free.has(r.id));
        if (taken.length)
          throw new ActionError(
            `Room ${taken.map((r) => r.number).join(", ")} is not free for these dates.`,
          );
        picks = rooms.map((r) => ({
          id: r.id,
          roomTypeId: r.roomTypeId,
          baseRatePaise: r.roomType.baseRatePaise,
          number: r.number,
        }));
      } else {
        const { roomTypeId, rooms: count } = input.selection;
        const type = await tx.roomType.findFirst({
          where: { id: roomTypeId, active: true, deletedAt: null },
        });
        if (!type) throw new ActionError("That room is no longer offered. Choose another room.");
        const capacity = (type.maxAdults + type.maxChildren) * count;
        if (input.adults + input.children > capacity)
          throw new ActionError(
            `${count} ${type.name}${count > 1 ? "s" : ""} sleep${count > 1 ? "" : "s"} up to ${capacity} guests. Add a room or choose a larger room.`,
          );
        const avail = (
          await getAvailability(input.checkIn, input.checkOut, { roomTypeId, tx })
        ).get(roomTypeId);
        if (!avail || avail.available < count)
          throw new ActionError(
            avail && avail.available > 0
              ? `Only ${avail.available} ${type.name}${avail.available > 1 ? "s are" : " is"} left for these dates.`
              : "Sorry, this room has just sold out for these dates. Choose other dates or another room.",
          );
        const roomRows = await tx.room.findMany({
          where: { id: { in: avail.roomIds.slice(0, count) } },
          select: { id: true, number: true },
        });
        picks = roomRows.map((r) => ({
          id: r.id,
          roomTypeId,
          baseRatePaise: type.baseRatePaise,
          number: r.number,
        }));
      }

      const priced = picks.map((room) => ({
        room,
        ...priceRoom(room, input.checkIn, input.checkOut, rules, settings.gst, input.rateOverridePaise),
      }));
      const subtotal = priced.reduce((s, p) => s + p.subtotalPaise, 0);
      const tax = priced.reduce((s, p) => s + p.taxPaise, 0);

      let couponId: string | null = null;
      let couponCode: string | null = null;
      let discount = Math.max(0, input.manualDiscountPaise ?? 0);
      if (input.couponCode?.trim()) {
        const check = await checkCoupon(tx, input.couponCode, { subtotalPaise: subtotal, nights });
        if (!check.ok) throw new ActionError(check.error, { couponCode: [check.error] });
        // Atomic use: only succeeds while the limit has not been reached.
        const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: check.couponId } });
        const used = await tx.coupon.updateMany({
          where: {
            id: coupon.id,
            ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count === 0) throw new ActionError("That promo code has just been fully used.");
        couponId = coupon.id;
        couponCode = coupon.code;
        discount += check.discountPaise;
      }
      const totals = applyDiscount(subtotal, tax, discount);

      const guest = await upsertGuest(tx, input.guest);
      const now = new Date();
      const booking = await tx.booking.create({
        data: {
          reference: await newReference(tx),
          guestId: guest.id,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          nights,
          adults: input.adults,
          children: input.children,
          status: input.status,
          source: input.source,
          subtotalPaise: totals.subtotalPaise,
          discountPaise: totals.discountPaise,
          taxPaise: totals.taxPaise,
          totalPaise: totals.totalPaise,
          couponId,
          couponCode,
          paymentMethod: input.paymentMethod,
          specialRequests: input.specialRequests || null,
          internalNotes: input.internalNotes || null,
          holdExpiresAt:
            input.status === "PENDING" && input.holdMinutes
              ? new Date(now.getTime() + input.holdMinutes * 60_000)
              : null,
          confirmedAt: input.status !== "PENDING" ? now : null,
          checkedInAt: input.status === "CHECKED_IN" ? now : null,
          rooms: {
            create: priced.map((p) => ({
              roomId: p.room.id,
              roomTypeId: p.room.roomTypeId,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              nightlyRates: p.nights as unknown as Prisma.InputJsonValue,
              subtotalPaise: p.subtotalPaise,
              taxPaise: p.taxPaise,
            })),
          },
        },
        include: { guest: true, rooms: { include: { room: true, roomType: true } } },
      });
      return booking;
    }, TX_OPTS);
  } catch (error) {
    if (isOverlapError(error))
      throw new ActionError(
        "Sorry, that room was booked by someone else a moment ago. Choose other dates or another room.",
      );
    throw error;
  }
}

/* ───────── Status changes ───────── */

const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const nextStatuses = (s: BookingStatus) => ALLOWED[s];

export async function changeBookingStatus(
  bookingId: string,
  to: BookingStatus,
  opts: { reason?: string | null } = {},
) {
  return db.$transaction(async (tx) => {
    await lockInventory(tx);
    const booking = await tx.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
    if (!booking) throw new ActionError("That booking no longer exists.");
    if (booking.status === to) return booking;
    if (!ALLOWED[booking.status].includes(to))
      throw new ActionError(
        `A ${booking.status.toLowerCase().replace("_", " ")} booking cannot be changed to ${to.toLowerCase().replace("_", " ")}.`,
      );
    const now = new Date();
    const data: Prisma.BookingUpdateInput = { status: to };

    if (to === "CONFIRMED") {
      data.confirmedAt = now;
      data.holdExpiresAt = null;
    }
    if (to === "CHECKED_IN") {
      data.checkedInAt = now;
      data.holdExpiresAt = null;
      if (!booking.confirmedAt) data.confirmedAt = now;
    }
    if (to === "CHECKED_OUT") {
      data.checkedOutAt = now;
      // Leaving early frees the room for tonight; the bill is adjusted separately if needed.
      const today = todayIST();
      if (today < booking.checkOut) {
        const freeFrom = today > booking.checkIn ? today : addDays(booking.checkIn, 1);
        if (freeFrom < booking.checkOut)
          await tx.bookingRoom.updateMany({
            where: { bookingId, active: true },
            data: { checkOut: freeFrom },
          });
      }
    }
    if (to === "CANCELLED" || to === "NO_SHOW") {
      await tx.bookingRoom.updateMany({ where: { bookingId }, data: { active: false } });
      data.holdExpiresAt = null;
      if (to === "CANCELLED") {
        data.cancelledAt = now;
        data.cancelReason = opts.reason?.slice(0, 500) || null;
        if (booking.couponId)
          await tx.coupon.updateMany({
            where: { id: booking.couponId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
      }
      await tx.payment.updateMany({
        where: { bookingId, status: "PENDING" },
        data: { status: "FAILED", note: `Booking ${to === "CANCELLED" ? "cancelled" : "marked no-show"}` },
      });
    }
    return tx.booking.update({ where: { id: bookingId }, data });
  }, TX_OPTS);
}

/* ───────── Change dates or rooms (front desk) ───────── */

export async function changeStay(
  bookingId: string,
  args: { checkIn: Date; checkOut: Date; roomIds: string[]; rateOverridePaise?: number | null },
) {
  const nights = nightsBetween(args.checkIn, args.checkOut);
  if (nights < 1) throw new ActionError("Check-out must be after check-in.");
  const ids = [...new Set(args.roomIds)];
  if (ids.length === 0) throw new ActionError("Choose at least one room.");
  const settings = await getSettings();
  const rules = await loadPriceRules();
  try {
    return await db.$transaction(async (tx) => {
      await lockInventory(tx);
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, deletedAt: null },
        include: { coupon: true },
      });
      if (!booking) throw new ActionError("That booking no longer exists.");
      if (!["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status))
        throw new ActionError("Only upcoming or in-house bookings can be changed.");
      const avail = await getAvailability(args.checkIn, args.checkOut, {
        tx,
        excludeBookingId: bookingId,
      });
      const free = new Set([...avail.values()].flatMap((a) => a.roomIds));
      const rooms = await tx.room.findMany({
        where: { id: { in: ids }, deletedAt: null },
        include: { roomType: true },
      });
      if (rooms.length !== ids.length) throw new ActionError("One of those rooms no longer exists.");
      const taken = rooms.filter((r) => !free.has(r.id));
      if (taken.length)
        throw new ActionError(
          `Room ${taken.map((r) => r.number).join(", ")} is not free for the new dates.`,
        );
      const priced = rooms.map((r) => ({
        room: r,
        ...priceRoom(
          { id: r.id, roomTypeId: r.roomTypeId, baseRatePaise: r.roomType.baseRatePaise, number: r.number },
          args.checkIn,
          args.checkOut,
          rules,
          settings.gst,
          args.rateOverridePaise,
        ),
      }));
      const subtotal = priced.reduce((s, p) => s + p.subtotalPaise, 0);
      const tax = priced.reduce((s, p) => s + p.taxPaise, 0);
      const discount = booking.coupon ? couponDiscount(booking.coupon, subtotal) : booking.discountPaise;
      const totals = applyDiscount(subtotal, tax, discount);

      await tx.bookingRoom.deleteMany({ where: { bookingId } });
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          checkIn: args.checkIn,
          checkOut: args.checkOut,
          nights,
          subtotalPaise: totals.subtotalPaise,
          discountPaise: totals.discountPaise,
          taxPaise: totals.taxPaise,
          totalPaise: totals.totalPaise,
          rooms: {
            create: priced.map((p) => ({
              roomId: p.room.id,
              roomTypeId: p.room.roomTypeId,
              checkIn: args.checkIn,
              checkOut: args.checkOut,
              nightlyRates: p.nights as unknown as Prisma.InputJsonValue,
              subtotalPaise: p.subtotalPaise,
              taxPaise: p.taxPaise,
            })),
          },
        },
      });
    }, TX_OPTS);
  } catch (error) {
    if (isOverlapError(error))
      throw new ActionError("One of those rooms was just booked for these dates. Pick another room.");
    throw error;
  }
}

/* ───────── Money ───────── */

export function paidPaise(payments: { status: string; amountPaise: number }[]) {
  return payments.reduce(
    (sum, p) =>
      p.status === "PAID" ? sum + p.amountPaise : p.status === "REFUNDED" ? sum - p.amountPaise : sum,
    0,
  );
}

/** True while a guest may still cancel online without a charge. */
export function canGuestCancel(
  booking: { status: BookingStatus; checkIn: Date },
  freeCancelHours: number,
  checkInTime = "12:00",
) {
  if (!["PENDING", "CONFIRMED"].includes(booking.status)) return false;
  // The check-in moment in IST (UTC+5:30) on the check-in day.
  const [h = 12, m = 0] = checkInTime.split(":").map(Number);
  const checkInAt = booking.checkIn.getTime() + (h * 60 + m - 330) * 60_000;
  return checkInAt - Date.now() >= freeCancelHours * 3_600_000;
}

/* ───────── Front desk helpers (read-only) ───────── */

export type RoomForStay = {
  id: string;
  number: string;
  floor: number;
  status: "ACTIVE" | "MAINTENANCE";
  free: boolean;
  roomTypeId: string;
  roomTypeName: string;
  baseRatePaise: number;
  maxAdults: number;
  maxChildren: number;
};

/** Every room with whether it is free for the stay. `excludeBookingId` ignores that booking's own rooms (editing). */
export async function roomsForStay(
  checkIn: Date,
  checkOut: Date,
  opts: { excludeBookingId?: string } = {},
): Promise<RoomForStay[]> {
  const [avail, rooms] = await Promise.all([
    getAvailability(checkIn, checkOut, { excludeBookingId: opts.excludeBookingId }),
    db.room.findMany({
      where: { deletedAt: null, roomType: { deletedAt: null } },
      include: { roomType: true },
      orderBy: [{ roomType: { sortOrder: "asc" } }, { number: "asc" }],
    }),
  ]);
  const free = new Set([...avail.values()].flatMap((a) => a.roomIds));
  return rooms.map((r) => ({
    id: r.id,
    number: r.number,
    floor: r.floor,
    status: r.status,
    free: free.has(r.id),
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    baseRatePaise: r.roomType.baseRatePaise,
    maxAdults: r.roomType.maxAdults,
    maxChildren: r.roomType.maxChildren,
  }));
}

export type SelectionQuote = {
  nights: number;
  rooms: { roomId: string; number: string; roomTypeName: string; subtotalPaise: number; taxPaise: number }[];
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  coupon: { code: string; label: string } | null;
  couponError: string | null;
};

/** Price preview for specific rooms, using the same rules createBooking uses. Does not hold anything. */
export async function quoteSelection(args: {
  checkIn: Date;
  checkOut: Date;
  roomIds: string[];
  rateOverridePaise?: number | null;
  couponCode?: string | null;
  manualDiscountPaise?: number | null;
}): Promise<SelectionQuote> {
  const nights = nightsBetween(args.checkIn, args.checkOut);
  if (nights < 1) throw new ActionError("Check-out must be after check-in.");
  const [settings, rules, rooms] = await Promise.all([
    getSettings(),
    loadPriceRules(),
    db.room.findMany({
      where: { id: { in: [...new Set(args.roomIds)] }, deletedAt: null },
      include: { roomType: true },
      orderBy: { number: "asc" },
    }),
  ]);
  const priced = rooms.map((r) => ({
    r,
    ...priceRoom(
      { id: r.id, roomTypeId: r.roomTypeId, baseRatePaise: r.roomType.baseRatePaise, number: r.number },
      args.checkIn,
      args.checkOut,
      rules,
      settings.gst,
      args.rateOverridePaise,
    ),
  }));
  const subtotal = priced.reduce((s, p) => s + p.subtotalPaise, 0);
  const tax = priced.reduce((s, p) => s + p.taxPaise, 0);
  let discount = Math.max(0, args.manualDiscountPaise ?? 0);
  let coupon: SelectionQuote["coupon"] = null;
  let couponError: string | null = null;
  if (args.couponCode?.trim() && subtotal > 0) {
    const check = await checkCoupon(db, args.couponCode, { subtotalPaise: subtotal, nights });
    if (check.ok) {
      discount += check.discountPaise;
      coupon = { code: check.code, label: check.label };
    } else couponError = check.error;
  }
  const totals = applyDiscount(subtotal, tax, discount);
  return {
    nights,
    rooms: priced.map((p) => ({
      roomId: p.r.id,
      number: p.r.number,
      roomTypeName: p.r.roomType.name,
      subtotalPaise: p.subtotalPaise,
      taxPaise: p.taxPaise,
    })),
    ...totals,
    coupon,
    couponError,
  };
}
