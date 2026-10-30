"use client";

import { Map as MapIcon, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Dara from "./Dara";
import { NOUNS, nounFor, tabaqaName } from "@/lib/labels";
import type { Group } from "@/lib/types";

export type Row = { t: number; total: number; counts: number[] };
export type Turning = { n: string; title: string; until: string; from: string } | null;
export type Length = { men: number; count: number; examples: string[] };
export type Linked = { id: string; n: string; g: Group; teachers: number; students: number };

// left-to-right isolates keep the sign after the digits inside Arabic text
const percent = (share: number) => `⁦${Math.round(share)}%⁩`;
const shareOf = (r: Row, i: number) => (100 * r.counts[i]) / r.total;

/** The element has come into view: the charts draw themselves once, then answer the pointer. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setSeen(true);
        io.disconnect();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

// ---------------------------------------------------------------- the words of transmission

const GENS = 11; // the twelfth generation has three links, too few for a share
const AXIS = [0, 25, 50, 75, 100];
const DASHES = ["5 3", "1.5 3", "7 3 1.5 3", "3 2", "9 3"];
/** Distance of a generation from the right of the plot, in percent: the same reading as the generations strip. */
const fromRight = (t: number) => ((t - 0.5) / GENS) * 100;

/** Where "عن" falls under "حدثنا": between which generations, and at what height. */
function crossing(rows: Row[], a: number, b: number) {
  for (let i = 0; i + 1 < rows.length; i++) {
    const before = shareOf(rows[i], a) - shareOf(rows[i], b);
    const after = shareOf(rows[i + 1], a) - shareOf(rows[i + 1], b);
    if (before > 0 && after <= 0) {
      const part = before / (before - after);
      return {
        from: rows[i].t,
        to: rows[i + 1].t,
        t: rows[i].t + part,
        share: shareOf(rows[i], a) + part * (shareOf(rows[i + 1], a) - shareOf(rows[i], a)),
      };
    }
  }
  return null;
}

export function FormulaChart({ labels, rows, turning }: { labels: string[]; rows: Row[]; turning: Turning }) {
  const data = rows.filter((r) => r.t <= GENS);
  const an = labels.indexOf("عن");
  const told = labels.findIndex((l) => l.startsWith("حدثنا"));
  const turn = crossing(data, an, told);
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const [off, setOff] = useState<Set<number>>(new Set());

  const inkOf = (i: number) => (i === an ? "var(--zinjafr)" : i === told ? "var(--midad)" : "var(--midad-soft)");
  const dashOf = (i: number) => (i === an || i === told ? undefined : DASHES[(i > told ? i - 2 : i - 1) % DASHES.length]);
  const path = (i: number) =>
    data.map((r, k) => `${k ? "L" : "M"}${(100 - fromRight(r.t)).toFixed(2)},${(100 - shareOf(r, i)).toFixed(2)}`).join("");
  const toggle = (i: number) => {
    const next = new Set(off);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setOff(next);
  };
  const atRow = data.find((r) => r.t === at);
  const pinned = data.find((r) => r.t === (at ?? turn?.to)) ?? data[data.length - 1];
  const onRight = at !== null && at <= 6;

  return (
    <div>
      <div className="fchart-keys" role="group" aria-label="إظهار الصيغ وإخفاؤها">
        {labels.map((l, i) => (
          <button key={l} type="button" aria-pressed={!off.has(i)} onClick={() => toggle(i)}>
            <svg width="20" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="20" y2="3" stroke={inkOf(i)} strokeWidth={i === an || i === told ? 2.5 : 1.5} strokeDasharray={dashOf(i)} />
            </svg>
            {l}
          </button>
        ))}
      </div>

      <div ref={ref} className="fchart">
        <div className="fchart-plot" onPointerLeave={() => setAt(null)}>
          {AXIS.map((v) => (
            <span key={v} className="fchart-y" style={{ top: `${100 - v}%` }} aria-hidden="true">
              <bdi dir="ltr">{v}%</bdi>
            </span>
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {AXIS.map((v) => (
              <line key={v} x1="0" x2="100" y1={100 - v} y2={100 - v} stroke="var(--khatt)" strokeWidth="1" />
            ))}
            {labels.map((_, i) =>
              i === an || i === told || off.has(i) ? null : (
                <path key={i} d={path(i)} stroke="var(--midad-soft)" strokeOpacity="0.5" strokeWidth="1.25" strokeDasharray={dashOf(i)} />
              ),
            )}
          </svg>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`fchart-bold ${seen ? "is-on" : ""}`} aria-hidden="true">
            {[told, an].map((i) => (off.has(i) ? null : <path key={i} d={path(i)} stroke={inkOf(i)} strokeWidth="2.5" />))}
          </svg>

          {[
            { i: an, t: 3 },
            { i: told, t: 10 },
          ].map(({ i, t }) =>
            off.has(i) ? null : (
              <span key={i} className="fchart-name" style={{ right: `${fromRight(t)}%`, top: `${100 - shareOf(data[t - 1], i)}%`, color: inkOf(i) }} aria-hidden="true">
                {i === an ? labels[i] : "حدثنا"}
              </span>
            ),
          )}

          {turn && !off.has(an) && !off.has(told) && (
            <>
              <i className="fchart-turn" style={{ right: `${fromRight(turn.t)}%`, top: `${100 - turn.share}%` }} aria-hidden="true" />
              <p className="fchart-note" style={{ left: `calc(${100 - fromRight(turn.t)}% + 16px)`, top: `${100 - turn.share}%` }}>
                بين الطبقتين {turn.from} و{turn.to} تنقلب الصورة
              </p>
            </>
          )}

          {atRow && (
            <>
              <i className="fchart-at" style={{ right: `${fromRight(atRow.t)}%` }} aria-hidden="true" />
              {labels.map((_, i) =>
                off.has(i) ? null : (
                  <i key={i} className="fchart-dot" style={{ right: `${fromRight(atRow.t)}%`, top: `${100 - shareOf(atRow, i)}%`, background: inkOf(i) }} aria-hidden="true" />
                ),
              )}
              <div className="fchart-panel" style={onRight ? { right: `calc(${fromRight(atRow.t)}% + 12px)` } : { left: `calc(${100 - fromRight(atRow.t)}% + 12px)` }}>
                <GenerationWords row={atRow} labels={labels} off={off} inkOf={inkOf} dashOf={dashOf} />
              </div>
            </>
          )}

          <div className="fchart-cols" role="group" aria-label="الطبقات">
            {data.map((r) => (
              <button
                key={r.t}
                type="button"
                aria-label={tabaqaName(r.t)}
                aria-pressed={at === r.t}
                onPointerEnter={(e) => e.pointerType === "mouse" && setAt(r.t)}
                onFocus={() => setAt(r.t)}
                onClick={() => setAt(r.t)}
              >
                <span>{r.t}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* a phone has no hover: the figures of the generation last touched stay under the chart */}
      <div className="fchart-flow" aria-live="polite">
        <GenerationWords row={pinned} labels={labels} off={off} inkOf={inkOf} dashOf={dashOf} />
      </div>

      {turning && (
        <p className="mt-3 text-sm leading-loose">
          مثال:{" "}
          <Link href={`/hadith/?n=${turning.n}`} className="text-nila underline underline-offset-4 phone:inline-flex phone:min-h-11 phone:items-center">
            الحديث {turning.n}
          </Link>{" "}
          «{turning.title}»: «حدثنا» و«أخبرنا» حتى {turning.until}، ثم «عن» من {turning.from} إلى آخر السند.
        </p>
      )}
    </div>
  );
}

function GenerationWords({
  row,
  labels,
  off,
  inkOf,
  dashOf,
}: {
  row: Row;
  labels: string[];
  off: Set<number>;
  inkOf: (i: number) => string;
  dashOf: (i: number) => string | undefined;
}) {
  return (
    <>
      <p className="fchart-panel-head">
        {tabaqaName(row.t)}
        <span>
          {row.total.toLocaleString("en-US")} {nounFor(row.total, NOUNS.sila)}
        </span>
      </p>
      <ul>
        {labels.map((l, i) => (
          <li key={l} className={off.has(i) ? "opacity-40" : undefined}>
            <svg width="14" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="14" y2="3" stroke={inkOf(i)} strokeWidth="2" strokeDasharray={dashOf(i)} />
            </svg>
            <span className="flex-1">{l}</span>
            <b>{percent(shareOf(row, i))}</b>
            <span className="fchart-count">{row.counts[i].toLocaleString("en-US")}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- where each generation lived

const STEP_MS = 1500;
const ERAS = ["قبل 100هـ", "بعد 100هـ", "بعد 200هـ"];

export function RegionChart({ labels, rows }: { labels: string[]; rows: Row[] }) {
  const [t, setT] = useState(rows[0].t);
  const [playing, setPlaying] = useState(false);
  const [pick, setPick] = useState<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (t >= rows.length) setPlaying(false);
      else setT(t + 1);
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, t, rows.length]);

  const row = rows.find((r) => r.t === t) ?? rows[0];
  const top = Math.max(...row.counts);
  const lead = row.counts.indexOf(top);
  const Icon = playing ? Pause : Play;

  return (
    <div>
      <div className="gens-bar">
        <button
          type="button"
          className="gens-play"
          aria-label={playing ? "إيقاف" : "تشغيل الطبقات"}
          onClick={() => {
            if (!playing && t >= rows.length) setT(rows[0].t);
            setPlaying(!playing);
          }}
        >
          <Icon size={18} strokeWidth={1.5} className={playing ? undefined : "-scale-x-100"} aria-hidden="true" />
        </button>
        <div className="gens-strip" role="group" aria-label="الطبقات">
          <i className="gens-progress" style={{ width: `${((t - 1) / (rows.length - 1)) * 91.67}%` }} aria-hidden="true" />
          {rows.map((r) => (
            <button
              key={r.t}
              type="button"
              className={`gens-btn ${r.t < t ? "is-past" : ""}`}
              aria-label={tabaqaName(r.t)}
              aria-current={r.t === t ? "step" : undefined}
              onClick={() => {
                setPlaying(false);
                setT(r.t);
              }}
            >
              <i aria-hidden="true" />
              <b>{r.t}</b>
            </button>
          ))}
          <div className="gens-eras" aria-hidden="true">
            {ERAS.map((e) => (
              <span key={e}>{e}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="naskh text-xl leading-normal" aria-live="polite">
          {tabaqaName(t)}: {row.total} {nounFor(row.total, NOUNS.rawi)}، يتقدمهم {labels[lead]}.
        </p>
        <Link href={`/?gen=${t}`} className="line-button">
          <MapIcon size={16} strokeWidth={1.5} aria-hidden="true" />
          شاهدها على الخريطة
        </Link>
      </div>

      <ol className="mt-3" onPointerLeave={() => setPick(null)}>
        {labels.map((name, i) => {
          const n = row.counts[i];
          // the leading region in full ochre, the others in lighter washes of it
          const strength = Math.round(26 + 74 * Math.sqrt(n / Math.max(1, top)));
          return (
            <li key={name}>
              <button
                type="button"
                className="region-row"
                onPointerEnter={(e) => e.pointerType === "mouse" && setPick(i)}
                onFocus={() => setPick(i)}
                onClick={() => setPick(pick === i ? null : i)}
                aria-label={`${name}: ${n} ${nounFor(n, NOUNS.rawi)}، ${Math.round(shareOf(row, i))} بالمائة`}
              >
                <span className="naskh text-[17px] leading-tight">{name}</span>
                <span className="region-track">
                  <i
                    style={{
                      "--share": n / Math.max(1, top),
                      background: `color-mix(in srgb, var(--mughra) ${strength}%, transparent)`,
                    } as React.CSSProperties}
                  />
                  <span className="text-sm tabular-nums">{pick === i ? percent(shareOf(row, i)) : n}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- the length of a chain

export function LengthChart({ total, rows }: { total: number; rows: Length[] }) {
  const most = Math.max(...rows.map((r) => r.count));
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [pick, setPick] = useState(rows.find((r) => r.count === most)?.men ?? rows[0].men);
  const picked = rows.find((r) => r.men === pick);

  return (
    <div>
      <div ref={ref} className="len-cols" role="group" aria-label="عدد الرجال في السند">
        {rows.map((r) => (
          <button
            key={r.men}
            type="button"
            className="len-col"
            aria-pressed={pick === r.men}
            aria-label={`${r.men} رجال: ${r.count} سنداً، ${Math.round((100 * r.count) / total)} بالمائة`}
            onClick={() => setPick(r.men)}
          >
            <span>
              {r.count} · {percent((100 * r.count) / total)}
            </span>
            <i style={{ height: seen ? `${(82 * r.count) / most}%` : 0 }} />
            <b>{r.men} رجال</b>
          </button>
        ))}
      </div>
      {picked && (
        <p className="mt-3 text-sm leading-loose" aria-live="polite">
          {picked.men} رجال:{" "}
          {picked.examples.map((n, i) => (
            <span key={n}>
              {i > 0 && "، "}
              <Link href={`/hadith/?n=${n}`} className="text-nila underline underline-offset-4 phone:inline-flex phone:min-h-11 phone:items-center">
                الحديث {n}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the most connected narrators

export function LinkedChart({ men }: { men: Linked[] }) {
  const most = Math.max(...men.map((m) => m.teachers + m.students));
  const [ref, seen] = useSeen<HTMLOListElement>();
  return (
    <div>
      <p className="mb-2 flex gap-4 text-xs text-midad-soft" aria-hidden="true">
        <span className="flex items-center gap-1.5"><i className="linked-key bg-midad" />شيوخه</span>
        <span className="flex items-center gap-1.5"><i className="linked-key bg-midad-soft/55" />تلاميذه</span>
      </p>
      <ol ref={ref}>
        {men.map((m) => {
          const all = m.teachers + m.students;
          return (
            <li key={m.id} className="linked-row">
              <Dara group={m.g} size={16} />
              <Link href={`/narrator/?id=${m.id}`} className="naskh truncate text-[17px] leading-normal text-nila underline underline-offset-4 phone:flex phone:min-h-11 phone:items-center">
                {m.n}
              </Link>
              <span className="flex min-w-0 items-center gap-2">
                <span className="linked-bar" style={{ "--share": seen ? all / most : 0 } as React.CSSProperties} aria-hidden="true">
                  <i className="bg-midad" style={{ flexGrow: m.teachers }} />
                  <i className="bg-midad-soft/55" style={{ flexGrow: m.students }} />
                </span>
                <span className="linked-fig tabular-nums">
                  <span className="linked-all">{all}</span>
                  <span className="linked-both">
                    {m.teachers} + {m.students}
                  </span>
                </span>
                <span className="sr-only">
                  {m.teachers} {nounFor(m.teachers, NOUNS.shaykh)} و{m.students} {nounFor(m.students, NOUNS.tilmidh)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
