/* Vokaboom – Übungszeit mitschreiben (für die Übersicht der Lehrperson)
 *
 * Pro Portion und Tag: set.progress.log = { "2026-11-23": { cards: [Sekunden, Antworten, richtig], "g:rain": [...] } }
 * Zeit: alle 10 Sekunden, solange eine Übung oder ein Spiel offen ist, das Fenster sichtbar ist und das Kind in der
 * letzten Minute etwas getippt oder geklickt hat (wer weggeht, zählt nicht). Einträge älter als 62 Tage fallen weg.
 * Der Log wandert mit dem Übungsstand in die Cloud (vokaboom_progress) – nichts Zusätzliches in der Datenbank.
 */
'use strict';

const PLOG_TICK = 10, PLOG_IDLE = 60000, PLOG_KEEP_DAYS = 62;
const PLOG_MODES = ['cards', 'match', 'write', 'speak', 'dictation', 'test'];
let plogInput = 0, plogTicks = 0;
['pointerdown', 'keydown', 'touchstart', 'input'].forEach((ev) => addEventListener(ev, () => { plogInput = Date.now(); }, { passive: true, capture: true }));

function plogDay(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function plogBucket(set, key) {
  const p = set.progress = set.progress || {};
  const log = p.log = p.log && typeof p.log === 'object' ? p.log : {};
  const day = plogDay();
  if (!log[day]) { // neuer Tag: alte Tage aufräumen
    const cut = plogDay(Date.now() - PLOG_KEEP_DAYS * 864e5);
    Object.keys(log).forEach((d) => { if (d < cut) delete log[d]; });
    log[day] = {};
  }
  const b = log[day][key];
  return Array.isArray(b) && b.length === 3 ? b : (log[day][key] = [0, 0, 0]);
}
/** Welche Portion und welche Übung ist gerade offen? */
function plogContext() {
  if (typeof ui !== 'object') return null;
  if (PLOG_MODES.includes(ui.view)) return { set: currentSet(), key: ui.view };
  if (ui.view === 'review') return { set: typeof rvItem === 'function' ? rvItem()?.set : null, key: 'review' };
  if (ui.view === 'game' && ui.game) return { set: currentSet(), key: `g:${ui.game}` };
  return null;
}
/** Eine Antwort zählen (aus trackWord und den Spielen) */
function plogAnswer(set, key, ok) {
  if (!set || !key) return;
  try { const b = plogBucket(set, key); b[1]++; if (ok) b[2]++; } catch { /* egal */ }
}
setInterval(() => {
  if (document.hidden || Date.now() - plogInput > PLOG_IDLE) return;
  const c = plogContext();
  if (!c?.set) return;
  plogBucket(c.set, c.key)[0] += PLOG_TICK;
  c.set.updated = Date.now();
  if (++plogTicks % 6 === 0 && typeof saveDB === 'function') saveDB(); // höchstens jede Minute speichern
}, PLOG_TICK * 1000);
addEventListener('pagehide', () => { if (plogTicks && typeof saveNow === 'function') try { saveNow(); } catch { /* egal */ } });

/* ---------- Auswertung (Lehrperson) ---------- */
const PLOG_RANGES = [['today', 'Heute', 1], ['3d', '3 Tage', 3], ['week', 'Woche', 7], ['month', 'Monat', 30]];
const PLOG_LABELS = { cards: 'Lernkarten', match: 'Zuordnen', write: 'Schreiben', speak: 'Aussprechen', dictation: 'Hören & Schreiben', test: 'Test', review: 'Wiederholen' };
function plogLabel(key) {
  if (key.startsWith('g:')) { const g = typeof GAME_BY_ID === 'object' ? GAME_BY_ID[key.slice(2)] : null; return `Spiel: ${g ? g.name : key.slice(2)}`; }
  return PLOG_LABELS[key] || key;
}
/** Tage (YYYY-MM-DD) einer Zeitspanne, heute eingeschlossen */
function plogDays(range) {
  const n = (PLOG_RANGES.find((r) => r[0] === range) || PLOG_RANGES[0])[2];
  return new Set(Array.from({ length: n }, (_, i) => plogDay(Date.now() - i * 864e5)));
}
/** Summe für einen Übungsstand (eine Portion eines Kindes) in einer Zeitspanne: { sec, n, ok, by: { key: [sec, n, ok] }, days } */
function plogSum(p, days) {
  const out = { sec: 0, n: 0, ok: 0, by: {}, days: 0 };
  const log = p && p.log && typeof p.log === 'object' ? p.log : {};
  for (const [d, day] of Object.entries(log)) {
    if (!days.has(d) || !day || typeof day !== 'object') continue;
    let any = false;
    for (const [k, b] of Object.entries(day)) {
      if (!Array.isArray(b)) continue;
      const t = out.by[k] = out.by[k] || [0, 0, 0];
      t[0] += +b[0] || 0; t[1] += +b[1] || 0; t[2] += +b[2] || 0;
      out.sec += +b[0] || 0; out.n += +b[1] || 0; out.ok += +b[2] || 0;
      if (b[0] || b[1]) any = true;
    }
    if (any) out.days++;
  }
  return out;
}
function plogMin(sec) {
  if (!sec) return '0 Min.';
  const m = Math.round(sec / 60);
  if (m < 1) return '< 1 Min.';
  return m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60 ? `${m % 60} Min.` : ''}`.trim() : `${m} Min.`;
}
