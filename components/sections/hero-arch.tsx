import { Photo } from "@/components/ui/photo";
import { PointerParallax } from "@/components/ui/pointer-parallax";
import type { Daypart } from "@/lib/tonight";
import { cn } from "@/lib/utils";

const STARS: [number, number, number][] = [
  [132, 196, 1.4],
  [168, 132, 1.1],
  [236, 112, 1.5],
  [272, 176, 1.1],
  [150, 262, 1.2],
  [252, 248, 1.4],
  [214, 204, 1],
];

// Where the light sits in the window and how strong it is, by time of day in Rohtak.
const LIGHT: Record<Daypart, { cy: string; inner: number; gold: boolean }> = {
  dawn: { cy: "88%", inner: 0.3, gold: true },
  day: { cy: "30%", inner: 0.2, gold: false },
  dusk: { cy: "84%", inner: 0.36, gold: true },
  night: { cy: "50%", inner: 0.36, gold: true },
};

/**
 * The hero's one memorable element: an arched window in three gold hairlines that trace themselves once on load,
 * then lean a few pixels towards the pointer. The glass is lit for the real time of day in Rohtak: a lamp and stars
 * at night, low gold light at dawn and dusk, pale daylight in the day. An uploaded hero photo replaces the glass.
 */
export function HeroArch({
  imageUrl,
  alt,
  daypart,
  className,
}: {
  imageUrl?: string;
  alt: string;
  daypart: Daypart;
  className?: string;
}) {
  const light = LIGHT[daypart];
  return (
    <PointerParallax className={cn("hero-drift relative aspect-[400/560] w-full", className)}>
      {imageUrl ? (
        <div className="plx-1 absolute inset-x-[17%] top-[12.5%] bottom-0 overflow-hidden rounded-t-full">
          <Photo
            src={imageUrl}
            alt={alt}
            priority
            sizes="(min-width: 1024px) 30vw, 70vw"
            className="size-full"
          />
        </div>
      ) : null}
      <svg
        viewBox="0 0 400 560"
        fill="none"
        className="text-accent absolute inset-0 size-full overflow-visible"
        aria-hidden
      >
        <defs>
          <radialGradient id="arch-glow" cx="50%" cy={light.cy} r="62%">
            <stop
              offset="0%"
              stopColor={light.gold ? "currentColor" : "var(--color-ink)"}
              stopOpacity={light.inner}
            />
            <stop
              offset="55%"
              stopColor={light.gold ? "currentColor" : "var(--color-ink)"}
              stopOpacity={light.inner / 3.4}
            />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        {imageUrl ? null : (
          <g className="plx-1">
            <path
              className="glow-in"
              style={{ ["--delay" as string]: "1.1s" }}
              d="M68 560V202A132 132 0 0 1 332 202V560Z"
              fill="url(#arch-glow)"
            />
            {daypart === "night"
              ? STARS.map(([cx, cy, r], i) => (
                  <circle
                    key={i}
                    className="glow-in"
                    style={{ ["--delay" as string]: `${1.5 + i * 0.12}s` }}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="var(--color-ink)"
                    opacity="0.6"
                  />
                ))
              : null}
          </g>
        )}
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <g className="plx-3">
            <path
              className="arch-stroke"
              style={{ ["--len" as string]: 1500 }}
              d="M16 560V202A184 184 0 0 1 384 202V560"
            />
          </g>
          <g className="plx-2">
            <path
              className="arch-stroke"
              style={{ ["--len" as string]: 1300, ["--delay" as string]: "0.25s" }}
              d="M42 560V202A158 158 0 0 1 358 202V560"
              opacity="0.7"
            />
          </g>
          <g className="plx-1">
            <path
              className="arch-stroke"
              style={{ ["--len" as string]: 1100, ["--delay" as string]: "0.5s" }}
              d="M68 560V202A132 132 0 0 1 332 202V560"
              opacity="0.45"
            />
            {imageUrl ? null : (
              <>
                <path
                  className="arch-stroke"
                  style={{ ["--len" as string]: 520, ["--delay" as string]: "1.2s" }}
                  d="M200 70V560"
                  opacity="0.3"
                />
                <path
                  className="arch-stroke"
                  style={{ ["--len" as string]: 300, ["--delay" as string]: "1.4s" }}
                  d="M68 330H332"
                  opacity="0.3"
                />
              </>
            )}
          </g>
        </g>
      </svg>
    </PointerParallax>
  );
}
