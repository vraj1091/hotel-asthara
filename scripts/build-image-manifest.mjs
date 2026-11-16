// Scans public/images/hotel and writes lib/image-manifest.json (path, width, height for every photo).
// Runs before `next build` so the photo slots work on hosts where the public folder is not readable at runtime
// (Vercel). In development the site reads the folder directly, so new photos appear on refresh.
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(process.cwd(), "public", "images", "hotel");
const OUT = path.join(process.cwd(), "lib", "image-manifest.json");
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;

async function walk(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (IMAGE.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [];
for (const full of (await walk(ROOT)).sort()) {
  try {
    const meta = await sharp(full).metadata();
    const swap = (meta.orientation ?? 1) >= 5;
    files.push({
      path: path.relative(ROOT, full).split(path.sep).join("/"),
      width: (swap ? meta.height : meta.width) ?? 1600,
      height: (swap ? meta.width : meta.height) ?? 1200,
      mtime: Math.round((await stat(full)).mtimeMs),
    });
  } catch (error) {
    console.warn(`[images] skipped ${full}: ${error.message}`);
  }
}
await writeFile(OUT, `${JSON.stringify({ files }, null, 2)}\n`);
console.log(`[images] ${files.length} photo(s) found in public/images/hotel`);
