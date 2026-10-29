// Runs after `next build` (see package.json). Next.js names the prefetch files of a
// static export by turning each segment path's "/" into "." (convertSegmentPathToStaticExportFilename),
// but on Windows the paths it collects use "\", so the files land in nested folders,
// e.g. out/search/__next.!KHNpdGUp/search/__PAGE__.txt, while the browser asks for
// out/search/__next.!KHNpdGUp.search.__PAGE__.txt and logs a 404 for each link it prefetches.
// This moves them to the names the browser asks for. Builds on Linux (Render) are untouched.
import { readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

if (process.platform !== "win32") process.exit(0);

const out = path.resolve(process.argv[2] ?? "out");
const SKIP = new Set(["_next", "data"]); // assets and our JSON: no route segments inside
let moved = 0;

function filesBelow(dir, rel = []) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesBelow(path.join(dir, e.name), [...rel, e.name]) : [[path.join(dir, e.name), [...rel, e.name]]],
  );
}

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.name.startsWith("__next.")) {
      for (const [file, rel] of filesBelow(full)) {
        renameSync(file, path.join(dir, [e.name, ...rel].join(".")));
        moved++;
      }
      rmSync(full, { recursive: true });
    } else {
      walk(full);
    }
  }
}

walk(out);
console.log(`fix-windows-export: ${moved} prefetch files renamed`);
