/* Vokaboom – Übungsarten: Lernkarten, Zuordnen, Aussprechen, Hören & Schreiben, Test */
'use strict';

const wordsById = (set, ids) => ids.map((id) => set.words.find((w) => w.id === id)).filter(Boolean);
const AUTO_NEXT_MS = 1000; // Richtig → nach dieser Zeit automatisch weiter
const sayBtn = (text, lang, label = 'Anhören', extra = '') => (canSpeak() && text
  ? `<button type="button" class="say ${extra}" data-action="say" data-text="${esc(text)}" data-lang="${lang}" aria-label="${esc(label)}" title="${esc(label)}">${icon('speaker')}</button>` : '');
const progressBar = (frac, label) => `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(frac * 100)}" aria-label="${esc(label)}"><div class="progress-fill" style="width:${(frac * 100).toFixed(1)}%"></div></div>`;

/**
 * Merkt sich pro Wort, wie es in einer Übung lief (für „Schwierige Wörter“ und die Auswertung der Lehrperson).
 * result: 'correct' | 'almost' | 'wrong'. Gespeichert in set.progress.words[wid] = { n, bad, almost, last, t, by: { mode: [n, bad] } }
 */
function trackWord(set, wid, mode, result) {
  if (!set || !wid || !result) return;
  set.progress = set.progress || {};
  const words = set.progress.words = set.progress.words || {};
  const s = words[wid] = words[wid] || { n: 0, bad: 0, almost: 0 };
  s.n++;
  if (result === 'wrong') s.bad++;
  if (result === 'almost') s.almost = (s.almost || 0) + 1;
  s.last = result; s.t = Date.now();
  const by = s.by = s.by || {};
  const m = by[mode] = by[mode] || [0, 0];
  m[0]++; if (result === 'wrong') m[1]++;
  set.updated = Date.now();
  saveDB();
}

function saveProgress(set, key, value) {
  set.progress = set.progress || {};
  set.progress[key] = value;
  set.updated = Date.now();
  saveDB();
}

/* =========================================================
   1 · LERNKARTEN
   ========================================================= */
const cards = { ids: [], queue: [], flipped: false, front: 'picword', layout: 'stack', firstTry: new Map(), total: 0, known: 0, finished: false };

function startCards(set, opts = {}) {
  const anyPic = set.words.some((w) => hasPicture(w, set.lang));
  cards.front = db.settings.cardFront || (anyPic ? 'picword' : 'foreign');
  if (!anyPic && (cards.front === 'pic' || cards.front === 'picword')) cards.front = 'foreign';
  cards.layout = opts.layout || 'stack';
  cards.ids = opts.ids || set.words.map((w) => w.id);
  resetCards(true);
}
function resetCards(mix = true, ids) {
  if (ids) cards.ids = ids;
  cards.queue = mix ? shuffle(cards.ids) : cards.ids.slice();
  cards.flipped = false;
  cards.firstTry = new Map();
  cards.total = cards.queue.length;
  cards.known = 0;
  cards.finished = false;
}

/** Die zwei Seiten einer Karte: Auf jeder Seite steht das Wort nur in einer Sprache.
 *  Anhören gibt es nur auf der englischen Seite. englishBack: Ist die Rückseite englisch? */
function cardFaces(set, w, front) {
  const L = LANGS[set.lang].name;
  const pic = hasPicture(w, set.lang);
  const f = (front === 'pic' || front === 'picword') && !pic ? 'foreign' : front;
  const label = (t) => `<p class="face-label">${t}</p>`;
  const en = (big) => `<div class="cw-line"><p class="cw-foreign ${big ? 'xl' : ''}" lang="${set.lang}">${esc(w.foreign)}</p>${sayBtn(w.foreign, set.lang)}</div>`;
  const de = `<p class="cw-german xl" lang="de">${esc(w.german || '–')}</p>`;
  const bigPic = picHTML(w, set.lang, 'card-pic');
  const smallPic = pic ? picHTML(w, set.lang, 'card-pic small') : '';
  if (f === 'pic') return { frontHTML: label(`Wie heißt das auf ${L}?`) + bigPic, backHTML: label(L) + en(true), englishBack: true };
  if (f === 'picword') return { frontHTML: label(L) + bigPic + en(false), backHTML: label('Deutsch') + de, englishBack: false };
  if (f === 'german') return { frontHTML: label('Deutsch') + de, backHTML: label(L) + smallPic + en(true), englishBack: true };
  return { frontHTML: label(L) + en(true), backHTML: label('Deutsch') + smallPic + de, englishBack: false };
}
/** Ist gerade die englische Seite zu sehen? (dann wird vorgelesen) */
const englishShowing = (set, w, flipped) => cardFaces(set, w, cards.front).englishBack === !!flipped;

function flashHTML(set, w, { flipped = false, mini = false } = {}) {
  const { frontHTML, backHTML } = cardFaces(set, w, cards.front);
  return `<div class="flash ${mini ? 'mini' : 'swipeable'} ${flipped ? 'is-flipped' : ''}" data-action="flip" data-wid="${w.id}" role="button" tabindex="0" aria-label="Karte umdrehen">
    <div class="flash-inner">
      <div class="face front">${frontHTML}</div>
      <div class="face back">${backHTML}</div>
    </div>
    ${mini ? '' : `<span class="swipe-tint again" aria-hidden="true"><span>${icon('flip')} Nochmal</span></span><span class="swipe-tint ok" aria-hidden="true"><span>${icon('check')} Gewusst</span></span>`}
  </div>`;
}

function renderCards() {
  const set = currentSet();
  const v = $('#view');
  const L = LANGS[set.lang].name;
  const anyPic = set.words.some((w) => hasPicture(w, set.lang));
  const fronts = [['foreign', `${L} → Deutsch`], ['german', `Deutsch → ${L}`], ['pic', 'Bild'], ['picword', 'Bild + Wort']]
    .filter(([k]) => anyPic || (k !== 'pic' && k !== 'picword'));
  const bar = `
    <div class="mode-bar">
      <h1 class="mode-title">Lernkarten</h1>
      <div class="mode-controls">
        <div class="ctrl"><span class="label-inline">Vorne:</span>
          <div class="seg small" role="group" aria-label="Was vorne auf der Karte steht">
            ${fronts.map(([k, t]) => `<button class="seg-btn" data-action="card-front" data-front="${k}" aria-pressed="${cards.front === k}">${t}</button>`).join('')}
          </div>
        </div>
        <div class="seg small" role="group" aria-label="Ansicht">
          <button class="seg-btn" data-action="card-layout" data-layout="stack" aria-pressed="${cards.layout === 'stack'}">${icon('stack')}<span>Stapel</span></button>
          <button class="seg-btn" data-action="card-layout" data-layout="grid" aria-pressed="${cards.layout === 'grid'}">${icon('grid')}<span>Alle Karten</span></button>
        </div>
      </div>
    </div>`;

  if (cards.layout === 'grid') {
    v.innerHTML = `<section class="mode cards-mode">${bar}
      <p class="mode-hint">Tippe eine Karte an, um sie umzudrehen.</p>
      <div class="flash-grid">${wordsById(set, cards.ids).map((w) => flashHTML(set, w, { mini: true })).join('')}</div>
    </section>`;
    return;
  }

  if (cards.finished) {
    const pct = cards.total ? cards.known / cards.total : 0;
    const hard = [...cards.firstTry].filter(([, ok]) => !ok).map(([id]) => id);
    v.innerHTML = `<section class="mode cards-mode">${bar}
      <div class="result">
        ${stars(pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1)}
        <h2>Alle Karten geschafft!</h2>
        <p class="result-line">${cards.known} von ${cards.total} Karten wusstest du gleich beim ersten Mal.</p>
        <div class="row center">
          ${hard.length ? `<button class="btn primary" data-action="cards-again" data-which="hard">${icon('flip')} Die ${hard.length} schwierigen nochmal</button>` : ''}
          <button class="btn ${hard.length ? 'secondary' : 'primary'}" data-action="cards-again" data-which="all">${icon('shuffle')} Alle nochmal</button>
          <button class="btn secondary" data-action="mode" data-mode="match">Weiter: Zuordnen ${icon('right')}</button>
        </div>
      </div>
    </section>`;
    return;
  }

  const w = set.words.find((x) => x.id === cards.queue[0]);
  if (!w) { cards.finished = true; renderCards(); return; }
  const done = cards.total - cards.queue.length;
  const again = [...cards.firstTry.values()].filter((ok) => !ok).length;
  v.innerHTML = `<section class="mode cards-mode">${bar}
    ${progressBar(done / cards.total, 'Fortschritt')}
    <p class="progress-label"><span>Noch ${cards.queue.length} ${cards.queue.length === 1 ? 'Karte' : 'Karten'}</span><span class="tally"><b class="ok">${icon('check')} ${cards.known}</b><b class="again">${icon('flip')} ${again}</b></span></p>
    <p class="card-howto">Tippe auf die Karte, um sie umzudrehen. Dann wischen: <b class="ok">rechts = gewusst</b>, <b class="again">links = nochmal</b>.</p>
    <div class="stage">${flashHTML(set, w, { flipped: cards.flipped })}</div>
    <div class="card-actions" id="card-actions">${cardActions()}</div>
    <p class="mode-hint keys">Leertaste: umdrehen · <kbd>←</kbd> nochmal · <kbd>→</kbd> gewusst</p>
  </section>`;
  bindSwipe();
  // Ist vorne Englisch, wird das Wort gleich vorgelesen
  if (db.settings.autoSpeak && !cards.flipped && englishShowing(set, w, false)) {
    clearTimeout(cards.speakTimer);
    cards.speakTimer = setTimeout(() => { if (ui.view === 'cards' && cards.queue[0] === w.id && !cards.flipped) speak(w.foreign, set.lang); }, 350);
  }
}

