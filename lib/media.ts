import "server-only";
import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { ActionError } from "@/lib/action";
import { db } from "@/lib/db";

/**
 * Media library storage.
 * Every upload is auto-rotated, optionally cropped, resized to at most MAX_EDGE px on the long side, stripped of
 * metadata (GPS etc.) and re-encoded as WebP. Then it is stored:
 *   - in Cloudinary when CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET are set, or
 *   - in the database (MediaBlob) and served from /media/<id>.webp, which works on any host with no extra service.
 * Pages render these through next/image, which makes the responsive AVIF/WebP sizes and lazy-loads them.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_EDGE = 2400;
export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
];
export const MEDIA_FOLDERS = ["general", "hero", "rooms", "gallery", "offers", "about"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export type CropRect = { x: number; y: number; width: number; height: number };

function cloudinaryConfig() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  return cloud && key && secret ? { cloud, key, secret } : null;
}

export const mediaStorageLabel = () =>
  cloudinaryConfig() ? "Cloudinary" : "Database (served from this site)";

/** Decode, crop, resize and compress. Throws an ActionError with a clear message for unreadable files. */
export async function processImage(input: Buffer, crop?: CropRect | null) {
  let pipeline = sharp(input, { failOn: "error" }).rotate();
  let meta: Metadata;
  try {
    meta = await sharp(input).rotate().metadata();
  } catch {
    throw new ActionError("That file is not an image we can read. Upload a JPG, PNG or WebP photo.");
  }
  // EXIF orientation 5–8 swaps width and height once rotated.
  const swap = (meta.orientation ?? 1) >= 5;
  const srcW = (swap ? meta.height : meta.width) ?? 0;
  const srcH = (swap ? meta.width : meta.height) ?? 0;
  if (crop) {
    const left = Math.max(0, Math.round(crop.x));
    const top = Math.max(0, Math.round(crop.y));
    const width = Math.min(srcW - left, Math.round(crop.width));
    const height = Math.min(srcH - top, Math.round(crop.height));
    if (width < 16 || height < 16) throw new ActionError("The crop area is too small.");
    // rotate() must run before extract so the crop matches what the person saw.
    pipeline = sharp(await pipeline.toBuffer()).extract({ left, top, width, height });
  }
  const { data, info } = await pipeline
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, sizeBytes: info.size };
}

async function uploadToCloudinary(data: Buffer, folder: string, publicId: string) {
  const cfg = cloudinaryConfig()!;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = `folder=hotel-asthara/${folder}&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(params + cfg.secret)
    .digest("hex");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: "image/webp" }));
  form.append("api_key", cfg.key);
  form.append("timestamp", String(timestamp));
  form.append("folder", `hotel-asthara/${folder}`);
  form.append("public_id", publicId);
  form.append("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = (await res.json()) as { secure_url?: string; public_id?: string; error?: { message: string } };
  if (!res.ok || !json.secure_url)
    throw new ActionError(`Cloudinary upload failed: ${json.error?.message ?? res.statusText}`);
  return { url: json.secure_url, publicId: json.public_id ?? null };
}

async function deleteFromCloudinary(publicId: string) {
  const cfg = cloudinaryConfig();
  if (!cfg) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${cfg.secret}`)
    .digest("hex");
  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", cfg.key);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/destroy`, {
    method: "POST",
    body: form,
  }).catch(() => undefined);
}

const cleanName = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .slice(0, 80) || "photo";

