# Desk redesign, phase 2: Stage and hero desk — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text hero with the name and an interactive 3D model of Luis's desk, lit by Tampa's current time of day, with a still-image fallback and working links either way.

**Architecture:** A tiny classic script (`time.js`) sets `<html data-time>` from Tampa's hour before first paint, so the CSS presets from phase 1 go live site-wide. On the home page, an ES module (`stage.js`) imports three.js from jsDelivr after the text has painted, builds the desk from primitives (`scenes/desk.js`, colours read from CSS tokens), and draws it into a canvas over a still image. The links to each section are real `<a>` elements positioned over the objects; they work with no JS, no WebGL, or no three.js.

**Tech Stack:** Plain HTML/CSS/JS, three.js 0.186.1 via `https://cdn.jsdelivr.net/npm/three@0.186.1/+esm` (the one approved runtime dependency), `node --test`, Playwright + axe-core as `--no-save` dev tooling.

**Spec:** `docs/superpowers/specs/2026-09-26-desk-redesign-design.md`

Branch `redesign/phase-2-desk`, stacked on `redesign/phase-1-identity` (PR #18). The phase 2 PR targets `redesign/phase-1-identity`; GitHub retargets it to `main` when #18 merges.

## Decisions against the spec (for review)

| Spec says | This plan does | Why |
|---|---|---|
| Under 200 KB of homepage JS | **Under 210 KB** | Measured: three.js as one minified module (`+esm`) is 190 KB brotli on its own. The package ships no minified build; the alternative (`three.module.min.js`) pulls an unminified `three.core.js` for ~356 KB total. |
| Label appears on hover/focus | **Labels always visible** as small pills; hover/focus brightens the object | Touch screens have no hover, and hidden labels make the objects undiscoverable. Also removes raycasting: the links are the interaction surface. |
| One still per scene | **One still for the desk, day lighting** | The fallback is only for no-WebGL or a failed import. Three stills would need CSS or JS to pick one. |
| Hero objects: monitor, MacBook, window, shelf, homelab box | **Homelab box is modelled but gets no link yet** | Its section doesn't exist until phase 3; a second link to `#foundation` next to "About" would be confusing. |
| Phones: fixed camera, lighter render | **Kept:** at ≤860px no sway, no antialiasing, 1× pixel ratio | As specced. |
| Reduced motion + low-power device → still | **Reduced motion → live desk, frozen** (no sway, no glide) | "Low power" can't be detected reliably. The still remains the fallback for no WebGL. |
| `site/js/lib/time.js` | **`site/js/time.js`, a classic script** | It must run in `<head>` before first paint; a module runs after parsing and would flash day at night. Tested the same way `blog.js` is (`module.exports`). |

## Global Constraints

- three.js is the **only** runtime dependency, pinned to `0.186.1` via `+esm`, loaded **only on the home page**, and **optional**.
- Never write a raw hex outside `site/css/tokens/` — including JS: the scene reads every colour from CSS tokens.
- `styles.css` import order is load-bearing. `class` is for styling, `data-*` is for JavaScript.
- `computeStack()` stays a `function` declaration. `esc()` before `innerHTML`.
- Sentence case, no `→`, `↗` only on off-site links. No fades.
- Motion that runs without input: the hero's slow camera sway only. Reduced motion freezes it and skips the click glide.
- Contrast passes in every preset; zero axe violations; no horizontal scroll at 390px.
- `ASPECT` in `stage.js` must equal `.desk { aspect-ratio }` in `pages/hero.css` (16 / 10).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **No WebGL, or jsDelivr blocked:** the still shows, all four links work, nothing throws. Pinned by the a11y "home without WebGL" state, which also fails if the still is missing (Task 3).
2. **The visitor's clock is not Tampa's** (a visitor in London at 01:00 is Tampa's 20:00, night) and **DST boundaries**. Pinned by `tests/time.test.js` using fixed UTC instants in both EDT and EST, plus the DST-change day (Task 1).
3. **Night preset on every page**, now that `data-time` is live site-wide: a night visitor gets dark `/blog/` and 404 too. Pinned by the existing dusk/night a11y states; `time.js` added to those pages in Task 1.
4. **A scene colour that isn't a token** (a hex typed into `desk.js`, or a token defined in day but not night). Pinned by the scene-token test (Task 2).
5. **Keyboard users:** every desk link is reachable by Tab with a visible focus ring, and focusing it highlights the object. The links are ordinary `<a>`s; axe covers names and focus is checked in Task 5's manual pass.

---

## File map

| File | Change |
|---|---|
| `site/js/time.js` | **create** — Tampa hour → preset, writes `<html data-time>` |
| `tests/time.test.js` | **create** |
| `site/js/stage.js` | **create** — renderer, camera, links, sway, glide, visibility |
| `site/js/scenes/desk.js` | **create** — the desk from primitives |
| `site/css/tokens/colors.css` | add scene tokens |
| `tests/css-tokens.test.js` | add scene-token and scene-hex tests |
| `site/css/pages/hero.css`, `site/css/responsive.css` | hero becomes name + desk |
| `site/index.html` | hero markup, nav, `time.js`, `stage.js` |
| `site/blog/index.html`, `site/404.html`, `site/admin.html`, `site/design/index.html` | nav labels; `time.js` (not on `/design/`) |
| `tests/serve.mjs` | **create** — static server shared by the two browser scripts |
| `tests/a11y.check.mjs` | use `serve.mjs`; add "home without WebGL" state |
| `scripts/render-stills.mjs` | **create** — renders `site/assets/scenes/desk.jpg`, prints link positions |
| `site/assets/scenes/desk.jpg` | **create** (generated) |
| `CLAUDE.md`, `readme.md`, `docs/FRONTEND-LESSON.md`, spec | describe the new code |

---

### Task 1: Tampa time presets go live

**Files:**
- Create: `site/js/time.js`, `tests/time.test.js`
- Modify: `<head>` of `site/index.html`, `site/blog/index.html`, `site/404.html`, `site/admin.html`

**Interfaces:**
- Produces: `tampaHour(date: Date) → 0–23`, `presetFor(date: Date) → "day" | "dusk" | "night"` (CommonJS export for tests); side effect in browsers: `document.documentElement.dataset.time = presetFor(new Date())`.

- [ ] **Step 1: Write the failing test** — `tests/time.test.js`

```js
/* Tests for site/js/time.js — which lighting preset Tampa is in.
   Every case is a fixed UTC instant, so the result can't depend on the
   timezone of the machine running the tests, which is the whole point:
   a visitor in London sees Tampa's light, not London's. */
const test = require("node:test");
const assert = require("node:assert");
const { tampaHour, presetFor } = require("../site/js/time.js");

const at = (iso) => new Date(iso);

test("tampaHour reads the clock in Tampa, not the visitor's", () => {
  assert.strictEqual(tampaHour(at("2026-07-15T16:00:00Z")), 12);  // EDT, UTC-4
  assert.strictEqual(tampaHour(at("2026-01-15T17:00:00Z")), 12);  // EST, UTC-5
});

test("summer (EDT) boundaries", () => {
  assert.strictEqual(presetFor(at("2026-07-15T10:59:00Z")), "night"); // 06:59
  assert.strictEqual(presetFor(at("2026-07-15T11:00:00Z")), "day");   // 07:00
  assert.strictEqual(presetFor(at("2026-07-15T20:59:00Z")), "day");   // 16:59
  assert.strictEqual(presetFor(at("2026-07-15T21:00:00Z")), "dusk");  // 17:00
  assert.strictEqual(presetFor(at("2026-07-15T23:59:00Z")), "dusk");  // 19:59
  assert.strictEqual(presetFor(at("2026-07-16T00:00:00Z")), "night"); // 20:00
});

test("winter (EST) boundaries", () => {
  assert.strictEqual(presetFor(at("2026-01-15T11:59:00Z")), "night"); // 06:59
  assert.strictEqual(presetFor(at("2026-01-15T12:00:00Z")), "day");   // 07:00
  assert.strictEqual(presetFor(at("2026-01-15T22:00:00Z")), "dusk");  // 17:00
  assert.strictEqual(presetFor(at("2026-01-16T01:00:00Z")), "night"); // 20:00
});

test("the morning clocks change (2026-03-08) uses the new offset", () => {
  // 11:00Z is 07:00 EDT; before the change it would have read 06:00 EST.
  assert.strictEqual(presetFor(at("2026-03-08T11:00:00Z")), "day");
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `node --test tests/time.test.js`
Expected: FAIL — `Cannot find module '../site/js/time.js'`.

- [ ] **Step 3: Write `site/js/time.js`**

```js
/* ============================================================
   time.js — which light is in the room right now.

   The site is a desk in Tampa and the window tells the time. This picks
   the lighting preset from Tampa's current hour and writes it to
   <html data-time>, which the CSS tokens and the 3D desk both follow.

   A classic script in <head>, not a module, on purpose: it has to run
   before first paint. A module runs after parsing, and a night visitor
   would see a flash of day.
   ============================================================ */
(function () {
  "use strict";
  const ZONE = "America/New_York";   // Tampa. Intl handles daylight saving.

  function tampaHour(date) {
    return Number(new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE, hour: "numeric", hourCycle: "h23",
    }).format(date));
  }

  function presetFor(date) {
    const h = tampaHour(date);
    if (h >= 7 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  if (typeof document !== "undefined") {
    document.documentElement.dataset.time = presetFor(new Date());
  }

  // Exposed for tests/time.test.js, the same way blog.js exposes renderMarkdown.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { tampaHour, presetFor };
  }
})();
```

- [ ] **Step 4: Run it, watch it pass**

Run: `node --test tests/time.test.js` → Expected: 4/4 PASS. Then `node --check site/js/time.js`.

- [ ] **Step 5: Load it in `<head>`**

Directly after the `<link rel="stylesheet" …styles.css>` line, add:
- `site/index.html`: `    <script src="./js/time.js"></script>`
- `site/blog/index.html`: `    <script src="../js/time.js"></script>`
- `site/404.html`: `    <script src="/js/time.js"></script>` (absolute: 404 is served at any depth)
- `site/admin.html`: `  <script src="./js/time.js"></script>`

Not `/design/`: the gallery shows all three presets side by side and should stay stable.

- [ ] **Step 6: Verify and commit**

```bash
node --test
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tests/a11y.check.mjs
```
Expected: all unit tests PASS; a11y 9/9 PASS (its `null` state removes `data-time`, and dusk/night set it explicitly, so the real clock can't make the run flaky).

```bash
git add site/js/time.js tests/time.test.js site/index.html site/blog/index.html site/404.html site/admin.html
git commit -m "Light the site by Tampa's time of day

time.js sets <html data-time> from Tampa's hour before first paint, so
the day, dusk and night presets from phase 1 go live on every page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The desk in 3D

**Files:**
- Modify: `tests/css-tokens.test.js`, `site/css/tokens/colors.css`, `site/css/pages/hero.css`, `site/css/responsive.css`, `site/index.html`, nav in `site/blog/index.html`, `site/404.html`, `site/design/index.html`
- Create: `site/js/scenes/desk.js`, `site/js/stage.js`

**Interfaces:**
- Consumes: `data-time` from Task 1.
- Produces: `buildDesk(THREE, scene, time, token) → { camera: { position: Vector3, target: Vector3 }, anchors: { monitor, laptop, shelf, window, homelab: Vector3 }, highlight(name: string, on: boolean) }`. Markup contract used by Task 3: `[data-desk]` (gets class `is-live` once drawing), `[data-desk-canvas]`, `.desk__still`, `a[data-spot="monitor|laptop|shelf|window"]` with inline `--x`/`--y`.
- Scene tokens: shared `--scene-desk`, `--scene-metal`, `--scene-screen`; per preset `--scene-sky`, `--scene-light`.

- [ ] **Step 1: Write the failing scene-token tests** — append to `tests/css-tokens.test.js`

```js

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
```

- [ ] **Step 2: Write `site/js/scenes/desk.js`**

```js
/* ============================================================
   scenes/desk.js — Luis's desk in Tampa, built from boxes and cylinders.

   No model files and no loaders. Every colour is a CSS token read through
   `token()`, so the palette still lives in site/css/tokens/colors.css and
   nowhere else (tests/css-tokens.test.js checks both). The paintings and the
   monitor's screen are drawn on a <canvas> at runtime.

   buildDesk(THREE, scene, time, token) returns
     camera     { position, target } — where stage.js puts the camera
     anchors    world points the links sit on, one per object
     highlight  (name, on) — brighten an object while its link is hovered
   ============================================================ */

// How much light, per preset. Colours come from tokens; only the amounts
// live here, because they are numbers, not palette.
const LIGHT = {
  day: { ambient: 1.3, window: 2.6, screen: 0.4 },
  dusk: { ambient: 0.6, window: 1.8, screen: 0.8 },
  night: { ambient: 0.15, window: 0.2, screen: 2.4 },
};

export function buildDesk(THREE, scene, time, token) {
  const color = (name) => new THREE.Color(token(name));
  const level = LIGHT[time] || LIGHT.day;
  const groups = {};

  const mat = (name) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: 0.85, flatShading: true });

  function box(w, h, d, name, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(name));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function group(name) {
    const g = new THREE.Group();
    groups[name] = g;
    scene.add(g);
    return g;
  }

  function painted(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---- The room ----
  box(6, 0.02, 6, "--ink", 0, 0, 0);          // floor
  box(6, 3, 0.05, "--wall", 0, 1.5, -1.25);    // back wall
  box(0.05, 3, 6, "--wall", 1.45, 1.5, 0);     // right wall, with the window

  // ---- Desk ----
  box(1.6, 0.04, 0.72, "--scene-desk", 0, 0.74, 0);
  for (const x of [-0.76, 0.76]) {
    for (const z of [-0.32, 0.32]) box(0.04, 0.72, 0.04, "--shelf", x, 0.36, z);
  }

  // ---- Dell monitor on a single arm ----
  const monitor = group("monitor");
  box(0.05, 0.04, 0.08, "--scene-metal", 0.1, 0.78, -0.3, monitor);   // clamp
  box(0.03, 0.36, 0.03, "--scene-metal", 0.1, 0.96, -0.3, monitor);   // post
  box(0.03, 0.03, 0.24, "--scene-metal", 0.1, 1.14, -0.19, monitor);  // arm
  box(0.62, 0.37, 0.03, "--shelf", 0.1, 1.15, -0.08, monitor);        // body
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.59, 0.33),
    new THREE.MeshBasicMaterial({ map: painted(512, 288, (g, w, h) => {
      g.fillStyle = token("--shelf");
      g.fillRect(0, 0, w, h);
      // Twelve lines of "code", the same on every load.
      const inks = ["--syn-keyword", "--code-text", "--syn-string", "--code-text"];
      const indent = [0, 1, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0];
      indent.forEach((n, i) => {
        g.fillStyle = token(inks[i % inks.length]);
        g.fillRect(24 + n * 28, 20 + i * 21, 60 + ((i * 97) % 220), 9);
      });
    }) }),
  );
  screen.position.set(0.1, 1.15, -0.064);
  monitor.add(screen);

  // ---- MacBook, lid open, cabled to the monitor ----
  const laptop = group("laptop");
  box(0.31, 0.015, 0.22, "--scene-metal", 0.5, 0.768, 0.12, laptop);
  const hinge = new THREE.Group();
  hinge.position.set(0.5, 0.775, 0.01);
  hinge.rotation.x = -0.25;                                   // leaning back, open
  box(0.31, 0.21, 0.01, "--scene-metal", 0, 0.105, 0, hinge); // lid
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18),
    new THREE.MeshBasicMaterial({ color: color("--shelf") }));
  lcd.position.set(0, 0.105, 0.006);
  hinge.add(lcd);
  laptop.add(hinge);
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.35, 0.77, 0.08),
    new THREE.Vector3(0.25, 0.765, -0.05),
    new THREE.Vector3(0.12, 0.8, -0.26),
  ]);
  laptop.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 24, 0.004, 6), mat("--shelf")));

  // ---- Black IKEA shelf against the back wall: 2 × 4 cubbies ----
  const shelf = group("shelf");
  const S = { x: -0.8, z: -1.02, w: 0.77, h: 1.47, d: 0.39, t: 0.03 };
  for (const x of [S.x - S.w / 2, S.x, S.x + S.w / 2]) box(S.t, S.h, S.d, "--shelf", x, S.h / 2, S.z, shelf);
  for (let i = 0; i <= 4; i++) box(S.w, S.t, S.d, "--shelf", S.x, (S.h / 4) * i, S.z, shelf);
  const left = S.x - S.w / 4;
  const right = S.x + S.w / 4;
  const row = (i) => (S.h / 4) * i;                            // top surface of shelf i

  // Two paintings leaning in the top row. Placeholders until Luis's own.
  const sunset = painted(256, 280, (g, w, h) => {
    g.fillStyle = token("--wall"); g.fillRect(0, 0, w, h);
    g.fillStyle = token("--dusk"); g.beginPath(); g.arc(w / 2, h * 0.45, w * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = token("--bay"); g.fillRect(0, h * 0.55, w, h * 0.45);
  });
  const blocks = painted(256, 280, (g, w, h) => {
    g.fillStyle = token("--ink"); g.fillRect(0, 0, w, h);
    g.fillStyle = token("--bay"); g.fillRect(w * 0.1, h * 0.1, w * 0.5, h * 0.45);
    g.fillStyle = token("--dusk"); g.fillRect(w * 0.45, h * 0.5, w * 0.45, h * 0.4);
  });
  for (const [map, x] of [[sunset, left], [blocks, right]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.29),
      new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
    p.position.set(x, row(3) + 0.18, S.z - 0.02);
    p.rotation.x = -0.12;
    shelf.add(p);
  }

  // Three figurines in the third row.
  [[left - 0.08, "--dusk"], [left + 0.06, "--bay"], [right, "--wall"]].forEach(([x, name], i) => {
    const tall = 0.12 + i * 0.02;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, tall, 8), mat(name));
    body.position.set(x, row(2) + tall / 2, S.z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(name));
    head.position.set(x, row(2) + tall + 0.025, S.z);
    shelf.add(body, head);
  });

  // The homelab: a small box in the second row. Phase 3 gives it lights and a link.
  const homelab = group("homelab");
  box(0.22, 0.07, 0.2, "--scene-metal", left, row(1) + 0.05, S.z, homelab);

  // ---- The window on the right wall ----
  const win = group("window");
  const W = { x: 1.42, y: 1.45, z: -0.35, w: 0.9, h: 1.0 };
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W.w, W.h),
    new THREE.MeshBasicMaterial({ color: color("--scene-sky") }));
  glass.position.set(W.x, W.y, W.z);
  glass.rotation.y = -Math.PI / 2;
  win.add(glass);
  for (const dz of [-W.w / 2, 0, W.w / 2]) box(0.04, W.h + 0.06, 0.04, "--scene-metal", W.x - 0.01, W.y, W.z + dz, win);
  for (const dy of [-W.h / 2, W.h / 2]) box(0.04, 0.04, W.w + 0.06, "--scene-metal", W.x - 0.01, W.y + dy, W.z, win);

  // ---- Light ----
  scene.add(new THREE.HemisphereLight(color("--scene-sky"), color("--ink"), level.ambient));
  const sun = new THREE.DirectionalLight(color("--scene-light"), level.window);
  sun.position.set(3, 2.2, W.z);
  sun.target.position.set(-0.3, 0.8, -0.2);
  scene.add(sun, sun.target);
  const glow = new THREE.PointLight(color("--scene-screen"), level.screen, 3, 1);
  glow.position.set(0.1, 1.15, 0.3);
  scene.add(glow);

  const off = new THREE.Color(0, 0, 0);
  const lit = color("--scene-screen");

  return {
    camera: { position: new THREE.Vector3(-0.35, 1.55, 2.6), target: new THREE.Vector3(0.2, 1.0, -0.6) },
    anchors: {
      monitor: new THREE.Vector3(0.1, 1.15, -0.06),
      laptop: new THREE.Vector3(0.5, 0.86, 0.1),
      shelf: new THREE.Vector3(S.x, 1.0, S.z + 0.2),
      window: new THREE.Vector3(W.x, W.y, W.z),
      homelab: new THREE.Vector3(left, row(1) + 0.05, S.z + 0.1),
    },
    highlight(name, on) {
      groups[name]?.traverse((o) => {
        if (!o.material?.emissive) return;
        o.material.emissive.copy(on ? lit : off);
        o.material.emissiveIntensity = on ? 0.2 : 0;
      });
    },
  };
}
```

- [ ] **Step 3: Run the scene tests, watch them fail**

Run: `node --test tests/css-tokens.test.js --test-name-pattern="scene"`
Expected: "every token a scene reads" FAILS listing `--scene-desk`, `--scene-metal`, `--scene-screen`, `--scene-sky`, `--scene-light` for each preset. "no raw hex in scene code" PASSES (the file was written without hex; the test guards the future).

- [ ] **Step 4: Add the scene tokens** — in `site/css/tokens/colors.css`

Inside `:root, [data-time="day"] { … }`, after `--rule`, add:
```css
  --scene-sky: #BFDDEF;     /* the 3D window's glass and the sky light */
  --scene-light: #FFF4E0;   /* sunlight through the window */
```
Inside `[data-time="dusk"] { … }`:
```css
  --scene-sky: var(--dusk);
  --scene-light: #F5B36A;
```
Inside `[data-time="night"] { … }`:
```css
  --scene-sky: #1B2A44;
  --scene-light: #5E7FA8;   /* moonlight */
```
And append a new block at the end of the file:
```css
/* ---- The 3D desk — read by js/scenes/desk.js through getComputedStyle ---- */
:root {
  --scene-desk: #B8A58C;    /* the desktop */
  --scene-metal: #A7ADB2;   /* monitor arm, MacBook, window frame */
  --scene-screen: #9FD4C8;  /* the monitor's glow */
}
```
Run: `node --test tests/css-tokens.test.js` → Expected: all PASS.

- [ ] **Step 5: Write `site/js/stage.js`**

```js
/* ============================================================
   stage.js — the 3D desk in the hero. ES module, home page only.

   three.js is the site's one runtime dependency (see CLAUDE.md). It is
   pinned, fetched only after the page's text is on screen, and optional:
   if WebGL is missing or the import fails, the still image and the same
   links stay put, and nothing else on the page notices.
   ============================================================ */
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.186.1/+esm";
const ASPECT = 16 / 10;   // must match .desk { aspect-ratio } in pages/hero.css
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Phones get the lighter version: fixed camera, no antialiasing, 1x pixels.
const SMALL = matchMedia("(max-width: 860px)").matches;
const SWAYS = !REDUCED && !SMALL;

const root = document.querySelector("[data-desk]");
const canvas = root?.querySelector("[data-desk-canvas]");
const spots = root ? [...root.querySelectorAll("[data-spot]")] : [];

// Probe a throwaway canvas: asking the real one would fix its context
// attributes before three.js gets to choose them.
function hasWebGL() {
  try { return Boolean(document.createElement("canvas").getContext("webgl2")); }
  catch { return false; }
}

if (canvas && hasWebGL()) {
  start().catch(() => root.classList.remove("is-live"));   // the still stays
}

async function start() {
  const THREE = await import(THREE_URL);
  const { buildDesk } = await import("./scenes/desk.js");
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !SMALL });
  renderer.setPixelRatio(SMALL ? 1 : Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, ASPECT, 0.1, 50);
  const desk = buildDesk(THREE, scene, document.documentElement.dataset.time || "day", token);
  const home = desk.camera.position.clone();
  camera.position.copy(home);

  let onScreen = true;
  let dirty = true;
  let glide = null;

  new ResizeObserver(() => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    dirty = true;
  }).observe(canvas);

  // Draw only while the desk is on screen. Coming back, reset the camera
  // in case a click glided it toward an object.
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen && !glide) { camera.position.copy(home); dirty = true; }
  }).observe(root);

  // Keep each link on its object as the camera moves.
  const p = new THREE.Vector3();
  const placeSpots = () => {
    for (const a of spots) {
      p.copy(desk.anchors[a.dataset.spot]).project(camera);
      a.style.setProperty("--x", `${(((p.x + 1) / 2) * 100).toFixed(2)}%`);
      a.style.setProperty("--y", `${(((1 - p.y) / 2) * 100).toFixed(2)}%`);
    }
  };

  for (const a of spots) {
    const name = a.dataset.spot;
    const light = (on) => () => { desk.highlight(name, on); dirty = true; };
    a.addEventListener("pointerenter", light(true));
    a.addEventListener("focus", light(true));
    a.addEventListener("pointerleave", light(false));
    a.addEventListener("blur", light(false));
    a.addEventListener("click", (e) => {
      // Reduced motion, or opening in a new tab: plain navigation.
      if (REDUCED || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const from = camera.position.clone();
      const to = from.clone().lerp(desk.anchors[name], 0.35);
      const t0 = performance.now();
      glide = (now) => {
        const k = Math.min(1, (now - t0) / 450);
        camera.position.lerpVectors(from, to, k * k * (3 - 2 * k));
        if (k === 1) { glide = null; location.href = a.href; camera.position.copy(home); }
      };
    });
  }

  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!onScreen || document.hidden) return;
    if (glide) glide(now);
    else if (SWAYS) camera.position.x = home.x + Math.sin(now / 5000) * 0.06;   // slow sway
    else if (!dirty) return;
    camera.lookAt(desk.camera.target);
    placeSpots();
    renderer.render(scene, camera);
    dirty = false;
  };
  requestAnimationFrame(frame);
  root.classList.add("is-live");
}
```

- [ ] **Step 6: Hero markup and scripts** — `site/index.html`

Replace the whole `<header id="top" class="hero">…</header>` with:

```html
    <header id="top" class="hero">
      <h1 class="hero__name">Luis Munoz</h1>
      <!-- The desk. stage.js draws it in 3D over the still. The links work
           either way: the inline --x/--y match the still's framing (printed
           by scripts/render-stills.mjs), and stage.js re-projects them from
           the live camera. -->
      <div class="desk" data-desk>
        <img
          class="desk__still"
          src="./assets/scenes/desk.jpg"
          width="1600"
          height="1000"
          alt="Luis's desk: a Dell monitor on an arm, a MacBook, a window on the right, and a black shelf of paintings and figurines"
        />
        <canvas class="desk__canvas" data-desk-canvas aria-hidden="true"></canvas>
        <nav class="desk__spots" aria-label="Around the desk">
          <a class="desk__spot" data-spot="monitor" href="#log" style="--x: 50%; --y: 40%">Projects</a>
          <a class="desk__spot" data-spot="laptop" href="./blog/" style="--x: 62%; --y: 70%">Writing</a>
          <a class="desk__spot" data-spot="shelf" href="#foundation" style="--x: 22%; --y: 45%">About</a>
          <a class="desk__spot" data-spot="window" href="#contact" style="--x: 88%; --y: 35%">Work with me</a>
        </nav>
      </div>
    </header>
```

After `<script src="./js/main.js"></script>` add:

```html
    <script type="module" src="./js/stage.js"></script>
```

- [ ] **Step 7: Nav labels on every page**

The nav now follows the desk. In `site/index.html` replace the four `nav__link`s and the CTA inside `.nav__links` with:

```html
        <a href="#log" class="nav__link">Projects</a>
        <a href="./blog/" class="nav__link">Writing</a>
        <a href="#foundation" class="nav__link">About</a>
        <a href="#contact" class="nav__cta">Work with me</a>
```
Same four in `site/blog/index.html` with `../#log`, `./`, `../#foundation`, `../#contact`; in `site/404.html` and `site/design/index.html` with `/#log`, `/blog/`, `/#foundation`, `/#contact`.

Verify: `grep -rn ">Log<\|>Stack<\|>Background<\|>Say hi<" site/` → no output.

- [ ] **Step 8: Hero CSS**

Replace `site/css/pages/hero.css` with:

```css
/* pages/hero.css
   Home page hero: the name, then the desk. The desk keeps one aspect ratio at
   every width, so the still, the live canvas and the link positions share one
   framing. ASPECT in js/stage.js must match. */

.hero { padding: 56px 5vw 72px; }
.hero__name {
  max-width: 1100px; margin: 0 auto 28px;
  font: var(--type-display); letter-spacing: var(--tracking-display); color: var(--text);
}
.desk {
  position: relative; max-width: 1100px; margin: 0 auto;
  aspect-ratio: 16 / 10; overflow: hidden;
  border-radius: var(--radius-md); background: var(--surface);
}
.desk__still, .desk__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.desk__still { object-fit: cover; }
.desk__canvas { visibility: hidden; }
.desk.is-live .desk__canvas { visibility: visible; }
.desk.is-live .desk__still { visibility: hidden; }
.desk__spot {
  position: absolute; left: var(--x); top: var(--y); transform: translate(-50%, -50%);
  font: var(--type-label); font-size: 14px; color: var(--text);
  background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-pill);
  padding: 6px 12px; text-decoration: none; white-space: nowrap;
}
.desk__spot:hover { border-color: var(--text); }
```

In `site/css/responsive.css` replace `  .hero__title { font-size: 48px; }` with:

```css
  .hero__name { font-size: 48px; }
  .desk__spot { font-size: 12px; padding: 4px 8px; }
```

- [ ] **Step 9: Look at it and tune the camera**

The preset is read once, when the scene is built, so preview each one with Playwright's
clock rather than by editing `data-time` in the console. Save as `shots.tmp.mjs` in the
worktree root (delete it after), with a server running (`python3 -m http.server 8767 --directory site`):

```js
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--enable-unsafe-swiftshader"] });
for (const [time, iso] of [["day", "2026-07-15T16:00:00Z"], ["dusk", "2026-07-15T22:00:00Z"], ["night", "2026-07-16T03:00:00Z"]]) {
  for (const width of [1440, 390]) {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    await p.clock.setFixedTime(new Date(iso));
    await p.goto("http://localhost:8767/");
    await p.waitForSelector("[data-desk].is-live", { timeout: 30000 });
    await p.waitForTimeout(600);
    await p.locator(".hero").screenshot({ path: `.superpowers/desk-${time}-${width}.png` });
    await p.close();
  }
}
await b.close();
```
Run with `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node shots.tmp.mjs` and read the six images. Check:
- Monitor, MacBook, shelf with paintings and figurines, and the window are all in frame, and no link pill covers another.
- Night reads as a dark room lit by the monitor; day is bright from the window.

If framing is off, change only `camera.position`/`camera.target` and object positions in `desk.js`, and the `LIGHT` amounts. Record the final numbers in the ledger.

- [ ] **Step 10: Run the gate and commit**

```bash
node --test
for f in site/js/*.js site/js/scenes/*.js; do node --check "$f"; done
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tests/a11y.check.mjs
```
Expected: all PASS. (The still doesn't exist yet: `desk.jpg` 404s, which axe doesn't flag; Task 3 adds the check that does.)

```bash
git add site/ tests/css-tokens.test.js
git commit -m "Put Luis's desk in the hero, in 3D

stage.js imports three.js (0.186.1, the one runtime dependency) after the
text paints and draws the desk from js/scenes/desk.js: primitives only,
every colour a CSS token, lit by the time preset. The links to each
section are real <a>s positioned over the objects.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The fallback still

**Files:**
- Create: `tests/serve.mjs`, `scripts/render-stills.mjs`, `site/assets/scenes/desk.jpg` (generated)
- Modify: `tests/a11y.check.mjs`, `site/index.html` (inline `--x`/`--y`)

**Interfaces:**
- Produces: `serveSite() → Promise<{ base: string, close(): void }>` in `tests/serve.mjs`.
- Consumes: Task 2's markup contract.

- [ ] **Step 1: Extract the static server** — `tests/serve.mjs`

Move the server out of `tests/a11y.check.mjs` so `render-stills.mjs` can share it:

```js
/* Serves ./site on a throwaway port for the browser scripts:
   tests/a11y.check.mjs and scripts/render-stills.mjs. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "site");
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".md": "text/markdown", ".ico": "image/x-icon",
};

export async function serveSite() {
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
  return { base: `http://localhost:${server.address().port}`, close: () => server.close() };
}
```

In `tests/a11y.check.mjs`: delete the `createServer`, `readFile`… imports that only the server used (keep `readFile` and `fileURLToPath`, which the axe loader still uses), delete from `const ROOT =` through `const base = \`http://localhost:${server.address().port}\`;`, and put in their place:

```js
import { serveSite } from "./serve.mjs";
const { base, close } = await serveSite();
```
(imports go at the top with the others). Replace `server.close();` at the end with `close();`.

Run: `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tests/a11y.check.mjs` → Expected: 9/9 PASS, unchanged.

- [ ] **Step 2: Failing check — the fallback must show a real still**

In `tests/a11y.check.mjs`, change the `PAGES` tuple to allow options and add the no-WebGL state:

```js
  ["home without WebGL", "/index.html", DAY_ONLY, { noWebGL: true }],
```
(after the `home` entry). Change `for (const [label, path, times] of PAGES) {` to `for (const [label, path, times, opts = {}] of PAGES) {`, and before `await page.goto(…)` add:

```js
  // Simulate a browser with no WebGL: stage.js must leave the still and the
  // links in place, and the still must actually exist.
  if (opts.noWebGL) await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
```
After the `for (const time of times) { … }` loop add:

```js
  if (opts.noWebGL) {
    const still = await page.evaluate(() => {
      const img = document.querySelector(".desk__still");
      return img && img.complete && img.naturalWidth > 0 && !document.querySelector("[data-desk].is-live");
    });
    if (!still) report(`${label}: fallback`, [{ impact: "serious", id: "desk-fallback",
      help: "no WebGL, but the desk still is missing or the live scene claims to be running", nodes: [],
      helpUrl: "https://developer.mozilla.org/docs/Web/API/WebGL_API" }]);
  }
```
Run the check. Expected: `FAIL  home without WebGL: fallback` (no `desk.jpg` yet); everything else PASS.

- [ ] **Step 3: `scripts/render-stills.mjs`**

```js
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
```

- [ ] **Step 4: Render, paste positions, watch the check pass**

```bash
mkdir -p site/assets/scenes
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/render-stills.mjs
```
Expected: `wrote …/desk.jpg` and four lines like `monitor: style="--x: 48.3%; --y: 41.0%"`. Replace each `style="…"` on the matching `a[data-spot]` in `site/index.html` with the printed value. Check the file: `ls -la site/assets/scenes/desk.jpg` → under 250 KB; open it and confirm it shows the desk with no link pills.

Rerun the a11y check → Expected: 10/10 PASS, including `home without WebGL`.

- [ ] **Step 5: Commit**

```bash
git add tests/serve.mjs tests/a11y.check.mjs scripts/render-stills.mjs site/assets/scenes/desk.jpg site/index.html
git commit -m "Give the desk a still for browsers without WebGL

scripts/render-stills.mjs renders it from the real scene and prints the
link positions. The a11y check now audits home with WebGL disabled and
fails if the still is missing.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Docs

**Files:** `CLAUDE.md`, `readme.md`, `docs/FRONTEND-LESSON.md`, `docs/superpowers/specs/2026-09-26-desk-redesign-design.md`

- [ ] **Step 1: `CLAUDE.md`**

- **What this is:** after "no build step and no runtime dependencies**", add: "— with one approved exception: three.js on the home page (see below)".
- **Commands:** add `node scripts/render-stills.mjs     # re-render the desk's fallback still; prints link positions`.
- **Traps that have already bitten:** add:
  - "**The desk has two framings that must agree.** `ASPECT` in `site/js/stage.js` equals `.desk { aspect-ratio }` in `pages/hero.css`, and the inline `--x`/`--y` on the desk links plus `site/assets/scenes/desk.jpg` come from `scripts/render-stills.mjs`. Change `scenes/desk.js` or the camera → rerun it and paste the positions."
  - "**`time.js` is a classic script in `<head>` on purpose.** As a module it would run after parsing and flash day at night."
- **Never:** replace "Add a build step, a framework, or a runtime dependency to `site/` without being asked." with "Add a build step, a framework, or a runtime dependency to `site/` without being asked. The one exception is three.js, approved for the desk redesign: pinned (`three@0.186.1/+esm`), home page only, and optional — the page works without it."
- **Conventions:** in the raw-hex bullet add: "Scene code reads colours from tokens too (`token("--x")` in `js/scenes/`); the test covers it."

- [ ] **Step 2: `readme.md`**

In the file tree, under `site/js/`, add `time.js` (`# Tampa hour → data-time, before first paint`), `stage.js` (`# the 3D desk: three.js, links, sway`) and `scenes/desk.js` (`# the desk, built from primitives`); under `site/assets/` add `scenes/desk.jpg` (`# generated by scripts/render-stills.mjs`); add a top-level `scripts/render-stills.mjs`. In **Design rules**, add a sentence: "The home page hero is a 3D model of the desk (three.js, the one runtime dependency), lit by Tampa's time of day, with a still image when WebGL isn't available."

- [ ] **Step 3: `docs/FRONTEND-LESSON.md`**

- Concept 11: replace "The same API returns in phase 2, where `stage.js` uses it to build each 3D scene only when its section nears the viewport." with "It lives on in `site/js/stage.js`, which uses it to stop drawing the 3D desk while it's scrolled off screen."
- Concept 14: append "The 3D desk is the clearest case on the site: `stage.js` does `await import()` of three.js after the text has painted, and the page is readable and clickable for the whole download."
- Concept 23: replace "and phase 2's scene code will read the same preference." with "and `stage.js` reads the same preference: with reduced motion the desk is drawn but never sways or glides."

- [ ] **Step 4: Spec**

In the spec's **3D architecture** section: change "Under 200 KB of JS over the wire for the homepage" to "Under 210 KB … (three.js alone is 190 KB brotli as a single `+esm` module)"; change `lib/time.js` in the tree to `time.js (classic script in <head>)`. In **Accessibility and fallbacks**, change the fallback bullet to: "No WebGL or a failed three.js import: the still image with the same links. Reduced motion: the live desk, frozen." In **Page structure**, after the hero row, add "Labels are always visible (touch has no hover); hovering or focusing one brightens its object. The homelab box gets its link in phase 3."

- [ ] **Step 5: Verify and commit**

```bash
grep -n "phase 2's scene\|returns in phase 2" docs/FRONTEND-LESSON.md   # → no output
git add CLAUDE.md readme.md docs/
git commit -m "Document the desk, time.js and the three.js exception

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Verify, simplify, open the PR

- [ ] **Step 1: Full gate**

```bash
node --test
for f in site/js/*.js site/js/scenes/*.js; do node --check "$f"; done
python3 newpost.py check && git diff --exit-code site/sitemap.xml
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tests/a11y.check.mjs
```
Expected: all PASS, a11y 10/10.

- [ ] **Step 2: Budget**

```bash
for u in https://cdn.jsdelivr.net/npm/three@0.186.1/+esm; do curl -s -H "Accept-Encoding: br" -o /dev/null -w "three %{size_download}\n" "$u"; done
for f in site/js/main.js site/js/time.js site/js/stage.js site/js/scenes/desk.js; do printf "%s " $f; gzip -9c $f | wc -c; done
```
Expected: total under 210 000 bytes. Over: stop and record a ruling.

- [ ] **Step 3: Look at it, as a visitor**

Screenshots of `/` at 1440 and 390 wide in each preset (use `page.clock.setFixedTime` with 16:00Z day, 22:00Z dusk, 03:00Z night, all July), plus one with `reducedMotion: "reduce"`. Check:
- The desk reads as the room: monitor on its arm, MacBook with a cable, window on the right, shelf with paintings and figurines.
- Night is visibly night; the window matches the preset.
- Tab through the page: each desk link gets a focus ring and its object brightens.
- Clicking "Projects" glides, then lands on `#log`; with reduced motion it jumps straight there.
- No horizontal scroll at 390; pills don't overlap.

- [ ] **Step 4: `/simplify`** on the branch diff; rerun Step 1 after.

- [ ] **Step 5: Final review, then PR**

After the executing-plans final review:
```bash
git push -u origin redesign/phase-2-desk
gh pr create --base redesign/phase-1-identity --title "Desk redesign, phase 2: the 3D desk" --body "…"
```
PR body: what changed (time presets live, the 3D desk, the still fallback, nav follows the desk), the decisions-against-spec table from this plan, test results, and the attribution line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
