import type { City, Featured, Hadith, MapData, Narrator, Tabaqa } from "./types";

const cache = new Map<string, Promise<unknown>>();

/** Fetch a file of public/data once per page load. */
export function getData<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;
  const request = fetch(`/data/${path}`).then((res) => {
    if (!res.ok) {
      cache.delete(path);
      throw new Error(`${path}: ${res.status}`);
    }
    return res.json() as Promise<T>;
  });
  cache.set(path, request);
  return request;
}

export const getHadith = (n: string) => getData<Hadith>(`hadith/${encodeURIComponent(n)}.json`);
export const getCities = () => getData<Record<string, City>>("cities.json");
export const getFeatured = () => getData<Featured[]>("featured.json");
export const getMap = () => getData<MapData>("map.json");
export const getSpread = () => getData<Tabaqa[]>("spread.json");
export const getNarrator = (id: string) => getData<Narrator>(`narrators/${encodeURIComponent(id)}.json`);
