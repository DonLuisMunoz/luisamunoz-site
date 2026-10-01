# Accessibility — what axe can't see

The site is at zero axe-core violations, and CI keeps it there. That means **no regression**, not
"accessible": automated tooling catches roughly a third of real problems. This file records the
manual pass (#5): what it checked, what axe missed, and what still needs a person.

## What axe missed

Every item below passed axe and was still wrong.

| Finding | Why axe missed it | Fix |
|---|---|---|
| **Terminal `$` prompt at 2.51:1** — teal on plum, in both themes | axe skips text it can't confidently pair with a background; the terminal sits inside an `overflow: hidden` window | New palette token `--teal-light` (7.54:1 on plum) |
| **Every page scrolled sideways at 320px** (WCAG 1.4.10) — 342–541px wide | axe doesn't test reflow at all | Nav wraps under 480px; `.blog__body > * { min-width: 0 }`; `.featured__col` min-width capped; gallery specimen scales |
| **Inline code at 3.17:1 in dark mode** — `style="color: var(--accent)"` hard-coded in `index.html` | It passed in light mode, and the dark audit only arrived with #2 | `var(--text-accent)` — the role, not the palette colour |
| **Contact form status never announced** — "Sending…", "Got it" appear on screen only | It's a missing behaviour, not a malformed element | `aria-live="polite"` on `#form-status` |
| **`>_` mark read aloud as "greater-than underscore"** before the site name, on every page | The mark has text, so it isn't "missing" anything | `aria-hidden="true"` on `.nav__mark` / `.footer__mark` |

The post page's overflow is worth remembering on its own. It wasn't long words: `.blog__body` is a
grid, grid items default to `min-width: auto`, so one long line inside a code block — which has
`overflow-x: auto` — still stretched the whole column. The scrollbar was on the wrong element.

## What was checked and is fine

- **Keyboard**: every focus stop on all six pages, both themes — 110 stops, all show the 3px gold
  ring. Skip link is the first stop and lands on `<main>`. No traps.
- **Headings**: one `h1` per page, no skipped levels.
- **Images**: every `<img>` has an `alt`. (Posts currently contain no images; see below.)
- **Contrast**: a scan of every text node against its actual background, both themes — zero
  failures after the fixes above. This is stricter than axe because it doesn't skip
  ambiguous cases, but it guesses backgrounds by walking up the tree, so it lives in this doc's
  history rather than in CI.
- **Zoom**: 200% (equivalent to a 640px viewport) — no overflow, nothing clipped.
- **Stack bars**: each bar's level is printed as text ("getting reps · 2 projects"), so a
  listener gets the same information as a viewer. The coloured fill is decoration.

## Now in CI

`tests/a11y.check.mjs` runs axe on every page in light **and** dark, and checks that no page is
wider than 320px. Both were added because a manual pass found something they would have caught.

## Still needs a person

These can't be checked from a script, and nobody has done them yet.

- **Listen to a post with a screen reader.** VoiceOver on macOS (Cmd+F5) or NVDA on Windows,
  both free. Start to finish, eyes closed. The page outline should make sense read aloud.
- **`//` kickers.** "// the learning log" is read as "slash slash the learning log". Probably
  acceptable, possibly annoying. Decide by listening, not by guessing.
- **The typing animation.** The terminal retypes a phrase every 95ms. It isn't a live region, so
  it shouldn't chatter — but confirm it with a screen reader running.
- **Alt text quality, going forward.** Every image needs an `alt` that says what the image
  *shows*. `![screenshot](...)` is not alt text. This is a writing habit, not a code check.
