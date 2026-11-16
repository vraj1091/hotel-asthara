import { cn } from "@/lib/utils";

/**
 * Gentle one-time reveal as an element scrolls into view, done in CSS (animation-timeline: view()).
 * Browsers without support, and visitors who prefer reduced motion, simply see the content: nothing is ever hidden
 * waiting for JavaScript. Used on section headings and bento groups only, not on every card.
 */
export function Reveal({
  children,
  className,
  as: Comp = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "ul";
}) {
  return <Comp className={cn("reveal", className)}>{children}</Comp>;
}
