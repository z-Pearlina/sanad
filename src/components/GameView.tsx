"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Salla from "./Salla";
import { getData } from "@/lib/data";
import { deathText, tabaqaName } from "@/lib/labels";

type GameLink = { id: string; raw: string; tabaqa: number; death: number | null };
type GameChain = { n: string; links: GameLink[] }; // links: Companion first

type Round = { chain: GameChain; order: GameLink[]; checked: boolean; tries: number };

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function triesText(n: number) {
  if (n === 1) return "من أول محاولة";
  if (n === 2) return "بعد محاولتين";
  return `بعد ${n} ${n % 100 >= 3 && n % 100 <= 10 ? "محاولات" : "محاولة"}`;
}

function newRound(chains: GameChain[], previous?: GameChain): Round {
  let chain = chains[Math.floor(Math.random() * chains.length)];
  if (chains.length > 1) while (chain === previous) chain = chains[Math.floor(Math.random() * chains.length)];
  let order = shuffle(chain.links);
  while (order.every((l, i) => l.id === chain.links[i].id)) order = shuffle(chain.links);
  return { chain, order, checked: false, tries: 0 };
}

/** "Order the chain": the narrators of a known chain, scrambled; put them back from the Companion down. */
export default function GameView() {
  const [chains, setChains] = useState<GameChain[] | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [hints, setHints] = useState(false);

  useEffect(() => {
    getData<GameChain[]>("game.json").then((all) => {
      setChains(all);
      setRound(newRound(all));
    });
  }, []);

  if (!chains || !round) return <p className="py-16 text-center text-midad-soft">جارٍ تحضير سند…</p>;

  const { chain, order, checked, tries } = round;
  const correct = order.map((l, i) => l.id === chain.links[i].id);
  const solved = checked && correct.every(Boolean);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setRound({ ...round, order: next, checked: false });
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="naskh text-3xl font-bold leading-snug">رتّب السند</h1>
      <p className="mt-1 text-midad-soft">
        هؤلاء رجال سند حديث من صحيح البخاري، عُرفوا كلهم، لكن ترتيبهم ضاع. أعدهم من الصحابي في الأعلى إلى شيخ البخاري في
        الأسفل.
      </p>

      <label className="mt-4 flex items-center gap-2 text-sm phone:min-h-11">
        <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} className="accent-[var(--nila)] phone:size-6" />
        أظهر الطبقة وسنة الوفاة تلميحاً
      </label>

      <ol className="mt-5 space-y-2" aria-label="رجال السند">
        <li className="naskh px-3 text-xl font-bold">
          النبي <Salla />
        </li>
        {order.map((l, i) => (
          <li
            key={l.id}
            className={`flex items-center gap-3 rounded-sm border bg-raqq px-3 py-2 ${
              checked ? (correct[i] ? "border-nila" : "border-dashed border-midad-soft") : "border-khatt"
            }`}
          >
            <span className="w-5 shrink-0 text-center text-sm tabular-nums text-midad-soft">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="naskh block text-xl leading-normal">{l.raw}</span>
              {hints && (
                <span className="block text-xs text-midad-soft">
                  {tabaqaName(l.tabaqa)}
                  {l.death ? ` · ${deathText(l.death)}` : ""}
                </span>
              )}
              {checked && (
                <span className={`block text-xs ${correct[i] ? "text-nila" : "text-midad-soft"}`}>
                  {correct[i] ? "في موضعه" : "ليس هذا موضعه"}
                </span>
              )}
            </span>
            <span className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0 || solved}
                aria-label={`انقل ${l.raw} إلى أعلى`}
                className="rounded-sm border border-khatt px-2 leading-6 disabled:opacity-30 phone:size-11 phone:px-0"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1 || solved}
                aria-label={`انقل ${l.raw} إلى أسفل`}
                className="rounded-sm border border-khatt px-2 leading-6 disabled:opacity-30 phone:size-11 phone:px-0"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
        <li className="naskh px-3 text-xl font-bold">البخاري</li>
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
        {!solved && (
          <button
            type="button"
            onClick={() => setRound({ ...round, checked: true, tries: tries + 1 })}
            className="rounded-sm bg-nila px-4 py-2 text-raqq phone:min-h-11"
          >
            تحقّق
          </button>
        )}
        {checked && !solved && (
          <span className="text-sm text-midad-soft">
            {correct.filter(Boolean).length} من {order.length} في مواضعهم.
          </span>
        )}
        {solved && (
          <p className="naskh text-xl">
            أحسنت، هذا هو السند {triesText(tries)}.{" "}
            <Link href={`/hadith/?n=${chain.n}`} className="text-nila underline underline-offset-4">
              افتح الحديث {chain.n}
            </Link>
          </p>
        )}
        <button type="button" onClick={() => setRound(newRound(chains, chain))} className="rounded-sm border border-khatt px-4 py-2 text-sm phone:min-h-11">
          سند آخر
        </button>
      </div>
    </div>
  );
}
