"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, cn, dayKey, formatDay, formatINR, nightsBetween, parseDay } from "@/lib/utils";

type DayInfo = { date: string; ratePaise: number | null; available: number };

const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;

function shiftMonth(first: string, n: number) {
  const d = parseDay(first);
  return dayKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

/** Cells for one month, Sunday first, padded with nulls before the 1st. */
function monthCells(first: string): (string | null)[] {
  const start = parseDay(first);
  const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  return [
    ...Array.from({ length: start.getUTCDay() }, () => null),
    ...Array.from({ length: count }, (_, i) => dayKey(addDays(start, i))),
  ];
}

/** 179900 → "₹1.8k": short enough to sit under a date. The full price is in the cell's accessible name. */
function compactINR(paise: number) {
  const r = paise / 100;
  return r >= 1000 ? `₹${(r / 1000).toFixed(1).replace(/\.0$/, "")}k` : `₹${Math.round(r)}`;
}

/**
 * Check-in / check-out range picker with a live price calendar.
 * Each night shows its lowest rate, sold-out nights are struck through, and a range can never cross a sold-out night
 * (though you can check out on one). Arrow keys move by day and week, Page Up/Down by four weeks.
 */
export function DateRangePicker({
  today,
  checkIn,
  checkOut,
  onChange,
  slug,
  maxNights = 15,
  appearance = "bar",
}: {
  today: string;
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  slug?: string;
  maxNights?: number;
  appearance?: "bar" | "boxed" | "slim";
}) {
  const t = useTranslations("calendar");
  const locale = useLocale() === "hi" ? "hi-IN" : "en-IN";
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => firstOfMonth(checkIn || today));
  const [start, setStart] = useState<string | null>(null); // set while the guest is between first and second click
  const [hover, setHover] = useState<string | null>(null);
  const [focusDay, setFocusDay] = useState(checkIn || today);
  const [info, setInfo] = useState<Record<string, DayInfo>>({});
  const [loading, setLoading] = useState(false);
  const fetched = useRef(new Set<string>());
  const gridRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || fetched.current.has(view)) return;
    fetched.current.add(view);
    const from = view < today ? today : view;
    const days = nightsBetween(parseDay(from), parseDay(shiftMonth(view, 2)));
    if (days <= 0) return;
    setLoading(true);
    const params = new URLSearchParams({ from, days: String(days), ...(slug ? { slug } : {}) });
    fetch(`/api/calendar?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("calendar"))))
      .then((json: { days: DayInfo[] }) =>
        setInfo((prev) => ({ ...prev, ...Object.fromEntries(json.days.map((d) => [d.date, d])) })),
      )
      .catch(() => fetched.current.delete(view)) // prices are a bonus: the calendar still works without them
      .finally(() => setLoading(false));
  }, [open, view, today, slug]);

  /** Latest allowed check-out for the chosen check-in: the first sold-out night after it, or the max stay. */
  const limit = useMemo(() => {
    if (!start) return null;
    for (let i = 1; i < maxNights; i++) {
      const night = dayKey(addDays(parseDay(start), i));
      if (info[night]?.available === 0) return night;
    }
    return dayKey(addDays(parseDay(start), maxNights));
  }, [start, info, maxNights]);

  const rangeStart = start ?? checkIn;
  const rangeEnd = start
    ? hover && limit && hover > start && hover <= limit
      ? hover
      : null
    : checkOut;

  function handleOpenChange(next: boolean) {
    if (next) {
      setView(firstOfMonth(checkIn || today));
      setFocusDay(checkIn || today);
    } else if (start) {
      // Closed after choosing only a check-in: assume one night.
      onChange(start, dayKey(addDays(parseDay(start), 1)));
    }
    setStart(null);
    setHover(null);
    setOpen(next);
  }

  function pick(day: string) {
    const soldOut = info[day]?.available === 0;
    if (start && limit && day > start && day <= limit) {
      onChange(start, day);
      setStart(null);
      setHover(null);
      setOpen(false);
    } else if (day >= today && !soldOut) {
      setStart(day);
      setHover(null);
    }
  }

  function focusOn(day: string) {
    setFocusDay(day);
    const find = () => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${day}"]`);
    requestAnimationFrame(() => {
      const el = find();
      if (el && el.offsetParent !== null) return el.focus();
      setView(firstOfMonth(day)); // the day is in a month that is not on screen
      requestAnimationFrame(() => find()?.focus());
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      PageUp: -28,
      PageDown: 28,
    };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    const next = dayKey(addDays(parseDay(focusDay), step));
    focusOn(next < today ? today : next);
  }

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
          new Date(Date.UTC(2023, 0, 1 + i)),
        ),
      ),
    [locale],
  );

  const renderMonth = (first: string, className?: string) => (
    <div className={className}>
      <p className="font-heading mb-3 text-center text-lg" aria-live="polite">
        {new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(parseDay(first))}
      </p>
      <div className="text-muted grid grid-cols-7 text-center text-xs" aria-hidden>
        {weekdays.map((w) => (
          <span key={w} className="pb-2">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {monthCells(first).map((day, i) => {
          if (!day) return <span key={`pad-${i}`} />;
          const d = info[day];
          const soldOut = d?.available === 0;
          const asCheckOut = !!start && !!limit && day > start && day <= limit;
          const selectable = asCheckOut || (day >= today && !soldOut);
          const isStart = day === rangeStart;
          const isEnd = day === rangeEnd;
          const inRange = !!rangeEnd && day > rangeStart && day < rangeEnd;
          const label = [
            formatDay(day, locale, { weekday: "long", day: "numeric", month: "long" }),
            soldOut ? t("soldOut") : d?.ratePaise ? formatINR(d.ratePaise) : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={day}
              type="button"
              data-date={day}
              tabIndex={day === focusDay ? 0 : -1}
              aria-label={label}
              aria-disabled={!selectable}
              aria-pressed={isStart || isEnd}
              onClick={() => selectable && pick(day)}
              onPointerEnter={() => start && setHover(day)}
              onFocus={() => {
                setFocusDay(day);
                if (start) setHover(day);
              }}
              className={cn(
                "grid h-12 content-center justify-items-center gap-1 rounded-xl text-sm tabular-nums transition-colors duration-150",
                selectable
                  ? "hover:bg-surface-3 cursor-pointer"
                  : "text-muted/45 cursor-not-allowed",
                inRange && "bg-accent-soft hover:bg-accent-soft rounded-none",
                (isStart || isEnd) && "bg-accent text-on-accent hover:bg-accent font-semibold",
                isStart && rangeEnd && "rounded-r-none",
                isEnd && "rounded-l-none",
                day === today && !isStart && !isEnd && "ring-line-strong ring-1 ring-inset",
              )}
            >
              <span className={cn("leading-none", soldOut && !asCheckOut && "line-through")}>
                {Number(day.slice(8))}
              </span>
              <span
                className={cn(
                  "text-[0.625rem] leading-none",
                  isStart || isEnd ? "text-on-accent" : "text-muted",
                )}
                aria-hidden
              >
                {selectable && d?.ratePaise && !soldOut ? compactINR(d.ratePaise) : " "}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const boxed = appearance === "boxed";
  const slim = appearance === "slim";
  const cell = boxed
    ? "grid gap-1.5 text-left"
    : slim
      ? "grid gap-0 px-3.5 py-1 text-left"
      : "grid gap-0.5 px-4 py-2.5 text-left md:py-2";
  const cellLabel = boxed
    ? "text-sm font-medium"
    : slim
      ? "flex items-center gap-1 text-[0.7rem] leading-tight text-muted"
      : "flex items-center gap-1.5 text-xs text-muted";
  const cellValue = boxed
    ? "flex h-12 items-center rounded-xl border border-line-strong bg-bg px-3 text-base"
    : slim
      ? "flex h-6 items-center whitespace-nowrap text-sm text-ink"
      : "flex h-9 items-center whitespace-nowrap text-base text-ink";
  const status = start
    ? t("pickCheckOut")
    : checkIn && checkOut
      ? t("selected", {
          nights: nightsBetween(parseDay(checkIn), parseDay(checkOut)),
          checkIn: formatDay(checkIn, locale),
          checkOut: formatDay(checkOut, locale),
        })
      : t("pickCheckIn");

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Anchor asChild>
        <div className={cn("grid grid-cols-2", boxed ? "gap-3" : "divide-line divide-x")}>
          {(
            [
              ["checkIn", checkIn],
              ["checkOut", checkOut],
            ] as const
          ).map(([key, value], i) => (
            <button
              key={key}
              ref={i === 0 ? triggerRef : undefined}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => handleOpenChange(!open)}
              className={cn(cell, !boxed && "rounded-xl")}
            >
              <span className={cellLabel}>
                {boxed ? null : <CalendarDays className={slim ? "size-3" : "size-3.5"} aria-hidden />}
                {t(key)}
              </span>
              <span className={cellValue}>{value ? formatDay(value, locale) : t("addDate")}</span>
            </button>
          ))}
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-label={t("open")}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            focusOn(checkIn || today);
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            triggerRef.current?.focus();
          }}
          className="border-line bg-bg text-ink shadow-lift z-50 w-[min(43rem,calc(100vw-1.5rem))] rounded-2xl border p-4 md:p-6"
        >
          <div className="relative" ref={gridRef} onKeyDown={onKeyDown}>
            <button
              type="button"
              aria-label={t("prev")}
              disabled={view <= firstOfMonth(today)}
              onClick={() => setView(shiftMonth(view, -1))}
              className="hover:bg-surface-3 absolute top-0 left-0 grid size-9 place-items-center rounded-full disabled:opacity-30"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label={t("next")}
              onClick={() => setView(shiftMonth(view, 1))}
              className="hover:bg-surface-3 absolute top-0 right-0 grid size-9 place-items-center rounded-full"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="grid gap-8 md:grid-cols-2">
              {renderMonth(view)}
              {renderMonth(shiftMonth(view, 1), "hidden md:block")}
            </div>
          </div>
          <hr className="hairline-solid my-4" />
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div>
              <p className="font-medium" role="status">
                {status}
              </p>
              <p className="text-muted text-sm">
                {loading ? t("loading") : slug ? t("priceNoteRoom") : t("priceNote")}
              </p>
            </div>
            <Popover.Close className="bg-ink text-bg h-10 rounded-full px-5 text-sm font-medium">
              {t("done")}
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
