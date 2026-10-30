"use client";

import { ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Dara from "./Dara";
import { deathText, hadithCount } from "@/lib/labels";
import { useSearch } from "@/lib/useSearch";

const OPEN_EVENT = "sanad-quick-search";
const SHOWN_NARRATORS = 6;
const SHOWN_TEXTS = 8;
const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** The magnifier of the header: the same window as Ctrl+K. */
export function SearchButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      aria-label="بحث سريع"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
    >
      <Search size={18} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}

/** A search window over the page, with the logic of the search page. Mounted once, in the root layout. */
export default function QuickSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => {
      const el = dialog.current;
      if (!el) return;
      if (el.open) {
        el.close();
        return;
      }
      el.showModal();
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      // the physical key: on an Arabic keyboard the letter of this key is «ن»
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="qsearch"
      aria-label="بحث سريع"
      onClose={() => setOpen(false)}
      // a press on the backdrop lands on the dialog itself
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      {/* mounted afresh each time, so the window opens empty */}
      {open && <Panel close={() => dialog.current?.close()} />}
    </dialog>
  );
}

type Item = { href: string; body: React.ReactNode };

function Panel({ close }: { close: () => void }) {
  const router = useRouter();
  const s = useSearch();
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const number: Item[] = s.number
    ? [{ href: `/hadith/?n=${s.number}`, body: <span className="naskh text-xl leading-normal">الحديث {s.number}</span> }]
    : [];
  const people: Item[] = s.narrators.slice(0, SHOWN_NARRATORS).map((r) => ({
    href: `/narrator/?id=${r.id}`,
    body: (
      <>
        <Dara group={r.group} size={18} />
        <span className="min-w-0 flex-1">
          <span className="naskh line-clamp-1 text-lg leading-normal">{r.name}</span>
          <span className="block text-xs text-midad-soft">{[r.kunya, r.death ? deathText(r.death) : null, hadithCount(r.count)].filter(Boolean).join(" · ")}</span>
        </span>
      </>
    ),
  }));
  const hits: Item[] = s.texts.hits.slice(0, SHOWN_TEXTS).map((h) => ({
    href: `/hadith/?n=${h.n}`,
    body: (
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-midad-soft">الحديث {h.n}{h.book && ` · ${h.book}`}</span>
        <span className="naskh line-clamp-2 text-[17px] leading-[1.8]">
          {h.parts.map((p, i) => (p.hit ? <mark key={i} className="bg-raml font-bold text-midad">{p.text}</mark> : <span key={i}>{p.text}</span>))}
        </span>
      </span>
    ),
  }));
  const allResults: Item[] =
    s.q.length >= 2 && !s.number
      ? [{ href: `/search/?q=${encodeURIComponent(s.query)}`, body: <span className="text-sm text-nila">كل النتائج في صفحة البحث</span> }]
      : [];
  const sections: { title?: string; items: Item[] }[] = [
    { items: number },
    ...(s.tab === "narrators"
      ? [{ title: "الرواة", items: people }, { title: "النصوص", items: hits }]
      : [{ title: "النصوص", items: hits }, { title: "الرواة", items: people }]),
    { items: allResults },
  ];
  const items = sections.flatMap((sec) => sec.items);
  const at = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      setActive((at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
    }
    if (e.key === "Enter" && items[at]) {
      e.preventDefault();
      router.push(items[at].href);
      close();
    }
  };

  let n = -1;
  const waiting = s.q.length >= 2 && !s.number && !s.answered && !hits.length && !people.length;
  const nothing = s.q.length >= 2 && !s.number && s.answered && s.index !== null && !hits.length && !people.length;
  return (
    <>
      <div className="qsearch-input">
        <Search size={20} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-midad-soft" />
        <input
          autoFocus
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={s.query}
          onChange={(e) => {
            s.type(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder="رقم حديث، أو اسم راوٍ، أو كلمات من المتن"
          aria-label="ابحث في الأحاديث والرواة"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="qsearch-list"
          aria-activedescendant={items.length ? `qsearch-${at}` : undefined}
        />
      </div>
      <div ref={list} id="qsearch-list" className="qsearch-list" role="listbox" aria-label="النتائج">
        {sections.map((sec) =>
          sec.items.length ? (
            <div key={sec.title ?? sec.items[0].href} role="group" aria-label={sec.title}>
              {sec.title && <p className="qsearch-head" aria-hidden="true">{sec.title}</p>}
              {sec.items.map((item) => {
                n += 1;
                const i = n;
                return (
                  <Link
                    key={item.href}
                    id={`qsearch-${i}`}
                    href={item.href}
                    role="option"
                    aria-selected={i === at}
                    tabIndex={-1}
                    className="qsearch-row"
                    onPointerMove={() => setActive(i)}
                    onClick={close}
                  >
                    {item.body}
                    {i === at && <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" className="ms-auto shrink-0 text-midad-soft" />}
                  </Link>
                );
              })}
            </div>
          ) : null,
        )}
        {waiting && <p className="qsearch-note">جارٍ البحث…</p>}
        {nothing && <p className="qsearch-note">لا نتائج لهذا البحث.</p>}
        {s.q.length < 2 && !s.number && <p className="qsearch-note">اكتب ما تبحث عنه، بالتشكيل أو بدونه.</p>}
      </div>
      <p className="qsearch-foot">
        <span>
          <kbd>↑</kbd> <kbd>↓</kbd> للتنقل · <kbd>Enter</kbd> للفتح · <kbd>Esc</kbd> للإغلاق
        </span>
        <span dir="ltr">{isMac() ? "⌘K" : "Ctrl K"}</span>
      </p>
    </>
  );
}
