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
 * Französisch: eigenes Modell (siehe unten, „Französisch“), gleiche Idee.
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
/** Französisch: immer die Lauterkennung auf dem Gerät (die Spracherkennung des Browsers „verbessert“ falsch Gesagtes zum richtigen Wort) */
const phoneticFor = (lang = 'en') => (lang === 'fr' ? phSupported() : lang === 'en' && phSupported() && (!!phState.engine || !canListen()));
const phReady = (lang = 'en') => (lang === 'fr' ? !!phState.fr : !!phState.engine);
const phMB = (lang = 'en') => (lang === 'fr' ? PH_FR.MB : PH.MB);
/** Datenpaket der Lauterkennung bei allen automatisch im Hintergrund laden (nicht im Datensparmodus) */
function phInBackground() {
  if (!phSupported() || phState.engine || phState.loading) return Promise.resolve();
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return Promise.resolve();
  return loadPhoneticEngine().catch(() => {})
    .then(() => (db.sets.some((x) => langOf(x) === 'fr') ? loadFrenchEngine().catch(() => {}) : null)); // Französisch nur, wenn es Französisch-Portionen gibt
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
async function phFetchModel(onProgress, url = PH.MODEL, guess = 123e6) {
  let cache = null;
  try {
    cache = await caches.open(PH.CACHE);
    const hit = await cache.match(url);
    if (hit) { onProgress(1); return new Uint8Array(await hit.arrayBuffer()); }
  } catch { cache = null; }
  const r = await fetch(url);
  if (!r.ok) throw new Error('Sprachmodell: HTTP ' + r.status);
  const total = Number(r.headers.get('content-length')) || guess;
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
  try { await cache?.put(url, new Response(buf, { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* Speicher voll – dann eben nächstes Mal neu laden */ }
  onProgress(1);
  return buf;
}

async function phIsCached() {
  try { const c = await caches.open(PH.CACHE); return !!(await c.match(PH.MODEL)); } catch { return false; }
}

/** Immer nur ein Lauterkennungs-Modell im Speicher halten (jedes braucht mehrere hundert MB) */
function phRelease(which) {
  const key = which === 'fr' ? 'fr' : 'engine';
  const eng = phState[key];
  if (!eng) return;
  try { eng.session?.release?.(); } catch { /* */ }
  phState[key] = null;
  if (which === 'fr') phState.frLoading = null; else phState.loading = null;
}
function loadPhoneticEngine(lang = 'en') {
  if (lang === 'fr') return loadFrenchEngine();
  if (phState.engine) return Promise.resolve(phState.engine);
  if (phState.loading) return phState.loading;
  if (phState.fr || !phState.frLoading) phRelease('fr'); // Französisch freigeben (ausser es lädt gerade)
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

async function phRecord({ onStart, onLevel, maxMs = 6000, silenceMs = 900 } = {}) { // 0,9 s Pause: „the … weather“ wird nicht abgeschnitten
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

/** Alle Aussprache-Varianten eines Textes: „-day“ als [deɪ] und [di] (Saturday, Monday …) */
function phExpectedAll(engine, text) {
  const { groups } = engine.phonemizer.getPhonesAndWords(text);
  let all = [[]];
  for (const g of groups) {
    const w = g.map((p) => p.replace(/[0-9]$/, '')).filter((p) => engine.vocab[p] != null);
    const alts = [w];
    const n = w.length;
    if (n >= 3 && w[n - 2] === 'D' && (w[n - 1] === 'IY' || w[n - 1] === 'EY')) alts.push([...w.slice(0, -1), w[n - 1] === 'IY' ? 'EY' : 'IY']);
    all = all.flatMap((pre) => alts.map((a) => [...pre, ...a])).slice(0, 8);
  }
  return all.filter((x) => x.length);
}

/* Ähnliche Laute (Englisch):
   EN_SAME  – gilt als derselbe Laut (unbetonte Vokale, britisches „Thursday“ ohne r …)
   EN_CLOSE – sehr nah, zählt fast voll (stimmhaft/stimmlos, th → f/s/t …)
   Bewusst NICHT dabei: e/ä (bed – bad), i/ie (ship – sheep), m/p (lamb – lamp). */
const EN_SAME = { ER: ['AH', 'EH', 'AO', 'R'], AH: ['IH', 'ER', 'AA', 'UH', 'EH'], AA: ['AO', 'AH'], AO: ['AA', 'OW'], UH: ['UW', 'AH'], UW: ['UH', 'AH'], IH: ['AH', 'IY'], OW: ['AO'], HH: [] };
const EN_CLOSE = { S: ['Z'], Z: ['S'], D: ['T', 'DH'], T: ['D'], B: ['P'], P: ['B'], G: ['K'], K: ['G'], V: ['F', 'W'], F: ['V', 'TH'], TH: ['F', 'S'], DH: ['D', 'Z', 'V'], EY: ['EH', 'IY'], IY: ['IH', 'EY'], EH: ['EY', 'AH'], AE: ['AH'], W: ['V'], N: ['M', 'NG'], NG: ['N'] };
const EN_CLOSE_W = 0.75; // so viel ist ein sehr naher Laut wert

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
  const id2p = {};
  for (const [p, i] of Object.entries(vocab)) id2p[i] = p;
  const same = phones.map((p) => [vocab[p], ...(EN_SAME[p] || []).map((q) => vocab[q])].filter((x) => x != null));
  const close = phones.map((p) => (EN_CLOSE[p] || []).map((q) => vocab[q]).filter((x) => x != null));
  // Bewertung für einen Ausschnitt [a, b]
  const rate = (a, b) => {
    const n = b - a + 1;
    if (n < Math.max(8, ids.length * 2)) return null;
    const sub = probs.subarray(a * V, (b + 1) * V);
    const align = core.forcedAlign(sub, n, V, ids);
    const st = ids.map(() => ({ g: [], votes: new Float64Array(V), t0: -1, t1: -1 }));
    for (let t = 0; t < n; t++) {
      const row = sub.subarray(t * V, t * V + V);
      const j = align[t], s = st[j];
      if (s.t0 < 0) s.t0 = a + t; s.t1 = a + t;
      const bb = argmax(row);
      let own = 0;
      for (const c of same[j]) own = Math.max(own, row[c]);
      for (const c of close[j]) own = Math.max(own, EN_CLOSE_W * row[c]);
      s.g.push(Math.min(0, Math.log(own + 1e-8) - Math.log(row[bb] + 1e-8)));
      for (let c = 0; c < V; c++) s.votes[c] += row[c];
    }
    const result = phones.map((p, j) => {
      const s = st[j];
      // Ränder eines Lauts sind unsicher: die besseren zwei Drittel der Frames zählen
      const g = s.g.slice().sort((x, y) => y - x).slice(0, Math.max(1, Math.ceil(s.g.length * 0.67)));
      const score = g.length ? Math.round(100 * Math.exp(g.reduce((acc, x) => acc + x, 0) / g.length)) : 0;
      const top = argmax(s.votes);
      const heard = same[j].includes(top) ? p : (id2p[top] || '?');
      return { exp: p, heard, score, t0: s.t0, t1: s.t1 };
    });
    // Durchschnitt aller Laute, aber jeder klar falsche Laut (unter 20) kostet 22 Punkte
    const ps = result.map((r) => r.score);
    const mean = ps.reduce((acc, x) => acc + x, 0) / ps.length;
    return { gop: Math.max(0, Math.min(100, Math.round(mean - 22 * ps.filter((x) => x < 20).length))), phones: result };
  };
  // Atem, Schmatzen oder Mikrofon-Geräusch ganz am Rand (bis 60 ms) nicht dem ersten/letzten Laut anrechnen
  let best = null;
  for (const da of [0, 3, 6]) for (const db of [0, 3, 6]) {
    const r = rate(first + da, last - db);
    if (r && (!best || r.gop > best.gop)) best = r;
  }
  if (!best) return { silent: true };
  // zweite Prüfung: frei gehörte Lautfolge – deutlich eingeschobene Mitlaute („list-t-en“, „lam-p“) kosten Punkte
  const dec = phDecode(engine, post);
  const extra = phInserted(phones, dec);
  const score = Math.max(0, best.gop - 45 * extra.length); // ein deutlich eingeschobener Mitlaut macht ein anderes Wort (lamb → lamp)
  return { silent: false, score, gop: best.gop, extra: extra.map((x) => x.ph), dec: dec.map((x) => `${x.ph}:${x.n}:${Math.round(x.p * 100)}`).join(' '), phones: best.phones };
}

/**
 * Frei gehörte Lautfolge (ohne Vorgabe, welches Wort kommt): je 10 ms der wahrscheinlichste Laut;
 * Ausreisser von nur 10 ms zählen nicht, Stille fällt weg.
 */
function phDecode(engine, post) {
  const { vocab } = engine, { probs, frames, V } = post;
  const SIL = vocab['[SIL]'];
  const special = new Set(['[UNK]', '[PAD]', '<s>', '</s>'].map((k) => vocab[k]).filter((x) => x != null));
  const id2p = {};
  for (const [ph, i] of Object.entries(vocab)) id2p[i] = ph;
  const runs = [];
  for (let t = 0; t < frames; t++) {
    const row = probs.subarray(t * V, t * V + V);
    let b = 0, bv = -1;
    for (let c = 0; c < V; c++) { if (special.has(c)) continue; if (row[c] > bv) { bv = row[c]; b = c; } }
    const r = runs[runs.length - 1];
    if (r && r.id === b) { r.n++; r.p += bv; } else runs.push({ id: b, n: 1, p: bv });
  }
  const out = [];
  for (const r of runs) {
    if (r.n < 2 || r.id === SIL) continue;
    const last = out[out.length - 1];
    if (last && last.ph === id2p[r.id]) { last.n += r.n; last.p += r.p; } else out.push({ ph: id2p[r.id], n: r.n, p: r.p });
  }
  out.forEach((x) => { x.p /= x.n; });
  return out;
}

const EN_VOWELS = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
/**
 * Deutlich gehörte Mitlaute, die im Wort nicht vorkommen (eingeschoben): mindestens 50 ms lang, mindestens 70 % sicher,
 * nicht ganz am Anfang (dort ist es oft Atem oder ein Mikrofon-Geräusch).
 */
function phInserted(exp, dec) {
  const heard = dec.map((x) => x.ph);
  const sub = (a, b) => (a === b || (EN_SAME[a] || []).includes(b) ? 0 : (EN_CLOSE[a] || []).includes(b) ? 0.3 : 1);
  const n = exp.length, m = heard.length;
  const d = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) d[i][0] = i;
  for (let j = 1; j <= m; j++) d[0][j] = j * 0.8;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 0.8, d[i - 1][j - 1] + sub(exp[i - 1], heard[j - 1]));
  // Rückweg: welche gehörten Laute wurden als „eingeschoben“ ausgerichtet?
  const ins = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(d[i][j] - (d[i - 1][j - 1] + sub(exp[i - 1], heard[j - 1]))) < 1e-9) { i--; j--; }
    else if (j > 0 && Math.abs(d[i][j] - (d[i][j - 1] + 0.8)) < 1e-9) { ins.push({ j: j - 1, before: i }); j--; }
    else i--;
  }
  return ins.filter(({ j: jj, before }) => {
    const x = dec[jj];
    return before > 0 && !EN_VOWELS.has(x.ph) && x.n >= 5 && x.p >= 0.7;
  }).map(({ j: jj }) => dec[jj]);
}

/** Mit und ohne Artikel („to/the/a“, „le/la/les/l’ …“) prüfen, das bessere Ergebnis zählt */
function phReferences(word, lang = 'en') {
  // Stehen mehrere Wörter da („colour / color“), müssen alle gesagt werden
  const first = answerAlts(word.foreign).map((a) => answerVariants(a)[0] || a).join(', ') || word.foreign;
  const full = ttsText(first, lang);
  const short = stripArticle(full, lang);
  return [...new Set([full, short])].filter(Boolean);
}

/** Aufnehmen und bewerten */
async function assessSpoken(word, { onStart, onLevel, onPhase } = {}, lang = 'en') {
  await loadPhoneticEngine(lang);
  const rec = await phRecord({ onStart, onLevel });
  if (!rec.samples) return { silent: true, peak: rec.peak };
  onPhase?.('thinking');
  const best = await assessWave(rec.samples, word, lang);
  best.peak = rec.peak;
  return best;
}

/* ---------- Vergleich mit der Vorlage (Google-Aufnahme des Worts, auf dem Gerät) ----------
   Das Modell bewertet zuerst die saubere Vorlage. Was selbst die Vorlage nicht schafft (z. B. „th“, „sh“, „-day“),
   wird dem Kind nicht abgezogen: Punkte = Punkte des Kindes im Verhältnis zur Vorlage (höchstens 1,5-fach).
   Kein Ton verlässt das Gerät; geladen wird nur die Vorlage, die es zum Vorspielen ohnehin gibt. */
const phRefCache = new Map();
async function phRefScore(word, lang) {
  const key = `${lang}|${typeof kokoroVoiceFor === 'function' ? kokoroVoiceFor(lang) : ''}|${word.foreign}`;
  if (phRefCache.has(key)) return phRefCache.get(key);
  const p = (async () => {
    if (typeof findClip !== 'function' || typeof kokoroVoiceFor !== 'function') return null;
    const t = ttsText(word.foreign, lang), voice = kokoroVoiceFor(lang);
    const set = typeof currentSet === 'function' ? currentSet() : null;
    const clip = await findClip(t, voice, set).catch(() => null);
    if (!clip?.blob) return null;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(1, 16000, 16000); // dekodiert direkt in 16 kHz
    const ab = await clip.blob.arrayBuffer();
    const audio = await new Promise((res, rej) => { const q = ctx.decodeAudioData(ab, res, rej); if (q && q.then) q.then(res, rej); });
    const wave = audio.getChannelData(0).slice();
    const r = await assessWaveRaw(wave, word, lang);
    return r && !r.silent ? { ...r, wave } : null;
  })().catch(() => null);
  phRefCache.set(key, p);
  p.then((r) => { if (!r) phRefCache.delete(key); }); // noch keine Vorlage: später nochmals versuchen
  return p;
}
/* Punkte im Verhältnis zur Vorlage: AUS – bewertet wieder wie vor dem Vergleich. Die Vorlage dient nur noch für „Hör genau hin“. */
const PH_REF_NORM = false;
/** Punkte des Kindes im Verhältnis zur Vorlage */
const phRel = (kid, ref) => Math.min(100, Math.round(kid * 100 / Math.min(100, Math.max(66, ref))));

/** Eine Aufnahme (16 kHz) bewerten – mit Vorlage, wenn es eine gibt */
async function assessWave(wave, word, lang = 'en') {
  const best = await assessWaveRaw(wave, word, lang);
  if (!best.silent) {
    const ref = await phRefScore(word, lang).catch(() => null);
    if (ref) {
      best.rawScore = best.score; best.refScore = ref.score;
      if (PH_REF_NORM) best.score = phRel(best.score, ref.score); // ausgeschaltet: hob zu viel Falsches über die Grenze
      // Laute einzeln vergleichen, wenn Vorlage und Kind dieselbe Lautfolge haben
      const same = ref.phones && best.phones && ref.ref === best.ref && ref.phones.length === best.phones.length && ref.phones.every((p, i) => p.exp === best.phones[i].exp);
      if (same) {
        if (PH_REF_NORM) best.phones = best.phones.map((p, i) => ({ ...p, rawScore: p.score, score: phRel(p.score, ref.phones[i].score) }));
        // schwächster Laut: diesen Teil der Vorlage kann man sich anhören
        let wi = -1;
        best.phones.forEach((p, i) => { if (p.exp && p.score < 60 && (wi < 0 || p.score < best.phones[wi].score)) wi = i; });
        const rp = wi >= 0 ? ref.phones[wi] : null;
        if (rp && rp.t0 >= 0) best.weak = { exp: best.phones[wi].exp, i: wi, n: best.phones.length, t0: rp.t0, t1: rp.t1, wave: ref.wave };
      }
    }
    best.passMin = passMinNow();
    best.ok = best.score >= best.passMin;
  }
  return best;
}
/** Teil der Vorlage um einen Laut herum langsamer vorspielen (mit etwas Umgebung, damit es natürlich klingt) */
function phPlayWeak(weak) {
  if (!weak?.wave) return;
  try {
    const ctx = phPlayWeak.ctx = phPlayWeak.ctx || new (window.AudioContext || window.webkitAudioContext)();
    const a = Math.max(0, (weak.t0 - 12) * 160), b = Math.min(weak.wave.length, (weak.t1 + 14) * 160);
    const seg = weak.wave.slice(a, b);
    const fade = Math.min(400, seg.length >> 3);
    for (let i = 0; i < fade; i++) { const k = i / fade; seg[i] *= k; seg[seg.length - 1 - i] *= k; }
    const buf = ctx.createBuffer(1, seg.length, 16000);
    buf.getChannelData(0).set(seg);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = 0.8; src.connect(ctx.destination); src.start();
  } catch { /* kein Ton */ }
}

/** Eine Aufnahme (16 kHz) bewerten: alle Varianten (mit/ohne Artikel, Aussprache-Varianten) – die beste zählt */
async function assessWaveRaw(wave, word, lang = 'en') {
  let best = null;
  const take = (r, ref) => {
    if (r.silent) { best = best || { ...r, ref }; return; }
    if (!best || best.silent || r.score > best.score) best = { ...r, ref };
  };
  if (lang === 'fr') {
    const engine = await loadFrenchEngine();
    const post = await frLogProbs(engine, wave);
    for (const ref of phReferences(word, 'fr')) {
      const toks = frExpected(engine, ref);
      if (toks.length) take(frScore(post, toks), ref);
    }
  } else {
    const engine = await loadPhoneticEngine();
    const post = await phPosteriors(engine, wave);
    for (const ref of phReferences(word)) {
      for (const phones of phExpectedAll(engine, ref)) if (phones.length) take(phScore(engine, post, phones), ref);
    }
  }
  if (!best) throw 'ph-word';
  return best;
}

function phErrorText(code) {
  if (code === 'ph-load') return `Die Lauterkennung konnte nicht geladen werden (${phState.error || 'unbekannter Fehler'}). Bist du online? Beim ersten Mal werden ca. ${phMB(typeof currentSet === 'function' ? langOf(currentSet()) : 'en')} MB geladen.`;
  if (code === 'ph-word') return 'Für dieses Wort kann die Lauterkennung keine Lautschrift bilden.';
  return 'Bei der Lauterkennung ist ein Fehler passiert.';
}

/* =========================================================
   Französisch: eigene Lauterkennung auf dem Gerät
   Modell: wav2vec2-french-phonemizer (Cnam-LMSSC, MIT; ONNX q4 von baronx16, ~90 MB). Es schreibt mit, welche
   LAUTE zu hören sind – ohne Wörterbuch, darum wird nichts „schöngeredet“. Die erwartete Lautschrift kommt von
   eSpeak NG (espeak-phonemizer, wird nur nachgeladen). Bewertet wird wie bei Englisch Laut für Laut.
   ========================================================= */
const PH_FR = {
  MODEL: 'https://huggingface.co/baronx16/wav2vec2-french-phonemizer-onnx/resolve/main/onnx/model_q4.onnx',
  ESPEAK: 'https://cdn.jsdelivr.net/npm/espeak-phonemizer@0.2.0/dist',
  MB: 95,
  VOCAB: { '|': 0, 1: 1, a: 2, b: 3, d: 4, e: 5, f: 6, h: 7, i: 8, j: 9, k: 10, l: 11, m: 12, n: 13, o: 14, p: 15, r: 16, s: 17, t: 18, u: 19, v: 20, w: 21, x: 22, y: 23, z: 24, 'ç': 25, 'ð': 26, 'ø': 27, 'ŋ': 28, 'œ': 29, 'ɐ': 30, 'ɑ': 31, 'ɒ': 32, 'ɔ': 33, 'ə': 34, 'ɛ': 35, 'ɜ': 36, 'ɡ': 37, 'ɣ': 38, 'ɨ': 39, 'ɪ': 40, 'ɬ': 41, 'ɲ': 42, 'ɹ': 43, 'ɾ': 44, 'ʁ': 45, 'ʃ': 46, 'ʊ': 47, 'ʌ': 48, 'ʍ': 49, 'ʒ': 50, 'ʔ': 51, 'ʲ': 52, 'ː': 53, '̃': 54, 'β': 55, 'θ': 56 },
  BLANK: 58, SEP: 0, NASAL: 54, V: 61,
};
// Gleichwertige Aussprachen (z. B. Schweizer Zungen-r, „un“ wie „in“)
const FR_EQ = { 'ʁ': ['ɾ', 'r', 'x', 'ɣ', 'h'], a: ['ɑ', 'ɐ'], 'ɑ': ['a'], y: ['ɨ'], 'ə': ['œ', 'ø', 'ɛ', 'e'], e: ['ɛ'], 'ɛ': ['e'], o: ['ɔ'], 'ɔ': ['o'], 'ø': ['œ', 'ə'], 'œ': ['ø', 'ə'], i: ['ɪ', 'j'], u: ['ʊ', 'w'], j: ['i'], w: ['u'] };
// sehr nahe Laute (stimmhaft/stimmlos …): zählen fast voll
const FR_CLOSE = { s: ['z'], z: ['s'], t: ['d'], d: ['t'], p: ['b'], b: ['p'], k: ['ɡ'], 'ɡ': ['k'], f: ['v'], v: ['f'], 'ʃ': ['ʒ', 's'], 'ʒ': ['ʃ', 'z'], 'ɲ': ['n', 'j'], n: ['ɲ', 'm'], m: ['n'], y: ['i'] };
const FR_CLOSE_W = Math.log(0.6);
const FR_ID2P = Object.fromEntries(Object.entries(PH_FR.VOCAB).map(([k, v]) => [v, k]));

function loadFrenchEngine() {
  if (phState.fr) return Promise.resolve(phState.fr);
  if (phState.frLoading) return phState.frLoading;
  if (phState.engine || !phState.loading) phRelease('en'); // Englisch freigeben (ausser es lädt gerade)
  phState.status = 'loading'; phState.progress = 0; phState.error = ''; phNotify();
  phState.frLoading = (async () => {
    const [esp] = await Promise.all([import(`${PH_FR.ESPEAK}/espeak.mjs`), loadScriptOnce(PH.ORT_URL)]);
    await esp.initialize(PH_FR.ESPEAK);
    await esp.setVoice('fr');
    const ort = window.ort;
    ort.env.wasm.wasmPaths = PH.ORT_WASM;
    ort.env.wasm.numThreads = 1;
    const model = await phFetchModel((f) => { phState.progress = f; phNotify(); }, PH_FR.MODEL, 90e6);
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    phState.fr = { esp, session, ort };
    phState.status = 'ready'; phState.progress = 1; phNotify();
    return phState.fr;
  })().catch((e) => {
    phState.status = 'error';
    phState.error = String(e?.message || e);
    phState.frLoading = null;
    phNotify();
    throw 'ph-load';
  });
  return phState.frLoading;
}

/** Erwartete Laute (als Modell-Zeichen) für einen französischen Text */
function frExpected(engine, text) {
  const ipa = engine.esp.getPhonemes(text).map((x) => String(x.phonemes || '')).join(' ');
  const toks = [];
  for (const ch of ipa) {
    const c = ch === 'ɥ' ? 'y' : ch; // „ɥ“ (huit, nuit) kennt das Modell als „y“
    if (c === '|' || c === 'ː') continue;
    if (PH_FR.VOCAB[c] != null) toks.push(PH_FR.VOCAB[c]);
  }
  return toks;
}

/** log-Wahrscheinlichkeiten je Frame (20 ms) */
async function frLogProbs(engine, wave) {
  const { session, ort } = engine;
  let m = 0;
  for (let i = 0; i < wave.length; i++) m += wave[i];
  m /= wave.length || 1;
  let v = 0;
  for (let i = 0; i < wave.length; i++) v += (wave[i] - m) ** 2;
  const sd = Math.sqrt(v / (wave.length || 1)) + 1e-7;
  const x = new Float32Array(wave.length);
  for (let i = 0; i < wave.length; i++) x[i] = (wave[i] - m) / sd;
  const out = await session.run({ input_values: new ort.Tensor('float32', x, [1, x.length]) });
  const logits = out.logits || out[Object.keys(out)[0]];
  const [, T, V] = logits.dims;
  const lp = new Float32Array(T * V);
  for (let t = 0; t < T; t++) {
    let mx = -Infinity;
    for (let c = 0; c < V; c++) mx = Math.max(mx, logits.data[t * V + c]);
    let sum = 0;
    for (let c = 0; c < V; c++) sum += Math.exp(logits.data[t * V + c] - mx);
    const ls = Math.log(sum) + mx;
    for (let c = 0; c < V; c++) lp[t * V + c] = logits.data[t * V + c] - ls;
  }
  return { lp, T, V };
}

function frEquivalents(tok, next) {
  const p = FR_ID2P[tok];
  const alts = [...(FR_EQ[p] || [])];
  if (p === 'œ' && next === PH_FR.NASAL) alts.push('ɛ'); // un ≈ in
  return [tok, ...alts.map((a) => PH_FR.VOCAB[a]).filter((x) => x != null)];
}

/**
 * Laut für Laut bewerten: Die erwartete Lautfolge wird über die Aufnahme gelegt (CTC-Ausrichtung).
 * Je Laut: Wie viel wahrscheinlicher war der erwartete Laut als der beste andere? Zusätzliche Laute
 * (z. B. „beaucoupe“) zählen als Fehler. Ein einziger klar falscher Laut drückt die Punkte deutlich.
 */
function frScore(post, toks) {
  const { lp, T, V } = post;
  const { BLANK, SEP } = PH_FR;
  const at = (t, c) => lp[t * V + c];
  const argmax = (t) => { let b = 0, bv = -Infinity; for (let c = 0; c < V; c++) { if (c === SEP || c > 56) continue; const x = at(t, c); if (x > bv) { bv = x; b = c; } } return { b, bv }; };
  // Sprache vorhanden?
  let speech = 0;
  for (let t = 0; t < T; t++) { const { bv } = argmax(t); if (bv > at(t, BLANK) && bv > Math.log(0.3)) speech++; }
  if (!toks.length || speech < Math.max(2, Math.ceil(toks.length * 0.4))) return { silent: true };
  const ext = [BLANK];
  for (const k of toks) ext.push(k, BLANK);
  const S = ext.length;
  if (T < toks.length) return { silent: true };
  const NEG = -1e9;
  let prev = new Float64Array(S).fill(NEG);
  const back = new Int16Array(T * S);
  prev[0] = at(0, ext[0]) + 0; prev[1] = at(0, ext[1]);
  for (let t = 1; t < T; t++) {
    const cur = new Float64Array(S).fill(NEG);
    for (let s = 0; s < S; s++) {
      let v = prev[s], b = s;
      if (s >= 1 && prev[s - 1] > v) { v = prev[s - 1]; b = s - 1; }
      if (s >= 2 && ext[s] !== BLANK && ext[s] !== ext[s - 2] && prev[s - 2] > v) { v = prev[s - 2]; b = s - 2; }
      cur[s] = v + at(t, ext[s]);
      back[t * S + s] = b;
    }
    prev = cur;
  }
  let s = prev[S - 1] >= prev[S - 2] ? S - 1 : S - 2;
  const path = new Int16Array(T);
  for (let t = T - 1; t >= 0; t--) { path[t] = s; if (t) s = back[t * S + s]; }
  const frames = new Map();
  for (let t = 0; t < T; t++) if (ext[path[t]] !== BLANK) { if (!frames.has(path[t])) frames.set(path[t], []); frames.get(path[t]).push(t); }
  const sig = (g) => 1 / (1 + Math.exp(-(g + 0.5) * 1.6));
  const phones = [];
  for (let k = 0; k < toks.length; k++) {
    const st = 2 * k + 1, tok = toks[k];
    const eq = frEquivalents(tok, toks[k + 1]);
    const fr = frames.get(st) || [];
    let g = -10, heard = '?';
    if (fr.length) {
      const close = (FR_CLOSE[FR_ID2P[tok]] || []).map((q) => PH_FR.VOCAB[q]).filter((x) => x != null && !eq.includes(x));
      let tb = fr[0], best = -Infinity;
      for (const t of fr) { const x = Math.max(...eq.map((c) => at(t, c)), ...close.map((c) => at(t, c) + FR_CLOSE_W)); if (x > best) { best = x; tb = t; } }
      let other = -Infinity, oc = tok;
      for (let c = 0; c < V; c++) { if (c === BLANK || c === SEP || c > 56 || eq.includes(c)) continue; if (at(tb, c) > other) { other = at(tb, c); oc = c; } }
      g = best - other;
      heard = g >= 0 ? FR_ID2P[tok] : FR_ID2P[oc];
    }
    phones.push({ exp: FR_ID2P[tok], heard, score: Math.round(100 * sig(g)) });
  }
  // zusätzliche Laute in den Lücken (deutlich gehört, aber nicht erwartet)
  let extra = 0, lastExtra = -1;
  for (let t = 0; t < T; t++) {
    if (ext[path[t]] !== BLANK) { lastExtra = -1; continue; }
    const { b, bv } = argmax(t);
    if (bv < Math.log(0.6) || bv < at(t, BLANK)) continue;
    const i = (path[t] - 1) / 2; // Lücke nach Laut i (bzw. vor dem ersten)
    const near = [toks[Math.floor(i)], toks[Math.ceil(i)]].filter((x) => x != null).flatMap((x, j, a) => frEquivalents(x, a[j + 1]));
    if (near.includes(b) || b === PH_FR.NASAL) continue;
    if (b !== lastExtra) { extra++; lastExtra = b; phones.push({ exp: '', heard: FR_ID2P[b], score: 15 }); }
  }
  const ps = phones.map((p) => p.score / 100);
  const mean = ps.reduce((a, x) => a + x, 0) / ps.length;
  const min = Math.min(...ps);
  return { silent: false, score: Math.round(100 * (0.35 * mean + 0.65 * min)), phones, extra };
}
