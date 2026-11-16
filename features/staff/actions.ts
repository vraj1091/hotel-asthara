"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError } from "@/lib/action";
import { adminAction } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";
import { zEmail, zText } from "@/lib/sanitize";
import type { Staff } from "@/lib/session";
import { issueLink } from "@/features/staff/tokens";

const zId = z.string().min(1).max(40);

const isSuper = (staff: Staff) => staff.roleKey === "SUPER_ADMIN";

/** Active Super Admins who can actually sign in, optionally ignoring one user. */
async function activeSuperAdmins(excludeUserId?: string) {
  return db.user.count({
    where: {
      active: true,
      deletedAt: null,
      passwordHash: { not: null },
      role: { key: "SUPER_ADMIN" },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

async function loadTarget(id: string) {
  const user = await db.user.findFirst({ where: { id, deletedAt: null }, include: { role: true } });
  if (!user) throw new ActionError("That staff member no longer exists.");
  return user;
}

function guardSuperAdminEdit(actor: Staff, targetRoleKey: string) {
  if (targetRoleKey === "SUPER_ADMIN" && !isSuper(actor))
    throw new ActionError("Only a Super Admin can change a Super Admin's account.");
}

export type LinkResult = { link: string; emailed: boolean; email: string; kind: "invite" | "reset" };

/* ───────── Invite ───────── */

const inviteSchema = z.object({
  name: zText(2, 100),
  email: zEmail,
  roleId: zId,
});

export async function inviteStaff(_prev: unknown, formData: FormData) {
  return adminAction("staff:manage", async (actor): Promise<LinkResult> => {
    const input = inviteSchema.parse(Object.fromEntries(formData));
    const role = await db.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw new ActionError("Choose a role.", { roleId: ["Choose a role."] });
    if (role.key === "SUPER_ADMIN" && !isSuper(actor))
      throw new ActionError("Only a Super Admin can invite another Super Admin.", {
        roleId: ["Only a Super Admin can grant this role."],
      });
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing && !existing.deletedAt)
      throw new ActionError("Someone already has an account with that email.", {
        email: ["This email already has an account."],
      });
    const user = existing
      ? await db.user.update({
          where: { id: existing.id },
          data: {
            name: input.name,
            roleId: role.id,
            passwordHash: null,
            active: true,
            deletedAt: null,
            lastLoginAt: null,
          },
        })
      : await db.user.create({ data: { name: input.name, email: input.email, roleId: role.id, active: true } });
    const result = await issueLink(user.id, "invite", actor.name);
    await writeAudit({
      userId: actor.id,
      action: "staff.invite",
      entity: "User",
      entityId: user.id,
      meta: { email: user.email, role: role.key, emailed: result.emailed },
    });
    revalidatePath("/admin/staff");
    return { link: result.link, emailed: result.emailed, email: user.email, kind: "invite" };
  });
}

/** New invite link (not yet activated) or a password-reset link (active account). */
export async function sendStaffLink(formData: FormData) {
  return adminAction("staff:manage", async (actor): Promise<LinkResult> => {
    const user = await loadTarget(zId.parse(formData.get("id")));
    guardSuperAdminEdit(actor, user.role.key);
    if (!user.active) throw new ActionError("Reactivate this account before sending a link.");
    const kind = user.passwordHash ? "reset" : "invite";
    const result = await issueLink(user.id, kind, actor.name);
    await writeAudit({
      userId: actor.id,
      action: kind === "invite" ? "staff.invite_resend" : "staff.password_reset_link",
      entity: "User",
      entityId: user.id,
      meta: { emailed: result.emailed },
    });
    revalidatePath("/admin/staff");
    return { link: result.link, emailed: result.emailed, email: user.email, kind };
  });
}

/* ───────── Role, active, remove ───────── */

export async function changeStaffRole(formData: FormData) {
  return adminAction("staff:manage", async (actor) => {
    const user = await loadTarget(zId.parse(formData.get("id")));
    const role = await db.role.findUnique({ where: { id: zId.parse(formData.get("roleId")) } });
    if (!role) throw new ActionError("Choose a role.");
    if (user.roleId === role.id) return;
    if (user.id === actor.id) throw new ActionError("You cannot change your own role. Ask another Super Admin.");
    guardSuperAdminEdit(actor, user.role.key);
    if (role.key === "SUPER_ADMIN" && !isSuper(actor))
      throw new ActionError("Only a Super Admin can grant the Super Admin role.");
    if (user.role.key === "SUPER_ADMIN" && user.active && user.passwordHash && (await activeSuperAdmins(user.id)) === 0)
      throw new ActionError("There must always be at least one active Super Admin.");
    await db.user.update({ where: { id: user.id }, data: { roleId: role.id } });
    await writeAudit({
      userId: actor.id,
      action: "staff.role_change",
      entity: "User",
      entityId: user.id,
      meta: { from: user.role.key, to: role.key },
    });
    revalidatePath("/admin/staff");
  }, "Role changed. It applies from their next click.");
}

export async function setStaffActive(formData: FormData) {
  return adminAction("staff:manage", async (actor) => {
    const user = await loadTarget(zId.parse(formData.get("id")));
    const active = formData.get("active") === "true";
    if (user.active === active) return;
    if (user.id === actor.id) throw new ActionError("You cannot deactivate your own account.");
    guardSuperAdminEdit(actor, user.role.key);
    if (!active && user.role.key === "SUPER_ADMIN" && user.passwordHash && (await activeSuperAdmins(user.id)) === 0)
      throw new ActionError("There must always be at least one active Super Admin.");
    await db.user.update({
      where: { id: user.id },
      // Deactivating also kills any open invite / reset link.
      data: { active, ...(active ? {} : { inviteToken: null, inviteExpiry: null }) },
    });
    await writeAudit({
      userId: actor.id,
      action: active ? "staff.reactivate" : "staff.deactivate",
      entity: "User",
      entityId: user.id,
    });
    revalidatePath("/admin/staff");
  }, formData.get("active") === "true" ? "Account reactivated." : "Account deactivated. They are signed out on their next click.");
}

/** Removes an account that never set a password, or a deactivated one. Kept as a soft delete for the audit trail. */
export async function removeStaff(formData: FormData) {
  return adminAction("staff:manage", async (actor) => {
    const user = await loadTarget(zId.parse(formData.get("id")));
    if (user.id === actor.id) throw new ActionError("You cannot remove your own account.");
    guardSuperAdminEdit(actor, user.role.key);
    if (user.passwordHash && user.active)
      throw new ActionError("Deactivate this account first, then remove it.");
    await db.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), active: false, inviteToken: null, inviteExpiry: null },
    });
    await writeAudit({ userId: actor.id, action: "staff.remove", entity: "User", entityId: user.id, meta: { email: user.email } });
    revalidatePath("/admin/staff");
  }, "Account removed.");
}

