# Frontend, the learning way

Same deal as `BACKEND-LESSON.md`, for the other half of the repo. This is **Phase 1**: the
concepts to actually understand in `site/`. Read it, then ask me to run the active-recall quiz
in chat — I'll grade you one question at a time.

The frontend isn't one subject. It's five layers, and this repo has a clean example of each:
the document (`index.html`), the cascade (`css/`), the DOM (`main.js`), the network (the `fetch`
calls), and parsing (`blog.js`). The concepts below are grouped that way, plus one cross-cutting
set on accessibility — every item in it was a real, measured failure on this site before it was
a lesson.

## Layer 1 — The document

1. **HTML is not the DOM.** This is the single most important idea on this page. `index.html`
   ships `<div data-reveal class="skills" data-stack></div>` — an *empty div*. Every stack bar
   you see on the live site was created by JavaScript after the page loaded. **View Source**
   shows the HTML file the server sent; **Inspect Element** shows the DOM, the live tree the
   browser built and JS has been mutating since. They are different things, and confusing them
   is why "but it's not in my HTML!" is such a common dead end.

2. **Semantic elements.** `<article>`, `<section>`, `<h3>` describe *what a thing is*, not what
   it looks like. A screen reader announces `<article>` as an article; it announces a styled
   `<div>` as nothing. Search engines read the same signal. `card__title` being an `<h3>` is a
   meaning decision; the size it renders at is a CSS decision.

3. **The `<head>` is instructions, not content.** Nothing in it is drawn. `<link rel="preconnect"
   href="https://fonts.gstatic.com">` opens the TCP+TLS handshake to the font server *early*, so
   the font request doesn't pay for it later. The stylesheet `<link>` is **render-blocking** —
   the browser refuses to paint until it's parsed, deliberately, so you never see unstyled text.

4. **Script position and timing.** `main.js` is loaded at the *bottom* of `<body>` (line 388), not
   in the head. If it ran in the head it would execute before the elements it queries exist, and
   every `querySelector` would return `null`. The modern alternative is `<script defer>` in the
   head, which lets the browser download the file early but still run it after parsing.

## Layer 2 — The cascade

5. **The cascade and specificity.** When two rules target the same element, the winner is decided
   by specificity (how specific the selector is), then source order. This is why `components.css`
   works without a single `!important` — the selectors are all roughly equal weight, so ordering
   does the work. `!important` is what you reach for when you've lost track of this, not a tool.

6. **Custom properties are live values, not find-and-replace.** `--brand: #E0A92E` in
   `css/tokens/colors.css` is a *real value in the cascade* that the browser resolves at runtime
   and inherits down the tree. That's categorically different from a Sass variable, which is
   compiled away before the browser ever sees it. Because these are live, JS can change one with
   `style.setProperty('--brand', ...)` and every element using it repaints. This is the whole
   reason "edit tokens, never raw hex" actually holds.

7. **The box model, and `border-box`.** An element's width is content + padding + border. With
   `box-sizing: border-box`, `width: 300px` means the *whole thing* is 300px, padding and border
   included. This matters more than usual here: 3px solid borders on every component would
   otherwise silently make everything 6px wider than the number you typed.

8. **Flexbox vs. Grid.** Flexbox lays out along *one* axis (a row of tags, a nav bar). Grid lays
   out along *two* at once (the project card matrix). Picking the wrong one is the most common
   source of layout code that fights back.

## Layer 3 — The DOM

9. **Two kinds of hooks, kept separate.** `<div data-reveal class="skills" data-stack>` carries
   `class` for *styling* and `data-*` for *JS targeting*. `main.js` queries `[data-stack]`, never
   `.skills`. That separation means you can rename a class for visual reasons without silently
   breaking the JavaScript. It's a deliberate convention, and a good one.

10. **Events and the listener.** `form.addEventListener("submit", fn)` registers a callback the
    browser invokes when that event fires. `e.preventDefault()` in the contact handler stops the
    browser's built-in behavior (a full page navigation) so JS can send it via `fetch` instead.

11. **`IntersectionObserver`.** The reveal-on-scroll effect doesn't poll the scroll position —
    that would run hundreds of times a second and stutter. It hands the browser a list of
    elements and a callback, and the browser reports back when one enters the viewport.
    `io.unobserve(e.target)` after revealing stops watching an element that's already done.

