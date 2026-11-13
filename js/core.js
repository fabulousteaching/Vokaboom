/* Vokaboom – Kern: Hilfsfunktionen, Sprache, Parser, Speicher, Bilder, Audio, Spracherkennung */
'use strict';

/* ---------------- Hilfsfunktionen ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
const stripAccents = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/ß/g, 'ss');

function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
const similarity = (a, b) => (!a && !b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length));

const isFramed = (() => { try { return window.top !== window.self; } catch { return true; } })();

/* ---------------- Sprachen: Englisch und Französisch ---------------- */
const LANGS = {
  en: { name: 'Englisch', short: 'EN', adj: 'englische' },
  fr: { name: 'Französisch', short: 'FR', adj: 'französische' },
};
const langOf = (set) => (set?.lang === 'fr' ? 'fr' : 'en');
/* Akzent und nötige Punktzahl bestimmt die Lehrperson (angemeldet). Lernende – mit Kinder-Login, über QR-Code
   oder ohne Anmeldung – bekommen, was in der Portion steht (von der Lehrperson), sonst Britisch und 60 Punkte. */
const isTeacher = () => typeof cloud === 'object' && !!cloud.uid;
const ctxSet = () => (typeof currentSet === 'function' ? currentSet() : null);
const accentNow = () => (isTeacher() ? (db.settings.accent === 'us' ? 'us' : 'gb') : (ctxSet()?.accent === 'us' ? 'us' : 'gb'));
/** Eigene Portion (selbst erstellt, nicht über Link/QR bekommen, nicht von der Klasse)? */
const isOwnSet = (s) => !!s && !s.shareId && !s.assigned && !(typeof isKid === 'function' && isKid());
/** Darf die Punktzahl einstellen: Lehrperson oder wer selbst Portionen erstellt (und per Link teilt) – nicht Kinder */
const mayEditPoints = () => !(typeof isKid === 'function' && isKid()) && (isTeacher() || db.sets.some(isOwnSet));
const passMinNow = () => {
  const own = Number(db.settings.phonetic?.passMin) || 60;
  const set = ctxSet();
  if (!set ? isTeacher() : isOwnSet(set)) return own;
  const v = Number(set?.passMin);
  return v >= 30 && v <= 90 ? v : 60;
};
/** Eigene Einstellungen in die eigenen Portionen schreiben (Klassen und Link/QR bekommen sie so mit).
    Punktzahl: alle, die Portionen erstellen. Akzent: nur angemeldete Lehrperson. Liefert true bei Änderung. */
function applyTeacherPrefs() {
  if (typeof isKid === 'function' && isKid()) return false;
  const accent = db.settings.accent === 'us' ? 'us' : 'gb', passMin = Number(db.settings.phonetic?.passMin) || 60;
  let changed = false;
  for (const s of db.sets) {
    if (!isOwnSet(s)) continue;
    let ch = false;
    if (s.passMin !== passMin) { s.passMin = passMin; ch = true; }
    if (isTeacher() && s.accent !== accent) { s.accent = accent; ch = true; }
    if (ch) { s.updated = Date.now(); changed = true; }
  }
  return changed;
}
const langCode = (lang) => (lang === 'fr' ? 'fr-FR' : accentNow() === 'us' ? 'en-US' : 'en-GB');

const ARTICLE_RE = {
  en: /^(?:the|a|an|to)\s+/i,
  fr: /^(?:(?:le|la|les|un|une|des|du|de la|se)\s+|(?:l|d|s)['’]\s*|de l['’]\s*)/i,
  de: /^(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer|sich)\s+/i,
};

/** Text ohne Klammerinhalt, ohne führenden Artikel, erstes Alternativwort */
function stripParens(s) {
  return String(s).replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}
function stripArticle(s, lang) {
  const re = ARTICLE_RE[lang];
  if (!re) return s;
  let out = s, prev;
  do { prev = out; out = out.replace(re, ''); } while (out !== prev && out.length);
  return out.trim() || s.trim();
}
function core(text, lang) {
  let s = stripParens(text || '');
  s = s.split(/\s*[\/;]\s*/)[0];
  s = s.replace(/[.!?…]+$/, '').trim();
  return stripArticle(s, lang);
}
/** Mögliche Schlüssel für das Bildwörterbuch */
function lookupKeys(text, lang) {
  if (!text) return [];
  const keys = new Set();
  const c = core(text, lang);
  if (c) keys.add(c);
  stripParens(text).split(/\s*[\/;,]\s*|\s+[–—-]\s+/).forEach((part) => {
    const k = stripArticle(part.replace(/[.!?…]+$/, '').trim(), lang);
    if (k) keys.add(k);
  });
  return [...keys];
}

/** Alle als richtig geltenden Schreibweisen: colo(u)r → colour + color, a / b → a, b */
function answerVariants(text) {
  const out = new Set();
  String(text).split(/\s*[\/;]\s*/).forEach((alt) => {
    const t = alt.trim();
    if (!t) return;
    const without = t.replace(/\s*\([^)]*\)\s*/g, (m) => (/^\s/.test(m) && /\s$/.test(m) ? ' ' : '')).replace(/\s+/g, ' ').trim();
    const withContent = t.replace(/[()[\]]/g, '').replace(/\s+/g, ' ').trim();
    [without, withContent].forEach((v) => v && out.add(v));
  });
  if (!out.size) out.add(String(text).trim());
  return [...out];
}

