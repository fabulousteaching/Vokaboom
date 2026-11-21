/* Welten-Lauf – 3D-Lauf-Spiel mit dem eigenen Avatar (gemeinsam für Teilmal und Vokaboom; die Datei ist in beiden Repositories gleich)
 *
 * Braucht three.js (w3Three), den Avatar-Baukasten (js/avatar3d.js) und die Welten (js/runworlds.js).
 * Drei Spuren. Wischen oder Pfeiltasten: ← → Spur wechseln, ↑ springen, ↓ rutschen (in der Luft: schnell runter).
 * Hindernisse: Hürde und Absperrung (drüber springen), Balken oben (drunter durchrutschen), lange Blöcke (ausweichen
 * oder über die Rampe hinauf), erhöhte Wege mit Lücken (drüber springen) und Gräben. Regelmässig kommt ein Tor mit
 * drei Bögen: durch den Bogen mit der richtigen Antwort laufen.
 *
 * Das Tool (Teilmal/Vokaboom) gibt die Fragen und entscheidet über Leben, Punkte und das Ende:
 *   const run = await runnerStart(host, {
 *     world: 'jungle', look,                         // Welt und Avatar-Bauplan
 *     ask: () => ({ html, answers: ['42', '48', '36'], correct: 0, data }),   // nächste Frage
 *     onAnswer: (ok, q, lane) => ({ over }),         // Antwort am Tor
 *     onHit: (kind) => ({ over }),                   // Hindernis getroffen ('crash') oder hinuntergefallen ('fall')
 *     gateEvery: 70, speed: (lv) => …, level: () => 1, hudHTML: '…', sound: true,
 *   });
 *   run.finish() – Lauf beenden (Jubel), run.dispose()
 */
'use strict';

const RN = {
  LW: 2.0,          // Spurbreite (m)
  FS: 0.72,         // Grösse der Figur (Avatar ≈ 1,6 m)
  G: 26,            // Schwerkraft
  JUMP: 9.2,        // Absprung: ≈ 1,6 m hoch, 0,7 s in der Luft (höchste Hürde 1,05 m, Blöcke 1,35 m)
  DIVE: -16,        // ↓ in der Luft
  SLIDE: 0.78,      // Rutschen (s)
  H_STAND: 1.3, H_SLIDE: 0.62,
  LOW: 0.62, HIGH: 1.05, OVER: 1.02, BLOCK: 1.35, PLAT: 2.6,
  AHEAD: 170,       // so weit voraus wird die Strecke geplant (m)
  BEHIND: 24,
};
const rnClamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rnLane = (x) => rnClamp(Math.round(x / RN.LW), -1, 1);

