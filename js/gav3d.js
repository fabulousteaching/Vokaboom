/* Vokaboom – 3D-Avatar in den Spielen (Angeln, Brückenbau, Zaubertrank)
 * Legt eine kleine, durchsichtige three.js-Bühne in das Avatar-Element eines Spiels und zeigt dort die 3D-Figur
 * des Kindes (js/avatar3d.js, Look aus dem 3D-Shop). Die Füsse stehen dort, wo beim 2D-Avatar die Füsse waren,
 * darum bleiben Spiel-Logik und Masse gleich. Ohne WebGL (oder wenn das Laden scheitert) bleibt der 2D-Avatar.
 *
 * Gruppen: feet (Kippen um die Füsse, z. B. nach vorne lehnen) → spin (Drehen um die Körpermitte, z. B. Salto)
 * → fig.root (Bewegungen aus avatar3d: idle, hold, cheer, oops, jump, run …).
 */
'use strict';

/** Geräusche aus Rauschen (Platschen, Wusch, Blubbern) – ohne Audiodateien */
const gavNoise = (() => {
  let buf = null;
  return (ctx) => {
    if (buf && buf.sampleRate === ctx.sampleRate) return buf;
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };
})();
function gavSound(kind) {
  if (typeof db !== 'object' || !db.settings?.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ac = audioCtx, t0 = ac.currentTime + 0.01, out = ac.destination;
    const noise = (start, dur, type, f0, f1, gain, q = 0.8) => {
      const src = ac.createBufferSource(); src.buffer = gavNoise(ac);
      const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q;
      fl.frequency.setValueAtTime(f0, start); fl.frequency.exponentialRampToValueAtTime(f1, start + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.03, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(fl).connect(g).connect(out); src.start(start, Math.random()); src.stop(start + dur + 0.05);
    };
    const osc = (start, dur, type, f0, f1, gain) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0, start); o.frequency.exponentialRampToValueAtTime(f1, start + dur);
      g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(gain, start + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g).connect(out); o.start(start); o.stop(start + dur + 0.05);
    };
    if (kind === 'whoosh') noise(t0, 0.6, 'bandpass', 400, 2400, 0.25, 1.2);
    else if (kind === 'splash') { // grosses Platschen: Aufprall, Rauschen, Nachtropfen
      osc(t0, 0.25, 'sine', 180, 45, 0.5);
      noise(t0, 0.9, 'lowpass', 5000, 500, 0.55);
      noise(t0 + 0.05, 1.3, 'bandpass', 2200, 700, 0.25, 0.6);
      for (let i = 0; i < 7; i++) { const st = t0 + 0.35 + Math.random() * 0.9; osc(st, 0.07, 'sine', 900 + Math.random() * 900, 1800 + Math.random() * 900, 0.06); }
    } else if (kind === 'plop') { osc(t0, 0.12, 'sine', 600, 220, 0.18); noise(t0, 0.25, 'lowpass', 3000, 400, 0.12); }
    else if (kind === 'bubbles') { for (let i = 0; i < 10; i++) { const st = t0 + i * 0.07 + Math.random() * 0.05; osc(st, 0.09, 'sine', 300 + Math.random() * 400, 700 + Math.random() * 600, 0.07); } }
    else if (kind === 'pour') { noise(t0, 0.9, 'bandpass', 1200, 600, 0.18, 2); for (let i = 0; i < 5; i++) osc(t0 + 0.15 + i * 0.13, 0.08, 'sine', 500 + i * 60, 900, 0.05); }
    else if (kind === 'magic') { [784, 988, 1175, 1568].forEach((f, i) => osc(t0 + i * 0.08, 0.5, 'triangle', f, f * 1.01, 0.07)); noise(t0, 0.8, 'highpass', 4000, 8000, 0.08); }
    else if (kind === 'fizzle') { noise(t0, 1.1, 'bandpass', 3000, 300, 0.22, 1.5); osc(t0, 0.6, 'sawtooth', 220, 60, 0.07); }
  } catch { /* kein Audio */ }
}

const gavOK = () => typeof w3WebGL === 'function' && w3WebGL() && typeof w3Three === 'function' && typeof w3LoadEngine === 'function' && typeof a3Look === 'function';

/**
 * 3D-Figur in host einsetzen. host ist das Avatar-Element (Breite aw, Höhe 1.5·aw, Füsse bei 95.5 % der Höhe).
 * opts: anim (Start-Bewegung), rotY (Drehung: 0 = schaut nach vorne, + = nach rechts), hand: 'R'|'L'.
 * Gibt eine Steuerung zurück (oder null, dann bleibt der 2D-Avatar).
 */
