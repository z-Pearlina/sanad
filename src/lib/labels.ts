import type { Group } from "./types";

// Arabic form of the transmission words isnady reports.
export const TRANSMISSION: Record<string, string> = {
  haddathana: "حدّثنا",
  haddathani: "حدّثني",
  akhbarana: "أخبرنا",
  akhbarani: "أخبرني",
  "anba'ana": "أنبأنا",
  "anba'ani": "أنبأني",
  "'an": "عن",
  "sami'tu": "سمعتُ",
  "sami'a": "سمع",
  anna: "أنّ",
  qala: "قال",
  "sa'altu": "سألتُ",
  "sa'ala": "سأل",
  "su'ila": "سُئل",
  "za'ama": "زعم",
  kataba: "كتب",
  "qara'tu 'ala": "قرأتُ على",
  "quri'a 'ala": "قُرئ على",
};

export const GROUP_LABEL: Record<Group | "unknown", string> = {
  sahabi: "صحابي",
  thiqa: "ثقة",
  saduq: "صدوق",
  maqbul: "مقبول أو مجهول",
  daif: "ضعيف فما دونه",
  see: "انظر الترجمة",
  unknown: "لم يُعرف",
};

// CSS color of each group (the vermilion is reserved for the weak group).
export const GROUP_COLOR: Record<Group, string> = {
  sahabi: "var(--mughra)",
  thiqa: "var(--zinjar)",
  saduq: "var(--zaytun)",
  maqbul: "var(--ramad)",
  daif: "var(--zinjafr)",
  see: "var(--midad-soft)",
};

const ORDINALS = [
  "",
  "الأولى",
  "الثانية",
  "الثالثة",
  "الرابعة",
  "الخامسة",
  "السادسة",
  "السابعة",
  "الثامنة",
  "التاسعة",
  "العاشرة",
  "الحادية عشرة",
  "الثانية عشرة",
];

export const tabaqaName = (t: number) => `الطبقة ${ORDINALS[t] ?? t}`;

/** Ibn Hajar's rule for the death dates of each tabaqa (introduction of the Taqrib). */
export function deathEra(tabaqa: number | null | undefined): { label: string; from: number; to: number } | null {
  if (!tabaqa) return null;
  if (tabaqa <= 2) return { label: "قبل 100هـ", from: 0, to: 100 };
  if (tabaqa <= 8) return { label: "بعد 100هـ", from: 100, to: 200 };
  return { label: "بعد 200هـ", from: 200, to: 300 };
}

export const deathText = (year: number) => `ت ${year}هـ`;

// Ibn Hajar: "if of the first and second, they are before the hundred; from the
// third to the end of the eighth, after the hundred; from the ninth on, after the two hundred."
export const ERA_TEXT: Record<"before100" | "after100" | "after200", string> = {
  before100: "وفياتهم قبل المائة",
  after100: "وفياتهم بعد المائة",
  after200: "وفياتهم بعد المائتين",
};

/** "1 حديث", "2 حديثان", "5 أحاديث", "12 حديثاً": the counted noun after a number. */
export function hadithCount(n: number) {
  if (n === 1) return "حديث واحد";
  if (n === 2) return "حديثان";
  const mod = n % 100;
  return `${n} ${mod >= 3 && mod <= 10 ? "أحاديث" : "حديثاً"}`;
}

export type Forms = { one: string; two: string; few: string; many: string; hundred: string };

/** Nouns counted on the narrator page. */
export const NOUNS = {
  hadith: { one: "حديث", two: "حديثان", few: "أحاديث", many: "حديثاً", hundred: "حديث" },
  shaykh: { one: "شيخ", two: "شيخان", few: "شيوخ", many: "شيخاً", hundred: "شيخ" },
  tilmidh: { one: "تلميذ", two: "تلميذان", few: "تلاميذ", many: "تلميذاً", hundred: "تلميذ" },
  balad: { one: "بلد", two: "بلدان", few: "بلدان", many: "بلداً", hundred: "بلد" },
} satisfies Record<string, Forms>;

/** The noun after a number printed on its own: 1 حديث، 2 حديثان، 5 أحاديث، 12 حديثاً، 100 حديث. */
export function nounFor(n: number, f: Forms) {
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return f.few;
  if (r <= 2) return f.hundred;
  return f.many;
}
