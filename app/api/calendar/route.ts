import { NextResponse } from "next/server";
import { z } from "zod";
import { getCalendar } from "@/lib/calendar";
import { db } from "@/lib/db";
import { clientIp, LIMITS, rateLimit } from "@/lib/rate-limit";
import { zDay } from "@/lib/sanitize";
import { getSettings } from "@/lib/settings";
import { addDays, parseDay, todayIST } from "@/lib/utils";

const query = z.object({
  from: zDay,
  days: z.coerce.number().int().min(1).max(95).default(62),
  slug: z
    .string()
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

/** Nightly price and availability for the date picker. Read-only. */
export async function GET(request: Request) {
  const limit = await rateLimit("calendar", clientIp(request.headers), LIMITS.availability);
  if (!limit.ok)
    return NextResponse.json({ error: "Too many requests. Wait a moment." }, { status: 429 });

  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const settings = await getSettings();
  const today = todayIST();
  const horizon = addDays(today, settings.booking.advanceBookingDays + settings.booking.maxNights);
  let from = parseDay(parsed.data.from);
  if (from < today) from = today;
  if (from >= horizon) return NextResponse.json({ days: [] });
  const days = Math.min(
    parsed.data.days,
    Math.round((horizon.getTime() - from.getTime()) / 86_400_000),
  );

  let roomTypeId: string | undefined;
  if (parsed.data.slug) {
    const room = await db.roomType.findFirst({
      where: { slug: parsed.data.slug, active: true, deletedAt: null },
      select: { id: true },
    });
    if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
    roomTypeId = room.id;
  }

  return NextResponse.json(
    { days: await getCalendar(from, days, roomTypeId) },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
