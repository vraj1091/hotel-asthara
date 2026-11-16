import { loadPriceRules } from "@/lib/availability";
import { db } from "@/lib/db";
import { nightlyRate, ruleForNight } from "@/lib/pricing";
import { addDays, dayKey } from "@/lib/utils";

export type CalendarDay = { date: string; ratePaise: number | null; available: number };

/**
 * One entry per night from `from`: how many rooms are free and the lowest pre-tax rate among room types that
 * still have a room. Pass `roomTypeId` to get one room type's own rate and availability.
 * Four queries regardless of range length; the per-night maths happens in memory.
 */
export async function getCalendar(
  from: Date,
  days: number,
  roomTypeId?: string,
): Promise<CalendarDay[]> {
  const to = addDays(from, days);
  const now = new Date();
  const [rooms, taken, blocks, rules] = await Promise.all([
    db.room.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        roomType: { active: true, deletedAt: null, ...(roomTypeId ? { id: roomTypeId } : {}) },
      },
      select: { id: true, roomTypeId: true, roomType: { select: { baseRatePaise: true } } },
    }),
    db.bookingRoom.findMany({
      where: {
        active: true,
        checkIn: { lt: to },
        checkOut: { gt: from },
        booking: { deletedAt: null, OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
      },
      select: { roomId: true, checkIn: true, checkOut: true },
    }),
    db.roomBlock.findMany({
      where: { startDate: { lt: to }, endDate: { gt: from } },
      select: { roomId: true, roomTypeId: true, startDate: true, endDate: true },
    }),
    loadPriceRules(roomTypeId),
  ]);

  const staysByRoom = new Map<string, { checkIn: Date; checkOut: Date }[]>();
  for (const t of taken) {
    const list = staysByRoom.get(t.roomId) ?? [];
    list.push(t);
    staysByRoom.set(t.roomId, list);
  }
  const baseByType = new Map(rooms.map((r) => [r.roomTypeId, r.roomType.baseRatePaise]));

  const out: CalendarDay[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    const freeByType = new Map<string, number>();
    for (const room of rooms) {
      const booked = staysByRoom.get(room.id)?.some((s) => s.checkIn <= d && d < s.checkOut);
      const blocked = blocks.some(
        (b) =>
          b.startDate <= d &&
          d < b.endDate &&
          (b.roomId === room.id || (b.roomId === null && b.roomTypeId === room.roomTypeId)),
      );
      if (!booked && !blocked)
        freeByType.set(room.roomTypeId, (freeByType.get(room.roomTypeId) ?? 0) + 1);
    }
    let available = 0;
    let ratePaise: number | null = null;
    for (const [typeId, free] of freeByType) {
      available += free;
      const rate = nightlyRate(baseByType.get(typeId) ?? 0, ruleForNight(d, typeId, rules));
      if (ratePaise === null || rate < ratePaise) ratePaise = rate;
    }
    out.push({ date: dayKey(d), ratePaise, available });
  }
  return out;
}
