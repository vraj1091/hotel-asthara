import { z } from "zod";

/**
 * Guest details for a website booking. Shared by the browser (instant field messages) and the server (the real
 * check). Error messages are translation keys under "checkout.errors" so both languages get proper messages.
 */
const clean = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

export const guestDetailsSchema = z.object({
  name: z
    .string()
    .transform(clean)
    .pipe(z.string().min(2, "name").max(100, "name").regex(/^[^\d@]+$/u, "name")),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "phone")),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "email")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "email"),
  city: z.string().transform(clean).pipe(z.string().max(80, "city")),
  note: z.string().transform(clean).pipe(z.string().max(500, "note")),
  payment: z.enum(["online", "hotel"], { errorMap: () => ({ message: "payment" }) }),
  terms: z.literal("on", { errorMap: () => ({ message: "terms" }) }),
});

export type GuestDetails = z.infer<typeof guestDetailsSchema>;

/** Field → error key, for the first issue on each field. */
export function fieldErrorKeys(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "form");
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

export const lookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^AST-\d{6}-[A-Z0-9]{4,6}$/, "reference"),
  contact: z.string().trim().min(5, "contact").max(254, "contact"),
});
