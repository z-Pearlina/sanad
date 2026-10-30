"use client";

import { useEffect } from "react";

// apart, so a page that ends just past the mark does not flip the header back and forth
const SHRINK_AT = 40;
const GROW_AT = 8;

/** Marks the page as scrolled, which shrinks the header, and keeps --header-h true to its height. */
export default function HeaderWatch() {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>(".site-header");
    let scrolled = false;
    const onScroll = () => {
      const next = window.scrollY > (scrolled ? GROW_AT : SHRINK_AT);
      if (next === scrolled) return;
      scrolled = next;
      root.toggleAttribute("data-scrolled", next);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const measure = new ResizeObserver(() => {
      if (header) root.style.setProperty("--header-h", `${header.offsetHeight}px`);
    });
    if (header) measure.observe(header);
    return () => {
      window.removeEventListener("scroll", onScroll);
      measure.disconnect();
      root.removeAttribute("data-scrolled");
      root.style.removeProperty("--header-h");
    };
  }, []);
  return null;
}