/** Store a new image. `file` comes straight from a multipart upload. */
export async function storeImage(args: {
  file: File;
  folder: string;
  alt?: string;
  altHi?: string;
  crop?: CropRect | null;
  userId?: string | null;
}) {
  const { file } = args;
  if (file.size > MAX_UPLOAD_BYTES)
    throw new ActionError(`"${file.name}" is larger than 15 MB. Choose a smaller photo.`);
  if (file.type && !ACCEPTED_TYPES.includes(file.type))
    throw new ActionError(`"${file.name}" is not a JPG, PNG, WebP, AVIF or HEIC image.`);
  const processed = await processImage(Buffer.from(await file.arrayBuffer()), args.crop);
  const folder = (MEDIA_FOLDERS as readonly string[]).includes(args.folder) ? args.folder : "general";
  const base = {
    filename: `${cleanName(file.name)}.webp`,
    mime: "image/webp",
    width: processed.width,
    height: processed.height,
    sizeBytes: processed.sizeBytes,
    alt: (args.alt ?? "").slice(0, 200),
    altHi: (args.altHi ?? "").slice(0, 200),
    folder,
    uploadedById: args.userId ?? null,
  };

  if (cloudinaryConfig()) {
    const asset = await db.mediaAsset.create({
      data: { ...base, storage: "CLOUDINARY", url: "pending" },
    });
    try {
      const up = await uploadToCloudinary(processed.data, folder, asset.id);
      return db.mediaAsset.update({
        where: { id: asset.id },
        data: { url: up.url, publicId: up.publicId },
      });
    } catch (error) {
      await db.mediaAsset.delete({ where: { id: asset.id } });
      throw error;
    }
  }

  return db.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.create({ data: { ...base, storage: "DATABASE", url: "pending" } });
    await tx.mediaBlob.create({ data: { mediaId: asset.id, data: new Uint8Array(processed.data) } });
    return tx.mediaAsset.update({
      where: { id: asset.id },
      data: { url: `/media/${asset.id}.webp` },
    });
  });
}

/** Re-crop an existing image in place. The URL changes so browsers and next/image fetch the new version. */
export async function recropImage(id: string, crop: CropRect) {
  const asset = await db.mediaAsset.findFirst({ where: { id, deletedAt: null } });
  if (!asset) throw new ActionError("That image no longer exists.");
  let source: Buffer;
  if (asset.storage === "DATABASE") {
    const blob = await db.mediaBlob.findUnique({ where: { mediaId: id } });
    if (!blob) throw new ActionError("The image data is missing. Upload it again.");
    source = Buffer.from(blob.data);
  } else {
    const res = await fetch(asset.url);
    if (!res.ok) throw new ActionError("Could not download the image from Cloudinary.");
    source = Buffer.from(await res.arrayBuffer());
  }
  const processed = await processImage(source, crop);
  const version = Date.now().toString(36);
  let url: string;
  let publicId = asset.publicId;
  if (asset.storage === "DATABASE") {
    await db.mediaBlob.update({
      where: { mediaId: id },
      data: { data: new Uint8Array(processed.data) },
    });
    url = `/media/${id}.webp?v=${version}`;
  } else {
    if (asset.publicId) await deleteFromCloudinary(asset.publicId);
    const up = await uploadToCloudinary(processed.data, asset.folder, `${id}-${version}`);
    url = up.url;
    publicId = up.publicId;
  }
  const updated = await db.mediaAsset.update({
    where: { id },
    data: {
      url,
      publicId,
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.sizeBytes,
    },
  });
  // Keep every place that shows this photo pointing at the new version.
  await Promise.all([
    db.roomImage.updateMany({ where: { mediaId: id }, data: { url } }),
    db.galleryImage.updateMany({ where: { mediaId: id }, data: { url } }),
  ]);
  return { updated, oldUrl: asset.url };
}

/** Where an image is used, so the admin sees what a delete will affect. */
export async function mediaUsage(id: string) {
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { url: true } });
  if (!asset) return { rooms: 0, gallery: 0, content: [] as string[] };
  const base = asset.url.split("?")[0]!;
  const [rooms, gallery, settings, sections, offers] = await Promise.all([
    db.roomImage.count({ where: { mediaId: id } }),
    db.galleryImage.count({ where: { mediaId: id } }),
    db.setting.findMany({ select: { key: true, value: true } }),
    db.pageSection.findMany({ select: { key: true, content: true } }),
    db.offer.findMany({
      where: { deletedAt: null, imageUrl: { startsWith: base } },
      select: { title: true },
    }),
  ]);
  const content = [
    ...settings.filter((s) => JSON.stringify(s.value).includes(base)).map((s) => `Settings: ${s.key}`),
    ...sections
      .filter((s) => JSON.stringify(s.content).includes(base))
      .map((s) => `Homepage: ${s.key}`),
    ...offers.map((o) => `Offer: ${o.title}`),
  ];
  return { rooms, gallery, content };
}

/** Permanently delete. Room photos and gallery entries that use it are removed with it (cascade). */
export async function deleteImage(id: string) {
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return;
  if (asset.storage === "CLOUDINARY" && asset.publicId) await deleteFromCloudinary(asset.publicId);
  await db.mediaAsset.delete({ where: { id } });
}
