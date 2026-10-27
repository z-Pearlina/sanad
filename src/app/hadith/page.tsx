"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import HadithView from "@/components/HadithView";

function HadithFromQuery() {
  const n = useSearchParams().get("n")?.trim() || "1";
  // keyed by number so each hadith starts from a clean state
  return <HadithView key={n} n={n} />;
}

export default function HadithPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-midad-soft">جارٍ تحميل الحديث…</p>}>
      <HadithFromQuery />
    </Suspense>
  );
}
