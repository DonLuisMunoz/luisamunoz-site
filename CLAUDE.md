# CLAUDE.md

Working notes for Claude Code in this repo. `readme.md` explains the project to a
human; this file is the stuff that is easy to get wrong.

## What this is

`luisamunoz.com` — a personal portfolio and blog. Plain HTML/CSS/JS with **no build
step and no runtime dependencies** — with one approved exception, three.js on the home
page (see Never) — served by an assets-only Cloudflare Worker. An
optional FastAPI + SQLite backend (`api/`) runs in Docker on a homelab behind a
Cloudflare Tunnel and handles the project CMS and contact form. The blog does not
depend on it and must keep working when it is down.

It is also a learning repo. `docs/FRONTEND-LESSON.md` and `docs/BACKEND-LESSON.md`
teach the codebase to its owner, so **when you change something they describe,
update them too** — a lesson that contradicts the code is worse than no lesson.

## Commands

```bash
node --test                     # unit tests: markdown renderer, time presets + tests/css-tokens.test.js
                                # (contrast in every preset, undefined vars, raw hex). No install needed.
node --check site/js/<file>.js  # syntax gate — nothing transpiles this code
python3 newpost.py check        # validate blog manifest + refresh read times + rebuild sitemap
python3 newpost.py new "Title"  # scaffold a post
node tests/a11y.check.mjs       # axe-core audit of every page state (see below)
node scripts/render-stills.mjs  # re-render the desk's fallback still + link positions in index.html
```

The a11y check needs tooling that is deliberately **not** a repo dependency:

```bash
npm install --no-save playwright axe-core && npx playwright install chromium
CHROMIUM_PATH=/path/to/chrome node tests/a11y.check.mjs   # if a browser already exists
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push.

## How work is tracked

Issues #1–#11 are the backlog, sequenced in #12. Each one is a real change to the repo attached
to a concept in one of the lesson docs. One branch per issue, one PR, `Closes #N`, CI green
before merge. If you change something a lesson doc describes, update the doc in the same PR.

## Two modes, and how to tell them apart

**Work mode is the default.** Answer the question, do the task, report what happened. Ask
nothing except a real blocker — a decision only Luis can make that changes what gets built.
Never ask a teaching question in work mode. Never quiz him on the way to fixing something.

**Lesson mode is opt-in**, entered by `/lesson` (see `.claude/skills/lesson/SKILL.md`) or by him
asking to be taught. While it is on, **every reply begins with**:

```
━━━ LESSON MODE ━━━
```

No banner means work mode, and it means any question in that reply is a genuine blocker rather
than a prompt to think. That distinction is the whole point — teaching questions arriving mid-
deploy are disruptive, and he asked for a way to see which mode he is in at a glance.

Lesson mode ends the moment he asks for something to be **done** — code written, a PR opened,
CI checked, a branch merged. Drop the banner and do the work. Do not ask permission to exit and
do not get a last question in. Open threads are recorded below; the next session picks them up.

When in doubt, work mode. A missed teaching moment costs nothing; an unwanted quiz costs focus.

## Lesson plan

Luis is learning this codebase, not just maintaining it. The lesson docs are the reference;
issues #1–#11 and #13 are the work. This section is how to teach, and it matters more than the
docs do — a session that just explains things produces someone who nods and can't rebuild it.

### Where he actually is

Evidence from working sessions, not assumption. Update this as it changes.

- **Solid.** HTML is not the DOM (Layer 1, concept 1) — reasoned out unprompted that project data
  can't be in the HTML because it doesn't exist at authoring time. Graceful degradation
  (concept 17) — worked out that an empty `<span>` mid-sentence is a visible defect while an
  empty `<div>` section is invisible, and why only one needs a hardcoded fallback.
- **Corrected once, watch for it.** Framed runtime data loading as "saving resources." It costs
  more, not less — one request becomes two and the paint is later. What it buys is flexibility.
  He conflates *performance* with *maintainability*; separate those explicitly when they come up.