/* Wischen: nach rechts = gewusst, nach links = nochmal. Antippen dreht die Karte um. */
function bindSwipe() {
  const el = $('.stage .flash.swipeable');
  if (!el) return;
  const tagOk = $('.swipe-tint.ok', el), tagAgain = $('.swipe-tint.again', el);
  let d = null;
  const setTags = (dx) => {
    const k = Math.min(0.94, Math.abs(dx) / 85);
    tagOk.style.opacity = dx > 0 ? k : 0;
    tagAgain.style.opacity = dx < 0 ? k : 0;
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('.say')) return;
    d = { x0: e.clientX, y0: e.clientY, dx: 0, id: e.pointerId, moving: false };
  });
  el.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moving) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      d.moving = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* */ }
      el.classList.add('dragging');
    }
    d.dx = dx;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    setTags(dx);
  });
  const end = (e) => {
    if (!d || e.pointerId !== d.id) return;
    const { dx, moving } = d;
    d = null;
    if (!moving) return; // Antippen: der Klick dreht die Karte um
    cards.justSwiped = true;
    setTimeout(() => { cards.justSwiped = false; }, 350);
    el.classList.remove('dragging');
    if (Math.abs(dx) > Math.min(110, el.offsetWidth * 0.28)) flyCard(dx > 0);
    else { el.style.transform = ''; setTags(0); }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/** Karte hinauswerfen (Wischen, Knöpfe, Pfeiltasten) und dann werten */
function flyCard(known) {
  const el = $('.stage .flash.swipeable');
  if (!el || el.classList.contains('flying')) { if (!el) cardAnswer(known); return; }
  el.classList.add('flying');
  const tag = $(`.swipe-tint.${known ? 'ok' : 'again'}`, el);
  if (tag) tag.style.opacity = 0.92;
  el.style.transform = `translateX(${known ? 130 : -130}%) rotate(${known ? 16 : -16}deg)`;
  el.style.opacity = '0';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => { if (ui.view === 'cards') cardAnswer(known); }, reduce ? 0 : 230);
}

function cardActions() {
  return `<button class="btn again big" data-action="card-again">${icon('left')} Nochmal</button>
    <button class="btn ok big" data-action="card-known">Gewusst ${icon('right')}</button>`;
}

function flipCurrent() {
  const set = currentSet();
  const el = $('.stage .flash');
  if (!el) return;
  cards.flipped = !cards.flipped;
  el.classList.toggle('is-flipped', cards.flipped);
  sfx.flip();
  $('#card-actions').innerHTML = cardActions();
  const w = set.words.find((x) => x.id === cards.queue[0]);
  if (w && db.settings.autoSpeak && englishShowing(set, w, cards.flipped)) speak(w.foreign, set.lang);
  else stopSpeaking();
}

function cardAnswer(known) {
  const set = currentSet();
  const id = cards.queue.shift();
  if (!cards.firstTry.has(id)) {
    cards.firstTry.set(id, known);
    if (known) cards.known++;
    trackWord(set, id, 'cards', known ? 'correct' : 'wrong');
  }
  if (!known) cards.queue.splice(Math.min(cards.queue.length, 3 + Math.floor(Math.random() * 3)), 0, id);
  cards.flipped = false;
  stopSpeaking();
  if (!cards.queue.length) {
    cards.finished = true;
    const prev = set.progress?.cards;
    if (cards.total === set.words.length || !prev) saveProgress(set, 'cards', { known: cards.known, total: cards.total, date: Date.now() });
    sfx.win();
    if (cards.known / cards.total >= 0.8) confetti();
  } else (known ? sfx.good : sfx.flip)();
  renderCards();
}

/* =========================================================
   2 · ZUORDNEN (wie Memory: zwei Kärtchen antippen, die zusammengehören)
   ========================================================= */
const match = { variant: 'pic', covered: false, rounds: [], round: 0, tiles: [], sel: null, open: [], busy: false, mistakes: 0, found: 0, total: 0, finished: false, choosing: false, t0: 0, elapsed: 0, tick: null, best: null, newBest: false };
const MEM_PER_ROUND = 6; // Paare pro Runde → 12 Kärtchen

const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const matchTimeKey = () => match.variant + (match.covered ? '-verdeckt' : '');

function startMatch(set, variant) {
  match.choosing = false;
  match.variant = variant;
  const seen = new Set();
  let pool = set.words.filter((w) => {
    if (!w.foreign) return false;
    if (variant === 'pic' && !hasPicture(w, set.lang)) return false;
    if (variant === 'de' && !w.german) return false;
    // Doppelte Bilder/Wörter wären nicht eindeutig zuzuordnen
    const keys = ['f:' + normAnswer(w.foreign), variant === 'pic' ? 'p:' + effectivePic(w, set.lang).src : 'd:' + normAnswer(w.german)];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });
  pool = shuffle(pool);
  const nR = Math.max(1, Math.ceil(pool.length / MEM_PER_ROUND));
  const size = Math.ceil(pool.length / nR);
  match.rounds = [];
  for (let i = 0; i < pool.length; i += size) match.rounds.push(pool.slice(i, i + size).map((w) => w.id));
  clearInterval(match.tick);
  Object.assign(match, { round: 0, mistakes: 0, found: 0, total: pool.length, finished: false, tiles: [], sel: null, open: [], busy: false, t0: 0, elapsed: 0, newBest: false });
  dealRound();
}

/** Kärtchen der aktuellen Runde mischen: je Paar ein Kärtchen links (Bild/Englisch) und eins rechts (Englisch/Deutsch) */
function dealRound() {
  const ids = match.rounds[match.round] || [];
  match.tiles = shuffle(ids.flatMap((id) => [{ id, side: 'L', gone: false }, { id, side: 'R', gone: false }]));
  match.sel = null; match.open = []; match.busy = false;
  match.missed = new Set();
}

function memTileHTML(set, t, i) {
  const w = set.words.find((x) => x.id === t.id);
  if (!w) return '';
  let face, label;
  if (match.variant === 'pic' && t.side === 'L') { face = picHTML(w, set.lang, 'mem-pic'); label = 'Bild'; }
  else if (t.side === 'L' || match.variant === 'pic') { face = `<span class="mem-word" lang="en">${esc(w.foreign)}</span>`; label = w.foreign; }
  else { face = `<span class="mem-word de" lang="de">${esc(w.german)}</span>`; label = w.german; }
  const isPic = match.variant === 'pic' && t.side === 'L';
  return `<button type="button" class="mem ${isPic ? 'is-pic' : 'is-word'} ${t.gone ? 'gone' : ''}" data-action="mem-tap" data-i="${i}" ${t.gone ? 'disabled' : ''}
      aria-label="${match.covered ? 'Verdecktes Kärtchen' : esc(label)}">
    <span class="mem-inner">
      <span class="mem-face mem-front">${face}</span>
      ${match.covered ? `<span class="mem-face mem-back" aria-hidden="true"><span class="mem-mark">V</span></span>` : ''}
    </span>
  </button>`;
}

