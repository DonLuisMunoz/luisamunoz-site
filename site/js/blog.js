/* ============================================================
   blog.js — the /blog page. Plain JS, no build step, no deps.

   Two views in one file, switched by the URL:
     /blog/            -> the list of posts
     /blog/?p=<slug>   -> that post, rendered from markdown

   Posts are markdown files in site/content/posts/.
   site/content/posts/index.json is the manifest (the metadata).
   A static host can't list a directory, so the manifest is how
   the page knows what exists. Adding a post = one .md file +
   one entry in the manifest. See docs/ADD-A-POST.md.
   ============================================================ */
(function () {
  "use strict";

  const MANIFEST = "../content/posts/index.json";
  const POSTS_DIR = "../content/posts/";

  /* ---------- helpers ---------- */
  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

  // Block dangerous schemes by name rather than allow-listing path shapes.
  // The earlier version required a leading ./ or / and silently turned a
  // perfectly good relative path like assets/x.png into "#".
  // No scheme at all means a relative path, which is what post images use.
  const safeHref = (href) => {
    const scheme = /^([a-z][a-z0-9+.\-]*):/i.exec(href);
    if (scheme && !/^(https?|mailto)$/i.test(scheme[1])) return "#";
    return href;
  };

  // "//host/path" is protocol-relative, so it leaves the site even though it
  // has no scheme. It gets the same new-tab and noopener treatment as https.
  const isExternal = (href) => /^(https?:)?\/\//i.test(href);

  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const fmtDate = (iso) => {
    const parts = String(iso || "").split("-");
    if (parts.length !== 3) return String(iso || "");
    const m = MONTHS[parseInt(parts[1], 10) - 1] || "";
    return `${m} ${parseInt(parts[2], 10)}, ${parts[0]}`;
  };

  const metaLine = (post) => {
    const bits = [fmtDate(post.date)];
    if (post.minutes) bits.push(`${post.minutes} MIN READ`);
    return bits.join(" · ");
  };

  /* ---------- markdown -> html ----------
     A deliberately small subset: headings, paragraphs, fenced and
     inline code, bold, italic, links, images, lists, blockquotes,
     and rules. Everything is HTML-escaped BEFORE parsing, so a post
     can never inject markup. That's why the blockquote test below
     looks for &gt; instead of >.
  */
  function inline(text) {
    // Pull code spans out first so bold/link syntax inside them stays literal.
    // The placeholder uses a raw < , which can never survive HTML escaping,
    // so it can't collide with anything the post itself contains.
    const codes = [];
    let out = text.replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return `<${codes.length - 1}>`;
    });
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) =>
      `<img src="${safeHref(src)}" alt="${alt}" loading="lazy">`);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const ext = isExternal(href) ? ' target="_blank" rel="noopener"' : "";
      return `<a href="${safeHref(href)}"${ext}>${label}</a>`;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    out = out.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
    return out.replace(/<(\d+)>/g, (_, i) => `<code>${codes[+i]}</code>`);
  }

  const RE_FENCE = /^```/;
  const RE_RULE = /^ {0,3}(---|\*\*\*|___)\s*$/;
  const RE_HEAD = /^(#{1,6})\s+(.*)$/;
  const RE_QUOTE = /^&gt;\s?/;
  const RE_UL = /^\s*[-*+]\s+/;
  const RE_OL = /^\s*\d+\.\s+/;

  const isBlockStart = (line) =>
    RE_FENCE.test(line) || RE_RULE.test(line) || RE_HEAD.test(line) ||
    RE_QUOTE.test(line) || RE_UL.test(line) || RE_OL.test(line);

  function renderMarkdown(src) {
    const lines = esc(String(src).replace(/\r\n?/g, "\n")).split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) { i++; continue; }

      if (RE_FENCE.test(line)) {
        const lang = line.slice(3).trim();
        const code = [];
        i++;
        while (i < lines.length && !RE_FENCE.test(lines[i])) code.push(lines[i++]);
        i++; // closing fence
        out.push(`<pre class="prose__pre"${lang ? ` data-lang="${lang}"` : ""}>` +
          `<code>${code.join("\n")}</code></pre>`);
        continue;
      }

      if (RE_RULE.test(line)) { out.push("<hr>"); i++; continue; }

      const h = RE_HEAD.exec(line);
      if (h) {
        const lvl = h[1].length;
        out.push(`<h${lvl}>${inline(h[2].trim())}</h${lvl}>`);
        i++;
        continue;
      }

      if (RE_QUOTE.test(line)) {
        const quote = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) {
          quote.push(lines[i++].replace(RE_QUOTE, ""));
        }
        out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
        continue;
      }

      if (RE_UL.test(line) || RE_OL.test(line)) {
        const ordered = RE_OL.test(line);
        const re = ordered ? RE_OL : RE_UL;
        const tag = ordered ? "ol" : "ul";
        const items = [];
        while (i < lines.length && re.test(lines[i])) {
          items.push(`<li>${inline(lines[i++].replace(re, ""))}</li>`);
        }
        out.push(`<${tag}>${items.join("")}</${tag}>`);
        continue;
      }

      const para = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        para.push(lines[i++].trim());
      }
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }

    return out.join("\n");
  }

  /* ---------- data ---------- */
  async function loadManifest() {
    const res = await fetch(MANIFEST);
    if (!res.ok) throw new Error("no manifest");
    const data = await res.json();
    const posts = (data && data.posts) || [];
    return posts
      .filter((p) => p && p.slug && !p.draft)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  /* ---------- view: list ----------
     The blog isn't tech-only. Categories are whatever the posts declare, the
     same way the home page's stack bars are whatever the projects declare.
     Nothing here hardcodes a topic, so writing about something new just works.
  */
  // A Set drops duplicates for free, which the old indexOf scan did by hand.
  const categoriesIn = (posts) =>
    [...new Set(posts.map((p) => p.category).filter(Boolean))].sort();

  const renderFilters = (posts, active, mount) => {
    const cats = categoriesIn(posts);
    if (cats.length < 2) { mount.innerHTML = ""; return; }  // one topic needs no filter
    mount.innerHTML =
      `<a class="filter${active ? "" : " is-on"}" href="./">everything</a>` +
      cats.map((c) =>
        `<a class="filter${c === active ? " is-on" : ""}" ` +
        `href="?c=${encodeURIComponent(c)}">${esc(c)}</a>`
      ).join("");
  };

  const chipsFor = (p) => {
    const chips = [];
    if (p.category) chips.push(`<span class="tag tag--cat">${esc(p.category)}</span>`);
    (p.tags || []).forEach((t) => chips.push(`<span class="tag">${esc(t)}</span>`));
    return chips;
  };

  const renderList = (posts, mount) => {
    if (!posts.length) {
      mount.innerHTML = '<p class="section-lead">Nothing here yet.</p>';
      return;
    }
    mount.innerHTML = posts.map((p) => {
      const chips = chipsFor(p);
      return (
        `<a class="post" href="?p=${encodeURIComponent(p.slug)}">` +
          `<div class="card__meta">${esc(metaLine(p))}</div>` +
          `<h2 class="post__title">${esc(p.title || p.slug)}</h2>` +
          `<p class="post__body">${esc(p.summary || "")}</p>` +
          (chips.length ? `<div class="tags">${chips.join("")}</div>` : "") +
        `</a>`
      );
    }).join("");
  };

  /* ---------- view: single post ---------- */
  const renderPost = (post, body, mount) => {
    const tags = chipsFor(post).join("");
    mount.innerHTML =
      `<article class="prose">` +
        `<div class="card__meta">${esc(metaLine(post))}</div>` +
        `<h1 class="prose__title">${esc(post.title || post.slug)}</h1>` +
        (tags ? `<div class="tags">${tags}</div>` : "") +
        `<div class="prose__body">${renderMarkdown(body)}</div>` +
      `</article>` +
      `<a class="btn btn--paper btn--sm" href="./" style="margin-top:40px;">← all posts</a>`;
    document.title = `${post.title || post.slug} · Luis A. Munoz`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && post.summary) desc.setAttribute("content", post.summary);
  };

  const notFound = (mount) => {
    mount.innerHTML =
      `<h1 class="prose__title">That post isn't here.</h1>` +
      `<p class="section-lead">The link might be old or the slug might be wrong.</p>` +
      `<a class="btn btn--gold btn--sm" href="./" style="margin-top:24px;">← all posts</a>`;
  };

  // Exported so the renderer can be unit-tested outside a browser.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { renderMarkdown };
  }

  /* ---------- boot ---------- */
  if (typeof document === "undefined") return;
  const mount = document.getElementById("blog-root");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("p");
  const cat = params.get("c");
  const listHead = document.getElementById("blog-list-head");
  const filterEl = document.getElementById("blog-filters");

  (async () => {
    try {
      const posts = await loadManifest();

      if (!slug) {
        if (listHead) listHead.hidden = false;
        if (filterEl) renderFilters(posts, cat, filterEl);
        renderList(cat ? posts.filter((p) => p.category === cat) : posts, mount);
        return;
      }

      const post = posts.find((p) => p.slug === slug);
      if (!post) { notFound(mount); return; }

      const res = await fetch(`${POSTS_DIR}${encodeURIComponent(post.slug)}.md`);
      if (!res.ok) throw new Error("no post file");
      renderPost(post, await res.text(), mount);
    } catch {
      notFound(mount);
    }
  })();
})();
