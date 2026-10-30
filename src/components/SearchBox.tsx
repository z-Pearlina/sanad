"use client";

import { ChevronDown, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Dara from "./Dara";
import { deathText, hadithCount } from "@/lib/labels";
import { MAX_NARRATORS, useSearch } from "@/lib/useSearch";

export default function SearchBox() {
  const router = useRouter();
  const { query, type, load, q, number, index, narrators, texts, more, phrases, hasMore, textCount, answered, tab, setTab } = useSearch(useSearchParams().get("q") ?? "");

  return (
    <div id="search">
      <label htmlFor="q" className="naskh text-2xl font-bold">ابحث في الأحاديث والرواة</label>
      <p className="mb-2 text-sm text-midad-soft">
        برقم الحديث، أو باسم الراوي أو كنيته أو نسبته، أو بكلمات من نص الحديث، بالتشكيل أو بدونه. والعبارة بين علامتي تنصيص تُطابَق متتابعة.
      </p>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (number) router.push(`/hadith/?n=${number}`);
        }}
      >
        <input
          id="q"
          type="search"
          enterKeyHint="search"
          value={query}
          onFocus={load}
          onChange={(e) => type(e.target.value)}
          placeholder="مثلاً: 6018، أو الزهري، أو إنما الأعمال"
          autoComplete="off"
          className="w-full max-w-xl rounded-sm border border-khatt bg-raqq px-3 py-2 text-lg"
          aria-describedby="search-status"
        />
      </form>
      <div id="search-status" aria-live="polite" className="mt-3 max-w-3xl">
        {number && (
          <Link href={`/hadith/?n=${number}`} className="naskh flex items-center gap-1 border-b border-khatt py-2 text-xl text-nila phone:min-h-11">
            الحديث {number}
            <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        )}
        {!number && q.length >= 2 && (
          <>
            <div role="tablist" aria-label="نتائج البحث" className="mb-2 flex gap-1 border-b border-khatt">
              <TabButton on={tab === "texts"} onClick={() => setTab("texts")}>
                النصوص <span className="tabular-nums">({answered ? `${textCount}${phrases && hasMore ? "+" : ""}` : "…"})</span>
              </TabButton>
              <TabButton on={tab === "narrators"} onClick={() => setTab("narrators")}>
                الرواة <span className="tabular-nums">({index ? (narrators.length === MAX_NARRATORS ? `${MAX_NARRATORS}+` : narrators.length) : "…"})</span>
              </TabButton>
            </div>
            {tab === "texts" && (
              <>
                {answered && texts.hits.length === 0 && <p className="text-sm text-midad-soft">لا حديث فيه هذه الكلمات.</p>}
                {!answered && texts.hits.length === 0 && <p className="text-sm text-midad-soft">جارٍ البحث في النصوص…</p>}
                <ol className="divide-y divide-khatt">
                  {texts.hits.map((h) => (
                    <li key={h.n}>
                      <Link href={`/hadith/?n=${h.n}`} className="group block py-2.5">
                        <span className="text-sm text-midad-soft">
                          <span className="font-medium text-nila group-hover:underline">الحديث {h.n}</span>
                          {h.book && ` · ${h.book}`}
                        </span>
                        <span className="naskh mt-0.5 block text-[19px] leading-[2.1]">
                          {h.parts.map((p, i) => (p.hit ? <mark key={i} className="rounded-sm bg-raml px-0.5 font-bold text-midad">{p.text}</mark> : <span key={i}>{p.text}</span>))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {hasMore && answered && (
                  <button type="button" onClick={more} className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-khatt px-4 py-2 text-sm phone:min-h-11">
                    <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
                    المزيد
                  </button>
                )}
              </>
            )}
            {tab === "narrators" && (
              <>
                {!index && <p className="text-sm text-midad-soft">جارٍ تحميل فهرس الرواة…</p>}
                {index && narrators.length === 0 && <p className="text-sm text-midad-soft">لا راوي بهذا الاسم في أسانيد البخاري.</p>}
                {narrators.length > 0 && (
                  <ul className="divide-y divide-khatt">
                    {narrators.map((r) => (
                      <li key={r.id}>
                        <Link href={`/narrator/?id=${r.id}`} className="group flex items-center gap-3 py-2 phone:min-h-11">
                          <Dara group={r.group} size={18} />
                          <span className="min-w-0 flex-1">
                            <span className="naskh line-clamp-1 text-lg leading-normal group-hover:text-nila">{r.name}</span>
                            <span className="block text-xs text-midad-soft">
                              {[r.kunya, r.death ? deathText(r.death) : null, hadithCount(r.count)].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-1.5 text-sm phone:mb-0 phone:min-h-11 ${on ? "border-nila text-nila" : "border-transparent text-midad-soft"}`}
    >
      {children}
    </button>
  );
}
