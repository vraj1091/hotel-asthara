"use client";

import { useId, useState } from "react";
import { Ban, Check, Loader2, LogIn, LogOut, UserX } from "lucide-react";
import { ConfirmButton, useRunAction } from "@/components/admin/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { cancelBooking, setBookingStatus } from "@/features/bookings/admin-actions";

type Next = "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

export function StatusActions({
  id,
  next,
  canWrite,
  canCancel,
  hasEmail,
  balanceLabel,
  arrivesLater,
}: {
  id: string;
  next: Next[];
  canWrite: boolean;
  canCancel: boolean;
  hasEmail: boolean;
  balanceLabel: string | null;
  arrivesLater: boolean;
}) {
  const { run, pending } = useRunAction();
  const fields = (to: string) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("to", to);
    return fd;
  };
  const shown = next.filter((n) => (n === "CANCELLED" ? canCancel : canWrite));
  if (shown.length === 0) return <p className="text-muted text-sm">No further status changes for this booking.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {canWrite && next.includes("CONFIRMED") ? (
        <Button size="sm" disabled={pending} onClick={() => run(setBookingStatus, fields("CONFIRMED"))}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Confirm
        </Button>
      ) : null}
      {canWrite && next.includes("CHECKED_IN") ? (
        arrivesLater ? (
          <ConfirmButton
            action={setBookingStatus}
            fields={{ id, to: "CHECKED_IN" }}
            title="Check in before the arrival date?"
            body="This booking's check-in date is later than today. The stay dates do not change; edit the stay first if the guest is arriving early."
            confirmLabel="Check in anyway"
            danger={false}
            size="sm"
          >
            <LogIn aria-hidden /> Check in
          </ConfirmButton>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => run(setBookingStatus, fields("CHECKED_IN"))}>
            <LogIn aria-hidden /> Check in
          </Button>
        )
      ) : null}
      {canWrite && next.includes("CHECKED_OUT") ? (
        <ConfirmButton
          action={setBookingStatus}
          fields={{ id, to: "CHECKED_OUT" }}
          title="Check the guest out?"
          body={
            balanceLabel
              ? `There is still ${balanceLabel} to collect. Record the payment first unless you are settling it later.`
              : "If the guest leaves before the booked check-out date, the room becomes free from today."
          }
          confirmLabel="Check out"
          danger={false}
          size="sm"
        >
          <LogOut aria-hidden /> Check out
        </ConfirmButton>
      ) : null}
      {canWrite && next.includes("NO_SHOW") ? (
        <ConfirmButton
          action={setBookingStatus}
          fields={{ id, to: "NO_SHOW" }}
          title="Mark as no-show?"
          body="The rooms are released for these dates. This cannot be undone."
          confirmLabel="Mark no-show"
          size="sm"
          variant="outline"
        >
          <UserX aria-hidden /> No-show
        </ConfirmButton>
      ) : null}
      {canCancel && next.includes("CANCELLED") ? <CancelDialog id={id} hasEmail={hasEmail} /> : null}
    </div>
  );
}

function CancelDialog({ id, hasEmail }: { id: string; hasEmail: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(hasEmail);
  const { run, pending } = useRunAction();
  const uid = useId();
  return (
    <>
      <Button size="sm" variant="outline" className="text-danger" onClick={() => setOpen(true)}>
        <Ban aria-hidden /> Cancel booking
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="font-heading pr-10 text-xl">Cancel this booking?</DialogTitle>
          <DialogDescription className="text-muted mt-2">
            The rooms become free for these dates. Any refund is recorded separately under Payments.
          </DialogDescription>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.set("id", id);
              fd.set("reason", reason);
              if (notify) fd.set("notify", "on");
              run(cancelBooking, fd, { onDone: () => setOpen(false) });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor={`${uid}-reason`}>
                Reason <span className="text-muted font-normal">(optional)</span>
              </Label>
              <Textarea id={`${uid}-reason`} rows={3} className="min-h-0" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={notify}
                disabled={!hasEmail}
                onChange={(e) => setNotify(e.target.checked)}
                className="accent-[var(--color-accent)] mt-0.5 size-5"
              />
              <span>
                Email the guest that the booking is cancelled
                {!hasEmail ? <span className="text-muted block">No email address on this booking.</span> : null}
              </span>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Keep booking
              </Button>
              <Button type="submit" variant="danger" disabled={pending} aria-busy={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Cancel booking
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
