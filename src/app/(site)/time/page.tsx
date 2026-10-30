"use client";

import { Suspense } from "react";
import TimeView from "@/components/TimeView";

export default function TimePage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-midad-soft">جارٍ تحميل الزمان…</p>}>
      <TimeView />
    </Suspense>
  );
}
