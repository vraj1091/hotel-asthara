import "server-only";
import { getGalleryImages } from "@/features/cms/queries";
import { gallerySlotImages, roomSlotImages, slotImage } from "@/lib/image-slots";

/**
 * One place that decides which photo to show. Order of preference:
 *   1. photos uploaded and attached in the admin (database),
 *   2. photos dropped into /public/images/hotel (see lib/image-slots.ts),
 *   3. nothing – components then render the arch placeholder.
 */

export type SitePhoto = { id: string; url: string; alt: string; width?: number; height?: number };

export async function roomPhotos(room: {
  slug: string;
  name: string;
  images: { id: string; url: string; alt: string }[];
}): Promise<SitePhoto[]> {
  if (room.images.length) return room.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt || room.name }));
  const slots = await roomSlotImages(room.slug, room.name);
  return slots.map((s, i) => ({ id: `slot-${room.slug}-${i}`, ...s }));
}

export async function heroPhoto(uploadedUrl?: string | null) {
  if (uploadedUrl) return uploadedUrl;
  return (await slotImage("hero"))?.url ?? null;
}

export async function namedPhoto(name: "about" | "exterior" | "reception" | "og", uploadedUrl?: string | null) {
  if (uploadedUrl) return uploadedUrl;
  return (await slotImage(name))?.url ?? null;
}

export type GalleryPhoto = SitePhoto & { category: string; altHi?: string };

/** Admin gallery first (in the admin's order), then any slot photos. */
export async function galleryPhotos(): Promise<GalleryPhoto[]> {
  const [db, slots] = await Promise.all([
    getGalleryImages().catch(() => []),
    gallerySlotImages().catch(() => []),
  ]);
  return [
    ...db.map((g) => ({ id: g.id, url: g.url, alt: g.alt, altHi: g.altHi, category: g.category })),
    ...slots.map((s, i) => ({
      id: `slot-gallery-${i}`,
      url: s.url,
      alt: s.alt,
      width: s.width,
      height: s.height,
      category: s.category,
    })),
  ];
}