/* ───────── Role permission matrix ───────── */

export async function saveRolePermissions(_prev: unknown, formData: FormData) {
  return adminAction("staff:manage", async (actor) => {
    const role = await db.role.findUnique({ where: { id: zId.parse(formData.get("roleId")) } });
    if (!role) throw new ActionError("That role no longer exists.");
    if (role.key === "SUPER_ADMIN") throw new ActionError("The Super Admin role always has every permission.");
    const wanted = formData
      .getAll("permissions")
      .map(String)
      .filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p));
    if (!isSuper(actor)) {
      // Without this, a Manager with staff:manage could hand their own role more power.
      if (role.key === actor.roleKey) throw new ActionError("Only a Super Admin can change the permissions of your own role.");
      const beyond = wanted.filter((p) => !actor.permissions.includes(p) && !role.permissions.includes(p));
      if (beyond.length) throw new ActionError("You can only grant permissions you have yourself.");
    }
    if (!wanted.includes("dashboard:view")) wanted.unshift("dashboard:view"); // everyone needs a landing page
    await db.role.update({ where: { id: role.id }, data: { permissions: wanted } });
    await writeAudit({
      userId: actor.id,
      action: "role.permissions",
      entity: "Role",
      entityId: role.id,
      meta: { role: role.key, added: wanted.filter((p) => !role.permissions.includes(p)), removed: role.permissions.filter((p) => !wanted.includes(p as Permission)) },
    });
    revalidatePath("/admin/staff");
  }, "Permissions saved. They apply from each person's next click.");
}
