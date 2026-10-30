// Drawing shared by every map of the site: the base map from geometry.json,
// zoom and framing, and a chain of narrators placed city by city. The home
// map (engine.ts) and the hadith page (chain.ts) are both built on it.

import { select, type Selection } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { easeCubicInOut } from "d3-ease";
import { ICON } from "./icons";
import type { Band, City, GeoLabel, Geometry, JourneyNode } from "./types";

export type XY = [number, number];
export type CityView = City & { xy: XY };
export type Placed = { n: JourneyNode; i: number; c: CityView | null; k: number };
export type Located = Placed & { c: CityView };
export type Box = { x0: number; x1: number; y0: number; y1: number };
type Segment = { a: Located; b: Located; key: string };
type SvgSel = Selection<SVGSVGElement, unknown, null, undefined>;

// side of the dot where each name is written
export const PLACE: Record<string, "e" | "w" | "n" | "s"> = {
  madina: "e", makka: "w", taif: "e", yamama: "e", sanaa: "w", yaman: "s", kufa: "w", basra: "s", baghdad: "n",
  wasit: "e", mosul: "n", jazira: "n", harran: "w", sham: "n", dimashq: "w", hims: "w", quds: "e", ramla: "n",
  asqalan: "w", ayla: "s", misr: "w", tinnis: "n", rayy: "n", isfahan: "s", khurasan: "n", naysabur: "n",
  marw: "n", harat: "s", balkh: "e", baghlan: "s", bukhara: "n",
};
export const ANCHOR = { e: "end", w: "start", n: "middle", s: "middle" } as const;
export const DX = { e: 9, w: -9, n: 0, s: 0 } as const;
export const DY = { e: 5, w: 5, n: -10, s: 21 } as const;
export const BAND_VAR: Record<Band, string> = {
  sahabi: "--sm-mughra", thiqa: "--sm-zinjar", saduq: "--sm-zaytun", maqbul: "--sm-ramad",
  daif: "--sm-zinjafr", none: "--sm-midad-soft", unknown: "--sm-midad-soft",
};

/** The layers of the base map, the same in every map. */
export const WORLD_MARKUP = `
    <g class="sm-world">
      <rect class="sm-sea" x="-4000" y="-4000" width="9000" height="9000"></rect>
      <path class="sm-grat"></path>
      <path class="sm-land sm-land-outer"></path>
      <path class="sm-land sm-land-inner"></path>
      <path class="sm-coast"></path>
      <path class="sm-lakes"></path>
      <path class="sm-rivers"></path>
    </g>`;

/** Fills the base map layers and returns the classical sea and river names (in screen space). */
export function drawBase(stage: HTMLElement, GEO: Geometry) {
  const set = (cls: string, d: string) => stage.querySelector(cls)?.setAttribute("d", d);
  set(".sm-land-outer", GEO.landOuter);
  set(".sm-land-inner", GEO.land);
  set(".sm-coast", GEO.coast);
  set(".sm-lakes", GEO.lakes);
  set(".sm-rivers", GEO.rivers);
  set(".sm-grat", GEO.grat);
  return select(stage.querySelector<SVGGElement>(".sm-geolabels"))
    .selectAll<SVGTextElement, GeoLabel>("text")
    .data(GEO.labels)
    .join("text")
    .attr("class", (d) => "sm-geo-label " + (d.kind === "sea" ? "sm-sea-l" : "sm-river-l"))
    .attr("text-anchor", "middle")
    .text((d) => d.text);
}

export function placeGeoLabels(labels: Selection<SVGTextElement, GeoLabel, SVGGElement | null, unknown>, t: ZoomTransform) {
  labels.attr(
    "transform",
    (d) => `translate(${t.applyX(d.x).toFixed(1)},${t.applyY(d.y).toFixed(1)}) rotate(${d.rotate ?? 0})`,
  );
}

/** The cities with their projected position, for those the base map knows. */
export function cityViews(cities: City[], GEO: Geometry): CityView[] {
  return cities.flatMap((c) => {
    const xy = GEO.cities[c.id];
    return xy ? [{ ...c, xy }] : [];
  });
}

// ---------------------------------------------------------------- zoom

