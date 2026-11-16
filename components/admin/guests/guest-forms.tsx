"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { ActionForm, FormField, SubmitButton } from "@/components/admin/forms";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { revealGuestId, updateGuest, updateGuestId } from "@/features/guests/actions";

export const ID_TYPE_LABEL: Record<string, string> = {
  AADHAAR: "Aadhaar",
  PASSPORT: "Passport",
  DRIVING_LICENCE: "Driving licence",
  VOTER_ID: "Voter ID",
  OTHER_GOVT_ID: "Other government ID",
};

export function GuestProfileForm({
  guest,
  disabled,
}: {
  guest: { id: string; name: string; phone: string; email: string | null; city: string | null; notes: string | null };
  disabled?: boolean;
}) {
  return (
    <ActionForm action={updateGuest} className="grid gap-5" successMessage="Guest details saved.">
      <input type="hidden" name="id" value={guest.id} />
      <fieldset disabled={disabled} className="grid gap-5">
        <FormField name="name" label="Full name">
          <Input defaultValue={guest.name} required minLength={2} maxLength={100} autoComplete="off" />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField name="phone" label="Mobile number" hint="10 digits, +91 optional">
            <Input defaultValue={guest.phone} type="tel" inputMode="tel" required pattern="[+0-9 \(\)\-]{10,16}" />
          </FormField>
          <FormField name="email" label="Email" optional>
            <Input defaultValue={guest.email ?? ""} type="email" maxLength={254} />
          </FormField>
        </div>
        <FormField name="city" label="City" optional>
          <Input defaultValue={guest.city ?? ""} maxLength={80} />
        </FormField>
        <FormField name="notes" label="Notes for staff" optional hint="Preferences, special requests, anything the next shift should know.">
          <Textarea defaultValue={guest.notes ?? ""} rows={4} maxLength={2000} className="min-h-0" />
        </FormField>
      </fieldset>
      {disabled ? null : <SubmitButton className="w-fit">Save details</SubmitButton>}
    </ActionForm>
  );
}

export function GuestIdForm({ guestId, currentType }: { guestId: string; currentType: string | null }) {
  return (
    <ActionForm action={updateGuestId} className="grid gap-4" resetOnSuccess successMessage="ID saved and encrypted.">
      <input type="hidden" name="id" value={guestId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="idType" label="ID type">
          <NativeSelect defaultValue={currentType ?? ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {Object.entries(ID_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField name="idNumber" label="ID number" hint="Stored encrypted. PAN card is not accepted.">
          <Input required minLength={4} maxLength={30} autoComplete="off" spellCheck={false} />
        </FormField>
      </div>
      <SubmitButton size="sm" variant="outline" className="w-fit">
        {currentType ? "Replace ID" : "Save ID"}
      </SubmitButton>
    </ActionForm>
  );
}

/** Shows the decrypted ID once on request. Every reveal is logged. */
export function RevealId({ guestId, masked }: { guestId: string; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-mono text-base tracking-wider tabular-nums" aria-live="polite">
        {value ?? masked}
      </span>
      {value ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setValue(null)}>
          <EyeOff aria-hidden /> Hide
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const fd = new FormData();
              fd.set("id", guestId);
              const res = await revealGuestId(fd);
              if (res.ok) setValue(res.data.value);
              else toast.error(res.error);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden />}
          Reveal
        </Button>
      )}
    </div>
  );
}
