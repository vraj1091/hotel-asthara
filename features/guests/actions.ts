"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError } from "@/lib/action";
import { adminAction } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { decryptText, encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { zEmail, zMobile, zOptionalText, zText } from "@/lib/sanitize";

const zId = z.string().min(1).max(40);

const profileSchema = z.object({
  id: zId,
  name: zText(2, 100),
  phone: zMobile,
  email: z.union([zEmail, z.literal("")]).optional(),
  city: zOptionalText(80),
  notes: zOptionalText(2000),
});

export async function updateGuest(_prev: unknown, formData: FormData) {
  return adminAction("guests:write", async (staff) => {
    const input = profileSchema.parse(Object.fromEntries(formData));
    const guest = await db.guest.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!guest) throw new ActionError("That guest no longer exists.");
    await db.guest.update({
      where: { id: input.id },
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email || null,
        city: input.city ?? null,
        notes: input.notes ?? null,
      },
    });
    await writeAudit({ userId: staff.id, action: "guest.update", entity: "Guest", entityId: input.id });
    revalidatePath(`/admin/guests/${input.id}`);
    revalidatePath("/admin/guests");
  }, "Guest details saved.");
}

const idSchema = z.object({
  id: zId,
  idType: z.enum(["AADHAAR", "PASSPORT", "DRIVING_LICENCE", "VOTER_ID", "OTHER_GOVT_ID"], {
    errorMap: () => ({ message: "Choose the ID type." }),
  }),
  idNumber: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{4,24}$/, "Use 4 to 24 letters and numbers.")),
});

export async function updateGuestId(_prev: unknown, formData: FormData) {
  return adminAction("guests:write", async (staff) => {
    const input = idSchema.parse(Object.fromEntries(formData));
    const guest = await db.guest.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!guest) throw new ActionError("That guest no longer exists.");
    await db.guest.update({
      where: { id: input.id },
      data: {
        idType: input.idType,
        idNumberEnc: encryptText(input.idNumber),
        idNumberLast4: input.idNumber.slice(-4),
      },
    });
    await writeAudit({
      userId: staff.id,
      action: "guest.update_id",
      entity: "Guest",
      entityId: input.id,
      meta: { idType: input.idType },
    });
    revalidatePath(`/admin/guests/${input.id}`);
  }, "ID saved and encrypted.");
}

/** Decrypts the full ID number for staff allowed to see it. Every reveal is written to the activity log. */
export async function revealGuestId(formData: FormData) {
  return adminAction("guests:id", async (staff) => {
    const id = zId.parse(formData.get("id"));
    const guest = await db.guest.findFirst({
      where: { id, deletedAt: null },
      select: { idNumberEnc: true },
    });
    if (!guest?.idNumberEnc) throw new ActionError("No ID number is stored for this guest.");
    let value: string;
    try {
      value = decryptText(guest.idNumberEnc);
    } catch {
      throw new ActionError("The ID could not be decrypted. Check ID_ENCRYPTION_KEY has not changed.");
    }
    await writeAudit({ userId: staff.id, action: "guest.reveal_id", entity: "Guest", entityId: id });
    return { value };
  });
}

export async function deleteGuest(formData: FormData) {
  return adminAction("guests:write", async (staff) => {
    const id = zId.parse(formData.get("id"));
    const bookings = await db.booking.count({ where: { guestId: id } });
    if (bookings > 0)
      throw new ActionError("This guest has bookings, so the profile is kept for the records.");
    await db.guest.update({
      where: { id },
      data: { deletedAt: new Date(), idNumberEnc: null, idNumberLast4: null },
    });
    await writeAudit({ userId: staff.id, action: "guest.delete", entity: "Guest", entityId: id });
    revalidatePath("/admin/guests");
    redirect("/admin/guests");
  }, "Guest deleted.");
}
