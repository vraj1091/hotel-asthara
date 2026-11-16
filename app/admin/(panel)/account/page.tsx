import { NameForm, PasswordForm } from "@/components/admin/staff/account-forms";
import { AdminCard, AdminPageHeader, DetailList } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const staff = await requirePage();
  const user = await db.user.findUniqueOrThrow({ where: { id: staff.id }, select: { lastLoginAt: true, createdAt: true } });
  const allowed = PERMISSIONS.filter((p) => staff.permissions.includes(p.key));
  return (
    <>
      <AdminPageHeader title="My account" description="Your name, password and what your role lets you do." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-6">
          <AdminCard title="Profile">
            <DetailList
              className="mb-6"
              items={[
                ["Email", staff.email],
                ["Role", staff.roleName],
                ["Last sign-in", user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"],
                ["Account created", formatDateTime(user.createdAt)],
              ]}
            />
            <NameForm name={staff.name} />
          </AdminCard>
          <AdminCard title="Change password">
            <PasswordForm email={staff.email} />
          </AdminCard>
        </div>
        <AdminCard title="What you can do" description="Ask a Super Admin if you need more access.">
          <ul className="grid gap-2 text-sm">
            {allowed.map((p) => (
              <li key={p.key} className="flex items-center gap-2">
                <span className="bg-accent size-1.5 shrink-0 rounded-full" aria-hidden />
                {p.label}
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
    </>
  );
}
