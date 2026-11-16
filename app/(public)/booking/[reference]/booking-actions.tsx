"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CreditCard, Hotel, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  cancelBookingAsGuest,
  confirmOnlinePayment,
  payBookingOnline,
  switchToPayAtHotel,
} from "@/features/bookings/public-actions";
import { openRazorpay } from "@/lib/razorpay-client";

function useCountdown(until: string | null) {
  const [left, setLeft] = useState<number | null>(() => (until ? new Date(until).getTime() - Date.now() : null));
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(new Date(until).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);
  return left;
}

export function BookingActions({
  reference,
  hotelName,
  description,
  holdExpiresAt,
  canPayOnline,
  balanceLabel,
  canSwitch,
  canCancel,
  freeCancelHours,
}: {
  reference: string;
  hotelName: string;
  description: string;
  holdExpiresAt: string | null;
  canPayOnline: boolean;
  balanceLabel: string;
  canSwitch: boolean;
  canCancel: boolean;
  freeCancelHours: number;
}) {
  const t = useTranslations("manage");
  const tc = useTranslations("checkout");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"pay" | "switch" | "cancel" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const left = useCountdown(holdExpiresAt);
  const expired = left !== null && left <= 0;
  const msg = (key: string) => (tc.has(`errors.${key}`) ? tc(`errors.${key}`) : key);

  useEffect(() => {
    if (expired) router.refresh();
  }, [expired, router]);

  if (!canPayOnline && !canSwitch && !canCancel) return null;

  const mm = left !== null && left > 0 ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}` : null;

  function pay() {
    setWhich("pay");
    start(async () => {
      const res = await payBookingOnline(reference);
      if (!res.ok) {
        toast.error(msg(res.error));
        router.refresh();
        return;
      }
      const outcome = await openRazorpay({
        keyId: res.data.keyId,
        orderId: res.data.orderId,
        amountPaise: res.data.amountPaise,
        name: hotelName,
        description: `${reference} · ${description}`,
        prefill: res.data.prefill,
        notes: { reference },
      });
      if (outcome.status === "paid") {
        const ok = await confirmOnlinePayment({ reference, orderId: outcome.orderId, paymentId: outcome.paymentId, signature: outcome.signature });
        if (ok.ok) toast.success(t("paidToast"));
        else toast.error(msg(ok.error));
        router.replace(`/booking/${reference}?paid=1`);
        router.refresh();
      } else if (outcome.status === "unavailable") toast.error(t("paymentUnavailable"));
    });
  }

  function switchToHotel() {
    setWhich("switch");
    start(async () => {
      const res = await switchToPayAtHotel(reference);
      if (res.ok) {
        toast.success(t("switchedToast"));
        router.replace(`/booking/${reference}`);
        router.refresh();
      } else toast.error(msg(res.error));
    });
  }

  function cancel() {
    setWhich("cancel");
    start(async () => {
      const res = await cancelBookingAsGuest(reference);
      setConfirmCancel(false);
      if (res.ok) {
        toast.success(res.data.refunded ? t("cancelledRefundToast") : t("cancelledToast"));
        router.refresh();
      } else toast.error(msg(res.error));
    });
  }

  return (
    <div className="card grid gap-4 p-6 md:p-8">
      <h2 className="text-h3">{t("manageTitle")}</h2>
      {mm ? (
        <p className="text-warning font-medium" role="timer" aria-live="off">
          {t("holdLeft", { time: mm })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {canPayOnline ? (
          <Button onClick={pay} disabled={pending} aria-busy={pending && which === "pay"} size="lg">
            {pending && which === "pay" ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
            {t("payNow", { amount: balanceLabel })}
          </Button>
        ) : null}
        {canSwitch ? (
          <Button onClick={switchToHotel} disabled={pending} variant="outline" size="lg">
            {pending && which === "switch" ? <Loader2 className="animate-spin" aria-hidden /> : <Hotel aria-hidden />}
            {t("switch")}
          </Button>
        ) : null}
        {canCancel ? (
          <Button onClick={() => setConfirmCancel(true)} disabled={pending} variant="ghost" size="lg" className="text-danger">
            <XCircle aria-hidden />
            {t("cancel")}
          </Button>
        ) : null}
      </div>
      {canCancel ? <p className="text-muted text-sm">{t("cancelNote", { hours: freeCancelHours })}</p> : null}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogTitle className="font-heading pr-10 text-xl">{t("cancelConfirmTitle")}</DialogTitle>
          <DialogDescription className="text-muted mt-2">{t("cancelConfirmBody", { reference })}</DialogDescription>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              {t("keep")}
            </Button>
            <Button variant="danger" onClick={cancel} disabled={pending} aria-busy={pending}>
              {pending && which === "cancel" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("cancelConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
