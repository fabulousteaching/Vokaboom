/* Teilmal – 3D-Avatar (Voxel-Baukasten, rund geglättet)
 *
 * Gebaut wird die Figur wie mit Klötzchen: Kleidung, Frisuren und Gegenstände sind kleine 3D-Pixelbilder (Voxel),
 * alles im Code – keine Modelldateien, keine fremden Assets, kein Download, keine Lizenzfragen.
 * Danach wird daraus eine glatte, runde Oberfläche gerechnet (Surface Nets + Glättung); das Gesicht wird
 * als Bild aufgelegt (Augen, Brauen, Mund) und wechselt mit der Bewegung (Mimik, Blinzeln).
 * Körperteile sind starr (Kopf, Körper, Arme, Beine) und drehen sich um ihre Gelenke –
 * darum braucht es kein Skelett, und es läuft auch auf älteren Tablets flüssig.
 * Benutzt nur three.js (bereits im Projekt, MIT-Lizenz).
 *
 * Masse in Voxeln (1 Voxel = VOX.S Meter). Der Ursprung der Figur ist zwischen den Füssen auf dem Boden.
 *   Beine 5×13×6 (mit Schuhen), Körper 10×11×6, Arme 4×11×6, Kopf 12×12×12. Vorne ist +z.
 * Kleidung liegt in Schichten: Körper (Haut) → Hose → Schuhe → Oberteil → Gurt/Tasche → Hals → Rücken → Kopf.
 */
'use strict';

// Gebaut wird zuerst grob (1 Voxel = 6 cm), dann jedes Voxel in 2×2×2 feine Voxel geteilt (3 cm) für Gesicht und Verzierungen.
const VOX = { S: 0.03, LEG: 13, HIP: 13, NECK: 24, SHOULDER: 23, ARM_X: 7, smooth: true, round: 14 };

/* ---------------- Voxel-Menge ---------------- */
const vxK = (x, y, z) => ((x + 256) * 512 + (y + 256)) * 512 + (z + 256);
class VoxSet {
  constructor() { this.m = new Map(); this.tag = null; }
  set(x, y, z, c, mat = 0, tag = this.tag) { this.m.set(vxK(x, y, z), { x, y, z, c, mat, tag }); return this; }
  setIfEmpty(x, y, z, c, mat = 0, tag = this.tag) { if (!this.has(x, y, z)) this.set(x, y, z, c, mat, tag); return this; }
  get(x, y, z) { return this.m.get(vxK(x, y, z)); }
  has(x, y, z) { return this.m.has(vxK(x, y, z)); }
  del(x, y, z) { this.m.delete(vxK(x, y, z)); return this; }
  /** Quader füllen (Grenzen eingeschlossen). c: Farbe oder fn(x,y,z) → Farbe/null */
  box(x0, y0, z0, x1, y1, z1, c, mat = 0) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const cc = typeof c === 'function' ? c(x, y, z) : c;
      if (cc != null) this.set(x, y, z, cc, mat);
    }
    return this;
  }
  /** vorhandene Voxel umfärben: fn(v) → neue Farbe oder null (lassen) */
  paint(fn) { for (const v of this.m.values()) { const r = fn(v); if (r != null) { v.c = r; if (this.tag) v.tag = this.tag; } } return this; }
  recolor(x, y, z, c, mat) { const v = this.get(x, y, z); if (v) { v.c = c; if (mat != null) v.mat = mat; if (this.tag) v.tag = this.tag; } return this; }
  filter(fn) { for (const [k, v] of this.m) if (!fn(v)) this.m.delete(k); return this; }
}

/* ---------------- Hilfen ---------------- */
function vxRand(x, y, z, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041) ^ Math.imul((s | 0) + 7, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Farbe heller (amt > 0) oder dunkler (amt < 0) */
function vxShade(hex, amt) {
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return (f((hex >> 16) & 255) << 16) | (f((hex >> 8) & 255) << 8) | f(hex & 255);
}
/** zwei Farben mischen (t = 0: a, t = 1: b) */
function vxMix(a, b, t) {
  const m = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
/** gerade Linie aus Voxeln (Gurte, Ketten) */
function vxLine(set, a, b, c, mat = 0) {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    set.set(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), typeof c === 'function' ? c(i) : c, mat);
  }
}
/** kleines Pixelbild auf eine senkrechte Fläche (rows: oben → unten, '.' = leer, Buchstaben = Farben aus pal) */
function vxSprite(set, rows, pal, x0, y0, z, mat = 0) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (pal[ch] != null) set.set(x0 + i, y0 - j, z, pal[ch], mat); }));
}
/** Ring um einen Quader (für Bündchen, Uhren, Stulpen): Schicht im Abstand d auf Höhe y */
function vxRing(set, x0, z0, x1, z1, y, d, colorFn, mat = 0) {
  for (let x = x0 - d; x <= x1 + d; x++) for (let z = z0 - d; z <= z1 + d; z++) {
    if (x > x0 - d && x < x1 + d && z > z0 - d && z < z1 + d) continue;
    const c = colorFn(x, y, z);
    if (c != null) set.set(x, y, z, c, mat);
  }
}
/** Schale um einen Quader (eine Schicht aussen herum, optional oben) */
function vxShell(set, x0, y0, z0, x1, y1, z1, colorFn, { top = false, mat = 0 } = {}) {
  for (let x = x0 - 1; x <= x1 + 1; x++) for (let y = y0; y <= y1 + (top ? 1 : 0); y++) for (let z = z0 - 1; z <= z1 + 1; z++) {
    const inX = x >= x0 && x <= x1, inZ = z >= z0 && z <= z1;
    if (inX && inZ && y <= y1) continue;
    if (y > y1 && !(inX && inZ)) continue;
    const c = colorFn(x, y, z);
    if (c != null) set.set(x, y, z, c, mat);
  }
}
/** Haarbüschel: Klumpen, der in Richtung d dünner wird */
function vxSpike(set, p, d, len, r0, colors, seed, avoid, tag = 'spike') {
  const dl = Math.hypot(d[0], d[1], d[2]) || 1;
  const u = [d[0] / dl, d[1] / dl, d[2] / dl];
  const base = colors[Math.floor(vxRand(p[0], p[1], p[2], seed) * colors.length)];
  for (let k = -2; k < len; k++) {
    const r = Math.max(0, Math.round(r0 * (1 - k / len)));
    const c = [Math.round(p[0] + u[0] * k * 1.1), Math.round(p[1] + u[1] * k * 1.1), Math.round(p[2] + u[2] * k * 1.1)];
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let l = -r; l <= r; l++) {
      if (Math.abs(i) + Math.abs(j) + Math.abs(l) > r + (r > 1 ? 1 : 0)) continue;
      const x = c[0] + i, y = c[1] + j, z = c[2] + l;
      if (avoid && avoid(x, y, z)) continue;
      set.set(x, y, z, k >= len - 1 ? vxShade(base, 0.12) : base, 0, tag);
    }
  }
}
/** Kugel aus Voxeln. c: Farbe oder fn(x,y,z). avoid(x,y,z): dort nichts setzen */
function vxBall(set, cx, cy, cz, r, c, { avoid = null, tag, mat = 0, sy = 1 } = {}) {
  const R = Math.ceil(r + 1);
  for (let x = Math.floor(cx - R); x <= cx + R; x++) for (let y = Math.floor(cy - R * sy); y <= cy + R * sy; y++) for (let z = Math.floor(cz - R); z <= cz + R; z++) {
    const dx = x + 0.5 - cx - 0.5, dy = (y + 0.5 - cy - 0.5) / sy, dz = z + 0.5 - cz - 0.5;
    if (dx * dx + dy * dy + dz * dz > r * r) continue;
    if (avoid && avoid(x, y, z)) continue;
    set.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, mat, tag ?? set.tag);
  }
}
/** Ziffern 3×5 für Trikots */
const VX_DIGITS = { 0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], 1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 2: ['XXX', '..X', 'XXX', 'X..', 'XXX'], 3: ['XXX', '..X', '.XX', '..X', 'XXX'], 4: ['X.X', 'X.X', 'XXX', '..X', '..X'],
  5: ['XXX', 'X..', 'XXX', '..X', 'XXX'], 6: ['XXX', 'X..', 'XXX', 'X.X', 'XXX'], 7: ['XXX', '..X', '.X.', '.X.', '.X.'], 8: ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'], 9: ['XXX', 'X.X', 'XXX', '..X', 'XXX'] };
function vxNumber(set, n, x0, y0, z, c, mirror = false) {
  const ds = String(n).split('');
  const w = ds.length * 4 - 1;
  ds.forEach((d, i) => VX_DIGITS[d].forEach((row, j) => [...row].forEach((ch, k) => {
    if (ch !== 'X') return;
    const x = mirror ? x0 + w - 1 - (i * 4 + k) : x0 + i * 4 + k;
    set.set(x, y0 - j, z, c);
  })));
}

/* ---------------- Mesh: nur sichtbare Flächen, Ecken-Verschattung (AO) und Pixel-Schattierung ---------------- */
function vxGeometry(T, set, { ao = 0.14, noise = 0.025, seed = 0 } = {}) {
  const S = VOX.S;
  const per = new Map();
  const col = new T.Color();
  const has = (p) => set.has(p[0], p[1], p[2]);
  for (const v of set.m.values()) {
    let g = per.get(v.mat);
    if (!g) { g = { pos: [], nor: [], col: [] }; per.set(v.mat, g); }
    col.setHex(v.c);
    const glow = v.mat === 2;
    // wie gemalt: oben ein Hauch heller, unten dunkler, Kanten etwas dunkler
    let pk = 1;
    if (!glow) {
      pk = 1 + (vxRand(v.x, v.y, v.z, seed) - 0.5) * 2 * noise;
      if (!set.has(v.x, v.y + 1, v.z)) pk *= 1.08;
      if (!set.has(v.x, v.y - 1, v.z)) pk *= 0.88;
      const open = (set.has(v.x + 1, v.y, v.z) ? 0 : 1) + (set.has(v.x - 1, v.y, v.z) ? 0 : 1) + (set.has(v.x, v.y, v.z + 1) ? 0 : 1) + (set.has(v.x, v.y, v.z - 1) ? 0 : 1);
      if (open >= 2) pk *= 0.95;
    }
    for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
      const n = [0, 0, 0]; n[a] = s;
      const front = [v.x + n[0], v.y + n[1], v.z + n[2]];
      if (has(front)) continue;
      const u = (a + 1) % 3, w = (a + 2) % 3;
      const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      const vs = corners.map(([du, dw]) => {
        const p = [v.x, v.y, v.z];
        p[a] += s > 0 ? 1 : 0; p[u] += du; p[w] += dw;
        const o1 = front.slice(); o1[u] += du ? 1 : -1;
        const o2 = front.slice(); o2[w] += dw ? 1 : -1;
        const o3 = o1.slice(); o3[w] += dw ? 1 : -1;
        const s1 = has(o1) ? 1 : 0, s2 = has(o2) ? 1 : 0, s3 = has(o3) ? 1 : 0;
        const occ = s1 && s2 ? 3 : s1 + s2 + s3;
        return { p, k: (glow ? 1 : 1 - occ * ao) * pk };
      });
      const order = vs[0].k + vs[2].k < vs[1].k + vs[3].k ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
      for (const i of order) {
        const q = vs[i];
        g.pos.push(q.p[0] * S, q.p[1] * S, q.p[2] * S);
        g.nor.push(n[0], n[1], n[2]);
        g.col.push(col.r * q.k, col.g * q.k, col.b * q.k);
      }
    }
  }
  const pos = [], nor = [], cl = [];
  const geo = new T.BufferGeometry();
  let start = 0;
  for (const mat of [...per.keys()].sort()) {
    const g = per.get(mat);
    for (let i = 0; i < g.pos.length; i++) { pos.push(g.pos[i]); nor.push(g.nor[i]); cl.push(g.col[i]); }
    const count = g.pos.length / 3;
    geo.addGroup(start, count, mat);
    start += count;
  }
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
  geo.computeBoundingSphere();
  return geo;
}
/**
 * Glatte Oberfläche aus den Voxeln («Surface Nets» + Taubin-Glättung): gleiche Teile, aber rund statt eckig.
 * Jede sichtbare Voxel-Fläche wird zu einem Viereck; dessen Ecken liegen in den Nachbarzellen und werden geglättet.
 * decal: optional { test(v, a, s) → bool, uv(x, y, z) → [u, v] } – sammelt Flächen für ein aufgelegtes Bild (Gesicht).
 */
/**
 * Glatte Oberfläche (für Lack, Kunststoff …): Das Voxel-Volumen wird weichgezeichnet (Gauss, sigma in Voxeln).
 * - Normalen aus dem Gefälle des weichen Volumens → Glanzlichter ohne „Knet-Wellen“
 * - dicke Stellen (innen > 0,75) werden auf die glatte Hülle (Wert 0,5) gezogen; dünne Teile (Stangen, Flügel) bleiben, wie sie sind
 */
function vxField(set, sigma) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const v of set.m.values()) { if (v.x < x0) x0 = v.x; if (v.y < y0) y0 = v.y; if (v.z < z0) z0 = v.z; if (v.x > x1) x1 = v.x; if (v.y > y1) y1 = v.y; if (v.z > z1) z1 = v.z; }
  const R = Math.max(1, Math.ceil(sigma * 2.5)), pad = R + 2;
  const ox = x0 - pad, oy = y0 - pad, oz = z0 - pad;
  const nx = x1 - x0 + 1 + pad * 2, ny = y1 - y0 + 1 + pad * 2, nz = z1 - z0 + 1 + pad * 2;
  let a = new Float32Array(nx * ny * nz), b = new Float32Array(nx * ny * nz);
  for (const v of set.m.values()) a[(v.x - ox) + nx * ((v.y - oy) + ny * (v.z - oz))] = 1;
  const K = []; let ks = 0;
  for (let i = -R; i <= R; i++) { const w = Math.exp(-(i * i) / (2 * sigma * sigma)); K.push(w); ks += w; }
  for (let i = 0; i < K.length; i++) K[i] /= ks;
  const pass = (dx, dy, dz) => {
    const st = dx + nx * (dy + ny * dz), len = dx ? nx : dy ? ny : nz;
    b.fill(0);
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = x + nx * (y + ny * z), c = dx ? x : dy ? y : z;
      let acc = 0;
      for (let k = -R; k <= R; k++) { const cc = c + k; if (cc >= 0 && cc < len) acc += a[i + k * st] * K[k + R]; }
      b[i] = acc;
    }
    [a, b] = [b, a];
  };
  pass(1, 0, 0); pass(0, 1, 0); pass(0, 0, 1);
  const F = a;
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz ? 0 : F[x + nx * (y + ny * z)]);
  // Wert an einer Stelle der Oberfläche (Voxel v liegt bei v + 0,5)
  const val = (px, py, pz) => {
    const gx = px - 0.5 - ox, gy = py - 0.5 - oy, gz = pz - 0.5 - oz;
    const ix = Math.floor(gx), iy = Math.floor(gy), iz = Math.floor(gz), fx = gx - ix, fy = gy - iy, fz = gz - iz;
    let s = 0;
    for (let d = 0; d < 8; d++) {
      const ax = d & 1, ay = (d >> 1) & 1, az = (d >> 2) & 1;
      s += at(ix + ax, iy + ay, iz + az) * (ax ? fx : 1 - fx) * (ay ? fy : 1 - fy) * (az ? fz : 1 - fz);
    }
    return s;
  };
  const grad = (px, py, pz, h = 0.5) => [
    (val(px + h, py, pz) - val(px - h, py, pz)) / (2 * h),
    (val(px, py + h, pz) - val(px, py - h, pz)) / (2 * h),
    (val(px, py, pz + h) - val(px, py, pz - h)) / (2 * h)];
  return { val, grad };
}
function vxFieldRefine(P, N, nv, set, sigma, project = true) {
  const { val, grad } = vxField(set, sigma);
  for (let i = 0; i < nv; i++) {
    let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    let g = grad(x, y, z), gl = Math.hypot(g[0], g[1], g[2]);
    if (gl < 0.02) continue; // kein klares Gefälle (z. B. tief in einer Spalte): Mesh-Normale behalten
    let nxv = -g[0] / gl, nyv = -g[1] / gl, nzv = -g[2] / gl;
    if (project && val(x - nxv * 1.3, y - nyv * 1.3, z - nzv * 1.3) > 0.75) {
      const sx = x, sy = y, sz = z;
      for (let it = 0; it < 3; it++) {
        const f = val(x, y, z) - 0.5;
        g = grad(x, y, z); const g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
        if (g2 < 1e-4) break;
        let k = f / g2;
        const st = Math.hypot(g[0] * k, g[1] * k, g[2] * k);
        if (st > 0.4) k *= 0.4 / st;
        x -= g[0] * k; y -= g[1] * k; z -= g[2] * k;
      }
      const d = Math.hypot(x - sx, y - sy, z - sz);
      if (d > 0.8) { const f = 0.8 / d; x = sx + (x - sx) * f; y = sy + (y - sy) * f; z = sz + (z - sz) * f; }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      g = grad(x, y, z); gl = Math.hypot(g[0], g[1], g[2]) || 1;
      nxv = -g[0] / gl; nyv = -g[1] / gl; nzv = -g[2] / gl;
    }
    // Normale: weiche Feld-Normale, bei schwachem Gefälle mit der Mesh-Normale gemischt
    const w = Math.min(1, gl / 0.12);
    const mx = N[i * 3] * (1 - w) + nxv * w, my = N[i * 3 + 1] * (1 - w) + nyv * w, mz = N[i * 3 + 2] * (1 - w) + nzv * w;
    const l = Math.hypot(mx, my, mz) || 1;
    N[i * 3] = mx / l; N[i * 3 + 1] = my / l; N[i * 3 + 2] = mz / l;
  }
}
function vxSmoothGeometry(T, set, { iter = VOX.round, ao = 0, noise = 0, seed = 0, decal = null, field = 0, project = true } = {}) {
  const S = VOX.S;
  const vid = new Map(), P = [];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cellVertex = (cx, cy, cz) => {
    const k = vxK(cx, cy, cz);
    let i = vid.get(k);
    if (i != null) return i;
    const occ = [];
    for (let d = 0; d < 8; d++) occ[d] = set.has(cx + (d & 1), cy + ((d >> 1) & 1), cz + ((d >> 2) & 1));
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) if (occ[a] !== occ[b]) {
      sx += ((a & 1) + (b & 1)) / 2; sy += (((a >> 1) & 1) + ((b >> 1) & 1)) / 2; sz += (((a >> 2) & 1) + ((b >> 2) & 1)) / 2; n++;
    }
    i = P.length / 3;
    P.push(cx + 0.5 + sx / n, cy + 0.5 + sy / n, cz + 0.5 + sz / n);
    vid.set(k, i);
    return i;
  };
  const quads = []; // [i0,i1,i2,i3, mat, r,g,b ×4 (AO je Ecke), decal?]
  const col = new T.Color();
  const has = (p) => set.has(p[0], p[1], p[2]);
  for (const v of set.m.values()) {
    col.setHex(v.c);
    const glow = v.mat === 2;
    const pk = glow || !noise ? 1 : 1 + (vxRand(v.x, v.y, v.z, seed) - 0.5) * 2 * noise;
    const dec = !!(decal && decal.test(v));
    for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
      const n = [0, 0, 0]; n[a] = s;
      const front = [v.x + n[0], v.y + n[1], v.z + n[2]];
      if (has(front)) continue;
      const u = (a + 1) % 3, w = (a + 2) % 3;
      const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      const q = { idx: [], k: [], mat: v.mat, c: [col.r, col.g, col.b], dec };
      for (const [du, dw] of corners) {
        const c = [v.x, v.y, v.z];
        c[a] = s > 0 ? v[['x', 'y', 'z'][a]] : v[['x', 'y', 'z'][a]] - 1;
        c[u] = c[u] - 1 + du; c[w] = c[w] - 1 + dw;
        q.idx.push(cellVertex(c[0], c[1], c[2]));
        const o1 = front.slice(); o1[u] += du ? 1 : -1;
        const o2 = front.slice(); o2[w] += dw ? 1 : -1;
        const o3 = o1.slice(); o3[w] += dw ? 1 : -1;
        const s1 = has(o1) ? 1 : 0, s2 = has(o2) ? 1 : 0, s3 = has(o3) ? 1 : 0;
        q.k.push((glow || !ao ? 1 : 1 - (s1 && s2 ? 3 : s1 + s2 + s3) * ao) * pk);
      }
      quads.push(q);
    }
  }
  // Nachbarn für die Glättung
  const nv = P.length / 3;
  const nb = Array.from({ length: nv }, () => new Set());
  for (const q of quads) for (let i = 0; i < 4; i++) { const a = q.idx[i], b = q.idx[(i + 1) % 4]; nb[a].add(b); nb[b].add(a); }
  const step = (lam) => {
    const out = new Float32Array(P.length);
    for (let i = 0; i < nv; i++) {
      let x = 0, y = 0, z = 0, n = 0;
      for (const j of nb[i]) { x += P[j * 3]; y += P[j * 3 + 1]; z += P[j * 3 + 2]; n++; }
      if (!n) { out[i * 3] = P[i * 3]; out[i * 3 + 1] = P[i * 3 + 1]; out[i * 3 + 2] = P[i * 3 + 2]; continue; }
      out[i * 3] = P[i * 3] + lam * (x / n - P[i * 3]);
      out[i * 3 + 1] = P[i * 3 + 1] + lam * (y / n - P[i * 3 + 1]);
      out[i * 3 + 2] = P[i * 3 + 2] + lam * (z / n - P[i * 3 + 2]);
    }
    for (let i = 0; i < P.length; i++) P[i] = out[i];
  };
  for (let t = 0; t < iter; t++) { step(0.55); step(-0.58); } // Taubin: rund, ohne zu schrumpfen
  // weiche Normalen
  const N = new Float32Array(P.length);
  const pv = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  for (const q of quads) {
    const [a, b, c, d] = q.idx.map(pv);
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const i of q.idx) { N[i * 3] += n[0]; N[i * 3 + 1] += n[1]; N[i * 3 + 2] += n[2]; }
    if (q.dec) { const l = Math.hypot(n[0], n[1], n[2]) || 1; q.dec = n[2] / l > 0.35; } // Gesichtsbild nur auf Flächen, die nach vorne zeigen
  }
  for (let i = 0; i < nv; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
  if (field > 0) vxFieldRefine(P, N, nv, set, field, project);
  // Dreiecke je Material
  const per = new Map();
  const dPos = [], dNor = [], dUv = [];
  for (const q of quads) {
    let g = per.get(q.mat);
    if (!g) { g = { pos: [], nor: [], col: [] }; per.set(q.mat, g); }
    const order = q.k[0] + q.k[2] < q.k[1] + q.k[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
    for (const t of order) {
      const i = q.idx[t];
      g.pos.push(P[i * 3] * S, P[i * 3 + 1] * S, P[i * 3 + 2] * S);
      g.nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
      g.col.push(q.c[0] * q.k[t], q.c[1] * q.k[t], q.c[2] * q.k[t]);
      if (q.dec) { dPos.push(P[i * 3] * S, P[i * 3 + 1] * S, P[i * 3 + 2] * S); dNor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); dUv.push(...decal.uv(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])); }
    }
  }
  const pos = [], nor = [], cl = [];
  const geo = new T.BufferGeometry();
  let start = 0;
  for (const mat of [...per.keys()].sort()) {
    const g = per.get(mat);
    for (let i = 0; i < g.pos.length; i++) { pos.push(g.pos[i]); nor.push(g.nor[i]); cl.push(g.col[i]); }
    geo.addGroup(start, g.pos.length / 3, mat);
    start += g.pos.length / 3;
  }
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
  geo.computeBoundingSphere();
  let decalGeo = null;
  if (dPos.length) {
    decalGeo = new T.BufferGeometry();
    decalGeo.setAttribute('position', new T.Float32BufferAttribute(dPos, 3));
    decalGeo.setAttribute('normal', new T.Float32BufferAttribute(dNor, 3));
    decalGeo.setAttribute('uv', new T.Float32BufferAttribute(dUv, 2));
  }
  return { geo, decalGeo };
}
/** Materialien: 0 matt (Stoff, Haut), 1 glänzend (Kunststoff), 2 leuchtend, 3 Metall */
let VX_MATS = null;
function vxMaterials(T) {
  if (VX_MATS && VX_MATS.T === T) return VX_MATS.list;
  const list = [
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05 }),
    new T.MeshBasicMaterial({ vertexColors: true }),
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.9 }),
  ];
  VX_MATS = { T, list };
  return list;
}
function vxMesh(T, set, opts = {}) {
  let geo, decalGeo = null;
  if (VOX.smooth) ({ geo, decalGeo } = vxSmoothGeometry(T, set, opts)); else geo = vxGeometry(T, set, opts);
  const m = new T.Mesh(geo, vxMaterials(T));
  m.castShadow = true; m.receiveShadow = true;
  if (decalGeo && opts.decalMat) { const d = new T.Mesh(decalGeo, opts.decalMat); d.renderOrder = 2; m.add(d); }
  return m;
}

