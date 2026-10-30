"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { brushX, type BrushBehavior, type D3BrushEvent } from "d3-brush";
import { select } from "d3-selection";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PHONE_QUERY } from "./sanad-map/phone";
import { dodge } from "@/lib/dodge";
import { getCities, getData } from "@/lib/data";
import { GROUP_COLOR, GROUP_LABEL, deathText } from "@/lib/labels";
import { nameWords } from "@/lib/names";
import type { City, Group } from "@/lib/types";

type Narr = { id: string; n: string; y: number; t: number | null; g: Group; v: string; c: string | null; m?: 1; k: number };
type Region = { id: string; name: string; cities: string[] };
type TimeFile = { total: number; dated: number; regions: Region[]; narrators: Narr[] };
type Dot = { n: Narr; cx: number; cy: number; r: number };
type Row = { id: string; name: string; short: string; count: number; start: number; size: number; dots: Dot[]; top: Dot | null };
type Chart = { w: number; h: number; year: (y: number) => number; rows: Row[]; dots: Dot[] };
type Period = [number, number];

const YEARS = 260; // the axis
const BEYOND = 274; // a strip past it, for the few death years the data places later
const TICKS = [0, 50, 100, 150, 200, 250];
const ERAS: { label: string; from: number; to: number }[] = [
  { label: "قبل 100هـ", from: 0, to: 100 },
  { label: "بعد 100هـ", from: 100, to: 200 },
  { label: "بعد 200هـ", from: 200, to: YEARS },
];
const PRESETS: { label: string; period: Period }[] = [
  { label: "قبل 100", period: [0, 100] },
  { label: "من 100 إلى 200", period: [100, 200] },
  { label: "بعد 200", period: [200, BEYOND] },
];
const GROUPS: Group[] = ["sahabi", "thiqa", "saduq", "maqbul", "daif", "see"];
const NONE = "none";
const SHORT: Record<string, string> = { hijaz: "الحجاز", yemen: "اليمن", iraq: "العراق", jazira: "الجزيرة", sham: "الشام", misr: "مصر", east: "المشرق", none: "بلا نسبة" };
const SHOWN_NAMES = 40;
const SWEEP_MS = 2000;

const onAxis = (y: number) => (y > YEARS ? (YEARS + BEYOND) / 2 : y);
const count = (n: number) => (n === 1 ? "راوٍ واحد" : n === 2 ? "راويان" : `${n} ${n % 100 >= 3 && n % 100 <= 10 ? "رواة" : "راوياً"}`);

function radiusOf(narrators: Narr[], most: number) {
  const top = Math.sqrt(Math.max(1, ...narrators.map((n) => n.k)));
  return (n: Narr) => 1.8 + (most - 1.8) * (Math.sqrt(n.k) / top);
}

/** Rows by region, the years running right to left like the generations on the home map. */
function wideChart(narrators: Narr[], rows: Region[], W: number): Chart {
  const LABELS = 112;
  const TOP = 76; // the axis and the brush
  const x0 = W - LABELS;
  const x1 = 16;
  const year = (y: number) => x0 - (y / BEYOND) * (x0 - x1);
  const radius = radiusOf(narrators, 12);
  let at = TOP;
  const out: Row[] = [...rows, { id: NONE, name: "بلا نسبة إلى بلد", cities: [] }].map((region) => {
    const men = narrators.filter((n) => (region.id === NONE ? !n.c : n.c && region.cities.includes(n.c)));
    const placed = dodge(men, (n) => year(onAxis(n.y)), radius);
    const reach = Math.max(14, ...placed.map((p) => Math.abs(p.across) + p.r));
    // the row's busiest narrator is named above it, on a short line down to his dara
    const size = 2 * reach + 30;
    const mid = at + 22 + reach;
    const dots = placed.map((p) => ({ n: p.d, cx: p.along, cy: mid + p.across, r: p.r }));
    const row = { id: region.id, name: region.name, short: SHORT[region.id], count: men.length, start: at, size, dots, top: dots.reduce<Dot | null>((a, b) => (!a || b.n.k > a.n.k ? b : a), null) };
    at += size;
    return row;
  });
  return { w: W, h: at + 6, year, rows: out, dots: out.flatMap((r) => r.dots) };
}

