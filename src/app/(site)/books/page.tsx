import type { Metadata } from "next";
import Link from "next/link";
import { hadithCount } from "@/lib/labels";
import { readData } from "@/lib/readData";

type Section = { no: number; ar: string; en: string | null; first: string; last: string; count: number };
type Stats = { hadiths: number; hadithsWithoutBook: number };

const sections = readData<Section[]>("sections.json");
const stats = readData<Stats>("stats.json");

export const metadata: Metadata = { title: "كتب صحيح البخاري · سَنَد" };

export default function BooksPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="naskh text-3xl font-bold leading-snug">كتب صحيح البخاري</h1>
      <p className="mt-1 max-w-2xl text-midad-soft">
        {sections.length} كتاباً تضم {stats.hadiths} حديثاً بترقيم النسخة المستعملة.
        {stats.hadithsWithoutBook > 0 && ` ${hadithCount(stats.hadithsWithoutBook)} لم تُنسب في البيانات إلى كتاب.`}
      </p>

      <ol className="mt-6 border-t border-khatt">
        {sections.map((s) => (
          <li
            key={s.no}
            id={`book-${s.no}`}
            className="grid scroll-mt-4 grid-cols-[2.5rem_1fr] items-baseline gap-x-3 border-b border-khatt py-3 target:bg-raml sm:grid-cols-[2.5rem_1fr_auto]"
          >
            <span className="text-sm tabular-nums text-midad-soft">{s.no}</span>
            <span className="min-w-0">
              <Link href={`/hadith/?n=${s.first}`} className="naskh text-xl leading-normal hover:text-nila">
                {s.ar}
              </Link>
              {s.en && (
                <span dir="ltr" lang="en" className="block text-end text-xs text-midad-soft sm:inline sm:ps-3">
                  {s.en}
                </span>
              )}
            </span>
            <span className="col-start-2 text-sm text-midad-soft sm:col-start-auto">
              <Link href={`/hadith/?n=${s.first}`} className="tabular-nums text-nila hover:underline">{s.first}</Link>
              {" إلى "}
              <Link href={`/hadith/?n=${s.last}`} className="tabular-nums text-nila hover:underline">{s.last}</Link>
              <span className="ps-2">({hadithCount(s.count)})</span>
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
