/* Vokaboom – Hintergrundgeräusche und Geräusche für die Spiele (ohne Audiodateien, alles mit WebAudio erzeugt)
 *
 * ambStart(kind) startet eine leise Klangkulisse, ambStop() blendet sie aus (passiert auch beim Verlassen des Spiels).
 * Kulissen: lake (Teich: Plätschern + Vögel), mountain (See: Wind + Vögel), sea (Meer: Wellen + Möwen),
 * jungle (Fluss + Dschungelvögel), canyon (Wind + Falke), ice (kalter Wind), lava (Grollen + Knistern),
 * lab (Kessel blubbert + Feuer knistert).
 * sfxx(name): kurze Geräusche – step (Schritt auf Holz), clink (Glas), crackle (Funken), thud (Brett landet), whoosh, chime.
 */
'use strict';

const AMB = { ctx: null, out: null, nodes: [], timers: [], kind: null, noise: null };
function ambCtx() {
  if (typeof db !== 'object' || !db.settings?.sound) return null;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch { return null; }
}
function ambNoise(ac) {
  if (AMB.noise && AMB.noise.sampleRate === ac.sampleRate) return AMB.noise;
  const len = ac.sampleRate * 4, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
  // «rosa» Rauschen (weicher als weisses)
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.02) * 2.2; }
  AMB.noise = b;
  return b;
}
/** Dauerrauschen durch Filter, Lautstärke schwankt langsam (Wellen, Wind) */
function ambBed(ac, { type = 'lowpass', f = 600, q = 0.7, gain = 0.2, lfo = 0.15, depth = 0.6, fLfo = 0 }) {
  const src = ac.createBufferSource(); src.buffer = ambNoise(ac); src.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ac.createGain(); g.gain.value = gain * (1 - depth / 2);
  const l = ac.createOscillator(); l.frequency.value = lfo;
  const lg = ac.createGain(); lg.gain.value = gain * depth / 2;
  l.connect(lg).connect(g.gain);
  if (fLfo) { const fl2 = ac.createGain(); fl2.gain.value = fLfo; l.connect(fl2).connect(fl.frequency); }
  src.connect(fl).connect(g).connect(AMB.out);
  src.start(0, Math.random() * 3); l.start();
  AMB.nodes.push(src, l);
}
/** wiederkehrende Ereignisse (Vogel, Blubbern, Knistern) in zufälligen Abständen */
function ambEvery(min, max, fn) {
  const go = () => { const id = setTimeout(() => { if (!AMB.kind) return; try { fn(AMB.ctx); } catch { /* egal */ } go(); }, min + Math.random() * (max - min)); AMB.timers.push(id); };
  go();
}
const ambTone = (ac, t0, dur, type, f0, f1, gain, dest = AMB.out) => {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.03, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
};
const ambHit = (ac, t0, dur, type, f, gain, q = 1, dest = AMB.out) => {
  const s = ac.createBufferSource(); s.buffer = ambNoise(ac);
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl).connect(g).connect(dest); s.start(t0, Math.random() * 3); s.stop(t0 + dur + 0.05);
};
/* Bausteine */
const ambBird = (ac) => { const t = ac.currentTime + 0.02, f = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) ambTone(ac, t + i * 0.11, 0.08, 'sine', f * (1 + (i % 2) * 0.15), f * 1.25, 0.05); };
const ambJungleBird = (ac) => { const t = ac.currentTime + 0.02, f = 900 + Math.random() * 700; ambTone(ac, t, 0.25, 'sine', f, f * 2.2, 0.05); ambTone(ac, t + 0.3, 0.3, 'sine', f * 2, f * 0.9, 0.045); };
const ambGull = (ac) => { const t = ac.currentTime + 0.02; for (let i = 0; i < 3; i++) ambTone(ac, t + i * 0.22, 0.2, 'triangle', 1500, 900, 0.03); };
const ambHawk = (ac) => { const t = ac.currentTime + 0.02; ambTone(ac, t, 1.1, 'sine', 2600, 1600, 0.03); };
const ambPlop = (ac) => { const t = ac.currentTime + 0.02; ambTone(ac, t, 0.12, 'sine', 300 + Math.random() * 500, 900 + Math.random() * 600, 0.05); };
const ambBubble = (ac) => { const t = ac.currentTime + 0.02, n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) ambTone(ac, t + i * 0.09, 0.1, 'sine', 180 + Math.random() * 200, 500 + Math.random() * 400, 0.06); };
const ambCrackle = (ac) => { const t = ac.currentTime + 0.02, n = 2 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) ambHit(ac, t + Math.random() * 0.25, 0.02 + Math.random() * 0.03, 'highpass', 2000 + Math.random() * 3000, 0.06 + Math.random() * 0.06); };
const ambRumble = (ac) => { const t = ac.currentTime + 0.02; ambHit(ac, t, 1.8, 'lowpass', 120, 0.25, 0.5); };

