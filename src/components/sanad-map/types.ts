// Shapes of public/data/map.json (scripts/build_map_data.py)
// and public/data/geometry.json (scripts/build_geometry.mjs).

/** Colour group of Ibn Hajar's twelve ranks. */
export type Band = "sahabi" | "thiqa" | "saduq" | "maqbul" | "daif" | "none" | "unknown";

export type City = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** 1 for a region (الشام، خراسان…) rather than a city. */
  region?: 1;
};

export type Tabaqa = {
  n: number;
  title: string;
  example: string;
  era: string;
  narrators: number;
  cities: number;
  links: number;
};

export type Flow = { from: string; to: string; n: number };

export type TopNarrator = {
  /** Taqrib entry number. */
  id: string;
  n: string;
  b: Band;
  v: string;
  /** Number of chains in Sahih al-Bukhari. */
  c: number;
  /** 1 when the home was assigned by hand (no city nisba). */
  m?: 1;
  d?: number;
};

export type JourneyNode = {
  id?: string;
  n: string;
  city: string | null;
  m?: 1;
  t: number | null;
  b: Band;
  v: string;
  /** Transmission term used by the next narrator, in Arabic. */
  tr: string;
  /** 1 when the name was matched automatically with confidence below 1. */
  auto?: 1;
  d?: number;
};

export type Journey = {
  number: number;
  title: string;
  prophet: boolean;
  nodes: JourneyNode[];
};

export type MapData = {
  source: string;
  cities: City[];
  tabaqat: Tabaqa[];
  spread: Record<string, Record<string, number>>;
  local: Record<string, Record<string, number>>;
  flows: Record<string, Flow[]>;
  top: Record<string, Record<string, TopNarrator[]>>;
  journeys: Journey[];
};

export type GeoLabel = {
  text: string;
  lon: number;
  lat: number;
  kind: "sea" | "river";
  rotate?: number;
  x: number;
  y: number;
};

export type Geometry = {
  W: number;
  H: number;
  landOuter: string;
  land: string;
  coast: string;
  rivers: string;
  lakes: string;
  grat: string;
  cities: Record<string, [number, number]>;
  labels: GeoLabel[];
};

export type NavLink = { href: string; label: string };
