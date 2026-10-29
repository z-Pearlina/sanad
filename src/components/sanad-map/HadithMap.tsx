"use client";

import { useEffect, useRef, useState } from "react";
import { count, fmt } from "./arabic";
import { mountChainMap, type ChainMapControls, type ChainSummary } from "./chain";
import { getData } from "@/lib/data";
import type { City, Geometry, JourneyNode } from "./types";
import "./sanad-map.css";
import "./chain-map.css";

type CitiesFile = Record<string, { ar: string; lat: number; lon: number; kind: "city" | "region" }>;

type Props = {
  /** The chain, the Companion first and al-Bukhari last. Keep it stable (useMemo): a new array redraws. */
  nodes: JourneyNode[];
  label: string;
  /** Narrator id pointed at in the text, the column or the timeline. */
  focus: string | null;
  /** The narrator being drawn (index in `nodes`), -1 before the telling starts. */
  onStep: (i: number) => void;
};

/** The hadith page map: the chain is drawn narrator by narrator, then summed up. */
export default function HadithMap({ nodes, label, focus, onStep }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useRef<ChainMapControls | null>(null);
  const stepRef = useRef(onStep);
  const [summary, setSummary] = useState<ChainSummary | null>(null);

  useEffect(() => {
    stepRef.current = onStep;
  }, [onStep]);

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
        controls.current = mountChainMap(root, geo, places, nodes, label, {
          onStep: (i) => {
            if (i < 0) setSummary(null);
            stepRef.current(i);
          },
          onDone: setSummary,
        });
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
  }, [nodes, label]);

  useEffect(() => {
    controls.current?.focus(focus);
  }, [focus]);

  const unplaced = nodes.filter((n) => !n.city).length;
  const years = summary?.years ?? [];

  return (
    <figure>
      <div ref={ref} className="sanad-map sm-embed" dir="rtl" lang="ar" />
      <figcaption className="mt-3 space-y-3">
        {summary && (
          <div className="chain-summary flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-khatt py-3" aria-live="polite">
            <Stat big={count(summary.men, "rajul")} small="في السند" />
            <Stat big={count(summary.places.length, summary.regions ? "balad" : "city")} small="مرّ بها" />
            {summary.places.length > 1 && <Stat big={`${fmt(summary.km)} كم`} small="تقريباً بين مواطنهم" />}
            {years.length > 0 && (
              <Stat
                big={years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}هـ` : `${years[0]}هـ`}
                small={years.length > 1 ? "سنوات الوفاة المعروفة" : "سنة الوفاة المعروفة"}
              />
            )}
            <button
              type="button"
              onClick={() => controls.current?.replay()}
              className="ms-auto rounded-sm border border-nila px-3 py-1.5 text-sm text-nila hover:bg-nila hover:text-raqq"
            >
              أعد الرسم
            </button>
          </div>
        )}
        <p className="text-xs leading-relaxed text-midad-soft">
          تعرض الخريطة موطن كل راوٍ حسب نسبته في تقريب التهذيب، ومن لا نسبة له فبحسب المشهور في التراجم، لا المكان الذي
          سمع فيه الحديث.
          {unplaced > 0 && ` ${count(unplaced, "rajul")} من رجال السند بلا بلد معروف، فلا يظهر${unplaced > 1 ? "ون" : ""} عليها.`}
        </p>
      </figcaption>
    </figure>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="flex flex-col">
      <strong className="naskh text-2xl leading-tight tabular-nums">{big}</strong>
      <span className="text-xs text-midad-soft">{small}</span>
    </div>
  );
}
