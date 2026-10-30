import { Suspense } from "react";
import PhoneBar from "@/components/PhoneBar";
import { HomeMap } from "@/components/sanad-map/SanadMap";
import { NAV } from "@/lib/nav";

// The home page is the map alone: its masthead carries the wordmark and the section links
// (on a phone, the top bar), and the featured hadiths are its "follow a hadith" journeys
// (scripts/journeys.json).
export default function Home() {
  return (
    <main className="home-map">
      <PhoneBar />
      <Suspense fallback={<div className="sanad-map" dir="rtl" lang="ar" />}>
        <HomeMap nav={NAV} />
      </Suspense>
    </main>
  );
}
