/* ============================================================
   Tests for the markdown renderer in site/js/blog.js.

   Run:  node --test tests/

   No framework and no install: node's built-in test runner, the same
   way the rest of this repo avoids a dependency it doesn't need.
   blog.js already exported renderMarkdown for exactly this purpose.

   The renderer is a hand-written parser, which means it is all edge
   cases, and it renders text Luis writes into innerHTML. The escaping
   tests at the bottom are the ones that actually matter.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert");
const { renderMarkdown } = require("../site/js/blog.js");

/* ---------- blocks ---------- */

test("headings render at the right level", () => {
  assert.strictEqual(renderMarkdown("# One"), "<h1>One</h1>");
  assert.strictEqual(renderMarkdown("### Three"), "<h3>Three</h3>");
  assert.strictEqual(renderMarkdown("###### Six"), "<h6>Six</h6>");
});

test("seven hashes is not a heading, it's a paragraph", () => {
  assert.match(renderMarkdown("####### Seven"), /^<p>/);
});

test("consecutive lines join into one paragraph", () => {
  assert.strictEqual(renderMarkdown("one\ntwo\nthree"), "<p>one two three</p>");
});

test("a blank line starts a new paragraph", () => {
  assert.strictEqual(renderMarkdown("one\n\ntwo"), "<p>one</p>\n<p>two</p>");
});

