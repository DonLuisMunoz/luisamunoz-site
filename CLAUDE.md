# CLAUDE.md

Working notes for Claude Code in this repo. `readme.md` explains the project to a
human; this file is the stuff that is easy to get wrong.

## What this is

`luisamunoz.com` — a personal portfolio and blog. Plain HTML/CSS/JS with **no build
step and no runtime dependencies**, served by an assets-only Cloudflare Worker. An
optional FastAPI + SQLite backend (`api/`) runs in Docker on a homelab behind a
Cloudflare Tunnel and handles the project CMS and contact form. The blog does not
depend on it and must keep working when it is down.

It is also a learning repo. `docs/FRONTEND-LESSON.md` and `docs/BACKEND-LESSON.md`
teach the codebase to its owner, so **when you change something they describe,
update them too** — a lesson that contradicts the code is worse than no lesson.

## Commands

```bash
node --test                     # unit tests (markdown renderer). No install needed.
node --check site/js/<file>.js  # syntax gate — nothing transpiles this code
python3 newpost.py check        # validate blog manifest + refresh read times + rebuild sitemap
python3 newpost.py new "Title"  # scaffold a post
node tests/a11y.check.mjs       # axe-core audit of every page state (see below)
```

The a11y check needs tooling that is deliberately **not** a repo dependency:

```bash
npm install --no-save playwright axe-core && npx playwright install chromium
CHROMIUM_PATH=/path/to/chrome node tests/a11y.check.mjs   # if a browser already exists
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push.

## Conventions that are load-bearing

- **Never write a raw hex value outside `site/css/tokens/`.** The whole palette is
  tokens, which is why fixing every contrast failure on the site was a three-line
  change. Adding `#somehex` to a component breaks that property.
- **`class` is for styling, `data-*` is for JavaScript.** `main.js` queries
  `[data-stack]`, never `.skills`. Renaming a class must never break behaviour.
- **Escape before interpolating into `innerHTML`.** Both `main.js` and `blog.js`
  have an `esc()`; `renderMarkdown` escapes the entire source *before* parsing, so
  a post can never inject markup. Do not reorder that. `.textContent` when you only
  need words on screen.
- **Design rules**: 0px radius, 2–3px solid plum borders, hard offset shadows with
  no blur, hover lifts, active presses, no fades. Full spec in
  `neobrutalism-spec.md`.
- **Accessibility is a gate, not a nice-to-have.** The site is at zero axe
  violations. Keep `:focus-visible` rings, the `<main>` landmark, the skip link,
  and the `prefers-reduced-motion` branches intact. Gold (`--gold`) is a
  fill/border colour only — it cannot pass contrast as small text on cream.

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

## Never

- Commit `api/.env`, tokens, or SMTP credentials. `site/js/config.js` ships to every
  visitor — it holds `API_BASE` and nothing secret, ever.
- Add a build step, a framework, or a runtime dependency to `site/` without being
  asked. The absence of those is the point of the project.
- Add a dependency to make a test pass. `node --test` is built in.
