/* ============================================================
   stage.js — the 3D desk in the hero. ES module, home page only.

   three.js is the site's one runtime dependency (see CLAUDE.md). It is
   pinned, fetched only after the page's text is on screen, and optional:
   if WebGL is missing or the import fails, the still image and the same
   links stay put, and nothing else on the page notices.
   ============================================================ */
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.186.1/+esm";
const ASPECT = 16 / 10;   // must match .desk { aspect-ratio } in pages/hero.css
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Phones get the lighter version: fixed camera, no antialiasing, 1x pixels.
const SMALL = matchMedia("(max-width: 860px)").matches;
const SWAYS = !REDUCED && !SMALL;

const root = document.querySelector("[data-desk]");
const canvas = root?.querySelector("[data-desk-canvas]");
const spots = root ? [...root.querySelectorAll("[data-spot]")] : [];

// Probe a throwaway canvas: asking the real one would fix its context
// attributes before three.js gets to choose them.
function hasWebGL() {
  try { return Boolean(document.createElement("canvas").getContext("webgl2")); }
  catch { return false; }
}

if (canvas && hasWebGL()) {
  start().catch(() => {});   // the still and the links stay
}

async function start() {
  const [THREE, { buildDesk }] = await Promise.all([import(THREE_URL), import("./scenes/desk.js")]);
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !SMALL });
  renderer.setPixelRatio(SMALL ? 1 : Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, ASPECT, 0.1, 50);
  const desk = buildDesk(THREE, scene, document.documentElement.dataset.time || "day", token);
  const home = desk.camera.position.clone();
  camera.position.copy(home);

  let onScreen = true;
  let glide = null;
  let pending = false;

  // Draw on demand: a frame is scheduled only when something changed or is
  // moving. Offscreen, in a hidden tab, or at rest, nothing runs at all.
  const request = () => {
    if (!pending) { pending = true; requestAnimationFrame(frame); }
  };

  new ResizeObserver(() => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    request();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; request(); }).observe(root);
  document.addEventListener("visibilitychange", request);

  // Keep each link on its object, in the same style="--x; --y" form the HTML
  // ships with. Written only when it changes, so a still frame costs no style work.
  const p = new THREE.Vector3();
  const placeSpots = () => {
    for (const a of spots) {
      p.copy(desk.anchors[a.dataset.spot]).project(camera);
      const pos = `--x: ${(((p.x + 1) / 2) * 100).toFixed(1)}%; --y: ${(((1 - p.y) / 2) * 100).toFixed(1)}%`;
      if (a.getAttribute("style") !== pos) a.setAttribute("style", pos);
    }
  };

  for (const a of spots) {
    const name = a.dataset.spot;
    for (const [type, on] of [["pointerenter", true], ["focus", true], ["pointerleave", false], ["blur", false]]) {
      a.addEventListener(type, () => { desk.highlight(name, on); request(); });
    }
    a.addEventListener("click", (e) => {
      // Reduced motion, or opening in a new tab: plain navigation.
      if (REDUCED || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const from = camera.position.clone();
      const to = from.clone().lerp(desk.anchors[name], 0.35);
      const t0 = performance.now();
      glide = (now) => {
        const k = Math.min(1, (now - t0) / 450);
        camera.position.lerpVectors(from, to, THREE.MathUtils.smoothstep(k, 0, 1));
        if (k === 1) { glide = null; camera.position.copy(home); location.href = a.href; }
      };
      request();
    });
  }

  function frame(now) {
    pending = false;
    if (!onScreen || document.hidden) return;   // the observers above restart it
    if (glide) glide(now);
    else if (SWAYS) camera.position.x = home.x + Math.sin(now / 5000) * 0.06;   // slow sway
    camera.lookAt(desk.camera.target);
    camera.updateMatrixWorld();   // project() needs it; render() would only refresh it after
    placeSpots();
    renderer.render(scene, camera);
    if (glide || SWAYS) request();   // still moving
  }

  request();
  root.classList.add("is-live");
}
