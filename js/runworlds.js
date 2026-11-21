/* Welten-Lauf – die Welten (gemeinsam für Teilmal und Vokaboom; die Datei ist in beiden Repositories gleich)
 *
 * Jede Welt hat: Himmel/Licht/Nebel, Bodentexturen, Kulissen-Teile (Voxel im Avatar-Stil, einmal gebaut und viele Male
 * gezeigt), Hindernisse in festen Grössen (siehe RN in runner3d.js), ein Tor und eine Verteil-Funktion für die Kulisse.
 * Masse: 1 = 1 Meter. Die Bahn liegt bei x = -3,3 … 3,3, Spuren bei -2, 0, 2. Laufrichtung = -z (d wächst).
 * Hindernis-Modelle stehen mit der Vorderkante bei z = 0 und reichen nach -z.
 */
'use strict';

/* ---------------- Texturen ---------------- */
const RT = {
  rnd: (a, b) => a + Math.random() * (b - a),
  hex: (c) => `#${(c >>> 0).toString(16).padStart(6, '0')}`,
  mix(c, k) { return RT.hex(rnShade(c, k)); },
  fill(g, w, h, c) { g.fillStyle = typeof c === 'number' ? RT.hex(c) : c; g.fillRect(0, 0, w, h); },
  /** Tupfen (über die Ränder hinweg, damit die Kachel nahtlos ist) */
  dots(g, w, h, cols, n, r0, r1, alpha = [0.25, 0.7], shape = 'circle') {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = RT.rnd(r0, r1);
      g.globalAlpha = RT.rnd(alpha[0], alpha[1]);
      g.fillStyle = typeof cols[0] === 'number' ? RT.hex(cols[i % cols.length]) : cols[i % cols.length];
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        if (x + ox < -r1 || x + ox > w + r1 || y + oy < -r1 || y + oy > h + r1) continue;
        g.beginPath();
        if (shape === 'leaf') g.ellipse(x + ox, y + oy, r, r * 0.45, (i * 1.7) % 3.14, 0, Math.PI * 2);
        else g.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  },
  /** Platten in Spalten (eine Spalte = eine Spur, Fugen bei 1/4 und 3/4) */
  slabs(g, w, h, { base, vary = 0.1, joint, rows = [3, 6], moss = null, edge = 0.18 }) {
    RT.fill(g, w, h, joint);
    for (const [c0, c1] of [[0.25, 0.75], [0.75, 1.25]]) {
      let y = 0;
      while (y < h) {
        const hh = Math.min(h - y, Math.round(h / RT.rnd(rows[0], rows[1])));
        const x0 = c0 * w + 3, x1 = c1 * w - 3;
        const col = RT.mix(base, RT.rnd(-vary, vary));
        for (const ox of [0, -w]) {
          g.fillStyle = col; g.fillRect(x0 + ox, y + 3, x1 - x0, hh - 6);
          g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x0 + ox, y + 3, x1 - x0, 4);
          g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x0 + ox, y + hh - 7, x1 - x0, 4);
        }
        y += hh;
      }
    }
    if (moss) RT.dots(g, w, h, moss, 160, 4, 16, [0.2, 0.55]);
    RT.dots(g, w, h, ['rgba(0,0,0,.5)', 'rgba(255,255,255,.4)'], 900, 0.6, 1.8, [0.1, 0.3]);
  },
  /** Bretter quer zur Laufrichtung */
  planks(g, w, h, { base, vary = 0.12, gap = '#2a1b10', n = 10, nails = '#3a3a3a' }) {
    RT.fill(g, w, h, gap);
    const ph = h / n;
    for (let i = 0; i < n; i++) {
      const col = RT.mix(base, RT.rnd(-vary, vary));
      g.fillStyle = col; g.fillRect(0, i * ph + 2, w, ph - 4);
      g.globalAlpha = 0.18; g.fillStyle = '#000';
      for (let k = 0; k < 7; k++) { const yy = i * ph + RT.rnd(4, ph - 4); g.fillRect(0, yy, w, 1); }
      g.globalAlpha = 1;
      g.fillStyle = nails; for (const x of [0.06, 0.44, 0.56, 0.94]) { g.beginPath(); g.arc(x * w, i * ph + ph / 2, 2.2, 0, 6.3); g.fill(); }
    }
  },
  /** runde Pflastersteine */
  cobbles(g, w, h, { base, vary = 0.14, joint, n = 14 }) {
    RT.fill(g, w, h, joint);
    const s = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + (j % 2) * 0.5) * s, y = j * s;
      const col = RT.mix(base, RT.rnd(-vary, vary));
      for (const ox of [0, -w, w]) {
        g.fillStyle = col; g.beginPath(); g.ellipse(x + ox + s / 2, y + s / 2, s * 0.44, s * 0.4, RT.rnd(0, 3), 0, 6.3); g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(x + ox + s * 0.45, y + s * 0.4, s * 0.25, s * 0.18, 0, 0, 6.3); g.fill();
      }
    }
  },
  /** Mauersteine (Seiten der Platten) */
  bricks(g, w, h, { base, vary = 0.1, joint, rows = 6, cols = 4 }) {
    RT.fill(g, w, h, joint);
    const rh = h / rows, cw = w / cols;
    for (let r = 0; r < rows; r++) for (let c = -1; c <= cols; c++) {
      const x = c * cw + (r % 2) * cw / 2;
      g.fillStyle = RT.mix(base, RT.rnd(-vary, vary)); g.fillRect(x + 2, r * rh + 2, cw - 4, rh - 4);
    }
  },
  /** Spurrillen (Fugen zwischen den Spuren) */
  lanes(g, w, h, color = 'rgba(0,0,0,.35)', lw = 6) { g.fillStyle = color; for (const u of [0.25, 0.75]) g.fillRect(u * w - lw / 2, 0, lw, h); },
};

/* ---------------- Farben: Flecken statt Pixelrauschen ---------------- */
/** Farbe in groben Flecken (scale Voxel gross) leicht heller/dunkler */
const rwPatch = (c, amt = 0.12, scale = 3, seed = 0) => (x, y, z) => rnShade(c, (vxRand(Math.floor(x / scale), Math.floor(y / scale), Math.floor(z / scale), seed) - 0.5) * 2 * amt);
/** zwei Farben in Flecken gemischt (z. B. Stein mit Moos): share = Anteil der zweiten Farbe, up = mehr oben */
const rwMix = (a, b, share = 0.3, scale = 3, seed = 0, up = 0) => (x, y, z) => {
  const n = vxRand(Math.floor(x / scale), Math.floor(y / scale), Math.floor(z / scale), seed + 17);
  const n2 = vxRand(Math.floor(x / 1.5), Math.floor(y / 1.5), Math.floor(z / 1.5), seed + 3);
  return n * 0.75 + n2 * 0.25 < share + y * up ? rnShade(b, (n2 - 0.5) * 0.18) : rnShade(a, (n - 0.5) * 0.2);
};

/** Lichtstrahl: oben hell, unten weg, seitlich weich (top = Helligkeit ganz oben) */
function rwRayTex(T, rgb, top = 0) {
  return rnCanvasTex(T, 64, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = y / h, side = Math.sin((x / (w - 1)) * Math.PI) ** 2;
      const a = (top ? Math.min(1, v / 0.3) : 1) * (1 - v) ** 1.4 * side;
      const i = (y * w + x) * 4; const [r, gg, b] = rgb.split(',').map(Number);
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = Math.round(a * 150);
    }
    g.putImageData(img, 0, 0);
  }, { repeat: false });
}

/* ---------------- Hindernisse, die später dazukommen ---------------- */
/** hohe Wand (nur mit Doppelsprung): gestreift, mit leuchtenden Doppelpfeilen ⏫ */
function rwTall({ post, panel, panel2, accent = 0x22d3ee }) {
  return { u: 0.08, iter: 2, field: 1.0, yt: RN.TALL, cap: 16, build(B) {
    const H = Math.round(RN.TALL / 0.08);
    for (const sx of [-11, 11]) { B.box(sx - 1, 0, -1, sx + 1, H + 1, 1, post); B.ell(sx, H + 2.5, 0, 1.6, 1.6, 1.6, accent, { mat: 2 }); }
    B.box(-10, 3, 0, 10, H, 0, (x, y) => (Math.floor((x + 40 + y) / 4) % 2 ? panel : panel2));
    for (const oy of [H - 11, H - 5]) for (let k = 0; k <= 5; k++) for (const dy of [0, 1]) { B.put(-k, oy + 5 - k - dy, 1, accent, 2); B.put(k, oy + 5 - k - dy, 1, accent, 2); }
    return B;
  } };
}
/** Rollendes Hindernis (wandert quer über die Spuren). kind: barrel | ball | spool | crab */
function rwRoller(kind, c1, c2 = 0x3b2a1a) {
  return { u: 0.06, iter: 3, field: 1.1, yt: RN.LOW, cap: 12, noRoll: kind === 'crab', r: 0.31, build(B) {
    if (kind === 'barrel') { B.tube('z', -6, 6, 0, 5, (z) => 5 + Math.sin(((z + 6) / 12) * Math.PI) * 0.6, (x, y, z) => (Math.abs(z) === 4 ? c2 : rnShade(c1, (vxRand(x, y, Math.floor(z / 3)) - 0.5) * 0.15))); B.tube('z', -6, -6, 0, 5, 4.5, rnShade(c1, -0.2)); }
    else if (kind === 'ball') { for (let k = 0; k < 40; k++) { const a = k * 2.4, e = Math.asin(1 - (2 * (k + 0.5)) / 40); B.bar([0, 5, 0], [Math.cos(a) * Math.cos(e) * 5.5, 5 + Math.sin(e) * 5.5, Math.sin(a) * Math.cos(e) * 5.5], 0.5, k % 2 ? c1 : c2); } B.ell(0, 5, 0, 3.5, 3.5, 3.5, rnShade(c1, -0.25)); }
    else if (kind === 'spool') { B.tube('z', -6, 6, 0, 5, (z) => (Math.abs(z) >= 5 ? 5.4 : 3.6), (x, y, z) => (Math.abs(z) >= 5 ? c2 : ((x + y) % 3 === 0 ? rnShade(c1, -0.2) : c1))); }
    else { // Krabbe
      B.ell(0, 4, 0, 6, 3, 4.5, c1); for (const sx of [-1, 1]) { B.ell(sx * 8, 6, 2, 2.4, 2, 2, c1); B.put(sx * 9, 7, 4, 0xffffff, 1); B.bar([sx * 4, 3, 0], [sx * 9, 0, -1], 0.6, c2); B.bar([sx * 4, 3, -2], [sx * 9, 0, -4], 0.6, c2); B.bar([sx * 2, 6, 3], [sx * 2, 9, 4], 0.5, c2); B.ell(sx * 2, 9.5, 4, 1, 1, 1, 0x111111, { mat: 1 }); }
    }
    return B;
  } };
}

/* ---------------- gemeinsame Teile ---------------- */
/** Ring aus Kugeln um einen Pfosten (Blumen, Ranken) */
function rwFlowers(B, pts, cols, r = 1.3) { pts.forEach(([x, y, z], i) => { const c = cols[i % cols.length]; B.ell(x, y, z, r, r, r, c); B.put(x, y, z + (z >= 0 ? 1 : -1), 0xffe066); }); }

/* =========================================================
   🌴 Dschungel
   ========================================================= */