function renderMatch() {
  const set = currentSet();
  const v = $('#view');
  const L = LANGS[set.lang].name;
  clearInterval(match.tick);
  if (match.choosing) { renderMatchChoice(set); return; }
  const bar = `
    <div class="mode-bar">
      <h1 class="mode-title">Memory</h1>
      <div class="mode-controls">
        <div class="seg small" role="group" aria-label="Was zusammengehört">
          <button class="seg-btn" data-action="match-variant" data-variant="pic" aria-pressed="${match.variant === 'pic'}">${icon('image')}<span>Bild ↔ ${L}</span></button>
          <button class="seg-btn" data-action="match-variant" data-variant="de" aria-pressed="${match.variant === 'de'}"><span>${L} ↔ Deutsch</span></button>
        </div>
        <div class="seg small" role="group" aria-label="Kärtchen offen oder verdeckt">
          <button class="seg-btn" data-action="mem-mode" data-covered="0" aria-pressed="${!match.covered}">${icon('eye')}<span>Offen</span></button>
          <button class="seg-btn" data-action="mem-mode" data-covered="1" aria-pressed="${match.covered}">${icon('grid')}<span>Verdeckt</span></button>
        </div>
      </div>
    </div>`;

  if (match.total < 2) {
    v.innerHTML = `<section class="mode match-mode">${bar}
      <div class="result"><h2>Dafür brauchst du mindestens zwei Karten${match.variant === 'pic' ? ' mit Bild' : ' mit deutscher Übersetzung'}.</h2>
      <p class="result-line">${match.variant === 'pic' ? 'Gib den Karten in der Übersicht ein Bild – oder spiele die andere Variante.' : 'Ergänze die deutschen Wörter unter „Bearbeiten“.'}</p>
      <div class="row center"><button class="btn primary" data-action="match-variant" data-variant="${match.variant === 'pic' ? 'de' : 'pic'}">Andere Variante</button>
      <button class="btn secondary" data-action="open-set" data-id="${set.id}">Zur Übersicht</button></div></div></section>`;
    return;
  }

  if (match.finished) {
    const st = matchStars();
    v.innerHTML = `<section class="mode match-mode">${bar}
      <div class="result">
        ${stars(st)}
        <h2>${st === 3 ? 'Perfekt! Alle Paare gefunden.' : st === 2 ? 'Super gemacht!' : 'Geschafft! Übung macht den Meister.'}</h2>
        <p class="mem-final"><span class="mem-clock big">${icon('clock')} ${fmtTime(match.elapsed)}</span>
          ${match.newBest ? '<span class="best-badge">Neue Bestzeit!</span>' : match.best ? `<span class="muted">Bestzeit ${fmtTime(match.best)}</span>` : ''}</p>
        <p class="result-line">${match.total} Paare, ${match.mistakes} ${match.covered ? (match.mistakes === 1 ? 'Fehlversuch' : 'Fehlversuche') : 'Fehler'}.</p>
        <div class="row center">
          <button class="btn primary" data-action="match-variant" data-variant="${match.variant}">${icon('shuffle')} Nochmal</button>
          <button class="btn secondary" data-action="match-variant" data-variant="${match.variant === 'pic' ? 'de' : 'pic'}">${match.variant === 'pic' ? `${L} ↔ Deutsch` : `Bild ↔ ${L}`}</button>
          <button class="btn secondary" data-action="mode" data-mode="speak">Weiter: Aussprechen ${icon('right')}</button>
        </div>
      </div></section>`;
    return;
  }

  v.innerHTML = `<section class="mode match-mode">${bar}
    ${progressBar(match.found / match.total, 'Gefundene Paare')}
    <p class="progress-label"><span>${match.found} von ${match.total} Paaren${match.rounds.length > 1 ? ` · Runde ${match.round + 1} von ${match.rounds.length}` : ''}</span>
      <span class="tally"><b class="mem-clock" id="mem-time">${icon('clock')} ${fmtTime(match.t0 ? Date.now() - match.t0 : 0)}</b><b class="bad" id="mem-miss">${icon('x')} ${match.mistakes}</b></span></p>
    <p class="mode-hint mem-hint">${match.covered ? 'Decke zwei Kärtchen auf. Gehören sie zusammen, verschwinden sie. Merk dir, wo was liegt!' : 'Tippe zwei Kärtchen an, die zusammengehören. Dann verschwinden sie.'} Die Uhr läuft ab dem ersten Tippen.</p>
    <div class="mem-grid ${match.covered ? 'covered' : ''} ${match.variant === 'pic' ? 'is-pic' : 'is-words'}" id="mem-grid" style="--cols:${memCols(match.tiles.length)}">
      ${match.tiles.map((t, i) => memTileHTML(set, t, i)).join('')}
    </div>
  </section>`;
  if (match.t0) startMatchClock();
}

/** Spalten: 12 Kärtchen → 4 (Handy 3), weniger entsprechend */
const memCols = (n) => (n <= 4 ? 2 : n <= 6 ? 3 : n <= 9 ? 3 : 4);

function startMatchClock() {
  clearInterval(match.tick);
  match.tick = setInterval(() => {
    const el = $('#mem-time');
    if (!el || ui.view !== 'match') { clearInterval(match.tick); return; }
    el.innerHTML = `${icon('clock')} ${fmtTime(Date.now() - match.t0)}`;
  }, 250);
}

const memEl = (i) => $(`.mem[data-i="${i}"]`);

function memTap(i) {
  const set = currentSet();
  const t = match.tiles[i];
  if (!t || t.gone || match.busy || match.finished) return;
  if (!match.t0) { match.t0 = Date.now(); startMatchClock(); }
  if (match.covered) {
    if (match.open.includes(i)) return;
    match.open.push(i);
    memEl(i)?.classList.add('open');
    sfx.flip();
    if (match.open.length < 2) return;
    const [a, b] = match.open;
    match.busy = true;
    if (isPair(a, b)) setTimeout(() => memMatched(set, a, b), 450);
    else {
      match.mistakes++;
      updateMemMiss();
      setTimeout(() => {
        [a, b].forEach((k) => memEl(k)?.classList.remove('open'));
        match.open = []; match.busy = false;
      }, 1000);
    }
    return;
  }
  // offen: zwei antippen
  const sel = match.sel;
  if (sel == null) { match.sel = i; memEl(i)?.classList.add('selected'); return; }
  if (sel === i) { match.sel = null; memEl(i)?.classList.remove('selected'); return; }
  const s = match.tiles[sel];
  if (s.side === t.side) { // zwei Bilder oder zwei englische Wörter: Auswahl wechseln
    memEl(sel)?.classList.remove('selected');
    match.sel = i; memEl(i)?.classList.add('selected');
    return;
  }
  match.sel = null;
  if (isPair(sel, i)) { memMatched(set, sel, i); return; }
  match.missed?.add(s.id); match.missed?.add(t.id);
  match.mistakes++;
  updateMemMiss();
  sfx.bad();
  [sel, i].forEach((k) => { const el = memEl(k); if (!el) return; el.classList.remove('selected', 'wrong'); void el.offsetWidth; el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 600); });
}

const isPair = (a, b) => match.tiles[a].id === match.tiles[b].id && match.tiles[a].side !== match.tiles[b].side;
function updateMemMiss() { const m = $('#mem-miss'); if (m) m.innerHTML = `${icon('x')} ${match.mistakes}`; }

function memMatched(set, a, b) {
  const w = set.words.find((x) => x.id === match.tiles[a].id);
  [a, b].forEach((k) => { match.tiles[k].gone = true; const el = memEl(k); if (el) { el.classList.remove('selected'); el.classList.add('matched'); el.disabled = true; } });
  match.found++;
  match.open = [];
  // Memory ist ein Spiel: zählt nicht für die Auswertung
  sfx.good();
  if (w && db.settings.autoSpeak) speak(w.foreign, set.lang);
  const pf = $('.match-mode .progress-fill'), pl = $('.match-mode .progress-label span');
  if (pf) pf.style.width = `${(match.found / match.total) * 100}%`;
  if (pl) pl.textContent = `${match.found} von ${match.total} Paaren${match.rounds.length > 1 ? ` · Runde ${match.round + 1} von ${match.rounds.length}` : ''}`;
  setTimeout(() => {
    [a, b].forEach((k) => memEl(k)?.classList.add('gone'));
    match.busy = false;
    if (match.tiles.every((x) => x.gone)) {
      setTimeout(() => {
        if (ui.view !== 'match') return;
        match.round++;
        if (match.round >= match.rounds.length) finishMatch(set);
        else { dealRound(); renderMatch(); }
      }, 350);
    }
  }, 420);
}

function matchStars() {
  const r = match.mistakes / match.total;
  if (match.covered) return r <= 0.75 ? 3 : r <= 1.75 ? 2 : 1; // verdeckt: Fehlversuche gehören dazu
  return match.mistakes === 0 ? 3 : r <= 0.35 ? 2 : 1;
}

function finishMatch(set) {
  clearInterval(match.tick);
  match.finished = true;
  match.elapsed = match.t0 ? Date.now() - match.t0 : 0;
  const st = matchStars();
  const prev = set.progress?.match || {};
  const times = { ...(prev.times || {}) };
  const key = matchTimeKey();
  match.best = times[key] || null;
  match.newBest = !!match.elapsed && (!times[key] || match.elapsed < times[key]);
  if (match.newBest) times[key] = match.elapsed;
  const next = { ...prev, times };
  if (!match.covered) next[match.variant] = Math.max(prev[match.variant] || 0, st);
  saveProgress(set, 'match', next);
  sfx.win();
  if (st >= 2 || match.newBest) confetti();
  renderMatch();
}

