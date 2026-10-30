// The home map on a phone: the panel as a bottom sheet with three heights, or a
// side column when the phone lies on its side, and the choice of which city
// names to write when there is no room for all of them.

export type Stop = "min" | "half" | "full";
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** Portrait phones and narrow windows, and a phone on its side (a wide but short touch screen). */
export const PHONE_QUERY = "(max-width: 860px), (max-height: 500px) and (pointer: coarse)";
/** A phone on its side: the panel becomes a column. */
export const SIDE_QUERY = "(max-width: 860px) and (max-height: 500px), (max-height: 500px) and (pointer: coarse)";
/** Devices that get the lighter drawing (no blending, fewer comets). */
export const LIGHT_QUERY = "(max-width: 860px), (pointer: coarse)";

const HALF = 0.5;
const FULL = 0.88;
const DRAG_FROM = 6; // px before a touch counts as a drag and not a tap
const THROW_MS = 180; // how far the finger's speed carries the sheet when released

export type Sheet = {
  /** Moves the sheet to a stop. */
  set: (stop: Stop, animate?: boolean) => void;
  stop: () => Stop;
  /** Height of the sheet above the bottom of the map at its current stop. */
  visible: () => number;
  /** Reads the stage and head sizes again (after a resize or when the head's content changes). */
  measure: () => void;
  /** On for the bottom sheet, off on desktop and in the side column. */
  setActive: (on: boolean) => void;
  destroy: () => void;
};

export function createSheet(
  stage: HTMLElement,
  sheet: HTMLElement,
  head: HTMLElement,
  toggle: HTMLElement,
  onStop: (stop: Stop) => void,
): Sheet {
  let active = false;
  let current: Stop = "min";
  let stageH = 0;
  let sheetH = 0;
  let minH = 120;
  let frame = 0;
  let nextY = 0;
  let swallowClick = false;
  let drag: { id: number; fromY: number; y0: number; y: number; moved: boolean; t: number; lastY: number; v: number } | null = null;

  const yOf = (s: Stop) => (s === "full" ? 0 : s === "half" ? Math.max(0, sheetH - Math.round(stageH * HALF)) : Math.max(0, sheetH - minH));
  const paint = (y: number) => {
    sheet.style.transform = `translate3d(0,${y}px,0)`;
  };
  function apply(animate: boolean) {
    if (!active) return;
    sheet.classList.toggle("sm-dragging", !animate);
    const y = yOf(current);
    paint(y);
    // what the sheet hides below the screen stays reachable by the programme's scrolling
    sheet.style.setProperty("--sm-sheet-y", `${y}px`);
    sheet.dataset.stop = current;
  }
  function set(stop: Stop, animate = true) {
    const changed = stop !== current;
    current = stop;
    apply(animate);
    if (changed) onStop(stop);
  }
  function measure() {
    stageH = stage.clientHeight;
    sheetH = Math.round(stageH * FULL);
    minH = Math.min(head.offsetHeight, Math.round(stageH * HALF));
    if (active) {
      sheet.style.height = `${sheetH}px`;
      apply(false);
    }
  }
  function setActive(on: boolean) {
    active = on;
    if (on) {
      measure();
      return;
    }
    sheet.style.removeProperty("transform");
    sheet.style.removeProperty("height");
    sheet.style.removeProperty("--sm-sheet-y");
    sheet.classList.remove("sm-dragging");
    sheet.dataset.stop = "full";
  }

  function onDown(e: PointerEvent) {
    if (!active || e.button) return;
    const target = e.target as Element;
    if (target.closest(".sm-tools")) return;
    // at the top the content scrolls on its own; the head still drags the sheet down
    if (current === "full" && !target.closest(".sm-sheet-head")) return;
    drag = { id: e.pointerId, fromY: e.clientY, y0: yOf(current), y: yOf(current), moved: false, t: e.timeStamp, lastY: e.clientY, v: 0 };
  }
  function onMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.fromY;
    if (!drag.moved) {
      if (Math.abs(dy) < DRAG_FROM) return;
      drag.moved = true;
      sheet.classList.add("sm-dragging");
      sheet.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - drag.t;
    if (dt > 0) drag.v = (e.clientY - drag.lastY) / dt;
    drag.t = e.timeStamp;
    drag.lastY = e.clientY;
    drag.y = Math.min(yOf("min"), Math.max(0, drag.y0 + dy));
    nextY = drag.y;
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint(nextY);
      });
    }
  }
  function onEnd(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, y, v } = drag;
    drag = null;
    if (!moved) return;
    swallowClick = true;
    window.setTimeout(() => (swallowClick = false), 0);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    const landing = y + v * THROW_MS;
    const stops: Stop[] = ["full", "half", "min"];
    const nearest = stops.reduce((a, b) => (Math.abs(yOf(b) - landing) < Math.abs(yOf(a) - landing) ? b : a));
    set(nearest);
    apply(true);
  }
  function onClick(e: MouseEvent) {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }
  const onToggle = () => set(current === "min" ? "half" : "min");

  sheet.addEventListener("pointerdown", onDown);
  sheet.addEventListener("pointermove", onMove);
  sheet.addEventListener("pointerup", onEnd);
  sheet.addEventListener("pointercancel", onEnd);
  sheet.addEventListener("click", onClick, true);
  toggle.addEventListener("click", onToggle);

  return {
    set,
    stop: () => current,
    visible: () => (active ? sheetH - yOf(current) : 0),
    measure,
    setActive,
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      sheet.removeEventListener("pointerdown", onDown);
      sheet.removeEventListener("pointermove", onMove);
      sheet.removeEventListener("pointerup", onEnd);
      sheet.removeEventListener("pointercancel", onEnd);
      sheet.removeEventListener("click", onClick, true);
      toggle.removeEventListener("click", onToggle);
    },
  };
}

// ---------------------------------------------------------------- city names

export type LabelItem = {
  id: string;
  /** The name's box in screen space. */
  box: Box;
  /** Always written (the selected city, a city on the chain being told). */
  force?: boolean;
};
export type Dot = { id: string; x: number; y: number };

const DOT_R = 5.5;
const crosses = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The names to write, given in order of priority: each is kept unless it would
 * touch a name kept before it or the dot of another city.
 */
export function pickLabels(items: LabelItem[], dots: Dot[], area: Box): Set<string> {
  const kept: Box[] = [];
  const shown = new Set<string>();
  for (const { id, box, force } of items) {
    if (!crosses(box, area)) continue;
    if (!force) {
      if (kept.some((k) => crosses(k, box))) continue;
      const onDot = dots.some(
        (d) => d.id !== id && crosses(box, { x0: d.x - DOT_R, y0: d.y - DOT_R, x1: d.x + DOT_R, y1: d.y + DOT_R }),
      );
      if (onDot) continue;
    }
    kept.push(box);
    shown.add(id);
  }
  return shown;
}
