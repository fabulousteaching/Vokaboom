/* Vokaboom – Lauterkennung
 *
 * Statt die Spracherkennung des Browsers zu fragen, welches WORT gesagt wurde, prüft diese Variante
 * die einzelnen LAUTE – direkt auf dem Gerät, ohne Cloud:
 *   1. Das Zielwort wird in Lautschrift übersetzt („bread“ → B R EH D).
 *   2. Ein Sprachmodell bestimmt alle 10 Millisekunden, welcher Laut zu hören ist.
 *   3. Jeder erwartete Laut bekommt Punkte: Wie deutlich war genau dieser Laut zu hören –
 *      im Vergleich zum Laut, den das Modell an dieser Stelle für am wahrscheinlichsten hält
 *      („Goodness of Pronunciation“).
 *
 * Bausteine (beide MIT-Lizenz), werden erst beim Einschalten geladen:
 *   charsiu-js 0.2.0 – Lautschrift (CMUdict + g2p) und Sprachmodell charsiu/en_w2v2_fc_10ms (~123 MB)
 *   onnxruntime-web 1.26.0 – führt das Modell im Browser aus
 */
'use strict';

const PH = {
  ORT_URL: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort.wasm.min.js',
  ORT_WASM: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
  CHARSIU: 'https://cdn.jsdelivr.net/npm/charsiu-js@0.2.0/dist/',
  ASSETS: 'https://cdn.jsdelivr.net/npm/charsiu-js@0.2.0/assets/',
  MODEL: 'https://huggingface.co/mnaoizyyy/charsiu-js-models/resolve/main/en_w2v2_fc_10ms/model_quantized.onnx',
  CACHE: 'vokabelwelt-lauterkennung-v1',
  MB: 140,
};

/* Lautschrift (ARPAbet) → gut lesbare Zeichen */
const ARPA_IPA = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', EH: 'ɛ', ER: 'ɜr', EY: 'eɪ',
  F: 'f', G: 'g', HH: 'h', IH: 'ɪ', IY: 'iː', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', OW: 'oʊ', OY: 'ɔɪ',
  P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', UH: 'ʊ', UW: 'uː', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ', '[SIL]': '–',
};
const ipa = (p) => ARPA_IPA[p] || p.toLowerCase();

const phState = { status: 'idle', progress: 0, error: '', engine: null, loading: null, listeners: new Set() };
const phCfg = () => ({ passMin: 60, ...(db.settings.phonetic || {}), on: true });
const phSupported = () => typeof WebAssembly === 'object' && !!navigator.mediaDevices?.getUserMedia && 'caches' in window;
const phoneticOn = () => phSupported();
/** Lauterkennung benutzen, sobald sie geladen ist. Bis dahin die Spracherkennung des Browsers (falls vorhanden). */
const phoneticFor = () => phSupported() && (phState.status === 'ready' || !canListen());
/** Datenpaket der Lauterkennung bei allen automatisch im Hintergrund laden (nicht im Datensparmodus) */
function phInBackground() {
  if (!phSupported() || phState.engine || phState.loading) return Promise.resolve();
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return Promise.resolve();
  return loadPhoneticEngine().catch(() => {});
}

function phNotify() { phState.listeners.forEach((fn) => { try { fn(phState); } catch { /* */ } }); }

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src && s.dataset.loaded)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = '1'; resolve(); };
    s.onerror = () => reject(new Error('Laden fehlgeschlagen: ' + src));
    document.head.appendChild(s);
  });
}

/** Modell herunterladen (mit Fortschritt) und im Browser-Speicher ablegen, damit es nur einmal geladen wird */
async function phFetchModel(onProgress) {
  let cache = null;
  try {
    cache = await caches.open(PH.CACHE);
    const hit = await cache.match(PH.MODEL);
    if (hit) { onProgress(1); return new Uint8Array(await hit.arrayBuffer()); }
  } catch { cache = null; }
  const r = await fetch(PH.MODEL);
  if (!r.ok) throw new Error('Sprachmodell: HTTP ' + r.status);
  const total = Number(r.headers.get('content-length')) || 123e6;
  const reader = r.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(0.99, got / total));
  }
  const buf = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  try { await cache?.put(PH.MODEL, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* Speicher voll – dann eben nächstes Mal neu laden */ }
  onProgress(1);
  return buf;
}

async function phIsCached() {
  try { const c = await caches.open(PH.CACHE); return !!(await c.match(PH.MODEL)); } catch { return false; }
}

