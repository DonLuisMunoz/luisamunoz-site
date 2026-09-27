/* ============================================================
   scenes/desk.js — Luis's desk in Tampa, built from boxes and cylinders.

   No model files and no loaders. Every colour is a CSS token read through
   `token()`, so the palette still lives in site/css/tokens/colors.css and
   nowhere else (tests/css-tokens.test.js checks both). The paintings and the
   monitor's screen are drawn on a <canvas> at runtime.

   buildDesk(THREE, scene, time, token) returns
     camera     { position, target } — where stage.js puts the camera
     anchors    world points the links sit on, one per object
     highlight  (name, on) — brighten an object while its link is hovered
   ============================================================ */

// How much light, per preset. Colours come from tokens; only the amounts
// live here, because they are numbers, not palette.
const LIGHT = {
  day: { ambient: 2.6, window: 3.2, screen: 0.3 },
  dusk: { ambient: 1.2, window: 2.4, screen: 0.6 },
  night: { ambient: 0.25, window: 0.3, screen: 1.2 },
};

export function buildDesk(THREE, scene, time, token) {
  const color = (name) => new THREE.Color(token(name));
  const level = LIGHT[time] || LIGHT.day;
  const groups = {};

  const mat = (name) =>
    new THREE.MeshStandardMaterial({ color: color(name), roughness: 0.85, flatShading: true });

  function box(w, h, d, name, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(name));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function group(name) {
    const g = new THREE.Group();
    groups[name] = g;
    scene.add(g);
    return g;
  }

  function painted(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ---- The room ----
  box(6, 0.02, 6, "--ink", 0, 0, 0);          // floor
  box(6, 3, 0.05, "--wall", 0, 1.5, -1.25);    // back wall
  box(0.05, 3, 6, "--wall", 1.45, 1.5, 0);     // right wall, with the window

  // ---- Desk ----
  box(1.6, 0.04, 0.72, "--scene-desk", 0, 0.74, 0);
  for (const x of [-0.76, 0.76]) {
    for (const z of [-0.32, 0.32]) box(0.04, 0.72, 0.04, "--shelf", x, 0.36, z);
  }

  // ---- Dell monitor on a single arm ----
  const monitor = group("monitor");
  box(0.05, 0.04, 0.08, "--scene-metal", 0.1, 0.78, -0.3, monitor);   // clamp
  box(0.03, 0.36, 0.03, "--scene-metal", 0.1, 0.96, -0.3, monitor);   // post
  box(0.03, 0.03, 0.24, "--scene-metal", 0.1, 1.14, -0.19, monitor);  // arm
  box(0.62, 0.37, 0.03, "--shelf", 0.1, 1.15, -0.08, monitor);        // body
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.59, 0.33),
    new THREE.MeshBasicMaterial({ map: painted(512, 288, (g, w, h) => {
      g.fillStyle = token("--shelf");
      g.fillRect(0, 0, w, h);
      // Twelve lines of "code", the same on every load.
      const inks = ["--syn-keyword", "--code-text", "--syn-string", "--code-text"];
      const indent = [0, 1, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0];
      indent.forEach((n, i) => {
        g.fillStyle = token(inks[i % inks.length]);
        g.fillRect(24 + n * 28, 20 + i * 21, 60 + ((i * 97) % 220), 9);
      });
    }) }),
  );
  screen.position.set(0.1, 1.15, -0.064);
  monitor.add(screen);

  // ---- MacBook, lid open, cabled to the monitor ----
  const laptop = group("laptop");
  box(0.31, 0.015, 0.22, "--scene-metal", 0.5, 0.768, 0.12, laptop);
  const hinge = new THREE.Group();
  hinge.position.set(0.5, 0.775, 0.01);
  hinge.rotation.x = -0.25;                                   // leaning back, open
  box(0.31, 0.21, 0.01, "--scene-metal", 0, 0.105, 0, hinge); // lid
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18),
    new THREE.MeshBasicMaterial({ color: color("--shelf") }));
  lcd.position.set(0, 0.105, 0.006);
  hinge.add(lcd);
  laptop.add(hinge);
  const cable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.35, 0.77, 0.08),
    new THREE.Vector3(0.25, 0.765, -0.05),
    new THREE.Vector3(0.12, 0.8, -0.26),
  ]);
  laptop.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 24, 0.004, 6), mat("--shelf")));

  // ---- Black IKEA shelf against the back wall: 2 × 4 cubbies ----
  const shelf = group("shelf");
  const S = { x: -0.8, z: -1.02, w: 0.77, h: 1.47, d: 0.39, t: 0.03 };
  for (const x of [S.x - S.w / 2, S.x, S.x + S.w / 2]) box(S.t, S.h, S.d, "--shelf", x, S.h / 2, S.z, shelf);
  for (let i = 0; i <= 4; i++) box(S.w, S.t, S.d, "--shelf", S.x, (S.h / 4) * i, S.z, shelf);
  const left = S.x - S.w / 4;
  const right = S.x + S.w / 4;
  const row = (i) => (S.h / 4) * i;                            // top surface of shelf i

  // Two paintings leaning in the top row. Placeholders until Luis's own.
  const sunset = painted(256, 280, (g, w, h) => {
    g.fillStyle = token("--wall"); g.fillRect(0, 0, w, h);
    g.fillStyle = token("--dusk"); g.beginPath(); g.arc(w / 2, h * 0.45, w * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = token("--bay"); g.fillRect(0, h * 0.55, w, h * 0.45);
  });
  const blocks = painted(256, 280, (g, w, h) => {
    g.fillStyle = token("--ink"); g.fillRect(0, 0, w, h);
    g.fillStyle = token("--bay"); g.fillRect(w * 0.1, h * 0.1, w * 0.5, h * 0.45);
    g.fillStyle = token("--dusk"); g.fillRect(w * 0.45, h * 0.5, w * 0.45, h * 0.4);
  });
  for (const [map, x] of [[sunset, left], [blocks, right]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.29),
      new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
    p.position.set(x, row(3) + 0.18, S.z - 0.02);
    p.rotation.x = -0.12;
    shelf.add(p);
  }

  // Three figurines in the third row.
  [[left - 0.08, "--dusk"], [left + 0.06, "--bay"], [right, "--wall"]].forEach(([x, name], i) => {
    const tall = 0.12 + i * 0.02;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, tall, 8), mat(name));
    body.position.set(x, row(2) + tall / 2, S.z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(name));
    head.position.set(x, row(2) + tall + 0.025, S.z);
    shelf.add(body, head);
  });

  // The homelab: a small box in the second row. Phase 3 gives it lights and a link.
  const homelab = group("homelab");
  box(0.22, 0.07, 0.2, "--scene-metal", left, row(1) + 0.05, S.z, homelab);

  // ---- The window on the right wall ----
  const win = group("window");
  const W = { x: 1.42, y: 1.45, z: -0.35, w: 0.9, h: 1.0 };
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W.w, W.h),
    new THREE.MeshBasicMaterial({ color: color("--scene-sky") }));
  glass.position.set(W.x, W.y, W.z);
  glass.rotation.y = -Math.PI / 2;
  win.add(glass);
  for (const dz of [-W.w / 2, 0, W.w / 2]) box(0.04, W.h + 0.06, 0.04, "--scene-metal", W.x - 0.01, W.y, W.z + dz, win);
  for (const dy of [-W.h / 2, W.h / 2]) box(0.04, 0.04, W.w + 0.06, "--scene-metal", W.x - 0.01, W.y + dy, W.z, win);

  // ---- Light ----
  scene.add(new THREE.HemisphereLight(color("--scene-sky"), color("--ink"), level.ambient));
  const sun = new THREE.DirectionalLight(color("--scene-light"), level.window);
  sun.position.set(3, 2.2, W.z);
  sun.target.position.set(-0.3, 0.8, -0.2);
  scene.add(sun, sun.target);
  const glow = new THREE.PointLight(color("--scene-screen"), level.screen, 3, 1);
  glow.position.set(0.1, 1.15, 0.3);
  scene.add(glow);

  const off = new THREE.Color(0, 0, 0);
  const lit = color("--scene-screen");

  return {
    camera: { position: new THREE.Vector3(-0.35, 1.55, 2.6), target: new THREE.Vector3(0.2, 1.0, -0.6) },
    anchors: {
      monitor: new THREE.Vector3(0.1, 1.15, -0.06),
      laptop: new THREE.Vector3(0.5, 0.86, 0.1),
      shelf: new THREE.Vector3(S.x, 1.0, S.z + 0.2),
      window: new THREE.Vector3(W.x, W.y, W.z - W.w * 0.3),   // inward, so the label fits on phones
      homelab: new THREE.Vector3(left, row(1) + 0.05, S.z + 0.1),
    },
    highlight(name, on) {
      groups[name]?.traverse((o) => {
        if (!o.material?.emissive) return;
        o.material.emissive.copy(on ? lit : off);
        o.material.emissiveIntensity = on ? 0.2 : 0;
      });
    },
  };
}
