import { NewBookingForm, type PrefillGuest } from "@/components/admin/bookings/new-booking-form";
import { AdminPageHeader } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { addDays, dayKey, isDayString, parseDay, todayIST } from "@/lib/utils";

export const metadata = { title: "New booking" };

type Search = Promise<{ guestId?: string; checkIn?: string; checkOut?: string; roomId?: string }>;

export default async function NewBookingPage({ searchParams }: { searchParams: Search }) {
  const staff = await requirePage("bookings:write");
  const params = await searchParams;
  const today = dayKey(todayIST());
  const checkIn = isDayString(params.checkIn) && params.checkIn >= today ? params.checkIn : today;
  const checkOut =
    isDayString(params.checkOut) && params.checkOut > checkIn ? params.checkOut : dayKey(addDays(parseDay(checkIn), 1));

  let prefill: PrefillGuest | null = null;
  if (params.guestId && /^[a-z0-9]{10,40}$/i.test(params.guestId)) {
    const g = await db.guest.findFirst({ where: { id: params.guestId, deletedAt: null } });
    if (g) prefill = { id: g.id, name: g.name, phone: g.phone, email: g.email, city: g.city };
  }
  const roomId =
    params.roomId && /^[a-z0-9]{10,40}$/i.test(params.roomId)
      ? (await db.room.findFirst({ where: { id: params.roomId, deletedAt: null }, select: { id: true } }))?.id
      : undefined;

  return (
    <>
      <AdminPageHeader
        title="New booking"
        description="For walk-ins and bookings taken by phone or WhatsApp. Rooms are checked live and held as soon as you create the booking."
        back={{ href: "/admin/bookings", label: "Bookings" }}
      />
      <NewBookingForm
        defaults={{ checkIn, checkOut, roomId, today }}
        prefill={prefill}
        canPay={can(staff.permissions, "payments:write")}
      />
    </>
  );
}
