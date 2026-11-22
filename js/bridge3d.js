/* Vokaboom – Brückenbau in 3D, Blick von hinten (leicht von oben)
 *
 * Der eigene 3D-Avatar steht am Rand einer Schlucht, die Kamera schaut ihm über die Schulter. Bei jeder richtigen
 * Antwort fliegt vor ihm eine Platte an ihren Platz, und er geht einen Schritt nach vorne. Eine falsche Antwort:
 * die Platte bricht entzwei und stürzt in die Tiefe. Ist die Brücke fertig, läuft er ans andere Ufer zur Schatzkiste.
 * Alles im Voxel-Stil des Avatars (js/avatar3d.js, Baukasten aus js/runner3d.js). Masse in Metern.
 * Ohne WebGL bleibt der Brückenbau in 2D (js/bridge.js).
 */
'use strict';

const B3 = { D: 0.92, W: 2.3, CAM: { up: 4.4, back: 6.4, look: 8 } };

async function b3Mount(stage) {
  if (!stage || typeof gavOK !== 'function' || !gavOK() || typeof w3LoadRunner !== 'function') return null;
  const gid = G.id;
  try { await w3Three(); await w3LoadRunner(); } catch (e) { console.warn('Brücke 3D laden', e); return null; }
  if (G.id !== gid || !stage.isConnected || typeof vxFigure !== 'function' || typeof rnBuilder !== 'function') return null;
  const T = w3T(), s = G.s, P = S3_BRIDGE[s.theme] || S3_BRIDGE.jungle, TH = s.T;
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  renderer.setPixelRatio(typeof fxPR === 'function' ? fxPR() : Math.min(1.75, window.devicePixelRatio || 1));
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = typeof fxQuality !== 'function' || fxQuality() === 'high'; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const cv = renderer.domElement; cv.className = 'b3-canvas'; cv.setAttribute('aria-hidden', 'true');
  stage.insertBefore(cv, stage.firstChild);
  const scene = new T.Scene();
  // Himmel: Farbverlauf als Hintergrund, Nebel in der Ferne
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
  const sg = sky.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, TH.sky[0]); gr.addColorStop(1, TH.sky[1]);
  sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
  const skyTex = new T.CanvasTexture(sky); skyTex.colorSpace = T.SRGBColorSpace; scene.background = skyTex;
  scene.fog = new T.Fog(new T.Color(TH.sky[1]), 30, 140);
  scene.add(new T.HemisphereLight(s.theme === 'lava' ? 0xffd2b0 : 0xffffff, s.theme === 'lava' ? 0x6a2010 : 0x6b5a3a, s.theme === 'lava' ? 1.8 : 1.35));
  const sun = new T.DirectionalLight(s.theme === 'lava' ? 0xffc8a0 : 0xfff4e0, 2.2);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  if (s.theme === 'lava') { const lv = new T.PointLight(0xff6a1a, 3, 40, 1.2); lv.position.set(0, -8, -8); scene.add(lv); }
  const cam = new T.PerspectiveCamera(50, 1, 0.1, 400);
  const own = [], mats = vxMaterials(T);
  const vox = (build, opts) => { const B = rnBuilder(); build(B); const g = rnGeo(T, B, opts); own.push(g); return g; };
  const mesh = (g, shadow = true) => { const m = new T.Mesh(g, mats); m.castShadow = shadow; m.receiveShadow = true; return m; };
  const L = s.n * B3.D + 0.3; // Länge der Brücke
  const slotZ = (i) => -(i + 0.5) * B3.D - 0.15;

  /* ---------- Gelände: die Schlucht zieht sich über die ganze Breite ---------- */
  const topC = (x, y, z, depthFromTop) => (depthFromTop < 1 ? P.top : depthFromTop < 2 ? rnShade(P.top, -0.12) : rwMix(P.rock, P.rock2, 0.35, 3, 1)(x, y, z));
  // Ufer (vorne und hinten): breite Platte mit zerklüfteter Felswand zur Schlucht
  const cliff = (dir) => vox((B) => {
    const X = 85, Z = 22, Hh = 30;
    for (let x = -X; x <= X; x++) {
      const jag = dir > 0 ? 0 : Math.max(0, Math.round(Math.sin(x * 0.9) * 0.8 + Math.sin(x * 0.27) * 1.4 + Math.sin(x * 0.07) * 1.5)); // vorne (Start): gerade Kante
      for (let z = jag; z <= Z; z++) for (let y = -2; y <= 0; y++) B.put(x, y, dir * z, topC(x, y, z, -y));
      for (let y = -Hh; y <= -3; y++) { const inset = dir > 0 ? Math.round(Math.max(0, Math.sin(y * 0.3 + x * 0.5)) * 0.6) : Math.round(Math.sin(y * 0.45 + x * 0.8) * 0.8 + Math.sin(y * 0.13) * 1.2 + 1); for (let z = jag + inset; z <= jag + inset + 2; z++) B.put(x, y, dir * z, topC(x, y, z, 9)); }
    }
  }, { u: 0.4, iter: 1, field: 1 });
  const near = mesh(cliff(1)); near.position.set(0, -0.4, 0.15); scene.add(near);
  const far = mesh(cliff(-1)); far.position.set(0, -0.4, -L - 0.15); scene.add(far);
  // Tief unten: Fluss oder Lava fliesst quer durch die Schlucht (mit Strömung), bei Eis ein gefrorener Bach
  const flowC = document.createElement('canvas'); flowC.width = 256; flowC.height = 64;
  { const g = flowC.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`; g.fillRect(Math.random() * 256, Math.random() * 64, 20 + Math.random() * 60, 2 + Math.random() * 3); } }
  const flowT = new T.CanvasTexture(flowC); flowT.wrapS = flowT.wrapT = T.RepeatWrapping; flowT.repeat.set(8, 2); own.push(flowT);
  const deep = new T.Mesh(new T.PlaneGeometry(120, L + 12, 60, 16), new T.MeshStandardMaterial({ color: P.water || 0x5a3a24, map: flowT, emissive: s.theme === 'lava' ? 0xff5a10 : 0x000000, emissiveIntensity: s.theme === 'lava' ? 1.1 : 0, roughness: s.theme === 'ice' ? 0.15 : 0.35, metalness: 0.1 }));
  deep.rotation.x = -Math.PI / 2; deep.position.set(0, -11.5, -L / 2); scene.add(deep); own.push(deep.geometry, deep.material);
  const dpos = deep.geometry.attributes.position, dbase = Float32Array.from(dpos.array);
  // Berge in zwei Reihen (vorne kräftiger, hinten blasser) für Tiefe
  const band = (seed, h0, amp, col, snow) => vox((B) => s3Band(B, 150, (x) => h0 + Math.abs(((x * 1.2 + seed) % 46) - 23) * amp + Math.sin(x * 0.37 + seed) * 1.6,
    (x, y, z, h) => (snow && y > h - 5 ? 0xffffff : rwPatch(col, 0.08, 4)(x, y, z)), 5), { u: 1.4, iter: 2 });
  const farCol = new T.Color(P.far), skyCol = new T.Color(TH.sky[1]);
  const mt1 = mesh(band(11, 8, 1.1, farCol.getHex(), s.theme === 'ice' || s.theme === 'canyon' && false), false); mt1.position.set(-105, -8, -L - 40); scene.add(mt1);
  const mt2 = mesh(band(29, 14, 1.4, farCol.clone().lerp(skyCol, 0.45).getHex(), s.theme !== 'lava'), false); mt2.position.set(-120, -8, -L - 85); scene.add(mt2);
  // Wolken
  const cloudG = vox((B) => s3Cloud(B, 4), { u: 0.45, iter: 3, field: 1.3 });
  const clouds = [];
  if (s.theme !== 'lava') for (let i = 0; i < 6; i++) { const c = mesh(cloudG, false); c.position.set(-40 + i * 16, 14 + (i % 3) * 3, -L - 30 - (i % 2) * 25); c.userData.v = 0.4 + (i % 3) * 0.2; scene.add(c); clouds.push(c); }
  // Deko: viele Pflanzen/Steine auf beiden Ufern
  const decoGeo = s.theme === 'jungle' ? vox((B) => s3Tree(B, 22, 0x3daa5b), { u: 0.13, iter: 2 }) : s.theme === 'ice' ? vox((B) => s3Pine(B, 26, 0x2f6b4a, true), { u: 0.12, iter: 2 })
    : s.theme === 'canyon' ? vox((B) => { B.cyl(0, 0, 0, 16, 2, 0x3d8a4a); B.cyl(4, 0, 7, 13, 1.4, 0x3d8a4a); B.box(1, 7, -1, 3, 8, 1, 0x3d8a4a); B.cyl(-4, 0, 5, 11, 1.4, 0x3d8a4a); B.box(-3, 5, -1, -1, 6, 1, 0x3d8a4a); B.ell(0, 17, 0, 1.5, 1.5, 1.5, 0xff6f91); }, { u: 0.1, iter: 2 })
      : vox((B) => { B.ell(0, 3, 0, 5, 4, 4, 0x2a2430); B.ell(1, 6, 0, 2, 1.5, 2, 0xff7a1a, { mat: 2 }); }, { u: 0.14, iter: 2 });
  const rockG = vox((B) => { B.ell(0, 1, 0, 5, 3.5, 4, rwMix(P.rock, P.rock2, 0.4, 2, 3), { keep: (x, y) => y >= 0 }); B.ell(4, 0, 2, 3, 2.5, 2.5, rnShade(P.rock, 0.08), { keep: (x, y) => y >= 0 }); }, { u: 0.12, iter: 2 });
  const flowerG = vox((B) => { for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 1 + (k % 3); B.bar([Math.cos(a) * r, 0, Math.sin(a) * r], [Math.cos(a) * r, 3 + (k % 2), Math.sin(a) * r], 0.4, 0x3d8a4a); B.ell(Math.cos(a) * r, 4 + (k % 2), Math.sin(a) * r, 0.9, 0.7, 0.9, [0xff6f91, 0xffd166, 0xffffff, 0xb06bff][k % 4]); } }, { u: 0.07, iter: 1 });
  const place = (g, x, z, sc = 1) => { const m = mesh(g); m.position.set(x, 0, z); m.rotation.y = x * 1.7 + z; m.scale.setScalar(sc); scene.add(m); return m; };
  for (const [x, z, sc] of [[-6, 0.5, 1.1], [6.4, 1.2, 1], [-10, 3, 1.3], [11, 2.5, 1.2], [-15, 1, 1], [16, 0.8, 1.1], [-21, 2, 1.2], [22, 3, 1]]) place(decoGeo, x, z, sc);
  for (const [x, z, sc] of [[-4.5, -L - 3, 1.1], [5, -L - 4.5, 1.2], [-9, -L - 2.5, 1], [10, -L - 2, 1.1], [-14, -L - 5, 1.3], [15, -L - 6, 1], [-20, -L - 3, 1.1], [21, -L - 4, 1.2]]) place(decoGeo, x, z, sc);
  for (const [x, z] of [[-3.2, 1.6], [3.6, 2.4], [-8, -L - 1.4], [7.5, -L - 1.2], [-12.5, 0.9], [13, -L - 1.6]]) place(rockG, x, z, 0.9);
  if (s.theme === 'jungle' || s.theme === 'canyon') for (const [x, z] of [[-2.6, 0.9], [2.8, 1.4], [-5, -L - 1.3], [3.8, -L - 2.2], [-7.5, 2.2], [8.2, 1.8]]) place(flowerG, x, z, 1);

  /* ---------- Besonderes je Landschaft ---------- */
  const extras = [];
  if (s.theme === 'jungle') {
    // Wasserfall an der hinteren Felswand, mit Gischt unten
    // Wasser-Streifen mit weichen Rändern (Alpha) – fliesst nach unten
    const wfC = document.createElement('canvas'); wfC.width = 64; wfC.height = 256;
    { const g = wfC.getContext('2d'); g.clearRect(0, 0, 64, 256);
      for (let i = 0; i < 90; i++) { const x0 = 6 + Math.random() * 52, a = 0.35 + Math.random() * 0.5; g.fillStyle = `rgba(${200 + Math.random() * 55},${235 + Math.random() * 20},255,${a})`; g.fillRect(x0, Math.random() * 256, 2 + Math.random() * 5, 30 + Math.random() * 90); }
      const edge = g.createLinearGradient(0, 0, 64, 0); edge.addColorStop(0, 'rgba(0,0,0,1)'); edge.addColorStop(0.18, 'rgba(0,0,0,0)'); edge.addColorStop(0.82, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = edge; g.fillRect(0, 0, 64, 256); g.globalCompositeOperation = 'source-over'; }
    const wfT = new T.CanvasTexture(wfC); wfT.wrapT = T.RepeatWrapping; wfT.repeat.set(1, 2.5); own.push(wfT);
    const wfT2 = wfT.clone(); wfT2.repeat.set(1.2, 1.6); wfT2.needsUpdate = true; own.push(wfT2);
    for (const x of [-7.5, 9]) {
      for (const [tex, w, z, op] of [[wfT, 2.6, -L - 0.05, 0.95], [wfT2, 3.2, -L + 0.1, 0.55]]) {
        const g = new T.PlaneGeometry(w, 11.6, 1, 8);
        const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + (5.8 - y) * 0.035)); p.setZ(i, (5.8 - y) * 0.06); } // unten breiter, leicht nach vorne
        const wf = new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, color: 0xdff4ff }));
        own.push(g, wf.material); wf.position.set(x, -5.8, z); scene.add(wf);
      }
      for (let k = 0; k < 3; k++) { const mist = typeof fxGlow === 'function' ? fxGlow(T, 0xffffff, 4 + k * 1.5, 0.45 - k * 0.1) : null; if (mist) { mist.position.set(x + (k - 1) * 0.8, -11 + k * 0.4, -L + 0.6); scene.add(mist); } }
    }
    extras.push((dt) => { wfT.offset.y += dt * 0.9; wfT2.offset.y += dt * 1.3; }); // nach unten
    // Tempel-Ruine in der Ferne
    const temple = mesh(vox((B) => { for (let k = 0; k < 6; k++) B.box(-12 + k * 2, k * 3, -12 + k * 2, 12 - k * 2, k * 3 + 2, 12 - k * 2, rwMix(0x8a8f7a, 0x4f8a5a, 0.4, 2, k)); B.box(-2, 18, -2, 2, 22, 2, 0x6b705c); }, { u: 0.5, iter: 1 }), false);
    temple.position.set(13, 0, -L - 7.5); temple.scale.setScalar(0.42); temple.rotation.y = -0.4; scene.add(temple);
  }
  if (s.theme === 'canyon') {
    // Tafelberge und Felsbogen in der Ferne, Heissluftballon
    const mesa = vox((B) => { for (let y = 0; y <= 26; y++) { const r = y > 22 ? 10 : 9 - Math.sin(y * 0.5) * 0.6; B.cyl(0, 0, y, y, r, (x, yy) => ((yy % 6) < 2 ? 0xb8552f : rwPatch(0xd06a3a, 0.08, 3)(x, yy, 0)), { sx: 1.6 }); } }, { u: 0.7, iter: 1 });
    for (const [x, z, sc] of [[-26, -L - 30, 1], [24, -L - 38, 1.3], [-6, -L - 55, 1.6]]) { const m = mesh(mesa, false); m.position.set(x, -10, z); m.scale.setScalar(sc); scene.add(m); }
    const balloon = new T.Group();
    const bm = mesh(vox((B) => { B.ell(0, 14, 0, 9, 10, 9, (x, y, z) => ((Math.round(Math.atan2(z, x) * 3) % 2) ? 0xff5a5f : 0xffd166)); B.cyl(0, 0, 0, 3, 3, 0x8b5a2b); for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) B.bar([a, 3, b], [a * 2, 6, b * 2], 0.3, 0x5b3a22); }, { u: 0.12, iter: 2 }), false);
    balloon.add(bm); balloon.position.set(-8, 9, -L - 16); scene.add(balloon);
    extras.push((dt, t) => { balloon.position.y = 9 + Math.sin(t * 0.4) * 1.2; balloon.position.x = -8 + Math.sin(t * 0.07) * 6; });
  }
  if (s.theme === 'ice') {
    // Polarlicht am Himmel (wehende, leuchtende Bänder)
    const auC = document.createElement('canvas'); auC.width = 4; auC.height = 128;
    { const g = auC.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(140,90,255,0)'); gr.addColorStop(0.45, 'rgba(120,255,190,.9)'); gr.addColorStop(1, 'rgba(60,255,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); }
    const auT = new T.CanvasTexture(auC); own.push(auT);
    const bands = [];
    for (let i = 0; i < 3; i++) {
      const g = new T.PlaneGeometry(70, 10, 40, 1); own.push(g);
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: auT, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
      own.push(m.material); m.position.set(-5 + i * 6, 22 + i * 3, -L - 60 - i * 10); m.rotation.x = 0.25; scene.add(m); bands.push({ m, base: Float32Array.from(g.attributes.position.array), i });
    }
    extras.push((dt, t) => bands.forEach(({ m, base, i }) => { const p = m.geometry.attributes.position; for (let k = 0; k < p.count; k++) p.array[k * 3 + 2] = base[k * 3 + 2] + Math.sin(base[k * 3] * 0.12 + t * 0.6 + i) * 4; p.needsUpdate = true; m.material.opacity = 0.4 + Math.sin(t * 0.5 + i) * 0.15; }));
    // Iglu
    const igloo = mesh(vox((B) => { B.ell(0, 0, 0, 9, 8, 9, (x, y, z) => ((y % 3 === 0 || Math.round(Math.atan2(z, x) * 4) % 3 === 0) ? 0xd8e8f8 : 0xf4f9ff), { keep: (x, y) => y >= 0 }); B.cut((x, y, z) => z > 4 && Math.abs(x) < 3 && y < 5); B.tube('z', 6, 11, 0, 2, 3.4, 0xeaf3ff, { keep: (x, y) => y >= 0 }); B.cut((x, y, z) => z > 5 && Math.abs(x) < 2 && y < 4); }, { u: 0.14, iter: 2 }));
    igloo.position.set(-6, 0, -L - 4); igloo.rotation.y = 0.5; scene.add(igloo);
  }
  if (s.theme === 'lava') {
    // Vulkan mit glühendem Krater und Rauch
    const volc = mesh(vox((B) => { for (let y = 0; y <= 34; y++) { const r = 26 - y * 0.62; B.cyl(0, 0, y, y, r, (x, yy) => (yy > 31 ? 0xff7a1a : rwMix(0x3a3440, 0x26222c, 0.4, 3, 2)(x, yy, 0)), { mat: y > 31 ? 2 : 0 }); } B.cut((x, y, z) => y > 30 && x * x + z * z < 30); for (let k = 0; k < 6; k++) B.curve([[Math.sin(k) * 8, 30, Math.cos(k) * 8], [Math.sin(k) * 14, 18, Math.cos(k) * 14], [Math.sin(k) * 20, 4, Math.cos(k) * 20]], 0.9, 0xff5a10, { mat: 2 }); }, { u: 0.8, iter: 1 }), false);
    volc.position.set(10, -10, -L - 45); scene.add(volc);
    const glowV = typeof fxGlow === 'function' ? fxGlow(T, 0xff6a1a, 26, 0.6) : null; if (glowV) { glowV.position.set(10, 18, -L - 45); scene.add(glowV); }
    const smokeM = []; for (let i = 0; i < 8; i++) { const sp = typeof fxGlow === 'function' ? fxGlow(T, 0x3a3236, 10, 0.5) : null; if (!sp) break; sp.material.blending = T.NormalBlending; sp.userData.t = i / 8; scene.add(sp); smokeM.push(sp); }
    extras.push((dt) => smokeM.forEach((sp) => { sp.userData.t = (sp.userData.t + dt * 0.06) % 1; const k = sp.userData.t; sp.position.set(10 + Math.sin(k * 6) * 3 + k * 8, 18 + k * 30, -L - 45); sp.scale.setScalar(8 + k * 26); sp.material.opacity = 0.55 * Math.sin(k * Math.PI); }));
  }
  // schwebende Teilchen: Glut (Vulkan), Schnee (Eis), Pollen (sonst)
  {
    const N = 160, pg = new T.BufferGeometry(), pp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pp[i * 3] = (Math.random() - 0.5) * 40; pp[i * 3 + 1] = Math.random() * 14 - 4; pp[i * 3 + 2] = 4 - Math.random() * (L + 16); }
    pg.setAttribute('position', new T.BufferAttribute(pp, 3)); own.push(pg);
    const pm = new T.PointsMaterial({ color: s.theme === 'lava' ? 0xffa040 : s.theme === 'ice' ? 0xffffff : 0xfff6c0, size: s.theme === 'ice' ? 0.12 : 0.07, transparent: true, opacity: 0.85, depthWrite: false, blending: s.theme === 'lava' ? T.AdditiveBlending : T.NormalBlending }); own.push(pm);
    scene.add(new T.Points(pg, pm));
    const vy = s.theme === 'lava' ? 1.2 : s.theme === 'ice' ? -1.0 : 0.15;
    extras.push((dt, t) => { for (let i = 0; i < N; i++) { pp[i * 3 + 1] += vy * dt; pp[i * 3] += Math.sin(t + i) * dt * 0.3; if (pp[i * 3 + 1] > 12) pp[i * 3 + 1] = -8; if (pp[i * 3 + 1] < -8) pp[i * 3 + 1] = 12; } pg.attributes.position.needsUpdate = true; });
  }
  extras.push((dt) => { clouds.forEach((c) => { c.position.x += c.userData.v * dt; if (c.position.x > 60) c.position.x = -60; }); flowT.offset.x += dt * (s.theme === 'lava' ? 0.02 : s.theme === 'ice' ? 0 : 0.08); });
  // Pfosten und Handlauf-Seile
  const postG = vox((B) => { B.box(-1, 0, -1, 1, 11, 1, rnVar(P.post, 0.06)); B.ell(0, 11, 0, 1.6, 1.3, 1.6, rnShade(P.post, 0.1)); }, { u: 0.1, iter: 1 });
  const posts = [];
  for (const z of [0.5, -L - 0.55]) for (const x of [-B3.W / 2 - 0.15, B3.W / 2 + 0.15]) { const m = mesh(postG); m.position.set(x, 0, z); scene.add(m); posts.push(m); }
  const ropeM = new T.MeshStandardMaterial({ color: P.rope, roughness: 0.9 }); own.push(ropeM);
  const sag = (z) => TH.sag * 9 * Math.sin(Math.PI * Math.min(1, Math.max(0, -z / L)));
  if (TH.ropes) for (const x of [-B3.W / 2 - 0.15, B3.W / 2 + 0.15]) {
    const pts = Array.from({ length: 30 }, (_, i) => { const z = 0.5 - (L + 1.05) * i / 29; return new T.Vector3(x, 1.05 - sag(z) * 0.8, z); });
    const rg = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 80, 0.035, 6, false); own.push(rg);
    const r = new T.Mesh(rg, ropeM); r.castShadow = true; scene.add(r);
  }
  const plankY = (z) => -sag(z);
  // Ziel: Fahne und prächtige Schatzkiste (Holz, Eisenbänder, goldene Ecken, Schloss), innen Münzen
  const CH = { x: 1.5, z: -L - 2.2 };
  const flagPole = mesh(vox((B) => B.cyl(0, 0, 0, 30, 0.7, 0x5b3a22), { u: 0.07, iter: 1 })); flagPole.position.set(-1.8, 0, -L - 1.8); scene.add(flagPole);
  const flag = mesh(vox((B) => { for (let x = 0; x <= 12; x++) B.box(x, Math.round(-x * 0.3), 0, x, Math.round(7 - x * 0.3), 0, 0xff5a5f); }, { u: 0.07, iter: 1 })); flag.position.set(-1.78, 1.55, -L - 1.8); scene.add(flag);
  const chest = new T.Group(); chest.position.set(CH.x, 0, CH.z); chest.rotation.y = -0.45; scene.add(chest);
  const wood = (x, y, z) => rnShade(0x8b5a2b, ((Math.floor((x + 20) / 4) % 2) ? 0.06 : -0.04) + (s3Rand(x * 7 + y * 3 + z) - 0.5) * 0.06);
  const chestBody = mesh(vox((B) => {
    B.box(-12, 0, -8, 12, 14, 8, wood);
    B.box(-11, 13, -7, 11, 14, 7, 0x3a2412);                                   // dunkler Rand innen
    for (const x of [-12, -4, 4, 12]) B.box(x, 0, -8, x, 14, 8, 0x4a4a55, 3);   // Eisenbänder
    for (const [x, z] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) for (const y of [0, 14]) B.ell(x, y, z, 1.6, 1.6, 1.6, 0xf5c518, { mat: 3 }); // goldene Ecken
    B.box(-3, 7, 8, 3, 13, 9, 0xf5c518, 3); B.box(-1, 8, 9, 1, 11, 10, 0x2a1a0a);  // Schloss
  }, { u: 0.045, iter: 2 }));
  chest.add(chestBody);
  const coinsPile = mesh(vox((B) => { B.ell(0, 13, 0, 10, 4, 6, (x, y, z) => ((x + y + z) % 3 ? 0xffd54a : 0xf5b400), { mat: 3, keep: (x, y) => y >= 13 }); for (let k = 0; k < 8; k++) B.ell(-8 + k * 2.2, 16 + (k % 2), (k % 3) - 1, 1.6, 0.6, 1.6, 0xffe680, { mat: 3 }); B.ell(4, 17, 1, 1.5, 1.5, 1.5, 0x3ad6ff, { mat: 1 }); B.ell(-5, 17, -1, 1.3, 1.3, 1.3, 0xff4d6d, { mat: 1 }); }, { u: 0.045, iter: 2 }));
  chest.add(coinsPile);
  const lidPivot = new T.Group(); lidPivot.position.set(0, 14 * 0.045, -8 * 0.045); chest.add(lidPivot);
  const lid = mesh(vox((B) => { B.tube('x', -12, 12, 8, 0, 8, wood, { keep: (x, y) => y >= 0 }); for (const x of [-12, -4, 4, 12]) B.tube('x', x, x, 8, 0, 8.4, 0x4a4a55, { mat: 3, keep: (xx, y) => y >= 0 }); B.box(-3, 0, 15, 3, 4, 17, 0xf5c518, 3); }, { u: 0.045, iter: 2 }));
  lidPivot.add(lid);
  const gold = new T.PointLight(0xffd54a, 0, 5); gold.position.set(0, 1.2, 0.3); chest.add(gold);
  const coinGeo = new T.CylinderGeometry(0.13, 0.13, 0.03, 20); const coinMat = new T.MeshStandardMaterial({ color: 0xffcf33, metalness: 0.9, roughness: 0.25, emissive: 0x553300, emissiveIntensity: 0.3 }); own.push(coinGeo, coinMat);

  /* ---------- Bretter ---------- */
  const ice = s.theme === 'ice';
  const plankGeo = vox((B) => {
    const nx = Math.round(B3.W / 0.1), nz = Math.round((B3.D - 0.08) / 0.1);
    B.box(0, -1, 0, nx, 0, nz, (x, y, z) => (ice ? (y === 0 ? 0xb8dcf7 : 0x6fa9de) : (x === 2 || x === nx - 2) && y === 0 && (z === 2 || z === nz - 2) ? 0x3a3a3a : rnShade(P.plank, (s3Rand(Math.floor(z / 3) + x * 0.01) - 0.5) * 0.14 + (x % 7 === 0 ? -0.08 : 0) + (y === 0 ? 0.05 : -0.05))), ice ? 1 : 0);
  }, { u: 0.1, iter: 1, field: 0.9 });
  plankGeo.translate(-B3.W / 2, 0, -(B3.D - 0.08) / 2);
  const hangM = new T.MeshStandardMaterial({ color: P.rope }); const hangG = new T.CylinderGeometry(0.02, 0.02, 1, 5); own.push(hangM, hangG);
  const makePlank = () => {
    const g = new T.Group(), m = mesh(plankGeo); g.add(m);
    if (TH.ropes) for (const x of [-B3.W / 2 - 0.12, B3.W / 2 + 0.12]) { const h = new T.Mesh(hangG, hangM); h.position.set(x, 0.5, 0); g.add(h); }
    return g;
  };
  // Platz für das nächste Brett: leuchtender Rahmen
  const ghostM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const ghostG = new T.EdgesGeometry(new T.BoxGeometry(B3.W, 0.12, B3.D - 0.08)); own.push(ghostM, ghostG);
  const ghost = new T.LineSegments(ghostG, ghostM); scene.add(ghost);
  const planks = [];
  for (let i = 0; i < s.placed; i++) { const p = makePlank(); p.position.set(0, plankY(slotZ(i)), slotZ(i)); scene.add(p); planks.push(p); }

  /* ---------- Avatar ---------- */
  const cfg = w3Saved('a3'); delete cfg.fresh;
  const fig = vxFigure(T, a3Look(cfg));
  fig.update(0.016);
  const fb = new T.Box3().setFromObject(fig.root), figH = Math.max(1, fb.max.y - fb.min.y);
  const hero = new T.Group(); hero.add(fig.root); fig.root.scale.setScalar(1.55 / figH);
  fig.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  hero.rotation.y = Math.PI; // Rücken zur Kamera
  const st0 = s.placed ? slotZ(s.placed - 1) : 0.9;
  hero.position.set(0, s.placed ? plankY(st0) + 0.06 : 0, st0);
  scene.add(hero);
  fig.setAnim('idle');

  /* ---------- Teilchen (Staub, Splitter, Funken) ---------- */
  const parts = [];
  const pG = new T.BoxGeometry(0.06, 0.06, 0.06); own.push(pG);
  const puff = (pos, color, n = 14, up = 1.5) => {
    const m = new T.MeshBasicMaterial({ color, transparent: true }); own.push(m);
    for (let i = 0; i < n; i++) { const o = new T.Mesh(pG, m); o.position.copy(pos); const a = Math.random() * 6.3; o.userData = { v: new T.Vector3(Math.cos(a) * (0.6 + Math.random()), up * (0.5 + Math.random()), Math.sin(a) * (0.6 + Math.random())), life: 0.8 + Math.random() * 0.4 }; scene.add(o); parts.push(o); }
  };

  /* ---------- Bewegung, Kamera ---------- */
  const camPos = new T.Vector3(), camLook = new T.Vector3();
  let shake = 0, zoom = 0; // Kamera-Momente: Wackeln (bricht), Heranfahren (Schatzkiste)
  const camTarget = () => { const p = hero.position; return [new T.Vector3(p.x + 0.35, p.y + B3.CAM.up, p.z + B3.CAM.back), new T.Vector3(p.x, p.y - 1.6, p.z - B3.CAM.look)]; };
  { const [a, b] = camTarget(); camPos.copy(a); camLook.copy(b); }
  const tweens = [];
  const tween = (ms, fn) => new Promise((res) => tweens.push({ t: 0, ms: ms / 1000, fn, res }));
  let alive = true, raf = 0, last = performance.now(), t = 0, W = 0, H = 0;
  let PH = -1;
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight, ph = ($('#br-panel')?.parentElement === stage ? ($('#br-panel .br-opts, #br-panel .br-form')?.offsetHeight || 0) + 24 : 0);
    if (w === W && h === H && ph === PH) return;
    PH = ph;
    W = w; H = h; renderer.setSize(w, h, false); cv.style.width = `${w}px`; cv.style.height = `${h}px`; post?.setSize(w, h);
    cam.aspect = w / h; cam.fov = w / h < 0.9 ? 68 : 52;
    const pv = Math.min(h * 0.45, ($('#br-panel')?.parentElement === stage ? ph : 0));
    if (pv > 0) cam.setViewOffset(w, h + pv, 0, pv, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  const loop = (now) => {
    if (!alive) return;
    if (G.id !== gid || !stage.isConnected) { ctl.dispose(); return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t += dt;
    fit();
    for (const tw of tweens.slice()) { tw.t += dt; const k = Math.min(1, tw.t / tw.ms); tw.fn(k); if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.res(); } }
    fig.update(dt);
    // Wasser/Lava bewegen
    for (let i = 0; i < dpos.count; i++) dpos.array[i * 3 + 2] = dbase[i * 3 + 2] + Math.sin(dbase[i * 3] * 0.8 + t * 1.6) * 0.12 + Math.cos(dbase[i * 3 + 1] * 0.5 + t) * 0.12;
    dpos.needsUpdate = true;
    if (s.theme === 'lava') deep.material.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.15;
    flag.rotation.y = Math.sin(t * 3) * 0.3;
    for (const f of extras) f(dt, t);
    for (const c of coins) { if (c.rest) continue; c.v.y -= 9.5 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.spin * dt; c.m.rotation.z += c.spin * 0.6 * dt; if (c.m.position.y < 0.02 && c.v.y < 0) { if (Math.abs(c.v.y) > 1.2) { c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; if (typeof sfxx === 'function' && Math.random() < 0.35) sfxx('clink'); } else { c.rest = true; c.m.position.y = 0.015; c.m.rotation.set(0, Math.random() * 6, 0); } } }
    // nächster Platz blinkt
    const nz = slotZ(ctl.next);
    ghost.visible = ctl.next < s.n; ghost.position.set(0, plankY(nz) - 0.05, nz); ghostM.opacity = 0.2 + Math.abs(Math.sin(t * 2.5)) * 0.4;
    for (const o of parts.slice()) { const d = o.userData; d.life -= dt; d.v.y -= 6 * dt; o.position.addScaledVector(d.v, dt); o.rotation.x += dt * 5; if (d.life <= 0) { scene.remove(o); parts.splice(parts.indexOf(o), 1); } }
    // Kamera folgt sanft
    const [cp, cl] = camTarget();
    camPos.lerp(cp, Math.min(1, dt * 2.5)); camLook.lerp(cl, Math.min(1, dt * 2.5));
    cam.position.copy(camPos);
    if (zoom > 0) cam.position.lerp(camLook, zoom * 0.15); // nur leicht heranfahren: Avatar, Kiste und Münzen bleiben im Bild
    if (shake > 0) { shake = Math.max(0, shake - dt * 1.8); cam.position.x += (Math.random() - 0.5) * shake * 0.35; cam.position.y += (Math.random() - 0.5) * shake * 0.25; }
    cam.lookAt(camLook);
    sun.position.set(hero.position.x - 5, 10, hero.position.z + 4); sun.target.position.set(hero.position.x, 0, hero.position.z - 2);
    meter(dt);
    if (post) post.render(); else renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  const coins = [];
  const walkTo = async (z, ms) => {
    const z0 = hero.position.z;
    fig.setAnim('run'); fig.setRate(0.6);
    const steps = Math.max(1, Math.round(ms / 260));
    for (let k = 0; k < steps; k++) setTimeout(() => { if (ctl.alive && typeof sfxx === 'function') sfxx('step'); }, k * 260 + 60);
    await tween(ms, (k) => { const zz = z0 + (z - z0) * k; hero.position.z = zz; hero.position.y = (zz < 0 && zz > -L ? plankY(zz) + 0.06 : 0) + Math.abs(Math.sin(k * Math.PI * 2)) * 0.03; });
    fig.setRate(1);
  };
  const ctl = {
    alive: true, next: s.placed,
    /** richtige Antwort: Brett i fliegt an seinen Platz, dann ein Schritt nach vorne */
    async place(i) {
      const z = slotZ(i), p = makePlank(); scene.add(p); planks.push(p);
      fig.setAnim(i % 3 === 2 ? 'cheer' : 'clap');
      const rot = (Math.random() - 0.5) * 2;
      tone([523, 784], 0.07, 'triangle', 0.08);
      await tween(560, (k) => { const e = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2); p.position.set(0, plankY(z) + 5 * (1 - e), z); p.rotation.set(rot * (1 - k), rot * 0.5 * (1 - k), 0); });
      if (typeof sfxx === 'function') sfxx('thud'); else tone([196], 0.06, 'square', 0.05);
      puff(new T.Vector3(0, plankY(z), z), s.theme === 'ice' ? 0xffffff : 0xd8c8a8, 16, 1.2);
      ctl.next = i + 1;
      await walkTo(z, 520);
      fig.setAnim('idle');
    },
    /** falsche Antwort: Brett erscheint, bricht entzwei und stürzt in die Tiefe */
    async fail(i) {
      const z = slotZ(i), p = makePlank(); scene.add(p);
      fig.setAnim('oops');
      await tween(380, (k) => { p.position.set(0, plankY(z) + 3 * (1 - k * k), z); });
      await tween(380, (k) => { p.rotation.z = Math.sin(k * 40) * 0.06; });
      scene.remove(p);
      // zwei Hälften
      const halves = [-1, 1].map((sx) => { const h = makePlank(); h.scale.x = 0.5; h.position.set(sx * B3.W / 4, plankY(z), z); scene.add(h); return h; });
      puff(new T.Vector3(0, plankY(z), z), P.plank, 22, 0.8);
      shake = 0.9;
      tone([140, 90], 0.25, 'sawtooth', 0.05);
      await tween(1300, (k) => { halves.forEach((h, j) => { const sx = j ? 1 : -1; h.position.y = plankY(z) - 14 * k * k; h.position.x = sx * (B3.W / 4 + k * 1.2); h.rotation.z = sx * k * 3; h.rotation.x = k * 2; }); });
      halves.forEach((h) => scene.remove(h));
      fig.setAnim('shy');
      setTimeout(() => ctl.alive && fig.anim === 'shy' && fig.setAnim('idle'), 900);
    },
    /** fertig: ans andere Ufer laufen, Kiste geht auf, jubeln */
    async finish() {
      await walkTo(-L - 1.25, 1300);
      const face = Math.atan2(CH.x - hero.position.x, CH.z - hero.position.z);
      await tween(350, (k) => { hero.rotation.y = Math.PI + (face - Math.PI) * k; });
      fig.setAnim('present');
      await tween(700, (k) => { zoom = k * k * (3 - 2 * k); });
      // Deckel geht auf, Goldschein, Münzen springen heraus
      if (typeof sfxx === 'function') sfxx('whoosh');
      await tween(700, (k) => { const e = 1 - Math.pow(1 - k, 3); lidPivot.rotation.x = -e * 1.95; gold.intensity = e * 4; });
      if (typeof sfxx === 'function') sfxx('chime');
      const top = new T.Vector3(); chest.localToWorld(top.set(0, 0.75, 0));
      for (let i = 0; i < 28; i++) {
        const m = new T.Mesh(coinGeo, coinMat); m.castShadow = true; m.position.copy(top); scene.add(m);
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2;
        coins.push({ m, v: new T.Vector3(Math.cos(a) * sp, 4 + Math.random() * 3.5, Math.sin(a) * sp), spin: 8 + Math.random() * 12 });
      }
      puff(top, 0xffd54a, 30, 3.2);
      await tween(900, () => {});
      await tween(400, (k) => { hero.rotation.y = face + (0 - face) * k; zoom = 1 - k * 0.6; });
      fig.setAnim('cheer');
      setTimeout(() => ctl.alive && fig.setAnim('dance'), 1600);
    },
    dispose() {
      if (!ctl.alive) return;
      ctl.alive = false; alive = false; cancelAnimationFrame(raf);
      try { post?.dispose(); fig.dispose(); own.forEach((x) => x.dispose?.()); skyTex.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); } catch { /* egal */ }
      cv.remove(); vig.remove(); stage.classList.remove('b3d');
    },
  };
  let post = null;
  fit();
  // Leuchten (Lava, Sonne, Funken) – nur wenn das Gerät es schafft
  if (typeof fxBloom === 'function') fxBloom(renderer, scene, cam, { strength: s.theme === 'lava' ? 0.9 : 0.45, radius: 0.6, threshold: s.theme === 'lava' ? 0.7 : 0.85 }).then((p) => { if (ctl.alive) post = p; else p?.dispose(); });
  const meter = typeof fxMeter === 'function' ? fxMeter(() => { post?.dispose(); post = null; renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); renderer.setPixelRatio(1); W = 0; fit(); }) : () => {};
  const vig = document.createElement('div'); vig.className = 'fx-vig'; vig.setAttribute('aria-hidden', 'true'); stage.appendChild(vig);
  // Sonne am Himmel mit Schein
  if (typeof fxGlow === 'function') { const sg2 = fxGlow(T, s.theme === 'lava' ? 0xff7a3a : 0xfff0c0, 26, s.theme === 'lava' ? 0.5 : 0.8); sg2.position.set(-14, 16, -L - 60); scene.add(sg2); }
  raf = requestAnimationFrame(loop);
  stage.classList.add('b3d');
  const prev = G.s3Cleanup;
  G.s3Cleanup = () => { try { prev?.(); } catch { /* egal */ } ctl.dispose(); };
  return ctl;
}
