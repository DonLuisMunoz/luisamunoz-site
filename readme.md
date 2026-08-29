# Luis — Portfolio (Learning in Public)

**luisamunoz.com** — Luis's personal hub and home base. It branches out to GitHub (code),
LinkedIn (professional), and Instagram (personal), and it carries the portfolio, the learning
journal, and the blog, with the job search as the practical lead.

**Plain HTML/CSS/JS**, no build step, served by a Cloudflare Worker (`my-website`). An
optional **Python (FastAPI)** backend on dockerHost handles the project CMS and contact form.
The blog does not depend on it.

## Folder structure

```
portfolio-system/
├── site/                     # FRONTEND → served by the `my-website` Cloudflare Worker
│   ├── index.html            # the portfolio page (semantic, classed, no inline styles)
│   ├── admin.html            # private panel to add/edit/delete projects (noindex)
│   ├── blog/
│   │   └── index.html         # /blog — post list, and single posts via ?p=<slug>
│   ├── css/
│   │   ├── styles.css         # the ONE entry point — imports everything below
│   │   ├── components.css     # all neobrutalist component classes
│   │   └── tokens/            # shared design tokens (colors, type, spacing, fonts)
│   ├── js/
│   │   ├── config.js          # ← set API_BASE here (the only knob)
│   │   ├── main.js            # typing, streak, reveal, project render, contact form
│   │   ├── blog.js            # markdown renderer + the /blog views (no dependencies)
│   │   └── admin.js           # CRUD client for the admin panel
│   ├── content/
│   │   └── posts/             # blog posts as .md + index.json manifest
│   ├── data/
│   │   └── projects.json      # project data (static fallback / no-backend source)
│   └── assets/                # logos, favicon, og image
│       └── posts/             # post images, one folder per slug
│
├── newpost.py                 # scaffold + check posts (uv run newpost.py new "Title")
│
├── api/                       # BACKEND → Docker on dockerHost, via the EXISTING tunnel
│   ├── main.py                # FastAPI: projects CRUD + contact + messages + health
│   ├── pyproject.toml         # the only dependency list (uv installs straight from it)
│   ├── Dockerfile             # uv, not pip
│   ├── docker-compose.yml     # works from the CLI or a Portainer repository stack
│   └── .env.example           # copy to .env, fill secrets (never commit .env)
│
├── docs/
│   ├── ARCHITECTURE.md        # what runs where, and why the blog is static
│   ├── DEPLOY.md              # the Worker (done) + the backend (CLI or Portainer)
│   ├── ADD-A-PROJECT.md       # how to add/update a project (admin or JSON)
│   ├── ADD-A-POST.md          # how to write a blog post (markdown + manifest)
│   ├── BACKEND-LESSON.md      # learn the backend (reinforcement-coach Phase 1)
│   └── FRONTEND-LESSON.md     # learn the frontend (same method, five layers)
│
├── neobrutalism-spec.md       # authoritative component + interaction spec
└── readme.md
```

## Quick start

- **Just see it:** VS Code Live Server on `site/index.html`. Every path is relative, so it
  works whether the server root is the repo or `site/`. `file://` won't work, because the
  pages fetch JSON and the browser blocks that.
- **Add a project:** see `docs/ADD-A-PROJECT.md`.
- **Write a post:** `uv run newpost.py new "Title"`, then see `docs/ADD-A-POST.md`.
- **Go live:** follow `docs/DEPLOY.md` (frontend first, backend optional).
- **Understand the backend:** `docs/BACKEND-LESSON.md`.
- **Understand the frontend:** `docs/FRONTEND-LESSON.md`.

## Design rules (Neo-Brutalist)

0px radius · 2–3px solid plum borders · hard offset shadows (no blur) · hover lifts, active
presses, no fades. All color/type/spacing come from `site/css/tokens/` — edit tokens, never
raw hex in the HTML. Full module set in `neobrutalism-spec.md`.

## Brand tokens

brand = gold `#E0A92E` · accent = terracotta `#AC4622` · success = teal `#27695C` ·
ink/border = plum `#2B1B2E` · surface = cream `#F2E4C9` / paper `#FBF3E2`.
Terracotta and teal are the WCAG-AA-corrected values (was `#C8542B` / `#2E7D6F`, both of
which failed 4.5:1 as small text). Gold is a fill/border colour only — never small text.
Type: Space Grotesk (display), JetBrains Mono (UPPERCASE labels), Public Sans (body).
