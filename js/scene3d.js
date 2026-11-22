/* Vokaboom – 3D-Bühne im Avatar-Stil für die Spiele Angeln, Brückenbau und Zaubertrank
 *
 * Die ganze Kulisse (Steg, See, Hügel, Bäume, Fische · Schlucht, Felsen, Bretter, Seile · Zauberküche, Kessel,
 * Fläschchen) wird aus den gleichen runden Voxel-Bausteinen gebaut wie der 3D-Avatar (js/avatar3d.js, Baukasten aus
 * js/runner3d.js). Die Kamera ist orthografisch und rechnet in Bildschirm-Pixeln: Die Spiel-Logik bleibt unverändert
 * (sie bewegt weiterhin ihre HTML/SVG-Elemente), und die 3D-Modelle folgen diesen Elementen («Anker»).
 * Ohne WebGL bleibt die bisherige 2D-Grafik.
 */
'use strict';

const s3Hex = (T, css) => { try { return new T.Color(css).getHex(); } catch { return 0x888888; } };
const s3Rand = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * 3D-Bühne in host (Spielfeld) einsetzen. build(ctl) baut die feste Kulisse (wird bei Grössenänderung neu gebaut).
 * Gibt die Steuerung zurück oder null (dann bleibt die 2D-Grafik).
 */