function normAnswer(s) {
  return String(s).normalize('NFC').replace(/[’‘`´]/g, "'")
    .replace(/\s+[–—-]\s+/g, ', ').replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').trim().toLowerCase();
}

/* ---------- Geschriebene Antworten prüfen ----------
   Regeln: „the/a/an/to“ sind freiwillig. „…“ wird ignoriert. colo(u)r: beide Schreibweisen richtig.
   Fast richtig (orange, mit Hinweis): Abstand fehlt oder ist zu viel („icecream“ statt „ice cream“),
   bei „colour / color“ nur eine Variante (beide mit oder ohne / ist richtig), Groß-/Kleinschreibung,
   fehlendes Fragezeichen, ein kleiner Tippfehler. */
const ansPrep = (s) => String(s || '').normalize('NFC').replace(/[’‘`´]/g, "'").replace(/\.{2,}|…/g, ' ');
/** Vergleichsschlüssel: ohne Satzzeichen, ohne Artikel am Anfang, Abstände auf einen vereinheitlicht */
function ansKey(s) {
  const t = ansPrep(s).replace(/[?¿!.,;:"“”„«»()[\]/]/g, ' ').replace(/\s+[–—-]\s+/g, ' ').replace(/\s+/g, ' ').trim();
  return stripArticle(t, 'en');
}
/** Alternativen einer Lösung: „colour / color“ → [colour, color] */
const answerAlts = (text) => String(text || '').split(/\s*[\/;]\s*/).map((s) => s.trim()).filter(Boolean);
/** Wie nah ist die Eingabe an der Lösung? null = falsch, sonst die Abweichungen (leer = genau richtig):
 *  space (Abstand), case (Groß/klein), accent (Akzent), typo (ein Tippfehler) */
function compareKeys(ik, tk) {
  if (!ik || !tk) return null;
  if (ik === tk) return [];
  const la = stripAccents(ik.toLowerCase()), lb = stripAccents(tk.toLowerCase());
  const na = la.replace(/ /g, ''), nb = lb.replace(/ /g, '');
  if (na !== nb) {
    const d = lev(na, nb);
    return (nb.length >= 4 && d === 1) || (nb.length >= 9 && d === 2) ? ['typo'] : null;
  }
  const issues = [];
  if (la !== lb) issues.push('space');
  const ca = ik.replace(/ /g, ''), cb = tk.replace(/ /g, '');
  if (ca !== cb) issues.push(ca.toLowerCase() === cb.toLowerCase() ? 'case' : 'accent');
  return issues;
}
const ISSUE_WEIGHT = { space: 1, case: 1, accent: 2, typo: 3 };
const matchCost = (m) => (m ? m.issues.reduce((s, i) => s + ISSUE_WEIGHT[i], 0) : Infinity);
const betterMatch = (a, b) => (matchCost(b) < matchCost(a) ? b : a);
const joinMatch = (a, b) => (a && b ? { issues: [...new Set([...a.issues, ...b.issues])], pairs: [...a.pairs, ...b.pairs] } : null);
const keyMatch = (ik, tk) => { const issues = compareKeys(ik, tk); return issues ? { issues, pairs: [{ ik, tk }] } : null; };
function permutations(arr) {
  if (arr.length <= 1 || arr.length > 5) return [arr];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
}
/** Eine Eingabe gegen eine Alternative (mit Klammer-Varianten) */
function matchAlt(input, alt) {
  const ik = ansKey(input);
  return answerVariants(alt).reduce((best, f) => betterMatch(best, keyMatch(ik, ansKey(f))), null);
}
/** Alle Alternativen geschrieben? Mit Trennzeichen („colour / color“, „colour, color“) oder ohne („colour color“) */
function matchAllAlts(input, alts) {
  let best = null;
  const parts = ansPrep(input).split(/[\/,;]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === alts.length) {
    for (const perm of permutations(alts)) {
      best = betterMatch(best, perm.reduce((m, a, i) => joinMatch(m, matchAlt(parts[i], a)), { issues: [], pairs: [] }));
    }
  }
  if (!best || best.issues.length) {
    const ik = ansKey(input);
    for (const perm of permutations(alts)) {
      const forms = perm.reduce((acc, a) => acc.flatMap((pre) => answerVariants(a).map((f) => (pre ? `${pre} ${ansKey(f)}` : ansKey(f)))), ['']);
      forms.slice(0, 64).forEach((fk) => { best = betterMatch(best, keyMatch(ik, fk)); });
    }
  }
  return best;
}
/** Hinweis zu den Abständen: getrennt oder zusammen? */
function spaceNote(pairs) {
  const spaces = (s) => (s.match(/ /g) || []).length;
  const p = pairs.find((x) => stripAccents(x.ik.toLowerCase()) !== stripAccents(x.tk.toLowerCase())) || pairs[0];
  if (!p) return 'Achte auf die Abstände.';
  const t = spaces(p.tk), i = spaces(p.ik);
  return t > i ? `Achte auf die Abstände: „${p.tk}“ schreibt man getrennt.`
    : t < i ? `Achte auf die Abstände: „${p.tk}“ schreibt man zusammen.`
      : `Achte auf die Abstände: „${p.tk}“.`;
}

/** Bewertet eine geschriebene Antwort: { status: correct | almost | wrong, note } */
const FR_ART = /^\s*(de la\s+|de l['’]\s*|le\s+|la\s+|les\s+|l['’]\s*|un\s+|une\s+|des\s+|du\s+)/i;
const frArt = (s) => ((String(s || '').normalize('NFC').match(FR_ART) || [])[1] || '').trim().toLowerCase().replace('’', "'");
function checkAnswer(input, word, lang = langOf(typeof currentSet === 'function' ? currentSet() : null)) {
  const r = checkAnswerBase(input, word);
  if (lang !== 'fr' || !ansKey(input)) return r;
  const tArt = frArt(answerAlts(word.foreign)[0]), iArt = frArt(input);
  if (!tArt) return r;
  // Falscher Artikel (la chien statt le chien) ist falsch, auch wenn nur ein Buchstabe anders ist
  const sameArt = (a, b) => a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ') || a.toLowerCase() === b.toLowerCase();
  if (iArt && !sameArt(iArt, tArt) && !answerAlts(word.foreign).some((a) => sameArt(frArt(a), iArt))) {
    return { status: 'wrong', note: `Der Artikel stimmt nicht: „${answerAlts(word.foreign)[0]}“.` };
  }
  if (r.status !== 'wrong') return r;
  const bare = { ...word, foreign: answerAlts(word.foreign).map((a) => a.replace(FR_ART, '')).join(' / ') };
  const r2 = checkAnswerBase(String(input).replace(FR_ART, ''), bare);
  if (r2.status === 'wrong') return r;
  if (!iArt) return { status: 'almost', note: `Fast! Vergiss den Artikel nicht: „${answerAlts(word.foreign)[0]}“.` };
  if (iArt !== tArt) return { status: 'wrong', note: `Der Artikel stimmt nicht: „${answerAlts(word.foreign)[0]}“.` };
  return r2;
}
function checkAnswerBase(input, word) {
  if (!ansKey(input)) return { status: 'wrong', note: 'Keine Antwort.' };
  const alts = answerAlts(word.foreign);
  if (!alts.length) return { status: 'wrong' };
  let m = alts.length > 1 ? matchAllAlts(input, alts) : null;
  let partial = false;
  if (!m) {
    m = alts.reduce((best, a) => betterMatch(best, matchAlt(input, a)), null);
    partial = !!m && alts.length > 1;
  }
  if (!m) return { status: 'wrong' };
  const has = (x) => m.issues.includes(x);
  const notes = [];
  if (partial) notes.push(`Es gibt ${alts.length === 2 ? 'zwei' : 'mehrere'} Lösungen: „${alts.join(' / ')}“. Schreib ${alts.length === 2 ? 'beide' : 'alle'}.`);
  if (has('space')) notes.push(spaceNote(m.pairs));
  if (has('case')) notes.push('Achte auf die Groß- und Kleinschreibung.');
  if (has('accent')) notes.push('Achte auf die Schreibweise.');
  if (has('typo')) notes.push('Ein kleiner Rechtschreibfehler.');
  if (/\?/.test(word.foreign) && !/\?/.test(input)) notes.push('Denk an das Fragezeichen.');
  return notes.length ? { status: 'almost', note: `Fast! ${notes.join(' ')}` } : { status: 'correct' };
}

/* ---------- Aussprache: Vergleich mit dem erkannten Text ---------- */
const HOMOPHONES = {
  en: [['two', 'too', 'to'], ['four', 'for'], ['eight', 'ate'], ['one', 'won'], ['right', 'write'], ['sea', 'see'],
    ['sun', 'son'], ['flower', 'flour'], ['pear', 'pair'], ['here', 'hear'], ['no', 'know'], ['bee', 'be'],
    ['blue', 'blew'], ['night', 'knight'], ['meat', 'meet'], ['tail', 'tale'], ['week', 'weak'], ['wood', 'would'],
    ['hour', 'our'], ['deer', 'dear'], ['bear', 'bare'], ['eye', 'i'], ['red', 'read'], ['whole', 'hole'],
    ['road', 'rode'], ['mail', 'male'], ['plane', 'plain'], ['sale', 'sail'], ['their', 'there'], ['new', 'knew'],
    ['bread', 'bred'], ['horse', 'hoarse'], ['nose', 'knows'], ['weather', 'whether'], ['witch', 'which'], ['where', 'wear'],
    ['rain', 'reign'], ['piece', 'peace'], ['flu', 'flew'], ['hair', 'hare'], ['buy', 'by', 'bye'], ['wait', 'weight'],
    ['way', 'weigh'], ['knot', 'not'], ['berry', 'bury'], ['heel', 'heal'], ['paws', 'pause'], ['toe', 'tow'],
    ['break', 'brake'], ['board', 'bored'], ['made', 'maid'], ['tide', 'tied'], ['steel', 'steal'], ['fair', 'fare'],
    ['cereal', 'serial'], ['dear', 'deer'], ['night', 'nite'], ['tea', 'tee'], ['jeans', 'genes'], ['ok', 'okay']],
};
const homophoneMap = { en: new Map() };
for (const group of HOMOPHONES.en) for (const w of group) homophoneMap.en.set(w, group[0]);

function normSpeech(s, lang, keepArticle = false) {
  let t = String(s || '').toLowerCase().normalize('NFC').replace(/[’‘`´]/g, "'");
  t = stripParens(t);
  t = t.replace(/\b(\d{1,2})\b/g, (m, n) => (window.NUMBER_WORDS[lang] || [])[+n] || m);
  t = t.replace(/[.,!?;:«»"“”„()…]/g, ' ').replace(/\s+[–—-]\s+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!keepArticle) t = stripArticle(t, lang);
  t = stripAccents(t).replace(/-/g, ' ').replace(/(^|\s)'+|'+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim(); // they're bleibt ganz
  const hm = homophoneMap[lang];
  if (hm) t = t.split(' ').map((w) => hm.get(w) || w).join(' ');
  return t;
}

/* ---------- Aussprache vergleichen statt Schreibweise ----------
   Die Spracherkennung schreibt oft ein gleich klingendes Wort („there“ statt „their“, „Thai“ statt „tie“,
   „is“ statt „his“). Deshalb vergleichen wir die Laute aus dem englischen Aussprache-Wörterbuch (CMUdict,
   über charsiu-js, gemeinfrei/BSD): Gleich klingend zählt als richtig. Kurze Wörter (höchstens 3 Laute)
   dürfen um einen ähnlichen Laut abweichen (d/th, w/v, i/ie, verschlucktes h …), längere nicht –
   „Brad“ oder „bird“ statt „bread“ bleibt falsch. Stehen mehrere Wörter da, müssen alle gesagt werden. */
const CMU_URL = 'https://cdn.jsdelivr.net/npm/charsiu-js@0.2.0/assets/cmudict.json';
const cmu = { dict: null, loading: null };
function loadCmu() {
  if (cmu.dict) return Promise.resolve(cmu.dict);
  if (!cmu.loading) {
    cmu.loading = fetch(CMU_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((d) => { cmu.dict = d; return d; })
      .catch((e) => { cmu.loading = null; throw e; });
  }
  return cmu.loading;
}
/** Laute eines Wortes, z. B. their → [DH, EH, R]; unbekannt → null */
function pronOf(word) {
  const d = cmu.dict;
  if (!d || !word) return null;
  const w = String(word).toLowerCase();
  let p = d[w];
  if (!p && /'s$/.test(w) && d[w.slice(0, -2)]) p = d[w.slice(0, -2)] + ' Z';
  if (!p && /[^s]s$/.test(w) && d[w.slice(0, -1)]) p = d[w.slice(0, -1)] + ' S'; // maths → math + s
  return p ? p.replace(/\d/g, '').split(' ') : null;
}
// Ähnliche Laute. Bewusst NICHT dabei: e/ä (bed – bad) und i/ie (ship – sheep), das sind echte Wortpaare.
const PH_NEAR = new Set(['DH:D', 'DH:TH', 'DH:Z', 'TH:T', 'TH:F', 'TH:S', 'S:Z', 'EH:EY', 'AH:ER', 'AH:AA', 'AA:AO',
  'UH:UW', 'V:W', 'V:F', 'B:P', 'D:T', 'G:K', 'ER:R', 'OW:AO'].flatMap((x) => { const [a, b] = x.split(':'); return [`${a}:${b}`, `${b}:${a}`]; }));
const PH_LIGHT = new Set(['HH', 'S', 'Z', 'R']); // darf fehlen oder dazukommen
/** Abstand zweier Lautfolgen: ähnliche Laute kosten 1, alles andere 2 */
function phDist(a, b) {
  const n = a.length, m = b.length;
  let prev = Array.from({ length: m + 1 }, (_, j) => (j ? prev0(b, j) : 0));
  function prev0(arr, j) { let c = 0; for (let k = 0; k < j; k++) c += PH_LIGHT.has(arr[k]) ? 1 : 2; return c; }
  for (let i = 1; i <= n; i++) {
    const cur = [prev[0] + (PH_LIGHT.has(a[i - 1]) ? 1 : 2)];
    for (let j = 1; j <= m; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : PH_NEAR.has(`${a[i - 1]}:${b[j - 1]}`) ? 1 : 2;
      cur[j] = Math.min(prev[j - 1] + sub, prev[j] + (PH_LIGHT.has(a[i - 1]) ? 1 : 2), cur[j - 1] + (PH_LIGHT.has(b[j - 1]) ? 1 : 2));
    }
    prev = cur;
  }
  return prev[m];
}
/** Ist das Wort schwer zu treffen? Kurz (höchstens 3 Laute), mit th-Laut oder mit stummen Buchstaben */
function hardWord(t) {
  const p = pronOf(t);
  if (!p) return t.length <= 4 || /th/.test(t);
  return p.length <= 3 || p.includes('TH') || p.includes('DH') || t.replace(/[^a-z]/g, '').length >= p.length + 3;
}
const plural = (a, b) => a === b + 's' || a === b + 'es' || b === a + 's' || b === a + 'es';
/** Passt ein gehörtes Wort zum Zielwort? */
function tokenMatch(h, t) {
  if (h === t || plural(h, t)) return true;
  const ph = pronOf(h), pt = pronOf(t);
  if (ph && pt) {
    if (ph.join(' ') === pt.join(' ')) return true; // gleich klingend
    const tail = (x, y) => x.length === y.length + 1 && x.slice(0, -1).join(' ') === y.join(' ') && /^[SZ]$/.test(x[x.length - 1]);
    if (tail(ph, pt) || tail(pt, ph)) return true; // Einzahl/Mehrzahl (maths – math)
    if (hardWord(t) || pt.length >= 7) return phDist(ph, pt) <= 1;
    return false;
  }
  return (hardWord(t) || t.length >= 8) && lev(h, t) <= 1;
}
const SPEECH_FILLER = new Set(['the', 'a', 'an', 'to', 'uh', 'um', 'er', 'and']);
/** Alle Zielwörter der Reihe nach gesagt? Füllwörter dürfen dazwischen stehen. */
function tokensMatch(heard, target) {
  const H = heard.split(' ').filter(Boolean), T = target.split(' ').filter(Boolean);
  if (!H.length || !T.length) return false;
  if (H.join('') === T.join('')) return true; // „ice cream“ = „icecream“
  const memo = new Map();
  const go = (i, j) => {
    const key = i * 1000 + j;
    if (memo.has(key)) return memo.get(key);
    let ok;
    if (j === T.length) ok = H.slice(i).every((x) => SPEECH_FILLER.has(x));
    else if (i === H.length) ok = false;
    else ok = (tokenMatch(H[i], T[j]) && go(i + 1, j + 1))
      || (i + 1 < H.length && H[i] + H[i + 1] === T[j] && go(i + 2, j + 1)) // „foot ball“ = „football“
      || (SPEECH_FILLER.has(H[i]) && go(i + 1, j));
    memo.set(key, ok);
    return ok;
  };
  return go(0, 0);
}
/** Mögliche Zielsätze: alle Teile von „a / b“ in beliebiger Reihenfolge, Klammer-Varianten */
function speechTargets(word, lang) {
  const alts = answerAlts(word.foreign).map((a) => answerVariants(a).map((v) => normSpeech(ttsText(v), lang)).filter(Boolean));
  const out = new Set();
  for (const perm of permutations(alts)) {
    perm.reduce((acc, forms) => acc.flatMap((pre) => forms.map((f) => (pre ? `${pre} ${f}` : f))), ['']).slice(0, 32).forEach((x) => x && out.add(x));
  }
  return [...out];
}

/**
 * Vergleicht das Erkannte mit dem Zielwort. alternatives.best = { t, conf, final } kommt von listenOnce.
 * Normal zählt nur der wahrscheinlichste erkannte Text; bei schwer zu treffenden Wörtern auch die anderen Vorschläge.
 */
function frSpeechMatch(h, t) {
  if (h === t || h.replace(/ /g, '') === t.replace(/ /g, '')) return true;
  const tol = t.length >= 9 ? 2 : t.length >= 5 ? 1 : 0;
  return tol > 0 && lev(h, t) <= tol;
}
function speechMatch(alternatives, word, lang) {
  const targets = speechTargets(word, lang);
  const best = alternatives.best || { t: alternatives[0] || '', conf: 0, final: false };
  const heard = best.t || alternatives[0] || '';
  if (!normSpeech(heard, lang)) return { ok: false, score: 0, heard: '' };
  if (lang === 'fr') {
    const cands = [heard, ...alternatives].map((x) => normSpeech(x, lang)).filter(Boolean);
    const ok = cands.some((h) => targets.some((t) => frSpeechMatch(h, t)));
    return { ok, score: ok ? 1 : 0, heard };
  }
  const hard = targets.some((t) => t.split(' ').some(hardWord));
  const candidates = [heard, ...(hard ? alternatives : [])].map((x) => normSpeech(x, lang)).filter(Boolean);
  const ok = candidates.some((h) => targets.some((t) => tokensMatch(h, t)));
  return { ok, score: ok ? 1 : 0, heard };
}

/** Text, der vorgelesen wird (Abkürzungen ausgeschrieben) */
function ttsText(text, lang = 'en') {
  if (lang === 'fr') return stripParens(text).replace(/\.{2,}|…/g, ' ').replace(/\s*\/\s*/g, ', ').replace(/\s+[–—-]\s+/g, ', ').replace(/\s+/g, ' ').trim();
  const s = stripParens(text).replace(/\.{2,}|…/g, ' ')
    .replace(/\bsb\.?'s\b/gi, "somebody's").replace(/\bsb\b\.?/gi, 'somebody')
    .replace(/\bsth\b\.?/gi, 'something').replace(/\bsw\b\.?/gi, 'somewhere');
  return s.replace(/\s*\/\s*/g, ', ').replace(/\s+[–—-]\s+/g, ', ').replace(/\s+/g, ' ').trim();
}

/* ---------------- Parser für eingefügte Vokabeln ---------------- */
// Eindeutige Trennzeichen zwischen Wort und Übersetzung
const SEPARATORS = [' = ', '=', ' -> ', '->', ' → ', '→', ' | ', '|'];
// Unsichere Trennzeichen (kommen auch IN einer Vokabel vor: „er ist, sie ist“) – zählen nur, wenn links und rechts verschiedene Sprachen stehen
const WEAK_SEPARATORS = [' : ', ';'];
const DASH_SEPARATORS = [' – ', ' — ', ' - ', ' ‒ '];

/** Liefert [links, rechts, unsicher]: unsicher = Komma, Doppelpunkt, Strichpunkt oder mehrere Leerzeichen */
function splitLine(line) {
  if (line.includes('\t')) {
    const cols = line.split('\t').map((s) => s.trim()).filter(Boolean);
    if (cols.length >= 2) return [cols[0], cols[1]];
    if (cols.length === 1) return [cols[0], ''];
  }
  for (const sep of SEPARATORS) {
    const i = line.indexOf(sep);
    if (i > 0 && i < line.length - sep.length) return [line.slice(0, i), line.slice(i + sep.length)];
  }
  for (const sep of DASH_SEPARATORS) {
    const i = line.lastIndexOf(sep);
    if (i > 0) return [line.slice(0, i), line.slice(i + sep.length)];
  }
  for (const sep of WEAK_SEPARATORS) {
    const i = line.indexOf(sep);
    if (i > 0 && i < line.length - sep.length) return [line.slice(0, i), line.slice(i + sep.length), true];
  }
  const cols = line.split(/\s{2,}/);
  if (cols.length >= 2) return [cols[0], cols.slice(1).join(' '), true];
  if (line.includes(':')) {
    const i = line.indexOf(':');
    if (i > 0 && i < line.length - 1) return [line.slice(0, i), line.slice(i + 1), true];
  }
  const commas = line.split(',');
  if (commas.length === 2) return [commas[0], commas[1], true];
  return [line, ''];
}

const DE_HINT = /\b(der|die|das|ein|eine|sich|und|nicht|mit|von|zu)\b|[äöüß]/i;
const EN_HINT = /\b(the|a|an|to|of|and|is|sb|sth)\b|\b\w+(ing|tion|ous|ly)\b|'s\b/i;

function langScore(text) {
  return { de: (text.match(new RegExp(DE_HINT, 'gi')) || []).length,
    en: (text.match(new RegExp(EN_HINT, 'gi')) || []).length };
}

/* ---------- Ohne Trennzeichen: Wo wechselt die Sprache? ----------
   „the dog der Hund“ (gleiche Zeile) oder „apple“ / „Apfel“ (untereinander). Punkte für typisch Deutsches
   (der/die/das, grosses Nomen, ä/ö/ü/ß, bekannte deutsche Wörter) und typisch Fremdsprachiges. */
const DE_ART_START = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|sich)\s+\S/i;
const FO_ART_START = { en: /^(the|a|an|to)\s+\S/i, fr: /^((le|la|les|un|une|des|du|de la|se)\s+\S|(l|d|s)['’]\S)/i };
function deScore(x) {
  const s = x.trim();
  if (!s) return -5;
  let v = 0;
  if (DE_ART_START.test(s)) v += 3;
  const core0 = stripArticle(s, 'de');
  if (/^[A-ZÄÖÜ]/.test(core0)) v += DE_ART_START.test(s) ? 2 : 1.5;
  if (/[äöüß]/i.test(s)) v += 2;
  v += (s.match(new RegExp(DE_HINT, 'gi')) || []).length * 0.5;
  const low = core0.toLowerCase();
  if (PICTURES.maps.de.has(low) || PICTURES.maps.deExact.has(core0)) v += 2;
  if (/^[a-zäöü]+en$/.test(low) && !/\s/.test(core0)) v += 0.5; // Verben: schwimmen
  return v;
}
function foScore(x, lang) {
  const s = x.trim();
  if (!s) return -5;
  let v = 0;
  if (FO_ART_START.en.test(s) || FO_ART_START.fr.test(s)) v += 3;
  if (/[éèêëàâçîïôûùœ]/i.test(s)) v += 2;
  v += (s.match(new RegExp(EN_HINT, 'gi')) || []).length * 0.5;
  if (PICTURES.maps.en.has(stripArticle(s, 'en').toLowerCase())) v += 2;
  if (/[äöüß]/i.test(s)) v -= 2;
  if (/^[a-zà-ÿ]/.test(s)) v += 0.5;
  return v;
}
/* Jedes Wort stimmt ab: eher deutsch (+) oder eher Fremdsprache (−) */
const DE_WORDS = new Set('der die das den dem des ein eine einen einem einer sich und oder nicht mit von zu im in am auf aus bei für ist sind bin bist war haben hat habe sein mein meine meinen dein deine sein seine ihr ihre unser unsere euer eure ich du er sie es wir man gehen geht machen spielen kein keine sehr viel wie was wer wo wann warum danke bitte ja nein gut gross groß klein'.split(' '));
const FO_WORDS = {
  en: new Set('the a an to of and or not with from in on at for is are am was be have has i you he she it we they my your his her our their me go goes do does play very much how what who where when why thank thanks please yes no good big small'.split(' ')),
  fr: new Set('le la les un une des du de et ou ne pas avec pour dans sur est sont suis es être avoir a ai je tu il elle nous vous ils elles mon ma mes ton ta tes son sa ses notre votre leur aller va faire jouer très beaucoup comment quoi qui où quand pourquoi merci oui non bon bonne grand grande petit petite bonjour salut bonsoir rouge bleu vert jaune noir blanc'.split(' ')),
};
/* Unabhängig vom gewählten Reiter: Deutsch gegen Fremdsprache (Englisch oder Französisch).
   So klappt es auch, wenn französische Wörter im Reiter „Englisch“ eingefügt werden. */
const isFoWord = (low) => FO_WORDS.en.has(low) || FO_WORDS.fr.has(low);
function tokVote(w) {
  const raw = w.replace(/^[«"„“(]+|[»"“”).,!?;:…]+$/g, '');
  const low = raw.toLowerCase();
  if (!low) return 0;
  let v = 0;
  if (DE_WORDS.has(low)) v += 2;
  if (isFoWord(low)) v -= 2;
  if (/[äöüß]/i.test(raw)) v += 2;
  if (/[éèêëàâçîïôûùœ]/i.test(raw)) v -= 2;
  if (/^(l|d|s|j|qu|n|m|t|c)['’]\p{L}/iu.test(raw)) v -= 2; // l'école, j'ai
  if (PICTURES.maps.de.has(low) || PICTURES.maps.deExact.has(raw)) v += 1.5;
  if (PICTURES.maps.en.has(low)) v -= 1.5;
  if (/^[A-ZÄÖÜ][a-zäöüß]/.test(raw)) v += 1; // deutsche Nomen gross
  if (/(ung|heit|keit|lich|chen|isch|ieren)$/.test(low)) v += 1;
  else if (/[a-zäöü]en$/.test(low)) v += 0.5; // essen, schwimmen
  if (/(ing|tion|ly|ous|ness|ful)$/.test(low)) v -= 1;
  // manger, finir, prendre, voir – deutsche Wörter auf -er (Wasser, teuer) nicht: gross geschrieben oder im Bilder-Wörterbuch
  if (/(ir|oir|re)$/.test(low) || (/er$/.test(low) && !/^[A-ZÄÖÜ]/.test(raw) && !PICTURES.maps.de.has(low) && !DE_WORDS.has(low))) v -= 0.6;
  if (/(ment|eau|eux|euse|oire|ette|ais|ait)$/.test(low)) v -= 1;
  return v;
}
/** Welche Fremdsprache steckt in den Wörtern? 'fr', 'en' oder '' (unklar) */
function guessForeignLang(rows) {
  let fr = 0, en = 0;
  for (const r of rows) {
    const s = String(r.foreign || '').trim();
    if (!s) continue;
    if (FO_ART_START.fr.test(s) || /[éèêëàâçîïôûùœ]/i.test(s)) fr++;
    else if (FO_ART_START.en.test(s) || /(ing|tion|ly|ness|ful)\b/i.test(s) || PICTURES.maps.en.has(stripArticle(s, 'en').toLowerCase())) en++;
  }
  const n = rows.length || 1;
  if (fr >= Math.max(2, n * 0.4) && fr > en * 2) return 'fr';
  if (en >= Math.max(2, n * 0.4) && en > fr * 2) return 'en';
  return '';
}
/** Wie deutsch ist eine Zeile? (> 0 deutsch, < 0 Fremdsprache) */
function lineVote(line) {
  return String(line || '').split(/\s+/).filter(Boolean).reduce((sum, w) => sum + tokVote(w), 0);
}
/** Bester Schnitt einer Zeile ohne Trennzeichen: [links, rechts, Punkte].
    Nur wenn links und rechts wirklich verschiedene Sprachen sind (sonst Punkte −∞). */
function bestSplit(line, relaxed = false) {
  const t = line.split(/\s+/).filter(Boolean);
  if (t.length < 2) return [line, '', -Infinity];
  const votes = t.map((w, i) => tokVote(w) - (i === 0 && /^[A-Z]/.test(w) ? 1 : 0)); // Satzanfang gross zählt nicht
  let best = null;
  for (let k = 1; k < t.length; k++) {
    // Ein Artikel gehört zum Wort danach: nie direkt nach „der“, „the“, „la“ … schneiden
    if (/^(der|die|das|den|dem|des|ein|eine|einen|mein|meine|the|a|an|to|my|le|la|les|un|une|du|se|mon|ma|mes)$/i.test(t[k - 1])) continue;
    const L = votes.slice(0, k).reduce((x, y) => x + y, 0), Rv = votes.slice(k).reduce((x, y) => x + y, 0);
    // Deutsch braucht deutliche Hinweise (≥ 1.5): ein grosser Name allein („Nathalie“) reicht nicht
    // relaxed (jede Zeile enthält sicher ein ganzes Paar): jeder Sprachwechsel zählt
    const opposite = relaxed ? (L * Rv < 0 || (L !== Rv && t.length === 2))
      : (L <= -0.5 && Rv >= 1) || (L >= 1 && Rv <= -0.5) || (Math.abs(L) < 0.5 && Math.abs(Rv) >= 1.5) || (Math.abs(Rv) < 0.5 && Math.abs(L) >= 1.5);
    if (!opposite) continue;
    const startsDe = /^[A-ZÄÖÜ]/.test(t[k]) || DE_ART_START.test(t.slice(k).join(' ')); // Schnitt vor deutschem Nomen/Artikel bevorzugen
    const afterSentence = /[.!?…]["»”]?$/.test(t[k - 1]) ? 3 : 0; // Satzende: danach beginnt die Übersetzung
    const sc = Math.min(Math.abs(L), Math.abs(Rv)) + Math.abs(Rv - L) * 0.25 + (startsDe && Rv > L ? 0.6 : 0) + afterSentence - Math.abs(k - t.length / 2) * 0.05;
    if (!best || sc > best[2]) best = [t.slice(0, k).join(' '), t.slice(k).join(' '), sc, L, Rv];
  }
  return best || [line, '', -Infinity, 0, 0];
}
/** Steht in der Zeile eindeutig beides (Wort und Übersetzung)? */
const strongSplit = (line) => { const r = bestSplit(line); return r[1] && Math.abs(r[3]) >= 1 && Math.abs(r[4]) >= 1; };
/** Untereinander geschrieben? Abwechselnd (Wort, Übersetzung, …) oder spaltenweise (erst alle Wörter, dann alle Übersetzungen).
    Liefert Paare oder null. Die obere/erste gehört immer zur zugehörigen unteren – es wird nichts vermischt. */
function stackedPairs(lines, blocks) {
  const n = lines.length;
  if (blocks.length >= 2 && blocks.every((bl) => bl.length === 2)) return { pairs: blocks.map((bl) => [bl[0], bl[1]]), fit: 1 };
  if (n < 2) return null;
  // Jede Zeile: Deutsch, Fremdsprache oder unklar
  const v = lines.map(lineVote);
  const cls = v.map((x) => (x >= 0.75 ? 'de' : x <= -0.75 ? 'fo' : ''));
  // Passt „untereinander“? Anteil der Zeilen mit klarer Sprache, die nicht schon beide Sprachen enthalten
  const known = cls.filter((c, i) => c && !strongSplit(lines[i])).length;
  // Wechselt die Sprache kaum (höchstens zweimal), ist die Liste spaltenweise kopiert
  const clear = cls.filter(Boolean);
  const switches = clear.filter((c, i) => i && c !== clear[i - 1]).length;
  const columnLike = clear.length >= 4 && switches <= 2;
  // Unklare Zeilen: spaltenweise gehören sie zu ihrer Spalte, abwechselnd bekommen sie die andere Sprache als die Zeile davor
  for (let i = 0; i < n; i++) {
    if (cls[i]) continue;
    let prev = ''; for (let j = i - 1; j >= 0; j--) if (cls[j]) { prev = cls[j]; break; }
    let next = ''; for (let j = i + 1; j < n; j++) if (cls[j]) { next = cls[j]; break; }
    const base = prev || next;
    cls[i] = !base ? (i % 2 ? 'de' : 'fo') : columnLike ? base : (base === 'de' ? 'fo' : 'de');
  }
  // Gleiche Sprache hintereinander = ein Abschnitt (z. B. eine Tabellenzelle mit zwei Zeilen: „er heisst“ / „sie heisst“)
  const segs = [];
  lines.forEach((l, i) => { const last = segs[segs.length - 1]; if (last && last.cls === cls[i]) last.lines.push(l); else segs.push({ cls: cls[i], lines: [l] }); });
  // Spaltenweise kopiert: erst alle Wörter, dann alle Übersetzungen
  if (segs.length === 2 && segs[0].lines.length === segs[1].lines.length && segs[0].lines.length >= 2) {
    return { pairs: segs[0].lines.map((l, k) => [l, segs[1].lines[k]]), fit: known / n };
  }
  // Reihenfolge wechselt von Paar zu Paar (Wort, Übersetzung | Übersetzung, Wort …): fast alle inneren Abschnitte
  // haben genau 2 Zeilen – dann ist es keine Zelle mit 2 Zeilen, sondern streng abwechselnd
  const inner = segs.slice(1, -1);
  const flipping = inner.length >= 2 && inner.filter((sg) => sg.lines.length === 2).length >= inner.length * 0.75;
  // Abschnitte paarweise: Wort + Übersetzung; mehrere Zeilen eines Abschnitts gehören zusammen (Zelle mit 2 Zeilen)
  if (!flipping && segs.every((sg) => sg.lines.length <= 3)) {
    const pairs = [];
    for (let k = 0; k < segs.length; k += 2) pairs.push([segs[k].lines.join(' / '), segs[k + 1] ? segs[k + 1].lines.join(' / ') : '']);
    return { pairs, fit: known / n };
  }
  // Sonst: streng abwechselnd
  const pairs = [];
  for (let k = 0; k < n; k += 2) pairs.push([lines[k], lines[k + 1] || '']);
  return { pairs, fit: known / n };
}
/** Zeilen ohne Trennzeichen: untereinander (Paare) oder je Zeile geteilt? */
function pairUp(lines, blocks) {
  if (lines.length < 2) return null;
  // Nur wenn fast jede Zeile eindeutig beide Sprachen enthält, sind Wort und Übersetzung auf derselben Zeile.
  // Sonst gilt immer: untereinander – und dann wird keine Zeile auseinandergenommen (sonst verschiebt sich alles).
  const sameLine = lines.filter(strongSplit).length / lines.length;
  if (sameLine < 0.8) {
    const stacked = stackedPairs(lines, blocks);
    if (stacked && stacked.fit >= 0.5) return stacked.pairs;
    // Weniger als die Hälfte der Zeilen enthält beide Sprachen: untereinander, der Reihe nach – nichts teilen
    // (auch bei ungerader Zahl, z. B. wenn eine Übersetzung fehlt)
    if (sameLine < 0.5) {
      if (stacked) return stacked.pairs;
      const out = [];
      for (let i = 0; i < lines.length; i += 2) out.push([lines[i], lines[i + 1] || '']);
      return out;
    }
  }
  // Gleiche Zeile: wo eindeutig die Sprache wechselt; sonst an der wahrscheinlichsten Stelle (jede Zeile ist ein Paar)
  return lines.map((l) => {
    let [x, y, sc] = bestSplit(l);
    if (!(y && sc > -Infinity)) [x, y, sc] = bestSplit(l, true);
    return y && sc > -Infinity ? [x, y] : [l, ''];
  });
}

/** Liefert { rows: [{foreign, german}], germanFirst } */
function parseVocab(text, opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en';
  const clean = (l) => l.replace(/^\s*(?:\d+\s*[.)]|[-•*·▪●◦–])\s+/, '').trim();
  const isJunk = (l) => !l || /^[-–—_=\s]+$/.test(l);
  // Blöcke (durch Leerzeilen getrennt) – „apple / Apfel“ mit Leerzeile dazwischen
  const blocks = String(text || '').split(/\r?\n\s*\r?\n/).map((b) => b.split(/\r?\n/).map(clean).filter((l) => !isJunk(l))).filter((b) => b.length);
  const raw = blocks.flat();
  // Unsichere Trennzeichen nur, wenn links und rechts verschiedene Sprachen stehen – sonst bleibt die Zeile ganz
  const otherLang = (a, b) => { const x = lineVote(a), y = lineVote(b); return x * y < 0 || (Math.abs(x) < 0.5 && Math.abs(y) >= 1.5) || (Math.abs(y) < 0.5 && Math.abs(x) >= 1.5); };
  let rows = raw.map((l) => {
    const [a, b, weak] = splitLine(l);
    if (weak && !otherLang(a, b)) return [l, ''];
    return [a, b].map((x) => String(x || '').trim().replace(/^["„“]|["“”]$/g, ''));
  });
  // Keine Trennzeichen (bei den meisten Zeilen): gleiche Zeile teilen oder Zeilenpaare bilden
  const noSep = rows.filter((r) => r[0] && !r[1]).length;
  if (noSep >= 2 && noSep >= rows.length * 0.6 && noSep === rows.length) {
    // Anordnung von Hand gewählt (Vorschau): abwechselnd, spaltenweise oder auf derselben Zeile
    const lay = opts.layout;
    const forced = lay === 'alt' ? Array.from({ length: Math.ceil(raw.length / 2) }, (_, k) => [raw[2 * k], raw[2 * k + 1] || ''])
      : lay === 'cols' ? Array.from({ length: Math.ceil(raw.length / 2) }, (_, k) => [raw[k], raw[k + Math.ceil(raw.length / 2)] || ''])
        : lay === 'line' ? raw.map((l) => { let [x, y, sc] = bestSplit(l); if (!(y && sc > -Infinity)) [x, y, sc] = bestSplit(l, true); return y && sc > -Infinity ? [x, y] : [l, '']; })
          : null;
    rows = (forced || pairUp(raw, blocks)).map((r) => r.map((s) => s.trim().replace(/^["„“]|["“”]$/g, '')));
  }
  rows = rows.filter((r) => r[0] || r[1]);

  // Zwei Zeilen ohne Übersetzung hintereinander: untereinander geschriebenes Paar („nager“ / „schwimmen“) – nicht teilen
  const merged = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], n = rows[i + 1];
    if (r[0] && !r[1] && n && n[0] && !n[1]) { merged.push([r[0], n[0]]); i++; } else merged.push(r);
  }
  // Nur eine einzelne Zeile ohne Trennzeichen (zwischen Zeilen mit Strich): selbst teilen („die Katze le chat“)
  rows = merged.map((r) => {
    if (r[1] || !/\s/.test((r[0] || '').trim())) return r;
    const [a, b, sc] = bestSplit(r[0]);
    return b && sc >= 1.5 ? [a, b] : r;
  });

  // Welche Seite ist Deutsch? Jede Zeile stimmt einzeln ab; unklare Zeilen folgen der Mehrheit.
  const vote = (x) => String(x || '').split(/\s+/).filter(Boolean).reduce((sum, w) => sum + tokVote(w, lang), 0);
  const diffs = rows.map(([a, b]) => (b ? vote(a) - vote(b) : 0)); // > 0: links Deutsch
  const col0 = { de: 0, en: 0 }, col1 = { de: 0, en: 0 };
  for (const [a, b] of rows) {
    const sa = langScore(a), sb = langScore(b || '');
    for (const k of ['de', 'en']) { col0[k] += sa[k]; col1[k] += sb[k]; }
    const capA = /^[A-ZÄÖÜ]/.test(stripArticle(a, 'de')), capB = /^[A-ZÄÖÜ]/.test(stripArticle(b || '', 'de'));
    if (capB && !capA) col1.de += 0.3;
    if (capA && !capB && b) col0.de += 0.3;
  }
  const total = diffs.reduce((x, y) => x + y, 0);
  let germanFirst = total !== 0 ? total > 0 : (col0.de > col1.de && col1.en >= col0.en);
  if (opts.swap) germanFirst = !germanFirst;

  return {
    rows: rows.map(([a, b], i) => {
      let gf = Math.abs(diffs[i]) >= 1 ? diffs[i] > 0 : germanFirst;
      if (opts.swap && Math.abs(diffs[i]) >= 1) gf = !gf;
      return gf ? { foreign: b || '', german: a } : { foreign: a, german: b || '' };
    }).filter((r) => r.foreign || r.german),
    germanFirst,
  };
}

/* ---------------- Speicher ---------------- */
const MAIN_STORE_KEY = 'vokabelwelt.v1';
let STORE_KEY = MAIN_STORE_KEY; // angemeldetes Kind: eigener Speicherplatz (js/classes.js)
const DEFAULT_SETTINGS = { sound: true, autoSpeak: false, accent: 'gb', voiceSex: 'f', rate: 0.9, micId: '', phonetic: { on: false, passMin: 60 } };
let db = { sets: [], settings: structuredClone(DEFAULT_SETTINGS) };

function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    db = { ...db, ...d, settings: { ...structuredClone(DEFAULT_SETTINGS), ...(d.settings || {}) } };
    ['speechLevel', 'speechLevelChosen', 'minConf', 'azure'].forEach((k) => delete db.settings[k]); // alte Einstellungen aufräumen
    delete db.settings.voice; // frühere Auswahl der Gerätestimme gibt es nicht mehr
    db.settings.sound = true; db.settings.autoSpeak = false; // nicht mehr einstellbar: Klänge immer an, automatisches Vorlesen immer aus
    db.sets = (db.sets || []).filter((s) => s && Array.isArray(s.words));
    db.sets.forEach((s) => {
      s.lang = s.lang === 'fr' ? 'fr' : 'en'; // Englisch oder Französisch
      s.words.forEach((w) => {
        if (w.picStatus === 'pending') w.picStatus = 'stale';
        if (w.pic && w.pic.kind === 'ai') { w.pic = null; w.picStatus = 'stale'; } // KI-Bilder gibt es nicht mehr
        if (w.pic && w.pic.kind === 'photo' && !w.pic.manual) { w.pic = null; w.picStatus = 'stale'; } // keine Fotosuche mehr
      });
      if (s.picStyle === 'ai' || s.picStyle === 'photo') s.picStyle = 'picto';
      // Ältere Portionen: Fotos waren Standard. Jetzt sind Piktogramme Standard (eindeutiger).
      if (!s.picVersion) {
        s.picVersion = 2;
        if (s.picStyle === 'photo' || !s.picStyle) {
          s.picStyle = 'picto';
          s.words.forEach((w) => { if (!(w.pic && w.pic.manual)) w.picStatus = 'stale'; });
        }
      }
    });
  } catch { /* Speicher nicht verfügbar */ }
}
let saveWarned = false;
function saveNow() {
  if (typeof onDbSaved === 'function') onDbSaved(); // angemeldet: auch ins Konto (js/cloud.js)
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
    return true;
  } catch {
    if (!saveWarned) {
      saveWarned = true;
      toast('Speichern hat nicht geklappt. Vielleicht ist der Speicher voll – lösche alte Portionen oder eigene Fotos.', 'bad');
    }
    return false;
  }
}
const saveDB = debounce(saveNow, 250);
const getSet = (id) => db.sets.find((s) => s.id === id);

function newSet({ name, lang, rows, picStyle = 'picto' }) {
  const set = {
    id: uid(), name, lang, picStyle, picVersion: 2, created: Date.now(), updated: Date.now(),
    words: rows.map((r) => ({ id: uid(), foreign: r.foreign, german: r.german, pic: r.pic || null, picStatus: r.pic ? 'done' : 'stale' })),
    progress: {},
  };
  db.sets.unshift(set);
  applyTeacherPrefs(); // angemeldet: Akzent und Punktzahl der Lehrperson
  saveDB();
  return set;
}

/* ---------------- Bilder ---------------- */
const PICTURES = (() => {
  const entries = [];
  const maps = { en: new Map(), de: new Map(), deExact: new Map() };
  for (const line of window.PICTURE_DATA.split('\n')) {
    const parts = line.split('|');
    if (parts.length < 3) continue;
    const [pic, en, de] = parts.map((p) => p.trim());
    const entry = { pic, en: en.split(','), de: de.split(',') };
    entries.push(entry);
    const add = (map, key) => { key = key.trim(); if (key && !map.has(key)) map.set(key, entry); };
    entry.en.forEach((k) => { add(maps.en, k.toLowerCase()); add(maps.en, stripArticle(k.toLowerCase(), 'en')); });
    entry.de.forEach((k) => { add(maps.deExact, k.trim()); add(maps.de, k.toLowerCase()); });
  }
  return { entries, maps };
})();

/* Großer Emoji-Katalog (alle gängigen Emojis, auch Personen und Gefühle) */
const EMOJI_GROUPS = [[0, 'Gesichter'], [1, 'Menschen'], [3, 'Tiere & Natur'], [4, 'Essen'], [5, 'Reisen & Orte'], [6, 'Aktivitäten'], [7, 'Gegenstände'], [8, 'Symbole'], [9, 'Flaggen']];
const EMOJIS = (() => {
  const rows = (window.EMOJI_CATALOG || []).map(([e, g, de, deTags, en, enTags]) => ({
    e, g, de, en,
    words: [de, en, ...String(deTags || '').split(','), ...String(enTags || '').split(',')].map((k) => stripAccents(k.trim().toLowerCase())).filter(Boolean),
  }));
  const byName = new Map();
  rows.forEach((r) => {
    if (r.g === 9) return; // Flaggen nicht automatisch
    [r.de, r.en].forEach((n) => { const k = String(n || '').toLowerCase(); if (k && !byName.has(k)) byName.set(k, r); });
  });
  return { rows, byName };
})();

/** Emojis suchen (Deutsch oder Englisch). Ohne Suchwort: eine Gruppe. */
function searchEmojis(query, group = 0, limit = 400, minScore = 1) {
  const q = stripAccents(String(query || '').trim().toLowerCase());
  if (!q) return EMOJIS.rows.filter((r) => r.g === group).slice(0, limit);
  const hits = [];
  for (const r of EMOJIS.rows) {
    const name = stripAccents(`${r.de} ${r.en}`.toLowerCase());
    const score = r.words[0] === q || r.words[1] === q ? 4 : r.words.includes(q) ? 3 : name.includes(q) ? 2 : r.words.some((w) => w.startsWith(q)) ? 1 : 0;
    if (score >= minScore) hits.push([score, r]);
  }
  return hits.sort((a, b) => b[0] - a[0]).slice(0, limit).map((h) => h[1]);
}

const entryToPic = (entry) => (entry.pic.startsWith('#')
  ? { kind: 'color', src: entry.pic }
  : { kind: 'emoji', src: entry.pic });

function numberPic(keys, lang) {
  const NW = window.NUMBER_WORDS;
  for (const k of keys) {
    const low = k.toLowerCase();
    if (/^\d{1,4}$/.test(low)) return { kind: 'number', src: low };
    for (const l of [lang, 'de']) {
      const idx = (NW[l] || []).indexOf(low);
      if (idx >= 0) return { kind: 'number', src: String(idx) };
      if (NW.tens[l] && NW.tens[l][low]) return { kind: 'number', src: String(NW.tens[l][low]) };
    }
  }
  return null;
}

/** Bild aus dem eingebauten Wörterbuch (Emoji, Farbe, Zahl) – sofort und offline */
function localPicture(word, lang = 'en') {
  const deKeys = lookupKeys(word.german, 'de');
  const foKeys = lookupKeys(word.foreign, lang);
  const num = numberPic([...foKeys, ...deKeys], lang);
  if (num) return num;
  const { maps } = PICTURES;
  for (const k of deKeys) if (maps.deExact.has(k)) return entryToPic(maps.deExact.get(k));
  for (const k of deKeys) if (maps.de.has(k.toLowerCase())) return entryToPic(maps.de.get(k.toLowerCase()));
  if (lang === 'en') for (const k of foKeys) {
    const low = k.toLowerCase();
    if (maps.en.has(low)) return entryToPic(maps.en.get(low));
  }
  // Großer Katalog: nur wenn der Emoji-Name genau dem Wort entspricht
  for (const k of [...deKeys, ...foKeys]) {
    const r = EMOJIS.byName.get(k.toLowerCase());
    if (r) return { kind: 'emoji', src: r.e };
  }
  // Wortfamilie: hilfsbereit → Hilfe, helpful → help
  for (const k of deFamily(core(word.german, 'de'))) {
    if (maps.deExact.has(k)) return entryToPic(maps.deExact.get(k));
  }
  for (const k of lang === 'en' ? enFamily(core(word.foreign, 'en')) : []) {
    if (maps.en.has(k)) return entryToPic(maps.en.get(k));
  }
  return null;
}

function searchPictureEntries(query, limit = 60) {
  const q = stripAccents(query.trim().toLowerCase());
  if (!q) return PICTURES.entries.filter((e) => !e.pic.startsWith('#')).slice(0, limit);
  const hits = [];
  for (const e of PICTURES.entries) {
    const all = [...e.en, ...e.de].map((k) => stripAccents(k.toLowerCase()));
    const score = all.some((k) => k === q) ? 3 : all.some((k) => k.startsWith(q)) ? 2 : all.some((k) => k.includes(q)) ? 1 : 0;
    if (score) hits.push([score, e]);
  }
  return hits.sort((a, b) => b[0] - a[0]).slice(0, limit).map((h) => h[1]);
}

/** Ist das Wort vermutlich ein Nomen? (Deutsch groß geschrieben oder mit Artikel) */
function isNounish(word) {
  const de = stripParens(word.german || '');
  if (de) {
    if (/^(der|die|das|ein|eine)\s/i.test(de)) return true;
    return /^[A-ZÄÖÜ]/.test(stripArticle(de, 'de'));
  }
  return /^(the|a|an)\s/i.test(stripParens(word.foreign || ''));
}

const net = { arasaacDown: false, arasaacBase: 0, clipartDown: false, gsDown: false };

async function fetchJSON(url, timeout = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

/* --- ARASAAC-Piktogramme: eindeutige, einheitlich gezeichnete Bilder (auch für Verben und Gefühle) ---
   Piktogramme: Sergio Palao, ARASAAC (https://arasaac.org), Eigentum der Regierung von Aragón, Lizenz CC BY-NC-SA. */
const ARASAAC_BASES = ['https://api.arasaac.org/v1/pictograms', 'https://api.arasaac.org/api/pictograms'];
const ARASAAC_CREDIT = { text: 'Piktogramm: Sergio Palao, ARASAAC (CC BY-NC-SA)', url: 'https://arasaac.org' };
const arasaacImg = (id, size = 500) => `https://static.arasaac.org/pictograms/${id}/${id}_${size}.png`;
const arasaacCache = new Map();

/** mode: 'bestsearch' (Stichwort passt genau) oder 'search' (ähnliche Stichwörter) */
function arasaacQuery(locale, text, mode = 'bestsearch') {
  text = String(text || '').trim();
  if (!text || net.arasaacDown) return Promise.resolve([]);
  const key = `${locale}|${mode}|${text.toLowerCase()}`;
  if (arasaacCache.has(key)) return arasaacCache.get(key);
  const p = (async () => {
    for (let i = net.arasaacBase; i < ARASAAC_BASES.length; i++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      try {
        const r = await fetch(`${ARASAAC_BASES[i]}/${locale}/${mode}/${encodeURIComponent(text)}`, { signal: ctrl.signal });
        net.arasaacBase = i;
        if (!r.ok) return []; // nichts gefunden
        const data = await r.json();
        return (Array.isArray(data) ? data : []).filter((x) => x && x._id && !x.sex && !x.violence);
      } catch { /* nächste Adresse versuchen */ } finally { clearTimeout(timer); }
    }
    net.arasaacDown = true;
    arasaacCache.delete(key);
    return [];
  })();
  arasaacCache.set(key, p);
  return p;
}

const toPicto = (x) => ({ kind: 'picto', src: arasaacImg(x._id), title: x.keywords?.[0]?.keyword || '', credit: ARASAAC_CREDIT });

/* --- Wortfamilie: Gibt es für ein Wort kein Bild, suchen wir bei verwandten Wörtern anderer Wortarten.
   Beispiel: „hilfsbereit“ → „Hilfe“, „helfen“; „helpful“ → „help“; „Freundschaft“ → „Freund“.
   Die sichersten Verwandten kommen zuerst; gewagtere (Vokalwechsel wie hilf → helf) nur, wenn die nichts finden. */
const DE_SUFFIXES = [
  // [Endung, Art] – adj: Eigenschaft (freundlich), adjnoun: Nomen aus Eigenschaft (Freiheit), noun, verbnoun: Nomen aus Verb (Bewegung, Lehrer)
  ['igkeit', 'adjnoun'], ['schaft', 'noun'], ['bereit', 'adj'], ['freudig', 'adj'], ['würdig', 'adj'], ['ungen', 'verbnoun'],
  ['fähig', 'adj'], ['mäßig', 'adj'], ['reich', 'adj'], ['artig', 'adj'], ['keit', 'adjnoun'], ['heit', 'adjnoun'],
  ['erin', 'verbnoun'], ['chen', 'noun'], ['lein', 'noun'], ['voll', 'adj'], ['haft', 'adj'], ['lich', 'adj'], ['isch', 'adj'],
  ['ung', 'verbnoun'], ['nis', 'verbnoun'], ['los', 'adj'], ['bar', 'adj'], ['sam', 'adj'], ['end', 'adj'], ['ig', 'adj'], ['er', 'verbnoun'],
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function deStrip(x, kinds) {
  for (const [suf, kind] of DE_SUFFIXES) {
    if (kinds && !kinds.includes(kind)) continue;
    if (x.endsWith(suf) && x.length - suf.length >= 3) return { stem: x.slice(0, -suf.length), kind, suf };
  }
  return null;
}

/** Verwandte deutsche Wörter in Gruppen, die sichersten zuerst (ohne das Wort selbst) */
function deFamilyGroups(word) {
  const w = String(word || '').trim();
  if (!w || /\s/.test(w) || w.length < 5) return [];
  const low = w.toLowerCase();
  const stems = [];
  const addStem = (s) => { if (s && s.length >= 3 && !stems.includes(s)) stems.push(s); };
  const first = deStrip(low);
  if (first) {
    addStem(first.stem);
    if (first.suf === 'igkeit') addStem(first.stem + 'ig');
    // Freundlichkeit → freundlich → Freund (nur bei Nomen aus Eigenschaften)
    if (first.kind === 'adjnoun') { const second = deStrip(first.stem, ['adj']); if (second) addStem(second.stem); }
  }
  if (/[a-zäöüß](en|[lr]n)$/.test(low) && w[0] === low[0]) addStem(low.replace(/e?n$/, '')); // Verb → Nomen
  const part = low.match(/^ge(.{3,})t$/); // Partizip: gekocht → kochen
  if (part) addStem(part[1]);
  const forms = (t) => {
    const base = t.replace(/e$/, '');
    const out = [cap(t), /e[lr]$/.test(base) ? base + 'n' : base + 'en', cap(base + 'e'), base + 'e'];
    if (/[^e][lr]$/.test(base)) { const ins = base.slice(0, -1) + 'e' + base.slice(-1); out.push(cap(ins), ins + 'n'); } // hungr → Hunger, hungern
    return out;
  };
  const sure = [], umlaut = [], vowel = [];
  for (const s0 of stems) {
    const s = /[^aeiouäöüs]s$/.test(s0) ? s0.slice(0, -1) : s0; // Fugen-s: hilfs → hilf
    sure.push(...forms(s));
    const plain = s.replace(/äu/g, 'au').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u'); // Läuf → lauf
    if (plain !== s) umlaut.push(...forms(plain));
    if (/^[^aeiouäöü]*i[^aeiouäöü]/.test(s)) vowel.push(...forms(s.replace(/i/, 'e'))); // hilf → helf
    else if (/^[^aeiouäöü]*e[^aeiouäöü]/.test(s)) vowel.push(...forms(s.replace(/e/, 'i')));
  }
  const seen = new Set([w, low]);
  const clean = (list) => list.filter((s) => s.length >= 3 && !seen.has(s) && seen.add(s));
  return [clean(sure), clean(umlaut), clean(vowel)].filter((g) => g.length);
}
const deFamily = (word) => deFamilyGroups(word).flat();

/** Verwandte englische Wörter (helpful → help, happiness → happy, swimmer → swim) */
function enFamily(word) {
  const w = String(word || '').trim().toLowerCase();
  if (!w || /\s/.test(w) || w.length < 5) return [];
  const RULES = [
    ['fulness', ''], ['iness', 'y'], ['iful', 'y'], ['ness', ''], ['ful', ''], ['less', ''], ['ily', 'y'], ['ly', ''],
    ['ship', ''], ['hood', ''], ['dom', ''], ['ment', ''], ['able', ''], ['ible', ''], ['ous', ''], ['ish', ''],
    ['ation', 'ate'], ['tion', 'te'], ['ing', ''], ['er', ''], ['or', ''], ['ist', ''], ['y', ''],
  ];
  const rule = RULES.find(([suf]) => w.endsWith(suf) && w.length - suf.length >= 3);
  if (!rule) return [];
  const s = w.slice(0, -rule[0].length) + rule[1];
  const out = [s];
  if (/([^aeiou])\1$/.test(s)) out.unshift(s.slice(0, -1)); // swimm → swim, sunn → sun
  if (/[^aeiou][lr]$/.test(s)) out.push(s.slice(0, -1) + 'e' + s.slice(-1)); // hungr → hunger
  if (/(c|v|g|z|[^aeiou]l)$/.test(s)) out.push(s + 'e'); // danc → dance, driv → drive
  return [...new Set(out)].filter((x) => x.length >= 3 && x !== w);
}

/** Piktogramme über die Wortfamilie: [{ x: ARASAAC-Treffer, via: Wort }].
 *  Passt ein Bild auf Deutsch UND Englisch, kommt es zuerst. Gruppe für Gruppe, bis etwas gefunden ist. */
async function pictoFamily(word) {
  const groups = deFamilyGroups(core(word.german, 'de')).map((g) => g.slice(0, 8));
  const enC = enFamily(core(word.foreign, 'en')).slice(0, 4);
  if (!groups.length && !enC.length) return [];
  const look = (locale, terms) => Promise.all(terms.map((t) => arasaacQuery(locale, t, 'bestsearch').then((l) => l.map((x) => ({ x, via: t }))))).then((a) => a.flat());
  const enHits = enC.length ? look('en', enC) : Promise.resolve([]);
  let deHits = [];
  for (const g of groups.length ? groups : [[]]) {
    deHits = await look('de', g);
    if (deHits.length || net.arasaacDown) break;
  }
  const en = await enHits;
  const enIds = new Set(en.map((h) => h.x._id));
  return [...deHits.filter((h) => enIds.has(h.x._id)), ...deHits, ...en];
}

/** Piktogramme für ein Wort. Treffer, die zum deutschen UND zum englischen Wort passen,
 *  kommen zuerst – so wird z. B. bei „bat – Fledermaus“ das Tier gewählt und nicht der Schläger.
 *  Gibt es für das Wort selbst kein Piktogramm, wird in der Wortfamilie gesucht (hilfsbereit → helfen).
 *  Ein Treffer über die Wortfamilie trägt via (das verwandte Wort). */
async function pictoCandidates(word, lang, limit = 8) {
  const de = core(word.german, 'de'), fo = core(word.foreign, lang);
  const variants = (t) => [...new Set([t, stripAccents(t)])].filter(Boolean);
  const gather = async (mode) => {
    const [deL, foL] = await Promise.all([
      Promise.all(variants(de).map((t) => arasaacQuery('de', t, mode))).then((a) => a.flat()),
      Promise.all(variants(fo).map((t) => arasaacQuery(lang, t, mode))).then((a) => a.flat()),
    ]);
    const foIds = new Set(foL.map((x) => x._id));
    return [...deL.filter((x) => foIds.has(x._id)), ...deL, ...foL];
  };
  let list = (await gather('bestsearch')).map((x) => ({ x }));
  if (!list.length && !net.arasaacDown) list = await pictoFamily(word);
  if (list.length < limit && !net.arasaacDown) list = list.concat((await gather('search')).map((x) => ({ x })));
  const seen = new Set();
  return list.filter((h) => (seen.has(h.x._id) ? false : seen.add(h.x._id))).slice(0, limit)
    .map((h) => (h.via ? { ...toPicto(h.x), via: h.via } : toPicto(h.x)));
}

/** Freie Suche im Bild-Dialog */
async function pictoSearch(query) {
  const [a, b] = await Promise.all([arasaacQuery('de', query, 'search'), arasaacQuery('en', query, 'search')]);
  const seen = new Set();
  return [...a, ...b].filter((x) => (seen.has(x._id) ? false : seen.add(x._id))).slice(0, 24).map(toPicto);
}

/* --- Global Symbols: frei nutzbare Symbol-Sammlungen für Unterstützte Kommunikation
   (z. B. Mulberry, Sclera, Tawasol, Blissymbolics) über https://globalsymbols.com --- */
const GS_CREDIT = { text: 'Symbol: Global Symbols', url: 'https://globalsymbols.com' };
const gsCache = new Map();
async function globalSymbolsSearch(query, limit = 12) {
  query = String(query || '').trim();
  if (!query || net.gsDown) return [];
  const key = `${query.toLowerCase()}|${limit}`;
  if (gsCache.has(key)) return gsCache.get(key);
  const p = (async () => {
    const qs = new URLSearchParams({ query, language: 'en', language_iso_format: '639-1', limit: String(Math.max(limit * 2, 20)) });
    try {
      const data = await fetchJSON(`https://globalsymbols.com/api/v1/labels/search/?${qs}`);
      const seen = new Set();
      return (Array.isArray(data) ? data : [])
        .map((l) => ({ src: l?.picto?.image_url, title: l?.text || '', set: l?.picto?.symbolset_id }))
        .filter((x) => x.src && /^https:\/\//.test(x.src) && !/arasaac/i.test(x.src) && (seen.has(x.src) ? false : seen.add(x.src)))
        .slice(0, limit)
        .map((x) => ({ kind: 'picto', src: x.src, title: x.title, credit: GS_CREDIT }));
    } catch (e) {
      if (e instanceof TypeError || e.name === 'AbortError') net.gsDown = true;
      gsCache.delete(key);
      return [];
    }
  })();
  gsCache.set(key, p);
  return p;
}

/* --- Cliparts und Symbole: offene Sammlungen über Iconify (ohne Anmeldung) --- */
const CLIPART_SETS = {
  'fluent-emoji': 'Microsoft Fluent Emoji (MIT)',
  'fluent-emoji-flat': 'Microsoft Fluent Emoji (MIT)',
  noto: 'Google Noto Emoji (Apache 2.0)',
  twemoji: 'Twemoji (CC BY 4.0)',
  openmoji: 'OpenMoji (CC BY-SA 4.0)',
  'fluent-color': 'Microsoft Fluent UI (MIT)',
  'flat-color-icons': 'Flat Color Icons (MIT)',
  'streamline-emojis': 'Streamline Emojis (CC BY 4.0)',
  fxemoji: 'Firefox OS Emoji (CC BY 4.0)',
  emojione: 'EmojiOne (CC BY 4.0)',
  'noto-v1': 'Google Noto Emoji (Apache 2.0)',
};
/* Einfarbige Symbole: klar und ruhig, gut für Verben und Dinge ohne Emoji */
const SYMBOL_SETS = {
  'game-icons': 'Game Icons (CC BY 3.0)',
  healthicons: 'Health Icons (MIT)',
  'material-symbols': 'Google Material Symbols (Apache 2.0)',
  mdi: 'Material Design Icons (Apache 2.0)',
  ph: 'Phosphor (MIT)',
  tabler: 'Tabler Icons (MIT)',
  'fa6-solid': 'Font Awesome (CC BY 4.0)',
  lucide: 'Lucide (ISC)',
  'emojione-monotone': 'EmojiOne (CC BY 4.0)',
};
const ICON_SETS = { ...CLIPART_SETS, ...SYMBOL_SETS };
const clipartCache = new Map();
const iconifyPic = (prefix, name) => ({
  kind: 'clipart', src: `https://api.iconify.design/${prefix}/${name}.svg`, title: name.replace(/-/g, ' '),
  credit: { text: `${SYMBOL_SETS[prefix] ? 'Symbol' : 'Clipart'}: ${ICON_SETS[prefix] || prefix}`, url: `https://icon-sets.iconify.design/${prefix}/${name}/` },
});

/** kind: 'color' (farbige Cliparts) oder 'mono' (einfarbige Symbole) */
async function clipartSearch(query, limit = 24, kind = 'color') {
  query = String(query || '').trim().toLowerCase();
  if (!query || net.clipartDown) return [];
  const key = `${query}|${limit}|${kind}`;
  if (clipartCache.has(key)) return clipartCache.get(key);
  const order = Object.keys(kind === 'mono' ? SYMBOL_SETS : CLIPART_SETS);
  const p = (async () => {
    const qs = new URLSearchParams({ query, limit: '96', prefixes: order.join(',') });
    try {
      const data = await fetchJSON(`https://api.iconify.design/search?${qs}`);
      const names = (data?.icons || []).map(String).filter((n) => order.includes(n.split(':')[0]));
      // Relevanz behalten, aber die schönsten Sammlungen leicht bevorzugen
      const ranked = names.map((n, i) => [i + order.indexOf(n.split(':')[0]) * 2, n]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      return ranked.slice(0, limit).map((n) => iconifyPic(...n.split(':')));
    } catch (e) {
      if (e instanceof TypeError || e.name === 'AbortError') net.clipartDown = true;
      clipartCache.delete(key);
      return [];
    }
  })();
  clipartCache.set(key, p);
  return p;
}

async function clipartCandidates(word, lang, limit = 6, kind = 'color') {
  const term = core(word.foreign, 'en');
  let list = await clipartSearch(term, limit, kind);
  if (!list.length && term.includes(' ')) list = await clipartSearch(term.split(' ').pop(), limit, kind);
  return list;
}

function loadImage(src, timeout = 30000) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; resolve(false); }, timeout);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = src;
  });
}

/* --- automatische Bildwahl ---
   Grundsatz: lieber kein Bild als ein missverständliches. */
async function autoPicture(word, set) {
  const local = localPicture(word, set.lang);
  if (local && (local.kind === 'color' || local.kind === 'number')) return local;
  const term = set.lang === 'fr' ? '' : core(word.foreign, 'en').toLowerCase();
  // Global Symbols nur, wenn die Beschriftung genau passt (englische Beschriftungen)
  const gsExact = async (t) => (await globalSymbolsSearch(t, 8)).find((x) => x.title.trim().toLowerCase() === t) || null;
  const gs = async () => {
    if (!term) return null;
    const hit = await gsExact(term);
    if (hit) return hit;
    for (const t of enFamily(term).slice(0, 2)) { const h = await gsExact(t); if (h) return { ...h, via: t }; }
    return null;
  };
  const picto = async () => (await pictoCandidates(word, set.lang, 1))[0] || (await gs());
  const style = set.picStyle || 'picto';
  if (style === 'emoji') return local || (await picto());
  if (style === 'clipart') {
    const c = (await clipartCandidates(word, set.lang, 1))[0];
    if (c) return c;
  }
  return (await picto()) || local;
}

const picJobs = new Map(); // setId -> {done, total}
async function fillPictures(set, { force = false, onProgress } = {}) {
  const todo = set.words.filter((w) => !(w.pic && w.pic.manual) && (force || !w.pic || w.picStatus !== 'done'));
  if (!todo.length) return;
  const job = { done: 0, total: todo.length };
  picJobs.set(set.id, job);
  todo.forEach((w) => { w.picStatus = 'pending'; });
  onProgress?.();
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const w = todo[i++];
      try {
        const pic = await autoPicture(w, set);
        if (!(w.pic && w.pic.manual)) w.pic = pic || null;
      } catch { /* weiter mit dem nächsten Wort */ }
      w.picStatus = 'done';
      job.done++;
      saveDB();
      onProgress?.(w);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  picJobs.delete(set.id);
  onProgress?.();
}

/* Bilder, die im Browser nicht geladen werden konnten → Ersatzbild */
const brokenPics = new Set();
function effectivePic(word, lang) {
  const p = word.pic;
  if (p && p.kind === 'none') return null;
  if (p && !(p.src && brokenPics.has(p.src))) return p;
  return localPicture(word, lang);
}
const hasPicture = (word, lang) => !!effectivePic(word, lang);

function picHTML(word, lang, cls = '') {
  if (word.picStatus === 'pending' && !(word.pic && word.pic.manual)) {
    return `<span class="pic pic-loading ${cls}" aria-label="Bild wird gesucht"></span>`;
  }
  const p = effectivePic(word, lang);
  if (!p) {
    const letter = esc((core(word.foreign, lang) || '?').charAt(0).toUpperCase());
    return `<span class="pic pic-none ${cls}" aria-hidden="true"><span>${letter}</span></span>`;
  }
  if (p.kind === 'emoji') return `<span class="pic pic-emoji ${cls}" role="img" aria-label="${esc(word.german || word.foreign)}"><span>${esc(p.src)}</span></span>`;
  if (p.kind === 'color') return `<span class="pic pic-color ${cls}" role="img" aria-label="${esc(word.german || word.foreign)}"><span style="--swatch:${esc(p.src)}"></span></span>`;
  if (p.kind === 'number') return `<span class="pic pic-number ${cls}" role="img" aria-label="${esc(p.src)}"><span>${esc(p.src)}</span></span>`;
  return `<span class="pic pic-img${p.kind === 'picto' || p.kind === 'clipart' ? ' pic-picto' : ''} ${cls}"><img src="${esc(p.src)}" alt="${esc(word.german || word.foreign)}" data-wid="${esc(word.id)}" draggable="false" decoding="async"></span>`;
}

document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.wid) return;
  brokenPics.add(img.getAttribute('src'));
  const holder = img.closest('.pic');
  let set = null, word = null;
  for (const s of db.sets) {
    const w = s.words.find((x) => x.id === img.dataset.wid);
    if (w) { set = s; word = w; break; }
  }
  if (holder && word) {
    const cls = [...holder.classList].filter((c) => !c.startsWith('pic-') && c !== 'pic').join(' ');
    holder.outerHTML = picHTML(word, set.lang, cls);
  }
}, true);

function fileToDataURL(file, max = 520) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}

