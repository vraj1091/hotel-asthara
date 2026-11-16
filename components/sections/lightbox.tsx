"use client";

import Image from "next/image";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export type LightboxImage = { url: string; alt: string };

/** Full-screen photo viewer: arrow keys, on-screen buttons and swipe move between photos; Escape closes. */
export function Lightbox({
  images,
  index,
  onChange,
}: {
  images: LightboxImage[];
  index: number | null;
  onChange: (next: number | null) => void;
}) {
  const touchX = useRef<number | null>(null);
  const current = index === null ? null : images[index];
  const many = images.length > 1;
  const go = (delta: number) =>
    index !== null && onChange((index + delta + images.length) % images.length);

  return (
    <DialogPrimitive.Root open={index !== null} onOpenChange={(open) => !open && onChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--color-navy)_94%,transparent)] backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
          onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const start = touchX.current;
            const end = e.changedTouches[0]?.clientX;
            if (start !== null && end !== undefined && Math.abs(end - start) > 40)
              go(end < start ? 1 : -1);
            touchX.current = null;
          }}
          className="theme-dark fixed inset-0 z-50 flex flex-col bg-transparent outline-none"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="text-muted text-sm tabular-nums" aria-live="polite">
              {index !== null && many ? `${index + 1} / ${images.length}` : ""}
            </p>
            <DialogPrimitive.Close
              aria-label="Close photo viewer"
              className="text-ink hover:bg-surface-3 grid size-11 place-items-center rounded-full"
            >
              <X className="size-6" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Title className="sr-only">{current?.alt || "Photo"}</DialogPrimitive.Title>
          <div className="relative min-h-0 flex-1 px-2 sm:px-16">
            {current ? (
              <Image
                key={current.url}
                src={current.url}
                alt={current.alt}
                fill
                sizes="100vw"
                className="animate-[glow-in_0.4s_ease-out] object-contain"
                priority
              />
            ) : null}
            {many ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="bg-bg/70 text-ink hover:bg-bg absolute top-1/2 left-2 grid size-12 -translate-y-1/2 place-items-center rounded-full backdrop-blur sm:left-4"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="bg-bg/70 text-ink hover:bg-bg absolute top-1/2 right-2 grid size-12 -translate-y-1/2 place-items-center rounded-full backdrop-blur sm:right-4"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            ) : null}
          </div>
          <p className="text-muted min-h-12 px-6 py-3 text-center text-sm">{current?.alt}</p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