/** Erst wählen, was zusammengehört */
function renderMatchChoice(set) {
  const L = LANGS[set.lang].name;
  const withPic = set.words.filter((w) => w.foreign && hasPicture(w, set.lang));
  const withDe = set.words.filter((w) => w.foreign && w.german);
  const sample = (list, fn) => list.slice(0, 2).map(fn).join('');
  $('#view').innerHTML = `<section class="mode match-mode">
    <div class="mode-bar"><h1 class="mode-title">Memory</h1></div>
    <div class="test-card setup choose-card">
      <h2>Was gehört zusammen?</h2>
      <div class="choose-grid">
        <button class="choose-tile" data-action="match-variant" data-variant="pic" ${withPic.length >= 2 ? '' : 'disabled'}>
          <span class="choose-demo" aria-hidden="true">${sample(withPic, (w) => `<span class="cd-row">${picHTML(w, set.lang, 'mini')}<i></i><b lang="en">${esc(w.foreign)}</b></span>`)}</span>
          <strong>${icon('image')} Bild ↔ ${L}</strong>
          <small>${withPic.length >= 2 ? 'Finde zu jedem Bild das englische Wort.' : 'Dafür brauchen mindestens zwei Karten ein Bild.'}</small>
        </button>
        <button class="choose-tile" data-action="match-variant" data-variant="de" ${withDe.length >= 2 ? '' : 'disabled'}>
          <span class="choose-demo" aria-hidden="true">${sample(withDe, (w) => `<span class="cd-row"><b lang="en">${esc(w.foreign)}</b><i></i><b lang="de">${esc(w.german)}</b></span>`)}</span>
          <strong>${icon('link')} ${L} ↔ Deutsch</strong>
          <small>${withDe.length >= 2 ? 'Finde zu jedem englischen Wort das deutsche.' : 'Dafür brauchen mindestens zwei Karten eine Übersetzung.'}</small>
        </button>
      </div>
      <div class="choose-mode">
        <span class="label-inline">Kärtchen:</span>
        <div class="seg small" role="group" aria-label="Kärtchen offen oder verdeckt">
          <button class="seg-btn" data-action="mem-mode" data-covered="0" aria-pressed="${!match.covered}">${icon('eye')}<span>Offen</span></button>
          <button class="seg-btn" data-action="mem-mode" data-covered="1" aria-pressed="${match.covered}">${icon('grid')}<span>Verdeckt (Memory)</span></button>
        </div>
      </div>
    </div>
  </section>`;
}

/* =========================================================
   3 · AUSSPRECHEN
   ========================================================= */
const speakM = { ids: [], idx: 0, show: 'word', state: 'idle', heard: '', revealed: false, attempts: 0, results: new Map(), fallback: false, reason: '', timer: null, finished: false };

function startSpeak(set, ids) {
  if (canListen()) loadCmu().catch(() => {}); // Aussprache-Wörterbuch im Hintergrund laden
  speakM.ids = shuffle(ids || set.words.filter((w) => w.foreign).map((w) => w.id));
  speakM.idx = 0;
  speakM.results = new Map();
  speakM.finished = false;
  speakM.noPh = false;
  speakM.fallback = !canListen() && !phoneticFor(set.lang);
  speakM.reason = canListen() ? '' : (speechBrowserMissing ? 'browser' : 'unsupported');
  speakM.error = '';
  if (speakM.show === 'pic' && !set.words.some((w) => hasPicture(w, set.lang))) speakM.show = 'word';
  resetSpeakWord();
}
function resetSpeakWord() {
  speakM.state = 'idle'; speakM.heard = ''; speakM.revealed = false; speakM.attempts = 0;
  clearTimeout(speakM.timer);
}
const speakWord = (set) => set.words.find((w) => w.id === speakM.ids[speakM.idx]);

function renderSpeak() {
  const set = currentSet();
  const v = $('#view');
  const anyPic = set.words.some((w) => hasPicture(w, set.lang));
  const bar = `
    <div class="mode-bar">
      <h1 class="mode-title">Aussprechen</h1>
      <div class="mode-controls">
        <div class="ctrl"><span class="label-inline">Zeige:</span>
          <div class="seg small" role="group" aria-label="Was angezeigt wird">
            <button class="seg-btn" data-action="speak-show" data-show="word" aria-pressed="${speakM.show === 'word'}">Wort</button>
            ${anyPic ? `<button class="seg-btn" data-action="speak-show" data-show="pic" aria-pressed="${speakM.show === 'pic'}">${icon('image')}<span>Bild</span></button>` : ''}
          </div>
        </div>
      </div>
    </div>`;

  if (speakM.finished) {
    const total = speakM.ids.length;
    const ok = [...speakM.results.values()].filter((r) => r === 'ok').length;
    const hard = speakM.ids.filter((id) => speakM.results.get(id) !== 'ok');
    v.innerHTML = `<section class="mode speak-mode">${bar}
      <div class="result">
        ${stars(ok / total >= 0.9 ? 3 : ok / total >= 0.6 ? 2 : 1)}
        <h2>${ok === total ? 'Wow, alles beim ersten Versuch!' : 'Gut gesprochen!'}</h2>
        <p class="result-line">${ok} von ${total} Wörtern gleich beim ersten Versuch richtig.</p>
        ${hard.length ? `<ul class="word-chips">${wordsById(set, hard).map((w) => `<li><span lang="${set.lang}">${esc(w.foreign)}</span>${sayBtn(w.foreign, set.lang)}</li>`).join('')}</ul>` : ''}
        <div class="row center">
          ${hard.length ? `<button class="btn primary" data-action="speak-again" data-which="hard">${icon('mic')} Diese ${hard.length} nochmal</button>` : ''}
          <button class="btn ${hard.length ? 'secondary' : 'primary'}" data-action="speak-again" data-which="all">${icon('shuffle')} Alle nochmal</button>
          <button class="btn secondary" data-action="mode" data-mode="dictation">Weiter: Hören & Schreiben ${icon('right')}</button>
        </div>
      </div></section>`;
    return;
  }

  const w = speakWord(set);
  if (!w) { speakM.finished = true; renderSpeak(); return; }
  const showPic = speakM.show === 'pic' && hasPicture(w, set.lang);
  const total = speakM.ids.length;
  v.innerHTML = `<section class="mode speak-mode">${bar}
    ${progressBar(speakM.idx / total, 'Fortschritt')}
    <p class="progress-label"><span>Wort ${speakM.idx + 1} von ${total}</span><span class="tally"><b class="ok">${icon('check')} ${[...speakM.results.values()].filter((r) => r === 'ok').length}</b></span></p>
    <div class="speak-card">
      ${showPic ? picHTML(w, set.lang, 'card-pic') : ''}
      <p class="cw-foreign xl ${showPic && !speakM.revealed ? 'hidden-word' : ''}" lang="${set.lang}" id="speak-word">${showPic && !speakM.revealed ? '? ? ?' : esc(w.foreign)}</p>
      ${!showPic && w.german ? `<p class="cw-german" lang="de">${esc(w.german)}</p>` : ''}
    </div>
    <div class="speak-zone" id="speak-zone" aria-live="polite">${speakZone(set, w)}</div>
  </section>`;
}

