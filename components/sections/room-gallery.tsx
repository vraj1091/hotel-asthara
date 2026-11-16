"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Photo } from "@/components/ui/photo";
import { Lightbox } from "@/components/sections/lightbox";
import { cn } from "@/lib/utils";

type Img = { id: string; url: string; alt: string };

/**
 * Room photo carousel: swipe or scroll-snap on touch, arrow buttons and arrow keys on desktop, thumbnails below,
 * and any photo opens the full-screen lightbox. Shows the arch placeholder until photos are added.
 */
export function RoomGallery({ images, name }: { images: Img[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const next = (i + images.length) % images.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, [images.length]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  if (images.length === 0) return <Photo alt={name} className="aspect-[16/10] rounded-2xl" />;
  const many = images.length > 1;

  return (
    <div className="grid gap-3" role="region" aria-roledescription="carousel" aria-label={`${name} photos`}>
      <div className="group relative">
        <div
          ref={track}
          tabIndex={0}
          aria-label={`Photo ${index + 1} of ${images.length}. Use the arrow keys to move.`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              goTo(index + 1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              goTo(index - 1);
            }
            if (e.key === "Enter") setOpen(index);
          }}
          className="flex aspect-[16/10] snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              tabIndex={-1}
              onClick={() => setOpen(i)}
              aria-label={`Open photo ${i + 1} full screen`}
              className="bg-surface-3 relative h-full w-full shrink-0 snap-center"
            >
              <Image
                src={img.url}
                alt={img.alt || name}
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : "lazy"}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
        {many ? (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous photo"
              className="bg-bg/85 text-ink hover:bg-bg absolute top-1/2 left-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full shadow-soft backdrop-blur transition-opacity md:grid md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next photo"
              className="bg-bg/85 text-ink hover:bg-bg absolute top-1/2 right-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full shadow-soft backdrop-blur transition-opacity md:grid md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
        <div className="theme-dark bg-bg/75 pointer-events-none absolute right-3 bottom-3 flex items-center gap-2 rounded-full px-3 py-1 text-xs tabular-nums backdrop-blur">
          <Expand className="size-3.5" aria-hidden />
          {index + 1} / {images.length}
        </div>
      </div>
      {many ? (
        <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="Choose a photo">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block h-16 w-24 overflow-hidden rounded-lg ring-offset-2 transition md:h-20 md:w-28",
                  i === index ? "ring-accent ring-2" : "opacity-70 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill sizes="112px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Lightbox
        images={images.map((i) => ({ url: i.url, alt: i.alt || name }))}
        index={open}
        onChange={setOpen}
      />
    </div>
  );
}
