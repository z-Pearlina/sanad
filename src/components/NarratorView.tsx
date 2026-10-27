"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Dara from "./Dara";
import NetworkMap from "./NetworkMap";
import { getCities, getMap, getNarrator, getSpread } from "@/lib/data";
import { ERA_TEXT, GROUP_LABEL, deathEra, deathText, hadithCount, tabaqaName } from "@/lib/labels";
import type { City, MapData, Narrator, NarratorRef, Tabaqa } from "@/lib/types";

type Loaded = { narrator: Narrator; cities: Record<string, City>; spread: Tabaqa[]; map: MapData };

const SHOWN_PEOPLE = 12;
const SHOWN_HADITHS = 80;

export default function NarratorView({ id }: { id: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getNarrator(id), getCities(), getSpread(), getMap()])
      .then(([narrator, cities, spread, map]) => live && setData({ narrator, cities, spread, map }))
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [id]);

  if (missing) {
    return (
      <p className="py-16 text-center text-midad-soft">
        لا يوجد في أسانيد البخاري راوٍ بهذا الرقم. <Link href="/" className="text-nila underline">العودة إلى الرئيسية</Link>
      </p>
    );
  }
  if (!data) return <p className="py-16 text-center text-midad-soft">جارٍ تحميل الترجمة…</p>;

  const { narrator: p, cities, spread, map } = data;
  const tabaqa = p.tabaqa ? spread.find((s) => s.tabaqa === p.tabaqa) : undefined;
  const era = p.death ? null : deathEra(p.tabaqa);
  const city = p.city ? cities[p.city]?.ar : null;

  return (
    <article className="mx-auto max-w-5xl px-4 py-6">
      <header className="border-b border-khatt pb-4">
        <p className="text-sm text-midad-soft">الترجمة {p.id} في تقريب التهذيب</p>
        <h1 className="naskh text-2xl font-bold leading-relaxed sm:text-3xl sm:leading-relaxed">{p.name}</h1>
        <p className="mt-1 flex items-center gap-2">
          <Dara group={p.group} />
          {p.phrase ? <span className="naskh text-lg">«{p.phrase}»</span> : null}
          <span className="text-sm text-midad-soft">
            {p.phrase ? "· " : ""}
            {GROUP_LABEL[p.group]}
            {p.rank ? ` (المرتبة ${p.rank} عند ابن حجر)` : ""}
          </span>
        </p>
      </header>

      <div className="grid gap-x-10 gap-y-6 py-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="entry-h">
          <h2 id="entry-h" className="naskh mb-2 text-xl font-bold">ترجمته في تقريب التهذيب</h2>
          <blockquote className="naskh border-s-2 border-mughra ps-4 text-xl">{p.entry}</blockquote>
          <p className="mt-2 text-xs text-midad-soft">
            النص كما في ملف OpenITI بعد حذف علامات الصفحات. الحروف في آخره رموز الكتب التي روى له أصحابها.
          </p>
        </section>

        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-[0.95rem]">
          {p.kunya && <Fact term="الكنية">{p.kunya}</Fact>}
          {p.laqab && <Fact term="اللقب">{p.laqab}</Fact>}
          {p.tabaqa && (
            <Fact term="الطبقة">
              {tabaqaName(p.tabaqa)}
              {tabaqa && <span className="block text-sm text-midad-soft">{tabaqa.desc}{tabaqa.example ? `، ${tabaqa.example}` : ""}</span>}
            </Fact>
          )}
          <Fact term="الوفاة">
            {p.death ? deathText(p.death) : era && tabaqa ? `غير مذكورة؛ تقريباً ${ERA_TEXT[tabaqa.era]}` : "غير مذكورة"}
          </Fact>
          <Fact term="البلد">
            {city ? (
              <>
                {city}
                <span className="block text-sm text-midad-soft">
                  {p.citySrc === "nisba" && p.nisbaWord ? `من نسبته «${p.nisbaWord}»` : "موطن الصحابي بعد مراجعة، إذ لا نسبة له إلى بلد"}
                </span>
              </>
            ) : (
              <span className="text-midad-soft">لا تدل نسبته على بلد</span>
            )}
          </Fact>
          <Fact term="في البخاري">
            <span className="tabular-nums">{hadithCount(p.count)}</span> في أسانيده
          </Fact>
        </dl>
      </div>

      {(p.teachers.length > 0 || p.students.length > 0) && (
        <section className="border-t border-khatt py-6" aria-label="خريطة الشيوخ والتلاميذ">
          <div className="max-w-2xl">
            <NetworkMap narrator={p} map={map} cities={cities} />
          </div>
        </section>
      )}

      <div className="grid gap-x-10 gap-y-8 border-t border-khatt py-6 md:grid-cols-2">
        <People title="شيوخه" note="من روى عنهم في أسانيد البخاري" people={p.teachers} />
        <People title="تلاميذه" note="من رووا عنه في أسانيد البخاري" people={p.students} />
      </div>

      <section className="border-t border-khatt py-6" aria-labelledby="hadiths-h">
        <h2 id="hadiths-h" className="naskh mb-3 text-xl font-bold">أحاديثه في صحيح البخاري</h2>
        <HadithNumbers numbers={p.hadiths} />
      </section>
    </article>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-midad-soft">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

function People({ title, note, people }: { title: string; note: string; people: NarratorRef[] }) {
  const row = (r: NarratorRef) => (
    <li key={r.id} className="flex items-baseline gap-3 py-1.5">
      <Link href={`/narrator/?id=${r.id}`} className="naskh line-clamp-1 flex-1 text-lg text-nila hover:underline">
        {r.name}
      </Link>
      <span className="shrink-0 text-sm tabular-nums text-midad-soft" title="عدد المرات في الأسانيد">
        {r.count}
      </span>
    </li>
  );
  return (
    <section>
      <h2 className="naskh text-xl font-bold">
        {title} <span className="font-sans text-sm font-normal text-midad-soft">({people.length})</span>
      </h2>
      <p className="mb-2 text-xs text-midad-soft">{note}، مع عدد المرات</p>
      {people.length === 0 ? (
        <p className="text-sm text-midad-soft">لا أحد ممن عُرفت ترجمته.</p>
      ) : (
        <>
          <ul className="divide-y divide-khatt">{people.slice(0, SHOWN_PEOPLE).map(row)}</ul>
          {people.length > SHOWN_PEOPLE && (
            <details className="mt-1">
              <summary className="cursor-pointer text-sm text-nila">البقية ({people.length - SHOWN_PEOPLE})</summary>
              <ul className="divide-y divide-khatt">{people.slice(SHOWN_PEOPLE).map(row)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function HadithNumbers({ numbers }: { numbers: string[] }) {
  const link = (n: string) => (
    <li key={n}>
      <Link href={`/hadith/?n=${n}`} className="inline-block min-w-12 rounded-sm border border-khatt px-2 py-0.5 text-center text-sm tabular-nums hover:border-nila hover:text-nila">
        {n}
      </Link>
    </li>
  );
  return (
    <>
      <ul className="flex flex-wrap gap-1.5">{numbers.slice(0, SHOWN_HADITHS).map(link)}</ul>
      {numbers.length > SHOWN_HADITHS && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-nila">البقية ({numbers.length - SHOWN_HADITHS})</summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">{numbers.slice(SHOWN_HADITHS).map(link)}</ul>
        </details>
      )}
    </>
  );
}
