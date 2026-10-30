import type { Metadata } from "next";
import Link from "next/link";
import { GROUP_LABEL } from "@/lib/labels";
import { readData } from "@/lib/readData";

type Row = { t: number; total: number; counts: number[] };
type Insights = {
  formulas: { labels: string[]; rows: Row[]; unplaced: number; examples: { mostAn: string; leastAn: string } };
  regions: { labels: string[]; rows: Row[]; examples: { t: number; region: string; id: string; n: string }[] };
  lengths: { total: number; rows: { men: number; count: number; examples: string[] }[] };
  linked: { id: string; n: string; teachers: number; students: number }[];
};

export const metadata: Metadata = { title: "رؤى من البيانات · سَنَد" };

const data = readData<Insights>("insights.json");

const ORDINAL = ["", "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة", "الحادية عشرة", "الثانية عشرة"];
// left-to-right isolates keep the sign after the digits inside Arabic text
const percent = (share: number) => `⁦${Math.round(share)}%⁩`;
const pct = (n: number, total: number) => percent((100 * n) / total);
const LINK = "text-nila underline underline-offset-4 phone:inline-flex phone:min-h-11 phone:items-center";
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const lead = (row: Row) => row.counts.indexOf(Math.max(...row.counts));
/** Shades of one pigment, the strongest first: a part never relies on them, its name is written on it. */
const shade = (i: number, n: number) => 0.92 - (0.74 * i) / Math.max(1, n - 1);

