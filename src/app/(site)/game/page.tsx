import type { Metadata } from "next";
import GameView from "@/components/GameView";

export const metadata: Metadata = { title: "رتّب السند · سَنَد" };

export default function GamePage() {
  return <GameView />;
}
