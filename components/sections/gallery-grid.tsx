"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Lightbox } from "@/components/sections/lightbox";
import { cn } from "@/lib/utils";

type Item = { id: string; url: string; alt: string; category: string };

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Filterable photo grid (categories from Admin → Website → Gallery) with a full-screen lightbox. */
export function GalleryGrid({
  items,
  allLabel,
  labels = {},
  order = [],
}: {
  items: Item[];
  allLabel: string;
  labels?: Record<string, string>;
  order?: string[];
}) {
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const categories = useMemo(() => {
    const present = [...new Set(items.map((i) => i.category))];
    return present.sort(
      (a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999),
    );
  }, [items, order]);
  const shown = category === "all" ? items : items.filter((i) => i.category === category);
  const label = (c: string) => labels[c] || titleCase(c);

  return (
    <div className="grid gap-8">
      {categories.length > 1 ? (
        <div role="group" aria-label="Filter photos" className="flex flex-wrap gap-2">
          {["all", ...categories].map((c) => {
            const count = c === "all" ? items.length : items.filter((i) => i.category === c).length;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "h-10 rounded-full border px-5 text-sm transition-colors",
                  category === c
                    ? "border-accent bg-accent text-on-accent"
                    : "border-line-strong hover:bg-surface-2",
                )}
              >
                {c === "all" ? allLabel : label(c)}
                <span className="ml-1.5 opacity-70 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      <ul className="columns-2 gap-3 md:columns-3 md:gap-4 [&>li]:mb-3 md:[&>li]:mb-4">
        {shown.map((img, i) => (
          <li key={img.id} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open photo: ${img.alt}`}
              className="group bg-surface-3 relative block w-full overflow-hidden rounded-2xl"
            >
              <Image
                src={img.url}
                alt={img.alt}
                width={800}
                height={i % 3 === 0 ? 1000 : 640}
                sizes="(min-width: 768px) 33vw, 50vw"
                loading="lazy"
                className={cn(
                  "w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]",
                  i % 3 === 0 ? "aspect-[4/5]" : "aspect-[5/4]",
                )}
              />
              <span className="theme-dark bg-bg/70 text-ink pointer-events-none absolute bottom-2 left-2 rounded-full px-2.5 py-0.5 text-xs opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {label(img.category)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Lightbox
        images={shown.map((i) => ({ url: i.url, alt: i.alt }))}
        index={open}
        onChange={setOpen}
      />
    </div>
  );
}