/* ---------------- Audio: Vorlesen + Klänge ----------------
   Englisch liest Kokoro vor (zwei Frauenstimmen: britisch Emma, amerikanisch Heart; js/tts-worker.js).
   Solange Kokoro noch lädt oder auf alten Geräten nicht läuft, springt die Stimme des Geräts ein.
   Deutsch (selten gebraucht) liest immer die Gerätestimme. */
const KOKORO_VOICES = { gb: 'bf_emma', us: 'af_heart', fr: 'ff_siwis' };
const VOICE_NAMES = { bf_emma: 'Emma', bm_george: 'George', af_heart: 'Heart', am_michael: 'Michael', ff_siwis: 'Siwis' };
const tts = { voices: [] };
function refreshVoices() {
  if (!('speechSynthesis' in window)) return;
  tts.voices = speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => { refreshVoices(); const vf = document.getElementById('voice-field'); if (vf && typeof voiceFieldHTML === 'function') vf.innerHTML = voiceFieldHTML(); });
}
const ttsSupported = typeof Worker !== 'undefined' && typeof WebAssembly === 'object' && !!(window.AudioContext || window.webkitAudioContext);
const canSpeak = () => ttsSupported || 'speechSynthesis' in window;

/* Gerätestimmen: Spass-Stimmen von Apple u. a. weglassen, gute Stimmen nach vorne */
const NOVELTY_VOICES = /^(samantha|albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|pipe organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
const GOOD_VOICES = /daniel|kate|serena|arthur|martha|oliver|stephanie|alex|ava|allison|susan|tom|nathan|evan|zoe|joelle|nicky|libby|ryan|sonia|maisie|aria|guy|jenny|emma|brian|andrew|google/i;
function voiceRank(v, want) {
  const l = v.lang.toLowerCase().replace('_', '-');
  let r = l === want ? 10 : 0;
  if (/natural|neural|premium|enhanced|online/i.test(v.name)) r += 6;
  if (GOOD_VOICES.test(v.name)) r += 3;
  if (v.localService) r += 1;
  return r;
}
/** Die Gerätestimmen im gewählten Akzent, die besten zuerst */
function bestDeviceVoices(lang = 'en') {
  const want = (lang === 'de' ? 'de-DE' : langCode(lang)).toLowerCase();
  const base = want.slice(0, 2);
  const all = tts.voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(base) && !NOVELTY_VOICES.test(v.name));
  const exact = all.filter((v) => v.lang.toLowerCase().replace('_', '-') === want);
  return (exact.length ? exact : all).sort((a, b) => voiceRank(b, want) - voiceRank(a, want));
}
/* Frau oder Mann? Browser verraten es nicht – es geht nur über die bekannten Namen. */
const FEMALE_VOICE = /female|woman|google us english$|google français|amélie|amelie|audrey|aurélie|aurelie|marie|julie|hortense|denise|eloise|vivienne|céline|celine|virginie|chantal|sylvie|brigitte|claire|léa|charlotte|kate|serena|stephanie|martha|libby|sonia|maisie|hazel|susan|samantha|ava\b|allison|zoe|nicky|joelle|victoria|aria|jenny|\bana\b|michelle|emma|zira|karen|moira|tessa|fiona|catherine|amy|sara|linda|heather/i;
const MALE_VOICE = /\bmale\b|thomas|henri|nicolas|\bpaul\b|rémy|remy|antoine|jacques|jérôme|jerome|alain|claude|gérard|gerard|daniel|arthur|oliver|ryan|thomas|george|\balex\b|\btom\b|nathan|evan|aaron|\bguy\b|davis|andrew|brian|christopher|eric|roger|steffan|david|mark|james|gordon|\blee\b|rishi|william|noah|tony/i;
function voiceSexOf(v) { return FEMALE_VOICE.test(v.name) ? 'f' : MALE_VOICE.test(v.name) ? 'm' : ''; }
/** Gerätestimme: die beste Frauen- bzw. Männerstimme im gewählten Akzent (sonst die beste überhaupt) */
function deviceVoice(lang) {
  const list = bestDeviceVoices(lang);
  if (lang === 'de') return list[0] || null;
  const want = 'f'; // nur Frauenstimmen
  return list.find((v) => voiceSexOf(v) === want) || list[0] || null;
}
function deviceSpeak(text, lang, slow) {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(lang === 'de' ? stripParens(text) : ttsText(text, lang));
    u.lang = lang === 'de' ? 'de-DE' : langCode(lang);
    const v = deviceVoice(lang);
    if (v) u.voice = v;
    u.rate = slow ? 0.55 : (db.settings.rate || 0.9);
    speechSynthesis.speak(u);
  } catch { /* */ }
}

