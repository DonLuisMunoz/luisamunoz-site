/* ============================================================
   Accessibility regression check.

   Run:  node tests/a11y.check.mjs
   CI:   .github/workflows/ci.yml runs this on every push.

   Serves ./site on a throwaway port, drives real Chromium, and runs
   axe-core against every page state. Exits non-zero on any violation,
   so a contrast or landmark regression fails the build instead of
   shipping.

   Needs playwright + axe-core, which are NOT repo dependencies -- the
   shipped site still has none. CI installs them into a temp dir; to run
   this locally do the same:
       npm install --no-save playwright axe-core && npx playwright install chromium

   Automated tooling catches roughly a third of real accessibility
   problems. Zero violations here means no REGRESSION, not "accessible".
   ============================================================ */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serveSite } from "./serve.mjs";

const { base, close } = await serveSite();

const { chromium } = await import("playwright");
const axeSource = await readFile(
  fileURLToPath(await import.meta.resolve("axe-core/axe.min.js")), "utf8");

// [label, path, time presets to audit]. null = no data-time attribute, which
// is what a visitor gets with JS off. Dusk and night are audited on the two
// pages with the most colour surface: home and a rendered post (code blocks,
// blockquotes, links). Each page loads once; the presets are re-applied in place.
const DAY_ONLY = [null];
const ALL_TIMES = [null, "dusk", "night"];
const PAGES = [
  ["home", "/index.html", ALL_TIMES],
  ["home without WebGL", "/index.html", DAY_ONLY, { noWebGL: true }],
  ["blog list", "/blog/index.html", DAY_ONLY],
  ["blog post", "/blog/index.html?p=a-join-that-returned-zero-rows", ALL_TIMES],
  ["admin", "/admin.html", DAY_ONLY],
  // The gallery renders every component in every state, including states no
  // real page currently shows. Auditing it is broader coverage than the
  // site's own pages can give.
  ["design system", "/design/index.html", DAY_ONLY],
];

// CHROMIUM_PATH lets a pre-provisioned environment point at a browser it
// already has, instead of downloading one. CI leaves it unset and uses the
// build `npx playwright install chromium` puts in place.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;

function report(label, violations) {
  if (violations.length === 0) {
    console.log(`  PASS  ${label}`);
    return;
  }
  failures += violations.length;
  console.log(`  FAIL  ${label}`);
  for (const v of violations) {
    console.log(`          [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) {
      console.log(`            ${n.html.slice(0, 100).replace(/\s+/g, " ")}`);
    }
    console.log(`            -> ${v.helpUrl}`);
  }
}

for (const [label, path, times, opts = {}] of PAGES) {
  const page = await browser.newPage();
  // The API is unreachable from CI, which is fine -- the site falls back to
  // data/projects.json, and that is the state we want audited anyway.
  // Simulate a browser with no WebGL: stage.js must leave the still and the
  // links in place, and the still must actually exist.
  if (opts.noWebGL) await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: axeSource });

  for (const time of times) {
    await page.evaluate((t) => {
      if (t) document.documentElement.dataset.time = t;
      else delete document.documentElement.dataset.time;
    }, time);
    const { violations } = await page.evaluate(async () =>
      await axe.run(document, { resultTypes: ["violations"] }));
    report(time ? `${label} at ${time}` : label, violations);
  }

  if (opts.noWebGL) {
    const still = await page.evaluate(() => {
      const img = document.querySelector(".desk__still");
      return img && img.complete && img.naturalWidth > 0 && !document.querySelector("[data-desk].is-live");
    });
    if (!still) report(`${label}: fallback`, [{ impact: "serious", id: "desk-fallback",
      help: "no WebGL, but the desk still is missing or the live scene claims to be running", nodes: [],
      helpUrl: "https://developer.mozilla.org/docs/Web/API/WebGL_API" }]);
  }

  // WCAG 1.4.10 reflow: no sideways scrolling on a phone. axe can't see
  // this, so measure it. 390px is the spec's phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) {
    report(`${label} at 390px`, [{ impact: "serious", id: "reflow",
      help: `page is ${overflow}px wider than a 390px viewport`, nodes: [],
      helpUrl: "https://www.w3.org/WAI/WCAG22/Understanding/reflow.html" }]);
  }
  await page.close();
}

await browser.close();
close();

console.log(failures ? `\n${failures} accessibility violation(s).` : "\nNo accessibility violations.");
process.exit(failures ? 1 : 0);