const RW_JUNGLE = (() => {
  const SY = -0.7; // Waldboden neben dem Steinweg
  // Blätter: grosse Farbflecken, oben heller (Sonne)
  const leafC = (x, y, z) => { const n = vxRand(Math.floor(x / 3), Math.floor(y / 3), Math.floor(z / 3), 5); return rnShade([0x3f8a35, 0x2f7a3a, 0x4d9a3a, 0x357f2e][Math.floor(n * 4)], (vxRand(Math.floor(x / 2), Math.floor(y / 2), Math.floor(z / 2), 3) - 0.5) * 0.18 + Math.max(-0.15, Math.min(0.12, (y % 12) * 0.012 - 0.04))); };
  const bark = (x, y, z) => rnShade(0x6b4f35, (vxRand(Math.floor(x / 1.5), Math.floor(y / 5), Math.floor(z / 1.5), 1) - 0.5) * 0.22);
  const mossy = (base) => rwMix(base, 0x6a9a40, 0.22, 2, 2, 0.003);
  return {
    id: 'jungle', name: 'Dschungel', emoji: '🌴', desc: 'Ein alter Steinweg mitten durch den Urwald',
    sky: ['#7cc7a8', '#bfe3b4', '#e9f3c6'], fog: 0xa9cfa0, fogNear: 22, fogFar: 115,
    hemi: [0xe6ffd6, 0x2c4a22, 1.15], sun: [0xfff0c4, 2.3], sunDir: [-0.35, 1, 0.25], env: 0.7, exposure: 1.02,
    gem: 0x7df9ff,
    ground: {
      top: (g, w, h) => { RT.slabs(g, w, h, { base: 0x8d9180, vary: 0.12, joint: '#3d4a2c', rows: [2, 4], moss: ['#5f8f3a', '#79a64a', '#46702c'] }); RT.lanes(g, w, h, 'rgba(30,45,20,.55)', 8); },
      side: (g, w, h) => { RT.bricks(g, w, h, { base: 0x7d8270, joint: '#3d4a2c', rows: 4, cols: 3 }); RT.dots(g, w, h, ['#5f8f3a', '#46702c'], 60, 4, 14, [0.3, 0.7]); },
      bottom: -2.5,
    },
    plat: {
      top: (g, w, h) => RT.planks(g, w, h, { base: 0x9a6b3f, n: 12, gap: '#2b1a0c' }),
      side: (g, w, h) => { RT.fill(g, w, h, '#5e3d21'); RT.dots(g, w, h, ['#3b2412', '#7a5230'], 300, 1, 4); g.fillStyle = '#c9a66b'; g.fillRect(0, h * 0.15, w, 6); },
    },
    side: { y: SY, size: 260, tile: 6, draw: (g, w, h) => { RT.fill(g, w, h, '#3a5426'); RT.dots(g, w, h, ['#2d4320', '#4f6e2d', '#6b5a32', '#7a8a3a', '#26391a'], 1400, 3, 11, [0.35, 0.8], 'leaf'); } },
    pit: { color: 0x2f5d50, y: -1.4, water: true, w: 9 },
    fallY: -1.0,
    props: {
      tree: { u: 0.3, iter: 3, field: 1.1, build(B) {
        B.cyl(0, 0, 0, 40, (y) => 2.5 - y * 0.012 + (y < 7 ? (7 - y) * 0.28 : 0), bark);
        for (let k = 0; k < 5; k++) { const a = k * 1.26 + 0.4; B.bar([Math.cos(a) * 1.8, 7, Math.sin(a) * 1.8], [Math.cos(a) * 6, 0, Math.sin(a) * 6], (t) => 1.5 - t * 0.7, bark); }
        B.bar([0, 28, 0], [7, 37, 2], 1.1, bark); B.bar([0, 30, 0], [-6, 38, -3], 1.0, bark); B.bar([0, 33, 0], [2, 40, -6], 0.9, bark);
        for (const [x, y, z, r] of [[0, 43, 0, 9], [8, 39, 3, 7], [-8, 40, -3, 7.5], [3, 41, -8, 6.5], [-4, 45, 6, 6], [5, 46, -2, 6], [-9, 36, 4, 5], [9, 37, -5, 5]]) B.ell(x, y, z, r, r * 0.58, r, leafC);
        B.paint((v) => (v.y < 14 && v.y > 1 && vxRand(Math.floor(v.x / 1.5), Math.floor(v.y / 2), Math.floor(v.z / 1.5), 11) < 0.32 - v.y * 0.015 && Math.hypot(v.x, v.z) > 1.5 ? rnShade(0x6a9a40, (vxRand(v.x, v.y, v.z) - 0.5) * 0.12) : null));
        return B;
      } },
      trunk: { u: 0.45, iter: 2, field: 0.9, farOnly: true, build(B) {
        B.cyl(0, 0, 0, 34, (y) => 1.9 - y * 0.01, bark);
        for (const [x, y, z, r] of [[0, 36, 0, 6], [4, 33, 2, 4.5], [-4, 34, -2, 4.5]]) B.ell(x, y, z, r, r * 0.55, r, leafC);
        return B;
      } },
      arch: { u: 0.3, iter: 3, field: 1.2, span: true, build(B) {
        // riesiger Ast, der sich über den Weg spannt
        const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, a = Math.PI * t; pts.push([-28 * Math.cos(a), Math.sin(a) * 30 + (t < 0.5 ? 0 : 0), Math.sin(a * 2) * 2]); }
        B.curve(pts, (t) => 2.3 - Math.sin(t * Math.PI) * 0.9, bark);
        for (let i = 2; i <= 14; i += 2) { const [x, y, z] = pts[i]; B.ell(x, y + 2, z, 4.5, 2.8, 4.2, leafC); }
        // Moos und Lianen, die herabhängen (nicht in die Bahn hinein: nur aussen)
        for (const i of [3, 4, 12, 13]) { const [x, y, z] = pts[i]; B.curve([[x, y - 1, z], [x + 0.5, y - 6, z + 0.5], [x, y - 11, z]], 0.5, 0x4a7a2a); }
        return B;
      } },
      canopy: { u: 0.5, iter: 2, field: 1.0, span: true, build(B) {
        for (const [x, y, z, r] of [[0, 0, 0, 7], [6, 1, 3, 5], [-6, 0, -2, 5.5], [2, 1, -6, 4.5], [-3, 1, 6, 4.5]]) B.ell(x, y, z, r, r * 0.42, r, leafC);
        return B;
      } },
      fern: { u: 0.07, iter: 2, field: 0.8, project: false, build(B) {
        for (let k = 0; k < 7; k++) {
          const a = k * 0.9 + rnHash(k, 0, 0, 1) * 0.4, L = 14 + rnHash(k, 1, 0) * 5;
          const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([Math.cos(a) * L * t, Math.sin(t * Math.PI * 0.85) * 9 - t * t * 4, Math.sin(a) * L * t]); }
          B.curve(pts, 0.6, 0x3d7a2c);
          for (let i = 1; i < 6; i++) { const [x, y, z] = pts[i]; const s = 3.6 * (1 - i / 7); for (const sg of [1, -1]) B.bar([x, y, z], [x - Math.sin(a) * s * sg, y - 0.8, z + Math.cos(a) * s * sg], 0.6, rnShade(0x4c9a35, (k % 3) * 0.05 - 0.05)); }
        }
        return B;
      } },
      bigleaf: { u: 0.09, iter: 2, field: 0.9, project: false, build(B) {
        for (let k = 0; k < 6; k++) {
          const a = k * 1.05 + 0.3, tilt = 0.5 + rnHash(k, 2, 0) * 0.4, L = 12 + rnHash(k, 3, 0) * 5;
          const sx = Math.cos(a), sz = Math.sin(a);
          B.bar([0, 0, 0], [sx * L * 0.45, L * 0.8, sz * L * 0.45], 0.7, 0x3a7a2c);
          // grosses Blatt (Ellipse, leicht gewölbt)
          const cx = sx * L * 0.75, cy = L * 0.8 + 2, cz = sz * L * 0.75;
          for (let u = -6; u <= 6; u++) for (let v = -9; v <= 9; v++) {
            if ((u / 6) ** 2 + (v / 9) ** 2 > 1) continue;
            const x = cx + sx * v * 0.8 - sz * u, z = cz + sz * v * 0.8 + sx * u, y = cy + v * Math.sin(tilt) * 0.6 - (u * u) * 0.06;
            B.put(x, y, z, (u === 0 ? 0x8fcf5a : rnShade(0x2f8a3a, (rnHash(u, v, k) - 0.5) * 0.2 - Math.abs(u) * 0.01)));
          }
        }
        return B;
      } },
      flower: { u: 0.07, iter: 3, field: 1.0, build(B) {
        B.ell(0, 7, 0, 10, 7, 10, leafC);
        const cols = [0xff3d6e, 0xff7a1a, 0xff5fa8, 0xffd23f];
        for (let k = 0; k < 14; k++) { const a = k * 2.4, e = 0.2 + (k % 4) * 0.25; rwFlowers(B, [[Math.cos(a) * 9.5 * Math.cos(e), 7 + Math.sin(e) * 6.5, Math.sin(a) * 9.5 * Math.cos(e)]], [cols[k % 4]], 1.7); }
        return B;
      } },
      ruin: { u: 0.12, iter: 2, field: 1.0, build(B) {
        const st = mossy(0x8a8d82);
        B.rbox(-6, 0, -6, 6, 3, 6, st, { p: 6 });
        for (let y = 4; y < 28; y++) { const r = y % 6 === 0 ? 5.2 : 4.4; B.cyl(0, 0, y, y, r, st); }
        B.cut((x, y, z) => y > 22 + ((x * 3 + z * 5) % 5)); // abgebrochen
        B.rbox(-6, 22, -6, 6, 23, 6, st, { keep: (x, y, z) => rnHash(x, y, z, 2) < 0.6 });
        B.curve([[4, 2, 3], [-4, 8, 4], [-4, 14, -4], [4, 20, -3]], 0.6, 0x3f7a2c);
        return B;
      } },
      head: { u: 0.12, iter: 3, field: 1.2, build(B) {
        const st = mossy(0x8b8a7c);
        B.rbox(-7, 0, -6, 7, 20, 6, st, { p: 4 });
        B.rbox(-8, 15, -6, 8, 21, 6, st, { p: 5 }); // Stirn
        // Gesicht vorne (+z): Augen, Nase, Mund eingraben bzw. aufsetzen
        for (const sx of [-4, 4]) B.box(sx - 2, 12, 5, sx + 2, 14, 7, 0x4a4a42);
        B.rbox(-2, 6, 6, 2, 12, 9, st, { p: 3 });
        B.box(-4, 3, 6, 4, 4, 7, 0x4a4a42);
        B.ell(0, 22, 0, 7, 3, 6, leafC); // Blätter auf dem Kopf
        return B;
      } },
      rock: { u: 0.15, iter: 3, field: 1.3, build(B) {
        B.ell(0, 3, 0, 7, 4.5, 6, mossy(0x7f8478), { keep: (x, y, z) => y >= 0 && rnHash(x, y, z, 1) > 0.02 });
        B.ell(4, 2, 3, 4, 3, 4, mossy(0x7f8478), { keep: (x, y) => y >= 0 });
        return B;
      } },
      mushroom: { u: 0.05, iter: 3, field: 1.0, build(B) {
        for (const [x, z, h, r, c] of [[0, 0, 10, 6, 0xd9342b], [7, 3, 6, 4, 0xf08a24], [-5, 5, 5, 3.5, 0xd9342b]]) {
          B.cyl(x, z, 0, h, 1.4, 0xf3ead8);
          B.ell(x, h, z, r, r * 0.55, r, (a, b, cc) => (rnHash(a, b, cc, 3) < 0.12 && b > h ? 0xffffff : c), { keep: (a, b) => b >= h - 1 });
        }
        return B;
      } },
      vine: { u: 0.08, iter: 2, field: 0.8, project: false, build(B) {
        const pts = []; for (let i = 0; i <= 10; i++) pts.push([Math.sin(i * 1.3) * 1.5, -i * 6, Math.cos(i * 0.9) * 1.2]);
        B.curve(pts, 0.65, 0x4f7a2a);
        for (let i = 1; i < 10; i++) { const [x, y, z] = pts[i]; B.ell(x + (i % 2 ? 2 : -2), y, z, 2, 1.1, 1.4, leafC); }
        return B;
      } },
      post: { u: 0.08, iter: 2, field: 0.9, cap: 40, build(B) {
        B.cyl(0, 0, 0, 55, 2.2, bark);
        for (const y of [10, 30, 49]) B.cyl(0, 0, y, y + 1, 2.9, 0xc9a66b);
        B.ell(0, 56, 0, 2.8, 1.5, 2.8, 0x6b4f35);
        return B;
      } },
      rope: { u: 0.06, iter: 1, field: 0.7, project: false, cap: 40, build(B) {
        const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([0, -Math.sin(t * Math.PI) * 5, -t * 66]); }
        B.curve(pts, 0.7, 0xc9a66b);
        return B;
      } },
      lily: { u: 0.06, iter: 2, field: 0.8, project: false, cap: 8, build(B) {
        for (const [x, z, r] of [[0, 0, 8], [12, 6, 6], [-10, 8, 5]]) {
          for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b <= r * r && !(a > 0 && Math.abs(b) < 1.2)) B.put(x + a, 0, z + b, rnShade(0x3f9a3a, (rnHash(a, b, x) - 0.5) * 0.2));
        }
        B.ell(12, 1.5, 6, 2, 1.5, 2, 0xff8ab8); B.put(12, 2.6, 6, 0xffe066);
        return B;
      } },
    },
    obstacles: {
      tall: rwTall({ post: 0x6b4f35, panel: 0xb7c95a, panel2: 0x7d8a34, accent: 0x22d3ee }), roller: rwRoller('barrel', 0x8b5a2b, 0x4f7a2a),
      // umgestürzter Baumstamm (springen)
      low: { u: 0.1, iter: 3, field: 1.1, yt: RN.LOW, cap: 24, build(B) {
        B.tube('x', -8, 8, 0, 3, (a) => 3 - Math.abs(a) * 0.02, bark);
        for (const sx of [-8, 8]) B.cyl(sx, 0, 1, 5, 2.4, 0xc79a62, { sx: 0.4 }); // Schnittflächen
        B.paint((v) => (v.y >= 5 && rnHash(v.x, v.y, v.z, 3) < 0.45 ? rnShade(0x5f8f3a, (rnHash(v.x, v.z, 1) - 0.5) * 0.3) : null));
        B.bar([2, 4, 0], [4, 8, -1], 0.8, bark); B.ell(4, 9, -1, 1.8, 1.4, 1.8, leafC);
        return B;
      } },
      // Bambus-Zaun (springen)
      high: { u: 0.07, iter: 2, field: 0.9, yt: RN.HIGH, cap: 24, build(B) {
        for (let x = -11; x <= 11; x += 4) B.cyl(x, 0, 0, 15 + (x % 8 === 0 ? 1 : 0), 1.3, (xx, y) => (y % 5 === 0 ? 0x8a9a3a : rnShade(0xb7c95a, (rnHash(xx, y, 0) - 0.5) * 0.15)));
        for (const y of [5, 12]) B.tube('x', -12, 12, 0, y, 0.8, 0x9fb04c);
        for (let x = -11; x <= 11; x += 4) for (const y of [5, 12]) B.ell(x, y, 0, 1.6, 0.9, 1.6, 0x8c6b3a); // Seil
        return B;
      } },
      // tiefer Ast (rutschen)
      over: { u: 0.08, iter: 3, field: 1.0, yb: RN.OVER, yt: 3.2, cap: 24, build(B) {
        B.tube('x', -12, 12, 0, 16, 2.3, bark);
        for (const sx of [-12, 12]) { B.cyl(sx, 0, 0, 16, 2.6, mossy(0x7f8478)); }
        for (let x = -9; x <= 9; x += 3) B.curve([[x, 14, 0], [x + 0.5, 12, 0.5], [x, 10.5, 0]], 0.5, 0x4f7a2a);
        B.ell(-4, 19, 0, 4, 2.4, 3, leafC); B.ell(5, 18.5, 0, 3.5, 2.2, 3, leafC);
        return B;
      } },
      // alter Steinblock (ausweichen oder über die Rampe)
      block: { u: 0.15, iter: 2, field: 1.1, yt: RN.BLOCK, top: RN.BLOCK, depth: 0, len: 8, cap: 16, build(B) {
        const st = mossy(0x8c8f84);
        B.rbox(-6, 0, -53, 6, 8, 0, st, { p: 8 });
        // eingemeisselte Zeichen an den Seiten
        B.paint((v) => ((Math.abs(v.x) === 6 || v.z === 0) && v.y >= 2 && v.y <= 6 && ((v.y % 4 === 0 && (v.z % 5 !== 0)) || (v.z % 5 === 0 && v.y % 4 !== 2)) ? 0x5b5f55 : null));
        B.paint((v) => (v.y === 8 ? rnShade(0x9a9d90, (rnHash(v.x, v.z, 2) - 0.5) * 0.15) : null));
        return B;
      } },
      ramp: { u: 0.15, iter: 2, field: 1.0, project: false, yt: RN.BLOCK, ramp: true, depth: 0, len: 4, cap: 12, build(B) {
        const st = mossy(0x8c8f84);
        for (let z = 0; z >= -26; z--) { const h = Math.round(((-z + 1) / 27) * 9) - 1; for (let x = -6; x <= 6; x++) for (let y = 0; y <= h; y++) B.put(x, y, z, st(x, y, z)); }
        return B;
      } },
    },
    gate: { u: 0.08, iter: 2, field: 0.9, labelY: 2.55, border: '#7c4a1d', build(B) {
      for (const sx of [-10, 10]) {
        B.cyl(sx, 0, 0, 37, 1.4, (x, y) => (y % 6 === 0 ? 0x7d8a34 : rnShade(0xb7c95a, (rnHash(x, y, sx) - 0.5) * 0.12)));
        B.curve([[sx, 2, 1.6], [sx + 1.6, 9, 0], [sx, 16, -1.6], [sx - 1.6, 23, 0], [sx, 30, 1.6]], 0.55, 0x3f7a2c);
        rwFlowers(B, [[sx + 1.6, 9, 1], [sx - 1.6, 23, 1], [sx, 16, 2]], [0xff3d6e, 0xffd23f, 0xff7a1a]);
      }
      B.box(-11, 25, -2, 11, 26, -1, 0x7c4a1d);
      B.rbox(-12, 26, -2, 12, 38, -1, 0x8b5a2b, { p: 6 });
      B.ell(0, 39.5, -1, 6, 2, 2, leafC);
      return B;
    } },
    scatter(ctx, d0, d1) {
      const R = RT.rnd, P = ctx.put;
      for (const sg of [-1, 1]) {
        if (Math.random() < 0.9) P('tree', sg * R(5.4, 7.8), SY, R(d0, d1), R(0, 6.3), R(0.85, 1.15));
        P('tree', sg * R(9.5, 17), SY, R(d0, d1), R(0, 6.3), R(0.95, 1.3));
        P('trunk', sg * R(17, 32), SY, R(d0, d1), R(0, 6.3), R(0.9, 1.4));
        for (let k = 0; k < 2; k++) P('fern', sg * R(3.9, 9), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.4));
        if (Math.random() < 0.65) P('bigleaf', sg * R(4.0, 6.5), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.2));
        if (Math.random() < 0.4) P('flower', sg * R(4.2, 7), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.2));
        if (Math.random() < 0.13) P(Math.random() < 0.55 ? 'ruin' : 'head', sg * R(5, 7.5), SY, R(d0, d1), sg > 0 ? -Math.PI / 2 + R(-0.4, 0.4) : Math.PI / 2 + R(-0.4, 0.4), R(0.9, 1.15));
        if (Math.random() < 0.3) P('rock', sg * R(4.2, 9), SY, R(d0, d1), R(0, 6.3), R(0.6, 1.2));
        if (Math.random() < 0.35) P('mushroom', sg * R(3.7, 5.5), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.3));
        if (Math.random() < 0.5) P('vine', sg * R(3.6, 4.6), R(6.0, 8.5), R(d0, d1), R(0, 6.3), R(0.8, 1.1));
      }
      if (Math.floor(d0 / 10) % 2 === 0) P('arch', 0, SY, R(d0 + 1, d1 - 1), R(-0.12, 0.12), R(0.95, 1.1));
      P('canopy', R(-4, 4), R(10.5, 13.5), R(d0, d1), R(0, 6.3), R(0.9, 1.3));
    },
    onPlatform(ctx, d0, d1, H) {
      for (let d = d0 + 2; d < d1; d += 4) for (const sg of [-1, 1]) {
        if (ctx.ground(d) == null) continue;
        ctx.put('post', sg * 3.45, SY, d, 0, 1);
        if (ctx.ground(d + 4) != null) ctx.put('rope', sg * 3.45, H + 1.05, d, 0, 1);
      }
    },
    onGap(ctx, d0, d1) { ctx.put('lily', RT.rnd(-2, 2), SY + 0.07, (d0 + d1) / 2, RT.rnd(0, 6.3), 1); },
    extras(ctx) {
      const { T } = ctx; const scene = ctx.fx;
      // Lichtstrahlen durchs Blätterdach
      const rayTex = rwRayTex(T, '255,250,210', 1);
      const rayMat = new T.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.38, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
      ctx.own.push(rayTex, rayMat);
      const rays = [];
      for (let i = 0; i < 9; i++) { const m = new T.Mesh(new T.PlaneGeometry(2.2, 16), rayMat); m.rotation.set(0, 0, 0.35); ctx.own.push(m.geometry); scene.add(m); rays.push(m); m.userData.d = 20 + i * 12; m.userData.x = RT.rnd(-7, 7); }
      // schwebende Pollen / Glühwürmchen
      const n = 260, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set([RT.rnd(-12, 12), RT.rnd(0, 9), RT.rnd(-80, 10)], i * 3);
      const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pmat = new T.PointsMaterial({ color: 0xfff6b0, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false });
      const pts = new T.Points(pg, pmat); scene.add(pts); ctx.own.push(pg, pmat);
      // Schmetterlinge
      const bTex = rnCanvasTex(T, 64, 64, (g) => { g.fillStyle = '#ff8a3d'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(32 + s * 13, 26, 13, 15, s * 0.4, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(32 + s * 10, 44, 8, 10, -s * 0.4, 0, 6.3); g.fill(); } g.fillStyle = '#3a2412'; g.fillRect(30, 18, 4, 34); }, { repeat: false });
      const bMat = new T.SpriteMaterial({ map: bTex, transparent: true, depthWrite: false }); ctx.own.push(bTex, bMat);
      const bugs = []; for (let i = 0; i < 6; i++) { const s = new T.Sprite(bMat); s.scale.set(0.45, 0.45, 1); scene.add(s); bugs.push({ s, ph: RT.rnd(0, 6), x: RT.rnd(-5, 5), d: RT.rnd(0, 60), y: RT.rnd(1.5, 4) }); }
      ctx.onFrame((dt, S) => {
        for (const m of rays) { if (m.userData.d < S.d + 14) { m.userData.d += 108; m.userData.x = RT.rnd(-7, 7); } m.position.set(m.userData.x, 7, -m.userData.d); m.lookAt(ctx.camera.position.x, 7, ctx.camera.position.z); m.rotateZ(0.35); m.material.opacity = 0.3; }
        const p = pg.attributes.position.array;
        for (let i = 0; i < n; i++) { p[i * 3 + 1] += Math.sin(ctx.time * 0.8 + i) * dt * 0.15; if (p[i * 3 + 2] > -S.d + 8) p[i * 3 + 2] -= 90; }
        pg.attributes.position.needsUpdate = true;
        for (const b of bugs) { if (b.d < S.d - 6) { b.d = S.d + RT.rnd(30, 70); b.x = RT.rnd(-5, 5); } b.ph += dt * 3; b.s.position.set(b.x + Math.sin(b.ph * 0.5) * 1.5, b.y + Math.sin(b.ph) * 0.4, -b.d); b.s.scale.x = 0.45 * Math.abs(Math.sin(b.ph * 6)) + 0.08; }
      });
    },
  };
})();

