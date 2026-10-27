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
