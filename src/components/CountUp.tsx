"use client";

import { useEffect, useRef } from "react";
import { nounFor, type Forms } from "@/lib/labels";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Calls paint from 0 up to the value once the element comes into view; at once with reduced motion. */
function countUp(el: Element, value: number, paint: (n: number) => void) {
  if (value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paint(value);
    return () => {};
  }
  let raf = 0;
  const watcher = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      watcher.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1100);
        paint(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    { threshold: 0.6 },
  );
  watcher.observe(el);
  return () => {
    watcher.disconnect();
    cancelAnimationFrame(raf);
  };
}

/** A figure inside a sentence. The real number stays in the text for screen readers. */
export function CountNum({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return countUp(el, value, (n) => {
      el.textContent = fmt(n);
    });
  }, [value]);
  return (
    <>
      <span className="sr-only">{fmt(value)}</span>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        0
      </span>
    </>
  );
}

/**
 * A figure that counts up once it comes into view, its noun agreeing with
 * the number as it goes («3 شيوخ»، «11 شيخاً»).
 */
export default function CountUp({ value, forms, label }: { value: number; forms: Forms; label: string }) {
  const numRef = useRef<HTMLElement>(null);
  const nounRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const num = numRef.current;
    const noun = nounRef.current;
    if (!num || !noun) return;
    return countUp(num, value, (n) => {
      num.textContent = fmt(n);
      noun.textContent = nounFor(n, forms);
    });
  }, [value, forms]);

  return (
    <div className="flex flex-col">
      <span className="sr-only">
        {fmt(value)} {nounFor(value, forms)} {label}
      </span>
      <span className="flex items-baseline gap-2" aria-hidden="true">
        <b ref={numRef} className="text-4xl font-semibold tabular-nums">
          0
        </b>
        <span ref={nounRef} className="naskh text-xl">
          {nounFor(0, forms)}
        </span>
      </span>
      <span className="text-sm text-midad-soft" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