/* ---------------- Gebäude aus Texturen (für die Stadt): Quader mit Fenstern, UVs in Metern ---------------- */
function rwBox(T, w, h, d, tile = 16) {
  const g = new T.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile); }
  return g;
}
/** mehrere Geometrien zu einer (Gruppen bleiben erhalten, je mit eigener Materialnummer) */
function rwMerge(T, parts) {
  const P = [], N = [], U = [], I = [], groups = [];
  for (const [g, mi] of parts) {
    const gi = g.index ? g : g.toNonIndexed();
    const base = P.length / 3;
    P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); U.push(...g.attributes.uv.array);
    const idx = g.index ? [...g.index.array] : [...Array(g.attributes.position.count).keys()];
    const start = I.length;
    if (g.groups.length && mi == null) for (const gr of g.groups) { groups.push([start + gr.start, gr.count, gr.materialIndex]); }
    else groups.push([start, idx.length, mi ?? 0]);
    idx.forEach((x) => I.push(x + base));
    if (gi !== g) gi.dispose();
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(N, 3)); out.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
  out.setIndex(I);
  groups.sort((a, b) => a[0] - b[0]).forEach(([st, c, m]) => out.addGroup(st, c, m));
  out.computeBoundingSphere();
  return out;
}
/** Fassade (16 × 16 m): Fenster in Reihen, manche beleuchtet (leuchten in der Abendsonne) */
function rwFacade(T, { wall, frame = '#e8e2d6', glass = '#3d5a80', lit = 0.3, cols = 6, rows = 5, style = 'win' }) {
  const w = 512, h = 512;
  const litMask = [];
  const map = rnCanvasTex(T, w, h, (g) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    RT.dots(g, w, h, ['rgba(0,0,0,.25)', 'rgba(255,255,255,.2)'], 500, 0.6, 2, [0.1, 0.3]);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      if (style !== 'glass') { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, r * rh + rh - 6, w, 4); }
      for (let c = 0; c < cols; c++) {
        const on = Math.random() < lit;
        litMask.push(on);
        const x = c * cw, y = r * rh;
        if (style === 'glass') {
          g.fillStyle = on ? '#ffd98a' : RT.mix(parseInt(glass.slice(1), 16), RT.rnd(-0.12, 0.15)); g.fillRect(x + 2, y + 2, cw - 4, rh - 4);
          g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 2, y + 2, cw - 4, 5);
        } else {
          g.fillStyle = frame; g.fillRect(x + cw * 0.2 - 3, y + rh * 0.18 - 3, cw * 0.6 + 6, rh * 0.62 + 6);
          g.fillStyle = on ? '#ffd98a' : RT.mix(parseInt(glass.slice(1), 16), RT.rnd(-0.1, 0.12)); g.fillRect(x + cw * 0.2, y + rh * 0.18, cw * 0.6, rh * 0.62);
          g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + cw * 0.2, y + rh * 0.18, cw * 0.6, 4);
          g.fillStyle = frame; g.fillRect(x + cw * 0.5 - 1.5, y + rh * 0.18, 3, rh * 0.62);
        }
      }
    }
  });
  let k = 0;
  const em = rnCanvasTex(T, w, h, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (!litMask[k++]) continue;
      g.fillStyle = '#ffcf7a';
      if (style === 'glass') g.fillRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4); else g.fillRect(c * cw + cw * 0.2, r * rh + rh * 0.18, cw * 0.6, rh * 0.62);
    }
  });
  return new T.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: style === 'glass' ? 0.25 : 0.8, metalness: style === 'glass' ? 0.3 : 0 });
}
function rwRoofMat(T, base = '#8e8a84') {
  const map = rnCanvasTex(T, 256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); RT.dots(g, w, h, ['#6e6a64', '#b4afa6', '#5a5650'], 1600, 0.6, 2.2, [0.3, 0.8]); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); });
  return new T.MeshStandardMaterial({ map, roughness: 0.95 });
}

/* =========================================================
   🏙️ Über den Dächern (Abendsonne)
   ========================================================= */
