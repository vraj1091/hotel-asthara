"use client";

import { useId } from "react";
import { useFormErrors } from "@/components/admin/forms";
import { AmenityIcon } from "@/components/ui/amenity-icon";
import { ICON_NAMES } from "@/features/cms/admin-constants";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  MapPin: "Map pin",
  Heart: "Heart",
  Clock: "Clock",
  Phone: "Phone",
  BedDouble: "Bed",
  Users: "People",
  ShieldCheck: "Shield",
  Sparkles: "Sparkles",
  Wifi: "WiFi",
  Snowflake: "Air conditioning",
  Tv: "TV",
  ConciergeBell: "Service bell",
  ShowerHead: "Shower",
  DoorClosed: "Wardrobe",
  LampDesk: "Desk lamp",
  CarFront: "Car",
  Zap: "Power",
  ArrowUpDown: "Lift",
  Coffee: "Coffee",
  Shirt: "Laundry",
  Droplets: "Water",
  GraduationCap: "College",
  Store: "Shop",
  TrainFront: "Train",
  Route: "Road",
};

/** Radio grid of the icons the public site can draw. Submits `name` (default "icon"). */
export function IconPicker({ name = "icon", defaultValue }: { name?: string; defaultValue?: string }) {
  const uid = useId();
  const { errors } = useFormErrors();
  const error = errors[name]?.[0];
  return (
    <fieldset className="grid gap-2" aria-describedby={error ? `${uid}-msg` : undefined}>
      <legend className="mb-1 text-sm font-medium">Icon</legend>
      <div className="flex flex-wrap gap-1.5">
        {ICON_NAMES.map((icon) => (
          <label key={icon} title={LABELS[icon] ?? icon} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={icon}
              defaultChecked={defaultValue === icon}
              className="peer sr-only"
            />
            <span
              className={cn(
                "border-line-strong text-ink grid size-10 place-items-center rounded-xl border transition-colors",
                "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
                "peer-focus-visible:ring-accent peer-focus-visible:ring-2 hover:bg-surface-2",
              )}
            >
              <AmenityIcon name={icon} className="size-5" />
            </span>
            <span className="sr-only">{LABELS[icon] ?? icon}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${uid}-msg`} role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
