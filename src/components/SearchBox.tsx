"use client";

import { ChevronDown, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Dara from "./Dara";
import { getData } from "@/lib/data";
import { deathText, hadithCount } from "@/lib/labels";
import { nameWords, westernDigits } from "@/lib/names";
import { findTexts, parseQuery, readHits, type TextHit } from "@/lib/textSearch";
import type { Group } from "@/lib/types";

type Entry = {
  id: string;
  name: string;
  kunya: string | null;
  laqab: string | null;
  nisba: string | null;
  death: number | null;
  group: Group;
  count: number;
};
type Indexed = Entry & { words: string[]; all: string };
type Tab = "texts" | "narrators";
type Texts = { numbers: string[]; hits: TextHit[]; next: number; busy: boolean };

const MAX_NARRATORS = 12;
const PAGE = 15;
const WAIT_MS = 180; // a pause in the typing before the texts are searched
const NO_TEXTS: Texts = { numbers: [], hits: [], next: 0, busy: false };

export default function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<Indexed[] | null>(null);
  const [texts, setTexts] = useState<Texts>(NO_TEXTS);
  const [searched, setSearched] = useState("");
  const [chosen, setChosen] = useState<Tab | null>(null);
  const run = useRef(0); // the latest search: an older one that finishes late is dropped

  // Load the narrator index (~300 KB) only once someone starts to search.
  const load = () => {
    if (index) return;
    getData<Entry[]>("narrators-index.json").then((rows) =>
      setIndex(
        rows.map((r) => {
          const w = nameWords([r.name, r.kunya, r.laqab, r.nisba].filter(Boolean).join(" "));
          return { ...r, words: w, all: w.join("") };
        }),
      ),
    );
  };

  const q = westernDigits(query.trim());
  const number = /^\d+(\.\d+)?$/.test(q) ? q : null;

  const narrators = useMemo(() => {
    if (!index || number || q.length < 2) return [];
    const qWords = nameWords(q);
    const qAll = qWords.join("");
    if (!qAll) return [];
    const scored: [number, Indexed][] = [];
    for (const r of index) {
      // every word of the query starts a word of the entry, in any order: best;
      // the query found anywhere (spaces ignored): still a match
      const allWords = qWords.every((w) => r.words.some((x) => x.startsWith(w)));
      const score = allWords ? (r.words[0].startsWith(qWords[0]) ? 3 : 2) : r.all.includes(qAll) ? 1 : 0;
      if (score) scored.push([score, r]);
    }
    return scored.sort((a, b) => b[0] - a[0] || b[1].count - a[1].count).slice(0, MAX_NARRATORS);
  }, [index, number, q]);

  useEffect(() => {
    const id = ++run.current;
    const timer = window.setTimeout(async () => {
      if (number || q.length < 2) {
        setTexts(NO_TEXTS);
        setSearched("");
        return;
      }
      setTexts((t) => ({ ...t, busy: true }));
      const parsed = parseQuery(query);
      const numbers = await findTexts(parsed);
      const { hits, next } = await readHits(numbers, 0, PAGE, parsed);
      if (id !== run.current) return;
      setTexts({ numbers, hits, next, busy: false });
      setSearched(q);
    }, WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [query, q, number]);

  const more = async () => {
    const id = run.current;
    setTexts((t) => ({ ...t, busy: true }));
    const { hits, next } = await readHits(texts.numbers, texts.next, PAGE, parseQuery(query));
    if (id !== run.current) return;
    setTexts((t) => ({ ...t, hits: [...t.hits, ...hits], next, busy: false }));
  };

  const phrases = parseQuery(query).phrases.length > 0;
  const hasMore = texts.next < texts.numbers.length;
  // a phrase is only confirmed in the text of each hadith, so its count grows as they are read
  const textCount = phrases ? texts.hits.length : texts.numbers.length;
  const answered = searched === q && !texts.busy;
  // a name opens on the narrators and words on the texts, until the visitor chooses
  const isName = narrators.some(([, r]) => nameWords(q).every((w) => r.words.includes(w)));
  const tab: Tab = chosen ?? (isName || (narrators.length > 0 && textCount === 0) ? "narrators" : "texts");

  return (
    <div id="search">
      <label htmlFor="q" className="naskh text-2xl font-bold">ابحث في الأحاديث والرواة</label>
      <p className="mb-2 text-sm text-midad-soft">
        برقم الحديث، أو باسم الراوي أو كنيته أو نسبته، أو بكلمات من نص الحديث، بالتشكيل أو بدونه. والعبارة بين علامتي تنصيص تُطابَق متتابعة.
      </p>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (number) router.push(`/hadith/?n=${number}`);
        }}
      >
        <input
          id="q"
          type="search"
          enterKeyHint="search"
          value={query}
          onFocus={load}
          onChange={(e) => {
            load();
            setQuery(e.target.value);
            setChosen(null);
          }}
          placeholder="مثلاً: 6018، أو الزهري، أو إنما الأعمال"
          autoComplete="off"
          className="w-full max-w-xl rounded-sm border border-khatt bg-raqq px-3 py-2 text-lg"
          aria-describedby="search-status"
        />
      </form>
      <div id="search-status" aria-live="polite" className="mt-3 max-w-3xl">
        {number && (
          <Link href={`/hadith/?n=${number}`} className="naskh flex items-center gap-1 border-b border-khatt py-2 text-xl text-nila phone:min-h-11">
            الحديث {number}
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        )}
        {!number && q.length >= 2 && (
          <>
            <div role="tablist" aria-label="نتائج البحث" className="mb-2 flex gap-1 border-b border-khatt">
              <TabButton on={tab === "texts"} onClick={() => setChosen("texts")}>
                النصوص <span className="tabular-nums">({answered ? `${textCount}${phrases && hasMore ? "+" : ""}` : "…"})</span>
              </TabButton>
              <TabButton on={tab === "narrators"} onClick={() => setChosen("narrators")}>
                الرواة <span className="tabular-nums">({index ? (narrators.length === MAX_NARRATORS ? `${MAX_NARRATORS}+` : narrators.length) : "…"})</span>
              </TabButton>
            </div>
            {tab === "texts" && (
              <>
                {answered && texts.hits.length === 0 && <p className="text-sm text-midad-soft">لا حديث فيه هذه الكلمات.</p>}
                {!answered && texts.hits.length === 0 && <p className="text-sm text-midad-soft">جارٍ البحث في النصوص…</p>}
                <ol className="divide-y divide-khatt">
                  {texts.hits.map((h) => (
                    <li key={h.n}>
                      <Link href={`/hadith/?n=${h.n}`} className="group block py-2.5">
                        <span className="text-sm text-midad-soft">
                          <span className="font-medium text-nila group-hover:underline">الحديث {h.n}</span>
                          {h.book && ` · ${h.book}`}
                        </span>
                        <span className="naskh mt-0.5 block text-[19px] leading-[2.1]">
                          {h.parts.map((p, i) => (p.hit ? <mark key={i} className="rounded-sm bg-raml px-0.5 font-bold text-midad">{p.text}</mark> : <span key={i}>{p.text}</span>))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {hasMore && answered && (
                  <button type="button" onClick={more} className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-khatt px-4 py-2 text-sm phone:min-h-11">
                    <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
                    المزيد
                  </button>
                )}
              </>
            )}
            {tab === "narrators" && (
              <>
                {!index && <p className="text-sm text-midad-soft">جارٍ تحميل فهرس الرواة…</p>}
                {index && narrators.length === 0 && <p className="text-sm text-midad-soft">لا راوي بهذا الاسم في أسانيد البخاري.</p>}
                {narrators.length > 0 && (
                  <ul className="divide-y divide-khatt">
                    {narrators.map(([, r]) => (
                      <li key={r.id}>
                        <Link href={`/narrator/?id=${r.id}`} className="group flex items-center gap-3 py-2 phone:min-h-11">
                          <Dara group={r.group} size={18} />
                          <span className="min-w-0 flex-1">
                            <span className="naskh line-clamp-1 text-lg leading-normal group-hover:text-nila">{r.name}</span>
                            <span className="block text-xs text-midad-soft">
                              {[r.kunya, r.death ? deathText(r.death) : null, hadithCount(r.count)].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-1.5 text-sm phone:mb-0 phone:min-h-11 ${on ? "border-nila text-nila" : "border-transparent text-midad-soft"}`}
    >
      {children}
    </button>
  );
}
