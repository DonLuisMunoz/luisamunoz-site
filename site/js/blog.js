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

  // GFM table separator: |---|:---:|  -- outer pipes optional, at least 3 dashes.
  const RE_TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

  // A table starts where a line containing a pipe is followed by a separator.
  // Without the separator, pipes are just text -- "a | b" stays a paragraph.
  const isTableStart = (lines, i) =>
    lines[i].includes("|") && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1]);

  // Split one row into raw cell strings. Not a plain split("|"): a pipe inside
  // a `code span` or written as \| belongs to the cell, not between cells.
  const splitRow = (line) => {
    let row = line.trim();
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
    const cells = [];
    let cur = "", inCode = false;
    for (let k = 0; k < row.length; k++) {
      const ch = row[k];
      if (ch === "\\" && row[k + 1] === "|") { cur += "|"; k++; continue; }
      if (ch === "`") inCode = !inCode;
      if (ch === "|" && !inCode) { cells.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

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

      if (isTableStart(lines, i)) {
        const head = splitRow(lines[i]);
        const width = head.length;
        i += 2;                                        // header + separator
        const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
          // GFM: pad short rows, drop cells beyond the header's width.
          const cells = splitRow(lines[i++]).slice(0, width);
          while (cells.length < width) cells.push("");
          rows.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`);
        }
        out.push(
          `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
          (rows.length ? `<tbody>${rows.join("")}</tbody>` : "") +
          `</table>`
        );
        continue;
      }

      const para = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i]) && !isTableStart(lines, i)) {
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
        `<a class="post" href="${encodeURIComponent(p.slug)}/">` +
          `<div class="card__meta">${esc(metaLine(p))}</div>` +
          `<h2 class="post__title">${esc(p.title || p.slug)}</h2>` +
          `<p class="post__body">${esc(p.summary || "")}</p>` +
          (chips.length ? `<div class="tags">${chips.join("")}</div>` : "") +
        `</a>`
      );
    }).join("");
  };

  /* ---------- copy buttons on code blocks ----------
     The <pre> blocks don't exist when the page loads -- renderPost() builds
     them from markdown after a fetch. So there is nothing to attach a
     listener to at startup. Instead, ONE listener sits on #blog-root (which
     always exists) and checks what was clicked: event delegation. The
     buttons themselves are added after each render, but they never need a
     listener of their own.
  */
  const addCopyButtons = (root) => {
    root.querySelectorAll(".prose__pre").forEach((pre) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "copy";
      btn.setAttribute("aria-label", "Copy this code to the clipboard");
      pre.appendChild(btn);
    });
  };

  // Screen readers can't see a button's label change on its own; a polite
  // live region announces the result without stealing focus.
  const announce = (msg) => {
    let live = document.getElementById("copy-status");
    if (!live) {
      live = document.createElement("p");
      live.id = "copy-status";
      live.className = "sr-only";
      live.setAttribute("aria-live", "polite");
      document.body.appendChild(live);
    }
    live.textContent = "";
    // A tick later, so repeating the same message is still announced.
    setTimeout(() => { live.textContent = msg; }, 30);
  };

  const onCopyClick = async (e) => {
    const btn = e.target.closest(".copy-btn");
    if (!btn) return;
    const code = btn.parentElement.querySelector("code");
    // textContent, not innerHTML: the source was escaped for display, and
    // textContent hands back the original characters, newlines intact.
    const text = code ? code.textContent : "";
    let ok = false;
    try {
      // Needs a secure context: works on https:// and localhost, fails over
      // plain http:// to a LAN address -- so handle the rejection.
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch { /* fall through to the failure message */ }
    btn.textContent = ok ? "copied" : "copy failed";
    btn.classList.toggle("is-done", ok);
    announce(ok ? "Code copied to the clipboard."
                : "Couldn't copy. Select the code and copy it manually.");
    clearTimeout(btn._reset);
    btn._reset = setTimeout(() => {
      btn.textContent = "copy";
      btn.classList.remove("is-done");
    }, 1800);
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
    addCopyButtons(mount);
    document.title = `${post.title || post.slug} · Luis A. Munoz`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && post.summary) desc.setAttribute("content", post.summary);
    // On /blog/?p=<slug> the HTML shipped with the LIST's canonical. Point it
    // at the post's real page so old query-string links consolidate there.
    // (Generated /blog/<slug>/ pages already have this baked in.)
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute(
        "href", `https://luisamunoz.com/blog/${encodeURIComponent(post.slug)}/`);
    }
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute(
        "content", `https://luisamunoz.com/blog/${encodeURIComponent(post.slug)}/`);
    }
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

  mount.addEventListener("click", onCopyClick);

  const params = new URLSearchParams(window.location.search);
  // /blog/?p=<slug> (old links) or /blog/<slug>/ (generated page, which
  // carries its slug on #blog-root because there is no query string).
  const slug = params.get("p") || mount.dataset.slug || null;
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
