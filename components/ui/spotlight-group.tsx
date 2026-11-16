"use client";

import { useRef } from "react";

/** Children with the `spot` class get a gold edge that follows the pointer (see .spot in globals.css). */
export function SpotlightGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const { clientX, clientY } = e;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          ref.current?.querySelectorAll<HTMLElement>(".spot").forEach((card) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${clientX - r.left}px`);
            card.style.setProperty("--my", `${clientY - r.top}px`);
          });
        });
      }}
    >
      {children}
    </div>
  );
}
