import Link from "next/link";
import { Download, Search, Users } from "lucide-react";
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  filterControl,
  Pagination,
  parsePage,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { guestSearchWhere, summarize } from "@/features/guests/queries";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { formatDay, formatINR } from "@/lib/utils";

export const metadata = { title: "Guests" };
const PAGE_SIZE = 25;

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const staff = await requirePage("guests:read");
  const params = await searchParams;
  const page = parsePage(params.page);
  const q = params.q?.trim().slice(0, 100) || undefined;
  const where = guestSearchWhere(q);
  const [rows, total] = await Promise.all([
    db.guest.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        bookings: { where: { deletedAt: null }, select: { status: true, checkIn: true, totalPaise: true } },
      },
    }),
    db.guest.count({ where }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Guests"
        description="Everyone who has booked or stayed, with their booking history and notes."
        actions={
          can(staff.permissions, "guests:export") ? (
            <Button asChild variant="outline">
              <a href={`/api/admin/guests/export${q ? `?q=${encodeURIComponent(q)}` : ""}`} download>
                <Download aria-hidden /> Export CSV
              </a>
            </Button>
          ) : null
        }
      />
      <AdminCard>
        <form className="mb-4 flex flex-wrap gap-2" role="search">
          <label className="sr-only" htmlFor="guest-q">
            Search guests
          </label>
          <input
            id="guest-q"
            name="q"
            defaultValue={q}
            placeholder="Name, phone, email or city"
            className={`${filterControl} min-w-56 flex-1`}
          />
          <Button type="submit" variant="dark" size="sm" className="h-10">
            <Search aria-hidden /> Search
          </Button>
          {q ? (
            <Button asChild variant="ghost" size="sm" className="h-10">
              <Link href="/admin/guests">Clear</Link>
            </Button>
          ) : null}
        </form>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={q ? "No guests match" : "No guests yet"}
            body={q ? "Try part of the name or the last digits of the phone number." : "Guest profiles are created automatically with each booking."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Guest</Th>
                  <Th>Contact</Th>
                  <Th className="text-right">Stays</Th>
                  <Th>Last stay</Th>
                  <Th className="text-right">Total spent</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const s = summarize(g.bookings);
                  return (
                    <tr key={g.id}>
                      <Td>
                        <Link href={`/admin/guests/${g.id}`} className="link-underline font-medium">
                          {g.name}
                        </Link>
                        {g.city ? <p className="text-muted text-xs">{g.city}</p> : null}
                      </Td>
                      <Td>
                        <p className="tabular-nums">{g.phone}</p>
                        {g.email ? <p className="text-muted text-xs break-all">{g.email}</p> : null}
                      </Td>
                      <Td className="text-right tabular-nums">{s.stays}</Td>
                      <Td className="whitespace-nowrap">{s.lastStay ? formatDay(s.lastStay, "en-IN", { year: "numeric" }) : "—"}</Td>
                      <Td className="text-right whitespace-nowrap tabular-nums">{formatINR(s.spentPaise)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/guests" params={{ q }} />
          </>
        )}
      </AdminCard>
    </>
  );
}
