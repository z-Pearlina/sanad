// The narration map, drawn with d3 into a container element.
// React only provides the container (see SanadMap.tsx); everything inside it
// is built and owned here, and mountSanadMap returns a function that removes
// it again with all its timers and listeners.

import { pointer, select } from "d3-selection";
import { zoomIdentity, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { easeCubicOut } from "d3-ease";
import { interpolateRound } from "d3-interpolate";
import { ORD, count, esc, fmt, words, type Noun } from "./arabic";
import { ICON, NAV_ICON } from "./icons";
import { renewsIn } from "./today";
import { fetchUmmahHadith } from "@/lib/ummah";
import {
  ANCHOR, DX, DY, PLACE, WORLD_MARKUP, ZOOM_MARKUP, centerOn, cityViews, createChainLayer, createZoom, drawBase,
  fitTo as fitView, journeyPlaces, journeySummary, placeGeoLabels, placeNodes, wireZoomButtons,
  type CityView, type Placed, type XY,
} from "./core";
import { LIGHT_QUERY, PHONE_QUERY, SIDE_QUERY, createSheet, pickLabels, type Box, type Dot, type LabelItem } from "./phone";
import type { Flow, Geometry, Journey, JourneyNode, MapData, NavLink } from "./types";

export type SanadMapOptions = {
  /** Play the generations once on load (default true). */
  autoplay?: boolean;
  /** Open on this generation instead of the first. */
  startGen?: number;
  /** Open on the journey of this hadith, if it is one of the journeys. */
  startJourney?: number;
  /** «سند اليوم»: the first journey on offer. */
  today?: Journey;
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

type ArcDatum = Flow & { key: string; a: CityView; b: CityView };
type Comet = { key: string; t: number; speed: number };
type Mode = "gen" | "city" | "list" | "journey";

// cities whose names stay visible at every zoom level
const MAJOR = new Set(["madina", "makka", "kufa", "basra", "baghdad", "dimashq", "misr", "marw", "bukhara", "sanaa"]);
const CORNER = `<path d="M0-10 3-3 10 0 3 3 0 10-3 3-10 0-3-3Z"/><circle r="2"/>`;
const JOURNEY_BUTTON = `
      ${ICON.route}
      تتبّع رحلة حديث`;
const PHONE_HINT = "اسحب بإصبع، وكبّر بإصبعين، واضغط على مدينة";
const HINT_SEEN = "sanad-map-hint-seen";

function markup(nav: NavLink[], cooperative: boolean, hint: string): string {
  const links = nav.length
    ? `<nav class="sm-nav" aria-label="أقسام الموقع">${nav
        .map((l) => `<a href="${esc(l.href)}"${l.href.startsWith("/") ? " data-internal" : ""}>${l.icon ? NAV_ICON[l.icon] : ""}${esc(l.label)}</a>`)
        .join("")}</nav>`
    : "";
  return `
<div class="sm-stage${cooperative ? " sm-coop" : ""}${nav.length ? " sm-has-nav" : ""}">
  <svg class="sm-svg" role="application" aria-label="خريطة تفاعلية لمواطن رواة الحديث: اسحب لتحريكها، وكبّر بالعجلة أو بالأصابع، واضغط على مدينة لتفاصيلها">
${WORLD_MARKUP}
    <g class="sm-overlay">
      <g class="sm-geolabels"></g>
      <g class="sm-arcs"></g>
      <g class="sm-particles"></g>
      <g class="sm-cities"></g>
      <g class="sm-journey"></g>
    </g>
  </svg>
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
  <svg class="sm-compass" viewBox="-32 -42 64 76" aria-hidden="true">
    <text x="0" y="-30" text-anchor="middle">الشمال</text>
    <path d="M0-24 7-7 24 0 7 7 0 24-7 7-24 0-7-7Z"/>
    <path d="M-17-17 0-10 17-17 10 0 17 17 0 10-17 17-10 0Z" opacity=".55"/>
    <path class="sm-north" d="M0-24 4-6H-4Z"/>
  </svg>
  <div class="sm-sheet">
    <div class="sm-tools">
${ZOOM_MARKUP}
      <button type="button" class="sm-journey-btn">${JOURNEY_BUTTON}
      </button>
    </div>
    <aside class="sm-panel" aria-label="تفاصيل"></aside>
    <div class="sm-sheet-head">
      <button type="button" class="sm-sheet-toggle" aria-label="إظهار اللوحة أو إخفاؤها"></button>
      <div class="sm-sheet-row">
        <p class="sm-sheet-title" role="heading" aria-level="2"></p>
        <button type="button" class="sm-today-btn" hidden>${ICON.today}سند اليوم</button>
        <button type="button" class="sm-journey-btn">${JOURNEY_BUTTON}
        </button>
      </div>
      <div class="sm-now">
        <div class="sm-now-who"></div>
        <div class="sm-now-controls"></div>
      </div>
      <nav class="sm-timeline" aria-label="الطبقات">
        <button type="button" class="sm-play"></button>
        <div class="sm-gens"><div class="sm-progress"></div></div>
      </nav>
    </div>
  </div>
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
  const gensEl = el<HTMLDivElement>(".sm-gens");
  const progress = el<HTMLDivElement>(".sm-progress");
  const playBtn = el<HTMLButtonElement>(".sm-play");
  const citiesLayer = select(el<SVGGElement>(".sm-cities"));
  const sheetEl = el<HTMLElement>(".sm-sheet");
  const head = el<HTMLElement>(".sm-sheet-head");
  const headTitle = el<HTMLElement>(".sm-sheet-title");
  const nowWho = el<HTMLElement>(".sm-now-who");
  const nowControls = el<HTMLElement>(".sm-now-controls");
  const today = opts.today ?? null;
  const todayRow = el<HTMLButtonElement>(".sm-sheet-row .sm-today-btn");
  todayRow.hidden = !today;
  todayRow.addEventListener("click", startToday);

  // the phone layouts: a bottom sheet upright, a side column on its side (see phone.ts)
  const phoneQuery = window.matchMedia(PHONE_QUERY);
  const sideQuery = window.matchMedia(SIDE_QUERY);
  const lightQuery = window.matchMedia(LIGHT_QUERY);
  let phone = phoneQuery.matches;
  let side = sideQuery.matches;
  const upright = () => phone && !side;
  const sheet = createSheet(stage, sheetEl, head, el<HTMLElement>(".sm-sheet-toggle"), onStop);

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
  // on a phone the camera follows the generations until the visitor first touches the map
  let follow = true;
  let zoomFrame = 0;

  const cities: CityView[] = cityViews(DATA.cities, GEO);
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const homePoints = cities.filter((c) => !c.region).map((c) => c.xy);
  const spreadOf = (t: number, c: string) => DATA.spread[t]?.[c] ?? 0;
  const radius = (n: number) => (n ? 3 + 1.7 * Math.sqrt(n) : 0);
  const sx = (p: XY) => transform.applyX(p[0]);
  const sy = (p: XY) => transform.applyY(p[1]);

  // ---------------------------------------------------------------- base map
  const geoLabels = drawBase(stage, GEO);

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
      g.append("circle").attr("class", "sm-hit").attr("r", 18);
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
      openCity(phone ? nearestCity(e, d) : d.id);
    })
    .on("keydown", (e: KeyboardEvent, d) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCity(d.id);
      }
    })
    .on("mouseenter", (e: MouseEvent, d) => {
      if (touch) return;
      showTip(e, d);
      if (mode !== "journey") setFocus(d.id);
    })
    .on("mousemove", (e: MouseEvent, d) => {
      if (!touch) showTip(e, d);
    })
    .on("mouseleave", () => {
      if (touch) return;
      hideTip();
      if (mode !== "journey") setFocus(selected);
    })
    .on("focus", () => {
      cityG.classed("sm-hidden-label", false);
    });

  // touch circles overlap where cities stand close: the finger means the nearest one
  function nearestCity(e: MouseEvent, tapped: CityView) {
    const [x, y] = pointer(e, svgEl);
    const dist = (c: CityView) => Math.hypot(sx(c.xy) - x, sy(c.xy) - y);
    return cities.reduce((best, c) => (dist(c) < dist(best) ? c : best), tapped).id;
  }

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
    // a slow phone keeps its frames for the comets: the lines appear at once
    if (animate && !reduced && !lightQuery.matches) {
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
    const light = lightQuery.matches;
    particles = arcData.slice(0, light ? 6 : 14).map((d, i) => ({
      key: d.key,
      t: (i * 0.137) % 1,
      speed: 0.2 + 0.05 * Math.log10(d.n + 1),
    }));
    particleLayer
      .selectAll<SVGGElement, Comet>("g.sm-comet")
      .data(particles, (p) => p.key)
      .join((enter) => {
        const g = enter.append("g").attr("class", "sm-comet");
        (light ? [3.4, 1.9] : [3.4, 2.6, 1.9, 1.3]).forEach((r, i) =>
          g
            .append("circle")
            .attr("class", "sm-particle")
            .attr("r", r)
            .attr("data-lag", light ? i * 2 : i)
            .style("opacity", (light ? [1, 0.4] : [1, 0.55, 0.32, 0.16])[i]),
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
    // on a phone the circles grow as the map does, and the names are chosen when the gesture ends
    if (phone) citiesLayer.style("--sm-bubble-k", Math.max(0.3, Math.min(1, k / 1.3)).toFixed(3));
    else {
      cityG.classed("sm-hidden-label", (d) => {
        if (d.id === selected) return false;
        if (journeyCities.has(d.id)) return false;
        if (mode === "journey") return true;
        if (d.region) return k < 1.3 && !spreadOf(gen, d.id);
        if (MAJOR.has(d.id)) return false;
        if (k >= 2.2) return false;
        return spreadOf(gen, d.id) < 12;
      });
    }
    cityG
      .filter((d) => Boolean(d.region))
      .select<SVGTextElement>(".sm-label")
      .attr("y", (d) => (journeyCities.has(d.id) ? 30 : 6));
    placeGeoLabels(geoLabels, transform);
    arcLayer.selectAll<SVGPathElement, ArcDatum>("path.sm-arc").attr("d", (d) => arcD(d.a, d.b));
    placeJourney(false);
  }

  // ---------------------------------------------------------------- city names on a phone
  const labelBoxes = new Map<string, Box>();
  function measureLabels() {
    cityG.each(function (d) {
      const text = this.querySelector<SVGTextElement>("text.sm-label");
      if (!text) return;
      const b = text.getBBox();
      const y = d.region && journeyCities.has(d.id) ? b.y - 24 : b.y; // regions on a chain write lower down
      labelBoxes.set(d.id, { x0: b.x, y0: y, x1: b.x + b.width, y1: y + b.height });
    });
  }
  function layoutLabels() {
    if (!phone) return;
    if (!labelBoxes.size) measureLabels();
    const k = transform.k;
    const wanted = (d: CityView) => {
      if (d.id === selected || journeyCities.has(d.id)) return true;
      if (mode === "journey") return false;
      if (d.region) return k >= 1.3 || spreadOf(gen, d.id) > 0;
      return MAJOR.has(d.id) || k >= 2.2 || spreadOf(gen, d.id) > 0;
    };
    const rank = (d: CityView) => (d.id === selected ? 0 : journeyCities.has(d.id) ? 1 : MAJOR.has(d.id) ? 2 : 3);
    const items: LabelItem[] = cities
      .filter(wanted)
      .sort((a, b) => rank(a) - rank(b) || spreadOf(gen, b.id) - spreadOf(gen, a.id))
      .flatMap((d) => {
        const local = labelBoxes.get(d.id);
        if (!local) return [];
        const x = sx(d.xy);
        const y = sy(d.xy) + (d.region && journeyCities.has(d.id) ? 24 : 0);
        return [{ id: d.id, force: d.id === selected, box: { x0: x + local.x0, y0: y + local.y0, x1: x + local.x1, y1: y + local.y1 } }];
      });
    const dots: Dot[] = cities.filter((c) => !c.region).map((c) => ({ id: c.id, x: sx(c.xy), y: sy(c.xy) }));
    const v = viewBox();
    const shown = pickLabels(items, dots, { x0: 0, y0: v.y0 - 14, x1: v.x1 + 14, y1: stage.clientHeight - (upright() ? sheet.visible() : 0) });
    cityG.classed("sm-hidden-label", (d) => !shown.has(d.id));
  }

  // ---------------------------------------------------------------- zoom
  function applyZoom() {
    zoomFrame = 0;
    world.attr("transform", transform.toString());
    place();
  }
  // a touch on the map stops the generations and hands the camera to the visitor
  function touched() {
    follow = false;
    window.clearTimeout(autoplayTimer);
    stopPlay();
  }
  const zoom = createZoom({
    stage,
    svg,
    GEO,
    cooperative,
    mac,
    flashHint,
    onUserStart: () => {
      hideTip();
      dismissHint();
      if (phone) touched();
    },
    onZoom: (t) => {
      transform = t;
      // a slow phone gets several touch moves a frame: draw only the last
      if (!lightQuery.matches) applyZoom();
      else if (!zoomFrame) zoomFrame = requestAnimationFrame(applyZoom);
    },
    onEnd: () => layoutLabels(),
  });
  svg.on("click", () => {
    if (mode === "city") showGen();
    if (upright()) sheet.set("min");
  });

  function viewBox() {
    if (phone) {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (side) return { x0: 12, x1: w - sheetEl.offsetWidth - 12, y0: 16, y1: h - 16 };
      // the map between the top bar and the sheet as it stands; behind a raised sheet, as at half height
      const bar = document.querySelector(".phone-bar")?.getBoundingClientRect().bottom ?? 0;
      return { x0: 14, x1: w - 14, y0: bar + 14, y1: h - Math.min(sheet.visible(), h / 2) - 14 };
    }
    const r = stage.getBoundingClientRect();
    return { x0: 40, x1: r.width - (panel.offsetWidth + 50), y0: 120, y1: r.height - 120 };
  }
  function fitTo(points: XY[], pad = 30, duration = 0, extraLeft = 0, maxK = 12, inset = 0) {
    const v = viewBox();
    v.x0 += extraLeft + inset;
    v.x1 -= inset;
    v.y0 += inset * 0.6;
    v.y1 -= inset * 0.6;
    fitView(svg, zoom, v, points, pad, duration, maxK, reduced);
  }
  // a phone frames the cities that have narrators in this generation
  function generationPoints() {
    const points = cities.filter((c) => spreadOf(gen, c.id) > 0).map((c) => c.xy);
    return points.length > 1 ? points : homePoints;
  }
  const home = (duration = 0) => (phone ? fitTo(generationPoints(), 32, duration, 0, 2.2) : fitTo(homePoints, 26, duration));

  wireZoomButtons(stage, svg, zoom, reduced, () => home(700));

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
      .classed("sm-local", (d) => (local[d.id] ?? 0) >= 20 && !reduced && !lightQuery.matches)
      .attr("aria-label", (d) => `${d.name}: ${count(spreadOf(n, d.id), "rawi")} في الطبقة ${ORD[n]}`);
    drawArcs(animate);
    place();
    if (phone) {
      if (follow && animate) home(1100);
      layoutLabels();
    }
    if (mode === "gen") renderGen(animate);
    if (mode === "city" && selected) renderCity(selected);
    if (!playing) {
      const T = DATA.tabaqat[n - 1];
      live.textContent = `الطبقة ${ORD[n]}: ${count(T.narrators, "rawi")} في ${count(T.cities, "balad")}`;
    }
  }

  // ---------------------------------------------------------------- panel: generation
  const shown = { n: 0, l: 0 };
  // the lowest sheet hides the panel: its text waits until the sheet is raised
  const panelHidden = () => upright() && sheet.stop() === "min";
  let panelStale = false;
  function countUp(numEl: HTMLElement | null, wordEl: HTMLElement | null, key: "n" | "l", noun: Noun, to: number) {
    if (!numEl || !wordEl) return;
    const paint = (v: number) => {
      numEl.textContent = fmt(v);
      wordEl.textContent = words(v, noun);
    };
    const from = shown[key];
    shown[key] = to;
    if (reduced || from === to || panelHidden()) {
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
    headTitle.textContent = `الطبقة ${ORD[gen]}`;
    panelStale = panelHidden();
    if (panelStale) return;
    panel.innerHTML = `
      ${today ? `<div class="sm-today-head"><button type="button" class="sm-today-btn">${ICON.today}سند اليوم</button><span>${renewsIn()}</span></div>` : ""}
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
    panel.querySelector(".sm-today-btn")?.addEventListener("click", startToday);
    panel.querySelectorAll<HTMLButtonElement>("[data-city]").forEach((b) =>
      b.addEventListener("click", () => openCity(b.dataset.city ?? "")),
    );
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
    if (phone) {
      if (upright()) sheet.set("half");
      centerOn(svg, zoom, viewBox(), cityById.get(id)!.xy, transform.k, 650, reduced);
      layoutLabels();
    }
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
    headTitle.textContent = c.name;
    panel.innerHTML = `
      <button type="button" class="sm-back">${ICON.prev}عودة إلى الطبقة ${ORD[gen]}</button>
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
  }
  function showGen() {
    mode = "gen";
    selected = null;
    cityG.classed("sm-selected", false);
    setFocus(null);
    renderGen(false);
    place();
    layoutLabels();
  }

  // ---------------------------------------------------------------- play
  function setPlayIcon() {
    playBtn.innerHTML = playing ? ICON.pause : ICON.play;
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
  // a phone shows its own hint, once
  if (phone) {
    let seen = false;
    try {
      seen = window.localStorage.getItem(HINT_SEEN) === "1";
      window.localStorage.setItem(HINT_SEEN, "1");
    } catch {
      // no storage: the hint simply shows again next time
    }
    hint.textContent = PHONE_HINT;
    if (seen) dismissHint();
  }
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

  // ---------------------------------------------------------------- phone layout
  function onStop() {
    if (panelStale && mode === "gen") renderGen(false);
    layoutLabels();
    if (mode === "journey") updateChain();
  }
  function applyLayout() {
    const wasPhone = phone;
    phone = phoneQuery.matches;
    side = sideQuery.matches;
    if (phone !== wasPhone) labelBoxes.clear();
    sheet.setActive(upright());
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
  stage.querySelectorAll<HTMLButtonElement>(".sm-journey-btn").forEach((b) =>
    b.addEventListener("click", () => {
      stopPlay();
      dismissHint();
      openJourneyList();
    }),
  );
  function startToday() {
    if (!today) return;
    stopPlay();
    dismissHint();
    if (mode === "journey") endJourney(false);
    startJourney(today);
  }
  function journeyCard(j: Journey, i: number) {
    const places = journeyPlaces(j.nodes, homeOf).map((c) => c.name).join(" ← ");
    return `<q>${esc(j.title)}</q><small>صحيح البخاري، رقم ${j.number}، ${esc(count(j.nodes.length, "rajul"))}</small><small>${esc(places)}</small>` + (i < 0 ? `<small>${renewsIn()}</small>` : "");
  }
  function openJourneyList() {
    if (mode === "journey") endJourney(false);
    mode = "list";
    selected = null;
    cityG.classed("sm-selected", false);
    setFocus(null);
    if (upright()) sheet.set("full");
    headTitle.textContent = "تتبّع رحلة حديث";
    const allReach = DATA.journeys.every((j) => j.prophet);
    panel.innerHTML = `
      <button type="button" class="sm-back">${ICON.prev}عودة إلى الطبقات</button>
      <div><div class="sm-kicker">أحاديث مختارة</div><h2 class="sm-title">تتبّع رحلة حديث</h2></div>
      <p class="sm-note sm-plain" style="font-size:13.5px">اختر حديثاً لترى رجال سنده واحداً بعد واحد، ${allReach ? "من النبي ﷺ" : "من أوله"} إلى البخاري، في مواطنهم على الخريطة.</p>
      <ul class="sm-j-list">${today ? `<li><button type="button" class="sm-j-card sm-j-today"><span class="sm-kicker">${ICON.today}سند اليوم</span>${journeyCard(today, -1)}</button></li>` : ""}${DATA.journeys
        .map((j, i) => `<li><button type="button" class="sm-j-card" data-j="${i}">${journeyCard(j, i)}</button></li>`)
        .join("")}</ul>`;
    panel.querySelector(".sm-back")?.addEventListener("click", showGen);
    panel.querySelector(".sm-j-today")?.addEventListener("click", startToday);
    panel.querySelectorAll<HTMLButtonElement>("[data-j]").forEach((b) =>
      b.addEventListener("click", () => {
        const j = DATA.journeys[Number(b.dataset.j)];
        if (j) startJourney(j);
      }),
    );
  }

  function rowsOf(j: Journey) {
    const rows: Record<string, number> = {};
    for (const n of j.nodes) if (n.city) rows[n.city] = (rows[n.city] ?? 0) + 1;
    return rows;
  }
  function frameRoute(duration: number) {
    if (!journey) return;
    const pts = journeyPlaces(journey.nodes, homeOf).map((c) => c.xy);
    const longest = Math.max(1, ...Object.values(rowsOf(journey)));
    fitTo(pts.length > 1 ? pts : homePoints, 20 + (longest - 1) * 20, duration, 0, 12, phone ? 30 : 46);
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
    updateNow();
    renderJourneyControls();
    const last = i === journey.nodes.length - 1;
    const cur = homeOf(journey.nodes[i]);
    const prev = lastPlaceBefore(i);
    const camera = reduced ? 0 : 850;
    if (cur) {
      const pts = prev ? [cur.xy, prev.xy] : [cur.xy];
      fitTo(pts, 20 + rowIndex(i) * 20, camera, 0, 3, phone ? 34 : 50);
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
              if (upright()) sheet.set("half");
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
    panel.classList.add("sm-journey-panel");
    const link = hadithHref(j.number);
    const isToday = j === today;
    panel.innerHTML = `
      <button type="button" class="sm-back">${ICON.prev}عودة إلى الطبقات</button>
      <div><div class="sm-kicker">صحيح البخاري، رقم ${j.number}${link ? ` · <a class="sm-link" href="${esc(link)}" data-internal>صفحة الحديث</a>` : ""}</div>
      ${isToday ? `<h2 class="sm-title" style="font-size:26px">سند اليوم</h2><div class="sm-kicker">${renewsIn()}</div>` : `<h2 class="sm-title" style="font-size:26px">«${esc(j.title)}»</h2>`}</div>
      <div class="sm-j-controls"></div>
      <div class="sm-j-scroll">
      ${isToday && j.matn ? `<blockquote class="sm-matn">${esc(j.matn)}</blockquote>` : ""}
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
      <p class="sm-note">تعرض الخريطة موطن كل راوٍ حسب نسبته في تقريب التهذيب، ومن لا نسبة له فبحسب المشهور في التراجم، لا المكان الذي سمع فيه الحديث. والأحكام بلفظ ابن حجر.</p>
      </div>`;
    panel.querySelector(".sm-back")?.addEventListener("click", () => endJourney(true));
    // once the list has scrolled, fade its top edge so no half-cut line shows under the controls
    const scroller = panel.querySelector<HTMLElement>(".sm-j-scroll");
    scroller?.addEventListener("scroll", () => scroller.classList.toggle("sm-scrolled", scroller.scrollTop > 1), { passive: true });
    updateNow();
    renderJourneyControls();
    sheet.measure();
    if (upright()) sheet.set("min");
    if (isToday) showUmmahText(j);
  }
  // the day's text from the Ummah API when it answers and its text is ours; if not, ours stays, silently
  function showUmmahText(j: Journey) {
    const start = j.matn?.slice(0, 24);
    if (!start) return;
    fetchUmmahHadith(String(j.number)).then((h) => {
      const at = h ? h.arabic.indexOf(start) : -1;
      const box = panel.querySelector<HTMLElement>(".sm-matn");
      if (!h || at < 0 || !box || dead || journey !== j) return;
      box.textContent = h.arabic.slice(at).trim();
      box.insertAdjacentHTML("beforeend", `<cite>من Ummah API</cite>`);
    });
  }
  // a phone's lowest sheet: the narrator the chain has reached
  function updateNow() {
    if (!journey) return;
    const n = journey.nodes[jStep];
    const last = jStep === journey.nodes.length - 1;
    nowWho.innerHTML = n
      ? `<span class="sm-dara ${n.id ? "sm-full" : ""} sm-b-${n.b}" aria-hidden="true"></span><div>
          <div class="sm-now-name">${personName(n.n, last ? undefined : n.id)}${n.tr && !last ? `<span class="sm-term">${esc(n.tr)}</span>` : ""}</div>
          <div class="sm-meta">${esc(n.v || (last ? "صاحب الصحيح" : n.id ? "انظر الترجمة" : "لم تُعرف ترجمته"))}</div></div>`
      : `<q class="sm-now-title">${esc(journey.title)}</q>`;
  }
  function renderJourneyControls() {
    const box = panel.querySelector<HTMLElement>(".sm-j-controls");
    if (!box || !journey) return;
    const atEnd = jStep >= journey.nodes.length - 1 && jVisible === journey.nodes.length;
    const steps = `
      <button type="button" class="sm-btn" data-act="prev" ${jStep <= 0 ? "disabled" : ""}>${ICON.prev}السابق</button>
      <button type="button" class="sm-btn sm-primary" data-act="play">${atEnd ? `${ICON.again}أعد الرحلة` : jPlaying ? `${ICON.pause}إيقاف` : `${ICON.play}متابعة`}</button>
      <button type="button" class="sm-btn" data-act="next" ${atEnd ? "disabled" : ""}>التالي${ICON.next}</button>`;
    box.innerHTML = `${steps}
      <button type="button" class="sm-btn" data-act="other">${ICON.route}حديث آخر</button>`;
    nowControls.innerHTML = steps;
    const on = (act: string, fn: () => void) =>
      [box, nowControls].forEach((b) => b.querySelector(`[data-act="${act}"]`)?.addEventListener("click", fn));
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
    const box = journeyScroller();
    if (!now || !box) return;
    // scroll the list only, never the page
    const top = now.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const bottom = top + now.offsetHeight;
    const view = upright() ? Math.max(0, sheet.visible() - head.offsetHeight) : box.clientHeight;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    if (top < box.scrollTop) box.scrollTo({ top, behavior });
    else if (bottom > box.scrollTop + view) box.scrollTo({ top: bottom - view, behavior });
  }
  // the chain scrolls in its own box, or with the whole panel on a phone
  function journeyScroller() {
    return phone ? panel : panel.querySelector<HTMLElement>(".sm-j-scroll");
  }
  function showSummary() {
    if (!journey) return;
    const { places, km, years, regions } = journeySummary(journey.nodes, homeOf);
    const noun: Noun = regions ? "balad" : "city";
    const box = panel.querySelector(".sm-j-sum");
    if (!box) return;
    box.innerHTML = `<div class="sm-summary">
      <div class="sm-stat"><strong>${esc(count(journey.nodes.length, "rajul"))}</strong><span>في السند</span></div>
      <div class="sm-stat"><strong>${esc(count(places.length, noun))}</strong><span>مرّ بها</span></div>
      <div class="sm-stat"><strong>${fmt(km)} كم</strong><span>تقريباً بين مواطنهم</span></div>
      ${years.length ? `<div class="sm-stat"><strong>${Math.min(...years)}–${Math.max(...years)}هـ</strong><span>سنوات الوفاة المعروفة</span></div>` : ""}
    </div>`;
    // bring the summary and the note under it into view; when both cannot fit, start at the summary
    const scroller = journeyScroller();
    const sum = box.firstElementChild;
    if (scroller && sum) {
      const top = sum.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      scroller.scrollTo({ top: Math.min(top, scroller.scrollHeight - scroller.clientHeight), behavior: reduced ? "auto" : "smooth" });
    }
    live.textContent = `انتهت الرحلة: ${count(journey.nodes.length, "rajul")} في ${count(places.length, noun)}`;
  }

  // the chain on the map, in screen space so it stays crisp at any zoom
  function renderJourneyState() {
    if (!journey) return;
    jNodes = placeNodes(journey.nodes, jVisible, homeOf);
  }
  const chainLayer = createChainLayer(journeyLayer, (xy) => [sx(xy), sy(xy)], reduced);
  function clearJourney() {
    chainLayer.clear();
  }
  function placeJourney(enter: boolean) {
    const j = journey;
    if (!j || mode !== "journey") {
      clearJourney();
      return;
    }
    chainLayer.draw({
      nodes: j.nodes,
      placed: jNodes,
      // the narrator named on the map: the newest one drawn, so a name stays up while the camera moves
      current: Math.min(jStep, jVisible - 1),
      done: jVisible === j.nodes.length && !jPlaying,
      enter,
    });
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
    if (phone) sheet.measure();
    if (toGen) {
      showGen();
      if (upright()) sheet.set("min");
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
    applyLayout();
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
  applyLayout();
  if (upright()) sheet.set("min", false);
  home(0);
  setGen(opts.startGen ?? 1, false);
  // the names are chosen by their real size, known once the font has arrived
  document.fonts.load("700 13px Amiri", "الكوفة").then(() => {
    if (dead || !phone) return;
    measureLabels();
    layoutLabels();
  });
  const firstJourney = [...(today ? [today] : []), ...DATA.journeys].find((j) => j.number === opts.startJourney);
  if (firstJourney) startJourney(firstJourney);
  else if (!reduced && opts.autoplay !== false) {
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
    if (zoomFrame) cancelAnimationFrame(zoomFrame);
    sheet.destroy();
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
