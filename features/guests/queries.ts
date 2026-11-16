import "server-only";
import type { Prisma } from "@prisma/client";

/** Bookings that count as real stays (or confirmed future stays) for "stays" and "total spent". */
export const SPEND_STATUSES = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const;

export function guestSearchWhere(q?: string): Prisma.GuestWhereInput {
  const term = q?.trim().slice(0, 100);
  if (!term) return { deletedAt: null };
  const digits = term.replace(/\D/g, "");
  return {
    deletedAt: null,
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { city: { contains: term, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ],
  };
}

export function summarize(bookings: { status: string; checkIn: Date; totalPaise: number }[]) {
  const counted = bookings.filter((b) => (SPEND_STATUSES as readonly string[]).includes(b.status));
  return {
    stays: counted.length,
    spentPaise: counted.reduce((s, b) => s + b.totalPaise, 0),
    lastStay: counted.reduce<Date | null>((d, b) => (!d || b.checkIn > d ? b.checkIn : d), null),
  };
}
