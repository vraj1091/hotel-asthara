import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { ConfirmButton } from "@/components/admin/forms";
import { BlocksManager, type BlockRow } from "@/components/admin/rooms/blocks-manager";
import { PhotosManager } from "@/components/admin/rooms/photos-manager";
import { RateRules, type RuleRow } from "@/components/admin/rooms/rate-rules";
import { RoomTypeForm } from "@/components/admin/rooms/room-type-form";
import { UnitsManager } from "@/components/admin/rooms/units-manager";
import { AdminCard, AdminPageHeader, LinkTabs, Table, Td, Th } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteRoomType } from "@/features/rooms/admin-actions";
import { AMENITY_BY_KEY, ROOM_AMENITY_KEYS } from "@/lib/amenities";
import { loadPriceRules } from "@/lib/availability";
import { db } from "@/lib/db";
import { roomSlotImages } from "@/lib/image-slots";
import { can } from "@/lib/permissions";
import { gstPercentFor, quoteStay } from "@/lib/pricing";
import { requirePage } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { addDays, dayKey, formatDay, formatINR, todayIST } from "@/lib/utils";

const TABS = [
  { key: "details", label: "Details" },
  { key: "units", label: "Rooms" },
  { key: "photos", label: "Photos" },
  { key: "rates", label: "Rates" },
  { key: "blocks", label: "Blocked dates" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const ACTIVE = ["PENDING", "CONFIRMED", "CHECKED_IN"] as const;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; created?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const t = await db.roomType.findUnique({ where: { id }, select: { name: true } });
  return { title: t?.name ?? "Room type" };
}

export default async function RoomTypePage({ params, searchParams }: Props) {
  const staff = await requirePage("rooms:read");
  const canWrite = can(staff.permissions, "rooms:write");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "details";
  const type = await db.roomType.findFirst({
    where: { id, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      rooms: { where: { deletedAt: null }, orderBy: { number: "asc" } },
    },
  });
  if (!type) notFound();
  const today = todayIST();

  let body: React.ReactNode = null;

  if (tab === "details") {
    body = (
      <AdminCard>
        <RoomTypeForm
          readOnly={!canWrite}
          amenityOptions={ROOM_AMENITY_KEYS.map((k) => ({ key: k, label: AMENITY_BY_KEY[k]?.label ?? k }))}
          room={{
            id: type.id,
            slug: type.slug,
            name: type.name,
            nameHi: type.nameHi ?? "",
            summary: type.summary,
            summaryHi: type.summaryHi ?? "",
            description: type.description,
            descriptionHi: type.descriptionHi ?? "",
            sizeSqFt: type.sizeSqFt,
            bedType: type.bedType,
            maxAdults: type.maxAdults,
            maxChildren: type.maxChildren,
            baseRatePaise: type.baseRatePaise,
            extraBedPaise: type.extraBedPaise,
            amenities: type.amenities,
            featured: type.featured,
            active: type.active,
          }}
        />
      </AdminCard>
    );
  }

  if (tab === "units") {
    const upcoming = await db.bookingRoom.groupBy({
      by: ["roomId"],
      where: {
        roomId: { in: type.rooms.map((r) => r.id) },
        active: true,
        checkOut: { gt: today },
        booking: { deletedAt: null, status: { in: [...ACTIVE] } },
      },
      _count: true,
    });
    const count = new Map(upcoming.map((u) => [u.roomId, u._count]));
    const active = type.rooms.filter((r) => r.status === "ACTIVE").length;
    body = (
      <AdminCard
        title="Room numbers"
        description={`${active} of ${type.rooms.length} room${type.rooms.length === 1 ? "" : "s"} can be booked. Each booking is given one of these rooms.`}
      >
        <UnitsManager
          roomTypeId={type.id}
          canWrite={canWrite}
          units={type.rooms.map((r) => ({
            id: r.id,
            number: r.number,
            floor: r.floor,
            status: r.status,
            notes: r.notes,
            upcoming: count.get(r.id) ?? 0,
          }))}
        />
      </AdminCard>
    );
  }

  if (tab === "photos") {
    const slots = type.images.length ? [] : await roomSlotImages(type.slug, type.name);
    body = (
      <AdminCard title="Photos" description="Shown as the photo carousel on the room page and as the cover on room cards.">
        <PhotosManager
          roomTypeId={type.id}
          roomName={type.name}
          slug={type.slug}
          canWrite={canWrite}
          canCrop={canWrite}
          photos={type.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt, mediaId: i.mediaId }))}
          slotPhotos={slots.map((s) => ({ url: s.url, alt: s.alt }))}
        />
      </AdminCard>
    );
  }

  if (tab === "rates") {
    const [rows, active, settings] = await Promise.all([
      db.priceRule.findMany({
        where: { OR: [{ roomTypeId: type.id }, { roomTypeId: null }] },
        orderBy: [{ active: "desc" }, { priority: "desc" }, { createdAt: "asc" }],
      }),
      loadPriceRules(type.id),
      getSettings(),
    ]);
    const quote = quoteStay({
      roomTypeId: type.id,
      baseRatePaise: type.baseRatePaise,
      rules: active,
      checkIn: today,
      checkOut: addDays(today, 14),
      gst: settings.gst,
    });
    const rules: RuleRow[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      adjustment: r.adjustment,
      value: r.value,
      startDate: r.startDate ? dayKey(r.startDate) : null,
      endDate: r.endDate ? dayKey(r.endDate) : null,
      daysOfWeek: r.daysOfWeek,
      priority: r.priority,
      active: r.active,
      scope: r.roomTypeId ? "type" : "all",
    }));
    body = (
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <AdminCard
          title="Rate rules"
          description={`Base rate ${formatINR(type.baseRatePaise)} per night before GST. Rules raise or lower it for particular nights.`}
        >
          <RateRules roomTypeId={type.id} roomName={type.name} rules={rules} canWrite={canWrite} />
        </AdminCard>
        <AdminCard title="Next 14 nights" description="What a guest pays per night for one room, before GST.">
          <Table className="min-w-0">
            <thead>
              <tr>
                <Th>Night</Th>
                <Th>Rule</Th>
                <Th className="text-right">Rate</Th>
                <Th className="text-right">GST</Th>
              </tr>
            </thead>
            <tbody>
              {quote.nights.map((n) => (
                <tr key={n.date}>
                  <Td className="whitespace-nowrap">{formatDay(n.date)}</Td>
                  <Td className="text-muted">{n.rule ?? "Base rate"}</Td>
                  <Td className="text-right font-medium tabular-nums">{formatINR(n.ratePaise)}</Td>
                  <Td className="text-muted text-right tabular-nums">
                    {gstPercentFor(n.ratePaise, settings.gst)}%
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </AdminCard>
      </div>
    );
  }

  if (tab === "blocks") {
    const roomIds = type.rooms.map((r) => r.id);
    const blocks = await db.roomBlock.findMany({
      where: { OR: [{ roomTypeId: type.id }, { roomId: { in: roomIds } }] },
      include: { room: { select: { number: true } } },
      orderBy: { startDate: "asc" },
    });
    const rows: BlockRow[] = await Promise.all(
      blocks.map(async (b) => {
        const past = b.endDate <= today;
        const conflicts = past
          ? []
          : await db.bookingRoom.findMany({
              where: {
                active: true,
                checkIn: { lt: b.endDate },
                checkOut: { gt: b.startDate },
                ...(b.roomId ? { roomId: b.roomId } : { roomTypeId: type.id }),
                booking: { deletedAt: null, status: { in: [...ACTIVE] } },
              },
              select: {
                room: { select: { number: true } },
                booking: { select: { id: true, reference: true, guest: { select: { name: true } } } },
              },
              take: 20,
            });
        return {
          id: b.id,
          roomId: b.roomId,
          roomNumber: b.room?.number ?? null,
          startDate: dayKey(b.startDate),
          endDate: dayKey(b.endDate),
          reason: b.reason,
          past,
          conflicts: conflicts.map((c) => ({
            id: c.booking.id,
            reference: c.booking.reference,
            guest: c.booking.guest.name,
            roomNumber: c.room.number,
          })),
        };
      }),
    );
    body = (
      <AdminCard title="Blocked dates">
        <BlocksManager
          roomTypeId={type.id}
          roomName={type.name}
          rooms={type.rooms.map((r) => ({ id: r.id, number: r.number }))}
          blocks={rows}
          canWrite={canWrite}
          today={dayKey(today)}
        />
      </AdminCard>
    );
  }

  return (
    <>
      <AdminPageHeader
        title={type.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {type.active ? <Badge tone="success">Bookable</Badge> : <Badge tone="neutral">Hidden from the website</Badge>}
            {type.featured ? <Badge tone="gold">Featured</Badge> : null}
            <span>
              {formatINR(type.baseRatePaise)} per night · {type.rooms.length} room{type.rooms.length === 1 ? "" : "s"}
            </span>
          </span>
        }
        back={{ href: "/admin/rooms", label: "Rooms & rates" }}
        actions={
          <>
            {type.active ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/rooms/${type.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden /> View on site
                </a>
              </Button>
            ) : null}
            {canWrite ? (
              <ConfirmButton
                action={deleteRoomType}
                fields={{ id: type.id, redirect: "1" }}
                title={`Delete ${type.name}?`}
                body="The room type and its room numbers are removed. Past bookings keep their history. This is refused while upcoming bookings use it."
                confirmLabel="Delete room type"
                size="sm"
                variant="ghost"
                className="text-danger"
              >
                Delete
              </ConfirmButton>
            ) : null}
          </>
        }
      />
      {sp.created ? (
        <p role="status" className="border-success/40 bg-success/10 mb-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
          <CheckCircle2 className="text-success size-4" aria-hidden />
          {type.name} was created. Add its room numbers so guests can book it, then add photos.
        </p>
      ) : null}
      <LinkTabs
        current={tab}
        tabs={TABS.map((t) => ({
          key: t.key,
          label:
            t.key === "units"
              ? `Rooms (${type.rooms.length})`
              : t.key === "photos"
                ? `Photos (${type.images.length})`
                : t.label,
          href: `/admin/rooms/${type.id}${t.key === "details" ? "" : `?tab=${t.key}`}`,
        }))}
      />
      {body}
    </>
  );
}