function speakZone(set, w) {
  const s = speakM.state;
  const listenBtns = `<button class="btn ghost" data-action="speak-hear">${icon('speaker')} Richtige Aussprache</button>
    <button class="btn ghost" data-action="speak-hear" data-slow="1">${icon('snail')} Langsam</button>`;
  if (speakM.fallback) {
    const why = speakM.reason === 'unsupported'
      ? esc(micErrorText('not-supported', set.lang))
      : speakM.reason === 'browser' ? 'Dieser Browser (Brave oder Opera) hat keine Spracherkennung. Mit Chrome, Edge oder Safari klappt es.'
        : speakM.reason === 'chosen' ? 'Du übst ohne Mikrofon.'
          : esc(micErrorText(speakM.reason, set.lang));
    return `<p class="note">${why} So kannst du trotzdem üben: Sprich das Wort laut, hör es dir dann an und vergleiche.</p>
      <div class="row center">${listenBtns}</div>
      <div class="row center">
        <button class="btn again" data-action="speak-self" data-ok="0">${icon('flip')} Nochmal üben</button>
        <button class="btn ok" data-action="speak-self" data-ok="1">${icon('check')} Hab ich richtig gesagt</button>
      </div>`;
  }
  if (s === 'loading') {
    const pct = Math.round((phState.progress || 0) * 100);
    return `<div class="ph-wait"><p class="mic-label">Die Lauterkennung wird geladen … <span id="ph-pct">${pct}</span> %</p>
      <div class="ph-progress"><span id="ph-bar" style="width:${pct}%"></span></div>
      <p class="muted small">Nur beim ersten Mal: ca. ${PH.MB} MB. Danach ist sie auf diesem Gerät gespeichert.</p></div>`;
  }
  if (s === 'thinking') {
    return `<p class="mic-label"><span class="spinner"></span> Ich höre mir die Laute an …</p>`;
  }
  if (s === 'starting' || s === 'listening') {
    return `<button class="mic ${s === 'listening' ? 'listening' : 'starting'}" data-action="listen" aria-label="Aufnahme beenden">${icon('mic')}</button>
      <p class="mic-label">${s === 'listening' ? 'Ich höre zu … sprich jetzt!' : 'Mikrofon wird eingeschaltet …'}</p>
      ${speakM.meter ? '<div class="mic-level" id="mic-level" aria-hidden="true"><span></span></div>' : ''}`;
  }
  if (s === 'error') {
    const isPh = String(speakM.error).startsWith('ph-');
    return `<div class="banner bad">${icon('mic')}<div><strong>${isPh ? 'Die Lauterkennung hat nicht geklappt.' : 'Das Mikrofon hat nicht geklappt.'}</strong> ${esc(isPh ? phErrorText(speakM.error) : micErrorText(speakM.error, set.lang))}
        <span class="err-code">Fehlercode: ${esc(speakM.error)}</span></div></div>
      <div class="row center">
        <button class="btn primary" data-action="listen">${icon('mic')} Nochmal versuchen</button>
        ${isPh ? '<button class="btn ghost" data-action="speak-no-ph">Ohne Lauterkennung weiter</button>' : '<button class="btn ghost" data-action="speak-fallback">Ohne Mikrofon üben</button>'}
      </div>`;
  }
  if (s === 'ok' && speakM.ph) {
    return `<div class="banner good">${icon('check')}<div><strong>Richtig!</strong></div></div>
      <div class="row center"><button class="btn primary" data-action="speak-next">Weiter ${icon('right')}</button></div>`;
  }
  if (s === 'bad' && speakM.ph) {
    const r = speakM.ph;
    return `<div class="banner bad">${icon('x')}<div><strong>Noch nicht ganz.</strong> Hör dir die richtige Aussprache an und versuch es nochmal.</div></div>
      <div class="row center">${listenBtns}</div>
      <div class="row center">
        <button class="btn primary" data-action="listen">${icon('mic')} Nochmal sprechen</button>
        <button class="btn ghost" data-action="speak-skip">Überspringen ${icon('right')}</button>
      </div>`;
  }
  if (s === 'ok') {
    return `<div class="banner good">${icon('check')}<div><strong>Richtig!</strong></div></div>
      <div class="row center"><button class="btn primary" data-action="speak-next">Weiter ${icon('right')}</button></div>`;
  }
  if (s === 'bad') {
    const help = speakM.heard ? '' : (silenceHelp(speakM.peak) || 'Wenn das öfter passiert: Einstellungen (oben rechts) → „Mikrofon testen“.');
    const many = speechTargets(w, set.lang).some((t) => t.includes(' '));
    const detail = !speakM.heard ? ' Tippe auf das Mikrofon und sprich gleich danach laut und deutlich.'
      : many ? ` Sag alle Wörter: „${esc(w.foreign.replace(/\s*\/\s*/g, ', '))}“.` : ` Richtig ist „${esc(w.foreign)}“.`;
    return `<div class="banner bad">${icon('x')}<div><strong>${speakM.heard ? 'Noch nicht ganz.' : 'Ich habe nichts gehört.'}</strong>
        ${detail}
        ${help ? `<span class="help-line">${esc(help)}</span>` : ''}</div></div>
      <div class="row center">${listenBtns}</div>
      <div class="row center">
        <button class="btn primary" data-action="listen">${icon('mic')} Nochmal sprechen</button>
        <button class="btn ghost" data-action="speak-skip">Überspringen ${icon('right')}</button>
      </div>`;
  }
  const showPic = speakM.show === 'pic';
  return `<button class="mic" data-action="listen" aria-label="Mikrofon an – jetzt sprechen">${icon('mic')}</button>
    <p class="mic-label">Tippen und das Wort sagen</p>
    <div class="row center">
      ${showPic && !speakM.revealed ? `<button class="btn ghost" data-action="speak-reveal">${icon('eye')} Ich weiß es nicht</button>` : ''}
      ${!showPic || speakM.revealed ? `<button class="btn ghost" data-action="speak-hear">${icon('speaker')} Vorher anhören</button>` : ''}
      <button class="btn ghost" data-action="speak-skip">Überspringen ${icon('right')}</button>
    </div>`;
}

function updateSpeakZone() {
  const set = currentSet();
  const w = speakWord(set);
  const z = $('#speak-zone');
  if (z && w) z.innerHTML = speakZone(set, w);
}
function revealSpeakWord() {
  const set = currentSet();
  const w = speakWord(set);
  speakM.revealed = true;
  const el = $('#speak-word');
  if (el && w) { el.textContent = w.foreign; el.classList.remove('hidden-word'); }
}

async function doListen() {
  const set = currentSet();
  const w = speakWord(set);
  if (!w) return;
  if (speakM.state === 'listening' || speakM.state === 'starting') {
    if (speakM.usingPh) { phRec.stop?.(); return; }
    stopListening(); return;
  }
  if (speakM.state === 'loading' || speakM.state === 'thinking') return;
  stopSpeaking();
  clearTimeout(speakM.timer);
  speakM.state = 'starting';
  speakM.live = '';
  speakM.peak = null;
  speakM.meter = false;
  speakM.ph = null;
  if (phoneticFor(set.lang) && !speakM.noPh) { await doListenPhonetic(set, w); return; }
  updateSpeakZone();
  let track = null;
  if (meterDuringListen()) {
    const stream = await Promise.race([
      startMeter((lv) => { const b = $('#mic-level'); if (b) b.style.setProperty('--lv', lv.toFixed(3)); }, db.settings.micId).catch(() => null),
      sleep(2500).then(() => null),
    ]);
    if (stream && micMeter.stream === stream) {
      speakM.meter = true;
      if (db.settings.micId) track = stream.getAudioTracks()[0] || null;
      updateSpeakZone();
    }
  }
  try {
    const alts = await listenOnce(set.lang, {
      track,
      onStart: () => {
        if (speakM.state !== 'starting' || speakWord(set) !== w) return;
        speakM.state = 'listening';
        updateSpeakZone();
      },
      onInterim: (t) => {
        speakM.live = t;
        if (speakM.state === 'starting') { speakM.state = 'listening'; updateSpeakZone(); }
        const el = $('#heard-live');
        if (el) el.textContent = `„${t}“`;
      },
    });
    if (speakM.meter) speakM.peak = micMeter.peak;
    stopMeter();
    if (ui.view !== 'speak' || speakWord(set) !== w) return;
    speakM.attempts++;
    if (!alts.length) speakM.silentTries = (speakM.silentTries || 0) + 1; else speakM.silentTries = 0;
    const res = speechMatch(alts, w, set.lang);
    speakM.heard = res.heard || '';
    if (res.ok) {
      markSpeakOk(w);
    } else {
      speakM.state = 'bad';
      sfx.bad();
    }
  } catch (err) {
    if (speakM.meter) speakM.peak = micMeter.peak;
    stopMeter();
    if (ui.view !== 'speak' || speakWord(set) !== w) return;
    if (err === 'no-speech') {
      speakM.attempts++; speakM.heard = ''; speakM.state = 'bad';
      speakM.silentTries = (speakM.silentTries || 0) + 1;
    } else if (err === 'aborted') {
      speakM.state = 'idle';
    } else {
      speakM.state = 'error';
      speakM.error = String(err);
      sfx.bad();
    }
  }
  updateSpeakZone();
}

function markSpeakOk(w) {
  speakM.state = 'ok';
  if (!speakM.results.has(w.id)) {
    speakM.results.set(w.id, speakM.attempts === 1 && !speakM.revealed ? 'ok' : 'retry');
    trackWord(currentSet(), w.id, 'speak', speakM.attempts === 1 && !speakM.revealed ? 'correct' : 'wrong');
  }
  sfx.good();
  revealSpeakWord();
  // Richtig → automatisch zum nächsten Wort
  speakM.timer = setTimeout(() => { if (ui.view === 'speak' && speakM.state === 'ok') nextSpeak(); }, AUTO_NEXT_MS + 300);
}

