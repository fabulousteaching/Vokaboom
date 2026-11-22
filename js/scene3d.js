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
async function s3Mount(host, build, opts = {}) {
  if (!host || typeof gavOK !== 'function' || !gavOK() || typeof w3LoadRunner !== 'function') return null;
  const gid = G.id;
  try { await w3Three(); await w3LoadRunner(); } catch (e) { console.warn('3D-Bühne laden', e); return null; }
  if (G.id !== gid || !host.isConnected || typeof rnBuilder !== 'function' || typeof rnGeo !== 'function') return null;
  const T = w3T();
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { console.warn(e); return null; }
  renderer.setPixelRatio(typeof fxPR === 'function' ? fxPR() : Math.min(1.75, window.devicePixelRatio || 1));
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.06;
  if (opts.shadows && typeof fxQuality === 'function' && fxQuality() === 'high') { renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; }
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
    T, scene, cam, renderer, W: 0, H: 0, alive: true, t: 0, frames: [], tracks: [], group: null, post: null,
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
      ctl.post?.dispose(); vig.remove();
      cv.remove(); host.classList.remove('s3d');
    },
  };
  function rebuild() {
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return;
    ctl.W = W; ctl.H = H;
    renderer.setSize(W, H, false);
    ctl.post?.setSize(W, H);
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
  // Leuchten (nur auf Geräten, die es schaffen) und Messung der Bildrate
  if (opts.bloom && typeof fxBloom === 'function') fxBloom(renderer, scene, cam, opts.bloom).then((p) => { if (ctl.alive) ctl.post = p; else p?.dispose(); });
  const meter = typeof fxMeter === 'function' ? fxMeter(() => { ctl.post?.dispose(); ctl.post = null; renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); ctl.W = 0; rebuild(); }) : () => {};
  // Vignette: Ränder leicht dunkler, lenkt den Blick in die Mitte
  const vig = document.createElement('div'); vig.className = 'fx-vig'; vig.setAttribute('aria-hidden', 'true'); host.appendChild(vig);
  let last = performance.now(), raf = 0, first = true;
  const loop = (now) => {
    if (!ctl.alive) return;
    if (G.id !== gid || !host.isConnected) { ctl.dispose(); return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; ctl.t += dt;
    for (const f of ctl.frames) { try { f(dt, ctl.t); } catch (e) { console.warn(e); } }
    syncTracks();
    meter(dt);
    if (ctl.post) ctl.post.render(); else renderer.render(scene, cam);
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
/** Fisch als Voxel-Modell (Kopf links, Schwanz rechts): Körper mit Farbverlauf (dunkler Rücken, heller Bauch), Schuppen,
 *  Kiemenbogen, Flossen. Augen, Brustflosse und Schwanz sind eigene Teile (bewegen sich). Masse in Voxeln. */
function s3FishBuild(kind, c1, c2, Lb) {
  const h = kind === 'puffer' ? 20 : kind === 'long' ? 13 : 17, ry = h / 2, rz = kind === 'puffer' ? 8 : 5.5, cx = Lb / 2;
  const back = rnShade(c1, -0.22), belly = kind === 'puffer' ? 0xfff3cf : rnShade(c1, 0.32);
  const shade = (x, y, z, base) => {
    const k = (y - ry) / ry; // -1 unten … 1 oben
    let c = k > 0 ? vxMix(base, back, Math.min(1, k * 0.9)) : vxMix(base, belly, Math.min(1, -k * 0.95));
    // Schuppen: feine Halbmonde, nur auf der Seite
    if (Math.abs(z) > rz * 0.55 && ((Math.round(x * 0.9) + (Math.round(y * 0.9) % 2) * 1) % 3 === 0) && y > ry * 0.5) c = rnShade(c, -0.07);
    return c;
  };
  const gillX = kind === 'long' ? 5 : Lb * 0.24;
  const pat = (x, y, z) => {
    const t = x / Lb;
    if (Math.abs(x - gillX - Math.abs(y - ry) * 0.25) < 0.7 && Math.abs(y - ry) < ry * 0.7 && Math.abs(z) > rz * 0.4) return rnShade(c1, -0.3); // Kiemenbogen
    if (kind === 'clown') { for (const s of [0.24, 0.53, 0.82]) { const d = Math.abs(t - s) * Lb; if (d < 2.6) return d > 1.7 ? 0x1b1b2f : 0xffffff; } return shade(x, y, z, 0xff8a1f); }
    if (kind === 'angel' && [0.32, 0.54, 0.76].some((s) => Math.abs(t - s) * Lb < 1.4)) return rnShade(c2, -0.4);
    if (kind === 'trout') { if (Math.abs(y - ry) < 1.4) return 0xff8ab0; if (y > ry * 0.8 && s3Rand(x * 31 + y * 7 + z) < 0.1) return 0x2a1f33; }
    if (kind === 'tang') { if (y > ry && t > 0.25 && t < 0.95 && y < ry + 5 - (t - 0.6) * 8) return 0x14194a; return shade(x, y, z, 0x2d6bff); }
    if (kind === 'puffer' && y > ry * 0.9 && s3Rand(x * 13 + y * 5 + z * 3) < 0.07) return rnShade(c1, -0.4);
    return shade(x, y, z, c1);
  };
  const fin = kind === 'tang' ? 0x14194a : kind === 'clown' ? 0xff7a1a : c2;
  const body = (B) => {
    if (kind === 'long') {
      for (let x = -4; x <= Lb; x++) { const t = (x + 4) / (Lb + 4); const rr = Math.max(0.8, Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.94) * ry); B.tube('x', x, x, 0, ry, rr, pat); }
    } else B.ell(cx, ry, 0, cx, ry, rz, pat);
    // Rücken- und Bauchflossen (mit Flossenstrahlen)
    const ray = (a, b, r = 1.3) => B.curve([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (b[1] > a[1] ? 2 : -2), 0], b], r, (x) => ((Math.round(x) % 3) ? fin : rnShade(fin, -0.18)));
    if (kind === 'angel') { ray([Lb * 0.25, h - 1, 0], [Lb * 0.5, h + 12, 0]); ray([Lb * 0.35, h - 1, 0], [Lb * 0.8, h - 1, 0]); ray([Lb * 0.3, 1, 0], [Lb * 0.55, -10, 0]); ray([Lb * 0.4, 1, 0], [Lb * 0.8, 1, 0]); }
    else { for (let k = 0; k < 5; k++) { const x0 = Lb * (0.36 + k * 0.08); B.bar([x0, h - 1.5, 0], [x0 + 1.5, h + 3.5 - Math.abs(k - 2) * 0.8, 0], 0.9, k % 2 ? fin : rnShade(fin, -0.15)); } B.bar([Lb * 0.6, 1.5, 0], [Lb * 0.66, -2.5, 0], 1, fin); }
    if (kind === 'puffer') for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; B.bar([cx + Math.cos(a) * cx * 0.92, ry + Math.sin(a) * ry * 0.92, 0], [cx + Math.cos(a) * (cx + 3.5), ry + Math.sin(a) * (ry + 3.5), 0], 0.6, rnShade(c2, -0.1)); }
    // Mund (Lippen)
    const mx = kind === 'long' ? -4 : 0.5;
    B.ell(mx + 1, ry - 1.5, 0, 1.6, 1.1, rz * 0.5, rnShade(c1, -0.35));
  };
  const tail = (B) => {
    const tc = kind === 'tang' ? 0xffd23f : kind === 'clown' ? 0xff7a1a : c2;
    const fork = kind === 'long' || kind === 'tang' || kind === 'trout';
    for (let x = 0; x <= 12; x++) { const w = 1.4 + x * 0.8; for (let y = Math.round(-w); y <= Math.round(w); y++) { if (fork && x > 6 && Math.abs(y) < (x - 6) * 0.9) continue; B.box(x, y + 50, -1, x, y + 50, 1, (Math.abs(y) % 3 === 0 && x > 2) ? rnShade(tc, -0.2) : x > 9 ? rnShade(tc, 0.12) : tc); } }
  };
  const pec = (B) => { for (let k = 0; k < 4; k++) B.bar([0, 0, 0], [5 - k * 0.6, -2 - k * 1.3, 0], 0.8, k % 2 ? rnShade(c2, 0.1) : c2); };
  const eye = { x: kind === 'long' ? 2.5 : Lb * 0.13, y: ry + 2, r: kind === 'puffer' ? 3.4 : kind === 'long' ? 2.2 : 2.7, z: rz * (kind === 'long' ? 0.75 : 0.62) };
  return { body, tail, pec, h, eye, rz, fin };
}
function s3FishModel(ctl, el) {
  const T = ctl.T, kind = el.dataset.kind || 'classic', c1 = s3Hex(T, el.dataset.c1 || '#ff9f43'), c2 = s3Hex(T, el.dataset.c2 || '#ff6b6b');
  const look = S3_FISH_LOOK[kind] || {};
  const W = el.offsetWidth, Hh = el.offsetHeight, bw = W - 34;
  const h0 = s3FishBuild(kind, 0, 0, 10).h;
  const u = Hh / h0;
  const Lb = Math.max(18, Math.round(bw / u));
  const F = s3FishBuild(kind, look.c1 ?? c1, look.c2 ?? c2, Lb);
  const key = `fish2|${kind}|${c1}|${c2}|${Lb}|${Math.round(u * 10)}`;
  const gb = ctl.geo(`${key}|b`, F.body, { u, iter: 3, field: 1.1 });
  const gt = ctl.geo(`${key}|t`, F.tail, { u, iter: 1, field: 0.8 });
  const gp = ctl.geo(`${key}|p`, F.pec, { u, iter: 1, field: 0.8, project: false });
  const g = new T.Group(), inner = new T.Group();
  const body = ctl.mesh(gb);
  const tailPivot = new T.Group(); tailPivot.position.set(Lb * u - u * 1.5, F.h / 2 * u, 0);
  const tail = ctl.mesh(gt); tail.position.y = -50 * u; tailPivot.add(tail);
  const pecPivot = new T.Group(); pecPivot.position.set(Lb * 0.3 * u, F.h * 0.42 * u, F.rz * u * 0.95);
  pecPivot.add(ctl.mesh(gp));
  // Augen: weisses Auge, Pupille (bewegt sich), Glanzpunkt, Lid (blinzeln)
  if (!S3_EYE.T || S3_EYE.T !== T) {
    S3_EYE.T = T;
    S3_EYE.geo = new T.SphereGeometry(1, 20, 14);
    S3_EYE.white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    S3_EYE.iris = new T.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.15, metalness: 0.1 });
    S3_EYE.ring = new T.MeshStandardMaterial({ color: 0xd9a400, roughness: 0.3 });
    S3_EYE.shine = new T.MeshBasicMaterial({ color: 0xffffff });
  }
  const er = F.eye.r * u;
  const eye = new T.Group(); eye.position.set(F.eye.x * u, F.eye.y * u, F.eye.z * u + er * 0.35);
  const white = new T.Mesh(S3_EYE.geo, S3_EYE.white); white.scale.set(er, er, er * 0.75);
  const pupil = new T.Group();
  const ring = new T.Mesh(S3_EYE.geo, S3_EYE.ring); ring.scale.set(er * 0.62, er * 0.62, er * 0.3);
  const iris = new T.Mesh(S3_EYE.geo, S3_EYE.iris); iris.scale.set(er * 0.45, er * 0.45, er * 0.3); iris.position.z = er * 0.06;
  pupil.add(ring, iris); pupil.position.z = er * 0.55;
  const shine = new T.Mesh(S3_EYE.geo, S3_EYE.shine); shine.scale.setScalar(er * 0.16); shine.position.set(-er * 0.28, er * 0.32, er * 0.95);
  eye.add(white, pupil, shine);
  inner.add(body, tailPivot, pecPivot, eye);
  inner.position.set(-W / 2, -Hh / 2, 0);
  g.add(inner);
  g.userData = { base: { w: W }, tail: tailPivot, pec: pecPivot, eye, pupil, er, ph: Math.random() * 6, blink: 1 + Math.random() * 3, look: { x: 0, y: 0, tx: 0, ty: 0, next: 0 }, inner };
  return g;
}
const S3_EYE = {};
/** Fisch lebendig machen: Schwanz, Brustflosse, Körper, Augen (schauen umher oder zum Haken, blinzeln) */
function s3FishLive(el, o, c) {
  const d = o.userData, t = c.t, wig = el.classList.contains('wiggle'), hooked = el.classList.contains('hooked');
  const sp = wig ? 30 : hooked ? 16 : 8;
  if (d.tail) d.tail.rotation.y = Math.sin(t * sp + d.ph) * (wig ? 0.8 : 0.5);
  if (d.pec) d.pec.rotation.z = -0.3 + Math.sin(t * sp * 0.8 + d.ph) * 0.45;
  if (d.inner) d.inner.rotation.y = Math.sin(t * sp + d.ph + 1.2) * 0.06; // Körper schlängelt leicht mit
  // Blickziel: beim Anbeissen zum Haken, sonst ab und zu woanders hin
  const L = d.look, s = G.s;
  if (hooked && s.hook) {
    const dx = s.hook.x - (o.position.x), dy = -(s.hook.y) - o.position.y, n = Math.hypot(dx, dy) || 1;
    L.tx = (dx / n) * Math.sign(o.scale.x || 1); L.ty = dy / n;
  } else if (t > L.next) {
    L.next = t + 0.8 + Math.random() * 2.2;
    const a = Math.random() * Math.PI * 2, r = Math.random() < 0.3 ? 0 : 0.6 + Math.random() * 0.4;
    L.tx = Math.cos(a) * r; L.ty = Math.sin(a) * r * 0.7;
  }
  const k = Math.min(1, 0.016 * 14);
  L.x += (L.tx - L.x) * k; L.y += (L.ty - L.y) * k;
  d.pupil.position.x = L.x * d.er * 0.38; d.pupil.position.y = L.y * d.er * 0.38;
  // blinzeln (bei Angst: grosse Augen, kleine Pupille)
  d.blink -= 0.016;
  let sy = 1;
  if (d.blink < 0) { sy = 0.12; if (d.blink < -0.12) d.blink = 2 + Math.random() * 4; }
  const big = hooked && !el.classList.contains('wiggle') ? 1 : wig ? 1.25 : 1;
  d.eye.scale.set(big, big * sy, big);
  d.pupil.scale.setScalar(wig ? 0.7 : 1);
}
function s3FishScene(ctl) {
  const s = G.s, T = ctl.T, W = ctl.W, H = ctl.H, wy = s.waterY || H * 0.4, L = s.L, lv = s.fishLevel || 1;
  const add = (o) => ctl.add(o);
  // Himmel und Wasser (hinten): Farbverlauf
  add(ctl.grad(0, 0, W, wy + 4, L.sky[0], L.sky[1], -1000));
  add(ctl.grad(0, wy, W, H - wy, L.water[0], L.water[1], -600));
  // Sonne
  const sun = ctl.mesh(ctl.geo('sun', (B) => B.ell(0, 0, 0, 6, 6, 3, 0xffe680, { mat: 2 }), { u: 5, iter: 2, center: true }));
  add(ctl.at(sun, W * 0.88, H * 0.1 + 10, -900));
  const halo = typeof fxGlow === 'function' ? fxGlow(T, 0xfff0b0, 190, 0.75) : new T.Mesh(new T.CircleGeometry(60, 32), new T.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.25 }));
  add(ctl.at(halo, W * 0.88, H * 0.1 + 10, -950));
  ctl.frame((dt, t) => { halo.material.opacity = 0.65 + Math.sin(t * 0.8) * 0.1; });
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
  // Lichtstrahlen im Wasser (weich, bewegen sich langsam)
  const rays = [];
  for (let i = 0; i < 6; i++) {
    const rh = (H - wy) * (0.75 + s3Rand(i, 9) * 0.25), rw = 40 + s3Rand(i, 3) * 70;
    const g = new T.PlaneGeometry(rw, rh);
    const col = new Float32Array(12); [1, 1, 1, 1].forEach((_, k) => { col[k * 3] = 1; col[k * 3 + 1] = 1; col[k * 3 + 2] = 0.95; });
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    const al = new Float32Array([0.5, 0.5, 0, 0]);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.11, depthWrite: false, blending: T.AdditiveBlending }));
    m.material.onBeforeCompile = () => {};
    ctl.own(g, m.material);
    const x = W * (0.2 + i * 0.14);
    ctl.at(m, x, wy + rh / 2, -590); m.rotation.z = -0.22; m.userData = { x, ph: i * 1.3 };
    add(m); rays.push(m);
  }
  // Lichtstrahlen oben hell, unten weg: Verlauf über eine kleine Textur
  const rc = document.createElement('canvas'); rc.width = 4; rc.height = 64;
  const rx2 = rc.getContext('2d'), gr = rx2.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(1, 'rgba(255,255,240,0)');
  rx2.fillStyle = gr; rx2.fillRect(0, 0, 4, 64);
  const rtex = new T.CanvasTexture(rc); ctl.own(rtex);
  rays.forEach((m) => { m.material.map = rtex; m.material.needsUpdate = true; });
  ctl.frame((dt, t) => rays.forEach((m) => { m.material.opacity = 0.07 + Math.sin(t * 0.7 + m.userData.ph) * 0.05; m.position.x = m.userData.x + Math.sin(t * 0.3 + m.userData.ph) * 20; }));
  // Schwebeteilchen im Wasser
  const NP = 70, pg = new T.BufferGeometry(), pp = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) { pp[i * 3] = Math.random() * W; pp[i * 3 + 1] = -(wy + 20 + Math.random() * (H - wy - 30)); pp[i * 3 + 2] = -585; }
  pg.setAttribute('position', new T.BufferAttribute(pp, 3));
  const pts = new T.Points(pg, new T.PointsMaterial({ color: 0xe8f6ff, size: 2.4, transparent: true, opacity: 0.55, depthWrite: false }));
  ctl.own(pg, pts.material); add(pts);
  ctl.frame((dt, t) => { for (let i = 0; i < NP; i++) { pp[i * 3 + 1] += dt * (4 + (i % 5)); pp[i * 3] += Math.sin(t + i) * dt * 3; if (-pp[i * 3 + 1] < wy + 12) pp[i * 3 + 1] = -(H - 10); } pg.attributes.position.needsUpdate = true; });
  // Glitzern auf der Wasseroberfläche
  const gl = [];
  const glG = new T.PlaneGeometry(14, 3), glM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  ctl.own(glG, glM);
  for (let i = 0; i < 10; i++) { const m = new T.Mesh(glG, glM.clone()); ctl.own(m.material); m.userData = { ph: Math.random() * 6, sp: 1.5 + Math.random() * 2 }; add(ctl.at(m, W * (0.25 + Math.random() * 0.72), wy + 4 + Math.random() * 10, -570)); gl.push(m); }
  ctl.frame((dt, t) => gl.forEach((m) => { m.material.opacity = Math.max(0, Math.sin(t * m.userData.sp + m.userData.ph)) * 0.8; }));
  // Schilf vorne am Ufer (links unter dem Steg)
  const reed = ctl.geo(`reed${lv}`, (B) => { for (let k = 0; k < 5; k++) { const x0 = k * 2.5, hh = 16 + (k % 3) * 5; B.curve([[x0, 0, 0], [x0 + 1, hh * 0.6, 0], [x0 + 2.5, hh, 0]], 0.7, k % 2 ? 0x5f9e4a : 0x4a8a3a); if (k % 2 === 0) B.ell(x0 + 2.5, hh + 2, 0, 1.2, 3, 1.2, 0x6b4226); } }, { u: Math.max(3, u * 0.55), iter: 1, project: false });
  for (let i = 0; i < 2; i++) { const m = ctl.mesh(reed); add(ctl.at(m, s.aw * 2 + i * 40 + W * 0.02, wy + 4, -555)); ctl.frame((dt, t) => { m.rotation.z = Math.sin(t * 1.1 + i) * 0.05; }); }
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
  s3Mount(st, s3FishScene, { bloom: { strength: 0.55, radius: 0.6, threshold: 0.82 } }).then((ctl) => {
    if (!ctl) return;
    G.s.s3 = ctl;
    ctl.track('.fi-fish', (el) => s3FishModel(ctl, el), {
      z: 10,
      update: s3FishLive,
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
  add(ctl.at(floor, 0, floorY, -880)); floor.receiveShadow = true;
  if (ctl.renderer.shadowMap.enabled) {
    wall.receiveShadow = true;
    const key = new T.DirectionalLight(0xffe6c0, 1.1); key.castShadow = true;
    key.position.set(W * 0.25, 260, 900); key.target.position.set(W * 0.55, -H * 0.6, -900);
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -W, right: W, top: H, bottom: -H, near: 10, far: 4000 }); key.shadow.bias = -0.002;
    add(key); add(key.target);
  }
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
    cab.receiveShadow = true;
  }
  // Kräuterbündel oben, Bücherstapel, Kerzen
  const books = ctl.mesh(ctl.geo('books', (B) => { [0x8a3a6b, 0x2d6bff, 0x2e9e6b, 0xe2b53a, 0xd7263d, 0x6a35b5].forEach((c, i) => { const h = 10 + (i * 5) % 6; B.box(i * 3, 0, -3, i * 3 + 2, h, 3, (x, y) => (y === h - 1 ? 0xffe9b0 : c)); }); B.box(-1, -2, -4, 19, -1, 4, 0x5a3a22); B.ell(24, 3, 0, 3, 3, 3, 0xc4a0ff, { mat: 1 }); }, { u: 3.2, iter: 1 }));
  add(ctl.at(books, W - 90, floorY - 4, -500));
  const candle = ctl.geo('candle', (B) => { B.cyl(0, 0, 0, 14, 2, 0xf2e6c9); B.box(0, 15, 0, 0, 16, 0, 0x222222); }, { u: 3, iter: 2 });
  const flameG = ctl.geo('flame', (B) => { B.ell(0, 3, 0, 1.6, 3, 1.6, (x, y) => (y < 3 ? 0xffd24a : 0xfff3b0), { mat: 2 }); }, { u: 3, iter: 2 });
  for (const [x, sc] of [[18, 1], [W - 24, 0.8]]) {
    add(ctl.at(ctl.mesh(candle), x, floorY - 2, -400)).scale.setScalar(sc);
    const f = ctl.mesh(flameG); add(ctl.at(f, x, floorY - 2 - 48 * sc, -399)); f.scale.setScalar(sc);
    if (typeof fxGlow === 'function') { const gl = fxGlow(T, 0xffb347, 120 * sc, 0.55); add(ctl.at(gl, x, floorY - 2 - 50 * sc, -398)); ctl.frame((dt, t) => { gl.material.opacity = 0.45 + Math.sin(t * 9 + x) * 0.08 + Math.sin(t * 23 + x) * 0.05; }); }
    ctl.frame((dt, t) => { f.scale.set(sc * (1 + Math.sin(t * 13 + x) * 0.08), sc * (1 + Math.sin(t * 17 + x) * 0.15), sc); });
  }
  // Kessel: glatter, runder Metallkessel (leicht von oben, man sieht hinein), leuchtender Trank, Blasen, Dampf, Feuer
  const cauldron = $('#pt-cauldron');
  if (cauldron) {
    const r = rel(cauldron);
    const R = r.w * 0.43, Hp = r.w * 0.6;
    const px = r.x + r.w / 2, base = r.y + r.h * 0.74;
    const cg = new T.Group();
    ctl.at(cg, px, base, 120);
    cg.rotation.x = 0.42;
    add(cg);
    const metal = new T.MeshStandardMaterial({ color: 0x2b2b38, metalness: 0.75, roughness: 0.32 });
    const metal2 = new T.MeshStandardMaterial({ color: 0x4a4a5e, metalness: 0.85, roughness: 0.25 });
    const inner = new T.MeshStandardMaterial({ color: 0x15151d, metalness: 0.3, roughness: 0.7, side: T.BackSide });
    ctl.own(metal, metal2, inner);
    const prof = [[0.001, 0.05], [0.45, 0.0], [0.78, 0.08], [0.97, 0.3], [1.0, 0.48], [0.95, 0.68], [0.84, 0.84], [0.8, 0.9]].map(([x, y]) => new T.Vector2(x * R, y * Hp));
    const potG = new T.LatheGeometry(prof, 48); ctl.own(potG);
    const pot = new T.Mesh(potG, metal); cg.add(pot);
    pot.castShadow = true;
    const inG = new T.CylinderGeometry(R * 0.79, R * 0.7, Hp * 0.2, 48, 1, true); ctl.own(inG);
    const inM = new T.Mesh(inG, inner); inM.position.y = Hp * 0.8; cg.add(inM);
    const rimG = new T.TorusGeometry(R * 0.82, R * 0.07, 14, 56); ctl.own(rimG);
    const rim = new T.Mesh(rimG, metal2); rim.rotation.x = Math.PI / 2; rim.position.y = Hp * 0.9; cg.add(rim);
    // Zierband mit Runen
    const bandG = new T.TorusGeometry(R * 0.985, R * 0.025, 8, 56); ctl.own(bandG);
    const band = new T.Mesh(bandG, metal2); band.rotation.x = Math.PI / 2; band.position.y = Hp * 0.5; cg.add(band);
    const runeM = new T.MeshStandardMaterial({ color: 0x7cffb2, emissive: 0x7cffb2, emissiveIntensity: 0.9 }); ctl.own(runeM);
    const runeG = new T.OctahedronGeometry(R * 0.06); ctl.own(runeG);
    for (let k = -2; k <= 2; k++) { const a = k * 0.42, m = new T.Mesh(runeG, runeM); m.position.set(Math.sin(a) * R * 0.99, Hp * 0.36, Math.cos(a) * R * 0.99); m.scale.y = 1.5; cg.add(m); }
    // Henkel und Füsse
    const handG = new T.TorusGeometry(R * 0.14, R * 0.035, 10, 24); ctl.own(handG);
    for (const sx of [-1, 1]) { const h = new T.Mesh(handG, metal2); h.position.set(sx * R * 1.0, Hp * 0.72, 0); h.rotation.y = Math.PI / 2; cg.add(h); }
    const legG = new T.CylinderGeometry(R * 0.06, R * 0.09, Hp * 0.16, 10); ctl.own(legG);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.5, l = new T.Mesh(legG, metal); l.position.set(Math.sin(a) * R * 0.55, -Hp * 0.04, Math.cos(a) * R * 0.55); cg.add(l); }
    // Trank
    const brewM = new T.MeshStandardMaterial({ color: 0x7cffb2, emissive: 0x7cffb2, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1 });
    const brewG = new T.CircleGeometry(R * 0.78, 48); ctl.own(brewM, brewG);
    const brew = new T.Mesh(brewG, brewM); brew.rotation.x = -Math.PI / 2; brew.position.y = Hp * 0.84; cg.add(brew);
    const glow = new T.PointLight(0x7cffb2, 2.2, R * 6, 1.2); glow.position.set(0, Hp * 1.15, R * 0.3); cg.add(glow);
    const halo = typeof fxGlow === 'function' ? fxGlow(T, 0x7cffb2, R * 2.6, 0.22) : null;
    if (halo) { halo.position.set(0, Hp * 1.0, R * 0.2); cg.add(halo); }
    // Blasen auf dem Trank
    const bubM = new T.MeshStandardMaterial({ color: 0x7cffb2, emissive: 0x7cffb2, emissiveIntensity: 0.5, transparent: true, opacity: 0.9, roughness: 0.1 });
    const bubG = new T.SphereGeometry(1, 14, 10); ctl.own(bubM, bubG);
    const bubs = Array.from({ length: 9 }, () => { const m = new T.Mesh(bubG, bubM); m.userData = { t: Math.random() * 2, life: 0.8 + Math.random() * 1.2 }; cg.add(m); return m; });
    // Dampf (weiche Wölkchen)
    const sc = document.createElement('canvas'); sc.width = sc.height = 64;
    const sx2 = sc.getContext('2d'), sg = sx2.createRadialGradient(32, 32, 2, 32, 32, 32); sg.addColorStop(0, 'rgba(255,255,255,.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    sx2.fillStyle = sg; sx2.fillRect(0, 0, 64, 64);
    const stex = new T.CanvasTexture(sc); ctl.own(stex);
    const steam = Array.from({ length: 7 }, (_, i) => { const m = new T.Sprite(new T.SpriteMaterial({ map: stex, color: 0x7cffb2, transparent: true, opacity: 0, depthWrite: false })); ctl.own(m.material); m.userData = { t: i / 7 * 3 }; ctl.add(m); return m; });
    // Feuer: Holzscheite und Flammen
    const fire = new T.Group(); ctl.at(fire, px, base + R * 0.45, 300); add(fire);
    const logM = new T.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }); const logG = new T.CylinderGeometry(R * 0.08, R * 0.08, R * 1.1, 8); ctl.own(logM, logG);
    for (const a of [0.5, -0.5]) { const l = new T.Mesh(logG, logM); l.rotation.z = Math.PI / 2 + a * 0.3; l.rotation.y = a; fire.add(l); }
    // lodernde Flammen aus vielen Leucht-Teilchen (steigen auf, werden kleiner und röter), darüber feiner Rauch
    const flames = [];
    const NF = 34;
    for (let i = 0; i < NF; i++) {
      const sp = typeof fxGlow === 'function' ? fxGlow(T, 0xffa21f, R * 0.3, 0.9) : null;
      if (!sp) break;
      sp.userData = { t: Math.random(), x: (Math.random() - 0.5) * R * 0.75, life: 0.55 + Math.random() * 0.4 };
      fire.add(sp); flames.push(sp);
    }
    const smoke = [];
    for (let i = 0; i < 6; i++) { const sp = typeof fxGlow === 'function' ? fxGlow(T, 0x554a44, R * 0.5, 0.25) : null; if (!sp) break; sp.material.blending = T.NormalBlending; sp.userData = { t: i / 6 }; fire.add(sp); smoke.push(sp); }
    const fc = new T.Color();
    const fl = new T.PointLight(0xff9a3a, 1.6, R * 5, 1.4); fl.position.set(0, R * 0.3, R * 0.6); fire.add(fl);
    let lastCol = '', swirl = 0;
    const brewTarget = new T.Color(0x7cffb2), brewNow = new T.Color(0x7cffb2);
    // Wirbel-Muster auf dem Trank (dreht sich, beim Eingiessen schnell)
    const wc = document.createElement('canvas'); wc.width = wc.height = 128;
    const wx = wc.getContext('2d'); wx.fillStyle = '#fff'; wx.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 3; k++) { wx.strokeStyle = `rgba(0,0,0,${0.12 + k * 0.04})`; wx.lineWidth = 6; wx.beginPath(); for (let a = 0; a < 9; a += 0.1) { const rr = 6 + a * 6.5; wx.lineTo(64 + Math.cos(a + k * 2.1) * rr, 64 + Math.sin(a + k * 2.1) * rr); } wx.stroke(); }
    const wtex = new T.CanvasTexture(wc); ctl.own(wtex); brewM.map = wtex; brewM.needsUpdate = true;
    ctl.frame((dt, t) => {
      const c = getComputedStyle(cauldron).getPropertyValue('--brew').trim();
      if (c && c !== lastCol) { lastCol = c; try { brewTarget.set(c); } catch { /* unbekanntes Format: alte Farbe lassen */ } }
      brewNow.lerp(brewTarget, Math.min(1, dt * 2.2));
      brewM.color.copy(brewNow); brewM.emissive.copy(brewNow); bubM.color.copy(brewNow); bubM.emissive.copy(brewNow); glow.color.copy(brewNow);
      if (!cauldron.classList.contains('fail')) steam.forEach((m) => m.material.color.copy(brewNow));
      const pouring = cauldron.classList.contains('pouring');
      swirl += dt * (pouring ? 6 : 0.6);
      brew.rotation.z = swirl; brew.scale.set(1, 1 + (pouring ? Math.sin(t * 14) * 0.04 : 0), 1);
      const isGlow = cauldron.classList.contains('glow'), isFail = cauldron.classList.contains('fail'), busy = cauldron.classList.contains('brewing');
      brewM.emissiveIntensity = isGlow ? 1.2 + Math.sin(t * 8) * 0.25 : isFail ? 0.05 : 0.5 + Math.sin(t * 2) * 0.1;
      glow.intensity = isGlow ? 5 : isFail ? 0.2 : 2 + Math.sin(t * 2) * 0.3;
      if (halo) { halo.material.color.copy(brewNow); halo.material.opacity = isGlow ? 0.6 + Math.sin(t * 8) * 0.15 : isFail ? 0.03 : 0.18 + Math.sin(t * 2) * 0.04; }
      runeM.emissiveIntensity = isGlow ? 2 : isFail ? 0.1 : 0.8 + Math.sin(t * 2.5) * 0.3;
      brew.position.y = Hp * 0.84 + Math.sin(t * 3) * Hp * 0.006;
      cg.rotation.z = busy || cauldron.classList.contains('fx-dance') ? Math.sin(t * 30) * 0.03 : 0;
      const sp = busy ? 2.2 : 1;
      bubs.forEach((m) => {
        const d = m.userData; d.t += dt * sp;
        if (d.t > d.life) { d.t = 0; d.life = 0.6 + Math.random() * 1.2; const a = Math.random() * 6.3, rr = Math.random() * R * 0.62; m.position.set(Math.cos(a) * rr, Hp * 0.84, Math.sin(a) * rr); d.size = R * (0.04 + Math.random() * 0.07); }
        const k = d.t / d.life; m.scale.setScalar((d.size || 1) * Math.sin(Math.min(1, k * 1.15) * Math.PI) + 0.001);
      });
      steam.forEach((m) => {
        const d = m.userData; d.t += dt * (busy ? 1.6 : 0.8); if (d.t > 3) d.t = 0;
        const k = d.t / 3;
        m.position.set(px + Math.sin(d.t * 2 + m.id) * R * 0.3, -(base - Hp * 0.95 - k * Hp * 1.1), 130);
        m.scale.setScalar(R * (0.4 + k * 0.9)); m.material.opacity = isFail ? 0.5 * Math.sin(k * Math.PI) : 0.28 * Math.sin(k * Math.PI);
        if (isFail) m.material.color.set(0x777766);
      });
      flames.forEach((m) => {
        const d = m.userData; d.t += dt / d.life;
        if (d.t >= 1) { d.t = 0; d.x = (Math.random() - 0.5) * R * 0.75; d.life = 0.5 + Math.random() * 0.45; }
        const k = d.t;
        m.position.set(d.x * (1 - k * 0.7) + Math.sin(t * 9 + d.x) * R * 0.03, R * (0.05 + k * 0.75), R * 0.15);
        const sz = R * (0.42 - k * 0.32); m.scale.set(sz, sz * 1.35, 1);
        fc.setHSL(0.13 - k * 0.11, 1, 0.62 - k * 0.15); m.material.color.copy(fc);
        m.material.opacity = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * 0.95;
      });
      smoke.forEach((m) => { const d = m.userData; d.t = (d.t + dt * 0.35) % 1; const k = d.t; m.position.set(Math.sin(k * 5 + t) * R * 0.15, R * (0.7 + k * 0.9), -R * 0.2); m.scale.setScalar(R * (0.3 + k * 0.6)); m.material.opacity = 0.22 * Math.sin(k * Math.PI); });
      // Zauber: der Kessel dreht sich langsam (die Runen wandern ums Kesselrund), die Kamera fährt näher (CSS-Zoom)
      cg.rotation.y += dt * (cauldron.classList.contains('glow') ? 1.6 : 0);
      fl.intensity = 1.4 + Math.sin(t * 15) * 0.3;
    });
  }
}
/** Zauberfläschchen: Glas (durchsichtig), leuchtende Flüssigkeit, die schwappt, Korken, der beim Ausgiessen aufspringt */
const S3_GLASS = {};
function s3BottleModel(ctl, el) {
  const T = ctl.T, btn = el.closest('.pt-bottle');
  const hue = parseFloat(getComputedStyle(btn || el).getPropertyValue('--h')) || 0;
  const col = new T.Color().setHSL(hue / 360, 0.85, 0.56);
  const w = el.offsetWidth || 44, h = el.offsetHeight || 56;
  if (S3_GLASS.T !== T) {
    S3_GLASS.T = T;
    S3_GLASS.glass = new T.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.32, roughness: 0.04, metalness: 0.25, depthWrite: false });
    S3_GLASS.rim = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3 });
    S3_GLASS.cork = new T.MeshStandardMaterial({ color: 0xb07a45, roughness: 0.85 });
    S3_GLASS.shine = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  }
  const rb = w * 0.44, bodyY = -h / 2 + rb, neckR = w * 0.15, top = h / 2 - h * 0.12;
  // Glas: Bauch + Hals als Drehkörper
  const prof = [[0.01, -h / 2], [rb * 0.7, -h / 2 + 1], [rb, bodyY - rb * 0.15], [rb * 0.98, bodyY + rb * 0.25], [rb * 0.7, bodyY + rb * 0.78], [neckR, bodyY + rb * 1.02], [neckR, top - 2], [neckR * 1.3, top]].map(([x, y]) => new T.Vector2(x, y));
  const gG = new T.LatheGeometry(prof, 28); ctl.own(gG);
  const glass = new T.Mesh(gG, S3_GLASS.glass); glass.renderOrder = 3;
  const rimG = new T.TorusGeometry(neckR * 1.25, w * 0.035, 8, 20); ctl.own(rimG);
  const rim = new T.Mesh(rimG, S3_GLASS.rim); rim.rotation.x = Math.PI / 2; rim.position.y = top;
  // Flüssigkeit (Kugelkappe + Oberfläche), dreht sich gegen das Kippen, damit sie «unten» bleibt
  const liqM = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, roughness: 0.2, transparent: true, opacity: 0.92 });
  const surfM = new T.MeshStandardMaterial({ color: col.clone().lerp(new T.Color(0xffffff), 0.35), emissive: col, emissiveIntensity: 0.5, roughness: 0.15 });
  ctl.own(liqM, surfM);
  const lr = rb * 0.86, fill = 0.68, th0 = Math.PI * (1 - fill);
  const capG = new T.SphereGeometry(lr, 24, 16, 0, Math.PI * 2, th0, Math.PI - th0); ctl.own(capG);
  const surfG = new T.CircleGeometry(lr * Math.sin(th0), 24); ctl.own(surfG);
  const liquid = new T.Group(); liquid.position.y = bodyY;
  const cap = new T.Mesh(capG, liqM); liquid.add(cap);
  const surf = new T.Mesh(surfG, surfM); surf.rotation.x = -Math.PI / 2; surf.position.y = lr * Math.cos(th0); liquid.add(surf);
  // kleine Blasen in der Flüssigkeit
  const bubG = new T.SphereGeometry(w * 0.03, 8, 6); ctl.own(bubG);
  const bubs = Array.from({ length: 3 }, (_, i) => { const m = new T.Mesh(bubG, S3_GLASS.shine); m.userData.ph = i * 2.1; liquid.add(m); return m; });
  // Korken
  const corkG = new T.CylinderGeometry(neckR * 1.15, neckR * 0.95, h * 0.16, 14); ctl.own(corkG);
  const cork = new T.Mesh(corkG, S3_GLASS.cork); cork.position.y = top + h * 0.04;
  // Glanzstreifen
  const shG = new T.PlaneGeometry(w * 0.08, rb * 0.9); ctl.own(shG);
  const sh = new T.Mesh(shG, S3_GLASS.shine); sh.position.set(-rb * 0.5, bodyY + rb * 0.1, rb * 0.9); sh.rotation.z = 0.35;
  const grp = new T.Group();
  grp.add(liquid, glass, rim, cork, sh);
  glass.castShadow = true; cap.castShadow = true;
  grp.userData = { base: { w }, liquid, cork, corkY: top + h * 0.04, bubs, lr, ph: Math.random() * 6, popT: null, pourT: null, fill: 1, h };
  return grp;
}
/** Fläschchen lebendig: Flüssigkeit schwappt, Korken springt auf, beim Ausgiessen wird es leer */
function s3BottleLive(el, o, c) {
  const d = o.userData, t = c.t, fly = el.closest('.flying'), btn = el.closest('.pt-bottle');
  const used = !fly && btn?.classList.contains('used');
  // schwappen: gegen die Neigung drehen (bis 0.6), dazu leichtes Wackeln
  const tilt = o.rotation.z;
  d.liquid.rotation.z = -Math.max(-0.6, Math.min(0.6, tilt)) + Math.sin(t * 3.2 + d.ph) * (fly ? 0.12 : 0.04);
  d.bubs.forEach((m, i) => { const k = ((t * 0.5 + m.userData.ph) % 1); m.position.set(Math.sin(i * 2 + t) * d.lr * 0.3, -d.lr * 0.7 + k * d.lr * 0.9, d.lr * 0.5); m.visible = k < 0.9; });
  // Korken
  if (fly?.classList.contains('uncorked')) {
    if (d.popT == null) d.popT = t;
    const k = t - d.popT;
    d.cork.position.set(k * 50, d.corkY + k * 160 - 420 * k * k, 0); d.cork.rotation.z = -k * 12; d.cork.visible = k < 0.8;
  } else { d.popT = null; d.cork.position.set(0, d.corkY, 0); d.cork.rotation.z = 0; d.cork.visible = !used; }
  // ausgiessen: Flüssigkeit wird weniger
  if (fly?.classList.contains('pouring')) { if (d.pourT == null) d.pourT = t; d.fill = Math.max(0, 1 - (t - d.pourT) / 0.9); } else if (!fly) { d.pourT = null; d.fill = used ? 0 : 1; }
  d.liquid.visible = d.fill > 0.03;
  d.liquid.scale.setScalar(0.25 + 0.75 * d.fill);
  d.liquid.position.y = -d.h / 2 + d.lr * (0.25 + 0.75 * d.fill) + 1;
}
function s3Potion() {
  const st = $('#pt-stage');
  if (!st || typeof s3Mount !== 'function') return;
  s3Mount(st, s3PotionScene, { bloom: { strength: 0.5, radius: 0.5, threshold: 0.86 }, shadows: true }).then((ctl) => {
    if (!ctl) return;
    G.s.s3 = ctl;
    ctl.track('.pt-glass', (el) => s3BottleModel(ctl, el), { z: 200, update: s3BottleLive });
  });
}

