# Frontend, the learning way

Same deal as `BACKEND-LESSON.md`, for the other half of the repo. This is **Phase 1**: the
concepts to actually understand in `site/`. Read it, then ask me to run the active-recall quiz
in chat — I'll grade you one question at a time.

The frontend isn't one subject. It's five layers, and this repo has a clean example of each:
the document (`index.html`), the cascade (`css/`), the DOM (`main.js`), the network (the `fetch`
calls), and parsing (`blog.js`). The concepts below are grouped that way.

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

12. **Promises and the `.then()` chain.** `fetch` doesn't return data — it returns a **Promise**,
    an object representing a value that hasn't arrived yet. `.then()` queues what to do when it
    does. This is why you can't `var x = fetch(...)` and use `x` on the next line.

13. **The fallback ladder.** `loadProjects()` is worth tracing line by line: try the API → if it
    errors *or returns an empty list* → fall back to the committed `projects.json`. That
    empty-list case is a real bug that was really hit (see the comment on line ~95), and it's the
    kind of thing tests exist for.

14. **Graceful degradation.** `if ("IntersectionObserver" in window)` checks whether the browser
    supports the feature and, if not, just marks everything visible. The page gets worse, not
    broken. Same instinct as the JSON fallback.

## Layer 5 — Parsing and rendering

15. **`innerHTML` executes markup, and that's the risk.** `listEl.innerHTML = projects.map(...)`
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
- *"`var` and `let` are the same."* They aren't — `var` is function-scoped and hoisted, `let` is
  block-scoped. This file uses `var` throughout, which is worth questioning (see below).

## An open question to interrogate, not accept

`main.js` is written in ES5: `var`, `function(){}`, `.then()` chains, `[].slice.call(nodeList)`.
There is no build step here, so nothing transpiles it — but every browser that can load this site
has supported `const`, arrow functions, `async/await`, and `Array.from` for years. So: is the old
syntax buying anything, or is it a habit inherited from a era that ended? Form a view with
reasons. That's a better exercise than being told.

## Next: run the quiz

Tell me **"start the frontend quiz"** and I'll go to active recall, one question at a time, with
corrections — then trace-the-code, then a hands-on exercise.
