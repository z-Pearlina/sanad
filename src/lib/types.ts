// Shapes of the JSON files written by scripts/build_data.py into public/data.

export type Group = "sahabi" | "thiqa" | "saduq" | "maqbul" | "daif" | "see";

export type Link = {
  raw: string; // the name as written in the text
  tr: string | null; // transmission word this narrator was reported with ("haddathana", "'an", ...)
  conf: number | null; // isnady match confidence
  id: string | null; // Taqrib number; null when the name was not identified
  name?: string;
  short?: string | null; // the short name of the home map ("ابن عيينة")
  death?: number | null;
  tabaqa?: number | null;
  rank?: number | null;
  group?: Group;
  phrase?: string | null; // Ibn Hajar's words, as extracted
  city?: string | null;
  cityManual?: boolean; // home from the well-known biographies (no city nisba)
};

// [text, kind, narrator id]: kind "name" | "tr" (transmission word) | "t" (other)
export type Segment = [string, "name" | "tr" | "t", string | null];

export type Isnad = {
  ordinal: number;
  toProphet: boolean;
  problem: string | null;
  start: number; // offset of the chain inside `ar`, -1 if not found
  end: number;
  segments: Segment[];
  links: Link[]; // from al-Bukhari (index 0) up to the Companion
};

export type Hadith = {
  n: string;
  book: { no: number; title: string } | null;
  prev: string | null;
  next: string | null;
  ar: string;
  en: string | null;
  isnads: Isnad[];
};

export type City = { ar: string; lat: number; lon: number; kind: "city" | "region" };

// public/data/map.json: the base map projected at build time (scripts/build_map.mjs)
export type MapData = { w: number; h: number; land: string; frame: string; cities: Record<string, [number, number]> };

export type Tabaqa = {
  tabaqa: number;
  ordinal: string;
  desc: string;
  example: string;
  era: "before100" | "after100" | "after200";
  total: number; // narrators of this tabaqa in the Taqrib
  located: number; // of them, with a city nisba
  cities: Record<string, number>;
};

export type NarratorRef = { id: string; name: string | null; short: string | null; city: string | null; count: number };

export type Narrator = {
  id: string;
  name: string;
  short: string | null;
  kunya: string | null;
  laqab: string | null;
  death: number | null;
  tabaqa: number | null;
  rank: number | null;
  group: Group;
  phrase: string | null;
  city: string | null;
  citySrc: "nisba" | "manual" | null;
  nisbaWord: string | null;
  entry: string;
  count: number;
  hadiths: string[];
  teachers: NarratorRef[];
  students: NarratorRef[];
};
