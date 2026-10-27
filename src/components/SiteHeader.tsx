import Link from "next/link";

const NAV = [
  { href: "/#search", label: "بحث" },
  { href: "/books/", label: "الكتب" },
  { href: "/game/", label: "رتّب السند" },
  { href: "/about/", label: "حول" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-khatt">
      <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-ruqaa text-3xl leading-none text-midad" aria-label="سَنَد: الصفحة الرئيسية">
          سَنَد
        </Link>
        <nav className="flex gap-5 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-midad-soft hover:text-nila">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