/** Columns by region, the years running down the page. The busier the region, the wider its column. */
function tallChart(narrators: Narr[], rows: Region[], W: number): Chart {
  const GUTTER = 26;
  const TOP = 8;
  const radius = radiusOf(narrators, 6.5);
  const regions = [...rows, { id: NONE, name: "بلا نسبة إلى بلد", cities: [] }];
  const men = regions.map((region) => narrators.filter((n) => (region.id === NONE ? !n.c : n.c && region.cities.includes(n.c))));
  for (let perYear = 8; ; perYear += 1) {
    const year = (y: number) => TOP + y * perYear;
    const placed = men.map((m) => dodge(m, (n) => year(onAxis(n.y)), radius, 0.5));
    const widths = placed.map((p) => Math.max(26, 2 * Math.max(0, ...p.map((q) => Math.abs(q.across) + q.r)) + 4));
    const total = widths.reduce((a, b) => a + b, 0);
    if (total <= W - GUTTER || perYear >= 30) {
      const spare = (W - GUTTER - total) / widths.length;
      let right = W - GUTTER;
      const out: Row[] = regions.map((region, i) => {
        const size = widths[i] + Math.max(0, spare);
        const mid = right - size / 2;
        const dots = placed[i].map((p) => ({ n: p.d, cx: mid + p.across, cy: p.along, r: p.r }));
        const row = { id: region.id, name: region.name, short: SHORT[region.id], count: men[i].length, start: right - size, size, dots, top: null };
        right -= size;
        return row;
      });
      return { w: W, h: year(BEYOND) + 10, year, rows: out, dots: out.flatMap((r) => r.dots) };
    }
  }
}