/* Lauterkennung: Laut für Laut auf dem Gerät prüfen */
async function doListenPhonetic(set, w) {
  speakM.usingPh = true;
  try {
    if (!phState.engine) {
      speakM.state = 'loading';
      updateSpeakZone();
      await loadPhoneticEngine();
      if (ui.view !== 'speak' || speakWord(set) !== w) return;
      speakM.state = 'starting';
    }
    updateSpeakZone();
    const res = await assessSpoken(w, {
      onStart: () => { if (speakWord(set) === w) { speakM.state = 'listening'; speakM.meter = true; updateSpeakZone(); } },
      onLevel: (lv) => { const b = $('#mic-level'); if (b) b.style.setProperty('--lv', lv.toFixed(3)); },
      onPhase: () => { speakM.state = 'thinking'; updateSpeakZone(); },
    });
    if (ui.view !== 'speak' || speakWord(set) !== w) return;
    speakM.attempts++;
    if (res.silent) {
      speakM.ph = null; speakM.heard = ''; speakM.peak = res.peak; speakM.state = 'bad';
      speakM.silentTries = (speakM.silentTries || 0) + 1;
    } else {
      speakM.ph = res; speakM.heard = ''; speakM.silentTries = 0;
      if (res.ok) markSpeakOk(w); else { speakM.state = 'bad'; sfx.bad(); }
    }
  } catch (err) {
    if (ui.view !== 'speak' || speakWord(set) !== w) return;
    speakM.state = 'error';
    speakM.error = String(err);
    sfx.bad();
  } finally {
    speakM.usingPh = false;
    speakM.meter = false;
  }
  updateSpeakZone();
}

/* Fortschritt beim Laden anzeigen (Aussprechen und Einstellungen) */
phState.listeners.add((st) => {
  const pct = Math.round((st.progress || 0) * 100);
  const a = $('#ph-pct'), b = $('#ph-bar');
  if (a) a.textContent = pct;
  if (b) b.style.width = pct + '%';
  updatePhSettings();
});

function nextSpeak() {
  clearTimeout(speakM.timer);
  stopListening(true);
  const skipped = speakM.ids[speakM.idx];
  if (skipped && !speakM.results.has(skipped) && (speakM.attempts > 0 || speakM.revealed)) { speakM.results.set(skipped, 'skip'); trackWord(currentSet(), skipped, 'speak', 'wrong'); }
  speakM.idx++;
  resetSpeakWord();
  if (speakM.idx >= speakM.ids.length) {
    speakM.finished = true;
    const set = currentSet();
    const ok = [...speakM.results.values()].filter((r) => r === 'ok').length;
    if (speakM.ids.length === set.words.length || !set.progress?.speak) saveProgress(set, 'speak', { correct: ok, total: speakM.ids.length, date: Date.now() });
    sfx.win();
    if (ok / speakM.ids.length >= 0.8) confetti();
  }
  renderSpeak();
}

/* =========================================================
   4 · HÖREN & SCHREIBEN (Diktat als Übung)
   ========================================================= */
const dict = { ids: [], queue: [], total: 0, firstTry: new Map(), checked: false, status: '', showDe: false, timer: null, finished: false };

function startDictation(set, ids) {
  dict.ids = ids || set.words.filter((w) => w.foreign).map((w) => w.id);
  dict.queue = shuffle(dict.ids);
  dict.total = dict.queue.length;
  dict.firstTry = new Map();
  dict.finished = false;
  resetDictWord();
}
function resetDictWord() {
  dict.checked = false; dict.status = ''; dict.showDe = false;
  clearTimeout(dict.timer);
}
const dictWord = (set) => set.words.find((w) => w.id === dict.queue[0]);
const dictOk = () => [...dict.firstTry.values()].filter(Boolean).length;

function renderDictation() {
  const set = currentSet();
  const v = $('#view');
  const bar = '<div class="mode-bar"><h1 class="mode-title">Hören & Schreiben</h1></div>';
  if (!canSpeak()) {
    v.innerHTML = `<section class="mode dict-mode">${bar}
      <div class="result"><h2>Dieser Browser kann nicht vorlesen.</h2>
      <p class="result-line">Für diese Übung braucht es eine Vorlese-Stimme. Probiere Chrome, Edge oder Safari.</p>
      <div class="row center"><button class="btn primary" data-action="open-set" data-id="${set.id}">Zur Übersicht</button></div></div></section>`;
    return;
  }
  if (dict.finished) {
    const ok = dictOk();
    const hard = [...dict.firstTry].filter(([, k]) => !k).map(([id]) => id);
    const pct = dict.total ? ok / dict.total : 0;
    v.innerHTML = `<section class="mode dict-mode">${bar}
      <div class="result">
        ${stars(pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1)}
        <h2>${ok === dict.total ? 'Super, alles gleich richtig geschrieben!' : 'Gut zugehört!'}</h2>
        <p class="result-line">${ok} von ${dict.total} Wörtern gleich beim ersten Mal richtig geschrieben.</p>
        ${hard.length ? `<ul class="word-chips">${wordsById(set, hard).map((w) => `<li><span lang="en">${esc(w.foreign)}</span>${sayBtn(w.foreign, set.lang)}</li>`).join('')}</ul>` : ''}
        <div class="row center">
          ${hard.length ? `<button class="btn primary" data-action="dict-again" data-which="hard">${icon('pencil2')} Diese ${hard.length} nochmal</button>` : ''}
          <button class="btn ${hard.length ? 'secondary' : 'primary'}" data-action="dict-again" data-which="all">${icon('shuffle')} Alle nochmal</button>
          <button class="btn secondary" data-action="mode" data-mode="test">Weiter: Test ${icon('right')}</button>
        </div>
      </div></section>`;
    return;
  }
  const w = dictWord(set);
  if (!w) { finishDictation(set); return; }
  const done = dict.total - dict.queue.length;
  const hint = w.german
    ? (dict.showDe ? `<p class="cw-german" lang="de">${esc(w.german)}</p>` : `<button class="btn ghost small" data-action="dict-hint">${icon('eye')} Tipp: Was heißt es auf Deutsch?</button>`)
    : '';
  v.innerHTML = `<section class="mode dict-mode">${bar}
    ${progressBar(done / dict.total, 'Fortschritt')}
    <p class="progress-label"><span>Noch ${dict.queue.length} ${dict.queue.length === 1 ? 'Wort' : 'Wörter'}</span><span class="tally"><b class="ok">${icon('check')} ${dictOk()}</b></span></p>
    <div class="test-card dict-card">
      <p class="q-kind">${icon('speaker')} Hör genau hin und schreib das Wort.</p>
      <div class="q-prompt"><div class="listen-prompt">
        <button class="btn primary round" data-action="dict-play" aria-label="Wort anhören">${icon('speaker', 'big')}</button>
        <button class="btn ghost small" data-action="dict-play" data-slow="1">${icon('snail')} Langsam</button>
      </div></div>
      <div class="dict-hint" id="dict-hint">${hint}</div>
      <form class="answer-form" id="d-form" autocomplete="off">
        <input id="d-answer" type="text" lang="en" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Was hörst du?" aria-label="Deine Antwort">
        <button class="btn primary" type="submit" id="d-submit">Prüfen</button>
      </form>
      <div id="d-feedback" class="feedback" aria-live="polite"></div>
      <div class="row center" id="d-more"><button class="btn ghost small" data-action="dict-unknown">Weiß ich nicht</button></div>
    </div>
  </section>`;
  $('#d-form').addEventListener('submit', (e) => { e.preventDefault(); dict.checked ? nextDict() : checkDict(); });
  setTimeout(() => $('#d-answer')?.focus(), 60);
  setTimeout(() => { if (ui.view === 'dictation' && dictWord(set) === w && !dict.checked) speak(w.foreign, set.lang); }, 300);
}

function checkDict(giveUp = false) {
  const set = currentSet();
  const w = dictWord(set);
  const input = $('#d-answer');
  if (!w || !input || dict.checked) return;
  if (!giveUp && !input.value.trim()) { input.focus(); input.classList.add('nudge'); setTimeout(() => input.classList.remove('nudge'), 400); return; }
  const r = giveUp ? { status: 'wrong' } : checkAnswer(input.value, w);
  dict.checked = true;
  dict.status = r.status;
  if (!dict.firstTry.has(w.id)) { dict.firstTry.set(w.id, r.status === 'correct'); trackWord(set, w.id, 'dictation', r.status); }
  input.readOnly = true;
  input.classList.add(r.status);
  $('#d-submit').innerHTML = `Weiter ${icon('right')}`;
  $('#d-more')?.remove();
  $('#d-feedback').innerHTML = feedbackHTML(set, w, r.status, r.note)
    + (r.status === 'wrong' ? '<p class="muted small center">Das Wort kommt gleich noch einmal.</p>' : '');
  (r.status === 'correct' ? sfx.good : r.status === 'almost' ? sfx.almost : sfx.bad)();
  const t = $('.dict-mode .tally .ok');
  if (t) t.innerHTML = `${icon('check')} ${dictOk()}`;
  $('#d-submit').focus();
  if (r.status === 'correct') {
    const id = w.id;
    dict.timer = setTimeout(() => { if (ui.view === 'dictation' && dict.checked && dict.queue[0] === id) nextDict(); }, AUTO_NEXT_MS);
  }
}

