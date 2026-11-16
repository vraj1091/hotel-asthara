import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck2, CalendarPlus, MessageCircle, Phone } from "lucide-react";
import { ConfirmButton } from "@/components/admin/forms";
import { GuestIdForm, GuestProfileForm, ID_TYPE_LABEL, RevealId } from "@/components/admin/guests/guest-forms";
import {
  AdminCard,
  AdminPageHeader,
  BookingStatusBadge,
  EmptyState,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { deleteGuest } from "@/features/guests/actions";
import { summarize } from "@/features/guests/queries";
import { maskId } from "@/lib/crypto";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { formatDateTime, formatDay, formatINR, telHref, whatsappHref } from "@/lib/utils";

export const metadata = { title: "Guest" };

export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePage("guests:read");
  const { id } = await params;
  const guest = await db.guest.findFirst({
    where: { id, deletedAt: null },
    include: {
      bookings: {
        where: { deletedAt: null },
        orderBy: { checkIn: "desc" },
        select: {
          id: true,
          reference: true,
          checkIn: true,
          checkOut: true,
          nights: true,
          status: true,
          totalPaise: true,
          source: true,
        },
      },
    },
  });
  if (!guest) notFound();
  const p = staff.permissions;
  const canWrite = can(p, "guests:write");
  const s = summarize(guest.bookings);

  return (
    <>
      <AdminPageHeader
        title={guest.name}
        description={`Guest since ${formatDateTime(guest.createdAt)}`}
        back={{ href: "/admin/guests", label: "All guests" }}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={telHref(guest.phone)}>
                <Phone aria-hidden /> Call
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={whatsappHref(guest.phone)} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden /> WhatsApp
              </a>
            </Button>
            {can(p, "bookings:write") ? (
              <Button asChild size="sm">
                <Link href={`/admin/bookings/new?guestId=${guest.id}`}>
                  <CalendarPlus aria-hidden /> New booking
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Stays" value={s.stays} hint="Confirmed, in house or completed" />
        <StatCard label="Total spent" value={formatINR(s.spentPaise)} />
        <StatCard label="Last stay" value={s.lastStay ? formatDay(s.lastStay, "en-IN", { year: "numeric" }) : "—"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <AdminCard title="Booking history">
          {guest.bookings.length === 0 ? (
            <EmptyState icon={<CalendarCheck2 />} title="No bookings yet" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Stay</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {guest.bookings.map((b) => (
                  <tr key={b.id}>
                    <Td>
                      {can(p, "bookings:read") ? (
                        <Link href={`/admin/bookings/${b.id}`} className="link-underline font-medium">
                          {b.reference}
                        </Link>
                      ) : (
                        b.reference
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDay(b.checkIn, "en-IN", { year: "numeric" })} – {formatDay(b.checkOut)}
                      <p className="text-muted text-xs">
                        {b.nights} night{b.nights === 1 ? "" : "s"}
                      </p>
                    </Td>
                    <Td>
                      <BookingStatusBadge status={b.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{formatINR(b.totalPaise)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </AdminCard>
        <div className="grid content-start gap-6">
          <AdminCard title="Details">
            <GuestProfileForm guest={guest} disabled={!canWrite} />
          </AdminCard>
          <AdminCard title="Photo ID" description="Only staff allowed to see ID numbers can reveal them; each reveal is logged.">
            <div className="grid gap-5">
              {guest.idNumberEnc ? (
                <div className="grid gap-1">
                  <p className="text-muted text-sm">{ID_TYPE_LABEL[guest.idType ?? ""] ?? "ID"}</p>
                  {can(p, "guests:id") ? (
                    <RevealId guestId={guest.id} masked={maskId(guest.idNumberLast4)} />
                  ) : (
                    <p className="font-mono tracking-wider">{maskId(guest.idNumberLast4)}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted text-sm">No ID recorded yet.</p>
              )}
              {canWrite ? <GuestIdForm guestId={guest.id} currentType={guest.idType} /> : null}
            </div>
          </AdminCard>
          {canWrite && guest.bookings.length === 0 ? (
            <AdminCard title="Delete guest">
              <p className="text-muted mb-4 text-sm">Guests with no bookings can be deleted. Their ID is erased too.</p>
              <ConfirmButton
                action={deleteGuest}
                fields={{ id: guest.id }}
                title={`Delete ${guest.name}?`}
                body="The profile and any stored ID number are removed."
                confirmLabel="Delete guest"
                variant="outline"
                size="sm"
                className="text-danger"
              >
                Delete guest
              </ConfirmButton>
            </AdminCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
