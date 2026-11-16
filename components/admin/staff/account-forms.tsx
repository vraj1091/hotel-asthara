"use client";

import { ActionForm, FormField, SubmitButton } from "@/components/admin/forms";
import { Input } from "@/components/ui/input";
import { changeMyPassword, updateMyName } from "@/features/staff/account-actions";

export function NameForm({ name }: { name: string }) {
  return (
    <ActionForm action={updateMyName} successMessage={null} className="grid gap-4">
      <FormField name="name" label="Your name" hint="Shown in the activity log and on emails you send.">
        <Input defaultValue={name} required minLength={2} maxLength={100} autoComplete="name" />
      </FormField>
      <SubmitButton size="sm" className="w-fit">
        Save name
      </SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm({ email }: { email: string }) {
  return (
    <ActionForm action={changeMyPassword} successMessage={null} resetOnSuccess className="grid gap-4">
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <FormField name="current" label="Current password">
        <Input type="password" required autoComplete="current-password" maxLength={128} />
      </FormField>
      <FormField name="password" label="New password" hint="At least 10 characters, with upper case, lower case and a number.">
        <Input type="password" required minLength={10} maxLength={128} autoComplete="new-password" />
      </FormField>
      <FormField name="confirm" label="Confirm new password">
        <Input type="password" required maxLength={128} autoComplete="new-password" />
      </FormField>
      <SubmitButton size="sm" className="w-fit" pendingLabel="Changing…">
        Change password
      </SubmitButton>
    </ActionForm>
  );
}
