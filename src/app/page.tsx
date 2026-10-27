import Link from "next/link";
import SpreadMap from "@/components/SpreadMap";
import { readData } from "@/lib/readData";
import type { City, Featured, MapData, Tabaqa } from "@/lib/types";

const featured = readData<Featured[]>("featured.json");
const map = readData<MapData>("map.json");
const cities = readData<Record<string, City>>("cities.json");
const spread = readData<Tabaqa[]>("spread.json");

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="naskh text-3xl font-bold leading-snug">رجال صحيح البخاري في الزمان والمكان</h1>
      <p className="mt-1 mb-5 max-w-2xl text-midad-soft">
        كيف انتقل مركز الرواية من جيل إلى جيل: اختر طبقة، أو شغّل الطبقات من الصحابة إلى صغار الآخذين عن تبع الأتباع.
      </p>

      <SpreadMap map={map} cities={cities} spread={spread} />

      <form action="/hadith/" className="mt-10 flex max-w-sm gap-2">
        <label htmlFor="n" className="sr-only">رقم الحديث</label>
        <input
          id="n"
          name="n"
          inputMode="numeric"
          placeholder="رقم الحديث، مثل 1"
          className="min-w-0 flex-1 rounded-sm border border-khatt bg-raqq px-3 py-2"
        />
        <button className="rounded-sm bg-nila px-4 py-2 text-raqq">اعرض</button>
      </form>

      <section className="mt-10" aria-labelledby="featured-h">
        <h2 id="featured-h" className="naskh text-2xl font-bold">أحاديث مختارة</h2>
        <ol className="mt-3 divide-y divide-khatt border-y border-khatt">
          {featured.map((f) => (
            <li key={f.n}>
              <Link href={`/hadith/?n=${f.n}`} className="group flex items-baseline gap-4 py-3">
                <span className="w-12 shrink-0 text-sm tabular-nums text-midad-soft">{f.n}</span>
                <span className="naskh line-clamp-1 flex-1 text-lg group-hover:text-nila">{f.matn}</span>
                <span className="hidden shrink-0 text-xs text-midad-soft sm:inline">
                  {f.cities.map((c) => cities[c]?.ar).join(" ← ")}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
