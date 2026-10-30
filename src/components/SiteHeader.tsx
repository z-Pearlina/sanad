import Link from "next/link";
import PhoneBar from "./PhoneBar";
import { NAV, TAGLINE } from "@/lib/nav";

export default function SiteHeader() {
  return (
    <header className="border-b border-khatt">
      <div className="wide-only mx-auto max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 pt-2 pb-3">
        <Link href="/" className="flex items-baseline gap-3" aria-label="سَنَد: الصفحة الرئيسية">
          <span className="font-ruqaa text-4xl leading-none text-midad">سَنَد</span>
          <span className="hidden text-sm text-midad-soft sm:inline">{TAGLINE}</span>
        </Link>
        <nav className="flex gap-5 text-sm font-medium" aria-label="أقسام الموقع">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-nila hover:underline hover:underline-offset-4">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <PhoneBar />
    </header>
  );
}
