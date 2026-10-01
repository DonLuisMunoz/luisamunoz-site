# Portfolio Backlog

Ideas parked for later. Newest at top.

## Blog at luisamunoz.com/blog (Phase 4) — BUILT 2026-08-04
Markdown files in `site/content/posts/`, indexed by `index.json`, rendered
client-side by `site/js/blog.js` (hand-written subset parser, no dependencies).
`/blog/` lists posts, `/blog/<slug>/` shows one (generated per post; `/blog/?p=<slug>` still works). Writing section on the home
page is un-hidden and now data-driven off the same manifest, and it hides
itself when there are no posts. How to write one: `docs/ADD-A-POST.md`.

Deliberately static, not backend-served — the reasoning is in `docs/ARCHITECTURE.md`.

Left open:
- ~~**Pretty post URLs.**~~ and ~~**Per-post share cards.**~~ DONE in #1: `newpost.py` writes
  `site/blog/<slug>/index.html` per post with title, description, canonical and OG tags baked
  in. Still open: a per-post OG *image* — every post shares `og-image.png`.
- **Compose-in-browser.** Considered and rejected 2026-08-04. The Worker serves the repo,
  so a browser editor would need the backend to commit to GitHub, which means a write token
  living on the homelab. `newpost.py` handles the bookkeeping instead and nothing runs.
  Revisit only if writing in VS Code turns out to be why posts don't get written.

## Real GitHub-tied streak (upgrade)
Current streak = days since 2026-07-01, computed in JS (always accurate, never
resets). A true commit streak tied to the GitHub contribution graph is possible
but needs plumbing: GitHub has no CORS-friendly public streak API, and a token
can't be exposed client-side. Options: (a) a scheduled/build-time fetch of the
contributions GraphQL that writes a number into the site, or (b) embed a
third-party streak-stats image (styling won't match the brutalist skin, and it
resets to 0 on a missed day). Revisit when the homelab backend is in play.

## Backend phase — code READY 2026-08-04, not deployed yet
`api/main.py` is written, extended, and tested end to end locally. What changed
in this pass:
- Added the **`tools` field** to the project schema. It was missing, which meant
  that the moment the site read projects from the API instead of the JSON file,
  the whole tag-driven stack section would have gone empty. Includes an
  `ALTER TABLE` migration so an existing database picks the column up.
- Added admin **`GET /api/messages`** so the contact inbox is readable without SMTP.
- Added a per-IP **rate limit** on `POST /api/contact` (the only public write route),
  reading `CF-Connecting-IP` since behind the tunnel the socket IP is Cloudflare's.
- `admin.html` / `admin.js` now have a tools input, separate from tags.

Still to do, and it needs Luis at the homelab terminal:
1. `docker compose up -d --build` on dockerHost.
2. Cloudflare Tunnel public hostname `api.luisamunoz.com` → `http://portfolio-api:8000`,
   added to the tunnel already running on dockerHost (not a second tunnel).
3. Set `ALLOWED_ORIGINS=https://luisamunoz.com` in `api/.env` (CORS blocks it otherwise).
4. Set `API_BASE` in `site/js/config.js`, push, and the contact form stops being a mailto.

Deferred on purpose:
- **Resume link/download** served and versioned by the backend instead of a static PDF.
- **Real GitHub-tied streak** (needs a server-side fetch — see below).

## v2.0 — Visitor-intent landing (self-select)
A warm landing page ("Hi, I'm Luis. What brings you here?") with brutalist
"doors" that route to tailored views. Visitor self-selects — no auto-detection
or fingerprinting (unreliable + privacy issues).

- Paths (start with 2, grow later): **Work** (portfolio, resume, real projects —
  the job-search lead) and **Explore** (learning-in-public log + blog). Possible
  third: **Hub** (personal links: GitHub, LinkedIn, Instagram).
- Homelab is on subdomains, so subpaths (`/work`, `/learn`, `/hub`) are free to use.
- Remember choice in localStorage; offer a "switch view" toggle.
- Watch-outs: don't gate recruiters behind a slow/unclear splash; keep each path
  crawlable for SEO; each view is more content to maintain (reason to start with 2).
- Reuse existing neobrutalist components — not a from-scratch redesign.

Raised 2026-08-04. Deferred in favor of Phase 1-4 fixes on the current single-page site.
