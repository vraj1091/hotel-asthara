import { cache } from "react";
import { getRoomTypes } from "@/features/rooms/queries";
import { getAvailability, loadPriceRules } from "@/lib/availability";
import { nightlyRate, ruleForNight } from "@/lib/pricing";
import { addDays, dayKey, todayIST } from "@/lib/utils";

export type Tonight = {
  date: string;
  nextDate: string;
  free: number;
  minRatePaise: number | null;
  byType: Record<string, { free: number; ratePaise: number }>;
};

/** Live picture of tonight: free rooms and tonight's rate per room type. One set of queries per request. */
export const getTonight = cache(async (): Promise<Tonight | null> => {
  try {
    const today = todayIST();
    const tomorrow = addDays(today, 1);
    const [availability, rooms, rules] = await Promise.all([
      getAvailability(today, tomorrow),
      getRoomTypes(),
      loadPriceRules(),
    ]);
    const byType: Tonight["byType"] = {};
    let free = 0;
    let minRatePaise: number | null = null;
    for (const room of rooms) {
      const left = availability.get(room.id)?.available ?? 0;
      const ratePaise = nightlyRate(room.baseRatePaise, ruleForNight(today, room.id, rules));
      byType[room.id] = { free: left, ratePaise };
      free += left;
      if (left > 0 && (minRatePaise === null || ratePaise < minRatePaise)) minRatePaise = ratePaise;
    }
    return { date: dayKey(today), nextDate: dayKey(tomorrow), free, minRatePaise, byType };
  } catch (error) {
    console.error("[tonight] could not load live availability:", error);
    return null;
  }
});

export type Daypart = "dawn" | "day" | "dusk" | "night";

/** Time of day in Rohtak, used to light the hero window. */
export function daypartIST(now = new Date()): Daypart {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "dusk";
  return "night";
}

export function clockIST(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);
}