export default function InsightsPage() {
  const { formulas, regions, lengths, linked } = data;

  // 1. the transmission words: "عن" and "حدثنا" as the figures have them
  const an = formulas.labels.indexOf("عن");
  const haddathana = formulas.labels.findIndex((l) => l.startsWith("حدثنا"));
  const leaders = formulas.rows.filter((r) => r.total >= 100);
  const lastAn = [...leaders].reverse().find((r) => lead(r) === an);
  const firstHaddathana = leaders.find((r) => lead(r) === haddathana);
  const anShare = lastAn ? pct(lastAn.counts[an], lastAn.total) : "";
  const haddathanaShare = firstHaddathana ? pct(firstHaddathana.counts[haddathana], firstHaddathana.total) : "";
  const counted = sum(formulas.rows.map((r) => r.total));

  // 2. where they lived: the region that leads the first generation and the one that leads the fullest
  const fullest = regions.rows.reduce((a, b) => (b.total > a.total ? b : a));
  const firstRow = regions.rows[0];

  // 3. the length of a full chain
  const commonest = lengths.rows.reduce((a, b) => (b.count > a.count ? b : a));
  const shortest = lengths.rows[0];
  const longest = lengths.rows[lengths.rows.length - 1];

  // 4. the most connected narrator
  const most = linked[0];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="naskh text-4xl font-bold leading-snug">رؤى من البيانات</h1>
      <p className="mt-2 text-midad-soft">أرقام وصفية من أسانيد صحيح البخاري في هذه البيانات، لا أحكام.</p>

      <Insight
        title="كيف تغيّرت صيغ الأداء عبر الطبقات؟"
        sentence={
          lastAn && firstHaddathana
            ? `تغلب «عن» حتى الطبقة ${ORDINAL[lastAn.t]} (${anShare} من صيغها)، ثم تغلب «حدثنا» من الطبقة ${ORDINAL[firstHaddathana.t]} (${haddathanaShare}).`
            : ""
        }
      >
        <Stacks rows={formulas.rows} labels={formulas.labels} pigment="var(--zinjafr)" />
        <p className="mt-3 text-xs leading-relaxed text-midad-soft">
          تُنسب الصيغة في كل صلة إلى من قالها، أي التلميذ، وفي أول صلة هو البخاري من الطبقة الحادية عشرة. حُسبت {counted} صلة، وبقيت {formulas.unplaced}{" "}
          لا تُعرف طبقة قائلها.
        </p>
        <Examples>
          <Link href={`/hadith/?n=${formulas.examples.mostAn}`} className={LINK}>الحديث {formulas.examples.mostAn}</Link>: سند تغلب عليه «عن».
          {" "}
          <Link href={`/hadith/?n=${formulas.examples.leastAn}`} className={LINK}>الحديث {formulas.examples.leastAn}</Link>: سند بالتحديث والسماع.
        </Examples>
      </Insight>

      <Insight
        title="أين عاش رواة كل طبقة؟"
        sentence={`في الطبقة ${ORDINAL[firstRow.t]} يتقدم ${regions.labels[lead(firstRow)]} (${pct(firstRow.counts[lead(firstRow)], firstRow.total)})، وفي الطبقة ${ORDINAL[fullest.t]}، وهي أكثر الطبقات رواة، يتقدم ${regions.labels[lead(fullest)]} (${pct(fullest.counts[lead(fullest)], fullest.total)}).`}
      >
        <Stacks rows={regions.rows} labels={regions.labels} pigment="var(--mughra)" />
        <p className="mt-3 text-xs leading-relaxed text-midad-soft">
          الأعداد نفسها التي على الخريطة الرئيسية: رواة تقريب التهذيب ممن تدل نسبتهم على بلد، مجموعة بالأقاليم، لا أماكن سماعهم.
        </p>
        <Examples>
          {regions.examples.map((e, i) => (
            <span key={e.id}>
              {i > 0 && " "}
              من الطبقة {ORDINAL[e.t]} في {e.region}:{" "}
              <Link href={`/narrator/?id=${e.id}`} className={LINK}>{e.n}</Link>.
            </span>
          ))}
        </Examples>
      </Insight>

      <Insight
        title="كم رجلاً في السند؟"
        sentence={`من ${lengths.total} سنداً تاماً، أكثرها ${commonest.men} رجال بين البخاري والنبي ﷺ (${pct(commonest.count, lengths.total)})، وأقصرها ${shortest.men} وأطولها ${longest.men}.`}
      >
        <ol className="space-y-2">
          {lengths.rows.map((r) => (
            <li key={r.men} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3">
              <span className="text-sm">{r.men} رجال</span>
              <span className="flex items-center gap-2">
                <span className="h-5 bg-mughra" style={{ width: `${(70 * r.count) / commonest.count}%`, minWidth: 3 }} aria-hidden="true" />
                <span className="text-sm tabular-nums">{r.count}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-midad-soft">
          الأسانيد التامة فقط: تتصل إلى النبي ﷺ، ورجالها كلهم معروفون، وآخرها صحابي، وأولها شيخ من الطبقة التاسعة فما بعدها، حتى لا تدخل الأسانيد المعلّقة.
        </p>
        <Examples>
          {[shortest, longest].map((r, i) => (
            <span key={r.men}>
              {i > 0 && " "}
              {r.men} رجال:{" "}
              {r.examples.map((n, k) => (
                <span key={n}>
                  {k > 0 && "، "}
                  <Link href={`/hadith/?n=${n}`} className={LINK}>الحديث {n}</Link>
                </span>
              ))}
              .
            </span>
          ))}
        </Examples>
      </Insight>

      <Insight
        title="من أكثر الرواة صلات؟"
        sentence={`${most.n} أكثرهم صلات: ${most.teachers + most.students} بين شيوخ وتلاميذ مختلفين في الأسانيد، دون البخاري نفسه.`}
      >
        <ol className="space-y-3">
          {linked.map((m) => {
            const top = linked[0].teachers + linked[0].students;
            return (
              <li key={m.id}>
                <Link href={`/narrator/?id=${m.id}`} className="naskh text-lg leading-normal text-nila underline underline-offset-4 phone:inline-flex phone:min-h-11 phone:items-center">
                  {m.n}
                </Link>
                <span className="mt-0.5 flex text-xs" style={{ width: `${Math.max(46, (100 * (m.teachers + m.students)) / top)}%` }}>
                  <span className="min-w-0 truncate bg-mughra px-1.5 py-0.5 text-raqq" style={{ flexGrow: m.teachers, flexBasis: 0, minWidth: "4.5rem" }}>
                    شيوخه {m.teachers}
                  </span>
                  <span className="min-w-0 truncate bg-mughra/35 px-1.5 py-0.5" style={{ flexGrow: m.students, flexBasis: 0, minWidth: "4.5rem" }}>
                    تلاميذه {m.students}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-midad-soft">
          عدد المختلفين ممن عُرفت تراجمهم، لا عدد المرات. وليس كثرة الصلات حكماً على الراوي: الحكم لفظ ابن حجر في ترجمته، ومجموعاته في الموقع من {GROUP_LABEL.sahabi} إلى {GROUP_LABEL.daif}.
        </p>
      </Insight>
    </main>
  );
}

function Insight({ title, sentence, children }: { title: string; sentence: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-khatt pt-6">
      <h2 className="naskh text-2xl font-bold leading-normal">{title}</h2>
      <p className="mb-4 mt-1 text-lg leading-relaxed">{sentence}</p>
      {children}
    </section>
  );
}

function Examples({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-loose">أمثلة: {children}</p>;
}

// the share of a bar wide enough to carry its name, on a wide screen and on a phone
const NAMED = 13;
const NAMED_PHONE = 34;

/** One bar for each generation: its parts carry their names, and those too thin to write on are named under it. */
function Stacks({ rows, labels, pigment }: { rows: Row[]; labels: string[]; pigment: string }) {
  return (
    <ol className="space-y-2.5">
      {rows.map((r) => {
        const parts = r.counts
          .map((c, i) => ({ i, c, share: (100 * c) / r.total }))
          .filter((p) => p.c > 0);
        const under = (limit: number) => parts.filter((p) => p.share < limit).map((p) => `${labels[p.i]} ${percent(p.share)}`).join(" · ");
        return (
          <li key={r.t}>
            <p className="text-xs text-midad-soft">
              الطبقة {ORDINAL[r.t]} <span className="tabular-nums">({r.total})</span>
            </p>
            <div className="mt-0.5 flex h-7 overflow-hidden text-xs" aria-hidden="true">
              {parts.map((p) => {
                const alpha = shade(p.i, labels.length);
                return (
                  <span
                    key={p.i}
                    className={`flex items-center justify-center overflow-hidden whitespace-nowrap ${alpha > 0.55 ? "text-raqq" : "text-midad"}`}
                    style={{ width: `${p.share}%`, background: `color-mix(in srgb, ${pigment} ${Math.round(alpha * 100)}%, transparent)` }}
                  >
                    {p.share >= NAMED && <span className={p.share < NAMED_PHONE ? "phone:hidden" : ""}>{labels[p.i]} {percent(p.share)}</span>}
                  </span>
                );
              })}
            </div>
            <p className="sr-only">{parts.map((p) => `${labels[p.i]} ${percent(p.share)}`).join("، ")}</p>
            <p className="mt-0.5 text-xs text-midad-soft phone:hidden" aria-hidden="true">{under(NAMED)}</p>
            <p className="mt-0.5 hidden text-xs text-midad-soft phone:block" aria-hidden="true">{under(NAMED_PHONE)}</p>
          </li>
        );
      })}
    </ol>
  );
}
