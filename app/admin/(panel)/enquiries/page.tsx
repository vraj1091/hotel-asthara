import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Inbox, Search } from "lucide-react";
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  ENQUIRY_STATUS_LABEL,
  EnquiryStatusBadge,
  filterControl,
  Pagination,
  parsePage,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Enquiries" };
const PAGE_SIZE = 25;

type Search = Promise<{ status?: string; q?: string; page?: string; source?: string }>;

export default async function EnquiriesPage({ searchParams }: { searchParams: Search }) {
  await requirePage("enquiries:read");
  const params = await searchParams;
  const page = parsePage(params.page);
  const status = params.status && params.status in ENQUIRY_STATUS_LABEL ? params.status : undefined;
  const q = params.q?.trim().slice(0, 100);
  const where: Prisma.EnquiryWhereInput = {
    deletedAt: null,
    ...(status ? { status: status as keyof typeof ENQUIRY_STATUS_LABEL } : {}),
    ...(params.source === "booking-request" || params.source === "contact" ? { source: params.source } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q.replace(/\D/g, "") || q } },
            { message: { contains: q, mode: "insensitive" } },
            { subject: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [rows, total, counts] = await Promise.all([
    db.enquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.enquiry.count({ where }),
    db.enquiry.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <AdminPageHeader
        title="Enquiries"
        description="Messages from the contact form. New messages also appear as a badge in the menu."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {[["", "All"], ...Object.entries(ENQUIRY_STATUS_LABEL)].map(([key, label]) => {
          const active = (status ?? "") === key;
          const qs = new URLSearchParams({ ...(key ? { status: key } : {}), ...(q ? { q } : {}) }).toString();
          return (
            <Link
              key={key}
              href={`/admin/enquiries${qs ? `?${qs}` : ""}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "bg-ink text-bg inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm"
                  : "border-line-strong hover:bg-bg inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm"
              }
            >
              {label}
              {key ? <span className="tabular-nums opacity-70">{countOf(key)}</span> : null}
            </Link>
          );
        })}
      </div>
      <AdminCard>
        <form className="mb-4 flex flex-wrap gap-2" role="search">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="sr-only" htmlFor="enq-q">
            Search enquiries
          </label>
          <input
            id="enq-q"
            name="q"
            defaultValue={q}
            placeholder="Name, phone, email or message"
            className={`${filterControl} min-w-56 flex-1`}
          />
          <Button type="submit" variant="dark" size="sm" className="h-10">
            <Search aria-hidden /> Search
          </Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={q || status ? "No enquiries match" : "No enquiries yet"}
            body={q || status ? "Try a different search or status." : "Messages sent from the website's contact form will appear here."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>From</Th>
                  <Th>Message</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Received</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className={e.readAt ? "" : "font-medium"}>
                    <Td className="w-56">
                      <Link href={`/admin/enquiries/${e.id}`} className="link-underline">
                        {!e.readAt ? <span className="bg-accent mr-2 inline-block size-2 rounded-full align-middle" aria-label="Unread" /> : null}
                        {e.name}
                      </Link>
                      <p className="text-muted text-xs font-normal">{e.phone || e.email}</p>
                    </Td>
                    <Td>
                      {e.subject ? <p className="truncate">{e.subject}</p> : null}
                      <p className="text-muted line-clamp-2 font-normal">{e.message}</p>
                    </Td>
                    <Td>
                      <EnquiryStatusBadge status={e.status} />
                    </Td>
                    <Td className="text-muted text-right font-normal whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/enquiries" params={{ status, q }} />
          </>
        )}
      </AdminCard>
    </>
  );
}
