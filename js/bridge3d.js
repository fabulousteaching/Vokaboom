/* Vokaboom – Brückenbau in 3D, Blick von hinten (leicht von oben)
 *
 * Der eigene 3D-Avatar steht am Rand einer Schlucht, die Kamera schaut ihm über die Schulter. Bei jeder richtigen
 * Antwort fliegt vor ihm eine Platte an ihren Platz, und er geht einen Schritt nach vorne. Eine falsche Antwort:
 * die Platte bricht entzwei und stürzt in die Tiefe. Ist die Brücke fertig, läuft er ans andere Ufer zur Schatzkiste.
 * Alles im Voxel-Stil des Avatars (js/avatar3d.js, Baukasten aus js/runner3d.js). Masse in Metern.
 * Ohne WebGL bleibt der Brückenbau in 2D (js/bridge.js).
 */
'use strict';

const B3 = { D: 0.92, W: 2.3, CAM: { up: 2.3, back: 4.4, look: 4.6 } };

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
  scene.fog = new T.Fog(new T.Color(TH.sky[1]), 28, 90);
  scene.add(new T.HemisphereLight(0xffffff, s.theme === 'lava' ? 0x4a1010 : 0x6b5a3a, 1.35));
  const sun = new T.DirectionalLight(s.theme === 'lava' ? 0xffc8a0 : 0xfff4e0, 2.2);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  if (s.theme === 'lava') { const lv = new T.PointLight(0xff6a1a, 3, 40, 1.2); lv.position.set(0, -8, -8); scene.add(lv); }
  const cam = new T.PerspectiveCamera(50, 1, 0.1, 200);
  const own = [], mats = vxMaterials(T);
  const vox = (build, opts) => { const B = rnBuilder(); build(B); const g = rnGeo(T, B, opts); own.push(g); return g; };
  const mesh = (g, shadow = true) => { const m = new T.Mesh(g, mats); m.castShadow = shadow; m.receiveShadow = true; return m; };
  const L = s.n * B3.D + 0.3; // Länge der Brücke
  const slotZ = (i) => -(i + 0.5) * B3.D - 0.15;

  /* ---------- Gelände ---------- */
  const topC = (x, y, z, depthFromTop) => (depthFromTop < 1 ? P.top : depthFromTop < 2 ? rnShade(P.top, -0.12) : rwMix(P.rock, P.rock2, 0.35, 3, 1)(x, y, z));
  // Ufer (vorne und hinten): obere Platte + Felswand zur Schlucht
  const cliff = (dir) => vox((B) => {
    const u = 0.25, X = 26, Z = 34, Hh = 44;
    for (let x = -X; x <= X; x++) for (let z = 0; z <= Z; z++) for (let y = -2; y <= 0; y++) {
      const jag = Math.round(Math.sin(x * 0.7) * 1.2 + Math.sin(x * 0.23) * 1.5);
      if (z < Math.max(0, jag)) continue;
      B.put(x, y, dir * z, topC(x, y, z, -y));
    }
    for (let x = -X; x <= X; x++) { const jag = Math.max(0, Math.round(Math.sin(x * 0.7) * 1.2 + Math.sin(x * 0.23) * 1.5)); for (let y = -Hh; y <= -3; y++) { const inset = Math.round(Math.sin(y * 0.4 + x) * 0.8 + 0.5); for (let z = jag + inset; z <= jag + inset + 2; z++) B.put(x, y, dir * z, topC(x, y, z, 9)); } }
  }, { u: 0.25, iter: 2, field: 1 });
  const near = mesh(cliff(1)); near.position.set(0, -0.25, 0.05); scene.add(near);
  const far = mesh(cliff(-1)); far.position.set(0, -0.25, -L - 0.05); scene.add(far);
  // Schluchtwände links und rechts
  const wall = (side) => vox((B) => {
    const nz = Math.ceil((L + 2) / 0.4);
    for (let z = -1; z <= nz; z++) for (let y = -30; y <= 0; y++) {
      const inner = 10 + Math.round(Math.sin(z * 0.5 + y * 0.3 + side) * 1.2 + Math.sin(y * 0.15) * 2);
      for (let x = inner; x <= inner + 3; x++) B.put(side * x, y, -z, topC(x, y, z, -y));
    }
  }, { u: 0.4, iter: 2, field: 1 });
  for (const side of [-1, 1]) { const m = mesh(wall(side), false); m.position.y = -0.4; scene.add(m); }
  // Tief unten: Fluss, Lava oder Eis
  const deep = new T.Mesh(new T.PlaneGeometry(14, L + 20, 30, 30), new T.MeshStandardMaterial({ color: P.water || 0x3a2416, emissive: s.theme === 'lava' ? 0xff5a10 : 0x000000, emissiveIntensity: s.theme === 'lava' ? 0.9 : 0, roughness: 0.4, metalness: 0.1 }));
  deep.rotation.x = -Math.PI / 2; deep.position.set(0, -11, -L / 2); scene.add(deep); own.push(deep.geometry, deep.material);
  const dpos = deep.geometry.attributes.position, dbase = Float32Array.from(dpos.array);
  // Berge in der Ferne
  const mtn = vox((B) => s3Band(B, 120, (x) => 10 + Math.abs(((x * 1.3 + 11) % 50) - 25) * 1.2 + Math.sin(x * 0.4) * 1.5, (x, y, z, h) => (s.theme === 'ice' && y > h - 5 ? 0xffffff : s.theme === 'lava' && y > h - 3 && x % 50 > 20 && x % 50 < 30 ? 0xff7a1a : rwPatch(P.far, 0.08, 4)(x, y, z)), 6), { u: 1.4, iter: 2 });
  const mt = mesh(mtn, false); mt.position.set(-84, -6, -L - 45); scene.add(mt);
  // Deko auf den Ufern
  const decoGeo = s.theme === 'jungle' ? vox((B) => s3Tree(B, 22, 0x3daa5b), { u: 0.12, iter: 2 }) : s.theme === 'ice' ? vox((B) => s3Pine(B, 26, 0x2f6b4a, true), { u: 0.11, iter: 2 })
    : s.theme === 'canyon' ? vox((B) => { B.cyl(0, 0, 0, 16, 2, 0x3d8a4a); B.cyl(4, 0, 7, 13, 1.4, 0x3d8a4a); B.box(1, 7, -1, 3, 8, 1, 0x3d8a4a); B.cyl(-4, 0, 5, 11, 1.4, 0x3d8a4a); B.box(-3, 5, -1, -1, 6, 1, 0x3d8a4a); }, { u: 0.1, iter: 2 })
      : vox((B) => { B.ell(0, 3, 0, 5, 4, 4, 0x2a2430); B.ell(1, 6, 0, 2, 1.5, 2, 0xff7a1a, { mat: 2 }); }, { u: 0.12, iter: 2 });
  for (const [x, z] of [[-5.2, -0.6], [5.4, -0.2], [4.4, -L - 2.5], [-3.8, -L - 4], [2.8, -L - 6.5]]) { const m = mesh(decoGeo); m.position.set(x, 0, z); m.rotation.y = x; scene.add(m); }
  // Pfosten und Handlauf-Seile
  const postG = vox((B) => { B.box(-1, 0, -1, 1, 11, 1, rnVar(P.post, 0.06)); B.ell(0, 11, 0, 1.6, 1.3, 1.6, rnShade(P.post, 0.1)); }, { u: 0.1, iter: 1 });
  const posts = [];
  for (const z of [0.15, -L - 0.15]) for (const x of [-B3.W / 2 - 0.15, B3.W / 2 + 0.15]) { const m = mesh(postG); m.position.set(x, 0, z); scene.add(m); posts.push(m); }
  const ropeM = new T.MeshStandardMaterial({ color: P.rope, roughness: 0.9 }); own.push(ropeM);
  const sag = (z) => TH.sag * 9 * Math.sin(Math.PI * Math.min(1, Math.max(0, -z / L)));
  if (TH.ropes) for (const x of [-B3.W / 2 - 0.15, B3.W / 2 + 0.15]) {
    const pts = Array.from({ length: 30 }, (_, i) => { const z = 0.15 - (L + 0.3) * i / 29; return new T.Vector3(x, 1.05 - sag(z) * 0.8, z); });
    const rg = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 80, 0.035, 6, false); own.push(rg);
    const r = new T.Mesh(rg, ropeM); r.castShadow = true; scene.add(r);
  }
  const plankY = (z) => -sag(z);
  // Ziel: Fahne und Schatzkiste
  const flagPole = mesh(vox((B) => B.cyl(0, 0, 0, 30, 0.7, 0x5b3a22), { u: 0.07, iter: 1 })); flagPole.position.set(1.6, 0, -L - 1.6); scene.add(flagPole);
  const flag = mesh(vox((B) => { for (let x = 0; x <= 12; x++) B.box(x, Math.round(-x * 0.3), 0, x, Math.round(7 - x * 0.3), 0, 0xff5a5f); }, { u: 0.07, iter: 1 })); flag.position.set(1.62, 1.55, -L - 1.6); scene.add(flag);
  const chestBase = mesh(vox((B) => { B.box(-8, 0, -5, 8, 7, 5, (x, y) => (y === 3 ? 0xc9a227 : rnVar(0xa86b3c, 0.06)(x, y, 0))); B.box(-1, 4, 5, 1, 6, 6, 0xffd54a, 3); }, { u: 0.06, iter: 2 }));
  chestBase.position.set(-1.2, 0, -L - 1.8); scene.add(chestBase);
  const lidPivot = new T.Group(); lidPivot.position.set(-1.2, 0.48, -L - 1.8 - 0.3); scene.add(lidPivot);
  const lid = mesh(vox((B) => B.ell(0, 0, 5, 8, 3.5, 5, 0xc98b4e, { keep: (x, y) => y >= 0 }), { u: 0.06, iter: 2 })); lidPivot.add(lid);
  const gold = new T.PointLight(0xffd54a, 0, 4); gold.position.set(-1.2, 1, -L - 1.6); scene.add(gold);

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
  const camTarget = () => { const p = hero.position; return [new T.Vector3(p.x + 0.35, p.y + B3.CAM.up, p.z + B3.CAM.back), new T.Vector3(p.x, p.y + 0.2, p.z - B3.CAM.look)]; };
  { const [a, b] = camTarget(); camPos.copy(a); camLook.copy(b); }
  const tweens = [];
  const tween = (ms, fn) => new Promise((res) => tweens.push({ t: 0, ms: ms / 1000, fn, res }));
  let alive = true, raf = 0, last = performance.now(), t = 0, W = 0, H = 0;
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false); cv.style.width = `${w}px`; cv.style.height = `${h}px`; post?.setSize(w, h);
    cam.aspect = w / h; cam.fov = w / h < 0.9 ? 70 : 50; cam.updateProjectionMatrix();
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
    // nächster Platz blinkt
    const nz = slotZ(ctl.next);
    ghost.visible = ctl.next < s.n; ghost.position.set(0, plankY(nz) - 0.05, nz); ghostM.opacity = 0.2 + Math.abs(Math.sin(t * 2.5)) * 0.4;
    for (const o of parts.slice()) { const d = o.userData; d.life -= dt; d.v.y -= 6 * dt; o.position.addScaledVector(d.v, dt); o.rotation.x += dt * 5; if (d.life <= 0) { scene.remove(o); parts.splice(parts.indexOf(o), 1); } }
    // Kamera folgt sanft
    const [cp, cl] = camTarget();
    camPos.lerp(cp, Math.min(1, dt * 2.5)); camLook.lerp(cl, Math.min(1, dt * 2.5));
    cam.position.copy(camPos); cam.lookAt(camLook);
    sun.position.set(hero.position.x - 5, 10, hero.position.z + 4); sun.target.position.set(hero.position.x, 0, hero.position.z - 2);
    meter(dt);
    if (post) post.render(); else renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
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
      tone([140, 90], 0.25, 'sawtooth', 0.05);
      await tween(1300, (k) => { halves.forEach((h, j) => { const sx = j ? 1 : -1; h.position.y = plankY(z) - 14 * k * k; h.position.x = sx * (B3.W / 4 + k * 1.2); h.rotation.z = sx * k * 3; h.rotation.x = k * 2; }); });
      halves.forEach((h) => scene.remove(h));
      fig.setAnim('shy');
      setTimeout(() => ctl.alive && fig.anim === 'shy' && fig.setAnim('idle'), 900);
    },
    /** fertig: ans andere Ufer laufen, Kiste geht auf, jubeln */
    async finish() {
      await walkTo(-L - 1.1, 1300);
      await tween(400, (k) => { hero.rotation.y = Math.PI * (1 - k); });
      fig.setAnim('cheer');
      gold.intensity = 3;
      await tween(600, (k) => { lidPivot.rotation.x = -k * 1.8; });
      puff(new T.Vector3(-1.2, 0.9, -L - 1.8), 0xffd54a, 26, 3);
      setTimeout(() => ctl.alive && fig.setAnim('dance'), 1500);
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