/* ---------------- Körper ---------------- */
// Kopf: x -6..5, y 0..11, z -6..5. Körper: x -5..4, y 0..10, z -3..2.
// Arme (lokal, Gelenk an der Schulter): x -2..1, y -10..0, z -3..2 (aussen: rechter Arm +x, linker Arm -x).
// Beine (lokal, Gelenk an der Hüfte): rechts x 0..4, links x -5..-1, y -13..-1, z -3..2.
const VX_HEAD = { x0: -6, x1: 5, y0: 0, y1: 11, z0: -6, z1: 5 };
const VX_OUTFITS = new Set(['dress', 'space', 'hero', 'tux', 'robe', 'overalls']);
const vxInHead = (x, y, z) => x >= VX_HEAD.x0 && x <= VX_HEAD.x1 && y >= VX_HEAD.y0 && y <= VX_HEAD.y1 && z >= VX_HEAD.z0 && z <= VX_HEAD.z1;

function vxBody(look) {
  const P = { head: new VoxSet(), torso: new VoxSet(), armR: new VoxSet(), armL: new VoxSet(), legR: new VoxSet(), legL: new VoxSet() };
  const skin = look.skin;
  P.skin = skin;
  vxTagAll(P, 'skin');
  P.head.box(-6, 0, -6, 5, 11, 5, skin);
  P.torso.box(-5, 0, -3, 4, 10, 2, skin);
  P.armR.box(-2, -10, -3, 1, 0, 2, skin);
  P.armL.box(-2, -10, -3, 1, 0, 2, skin);
  P.legR.box(0, -VOX.LEG, -3, 4, -1, 2, skin);
  P.legL.box(-5, -VOX.LEG, -3, -1, -1, 2, skin);
  // Gesicht: kommt fein aufgelöst in vxFace()
  // Hände etwas dunkler als die Arme (Handfläche)
  for (const arm of [P.armR, P.armL]) arm.paint((v) => (v.y === -10 ? vxShade(skin, -0.06) : null));
  vxTagAll(P, null);
  return P;
}

/* ---------------- Frisuren ---------------- */
/** Haar-Schale um den Kopf. side/back/front.ok(...) → true = dort Haar */
function vxHairShell(head, palette, { top = 2, side, back, front, seed = 3, accent = null }) {
  const H = VX_HEAD;
  let [base, dark, light] = palette;
  if (VOX.smooth) { dark = vxMix(base, dark, 0.55); light = vxMix(base, light, 0.5); } // rund: sanftere Strähnen
  const shade = (x, y, z) => {
    if (accent && accent.where(x, y, z)) return vxRand(x, 0, z, seed) < 0.3 ? vxShade(accent.c, -0.18) : accent.c;
    const r = y > H.y1 ? vxRand(x, 0, z, seed) : vxRand(x, Math.floor((y + 40) / 4), z, seed); // Strähnen
    return r < 0.22 ? dark : r > 0.84 ? light : base;
  };
  for (let x = H.x0 - 2; x <= H.x1 + 2; x++) for (let y = H.y0 - 10; y <= H.y1 + top; y++) for (let z = H.z0 - 2; z <= H.z1 + 2; z++) {
    const dx = Math.max(H.x0 - x, x - H.x1, 0), dy = Math.max(y - H.y1, 0), dz = Math.max(H.z0 - z, z - H.z1, 0);
    if (!dx && !dy && !dz) continue;
    if (y < H.y0 && !(z < H.z0) && !dx) continue;
    const isSide = dx > 0, isBack = z < H.z0, isFront = z > H.z1, isTop = dy > 0;
    if (isTop && (dy > top || dx > 1 || dz > 1)) continue;
    if (isSide && (dx > (side.thick || 1) || !side.ok(z, y, x))) continue;
    if (isBack && (dz > (back.thick || 2) || !back.ok(x, y))) continue;
    if (isFront && (dz > 1 || !front.ok(x, y))) continue;
    if (isSide && isBack && !(back.ok(x, y) && side.ok(z, y, x))) continue;
    head.set(x, y, z, shade(x, y, z));
  }
}
const VX_HAIR = {
  /** Strubbelkopf mit dicken Büscheln */
  spiky(head, o) {
    const pal = [o.c, vxShade(o.c, -0.25), vxShade(o.c, 0.18)];
    const jag = [1, 0, 2, 1, 0, 1, 2, 0, 1, 2, 0, 1, 1, 0, 2, 1];
    vxHairShell(head, pal, {
      side: { ok: (z, y) => y >= (z > 2 ? 7 : 5) },
      back: { ok: (x, y) => y >= 3 },
      front: { ok: (x, y) => y >= 8 + jag[(x + 8) & 15] },
    });
    const avoid = vxInHead;
    for (const [p, d, len, r] of [
      [[-4, 13, 2], [-0.6, 1, 0.5], 5, 2], [[0, 13, 3], [0.1, 1, 0.6], 6, 2], [[4, 13, 1], [0.7, 1, 0.3], 5, 2],
      [[-2, 13, -2], [-0.3, 1, -0.6], 5, 2], [[3, 13, -3], [0.5, 1, -0.7], 5, 2], [[-6, 12, -4], [-0.8, 0.6, -0.6], 4, 2],
      [[6, 12, -5], [0.8, 0.5, -0.6], 4, 1], [[-8, 9, 1], [-1, 0.3, 0.2], 3, 1], [[7, 9, 2], [1, 0.4, 0.2], 3, 1],
      [[-4, 10, 7], [-0.3, -1, 0.5], 3, 1], [[0, 10, 7], [0.1, -1, 0.6], 3, 1], [[3, 10, 7], [0.4, -1, 0.5], 3, 1],
    ]) vxSpike(head, p, d, len, r, pal, 5, avoid);
  },
  /** Seitenscheitel mit langem Pony und farbiger Strähne */
  emo(head, o) {
    const pal = [o.c, vxShade(o.c, -0.35), vxShade(o.c, 0.2)];
    const accent = { c: o.c2 || 0x8b5cf6, where: (x, y, z) => (x >= 1 && x <= 2) && (z > 0 || y > VX_HEAD.y1) };
    vxHairShell(head, pal, {
      accent,
      side: { ok: (z, y, x) => y >= (x < 0 ? 4 : 6) },
      back: { ok: (x, y) => y >= 2 },
      front: { ok: (x, y) => (x < 1 ? y >= 7 - (x <= -5 ? 2 : 0) : y >= 9 + ((x * 7) % 2)) },
      seed: 9,
    });
    const avoid = vxInHead;
    for (const [p, d, len, r] of [
      [[-3, 13, 2], [-0.8, 0.8, 0.6], 5, 2], [[1, 13, 1], [0.4, 1, 0.4], 5, 2], [[-2, 13, -3], [-0.4, 1, -0.7], 5, 2],
      [[4, 13, -2], [0.8, 0.8, -0.4], 4, 2], [[-7, 10, 2], [-1, -0.2, 0.4], 3, 1], [[-5, 9, 7], [-0.3, -1, 0.3], 3, 1],
    ]) vxSpike(head, p, d, len, r, pal, 11, avoid);
    for (const [p, d] of [[[2, 13, 2], [0.3, 1, 0.6]], [[1, 10, 7], [0.2, -1, 0.4]]]) vxSpike(head, p, d, 4, 1, [accent.c], 12, avoid);
  },
  /** Kurzhaar (Raspel) */
  buzz(head, o) {
    vxHairShell(head, [o.c, vxShade(o.c, -0.15), vxShade(o.c, 0.12)], {
      top: 1, side: { ok: (z, y) => y >= 7 }, back: { ok: (x, y) => y >= 4, thick: 1 }, front: { ok: (x, y) => y >= 10 }, seed: 17,
    });
  },
  /** Bob bis zum Kinn mit geradem Pony */
  bob(head, o) {
    vxHairShell(head, [o.c, vxShade(o.c, -0.22), vxShade(o.c, 0.18)], {
      top: 2, side: { ok: (z, y) => y >= 1, thick: 2 }, back: { ok: (x, y) => y >= 1, thick: 2 }, front: { ok: (x, y) => y >= 8 }, seed: 21,
    });
  },
  /** Topfschnitt */
  bowl(head, o) {
    vxHairShell(head, [o.c, vxShade(o.c, -0.2), vxShade(o.c, 0.15)], {
      top: 2, side: { ok: (z, y) => y >= 6, thick: 2 }, back: { ok: (x, y) => y >= 4, thick: 2 }, front: { ok: (x, y) => y >= 8 }, seed: 27,
    });
  },
  /** Pferdeschwanz mit Haargummi */
  ponytail(head, o) {
    const pal = [o.c, vxShade(o.c, -0.22), vxShade(o.c, 0.18)];
    vxHairShell(head, pal, { top: 1, side: { ok: (z, y) => y >= 6 }, back: { ok: (x, y) => y >= 5, thick: 1 }, front: { ok: (x, y) => y >= (x < -2 ? 8 : 9) }, seed: 23 });
    vxSpike(head, [0, 9, -8], [0, -0.55, -0.6], 10, 2, pal, 24, vxInHead, 'hair');
    vxBall(head, 0, 9, -8, 1.7, o.c2 ?? 0xf472b6, { tag: 'hair' });
  },
  /** zwei Zöpfe an der Seite */
  pigtails(head, o) {
    const pal = [o.c, vxShade(o.c, -0.22), vxShade(o.c, 0.18)];
    vxHairShell(head, pal, { top: 1, side: { ok: (z, y) => y >= 5 }, back: { ok: (x, y) => y >= 4, thick: 1 }, front: { ok: (x, y) => y >= 8 + ((x + 9) % 3 === 0 ? 1 : 0) }, seed: 25 });
    for (const s of [-1, 1]) {
      const x = s < 0 ? -8 : 7;
      vxSpike(head, [x, 8, -1], [s * 0.35, -1, -0.15], 9, 1.6, pal, 26 + s, vxInHead, 'hair');
      vxBall(head, x, 8, -1, 1.5, o.c2 ?? 0xf472b6, { tag: 'hair' });
    }
  },
  /** zwei Dutts oben */
  buns(head, o) {
    const pal = [o.c, vxShade(o.c, -0.22), vxShade(o.c, 0.18)];
    vxHairShell(head, pal, { top: 1, side: { ok: (z, y) => y >= 6 }, back: { ok: (x, y) => y >= 4, thick: 1 }, front: { ok: (x, y) => y >= 9 }, seed: 29 });
    for (const x of [-5, 4]) vxBall(head, x, 13, -1, 3.1, (xx, yy, zz) => (vxRand(xx, yy, zz, 31) < 0.2 ? pal[1] : pal[0]), { avoid: vxInHead, tag: 'spike' });
  },
  /** grosse Locken */
  afro(head, o) {
    const pal = [o.c, vxShade(o.c, -0.2), vxShade(o.c, 0.16)];
    const H = VX_HEAD;
    for (let x = -11; x <= 10; x++) for (let y = 2; y <= 21; y++) for (let z = -11; z <= 10; z++) {
      if (vxInHead(x, y, z)) continue;
      const dx = (x + 0.5) / 10.5, dy = (y - 10.5) / 10, dz = (z + 1) / 10.5;
      if (dx * dx + dy * dy + dz * dz > 1) continue;
      if (z > H.z1 && y < 9) continue;          // Gesicht frei
      if (z > 1 && y < 6 && Math.abs(x + 0.5) < 6.5) continue;
      head.set(x, y, z, pal[Math.floor(vxRand(x >> 1, y >> 1, z >> 1, 33) * 3)], 0, 'hair');
    }
    for (let i = 0; i < 46; i++) {               // Löckchen an der Oberfläche
      const a = vxRand(i, 1, 2, 35) * Math.PI * 2, e = vxRand(i, 3, 4, 35) * 1.3 - 0.2;
      const x = Math.round(Math.cos(a) * Math.cos(e) * 10), y = Math.round(10.5 + Math.sin(e) * 10), z = Math.round(Math.sin(a) * Math.cos(e) * 10.5 - 1);
      if (z > 4 && y < 10) continue;
      vxBall(head, x, y, z, 1.6, pal[i % 3], { avoid: vxInHead, tag: 'spike' });
    }
  },
  /** Irokese mit kurzen Seiten */
  mohawk(head, o) {
    const pal = [o.c, vxShade(o.c, -0.22), vxShade(o.c, 0.2)];
    const shaved = vxMix(o.c, 0x8c7d78, 0.55);
    vxHairShell(head, [shaved, vxShade(shaved, -0.08), shaved], { top: 1, side: { ok: (z, y) => y >= 8 }, back: { ok: (x, y) => y >= 5, thick: 1 }, front: { ok: (x, y) => y >= 10 }, seed: 37 });
    for (let z = -7; z <= 6; z++) {
      const h = 4 + Math.round(2.2 * Math.sin((z + 7) * 0.45));
      for (let y = 12; y <= 12 + h; y++) for (const x of [-1, 0]) head.set(x, y, z, y >= 11 + h ? pal[2] : (vxRand(x, y, z, 38) < 0.25 ? pal[1] : pal[0]), 0, 'spike');
    }
  },
  /** lange Wellen */
  wavy(head, o) {
    const pal = [o.c, vxShade(o.c, -0.2), vxShade(o.c, 0.2)];
    vxHairShell(head, pal, {
      side: { ok: (z, y) => y >= (z > 3 ? 5 : -6), thick: 2 }, back: { ok: (x, y) => y >= -9, thick: 2 },
      front: { ok: (x, y) => y >= 8 + (x < -1 ? 0 : 1) - (Math.abs(x + 0.5) > 4.5 ? 3 : 0) }, seed: 39,
    });
    for (let y = -9; y <= 6; y++) {                // Wellen hinten
      if (Math.sin(y * 0.9) < 0.25) continue;
      for (let x = -7; x <= 6; x++) head.setIfEmpty(x, y, -9, pal[(y & 1) ? 0 : 1], 0, 'hair');
    }
  },
  /** geflochtener Zopf hinten */
  braid(head, o) {
    const pal = [o.c, vxShade(o.c, -0.25), vxShade(o.c, 0.16)];
    vxHairShell(head, pal, { top: 1, side: { ok: (z, y) => y >= 6 }, back: { ok: (x, y) => y >= 4, thick: 1 }, front: { ok: (x, y) => y >= (x < 0 ? 9 : 8) }, seed: 41 });
    for (let i = 0; i < 9; i++) vxBall(head, (i & 1) ? 0.6 : -0.6, 8 - i * 1.9, -8.5, 1.55, pal[i & 1], { tag: 'hair' });
    vxBall(head, 0, 8 - 9 * 1.9, -8.5, 1.1, o.c2 ?? 0xf472b6, { tag: 'hair' });
  },
  /** Lang, mit Strähnen vorne über den Schultern */
  long(head, o) {
    const pal = [o.c, vxShade(o.c, -0.2), vxShade(o.c, 0.2)];
    vxHairShell(head, pal, {
      side: { ok: (z, y) => y >= (z > 3 ? 5 : -5), thick: 2 },
      back: { ok: (x, y) => y >= -8, thick: 2 },
      front: { ok: (x, y) => y >= 8 + (Math.abs(x + 0.5) > 4.5 ? -3 : (x & 1)) },
      seed: 13,
    });
    const avoid = vxInHead;
    for (const [p, d, len, r] of [[[-3, 13, 1], [-0.4, 1, 0.4], 3, 2], [[2, 13, 0], [0.4, 1, 0.2], 3, 2], [[-1, 13, -4], [0, 1, -0.5], 3, 2]]) vxSpike(head, p, d, len, r, pal, 15, avoid);
    // Strähnen vorne über den Schultern
    for (const x of [-8, -7, 6, 7]) for (let y = -6; y <= 6; y++) for (const z of [3, 4]) head.set(x, y, z, vxRand(x, Math.floor(y / 3), z, 17) < 0.25 ? pal[1] : pal[0]);
  },
};