function nextDict() {
  clearTimeout(dict.timer);
  stopSpeaking();
  const id = dict.queue.shift();
  if (dict.status === 'wrong') dict.queue.splice(Math.min(dict.queue.length, 2 + Math.floor(Math.random() * 2)), 0, id);
  resetDictWord();
  const set = currentSet();
  if (!dict.queue.length) finishDictation(set); else renderDictation();
}

function finishDictation(set) {
  dict.finished = true;
  const ok = dictOk();
  if (dict.total === set.words.filter((w) => w.foreign).length || !set.progress?.dictation) saveProgress(set, 'dictation', { correct: ok, total: dict.total, date: Date.now() });
  sfx.win();
  if (dict.total && ok / dict.total >= 0.8) confetti();
  renderDictation();
}

/* =========================================================
   5 · TEST
   ========================================================= */
const TEST_TYPES = {
  pic: { label: 'Bild → schreiben', icon: 'image' },
  de: { label: 'Deutsch → schreiben', icon: 'pencil2' },
  listen: { label: 'Hören → schreiben', icon: 'speaker' },
  choice: { label: 'Bedeutung wählen', icon: 'check' },
};
const test = { phase: 'setup', types: new Set(['pic', 'de', 'listen', 'choice']), onlyIds: null, questions: [], idx: 0, checked: false, points: 0, timer: null };

function startTest(set, ids = null) {
  test.phase = 'setup';
  test.onlyIds = ids;
  test.questions = [];
}

function typeAvailable(set, type) {
  if (type === 'pic') return set.words.some((w) => hasPicture(w, set.lang));
  if (type === 'listen') return canSpeak();
  if (type === 'choice') return new Set(set.words.map((w) => w.german).filter(Boolean)).size >= 3;
  if (type === 'de') return set.words.some((w) => w.german);
  return true;
}

function buildTest(set) {
  const pool = shuffle(set.words.filter((w) => w.foreign && (!test.onlyIds || test.onlyIds.includes(w.id))));
  const types = [...test.types].filter((t) => typeAvailable(set, t));
  const germans = [...new Set(set.words.map((w) => w.german).filter(Boolean))];
  const feasible = (t, w) => (t === 'pic' ? hasPicture(w, set.lang)
    : t === 'de' ? !!w.german
      : t === 'listen' ? canSpeak()
        : t === 'choice' ? !!w.german && germans.length >= 3 : false);
  let k = Math.floor(Math.random() * Math.max(1, types.length));
  const qs = [];
  for (const w of pool) {
    let type = null;
    for (let i = 0; i < types.length; i++) {
      const t = types[(k + i) % types.length];
      if (feasible(t, w)) { type = t; k = k + i + 1; break; }
    }
    if (!type) type = ['de', 'pic', 'listen', 'choice'].find((t) => feasible(t, w));
    if (!type) continue;
    const q = { wid: w.id, type, answer: '', result: null };
    if (type === 'choice') {
      const others = shuffle(germans.filter((g) => normAnswer(g) !== normAnswer(w.german))).slice(0, 3);
      q.options = shuffle([w.german, ...others]);
    }
    qs.push(q);
  }
  return qs;
}

