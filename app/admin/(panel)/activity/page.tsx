import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { History, Search } from "lucide-react";
import { AdminCard, AdminPageHeader, EmptyState, filterControl, Pagination, parsePage, Table, Td, Th } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/session";
import { addDays, formatDateTime, isDayString, parseDay } from "@/lib/utils";

export const metadata = { title: "Activity log" };
const PAGE_SIZE = 40;
const IST_OFFSET_MS = 330 * 60_000;

type Search = Promise<{ user?: string; action?: string; entity?: string; from?: string; to?: string; page?: string }>;

/** Where an audit entry's entity lives in the admin, when it has a page. */
function entityHref(entity: string, id: string | null) {
  if (!id) return null;
  switch (entity) {
    case "Booking":
      return `/admin/bookings/${id}`;
    case "Enquiry":
      return `/admin/enquiries/${id}`;
    case "Guest":
      return `/admin/guests/${id}`;
    case "RoomType":
      return `/admin/rooms/${id}`;
    default:
      return null;
  }
}

const humanAction = (a: string) => a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default async function ActivityPage({ searchParams }: { searchParams: Search }) {
  await requirePage("audit:read");
  const p = await searchParams;
  const page = parsePage(p.page);
  const action = p.action?.trim().toLowerCase().slice(0, 60) || undefined;
  const from = isDayString(p.from) ? p.from : undefined;
  const to = isDayString(p.to) ? p.to : undefined;
  // Date filters are days in India time.
  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = new Date(parseDay(from).getTime() - IST_OFFSET_MS);
  if (to) createdAt.lt = new Date(addDays(parseDay(to), 1).getTime() - IST_OFFSET_MS);

  const where: Prisma.AuditLogWhereInput = {
    ...(p.user === "system" ? { userId: null } : p.user ? { userId: p.user } : {}),
    ...(action ? { action: { startsWith: action } } : {}),
    ...(p.entity ? { entity: p.entity } : {}),
    ...(from || to ? { createdAt } : {}),
  };
  const [rows, total, users, entities] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
    db.user.findMany({ select: { id: true, name: true, deletedAt: true }, orderBy: { name: "asc" } }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  const filtered = !!(p.user || action || p.entity || from || to);

  return (
    <>
      <AdminPageHeader
        title="Activity log"
        description="Who did what and when: sign-ins, bookings, payments, edits and settings changes. Entries cannot be edited or deleted."
      />
      <AdminCard>
        <form className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto_auto]" role="search">
          <div className="grid gap-1">
            <label htmlFor="act-user" className="text-muted text-xs font-medium">
              Staff member
            </label>
            <select id="act-user" name="user" defaultValue={p.user ?? ""} className={filterControl}>
              <option value="">Everyone</option>
              <option value="system">System / guests</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.deletedAt ? " (removed)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="act-action" className="text-muted text-xs font-medium">
              Action starts with
            </label>
            <input id="act-action" name="action" defaultValue={action} placeholder="e.g. booking." list="act-actions" className={filterControl} />
            <datalist id="act-actions">
              {["auth.", "booking.", "payment.", "enquiry.", "staff.", "role.", "settings.", "media.", "room", "offer", "content."].map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1">
            <label htmlFor="act-entity" className="text-muted text-xs font-medium">
              Record type
            </label>
            <select id="act-entity" name="entity" defaultValue={p.entity ?? ""} className={filterControl}>
              <option value="">All</option>
              {entities.map((e) => (
                <option key={e.entity} value={e.entity}>
                  {e.entity}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="act-from" className="text-muted text-xs font-medium">
              From
            </label>
            <input id="act-from" type="date" name="from" defaultValue={from} className={filterControl} />
          </div>
          <div className="grid gap-1">
            <label htmlFor="act-to" className="text-muted text-xs font-medium">
              To
            </label>
            <input id="act-to" type="date" name="to" defaultValue={to} className={filterControl} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" variant="dark" className="h-10">
              <Search aria-hidden /> Filter
            </Button>
            {filtered ? (
              <Button asChild size="sm" variant="ghost" className="h-10">
                <Link href="/admin/activity">Clear</Link>
              </Button>
            ) : null}
          </div>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={<History />} title={filtered ? "Nothing matches these filters" : "No activity yet"} />
        ) : (
          <>
            <Table className="min-w-[52rem]">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>What</Th>
                  <Th>Record</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const href = entityHref(r.entity, r.entityId);
                  const meta = r.meta && typeof r.meta === "object" && Object.keys(r.meta).length ? r.meta : null;
                  return (
                    <tr key={r.id}>
                      <Td className="text-muted whitespace-nowrap">{formatDateTime(r.createdAt)}</Td>
                      <Td>{r.user ? r.user.name : <span className="text-muted">System / guest</span>}</Td>
                      <Td>
                        <p>{humanAction(r.action)}</p>
                        <p className="text-muted font-mono text-[0.7rem]">{r.action}</p>
                        {meta ? (
                          <details className="mt-1">
                            <summary className="text-muted cursor-pointer text-xs">Details</summary>
                            <pre className="bg-surface-2 mt-1 max-w-md overflow-x-auto rounded-lg p-2 text-xs whitespace-pre-wrap break-all">
                              {JSON.stringify(meta, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </Td>
                      <Td>
                        {r.entity}
                        {r.entityId ? (
                          href ? (
                            <Link href={href} className="link-underline text-muted block text-xs">
                              Open
                            </Link>
                          ) : (
                            <span className="text-muted block font-mono text-[0.7rem]">{r.entityId.slice(-8)}</span>
                          )
                        ) : null}
                      </Td>
                      <Td className="text-muted font-mono text-xs">{r.ip ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              basePath="/admin/activity"
              params={{ user: p.user, action, entity: p.entity, from, to }}
            />
          </>
        )}
      </AdminCard>
    </>
  );
}
