/* Vokaboom – Grafik-Qualität und Leuchten (Bloom) für die 3D-Spiele
 *
 * Automatischer Schalter: Jede 3D-Szene misst die ersten Sekunden, wie flüssig sie läuft. Ist das Gerät zu langsam,
 * schaltet sie Leuchten, Schatten und hohe Auflösung ab (und merkt sich das für dieses Gerät eine Woche lang).
 * Leuchten: three.js UnrealBloomPass (js/vendor/three-post.js) – nur helle/leuchtende Dinge strahlen
 * (Trank, Lava, Flammen, Sonne, Runen, Funken).
 */
'use strict';

const FX_KEY = 'vokaboom.fxQuality';
const FX = { q: null, post: null, postP: null };
/** 'high' oder 'low' */
function fxQuality() {
  if (FX.q) return FX.q;
  let q = 'high';
  try {
    const v = JSON.parse(localStorage.getItem(FX_KEY) || 'null');
    if (v && v.q && Date.now() - v.t < 7 * 864e5) q = v.q;
  } catch { /* egal */ }
  // sehr schwache Geräte gleich mit wenig Effekten starten
  if ((navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory || 4) <= 1) q = 'low';
  FX.q = q;
  return q;
}
function fxSetQuality(q) {
  FX.q = q;
  try { localStorage.setItem(FX_KEY, JSON.stringify({ q, t: Date.now() })); } catch { /* egal */ }
}
const fxPR = () => Math.min(fxQuality() === 'high' ? 1.75 : 1, window.devicePixelRatio || 1);

/** Nachbearbeitung laden (einmal) */
function fxLoadPost() {
  if (FX.post) return Promise.resolve(FX.post);
  if (!FX.postP) {
    FX.postP = (typeof w3Asset === 'function' ? import(w3Asset('js/vendor/three-post.js')) : Promise.reject(new Error('kein w3Asset')))
      .then((m) => (FX.post = m.makePost(w3T())))
      .catch((e) => { console.warn('Leuchten nicht verfügbar', e); FX.postP = null; return null; });
  }
  return FX.postP;
}

/**
 * Leuchten für einen Renderer einrichten. Gibt { render(), setSize(w, h), dispose() } zurück oder null.
 * opts: strength (Stärke), radius, threshold (ab welcher Helligkeit es leuchtet)
 */
async function fxBloom(renderer, scene, cam, { strength = 0.7, radius = 0.55, threshold = 0.78 } = {}) {
  if (fxQuality() !== 'high') return null;
  const P = await fxLoadPost();
  if (!P) return null;
  const T = w3T();
  try {
    const size = renderer.getSize(new T.Vector2());
    const comp = new P.EffectComposer(renderer);
    comp.setPixelRatio(renderer.getPixelRatio());
    comp.setSize(size.x, size.y);
    comp.addPass(new P.RenderPass(scene, cam));
    const bloom = new P.UnrealBloomPass(new T.Vector2(size.x, size.y), strength, radius, threshold);
    comp.addPass(bloom);
    comp.addPass(new P.OutputPass());
    return {
      bloom,
      render() { comp.render(); },
      setSize(w, h) { comp.setPixelRatio(renderer.getPixelRatio()); comp.setSize(w, h); },
      dispose() { try { comp.dispose(); bloom.dispose(); } catch { /* egal */ } },
    };
  } catch (e) { console.warn('Leuchten', e); return null; }
}

/** Bildrate messen: nach ~3 s entscheiden, ob das Gerät die schönen Effekte schafft. onLow() schaltet sie ab. */
function fxMeter(onLow) {
  let t = 0, n = 0, done = false;
  return (dt) => {
    if (done) return;
    t += dt; n++;
    if (t < 1) { if (t < 0.2) n = 0; return; } // die ersten Bilder (Aufbau) nicht zählen
    if (t >= 3.2) {
      done = true;
      const fps = n / (t - 0.2);
      if (fps < 32 && fxQuality() === 'high') { fxSetQuality('low'); try { onLow(); } catch (e) { console.warn(e); } }
    }
  };
}

/** Weicher Lichtschein (für Sonne, Kerzen, Lava …) – ein Sprite mit rundem Verlauf, additiv */
let FX_GLOW_TEX = null;
function fxGlow(T, color, size, opacity = 0.6) {
  if (!FX_GLOW_TEX) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    FX_GLOW_TEX = new T.CanvasTexture(c);
  }
  const s = new T.Sprite(new T.SpriteMaterial({ map: FX_GLOW_TEX, color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(size, size, 1);
  return s;
}
