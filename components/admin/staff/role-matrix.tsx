"use client";

import { Lock } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { AdminCard } from "@/components/admin/ui";
import { saveRolePermissions } from "@/features/staff/actions";

export function RoleMatrix({
  role,
  permissions,
  locked,
  lockReason,
  allChecked,
}: {
  role: { id: string; name: string; permissions: string[]; members: number };
  permissions: { key: string; label: string; grantable: boolean }[];
  locked: boolean;
  lockReason: string | null;
  allChecked: boolean;
}) {
  return (
    <AdminCard
      title={role.name}
      description={`${role.members} ${role.members === 1 ? "person" : "people"}`}
    >
      <ActionForm action={saveRolePermissions} className="grid gap-4">
        <input type="hidden" name="roleId" value={role.id} />
        {lockReason ? (
          <p className="bg-surface-2 text-muted flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
            <Lock className="size-4 shrink-0" aria-hidden />
            {lockReason}
          </p>
        ) : null}
        <fieldset disabled={locked} className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          <legend className="sr-only">Permissions for {role.name}</legend>
          {permissions.map((p) => {
            const checked = allChecked || role.permissions.includes(p.key);
            const always = p.key === "dashboard:view";
            const id = `${role.id}-${p.key}`;
            return (
              <div key={p.key} className="flex items-start gap-2.5 text-sm">
                <input
                  id={id}
                  type="checkbox"
                  name="permissions"
                  value={p.key}
                  defaultChecked={checked}
                  disabled={always || (!p.grantable && !checked)}
                  className="accent-[var(--color-accent)] mt-0.5 size-4 shrink-0"
                />
                {always ? <input type="hidden" name="permissions" value={p.key} /> : null}
                <label htmlFor={id} className={!p.grantable && !checked ? "text-muted" : undefined}>
                  {p.label}
                  <span className="text-muted block font-mono text-[0.7rem]">{p.key}</span>
                </label>
              </div>
            );
          })}
        </fieldset>
        {!locked ? (
          <SubmitButton size="sm" className="w-fit">
            Save {role.name} permissions
          </SubmitButton>
        ) : null}
      </ActionForm>
    </AdminCard>
  );
}
