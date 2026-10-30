import Link from "next/link";
import HeaderWatch from "./HeaderWatch";
import PhoneBar from "./PhoneBar";
import SiteNav from "./SiteNav";
import ThemeButton from "./ThemeButton";
import { TAGLINE } from "@/lib/nav";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <HeaderWatch />
      <div className="wide-only site-header-row mx-auto max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4">
        <Link href="/" className="site-mark flex items-baseline gap-3" aria-label="سَنَد: الصفحة الرئيسية">
          <span className="font-ruqaa text-midad">سَنَد</span>
          <span className="hidden text-sm text-midad-soft lg:inline">{TAGLINE}</span>
        </Link>
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 text-sm font-medium" aria-label="أقسام الموقع">
            <SiteNav />
          </nav>
          <ThemeButton className="line-button" />
        </div>
      </div>
      <PhoneBar />
    </header>
  );
}
