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
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "site");
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".md": "text/markdown", ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const { chromium } = await import("playwright");
const axeSource = await readFile(
  fileURLToPath(await import.meta.resolve("axe-core/axe.min.js")), "utf8");

const PAGES = [
  ["home", "/index.html"],
  ["blog list", "/blog/index.html"],
  ["blog post", "/blog/index.html?p=a-join-that-returned-zero-rows"],
  ["admin", "/admin.html"],
  // The gallery renders every component in every state, including states no
  // real page currently shows. Auditing it is broader coverage than the
  // site's own pages can give.
  ["design system", "/design/index.html"],
];

// CHROMIUM_PATH lets a pre-provisioned environment point at a browser it
// already has, instead of downloading one. CI leaves it unset and uses the
// build `npx playwright install chromium` puts in place.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;

for (const [label, path] of PAGES) {
  const page = await browser.newPage();
  // The API is unreachable from CI, which is fine -- the site falls back to
  // data/projects.json, and that is the state we want audited anyway.
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.addScriptTag({ content: axeSource });
  const { violations } = await page.evaluate(async () =>
    await axe.run(document, { resultTypes: ["violations"] }));

  if (violations.length === 0) {
    console.log(`  PASS  ${label}`);
  } else {
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
  await page.close();
}

await browser.close();
server.close();

console.log(failures ? `\n${failures} accessibility violation(s).` : "\nNo accessibility violations.");
process.exit(failures ? 1 : 0);
