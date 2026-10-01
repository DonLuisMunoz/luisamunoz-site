# Add a blog post

Posts live at **luisamunoz.com/blog**. They're markdown files in the repo, not rows in a
database, so the blog stays up even when the homelab is off.

## The short version

```bash
uv run newpost.py new "A join that returned zero rows"
```

That's it. It creates the markdown file, the image folder, and the manifest entry, then
exits. Nothing keeps running. Write in VS Code, preview with Live Server, push.

```bash
uv run newpost.py check     # validates the manifest, refreshes read times
```

**Why a script and not a server.** Live Server already previews the site and VS Code already
edits markdown, so an authoring server would only duplicate what's open. The one thing worth
automating is the bookkeeping. `newpost.py` uses the standard library only, so `uv run`
installs nothing and finishes in well under a second.

Options:

| flag | does |
|---|---|
| `-c, --category` | `building` or `notes`, defaults to `building` |
| `-t, --tags` | comma-separated |
| `-s, --summary` | the card blurb, can be filled in later |
| `--slug` | override the slug derived from the title |
| `--date` | `YYYY-MM-DD`, defaults to today |
| `--draft` | keep it off the site until you remove the flag |

`check` catches the things that break quietly: a manifest entry with no file, a file with no
manifest entry (invisible to the site), a duplicate slug, an empty summary, a missing
category, a bad date, and images referenced by a post that aren't on disk. It ignores image
examples inside fenced code blocks. It also recomputes read times from the actual word count
and writes them back, so `minutes` is never a guess you have to maintain.

---

The rest of this file is what the script does for you, in case you'd rather do it by hand or
need to fix something it made.

## 1. Write the markdown file

Create `site/content/posts/<slug>.md`. The slug is the URL, so keep it lowercase with
hyphens and no spaces.

```
site/content/posts/a-join-that-returned-zero-rows.md
```

**Don't put the title in the file.** The title, date, and summary live in the manifest
(step 2), so they only exist in one place. The `.md` file is the body and nothing else.
Start straight into the first paragraph.

## 2. Add one entry to the manifest

Open `site/content/posts/index.json` and add an object to the top of the `posts` array.

```json
{
  "slug": "a-join-that-returned-zero-rows",
  "title": "A join that returned zero rows and didn't complain",
  "date": "2026-08-04",
  "category": "building",
  "minutes": 4,
  "summary": "One sentence that makes someone want to read it.",
  "tags": ["SQL", "PostgreSQL", "debugging"]
}
```

| field | required | what it does |
|---|---|---|
| `slug` | yes | must match the `.md` filename, and it's the URL |
| `title` | yes | headline on the post and the card |
| `date` | yes | `YYYY-MM-DD`, used for sorting (newest first) |
| `summary` | yes | the card blurb and the page meta description |
| `category` | no | the filter chips, and the teal chip on the card |
| `minutes` | no | shows as "4 MIN READ" |
| `tags` | no | the little chips |
| `draft` | no | set `"draft": true` to keep it out of the site entirely |

**Why a manifest at all:** a static host can't list a directory. The site has no way to
discover `.md` files on its own, so the manifest is the index. One file, one entry, done.

## Categories

This blog is not tech-only. The site is the personal hub, so a post about anything belongs
here as much as a post about SQL.

Two to start:

- **`building`** — the data and IT work. Projects, bugs, the homelab, what a fix taught you.
- **`notes`** — everything else. Whatever's worth writing down.

**Nothing hardcodes that list.** The filter chips on `/blog` are built from whatever
categories the posts actually declare, the same way the home page's stack bars are built from
whatever tools the projects declare. Write a post with `"category": "reading"` and a
"reading" chip appears on its own. Split `notes` later once you can see what you're actually
writing, instead of guessing now.

The chips stay hidden until there are at least two categories, so one filter never sits there
alone doing nothing.

## 3. Push

```bash
uv run newpost.py check          # do this before every push
git add site/content/posts/ site/assets/posts/ site/blog/ site/sitemap.xml
git commit -m "Post: a join that returned zero rows"
git push origin main
```

Cloudflare builds on push. Check it live at `luisamunoz.com/blog/<slug>/`.

`check` writes a real page per post at `site/blog/<slug>/index.html` with that post's title,
description and share-card tags baked into the HTML, so a link pasted into LinkedIn or Slack
shows the post rather than the generic blog card. Those files are generated — commit them,
never edit them. CI reruns `check` and fails if your commit left anything out of date.

The two newest posts also appear automatically in the **Writing** section on the home page.
That section hides itself when there are no posts, so it can never show placeholders.

---

## What markdown is supported

The renderer is hand-written in `site/js/blog.js` (about 100 lines, no dependencies).
It covers what a technical post actually needs:

- `#` through `######` headings
- paragraphs (a blank line separates them, single line breaks get joined)
- `**bold**`, `*italic*`, `` `inline code` ``
- fenced code blocks with a language label:

  ````
  ```sql
  SELECT 1;
  ```
  ````
- `[links](https://example.com)` (external ones open in a new tab)
- `![images](../assets/posts/<slug>/thing.png)` — relative to `/blog/`. Post pages live one level
  deeper but carry `<base href="../">`, so the same path works on both
- `- bullet` lists and `1.` numbered lists
- `> blockquotes`
- `---` horizontal rules

- pipe tables (`| a | b |` with a `|---|---|` row under the header)

**Not supported:** footnotes, nested lists, HTML inside markdown. Every post is
HTML-escaped before it's parsed, so raw HTML in a post will show up as literal text
rather than render. That's on purpose.

## Preview before you push

Use **VS Code Live Server** and open `site/blog/`. Every path in the site is relative, so it
works whether the server root is the repo (Live Server) or `site/` (Cloudflare). Opening the
file directly with `file://` will not work, because the page fetches JSON and the browser
blocks that.
