/* ============================================================
   admin.js — tiny CRUD client for the project list.
   Talks to the Python API. The admin token is sent as a
   Bearer header; it is NEVER stored on the server in the page.
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.PORTFOLIO_CONFIG || { API_BASE: "" };
  const API = (CFG.API_BASE || "").replace(/\/$/, "");

  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const listEl = $("admin-list");

  const token = () => $("token").value.trim();
  const headers = () => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token()}`
  });

  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

  const csv = (value) => String(value || "").split(",").map((t) => t.trim()).filter(Boolean);

  // 401 means the token is wrong; anything else is a generic failure.
  const failure = (err, verb) =>
    (err && err.status === 401) ? "Bad token." : `${verb} failed.`;

  // Every status message goes through here so its colour says what kind of
  // message it is. Classes, not data-*: data attributes are for JS hooks.
  const setStatus = (msg, state = "") => {
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-ok", state === "ok");
    statusEl.classList.toggle("is-error", state === "error");
  };

  if (!API) {
    setStatus("Set API_BASE in js/config.js before using the admin panel.", "error");
  }

  /* ---- list ---- */
  async function refresh() {
    try {
      const res = await fetch(`${API}/api/projects`);
      const items = await res.json();
      listEl.innerHTML = items.map((p) => (
        `<div class="card">` +
          `<div class="card__meta">${esc(p.meta || "")}</div>` +
          `<h3 class="card__title">${esc(p.title)}</h3>` +
          `<p class="card__body">${esc(p.body || "")}</p>` +
          `<div class="tags" style="margin-top:14px;">` +
            `<button class="btn btn--sm btn--paper" data-edit="${esc(p.id)}">edit</button>` +
            `<button class="btn btn--sm danger" data-del="${esc(p.id)}">delete</button>` +
          `</div>` +
        `</div>`
      )).join("");
    } catch {
      listEl.innerHTML = "<p>Could not reach the API.</p>";
    }
  }

  // A plain Error carrying the HTTP status, so the catch block can tell a
  // bad token (401) apart from everything else without parsing a message.
  const httpError = (res) => Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });

  /* ---- create / update ---- */
  $("project-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!token()) { setStatus("Enter your admin token first.", "error"); return; }
    const id = $("f-id").value.trim();
    const body = {
      meta: $("f-meta").value.trim(),
      title: $("f-title").value.trim(),
      body: $("f-body").value.trim(),
      tools: csv($("f-tools").value),
      tags: csv($("f-tags").value),
      url: $("f-url").value.trim()
    };
    const method = id ? "PUT" : "POST";
    const url = id ? `${API}/api/projects/${encodeURIComponent(id)}` : `${API}/api/projects`;
    setStatus("Saving…");
    try {
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) throw httpError(res);
      await res.json();
      setStatus("Saved.", "ok");
      e.target.reset();
      $("f-id").value = "";
      refresh();
    } catch (err) {
      setStatus(failure(err, "Save"), "error");
    }
  });

  /* ---- edit / delete (event delegation) ---- */
  listEl.addEventListener("click", async (e) => {
    const ed = e.target.getAttribute("data-edit");
    const dl = e.target.getAttribute("data-del");

    if (ed) {
      try {
        const res = await fetch(`${API}/api/projects`);
        const items = await res.json();
        const p = items.find((x) => x.id === ed);
        if (!p) return;
        $("f-id").value = p.id;
        $("f-meta").value = p.meta || "";
        $("f-title").value = p.title || "";
        $("f-body").value = p.body || "";
        $("f-tools").value = (p.tools || []).join(", ");
        $("f-tags").value = (p.tags || []).join(", ");
        $("f-url").value = p.url || "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch { /* the list is already on screen; leave the form alone */ }
    }

    if (dl) {
      if (!token()) { setStatus("Enter your admin token first.", "error"); return; }
      if (!confirm("Delete this project?")) return;
      try {
        const res = await fetch(`${API}/api/projects/${encodeURIComponent(dl)}`, {
          method: "DELETE",
          headers: headers()
        });
        if (!res.ok) throw httpError(res);
        refresh();
      } catch (err) {
        setStatus(failure(err, "Delete"), "error");
      }
    }
  });

  refresh();
})();
