/* ============================================================
   Renders the desk's fallback still from the real 3D scene.

   Run:  node scripts/render-stills.mjs
   Needs the same --no-save playwright as tests/a11y.check.mjs.

   Writes site/assets/scenes/desk.jpg, which visitors without WebGL see,
   and prints the link positions the live camera projects, to paste into
   the inline --x/--y in site/index.html so the links sit on the still's
   objects too. Rerun it whenever js/scenes/desk.js or the camera changes.
   ============================================================ */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { serveSite } from "../tests/serve.mjs";

const OUT = fileURLToPath(new URL("../site/assets/scenes/desk.jpg", import.meta.url));

const { base, close } = await serveSite();
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],   // software WebGL in headless Chrome
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1.5, reducedMotion: "reduce",
});
// Noon in Tampa, so the still is always the day preset.
await page.clock.setFixedTime(new Date("2026-07-15T16:00:00Z"));
await page.goto(`${base}/index.html`);
await page.waitForSelector("[data-desk].is-live", { timeout: 30000 });
await page.waitForTimeout(500);
await page.addStyleTag({ content: ".desk__spot { visibility: hidden; }" });
await page.locator("[data-desk]").screenshot({ path: OUT, type: "jpeg", quality: 82 });

const spots = await page.$$eval("[data-spot]", (els) => els.map((a) =>
  `${a.dataset.spot}: style="--x: ${parseFloat(a.style.getPropertyValue("--x")).toFixed(1)}%; ` +
  `--y: ${parseFloat(a.style.getPropertyValue("--y")).toFixed(1)}%"`));
console.log(`wrote ${OUT}\n${spots.join("\n")}`);

await browser.close();
close();
