"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { BedDouble, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";

export type BookingDefaults = {
  today: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
};

/**
 * Stay search. Dates come from the live price calendar and travel in hidden inputs, so the form is a plain GET to
 * /rooms and the default search works before JavaScript loads. `hero` is the glass bar, `compact` the sticky one.
 */
export function BookingBar({
  defaults,
  variant = "hero",
  maxRooms = 4,
  maxNights = 15,
  className,
}: {
  defaults: BookingDefaults;
  variant?: "hero" | "compact" | "page" | "header";
  maxRooms?: number;
  maxNights?: number;
  className?: string;
}) {
  const t = useTranslations("booking");
  const uid = useId();
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [error, setError] = useState("");
  const header = variant === "header";
  const compact = variant === "compact" || header;

  const field = header ? "relative grid gap-0 px-3.5 py-1" : "relative grid gap-0.5 px-4 py-2.5 md:py-2";
  const label = header
    ? "flex items-center gap-1 text-[0.7rem] leading-tight text-muted"
    : "flex items-center gap-1.5 text-xs text-muted";
  const control = header
    ? "h-6 w-full min-w-0 cursor-pointer bg-transparent text-sm text-ink outline-none"
    : "h-9 w-full min-w-0 cursor-pointer bg-transparent text-base text-ink outline-none";

  return (
    <form
      action="/rooms"
      method="get"
      noValidate
      onSubmit={(e) => {
        if (!checkIn || !checkOut || checkOut <= checkIn) {
          e.preventDefault();
          setError(t("dateError"));
        }
      }}
      className={cn(
        "divide-line border-line-strong grid divide-y rounded-2xl border md:grid-cols-[2.2fr_0.8fr_0.8fr_auto] md:items-stretch md:divide-x md:divide-y-0",
        variant === "page"
          ? "bg-bg shadow-soft"
          : "bg-bg/55 shadow-lift supports-[not(backdrop-filter:blur(1px))]:bg-bg backdrop-blur-xl",
        compact && "bg-bg/95 rounded-full md:[&>*]:py-0",
        header && "bg-surface-2 shadow-none backdrop-blur-none md:grid-cols-[2fr_1fr_1fr_auto]",
        className,
      )}
    >
      <DateRangePicker
        appearance={header ? "slim" : "bar"}
        today={defaults.today}
        checkIn={checkIn}
        checkOut={checkOut}
        maxNights={maxNights}
        onChange={(nextIn, nextOut) => {
          setCheckIn(nextIn);
          setCheckOut(nextOut);
          setError("");
        }}
      />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <div className="divide-line grid grid-cols-2 divide-x md:contents">
        <label htmlFor={`${uid}-guests`} className={field}>
          <span className={label}>
            <UsersRound className="size-3.5" aria-hidden />
            {t("guests")}
          </span>
          <select
            id={`${uid}-guests`}
            name="guests"
            defaultValue={defaults.guests}
            className={control}
          >
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n} className="bg-bg text-ink">
                {t("guestCount", { count: n })}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${uid}-rooms`} className={field}>
          <span className={label}>
            <BedDouble className="size-3.5" aria-hidden />
            {t("rooms")}
          </span>
          <select
            id={`${uid}-rooms`}
            name="rooms"
            defaultValue={defaults.rooms}
            className={control}
          >
            {Array.from({ length: maxRooms }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n} className="bg-bg text-ink">
                {t("roomCount", { count: n })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={header ? "p-1.5 md:flex md:items-center" : "p-2.5 md:flex md:items-center"}>
        <Button type="submit" size={header ? "sm" : "lg"} className={cn("w-full md:w-auto", compact && !header && "h-11", header && "h-9 px-5")}>
          <Search aria-hidden />
          {compact ? t("searchShort") : t("search")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-danger px-4 py-2 text-sm md:col-span-4">
          {error}
        </p>
      ) : null}
    </form>
  );
}