function renderTest() {
  const set = currentSet();
  const v = $('#view');
  const L = LANGS[set.lang].name;

  if (test.phase === 'setup') {
    const n = test.onlyIds ? test.onlyIds.length : set.words.filter((w) => w.foreign).length;
    v.innerHTML = `<section class="mode test-mode">
      <div class="mode-bar"><h1 class="mode-title">Test</h1></div>
      <div class="test-card setup">
        <h2>Zeig, was du kannst!</h2>
        <p class="lead">${n} ${n === 1 ? 'Frage' : 'Fragen'}${test.onlyIds ? ' (nur deine Fehler)' : ''}. Meistens schreibst du das ${LANGS[set.lang].adj} Wort.</p>
        <fieldset class="types">
          <legend class="label">Welche Aufgaben?</legend>
          ${Object.entries(TEST_TYPES).map(([k, t]) => {
            const avail = typeAvailable(set, k);
            return `<label class="type-chip ${avail ? '' : 'disabled'}"><input type="checkbox" data-type="${k}" ${test.types.has(k) && avail ? 'checked' : ''} ${avail ? '' : 'disabled'}>
              <span>${icon(t.icon)} ${t.label}</span></label>`;
          }).join('')}
        </fieldset>
        <button class="btn primary big" data-action="test-start">Test starten ${icon('right')}</button>
      </div>
    </section>`;
    $$('.types input', v).forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) test.types.add(cb.dataset.type); else test.types.delete(cb.dataset.type);
    }));
    return;
  }

  if (test.phase === 'done') { renderTestResult(set); return; }

  const q = test.questions[test.idx];
  const w = set.words.find((x) => x.id === q.wid);
  const total = test.questions.length;
  const instr = {
    pic: `Wie heißt das auf ${L}? Schreib das Wort.`,
    de: `Schreib das ${LANGS[set.lang].adj} Wort.`,
    listen: 'Hör genau hin und schreib das Wort.',
    choice: 'Was bedeutet das auf Deutsch?',
  }[q.type];
  let prompt = '';
  if (q.type === 'pic') prompt = picHTML(w, set.lang, 'card-pic');
  else if (q.type === 'de') prompt = `<p class="cw-german xl" lang="de">${esc(w.german)}</p>`;
  else if (q.type === 'listen') prompt = `<div class="listen-prompt"><button class="btn primary round" data-action="test-play" aria-label="Wort anhören">${icon('speaker', 'big')}</button>
      <button class="btn ghost small" data-action="test-play" data-slow="1">${icon('snail')} Langsam</button></div>`;
  else prompt = `<div class="cw-line"><p class="cw-foreign xl" lang="${set.lang}">${esc(w.foreign)}</p>${sayBtn(w.foreign, set.lang)}</div>`;

  const answerArea = q.type === 'choice'
    ? `<div class="choices">${q.options.map((o, i) => `<button class="choice" data-action="test-choice" data-i="${i}" lang="de"><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join('')}</div>`
    : `<form class="answer-form" id="t-form" autocomplete="off">
        <input id="t-answer" type="text" lang="${set.lang}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Dein Wort …" aria-label="Deine Antwort">
        <button class="btn primary" type="submit" id="t-submit">Prüfen</button>
      </form>`;

  v.innerHTML = `<section class="mode test-mode">
    <div class="mode-bar"><h1 class="mode-title">Test</h1></div>
    ${progressBar(test.idx / total, 'Fortschritt')}
    <p class="progress-label"><span>Frage ${test.idx + 1} von ${total}</span><span class="tally"><b class="ok">${fmtPoints(test.points)} ${test.points === 1 ? 'Punkt' : 'Punkte'}</b></span></p>
    <div class="test-card">
      <p class="q-kind">${icon(TEST_TYPES[q.type].icon)} ${instr}</p>
      <div class="q-prompt">${prompt}</div>
      ${answerArea}
      <div id="t-feedback" class="feedback" aria-live="polite"></div>
    </div>
  </section>`;
  test.checked = false;
  const form = $('#t-form');
  if (form) {
    form.addEventListener('submit', (e) => { e.preventDefault(); test.checked ? nextQuestion() : checkTyped(); });
    setTimeout(() => $('#t-answer')?.focus(), 60);
  }
  if (q.type === 'listen') setTimeout(() => speak(w.foreign, set.lang), 250);
}

const fmtPoints = (p) => String(p).replace('.', ',');

function feedbackHTML(set, w, status, note) {
  const sol = `<span class="solution"><strong lang="${set.lang}">${esc(w.foreign)}</strong>${sayBtn(w.foreign, set.lang)}</span>`;
  if (status === 'correct') return `<div class="banner good">${icon('check')}<div><strong>Richtig!</strong> ${sol}</div></div>`;
  if (status === 'almost') return `<div class="banner almost">${icon('pencil2')}<div><strong>${esc(note || 'Fast richtig!')}</strong> Richtig ist: ${sol}</div></div>`;
  return `<div class="banner bad">${icon('x')}<div><strong>Leider falsch.</strong> Richtig ist: ${sol}${w.german ? ` <span class="muted">(${esc(w.german)})</span>` : ''}</div></div>`;
}

function checkTyped() {
  const set = currentSet();
  const q = test.questions[test.idx];
  const w = set.words.find((x) => x.id === q.wid);
  const input = $('#t-answer');
  if (!input.value.trim()) { input.focus(); input.classList.add('nudge'); setTimeout(() => input.classList.remove('nudge'), 400); return; }
  const r = checkAnswer(input.value, w);
  q.answer = input.value.trim();
  q.result = r.status;
  test.points += r.status === 'correct' ? 1 : r.status === 'almost' ? 0.5 : 0;
  test.checked = true;
  input.readOnly = true;
  input.classList.add(r.status);
  $('#t-submit').innerHTML = `Weiter ${icon('right')}`;
  $('#t-feedback').innerHTML = feedbackHTML(set, w, r.status, r.note);
  (r.status === 'correct' ? sfx.good : r.status === 'almost' ? sfx.almost : sfx.bad)();
  updateTally();
  $('#t-submit').focus();
  if (r.status === 'correct') autoNextQuestion();
}

/** Richtig → nach kurzer Zeit automatisch zur nächsten Frage */
function autoNextQuestion() {
  clearTimeout(test.timer);
  const idx = test.idx;
  test.timer = setTimeout(() => { if (ui.view === 'test' && test.phase === 'q' && test.idx === idx && test.checked) nextQuestion(); }, AUTO_NEXT_MS);
}

function chooseOption(i) {
  if (test.checked) return;
  const set = currentSet();
  const q = test.questions[test.idx];
  const w = set.words.find((x) => x.id === q.wid);
  const picked = q.options[i];
  const ok = normAnswer(picked) === normAnswer(w.german);
  q.answer = picked; q.result = ok ? 'correct' : 'wrong';
  test.points += ok ? 1 : 0;
  test.checked = true;
  $$('.choice').forEach((b, j) => {
    b.disabled = true;
    if (normAnswer(q.options[j]) === normAnswer(w.german)) b.classList.add('correct');
    else if (j === i) b.classList.add('wrong');
  });
  $('#t-feedback').innerHTML = (ok
    ? `<div class="banner good">${icon('check')}<div><strong>Richtig!</strong> ${esc(w.foreign)} = ${esc(w.german)}</div></div>`
    : `<div class="banner bad">${icon('x')}<div><strong>Leider falsch.</strong> ${esc(w.foreign)} heißt „${esc(w.german)}“.</div></div>`)
    + `<div class="row center"><button class="btn primary" data-action="test-next" id="t-next">Weiter ${icon('right')}</button></div>`;
  (ok ? sfx.good : sfx.bad)();
  updateTally();
  $('#t-next').focus();
  if (ok) autoNextQuestion();
}

function updateTally() {
  const t = $('.test-mode .tally .ok');
  if (t) t.textContent = `${fmtPoints(test.points)} ${test.points === 1 ? 'Punkt' : 'Punkte'}`;
}

function nextQuestion() {
  clearTimeout(test.timer);
  stopSpeaking();
  test.idx++;
  if (test.idx >= test.questions.length) {
    test.phase = 'done';
    const set = currentSet();
    const pct = Math.round((test.points / test.questions.length) * 100);
    const prev = set.progress?.test || {};
    if (!test.onlyIds) saveProgress(set, 'test', { best: Math.max(prev.best ?? 0, pct), last: pct, date: Date.now() });
    test.questions.forEach((q) => trackWord(set, q.wid, 'test', q.result));
    sfx.win();
    if (pct >= 80) confetti();
  }
  renderTest();
}

/** Übersicht: pro Aufgabenart richtig/falsch und die Wörter, die am meisten Mühe machen */
function testSummaryHTML(set) {
  const byType = {};
  for (const q of test.questions) {
    const t = (byType[q.type] = byType[q.type] || { n: 0, ok: 0, almost: 0, bad: 0 });
    t.n++;
    if (q.result === 'correct') t.ok++; else if (q.result === 'almost') t.almost++; else t.bad++;
  }
  const types = Object.keys(TEST_TYPES).filter((k) => byType[k]);
  const hist = set.progress?.words || {};
  const hard = test.questions.filter((q) => q.result !== 'correct')
    .map((q) => ({ q, w: set.words.find((x) => x.id === q.wid), h: hist[q.wid] || { n: 1, bad: 0 } }))
    .filter((x) => x.w)
    .sort((a, b) => (a.q.result === 'wrong' ? 0 : 1) - (b.q.result === 'wrong' ? 0 : 1) || (b.h.bad / b.h.n) - (a.h.bad / a.h.n) || b.h.bad - a.h.bad);
  const typeRows = types.map((k) => {
    const t = byType[k];
    const pct = (x) => (100 * x / t.n).toFixed(1);
    return `<li class="ts-row">
      <span class="ts-name">${icon(TEST_TYPES[k].icon)} ${TEST_TYPES[k].label}</span>
      <span class="ts-bar" aria-hidden="true"><i class="ok" style="width:${pct(t.ok)}%"></i><i class="almost" style="width:${pct(t.almost)}%"></i><i class="bad" style="width:${pct(t.bad)}%"></i></span>
      <span class="ts-num"><b>${t.ok}</b> von ${t.n} richtig${t.bad ? `, <span class="bad-t">${t.bad} falsch</span>` : ''}${t.almost ? `, ${t.almost} fast` : ''}</span>
    </li>`;
  }).join('');
  const hardRows = hard.slice(0, 10).map(({ q, w, h }) => `<li class="hw ${q.result}">
      <span class="hw-word"><strong lang="${set.lang}">${esc(w.foreign)}</strong>${w.german ? ` <span class="muted" lang="de">${esc(w.german)}</span>` : ''}</span>
      <span class="hw-tag">${q.result === 'almost' ? 'fast richtig' : 'falsch'}${h.bad > 1 ? ` · schon ${h.bad}× falsch` : ''}</span>
    </li>`).join('');
  return `<div class="test-summary">
    <h3>Übersicht</h3>
    <ul class="ts-list">${typeRows}</ul>
    ${hard.length ? `<h3>Diese Wörter machen dir am meisten Mühe</h3>
      <ul class="hw-list">${hardRows}</ul>
      ${hard.length > 10 ? `<p class="muted small">… und ${hard.length - 10} weitere.</p>` : ''}
      <p class="label">Gleich nochmal üben:</p>
      <div class="row center wrap practice-row">
        <button class="btn primary" data-action="test-retry-wrong">${icon('pencil2')} Nochmal testen</button>
        <button class="btn secondary" data-action="test-practice" data-mode="cards">${icon('stack')} Lernkarten</button>
        <button class="btn secondary" data-action="test-practice" data-mode="dictation">${icon('speaker')} Hören & Schreiben</button>
        ${canListen() ? `<button class="btn secondary" data-action="test-practice" data-mode="speak">${icon('mic')} Aussprechen</button>` : ''}
      </div>` : '<p class="lead">Alles richtig – keine schwierigen Wörter. 🎉</p>'}
  </div>`;
}

function renderTestResult(set) {
  const v = $('#view');
  const total = test.questions.length;
  const pct = Math.round((test.points / total) * 100);
  const msg = pct >= 95 ? 'Hervorragend!' : pct >= 80 ? 'Sehr gut!' : pct >= 60 ? 'Gut gemacht!' : pct >= 40 ? 'Weiter üben – du schaffst das!' : 'Schau dir die Karten noch einmal an und probier es dann wieder.';
  const wrongIds = test.questions.filter((q) => q.result !== 'correct').map((q) => q.wid);
  const C = 2 * Math.PI * 52;
  const statusIcon = { correct: icon('check'), almost: icon('pencil2'), wrong: icon('x') };
  const promptOf = (q, w) => (q.type === 'pic' ? picHTML(w, set.lang, 'mini') : q.type === 'listen' ? `<span class="tag">${icon('speaker')} gehört</span>` : q.type === 'choice' ? `<span lang="${set.lang}">${esc(w.foreign)}</span>` : `<span lang="de">${esc(w.german)}</span>`);
  v.innerHTML = `<section class="mode test-mode">
    <div class="mode-bar"><h1 class="mode-title">Test</h1></div>
    <div class="test-result">
      <div class="score-ring" role="img" aria-label="${pct} Prozent">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg ${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'}" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>
        <span class="score-num">${pct}<small>%</small></span>
      </div>
      <h2>${msg}</h2>
      <p class="result-line">${fmtPoints(test.points)} von ${total} Punkten. Fast richtige Antworten zählen einen halben Punkt.</p>
      ${testSummaryHTML(set)}
      <div class="row center">
        <button class="btn ${wrongIds.length ? 'ghost' : 'primary'}" data-action="test-restart">${icon('shuffle')} Neuer Test mit allen Wörtern</button>
      </div>
      <h3 class="review-title">Alle Antworten</h3>
      <ol class="review">
        ${test.questions.map((q) => {
          const w = set.words.find((x) => x.id === q.wid);
          if (!w) return '';
          return `<li class="rv ${q.result}">
            <span class="rv-status" aria-label="${q.result === 'correct' ? 'richtig' : q.result === 'almost' ? 'fast richtig' : 'falsch'}">${statusIcon[q.result] || ''}</span>
            <span class="rv-prompt">${promptOf(q, w)}</span>
            <span class="rv-answer">${q.result === 'correct' ? '' : `<s>${esc(q.answer) || '–'}</s>`} <strong lang="${q.type === 'choice' ? 'de' : set.lang}">${esc(q.type === 'choice' ? w.german : w.foreign)}</strong></span>
          </li>`;
        }).join('')}
      </ol>
    </div>
  </section>`;
}
