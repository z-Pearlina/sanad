import { GROUP_COLOR, deathEra } from "@/lib/labels";
import type { Isnad } from "@/lib/types";

const MAX = 260; // years AH shown; al-Bukhari died in 256
const TICKS = [0, 50, 100, 150, 200, 250];
const pct = (year: number) => `${(Math.min(year, MAX) / MAX) * 100}%`;

type Props = {
  isnad: Isnad;
  /** Narrator the map is drawing (0 = the Companion), as in the chain column. */
  step?: number;
  focus?: string | null;
  onPoint?: (id: string | null) => void;
};

/**
 * Death years along the chain, earliest first. Unknown deaths are drawn as a
 * dashed span from Ibn Hajar's rule for the narrator's tabaqa.
 */
export default function Timeline({ isnad, step = -1, focus = null, onPoint }: Props) {
  // keep each narrator's place in the chain (Companion first), so it lights up with the map
  const rows = [...isnad.links]
    .reverse()
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.id);
  return (
    <figure>
      <div className="grid grid-cols-[minmax(6rem,9rem)_1fr] gap-x-3 text-xs text-midad-soft">
        <span />
        <div className="relative h-5" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t} className="absolute translate-x-1/2 tabular-nums" style={{ right: pct(t) }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <ul className="space-y-1.5">
        {rows.map(({ l, i }) => {
          const era = l.death ? null : deathEra(l.tabaqa);
          const color = GROUP_COLOR[l.group ?? "see"];
          const current = i === step;
          const pointed = l.id === focus;
          return (
            <li
              key={i}
              onMouseEnter={() => onPoint?.(l.id)}
              onMouseLeave={() => onPoint?.(null)}
              className={`grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-x-3 rounded-sm transition-colors duration-300 ${
                current ? "bg-raml" : pointed ? "bg-raml/60" : ""
              }`}
            >
              <span className={`naskh truncate px-1 text-base leading-normal ${current || pointed ? "font-bold text-nila" : ""}`}>
                {l.raw}
                {/* a phone has no hover to show the year */}
                <span className="hidden font-sans text-xs font-normal text-midad-soft phone:block">
                  {l.death ? `ت ${l.death}هـ` : era ? `تقريبي: ${era.label}` : ""}
                </span>
              </span>
              <div className="relative h-6">
                <span className="absolute inset-x-0 top-1/2 h-px bg-khatt" />
                {TICKS.map((t) => (
                  <span key={t} className="absolute top-1 bottom-1 w-px bg-khatt/60" style={{ right: pct(t) }} />
                ))}
                {l.death ? (
                  <span
                    className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full transition-transform duration-300 ${
                      current || pointed ? "scale-150 ring-2 ring-raqq" : ""
                    }`}
                    style={{ right: pct(l.death), background: color }}
                    title={`ت ${l.death}هـ`}
                  />
                ) : era ? (
                  <span
                    className={`absolute top-1/2 h-0 -translate-y-1/2 border-dashed ${current || pointed ? "border-t-4" : "border-t-2"}`}
                    style={{ right: pct(era.from), width: `${((Math.min(era.to, MAX) - era.from) / MAX) * 100}%`, borderColor: color }}
                    title={`تقريبي: ${era.label}`}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-2 text-xs text-midad-soft">
        سنوات الوفاة بالهجري. الخط المتقطع زمن تقريبي من قاعدة ابن حجر في طبقة الراوي، لمن لا تُعرف وفاته.
      </figcaption>
    </figure>
  );
}
