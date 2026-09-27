# How to add / update a project

The learning-log cards (the grid under the FEATURED entry) are **data-driven** — you never
hand-edit `index.html` to add one. There are two ways depending on whether the backend is up.

## tools vs tags — the one thing to get right

Every project has both, and they do different jobs.

- **`tools`** drives the **stack bars**. `main.js` counts how many projects list each tool and
  ranks the bars by reps. A project saved with an empty `tools` contributes nothing to the
  stack, silently. No error, the bar just doesn't move.
- **`tags`** are display-only chips on the card. They're concepts (`joins`, `window functions`),
  not tech.

Rule from the last pass, still holds: `tools` is for **new data skills being leveled up**
(SQL, PostgreSQL, Python, Power BI). Owned IT skills (Docker, Proxmox, Active Directory) do
**not** go in `tools`. They live in the IT foundation section, because a "starting out" bar
next to Docker reads junior and undersells ten years of work.

---

## Way 1 — the Admin panel (needs the backend running)

1. `API_BASE` is set in `site/js/config.js` and the API is up
   (`curl https://api.luisamunoz.com/api/health` → `{"ok":true}`).
2. Open **`https://luisamunoz.com/admin.html`**.
3. Paste the **admin token** (`ADMIN_TOKEN` from `api/.env`) into the token box.
4. Fill in **Title**, **Meta line** (e.g. `2026 · LOG #05`), **Description**, **Tools**,
   **Tags**, and the repo URL. Leave the URL blank if there's no repo — an empty URL hides the
   button, which is how you avoid shipping a dead "view the code" link.
5. Hit **save project →**. It appears on the home page immediately.

Edit and delete work from the same page. The token is sent as an auth header per request and
is never stored.

**If the panel misbehaves:**

| symptom | cause |
|---|---|
| "Set API_BASE in js/config.js" | `API_BASE` is still `""` |
| "Could not reach the API." | API down, or the site's domain isn't in `ALLOWED_ORIGINS` (check the console for a CORS error) |
| "Bad token." | token mismatch with `api/.env` |
| saved fine, but a stack bar didn't move | the project was saved with an empty **Tools** field |

> `/admin.html` has `noindex` and every write needs the token, which is enough for a personal
> portfolio. A real login is a natural next Python lesson.

## Way 2 — edit the JSON file (no backend needed)

Running fully static, edit **`site/data/projects.json`** and commit. Each project is one object:

```json
{
  "id": "olist-sql",
  "meta": "2026 · LOG #05",
  "title": "Olist SQL Analysis",
  "body": "What you built and the lesson that stuck.",
  "tools": ["SQL", "PostgreSQL"],
  "tags": ["joins", "window functions"],
  "url": ""
}
```

- `id` must be unique (lowercase-with-dashes).
- `tools` and `tags` are lists. `[]` for none, but an empty `tools` means no stack credit.
- `url` is the repo/demo link. `""` hides the button. **Never link a repo that doesn't exist yet.**
- Newest goes at the **top** of the array.

Push to GitHub, and the `my-website` Worker auto-deploys.

> The API and the JSON file are two separate stores. Pick one as the source of truth so they
> don't drift. With the backend live the API wins and the JSON file is the offline fallback,
> which means it's also what visitors see if dockerHost is down. Worth keeping roughly current
> either way.

---

## Updating other parts of the page

Most of this page stopped being hand-edited during the 2026-08-04 phases. What's still manual:

| You want to change | Where | What to edit |
|---|---|---|
| The FEATURED highlight | `index.html`, `<!-- featured entry` | Title, body, tags, the two code blocks. **Also update `data-tools="..."` on the `<article>`** — the featured project isn't in `projects.json`, so that attribute is how its tools reach the stack tally. |
| IT foundation chips | `index.html`, `id="foundation"` | The `.tag` chips and the note under them (`.foundation-note`) |
| Social links / email | `index.html`, `class="contact__links"` | `href` on each button |
| "next up" tools | `site/js/main.js` | the `STACK_NEXT` array |

**Computed, so don't hand-edit them:**

- **Stack XP bars** (`id="stack"`) — built by `main.js` from every project's `tools` plus the
  featured block's `data-tools`. There is no width to set. Ship a project using a tool and its
  bar grows on its own.
- **Blog cards** (`id="writing"`) — the two newest posts from
  `site/content/posts/index.json`. See `docs/ADD-A-POST.md`. The section hides itself when
  there are no posts.

All colors, fonts and spacing come from `site/css/tokens/`. Change a token once and it updates
everywhere. Don't paste raw hex into the HTML.
