"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Chain from "./Chain";
import HadithText from "./HadithText";
import Salla from "./Salla";
import Timeline from "./Timeline";
import { getCities, getHadith } from "@/lib/data";
import { fetchUmmahHadith, type UmmahHadith } from "@/lib/ummah";
import type { City, Hadith } from "@/lib/types";

type Loaded = { hadith: Hadith; cities: Record<string, City> };

export default function HadithView({ n }: { n: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [ummah, setUmmah] = useState<UmmahHadith | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([getHadith(n), getCities()])
      .then(([hadith, cities]) => live && setData({ hadith, cities }))
      .catch(() => live && setMissing(true));
    fetchUmmahHadith(n).then((h) => live && setUmmah(h));
    return () => {
      live = false;
    };
  }, [n]);

  if (missing) {
    return (
      <p className="py-16 text-center text-midad-soft">
        لا يوجد حديث برقم {n} في صحيح البخاري. <Link href="/" className="text-nila underline">العودة إلى الرئيسية</Link>
      </p>
    );
  }
  if (!data) return <p className="py-16 text-center text-midad-soft">جارٍ تحميل الحديث…</p>;

  const { hadith, cities } = data;
  // Use the Ummah API text when its chains sit exactly where ours do, so the markup still fits.
  const fromUmmah =
    ummah !== null &&
    hadith.isnads.every((s) => s.start < 0 || ummah.arabic.slice(s.start, s.end) === hadith.ar.slice(s.start, s.end));
  const text = fromUmmah ? ummah.arabic : hadith.ar;
  const english = fromUmmah && ummah.english ? ummah.english : hadith.en;
  const isnad = hadith.isnads[Math.min(tab, hadith.isnads.length - 1)];

  return (
    <article className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-khatt pb-3">
        <div>
          <h1 className="naskh text-3xl font-bold leading-snug">الحديث {hadith.n}</h1>
          {hadith.book && (
            <p className="text-sm text-midad-soft">
              <Link href={`/books/#book-${hadith.book.no}`} className="hover:text-nila">
                {hadith.book.title}
              </Link>{" "}
              · الكتاب {hadith.book.no}
            </p>
          )}
        </div>
        <nav className="flex gap-4 text-sm" aria-label="التنقل بين الأحاديث">
          {hadith.prev && (
            <Link href={`/hadith/?n=${hadith.prev}`} className="text-nila hover:underline">
              → الحديث {hadith.prev}
            </Link>
          )}
          {hadith.next && (
            <Link href={`/hadith/?n=${hadith.next}`} className="text-nila hover:underline">
              الحديث {hadith.next} ←
            </Link>
          )}
        </nav>
      </header>

      <section className="py-6" aria-label="نص الحديث">
        <HadithText text={text} isnads={hadith.isnads} />
        <p className="mt-3 text-xs text-midad-soft">
          {fromUmmah ? (
            <span className="rounded-sm border border-khatt px-1.5 py-0.5">النص من Ummah API</span>
          ) : (
            <span>النص من نسخة fawazahmed0/hadith-api</span>
          )}
        </p>
        {english && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-nila">الترجمة الإنجليزية</summary>
            <p dir="ltr" lang="en" className="mt-2 leading-relaxed text-midad-soft">
              {english}
            </p>
          </details>
        )}
      </section>

      {hadith.isnads.length > 1 && (
        <div role="tablist" aria-label="أسانيد الحديث" className="flex gap-1 border-b border-khatt">
          {hadith.isnads.map((s, i) => (
            <button
              key={s.ordinal}
              role="tab"
              aria-selected={i === tab}
              onClick={() => setTab(i)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${i === tab ? "border-nila text-nila" : "border-transparent text-midad-soft"}`}
            >
              السند {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="chain-h">
          <h2 id="chain-h" className="naskh mb-1 text-2xl font-bold">السلسلة</h2>
          <p className="mb-4 text-sm text-midad-soft">
            {isnad.toProphet && <>يتصل إلى النبي <Salla />. </>}
            حكم كل راوٍ بلفظ ابن حجر في تقريب التهذيب.
          </p>
          {isnad.problem && <p className="mb-4 border-s-2 border-khatt ps-3 text-sm">{isnad.problem}</p>}
          <Chain isnad={isnad} cities={cities} />
        </section>
        <section aria-labelledby="time-h">
          <h2 id="time-h" className="naskh mb-4 text-2xl font-bold">الزمن</h2>
          <Timeline isnad={isnad} />
        </section>
      </div>
    </article>
  );
}
