import type { MapData } from "@/lib/types";

/**
 * The drawn base map: sand land on a sea ground, no modern borders.
 * `view` crops it ([x, y, w, h] in map units); children draw on top in the same units.
 */
export default function MapBase({
  map,
  view,
  label,
  children,
}: {
  map: MapData;
  view?: [number, number, number, number];
  label: string;
  children?: React.ReactNode;
}) {
  const [x, y, w, h] = view ?? [0, 0, map.w, map.h];
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label={label} className="block h-auto w-full">
      <rect x={x} y={y} width={w} height={h} fill="var(--bahr)" />
      <path d={map.land} fill="var(--raml)" stroke="var(--khatt)" strokeWidth={w / 900} strokeLinejoin="round" />
      {children}
    </svg>
  );
}

/** Text drawn on the map in Amiri, with a parchment halo so it stays legible over land and sea. */
export function MapLabel({
  x,
  y,
  size,
  className = "",
  children,
}: {
  x: number;
  y: number;
  size: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      textAnchor="middle"
      className={`font-naskh ${className}`}
      fill="var(--midad)"
      stroke="var(--raqq)"
      strokeWidth={size / 4}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {children}
    </text>
  );
}

/**
 * Which labels to draw so none sits on another: items are taken in the order
 * given (most important first) and skipped when closer than `minDist` to one kept.
 */
export function placeLabels<T extends { x: number; y: number }>(items: T[], minDist: number): T[] {
  const kept: T[] = [];
  for (const it of items) {
    if (kept.every((k) => Math.hypot(k.x - it.x, (k.y - it.y) * 1.6) >= minDist)) kept.push(it);
  }
  return kept;
}
