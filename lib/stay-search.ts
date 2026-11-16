import { addDays, dayKey, isDayString, nightsBetween, parseDay, todayIST } from "@/lib/utils";
import type { BookingRules } from "@/types/content";

export type StayParams = {
  checkIn?: string | null;
  checkOut?: string | null;
  rooms?: string | number | null;
  guests?: string | number | null;
};
export type Stay = { checkIn: Date; checkOut: Date; nights: number; rooms: number; guests: number };
export type StayResult = { ok: true; stay: Stay } | { ok: false; error: string };

/** One place that decides whether a requested stay is acceptable, shared by the page, the API and the booking engine. */
export function parseStay(params: StayParams, rules: BookingRules): StayResult {
  if (!isDayString(params.checkIn) || !isDayString(params.checkOut))
    return { ok: false, error: "Choose a check-in and check-out date." };
  const checkIn = parseDay(params.checkIn);
  const checkOut = parseDay(params.checkOut);
  const today = todayIST();
  if (checkIn < today) return { ok: false, error: "Check-in cannot be in the past." };
  if (checkOut <= checkIn) return { ok: false, error: "Check-out must be after check-in." };
  const nights = nightsBetween(checkIn, checkOut);
  if (nights > rules.maxNights)
    return {
      ok: false,
      error: `We take bookings of up to ${rules.maxNights} nights online. Call the front desk for longer stays.`,
    };
  if (checkIn > addDays(today, rules.advanceBookingDays))
    return { ok: false, error: `Bookings open up to ${rules.advanceBookingDays} days ahead.` };
  const rooms = Math.min(rules.maxRoomsPerBooking, Math.max(1, Number(params.rooms) || 1));
  const guests = Math.min(rules.maxRoomsPerBooking * 6, Math.max(1, Number(params.guests) || 2));
  return { ok: true, stay: { checkIn, checkOut, nights, rooms, guests } };
}

export const stayQuery = (stay: Pick<Stay, "checkIn" | "checkOut" | "rooms" | "guests">) =>
  new URLSearchParams({
    checkIn: dayKey(stay.checkIn),
    checkOut: dayKey(stay.checkOut),
    guests: String(stay.guests),
    rooms: String(stay.rooms),
  }).toString();
