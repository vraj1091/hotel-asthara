import { NextResponse } from "next/server";
import { z } from "zod";
import { getAvailability, quoteRoomType } from "@/lib/availability";
import { db } from "@/lib/db";
import { clientIp, LIMITS, rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { parseStay } from "@/lib/stay-search";

const query = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  checkIn: z.string(),
  checkOut: z.string(),
  rooms: z.string().optional(),
  guests: z.string().optional(),
});

/** Live availability + price for one room type and a set of dates. Read-only, so no CSRF concern. */
export async function GET(request: Request) {
  const limit = await rateLimit("availability", clientIp(request.headers), LIMITS.availability);
  if (!limit.ok)
    return NextResponse.json({ error: "Too many requests. Wait a moment." }, { status: 429 });

  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const settings = await getSettings();
  const result = parseStay(parsed.data, settings.booking);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const { stay } = result;

  const room = await db.roomType.findFirst({
    where: { slug: parsed.data.slug, active: true, deletedAt: null },
  });
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const availability = (
    await getAvailability(stay.checkIn, stay.checkOut, { roomTypeId: room.id })
  ).get(room.id);
  const quote = await quoteRoomType({
    roomTypeId: room.id,
    baseRatePaise: room.baseRatePaise,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    gst: settings.gst,
  });

  return NextResponse.json(
    {
      nights: stay.nights,
      roomsWanted: stay.rooms,
      available: availability?.available ?? 0,
      total: availability?.total ?? 0,
      perRoom: {
        subtotalPaise: quote.subtotalPaise,
        taxPaise: quote.taxPaise,
        totalPaise: quote.totalPaise,
        averageRatePaise: quote.averageRatePaise,
        rules: [...new Set(quote.nights.map((n) => n.rule).filter(Boolean))],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
