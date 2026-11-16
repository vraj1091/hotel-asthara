import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export const ROOMS_TAG = "rooms";

/** Public room list with photos in the order the admin dragged them. Cached for 5 minutes and cleared on every admin edit. */
export const getRoomTypes = unstable_cache(
  async () =>
    db.roomType.findMany({
      where: { active: true, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        _count: { select: { rooms: { where: { deletedAt: null, status: "ACTIVE" } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { baseRatePaise: "asc" }],
    }),
  ["room-types"],
  { tags: [ROOMS_TAG], revalidate: 300 },
);

export type RoomTypeView = Awaited<ReturnType<typeof getRoomTypes>>[number];

export const getRoomTypeBySlug = (slug: string) =>
  unstable_cache(
    async () =>
      db.roomType.findFirst({
        where: { slug, active: true, deletedAt: null },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          _count: { select: { rooms: { where: { deletedAt: null, status: "ACTIVE" } } } },
        },
      }),
    ["room-type", slug],
    { tags: [ROOMS_TAG], revalidate: 300 },
  )();

/** Hindi falls back to English when the admin has not translated a field yet. */
export function roomText(room: RoomTypeView, locale: string) {
  const hi = locale === "hi";
  return {
    name: (hi && room.nameHi) || room.name,
    summary: (hi && room.summaryHi) || room.summary,
    description: (hi && room.descriptionHi) || room.description,
  };
}
