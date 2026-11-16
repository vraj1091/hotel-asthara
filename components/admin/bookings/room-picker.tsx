"use client";

import { Check, Wrench } from "lucide-react";
import type { RoomForStay } from "@/lib/booking-engine";
import { cn, formatINR } from "@/lib/utils";

/** Rooms grouped by type as toggle buttons. Taken and maintenance rooms are shown but cannot be picked. */
export function RoomPicker({
  rooms,
  error,
  selected,
  onChange,
}: {
  rooms: RoomForStay[] | null;
  error?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (error)
    return (
      <p role="alert" className="text-danger text-sm">
        {error}
      </p>
    );
  if (rooms === null)
    return (
      <div className="grid gap-3" aria-label="Loading rooms">
        <div className="skeleton h-5 w-40" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-16 w-24" />
          ))}
        </div>
      </div>
    );
  if (rooms.length === 0) return <p className="text-muted text-sm">No rooms are set up yet. Add them in Rooms & rates.</p>;

  const groups = new Map<string, RoomForStay[]>();
  for (const r of rooms) groups.set(r.roomTypeId, [...(groups.get(r.roomTypeId) ?? []), r]);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="grid gap-5">
      {[...groups.values()].map((list) => {
        const first = list[0]!;
        const free = list.filter((r) => r.free && r.status === "ACTIVE").length;
        return (
          <fieldset key={first.roomTypeId} className="grid gap-2">
            <legend className="mb-1 flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="font-medium">{first.roomTypeName}</span>
              <span className="text-muted">
                {free} of {list.length} free · {formatINR(first.baseRatePaise)} / night · sleeps {first.maxAdults + first.maxChildren}
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {list.map((r) => {
                const available = r.free && r.status === "ACTIVE";
                const on = selected.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={!available}
                    aria-pressed={on}
                    onClick={() => toggle(r.id)}
                    className={cn(
                      "relative grid min-h-16 w-24 content-center justify-items-center rounded-xl border px-2 text-sm transition-colors",
                      on
                        ? "border-accent bg-accent text-on-accent font-semibold"
                        : available
                          ? "border-line-strong hover:bg-surface-2"
                          : "border-line bg-surface-2 text-muted cursor-not-allowed line-through",
                    )}
                  >
                    {on ? <Check className="absolute top-1.5 right-1.5 size-3.5" aria-hidden /> : null}
                    <span className="text-base tabular-nums">{r.number}</span>
                    <span className="text-[0.7rem] no-underline">
                      {r.status === "MAINTENANCE" ? (
                        <span className="inline-flex items-center gap-1">
                          <Wrench className="size-3" aria-hidden /> Maintenance
                        </span>
                      ) : available ? (
                        `Floor ${r.floor}`
                      ) : (
                        "Taken"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