/* ---------- Audio-Speicher ----------
   Kokoro braucht im Browser 2–5 Sekunden pro Wort. Deshalb wird jedes Wort nur EINMAL erzeugt:
   auf dem Gerät der Lehrperson im Hintergrund, mit beiden Stimmen. Die Tondateien kommen in den
   Supabase-Speicher (Bucket „vokaboom-audio“, Ordner = Konto der Lehrperson) und auf dem Gerät in die
   IndexedDB. In der Portion steht, welche Aufnahmen es gibt (set.audio = { o: Konto, h: { Stimme: { Kennung: 1 } } }).
   Kinder-Geräte laden kein Modell: Sie spielen die fertigen Dateien ab; fehlt eine, liest die Gerätestimme. */
const ALL_VOICES = ['bf_emma', 'af_heart', 'ff_siwis'];
const AUDIO_BUCKET = 'vokaboom-audio';
/** Kurze Kennung eines Textes (für Dateinamen) */
function textHash(t) {
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = (Math.imul(b, 33) + c) | 0; }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
const audioPublicURL = (owner, voice, h) => `${cloudUrl()}/storage/v1/object/public/${AUDIO_BUCKET}/${owner}/${voice}/${h}.wav`;

/* Gerätespeicher (IndexedDB) für erzeugte und geladene Aufnahmen */
const idb = { p: null };
function idbOpen() {
  if (!idb.p) {
    idb.p = new Promise((resolve) => {
      try {
        const r = indexedDB.open('vokaboom-audio', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('clips');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
        r.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return idb.p;
}
async function idbGet(k) {
  const d = await idbOpen();
  if (!d) return null;
  return new Promise((resolve) => {
    try { const q = d.transaction('clips').objectStore('clips').get(k); q.onsuccess = () => resolve(q.result || null); q.onerror = () => resolve(null); } catch { resolve(null); }
  });
}
async function idbPut(k, v) {
  const d = await idbOpen();
  if (!d) return;
  try { d.transaction('clips', 'readwrite').objectStore('clips').put(v, k); } catch { /* voll oder privat */ }
}

/** Float32-Audio → WAV (16 Bit, mono) */
function wavBlob(f32, sr) {
  const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

const kokoro = { worker: null, state: 'idle', progress: 0, queue: [], busy: null, seq: 0, playId: 0, listeners: new Set() };
/** Stimme für eine Sprache: Französisch Siwis, Englisch je nach Akzent Emma oder Heart */
const kokoroVoiceFor = (lang) => (lang === 'fr' ? KOKORO_VOICES.fr : KOKORO_VOICES[accentNow()]);
const kokoroVoice = (set = ctxSet()) => kokoroVoiceFor(langOf(set));
function kokoroNotify() { kokoro.listeners.forEach((fn) => { try { fn(); } catch { /* */ } }); }
const kidDevice = () => typeof isKid === 'function' && isKid();
const teacherIn = () => typeof cloud === 'object' && !!cloud.uid;
/** Kokoro nur für angemeldete Lehrpersonen und Kinder mit Klassen-Login; alle anderen hören die beste Gerätestimme. */
/* Wer hört die Vokaboom-Stimmen?
   - angemeldete Lehrperson und Kinder mit Klassen-Login: immer (gespeicherte Aufnahmen)
   - über QR-Code geteilte Portion einer Lehrperson: deren gespeicherte Aufnahmen
   - alle anderen: sobald die Stimmen im Hintergrund geladen sind (Aufnahmen entstehen dann auf dem Gerät) */
const useKokoro = (set) => ttsSupported && !!ttsEl && (kidDevice() || teacherIn() || kokoro.state === 'ready' || !!(set && set.shareId && set.audio?.o));
/** Darf dieses Gerät Aufnahmen selbst erzeugen? Nur angemeldete Lehrperson, nur eigene Portionen. */
const mayGenerate = (set) => ttsSupported && !!ttsEl && !kidDevice() && kokoro.state !== 'failed' && !(set && set.assigned)
  && (teacherIn() ? !(set && set.shareId) : kokoro.state === 'ready');
const ownsAudio = (set) => !!(set && cloud.uid && !set.shareId && !set.assigned);

/** Kokoro im Hintergrund laden (einmal pro Gerät ~90 MB, danach aus dem Speicher des Browsers) */
function kokoroStart() {
  if (!ttsSupported || kidDevice() || kokoro.worker || kokoro.state === 'failed') return;
  bgLoadMark(+1);
  try {
    const v = typeof APP_VERSION === 'string' && APP_VERSION ? `?v=${APP_VERSION}` : '';
    kokoro.worker = new Worker(`js/tts-worker.js${v}`, { type: 'module' });
  } catch { kokoro.state = 'failed'; kokoroNotify(); return; }
  kokoro.state = 'loading';
  kokoro.worker.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'progress' && m.total) { kokoro.progress = Math.min(0.99, m.loaded / m.total); kokoroNotify(); }
    else if (m.type === 'ready') {
      kokoro.state = 'ready'; kokoro.progress = 1; bgLoadMark(0); kokoroNotify(); kokoroPump();
      const cur = typeof currentSet === 'function' ? currentSet() : null;
      if (cur && !teacherIn()) audioForSet(cur);
      setTimeout(() => kokoro.worker?.postMessage({ type: 'preload-fr' }), 4000); // französische Lautschrift (~6 MB) gleich mitladen
    }
    else if (m.type === 'audio' && kokoro.busy && kokoro.busy.id === m.id) {
      const job = kokoro.busy; kokoro.busy = null;
      const blob = wavBlob(m.audio, m.sr);
      job.done.forEach((d) => d.resolve(blob));
      kokoroPump();
    } else if (m.type === 'error') {
      if (m.id == null) { kokoroFail(); return; }
      if (kokoro.busy && kokoro.busy.id === m.id) { const job = kokoro.busy; kokoro.busy = null; job.done.forEach((d) => d.reject(new Error(m.error))); kokoroPump(); }
    }
  };
  kokoro.worker.onerror = () => kokoroFail();
  kokoro.worker.postMessage({ type: 'load' });
}
/* Laden im Hintergrund: Wird es zweimal nicht fertig (z. B. Seite auf einem alten iPad abgestürzt),
   versucht es dieses Gerät nicht mehr von selbst. */
const BG_KEY = 'vokaboom.voiceLoad';
function bgLoadMark(delta) {
  try {
    if (delta === 0) { localStorage.removeItem(BG_KEY); return; }
    const n = (parseInt(localStorage.getItem(BG_KEY) || '0', 10) || 0) + delta;
    localStorage.setItem(BG_KEY, String(n));
  } catch { /* */ }
}
function voicesInBackground() {
  if (!ttsSupported || kidDevice() || kokoro.worker) return;
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return; // Datensparmodus / langsames Netz
  if (navigator.deviceMemory && navigator.deviceMemory < 3) return;
  let tries = 0;
  try { tries = parseInt(localStorage.getItem(BG_KEY) || '0', 10) || 0; } catch { /* */ }
  if (tries >= 2) return;
  kokoroStart();
}

function kokoroFail() {
  kokoro.state = 'failed';
  try { kokoro.worker?.terminate(); } catch { /* */ }
  kokoro.worker = null;
  [kokoro.busy, ...kokoro.queue].filter(Boolean).forEach((j) => j.done.forEach((d) => d.reject(new Error('tts'))));
  kokoro.busy = null; kokoro.queue = [];
  kokoroNotify();
}
function kokoroPump() {
  if (kokoro.busy || kokoro.state !== 'ready' || !kokoro.queue.length) return;
  const job = kokoro.queue.shift();
  job.id = ++kokoro.seq;
  kokoro.busy = job;
  kokoro.worker.postMessage({ type: 'gen', id: job.id, text: job.text, voice: job.voice, speed: 1 });
}
/** Neue Aufnahme erzeugen (Warteschlange; urgent = vor allen anderen) */
function kokoroGen(text, voice, urgent = false) {
  kokoroStart();
  const key = `${voice}|${text}`;
  return new Promise((resolve, reject) => {
    if (kokoro.state === 'failed') { reject(new Error('tts')); return; }
    let job = kokoro.busy?.key === key ? kokoro.busy : kokoro.queue.find((j) => j.key === key);
    if (!job) { job = { key, text, voice, done: [] }; kokoro.queue.push(job); }
    if (urgent && job !== kokoro.busy) kokoro.queue = [job, ...kokoro.queue.filter((j) => j !== job)];
    job.done.push({ resolve, reject });
    kokoroPump();
  });
}

/* Aufnahmen holen: Arbeitsspeicher → Gerät → Audio-Speicher im Konto → (falls erlaubt) neu erzeugen */
const clipMem = new Map(); // "Stimme|Kennung" → { blob, url }
function memPut(key, blob) {
  if (clipMem.has(key)) return clipMem.get(key);
  const c = { blob, url: URL.createObjectURL(blob) };
  clipMem.set(key, c);
  if (clipMem.size > 500) { const [k, old] = clipMem.entries().next().value; URL.revokeObjectURL(old.url); clipMem.delete(k); }
  return c;
}
/** Wer hat diese Aufnahme gespeichert? (Konto-Ordner im Audio-Speicher) */
function audioOwnerFor(voice, h, set) {
  const list = set ? [set, ...db.sets.filter((s) => s !== set)] : db.sets;
  for (const s of list) {
    const a = s?.audio;
    if (!a?.o) continue;
    if (a.h?.[voice]?.[h]) return a.o;
  }
  // Über QR-Code bekommen: Liste der Aufnahmen fehlt, trotzdem beim Besitzer nachsehen
  if (set?.audio?.o && set.shareId) return set.audio.o;
  return '';
}
const remoteMiss = new Set();
async function fetchRemoteClip(owner, voice, h) {
  const k = `${owner}|${voice}|${h}`;
  if (!cloudConfigured() || remoteMiss.has(k)) return null;
  try {
    const r = await fetch(audioPublicURL(owner, voice, h));
    if (!r.ok) { remoteMiss.add(k); return null; }
    const b = await r.blob();
    return b.size > 100 ? new Blob([b], { type: 'audio/wav' }) : null;
  } catch { return null; }
}
const clipLoading = new Map();
/** Aufnahme suchen, ohne neu zu erzeugen */
function findClip(text, voice, set) {
  const h = textHash(text), key = `${voice}|${h}`;
  if (clipMem.has(key)) return Promise.resolve(clipMem.get(key));
  if (clipLoading.has(key)) return clipLoading.get(key);
  const p = (async () => {
    const local = await idbGet(key);
    if (local) return memPut(key, local);
    const owner = audioOwnerFor(voice, h, set);
    if (owner) {
      const b = await fetchRemoteClip(owner, voice, h);
      if (b) { idbPut(key, b); return memPut(key, b); }
    }
    return null;
  })().finally(() => clipLoading.delete(key));
  clipLoading.set(key, p);
  return p;
}
/** Aufnahme erzeugen und speichern (Gerät + Konto der Lehrperson) */
async function makeClip(text, voice, set, urgent = false) {
  const h = textHash(text), key = `${voice}|${h}`;
  const blob = await kokoroGen(text, voice, urgent);
  idbPut(key, blob);
  const c = memPut(key, blob);
  if (ownsAudio(set)) uploadClip(set, voice, h, blob);
  return c;
}

/* Hochladen in den Audio-Speicher (nur angemeldete Lehrperson, nur in den eigenen Ordner) */
const upload = { queue: [], busy: false, failed: false };
function uploadClip(set, voice, h, blob) {
  if (upload.failed || !cloud.uid) return;
  upload.queue.push({ set, voice, h, blob });
  pumpUpload();
}
async function pumpUpload() {
  if (upload.busy || !upload.queue.length) return;
  upload.busy = true;
  const job = upload.queue.shift();
  try {
    const c = await cloudClient();
    const path = `${cloud.uid}/${job.voice}/${job.h}.wav`;
    const { error } = await c.storage.from(AUDIO_BUCKET).upload(path, job.blob, { contentType: 'audio/wav', upsert: false, cacheControl: '31536000' });
    if (error && !/exist|duplicate|409/i.test(`${error.message} ${error.statusCode || ''} ${error.error || ''}`)) throw error;
    markClip(job.set, job.voice, job.h);
  } catch (e) {
    // Speicher fehlt (SQL noch nicht ausgeführt) oder keine Berechtigung: nicht weiter versuchen
    if (/bucket|not found|row-level|security|unauthor|403|404/i.test(String(e?.message || e))) { upload.failed = true; upload.queue = []; prep.note = 'Der Audio-Speicher ist in Supabase noch nicht eingerichtet: supabase/vokabelwelt.sql nochmals ganz ausführen.'; kokoroNotify(); }
  } finally {
    upload.busy = false;
    pumpUpload();
  }
}
function markClip(set, voice, h) {
  if (!set || !cloud.uid) return;
  if (!set.audio || set.audio.o !== cloud.uid) set.audio = { o: cloud.uid, h: {} };
  (set.audio.h[voice] = set.audio.h[voice] || {})[h] = 1;
  set.updated = Date.now();
  saveDB();
  kokoroNotify();
}

/* Im Hintergrund alle Wörter einer eigenen Portion mit beiden Stimmen vorbereiten */
const prep = { running: new Set(), note: '' };
function setTexts(set) { return [...new Set(set.words.slice(0, 150).map((w) => ttsText(String(w.foreign || ''), langOf(set))).filter(Boolean))]; }
/** Welche Stimmen werden vorbereitet? Lehrperson alle vier (für die Kinder), sonst nur die gewählte. */
const prepVoices = (set) => [kokoroVoice(set)]; // nur die Stimme der Sprache bzw. des gewählten Akzents – spart Daten
function audioCounts(set) {
  const texts = setTexts(set), voices = prepVoices(set);
  const total = texts.length * voices.length;
  let done = 0;
  for (const v of voices) for (const t of texts) if (set.audio?.h?.[v]?.[textHash(t)] || (!ownsAudio(set) && clipMem.has(`${v}|${textHash(t)}`))) done++;
  return { done, total };
}
async function audioPrepare(set) {
  if (!set || !mayGenerate(set) || prep.running.has(set.id)) return;
  prep.running.add(set.id);
  try {
    const texts = setTexts(set);
    const voices = prepVoices(set);
    for (const v of voices) {
      for (const t of texts) {
        if (!getSet(set.id) || kokoro.state === 'failed') return;
        const h = textHash(t);
        if (set.audio?.h?.[v]?.[h] && set.audio.o === cloud.uid) continue; // schon im Konto
        const local = await findClip(t, v, set);
        if (local) { if (ownsAudio(set) && !(set.audio?.o === cloud.uid && set.audio.h?.[v]?.[h])) uploadClip(set, v, h, local.blob); kokoroNotify(); continue; }
        try { await makeClip(t, v, set); } catch { return; }
        kokoroNotify();
      }
    }
  } finally { prep.running.delete(set.id); kokoroNotify(); }
}
/** Aufnahmen der aktuellen Stimme schon laden (Kinder-Geräte und alle anderen), damit sie sofort kommen */
async function audioWarm(set) {
  if (!set || !useKokoro(set)) return;
  const v = kokoroVoice(set);
  const texts = setTexts(set);
  for (let i = 0; i < texts.length; i += 4) await Promise.all(texts.slice(i, i + 4).map((t) => findClip(t, v, set).catch(() => null)));
}
function audioForSet(set) {
  if (!set) return;
  audioWarm(set).then(() => audioPrepare(set));
}

/* Abspielen über ein einziges Audio-Element: Tempo ändern, ohne dass die Stimme höher/tiefer wird */
const ttsEl = typeof Audio === 'function' ? new Audio() : null;
if (ttsEl) { ttsEl.preload = 'auto'; ttsEl.preservesPitch = true; ttsEl.mozPreservesPitch = true; ttsEl.webkitPreservesPitch = true; }
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let ttsUnlocked = false;
/* iPhone/iPad spielen Ton nur, wenn er beim Antippen startet. Beim ersten Antippen werden deshalb das
   Audio-Element und die Gerätestimme einmal „freigeschaltet“; danach dürfen sie auch etwas später spielen. */
function unlockTtsEl() {
  if (ttsUnlocked || !ttsEl) return;
  ttsUnlocked = true;
  try {
    if (ttsEl.paused) {
      ttsEl.muted = true;
      ttsEl.src = SILENT_WAV;
      const p = ttsEl.play();
      if (p) p.then(() => { if (ttsEl.src === SILENT_WAV) ttsEl.pause(); }).catch(() => {}).finally(() => { if (ttsEl.src === SILENT_WAV) ttsEl.muted = false; });
    }
  } catch { /* */ }
  try {
    if ('speechSynthesis' in window && !speechSynthesis.speaking) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
  } catch { /* */ }
}
document.addEventListener('pointerdown', unlockTtsEl, { capture: true });
document.addEventListener('keydown', unlockTtsEl, { capture: true });
function playClipURL(url, rate) {
  if (!ttsEl) return;
  try {
    ttsEl.pause();
    ttsEl.muted = false;
    ttsEl.src = url;
    ttsEl.playbackRate = rate;
    ttsEl.defaultPlaybackRate = rate;
    const p = ttsEl.play();
    if (p) p.catch(() => {});
  } catch { /* */ }
}

function speak(text, lang, { slow = false } = {}) {
  stopSpeaking();
  if (!text) return;
  const set = typeof currentSet === 'function' ? currentSet() : null;
  if (lang === 'de' || !useKokoro(set)) { deviceSpeak(text, lang, slow); return; }
  const t = ttsText(text, lang), voice = kokoroVoiceFor(lang);
  const rate = slow ? 0.7 : Math.min(1.2, Math.max(0.6, db.settings.rate || 0.9));
  const key = `${voice}|${textHash(t)}`;
  const mem = clipMem.get(key);
  if (mem) { playClipURL(mem.url, rate); return; }
  if (!audioOwnerFor(voice, textHash(t), set)) {
    // Keine Aufnahme im Speicher bekannt: sofort die Gerätestimme (noch beim Antippen – wichtig fürs iPhone)
    deviceSpeak(text, lang, slow);
    if (mayGenerate(set)) findClip(t, voice, set).then((c) => c || makeClip(t, voice, set, true)).catch(() => {});
    return;
  }
  const my = kokoro.playId;
  let fellBack = false;
  // Nicht lange warten lassen: Ist die Aufnahme nicht gleich da, liest die Gerätestimme.
  const timer = setTimeout(() => { if (my === kokoro.playId) { fellBack = true; deviceSpeak(text, lang, slow); } }, 1200);
  findClip(t, voice, set).then((c) => {
    if (c) {
      if (my === kokoro.playId && !fellBack) { clearTimeout(timer); playClipURL(c.url, rate); }
      return;
    }
    clearTimeout(timer);
    if (my === kokoro.playId && !fellBack) deviceSpeak(text, lang, slow);
    // Für das nächste Mal erzeugen (nur wo erlaubt)
    if (mayGenerate(set)) makeClip(t, voice, set, true).catch(() => {});
  }).catch(() => { clearTimeout(timer); if (my === kokoro.playId && !fellBack) deviceSpeak(text, lang, slow); });
}
const stopSpeaking = () => {
  kokoro.playId++;
  try { ttsEl?.pause(); } catch { /* */ }
  try { 'speechSynthesis' in window && speechSynthesis.cancel(); } catch { /* */ }
};

let audioCtx;
function tone(freqs, dur = 0.12, type = 'sine', gain = 0.12) {
  if (!db.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + 0.01;
    freqs.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = f;
      const st = t0 + i * dur * 0.85;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(gain, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(st); o.stop(st + dur + 0.03);
    });
  } catch { /* kein Audio */ }
}
const sfx = {
  good: () => tone([660, 990], 0.13, 'triangle', 0.14),
  bad: () => tone([196, 165], 0.16, 'square', 0.045),
  flip: () => tone([540], 0.05, 'sine', 0.05),
  almost: () => tone([523, 587], 0.12, 'triangle', 0.1),
  win: () => tone([523, 659, 784, 1047], 0.15, 'triangle', 0.14),
};

/* ---------------- Spracherkennung ---------------- */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const listening = { rec: null };
const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Chrome, Firefox & Co. auf iPhone/iPad nutzen Apples Technik; Spracherkennung klappt dort zuverlässig nur in Safari.
const isIOSOtherBrowser = isAppleMobile && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(navigator.userAgent);
const bestBrowsers = () => (isAppleMobile ? 'Safari' : 'Chrome, Edge oder Safari');
// Diese Browser haben die Schnittstelle, aber keinen Erkennungsdienst dahinter (Fehler „network“).
const speechBrowserMissing = !!navigator.brave || /OPR\/|Opera/i.test(navigator.userAgent);
const canListen = () => !!SpeechRec && !speechBrowserMissing;

/**
 * Hört einmal zu. Liefert alle erkannten Varianten (auch Zwischenergebnisse – Safari meldet
 * manchmal kein Endergebnis). Hört spätestens nach timeoutMs auf.
 */
function listenOnce(lang, { onStart, onInterim, timeoutMs = 8000, track = null } = {}) {
  return new Promise((resolve, reject) => {
    let rec, timer = null, settled = false;
    let alts = [];
    let best = null; // wahrscheinlichster Text: { t, conf, final }
    const finish = (val, err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (listening.rec === rec) listening.rec = null;
      if (val) val.best = best;
      if (err) reject(err); else resolve(val);
    };
    try { rec = new SpeechRec(); } catch { reject('not-supported'); return; }
    listening.rec = rec;
    rec.lang = langCode(lang);
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 5;
    rec.onaudiostart = () => onStart?.();
    rec.onresult = (e) => {
      const found = [];
      const firsts = [];
      let isFinal = false, conf = 1;
      for (let r = 0; r < e.results.length; r++) {
        const res = e.results[r];
        if (res.isFinal) isFinal = true;
        for (let i = 0; i < res.length; i++) {
          const t = (res[i] && res[i].transcript || '').trim();
          if (t) found.push(t);
          if (i === 0 && t) { firsts.push(t); conf = Math.min(conf, Number(res[i].confidence) || 0); }
        }
      }
      if (firsts.length > 1) found.unshift(firsts.join(' '));
      if (!found.length) return;
      if (firsts.length) best = { t: firsts.join(' '), conf: isFinal ? conf : 0, final: isFinal };
      alts = [...new Set([...found, ...alts])];
      onInterim?.(found[0]);
      if (isFinal) { try { rec.stop(); } catch { /* */ } finish(alts); }
    };
    rec.onerror = (e) => {
      const code = e.error || 'error';
      if (alts.length && (code === 'no-speech' || code === 'aborted')) finish(alts);
      else finish(null, code);
    };
    rec.onend = () => finish(alts);
    timer = setTimeout(() => {
      try { rec.stop(); } catch { /* */ }
      setTimeout(() => finish(alts), 1500);
    }, timeoutMs);
    // Neuere Chrome-Versionen können ein bestimmtes Mikrofon nutzen (start(track)); ältere ignorieren das Argument.
    try { if (track) rec.start(track); else rec.start(); } catch { try { rec.start(); } catch { finish(null, 'busy'); } }
  });
}
function stopListening(abort = false) {
  const r = listening.rec;
  if (!r) return;
  try { abort ? r.abort() : r.stop(); } catch { /* */ }
}

/* ---------- Pegelanzeige: Kommt überhaupt Ton vom Mikrofon an? ---------- */
const isSafari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
const micMeter = { stream: null, ctx: null, raf: 0, peak: 0, level: 0 };
/** Pegel während des Sprechens nur in Chromium-Browsern (Safari würde ein zweites Mal fragen). */
const meterDuringListen = () => !!navigator.mediaDevices?.getUserMedia && !isSafari && !isAppleMobile;

async function startMeter(onLevel, deviceId = '') {
  stopMeter();
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const constraints = { audio: deviceId ? { deviceId: { exact: deviceId } } : true };
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia(constraints); } catch (e) {
    if (deviceId) { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return null; } } else return null;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  try { await ctx.resume(); } catch { /* */ }
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Uint8Array(an.fftSize);
  Object.assign(micMeter, { stream, ctx, peak: 0, level: 0 });
  const tick = () => {
    if (micMeter.stream !== stream) return;
    an.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
    const level = Math.min(1, Math.sqrt(sum / buf.length) * 7);
    micMeter.level = level;
    micMeter.peak = Math.max(micMeter.peak, level);
    onLevel?.(level);
    micMeter.raf = requestAnimationFrame(tick);
  };
  tick();
  return stream;
}
function stopMeter() {
  cancelAnimationFrame(micMeter.raf);
  micMeter.stream?.getTracks().forEach((t) => t.stop());
  try { micMeter.ctx?.close(); } catch { /* */ }
  micMeter.stream = null; micMeter.ctx = null;
}
const MIC_SOUND_PEAK = 0.12; // darüber: es kommt Stimme an

async function listMics() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'audioinput');
  } catch { return []; }
}

