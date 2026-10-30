import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getData } from "./data";
import { nameWords, westernDigits } from "./names";
import { findTexts, parseQuery, readHits, type TextHit } from "./textSearch";
import type { Group } from "./types";

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
export type Indexed = Entry & { words: string[]; all: string };
export type Tab = "texts" | "narrators";
type Texts = { numbers: string[]; hits: TextHit[]; next: number; busy: boolean };

export const MAX_NARRATORS = 12;
const PAGE = 15;
const WAIT_MS = 180; // a pause in the typing before the texts are searched
const NO_TEXTS: Texts = { numbers: [], hits: [], next: 0, busy: false };

/** The logic of the search, shared by the search page and the quick search: a number, a name, or words. */
export function useSearch(initial = "") {
  const [query, setQuery] = useState(initial);
  const [index, setIndex] = useState<Indexed[] | null>(null);
  const [texts, setTexts] = useState<Texts>(NO_TEXTS);
  const [searched, setSearched] = useState("");
  const [chosen, setChosen] = useState<Tab | null>(null);
  const run = useRef(0); // the latest search: an older one that finishes late is dropped
  const loading = useRef(false);

  // Load the narrator index (~300 KB) only once someone starts to search.
  const load = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    getData<Entry[]>("narrators-index.json").then((rows) =>
      setIndex(
        rows.map((r) => {
          const w = nameWords([r.name, r.kunya, r.laqab, r.nisba].filter(Boolean).join(" "));
          return { ...r, words: w, all: w.join("") };
        }),
      ),
    );
  }, []);

  useEffect(() => {
    if (initial) load();
  }, [initial, load]);

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
    return scored
      .sort((a, b) => b[0] - a[0] || b[1].count - a[1].count)
      .slice(0, MAX_NARRATORS)
      .map(([, r]) => r);
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
  const isName = narrators.some((r) => nameWords(q).every((w) => r.words.includes(w)));
  const tab: Tab = chosen ?? (isName || (narrators.length > 0 && textCount === 0) ? "narrators" : "texts");

  return {
    query,
    type: (value: string) => {
      load();
      setQuery(value);
      setChosen(null);
    },
    load,
    q,
    number,
    index,
    narrators,
    texts,
    more,
    phrases,
    hasMore,
    textCount,
    answered,
    tab,
    setTab: setChosen,
  };
}
