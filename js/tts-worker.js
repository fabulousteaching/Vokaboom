/* Vokaboom – Vorlesen mit Kokoro (läuft im Hintergrund, damit die Seite nicht ruckelt)
 * Kokoro-82M: Apache-2.0 (hexgrad), kokoro-js: Apache-2.0. Das Modell (~90 MB) lädt der Browser einmal
 * von Hugging Face und speichert es; danach geht es ohne erneuten Download.
 * Französisch (Stimme Siwis): kokoro-js kann nur englische Lautschrift. Die französische Lautschrift macht
 * eSpeak NG (espeak-phonemizer, GPL-3.0, ca. 6 MB, wird nur nachgeladen, nicht in Vokaboom eingebaut).
 */
const KOKORO_JS = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const ESPEAK = 'https://cdn.jsdelivr.net/npm/espeak-phonemizer@0.2.0/dist';
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let ttsP = null, frP = null;

function load() {
  if (!ttsP) {
    ttsP = (async () => {
      const { KokoroTTS } = await import(KOKORO_JS);
      return KokoroTTS.from_pretrained(MODEL, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p) => {
          if (p && p.status === 'progress' && /onnx/.test(p.file || '')) postMessage({ type: 'progress', loaded: p.loaded, total: p.total });
        },
      });
    })();
    ttsP.catch(() => { ttsP = null; });
  }
  return ttsP;
}

/** Französische Lautschrift (eSpeak NG) – einmal laden */
function loadFrench() {
  if (!frP) {
    frP = (async () => {
      const esp = await import(`${ESPEAK}/espeak.mjs`);
      await esp.initialize(ESPEAK);
      await esp.setVoice('fr');
      return esp;
    })();
    frP.catch(() => { frP = null; });
  }
  return frP;
}
async function frenchPhonemes(text) {
  const esp = await loadFrench();
  return esp.getPhonemes(text).map((x) => String(x.phonemes || '').replace(/-/g, '') + (x.terminator || ''))
    .join(' ').replace(/\s+/g, ' ').trim();
}

self.onmessage = async (e) => {
  const { id, type, text, voice, speed } = e.data || {};
  try {
    if (type === 'preload-fr') { await loadFrench(); return; }
    const tts = await load();
    if (type === 'load') { postMessage({ type: 'ready' }); return; }
    if (type === 'gen') {
      let out;
      if (/^f/.test(voice || '')) {
        // Französisch: eigene Lautschrift, dann direkt ans Modell (generate() kennt nur englische Stimmen)
        const { input_ids } = tts.tokenizer(await frenchPhonemes(String(text || '')), { truncation: true });
        out = await tts.generate_from_ids(input_ids, { voice, speed: speed || 1 });
      } else {
        out = await tts.generate(String(text || ''), { voice, speed: speed || 1 });
      }
      const audio = out.audio instanceof Float32Array ? out.audio : new Float32Array(out.audio);
      postMessage({ type: 'audio', id, audio, sr: out.sampling_rate }, [audio.buffer]);
    }
  } catch (err) {
    if (type === 'preload-fr') return;
    postMessage({ type: 'error', id: type === 'load' ? null : id, error: String((err && err.message) || err) });
  }
};
