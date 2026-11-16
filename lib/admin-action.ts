import "server-only";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/action";
import type { Permission } from "@/lib/permissions";
import { cleanText } from "@/lib/sanitize";
import { requireAction, type Staff } from "@/lib/session";
import { isDayString, parseDay } from "@/lib/utils";

/**
 * Every admin server action goes through this: the permission is re-checked against the database (not the session
 * token), input errors become field messages, and unexpected errors never leak details to the browser.
 */
export async function adminAction<T>(
  permission: Permission,
  fn: (staff: Staff) => Promise<T>,
  message?: string,
): Promise<ActionResult<T>> {
  return runAction(async () => fn(await requireAction(permission)), message);
}

/* ───────── Reading FormData ───────── */

export const formObject = (fd: FormData) => {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
};

/** `${name}En` / `${name}Hi` from a <BilingualField>. */
export function bilingual(fd: FormData, name: string, max = 5000) {
  return {
    en: cleanText(String(fd.get(`${name}En`) ?? ""), max),
    hi: cleanText(String(fd.get(`${name}Hi`) ?? ""), max),
  };
}

/** Like bilingual() but keeps line breaks exactly (long text with paragraphs and "- " bullets). */
export function bilingualLong(fd: FormData, name: string, max = 20_000) {
  const keep = (v: FormDataEntryValue | null) =>
    String(v ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, max);
  return { en: keep(fd.get(`${name}En`)), hi: keep(fd.get(`${name}Hi`)) };
}

export const zL = (required = true, max = 5000) =>
  z.object({
    en: required ? z.string().min(1, "English text is required.").max(max) : z.string().max(max),
    hi: z.string().max(max),
  });

/* ───────── Zod helpers for form strings ───────── */

export const zCheckbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.undefined()])
  .transform((v) => v === "on" || v === "true" || v === "1");

export const zInt = (min = 0, max = 1_000_000) =>
  z.coerce
    .number({ invalid_type_error: "Enter a whole number." })
    .int("Enter a whole number.")
    .min(min, `Must be at least ${min}.`)
    .max(max, `Must be at most ${max}.`);

/** "1,799.50" or "1799" rupees → paise */
export const zRupees = (min = 0, max = 10_000_000) =>
  z
    .string()
    .transform((s) => s.replace(/[,₹\s]/g, ""))
    .pipe(
      z.coerce
        .number({ invalid_type_error: "Enter an amount in rupees." })
        .min(min, `Must be at least ₹${min}.`)
        .max(max),
    )
    .transform((r) => Math.round(r * 100));

export const zOptionalRupees = z
  .string()
  .optional()
  .transform((s) => (s ?? "").replace(/[,₹\s]/g, ""))
  .pipe(
    z.union([
      z.literal("").transform(() => null),
      z.coerce.number().min(0).max(10_000_000).transform((r) => Math.round(r * 100)),
    ]),
  );

export const zDayString = z
  .string()
  .refine((v) => isDayString(v), "Choose a valid date.")
  .transform((v) => parseDay(v));

export const zOptionalDay = z
  .string()
  .optional()
  .transform((v) => (v && isDayString(v) ? parseDay(v) : null));

/** Image URL picked from the media library or a photo slot. Only our own paths or HTTPS. */
export const zImageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (v) => v === "" || v.startsWith("/media/") || v.startsWith("/images/") || /^https:\/\/[^\s]+$/.test(v),
    "Choose an image from the media library.",
  );

export const zSlug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Use at least 2 characters.")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens only.");