function loadPhoneticEngine() {
  if (phState.engine) return Promise.resolve(phState.engine);
  if (phState.loading) return phState.loading;
  phState.status = 'loading'; phState.progress = 0; phState.error = ''; phNotify();
  phState.loading = (async () => {
    const [core, assetsWeb] = await Promise.all([
      import(PH.CHARSIU + 'index.js'),
      import(PH.CHARSIU + 'assets-web.js'),
      loadScriptOnce(PH.ORT_URL),
    ]);
    const ort = window.ort;
    ort.env.wasm.wasmPaths = PH.ORT_WASM;
    ort.env.wasm.numThreads = 1;
    const [g2pAssets, vocab] = await Promise.all([assetsWeb.loadG2pAssets(PH.ASSETS), assetsWeb.loadPhoneVocab(PH.ASSETS)]);
    const phonemizer = new core.PhonemizerEn(new core.G2p(g2pAssets), vocab);
    const model = await phFetchModel((f) => { phState.progress = f; phNotify(); });
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    phState.engine = { core, phonemizer, vocab, session, ort };
    phState.status = 'ready'; phState.progress = 1; phNotify();
    return phState.engine;
  })().catch((e) => {
    phState.status = 'error';
    phState.error = String(e?.message || e);
    phState.loading = null;
    phNotify();
    throw 'ph-load';
  });
  return phState.loading;
}

/* ---------- Aufnehmen: hört zu, bis nach dem Sprechen kurz Stille ist ---------- */
const phRec = { stop: null };

async function phRecord({ onStart, onLevel, maxMs = 5000, silenceMs = 650 } = {}) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: db.settings.micId ? { deviceId: { exact: db.settings.micId } } : true });
  } catch (e) {
    throw /NotFound|Overconstrained/i.test(e?.name) ? 'audio-capture' : 'not-allowed';
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  try { await ctx.resume(); } catch { /* */ }
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  src.connect(proc);
  proc.connect(ctx.destination); // gibt nichts aus, muss aber verbunden sein
  onStart?.();
  const buf = new Uint8Array(an.fftSize);
  let peak = 0, speechAt = 0, quietSince = 0, stopped = false;
  const t0 = performance.now();
  await new Promise((resolve) => {
    phRec.stop = () => { stopped = true; };
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
      const level = Math.min(1, Math.sqrt(sum / buf.length) * 7);
      peak = Math.max(peak, level);
      onLevel?.(level);
      const now = performance.now();
      if (level > 0.15) { if (!speechAt) speechAt = now; quietSince = 0; } else if (speechAt && !quietSince) quietSince = now;
      const done = stopped || now - t0 > maxMs || (speechAt && quietSince && now - quietSince > silenceMs) || (!speechAt && now - t0 > 4000);
      if (done) resolve(); else requestAnimationFrame(tick);
    };
    tick();
  });
  phRec.stop = null;
  proc.disconnect(); src.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  const rate = ctx.sampleRate;
  try { await ctx.close(); } catch { /* */ }
  if (!speechAt) return { samples: null, peak };
  let n = 0;
  for (const c of chunks) n += c.length;
  const all = new Float32Array(n);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.length; }
  return { samples: await phResample(all, rate), peak };
}

/** auf 16 kHz umrechnen (das erwartet das Modell) */
async function phResample(samples, rate) {
  if (rate === 16000) return samples;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const frames = Math.ceil(samples.length * 16000 / rate);
  const off = new OAC(1, frames, 16000);
  const b = off.createBuffer(1, samples.length, rate);
  b.getChannelData(0).set(samples);
  const s = off.createBufferSource();
  s.buffer = b; s.connect(off.destination); s.start();
  return (await off.startRendering()).getChannelData(0);
}

/* ---------- Bewerten ---------- */
/** Lautfolge für einen Text, ohne Betonungsziffern */
function phExpected(engine, text) {
  const { groups } = engine.phonemizer.getPhonesAndWords(text);
  const phones = groups.flat().map((p) => p.replace(/[0-9]$/, ''));
  return phones.filter((p) => engine.vocab[p] != null);
}

/** Wahrscheinlichkeiten je 10 ms (Frames × Laute) */
async function phPosteriors(engine, wave) {
  const { core, session, ort } = engine;
  const norm = core.normalize(wave);
  const out = await session.run({ input_values: new ort.Tensor('float32', norm, [1, norm.length]) });
  const logits = out.logits || out[Object.keys(out)[0]];
  const [, frames, V] = logits.dims;
  return { probs: core.softmaxRows(logits.data, frames, V), frames, V };
}

/**
 * Punkte je erwartetem Laut (0–100) per „Goodness of Pronunciation“:
 * Durchschnitt über die Frames des Lauts von  log P(erwarteter Laut) − log P(wahrscheinlichster Laut).
 * 100 = genau dieser Laut war am deutlichsten zu hören.
 */
