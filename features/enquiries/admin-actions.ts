"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ActionError } from "@/lib/action";
import { adminAction } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { emailConfigured, emailLayout, sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";

const zId = z.string().min(1).max(40);
const zStatus = z.enum(["NEW", "IN_PROGRESS", "REPLIED", "CLOSED"]);

export async function setEnquiryStatus(formData: FormData) {
  return adminAction("enquiries:write", async (staff) => {
    const id = zId.parse(formData.get("id"));
    const status = zStatus.parse(formData.get("status"));
    await db.enquiry.update({
      where: { id },
      data: { status, ...(status !== "NEW" ? { readAt: new Date() } : { readAt: null }) },
    });
    await writeAudit({ userId: staff.id, action: "enquiry.status", entity: "Enquiry", entityId: id, meta: { status } });
    revalidatePath("/admin/enquiries");
  }, "Status updated.");
}

export async function deleteEnquiry(formData: FormData) {
  return adminAction("enquiries:write", async (staff) => {
    const id = zId.parse(formData.get("id"));
    await db.enquiry.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ userId: staff.id, action: "enquiry.delete", entity: "Enquiry", entityId: id });
    revalidatePath("/admin/enquiries");
    if (formData.get("redirect") === "1") redirect("/admin/enquiries");
  }, "Enquiry deleted.");
}

const replySchema = z.object({
  id: zId,
  reply: z.string().trim().min(5, "Write a reply of at least a few words.").max(5000),
  send: z.enum(["email", "note"]),
});

/** Saves the reply and, when chosen and possible, emails it to the guest. */
export async function replyToEnquiry(_prev: unknown, formData: FormData) {
  return adminAction("enquiries:write", async (staff) => {
    const input = replySchema.parse(Object.fromEntries(formData));
    const enquiry = await db.enquiry.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!enquiry) throw new ActionError("That enquiry no longer exists.");
    let message = "Reply saved.";
    if (input.send === "email") {
      if (!enquiry.email)
        throw new ActionError("This guest left no email address. Call them and save the reply as a note.", {
          send: ["No email address on this enquiry."],
        });
      if (!emailConfigured())
        throw new ActionError("Email is not set up yet (RESEND_API_KEY). Save the reply as a note instead.", {
          send: ["Email sending is not configured."],
        });
      const settings = await getSettings();
      const { html, text } = emailLayout({
        hotelName: settings.hotel.name,
        title: enquiry.subject ? `Re: ${enquiry.subject}` : "Reply to your message",
        intro: `Dear ${enquiry.name},`,
        paragraphs: [
          input.reply,
          `Warm regards,\n${staff.name}\n${settings.hotel.name}${settings.contact.phone ? `\n${settings.contact.phone}` : ""}`,
        ],
        footer: `Your message: “${enquiry.message.slice(0, 400)}${enquiry.message.length > 400 ? "…" : ""}”`,
      });
      const sent = await sendEmail({
        kind: "enquiry.reply",
        to: enquiry.email,
        subject: enquiry.subject ? `Re: ${enquiry.subject}` : `Reply from ${settings.hotel.name}`,
        html,
        text,
        replyTo: settings.contact.email || undefined,
      });
      if (!sent.ok) throw new ActionError("The email could not be sent. Check Settings → Email log, or try again.");
      message = "Reply emailed to the guest.";
    }
    await db.enquiry.update({
      where: { id: enquiry.id },
      data: {
        replyBody: input.reply,
        repliedAt: new Date(),
        status: "REPLIED",
        readAt: enquiry.readAt ?? new Date(),
      },
    });
    await writeAudit({
      userId: staff.id,
      action: input.send === "email" ? "enquiry.reply_email" : "enquiry.reply_note",
      entity: "Enquiry",
      entityId: enquiry.id,
    });
    revalidatePath("/admin/enquiries");
    return { message };
  }).then((r) => (r.ok ? { ...r, message: r.data.message } : r));
}