/** Katzen-Trank: eine 3D-Katze (aus dem Avatar-Baukasten) springt aus dem Kessel, läuft durch die Küche, setzt sich und miaut */
function s3PotionCat() {
  const ctl = G.s.s3, T = ctl?.T;
  if (!ctl?.alive || typeof vxPetGroup !== 'function') return false;
  const g = vxPetGroup(T, { id: 'cat', c: 0xf2a65a });
  if (!g) return false;
  const bb = new T.Box3().setFromObject(g), h = Math.max(0.01, bb.max.y - bb.min.y);
  g.scale.multiplyScalar(85 / h);
  const holder = new T.Group(); holder.add(g); ctl.scene.add(holder);
  const st = $('#pt-stage').getBoundingClientRect(), cr = $('#pt-cauldron').getBoundingClientRect(), ar = $('#pt-avatar').getBoundingClientRect();
  const sx = cr.left - st.left + cr.width / 2, sy = cr.top - st.top + cr.height * 0.2, floor = cr.top - st.top + cr.height * 0.98;
  const lx = sx - cr.width * 0.75, ex = Math.max(60, ar.left - st.left - 50);
  let t = 0, meowed = false;
  const meow = () => { try { const ac = audioCtx; if (!ac || !db.settings.sound) return; const o = ac.createOscillator(), gn = ac.createGain(), t0 = ac.currentTime; o.type = 'triangle'; o.frequency.setValueAtTime(700, t0); o.frequency.linearRampToValueAtTime(1100, t0 + 0.15); o.frequency.linearRampToValueAtTime(600, t0 + 0.45); gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.08, t0 + 0.05); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5); o.connect(gn).connect(ac.destination); o.start(t0); o.stop(t0 + 0.55); } catch { /* egal */ } };
  ctl.frame((dt) => {
    if (!holder.parent) return;
    t += dt;
    if (t < 0.7) { const k = t / 0.7; holder.position.set(sx + (lx - sx) * k, -(sy + (floor - sy) * k - Math.sin(k * Math.PI) * 140), 420); holder.rotation.set(0, -Math.PI / 2, -k * Math.PI * 2); }
    else if (t < 2.1) { const k = (t - 0.7) / 1.4; holder.rotation.set(0, -Math.PI / 2, 0); holder.position.set(lx + (ex - lx) * k, -floor + Math.abs(Math.sin(k * Math.PI * 6)) * 8, 420); }
    else if (t < 3.3) { const k = Math.min(1, (t - 2.1) / 0.3); holder.rotation.set(0, -Math.PI / 2 * (1 - k), 0); holder.position.set(ex, -floor, 420); if (!meowed && t > 2.3) { meowed = true; meow(); } }
    else { const k = Math.min(1, (t - 3.3) / 0.4); holder.scale.setScalar(1 - k); if (k >= 1) ctl.scene.remove(holder); }
  });
  return true;
}
