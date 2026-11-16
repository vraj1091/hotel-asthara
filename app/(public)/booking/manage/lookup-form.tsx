"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupBooking } from "@/features/bookings/public-actions";
import { fieldErrorKeys, lookupSchema } from "@/lib/booking-form";
import { submitKeepingValues } from "@/lib/form-submit";

export function LookupForm({ defaultReference }: { defaultReference: string }) {
  const t = useTranslations("manage");
  const tc = useTranslations("checkout");
  const uid = useId();
  const [state, action, pending] = useActionState(lookupBooking, null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const msg = (key: string) => (tc.has(`errors.${key}`) ? tc(`errors.${key}`) : key);
  const serverErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const err = (k: string) => clientErrors[k] || serverErrors[k]?.[0];

  return (
    <form
      action={action}
      noValidate
      onSubmit={submitKeepingValues(action, (fd) => {
        const check = lookupSchema.safeParse({ reference: fd.get("reference") ?? "", contact: fd.get("contact") ?? "" });
        setClientErrors(check.success ? {} : fieldErrorKeys(check.error));
        return check.success;
      })}
      className="card grid gap-5 p-6 md:p-8"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${uid}-ref`}>{t("fields.reference")}</Label>
        <Input
          id={`${uid}-ref`}
          name="reference"
          defaultValue={defaultReference}
          placeholder="AST-261116-ABCD"
          autoComplete="off"
          autoCapitalize="characters"
          className="font-mono tracking-wider uppercase"
          aria-invalid={err("reference") ? true : undefined}
          aria-describedby={`${uid}-ref-msg`}
          required
        />
        <p id={`${uid}-ref-msg`} className={err("reference") ? "text-danger text-sm" : "text-muted text-sm"} role={err("reference") ? "alert" : undefined}>
          {err("reference") ? msg(err("reference")!) : t("hints.reference")}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${uid}-contact`}>{t("fields.contact")}</Label>
        <Input
          id={`${uid}-contact`}
          name="contact"
          autoComplete="tel"
          aria-invalid={err("contact") ? true : undefined}
          aria-describedby={`${uid}-contact-msg`}
          required
        />
        <p id={`${uid}-contact-msg`} className={err("contact") ? "text-danger text-sm" : "text-muted text-sm"} role={err("contact") ? "alert" : undefined}>
          {err("contact") ? msg(err("contact")!) : t("hints.contact")}
        </p>
      </div>
      {state && !state.ok && !state.fieldErrors ? (
        <p role="alert" className="border-danger/40 bg-danger/10 text-danger rounded-xl border px-4 py-3">
          {msg(state.error)}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full sm:w-fit">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        {t("find")}
      </Button>
    </form>
  );
}
