// Arabic text helpers shared by the app (src/) and the data scripts (scripts/).
// Plain ESM + JSDoc so Node can run it without a build step; types live in arabic.d.mts.

// Harakat, Quranic annotation marks, small high letters, tatweel.
const MARKS =
  /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ࣓-ࣿـ]/g;

/**
 * Remove diacritics and Quranic marks but keep every letter as written.
 * "ٱلْحَمْدُ" -> "الحمد" (alef wasla becomes a plain alef).
 * @param {string} text
 * @returns {string}
 */
export function stripMarks(text) {
  return text.normalize("NFC").replace(MARKS, "").replace(/ٱ/g, "ا").trim();
}

/**
 * Aggressive key for matching user input against data: no marks,
 * all alef/hamza seats unified, alef maqsura -> ya, ta marbuta -> ha.
 * @param {string} text
 * @returns {string}
 */
export function searchKey(text) {
  return stripMarks(text)
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ -> ا
    .replace(/[ؤئ]/g, "ء") // ؤ ئ -> ء
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/\s+/g, "");
}

/**
 * Canonical key for a root, whatever its source formatting:
 * "ح م د", "حمد" and "ح-م-د" all become "حمد". Hamza in any seat becomes ء
 * so roots written as "أ م ن" and "ء م ن" match.
 * @param {string} root
 * @returns {string}
 */
export function rootKey(root) {
  return stripMarks(root)
    .replace(/[\s\-–_.,،]/g, "")
    .replace(/[آأإٱؤئ]/g, "ء")
    .replace(/ى/g, "ي");
}

/**
 * The letters of a root as an array: "ح م د" -> ["ح", "م", "د"].
 * @param {string} root
 * @returns {string[]}
 */
export function rootLetters(root) {
  return Array.from(rootKey(root));
}

/** Letters a reader would treat as equal when spotting a root letter inside a word. */
function sameLetter(/** @type {string} */ a, /** @type {string} */ b) {
  const hamzaSeats = "ءأإآؤئٱا";
  if (a === b) return true;
  if (hamzaSeats.includes(a) && hamzaSeats.includes(b)) return true;
  if ("يى".includes(a) && "يى".includes(b)) return true;
  // weak root letters often surface as a long vowel or disappear; و/ي/ا may stand in for each other
  if ("ويا".includes(a) && "ويا".includes(b)) return true;
  return false;
}

const WEAK = "ويا";

/**
 * Greedy in-order scan from one starting position.
 * @param {string[]} letters
 * @param {string[]} target
 * @param {number} start index in `letters`
 * @param {number} r0 index in `target` to begin with (1 when a weak first letter is dropped)
 */
function matchFrom(letters, target, start, r0) {
  /** @type {boolean[]} */
  const flags = new Array(letters.length).fill(false);
  let r = r0;
  let skips = r0;
  let exact = 0;
  let first = -1;
  let last = -1;
  for (let i = start; i < letters.length && r < target.length; i++) {
    const hit = sameLetter(letters[i], target[r]);
    // a weak root letter the word dropped (قال/قل for ق و ل): skip it
    const skip = !hit && r < target.length - 1 && WEAK.includes(target[r]) && sameLetter(letters[i], target[r + 1]);
    if (hit || skip) {
      flags[i] = true;
      if (first < 0) first = i;
      last = i;
      if (letters[i] === target[skip ? r + 1 : r]) exact++;
      r += skip ? 2 : 1;
      if (skip) skips++;
    }
  }
  return { flags, matched: r, skips, exact, span: last - first };
}

/**
 * Group a word into letters, each carrying its diacritics and Quranic marks:
 * "ٱلَّيْلِ" -> [{text:"ٱ",base:"ا"},{text:"لَّ",base:"ل"},{text:"يْ",base:"ي"},{text:"لِ",base:"ل"}]
 * @param {string} word
 */
function letterClusters(word) {
  /** @type {{ text: string, base: string }[]} */
  const clusters = [];
  for (const ch of word.normalize("NFC")) {
    MARKS.lastIndex = 0;
    const isMark = MARKS.test(ch);
    MARKS.lastIndex = 0;
    if (isMark && clusters.length) clusters[clusters.length - 1].text += ch;
    else if (!isMark && ch.trim()) clusters.push({ text: ch, base: ch === "ٱ" ? "ا" : ch });
  }
  return clusters;
}

/**
 * Split a word into segments, flagging which letters belong to the root,
 * so the UI can color them: highlightRoot("محمود", "حمد") ->
 * [{t:"م",root:false},{t:"حم",root:true},{t:"و",root:false},{t:"د",root:true}]
 * Diacritics stay attached to their letters, so a fully voweled Quranic word
 * is displayed exactly as written.
 * Every possible starting position is tried and the best match wins
 * (most root letters, fewest skipped weak letters, most compact), so the
 * article in "الليل" is not mistaken for the first ل of the root ل ي ل.
 * @param {string} word
 * @param {string} root
 * @returns {{ t: string, root: boolean }[]}
 */
export function highlightRoot(word, root) {
  const clusters = letterClusters(word);
  const letters = clusters.map((c) => c.base);
  const target = rootLetters(root);
  let best = { flags: new Array(letters.length).fill(false), matched: 0, skips: 0, exact: 0, span: Infinity };
  if (target.length > 0) {
    letters.forEach((ch, i) => {
      /** @type {number[]} */
      const r0s = [];
      if (sameLetter(ch, target[0])) r0s.push(0);
      if (target.length > 1 && WEAK.includes(target[0]) && sameLetter(ch, target[1])) r0s.push(1);
      for (const r0 of r0s) {
        const m = matchFrom(letters, target, i, r0);
        // ranked: most root letters, fewest dropped weak letters, most exact letters, most compact
        const rank = [m.matched - best.matched, best.skips - m.skips, m.exact - best.exact, best.span - m.span];
        const firstDiff = rank.find((d) => d !== 0) ?? 0;
        if (firstDiff > 0) best = m;
      }
    });
  }
  /** @type {{ t: string, root: boolean }[]} */
  const segments = [];
  clusters.forEach((c, i) => {
    const prev = segments[segments.length - 1];
    if (prev && prev.root === best.flags[i]) prev.t += c.text;
    else segments.push({ t: c.text, root: best.flags[i] });
  });
  return segments;
}

/**
 * True if the text contains Arabic letters.
 * @param {string} text
 */
export function isArabic(text) {
  return /[؀-ۿ]/.test(text);
}