function ambStart(kind) {
  ambStop(true);
  const ac = ambCtx();
  if (!ac || !kind) return;
  AMB.ctx = ac; AMB.kind = kind;
  AMB.out = ac.createGain(); AMB.out.gain.setValueAtTime(0.0001, ac.currentTime); AMB.out.gain.exponentialRampToValueAtTime(0.5, ac.currentTime + 1.5);
  AMB.out.connect(ac.destination);
  switch (kind) {
    case 'lake': ambBed(ac, { f: 500, gain: 0.16, lfo: 0.2, depth: 0.7 }); ambEvery(2500, 7000, ambBird); ambEvery(1500, 4000, ambPlop); break;
    case 'mountain': ambBed(ac, { type: 'bandpass', f: 700, q: 0.6, gain: 0.14, lfo: 0.08, depth: 0.8, fLfo: 300 }); ambBed(ac, { f: 450, gain: 0.08, lfo: 0.25 }); ambEvery(3500, 9000, ambBird); break;
    case 'sea': ambBed(ac, { f: 800, gain: 0.25, lfo: 0.11, depth: 0.95, fLfo: 500 }); ambEvery(5000, 12000, ambGull); break;
    case 'jungle': ambBed(ac, { f: 1200, gain: 0.1, lfo: 0.3, depth: 0.3 }); ambEvery(1200, 3500, ambJungleBird); ambEvery(2500, 6000, ambBird); break;
    case 'canyon': ambBed(ac, { type: 'bandpass', f: 500, q: 1.2, gain: 0.18, lfo: 0.06, depth: 0.9, fLfo: 350 }); ambEvery(7000, 14000, ambHawk); break;
    case 'ice': ambBed(ac, { type: 'bandpass', f: 1100, q: 1.5, gain: 0.16, lfo: 0.07, depth: 0.9, fLfo: 700 }); ambBed(ac, { type: 'highpass', f: 3000, gain: 0.03, lfo: 0.2 }); break;
    case 'lava': ambBed(ac, { f: 160, gain: 0.3, lfo: 0.09, depth: 0.6 }); ambEvery(600, 1800, ambCrackle); ambEvery(5000, 11000, ambRumble); break;
    case 'lab': ambBed(ac, { f: 260, gain: 0.08, lfo: 0.4, depth: 0.5 }); ambEvery(350, 1100, ambBubble); ambEvery(500, 1500, ambCrackle); break;
  }
}
function ambStop(now = false) {
  AMB.timers.forEach(clearTimeout); AMB.timers = [];
  const nodes = AMB.nodes, out = AMB.out, ac = AMB.ctx;
  AMB.nodes = []; AMB.kind = null; AMB.out = null;
  if (!ac || !out) return;
  try {
    const t = ac.currentTime;
    out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t); out.gain.exponentialRampToValueAtTime(0.0001, t + (now ? 0.05 : 0.8));
    setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* schon gestoppt */ } }); try { out.disconnect(); } catch { /* egal */ } }, now ? 100 : 900);
  } catch { /* egal */ }
}
/** kurze Spiel-Geräusche */
function sfxx(name) {
  const ac = ambCtx();
  if (!ac) return;
  const t = ac.currentTime + 0.01, d = ac.destination;
  try {
    if (name === 'step') { ambHit(ac, t, 0.09, 'lowpass', 500 + Math.random() * 200, 0.35, 1, d); ambTone(ac, t, 0.06, 'sine', 140, 90, 0.12, d); }
    else if (name === 'clink') { ambTone(ac, t, 0.25, 'sine', 2900 + Math.random() * 300, 2950, 0.07, d); ambTone(ac, t + 0.05, 0.3, 'sine', 4300, 4320, 0.04, d); }
    else if (name === 'crackle') ambCrackle(ac);
    else if (name === 'thud') { ambTone(ac, t, 0.18, 'sine', 120, 55, 0.3, d); ambHit(ac, t, 0.12, 'lowpass', 700, 0.3, 1, d); }
    else if (name === 'whoosh') ambHit(ac, t, 0.45, 'bandpass', 1400, 0.3, 0.8, d);
    else if (name === 'chime') [1319, 1568, 2093].forEach((f, i) => ambTone(ac, t + i * 0.07, 0.6, 'sine', f, f, 0.05, d));
  } catch { /* egal */ }
}
