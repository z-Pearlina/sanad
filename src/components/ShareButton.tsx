"use client";

import { Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PHONE_QUERY } from "./sanad-map/phone";

const SHOWN_MS = 2000;

/** On a phone the system's share sheet; on a computer the link is copied, with a small notice. */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share && window.matchMedia(PHONE_QUERY).matches) {
      // closing the sheet rejects: nothing to report
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), SHOWN_MS);
  };

  return (
    <span className="relative inline-flex">
      <button type="button" onClick={share} className="line-button">
        <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />
        مشاركة
      </button>
      <span role="status" className={copied ? "share-note" : "sr-only"}>
        {copied ? "نُسخ الرابط" : ""}
      </span>
    </span>
  );
}
