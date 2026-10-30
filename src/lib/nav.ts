export type NavIcon = "search" | "books" | "time" | "insights" | "game" | "about";

// The site's sections, in the desktop header, the home map's masthead and the phone menu.
export const NAV: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/search/", label: "بحث", icon: "search" },
  { href: "/books/", label: "الكتب", icon: "books" },
  { href: "/time/", label: "الزمان", icon: "time" },
  { href: "/insights/", label: "رؤى", icon: "insights" },
  { href: "/game/", label: "رتّب السند", icon: "game" },
  { href: "/about/", label: "حول", icon: "about" },
];

export const TAGLINE = "رجال صحيح البخاري في الزمان والمكان";
