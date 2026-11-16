"use server";

import { headers } from "next/headers";
import { runAction, ActionError, type ActionResult } from "@/lib/action";
import { db } from "@/lib/db";
import { enquiryInput, enquirySchema } from "@/lib/enquiry-form";
import { clientIp, LIMITS, rateLimit } from "@/lib/rate-limit";
import { emailLayout, sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";

/** Errors are translation keys under "contact.errors" (see lib/enquiry-form.ts). */
export async function submitEnquiry(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const ip = clientIp(await headers());
    const limit = await rateLimit("contact", ip, LIMITS.contact);
    if (!limit.ok) throw new ActionError("rateLimited");

    const parsed = enquirySchema.safeParse(enquiryInput(formData));
    if (!parsed.success) {
      // A filled honeypot gets a silent success so bots learn nothing.
      if (parsed.error.issues.some((i) => i.path[0] === "website")) return;
      throw new ActionError("fields", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const { name, email, phone, message } = parsed.data;
    const enquiry = await db.enquiry.create({
      data: { name, email: email || null, phone: phone || null, message },
    });
    await notifyHotel(enquiry.id, { name, email, phone, message });
  });
}

async function notifyHotel(
  id: string,
  e: { name: string; email?: string; phone?: string; message: string },
) {
  try {
    const settings = await getSettings();
    const to = settings.notifications.hotelEmails.length
      ? settings.notifications.hotelEmails
      : settings.contact.email
        ? [settings.contact.email]
        : [];
    if (!to.length) return;
    const { html, text } = emailLayout({
      hotelName: settings.hotel.name,
      title: `New message from ${e.name}`,
      rows: [
        ["Phone", e.phone || "—"],
        ["Email", e.email || "—"],
      ],
      paragraphs: [e.message],
      button: { label: "Reply in admin", url: absoluteUrl(`/admin/enquiries/${id}`) },
    });
    await sendEmail({
      kind: "enquiry.hotel",
      to,
      subject: `New enquiry from ${e.name}`,
      html,
      text,
      replyTo: e.email || undefined,
    });
  } catch (error) {
    console.error("[enquiry] notification failed", error);
  }
}
