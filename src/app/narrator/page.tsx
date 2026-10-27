"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import NarratorView from "@/components/NarratorView";

function NarratorFromQuery() {
  const id = useSearchParams().get("id")?.trim() || "4685";
  return <NarratorView key={id} id={id} />;
}

export default function NarratorPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-midad-soft">جارٍ تحميل الترجمة…</p>}>
      <NarratorFromQuery />
    </Suspense>
  );
}