/** Was tun, wenn nichts erkannt wurde? Hängt davon ab, ob Ton ankam. */
function silenceHelp(peak) {
  if (peak == null) return '';
  const win = /Windows/i.test(navigator.userAgent), mac = /Macintosh/i.test(navigator.userAgent) && !isAppleMobile;
  if (peak < MIC_SOUND_PEAK) {
    return 'Dein Browser bekommt keinen Ton vom Mikrofon. Ist das richtige Mikrofon gewählt (Einstellungen → Mikrofon testen)? Ist es stummgeschaltet?'
      + (win ? ' Unter Windows: Einstellungen → Datenschutz und Sicherheit → Mikrofon → „Desktop-Apps Zugriff erlauben“ einschalten.' : '')
      + (mac ? ' Am Mac: Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon → deinen Browser einschalten.' : '');
  }
  return `Das Mikrofon hört dich, aber die Spracherkennung liefert keinen Text. Sie braucht Internet und ist in manchen Schulnetzen gesperrt. Probiere ein anderes Netz oder einen anderen Browser (${bestBrowsers()}).`;
}

/** Verständliche Erklärung zu den Fehlercodes der Spracherkennung */
function micErrorText(code, lang) {
  switch (code) {
    case 'not-allowed':
      return isAppleMobile
        ? 'Das Mikrofon ist blockiert. Tippe in der Adresszeile auf „aA“ → Website-Einstellungen → Mikrofon: Erlauben, und lade die Seite neu.'
        : 'Das Mikrofon ist blockiert. Klicke links in der Adresszeile auf das Symbol neben der Adresse, erlaube das Mikrofon und lade die Seite neu.';
    case 'service-not-allowed':
      return isAppleMobile
        ? 'Auf iPad und iPhone muss unter Einstellungen → Allgemein → Tastatur die Diktierfunktion eingeschaltet sein. Danach die Seite neu laden.'
        : `Dieser Browser erlaubt hier keine Spracherkennung. Nimm ${bestBrowsers()}.`;
    case 'network':
      return `Der Spracherkennungsdienst des Browsers ist nicht erreichbar. Er braucht Internet und ist in manchen Schulnetzen gesperrt. ${isAppleMobile ? 'Auf iPhone und iPad klappt es am besten in Safari.' : 'Brave, Opera und Vivaldi haben keinen solchen Dienst – nimm Chrome, Edge oder Safari.'}`;
    case 'audio-capture':
      return 'Es wurde kein Mikrofon gefunden. Ist eins angeschlossen und in den Einstellungen des Geräts für den Browser erlaubt?';
    case 'language-not-supported':
      return `Dieser Browser kann ${LANGS[lang]?.name || 'diese Sprache'} nicht erkennen. Nimm ${bestBrowsers()}.`;
    case 'busy':
      return 'Das Mikrofon war noch belegt. Versuch es gleich noch einmal.';
    case 'not-supported':
      return isIOSOtherBrowser ? 'Auf iPhone und iPad klappt die Spracherkennung nur in Safari. Öffne Vokaboom bitte in Safari.' : `Dieser Browser kann keine Sprache erkennen. Nimm ${bestBrowsers()}.`;
    default:
      return isIOSOtherBrowser ? 'Auf iPhone und iPad klappt die Spracherkennung am zuverlässigsten in Safari. Öffne Vokaboom bitte in Safari.' : `Versuch es noch einmal. Wenn es weiter nicht klappt, nimm ${bestBrowsers()}.`;
  }
}

