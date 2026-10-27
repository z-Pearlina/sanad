import { GROUP_COLOR } from "@/lib/labels";
import type { Group } from "@/lib/types";

/**
 * The dara (circle) scribes drew between hadiths: dotted once the narrator's
 * entry is known, left empty (ghufl) when the name could not be identified.
 */
export default function Dara({ group, size = 22 }: { group: Group | null; size?: number }) {
  const known = group !== null;
  const color = known ? GROUP_COLOR[group] : "var(--midad-soft)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="9.5" fill="var(--raqq)" stroke={color} strokeWidth={known ? 2.5 : 1.5} />
      {known && <circle cx="12" cy="12" r="3.2" fill={color} />}
    </svg>
  );
}
