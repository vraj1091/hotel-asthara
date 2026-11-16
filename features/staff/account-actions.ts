"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, runAction } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, zPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { zText } from "@/lib/sanitize";
import { getStaff } from "@/lib/session";

/** Every signed-in staff member may edit their own name and password, whatever their role. */
async function me() {
  const staff = await getStaff();
  if (!staff) throw new ActionError("Your session has expired. Sign in again.");
  return staff;
}

export async function updateMyName(_prev: unknown, fd: FormData) {
  return runAction(async () => {
    const staff = await me();
    const name = zText(2, 100).parse(fd.get("name") ?? "");
    await db.user.update({ where: { id: staff.id }, data: { name } });
    await writeAudit({ userId: staff.id, action: "account.name", entity: "User", entityId: staff.id });
    revalidatePath("/admin", "layout");
  }, "Name updated.");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password.").max(128),
    password: zPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords do not match.", path: ["confirm"] })
  .refine((v) => v.password !== v.current, { message: "Choose a password different from the current one.", path: ["password"] });

export async function changeMyPassword(_prev: unknown, fd: FormData) {
  return runAction(async () => {
    const staff = await me();
    const limit = await rateLimit("change-password", staff.id, { limit: 6, windowMs: 15 * 60_000 });
    if (!limit.ok) throw new ActionError("Too many attempts. Wait 15 minutes and try again.");
    const input = passwordSchema.parse(Object.fromEntries(fd));
    const user = await db.user.findUniqueOrThrow({ where: { id: staff.id } });
    if (!user.passwordHash || !(await verifyPassword(input.current, user.passwordHash)))
      throw new ActionError("Your current password is not correct.", { current: ["This is not your current password."] });
    await db.user.update({
      where: { id: staff.id },
      data: { passwordHash: await hashPassword(input.password), inviteToken: null, inviteExpiry: null },
    });
    await writeAudit({ userId: staff.id, action: "account.password_change", entity: "User", entityId: staff.id });
  }, "Password changed. Use the new one next time you sign in.");
}
