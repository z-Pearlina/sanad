// Ummah API (https://ummahapi.com), read from the browser.
// Confirmed on 27/10/2026: GET /api/hadith/bukhari/1 ->
//   { success, service: "hadith", data: { id, collection, hadithnumber, arabic, english, grade } }
// with `access-control-allow-origin: *`; unknown numbers answer 404.

const BASE = (process.env.NEXT_PUBLIC_UMMAH_API_BASE ?? "https://ummahapi.com").replace(/\/$/, "");

export type UmmahHadith = {
  id: string;
  collection: string;
  hadithnumber: number;
  arabic: string;
  english?: string;
};

/** The hadith from Ummah API, or null on any failure or after `timeoutMs`. */
export async function fetchUmmahHadith(n: string, timeoutMs = 3000): Promise<UmmahHadith | null> {
  // Same numbering as our data, sub-numbers included ("1132.2" checked).
  if (!/^\d+(\.\d+)?$/.test(n)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/hadith/bukhari/${n}`, { signal: controller.signal });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.success && typeof body.data?.arabic === "string" ? (body.data as UmmahHadith) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
