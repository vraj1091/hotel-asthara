import { NextResponse } from "next/server";
import { z } from "zod";
import { ActionError } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { MEDIA_FOLDERS, storeImage } from "@/lib/media";
import type { Permission } from "@/lib/permissions";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { staffWithAny } from "@/lib/session";

// Anyone who can attach photos somewhere (website, rooms, offers) may browse and upload to the library.
const MEDIA_PERMS: Permission[] = ["content:write", "rooms:write", "offers:write"];
export const maxDuration = 60;

const listQuery = z.object({
  folder: z.string().max(40).optional(),
  q: z.string().max(100).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(request: Request) {
  const staff = await staffWithAny(MEDIA_PERMS);
  if (!staff) return NextResponse.json({ error: "You do not have access to the media library." }, { status: 403 });
  const parsed = listQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { folder, q, take } = parsed.data;
  const items = await db.mediaAsset.findMany({
    where: {
      deletedAt: null,
      url: { not: "pending" },
      ...(folder && folder !== "all" ? { folder } : {}),
      ...(q
        ? {
            OR: [
              { filename: { contains: q, mode: "insensitive" } },
              { alt: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, url: true, filename: true, alt: true, altHi: true, width: true, height: true, folder: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: take ?? 120,
  });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const blocked = assertSameOrigin(request);
  if (blocked) return blocked;
  const staff = await staffWithAny(MEDIA_PERMS);
  if (!staff) return NextResponse.json({ error: "You do not have permission to upload images." }, { status: 403 });
  const limit = await rateLimit("media-upload", staff.id || clientIp(request.headers), { limit: 120, windowMs: 10 * 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Too many uploads. Wait a few minutes." }, { status: 429 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload could not be read. Try again." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NextResponse.json({ error: "Choose at least one image." }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: "Upload up to 20 images at a time." }, { status: 400 });
  const folderRaw = String(form.get("folder") ?? "general");
  const folder = (MEDIA_FOLDERS as readonly string[]).includes(folderRaw) ? folderRaw : "general";
  const alt = String(form.get("alt") ?? "").slice(0, 200);
  let crop: { x: number; y: number; width: number; height: number } | null = null;
  const cropRaw = form.get("crop");
  if (typeof cropRaw === "string" && cropRaw) {
    const c = z
      .object({ x: z.number().min(0), y: z.number().min(0), width: z.number().positive(), height: z.number().positive() })
      .safeParse(JSON.parse(cropRaw));
    if (c.success) crop = c.data;
  }

  const created = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const asset = await storeImage({
        file,
        folder,
        alt: alt || undefined,
        crop: files.length === 1 ? crop : null,
        userId: staff.id,
      });
      created.push({
        id: asset.id,
        url: asset.url,
        filename: asset.filename,
        alt: asset.alt,
        altHi: asset.altHi,
        width: asset.width,
        height: asset.height,
        folder: asset.folder,
        sizeBytes: asset.sizeBytes,
      });
    } catch (error) {
      errors.push(error instanceof ActionError ? error.message : `"${file.name}" could not be processed.`);
      if (!(error instanceof ActionError)) console.error("[media] upload failed", error);
    }
  }
  if (created.length)
    await writeAudit({
      userId: staff.id,
      action: "media.upload",
      entity: "MediaAsset",
      entityId: created[0]!.id,
      meta: { count: created.length, folder },
    });
  return NextResponse.json(
    { items: created, errors },
    { status: created.length ? 200 : 400, headers: { "Cache-Control": "no-store" } },
  );
}
