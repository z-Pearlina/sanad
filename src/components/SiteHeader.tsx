import Link from "next/link";

const NAV = [
  { href: "/search/", label: "بحث" },
  { href: "/books/", label: "الكتب" },
  { href: "/game/", label: "رتّب السند" },
  { href: "/about/", label: "حول" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-khatt">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 pt-2 pb-3">
        <Link href="/" className="flex items-baseline gap-3" aria-label="سَنَد: الصفحة الرئيسية">
          <span className="font-ruqaa text-4xl leading-none text-midad">سَنَد</span>
          <span className="hidden text-sm text-midad-soft sm:inline">رجال صحيح البخاري في الزمان والمكان</span>
        </Link>
        <nav className="flex gap-5 text-sm font-medium" aria-label="أقسام الموقع">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-nila hover:underline hover:underline-offset-4">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
