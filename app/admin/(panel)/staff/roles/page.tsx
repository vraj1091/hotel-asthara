import { RoleMatrix } from "@/components/admin/staff/role-matrix";
import { StaffTabs } from "@/components/admin/staff/staff-tabs";
import { AdminPageHeader } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePage } from "@/lib/session";

export const metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  const me = await requirePage("staff:manage");
  const roles = await db.role.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: { where: { deletedAt: null } } } } },
  });
  const isSuper = me.roleKey === "SUPER_ADMIN";
  return (
    <>
      <AdminPageHeader
        title="Staff & roles"
        description="Tick what each role may do. Every page and action checks these on the server."
      />
      <StaffTabs current="roles" />
      <div className="grid gap-6 xl:grid-cols-2">
        {roles.map((r) => {
          const locked = r.key === "SUPER_ADMIN";
          const lockReason = locked
            ? "The Super Admin role always has every permission."
            : !isSuper && r.key === me.roleKey
              ? "Only a Super Admin can change the permissions of your own role."
              : null;
          return (
            <RoleMatrix
              key={r.id}
              role={{ id: r.id, name: r.name, permissions: r.permissions, members: r._count.users }}
              permissions={PERMISSIONS.map((p) => ({
                key: p.key,
                label: p.label,
                // Non-Super Admins can only hand out what they hold themselves.
                grantable: isSuper || me.permissions.includes(p.key),
              }))}
              locked={!!lockReason}
              lockReason={lockReason}
              allChecked={locked}
            />
          );
        })}
      </div>
    </>
  );
}