async function s3Mount(host, build) {
  if (!host || typeof gavOK !== 'function' || !gavOK() || typeof w3LoadRunner !== 'function') return null;
  const gid = G.id;
  try { await w3Three(); await w3LoadRunner(); } catch (e) { console.warn('3D-Bühne laden', e); return null; }
  if (G.id !== gid || !host.isConnected || typeof rnBuilder !== 'function' || typeof rnGeo !== 'function') return null;
  const T = w3T();
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { console.warn(e); return null; }
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  if (typeof w3Lights === 'function') w3Lights(T, scene, renderer, false);
  const cam = new T.OrthographicCamera(0, 1, 0, -1, -3000, 3000);
  cam.position.set(0, 0, 1000);
  const cv = renderer.domElement;
  cv.className = 's3-canvas'; cv.setAttribute('aria-hidden', 'true');
  host.insertBefore(cv, host.firstChild);
  const geoCache = new Map(), own = [];
  const ctl = {
    T, scene, cam, W: 0, H: 0, alive: true, t: 0, frames: [], tracks: [], group: null,
    /** Voxel-Modell bauen: build(B) füllt den Baukasten, u = Pixel pro Voxel. Mit key wird die Geometrie gemerkt. */
    geo(key, build, { u = 6, iter = 2, field = 1, project = true, center = false } = {}) {
      if (key && geoCache.has(key)) return geoCache.get(key);
      const B = rnBuilder(); build(B);
      const g = rnGeo(T, B, { u, iter, field, project });
      if (center) g.center();
      if (key) geoCache.set(key, g); else own.push(g);
      return g;
    },
    mesh(g, mat) { const m = new T.Mesh(g, mat || vxMaterials(T)); return m; },
    /** Bildschirm-Pixel (x nach rechts, y nach unten) → Welt */
    at(o, x, y, z = 0) { o.position.set(x, -y, z); return o; },
    add(o, toStatic = true) { (toStatic ? ctl.group : scene).add(o); return o; },
    /** Plane mit Farbverlauf von oben (c1) nach unten (c2) */
    grad(x, y, w, h, c1, c2, z = -500, basic = true) {
      const g = new T.PlaneGeometry(w, h, 1, 1);
      const col = new Float32Array(12), a = new T.Color(c1), b = new T.Color(c2);
      [a, a, b, b].forEach((c, i) => { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; });
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.Mesh(g, basic ? new T.MeshBasicMaterial({ vertexColors: true }) : new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
      own.push(g, m.material);
      return ctl.at(m, x + w / 2, y + h / 2, z);
    },
    frame(fn) { ctl.frames.push(fn); },
    /**
     * Elemente verfolgen: Für jedes Element, das selector trifft, wird make(el) einmal aufgerufen (→ Object3D) und das
     * Modell dann jedes Bild auf die Mitte des Elements gesetzt (mit dessen Drehung, Grösse, Spiegelung, Sichtbarkeit).
     */
    track(selector, make, { z = 0, update = null } = {}) { ctl.tracks.push({ selector, make, z, update, map: new Map() }); },
    own(...x) { own.push(...x); },
    dispose() {
      if (!ctl.alive) return;
      ctl.alive = false; cancelAnimationFrame(raf); ro?.disconnect();
      try {
        scene.traverse((o) => { if (o.isMesh && !geoCache.size) o.geometry?.dispose(); });
        geoCache.forEach((g) => g.dispose()); own.forEach((x) => x?.dispose?.());
        renderer.dispose(); renderer.forceContextLoss?.();
      } catch { /* egal */ }
      cv.remove(); host.classList.remove('s3d');
    },
  };
  function rebuild() {
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    ctl.W = W; ctl.H = H;
    renderer.setSize(W, H, false);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    Object.assign(cam, { left: 0, right: W, top: 0, bottom: -H }); cam.updateProjectionMatrix();
    if (ctl.group) { scene.remove(ctl.group); ctl.group.traverse((o) => { if (o.isMesh && !([...geoCache.values()].includes(o.geometry))) o.geometry.dispose(); }); }
    ctl.group = new T.Group(); scene.add(ctl.group);
    ctl.frames = [];
    try { build(ctl); } catch (e) { console.warn('3D-Kulisse', e); }
  }
  let resizeT = 0;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(() => ctl.alive && rebuild(), 160); }) : null;
  rebuild();
  ro?.observe(host);
  const hostRect = { left: 0, top: 0 };
  const M = new T.Matrix4();
  function syncTracks() {
    const hr = host.getBoundingClientRect(); hostRect.left = hr.left; hostRect.top = hr.top;
    for (const tr of ctl.tracks) {
      const now = new Set(host.querySelectorAll(tr.selector));
      for (const [el, o] of tr.map) if (!now.has(el)) { scene.remove(o); tr.map.delete(el); }
      for (const el of now) {
        let o = tr.map.get(el);
        if (!o) { try { o = tr.make(el); } catch (e) { console.warn(e); o = null; } if (!o) continue; o.userData.base = o.userData.base || { w: el.offsetWidth || 1 }; scene.add(o); tr.map.set(el, o); }
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        let ang = 0, sc = 1;
        // Drehung/Grösse aus dem CSS-Transform des Elements (und des Elternteils, z. B. Wackeln)
        for (const t of [cs.transform, el.parentElement ? getComputedStyle(el.parentElement).transform : 'none']) {
          const mm = /matrix\(([^)]+)\)/.exec(t || '');
          if (mm) { const [a, b] = mm[1].split(',').map(Number); ang += Math.atan2(b, a); sc *= Math.hypot(a, b) || 1; }
        }
        const vis = r.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.3;
        o.visible = vis;
        if (!vis) continue;
        o.position.set(r.left - hostRect.left + r.width / 2, -(r.top - hostRect.top + r.height / 2), tr.z);
        const flip = el.classList.contains('flip') ? -1 : 1;
        const base = (el.offsetWidth || o.userData.base.w) / o.userData.base.w;
        o.scale.set(flip * sc * base, sc * base, sc * base);
        o.rotation.z = -ang * flip;
        tr.update?.(el, o, ctl);
      }
    }
  }
  let last = performance.now(), raf = 0, first = true;
  const loop = (now) => {
    if (!ctl.alive) return;
    if (G.id !== gid || !host.isConnected) { ctl.dispose(); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; ctl.t += dt;
    for (const f of ctl.frames) { try { f(dt, ctl.t); } catch (e) { console.warn(e); } }
    syncTracks();
    renderer.render(scene, cam);
    if (first) { first = false; host.classList.add('s3d'); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const prev = G.s3Cleanup;
  G.s3Cleanup = () => { try { prev?.(); } catch { /* egal */ } ctl.dispose(); };
  return ctl;
}

/* =========================================================
   Gemeinsame Kulissen-Teile (Voxel)
   ========================================================= */
/** runder Laubbaum */
function s3Tree(B, h = 18, leaf = 0x4caf50) {
  B.cyl(0, 0, 0, h, (y) => (y < h * 0.6 ? 1.6 : 1.1), rnVar(0x7a4a26, 0.08));
  const r = h * 0.42;
  B.ell(0, h, 0, r, r * 0.85, r * 0.7, rwPatch(leaf, 0.14, 2.5, 3));
  B.ell(-r * 0.6, h - r * 0.4, 0, r * 0.6, r * 0.55, r * 0.5, rwPatch(rnShade(leaf, -0.08), 0.12, 2.5, 5));
  B.ell(r * 0.6, h - r * 0.3, 0, r * 0.6, r * 0.55, r * 0.5, rwPatch(rnShade(leaf, 0.05), 0.12, 2.5, 7));
}
/** Tanne */
function s3Pine(B, h = 22, c = 0x2f6b4a, snow = false) {
  B.cyl(0, 0, 0, 4, 1.2, 0x6b4226);
  for (let y = 3; y <= h; y++) { const r = (h - y) * 0.38 + 0.6; B.cyl(0, 0, y, y, r, (x, yy, z) => (snow && (yy % 5 === 0) && Math.abs(x) + Math.abs(z) > r - 1.5 ? 0xf4f8ff : rnShade(c, ((y % 5) - 2) * 0.03))); }
}
/** Wolke */
function s3Cloud(B, n = 3) {
  for (let i = 0; i < n; i++) B.ell(i * 7, (i % 2) * 3 + 2, 0, 7 + (i % 2) * 2, 5 + (i % 2), 4, (x, y) => (y < 2 ? 0xdde8f5 : 0xffffff));
}
/** Hügelband: Höhe hf(x) in Voxeln, Breite n Voxel, Farbe fn */
function s3Band(B, n, hf, col, d = 4) {
  for (let x = 0; x <= n; x++) { const h = Math.max(1, Math.round(hf(x))); B.box(x, 0, -d, x, h, d, (xx, y, z) => col(xx, y, z, h)); }
}

/* =========================================================
   Angeln
   ========================================================= */
const S3_FISH_LOOK = {
  // Grundfarbe/zweite Farbe kommen aus FISH_COLORS (oder fest für Clown/Doktorfisch)
  classic: {}, clown: { c1: 0xff8a1f, c2: 0xff7a1a }, long: {}, puffer: {}, angel: {}, trout: {}, tang: { c1: 0x2d6bff, c2: 0xffd23f },
};
/** Fisch als Voxel-Modell (Kopf links, Schwanz rechts). Gibt { body, tail, tailX } in Voxeln zurück. */
function s3FishBuild(kind, c1, c2, Lb) {
  const h = kind === 'puffer' ? 15 : kind === 'long' ? 10 : 13, ry = h / 2, rz = kind === 'puffer' ? 6 : 4, cx = Lb / 2;
  const body = (B) => {
    const pat = (x, y, z) => {
      const t = x / Lb, belly = y < ry * 0.75;
      if (kind === 'clown') { for (const s of [0.22, 0.52, 0.82]) { const d = Math.abs(t - s) * Lb; if (d < 2.2) return d > 1.4 ? 0x1b1b2f : 0xffffff; } return 0xff8a1f; }
      if (kind === 'angel' && [0.3, 0.52, 0.74].some((s) => Math.abs(t - s) * Lb < 1.3)) return rnShade(c2, -0.35);
      if (kind === 'trout') { if (Math.abs(y - ry) < 1.2) return 0xff8ab0; if (s3Rand(x * 31 + y * 7 + z) < 0.12) return 0x2a1f33; }
      if (kind === 'tang') { if (y > ry && t > 0.25 && t < 0.95 && y < ry + 4 - (t - 0.6) * 6) return 0x14194a; return 0x2d6bff; }
      if (kind === 'puffer' && belly) return 0xfff3cf;
      if (kind === 'puffer' && s3Rand(x * 13 + y * 5 + z * 3) < 0.08) return rnShade(c1, -0.35);
      return belly ? rnShade(c1, -0.1) : rnShade(c1, 0.04 + (y - ry) * 0.01);
    };
    if (kind === 'long') {
      for (let x = -3; x <= Lb; x++) { const t = (x + 3) / (Lb + 3); const rr = Math.max(0.6, Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.95) * ry); B.tube('x', x, x, 0, ry, rr, pat); }
      B.paint((v) => (Math.abs(v.z) <= 3 ? null : null));
    } else B.ell(cx, ry, 0, cx, ry, rz, pat);
    // Rückenflosse
    const fin = kind === 'tang' ? 0x14194a : kind === 'clown' ? 0xff7a1a : c2;
    if (kind === 'angel') { B.curve([[Lb * 0.25, h - 1, 0], [Lb * 0.45, h + 9, 0], [Lb * 0.8, h - 2, 0]], 1.4, fin); B.curve([[Lb * 0.3, 1, 0], [Lb * 0.5, -8, 0], [Lb * 0.8, 1, 0]], 1.4, fin); }
    else B.curve([[Lb * 0.35, h - 1, 0], [Lb * 0.55, h + 3, 0], [Lb * 0.72, h - 1, 0]], 1.2, fin);
    // Stacheln (Kugelfisch)
    if (kind === 'puffer') for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; B.bar([cx + Math.cos(a) * cx * 0.95, ry + Math.sin(a) * ry * 0.95, 0], [cx + Math.cos(a) * (cx + 3), ry + Math.sin(a) * (ry + 3), 0], 0.7, rnShade(c2, -0.1)); }
    // Seitenflosse
    B.ell(Lb * 0.32, ry * 0.7, rz, 3, 1.6, 1, rnShade(c2, 0.05));
    // Auge (vorne, zur Kamera) und Mund
    const ex = kind === 'long' ? 2 : Lb * 0.14, ey = ry + 1.6, er = kind === 'puffer' ? 2.6 : 2;
    B.ell(ex, ey, rz - 0.5, er, er, 1.2, 0xffffff, { mat: 1 });
    B.ell(ex - 0.5, ey, rz + 0.6, er * 0.55, er * 0.55, 0.8, 0x14141c, { mat: 1 });
    B.put(ex - 1, ey + 1, rz + 1.2, 0xffffff, 1);
    B.box(Math.round(ex - 2), Math.round(ry - 2), Math.round(rz - 1), Math.round(ex), Math.round(ry - 2), Math.round(rz), 0x7a2a2a);
  };
  const tail = (B) => {
    const tc = kind === 'tang' ? 0xffd23f : kind === 'clown' ? 0xff7a1a : c2;
    const fork = kind === 'long' || kind === 'tang';
    for (let x = 0; x <= 9; x++) { const w = 1 + x * 0.75; for (let y = Math.round(-w); y <= Math.round(w); y++) { if (fork && x > 5 && Math.abs(y) < (x - 5) * 0.8) continue; B.box(x, y + 50, -1, x, y + 50, 1, x > 7 ? rnShade(tc, -0.12) : tc); } }
  };
  return { body, tail, h };
}
function s3FishModel(ctl, el) {
  const T = ctl.T, kind = el.dataset.kind || 'classic', c1 = s3Hex(T, el.dataset.c1 || '#ff9f43'), c2 = s3Hex(T, el.dataset.c2 || '#ff6b6b');
  const look = S3_FISH_LOOK[kind] || {};
  const W = el.offsetWidth, Hh = el.offsetHeight, bw = W - 34;
  const fb = s3FishBuild(kind, look.c1 ?? c1, look.c2 ?? c2, 10);
  const u = Hh / fb.h;
  const Lb = Math.max(14, Math.round(bw / u));
  const F = s3FishBuild(kind, look.c1 ?? c1, look.c2 ?? c2, Lb);
  const key = `fish|${kind}|${c1}|${c2}|${Lb}|${Math.round(u * 10)}`;
  const gb = ctl.geo(`${key}|b`, F.body, { u, iter: 2, field: 1 });
  const gt = ctl.geo(`${key}|t`, F.tail, { u, iter: 1, field: 0.8 });
  const g = new T.Group(), inner = new T.Group();
  const body = ctl.mesh(gb), tail = ctl.mesh(gt);
  tail.position.set(Lb * u - u * 1.5, -50 * u, 0);
  const tailPivot = new T.Group(); tailPivot.position.set(Lb * u - u * 1.5, F.h / 2 * u, 0); tail.position.set(0, (-50 - F.h / 2) * u + F.h / 2 * u - F.h / 2 * u + F.h / 2 * u, 0);
  tail.position.y = -50 * u; tailPivot.add(tail);
  inner.add(body, tailPivot);
  // Mitte des Elements = Mitte von Körper+Schwanz
  inner.position.set(-W / 2, -Hh / 2, 0);
  g.add(inner);
  g.userData = { base: { w: W }, tail: tailPivot, ph: Math.random() * 6 };
  return g;
}
function s3FishScene(ctl) {
  const s = G.s, T = ctl.T, W = ctl.W, H = ctl.H, wy = s.waterY || H * 0.4, L = s.L, lv = s.fishLevel || 1;
  const add = (o) => ctl.add(o);
  // Wasser (hinten): Farbverlauf
  add(ctl.grad(0, wy, W, H - wy, L.water[0], L.water[1], -600));
  // Sonne
  const sun = ctl.mesh(ctl.geo('sun', (B) => B.ell(0, 0, 0, 6, 6, 3, 0xffe680, { mat: 2 }), { u: 5, iter: 2, center: true }));
  add(ctl.at(sun, W * 0.88, H * 0.1 + 10, -900));
  const halo = new T.Mesh(new T.CircleGeometry(60, 32), new T.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.25 }));
  ctl.own(halo.geometry, halo.material); add(ctl.at(halo, W * 0.88, H * 0.1 + 10, -950));
  // Wolken
  const clouds = [];
  for (let i = 0; i < 3; i++) {
    const c = ctl.mesh(ctl.geo(`cloud${i % 2}`, (B) => s3Cloud(B, 3 + (i % 2)), { u: 5, iter: 3, field: 1.3, center: true }));
    c.userData = { x: (i * 0.37 + 0.1) * W, y: 26 + i * 22, v: 6 + i * 3 }; add(ctl.at(c, c.userData.x, c.userData.y, -850 + i)); clouds.push(c);
  }
  ctl.frame((dt) => { for (const c of clouds) { c.userData.x += c.userData.v * dt; if (c.userData.x > W + 80) c.userData.x = -80; c.position.x = c.userData.x; } });
  // Hintergrund je nach Ort
  const u = Math.max(5, Math.round(W / 170));
  const nx = Math.ceil(W / u) + 2;
  if (lv === 1) { // Teich: grüne Hügel mit Laubbäumen
    const far = ctl.mesh(ctl.geo(null, (B) => s3Band(B, nx, (x) => 12 + Math.sin(x * 0.045) * 6 + Math.sin(x * 0.11) * 2, (x, y, z, h) => (y > h - 1 ? 0x8fd17f : rwPatch(0x6cb56f, 0.08, 4)(x, y, z))), { u, iter: 2 }));
    add(ctl.at(far, 0, wy + 2, -700));
    const near = ctl.mesh(ctl.geo(null, (B) => s3Band(B, nx, (x) => 6 + Math.sin(x * 0.07 + 2) * 4, (x, y, z, h) => (y > h - 1 ? 0x6fbf6a : rwPatch(0x4e9e62, 0.08, 4)(x, y, z))), { u, iter: 2 }));
    add(ctl.at(near, 0, wy + 2, -650));
    const tg = ctl.geo('tree', (B) => s3Tree(B, 18), { u: Math.max(3, u * 0.6), iter: 2, field: 1.1 });
    for (let i = 0; i < 6; i++) { const t = ctl.mesh(tg); const x = W * (0.45 + i * 0.09); t.scale.setScalar(0.8 + s3Rand(i) * 0.5); add(ctl.at(t, x, wy - (6 + Math.sin(x / u * 0.07 + 2) * 4) * u + 4, -640 + i)); }
  } else if (lv === 2) { // See: Berge mit Schnee, Tannen
    const mt = ctl.mesh(ctl.geo(null, (B) => s3Band(B, nx, (x) => 10 + Math.abs(((x * 0.9) % 60) - 30) * 0.9 + Math.sin(x * 0.2) * 1.5, (x, y, z, h) => (y > 26 ? 0xf4f6ff : y > h - 2 ? 0x8d8aa8 : rwPatch(0x7a7896, 0.1, 4)(x, y, z))), { u, iter: 2 }));
    add(ctl.at(mt, 0, wy + 2, -720));
    const pg = ctl.geo('pine', (B) => s3Pine(B, 22), { u: Math.max(3, u * 0.55), iter: 2, field: 1 });
    for (let i = 0; i < 9; i++) { const t = ctl.mesh(pg); t.scale.setScalar(0.7 + s3Rand(i, 2) * 0.6); add(ctl.at(t, W * (0.3 + i * 0.08), wy + 3, -640 + i)); }
  } else { // Meer: Insel mit Leuchtturm und Segelboot
    const isl = ctl.mesh(ctl.geo(null, (B) => { B.ell(30, 0, 0, 30, 8, 5, (x, y) => (y > 5 ? 0x6fbf6a : 0xe8d39a), { keep: (x, y) => y >= 0 }); B.cyl(46, 0, 4, 30, 3, (x, y) => ((Math.floor(y / 5) % 2) ? 0xffffff : 0xe2483d)); B.cyl(46, 0, 31, 34, 3.6, 0x334155); B.cyl(46, 0, 35, 37, 2.2, 0xfff3a0, { mat: 2 }); B.ell(46, 39, 0, 3, 2, 3, 0xe2483d); }, { u: Math.max(3, u * 0.6), iter: 2 }));
    add(ctl.at(isl, W * 0.62, wy + 4, -700));
    const boat = ctl.mesh(ctl.geo('boat', (B) => { for (let x = -12; x <= 12; x++) { const d = Math.round(3 - Math.abs(x) / 6); B.box(x, 0, -d, x, 4, d, x % 2 ? 0x8b5a2b : 0x7a4a26); } B.cyl(0, 0, 5, 30, 0.8, 0x5b3a22); for (let y = 8; y <= 28; y++) { const w = (y - 8) * 0.55; B.box(1, y, 0, Math.round(1 + w), y, 0, 0xffffff); } B.box(-1, 26, 0, -1, 30, 0, 0xe2483d); }, { u: 3, iter: 1 }));
    boat.userData = { x: W * 0.3 };
    add(ctl.at(boat, boat.userData.x, wy + 2, -660));
    ctl.frame((dt, t) => { boat.userData.x += dt * 8; if (boat.userData.x > W + 60) boat.userData.x = W * 0.25; boat.position.x = boat.userData.x; boat.rotation.z = Math.sin(t * 1.6) * 0.04; boat.position.y = -(wy + 2) + Math.sin(t * 1.6) * 2; });
  }
  // Wasseroberfläche: helle Wellenkante
  const sw = new T.PlaneGeometry(W, 10, Math.ceil(W / 12), 1);
  const swm = new T.Mesh(sw, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
  ctl.own(sw, swm.material); add(ctl.at(swm, W / 2, wy + 3, -580));
  const pos = sw.attributes.position, base = Float32Array.from(pos.array);
  ctl.frame((dt, t) => { for (let i = 0; i < pos.count; i++) { const x = base[i * 3] + W / 2; pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(x / 40 + t * 2) * 2 + Math.sin(x / 17 - t * 2.7) * 1; } pos.needsUpdate = true; });
  // Seerosen (Teich)
  if (lv === 1) { const lg = ctl.geo('lily', (B) => { B.cyl(0, 0, 0, 1, 7, 0x3f9e5a, { sx: 1.4 }); B.ell(2, 2, 0, 2, 2, 2, 0xff9ec4); B.put(2, 4, 0, 0xffe066); }, { u: 3, iter: 2 }); for (let i = 0; i < 3; i++) add(ctl.at(ctl.mesh(lg), W * (0.55 + i * 0.15), wy + 6, -560)); }
  // Grund: Sand, Steine, Wasserpflanzen
  const gu = Math.max(4, Math.round(W / 220));
  const bed = ctl.mesh(ctl.geo(null, (B) => s3Band(B, Math.ceil(W / gu) + 2, (x) => 3 + Math.sin(x * 0.13) * 1.5, (x, y, z) => rwPatch(lv === 3 ? 0xe8d39a : 0xb9a477, 0.1, 3)(x, y, z), 3), { u: gu, iter: 2 }));
  add(ctl.at(bed, 0, H + 2, -540));
  const weeds = [];
  const wg = ctl.geo(`weed${lv}`, (B) => { const pts = []; for (let i = 0; i <= 8; i++) pts.push([Math.sin(i * 0.9) * 2, i * 4, 0]); B.curve(pts, (t) => 1.6 - t * 0.9, lv === 3 ? 0xff6f91 : 0x3fa66a); }, { u: gu, iter: 1, field: 0.8, project: false });
  for (let i = 0; i < 8; i++) { const m = ctl.mesh(wg); m.scale.setScalar(0.7 + s3Rand(i, 4) * 0.7); m.userData.ph = i; add(ctl.at(m, W * (0.08 + i * 0.12), H - 4, -530 + i)); weeds.push(m); }
  const rg = ctl.geo('rock', (B) => { B.ell(0, 0, 0, 8, 5, 5, rwMix(0x8a8f96, 0x4f8a5a, 0.25, 2, 4), { keep: (x, y) => y >= 0 }); B.ell(6, 0, 1, 4, 3, 3, 0x9aa1a8, { keep: (x, y) => y >= 0 }); }, { u: gu, iter: 2 });
  for (let i = 0; i < 4; i++) add(ctl.at(ctl.mesh(rg), W * (0.18 + i * 0.24), H - 2, -520));
  ctl.frame((dt, t) => weeds.forEach((m) => { m.rotation.z = Math.sin(t * 1.4 + m.userData.ph) * 0.12; }));
  // Steg mit Pfosten und Eimer
  const dockW = Math.round(s.aw * 1.9 + W * 0.03), du = Math.max(3, Math.round(s.aw / 22));
  const dn = Math.ceil(dockW / du);
  const dock = ctl.mesh(ctl.geo(null, (B) => {
    for (let x = 0; x <= dn; x++) B.box(x, 0, -6, x, 3, 6, (xx, y, z) => (xx % 9 === 0 ? 0x5b3a22 : rnShade(0x9c6b3e, (s3Rand(Math.floor(xx / 9)) - 0.5) * 0.18 + (y === 3 ? 0.06 : 0))));
    for (const px of [Math.round(dn * 0.18), Math.round(dn * 0.88)]) B.box(px, -Math.round(90 / du), -2, px + 2, 0, 1, rnVar(0x6e4224, 0.06));
  }, { u: du, iter: 1, field: 0.9 }));
  add(ctl.at(dock, 0, wy - 2, 40));
  const bucket = ctl.mesh(ctl.geo('bucket', (B) => { B.cyl(0, 0, 0, 11, (y) => 5 + y * 0.22, (x, y) => (y > 9 ? 0xd8e1ea : rnShade(0x9fb2c5, (y % 4 === 0) ? -0.12 : 0)), { mat: 3 }); B.cyl(0, 0, 1, 11, (y) => 4 + y * 0.22, 0x3a4656); B.curve([[-7, 11, 0], [0, 18, 0], [7, 11, 0]], 0.5, 0x6b7a8c, { mat: 3 }); }, { u: Math.max(2.4, s.aw / 40), iter: 2 }));
  add(ctl.at(bucket, dockW * 0.86 - 19, wy - 2 - 4 * du + 2, 60));
}
/** 3D-Bühne für Angeln starten */
function s3Fishing() {
  const st = $('#fi-stage');
  if (!st || typeof s3Mount !== 'function') return;
  s3Mount(st, s3FishScene).then((ctl) => {
    if (!ctl) return;
    G.s.s3 = ctl;
    ctl.track('.fi-fish', (el) => s3FishModel(ctl, el), {
      z: 10,
      update: (el, o, c) => { const tp = o.userData.tail; if (tp) tp.rotation.y = Math.sin(c.t * (el.classList.contains('wiggle') ? 30 : 9) + o.userData.ph) * 0.55; },
    });
  });
}