const RW_ROOFS = (() => {
  const metal = (c) => rwPatch(c, 0.06, 4, 3);
  const bld = (w, h, d, fac) => ({ mesh: (T) => { const f = rwFacade(T, fac), r = rwRoofMat(T); return { geo: rwBox(T, w, h, d), mat: [f, f, r, r, f, f] }; }, h });
  const B_A = bld(12, 46, 12, { wall: '#d9c7a7', frame: '#f3ece0', glass: '#41607f', lit: 0.32 });
  const B_B = bld(10, 62, 10, { wall: '#2d4a6b', glass: '#3a6ea5', lit: 0.25, style: 'glass', cols: 8, rows: 8 });
  const B_C = bld(9, 38, 11, { wall: '#a5523e', frame: '#efe3d0', glass: '#38506b', lit: 0.35 });
  const B_D = bld(15, 52, 13, { wall: '#eef0f2', frame: '#c9ced6', glass: '#4b6d90', lit: 0.28, cols: 8 });
  const BLD = { bldA: B_A, bldB: B_B, bldC: B_C, bldD: B_D };
  const signMesh = (text, bg, fg) => ({ mesh: (T) => {
    const tex = rnCanvasTex(T, 512, 256, (g, w, h) => {
      g.fillStyle = bg; rnRound(g, 6, 6, w - 12, h - 12, 30); g.fill();
      g.strokeStyle = fg; g.lineWidth = 10; rnRound(g, 22, 22, w - 44, h - 44, 22); g.stroke();
      g.fillStyle = fg; g.font = '900 120px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = fg; g.shadowBlur = 24; g.fillText(text, w / 2, h / 2 + 8);
    }, { repeat: false });
    const panel = new T.BoxGeometry(3.2, 1.6, 0.18); panel.translate(0, 3.4, 0);
    const legs = [new T.BoxGeometry(0.12, 3.0, 0.12), new T.BoxGeometry(0.12, 3.0, 0.12)]; legs[0].translate(-1.2, 1.5, -0.05); legs[1].translate(1.2, 1.5, -0.05);
    const geo = rwMerge(T, [[panel, null], [legs[0], 6], [legs[1], 6]]);
    const front = new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6 });
    const dark = new T.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.7, metalness: 0.4 });
    return { geo, mat: [dark, dark, dark, dark, front, dark, dark] };
  } });
  return {
    id: 'roofs', name: 'Über den Dächern', emoji: '🏙️', desc: 'Von Hochhaus zu Hochhaus in der Abendsonne',
    sky: ['#4a6fc9', '#f39a6b', '#ffd8a0'], fog: 0xf2b58c, fogNear: 34, fogFar: 140,
    hemi: [0xffe6cc, 0x5b4a6e, 1.05], sun: [0xffbf80, 2.6], sunDir: [-0.55, 0.42, -0.5], env: 0.85, exposure: 1.0,
    gem: 0xff7ad9, edge: 1.6, gapsOften: true,
    ground: {
      top: (g, w, h) => { RT.fill(g, w, h, '#9b968d'); RT.dots(g, w, h, ['#7d7870', '#b9b3a8', '#6a655e'], 2600, 0.6, 2, [0.3, 0.8]); RT.dots(g, w, h, ['rgba(40,40,40,.25)'], 14, 18, 40, [0.15, 0.3]); g.fillStyle = '#cfcac0'; for (const u of [0.25, 0.75]) g.fillRect(u * w - 4, 0, 8, h); g.fillStyle = 'rgba(0,0,0,.25)'; for (const u of [0.25, 0.75]) g.fillRect(u * w + 4, 0, 2, h); },
      side: (g, w, h) => { RT.fill(g, w, h, '#d9c7a7'); g.fillStyle = '#f3ece0'; g.fillRect(w * 0.25 - 4, h * 0.2 - 4, w * 0.5 + 8, h * 0.5 + 8); g.fillStyle = Math.random() < 0.5 ? '#ffd98a' : '#41607f'; g.fillRect(w * 0.25, h * 0.2, w * 0.5, h * 0.5); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, h - 10, w, 6); },
      bottom: -18, rough: 0.95,
    },
    plat: {
      top: (g, w, h) => RT.planks(g, w, h, { base: 0xb07a4a, n: 14, gap: '#3b2616' }),
      side: (g, w, h) => RT.bricks(g, w, h, { base: 0xa5523e, joint: '#d8c9b8', rows: 8, cols: 4 }),
    },
    pit: { color: 0x3a3550, y: -26, w: 600 },
    fallY: -2,
    props: {
      ...BLD,
      signA: signMesh('PIZZA', '#1d1b33', '#ffcc33'), signB: signMesh('KINO', '#1d1b33', '#ff4fa3'), signC: signMesh('★ HOTEL ★', '#1d1b33', '#4fe3ff'),
      parapet: { u: 0.1, iter: 2, field: 0.9, lod: false, build(B) { B.rbox(-1, 0, -19, 1, 4, 20, rwPatch(0xcfc6b8, 0.05, 6), { p: 8 }); B.box(-2, 4, -19, 2, 5, 20, 0xe9e2d6); return B; } },
      ac: { u: 0.08, iter: 2, field: 1.0, build(B) {
        B.rbox(-8, 0, -6, 8, 11, 6, metal(0xd5d9de), { mat: 1, p: 8 });
        B.cyl(-3, 0, 11, 12, 4, 0x3a3f47, { mat: 3 }); B.cyl(-3, 0, 12, 12, 1, 0x9aa0a8);
        for (let x = 2; x <= 7; x++) if (x % 2 === 0) B.box(x, 2, 6, x, 9, 7, 0x8b9199);
        return B;
      } },
      tank: { u: 0.12, iter: 3, field: 1.1, build(B) {
        for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) B.cyl(x, z, 0, 14, 0.8, 0x5b4636);
        B.box(-7, 14, -7, 7, 15, 7, 0x6b5240);
        B.cyl(0, 0, 16, 32, 7, (x, y, z) => (y % 5 === 0 ? 0x3d3d3d : rwPatch(0x9b6b43, 0.08, 2)(x, y, z)));
        B.cyl(0, 0, 33, 38, (y) => 7.5 - (y - 33) * 1.4, 0x5f4a3a);
        return B;
      } },
      antenna: { u: 0.06, iter: 1, field: 0.8, project: false, build(B) {
        B.cyl(0, 0, 0, 60, 0.9, 0xb8bec6, { mat: 3 });
        for (const y of [20, 35, 48]) B.tube('x', -6, 6, 0, y, 0.6, 0xb8bec6, { mat: 3 });
        B.ell(0, 61, 0, 1.5, 1.5, 1.5, 0xff3b3b, { mat: 2 });
        // Satellitenschüssel
        for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) if (a * a + b * b <= 36) B.put(a + 3, 26 + b, Math.round((a * a + b * b) / 12) + 2, 0xeef0f3, 1);
        return B;
      } },
      chimney: { u: 0.1, iter: 2, field: 1.0, build(B) { B.box(-4, 0, -4, 4, 20, 4, (x, y) => (y % 3 === 0 ? 0xd8c9b8 : rwPatch(0xa5523e, 0.08, 2)(x, y, 0))); B.box(-5, 20, -5, 5, 22, 5, 0x6b6b6b); B.box(-2, 22, -2, 2, 24, 2, 0x4a4a4a); return B; } },
      plant: { u: 0.07, iter: 3, field: 1.1, build(B) { B.rbox(-6, 0, -6, 6, 8, 6, 0xc46a3a, { p: 6 }); B.box(-5, 8, -5, 5, 8, 5, 0x5a3a22); B.cyl(0, 0, 9, 20, 0.9, 0x6b4f35); B.ell(0, 25, 0, 8, 7, 8, rwPatch(0x4d9a3a, 0.12, 2)); return B; } },
      solar: { u: 0.08, iter: 1, field: 0.8, build(B) { for (let z = -12; z <= 12; z++) for (let x = -10; x <= 10; x++) B.put(x, 6 + Math.round(z * 0.35), z, (x % 5 === 0 || z % 6 === 0) ? 0xc9ced6 : 0x1e3a6e, 1); B.box(-9, 0, 10, -8, 10, 11, 0x9aa0a8); B.box(8, 0, 10, 9, 10, 11, 0x9aa0a8); return B; } },
      pigeon: { u: 0.03, iter: 3, field: 1.2, build(B) { B.ell(0, 5, 0, 4, 3.5, 6, 0x8e96a3); B.ell(0, 9, -5, 2.6, 2.6, 2.6, 0x6f7887); B.put(0, 9, -8, 0xf2a33a); B.ell(0, 5, 6, 2, 1.2, 3, 0x5c6470); B.put(-1, 10, -7, 0x111111); B.put(1, 10, -7, 0x111111); B.box(-1, 0, 0, -1, 2, 0, 0xe58a6a); B.box(1, 0, 0, 1, 2, 0, 0xe58a6a); return B; } },
      lamp: { u: 0.07, iter: 2, field: 0.9, cap: 12, build(B) { B.cyl(0, 0, 0, 72, 1.1, 0x2f3440, { mat: 3 }); B.ell(0, 74, 0, 2.5, 2.5, 2.5, 0xfff1b8, { mat: 2 }); return B; } },
      lights: { u: 0.06, iter: 1, field: 0.7, project: false, lod: false, cap: 8, span: true, build(B) {
        const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([-75 + t * 150, -Math.sin(t * Math.PI) * 9, 0]); }
        B.curve(pts, 0.4, 0x222222);
        for (let i = 1; i < 16; i++) { const [x, y] = pts[i]; B.ell(x + 4, y - 2, 0, 1.4, 1.8, 1.4, [0xffd36b, 0xff6b9a, 0x6bd8ff, 0x9bff6b][i % 4], { mat: 2 }); }
        return B;
      } },
    },
    obstacles: {
      tall: rwTall({ post: 0x2f3440, panel: 0xfacc15, panel2: 0x1f2430, accent: 0xff3da8 }), roller: rwRoller('spool', 0xf97316, 0x7c4a1c),
      low: { u: 0.1, iter: 2, field: 1.0, yt: RN.LOW, cap: 24, build(B) {
        B.tube('x', -8, 8, 0, 3, 2.9, metal(0xb7bcc4), { mat: 3 });
        for (const x of [-8, -3, 3, 8]) B.tube('x', x, x, 0, 3, 3.4, 0x8c939c, { mat: 3 });
        B.box(-6, 0, -1, -5, 1, 1, 0x555b63); B.box(5, 0, -1, 6, 1, 1, 0x555b63);
        return B;
      } },
      high: { u: 0.07, iter: 2, field: 1.0, yt: RN.HIGH, cap: 24, build(B) {
        B.rbox(-12, 0, -5, 12, 14, 5, metal(0xdfe3e8), { mat: 1, p: 9 });
        for (const cx of [-6, 6]) { B.cyl(cx, 0, 14, 15, 5, 0x3a3f47, { mat: 3 }); B.cyl(cx, 0, 15, 15, 1.2, 0x9aa0a8); }
        for (let y = 2; y <= 11; y += 2) B.box(-10, y, 5, 10, y, 6, 0xa9afb7);
        return B;
      } },
      over: { u: 0.08, iter: 2, field: 0.9, yb: RN.OVER, yt: 3.2, cap: 24, build(B) {
        for (const sx of [-11, 11]) B.cyl(sx, 0, 0, 24, 1.1, 0x5f6670, { mat: 3 });
        B.tube('x', -12, 12, 0, 15, 2, metal(0xc8763c), { mat: 3 });
        B.tube('x', -12, 12, 0, 20, 1.6, metal(0x9aa0a8), { mat: 3 });
        B.box(-12, 23, -1, 12, 24, 1, 0x5f6670);
        return B;
      } },
      block: { u: 0.15, iter: 2, field: 1.0, yt: RN.BLOCK, top: RN.BLOCK, depth: 0, len: 8, cap: 16, build(B) {
        B.box(-6, 0, -53, 6, 8, 0, (x, y, z) => ((y % 3 === 0 && y < 7) ? 0xd8c9b8 : rwPatch(0xb5614a, 0.07, 3)(x, y, z)));
        B.box(-6, 8, -53, 6, 8, 0, rwPatch(0x8e8a84, 0.06, 3));
        B.box(-3, 0, 0, 3, 6, 1, 0x4a5563); B.put(2, 3, 1, 0xd4af37, 3); // Klappe
        B.box(-7, 7, -54, 7, 7, 1, 0xe5ddd0);
        return B;
      } },
      ramp: { u: 0.15, iter: 1, field: 0.9, project: false, yt: RN.BLOCK, ramp: true, depth: 0, len: 4, cap: 12, build(B) {
        for (let z = 0; z >= -26; z--) { const h = Math.round(((-z + 1) / 27) * 9) - 1; for (let x = -6; x <= 6; x++) { B.put(x, h, z, (z % 3 === 0) ? 0x7a5230 : rwPatch(0xb07a4a, 0.08, 2)(x, h, z)); if (Math.abs(x) === 6) for (let y = 0; y < h; y++) B.put(x, y, z, 0x6b4a2c); } }
        return B;
      } },
    },
    gate: { u: 0.08, iter: 2, field: 0.9, labelY: 2.55, border: '#ff3da8', build(B) {
      for (const sx of [-10, 10]) { B.box(sx - 1, 0, -1, sx + 1, 37, 1, 0x2b2d42, 3); B.box(sx + (sx < 0 ? 2 : -2), 0, 0, sx + (sx < 0 ? 2 : -2), 24, 0, sx < 0 ? 0xff3da8 : 0x2de2e6, 2); }
      B.box(-12, 25, -2, 12, 38, -1, 0x1d1f3a, 1);
      for (let x = -12; x <= 12; x++) { B.put(x, 39, -1, x % 2 ? 0xff3da8 : 0x2de2e6, 2); }
      return B;
    } },
    scatter(ctx, d0, d1) {
      const R = RT.rnd, P = ctx.put;
      const g = (d, lat = 3) => ctx.ground(d, lat);
      for (const sg of [-1, 1]) {
        // Nachbarhäuser (Dächer tiefer oder höher), dahinter die Skyline
        const kinds = ['bldA', 'bldB', 'bldC', 'bldD'];
        if (Math.random() < 0.75) { const k = kinds[Math.floor(Math.random() * 4)], top = R(-9, 2), x = sg * R(13, 18), d = R(d0, d1); P(k, x, top - BLD[k].h, d, 0, 1); if (top < 0.5 && Math.random() < 0.7) P(Math.random() < 0.5 ? 'tank' : 'ac', x + R(-3, 3), top, d + R(-3, 3), R(0, 6.3), 1); }
        { const k = kinds[Math.floor(Math.random() * 4)]; P(k, sg * R(26, 44), R(-4, 16) - BLD[k].h, R(d0, d1), 0, 1); }
        { const k = kinds[Math.floor(Math.random() * 4)]; P(k, sg * R(55, 120), R(8, 40) - BLD[k].h, R(d0, d1), 0, R(1, 1.6)); }
        // auf dem eigenen Dach: Brüstung und Dinge am Rand
        for (let d = Math.ceil(d0 / 4) * 4; d < d1; d += 4) if (g(d, sg * 3) === 0 && g(d + 2, sg * 3) === 0 && g(d - 2, sg * 3) === 0) P('parapet', sg * 4.75, 0, d, 0, 1);
        const dd = R(d0, d1);
        if (g(dd, sg * 3) === 0 && Math.random() < 0.55) {
          const k = ['ac', 'ac', 'antenna', 'chimney', 'plant', 'solar', 'tank'][Math.floor(Math.random() * 7)];
          P(k, sg * R(3.9, 4.3), 0, dd, k === 'solar' ? (sg > 0 ? -Math.PI / 2 : Math.PI / 2) : R(0, 6.3), k === 'tank' ? 0.55 : 1);
        }
        if (Math.random() < 0.25 && g(dd + 2, sg * 3) === 0) P('pigeon', sg * 4.75, 0.55, dd + 2, R(0, 6.3), 1);
      }
      const ds = R(d0, d1);
      if (Math.random() < 0.18 && g(ds, 3) === 0 && g(ds, -3) === 0) P(['signA', 'signB', 'signC'][Math.floor(Math.random() * 3)], (Math.random() < 0.5 ? -1 : 1) * 4.1, 0, ds, 0, 1);
      if (Math.floor(d0 / 10) % 3 === 0 && g(d0 + 5, 3) === 0 && g(d0 + 5, -3) === 0) { P('lamp', -4.4, 0, d0 + 5, 0, 1); P('lamp', 4.4, 0, d0 + 5, 0, 1); P('lights', 0, 5.3, d0 + 5, 0, 1); }
    },
    onPlatform(ctx, d0, d1, H) { for (let d = d0 + 8; d < d1 - 2; d += 4) if (ctx.ground(d) === H && ctx.ground(d + 2) === H && ctx.ground(d - 2) === H) for (const sg of [-1, 1]) ctx.put('parapet', sg * 4.75, H, d, 0, 1); },
    extras(ctx) {
      const { T } = ctx; const scene = ctx.fx;
      // tiefe Sonne mit Schein
      const sunTex = rnGlowTex(T, 'rgba(255,240,200,1)', 'rgba(255,170,100,0)');
      const sunS = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
      sunS.scale.set(90, 90, 1); scene.add(sunS); ctx.own.push(sunTex, sunS.material);
      // Wolken
      const cTex = rnCanvasTex(T, 256, 128, (g, w) => { for (let i = 0; i < 12; i++) { const x = 40 + Math.random() * (w - 80), y = 50 + Math.random() * 40, r = 22 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,214,196,.95)'); gr.addColorStop(1, 'rgba(255,214,196,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }, { repeat: false });
      const cMat = new T.SpriteMaterial({ map: cTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }); ctx.own.push(cTex, cMat);
      const clouds = []; for (let i = 0; i < 10; i++) { const s = new T.Sprite(cMat); s.scale.set(RT.rnd(60, 110), RT.rnd(25, 40), 1); scene.add(s); clouds.push({ s, x: RT.rnd(-200, 200), y: RT.rnd(40, 90), d: RT.rnd(80, 260) }); }
      // Vögel
      const bTex = rnCanvasTex(T, 64, 32, (g) => { g.strokeStyle = '#3a2c3a'; g.lineWidth = 4; g.beginPath(); g.moveTo(4, 20); g.quadraticCurveTo(18, 4, 32, 18); g.quadraticCurveTo(46, 4, 60, 20); g.stroke(); }, { repeat: false });
      const bMat = new T.SpriteMaterial({ map: bTex, transparent: true, depthWrite: false }); ctx.own.push(bTex, bMat);
      const birds = []; for (let i = 0; i < 7; i++) { const s = new T.Sprite(bMat); s.scale.set(1.2, 0.6, 1); scene.add(s); birds.push({ s, x: RT.rnd(-20, 20), y: RT.rnd(8, 16), d: RT.rnd(20, 100), v: RT.rnd(2, 4), ph: RT.rnd(0, 6) }); }
      ctx.onFrame((dt, S) => {
        sunS.position.set(ctx.camera.position.x - 110, 32, -S.d - 160);
        for (const c of clouds) c.s.position.set(c.x, c.y, -S.d - c.d);
        for (const b of birds) { b.x += b.v * dt; if (b.x > 30 || b.d < S.d - 10) { b.x = -30; b.d = S.d + RT.rnd(30, 110); } b.ph += dt * 8; b.s.position.set(b.x, b.y + Math.sin(b.ph * 0.3), -b.d); b.s.scale.y = 0.6 * (0.6 + Math.abs(Math.sin(b.ph)) * 0.4); }
      });
    },
  };
})();

/* =========================================================
   🏜️ Wüste
   ========================================================= */
