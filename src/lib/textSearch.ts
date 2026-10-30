// Searching the hadith texts in the browser, on the index of scripts/build_search.mjs.
import { getData, getHadith } from "./data";
import { matnWords, shardOf, wordForms, wordsOf } from "./matn.mjs";

export type TextQuery = {
  /** Every word that must be in the text. */
  words: string[];
  /** The last word as typed so far: it may be the start of a longer one. */
  open: string | null;
  /** Runs of words that must stand one after the other. */
  phrases: string[][];
};

export type Part = { text: string; hit: boolean };
export type TextHit = { n: string; book: string | null; parts: Part[] };

type Shard = Record<string, number[]>;

const QUOTES = /["“”«»]/;
const AROUND = 80; // characters of text kept on each side of the first match
const BATCH = 8;

export function parseQuery(text: string): TextQuery {
  const pieces = text.split(QUOTES);
  const phrases = pieces.filter((_, i) => i % 2 === 1).map(wordsOf).filter((p) => p.length > 1);
  const words = [...new Set(wordsOf(text))];
  const stillTyping = !/[\s"“”«»]$/.test(text);
  const last = wordsOf(text).at(-1) ?? null;
  return { words: stillTyping && last ? words.filter((w) => w !== last) : words, open: stillTyping ? last : null, phrases };
}

async function loadShard(word: string): Promise<Shard> {
  try {
    return await getData<Shard>(`search/${shardOf(word)}.json`);
  } catch {
    return {}; // no word of the texts starts with these letters
  }
}

/** Hadith indexes from the gaps stored in the index. */
function decode(gaps: number[]) {
  let at = 0;
  return gaps.map((g) => (at += g));
}

/** A word as a prefix needs enough letters to name a file of the index. */
const longEnough = (w: string) => w.length >= (w.startsWith("ال") ? 3 : 2);

/**
 * The hadith numbers that hold every word: most words matched in full first, then by number.
 * A typed word still being written matches any word it begins.
 */
export async function findTexts(q: TextQuery): Promise<string[]> {
  const complete = await Promise.all(
    q.words.map(async (w) => {
      const shard = await loadShard(w);
      return new Set(decode(shard[w] ?? []));
    }),
  );
  let open: Map<number, boolean> | null = null; // hadith -> the word is there in full
  if (q.open && longEnough(q.open)) {
    const shard = await loadShard(q.open);
    open = new Map();
    for (const [word, gaps] of Object.entries(shard)) {
      if (!word.startsWith(q.open)) continue;
      for (const d of decode(gaps)) open.set(d, Boolean(open.get(d)) || word === q.open);
    }
  }
  const lists = [...complete, ...(open ? [new Set(open.keys())] : [])];
  if (!lists.length) return [];
  const [first, ...rest] = [...lists].sort((a, b) => a.size - b.size);
  const docs = [...first].filter((d) => rest.every((s) => s.has(d)));
  const matched = (d: number) => (open?.get(d) ? 1 : 0);
  docs.sort((a, b) => matched(b) - matched(a) || a - b);
  const numbers = await getData<string[]>("search/docs.json");
  return docs.map((d) => numbers[d]);
}

const isMatch = (key: string, word: string, prefix: boolean) => wordForms(key).some((f) => (prefix ? f.startsWith(word) : f === word));

/** The results of one page: reads each hadith, keeps those whose phrases stand together, and cuts a snippet. */
export async function readHits(numbers: string[], from: number, want: number, q: TextQuery) {
  const hits: TextHit[] = [];
  let at = from;
  while (hits.length < want && at < numbers.length) {
    const batch = numbers.slice(at, at + (q.phrases.length ? BATCH : want - hits.length));
    at += batch.length;
    const read = await Promise.all(batch.map((n) => getHadith(n).catch(() => null)));
    for (const h of read) {
      if (!h) continue;
      const parts = snippet(h.ar, matnWords(h.ar, h.isnads), q);
      if (parts) hits.push({ n: h.n, book: h.book?.title ?? null, parts });
    }
  }
  return { hits, next: at };
}

/** The text around the first match, as written, with the matched words marked; null if a phrase is missing. */
function snippet(ar: string, words: { key: string; start: number; end: number }[], q: TextQuery): Part[] | null {
  const lit = new Set<number>();
  for (const phrase of q.phrases) {
    let found = false;
    for (let i = 0; i + phrase.length <= words.length; i++) {
      if (phrase.every((w, j) => isMatch(words[i + j].key, w, q.open === w && j === phrase.length - 1))) {
        found = true;
        phrase.forEach((_, j) => lit.add(i + j));
      }
    }
    if (!found) return null;
  }
  words.forEach((w, i) => {
    if (q.words.some((x) => isMatch(w.key, x, false)) || (q.open && isMatch(w.key, q.open, true))) lit.add(i);
  });
  const marked = [...lit].sort((a, b) => a - b);
  if (!marked.length) return [{ text: ar.slice(0, AROUND * 2), hit: false }];
  // from the word before the window to the word after it, so no word is cut
  const first = words[marked[0]];
  const startAt = words.find((w) => w.end > first.start - AROUND) ?? first;
  const endAt = [...words].reverse().find((w) => w.start < first.end + AROUND) ?? first;
  const parts: Part[] = startAt.start > 0 ? [{ text: "… ", hit: false }] : [];
  let pos = startAt.start;
  for (const i of marked) {
    const w = words[i];
    if (w.start < pos || w.end > endAt.end) continue;
    if (w.start > pos) parts.push({ text: ar.slice(pos, w.start), hit: false });
    parts.push({ text: ar.slice(w.start, w.end), hit: true });
    pos = w.end;
  }
  if (endAt.end > pos) parts.push({ text: ar.slice(pos, endAt.end), hit: false });
  if (endAt.end < ar.length) parts.push({ text: " …", hit: false });
  return parts;
}