/* ---------------- Teilen per Link ---------------- */
function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
/* Bilder im Link möglichst kurz speichern, damit der QR-Code grob und gut scanbar bleibt:
   p<ARASAAC-Nr>  s<Symbol-Adresse>  c<Sammlung:Name>  e<Emoji>  k<Farbe>  n<Zahl>  x = kein Bild  f<Foto-Adresse>  u<Bild-Adresse> */
function picToCode(p) {
  if (!p) return '';
  if (p.kind === 'none') return 'x';
  const src = String(p.src || '');
  if (p.kind === 'upload' || p.kind === 'drawn' || src.startsWith('data:')) return ''; // zu groß für den Link
  if (p.kind === 'picto') {
    const m = src.match(/pictograms\/(\d+)\/\1_\d+\.png$/);
    if (m) return 'p' + m[1];
    if (/^https:\/\//.test(src)) return 's' + src;
  }
  if (p.kind === 'clipart') { const m = src.match(/api\.iconify\.design\/([^/]+)\/([^/]+)\.svg$/); if (m) return `c${m[1]}:${m[2]}`; }
  if (p.kind === 'emoji') return 'e' + src;
  if (p.kind === 'color') return 'k' + src;
  if (p.kind === 'number') return 'n' + src;
  if (p.kind === 'photo') return 'f' + src;
  if (/^https?:/.test(src)) return 'u' + src;
  return '';
}
function codeToPic(code) {
  const c = String(code || ''), t = c[0], v = c.slice(1);
  if (!c) return null;
  if (c === 'x') return { kind: 'none', src: '', manual: true };
  if (t === 'p' && /^\d+$/.test(v)) return { kind: 'picto', src: arasaacImg(v), credit: ARASAAC_CREDIT, manual: true };
  if (t === 'c' && /^[\w-]+:[\w-]+$/.test(v)) {
    const [prefix, name] = v.split(':');
    return { kind: 'clipart', src: `https://api.iconify.design/${prefix}/${name}.svg`, title: name.replace(/-/g, ' '),
      credit: { text: `Clipart: ${CLIPART_SETS[prefix] || prefix}`, url: `https://icon-sets.iconify.design/${prefix}/${name}/` }, manual: true };
  }
  if (t === 'e' && v) return { kind: 'emoji', src: v, manual: true };
  if (t === 'k' && /^#[0-9a-f]{3,8}$/i.test(v)) return { kind: 'color', src: v, manual: true };
  if (t === 'n' && /^\d{1,5}$/.test(v)) return { kind: 'number', src: v, manual: true };
  if (t === 's' && /^https:\/\//.test(v)) return { kind: 'picto', src: v, credit: GS_CREDIT, manual: true };
  if ((t === 'f' || t === 'u') && /^https:\/\//.test(v)) return { kind: t === 'f' ? 'photo' : 'url', src: v, manual: true };
  return null;
}

/** lite: Bild-Adressen weglassen (die Geräte der Kinder suchen dann selbst) – für einen kürzeren QR-Code */
async function encodeShare(set, { lite = false } = {}) {
  const data = {
    v: 2, n: set.name, l: set.lang, s: set.picStyle,
    ...(set.audio?.o || (typeof cloud === 'object' && cloud.uid && !set.shareId && !set.assigned) ? { o: set.audio?.o || cloud.uid } : {}), // Audio-Speicher der Lehrperson
    ...(set.accent === 'us' ? { a: 'us' } : {}),
    ...(set.passMin && set.passMin !== 60 ? { p: set.passMin } : {}),
    w: set.words.map((w) => {
      let code = picToCode(w.pic);
      if (lite && /^[fus]/.test(code)) code = '';
      return code ? [w.foreign, w.german, code] : [w.foreign, w.german];
    }),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  if ('CompressionStream' in window) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      return 'z' + b64urlEncode(buf);
    } catch { /* unkomprimiert weiter */ }
  }
  return 'j' + b64urlEncode(bytes);
}
async function decodeShare(code) {
  const kind = code[0], bytes = b64urlDecode(code.slice(1));
  let json;
  if (kind === 'z') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    json = await new Response(stream).text();
  } else json = new TextDecoder().decode(bytes);
  const d = JSON.parse(json);
  const v1pic = (r) => (r[2] === 'ai' ? null
    : r[2] === 'none' ? { kind: 'none', src: '', manual: true }
      : r[2] && r[3] ? { kind: String(r[2]), src: String(r[3]), manual: true } : null);
  return {
    name: String(d.n || 'Vokabeln'), lang: d.l === 'fr' ? 'fr' : 'en', picStyle: ['picto', 'clipart', 'emoji'].includes(d.s) ? d.s : 'picto',
    audioOwner: /^[0-9A-Za-z-]{1,64}$/.test(String(d.o || '')) ? String(d.o) : '',
    accent: d.a === 'us' ? 'us' : 'gb',
    passMin: Number(d.p) >= 30 && Number(d.p) <= 90 ? Number(d.p) : 60,
    rows: (d.w || []).map((r) => ({
      foreign: String(r[0] || ''), german: String(r[1] || ''),
      pic: d.v === 2 ? codeToPic(r[2]) : v1pic(r),
    })),
  };
}
async function hashString(s) {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return String(s.length) + s.slice(-12); }
}
