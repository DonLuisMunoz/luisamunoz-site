# Desk redesign — design spec

Date: 2026-09-26 · Status: awaiting review

## Why

The frontend-design audit found the current site reads as a template: cream and terracotta,
zero-radius neobrutalism, `//` kickers and uppercase mono labels, fade-up reveals on every
section. It also leans on "learning in public", which no longer fits.

The site becomes a **personal home base first**, freelance second, hiring third. It should feel
like Luis's actual room, not a portfolio kit.

## Success criteria

- Every section opens with its own 3D scene; the content beside it is plain HTML.
- The site is fully usable with WebGL off, three.js failing to load, JS off for content, or
  `prefers-reduced-motion` on.
- `node --test` passes; `node --check` passes on every JS file; axe reports zero violations in
  every page state, including all three times of day and the no-WebGL fallback.
- No horizontal scroll at 390px. Keyboard reaches every area.
- `/blog` keeps working when the API is down. The Instagram frames and homelab status degrade
  on their own; nothing else depends on the API.
- The lesson docs and CLAUDE.md describe the code as it is after each phase.

## Concept

The site is Luis's desk in Tampa. **The window tells the time:** every scene is lit by Tampa's
current hour (America/New_York), so each visitor sees the room as it is right now.

| Preset | Hours | Light |
|---|---|---|
| day | 07:00–16:59 | sun through the window |
| dusk | 17:00–19:59 | amber, low, across the shelf |
| night | 20:00–06:59 | dark room, the monitor is the key light |

The preset is written to `<html data-time="day|dusk|night">`, and the CSS tokens follow it, so
the HTML sections match the scene. This replaces the dark-mode toggle idea in #2.

## Identity

### Colour

Taken from the room. Replaces the cream and terracotta palette.

| Token | Hex | Source | Rule |
|---|---|---|---|
| `wall` | `#DCE3E6` | daylight on a pale wall | page ground (day) |
| `ink` | `#18222E` | deep navy | text (day); ground (night) |
| `bay` | `#1F6B85` | Tampa Bay water | links, focus rings |
| `dusk` | `#F0A04B` | sunset through the window | fills and large type only, never small text on `wall` |
| `shelf` | `#232326` | the black IKEA shelf | dark surfaces |

Each time preset defines the same semantic tokens (`--ground`, `--text`, `--text-soft`,
`--link`, `--surface`). Contrast is checked per preset; a pair that fails in any preset is not
used.

### Type

One family, **Recursive** (Google Fonts, variable):

- `MONO 0, CASL 0` for reading text and headings
- `CASL 1` for handwritten-style notes on shelf items
- `MONO 1` for code (the JOIN bug)

Sentence case everywhere. No `//` kickers, no tracked uppercase labels, no `→` on buttons.
`↗` stays on links that leave the site, because it carries information.

### What goes

The neobrutalist rules: 3px plum borders, hard offset shadows, hover lifts, per-section
`data-reveal` fades. The `/design/` gallery, the design-system artifact and the "Design rules"
and colour conventions in CLAUDE.md are rewritten to the new system in phase 1.

## Page structure

Navigation, left to right like the desk: **Projects · Writing · About · Homelab · Work with me.**

| Section | Scene | Areas |
|---|---|---|
| Hero | The desk: Dell monitor on its arm, MacBook plugged into it, window to the right, black IKEA shelf in front | — |
| Projects | Tampa as data, plus one plinth per other project | one per project |
| Writing | index cards floating over the MacBook | one per post |
| About | the IKEA shelf at full size | each painting, each figurine, the Instagram frames |
| Homelab | the server box up close, cables, live activity lights | the server |
| Work with me | the view out the window: bay, skyline, sky set by the hour | IT for small businesses; data and reporting |

**Hero interaction:** hovering or focusing an object shows its section name; clicking it
scrolls to that section.

**Hero copy:** the name "Luis Munoz" and the nav. No statement. Each section introduces itself.

**Hero labels** are always visible (touch has no hover); hovering or focusing one brightens its
object. The homelab box gets its link in phase 3, when its section exists.

**Links:** LinkedIn, GitHub and Instagram as profile links in About. munozit-website is out of
scope and not linked.

## 3D architecture

three.js is the single runtime dependency, loaded as an ES module from jsDelivr at one pinned
version, on the homepage only. The blog stays dependency-free. CLAUDE.md records this as the one
exception to "no runtime dependencies".

```
site/js/
  stage.js            one renderer, one fixed canvas, scissor per section,
                      time-of-day lighting, visibility + lazy build
  scenes/
    desk.js           hero
    projects.js       areas from project data; tampa columns
    writing.js        index cards from the post manifest
    about.js          shelf, paintings, figurines, instagram frames
    homelab.js        server box + activity lights
    window.js         bay and skyline
  lib/
    time.js           Tampa hour -> preset (lives at js/time.js: a classic <head> script)
    health.js         pure: health result -> light state
    areas.js          pure: items -> area positions, default object
```

- **One WebGL context.** One fixed canvas behind the page; each scene renders into its own
  section's rectangle (the three.js "multiple elements" technique). Browsers cap live contexts,
  so separate canvases per section are ruled out.
- **Lazy.** A scene is built when its section nears the viewport and does not draw while
  offscreen or while the tab is hidden.
- **Geometry in code.** Boxes, cylinders and planes with flat palette colours. No model files,
  no loaders. Paintings and Instagram photos are image textures.
- **Budget.** Under 210 KB of JS over the wire for the homepage, most of it three.js (190 KB
  brotli on its own, as a single `+esm` module — the package ships no minified build).