/* ---------------- Oberteile ---------------- */
const VX_LOGOS = {
  smile: ['.XXXX.', 'X.XX.X', 'XXXXXX', 'X.XX.X', '.X..X.'],
  heart: ['XX.XX', 'XXXXX', '.XXX.', '..X..'],
  bolt: ['..XX', '.XX.', 'XXXX', '.XX.', 'XX..'],
};
/**
 * Jacke über einem Shirt. o: { c, trim, under, logo, logoC, open (Breite der Öffnung), hood, collar, strings,
 *   strap, buckle, pockets, patch, stripes, checker, patches: [Farben], cuff, hem }
 */
function vxJacket(P, o) {
  const T = P.torso, base = o.c, trim = o.trim ?? vxShade(base, 0.3), dark = vxShade(base, -0.32);
  const open = o.open ?? 2, ox0 = -open / 2, ox1 = open / 2 - 1;
  // Shirt darunter
  T.paint((v) => (v.y >= 2 ? o.under : null));
  if (o.logo) vxSprite(T, VX_LOGOS[o.logo], { X: o.logoC }, -Math.floor(VX_LOGOS[o.logo][0].length / 2), 8, 2);
  const patch = (x, y, z) => {
    if (o.patches) { const r = vxRand(Math.floor((x + 21) / 4), Math.floor((y + 21) / 4), Math.floor((z + 21) / 4), 41); if (r < 0.1) return o.patches[Math.floor(r * 100) % o.patches.length]; }
    return null;
  };
  // Körper-Schale
  vxShell(T, -5, 0, -3, 4, 10, 2, (x, y, z) => {
    const front = z === 3, side = x === -6 || x === 5;
    if (front && x >= ox0 && x <= ox1) return null;                                // offen
    if (front && (x === ox0 - 1 || x === ox1 + 1)) return o.zip ? ((y & 1) ? o.zip : vxShade(o.zip, -0.3)) : trim; // Reissverschluss
    if (y === 0) return o.hem ?? dark;                                               // Saum
    if (y === 1 && o.hemTrim) return o.hemTrim;
    if (o.sidePanel && side && y <= 7) return o.sidePanel;                           // Seitenteile
    if (o.checker && side && y >= 3 && y <= 7) return ((y + z) & 1) ? o.checker : dark;
    return patch(x, y, z) ?? base;
  }, { top: true });
  // Kapuze hinten, Kragen vorne
  if (o.hood) {
    T.box(-4, 4, -5, 3, 10, -5, (x, y) => (y === 10 || x === -4 || x === 3 ? vxShade(o.hood, -0.12) : o.hood));
    T.box(-3, 5, -6, 2, 9, -6, (x, y) => (y === 9 ? vxShade(o.hood, -0.12) : o.hood));
  }
  if (o.collar) {
    for (const [a, b] of [[-5, ox0 - 1], [ox1 + 1, 4]]) T.box(a, 9, 4, b, 10, 4, (x, y) => (y === 9 ? vxShade(o.collar, -0.1) : o.collar));
    T.box(-5, 10, 3, 4, 11, 3, (x) => (x >= ox0 && x <= ox1 ? null : o.collar));
  }
  if (o.strings) for (const x of [ox0, ox1]) T.box(x, 5, 4, x, 9, 4, (xx, y) => (y === 5 ? vxShade(o.strings, -0.2) : o.strings));
  // Taschen mit Klappe und Knopf
  if (o.pockets !== false) {
    for (const [a, b] of [[-5, ox0 - 2], [ox1 + 2, 4]]) {
      if (b - a < 1) continue;
      T.box(a, 2, 4, b, 3, 4, vxShade(base, -0.12));
      T.box(a, 4, 4, b, 4, 4, dark);
      T.set(Math.round((a + b) / 2), 4, 5, trim, 1);
    }
  }
  if (o.patch) { T.box(ox1 + 2, 7, 4, ox1 + 3, 8, 4, o.patch); T.set(ox1 + 3, 7, 4, dark); }
  // Umhängegurt mit Schnalle
  if (o.strap) {
    vxLine(T, [4, 10, 5], [-5, 1, 5], o.strap);
    T.box(-1, 5, 6, 0, 6, 6, o.buckle ?? trim, 3);
  }
  // Ärmel
  for (const [arm, out] of [[P.armR, 1], [P.armL, -1]]) {
    vxShell(arm, -2, -7, -3, 1, 0, 2, (x, y, z) => {
      if (y === -7) return o.cuff ?? dark;
      if (o.stripes && (y === -4 || y === -3)) return y === -4 ? o.stripes : dark;
      if (o.checker && y >= -6 && y <= -2 && (x * out) > 1) return ((y + z) & 1) ? o.checker : dark;
      return patch(x * 3, y, z) ?? base;
    }, { top: true });
    if (o.armPatch) { const xo = out > 0 ? 3 : -4; arm.box(xo, -3, -1, xo, -1, 0, o.armPatch); }
  }
}
/** ganzen Arm (ohne Hände) einfärben */
const vxSleeve = (arm, c, from = -8) => arm.paint((v) => (v.y >= from ? (typeof c === 'function' ? c(v) : c) : null));
/** Beine bis über die Schuhe einfärben */
const vxPants = (leg, c, from = -8) => leg.paint((v) => (v.y >= from && v.tag !== 'shoes' ? (typeof c === 'function' ? c(v) : c) : null));
const VX_TOPS = {
  /** Strickpulli mit Zickzack-Band */
  sweater(P, o) {
    vxTagAll(P, 'knit');
    P.torso.paint((v) => (v.y >= 1 ? o.c : null));
    for (const arm of [P.armR, P.armL]) { vxSleeve(arm, o.c); vxRing(arm, -2, -3, 1, 2, -8, 1, () => vxShade(o.c, -0.18)); }
    vxRing(P.torso, -5, -3, 4, 2, 1, 1, () => vxShade(o.c, -0.18));
    for (let x = -5; x <= 4; x++) for (const z of [2, -3]) { P.torso.recolor(x, 6 + ((x + 10) % 2), z, o.trim); P.torso.recolor(x, 4, z, (x & 1) ? o.trim : o.c); }
    P.torso.box(-2, 10, 3, 1, 10, 3, vxShade(o.c, -0.18));
  },
  /** Tanktop */
  tank(P, o) {
    P.torso.paint((v) => (v.y >= 2 ? o.c : null));
    for (const z of [2, -3]) for (let x = -2; x <= 1; x++) for (const y of [9, 10]) P.torso.recolor(x, y, z, P.skin);
    for (const x of [-5, 4]) for (let y = 8; y <= 10; y++) for (let z = -3; z <= 2; z++) P.torso.recolor(x, y, z, P.skin);
    for (const x of [-4, 3]) for (const z of [2, -3]) P.torso.recolor(x, 10, z, o.trim);
    vxSprite(P.torso, VX_LOGOS.bolt, { X: o.trim }, -2, 7, 3);
  },
  /** Fussball-Trikot mit Nummer */
  jersey(P, o) {
    P.torso.paint((v) => (v.y >= 2 ? o.c : null));
    for (const arm of [P.armR, P.armL]) { arm.paint((v) => (v.y >= -3 ? o.c : null)); vxRing(arm, -2, -3, 1, 2, -3, 1, () => o.trim); }
    for (const x of [-5, 4]) for (let y = 2; y <= 10; y++) for (let z = -3; z <= 2; z++) P.torso.recolor(x, y, z, o.trim);
    P.torso.box(-1, 10, 3, 0, 10, 3, o.trim); P.torso.set(-2, 9, 3, o.trim).set(1, 9, 3, o.trim);
    vxNumber(P.torso, o.num ?? 10, -4, 9, -4, 0xffffff, true);
    vxNumber(P.torso, o.num ?? 10, 1, 7, 3, 0xffffff);
  },
  /** Daunenjacke mit Steppnähten */
  puffer(P, o) {
    P.torso.paint((v) => (v.y >= 0 ? o.c : null));
    for (let y = 0; y <= 10; y++) {
      const seam = y % 3 === 0;
      vxRing(P.torso, -5, -3, 4, 2, y, 1, (x, yy, z) => (z === 3 && (x === -1 || x === 0) ? o.trim : seam ? vxShade(o.c, -0.2) : o.c));
      if (!seam) vxRing(P.torso, -5, -3, 4, 2, y, 2, (x, yy, z) => (z === 4 && (x === -1 || x === 0) ? null : vxShade(o.c, 0.06)));
    }
    vxRing(P.torso, -5, -3, 4, 2, 11, 1, () => vxShade(o.c, -0.1));
    for (const arm of [P.armR, P.armL]) {
      vxSleeve(arm, o.c);
      for (let y = -8; y <= 0; y++) vxRing(arm, -2, -3, 1, 2, y, 1, () => (y % 3 === 0 ? vxShade(o.c, -0.2) : o.c));
      vxRing(arm, -2, -3, 1, 2, -8, 1, () => vxShade(o.c, -0.35));
    }
  },
  /** Jeansjacke mit Brusttaschen */
  denim(P, o) {
    const c = o.c;
    vxJacket(P, { c, trim: vxShade(c, 0.4), under: o.under, open: 4, collar: vxShade(c, -0.08), pockets: false, cuff: vxShade(c, -0.15), hem: vxShade(c, -0.15) });
    for (const x0 of [-5, 3]) { P.torso.box(x0, 6, 4, x0 + 1, 7, 4, vxShade(c, -0.06)); P.torso.box(x0, 8, 4, x0 + 1, 8, 4, vxShade(c, -0.18)); P.torso.set(x0, 8, 5, 0xc9a227, 3); }
  },
  /** T-Shirt mit Aufdruck (gratis) */
  tshirt(P, o) {
    P.torso.paint((v) => (v.y >= 2 ? o.c : null));
    for (const arm of [P.armR, P.armL]) arm.paint((v) => (v.y >= -3 ? o.c : null));
    for (const arm of [P.armR, P.armL]) vxRing(arm, -2, -3, 1, 2, -3, 1, () => vxShade(o.c, -0.15));
    P.torso.box(-2, 10, 3, 1, 10, 3, vxShade(o.c, -0.15)); // Kragen
    vxSprite(P.torso, VX_LOGOS[o.logo || 'smile'], { X: o.logoC ?? 0xffffff }, -3, 8, 3);
  },
  /** sportliche Jacke mit Streifen, Kapuze und Umhängegurt */
  sport(P, o) {
    vxJacket(P, { c: o.c, trim: o.trim, under: o.under ?? 0xf4f4f6, open: 2, hood: o.under ?? 0xf4f4f6, collar: o.under ?? 0xf4f4f6, strap: 0x1f2430, buckle: o.trim,
      zip: o.trim, sidePanel: o.trim, stripes: o.trim, cuff: 0x1f2430, hem: 0x1f2430, hemTrim: o.trim, patch: o.trim, armPatch: o.trim });
  },
  /** offener Hoodie mit Karo-Flicken über einem Shirt mit Logo */
  hoodie(P, o) {
    vxJacket(P, { c: o.c, trim: o.trim, under: o.under, logo: 'smile', logoC: 0xffffff, open: 4, hood: o.c, strings: o.trim, checker: o.trim,
      cuff: vxShade(o.c, -0.3), pockets: true });
  },
  /** helle Jacke mit bunten Flicken */
  pastel(P, o) {
    vxJacket(P, { c: o.c, trim: o.trim, under: o.under, logo: 'heart', logoC: o.trim, open: 4, hood: o.c, collar: o.c, patches: o.patches,
      cuff: o.trim, hem: o.trim, pockets: true });
  },
  /* ---- Outfits (ersetzen Hose bzw. Rock) ---- */
  /** Kleid mit Gürtel und Masche */
  dress(P, o) {
    P.hideBottom = true;
    P.torso.paint((v) => (v.y >= 0 ? o.c : null));
    for (let y = -6; y <= 1; y++) {
      const out = y <= -4 ? 3 : y <= -2 ? 2 : 1;
      for (let d = 1; d <= out; d++) vxRing(P.torso, -5, -3, 4, 2, y, d, (x, yy, z) => (d === out && ((x + z) & 1) ? vxShade(o.c, -0.08) : o.c));
    }
    vxRing(P.torso, -5, -3, 4, 2, 2, 1, () => o.trim);
    P.torso.box(-2, 2, 4, 1, 3, 4, o.trim); P.torso.box(-1, 2, 5, 0, 3, 5, vxShade(o.trim, -0.2));
    for (const arm of [P.armR, P.armL]) { arm.paint((v) => (v.y >= -2 ? o.c : null)); vxRing(arm, -2, -3, 1, 2, -2, 1, () => o.trim); vxRing(arm, -2, -3, 1, 2, 0, 1, () => o.c); }
    P.torso.box(-2, 10, 3, 1, 10, 3, 0xffffff);
  },
  /** Raumanzug mit Schaltpult und Lebenserhaltung */
  space(P, o) {
    P.hideBottom = true;
    const w = o.c ?? 0xf1f3f7, acc = o.trim ?? 0xf97316, gray = 0x9aa3b2;
    P.torso.paint(() => w);
    for (let y = 0; y <= 10; y++) vxRing(P.torso, -5, -3, 4, 2, y, 1, () => (y === 1 ? gray : w));
    P.torso.box(-2, 4, 4, 1, 8, 4, 0x334155);
    [[-2, 7, 0xef4444], [-1, 7, 0xfacc15], [0, 7, 0x22c55e], [1, 7, 0x38bdf8], [-1, 5, 0x22d3ee], [0, 5, 0x22d3ee]].forEach(([x, y, c]) => P.torso.set(x, y, 5, c, 2));
    P.torso.box(-4, 2, -7, 3, 9, -5, (x, y) => (y === 9 ? gray : w)); P.torso.box(-3, 4, -8, 2, 7, -8, gray);
    for (const arm of [P.armR, P.armL]) { vxSleeve(arm, w); for (let y = -8; y <= 0; y++) vxRing(arm, -2, -3, 1, 2, y, 1, () => (y === -4 ? acc : y === -8 ? gray : w)); arm.paint((v) => (v.y <= -9 ? gray : null)); }
    for (const leg of [P.legR, P.legL]) { vxPants(leg, w, -12); const x0 = leg === P.legR ? 0 : -5; for (let y = -8; y <= -1; y++) vxRing(leg, x0, -3, x0 + 4, 2, y, 1, () => (y === -6 ? acc : w)); }
    P.torso.box(-6, 5, -1, -6, 7, 0, 0xffffff, 0);
  },
  /** Superheld mit Emblem, Gürtel und Umhang */
  hero(P, o) {
    P.hideBottom = true;
    const c = o.c, t = o.trim;
    P.torso.paint(() => c);
    for (const arm of [P.armR, P.armL]) { vxSleeve(arm, c, -10); arm.paint((v) => (v.y <= -8 ? t : null)); }
    for (const leg of [P.legR, P.legL]) vxPants(leg, c, -12);
    vxRing(P.torso, -5, -3, 4, 2, 1, 1, () => t); P.torso.box(-1, 1, 4, 0, 1, 4, 0xfacc15, 3);
    P.torso.box(-3, 5, 3, 2, 9, 3, (x, y) => ((x === -3 || x === 2) && (y === 5 || y === 9) ? null : t));
    vxTimes(P.torso, -2, 8, 4, c);
    VX_BACK.cape(P.torso, { c: o.c2 ?? t, c2: vxShade(o.c2 ?? t, -0.2) });
  },
  /** Anzug mit Fliege */
  tux(P, o) {
    P.hideBottom = true;
    const c = o.c ?? 0x1f2430, shirt = 0xffffff;
    P.torso.paint((v) => (v.y >= 0 ? shirt : null));
    vxShell(P.torso, -5, 0, -3, 4, 10, 2, (x, y, z) => (z === 3 && x >= -2 + (y < 5 ? 1 : 0) && x <= 1 - (y < 5 ? 1 : 0) ? null : c), { top: true });
    for (const [x, y] of [[-3, 9], [-3, 8], [-3, 7], [2, 9], [2, 8], [2, 7]]) P.torso.set(x, y, 4, vxShade(c, 0.12));
    P.torso.box(-2, 10, 4, 1, 10, 4, o.trim ?? 0xdc2626); P.torso.box(-1, 10, 5, 0, 10, 5, vxShade(o.trim ?? 0xdc2626, -0.2));
    for (const y of [3, 5]) P.torso.set(0, y, 3, 0x111827);
    P.torso.box(2, 8, 4, 3, 8, 4, 0xffffff);
    for (const arm of [P.armR, P.armL]) { vxSleeve(arm, c); vxRing(arm, -2, -3, 1, 2, -8, 1, () => shirt); }
    for (const leg of [P.legR, P.legL]) { vxPants(leg, c); const xo = leg === P.legR ? 4 : -5; for (let y = -8; y <= -1; y++) leg.recolor(xo, y, 0, 0x111827).recolor(xo, y, -1, 0x111827); }
  },
  /** Zaubermantel mit Sternen */
  robe(P, o) {
    P.hideBottom = true;
    const c = o.c, t = o.trim ?? 0xfacc15;
    const star = (x, y, z) => (vxRand(x, y, z, 61) < 0.07 ? t : c);
    P.torso.paint((v) => (v.y >= 0 ? star(v.x, v.y, v.z) : null));
    for (let y = -11; y <= 10; y++) { const out = y <= -6 ? 3 : y <= -1 ? 2 : 1; for (let d = 1; d <= out; d++) vxRing(P.torso, -5, -3, 4, 2, y, d, star); }
    vxRing(P.torso, -5, -3, 4, 2, 2, 2, () => vxShade(t, -0.1));
    for (const arm of [P.armR, P.armL]) { vxSleeve(arm, star); for (let y = -8; y <= 0; y++) vxRing(arm, -2, -3, 1, 2, y, y <= -6 ? 2 : 1, star); }
  },
  /** Latzhose über einem T-Shirt */
  overalls(P, o) {
    P.hideBottom = true;
    const c = o.c, under = o.under ?? 0xf4f4f6;
    P.torso.paint((v) => (v.y >= 2 ? under : c));
    for (const arm of [P.armR, P.armL]) arm.paint((v) => (v.y >= -3 ? under : null));
    P.torso.box(-3, 1, 3, 2, 8, 3, (x, y) => (x === -3 || x === 2 ? vxShade(c, 0.2) : c));
    P.torso.box(-2, 4, 4, 1, 6, 4, vxShade(c, -0.1));
    for (const x of [-4, 3]) { P.torso.box(x, 8, 3, x, 10, 3, c); P.torso.box(x, 8, -4, x, 10, -4, c); P.torso.set(x === -4 ? -3 : 2, 8, 4, 0xc9a227, 3); }
    for (const leg of [P.legR, P.legL]) { vxPants(leg, c); const x0 = leg === P.legR ? 0 : -5; vxRing(leg, x0, -3, x0 + 4, 2, -8, 1, () => vxShade(c, 0.15)); }
  },
};

