// Arabic counted nouns: the noun agrees with the number before it.

export const ORD = [
  "", "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة",
  "السابعة", "الثامنة", "التاسعة", "العاشرة", "الحادية عشرة", "الثانية عشرة",
] as const;

type Forms = { one: string; two: string; few: string; many: string; hundred: string };

const FORMS = {
  rawi: { one: "راوٍ واحد", two: "راويان", few: "رواة", many: "راوياً", hundred: "راوٍ" },
  city: { one: "مدينة واحدة", two: "مدينتان", few: "مدن", many: "مدينة", hundred: "مدينة" },
  balad: { one: "بلد واحد", two: "بلدان", few: "بلدان", many: "بلداً", hundred: "بلد" },
  sila: { one: "صلة واحدة", two: "صلتان", few: "صلات", many: "صلة", hundred: "صلة" },
  sanad: { one: "سند واحد", two: "سندين", few: "أسانيد", many: "سنداً", hundred: "سند" },
  rajul: { one: "رجل واحد", two: "رجلان", few: "رجال", many: "رجلاً", hundred: "رجل" },
} satisfies Record<string, Forms>;

export type Noun = keyof typeof FORMS;

/** Western digits with thousands separators, as used in Algeria. */
export const fmt = (n: number): string => n.toLocaleString("en-US");

/** Number and noun together: «راوٍ واحد»، «3 رواة»، «11 راوياً»، «100 راوٍ». */
export function count(n: number, noun: Noun): string {
  const f = FORMS[noun];
  if (n === 1) return f.one;
  if (n === 2) return f.two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${fmt(n)} ${f.few}`;
  if (r === 0 || r === 1 || r === 2) return `${fmt(n)} ${f.hundred}`;
  return `${fmt(n)} ${f.many}`;
}

/** The noun alone, for a number printed separately. */
export function words(n: number, noun: Noun): string {
  const f = FORMS[noun];
  if (n === 1) return f.one.split(" ")[0];
  if (n === 2) return f.two;
  const r = n % 100;
  if (r >= 3 && r <= 10) return f.few;
  if (r === 0 || r === 1 || r === 2) return f.hundred;
  return f.many;
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** Escapes text for HTML templates. */
export const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ENTITIES[c]);
