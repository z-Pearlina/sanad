import Link from "next/link";
import Dara from "./Dara";
import Salla from "./Salla";
import { GROUP_LABEL, TRANSMISSION, deathEra, deathText, tabaqaName } from "@/lib/labels";
import type { City, Isnad, Link as ChainLink } from "@/lib/types";

/** The chain drawn top-down: the Prophet ﷺ, the Companion, ... al-Bukhari. */
export default function Chain({ isnad, cities }: { isnad: Isnad; cities: Record<string, City> }) {
  const links = [...isnad.links].reverse();
  return (
    <ol className="relative">
      {isnad.toProphet && (
        <li className="flex items-center gap-3 pb-1">
          <span className="flex w-[22px] justify-center" aria-hidden="true">
            <span className="block h-2.5 w-2.5 rotate-45 bg-mughra" />
          </span>
          <span className="naskh text-xl font-bold">النبي <Salla /></span>
        </li>
      )}
      {links.map((link, i) => (
        <li key={i}>
          {(i > 0 || isnad.toProphet) && <Connector label={i > 0 ? links[i - 1].tr : null} />}
          <Narrator link={link} cities={cities} />
        </li>
      ))}
    </ol>
  );
}

function Connector({ label }: { label: string | null }) {
  return (
    <div className="flex items-stretch gap-3" aria-hidden={!label}>
      <span className="flex w-[22px] justify-center">
        <span className="block min-h-7 w-px bg-khatt" />
      </span>
      {label && <span className="naskh self-center text-base text-zinjafr">{TRANSMISSION[label] ?? label}</span>}
    </div>
  );
}

function Narrator({ link, cities }: { link: ChainLink; cities: Record<string, City> }) {
  if (!link.id) {
    return (
      <div className="flex items-start gap-3">
        <span className="pt-2.5"><Dara group={null} /></span>
        <div>
          <p className="naskh text-xl">{link.raw}</p>
          <p className="text-sm text-midad-soft">لم تُعرف ترجمته، فالاسم كما ورد في النص</p>
        </div>
      </div>
    );
  }
  const era = link.death ? null : deathEra(link.tabaqa);
  const city = link.city ? cities[link.city]?.ar : null;
  const meta = [
    link.tabaqa ? tabaqaName(link.tabaqa) : null,
    link.death ? deathText(link.death) : era ? `تقريبي: ${era.label}` : null,
    city,
  ].filter(Boolean);
  return (
    <div className="flex items-start gap-3">
      <span className="pt-2.5"><Dara group={link.group ?? "see"} /></span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/narrator/?id=${link.id}`} className="naskh text-xl font-bold text-nila hover:underline">
            {link.raw}
          </Link>
          {link.conf !== null && link.conf < 1 && (
            <span className="rounded-sm border border-khatt px-1.5 text-xs text-midad-soft" title={`ثقة التعرّف ${link.conf}`}>
              تعرّف آلي
            </span>
          )}
        </p>
        <p className="line-clamp-2 text-sm text-midad-soft">{link.name}</p>
        {/* some extracted phrases run on for lines (Abu Hurayra's name dispute); the full entry is on the narrator page */}
        <p className="mt-0.5 line-clamp-2 text-[0.95rem]" title={link.phrase ?? undefined}>
          {link.phrase ? (
            <>
              <span className="naskh">«{link.phrase}»</span>
              <span className="text-midad-soft"> · {GROUP_LABEL[link.group ?? "see"]}</span>
            </>
          ) : (
            <Link href={`/narrator/?id=${link.id}`} className="text-nila underline underline-offset-4">
              {GROUP_LABEL.see}
            </Link>
          )}
        </p>
        {meta.length > 0 && <p className="text-sm text-midad-soft">{meta.join(" · ")}</p>}
      </div>
    </div>
  );
}
