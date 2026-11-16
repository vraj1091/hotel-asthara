"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, runAction, type ActionResult } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hashPassword, zPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/features/staff/tokens";

const schema = z
  .object({
    token: z.string().min(20).max(100),
    password: zPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords do not match.", path: ["confirm"] });

/** Public: sets a password from an invite or reset link. Signed-out users reach this, so it is rate-limited. */
export async function setPasswordFromLink(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const limit = await rateLimit("invite-set", clientIp(await headers()), { limit: 10, windowMs: 15 * 60_000 });
    if (!limit.ok) throw new ActionError("Too many attempts. Wait 15 minutes and try again.");
    const input = schema.parse(Object.fromEntries(formData));
    const user = await db.user.findFirst({
      where: { inviteToken: hashToken(input.token), inviteExpiry: { gt: new Date() }, deletedAt: null, active: true },
    });
    if (!user) throw new ActionError("This link has expired or was already used. Ask your manager for a new one.");
    const wasInvite = !user.passwordHash;
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.password), inviteToken: null, inviteExpiry: null },
    });
    await writeAudit({
      userId: user.id,
      action: wasInvite ? "staff.invite_accepted" : "staff.password_reset",
      entity: "User",
      entityId: user.id,
    });
    redirect("/admin/login?notice=password-set");
  });
}