export type ZoomSetup = {
  stage: HTMLElement;
  svg: SvgSel;
  GEO: Geometry;
  /** Inside a scrolling page: Ctrl/⌘ + wheel to zoom, two fingers on touch. */
  cooperative: boolean;
  mac: boolean;
  flashHint: (text: string) => void;
  /** A zoom started by the user (not by fitTo). */
  onUserStart?: () => void;
  onZoom: (t: ZoomTransform) => void;
  /** A gesture or a camera move has ended. */
  onEnd?: () => void;
  /** A map inside a page, on a phone: "locked" takes no gestures, "free" takes them all (full screen). */
  gestures?: () => "cooperative" | "locked" | "free";
};

export function createZoom(s: ZoomSetup): ZoomBehavior<SVGSVGElement, unknown> {
  // kept up to date from outside the gesture, which must not read the page's layout
  let size: [number, number] = [Math.max(1, s.stage.clientWidth), Math.max(1, s.stage.clientHeight)];
  new ResizeObserver(() => {
    // measured from the box, so a hidden map (display: none) never throws
    size = [Math.max(1, s.stage.clientWidth), Math.max(1, s.stage.clientHeight)];
  }).observe(s.stage);
  const zoom = d3zoom<SVGSVGElement, unknown>()
    .extent(() => [[0, 0], size])
    .scaleExtent([0.3, 12])
    .translateExtent([
      [-700, -520],
      [s.GEO.W + 700, s.GEO.H + 520],
    ])
    .on("start", (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
      if (!e.sourceEvent) return;
      s.onUserStart?.();
    })
    .on("zoom", (e: D3ZoomEvent<SVGSVGElement, unknown>) => s.onZoom(e.transform))
    .on("end", () => s.onEnd?.());
  if (s.cooperative) {
    zoom.filter((event: Event) => {
      const gestures = s.gestures?.() ?? "cooperative";
      if (gestures === "locked") return false;
      if (gestures === "free") return !(event as MouseEvent).button;
      if (event.type === "wheel") {
        const w = event as WheelEvent;
        if (w.ctrlKey || w.metaKey) return true;
        s.flashHint(`للتكبير: ${s.mac ? "⌘" : "Ctrl"} مع عجلة الفأرة`);
        return false;
      }
      if (event.type.startsWith("touch")) {
        const t = event as TouchEvent;
        if (t.touches.length >= 2) return true;
        if (event.type === "touchstart") s.flashHint("استعمل إصبعين لتحريك الخريطة");
        return false;
      }
      const m = event as MouseEvent;
      return !m.ctrlKey && !m.button;
    });
  }
  s.svg.call(zoom);
  return zoom;
}

/** Moves the camera so `points` (with `pad` around them) fill `box`, a part of the stage in pixels. */
export function fitTo(
  svg: SvgSel,
  zoom: ZoomBehavior<SVGSVGElement, unknown>,
  box: Box,
  points: XY[],
  pad: number,
  duration: number,
  maxK: number,
  reduced: boolean,
) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const bx0 = Math.min(...xs) - pad, bx1 = Math.max(...xs) + pad;
  const by0 = Math.min(...ys) - pad, by1 = Math.max(...ys) + pad;
  const fit = Math.min((box.x1 - box.x0) / (bx1 - bx0), (box.y1 - box.y0) / (by1 - by0));
  const k = Math.max(0.3, Math.min(maxK, fit));
  const tx = (box.x0 + box.x1) / 2 - (k * (bx0 + bx1)) / 2;
  const ty = (box.y0 + box.y1) / 2 - (k * (by0 + by1)) / 2;
  const t = zoomIdentity.translate(tx, ty).scale(k);
  if (duration && !reduced) svg.transition().duration(duration).ease(easeCubicInOut).call(zoom.transform, t);
  else svg.call(zoom.transform, t);
}

/** Moves the camera so `xy` stands at the centre of `box`, at the same scale. */
export function centerOn(
  svg: SvgSel,
  zoom: ZoomBehavior<SVGSVGElement, unknown>,
  box: Box,
  xy: XY,
  k: number,
  duration: number,
  reduced: boolean,
) {
  const t = zoomIdentity.translate((box.x0 + box.x1) / 2 - k * xy[0], (box.y0 + box.y1) / 2 - k * xy[1]).scale(k);
  if (duration && !reduced) svg.transition().duration(duration).ease(easeCubicInOut).call(zoom.transform, t);
  else svg.call(zoom.transform, t);
}

