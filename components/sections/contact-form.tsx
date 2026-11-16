"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { submitEnquiry } from "@/features/enquiries/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { fieldErrorKeys } from "@/lib/booking-form";
import { enquiryInput, enquirySchema } from "@/lib/enquiry-form";
import { submitKeepingValues } from "@/lib/form-submit";

export function ContactForm() {
  const t = useTranslations("common");
  const tc = useTranslations("contact");
  const [state, action, pending] = useActionState(submitEnquiry, null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) toast.success(tc("success"));
  }, [state, tc]);

  // Field errors (from the browser check or the server) are translation keys.
  const serverErrors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const msg = (key: string) => (tc.has(`errors.${key}`) ? tc(`errors.${key}`) : key);
  const first = (k: string) => {
    const key = clientErrors[k] || serverErrors[k]?.[0];
    return key ? msg(key) : undefined;
  };
  const formError =
    state && !state.ok && !state.fieldErrors ? (tc.has(`errors.${state.error}`) ? tc(`errors.${state.error}`) : tc("error")) : null;

  const onSubmit = submitKeepingValues(action, (fd) => {
    const check = enquirySchema.safeParse(enquiryInput(fd));
    if (check.success) {
      setClientErrors({});
      return true;
    }
    // A filled honeypot goes to the server, which answers bots with a silent success.
    if (check.error.issues.some((i) => i.path[0] === "website")) return true;
    const errs = fieldErrorKeys(check.error);
    setClientErrors(errs);
    const firstField = Object.keys(errs)[0];
    if (firstField) formRef.current?.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
    return false;
  });

  if (state?.ok) {
    return (
      <div role="status" className="card flex items-start gap-3 p-6">
        <CheckCircle2 className="text-accent mt-0.5 size-6 shrink-0" aria-hidden />
        <p className="text-lg">{tc("success")}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} noValidate className="card grid gap-5 p-6 md:p-8">
      <h3 className="text-h3">{tc("title")}</h3>
      <Field id="name" label={t("name")} error={first("name")}>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          aria-invalid={!!first("name")}
          aria-describedby="name-msg"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="phone" label={t("phone")} optionalText={t("optional")} error={first("phone")}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={16}
            aria-invalid={!!first("phone")}
            aria-describedby="phone-msg"
          />
        </Field>
        <Field id="email" label={t("email")} optionalText={t("optional")} error={first("email")}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-invalid={!!first("email")}
            aria-describedby="email-msg"
          />
        </Field>
      </div>
      <Field id="message" label={t("message")} error={first("message")}>
        <Textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={2000}
          aria-invalid={!!first("message")}
          aria-describedby="message-msg"
        />
      </Field>
      {/* Honeypot – hidden from people and screen readers */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {formError ? (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full sm:w-fit">
        {pending ? t("sending") : t("sendMessage")}
      </Button>
    </form>
  );
}