## Layer 4 — The network

12. **A Promise is a receipt, not a value.** `fetch` doesn't return data — it returns a
    **Promise**: an object that stands for a value that hasn't arrived yet. Think of a coat
    check. You hand over your coat and get a ticket *immediately*; the ticket is not the coat.
    This is why `const x = fetch(url)` leaves you holding a Promise, not JSON.

13. **`await` unwraps the receipt; `async` is the permission slip.** `await fetch(url)` means
    "pause this function here, let the rest of the page keep running, and resume with the real
    value once it lands." You may only use `await` inside a function marked `async` — that's the
    whole relationship. An `async` function *always* returns a Promise, no matter what you
    return from it.

14. **Nothing here is multi-threaded.** JavaScript runs on ONE thread. `await` doesn't run code
    in parallel — it *yields*, letting the browser do other work (respond to clicks, paint,
    fire the typing effect) until the network answers. That's why the typing animation keeps
    running smoothly while `loadProjects()` is waiting. The alternative is what a blocking call
    would do: freeze the entire page, animation and all, until the server replies.

15. **`try`/`catch` replaces `.catch()`.** Because `await` makes async code *look* sequential,
    ordinary `try`/`catch` works on it — a rejected Promise throws right where you awaited it.
    Trace `loadProjects()`: the inner `try` catches an API failure and falls back to the file;
    the outer one catches the case where even the file fails and leaves the section empty.

16. **The fallback ladder.** `loadProjects()` is worth tracing line by line: try the API → if it
    errors *or returns an empty list* → fall back to the committed `projects.json`. That
    empty-list case is a real bug that was really hit (see the comment on line ~95), and it's the
    kind of thing tests exist for.

17. **Graceful degradation.** `if ("IntersectionObserver" in window)` checks whether the browser
    supports the feature and, if not, just marks everything visible. The page gets worse, not
    broken. Same instinct as the JSON fallback.

## Layer 4.5 — Accessibility (cuts across all of them)

Accessibility isn't a layer of its own so much as a constraint on every other one. These four
were all real failures on this site, found by running **axe-core** against the live pages, and
fixing them is the clearest demonstration of why the rest of the architecture is built the way
it is.

19. **Contrast is a measurable ratio, not a taste call.** WCAG AA wants **4.5:1** between text
    and its background (3:1 for large text). `--text-faint` was `#9A7B5A` on cream: **3.12:1**.
    Not "a bit light" — measurably failing, in the footer, the captions and every strip label.
    The fix was three values in `tokens/colors.css`, because nothing hardcodes hex. That is the
    token layer paying for itself: one edit, thirty-odd elements corrected.

20. **A colour has to pass in both directions.** `--teal` was used as text *on* cream and as a
    fill *behind* cream text. Both directions failed, and both were fixed by the same darker
    value — which is why the token comment records the ratios for each role. Gold is the
    instructive exception: at 1.9:1 on cream, no adjustment saves it as text, so it is
    documented as a fill-and-border colour only. Not every colour can do every job.

21. **Landmarks are how a screen reader skims.** A sighted visitor's eye jumps to the content;
    a screen-reader user presses a key to jump to `<main>`. There wasn't one — eleven sections
    sat outside any landmark. `<main id="main">` plus a `.skip-link` as the first tab stop gives
    both groups the same shortcut. Semantics again (concept 2), with a concrete payoff.

22. **`outline: none` without a replacement locks out keyboard users — and specificity decides
    whether your fix even applies.** The old rule was
    `.field input:focus { outline: none; ... }`. Adding an `input:focus-visible` ring *later in
    the file did not fix it*: `.field input:focus` scores 0-2-1 and `input:focus-visible` scores
    0-1-1, so the higher-specificity `none` kept winning no matter how far down the new rule
    went. The repair had to happen at the source rule. That is concept 5 (the cascade) biting
    for real — and the reason `!important` is so tempting and so wrong here.
    Note `:focus-visible` rather than `:focus`: the browser shows the ring for keyboard
    navigation but not for mouse clicks.

