// The narration map, drawn with d3 into a container element.
// React only provides the container (see SanadMap.tsx); everything inside it
// is built and owned here, and mountSanadMap returns a function that removes
// it again with all its timers and listeners.

import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { easeCubicInOut, easeCubicOut } from "d3-ease";
import { interpolateRound } from "d3-interpolate";
import { ORD, count, esc, fmt, words, type Noun } from "./arabic";
import type { Band, City, Flow, GeoLabel, Geometry, Journey, JourneyNode, MapData, NavLink } from "./types";

export type SanadMapOptions = {
  /** Play the generations once on load (default true). */
  autoplay?: boolean;
  /** For maps inside a scrolling page: the wheel zooms only with Ctrl/⌘, touch needs two fingers. */
  cooperative?: boolean;
  /** Hadith page link; "{n}" becomes the hadith number. Empty for no links. */
  hadithHref?: string;
  /** Narrator page link; "{id}" becomes the Taqrib number. Empty for no links. */
  narratorHref?: string;
  /** Links shown under the wordmark. */
  nav?: NavLink[];
  /** Client-side navigation for internal links (router.push). */
  navigate?: (href: string) => void;
};

type XY = [number, number];
type CityView = City & { xy: XY };
type ArcDatum = Flow & { key: string; a: CityView; b: CityView };
type Comet = { key: string; t: number; speed: number };
type Mode = "gen" | "city" | "list" | "journey";
type Placed = { n: JourneyNode; i: number; c: CityView | null; k: number };
type Located = Placed & { c: CityView };
type Segment = { a: Located; b: Located; key: string };

// cities whose names stay visible at every zoom level
const MAJOR = new Set(["madina", "makka", "kufa", "basra", "baghdad", "dimashq", "misr", "marw", "bukhara", "sanaa"]);
// side of the dot where each name is written
const PLACE: Record<string, "e" | "w" | "n" | "s"> = {
  madina: "e", makka: "w", taif: "e", yamama: "e", sanaa: "w", yaman: "s", kufa: "w", basra: "s", baghdad: "n",
  wasit: "e", mosul: "n", jazira: "n", harran: "w", sham: "n", dimashq: "w", hims: "w", quds: "e", ramla: "n",
  asqalan: "w", ayla: "s", misr: "w", tinnis: "n", rayy: "n", isfahan: "s", khurasan: "n", naysabur: "n",
  marw: "n", harat: "s", balkh: "e", baghlan: "s", bukhara: "n",
};
const ANCHOR = { e: "end", w: "start", n: "middle", s: "middle" } as const;
const DX = { e: 9, w: -9, n: 0, s: 0 } as const;
const DY = { e: 5, w: 5, n: -10, s: 21 } as const;
const BAND_VAR: Record<Band, string> = {
  sahabi: "--sm-mughra", thiqa: "--sm-zinjar", saduq: "--sm-zaytun", maqbul: "--sm-ramad",
  daif: "--sm-zinjafr", none: "--sm-midad-soft", unknown: "--sm-midad-soft",
};
const ICON_PLAY = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M11 1.5v11L2.5 7z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z"/></svg>`;
const CORNER = `<path d="M0-10 3-3 10 0 3 3 0 10-3 3-10 0-3-3Z"/><circle r="2"/>`;

function markup(nav: NavLink[], cooperative: boolean, hint: string): string {
  const links = nav.length
    ? `<nav class="sm-nav" aria-label="أقسام الموقع">${nav
        .map((l) => `<a href="${esc(l.href)}"${l.href.startsWith("/") ? " data-internal" : ""}>${esc(l.label)}</a>`)
        .join("")}</nav>`
    : "";
  return `
<div class="sm-stage${cooperative ? " sm-coop" : ""}${nav.length ? " sm-has-nav" : ""}">
  <svg class="sm-svg" role="application" aria-label="خريطة تفاعلية لمواطن رواة الحديث: اسحب لتحريكها، وكبّر بالعجلة أو بالأصابع، واضغط على مدينة لتفاصيلها">
    <g class="sm-world">
      <rect class="sm-sea" x="-4000" y="-4000" width="9000" height="9000"></rect>
      <path class="sm-grat"></path>
      <path class="sm-land sm-land-outer"></path>
      <path class="sm-land sm-land-inner"></path>
      <path class="sm-coast"></path>
      <path class="sm-lakes"></path>
      <path class="sm-rivers"></path>
    </g>
    <g class="sm-overlay">
      <g class="sm-geolabels"></g>
      <g class="sm-arcs"></g>
      <g class="sm-particles"></g>
      <g class="sm-cities"></g>
      <g class="sm-journey"></g>
    </g>
  </svg>
  <div class="sm-band" aria-hidden="true"></div>
  <div class="sm-frame" aria-hidden="true">
    <svg class="sm-c1" viewBox="-11 -11 22 22">${CORNER}</svg>
    <svg class="sm-c2" viewBox="-11 -11 22 22">${CORNER}</svg>
    <svg class="sm-c3" viewBox="-11 -11 22 22">${CORNER}</svg>
    <svg class="sm-c4" viewBox="-11 -11 22 22">${CORNER}</svg>
  </div>
  <header class="sm-masthead">
    <h1 class="sm-wordmark">سَنَد</h1>
    <p class="sm-tagline">رجال صحيح البخاري في الزمان والمكان</p>
    ${links}
  </header>
  <div class="sm-tools">
    <div class="sm-zoom" role="group" aria-label="التكبير">
      <button type="button" data-zoom="in" aria-label="تكبير">+</button>
      <button type="button" data-zoom="out" aria-label="تصغير">−</button>
      <button type="button" data-zoom="reset" aria-label="إعادة الخريطة إلى وضعها">⟲</button>
    </div>
    <button type="button" class="sm-journey-btn">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="2.5" cy="11.5" r="2" fill="currentColor"/><circle cx="11.5" cy="2.5" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.6 10.2C5 6 8 8 10.4 3.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 2"/></svg>
      تتبّع رحلة حديث
    </button>
  </div>
  <svg class="sm-compass" viewBox="-32 -42 64 76" aria-hidden="true">
    <text x="0" y="-30" text-anchor="middle">الشمال</text>
    <path d="M0-24 7-7 24 0 7 7 0 24-7 7-24 0-7-7Z"/>
    <path d="M-17-17 0-10 17-17 10 0 17 17 0 10-17 17-10 0Z" opacity=".55"/>
    <path class="sm-north" d="M0-24 4-6H-4Z"/>
  </svg>
  <aside class="sm-panel" aria-label="تفاصيل"></aside>
  <nav class="sm-timeline" aria-label="الطبقات">
    <button type="button" class="sm-play"></button>
    <div class="sm-gens"><div class="sm-progress"></div></div>
  </nav>
  <div class="sm-hint" aria-hidden="true">${esc(hint)}</div>
  <div class="sm-tip" hidden></div>
  <p class="sm-sr" aria-live="polite"></p>
</div>`;
}

