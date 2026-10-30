"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NAV, TAGLINE } from "@/lib/nav";

/** The compact header on phones: the wordmark, and a menu with the sections and the tagline. */
export default function PhoneBar() {
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={bar} className="phone-bar">
      <Link href="/" className="phone-bar-mark font-ruqaa" aria-label="سَنَد: الصفحة الرئيسية">
        سَنَد
      </Link>
      <button
        type="button"
        className="phone-bar-button"
        aria-label={open ? "إغلاق القائمة" : "القائمة"}
        aria-expanded={open}
        aria-controls="phone-menu"
        onClick={() => setOpen(!open)}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3 6h16M3 11h16M3 16h16" />}
        </svg>
      </button>
      {open && (
        <nav id="phone-menu" className="phone-menu" aria-label="أقسام الموقع">
          <p>{TAGLINE}</p>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