- **Open.** Async and the single thread (Layer 4, concepts 12–14). He was asked what a visitor
  sees during a blocking `fetch` and has not answered. Do **not** re-ask it in work mode — raise
  it only in a lesson session. The typing effect is gone (redesign, phase 1). New scaffold: a 200ms
  synchronous loop runs on click; ask what happens to the nav hover state and a second click
  during it, then contrast with `await fetch` in `loadProjects()`.

### How a session runs

- **Diagnose first.** One calibrating question, not three. Skip it only when he's already shown
  where he is.
- **One focused question per turn, with one scaffold** that moves him forward regardless of how
  he answers — a narrowed hint, a parallel example, a timeline, a restatement of what he got
  right. Never a wall of questions. Never an empty turn.
- **Do not hand over answers under pressure.** If he pushes, narrow the question until it's
  nearly rhetorical, or work a parallel example and ask him to apply the method. He's engaged and
  capable; impatience here is not the same as being stuck. Give a real foothold only when he
  repeats a wrong idea, goes quiet, or says he has no idea.
- **Say when he's got it, and stop.** Don't keep probing past understanding.
- **Praise only what's earned, specifically.** He notices real things — "there's a lot of beige"
  turned into #13 — and generic encouragement is worse than none.
- **Ship-shaped.** Every concept has an issue attached. The lesson is done when the PR merges,
  not when he can recite it.

### Sequence, and what each issue is really testing

| Do | Issue | The concept it actually tests |
|----|-------|-------------------------------|
| 1 | #3 Copy button | You can't select an element JS hasn't created yet (delegation) |
| 2 | #4 Tables, test-first | A parser is all edge cases; tests are a design tool, not a chore |
| 3 | #13 Palette audit — superseded by the desk redesign (spec 2026-09-26) | A token nobody references is documentation, not architecture |
| 4 | #2 Dark mode — becomes the day/dusk/night presets (phase 2) | Custom properties are live in the cascade, not compile-time substitution |
| 5 | #1 Per-post URLs | A DOM fix works for humans and fails for crawlers |
| 6 | #7 API tests | Parameterised queries and bearer auth, proven rather than asserted |
| 7 | #6 Deploy | The tunnel makes an *outbound* connection — that's why no ports open |
| 8 | #8 → #10 → #9 | CORS as a browser rule; why a secret can't ship to the client |
| 9 | #11 v2.0 | Scope control on a change with no natural edge |

#5 (manual accessibility) interleaves anywhere — it needs no code and no deploy.

### Recall, not re-reading

Re-reading a lesson doc feels like learning and isn't. Before he starts a new issue, ask **one**
question drawn from an issue he finished two or three back — not the last one. Spacing and
interleaving are what make it stick; blocking one topic until it feels easy does not.

Good recall prompts are about *why the code is shaped this way*, never definitions:

- Why is `computeStack()` a `function` declaration when everything else became an arrow?
- Why does an empty list from the API count as a failure?
- Why did adding an `input:focus-visible` rule not restore the focus ring?
- Why can dusk be a button fill but never small text on the wall?

### Misconceptions to watch for

- Performance and maintainability treated as the same axis (see above)
- "If it's not in `index.html`, it's not on the page" — half this site is built at runtime
- Assuming a fix works because it's later in the file; specificity decides, not source order
- Reading zero axe violations as "accessible" — it means no regression, roughly a third of what
  matters is not machine-checkable

## Conventions that are load-bearing

- **CSS is layered, and `styles.css` import order is load-bearing.** `tokens` → `base` →
  `components/` (reusable) → `pages/` (this site only) → `responsive.css` → `components/a11y.css`.
  Several rules across those layers tie on specificity, and a tie is decided by source order —
  reordering the imports to tidy them up will silently change rendering. A new reusable component
  goes in `components/` and gets added to `/design/`; anything only this site uses goes in `pages/`.
