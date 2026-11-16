import Link from "next/link";
import { CalendarCheck2, CalendarPlus, Inbox, LogIn, LogOut } from "lucide-react";
import { BarChart } from "@/components/admin/dashboard/bar-chart";
import { ActionButton } from "@/components/admin/forms";
import {
  AdminCard,
  AdminPageHeader,
  BookingStatusBadge,
  EmptyState,
  EnquiryStatusBadge,
  PaymentBadge,
  StatCard,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { quickStayStatus } from "@/features/dashboard/actions";
import {
  getEnquirySummary,
  getOccupancy,
  getRecentBookings,
  getRevenue,
  getTodayLists,
} from "@/features/dashboard/queries";
import { paidPaise } from "@/lib/booking-engine";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { formatDateTime, formatDay, formatINR, parseDay } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const shortDay = (key: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(parseDay(key));

export default async function AdminDashboard() {
  const staff = await requirePage("dashboard:view");
  const p = staff.permissions;
  const canBookings = can(p, "bookings:read");
  const canWrite = can(p, "bookings:write");
  const canMoney = can(p, "payments:write") || can(p, "settings:manage");
  const canEnquiries = can(p, "enquiries:read");

  const [today, occupancy, revenue, recent, enquiries] = await Promise.all([
    canBookings ? getTodayLists() : null,
    canBookings ? getOccupancy(14) : null,
    canMoney ? getRevenue(30) : null,
    canBookings ? getRecentBookings(8) : null,
    canEnquiries ? getEnquirySummary(5) : null,
  ]);
  const tonight = occupancy?.series[0];
  const firstName = staff.name.split(" ")[0];

  return (
    <>
      <AdminPageHeader
        title={`Good to see you, ${firstName}`}
        description={formatDay(new Date(), "en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/admin/bookings/new">
                <CalendarPlus aria-hidden /> New booking
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {today ? (
          <>
            <StatCard label="Arrivals today" value={today.arrivals.length} href="#arrivals" />
            <StatCard label="Departures today" value={today.departures.length} href="#departures" />
            <StatCard label="In house now" value={today.inHouse} />
          </>
        ) : null}
        {tonight && occupancy ? (
          <StatCard
            label="Occupancy tonight"
            value={`${tonight.percent}%`}
            hint={`${tonight.occupied} of ${occupancy.totalRooms} rooms`}
            tone="accent"
          />
        ) : null}
        {revenue ? (
          <>
            <StatCard label="Received today" value={formatINR(revenue.todayPaise)} />
            <StatCard label="This week" value={formatINR(revenue.weekPaise)} hint="Monday to today" />
            <StatCard label="This month" value={formatINR(revenue.monthPaise)} />
          </>
        ) : null}
        {enquiries ? (
          <StatCard label="Open enquiries" value={enquiries.pending} href="/admin/enquiries?status=NEW" />
        ) : null}
      </div>

      {today ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AdminCard id="arrivals" title="Arriving today" description="Pending and confirmed bookings with check-in today.">
            {today.arrivals.length === 0 ? (
              <EmptyState icon={<LogIn />} title="No arrivals today" />
            ) : (
              <ul className="divide-line grid divide-y">
                {today.arrivals.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/admin/bookings/${b.id}`} className="link-underline font-medium">
                        {b.guest.name}
                      </Link>
                      <p className="text-muted text-sm">
                        {b.reference} · {b.rooms.map((r) => r.room.number).join(", ")} · {b.nights} night{b.nights === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookingStatusBadge status={b.status} />
                      {canWrite ? (
                        <ActionButton action={quickStayStatus} fields={{ id: b.id, to: "CHECKED_IN" }} size="sm">
                          Check in
                        </ActionButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
          <AdminCard id="departures" title="Leaving today" description="Guests in house with check-out today.">
            {today.departures.length === 0 ? (
              <EmptyState icon={<LogOut />} title="No departures today" />
            ) : (
              <ul className="divide-line grid divide-y">
                {today.departures.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/admin/bookings/${b.id}`} className="link-underline font-medium">
                        {b.guest.name}
                      </Link>
                      <p className="text-muted text-sm">
                        {b.reference} · Room {b.rooms.map((r) => r.room.number).join(", ")}
                      </p>
                    </div>
                    {canWrite ? (
                      <ActionButton action={quickStayStatus} fields={{ id: b.id, to: "CHECKED_OUT" }} size="sm" variant="outline">
                        Check out
                      </ActionButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      ) : null}

      {revenue || occupancy ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {revenue ? (
            <AdminCard>
              <BarChart
                title="Payments received, last 30 days"
                description={`${formatINR(revenue.series.reduce((s, d) => s + d.paise, 0))} in total, net of refunds`}
                kind="inr"
                data={revenue.series.map((d) => ({
                  key: d.day,
                  label: shortDay(d.day),
                  full: formatDay(d.day, "en-IN", { year: "numeric" }),
                  value: d.paise,
                }))}
              />
            </AdminCard>
          ) : null}
          {occupancy ? (
            <AdminCard>
              {occupancy.totalRooms === 0 ? (
                <EmptyState title="No rooms yet" body="Add rooms in Rooms & rates to see occupancy." />
              ) : (
                <BarChart
                  title="Occupancy, next 14 nights"
                  description={`Share of ${occupancy.totalRooms} rooms booked each night`}
                  kind="percent"
                  data={occupancy.series.map((d) => ({
                    key: d.day,
                    label: shortDay(d.day),
                    full: `${formatDay(d.day, "en-IN", { year: "numeric" })} (${d.occupied} of ${occupancy.totalRooms} rooms)`,
                    value: d.percent,
                  }))}
                />
              )}
            </AdminCard>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {recent ? (
          <AdminCard
            title="Recent bookings"
            actions={
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/bookings">All bookings</Link>
              </Button>
            }
          >
            {recent.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck2 />}
                title="No bookings yet"
                body="Bookings from the website and the front desk will appear here."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Guest</Th>
                    <Th>Stay</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((b) => (
                    <tr key={b.id}>
                      <Td>
                        <Link href={`/admin/bookings/${b.id}`} className="link-underline font-medium">
                          {b.guest.name}
                        </Link>
                        <p className="text-muted text-xs">{b.reference}</p>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatDay(b.checkIn)} – {formatDay(b.checkOut)}
                        <p className="text-muted text-xs">Booked {formatDateTime(b.createdAt)}</p>
                      </Td>
                      <Td>
                        <BookingStatusBadge status={b.status} />
                      </Td>
                      <Td className="text-right whitespace-nowrap tabular-nums">
                        {formatINR(b.totalPaise)}
                        <div className="mt-1">
                          <PaymentBadge totalPaise={b.totalPaise} paidPaise={paidPaise(b.payments)} />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </AdminCard>
        ) : null}
        {enquiries ? (
          <AdminCard
            title="Open enquiries"
            actions={
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/enquiries">Inbox</Link>
              </Button>
            }
          >
            {enquiries.latest.length === 0 ? (
              <EmptyState icon={<Inbox />} title="Inbox is clear" body="New contact-form messages will show here." />
            ) : (
              <ul className="divide-line grid divide-y">
                {enquiries.latest.map((e) => (
                  <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/admin/enquiries/${e.id}`} className="link-underline min-w-0 truncate font-medium">
                        {e.name}
                      </Link>
                      <EnquiryStatusBadge status={e.status} />
                    </div>
                    <p className="text-muted line-clamp-2 text-sm">{e.subject || e.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        ) : null}
      </div>

      {!today && !revenue && !enquiries ? (
        <AdminCard className="mt-6">
          <EmptyState title="Nothing to show for your role" body="Use the menu to open the areas you work in." />
        </AdminCard>
      ) : null}
    </>
  );
}
