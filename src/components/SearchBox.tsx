"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Dara from "./Dara";
import { searchKey, stripMarks } from "@/lib/arabic.mjs";
import { getData } from "@/lib/data";
import { deathText, hadithCount } from "@/lib/labels";
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

const MAX_RESULTS = 12;

/** The Taqrib writes "بن عباس" for "ابن عباس"; "أبي هريرة" and "أبا هريرة" are "أبو هريرة". */
function normalizeName(text: string): string {
  return stripMarks(text)
    .replace(/(^|\s)ابن(?=\s|$)/g, "$1بن")
    .replace(/(^|\s)[أا]ب[يا](?=\s)/g, "$1أبو");
}
const words = (text: string) => normalizeName(text).split(/\s+/).map(searchKey).filter(Boolean);
// Arabic-Indic digits typed on an Arabic keyboard count as hadith numbers too.
const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<Indexed[] | null>(null);

  // Load the narrator index (~300 KB) only once someone starts to search.
  const load = () => {
    if (index) return;
    getData<Entry[]>("narrators-index.json").then((rows) =>
      setIndex(
        rows.map((r) => {
          const w = words([r.name, r.kunya, r.laqab, r.nisba].filter(Boolean).join(" "));
          return { ...r, words: w, all: w.join("") };
        }),
      ),
    );
  };

  const q = westernDigits(query.trim());
  const number = /^\d+(\.\d+)?$/.test(q) ? q : null;
  const results = useMemo(() => {
    if (!index || number || q.length < 2) return [];
    const qWords = words(q);
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
    return scored.sort((a, b) => b[0] - a[0] || b[1].count - a[1].count).slice(0, MAX_RESULTS);
  }, [index, number, q]);

  return (
    <div id="search">
      <label htmlFor="q" className="naskh text-2xl font-bold">ابحث عن حديث أو راوٍ</label>
      <p className="mb-2 text-sm text-midad-soft">برقم الحديث، أو باسم الراوي أو كنيته أو نسبته، بالتشكيل أو بدونه.</p>
      <input
        id="q"
        type="search"
        value={query}
        onFocus={load}
        onChange={(e) => {
          load();
          setQuery(e.target.value);
        }}
        placeholder="مثلاً: 6018، أو الزهري، أو أبو هريرة"
        autoComplete="off"
        className="w-full max-w-xl rounded-sm border border-khatt bg-raqq px-3 py-2 text-lg"
        aria-describedby="search-status"
      />
      <div id="search-status" aria-live="polite" className="mt-3 max-w-xl">
        {number && (
          <Link href={`/hadith/?n=${number}`} className="naskh block border-b border-khatt py-2 text-xl text-nila hover:underline">
            الحديث {number} ←
          </Link>
        )}
        {!number && q.length >= 2 && index && results.length === 0 && (
          <p className="text-sm text-midad-soft">لا راوي بهذا الاسم في أسانيد البخاري.</p>
        )}
        {!number && q.length >= 2 && !index && <p className="text-sm text-midad-soft">جارٍ تحميل فهرس الرواة…</p>}
        {results.length > 0 && (
          <ul className="divide-y divide-khatt border-y border-khatt">
            {results.map(([, r]) => (
              <li key={r.id}>
                <Link href={`/narrator/?id=${r.id}`} className="group flex items-center gap-3 py-2">
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
      </div>
    </div>
  );
}