/* =========================================================
   Brückenbau
   ========================================================= */
const S3_BRIDGE = {
  jungle: { top: 0x6fbf4a, rock: 0x7a5a3a, rock2: 0x5e4630, far: 0x5faf8e, deco: 'vines', water: 0x3fb8c9, plank: 0xc99a52, post: 0x7a5a2e, rope: 0x8a6a3a },
  canyon: { top: 0xd98452, rock: 0xc8653a, rock2: 0x9a4a2a, far: 0xd98452, deco: 'cactus', water: null, plank: 0xa8784a, post: 0x5b3a1e, rope: 0x6b4a26 },
  ice: { top: 0xf4f8ff, rock: 0xa9c4e0, rock2: 0x7f9ec2, far: 0xb7cde8, deco: 'ice', water: 0x9cc6ff, plank: 0x7fb6e6, post: 0x86b8e0, rope: 0x6c8fb5 },
  lava: { top: 0x4b4452, rock: 0x3a3440, rock2: 0x26222c, far: 0x4a1f35, deco: 'lava', water: 0xff7a1a, plank: 0x8d8794, post: 0x2e2a33, rope: 0x2e2a33 },
};
function s3BridgeScene(ctl) {
  const s = G.s, T = ctl.T, W = ctl.W, H = ctl.H, P = S3_BRIDGE[s.theme] || S3_BRIDGE.jungle, top = s.top, add = (o) => ctl.add(o);
  // Schlucht (hinten) und Berge
  add(ctl.grad(0, top, W, H - top, s.T.deep[0], s.T.deep[1], -800));
  const u = Math.max(6, Math.round(W / 140)), nx = Math.ceil(W / u) + 2;
  const mt = ctl.mesh(ctl.geo(null, (B) => s3Band(B, nx, (x) => (8 + Math.abs(((x * 1.1 + 13) % 46) - 23) * 1.1 + Math.sin(x * 0.3) * 1.2) * Math.min(1, (top * 0.6 / u) / 36),
    (x, y, z, h) => (s.theme === 'ice' && y > h - 4 ? 0xffffff : s.theme === 'lava' && y > h - 2 && x % 46 > 18 && x % 46 < 28 ? 0xff7a1a : rwPatch(P.far, 0.08, 4)(x, y, z))), { u, iter: 2 }));
  mt.material = vxMaterials(T); add(ctl.at(mt, 0, top + 2, -900));
  // Fluss / Lava unten
  if (P.water) {
    const wg = new T.PlaneGeometry(W, 40, Math.ceil(W / 16), 1);
    const wm = new T.Mesh(wg, new T.MeshBasicMaterial({ color: P.water, transparent: s.theme !== 'lava', opacity: 0.92 }));
    ctl.own(wg, wm.material); add(ctl.at(wm, W / 2, H - 16, -700));
    const pos = wg.attributes.position, base = Float32Array.from(pos.array);
    ctl.frame((dt, t) => { for (let i = 0; i < pos.count; i++) if (base[i * 3 + 1] > 0) pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(base[i * 3] / 50 + t * 2.2) * 4; pos.needsUpdate = true; if (s.theme === 'lava') wm.material.color.setHSL(0.06 + Math.sin(t * 2) * 0.012, 1, 0.52); });
  }
  // Felsen links und rechts (Klippen mit Grasdecke / Schnee / Stein)
  const cu = Math.max(5, Math.round(W / 180));
  const cliff = (w, left) => ctl.geo(null, (B) => {
    const nw = Math.ceil(w / cu), nh = Math.ceil((H - top) / cu) + 2;
    for (let x = 0; x <= nw; x++) {
      const edge = left ? nw - x : x; // Abstand zur Schluchtkante
      const cut = edge < 3 ? Math.round((3 - edge) * (nh / 10)) : 0;
      for (let y = 0; y <= nh; y++) {
        if (y > nh - cut && edge < 3) continue;
        const yy = -y; const surf = y === 0 || y === 1;
        B.box(x, yy, -4, x, yy, 4, (xx, y2, z) => (surf ? (y === 0 ? P.top : rnShade(P.top, -0.1)) : rwMix(P.rock, P.rock2, 0.35, 3, left ? 1 : 2)(xx, y2, z)));
      }
    }
    // Deko oben
    const deco = (x) => {
      if (P.deco === 'vines' || P.deco === 'cactus') { const tx = x; if (P.deco === 'cactus') { B.cyl(tx, 0, 1, 9, 1.4, 0x3d8a4a); B.cyl(tx + 3, 0, 5, 8, 1, 0x3d8a4a); B.box(tx + 1, 5, 0, tx + 2, 5, 0, 0x3d8a4a); } else { B.ell(tx, 3, 0, 4, 3, 3, rwPatch(0x3daa5b, 0.12, 2)); } }
      if (P.deco === 'ice') B.ell(x, 2, 0, 2.5, 2, 2, 0xdff1ff, { mat: 1 });
      if (P.deco === 'lava') B.ell(x, 1, 0, 2, 1.5, 2, 0x26222c);
    };
    deco(left ? 3 : nw - 4); deco(left ? Math.round(nw * 0.5) : Math.round(nw * 0.6));
    if (P.deco === 'vines') for (let k = 0; k < 5; k++) { const x0 = left ? nw - 1 - k * 2 : 1 + k * 2; B.curve([[x0, 0, 4], [x0 + (left ? 1 : -1), -8 - k * 2, 4], [x0, -16 - k * 3, 4]], 0.7, 0x2f7a3e); }
    if (P.deco === 'ice') for (let k = 0; k < 4; k++) { const x0 = left ? nw - 1 - k * 2 : 1 + k * 2; B.cyl(x0, 4, -10 - k, 0, (y) => (y + 10 + k) * 0.18 + 0.3, 0xcfe8ff, { mat: 1 }); }
  }, { u: cu, iter: 2, field: 1 });
  add(ctl.at(ctl.mesh(cliff(s.L, true)), 0, top, -100));
  add(ctl.at(ctl.mesh(cliff(s.R, false)), W - s.R, top, -100));
  // Pfosten
  if (s.T.posts) {
    const pg = ctl.geo(`post${s.theme}`, (B) => { B.box(-1, 0, -1, 1, 12, 1, rnVar(P.post, 0.06)); B.ell(0, 12, 0, 1.6, 1.2, 1.6, rnShade(P.post, 0.1)); }, { u: 3.6, iter: 1 });
    add(ctl.at(ctl.mesh(pg), s.L - 6, top, 20)); add(ctl.at(ctl.mesh(pg), W - s.R + 6, top, 20));
  }
  // Seile (zwei Handläufe)
  if (s.T.ropes) {
    const gap = W - s.L - s.R;
    const pts = Array.from({ length: 24 }, (_, i) => { const x = s.L + (gap * i) / 23, t = (x - s.L) / gap; return new T.Vector3(x - 6 + 12 * t, -(top - 40 + s.T.sag * gap * Math.sin(Math.PI * t) * 0.75), 30); });
    const tg = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 2, 6, false);
    const rm = new T.Mesh(tg, new T.MeshStandardMaterial({ color: P.rope, roughness: 0.9 }));
    ctl.own(tg, rm.material); add(rm);
  }
  // Ziel: Fahne und Schatzkiste
  const gx = W - s.R * 0.5;
  const pole = ctl.mesh(ctl.geo('pole', (B) => B.cyl(0, 0, 0, 30, 0.8, 0x5b3a22), { u: 2.2, iter: 1 }));
  add(ctl.at(pole, gx, top, 10));
  const flag = ctl.mesh(ctl.geo('flag', (B) => { for (let x = 0; x <= 14; x++) B.box(x, Math.round(-x * 0.35), 0, x, Math.round(8 - x * 0.35), 0, 0xff5a5f); }, { u: 2.2, iter: 1 }));
  add(ctl.at(flag, gx + 2, top - 66 + 18, 10));
  ctl.frame((dt, t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; });
  const chest = ctl.mesh(ctl.geo('chest', (B) => { B.box(-8, 0, -5, 8, 7, 5, (x, y) => (y === 3 ? 0xc9a227 : rnVar(0xa86b3c, 0.06)(x, y, 0))); B.ell(0, 7, 0, 8, 3.5, 5, 0xc98b4e, { keep: (x, y) => y >= 7 }); B.box(-1, 4, 5, 1, 6, 6, 0xffd54a, 3); }, { u: 2, iter: 2 }));
  add(ctl.at(chest, gx - 18, top, 12));
  s.s3chest = chest;
}
function s3PlankModel(ctl, el) {
  const s = G.s, P = S3_BRIDGE[s.theme] || S3_BRIDGE.jungle, T = ctl.T;
  const p = s.slot(+el.dataset.i || 0), w = Math.max(6, p.w), ice = s.theme === 'ice';
  const u = 2.6, n = Math.max(3, Math.round(w / u));
  const g = ctl.geo(`plank|${s.theme}|${n}`, (B) => {
    B.box(0, -2, -5, n, 1, 5, (x, y, z) => (ice ? (y === 1 ? 0xb8dcf7 : 0x5f9fd6) : (x === 1 || x === n - 1) && y === 1 && Math.abs(z) === 3 ? 0x3a3a3a : rnShade(P.plank, (s3Rand(x * 3 + z) - 0.5) * 0.12 + (y === 1 ? 0.06 : -0.04))), ice ? 1 : 0);
  }, { u, iter: 1, field: 0.9 });
  const m = ctl.mesh(g);
  m.position.x = -n * u / 2;
  const grp = new T.Group(); grp.add(m);
  // Hängebrücke: senkrechtes Seil zum Handlauf
  if (s.T.ropes) { const rg = new T.CylinderGeometry(0.9, 0.9, 30, 5); const r = new T.Mesh(rg, new T.MeshStandardMaterial({ color: P.rope })); ctl.own(rg, r.material); r.position.set(0, 15, 25); grp.add(r); }
  grp.userData.base = { w: 1 };
  return grp;
}
/** Bretter folgen den SVG-Brettern (deren transform="translate(x y) rotate(a)") */
function s3BridgePlanks(ctl) {
  const s = G.s, T = ctl.T, map = new Map();
  ctl.frame(() => {
    const els = $$('#br-planks .br-plank');
    const now = new Set(els);
    for (const [el, o] of map) if (!now.has(el)) { ctl.scene.remove(o); map.delete(el); }
    for (const el of els) {
      let o = map.get(el);
      if (!o) { o = s3PlankModel(ctl, el); ctl.scene.add(o); map.set(el, o); }
      const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)\s*rotate\(([-\d.e]+)/.exec(el.getAttribute('transform') || '');
      if (!m) continue;
      o.position.set(+m[1], -+m[2], 20);
      o.rotation.z = -(+m[3]) * Math.PI / 180;
      const op = el.style.opacity === '' ? 1 : +el.style.opacity;
      o.visible = op > 0.2;
      const st = el.classList.contains('step') ? 3 : el.classList.contains('wobble') ? Math.sin(ctl.t * 40) * 2 : 0;
      o.position.y -= st;
    }
  });
}
function s3Bridge() {
  const st = $('#br-stage');
  if (!st || typeof s3Mount !== 'function') return;
  s3Mount(st, (ctl) => { s3BridgeScene(ctl); s3BridgePlanks(ctl); }).then((ctl) => { if (ctl) { G.s.s3 = ctl; st.style.background = `linear-gradient(${G.s.T.sky[0]}, ${G.s.T.sky[1]})`; } });
}

