import "server-only";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import manifest from "@/lib/image-manifest.json";

/**
 * Photo slots: drop your own photos into /public/images/hotel and they appear on the site (see the README in that
 * folder). Photos uploaded in Admin → Media always take priority; slot photos fill in where nothing is uploaded;
 * a tasteful placeholder shows where neither exists. Nothing is ever invented.
 *
 *   hero.jpg                       homepage hero
 *   about.jpg                      about page
 *   exterior.jpg, reception.jpg    used on the about and location pages and in the gallery
 *   og.jpg                         social sharing image (1200 × 630)
 *   rooms/<room-slug>/01.jpg …     photos for one room type, in file-name order
 *   gallery/<category>/*.jpg       gallery photos; the folder name is the category (rooms, hotel, reception …)
 */

export type SlotImage = { url: string; width: number; height: number; alt: string };
type Entry = { path: string; width: number; height: number; mtime: number };

const ROOT = path.join(process.cwd(), "public", "images", "hotel");
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
const isDev = process.env.NODE_ENV !== "production";

let cache: { at: number; entries: Entry[] } | null = null;

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (IMAGE.test(entry.name)) out.push(full);
  }
  return out;
}

async function scan(): Promise<Entry[]> {
  const files = (await walk(ROOT)).sort();
  return Promise.all(
    files.map(async (full) => {
      const meta = await sharp(full)
        .metadata()
        .catch(() => ({ width: 1600, height: 1200, orientation: 1 }) as Metadata);
      const swap = (meta.orientation ?? 1) >= 5;
      return {
        path: path.relative(ROOT, full).split(path.sep).join("/"),
        width: (swap ? meta.height : meta.width) ?? 1600,
        height: (swap ? meta.width : meta.height) ?? 1200,
        mtime: Math.round((await stat(full)).mtimeMs),
      };
    }),
  );
}

async function entries(): Promise<Entry[]> {
  const ttl = isDev ? 3_000 : Number.POSITIVE_INFINITY;
  if (cache && Date.now() - cache.at < ttl) return cache.entries;
  let list: Entry[];
  try {
    list = await scan();
  } catch {
    list = (manifest as { files: Entry[] }).files; // public/ not readable at runtime (e.g. Vercel)
  }
  cache = { at: Date.now(), entries: list };
  return list;
}

/** "front-desk_at-night.jpg" → "Front desk at night" */
function altFromName(file: string) {
  const name = file
    .split("/")
    .pop()!
    .replace(IMAGE, "")
    .replace(/^\d+[-_ ]*/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

const toImage = (e: Entry, fallbackAlt: string): SlotImage => ({
  url: `/images/hotel/${e.path}?v=${e.mtime.toString(36)}`,
  width: e.width,
  height: e.height,
  alt: altFromName(e.path) || fallbackAlt,
});

/** A single named slot: hero, about, exterior, reception, og. */
export async function slotImage(name: string, alt = ""): Promise<SlotImage | null> {
  const hit = (await entries()).find((e) => e.path.replace(IMAGE, "").toLowerCase() === name);
  return hit ? { ...toImage(hit, alt), alt: alt || toImage(hit, alt).alt } : null;
}

/** Photos for one room type from rooms/<slug>/. */
export async function roomSlotImages(slug: string, roomName: string): Promise<SlotImage[]> {
  const prefix = `rooms/${slug}/`;
  return (await entries())
    .filter((e) => e.path.toLowerCase().startsWith(prefix))
    .map((e) => toImage(e, roomName));
}

/** Gallery photos from gallery/<category>/, plus exterior and reception if present. */
export async function gallerySlotImages(): Promise<(SlotImage & { category: string })[]> {
  const all = await entries();
  const out: (SlotImage & { category: string })[] = [];
  for (const e of all) {
    const parts = e.path.split("/");
    if (parts[0] === "gallery" && parts.length >= 3)
      out.push({ ...toImage(e, "Hotel Asthara"), category: parts[1]!.toLowerCase() });
  }
  for (const name of ["exterior", "reception"]) {
    const hit = all.find((e) => e.path.replace(IMAGE, "").toLowerCase() === name);
    if (hit) out.push({ ...toImage(hit, `Hotel Asthara ${name}`), category: name });
  }
  return out;
}
