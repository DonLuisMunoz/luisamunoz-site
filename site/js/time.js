/* ============================================================
   time.js — which light is in the room right now.

   The site is a desk in Tampa and the window tells the time. This picks
   the lighting preset from Tampa's current hour and writes it to
   <html data-time>, which the CSS tokens and the 3D desk both follow.

   A classic script in <head>, not a module, on purpose: it has to run
   before first paint. A module runs after parsing, and a night visitor
   would see a flash of day.
   ============================================================ */
(function () {
  "use strict";
  const ZONE = "America/New_York";   // Tampa. Intl handles daylight saving.

  function tampaHour(date) {
    return Number(new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE, hour: "numeric", hourCycle: "h23",
    }).format(date));
  }

  function presetFor(date) {
    const h = tampaHour(date);
    if (h >= 7 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  if (typeof document !== "undefined") {
    document.documentElement.dataset.time = presetFor(new Date());
  }

  // Exposed for tests/time.test.js, the same way blog.js exposes renderMarkdown.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { tampaHour, presetFor };
  }
})();
