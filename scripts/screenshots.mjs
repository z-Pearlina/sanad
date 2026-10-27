// Screenshots of the exported site for review: desktop, phone (390px) and dark mode.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir] [path ...]
// Paths may omit the leading slash ("" is the home page), which Git Bash would rewrite.
// Serve `out/` first (any static server). Fails if a phone page scrolls sideways.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [base = "http://localhost:4321", outDir = "screenshots", ...paths] = process.argv.slice(2);
const pages = (paths.length ? paths : ["", "hadith/?n=1"]).map((p) => "/" + p.replace(/^\//, ""));
const views = [
  { name: "desktop", viewport: { width: 1280, height: 900 }, colorScheme: "light" },
  { name: "phone", viewport: { width: 390, height: 844 }, colorScheme: "light", isMobile: true },
  { name: "dark", viewport: { width: 1280, height: 900 }, colorScheme: "dark" },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let failed = false;
for (const v of views) {
  const context = await browser.newContext({ viewport: v.viewport, colorScheme: v.colorScheme, isMobile: v.isMobile, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`[${v.name}] page error:`, e.message));
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) {
      failed = true;
      console.error(`[${v.name}] ${p}: horizontal overflow of ${overflow}px`);
    }
    const file = path.join(outDir, `${v.name}-${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await context.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