### Areas and scrolling

Scrolling through a section pans that scene's camera from area to area; the matching HTML card
sits beside the scene. With reduced motion the camera cuts between areas instead of gliding. On
phones the scene is pinned in the top part of the viewport and the cards scroll beneath it.

Areas are built from data. Projects read the same source as today (`projects.json` or the API),
so adding a project adds an area. Each project may carry an optional `object` field; without it
the area gets the default object, a plinth with the project title. Only Tampa has a custom
object in this spec.

### Tampa data

Rent burden per ZIP = `rent_avg * 12 / income_estimate_avg`, read from
`vw_affordability_zip_year_fl_hillsborough` in the `affordability` Postgres database (48
Hillsborough ZIPs, 2015–2024; county average 24.8% in 2015, peaking at 31.5% in 2022).

A one-off script exports it with ZIP centroids from the Census ZCTA gazetteer to
`site/data/tampa-burden.json` (`[{zip, lat, lon, burden: {year: value}}]`), committed as a
static file. The site never queries the database. Column height is burden; the section's text
names the year shown.

### Motion

Motion that runs without input is limited to: the hero's slow camera sway and the homelab
activity lights. Everything else answers the visitor: pointer parallax, hover lift on index
cards, the scroll-driven camera. Reduced motion freezes the sway and the flicker and turns
camera moves into cuts.

### Homelab activity lights

The API runs on the homelab, so `/api/health` answering means the homelab is up.

| Result | Power LED | Activity LEDs | Label |
|---|---|---|---|
| 2xx within 3s | solid green-teal | flicker at random intervals | Homelab is online |
| error or timeout | amber | off | Homelab is offline right now |
| `API_BASE` empty | amber | off | Homelab is offline right now |

One request after the scene is visible, no polling. Reduced motion keeps the colours and drops
the flicker. The result affects nothing outside the homelab scene and the status line.

### Accessibility and fallbacks

- The canvas is `aria-hidden`. Every area and every hero object has a real `<button>` or link
  positioned over it, in DOM order, with a visible focus ring.
- No WebGL or a failed three.js import: each section shows a still image of its scene with the
  same links. One still per scene (day lighting), rendered once from the real scene by
  `scripts/render-stills.mjs` and committed to `site/assets/scenes/`. Reduced motion: the live
  scene, frozen — no sway, no glide.
- The content is HTML, so crawlers, screen readers and no-JS visitors get all of it.

## Instagram

Uses the Instagram API with Instagram Login; the account must be Creator or Business. Verify the
current Meta docs before building, since these rules change.

- The long-lived token lives in `api/.env` only. It never reaches `site/`.
- New endpoint `GET /api/instagram` returns the latest 6 posts (image URL, permalink, caption),
  cached server-side for an hour.
- The backend refreshes the 60-day token before it expires.
- The About scene shows the posts as framed prints. On any failure the frames and the HTML list
  are hidden; the rest of About is unaffected.

LinkedIn is a profile link only. Reading a person's own posts requires partner-only access.

## Kept deliberately

- `computeStack()` and the stack tally survive, moved into Projects as "Tools I've shipped
  with". It is a load-bearing trap and a recall prompt in CLAUDE.md.
- `loadProjects()` behaviour, including "an empty API response is a fallback".
- `esc()` before `innerHTML`; `class` for styling, `data-*` for JS; the skip link, `<main>`,
  `:focus-visible`.
- The contact form and its API contract.
- The blog renderer and manifest. `/blog` only gets the new tokens and type.

## Removed

The "learning in public" badge, the terminal, the typing effect, the currently/streak strip,
the IT foundation tag wall (becomes one paragraph in About), per-section `data-reveal`.

The lesson docs lose the typing-effect and streak examples. The async lesson (Layer 4) moves to
async that is real on the new page: three.js importing after the text renders, and the health
check. The open lesson question in CLAUDE.md is rewritten to use them.

## Testing

- **Unit, test-first** (`node --test`, no new dependencies): `time.js` including boundary
  hours and DST; `lib/health.js` for online, error, timeout and no `API_BASE`;
  `lib/areas.js` for positions and the default object.
- **Syntax:** `node --check` on every new file.
- **Accessibility:** `tests/a11y.check.mjs` adds states for `data-time` day, dusk and night, and
  for the no-WebGL fallback.
- **Visual:** screenshots at 390px and 1440px reviewed after each phase.
- **`/simplify`** on each phase's diff before its PR.

## Phases

One branch and one PR per phase, CI green before merge. The site works after every phase.

1. **Identity.** Tokens per time preset, Recursive, neobrutalism removed, the terminal,
   typing effect, streak strip and badge deleted, `/design/`, CLAUDE.md and lesson docs
   updated. No 3D yet.
2. **Stage and hero.** `stage.js`, `time.js`, the desk scene, the fallback still, the
   three.js exception in CLAUDE.md.
3. **Homelab.** Scene and live activity lights (`lib/health.js`).
4. **Projects.** Areas (`lib/areas.js`), Tampa export script and columns, the stack tally.
5. **Writing.** Index cards from the manifest.
6. **Work with me.** The window view and the two service areas.
7. **About.** Shelf, placeholder paintings and figurines, profile links.
8. **Instagram.** Backend endpoint, token refresh, frames on the shelf.

## Effect on the existing plan

This supersedes #13 (palette audit) and #2 (dark mode, now the time presets). The sequence
table in CLAUDE.md is updated in phase 1 to say so; the rest of #1–#11 are unchanged.

## Open, with placeholders until answered

- What the paintings and figurines are. Placeholders ship in phase 7.