function phScore(engine, post, phones) {
  const { core, vocab } = engine;
  const { probs, frames, V } = post;
  const SIL = vocab['[SIL]'];
  const special = new Set(['[UNK]', '[PAD]', '<s>', '</s>'].map((k) => vocab[k]).filter((x) => x != null));
  const argmax = (row) => { let b = 0, bv = -1; for (let c = 0; c < V; c++) { if (special.has(c)) continue; if (row[c] > bv) { bv = row[c]; b = c; } } return b; };
  // Bereich mit Sprache (ohne Stille am Anfang und Ende)
  let first = -1, last = -1;
  for (let t = 0; t < frames; t++) if (argmax(probs.subarray(t * V, t * V + V)) !== SIL) { if (first < 0) first = t; last = t; }
  const ids = phones.map((p) => vocab[p]);
  if (first < 0 || last - first + 1 < Math.max(8, ids.length * 2)) return { silent: true };
  const n = last - first + 1;
  const sub = probs.subarray(first * V, (last + 1) * V);
  const align = core.forcedAlign(sub, n, V, ids);
  const id2p = {};
  for (const [p, i] of Object.entries(vocab)) id2p[i] = p;
  const st = ids.map(() => ({ frames: 0, gop: 0, votes: new Float64Array(V) }));
  for (let t = 0; t < n; t++) {
    const row = sub.subarray(t * V, t * V + V);
    const j = align[t], s = st[j];
    const b = argmax(row);
    s.frames++;
    s.gop += Math.log(row[ids[j]] + 1e-8) - Math.log(row[b] + 1e-8);
    for (let c = 0; c < V; c++) s.votes[c] += row[c];
  }
  const result = phones.map((p, j) => {
    const s = st[j];
    const score = s.frames ? Math.round(100 * Math.exp(s.gop / s.frames)) : 0;
    const top = argmax(s.votes);
    // Ist der erwartete Laut genauso wahrscheinlich wie der beste, gilt er als gehört
    const heard = s.votes[ids[j]] >= s.votes[top] - 1e-6 ? p : (id2p[top] || '?');
    return { exp: p, heard, score };
  });
  const score = Math.round(result.reduce((a, r) => a + r.score, 0) / result.length);
  return { silent: false, score, phones: result };
}

/** Englisch: mit und ohne „to/the/a“ prüfen, das bessere Ergebnis zählt */
function phReferences(word) {
  // Stehen mehrere Wörter da („colour / color“), müssen alle gesagt werden
  const first = answerAlts(word.foreign).map((a) => answerVariants(a)[0] || a).join(', ') || word.foreign;
  const full = ttsText(first, 'en');
  const short = stripArticle(full, 'en');
  return [...new Set([full, short])].filter(Boolean);
}

async function assessSpoken(word, { onStart, onLevel, onPhase } = {}) {
  const engine = await loadPhoneticEngine();
  const rec = await phRecord({ onStart, onLevel });
  if (!rec.samples) return { silent: true, peak: rec.peak };
  onPhase?.('thinking');
  const post = await phPosteriors(engine, rec.samples);
  let best = null;
  for (const ref of phReferences(word)) {
    const phones = phExpected(engine, ref);
    if (!phones.length) continue;
    const r = phScore(engine, post, phones);
    if (r.silent) { best = best || { ...r, ref }; continue; }
    if (!best || best.silent || r.score > best.score) best = { ...r, ref };
  }
  if (!best) throw 'ph-word';
  let passMin = passMinNow();
  // Kurze Wörter (höchstens 3 Laute pro Wort, z. B. he, his, tie) sind schwer zu treffen: 10 Punkte weniger nötig
  if (!best.silent && best.phones && best.phones.length <= 3 * String(best.ref || '').split(/\s+/).filter(Boolean).length) passMin = Math.max(30, passMin - 10);
  if (!best.silent) {
    best.passMin = passMin;
    best.ok = best.score >= passMin; // ab der eingestellten Punktzahl (Standard 60) ist es richtig
  }
  best.peak = rec.peak;
  return best;
}

function phErrorText(code) {
  if (code === 'ph-load') return `Die Lauterkennung konnte nicht geladen werden (${phState.error || 'unbekannter Fehler'}). Bist du online? Beim ersten Mal werden ca. ${PH.MB} MB geladen.`;
  if (code === 'ph-word') return 'Für dieses Wort kann die Lauterkennung keine Lautschrift bilden.';
  return 'Bei der Lauterkennung ist ein Fehler passiert.';
}
