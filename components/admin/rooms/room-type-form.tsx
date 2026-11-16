"use client";

import { useState } from "react";
import { ActionForm, BilingualField, Checkbox, FormField, SubmitButton } from "@/components/admin/forms";
import { Input } from "@/components/ui/input";
import { saveRoomType } from "@/features/rooms/admin-actions";
import { slugify } from "@/lib/utils";

export type RoomTypeFormValues = {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  summary: string;
  summaryHi: string;
  description: string;
  descriptionHi: string;
  sizeSqFt: number;
  bedType: string;
  maxAdults: number;
  maxChildren: number;
  baseRatePaise: number;
  extraBedPaise: number | null;
  amenities: string[];
  featured: boolean;
  active: boolean;
};

const rupees = (paise: number | null | undefined) => (paise ? String(paise / 100) : "");

export function RoomTypeForm({
  room,
  amenityOptions,
  readOnly,
}: {
  room?: RoomTypeFormValues;
  amenityOptions: { key: string; label: string }[];
  readOnly?: boolean;
}) {
  const [slug, setSlug] = useState(room?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!room);

  return (
    <ActionForm action={saveRoomType} className="grid gap-8" successMessage="Room type saved.">
      {room ? <input type="hidden" name="id" value={room.id} /> : null}
      <fieldset disabled={readOnly} className="grid gap-8 disabled:opacity-80">
        <div
          className="grid gap-6"
          onInput={(e) => {
            const t = e.target as HTMLInputElement;
            if (t.name === "nameEn" && !slugTouched) setSlug(slugify(t.value));
          }}
        >
          <BilingualField
            name="name"
            label="Room name"
            defaultValue={room ? { en: room.name, hi: room.nameHi } : undefined}
            maxLength={100}
          />
          <FormField
            name="slug"
            label="Web address"
            hint={`The room page will be at /rooms/${slug || "…"}. Lower-case letters, numbers and hyphens.`}
          >
            <Input
              value={slug}
              required
              minLength={2}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              className="max-w-md"
            />
          </FormField>
          <BilingualField
            name="summary"
            label="Short summary (room cards)"
            defaultValue={room ? { en: room.summary, hi: room.summaryHi } : undefined}
            maxLength={300}
          />
          <BilingualField
            name="description"
            label="Full description (room page)"
            multiline
            rows={5}
            defaultValue={room ? { en: room.description, hi: room.descriptionHi } : undefined}
            maxLength={3000}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField name="baseRate" label="Base rate per night (₹, before GST)" hint="Rate rules can change it for weekends, seasons and festivals.">
            <Input inputMode="decimal" required defaultValue={rupees(room?.baseRatePaise)} placeholder="1799" />
          </FormField>
          <FormField name="extraBed" label="Extra bed per night (₹)" optional hint="Leave empty if extra beds are not offered.">
            <Input inputMode="decimal" defaultValue={rupees(room?.extraBedPaise)} />
          </FormField>
          <FormField name="sizeSqFt" label="Size (sq ft)">
            <Input type="number" min={30} max={20000} required defaultValue={room?.sizeSqFt ?? ""} />
          </FormField>
          <FormField name="bedType" label="Bed type">
            <Input required maxLength={80} defaultValue={room?.bedType ?? ""} placeholder="Double bed" />
          </FormField>
          <FormField name="maxAdults" label="Maximum adults">
            <Input type="number" min={1} max={12} required defaultValue={room?.maxAdults ?? 2} />
          </FormField>
          <FormField name="maxChildren" label="Maximum children">
            <Input type="number" min={0} max={12} required defaultValue={room?.maxChildren ?? 1} />
          </FormField>
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">In this room</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {amenityOptions.map((a) => (
              <Checkbox
                key={a.key}
                name="amenities"
                value={a.key}
                label={a.label}
                defaultChecked={room ? room.amenities.includes(a.key) : ["ac", "wifi", "tv", "bathroom"].includes(a.key)}
              />
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox
            name="active"
            label="Bookable on the website"
            hint="Hidden room types stay in the admin but guests cannot see or book them."
            defaultChecked={room?.active ?? true}
          />
          <Checkbox
            name="featured"
            label="Featured"
            hint="Shown first and larger on the homepage."
            defaultChecked={room?.featured ?? false}
          />
        </div>
      </fieldset>
      {readOnly ? (
        <p className="text-muted text-sm">You can view room details. Ask a manager to change them.</p>
      ) : (
        <SubmitButton className="w-fit">{room ? "Save changes" : "Create room type"}</SubmitButton>
      )}
    </ActionForm>
  );
}
