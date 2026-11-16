"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { ArrowDown, ArrowUp, Crop, GripVertical, ImagePlus, Loader2 } from "lucide-react";
import { ConfirmButton, useRunAction } from "@/components/admin/forms";
import { CropDialog } from "@/components/admin/media-tools";
import { MediaLibraryDialog } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addRoomPhotos,
  cropRoomPhoto,
  removeRoomPhoto,
  reorderRoomPhotos,
  updateRoomPhotoAlt,
} from "@/features/rooms/admin-actions";
import { cn } from "@/lib/utils";

export type PhotoRow = { id: string; url: string; alt: string; mediaId: string | null };

function AltEditor({ photo, disabled }: { photo: PhotoRow; disabled?: boolean }) {
  const uid = useId();
  const [value, setValue] = useState(photo.alt);
  const { run, pending } = useRunAction();
  const dirty = value.trim() !== photo.alt;
  return (
    <form
      className="grid gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("id", photo.id);
        fd.set("alt", value);
        run(updateRoomPhotoAlt, fd);
      }}
    >
      <label htmlFor={uid} className="text-muted text-xs font-medium">
        Alt text (describes the photo for screen readers and Google)
      </label>
      <div className="flex gap-2">
        <Input
          id={uid}
          value={value}
          maxLength={200}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Deluxe room with double bed and work desk"
          className="h-10 text-sm"
        />
        <Button type="submit" size="sm" variant="outline" className="h-10" disabled={!dirty || pending || disabled}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}

export function PhotosManager({
  roomTypeId,
  roomName,
  slug,
  photos,
  slotPhotos,
  canWrite,
  canCrop,
}: {
  roomTypeId: string;
  roomName: string;
  slug: string;
  photos: PhotoRow[];
  slotPhotos: { url: string; alt: string }[];
  canWrite: boolean;
  canCrop: boolean;
}) {
  const [order, setOrder] = useState(photos);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [cropping, setCropping] = useState<PhotoRow | null>(null);
  const [status, setStatus] = useState("");
  const { run, pending } = useRunAction();

  // Server data changed (after add/remove/crop): take it as the new truth.
  const signature = photos.map((p) => `${p.id}:${p.url}:${p.alt}`).join("|");
  useEffect(() => setOrder(photos), [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveOrder(next: PhotoRow[], message: string) {
    setOrder(next);
    setStatus(message);
    const fd = new FormData();
    fd.set("roomTypeId", roomTypeId);
    fd.set("ids", JSON.stringify(next.map((p) => p.id)));
    run(reorderRoomPhotos, fd);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    saveOrder(next, `Photo moved to position ${to + 1} of ${next.length}.`);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted max-w-prose text-sm">
          The first photo is the cover on room cards. Drag photos to reorder them, or use the arrow buttons.
        </p>
        {canWrite ? (
          <Button type="button" onClick={() => setLibraryOpen(true)} disabled={pending}>
            <ImagePlus aria-hidden /> Add photos
          </Button>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      {order.length === 0 ? (
        <div className="bg-surface-2 grid gap-3 rounded-xl p-5 text-sm">
          {slotPhotos.length ? (
            <>
              <p>
                No photos are attached here, so the website uses {slotPhotos.length} photo
                {slotPhotos.length === 1 ? "" : "s"} from <code className="font-mono">/public/images/hotel/rooms/{slug}/</code>.
                Photos you add here take priority.
              </p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {slotPhotos.map((s) => (
                  <li key={s.url} className="bg-surface-3 relative aspect-[4/3] overflow-hidden rounded-lg">
                    <Image src={s.url} alt={s.alt} fill sizes="160px" className="object-cover" />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              No photos yet. Add photos from the media library, or drop files into{" "}
              <code className="font-mono">/public/images/hotel/rooms/{slug}/</code> (01.jpg, 02.jpg …). Until then the
              website shows the arch placeholder for {roomName}.
            </p>
          )}
        </div>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {order.map((p, i) => (
            <li
              key={p.id}
              draggable={canWrite && !pending}
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", p.id);
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "border-line bg-bg grid content-start gap-3 rounded-xl border p-3 transition",
                dragIndex === i && "opacity-50",
                dragIndex !== null && dragIndex !== i && "border-dashed border-accent",
              )}
            >
              <div className="bg-surface-3 relative aspect-[4/3] overflow-hidden rounded-lg">
                <Image src={p.url} alt={p.alt || roomName} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw" className="object-cover" />
                <span className="theme-dark bg-bg/85 absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums">
                  {i === 0 ? "Cover" : `#${i + 1}`}
                </span>
                {canWrite ? (
                  <span className="theme-dark bg-bg/85 absolute top-2 right-2 grid size-8 cursor-grab place-items-center rounded-full" aria-hidden>
                    <GripVertical className="size-4" />
                  </span>
                ) : null}
              </div>
              <AltEditor photo={p} disabled={!canWrite} />
              {canWrite ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    disabled={i === 0 || pending}
                    onClick={() => move(i, i - 1)}
                    aria-label={`Move photo ${i + 1} earlier`}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    disabled={i === order.length - 1 || pending}
                    onClick={() => move(i, i + 1)}
                    aria-label={`Move photo ${i + 1} later`}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  {canCrop && p.mediaId ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setCropping(p)}>
                      <Crop aria-hidden /> Crop
                    </Button>
                  ) : null}
                  <ConfirmButton
                    action={removeRoomPhoto}
                    fields={{ id: p.id }}
                    title="Remove this photo from the room?"
                    body="It stays in the media library, so you can add it back later."
                    confirmLabel="Remove photo"
                    size="sm"
                    variant="ghost"
                    className="text-danger ml-auto"
                  >
                    Remove
                  </ConfirmButton>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <MediaLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        folder="rooms"
        multiple
        title={`Add photos to ${roomName}`}
        onPick={(items) => {
          if (!items.length) return;
          const fd = new FormData();
          fd.set("roomTypeId", roomTypeId);
          fd.set("mediaIds", JSON.stringify(items.map((i) => i.id)));
          run(addRoomPhotos, fd);
        }}
      />
      <CropDialog
        src={cropping?.url ?? null}
        open={!!cropping}
        onOpenChange={(open) => !open && setCropping(null)}
        busy={pending}
        title="Crop photo"
        defaultAspect={4 / 3}
        onConfirm={(area) => {
          if (!cropping) return;
          const fd = new FormData();
          fd.set("id", cropping.id);
          fd.set("crop", JSON.stringify(area));
          run(cropRoomPhoto, fd, { onDone: () => setCropping(null) });
        }}
      />
    </div>
  );
}
