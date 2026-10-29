// Projects the base map once, so the page draws ready-made SVG paths.
//
// usage:
//   node scripts/build_geometry.mjs node_modules/world-atlas/land-50m.json \
//     data-src/ne/ne_50m_rivers_lake_centerlines.geojson data-src/ne/ne_50m_lakes.geojson \
//     public/data/map.json public/data/geometry.json
//
// Sources: land from world-atlas (Natural Earth, ISC); rivers and lakes from
// Natural Earth 1:50m (public domain). Needs: npm i -D d3-geo topojson-client world-atlas
import { readFileSync, writeFileSync } from "node:fs";
import * as topojson from "topojson-client";
import { geoConicConformal, geoPath, geoGraticule, geoContains, geoBounds } from "d3-geo";

const [landFile, riversFile, lakesFile, dataFile, outFile] = process.argv.slice(2);
const W = 1000;
const LON = [26, 74];
const LAT = [10, 44.5];

const frame = [];
for (let lon = LON[0]; lon <= LON[1]; lon += 0.5) frame.push([lon, LAT[0]], [lon, LAT[1]]);
for (let lat = LAT[0]; lat <= LAT[1]; lat += 0.5) frame.push([LON[0], lat], [LON[1], lat]);
const framePoints = { type: "MultiPoint", coordinates: frame };

const projection = geoConicConformal().parallels([20, 38]).rotate([-50, 0]).center([0, 27]);
projection.fitWidth(W, framePoints);
const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(framePoints);
// shift so the frame starts at 0,0
const t = projection.translate();
projection.translate([t[0] - x0, t[1] - y0]);
const H = Math.round(y1 - y0);
// Two levels of detail: coarse land far beyond the frame (so panning and side
// panels never reveal an edge), detailed land and coastlines around the frame.
const OUTER = [[-1100, -800], [W + 1100, H + 800]];
const INNER = [[-160, -130], [W + 160, H + 130]];
const landTopo = JSON.parse(readFileSync(landFile, "utf8"));
const land = topojson.feature(landTopo, landTopo.objects.land);
const coarseTopo = JSON.parse(readFileSync(landFile.replace("land-50m", "land-110m"), "utf8"));
const coarse = topojson.feature(coarseTopo, coarseTopo.objects.land);

projection.clipExtent(OUTER);
let path = geoPath(projection).digits(1);
const landOuterD = path(coarse);
projection.clipExtent(INNER);
path = geoPath(projection).digits(1);
const landD = path(land);
const coastD = path(topojson.mesh(landTopo, landTopo.objects.land));
projection.clipExtent(OUTER);
path = geoPath(projection).digits(1);

const inFrame = (f) => {
  const [[a, b], [c, d]] = geoBounds(f);
  return c >= LON[0] - 25 && a <= LON[1] + 25 && d >= LAT[0] - 20 && b <= LAT[1] + 20;
};

// historic rivers only; modern canals and far rivers are left out
const KEEP_RIVERS = new Set(["Nile", "Rosetta Branch", "Damietta Branch", "Al Furat", "Firat", "Euphrates",
  "Tigris", "Dicle", "Shatt al Arab", "Amu  Darya", "Panj", "Syr Darya", "Jordan", "Indus", "Helmand"]);
const rivers = JSON.parse(readFileSync(riversFile, "utf8")).features
  .filter((f) => KEEP_RIVERS.has(f.properties.name) && inFrame(f));
const riverNames = {};
for (const f of rivers) {
  const name = f.properties.name || f.properties.name_en || "?";
  riverNames[name] = (riverNames[name] || 0) + 1;
}
const riversD = path({ type: "FeatureCollection", features: rivers });

// natural lakes only; modern reservoirs (Nasser, Tharthar...) would be anachronistic
const KEEP_LAKES = new Set(["Dead Sea", "Sea of Galilee", "Lake Urmia", "Lake Van", "Lake Sevan", "Lake Tuz"]);
const lakes = JSON.parse(readFileSync(lakesFile, "utf8")).features
  .filter((f) => KEEP_LAKES.has(f.properties.name) && inFrame(f));
const lakesD = path({ type: "FeatureCollection", features: lakes });

const gratD = path(geoGraticule().step([5, 5]).extent([[LON[0] - 30, LAT[0] - 25], [LON[1] + 30, LAT[1] + 20]])());

const data = JSON.parse(readFileSync(dataFile, "utf8"));
const cities = {};
for (const c of data.cities) {
  const [x, y] = projection([c.lon, c.lat]);
  cities[c.id] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

// classical names of seas and rivers, placed by hand (lon, lat, rotation)
const LABELS = [
  { text: "بحر الروم", lon: 30.6, lat: 33.0, kind: "sea" },
  { text: "بحر القلزم", lon: 35.9, lat: 25.0, kind: "sea", rotate: 56 },
  { text: "بحر فارس", lon: 51.2, lat: 27.2, kind: "sea", rotate: -28 },
  { text: "بحر الخزر", lon: 50.9, lat: 40.6, kind: "sea", rotate: 70 },
  { text: "بحر الهند", lon: 62.0, lat: 18.0, kind: "sea" },
  { text: "النيل", lon: 31.4, lat: 26.2, kind: "river", rotate: 80 },
  { text: "الفرات", lon: 40.6, lat: 34.9, kind: "river", rotate: -30 },
  { text: "دجلة", lon: 44.2, lat: 34.6, kind: "river", rotate: -55 },
  { text: "جيحون", lon: 62.6, lat: 39.4, kind: "river", rotate: -38 },
];
const labels = LABELS.map((l) => {
  const [x, y] = projection([l.lon, l.lat]);
  return { ...l, x: Math.round(x), y: Math.round(y) };
});

// checks
const caspianIsWater = !geoContains(land, [50.5, 41.5]);
const out = { W, H, landOuter: landOuterD, land: landD, coast: coastD, rivers: riversD, lakes: lakesD, grat: gratD, cities, labels };
writeFileSync(outFile, JSON.stringify(out));
console.log(JSON.stringify({
  W, H,
  kb: { outer: Math.round(landOuterD.length / 1024), coast: Math.round(coastD.length / 1024), land: Math.round(landD.length / 1024), rivers: Math.round(riversD.length / 1024), lakes: Math.round(lakesD.length / 1024), grat: Math.round(gratD.length / 1024) },
  caspianIsWater, rivers: riverNames, lakes: lakes.map((f) => f.properties.name).slice(0, 20),
  sample: { madina: cities.madina, bukhara: cities.bukhara, misr: cities.misr },
}, null, 1));
