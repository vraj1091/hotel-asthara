"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Copy, Crop, ImagePlus, Loader2, Search, Upload } from "lucide-react";
import { ActionForm, ConfirmButton, FormField, SubmitButton, useRunAction } from "@/components/admin/forms";
import {
  CropDialog,
  FOLDER_LABELS,
  fetchMedia,
  formatBytes,
  prepareUpload,
  uploadMedia,
  type MediaItem,
} from "@/components/admin/media-tools";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { cropMedia, deleteMedia, getMediaUsage, updateMedia } from "@/features/media/admin-actions";
import { cn } from "@/lib/utils";

type Upload = { key: string; name: string; status: "waiting" | "uploading" | "done" | "error"; error?: string };
type Usage = { rooms: number; gallery: number; content: string[] };
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";
const CROPPABLE = /^image\/(jpeg|png|webp)$/;

function usageText(u: Usage | null) {
  if (!u) return "Checking where this image is used…";
  const parts = [
    u.rooms ? `${u.rooms} room photo${u.rooms === 1 ? "" : "s"}` : "",
    u.gallery ? `${u.gallery} gallery entr${u.gallery === 1 ? "y" : "ies"}` : "",
    ...u.content,
  ].filter(Boolean);
  if (!parts.length) return "It is not used anywhere on the website. This cannot be undone.";
  return `It is used in: ${parts.join("; ")}. Room photos and gallery entries using it are removed with it, and offers lose their picture. Website sections that use it will show the placeholder until you pick another image. This cannot be undone.`;
}

