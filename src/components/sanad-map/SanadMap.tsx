"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchButton } from "../QuickSearch";
import ThemeButton from "../ThemeButton";
import { mountSanadMap } from "./engine";
import { todayOf } from "./today";
import type { Geometry, Journey, MapData, NavLink } from "./types";
import "./sanad-map.css";

type Props = {
  /** Built by scripts/build_map_data.py */
  dataUrl?: string;
  /** Built by scripts/build_geometry.mjs */
  geometryUrl?: string;
  /** "{n}" becomes the hadith number; "" for no links. */
  hadithHref?: string;
  /** "{id}" becomes the Taqrib number; "" for no links. */
  narratorHref?: string;
  /** Links shown under the wordmark. */
  nav?: NavLink[];
  autoplay?: boolean;
  /** Open on this generation instead of the first. */
  startGen?: number;
  /** Open on the journey of this hadith. */
  startJourney?: number;
  /** Use inside a scrolling page: Ctrl/⌘ + wheel to zoom, two fingers on touch. */
  cooperative?: boolean;
  className?: string;
};

async function getJSON<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Interactive map of where the narrators of Sahih al-Bukhari lived,
 * generation by generation. The container is rendered by React; its
 * contents are drawn by the engine once the data files have loaded.
 */
export default function SanadMap({
  dataUrl = "/data/map.json",
  geometryUrl = "/data/geometry.json",
  hadithHref = "/hadith/?n={n}",
  narratorHref = "/narrator/?id={id}",
  nav,
  autoplay = true,
  startGen,
  startJourney,
  cooperative = false,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // the map has no site header: the appearance button stands among its tools
  const [tools, setTools] = useState<HTMLElement | null>(null);
  // a string key, so a new array with the same links does not redraw the map
  const navKey = JSON.stringify(nav ?? []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const controller = new AbortController();
    let destroy: (() => void) | null = null;

    Promise.all([
      getJSON<MapData>(dataUrl, controller.signal),
      getJSON<Geometry>(geometryUrl, controller.signal),
      // the map stands without it
      getJSON<Journey[]>("/data/daily.json", controller.signal).catch(() => [] as Journey[]),
    ])
      .then(([data, geo, daily]) => {
        if (controller.signal.aborted) return;
        destroy = mountSanadMap(root, data, geo, {
          autoplay,
          startGen,
          startJourney,
          today: todayOf(daily),
          cooperative,
          hadithHref,
          narratorHref,
          nav: JSON.parse(navKey) as NavLink[],
          navigate: (href) => router.push(href),
        });
        setTools(root.querySelector<HTMLElement>(".sm-tools"));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        root.innerHTML = `<p class="sm-error" role="alert">تعذّر تحميل الخريطة. أعد تحميل الصفحة.</p>`;
      });

    return () => {
      controller.abort();
      destroy?.();
      root.replaceChildren();
    };
  }, [dataUrl, geometryUrl, hadithHref, narratorHref, navKey, autoplay, startGen, startJourney, cooperative, router]);

  return (
    <>
      <div ref={ref} className={className ? `sanad-map ${className}` : "sanad-map"} dir="rtl" lang="ar" />
      {tools &&
        createPortal(
          <>
            <SearchButton className="sm-theme" />
            <ThemeButton className="sm-theme" />
          </>,
          tools,
        )}
    </>
  );
}

/** The map of the home page: ?gen=3 opens on a generation and ?journey=1 on a hadith's journey, and neither plays on its own. */
export function HomeMap({ nav }: { nav: NavLink[] }) {
  const params = useSearchParams();
  const gen = Number(params.get("gen"));
  const journey = Number(params.get("journey"));
  const startGen = Number.isInteger(gen) && gen >= 1 && gen <= 12 ? gen : undefined;
  const startJourney = journey || undefined;
  return <SanadMap nav={nav} autoplay={!startGen && !startJourney} startGen={startGen} startJourney={startJourney} />;
}
