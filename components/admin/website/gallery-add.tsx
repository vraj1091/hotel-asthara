"use client";

import { useId, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { useRunAction } from "@/components/admin/forms";
import { MediaLibraryDialog } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { addGalleryImages } from "@/features/cms/admin-gallery";

/** Choose a category, then pick one or more photos from the media library (or upload new ones). */
export function GalleryAdd({ categories }: { categories: { key: string; label: string }[] }) {
  const [category, setCategory] = useState(categories[0]?.key ?? "");
  const [open, setOpen] = useState(false);
  const { run, pending } = useRunAction();
  const uid = useId();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <label htmlFor={`${uid}-cat`} className="text-sm font-medium">
          Add to category
        </label>
        <select
          id={`${uid}-cat`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border-line-strong bg-bg h-11 min-w-48 rounded-xl border px-3 text-base"
        >
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="button" disabled={!category || pending} onClick={() => setOpen(true)}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
        {pending ? "Adding…" : "Add photos"}
      </Button>
      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        folder="gallery"
        multiple
        title="Add photos to the gallery"
        onPick={(items) => {
          if (!items.length) return;
          const fd = new FormData();
          fd.set("mediaIds", JSON.stringify(items.map((i) => i.id)));
          fd.set("category", category);
          run(addGalleryImages, fd);
        }}
      />
    </div>
  );
}
