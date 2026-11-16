// A client module on purpose: when a Server Component passes <NativeSelect> into <FormField>, it must arrive as
// the component itself (so the injected name/id/aria props reach the <select>), not as its rendered wrapper <div>.
"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-line-strong bg-bg px-4 text-base text-ink placeholder:text-muted/70 transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type = "text", ...props }, ref) {
  // text-base (16px) stops iOS Safari zooming into the field
  return <input ref={ref} type={type} className={cn(control, "h-12", className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-32 py-3", className)} {...props} />;
});

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-12 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="text-muted pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
});
