// Lucide icons as markup, for the parts of the maps drawn without React. Arrows and the
// play triangle point the way an Arabic page reads.
import type { NavIcon } from "@/lib/nav";

const icon = (body: string, flip = false) =>
  `<svg class="sm-i${flip ? " sm-flip" : ""}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const NAV_ICON: Record<NavIcon, string> = {
  search: icon(`<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>`),
  books: icon(`<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>`),
  time: icon(`<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>`),
  insights: icon(`<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>`),
  game: icon(`<path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/>`),
  about: icon(`<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>`),
};

export const ICON = {
  today: icon(`<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/><path d="M8 17h.01"/><path d="M12 17h.01"/><path d="M16 17h.01"/>`),
  route: icon(`<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>`),
  play: icon(`<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>`, true),
  pause: icon(`<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>`),
  /** Back along the page: to the right in Arabic. */
  prev: icon(`<path d="m9 18 6-6-6-6"/>`),
  next: icon(`<path d="m15 18-6-6 6-6"/>`),
  again: icon(`<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>`),
  plus: icon(`<path d="M5 12h14"/><path d="M12 5v14"/>`),
  minus: icon(`<path d="M5 12h14"/>`),
};
