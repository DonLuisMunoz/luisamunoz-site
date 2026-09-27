/* Guards the token layer. Runs under `node --test`, no dependencies.

   1. Every text/background pair clears WCAG AA in every time preset.
   2. Every var(--x) used anywhere in site/ is defined in tokens/.
   3. No raw hex outside site/css/tokens/.
   4. Both font stacks keep a system fallback, so code stays monospace
      when Recursive can't load. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../site/", import.meta.url));
const TOKENS = join(SITE, "css", "tokens");

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const read = (p) => readFileSync(p, "utf8");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Every rule block in the token files as [selectors[], {--name: value}]
// @import lines are dropped: the font URL contains commas and would be read
// as part of the next block's selector list.
const tokenCss = readdirSync(TOKENS)
  .map((f) => stripComments(read(join(TOKENS, f))).replace(/@import[^;]+;/g, ""))
  .join("\n");
const blocks = [...tokenCss.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, body]) => [
  sel.split(",").map((s) => s.trim()),
  Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])),
]);

function preset(name) {
  const vars = {};
  for (const [sels, decls] of blocks) {
    if (sels.includes(":root") || sels.includes(`[data-time="${name}"]`)) Object.assign(vars, decls);
  }
  const get = (k) => {
    const v = vars[k];
    assert.ok(v, `${k} is not defined in the ${name} preset`);
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    return m ? get(m[1]) : v;
  };
  return get;
}

function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `expected a 6-digit hex, got ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT_PAIRS = [ // [foreground, background] — AA body text, 4.5:1
  ["--text", "--ground"], ["--text", "--surface"],
  ["--text-soft", "--ground"], ["--text-soft", "--surface"],
  ["--link", "--ground"], ["--link", "--surface"],
  ["--on-fill", "--fill"],
  ["--code-text", "--code-bg"], ["--syn-keyword", "--code-bg"], ["--syn-string", "--code-bg"],
];
const UI_PAIRS = [ // borders and focus rings — WCAG 1.4.11, 3:1
  ["--rule", "--ground"], ["--rule", "--surface"],
];

for (const name of ["day", "dusk", "night"]) {
  const get = preset(name);
  test(`${name}: text pairs clear 4.5:1`, () => {
    for (const [fg, bg] of TEXT_PAIRS) {
      const r = contrast(get(fg), get(bg));
      assert.ok(r >= 4.5, `${fg} on ${bg} is ${r.toFixed(2)}:1 in ${name}`);
    }
  });
  test(`${name}: borders clear 3:1`, () => {
    for (const [fg, bg] of UI_PAIRS) {
      const r = contrast(get(fg), get(bg));
      assert.ok(r >= 3, `${fg} on ${bg} is ${r.toFixed(2)}:1 in ${name}`);
    }
  });
}

test("every var() used in site/ is defined in tokens/", () => {
  const defined = new Set(blocks.flatMap(([, d]) => Object.keys(d)));
  const files = walk(SITE).filter((f) => /\.(css|html|js)$/.test(f));
  // Per-element properties count too: a desk link's inline style="--x: 40%"
  // defines the --x its CSS reads. Only a name declared nowhere is a typo.
  for (const file of files) {
    for (const [, name] of read(file).matchAll(/(--[\w-]+)\s*:/g)) defined.add(name);
  }
  const missing = [];
  for (const file of files) {
    for (const [, name] of read(file).matchAll(/var\((--[\w-]+)/g)) {
      if (!defined.has(name)) missing.push(`${relative(SITE, file)}: ${name}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("no raw hex outside site/css/tokens/", () => {
  const offenders = [];
  for (const file of walk(SITE).filter((f) => /\.(css|html)$/.test(f) && !f.startsWith(TOKENS))) {
    const src = file.endsWith(".css") ? stripComments(read(file)) : read(file);
    // CSS colour contexts only: after a colon or inside style="…". Skips href="#main".
    for (const m of src.matchAll(/(?::|style="[^"]*)\s*[^;"]*?(?<!&)(#[0-9a-f]{3,8})\b/gi)) {
      offenders.push(`${relative(SITE, file)}: ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("both font stacks keep a system fallback", () => {
  const get = preset("day");
  assert.match(get("--font-sans"), /system-ui/);
  assert.match(get("--font-mono"), /ui-monospace/);
});

// Recursive's code voice is an axis, not a family, and the `font:` shorthand
// resets font-variation-settings. So exactly one rule picks the code voice —
// `code, kbd, pre` in base.css — and nothing else may, or a later `font:`
// in some component silently turns code proportional.
test("only base.css picks the mono voice", () => {
  const offenders = [];
  const BASE = join(SITE, "css", "base.css");
  for (const file of walk(SITE).filter((f) => /\.(css|html)$/.test(f) && !f.startsWith(TOKENS) && f !== BASE)) {
    for (const [, name] of stripComments(read(file)).matchAll(/var\((--(?:font-mono|axes-mono|type-code))\)/g)) {
      offenders.push(`${relative(SITE, file)}: ${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});

// The 3D desk reads its colours from CSS tokens (js/scenes/*.js, via
// getComputedStyle), so the palette still lives in tokens/ alone. Every
// token a scene names must exist in every preset, and no hex may appear.
const SCENES = join(SITE, "js", "scenes");

test("every token a scene reads is defined in every preset", () => {
  const missing = [];
  for (const file of readdirSync(SCENES).map((f) => join(SCENES, f))) {
    const names = new Set([...read(file).matchAll(/"(--[\w-]+)"/g)].map((m) => m[1]));
    for (const time of ["day", "dusk", "night"]) {
      const vars = {};
      for (const [sels, decls] of blocks) {
        if (sels.includes(":root") || sels.includes(`[data-time="${time}"]`)) Object.assign(vars, decls);
      }
      for (const n of names) if (!vars[n]) missing.push(`${relative(SITE, file)}: ${n} (${time})`);
    }
  }
  assert.deepEqual(missing, []);
});

test("no raw hex in scene code", () => {
  const offenders = [];
  for (const file of readdirSync(SCENES).map((f) => join(SCENES, f))) {
    for (const m of read(file).matchAll(/["'`]#[0-9a-f]{3,8}["'`]|0x[0-9a-f]{6}\b/gi)) {
      offenders.push(`${relative(SITE, file)}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
});
