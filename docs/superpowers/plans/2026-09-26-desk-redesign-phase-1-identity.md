# Desk redesign, phase 1: Identity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the neobrutalist cream-and-plum identity with the room palette, three time-of-day presets and Recursive, and strip the template tells, with no 3D yet.

**Architecture:** Colour tokens become semantic (`--ground`, `--text`, `--link`…) with three presets selected by a `data-time` attribute (day is the default until phase 2 sets it). Every stylesheet is rewritten against the new tokens; class names that named old colours are renamed. The terminal, streak strip, badge, typing effect and scroll reveal are deleted rather than restyled, because phase 2 replaces the hero anyway.

**Tech Stack:** Plain HTML/CSS/JS, no build step. `node --test` for unit tests, `tests/a11y.check.mjs` (Playwright + axe-core, not repo dependencies) for accessibility.

**Spec:** `docs/superpowers/specs/2026-09-26-desk-redesign-design.md`

This is the first of eight phase plans. Phases 2–8 each get their own plan, written when the previous phase merges, so each plan argues from code that exists.

## Global Constraints

- No build step, no framework, no runtime dependency in `site/` (three.js arrives in phase 2, not here).
- Never write a raw hex value outside `site/css/tokens/`.
- `styles.css` import order is load-bearing: tokens → base → components → pages → responsive → `components/a11y.css`.
- `class` is for styling, `data-*` is for JavaScript.
- `computeStack()` stays a `function` declaration (hoisting; `loadProjects()` calls it first).
- Escape before interpolating into `innerHTML` (`esc()`).
- Sentence case everywhere. No `//` kickers, no tracked uppercase labels, no `→` on buttons or links. `↗` stays on links that leave the site.
- Palette (spec, verbatim): `wall #DCE3E6`, `ink #18222E`, `bay #1F6B85`, `dusk #F0A04B` (fills and large type only), `shelf #232326`.
- One typeface: Recursive. `MONO 0, CASL 0` for text, `CASL 1` for casual notes, `MONO 1` for code.
- No hard offset shadows, no 3px plum borders, no hover lifts, no `data-reveal`.
- Text contrast ≥ 4.5:1 and UI borders/focus ≥ 3:1 in **every** preset.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A leftover old token** (`var(--plum)` in some rule nobody looked at) resolves to nothing: text turns black-on-navy at night or a border disappears. Pinned by `tests/css-tokens.test.js` "every var() is defined" (Task 1).
2. **The night preset** fails contrast on a pair only day was checked for (code block, links, form borders). Pinned by the per-preset contrast tests (Task 1) and the dusk/night axe states (Task 5).
3. **Recursive fails to load** (offline, blocked Google Fonts): code must still render monospace. Pinned by keeping `ui-monospace` in `--font-mono` and a test asserting both font stacks keep their system fallbacks (Task 2).
4. **Rendered blog markdown** (code, blockquote, links, images) on a dark preset: prose styles are the most likely to hardcode a light assumption. Pinned by the blog post at night in the axe run (Task 5).
5. **A raw hex sneaks back in** (e.g. the terminal's `#3A2A3E`, or an inline `style=` in HTML). Pinned by `tests/css-tokens.test.js` "no raw hex outside tokens" scanning CSS and HTML (Task 1).

---

## File map

| File | Change |
|---|---|
| `tests/css-tokens.test.js` | **create** — contrast per preset, undefined `var()`, raw hex, font fallbacks |
| `site/css/tokens/colors.css` | rewrite — room palette + day/dusk/night presets |
| `site/css/tokens/typography.css` | rewrite — Recursive, axes, scale |
| `site/css/tokens/fonts.css` | rewrite — Recursive import |
| `site/css/tokens/spacing.css` | unchanged |
| `site/css/base.css` | rewrite |
| `site/css/components/{primitives,button,section,card,post,field,filter,a11y}.css` | rewrite |
| `site/css/components/{badge,utilities}.css` | **delete** |
| `site/css/pages/{nav,hero,featured,skills,writing,contact,foundation,footer,blog}.css` | rewrite |
| `site/css/pages/{terminal,strip}.css` | **delete** |
| `site/css/responsive.css` | rewrite |
| `site/css/styles.css` | drop deleted imports, update header comment |
| `site/index.html`, `site/blog/index.html`, `site/404.html`, `site/admin.html` | font link, nav, footer, hero, kickers, arrows, class renames |
| `site/js/main.js` | remove typing, streak, reveal, shipped count, stack fills; sentence-case meta |
| `site/js/blog.js`, `site/js/admin.js` | class renames, sentence-case meta, arrows |
| `site/design/index.html` | rewrite for the new system |
| `tests/a11y.check.mjs` | add dusk and night states |
| `CLAUDE.md`, `docs/FRONTEND-LESSON.md`, `docs/ADD-A-PROJECT.md`, spec | describe the new code |

Class renames (styling only, no JS behaviour depends on them): `btn--gold` → `btn--primary`; `btn--paper` → removed (plain `.btn` is the quiet button); `section--paper` → `section--surface`; `section--cream` → `section--ground`; `contact__btn--gold` → `contact__btn--primary`.

---

### Task 1: Colour tokens with three presets, test-first

**Files:**
- Create: `tests/css-tokens.test.js`
- Modify: `site/css/tokens/colors.css` (full rewrite)

**Interfaces:**
- Produces (CSS custom properties, used by every later task): `--wall --ink --bay --dusk --shelf` (raw palette); per preset `--ground --surface --text --text-soft --link --rule`; shared `--fill --on-fill --code-bg --code-text --syn-keyword --syn-string`.
- Preset selection: `:root` / `[data-time="day"]` (default), `[data-time="dusk"]`, `[data-time="night"]`. Attribute selectors, not `:root[...]`, so any element can scope a preset (used by `/design/` in Task 6).

- [ ] **Step 0: Branch**

```bash
git switch redesign/desk-spec && git switch -c redesign/phase-1-identity
```
The phase branch starts from the spec branch, so the spec and this plan ship in the same PR.

- [ ] **Step 1: Write the failing test**

Create `tests/css-tokens.test.js`:

```js
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
  const missing = [];
  for (const file of walk(SITE).filter((f) => /\.(css|html|js)$/.test(f))) {
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/css-tokens.test.js`
Expected: FAIL. `--ground is not defined in the day preset`, a list of missing vars (none of the semantic names exist yet), and the raw hex test reporting `pages/terminal.css: #3A2A3E`. The font test fails with `--font-sans is not defined`.

- [ ] **Step 3: Rewrite `site/css/tokens/colors.css`**

```css
/* tokens/colors.css
   The room's palette, and three lighting presets built from it.

   The site is Luis's desk in Tampa and the window tells the time: phase 2's
   stage.js writes data-time="day|dusk|night" on <html> from Tampa's hour.
   Until then, and whenever JS is off, the day values apply.

   Attribute selectors rather than :root[data-time=…], so any element can
   scope a preset. /design/ uses that to show all three side by side.

   Contrast is not recorded here — tests/css-tokens.test.js computes it for
   every pair in every preset and fails the build if one drops below AA. */

:root {
  /* ---- The room — five colours, named for where they come from ---- */
  --wall: #DCE3E6;   /* daylight on a pale wall */
  --ink: #18222E;    /* deep navy, not a tinted black */
  --bay: #1F6B85;    /* Tampa Bay water */
  --dusk: #F0A04B;   /* sunset through the window. Fills and large type
                        only: 1.64:1 on --wall, so never small text. */
  --shelf: #232326;  /* the black IKEA shelf */
}

/* ---- Lighting presets ---- */
:root,
[data-time="day"] {
  --ground: var(--wall);
  --surface: #F2F5F6;
  --text: var(--ink);
  --text-soft: #3B4957;
  --link: var(--bay);
  --rule: #6B7B86;       /* borders and dividers, 3:1 */
}

[data-time="dusk"] {
  --ground: #D8CCC4;
  --surface: #E9E1DB;
  --text: var(--ink);
  --text-soft: #43403F;
  --link: #1A5C73;
  --rule: #716760;
}

[data-time="night"] {
  --ground: var(--ink);
  --surface: #223040;
  --text: #E4EAED;
  --text-soft: #A9B7C2;
  --link: #7CC4DD;
  --rule: #6A7F93;
}

/* ---- The same in every preset ---- */
:root {
  --fill: var(--dusk);          /* primary buttons, the skip link */
  --on-fill: var(--ink);
  --code-bg: var(--shelf);      /* code sits on the shelf, day or night */
  --code-text: #E4EAED;
  --syn-keyword: var(--dusk);
  --syn-string: #9FD4C8;
}
```

- [ ] **Step 4: Run the contrast tests**

Run: `node --test tests/css-tokens.test.js --test-name-pattern="clear"`
Expected: the six `day/dusk/night: … clear` tests PASS. The `var()`, hex and font tests still FAIL; Tasks 2–4 fix them. Do not commit a red suite: go straight on to Task 2 and commit Tasks 1–4 together at the end of Task 4 (they only make sense as one change).

---

### Task 2: Recursive, type scale and base

**Files:**
- Modify: `site/css/tokens/fonts.css`, `site/css/tokens/typography.css`, `site/css/base.css` (full rewrites)
- Modify: the `<link href="https://fonts.googleapis.com/css2?…">` in `site/index.html`, `site/blog/index.html`, `site/404.html`, `site/admin.html`, `site/design/index.html`

**Interfaces:**
- Consumes: Task 1 colour tokens.
- Produces: `--font-sans`, `--font-mono`; axis sets `--axes-sans`, `--axes-casual`, `--axes-mono`; type shorthands `--type-display`, `--type-h2`, `--type-h3`, `--type-lead`, `--type-body`, `--type-small`, `--type-code`; `--tracking-display`; weights `--fw-regular/medium/semibold/bold`. The old `--font-display`, `--font-body`, `--type-display-xl/l/m`, `--type-title`, `--type-body-l`, `--type-caption`, `--type-label`, `--label-tracking` are removed.

- [ ] **Step 1: `site/css/tokens/fonts.css`**

```css
/* Webfont — one Google Font, loaded by reference. Recursive is variable:
   the MONO and CASL axes give it a text voice, a casual voice and a code
   voice, so one family does the work three used to. */
@import url("https://fonts.googleapis.com/css2?family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1&display=swap");
```

- [ ] **Step 2: `site/css/tokens/typography.css`**

```css
:root {
  /* ---- One family, three voices ----
     font-family picks Recursive; font-variation-settings picks the voice.
     Each stack keeps a system fallback, so if Recursive can't load, code is
     still monospace. tests/css-tokens.test.js checks that. */
  --font-sans: 'Recursive', system-ui, sans-serif;
  --font-mono: 'Recursive', ui-monospace, monospace;
  --axes-sans: "MONO" 0, "CASL" 0;
  --axes-casual: "MONO" 0, "CASL" 1;   /* handwritten-style notes on shelf items */
  --axes-mono: "MONO" 1, "CASL" 0;     /* code */

  /* ---- Weights ---- */
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;

  /* ---- Scale — the classic 12·14·16·18·21·24·36·48·60·72 ---- */
  --type-display: 700 72px/1.0 var(--font-sans);    /* the name, and nothing else */
  --type-h2: 700 48px/1.05 var(--font-sans);        /* section titles */
  --type-h3: 600 24px/1.25 var(--font-sans);        /* card and post titles */
  --type-lead: 400 21px/1.5 var(--font-sans);       /* the line under a title */
  --type-body: 400 18px/1.55 var(--font-sans);      /* everything you read */
  --type-small: 400 14px/1.5 var(--font-sans);      /* meta, tags, captions */
  --type-code: 400 16px/1.6 var(--font-mono);

  --tracking-display: -0.02em;
}
```

- [ ] **Step 3: `site/css/base.css`**

```css
/* base.css
   Reset and document defaults. Nothing here is a component. */

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: var(--ground);
  color: var(--text);
  font: var(--type-body);
  font-variation-settings: var(--axes-sans);  /* inherited by everything below */
  min-height: 100vh;
  overflow-x: hidden;
}
code, kbd, pre { font-family: var(--font-mono); font-variation-settings: var(--axes-mono); }
::selection { background: var(--fill); color: var(--on-fill); }
a { color: inherit; }
```

- [ ] **Step 4: Swap the font `<link>` in all five HTML pages**

In each of `site/index.html`, `site/blog/index.html`, `site/404.html`, `site/admin.html`, `site/design/index.html`, replace the `href` of the Google Fonts stylesheet link (the one listing `Space+Grotesk…Public+Sans…`) with:

```
https://fonts.googleapis.com/css2?family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1&display=swap
```

Verify: `grep -rn "Space+Grotesk" site/` → no output.

- [ ] **Step 5: Run the font test**

Run: `node --test tests/css-tokens.test.js --test-name-pattern="font stacks"`
Expected: PASS.

---

### Task 3: Components

**Files:**
- Modify (full rewrites): `site/css/components/primitives.css`, `button.css`, `section.css`, `card.css`, `post.css`, `field.css`, `filter.css`, `a11y.css`
- Delete: `site/css/components/badge.css`, `site/css/components/utilities.css`
- Modify: `site/css/styles.css`

**Interfaces:**
- Consumes: Tasks 1–2 tokens; `--radius-sm` (4px), `--radius-md` (6px), `--radius-pill` from `spacing.css` (unchanged).
- Produces classes: `.mono`, `.section-title`, `.section-lead`, `.btn`, `.btn--primary`, `.btn--sm`, `.section`, `.section--surface`, `.section--ground`, `.section__inner`, `.section__head`, `.projects`, `.card`, `.card__meta`, `.card__title`, `.card__body`, `.inline-code`, `.tags`, `.tag`, `.tag--cat`, `.post`, `.post__title`, `.post__body`, `.field`, `.form-status`, `.filters`, `.filter`, `.filter.is-on`, `.skip-link`. Removed: `.nb-block`, `.section-kicker`, `.badge`, `.badge__dot`, `.btn--gold`, `.btn--paper`, `.section--paper`, `.section--cream`, `[data-reveal]`.

- [ ] **Step 1: `components/primitives.css`**

```css
/* components/primitives.css
   The smallest shared pieces every other component builds on. */

.mono { font-family: var(--font-mono); font-variation-settings: var(--axes-mono); }

.section-title {
  font: var(--type-h2);
  letter-spacing: var(--tracking-display);
  color: var(--text);
}
.section-lead {
  font: var(--type-lead);
  color: var(--text-soft);
  margin-top: 12px;
  max-width: 34em;
}
```

- [ ] **Step 2: `components/button.css`**

```css
/* components/button.css
   Two buttons: the quiet default and the primary fill. A press moves the
   button 1px; nothing lifts, nothing casts a shadow. */

.btn {
  display: inline-block;
  font: 600 16px/1 var(--font-sans);
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  padding: 14px 22px;
  text-decoration: none;
  cursor: pointer;
}
.btn:hover { border-color: var(--text); }
.btn:active { transform: translateY(1px); }
.btn--primary { color: var(--on-fill); background: var(--fill); border-color: var(--fill); }
.btn--primary:hover { border-color: var(--on-fill); }
.btn--sm { padding: 10px 16px; font-size: 14px; }
```

- [ ] **Step 3: `components/section.css`**

```css
/* components/section.css
   Section shell and its two grounds. Bands are separated by colour, not rules. */

.section { padding: 96px 5vw; }
.section--surface { background: var(--surface); }
.section--ground { background: var(--ground); }
.section__inner { max-width: 1100px; margin: 0 auto; }
.section__head { margin-bottom: 44px; }
```

- [ ] **Step 4: `components/card.css`**

```css
/* components/card.css
   The card grid, the card itself, and its tag chips. */

.projects { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.card {
  background: var(--ground);
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  padding: 32px;
}
.card__meta { font: var(--type-small); color: var(--text-soft); }
.card__title { font: var(--type-h3); color: var(--text); margin-top: 8px; }
.card__body { font: var(--type-body); color: var(--text-soft); margin-top: 12px; }
.card code, .inline-code {
  font-family: var(--font-mono); font-variation-settings: var(--axes-mono);
  color: var(--text); font-weight: var(--fw-semibold);
}
.tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.tag {
  font: var(--type-small); color: var(--text);
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--radius-sm); padding: 3px 10px;
}
```

- [ ] **Step 5: `components/post.css`**

```css
/* components/post.css
   Post card. Used by the home page AND /blog, so it is a component. */

.post {
  display: block; text-decoration: none;
  background: var(--ground); border: 1px solid var(--rule);
  border-radius: var(--radius-md); padding: 32px;
}
.post:hover { border-color: var(--text); }
.post__title { font: var(--type-h3); color: var(--text); margin-top: 10px; }
.post__body { font: var(--type-body); color: var(--text-soft); margin-top: 12px; }
```

- [ ] **Step 6: `components/field.css`**

```css
/* components/field.css
   Form field and status line. Used by the contact form AND admin.html.
   Built from --text, --ground and --rule only, so it works on any surface
   in any preset. (The old version was gold-on-plum and failed on cream.) */

.field { display: grid; gap: 6px; }
.field label { font: 600 14px/1.4 var(--font-sans); color: var(--text); }
.field input, .field textarea {
  font: var(--type-body); color: var(--text);
  background: var(--ground); border: 1px solid var(--rule);
  border-radius: var(--radius-sm); padding: 12px 14px; width: 100%;
}
.field input:focus, .field textarea:focus { border-color: var(--link); }
.form-status { font: var(--type-small); color: var(--text-soft); min-height: 18px; }
```

- [ ] **Step 7: `components/filter.css`**

```css
/* components/filter.css
   Category filter chips, and the category tag variant. */

.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 26px; }
.filters:empty { display: none; }
.filter {
  font: 500 14px/1 var(--font-sans); color: var(--text);
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--radius-pill); padding: 8px 14px; text-decoration: none;
}
.filter:hover { border-color: var(--text); }
.filter.is-on { color: var(--ground); background: var(--text); border-color: var(--text); }
.tag--cat { color: var(--surface); background: var(--link); border-color: var(--link); }
```

- [ ] **Step 8: `components/a11y.css`**

```css
/* components/a11y.css
   Skip link, focus rings, reduced motion. Imported LAST on purpose: when a
   component rule ties with the focus ring on specificity, source order
   decides, and the ring must win. */

/* Skip link — the first tab stop on every page. Off-screen until focused. */
.skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 100;
  font: 600 14px/1 var(--font-sans); color: var(--on-fill); background: var(--fill);
  border-radius: var(--radius-sm); padding: 12px 18px; text-decoration: none;
}
.skip-link:focus { left: 12px; top: 12px; }

/* Visible focus for keyboard users. :focus-visible, not :focus, so pointer
   users never see a ring they didn't ask for. --link clears 3:1 against
   both grounds in every preset (tests/css-tokens.test.js). */
a:focus-visible,
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
[tabindex]:focus-visible {
  outline: 3px solid var(--link);
  outline-offset: 3px;
}

/* NOTE: `.field input:focus` (0-2-1) out-specifies `input:focus-visible`
   (0-1-1). It only sets border-color, so the ring above survives. Never add
   `outline: none` to it — fix the source rule, don't layer a fix on top. */

/* Respect a reduced-motion preference. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .btn:active { transform: none; }
}
```

- [ ] **Step 9: Delete the two orphaned component files**

```bash
git rm site/css/components/badge.css site/css/components/utilities.css
```

- [ ] **Step 10: `site/css/styles.css` — drop their imports and the page files Task 4 deletes, and update the header**

Replace the header comment's first two lines (`Luis — Portfolio (Neo-Brutalist)` / `Single entry point…`) with:

```
   Luis Munoz — the desk. Single entry point. Every page links ONLY this file.
```

Delete these four lines (order of everything else unchanged):

```css
@import "components/badge.css";
@import "components/utilities.css";
@import "pages/terminal.css";
@import "pages/strip.css";
```

---

### Task 4: Pages, markup and JS

**Files:**
- Modify (full rewrites): `site/css/pages/nav.css`, `hero.css`, `featured.css`, `skills.css`, `writing.css`, `contact.css`, `foundation.css`, `footer.css`, `blog.css`, `site/css/responsive.css`
- Delete: `site/css/pages/terminal.css`, `site/css/pages/strip.css`
- Modify: `site/index.html`, `site/blog/index.html`, `site/404.html`, `site/admin.html`, `site/js/main.js`, `site/js/blog.js`, `site/js/admin.js`

**Interfaces:**
- Consumes: Task 3 classes.
- Produces: the page markup phase 2 builds on. `<header id="top" class="hero"><div class="hero__inner">…` is the element phase 2 replaces with the desk scene. `[data-stack]`, `[data-stack-next]`, `#project-list`, `#writing`, `#writing-list`, `#contact-form`, `#form-status` keep their names.

- [ ] **Step 1: Page CSS**

`pages/nav.css`:
```css
/* pages/nav.css
   Site header. The name is the brand; there is no logo mark. */

.nav {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 5vw; background: var(--ground); border-bottom: 1px solid var(--rule);
}
.nav__brand { font: 700 20px/1 var(--font-sans); color: var(--text); text-decoration: none; }
.nav__links { display: flex; align-items: center; gap: 4px; }
.nav__link {
  font: 500 16px/1 var(--font-sans); color: var(--text); text-decoration: none;
  padding: 10px 12px; border-radius: var(--radius-sm);
}
.nav__link:hover { background: var(--surface); }
.nav__cta {
  font: 600 16px/1 var(--font-sans); color: var(--on-fill); background: var(--fill);
  padding: 10px 16px; border-radius: var(--radius-md); text-decoration: none; white-space: nowrap;
}
```

`pages/hero.css`:
```css
/* pages/hero.css
   Home page hero. Text only until phase 2 puts the desk scene here. */

.hero { padding: 120px 5vw 96px; }
.hero__inner { max-width: 1100px; margin: 0 auto; }
.hero__title {
  font: var(--type-display); letter-spacing: var(--tracking-display);
  color: var(--text); max-width: 12em;
}
.hero__sub { font: var(--type-lead); color: var(--text-soft); margin-top: 24px; max-width: 30em; }
.hero__sub strong { color: var(--text); }
.hero__actions { display: flex; gap: 12px; margin-top: 36px; flex-wrap: wrap; }
```

`pages/featured.css`:
```css
/* pages/featured.css
   The hand-curated featured project and its before/after code blocks. */

.featured {
  background: var(--ground); border: 1px solid var(--rule); border-radius: var(--radius-md);
  padding: 42px; margin-bottom: 24px;
}
.featured__row { display: flex; gap: 40px; flex-wrap: wrap; }
.featured__col { flex: 1; min-width: 280px; }
.featured__title { font: 700 36px/1.1 var(--font-sans); letter-spacing: var(--tracking-display); color: var(--text); margin-top: 8px; }
.featured__body { font: var(--type-body); color: var(--text-soft); margin-top: 14px; }
.bug-label { font: 600 16px/1.4 var(--font-sans); color: var(--text); margin-bottom: 12px; }
.code-block {
  font: var(--type-code); font-variation-settings: var(--axes-mono);
  color: var(--code-text); background: var(--code-bg);
  border-radius: var(--radius-sm); padding: 16px 20px;
}
.code-block--bad  { border-left: 6px solid var(--dusk); }
.code-block--good { border-left: 6px solid var(--syn-string); }
.syn-kw { color: var(--syn-keyword); }
.syn-str { color: var(--syn-string); }
.bug-note { font: 400 16px/1.55 var(--font-sans); color: var(--text-soft); margin: 14px 0; }
```

`pages/skills.css`:
```css
/* pages/skills.css
   Computed stack bars, and the 'next up' row beneath them. One fill colour:
   the label says which tool, colour never carried meaning here. */

.skills { display: grid; grid-template-columns: 1fr 1fr; gap: 26px 50px; }
.skill__head {
  display: flex; justify-content: space-between;
  font: 600 16px/1.4 var(--font-sans); color: var(--text); margin-bottom: 8px;
}
.skill__level { font-weight: var(--fw-regular); color: var(--text-soft); }
.skill__track { height: 12px; background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-pill); overflow: hidden; }
.skill__fill { height: 100%; background: var(--link); }

.stack-next { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.stack-next__label { font: 600 16px/1.4 var(--font-sans); color: var(--text); }
.stack-next:empty { display: none; }
```

`pages/writing.css`:
```css
/* pages/writing.css
   The writing section header on the home page. */

.writing-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 40px; }
```

`pages/contact.css`:
```css
/* pages/contact.css
   Contact section. An ordinary surface now; the fields are components/field.css. */

.contact { padding: 96px 5vw; background: var(--surface); }
.contact__inner { max-width: 760px; margin: 0 auto; }
.contact__title { font: var(--type-h2); letter-spacing: var(--tracking-display); color: var(--text); }
.contact__sub { font: var(--type-lead); color: var(--text-soft); margin-top: 16px; }
.contact__links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 40px; }
.contact__btn {
  font: 600 16px/1 var(--font-sans); color: var(--text); background: var(--ground);
  border: 1px solid var(--rule); border-radius: var(--radius-md);
  padding: 14px 22px; text-decoration: none;
}
.contact__btn:hover { border-color: var(--text); }
.contact__btn--primary { color: var(--on-fill); background: var(--fill); border-color: var(--fill); }

.contact__form { max-width: 520px; margin-top: 40px; display: grid; gap: 14px; }
```

`pages/foundation.css`:
```css
/* pages/foundation.css
   IT foundation chips and the homelab note on the home page. */

.tags--foundation { gap: 10px; margin-top: 4px; }
.tags--foundation .tag { font-size: 16px; padding: 6px 12px; }
.foundation-note {
  margin-top: 32px; max-width: 34em;
  font: var(--type-lead); font-variation-settings: var(--axes-casual); color: var(--text);
}
```

`pages/footer.css`:
```css
/* pages/footer.css
   Site footer. */

.footer {
  padding: 34px 5vw; background: var(--ground); border-top: 1px solid var(--rule);
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;
}
.footer__name { font: 600 16px/1.4 var(--font-sans); color: var(--text); }
.footer__meta { font: var(--type-small); color: var(--text-soft); }
```

`pages/blog.css`:
```css
/* pages/blog.css
   The /blog reading column and rendered markdown. Post cards reuse .post. */

.blog__inner { max-width: 780px; margin: 0 auto; }
.blog__body { display: grid; gap: 24px; }

.prose__title {
  font: 700 48px/1.06 var(--font-sans); letter-spacing: var(--tracking-display);
  color: var(--text); margin-top: 10px;
}
.prose .tags { margin-top: 20px; }
.prose__body { margin-top: 38px; }

/* long-form reading column — 21px on a 780px column keeps lines under 80ch */
.prose__body p { font: 400 21px/1.6 var(--font-sans); color: var(--text-soft); margin: 0 0 24px; }
.prose__body h2 {
  font: 700 36px/1.15 var(--font-sans); letter-spacing: var(--tracking-display);
  color: var(--text); margin: 48px 0 16px;
}
.prose__body h3 { font: var(--type-h3); color: var(--text); margin: 34px 0 12px; }
.prose__body strong { color: var(--text); font-weight: var(--fw-semibold); }
.prose__body a { color: var(--link); font-weight: var(--fw-semibold); text-decoration: underline; }
.prose__body a:hover { text-decoration: none; }
.prose__body ul, .prose__body ol { margin: 0 0 24px; padding-left: 26px; }
.prose__body li { font: 400 21px/1.6 var(--font-sans); color: var(--text-soft); margin-bottom: 10px; }
.prose__body img { max-width: 100%; border-radius: var(--radius-md); }
.prose__body hr { border: none; border-top: 1px solid var(--rule); margin: 44px 0; }

.prose__body code {
  font-size: 0.9em; font-weight: var(--fw-semibold); color: var(--text);
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--radius-sm); padding: 1px 6px;
}
.prose__pre {
  background: var(--code-bg); border-radius: var(--radius-md);
  padding: 22px 24px; margin: 0 0 28px; overflow-x: auto;
}
.prose__pre code {
  font: var(--type-code); color: var(--code-text);
  background: none; border: none; padding: 0; font-weight: var(--fw-regular);
}
.prose__pre[data-lang]::before {
  content: attr(data-lang); display: block; margin-bottom: 12px;
  font: var(--type-small); color: var(--syn-string);
}
.prose__body blockquote {
  margin: 0 0 28px; padding: 18px 24px;
  background: var(--surface); border-left: 4px solid var(--link);
  font: 400 21px/1.6 var(--font-sans); font-variation-settings: var(--axes-casual); color: var(--text-soft);
}
```

`site/css/responsive.css`:
```css
/* responsive.css
   Every breakpoint, gathered. Imported after all components and pages
   because these rules tie on specificity with the ones they override —
   source order is what makes them win. */

@media (max-width: 860px) {
  .hero__title { font-size: 48px; }
  .projects, .skills, .writing-head + .projects { grid-template-columns: 1fr; }
  .section-title, .contact__title { font-size: 36px; }
  .nav__links .nav__link { display: none; }
  .featured { padding: 28px; }
  .prose__title { font-size: 36px; }
  .prose__body p, .prose__body li, .prose__body blockquote { font-size: 18px; }
  .prose__body h2 { font-size: 24px; }
}
```

```bash
git rm site/css/pages/terminal.css site/css/pages/strip.css
```

- [ ] **Step 2: Class renames across markup and JS**

```bash
cd site
sed -i '' 's/btn btn--gold/btn btn--primary/g; s/ btn--paper//g; s/btn--paper //g' index.html blog/index.html 404.html admin.html js/main.js js/blog.js js/admin.js
sed -i '' 's/section--paper/section--surface/g; s/section--cream/section--ground/g' index.html blog/index.html 404.html
sed -i '' 's/contact__btn contact__btn--gold/contact__btn contact__btn--primary/g' index.html
cd ..
grep -rn "btn--gold\|btn--paper\|section--paper\|section--cream\|contact__btn--gold" site/ || echo "clean"
```
Expected: `clean`.

- [ ] **Step 3: Nav and footer on all four pages**

In `site/index.html`, `site/blog/index.html`, `site/404.html`, replace the `<a … class="nav__brand">…</a>` element (the one wrapping `nav__mark` and `nav__wordmark`) with the same `href` it had and the name as its text. For `index.html`:

```html
      <a href="#top" class="nav__brand">Luis Munoz</a>
```
(`../` in `blog/index.html`, `/` in `404.html`.) In `site/admin.html` use `<a href="./index.html" class="nav__brand">Luis Munoz, admin</a>`.

Sentence-case the nav link text on those three pages: `log` → `Log`, `stack` → `Stack`, `background` → `Background`, `writing` → `Writing`, `say hi` → `Say hi`. In `admin.html`: `view site ↗` → `View site`.

Replace each `<footer class="footer">…</footer>` on `index.html`, `blog/index.html`, `404.html` with:

```html
    <footer class="footer">
      <span class="footer__name">Luis Munoz</span>
      <span class="footer__meta">Built and hosted by hand, 2026</span>
    </footer>
```

- [ ] **Step 4: `site/index.html` body**

Replace the whole `<header id="top" class="hero">…</header>` (badge, terminal and "currently" strip included) with:

```html
    <header id="top" class="hero">
      <div class="hero__inner">
        <h1 class="hero__title">I build small things and learn out loud.</h1>
        <p class="hero__sub">
          Hi, I'm <strong>Luis A. Munoz</strong>, teaching myself Python and data,
          one small project at a time.
        </p>
        <div class="hero__actions">
          <a href="#log" class="btn btn--primary">Read the log</a>
          <a href="https://github.com/DonLuisMunoz" target="_blank" rel="noopener" class="btn">GitHub ↗</a>
        </div>
      </div>
    </header>
```
(Interim copy. Phase 2 replaces this block with the name and the desk scene.)

Then, in the rest of `index.html`:
- Delete every `data-reveal` attribute: `sed -i '' 's/ data-reveal//g' site/index.html`.
- Delete every `<div class="section-kicker">…</div>` line (5 of them: learning log, the stack, the foundation, from the blog, and `contact__kicker` "say hi"). The section titles already say what each section is.
- Delete `<div class="featured__flag">FEATURED</div>`. The featured card's size and position already say it.
- `<div class="bug-label">// the bug that taught me most</div>` → `<div class="bug-label">The bug that taught me most</div>`.
- `<span class="inline-code" style="color: var(--accent)">0 rows</span>` → `<span class="inline-code">0 rows</span>`.
- Button and link text: `view the code ↗` → `View the code ↗`; `all posts →` → `All posts`; `send it →` → `Send it`; in `.contact__links`: `Blog →` → `Blog`, `GitHub ↗`/`LinkedIn ↗`/`Instagram ↗`/`Email ↗` unchanged.
- Footer done in Step 3.

Verify: `grep -n "data-reveal\|section-kicker\|→\|term__\|strip__\|badge\|data-type\|data-streak\|data-shipped" site/index.html` → no output.

- [ ] **Step 5: `site/blog/index.html`, `site/404.html`, `site/admin.html`**

- Delete the `<div class="section-kicker">…</div>` line in each (`// writing`, `// 404`, `// admin`).
- `404.html`: `← home` → `Home`; `read the blog` → `Read the blog`.
- `admin.html`:
  - `save project →` → `Save project`.
  - `<form id="project-form" class="nb-block" style="padding:24px;background:var(--paper);">` → `<form id="project-form" class="card">`.
  - `<div class="form-status" id="status" style="color:var(--accent);"></div>` → `<div class="form-status" id="status"></div>`.
  - Lead copy "New entries appear in the learning log instantly." → "New entries appear on the home page instantly."
  - Replace its `<style>` block with:

```html
  <style>
    .admin { max-width: 760px; margin: 0 auto; padding: 6vh 5vw; }
    .admin .field { margin-bottom: 16px; }
    .admin-list .card { margin-bottom: 16px; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; }
    .row > .field { flex: 1; min-width: 180px; }
    .danger { color: var(--text); background: var(--surface); border-color: var(--text); }
  </style>
```

- [ ] **Step 6: `site/js/main.js`**

1. Header comment line `Handles: typing effect, streak count-up, scroll reveal,` → `Handles: data-driven project cards, the stack tally, latest posts,` and the next line `data-driven project cards, and the contact form.` → `and the contact form.`
2. Delete from the comment `// CSS can silence transitions, but it can't stop a setTimeout loop.` through the end of section 3 (the `reveals.forEach((el) => el.classList.add("is-visible"));` line and its closing `}`). That removes `REDUCED_MOTION`, the typing effect, the streak count-up and the reveal observer. Nothing else reads `REDUCED_MOTION`: verify with `grep -n REDUCED_MOTION site/js/main.js` → no output.
3. In `renderProjects`, delete the four lines from `// The featured project is bespoke HTML` through `if (shipped) shipped.textContent = projects.length + featured;` (the strip they fed is gone).
4. In `cardHTML`: `class="btn btn--primary btn--sm" style="margin-top:18px;">view the code ↗</a>` → `class="btn btn--primary btn--sm" style="margin-top:18px;">View the code ↗</a>` (class already renamed in Step 2).
5. Delete `const STACK_FILLS = ["fill--gold", "fill--teal", "fill--accent", "fill--pink"];` and in `computeStack` change `` `<div class="skill__fill ${STACK_FILLS[i % STACK_FILLS.length]}" style=`` to `` `<div class="skill__fill" style=`` and `tools.map((t, i) => {` to `tools.map((t) => {`. `computeStack` stays a `function` declaration.
6. `` `<span class="section-kicker">// next up</span>` `` → `` `<span class="stack-next__label">Next up</span>` ``.
7. `latestPosts`: `const MONTHS = ["JAN", …, "DEC"];` → `const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];` and `` (p.minutes ? ` · ${p.minutes} MIN READ` : "") `` → `` (p.minutes ? `, ${p.minutes} min read` : "") ``.

- [ ] **Step 7: `site/js/blog.js` and `site/js/admin.js`**

`blog.js`:
- `MONTHS` → the same sentence-case array as main.js.
- `` bits.push(`${post.minutes} MIN READ`) `` → `` bits.push(`${post.minutes} min read`) ``; `return bits.join(" · ");` → `return bits.join(", ");`.
- `>everything</a>` → `>Everything</a>`.
- Both `← all posts` → `All posts`.

`admin.js`: button text `>edit<` → `>Edit<`, `>delete<` → `>Delete<`.

- [ ] **Step 8: Run everything**

```bash
node --test
for f in site/js/*.js; do node --check "$f"; done
python3 newpost.py check
git status --short site/sitemap.xml site/content
```
Expected: all tests PASS, including every test in `tests/css-tokens.test.js` (no undefined `var()`, no raw hex); `node --check` silent; `newpost.py check` leaves `sitemap.xml` and the manifest unchanged.

If the `var()` test lists names, each is an old token still referenced: fix the rule to use a Task 1/2 token. If the hex test lists a file, move the colour into `tokens/colors.css`.

- [ ] **Step 9: Commit Tasks 1–4**

```bash
git add tests/css-tokens.test.js site/
git commit -m "Replace the neobrutalist identity with the room palette and Recursive

Three time-of-day presets (day default until phase 2 sets data-time), one
variable typeface, and the template tells gone: kickers, uppercase labels,
arrows, hard shadows, scroll reveals, the terminal and the streak strip.
tests/css-tokens.test.js checks contrast in every preset, undefined vars,
raw hex and font fallbacks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Accessibility check covers every preset

**Files:**
- Modify: `tests/a11y.check.mjs`

**Interfaces:**
- Consumes: the `data-time` presets from Task 1.

- [ ] **Step 1: Add preset states**

Replace the `PAGES` array and the loop header so each entry can carry a preset. Change:

```js
const PAGES = [
  ["home", "/index.html"],
```
to:

```js
// [label, path, time preset]. null = no data-time attribute, which is what a
// visitor gets today and what stage.js falls back to. Dusk and night are
// audited on the two pages with the most colour surface: home and a
// rendered post (code blocks, blockquotes, links).
const PAGES = [
  ["home", "/index.html", null],
  ["home at dusk", "/index.html", "dusk"],
  ["home at night", "/index.html", "night"],
```
and give the remaining entries a third element: `["blog list", "/blog/index.html", null]`, `["blog post", "/blog/index.html?p=a-join-that-returned-zero-rows", null]`, then add `["blog post at dusk", "/blog/index.html?p=a-join-that-returned-zero-rows", "dusk"]`, `["blog post at night", "/blog/index.html?p=a-join-that-returned-zero-rows", "night"]`, then `["admin", "/admin.html", null]`, `["design system", "/design/index.html", null]`.

Change `for (const [label, path] of PAGES) {` to `for (const [label, path, time] of PAGES) {`, and directly after `await page.waitForTimeout(1500);` add:

```js
  if (time) await page.evaluate((t) => { document.documentElement.dataset.time = t; }, time);
```

- [ ] **Step 2: Run it**

```bash
npm install --no-save playwright axe-core && npx playwright install chromium
node tests/a11y.check.mjs
```
Expected: `PASS` on all 10 states, `No accessibility violations.` If a colour-contrast violation appears, fix the token value in `tokens/colors.css`, then rerun `node --test tests/css-tokens.test.js` and this check. Never fix it with a raw hex in a component.

- [ ] **Step 3: Commit**

```bash
git add tests/a11y.check.mjs
git commit -m "Audit home and a blog post at dusk and night

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: /design/ shows the new system

**Files:**
- Modify: `site/design/index.html` (full rewrite)

**Interfaces:**
- Consumes: every class from Tasks 3–4; the `[data-time]` scoping from Task 1.

- [ ] **Step 1: Rewrite `site/design/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Design system · Luis Munoz</title>
    <meta name="description" content="Every reusable component on luisamunoz.com, in every state and every time of day." />
    <!-- Internal reference, not a portfolio page. robots.txt disallows it too. -->
    <meta name="robots" content="noindex" />

    <link rel="icon" type="image/png" href="/assets/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1&display=swap"
      rel="stylesheet"
    />

    <!-- The REAL stylesheet, not a copy: if a component drifts, this page
         drifts with it and shows the truth. -->
    <link rel="stylesheet" href="../css/styles.css" />

    <style>
      /* Gallery chrome only, prefixed ds-. Tokens only, no raw hex. */
      .ds-main { max-width: 1100px; margin: 0 auto; padding: 64px 5vw 120px; }
      .ds-toc { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 26px; }
      .ds-sec { margin-top: 72px; }
      .ds-sec > h2 { font: var(--type-h2); letter-spacing: var(--tracking-display); color: var(--text); }
      .ds-sec > p { color: var(--text-soft); margin-top: 10px; max-width: 34em; }
      .ds-sub { font: var(--type-h3); color: var(--text); margin-top: 40px; }
      .ds-demo {
        background: var(--ground); border: 1px solid var(--rule); border-radius: var(--radius-md);
        padding: 28px; margin-top: 12px;
        display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start;
      }
      .ds-demo--stack { display: block; }
      .ds-code { font: var(--type-small); font-family: var(--font-mono); font-variation-settings: var(--axes-mono); color: var(--text-soft); margin-top: 8px; display: block; }
      .ds-note { background: var(--surface); border-left: 4px solid var(--link); padding: 14px 18px; margin-top: 16px; max-width: 40em; color: var(--text-soft); }
      .ds-presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 16px; }
      .ds-preset { background: var(--ground); color: var(--text); border: 1px solid var(--rule); border-radius: var(--radius-md); padding: 22px; }
      .ds-preset h3 { font: var(--type-h3); }
      .ds-preset p { color: var(--text-soft); margin-top: 6px; }
      .ds-preset .ds-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; align-items: center; }
      .ds-chip { width: 44px; height: 44px; border-radius: var(--radius-sm); border: 1px solid var(--rule); }
      .ds-room { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-top: 16px; }
      .ds-room__chip { height: 76px; border-radius: var(--radius-md) var(--radius-md) 0 0; }
      .ds-room__meta { background: var(--surface); border: 1px solid var(--rule); border-top: 0; border-radius: 0 0 var(--radius-md) var(--radius-md); padding: 10px 12px; font: var(--type-small); color: var(--text-soft); }
      .ds-room__meta strong { display: block; color: var(--text); }
      .ds-type-row { border-bottom: 1px solid var(--rule); padding: 16px 0; }
      .ds-type-row:last-child { border-bottom: 0; }
      .ds-type-label { font: var(--type-small); color: var(--text-soft); }
    </style>
  </head>

  <body>
    <a class="skip-link" href="#main">Skip to content</a>

    <nav class="nav">
      <a href="/" class="nav__brand">Luis Munoz</a>
      <div class="nav__links">
        <a href="/#log" class="nav__link">Log</a>
        <a href="/#stack" class="nav__link">Stack</a>
        <a href="/blog/" class="nav__link">Writing</a>
        <a href="/#contact" class="nav__cta">Say hi</a>
      </div>
    </nav>

    <main id="main" class="ds-main">
      <h1 class="section-title">Every part, every state, every hour</h1>
      <p class="section-lead">
        The reusable components behind luisamunoz.com, rendered from the site's own
        stylesheet. The site is a desk in Tampa, and the window tells the time, so every
        colour exists three times: day, dusk and night.
      </p>

      <nav class="ds-toc" aria-label="Sections">
        <a class="filter" href="#colour">Colour</a>
        <a class="filter" href="#type">Type</a>
        <a class="filter" href="#buttons">Buttons</a>
        <a class="filter" href="#cards">Cards</a>
        <a class="filter" href="#chips">Tags and filters</a>
        <a class="filter" href="#forms">Forms</a>
        <a class="filter" href="#code">Code</a>
        <a class="filter" href="#rules">Rules</a>
      </nav>

      <section class="ds-sec" id="colour">
        <h2>Colour</h2>
        <p>
          Five colours taken from the room. Components never use them directly: they use the
          semantic tokens below, which each time preset redefines. Contrast for every pair in
          every preset is checked by <code>tests/css-tokens.test.js</code>.
        </p>

        <h3 class="ds-sub">The room</h3>
        <div class="ds-room">
          <div><div class="ds-room__chip" style="background: var(--wall)"></div><div class="ds-room__meta"><strong>--wall</strong>Daylight on a pale wall</div></div>
          <div><div class="ds-room__chip" style="background: var(--ink)"></div><div class="ds-room__meta"><strong>--ink</strong>Text by day, the room at night</div></div>
          <div><div class="ds-room__chip" style="background: var(--bay)"></div><div class="ds-room__meta"><strong>--bay</strong>Tampa Bay; links and focus</div></div>
          <div><div class="ds-room__chip" style="background: var(--dusk)"></div><div class="ds-room__meta"><strong>--dusk</strong>Sunset; fills only, never small text</div></div>
          <div><div class="ds-room__chip" style="background: var(--shelf)"></div><div class="ds-room__meta"><strong>--shelf</strong>The IKEA shelf; code blocks</div></div>
        </div>

        <h3 class="ds-sub">Three times of day</h3>
        <div class="ds-presets">
          <div class="ds-preset" data-time="day">
            <h3>Day, 7:00 to 16:59</h3>
            <p>Sun through the window.</p>
            <div class="ds-row">
              <span class="ds-chip" style="background: var(--surface)"></span>
              <span class="ds-chip" style="background: var(--text-soft)"></span>
              <span class="ds-chip" style="background: var(--link)"></span>
              <span class="ds-chip" style="background: var(--rule)"></span>
              <a class="btn btn--primary btn--sm" href="#colour">Primary</a>
              <a class="btn btn--sm" href="#colour">Quiet</a>
            </div>
          </div>
          <div class="ds-preset" data-time="dusk">
            <h3>Dusk, 17:00 to 19:59</h3>
            <p>Low amber light across the shelf.</p>
            <div class="ds-row">
              <span class="ds-chip" style="background: var(--surface)"></span>
              <span class="ds-chip" style="background: var(--text-soft)"></span>
              <span class="ds-chip" style="background: var(--link)"></span>
              <span class="ds-chip" style="background: var(--rule)"></span>
              <a class="btn btn--primary btn--sm" href="#colour">Primary</a>
              <a class="btn btn--sm" href="#colour">Quiet</a>
            </div>
          </div>
          <div class="ds-preset" data-time="night">
            <h3>Night, 20:00 to 6:59</h3>
            <p>A dark room lit by the monitor.</p>
            <div class="ds-row">
              <span class="ds-chip" style="background: var(--surface)"></span>
              <span class="ds-chip" style="background: var(--text-soft)"></span>
              <span class="ds-chip" style="background: var(--link)"></span>
              <span class="ds-chip" style="background: var(--rule)"></span>
              <a class="btn btn--primary btn--sm" href="#colour">Primary</a>
              <a class="btn btn--sm" href="#colour">Quiet</a>
            </div>
          </div>
        </div>
        <code class="ds-code">&lt;html data-time="day|dusk|night"&gt; · any element can scope a preset</code>
      </section>

      <section class="ds-sec" id="type">
        <h2>Type</h2>
        <p>
          One family, Recursive, in three voices set by its variable axes. Sentence case
          everywhere; no uppercase labels.
        </p>
        <div class="ds-demo ds-demo--stack">
          <div class="ds-type-row">
            <div class="ds-type-label">Display 72, the name only</div>
            <div style="font: var(--type-display); letter-spacing: var(--tracking-display);">Luis Munoz</div>
          </div>
          <div class="ds-type-row">
            <div class="ds-type-label">Heading 48, section titles</div>
            <div class="section-title">What I've been building</div>
          </div>
          <div class="ds-type-row">
            <div class="ds-type-label">Heading 24, card titles</div>
            <div class="card__title" style="margin-top: 0;">Tampa Bay Affordability Analysis</div>
          </div>
          <div class="ds-type-row">
            <div class="ds-type-label">Lead 21</div>
            <p class="section-lead" style="margin-top: 0;">The line under a section title.</p>
          </div>
          <div class="ds-type-row">
            <div class="ds-type-label">Body 18</div>
            <p>Everything you read, at under 80 characters a line.</p>
          </div>
          <div class="ds-type-row">
            <div class="ds-type-label">Casual, for notes on shelf items</div>
            <p style="font-variation-settings: var(--axes-casual);">Painted this one in 2019.</p>
          </div>
          <div class="ds-type-row">
            <div class="ds-type-label">Mono, for code</div>
            <code>JOIN zhvi zh ON zo.zip = zh."RegionName"</code>
          </div>
        </div>
      </section>

      <section class="ds-sec" id="buttons">
        <h2>Buttons</h2>
        <p>The quiet default and the primary fill. A press moves the button 1px.</p>
        <div class="ds-demo">
          <a href="#buttons" class="btn btn--primary">Primary</a>
          <a href="#buttons" class="btn">Quiet</a>
          <a href="#buttons" class="btn btn--primary btn--sm">Primary small</a>
          <a href="#buttons" class="btn btn--sm">Quiet small</a>
        </div>
        <code class="ds-code">.btn · .btn.btn--primary · add .btn--sm</code>
        <div class="ds-note">
          Focus is a 3px <code>--link</code> ring, offset 3px, for keyboard users only via
          <code>:focus-visible</code>. Tab to a button to see it.
        </div>
      </section>

      <section class="ds-sec" id="cards">
        <h2>Cards</h2>
        <p>Used for projects and blog posts.</p>
        <div class="ds-demo ds-demo--stack">
          <div class="projects">
            <article class="card">
              <div class="card__meta">Aug 2026, SQL</div>
              <h3 class="card__title">A join that returned zero rows</h3>
              <p class="card__body">A card with meta, title, body and tags.</p>
              <div class="tags"><span class="tag">SQL</span><span class="tag">debugging</span></div>
              <a href="#cards" class="btn btn--primary btn--sm" style="margin-top: 18px;">View the code ↗</a>
            </article>
            <article class="card">
              <div class="card__meta">Jul 2026, Python</div>
              <h3 class="card__title">A card with no tags</h3>
              <p class="card__body">The tags block is left out rather than rendered empty.</p>
            </article>
          </div>
        </div>
        <code class="ds-code">.card &gt; .card__meta · .card__title · .card__body · .tags</code>
      </section>

      <section class="ds-sec" id="chips">
        <h2>Tags and filters</h2>
        <div class="ds-demo">
          <span class="tag">python</span>
          <span class="tag">sql</span>
          <span class="tag tag--cat">building</span>
        </div>
        <code class="ds-code">.tag · .tag.tag--cat</code>
        <div class="ds-demo">
          <a class="filter is-on" href="#chips">Everything</a>
          <a class="filter" href="#chips">Building</a>
          <a class="filter" href="#chips">Notes</a>
        </div>
        <code class="ds-code">.filter · .filter.is-on</code>
      </section>

      <section class="ds-sec" id="forms">
        <h2>Forms</h2>
        <p>Built from --text, --ground and --rule only, so fields work on any surface in any preset.</p>
        <div class="ds-demo ds-demo--stack">
          <div class="contact__form" style="margin-top: 0;">
            <div class="field">
              <label for="ds-name">Name</label>
              <input id="ds-name" type="text" value="Luis" />
            </div>
            <div class="field">
              <label for="ds-msg">Message</label>
              <textarea id="ds-msg" rows="3">Focus a field to see its border turn --link.</textarea>
            </div>
            <p class="form-status">Sending…</p>
          </div>
        </div>
        <code class="ds-code">.field &gt; label + input | textarea · .form-status</code>
      </section>

      <section class="ds-sec" id="code">
        <h2>Code</h2>
        <p>Code sits on the shelf colour in every preset.</p>
        <div class="ds-demo ds-demo--stack">
          <div class="code-block code-block--bad"><span class="syn-kw">JOIN</span> zhvi zh <span class="syn-kw">ON</span> zo.zip = zh.<span class="syn-str">"RegionID"</span></div>
          <div class="code-block code-block--good" style="margin-top: 12px;"><span class="syn-kw">JOIN</span> zhvi zh <span class="syn-kw">ON</span> zo.zip = zh.<span class="syn-str">"RegionName"</span></div>
        </div>
      </section>

      <section class="ds-sec" id="rules">
        <h2>Rules that are load-bearing</h2>
        <div class="ds-note"><strong>1. Never write a raw hex outside <code>tokens/</code>.</strong> A test fails the build if you do.</div>
        <div class="ds-note"><strong>2. Components use semantic tokens, never the room colours.</strong> <code>--text</code>, not <code>--ink</code>: at night <code>--text</code> is light, and <code>--ink</code> is still navy.</div>
        <div class="ds-note"><strong>3. Dusk is a fill.</strong> At 1.64:1 on <code>--wall</code> it can never be small text.</div>
        <div class="ds-note"><strong>4. <code>class</code> styles, <code>data-*</code> targets.</strong> JavaScript queries <code>[data-stack]</code>, never <code>.skills</code>.</div>
        <div class="ds-note"><strong>5. Motion answers the visitor.</strong> Nothing fades in on scroll. Reduced motion is respected everywhere.</div>
      </section>
    </main>

    <footer class="footer">
      <span class="footer__name">Luis Munoz</span>
      <span class="footer__meta">Design system, rendered from the site's own CSS</span>
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Verify**

```bash
node --test tests/css-tokens.test.js
node tests/a11y.check.mjs
```
Expected: all PASS (the gallery's night panel is audited as part of "design system").

- [ ] **Step 3: Commit**

```bash
git add site/design/index.html
git commit -m "Rebuild /design/ for the room palette, presets and Recursive

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs match the code

**Files:**
- Modify: `CLAUDE.md`, `docs/FRONTEND-LESSON.md`, `docs/ADD-A-PROJECT.md`, `docs/superpowers/specs/2026-09-26-desk-redesign-design.md`

- [ ] **Step 1: `CLAUDE.md`**

- **Commands:** add `node --test` covers `tests/css-tokens.test.js` (contrast per preset, undefined vars, raw hex).
- **Conventions that are load-bearing:**
  - Replace the "Never write a raw hex value" bullet's reasoning with: "The palette is five room colours and three time presets in `tokens/colors.css`; components use semantic tokens (`--text`, `--ground`, `--link`…) so a preset change recolours everything. `tests/css-tokens.test.js` fails on a raw hex or an undefined `var()`."
  - Replace the **Design rules** bullet with: "**Design rules**: the room palette, Recursive only, sentence case, 1px `--rule` borders with small radii, no shadows, no scroll reveals, motion only in answer to the visitor. Source of truth is `site/design/index.html` (`/design/`). `neobrutalism-spec.md` no longer describes this site."
  - In the **Accessibility** bullet, replace "Gold (`--gold`) is a fill/border colour only — it cannot pass contrast as small text on cream." with "`--dusk` is a fill colour only — 1.64:1 on `--wall`. Contrast must pass in all three presets; the a11y check audits dusk and night."
- **Lesson plan → Where he actually is → Open:** replace the scaffold sentence ("The scaffold that was on the table: the typing effect adds a character every 95ms…") with: "The typing effect is gone (redesign, phase 1). New scaffold: a 200ms synchronous loop runs on click; ask what happens to the nav hover state and a second click during it, then contrast with `await fetch` in `loadProjects()`."
- **Sequence table:** row 3 `#13 Palette audit` → `#13 Palette audit — superseded by the desk redesign (spec 2026-09-26)`; row 4 `#2 Dark mode` → `#2 Dark mode — becomes the day/dusk/night presets (phase 2)`.
- **Recall prompts:** "Why can gold be a border but never small text on cream?" → "Why can dusk be a button fill but never small text on the wall?"

- [ ] **Step 2: `docs/FRONTEND-LESSON.md`**

- Concept 11 (`IntersectionObserver`): replace the body with: "The scroll reveal that taught this was removed in the redesign (phase 1). Read it where it lived: `git show 74a82aa:site/js/main.js`, section 3. The same API returns in phase 2, where `stage.js` uses it to build each 3D scene only when its section nears the viewport."
- Concept 14: replace "fire the typing effect" with "run CSS hover states" and replace the sentence "That's why the typing animation keeps running smoothly while `loadProjects()` is waiting." with "That's why the nav still responds while `loadProjects()` is waiting."
- Concept 17: replace the `IntersectionObserver` example with the same instinct in code that exists: "`if (!listEl) return;` in `loadProjects()` and the hidden-until-posts `#writing` section: when a piece is missing, the page gets smaller, not broken."
- Concept 23: replace "the typing effect and the streak count-up are *JavaScript* loops" with "a JavaScript loop is not"; keep the `matchMedia` explanation and add: "The site had two such loops (typing, streak); the redesign removed both, and phase 2's scene code will read the same preference."
- Every occurrence of `data-reveal` in the doc: change the quoted markup `<div data-reveal class="skills" data-stack>` to `<div class="skills" data-stack>`.
- Concepts 19–20 (contrast): append one line to 20: "The redesign replaced these colours; `tests/css-tokens.test.js` now computes every ratio in every preset instead of a comment recording them."

- [ ] **Step 3: `docs/ADD-A-PROJECT.md`**

Delete the two table rows `Typing-line phrases` and `Streak start date`, and the bullet `- **Streak** (`data-streak`) — days since the start date…`.

- [ ] **Step 4: Spec**

In the spec's **Phases** list, change item 1 to: "**Identity.** Tokens per time preset, Recursive, neobrutalism removed, the terminal, typing effect, streak strip and badge deleted, `/design/`, CLAUDE.md and lesson docs updated. No 3D yet."

- [ ] **Step 5: Verify and commit**

```bash
grep -n "typing\|data-reveal\|--gold\|--plum\|Space Grotesk" CLAUDE.md docs/FRONTEND-LESSON.md docs/ADD-A-PROJECT.md
```
Expected: only the intentional historical references written in Steps 1–2 (`git show 74a82aa…`, "typing effect is gone", "removed both").

```bash
git add CLAUDE.md docs/
git commit -m "Update CLAUDE.md and lesson docs for the phase 1 identity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verify, simplify, open the PR

- [ ] **Step 1: Full gate, as CI runs it**

```bash
node --test
for f in site/js/*.js; do node --check "$f"; done
python3 newpost.py check && git diff --exit-code site/sitemap.xml
node tests/a11y.check.mjs
```
Expected: all green, 10 a11y states PASS.

- [ ] **Step 2: Look at it**

Serve `site/` (`python3 -m http.server 8765 --directory site`) and screenshot `/`, `/blog/`, `/blog/?p=a-join-that-returned-zero-rows` and `/design/` at 390px and 1440px, in each preset (set `document.documentElement.dataset.time`). Check: no horizontal scroll at 390px (`document.documentElement.scrollWidth === 390`), text readable in all three presets, focus ring visible when tabbing. Fix anything found in the owning file; rerun Step 1.

- [ ] **Step 3: `/simplify` on the branch diff**

Run `/simplify`. Apply fixes that keep every test green; rerun Step 1 after.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin redesign/phase-1-identity
gh pr create --title "Desk redesign, phase 1: identity" --body "$(cat <<'EOF'
Phase 1 of docs/superpowers/specs/2026-09-26-desk-redesign-design.md.

- Room palette with day, dusk and night presets (day until phase 2 sets `data-time`)
- Recursive replaces Space Grotesk, Public Sans and JetBrains Mono
- Removed: hard shadows, plum borders, kickers, uppercase labels, arrows, scroll reveals, the terminal, typing effect, streak strip and badge
- New `tests/css-tokens.test.js`: contrast in every preset, undefined vars, raw hex, font fallbacks
- a11y check audits home and a blog post at dusk and night
- `/design/`, CLAUDE.md and lesson docs rewritten to match

Supersedes #13; #2 becomes the time presets in phase 2.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: CI green before merge.
