"use client";

import { useEffect, useState } from "react";
import { CalendarCog, Loader2 } from "lucide-react";
import { ActionForm, FormField, SubmitButton, useFormErrors } from "@/components/admin/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import {
  loadRoomsForStay,
  previewQuote,
  recordPayment,
  updateBookingGuest,
  updateBookingNotes,
  updateStay,
} from "@/features/bookings/admin-actions";
import type { RoomForStay } from "@/lib/booking-engine";
import { formatINR } from "@/lib/utils";
import { RoomPicker } from "./room-picker";

/* ───────── Record payment / refund ───────── */

export function PaymentForm({ id, balancePaise, paidPaise }: { id: string; balancePaise: number; paidPaise: number }) {
  const [kind, setKind] = useState<"payment" | "refund">(balancePaise > 0 || paidPaise <= 0 ? "payment" : "refund");
  const suggested = kind === "payment" ? Math.max(0, balancePaise) : Math.max(0, -balancePaise);
  return (
    <ActionForm action={recordPayment} successMessage={null} resetOnSuccess className="grid gap-4" key={`${kind}-${balancePaise}`}>
      <input type="hidden" name="id" value={id} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Type</legend>
        {(["payment", "refund"] as const).map((k) => (
          <label
            key={k}
            className="border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm"
          >
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" disabled={k === "refund" && paidPaise <= 0} />
            {k === "payment" ? "Payment received" : "Refund given"}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="method" label="Method">
          <NativeSelect defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="RAZORPAY">Razorpay (outside this site)</option>
          </NativeSelect>
        </FormField>
        <FormField name="amount" label="Amount (₹)">
          <Input inputMode="decimal" required pattern="[\d,.\s₹]+" defaultValue={suggested ? String(suggested / 100) : ""} />
        </FormField>
      </div>
      <FormField name="note" label="Note" optional>
        <Input maxLength={200} placeholder="UPI reference, receipt number…" />
      </FormField>
      <SubmitButton size="sm" className="w-fit" pendingLabel="Recording…">
        {kind === "payment" ? "Record payment" : "Record refund"}
      </SubmitButton>
    </ActionForm>
  );
}

/* ───────── Guest + notes ───────── */

export function GuestForm({
  id,
  guest,
  adults,
  childrenCount,
}: {
  id: string;
  guest: { name: string; phone: string; email: string | null; city: string | null };
  adults: number;
  childrenCount: number;
}) {
  return (
    <ActionForm action={updateBookingGuest} successMessage={null} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="name" label="Full name">
          <Input defaultValue={guest.name} required minLength={2} maxLength={100} />
        </FormField>
        <FormField name="phone" label="Mobile">
          <Input type="tel" defaultValue={guest.phone} required />
        </FormField>
        <FormField name="email" label="Email" optional>
          <Input type="email" defaultValue={guest.email ?? ""} />
        </FormField>
        <FormField name="city" label="City" optional>
          <Input defaultValue={guest.city ?? ""} maxLength={80} />
        </FormField>
        <FormField name="adults" label="Adults">
          <Input type="number" min={1} max={40} defaultValue={adults} required />
        </FormField>
        <FormField name="children" label="Children">
          <Input type="number" min={0} max={40} defaultValue={childrenCount} required />
        </FormField>
      </div>
      <p className="text-muted text-sm">Changes apply to the guest&apos;s profile too.</p>
      <SubmitButton size="sm" className="w-fit">Save guest</SubmitButton>
    </ActionForm>
  );
}

export function NotesForm({ id, specialRequests, internalNotes }: { id: string; specialRequests: string | null; internalNotes: string | null }) {
  return (
    <ActionForm action={updateBookingNotes} successMessage={null} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <FormField name="specialRequests" label="Guest requests" optional>
        <Textarea rows={3} className="min-h-0" maxLength={1000} defaultValue={specialRequests ?? ""} />
      </FormField>
      <FormField name="internalNotes" label="Internal notes" optional hint="Only staff see these.">
        <Textarea rows={3} className="min-h-0" maxLength={2000} defaultValue={internalNotes ?? ""} />
      </FormField>
      <SubmitButton size="sm" className="w-fit">Save notes</SubmitButton>
    </ActionForm>
  );
}

/* ───────── Change dates / rooms ───────── */

function RoomError() {
  const { errors } = useFormErrors();
  return errors.roomIds?.[0] ? (
    <p role="alert" className="text-danger text-sm">
      {errors.roomIds[0]}
    </p>
  ) : null;
}

export function EditStayDialog({
  id,
  checkIn: initialIn,
  checkOut: initialOut,
  roomIds: initialRooms,
  totalPaise,
  today,
}: {
  id: string;
  checkIn: string;
  checkOut: string;
  roomIds: string[];
  totalPaise: number;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [checkIn, setCheckIn] = useState(initialIn);
  const [checkOut, setCheckOut] = useState(initialOut);
  const [rooms, setRooms] = useState<RoomForStay[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(initialRooms);
  const [rate, setRate] = useState("");
  const [preview, setPreview] = useState<{ total: number } | { error: string } | null>(null);
  const datesOk = !!checkIn && !!checkOut && checkOut > checkIn;

  useEffect(() => {
    if (!open || !datesOk) return;
    let live = true;
    setRooms(null);
    setError("");
    loadRoomsForStay({ checkIn, checkOut, excludeBookingId: id }).then((r) => {
      if (!live) return;
      if (r.ok) setRooms(r.data);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [open, checkIn, checkOut, datesOk, id]);

  const key = selected.slice().sort().join(",");
  useEffect(() => {
    if (!open || !datesOk || !key) {
      setPreview(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      const n = Number(rate.replace(/[,₹\s]/g, ""));
      previewQuote({ checkIn, checkOut, roomIds: key.split(","), ratePaise: rate.trim() && n > 0 ? Math.round(n * 100) : null }).then((r) => {
        if (live) setPreview(r.ok ? { total: r.data.totalPaise } : { error: r.error });
      });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, checkIn, checkOut, datesOk, key, rate]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarCog aria-hidden /> Change dates or rooms
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
          <DialogTitle className="font-heading pr-10 text-xl">Change dates or rooms</DialogTitle>
          <DialogDescription className="text-muted mt-1 text-sm">
            The booking is re-priced at today&apos;s rates for the new dates (any promo code is re-applied). Payments already recorded stay as they are.
          </DialogDescription>
          <ActionForm action={updateStay} successMessage={null} onSuccess={() => setOpen(false)} className="mt-5 grid gap-5">
            <input type="hidden" name="id" value={id} />
            {selected.map((r) => (
              <input key={r} type="hidden" name="roomIds" value={r} />
            ))}
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField name="checkIn" label="Check-in">
                <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required min={initialIn < today ? initialIn : today} />
              </FormField>
              <FormField name="checkOut" label="Check-out">
                <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required min={checkIn} />
              </FormField>
              <FormField name="rate" label="Nightly rate (₹)" optional hint="Before GST. Empty = room rates.">
                <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} pattern="[\d,.\s₹]*" />
              </FormField>
            </div>
            {!datesOk ? <p className="text-danger text-sm" role="alert">Check-out must be after check-in.</p> : <RoomPicker rooms={rooms} error={error} selected={selected} onChange={setSelected} />}
            <RoomError />
            <div aria-live="polite" className="bg-surface-2 rounded-xl px-4 py-3 text-sm">
              Current total <span className="font-medium tabular-nums">{formatINR(totalPaise, true)}</span>
              {preview === null ? null : "error" in preview ? (
                <span className="text-danger block">{preview.error}</span>
              ) : (
                <>
                  {" "}→ new total <span className="font-semibold tabular-nums">{formatINR(preview.total, true)}</span>
                </>
              )}
              {preview === null && datesOk && key ? <Loader2 className="ml-2 inline size-4 animate-spin" aria-label="Calculating" /> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton disabled={!datesOk || !selected.length}>Save new stay</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
