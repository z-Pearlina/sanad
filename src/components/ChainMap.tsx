import MapBase, { MapLabel, cropView, placeLabels } from "./MapBase";
import type { City, Isnad, MapData } from "@/lib/types";

const PAD = 70; // map units around the chain's cities
const MIN_W = 360;

/**
 * The chain's homes joined in order, from the Companion to al-Bukhari. The line
 * draws itself once when the page opens (see .draw-line in globals.css).
 */
export default function ChainMap({ isnad, map, cities }: { isnad: Isnad; map: MapData; cities: Record<string, City> }) {
  const order = [...isnad.links].reverse(); // Companion first
  const stops: string[] = [];
  for (const l of order) {
    if (l.city && map.cities[l.city] && stops[stops.length - 1] !== l.city) stops.push(l.city);
  }
  const unplaced = order.filter((l) => !l.city).length;

  const pts = stops.map((k) => map.cities[k]);
  const view = cropView(map, pts, PAD, MIN_W);
  const unit = (view?.[2] ?? map.w) / 100; // 1% of the visible width
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

  return (
    <figure>
      <div className="overflow-hidden rounded-sm border border-khatt">
        <MapBase map={map} view={view} label={`خريطة السند: ${stops.map((k) => cities[k]?.ar).join(" ثم ")}`}>
          {pts.length > 1 && (
            <path
              d={line}
              pathLength={1}
              className="draw-line"
              fill="none"
              stroke="var(--nila)"
              strokeWidth={unit * 0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {pts.map(([x, y], i) => (
            <circle key={stops[i]} cx={x} cy={y} r={unit * 1.3} fill="var(--raqq)" stroke="var(--nila)" strokeWidth={unit * 0.6} />
          ))}
          {placeLabels(
            pts.map(([x, y], i) => ({ k: stops[i], x, y: y - unit * 2.6 })),
            unit * 9,
          ).map(({ k, x, y }) => (
            <MapLabel key={k} x={x} y={y} size={unit * 4.2}>
              {cities[k]?.ar}
            </MapLabel>
          ))}
        </MapBase>
      </div>
      <figcaption className="mt-2 space-y-1 text-sm">
        {stops.length > 0 && <p className="naskh text-base">{stops.map((k) => cities[k]?.ar).join(" ← ")}</p>}
        <p className="text-xs text-midad-soft">
          تعرض الخريطة موطن كل راوٍ حسب نسبته في تقريب التهذيب، لا المكان الذي سمع فيه الحديث.
          {unplaced > 0 && ` ${unplaced} من رجال السند بلا بلد معروف فلا يظهرون عليها.`}
        </p>
      </figcaption>
    </figure>
  );
}
