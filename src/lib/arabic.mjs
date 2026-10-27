// Arabic text helpers used by search.
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
 * True if the text contains Arabic letters.
 * @param {string} text
 */
export function isArabic(text) {
  return /[؀-ۿ]/.test(text);
}
