import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CalendarCheck2, CalendarRange, Plus, Search } from "lucide-react";
import {
  AdminCard,
  AdminPageHeader,
  BOOKING_STATUS_LABEL,
  BookingStatusBadge,
  EmptyState,
  filterControl,
  Pagination,
  PaymentBadge,
  parsePage,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { paidPaise, releaseExpiredHolds } from "@/lib/booking-engine";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { cn, dayKey, formatDay, formatINR, isDayString, parseDay, todayIST } from "@/lib/utils";

export const metadata = { title: "Bookings" };
const PAGE_SIZE = 25;

const VIEWS = [
  { key: "arrivals", label: "Arrivals today" },
  { key: "departures", label: "Departures today" },
  { key: "inhouse", label: "In house" },
  { key: "upcoming", label: "Upcoming" },
  { key: "pending", label: "Pending" },
  { key: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website",
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  OTHER: "Other",
};

type Search = Promise<Record<string, string | undefined>>;

function viewWhere(view: View, today: Date): Prisma.BookingWhereInput {
  switch (view) {
    case "arrivals":
      return { checkIn: today, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } };
    case "departures":
      return { checkOut: today, status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] } };
    case "inhouse":
      return { status: "CHECKED_IN" };
    case "upcoming":
      return { checkIn: { gte: today }, status: { in: ["PENDING", "CONFIRMED"] } };
    case "pending":
      return { status: "PENDING" };
    default:
      return {};
  }
}

