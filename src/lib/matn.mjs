// The words of a hadith's text, shared by the search index (scripts/build_search.mjs) and the
// search page, so what is indexed and what a visitor types are normalised alike.
// Plain ESM + JSDoc so Node can run it without a build step; types live in matn.d.mts.
import { searchKey } from "./arabic.mjs";

// Arabic letters with their marks; the Arabic comma, semicolon and question mark split words.
const WORD = /[ء-ٰٟ-ۓە-ۭ]+/g;

/**
 * The stretches of the text outside its chains of narrators, as [start, end] offsets.
 * @param {string} ar
 * @param {{ start: number, end: number }[]} isnads
 * @returns {[number, number][]}
 */
export function matnRanges(ar, isnads) {
  const out = [];
  let pos = 0;
  for (const { start, end } of [...isnads].filter((s) => s.start >= 0).sort((a, b) => a.start - b.start)) {
    if (start > pos) out.push([pos, start]);
    pos = Math.max(pos, end);
  }
  if (pos < ar.length) out.push([pos, ar.length]);
  return out;
}

/**
 * The words of the text outside its chains, with their normalised key and place in the text.
 * @param {string} ar
 * @param {{ start: number, end: number }[]} isnads
 * @returns {{ key: string, start: number, end: number }[]}
 */
export function matnWords(ar, isnads) {
  const words = [];
  for (const [from, to] of matnRanges(ar, isnads)) {
    for (const m of ar.slice(from, to).matchAll(WORD)) {
      const key = searchKey(m[0]);
      if (key) words.push({ key, start: from + m.index, end: from + m.index + m[0].length });
    }
  }
  return words;
}

/**
 * The normalised words of a text typed by a visitor.
 * @param {string} text
 * @returns {string[]}
 */
export function wordsOf(text) {
  return [...text.matchAll(WORD)].map((m) => searchKey(m[0])).filter(Boolean);
}

/**
 * A word and what is left of it without the particles written onto it, so that «الصبا»
 * finds «بالصبا»: وبالناس → بالناس → الناس، للناس → الناس.
 * @param {string} word a normalised word
 * @returns {string[]}
 */
export function wordForms(word) {
  const forms = [word];
  let w = word;
  if (w === "لله") return [w, "الله"];
  if (w.length > 3 && (w[0] === "و" || w[0] === "ف")) {
    w = w.slice(1);
    forms.push(w);
  }
  if (w.length > 3 && /^[بك]ال/.test(w)) forms.push(w.slice(1));
  else if (w.length > 3 && w.startsWith("لل")) forms.push("ال" + w.slice(2));
  return forms;
}

/**
 * The file of the index that holds a word: its first two letters, or three after the
 * article, which starts so many words that it would otherwise make one huge file.
 * @param {string} word a normalised word
 * @returns {string}
 */
export function shardOf(word) {
  const head = [...word].slice(0, word.startsWith("ال") ? 3 : 2);
  return head.map((c) => c.codePointAt(0).toString(16).padStart(4, "0")).join("-");
}