/* ---------------- Hosen und Röcke ---------------- */
const VX_BOTTOMS = {
  /** Jeans mit Nähten und umgeschlagenem Saum */
  jeans(P, o) {
    const c = o.c;
    for (const [leg, x0] of [[P.legR, 0], [P.legL, -5]]) {
      vxPants(leg, (v) => (v.z === 2 && (v.x === x0 || v.x === x0 + 4) ? vxShade(c, 0.18) : c));
      vxRing(leg, x0, -3, x0 + 4, 2, -8, 1, () => vxShade(c, 0.3));
    }
    P.torso.paint((v) => (v.y <= 1 ? c : null));
    for (const x of [-4, -1, 2]) P.torso.set(x, 1, 3, vxShade(c, -0.2));
    P.torso.set(0, 1, 3, 0xc9a227, 3);
  },
  /** kurze Hose */
  shorts(P, o) {
    const c = o.c;
    for (const [leg, x0] of [[P.legR, 0], [P.legL, -5]]) { vxPants(leg, c, -5); vxRing(leg, x0, -3, x0 + 4, 2, -5, 1, () => o.trim ?? vxShade(c, -0.2)); }
    P.torso.paint((v) => (v.y <= 1 ? c : null));
    P.torso.set(-1, 1, 3, 0xffffff).set(0, 0, 3, 0xffffff);
  },
  /** Jogginghose mit Seitenstreifen */
  joggers(P, o) {
    const c = o.c, t = o.trim ?? 0xffffff;
    for (const [leg, x0, xo] of [[P.legR, 0, 4], [P.legL, -5, -5]]) {
      vxPants(leg, (v) => (v.x === xo && (v.z === 0 || v.z === -1) ? t : c));
      vxRing(leg, x0, -3, x0 + 4, 2, -8, 1, () => vxShade(c, -0.25));
    }
    P.torso.paint((v) => (v.y <= 1 ? (v.y === 1 ? vxShade(c, -0.2) : c) : null));
    P.torso.box(-1, 0, 3, -1, 1, 3, t); P.torso.box(0, -1, 3, 0, 1, 3, t);
  },
  /** Leggings mit Sternchen */
  leggings(P, o) {
    const c = o.c, t = o.trim ?? 0xffffff;
    for (const leg of [P.legR, P.legL]) vxPants(leg, (v) => (vxRand(v.x, v.y, v.z, 71) < 0.08 ? t : c), -9);
    P.torso.paint((v) => (v.y <= 1 ? c : null));
  },
  /** Tüllrock */
  tutu(P, o) {
    const c = o.c;
    P.torso.paint((v) => (v.y <= 1 ? c : null));
    for (let y = -2; y <= 1; y++) for (let d = 1; d <= (y <= -1 ? 3 : 2); d++) vxRing(P.torso, -5, -3, 4, 2, y, d, (x, yy, z) => (((x + z + yy) & 1) ? vxShade(c, 0.15) : c));
    vxRing(P.torso, -5, -3, 4, 2, 1, 1, () => o.trim ?? 0xffffff);
  },
  /** Cargohose: Knieschoner, Seitentaschen, Gürtel mit Schnalle, Bündchen */
  cargo(P, o) {
    const c = o.c, dark = vxShade(c, -0.25), trim = o.trim;
    for (const [leg, side] of [[P.legR, 1], [P.legL, -1]]) {
      const x0 = side > 0 ? 0 : -5, x1 = x0 + 4;
      leg.paint((v) => (v.y >= -8 ? (v.x === x0 + 2 && v.z === 2 && v.y > -6 ? vxShade(c, 0.08) : c) : null));
      leg.box(x0 + 1, -6, 3, x1 - 1, -5, 3, (x, y) => (y === -5 ? dark : trim ?? dark));         // Knieschoner
      const xo = side > 0 ? 5 : -6;
      leg.box(xo, -5, -2, xo, -3, 1, vxShade(c, -0.12)); leg.box(xo, -2, -2, xo, -2, 1, dark); // Seitentasche + Klappe
      if (trim) leg.set(xo, -2, 0, trim, 1);
      vxRing(leg, x0, -3, x1, 2, -8, 1, () => dark);                                            // Bündchen
    }
    P.torso.paint((v) => (v.y <= 1 ? (v.y === 1 ? 0x1f2430 : c) : null));                      // Gürtel
    P.torso.box(-1, 1, 3, 0, 1, 3, trim ?? 0xc9ced8, 3);
    if (trim) P.legR.box(4, -3, 3, 4, -1, 3, trim);                                            // Band an der Hüfte
    if (o.chain) { vxLine(P.torso, [-4, 1, 3], [-6, -2, 1], (i) => (i & 1 ? 0xd7dbe3 : 0x9ca3af), 3); vxLine(P.torso, [-6, -2, 1], [-6, 0, -2], (i) => (i & 1 ? 0xd7dbe3 : 0x9ca3af), 3); }
  },
  /** Faltenrock mit Karomuster und Stulpen */
  skirt(P, o) {
    const c = o.c, line = o.trim ?? 0xffffff, dark = vxShade(c, -0.18);
    const plaid = (x, y, z) => { const lx = ((x + z + 40) % 4 === 0), ly = ((y + 40) % 3 === 0); return lx && ly ? dark : lx || ly ? line : ((x + z) & 1 ? c : vxShade(c, -0.06)); };
    P.torso.tag = 'skirt';
    P.torso.paint((v) => (v.y <= 1 ? plaid(v.x, v.y, v.z) : null));
    for (let y = -5; y <= 1; y++) {
      const out = y <= -3 ? 2 : y <= -1 ? 1 : 0;
      for (let d = 1; d <= out + (y <= 1 ? 1 : 0); d++) vxRing(P.torso, -5, -3, 4, 2, y, d, (x, yy, z) => plaid(x, yy, z));
    }
    for (const [leg, side] of [[P.legR, 1], [P.legL, -1]]) {
      const x0 = side > 0 ? 0 : -5, x1 = x0 + 4;
      if (o.warmers) for (let y = -8; y <= -5; y++) vxRing(leg, x0, -3, x1, 2, y, 1, (x, yy, z) => ((yy & 1) ? o.warmers[0] : o.warmers[1]));
    }
  },
};

/* ---------------- Schuhe ---------------- */
/** gemeinsamer Schuh-Grundkörper: Sohle, Kappe, Schaft bis b + h */
function vxShoeBase(P, o, h, { sole = 0xf4f4f6, x1o = 0, front = 5, extra } = {}) {
  const b = -VOX.LEG;
  for (const [leg, x0, x1] of [[P.legR, 0, 5], [P.legL, -6, -1]]) {
    leg.filter((v) => v.y > b + h);
    leg.box(x0, b, -4, x1, b, front, sole, 1);
    leg.box(x0, b + 1, -4, x1, b + h, front, (x, y, z) => (y > b + 2 && z > 3 ? null : o.c), 1);
    extra?.(leg, x0, x1, b);
  }
}
const VX_SHOES = {
  /** niedrige Turnschuhe mit Socken */
  lowtops(P, o) {
    vxShoeBase(P, o, 2, { extra: (leg, x0, x1, b) => {
      leg.box(x0, b + 1, -4, x1, b + 1, 5, (x, y, z) => (z >= 4 ? 0xf4f4f6 : x === x0 || x === x1 ? o.c2 : o.c), 1);
      leg.box(x0 + 1, b + 2, 3, x1 - 1, b + 2, 3, (x) => ((x - x0) & 1 ? 0xffffff : vxShade(o.c, -0.2)), 1);
      vxRing(leg, x0 + (x0 ? 1 : 0), -3, x1 - (x0 ? 0 : 1), 2, b + 3, 0, () => 0xffffff);
    } });
  },
  /** Stiefel mit Umschlag */
  boots(P, o) {
    vxShoeBase(P, o, 6, { sole: 0x3b2a1a, front: 4, extra: (leg, x0, x1, b) => {
      vxRing(leg, x0, -3, x1, 3, b + 6, 1, () => vxShade(o.c, 0.2));
      for (let y = b + 2; y <= b + 5; y++) leg.recolor(Math.round((x0 + x1) / 2), y, 3, (y & 1) ? o.c2 : vxShade(o.c, -0.25), 1);
    } });
  },
  /** Rollschuhe */
  rollers(P, o) {
    P.lift = 2;
    vxShoeBase(P, o, 4, { front: 3, extra: (leg, x0, x1, b) => {
      leg.box(x0, b, -4, x1, b, 3, o.c2, 1);
      for (const z of [-3, 2]) vxBall(leg, (x0 + x1) / 2, b - 2, z, 1.2, 0xf472b6, { mat: 1 });
      leg.box(x0 + 1, b + 2, 3, x1 - 1, b + 3, 3, 0xffffff, 1);
    } });
  },
  /** Raketenschuhe mit Düsen */
  rocket(P, o) {
    vxShoeBase(P, o, 4, { extra: (leg, x0, x1, b) => {
      const xm = Math.round((x0 + x1) / 2);
      leg.box(xm - 1, b + 1, -6, xm, b + 2, -5, 0x9ca3af, 3);
      leg.box(xm - 1, b + 1, -7, xm, b + 2, -7, 0xffb13d, 2);
      leg.box(x0, b + 3, -4, x1, b + 3, 5, o.c2, 1);
    } });
  },
  /** Hasen-Pantoffeln */
  slippers(P, o) {
    vxShoeBase(P, o, 3, { sole: vxShade(o.c, -0.1), extra: (leg, x0, x1, b) => {
      const xm = Math.round((x0 + x1) / 2);
      for (const x of [xm - 2, xm + 1]) leg.box(x, b + 4, 2, x, b + 7, 3, (xx, y) => (y > b + 4 ? o.c : o.c), 0);
      for (const x of [xm - 2, xm + 1]) leg.box(x, b + 5, 4, x, b + 6, 4, 0xf9a8d4);
      leg.set(xm - 1, b + 3, 6, 0x1f2430).set(xm + 1, b + 3, 6, 0x1f2430).set(xm, b + 2, 6, 0xf472b6);
    } });
  },
  /** Sandalen */
  sandals(P, o) {
    const b = -VOX.LEG;
    for (const [leg, x0, x1] of [[P.legR, 0, 5], [P.legL, -6, -1]]) {
      leg.filter((v) => v.y > b);
      leg.box(x0, b, -4, x1, b, 5, 0x8b5a2b, 1);
      leg.box(x0 + (x0 ? 1 : 0), b + 1, -3, x1 - (x0 ? 0 : 1), b + 1, 4, P.skin);
      leg.box(x0, b + 1, 1, x1, b + 1, 1, o.c, 1); leg.box(x0, b + 2, -3, x1, b + 2, -3, o.c, 1);
    }
  },
  /** hohe Turnschuhe mit dicker Sohle, Schnürung, Zunge und Fersenlasche */
  sneakers(P, o) {
    const c = o.c, c2 = o.c2, white = 0xf4f4f6, b = -VOX.LEG;
    for (const [leg, x0, x1] of [[P.legR, 0, 5], [P.legL, -6, -1]]) {
      leg.filter((v) => v.y > b + 4);
      leg.box(x0, b, -4, x1, b, 5, white, 1);                                                    // Sohle
      leg.box(x0, b + 1, -4, x1, b + 1, 5, (x, y, z) => (z >= 4 ? white : x === x0 || x === x1 || z === -4 ? c2 : c), 1);
      leg.box(x0, b + 2, -3, x1, b + 2, 4, (x, y, z) => (z === 4 ? white : c), 1);
      const xm = Math.round((x0 + x1) / 2);
      leg.box(x0, b + 3, -3, x1, b + 4, 3, (x, y, z) => {
        if (z === 3 && (x === xm - 1 || x === xm)) return (y & 1) ? white : vxShade(c, -0.25); // Schnürung
        return c;
      }, 1);
      leg.box(xm - 1, b + 5, 2, xm, b + 5, 3, c2, 1);                                            // Zunge
      leg.box(xm - 1, b + 3, -4, xm, b + 5, -4, c2, 1);                                          // Fersenlasche
      const xo = x0 === 0 ? x1 + 1 : x0 - 1;
      leg.set(xo, b + 2, -1, c2, 1).set(xo, b + 3, 0, c2, 1).set(xo, b + 2, 1, c2, 1);             // Seitenlogo
      if (o.paw) { leg.box(xm - 1, b + 2, 4, xm, b + 2, 4, o.paw, 1); leg.set(xm - 2, b + 2, 5, o.paw, 1).set(xm + 1, b + 2, 5, o.paw, 1); }
    }
  },
};

/* ---------------- Kopfbedeckungen ---------------- */
/** Mütze/Helm als Kuppel über Kopf und Haar */
function vxHatDome(head, colorFn, { band = null, low = 2 } = {}) {
  const H = VX_HEAD;
  head.filter((v) => v.y <= H.y1 - low || vxInHead(v.x, v.y, v.z));
  head.box(H.x0 - 1, H.y1 - low, H.z0 - 1, H.x1 + 1, H.y1 + 2, H.z1 + 1, (x, y, z) => {
    const ex = x === H.x0 - 1 || x === H.x1 + 1, ez = z === H.z0 - 1 || z === H.z1 + 1;
    if (y === H.y1 + 2 && (ex || ez)) return null;
    if (y <= H.y1 - 1 && !(ex || ez)) return null;
    return colorFn(x, y, z);
  });
  if (band) vxRing(head, H.x0 - 1, H.z0 - 1, H.x1 + 1, H.z1 + 1, H.y1 - low, 1, () => band);
}
/** Oberkante der Haare (für Hüte, die oben aufsitzen); Büschel darunter entfernen */
function vxHairTop(head, r = 99) {
  head.filter((v) => !(v.tag === 'spike' && Math.abs(v.x + 0.5) < r && Math.abs(v.z + 0.5) < r && v.y > VX_HEAD.y1));
  let top = VX_HEAD.y1;
  for (const v of head.m.values()) if ((v.tag === 'hair' || v.tag === 'skin') && Math.abs(v.x + 0.5) <= 3 && Math.abs(v.z + 0.5) <= 3 && v.y > top) top = v.y;
  return top + 1;
}
const VX_HATS = {
  /** Mütze mit Bommel */
  beanie(head, o) {
    head.tag = 'hat';
    vxHatDome(head, (x, y) => ((x & 1) ? o.c : vxShade(o.c, -0.08)), { band: vxShade(o.c, -0.15) });
    vxBall(head, -0.5, 15, -0.5, 2.3, (x, y, z) => (vxRand(x, y, z, 81) < 0.3 ? vxShade(o.c2 ?? 0xffffff, -0.1) : o.c2 ?? 0xffffff));
  },
  /** Fischerhut */
  bucket(head, o) {
    const H = VX_HEAD;
    vxHatDome(head, () => o.c);
    vxRing(head, H.x0 - 1, H.z0 - 1, H.x1 + 1, H.z1 + 1, H.y1 - 2, 2, () => vxShade(o.c, -0.1));
    vxRing(head, H.x0 - 1, H.z0 - 1, H.x1 + 1, H.z1 + 1, H.y1 - 3, 3, () => vxShade(o.c, -0.15));
    vxRing(head, H.x0 - 1, H.z0 - 1, H.x1 + 1, H.z1 + 1, H.y1 - 1, 1, () => o.c2 ?? vxShade(o.c, -0.3));
  },
  /** Velohelm mit Lüftungsschlitzen */
  helmet(head, o) {
    const H = VX_HEAD;
    vxHatDome(head, (x, y, z) => (y > H.y1 && (x + 40) % 3 === 0 ? 0x1f2430 : o.c), { band: o.c2 ?? 0x1f2430 });
    head.box(-4, H.y1 - 1, H.z1 + 2, 3, H.y1 - 1, H.z1 + 3, o.c2 ?? 0x1f2430, 1);
  },
  /** Wikingerhelm mit Hörnern */
  viking(head, o) {
    const H = VX_HEAD;
    vxHatDome(head, (x, y) => (y === H.y1 + 1 && (x & 1) ? 0x9ca3af : 0xb8c0cc), { band: 0xc9a227 });
    for (const s of [-1, 1]) vxSpike(head, [s < 0 ? -8 : 7, H.y1, 0], [s * 0.85, 0.9, 0.1], 7, 1.6, [0xf4ecd8, 0xe8dcc0], 83, null, 'acc');
  },
  /** Kopfhörer auf dem Kopf */
  headset(head, o) {
    head.tag = 'acc';
    const H = VX_HEAD, top = vxHairTop(head);
    for (let x = -8; x <= 7; x++) { const y = Math.round(top - 1 + 2.4 * Math.cos(((x + 0.5) / 8) * Math.PI / 2)); head.box(x, y, -1, x, y, 0, o.c2 ?? 0x1f2430); }
    for (const x0 of [-10, 8]) head.box(x0, 4, -3, x0 + 1, 8, 2, (x, y, z) => ((x === -10 || x === 9) && y >= 5 && y <= 7 && z >= -2 && z <= 1 ? vxShade(o.c, 0.3) : o.c), 1);
  },
  /** Krone */
  crown(head, o) {
    head.tag = 'acc';
    const y0 = vxHairTop(head);
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI * 2, x = Math.round(Math.cos(t) * 5 - 0.5), z = Math.round(Math.sin(t) * 5 - 0.5);
      const peak = a % 8 === 0 ? 3 : 0;
      for (let y = y0; y <= y0 + 2 + peak; y++) head.set(x, y, z, 0xfacc15, 3);
      if (a % 8 === 4) head.set(x, y0 + 1, z, [0xef4444, 0x3b82f6, 0x22c55e, 0xec4899, 0x8b5cf6][(a / 8) | 0], 1);
    }
  },
  /** Partyhut */
  party(head, o) {
    const y0 = vxHairTop(head);
    for (let k = 0; k < 9; k++) { const r = 4.2 * (1 - k / 9.5); for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if ((x + 0.5) ** 2 + (z + 0.5) ** 2 <= r * r) head.set(x, y0 + k, z, ((k >> 1) & 1) ? o.c : o.c2 ?? 0xffffff); }
    vxBall(head, -0.5, y0 + 10, -0.5, 1.5, o.c3 ?? 0xfacc15);
  },
  /** Zauberhut mit Sternen */
  wizard(head, o) {
    const y0 = vxHairTop(head) - 1;
    for (let x = -10; x <= 9; x++) for (let z = -10; z <= 9; z++) { const d = Math.hypot(x + 0.5, z + 0.5); if (d <= 9 && d >= 5) head.set(x, y0, z, vxShade(o.c, -0.12)); }
    for (let k = 0; k < 13; k++) {
      const r = 6.5 * (1 - k / 13.5), oz = -k * 0.22;
      for (let x = -7; x <= 6; x++) for (let z = -8; z <= 6; z++) if ((x + 0.5) ** 2 + (z + 0.5 - oz) ** 2 <= r * r) head.set(x, y0 + 1 + k, z, vxRand(x, k, z, 85) < 0.08 ? o.c2 ?? 0xfacc15 : o.c);
    }
    vxRing(head, -6, -6, 5, 5, y0 + 1, 0, () => o.c2 ?? 0xfacc15);
  },
  /** Blumenkranz */
  flower(head, o) {
    head.tag = 'acc';
    vxHairTop(head);
    const cols = [0xf472b6, 0xfacc15, 0xffffff, 0xa78bfa, 0xfb7185, 0x60a5fa];
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2, x = Math.cos(t) * 7.6 - 0.5, z = Math.sin(t) * 7.6 - 0.5;
      vxBall(head, x, VX_HEAD.y1, z, 1.3, cols[i % cols.length]);
      head.set(Math.round(x), VX_HEAD.y1 + 1, Math.round(z), 0xfde047);
      const t2 = t + Math.PI / 12; head.set(Math.round(Math.cos(t2) * 7.8 - 0.5), VX_HEAD.y1, Math.round(Math.sin(t2) * 7.8 - 0.5), 0x22c55e);
    }
  },
  /** Haarreif mit Hasenohren */
  bunny(head, o) {
    head.tag = 'acc';
    const top = vxHairTop(head);
    for (let x = -8; x <= 7; x++) { const y = Math.round(top - 1 + 2 * Math.cos(((x + 0.5) / 8) * Math.PI / 2)); head.set(x, y, 0, o.c2 ?? 0xf472b6); }
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
      const x0 = (s < 0 ? -4 : 2) + Math.round(s * k * 0.2);
      head.box(x0, top + k, 0, x0 + 1, top + k, 1, o.c);
      if (k > 0 && k < 8) head.set(x0 + (s < 0 ? 1 : 0), top + k, 2, 0xf9a8d4);
    }
  },
  /** Diadem */
  tiara(head, o) {
    head.tag = 'acc';
    vxHairTop(head);
    const H = VX_HEAD;
    for (let x = -5; x <= 4; x++) { const z = H.z1 + 1 - (Math.abs(x + 0.5) > 3 ? 1 : 0); head.set(x, H.y1 - 1, z, 0xe5e7eb, 3); if (Math.abs(x + 0.5) < 3) head.set(x, H.y1, z, 0xe5e7eb, 3); }
    head.set(-1, H.y1 + 1, H.z1 + 1, 0xe5e7eb, 3).set(0, H.y1 + 1, H.z1 + 1, 0xe5e7eb, 3);
    head.set(-1, H.y1, H.z1 + 2, o.c ?? 0xec4899, 1).set(0, H.y1, H.z1 + 2, o.c ?? 0xec4899, 1);
  },
  /** Cap verkehrt herum */
  capback(head, o) {
    VX_HATS.cap(head, o);
    const moved = [];
    for (const v of head.m.values()) if (v.tag === 'hat' && v.z > VX_HEAD.z1 + 1) moved.push(v);
    for (const v of moved) { head.del(v.x, v.y, v.z); head.set(v.x, v.y, -v.z - 1, v.c, v.mat, 'hat'); }
  },
  /** Cap mit Schild und Front-Logo */
  cap(head, o) {
    const H = VX_HEAD, c = o.c, c2 = o.c2, c3 = o.c3;
    head.filter((v) => v.y <= H.y1 - 2 || vxInHead(v.x, v.y, v.z));
    head.box(H.x0 - 1, H.y1 - 1, H.z0 - 1, H.x1 + 1, H.y1 + 2, H.z1 + 1, (x, y, z) => {
      const edge = x === H.x0 - 1 || x === H.x1 + 1 || z === H.z0 - 1 || z === H.z1 + 1;
      if (y === H.y1 + 2 && edge) return null;
      if (y === H.y1 - 1 && !edge) return null;
      if (z >= 3 && y >= H.y1 - 1) return (x === -1 || x === 0) && y === H.y1 + 1 && z === H.z1 + 1 ? c : c2;
      return ((x + 40) % 4 === 0 && y > H.y1) ? vxShade(c, -0.15) : c;                      // Nähte
    });
    head.box(-5, H.y1 - 1, H.z1 + 2, 4, H.y1 - 1, H.z1 + 5, (x, y, z) => (z === H.z1 + 5 ? vxShade(c3, -0.15) : c3), 1); // Schild
    head.box(-1, H.y1 + 3, -1, 0, H.y1 + 3, 0, c3, 1);                                       // Knopf
  },
  /** Mütze mit Katzenohren */
  catbeanie(head, o) {
    const H = VX_HEAD, c = o.c, pink = o.c2, spots = o.c3;
    head.filter((v) => v.y <= H.y1 - 2 || vxInHead(v.x, v.y, v.z));
    head.box(H.x0 - 1, H.y1 - 2, H.z0 - 1, H.x1 + 1, H.y1 + 2, H.z1 + 1, (x, y, z) => {
      const ex = x === H.x0 - 1 || x === H.x1 + 1, ez = z === H.z0 - 1 || z === H.z1 + 1;
      if (y === H.y1 + 2 && (ex || ez)) return null;
      if (y >= H.y1 + 1 && ex && ez) return null;
      if (y <= H.y1 - 1 && !(ex || ez)) return null;
      if (y === H.y1 - 2) return vxShade(c, -0.08);                                          // Umschlag
      const r = vxRand(Math.floor((x + 21) / 3), Math.floor((y + 21) / 3), Math.floor((z + 21) / 3), 51);
      return r < 0.1 ? spots : r < 0.18 ? pink : c;
    });
    vxRing(head, H.x0 - 1, H.z0 - 1, H.x1 + 1, H.z1 + 1, H.y1 - 2, 1, () => vxShade(c, -0.1));
    for (const cx of [-4, 3]) for (let k = 0; k < 3; k++) {
      const r = 2 - k;
      head.box(cx - r, H.y1 + 3 + k, -1, cx + r, H.y1 + 3 + k, 0, c);
      if (k < 2) head.box(cx - Math.max(0, r - 1), H.y1 + 3 + k, 1, cx + Math.max(0, r - 1), H.y1 + 3 + k, 1, pink);
    }
  },
};

