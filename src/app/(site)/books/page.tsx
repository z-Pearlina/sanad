import type { Metadata } from "next";
import Link from "next/link";
import { CountNum } from "@/components/CountUp";
import { hadithCount } from "@/lib/labels";
import { readData } from "@/lib/readData";

type Section = { no: number; ar: string; en: string | null; first: string; last: string; count: number };
type Stats = { hadiths: number; hadithsWithoutBook: number };

const sections = readData<Section[]>("sections.json");
const stats = readData<Stats>("stats.json");
const largest = Math.max(...sections.map((s) => s.count));

export const metadata: Metadata = { title: "كتب صحيح البخاري · سَنَد" };

/** The books of the Sahih as a manuscript's table of contents: one ruled line each. */
export default function BooksPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="naskh text-4xl font-bold leading-snug">فهرس كتب صحيح البخاري</h1>
      <p className="mt-2 max-w-2xl text-midad-soft">
        <CountNum value={sections.length} /> كتاباً تضم <CountNum value={stats.hadiths} /> حديثاً بترقيم النسخة المستعملة.
        {stats.hadithsWithoutBook > 0 && ` ${hadithCount(stats.hadithsWithoutBook)} لم تُنسب في البيانات إلى كتاب.`} اضغط على
        كتاب لتفتح أول حديث فيه.
      </p>

      <div
        className="mt-8 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-x-3 border-b-2 border-midad pb-1 text-xs text-midad-soft"
        aria-hidden="true"
      >
        <span>الرقم</span>
        <span>الكتاب</span>
        <span className="flex gap-3">
          <span className="w-24 text-center">الأحاديث</span>
          <span className="hidden w-24 sm:inline" />
          <span className="w-10 text-end">عددها</span>
        </span>
      </div>
      <ol>
        {sections.map((s) => (
          <li key={s.no} id={`book-${s.no}`} className="target:bg-raml">
            <Link
              href={`/hadith/?n=${s.first}`}
              title={s.en ?? undefined}
              className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-khatt py-2.5 transition-colors focus-visible:bg-raml/70"
            >
              <span className="text-sm tabular-nums text-midad-soft">{s.no}</span>
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="naskh text-xl leading-normal group-hover:text-nila">
                  {s.ar}
                  {/* the English title is a hover on the desktop, and a phone has no hover */}
                  {s.en && <span lang="en" dir="ltr" className="hidden font-sans text-xs text-midad-soft phone:block phone:text-start">{s.en}</span>}
                </span>
                <span className="hidden min-w-4 flex-1 border-b border-dotted border-midad-soft/50 sm:block" aria-hidden="true" />
              </span>
              <span className="flex items-center gap-3 text-sm">
                <bdi dir="ltr" className="w-24 text-center tabular-nums text-midad-soft">
                  {s.first}–{s.last}
                </bdi>
                <span className="relative hidden h-1 w-24 bg-mughra/25 sm:inline-block" aria-hidden="true">
                  <i className="absolute inset-y-0 start-0 bg-mughra" style={{ width: `${(100 * s.count) / largest}%` }} />
                </span>
                <span className="w-10 text-end tabular-nums">{s.count}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