/** The +, − and ⟲ buttons ([data-zoom] inside the stage). */
export function wireZoomButtons(
  stage: HTMLElement,
  svg: SvgSel,
  zoom: ZoomBehavior<SVGSVGElement, unknown>,
  reduced: boolean,
  reset: () => void,
) {
  const button = (which: string) => stage.querySelector<HTMLButtonElement>(`[data-zoom='${which}']`);
  button("in")?.addEventListener("click", () => zoom.scaleBy(svg.transition().duration(reduced ? 0 : 350), 1.6));
  button("out")?.addEventListener("click", () => zoom.scaleBy(svg.transition().duration(reduced ? 0 : 350), 1 / 1.6));
  button("reset")?.addEventListener("click", reset);
}

export const ZOOM_MARKUP = `
    <div class="sm-zoom" role="group" aria-label="التكبير">
      <button type="button" data-zoom="in" aria-label="تكبير">${ICON.plus}</button>
      <button type="button" data-zoom="out" aria-label="تصغير">${ICON.minus}</button>
      <button type="button" data-zoom="reset" aria-label="إعادة الخريطة إلى وضعها">${ICON.again}</button>
    </div>`;

// ---------------------------------------------------------------- a chain on the map

// Narrators of one city stand in a row, away from the side where the city's
// name is written; a narrator's own name goes on the other side of the dara.
export const rowDir = (c: CityView) => (!c.region && PLACE[c.id] === "w" ? 1 : -1);
export const nameBelow = (c: CityView) => !c.region && PLACE[c.id] === "n";

/** The first `visible` nodes with their home and their place in that home's row. */
export function placeNodes(nodes: JourneyNode[], visible: number, homeOf: (n: JourneyNode) => CityView | null): Placed[] {
  const seen = new Map<string, number>();
  return nodes.slice(0, visible).map((n, i) => {
    const c = homeOf(n);
    if (!c) return { n, i, c: null, k: 0 };
    const k = seen.get(c.id) ?? 0;
    seen.set(c.id, k + 1);
    return { n, i, c, k };
  });
}

/** Homes along the chain, a city repeated in a row counted once. */
export function journeyPlaces(nodes: JourneyNode[], homeOf: (n: JourneyNode) => CityView | null) {
  const seq: CityView[] = [];
  for (const node of nodes) {
    const c = homeOf(node);
    if (c && seq[seq.length - 1] !== c) seq.push(c);
  }
  return seq;
}

function haversine(a: City, b: City) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Men, homes, distance between consecutive homes, and the known death years of a chain. */
export function journeySummary(nodes: JourneyNode[], homeOf: (n: JourneyNode) => CityView | null) {
  const places = journeyPlaces(nodes, homeOf);
  let km = 0;
  for (let i = 1; i < places.length; i++) km += haversine(places[i - 1], places[i]);
  const years = nodes.map((n) => n.d).filter((d): d is number => typeof d === "number");
  return { men: nodes.length, places, km: Math.round(km / 10) * 10, years, regions: places.some((c) => c.region) };
}

export type ChainDraw = {
  nodes: JourneyNode[];
  placed: Placed[];
  /** The narrator named on the map. */
  current: number;
  /** Everything drawn and stopped: the first and last names stay up too. */
  done: boolean;
  /** Animate the newly drawn segments and daras. */
  enter: boolean;
  /** A narrator pointed at elsewhere on the page (hadith page): ringed and named. */
  focus?: string | null;
};

/**
 * The chain on the map, in screen space so it stays crisp at any zoom.
 * Separate layers keep the drawing order without re-inserting elements,
 * which would restart their entry animation.
 */