async function gavMount(host, opts = {}) {
  if (!host || !gavOK()) return null;
  const gid = G.id;
  let T;
  try { T = await w3Three(); await w3LoadEngine(); } catch (e) { console.warn('3D-Avatar laden', e); return null; }
  if (G.id !== gid || !host.isConnected || typeof vxFigure !== 'function') return null;
  let fig, renderer;
  try {
    const cfg = w3Saved('a3'); delete cfg.fresh;
    fig = vxFigure(T, a3Look(cfg));
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) { console.warn('3D-Avatar bauen', e); return null; }
  renderer.setPixelRatio(typeof fxPR === 'function' ? Math.min(2, fxPR() * 1.15) : Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  if (typeof w3Lights === 'function') w3Lights(T, scene, renderer, false);
  else { scene.add(new T.HemisphereLight(0xffffff, 0x8a6a3a, 1.6)); const d = new T.DirectionalLight(0xffffff, 2.2); d.position.set(-2, 4, 4); scene.add(d); }
  // Grösse der Figur messen (ohne Bewegung)
  fig.update(0.016);
  const box = new T.Box3().setFromObject(fig.root);
  const figH = Math.max(1, box.max.y - Math.max(0, box.min.y)), hc = figH * 0.5;
  const feet = new T.Group(), spin = new T.Group();
  spin.position.y = hc; fig.root.position.y = 0;
  const inner = new T.Group(); inner.position.y = -hc; inner.add(fig.root);
  spin.add(inner); feet.add(spin); scene.add(feet);
  feet.rotation.y = opts.rotY ?? 0.9;
  // Hand finden: unterstes Ende des Arms (im Arm-Koordinatensystem)
  const handLocal = {};
  for (const k of ['armR', 'armL']) {
    const arm = fig.parts?.[k];
    if (!arm) continue;
    const b = new T.Box3().setFromObject(arm), inv = arm.matrixWorld.clone().invert();
    const p = new T.Vector3((b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * 0.08, (b.min.z + b.max.z) / 2).applyMatrix4(inv);
    handLocal[k] = p;
  }
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const cv = renderer.domElement;
  cv.className = 'gav-canvas'; cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  const PAD = { x: 0.9, top: 0.55, bottom: 0.25 }; // Platz um das Element herum (Arme hoch, Salto)
  let size = { w: 0, h: 0, k: 1 };
  function fit() {
    const hw = host.clientWidth || 80, hh = hw * 1.5;
    const cw = Math.round(hw * (1 + PAD.x * 2)), ch = Math.round(hh * (1 + PAD.top + PAD.bottom));
    if (cw === size.w && ch === size.h) return;
    renderer.setSize(cw, ch, false);
    cv.style.width = `${cw}px`; cv.style.height = `${ch}px`;
    cv.style.left = `${-hw * PAD.x}px`; cv.style.top = `${-hh * PAD.top}px`;
    const k = figH / (hh * 0.955 * 0.97); // Welt-Einheiten pro Pixel (Figur so gross wie der 2D-Avatar)
    const feetPx = hh * PAD.top + hh * 0.955; // Füsse in Pixeln ab Oberkante der Leinwand
    const cy = (feetPx - ch / 2) * k;
    Object.assign(cam, { left: -cw / 2 * k, right: cw / 2 * k, top: ch / 2 * k, bottom: -ch / 2 * k });
    cam.position.set(0, cy + 0.35, 12); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
    size = { w: cw, h: ch, k, hw, hh };
  }
  fit();
  const ctl = {
    fig, T, alive: true, lean: 0, spinZ: 0, spinX: 0, scale: 1, sx: 1, sy: 1, lift: 0, alpha: 1, rotY: feet.rotation.y, hand: opts.hand || 'R',
    setAnim(n) { if (fig.anim !== n) fig.setAnim(n); },
    /** Hand in Pixeln relativ zum host (für Angelrute, Löffel …) */
    handPx(which = ctl.hand) {
      const arm = fig.parts?.[`arm${which}`], hl = handLocal[`arm${which}`];
      if (!arm || !hl) return null;
      const p = hl.clone().applyMatrix4(arm.matrixWorld).project(cam);
      return { x: (p.x + 1) / 2 * size.w - size.hw * PAD.x, y: (1 - p.y) / 2 * size.h - size.hh * PAD.top };
    },
    fit,
    dispose() {
      if (!ctl.alive) return;
      ctl.alive = false; cancelAnimationFrame(raf);
      try { fig.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); } catch { /* egal */ }
      cv.remove(); host.classList.remove('is3d');
    },
  };
  let last = performance.now(), raf = 0, first = true;
  const loop = (now) => {
    if (!ctl.alive) return;
    if (G.id !== gid || !host.isConnected) { ctl.dispose(); return; }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    fit();
    feet.rotation.set(0, ctl.rotY, ctl.lean);
    spin.rotation.set(ctl.spinX, 0, ctl.spinZ);
    feet.scale.set(ctl.scale * ctl.sx, ctl.scale * ctl.sy, ctl.scale * ctl.sx);
    feet.position.y = ctl.lift * (cam.top - cam.bottom) / (size.h || 1);
    cv.style.opacity = ctl.alpha < 1 ? String(ctl.alpha) : '';
    fig.update(dt);
    renderer.render(scene, cam);
    if (first) { first = false; host.classList.add('is3d'); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const prev = G.gavCleanup;
  G.gavCleanup = () => { try { prev?.(); } catch { /* egal */ } ctl.dispose(); };
  return ctl;
}