/* ---------------- Hals, Rücken, Handgelenk, Tasche ---------------- */
const VX_NECK = {
  /** gestreifter Schal */
  scarf(T, o) {
    for (const y of [9, 10]) for (const d of [1, 2]) vxRing(T, -5, -3, 4, 2, y, d, (x) => (((x + 20) >> 1) & 1 ? o.c : o.c2 ?? 0xffffff));
    T.box(-4, 2, 4, -2, 8, 5, (x, y) => ((y >> 1) & 1 ? o.c : o.c2 ?? 0xffffff));
    for (const x of [-4, -2]) T.set(x, 1, 4, o.c);
  },
  /** Gold-Medaille am Band */
  medal(T, o) {
    vxLine(T, [-4, 10, 4], [-1, 5, 4], o.c); vxLine(T, [3, 10, 4], [0, 5, 4], o.c2 ?? 0xef4444);
    vxBall(T, -0.5, 3.5, 4.5, 1.7, 0xfacc15, { mat: 3 });
  },
  /** Fliege */
  bowtie(T, o) {
    T.box(-3, 9, 4, -2, 10, 4, o.c); T.box(1, 9, 4, 2, 10, 4, o.c); T.box(-1, 9, 4, 0, 10, 5, vxShade(o.c, -0.25));
    T.set(-4, 9, 4, o.c).set(-4, 10, 4, o.c).set(3, 9, 4, o.c).set(3, 10, 4, o.c);
  },
  /** Perlenkette */
  pearls(T, o) {
    for (let x = -4; x <= 3; x++) { const y = 10 - Math.round(2.2 * (1 - ((x + 0.5) / 4.2) ** 2)); T.set(x, y, 4, (x & 1) ? 0xffffff : o.c ?? 0xf9a8d4, 1); }
  },
  /** Goldkette */
  goldchain(T, o) {
    for (let x = -4; x <= 3; x++) { const y = 10 - Math.round(3 * (1 - ((x + 0.5) / 4.2) ** 2)); T.set(x, y, 4, (x & 1) ? 0xfacc15 : 0xeab308, 3); }
    vxBall(T, -0.5, 5.5, 4.5, 1.2, 0xfacc15, { mat: 3 });
  },
  /** Halstuch */
  bandana(T, o) {
    for (let k = 0; k <= 5; k++) for (let x = -4 + k; x <= 3 - k; x++) T.set(x, 10 - k, 4, vxRand(x, k, 4, 87) < 0.18 ? o.c2 ?? 0xffffff : o.c);
  },
  /** Kopfhörer um den Hals */
  headphones(T, o) {
    const c = o.c, d = 0x1f2430;
    T.box(-5, 10, -5, 4, 11, -4, d);
    for (const x0 of [-7, 4]) {
      T.box(x0, 7, 3, x0 + 2, 10, 4, (x, y, z) => (z === 4 && x === x0 + 1 && (y === 8 || y === 9) ? vxShade(c, 0.35) : c), 1);
      T.box(x0, 7, 2, x0 + 2, 10, 2, d);
      T.box(x0 + (x0 < 0 ? 0 : 2), 10, -4, x0 + (x0 < 0 ? 0 : 2), 11, 1, d);
    }
  },
};
const VX_BACK = {
  /** Umhang */
  cape(T, o) {
    for (let y = -10; y <= 10; y++) {
      const w = y < -2 ? 7 : 6;
      for (let x = -w; x <= w - 1; x++) { T.set(x, y, -5, o.c2 ?? vxShade(o.c, -0.2)); T.set(x, y, -6, ((x + 40) % 4 === 0) ? vxShade(o.c, -0.1) : o.c); }
    }
    T.box(-6, 10, -5, 5, 11, -4, o.c);
  },
  /** Engelsflügel */
  wings(T, o) {
    const c = o.c ?? 0xffffff, line = vxShade(c, -0.12);
    for (const s of [-1, 1]) for (let i = 0; i <= 10; i++) {
      const x = s > 0 ? 5 + i : -6 - i, yl = Math.round(3 + i * 0.35), yu = Math.round(13 - i * 0.25 + (i > 7 ? 1 : 0));
      for (let y = yl; y <= yu; y++) { T.set(x, y, -5, (y % 3 === 0) ? line : c); if (i < 5) T.set(x, y, -6, c); }
      if (i % 2 === 0) T.set(x, yl - 1, -5, line);
    }
  },
  /** Schmetterlingsflügel */
  butterfly(T, o) {
    const c = o.c ?? 0xf472b6, c2 = o.c2 ?? 0x8b5cf6;
    for (const s of [-1, 1]) for (const [cx, cy, rx, ry] of [[8.5, 10, 5, 4], [7, 3.5, 3.8, 3]]) {
      for (let x = -14; x <= 14; x++) for (let y = -2; y <= 16; y++) {
        const dx = (x + 0.5 - s * cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
        if (d > 1 || Math.sign(x + 0.5) !== s) continue;
        T.set(x, y, -5, d > 0.75 ? 0x1f2430 : d < 0.12 ? 0xffffff : vxMix(c, c2, Math.min(1, d)));
      }
    }
  },
  /** Drachenflügel */
  dragon(T, o) {
    const c = o.c ?? 0x22c55e, rib = vxShade(c, -0.35);
    for (const s of [-1, 1]) for (let i = 0; i <= 11; i++) {
      const x = s > 0 ? 5 + i : -6 - i, yu = 6 + Math.round(i * 0.75), yl = 4 + Math.round(i * 0.35) + (i % 4 === 3 ? 2 : 0);
      for (let y = yl; y <= yu; y++) T.set(x, y, -5, i % 4 === 0 ? rib : c);
      T.set(x, yu + 1, -5, rib);
    }
  },
  /** Jetpack mit Flammen */
  jetpack(T, o) {
    for (const x0 of [-4, 1]) {
      T.box(x0, 2, -7, x0 + 2, 9, -5, (x, y) => (y === 6 ? o.c ?? 0xef4444 : 0xb8c0cc), 3);
      T.box(x0, 0, -7, x0 + 2, 1, -5, 0x4b5563, 3);
      T.box(x0 + 1, -3, -6, x0 + 1, -1, -6, 0xffd166, 2); T.box(x0, -1, -7, x0 + 2, -1, -5, 0xff8a3d, 2);
    }
  },
  /** Gitarre auf dem Rücken */
  guitar(T, o) {
    vxBall(T, 2, 1, -6, 2.6, o.c ?? 0xb45309); vxBall(T, 0.5, 4.2, -6, 2, o.c ?? 0xb45309);
    T.set(1, 2, -9, 0x3b2a1a);
    vxLine(T, [0, 5, -6], [-5, 13, -6], 0x6b4423); vxLine(T, [-5, 13, -6], [-6, 14, -6], 0x1f2430);
    vxLine(T, [-4, 10, 4], [3, 1, 4], 0x1f2430);
  },
  /** Rucksack mit Fronttasche und Trägern */
  backpack(T, o) {
    const c = o.c, dark = vxShade(c, -0.25), trim = o.c2;
    T.box(-4, 1, -7, 3, 9, -5, (x, y) => (y === 9 ? dark : c));
    T.box(-3, 2, -8, 2, 5, -8, (x, y) => (y === 5 ? dark : vxShade(c, 0.06)));
    T.set(-1, 5, -9, trim, 1).set(0, 5, -9, trim, 1);
    for (const x of [-4, 3]) { T.box(x, 2, 4, x, 10, 4, dark); T.set(x, 4, 5, trim, 3); }
  },
};
const VX_WRIST = {
  /** Schweissband */
  band(P, o) { for (const y of [-8, -7]) vxRing(P.armR, -2, -3, 1, 2, y, 1, () => (y === -8 ? o.c : o.c2 ?? 0xffffff)); },
  /** Freundschaftsband */
  bracelet(P, o) { vxRing(P.armR, -2, -3, 1, 2, -8, 1, (x, y, z) => [0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xec4899][(x + z + 20) % 5], 1); },
  /** Smartwatch mit leuchtender Anzeige */
  smartwatch(P, o) {
    for (const y of [-8, -7]) vxRing(P.armL, -2, -3, 1, 2, y, 1, (x, yy, z) => (x === -3 && z >= -2 && z <= 1 ? o.c2 ?? 0x22d3ee : 0x1f2430), 1);
    for (const y of [-8, -7]) for (const z of [-2, 1]) P.armL.set(-3, y, z, 0x1f2430, 2);
  },
  /** Uhr am linken Handgelenk */
  watch(P, o) {
    vxRing(P.armL, -2, -3, 1, 2, -8, 1, (x, y, z) => (x === -3 && (z === -1 || z === 0) ? o.c2 ?? 0x5eead4 : o.c));
    for (const z of [-1, 0]) P.armL.set(-3, -8, z, o.c2 ?? 0x5eead4, 2);
  },
};
const VX_BAGS = {
  /** Bauchtasche */
  fanny(T, o) { vxRing(T, -5, -3, 4, 2, 1, 1, () => 0x1f2430); T.box(-3, 0, 4, 2, 2, 5, (x, y, z) => (y === 2 && z === 5 ? o.c2 ?? 0xfacc15 : o.c)); },
  /** Umhängetasche */
  messenger(T, o) { vxLine(T, [-4, 10, 4], [4, 1, 4], 0x3b2a1a); T.box(4, -3, 1, 7, 1, 4, (x, y) => (y >= 0 ? o.c2 ?? vxShade(o.c, -0.2) : o.c)); T.set(5, 0, 5, 0xc9a227, 3); },
  /** Umhängetasche mit Pfote */
  paw(T, o) {
    vxLine(T, [4, 10, 4], [-3, 2, 4], o.c2);
    T.box(-7, -3, 3, -3, 1, 4, (x, y) => (y === 1 ? vxShade(o.c, -0.12) : o.c));
    vxSprite(T, ['X.X', '.X.', 'XXX'], { X: o.c2 }, -6, 0, 5);
  },
};
/** Handgegenstände: eigene Voxel-Menge, Griff bei (0,0,0) */
const VX_HAND = {
  trophy: { rx: Math.PI / 2, build() {
    const s = new VoxSet(), g = 0xfacc15;
    s.box(-2, -1, -2, 1, 0, 1, 0x7c4a1c); s.box(-1, 1, -1, 0, 3, 0, g, 3);
    for (let y = 4; y <= 9; y++) { const r = y < 6 ? 1.6 : 2.6; for (let x = -3; x <= 2; x++) for (let z = -3; z <= 2; z++) { const d = Math.hypot(x + 0.5, z + 0.5); if (d <= r && (y < 9 || d > r - 1)) s.set(x, y, z, g, 3); } }
    for (const x of [-4, 3]) s.box(x, 6, -1, x, 8, 0, g, 3);
    return s;
  } },
  guitar: { rx: Math.PI / 2, rz: 0.3, build() {
    const s = new VoxSet();
    s.box(0, 0, 0, 0, 11, 0, 0x6b4423); s.box(-1, 12, 0, 1, 13, 0, 0x3b2a1a);
    vxBall(s, 0, -4, 0, 3.2, 0xdc2626, { sy: 1.1 }); vxBall(s, 0, 0, 0, 2.4, 0xdc2626);
    s.set(0, -2, 3, 0x1f2430).set(0, -3, 3, 0x1f2430);
    return s;
  } },
  balloon: { x: 3, iter: 6, build(o) {
    const s = new VoxSet();
    s.box(0, 0, 0, 0, 13, 0, 0xffffff); vxBall(s, 0, 18, 0, 3.6, o?.c ?? 0xef4444, { mat: 1, sy: 1.15 }); s.set(0, 14, 0, o?.c ?? 0xef4444);
    return s;
  } },
  icecream: { rx: Math.PI / 2, build() {
    const s = new VoxSet();
    for (let y = 0; y <= 6; y++) { const r = 0.4 + y * 0.32; for (let x = -3; x <= 2; x++) for (let z = -3; z <= 2; z++) if (Math.hypot(x + 0.5, z + 0.5) <= r) s.set(x, y, z, ((x + y + z) & 1) ? 0xd69a52 : 0xc0803c); }
    vxBall(s, -0.5, 8, -0.5, 2.6, 0xf9a8d4); vxBall(s, -0.5, 11, -0.5, 2.2, 0x6ee7b7); vxBall(s, -0.5, 13.5, -0.5, 0.9, 0xdc2626, { mat: 1 });
    return s;
  } },
  teddy: { z: 2.5, build() {
    const s = new VoxSet(), c = 0xb07a4a;
    vxBall(s, 0, 3, 0, 2.6, c); vxBall(s, 0, 7.5, 0, 2.4, c);
    for (const x of [-2, 2]) vxBall(s, x, 9.5, 0, 1.1, c);
    s.box(-1, 6, 2, 0, 7, 3, 0xe8c9a0); s.set(-1, 7, 4, 0x1f2430).set(-2, 8, 2, 0x1f2430).set(1, 8, 2, 0x1f2430);
    s.box(-1, 4, 2, 0, 4, 3, 0xef4444);
    return s;
  } },
  book: { z: 2, build() {
    const s = new VoxSet();
    s.box(-3, 0, -1, 3, 8, 1, (x, y, z) => (x === 3 && z === 0 ? 0xf8f4ea : 0x2563eb));
    vxTimes(s, -1, 6, 2, 0xfacc15);
    return s;
  } },
  basketball: { x: 3, build() {
    const s = new VoxSet();
    vxBall(s, 0, 3, 0, 3.4, (x, y, z) => (x === 0 || y === 3 || (Math.abs(Math.hypot(x, z) - 2.4) < 0.5) ? 0x1f2430 : 0xf97316));
    return s;
  } },
  gamepad: { rx: Math.PI / 2, build() {
    const s = new VoxSet();
    s.box(-4, 0, -1, 3, 1, 1, 0x374151); s.box(-5, -1, -1, -3, 0, 1, 0x374151); s.box(2, -1, -1, 4, 0, 1, 0x374151);
    s.set(-3, 1, 2, 0xe5e7eb).set(-2, 1, 2, 0xe5e7eb); s.set(1, 1, 2, 0xef4444, 2).set(2, 0, 2, 0x22c55e, 2);
    return s;
  } },
  flowers: { rx: Math.PI / 2, build() {
    const s = new VoxSet();
    for (const [x, z, h, c] of [[-1, 0, 8, 0xf472b6], [1, 0, 7, 0xfacc15], [0, 1, 9, 0xa78bfa], [0, -1, 6, 0xef4444]]) { vxLine(s, [0, 0, 0], [x * 2, h, z * 2], 0x16a34a); vxBall(s, x * 2, h + 1, z * 2, 1.3, c); }
    for (let y = 0; y <= 3; y++) for (let x = -2; x <= 1; x++) for (let z = -2; z <= 1; z++) if (Math.hypot(x + 0.5, z + 0.5) <= 1 + y * 0.35 && Math.hypot(x + 0.5, z + 0.5) > y * 0.35 - 0.2) s.set(x, y, z, 0xfef3c7);
    return s;
  } },
  umbrella: { x: 3, build(o) {
    const s = new VoxSet(), c = o?.c ?? 0x3b82f6;
    s.box(0, 0, 0, 0, 16, 0, 0x6b7280); s.box(-2, -1, 0, 0, -1, 0, 0x6b7280); s.set(-2, 0, 0, 0x6b7280);
    for (let x = -7; x <= 6; x++) for (let z = -7; z <= 6; z++) for (let y = 15; y <= 19; y++) {
      const d = Math.hypot(x + 0.5, z + 0.5), h = 19 - (d / 7) ** 2 * 4;
      if (d <= 7 && Math.abs(y - h) < 0.8) s.set(x, y, z, Math.floor(Math.atan2(z, x) / (Math.PI / 4) + 8) & 1 ? c : 0xffffff);
    }
    return s;
  } },
  magnifier: { rx: Math.PI / 2, build() {
    const s = new VoxSet();
    s.box(0, 0, 0, 0, 5, 0, 0x7c4a1c);
    for (let x = -4; x <= 3; x++) for (let y = 6; y <= 13; y++) { const d = Math.hypot(x + 0.5, y - 9.5); if (d <= 3.6) s.set(x, y, 0, d > 2.7 ? 0xfacc15 : 0xbae6fd, d > 2.7 ? 3 : 1); }
    return s;
  } },
  calculator: { z: 2, build() {
    const s = new VoxSet();
    s.box(-3, 0, 0, 3, 10, 1, 0x374151);
    s.box(-2, 8, 2, 2, 9, 2, 0x86efac, 2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s.set(-2 + c * 2, 1 + r * 2, 2, [0xf97316, 0xe5e7eb, 0x14b8a6][(r + c) % 3], 1);
    return s;
  } },
  pencil: { rx: Math.PI / 2, build() {
    const s = new VoxSet();
    s.box(-1, -3, -1, 0, -2, 0, 0xf9a8d4); s.box(-1, -1, -1, 0, -1, 0, 0xc0c4cc, 3);
    s.box(-1, 0, -1, 0, 14, 0, (x, y, z) => ((x + z) & 1 ? 0xfacc15 : 0xeab308));
    s.box(-1, 15, -1, 0, 16, 0, 0xf5deb3); s.set(-1, 17, -1, 0x1f2430);
    return s;
  } },
  flag: { x: 3, build() {
    const s = new VoxSet();
    s.box(0, 0, 0, 0, 15, 0, 0x9ca3af);
    s.box(1, 10, 0, 8, 15, 0, (x, y) => (x < 5 ? 0xff6b4a : 0x0f766e));
    vxTimes(s, 3, 11, 1, 0xffffff);
    return s;
  } },
  microphone: { rx: Math.PI / 2, build() {
    const s = new VoxSet();
    s.box(0, 0, 0, 0, 6, 0, 0x1f2430); vxBall(s, 0, 8, 0, 2, (x, y, z) => ((x + y + z) & 1 ? 0x9ca3af : 0xd1d5db), { mat: 3 });
    return s;
  } },
  camera: { z: 2, build() {
    const s = new VoxSet();
    s.box(-3, 0, -1, 3, 4, 1, 0x1f2430); s.box(-1, 1, 2, 1, 3, 3, 0x4b5563, 3); s.set(0, 2, 4, 0x93c5fd, 1); s.set(2, 4, 2, 0xfde047, 2);
    return s;
  } },
  glowstick: { rx: Math.PI / 2, build(o) {
    const s = new VoxSet(); s.box(0, 0, 0, 0, 11, 0, o?.c ?? 0x22d3ee, 2); s.box(0, -1, 0, 0, -1, 0, 0x1f2430); return s;
  } },
  lollipop: { x: 3, build() {
    const s = new VoxSet();
    s.box(0, 0, 0, 0, 7, 0, 0xffffff);
    for (let x = -4; x <= 3; x++) for (let y = 7; y <= 14; y++) { const d = Math.hypot(x + 0.5, y - 10.5); if (d <= 3.7) s.set(x, y, 0, ((Math.atan2(y - 10.5, x + 0.5) + d) * 1.6 | 0) & 1 ? 0xf472b6 : 0xffffff, 1); }
    return s;
  } },
  wand: { rx: Math.PI / 2, build() {
    const s = new VoxSet();
    s.box(0, -2, 0, 0, 9, 0, (x, y) => (y < 1 ? 0x3b2a1a : y === 8 ? 0xffd84d : 0x6b4423));
    const star = 0xffd84d;
    s.box(-2, 11, 0, 2, 11, 0, star, 2); s.box(0, 9, 0, 0, 13, 0, star, 2); s.box(-1, 10, 0, 1, 12, 0, star, 2);
    s.set(0, 11, 1, 0xfff6b0, 2).set(0, 11, -1, 0xfff6b0, 2);
    return s;
  } },
  skateboard: { ry: -Math.PI / 2, x: 2.5, build() {
    const s = new VoxSet();
    s.box(-3, -8, 0, 2, 8, 0, (x, y) => (Math.abs(y) > 6 && (x === -3 || x === 2) ? null : y > -2 && y < 2 ? 0x22d3ee : (y & 1) && Math.abs(y) < 6 ? 0xf9a8d4 : 0xf472b6), 1);
    for (const y of [-6, 5]) for (const x of [-3, 2]) s.box(x, y, -2, x, y + 1, -1, 0xf4f4f6, 1);
    for (const y of [-6, 5]) s.box(-2, y, -1, 1, y + 1, -1, 0x9ca3af, 3);
    return s;
  } },
};

/* ---------------- Brillen (fein, eigene Teile vor dem Gesicht) ---------------- */
// feine Kopf-Koordinaten: Augenmitten bei x ±6, y 12; Gesicht vorne z ≈ 11
function vxGlassFrame(set, shape, c, lens = null, z = 13) {
  for (const cx of [-6, 6]) for (let x = cx - 5; x <= cx + 4; x++) for (let y = 7; y <= 17; y++) {
    const k = shape(x + 0.5 - cx, y + 0.5 - 12);
    if (k === 1) set.set(x, y, z, c, 1); else if (k === 2 && lens != null) set.set(x, y, z, lens, 1);
  }
  set.box(-2, 12, z, 1, 13, z, c, 1);
  for (const s of [-1, 1]) vxLine(set, [s < 0 ? -11 : 10, 13, z], [s < 0 ? -13 : 12, 13, -1], c, 1);
}
const VX_GLASSES = {
  round: (o) => { const s = new VoxSet(); vxGlassFrame(s, (x, y) => { const d = Math.hypot(x, y); return d <= 3.4 && d > 2.5 ? 1 : 0; }, o.c ?? 0x1f2430); return s; },
  square: (o) => { const s = new VoxSet(); vxGlassFrame(s, (x, y) => (Math.abs(x) <= 3.6 && Math.abs(y) <= 2.8 ? (Math.abs(x) > 2.8 || Math.abs(y) > 2 ? 1 : 0) : 0), o.c ?? 0x1f2430); return s; },
  sun: (o) => { const s = new VoxSet(); vxGlassFrame(s, (x, y) => (Math.abs(x) <= 3.8 && Math.abs(y) <= 2.6 ? (Math.abs(x) > 3 || Math.abs(y) > 1.9 ? 1 : 2) : 0), o.c ?? 0x111827, 0x1f2937); return s; },
  star: (o) => {
    const s = new VoxSet();
    const inStar = (x, y, R) => { const a = Math.atan2(y, x), r = Math.hypot(x, y), k = Math.cos(Math.PI / 5) / Math.cos(((a + Math.PI / 2) % (2 * Math.PI / 5) + 2 * Math.PI / 5) % (2 * Math.PI / 5) - Math.PI / 5); return r <= R * (0.55 + 0.45 * k); };
    vxGlassFrame(s, (x, y) => (inStar(x, y, 4.2) ? (inStar(x, y, 3.2) ? 2 : 1) : 0), o.c ?? 0xfacc15, vxShade(o.c ?? 0xfacc15, 0.5));
    return s;
  },
  heart: (o) => {
    const s = new VoxSet();
    const inHeart = (x, y, R) => { const X = x / R, Y = y / R + 0.15; return (X * X + Y * Y - 0.6) ** 3 - X * X * Y * Y * Y < 0; };
    vxGlassFrame(s, (x, y) => (inHeart(x, y, 4.4) ? (inHeart(x, y, 3.5) ? 2 : 1) : 0), o.c ?? 0xec4899, 0xfbcfe8);
    return s;
  },
  goggles: (o) => {
    const s = new VoxSet(), c = o.c ?? 0xf97316;
    for (let a = 0; a < 120; a++) { const t = (a / 120) * Math.PI * 2, x = Math.round(Math.cos(t) * 13.4 - 0.5), z = Math.round(Math.sin(t) * 13.4 - 0.5); if (z < 9) for (const y of [12, 13]) s.set(x, y, z, c); }
    for (const cx of [-6, 6]) for (let x = cx - 5; x <= cx + 4; x++) for (let y = 8; y <= 16; y++) { const d = Math.hypot((x + 0.5 - cx) / 4.6, (y + 0.5 - 12) / 3.8); if (d <= 1) { s.set(x, y, 13, d > 0.78 ? 0x1f2430 : 0x67e8f9, 1); if (d > 0.78) s.set(x, y, 12, 0x1f2430, 1); } }
    s.box(-2, 11, 13, 1, 13, 13, 0x1f2430, 1);
    return s;
  },
  visor: (o) => {
    const s = new VoxSet();
    for (let x = -11; x <= 10; x++) for (let y = 10; y <= 14; y++) s.set(x, y, 13 - (Math.abs(x + 0.5) > 8 ? 1 : 0), y === 10 || y === 14 ? 0x1f2430 : o.c ?? 0x22d3ee, y === 10 || y === 14 ? 1 : 2);
    for (const s2 of [-1, 1]) vxLine(s, [s2 < 0 ? -12 : 11, 12, 11], [s2 < 0 ? -13 : 12, 12, -1], 0x1f2430, 1);
    return s;
  },
};

/* ---------------- Haustiere (stehen neben der Figur) ---------------- */
const VX_PETS = {
  cat(o) {
    const s = new VoxSet(), c = o.c ?? 0xf2a65a, d = vxShade(c, -0.2);
    s.box(-2, 1, -4, 2, 4, 3, c); for (const [x, z] of [[-2, -4], [1, -4], [-2, 2], [1, 2]]) s.box(x, 0, z, x + 1, 0, z + 1, c);
    s.box(-3, 4, 1, 3, 9, 6, c); for (const x of [-3, 2]) { s.box(x, 10, 3, x + 1, 11, 4, c); s.set(x + (x < 0 ? 1 : 0), 10, 5, 0xf9a8d4); }
    vxSpike(s, [0, 3, -5], [0, 1, -0.5], 6, 0.8, [d], 1, null, null);
    for (let y = 5; y <= 9; y += 2) s.box(-3, y, 1, 3, y, 6, d);
    return { s, eyes: [[-3, 15], [3, 15]], nose: [0, 12], front: 13 };
  },
  dog(o) {
    const s = new VoxSet(), c = o.c ?? 0xc89b6d, d = vxShade(c, -0.3);
    s.box(-2, 1, -4, 2, 4, 3, c); for (const [x, z] of [[-2, -4], [1, -4], [-2, 2], [1, 2]]) s.box(x, 0, z, x + 1, 0, z + 1, c);
    s.box(-3, 4, 1, 3, 9, 6, c); s.box(-2, 4, 7, 2, 6, 8, vxShade(c, 0.15)); s.box(-1, 6, 9, 0, 6, 9, 0x1f2430);
    for (const x of [-4, 4]) s.box(x, 4, 2, x, 9, 4, d);
    vxSpike(s, [0, 4, -5], [0, 1, -0.7], 5, 0.8, [c], 1, null, null);
    return { s, eyes: [[-3, 16], [3, 16]], front: 13 };
  },
  bunny(o) {
    const s = new VoxSet(), c = o.c ?? 0xf4f4f8;
    s.box(-2, 0, -4, 2, 4, 2, c); s.box(-3, 4, 0, 3, 9, 5, c);
    for (const x of [-2, 1]) { s.box(x, 10, 2, x + 1, 16, 3, c); s.box(x + (x < 0 ? 1 : 0), 11, 4, x + (x < 0 ? 1 : 0), 15, 4, 0xf9a8d4); }
    vxBall(s, 0, 3, -5, 1.6, c);
    return { s, eyes: [[-3, 15], [3, 15]], nose: [0, 12], front: 11 };
  },
  dragon(o) {
    const s = new VoxSet(), c = o.c ?? 0x22c55e, belly = 0xfde68a, d = vxShade(c, -0.3);
    s.box(-3, 1, -4, 2, 6, 3, c); s.box(-2, 2, 4, 1, 5, 4, belly); for (const [x, z] of [[-3, -4], [1, -4], [-3, 2], [1, 2]]) s.box(x, 0, z, x + 1, 0, z + 1, c);
    s.box(-3, 6, 1, 2, 11, 6, c); s.box(-2, 6, 7, 1, 8, 8, c);
    for (const x of [-3, 2]) vxSpike(s, [x, 12, 2], [x < 0 ? -0.3 : 0.3, 1, -0.4], 3, 0.6, [0xfacc15], 2, null, null);
    for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) s.box(sx < 0 ? -4 - i : 3 + i, 5 + Math.round(i * 0.5), -1, sx < 0 ? -4 - i : 3 + i, 7 + i, -1, i % 2 ? c : d);
    vxSpike(s, [0, 2, -5], [0, 0.3, -1], 7, 1, [c], 3, null, null);
    return { s, eyes: [[-3, 19], [3, 19]], front: 13 };
  },
  robot(o) {
    const s = new VoxSet(), c = o.c ?? 0xb8c0cc;
    s.box(-3, 2, -3, 2, 7, 2, c); for (const x of [-3, 2]) vxBall(s, x + 0.5, 1, 0, 1.4, 0x374151);
    s.box(-3, 8, -2, 2, 12, 3, c); s.box(-2, 9, 4, 1, 11, 4, 0x0f172a); s.box(0, 13, 0, 0, 14, 0, 0x6b7280); vxBall(s, 0, 15.5, 0, 1, 0xef4444, { mat: 2 });
    s.box(-1, 4, 3, 0, 5, 3, 0x22d3ee, 2);
    return { s, eyes: [[-2, 21], [2, 21]], eyeC: 0x67e8f9, glow: true, front: 9 };
  },
};
function vxPetGroup(T, o) {
  const P = VX_PETS[o.id]?.(o);
  if (!P) return null;
  const F = vxUpscale(P.s);
  for (const [x, y] of P.eyes) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) F.set(x + dx, y + dy, P.front, P.eyeC ?? 0x111827, P.glow ? 2 : 1);
  if (P.nose) F.set(P.nose[0], P.nose[1], P.front + 1, 0xf472b6, 1);
  const g = new T.Group(); const m = vxMesh(T, F, { iter: 8 }); g.add(m);
  g.scale.setScalar(0.8);
  return g;
}

