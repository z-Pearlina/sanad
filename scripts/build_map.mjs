// Project the base map once, at data-build time, so the site ships a ready
// SVG path instead of d3 + topojson + 0.5 MB of world data.
// Usage: node scripts/build_map.mjs   (after scripts/build_data.py wrote cities.json)
// Writes public/data/map.json: { w, h, land, frame, cities: { key: [x, y] } }
import { readFileSync, writeFileSync } from "node:fs";
import { geoConicEqualArea, geoGraticule, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const WIDTH = 1000;
// From Egypt to Transoxiana, Yemen to the Jazira: lon 25°-72° E, lat 10°-45° N
const FRAME = geoGraticule().extent([[25, 10], [72, 45]]).outline();

const world = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/land-50m.json", import.meta.url)));
const land = feature(world, world.objects.land);
const cities = JSON.parse(readFileSync(new URL("../public/data/cities.json", import.meta.url)));

const projection = geoConicEqualArea().parallels([15, 40]).rotate([-48.5, 0]).fitWidth(WIDTH, FRAME);
const [[, y0], [, y1]] = geoPath(projection).bounds(FRAME);
const height = Math.ceil(y1 - y0);
projection.translate([projection.translate()[0], projection.translate()[1] - y0]).clipExtent([[0, 0], [WIDTH, height]]);

const path = geoPath(projection).digits(1);
const round = (v) => Math.round(v * 10) / 10;
const out = {
  w: WIDTH,
  h: height,
  land: path(land),
  frame: path(FRAME),
  cities: Object.fromEntries(
    Object.entries(cities).map(([key, c]) => [key, projection([c.lon, c.lat]).map(round)]),
  ),
};
writeFileSync(new URL("../public/data/map.json", import.meta.url), JSON.stringify(out));
console.log(`map ${WIDTH}x${height}, land path ${(out.land.length / 1024).toFixed(0)} KB, ${Object.keys(out.cities).length} cities`);
