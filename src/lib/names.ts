import { searchKey, stripMarks } from "./arabic.mjs";

/** The Taqrib writes "بن عباس" for "ابن عباس"; "أبي هريرة" and "أبا هريرة" are "أبو هريرة". */
export function normalizeName(text: string): string {
  return stripMarks(text)
    .replace(/(^|\s)ابن(?=\s|$)/g, "$1بن")
    .replace(/(^|\s)[أا]ب[يا](?=\s)/g, "$1أبو");
}

/** The words of a name, as the search compares them. */
export const nameWords = (text: string) => normalizeName(text).split(/\s+/).map(searchKey).filter(Boolean);

// Arabic-Indic digits typed on an Arabic keyboard count as numbers too.
export const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
