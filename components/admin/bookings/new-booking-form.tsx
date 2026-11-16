"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, Loader2, Search, UserRound, X } from "lucide-react";
import { ActionForm, Checkbox, FormField, SubmitButton, useFormErrors } from "@/components/admin/forms";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import {
  createWalkInBooking,
  loadRoomsForStay,
  previewQuote,
  searchGuests,
  type GuestMatch,
} from "@/features/bookings/admin-actions";
import type { RoomForStay, SelectionQuote } from "@/lib/booking-engine";
import { cn, formatINR } from "@/lib/utils";
import { RoomPicker } from "./room-picker";

export type PrefillGuest = { id: string; name: string; phone: string; email: string | null; city: string | null };

const toPaise = (v: string) => {
  const n = Number(v.replace(/[,₹\s]/g, ""));
  return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function RoomsError() {
  const { errors } = useFormErrors();
  const e = errors.roomIds?.[0];
  return e ? (
    <p role="alert" className="text-danger text-sm">
      {e}
    </p>
  ) : null;
}

export function NewBookingForm({
  defaults,
  prefill,
  canPay,
}: {
  defaults: { checkIn: string; checkOut: string; roomId?: string; today: string };
  prefill: PrefillGuest | null;
  canPay: boolean;
}) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [rooms, setRooms] = useState<RoomForStay[] | null>(null);
  const [roomsError, setRoomsError] = useState("");
  const [selected, setSelected] = useState<string[]>(defaults.roomId ? [defaults.roomId] : []);
  const [rate, setRate] = useState("");
  const [discount, setDiscount] = useState("");
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState<{ status: "idle" | "loading" | "ready" | "error"; data?: SelectionQuote; error?: string }>({ status: "idle" });

  const [guest, setGuest] = useState({
    id: prefill?.id ?? "",
    name: prefill?.name ?? "",
    phone: prefill?.phone ?? "",
    email: prefill?.email ?? "",
    city: prefill?.city ?? "",
  });
  const [lookup, setLookup] = useState("");
  const [matches, setMatches] = useState<GuestMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [payMethod, setPayMethod] = useState("");

  const datesOk = !!checkIn && !!checkOut && checkOut > checkIn;

  // Rooms for the chosen dates
  useEffect(() => {
    if (!datesOk) {
      setRooms(null);
      return;
    }
    let live = true;
    setRooms(null);
    setRoomsError("");
    loadRoomsForStay({ checkIn, checkOut }).then((r) => {
      if (!live) return;
      if (r.ok) {
        setRooms(r.data);
        // Drop selections that are no longer free.
        setSelected((prev) => prev.filter((id) => r.data.some((x) => x.id === id && x.free && x.status === "ACTIVE")));
      } else setRoomsError(r.error);
    });
    return () => {
      live = false;
    };
  }, [checkIn, checkOut, datesOk]);

  // Live price
  const dRate = useDebounced(rate, 400);
  const dDiscount = useDebounced(discount, 400);
  const dCoupon = useDebounced(coupon, 500);
  const selectedKey = selected.slice().sort().join(",");
  useEffect(() => {
    if (!datesOk || !selectedKey) {
      setQuote({ status: "idle" });
      return;
    }
    let live = true;
    setQuote((q) => ({ ...q, status: "loading" }));
    previewQuote({
      checkIn,
      checkOut,
      roomIds: selectedKey.split(","),
      ratePaise: toPaise(dRate),
      couponCode: dCoupon,
      discountPaise: toPaise(dDiscount),
    }).then((r) => {
      if (!live) return;
      setQuote(r.ok ? { status: "ready", data: r.data } : { status: "error", error: r.error });
    });
    return () => {
      live = false;
    };
  }, [checkIn, checkOut, datesOk, selectedKey, dRate, dDiscount, dCoupon]);

  // Guest lookup
  const dLookup = useDebounced(lookup, 300);
  useEffect(() => {
    if (dLookup.trim().length < 3) {
      setMatches(null);
      return;
    }
    let live = true;
    setSearching(true);
    searchGuests(dLookup).then((r) => {
      if (!live) return;
      setSearching(false);
      setMatches(r.ok ? r.data : []);
    });
    return () => {
      live = false;
    };
  }, [dLookup]);

  const capacity = useMemo(
    () => (rooms ?? []).filter((r) => selected.includes(r.id)).reduce((s, r) => s + r.maxAdults + r.maxChildren, 0),
    [rooms, selected],
  );
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const overCapacity = selected.length > 0 && adults + children > capacity;

  return (
    <ActionForm action={createWalkInBooking} successMessage="Booking created." className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid gap-6">
        {/* Stay */}
        <section className="card grid gap-5 p-5 shadow-none" aria-labelledby="nb-stay">
          <h2 id="nb-stay" className="font-sans text-base font-semibold">Stay</h2>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <FormField name="checkIn" label="Check-in">
              <Input
                type="date"
                className="min-w-0"
                value={checkIn}
                min={defaults.today}
                required
                onChange={(e) => {
                  const v = e.target.value;
                  setCheckIn(v);
                  if (v && (!checkOut || checkOut <= v)) {
                    const d = new Date(`${v}T00:00:00Z`);
                    d.setUTCDate(d.getUTCDate() + 1);
                    setCheckOut(d.toISOString().slice(0, 10));
                  }
                }}
              />
            </FormField>
            <FormField name="checkOut" label="Check-out">
              <Input type="date" className="min-w-0" value={checkOut} min={checkIn || defaults.today} required onChange={(e) => setCheckOut(e.target.value)} />
            </FormField>
            <FormField name="adults" label="Adults">
              <Input type="number" min={1} max={40} value={adults} onChange={(e) => setAdults(Number(e.target.value) || 1)} required />
            </FormField>
            <FormField name="children" label="Children">
              <Input type="number" min={0} max={40} value={children} onChange={(e) => setChildren(Number(e.target.value) || 0)} required />
            </FormField>
          </div>
          {!datesOk ? <p className="text-danger text-sm" role="alert">Check-out must be after check-in.</p> : null}
        </section>

        {/* Rooms */}
        <section className="card grid gap-4 p-5 shadow-none" aria-labelledby="nb-rooms">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="nb-rooms" className="font-sans text-base font-semibold">Rooms</h2>
            <p className="text-muted text-sm" aria-live="polite">
              {selected.length ? `${selected.length} selected, sleeps up to ${capacity}` : "Choose one or more free rooms"}
            </p>
          </div>
          {selected.map((id) => (
            <input key={id} type="hidden" name="roomIds" value={id} />
          ))}
          <RoomPicker rooms={rooms} error={roomsError} selected={selected} onChange={setSelected} />
          <RoomsError />
          {overCapacity ? (
            <p className="text-warning text-sm" role="status">
              {adults + children} guests is more than the selected rooms sleep ({capacity}). Add a room or an extra bed note.
            </p>
          ) : null}
        </section>

        {/* Guest */}
        <section className="card grid gap-5 p-5 shadow-none" aria-labelledby="nb-guest">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="nb-guest" className="font-sans text-base font-semibold">Guest</h2>
            {guest.id ? (
              <span className="bg-accent-soft inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm">
                <UserRound className="size-4" aria-hidden /> Returning guest
                <button
                  type="button"
                  className="hover:bg-surface-3 -mr-1 grid size-6 place-items-center rounded-full"
                  aria-label="Use a new guest instead"
                  onClick={() => setGuest({ id: "", name: "", phone: "", email: "", city: "" })}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ) : null}
          </div>
          <input type="hidden" name="guestId" value={guest.id} />
          {!guest.id ? (
            <div className="relative grid gap-1.5">
              <label htmlFor="nb-lookup" className="text-sm font-medium">
                Find a returning guest <span className="text-muted font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Search className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" aria-hidden />
                <Input
                  id="nb-lookup"
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  placeholder="Phone, name or email"
                  className="pl-10"
                  autoComplete="off"
                  aria-describedby="nb-lookup-status"
                />
                {searching ? <Loader2 className="text-muted absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin" aria-hidden /> : null}
              </div>
              <div id="nb-lookup-status" aria-live="polite">
                {matches && matches.length === 0 ? <p className="text-muted text-sm">No saved guest matches. Fill in the details below.</p> : null}
                {matches && matches.length > 0 ? (
                  <ul className="border-line divide-line mt-1 divide-y overflow-hidden rounded-xl border">
                    {matches.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="hover:bg-surface-2 flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left text-sm"
                          onClick={() => {
                            setGuest({ id: m.id, name: m.name, phone: m.phone, email: m.email ?? "", city: m.city ?? "" });
                            setLookup("");
                            setMatches(null);
                          }}
                        >
                          <span>
                            <span className="font-medium">{m.name}</span> <span className="text-muted tabular-nums">{m.phone}</span>
                          </span>
                          <span className="text-muted text-xs">
                            {m.bookings} booking{m.bookings === 1 ? "" : "s"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="name" label="Full name">
              <Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} required minLength={2} maxLength={100} autoComplete="off" />
            </FormField>
            <FormField name="phone" label="Mobile number">
              <Input type="tel" inputMode="tel" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} required pattern="[\d\s+\(\)\-]{10,16}" autoComplete="off" />
            </FormField>
            <FormField name="email" label="Email" optional>
              <Input type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} autoComplete="off" />
            </FormField>
            <FormField name="city" label="City" optional>
              <Input value={guest.city} onChange={(e) => setGuest({ ...guest, city: e.target.value })} maxLength={80} autoComplete="off" />
            </FormField>
            <FormField name="idType" label="ID type" optional>
              <NativeSelect defaultValue="">
                <option value="">Not recorded yet</option>
                <option value="AADHAAR">Aadhaar</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVING_LICENCE">Driving licence</option>
                <option value="VOTER_ID">Voter ID</option>
                <option value="OTHER_GOVT_ID">Other government ID</option>
              </NativeSelect>
            </FormField>
            <FormField name="idNumber" label="ID number" optional hint="Stored encrypted. Only staff allowed to see IDs can reveal it.">
              <Input maxLength={30} autoComplete="off" pattern="[A-Za-z0-9 \-]*" />
            </FormField>
          </div>
        </section>

        {/* Details */}
        <section className="card grid gap-5 p-5 shadow-none" aria-labelledby="nb-details">
          <h2 id="nb-details" className="font-sans text-base font-semibold">Booking details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="source" label="Booked by">
              <NativeSelect defaultValue="WALK_IN">
                <option value="WALK_IN">Walk-in</option>
                <option value="PHONE">Phone call</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="OTHER">Other</option>
              </NativeSelect>
            </FormField>
            <FormField name="status" label="Status">
              <NativeSelect defaultValue={defaults.checkIn === defaults.today ? "CHECKED_IN" : "CONFIRMED"}>
                <option value="CONFIRMED">Confirmed (arriving later)</option>
                <option value="CHECKED_IN">Checked in now</option>
              </NativeSelect>
            </FormField>
            <FormField name="rate" label="Negotiated nightly rate (₹)" optional hint="Before GST, per room. Leave empty to use the room's current rate.">
              <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 1500" pattern="[\d,.\s₹]*" />
            </FormField>
            <FormField name="discount" label="Discount (₹)" optional hint="Taken off the room charges before GST.">
              <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" pattern="[\d,.\s₹]*" />
            </FormField>
            <FormField name="couponCode" label="Promo code" optional>
              <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} maxLength={40} autoComplete="off" className="uppercase" />
            </FormField>
          </div>
          <FormField name="specialRequests" label="Guest requests" optional>
            <Textarea rows={2} className="min-h-0" maxLength={1000} />
          </FormField>
          <FormField name="internalNotes" label="Internal notes" optional hint="Only staff see these.">
            <Textarea rows={2} className="min-h-0" maxLength={1000} />
          </FormField>
        </section>

        {/* Payment */}
        {canPay ? (
          <section className="card grid gap-5 p-5 shadow-none" aria-labelledby="nb-pay">
            <div>
              <h2 id="nb-pay" className="font-sans text-base font-semibold">Payment taken now</h2>
              <p className="text-muted text-sm">Optional. You can also record payments later on the booking.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField name="payMethod" label="Method" optional>
                <NativeSelect value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="">No payment yet</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                </NativeSelect>
              </FormField>
              <FormField name="payAmount" label="Amount (₹)" optional>
                <Input
                  inputMode="decimal"
                  pattern="[\d,.\s₹]*"
                  disabled={!payMethod}
                  placeholder={quote.data ? String(quote.data.totalPaise / 100) : ""}
                  required={!!payMethod}
                />
              </FormField>
              <FormField name="payNote" label="Note" optional>
                <Input maxLength={200} disabled={!payMethod} placeholder="UPI ref, receipt no…" />
              </FormField>
            </div>
          </section>
        ) : null}
      </div>

      {/* Summary */}
      <aside className="card grid gap-4 p-5 shadow-none lg:sticky lg:top-6" aria-labelledby="nb-summary">
        <h2 id="nb-summary" className="font-sans text-base font-semibold">Price</h2>
        <div aria-live="polite" className="min-h-28">
          {quote.status === "idle" ? (
            <p className="text-muted flex items-center gap-2 text-sm">
              <BedDouble className="size-4" aria-hidden /> Choose dates and rooms to see the price.
            </p>
          ) : quote.status === "error" ? (
            <p className="text-danger text-sm" role="alert">{quote.error}</p>
          ) : (
            <div className={cn("grid gap-2 text-sm transition-opacity", quote.status === "loading" && "opacity-50")}>
              {quote.data ? (
                <>
                  {quote.data.rooms.map((r) => (
                    <div key={r.roomId} className="flex justify-between gap-3">
                      <span className="text-muted">
                        {r.number} · {r.roomTypeName}
                      </span>
                      <span className="tabular-nums">{formatINR(r.subtotalPaise)}</span>
                    </div>
                  ))}
                  <hr className="border-line" />
                  <div className="flex justify-between">
                    <span className="text-muted">
                      Room charges, {quote.data.nights} night{quote.data.nights === 1 ? "" : "s"}
                    </span>
                    <span className="tabular-nums">{formatINR(quote.data.subtotalPaise)}</span>
                  </div>
                  {quote.data.discountPaise ? (
                    <div className="flex justify-between">
                      <span className="text-muted">Discount{quote.data.coupon ? ` (${quote.data.coupon.code}, ${quote.data.coupon.label})` : ""}</span>
                      <span className="tabular-nums">− {formatINR(quote.data.discountPaise)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-muted">GST</span>
                    <span className="tabular-nums">{formatINR(quote.data.taxPaise, true)}</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="font-medium">Total</span>
                    <span className="font-sans text-2xl font-semibold tabular-nums">{formatINR(quote.data.totalPaise, true)}</span>
                  </div>
                  {quote.data.couponError ? <p className="text-danger" role="alert">{quote.data.couponError}</p> : null}
                </>
              ) : (
                <Loader2 className="text-muted size-5 animate-spin" aria-label="Calculating price" />
              )}
            </div>
          )}
        </div>
        <Checkbox name="sendEmail" label="Email a confirmation to the guest" hint="Needs the guest's email address." />
        <SubmitButton size="lg" className="w-full" pendingLabel="Creating booking…" disabled={!datesOk || selected.length === 0}>
          Create booking
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Cancel
        </Button>
      </aside>
    </ActionForm>
  );
}
