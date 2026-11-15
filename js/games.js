/* Vokaboom – Vokabelspiele (Schritt 2 einer Portion)
 * Memory, Ballon-Platzen, Blitzrunde, Buchstabensalat, Wortsuchsel, Weck nicht den Drachen, Duell zu zweit.
 * Die Lehrperson kann einzelne Spiele pro Portion ausschalten (set.gamesOff). Spiele zählen NICHT für die
 * Auswertung (kein trackWord) – nur der eigene Rekord wird auf dem Gerät gemerkt (set.progress.games).
 */
'use strict';

const GAMES = [
  { id: 'memory', name: 'Memory', art: '🧠', text: 'Finde die Paare – offen oder verdeckt.', min: 2 },
  { id: 'balloon', name: 'Ballon-Platzen', art: '🎈', text: 'Tippe den richtigen Ballon, bevor er wegfliegt.', min: 3 },
  { id: 'blitz', name: 'Blitzrunde', art: '⚡', text: 'Richtig oder falsch geschrieben? Wisch nach rechts oder links!', min: 2 },
  { id: 'scramble', name: 'Buchstabensalat', art: '🔤', text: 'Hör dir das Wort an und leg die Buchstaben in die Felder.', min: 1 },
  { id: 'search', name: 'Wortsuchsel', art: '🔍', text: 'Finde die Wörter im Buchstabengitter.', min: 3 },
  { id: 'rocket', name: 'Weck nicht den Drachen', art: '🐉', text: 'Errate das Wort Buchstabe für Buchstabe. Jeder Fehler weckt den Drachen ein bisschen mehr …', min: 1 },
  { id: 'duel', name: 'Duell zu zweit', art: '⚔️', text: 'Zwei Kinder, ein Gerät: Wer tippt schneller?', min: 4 },
];
const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));
const gamesOn = (set) => GAMES.filter((g) => !(set?.gamesOff || []).includes(g.id));

/* ---------- Hilfen ---------- */
const G = { id: '', timers: [], raf: 0, keys: null, s: {} };
function stopGame() {
  G.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  G.timers = [];
  cancelAnimationFrame(G.raf);
  if (G.keys) { document.removeEventListener('keydown', G.keys); G.keys = null; }
}
const gLater = (fn, ms) => { const t = setTimeout(fn, ms); G.timers.push(t); return t; };
const gEvery = (fn, ms) => { const t = setInterval(fn, ms); G.timers.push(t); return t; };
const gameWords = (set) => set.words.filter((w) => w.foreign && w.foreign.trim());
/** Die Form, die im Spiel vorkommt: erste Variante, ohne Klammern */
const gameForm = (w) => stripParens(answerAlts(w.foreign)[0] || w.foreign).replace(/\s+/g, ' ').trim();
/** Hinweis: Bild, sonst das deutsche Wort */
function gamePrompt(set, w, cls = '') {
  if (hasPicture(w, set.lang)) return `<div class="g-prompt ${cls}">${picHTML(w, set.lang, 'card-pic')}${w.german ? `<span class="g-de" lang="de">${esc(w.german)}</span>` : ''}</div>`;
  return `<div class="g-prompt ${cls}"><span class="g-de big" lang="de">${esc(w.german || '?')}</span></div>`;
}
function gameRecord(set, id, score) {
  const p = set.progress = set.progress || {};
  const g = p.games = p.games || {};
  const prev = g[id]?.best || 0;
  g[id] = { best: Math.max(prev, score), last: score, date: Date.now() };
  saveDB(); // nicht set.updated: zählt nicht als Übung
  return score > prev;
}
function gameShell(title, inner) {
  return `<section class="mode game-mode game-${G.id}">
    <div class="mode-bar"><h1 class="mode-title">${esc(title)}</h1></div>
    <div class="game-area" id="game-area">${inner}</div>
  </section>`;
}
function gameEndHTML(title, line, again = 'game-again') {
  return `<div class="test-card game-end">
    <div class="game-end-art" aria-hidden="true">🏆</div>
    <h2>${title}</h2><p class="lead">${line}</p>
    <div class="row center"><button class="btn primary" data-action="${again}">${icon('shuffle')} Nochmal</button>
      <button class="btn ghost" data-action="games">Anderes Spiel</button></div>
  </div>`;
}

/* ---------- Übersicht ---------- */
function openGames() {
  const set = currentSet();
  if (!set) return;
  go('games');
}
function renderGames() {
  const set = currentSet();
  const n = gameWords(set).length;
  const list = gamesOn(set);
  const best = set.progress?.games || {};
  $('#view').innerHTML = `<section class="mode games-hub">
    <div class="mode-bar"><h1 class="mode-title">Vokabelspiele</h1></div>
    ${list.length ? `<div class="game-grid">${list.map((g) => {
      const ok = n >= g.min;
      return `<button class="game-tile" data-action="game-open" data-game="${g.id}" ${ok ? '' : 'disabled'}>
        <span class="game-art" aria-hidden="true">${g.art}</span>
        <strong>${esc(g.name)}</strong>
        <small>${ok ? esc(g.text) : `Dafür braucht es mindestens ${g.min} Vokabeln.`}</small>
        ${best[g.id]?.best ? `<span class="game-best">Rekord ${best[g.id].best}</span>` : ''}
      </button>`;
    }).join('')}</div>` : '<p class="empty">Für diese Portion sind keine Spiele eingeschaltet.</p>'}
  </section>`;
}
function openGame(id) {
  const set = currentSet();
  if (!set || !GAME_BY_ID[id]) return;
  if (id === 'memory') { startMode('match'); return; }
  stopGame();
  go('game', { game: id });
}
function renderGame() {
  const set = currentSet();
  stopGame();
  G.id = ui.game;
  G.s = {};
  const fn = { balloon: startBalloon, blitz: startBlitz, scramble: startScramble, search: startSearch, rocket: startRocket, duel: startDuel }[ui.game];
  if (!fn) { go('games'); return; }
  fn(set);
}

/* =========================================================
   Blitzrunde: Wort richtig oder falsch geschrieben? 60 Sekunden
   Stufe 1: wischen (rechts = richtig, links = falsch). Stufe 2: Fehlerstelle antippen oder „richtig“ anhaken.
   ========================================================= */
/* Typische Fehler (zuerst die häufigen, wie sie Deutschschweizer Kinder machen), dann seltenere.
   Jede Regel: [Muster, Ersatz] – ersetzt eine Stelle im Wort. */
