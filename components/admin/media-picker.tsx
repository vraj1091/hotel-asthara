"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, Search, Trash2, Upload } from "lucide-react";
import {
  FOLDER_LABELS,
  fetchMedia,
  uploadMedia,
  type MediaItem,
} from "@/components/admin/media-tools";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Library browser in a dialog: search, filter by folder, upload new photos, pick one (or several with `multiple`).
 */
export function MediaLibraryDialog({
  open,
  onOpenChange,
  onPick,
  folder = "general",
  multiple = false,
  title = "Choose an image",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (items: MediaItem[]) => void;
  folder?: string;
  multiple?: boolean;
  title?: string;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    setError("");
    const t = setTimeout(() => {
      fetchMedia(filter, q)
        .then((list) => !cancelled && setItems(list))
        .catch((e: Error) => !cancelled && setError(e.message));
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, filter, q]);

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const { items: added, errors } = await uploadMedia([...files], { folder });
    setUploading(false);
    errors.forEach((e) => toast.error(e));
    if (added.length) {
      toast.success(added.length === 1 ? "Image uploaded." : `${added.length} images uploaded.`);
      setItems((prev) => [...added, ...(prev ?? [])]);
      setSelected((prev) => (multiple ? [...added.map((a) => a.id), ...prev] : [added[0]!.id]));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const toggle = (id: string) =>
    setSelected((prev) =>
      multiple ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col">
        <DialogTitle className="font-heading pr-10 text-xl">{title}</DialogTitle>
        <DialogDescription className="text-muted mt-1 text-sm">
          Pick from the library or upload new photos. JPG, PNG or WebP up to 15 MB (HEIC up to 4 MB); they are compressed
          automatically.
        </DialogDescription>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input
              aria-label="Search images"
              placeholder="Search by name or alt text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 pl-9 text-sm"
            />
          </div>
          <select
            aria-label="Folder"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border-line-strong bg-bg h-10 rounded-xl border px-3 text-sm"
          >
            <option value="all">All folders</option>
            {Object.entries(FOLDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
            multiple
            className="sr-only"
            id="media-dialog-upload"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button type="button" variant="dark" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>

        <div className="mt-4 min-h-48 flex-1 overflow-y-auto" aria-busy={items === null}>
          {error ? (
            <p role="alert" className="text-danger p-4">
              {error}
            </p>
          ) : items === null ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="skeleton aspect-square" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="grid place-items-center gap-3 py-12 text-center">
              <ImagePlus className="text-muted size-8" aria-hidden />
              <p className="text-muted">No images {q || filter !== "all" ? "match" : "yet"}. Upload your first photo.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {items.map((item) => {
                const on = selected.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      onDoubleClick={() => !multiple && (onPick([item]), onOpenChange(false))}
                      aria-pressed={on}
                      aria-label={`${item.alt || item.filename}${on ? ", selected" : ""}`}
                      className={cn(
                        "bg-surface-3 relative block aspect-square w-full overflow-hidden rounded-xl ring-offset-2 transition",
                        on ? "ring-accent ring-3" : "hover:opacity-90",
                      )}
                    >
                      <Image src={item.url} alt="" fill sizes="160px" className="object-cover" />
                      {on ? (
                        <span className="bg-accent text-on-accent absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full">
                          <Check className="size-4" aria-hidden />
                        </span>
                      ) : null}
                    </button>
                    <p className="text-muted mt-1 truncate text-xs" title={item.filename}>
                      {item.alt || item.filename}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-line mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-muted text-sm">{selected.length ? `${selected.length} selected` : "Nothing selected"}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selected.length}
              onClick={() => {
                const map = new Map((items ?? []).map((i) => [i.id, i]));
                onPick(selected.map((id) => map.get(id)).filter((x): x is MediaItem => !!x));
                onOpenChange(false);
              }}
            >
              {multiple ? "Add selected" : "Use this image"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Form field holding one image URL (hidden input `name`). Shows a preview with Change / Remove.
 */
export function MediaPickerField({
  name,
  label,
  defaultValue = "",
  folder = "general",
  hint,
  aspect = "aspect-[16/9]",
  slotFallback,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  folder?: string;
  hint?: string;
  aspect?: string;
  slotFallback?: string | null; // a /public/images/hotel photo that is used while nothing is chosen
}) {
  const [url, setUrl] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  return (
    <div className="grid content-start gap-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} value={url} />
      <div className={cn("border-line-strong bg-surface-2 relative overflow-hidden rounded-xl border border-dashed", aspect)}>
        {url ? (
          <Image src={url} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
        ) : slotFallback ? (
          <>
            <Image src={slotFallback} alt="" fill sizes="40vw" className="object-cover opacity-60" />
            <span className="theme-dark bg-bg/80 absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-xs">
              Using photo from /public/images/hotel
            </span>
          </>
        ) : (
          <div className="text-muted absolute inset-0 grid place-items-center text-sm">
            <span className="grid justify-items-center gap-1">
              <ImagePlus className="size-6" aria-hidden />
              No image – the site shows the arch placeholder
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <ImagePlus aria-hidden />
          {url ? "Change image" : "Choose image"}
        </Button>
        {url ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setUrl("")}>
            <Trash2 aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>
      {hint ? <p className="text-muted text-sm">{hint}</p> : null}
      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        folder={folder}
        onPick={([item]) => item && setUrl(item.url)}
      />
    </div>
  );
}
