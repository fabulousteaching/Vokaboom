/* Vokaboom – Vorlesen mit Kokoro (läuft im Hintergrund, damit die Seite nicht ruckelt)
 * Kokoro-82M: Apache-2.0 (hexgrad), kokoro-js: Apache-2.0. Das Modell (~90 MB) lädt der Browser einmal
 * von Hugging Face und speichert es; danach geht es ohne erneuten Download.
 */
const KOKORO_JS = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let ttsP = null;

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

self.onmessage = async (e) => {
  const { id, type, text, voice, speed } = e.data || {};
  try {
    const tts = await load();
    if (type === 'load') { postMessage({ type: 'ready' }); return; }
    if (type === 'gen') {
      const out = await tts.generate(String(text || ''), { voice, speed: speed || 1 });
      const audio = out.audio instanceof Float32Array ? out.audio : new Float32Array(out.audio);
      postMessage({ type: 'audio', id, audio, sr: out.sampling_rate }, [audio.buffer]);
    }
  } catch (err) {
    postMessage({ type: 'error', id: type === 'load' ? null : id, error: String((err && err.message) || err) });
  }
};
