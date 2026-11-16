import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { AdminCard, AdminPageHeader, DetailList, EnquiryStatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { deleteEnquiry, setEnquiryStatus } from "@/features/enquiries/admin-actions";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { formatDateTime, telHref, whatsappHref } from "@/lib/utils";
import { ReplyForm } from "./reply-form";

export const metadata = { title: "Enquiry" };

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage("enquiries:read");
  const { id } = await params;
  let enquiry = await db.enquiry.findFirst({ where: { id, deletedAt: null } });
  if (!enquiry) notFound();
  // Opening an enquiry marks it as read.
  if (!enquiry.readAt && can(staff.permissions, "enquiries:write")) {
    enquiry = await db.enquiry.update({
      where: { id },
      data: { readAt: new Date(), ...(enquiry.status === "NEW" ? { status: "IN_PROGRESS" } : {}) },
    });
  }
  const canWrite = can(staff.permissions, "enquiries:write");
  const e = enquiry;

  return (
    <>
      <AdminPageHeader
        title={e.subject || `Message from ${e.name}`}
        description={<>Received {formatDateTime(e.createdAt)}</>}
        back={{ href: "/admin/enquiries", label: "All enquiries" }}
        actions={<EnquiryStatusBadge status={e.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-6">
          <AdminCard title="Message">
            <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{e.message}</p>
          </AdminCard>
          {e.replyBody ? (
            <AdminCard title="Your reply" description={e.repliedAt ? `Saved ${formatDateTime(e.repliedAt)}` : undefined}>
              <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap">{e.replyBody}</p>
            </AdminCard>
          ) : null}
          {canWrite ? (
            <AdminCard title={e.replyBody ? "Send another reply" : "Reply"}>
              <ReplyForm id={e.id} hasEmail={!!e.email} emailReady={emailConfigured()} />
            </AdminCard>
          ) : null}
        </div>
        <div className="grid content-start gap-6">
          <AdminCard title="Guest">
            <DetailList
              items={[
                ["Name", e.name],
                ["Phone", e.phone || "—"],
                ["Email", e.email || "—"],
                ["Source", e.source === "booking-request" ? "Booking request" : "Contact form"],
              ]}
            />
            <div className="mt-5 flex flex-wrap gap-2">
              {e.phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={telHref(e.phone)}>
                    <Phone aria-hidden /> Call
                  </a>
                </Button>
              ) : null}
              {e.phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={whatsappHref(e.phone)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden /> WhatsApp
                  </a>
                </Button>
              ) : null}
              {e.email ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`mailto:${e.email}?subject=${encodeURIComponent(e.subject ? `Re: ${e.subject}` : "Your message")}`}>
                    <Mail aria-hidden /> Email app
                  </a>
                </Button>
              ) : null}
            </div>
          </AdminCard>
          {canWrite ? (
            <AdminCard title="Status">
              <div className="flex flex-wrap gap-2">
                {e.status !== "CLOSED" ? (
                  <ActionButton action={setEnquiryStatus} fields={{ id: e.id, status: "CLOSED" }} size="sm" variant="outline">
                    Mark closed
                  </ActionButton>
                ) : (
                  <ActionButton action={setEnquiryStatus} fields={{ id: e.id, status: "IN_PROGRESS" }} size="sm" variant="outline">
                    Reopen
                  </ActionButton>
                )}
                <ActionButton action={setEnquiryStatus} fields={{ id: e.id, status: "NEW" }} size="sm" variant="ghost">
                  Mark unread
                </ActionButton>
                <ConfirmButton
                  action={deleteEnquiry}
                  fields={{ id: e.id, redirect: "1" }}
                  title="Delete this enquiry?"
                  body="It disappears from the inbox. This cannot be undone from the admin."
                  confirmLabel="Delete"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                >
                  Delete
                </ConfirmButton>
              </div>
            </AdminCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
