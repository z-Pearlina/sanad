import { stripMarks } from "./arabic.mjs";
import { TRANSMISSION } from "./labels";
import type { Group, Isnad } from "./types";
import type { Band, JourneyNode } from "@/components/sanad-map/types";

const BAND: Record<Group, Band> = {
  sahabi: "sahabi",
  thiqa: "thiqa",
  saduq: "saduq",
  maqbul: "maqbul",
  daif: "daif",
  see: "none",
};

/** A chain as the map draws it: the Companion first, al-Bukhari last. */
export function journeyNodes(isnad: Isnad): JourneyNode[] {
  return [...isnad.links].reverse().map((l) => ({
    ...(l.id ? { id: l.id } : {}),
    n: l.short ?? stripMarks(l.raw),
    city: l.city ?? null,
    ...(l.cityManual ? { m: 1 as const } : {}),
    t: l.tabaqa ?? null,
    b: l.id ? BAND[l.group ?? "see"] : "unknown",
    v: "",
    // the word the next narrator used when he reported from this one
    tr: l.tr ? (TRANSMISSION[l.tr] ?? "") : "",
    ...(l.conf !== null && l.conf < 1 ? { auto: 1 as const } : {}),
    ...(l.death ? { d: l.death } : {}),
  }));
}
