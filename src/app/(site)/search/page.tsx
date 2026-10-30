import type { Metadata } from "next";
import { Suspense } from "react";
import SearchBox from "@/components/SearchBox";

export const metadata: Metadata = { title: "بحث · سَنَد" };

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="sr-only">البحث</h1>
      <Suspense>
        <SearchBox />
      </Suspense>
    </main>
  );
}
