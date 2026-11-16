import { db } from "@/lib/db";
import { quoteStay, type PriceRuleInput, type StayQuote } from "@/lib/pricing";
import type { GstSettings } from "@/types/content";

export type TypeAvailability = {
  roomTypeId: string;
  total: number;
  available: number;
  roomIds: string[];
};

/** A booking row blocks a room unless it is an unpaid online booking whose hold has expired. */
function blockingBookingFilter(now: Date) {
  return {
    deletedAt: null,
    OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }],
  };
}

/**
 * Free rooms per room type for a stay. A room is free when it has no active booking overlapping
 * [checkIn, checkOut) and no block (on the room or its whole type) overlapping the same dates.
 * Pass `tx` to run inside a transaction (the booking engine does).
 */
export async function getAvailability(
  checkIn: Date,
  checkOut: Date,
  opts: { roomTypeId?: string; tx?: Pick<typeof db, "room">; excludeBookingId?: string } = {},
): Promise<Map<string, TypeAvailability>> {
  const client = opts.tx ?? db;
  const now = new Date();
  const rooms = await client.room.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      roomType: {
        active: true,
        deletedAt: null,
        ...(opts.roomTypeId ? { id: opts.roomTypeId } : {}),
      },
    },
    select: {
      id: true,
      roomTypeId: true,
      roomType: {
        select: {
          blocks: {
            where: { startDate: { lt: checkOut }, endDate: { gt: checkIn }, roomId: null },
            select: { id: true },
            take: 1,
          },
        },
      },
      blocks: {
        where: { startDate: { lt: checkOut }, endDate: { gt: checkIn } },
        select: { id: true },
        take: 1,
      },
      bookingRooms: {
        where: {
          active: true,
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
          booking: blockingBookingFilter(now),
          ...(opts.excludeBookingId ? { bookingId: { not: opts.excludeBookingId } } : {}),
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { number: "asc" },
  });

  const result = new Map<string, TypeAvailability>();
  for (const room of rooms) {
    const entry = result.get(room.roomTypeId) ?? {
      roomTypeId: room.roomTypeId,
      total: 0,
      available: 0,
      roomIds: [],
    };
    entry.total += 1;
    const typeBlocked = room.roomType.blocks.length > 0;
    if (!typeBlocked && room.blocks.length === 0 && room.bookingRooms.length === 0) {
      entry.available += 1;
      entry.roomIds.push(room.id);
    }
    result.set(room.roomTypeId, entry);
  }
  return result;
}

export async function loadPriceRules(roomTypeId?: string): Promise<PriceRuleInput[]> {
  const rows = await db.priceRule.findMany({
    where: { active: true, ...(roomTypeId ? { OR: [{ roomTypeId }, { roomTypeId: null }] } : {}) },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    adjustment: r.adjustment,
    value: r.value,
    startDate: r.startDate,
    endDate: r.endDate,
    daysOfWeek: r.daysOfWeek,
    priority: r.priority,
    roomTypeId: r.roomTypeId,
  }));
}

export async function quoteRoomType(args: {
  roomTypeId: string;
  baseRatePaise: number;
  checkIn: Date;
  checkOut: Date;
  gst: GstSettings;
}): Promise<StayQuote> {
  const rules = await loadPriceRules(args.roomTypeId);
  return quoteStay({ ...args, rules });
}
