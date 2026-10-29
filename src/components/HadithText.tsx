import Link from "next/link";
import type { Isnad } from "@/lib/types";

type Props = {
  text: string;
  isnads: Isnad[];
  /** Narrator pointed at here, in the chain column or on the timeline. */
  focus?: string | null;
  onPoint?: (id: string | null) => void;
};

/**
 * The full Arabic text as written: inside each chain, transmission words are
 * in vermilion and identified narrators link to their page; the rest (the
 * matn) is set larger.
 */
export default function HadithText({ text, isnads, focus = null, onPoint }: Props) {
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
              <Link
                key={i}
                href={`/narrator/?id=${id}`}
                onMouseEnter={() => onPoint?.(id)}
                onMouseLeave={() => onPoint?.(null)}
                onFocus={() => onPoint?.(id)}
                onBlur={() => onPoint?.(null)}
                className={`rounded-sm text-nila underline decoration-1 underline-offset-[6px] transition-colors hover:decoration-2 ${
                  id === focus ? "bg-raml decoration-2" : ""
                }`}
              >
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
