import { BookOpen, Map as MapIcon, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import PageFrame from "@/components/PageFrame";

export const metadata: Metadata = { title: "الصفحة غير موجودة · سَنَد" };

/** Exported as out/404.html: a ghufl dara, since the address names no page we know. */
export default function NotFound() {
  return (
    <PageFrame>
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
        <svg width="120" height="120" viewBox="0 0 104 104" aria-hidden="true">
          <circle cx="52" cy="52" r="44" fill="none" stroke="var(--midad)" strokeWidth="3" />
          <circle cx="52" cy="52" r="38" fill="none" stroke="var(--mughra)" strokeWidth="1.2" />
        </svg>
        <p className="mt-4 text-sm tabular-nums text-midad-soft">404</p>
        <h1 className="naskh mt-1 text-4xl font-bold leading-snug">هذه الصفحة غير موجودة</h1>
        <p className="naskh mt-3 text-xl leading-loose text-midad-soft">
          دارة غُفل: لم نعرف صاحب هذا الرابط، فلعله نُقل أو كُتب على غير وجهه.
        </p>
        <nav className="mt-8 flex gap-6 text-nila" aria-label="إلى أين؟">
          <Link href="/" className="inline-flex items-center gap-1 underline underline-offset-4 phone:min-h-11 phone:min-w-11 phone:justify-center">
            <MapIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            الخريطة
          </Link>
          <Link href="/search/" className="inline-flex items-center gap-1 underline underline-offset-4 phone:min-h-11 phone:min-w-11 phone:justify-center">
            <Search size={16} strokeWidth={1.5} aria-hidden="true" />
            البحث
          </Link>
          <Link href="/books/" className="inline-flex items-center gap-1 underline underline-offset-4 phone:min-h-11 phone:min-w-11 phone:justify-center">
            <BookOpen size={16} strokeWidth={1.5} aria-hidden="true" />
            الكتب
          </Link>
        </nav>
      </main>
    </PageFrame>
  );
}