export default function TimeView() {
  const wanted = useSearchParams().get("id");
  const [file, setFile] = useState<TimeFile | null>(null);
  const [cities, setCities] = useState<Record<string, City>>({});
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const [phone, setPhone] = useState(false);
  const [off, setOff] = useState<Set<Group>>(new Set());
  const [period, setPeriod] = useState<Period | null>(null);
  // undefined until the visitor picks one: the narrator named in the address (/time/?id=) stands
  const [picked, setActive] = useState<Narr | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [shownYears, setShownYears] = useState<Period>([0, 40]);
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const brushLayer = useRef<SVGGElement>(null);
  const brushRef = useRef<BrushBehavior<unknown> | null>(null);
  const sweep = useRef<SVGRectElement>(null);
  const sweepYear = useRef<SVGTextElement>(null);
  const swept = useRef(false);

  useEffect(() => {
    Promise.all([getData<TimeFile>("time.json"), getCities()])
      .then(([t, c]) => {
        setFile(t);
        setCities(c);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const q = window.matchMedia(PHONE_QUERY);
    const apply = () => setPhone(q.matches);
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, []);

  const ready = file !== null;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  const chart = useMemo(() => {
    if (!file || !width) return null;
    return phone ? tallChart(file.narrators, file.regions, width) : wideChart(file.narrators, file.regions, width);
  }, [file, width, phone]);

  const active = picked === undefined ? (file?.narrators.find((n) => n.id === wanted) ?? null) : picked;

  // the narrator named in the address is brought into view
  useEffect(() => {
    const dot = wanted ? chart?.dots.find((d) => d.n.id === wanted) : null;
    if (!dot) return;
    swept.current = true;
    const top = svg.current?.getBoundingClientRect().top ?? 0;
    window.scrollTo({ top: window.scrollY + top + dot.cy - window.innerHeight / 2 });
  }, [wanted, chart]);

  // the years pass once, the first time the chart comes into view
  useEffect(() => {
    const el = svg.current;
    if (!el || !chart) return;
    const rect = sweep.current;
    const label = sweepYear.current;
    const show = (p: number) => {
      if (!rect) return;
      const y = chart.year(YEARS * p);
      if (phone) rect.setAttribute("height", String(p >= 1 ? chart.h : y));
      else {
        rect.setAttribute("x", String(p >= 1 ? 0 : y));
        rect.setAttribute("width", String(chart.w));
      }
      if (label) {
        label.textContent = p >= 1 || p <= 0 ? "" : `${Math.round(YEARS * p)}هـ`;
        label.setAttribute(phone ? "y" : "x", String(y));
      }
    };
    if (swept.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      swept.current = true;
      show(1);
      return;
    }
    show(0);
    let raf = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      swept.current = true;
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / SWEEP_MS);
        show(p);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [chart, phone]);

  // dragging on the axis picks a period (the phone has ready-made buttons)
  useEffect(() => {
    const layer = brushLayer.current;
    if (!layer || !chart || phone) return;
    const toYear = (x: number) => Math.round(((chart.w - 112 - x) / (chart.w - 112 - 16)) * BEYOND);
    const brush = brushX<unknown>()
      .extent([[16, 30], [chart.w - 112, 70]])
      .on("end", (e: D3BrushEvent<unknown>) => {
        if (!e.sourceEvent) return;
        const s = e.selection as [number, number] | null;
        setPeriod(s ? [Math.max(0, toYear(s[1])), Math.min(BEYOND, toYear(s[0]))] : null);
      });
    brushRef.current = brush;
    const sel = select(layer);
    sel.call(brush);
    sel.select(".selection").attr("fill", "var(--mughra)").attr("fill-opacity", 0.28).attr("stroke", "var(--mughra)");
    return () => {
      sel.on(".brush", null);
      sel.selectAll("*").remove();
      brushRef.current = null;
    };
  }, [chart, phone]);

  // a phone keeps the years in view above the chart
  useEffect(() => {
    if (!phone || !chart) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const el = svg.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const span = (BEYOND * (chart.h - 18)) / chart.h;
      const at = (px: number) => Math.max(0, Math.min(YEARS, Math.round((px / (chart.h - 18)) * span)));
      setShownYears([at(90 - top), at(window.innerHeight - top)]);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [phone, chart]);

  const inPeriod = useCallback((n: Narr) => !period || (n.y >= period[0] && n.y <= period[1]), [period]);
  const lit = useCallback((n: Narr) => !off.has(n.g) && inPeriod(n), [off, inPeriod]);

  const marks = useMemo(() => {
    if (!chart) return null;
    return chart.dots.map((d) => {
      const color = GROUP_COLOR[d.n.g];
      const on = lit(d.n);
      return (
        <g key={d.n.id} opacity={on ? 1 : 0.1}>
          {d.r >= 3.2 ? (
            <>
              <circle cx={d.cx} cy={d.cy} r={d.r - 0.6} fill="var(--raqq)" stroke={color} strokeWidth={1.3} />
              <circle cx={d.cx} cy={d.cy} r={Math.max(1, d.r * 0.38)} fill={color} />
            </>
          ) : (
            <circle cx={d.cx} cy={d.cy} r={d.r} fill={color} />
          )}
        </g>
      );
    });
  }, [chart, lit]);

  const nearest = (e: React.MouseEvent, reach: number) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect || !chart) return null;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: Dot | null = null;
    let bestD = reach;
    for (const d of chart.dots) {
      if (!lit(d.n)) continue;
      const dist = Math.hypot(d.cx - x, d.cy - y) - d.r;
      if (dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    return best;
  };

  const results = useMemo(() => {
    const q = nameWords(query);
    if (!file || !q.length || query.trim().length < 2) return [];
    return file.narrators.filter((n) => {
      const w = nameWords(n.n);
      return q.every((x) => w.some((y) => y.startsWith(x)));
    }).slice(0, 6);
  }, [file, query]);

  const pick = (n: Narr) => {
    setActive(n);
    setQuery("");
    setOff(new Set());
    setPeriod(null);
    const dot = chart?.dots.find((d) => d.n.id === n.id);
    const top = svg.current?.getBoundingClientRect().top ?? 0;
    if (dot) window.scrollTo({ top: window.scrollY + top + dot.cy - window.innerHeight / 2, behavior: "smooth" });
  };

  if (failed) return <p className="py-16 text-center text-midad-soft">تعذّر تحميل البيانات. أعد تحميل الصفحة.</p>;
  if (!file) return <p className="py-16 text-center text-midad-soft">جارٍ تحميل الزمان…</p>;

  const groupCount = (g: Group) => file.narrators.filter((n) => n.g === g).length;
  const dotOf = (n: Narr | null) => (n ? chart?.dots.find((d) => d.n.id === n.id) ?? null : null);
  const current = dotOf(active);
  const inRange = period ? file.narrators.filter((n) => inPeriod(n) && !off.has(n.g)) : [];
  const regionOf = (n: Narr) => (n.c ? file.regions.find((r) => r.cities.includes(n.c ?? ""))?.id ?? NONE : NONE);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="naskh text-4xl font-bold leading-snug">الزمان</h1>
      <p className="mt-1 max-w-3xl text-midad-soft">
        الخريطة تعرض المكان، وهذه الصفحة تعرض الزمان: كل راوٍ دارة في سنة وفاته وإقليمه، بلون مرتبته، وحجمها بعدد أسانيده.{" "}
        <strong className="font-semibold text-midad">{file.dated} من {file.total} راوياً لهم سنة وفاة معروفة.</strong>
      </p>
      <p className="mt-1 text-sm text-midad-soft">سنوات الوفاة كما في تقريب التهذيب، ومن لا تُعرف وفاته لا يُقدَّر هنا.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 phone:flex-nowrap phone:overflow-x-auto" role="group" aria-label="مجموعات المراتب">
        {GROUPS.filter((g) => groupCount(g) > 0).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={!off.has(g)}
            onClick={() => {
              const next = new Set(off);
              if (next.has(g)) next.delete(g);
              else next.add(g);
              setOff(next);
            }}
            className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-sm phone:min-h-11 phone:shrink-0 phone:whitespace-nowrap ${off.has(g) ? "border-khatt text-midad-soft line-through" : "border-midad-soft"}`}
          >
            <span className="inline-block size-2.5 rounded-full" style={{ background: GROUP_COLOR[g] }} aria-hidden="true" />
            {GROUP_LABEL[g]} <span className="tabular-nums text-midad-soft">{groupCount(g)}</span>
          </button>
        ))}
      </div>

      <div className="relative mt-3 max-w-md">
        <label htmlFor="time-q" className="sr-only">ابحث عن راوٍ</label>
        <input
          id="time-q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن راوٍ لترى موضعه"
          className="w-full rounded-sm border border-khatt bg-raqq px-3 py-2 text-base"
        />
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 border border-t-0 border-khatt bg-raqq shadow-md">
            {results.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => pick(n)} className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-start hover:bg-raml phone:min-h-11">
                  <span className="naskh text-lg leading-normal">{n.n}</span>
                  <span className="text-xs tabular-nums text-midad-soft">{deathText(n.y)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {phone && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="الفترات">
          {PRESETS.map((p) => {
            const on = period?.[0] === p.period[0] && period?.[1] === p.period[1];
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                onClick={() => setPeriod(on ? null : p.period)}
                className={`min-h-11 rounded-sm border px-3 text-sm ${on ? "border-mughra text-midad" : "border-khatt text-midad-soft"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
      {!phone && <p className="mt-3 text-sm text-midad-soft">اسحب على شريط السنوات لتحديد فترة.</p>}

      {period && (
        <section className="mt-3 border-y border-khatt py-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="naskh text-xl font-bold">
              {count(inRange.length)} توفوا بين {Math.min(period[0], YEARS)} و{Math.min(period[1], 300)}هـ
            </h2>
            <button
              type="button"
              onClick={() => {
                setPeriod(null);
                if (brushRef.current && brushLayer.current) select(brushLayer.current).call(brushRef.current.move, null);
              }}
              className="text-sm text-nila underline underline-offset-4 phone:min-h-11"
            >
              إلغاء الفترة
            </button>
          </div>
          <p className="mt-1 text-sm">
            {[...file.regions.map((r) => r.id), NONE].map((id, i) => {
              const c = inRange.filter((n) => regionOf(n) === id).length;
              return (
                <span key={id}>
                  {i > 0 && " · "}
                  {SHORT[id]} <span className="tabular-nums text-midad-soft">{c}</span>
                </span>
              );
            })}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {inRange.slice(0, SHOWN_NAMES).map((n) => (
              <li key={n.id}>
                <Link href={`/narrator/?id=${n.id}`} className="naskh text-lg leading-normal text-nila hover:underline phone:inline-flex phone:min-h-11 phone:items-center">
                  {n.n}
                </Link>
              </li>
            ))}
          </ul>
          {inRange.length > SHOWN_NAMES && <p className="mt-1 text-xs text-midad-soft">وأشهر {SHOWN_NAMES} منهم هنا، مرتبون بعدد أسانيدهم.</p>}
        </section>
      )}

      {phone && chart && (
        <div className="sticky top-0 z-10 mt-3 border-b border-khatt bg-raqq pt-4">
          <p className="text-center text-sm tabular-nums" aria-live="off">
            السنوات الظاهرة: {shownYears[0]}–{shownYears[1]}هـ
          </p>
          <div className="relative h-6 text-[10.5px]" dir="ltr">
            {chart.rows.map((r) => (
              <span key={r.id} className="absolute top-1 text-center leading-none text-midad-soft" style={{ left: r.start, width: r.size }}>
                {r.short}
              </span>
            ))}
          </div>
        </div>
      )}

      <div ref={box} className={`relative ${phone ? "" : "mt-2"}`}>
        {chart && (
          <svg
            ref={svg}
            width={chart.w}
            height={chart.h}
            viewBox={`0 0 ${chart.w} ${chart.h}`}
            role="img"
            aria-label={`${file.dated} راوياً على محور الزمن من سنة 0 إلى ${YEARS}هـ، صف لكل إقليم`}
            className="block touch-pan-y"
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse") return;
              const d = nearest(e, 7);
              if (d) setActive(d.n);
            }}
            onClick={(e) => setActive(nearest(e, phone ? 22 : 10)?.n ?? null)}
          >
            <defs>
              <clipPath id="time-sweep">
                <rect ref={sweep} x={0} y={0} width={chart.w} height={chart.h} />
              </clipPath>
            </defs>
            {phone ? <TallGrid chart={chart} /> : <WideGrid chart={chart} />}
            <g clipPath="url(#time-sweep)">{marks}</g>
            {!phone &&
              chart.rows.map(
                (r) =>
                  r.top && (
                    <g key={r.id} clipPath="url(#time-sweep)" className="pointer-events-none" opacity={lit(r.top.n) ? 1 : 0.15}>
                      <line x1={r.top.cx} x2={r.top.cx} y1={r.start + 19} y2={r.top.cy - r.top.r} stroke="var(--midad-soft)" strokeWidth={0.8} />
                      <text
                        x={r.top.cx}
                        y={r.start + 15}
                        textAnchor="middle"
                        className="fill-midad font-[family-name:var(--font-naskh)] text-[13px] font-bold"
                        stroke="var(--raqq)"
                        strokeWidth={3}
                        paintOrder="stroke"
                      >
                        {r.top.n.n}
                      </text>
                    </g>
                  ),
              )}
            {current && <circle cx={current.cx} cy={current.cy} r={current.r + 3} fill="none" stroke="var(--nila)" strokeWidth={2} className="pointer-events-none" />}
            <text ref={sweepYear} x={0} y={phone ? 0 : 24} textAnchor="middle" className="pointer-events-none fill-mughra text-[13px] font-semibold tabular-nums" />
            {!phone && <g ref={brushLayer} />}
          </svg>
        )}
        {active && current && chart && !phone && (
          <div
            className="absolute z-10 w-64 border border-khatt bg-raqq p-3 shadow-md"
            style={{ left: Math.max(0, Math.min(chart.w - 256, current.cx - 128)), top: current.cy + current.r + 8 }}
          >
            <Card n={active} cities={cities} onClose={() => setActive(null)} />
          </div>
        )}
      </div>

      {active && phone && (
        <div className="fixed inset-x-3 bottom-4 z-30 border border-khatt bg-raqq p-3 shadow-lg">
          <Card n={active} cities={cities} onClose={() => setActive(null)} />
        </div>
      )}
    </main>
  );
}

const chainCount = (n: number) => (n === 1 ? "في سند واحد" : n === 2 ? "في سندين" : `في ${n} ${n % 100 >= 3 && n % 100 <= 10 ? "أسانيد" : "سنداً"}`);

function Card({ n, cities, onClose }: { n: Narr; cities: Record<string, City>; onClose: () => void }) {
  const city = n.c ? cities[n.c]?.ar : null;
  return (
    <div className="relative">
      <button type="button" aria-label="إغلاق" onClick={onClose} className="absolute -top-2 -left-2 grid size-8 place-items-center text-midad-soft phone:size-11">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 2l8 8M10 2L2 10" /></svg>
      </button>
      <Link href={`/narrator/?id=${n.id}`} className="naskh block pe-8 text-xl font-bold leading-normal text-nila underline underline-offset-4 phone:min-h-11">
        {n.n}
      </Link>
      <p className="text-sm">{n.v ? <span className="naskh text-base">«{n.v}»</span> : GROUP_LABEL[n.g]}</p>
      <p className="mt-1 text-sm text-midad-soft">
        {[deathText(n.y), city ? (n.m ? `${city}، موطنه من المشهور في التراجم` : city) : "لا تدل نسبته على بلد", chainCount(n.k)].join(" · ")}
      </p>
    </div>
  );
}

function WideGrid({ chart }: { chart: Chart }) {
  const { year, rows, w, h } = chart;
  return (
    <g aria-hidden="true">
      {ERAS.map((e, i) => (
        <g key={e.label}>
          <rect x={year(e.to)} y={30} width={year(e.from) - year(e.to)} height={h - 36} fill="var(--raml)" opacity={i % 2 ? 0.28 : 0.55} />
          <text x={(year(e.from) + year(e.to)) / 2} y={22} textAnchor="middle" className="fill-midad-soft text-[12px]">{e.label}</text>
        </g>
      ))}
      <text x={year((YEARS + BEYOND) / 2)} y={22} textAnchor="middle" className="fill-midad-soft text-[11px]">بعد 260</text>
      {TICKS.map((t) => (
        <g key={t}>
          <line x1={year(t)} x2={year(t)} y1={30} y2={h - 6} stroke="var(--khatt)" />
          <text x={year(t)} y={62} textAnchor="middle" className="fill-midad-soft text-[12px] tabular-nums">{t}</text>
        </g>
      ))}
      {rows.map((r) => (
        <g key={r.id} opacity={r.id === NONE ? 0.65 : 1}>
          <line x1={0} x2={w} y1={r.start} y2={r.start} stroke="var(--khatt)" />
          <text x={w} y={r.start + r.size / 2 - 2} textAnchor="start" className="fill-midad font-[family-name:var(--font-naskh)] text-[15px] font-bold">{r.name}</text>
          <text x={w} y={r.start + r.size / 2 + 14} textAnchor="start" className="fill-midad-soft text-[11px]">{count(r.count)}</text>
        </g>
      ))}
    </g>
  );
}

function TallGrid({ chart }: { chart: Chart }) {
  const { year, rows, w } = chart;
  return (
    <g aria-hidden="true">
      {ERAS.map((e, i) => (
        <g key={e.label}>
          <rect x={0} y={year(e.from)} width={w} height={year(e.to) - year(e.from)} fill="var(--raml)" opacity={i % 2 ? 0.25 : 0.5} />
        </g>
      ))}
      {[...TICKS, 260].map((t) => (
        <g key={t}>
          <line x1={0} x2={w - 26} y1={year(t)} y2={year(t)} stroke="var(--khatt)" />
          <text x={w} y={year(t) + 4} textAnchor="start" className="fill-midad-soft text-[11px] tabular-nums">{t}</text>
        </g>
      ))}
      {rows.map((r) => (
        <line key={r.id} x1={r.start} x2={r.start} y1={0} y2={chart.h} stroke="var(--khatt)" opacity={0.6} />
      ))}
    </g>
  );
}
