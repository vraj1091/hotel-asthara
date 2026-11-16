"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, MailPlus, UserPlus } from "lucide-react";
import { ActionForm, ConfirmButton, FormField, SubmitButton } from "@/components/admin/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import {
  changeStaffRole,
  inviteStaff,
  removeStaff,
  sendStaffLink,
  setStaffActive,
  type LinkResult,
} from "@/features/staff/actions";

type RoleOption = { id: string; name: string; key: string };

/* ───────── The link is shown exactly once, with a copy button ───────── */

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="h-11 font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        type="button"
        variant="dark"
        className="h-11"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            toast.error("Copy failed. Select the link and copy it manually.");
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function LinkDialog({ result, onClose }: { result: LinkResult | null; onClose: () => void }) {
  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle className="font-heading pr-10 text-xl">
          {result?.kind === "reset" ? "Password reset link ready" : "Invite ready"}
        </DialogTitle>
        <DialogDescription className="text-muted mt-2">
          {result?.emailed
            ? `We emailed this link to ${result.email}. You can also copy it and send it on WhatsApp.`
            : `Email is not set up, so nothing was sent. Copy this link and send it to ${result?.email} yourself, for example on WhatsApp.`}
        </DialogDescription>
        {result ? (
          <div className="mt-5 grid gap-3">
            <CopyField value={result.link} label="Link" />
            <p className="text-muted text-sm">
              {result.kind === "reset" ? "Works once, for 24 hours." : "Works once, for 7 days."} For security it is not
              shown again; send a new one if it gets lost.
            </p>
            <Button type="button" className="w-fit" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Invite ───────── */

export function InviteStaff({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);
  const defaultRole = roles.find((r) => r.key === "RECEPTIONIST")?.id ?? roles[0]?.id;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden /> Invite staff
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="font-heading pr-10 text-xl">Invite a staff member</DialogTitle>
          <DialogDescription className="text-muted mt-1">
            They get a link to choose their own password. You never see or send passwords.
          </DialogDescription>
          <ActionForm
            action={inviteStaff}
            successMessage="Invite created."
            resetOnSuccess
            onSuccess={(data) => {
              setOpen(false);
              setResult(data);
            }}
            className="mt-5 grid gap-4"
          >
            <FormField name="name" label="Full name">
              <Input required minLength={2} maxLength={100} autoComplete="off" />
            </FormField>
            <FormField name="email" label="Email">
              <Input type="email" required maxLength={254} autoComplete="off" />
            </FormField>
            <FormField name="roleId" label="Role" hint="You can change permissions per role on the Roles tab.">
              <NativeSelect defaultValue={defaultRole} required>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <SubmitButton pendingLabel="Creating invite…" className="w-fit">
              <MailPlus aria-hidden /> Create invite
            </SubmitButton>
          </ActionForm>
        </DialogContent>
      </Dialog>
      <LinkDialog result={result} onClose={() => setResult(null)} />
    </>
  );
}

/* ───────── Per-row actions ───────── */

export function StaffRowActions({
  user,
  roles,
  isSelf,
  canTouch,
}: {
  user: { id: string; name: string; roleId: string; active: boolean; invited: boolean };
  roles: RoleOption[];
  isSelf: boolean;
  canTouch: boolean; // false when a non-Super Admin looks at a Super Admin
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<LinkResult | null>(null);
  const [roleId, setRoleId] = useState(user.roleId);

  if (isSelf) return <span className="text-muted text-sm">This is you</span>;
  if (!canTouch) return <span className="text-muted text-sm">Super Admin only</span>;

  const run = (
    fn: (fd: FormData) => Promise<{ ok: boolean; error?: string; message?: string }>,
    fields: Record<string, string>,
    onFail?: () => void,
  ) =>
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await fn(fd);
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(res.error);
        onFail?.();
      }
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="sr-only" htmlFor={`role-${user.id}`}>
        Role for {user.name}
      </label>
      <select
        id={`role-${user.id}`}
        value={roleId}
        disabled={pending || !user.active}
        onChange={(e) => {
          const previous = roleId;
          setRoleId(e.target.value);
          run(changeStaffRole, { id: user.id, roleId: e.target.value }, () => setRoleId(previous));
        }}
        className="border-line-strong bg-bg h-9 rounded-xl border px-2 text-sm"
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {user.active ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const fd = new FormData();
              fd.set("id", user.id);
              const res = await sendStaffLink(fd);
              if (res.ok) {
                setResult(res.data);
                router.refresh();
              } else toast.error(res.error);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
          {user.invited ? "New invite link" : "Reset link"}
        </Button>
      ) : null}
      {user.active && !user.invited ? (
        <ConfirmButton
          action={setStaffActive}
          fields={{ id: user.id, active: "false" }}
          title={`Deactivate ${user.name}?`}
          body="They can no longer sign in, and any open session stops working on their next click. You can reactivate them later."
          confirmLabel="Deactivate"
          size="sm"
          variant="ghost"
          className="text-danger"
        >
          Deactivate
        </ConfirmButton>
      ) : null}
      {!user.active ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(setStaffActive, { id: user.id, active: "true" })}>
          Reactivate
        </Button>
      ) : null}
      {user.invited || !user.active ? (
        <ConfirmButton
          action={removeStaff}
          fields={{ id: user.id }}
          title={`Remove ${user.name}?`}
          body={user.invited ? "The invite link stops working and the account is removed." : "The account is removed from the staff list. Its history stays in the activity log."}
          confirmLabel="Remove"
          size="sm"
          variant="ghost"
          className="text-danger"
        >
          Remove
        </ConfirmButton>
      ) : null}
      <LinkDialog result={result} onClose={() => setResult(null)} />
    </div>
  );
}
