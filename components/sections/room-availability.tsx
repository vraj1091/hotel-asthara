"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { formatINR } from "@/lib/utils";
import type { BookingDefaults } from "@/components/sections/booking-bar";

type Result = {
  nights: number;
  roomsWanted: number;
  available: number;
  total: number;
  perRoom: {
    subtotalPaise: number;
    taxPaise: number;
    totalPaise: number;
    averageRatePaise: number;
    rules: string[];
  };
};

/** Live availability and price for this room. Re-checks whenever the dates or room count change. */
export function RoomAvailability({
  slug,
  defaults,
  maxRooms,
  maxNights,
}: {
  slug: string;
  defaults: BookingDefaults;
  maxRooms: number;
  maxNights: number;
}) {
  const t = useTranslations("rooms");
  const tb = useTranslations("booking");
  const tc = useTranslations("common");
  const uid = useId();
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [rooms, setRooms] = useState(defaults.rooms);
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    data?: Result;
    error?: string;
  }>({ status: "loading" });

  const datesValid = !!checkIn && !!checkOut && checkOut > checkIn;

  useEffect(() => {
    if (!datesValid) return;
    const ctrl = new AbortController();
    setState({ status: "loading" });
    const params = new URLSearchParams({
      slug,
      checkIn,
      checkOut,
      rooms: String(rooms),
      guests: String(defaults.guests),
    });
    fetch(`/api/availability?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not check availability.");
        setState({ status: "ready", data: json as Result });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ status: "error", error: e.message });
      });
    return () => ctrl.abort();
  }, [slug, checkIn, checkOut, rooms, defaults.guests, datesValid]);

  const data = state.data;
  const canBook = state.status === "ready" && data && data.available >= rooms;
  const bookHref = `/book?${new URLSearchParams({ room: slug, checkIn, checkOut, rooms: String(rooms), guests: String(defaults.guests) })}`;
  const input = "h-12 w-full rounded-xl border border-line-strong bg-bg px-3 text-base";

  return (
    <div className="card grid gap-5 p-6">
      <DateRangePicker
        appearance="boxed"
        slug={slug}
        today={defaults.today}
        checkIn={checkIn}
        checkOut={checkOut}
        maxNights={maxNights}
        onChange={(nextIn, nextOut) => {
          setCheckIn(nextIn);
          setCheckOut(nextOut);
        }}
      />
      <div className="grid gap-1.5">
        <label htmlFor={`${uid}-rooms`} className="text-sm font-medium">
          {tb("rooms")}
        </label>
        <select
          id={`${uid}-rooms`}
          value={rooms}
          onChange={(e) => setRooms(Number(e.target.value))}
          className={input}
        >
          {Array.from({ length: maxRooms }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {tb("roomCount", { count: n })}
            </option>
          ))}
        </select>
      </div>

      <div aria-live="polite" className="min-h-28">
        {!datesValid ? (
          <p role="alert" className="text-danger">
            {tb("dateError")}
          </p>
        ) : state.status === "loading" ? (
          <div className="grid gap-2" aria-label={t("checking")}>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : state.status === "error" ? (
          <p role="alert" className="text-danger">
            {state.error}
          </p>
        ) : data ? (
          <div className="grid gap-2">
            {data.available === 0 ? (
              <Badge tone="dark" className="w-fit">
                {t("soldOut")}
              </Badge>
            ) : data.available < rooms ? (
              <Badge tone="dark" className="w-fit">
                {t("left", { count: data.available })}
              </Badge>
            ) : data.available <= 3 ? (
              <Badge tone="gold" className="w-fit">
                {t("left", { count: data.available })}
              </Badge>
            ) : (
              <Badge tone="success" className="w-fit">
                {t("available")}
              </Badge>
            )}
            <p className="font-sans text-3xl font-semibold tabular-nums">
              {formatINR(data.perRoom.totalPaise * rooms)}
            </p>
            <p className="text-muted text-sm">
              {t("total", { nights: data.nights })}, {tb("roomCount", { count: rooms })}.{" "}
              {t("taxNote", { tax: formatINR(data.perRoom.taxPaise * rooms) })}
            </p>
            <p className="text-muted text-sm">
              {formatINR(data.perRoom.averageRatePaise)} {tc("perNight")}, {tc("plusTax")}
              {data.perRoom.rules.length ? ` (${data.perRoom.rules.join(", ")})` : ""}
            </p>
          </div>
        ) : null}
      </div>

      {canBook ? (
        <Button asChild size="lg" className="w-full">
          <Link href={bookHref}>{t("requestBook")}</Link>
        </Button>
      ) : (
        <Button size="lg" className="w-full" disabled>
          {t("requestBook")}
        </Button>
      )}
    </div>
  );
}
