"use client";

import { useEffect, useId, useRef, useState } from "react";

export type BarDatum = { key: string; label: string; full: string; value: number };

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compactInr = (paise: number) => {
  const r = paise / 100;
  if (Math.abs(r) >= 100_000) return `₹${(r / 100_000).toFixed(r % 100_000 === 0 ? 0 : 1)}L`;
  if (Math.abs(r) >= 1000) return `₹${(r / 1000).toFixed(r % 1000 === 0 ? 0 : 1)}K`;
  return `₹${Math.round(r)}`;
};

function formatValue(v: number, kind: "inr" | "percent") {
  return kind === "inr" ? inr.format(v / 100) : `${v}%`;
}

/** Round the axis maximum up to a clean step so ticks read 0 / 2,000 / 4,000 … */
function niceMax(max: number, kind: "inr" | "percent") {
  if (kind === "percent") return 100;
  if (max <= 0) return 100_000; // ₹1,000 when there is nothing yet
  const rupees = max / 100;
  const pow = 10 ** Math.floor(Math.log10(rupees));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 4 >= rupees) ?? pow * 10;
  return Math.ceil(rupees / step) * step * 100;
}

/**
 * Single-series column chart drawn in SVG at the container's real width, so text stays legible from 360px up.
 * Spec: bars ≤ 24px with a 4px rounded top and square base, hairline solid grid, hover/focus tooltip, the
 * extreme value labelled, and a visible table view (the gold mark is below 3:1 against the card).
 */
export function BarChart({
  title,
  description,
  data,
  kind,
  height = 220,
}: {
  title: string;
  description: string;
  data: BarDatum[];
  kind: "inr" | "percent";
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxValue = Math.max(0, ...data.map((d) => d.value));
  const yMax = niceMax(maxValue, kind);
  const left = kind === "inr" ? 52 : 40;
  const right = 8;
  const top = 18;
  const bottom = 26;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(24, band - 2)); // ≥ 2px surface gap between bars
  const y = (v: number) => top + plotH - (Math.max(0, v) / yMax) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(plotW / 56)));
  const maxIndex = maxValue > 0 ? data.findIndex((d) => d.value === maxValue) : -1;

  const barPath = (x: number, v: number) => {
    const h = Math.max(0, top + plotH - y(v));
    if (h <= 0) return "";
    const r = Math.min(4, h, barW / 2);
    const b = top + plotH;
    return `M${x},${b} V${b - h + r} Q${x},${b - h} ${x + r},${b - h} H${x + barW - r} Q${x + barW},${b - h} ${x + barW},${b - h + r} V${b} Z`;
  };

  const active = hover !== null ? data[hover] : null;

  return (
    <figure className="grid gap-3" aria-labelledby={`${uid}-t`}>
      <figcaption>
        <p id={`${uid}-t`} className="font-sans text-base font-semibold">
          {title}
        </p>
        <p className="text-muted text-sm">{description}</p>
      </figcaption>
      <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={`${uid}-t`}
          aria-describedby={`${uid}-d`}
          className="block max-w-full overflow-visible"
        >
          <desc id={`${uid}-d`}>{description}. The full figures are in the table below the chart.</desc>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-muted)" className="tabular-nums">
                {kind === "inr" ? compactInr(t) : `${Math.round(t)}%`}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = left + i * band + (band - barW) / 2;
            return (
              <g key={d.key}>
                {hover === i ? (
                  <rect x={left + i * band} y={top} width={band} height={plotH} fill="var(--color-surface-3)" opacity={0.7} />
                ) : null}
                <path d={barPath(x, d.value)} fill="var(--color-accent)" />
                {(data.length - 1 - i) % labelEvery === 0 && (
                  <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
                    {d.label}
                  </text>
                )}
                {i === maxIndex ? (
                  <text x={x + barW / 2} y={y(d.value) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-ink)" className="tabular-nums">
                    {kind === "inr" ? compactInr(d.value) : `${d.value}%`}
                  </text>
                ) : null}
                {/* Hit target: the whole band, taller than the mark */}
                <rect
                  x={left + i * band}
                  y={top}
                  width={band}
                  height={plotH + bottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onTouchStart={() => setHover(i)}
                >
                  <title>{`${d.full}: ${formatValue(d.value, kind)}`}</title>
                </rect>
              </g>
            );
          })}
          <line x1={left} x2={width - right} y1={top + plotH} y2={top + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />
        </svg>
        {active && hover !== null ? (
          <div
            role="status"
            className="bg-bg border-line shadow-soft pointer-events-none absolute z-10 rounded-lg border px-3 py-2 text-sm whitespace-nowrap"
            style={{
              left: Math.min(Math.max(left + hover * band + band / 2, 70), width - 70),
              top: Math.max(0, y(active.value) - 54),
              transform: "translateX(-50%)",
            }}
          >
            <span className="text-muted block text-xs">{active.full}</span>
            <span className="font-semibold tabular-nums">{formatValue(active.value, kind)}</span>
          </div>
        ) : null}
      </div>
      <details className="text-sm">
        <summary className="text-muted hover:text-ink w-fit cursor-pointer">Show data as a table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1 font-medium">Day</th>
                <th scope="col" className="py-1 text-right font-medium">{kind === "inr" ? "Received" : "Occupancy"}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-line border-t">
                  <td className="py-1">{d.full}</td>
                  <td className="py-1 text-right tabular-nums">{formatValue(d.value, kind)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
