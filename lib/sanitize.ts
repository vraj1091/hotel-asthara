import { z } from "zod";

/** Remove HTML tags, control characters and collapse whitespace. All user text is rendered as plain text. */
export function cleanText(input: string, max = 2000): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export const zText = (min = 1, max = 200) =>
  z
    .string()
    .transform((s) => cleanText(s, max))
    .pipe(
      z
        .string()
        .min(min, min > 0 ? "This field is required." : undefined)
        .max(max),
    );

export const zOptionalText = (max = 200) =>
  z
    .string()
    .optional()
    .transform((s) => (s ? cleanText(s, max) : undefined))
    .transform((s) => (s ? s : undefined));

/** Indian mobile number. Accepts +91 / 0 prefixes and spaces, returns 10 digits. */
export const zMobile = z
  .string()
  .transform((s) => s.replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number."));

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);

export const zDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), "Invalid date.");
