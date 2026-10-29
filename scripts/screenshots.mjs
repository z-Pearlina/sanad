// Screenshots of the exported site for review: desktop (1440), phone (390) and dark mode,
// plus one viewport shot in the middle of the opening motion ("mid-…").
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir] [path ...]
// Paths may omit the leading slash ("" is the home page), which Git Bash would rewrite.
// Serve `out/` first (any static server). Exits with 1 if a phone page scrolls sideways
// or a page logs a console error.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [base = "http://localhost:4321", outDir = "screenshots", ...paths] = process.argv.slice(2);
const pages = (paths.length ? paths : ["", "hadith/?n=1"]).map((p) => "/" + p.replace(/^\//, ""));
const MID_MS = Number(process.env.MID_MS ?? 2600); // into the motion: generations, chain drawing, count-ups
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 2500);
const views = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, colorScheme: "light" },
  { name: "phone", viewport: { width: 390, height: 844 }, colorScheme: "light", isMobile: true, hasTouch: true },
  { name: "dark", viewport: { width: 1440, height: 900 }, colorScheme: "dark" },
];
const slug = (p) => p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
let failed = false;
for (const v of views) {
  const context = await browser.newContext({
    viewport: v.viewport,
    colorScheme: v.colorScheme,
    isMobile: v.isMobile,
    hasTouch: v.hasTouch,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    failed = true;
    console.error(`[${v.name}] page error:`, e.message);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      failed = true;
      console.error(`[${v.name}] console error:`, m.text());
    }
  });
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    if (v.name === "desktop") {
      await page.waitForTimeout(MID_MS);
      await page.screenshot({ path: path.join(outDir, `mid-${slug(p)}.png`) });
      console.log(path.join(outDir, `mid-${slug(p)}.png`));
    }
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(SETTLE_MS);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) {
      failed = true;
      console.error(`[${v.name}] ${p}: horizontal overflow of ${overflow}px`);
    }
    const file = path.join(outDir, `${v.name}-${slug(p)}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await context.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