/* ---------------- Effekte rund um die Figur ---------------- */
function vxFxTex(kind) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.translate(32, 32);
  if (kind === 'star') { g.fillStyle = '#fff6b0'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i & 1 ? 9 : 26, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); }
  if (kind === 'heart') { g.fillStyle = '#ff5c8a'; g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-34, -2, -16, -30, 0, -12); g.bezierCurveTo(16, -30, 34, -2, 0, 22); g.fill(); }
  if (kind === 'bubble') { g.strokeStyle = 'rgba(190,240,255,.95)'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(-9, -9, 6, 0, Math.PI * 2); g.fill(); }
  if (kind === 'note') { g.fillStyle = '#5b21b6'; g.beginPath(); g.ellipse(-8, 14, 11, 8, -0.4, 0, Math.PI * 2); g.fill(); g.fillRect(1, -24, 5, 38); g.fillRect(1, -24, 18, 7); }
  if (kind === 'glow') { const r = g.createRadialGradient(0, 0, 2, 0, 0, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-32, -32, 64, 64); }
  return cv;
}
function vxEffect(T, id, color = 0xffffff) {
  const kinds = { sparkles: 'star', hearts: 'heart', bubbles: 'bubble', notes: 'note', aura: 'glow' };
  if (!kinds[id]) return null;
  const tex = new T.CanvasTexture(vxFxTex(kinds[id])); tex.colorSpace = T.SRGBColorSpace;
  const g = new T.Group();
  const n = id === 'aura' ? 16 : 18;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: id === 'aura' ? color : 0xffffff, blending: id === 'aura' || id === 'sparkles' ? T.AdditiveBlending : T.NormalBlending });
    const sp = new T.Sprite(mat);
    parts.push({ sp, a: (i / n) * Math.PI * 2, r: 0.9 + (i % 3) * 0.18, y: (i / n) * 2.4, sp0: 0.2 + Math.random() * 0.3, ph: Math.random() * 6 });
    g.add(sp);
  }
  let t = 0;
  g.userData.update = (dt) => {
    t += dt;
    for (const p of parts) {
      if (id === 'aura') { const a = p.a + t * 0.9; p.sp.position.set(Math.cos(a) * 1.0, 0.08 + Math.sin(t * 3 + p.ph) * 0.03, Math.sin(a) * 1.0); p.sp.scale.setScalar(0.45); p.sp.material.opacity = 0.55; continue; }
      if (id === 'sparkles') { const a = p.a + t * 0.6; p.sp.position.set(Math.cos(a) * p.r * 1.1, 0.3 + p.y, Math.sin(a) * p.r * 1.1); const k = 0.5 + 0.5 * Math.sin(t * 4 + p.ph); p.sp.scale.setScalar(0.1 + 0.16 * k); p.sp.material.opacity = 0.4 + 0.6 * k; continue; }
      const life = (t * p.sp0 + p.ph / 6) % 1;
      p.sp.position.set(Math.cos(p.a) * p.r + Math.sin(t + p.ph) * 0.1, 0.4 + life * 2.4, Math.sin(p.a) * p.r * 0.7);
      p.sp.scale.setScalar(id === 'notes' ? 0.24 : 0.2 + life * 0.08);
      p.sp.material.opacity = Math.min(1, (1 - life) * 2) * Math.min(1, life * 6);
    }
  };
  g.userData.dispose = () => { tex.dispose(); parts.forEach((p) => p.sp.material.dispose()); };
  return g;
}

/* ---------------- Fein aufgelöst: Gesicht und Verzierungen ---------------- */
const vxTagAll = (P, tag) => { for (const k of ['head', 'torso', 'armR', 'armL', 'legR', 'legL']) P[k].tag = tag; };
/** jedes grobe Voxel in 2×2×2 feine teilen */
function vxUpscale(set) {
  const out = new VoxSet();
  for (const v of set.m.values()) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) out.set(v.x * 2 + dx, v.y * 2 + dy, v.z * 2 + dz, v.c, v.mat, v.tag);
  return out;
}
/** Gesicht (fein): Kopf x -12..11, y 0..23, Vorderseite z = 11. Hier nur die Form (Nase, Ohren);
 *  Augen, Brauen, Mund und Wangen werden als Bild gezeichnet (vxFaceTexture) und auf die runde Gesichtsfläche gelegt. */