export function createChainLayer(parent: Selection<SVGGElement, unknown, null, undefined>, project: (xy: XY) => XY, reduced: boolean) {
  const segLayer = parent.append("g");
  const termLayer = parent.append("g");
  const nodeLayer = parent.append("g");
  const nodeXY = (d: Located): XY => {
    const [x, y] = project(d.c.xy);
    return [x + rowDir(d.c) * d.k * 20, y];
  };

  function clear() {
    segLayer.selectAll("*").remove();
    termLayer.selectAll("*").remove();
    nodeLayer.selectAll("*").remove();
  }

  function draw({ nodes, placed, current: cur, done, enter, focus = null }: ChainDraw) {
    const located = placed.filter((d): d is Located => d.c !== null);
    const segs: Segment[] = [];
    for (let i = 1; i < located.length; i++) {
      segs.push({ a: located[i - 1], b: located[i], key: `${located[i - 1].i}-${located[i].i}` });
    }
    const segSel = segLayer.selectAll<SVGPathElement, Segment>("path.sm-j-seg").data(segs, (d) => d.key);
    segSel.exit().remove();
    const segEnter = segSel.enter().append("path").attr("class", "sm-j-seg");
    segEnter.merge(segSel).attr("d", (d) => {
      const [x1, y1] = nodeXY(d.a);
      const [x2, y2] = nodeXY(d.b);
      if (d.a.c.id === d.b.c.id) return `M${x1},${y1}L${x2},${y2}`;
      const bend = 0.18;
      return `M${x1},${y1}Q${(x1 + x2) / 2 - (y2 - y1) * bend},${(y1 + y2) / 2 + (x2 - x1) * bend} ${x2},${y2}`;
    });
    if (enter && !reduced) {
      segEnter.each(function () {
        const L = this.getTotalLength();
        select(this)
          .attr("stroke-dasharray", `${L} ${L}`)
          .attr("stroke-dashoffset", L)
          .transition()
          .duration(900)
          .ease(easeCubicInOut)
          .attr("stroke-dashoffset", 0)
          .on("end", function () {
            select(this).attr("stroke-dasharray", null);
          });
      });
    }
    // a term is written on its segment when there is room, or when it leads to the current narrator
    const terms = segs.filter((s) => {
      if (!nodes[s.a.i].tr || s.a.c.id === s.b.c.id) return false;
      const [x1, y1] = nodeXY(s.a);
      const [x2, y2] = nodeXY(s.b);
      return s.b.i === cur || Math.hypot(x2 - x1, y2 - y1) >= 72;
    });
    termLayer
      .selectAll<SVGTextElement, Segment>("text.sm-j-term")
      .data(terms, (d) => d.key)
      .join("text")
      .attr("class", "sm-j-term")
      .attr("text-anchor", "middle")
      .attr("x", (d) => {
        const [x1, y1] = nodeXY(d.a);
        const [x2, y2] = nodeXY(d.b);
        return ((x1 + x2) / 2 - (y2 - y1) * 0.09).toFixed(1);
      })
      .attr("y", (d) => {
        const [x1, y1] = nodeXY(d.a);
        const [x2, y2] = nodeXY(d.b);
        return ((y1 + y2) / 2 + (x2 - x1) * 0.09 + 5).toFixed(1);
      })
      .text((d) => nodes[d.a.i].tr);
    const nodeSel = nodeLayer.selectAll<SVGGElement, Located>("g.sm-j-node").data(located, (d) => d.i);
    nodeSel.exit().remove();
    const ne = nodeSel.enter().append("g").attr("class", "sm-j-node");
    // the entry animation moves an inner group, so it never fights the position
    const body = ne.append("g").attr("class", "sm-j-body" + (enter && !reduced ? " sm-enter" : ""));
    body.append("circle").attr("class", "sm-r").attr("r", 8);
    body.append("circle").attr("class", "sm-d").attr("r", 3.4);
    body.append("text").attr("class", "sm-nm").attr("text-anchor", "middle");
    body.append("text").attr("class", "sm-yr").attr("text-anchor", "middle");
    const all = ne.merge(nodeSel);
    const focused = (d: Located) => focus !== null && d.n.id === focus;
    all
      .attr("transform", (d) => {
        const [x, y] = nodeXY(d);
        return `translate(${x.toFixed(1)},${y.toFixed(1)})`;
      })
      .classed("sm-current", (d) => d.i === cur)
      .classed("sm-focus", focused);
    all.select<SVGCircleElement>("circle.sm-r").style("stroke", (d) => `var(${BAND_VAR[d.n.b]})`);
    all
      .select<SVGCircleElement>("circle.sm-d")
      .style("fill", (d) => (d.n.id ? `var(${BAND_VAR[d.n.b]})` : "transparent"));
    const firstI = located.length ? located[0].i : -1;
    const lastI = located.length ? located[located.length - 1].i : -1;
    const withYear = (d: Located) => (d.i === cur || focused(d)) && Boolean(d.n.d);
    // name and death year sit together, above the dara or below it
    all
      .select<SVGTextElement>("text.sm-nm")
      .attr("y", (d) => (nameBelow(d.c) ? 27 : withYear(d) ? -31 : -15))
      .text((d) => (d.i === cur || focused(d) || (done && (d.i === firstI || d.i === lastI)) ? d.n.n : ""));
    all
      .select<SVGTextElement>("text.sm-yr")
      .attr("y", (d) => (nameBelow(d.c) ? 41 : -14))
      .text((d) => (withYear(d) ? `ت ${d.n.d}هـ` : ""));
  }

  return { clear, draw };
}
