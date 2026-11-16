import { z } from "zod";
import { cleanText } from "@/lib/sanitize";

/**
 * Contact-form message. Shared by the browser (instant field messages) and the server (the real check).
 * Error messages are translation keys under "contact.errors" so both languages get proper messages.
 */
export const enquirySchema = z
  .object({
    name: z
      .string()
      .transform((s) => cleanText(s, 100))
      .pipe(z.string().min(2, "name")),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "email")
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "email"),
    phone: z
      .string()
      .transform((s) => s.replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, ""))
      .pipe(z.string().regex(/^([6-9]\d{9})?$/, "phone")),
    message: z
      .string()
      .transform((s) => cleanText(s, 2000))
      .pipe(z.string().min(10, "message")),
    website: z.string().max(0, "website"), // honeypot: real people never fill this in
  })
  .refine((v) => !!v.email || !!v.phone, { message: "needOne", path: ["email"] });

export const enquiryInput = (fd: FormData) => ({
  name: String(fd.get("name") ?? ""),
  email: String(fd.get("email") ?? ""),
  phone: String(fd.get("phone") ?? ""),
  message: String(fd.get("message") ?? ""),
  website: String(fd.get("website") ?? ""),
});
