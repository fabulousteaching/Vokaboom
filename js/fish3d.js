/* Vokaboom – Angeln als echte 3D-Szene
 *
 * Kamera schräg von oben vom Ufer auf den See: der Avatar steht vorne links auf dem Steg, die Fische schwimmen in der
 * Tiefe, die Wasseroberfläche spiegelt und wellt sich, am Grund tanzen Lichtmuster. Spritzer sind 3D-Tropfen.
 * Die Spiel-Logik (js/fishing.js) rechnet weiter in Bildschirm-Pixeln; diese Datei übersetzt sie in die 3D-Welt
 * (M: Pixel → Meter) und setzt die Wort-Schilder der Fische dorthin, wo die 3D-Fische zu sehen sind.
 * Ohne WebGL bleibt das Angeln wie bisher.
 */
'use strict';

async function f3Mount(stage) {
  if (!stage || typeof gavOK !== 'function' || !gavOK() || typeof w3LoadRunner !== 'function') return null;
  const gid = G.id;
  try { await w3Three(); await w3LoadRunner(); } catch (e) { console.warn('Angeln 3D laden', e); return null; }
  if (G.id !== gid || !stage.isConnected || typeof vxFigure !== 'function' || typeof rnBuilder !== 'function') return null;
  const T = w3T(), s = G.s, L = s.L, lv = s.fishLevel || 1;
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch { return null; }
  renderer.setPixelRatio(typeof fxPR === 'function' ? fxPR() : Math.min(1.75, window.devicePixelRatio || 1));
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = typeof fxQuality !== 'function' || fxQuality() === 'high'; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const cv = renderer.domElement; cv.className = 'f3-canvas'; cv.setAttribute('aria-hidden', 'true');
  stage.insertBefore(cv, stage.firstChild);
  const scene = new T.Scene();
  const own = [], mats = vxMaterials(T);
  const vox = (build, opts) => { const B = rnBuilder(); build(B); const g = rnGeo(T, B, opts); own.push(g); return g; };
  const mesh = (g, shadow = true) => { const m = new T.Mesh(g, mats); m.castShadow = shadow; m.receiveShadow = true; return m; };
  // Himmel
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256;
  { const g = skyC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, L.sky[0]); gr.addColorStop(1, L.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); }
  const skyT = new T.CanvasTexture(skyC); skyT.colorSpace = T.SRGBColorSpace; scene.background = skyT; own.push(skyT);
  scene.fog = new T.Fog(new T.Color(L.sky[1]), 40, 170);
  if (typeof w3Lights === 'function') w3Lights(T, scene, renderer, false);
  const sun = new T.DirectionalLight(0xfff2d8, 1.6); sun.position.set(-8, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 30, bottom: -30, near: 1, far: 80 }); sun.shadow.mapSize.set(2048, 2048); sun.target.position.set(0, -2, -10); scene.add(sun, sun.target);
  const cam = new T.PerspectiveCamera(48, 1, 0.1, 300);

  /* ---------- Pixel → Welt ---------- */
  const WX = 12, ZN = -0.4, ZF = 11;
  const M = (x, y) => {
    const W = s.W || 800, H = s.H || 500, wy = s.waterY || H * 0.4, kUp = 1.55 / (s.ah || 150);
    // links vom Angelplatz: Steg und Avatar; rechts davon: der Bereich, in dem die Fische schwimmen
    const sl = s.swimLeft || W * 0.3, XL = -WX / 2, XS = -2.2, XR = WX / 2;
    const X = x <= sl ? XL + (x / sl) * (XS - XL) : XS + ((x - sl) / Math.max(1, W - sl)) * (XR - XS);
    if (y <= wy) return new T.Vector3(X, (wy - y) * kUp, ZN);
    const k = Math.min(1.2, (y - wy) / Math.max(1, H - wy));
    return new T.Vector3(X, -0.3 - k * 0.5, ZN - 1.2 - k * ZF);
  };
  const tmp = new T.Vector3();
  const toScreen = (v) => { tmp.copy(v).project(cam); return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H }; };
  let W = 0, H = 0;

  /* ---------- Landschaft ---------- */
  // See-Grund mit Lichtmustern (Kaustik), Steine, Pflanzen
  const caC = document.createElement('canvas'); caC.width = caC.height = 256;
  { const g = caC.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; for (let i = 0; i < 46; i++) { g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256, r = 14 + Math.random() * 26; for (let a = 0; a <= 6.4; a += 0.5) g.lineTo(x + Math.cos(a) * r * (0.7 + Math.sin(a * 3 + i) * 0.3), y + Math.sin(a) * r * (0.7 + Math.cos(a * 2 + i) * 0.3)); g.stroke(); } }
  const caT = new T.CanvasTexture(caC); caT.wrapS = caT.wrapT = T.RepeatWrapping; caT.repeat.set(5, 5); own.push(caT);
  const floorM = new T.MeshStandardMaterial({ color: lv === 3 ? 0xd8c690 : 0x9c8b62, roughness: 0.95, emissive: 0x000000 }); // (kein Lichtmuster-Schimmern) own.push(floorM);
  const floor = new T.Mesh(new T.PlaneGeometry(320, 260), floorM); own.push(floor.geometry);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -2.6, -12); floor.receiveShadow = true; scene.add(floor);
  const rockG = vox((B) => { B.ell(0, 0, 0, 8, 5, 6, rwMix(0x8a8f96, 0x4f8a5a, 0.3, 2, 4), { keep: (x, y) => y >= 0 }); B.ell(6, 0, 2, 4, 3, 3, 0x9aa1a8, { keep: (x, y) => y >= 0 }); }, { u: 0.08, iter: 2 });
  const weedG = vox((B) => { for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= 8; i++) pts.push([k * 2 + Math.sin(i * 0.9 + k) * 1.5, i * 3, 0]); B.curve(pts, (t) => 1.1 - t * 0.6, lv === 3 ? [0xff6f91, 0xffb02e, 0xb06bff][k] : [0x3fa66a, 0x2f8a5a, 0x5bbf73][k]); } }, { u: 0.07, iter: 1, project: false });
  const weeds = [];
  for (let i = 0; i < 16; i++) { const m = mesh(i % 3 ? weedG : rockG, false); m.position.set(-8 + (i * 7.3) % 18, -2.6, -2 - (i * 3.7) % 14); m.rotation.y = i; m.scale.setScalar(0.8 + (i % 4) * 0.25); scene.add(m); if (i % 3) weeds.push(m); }
  // Wasseroberfläche: spiegelnd (Umgebung), leicht durchsichtig, Wellen über eine bewegte Normalen-Karte
  const nC = document.createElement('canvas'); nC.width = nC.height = 128;
  { const g = nC.getContext('2d'), id = g.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const a = Math.sin(x * 0.2 + Math.sin(y * 0.15) * 2) * 0.5 + Math.sin(y * 0.27 + x * 0.05) * 0.5; const b = Math.cos(y * 0.21 + Math.sin(x * 0.12) * 2) * 0.5 + Math.cos(x * 0.31 - y * 0.07) * 0.5; const o = (y * 128 + x) * 4; id.data[o] = 128 + a * 40; id.data[o + 1] = 128 + b * 40; id.data[o + 2] = 255; id.data[o + 3] = 255; } g.putImageData(id, 0, 0); }
  const nT = new T.CanvasTexture(nC); nT.wrapS = nT.wrapT = T.RepeatWrapping; nT.repeat.set(6, 4); own.push(nT);
  const waterM = new T.MeshStandardMaterial({ color: new T.Color(L.water[0]).lerp(new T.Color(L.water[1]), 0.35), transparent: true, opacity: 0.5, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.35, depthWrite: false }); // ruhige Oberfläche ohne Glitzern
  const water = new T.Mesh(new T.PlaneGeometry(320, 260, 160, 130), waterM); own.push(water.geometry, waterM);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0, -18); water.renderOrder = 2; scene.add(water);
  const wpos = water.geometry.attributes.position, wbase = Float32Array.from(wpos.array);
  // Ufer hinten in Schichten: Sandstrand, grüne Hügel mit Bäumen, hellere Hügel dahinter, Berge im Dunst
  if (lv !== 3) {
    const sand = mesh(vox((B) => { const c = (xx, y, z) => rnShade(0xe6d3a0, (s3Rand(xx * 7 + z * 3) - 0.5) * 0.08 + (z > 0 ? -0.1 : 0)); for (let x = 0; x <= 200; x++) B.box(x, 0, -5, x, 0, 2, c); }, { u: 0.6, iter: 1 }), false);
    sand.position.set(-60, -0.45, -32); scene.add(sand);
    const near = vox((B) => s3Band(B, 270, (x) => (lv === 2 ? 9 + Math.sin(x * 0.045) * 4 + Math.sin(x * 0.14) * 1.6 : 5 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.17) * 1.2),
      (x, y, z, h) => (y > h - 1 ? (lv === 2 ? 0x6fae6a : 0x86c97a) : rwPatch(lv === 2 ? 0x4f8a55 : 0x5fa864, 0.08, 4)(x, y, z)), 7), { u: 0.45, iter: 2 });
    const sh = mesh(near, false); sh.position.set(-60, -0.4, -36); scene.add(sh);
    const far = vox((B) => s3Band(B, 160, (x) => 6 + Math.sin(x * 0.05 + 2) * 3.5 + Math.sin(x * 0.13) * 1.5, (x, y, z, h) => (y > h - 1 ? 0x9cc79a : rwPatch(0x86b48e, 0.05, 4)(x, y, z)), 3), { u: 1.0, iter: 2 });
    const fh = mesh(far, false); fh.position.set(-80, -0.6, -58); scene.add(fh);
    const mtn = vox((B) => s3Band(B, 130, (x) => 10 + Math.abs(((x * 1.1 + 20) % 46) - 23) * 0.95 + Math.sin(x * 0.21) * 1.5,
      (x, y, z, h) => (y > h - (lv === 2 ? 7 : 3) && h > 22 ? 0xf4f7fb : rwPatch(0x8fa3bd, 0.05, 5)(x, y, z)), 3), { u: 1.6, iter: 2 });
    const mt = mesh(mtn, false); mt.position.set(-104, -0.8, -95); scene.add(mt);
  }
  const treeG = lv === 2 ? vox((B) => s3Pine(B, 24), { u: 0.14, iter: 2 }) : vox((B) => s3Tree(B, 20), { u: 0.15, iter: 2 });
  if (lv !== 3) for (let i = 0; i < 16; i++) { const t = mesh(treeG, false); const x = -30 + i * 4.1 + Math.sin(i * 2.3) * 1.4; t.position.set(x, 1.6 + Math.sin(x * 0.07) * 1.3 + (i % 2) * 0.4, -35.5 - (i % 3) * 1.6); t.scale.setScalar(0.85 + ((i * 7) % 4) * 0.12); t.rotation.y = i; scene.add(t); }
  if (lv === 3) {
    const isl = mesh(vox((B) => { B.ell(0, 0, 0, 30, 6, 14, (x, y) => (y > 3 ? 0x6fbf6a : 0xe8d39a), { keep: (x, y) => y >= 0 }); B.cyl(14, 0, 3, 30, 3, (x, y) => ((Math.floor(y / 5) % 2) ? 0xffffff : 0xe2483d)); B.cyl(14, 0, 31, 34, 3.6, 0x334155); B.cyl(14, 0, 35, 37, 2.2, 0xfff3a0, { mat: 2 }); }, { u: 0.25, iter: 2 }), false);
    isl.position.set(6, -0.3, -38); scene.add(isl);
  }
  // Sonne mit Schein
  if (typeof fxGlow === 'function') { const g = fxGlow(T, 0xfff0b0, 22, 0.9); g.position.set(14, 18, -60); scene.add(g); }
  // Wolken
  const cloudG = vox((B) => s3Cloud(B, 4), { u: 0.45, iter: 3, field: 1.3 });
  const clouds = []; for (let i = 0; i < 5; i++) { const c = mesh(cloudG, false); c.position.set(-30 + i * 14, 12 + (i % 2) * 3, -50 - (i % 3) * 8); c.userData.v = 0.4 + (i % 3) * 0.2; scene.add(c); clouds.push(c); }
  // Steg (vorne links, ins Wasser hinaus) mit Pfosten, Eimer
  const dockPx = () => ({ x0: 0, x1: (s.aw || 100) * 1.9 + (s.W || 800) * 0.03 });
  const dock = mesh(vox((B) => { for (let x = 0; x <= 34; x++) B.box(x, 0, -9, x, 1, 9, (xx, y) => (xx % 5 === 0 ? 0x5b3a22 : rnShade(0x9c6b3e, (s3Rand(Math.floor(xx / 5)) - 0.5) * 0.16 + (y === 1 ? 0.05 : 0)))); for (const px of [4, 17, 30]) B.tube('z', -9, 9, 0, -2, 2.4, (x, y, z) => ((Math.abs(z) % 6) < 1 ? 0x334155 : 0x2b5f8a), { mat: 1 }); }, { u: 0.12, iter: 1 })); // Schwimmkörper statt Stelzen
  scene.add(dock);
  const bucket = mesh(vox((B) => { B.cyl(0, 0, 0, 11, (y) => 5 + y * 0.22, (x, y) => (y > 9 ? 0xd8e1ea : rnShade(0x9fb2c5, (y % 4 === 0) ? -0.12 : 0)), { mat: 3 }); B.cyl(0, 0, 1, 11, (y) => 4 + y * 0.22, 0x3a4656); B.curve([[-7, 11, 0], [0, 18, 0], [7, 11, 0]], 0.5, 0x6b7a8c, { mat: 3 }); }, { u: 0.035, iter: 2 }));
  scene.add(bucket);
  const reedG = vox((B) => { for (let k = 0; k < 6; k++) { const x0 = k * 2.5, hh = 18 + (k % 3) * 6; B.curve([[x0, 0, (k % 2) * 2], [x0 + 1, hh * 0.6, 0], [x0 + 2.5, hh, 0]], 0.7, k % 2 ? 0x5f9e4a : 0x4a8a3a); if (k % 2 === 0) B.ell(x0 + 2.5, hh + 2, 0, 1.2, 3, 1.2, 0x6b4226); } }, { u: 0.06, iter: 1, project: false });
  const reeds = [];
  for (const [x, z] of [[-7.4, -1.6], [-8.2, -2.6]]) { const r = mesh(reedG, false); r.position.set(x, -0.3, z); scene.add(r); reeds.push(r); }

  /* ---------- Avatar (gleiche Steuerung wie js/gav3d.js) ---------- */
  const cfg = w3Saved('a3'); delete cfg.fresh;
  const fig = vxFigure(T, a3Look(cfg)); fig.update(0.016);
  const fb = new T.Box3().setFromObject(fig.root), figH = Math.max(1, fb.max.y - fb.min.y);
  fig.root.scale.setScalar(1.55 / figH);
  fig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const yaw = new T.Group(), tilt = new T.Group(), spinG = new T.Group();
  const hc = 0.78; spinG.position.y = hc; const inner = new T.Group(); inner.position.y = -hc; inner.add(fig.root); spinG.add(inner); tilt.add(spinG); yaw.add(tilt); scene.add(yaw);
  const handLocal = (() => { const arm = fig.parts?.armR; if (!arm) return null; fig.root.updateMatrixWorld(true); const b = new T.Box3().setFromObject(arm), inv = arm.matrixWorld.clone().invert(); return new T.Vector3((b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * 0.08, (b.min.z + b.max.z) / 2).applyMatrix4(inv); })();
  const av = { alive: true, fig, lean: 0, spinZ: 0, rotY: 0.6, scale: 1, sx: 1, sy: 1, lift: 0, alpha: 1, setAnim(n) { if (fig.anim !== n) fig.setAnim(n); }, handPx: () => null };
  // Angelrute (3D) und Schnur
  const rodM = new T.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.6 }); const rodG = new T.CylinderGeometry(0.018, 0.032, 1, 8); rodG.translate(0, 0.5, 0); own.push(rodM, rodG);
  const rod = new T.Mesh(rodG, rodM); rod.castShadow = true; scene.add(rod);
  const lineM = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }); own.push(lineM);
  const lineG = new T.BufferGeometry().setFromPoints(Array.from({ length: 16 }, () => new T.Vector3())); own.push(lineG);
  const line = new T.Line(lineG, lineM); scene.add(line);
  const bobber = new T.Mesh(new T.SphereGeometry(0.07, 12, 8), new T.MeshStandardMaterial({ color: 0xff4d4d, roughness: 0.4 })); own.push(bobber.geometry, bobber.material); scene.add(bobber);

  /* ---------- Fische ---------- */
  const fishObjs = new Map();
  function fishModel(el) {
    const kind = el.dataset.kind || 'classic', c1 = s3Hex(T, el.dataset.c1 || '#ff9f43'), c2 = s3Hex(T, el.dataset.c2 || '#ff6b6b');
    const look = S3_FISH_LOOK[kind] || {};
    const bw = el.offsetWidth - 34, Lb = Math.max(18, Math.round(bw / 4)); // längere Wörter → längere Fische
    const F = s3FishBuild(kind, look.c1 ?? c1, look.c2 ?? c2, Lb);
    const u = 0.075;
    const gb = vox(F.body, { u, iter: 3, field: 1.1 }), gt = vox(F.tail, { u, iter: 1, field: 0.8 });
    const g = new T.Group(), body = mesh(gb);
    const inner2 = new T.Group(); inner2.add(body);
    const tailPivot = new T.Group(); tailPivot.position.set(Lb * u - u * 1.5, F.h / 2 * u, 0);
    const tail = mesh(gt); tail.position.y = -50 * u; tailPivot.add(tail); inner2.add(tailPivot);
    // Augen auf beiden Seiten
    const eyeG = new T.SphereGeometry(F.eye.r * u, 12, 10), eyeW = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }), eyeB = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
    own.push(eyeG, eyeW, eyeB);
    for (const sz of [1, -1]) { const e = new T.Mesh(eyeG, eyeW); e.position.set(F.eye.x * u, F.eye.y * u, sz * F.eye.z * u); inner2.add(e); const p = new T.Mesh(eyeG, eyeB); p.scale.setScalar(0.55); p.position.set(F.eye.x * u - F.eye.r * u * 0.2, F.eye.y * u, sz * (F.eye.z * u + F.eye.r * u * 0.6)); inner2.add(p); }
    inner2.position.set(-(Lb * u + 0.5) / 2, -F.h * u / 2, 0);
    g.add(inner2);
    g.userData = { tail: tailPivot, ph: Math.random() * 6, len: Lb * u };
    scene.add(g);
    return g;
  }

  /* ---------- 3D-Spritzer, Ringe, Blasen ---------- */
  const dropG = new T.SphereGeometry(0.05, 8, 6), dropM = new T.MeshStandardMaterial({ color: 0xe6f6ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.9 }); own.push(dropG, dropM);
  const ringG = new T.RingGeometry(0.85, 1, 40), ringM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }); own.push(ringG, ringM);
  const parts = [], rings = [];
  const splash = (x, big) => {
    const p = M(x, s.waterY + 1); p.y = 0.02;
    const n = big ? 60 : 18;
    for (let i = 0; i < n; i++) { const m = new T.Mesh(dropG, dropM); m.position.copy(p); const a = Math.random() * Math.PI * 2, sp = (big ? 1.2 : 0.6) + Math.random() * (big ? 2.2 : 1); m.userData = { v: new T.Vector3(Math.cos(a) * sp, (big ? 3.5 : 2) + Math.random() * (big ? 4 : 2), Math.sin(a) * sp), life: 2 }; m.scale.setScalar(0.6 + Math.random() * (big ? 1.4 : 0.8)); scene.add(m); parts.push(m); }
    for (let i = 0; i < (big ? 3 : 1); i++) { const r = new T.Mesh(ringG, ringM.clone()); own.push(r.material); r.rotation.x = -Math.PI / 2; r.position.set(p.x, 0.03, p.z); r.userData = { t: -i * 0.18, big }; scene.add(r); rings.push(r); }
    if (big) { av.splashT = 0.001; av.splashAt = p.clone(); }
  };
  const bubbleG = new T.SphereGeometry(0.04, 8, 6), bubbleM = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, roughness: 0.05 }); own.push(bubbleG, bubbleM);
  const bubble = (x, y) => { const p = M(x ?? Math.random() * (s.W || 800), y ?? (s.H || 500) - 10); const m = new T.Mesh(bubbleG, bubbleM); m.position.copy(p); m.userData = { v: new T.Vector3(0, 0.6 + Math.random() * 0.5, 0), life: 4, bubble: true }; m.scale.setScalar(0.6 + Math.random()); scene.add(m); parts.push(m); };
  // Wassersäule beim grossen Platscher
  const colM = new T.MeshStandardMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0.8, roughness: 0.1 }); const colG = new T.CylinderGeometry(0.12, 0.35, 1, 14, 1, true); colG.translate(0, 0.5, 0); own.push(colM, colG);
  const column = new T.Mesh(colG, colM); column.visible = false; scene.add(column);

  /* ---------- Bildgrösse, Kamera ---------- */
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false); cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    cam.aspect = w / h; cam.fov = w / h < 0.9 ? 72 : 50; cam.updateProjectionMatrix(); post?.setSize(w, h);
  }
  const camBase = new T.Vector3(-4.1, 3.6, 4.5), camLook = new T.Vector3(1.3, -0.1, -10);
  let post = null;
  // (kein Leuchten beim Angeln: die spiegelnde Wasserfläche würde blenden)
  const meter = typeof fxMeter === 'function' ? fxMeter(() => { post?.dispose(); post = null; renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); W = 0; fit(); }) : () => {};

  let alive = true, raf = 0, last = performance.now(), t = 0;
  const loop = (now) => {
    if (!alive) return;
    if (G.id !== gid || !stage.isConnected) { ctl.dispose(); return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t += dt;
    fit();
    // Wellen
    for (let i = 0; i < wpos.count; i++) { const x = wbase[i * 3], y = wbase[i * 3 + 1]; wpos.array[i * 3 + 2] = Math.sin(x * 0.6 + t * 1.4) * 0.04 + Math.sin(y * 0.8 - t * 1.1) * 0.035; }
    wpos.needsUpdate = true;
    nT.offset.set(t * 0.012, t * 0.008); caT.offset.set(Math.sin(t * 0.2) * 0.05, t * 0.01);
    
    weeds.forEach((m, i) => { m.rotation.z = Math.sin(t * 1.2 + i) * 0.1; });
    reeds.forEach((m, i) => { m.rotation.z = Math.sin(t * 1.1 + i) * 0.05; });
    clouds.forEach((c) => { c.position.x += c.userData.v * dt; if (c.position.x > 40) c.position.x = -40; });
    // Steg und Eimer an die Logik-Positionen
    const dp = dockPx(); const d0 = M(dp.x0, s.waterY - 12), d1 = M(dp.x1, s.waterY - 12);
    dock.position.set(d0.x, 0.08 + Math.sin(t * 1.3) * 0.025, ZN - 0.1); dock.rotation.z = Math.sin(t * 0.9) * 0.012; dock.scale.set((d1.x - d0.x) / (34 * 0.12), 1, 1);
    const bk = M(s.avX + s.aw * 1.25 + 10, s.waterY - 12); bucket.position.set(bk.x, bk.y - 0.02, ZN + 0.4);
    // Avatar folgt dem (unsichtbaren) Avatar-Element der Logik
    const el = $('#fi-avatar');
    if (el) {
      const ax = el.offsetLeft + (s.aw || 100) / 2, ay = el.offsetTop + (s.ah || 150) * 0.955;
      const p = M(ax, ay); yaw.position.set(p.x, p.y + av.lift * 0.01, p.z + (ay <= s.waterY ? 0.2 : 0));
      yaw.rotation.y = 2.0 + (av.rotY - 0.6) * 1.2;
      tilt.rotation.x = -av.lean; spinG.rotation.x = -av.spinZ;
      yaw.scale.set(av.scale * av.sx, av.scale * av.sy, av.scale * av.sx);
    }
    fig.update(dt);
    // Rute: aus der Hand schräg nach vorne oben, biegt sich bei Zug
    const handW = new T.Vector3(); if (handLocal && fig.parts?.armR) { fig.root.updateMatrixWorld(true); handW.copy(handLocal).applyMatrix4(fig.parts.armR.matrixWorld); } else handW.copy(yaw.position).add(new T.Vector3(0.3, 1, -0.2));
    const pull = s.pull || 0, gone = !!s.fallen;
    rod.visible = !gone; line.visible = !gone; bobber.visible = !gone && !s.casting;
    const tipW = handW.clone().add(new T.Vector3(1.1 + pull * 0.3, 1.25 - pull * 0.8, -1.1));
    rod.position.copy(handW); rod.scale.set(1, handW.distanceTo(tipW), 1);
    rod.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), tipW.clone().sub(handW).normalize());
    // Schnur zum Haken
    const hk = s.casting && s.hook ? M(s.hook.x, s.hook.y) : new T.Vector3(tipW.x + 0.4, Math.sin(t * 2.4) * 0.03, Math.min(ZN - 0.4, tipW.z - 0.6));
    if (!s.casting) bobber.position.set(hk.x, 0.04 + Math.sin(t * 2.4) * 0.03, hk.z);
    const pa = lineG.attributes.position;
    for (let i = 0; i < 16; i++) { const k = i / 15; const sag = Math.sin(k * Math.PI) * (pull ? 0.1 : 0.45); pa.setXYZ(i, tipW.x + (hk.x - tipW.x) * k, tipW.y + (hk.y - tipW.y) * k - sag, tipW.z + (hk.z - tipW.z) * k); }
    pa.needsUpdate = true;
    // Fische: 3D-Modell und Wort-Schild an die Position der Logik
    const now2 = new Set(), labs = [];
    for (const f of s.fish || []) {
      if (!f.el?.isConnected) continue;
      now2.add(f.el);
      let o = fishObjs.get(f.el); if (!o) { o = fishModel(f.el); fishObjs.set(f.el, o); }
      const p = M(f.x + f.bw / 2, f.y + f.bh / 2);
      o.position.copy(p);
      const dir = f.dir > 0 ? 1 : -1;
      o.rotation.set(0, dir > 0 ? Math.PI : 0, 0);
      if (f.y < s.waterY) { o.rotation.z = (t * 6) % (Math.PI * 2); } // fliegt zappelnd aus dem Wasser
      const sp = f.el.classList.contains('wiggle') ? 30 : f.hooked ? 16 : 8;
      o.userData.tail.rotation.y = Math.sin(t * sp + o.userData.ph) * 0.5;
      o.visible = !f.el.classList.contains('vanish');
      const sc = toScreen(p);
      const bwp = f.el.offsetWidth, bhp = f.el.offsetHeight;
      labs.push({ el: f.el, x: sc.x - bwp / 2, y: sc.y - bhp / 2 - 4, w: bwp, h: bhp });
      f.el.style.opacity = f.y < s.waterY - 10 ? '0' : '';
    }
    // Schilder, die sich überdecken würden, auseinanderschieben (oben/unten), damit jedes Wort lesbar bleibt
    for (let it = 0; it < 4; it++) for (let a = 0; a < labs.length; a++) for (let b = a + 1; b < labs.length; b++) {
      const A = labs[a], B2 = labs[b];
      if (Math.abs((A.x + A.w / 2) - (B2.x + B2.w / 2)) >= (A.w + B2.w) / 2 + 4) continue;
      const need = (A.h + B2.h) / 2 + 4, dy = (B2.y + B2.h / 2) - (A.y + A.h / 2);
      if (Math.abs(dy) >= need) continue;
      const push = (need - Math.abs(dy)) / 2, sg = dy >= 0 ? 1 : -1;
      A.y -= push * sg; B2.y += push * sg;
    }
    for (const l of labs) { l.y = Math.max(2, Math.min(H - l.h - 2, l.y)); l.el.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`; }
    labs.length = 0;
    for (const [el2, o] of fishObjs) if (!now2.has(el2)) { if (el2.classList.contains('vanish') && el2.isConnected) { o.position.y -= dt * 2; o.scale.multiplyScalar(0.94); continue; } scene.remove(o); fishObjs.delete(el2); }
    // Teilchen
    for (const m of parts.slice()) { const d = m.userData; d.life -= dt; if (d.bubble) { m.position.addScaledVector(d.v, dt); if (m.position.y > -0.02) d.life = 0; } else { d.v.y -= 9.8 * dt; m.position.addScaledVector(d.v, dt); if (m.position.y < 0 && d.v.y < 0) d.life = 0; } if (d.life <= 0) { scene.remove(m); parts.splice(parts.indexOf(m), 1); } }
    for (const r of rings.slice()) { const d = r.userData; d.t += dt; if (d.t < 0) { r.visible = false; continue; } r.visible = true; const sc = 0.2 + d.t * (d.big ? 3.2 : 1.6); r.scale.set(sc, sc, sc); r.material.opacity = Math.max(0, 0.8 - d.t * 0.7); if (d.t > 1.2) { scene.remove(r); rings.splice(rings.indexOf(r), 1); } }
    if (av.splashT) { av.splashT += dt; const k = av.splashT; column.visible = k < 0.9; column.position.copy(av.splashAt); column.scale.set(1, Math.sin(Math.min(1, k / 0.9) * Math.PI) * 2.2 + 0.01, 1); colM.opacity = 0.8 * (1 - k / 0.9); if (k > 0.9) av.splashT = 0; }
    // Kamera (sanftes Schweben)
    cam.position.set(camBase.x + Math.sin(t * 0.25) * 0.15, camBase.y + Math.sin(t * 0.33) * 0.08, camBase.z); cam.lookAt(camLook);
    meter(dt);
    if (post) post.render(); else renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  const ctl = {
    alive: true, av, splash, bubble,
    /** Pixel der Logik → Bildschirm (für Texte, Funken) */
    screen(x, y) { const p = toScreen(M(x, y)); return [p.x, p.y]; },
    dispose() {
      if (!ctl.alive) return;
      ctl.alive = false; alive = false; av.alive = false; cancelAnimationFrame(raf);
      try { post?.dispose(); fig.dispose(); own.forEach((x) => x.dispose?.()); renderer.dispose(); renderer.forceContextLoss?.(); } catch { /* egal */ }
      cv.remove(); vig.remove(); stage.classList.remove('f3d');
    },
  };
  const vig = document.createElement('div'); vig.className = 'fx-vig'; vig.setAttribute('aria-hidden', 'true'); stage.appendChild(vig);
  fit();
  raf = requestAnimationFrame(loop);
  stage.classList.add('f3d');
  const prev = G.s3Cleanup;
  G.s3Cleanup = () => { try { prev?.(); } catch { /* egal */ } ctl.dispose(); };
  return ctl;
}
