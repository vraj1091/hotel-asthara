import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export const OFFERS_TAG = "offers";
export const GALLERY_TAG = "gallery";
export const TESTIMONIALS_TAG = "testimonials";

export const getActiveOffers = unstable_cache(
  async () => {
    const now = new Date();
    return db.offer.findMany({
      where: {
        active: true,
        deletedAt: null,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      include: { coupon: { select: { code: true, kind: true, value: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  },
  ["active-offers"],
  { tags: [OFFERS_TAG], revalidate: 300 },
);

export const getGalleryImages = unstable_cache(
  async () =>
    db.galleryImage.findMany({
      where: { visible: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ["gallery-images"],
  { tags: [GALLERY_TAG], revalidate: 300 },
);

export const getApprovedTestimonials = unstable_cache(
  async () =>
    db.testimonial.findMany({
      where: { approved: true, deletedAt: null },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
  ["approved-testimonials"],
  { tags: [TESTIMONIALS_TAG], revalidate: 300 },
);
