"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullMap from "./FullMap";
import { count, fmt } from "./arabic";
import { mountNetworkMap, type NetworkControls, type NetworkData, type NetworkPlace, type Side } from "./network";
import { getData } from "@/lib/data";
import type { Band, City, Geometry } from "./types";
import type { NarratorRef } from "@/lib/types";
import "./sanad-map.css";
import "./chain-map.css";

type CitiesFile = Record<string, { ar: string; lat: number; lon: number; kind: "city" | "region" }>;

type Props = {
  home: string | null;
  band: Band;
  teachers: NarratorRef[];
  students: NarratorRef[];
  /** Place id -> Arabic name, for the caption. */
  cityNames: Record<string, string>;
  label: string;
};

/** Men per city and how often they appear with the narrator. */
function byCity(refs: NarratorRef[]): NetworkPlace[] {
  const out = new Map<string, NetworkPlace>();
  for (const r of refs) {
    if (!r.city) continue;
    const p = out.get(r.city) ?? { city: r.city, men: 0, times: 0 };
    p.men += 1;
    p.times += r.count;
    out.set(r.city, p);
  }
  return [...out.values()].sort((a, b) => b.men - a.men || b.times - a.times);
}

const SIDES: { side: Side; label: string; verb: string }[] = [
  { side: "teachers", label: "شيوخه", verb: "من روى عنهم" },
  { side: "students", label: "تلاميذه", verb: "من رووا عنه" },
];

/** The narrator page map: lines from his teachers' homes to his, or from his home to his students'. */
export default function NarratorMap({ home, band, teachers, students, cityNames, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useRef<NetworkControls | null>(null);
  const data: NetworkData = useMemo(
    () => ({ home, band, teachers: byCity(teachers), students: byCity(students) }),
    [home, band, teachers, students],
  );
  const first: Side = data.teachers.length || !data.students.length ? "teachers" : "students";
  const [side, setSide] = useState<Side>(first);
  const sideRef = useRef(side);

  useEffect(() => {
    sideRef.current = side;
    controls.current?.show(side);
  }, [side]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let live = true;
    Promise.all([getData<Geometry>("geometry.json"), getData<CitiesFile>("cities.json")])
      .then(([geo, file]) => {
        if (!live) return;
        const places: City[] = Object.entries(file).map(([id, c]) => ({
          id,
          name: c.ar,
          lat: c.lat,
          lon: c.lon,
          ...(c.kind === "region" ? { region: 1 as const } : {}),
        }));
        controls.current = mountNetworkMap(root, geo, places, data, label, sideRef.current);
      })
      .catch(() => {
        if (live) root.innerHTML = `<p class="sm-error" role="alert">تعذّر تحميل الخريطة. أعد تحميل الصفحة.</p>`;
      });
    return () => {
      live = false;
      controls.current?.destroy();
      controls.current = null;
      root.replaceChildren();
    };
  }, [data, label]);

  const list = data[side];
  const refs = side === "teachers" ? teachers : students;
  const unplaced = refs.filter((r) => !r.city).length;

  return (
    <figure>
      <div className="mb-3 flex gap-2" role="group" aria-label="خريطة الصلات">
        {SIDES.map(({ side: s, label: text }) => {
          const n = data[s].length;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={side === s}
              disabled={(s === "teachers" ? teachers : students).length === 0}
              onClick={() => setSide(s)}
              className={`rounded-sm border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 phone:min-h-11 ${
                side === s ? "border-zinjafr text-zinjafr" : "border-khatt text-midad-soft hover:border-nila hover:text-nila"
              }`}
            >
              {text} <span className="tabular-nums">({n ? count(n, "balad") : "بلا بلد معروف"})</span>
            </button>
          );
        })}
      </div>
      <FullMap onChange={(full) => controls.current?.setFull(full)}>
        <div ref={ref} className="sanad-map sm-embed sm-embed-small" dir="rtl" lang="ar" />
      </FullMap>
      <figcaption className="mt-2 space-y-1 text-sm">
        {list.length > 0 && (
          <p>
            {list.map((p, i) => (
              <span key={p.city}>
                {i > 0 && " · "}
                <span className="naskh text-base">{cityNames[p.city] ?? p.city}</span>{" "}
                <span className="tabular-nums text-midad-soft">{fmt(p.men)}</span>
              </span>
            ))}
          </p>
        )}
        <p className="text-xs text-midad-soft">
          {SIDES.find((s) => s.side === side)?.verb} في أسانيد البخاري، في كل بلد عددهم، حسب نسبهم في تقريب التهذيب ومن لا نسبة
          له فبحسب المشهور في التراجم.
          {home ? " والدارة الكبيرة موطنه." : " ولا بلد معروفاً له هو، فلا تُرسم الخطوط."}
          {unplaced > 0 && ` ${count(unplaced, "rajul")} منهم بلا بلد معروف.`}
        </p>
      </figcaption>
    </figure>
  );
}