/* ---------------- Voxel-Baukasten für Kulissen (wie in der Garage, aber eigenständig) ---------------- */
function rnBuilder() {
  const s = new VoxSet();
  const pick = (c, x, y, z) => (typeof c === 'function' ? c(x, y, z) : c);
  const B = {
    s,
    put(x, y, z, c, mat = 0) { const cc = pick(c, x, y, z); if (cc != null) s.set(Math.round(x), Math.round(y), Math.round(z), cc, mat); },
    del(x, y, z) { s.del(Math.round(x), Math.round(y), Math.round(z)); },
    box(x0, y0, z0, x1, y1, z1, c, mat = 0) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) B.put(x, y, z, c, mat); },
    /** Quader mit runden Kanten (p gross = eckiger) */
    rbox(x0, y0, z0, x1, y1, z1, c, { mat = 0, p = 3, keep = null } = {}) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2 + 0.5, hy = (y1 - y0) / 2 + 0.5, hz = (z1 - z0) / 2 + 0.5;
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        if (Math.abs((x - cx) / hx) ** p + Math.abs((y - cy) / hy) ** p + Math.abs((z - cz) / hz) ** p > 1) continue;
        if (keep && !keep(x, y, z)) continue;
        B.put(x, y, z, c, mat);
      }
    },
    ell(cx, cy, cz, rx, ry, rz, c, { mat = 0, keep = null } = {}) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 > 1) continue;
        if (keep && !keep(x, y, z)) continue;
        B.put(x, y, z, c, mat);
      }
    },
    /** senkrechter Zylinder; r darf von y abhängen */
    cyl(cx, cz, y0, y1, r, c, { mat = 0, sx = 1, keep = null } = {}) {
      for (let y = y0; y <= y1; y++) {
        const rr = typeof r === 'function' ? r(y) : r;
        if (rr <= 0) continue;
        for (let x = Math.floor(cx - rr * sx); x <= Math.ceil(cx + rr * sx); x++) for (let z = Math.floor(cz - rr); z <= Math.ceil(cz + rr); z++) {
          if (((x - cx) / sx) ** 2 + (z - cz) ** 2 > rr * rr) continue;
          if (keep && !keep(x, y, z)) continue;
          B.put(x, y, z, c, mat);
        }
      }
    },
    /** Rohr entlang x oder z */
    tube(axis, a0, a1, cu, cv, r, c, { mat = 0, keep = null } = {}) {
      for (let a = a0; a <= a1; a++) {
        const rr = typeof r === 'function' ? r(a) : r;
        for (let u = Math.floor(cu - rr); u <= Math.ceil(cu + rr); u++) for (let v = Math.floor(cv - rr); v <= Math.ceil(cv + rr); v++) {
          if ((u - cu) ** 2 + (v - cv) ** 2 > rr * rr) continue;
          const [x, y, z] = axis === 'x' ? [a, v, u] : [u, v, a];
          if (keep && !keep(x, y, z)) continue;
          B.put(x, y, z, c, mat);
        }
      }
    },
    /** dicke Linie von a nach b */
    bar(a, b, r, c, { mat = 0 } = {}) {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 2) || 1;
      for (let i = 0; i <= n; i++) {
        const t = i / n, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t, pz = a[2] + (b[2] - a[2]) * t;
        const rr = typeof r === 'function' ? r(t) : r;
        for (let x = Math.floor(px - rr); x <= Math.ceil(px + rr); x++) for (let y = Math.floor(py - rr); y <= Math.ceil(py + rr); y++) for (let z = Math.floor(pz - rr); z <= Math.ceil(pz + rr); z++) {
          if ((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 <= rr * rr + 0.3) B.put(x, y, z, c, mat);
        }
      }
    },
    /** Kurve durch Punkte (für Äste, Lianen) */
    curve(pts, r, c, opts) { for (let i = 0; i < pts.length - 1; i++) B.bar(pts[i], pts[i + 1], typeof r === 'function' ? (t) => r((i + t) / (pts.length - 1)) : r, c, opts); },
    paint(fn) { for (const v of s.m.values()) { const c = fn(v); if (c != null) { if (Array.isArray(c)) { v.c = c[0]; v.mat = c[1]; } else v.c = c; } } },
    cut(fn) { s.filter((v) => !fn(v.x, v.y, v.z, v)); },
    both(f) { f(1); f(-1); },
  };
  return B;
}
/** Hilfen für Farben */
const rnShade = (c, k) => (typeof vxShade === 'function' ? vxShade(c, k) : c);
const rnHash = (x, y, z, s = 0) => vxRand(Math.round(x), Math.round(y), Math.round(z), s);
/** Farbe leicht variieren (Natur sieht nie einfarbig aus) */
const rnVar = (c, amt = 0.08, seed = 0) => (x, y, z) => rnShade(c, (rnHash(x, y, z, seed) - 0.5) * 2 * amt);
/** Voxel-Bauplan → glatte Geometrie in Metern: u = Kantenlänge eines Voxels, Ursprung unten in der Mitte */
function rnGeo(T, B, { u = 0.1, iter = 4, field = 1.2, project = true } = {}) {
  const { geo } = vxSmoothGeometry(T, B.s, { iter, field, project });
  const k = u / VOX.S;
  geo.scale(k, k, k);
  geo.translate(-u / 2, 0, -u / 2);
  const out = rnIndex(T, geo);
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}
/** Halbe Auflösung (für weit entfernte Teile): 2×2×2 Voxel → 1, wenn mindestens min davon gefüllt sind */
function rnDown(set, min = 2) {
  const cells = new Map();
  for (const v of set.m.values()) {
    const x = Math.floor(v.x / 2), y = Math.floor(v.y / 2), z = Math.floor(v.z / 2), k = vxK(x, y, z);
    const c = cells.get(k);
    if (c) c.n++; else cells.set(k, { x, y, z, n: 1, c: v.c, mat: v.mat });
  }
  const out = new VoxSet();
  for (const c of cells.values()) if (c.n >= min) out.set(c.x, c.y, c.z, c.c, c.mat);
  return out;
}
/** Gleiche Eckpunkte zusammenfassen (gleiche Lage, Normale und Farbe) – spart der Grafikkarte viel Arbeit */
function rnIndex(T, geo) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array;
  const n = P.length / 3, map = new Map(), idx = new Uint32Array(n);
  const oP = [], oN = [], oC = [];
  const q = (x, m) => Math.round(x * m);
  for (let i = 0; i < n; i++) {
    const k = `${q(P[i * 3], 1e4)},${q(P[i * 3 + 1], 1e4)},${q(P[i * 3 + 2], 1e4)},${q(N[i * 3], 100)},${q(N[i * 3 + 1], 100)},${q(N[i * 3 + 2], 100)},${q(C[i * 3], 255)},${q(C[i * 3 + 1], 255)},${q(C[i * 3 + 2], 255)}`;
    let j = map.get(k);
    if (j == null) { j = oP.length / 3; map.set(k, j); oP.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); oN.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); oC.push(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]); }
    idx[i] = j;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(oP, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(oN, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(oC, 3));
  g.setIndex(new T.BufferAttribute(oP.length / 3 > 65535 ? idx : new Uint16Array(idx), 1));
  for (const gr of geo.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  geo.dispose();
  return g;
}

/* ---------------- Texturen aus dem Canvas ---------------- */
function rnCanvasTex(T, w, h, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
}
function rnGlowTex(T, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return rnCanvasTex(T, 64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, { repeat: false });
}
/** Schild mit Text (Antwort am Tor) – Schrift passt sich der Länge an */
function rnLabelTex(T, text, { bg = '#ffffff', fg = '#14213d', border = '#f5b301', w = 512, h = 256 } = {}) {
  return rnCanvasTex(T, w, h, (g) => {
    const r = 46;
    g.fillStyle = border; rnRound(g, 6, 6, w - 12, h - 12, r); g.fill();
    g.fillStyle = bg; rnRound(g, 22, 22, w - 44, h - 44, r - 14); g.fill();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const t = String(text);
    let fs = 150;
    const font = (s) => `800 ${s}px "Baloo 2", "Nunito", system-ui, sans-serif`;
    g.font = font(fs);
    while (fs > 30 && g.measureText(t).width > w - 80) { fs -= 6; g.font = font(fs); }
    g.fillText(t, w / 2, h / 2 + fs * 0.06);
  }, { repeat: false });
}
function rnRound(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ---------------- Platten (Boden, Rampen, erhöhte Wege) mit Texturen in Weltgrösse ---------------- */
/** Platte von d0 bis d1 (Laufrichtung = -z), x0..x1, Oberkante h0 → h1 (Rampe), Unterkante bottom. Gruppe 0 = oben, 1 = Seiten */
function rnSlab(T, d0, d1, x0, x1, h0, h1, bottom, tile = 4) {
  const P = [], N = [], U = [], idx = [];
  const z0 = -d0, z1 = -d1;
  const quad = (a, b, c, d, n, uv) => {
    const i = P.length / 3;
    for (const [p, t] of [[a, uv[0]], [b, uv[1]], [c, uv[2]], [d, uv[3]]]) { P.push(...p); N.push(...n); U.push(...t); }
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  const len = Math.hypot(d1 - d0, h1 - h0);
  const ny = (d1 - d0) / len, nz = -(h1 - h0) / len; // Normale der Oberseite (zeigt nach oben, leicht nach vorne bei Rampen)
  const tu = (x) => x / tile, tv = (d) => d / tile;
  // oben
  quad([x0, h0, z0], [x1, h0, z0], [x1, h1, z1], [x0, h1, z1], [0, ny, -nz], [[tu(x0), tv(d0)], [tu(x1), tv(d0)], [tu(x1), tv(d0 + len)], [tu(x0), tv(d0 + len)]]);
  const g0 = idx.length;
  // links / rechts
  quad([x0, bottom, z1], [x0, bottom, z0], [x0, h0, z0], [x0, h1, z1], [-1, 0, 0], [[tv(d1), bottom / tile], [tv(d0), bottom / tile], [tv(d0), h0 / tile], [tv(d1), h1 / tile]]);
  quad([x1, bottom, z0], [x1, bottom, z1], [x1, h1, z1], [x1, h0, z0], [1, 0, 0], [[tv(d0), bottom / tile], [tv(d1), bottom / tile], [tv(d1), h1 / tile], [tv(d0), h0 / tile]]);
  // vorne (Richtung Spieler) und hinten
  quad([x0, bottom, z0], [x1, bottom, z0], [x1, h0, z0], [x0, h0, z0], [0, 0, 1], [[tu(x0), bottom / tile], [tu(x1), bottom / tile], [tu(x1), h0 / tile], [tu(x0), h0 / tile]]);
  quad([x1, bottom, z1], [x0, bottom, z1], [x0, h1, z1], [x1, h1, z1], [0, 0, -1], [[tu(x1), bottom / tile], [tu(x0), bottom / tile], [tu(x0), h1 / tile], [tu(x1), h1 / tile]]);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
  geo.setIndex(idx);
  geo.addGroup(0, g0, 0); geo.addGroup(g0, idx.length - g0, 1);
  geo.computeBoundingSphere();
  return geo;
}

/* ---------------- Ringpuffer für viele gleiche Teile (ein Zeichenaufruf pro Art) ---------------- */
function rnPool(T, scene, geo, mats, cap, { shadow = false, receive = true } = {}) {
  const m = new T.InstancedMesh(geo, mats, cap);
  m.instanceMatrix.setUsage(T.DynamicDrawUsage);
  m.frustumCulled = false;
  m.castShadow = shadow; m.receiveShadow = receive;
  const zero = new T.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < cap; i++) m.setMatrixAt(i, zero);
  scene.add(m);
  const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), S = new T.Vector3(), V = new T.Vector3();
  m.count = 0;
  const pool = {
    mesh: m, next: 0, cap, dirty: false,
    /** Teil setzen; liefert die Nummer (für späteres Ausblenden) */
    add(x, y, z, ry = 0, sc = 1, rx = 0, rz = 0) {
      const i = pool.next; pool.next = (pool.next + 1) % cap;
      if (m.count < cap) m.count = Math.max(m.count, i + 1);
      E.set(rx, ry, rz); Q.setFromEuler(E);
      S.set(typeof sc === 'number' ? sc : sc[0], typeof sc === 'number' ? sc : sc[1], typeof sc === 'number' ? sc : sc[2]);
      M.compose(V.set(x, y, z), Q, S);
      m.setMatrixAt(i, M); pool.dirty = true;
      return i;
    },
    hide(i) { m.setMatrixAt(i, zero); pool.dirty = true; },
    flush() { if (pool.dirty) { m.instanceMatrix.needsUpdate = true; pool.dirty = false; } },
  };
  return pool;
}

/* =========================================================
   Das Spiel
   ========================================================= */
async function runnerStart(host, opts) {
  const T = await w3Three();
  if (typeof w3LoadEngine === 'function') await w3LoadEngine();
  const W = RUN_WORLDS[opts.world] || RUN_WORLDS[Object.keys(RUN_WORLDS)[0]];
  const o = { gateEvery: 78, speed: (n) => Math.min(14.5, 8.8 + n * 0.18), sound: true, ...opts };
  const sound = (f, ...a) => { if (o.sound && typeof window[f] === 'function') try { window[f](...a); } catch { /* */ } };
  const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /* DOM */
  host.classList.add('rn', `rn-w-${W.id}`);
  host.innerHTML = `
    <div class="rn-top"><div class="rn-host">${o.hudHTML || ''}</div>
      <div class="rn-stats"><span class="rn-gems" title="Gesammelte Kristalle"><i>💎</i><b id="rngems">0</b></span><span class="rn-speed" title="Tempo – jede richtige Antwort macht dich ein bisschen schneller">⚡ <b id="rnspeed">0</b> km/h</span><span class="rn-dist"><b id="rndist">0</b> m</span></div></div>
    <div class="rn-ask" id="rnask" hidden><small id="rnhint">${esc2(o.hint || 'Lauf durch das richtige Ergebnis')}</small><div class="rn-q" id="rnq"></div><div class="rn-ans" id="rnans"></div></div>
    <div class="rn-count" id="rncount"></div>
    <div class="rn-help" id="rnhelp"><span><b>← →</b> Spur</span><span><b>↑</b> springen</span><span><b>↓</b> schnell landen</span><small>Wischen oder Pfeiltasten</small></div>
    <div class="rn-flash" id="rnflash"></div>
    <div class="rn-load" id="rnload"><span class="spinner big"></span><p>${esc2(W.name)} wird gebaut …</p></div>`;
  const $h = (id) => host.querySelector('#' + id);
  const elSpeed = $h('rnspeed'), elAsk = $h('rnask'), elQ = $h('rnq'), elAns = $h('rnans'), elHint = $h('rnhint'), elGems = $h('rngems'), elDist = $h('rndist'), elCount = $h('rncount'), elFlash = $h('rnflash');
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30))); // Ladeanzeige zeigen, bevor gebaut wird

  /* Renderer */
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  let pr = Math.min(DPR, 1.75);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = W.exposure ?? 1;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.domElement.className = 'rn-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(62, 1, 0.3, 400);
  const resize = () => { const r = host.getBoundingClientRect(); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false); camera.aspect = Math.max(1, r.width) / Math.max(1, r.height); camera.fov = camera.aspect < 0.8 ? 74 : 62; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  /* Welt: Licht, Himmel, Nebel */
  const fogC = new T.Color(W.fog);
  scene.fog = new T.Fog(fogC, W.fogNear ?? 30, W.fogFar ?? 140);
  scene.background = fogC;
  const hemi = new T.HemisphereLight(W.hemi[0], W.hemi[1], W.hemi[2]); scene.add(hemi);
  const sun = new T.DirectionalLight(W.sun[0], W.sun[1]);
  const sunDir = new T.Vector3(...(W.sunDir || [-0.5, 1, 0.4])).normalize();
  sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 26, bottom: -14, near: 1, far: 90 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const skyTex = rnCanvasTex(T, 16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, W.sky[0]); gr.addColorStop(0.5, W.sky[1]); gr.addColorStop(1, W.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: false });
  const sky = new T.Mesh(new T.SphereGeometry(320, 32, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; scene.add(sky);
  try {
    const env = new T.Scene();
    env.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide })));
    const sb = new T.Mesh(new T.SphereGeometry(1.4, 16, 8), new T.MeshBasicMaterial({ color: 0xffffff })); sb.position.copy(sunDir).multiplyScalar(8); env.add(sb);
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.02).texture; scene.environmentIntensity = W.env ?? 0.8; pm.dispose();
  } catch { /* ohne Spiegelungen */ }

  const own = []; // alles, was beim Beenden weg muss
  const ownGeo = (g) => { own.push(g); return g; };
  const ctx = { T, scene, camera, renderer, W, own, ownGeo, sunDir, time: 0, rnd: Math.random, frameFns: [], pools: {}, mats: {}, LW: RN.LW };
  ctx.onFrame = (f) => ctx.frameFns.push(f);
  const mats = vxMaterials(T);
  ctx.vmats = mats;

  /* Bauteile der Welt (einmal bauen, dann viele Male zeigen) */
  const t0 = performance.now();
  const kinds = {};
  for (const [k, def] of Object.entries(W.props || {})) {
    try {
      if (def.mesh) { const M = def.mesh(T, ctx); kinds[k] = { def, geo: ownGeo(M.geo), lo: null, mat: M.mat }; [].concat(M.mat).forEach((m) => own.push(m, m.map, m.emissiveMap)); continue; }
      const B = def.build(rnBuilder(), ctx);
      const geo = ownGeo(rnGeo(T, B, def));
      // weit weg: halbe Auflösung (wird beim Näherkommen gegen die feine Version getauscht)
      const lo = def.lod === false ? null : ownGeo(rnGeo(T, { s: rnDown(B.s, def.lodMin ?? 2) }, { ...def, u: def.u * 2, iter: Math.max(1, (def.iter ?? 3) - 1), field: (def.field ?? 1) * 0.75 }));
      kinds[k] = def.farOnly && lo ? { def, geo: lo, lo: null } : { def, geo, lo }; // farOnly: steht immer weit weg (Hintergrund)
    } catch (e) { console.warn('Kulisse', k, e); }
  }
  const obsGeo = {};
  for (const [k, def] of Object.entries(W.obstacles || {})) {
    try { obsGeo[k] = ownGeo(rnGeo(T, def.build(rnBuilder(), ctx), def)); } catch (e) { console.warn('Hindernis', k, e); }
  }
  const gateGeo = ownGeo(rnGeo(T, W.gate.build(rnBuilder(), ctx), W.gate));
  console.info(`Welten-Lauf: ${W.id} in ${Math.round(performance.now() - t0)} ms gebaut`);
  // Wie viele Teile pro Art gleichzeitig sichtbar sind: Probelauf der Verteilung über 400 m
  const SCN_AHEAD = (W.fogFar ?? 120) + 12, NEAR = 40, BACK = 10;
  const perSlice = {};
  {
    const cnt = {}; const put0 = (k) => { cnt[k] = (cnt[k] || 0) + 1; };
    const dry = { ...ctx, put: put0, ground: () => 0 };
    for (let d = 0; d < 400; d += 10) W.scatter?.(dry, d, d + 10);
    for (const [k, n] of Object.entries(cnt)) perSlice[k] = n / 40;
  }
  for (const [k, K] of Object.entries(kinds)) {
    const ps = perSlice[k] || 0, extra = K.def.cap || 0;
    const nearCap = Math.ceil(ps * ((NEAR + BACK + 10) / 10) * 1.4) + 4 + extra;
    const farCap = Math.ceil(ps * ((SCN_AHEAD - NEAR + 10) / 10) * 1.4) + 4 + extra;
    ctx.pools[k] = {
      near: rnPool(T, scene, K.geo, K.mat || mats, K.lo ? nearCap : nearCap + farCap, { shadow: !!K.def.shadow }),
      far: K.lo ? rnPool(T, scene, K.lo, mats, farCap, { shadow: false }) : null,
    };
  }
  const obsPools = {};
  for (const [k, g] of Object.entries(obsGeo)) obsPools[k] = rnPool(T, scene, g, mats, W.obstacles[k].cap || 24, { shadow: true });
  const gatePool = rnPool(T, scene, gateGeo, mats, 12, { shadow: true });

  /* Boden: Texturen */
  const groundTop = rnCanvasTex(T, 512, 512, W.ground.top);
  const groundSide = rnCanvasTex(T, 256, 256, W.ground.side);
  const gTop = new T.MeshStandardMaterial({ map: groundTop, roughness: W.ground.rough ?? 0.9, metalness: 0 });
  const gSide = new T.MeshStandardMaterial({ map: groundSide, roughness: 0.95 });
  const pTopTex = rnCanvasTex(T, 512, 512, (W.plat || W.ground).top), pSideTex = rnCanvasTex(T, 256, 256, (W.plat || W.ground).side);
  const pTop = new T.MeshStandardMaterial({ map: pTopTex, roughness: 0.85 }), pSide = new T.MeshStandardMaterial({ map: pSideTex, roughness: 0.9 });
  own.push(groundTop, groundSide, pTopTex, pSideTex, gTop, gSide, pTop, pSide, skyTex);
  ctx.mats.ground = [gTop, gSide]; ctx.mats.plat = [pTop, pSide];
  // Gelände neben der Bahn: grosse Fläche, die mitwandert (Textur bleibt an der Welt kleben)
  let side = null;
  if (W.side) {
    const sTex = rnCanvasTex(T, 512, 512, W.side.draw);
    sTex.repeat.set(W.side.size / W.side.tile, W.side.size / W.side.tile);
    side = new T.Mesh(new T.PlaneGeometry(W.side.size, W.side.size), new T.MeshStandardMaterial({ map: sTex, roughness: 1 }));
    side.rotation.x = -Math.PI / 2; side.position.y = W.side.y; side.receiveShadow = true; scene.add(side);
    own.push(sTex, side.geometry, side.material);
  }
  // Abgrund / Wasser unter Lücken: Fläche, die mitwandert
  const pitMat = W.pit.water
    ? new T.MeshStandardMaterial({ color: W.pit.color, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 })
    : new T.MeshBasicMaterial({ color: W.pit.color });
  const pit = new T.Mesh(new T.PlaneGeometry(W.pit.w || 60, 400), pitMat);
  pit.rotation.x = -Math.PI / 2; pit.position.y = W.pit.y; scene.add(pit);
  own.push(pit.geometry, pitMat);

  /* Kristalle (zum Einsammeln) */
  const gemGeo = ownGeo(new T.OctahedronGeometry(0.26, 0));
  const gemMat = new T.MeshStandardMaterial({ color: W.gem || 0x7df9ff, emissive: W.gem || 0x22d3ee, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.3 });
  own.push(gemMat);
  const gemPool = rnPool(T, scene, gemGeo, gemMat, 120, { shadow: false });
  const gemGlow = new T.SpriteMaterial({ map: rnGlowTex(T, 'rgba(160,250,255,.9)', 'rgba(160,250,255,0)'), transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  own.push(gemGlow.map, gemGlow);

  /* Welt-eigene Extras (Hintergrund, Lichtstrahlen, Fische …) */
  W.extras?.(ctx);

  /* Spielfigur */
  const look = o.look || (typeof a3Mine === 'function' ? a3Mine() : null);
  const fig = vxFigure(T, look || {});
  const figWrap = new T.Group(); figWrap.add(fig.root); fig.root.scale.setScalar(RN.FS);
  fig.root.rotation.y = Math.PI; // läuft Richtung -z
  fig.root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
  scene.add(figWrap);
  W.decorate?.(ctx, figWrap); // z. B. Taucherhelm unter Wasser
  const blob = new T.Mesh(new T.CircleGeometry(0.42, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob); own.push(blob.geometry, blob.material);

  /* ---------------- Strecke: Bauplan ---------------- */
  // ground: [{ d0, d1, h0, h1, plat, pit }] durchgehend (Lücken = Löcher dazwischen)
  // obs:    [{ d0, d1, lane, kind, yb, yt, top (begehbar), pool, i, hit }]
  // gates:  [{ d, q, passed, labels: [mesh] }]
  const S = {
    d: 0, x: 0, lane: 0, y: 0, vy: 0, ground: true, ok: 0, lastGh: 0, endWhy: '', slide: 0, speed: 0, base: 0, slow: 0, inv: 0, gems: 0,
    over: false, finishing: false, started: false, crashT: 0, respawn: null, lastGate: -1, cam: new T.Vector3(), camY: 2.5, shake: 0,
  };
  const segs = [], obs = [], gates = [], gems = [], built = [];
  let genD = 0;             // so weit ist geplant
  let nextGate = 55;        // erstes Tor
  let clearUntil = 30;      // Anlauf ohne Hindernisse
  const gateEvery = () => o.gateEvery * (0.92 + Math.random() * 0.16);
  const R = (a, b) => a + Math.random() * (b - a);
  const laneX = (l) => l * RN.LW;
  const TRACK_W = RN.LW * 3 + 0.6 + (W.edge || 0) * 2, X0 = -TRACK_W / 2, X1 = TRACK_W / 2;
  const level = () => 1 + Math.floor(S.ok / 5); // Schwierigkeit der Strecke (alle 5 richtigen etwas mehr)

  function addSeg(d0, d1, h0, h1 = h0, plat = false) {
    const s = { d0, d1, h0, h1, plat };
    const geo = rnSlab(T, d0, d1, X0, X1, h0, h1, plat ? Math.min(h0, h1) - 0.55 : (W.ground.bottom ?? -3), 4);
    s.mesh = new T.Mesh(geo, plat ? ctx.mats.plat : ctx.mats.ground);
    s.mesh.receiveShadow = true; s.mesh.castShadow = plat;
    scene.add(s.mesh); segs.push(s);
    W.onSeg?.(ctx, s);
    return s;
  }
  function addObs(kind, lane, d, len = 0) {
    const def = W.obstacles[kind];
    const pool = obsPools[kind];
    if (!def || !pool) return null;
    const dd = def.len ?? len;
    const ob = { kind, lane, d0: d - (def.depth ?? 0.25), d1: d + Math.max(def.depth ?? 0.25, dd), yb: def.yb ?? 0, yt: def.yt, top: def.top ?? null, ramp: !!def.ramp, hit: false };
    ob.base = groundBase(d);
    ob.i = pool.add(laneX(lane), ob.base, -d, def.ry ?? 0, 1);
    ob.pool = pool;
    obs.push(ob);
    return ob;
  }
  function addGems(lane, d0, n, arc = null, up = 0) {
    for (let k = 0; k < n; k++) {
      const d = d0 + k * 2.2;
      const base = groundBase(d) ?? 0;
      let y = base + 0.75 + up;
      if (arc) { const t = (d - arc[0]) / (arc[1] - arc[0]); if (t > 0 && t < 1) y += Math.sin(t * Math.PI) * 1.25; }
      gems.push({ lane, d, y, i: gemPool.add(laneX(lane), y, -d, 0, 1), got: false });
    }
  }
  /** Bodenhöhe der Grundbahn an der Stelle d (ohne Hindernisse), null = Lücke */
  function groundBase(d) {
    for (let i = segs.length - 1; i >= 0; i--) { const s = segs[i]; if (d >= s.d0 && d <= s.d1) return s.h0 + (s.h1 - s.h0) * ((d - s.d0) / Math.max(0.001, s.d1 - s.d0)); }
    return null;
  }
  /** Bodenhöhe für die Figur: Grundbahn oder Dach eines Blocks / Rampe in dieser Spur */
  function groundAt(d, x, y) {
    let h = groundBase(d);
    const l = rnLane(x);
    for (const ob of obs) {
      if (ob.hit || ob.lane !== l || d < ob.d0 || d > ob.d1) continue;
      if (ob.ramp) { const t = (d - ob.d0) / (ob.d1 - ob.d0); const rh = ob.base + ob.yt * t; if (y >= rh - 0.6) h = Math.max(h ?? -99, rh); }
      else if (ob.top != null && y >= ob.base + ob.top - 0.35) h = Math.max(h ?? -99, ob.base + ob.top);
    }
    return h;
  }

  /* Bauplan erweitern: Muster nacheinander */
  function plan() {
    while (genD < S.d + RN.AHEAD) {
      const lv = level();
      const v = o.speed(S.ok);
      const gap = v * R(1.25, 1.75) * (lv > 3 ? 0.9 : 1);
      const d = genD;
      // Tor fällig?
      if (d + 4 >= nextGate - 14) {
        const gd = Math.max(nextGate, d + 14);
        flat(d, gd + 10);
        addGate(gd);
        nextGate = gd + gateEvery();
        genD = gd + 10;
        continue;
      }
      if (d < clearUntil) { flat(d, clearUntil); genD = clearUntil; continue; }
      const room = nextGate - 14 - d;
      const pick = weighted([
        ['low', 3], ['high', 2.4], ['blocks', 2.4], ['mix', lv > 1 ? 2 : 0.6],
        ['plat', room > 44 && !W.noPlat ? 2.2 : 0], ['ditch', room > 24 ? (W.gapsOften ? 3 : 1.4) : 0], ['gems', 1.2],
      ]);
      let end;
      if (pick === 'plat') end = platform(d, room);
      else if (pick === 'ditch') end = ditch(d);
      else {
        const lead = gap * 0.6, at = d + lead;
        const BL = (W.obstacles.block?.len || 8) + (W.obstacles.ramp?.len || 0);
        const len = Math.max(gap, pick === 'blocks' ? lead + BL + 5 : pick === 'mix' ? lead + 11 : lead + 6);
        if (d + len > nextGate - 14) { flat(d, nextGate - 14); genD = nextGate - 14; continue; } // passt nicht mehr vor das Tor
        flat(d, d + len);
        if (pick === 'low' || pick === 'high' || pick === 'over') row(pick, at);
        else if (pick === 'blocks') blocks(at);
        else if (pick === 'mix') mix(at);
        else addGems(Math.floor(R(-1, 2)), at - 6, 7);
        end = d + len;
      }
      genD = end;
    }
  }
  const weighted = (list) => { const tot = list.reduce((s, [, w]) => s + w, 0); let r = Math.random() * tot; for (const [k, w] of list) { if ((r -= w) <= 0) return k; } return list[0][0]; };
  /** Grundbahn bis d1 verlängern (an die letzte Platte anschliessen) */
  function flat(d0, d1) {
    const last = segs[segs.length - 1];
    if (last && !last.plat && last.h1 === 0 && last.d1 >= d0 - 0.01 && last.d1 - last.d0 < 60) {
      // letzte Platte verlängern: neu bauen
      scene.remove(last.mesh); last.mesh.geometry.dispose(); segs.pop();
      addSeg(last.d0, d1, 0, 0, false);
    } else addSeg(d0, d1, 0, 0, false);
  }
  function row(kind, at) {
    const lanes = kind === 'over' ? (Math.random() < 0.55 ? [-1, 0, 1] : shuffle2([-1, 0, 1]).slice(0, 2)) : shuffle2([-1, 0, 1]).slice(0, kind === 'low' ? 1 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2));
    lanes.forEach((l) => addObs(kind, l, at));
    if (kind === 'low' && Math.random() < 0.5) addGems(lanes[0], at - 4.4, 5, [at - 4.4, at + 4.4]);
  }
  function blocks(at) {
    const free = Math.floor(R(-1, 2));
    const others = [-1, 0, 1].filter((l) => l !== free);
    const n = Math.random() < 0.5 ? 1 : 2;
    const rampAt = Math.floor(Math.random() * n);
    others.slice(0, n).forEach((l, k) => {
      // zwei Blöcke nebeneinander: einer hat immer eine Rampe (sonst müsste man zwei Spuren weit springen)
      const withRamp = k === rampAt && (n === 2 || Math.random() < 0.6) && W.obstacles.ramp;
      const bd = at + (withRamp ? W.obstacles.ramp.len : 0);
      if (withRamp) addObs('ramp', l, at);
      addObs('block', l, bd);
      if (withRamp) addGems(l, bd + 0.8, 4, null, W.obstacles.block.top);
    });
    if (Math.random() < 0.5) addGems(free, at - 2, 5);
  }
  function mix(at) {
    // zwei Reihen kurz hintereinander, immer schaffbar
    const a = shuffle2(['low', 'high', 'low'])[0];
    const l1 = Math.floor(R(-1, 2));
    addObs(a, l1, at - 5);
    const l2 = [-1, 0, 1].filter((l) => l !== l1)[Math.floor(Math.random() * 2)];
    addObs(Math.random() < 0.5 ? 'low' : 'high', l2, at + 5);
  }
  function ditch(d) {
    flat(d, d + 8);
    const w = R(2.2, 3.1) + (level() > 3 ? 0.4 : 0);
    W.onGap?.(ctx, d + 8, d + 8 + w, 0);
    addGems(Math.floor(R(-1, 2)), d + 8 - 2.6, 4, [d + 8 - 2.6, d + 8 + w + 2.6]);
    addSeg(d + 8 + w, d + 16 + w, 0, 0, false);
    return d + 16 + w;
  }
  function platform(d, room = 60) {
    // Rampe hinauf, oben ein Weg mit Lücken, am Ende hinunterspringen (passt immer vor das nächste Tor)
    flat(d, d + 3);
    const H = RN.PLAT;
    addSeg(d + 3, d + 9, 0, H, true);
    let z = d + 9;
    const parts = room > 64 && Math.random() < 0.6 ? 3 : 2;
    const each = Math.min(12, (room - 9 - 10 - (parts - 1) * 3) / parts);
    for (let k = 0; k < parts; k++) {
      const L = R(Math.min(7, each), each);
      addSeg(z, z + L, H, H, true);
      if (k === 0 && Math.random() < 0.6) addGems(Math.floor(R(-1, 2)), z + 2, 4);
      if (Math.random() < 0.35 && L > 9) addObs('low', Math.floor(R(-1, 2)), z + L / 2);
      z += L;
      if (k < parts - 1) {
        const w = R(2.2, 3.0);
        W.onGap?.(ctx, z, z + w, H);
        addGems(Math.floor(R(-1, 2)), z - 2.2, 3, [z - 2.2, z + w + 2.2]);
        z += w;
      }
    }
    W.onPlatform?.(ctx, d + 4, z, H);
    // runter: Lücke bis zum Boden (man fällt sanft auf die Grundbahn)
    addSeg(z, z + 10, 0, 0, false);
    return z + 10;
  }
  function addGate(d) {
    const g = { d, q: null, passed: false, idx: [], labels: [] };
    for (let l = -1; l <= 1; l++) g.idx.push(gatePool.add(laneX(l), 0, -d, 0, 1));
    // Schilder (erst leer, beim Näherkommen kommt die Frage)
    for (let l = -1; l <= 1; l++) {
      const mat = new T.MeshBasicMaterial({ map: blankTex, transparent: true, fog: true });
      const m = new T.Mesh(labelGeo, mat);
      m.position.set(laneX(l), W.gate.labelY ?? 2.55, -d + 0.08);
      scene.add(m); g.labels.push(m);
    }
    gates.push(g);
    W.onGate?.(ctx, d);
  }
  const labelGeo = ownGeo(new T.PlaneGeometry(1.62, 0.81));
  const blankTex = rnLabelTex(T, '?', { bg: '#ffffff', fg: '#9aa3b5', border: W.gate.border || '#f5b301' });
  own.push(blankTex);
  const shuffle2 = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* Frage an das nächste Tor hängen */
  function armGate(g) {
    if (g.q) return;
    const q = o.ask();
    g.q = q; g.shown = performance.now();
    q.answers.forEach((a, i) => {
      const m = g.labels[i];
      m.material.map = rnLabelTex(T, a, { border: W.gate.border || '#f5b301', fg: W.gate.fg || '#14213d' });
      m.material.needsUpdate = true;
    });
    elQ.innerHTML = q.html;
    elAns.innerHTML = q.answers.map((a, i) => `<span class="rn-a" data-i="${i}"><small>${['◀', '▲', '▶'][i]}</small>${esc2(a)}</span>`).join('');
    elAsk.hidden = false; elAsk.className = 'rn-ask'; void elAsk.offsetWidth; elAsk.classList.add('pop');
  }
  function passGate(g) {
    g.passed = true;
    const lane = rnLane(S.x), i = lane + 1;
    const ok = i === g.q.correct;
    const res = o.onAnswer(ok, g.q, i) || {};
    $$h('.rn-a').forEach((el, k) => el.classList.add(k === g.q.correct ? 'right' : k === i ? 'wrong' : 'fade'));
    elAsk.classList.add(ok ? 'ok' : 'bad');
    if (g.q.solved) elQ.innerHTML = g.q.solved;
    if (ok) {
      S.ok++;
      sound('tone', [880, 1175, 1568], 0.08, 'triangle', 0.08);
      burst(laneX(lane), S.y + 1.6, -g.d, 0x86efac, 26);
      S.boost = 1.2; fig.setMood('win'); setTimeout(() => fig.setMood(''), 900);
      flash('good');
    } else {
      sound('tone', [330, 247], 0.14, 'sawtooth', 0.05);
      burst(laneX(lane), S.y + 1.6, -g.d, 0xfca5a5, 18);
      flash('bad');
      if (!res.over) { fig.setAnim('oops'); S.slow = 0.5; setTimeout(() => { if (!S.over) fig.setAnim('run'); }, 450); }
    }
    // Schilder: richtig grün, falsch grau
    g.labels.forEach((m, k) => { m.material.color.set(k === g.q.correct ? 0xa7f3d0 : k === i ? 0xfecaca : 0x9ca3af); });
    if (res.over) { end(ok ? 'done' : 'wrong'); return; }
    setTimeout(() => { if (!S.over && !gates.some((x) => !x.passed && x.q)) elAsk.hidden = true; }, ok ? 900 : 1600);
  }
  const $$h = (sel) => [...host.querySelectorAll(sel)];

  /* ---------------- Effekte ---------------- */
  const sparkGeo = ownGeo(new T.BoxGeometry(0.12, 0.12, 0.12));
  const fx = [];
  function burst(x, y, z, color, n = 20) {
    if (reduce) return;
    const m = new T.MeshBasicMaterial({ color });
    for (let k = 0; k < n; k++) {
      const s = new T.Mesh(sparkGeo, m);
      s.position.set(x + R(-0.4, 0.4), y + R(-0.4, 0.4), z);
      s.userData.v = new T.Vector3(R(-3, 3), R(1, 6), R(-2, 3));
      scene.add(s); fx.push({ s, t: 0, life: R(0.5, 0.9), m });
    }
  }
  function debris(x, y, z) {
    if (reduce) return;
    const cols = [0x8b5e34, 0xa3a3a3, 0x6b7280];
    for (let k = 0; k < 14; k++) {
      const m = new T.MeshStandardMaterial({ color: cols[k % 3], roughness: 0.8 });
      const s = new T.Mesh(sparkGeo, m); s.scale.setScalar(R(1.2, 2.6));
      s.position.set(x + R(-0.7, 0.7), y + R(0, 0.9), z);
      s.userData.v = new T.Vector3(R(-3, 3), R(2, 7), R(-6, -2));
      scene.add(s); fx.push({ s, t: 0, life: 1.1, m });
    }
  }
  let flashT = 0;
  function flash(kind) { elFlash.className = `rn-flash ${kind}`; void elFlash.offsetWidth; elFlash.classList.add('on'); clearTimeout(flashT); flashT = setTimeout(() => elFlash.classList.remove('on'), 260); }

  /* ---------------- Steuerung ---------------- */
  const act = (a) => {
    if (S.over || !S.started || S.respawn) return;
    if (a === 'L' || a === 'R') {
      const to = rnClamp(S.lane + (a === 'L' ? -1 : 1), -1, 1);
      if (to === S.lane) { bump(); return; }
      // Seitlich in einen Block? → zurückprallen
      const blocked = obs.some((ob) => !ob.hit && ob.lane === to && ob.top != null && S.d + 0.4 > ob.d0 && S.d - 0.3 < ob.d1 && S.y < ob.base + ob.top - 0.3);
      if (blocked) { bump(); return; }
      S.lane = to;
      sound('tone', [520], 0.03, 'sine', 0.025);
    } else if (a === 'U') {
      if (S.ground) { S.vy = RN.JUMP; S.ground = false; S.slide = 0; fig.setAnim('leap'); sound('tone', [440, 660], 0.05, 'triangle', 0.04); }
    } else if (a === 'D') {
      if (!S.ground) S.vy = Math.min(S.vy, RN.DIVE);
      S.slide = RN.SLIDE; fig.setAnim('slide'); sound('noise', 0.15, { freq: 900, gain: 0.03 });
    }
  };
  function bump() { S.shake = 0.25; sound('tone', [180], 0.06, 'square', 0.04); }
  const onKey = (e) => {
    const k = { ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R', ArrowUp: 'U', w: 'U', W: 'U', ' ': 'U', ArrowDown: 'D', s: 'D', S: 'D' }[e.key];
    if (!k || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!host.isConnected) return;
    e.preventDefault(); act(k);
  };
  document.addEventListener('keydown', onKey);
  let sw = null;
  const cvs = renderer.domElement;
  const pd = (e) => { sw = { x: e.clientX, y: e.clientY, t: performance.now(), done: false }; };
  const pm = (e) => {
    if (!sw || sw.done) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    sw.done = true;
    act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'U' : 'D'));
  };
  const pu = (e) => {
    if (sw && !sw.done && performance.now() - sw.t < 350) {
      // kurz getippt: links/rechts aussen = Spur, Mitte = springen
      const r = cvs.getBoundingClientRect(), fx2 = (e.clientX - r.left) / r.width;
      act(fx2 < 0.3 ? 'L' : fx2 > 0.7 ? 'R' : 'U');
    }
    sw = null;
  };
  cvs.addEventListener('pointerdown', pd); cvs.addEventListener('pointermove', pm); cvs.addEventListener('pointerup', pu); cvs.addEventListener('pointercancel', () => { sw = null; });
  cvs.style.touchAction = 'none';

  /* ---------------- Treffer ---------------- */
  function crash(ob) {
    if (S.inv > 0) return;
    ob.hit = true; ob.pool.hide(ob.i);
    debris(laneX(ob.lane), ob.base, -(ob.d0 + 0.3));
    sound('noise', 0.3, { freq: 500, gain: 0.08 }); sound('tone', [220, 147], 0.12, 'sawtooth', 0.05);
    S.shake = 0.5; flash('bad');
    const res = o.onHit('crash') || {};
    if (res.over) { end('crash'); return; }
    S.inv = 1.6; S.slow = 0.35; fig.setAnim('oops'); fig.setMood('oops');
    setTimeout(() => { if (!S.over) { fig.setAnim(S.ground ? 'run' : 'leap'); fig.setMood(''); } }, 600);
  }
  function fall() {
    if (S.respawn) return;
    sound('tone', [660, 440, 220], 0.12, 'triangle', 0.06);
    flash('bad');
    const res = o.onHit('fall') || {};
    if (res.over) { end('fall'); return; }
    // nach kurzem Moment auf dem nächsten festen Boden weiter
    let nd = S.d + 1;
    for (let k = 0; k < 80 && groundBase(nd) == null; k++) nd += 0.5;
    S.respawn = { t: 0.9, d: nd + 1.2 };
    fig.setAnim('oops');
  }

  /* Kulisse: in Scheiben zu 10 m, immer bis weit voraus */
  ctx.sceneryD = -40;
  // Jedes Teil gehört zu einer 10-m-Scheibe; weit weg grob, ab NEAR fein
  const slices = new Map();
  ctx.put = (kind, x, y, d, ry = 0, sc = 1, rx = 0, rz = 0) => {
    const P = ctx.pools[kind];
    if (!P) return;
    const si = Math.floor(d / 10);
    let sl = slices.get(si);
    if (!sl) { sl = { list: [], fine: false }; slices.set(si, sl); }
    const fine = sl.fine || !P.far || d < S.d + NEAR;
    const rec = { kind, a: [x, y, -d, ry, sc, rx, rz], fine };
    rec.i = (fine ? P.near : P.far).add(...rec.a);
    sl.list.push(rec);
  };
  ctx.ground = groundBase;
  function scenery() {
    while (ctx.sceneryD < S.d + SCN_AHEAD) { W.scatter?.(ctx, ctx.sceneryD, ctx.sceneryD + 10); ctx.sceneryD += 10; }
    for (const [si, sl] of slices) {
      if (si * 10 + 10 < S.d - BACK) { slices.delete(si); continue; }
      if (!sl.fine && si * 10 < S.d + NEAR) {
        sl.fine = true;
        for (const r of sl.list) if (!r.fine) { const P = ctx.pools[r.kind]; P.far.hide(r.i); r.i = P.near.add(...r.a); r.fine = true; }
      }
    }
  }

  /* ---------------- Ablauf ---------------- */
  plan();
  scenery();
  for (const s of segs) if (s.d1 < 40) { /* Anlauf ist schon gebaut */ }
  S.base = o.speed(0);
  fig.setAnim('idle');
  $h('rnload')?.remove();
  // Countdown
  let raf = 0, last = performance.now();
  const startAt = performance.now() + (o.countdown === false ? 0 : 2400);
  let counted = 4;

  let frames = 0, fpsT = 0, slowFrames = 0, qualityStep = 0;
  let hold = false; // Tests: Bild anhalten und die Logik selbst schrittweise laufen lassen
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (hold) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.time += dt;
    if (!S.started) {
      const left = Math.ceil((startAt - now) / 1000);
      if (left !== counted && left > 0) { counted = left; elCount.textContent = left; elCount.className = 'rn-count'; void elCount.offsetWidth; elCount.classList.add('pop'); sound('tone', [660], 0.08, 'sine', 0.05); }
      if (now >= startAt) {
        S.started = true; elCount.textContent = 'Los!'; elCount.className = 'rn-count go'; void elCount.offsetWidth; elCount.classList.add('pop');
        setTimeout(() => { elCount.textContent = ''; }, 700);
        setTimeout(() => $h('rnhelp')?.classList.add('out'), 2600);
        fig.setAnim('run'); sound('tone', [880, 1320], 0.1, 'triangle', 0.07);
        o.onStart?.();
      }
    }
    step(dt);
    render(dt);
    // Qualität anpassen (langsame Geräte): erst Auflösung, dann Schatten
    frames++; fpsT += dt;
    if (fpsT > 2) {
      const fps = frames / fpsT; frames = 0; fpsT = 0;
      if (fps < 40) slowFrames++; else slowFrames = 0;
      if (slowFrames >= 1 && qualityStep < 3) {
        qualityStep++; slowFrames = 0;
        if (qualityStep === 1) { pr = Math.max(1, pr * 0.75); renderer.setPixelRatio(pr); resize(); }
        else if (qualityStep === 2) { renderer.shadowMap.enabled = false; scene.traverse((m) => { if (m.material) [].concat(m.material).forEach((x) => { x.needsUpdate = true; }); }); }
        else { pr = 1; renderer.setPixelRatio(pr); resize(); scene.fog.far *= 0.85; }
      }
    }
  }

  function step(dt) {
    // Tempo: Grundtempo aus dem Level, kurz langsamer nach einem Treffer, kurz schneller nach richtiger Antwort
    const target = S.started && !S.over ? o.speed(S.ok) : 0;
    S.base += (target - S.base) * (1 - Math.exp(-dt * (S.started ? 1.5 : 6)));
    S.slow = Math.max(0, S.slow - dt);
    S.boost = Math.max(0, (S.boost || 0) - dt);
    S.speed = S.base * (S.slow > 0 ? 0.55 : 1) * (S.boost > 0 ? 1.12 : 1);
    if (S.finishing) S.speed *= 0;
    S.inv = Math.max(0, S.inv - dt);
    fig.setRate(S.speed / 9.5);

    if (S.over && S.endWhy === 'fall') { S.vy -= RN.G * dt; S.y = Math.max(S.lastGh - 12, S.y + S.vy * dt); }
    if (S.respawn) {
      S.respawn.t -= dt;
      S.vy -= RN.G * dt; S.y += S.vy * dt; S.d += S.speed * 0.25 * dt;
      if (S.respawn.t <= 0) {
        S.d = S.respawn.d; S.y = (groundBase(S.d) ?? 0) + 2.5; S.lastGh = groundBase(S.d) ?? 0; S.vy = 0; S.ground = false; S.respawn = null; S.inv = 2.2;
        fig.setAnim('leap');
      }
    } else if (S.started && !S.over) {
      S.d += S.speed * dt;
      // seitlich
      const tx = laneX(S.lane);
      S.x += (tx - S.x) * (1 - Math.exp(-dt * 15));
      // senkrecht
      S.slide = Math.max(0, S.slide - dt);
      const gh = groundAt(S.d, S.x, S.y);
      if (S.ground) S.lastGh = S.y;
      if (S.ground) {
        if (gh == null) { S.ground = false; S.vy = 0; }
        else if (gh < S.y - 0.25) { S.ground = false; S.vy = 0; } // Kante: runterfallen
        else S.y = gh;
      }
      if (!S.ground) {
        S.vy -= RN.G * dt;
        S.y += S.vy * dt;
        if (gh != null && S.y <= gh && S.vy <= 0 && S.y > gh - 0.9) { S.y = gh; S.vy = 0; S.ground = true; fig.setAnim(S.slide > 0 ? 'slide' : 'run'); sound('noise', 0.06, { freq: 300, gain: 0.03 }); }
      }
      if (S.ground && fig.anim === 'slide' && S.slide <= 0) fig.setAnim('run');
      if (S.ground && fig.anim === 'leap') fig.setAnim('run');
      // runtergefallen? Über einer Lücke unter die Kante gesunken oder unter die nächste Platte geraten → weg
      // (nur beim Fallen und nur gegenüber der Grundbahn – Blöcke zählen nicht, sonst gäbe es Fehlalarm beim Hochspringen)
      const gb0 = groundBase(S.d);
      if (!S.ground && S.vy <= 0 && ((gb0 == null && S.y < S.lastGh - 0.45) || (gb0 != null && S.y < gb0 - 0.3))) fall();
      // Hindernisse
      const h = S.slide > 0 ? RN.H_SLIDE : RN.H_STAND;
      for (const ob of obs) {
        if (ob.hit || ob.ramp || S.d + 0.3 < ob.d0 || S.d - 0.3 > ob.d1) continue;
        if (Math.abs(S.x - laneX(ob.lane)) > 1.05) continue;
        const yb = ob.base + ob.yb, yt = ob.base + ob.yt;
        const feet = S.y, head = S.y + h;
        if (ob.top != null) {
          // Block: nur die Vorderseite ist gefährlich (oben kann man laufen)
          if (feet < ob.base + ob.top - 0.35 && S.d - 0.3 < ob.d0 + 0.6) crash(ob);
          continue;
        }
        if (head > yb + 0.08 && feet < yt - 0.14) crash(ob);
      }
      // Kristalle
      for (const g of gems) {
        if (g.got || Math.abs(g.d - S.d) > 0.7 || Math.abs(laneX(g.lane) - S.x) > 0.8 || Math.abs(g.y - (S.y + 0.7)) > 1.1) continue;
        g.got = true; gemPool.hide(g.i); S.gems++; elGems.textContent = S.gems;
        sound('tone', [1568 + (S.gems % 4) * 120], 0.05, 'sine', 0.035);
      }
      // Tore
      const next = gates.find((g) => !g.passed);
      if (next && !next.q && next.d - S.d < (o.armAt ?? 999)) armGate(next);
      if (next && S.d >= next.d) passGate(next);
      // durchgelaufene Tore verschwinden, bevor die Kamera hindurchfährt
      for (const g of gates) if (g.passed && !g.gone && S.d - (camera.aspect < 0.8 ? 7.4 : 6.2) > g.d - 2.2) {
        g.gone = true; g.idx.forEach((k) => gatePool.hide(k)); g.labels.forEach((m) => { m.visible = false; });
      }
      elDist.textContent = Math.floor(S.d);
      const kmh = Math.round(S.base * 3.6);
      if (elSpeed.textContent !== String(kmh)) { elSpeed.textContent = kmh; }
    }
    // aufräumen und weiterbauen
    while (segs.length && segs[0].d1 < S.d - RN.BEHIND) { const s = segs.shift(); scene.remove(s.mesh); s.mesh.geometry.dispose(); }
    for (let i = obs.length - 1; i >= 0; i--) if (obs[i].d1 < S.d - RN.BEHIND) { obs[i].pool.hide(obs[i].i); obs.splice(i, 1); }
    for (let i = gems.length - 1; i >= 0; i--) if (gems[i].d < S.d - 10) { gemPool.hide(gems[i].i); gems.splice(i, 1); }
    for (let i = gates.length - 1; i >= 0; i--) if (gates[i].d < S.d - RN.BEHIND) {
      const g = gates[i];
      g.idx.forEach((k) => gatePool.hide(k));
      g.labels.forEach((m) => { scene.remove(m); if (m.material.map !== blankTex) m.material.map?.dispose(); m.material.dispose(); });
      gates.splice(i, 1);
    }
    if (!S.over) plan();
    scenery();
    // Kristalle drehen
    const rot = ctx.time * 2.4;
    for (const g of gems) if (!g.got) gemPool.mesh.setMatrixAt(g.i, gemM.compose(gemV.set(laneX(g.lane), g.y + Math.sin(ctx.time * 3 + g.d) * 0.08, -g.d), gemQ.setFromEuler(gemE.set(0, rot + g.d, 0)), gemS));
    gemPool.dirty = true;
    // Effekte
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt;
      f.s.userData.v.y -= 14 * dt; f.s.position.addScaledVector(f.s.userData.v, dt); f.s.rotation.x += dt * 6; f.s.rotation.y += dt * 4;
      if (f.t > f.life) { scene.remove(f.s); if (!fx.some((x, k) => k !== i && x.m === f.m)) f.m.dispose(); fx.splice(i, 1); }
    }
    for (const f of ctx.frameFns) f(dt, S);
  }
  const gemM = new T.Matrix4(), gemV = new T.Vector3(), gemQ = new T.Quaternion(), gemE = new T.Euler(), gemS = new T.Vector3(1, 1, 1);

  function render(dt) {
    // Figur
    figWrap.position.set(S.x, S.y, -S.d);
    figWrap.rotation.z = (laneX(S.lane) - S.x) * 0.08;
    const sunk = (S.respawn || S.endWhy === 'fall') && S.y < S.lastGh - 1.6; // im Abgrund verschwunden
    figWrap.visible = !sunk && !(S.inv > 0 && Math.floor(S.inv * 10) % 2 === 0 && !S.respawn);
    fig.update(dt);
    const gb = groundAt(S.d, S.x, S.y);
    blob.visible = gb != null && S.y - gb < 4 && !sunk && !((S.respawn || S.endWhy === 'fall') && S.y < S.lastGh - 0.3);
    if (gb != null) { blob.position.set(S.x, gb + 0.02, -S.d); const k = rnClamp(1 - (S.y - gb) / 4, 0.3, 1); blob.scale.setScalar(k); blob.material.opacity = 0.28 * k; }
    // Kamera: hinter der Figur, folgt weich in der Höhe
    const falling = S.respawn || S.endWhy === 'fall';
    const camYT = (falling ? S.lastGh : Math.max(S.y, gb ?? S.y)) + (camera.aspect < 0.8 ? 3.3 : 2.9);
    S.camY += (camYT - S.camY) * (1 - Math.exp(-dt * 4));
    if (Math.abs(camYT - S.camY) > 2.2) S.camY = camYT - Math.sign(camYT - S.camY) * 2.2; // nie unter den Weg
    const back = camera.aspect < 0.8 ? 7.4 : 6.2;
    if (S.finishing && S.endWhy !== 'fall') {
      S.finT = (S.finT || 0) + dt;
      const a = Math.min(1, S.finT / 1.6), ang = a * Math.PI * 0.85;
      camera.position.set(S.x + Math.sin(ang) * 4.6, S.y + 2.2 - a * 0.6, -S.d + Math.cos(ang) * 4.6);
      camera.lookAt(S.x, S.y + 1.0, -S.d);
    } else {
      camera.position.set(S.x * 0.55, S.camY, -S.d + back);
      if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt); camera.position.x += (Math.random() - 0.5) * S.shake * 0.6; camera.position.y += (Math.random() - 0.5) * S.shake * 0.6; }
      camera.lookAt(S.x * 0.8, S.camY - 1.75, -S.d - 9);
    }
    // Licht, Himmel und Flächen wandern mit
    sun.position.set(S.x + sunDir.x * 40, S.y + sunDir.y * 40, -S.d + sunDir.z * 40 - 6);
    sun.target.position.set(S.x, S.y, -S.d - 6);
    sky.position.copy(camera.position);
    if (side) { side.position.z = -S.d - 60; side.material.map.offset.y = (S.d + 60) / W.side.tile; side.material.map.offset.x = -0.5 * (W.side.size / W.side.tile) % 1; }
    pit.position.z = -S.d - 100;
    for (const k in ctx.pools) { ctx.pools[k].near.flush(); ctx.pools[k].far?.flush(); }
    for (const k in obsPools) obsPools[k].flush();
    gatePool.flush(); gemPool.flush();
    renderer.render(scene, camera);
  }

  function end(why = '') {
    if (S.over) return;
    S.over = true; S.endWhy = why;
    elAsk.hidden = true;
    const sad = ['crash', 'fall', 'wrong'].includes(why);
    fig.setAnim(sad ? 'oops' : 'cheer');
    setTimeout(() => { S.finishing = true; if (sad) fig.setAnim('shy'); }, sad ? 700 : 200);
    o.onEnd?.(why);
  }
  raf = requestAnimationFrame(loop);

  const api = {
    get state() { return S; },
    /** für Tests: Bauplan und Steuerung */
    _dbg: { obs, gates, segs, gems, act, groundAt, groundBase, renderer, scene, ctx, step, render, hold: (v) => { hold = v; } },
    finish() { end('done'); },
    /** Im Spiel weiter, aber ohne Fragen (z. B. Zeit ist um) */
    stop() { end('time'); },
    hud() { return host.querySelector('.rn-host'); },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('keydown', onKey);
      fx.forEach((f) => { scene.remove(f.s); f.m.dispose(); });
      gates.forEach((g) => g.labels.forEach((m) => { if (m.material.map !== blankTex) m.material.map?.dispose(); m.material.dispose(); }));
      segs.forEach((s) => s.mesh.geometry.dispose());
      own.forEach((x) => { try { x?.dispose?.(); } catch { /* */ } });
      Object.values(ctx.pools).flatMap((p) => [p.near, p.far]).filter(Boolean).concat(Object.values(obsPools), [gatePool, gemPool]).forEach((p) => p.mesh.dispose());
      W.dispose?.(ctx);
      fig.dispose();
      try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* */ }
      renderer.domElement.remove();
    },
  };
  return api;
}
function esc2(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