- **Never write a raw hex value outside `site/css/tokens/`.** The palette is five room
  colours and three time presets in `tokens/colors.css`; components use semantic tokens
  (`--text`, `--ground`, `--link`…) so a preset change recolours everything.
  `tests/css-tokens.test.js` fails on a raw hex or an undefined `var()`. Scene code reads
  colours from tokens too (`token("--x")` in `js/scenes/`); the test covers it.
- **`class` is for styling, `data-*` is for JavaScript.** `main.js` queries
  `[data-stack]`, never `.skills`. Renaming a class must never break behaviour.
- **Escape before interpolating into `innerHTML`.** Both `main.js` and `blog.js`
  have an `esc()`; `renderMarkdown` escapes the entire source *before* parsing, so
  a post can never inject markup. Do not reorder that. `.textContent` when you only
  need words on screen.
- **Design rules**: the room palette, Recursive only, sentence case, 1px `--rule`
  borders with small radii, no shadows, no scroll reveals, motion only in answer to the
  visitor. The source of truth is **`site/design/index.html`** (served at `/design/`),
  which renders every component from the real stylesheet. `neobrutalism-spec.md` no
  longer describes this site.
- **Accessibility is a gate, not a nice-to-have.** The site is at zero axe
  violations. Keep `:focus-visible` rings, the `<main>` landmark, the skip link,
  and the `prefers-reduced-motion` branches intact. `--dusk` is a fill
  colour only — 1.64:1 on `--wall`. Contrast must pass in all three presets; the a11y
  check audits dusk and night.

## Traps that have already bitten

- **`computeStack()` must stay a `function` declaration.** `loadProjects()` calls it
  before its line in `main.js` and relies on hoisting. A `const computeStack = ...`
  is a `ReferenceError`. There is a comment saying so; leave it there.
- **Specificity beats source order.** `.field input:focus` (0-2-1) out-specifies
  `input:focus-visible` (0-1-1). Appending a fix lower in the file does not
  override a higher-specificity rule — change the original rule.
- **An empty API response is a fallback, not a success.** A fresh backend answers
  `200` with `[]`. `loadProjects()` treats that as a miss and falls back to
  `data/projects.json`, or the log and stack bars would empty out the moment
  `API_BASE` was set.
- **`site/sitemap.xml` is generated.** Edit `write_sitemap()` in `newpost.py`, never
  the XML. CI fails if a run of `newpost.py check` leaves the tree dirty.
- **`site/404.html` uses absolute paths.** It is served for any unmatched URL at any
  depth, so `./css/...` would 404 from `/blog/nope/`.
- **The desk has two framings that must agree.** `ASPECT` in `site/js/stage.js` equals
  `.desk { aspect-ratio }` in `pages/hero.css`, and the inline `--x`/`--y` on the desk links
  plus `site/assets/scenes/desk.jpg` both come from `scripts/render-stills.mjs`. Change
  `scenes/desk.js` or the camera → rerun it; it rewrites both.
- **`project()` needs a fresh camera matrix.** `stage.js` calls `camera.updateMatrixWorld()`
  before placing the links; `render()` only refreshes it afterwards, so a desk that draws one
  frame (phones, reduced motion) put every link in the wrong place.
- **`time.js` is a classic script in `<head>` on purpose.** As a module it would run after
  parsing and flash day at night.

## Never

- Commit `api/.env`, tokens, or SMTP credentials. `site/js/config.js` ships to every
  visitor — it holds `API_BASE` and nothing secret, ever.
- Add a build step, a framework, or a runtime dependency to `site/` without being
  asked. The absence of those is the point of the project. The one exception is three.js,
  approved for the desk redesign: pinned (`three@0.186.1/+esm`), home page only, and
  optional — the page works without it.
- Add a dependency to make a test pass. `node --test` is built in.
