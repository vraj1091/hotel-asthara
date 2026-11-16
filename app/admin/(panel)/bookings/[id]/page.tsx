import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone, Printer, RotateCcw } from "lucide-react";
import { EditStayDialog, GuestForm, NotesForm, PaymentForm } from "@/components/admin/bookings/booking-forms";
import { StatusActions } from "@/components/admin/bookings/status-actions";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import {
  AdminCard,
  AdminPageHeader,
  BookingStatusBadge,
  DetailList,
  PAYMENT_METHOD_LABEL,
  PaymentBadge,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { refundViaRazorpay, resendConfirmation } from "@/features/bookings/admin-actions";
import { nextStatuses, paidPaise } from "@/lib/booking-engine";
import { maskId } from "@/lib/crypto";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import type { NightlyRate } from "@/lib/pricing";
import { getRazorpayConfig } from "@/lib/razorpay";
import { requirePage } from "@/lib/session";
import { dayKey, formatDateTime, formatDay, formatINR, telHref, todayIST, whatsappHref } from "@/lib/utils";

export const metadata = { title: "Booking" };

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  OTHER: "Other",
};

const AUDIT_LABEL: Record<string, string> = {
  "booking.create": "Booking created",
  "booking.confirmed": "Confirmed",
  "booking.checked_in": "Checked in",
  "booking.checked_out": "Checked out",
  "booking.no_show": "Marked no-show",
  "booking.cancel": "Cancelled",
  "booking.payment": "Payment recorded",
  "booking.refund": "Refund recorded",
  "booking.refund_razorpay": "Refunded through Razorpay",
  "booking.change_stay": "Dates or rooms changed",
  "booking.edit_guest": "Guest details edited",
  "booking.edit_notes": "Notes edited",
  "booking.resend_email": "Confirmation email re-sent",
};