/* =========================================================
   Zaubertrank
   ========================================================= */
function s3PotionScene(ctl) {
  const T = ctl.T, W = ctl.W, H = ctl.H, add = (o) => ctl.add(o), st = $('#pt-stage');
  if (!st) return;
  const sr = st.getBoundingClientRect();
  const rel = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height }; };
  // Steinwand (Voxel-Mauer) und Holzboden
  const bu = Math.max(8, Math.round(W / 110)), floorY = H * 0.78;
  const nx = Math.ceil(W / bu) + 1, ny = Math.ceil(floorY / bu) + 1;
  const wall = ctl.mesh(ctl.geo(null, (B) => {
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const row = Math.floor(y / 3), off = (row % 2) * 3, joint = y % 3 === 0 || (x + off) % 6 === 0;
      const c = joint ? 0x2a1d40 : rnShade(0x4a3a6a, (s3Rand(Math.floor((x + off) / 6) * 7 + row * 13) - 0.5) * 0.22);
      B.box(x, -y, joint ? -2 : -1, x, -y, joint ? -2 : 0, c);
    }
  }, { u: bu, iter: 1, field: 0.8 }));
  add(ctl.at(wall, 0, 0, -900));
  const fu = bu;
  const floor = ctl.mesh(ctl.geo(null, (B) => { for (let x = 0; x < nx; x++) for (let y = 0; y < Math.ceil((H - floorY) / fu) + 1; y++) B.box(x, -y, -3, x, -y, 0, (x % 8 === 0) ? 0x2a1608 : rnShade(0x6b4226, (s3Rand(Math.floor(x / 8) + y * 0.3) - 0.5) * 0.2 - y * 0.03)); }, { u: fu, iter: 1 }));
  add(ctl.at(floor, 0, floorY, -880));
  // Fenster mit Nachthimmel und Mond
  const win = $('.pt-window');
  if (win) {
    const r = rel(win);
    add(ctl.grad(r.x, r.y, r.w, r.h, '#0e1a4a', '#2b3c8c', -860));
    const fr = ctl.mesh(ctl.geo(null, (B) => { const w = Math.round(r.w / 5), h = Math.round(r.h / 5); for (let x = -1; x <= w + 1; x++) for (let y = -1; y <= h + 1; y++) { if (x > 0 && x < w && y > 0 && y < h && !(x === Math.round(w / 2))) continue; B.box(x, -y, 0, x, -y, 2, rnVar(0x6b4a2a, 0.06)); } }, { u: 5, iter: 1 }));
    add(ctl.at(fr, r.x, r.y, -850));
    const moon = ctl.mesh(ctl.geo('moon', (B) => B.ell(0, 0, 0, 4, 4, 2, 0xfff3c4, { mat: 2 }), { u: 4, iter: 2, center: true }));
    add(ctl.at(moon, r.x + r.w * 0.68, r.y + r.h * 0.28, -855));
  }
  // Regal hinter den Fläschchen: Bretter unter jeder Reihe
  const shelf = $('#pt-shelf');
  if (shelf) {
    const r = rel(shelf), rows = [...new Set($$('.pt-bottle').map((b) => Math.round(rel(b).y + rel(b).h)))].sort((a, b) => a - b);
    const su = 4, sw = Math.ceil(r.w / su);
    const cab = ctl.mesh(ctl.geo(null, (B) => {
      const sh = Math.ceil(r.h / su);
      for (let y = 0; y <= sh; y++) for (const x of [0, 1, sw - 1, sw]) B.box(x, -y, -3, x, -y, 3, rnVar(0x5a3a22, 0.06));
      B.box(2, -sh, -3, sw - 2, -1, -3, (x, y) => rnShade(0x3a2414, (s3Rand(Math.floor(x / 10)) - 0.5) * 0.15));
      for (const ry of rows) { const y = -Math.round((ry - r.y) / su) - 1; B.box(0, y - 1, -3, sw, y, 4, rnVar(0x7a5030, 0.06)); }
    }, { u: su, iter: 1 }));
    add(ctl.at(cab, r.x, r.y, -300));
  }
  // Kräuterbündel oben, Bücherstapel, Kerzen
  const herb = (c) => ctl.geo(`herb${c}`, (B) => { B.box(0, 0, -1, 0, -3, 1, 0x5a3a22); for (let k = 0; k < 6; k++) B.bar([0, -3, 0], [Math.sin(k) * 3, -12 - (k % 3) * 2, Math.cos(k) * 2], 0.9, rnShade(c, (k % 3) * 0.06)); }, { u: 3, iter: 1 });
  [0x4e9e62, 0xc75b8e, 0xe2b53a, 0x4e9e62, 0x8b5cf6].forEach((c, i) => { const m = ctl.mesh(herb(c)); m.userData.ph = i; add(ctl.at(m, W * (0.32 + i * 0.1), 4, -700)); ctl.frame((dt, t) => { m.rotation.z = Math.sin(t * 1.2 + i) * 0.06; }); });
  const books = ctl.mesh(ctl.geo('books', (B) => { [0x8a3a6b, 0x2d6bff, 0x2e9e6b, 0xe2b53a, 0xd7263d, 0x6a35b5].forEach((c, i) => { const h = 10 + (i * 5) % 6; B.box(i * 3, 0, -3, i * 3 + 2, h, 3, (x, y) => (y === h - 1 ? 0xffe9b0 : c)); }); B.box(-1, -2, -4, 19, -1, 4, 0x5a3a22); B.ell(24, 3, 0, 3, 3, 3, 0xc4a0ff, { mat: 1 }); }, { u: 3.2, iter: 1 }));
  add(ctl.at(books, W - 90, floorY - 4, -500));
  const candle = ctl.geo('candle', (B) => { B.cyl(0, 0, 0, 14, 2, 0xf2e6c9); B.box(0, 15, 0, 0, 16, 0, 0x222222); }, { u: 3, iter: 2 });
  const flameG = ctl.geo('flame', (B) => { B.ell(0, 3, 0, 1.6, 3, 1.6, (x, y) => (y < 3 ? 0xffd24a : 0xfff3b0), { mat: 2 }); }, { u: 3, iter: 2 });
  for (const [x, sc] of [[18, 1], [W - 24, 0.8]]) {
    add(ctl.at(ctl.mesh(candle), x, floorY - 2, -400)).scale.setScalar(sc);
    const f = ctl.mesh(flameG); add(ctl.at(f, x, floorY - 2 - 48 * sc, -399)); f.scale.setScalar(sc);
    ctl.frame((dt, t) => { f.scale.set(sc * (1 + Math.sin(t * 13 + x) * 0.08), sc * (1 + Math.sin(t * 17 + x) * 0.15), sc); });
  }
  // Kessel (Voxel) mit leuchtendem Trank und Feuer
  const cauldron = $('#pt-cauldron');
  if (cauldron) {
    const r = rel(cauldron), cu = r.w / 52;
    const pot = ctl.mesh(ctl.geo(`pot${Math.round(cu * 10)}`, (B) => {
      B.ell(0, 20, 0, 24, 21, 12, (x, y) => (y > 36 ? 0x5c5c74 : rnShade(0x30303e, (y % 7 === 0 ? 0.05 : 0) - (y < 8 ? 0.08 : 0))), { mat: 3, keep: (x, y) => y <= 37 });
      B.tube('x', -25, 25, 0, 37, 2.4, 0x5c5c74, { mat: 3 });
      for (const lx of [-14, 14]) B.box(lx - 2, -6, -2, lx + 2, 2, 2, 0x1c1c27, 3);
      for (const hx of [-26, 26]) B.tube('z', -2, 2, hx, 30, 2.6, 0x1c1c27, { mat: 3 });
      // Runen vorne
      for (const [x, y] of [[-10, 18], [0, 14], [10, 18]]) B.ell(x, y, 11.5, 1.6, 1.6, 0.8, 0x7cffb2, { mat: 2 });
    }, { u: cu, iter: 2, field: 1.1 }));
    const px = r.x + r.w / 2, py = r.y + r.h * 0.92;
    add(ctl.at(pot, px, py, -60));
    // Trank-Oberfläche: eigenes Material (Farbe folgt --brew)
    const brewM = new T.MeshStandardMaterial({ color: 0x7cffb2, emissive: 0x7cffb2, emissiveIntensity: 0.55, roughness: 0.3 });
    const brewG = new T.CylinderGeometry(22 * cu, 22 * cu, 3 * cu, 36);
    const brew = new T.Mesh(brewG, brewM); ctl.own(brewG, brewM);
    brew.rotation.x = 0.85; add(ctl.at(brew, px, py - 35 * cu, -60));
    const runes = []; pot.traverse(() => {});
    let lastCol = '';
    ctl.frame((dt, t) => {
      const c = getComputedStyle(cauldron).getPropertyValue('--brew').trim();
      if (c && c !== lastCol) { lastCol = c; try { brewM.color.set(c); brewM.emissive.set(c); } catch { /* color-mix: alte Farbe lassen */ } }
      brew.position.y = -(py - 35 * cu) + Math.sin(t * 3) * cu * 0.4;
      brewM.emissiveIntensity = cauldron.classList.contains('glow') ? 1.1 + Math.sin(t * 8) * 0.2 : cauldron.classList.contains('fail') ? 0.05 : 0.45 + Math.sin(t * 2) * 0.08;
      pot.rotation.z = cauldron.classList.contains('brewing') || cauldron.classList.contains('fx-dance') ? Math.sin(t * 30) * 0.03 : 0;
    });
    const fire = ctl.geo('fire', (B) => { for (let k = -1; k <= 1; k++) B.ell(k * 6, 4, 0, 2.6, 5 + (k === 0 ? 2 : 0), 2.6, (x, y) => (y < 3 ? 0xff5a1f : y < 7 ? 0xffa21f : 0xfff0a0), { mat: 2 }); B.box(-10, -1, -3, 10, 0, 3, 0x3a2414); }, { u: cu, iter: 2 });
    const fm = ctl.mesh(fire); add(ctl.at(fm, px, py + 6 * cu, -50));
    ctl.frame((dt, t) => { fm.scale.set(1 + Math.sin(t * 11) * 0.05, 1 + Math.sin(t * 14) * 0.12, 1); });
  }
}
function s3BottleModel(ctl, el) {
  const T = ctl.T, btn = el.closest('.pt-bottle');
  const hue = parseFloat(getComputedStyle(btn || el).getPropertyValue('--h')) || 0;
  const col = new T.Color().setHSL(hue / 360, 0.85, 0.6).getHex();
  const w = el.offsetWidth || 44, u = w / 14;
  const g = ctl.geo(`bottle|${col}|${Math.round(u * 10)}`, (B) => {
    B.ell(0, 7, 0, 6.5, 7, 5, (x, y) => (y > 10 ? rnShade(col, 0.15) : col), { mat: 1 });
    B.ell(-3, 9, 4, 1.4, 2.6, 1, 0xffffff, { mat: 1 });
    B.cyl(0, 0, 13, 17, 2.2, 0xd6eaf5, { mat: 1 });
    B.cyl(0, 0, 18, 20, 2.6, 0xc98b4e);
  }, { u, iter: 2, field: 1 });
  const m = ctl.mesh(g);
  m.position.set(0, -el.offsetHeight / 2, 0);
  const grp = new T.Group(); grp.add(m); grp.userData.base = { w };
  return grp;
}
function s3Potion() {
  const st = $('#pt-stage');
  if (!st || typeof s3Mount !== 'function') return;
  s3Mount(st, s3PotionScene).then((ctl) => {
    if (!ctl) return;
    G.s.s3 = ctl;
    ctl.track('.pt-glass', (el) => s3BottleModel(ctl, el), { z: 200 });
  });
}
