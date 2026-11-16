import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, BedDouble, ExternalLink, Pencil, Plus } from "lucide-react";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { AdminCard, AdminPageHeader, EmptyState } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteRoomType, moveRoomType, toggleRoomType } from "@/features/rooms/admin-actions";
import { db } from "@/lib/db";
import { roomSlotImages } from "@/lib/image-slots";
import { can } from "@/lib/permissions";
import { requirePage } from "@/lib/session";
import { formatINR, pluralize } from "@/lib/utils";

export const metadata = { title: "Rooms & rates" };

export default async function RoomsAdminPage() {
  const staff = await requirePage("rooms:read");
  const canWrite = can(staff.permissions, "rooms:write");
  const types = await db.roomType.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { baseRatePaise: "asc" }],
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      rooms: { where: { deletedAt: null }, select: { status: true } },
      _count: { select: { images: true } },
    },
  });
  const covers = await Promise.all(
    types.map(async (t) =>
      t.images[0]
        ? { url: t.images[0].url, slot: false }
        : await roomSlotImages(t.slug, t.name).then((s) => (s[0] ? { url: s[0].url, slot: true } : null)),
    ),
  );

  return (
    <>
      <AdminPageHeader
        title="Rooms & rates"
        description="Room types guests can book, their units, photos, rates and blocked dates. The order here is the order on the website."
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/admin/rooms/new">
                <Plus aria-hidden /> New room type
              </Link>
            </Button>
          ) : null
        }
      />
      {types.length === 0 ? (
        <AdminCard>
          <EmptyState
            icon={<BedDouble />}
            title="No room types yet"
            body="Add your first room type, then its room numbers, photos and rates."
            action={
              canWrite ? (
                <Button asChild>
                  <Link href="/admin/rooms/new">
                    <Plus aria-hidden /> New room type
                  </Link>
                </Button>
              ) : null
            }
          />
        </AdminCard>
      ) : (
        <ul className="grid gap-4">
          {types.map((t, i) => {
            const active = t.rooms.filter((r) => r.status === "ACTIVE").length;
            const maintenance = t.rooms.length - active;
            const cover = covers[i];
            return (
              <li key={t.id} className="card grid gap-4 p-4 shadow-none sm:grid-cols-[9rem_1fr_auto] sm:items-center">
                <div className="theme-dark bg-bg relative aspect-[4/3] overflow-hidden rounded-xl sm:aspect-[4/3]">
                  {cover ? (
                    <Image src={cover.url} alt="" fill sizes="144px" className="object-cover" />
                  ) : (
                    <span className="text-muted absolute inset-0 grid place-items-center text-xs">No photo</span>
                  )}
                  {cover?.slot ? (
                    <span className="bg-bg/80 absolute bottom-1 left-1 rounded-full px-2 py-0.5 text-[0.65rem]">
                      Photo slot
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-xl">
                      <Link href={`/admin/rooms/${t.id}`} className="link-underline">
                        {t.name}
                      </Link>
                    </h2>
                    {t.active ? <Badge tone="success">Bookable</Badge> : <Badge tone="neutral">Hidden</Badge>}
                    {t.featured ? <Badge tone="gold">Featured</Badge> : null}
                  </div>
                  <p className="text-muted mt-1 text-sm">
                    {formatINR(t.baseRatePaise)} per night · {t.sizeSqFt} sq ft · {t.bedType} · sleeps{" "}
                    {t.maxAdults + t.maxChildren}
                  </p>
                  <p className="text-muted text-sm">
                    {pluralize(t.rooms.length, "room")}
                    {maintenance ? ` (${maintenance} in maintenance)` : ""} ·{" "}
                    {pluralize(t._count.images, "photo")} · /rooms/{t.slug}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {canWrite ? (
                    <>
                      <ActionButton
                        action={moveRoomType}
                        fields={{ id: t.id, dir: "up" }}
                        size="icon"
                        variant="ghost"
                        disabled={i === 0}
                        aria-label={`Move ${t.name} up`}
                        title="Move up"
                      >
                        <ArrowUp aria-hidden />
                      </ActionButton>
                      <ActionButton
                        action={moveRoomType}
                        fields={{ id: t.id, dir: "down" }}
                        size="icon"
                        variant="ghost"
                        disabled={i === types.length - 1}
                        aria-label={`Move ${t.name} down`}
                        title="Move down"
                      >
                        <ArrowDown aria-hidden />
                      </ActionButton>
                      <ActionButton
                        action={toggleRoomType}
                        fields={{ id: t.id, field: "active", value: String(!t.active) }}
                        size="sm"
                        variant="outline"
                        success={t.active ? "Hidden from the website." : "Bookable on the website."}
                      >
                        {t.active ? "Hide" : "Make bookable"}
                      </ActionButton>
                    </>
                  ) : null}
                  <Button asChild size="sm" variant={canWrite ? "dark" : "outline"}>
                    <Link href={`/admin/rooms/${t.id}`}>
                      <Pencil aria-hidden /> {canWrite ? "Edit" : "View"}
                    </Link>
                  </Button>
                  {t.active ? (
                    <Button asChild size="icon" variant="ghost" title="View on website">
                      <a href={`/rooms/${t.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${t.name} on the website`}>
                        <ExternalLink aria-hidden />
                      </a>
                    </Button>
                  ) : null}
                  {canWrite ? (
                    <ConfirmButton
                      action={deleteRoomType}
                      fields={{ id: t.id }}
                      title={`Delete ${t.name}?`}
                      body="The room type and its room numbers are removed from the website and the admin. Past bookings keep their history. This is refused while upcoming bookings use it – hide it instead if you only want to stop selling it."
                      confirmLabel="Delete room type"
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                    >
                      Delete
                    </ConfirmButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
