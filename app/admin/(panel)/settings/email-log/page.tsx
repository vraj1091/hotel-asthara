import Link from "next/link";
import type { EmailStatus, Prisma } from "@prisma/client";
import { Mail } from "lucide-react";
import { SettingsHeader } from "@/components/admin/settings/settings-tabs";
import { AdminCard, EmptyState, filterControl, Pagination, parsePage, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Email log" };
const PAGE_SIZE = 30;
const KIND_LABEL: Record<string, string> = {
  "booking.guest": "Booking confirmation (guest)",
  "booking.hotel": "New booking (hotel)",
  "booking.cancelled": "Cancellation",
  "enquiry.reply": "Enquiry reply",
  "enquiry.hotel": "Enquiry alert / test",
  "staff.invite": "Staff invite or reset",
};
const TONE = { SENT: "success", FAILED: "danger", SKIPPED: "warning" } as const;

export default async function EmailLogPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requirePage("settings:manage");
  const params = await searchParams;
  const page = parsePage(params.page);
  const status = params.status && params.status in TONE ? (params.status as EmailStatus) : undefined;
  const where: Prisma.EmailLogWhereInput = status ? { status } : {};
  const [rows, total] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { booking: { select: { reference: true } } },
    }),
    db.emailLog.count({ where }),
  ]);
  return (
    <>
      <SettingsHeader current="email-log" />
      <AdminCard
        title="Email log"
        description="Every email the site tried to send. Skipped means email is not set up yet; failed shows the reason."
      >
        <form className="mb-4 flex flex-wrap gap-2">
          <label htmlFor="log-status" className="sr-only">
            Status
          </label>
          <select id="log-status" name="status" defaultValue={status ?? ""} className={filterControl}>
            <option value="">All statuses</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
          </select>
          <Button type="submit" size="sm" variant="dark" className="h-10">
            Filter
          </Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={<Mail />} title="No emails yet" body="Booking confirmations, enquiry alerts and staff invites will be listed here." />
        ) : (
          <>
            <Table className="min-w-[52rem]">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Type</Th>
                  <Th>To</Th>
                  <Th>Subject</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="text-muted whitespace-nowrap">{formatDateTime(r.createdAt)}</Td>
                    <Td>{KIND_LABEL[r.kind] ?? r.kind}</Td>
                    <Td className="break-all">{r.to}</Td>
                    <Td>
                      <p>{r.subject}</p>
                      {r.bookingId && r.booking ? (
                        <Link href={`/admin/bookings/${r.bookingId}`} className="link-underline text-muted text-xs">
                          Booking {r.booking.reference}
                        </Link>
                      ) : null}
                      {r.error && r.status !== "SKIPPED" ? <p className="text-danger mt-1 text-xs break-words">{r.error}</p> : null}
                    </Td>
                    <Td>
                      <Badge tone={TONE[r.status]}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/settings/email-log" params={{ status }} />
          </>
        )}
      </AdminCard>
    </>
  );
}
