"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatTime } from "@/lib/utils";

const nowIST = () => {
  const d = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .split(":")
    .map(Number);
  return { time, minutes: (h ?? 0) * 60 + (m ?? 0) };
};
const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Live local time in Rohtak and whether the front desk is open right now (24 hours, or the hours set in the admin). */
export function HeroClock({
  initial,
  alwaysOpen,
  opens,
  closes,
}: {
  initial: string;
  alwaysOpen: boolean;
  opens: string;
  closes: string;
}) {
  const t = useTranslations("hero");
  const [now, setNow] = useState<{ time: string; minutes: number } | null>(null);
  useEffect(() => {
    setNow(nowIST());
    const id = setInterval(() => setNow(nowIST()), 15_000);
    return () => clearInterval(id);
  }, []);
  const time = now?.time ?? initial;
  let open = alwaysOpen;
  if (!alwaysOpen && now) {
    const o = toMinutes(opens);
    const c = toMinutes(closes);
    open = o <= c ? now.minutes >= o && now.minutes < c : now.minutes >= o || now.minutes < c;
  }
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex size-2" aria-hidden>
        {open ? <span className="live-ping bg-accent absolute inline-flex size-full rounded-full" /> : null}
        <span className={open ? "bg-accent relative inline-flex size-2 rounded-full" : "bg-muted relative inline-flex size-2 rounded-full"} />
      </span>
      <time suppressHydrationWarning>
        {alwaysOpen || (now && open)
          ? t("deskOpen", { time })
          : now
            ? t("deskClosed", { time, opens: formatTime(opens) })
            : t("timeIn", { time })}
      </time>
    </span>
  );
}
