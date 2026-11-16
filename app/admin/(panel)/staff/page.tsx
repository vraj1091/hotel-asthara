import { UserCog } from "lucide-react";
import { InviteStaff, StaffRowActions } from "@/components/admin/staff/staff-client";
import { StaffTabs } from "@/components/admin/staff/staff-tabs";
import { AdminCard, AdminPageHeader, EmptyState, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requirePage("staff:manage");
  const [users, roles] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null },
      include: { role: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.role.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const isSuper = me.roleKey === "SUPER_ADMIN";
  // Only a Super Admin can hand out the Super Admin role.
  const grantable = roles
    .filter((r) => isSuper || r.key !== "SUPER_ADMIN")
    .map((r) => ({ id: r.id, name: r.name, key: r.key }));
  const allRoles = roles.map((r) => ({ id: r.id, name: r.name, key: r.key }));
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Staff & roles"
        description="Invite people, choose what each role can do, and switch off access when someone leaves."
        actions={<InviteStaff roles={grantable} />}
      />
      <StaffTabs current="people" />
      <AdminCard>
        {users.length === 0 ? (
          <EmptyState icon={<UserCog />} title="No staff yet" body="Invite your first colleague with the button above." />
        ) : (
          <Table className="min-w-[48rem]">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const invited = !u.passwordHash;
                const expired = invited && (!u.inviteExpiry || u.inviteExpiry < now);
                const canTouch = isSuper || u.role.key !== "SUPER_ADMIN";
                return (
                  <tr key={u.id}>
                    <Td>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-muted text-xs break-all">{u.email}</p>
                    </Td>
                    <Td>{u.role.name}</Td>
                    <Td>
                      {!u.active ? (
                        <Badge tone="danger">Deactivated</Badge>
                      ) : invited ? (
                        <Badge tone={expired ? "warning" : "gold"}>{expired ? "Invite expired" : "Invited"}</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </Td>
                    <Td className="text-muted whitespace-nowrap">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</Td>
                    <Td className="text-right">
                      <StaffRowActions
                        user={{ id: u.id, name: u.name, roleId: u.roleId, active: u.active, invited }}
                        roles={u.role.key === "SUPER_ADMIN" || isSuper ? allRoles : grantable}
                        isSelf={u.id === me.id}
                        canTouch={canTouch}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </AdminCard>
      <p className="text-muted mt-4 text-sm">
        Role and access changes apply from the person&apos;s next click. There must always be at least one active
        Super Admin.
      </p>
    </>
  );
}