function vxFace(head, look) {
  const skin = look.skin;
  // Nase: kleine Wölbung
  for (const x of [-1, 0]) for (const y of [8, 9]) head.set(x, y, 12, skin, 0, 'face');
  head.set(-1, 8, 13, skin, 0, 'face').set(0, 8, 13, skin, 0, 'face');
  // Ohren (nur wo kein Haar ist)
  for (const x of [-13, 12]) for (let y = 7; y <= 11; y++) for (let z = -2; z <= 1; z++) head.setIfEmpty(x, y, z, skin, 0, 'face');
}
/** Gesicht als Bild: Augen mit Iris und Glanz, Brauen, Mund, Wangen, Deko. 1 feine Einheit = 512/24 px */
function vxFaceCanvas(look, over = {}) {
  const f = { ...(look.face || {}), ...over }, N = 512, U = N / 24;
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const X = (x) => (x + 12) * U, Y = (y) => (24 - y) * U;
  const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
  const skin = look.skin, iris = f.eyeC ?? 0x6b4423, ink = '#241c2c';
  const hairC = typeof look.hair?.c === 'number' ? look.hair.c : 0x3b2a1a;
  const brow = hex(f.browC ?? vxShade(hairC, -0.35));
  g.lineCap = 'round'; g.lineJoin = 'round';
  const dot = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * U, 0, Math.PI * 2); g.fill(); };
  const starPath = (x, y, R, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i & 1 ? r : R; g.lineTo(X(x + Math.cos(a) * rr), Y(y - Math.sin(a) * rr)); } g.closePath(); };
  const heartPath = (x, y, s) => { g.beginPath(); g.moveTo(X(x), Y(y - s)); g.bezierCurveTo(X(x - s * 1.6), Y(y + s * 0.2), X(x - s * 0.7), Y(y + s * 1.4), X(x), Y(y + s * 0.5)); g.bezierCurveTo(X(x + s * 0.7), Y(y + s * 1.4), X(x + s * 1.6), Y(y + s * 0.2), X(x), Y(y - s)); g.closePath(); };
  // Wangen, Deko
  if (f.blush) for (const cx of [-8.6, 8.6]) {
    const gr = g.createRadialGradient(X(cx), Y(6.3), 0, X(cx), Y(6.3), 2.2 * U);
    gr.addColorStop(0, 'rgba(255,110,140,.42)'); gr.addColorStop(1, 'rgba(255,110,140,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(X(cx), Y(6.3), 2.2 * U, 0, Math.PI * 2); g.fill();
  }
  if (f.freckles) for (const [x, y] of [[-9.6, 7.8], [-8.2, 7.2], [-9, 6.4], [-7.4, 6.6], [8.6, 7.8], [7.4, 7.2], [9.2, 6.6], [8.2, 6.2]]) dot(x, y, 0.24, hex(vxShade(skin, -0.32)));
  const deco = f.deco || 'none';
  if (deco === 'mole') dot(3.4, 3.6, 0.3, hex(vxShade(skin, -0.5)));
  if (deco === 'bandaid') { g.save(); g.translate(X(8.4), Y(6.6)); g.rotate(-0.5); g.fillStyle = '#f3d1a2'; g.fillRect(-1.9 * U, -0.65 * U, 3.8 * U, 1.3 * U); g.fillStyle = '#e8b97c'; g.fillRect(-0.6 * U, -0.65 * U, 1.2 * U, 1.3 * U); g.restore(); }
  if (deco === 'stars') for (const [x, y, r] of [[-9, 7, 1], [8.6, 7.4, 0.9], [9.8, 5.6, 0.55]]) { g.fillStyle = '#facc15'; starPath(x, y, r, r * 0.45); g.fill(); }
  if (deco === 'hearts') for (const [x, y, r] of [[-8.8, 6.6, 0.7], [8.8, 6.6, 0.7]]) { g.fillStyle = '#ec4899'; heartPath(x, y, r); g.fill(); }
  if (deco === 'whiskers') { g.strokeStyle = 'rgba(40,30,50,.75)'; g.lineWidth = 0.18 * U; for (const s of [-1, 1]) for (const dy of [-0.6, 0, 0.6]) { g.beginPath(); g.moveTo(X(s * 4.2), Y(6 + dy * 0.3)); g.lineTo(X(s * 7.8), Y(6 + dy)); g.stroke(); } dot(0, 7.4, 0.35, '#ec7a9a'); }
  if (deco === 'paint') for (const s of [-1, 1]) ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 0.42 * U; g.beginPath(); g.moveTo(X(s * 7), Y(8.2 - i * 0.6)); g.lineTo(X(s * 10.2), Y(8.6 - i * 0.6)); g.stroke(); });
  // Augen
  const style = f.eyes || 'round';
  for (const [cx, side] of [[-6, -1], [6, 1]]) {
    const cy = 11.9, rx = 2.05, ry = style === 'wide' || style === 'sparkle' ? 2.5 : 2.25;
    const es = style === 'wink' ? (side < 0 ? 'happy' : 'round') : style;
    if (es === 'happy') {
      g.strokeStyle = ink; g.lineWidth = 0.55 * U;
      g.beginPath(); g.moveTo(X(cx - 1.7), Y(cy - 0.6)); g.quadraticCurveTo(X(cx), Y(cy + 1.9), X(cx + 1.7), Y(cy - 0.6)); g.stroke();
    } else if (es === 'closed') {
      g.strokeStyle = ink; g.lineWidth = 0.5 * U;
      g.beginPath(); g.moveTo(X(cx - 1.9), Y(cy + 0.3)); g.quadraticCurveTo(X(cx), Y(cy - 1.1), X(cx + 1.9), Y(cy + 0.3)); g.stroke();
      if (f.lashes) { g.lineWidth = 0.3 * U; g.beginPath(); g.moveTo(X(cx + side * 1.8), Y(cy + 0.2)); g.lineTo(X(cx + side * 2.5), Y(cy + 0.6)); g.stroke(); }
    } else if (es === 'dot') {
      g.fillStyle = '#1b1422'; g.beginPath(); g.ellipse(X(cx), Y(cy), 0.95 * U, 1.35 * U, 0, 0, Math.PI * 2); g.fill();
      dot(cx - 0.3, cy + 0.5, 0.3, '#ffffff');
    } else {
      const cat = es === 'cat';
      const erx = cat ? 2.3 : rx, ery = cat ? 1.75 : ry, tilt = cat ? side * -0.18 : 0;
      g.save();
      g.beginPath(); g.ellipse(X(cx), Y(cy), erx * U, ery * U, tilt, 0, Math.PI * 2); g.clip();
      const sg = g.createLinearGradient(0, Y(cy + ery), 0, Y(cy - ery)); sg.addColorStop(0, '#e7e2ea'); sg.addColorStop(0.35, '#fbf8f4'); sg.addColorStop(1, '#ffffff');
      g.fillStyle = sg; g.fillRect(X(cx - erx), Y(cy + ery), 2 * erx * U, 2 * ery * U);
      const look2 = es === 'cool' ? side * 0.7 : 0;
      const ix = cx + side * -0.15 + look2, iy = cy - 0.15, ir = es === 'sparkle' ? 1.85 : 1.55;
      const ig = g.createRadialGradient(X(ix), Y(iy - 0.4), 0.2 * U, X(ix), Y(iy), ir * U);
      ig.addColorStop(0, hex(vxShade(iris, 0.45))); ig.addColorStop(0.6, hex(iris)); ig.addColorStop(1, hex(vxShade(iris, -0.45)));
      g.fillStyle = ig; g.beginPath(); g.arc(X(ix), Y(iy), ir * U, 0, Math.PI * 2); g.fill();
      if (es === 'heart') { g.fillStyle = '#ec4899'; heartPath(ix, iy - 0.1, 1.05); g.fill(); dot(ix - 0.5, iy + 0.6, 0.3, '#ffffff'); }
      else if (es === 'star') { g.fillStyle = '#fffbe6'; starPath(ix, iy, 1.25, 0.55); g.fill(); }
      else if (cat) { g.fillStyle = '#120d16'; g.beginPath(); g.ellipse(X(ix), Y(iy), 0.32 * U, 1.35 * U, 0, 0, Math.PI * 2); g.fill(); dot(ix - 0.6, iy + 0.6, 0.28, '#ffffff'); }
      else {
        dot(ix, iy, es === 'sparkle' ? 0.78 : 0.72, '#120d16');
        dot(ix - 0.6, iy + 0.65, es === 'sparkle' ? 0.6 : 0.46, '#ffffff');
        g.globalAlpha = 0.8; dot(ix + 0.55, iy - 0.55, 0.2, '#ffffff'); g.globalAlpha = 1;
        if (es === 'sparkle') { g.globalAlpha = 0.9; dot(ix + 0.7, iy + 0.7, 0.28, '#ffffff'); g.globalAlpha = 0.35; dot(ix, iy - 0.9, 0.9, '#ffffff'); g.globalAlpha = 1; }
      }
      if (es === 'sleepy' || es === 'cool') { g.fillStyle = hex(vxShade(skin, -0.04)); g.fillRect(X(cx - erx), Y(cy + ery), 2 * erx * U, (es === 'cool' ? 1.6 : 1.9) * U); }
      g.restore();
      g.strokeStyle = ink; g.lineWidth = 0.42 * U;
      g.beginPath();
      if (es === 'sleepy' || es === 'cool') { const top = cy + ery - (es === 'cool' ? 1.6 : 1.9); g.moveTo(X(cx - erx), Y(top + (es === 'cool' ? side * -0.2 : 0))); g.lineTo(X(cx + erx), Y(top + (es === 'cool' ? side * 0.2 : 0))); }
      else g.ellipse(X(cx), Y(cy), erx * U, ery * U, tilt, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      if (f.lashes || cat) {
        const ox = cx + side * erx * 0.92, oy = cy + 0.55;
        g.lineWidth = 0.3 * U; g.beginPath(); g.moveTo(X(ox), Y(oy)); g.lineTo(X(ox + side * 0.75), Y(oy + 0.75)); g.stroke();
        if (f.lashes) { g.beginPath(); g.moveTo(X(ox - side * 0.35), Y(oy + 0.9)); g.lineTo(X(ox + side * 0.15), Y(oy + 1.6)); g.stroke(); }
      }
    }
    // Brauen
    const bs = f.brows || 'normal';
    if (bs !== 'none') {
      g.strokeStyle = brow; g.lineWidth = (bs === 'thick' ? 0.95 : bs === 'thin' ? 0.34 : 0.6) * U;
      const inner = cx - side * 1.9, outer = cx + side * 1.9;
      let yi = 15.2, yo = 15.3, cyb = 16.3;
      if (bs === 'raised') { yi = 16.1; yo = 16; cyb = 17.4; }
      if (bs === 'angry') { yi = 14.6; yo = 16; cyb = 15.6; }
      if (bs === 'sad') { yi = 16.2; yo = 14.9; cyb = 16; }
      g.beginPath(); g.moveTo(X(inner), Y(yi)); g.quadraticCurveTo(X(cx), Y(cyb), X(outer), Y(yo)); g.stroke();
    }
  }
  // Mund: gefüllte Formen statt Striche – in der Mitte voller, an den Enden fein; mit Grübchen und Unterlippe
  const mouth = f.mouth || 'smile', red = '#7b2b3a', inner = '#5a1a28', tongue = '#ef7b8b', lipHi = 'rgba(255,170,180,.45)';
  const dimple = (x, y, s) => { g.strokeStyle = hex(vxShade(skin, -0.22)); g.lineWidth = 0.22 * U; g.beginPath(); g.moveTo(X(x), Y(y + 0.35)); g.quadraticCurveTo(X(x + s * 0.35), Y(y), X(x), Y(y - 0.35)); g.stroke(); };
  const crescent = (x0, y0, x1, y1, lo, hi) => {
    g.fillStyle = red; g.beginPath(); g.moveTo(X(x0), Y(y0));
    g.quadraticCurveTo(X((x0 + x1) / 2), Y(lo), X(x1), Y(y1));
    g.quadraticCurveTo(X((x0 + x1) / 2), Y(hi), X(x0), Y(y0)); g.closePath(); g.fill();
  };
  const openMouth = (w, top, depth, teeth, tg) => {
    const path = () => { g.beginPath(); g.moveTo(X(-w), Y(top)); g.quadraticCurveTo(X(0), Y(top - 0.35), X(w), Y(top));
      g.quadraticCurveTo(X(w * 0.9), Y(top - depth * 0.95), X(0), Y(top - depth)); g.quadraticCurveTo(X(-w * 0.9), Y(top - depth * 0.95), X(-w), Y(top)); g.closePath(); };
    g.save();
    path(); g.fillStyle = inner; g.fill(); g.clip();
    if (teeth) { g.fillStyle = '#ffffff'; g.fillRect(X(-w), Y(top + 0.2), 2 * w * U, (teeth + 0.2) * U); }
    if (tg) { g.fillStyle = tongue; g.beginPath(); g.ellipse(X(0), Y(top - depth + 0.25), w * 0.62 * U, depth * 0.42 * U, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    path(); g.strokeStyle = red; g.lineWidth = 0.28 * U; g.stroke();
    g.fillStyle = lipHi; g.beginPath(); g.ellipse(X(0), Y(top - depth - 0.45), w * 0.45 * U, 0.22 * U, 0, 0, Math.PI * 2); g.fill();
  };
  const smile = () => { crescent(-2.4, 5.0, 2.4, 5.0, 2.35, 3.55); dimple(-2.85, 5.05, -1); dimple(2.85, 5.05, 1); g.fillStyle = lipHi; g.beginPath(); g.ellipse(X(0), Y(2.55), 0.9 * U, 0.22 * U, 0, 0, Math.PI * 2); g.fill(); };
  if (mouth === 'grin') { openMouth(2.6, 5.3, 2.4, 0.75, true); dimple(-3.0, 5.3, -1); dimple(3.0, 5.3, 1); }
  else if (mouth === 'open') openMouth(1.8, 5.0, 2.1, 0.45, true);
  else if (mouth === 'laugh') { openMouth(2.9, 5.6, 3.3, 0.8, true); dimple(-3.3, 5.6, -1); dimple(3.3, 5.6, 1); }
  else if (mouth === 'o') { g.fillStyle = inner; g.beginPath(); g.ellipse(X(0), Y(3.9), 0.85 * U, 1.05 * U, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = red; g.lineWidth = 0.28 * U; g.stroke(); g.fillStyle = tongue; g.beginPath(); g.ellipse(X(0), Y(3.3), 0.5 * U, 0.3 * U, 0, 0, Math.PI * 2); g.fill(); }
  else if (mouth === 'calm') { crescent(-1.7, 4.3, 1.7, 4.3, 3.35, 3.95); g.fillStyle = lipHi; g.beginPath(); g.ellipse(X(0), Y(3.05), 0.8 * U, 0.2 * U, 0, 0, Math.PI * 2); g.fill(); }
  else if (mouth === 'smirk') { crescent(-1.9, 4.0, 2.3, 5.1, 3.0, 3.8); dimple(2.75, 5.1, 1); }
  else if (mouth === 'tongue') { smile(); g.fillStyle = tongue; g.beginPath(); g.ellipse(X(0.6), Y(2.6), 0.85 * U, 1.0 * U, 0.2, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#d4566a'; g.lineWidth = 0.14 * U; g.beginPath(); g.moveTo(X(0.6), Y(3.2)); g.lineTo(X(0.6), Y(2.1)); g.stroke(); }
  else if (mouth === 'cat') { g.strokeStyle = red; g.lineWidth = 0.4 * U; g.beginPath(); g.moveTo(X(-2), Y(4.6)); g.quadraticCurveTo(X(-1), Y(3.0), X(0), Y(4.2)); g.quadraticCurveTo(X(1), Y(3.0), X(2), Y(4.6)); g.stroke(); }
  else if (mouth === 'braces') { openMouth(2.6, 5.3, 2.4, 0.75, true); g.strokeStyle = '#c0c6d0'; g.lineWidth = 0.22 * U; g.beginPath(); g.moveTo(X(-2.2), Y(4.9)); g.lineTo(X(2.2), Y(4.9)); g.stroke(); for (let x = -1.8; x <= 1.9; x += 0.9) { g.fillStyle = '#9aa3b2'; g.fillRect(X(x - 0.15), Y(5.15), 0.3 * U, 0.5 * U); } }
  else if (mouth === 'fang') { smile(); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(X(1.0), Y(4.15)); g.lineTo(X(1.6), Y(4.25)); g.lineTo(X(1.3), Y(3.35)); g.closePath(); g.fill(); }
  else if (mouth === 'sad') { crescent(-2.0, 2.8, 2.0, 2.8, 4.6, 3.6); }
  else if (mouth === 'wavy') { g.strokeStyle = red; g.lineWidth = 0.38 * U; g.beginPath(); g.moveTo(X(-2.2), Y(4)); for (let i = 1; i <= 8; i++) g.lineTo(X(-2.2 + i * 0.55), Y(4 + (i & 1 ? 0.45 : -0.1))); g.stroke(); }
  else if (mouth === 'kiss') { g.fillStyle = '#e8546e'; heartPath(0, 4, 0.8); g.fill(); }
  else smile();
  return cv;
}
/** feine Oberflächen: Haarsträhnen, Stoff, Strick */
function vxFineTextures(F, look) {
  for (const set of Object.values(F)) for (const v of set.m.values()) {
    if (VOX.smooth) continue; // glatt: keine Pixel-Muster
    if (v.tag === 'hair') {
      const t = (v.x * 3 + v.z * 5 + 400) % 4 === 0 ? -0.13 : (v.x + 2 * v.z + 400) % 7 === 0 ? 0.1 : 0;
      if (t) v.c = vxShade(v.c, t);
    } else if (v.tag === 'top' || v.tag === 'bottom') {
      if (((v.x + v.y + v.z) & 1) === 0) v.c = vxShade(v.c, -0.03);
    } else if (v.tag === 'knit') {
      if ((v.x + v.z) & 1) v.c = vxShade(v.c, -0.08);
    }
  }
}
/** gestrichelte Naht auf einer Fläche: Punkte (x,y,z) wenn vorhanden aufhellen */
function vxStitch(set, pts, amt = 0.28) { pts.forEach(([x, y, z], i) => { if (!(i & 1)) { const v = set.get(x, y, z); if (v) v.c = vxShade(v.c, amt); } }); }
const vxRange = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
/** «×»-Zeichen 4×4 (Teilmal) */
function vxTimes(set, x0, y0, z, c, mat = 0) { for (const [dx, dy] of [[0, 3], [3, 3], [1, 2], [2, 2], [1, 1], [2, 1], [0, 0], [3, 0]]) set.set(x0 + dx, y0 + dy, z, c, mat); }

const VX_DETAIL = {
  sport(F, o) {
    const T = F.torso, dark = vxShade(o.c, -0.32), white = 0xf4f4f6;
    // Reissverschluss-Zähne (Kanten bei grob x -2 und 1 → fein -4..-3 und 2..3, Vorderseite z 7)
    for (const a of [-4, 2]) for (let y = 2; y <= 21; y++) { T.recolor(a, y, 7, (y & 1) ? o.trim : dark); T.recolor(a + 1, y, 7, (y & 1) ? dark : o.trim); }
    T.set(-3, 17, 8, 0xd7dbe3, 3).set(-3, 16, 8, 0xd7dbe3, 3).set(-3, 15, 8, 0x9ca3af, 3);    // Zipper
    // Nähte über dem Saum und an den Taschen
    vxStitch(T, vxRange(-12, 11).map((x) => [x, 4, 7]));
    for (const [a, b] of [[-10, -5], [4, 9]]) vxStitch(T, vxRange(a, b).map((x) => [x, 7, 9]), 0.22);
    // Abzeichen mit «×»
    vxTimes(T, 4, 14, 9, dark);
    // Ärmel: feine weisse Paspel zwischen den Streifen
    for (const arm of [F.armR, F.armL]) arm.paint((v) => (v.tag === 'top' && v.y === -6 && (v.x < -4 || v.x > 3 || v.z < -6 || v.z > 5) ? white : null));
  },
  hoodie(F, o) {
    const T = F.torso;
    for (const x of [-4, 2]) T.set(x, 9, 9, 0xd7dbe3, 3).set(x, 8, 9, 0xd7dbe3, 3);             // Bändel-Enden aus Metall
    for (const set of [F.armR, F.armL, T]) set.paint((v) => (v.tag === 'top' && (v.y === -14 || v.y === -13 || v.y === 0 || v.y === 1) && (v.x & 1) ? vxShade(v.c, -0.12) : null)); // Rippbündchen
  },
  pastel(F, o) {
    const T = F.torso;
    for (const y of [16, 11, 6]) for (const x of [-7, 6]) T.set(x, y, 8, o.trim, 1);           // Knöpfe
  },
  cargo(F, o) {
    for (const [leg, side] of [[F.legR, 1], [F.legL, -1]]) {
      const x0 = side > 0 ? 0 : -10;
      vxStitch(leg, vxRange(x0 + 2, x0 + 7).map((x) => [x, -9, 7]));                           // Knieschoner-Naht
      vxStitch(leg, vxRange(x0 + 2, x0 + 7).map((x) => [x, -12, 7]));
      const xs = side > 0 ? 11 : -12;
      vxStitch(leg, vxRange(-10, -5).map((y) => [xs, y, -3]), 0.2);                            // Tasche
    }
    F.torso.set(-1, 2, 8, 0x4b5563, 3).set(0, 2, 8, 0x4b5563, 3);                              // Schnalle
  },
  skirt(F, o) {
    const line = o.trim ?? 0xffffff, dark = vxShade(o.c, -0.2);
    F.torso.paint((v) => {
      if (v.tag !== 'skirt') return null;
      const lx = (v.x + v.z + 400) % 6 === 0, ly = (v.y + 400) % 5 === 0;
      return lx && ly ? dark : lx || ly ? line : ((v.x + v.z) >> 1) & 1 ? o.c : vxShade(o.c, -0.07);
    });
  },
  sneakers(F, o) {
    const b = -VOX.LEG * 2, white = 0xf4f4f6;
    for (const [leg, x0] of [[F.legR, 0], [F.legL, -12]]) {
      const xm = (x0 === 0 ? 3 : -3) * 2;                                                       // grob xm → fein
      // Schnürsenkel über Kreuz (4×4 auf der Vorderseite z 7)
      const rows = ['W..W', '.WW.', 'W..W', '.WW.'];
      rows.forEach((r, j) => [...r].forEach((ch, i) => leg.recolor(xm - 2 + i, b + 9 - j, 7, ch === 'W' ? white : vxShade(o.c, -0.3), 1)));
      // Sohlenprofil
      leg.paint((v) => (v.y === b && v.tag === 'shoes' && ((v.x + v.z) & 1) ? 0xb8bcc6 : null));
      // Naht an der Seite
      leg.paint((v) => (v.y === b + 5 && v.tag === 'shoes' && !(v.x & 1) && v.c === o.c ? vxShade(o.c, 0.3) : null));
    }
  },
  cap(F, o) {
    const H = F.head, z = 13;
    for (let x = -3; x <= 2; x++) for (let y = 22; y <= 26; y++) H.recolor(x, y, z, o.c2);
    vxTimes(H, -2, 22, z, o.c);
    vxStitch(H, vxRange(-10, 9).map((x) => [x, 21, 20]), 0.3);                                 // Naht am Schild
  },
  catbeanie(F, o) {
    F.head.paint((v) => (v.tag === 'hat' && (v.x + v.z) & 1 && v.y < 26 ? vxShade(v.c, -0.07) : null));
  },
  watch(F, o) {
    const A = F.armL;
    for (const [y, z] of [[-15, -2], [-16, -1], [-15, 0]]) A.recolor(-6, y, z, vxShade(o.c2 ?? 0x5eead4, -0.55), 2); // Anzeige
  },
  headphones(F, o) {
    const T = F.torso;
    for (const x0 of [-14, 8]) for (let x = x0; x <= x0 + 5; x++) for (let y = 14; y <= 21; y++) {
      const edge = x === x0 || x === x0 + 5 || y === 14 || y === 21, mid = x >= x0 + 2 && x <= x0 + 3 && y >= 16 && y <= 19;
      if (edge) T.recolor(x, y, 9, vxShade(o.c, 0.25)); else if (mid) T.recolor(x, y, 9, vxShade(o.c, -0.35));
    }
  },
};

/**
 * Abrunden: Voxel in einem Quader b entfernen, die ausserhalb einer «Superellipse» liegen (p = 2: Kugel, p gross: Würfel).
 * test(v): nur diese Voxel betreffen. flat: { bottom, top } – dort gerade lassen (Sohle, Hüfte).
 */
function vxCarve(set, b, p, { test = null, bottom = false, top = false } = {}) {
  const cx = (b.x0 + b.x1 + 1) / 2, cy = (b.y0 + b.y1 + 1) / 2, cz = (b.z0 + b.z1 + 1) / 2;
  const hx = (b.x1 - b.x0 + 1) / 2, hy = (b.y1 - b.y0 + 1) / 2, hz = (b.z1 - b.z0 + 1) / 2;
  set.filter((v) => {
    if (v.x < b.x0 || v.x > b.x1 || v.y < b.y0 || v.y > b.y1 || v.z < b.z0 || v.z > b.z1) return true;
    if (test && !test(v)) return true;
    let yy = (v.y + 0.5 - cy) / hy;
    if ((bottom && yy < 0) || (top && yy > 0)) yy = 0;
    const r = Math.abs((v.x + 0.5 - cx) / hx) ** p + Math.abs(yy) ** p + Math.abs((v.z + 0.5 - cz) / hz) ** p;
    return r <= 1.02;
  });
}
/** Hohlräume unter den Haaren füllen (sonst drückt sich die Innenseite beim Glätten nach aussen durch) */
function vxFillUnderHair(head) {
  const isHair = (v) => v && (v.tag === 'hair' || v.tag === 'hat');
  const add = [];
  for (let x = -12; x <= 11; x++) for (let y = 0; y <= 23; y++) for (let z = -12; z <= 11; z++) {
    if (head.has(x, y, z)) continue;
    let found = null;
    for (let k = 1; k <= 4 && !found; k++) {
      for (const [dx, dy, dz] of [[0, k, 0], [x < 0 ? -k : k, 0, 0], [0, 0, z < 0 ? -k : k]]) { const v = head.get(x + dx, y + dy, z + dz); if (isHair(v)) { found = v; break; } }
    }
    if (found) add.push([x, y, z, found.c]);
  }
  for (const [x, y, z, c] of add) head.set(x, y, z, c, 0, 'hair');
}
/** die ganze Figur rund machen (feine Koordinaten) */
function vxRoundAll(F, look) {
  const body = (v) => v.tag !== 'neck' && v.tag !== 'bag' && v.tag !== 'back';
  // Kopf fast kugelig, Haare und Mützen folgen der Rundung
  vxCarve(F.head, { x0: -12, x1: 11, y0: 0, y1: 23, z0: -12, z1: 11 }, 3, { test: (v) => v.tag === 'skin' || v.tag === 'face' });
  // Haare: gleiche Form wie der Kopf, 4 feine Voxel grösser – so bleibt die Haarschicht überall geschlossen
  vxCarve(F.head, { x0: -16, x1: 15, y0: -4, y1: 27, z0: -16, z1: 15 }, 3, { test: (v) => v.tag === 'hair' || v.tag === 'hat', bottom: true });
  vxFillUnderHair(F.head);
  // Körper samt Jacke, Arme, Beine, Schuhe: stark gerundete Kanten
  vxCarve(F.torso, { x0: -12, x1: 11, y0: 0, y1: 23, z0: -8, z1: 7 }, 3.2, { test: body, bottom: true });
  for (const arm of [F.armR, F.armL]) vxCarve(arm, { x0: -6, x1: 5, y0: -20, y1: 3, z0: -8, z1: 7 }, 3.2);
  for (const [leg, x0] of [[F.legR, 0], [F.legL, -12]]) {
    vxCarve(leg, { x0: x0 - 2, x1: x0 + 13, y0: -16, y1: -1, z0: -8, z1: 7 }, 3.4, { top: true, test: (v) => v.tag !== 'shoes' });
    vxCarve(leg, { x0, x1: x0 + 11, y0: -26, y1: -15, z0: -8, z1: 11 }, 2.8, { bottom: true, test: (v) => v.tag === 'shoes' });
  }
}

/* ---------------- Figur zusammenbauen ---------------- */
/**
 * look: { skin, face: { eyes, eyeC, brows, lashes, blush, freckles, mouth, deco }, hair: { id, c ('rainbow' möglich), c2 },
 *   top: { id, c, trim, under, patches, num }, bottom: { id, c, trim, chain, warmers }, shoes: { id, c, c2, paw },
 *   hat: { id, c, c2, c3 }, glasses: { id, c }, neck: { id, c, c2 }, back: { id, c, c2 }, wrist: { id, c, c2 },
 *   bag: { id, c, c2 }, hand: id | { id, c }, pet: { id, c }, effect: { id, c } }
 * Liefert { root, parts, setAnim(name), update(dt), tris(), dispose() }
 */
const VX_ANIMS = ['idle', 'wave', 'cheer', 'dance', 'hold', 'present', 'jump', 'clap', 'think', 'spin', 'bow', 'flex', 'sit', 'shy', 'laugh', 'drive'];
function vxFigure(T, look, { lite = false } = {}) {
  const P = vxBody(look);
  const use = (reg, o, tag, ...args) => { if (o && reg[o.id]) { vxTagAll(P, tag); reg[o.id](...args, o); vxTagAll(P, null); } };
  const rainbow = look.hair?.c === 'rainbow';
  const hairO = look.hair ? { ...look.hair, c: rainbow ? 0xf472b6 : look.hair.c } : null;
  const outfit = look.top && VX_OUTFITS.has(look.top.id);
  use(VX_HAIR, hairO, 'hair', P.head);
  if (!outfit) use(VX_BOTTOMS, look.bottom, 'bottom', P);
  use(VX_SHOES, look.shoes, 'shoes', P);
  use(VX_TOPS, look.top, 'top', P);
  use(VX_WRIST, look.wrist, 'wrist', P);
  use(VX_BAGS, look.bag, 'bag', P.torso);
  use(VX_NECK, look.neck, 'neck', P.torso);
  use(VX_BACK, look.back, 'back', P.torso);
  use(VX_HATS, look.hat, 'hat', P.head);
  // fein aufteilen, dann Gesicht und Verzierungen
  // lite (z. B. Computer-Fahrer im Rennen): grobe Voxel, etwa ein Viertel der Dreiecke, ohne feine Verzierungen
  const F = {};
  for (const k of ['head', 'torso', 'armR', 'armL', 'legR', 'legL']) F[k] = lite ? P[k] : vxUpscale(P[k]);
  if (!lite) {
    vxFineTextures(F, look);
    vxFace(F.head, look);
    for (const slot of ['hair', 'top', 'bottom', 'shoes', 'hat', 'neck', 'back', 'wrist', 'bag']) { const o = look[slot]; if (o && VX_DETAIL[o.id] && !(slot === 'bottom' && outfit)) VX_DETAIL[o.id](F, o, look); }
    if (VOX.smooth) vxRoundAll(F, look);
  }
  if (rainbow) {
    const RB = [0xff5e7e, 0xffb13d, 0xffe066, 0x5bd47a, 0x4ca8ff, 0xa66bff];
    F.head.paint((v) => (v.tag === 'hair' || v.tag === 'spike' ? RB[Math.floor(((v.y + 40) / 5)) % RB.length] : null));
  }

  const S = VOX.S;
  const root = new T.Group();
  const body = new T.Group(); root.add(body);
  body.position.y = (P.lift || 0) * 2 * S;
  const mk = (set, x, y, z, parent = body, opts) => {
    const g = new T.Group(); g.position.set(x * 2 * S, y * 2 * S, z * 2 * S);
    const m = vxMesh(T, set, lite ? { ...opts, iter: 5 } : opts); if (lite) m.scale.setScalar(2);
    g.add(m); parent.add(g); return g;
  };
  const G = {};
  G.torso = mk(F.torso, 0, VOX.HIP, 0);
  // Gesicht: Bild auf die Vorderseite des Kopfes (nur Haut, nicht Haare); je Ausdruck ein Bild
  const faces = new Map();
  const faceTex = (over) => {
    const k = `${over.mouth || ''}|${over.eyes || ''}|${over.brows || ''}|${over.blush ? 1 : ''}`;
    if (!faces.has(k)) { const t = new T.CanvasTexture(vxFaceCanvas(look, over)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; faces.set(k, t); }
    return faces.get(k);
  };
  const decalMat = new T.MeshStandardMaterial({ map: faceTex({}), transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const decal = lite ? { test: (v) => (v.tag === 'skin' || v.tag === 'face') && v.z >= 1 && v.y >= 0, uv: (x, y) => [(x * 2 + 12) / 24, (y * 2) / 24] }
    : { test: (v) => (v.tag === 'skin' || v.tag === 'face') && v.z >= 2 && v.y >= 0, uv: (x, y) => [(x + 12) / 24, y / 24] };
  G.head = mk(F.head, 0, VOX.NECK - VOX.HIP, 0, G.torso, { decal, decalMat });
  if (look.glasses && VX_GLASSES[look.glasses.id] && !lite) G.head.add(vxMesh(T, VX_GLASSES[look.glasses.id](look.glasses), { iter: 2 }));
  G.armR = mk(F.armR, VOX.ARM_X, VOX.SHOULDER - VOX.HIP, 0, G.torso);
  G.armL = mk(F.armL, -VOX.ARM_X, VOX.SHOULDER - VOX.HIP, 0, G.torso);
  G.legR = mk(F.legR, 0, VOX.HIP, 0);
  G.legL = mk(F.legL, 0, VOX.HIP, 0);
  let item = null;
  const handO = typeof look.hand === 'string' ? { id: look.hand } : look.hand;
  if (handO && VX_HAND[handO.id]) {
    const H = VX_HAND[handO.id];
    item = new T.Group(); item.add(vxMesh(T, vxUpscale(H.build(handO)), { iter: H.iter ?? 5 }));
    item.position.set((H.x ?? -0.5) * 2 * S, -9.5 * 2 * S, (H.z ?? 0.5) * 2 * S);
    item.rotation.set(H.rx || 0, H.ry || 0, H.rz || 0, 'YXZ');
    G.armR.add(item);
  }
  // Haustier und Effekt
  let pet = null, fx = null;
  if (look.pet && VX_PETS[look.pet.id]) { pet = vxPetGroup(T, look.pet); pet.position.set(1.3, 0, 0.45); pet.rotation.y = -0.45; root.add(pet); }
  if (look.effect) { fx = vxEffect(T, look.effect.id, look.effect.c); if (fx) root.add(fx); }

  /* Animationen: Zielhaltung pro Bild, weich überblendet */
  const st = { anim: 'idle', t: 0, cur: {}, steer: 0, mood: '', rate: 1, ph: 0 };
  const hold = item ? -0.55 : 0;
  const poses = {
    idle: (t) => ({ by: Math.sin(t * 2.2) * 0.006, hx: Math.sin(t * 1.3) * 0.03, hy: Math.sin(t * 0.6) * 0.12, arx: hold + Math.sin(t * 2.2) * 0.05, alx: -Math.sin(t * 2.2) * 0.05, arz: 0.04, alz: -0.04 }),
    wave: (t) => ({ hx: -0.05, hz: Math.sin(t * 3) * 0.06, arz: 2.75 + Math.sin(t * 11) * 0.28, alz: -0.06, alx: Math.sin(t * 2) * 0.05 }),
    cheer: (t) => ({ by: Math.abs(Math.sin(t * 6)) * 0.22, arz: 2.6 + Math.sin(t * 12) * 0.12, alz: -2.6 - Math.sin(t * 12) * 0.12, hx: -0.15, lrx: -Math.abs(Math.sin(t * 6)) * 0.3, llx: -Math.abs(Math.sin(t * 6)) * 0.3 }),
    dance: (t) => ({ by: Math.abs(Math.sin(t * 5)) * 0.07, tz: Math.sin(t * 5) * 0.12, ty: Math.sin(t * 2.5) * 0.25, arz: 1.2 + Math.sin(t * 5) * 0.9, alz: -1.2 + Math.sin(t * 5) * 0.9, arx: -0.4, alx: -0.4, hz: -Math.sin(t * 5) * 0.12, lrx: Math.max(0, Math.sin(t * 5)) * -0.5, llx: Math.max(0, -Math.sin(t * 5)) * -0.5 }),
    hold: (t) => ({ by: Math.sin(t * 2.2) * 0.006, arx: -0.95, arz: 0.05, alx: Math.sin(t * 2.2) * 0.05, hy: 0.15, hx: 0.08 }),
    present: (t) => ({ by: Math.sin(t * 3) * 0.01, arx: -1.7 + Math.sin(t * 3) * 0.06, arz: 0.45, alx: -0.2, alz: -0.15, hx: 0.08, hy: 0.28 }),
    jump: (t) => { const ph = (t * 1.5) % 1, h = ph < 0.6 ? Math.sin((ph / 0.6) * Math.PI) : 0; return { by: h * 0.45, arz: 0.3 + h * 2.3, alz: -0.3 - h * 2.3, lrx: -h * 0.6, llx: -h * 0.6, hx: -0.1 }; },
    clap: (t) => { const k = Math.sin(t * 14); return { arx: -1.25, alx: -1.25, arz: -0.3 + k * 0.18, alz: 0.3 - k * 0.18, hx: 0.05, by: Math.abs(Math.sin(t * 7)) * 0.02 }; },
    think: (t) => ({ arx: -2.25, arz: -0.55, alx: -0.85, alz: 0.55, hz: 0.18, hx: -0.12 + Math.sin(t * 1.5) * 0.03, hy: 0.12 }),
    spin: (t) => ({ ty: t * 7, arz: 1.3, alz: -1.3, by: Math.abs(Math.sin(t * 7)) * 0.05 }),
    bow: (t) => ({ tx: 0.75 * Math.min(1, t * 2), arx: 0.3, alx: 0.3, hx: 0.25 }),
    flex: (t) => ({ arz: 1.55, alz: -1.55, arx: -0.15, alx: -0.15, by: Math.abs(Math.sin(t * 4)) * 0.04, hx: -0.08 }),
    sit: (t) => ({ drop: 0.62, lrx: -1.5, llx: -1.5, arx: -0.7, alx: -0.7, arz: 0.15, alz: -0.15, by: Math.sin(t * 2) * 0.005, hy: Math.sin(t * 0.7) * 0.15 }),
    shy: (t) => ({ arx: 0.35, alx: 0.35, arz: -0.2, alz: 0.2, hx: 0.22, hy: Math.sin(t * 1.2) * 0.1, tz: Math.sin(t * 1.6) * 0.04 }),
    laugh: (t) => ({ tx: -0.12 + Math.abs(Math.sin(t * 9)) * 0.06, by: Math.abs(Math.sin(t * 9)) * 0.04, arx: -0.4, alx: -0.4, arz: -0.3, alz: 0.3, hx: -0.2 }),
    // Lauf-Spiel: rennen (Tempo mit setRate), springen, rutschen, stolpern; k = wie schnell die Haltung wechselt
    run: () => { const s = Math.sin(st.ph), c = Math.cos(st.ph); return { k: 30, lrx: s * 0.95, llx: -s * 0.95, arx: -s * 0.9 + hold * 0.4, alx: s * 0.9, arz: 0.14, alz: -0.14, by: Math.abs(c) * 0.06, tx: 0.2, hx: -0.12, tz: s * 0.04, ty: s * 0.06 }; },
    leap: (t) => ({ k: 16, lrx: -1.05, llx: 0.5, arx: -0.5, alx: 0.4, arz: 0.75 + Math.sin(t * 9) * 0.05, alz: -0.75, tx: 0.12, hx: -0.18 }),
    slide: () => ({ k: 20, drop: 0.5, tx: -1.0, lrx: -1.4, llx: -1.25, arx: 0.35, alx: 0.35, arz: 0.5, alz: -0.5, hx: 0.55 }),
    oops: (t) => ({ k: 14, arz: 2.3 + Math.sin(t * 22) * 0.35, alz: -2.3 - Math.sin(t * 22) * 0.35, tx: -0.35, hx: -0.25, lrx: -0.5, llx: 0.3, by: 0.05 }),
    // im Kart: sitzen, Beine nach vorne, beide Hände am Lenkrad; lenken mit st.steer (-1 links … 1 rechts)
    drive: (t) => { const s = st.steer; return { lrx: -1.45, llx: -1.45, arx: -1.12 + s * 0.2, alx: -1.12 - s * 0.2, arz: -0.36, alz: 0.36, hy: -s * 0.3, tz: s * 0.09, hx: 0.04 + Math.sin(t * 9) * 0.008, by: st.mood === 'turbo' ? Math.abs(Math.sin(t * 22)) * 0.012 : 0 }; },
  };
  const keys = ['by', 'hx', 'hy', 'hz', 'tz', 'ty', 'tx', 'drop', 'arx', 'arz', 'alx', 'alz', 'lrx', 'llx'];
  function apply(p) {
    root.position.y = p.by - p.drop; body.rotation.y = p.ty; G.torso.rotation.set(p.tx, 0, p.tz);
    G.head.rotation.set(p.hx, p.hy, p.hz);
    G.armR.rotation.set(p.arx, 0, p.arz); G.armL.rotation.set(p.alx, 0, p.alz);
    G.legR.rotation.x = p.lrx; G.legL.rotation.x = p.llx;
  }
  /* Mimik: Mund, Augen und Brauen passend zur Bewegung, ab und zu blinzeln */
  const baseMouth = look.face?.mouth || 'smile';
  const EXPR = {
    wave: (t) => ({ mouth: Math.floor(t * 5) % 3 ? 'open' : 'o' }),
    cheer: () => ({ mouth: 'laugh', eyes: 'happy' }),
    dance: (t) => ({ mouth: Math.floor(t * 2.5) % 2 ? 'grin' : 'laugh' }),
    present: () => ({ mouth: 'open', brows: 'raised' }),
    hold: () => ({ mouth: baseMouth === 'calm' ? 'smirk' : 'grin' }),
    jump: () => ({ mouth: 'laugh', eyes: 'happy' }),
    clap: () => ({ mouth: 'grin' }),
    think: () => ({ mouth: 'calm', brows: 'raised', eyes: 'cool' }),
    spin: () => ({ mouth: 'o', eyes: 'happy' }),
    bow: () => ({ eyes: 'closed', mouth: 'smile' }),
    flex: () => ({ mouth: 'grin', brows: 'angry' }),
    shy: () => ({ mouth: 'wavy', brows: 'sad', blush: true }),
    laugh: () => ({ mouth: 'laugh', eyes: 'happy' }),
    run: () => (st.mood === 'win' ? { mouth: 'laugh', eyes: 'happy' } : st.mood === 'oops' ? { mouth: 'o', brows: 'raised' } : { mouth: baseMouth === 'calm' ? 'smirk' : 'grin' }),
    leap: () => ({ mouth: 'laugh', eyes: 'happy' }),
    slide: () => ({ mouth: 'o', eyes: 'happy' }),
    oops: () => ({ mouth: 'o', brows: 'raised' }),
    drive: () => (st.mood === 'turbo' ? { mouth: 'laugh', eyes: 'happy' } : st.mood === 'oops' ? { mouth: 'o', brows: 'raised' } : st.mood === 'win' ? { mouth: 'laugh', eyes: 'happy' } : { mouth: baseMouth === 'calm' ? 'smirk' : 'grin' }),
  };
  st.blink = 1.5 + Math.random() * 2;
  function expression(dt) {
    const over = EXPR[st.anim] ? { ...EXPR[st.anim](st.t) } : {};
    st.blink -= dt;
    if (st.blink < 0 && !over.eyes) { over.eyes = 'closed'; if (st.blink < -0.13) st.blink = 2.2 + Math.random() * 3; }
    const tex = faceTex(over);
    if (decalMat.map !== tex) decalMat.map = tex;
  }
  function update(dt) {
    st.t += dt;
    st.ph += dt * 14 * st.rate;
    expression(dt);
    const target = poses[st.anim](st.t);
    const k = 1 - Math.exp(-dt * (target.k || 9));
    for (const key of keys) {
      const goal = target[key] || 0;
      if (key === 'ty' && st.anim !== 'spin' && st.cur.ty != null && Math.abs(st.cur.ty) > Math.PI) st.cur.ty = ((st.cur.ty + Math.PI) % (Math.PI * 2)) - Math.PI;
      st.cur[key] = st.cur[key] == null ? goal : key === 'ty' && st.anim === 'spin' ? goal : st.cur[key] + (goal - st.cur[key]) * k;
    }
    apply(st.cur);
    if (pet) { const happy = ['cheer', 'jump', 'dance', 'clap', 'laugh'].includes(st.anim); pet.position.y = happy ? Math.abs(Math.sin(st.t * 6)) * 0.18 : Math.abs(Math.sin(st.t * 1.8)) * 0.02; pet.rotation.z = Math.sin(st.t * 1.3) * 0.05; }
    fx?.userData.update(dt);
  }
  update(0.016);
  return {
    root, parts: G, item, pet,
    setAnim(name) { if (poses[name]) { st.anim = name; st.t = 0; } },
    /** im Kart: lenken (-1 … 1) und Stimmung ('', 'turbo', 'oops', 'win') */
    setSteer(s) { st.steer = Math.max(-1, Math.min(1, s || 0)); },
    setMood(m) { st.mood = m || ''; },
    /** Lauf-Tempo (1 = normal) */
    setRate(r) { st.rate = Math.max(0.3, Math.min(2.5, r || 1)); },
    get anim() { return st.anim; },
    update,
    tris() { let n = 0; root.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; },
    dispose() { root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); faces.forEach((t) => t.dispose()); decalMat.dispose(); fx?.userData.dispose(); },
  };
}
