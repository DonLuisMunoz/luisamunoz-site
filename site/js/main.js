/* ============================================================
   main.js — plain JS, no build step, no dependencies.
   Handles: typing effect, streak count-up, scroll reveal,
   data-driven project cards, and the contact form.

   ES2020 syntax. There's still no build step and nothing
   transpiles this: every browser that can load the site has
   supported const/let, arrow functions, template literals and
   async/await for years, so the old ES5 spelling bought nothing.
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.PORTFOLIO_CONFIG || { API_BASE: "", PROJECTS_FALLBACK: "./data/projects.json" };

  // CSS can silence transitions, but it can't stop a setTimeout loop. The two
  // animations below are driven from JS, so they have to check the preference
  // themselves and paint their finished state instead.
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. typing effect ---------- */
  const typeEl = document.querySelector("[data-type]");
  if (typeEl) {
    const phrases = ['python practice.py', 'git commit -m "day 4"', 'open new_project/', 'learn --everyday'];
    let pi = 0, ci = 0, deleting = false;
    const tick = () => {
      if (REDUCED_MOTION) { typeEl.textContent = phrases[0]; return; }
      const word = phrases[pi];
      if (!deleting) {
        typeEl.textContent = word.slice(0, ci++);
        if (ci > word.length) { deleting = true; setTimeout(tick, 1600); return; }
      } else {
        typeEl.textContent = word.slice(0, ci--);
        if (ci < 0) { deleting = false; ci = 0; pi = (pi + 1) % phrases.length; }
      }
      setTimeout(tick, deleting ? 45 : 95);
    };
    tick();
  }

  /* ---------- 2. streak count-up ---------- */
  const streakEl = document.querySelector("[data-streak]");
  if (streakEl) {
    // Days since Luis started (2026-07-01), computed live so it's always current.
    const START = new Date(2026, 6, 1); // month is 0-indexed: 6 = July
    const target = Math.max(0, Math.floor((Date.now() - START.getTime()) / 86400000));
    if (REDUCED_MOTION) {
      streakEl.textContent = target;   // the number is the point, not the count-up
    } else {
      let n = 0;
      const up = () => {
        n += 1;
        streakEl.textContent = n;
        if (n < target) setTimeout(up, 32);
      };
      setTimeout(up, 500);
    }
  }

  /* ---------- 3. reveal on scroll (IntersectionObserver) ---------- */
  const reveals = Array.from(document.querySelectorAll("[data-reveal]"));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- 4. data-driven project cards ---------- */
  const listEl = document.getElementById("project-list");

  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  // `s ?? ""` is the nullish coalescing operator: substitute only when s is
  // null or undefined. Exactly what `s == null ? "" : s` did, said shorter.
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

  const cardHTML = (p) => {
    const tags = (p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    const link = p.url
      ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="btn btn--gold btn--sm" style="margin-top:18px;">view the code ↗</a>`
      : "";
    return (
      `<article class="card">` +
        `<div class="card__meta">${esc(p.meta || "")}</div>` +
        `<h3 class="card__title">${esc(p.title || "")}</h3>` +
        `<p class="card__body">${esc(p.body || "")}</p>` +
        (tags ? `<div class="tags">${tags}</div>` : "") +
        link +
      `</article>`
    );
  };

  const renderProjects = (projects) => {
    if (!listEl) return;
    if (!projects || !projects.length) { listEl.innerHTML = ""; return; }
    listEl.innerHTML = projects.map(cardHTML).join("");
    // The featured project is bespoke HTML, not a projects.json entry, so
    // counting only the JSON undercounted the real number of shipped projects.
    const shipped = document.querySelector("[data-shipped]");
    const featured = document.querySelectorAll(".featured").length;
    if (shipped) shipped.textContent = projects.length + featured;
  };

  const fromFile = async () => {
    const res = await fetch(CFG.PROJECTS_FALLBACK);
    return res.json();
  };

  const fromApi = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const items = await res.json();
    // An EMPTY list from the API counts as a fallback too. A fresh backend has
    // an empty database and answers 200 with [], which isn't an error, so
    // without this the log would render zero cards and the stack bars would
    // collapse the moment API_BASE was set. The committed JSON stays the floor.
    return (items && items.length) ? items : fromFile();
  };

  async function loadProjects() {
    if (!listEl) return;
    const apiUrl = CFG.API_BASE ? `${CFG.API_BASE.replace(/\/$/, "")}/api/projects` : null;
    try {
      let projects;
      if (apiUrl) {
        // Try the live API first, fall back to the baked-in JSON file.
        try { projects = await fromApi(apiUrl); }
        catch { projects = await fromFile(); }
      } else {
        projects = await fromFile();
      }
      renderProjects(projects);
      computeStack(projects);
    } catch { /* leave empty */ }
  }
  loadProjects();

  /* ---------- 4b. tech stack, computed from each project's tools ---------- */
  // XP by reps: a tool's level = how many projects use it. Bars grow as Luis ships.
  const STACK_NEXT = ["Power BI"]; // targeted but not shipped yet — shown as "next up"
  const STACK_PRIORITY = ["SQL", "PostgreSQL", "Python", "Power BI", "Docker", "Excel"];
  const STACK_LEVELS = [null, "starting out", "getting reps", "comfortable", "strong", "daily"];
  const STACK_WIDTHS = [0, 32, 56, 78, 90, 100];
  const STACK_FILLS = ["fill--gold", "fill--teal", "fill--accent", "fill--pink"];

  // Declared with `function`, not `const`, on purpose: loadProjects() above
  // calls it before this line is reached. Function declarations are hoisted;
  // a `const computeStack = ...` here would throw a ReferenceError instead.
  function computeStack(projects) {
    const stackEl = document.querySelector("[data-stack]");
    if (!stackEl) return;
    const counts = {};
    // tools from the hand-curated featured article (data-tools attribute)
    const feat = document.querySelector(".featured[data-tools]");
    const lists = [];
    if (feat) lists.push(feat.getAttribute("data-tools").split(","));
    (projects || []).forEach((p) => { if (p.tools) lists.push(p.tools); });
    lists.forEach((list) => {
      list.forEach((raw) => {
        const t = String(raw).trim();
        if (t) counts[t] = (counts[t] || 0) + 1;
      });
    });
    const priority = (name) => {
      const idx = STACK_PRIORITY.indexOf(name);
      return idx < 0 ? 99 : idx;
    };
    const tools = Object.keys(counts).sort((a, b) => (
      counts[b] !== counts[a] ? counts[b] - counts[a] : priority(a) - priority(b)
    ));
    stackEl.innerHTML = tools.map((t, i) => {
      const c = counts[t];
      const tier = Math.min(c, 5);
      return (
        `<div>` +
          `<div class="skill__head">` +
            `<span>${esc(t)}</span>` +
            `<span class="skill__level">${STACK_LEVELS[tier]} · ${c}${c === 1 ? " project" : " projects"}</span>` +
          `</div>` +
          `<div class="skill__track">` +
            `<div class="skill__fill ${STACK_FILLS[i % STACK_FILLS.length]}" style="width:${STACK_WIDTHS[tier]}%"></div>` +
          `</div>` +
        `</div>`
      );
    }).join("");
    const nextEl = document.querySelector("[data-stack-next]");
    if (nextEl) {
      const upcoming = STACK_NEXT.filter((t) => !counts[t]);
      nextEl.innerHTML = upcoming.length
        ? `<span class="section-kicker">// next up</span>` +
            upcoming.map((t) => `<span class="tag">${esc(t)}</span>`).join("")
        : "";
    }
  }

  /* ---------- 4c. latest posts, from the same manifest /blog reads ---------- */
  // The section starts hidden and only appears if there are real posts,
  // so the home page can never show placeholder writing.
  (async function latestPosts() {
    const wrap = document.getElementById("writing");
    const list = document.getElementById("writing-list");
    if (!wrap || !list) return;

    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const meta = (p) => {
      const d = String(p.date || "").split("-");
      const when = d.length === 3 ? `${MONTHS[parseInt(d[1], 10) - 1]} ${d[0]}` : "";
      return when + (p.minutes ? ` · ${p.minutes} MIN READ` : "");
    };

    try {
      const res = await fetch("./content/posts/index.json");
      if (!res.ok) throw new Error(`manifest responded ${res.status}`);
      const data = await res.json();
      const posts = ((data && data.posts) || [])
        .filter((p) => p && p.slug && !p.draft)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 2);
      if (!posts.length) return;
      list.innerHTML = posts.map((p) => (
        `<a class="post" href="./blog/?p=${encodeURIComponent(p.slug)}">` +
          `<div class="card__meta">${esc(meta(p))}</div>` +
          `<h3 class="post__title">${esc(p.title || p.slug)}</h3>` +
          `<p class="post__body">${esc(p.summary || "")}</p>` +
        `</a>`
      )).join("");
      wrap.hidden = false;
    } catch { /* no posts, section stays hidden */ }
  })();

  /* ---------- 5. contact form ---------- */
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();

      if (!CFG.API_BASE) {
        // No backend yet: turn the form into a pre-filled email so it still works.
        if (!name || !email || !message) { status.textContent = "Please fill in every field."; return; }
        const subject = encodeURIComponent(`Hello from luisamunoz.com — ${name}`);
        const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
        window.location.href = `mailto:lamunoz12@gmail.com?subject=${subject}&body=${body}`;
        status.textContent = "Opening your email app… if nothing happens, write me at lamunoz12@gmail.com.";
        return;
      }

      if (!name || !email || !message) {
        status.textContent = "Please fill in every field."; return;
      }
      status.textContent = "Sending…";
      try {
        const res = await fetch(`${CFG.API_BASE.replace(/\/$/, "")}/api/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, message })
        });
        if (!res.ok) throw new Error(`contact responded ${res.status}`);
        await res.json();
        status.textContent = "Got it — thanks! I'll reply soon.";
        form.reset();
      } catch {
        status.textContent = "Something broke on send. Try emailing me instead.";
      }
    });
  }
})();
