"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { GALLERY_TAG, OFFERS_TAG } from "@/features/cms/queries";
import { ROOMS_TAG } from "@/features/rooms/queries";
import { ActionError } from "@/lib/action";
import { adminAction } from "@/lib/admin-action";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { deleteImage, MEDIA_FOLDERS, mediaUsage, recropImage } from "@/lib/media";
import { cleanText } from "@/lib/sanitize";
import { SECTIONS_TAG, SETTINGS_TAG } from "@/lib/settings";

const zId = z.string().min(1).max(40);

/** Image URLs can appear on rooms, gallery, offers, homepage sections and settings: refresh them all. */
function refreshEverywhere() {
  revalidateTag(ROOMS_TAG);
  revalidateTag(GALLERY_TAG);
  revalidateTag(OFFERS_TAG);
  revalidateTag(SETTINGS_TAG);
  revalidateTag(SECTIONS_TAG);
  revalidatePath("/admin/media");
  revalidatePath("/", "layout");
}

const updateSchema = z.object({
  id: zId,
  alt: z.string().max(400).optional(),
  altHi: z.string().max(400).optional(),
  folder: z.enum(MEDIA_FOLDERS),
});

export async function updateMedia(_prev: unknown, fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const input = updateSchema.parse(Object.fromEntries(fd));
    const asset = await db.mediaAsset.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!asset) throw new ActionError("That image no longer exists.");
    const alt = cleanText(input.alt ?? "", 200);
    const altHi = cleanText(input.altHi ?? "", 200);
    const updated = await db.mediaAsset.update({
      where: { id: input.id },
      data: { alt, altHi, folder: input.folder },
    });
    // Gallery entries carry their own alt text; keep entries that still used the old text in step.
    await db.galleryImage.updateMany({ where: { mediaId: input.id, alt: asset.alt }, data: { alt } });
    await db.galleryImage.updateMany({ where: { mediaId: input.id, altHi: asset.altHi }, data: { altHi } });
    await writeAudit({
      userId: staff.id,
      action: "media.update",
      entity: "MediaAsset",
      entityId: input.id,
      meta: { folder: input.folder },
    });
    revalidateTag(GALLERY_TAG);
    revalidatePath("/admin/media");
    return {
      id: updated.id,
      alt: updated.alt,
      altHi: updated.altHi,
      folder: updated.folder,
    };
  }, "Image details saved.");
}

const zCrop = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});

export async function cropMedia(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const crop = zCrop.parse(JSON.parse(String(fd.get("crop") ?? "{}")));
    const { updated } = await recropImage(id, crop);
    await writeAudit({ userId: staff.id, action: "media.crop", entity: "MediaAsset", entityId: id, meta: crop });
    refreshEverywhere();
    return {
      id: updated.id,
      url: updated.url,
      width: updated.width,
      height: updated.height,
      sizeBytes: updated.sizeBytes,
    };
  }, "Image cropped. Every page that uses it now shows the new version.");
}

/** Where an image is used, shown before deleting it. */
export async function getMediaUsage(fd: FormData) {
  return adminAction("content:write", async () => {
    const id = zId.parse(fd.get("id"));
    return mediaUsage(id);
  });
}

export async function deleteMedia(fd: FormData) {
  return adminAction("content:write", async (staff) => {
    const id = zId.parse(fd.get("id"));
    const asset = await db.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new ActionError("That image was already deleted.");
    const usage = await mediaUsage(id);
    // Offers point at the image by URL: clear them so no offer shows a broken picture.
    await db.offer.updateMany({
      where: { imageUrl: { startsWith: asset.url.split("?")[0]! } },
      data: { imageUrl: null },
    });
    await deleteImage(id);
    await writeAudit({
      userId: staff.id,
      action: "media.delete",
      entity: "MediaAsset",
      entityId: id,
      meta: { filename: asset.filename, rooms: usage.rooms, gallery: usage.gallery, content: usage.content },
    });
    refreshEverywhere();
    return { id };
  }, "Image deleted.");
}