23. **A CSS media query cannot stop a `setTimeout`.** `@media (prefers-reduced-motion: reduce)`
    silences CSS transitions and animations, but the typing effect and the streak count-up are
    *JavaScript* loops. They had to read the same preference themselves with
    `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and paint their finished
    state instead. A useful reminder that CSS and JS are separate systems that both have to
    agree — and that "reduced motion" means show the end state, not hide the content.

## Layer 5 — Parsing and rendering

24. **`innerHTML` executes markup, and that's the risk.** `listEl.innerHTML = projects.map(...)`
    doesn't insert *text* — it parses a string as HTML and builds real nodes. If any of that
    string came from a user, they can inject their own markup. That attack is **XSS**
    (cross-site scripting). Your code already defends against it: `esc()` converts `<` and `&`
    into harmless entities before they're interpolated. Find `esc()` in `main.js` and note every
    place it's called — then ask whether `blog.js` does the equivalent.
    The safe-by-default alternative when you just want words on screen is `.textContent`, which
    never parses anything (see how `data-shipped` is set).

## Common misconceptions this code corrects

- *"If it's not in index.html, it's not on the page."* No — check the DOM, not the source. Half
  this site is built at runtime.
- *"CSS variables are just Sass variables."* No — they're live in the browser, inherit through
  the tree, and can be changed at runtime.
- *"`innerHTML` is fine, it's my own data."* Your project data comes from an API that accepts
  writes. Escape it anyway; that's what `esc()` is for.
- *"JavaScript can run anywhere in the file."* Only if the elements it touches already exist.
  Position and `defer` decide that.
- *"`var` and `let` are the same."* They aren't — `var` is function-scoped and hoisted to the
  top of its function as `undefined`; `let` and `const` are block-scoped and unreachable before
  their line runs. That difference is why the conversion below had to leave one function alone.
- *"`await` makes it wait, so the page freezes."* Backwards. `await` is how the page *avoids*
  freezing: the function pauses, the browser gets on with everything else.

## The ES5 question, now settled

This code used to be written in ES5: `var`, `function(){}`, `.then()` chains,
`[].slice.call(nodeList)`. Since there's no build step, nothing transpiles it — but every browser
that can load this site has supported `const`, arrow functions, `async/await` and `Array.from`
for years, so the old spelling bought nothing. It's now ES2020, verified to render identically.

Two things that conversion taught, both worth keeping:

- **`const` doesn't hoist, and that's a feature.** `loadProjects()` calls `computeStack()` before
  `computeStack` appears in the file. That works only because it's a `function` **declaration**,
  which is hoisted. Rewriting it as `const computeStack = () => {}` would throw a
  `ReferenceError` — the variable exists but is in the *temporal dead zone* until its line runs.
  The comment above `computeStack` says exactly this, so nobody "modernizes" it by accident.
- **Modernizing is not refactoring.** Every change was syntax; no behavior moved. The proof was
  a browser driven headlessly before and after, diffing the rendered DOM — card count, bar
  widths, the computed streak, the reveal count. Same output both times. Without that, "it looks
  right" is a guess.

The next step this repo has *not* taken: `<script type="module">`. Real ES modules would give
`import`/`export`, automatic strict mode, and scope without the `(function(){ ... })()` wrapper
every file still uses. It changes load order and won't run over `file://`, so it's a real
decision rather than a free upgrade.

## Where the work lives

Every concept above has a real issue attached to it. The doc is the reference; the issues are
the job. See **#12** for the suggested order and what blocks what.

| Layer | Concepts | Issue |
|-------|----------|-------|
| 1 — The document | 1, 3 | #1 Give each post its own URL and share card |
| 2 — The cascade | 5, 6 | #2 Dark mode, driven from the token layer |
| 3 — The DOM | 9, 10 | #3 Copy button on code blocks |
| 4 — The network | 13, 15, 17 | #8 Contact form live · #9 Real GitHub streak |
| 4.5 — Accessibility | 19–23 | #5 Manual accessibility pass |
| 5 — Parsing | 24 | #4 Tables in the markdown renderer |

Each is sized so you can't finish it without understanding the concept. One branch, one PR,
`Closes #N`, CI green before merge.

## Next: run the quiz

Tell me **"start the frontend quiz"** and I'll go to active recall, one question at a time, with
corrections — then trace-the-code, then a hands-on exercise.
