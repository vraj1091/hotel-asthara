"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { setPasswordFromLink } from "@/features/staff/invite-actions";
import { submitKeepingValues } from "@/lib/form-submit";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(setPasswordFromLink, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const first = (k: string) => errors[k]?.[0];
  return (
    <form action={action} onSubmit={submitKeepingValues(action)} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field id="password" label="New password" hint="At least 10 characters, with upper case, lower case and a number." error={first("password")}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          aria-invalid={!!first("password")}
          aria-describedby="password-msg"
          autoFocus
        />
      </Field>
      <Field id="confirm" label="Confirm password" error={first("confirm")}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!first("confirm")}
          aria-describedby="confirm-msg"
        />
      </Field>
      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}
