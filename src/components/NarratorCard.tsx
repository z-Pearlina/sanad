"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Dara from "./Dara";
import { getCities, getNarrator } from "@/lib/data";
import { GROUP_LABEL, deathText, hadithCount, tabaqaName } from "@/lib/labels";
import type { Narrator } from "@/lib/types";

const LINK = 'a[href*="/narrator/?id="]';
const SHOW_MS = 220;
const GAP = 8;
const EDGE = 12;
const CARD_ID = "narrator-card";

type Card = { link: HTMLAnchorElement; narrator: Narrator; city: string | null };

/**
 * The card a narrator's name opens wherever it is written, in any list or text and on the maps.
 * One watcher for the whole page, so a new list needs nothing of its own. It answers the mouse and
 * the keyboard only: on a phone a tap keeps opening the narrator's page. Its data comes from the
 * narrator's file when first wanted, and stays in the cache of lib/data.ts.
 */
export default function NarratorCard() {
  const [card, setCard] = useState<Card | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let wanted: HTMLAnchorElement | null = null;
    let timer = 0;
    const hide = () => {
      wanted = null;
      window.clearTimeout(timer);
      setCard(null);
    };
    const show = (link: HTMLAnchorElement, wait: number) => {
      if (wanted === link) return;
      wanted = link;
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const id = new URL(link.href).searchParams.get("id");
        if (!id) return;
        const found = await Promise.all([getNarrator(id), getCities()]).catch(() => null);
        if (!found || wanted !== link || !link.isConnected) return;
        const [narrator, cities] = found;
        setCard({ link, narrator, city: narrator.city ? (cities[narrator.city]?.ar ?? null) : null });
      }, wait);
    };
    const linkOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLAnchorElement>(LINK) : null);

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const link = linkOf(e.target);
      if (link) show(link, SHOW_MS);
      else if (wanted) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const link = linkOf(e.target);
      if (link?.matches(":focus-visible")) show(link, 0);
    };
    const onBlur = (e: FocusEvent) => {
      if (linkOf(e.target) === wanted) hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", hide);
    document.documentElement.addEventListener("pointerleave", hide);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", hide);
      document.documentElement.removeEventListener("pointerleave", hide);
      window.removeEventListener("scroll", hide, { capture: true });
    };
  }, []);

  // under the name, or over it near the foot of the screen; the first line of a name that wraps
  useLayoutEffect(() => {
    const el = box.current;
    if (!card || !el) return;
    const at = card.link.getClientRects()[0] ?? card.link.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = el;
    const below = at.bottom + GAP;
    el.style.top = `${below + h > window.innerHeight - EDGE ? Math.max(EDGE, at.top - h - GAP) : below}px`;
    el.style.left = `${Math.min(window.innerWidth - w - EDGE, Math.max(EDGE, at.right - w))}px`;
    card.link.setAttribute("aria-describedby", CARD_ID);
    return () => card.link.removeAttribute("aria-describedby");
  }, [card]);

  if (!card) return null;
  const { narrator: p, city } = card;
  return (
    <div ref={box} id={CARD_ID} role="tooltip" className="ncard">
      <p className="ncard-name">
        <Dara group={p.group} size={20} />
        <b className="naskh">{p.short ?? p.name}</b>
      </p>
      <p className={p.phrase ? "naskh ncard-verdict" : "ncard-verdict"}>{p.phrase ? `«${p.phrase}»` : GROUP_LABEL.see}</p>
      <p className="ncard-facts">
        {[p.tabaqa ? tabaqaName(p.tabaqa) : null, p.death ? deathText(p.death) : null, city, hadithCount(p.count)].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
