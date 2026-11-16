import "server-only";
import { db } from "@/lib/db";
import { releaseExpiredHolds } from "@/lib/booking-engine";
import { addDays, dayKey, todayIST } from "@/lib/utils";

/** Calendar day in India for a timestamp, as "YYYY-MM-DD". */
export const istDayKey = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/** UTC instant of 00:00 IST on a calendar day (UTC-midnight Date). */
const istMidnight = (day: Date) => new Date(day.getTime() - 330 * 60_000);

const LIVE_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const;

export async function getTodayLists() {
  await releaseExpiredHolds();
  const today = todayIST();
  const include = {
    guest: { select: { id: true, name: true, phone: true } },
    rooms: { select: { room: { select: { number: true } }, roomType: { select: { name: true } } } },
  } as const;
  const [arrivals, departures, inHouse] = await Promise.all([
    db.booking.findMany({
      where: { deletedAt: null, checkIn: today, status: { in: ["PENDING", "CONFIRMED"] } },
      include,
      orderBy: { createdAt: "asc" },
    }),
    db.booking.findMany({
      where: { deletedAt: null, checkOut: today, status: "CHECKED_IN" },
      include,
      orderBy: { createdAt: "asc" },
    }),
    db.booking.count({ where: { deletedAt: null, status: "CHECKED_IN" } }),
  ]);
  return { today, arrivals, departures, inHouse };
}

/** Occupied rooms per night for `days` nights starting today, against the number of sellable rooms. */
export async function getOccupancy(days = 14) {
  const today = todayIST();
  const end = addDays(today, days);
  const [totalRooms, rows] = await Promise.all([
    db.room.count({
      where: { deletedAt: null, status: "ACTIVE", roomType: { active: true, deletedAt: null } },
    }),
    db.bookingRoom.findMany({
      where: {
        active: true,
        checkIn: { lt: end },
        checkOut: { gt: today },
        booking: { deletedAt: null, status: { in: [...LIVE_STATUSES] } },
      },
      select: { roomId: true, checkIn: true, checkOut: true },
    }),
  ]);
  const series = Array.from({ length: days }, (_, i) => {
    const night = addDays(today, i);
    const occupied = new Set(rows.filter((r) => r.checkIn <= night && r.checkOut > night).map((r) => r.roomId)).size;
    return {
      day: dayKey(night),
      occupied,
      percent: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0,
    };
  });
  return { totalRooms, series };
}

/** Money actually received (PAID minus REFUNDED), grouped by the IST day it was paid. */
export async function getRevenue(days = 30) {
  const today = todayIST();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
  const weekStart = addDays(today, -dow);
  const seriesStart = addDays(today, -(days - 1));
  const from = [monthStart, weekStart, seriesStart].reduce((a, b) => (a < b ? a : b));
  const payments = await db.payment.findMany({
    where: {
      status: { in: ["PAID", "REFUNDED"] },
      paidAt: { gte: istMidnight(from) },
      booking: { deletedAt: null },
    },
    select: { amountPaise: true, status: true, paidAt: true, updatedAt: true },
  });
  const byDay = new Map<string, number>();
  for (const p of payments) {
    const key = istDayKey(p.paidAt ?? p.updatedAt);
    const signed = p.status === "PAID" ? p.amountPaise : -p.amountPaise;
    byDay.set(key, (byDay.get(key) ?? 0) + signed);
  }
  const sumFrom = (start: Date) => {
    const s = dayKey(start);
    const t = dayKey(today);
    let total = 0;
    for (const [k, v] of byDay) if (k >= s && k <= t) total += v;
    return total;
  };
  const series = Array.from({ length: days }, (_, i) => {
    const d = dayKey(addDays(seriesStart, i));
    return { day: d, paise: byDay.get(d) ?? 0 };
  });
  return {
    todayPaise: byDay.get(dayKey(today)) ?? 0,
    weekPaise: sumFrom(weekStart),
    monthPaise: sumFrom(monthStart),
    series,
  };
}

export async function getRecentBookings(take = 8) {
  return db.booking.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    include: { guest: { select: { name: true } }, payments: { select: { status: true, amountPaise: true } } },
  });
}

export async function getEnquirySummary(take = 5) {
  const [pending, latest] = await Promise.all([
    db.enquiry.count({ where: { deletedAt: null, status: { in: ["NEW", "IN_PROGRESS"] } } }),
    db.enquiry.findMany({
      where: { deletedAt: null, status: { in: ["NEW", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);
  return { pending, latest };
}
