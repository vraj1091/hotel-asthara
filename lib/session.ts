import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ActionError } from "@/lib/action";
import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/permissions";

export type Staff = {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  permissions: string[];
};

/** The signed-in staff member, read fresh from the database (not from the token). */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findFirst({
    where: { id, active: true, deletedAt: null },
    include: { role: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleKey: user.role.key,
    roleName: user.role.name,
    permissions: user.role.permissions,
  };
});

/** For admin pages and layouts: redirects instead of throwing. */
export async function requirePage(permission?: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (permission && !can(staff.permissions, permission)) redirect("/admin/forbidden");
  return staff;
}

/** Route handlers: the signed-in staff member if they hold any of the permissions, otherwise null. */
export async function staffWithAny(permissions: Permission[]): Promise<Staff | null> {
  const staff = await getStaff();
  if (!staff) return null;
  return permissions.some((p) => can(staff.permissions, p)) ? staff : null;
}

/** For server actions and route handlers: throws an ActionError that runAction turns into a message. */
export async function requireAction(permission: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new ActionError("Your session has expired. Sign in again.");
  if (!can(staff.permissions, permission))
    throw new ActionError("You do not have permission to do this.");
  return staff;
}
