"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SiteNav from "./SiteNav";
import ThemeButton from "./ThemeButton";
import { TAGLINE } from "@/lib/nav";

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

  const Icon = open ? X : Menu;
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
        <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && (
        <nav id="phone-menu" className="phone-menu" aria-label="أقسام الموقع">
          <p>{TAGLINE}</p>
          <SiteNav onPick={() => setOpen(false)} />
          <ThemeButton className="phone-menu-theme" named />
        </nav>
      )}
    </div>
  );
}
