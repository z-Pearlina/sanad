"use client";

import { useEffect, useState } from "react";
import MapBase, { MapLabel, placeLabels } from "./MapBase";
import { ERA_TEXT, tabaqaName } from "@/lib/labels";
import type { City, MapData, Tabaqa } from "@/lib/types";

const STEP_MS = 1600;
const MAX_R = 42; // radius of the largest city of any tabaqa, in map units
const LABELS = 6; // cities named on the map; all are listed under it

/** Where the narrators of each tabaqa lived, from their nisba in the Taqrib. */
export default function SpreadMap({ map, cities, spread }: { map: MapData; cities: Record<string, City>; spread: Tabaqa[] }) {
  const [t, setT] = useState(1);
  const [playing, setPlaying] = useState(false);

  // While playing, step to the next tabaqa; stop after the last one.
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (t >= spread.length) setPlaying(false);
      else setT(t + 1);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, t, spread.length]);

  const play = () => {
    if (t >= spread.length) setT(1);
    setPlaying((p) => !p);
  };

  // One scale for all tabaqat, so circles compare across generations.
  const maxCount = Math.max(...spread.flatMap((s) => Object.values(s.cities)));
  const radius = (n: number) => (n ? Math.max(3, Math.sqrt(n / maxCount) * MAX_R) : 0);
  const cur = spread[t - 1];
  const ranked = Object.entries(cur.cities).sort((a, b) => b[1] - a[1]);
  const labels = placeLabels(
    ranked
      .filter(([k]) => map.cities[k])
      .slice(0, LABELS)
      .map(([k, n]) => ({ k, n, x: map.cities[k][0], y: map.cities[k][1] - radius(n) - 8 })),
    95,
  );

  return (
    <figure>
      <figcaption className="mb-3 text-sm text-midad-soft">
        رجال الكتب الستة كما في تقريب التهذيب، ممن تدل نسبتهم على بلد
      </figcaption>
      <div className="overflow-hidden rounded-sm border border-khatt">
        <MapBase map={map} label={`خريطة رواة ${tabaqaName(t)} حسب بلدانهم`}>
          {Object.entries(map.cities).map(([key, [x, y]]) => {
            const n = cur.cities[key] ?? 0;
            const region = cities[key]?.kind === "region";
            return (
              <circle
                key={key}
                cx={x}
                cy={y}
                style={{ r: radius(n), transition: "r 700ms ease" }}
                fill="var(--nila)"
                fillOpacity={region ? 0.08 : 0.28}
                stroke="var(--nila)"
                strokeWidth={1.6}
                strokeDasharray={region ? "5 4" : undefined}
              >
                <title>{`${cities[key]?.ar}: ${n}`}</title>
              </circle>
            );
          })}
          {labels.map(({ k, x, y }) => (
            <MapLabel key={k} x={x} y={y} size={26} className="spread-label">
              {cities[k]?.ar}
            </MapLabel>
          ))}
        </MapBase>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={play}
          className="w-24 shrink-0 rounded-sm bg-nila px-3 py-1.5 text-sm text-raqq"
          aria-pressed={playing}
        >
          {playing ? "إيقاف" : "تشغيل"}
        </button>
        <label htmlFor="tabaqa" className="sr-only">الطبقة</label>
        <input
          id="tabaqa"
          type="range"
          min={1}
          max={spread.length}
          value={t}
          onChange={(e) => {
            setPlaying(false);
            setT(Number(e.target.value));
          }}
          className="min-w-0 flex-1 accent-[var(--nila)]"
          aria-valuetext={tabaqaName(t)}
        />
        <span className="w-8 shrink-0 text-center tabular-nums">{t}</span>
      </div>

      <div className="mt-4 border-t border-khatt pt-4" aria-live="polite">
        <p className="naskh text-2xl font-bold leading-snug">{tabaqaName(t)}</p>
        <p className="naskh text-lg leading-loose">
          {cur.desc}
          {cur.example && <span className="text-midad-soft">، {cur.example}</span>}
        </p>
        <p className="text-sm text-midad-soft">
          {ERA_TEXT[cur.era]} (قاعدة ابن حجر) · عُرف بلد {cur.located} من {cur.total} راوياً في هذه الطبقة
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {ranked.slice(0, 8).map(([k, n]) => (
            <li key={k}>
              <span className="naskh text-base">{cities[k]?.ar}</span> <span className="tabular-nums text-midad-soft">{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
