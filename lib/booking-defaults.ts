import { addDays, dayKey, isDayString, todayIST } from "@/lib/utils";
import type { BookingDefaults } from "@/components/sections/booking-bar";

/** Default dates for the booking bar: tonight, one night. Search params override. */
export function bookingDefaults(params?: {
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  rooms?: string;
}): BookingDefaults {
  const today = todayIST();
  const inDay =
    isDayString(params?.checkIn) && params!.checkIn! >= dayKey(today)
      ? params!.checkIn!
      : dayKey(today);
  const outFallback = dayKey(addDays(new Date(`${inDay}T00:00:00Z`), 1));
  const outDay =
    isDayString(params?.checkOut) && params!.checkOut! > inDay ? params!.checkOut! : outFallback;
  const guests = Math.min(8, Math.max(1, Number(params?.guests) || 2));
  const rooms = Math.min(4, Math.max(1, Number(params?.rooms) || 1));
  return { today: dayKey(today), checkIn: inDay, checkOut: outDay, guests, rooms };
}
