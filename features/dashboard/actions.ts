"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { changeBookingStatus } from "@/lib/booking-engine";

const schema = z.object({
  id: z.string().min(1).max(40),
  to: z.enum(["CHECKED_IN", "CHECKED_OUT"]),
});

/** One-click check-in / check-out from the dashboard's arrivals and departures lists. */
export async function quickStayStatus(formData: FormData) {
  return adminAction("bookings:write", async (staff) => {
    const { id, to } = schema.parse(Object.fromEntries(formData));
    const booking = await changeBookingStatus(id, to);
    await writeAudit({
      userId: staff.id,
      action: to === "CHECKED_IN" ? "booking.check_in" : "booking.check_out",
      entity: "Booking",
      entityId: id,
      meta: { reference: booking.reference, from: "dashboard" },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    return { message: to === "CHECKED_IN" ? `${booking.reference} checked in.` : `${booking.reference} checked out.` };
  }).then((r) => (r.ok ? { ...r, message: r.data.message } : r));
}
