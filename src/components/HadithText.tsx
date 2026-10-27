import Link from "next/link";
import type { Isnad } from "@/lib/types";

/**
 * The full Arabic text as written: inside each chain, transmission words are
 * in vermilion and identified narrators link to their page; the rest (the
 * matn) is set larger.
 */
export default function HadithText({ text, isnads }: { text: string; isnads: Isnad[] }) {
  const chains = isnads.filter((s) => s.start >= 0 && s.segments.length).sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  chains.forEach((chain, ci) => {
    if (chain.start < pos) return; // overlapping chains: keep the first
    if (chain.start > pos) parts.push(<Matn key={`m${ci}`} text={text.slice(pos, chain.start)} />);
    parts.push(
      <span key={`c${ci}`} className="text-[1.15rem]">
        {chain.segments.map(([t, kind, id], i) => {
          if (kind === "tr") return <span key={i} className="text-zinjafr">{t}</span>;
          if (kind === "name" && id)
            return (
              <Link key={i} href={`/narrator/?id=${id}`} className="text-nila underline decoration-1 underline-offset-[6px] hover:decoration-2">
                {t}
              </Link>
            );
          return <span key={i}>{t}</span>;
        })}
      </span>,
    );
    pos = chain.end;
  });
  if (pos < text.length) parts.push(<Matn key="end" text={text.slice(pos)} />);
  return <p className="naskh text-midad">{parts}</p>;
}

function Matn({ text }: { text: string }) {
  return <span className="text-[1.6rem]">{text}</span>;
}