const RW_DESERT = (() => {
  const SY = -0.35;
  const sand = (x, y, z) => rnShade(0xe8c07a, (vxRand(Math.floor(x / 3), Math.floor(y / 2), Math.floor(z / 3), 4) - 0.5) * 0.12);
  const stone = (c = 0xd7a86e) => (x, y, z) => rnShade(c, (vxRand(Math.floor(x / 2), Math.floor(y / 2), Math.floor(z / 2), 2) - 0.5) * 0.16 + (y % 4 === 0 ? -0.06 : 0));
  const cliffC = (x, y, z) => rnShade([0xc8764a, 0xd98f5a, 0xb9653f, 0xe0a36a][Math.floor(((y + Math.floor(vxRand(Math.floor(x / 6), 0, Math.floor(z / 6), 1) * 3)) / 3)) % 4], (vxRand(Math.floor(x / 2), y, Math.floor(z / 2), 3) - 0.5) * 0.1);
  const cactus = (x, y, z) => rnShade(0x4f8a3c, ((x + z) % 3 === 0 ? -0.12 : 0) + (vxRand(x, Math.floor(y / 3), z) - 0.5) * 0.08);
  return {
    id: 'desert', name: 'Wüste', emoji: '🏜️', desc: 'Durch Dünen, Schluchten und alte Ruinen',
    sky: ['#3d8fd6', '#8cc9ef', '#f6e2b4'], fog: 0xf0d9aa, fogNear: 38, fogFar: 140,
    hemi: [0xfff3dc, 0xc9995a, 1.1], sun: [0xfff0cc, 2.9], sunDir: [-0.45, 1, 0.3], env: 0.8, exposure: 1.0,
    gem: 0x5ef0ff,
    ground: {
      top: (g, w, h) => { RT.slabs(g, w, h, { base: 0xd9b07a, vary: 0.08, joint: '#a87a48', rows: [2, 3] }); RT.dots(g, w, h, ['#e8c789', '#f0d49c'], 90, 8, 30, [0.25, 0.55]); RT.lanes(g, w, h, 'rgba(120,80,40,.5)', 7); },
      side: (g, w, h) => RT.bricks(g, w, h, { base: 0xcf9f66, joint: '#9c7044', rows: 4, cols: 3 }),
      bottom: -2,
    },
    plat: {
      top: (g, w, h) => { RT.slabs(g, w, h, { base: 0xc99a62, vary: 0.07, joint: '#8a6238', rows: [3, 5] }); },
      side: (g, w, h) => { RT.bricks(g, w, h, { base: 0xc58f58, joint: '#8a6238', rows: 5, cols: 3 }); g.fillStyle = 'rgba(40,140,150,.6)'; g.fillRect(0, h * 0.12, w, 10); },
    },
    side: { y: SY, size: 300, tile: 8, draw: (g, w, h) => { RT.fill(g, w, h, '#e6c07e'); g.strokeStyle = 'rgba(170,120,60,.25)'; g.lineWidth = 3; for (let y = 6; y < h; y += 16) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 26 + y) * 4); g.stroke(); } RT.dots(g, w, h, ['#f3d79c', '#c99a5a'], 500, 1, 3, [0.2, 0.5]); } },
    pit: { color: 0x3b2618, y: -9, w: 12 },
    fallY: -1.2,
    props: {
      dune: { u: 0.9, iter: 3, field: 1.6, farOnly: true, build(B) { B.ell(0, 0, 0, 22, 9, 14, sand, { keep: (x, y) => y >= 0 }); B.ell(10, 0, 5, 14, 6, 10, sand, { keep: (x, y) => y >= 0 }); return B; } },
      cliff: { u: 0.5, iter: 2, field: 1.2, build(B) {
        for (let z = -20; z <= 20; z++) { const h = 22 + Math.round(Math.sin(z * 0.3) * 3 + vxRand(0, 0, Math.floor(z / 4)) * 4); for (let y = 0; y <= h; y++) { const w = 6 - Math.max(0, y - h + 4) + Math.round(Math.sin(y * 0.7 + z * 0.2)); for (let x = -w; x <= w; x++) B.put(x, y, z, cliffC(x, y, z)); } }
        return B;
      } },
      saguaro: { u: 0.1, iter: 3, field: 1.1, build(B) {
        B.cyl(0, 0, 0, 36, 2.6, cactus); B.ell(0, 36, 0, 2.6, 2.2, 2.6, cactus);
        B.curve([[2, 14, 0], [8, 15, 0], [8, 26, 0]], 1.8, cactus); B.ell(8, 26, 0, 1.8, 1.5, 1.8, cactus);
        B.curve([[-2, 20, 0], [-7, 21, 0], [-7, 29, 0]], 1.6, cactus); B.ell(-7, 29, 0, 1.6, 1.4, 1.6, cactus);
        B.put(0, 39, 0, 0xffe066); B.put(1, 38, 1, 0xff6b9a);
        return B;
      } },
      barrel: { u: 0.06, iter: 3, field: 1.1, build(B) { B.ell(0, 6, 0, 7, 7, 7, (x, y, z) => (Math.round(Math.atan2(z, x) * 4) % 2 ? 0x5d9a45 : 0x4a8236), { keep: (x, y) => y >= 0 }); for (let k = 0; k < 5; k++) { const a = k * 1.25; B.ell(Math.cos(a) * 2, 13, Math.sin(a) * 2, 1.4, 1, 1.4, 0xff5fa8); } B.put(0, 14, 0, 0xffe066); return B; } },
      palm: { u: 0.1, iter: 3, field: 1.0, project: false, build(B) {
        const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.sin(t * 1.4) * 8, t * 52, 0]); }
        B.curve(pts, (t) => 2.1 - t * 0.6, (x, y, z) => (y % 4 === 0 ? 0x8a6a42 : 0xa37f52));
        const [tx, ty] = pts[8];
        for (let k = 0; k < 8; k++) { const a = k * 0.785; const f = []; for (let i = 0; i <= 5; i++) { const t = i / 5; f.push([tx + Math.cos(a) * 16 * t, ty + Math.sin(t * Math.PI * 0.8) * 4 - t * t * 9, Math.sin(a) * 16 * t]); } B.curve(f, (t) => 1.6 - t * 0.9, (x, y, z) => rnShade(0x4c9a3a, (vxRand(x, y, z) - 0.5) * 0.15)); }
        for (const [x, z] of [[1, 1], [-1, 1], [0, -1]]) B.ell(tx + x, ty - 2, z, 1.3, 1.3, 1.3, 0x8a4a1f);
        return B;
      } },
      arch: { u: 0.4, iter: 3, field: 1.3, cap: 4, span: true, build(B) {
        const st = cliffC;
        for (let a = 0; a <= 180; a += 3) { const r = a * Math.PI / 180, cx = -Math.cos(r) * 22, cy = Math.sin(r) * 21; const k = a > 50 && a < 130 ? 5 : 6.5 + Math.abs(90 - a) * 0.02; B.ell(cx, cy, 0, k, k, 6, st, { keep: (x, y) => y >= 0 }); }
        B.ell(-22, 0, 0, 8.5, 9, 7.5, st, { keep: (x, y) => y >= 0 }); B.ell(22, 0, 0, 8.5, 9, 7.5, st, { keep: (x, y) => y >= 0 });
        return B;
      } },
      pillar: { u: 0.12, iter: 2, field: 1.0, build(B) {
        const st = stone();
        B.box(-6, 0, -6, 6, 3, 6, st);
        for (let y = 4; y < 34; y++) B.cyl(0, 0, y, y, y % 7 === 0 ? 5 : 4.3, st);
        B.box(-6, 34, -6, 6, 37, 6, st);
        B.cut((x, y, z) => y > 30 && x + z > 4);
        B.paint((v) => (v.y > 10 && v.y < 28 && v.y % 7 === 3 ? 0x2a9d8f : null));
        return B;
      } },
      pyramid: { u: 1.6, iter: 1, field: 0.9, project: false, farOnly: true, build(B) { for (let y = 0; y < 22; y++) { const r = 22 - y; B.box(-r, y, -r, r, y, r, (x, yy, z) => rnShade(0xd8b27a, (yy % 2 ? -0.05 : 0.03) + (vxRand(x, yy, z) - 0.5) * 0.06)); } return B; } },
      camel: { u: 0.06, iter: 3, field: 1.2, build(B) {
        const c = rwPatch(0xc99a5e, 0.05, 3);
        B.ell(0, 14, 0, 6, 5, 12, c); B.ell(0, 20, -2, 4.5, 4, 5, c); // Körper + Höcker
        for (const [x, z] of [[-3, -8], [3, -8], [-3, 8], [3, 8]]) B.cyl(x, z, 0, 12, 1.2, c);
        B.curve([[0, 15, -11], [0, 22, -15], [0, 25, -17]], 2, c); B.ell(0, 25, -20, 2.4, 2.2, 4, c);
        B.put(-2, 27, -21, 0x222222); B.put(2, 27, -21, 0x222222);
        B.box(-5, 18, -4, 5, 19, 6, (x, y, z) => ((x + z) % 3 ? 0xd94f3d : 0x2a6fd6)); // Decke
        return B;
      } },
      tent: { u: 0.12, iter: 2, field: 1.0, build(B) {
        for (let z = -14; z <= 14; z++) for (let x = -14; x <= 14; x++) { const h = Math.round(16 - Math.abs(x) * 0.9); for (let y = Math.max(1, h - 2); y <= h; y++) B.put(x, y, z, (Math.floor((x + 20) / 3) % 2) ? 0xe85d3a : 0xf3e6cf); }
        for (const x of [-14, 14]) for (let y = 0; y < 4; y++) for (let z = -14; z <= 14; z++) B.put(x, y, z, 0xd9c7a7);
        B.cyl(0, -15, 0, 18, 0.8, 0x6b4a2c); B.cyl(0, 15, 0, 18, 0.8, 0x6b4a2c);
        return B;
      } },
      pots: { u: 0.05, iter: 3, field: 1.2, build(B) { for (const [x, z, h, r, c] of [[0, 0, 14, 5, 0xc4693a], [9, 3, 10, 4, 0xb85a2f], [-7, 5, 8, 3.5, 0xd98a52]]) { B.cyl(x, z, 0, h, (y) => r * (0.7 + Math.sin((y / h) * Math.PI) * 0.4), (xx, y) => (y === Math.round(h * 0.6) ? 0x2a9d8f : c)); B.cyl(x, z, h, h + 2, r * 0.6, c); } return B; } },
      rocks: { u: 0.2, iter: 3, field: 1.4, build(B) { B.ell(0, 2, 0, 6, 4, 5, stone(0xcf8f5a), { keep: (x, y) => y >= 0 }); B.ell(5, 1, 3, 3.5, 2.5, 3, stone(0xc8764a), { keep: (x, y) => y >= 0 }); return B; } },
      bush: { u: 0.06, iter: 2, field: 0.8, project: false, build(B) { for (let k = 0; k < 14; k++) { const a = k * 2.4, e = 0.3 + (k % 3) * 0.3; B.bar([0, 0, 0], [Math.cos(a) * 9 * Math.cos(e), 3 + Math.sin(e) * 8, Math.sin(a) * 9 * Math.cos(e)], 0.6, k % 2 ? 0x9a8a5a : 0x7d8a4a); } return B; } },
    },
    obstacles: {
      tall: rwTall({ post: 0x8a6238, panel: 0xe6c28c, panel2: 0xc8764a, accent: 0x2dd4bf }), roller: rwRoller('ball', 0xb08a52, 0x7a5a32),
      low: { u: 0.1, iter: 3, field: 1.1, yt: RN.LOW, cap: 24, build(B) { B.tube('x', -8, 8, 0, 3, 3, (x, y, z) => (x % 5 === 0 ? 0xc49a62 : stone(0xdcb27a)(x, y, z))); B.ell(-8, 1, 0, 2, 1.5, 2.5, 0xe8c07a); return B; } },
      high: { u: 0.07, iter: 2, field: 1.0, yt: RN.HIGH, cap: 24, build(B) {
        B.box(-12, 0, -3, 12, 14, 3, stone(0xd6a66c));
        for (let x = -10; x <= 10; x += 5) { B.box(x - 1, 4, 3, x + 1, 10, 4, 0x8a5a2b); B.put(x, 11, 4, 0x2a9d8f); } // Zeichen
        B.box(-13, 14, -4, 13, 15, 4, 0xe6c28c);
        return B;
      } },
      over: { u: 0.08, iter: 2, field: 0.9, yb: RN.OVER, yt: 3.2, cap: 24, build(B) {
        for (const sx of [-11, 11]) B.cyl(sx, 0, 0, 24, 1.3, 0x8a6238);
        B.tube('x', -12, 12, 0, 22, 1.4, 0x8a6238);
        // bunte Tücher, die herunterhängen (unten bei 1,05 m)
        for (let x = -10; x <= 10; x++) for (let y = 14; y <= 21; y++) B.put(x, y, 0, [0xe85d3a, 0xf2b134, 0x2a9d8f, 0x7b3fa0][Math.floor((x + 12) / 6)], 0);
        return B;
      } },
      block: { u: 0.15, iter: 2, field: 1.0, yt: RN.BLOCK, top: RN.BLOCK, depth: 0, len: 8, cap: 16, build(B) {
        B.box(-6, 0, -53, 6, 8, 0, stone(0xd2a06a));
        B.paint((v) => ((Math.abs(v.x) === 6 || v.z === 0) && v.y >= 2 && v.y <= 5 && (v.z % 6 === 0 || v.y === 4) ? 0x9a6a3a : null));
        B.paint((v) => ((Math.abs(v.x) === 6 || v.z === 0) && v.y === 7 ? 0x2a9d8f : null));
        return B;
      } },
      ramp: { u: 0.15, iter: 3, field: 1.4, project: false, yt: RN.BLOCK, ramp: true, depth: 0, len: 4, cap: 12, build(B) {
        for (let z = 0; z >= -26; z--) { const h = Math.round(((-z + 1) / 27) * 9) - 1; for (let x = -6; x <= 6; x++) for (let y = 0; y <= h; y++) B.put(x, y, z, sand(x, y, z)); }
        return B;
      } },
    },
    gate: { u: 0.08, iter: 2, field: 1.0, labelY: 2.55, border: '#2a9d8f', build(B) {
      const st = stone(0xdcb27a);
      for (const sx of [-10, 10]) { B.box(sx - 2, 0, -2, sx + 2, 38, 2, st); for (let y = 4; y < 36; y += 8) B.box(sx - 2, y, 2, sx + 2, y + 1, 3, 0x2a9d8f); B.ell(sx, 40, 0, 2.5, 2, 2.5, 0xd4af37, { mat: 3 }); }
      B.box(-12, 25, -2, 12, 38, -1, st);
      B.box(-12, 38, -2, 12, 39, 1, 0xd4af37, 3);
      return B;
    } },
    scatter(ctx, d0, d1) {
      const R = RT.rnd, P = ctx.put;
      const canyon = Math.floor(d0 / 80) % 2 === 1;
      for (const sg of [-1, 1]) {
        if (canyon) P('cliff', sg * R(9.5, 11), SY, (d0 + d1) / 2 + R(-2, 2), R(-0.1, 0.1), R(0.9, 1.15));
        else {
          P('dune', sg * R(18, 40), SY - 0.5, R(d0, d1), R(0, 6.3), R(0.7, 1.3));
          if (Math.random() < 0.5) P('saguaro', sg * R(5, 12), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.25));
          if (Math.random() < 0.3) P('palm', sg * R(5, 9), SY, R(d0, d1), R(0, 6.3), R(0.85, 1.15));
          if (Math.random() < 0.15) P(Math.random() < 0.5 ? 'camel' : 'tent', sg * R(7, 11), SY, R(d0, d1), sg > 0 ? -Math.PI / 2 : Math.PI / 2, 1);
        }
        if (Math.random() < 0.6) P('barrel', sg * R(4.2, 7), SY, R(d0, d1), R(0, 6.3), R(0.45, 0.7));
        if (Math.random() < 0.6) P('bush', sg * R(4, 8), SY, R(d0, d1), R(0, 6.3), R(0.7, 1.3));
        if (Math.random() < 0.35) P('rocks', sg * R(4.5, 9), SY, R(d0, d1), R(0, 6.3), R(0.6, 1.2));
        if (Math.random() < 0.18) P('pillar', sg * R(4.6, 6.5), SY, R(d0, d1), R(0, 6.3), R(0.9, 1.1));
        if (Math.random() < 0.2) P('pots', sg * R(4, 5.5), SY, R(d0, d1), R(0, 6.3), 1);
        if (Math.random() < 0.25) P('pyramid', sg * R(70, 130), SY - 1, R(d0, d1), 0, R(0.8, 1.4));
      }
      if (Math.floor(d0 / 10) % 9 === 4) P('arch', 0, SY, (d0 + d1) / 2, 0, 1);
    },
    extras(ctx) {
      const { T } = ctx; const scene = ctx.fx;
      const sunTex = rnGlowTex(T, 'rgba(255,255,240,1)', 'rgba(255,240,200,0)');
      const sunS = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false })); sunS.scale.set(60, 60, 1); scene.add(sunS); ctx.own.push(sunTex, sunS.material);
      const n = 200, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set([RT.rnd(-15, 15), RT.rnd(0, 3), RT.rnd(-60, 10)], i * 3);
      const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pm = new T.PointsMaterial({ color: 0xf6dca6, size: 0.06, transparent: true, opacity: 0.8, depthWrite: false }); scene.add(new T.Points(pg, pm)); ctx.own.push(pg, pm);
      const vTex = rnCanvasTex(T, 64, 32, (g) => { g.strokeStyle = '#3a2a22'; g.lineWidth = 5; g.beginPath(); g.moveTo(2, 22); g.quadraticCurveTo(18, 2, 32, 16); g.quadraticCurveTo(46, 2, 62, 22); g.stroke(); }, { repeat: false });
      const vMat = new T.SpriteMaterial({ map: vTex, transparent: true, depthWrite: false }); ctx.own.push(vTex, vMat);
      const birds = []; for (let i = 0; i < 4; i++) { const s = new T.Sprite(vMat); s.scale.set(2.4, 1.2, 1); scene.add(s); birds.push({ s, a: RT.rnd(0, 6), r: RT.rnd(14, 26), y: RT.rnd(22, 34), d: RT.rnd(40, 90) }); }
      ctx.onFrame((dt, S) => {
        sunS.position.set(-60, 120, -S.d - 120);
        const p = pg.attributes.position.array;
        for (let i = 0; i < n; i++) { p[i * 3] += dt * 4; if (p[i * 3] > 15) p[i * 3] = -15; if (p[i * 3 + 2] > -S.d + 8) p[i * 3 + 2] -= 70; }
        pg.attributes.position.needsUpdate = true;
        for (const b of birds) { b.a += dt * 0.4; if (b.d < S.d) b.d = S.d + RT.rnd(50, 90); b.s.position.set(Math.cos(b.a) * b.r, b.y, -b.d + Math.sin(b.a) * b.r); }
      });
    },
  };
})();

