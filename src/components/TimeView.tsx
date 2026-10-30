"use client";

import { ChevronUp, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CountNum } from "./CountUp";
import Dara from "./Dara";
import { PHONE_QUERY } from "./sanad-map/phone";
import { getCities, getData } from "@/lib/data";
import { GROUP_COLOR, GROUP_LABEL, deathText } from "@/lib/labels";
import { nameWords } from "@/lib/names";
import type { City, Group } from "@/lib/types";

type Narr = { id: string; n: string; y: number; t: number | null; g: Group; v: string; c: string | null; m?: 1; k: number };
type Region = { id: string; name: string; cities: string[] };
type TimeFile = { total: number; dated: number; regions: Region[]; narrators: Narr[] };
type Row = Region & { short: string };
/** A cell of the table, or (no r) a whole decade. */
type Selection = { r?: number; d: number };
type Tip = { text: string; x: number; y: number };

const DECADES = Array.from({ length: 26 }, (_, i) => i); // 0–9 … 250 and after
const LAST = DECADES.length - 1;
const ERAS = [
  { label: "قبل 100هـ", from: 0, span: 10 },
  { label: "بعد 100هـ", from: 10, span: 10 },
  { label: "بعد 200هـ", from: 20, span: 6 },
];
const GROUPS: Group[] = ["sahabi", "thiqa", "saduq", "maqbul", "daif", "see"];
const NONE = "none";
const SHORT: Record<string, string> = { hijaz: "الحجاز", yemen: "اليمن", iraq: "العراق", jazira: "الجزيرة", sham: "الشام", misr: "مصر", east: "المشرق", none: "بلا نسبة" };
const BIG_REGIONS = 3; // named in the summary
const MIN_FOR_SUMMARY = 5;
const WINDOW = 3; // decades: thirty years

const decadeOf = (y: number) => Math.min(LAST, Math.floor(y / 10));
const span = (d: number) => (d === LAST ? "من 250هـ فما بعدها" : `بين ${d * 10} و${d * 10 + 9}هـ`);
const men = (n: number) => (n === 1 ? "راوٍ واحد" : n === 2 ? "راويان" : `${n} ${n % 100 >= 3 && n % 100 <= 10 ? "رواة" : "راوياً"}`);
const chains = (n: number) => (n === 1 ? "في سند واحد" : n === 2 ? "في سندين" : `في ${n} ${n % 100 >= 3 && n % 100 <= 10 ? "أسانيد" : "سنداً"}`);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** The sentence over the table: for each large region its thirty busiest years, in order of time. */
function summary(rows: Row[], grid: Narr[][][]) {
  const peaks = rows
    .map((row, r) => ({ row, cells: grid[r].map((c) => c.length) }))
    .filter(({ row }) => row.id !== NONE)
    .map((x) => ({ ...x, total: sum(x.cells) }))
    .filter((x) => x.total >= MIN_FOR_SUMMARY)
    .sort((a, b) => b.total - a.total)
    .slice(0, BIG_REGIONS)
    .map(({ row, cells }) => {
      let from = 0;
      for (let d = 1; d + WINDOW <= cells.length; d++) if (sum(cells.slice(d, d + WINDOW)) > sum(cells.slice(from, from + WINDOW))) from = d;
      return { id: row.id, name: row.short, from };
    })
    .sort((a, b) => a.from - b.from);
  if (!peaks.length) return "";
  const parts = peaks.map((p, i) => `${i ? "وفي" : "أكثر الوفيات في"} ${p.name} بين ${p.from * 10} و${(p.from + WINDOW) * 10 - 1}هـ`);
  const moved = peaks.map((p) => p.id).join() === "hijaz,iraq,east";
  return `${parts.join("، ")}${moved ? "، فترى ثقل الرواة ينتقل من الحجاز إلى العراق ثم إلى المشرق" : ""}.`;
}

