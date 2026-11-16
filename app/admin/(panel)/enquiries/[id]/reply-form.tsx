"use client";

import { ActionForm, FormField, SubmitButton, useFormErrors } from "@/components/admin/forms";
import { Textarea } from "@/components/ui/input";
import { replyToEnquiry } from "@/features/enquiries/admin-actions";

function SendChoice({ hasEmail, emailReady }: { hasEmail: boolean; emailReady: boolean }) {
  const { errors } = useFormErrors();
  const canEmail = hasEmail && emailReady;
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">How to send</legend>
      <label className="flex items-start gap-3 text-sm">
        <input type="radio" name="send" value="email" defaultChecked={canEmail} disabled={!canEmail} className="accent-[var(--color-accent)] mt-0.5 size-4" />
        <span>
          Email it to the guest
          {!hasEmail ? <span className="text-muted block">No email address on this enquiry.</span> : null}
          {hasEmail && !emailReady ? (
            <span className="text-muted block">Email sending is not set up (add RESEND_API_KEY).</span>
          ) : null}
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="radio" name="send" value="note" defaultChecked={!canEmail} className="accent-[var(--color-accent)] mt-0.5 size-4" />
        <span>
          Save as a note only
          <span className="text-muted block">For replies you gave by phone or WhatsApp.</span>
        </span>
      </label>
      {errors.send?.[0] ? (
        <p role="alert" className="text-danger text-sm">
          {errors.send[0]}
        </p>
      ) : null}
    </fieldset>
  );
}

export function ReplyForm({ id, hasEmail, emailReady }: { id: string; hasEmail: boolean; emailReady: boolean }) {
  return (
    <ActionForm action={replyToEnquiry} successMessage={null} resetOnSuccess className="grid gap-5">
      <input type="hidden" name="id" value={id} />
      <FormField name="reply" label="Your reply">
        <Textarea rows={6} required minLength={5} maxLength={5000} placeholder="Thank you for your message…" />
      </FormField>
      <SendChoice hasEmail={hasEmail} emailReady={emailReady} />
      <SubmitButton className="w-fit" pendingLabel="Sending…">
        Send reply
      </SubmitButton>
    </ActionForm>
  );
}
