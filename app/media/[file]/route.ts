import { db } from "@/lib/db";

/** Serves images stored in the database. URLs are content-addressed by id (+ ?v= after a re-crop), so they can be
 *  cached for a year. next/image fetches from here and serves resized AVIF/WebP copies to visitors. */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const id = file.replace(/\.[a-z0-9]+$/i, "");
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return new Response("Not found", { status: 404 });

  const asset = await db.mediaAsset.findFirst({
    where: { id, deletedAt: null, storage: "DATABASE" },
    select: { mime: true, updatedAt: true, blob: { select: { data: true } } },
  });
  if (!asset?.blob) return new Response("Not found", { status: 404 });

  const etag = `"${id}-${asset.updatedAt.getTime().toString(36)}"`;
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304 });

  return new Response(new Uint8Array(asset.blob.data), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
