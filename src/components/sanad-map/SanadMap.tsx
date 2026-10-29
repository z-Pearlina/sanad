"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { mountSanadMap } from "./engine";
import type { Geometry, MapData, NavLink } from "./types";
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
  cooperative = false,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
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
    ])
      .then(([data, geo]) => {
        if (controller.signal.aborted) return;
        destroy = mountSanadMap(root, data, geo, {
          autoplay,
          cooperative,
          hadithHref,
          narratorHref,
          nav: JSON.parse(navKey) as NavLink[],
          navigate: (href) => router.push(href),
        });
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
  }, [dataUrl, geometryUrl, hadithHref, narratorHref, navKey, autoplay, cooperative, router]);

  return <div ref={ref} className={className ? `sanad-map ${className}` : "sanad-map"} dir="rtl" lang="ar" />;
}