const EMAIL_TONE = { SENT: "success", FAILED: "danger", SKIPPED: "neutral" } as const;

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const staff = await requirePage("bookings:read");
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const b = await db.booking.findFirst({
    where: { id, deletedAt: null },
    include: {
      guest: true,
      rooms: { include: { room: true, roomType: true }, orderBy: { room: { number: "asc" } } },
      payments: { include: { receivedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      emails: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!b) notFound();
  const [audit, razorpay] = await Promise.all([
    db.auditLog.findMany({
      where: { entity: "Booking", entityId: b.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getRazorpayConfig().catch(() => null),
  ]);

  const perms = staff.permissions;
  const canWrite = can(perms, "bookings:write");
  const canCancel = can(perms, "bookings:cancel");
  const canPay = can(perms, "payments:write");
  const paid = paidPaise(b.payments);
  const balance = b.totalPaise - paid;
  const today = dayKey(todayIST());
  const active = ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(b.status);
  const holdLeft = b.status === "PENDING" && b.holdExpiresAt ? Math.max(0, Math.round((b.holdExpiresAt.getTime() - Date.now()) / 60_000)) : null;
  const refundedFor = (rzpId: string) =>
    b.payments.filter((p) => p.status === "REFUNDED" && p.note?.includes(rzpId)).reduce((s, p) => s + p.amountPaise, 0);

  return (
    <>
      <AdminPageHeader
        title={b.reference}
        back={{ href: "/admin/bookings", label: "Bookings" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={b.status} />
            <PaymentBadge totalPaise={b.totalPaise} paidPaise={paid} />
            <span>
              {SOURCE_LABEL[b.source]} booking, created {formatDateTime(b.createdAt)}
            </span>
          </span>
        }
        actions={
          <Button asChild variant="outline">
            <Link href={`/admin/invoice/${b.id}`} target="_blank">
              <Printer aria-hidden /> {b.invoiceNumber ? "Invoice" : "Print invoice"}
            </Link>
          </Button>
        }
      />

      {created ? (
        <p role="status" className="border-success/40 bg-success/10 mb-6 rounded-xl border px-4 py-3 text-sm">
          Booking created. The rooms are held{b.guest.email ? "" : "; add an email address to send the guest a confirmation"}.
        </p>
      ) : null}
      {holdLeft !== null ? (
        <p role="status" className="border-warning/40 bg-warning/10 mb-6 rounded-xl border px-4 py-3 text-sm">
          The guest is paying online. The rooms are held for {holdLeft} more minute{holdLeft === 1 ? "" : "s"}; after that the booking is cancelled automatically unless you confirm it.
        </p>
      ) : null}
      {b.status === "CANCELLED" ? (
        <p role="status" className="border-danger/30 bg-danger/10 mb-6 rounded-xl border px-4 py-3 text-sm">
          Cancelled {b.cancelledAt ? formatDateTime(b.cancelledAt) : ""}
          {b.cancelReason ? `: ${b.cancelReason}` : "."}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <AdminCard
            title="Stay"
            actions={
              canWrite && active ? (
                <EditStayDialog
                  id={b.id}
                  checkIn={dayKey(b.checkIn)}
                  checkOut={dayKey(b.checkOut)}
                  roomIds={b.rooms.map((r) => r.roomId)}
                  totalPaise={b.totalPaise}
                  today={today}
                />
              ) : null
            }
          >
            <DetailList
              items={[
                ["Check-in", formatDay(b.checkIn, "en-IN", { year: "numeric", weekday: "long" })],
                ["Check-out", formatDay(b.checkOut, "en-IN", { year: "numeric", weekday: "long" })],
                ["Nights", String(b.nights)],
                ["Guests", `${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}`],
                ["Payment option", PAYMENT_METHOD_LABEL[b.paymentMethod] ?? b.paymentMethod],
                ...(b.checkedInAt ? ([["Checked in", formatDateTime(b.checkedInAt)]] as [string, string][]) : []),
                ...(b.checkedOutAt ? ([["Checked out", formatDateTime(b.checkedOutAt)]] as [string, string][]) : []),
              ]}
            />
            <div className="mt-6 grid gap-4">
              {b.rooms.map((r) => {
                const nights = (r.nightlyRates as unknown as NightlyRate[]) ?? [];
                return (
                  <div key={r.id} className="border-line rounded-xl border p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">
                        Room {r.room.number} <span className="text-muted font-normal">· {r.roomType.name}</span>
                        {!r.active ? <Badge className="ml-2">Released</Badge> : null}
                      </p>
                      <p className="tabular-nums">{formatINR(r.subtotalPaise)} <span className="text-muted text-sm">+ {formatINR(r.taxPaise, true)} GST</span></p>
                    </div>
                    {nights.length ? (
                      <ul className="text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {nights.map((n) => (
                          <li key={n.date} className="tabular-nums">
                            {formatDay(n.date)}: {formatINR(n.ratePaise)}
                            {n.rule ? ` (${n.rule})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </AdminCard>

          <AdminCard title="Price">
            <dl className="grid max-w-md gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Room charges</dt>
                <dd className="tabular-nums">{formatINR(b.subtotalPaise, true)}</dd>
              </div>
              {b.discountPaise ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Discount{b.couponCode ? ` (${b.couponCode})` : ""}</dt>
                  <dd className="tabular-nums">− {formatINR(b.discountPaise, true)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">GST</dt>
                <dd className="tabular-nums">{formatINR(b.taxPaise, true)}</dd>
              </div>
              <div className="border-line flex justify-between gap-4 border-t pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatINR(b.totalPaise, true)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Paid</dt>
                <dd className="tabular-nums">{formatINR(paid, true)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-medium">
                <dt>{balance >= 0 ? "Balance due" : "Overpaid (refund due)"}</dt>
                <dd className="tabular-nums">{formatINR(Math.abs(balance), true)}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard title="Payments" description={b.payments.length ? undefined : "No payments recorded yet."}>
            {b.payments.length ? (
              <Table className="min-w-[34rem]">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {b.payments.map((p) => {
                    const refundable = p.status === "PAID" && p.razorpayPaymentId && razorpay && canPay && p.amountPaise - refundedFor(p.razorpayPaymentId) > 0;
                    return (
                      <tr key={p.id}>
                        <Td className="whitespace-nowrap">{formatDateTime(p.paidAt ?? p.createdAt)}</Td>
                        <Td>
                          {PAYMENT_METHOD_LABEL[p.method] ?? p.method}
                          {p.note ? <p className="text-muted text-xs">{p.note}</p> : null}
                          {p.receivedBy ? <p className="text-muted text-xs">by {p.receivedBy.name}</p> : null}
                        </Td>
                        <Td>
                          <Badge tone={p.status === "PAID" ? "success" : p.status === "REFUNDED" ? "neutral" : p.status === "FAILED" ? "danger" : "warning"}>
                            {p.status === "PAID" ? "Paid" : p.status === "REFUNDED" ? "Refund" : p.status === "FAILED" ? "Failed" : "Pending"}
                          </Badge>
                        </Td>
                        <Td className="text-right tabular-nums whitespace-nowrap">
                          {p.status === "REFUNDED" ? "− " : ""}
                          {formatINR(p.amountPaise, true)}
                        </Td>
                        <Td className="text-right">
                          {refundable ? (
                            <ConfirmButton
                              action={refundViaRazorpay}
                              fields={{ paymentId: p.id }}
                              title="Refund through Razorpay?"
                              body={`${formatINR(p.amountPaise - refundedFor(p.razorpayPaymentId!), true)} goes back to the guest's original payment method in 5–7 working days.`}
                              confirmLabel="Refund"
                              size="sm"
                              variant="ghost"
                            >
                              <RotateCcw aria-hidden /> Refund
                            </ConfirmButton>
                          ) : null}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : null}
            {canPay ? (
              <div className={b.payments.length ? "border-line mt-5 border-t pt-5" : ""}>
                <PaymentForm id={b.id} balancePaise={balance} paidPaise={paid} />
              </div>
            ) : null}
          </AdminCard>

          <AdminCard title="Activity">
            {audit.length === 0 ? (
              <p className="text-muted text-sm">No recorded activity.</p>
            ) : (
              <ol className="border-line grid gap-4 border-l pl-5">
                {audit.map((a) => (
                  <li key={a.id} className="relative text-sm">
                    <span className="bg-accent absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full" aria-hidden />
                    <p className="font-medium">{AUDIT_LABEL[a.action] ?? a.action}</p>
                    <p className="text-muted text-xs">
                      {formatDateTime(a.createdAt)}
                      {a.user ? ` · ${a.user.name}` : " · Guest / system"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </AdminCard>
        </div>

        <div className="grid content-start gap-6">
          <AdminCard title="Status">
            <StatusActions
              id={b.id}
              next={nextStatuses(b.status) as ("CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW")[]}
              canWrite={canWrite}
              canCancel={canCancel}
              hasEmail={!!b.guest.email}
              balanceLabel={balance > 0 ? formatINR(balance, true) : null}
              arrivesLater={dayKey(b.checkIn) > today}
            />
          </AdminCard>

          <AdminCard
            title="Guest"
            actions={
              can(perms, "guests:read") ? (
                <Link href={`/admin/guests/${b.guestId}`} className="link-underline text-sm">
                  Guest profile
                </Link>
              ) : null
            }
          >
            <DetailList
              items={[
                ["Name", b.guest.name],
                ["Mobile", b.guest.phone],
                ["Email", b.guest.email ?? "—"],
                ["City", b.guest.city ?? "—"],
                ["ID", b.guest.idType ? `${b.guest.idType.replace(/_/g, " ").toLowerCase()} ${maskId(b.guest.idNumberLast4)}` : "Not recorded"],
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={telHref(b.guest.phone)}>
                  <Phone aria-hidden /> Call
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={whatsappHref(b.guest.phone, `Hello ${b.guest.name.split(" ")[0]}, this is Hotel Asthara about booking ${b.reference}.`)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden /> WhatsApp
                </a>
              </Button>
              {canWrite && b.guest.email && !["CANCELLED", "NO_SHOW"].includes(b.status) ? (
                <ActionButton action={resendConfirmation} fields={{ id: b.id }} size="sm" variant="outline">
                  <Mail aria-hidden /> Resend confirmation
                </ActionButton>
              ) : null}
            </div>
            {canWrite ? (
              <details className="group border-line mt-5 border-t pt-4">
                <summary className="text-sm font-medium">Edit guest details</summary>
                <div className="mt-4">
                  <GuestForm
                    id={b.id}
                    guest={{ name: b.guest.name, phone: b.guest.phone, email: b.guest.email, city: b.guest.city }}
                    adults={b.adults}
                    childrenCount={b.children}
                  />
                </div>
              </details>
            ) : null}
          </AdminCard>

          <AdminCard title="Notes">
            {canWrite ? (
              <NotesForm id={b.id} specialRequests={b.specialRequests} internalNotes={b.internalNotes} />
            ) : (
              <DetailList items={[["Guest requests", b.specialRequests ?? "—"], ["Internal notes", b.internalNotes ?? "—"]]} />
            )}
          </AdminCard>

          <AdminCard title="Emails" description={b.emails.length ? undefined : "No emails sent for this booking yet."}>
            {b.emails.length ? (
              <ul className="grid gap-3 text-sm">
                {b.emails.map((e) => (
                  <li key={e.id} className="grid gap-0.5">
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge tone={EMAIL_TONE[e.status]}>{e.status === "SENT" ? "Sent" : e.status === "FAILED" ? "Failed" : "Not sent"}</Badge>
                      <span className="truncate">{e.subject}</span>
                    </p>
                    <p className="text-muted text-xs">
                      To {e.to} · {formatDateTime(e.createdAt)}
                      {e.error ? ` · ${e.error}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </AdminCard>
        </div>
      </div>
    </>
  );
}
