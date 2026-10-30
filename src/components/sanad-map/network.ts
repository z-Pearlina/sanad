// A narrator's links on the map: where his teachers lived, drawn as lines coming
// to his home, or where his students lived, drawn as lines leaving it. Built on
// core.ts and styled like the home map (gold circles, rubric lines).

import { select } from "d3-selection";
import { zoomIdentity, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { easeCubicOut } from "d3-ease";
import {
  ANCHOR, BAND_VAR, DX, DY, PLACE, WORLD_MARKUP, ZOOM_MARKUP, cityViews, createZoom, drawBase, fitTo, placeGeoLabels,
  wireZoomButtons, type CityView, type XY,
} from "./core";
import { esc } from "./arabic";
import { PHONE_QUERY } from "./phone";
import type { Band, City, Geometry } from "./types";

export type Side = "teachers" | "students";
/** Men of one side who lived in a city, and how often they appear with the narrator in the chains. */
export type NetworkPlace = { city: string; men: number; times: number };
export type NetworkData = {
  home: string | null;
  band: Band;
  teachers: NetworkPlace[];
  students: NetworkPlace[];
};
export type NetworkControls = {
  show: (side: Side) => void;
  /** Phones: the map has been opened full screen, or closed. */
  setFull: (on: boolean) => void;
  destroy: () => void;
};

type Line = NetworkPlace & { c: CityView };

const radius = (n: number) => (n ? 3 + 1.7 * Math.sqrt(n) : 0); // as the home map's circles
const lineWidth = (n: number) => 0.7 + 1.35 * Math.log10(n + 1);

export function mountNetworkMap(
  root: HTMLElement,
  GEO: Geometry,
  places: City[],
  data: NetworkData,
  label: string,
  first: Side,
): NetworkControls {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const phone = window.matchMedia(PHONE_QUERY);
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);

  const holder = document.createElement("div");
  holder.innerHTML = `
<div class="sm-stage sm-coop">
  <svg class="sm-svg" role="img" aria-label="${esc(label)}">
    ${WORLD_MARKUP}
    <g class="sm-overlay">
      <g class="sm-geolabels"></g>
      <g class="sm-arcs"></g>
      <g class="sm-cities"></g>
      <g class="sm-net-home"></g>
    </g>
  </svg>
  <div class="sm-tools">${ZOOM_MARKUP}</div>
  <div class="sm-hint sm-gone" aria-hidden="true"></div>
</div>`;
  const stage = holder.firstElementChild as HTMLDivElement;
  root.appendChild(stage);
  const svg = select(stage.querySelector<SVGSVGElement>(".sm-svg")!);
  const world = select(stage.querySelector<SVGGElement>(".sm-world")!);
  const arcLayer = select(stage.querySelector<SVGGElement>(".sm-arcs")!);
  const homeLayer = select(stage.querySelector<SVGGElement>(".sm-net-home")!);
  const hint = stage.querySelector<HTMLDivElement>(".sm-hint")!;

  let transform: ZoomTransform = zoomIdentity;
  const sx = (p: XY) => transform.applyX(p[0]);
  const sy = (p: XY) => transform.applyY(p[1]);

  const geoLabels = drawBase(stage, GEO);
  const cities = cityViews(places, GEO);
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const home = data.home ? cityById.get(data.home) ?? null : null;
  let side: Side = first;
  let lines: Line[] = [];
  let full = false;

  const cityG = select(stage.querySelector<SVGGElement>(".sm-cities")!)
    .selectAll<SVGGElement, CityView>("g.sm-city")
    .data(cities, (d) => d.id)
    .join((enter) => {
      const g = enter.append("g").attr("class", (d) => "sm-city" + (d.region ? " sm-region" : ""));
      g.append("circle").attr("class", "sm-bubble").attr("r", 0);
      g.filter((d) => !d.region).append("circle").attr("class", "sm-ring").attr("r", 4.6);
      g.filter((d) => !d.region).append("circle").attr("class", "sm-dot").attr("r", 1.8);
      g.append("text")
        .attr("class", "sm-label")
        .text((d) => d.name)
        .attr("text-anchor", (d) => (d.region ? "middle" : ANCHOR[PLACE[d.id] ?? "n"]))
        .attr("x", (d) => (d.region ? 0 : DX[PLACE[d.id] ?? "n"]))
        .attr("y", (d) => (d.region ? 6 : DY[PLACE[d.id] ?? "n"]));
      return g;
    });

  // his own home: a large dara in the colour of Ibn Hajar's grade
  if (home) {
    const g = homeLayer.append("g").attr("class", "sm-j-node sm-current");
    g.append("circle").attr("class", "sm-r").attr("r", 12).style("stroke", `var(${BAND_VAR[data.band]})`);
    g.append("circle").attr("class", "sm-d").attr("r", 5).style("fill", `var(${BAND_VAR[data.band]})`);
  }

  function arcD(a: XY, b: XY, bend = 0.2) {
    const x1 = sx(a), y1 = sy(a), x2 = sx(b), y2 = sy(b);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const cx = (x1 + x2) / 2 - (dy / len) * len * bend;
    const cy = (y1 + y2) / 2 + (dx / len) * len * bend;
    return `M${x1.toFixed(1)},${y1.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  // teachers' lines come to his home, students' lines leave it
  const ends = (d: Line): [XY, XY] => (side === "teachers" ? [d.c.xy, home!.xy] : [home!.xy, d.c.xy]);

  function place() {
    cityG.attr("transform", (d) => `translate(${sx(d.xy).toFixed(1)},${sy(d.xy).toFixed(1)})`);
    placeGeoLabels(geoLabels, transform);
    if (home) homeLayer.select("g").attr("transform", `translate(${sx(home.xy).toFixed(1)},${sy(home.xy).toFixed(1)})`);
    arcLayer.selectAll<SVGPathElement, Line>("path.sm-arc").attr("d", (d) => arcD(...ends(d)));
  }

  function flashHint(text: string) {
    hint.textContent = text;
    hint.classList.remove("sm-gone");
    window.setTimeout(() => hint.classList.add("sm-gone"), 1600);
  }
  const zoom = createZoom({
    stage,
    svg,
    GEO,
    cooperative: true,
    mac,
    flashHint,
    gestures: () => (!phone.matches ? "cooperative" : full ? "free" : "locked"),
    onZoom: (t) => {
      transform = t;
      world.attr("transform", t.toString());
      place();
    },
  });
  function box() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const tools = w > 520 ? 64 : 16;
    return { x0: tools, x1: w - 24, y0: 28, y1: h - 24 };
  }
  function frame(duration: number) {
    const pts = [...lines.map((d) => d.c.xy), ...(home ? [home.xy] : [])];
    if (!pts.length) return;
    fitTo(svg, zoom, box(), pts, pts.length > 1 ? 34 : 120, duration, pts.length > 1 ? 6 : 3, reduced);
  }
  wireZoomButtons(stage, svg, zoom, reduced, () => frame(700));
  if (touch && !phone.matches) flashHint("حرّك الخريطة بإصبعين");

  function show(next: Side) {
    side = next;
    const placesOfSide = data[side].flatMap((p) => {
      const c = cityById.get(p.city);
      return c ? [{ ...p, c }] : [];
    });
    const men = new Map(placesOfSide.map((p) => [p.city, p.men]));
    lines = placesOfSide.filter((p) => !home || p.city !== home.id);
    frame(reduced ? 0 : 700);

    // circles: men of this side in each city (his own city included)
    cityG
      .classed("sm-hidden-label", (d) => !men.has(d.id) && d.id !== home?.id)
      .classed("sm-empty", (d) => !men.has(d.id) && !d.region)
      .select<SVGCircleElement>(".sm-bubble")
      .transition()
      .duration(reduced ? 0 : 650)
      .ease(easeCubicOut)
      // men of his own city ring his large dara instead of hiding under it
      .attr("r", (d) => (d.id === home?.id && men.get(d.id) ? 13 + 1.7 * Math.sqrt(men.get(d.id) ?? 0) : radius(men.get(d.id) ?? 0)));

    // lines, drawn one after another
    arcLayer.selectAll("path").interrupt().remove();
    if (!home) return;
    const paths = arcLayer
      .selectAll<SVGPathElement, Line>("path.sm-arc")
      .data([...lines].sort((a, b) => b.times - a.times), (d) => d.city)
      .join("path")
      .attr("class", "sm-arc")
      .attr("d", (d) => arcD(...ends(d)))
      .attr("stroke-width", (d) => lineWidth(d.times))
      .style("opacity", (d) => Math.min(0.9, 0.4 + 0.15 * Math.log10(d.times + 1)));
    if (!reduced) {
      paths.each(function (_d, i) {
        const L = this.getTotalLength();
        select(this)
          .attr("stroke-dasharray", `${L} ${L}`)
          .attr("stroke-dashoffset", L)
          .transition()
          .delay(250 + i * 70)
          .duration(900)
          .ease(easeCubicOut)
          .attr("stroke-dashoffset", 0)
          .on("end", function () {
            select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
          });
      });
    }
  }

  show(first);
  let lastW = stage.clientWidth;
  const resizer = new ResizeObserver(() => {
    const w = stage.clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    frame(0);
  });
  resizer.observe(stage);

  return {
    show,
    setFull(on) {
      full = on;
      frame(0);
    },
    destroy() {
      resizer.disconnect();
      svg.interrupt();
      svg.selectAll("*").interrupt();
      svg.on(".zoom", null);
      stage.remove();
    },
  };
}
