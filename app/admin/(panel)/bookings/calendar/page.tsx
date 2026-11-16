import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Wrench } from "lucide-react";
import { AdminCard, AdminPageHeader, BOOKING_STATUS_LABEL, EmptyState, filterControl } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { releaseExpiredHolds } from "@/lib/booking-engine";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { addDays, cn, dayKey, isDayString, nightsBetween, parseDay, todayIST } from "@/lib/utils";

export const metadata = { title: "Booking calendar" };

type Search = Promise<{ start?: string; days?: string; type?: string }>;

const BAR: Record<string, string> = {
  PENDING: "bg-warning/20 border-warning text-ink",
  CONFIRMED: "bg-accent-soft border-accent text-ink",
  CHECKED_IN: "bg-success/20 border-success text-ink",
  CHECKED_OUT: "bg-surface-3 border-line-strong text-muted",
  NO_SHOW: "bg-danger/15 border-danger text-ink",
};

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short" }).format(d);
const dateLabel = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(d);

export default async function CalendarPage({ searchParams }: { searchParams: Search }) {
  const staff = await requirePage("bookings:read");
  await releaseExpiredHolds();
  const params = await searchParams;
  const today = todayIST();
  const span = params.days === "30" ? 30 : 14;
  const start = isDayString(params.start) ? parseDay(params.start) : addDays(today, -1);
  const end = addDays(start, span);
  const canWrite = can(staff.permissions, "bookings:write");

  const types = await db.roomType.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const typeId = types.some((t) => t.id === params.type) ? params.type : undefined;

  const [rooms, stays, blocks] = await Promise.all([
    db.room.findMany({
      where: { deletedAt: null, roomType: { deletedAt: null }, ...(typeId ? { roomTypeId: typeId } : {}) },
      include: { roomType: { select: { id: true, name: true, sortOrder: true } } },
      orderBy: [{ roomType: { sortOrder: "asc" } }, { number: "asc" }],
    }),
    db.bookingRoom.findMany({
      where: {
        active: true,
        checkIn: { lt: end },
        checkOut: { gt: start },
        booking: { deletedAt: null, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      },
      include: { booking: { select: { id: true, reference: true, status: true, guest: { select: { name: true } } } } },
    }),
    db.roomBlock.findMany({ where: { startDate: { lt: end }, endDate: { gt: start } } }),
  ]);

  const days = Array.from({ length: span }, (_, i) => addDays(start, i));
  const todayKey = dayKey(today);
  const col = (d: Date) => Math.min(span, Math.max(0, nightsBetween(start, d))) + 2; // grid column (1 = room label)
  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { start: dayKey(start), days: span === 30 ? "30" : undefined, type: typeId, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/bookings/calendar?${p}`;
  };
  const grid = { gridTemplateColumns: `minmax(6.5rem,8rem) repeat(${span}, minmax(${span === 30 ? "2.4rem" : "3.6rem"}, 1fr))` };

  const byType = new Map<string, typeof rooms>();
  for (const r of rooms) byType.set(r.roomTypeId, [...(byType.get(r.roomTypeId) ?? []), r]);

  return (
    <>
      <AdminPageHeader
        title="Booking calendar"
        description="Every room across the coming days. Click a free day to start a booking for that room."
        back={{ href: "/admin/bookings", label: "Bookings" }}
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/admin/bookings/new">
                <Plus aria-hidden /> New booking
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={q({ start: dayKey(addDays(start, -span)) })} aria-label={`Previous ${span} days`}>
            <ChevronLeft aria-hidden /> Earlier
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={q({ start: dayKey(addDays(today, -1)) })}>Today</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={q({ start: dayKey(addDays(start, span)) })} aria-label={`Next ${span} days`}>
            Later <ChevronRight aria-hidden />
          </Link>
        </Button>
        <div className="border-line-strong ml-1 inline-flex overflow-hidden rounded-full border text-sm" role="group" aria-label="Days shown">
          {[14, 30].map((n) => (
            <Link
              key={n}
              href={q({ days: n === 30 ? "30" : undefined })}
              aria-current={span === n ? "true" : undefined}
              className={cn("px-3.5 py-1.5", span === n ? "bg-ink text-bg" : "hover:bg-bg")}
            >
              {n} days
            </Link>
          ))}
        </div>
        <form className="ml-auto flex items-center gap-2">
          {span === 30 ? <input type="hidden" name="days" value="30" /> : null}
          <label htmlFor="cal-type" className="sr-only">Room type</label>
          <select id="cal-type" name="type" defaultValue={typeId ?? ""} className={filterControl}>
            <option value="">All room types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <label htmlFor="cal-start" className="sr-only">Start date</label>
          <input id="cal-start" type="date" name="start" defaultValue={dayKey(start)} className={filterControl} />
          <Button type="submit" size="sm" variant="dark" className="h-10">Go</Button>
        </form>
      </div>

      <AdminCard bodyClassName="p-0">
        {rooms.length === 0 ? (
          <EmptyState title="No rooms to show" body="Add rooms in Rooms & rates to see them here." />
        ) : (
          <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <div className="min-w-max text-xs" role="table" aria-label={`Rooms from ${dateLabel(start)} for ${span} days`}>
              {/* Header */}
              <div className="bg-surface-2 border-line sticky top-0 z-20 grid border-b" style={grid} role="row">
                <div className="bg-surface-2 sticky left-0 z-10 px-3 py-2 font-semibold" role="columnheader">Room</div>
                {days.map((d) => {
                  const k = dayKey(d);
                  const weekend = [0, 6].includes(d.getUTCDay());
                  return (
                    <div
                      key={k}
                      role="columnheader"
                      className={cn("border-line border-l px-1 py-2 text-center", weekend && "bg-surface-3/60", k === todayKey && "bg-accent-soft font-semibold")}
                    >
                      <span className="text-muted block">{dayLabel(d)}</span>
                      <span className="tabular-nums">{dateLabel(d)}</span>
                    </div>
                  );
                })}
              </div>

              {[...byType.values()].map((list) => (
                <div key={list[0]!.roomTypeId} role="rowgroup">
                  <div className="bg-bg border-line sticky left-0 border-b px-3 py-1.5 text-[0.7rem] font-semibold tracking-wide uppercase" role="row">
                    <span role="rowheader">{list[0]!.roomType.name}</span>
                  </div>
                  {list.map((room) => {
                    const roomStays = stays.filter((s) => s.roomId === room.id);
                    const roomBlocks = blocks.filter((b) => b.roomId === room.id || (b.roomId === null && b.roomTypeId === room.roomTypeId));
                    return (
                      <div key={room.id} className="border-line relative grid min-h-12 border-b" style={grid} role="row">
                        <div className="bg-bg sticky left-0 z-10 flex items-center gap-1.5 px-3 font-medium" role="rowheader" style={{ gridRow: 1, gridColumn: 1 }}>
                          <span className="tabular-nums">{room.number}</span>
                          {room.status === "MAINTENANCE" ? (
                            <Wrench className="text-warning size-3.5" aria-label="Under maintenance" />
                          ) : null}
                        </div>
                        {days.map((d, i) => {
                          const k = dayKey(d);
                          const weekend = [0, 6].includes(d.getUTCDay());
                          const past = k < todayKey;
                          const cls = cn("border-line border-l", weekend && "bg-surface-3/40", k === todayKey && "bg-accent-soft/50");
                          return canWrite && !past && room.status === "ACTIVE" ? (
                            <Link
                              key={k}
                              href={`/admin/bookings/new?checkIn=${k}&checkOut=${dayKey(addDays(d, 1))}&roomId=${room.id}`}
                              className={cn(cls, "hover:bg-accent-soft focus-visible:bg-accent-soft")}
                              style={{ gridRow: 1, gridColumn: i + 2 }}
                              aria-label={`Book room ${room.number} from ${dateLabel(d)}`}
                              tabIndex={-1}
                            />
                          ) : (
                            <div key={k} className={cls} style={{ gridRow: 1, gridColumn: i + 2 }} role="cell" />
                          );
                        })}
                        {roomBlocks.map((b) => (
                          <div
                            key={b.id}
                            className="border-line-strong text-muted z-[1] m-1 flex items-center truncate rounded-md border border-dashed px-2 [background:repeating-linear-gradient(135deg,var(--color-surface-3)_0_6px,transparent_6px_12px)]"
                            style={{ gridRow: 1, gridColumn: `${col(b.startDate)} / ${col(b.endDate)}` }}
                            title={`Blocked: ${b.reason ?? "no reason given"}`}
                            role="cell"
                          >
                            <span className="truncate">Blocked{b.reason ? `: ${b.reason}` : ""}</span>
                          </div>
                        ))}
                        {roomStays.map((s) => {
                          const from = col(s.checkIn);
                          const to = col(s.checkOut);
                          if (to <= from) return null;
                          const startsBefore = s.checkIn < start;
                          const endsAfter = s.checkOut > end;
                          return (
                            <Link
                              key={s.id}
                              href={`/admin/bookings/${s.booking.id}`}
                              className={cn(
                                "z-[2] my-1.5 flex min-w-0 items-center truncate border px-2 font-medium shadow-sm transition-[filter] hover:brightness-95",
                                BAR[s.booking.status],
                                startsBefore ? "rounded-l-none border-l-0" : "ml-1.5 rounded-l-lg",
                                endsAfter ? "rounded-r-none border-r-0" : "mr-1.5 rounded-r-lg",
                              )}
                              style={{ gridRow: 1, gridColumn: `${from} / ${to}` }}
                              title={`${s.booking.guest.name} · ${s.booking.reference} · ${BOOKING_STATUS_LABEL[s.booking.status]}`}
                            >
                              <span className="truncate">{s.booking.guest.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </AdminCard>

      <ul className="text-muted mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Legend">
        {(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("inline-block h-3 w-6 rounded border", BAR[s])} aria-hidden />
            {BOOKING_STATUS_LABEL[s]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="border-line-strong inline-block h-3 w-6 rounded border border-dashed [background:repeating-linear-gradient(135deg,var(--color-surface-3)_0_3px,transparent_3px_6px)]" aria-hidden />
          Blocked
        </li>
        <li className="flex items-center gap-2">
          <Wrench className="text-warning size-3.5" aria-hidden /> Under maintenance
        </li>
      </ul>
    </>
  );
}