export default async function BookingsPage({ searchParams }: { searchParams: Search }) {
  const staff = await requirePage("bookings:read");
  await releaseExpiredHolds();
  const params = await searchParams;
  const today = todayIST();
  const view: View = VIEWS.some((v) => v.key === params.view) ? (params.view as View) : "all";
  const page = parsePage(params.page);
  const q = params.q?.trim().slice(0, 100) || undefined;
  const status = params.status && params.status in BOOKING_STATUS_LABEL ? params.status : undefined;
  const source = params.source && params.source in SOURCE_LABEL ? params.source : undefined;
  const pay = ["unpaid", "part", "paid"].includes(params.pay ?? "") ? params.pay : undefined;
  const from = isDayString(params.from) ? params.from : undefined;
  const to = isDayString(params.to) ? params.to : undefined;

  const digits = q?.replace(/\D/g, "") ?? "";
  const where: Prisma.BookingWhereInput = {
    deletedAt: null,
    ...viewWhere(view, today),
    ...(status ? { status: status as keyof typeof BOOKING_STATUS_LABEL } : {}),
    ...(source ? { source: source as Prisma.BookingWhereInput["source"] } : {}),
    // Stays overlapping the chosen range
    ...(from ? { checkOut: { gt: parseDay(from) } } : {}),
    ...(to ? { checkIn: { lte: parseDay(to) } } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { guest: { name: { contains: q, mode: "insensitive" } } },
            { guest: { email: { contains: q, mode: "insensitive" } } },
            ...(digits.length >= 3 ? [{ guest: { phone: { contains: digits } } }] : []),
          ],
        }
      : {}),
  };
  const orderBy: Prisma.BookingOrderByWithRelationInput[] =
    view === "arrivals" || view === "upcoming" || view === "inhouse"
      ? [{ checkIn: "asc" }, { createdAt: "asc" }]
      : view === "departures"
        ? [{ checkOut: "asc" }]
        : [{ createdAt: "desc" }];
  const include = {
    guest: { select: { name: true, phone: true } },
    rooms: { select: { room: { select: { number: true } }, roomType: { select: { name: true } } } },
    payments: { select: { status: true, amountPaise: true } },
  } satisfies Prisma.BookingInclude;

  let rows;
  let total: number;
  if (pay) {
    // Payment state depends on a sum over payments, so filter in memory (a small hotel has a few thousand rows at most).
    const all = await db.booking.findMany({ where, orderBy, include });
    const filtered = all.filter((b) => {
      const p = paidPaise(b.payments);
      return pay === "unpaid" ? p <= 0 : pay === "part" ? p > 0 && p < b.totalPaise : p >= b.totalPaise;
    });
    total = filtered.length;
    rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    [rows, total] = await Promise.all([
      db.booking.findMany({ where, orderBy, include, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      db.booking.count({ where }),
    ]);
  }

  const [arrivals, departures, inhouse, pending] = await Promise.all([
    db.booking.count({ where: { deletedAt: null, ...viewWhere("arrivals", today) } }),
    db.booking.count({ where: { deletedAt: null, ...viewWhere("departures", today) } }),
    db.booking.count({ where: { deletedAt: null, ...viewWhere("inhouse", today) } }),
    db.booking.count({ where: { deletedAt: null, ...viewWhere("pending", today) } }),
  ]);
  const counts: Partial<Record<View, number>> = { arrivals, departures, inhouse, pending };
  const filtersOn = !!(q || status || source || pay || from || to);
  const keep = { q, status, source, pay, from, to };

  return (
    <>
      <AdminPageHeader
        title="Bookings"
        description={`Today is ${formatDay(today, "en-IN", { year: "numeric" })}.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/bookings/calendar">
                <CalendarRange aria-hidden /> Calendar
              </Link>
            </Button>
            {can(staff.permissions, "bookings:write") ? (
              <Button asChild>
                <Link href="/admin/bookings/new">
                  <Plus aria-hidden /> New booking
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <nav aria-label="Booking views" className="mb-5 flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const active = v.key === view;
          const qs = new URLSearchParams(v.key === "all" ? {} : { view: v.key }).toString();
          return (
            <Link
              key={v.key}
              href={`/admin/bookings${qs ? `?${qs}` : ""}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm",
                active ? "bg-ink text-bg" : "border-line-strong hover:bg-bg border",
              )}
            >
              {v.label}
              {counts[v.key] !== undefined ? <span className="tabular-nums opacity-70">{counts[v.key]}</span> : null}
            </Link>
          );
        })}
      </nav>

      <AdminCard>
        <form className="mb-5 flex flex-wrap items-center gap-2" role="search">
          {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
          <label className="sr-only" htmlFor="bk-q">Search bookings</label>
          <input id="bk-q" name="q" defaultValue={q} placeholder="Reference, guest, phone or email" className={`${filterControl} min-w-0 flex-[1_1_16rem]`} />
          <label className="sr-only" htmlFor="bk-status">Status</label>
          <select id="bk-status" name="status" defaultValue={status ?? ""} className={`${filterControl} flex-[1_1_9rem]`}>
            <option value="">Any status</option>
            {Object.entries(BOOKING_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="bk-source">Source</label>
          <select id="bk-source" name="source" defaultValue={source ?? ""} className={`${filterControl} flex-[1_1_9rem]`}>
            <option value="">Any source</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="bk-pay">Payment</label>
          <select id="bk-pay" name="pay" defaultValue={pay ?? ""} className={`${filterControl} flex-[1_1_9rem]`}>
            <option value="">Any payment</option>
            <option value="unpaid">Unpaid</option>
            <option value="part">Part paid</option>
            <option value="paid">Paid</option>
          </select>
          <label className="flex flex-[1_1_11rem] items-center gap-2 text-sm">
            <span className="text-muted shrink-0">From</span>
            <input type="date" name="from" defaultValue={from} className={`${filterControl} min-w-0 flex-1`} />
          </label>
          <label className="flex flex-[1_1_11rem] items-center gap-2 text-sm">
            <span className="text-muted shrink-0">To</span>
            <input type="date" name="to" defaultValue={to} className={`${filterControl} min-w-0 flex-1`} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="dark" size="sm" className="h-10">
              <Search aria-hidden /> Filter
            </Button>
            {filtersOn ? (
              <Button asChild variant="ghost" size="sm" className="h-10">
                <Link href={`/admin/bookings${view !== "all" ? `?view=${view}` : ""}`}>Clear</Link>
              </Button>
            ) : null}
          </div>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck2 />}
            title={filtersOn || view !== "all" ? "No bookings match" : "No bookings yet"}
            body={
              filtersOn || view !== "all"
                ? "Try another view or clear the filters."
                : "Website bookings and walk-ins you add here will appear in this list."
            }
            action={
              can(staff.permissions, "bookings:write") ? (
                <Button asChild size="sm">
                  <Link href="/admin/bookings/new">
                    <Plus aria-hidden /> New booking
                  </Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <Table className="min-w-[56rem]">
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Guest</Th>
                  <Th>Stay</Th>
                  <Th>Rooms</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const types = [...new Set(b.rooms.map((r) => r.roomType.name))].join(", ");
                  return (
                    <tr key={b.id} className="hover:bg-surface-2/60">
                      <Td className="whitespace-nowrap">
                        <Link href={`/admin/bookings/${b.id}`} className="link-underline font-medium tabular-nums">
                          {b.reference}
                        </Link>
                      </Td>
                      <Td>
                        <p className="font-medium">{b.guest.name}</p>
                        <p className="text-muted text-xs tabular-nums">{b.guest.phone}</p>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <p>
                          {formatDay(b.checkIn)} – {formatDay(b.checkOut)}
                        </p>
                        <p className="text-muted text-xs">
                          {b.nights} night{b.nights === 1 ? "" : "s"}
                          {dayKey(b.checkIn) === dayKey(today) ? " · arrives today" : ""}
                        </p>
                      </Td>
                      <Td>
                        <p className="tabular-nums">{b.rooms.map((r) => r.room.number).join(", ") || "—"}</p>
                        <p className="text-muted text-xs">{types}</p>
                      </Td>
                      <Td className="text-right whitespace-nowrap tabular-nums">{formatINR(b.totalPaise)}</Td>
                      <Td>
                        <PaymentBadge totalPaise={b.totalPaise} paidPaise={paidPaise(b.payments)} />
                      </Td>
                      <Td>
                        <BookingStatusBadge status={b.status} />
                      </Td>
                      <Td className="text-muted">{SOURCE_LABEL[b.source] ?? b.source}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/admin/bookings"
              params={{ ...keep, view: view === "all" ? undefined : view }}
            />
          </>
        )}
      </AdminCard>
    </>
  );
}
