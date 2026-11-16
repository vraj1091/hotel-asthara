"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  alt: string;
  altHi: string;
  width: number;
  height: number;
  folder: string;
  sizeBytes: number;
};

export const FOLDER_LABELS: Record<string, string> = {
  general: "General",
  hero: "Hero",
  rooms: "Rooms",
  gallery: "Gallery",
  offers: "Offers",
  about: "About",
};

export const formatBytes = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/**
 * Shrinks large JPG/PNG/WebP photos in the browser before upload (long edge 2400 px), so phone photos upload fast
 * and stay under hosting request limits. The server still compresses everything to WebP with sharp.
 * HEIC and anything the browser cannot decode is sent as-is.
 */
export async function prepareUpload(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Hosts cap request bodies (Vercel: 4.5 MB), so uploads go in batches that stay below this. */
const MAX_REQUEST_BYTES = 4_000_000;

export async function uploadMedia(
  files: File[],
  opts: { folder: string; alt?: string; crop?: Area | null } = { folder: "general" },
): Promise<{ items: MediaItem[]; errors: string[] }> {
  const prepared = await Promise.all(files.map(prepareUpload));
  const items: MediaItem[] = [];
  const errors: string[] = [];
  const batches: File[][] = [];
  for (const f of prepared) {
    if (f.size > MAX_REQUEST_BYTES) {
      errors.push(`"${f.name}" is too large to upload (${formatBytes(f.size)}). Save it as a JPG under 4 MB and try again.`);
      continue;
    }
    const last = batches.at(-1);
    if (last && last.reduce((s, x) => s + x.size, 0) + f.size <= MAX_REQUEST_BYTES) last.push(f);
    else batches.push([f]);
  }
  for (const batch of batches) {
    const fd = new FormData();
    for (const f of batch) fd.append("files", f);
    fd.set("folder", opts.folder);
    if (opts.alt) fd.set("alt", opts.alt);
    if (opts.crop) fd.set("crop", JSON.stringify(opts.crop));
    let json: { items?: MediaItem[]; errors?: string[]; error?: string } = {};
    let res: Response;
    try {
      res = await fetch("/api/admin/media", { method: "POST", body: fd });
      json = await res.json().catch(() => ({}));
    } catch {
      errors.push("Upload failed. Check your connection and try again.");
      continue;
    }
    if (res.status === 413) errors.push(`${batch.map((f) => `"${f.name}"`).join(", ")}: too large to upload. Use smaller photos.`);
    else if (!res.ok && !json.items?.length) errors.push(...(json.errors?.length ? json.errors : [json.error ?? "Upload failed. Try again."]));
    else {
      items.push(...(json.items ?? []));
      errors.push(...(json.errors ?? []));
    }
  }
  return { items, errors };
}

export async function fetchMedia(folder = "all", q = ""): Promise<MediaItem[]> {
  const params = new URLSearchParams({ folder, ...(q ? { q } : {}) });
  const res = await fetch(`/api/admin/media?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Could not load the media library.");
  return ((await res.json()) as { items: MediaItem[] }).items;
}

const ASPECTS = [
  { label: "Free", value: undefined },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
] as const;

/**
 * Crop an image. `src` can be an object URL (before upload) or a library URL (re-crop). The result is in the
 * image's natural pixels, which is what the server's sharp pipeline expects.
 */
export function CropDialog({
  src,
  open,
  onOpenChange,
  onConfirm,
  busy,
  title = "Crop image",
  defaultAspect = 16 / 9,
}: {
  src: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (area: Area) => void;
  busy?: boolean;
  title?: string;
  defaultAspect?: number;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(defaultAspect);
  const [area, setArea] = useState<Area | null>(null);
  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle className="font-heading pr-10 text-xl">{title}</DialogTitle>
        <DialogDescription className="text-muted mt-1 text-sm">
          Drag to position, use the slider or pinch to zoom. Keyboard: arrow keys move the image.
        </DialogDescription>
        <div className="bg-ink relative mt-4 h-[min(60vh,28rem)] overflow-hidden rounded-xl">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onComplete}
              objectFit="contain"
              restrictPosition
            />
          ) : null}
        </div>
        <div className="mt-4 grid gap-4">
          <div role="group" aria-label="Aspect ratio" className="flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button
                key={a.label}
                type="button"
                aria-pressed={aspect === a.value}
                onClick={() => setAspect(a.value)}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm",
                  aspect === a.value ? "border-accent bg-accent text-on-accent" : "border-line-strong hover:bg-surface-2",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm">
            <span className="text-muted w-12">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="accent-[var(--color-accent)] flex-1"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!area || busy} onClick={() => area && onConfirm(area)}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Apply crop
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
