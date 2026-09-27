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
  start().catch(() => root.classList.remove("is-live"));   // the still stays
}

async function start() {
  const THREE = await import(THREE_URL);
  const { buildDesk } = await import("./scenes/desk.js");
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
  let dirty = true;
  let glide = null;

  new ResizeObserver(() => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    dirty = true;
  }).observe(canvas);

  // Draw only while the desk is on screen. Coming back, reset the camera
  // in case a click glided it toward an object.
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen && !glide) { camera.position.copy(home); dirty = true; }
  }).observe(root);

  // Keep each link on its object as the camera moves.
  const p = new THREE.Vector3();
  const placeSpots = () => {
    for (const a of spots) {
      p.copy(desk.anchors[a.dataset.spot]).project(camera);
      a.style.setProperty("--x", `${(((p.x + 1) / 2) * 100).toFixed(2)}%`);
      a.style.setProperty("--y", `${(((1 - p.y) / 2) * 100).toFixed(2)}%`);
    }
  };

  for (const a of spots) {
    const name = a.dataset.spot;
    const light = (on) => () => { desk.highlight(name, on); dirty = true; };
    a.addEventListener("pointerenter", light(true));
    a.addEventListener("focus", light(true));
    a.addEventListener("pointerleave", light(false));
    a.addEventListener("blur", light(false));
    a.addEventListener("click", (e) => {
      // Reduced motion, or opening in a new tab: plain navigation.
      if (REDUCED || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const from = camera.position.clone();
      const to = from.clone().lerp(desk.anchors[name], 0.35);
      const t0 = performance.now();
      glide = (now) => {
        const k = Math.min(1, (now - t0) / 450);
        camera.position.lerpVectors(from, to, k * k * (3 - 2 * k));
        if (k === 1) { glide = null; location.href = a.href; camera.position.copy(home); }
      };
    });
  }

  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!onScreen || document.hidden) return;
    if (glide) glide(now);
    else if (SWAYS) camera.position.x = home.x + Math.sin(now / 5000) * 0.06;   // slow sway
    else if (!dirty) return;
    camera.lookAt(desk.camera.target);
    // project() reads the camera's world matrix, which render() would only
    // refresh afterwards. Without this, a desk that draws one frame (phones,
    // reduced motion) places its links from a stale camera.
    camera.updateMatrixWorld();
    placeSpots();
    renderer.render(scene, camera);
    dirty = false;
  };
  requestAnimationFrame(frame);
  root.classList.add("is-live");
}