export default function TimeView() {
  const wanted = useSearchParams().get("id");
  const [file, setFile] = useState<TimeFile | null>(null);
  const [cities, setCities] = useState<Record<string, City>>({});
  const [failed, setFailed] = useState(false);
  const [phone, setPhone] = useState(false);
  const [off, setOff] = useState<Set<Group>>(new Set());
  const [query, setQuery] = useState("");
  // undefined until the visitor chooses: the narrator in the address, else the fullest cell
  const [picked, setPicked] = useState<Selection | undefined>(undefined);
  const [focusId, setFocusId] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState<boolean | undefined>(undefined);
  const [hover, setHover] = useState<Selection | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  // the cells fill decade by decade the first time the table is seen
  const [fill, setFill] = useState<"wait" | "run" | "done">(() =>
    wanted || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "wait",
  );
  const stage = useRef<HTMLDivElement>(null);

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
    const el = stage.current;
    if (!el || fill !== "wait") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setFill("run");
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ready, fill]);

  const rows = useMemo<Row[]>(
    () => (file ? [...file.regions, { id: NONE, name: "بلا نسبة إلى بلد", cities: [] }].map((r) => ({ ...r, short: SHORT[r.id] })) : []),
    [file],
  );
  const rowOf = useMemo(() => {
    const at = new Map(rows.flatMap((r, i) => r.cities.map((c) => [c, i] as const)));
    return (n: Narr) => (n.c ? at.get(n.c) : undefined) ?? rows.length - 1;
  }, [rows]);

  const grid = useMemo(() => {
    const out = rows.map(() => DECADES.map(() => [] as Narr[]));
    for (const n of file?.narrators ?? []) if (!off.has(n.g)) out[rowOf(n)][decadeOf(n.y)].push(n);
    return out;
  }, [file, rows, rowOf, off]);

  const most = useMemo(() => Math.max(1, ...grid.flat().map((c) => c.length)), [grid]);
  const fullest = useMemo<Selection>(() => {
    let best: Selection = { r: 0, d: 0 };
    let size = 0;
    grid.forEach((row, r) =>
      row.forEach((c, d) => {
        if (c.length > size) {
          size = c.length;
          best = { r, d };
        }
      }),
    );
    return best;
  }, [grid]);

  const addressed = useMemo(() => file?.narrators.find((n) => n.id === wanted) ?? null, [file, wanted]);
  const chosen = picked ?? (addressed ? { r: rowOf(addressed), d: decadeOf(addressed.y) } : fullest);
  const sel = chosen.r === undefined || grid[chosen.r]?.[chosen.d]?.length ? chosen : fullest;
  const focus = focusId === undefined ? (addressed?.id ?? null) : focusId;
  const sheetOpen = sheet ?? Boolean(addressed);

  // the named narrator is brought into view in the list
  useEffect(() => {
    if (focus) document.getElementById(`man-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus, sel.r, sel.d, sheetOpen, phone, ready]);

  const results = useMemo(() => {
    const q = nameWords(query);
    if (!file || !q.length || query.trim().length < 2) return [];
    return file.narrators
      .filter((n) => {
        const w = nameWords(n.n);
        return q.every((x) => w.some((y) => y.startsWith(x)));
      })
      .slice(0, 6);
  }, [file, query]);

  if (failed) return <p className="py-16 text-center text-midad-soft">تعذّر تحميل البيانات. أعد تحميل الصفحة.</p>;
  if (!file) return <p className="py-16 text-center text-midad-soft">جارٍ تحميل الزمان…</p>;

  const pick = (s: Selection) => {
    setPicked(s);
    setFocusId(null);
    setSheet(true);
  };
  const findMan = (n: Narr) => {
    setOff(new Set());
    setQuery("");
    setPicked({ r: rowOf(n), d: decadeOf(n.y) });
    setFocusId(n.id);
    setSheet(true);
  };
  const point = (s: Selection, text: string, el: HTMLElement) => {
    setHover(s);
    const box = stage.current?.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    if (box) setTip({ text, x: b.left - box.left + b.width / 2, y: b.top - box.top });
  };
  const leave = () => {
    setHover(null);
    setTip(null);
  };
  const cellLabel = (r: number, d: number) => `${rows[r].short}، ${span(d)}: ${men(grid[r][d].length)}`;
  const decadeTotal = (d: number) => sum(grid.map((row) => row[d].length));
  const allDecades = DECADES.map(decadeTotal);
  const late = file.narrators.filter((n) => n.y >= 260).length;

  const title = sel.r === undefined ? `${span(sel.d)}: ${men(decadeTotal(sel.d))}` : cellLabel(sel.r, sel.d);
  const list = <Roster sel={sel} rows={rows} grid={grid} cities={cities} focus={focus} />;
  const tableProps = { rows, grid, most, sel, hover, allDecades, pick, point, leave, cellLabel };

  return (
    <main className={`mx-auto max-w-6xl px-4 py-6 phone:px-1 ${phone ? "pb-24" : ""}`}>
      <div className="phone:px-2.5">
        <h1 className="naskh text-4xl font-bold leading-snug">الزمان</h1>
        <p className="mt-1 max-w-3xl text-midad-soft">
          جدول الوفيات: كم توفي من رجال أسانيد البخاري في كل عقد، وفي كل إقليم.{" "}
          <strong className="font-semibold text-midad"><CountNum value={file.dated} /> من <CountNum value={file.total} /> راوياً لهم سنة وفاة معروفة.</strong>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 phone:flex-nowrap phone:overflow-x-auto" role="group" aria-label="مجموعات المراتب">
          {GROUPS.filter((g) => file.narrators.some((n) => n.g === g)).map((g) => (
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
              {GROUP_LABEL[g]} <span className="tabular-nums text-midad-soft">{file.narrators.filter((n) => n.g === g).length}</span>
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
            placeholder="ابحث عن راوٍ لتصل إلى خانته"
            className="w-full rounded-sm border border-khatt bg-raqq px-3 py-2 text-base phone:min-h-11"
          />
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-30 border border-t-0 border-khatt bg-raqq shadow-md">
              {results.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => findMan(n)} className="flex w-full items-baseline justify-between gap-3 px-3 py-1.5 text-start hover:bg-raml phone:min-h-11">
                    <span className="naskh text-lg leading-normal">{n.n}</span>
                    <span className="text-xs tabular-nums text-midad-soft">{deathText(n.y)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="naskh mt-5 border-s-2 border-mughra ps-3 text-xl leading-loose">{summary(rows, grid)}</p>
      </div>

      <div ref={stage} className={`relative mt-4 deaths-${fill}`}>
        {phone ? <TallTable {...tableProps} /> : <WideTable {...tableProps} />}
        {tip && (
          <div className="deaths-tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
            {tip.text}
          </div>
        )}
      </div>

      {!phone && (
        <section className="mt-6 border-t border-khatt pt-4" aria-live="polite">
          <h2 className="naskh text-2xl font-bold leading-normal">{title}</h2>
          {list}
        </section>
      )}

      <p className="mt-6 text-xs leading-relaxed text-midad-soft phone:px-2.5">
        سنوات الوفاة من تقريب التهذيب، وما صُحّح منها مذكور في صفحة «حول». ومن لا تُعرف وفاته لا يُقدَّر هنا، والأقاليم بحسب النسبة.
        {late > 0 && ` ويضم العقد الأخير ${men(late)} توفوا بعد سنة 259هـ.`}
      </p>

      {phone && !sheetOpen && (
        <button type="button" onClick={() => setSheet(true)} className="deaths-peek">
          <span>{title}</span>
          <span className="flex shrink-0 items-center gap-1 text-nila">
            رجالها
            <ChevronUp size={16} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </button>
      )}
      {phone && sheetOpen && (
        <BottomSheet title={title} onClose={() => setSheet(false)}>
          {list}
        </BottomSheet>
      )}
    </main>
  );
}

type TableProps = {
  rows: Row[];
  grid: Narr[][][];
  most: number;
  sel: Selection;
  hover: Selection | null;
  allDecades: number[];
  pick: (s: Selection) => void;
  point: (s: Selection, text: string, el: HTMLElement) => void;
  leave: () => void;
  cellLabel: (r: number, d: number) => string;
};

/** Arrow keys walk the cells that have narrators; the Tab key enters the table at the chosen one. */
function walk(e: React.KeyboardEvent, rows: number, across: boolean) {
  const el = e.target as HTMLElement;
  if (el.dataset.r === undefined) return;
  const moves: Record<string, [number, number]> = across
    ? { ArrowLeft: [0, 1], ArrowRight: [0, -1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
    : { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const step = moves[e.key];
  if (!step) return;
  e.preventDefault();
  for (let r = Number(el.dataset.r) + step[0], d = Number(el.dataset.d) + step[1]; r >= 0 && r < rows && d >= 0 && d <= LAST; r += step[0], d += step[1]) {
    const next = el.closest("table")?.querySelector<HTMLElement>(`[data-r="${r}"][data-d="${d}"]`);
    if (next) {
      next.focus();
      return;
    }
  }
}

function Cell({ r, d, t }: { r: number; d: number; t: TableProps }) {
  const n = t.grid[r][d].length;
  const on = t.sel.r === r && t.sel.d === d;
  const lit = t.hover && (t.hover.d === d || t.hover.r === r);
  if (!n) {
    return (
      <td className={lit ? "deaths-lit" : undefined}>
        <span className="deaths-empty"><span className="sr-only">لا أحد</span></span>
      </td>
    );
  }
  // the square root keeps the small counts visible beside the great ones
  const strength = Math.round(16 + 84 * Math.sqrt(n / t.most));
  const pigment = t.rows[r].id === NONE ? "var(--midad-soft)" : "var(--mughra)";
  const label = t.cellLabel(r, d);
  return (
    <td className={lit ? "deaths-lit" : undefined}>
      <button
        type="button"
        data-r={r}
        data-d={d}
        tabIndex={on ? 0 : -1}
        aria-label={label}
        aria-pressed={on}
        className="deaths-cell"
        style={{
          "--d": d,
          background: `color-mix(in srgb, ${pigment} ${strength}%, transparent)`,
          color: strength >= 72 ? "var(--raqq)" : "var(--midad)",
        } as React.CSSProperties}
        onClick={() => t.pick({ r, d })}
        onPointerEnter={(e) => e.pointerType === "mouse" && t.point({ r, d }, label, e.currentTarget)}
        onPointerLeave={t.leave}
        onFocus={(e) => t.point({ r, d }, label, e.currentTarget)}
        onBlur={t.leave}
      >
        {n}
      </button>
    </td>
  );
}

function WideTable(t: TableProps) {
  const tallest = Math.max(1, ...t.allDecades);
  return (
    <table className="deaths w-full table-fixed" onKeyDown={(e) => walk(e, t.rows.length, true)}>
      <caption className="sr-only">عدد من توفي من رجال أسانيد البخاري في كل عقد وكل إقليم. الأقدم في أول الجدول من اليمين.</caption>
      <thead>
        <tr className="deaths-eras">
          <td className="w-32" />
          {ERAS.map((e) => (
            <th key={e.label} colSpan={e.span} scope="colgroup">
              <span>{e.label}</span>
            </th>
          ))}
        </tr>
        <tr>
          <td />
          {DECADES.map((d) => {
            const n = t.allDecades[d];
            const on = t.sel.r === undefined && t.sel.d === d;
            return (
              <th key={d} scope="col" className={`deaths-col ${t.hover?.d === d ? "deaths-lit" : ""}`}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${span(d)}: ${men(n)} في كل الأقاليم`}
                  onClick={() => t.pick({ d })}
                  className={on ? "is-on" : undefined}
                >
                  <span className="tabular-nums">{n || ""}</span>
                  <i className="deaths-bar" style={{ height: (72 * n) / tallest, "--d": d } as React.CSSProperties} />
                </button>
                <b aria-hidden="true">{d % 5 === 0 ? d * 10 : ""}</b>
                {d === LAST && (
                  <span className="deaths-bukhari" aria-hidden="true">
                    <em>وفاة البخاري 256هـ</em>
                  </span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {t.rows.map((row, r) => (
          <Fragment key={row.id}>
            {row.id === NONE && (
              <tr aria-hidden="true">
                <td colSpan={DECADES.length + 1} className="h-3" />
              </tr>
            )}
            <tr>
              <th scope="row" className={`deaths-row ${t.hover?.r === r ? "deaths-lit" : ""}`}>
                <span className="naskh block text-[17px] font-bold leading-tight">{row.name}</span>
                <span className="block text-xs font-normal text-midad-soft">{men(sum(t.grid[r].map((c) => c.length)))}</span>
              </th>
              {DECADES.map((d) => (
                <Cell key={d} r={r} d={d} t={t} />
              ))}
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

/** On a phone the decades are the rows and the regions the columns, so the page scrolls through time. */
function TallTable(t: TableProps) {
  return (
    <table className="deaths deaths-tall w-full table-fixed" onKeyDown={(e) => walk(e, t.rows.length, false)}>
      <caption className="sr-only">عدد من توفي من رجال أسانيد البخاري في كل عقد وكل إقليم. الأقدم في أول الجدول من الأعلى.</caption>
      <thead>
        <tr>
          <th scope="col" className="w-[30px]">العقد</th>
          {t.rows.map((row) => (
            <th key={row.id} scope="col">{row.short}</th>
          ))}
          <th scope="col" className="w-[30px]">الكل</th>
        </tr>
      </thead>
      <tbody>
        {DECADES.map((d) => (
          <Fragment key={d}>
            {ERAS.some((e) => e.from === d) && (
              <tr className="deaths-era-row">
                <td colSpan={t.rows.length + 2}>{ERAS.find((e) => e.from === d)?.label}</td>
              </tr>
            )}
            <tr>
              <th scope="row" className="deaths-decade">{d * 10}</th>
              {t.rows.map((row, r) => (
                <Cell key={row.id} r={r} d={d} t={t} />
              ))}
              <td>
                <button
                  type="button"
                  aria-pressed={t.sel.r === undefined && t.sel.d === d}
                  aria-label={`${span(d)}: ${men(t.allDecades[d])} في كل الأقاليم`}
                  onClick={() => t.pick({ d })}
                  className={`deaths-total ${t.sel.r === undefined && t.sel.d === d ? "is-on" : ""}`}
                >
                  {t.allDecades[d] || ""}
                </button>
              </td>
            </tr>
          </Fragment>
        ))}
        <tr className="deaths-bukhari-row">
          <td colSpan={t.rows.length + 2}>وفاة البخاري 256هـ</td>
        </tr>
      </tbody>
    </table>
  );
}

function Roster({ sel, rows, grid, cities, focus }: { sel: Selection; rows: Row[]; grid: Narr[][][]; cities: Record<string, City>; focus: string | null }) {
  const entry = (n: Narr) => {
    const city = n.c ? cities[n.c]?.ar : null;
    return (
      <li key={n.id} id={`man-${n.id}`} className={`flex gap-2.5 rounded-sm p-1 ${n.id === focus ? "bg-raml" : ""}`}>
        <span className="pt-2"><Dara group={n.g} size={18} /></span>
        <div className="min-w-0">
          <Link href={`/narrator/?id=${n.id}`} className="naskh text-lg leading-normal text-nila underline underline-offset-4 phone:inline-flex phone:min-h-11 phone:items-center">
            {n.n}
          </Link>
          <p className="text-sm leading-relaxed text-midad-soft">
            {[n.v || GROUP_LABEL[n.g], deathText(n.y), city ? (n.m ? `${city}، موطنه من المشهور في التراجم` : city) : "لا تدل نسبته على بلد", chains(n.k)].join("، ")}
          </p>
        </div>
      </li>
    );
  };
  const columns = "grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4";
  if (sel.r !== undefined) {
    return (
      <>
        <p className="mb-3 text-sm text-midad-soft">مرتبون بعدد ورودهم في أسانيد البخاري، مع حكم ابن حجر.</p>
        <ul className={columns}>{grid[sel.r][sel.d].map(entry)}</ul>
      </>
    );
  }
  return (
    <>
      <p className="mb-3 text-sm text-midad-soft">مجموعون بالإقليم، مرتبون بعدد ورودهم في أسانيد البخاري، مع حكم ابن حجر.</p>
      {rows.map((row, r) =>
        grid[r][sel.d].length ? (
          <section key={row.id} className="mb-4">
            <h3 className="naskh mb-1 text-lg font-bold">
              {row.name} <span className="font-sans text-sm font-normal text-midad-soft">{men(grid[r][sel.d].length)}</span>
            </h3>
            <ul className={columns}>{grid[r][sel.d].map(entry)}</ul>
          </section>
        ) : null,
      )}
    </>
  );
}

const DRAG_TO_CLOSE = 70;

/** The narrators of the chosen cell on a phone: drag the head down, or press the button, to close. */
function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const moved = useRef(0);

  const move = (e: React.PointerEvent) => {
    if (start.current === null || !panel.current) return;
    moved.current = Math.max(0, e.clientY - start.current);
    panel.current.style.transform = `translateY(${moved.current}px)`;
  };
  const end = () => {
    if (start.current === null) return;
    start.current = null;
    // it slides away before it leaves the page: removing the element under a finger that has
    // only just lifted makes the browser drop the next tap
    if (moved.current > DRAG_TO_CLOSE && panel.current) {
      panel.current.style.transition = "transform 0.18s ease-in";
      panel.current.style.transform = "translateY(100%)";
      window.setTimeout(onClose, 200);
    } else if (panel.current) panel.current.style.transform = "";
    moved.current = 0;
  };

  return (
    <div ref={panel} className="deaths-sheet" role="dialog" aria-label={title}>
      <div
        className="deaths-sheet-head"
        onPointerDown={(e) => {
          if ((e.target as Element).closest("button")) return;
          start.current = e.clientY;
          if (e.pointerType === "mouse") e.currentTarget.setPointerCapture(e.pointerId); // a touch is captured by itself
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <i aria-hidden="true" />
        <h2 className="naskh text-lg font-bold leading-snug">{title}</h2>
        <button type="button" onClick={onClose} aria-label="إغلاق" className="grid size-11 shrink-0 place-items-center">
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="deaths-sheet-body">{children}</div>
    </div>
  );
}