/** Fahne mit Wappen-Streifen und goldenem Schild */
function rwBanner(c) {
  return { u: 0.08, iter: 1, field: 0.8, project: false, build(B) {
    B.tube('x', -8, 8, 0, 60, 0.7, 0x5b4636);
    for (let y = 22; y < 60; y++) for (let x = -6; x <= 6; x++) { if (y < 30 && Math.abs(x) > (y - 22) * 0.8) continue; B.put(x, y, Math.round(Math.sin(y * 0.3) * 0.6), Math.abs(x) <= 1 ? 0xffd23f : c); }
    B.ell(0, 46, 1, 3, 3.5, 1, 0xffd23f, { mat: 3 });
    return B;
  } };
}

/* =========================================================
   🏰 Ritterburg
   ========================================================= */
const RW_CASTLE = (() => {
  const SY = -0.3;
  const wallC = (x, y, z) => rnShade(0x9d9a92, (vxRand(Math.floor((x + (y % 2) * 2) / 4), y, Math.floor((z + (y % 2) * 2) / 4), 1) - 0.5) * 0.18 + ((x % 4 === 0 || z % 4 === 0) && y % 2 === 0 ? -0.1 : 0));
  const wood = (c = 0x8b5a2b) => (x, y, z) => rnShade(c, (vxRand(Math.floor(x / 4), y, Math.floor(z / 4), 3) - 0.5) * 0.14);
    return {
    id: 'castle', name: 'Ritterburg', emoji: '🏰', desc: 'Zwischen Burgmauern, Türmen und Fahnen',
    sky: ['#5f9bd8', '#a9d1f2', '#e9f1f6'], fog: 0xc8d9e8, fogNear: 30, fogFar: 125,
    hemi: [0xf2f6ff, 0x55663f, 1.1], sun: [0xfff2dc, 2.6], sunDir: [-0.5, 1, 0.45], env: 0.8, exposure: 1.0,
    gem: 0xffd23f,
    ground: {
      top: (g, w, h) => { RT.cobbles(g, w, h, { base: 0x8d877c, joint: '#4f4a42', n: 12 }); RT.lanes(g, w, h, 'rgba(60,55,45,.55)', 9); },
      side: (g, w, h) => RT.bricks(g, w, h, { base: 0x8f8b82, joint: '#5a564e', rows: 4, cols: 3 }),
      bottom: -2.4,
    },
    plat: {
      top: (g, w, h) => RT.planks(g, w, h, { base: 0x8b5a2b, n: 12, gap: '#2b1a0c' }),
      side: (g, w, h) => RT.bricks(g, w, h, { base: 0x9d9a92, joint: '#5a564e', rows: 5, cols: 3 }),
    },
    side: { y: SY, size: 260, tile: 6, draw: (g, w, h) => { RT.fill(g, w, h, '#5f8f3a'); RT.dots(g, w, h, ['#4c7a2e', '#77a64a', '#6b9a3f'], 1400, 2, 6, [0.3, 0.7]); RT.dots(g, w, h, ['#ffffff', '#ffd23f', '#ff6b9a'], 120, 1.2, 2.4, [0.6, 0.9]); } },
    pit: { color: 0x3f6f8f, y: -1.5, water: true, w: 11 },
    fallY: -1.0,
    props: {
      wall: { u: 0.25, iter: 2, field: 1.0, build(B) {
        B.box(-3, 0, -20, 3, 23, 20, wallC);
        for (let z = -20; z <= 20; z += 4) B.box(-3, 24, z, 3, 27, z + 1, wallC);
        B.box(-4, 22, -20, 4, 23, 20, 0x8a867e);
        for (const z of [-12, 4]) B.box(3, 10, z, 3, 14, z + 2, 0x2a2a30); // Schiessscharten
        return B;
      } },
      tower: { u: 0.25, iter: 3, field: 1.1, build(B) {
        B.cyl(0, 0, 0, 40, 9, wallC);
        for (let a = 0; a < 16; a += 2) { const r = a * Math.PI / 8; B.box(Math.round(Math.cos(r) * 8) - 1, 41, Math.round(Math.sin(r) * 8) - 1, Math.round(Math.cos(r) * 8) + 1, 43, Math.round(Math.sin(r) * 8) + 1, wallC); }
        B.cyl(0, 0, 41, 58, (y) => 10 - (y - 41) * 0.6, (x, y) => (y % 3 === 0 ? 0x2f4f9a : 0x3a62b8), { mat: 1 });
        B.cyl(0, 0, 58, 66, 0.5, 0x5b4636);
        B.box(1, 62, 0, 7, 65, 0, (x, y) => (y === 63 ? 0xffd23f : 0xd62f4b));
        for (const y of [14, 28]) B.box(-1, y, 8, 1, y + 3, 9, 0x2a2a30);
        return B;
      } },
      house: { u: 0.25, iter: 2, field: 1.0, farOnly: true, build(B) {
        B.box(-10, 0, -8, 10, 16, 8, (x, y, z) => ((x % 5 === 0 || y % 8 === 0 || (x + y) % 9 === 0 && Math.abs(x) < 9) && (Math.abs(x) === 10 || Math.abs(z) === 8) ? 0x5a3a22 : 0xf2e8d5));
        for (let y = 17; y <= 27; y++) { const w = 27 - y; B.box(-11, y, -w, 11, y, w, (x, yy, z) => (Math.abs(z) === w ? 0xb8452f : 0xc95a3f), 1); }
        for (const x of [-6, 5]) for (const y of [4, 11]) B.box(x, y, 8, x + 2, y + 3, 9, 0x6b8fb8, 1);
        B.box(-1, 0, 8, 1, 6, 9, 0x6b3f22);
        B.box(5, 20, 1, 7, 30, 3, 0x8a7d70);
        return B;
      } },
      keep: { u: 0.9, iter: 2, field: 1.0, project: false, farOnly: true, build(B) {
        B.box(-12, 0, -12, 12, 40, 12, wallC); for (let x = -12; x <= 12; x += 4) for (const z of [-12, 12]) B.box(x, 41, z, x + 1, 43, z, wallC);
        for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) { B.cyl(x, z, 0, 50, 5, wallC); B.cyl(x, z, 51, 62, (y) => 6 - (y - 51) * 0.55, 0x3a62b8); }
        return B;
      } },
      banner: rwBanner(0xd62f4b), banner2: rwBanner(0x2f5bd6),
      torch: { u: 0.05, iter: 2, field: 0.9, build(B) { B.bar([0, 0, 0], [0, 14, 3], 1, 0x4a3a2a); B.cyl(0, 3, 14, 17, 2, 0x3a3a3a, { mat: 3 }); B.ell(0, 20, 3, 2.2, 4, 2.2, 0xffb02e, { mat: 2 }); B.ell(0, 21, 3, 1.2, 2.5, 1.2, 0xfff1a8, { mat: 2 }); return B; } },
      hay: { u: 0.08, iter: 3, field: 1.2, build(B) { B.rbox(-8, 0, -6, 8, 9, 6, rwPatch(0xe0c060, 0.1, 2), { p: 5 }); for (const x of [-4, 4]) B.box(x, 0, -6, x, 9, 6, 0x9a7a3a); return B; } },
      barrel: { u: 0.06, iter: 3, field: 1.1, build(B) { for (const [x, z] of [[0, 0], [11, 2], [5, 10]]) B.cyl(x, z, 0, 14, (y) => 5 + Math.sin((y / 14) * Math.PI) * 1.2, (xx, y) => (y === 3 || y === 11 ? 0x4a4a4a : wood(0x9a6a3a)(xx, y, 0))); return B; } },
      stall: { u: 0.1, iter: 2, field: 1.0, build(B) {
        B.box(-12, 0, -6, 12, 9, 6, wood(0x8b5a2b));
        for (const x of [-12, 12]) for (const z of [-6, 6]) B.cyl(x, z, 9, 24, 0.8, 0x6b4a2c);
        for (let z = -8; z <= 8; z++) for (let x = -13; x <= 13; x++) B.put(x, 25 - Math.round(z * 0.35), z, Math.floor((x + 13) / 3) % 2 ? 0xd62f4b : 0xf3e6cf);
        for (let k = 0; k < 9; k++) B.ell(-9 + k * 2.3, 10.5, -2 + (k % 3) * 2, 1.3, 1.3, 1.3, [0xe63946, 0xf4a261, 0x8ac926][k % 3]);
        return B;
      } },
      armor: { u: 0.05, iter: 3, field: 1.1, build(B) {
        B.box(-7, 0, -7, 7, 6, 7, wallC);
        const m = 0xc9ced6;
        B.ell(0, 26, 0, 6, 9, 4.5, m, { mat: 1 }); B.ell(0, 40, 0, 4.5, 5, 4.5, m, { mat: 1 }); B.box(-3, 39, 4, 3, 40, 5, 0x222222);
        for (const sx of [-2.5, 2.5]) B.cyl(sx, 0, 7, 18, 1.8, m, { mat: 1 });
        for (const sx of [-7, 7]) B.bar([sx, 33, 0], [sx * 1.1, 20, 1], 1.5, m, { mat: 1 });
        B.bar([8, 18, 2], [8, 50, 2], 0.6, 0x8a8f98, { mat: 3 }); B.ell(-8, 26, 3, 4, 6, 1, 0xd62f4b);
        return B;
      } },
      tree: { u: 0.2, iter: 3, field: 1.2, build(B) { B.cyl(0, 0, 0, 16, 1.6, wood(0x6b4f35)); B.ell(0, 22, 0, 9, 8, 9, (x, y, z) => rnShade(0x4c8a35, (vxRand(Math.floor(x / 3), Math.floor(y / 3), Math.floor(z / 3), 1) - 0.5) * 0.25)); return B; } },
      bunting: { u: 0.06, iter: 1, field: 0.7, project: false, lod: false, cap: 8, span: true, build(B) {
        const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([-125 + t * 250, -Math.sin(t * Math.PI) * 14, 0]); }
        B.curve(pts, 0.35, 0x5b4636);
        for (let i = 0; i < 40; i++) { const t = (i + 0.5) / 40, x = -125 + t * 250, y = -Math.sin(t * Math.PI) * 14; for (let k = 0; k < 6; k++) for (let j = -3 + Math.ceil(k / 2); j <= 3 - Math.ceil(k / 2); j++) B.put(x + j, y - 1 - k, 0, [0xd62f4b, 0xffd23f, 0x2f5bd6, 0x1f8a4c][i % 4]); }
        return B;
      } },
      gatehouse: { u: 0.3, iter: 2, field: 1.0, cap: 4, span: true, build(B) {
        for (const sx of [-1, 1]) B.box(sx * 14 - 4, 0, -5, sx * 14 + 4, 28, 5, wallC);
        for (let x = -18; x <= 18; x++) for (let y = 18; y <= 28; y++) { if (Math.abs(x) < 10 && y < 18 + Math.sqrt(Math.max(0, 100 - x * x)) * 0.6) continue; B.box(x, y, -5, x, y, 5, wallC(x, y, 0)); }
        for (let x = -18; x <= 18; x += 3) B.box(x, 29, -5, x + 1, 31, 5, wallC);
        for (let x = -9; x <= 9; x += 2) B.box(x, 26, 5, x, 28, 6, 0x3a3a3a, 3); // Fallgitter oben
        B.ell(0, 25, 6, 3, 3.5, 1, 0xd62f4b); B.ell(0, 25, 7, 1.5, 2, 0.5, 0xffd23f, { mat: 3 });
        return B;
      } },
      flowers: { u: 0.05, iter: 2, field: 0.9, build(B) { B.box(-12, 0, -4, 12, 5, 4, wood(0x8b5a2b)); for (let k = 0; k < 16; k++) { const x = -10 + (k % 8) * 3, z = k < 8 ? -2 : 2; B.cyl(x, z, 5, 8, 0.6, 0x3f7a2c); B.ell(x, 9, z, 1.6, 1.3, 1.6, [0xff6b9a, 0xffd23f, 0xffffff, 0x9b6bff][k % 4]); } return B; } },
      merlon: { u: 0.1, iter: 2, field: 0.9, lod: false, cap: 40, build(B) { B.box(-2, 0, -6, 2, 5, 6, wallC); B.box(-2, 5, -6, 2, 9, -2, wallC); B.box(-2, 5, 2, 2, 9, 6, wallC); return B; } },
    },
    obstacles: {
      tall: rwTall({ post: 0x5b3a1e, panel: 0xd62f4b, panel2: 0xffd23f, accent: 0x7dd3fc }), roller: rwRoller('barrel', 0x9a6a3a, 0x3a3a3a),
      low: { u: 0.08, iter: 3, field: 1.2, yt: RN.LOW, cap: 24, build(B) { B.rbox(-10, 0, -4, 10, 7, 4, rwPatch(0xe0c060, 0.1, 2), { p: 5 }); for (const x of [-5, 5]) B.box(x, 0, -4, x, 7, 4, 0x9a7a3a); return B; } },
      high: { u: 0.07, iter: 2, field: 0.9, yt: RN.HIGH, cap: 24, build(B) {
        for (const sx of [-11, 11]) B.box(sx - 1, 0, -1, sx + 1, 15, 1, wood(0x6b4a2c));
        for (const y of [3, 8, 13]) B.box(-12, y, 0, 12, y + 1, 1, wood(0x9a6a3a));
        B.bar([-10, 1, 1], [10, 14, 1], 0.9, 0x7a4f2a); B.bar([10, 1, 1], [-10, 14, 1], 0.9, 0x7a4f2a);
        return B;
      } },
      over: { u: 0.08, iter: 2, field: 0.9, yb: RN.OVER, yt: 3.2, cap: 24, build(B) {
        for (const sx of [-11, 11]) B.box(sx - 1, 0, -1, sx + 1, 30, 1, wood(0x6b4a2c));
        B.box(-12, 28, -1, 12, 30, 1, wood(0x6b4a2c));
        for (let x = -10; x <= 10; x += 3) for (let y = 14; y < 28; y++) B.put(x, y, 0, 0x4a4d55, 3);
        for (let y = 14; y < 28; y += 3) for (let x = -10; x <= 10; x++) B.put(x, y, 0, 0x4a4d55, 3);
        for (let x = -10; x <= 10; x += 3) B.put(x, 13, 0, 0x6a6d75, 3); // Spitzen
        return B;
      } },
      block: { u: 0.15, iter: 2, field: 1.0, yt: RN.BLOCK, top: RN.BLOCK, depth: 0, len: 8, cap: 16, build(B) {
        // Wagen mit Kisten (oben kann man laufen)
        B.box(-6, 2, -53, 6, 3, 0, wood(0x8b5a2b));
        for (const z of [-8, -45]) for (const sx of [-1, 1]) B.tube('x', sx * 6, sx * 6 + sx, z, 2, 2, 0x5b3a1e);
        for (let z = -52; z <= -1; z += 9) B.box(-6, 4, z, 6, 8, z + 7, (x, y, zz) => ((x === -6 || x === 6 || y === 8 || y === 4) ? 0x7a4f2a : wood(0xb07a4a)(x, y, zz)));
        B.box(-6, 4, -53, 6, 8, -53, 0x7a4f2a); B.box(-6, 4, 0, 6, 8, 0, 0x7a4f2a);
        return B;
      } },
      ramp: { u: 0.15, iter: 1, field: 0.9, project: false, yt: RN.BLOCK, ramp: true, depth: 0, len: 4, cap: 12, build(B) {
        for (let z = 0; z >= -26; z--) { const h = Math.round(((-z + 1) / 27) * 9) - 1; for (let x = -6; x <= 6; x++) { B.put(x, h, z, z % 3 === 0 ? 0x6b4a2c : wood(0x9a6a3a)(x, h, z)); if (Math.abs(x) === 5 && z % 6 === 0) for (let y = 0; y < h; y++) B.put(x, y, z, 0x5b3a1e); } }
        return B;
      } },
    },
    gate: { u: 0.08, iter: 2, field: 1.0, labelY: 2.55, border: '#d62f4b', build(B) {
      for (const sx of [-10, 10]) { B.box(sx - 2, 0, -2, sx + 2, 38, 2, wallC); B.box(sx - 1, 6, 2, sx + 1, 20, 3, sx < 0 ? 0xd62f4b : 0x2f5bd6); B.put(sx, 13, 3, 0xffd23f, 3); }
      B.box(-12, 25, -2, 12, 38, -1, wallC);
      for (let x = -12; x <= 12; x += 3) B.box(x, 39, -2, x + 1, 41, 1, wallC);
      return B;
    } },
    scatter(ctx, d0, d1) {
      const R = RT.rnd, P = ctx.put;
      const di = Math.floor(d0 / 10);
      for (const sg of [-1, 1]) {
        // Mauer durchgehend, Türme in Abständen
        P('wall', sg * 7.6, SY, d0 + 5, 0, 1);
        if (di % 4 === 0) P('tower', sg * 8.2, SY, d0 + 5, R(0, 6.3), R(0.95, 1.1));
        if (di % 2 === 1) P(Math.random() < 0.5 ? 'banner' : 'banner2', sg * 6.7, SY - 0.5, d0 + R(2, 8), sg > 0 ? -Math.PI / 2 : Math.PI / 2, 1);
        if (di % 2 === 0) P('torch', sg * 6.75, 2.2, d0 + R(2, 8), sg > 0 ? -Math.PI / 2 : Math.PI / 2, 1);
        const near = ['hay', 'barrel', 'stall', 'armor', 'flowers', 'tree'];
        if (Math.random() < 0.6) { const k = near[Math.floor(Math.random() * near.length)]; P(k, sg * R(4.3, k === 'stall' || k === 'tree' ? 5.2 : 5.6), SY, R(d0, d1), k === 'stall' || k === 'armor' || k === 'flowers' ? (sg > 0 ? -Math.PI / 2 : Math.PI / 2) : R(0, 6.3), 1); }
        P('house', sg * R(15, 26), SY, R(d0, d1), R(-0.2, 0.2) + (sg > 0 ? -Math.PI / 2 : Math.PI / 2), R(0.9, 1.2));
        if (Math.random() < 0.5) P('tree', sg * R(12, 20), SY, R(d0, d1), R(0, 6.3), R(0.9, 1.3));
      }
      if (di % 6 === 3) P('keep', (Math.random() < 0.5 ? -1 : 1) * R(45, 70), SY, R(d0, d1), 0, 1);
      if (di % 3 === 1) P('bunting', 0, 6.4, d0 + 5, 0, 1);
      if (di % 8 === 6) P('gatehouse', 0, SY, d0 + 5, 0, 1);
    },
    onPlatform(ctx, d0, d1, H) { for (let d = d0 + 7; d < d1 - 1; d += 1.6) if (ctx.ground(d) === H) for (const sg of [-1, 1]) ctx.put('merlon', sg * 3.5, H, d, 0, 1); },
    extras(ctx) {
      const { T } = ctx; const scene = ctx.fx;
      const cTex = rnCanvasTex(T, 256, 128, (g, w) => { for (let i = 0; i < 12; i++) { const x = 40 + Math.random() * (w - 80), y = 50 + Math.random() * 40, r = 22 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }, { repeat: false });
      const cMat = new T.SpriteMaterial({ map: cTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }); ctx.own.push(cTex, cMat);
      const clouds = []; for (let i = 0; i < 9; i++) { const s = new T.Sprite(cMat); s.scale.set(RT.rnd(50, 90), RT.rnd(20, 34), 1); scene.add(s); clouds.push({ s, x: RT.rnd(-150, 150), y: RT.rnd(45, 85), d: RT.rnd(80, 240) }); }
      const n = 160, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set([RT.rnd(-10, 10), RT.rnd(0.5, 7), RT.rnd(-70, 10)], i * 3);
      const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pm = new T.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.85, depthWrite: false }); scene.add(new T.Points(pg, pm)); ctx.own.push(pg, pm);
      ctx.onFrame((dt, S) => {
        for (const c of clouds) c.s.position.set(c.x, c.y, -S.d - c.d);
        const p = pg.attributes.position.array;
        for (let i = 0; i < n; i++) { p[i * 3] += Math.sin(ctx.time + i) * dt * 0.4; p[i * 3 + 1] -= dt * 0.25; if (p[i * 3 + 1] < 0) p[i * 3 + 1] = 7; if (p[i * 3 + 2] > -S.d + 8) p[i * 3 + 2] -= 80; }
        pg.attributes.position.needsUpdate = true;
      });
    },
  };
})();

