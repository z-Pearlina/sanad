"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CountUp from "./CountUp";
import Dara from "./Dara";
import NarratorMap from "./sanad-map/NarratorMap";
import { getCities, getNarrator, getSpread } from "@/lib/data";
import { ERA_TEXT, GROUP_COLOR, GROUP_LABEL, NOUNS, deathText, tabaqaName } from "@/lib/labels";
import type { City, Group, Narrator, NarratorRef, Tabaqa } from "@/lib/types";
import type { Band } from "./sanad-map/types";

type Loaded = { narrator: Narrator; cities: Record<string, City>; spread: Tabaqa[] };

const SHOWN_PEOPLE = 12;
const SHOWN_HADITHS = 80;
// An extracted "verdict" longer than this ran on past it (Abu Hurayra's name dispute): not underlined.
const PHRASE_MAX = 160;
const BAND: Record<Group, Band> = { sahabi: "sahabi", thiqa: "thiqa", saduq: "saduq", maqbul: "maqbul", daif: "daif", see: "none" };

export default function NarratorView({ id }: { id: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getNarrator(id), getCities(), getSpread()])
      .then(([narrator, cities, spread]) => live && setData({ narrator, cities, spread }))
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

  const { narrator: p, cities, spread } = data;
  const tabaqa = p.tabaqa ? spread.find((s) => s.tabaqa === p.tabaqa) : undefined;
  const city = p.city ? cities[p.city]?.ar : null;
  const places = new Set([...p.teachers, ...p.students].map((r) => r.city).filter(Boolean));
  const cityNames = Object.fromEntries(Object.entries(cities).map(([k, c]) => [k, c.ar]));

  return (
    <article className="mx-auto max-w-5xl px-4 py-6">
      <header className="border-b border-khatt pb-6">
        <p className="text-sm text-midad-soft">الترجمة {p.id} في تقريب التهذيب</p>
        <h1 className="naskh mt-1 text-4xl font-bold leading-snug sm:text-5xl sm:leading-snug">{p.short ?? p.name}</h1>
        {p.short && p.short !== p.name && <p className="naskh text-lg leading-relaxed text-midad-soft">{p.name}</p>}

        <div className="mt-5 flex items-center gap-4">
          <Dara group={p.group} size={64} />
          <div className="min-w-0">
            {p.phrase ? (
              <p className="naskh line-clamp-3 text-2xl leading-relaxed">«{p.phrase}»</p>
            ) : (
              <p className="text-lg">لم يُستخرج لفظ حكمه آلياً، فهو في نص الترجمة أدناه.</p>
            )}
            <p className="text-sm text-midad-soft">
              حكم ابن حجر · {GROUP_LABEL[p.group]}
              {p.rank ? ` (المرتبة ${p.rank} عنده)` : ""}
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-3">
          <Fact term="الطبقة">
            {p.tabaqa ? (
              <>
                {tabaqaName(p.tabaqa)}
                {tabaqa && (
                  <span className="block text-sm text-midad-soft">
                    «{tabaqa.desc}
                    {tabaqa.example ? `، ${tabaqa.example}` : ""}»
                  </span>
                )}
              </>
            ) : (
              <span className="text-midad-soft">غير مذكورة</span>
            )}
          </Fact>
          <Fact term="الوفاة">
            {p.death ? (
              deathText(p.death)
            ) : (
              <>
                <span className="text-midad-soft">غير مذكورة في التقريب</span>
                {tabaqa && <span className="block text-sm text-midad-soft">تقريباً {ERA_TEXT[tabaqa.era]}، بقاعدة ابن حجر</span>}
              </>
            )}
          </Fact>
          <Fact term="البلد">
            {city ? (
              <>
                {city}
                <span className="block text-sm text-midad-soft">
                  {p.citySrc === "manual" ? "موطنه من المشهور في التراجم" : p.nisbaWord ? `من نسبته «${p.nisbaWord}»` : "من نسبته"}
                </span>
              </>
            ) : (
              <span className="text-midad-soft">لا تدل نسبته على بلد</span>
            )}
          </Fact>
          {p.kunya && <Fact term="الكنية">{p.kunya}</Fact>}
          {p.laqab && <Fact term="اللقب">{p.laqab}</Fact>}
        </dl>
      </header>

      <section className="py-6" aria-labelledby="entry-h">
        <h2 id="entry-h" className="naskh mb-2 text-xl font-bold">ترجمته في تقريب التهذيب</h2>
        <blockquote className="naskh border-s-2 border-mughra ps-4 text-xl">
          <Entry text={p.entry} phrase={p.phrase} group={p.group} />
        </blockquote>
        <p className="mt-2 text-xs text-midad-soft">
          النص كما في ملف OpenITI بعد حذف علامات الصفحات، وتحت لفظ الحكم خط بلون مرتبته. الحروف في آخره رموز الكتب التي روى له
          أصحابها.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-6 border-y border-khatt py-6 sm:grid-cols-4" aria-label="أعداده في صحيح البخاري">
        <CountUp value={p.count} forms={NOUNS.hadith} label="في أسانيد صحيح البخاري" />
        <CountUp value={p.teachers.length} forms={NOUNS.shaykh} label="روى عنهم فيها" />
        <CountUp value={p.students.length} forms={NOUNS.tilmidh} label="رووا عنه فيها" />
        <CountUp value={places.size} forms={NOUNS.balad} label="مواطن شيوخه وتلاميذه" />
      </section>

      {(p.teachers.length > 0 || p.students.length > 0) && (
        <section className="py-6" aria-labelledby="links-h">
          <h2 id="links-h" className="naskh mb-3 text-xl font-bold">صلاته على الخريطة</h2>
          <NarratorMap
            home={p.city}
            band={BAND[p.group]}
            teachers={p.teachers}
            students={p.students}
            cityNames={cityNames}
            label={`خريطة صلات ${p.short ?? p.name}`}
          />
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

/** The entry with Ibn Hajar's verdict underlined in the colour of its grade. */
function Entry({ text, phrase, group }: { text: string; phrase: string | null; group: Group }) {
  const at = phrase && phrase.length <= PHRASE_MAX ? text.indexOf(phrase) : -1;
  if (!phrase || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span
        className="underline decoration-2 underline-offset-[10px]"
        style={{ textDecorationColor: GROUP_COLOR[group] }}
      >
        {phrase}
      </span>
      {text.slice(at + phrase.length)}
    </>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-midad-soft">{term}</dt>
      <dd className="text-lg">{children}</dd>
    </div>
  );
}

function People({ title, note, people }: { title: string; note: string; people: NarratorRef[] }) {
  const max = Math.max(1, ...people.map((r) => r.count));
  const row = (r: NarratorRef) => (
    <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,7rem)_2.5rem] items-center gap-3 py-1.5">
      <Link href={`/narrator/?id=${r.id}`} title={r.name ?? undefined} className="naskh line-clamp-1 text-lg text-nila hover:underline phone:min-h-11">
        {r.short ?? r.name}
      </Link>
      <span className="relative h-1.5 bg-mughra/25" aria-hidden="true">
        <i className="absolute inset-y-0 start-0 bg-mughra" style={{ width: `${(100 * r.count) / max}%` }} />
      </span>
      <span className="text-end text-sm tabular-nums text-midad-soft" title="عدد المرات في الأسانيد">
        {r.count}
      </span>
    </li>
  );
  return (
    <section>
      <h2 className="naskh text-xl font-bold">
        {title} <span className="font-sans text-sm font-normal text-midad-soft">({people.length})</span>
      </h2>
      <p className="mb-2 text-xs text-midad-soft">{note}، والشريط عدد المرات</p>
      {people.length === 0 ? (
        <p className="text-sm text-midad-soft">لا أحد ممن عُرفت ترجمته.</p>
      ) : (
        <>
          <ul className="divide-y divide-khatt">{people.slice(0, SHOWN_PEOPLE).map(row)}</ul>
          {people.length > SHOWN_PEOPLE && (
            <details className="mt-1">
              <summary className="cursor-pointer text-sm text-nila phone:flex phone:min-h-11 phone:items-center">البقية ({people.length - SHOWN_PEOPLE})</summary>
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
      <Link
        href={`/hadith/?n=${n}`}
        className="inline-block min-w-12 rounded-sm border border-khatt px-2 py-0.5 text-center text-sm tabular-nums hover:border-nila hover:text-nila phone:grid phone:min-h-11 phone:place-items-center"
      >
        {n}
      </Link>
    </li>
  );
  return (
    <>
      <ul className="flex flex-wrap gap-1.5">{numbers.slice(0, SHOWN_HADITHS).map(link)}</ul>
      {numbers.length > SHOWN_HADITHS && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-nila phone:flex phone:min-h-11 phone:items-center">البقية ({numbers.length - SHOWN_HADITHS})</summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">{numbers.slice(SHOWN_HADITHS).map(link)}</ul>
        </details>
      )}
    </>
  );
}
