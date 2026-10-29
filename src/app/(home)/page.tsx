import SanadMap from "@/components/sanad-map/SanadMap";

// The home page is the map alone: its masthead carries the wordmark and these links,
// and the featured hadiths are its "follow a hadith" journeys (scripts/journeys.json).
const NAV = [
  { href: "/search/", label: "بحث" },
  { href: "/books/", label: "الكتب" },
  { href: "/game/", label: "رتّب السند" },
  { href: "/about/", label: "حول" },
];

export default function Home() {
  return (
    <main>
      <SanadMap nav={NAV} />
    </main>
  );
}
