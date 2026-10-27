"use client";

import { useState } from "react";
import MapBase, { MapLabel, cropView, placeLabels } from "./MapBase";
import type { City, MapData, Narrator } from "@/lib/types";

type Side = "teachers" | "students";
const SIDES: { key: Side; label: string }[] = [
  { key: "teachers", label: "بلدان شيوخه" },
  { key: "students", label: "بلدان تلاميذه" },
];

/** Where a narrator's teachers (or students) in al-Bukhari's chains lived, joined to his own home. */
export default function NetworkMap({ narrator, map, cities }: { narrator: Narrator; map: MapData; cities: Record<string, City> }) {
  const [side, setSide] = useState<Side>(narrator.teachers.length ? "teachers" : "students");
  const people = narrator[side];

  // people per city
  const byCity = new Map<string, number>();
  for (const p of people) if (p.city && map.cities[p.city]) byCity.set(p.city, (byCity.get(p.city) ?? 0) + 1);
  const ranked = [...byCity.entries()].sort((a, b) => b[1] - a[1]);
  const unplaced = people.filter((p) => !p.city).length;
  const home = narrator.city && map.cities[narrator.city] ? narrator.city : null;

  const pts = [...ranked.map(([k]) => map.cities[k]), ...(home ? [map.cities[home]] : [])];
  const view = cropView(map, pts, 80, 420);
  const unit = (view?.[2] ?? map.w) / 100;
  const max = Math.max(1, ...byCity.values());
  const r = (n: number) => unit * (1.2 + 3.2 * Math.sqrt(n / max));

  return (
    <figure>
      <div role="tablist" aria-label="خريطة الشيوخ والتلاميذ" className="mb-3 flex gap-1 border-b border-khatt">
        {SIDES.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={side === key}
            onClick={() => setSide(key)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${side === key ? "border-nila text-nila" : "border-transparent text-midad-soft"}`}
          >
            {label} ({narrator[key].length})
          </button>
        ))}
      </div>
      {ranked.length === 0 ? (
        <p className="text-sm text-midad-soft">لا بلد معروفاً لأحد منهم.</p>
      ) : (
        <div className="overflow-hidden rounded-sm border border-khatt">
          <MapBase map={map} view={view} label={`${SIDES.find((s) => s.key === side)?.label}: ${ranked.map(([k, n]) => `${cities[k]?.ar} ${n}`).join("، ")}`}>
            {home &&
              ranked
                .filter(([k]) => k !== home)
                .map(([k]) => (
                  <line
                    key={k}
                    x1={map.cities[home][0]}
                    y1={map.cities[home][1]}
                    x2={map.cities[k][0]}
                    y2={map.cities[k][1]}
                    stroke="var(--nila)"
                    strokeOpacity={0.45}
                    strokeWidth={unit * 0.35}
                  />
                ))}
            {ranked.map(([k, n]) => (
              <circle
                key={k}
                cx={map.cities[k][0]}
                cy={map.cities[k][1]}
                r={r(n)}
                fill="var(--nila)"
                fillOpacity={0.3}
                stroke="var(--nila)"
                strokeWidth={unit * 0.3}
              />
            ))}
            {home && (
              <circle cx={map.cities[home][0]} cy={map.cities[home][1]} r={unit * 1.1} fill="var(--midad)" stroke="var(--raqq)" strokeWidth={unit * 0.35} />
            )}
            {placeLabels(
              [
                ...(home ? [{ k: home, x: map.cities[home][0], y: map.cities[home][1] - unit * 2.4 }] : []),
                ...ranked.filter(([k]) => k !== home).map(([k, n]) => ({ k, x: map.cities[k][0], y: map.cities[k][1] - r(n) - unit })),
              ],
              unit * 9,
            ).map(({ k, x, y }) => (
              <MapLabel key={k} x={x} y={y} size={unit * 4}>
                {cities[k]?.ar}
              </MapLabel>
            ))}
          </MapBase>
        </div>
      )}
      <figcaption className="mt-2 space-y-1 text-sm">
        <p>
          {ranked.map(([k, n], i) => (
            <span key={k}>
              {i > 0 && " · "}
              <span className="naskh text-base">{cities[k]?.ar}</span> <span className="tabular-nums text-midad-soft">{n}</span>
            </span>
          ))}
        </p>
        <p className="text-xs text-midad-soft">
          عدد الرجال في كل بلد حسب نسبهم في تقريب التهذيب
          {home ? `، والنقطة الداكنة بلده (${cities[home]?.ar})` : "، ولا بلد معروفاً له هو"}.
          {unplaced > 0 && ` ${unplaced} منهم بلا بلد معروف.`}
        </p>
      </figcaption>
    </figure>
  );
}