test("unordered lists collect their items", () => {
  assert.strictEqual(renderMarkdown("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
});

test("ordered lists use ol", () => {
  assert.strictEqual(renderMarkdown("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
});

test("blockquote lines join into one quote", () => {
  assert.strictEqual(renderMarkdown("> a\n> b"), "<blockquote>a b</blockquote>");
});

test("horizontal rules", () => {
  assert.strictEqual(renderMarkdown("---"), "<hr>");
  assert.strictEqual(renderMarkdown("***"), "<hr>");
});

test("fenced code keeps its line breaks and records the language", () => {
  const out = renderMarkdown("```py\nx = 1\ny = 2\n```");
  assert.match(out, /data-lang="py"/);
  assert.match(out, /<code>x = 1\ny = 2<\/code>/);
});

test("a fence with no language gets no data-lang attribute", () => {
  assert.doesNotMatch(renderMarkdown("```\nplain\n```"), /data-lang/);
});

test("markdown inside a fence is left alone", () => {
  const out = renderMarkdown("```\n- not a list\n**not bold**\n```");
  assert.match(out, /- not a list/);
  assert.match(out, /\*\*not bold\*\*/);
});

/* ---------- inline ---------- */

test("bold and italic", () => {
  assert.match(renderMarkdown("a **b** c"), /<strong>b<\/strong>/);
  assert.match(renderMarkdown("a *b* c"), /<em>b<\/em>/);
  assert.match(renderMarkdown("a _b_ c"), /<em>b<\/em>/);
});

test("inline code becomes a code element", () => {
  assert.match(renderMarkdown("use `x = 1` here"), /<code>x = 1<\/code>/);
});

test("markup inside inline code stays literal", () => {
  // Code spans are pulled out before bold/link parsing, so this must NOT
  // come back as <strong>.
  const out = renderMarkdown("`**not bold**`");
  assert.match(out, /<code>\*\*not bold\*\*<\/code>/);
  assert.doesNotMatch(out, /<strong>/);
});

test("external links open in a new tab with noopener", () => {
  const out = renderMarkdown("[x](https://example.com)");
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener"/);
});

test("relative links stay in the tab", () => {
  const out = renderMarkdown("[x](./other)");
  assert.doesNotMatch(out, /target="_blank"/);
});

test("protocol-relative links count as external", () => {
  assert.match(renderMarkdown("[x](//evil.example)"), /target="_blank"/);
});

test("images render lazily and keep a relative src", () => {
  const out = renderMarkdown("![alt text](assets/x.png)");
  assert.match(out, /<img src="assets\/x\.png"/);
  assert.match(out, /alt="alt text"/);
  assert.match(out, /loading="lazy"/);
});

/* ---------- escaping: the tests that matter ----------
   Posts are rendered into innerHTML. If any of this regresses, a post
   can inject live markup into the page. */

test("raw HTML in a post is escaped, not executed", () => {
  const out = renderMarkdown("<script>alert(1)</script>");
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /&lt;script&gt;/);
});

test("an img onerror payload is escaped", () => {
  const out = renderMarkdown('<img src=x onerror="alert(1)">');
  assert.doesNotMatch(out, /<img src=x/);
  assert.match(out, /&lt;img/);
});

test("a javascript: link href is neutralised", () => {
  const out = renderMarkdown("[click](javascript:alert(1))");
  assert.doesNotMatch(out, /javascript:/);
  assert.match(out, /href="#"/);
});

test("a data: image src is neutralised", () => {
  const out = renderMarkdown("![x](data:text/html,<script>alert(1)</script>)");
  assert.doesNotMatch(out, /src="data:/);
});

test("mailto and https survive the scheme filter", () => {
  assert.match(renderMarkdown("[m](mailto:a@b.com)"), /href="mailto:a@b\.com"/);
  assert.match(renderMarkdown("[h](https://a.com)"), /href="https:\/\/a\.com"/);
});

test("ampersands in text are escaped once, not twice", () => {
  assert.match(renderMarkdown("Tom & Jerry"), /Tom &amp; Jerry/);
  assert.doesNotMatch(renderMarkdown("Tom & Jerry"), /&amp;amp;/);
});

/* ---------- edges ---------- */

test("empty and whitespace-only input produce nothing", () => {
  assert.strictEqual(renderMarkdown(""), "");
  assert.strictEqual(renderMarkdown("\n\n  \n"), "");
});

test("CRLF line endings are normalised", () => {
  assert.strictEqual(renderMarkdown("a\r\n\r\nb"), "<p>a</p>\n<p>b</p>");
});

test("a real post shape renders every block type without throwing", () => {
  const out = renderMarkdown([
    "# Title", "", "Intro paragraph with **bold**.", "",
    "## Section", "", "- one", "- two", "", "> a quote", "",
    "```sql", "SELECT 1;", "```", "", "---", "", "Closing line.",
  ].join("\n"));
  for (const tag of ["<h1>", "<h2>", "<p>", "<ul>", "<blockquote>", "<pre", "<hr>"]) {
    assert.ok(out.includes(tag), `expected ${tag} in output`);
  }
});

/* ---------- tables (GFM pipe syntax) ----------
   Written before the parser supported them, so the expected output was
   decided up front rather than reverse-engineered from whatever the
   regex happened to produce. */

const TABLE = [
  "| tool | reps |",
  "|------|------|",
  "| SQL  | 3    |",
  "| Python | 2 |",
].join("\n");

test("a pipe table renders with thead and tbody", () => {
  const out = renderMarkdown(TABLE);
  assert.match(out, /^<table>/);
  assert.match(out, /<thead><tr><th>tool<\/th><th>reps<\/th><\/tr><\/thead>/);
  assert.match(out, /<tbody><tr><td>SQL<\/td><td>3<\/td><\/tr><tr><td>Python<\/td><td>2<\/td><\/tr><\/tbody>/);
});

test("outer pipes are optional", () => {
  const out = renderMarkdown("a | b\n--- | ---\n1 | 2");
  assert.match(out, /<th>a<\/th><th>b<\/th>/);
  assert.match(out, /<td>1<\/td><td>2<\/td>/);
});

test("a table with no body rows has no tbody", () => {
  const out = renderMarkdown("| a | b |\n|---|---|");
  assert.match(out, /<thead>/);
  assert.doesNotMatch(out, /<tbody>/);
});

test("short rows are padded and long rows are trimmed to the header width", () => {
  const out = renderMarkdown("| a | b | c |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |");
  assert.match(out, /<tr><td>1<\/td><td><\/td><td><\/td><\/tr>/);
  assert.match(out, /<tr><td>1<\/td><td>2<\/td><td>3<\/td><\/tr>/);
  assert.doesNotMatch(out, /<td>4<\/td>/);
});

test("inline markup works inside cells", () => {
  const out = renderMarkdown("| x |\n|---|\n| **bold** and `code` and [l](https://a.com) |");
  assert.match(out, /<td><strong>bold<\/strong> and <code>code<\/code> and <a href="https:\/\/a\.com"/);
});

test("a pipe inside inline code does not split the cell", () => {
  const out = renderMarkdown("| expr |\n|---|\n| `a|b` |");
  assert.match(out, /<td><code>a\|b<\/code><\/td>/);
});

test("an escaped pipe is a literal pipe, not a cell boundary", () => {
  const out = renderMarkdown("| a |\n|---|\n| x \\| y |");
  assert.match(out, /<td>x \| y<\/td>/);
});

test("pipes without a separator row stay a paragraph", () => {
  const out = renderMarkdown("this | is | not a table");
  assert.strictEqual(out, "<p>this | is | not a table</p>");
});

test("a table ends the paragraph above it and the one below starts fresh", () => {
  const out = renderMarkdown("intro line\n| a |\n|---|\n| 1 |\n\nafter");
  assert.match(out, /^<p>intro line<\/p>\n<table>/);
  assert.match(out, /<\/table>\n<p>after<\/p>$/);
});

test("markup inside a table cell is still escaped", () => {
  const out = renderMarkdown("| x |\n|---|\n| <script>alert(1)</script> |");
  assert.doesNotMatch(out, /<script>/);
  assert.match(out, /&lt;script&gt;/);
});