export function mountSanadMap(
  root: HTMLElement,
  DATA: MapData,
  GEO: Geometry,
  opts: SanadMapOptions = {},
): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const cooperative = Boolean(opts.cooperative);
  const nav = opts.nav ?? [];
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const startHint = cooperative
    ? touch
      ? "حرّك الخريطة بإصبعين، واضغط على أي مدينة لترى رجالها"
      : `اسحب الخريطة، وكبّرها بـ${mac ? "⌘" : "Ctrl"} مع العجلة، واضغط على أي مدينة`
    : "اسحب الخريطة وكبّرها، واضغط على أي مدينة لترى رجالها";

  const holder = document.createElement("div");
  holder.innerHTML = markup(nav, cooperative, startHint);
  const stage = holder.firstElementChild as HTMLDivElement;
  root.appendChild(stage);

  function el<T extends Element>(selector: string): T {
    const found = stage.querySelector<T>(selector);
    if (!found) throw new Error(`sanad-map: missing ${selector}`);
    return found;
  }

  const svgEl = el<SVGSVGElement>(".sm-svg");
  const svg = select(svgEl);
  const world = select(el<SVGGElement>(".sm-world"));
  const overlay = select(el<SVGGElement>(".sm-overlay"));
  const arcLayer = select(el<SVGGElement>(".sm-arcs"));
  const particleLayer = select(el<SVGGElement>(".sm-particles"));
  const journeyLayer = select(el<SVGGElement>(".sm-journey"));
  const panel = el<HTMLElement>(".sm-panel");
  const tip = el<HTMLDivElement>(".sm-tip");
  const hint = el<HTMLDivElement>(".sm-hint");
  const live = el<HTMLParagraphElement>(".sm-sr");
  const timeline = el<HTMLElement>(".sm-timeline");
  const gensEl = el<HTMLDivElement>(".sm-gens");
  const progress = el<HTMLDivElement>(".sm-progress");
  const playBtn = el<HTMLButtonElement>(".sm-play");

  const hadithHref = (n: number) => (opts.hadithHref ? opts.hadithHref.replace("{n}", String(n)) : "");
  const narratorHref = (id: string) =>
    opts.narratorHref ? opts.narratorHref.replace("{id}", encodeURIComponent(id)) : "";
  const personName = (name: string, id: string | undefined, cls = "sm-who") => {
    const href = id ? narratorHref(id) : "";
    return href
      ? `<a class="${cls}" href="${esc(href)}" data-internal>${esc(name)}</a>`
      : `<span class="${cls}">${esc(name)}</span>`;
  };

  // ---------------------------------------------------------------- state
  let dead = false;
  let transform: ZoomTransform = zoomIdentity;
  let gen = 1;
  let mode: Mode = "gen";
  let selected: string | null = null;
  let playing = false;
  let playTimer = 0;
  let autoplayTimer = 0;
  let hintTimer = 0;
  let flashTimer = 0;
  let onScreen = true;

  const cities: CityView[] = DATA.cities.flatMap((c) => {
    const xy = GEO.cities[c.id];
    return xy ? [{ ...c, xy }] : [];
  });
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const homePoints = cities.filter((c) => !c.region).map((c) => c.xy);
  const spreadOf = (t: number, c: string) => DATA.spread[t]?.[c] ?? 0;
  const radius = (n: number) => (n ? 3 + 1.7 * Math.sqrt(n) : 0);
  const sx = (p: XY) => transform.applyX(p[0]);
  const sy = (p: XY) => transform.applyY(p[1]);

  // ---------------------------------------------------------------- base map
  select(el<SVGPathElement>(".sm-land-outer")).attr("d", GEO.landOuter);
  select(el<SVGPathElement>(".sm-land-inner")).attr("d", GEO.land);
  select(el<SVGPathElement>(".sm-coast")).attr("d", GEO.coast);
  select(el<SVGPathElement>(".sm-lakes")).attr("d", GEO.lakes);
  select(el<SVGPathElement>(".sm-rivers")).attr("d", GEO.rivers);
  select(el<SVGPathElement>(".sm-grat")).attr("d", GEO.grat);

  const geoLabels = select(el<SVGGElement>(".sm-geolabels"))
    .selectAll<SVGTextElement, GeoLabel>("text")
    .data(GEO.labels)
    .join("text")
    .attr("class", (d) => "sm-geo-label " + (d.kind === "sea" ? "sm-sea-l" : "sm-river-l"))
    .attr("text-anchor", "middle")
    .text((d) => d.text);

  // ---------------------------------------------------------------- cities
  const cityG = select(el<SVGGElement>(".sm-cities"))
    .selectAll<SVGGElement, CityView>("g.sm-city")
    .data(cities, (d) => d.id)
    .join((enter) => {
      const g = enter
        .append("g")
        .attr("class", (d) => "sm-city" + (d.region ? " sm-region" : ""))
        .attr("tabindex", 0)
        .attr("role", "button");
      g.append("circle").attr("class", "sm-pulse").attr("r", 8);
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

  cityG
    .on("click", (e: MouseEvent, d) => {
      e.stopPropagation();
      openCity(d.id);
    })
    .on("keydown", (e: KeyboardEvent, d) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCity(d.id);
      }
    })
    .on("mouseenter", (e: MouseEvent, d) => {
      showTip(e, d);
      if (mode !== "journey") setFocus(d.id);
    })
    .on("mousemove", (e: MouseEvent, d) => showTip(e, d))
    .on("mouseleave", () => {
      hideTip();
      if (mode !== "journey") setFocus(selected);
    })
    .on("focus", () => {
      cityG.classed("sm-hidden-label", false);
    });

  function showTip(e: MouseEvent, d: CityView) {
    const n = spreadOf(gen, d.id);
    const top = DATA.top[gen]?.[d.id]?.[0];
    tip.innerHTML =
      `<strong>${esc(d.name)}</strong>` +
      (n ? `${esc(count(n, "rawi"))} في الطبقة ${ORD[gen]}` : `لا رواة لها في الطبقة ${ORD[gen]}`) +
      (top ? `<br>أشهرهم: ${esc(top.n)}` : "");
    tip.hidden = false;
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = `${Math.min(Math.max(12, x - w / 2), r.width - w - 12)}px`;
    tip.style.top = `${y - h - 16 < 12 ? y + 20 : y - h - 16}px`;
  }
  function hideTip() {
    tip.hidden = true;
  }

  // ---------------------------------------------------------------- arcs
  function arcD(a: CityView, b: CityView, bend = 0.2) {
    const x1 = sx(a.xy), y1 = sy(a.xy), x2 = sx(b.xy), y2 = sy(b.xy);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const cx = (x1 + x2) / 2 - (dy / len) * len * bend;
    const cy = (y1 + y2) / 2 + (dx / len) * len * bend;
    return `M${x1.toFixed(1)},${y1.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  const arcWidth = (n: number) => 0.7 + 1.35 * Math.log10(n + 1);
  const baseOpacity = (d: ArcDatum) => Math.min(0.85, 0.32 + 0.13 * Math.log10(d.n + 1));
  let arcData: ArcDatum[] = [];
  let focusCity: string | null = null; // city whose links are highlighted (hover or selection)
  function arcOpacity(d: ArcDatum) {
    if (!focusCity) return baseOpacity(d);
    return d.from === focusCity || d.to === focusCity ? 0.95 : 0.07;
  }
  function setFocus(id: string | null) {
    focusCity = id;
    arcLayer.selectAll<SVGPathElement, ArcDatum>("path.sm-arc").style("opacity", arcOpacity);
  }

  function drawArcs(animate: boolean) {
    arcData = (DATA.flows[gen] ?? [])
      .flatMap((f) => {
        const a = cityById.get(f.from);
        const b = cityById.get(f.to);
        return a && b ? [{ ...f, key: `${f.from}>${f.to}`, a, b }] : [];
      })
      .slice(0, 36);
    const sel = arcLayer.selectAll<SVGPathElement, ArcDatum>("path.sm-arc").data(arcData, (d) => d.key);
    sel.exit().interrupt().transition().duration(reduced ? 0 : 400).style("opacity", 0).remove();
    const entered = sel.enter().append("path").attr("class", "sm-arc");
    entered
      .merge(sel)
      .attr("d", (d) => arcD(d.a, d.b))
      .attr("stroke-width", (d) => arcWidth(d.n))
      .style("opacity", arcOpacity);
    if (animate && !reduced) {
      entered.each(function (_d, i) {
        const L = this.getTotalLength();
        select(this)
          .attr("stroke-dasharray", `${L} ${L}`)
          .attr("stroke-dashoffset", L)
          .transition()
          .delay(i * 30)
          .duration(900)
          .ease(easeCubicOut)
          .attr("stroke-dashoffset", 0)
          .on("end", function () {
            select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
          });
      });
    }
    setupParticles();
  }

  // comets ride the busiest arcs: a head and three fading beads
  let particles: Comet[] = [];
  let rafId = 0;
  let lastT = 0;
  function setupParticles() {
    if (reduced) return;
    particles = arcData.slice(0, 14).map((d, i) => ({
      key: d.key,
      t: (i * 0.137) % 1,
      speed: 0.2 + 0.05 * Math.log10(d.n + 1),
    }));
    particleLayer
      .selectAll<SVGGElement, Comet>("g.sm-comet")
      .data(particles, (p) => p.key)
      .join((enter) => {
        const g = enter.append("g").attr("class", "sm-comet");
        [3.4, 2.6, 1.9, 1.3].forEach((r, i) =>
          g
            .append("circle")
            .attr("class", "sm-particle")
            .attr("r", r)
            .attr("data-lag", i)
            .style("opacity", [1, 0.55, 0.32, 0.16][i]),
        );
        return g;
      });
    startLoop();
  }
  function startLoop() {
    if (reduced || dead || rafId || !onScreen || document.hidden || !particles.length) return;
    lastT = performance.now();
    rafId = requestAnimationFrame(tick);
  }
  function tick(now: number) {
    rafId = 0;
    if (dead) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const paths = new Map<string, SVGPathElement>();
    arcLayer.selectAll<SVGPathElement, ArcDatum>("path.sm-arc").each(function (d) {
      paths.set(d.key, this);
    });
    particleLayer.selectAll<SVGGElement, Comet>("g.sm-comet").each(function (p) {
      const path = paths.get(p.key);
      const offFocus = focusCity !== null && !p.key.split(">").includes(focusCity);
      if (!path || mode === "journey" || offFocus) {
        this.setAttribute("opacity", "0");
        return;
      }
      p.t = (p.t + dt * p.speed) % 1;
      const L = path.getTotalLength();
      this.setAttribute("opacity", Math.min(1, Math.sin(Math.PI * p.t) * 1.6).toFixed(2));
      for (const c of Array.from(this.children) as SVGCircleElement[]) {
        const t = Math.max(0, p.t - Number(c.dataset.lag) * 0.018);
        const pt = path.getPointAtLength(t * L);
        c.setAttribute("cx", pt.x.toFixed(1));
        c.setAttribute("cy", pt.y.toFixed(1));
      }
    });
    if (!document.hidden && onScreen) rafId = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- placement on zoom
  function place() {
    const k = transform.k;
    cityG.attr("transform", (d) => `translate(${sx(d.xy).toFixed(1)},${sy(d.xy).toFixed(1)})`);
    cityG.classed("sm-hidden-label", (d) => {
      if (d.id === selected) return false;
      if (journeyCities.has(d.id)) return false;
      if (mode === "journey") return true;
      if (d.region) return k < 1.3 && !spreadOf(gen, d.id);
      if (MAJOR.has(d.id)) return false;
      if (k >= 2.2) return false;
      return spreadOf(gen, d.id) < 12;
    });
    cityG
      .filter((d) => Boolean(d.region))
      .select<SVGTextElement>(".sm-label")
      .attr("y", (d) => (journeyCities.has(d.id) ? 30 : 6));
    geoLabels.attr(
      "transform",
      (d) =>
        `translate(${transform.applyX(d.x).toFixed(1)},${transform.applyY(d.y).toFixed(1)}) rotate(${d.rotate ?? 0})`,
    );
    arcLayer.selectAll<SVGPathElement, ArcDatum>("path.sm-arc").attr("d", (d) => arcD(d.a, d.b));
    placeJourney(false);
  }

  // ---------------------------------------------------------------- zoom
  const zoom = d3zoom<SVGSVGElement, unknown>()
    // measured from the box, so a hidden map (display: none) never throws
    .extent(() => [
      [0, 0],
      [Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight)],
    ])
    .scaleExtent([0.3, 12])
    .translateExtent([
      [-700, -520],
      [GEO.W + 700, GEO.H + 520],
    ])
    .on("start", (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
      if (!e.sourceEvent) return;
      hideTip();
      dismissHint();
    })
    .on("zoom", (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
      transform = e.transform;
      world.attr("transform", transform.toString());
      place();
    });
  if (cooperative) {
    zoom.filter((event: Event) => {
      if (event.type === "wheel") {
        const w = event as WheelEvent;
        if (w.ctrlKey || w.metaKey) return true;
        flashHint(`للتكبير: ${mac ? "⌘" : "Ctrl"} مع عجلة الفأرة`);
        return false;
      }
      if (event.type.startsWith("touch")) {
        const t = event as TouchEvent;
        if (t.touches.length >= 2) return true;
        if (event.type === "touchstart") flashHint("استعمل إصبعين لتحريك الخريطة");
        return false;
      }
      const m = event as MouseEvent;
      return !m.ctrlKey && !m.button;
    });
  }
  svg.call(zoom);
  svg.on("click", () => {
    if (mode === "city") showGen();
  });

  function viewBox() {
    const r = stage.getBoundingClientRect();
    const narrow = r.width <= 860;
    const panelW = narrow ? 0 : panel.offsetWidth + 50;
    const panelH = narrow ? r.height * (mode === "journey" ? 0.42 : 0.46) : 0;
    const top = narrow ? (nav.length ? 170 : 150) : 120;
    return {
      x0: narrow ? 16 : 40,
      x1: narrow ? r.width - 16 : r.width - panelW,
      y0: top,
      y1: narrow ? r.height - panelH - (mode === "journey" ? 30 : 70) : r.height - 120,
    };
  }
  function fitTo(points: XY[], pad = 30, duration = 0, extraLeft = 0, maxK = 12, inset = 0) {
    const v = viewBox();
    v.x0 += extraLeft + inset;
    v.x1 -= inset;
    v.y0 += inset * 0.6;
    v.y1 -= inset * 0.6;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const bx0 = Math.min(...xs) - pad, bx1 = Math.max(...xs) + pad;
    const by0 = Math.min(...ys) - pad, by1 = Math.max(...ys) + pad;
    const fit = Math.min((v.x1 - v.x0) / (bx1 - bx0), (v.y1 - v.y0) / (by1 - by0));
    const k = Math.max(0.3, Math.min(maxK, fit));
    const tx = (v.x0 + v.x1) / 2 - (k * (bx0 + bx1)) / 2;
    const ty = (v.y0 + v.y1) / 2 - (k * (by0 + by1)) / 2;
    const t = zoomIdentity.translate(tx, ty).scale(k);
    if (duration && !reduced) svg.transition().duration(duration).ease(easeCubicInOut).call(zoom.transform, t);
    else svg.call(zoom.transform, t);
  }
  const home = (duration = 0) => fitTo(homePoints, 26, duration);

  el<HTMLButtonElement>("[data-zoom='in']").addEventListener("click", () =>
    zoom.scaleBy(svg.transition().duration(reduced ? 0 : 350), 1.6),
  );
  el<HTMLButtonElement>("[data-zoom='out']").addEventListener("click", () =>
    zoom.scaleBy(svg.transition().duration(reduced ? 0 : 350), 1 / 1.6),
  );
  el<HTMLButtonElement>("[data-zoom='reset']").addEventListener("click", () => home(700));

  // ---------------------------------------------------------------- generations
  for (let n = 1; n <= 12; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sm-gen";
    b.dataset.n = String(n);
    b.style.gridColumn = String(n);
    b.setAttribute("aria-label", `الطبقة ${ORD[n]}`);
    b.innerHTML = `<span class="sm-g-d"></span><b>${n}</b>`;
    b.addEventListener("click", () => {
      stopPlay();
      setGen(n, true);
    });
    gensEl.appendChild(b);
  }
  const eras = document.createElement("div");
  eras.className = "sm-eras";
  eras.innerHTML = `<span>قبل 100هـ</span><span>بعد 100هـ</span><span>بعد 200هـ</span>`;
  gensEl.appendChild(eras);

  function setGen(n: number, animate: boolean) {
    gen = n;
    gensEl.querySelectorAll<HTMLButtonElement>(".sm-gen").forEach((b) => {
      const k = Number(b.dataset.n);
      b.classList.toggle("sm-on", k === n);
      b.classList.toggle("sm-past", k < n);
      if (k === n) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    const first = gensEl.querySelector<HTMLElement>(".sm-gen");
    if (first) {
      const span = gensEl.getBoundingClientRect().width - first.getBoundingClientRect().width;
      progress.style.width = `${((n - 1) / 11) * span}px`;
    }
    cityG
      .select<SVGCircleElement>(".sm-bubble")
      .transition()
      .duration(animate && !reduced ? 750 : 0)
      .ease(easeCubicOut)
      .attr("r", (d) => radius(spreadOf(n, d.id)));
    const local = DATA.local[n] ?? {};
    cityG.classed("sm-empty", (d) => !spreadOf(n, d.id) && !d.region);
    cityG
      .classed("sm-local", (d) => (local[d.id] ?? 0) >= 20 && !reduced)
      .attr("aria-label", (d) => `${d.name}: ${count(spreadOf(n, d.id), "rawi")} في الطبقة ${ORD[n]}`);
    drawArcs(animate);
    place();
    if (mode === "gen") renderGen(animate);
    if (mode === "city" && selected) renderCity(selected);
    if (!playing) {
      const T = DATA.tabaqat[n - 1];
      live.textContent = `الطبقة ${ORD[n]}: ${count(T.narrators, "rawi")} في ${count(T.cities, "balad")}`;
    }
  }

  // ---------------------------------------------------------------- panel: generation
  const shown = { n: 0, l: 0 };
  function countUp(numEl: HTMLElement | null, wordEl: HTMLElement | null, key: "n" | "l", noun: Noun, to: number) {
    if (!numEl || !wordEl) return;
    const paint = (v: number) => {
      numEl.textContent = fmt(v);
      wordEl.textContent = words(v, noun);
    };
    const from = shown[key];
    shown[key] = to;
    if (reduced || from === to) {
      paint(to);
      return;
    }
    select(numEl)
      .transition()
      .duration(650)
      .tween("text", () => {
        const i = interpolateRound(from, to);
        return (t: number) => paint(i(t));
      });
  }
  function renderGen(animate: boolean) {
    const T = DATA.tabaqat[gen - 1];
    const ranked = Object.entries(DATA.spread[gen] ?? {}).sort((a, b) => b[1] - a[1]);
    const top4 = ranked.slice(0, 4);
    const max = top4.length ? top4[0][1] : 1;
    const quote = T.example ? `${T.title}، ${T.example}` : T.title;
    panel.innerHTML = `
      <button type="button" class="sm-sheet-toggle" aria-label="إظهار اللوحة أو إخفاؤها"></button>
      <h2 class="sm-title">الطبقة ${ORD[gen]}</h2>
      <blockquote class="sm-quote">«${esc(quote)}»<cite>ابن حجر، مقدمة تقريب التهذيب</cite></blockquote>
      <div class="sm-chips"><span class="sm-chip sm-era">${esc(T.era)}</span></div>
      <p class="sm-big"><b data-k="n">${fmt(shown.n)}</b> <span data-w="n">${esc(words(shown.n, "rawi"))}</span> في <b>${fmt(T.cities)}</b> ${esc(words(T.cities, "balad"))}
        <small>من رجال الكتب الستة في تقريب التهذيب</small></p>
      <p class="sm-big"><b data-k="l">${fmt(shown.l)}</b> <span data-w="l">${esc(words(shown.l, "sila"))}</span> بين شيخ وتلميذه
        <small>في أسانيد صحيح البخاري، في هذه الطبقة</small></p>
      <div>
        <h3 class="sm-section-h">أكثر البلدان رواةً</h3>
        <ul class="sm-bars">${top4
          .map(
            ([c, n]) => `
          <li><button type="button" data-city="${esc(c)}">${esc(cityById.get(c)?.name ?? c)}</button><span class="sm-bar"><i style="width:${((100 * n) / max).toFixed(0)}%"></i></span><span class="sm-n">${fmt(n)}</span></li>`,
          )
          .join("")}
        </ul>
      </div>
      <p class="sm-note">الدوائر الذهبية: رواة الطبقة في كل بلد، من رجال الكتب الستة في تقريب التهذيب ممن تدل نسبتهم على بلد. الخطوط الحمراء: انتقال الرواية من بلد الشيخ إلى بلد تلميذه في أسانيد صحيح البخاري.</p>`;
    const q = <T extends HTMLElement>(s: string) => panel.querySelector<T>(s);
    if (!animate) {
      shown.n = T.narrators;
      shown.l = T.links;
    }
    countUp(q('[data-k="n"]'), q('[data-w="n"]'), "n", "rawi", T.narrators);
    countUp(q('[data-k="l"]'), q('[data-w="l"]'), "l", "sila", T.links);
    panel.querySelectorAll<HTMLButtonElement>("[data-city]").forEach((b) =>
      b.addEventListener("click", () => openCity(b.dataset.city ?? "")),
    );
    wireSheet();
  }

  // ---------------------------------------------------------------- panel: city
  function openCity(id: string) {
    if (mode === "journey" || !cityById.has(id)) return;
    stopPlay();
    dismissHint();
    hideTip();
    selected = id;
    mode = "city";
    cityG.classed("sm-selected", (d) => d.id === id);
    setFocus(id);
    renderCity(id);
    place();
    setCollapsed(false);
  }
  function renderCity(id: string) {
    const c = cityById.get(id);
    if (!c) return;
    const n = spreadOf(gen, id);
    const people = DATA.top[gen]?.[id] ?? [];
    const series = Array.from({ length: 12 }, (_, i) => spreadOf(i + 1, id));
    const smax = Math.max(1, ...series);
    const flows = DATA.flows[gen] ?? [];
    const inbound = flows.filter((f) => f.to === id).slice(0, 5);
    const outbound = flows.filter((f) => f.from === id).slice(0, 5);
    const list = (arr: Flow[], key: "from" | "to") =>
      arr.map((f) => `<b>${esc(cityById.get(f[key])?.name ?? f[key])}</b> (${fmt(f.n)})`).join("، ");
    panel.innerHTML = `
      <button type="button" class="sm-sheet-toggle" aria-label="إظهار اللوحة أو إخفاؤها"></button>
      <button type="button" class="sm-back">→ عودة إلى الطبقة ${ORD[gen]}</button>
      <h2 class="sm-title">${esc(c.name)}</h2>
      ${c.region ? `<div class="sm-chips"><span class="sm-chip">إقليم</span></div>` : ""}
      <p class="sm-big">${n ? `<b>${fmt(n)}</b> ${esc(words(n, "rawi"))}` : "لا رواة"} في الطبقة ${ORD[gen]}
        <small>من رجال الكتب الستة في تقريب التهذيب ممن تدل نسبتهم على ${c.region ? "هذا الإقليم" : "هذا البلد"}</small></p>
      <div>
        <h3 class="sm-section-h">رواتها في الطبقات الاثنتي عشرة</h3>
        <div class="sm-spark">${series
          .map(
            (v, i) => `
          <button type="button" class="${i + 1 === gen ? "sm-on" : ""}" data-gen="${i + 1}" aria-label="الطبقة ${ORD[i + 1]}: ${esc(count(v, "rawi"))}"><i style="height:${Math.max(2, (40 * v) / smax).toFixed(0)}px"></i><b>${i + 1}</b></button>`,
          )
          .join("")}
        </div>
      </div>
      ${
        people.length
          ? `
      <div>
        <h3 class="sm-section-h">أشهر رجالها في هذه الطبقة</h3>
        <p class="sm-note sm-plain" style="margin:2px 0 10px">مرتبون بعدد ورودهم في أسانيد البخاري، مع حكم ابن حجر.</p>
        <ul class="sm-people">${people
          .map(
            (p) => `
          <li><span class="sm-dara sm-full sm-b-${p.b}" aria-hidden="true"></span><div>${personName(p.n, p.id)}
          <div class="sm-meta">${p.v ? `<span class="sm-v">${esc(p.v)}</span>، ` : ""}${p.d ? `ت ${p.d}هـ، ` : ""}في ${esc(count(p.c, "sanad"))}${p.m ? "، موطنه من المشهور في التراجم" : ""}</div></div></li>`,
          )
          .join("")}
        </ul>
      </div>`
          : `<p class="sm-note sm-plain">لم يرد من رجال هذه الطبقة فيها أحد في أسانيد البخاري.</p>`
      }
      ${
        inbound.length || outbound.length
          ? `
      <div>
        <h3 class="sm-section-h">صلات الرواية في هذه الطبقة</h3>
        ${inbound.length ? `<p class="sm-flows">أخذ رواتها عن شيوخ من ${list(inbound, "from")}.</p>` : ""}
        ${outbound.length ? `<p class="sm-flows">وأخذ عن شيوخها رواة من ${list(outbound, "to")}.</p>` : ""}
      </div>`
          : ""
      }`;
    panel.querySelector(".sm-back")?.addEventListener("click", showGen);
    panel.querySelectorAll<HTMLButtonElement>("[data-gen]").forEach((b) =>
      b.addEventListener("click", () => setGen(Number(b.dataset.gen), true)),
    );
    wireSheet();
  }
  function showGen() {
    mode = "gen";
    selected = null;
    cityG.classed("sm-selected", false);
    setFocus(null);
    renderGen(false);
    place();
  }

  // ---------------------------------------------------------------- play
  function setPlayIcon() {
    playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute("aria-label", playing ? "إيقاف" : "تشغيل الطبقات");
  }
  function startPlay(stopAt = 12) {
    if (mode === "journey") return;
    if (mode !== "gen") showGen();
    playing = true;
    setPlayIcon();
    if (gen >= stopAt) setGen(1, true);
    window.clearInterval(playTimer);
    playTimer = window.setInterval(() => {
      if (gen >= stopAt) {
        stopPlay();
        return;
      }
      setGen(gen + 1, true);
    }, 1700);
  }
  function stopPlay() {
    playing = false;
    window.clearInterval(playTimer);
    setPlayIcon();
  }
  playBtn.addEventListener("click", () => (playing ? stopPlay() : startPlay()));
  setPlayIcon();

  function onKey(e: KeyboardEvent) {
    if (mode === "journey" || e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.activeElement;
    if (active && active !== document.body && !stage.contains(active)) return;
    if (e.key === "ArrowLeft" && gen < 12) {
      stopPlay();
      setGen(gen + 1, true);
    }
    if (e.key === "ArrowRight" && gen > 1) {
      stopPlay();
      setGen(gen - 1, true);
    }
  }
  document.addEventListener("keydown", onKey);

  // ---------------------------------------------------------------- hint
  hintTimer = window.setTimeout(dismissHint, 9000);
  function dismissHint() {
    hint.classList.add("sm-gone");
    window.clearTimeout(hintTimer);
  }
  function flashHint(text: string) {
    hint.textContent = text;
    hint.classList.remove("sm-gone");
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => hint.classList.add("sm-gone"), 1600);
  }

  // ---------------------------------------------------------------- bottom sheet on phones
  function setCollapsed(on: boolean) {
    panel.classList.toggle("sm-collapsed", on);
    timeline.classList.toggle("sm-low", on);
  }
  function wireSheet() {
    panel.querySelector(".sm-sheet-toggle")?.addEventListener("click", () =>
      setCollapsed(!panel.classList.contains("sm-collapsed")),
    );
  }

  // ---------------------------------------------------------------- journeys
  let journey: Journey | null = null;
  let jStep = -1;
  let jTimer = 0;
  let jPlaying = false;
  let jVisible = 0;
  let jNodes: Placed[] = [];
  let journeyCities = new Set<string>();
  const homeOf = (node: JourneyNode) => (node.city ? cityById.get(node.city) ?? null : null);
  function haversine(a: City, b: City) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function journeyPlaces(j: Journey) {
    const seq: CityView[] = [];
    for (const node of j.nodes) {
      const c = homeOf(node);
      if (c && seq[seq.length - 1] !== c) seq.push(c);
    }
    return seq;
  }

  el<HTMLButtonElement>(".sm-journey-btn").addEventListener("click", () => {
    stopPlay();
    dismissHint();
    openJourneyList();
  });
  function openJourneyList() {
    if (mode === "journey") endJourney(false);
    mode = "list";
    selected = null;
    cityG.classed("sm-selected", false);
    setFocus(null);
    setCollapsed(false);
    const allReach = DATA.journeys.every((j) => j.prophet);
    panel.innerHTML = `
      <button type="button" class="sm-sheet-toggle" aria-label="إظهار اللوحة أو إخفاؤها"></button>
      <button type="button" class="sm-back">→ عودة إلى الطبقات</button>
      <div><div class="sm-kicker">أحاديث مختارة</div><h2 class="sm-title">تتبّع رحلة حديث</h2></div>
      <p class="sm-note sm-plain" style="font-size:13.5px">اختر حديثاً لترى رجال سنده واحداً بعد واحد، ${allReach ? "من النبي ﷺ" : "من أوله"} إلى البخاري، في مواطنهم على الخريطة.</p>
      <ul class="sm-j-list">${DATA.journeys
        .map((j, i) => {
          const places = journeyPlaces(j).map((c) => c.name).join(" ← ");
          return `<li><button type="button" class="sm-j-card" data-j="${i}"><q>${esc(j.title)}</q><small>صحيح البخاري، رقم ${j.number}، ${esc(count(j.nodes.length, "rajul"))}</small><small>${esc(places)}</small></button></li>`;
        })
        .join("")}</ul>`;
    panel.querySelector(".sm-back")?.addEventListener("click", showGen);
    panel.querySelectorAll<HTMLButtonElement>("[data-j]").forEach((b) =>
      b.addEventListener("click", () => {
        const j = DATA.journeys[Number(b.dataset.j)];
        if (j) startJourney(j);
      }),
    );
    wireSheet();
  }

  function rowsOf(j: Journey) {
    const rows: Record<string, number> = {};
    for (const n of j.nodes) if (n.city) rows[n.city] = (rows[n.city] ?? 0) + 1;
    return rows;
  }
  function frameRoute(duration: number) {
    if (!journey) return;
    const pts = journeyPlaces(journey).map((c) => c.xy);
    const longest = Math.max(1, ...Object.values(rowsOf(journey)));
    fitTo(pts.length > 1 ? pts : homePoints, 20 + (longest - 1) * 20, duration, 0, 12, 46);
  }
  function startJourney(j: Journey) {
    journey = j;
    jStep = -1;
    jVisible = 0;
    mode = "journey";
    stopPlay();
    setFocus(null);
    hideTip();
    stage.classList.add("sm-journeying");
    overlay.classed("sm-dim", true);
    journeyCities = new Set(j.nodes.map((n) => n.city).filter((c): c is string => Boolean(c)));
    cityG.classed("sm-on-route", (d) => journeyCities.has(d.id));
    renderJourneyPanel();
    renderJourneyState();
    placeJourney(false);
    place();
    frameRoute(reduced ? 0 : 1100);
    window.clearTimeout(jTimer);
    jTimer = window.setTimeout(
      () => {
        jPlaying = true;
        advance();
      },
      reduced ? 0 : 1500,
    );
  }
  function advance() {
    if (!journey) return;
    if (jStep < journey.nodes.length - 1) showStep(jStep + 1);
    else {
      jPlaying = false;
      renderJourneyControls();
    }
  }
  // earlier narrators who lived in the same city as node i
  function rowIndex(i: number) {
    if (!journey) return 0;
    const city = journey.nodes[i].city;
    return journey.nodes.slice(0, i).filter((n) => n.city === city).length;
  }
  function lastPlaceBefore(i: number) {
    if (!journey) return null;
    for (let k = i - 1; k >= 0; k--) {
      const c = homeOf(journey.nodes[k]);
      if (c) return c;
    }
    return null;
  }
  function showStep(i: number, back = false) {
    if (!journey) return;
    window.clearTimeout(jTimer);
    jStep = i;
    updateChain();
    renderJourneyControls();
    const last = i === journey.nodes.length - 1;
    const cur = homeOf(journey.nodes[i]);
    const prev = lastPlaceBefore(i);
    const camera = reduced ? 0 : 850;
    if (cur) {
      const pts = prev ? [cur.xy, prev.xy] : [cur.xy];
      fitTo(pts, 20 + rowIndex(i) * 20, camera, 0, 3, 50);
    }
    if (back) {
      jVisible = i + 1;
      renderJourneyState();
      placeJourney(false);
      const sum = panel.querySelector(".sm-j-sum");
      if (sum) sum.innerHTML = "";
      return;
    }
    jTimer = window.setTimeout(
      () => {
        jVisible = i + 1;
        renderJourneyState();
        placeJourney(true);
        if (last) {
          jTimer = window.setTimeout(
            () => {
              jPlaying = false;
              frameRoute(reduced ? 0 : 1400);
              showSummary();
              renderJourneyControls();
              placeJourney(false);
            },
            reduced ? 0 : 1000,
          );
        } else if (jPlaying) {
          jTimer = window.setTimeout(advance, reduced ? 500 : 1150);
        }
      },
      cur ? camera : 0,
    );
  }

  function renderJourneyPanel() {
    const j = journey;
    if (!j) return;
    setCollapsed(false);
    panel.classList.add("sm-journey-panel");
    const link = hadithHref(j.number);
    panel.innerHTML = `
      <button type="button" class="sm-sheet-toggle" aria-label="إظهار اللوحة أو إخفاؤها"></button>
      <button type="button" class="sm-back">→ عودة إلى الطبقات</button>
      <div><div class="sm-kicker">صحيح البخاري، رقم ${j.number}${link ? ` · <a class="sm-link" href="${esc(link)}" data-internal>صفحة الحديث</a>` : ""}</div>
      <h2 class="sm-title" style="font-size:26px">«${esc(j.title)}»</h2></div>
      <div class="sm-j-controls"></div>
      <ol class="sm-chain">
        ${j.prophet ? `<li class="sm-prophet sm-now"><span class="sm-dara sm-full sm-b-sahabi" aria-hidden="true"></span><div><div class="sm-who">النبي ﷺ</div></div></li>` : ""}
        ${j.nodes
          .map((n, i) => {
            const c = homeOf(n);
            const last = i === j.nodes.length - 1;
            const home = c ? esc(c.name) + (n.m ? "، موطنه من المشهور في التراجم" : "") : "بلده غير معروف في التقريب";
            return `<li data-i="${i}"><span class="sm-dara ${n.id ? "sm-full" : ""} sm-b-${n.b}" aria-hidden="true"></span><div>
            ${personName(n.n, last ? undefined : n.id)}${n.auto ? `<span class="sm-auto">تعرّف آلي</span>` : ""}
            <div class="sm-meta">${n.v ? `${esc(n.v)}، ` : ""}${n.d ? `ت ${n.d}هـ، ` : ""}${home}${last ? "، صاحب الصحيح" : ""}</div></div>
            ${n.tr && !last ? `<div class="sm-term">${esc(n.tr)}</div>` : ""}</li>`;
          })
          .join("")}
      </ol>
      <div class="sm-j-sum"></div>
      <p class="sm-note">تعرض الخريطة موطن كل راوٍ حسب نسبته في تقريب التهذيب، ومن لا نسبة له فبحسب المشهور في التراجم، لا المكان الذي سمع فيه الحديث. والأحكام بلفظ ابن حجر.</p>`;
    panel.querySelector(".sm-back")?.addEventListener("click", () => endJourney(true));
    renderJourneyControls();
    wireSheet();
  }
  function renderJourneyControls() {
    const box = panel.querySelector<HTMLElement>(".sm-j-controls");
    if (!box || !journey) return;
    const atEnd = jStep >= journey.nodes.length - 1 && jVisible === journey.nodes.length;
    box.innerHTML = `
      <button type="button" class="sm-btn" data-act="prev" ${jStep <= 0 ? "disabled" : ""}>السابق</button>
      <button type="button" class="sm-btn sm-primary" data-act="play">${atEnd ? "أعد الرحلة" : jPlaying ? "إيقاف" : "متابعة"}</button>
      <button type="button" class="sm-btn" data-act="next" ${atEnd ? "disabled" : ""}>التالي</button>
      <button type="button" class="sm-btn" data-act="other">حديث آخر</button>`;
    const on = (act: string, fn: () => void) =>
      box.querySelector(`[data-act="${act}"]`)?.addEventListener("click", fn);
    on("prev", () => {
      jPlaying = false;
      window.clearTimeout(jTimer);
      if (jStep > 0) showStep(jStep - 1, true);
    });
    on("next", () => {
      jPlaying = false;
      window.clearTimeout(jTimer);
      advance();
    });
    on("play", () => {
      window.clearTimeout(jTimer);
      if (atEnd && journey) {
        startJourney(journey);
        return;
      }
      jPlaying = !jPlaying;
      renderJourneyControls();
      if (jPlaying) advance();
    });
    on("other", () => {
      endJourney(false);
      openJourneyList();
    });
  }
  function updateChain() {
    panel.querySelectorAll<HTMLLIElement>(".sm-chain li[data-i]").forEach((li) => {
      const i = Number(li.dataset.i);
      li.classList.toggle("sm-now", i === jStep);
      li.classList.toggle("sm-seen", i < jStep);
    });
    const now = panel.querySelector<HTMLLIElement>(`.sm-chain li[data-i="${jStep}"]`);
    const box = panel.querySelector<HTMLElement>(".sm-chain");
    if (!now || !box) return;
    // scroll the list only, never the page
    const top = now.offsetTop - box.offsetTop;
    const bottom = top + now.offsetHeight;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    if (top < box.scrollTop) box.scrollTo({ top, behavior });
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTo({ top: bottom - box.clientHeight, behavior });
  }
  function showSummary() {
    if (!journey) return;
    const places = journeyPlaces(journey);
    let km = 0;
    for (let i = 1; i < places.length; i++) km += haversine(places[i - 1], places[i]);
    const years = journey.nodes.map((n) => n.d).filter((d): d is number => typeof d === "number");
    const noun: Noun = places.every((c) => !c.region) ? "city" : "balad";
    const box = panel.querySelector(".sm-j-sum");
    if (!box) return;
    box.innerHTML = `<div class="sm-summary">
      <div class="sm-stat"><strong>${esc(count(journey.nodes.length, "rajul"))}</strong><span>في السند</span></div>
      <div class="sm-stat"><strong>${esc(count(places.length, noun))}</strong><span>مرّ بها</span></div>
      <div class="sm-stat"><strong>${fmt(Math.round(km / 10) * 10)} كم</strong><span>تقريباً بين مواطنهم</span></div>
      ${years.length ? `<div class="sm-stat"><strong>${Math.min(...years)}–${Math.max(...years)}هـ</strong><span>سنوات الوفاة المعروفة</span></div>` : ""}
    </div>`;
    live.textContent = `انتهت الرحلة: ${count(journey.nodes.length, "rajul")} في ${count(places.length, noun)}`;
  }

  // the chain on the map, in screen space so it stays crisp at any zoom
  function renderJourneyState() {
    if (!journey) return;
    const seen = new Map<string, number>();
    jNodes = journey.nodes.slice(0, jVisible).map((n, i) => {
      const c = homeOf(n);
      if (!c) return { n, i, c: null, k: 0 };
      const k = seen.get(c.id) ?? 0;
      seen.set(c.id, k + 1);
      return { n, i, c, k };
    });
  }
  // Narrators of one city stand in a row, away from the side where the city's
  // name is written; a narrator's own name goes on the other side of the dara.
  const rowDir = (c: CityView) => (!c.region && PLACE[c.id] === "w" ? 1 : -1);
  const nameBelow = (c: CityView) => !c.region && PLACE[c.id] === "n";
  const nodeXY = (d: Located): XY => [sx(d.c.xy) + rowDir(d.c) * d.k * 20, sy(d.c.xy)];
  // separate layers keep the drawing order without re-inserting elements,
  // which would restart their entry animation
  const segLayer = journeyLayer.append("g");
  const termLayer = journeyLayer.append("g");
  const nodeLayer = journeyLayer.append("g");
  function clearJourney() {
    segLayer.selectAll("*").remove();
    termLayer.selectAll("*").remove();
    nodeLayer.selectAll("*").remove();
  }
  function placeJourney(enter: boolean) {
    const j = journey;
    if (!j || mode !== "journey") {
      clearJourney();
      return;
    }
    const located = jNodes.filter((d): d is Located => d.c !== null);
    // the narrator named on the map: the newest one drawn, so a name stays up while the camera moves
    const cur = Math.min(jStep, jVisible - 1);
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
      if (!j.nodes[s.a.i].tr || s.a.c.id === s.b.c.id) return false;
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
      .text((d) => j.nodes[d.a.i].tr);
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
    all
      .attr("transform", (d) => {
        const [x, y] = nodeXY(d);
        return `translate(${x.toFixed(1)},${y.toFixed(1)})`;
      })
      .classed("sm-current", (d) => d.i === cur);
    all.select<SVGCircleElement>("circle.sm-r").style("stroke", (d) => `var(${BAND_VAR[d.n.b]})`);
    all
      .select<SVGCircleElement>("circle.sm-d")
      .style("fill", (d) => (d.n.id ? `var(${BAND_VAR[d.n.b]})` : "transparent"));
    const done = jVisible === j.nodes.length && !jPlaying;
    const firstI = located.length ? located[0].i : -1;
    const lastI = located.length ? located[located.length - 1].i : -1;
    const withYear = (d: Located) => d.i === cur && Boolean(d.n.d);
    // name and death year sit together, above the dara or below it
    all
      .select<SVGTextElement>("text.sm-nm")
      .attr("y", (d) => (nameBelow(d.c) ? 27 : withYear(d) ? -31 : -15))
      .text((d) => (d.i === cur || (done && (d.i === firstI || d.i === lastI)) ? d.n.n : ""));
    all
      .select<SVGTextElement>("text.sm-yr")
      .attr("y", (d) => (nameBelow(d.c) ? 41 : -14))
      .text((d) => (withYear(d) ? `ت ${d.n.d}هـ` : ""));
  }

  function endJourney(toGen: boolean) {
    window.clearTimeout(jTimer);
    jPlaying = false;
    journey = null;
    jStep = -1;
    jVisible = 0;
    jNodes = [];
    journeyCities = new Set();
    clearJourney();
    overlay.classed("sm-dim", false);
    stage.classList.remove("sm-journeying");
    panel.classList.remove("sm-journey-panel");
    cityG.classed("sm-on-route", false);
    mode = "gen";
    if (toGen) {
      showGen();
      home(900);
    }
  }

  // ---------------------------------------------------------------- page events
  function onLinkClick(e: MouseEvent) {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>("a[data-internal]");
    if (!a || !opts.navigate) return;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    opts.navigate(a.getAttribute("href") ?? "/");
  }
  stage.addEventListener("click", onLinkClick);

  function onVisibility() {
    startLoop();
  }
  document.addEventListener("visibilitychange", onVisibility);

  // refit when the width changes (not when a phone's address bar slides)
  let lastW = stage.clientWidth;
  let lastH = stage.clientHeight;
  const resizer = new ResizeObserver(() => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return; // hidden, e.g. while another page is shown
    if (w === lastW && Math.abs(h - lastH) < 150) return;
    lastW = w;
    lastH = h;
    if (mode === "journey") frameRoute(0);
    else home(0);
    setGen(gen, false);
  });
  resizer.observe(stage);

  // pause the comets while the map is scrolled out of view
  const watcher = new IntersectionObserver((entries) => {
    onScreen = entries.some((x) => x.isIntersecting);
    startLoop();
  });
  watcher.observe(stage);

  // ---------------------------------------------------------------- start
  home(0);
  setGen(1, false);
  if (!reduced && opts.autoplay !== false) {
    autoplayTimer = window.setTimeout(() => {
      if (mode === "gen" && !playing) startPlay(11);
    }, 1600);
  }

  return () => {
    dead = true;
    stopPlay();
    window.clearTimeout(autoplayTimer);
    window.clearTimeout(hintTimer);
    window.clearTimeout(flashTimer);
    window.clearTimeout(jTimer);
    if (rafId) cancelAnimationFrame(rafId);
    resizer.disconnect();
    watcher.disconnect();
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVisibility);
    stage.removeEventListener("click", onLinkClick);
    svg.interrupt();
    svg.selectAll("*").interrupt();
    svg.on(".zoom", null);
    select(panel).selectAll("*").interrupt();
    stage.remove();
  };
}
