/* Home page sections are separated by colour (components/section.css). Where two
   neighbours share a ground, a 1px rule has to separate them, or they merge into
   one band. Alternating alone can't guarantee that: #writing hides itself when
   there are no posts, so its neighbours change. The hero sits on --ground. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../site/css/components/section.css", import.meta.url), "utf8");

test("neighbouring home sections on the same ground are separated by a rule", () => {
  const bands = ["ground"]; // the hero
  for (const [, cls] of html.matchAll(/<section\b[^>]*class="([^"]*)"/g)) {
    const m = /section--(ground|surface)/.exec(cls);
    if (m) bands.push(m[1]);
  }
  const unseparated = bands.flatMap((b, i) => {
    if (!i || b !== bands[i - 1]) return [];
    const rule = new RegExp(`\\.section--${b}\\s*\\+\\s*\\.section--${b}[^{]*\\{[^}]*border-top`);
    return rule.test(css) ? [] : [`${i - 1}→${i}: two ${b} sections, no rule between them`];
  });
  assert.deepEqual(unseparated, [], `bands in order: ${bands.join(", ")}`);
});
