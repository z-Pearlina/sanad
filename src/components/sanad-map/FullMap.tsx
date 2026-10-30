"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  /** The map has gone full screen or come back. */
  onChange: (full: boolean) => void;
};

/**
 * On a phone a map inside a page is a preview that lets the page scroll. This button opens it
 * full screen, where one finger moves it and two zoom it; the close button or the browser's
 * back button returns to the page.
 */
export default function FullMap({ children, onChange }: Props) {
  const [full, setFull] = useState(false);
  const notify = useRef(onChange);

  useEffect(() => {
    notify.current = onChange;
  }, [onChange]);

  useEffect(() => {
    notify.current(full);
    if (!full) return;
    window.history.pushState({ sanadFullMap: true }, "");
    const onBack = () => setFull(false);
    window.addEventListener("popstate", onBack);
    document.documentElement.classList.add("sm-locked");
    return () => {
      window.removeEventListener("popstate", onBack);
      document.documentElement.classList.remove("sm-locked");
    };
  }, [full]);

  return (
    <div className={full ? "sm-full" : undefined}>
      {children}
      {full ? (
        <button type="button" className="sm-full-close" onClick={() => window.history.back()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
          إغلاق
        </button>
      ) : (
        <button type="button" className="sm-open-map" onClick={() => setFull(true)}>
          افتح الخريطة
        </button>
      )}
    </div>
  );
}
