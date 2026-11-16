"use client";

import { useState } from "react";
import { ActionForm, BilingualField, Checkbox, FormField, SubmitButton } from "@/components/admin/forms";
import { MediaPickerField } from "@/components/admin/media-picker";
import { Input, NativeSelect } from "@/components/ui/input";
import { saveCoupon, saveOffer } from "@/features/offers/actions";

export type OfferFormValue = {
  id?: string;
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  imageUrl: string;
  couponId: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export function OfferForm({
  offer,
  coupons,
}: {
  offer: OfferFormValue;
  coupons: { id: string; code: string; label: string }[];
}) {
  return (
    <ActionForm action={saveOffer} className="grid gap-6" successMessage="Offer saved.">
      {offer.id ? <input type="hidden" name="id" value={offer.id} /> : null}
      <BilingualField name="title" label="Title" maxLength={120} defaultValue={{ en: offer.title, hi: offer.titleHi }} />
      <BilingualField
        name="description"
        label="Description"
        multiline
        rows={3}
        maxLength={1000}
        defaultValue={{ en: offer.description, hi: offer.descriptionHi }}
        hint="Say who it is for and what the guest gets. Keep it to one or two sentences."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <MediaPickerField name="imageUrl" label="Image (optional)" folder="offers" defaultValue={offer.imageUrl} />
        <div className="grid content-start gap-5">
          <FormField
            name="couponId"
            label="Promo code"
            optional
            hint="Guests type this code at checkout. Create codes in the Promo codes tab."
          >
            <NativeSelect defaultValue={offer.couponId}>
              <option value="">No code (information only)</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField name="startsAt" label="Show from" optional>
              <Input type="date" defaultValue={offer.startsAt} />
            </FormField>
            <FormField name="endsAt" label="Show until" optional hint="Inclusive, India time.">
              <Input type="date" defaultValue={offer.endsAt} />
            </FormField>
          </div>
          <Checkbox name="active" label="Active" defaultChecked={offer.active} hint="Inactive offers are hidden from the website." />
        </div>
      </div>
      <SubmitButton className="w-fit">{offer.id ? "Save offer" : "Create offer"}</SubmitButton>
    </ActionForm>
  );
}

export type CouponFormValue = {
  id?: string;
  code: string;
  kind: "PERCENT" | "FLAT";
  value: string;
  maxDiscount: string;
  minNights: string;
  minAmount: string;
  usageLimit: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export function CouponForm({ coupon }: { coupon: CouponFormValue }) {
  const [kind, setKind] = useState(coupon.kind);
  return (
    <ActionForm action={saveCoupon} className="grid gap-6" successMessage="Promo code saved.">
      {coupon.id ? <input type="hidden" name="id" value={coupon.id} /> : null}
      <div className="grid gap-5 md:grid-cols-3">
        <FormField name="code" label="Code" hint="Capital letters, numbers and hyphens, e.g. MONSOON15.">
          <Input
            defaultValue={coupon.code}
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9\-]{3,30}"
            className="font-mono uppercase"
            autoComplete="off"
            spellCheck={false}
          />
        </FormField>
        <FormField name="kind" label="Discount type">
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as "PERCENT" | "FLAT")}>
            <option value="PERCENT">Percentage off</option>
            <option value="FLAT">Fixed amount off (₹)</option>
          </NativeSelect>
        </FormField>
        <FormField
          name="value"
          label={kind === "PERCENT" ? "Percentage" : "Amount (₹)"}
          hint={kind === "PERCENT" ? "1 to 100, applied before GST." : "Taken off the room charges, before GST."}
        >
          <Input
            defaultValue={coupon.value}
            required
            inputMode="decimal"
            type="number"
            min={kind === "PERCENT" ? 1 : 1}
            max={kind === "PERCENT" ? 100 : 1000000}
            step={kind === "PERCENT" ? 1 : "any"}
          />
        </FormField>
      </div>
      <div className="grid gap-5 md:grid-cols-4">
        {kind === "PERCENT" ? (
          <FormField name="maxDiscount" label="Maximum discount (₹)" optional>
            <Input defaultValue={coupon.maxDiscount} type="number" min={1} step="any" inputMode="decimal" />
          </FormField>
        ) : null}
        <FormField name="minNights" label="Minimum nights">
          <Input defaultValue={coupon.minNights} type="number" min={1} max={30} required inputMode="numeric" />
        </FormField>
        <FormField name="minAmount" label="Minimum booking (₹)" optional hint="Before GST.">
          <Input defaultValue={coupon.minAmount} type="number" min={0} step="any" inputMode="decimal" />
        </FormField>
        <FormField name="usageLimit" label="Usage limit" optional hint="Empty = unlimited.">
          <Input defaultValue={coupon.usageLimit} type="number" min={1} step={1} inputMode="numeric" />
        </FormField>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <FormField name="startsAt" label="Valid from" optional>
          <Input type="date" defaultValue={coupon.startsAt} />
        </FormField>
        <FormField name="endsAt" label="Valid until" optional hint="Inclusive, India time.">
          <Input type="date" defaultValue={coupon.endsAt} />
        </FormField>
        <div className="pt-7">
          <Checkbox name="active" label="Active" defaultChecked={coupon.active} />
        </div>
      </div>
      <SubmitButton className="w-fit">{coupon.id ? "Save promo code" : "Create promo code"}</SubmitButton>
    </ActionForm>
  );
}
