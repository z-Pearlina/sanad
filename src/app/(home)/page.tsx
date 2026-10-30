import PhoneBar from "@/components/PhoneBar";
import SanadMap from "@/components/sanad-map/SanadMap";
import { NAV } from "@/lib/nav";

// The home page is the map alone: its masthead carries the wordmark and the section links
// (on a phone, the top bar), and the featured hadiths are its "follow a hadith" journeys
// (scripts/journeys.json).
export default function Home() {
  return (
    <main className="home-map">
      <PhoneBar />
      <SanadMap nav={NAV} />
    </main>
  );
}