const TYPO_RULES = {
  en: {
    common: [
      [/([bcdfglmnprstz])\1/g, '$1'],          // Doppelbuchstabe vergessen: dinner → diner
      [/([aeiou])([bdglmnprt])(?=[aeiouy])/g, '$1$2$2'], // Doppelbuchstabe zu viel: later → latter
      [/ie/g, 'ei'], [/ei/g, 'ie'],
      [/^kn/g, 'n'], [/^wr/g, 'r'], [/mb$/g, 'm'], [/^wh/g, 'w'], [/ght/g, 'gt'], [/gh$/g, ''],
      [/sh/g, 'sch'], [/ck/g, 'k'], [/ph/g, 'f'], [/th/g, 't'],
      [/^v/g, 'w'], [/([aeiou])v/g, '$1w'], [/^w(?=[aeiou])/g, 'v'],
      [/ea/g, 'ee'], [/ee/g, 'ea'], [/ou/g, 'ow'], [/ow/g, 'ou'], [/oo/g, 'u'],
      [/y$/g, 'i'], [/ey$/g, 'y'], [/c(?=[aou])/g, 'k'], [/([aeiou])s(?=[aeiou])/g, '$1z'], [/qu/g, 'kw'],
      [/er$/g, 'a'], [/ture$/g, 'tscher'], [/tion$/g, 'shion'], [/e$/g, ''],
    ],
    rare: [[/a/g, 'e'], [/e/g, 'a'], [/i/g, 'e'], [/o/g, 'u'], [/u/g, 'o']],
  },
  fr: {
    common: [
      [/é/g, 'e'], [/é/g, 'è'], [/è/g, 'é'], [/ê/g, 'e'], [/ê/g, 'è'], [/à/g, 'a'], [/â/g, 'a'], [/ç/g, 'c'], [/î/g, 'i'], [/ô/g, 'o'], [/û/g, 'u'],
      [/e(?=[^aeiouéèê\s]*$)/g, 'é'],          // Akzent zu viel
      [/([^aeiouéèê\s])$/g, ''],                 // stumme Endung vergessen: chat → cha
      [/e$/g, ''], [/s$/g, ''], [/([ai])$/g, '$1e'],
      [/eau/g, 'au'], [/eau/g, 'o'], [/au/g, 'o'], [/ou/g, 'u'], [/oi/g, 'oa'], [/ai/g, 'è'], [/ai/g, 'ä'],
      [/an/g, 'en'], [/en/g, 'an'], [/qu/g, 'k'], [/ch/g, 'sch'], [/gn/g, 'nj'], [/ph/g, 'f'], [/ill/g, 'ij'],
      [/([lmnprst])\1/g, '$1'], [/([aeiouéè])([lmnprst])(?=[aeiouée])/g, '$1$2$2'],
      [/c(?=[aou])/g, 'k'], [/g(?=[ei])/g, 'j'], [/x$/g, 's'],
    ],
    rare: [[/a/g, 'e'], [/i/g, 'e'], [/o/g, 'u'], [/u/g, 'ou']],
  },
};
const ARTICLE_START = /^(the |a |an |to |le |la |les |un |une |des |du |se |l['’]|d['’])/i;
/** Welche Stelle ist anders? [Anfang, Ende] im neuen Wort (Anfang = Ende: Buchstabe fehlt dort) */
function diffRange(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return [i, b.length - j];
}
/** Fehler einbauen: { shown, hs, he } (falsche Stelle im gezeigten Wort) oder null */
function misspellPro(word, lang, rareShare = 0.25) {
  const art = (word.match(ARTICLE_START) || [''])[0].length;
  const body = word.slice(art);
  const rules = TYPO_RULES[lang === 'fr' ? 'fr' : 'en'];
  const cands = (list) => {
    const out = [];
    for (const [re, rep] of list) {
      for (const m of body.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
        const r = m[0].replace(new RegExp(re.source, re.flags.replace('g', '')), rep);
        if (r === m[0]) continue;
        const i = m.index;
        const nb = body.slice(0, i) + r + body.slice(i + m[0].length);
        if (!/\p{L}/u.test(nb) || nb.length < 2 || nb === body) continue;
        const [a, b] = diffRange(body, nb); // genau die geänderte Stelle
        out.push({ shown: word.slice(0, art) + nb, hs: art + a, he: art + b });
      }
    }
    return out;
  };
  // seltenere Fehler: zwei Buchstaben vertauschen oder Selbstlaut tauschen
  const rareSwap = () => {
    const out = [];
    for (let i = 0; i < body.length - 1; i++) {
      if (/\p{L}/u.test(body[i]) && /\p{L}/u.test(body[i + 1]) && body[i] !== body[i + 1]) {
        out.push({ shown: word.slice(0, art) + body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2), hs: art + i, he: art + i + 2 });
      }
    }
    return out;
  };
  const ok = (c) => c.shown.toLowerCase() !== word.toLowerCase();
  const common = cands(rules.common).filter(ok);
  const rare = [...cands(rules.rare), ...rareSwap()].filter(ok);
  const pickFrom = Math.random() < rareShare && rare.length ? rare : (common.length ? common : rare);
  return pickFrom.length ? pickFrom[Math.floor(Math.random() * pickFrom.length)] : null;
}
/** Kurzform für andere Spiele: nur der falsche Text */
const misspell = (word, lang) => misspellPro(word, lang)?.shown || null;

