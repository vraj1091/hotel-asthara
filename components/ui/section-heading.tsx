import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

export function SectionHeading({
  title,
  intro,
  align = "left",
  className,
  as: Tag = "h2",
  id,
}: {
  title: string;
  intro?: string;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2";
  id?: string;
}) {
  return (
    <Reveal className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <Tag id={id} className="text-h2 text-ink">
        {title}
      </Tag>
      {intro ? <p className="text-muted mt-3 max-w-[60ch] text-lg">{intro}</p> : null}
      <hr className={cn("hairline-solid mt-6 w-16", align === "center" && "mx-auto")} />
    </Reveal>
  );
}
