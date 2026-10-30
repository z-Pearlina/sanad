"use client";

import { BookOpen, ChartLine, Hourglass, Info, ListOrdered, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, type NavIcon } from "@/lib/nav";

const ICONS: Record<NavIcon, typeof Search> = {
  search: Search,
  books: BookOpen,
  time: Hourglass,
  insights: ChartLine,
  game: ListOrdered,
  about: Info,
};

/** The section links; the current page is marked with a small ochre dara. */
export default function SiteNav({ onPick }: { onPick?: () => void }) {
  const path = usePathname();
  return NAV.map((n) => {
    const Icon = ICONS[n.icon];
    return (
      <Link key={n.href} href={n.href} onClick={onPick} className="nav-link" aria-current={path === n.href ? "page" : undefined}>
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        {n.label}
      </Link>
    );
  });
}
