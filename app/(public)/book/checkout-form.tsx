"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CreditCard, Hotel, Loader2, ShieldCheck, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmOnlinePayment, placeBooking, quoteBooking, type PlaceResult, type QuoteView } from "@/features/bookings/public-actions";
import { fieldErrorKeys, guestDetailsSchema } from "@/lib/booking-form";
import { openRazorpay } from "@/lib/razorpay-client";
import { cn, formatDay, formatINR } from "@/lib/utils";

type Stay = { room: string; checkIn: string; checkOut: string; rooms: number; guests: number };

export function CheckoutForm({
  stay,
  roomName,
  hotelName,
  nights,
  initial,
  payment,
  idPolicy,
  freeCancelHours,
}: {
  stay: Stay;
  roomName: string;
  hotelName: string;
  nights: { date: string; ratePaise: number; rule: string | null }[];
  initial: QuoteView;
  payment: { online: boolean; hotel: boolean; holdMinutes: number };
  idPolicy: string;
  freeCancelHours: number;
}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("common");
  const locale = useLocale() === "hi" ? "hi-IN" : "en-IN";
  const router = useRouter();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [quote, setQuote] = useState<QuoteView>(initial);
  const [code, setCode] = useState("");
  const [applying, startApply] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [paying, setPaying] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [method, setMethod] = useState<"online" | "hotel">(payment.online ? "online" : "hotel");

  const msg = (key: string) => (t.has(`errors.${key}`) ? t(`errors.${key}`) : key);
  const busy = submitting || paying;

  function applyCode(next: string) {
    startApply(async () => {
      const res = await quoteBooking({ ...stay, couponCode: next });
      if (!res.ok) {
        setQuote((q) => ({ ...q, couponError: msg(res.error) }));
        return;
      }
      setQuote(res.data);
      if (res.data.coupon) setCode(res.data.coupon.code);
    });
  }

  function fieldProps(name: string) {
    const error = errors[name];
    return {
      id: `${uid}-${name}`,
      name,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${uid}-${name}-msg` : undefined,
      onChange: () => error && setErrors((e) => ({ ...e, [name]: "" })),
    };
  }
  const errorText = (name: string) =>
    errors[name] ? (
      <p id={`${uid}-${name}-msg`} role="alert" className="text-danger text-sm">
        {msg(errors[name]!)}
      </p>
    ) : null;

  async function startPayment(res: Extract<PlaceResult, { mode: "razorpay" }>) {
    setPaying(true);
    const outcome = await openRazorpay({
      keyId: res.keyId,
      orderId: res.orderId,
      amountPaise: res.amountPaise,
      name: hotelName,
      description: `${res.reference} · ${stay.rooms} × ${roomName}`,
      prefill: res.prefill,
      notes: { reference: res.reference },
    });
    if (outcome.status === "paid") {
      const confirmed = await confirmOnlinePayment({
        reference: res.reference,
        orderId: outcome.orderId,
        paymentId: outcome.paymentId,
        signature: outcome.signature,
      });
      router.push(`/booking/${res.reference}?${confirmed.ok ? "paid=1" : "payment=check"}`);
      return;
    }
    // Closed, failed or could not load: the booking page lets the guest retry or pay at the hotel.
    router.push(`/booking/${res.reference}?payment=${outcome.status}`);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const check = guestDetailsSchema.safeParse({
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      city: String(fd.get("city") ?? ""),
      note: String(fd.get("note") ?? ""),
      payment: String(fd.get("payment") ?? ""),
      terms: fd.get("terms") ? "on" : "",
    });
    if (!check.success) {
      const keys = fieldErrorKeys(check.error);
      setErrors(keys);
      const first = Object.keys(keys)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    if (quote.coupon) fd.set("couponCode", quote.coupon.code);
    startSubmit(async () => {
      const res = await placeBooking(null, fd);
      if (!res.ok) {
        if (res.fieldErrors) {
          const next: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) if (v?.[0]) next[k] = v[0];
          setErrors(next);
          if (next.couponCode) setQuote((q) => ({ ...q, coupon: null, couponError: next.couponCode! }));
        }
        setFormError(msg(res.error));
        return;
      }
      if (res.data.mode === "confirmed") {
        if (!res.data.reference) return; // honeypot
        router.push(`/booking/${res.data.reference}?new=1`);
        return;
      }
      await startPayment(res.data);
    });
  }

  const ruleNights = nights.filter((n) => n.rule);

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="grid gap-6" aria-busy={busy}>
      {Object.entries(stay).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}

      {/* ── Price summary ── */}
      <section className="card grid gap-4 p-6 md:p-8" aria-labelledby={`${uid}-price`}>
        <h2 id={`${uid}-price`} className="text-h3">
          {t("priceTitle")}
        </h2>
        <dl className="grid gap-2 text-[0.95rem] [&>div]:flex [&>div]:justify-between [&>div]:gap-6 [&_dd]:tabular-nums [&_dt]:text-muted">
          <div>
            <dt>
              {t("roomCharges", { rooms: stay.rooms, nights: quote.nights })}
            </dt>
            <dd>{formatINR(quote.subtotalPaise, true)}</dd>
          </div>
          {quote.discountPaise ? (
            <div>
              <dt>
                {t("discount")} ({quote.coupon?.code})
              </dt>
              <dd className="text-success">− {formatINR(quote.discountPaise, true)}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t("gst")}</dt>
            <dd>{formatINR(quote.taxPaise, true)}</dd>
          </div>
          <div className="border-line border-t pt-3 text-lg">
            <dt className="!text-ink font-medium">{t("total")}</dt>
            <dd className="font-semibold">{formatINR(quote.totalPaise, true)}</dd>
          </div>
        </dl>
        {nights.length > 1 || ruleNights.length ? (
          <details className="text-sm">
            <summary className="link-underline text-muted w-fit cursor-pointer">{t("perNight")}</summary>
            <ul className="mt-3 grid gap-1">
              {nights.map((n) => (
                <li key={n.date} className="flex justify-between gap-4">
                  <span>
                    {formatDay(n.date, locale)}
                    {n.rule ? <span className="text-muted"> · {n.rule}</span> : null}
                  </span>
                  <span className="tabular-nums">{formatINR(n.ratePaise)} × {stay.rooms}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor={`${uid}-code`}>{t("promo")}</Label>
          {quote.coupon ? (
            <div className="bg-accent-soft flex items-center justify-between gap-3 rounded-xl px-4 py-3" role="status">
              <span className="flex items-center gap-2 text-sm">
                <Tag className="text-accent-strong size-4" aria-hidden />
                <strong className="font-mono tracking-wider">{quote.coupon.code}</strong> · {quote.coupon.label}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCode("");
                  applyCode("");
                }}
                className="hover:bg-surface-3 grid size-9 place-items-center rounded-full"
                aria-label={t("removePromo")}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id={`${uid}-code`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (code.trim()) applyCode(code.trim());
                  }
                }}
                autoComplete="off"
                maxLength={40}
                className="h-11 font-mono tracking-wider uppercase"
                aria-describedby={quote.couponError ? `${uid}-code-msg` : undefined}
                aria-invalid={quote.couponError ? true : undefined}
              />
              <Button type="button" variant="outline" disabled={!code.trim() || applying} onClick={() => applyCode(code.trim())} className="h-11">
                {applying ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {t("apply")}
              </Button>
            </div>
          )}
          {quote.couponError ? (
            <p id={`${uid}-code-msg`} role="alert" className="text-danger text-sm">
              {quote.couponError}
            </p>
          ) : null}
        </div>
      </section>

      {/* ── Guest details ── */}
      <section className="card grid gap-5 p-6 md:p-8" aria-labelledby={`${uid}-details`}>
        <h2 id={`${uid}-details`} className="text-h3">
          {t("details")}
        </h2>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-name`}>{t("fields.name")}</Label>
          <Input {...fieldProps("name")} autoComplete="name" required maxLength={100} />
          {errorText("name")}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Label htmlFor={`${uid}-phone`}>{t("fields.phone")}</Label>
            <Input {...fieldProps("phone")} type="tel" inputMode="tel" autoComplete="tel" required maxLength={16} placeholder="98xxxxxxxx" />
            {errors.phone ? errorText("phone") : <p className="text-muted text-sm">{t("hints.phone")}</p>}
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor={`${uid}-email`}>
              {t("fields.email")} <span className="text-muted font-normal">({tc("optional")})</span>
            </Label>
            <Input {...fieldProps("email")} type="email" autoComplete="email" maxLength={254} />
            {errors.email ? errorText("email") : <p className="text-muted text-sm">{t("hints.email")}</p>}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-city`}>
            {t("fields.city")} <span className="text-muted font-normal">({tc("optional")})</span>
          </Label>
          <Input {...fieldProps("city")} autoComplete="address-level2" maxLength={80} />
          {errorText("city")}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-note`}>
            {t("fields.note")} <span className="text-muted font-normal">({tc("optional")})</span>
          </Label>
          <Textarea {...fieldProps("note")} rows={3} className="min-h-24" maxLength={500} />
          {errorText("note")}
        </div>
        <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      </section>

      {/* ── Payment ── */}
      <section className="card grid gap-4 p-6 md:p-8" aria-labelledby={`${uid}-pay`}>
        <h2 id={`${uid}-pay`} className="text-h3">
          {t("paymentTitle")}
        </h2>
        <div role="radiogroup" aria-labelledby={`${uid}-pay`} className="grid gap-3">
          {payment.online ? (
            <label
              className={cn(
                "flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors",
                method === "online" ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-surface-2",
              )}
            >
              <input type="radio" name="payment" value="online" checked={method === "online"} onChange={() => setMethod("online")} className="accent-[var(--color-accent)] mt-1 size-4" />
              <span className="grid gap-0.5">
                <span className="flex items-center gap-2 font-medium">
                  <CreditCard className="size-4" aria-hidden /> {t("payOnline")}
                </span>
                <span className="text-muted text-sm">{t("payOnlineNote", { minutes: payment.holdMinutes })}</span>
              </span>
            </label>
          ) : null}
          {payment.hotel ? (
            <label
              className={cn(
                "flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors",
                method === "hotel" ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-surface-2",
              )}
            >
              <input type="radio" name="payment" value="hotel" checked={method === "hotel"} onChange={() => setMethod("hotel")} className="accent-[var(--color-accent)] mt-1 size-4" />
              <span className="grid gap-0.5">
                <span className="flex items-center gap-2 font-medium">
                  <Hotel className="size-4" aria-hidden /> {t("payHotel")}
                </span>
                <span className="text-muted text-sm">{t("payHotelNote")}</span>
              </span>
            </label>
          ) : null}
        </div>
        {errorText("payment")}
        <p className="text-muted bg-surface-2 rounded-xl p-4 text-sm">{idPolicy}</p>
        <div className="grid gap-1">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" {...fieldProps("terms")} className="accent-[var(--color-accent)] mt-0.5 size-5 shrink-0" />
            <span>
              {t.rich("terms", {
                hours: freeCancelHours,
                terms: (chunks) => (
                  <Link href="/terms" target="_blank" className="text-ink underline decoration-accent underline-offset-2 hover:decoration-2">
                    {chunks}
                  </Link>
                ),
                cancellation: (chunks) => (
                  <Link href="/cancellation-policy" target="_blank" className="text-ink underline decoration-accent underline-offset-2 hover:decoration-2">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {errorText("terms")}
        </div>
        {formError ? (
          <p role="alert" className="border-danger/40 bg-danger/10 text-danger rounded-xl border px-4 py-3">
            {formError}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy} className="w-full">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
          {paying
            ? t("opening")
            : submitting
              ? t("submitting")
              : method === "online"
                ? t("payNow", { amount: formatINR(quote.totalPaise, true) })
                : t("confirm")}
        </Button>
        <p className="text-muted text-center text-xs">{t("secure")}</p>
      </section>
    </form>
  );
}
