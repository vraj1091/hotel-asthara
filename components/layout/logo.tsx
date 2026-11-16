import Link from "next/link";
import { cn } from "@/lib/utils";

/** Arched-window mark + wordmark. The arch repeats the hero motif. */
export function Logo({ name, className }: { name: string; className?: string }) {
  const short = name.replace(/^Hotel\s+/i, "");
  return (
    <Link
      href="/"
      aria-label={`${name}, home`}
      className={cn("group inline-flex items-center gap-3", className)}
    >
      <svg viewBox="0 0 28 34" className="text-accent h-8 w-auto" fill="none" aria-hidden>
        <path
          d="M2 33V13C2 6.4 7.4 1 14 1s12 5.4 12 12v20"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M8 33V14c0-3.9 2.7-7 6-7s6 3.1 6 7v19"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.6"
        />
      </svg>
      <span className="leading-none">
        <span className="text-muted block text-[0.7rem] tracking-wide">Hotel</span>
        <span className="font-heading text-ink text-2xl font-medium">{short}</span>
      </span>
    </Link>
  );
}
