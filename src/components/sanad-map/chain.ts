// One hadith's chain told on the map: the camera starts at the Companion's home
// and follows the chain narrator by narrator down to al-Bukhari, then pulls back
// to show the whole route. Built on core.ts, like the home map.

import { select } from "d3-selection";
import { zoomIdentity, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import {
  ANCHOR, DX, DY, PLACE, WORLD_MARKUP, ZOOM_MARKUP, cityViews, createChainLayer, createZoom, drawBase, fitTo,
  journeyPlaces, journeySummary, placeGeoLabels, placeNodes, wireZoomButtons, type CityView, type XY,
} from "./core";
import { esc } from "./arabic";
import type { City, Geometry, JourneyNode } from "./types";

export type ChainSummary = ReturnType<typeof journeySummary>;

export type ChainMapOptions = {
  /** Narrator i (0 = the Companion) is being drawn; -1 when the telling starts, nodes.length once done. */
  onStep?: (i: number) => void;
  /** The whole chain is drawn and the camera shows the route. */
  onDone?: (summary: ChainSummary) => void;
};

export type ChainMapControls = {
  replay: () => void;
  /** Ring and name a narrator pointed at elsewhere on the page (null to clear). */
  focus: (id: string | null) => void;
  destroy: () => void;
};

const CAMERA_MS = 850;
const NEXT_MS = 1150;

export function mountChainMap(
  root: HTMLElement,
  GEO: Geometry,
  places: City[],
  nodes: JourneyNode[],
  label: string,
  opts: ChainMapOptions = {},
): ChainMapControls {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  const holder = document.createElement("div");
  holder.innerHTML = `
<div class="sm-stage sm-coop sm-journeying">
  <svg class="sm-svg" role="img" aria-label="${esc(label)}">
    ${WORLD_MARKUP}
    <g class="sm-overlay sm-dim">
      <g class="sm-geolabels"></g>
      <g class="sm-cities"></g>
      <g class="sm-journey"></g>
    </g>
  </svg>
  <div class="sm-tools">${ZOOM_MARKUP}</div>
  <div class="sm-hint sm-gone" aria-hidden="true"></div>
</div>`;
  const stage = holder.firstElementChild as HTMLDivElement;
  root.appendChild(stage);
  const svgEl = stage.querySelector<SVGSVGElement>(".sm-svg")!;
  const svg = select(svgEl);
  const world = select(stage.querySelector<SVGGElement>(".sm-world")!);
  const hint = stage.querySelector<HTMLDivElement>(".sm-hint")!;

  let transform: ZoomTransform = zoomIdentity;
  const sx = (p: XY) => transform.applyX(p[0]);
  const sy = (p: XY) => transform.applyY(p[1]);

  const geoLabels = drawBase(stage, GEO);
  const cities = cityViews(places, GEO);
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const homeOf = (n: JourneyNode) => (n.city ? cityById.get(n.city) ?? null : null);
  const route = new Set(nodes.map((n) => n.city).filter((c): c is string => Boolean(c)));

  // every city stays faintly on the map for orientation; the chain's homes are named
  const cityG = select(stage.querySelector<SVGGElement>(".sm-cities")!)
    .selectAll<SVGGElement, CityView>("g.sm-city")
    .data(cities, (d) => d.id)
    .join((enter) => {
      const g = enter
        .append("g")
        .attr("class", (d) => "sm-city" + (d.region ? " sm-region" : "") + (route.has(d.id) ? " sm-on-route" : " sm-hidden-label"));
      g.filter((d) => !d.region).append("circle").attr("class", "sm-ring").attr("r", 4.6);
      g.filter((d) => !d.region).append("circle").attr("class", "sm-dot").attr("r", 1.8);
      g.append("text")
        .attr("class", "sm-label")
        .text((d) => d.name)
        .attr("text-anchor", (d) => (d.region ? "middle" : ANCHOR[PLACE[d.id] ?? "n"]))
        .attr("x", (d) => (d.region ? 0 : DX[PLACE[d.id] ?? "n"]))
        // a region on the route writes its name under the row of daras
        .attr("y", (d) => (d.region ? (route.has(d.id) ? 30 : 6) : DY[PLACE[d.id] ?? "n"]));
      return g;
    });

  const chain = createChainLayer(select(stage.querySelector<SVGGElement>(".sm-journey")!), (xy) => [sx(xy), sy(xy)], reduced);

  // ---------------------------------------------------------------- state
  let step = -1; // narrator the camera is on
  let visible = 0; // narrators drawn so far
  let playing = false;
  let started = false;
  let focusId: string | null = null;
  let timer = 0;
  let flashTimer = 0;

  function draw(enter: boolean) {
    chain.draw({
      nodes,
      placed: placeNodes(nodes, visible, homeOf),
      current: Math.min(step, visible - 1),
      done: visible === nodes.length && !playing,
      enter,
      focus: focusId,
    });
  }
  function place() {
    cityG.attr("transform", (d) => `translate(${sx(d.xy).toFixed(1)},${sy(d.xy).toFixed(1)})`);
    placeGeoLabels(geoLabels, transform);
    draw(false);
  }

  // ---------------------------------------------------------------- zoom
  function flashHint(text: string) {
    hint.textContent = text;
    hint.classList.remove("sm-gone");
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => hint.classList.add("sm-gone"), 1600);
  }
  const zoom = createZoom({
    stage,
    svg,
    GEO,
    cooperative: true,
    mac,
    flashHint,
    onZoom: (t) => {
      transform = t;
      world.attr("transform", t.toString());
      place();
    },
  });
  function box(inset = 0) {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const tools = w > 520 ? 64 : 16; // the zoom buttons sit at the top left
    return { x0: tools + inset, x1: w - 16 - inset, y0: 16 + inset * 0.6, y1: h - 16 - inset * 0.6 };
  }
  function frameRoute(duration: number) {
    const pts = journeyPlaces(nodes, homeOf).map((c) => c.xy);
    if (!pts.length) return;
    const rows: Record<string, number> = {};
    for (const n of nodes) if (n.city) rows[n.city] = (rows[n.city] ?? 0) + 1;
    const longest = Math.max(1, ...Object.values(rows));
    fitTo(svg, zoom, box(30), pts, 20 + (longest - 1) * 20 + (pts.length > 1 ? 0 : 60), duration, pts.length > 1 ? 12 : 4, reduced);
  }
  wireZoomButtons(stage, svg, zoom, reduced, () => frameRoute(700));
  if (touch) flashHint("حرّك الخريطة بإصبعين");

  // ---------------------------------------------------------------- telling the chain
  // earlier narrators who lived in the same city as node i
  const rowIndex = (i: number) => nodes.slice(0, i).filter((n) => n.city && n.city === nodes[i].city).length;
  function lastPlaceBefore(i: number) {
    for (let k = i - 1; k >= 0; k--) {
      const c = homeOf(nodes[k]);
      if (c) return c;
    }
    return null;
  }
  function showStep(i: number) {
    step = i;
    opts.onStep?.(i);
    const cur = homeOf(nodes[i]);
    const prev = lastPlaceBefore(i);
    if (cur) fitTo(svg, zoom, box(50), prev ? [cur.xy, prev.xy] : [cur.xy], 20 + rowIndex(i) * 20, CAMERA_MS, 3, reduced);
    timer = window.setTimeout(
      () => {
        visible = i + 1;
        draw(true);
        timer = window.setTimeout(() => (i === nodes.length - 1 ? finish() : showStep(i + 1)), i === nodes.length - 1 ? 1000 : NEXT_MS);
      },
      cur ? CAMERA_MS : 0,
    );
  }
  function finish() {
    playing = false;
    step = nodes.length - 1;
    visible = nodes.length;
    frameRoute(reduced ? 0 : 1400);
    draw(false);
    opts.onStep?.(nodes.length); // past the last narrator: nobody is being drawn
    opts.onDone?.(journeySummary(nodes, homeOf));
  }
  function start() {
    window.clearTimeout(timer);
    svg.interrupt();
    started = true;
    chain.clear();
    step = -1;
    visible = 0;
    opts.onStep?.(-1);
    if (reduced || !nodes.length) {
      finish();
      return;
    }
    playing = true;
    // the camera starts at the Companion's home (or the first home the chain knows)
    const first = nodes.map(homeOf).find((c): c is CityView => c !== null);
    if (first) fitTo(svg, zoom, box(50), [first.xy], 60, 0, 3, reduced);
    draw(false);
    timer = window.setTimeout(() => showStep(0), 700);
  }

  // the route is framed at once; the telling starts when the map comes into view
  frameRoute(0);
  const watcher = new IntersectionObserver(
    (entries) => {
      if (!started && entries.some((e) => e.isIntersecting)) start();
    },
    { threshold: 0.35 },
  );
  watcher.observe(stage);

  // refit when the width changes (not when a phone's address bar slides)
  let lastW = stage.clientWidth;
  const resizer = new ResizeObserver(() => {
    const w = stage.clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    if (!playing) frameRoute(0);
  });
  resizer.observe(stage);

  return {
    replay: start,
    focus(id) {
      focusId = id;
      draw(false);
    },
    destroy() {
      window.clearTimeout(timer);
      window.clearTimeout(flashTimer);
      watcher.disconnect();
      resizer.disconnect();
      svg.interrupt();
      svg.selectAll("*").interrupt();
      svg.on(".zoom", null);
      stage.remove();
    },
  };
}