function MediaDetails({
  item,
  onClose,
  onChange,
  onDeleted,
}: {
  item: MediaItem;
  onClose: () => void;
  onChange: (next: MediaItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const { run, pending } = useRunAction();
  const uid = useId();
  const absolute = typeof window !== "undefined" ? new URL(item.url, window.location.origin).toString() : item.url;

  useEffect(() => {
    let live = true;
    const fd = new FormData();
    fd.set("id", item.id);
    getMediaUsage(fd).then((r) => live && r.ok && setUsage(r.data));
    return () => {
      live = false;
    };
  }, [item.id, item.url]);

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <div className="grid content-start gap-3">
        <div className="bg-surface-3 relative aspect-[4/3] overflow-hidden rounded-xl">
          <Image src={item.url} alt={item.alt || item.filename} fill sizes="(min-width: 768px) 40vw, 90vw" className="object-contain" />
        </div>
        <dl className="text-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt>File</dt>
          <dd className="text-ink truncate">{item.filename}</dd>
          <dt>Size</dt>
          <dd className="text-ink">
            {item.width} × {item.height} px · {formatBytes(item.sizeBytes)} WebP
          </dd>
          <dt>Used in</dt>
          <dd className="text-ink">
            {usage
              ? [
                  usage.rooms ? `${usage.rooms} room photo${usage.rooms === 1 ? "" : "s"}` : "",
                  usage.gallery ? `gallery (${usage.gallery})` : "",
                  ...usage.content,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not used yet"
              : "…"}
          </dd>
        </dl>
        <div className="grid gap-1.5">
          <label htmlFor={`${uid}-url`} className="text-sm font-medium">
            Image address
          </label>
          <div className="flex gap-2">
            <Input id={`${uid}-url`} readOnly value={absolute} className="h-10 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10"
              onClick={() =>
                navigator.clipboard
                  .writeText(absolute)
                  .then(() => toast.success("Address copied."))
                  .catch(() => toast.error("Could not copy. Select the address and copy it manually."))
              }
            >
              <Copy aria-hidden /> Copy
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setCropOpen(true)} disabled={pending}>
            <Crop aria-hidden /> Crop
          </Button>
          <ConfirmButton
            action={async (fd) => {
              const r = await deleteMedia(fd);
              if (r.ok) onDeleted(item.id);
              return r;
            }}
            fields={{ id: item.id }}
            title="Delete this image?"
            body={usageText(usage)}
            confirmLabel="Delete image"
            size="sm"
            variant="ghost"
            className="text-danger"
          >
            Delete
          </ConfirmButton>
        </div>
      </div>

      <ActionForm
        action={updateMedia}
        successMessage="Image details saved."
        refresh={false}
        onSuccess={(d) => onChange({ ...item, ...d })}
        className="grid content-start gap-5"
      >
        <input type="hidden" name="id" value={item.id} />
        <FormField name="alt" label="Alt text (English)" hint="Describe what the photo shows. Used by screen readers and search engines.">
          <Input defaultValue={item.alt} maxLength={200} placeholder="Deluxe room with a double bed and work desk" />
        </FormField>
        <FormField name="altHi" label="Alt text (हिन्दी)" optional hint="Falls back to English when empty.">
          <Input defaultValue={item.altHi} maxLength={200} lang="hi" />
        </FormField>
        <FormField name="folder" label="Folder">
          <NativeSelect defaultValue={item.folder}>
            {Object.entries(FOLDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="flex flex-wrap gap-2">
          <SubmitButton>Save details</SubmitButton>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </ActionForm>

      <CropDialog
        src={cropOpen ? item.url : null}
        open={cropOpen}
        onOpenChange={setCropOpen}
        busy={pending}
        title="Crop image"
        defaultAspect={4 / 3}
        onConfirm={(area) => {
          const fd = new FormData();
          fd.set("id", item.id);
          fd.set("crop", JSON.stringify(area));
          run(
            async (f) => {
              const r = await cropMedia(f);
              if (r.ok) onChange({ ...item, ...r.data });
              return r;
            },
            fd,
            { onDone: () => setCropOpen(false) },
          );
        }}
      />
    </div>
  );
}

export function MediaLibrary({ storage }: { storage: string }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [uploadFolder, setUploadFolder] = useState("general");
  const [cropFirst, setCropFirst] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [pendingCrop, setPendingCrop] = useState<{ file: File; url: string } | null>(null);
  const [cropBusy, setCropBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const load = useCallback(() => {
    setError("");
    setItems(null);
    return fetchMedia(filter, q)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const busy = uploads.some((u) => u.status === "uploading" || u.status === "waiting");

  function addUploaded(added: MediaItem[]) {
    if (!added.length) return;
    setItems((prev) => {
      const visible = added.filter((a) => filter === "all" || a.folder === filter);
      return [...visible, ...(prev ?? [])];
    });
  }

  async function uploadAll(files: File[]) {
    const queue = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, status: "waiting" as const }));
    setUploads((prev) => [...queue, ...prev.filter((p) => p.status !== "done")]);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const key = queue[i]!.key;
      setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, status: "uploading" } : u)));
      const { items: added, errors } = await uploadMedia([files[i]!], { folder: uploadFolder });
      addUploaded(added);
      ok += added.length;
      setUploads((prev) =>
        prev.map((u) =>
          u.key === key
            ? added.length
              ? { ...u, status: "done" }
              : { ...u, status: "error", error: errors[0] ?? "Upload failed." }
            : u,
        ),
      );
    }
    if (ok) toast.success(ok === 1 ? "Image uploaded and compressed." : `${ok} images uploaded and compressed.`);
  }

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith("image/") || /\.(heic|heif|avif)$/i.test(f.name));
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) {
      if (list?.length) toast.error("Only image files can be uploaded.");
      return;
    }
    if (cropFirst && files.length === 1 && CROPPABLE.test(files[0]!.type)) {
      // Crop the same (possibly resized) file that will be uploaded so the crop area lines up exactly.
      const prepared = await prepareUpload(files[0]!);
      setPendingCrop({ file: prepared, url: URL.createObjectURL(prepared) });
      return;
    }
    if (cropFirst && files.length > 1) toast.message("Cropping works one photo at a time, so these were uploaded uncropped.");
    await uploadAll(files);
  }

  return (
    <div className="grid gap-6">
      <section
        aria-labelledby={`${uid}-up`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "card grid gap-5 border-2 border-dashed p-5 shadow-none transition-colors md:p-6",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong",
        )}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="bg-surface-3 text-muted grid size-12 shrink-0 place-items-center rounded-2xl">
            <ImagePlus className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${uid}-up`} className="font-sans text-base font-semibold">
              Upload photos
            </h2>
            <p className="text-muted text-sm">
              Drag photos here or choose files. JPG, PNG, WebP, AVIF or HEIC up to 15 MB. Each photo is resized, stripped of
              location data and saved as WebP. Storage: {storage}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <label htmlFor={`${uid}-folder`} className="text-sm font-medium">
              Save to folder
            </label>
            <NativeSelect id={`${uid}-folder`} value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} className="h-11 min-w-44">
              {Object.entries(FOLDER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cropFirst}
              onChange={(e) => setCropFirst(e.target.checked)}
              className="accent-[var(--color-accent)] size-5"
            />
            Crop before uploading (one photo at a time)
          </label>
          <input ref={fileRef} id={`${uid}-file`} type="file" accept={ACCEPT} multiple={!cropFirst} className="sr-only" onChange={(e) => onFiles(e.target.files)} />
          <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="ml-auto">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {busy ? "Uploading…" : "Choose files"}
          </Button>
        </div>
        {uploads.length ? (
          <ul className="grid gap-1.5 text-sm" aria-live="polite">
            {uploads.slice(0, 20).map((u) => (
              <li key={u.key} className="flex items-start gap-2">
                {u.status === "done" ? (
                  <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
                ) : u.status === "error" ? (
                  <AlertCircle className="text-danger mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <Loader2 className={cn("text-muted mt-0.5 size-4 shrink-0", u.status === "uploading" && "animate-spin")} aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="break-all">{u.name}</span>
                  <span className="text-muted">
                    {" "}
                    –{" "}
                    {u.status === "waiting"
                      ? "waiting"
                      : u.status === "uploading"
                        ? "uploading and compressing…"
                        : u.status === "done"
                          ? "done"
                          : u.error}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card grid gap-5 p-5 shadow-none" aria-label="Library">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input aria-label="Search images" placeholder="Search by file name or alt text" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9 text-sm" />
          </div>
          <NativeSelect aria-label="Filter by folder" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 min-w-40 text-sm">
            <option value="all">All folders</option>
            {Object.entries(FOLDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div aria-busy={items === null} aria-live="polite">
          {error ? (
            <div role="alert" className="grid justify-items-start gap-3">
              <p className="text-danger">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={load}>
                Try again
              </Button>
            </div>
          ) : items === null ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="skeleton aspect-square" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="grid justify-items-center gap-2 py-12 text-center">
              <ImagePlus className="text-muted size-8" aria-hidden />
              <p className="font-heading text-xl">{q || filter !== "all" ? "No images match" : "The library is empty"}</p>
              <p className="text-muted max-w-md text-sm">
                {q || filter !== "all"
                  ? "Try another search or folder."
                  : "Upload real photos of the hotel. They can then be used on rooms, the gallery, offers and website sections."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-muted mb-3 text-sm">
                {items.length === 120 ? "Showing the newest 120 images. Search to find older ones." : `${items.length} image${items.length === 1 ? "" : "s"}`}
              </p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(item)}
                      className="group bg-surface-3 relative block aspect-square w-full overflow-hidden rounded-xl"
                      aria-label={`Open ${item.alt || item.filename}`}
                    >
                      <Image src={item.url} alt="" fill sizes="(min-width: 1280px) 15vw, (min-width: 768px) 24vw, 45vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      {!item.alt ? (
                        <span className="bg-warning text-bg absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-medium">
                          No alt text
                        </span>
                      ) : null}
                    </button>
                    <p className="mt-1 truncate text-xs" title={item.filename}>
                      {item.alt || item.filename}
                    </p>
                    <p className="text-muted text-[0.7rem]">
                      {FOLDER_LABELS[item.folder] ?? item.folder} · {item.width}×{item.height}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto">
          <DialogTitle className="font-heading pr-10 text-xl">Image details</DialogTitle>
          <DialogDescription className="text-muted mt-1 mb-5 text-sm">
            Edit alt text and folder, crop, copy the address or delete.
          </DialogDescription>
          {open ? (
            <MediaDetails
              key={open.id}
              item={open}
              onClose={() => setOpen(null)}
              onChange={(next) => {
                setOpen(next);
                setItems((prev) => prev?.map((i) => (i.id === next.id ? next : i)) ?? prev);
              }}
              onDeleted={(id) => {
                setOpen(null);
                setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <CropDialog
        src={pendingCrop?.url ?? null}
        open={!!pendingCrop}
        busy={cropBusy}
        title="Crop before uploading"
        onOpenChange={(o) => {
          if (!o && pendingCrop) {
            URL.revokeObjectURL(pendingCrop.url);
            setPendingCrop(null);
          }
        }}
        onConfirm={async (area) => {
          if (!pendingCrop) return;
          setCropBusy(true);
          const { items: added, errors } = await uploadMedia([pendingCrop.file], { folder: uploadFolder, crop: area });
          setCropBusy(false);
          errors.forEach((e) => toast.error(e));
          if (added.length) {
            addUploaded(added);
            toast.success("Image cropped and uploaded.");
            URL.revokeObjectURL(pendingCrop.url);
            setPendingCrop(null);
          }
        }}
      />
    </div>
  );
}
