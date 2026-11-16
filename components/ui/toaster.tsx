"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-line !bg-bg !text-ink !shadow-lift !font-sans",
          description: "!text-muted",
          actionButton: "!bg-accent !text-on-accent",
        },
      }}
    />
  );
}
