/* ============================================================
   theme.js — light / dark toggle.

   Loaded as a plain, synchronous <script> in <head>, before the body is
   parsed. That is deliberate and is the one exception to "scripts go at the
   end": a saved choice has to land on <html> before the first paint, or a
   dark-mode visitor sees a white flash on every page load.

   With no saved choice, nothing is set and the CSS media query follows the
   operating system. The toggle writes an explicit data-theme, which wins in
   both directions (see the two selectors at the end of tokens/colors.css).
   ============================================================ */
(function () {
  "use strict";
  const KEY = "theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  // localStorage can throw (private mode, storage disabled). A broken toggle
  // must never break the page, so every access is guarded.
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* fall back to the OS */ }
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  const current = () => root.getAttribute("data-theme") || (media.matches ? "dark" : "light");

  // The button's label never changes ("dark mode"); aria-pressed carries the
  // state. Changing the label AND the pressed state reads as contradictory
  // to a screen reader, so only one of them moves.
  const sync = () => {
    const dark = current() === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(dark));
    });
  };

  // One delegated listener: the buttons don't exist yet while this runs.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    const next = current() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch { /* still works this visit */ }
    sync();
  });

  document.addEventListener("DOMContentLoaded", sync);
  media.addEventListener("change", sync);   // OS switched while the page is open
})();
