// Builds the index of the hadith texts for the search page, from public/data/hadith/*.json.
// Only the matn is indexed, never the chain. Each word lists the hadiths it occurs in, and the
// words are split into files by their first letters (src/lib/matn.mjs), so a search loads only
// the files of the words typed. Words are normalised by src/lib/arabic.mjs, as in the browser.
// Usage: node scripts/build_search.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { matnWords, shardOf, wordForms } from "../src/lib/matn.mjs";

const data = path.resolve("public/data");
const hadithDir = path.join(data, "hadith");
const out = path.join(data, "search");

const numbers = readdirSync(hadithDir)
  .map((f) => f.replace(/\.json$/, ""))
  .sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));

const postings = new Map(); // word -> hadith indexes, ascending
numbers.forEach((n, doc) => {
  const { ar, isnads } = JSON.parse(readFileSync(path.join(hadithDir, `${n}.json`), "utf8"));
  const seen = new Set();
  for (const { key } of matnWords(ar, isnads)) for (const form of wordForms(key)) seen.add(form);
  for (const word of seen) {
    if (!postings.has(word)) postings.set(word, []);
    postings.get(word).push(doc);
  }
});

const shards = new Map();
for (const [word, docs] of postings) {
  const id = shardOf(word);
  if (!shards.has(id)) shards.set(id, {});
  // gaps between hadith indexes: much shorter than the indexes themselves
  shards.get(id)[word] = docs.map((d, i) => (i ? d - docs[i - 1] : d));
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "docs.json"), JSON.stringify(numbers));
for (const [id, words] of shards) writeFileSync(path.join(out, `${id}.json`), JSON.stringify(words));

const sizes = [...shards.keys()].map((id) => [id, statSync(path.join(out, `${id}.json`)).size]).sort((a, b) => b[1] - a[1]);
const total = sizes.reduce((a, [, s]) => a + s, 0);
const kb = (s) => `${(s / 1024).toFixed(0)} KB`;
const name = (id) => id.split("-").map((h) => String.fromCodePoint(parseInt(h, 16))).join("");
console.log(`${numbers.length} hadiths, ${postings.size} words, ${sizes.length} files, ${kb(total)} in all`);
console.log(`largest: ${sizes.slice(0, 6).map(([id, s]) => `${name(id)} ${kb(s)}`).join(", ")}; median ${kb(sizes[sizes.length >> 1][1])}`);