function startBlitz(set) {
  G.s.level = G.s.level || 0;
  $('#view').innerHTML = gameShell('Blitzrunde', `<div class="test-card setup choose-card">
    <h2>Welche Stufe?</h2>
    <div class="choose-grid">
      <button class="choose-tile" data-action="blitz-level" data-level="1"><span class="choose-demo big-emoji" aria-hidden="true">👈 👉</span>
        <strong>Stufe 1: Richtig oder falsch?</strong><small>Richtig geschrieben → nach rechts wischen. Falsch geschrieben → nach links.</small></button>
      <button class="choose-tile" data-action="blitz-level" data-level="2"><span class="choose-demo big-emoji" aria-hidden="true">🔍</span>
        <strong>Stufe 2: Wo ist der Fehler?</strong><small>Tippe auf die falsche Stelle im Wort – oder hake „richtig geschrieben“ an.</small></button>
    </div></div>`);
}
function blitzBegin(set, level) {
  const words = gameWords(set).map(gameForm).filter((f) => f.length >= 2 && f.length <= 30);
  Object.assign(G.s, { level, words, queue: [], score: 0, wrong: 0, end: Date.now() + 60000, card: null, busy: false, done: false, hist: [], fresh: 0, streak: 0, pauseAt: 0 });
  $('#view').innerHTML = gameShell('Blitzrunde', `
    <div class="blitz-top"><span class="blitz-score" id="blitz-score">0 Punkte</span><span class="blitz-time-wrap"><span class="blitz-time" id="blitz-time">60</span><span class="blitz-bonus" id="blitz-bonus" aria-live="polite"></span></span></div>
    <div class="progress"><div class="progress-fill" id="blitz-bar" style="width:100%"></div></div>
    <p class="hint center">${level === 1 ? 'Richtig geschrieben → nach <strong>rechts</strong> wischen. Falsch geschrieben → nach <strong>links</strong>.' : 'Tippe auf die <strong>falsche Stelle</strong> im Wort – oder auf <strong>„Richtig geschrieben“</strong>.'}</p>
    <div class="blitz-stage" id="blitz-stage"></div>
    <div class="blitz-buttons ${level === 2 ? 'one' : ''}">
      ${level === 1 ? `<button class="btn big blitz-no" data-action="blitz-answer" data-v="0">${icon('left')} Falsch</button>` : ''}
      <button class="btn big blitz-yes" data-action="blitz-answer" data-v="1">${level === 1 ? `Richtig ${icon('right')}` : `${icon('check')} Richtig geschrieben`}</button>
    </div>`);
  G.keys = (e) => { if (G.s.level === 1 && e.key === 'ArrowLeft') blitzAnswer(false); if (e.key === 'ArrowRight' || (G.s.level === 2 && e.key === 'Enter')) blitzAnswer(true); };
  document.addEventListener('keydown', G.keys);
  gEvery(() => {
    const left = Math.max(0, G.s.end - (G.s.pauseAt || Date.now()));
    const t = $('#blitz-time'), b = $('#blitz-bar');
    if (t) t.textContent = Math.ceil(left / 1000);
    if (b) b.style.width = `${Math.min(100, left / 600).toFixed(1)}%`;
    if (!left && !G.s.busy && !G.s.pauseAt) blitzFinish(set);
  }, 200);
  blitzNext(set);
}
/** Gute Mischung: etwa halb-halb, aber nie mehr als zwei Mal hintereinander gleich */
function blitzNextIsRight() {
  const h = G.s.hist;
  if (h.length >= 2 && h[h.length - 1] === h[h.length - 2]) return !h[h.length - 1];
  const rights = h.filter(Boolean).length;
  const bias = h.length ? 0.5 + (h.length / 2 - rights) * 0.08 : 0.5; // zieht Richtung 50 %
  return Math.random() < Math.min(0.8, Math.max(0.2, bias));
}
function blitzNext(set) {
  const s = G.s;
  if (s.done) return;
  if (s.pauseAt) { s.end += Date.now() - s.pauseAt; s.pauseAt = 0; } // Uhr stand still, solange die Auflösung zu sehen war
  document.activeElement?.blur?.(); // kein Knopf bleibt von der letzten Runde angewählt
  if (Date.now() >= s.end) { blitzFinish(set); return; }
  if (!s.queue.length) s.queue = shuffle(s.words.slice());
  const right = s.queue.pop();
  let wantRight = blitzNextIsRight();
  // Zuerst häufige Fehler, später ab und zu auch seltenere
  const err = wantRight ? null : misspellPro(right, set.lang, s.fresh < 6 ? 0.1 : 0.3);
  if (!err) wantRight = true;
  s.hist.push(wantRight);
  s.fresh++;
  s.card = { right, shown: err ? err.shown : right, ok: wantRight, hs: err?.hs ?? -1, he: err?.he ?? -1 };
  s.busy = false;
  const st = $('#blitz-stage');
  if (!st) return;
  const letters = [...s.card.shown];
  st.innerHTML = `<div class="blitz-card ${s.level === 2 ? 'tap' : ''}" id="blitz-card" lang="${set.lang}">${s.level === 2
    ? letters.map((c, i) => (c === ' ' ? '<span class="bl-gap"> </span>' : `<button class="bl-ch" data-action="blitz-tap" data-i="${i}">${esc(c)}</button>`)).join('')
    : esc(s.card.shown)}</div><div class="blitz-fix" id="blitz-fix"></div>`;
  if (s.level === 1) bindBlitzSwipe();
}
function bindBlitzSwipe() {
  const el = $('#blitz-card');
  if (!el) return;
  let x0 = null, dx = 0;
  el.addEventListener('pointerdown', (e) => { if (G.s.busy) return; x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); });
  el.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    dx = e.clientX - x0;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    el.classList.toggle('tint-yes', dx > 40); el.classList.toggle('tint-no', dx < -40);
  });
  const up = () => {
    if (x0 == null) return;
    x0 = null; el.classList.remove('dragging', 'tint-yes', 'tint-no');
    el.style.transform = '';
    if (Math.abs(dx) > 80) blitzAnswer(dx > 0);
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
/** Auflösung zeigen: richtiges Wort leuchtet grün; falsches Wort: Fehlerstelle rot, darunter das richtige Wort grün */
function blitzShow(good) {
  const s = G.s, c = s.card;
  const el = $('#blitz-card'), fix = $('#blitz-fix');
  if (!el) return;
  if (c.ok) {
    el.innerHTML = esc(c.shown);
    el.className = 'blitz-card shown right';
    if (fix) fix.innerHTML = good ? '' : '<span class="muted">Das war richtig geschrieben.</span>';
  } else {
    const t = c.shown;
    const a = Math.max(0, Math.min(c.hs, t.length)), b = Math.max(a, Math.min(c.he, t.length));
    // Buchstabe fehlt: rote Markierung genau an der Lücke; sonst die falschen Buchstaben rot
    el.innerHTML = b > a ? `${esc(t.slice(0, a))}<mark class="bl-err">${esc(t.slice(a, b))}</mark>${esc(t.slice(b))}`
      : `${esc(t.slice(0, a))}<mark class="bl-err bl-missing" title="Hier fehlt etwas">‸</mark>${esc(t.slice(a))}`;
    el.className = 'blitz-card shown wrongword';
    if (fix) fix.innerHTML = `<span class="bl-correct" lang="${currentSet().lang}">${esc(c.right)}</span>`;
  }
}
const BLITZ_BONUS = 2000; // je 3 richtige Antworten hintereinander: 2 Sekunden mehr
function blitzScore(good) {
  const s = G.s;
  document.activeElement?.blur?.();
  if (good) {
    s.score++; sfx.good();
    s.streak = (s.streak || 0) + 1;
    if (s.streak % 3 === 0) { // 3, 6, 9 … richtig in Folge
      s.end += BLITZ_BONUS;
      const bo = $('#blitz-bonus'); if (bo) { bo.textContent = '3 in Folge: +2 s'; bo.classList.remove('show'); void bo.offsetWidth; bo.classList.add('show'); }
    }
  } else { s.wrong++; s.streak = 0; sfx.bad(); }
  const sc = $('#blitz-score'); if (sc) sc.textContent = `${s.score} ${s.score === 1 ? 'Punkt' : 'Punkte'}`;
  blitzShow(good);
  s.pauseAt = Date.now(); // die Auflösung kostet keine Zeit
  // richtig geschriebenes Wort 2–3 Sekunden zeigen (bei Fehlern etwas länger)
  gLater(() => blitzNext(currentSet()), good ? 2000 : 2800);
}
function blitzAnswer(saysRight) {
  const s = G.s;
  if (!s.card || s.busy || s.done) return;
  s.busy = true;
  blitzScore(saysRight === s.card.ok);
}
/** Stufe 2: Buchstabe angetippt */
function blitzTap(i) {
  const s = G.s;
  if (!s.card || s.busy || s.done) return;
  s.busy = true;
  const c = s.card;
  // Getroffen, wenn die angetippte Stelle im Fehler liegt (bei weggelassenem Buchstaben auch direkt daneben)
  const hit = !c.ok && (c.he > c.hs ? i >= c.hs && i < c.he : i >= c.hs - 1 && i <= c.hs);
  $(`.bl-ch[data-i="${i}"]`)?.classList.add(hit ? 'hit' : 'miss');
  blitzScore(hit);
}
function blitzFinish(set) {
  const s = G.s;
  if (s.done) return;
  s.done = true;
  stopGame();
  const key = s.level === 2 ? 'blitz2' : 'blitz';
  const rec = gameRecord(set, key, s.score);
  sfx.win(); if (rec && s.score) confetti();
  const a = $('#game-area');
  if (a) a.innerHTML = gameEndHTML(rec && s.score ? 'Neuer Rekord!' : 'Zeit um!', `${s.score} richtig, ${s.wrong} daneben. Dein Rekord in Stufe ${s.level}: ${set.progress.games[key].best}.`);
}

/* =========================================================
   Buchstabensalat: Aufnahme anhören, Buchstaben in die Felder legen
   ========================================================= */
const isLetter = (c) => /[\p{L}\p{N}]/u.test(c);
function startScramble(set) {
  const words = shuffle(gameWords(set).filter((w) => { const f = gameForm(w); return f.replace(/[^\p{L}]/gu, '').length >= 2 && f.length <= 24; })).slice(0, 10);
  Object.assign(G.s, { words, i: 0, solved: 0, hints: 0 });
  $('#view').innerHTML = gameShell('Buchstabensalat', '<div id="scr"></div>');
  scrambleWord(set);
}
function scrambleWord(set) {
  const s = G.s;
  const box = $('#scr');
  if (!box) return;
  if (s.i >= s.words.length) {
    const rec = gameRecord(set, 'scramble', s.solved);
    sfx.win(); confetti();
    box.innerHTML = gameEndHTML('Super gemacht!', `${s.solved} von ${s.words.length} Wörtern gelegt${s.hints ? `, ${s.hints} Tipp${s.hints === 1 ? '' : 's'} benutzt` : ''}.${rec ? ' Neuer Rekord!' : ''}`);
    return;
  }
  const w = s.words[s.i];
  const target = [...gameForm(w)];
  const slots = target.map((c) => (isLetter(c) ? { want: c, tile: null } : { fixed: c }));
  let tiles = target.filter(isLetter).map((c, k) => ({ id: k, c, used: false }));
  for (let t = 0; t < 10; t++) { tiles = shuffle(tiles); if (tiles.map((x) => x.c).join('') !== target.filter(isLetter).join('') || tiles.length < 3) break; }
  Object.assign(s, { w, slots, tiles, checked: false });
  box.innerHTML = `<div class="test-card scramble-card">
    <p class="progress-label"><span>Wort ${s.i + 1} von ${s.words.length}</span></p>
    <div class="row center"><button class="btn primary round" data-action="scr-play" aria-label="Wort anhören">${icon('speaker', 'big')}</button>
      <button class="btn ghost small" data-action="scr-play" data-slow="1">${icon('snail')} Langsam</button></div>
    ${w.german ? `<p class="muted center" lang="de">${esc(w.german)}</p>` : ''}
    <div class="scr-slots" id="scr-slots" lang="${set.lang}"></div>
    <div class="scr-tiles" id="scr-tiles" lang="${set.lang}"></div>
    <div class="row center"><button class="btn ghost small" data-action="scr-hint">${icon('sparkle')} Tipp</button>
      <button class="btn ghost small" data-action="scr-skip">Überspringen</button></div>
    <div id="scr-fb" class="feedback" aria-live="polite"></div>
  </div>`;
  scrambleDraw();
}
function scrambleDraw() {
  const s = G.s;
  const sl = $('#scr-slots'), tl = $('#scr-tiles');
  if (!sl || !tl) return;
  sl.innerHTML = s.slots.map((x, k) => (x.fixed != null
    ? `<span class="scr-fixed ${x.fixed === ' ' ? 'gap' : ''}">${x.fixed === ' ' ? '' : esc(x.fixed)}</span>`
    : `<button class="scr-slot ${x.tile ? 'full' : ''} ${x.state || ''}" data-action="scr-slot" data-k="${k}" aria-label="${x.tile ? `Buchstabe ${esc(x.tile.c)} zurücklegen` : 'leeres Feld'}">${x.tile ? esc(x.tile.c) : ''}</button>`)).join('');
  tl.innerHTML = s.tiles.map((t) => `<button class="scr-tile" data-action="scr-tile" data-id="${t.id}" ${t.used ? 'disabled' : ''}>${t.used ? '' : esc(t.c)}</button>`).join('');
  scrambleHyphens();
}
/** Geht ein Wort auf der nächsten Zeile weiter, steht am Zeilenende ein Bindestrich */
function scrambleHyphens() {
  const kids = [...($('#scr-slots')?.children || [])];
  kids.forEach((el) => el.classList.remove('hy'));
  for (let i = 1; i < kids.length; i++) {
    const a = kids[i - 1], b = kids[i];
    if (a.classList.contains('gap') || b.classList.contains('gap')) continue;
    if (b.offsetTop > a.offsetTop + 4) a.classList.add('hy');
  }
}
function scrambleTile(id) {
  const s = G.s;
  const t = s.tiles.find((x) => x.id === id);
  const slot = s.slots.find((x) => x.fixed == null && !x.tile);
  if (!t || t.used || !slot) return;
  t.used = true; slot.tile = t;
  s.slots.forEach((x) => { delete x.state; });
  sfx.flip();
  scrambleDraw();
  if (s.slots.every((x) => x.fixed != null || x.tile)) scrambleCheck();
}
function scrambleSlot(k) {
  const s = G.s;
  const x = s.slots[k];
  if (!x || !x.tile || x.locked) return;
  x.tile.used = false; x.tile = null;
  s.slots.forEach((y) => { delete y.state; });
  scrambleDraw();
}
function scrambleCheck() {
  const s = G.s;
  const ok = s.slots.every((x) => x.fixed != null || x.tile.c === x.want);
  if (ok) {
    s.solved++;
    s.slots.forEach((x) => { if (x.fixed == null) x.state = 'good'; });
    scrambleDraw(); sfx.good();
    const fb = $('#scr-fb'); if (fb) fb.innerHTML = `<div class="banner good">${icon('check')}<div><strong>Richtig!</strong> ${esc(gameForm(s.w))}</div></div>`;
    gLater(() => { s.i++; scrambleWord(currentSet()); }, 1200);
  } else {
    s.slots.forEach((x) => { if (x.fixed == null) x.state = x.tile.c === x.want ? 'good' : 'bad'; });
    scrambleDraw(); sfx.bad();
    const sl = $('#scr-slots'); sl?.classList.remove('shake'); void sl?.offsetWidth; sl?.classList.add('shake');
  }
}
function scrambleHint() {
  const s = G.s;
  const k = s.slots.findIndex((x) => x.fixed == null && (!x.tile || x.tile.c !== x.want));
  if (k < 0) return;
  const slot = s.slots[k];
  if (slot.tile) { slot.tile.used = false; slot.tile = null; }
  // passenden Buchstaben holen (aus dem Vorrat oder aus einem falsch belegten Feld)
  let t = s.tiles.find((x) => !x.used && x.c === slot.want);
  if (!t) {
    const other = s.slots.find((x) => x.tile && x.tile.c === slot.want && x.tile.c !== x.want);
    if (other) { t = other.tile; other.tile = null; t.used = false; }
  }
  if (!t) return;
  t.used = true; slot.tile = t; slot.locked = true; slot.state = 'good';
  s.hints++;
  scrambleDraw();
  if (s.slots.every((x) => x.fixed != null || x.tile)) scrambleCheck();
}

/* =========================================================
   Ballon-Platzen
   Stufe 1: das passende Wort finden. Stufe 2: die richtige Schreibweise finden (die anderen Ballone haben Fehler).
   Tempo: beginnt langsam, jeder Treffer macht schneller, jeder Fehler wieder etwas langsamer.
   ========================================================= */
const BALLOON_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const BALLOON_SLOW = 14, BALLOON_FAST = 4; // Sekunden, bis ein Ballon oben ist
function popSound() { tone([880, 330], 0.07, 'square', 0.06); }
function startBalloon(set) {
  const b = G.s.bcount || 4;
  $('#view').innerHTML = gameShell('Ballon-Platzen', `<div class="test-card setup choose-card">
    <h2>Welche Stufe?</h2>
    <div class="choose-grid">
      <button class="choose-tile" data-action="bl-level" data-level="1"><span class="choose-demo big-emoji" aria-hidden="true">🎈🖼️</span>
        <strong>Stufe 1: Wort finden</strong><small>Tippe den Ballon mit dem passenden Wort an.</small></button>
      <button class="choose-tile" data-action="bl-level" data-level="2"><span class="choose-demo big-emoji" aria-hidden="true">🎈✍️</span>
        <strong>Stufe 2: Richtig geschrieben</strong><small>Nur ein Ballon ist richtig geschrieben – finde ihn!</small></button>
    </div>
    <div class="field center-field"><span class="label">Wie viele Ballone?</span>
      <div class="seg" role="group" aria-label="Anzahl Ballone">${[3, 4, 5].map((n) => `<button class="seg-btn" data-action="bl-count" data-n="${n}" aria-pressed="${b === n}">${n}</button>`).join('')}</div></div>
  </div>`);
}
function balloonBegin(set, level) {
  const words = gameWords(set);
  Object.assign(G.s, { level, words, score: 0, streak: 0, lives: 3, round: 0, hits: 0, dur: BALLOON_SLOW, done: false, bcount: G.s.bcount || 4 });
  $('#view').innerHTML = gameShell('Ballon-Platzen', `
    <div class="balloon-top"><span id="bl-score" class="bl-score">0 Punkte</span><span class="bl-speed" id="bl-speed" title="Tempo">🐢</span><span id="bl-lives" aria-label="Leben">❤️❤️❤️</span></div>
    <div class="balloon-sky" id="bl-sky">
      <div class="bl-word-cloud" id="bl-prompt" aria-live="polite"></div>
      <span class="bl-sun" aria-hidden="true"></span><span class="bl-cloud c1" aria-hidden="true"></span><span class="bl-cloud c2" aria-hidden="true"></span><span class="bl-cloud c3" aria-hidden="true"></span>
      <div class="bl-layer" id="bl-layer"></div>
    </div>`);
  // Spielfeld ganz zeigen: Punkte-Zeile direkt unter die Kopfzeile scrollen
  const top = $('.balloon-top'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  balloonRound(set);
}
function balloonOptions(set, w) {
  const s = G.s, n = s.bcount;
  if (s.level === 2) {
    const right = gameForm(w);
    const seen = new Set([right.toLowerCase(), ...s.words.map((x) => gameForm(x).toLowerCase())]); // keine echten Wörter als Fehler
    const wrong = [];
    for (let t = 0; t < 60 && wrong.length < n - 1; t++) {
      const m = misspellPro(right, set.lang, t > 20 ? 0.5 : 0.2);
      if (m && !seen.has(m.shown.toLowerCase())) { seen.add(m.shown.toLowerCase()); wrong.push(m.shown); }
    }
    return shuffle([{ text: right, ok: true }, ...wrong.map((x) => ({ text: x, ok: false }))]);
  }
  const others = shuffle(s.words.filter((x) => x !== w && gameForm(x).toLowerCase() !== gameForm(w).toLowerCase())).slice(0, n - 1);
  return shuffle([{ text: gameForm(w), ok: true }, ...others.map((x) => ({ text: gameForm(x), ok: false }))]);
}
/** Schriftgrösse nach längstem Wortteil, damit Wörter nicht mitten drin umbrechen */
function balloonFont(t) {
  const L = Math.max(...String(t).split(/\s+/).map((x) => x.length), 1);
  return L <= 5 ? 1 : L <= 7 ? 0.86 : L <= 9 ? 0.72 : L <= 12 ? 0.6 : 0.5;
}
function balloonRound(set) {
  const s = G.s;
  if (s.done) return;
  const layer = $('#bl-layer'), pr = $('#bl-prompt');
  if (!layer || !pr) return;
  const w = shuffle(s.words)[0];
  const opts = balloonOptions(set, w);
  s.cur = { w, settled: false };
  pr.innerHTML = `<span class="bwc-word" lang="de">${esc(w.german || '?')}</span>${s.level === 2 ? '<span class="bwc-hint">Welcher ist richtig geschrieben?</span>' : ''}`;
  pr.classList.remove('in'); void pr.offsetWidth; pr.classList.add('in');
  const lanes = shuffle([...Array(opts.length).keys()]);
  const sp = $('#bl-speed'); if (sp) sp.textContent = s.dur > 8 ? '🐢' : s.dur > 5.5 ? '🐇' : '🚀';
  layer.innerHTML = opts.map((o, k) => {
    const c = BALLOON_COLORS[(s.round * 3 + k) % BALLOON_COLORS.length];
    const drift = (Math.random() * 8 - 4).toFixed(0); // alle steigen etwa gleich schnell
    return `<button class="balloon" data-action="bl-pop" data-ok="${o.ok ? 1 : 0}" lang="${set.lang}"
      style="--lane:${lanes[k]};--lanes:${opts.length};--c:${c};--dur:${s.dur.toFixed(2)}s;--delay:${(Math.random() * 0.25).toFixed(2)}s;--drift:${drift}px">
      <span class="bl-body"><span class="bl-text" style="--fs:${balloonFont(o.text)}">${esc(o.text)}</span></span>
      <svg class="bl-string" viewBox="0 0 20 60" aria-hidden="true"><path d="M10 0 C 2 15, 18 30, 10 45 S 6 58, 10 60" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
    </button>`;
  }).join('');
  const ok = $('.balloon[data-ok="1"]', layer);
  ok?.addEventListener('animationend', (e) => { if (e.animationName === 'bl-rise' && !s.cur.settled && G.s.cur === s.cur) { s.cur.settled = true; balloonMiss(set, true); } });
  s.round++;
}
/** Ballon zerplatzt: Fetzen fliegen, „POP!“ */
function burst(el, good) {
  const sky = $('#bl-sky');
  if (!sky || !el) return;
  const r = el.getBoundingClientRect(), sr = sky.getBoundingClientRect();
  const x = Math.min(sr.width - 75, Math.max(75, r.left - sr.left + r.width / 2)), y = r.top - sr.top + r.height * 0.4; // Schrift nicht abschneiden
  const color = getComputedStyle(el).getPropertyValue('--c') || '#f00';
  const fx = document.createElement('div');
  fx.className = 'bl-burst';
  fx.style.left = `${x}px`; fx.style.top = `${y}px`;
  fx.innerHTML = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2, d = 50 + Math.random() * 40;
    return `<i style="--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d).toFixed(0)}px;--r:${Math.floor(Math.random() * 360)}deg;background:${color}"></i>`;
  }).join('') + `<b class="${good ? '' : 'bad'}">${good ? 'Great!' : 'Oh!'}</b>`;
  sky.appendChild(fx);
  setTimeout(() => fx.remove(), 900);
  el.classList.add('popped');
}
/** Nach dem Treffer: die anderen Ballone düsen davon (von dort, wo sie gerade sind) */
function balloonsZoomOff() {
  $$('.balloon:not(.popped)').forEach((b, i) => {
    const tr = getComputedStyle(b).transform;
    b.style.transform = tr === 'none' ? '' : tr;
    b.style.animation = 'none';
    b.style.setProperty('--zx', `${(i % 2 ? 1 : -1) * (60 + Math.random() * 80)}px`);
    b.style.setProperty('--zr', `${(i % 2 ? 1 : -1) * (15 + Math.random() * 20)}deg`);
    void b.offsetWidth;
    b.classList.add('zoom-off');
  });
}
function balloonPop(el) {
  const s = G.s;
  const set = currentSet();
  if (!s.cur || s.cur.settled || el.classList.contains('popped')) return;
  popSound();
  if (el.dataset.ok === '1') {
    s.cur.settled = true;
    burst(el, true);
    s.streak++;
    s.score += 10 + Math.round((BALLOON_SLOW - s.dur) * 3) + (s.streak >= 3 ? 5 : 0);
    s.hits = (s.hits || 0) + 1;
    if (s.hits % 5 === 0) s.dur = Math.max(BALLOON_FAST, s.dur * 0.85); // erst nach je 5 Treffern schneller
    sfx.good();
    const sc = $('#bl-score'); if (sc) { sc.textContent = `${s.score} Punkte`; sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump'); }
    balloonsZoomOff();
    gLater(() => balloonRound(set), 900);
  } else {
    burst(el, false);
    balloonMiss(set, false);
  }
}
function balloonMiss(set, escaped) {
  const s = G.s;
  s.lives--;
  s.streak = 0;
  s.dur = Math.min(BALLOON_SLOW, s.dur * 1.12); // wieder etwas langsamer
  sfx.bad();
  const lv = $('#bl-lives'); if (lv) lv.textContent = '❤️'.repeat(Math.max(0, s.lives)) + '🤍'.repeat(3 - Math.max(0, s.lives));
  if (s.lives <= 0) {
    s.done = true; if (s.cur) s.cur.settled = true;
    stopGame();
    const key = s.level === 2 ? 'balloon2' : 'balloon';
    const rec = gameRecord(set, key, s.score);
    gLater(() => {
      const a = $('#game-area');
      if (a) a.innerHTML = gameEndHTML(rec && s.score ? 'Neuer Rekord!' : 'Alle Ballone weg!', `${s.score} Punkte. Gesucht war „${esc(gameForm(s.cur.w))}“. Rekord in Stufe ${s.level}: ${set.progress.games[key].best}.`);
      if (rec && s.score) confetti();
    }, 600);
    return;
  }
  if (escaped) gLater(() => balloonRound(set), 500);
}

/* =========================================================
   Weck nicht den Drachen: Buchstaben raten. Jeder falsche Buchstabe weckt den Drachen ein bisschen mehr
   (Auge auf, gähnen, Rauchwölkchen …). Leben werden nirgends angezeigt – nur der Drache zeigt es.
   ========================================================= */
const baseLetter = (c) => stripAccents(c).toLowerCase();
const DRAGON_MAX = 6; // beim 6. Fehler ist der Drache wach
/** Was unter dem Drachen steht – in der Sprache der Portion */
const DRAGON_SAYS = {
  en: { sleep: 'Shh … the dragon is sleeping.', won: 'Phew – he is still sleeping! 😴',
    steps: ['', 'Oh no … one eye opens!', 'He yawns …', 'Little clouds of smoke!', 'Now both eyes are open!', 'He lifts his head – shh!', 'The dragon is awake! 🔥'] },
  fr: { sleep: 'Chut … le dragon dort.', won: 'Ouf – il dort encore ! 😴',
    steps: ['', 'Oh non … un œil s’ouvre !', 'Il bâille …', 'Des petits nuages de fumée !', 'Maintenant, les deux yeux sont ouverts !', 'Il lève la tête – chut !', 'Le dragon est réveillé ! 🔥'] },
};
const dragonSays = (lang) => DRAGON_SAYS[lang] || DRAGON_SAYS.en;
function dragonSVG() {
  return `<svg class="dg-svg" viewBox="-48 0 308 170" aria-hidden="true">
    <defs>
      <radialGradient id="dg-body" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#6EE7B7"/><stop offset="1" stop-color="#059669"/></radialGradient>
      <radialGradient id="dg-head" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#6EE7B7"/><stop offset="1" stop-color="#10B981"/></radialGradient>
    </defs>
    <ellipse cx="135" cy="158" rx="105" ry="9" fill="rgba(30,40,70,.12)"/>
    <!-- Schwanz -->
    <path class="dg-tail" d="M210 140 C 250 140, 252 105, 228 98 C 214 94, 210 110, 222 112" fill="none" stroke="#059669" stroke-width="12" stroke-linecap="round"/>
    <path class="dg-tail" d="M222 112 l 10 -10 l 2 14 z" fill="#F59E0B"/>
    <!-- Rücken-Zacken -->
    <g fill="#F59E0B">
      <path d="M110 98 l 10 -18 l 10 18 z"/><path d="M135 94 l 10 -19 l 10 19 z"/><path d="M160 96 l 10 -17 l 10 17 z"/><path d="M185 104 l 9 -14 l 9 14 z"/>
    </g>
    <!-- Körper -->
    <ellipse cx="155" cy="128" rx="68" ry="34" fill="url(#dg-body)"/>
    <ellipse cx="150" cy="142" rx="50" ry="16" fill="#D1FAE5"/>
    <!-- Flügel -->
    <path d="M140 112 C 155 88, 190 86, 200 100 C 188 100, 182 108, 186 116 C 174 110, 160 114, 140 112 z" fill="#047857" opacity=".85"/>
    <!-- Vorderpfote -->
    <ellipse cx="100" cy="150" rx="18" ry="9" fill="#10B981"/>
    <g fill="#fff"><circle cx="88" cy="152" r="2.4"/><circle cx="95" cy="155" r="2.4"/><circle cx="103" cy="155" r="2.4"/></g>
    <!-- Kopf -->
    <g class="dg-head">
      <path d="M78 92 l -6 -22 l 16 14 z" fill="#F59E0B"/>
      <path d="M98 90 l 2 -24 l 10 20 z" fill="#F59E0B"/>
      <ellipse cx="88" cy="114" rx="36" ry="28" fill="url(#dg-head)"/>
      <ellipse cx="54" cy="124" rx="28" ry="18" fill="#34D399"/>
      <g fill="#065F46"><ellipse cx="38" cy="117" rx="3" ry="2.2"/><ellipse cx="48" cy="114" rx="3" ry="2.2"/></g>
      <ellipse cx="104" cy="122" rx="7" ry="4.5" fill="#FDA4AF" opacity=".55"/>
      <!-- Mund -->
      <path class="dg-mouth-closed" d="M32 132 C 45 138, 58 137, 70 131" fill="none" stroke="#065F46" stroke-width="2.6" stroke-linecap="round"/>
      <g class="dg-mouth-open"><ellipse cx="52" cy="134" rx="15" ry="9" fill="#7F1D1D"/><ellipse cx="52" cy="138" rx="9" ry="4" fill="#FB7185"/><path d="M42 127 l3 5 l3 -5 M58 127 l3 5 l3 -5" fill="#fff"/></g>
      <!-- Augen: zu / halb / offen -->
      <g class="dg-eye e1">
        <path class="closed" d="M84 106 C 90 112, 98 112, 104 106" fill="none" stroke="#065F46" stroke-width="2.8" stroke-linecap="round"/>
        <g class="open"><ellipse cx="94" cy="106" rx="9" ry="10" fill="#fff"/><circle class="pupil" cx="91" cy="107" r="4.6" fill="#1E1B4B"/><circle cx="89.5" cy="105" r="1.5" fill="#fff"/><path class="lid" d="M84 103 C 88 96, 100 96, 104 103 L 104 98 L 84 98 z" fill="#34D399"/></g>
      </g>
      <g class="dg-eye e2">
        <path class="closed" d="M66 102 C 70 106, 76 106, 80 102" fill="none" stroke="#065F46" stroke-width="2.4" stroke-linecap="round"/>
        <g class="open"><ellipse cx="73" cy="102" rx="7" ry="8" fill="#fff"/><circle class="pupil" cx="70.5" cy="103" r="3.8" fill="#1E1B4B"/><circle cx="69.5" cy="101.5" r="1.2" fill="#fff"/></g>
      </g>
      <!-- Rauch aus den Nasenlöchern -->
      <g class="dg-smoke"><circle cx="38" cy="110" r="7"/><circle cx="48" cy="106" r="8"/><circle cx="32" cy="104" r="6"/><circle cx="44" cy="108" r="6"/></g>
      <!-- Feuer -->
      <g class="dg-fire">
        <path d="M42 130 C 22 120, 0 128, -34 116 C -18 128, -30 132, -44 134 C -26 138, -18 142, -36 152 C -12 148, 6 150, 18 146 C 4 156, -8 160, -20 166 C 4 164, 26 156, 44 140 z" fill="#F97316"/>
        <path d="M40 132 C 24 126, 8 132, -14 126 C -4 133, -10 137, -20 140 C -4 142, 6 144, 20 141 C 12 148, 4 152, -4 156 C 14 154, 30 148, 42 138 z" fill="#FACC15"/>
        <path d="M38 134 C 28 131, 18 134, 6 133 C 14 137, 18 139, 26 139 C 30 139, 36 138, 38 136 z" fill="#FEF9C3"/>
      </g>
    </g>
    <!-- Zzz -->
    <g class="dg-zzz" fill="#6366F1" font-family="Bricolage Grotesque, sans-serif" font-weight="800">
      <text x="118" y="70" font-size="18">z</text><text x="134" y="52" font-size="24">z</text><text x="154" y="32" font-size="30">Z</text>
    </g>
  </svg>`;
}
function startRocket(set) {
  const words = shuffle(gameWords(set).filter((w) => /\p{L}/u.test(gameForm(w)) && gameForm(w).length <= 24)).slice(0, 5);
  Object.assign(G.s, { words, i: 0, solved: 0 });
  $('#view').innerHTML = gameShell('Weck nicht den Drachen', '<div id="rk"></div>');
  rocketWord(set);
}
function rocketWord(set) {
  const s = G.s;
  const box = $('#rk');
  if (!box) return;
  if (s.i >= s.words.length) {
    const rec = gameRecord(set, 'dragon', s.solved);
    if (s.solved) { sfx.win(); confetti(); }
    box.innerHTML = gameEndHTML(s.solved === s.words.length ? 'Der Drache hat nichts gemerkt! 😴' : 'Geschafft!',
      `${s.solved} von ${s.words.length} Wörtern gefunden, ohne den Drachen zu wecken.${rec && s.solved ? ' Neuer Rekord!' : ''}`);
    return;
  }
  const w = s.words[s.i];
  const target = gameForm(w);
  const need = new Set([...target].filter((c) => /\p{L}/u.test(c)).map(baseLetter));
  Object.assign(s, { w, target, need, got: new Set(), wrong: new Set(), launched: false, awake: false });
  const keys = 'abcdefghijklmnopqrstuvwxyz'.split('');
  box.innerHTML = `<div class="test-card rocket-card">
    <p class="progress-label"><span>Wort ${s.i + 1} von ${s.words.length}</span><span>${'😴'.repeat(s.solved)}</span></p>
    <div class="dg-stage"><div class="dg s0" id="dg">${dragonSVG()}</div><p class="dg-say" id="dg-say" lang="${set.lang}" aria-live="polite">${esc(dragonSays(set.lang).sleep)}</p></div>
    <p class="muted center small">Welches Wort ist gesucht? Tippe Buchstaben an – aber leise!</p>
    <div class="rk-word" id="rk-word" lang="${set.lang}"></div>
    <div class="rk-keys">${keys.map((k) => `<button class="rk-key" data-action="rk-key" data-k="${k}">${k}</button>`).join('')}</div>
  </div>`;
  if (G.keys) document.removeEventListener('keydown', G.keys);
  G.keys = (e) => { if (/^[a-zA-Z]$/.test(e.key)) rocketGuess(e.key.toLowerCase()); };
  document.addEventListener('keydown', G.keys);
  rocketDraw();
}
function rocketDraw() {
  const s = G.s;
  const wd = $('#rk-word');
  if (!wd) return;
  const end = s.launched || s.awake;
  // Jedes Wort bleibt zusammen (kein Umbruch mitten im Wort)
  const cell = (c) => {
    if (!/\p{L}/u.test(c)) return `<span class="rk-fix">${esc(c)}</span>`;
    const has = s.got.has(baseLetter(c));
    return `<span class="rk-l ${has || end ? 'shown' : ''} ${!has && s.awake ? 'missed' : ''}">${has || end ? esc(c) : ''}</span>`;
  };
  wd.innerHTML = s.target.split(' ').map((part) => `<span class="rk-group">${[...part].map(cell).join('')}</span>`).join('');
  const dg = $('#dg');
  if (dg) dg.className = `dg s${Math.min(DRAGON_MAX, s.wrong.size)}${s.launched ? ' won' : ''}`;
  const stage = dg?.closest('.dg-stage'); if (stage) stage.dataset.s = Math.min(DRAGON_MAX, s.wrong.size);
  $$('.rk-key').forEach((b) => {
    const k = b.dataset.k;
    b.disabled = s.got.has(k) || s.wrong.has(k) || end;
    b.classList.toggle('hit', s.got.has(k)); b.classList.toggle('miss', s.wrong.has(k));
  });
}
function rocketGuess(k) {
  const s = G.s;
  if (!s.need || s.launched || s.awake || s.got.has(k) || s.wrong.has(k)) return;
  const say = $('#dg-say');
  if (s.need.has(k)) { s.got.add(k); sfx.good(); } else {
    s.wrong.add(k);
    tone([140, 100], 0.22, 'sawtooth', 0.05); // Grummeln
    if (say) { say.textContent = dragonSays(currentSet()?.lang).steps[Math.min(DRAGON_MAX, s.wrong.size)]; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop'); }
  }
  const jolt = () => { const dg = $('#dg'); if (dg && !s.need.has(k)) { dg.classList.remove('jolt'); void dg.offsetWidth; dg.classList.add('jolt'); } };
  if (s.wrong.size >= DRAGON_MAX) {
    s.awake = true;
    rocketDraw();
    jolt();
    tone([220, 110, 80], 0.5, 'sawtooth', 0.07); // Brüllen
    gLater(() => { s.i++; rocketWord(currentSet()); }, 3200);
    return;
  }
  rocketDraw();
  jolt();
  if ([...s.need].every((x) => s.got.has(x))) {
    s.launched = true;
    s.solved++;
    rocketDraw();
    if (say) say.textContent = dragonSays(currentSet()?.lang).won;
    sfx.win();
    gLater(() => { s.i++; rocketWord(currentSet()); }, 2400);
  }
}

/* =========================================================
   Wortsuchsel (auch als PDF)
   ========================================================= */
const searchKey = (w) => stripAccents(core(gameForm(w), currentSet()?.lang || 'en')).toUpperCase().replace(/[^A-Z]/g, '');
/** back: Wörter dürfen auch von rechts nach links und von unten nach oben stehen */
function buildWordSearch(words, size, back = false) {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placed = [];
  const dirs = back ? [[0, 1], [1, 0], [0, -1], [-1, 0]] : [[0, 1], [1, 0]];
  for (const w of words) {
    const key = w.key;
    let ok = false;
    for (let t = 0; t < 200 && !ok; t++) {
      const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
      const L = key.length;
      const minR = dr < 0 ? L - 1 : 0, maxR = dr > 0 ? size - L : size - 1;
      const minC = dc < 0 ? L - 1 : 0, maxC = dc > 0 ? size - L : size - 1;
      if (maxR < minR || maxC < minC) break;
      const r0 = minR + Math.floor(Math.random() * (maxR - minR + 1)), c0 = minC + Math.floor(Math.random() * (maxC - minC + 1));
      let fits = true;
      for (let k = 0; k < key.length; k++) { const ch = grid[r0 + dr * k][c0 + dc * k]; if (ch && ch !== key[k]) { fits = false; break; } }
      if (!fits) continue;
      for (let k = 0; k < key.length; k++) grid[r0 + dr * k][c0 + dc * k] = key[k];
      placed.push({ ...w, r: r0, c: c0, dr, dc });
      ok = true;
    }
  }
  const abc = 'ABCDEFGHIJKLMNOPRSTUVWEAIOEN'; // häufige Buchstaben etwas öfter
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!grid[r][c]) grid[r][c] = abc[Math.floor(Math.random() * abc.length)];
  return { grid, placed, size };
}
function startSearch(set) {
  const cand = shuffle(gameWords(set).map((w) => ({ w, key: searchKey(w) })).filter((x) => x.key.length >= 3 && x.key.length <= 11));
  const seen = new Set();
  const words = cand.filter((x) => (seen.has(x.key) ? false : seen.add(x.key))).slice(0, 8).sort((a, b) => b.key.length - a.key.length);
  const size = Math.min(12, Math.max(9, (words[0]?.key.length || 8) + 1));
  const back = !!db.settings.wsBack;
  const puzzle = buildWordSearch(words, size, back);
  Object.assign(G.s, { puzzle, found: new Set(), sel: null });
  $('#view').innerHTML = gameShell('Wortsuchsel', `<div class="search-wrap">
    <div class="ws-grid" id="ws-grid" style="--n:${size}">${puzzle.grid.map((row, r) => row.map((ch, c) => `<span class="ws-cell" data-r="${r}" data-c="${c}">${ch}</span>`).join('')).join('')}</div>
    <div class="ws-side">
      <div class="seg small ws-dir" role="group" aria-label="Richtung der Wörter">
        <button class="seg-btn" data-action="ws-back" data-on="0" aria-pressed="${!back}">→ ↓ Vorwärts</button>
        <button class="seg-btn" data-action="ws-back" data-on="1" aria-pressed="${back}">← ↑ Auch rückwärts</button>
      </div>
      <p class="label">Finde diese Wörter auf ${LANGS[set.lang].name}:</p>
      <ul class="ws-list" id="ws-list">${puzzle.placed.map((p, i) => `<li data-i="${i}"><button class="ws-word" data-action="ws-tip" data-i="${i}" aria-label="Tipp: ${esc(p.w.german || '?')} auf ${LANGS[set.lang].name} zeigen"><span class="ws-de" lang="de">${esc(p.w.german || '?')}</span><span class="ws-fr" lang="${set.lang}">${esc(gameForm(p.w))}</span></button></li>`).join('')}</ul>
      <p class="hint small">Zu schwer? Tippe auf ein deutsches Wort – dann dreht es sich um und zeigt das Wort auf ${LANGS[set.lang].name}.</p>
      <p class="ws-done" id="ws-done"></p>
    </div>
  </div>`);
  bindSearch(set);
}
function wsCells(a, b) {
  if (!a || !b) return [];
  const dr = Math.sign(b.r - a.r), dc = Math.sign(b.c - a.c);
  if (dr && dc) return []; // nur waagrecht oder senkrecht
  const n = Math.max(Math.abs(b.r - a.r), Math.abs(b.c - a.c)) + 1;
  return Array.from({ length: n }, (_, k) => ({ r: a.r + dr * k, c: a.c + dc * k }));
}
function bindSearch(set) {
  const gridEl = $('#ws-grid');
  const cellAt = (x, y) => { const el = document.elementFromPoint(x, y)?.closest?.('.ws-cell'); return el ? { r: +el.dataset.r, c: +el.dataset.c } : null; };
  const mark = (cells) => { $$('.ws-cell.sel', gridEl).forEach((e) => e.classList.remove('sel')); cells.forEach(({ r, c }) => $(`.ws-cell[data-r="${r}"][data-c="${c}"]`, gridEl)?.classList.add('sel')); };
  let start = null, moved = false, last = null;
  gridEl.addEventListener('pointerdown', (e) => {
    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    e.preventDefault();
    if (G.s.tapStart && !(G.s.tapStart.r === c.r && G.s.tapStart.c === c.c)) { const a = G.s.tapStart; G.s.tapStart = null; mark(wsCells(a, c)); wsCheck(set, wsCells(a, c)); return; }
    start = c; last = c; moved = false; mark([c]);
  });
  gridEl.addEventListener('pointermove', (e) => {
    if (!start) return;
    const c = cellAt(e.clientX, e.clientY);
    if (!c || (last && c.r === last.r && c.c === last.c)) return;
    last = c; moved = true; mark(wsCells(start, c));
  });
  const up = () => {
    if (!start) return;
    if (moved) { wsCheck(set, wsCells(start, last)); G.s.tapStart = null; } else { G.s.tapStart = start; }
    start = null;
  };
  gridEl.addEventListener('pointerup', up); gridEl.addEventListener('pointercancel', up);
  gridEl.style.touchAction = 'none';
}
function wsCheck(set, cells) {
  const s = G.s;
  const word = cells.map(({ r, c }) => s.puzzle.grid[r][c]).join('');
  const first = cells[0], lastC = cells[cells.length - 1];
  const rev = [...word].reverse().join('');
  // egal, von welchem Ende aus markiert wurde
  const i = s.puzzle.placed.findIndex((p, k) => !s.found.has(k) && ((p.key === word && p.r === first?.r && p.c === first?.c) || (p.key === rev && p.r === lastC?.r && p.c === lastC?.c)));
  $$('.ws-cell.sel').forEach((e) => e.classList.remove('sel'));
  if (i < 0) { if (cells.length > 1) sfx.flip(); return; }
  s.found.add(i);
  cells.forEach(({ r, c }) => $(`.ws-cell[data-r="${r}"][data-c="${c}"]`)?.classList.add('found', `f${i % 6}`));
  const li = $(`#ws-list li[data-i="${i}"]`);
  if (li) li.classList.add('done', 'flip');
  sfx.good();
  if (s.found.size === s.puzzle.placed.length) {
    gameRecord(set, 'search', s.found.size);
    sfx.win(); confetti();
    gLater(() => { const a = $('#ws-done'); if (a) a.innerHTML = `<strong>Alle Wörter gefunden! 🎉</strong> <button class="btn small primary" data-action="game-again">Neues Gitter</button>`; }, 600);
  }
}
/** Wortsuchsel als PDF: Seite 1 Rätsel, Seite 2 Lösung */
async function searchPDF() {
  const set = currentSet();
  const { puzzle } = G.s;
  if (!set || !puzzle) return;
  const btn = $('#ws-pdf'); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> PDF …'; }
  try {
    try { await document.fonts.load("800 20px 'Bricolage Grotesque'"); await document.fonts.load('500 20px Lexend'); } catch { /* */ }
    const s = 6, W = 210, H = 297;
    const page = (solution) => {
      const cv = document.createElement('canvas'); cv.width = W * s; cv.height = H * s;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#4F46E5'; ctx.font = `800 ${9 * s}px 'Bricolage Grotesque', sans-serif`;
      ctx.fillText(solution ? 'Wortsuchsel – Lösung' : 'Wortsuchsel', 18 * s, 26 * s);
      ctx.fillStyle = '#4A5072'; ctx.font = `500 ${4.2 * s}px Lexend, sans-serif`;
      ctx.fillText(`${set.name} · ${LANGS[set.lang].name}`, 18 * s, 34 * s);
      const n = puzzle.size, cell = Math.min(14, 174 / n), x0 = (W - cell * n) / 2, y0 = 44;
      if (solution) {
        puzzle.placed.forEach((p, i) => {
          ctx.fillStyle = ['#FDE68A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#DDD6FE', '#FED7AA'][i % 6];
          const len = p.key.length;
          ctx.fillRect((x0 + p.c * cell) * s, (y0 + p.r * cell) * s, (p.dc ? cell * len : cell) * s, (p.dr ? cell * len : cell) * s);
        });
      }
      ctx.strokeStyle = '#CDD2E2'; ctx.lineWidth = 0.3 * s;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#161A33';
      ctx.font = `600 ${cell * 0.55 * s}px Lexend, sans-serif`;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        ctx.strokeRect((x0 + c * cell) * s, (y0 + r * cell) * s, cell * s, cell * s);
        ctx.fillText(puzzle.grid[r][c], (x0 + c * cell + cell / 2) * s, (y0 + r * cell + cell / 2) * s);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      let y = y0 + cell * n + 14;
      ctx.fillStyle = '#161A33'; ctx.font = `700 ${5 * s}px Lexend, sans-serif`;
      ctx.fillText(`Finde diese Wörter auf ${LANGS[set.lang].name}:`, 18 * s, y * s);
      y += 9;
      ctx.font = `500 ${4.6 * s}px Lexend, sans-serif`;
      puzzle.placed.forEach((p, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const txt = `${p.w.german || '?'}${solution ? `  →  ${gameForm(p.w)}` : '  →  ____________'}`;
        ctx.fillText(txt, (18 + col * 90) * s, (y + row * 9) * s);
      });
      ctx.fillStyle = '#7A80A0'; ctx.font = `400 ${3.2 * s}px Lexend, sans-serif`;
      ctx.fillText('Erstellt mit Vokaboom', 18 * s, (H - 10) * s);
      const url = cv.toDataURL('image/jpeg', 0.92), bin = atob(url.split(',')[1]);
      const bytes = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      return { jpeg: bytes, w: cv.width, h: cv.height };
    };
    const blob = buildPDF([page(false), page(true)]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Wortsuchsel-${set.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'Vokaboom'}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } catch { toast('Das PDF konnte nicht erstellt werden.', 'bad'); } finally {
    const b = $('#ws-pdf'); if (b) { b.disabled = false; b.innerHTML = `${icon('down')} Als PDF zum Ausdrucken`; }
  }
}

/* =========================================================
   Duell zu zweit: ein Gerät, zwei Hälften (die obere ist gedreht)
   ========================================================= */
function startDuel(set) {
  const words = shuffle(gameWords(set));
  Object.assign(G.s, { words, round: 0, total: Math.min(10, words.length), score: [0, 0], lock: [false, false], busy: false });
  $('#view').innerHTML = `<section class="duel" id="duel">
    <div class="duel-half p1" id="duel-1"></div>
    <div class="duel-mid"><span id="duel-score">0 : 0</span><button class="btn ghost small" data-action="games">${icon('x')} Beenden</button></div>
    <div class="duel-half p0" id="duel-0"></div>
  </section>`;
  duelRound(set);
}
function duelRound(set) {
  const s = G.s;
  if (s.round >= s.total) {
    const [a, b] = s.score;
    sfx.win(); confetti();
    const msg = a === b ? 'Unentschieden!' : 'Gewonnen! 🏆';
    [0, 1].forEach((p) => {
      const el = $(`#duel-${p}`);
      if (el) el.innerHTML = `<div class="duel-end"><h2>${a === b ? msg : (s.score[p] > s.score[1 - p] ? msg : 'Knapp verloren – nochmal?')}</h2><p class="lead">${s.score[p]} : ${s.score[1 - p]}</p>
        <button class="btn primary" data-action="game-again">${icon('shuffle')} Revanche</button></div>`;
    });
    return;
  }
  const w = s.words[s.round % s.words.length];
  const others = shuffle(s.words.filter((x) => x !== w && gameForm(x).toLowerCase() !== gameForm(w).toLowerCase())).slice(0, 3);
  Object.assign(s, { w, lock: [false, false], busy: false });
  [0, 1].forEach((p) => {
    const opts = shuffle([w, ...others]);
    const el = $(`#duel-${p}`);
    if (!el) return;
    el.innerHTML = `${gamePrompt(set, w, 'duel-prompt')}
      <div class="duel-opts">${opts.map((o) => `<button class="duel-opt" data-action="duel-tap" data-p="${p}" data-ok="${o === w ? 1 : 0}" lang="${set.lang}">${esc(gameForm(o))}</button>`).join('')}</div>
      <p class="duel-info">Runde ${s.round + 1} von ${s.total}</p>`;
  });
}
function duelTap(el) {
  const s = G.s;
  const p = +el.dataset.p;
  if (s.busy || s.lock[p]) return;
  if (el.dataset.ok === '1') {
    s.busy = true;
    s.score[p]++;
    el.classList.add('good');
    sfx.good();
    $(`#duel-${p}`)?.classList.add('won');
    const sc = $('#duel-score'); if (sc) sc.textContent = `${s.score[0]} : ${s.score[1]}`;
    gLater(() => { $$('.duel-half').forEach((h) => h.classList.remove('won')); s.round++; duelRound(currentSet()); }, 1200);
  } else {
    s.lock[p] = true;
    el.classList.add('bad');
    sfx.bad();
    $$(`.duel-opt[data-p="${p}"]`).forEach((b) => { b.disabled = true; });
    if (s.lock[0] && s.lock[1]) {
      s.busy = true;
      $$('.duel-opt[data-ok="1"]').forEach((b) => b.classList.add('good'));
      gLater(() => { s.round++; duelRound(currentSet()); }, 1500);
    }
  }
}

/* ---------- Bereich „Für die Kinder“ (eigene Portion): Bilder ja/nein und welche Spiele ---------- */
function gamesSettingsHTML(set) {
  if (!set || !isOwnSet(set)) return '';
  const off = new Set(set.gamesOff || []);
  return `<section class="kids-settings" aria-labelledby="ks-title">
    <h2 id="ks-title">${icon('sliders')} Für die Kinder</h2>
    <div class="ks-row">
      <span class="ks-label">Vokabeln zeigen</span>
      <div class="seg small" role="group" aria-label="Mit Bildern oder nur Wörter">
        <button class="seg-btn" data-action="kids-pics" data-on="1" aria-pressed="${!set.noPics}">${icon('image')}<span>Mit Bildern</span></button>
        <button class="seg-btn" data-action="kids-pics" data-on="0" aria-pressed="${!!set.noPics}"><span>Aa</span><span>Nur Wörter</span></button>
      </div>
    </div>
    <p class="hint ks-pic-hint">${set.noPics ? 'Lernkarten, Übungen, Spiele und Test zeigen keine Bilder. Du siehst sie hier unten in deiner Kartenübersicht weiterhin.' : 'Die Bilder helfen beim Merken und kommen in Lernkarten, Übungen, Spielen und Test vor.'}</p>
    <details class="games-settings">
      <summary>Welche Spiele? <small class="muted">(${GAMES.length - off.size} von ${GAMES.length} an)</small></summary>
      <div class="games-toggles">${GAMES.map((g) => `<label class="switch"><input type="checkbox" data-game-toggle="${g.id}" ${off.has(g.id) ? '' : 'checked'}><span>${g.art} ${esc(g.name)}</span></label>`).join('')}</div>
    </details>
    <p class="hint">Gilt für deine Klassen und für Portionen, die du per Link oder QR-Code teilst. Einzelne Kinder kannst du unter „Klassen“ ausnehmen. Spiele zählen nicht für die Auswertung.</p>
  </section>`;
}
document.addEventListener('change', (e) => {
  const id = e.target?.dataset?.gameToggle;
  if (!id) return;
  const set = currentSet();
  if (!set || !isOwnSet(set)) return;
  const off = new Set(set.gamesOff || []);
  if (e.target.checked) off.delete(id); else off.add(id);
  set.gamesOff = [...off];
  set.updated = Date.now();
  saveDB();
  const sum = $('.games-settings summary small'); if (sum) sum.textContent = `(${GAMES.length - off.size} von ${GAMES.length} an)`;
});

const gameActions = {
  games: () => { stopGame(); openGames(); },
  'game-open': (el) => openGame(el.dataset.game),
  'ws-tip': (el) => { el.closest('li')?.classList.toggle('flip'); },
  'ws-back': (el) => { db.settings.wsBack = el.dataset.on === '1'; saveDB(); stopGame(); renderGame(); },
  'kids-pics': (el) => {
    const set = currentSet();
    if (!set || !isOwnSet(set)) return;
    const noPics = el.dataset.on === '0';
    if (!!set.noPics === noPics) return;
    if (noPics) set.noPics = true; else delete set.noPics;
    set.updated = Date.now();
    saveDB();
    render();
    toast(noPics ? 'Die Kinder sehen nur die Wörter.' : 'Die Kinder sehen die Bilder.');
  },
  'game-again': () => { stopGame(); renderGame(); },
  'blitz-answer': (el) => blitzAnswer(el.dataset.v === '1'),
  'blitz-level': (el) => blitzBegin(currentSet(), +el.dataset.level),
  'blitz-tap': (el) => blitzTap(+el.dataset.i),
  'scr-play': (el) => { const w = G.s.w; if (w) speak(w.foreign, currentSet().lang, { slow: !!el.dataset.slow }); },
  'scr-tile': (el) => scrambleTile(+el.dataset.id),
  'scr-slot': (el) => scrambleSlot(+el.dataset.k),
  'scr-hint': () => scrambleHint(),
  'scr-skip': () => { G.s.i++; scrambleWord(currentSet()); },
  'bl-pop': (el) => balloonPop(el),
  'bl-level': (el) => balloonBegin(currentSet(), +el.dataset.level),
  'bl-count': (el) => { G.s.bcount = +el.dataset.n; $$('[data-action="bl-count"]').forEach((x) => x.setAttribute('aria-pressed', String(x === el))); },
  'rk-key': (el) => rocketGuess(el.dataset.k),
  'ws-pdf': () => searchPDF(),
  'duel-tap': (el) => duelTap(el),
};
