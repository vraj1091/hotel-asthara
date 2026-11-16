import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ───────── Money (paise ⇄ rupees) ───────── */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 249900 → "₹2,499". Use `precise` on invoices to show paise. */
export function formatINR(paise: number, precise = false) {
  const rupees = paise / 100;
  return (precise || paise % 100 !== 0 ? inrPrecise : inr).format(rupees);
}

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);
export const paiseToRupees = (paise: number) => paise / 100;

/* ───────── Calendar days ─────────
   Stay dates are plain calendar days. We keep them as UTC-midnight Dates (what Prisma returns
   for @db.Date) and "YYYY-MM-DD" strings in URLs, so there is never a timezone off-by-one. */

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayString(value: string | null | undefined): value is string {
  if (!value || !DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function parseDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
}

/** Today's calendar day in India, regardless of where the server runs. */
export function todayIST(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parseDay(parts);
}

export function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const out: Date[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatDay(
  date: Date | string,
  locale = "en-IN",
  opts?: Intl.DateTimeFormatOptions,
) {
  const d = typeof date === "string" ? parseDay(date) : date;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...opts,
  }).format(d);
}

export function formatDateTime(date: Date, locale = "en-IN") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/* ───────── Strings ───────── */

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strip everything but digits, e.g. "0124-6201611" → "01246201611". */
export const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function telHref(phone: string) {
  const d = digitsOnly(phone);
  return d ? `tel:+91${d.replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "")}` : "";
}

export function whatsappHref(number: string, text?: string) {
  let d = digitsOnly(number).replace(/^0+/, "");
  if (d.length === 10) d = `91${d}`;
  if (!d) return "";
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function absoluteUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "13:30" → "1:30 PM". */
export function formatTime(hhmm: string) {
  const [h = "0", m = "00"] = hhmm.split(":");
  const hour = Number(h);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m.padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