/** Verzweigte Koralle in einer Farbe */
function rwCoral(c) {
  return { u: 0.06, iter: 3, field: 1.0, build(B) {
    let seed = c & 255;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const branch = (p, dir, L, r, depth) => { const q = [p[0] + dir[0] * L, p[1] + dir[1] * L, p[2] + dir[2] * L]; B.bar(p, q, r, rnShade(c, depth * 0.06)); B.ell(...q, r * 1.25, r * 1.25, r * 1.25, rnShade(c, 0.15)); if (depth < 3) for (let k = 0; k < 2; k++) { const a = rnd() * 6.3; branch(q, [dir[0] * 0.5 + Math.cos(a) * 0.5, 0.8, dir[2] * 0.5 + Math.sin(a) * 0.5], L * 0.72, r * 0.75, depth + 1); } };
    for (let k = 0; k < 3; k++) { const a = k * 2.1; branch([0, 0, 0], [Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35], 9, 1.6, 0); }
    return B;
  } };
}

/* =========================================================
   🐠 Unter Wasser
   ========================================================= */
const RW_SEA = (() => {
  const SY = -0.45;
  const rockC = (x, y, z) => rnShade(0x5d6f7a, (vxRand(Math.floor(x / 2), Math.floor(y / 2), Math.floor(z / 2), 1) - 0.5) * 0.2);
  const algae = (base) => rwMix(base, 0x4f8a5a, 0.25, 2, 4, 0.004);
  const CORAL = [0xff6f91, 0xff9f43, 0xb06bff, 0xffd166, 0x4ecdc4, 0xff5e5e];
  return {
    id: 'sea', name: 'Unter Wasser', emoji: '🐠', desc: 'Über den Meeresgrund zwischen Korallen',
    sky: ['#06345e', '#0f5d93', '#2b97c9'], fog: 0x1d6e9c, fogNear: 14, fogFar: 92,
    hemi: [0xaee9ff, 0x0b2a40, 1.3], sun: [0xc9f3ff, 1.9], sunDir: [0.15, 1, 0.2], env: 0.55, exposure: 1.06,
    gem: 0xfff07a,
    ground: {
      top: (g, w, h) => { RT.fill(g, w, h, '#d9c79a'); g.strokeStyle = 'rgba(160,130,80,.3)'; g.lineWidth = 3; for (let y = 6; y < h; y += 14) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 22 + y) * 3); g.stroke(); } RT.dots(g, w, h, ['#f2e6c4', '#b8a37a', '#ffd1dc'], 400, 1, 3, [0.3, 0.7]); g.fillStyle = 'rgba(120,110,100,.75)'; for (const u of [0.25, 0.75]) for (let y = 0; y < h; y += 22) { g.beginPath(); g.ellipse(u * w + RT.rnd(-3, 3), y + 8, 7, 5, 0, 0, 6.3); g.fill(); } },
      side: (g, w, h) => { RT.fill(g, w, h, '#6b7d86'); RT.dots(g, w, h, ['#4f8a5a', '#55666f', '#7d8f98'], 300, 3, 10, [0.3, 0.7]); },
      bottom: -2.4,
    },
    plat: {
      top: (g, w, h) => { RT.fill(g, w, h, '#8a9aa0'); RT.dots(g, w, h, ['#ff6f91', '#ffd166', '#4ecdc4', '#b06bff'], 70, 3, 9, [0.5, 0.9]); RT.dots(g, w, h, ['#6b7d86', '#a3b1b6'], 600, 2, 6, [0.3, 0.6]); },
      side: (g, w, h) => { RT.fill(g, w, h, '#5d6f7a'); RT.dots(g, w, h, ['#4f8a5a', '#ff6f91', '#49565e'], 260, 3, 12, [0.3, 0.7]); },
    },
    side: { y: SY, size: 240, tile: 6, draw: (g, w, h) => { RT.fill(g, w, h, '#cdb98a'); g.strokeStyle = 'rgba(150,120,70,.3)'; g.lineWidth = 3; for (let y = 6; y < h; y += 14) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x / 22 + y) * 3); g.stroke(); } RT.dots(g, w, h, ['#e6d6b0', '#a89268'], 500, 1, 3, [0.3, 0.6]); } },
    pit: { color: 0x061c33, y: -10, w: 12 },
    fallY: -1.3,
    props: {
      coral: rwCoral(0xff6f91), coral2: rwCoral(0xb06bff), coral3: rwCoral(0xff9f43),
      brain: { u: 0.07, iter: 3, field: 1.2, build(B) { B.ell(0, 4, 0, 9, 8, 9, (x, y, z) => ((Math.round(Math.sin(x * 0.9) * 2 + Math.cos(z * 0.9) * 2 + y * 0.5) % 2) ? 0xffb36b : 0xe8894d), { keep: (x, y) => y >= 0 }); return B; } },
      fan: { u: 0.06, iter: 1, field: 0.8, project: false, build(B) { const c = Math.random() < 0.5 ? 0xb06bff : 0xff6f91; for (let a = -70; a <= 70; a += 8) { const r = a * Math.PI / 180; B.curve([[0, 0, 0], [Math.sin(r) * 7, Math.cos(r) * 9 + 2, 0], [Math.sin(r) * 13, Math.cos(r) * 18 + 3, 0]], 0.5, c); } for (let y = 5; y < 20; y += 3) for (let x = -12; x <= 12; x++) if (Math.hypot(x, y - 3) < 18 - Math.abs(x) * 0.2) B.put(x, y, 0, rnShade(c, -0.12)); return B; } },
      kelp: { u: 0.1, iter: 2, field: 0.8, project: false, build(B) { for (let k = 0; k < 3; k++) { const ox = (k - 1) * 4, L = 60 + k * 14; const pts = []; for (let i = 0; i <= 12; i++) pts.push([ox + Math.sin(i * 0.8 + k) * 2.5, (i / 12) * L, Math.cos(i * 0.6 + k) * 1.5]); B.curve(pts, 0.8, 0x3f8f4a); for (let i = 1; i < 12; i++) { const [x, y, z] = pts[i]; B.ell(x + (i % 2 ? 2.5 : -2.5), y, z, 2.6, 1.2, 1.2, rnShade(0x58a84f, (i % 3) * 0.05)); } } return B; } },
      anemone: { u: 0.04, iter: 2, field: 0.9, project: false, build(B) { B.cyl(0, 0, 0, 6, 5, 0xff7eb6); for (let k = 0; k < 22; k++) { const a = k * 0.29, r = 2 + (k % 3) * 1.2; B.curve([[Math.cos(a) * r, 6, Math.sin(a) * r], [Math.cos(a) * (r + 3), 12, Math.sin(a) * (r + 3)], [Math.cos(a) * (r + 5), 15, Math.sin(a) * (r + 5)]], 0.6, k % 2 ? 0xffb3d1 : 0xff9fd0); } return B; } },
      rock: { u: 0.18, iter: 3, field: 1.4, build(B) { B.ell(0, 2, 0, 7, 5, 6, algae(0x6b7d86), { keep: (x, y) => y >= 0 }); B.ell(5, 1, 3, 4, 3, 3.5, algae(0x5d6f7a), { keep: (x, y) => y >= 0 }); for (let k = 0; k < 4; k++) B.ell(-3 + k * 2, 6, -1 + k, 1, 1, 1, CORAL[k]); return B; } },
      star: { u: 0.04, iter: 2, field: 1.0, build(B) { for (let k = 0; k < 5; k++) { const a = k * 1.2566; B.bar([0, 1, 0], [Math.cos(a) * 9, 1, Math.sin(a) * 9], (t) => 2.4 - t * 1.6, 0xff7a3d); } B.paint((v) => (vxRand(v.x, v.y, v.z) < 0.2 ? 0xffd166 : null)); return B; } },
      clam: { u: 0.06, iter: 3, field: 1.2, build(B) { B.ell(0, 3, 0, 10, 4, 8, (x, y, z) => (Math.round(Math.atan2(z, x) * 4) % 2 ? 0x6b8fd6 : 0x8fb0f0), { keep: (x, y) => y >= 0 }); B.ell(0, 9, -4, 10, 3, 6, 0x6b8fd6); B.ell(0, 5, 1, 2.2, 2.2, 2.2, 0xffffff, { mat: 2 }); return B; } },
      chest: { u: 0.05, iter: 2, field: 1.0, build(B) { B.box(-9, 0, -6, 9, 10, 6, wood => 0x7a4f2a); B.ell(0, 10, 0, 9, 4, 6, 0x8b5a2b, { keep: (x, y) => y >= 10 }); for (const x of [-9, 9]) B.box(x, 0, -6, x, 13, 6, 0xd4af37, 3); B.box(-1, 6, 6, 1, 9, 7, 0xd4af37, 3); for (let k = 0; k < 6; k++) B.ell(-6 + k * 2.4, 12 + (k % 2), -1, 1.4, 1.4, 1.4, 0xffd23f, { mat: 2 }); return B; } },
      wreck: { u: 0.35, iter: 2, field: 1.1, cap: 3, farOnly: true, build(B) {
        for (let z = -22; z <= 22; z++) { const w = 7 * Math.sqrt(1 - (z / 23) ** 2); for (let y = 0; y <= 10; y++) { const ww = w * (0.55 + y * 0.045); for (let x = -Math.round(ww); x <= Math.round(ww); x++) { if (y > 1 && Math.abs(x) < ww - 1.2) continue; B.put(x, y, z, algae(y % 3 === 0 ? 0x5b3a22 : 0x6b4a2c)(x, y, z)); } } }
        B.cyl(0, 2, 10, 38, 0.9, 0x5b3a22); B.tube('x', -8, 8, 2, 30, 0.6, 0x5b3a22);
        B.cut((x, y, z) => z > 12 && y > 4 && x > 0);
        return B;
      } },
      arch: { u: 0.35, iter: 3, field: 1.3, cap: 4, span: true, build(B) { for (let a = 0; a <= 180; a += 3) { const r = a * Math.PI / 180; B.ell(-Math.cos(r) * 20, Math.sin(r) * 19, 0, 3.6, 3.6, 4, algae(0x5d6f7a)); } for (let k = 0; k < 18; k++) { const r = (k / 17) * Math.PI; B.ell(-Math.cos(r) * 20, Math.sin(r) * 19 + 3.5, 0, 1.6, 1.6, 1.6, CORAL[k % CORAL.length]); } return B; } },
      seaweed: { u: 0.05, iter: 2, field: 0.8, project: false, build(B) { for (let k = 0; k < 9; k++) { const a = k * 0.7, r = 2 + (k % 3); const pts = []; for (let i = 0; i <= 6; i++) pts.push([Math.cos(a) * r + Math.sin(i + k) * 1.5, i * 4, Math.sin(a) * r]); B.curve(pts, 0.8, k % 2 ? 0x3f9a5a : 0x7dbf4a); } return B; } },
      tube: { u: 0.05, iter: 2, field: 1.0, build(B) { for (const [x, z, h, c] of [[0, 0, 18, 0xffb02e], [5, 2, 12, 0xff6f91], [-4, 3, 14, 0xb06bff], [2, -5, 9, 0xffd166]]) { B.cyl(x, z, 0, h, 2.2, c); B.cyl(x, z, h - 3, h, 1.2, 0x2a1a33); } return B; } },
    },
    obstacles: {
      tall: rwTall({ post: 0x5d6f7a, panel: 0xff7eb6, panel2: 0xb06bff, accent: 0xfff07a }), roller: rwRoller('crab', 0xef4444, 0xb91c1c),
      low: { u: 0.08, iter: 3, field: 1.0, yt: RN.LOW, cap: 24, build(B) { B.rbox(-10, 0, -3, 10, 3, 3, algae(0x6b7d86), { p: 4 }); for (let x = -9; x <= 9; x += 3) B.ell(x, 5, 0, 1.8, 2.6, 1.8, CORAL[(x + 9) % CORAL.length]); return B; } },
      high: { u: 0.07, iter: 2, field: 1.1, yt: RN.HIGH, cap: 24, build(B) {
        B.rbox(-12, 0, -4, 12, 12, 4, algae(0x5d6f7a), { p: 4 });
        for (let k = 0; k < 7; k++) { const x = -10 + k * 3.3, y = 12 + (k % 2); B.ell(x, y, 0, 2, 2, 2, 0x5a2a6b); for (let a = 0; a < 6; a++) { const r = a * 1.05; B.bar([x, y, 0], [x + Math.cos(r) * 3.5, y + Math.abs(Math.sin(r)) * 3, Math.sin(r) * 2], 0.4, 0x7a3a8f); } }
        return B;
      } },
      over: { u: 0.07, iter: 2, field: 1.0, yb: RN.OVER, yt: 3.2, cap: 24, build(B) {
        // schwebende Qualle (die Tentakel enden über 1 m)
        B.ell(0, 24, 0, 11, 6, 11, 0xc9a7ff, { mat: 2, keep: (x, y) => y >= 22 });
        B.ell(0, 23, 0, 9, 2, 9, 0xe3d0ff, { mat: 2 });
        for (let k = 0; k < 10; k++) { const a = k * 0.63, r = 7; B.curve([[Math.cos(a) * r, 22, Math.sin(a) * r], [Math.cos(a) * r * 0.9 + Math.sin(k) * 1.5, 19, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.8, 16, Math.sin(a) * r * 0.8]], 0.5, 0xb18bff, { mat: 2 }); }
        return B;
      } },
      block: { u: 0.15, iter: 3, field: 1.2, yt: RN.BLOCK, top: RN.BLOCK, depth: 0, len: 8, cap: 16, build(B) {
        B.box(-6, 0, -53, 6, 8, 0, algae(0x5d6f7a));
        for (let k = 0; k < 14; k++) { const z = -2 - k * 3.6, x = (k % 2 ? 6 : -6); B.ell(x, 2 + (k % 3) * 2, z, 1.6, 1.6, 1.6, CORAL[k % CORAL.length]); }
        B.paint((v) => (v.y === 8 && vxRand(Math.floor(v.x / 2), 0, Math.floor(v.z / 2)) < 0.25 ? CORAL[Math.floor(vxRand(v.x, v.z, 1) * 6)] : null));
        return B;
      } },
      ramp: { u: 0.15, iter: 3, field: 1.3, project: false, yt: RN.BLOCK, ramp: true, depth: 0, len: 4, cap: 12, build(B) {
        for (let z = 0; z >= -26; z--) { const h = Math.round(((-z + 1) / 27) * 9) - 1; for (let x = -6; x <= 6; x++) for (let y = 0; y <= h; y++) B.put(x, y, z, y === h ? rnShade(0xd9c79a, (vxRand(x, z, 3) - 0.5) * 0.1) : 0x8a7a5a); }
        return B;
      } },
    },
    gate: { u: 0.08, iter: 2, field: 1.0, labelY: 2.55, border: '#ff7eb6', build(B) {
      for (const sx of [-10, 10]) { B.cyl(sx, 0, 0, 38, 2.2, algae(0x6b7d86)); for (let y = 4; y < 36; y += 5) B.ell(sx + (y % 2 ? 2 : -2), y, 1, 1.5, 1.5, 1.5, CORAL[(y / 5) % 6 | 0]); }
      B.rbox(-12, 25, -2, 12, 38, -1, 0x2c4f6b, { p: 6 });
      for (let x = -11; x <= 11; x += 2) B.ell(x, 39, -1, 1, 1, 1, 0xffffff, { mat: 2 });
      return B;
    } },
    scatter(ctx, d0, d1) {
      const R = RT.rnd, P = ctx.put;
      for (const sg of [-1, 1]) {
        for (let k = 0; k < 2; k++) P(['coral', 'coral2', 'coral3'][Math.floor(Math.random() * 3)], sg * R(4, 8), SY, R(d0, d1), R(0, 6.3), R(0.7, 1.3));
        if (Math.random() < 0.6) P('brain', sg * R(4.2, 8), SY, R(d0, d1), R(0, 6.3), R(0.7, 1.3));
        if (Math.random() < 0.5) P('fan', sg * R(4.5, 9), SY, R(d0, d1), R(-0.6, 0.6), R(0.8, 1.3));
        P('kelp', sg * R(6, 14), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.3));
        if (Math.random() < 0.6) P('kelp', sg * R(14, 26), SY, R(d0, d1), R(0, 6.3), R(1, 1.5));
        if (Math.random() < 0.5) P('rock', sg * R(5, 12), SY, R(d0, d1), R(0, 6.3), R(0.7, 1.4));
        if (Math.random() < 0.45) P('anemone', sg * R(3.8, 5.5), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.3));
        if (Math.random() < 0.4) P('seaweed', sg * R(3.8, 7), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.3));
        if (Math.random() < 0.35) P('tube', sg * R(4, 7), SY, R(d0, d1), R(0, 6.3), R(0.8, 1.2));
        if (Math.random() < 0.3) P('star', sg * R(3.7, 5), SY + 0.02, R(d0, d1), R(0, 6.3), R(0.8, 1.2));
        if (Math.random() < 0.08) P(Math.random() < 0.5 ? 'clam' : 'chest', sg * R(4.3, 6), SY, R(d0, d1), sg > 0 ? -Math.PI / 2 : Math.PI / 2, 1);
      }
      if (Math.floor(d0 / 10) % 7 === 3) P('arch', 0, SY, (d0 + d1) / 2, 0, 1);
      if (Math.floor(d0 / 10) % 13 === 6) P('wreck', (Math.random() < 0.5 ? -1 : 1) * RT.rnd(16, 24), SY - 0.8, (d0 + d1) / 2, RT.rnd(0.3, 1.2), 1, 0, 0.25);
    },
    decorate(ctx, wrap) {
      // Taucherhelm aus Glas und Luftblasen
      const { T } = ctx;
      const m = new T.MeshPhysicalMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false });
      const h = new T.Mesh(new T.SphereGeometry(0.42, 24, 16), m); h.position.set(0, 1.32, 0); h.renderOrder = 4;
      wrap.add(h); ctx.own.push(m, h.geometry);
    },
    extras(ctx) {
      const { T } = ctx; const scene = ctx.fx;
      // Lichtflecken von oben
      const rayTex = rwRayTex(T, '200,245,255', 0);
      const rayMat = new T.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.3, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
      ctx.own.push(rayTex, rayMat);
      const rays = []; for (let i = 0; i < 10; i++) { const m = new T.Mesh(new T.PlaneGeometry(3, 22), rayMat); ctx.own.push(m.geometry); scene.add(m); rays.push({ m, d: 20 + i * 10, x: RT.rnd(-9, 9) }); }
      // Luftblasen
      const n = 300, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set([RT.rnd(-12, 12), RT.rnd(0, 12), RT.rnd(-80, 10)], i * 3);
      const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
      const bTex = rnCanvasTex(T, 32, 32, (g) => { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(11, 11, 3, 0, 7); g.fill(); }, { repeat: false });
      const pm = new T.PointsMaterial({ map: bTex, size: 0.16, transparent: true, opacity: 0.8, depthWrite: false }); scene.add(new T.Points(pg, pm)); ctx.own.push(pg, pm, bTex);
      // Fischschwärme
      const fishGeo = new T.ConeGeometry(0.09, 0.32, 5); fishGeo.rotateX(Math.PI / 2);
      const fishMat = new T.MeshStandardMaterial({ color: 0xffd166, roughness: 0.4, metalness: 0.2, emissive: 0x332200 });
      const fishMat2 = new T.MeshStandardMaterial({ color: 0x4ecdc4, roughness: 0.4, metalness: 0.2 });
      ctx.own.push(fishGeo, fishMat, fishMat2);
      const schools = [];
      for (let k = 0; k < 4; k++) {
        const im = new T.InstancedMesh(fishGeo, k % 2 ? fishMat : fishMat2, 26); im.frustumCulled = false; scene.add(im);
        schools.push({ im, x: RT.rnd(-10, 10), y: RT.rnd(2.5, 7), d: 30 + k * 28, v: RT.rnd(1.5, 3), dir: Math.random() < 0.5 ? 1 : -1, off: Array.from({ length: 26 }, () => [RT.rnd(-1.5, 1.5), RT.rnd(-0.8, 0.8), RT.rnd(-1.5, 1.5), RT.rnd(0, 6)]) });
      }
      const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), V = new T.Vector3(), Sc = new T.Vector3(1, 1, 1);
      ctx.onFrame((dt, S) => {
        for (const r of rays) { if (r.d < S.d + 10) { r.d += 100; r.x = RT.rnd(-9, 9); } r.m.position.set(r.x, 9, -r.d); r.m.lookAt(ctx.camera.position.x, 9, ctx.camera.position.z); r.m.rotateZ(0.12); }
        const p = pg.attributes.position.array;
        for (let i = 0; i < n; i++) { p[i * 3 + 1] += dt * (0.6 + (i % 5) * 0.15); p[i * 3] += Math.sin(ctx.time * 2 + i) * dt * 0.1; if (p[i * 3 + 1] > 12) p[i * 3 + 1] = 0; if (p[i * 3 + 2] > -S.d + 8) p[i * 3 + 2] -= 90; }
        pg.attributes.position.needsUpdate = true;
        for (const sc of schools) {
          sc.x += sc.v * sc.dir * dt;
          if (Math.abs(sc.x) > 16 || sc.d < S.d + 12) { sc.dir = Math.random() < 0.5 ? 1 : -1; sc.x = -16 * sc.dir; sc.d = S.d + RT.rnd(30, 80); sc.y = RT.rnd(3, 7); }
          sc.off.forEach((o, i) => { const w = Math.sin(ctx.time * 3 + o[3]) * 0.25; M.compose(V.set(sc.x + o[0], sc.y + o[1] + w * 0.3, -sc.d + o[2]), Q.setFromEuler(E.set(0, sc.dir > 0 ? Math.PI / 2 : -Math.PI / 2, w)), Sc); sc.im.setMatrixAt(i, M); });
          sc.im.instanceMatrix.needsUpdate = true;
        }
      });
    },
  };
})();

const RUN_WORLDS = { jungle: RW_JUNGLE, roofs: RW_ROOFS, desert: RW_DESERT, castle: RW_CASTLE, sea: RW_SEA };
const RUN_WORLD_LIST = () => Object.values(RUN_WORLDS).map((w) => ({ id: w.id, name: w.name, emoji: w.emoji, desc: w.desc }));
