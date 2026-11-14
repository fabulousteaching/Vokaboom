/* Vokaboom – Vokabelspiele (Schritt 2 einer Portion)
 * Memory, Ballon-Platzen, Blitzrunde, Buchstabensalat, Wortsuchsel, Rakete starten, Duell zu zweit.
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
  { id: 'rocket', name: 'Rakete starten', art: '🚀', text: 'Errate das Wort Buchstabe für Buchstabe.', min: 1 },
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
    <div class="mode-bar"><h1 class="mode-title">${esc(title)}</h1>
      <button class="btn ghost small" data-action="games">${icon('left')} Alle Spiele</button></div>
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
   ========================================================= */
/** Eine glaubwürdig falsche Schreibweise */
function misspell(word, lang) {
  const w = word;
  // Artikel (the, to, le, la, l' …) bleibt richtig – falsch geschrieben wird nur das eigentliche Wort
  const art = (w.match(/^(the |a |an |to |le |la |les |un |une |des |du |se |l['’]|d['’])/i) || [''])[0].length;
  const idx = [...w].map((c, i) => (i >= art && /\p{L}/u.test(c) ? i : -1)).filter((i) => i >= 0);
  const tries = [];
  const vowels = lang === 'fr' ? 'aeiouéèê' : 'aeiou';
  // zwei Buchstaben vertauschen
  for (const i of idx) if (idx.includes(i + 1) && w[i] !== w[i + 1]) tries.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  // Buchstabe verdoppeln / weglassen
  for (const i of idx) {
    if (/[bcdfgklmnprst]/i.test(w[i]) && w[i + 1] !== w[i] && w[i - 1] !== w[i]) tries.push(w.slice(0, i + 1) + w[i] + w.slice(i + 1));
    if (w[i] === w[i + 1]) tries.push(w.slice(0, i) + w.slice(i + 1));
  }
  // Selbstlaut tauschen
  for (const i of idx) if (vowels.includes(w[i].toLowerCase())) for (const v of vowels) if (v !== w[i].toLowerCase()) tries.push(w.slice(0, i) + v + w.slice(i + 1));
  // Französisch: Akzent weg oder falsch
  if (lang === 'fr') for (const i of idx) { const c = w[i]; if (/[éèê]/.test(c)) for (const r of ['e', 'é', 'è', 'ê']) if (r !== c) tries.push(w.slice(0, i) + r + w.slice(i + 1)); }
  if (lang === 'en' && /ie|ei/.test(w)) tries.push(w.replace(/ie|ei/, (m) => (m === 'ie' ? 'ei' : 'ie')));
  const bad = shuffle(tries).find((t) => t !== w && t.toLowerCase() !== w.toLowerCase() && t.length >= 2);
  return bad || null;
}
function startBlitz(set) {
  const words = shuffle(gameWords(set).map(gameForm).filter((f) => f.length >= 2 && f.length <= 30));
  Object.assign(G.s, { words, score: 0, wrong: 0, end: Date.now() + 60000, card: null, busy: false, done: false });
  $('#view').innerHTML = gameShell('Blitzrunde', `
    <div class="blitz-top"><span class="blitz-score" id="blitz-score">0 Punkte</span><span class="blitz-time" id="blitz-time">60</span></div>
    <div class="progress"><div class="progress-fill" id="blitz-bar" style="width:100%"></div></div>
    <p class="hint center">Richtig geschrieben → nach <strong>rechts</strong> wischen. Falsch geschrieben → nach <strong>links</strong>.</p>
    <div class="blitz-stage" id="blitz-stage"></div>
    <div class="blitz-buttons">
      <button class="btn big blitz-no" data-action="blitz-answer" data-v="0">${icon('left')} Falsch</button>
      <button class="btn big blitz-yes" data-action="blitz-answer" data-v="1">Richtig ${icon('right')}</button>
    </div>`);
  G.keys = (e) => { if (e.key === 'ArrowLeft') blitzAnswer(false); if (e.key === 'ArrowRight') blitzAnswer(true); };
  document.addEventListener('keydown', G.keys);
  gEvery(() => {
    const left = Math.max(0, G.s.end - Date.now());
    const t = $('#blitz-time'), b = $('#blitz-bar');
    if (t) t.textContent = Math.ceil(left / 1000);
    if (b) b.style.width = `${(left / 600).toFixed(1)}%`;
    if (!left) blitzFinish(set);
  }, 200);
  blitzNext(set);
}
function blitzNext(set) {
  const s = G.s;
  if (s.done) return;
  if (!s.queue || !s.queue.length) s.queue = shuffle(s.words.slice());
  const right = s.queue.pop();
  const fake = Math.random() < 0.5 ? misspell(right, set.lang) : null;
  s.card = { right, shown: fake || right, ok: !fake };
  s.busy = false;
  const st = $('#blitz-stage');
  if (!st) return;
  st.innerHTML = `<div class="blitz-card" id="blitz-card" lang="${set.lang}">${esc(s.card.shown)}</div>`;
  const el = $('#blitz-card');
  let x0 = null, dx = 0;
  el.addEventListener('pointerdown', (e) => { x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); });
  el.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    dx = e.clientX - x0;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    el.classList.toggle('tint-yes', dx > 40); el.classList.toggle('tint-no', dx < -40);
  });
  const up = () => {
    if (x0 == null) return;
    x0 = null; el.classList.remove('dragging');
    if (Math.abs(dx) > 80) blitzAnswer(dx > 0);
    else { el.style.transform = ''; el.classList.remove('tint-yes', 'tint-no'); }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
function blitzAnswer(saysRight) {
  const s = G.s;
  if (!s.card || s.busy || s.done) return;
  s.busy = true;
  const el = $('#blitz-card');
  const good = saysRight === s.card.ok;
  if (good) { s.score++; sfx.good(); } else { s.wrong++; sfx.bad(); }
  const sc = $('#blitz-score'); if (sc) sc.textContent = `${s.score} ${s.score === 1 ? 'Punkt' : 'Punkte'}`;
  if (el) {
    el.style.transform = `translateX(${saysRight ? 140 : -140}%) rotate(${saysRight ? 18 : -18}deg)`;
    el.classList.add('flying', good ? 'good' : 'bad');
  }
  const st = $('#blitz-stage');
  if (!good && st) st.insertAdjacentHTML('beforeend', `<p class="blitz-fix">${s.card.ok ? 'Das war richtig geschrieben:' : 'Richtig ist:'} <strong>${esc(s.card.right)}</strong></p>`);
  gLater(() => blitzNext(currentSet()), good ? 260 : 1300);
}
function blitzFinish(set) {
  const s = G.s;
  if (s.done) return;
  s.done = true;
  stopGame();
  const rec = gameRecord(set, 'blitz', s.score);
  sfx.win(); if (rec && s.score) confetti();
  const a = $('#game-area');
  if (a) a.innerHTML = gameEndHTML(rec && s.score ? 'Neuer Rekord!' : 'Zeit um!', `${s.score} richtig, ${s.wrong} daneben. Dein Rekord: ${set.progress.games.blitz.best}.`);
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
  gLater(() => speak(w.foreign, set.lang), 250);
}
function scrambleDraw() {
  const s = G.s;
  const sl = $('#scr-slots'), tl = $('#scr-tiles');
  if (!sl || !tl) return;
  sl.innerHTML = s.slots.map((x, k) => (x.fixed != null
    ? `<span class="scr-fixed ${x.fixed === ' ' ? 'gap' : ''}">${x.fixed === ' ' ? '' : esc(x.fixed)}</span>`
    : `<button class="scr-slot ${x.tile ? 'full' : ''} ${x.state || ''}" data-action="scr-slot" data-k="${k}" aria-label="${x.tile ? `Buchstabe ${esc(x.tile.c)} zurücklegen` : 'leeres Feld'}">${x.tile ? esc(x.tile.c) : ''}</button>`)).join('');
  tl.innerHTML = s.tiles.map((t) => `<button class="scr-tile" data-action="scr-tile" data-id="${t.id}" ${t.used ? 'disabled' : ''}>${t.used ? '' : esc(t.c)}</button>`).join('');
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
   ========================================================= */
const BALLOON_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];
function startBalloon(set) {
  const words = gameWords(set);
  Object.assign(G.s, { words, score: 0, lives: 3, level: 0, round: 0, done: false });
  $('#view').innerHTML = gameShell('Ballon-Platzen', `
    <div class="balloon-top"><span id="bl-score">0 Punkte</span><span id="bl-lives" aria-label="Leben">❤️❤️❤️</span></div>
    <div class="balloon-prompt" id="bl-prompt"></div>
    <div class="balloon-sky" id="bl-sky"></div>`);
  balloonRound(set);
}
function balloonRound(set) {
  const s = G.s;
  if (s.done) return;
  const sky = $('#bl-sky'), pr = $('#bl-prompt');
  if (!sky || !pr) return;
  const w = shuffle(s.words)[0];
  const count = s.level >= 4 ? 4 : 3;
  const others = shuffle(s.words.filter((x) => x !== w && gameForm(x).toLowerCase() !== gameForm(w).toLowerCase())).slice(0, count - 1);
  const opts = shuffle([w, ...others]);
  const dur = Math.max(3.5, 8 - s.level * 0.6);
  s.cur = { w, settled: false };
  pr.innerHTML = gamePrompt(set, w);
  const lanes = shuffle([...Array(opts.length).keys()]);
  sky.innerHTML = opts.map((o, k) => `<button class="balloon" data-action="bl-pop" data-ok="${o === w ? 1 : 0}" lang="${set.lang}"
      style="--lane:${lanes[k]};--lanes:${opts.length};--c:${BALLOON_COLORS[(s.round + k) % BALLOON_COLORS.length]};--dur:${dur}s;--delay:${(k * 0.35).toFixed(2)}s">
      <span>${esc(gameForm(o))}</span></button>`).join('');
  const ok = $('.balloon[data-ok="1"]', sky);
  ok?.addEventListener('animationend', () => { if (!s.cur.settled) { s.cur.settled = true; balloonMiss(set, 'weggeflogen'); } });
  s.round++;
}
function balloonPop(el) {
  const s = G.s;
  const set = currentSet();
  if (!s.cur || s.cur.settled || el.classList.contains('popped')) return;
  if (el.dataset.ok === '1') {
    s.cur.settled = true;
    el.classList.add('popped');
    s.score += 10 + s.level * 2;
    s.level++;
    sfx.good();
    const sc = $('#bl-score'); if (sc) sc.textContent = `${s.score} Punkte`;
    $$('.balloon:not(.popped)').forEach((b) => b.classList.add('fade'));
    gLater(() => balloonRound(set), 650);
  } else {
    el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle', 'wrong');
    el.disabled = true;
    balloonMiss(set, 'falsch', true);
  }
}
function balloonMiss(set, why, keepRound = false) {
  const s = G.s;
  s.lives--;
  sfx.bad();
  const lv = $('#bl-lives'); if (lv) lv.textContent = '❤️'.repeat(Math.max(0, s.lives)) + '🤍'.repeat(3 - Math.max(0, s.lives));
  if (s.lives <= 0) {
    s.done = true; s.cur.settled = true;
    stopGame();
    const rec = gameRecord(set, 'balloon', s.score);
    gLater(() => {
      const a = $('#game-area');
      if (a) a.innerHTML = gameEndHTML(rec && s.score ? 'Neuer Rekord!' : 'Alle Ballone weg!', `${s.score} Punkte. Das richtige Wort war „${esc(gameForm(s.cur.w))}“. Rekord: ${set.progress.games.balloon.best}.`);
      if (rec && s.score) confetti();
    }, 500);
    return;
  }
  if (!keepRound) gLater(() => balloonRound(set), 500);
}

/* =========================================================
   Rakete starten: Buchstaben raten, der Tank füllt sich
   ========================================================= */
const baseLetter = (c) => stripAccents(c).toLowerCase();
function startRocket(set) {
  const words = shuffle(gameWords(set).filter((w) => /\p{L}/u.test(gameForm(w)) && gameForm(w).length <= 24)).slice(0, 5);
  Object.assign(G.s, { words, i: 0, stars: 0 });
  $('#view').innerHTML = gameShell('Rakete starten', '<div id="rk"></div>');
  rocketWord(set);
}
function rocketWord(set) {
  const s = G.s;
  const box = $('#rk');
  if (!box) return;
  if (s.i >= s.words.length) {
    const rec = gameRecord(set, 'rocket', s.stars);
    sfx.win(); confetti();
    box.innerHTML = gameEndHTML('Alle Raketen gestartet!', `Du hast ${s.stars} von ${s.words.length * 3} Sternen gesammelt.${rec ? ' Neuer Rekord!' : ''}`);
    return;
  }
  const w = s.words[s.i];
  const target = gameForm(w);
  const need = new Set([...target].filter((c) => /\p{L}/u.test(c)).map(baseLetter));
  Object.assign(s, { w, target, need, got: new Set(), wrong: new Set(), launched: false });
  const keys = 'abcdefghijklmnopqrstuvwxyz'.split('');
  box.innerHTML = `<div class="test-card rocket-card">
    <p class="progress-label"><span>Rakete ${s.i + 1} von ${s.words.length}</span><span id="rk-stars"></span></p>
    <div class="rocket-wrap"><div class="rocket-tank"><i id="rk-fuel"></i></div><div class="rocket" id="rk-rocket" aria-hidden="true">🚀</div></div>
    ${gamePrompt(set, w, 'small')}
    <div class="rk-word" id="rk-word" lang="${set.lang}"></div>
    <div class="rk-keys">${keys.map((k) => `<button class="rk-key" data-action="rk-key" data-k="${k}">${k}</button>`).join('')}</div>
  </div>`;
  if (G.keys) document.removeEventListener('keydown', G.keys);
  G.keys = (e) => { if (/^[a-zA-Z]$/.test(e.key)) rocketGuess(e.key.toLowerCase()); };
  document.addEventListener('keydown', G.keys);
  rocketDraw();
}
function rocketStars() { return Math.max(0, 3 - Math.floor(G.s.wrong.size / 2)); }
function rocketDraw() {
  const s = G.s;
  const wd = $('#rk-word');
  if (!wd) return;
  wd.innerHTML = [...s.target].map((c) => (!/\p{L}/u.test(c) ? `<span class="rk-fix">${c === ' ' ? '&nbsp;' : esc(c)}</span>`
    : `<span class="rk-l ${s.got.has(baseLetter(c)) || s.launched ? 'shown' : ''}">${s.got.has(baseLetter(c)) || s.launched ? esc(c) : ''}</span>`)).join('');
  const f = $('#rk-fuel'); if (f) f.style.height = `${(100 * s.got.size / Math.max(1, s.need.size)).toFixed(0)}%`;
  const st = $('#rk-stars'); if (st) st.textContent = '⭐'.repeat(rocketStars()) + '☆'.repeat(3 - rocketStars());
  $$('.rk-key').forEach((b) => {
    const k = b.dataset.k;
    b.disabled = s.got.has(k) || s.wrong.has(k) || s.launched;
    b.classList.toggle('hit', s.got.has(k)); b.classList.toggle('miss', s.wrong.has(k));
  });
}
function rocketGuess(k) {
  const s = G.s;
  if (!s.need || s.launched || s.got.has(k) || s.wrong.has(k)) return;
  if (s.need.has(k)) { s.got.add(k); sfx.good(); } else { s.wrong.add(k); sfx.flip(); }
  rocketDraw();
  if ([...s.need].every((x) => s.got.has(x))) {
    s.launched = true;
    s.stars += rocketStars();
    rocketDraw();
    $('#rk-rocket')?.classList.add('launch');
    sfx.win();
    speak(s.w.foreign, currentSet().lang);
    gLater(() => { s.i++; rocketWord(currentSet()); }, 2200);
  }
}

/* =========================================================
   Wortsuchsel (auch als PDF)
   ========================================================= */
const searchKey = (w) => stripAccents(core(gameForm(w), currentSet()?.lang || 'en')).toUpperCase().replace(/[^A-Z]/g, '');
function buildWordSearch(words, size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placed = [];
  const dirs = [[0, 1], [1, 0]];
  for (const w of words) {
    const key = w.key;
    let ok = false;
    for (let t = 0; t < 200 && !ok; t++) {
      const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
      const maxR = dr ? size - key.length : size - 1, maxC = dc ? size - key.length : size - 1;
      if (maxR < 0 || maxC < 0) break;
      const r0 = Math.floor(Math.random() * (maxR + 1)), c0 = Math.floor(Math.random() * (maxC + 1));
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
  const puzzle = buildWordSearch(words, size);
  Object.assign(G.s, { puzzle, found: new Set(), sel: null });
  $('#view').innerHTML = gameShell('Wortsuchsel', `<div class="search-wrap">
    <div class="ws-grid" id="ws-grid" style="--n:${size}">${puzzle.grid.map((row, r) => row.map((ch, c) => `<span class="ws-cell" data-r="${r}" data-c="${c}">${ch}</span>`).join('')).join('')}</div>
    <div class="ws-side">
      <p class="label">Finde diese Wörter (auf ${LANGS[set.lang].name}):</p>
      <ul class="ws-list" id="ws-list">${puzzle.placed.map((p, i) => `<li data-i="${i}">${hasPicture(p.w, set.lang) ? picHTML(p.w, set.lang, 'mini') : ''}<span lang="de">${esc(p.w.german || '?')}</span><b lang="${set.lang}"></b></li>`).join('')}</ul>
      <p class="hint">Zieh mit dem Finger über das Wort – oder tippe auf den ersten und den letzten Buchstaben. Die Wörter stehen von links nach rechts oder von oben nach unten.</p>
      <button class="btn secondary" data-action="ws-pdf" id="ws-pdf">${icon('down')} Als PDF zum Ausdrucken</button>
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
  const i = s.puzzle.placed.findIndex((p, k) => !s.found.has(k) && p.key === word && p.r === cells[0]?.r && p.c === cells[0]?.c);
  $$('.ws-cell.sel').forEach((e) => e.classList.remove('sel'));
  if (i < 0) { if (cells.length > 1) sfx.flip(); return; }
  s.found.add(i);
  cells.forEach(({ r, c }) => $(`.ws-cell[data-r="${r}"][data-c="${c}"]`)?.classList.add('found', `f${i % 6}`));
  const li = $(`#ws-list li[data-i="${i}"]`);
  if (li) { li.classList.add('done'); $('b', li).textContent = gameForm(s.puzzle.placed[i].w); }
  sfx.good();
  speak(s.puzzle.placed[i].w.foreign, set.lang);
  if (s.found.size === s.puzzle.placed.length) {
    gameRecord(set, 'search', s.found.size);
    sfx.win(); confetti();
    gLater(() => { const a = $('.ws-side .hint'); if (a) a.innerHTML = `<strong>Alle Wörter gefunden! 🎉</strong> <button class="btn small primary" data-action="game-again">Neues Gitter</button>`; }, 600);
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

/* ---------- Einstellung: Spiele für die Kinder ein-/ausschalten (eigene Portion) ---------- */
function gamesSettingsHTML(set) {
  if (!set || !isOwnSet(set)) return '';
  const off = new Set(set.gamesOff || []);
  return `<details class="games-settings">
    <summary>${icon('sliders')} Spiele für die Kinder ein- und ausschalten <small class="muted">(${GAMES.length - off.size} von ${GAMES.length} an)</small></summary>
    <div class="games-toggles">${GAMES.map((g) => `<label class="switch"><input type="checkbox" data-game-toggle="${g.id}" ${off.has(g.id) ? '' : 'checked'}><span>${g.art} ${esc(g.name)}</span></label>`).join('')}</div>
    <p class="hint">Gilt auch für deine Klassen und für Portionen, die du per Link oder QR-Code teilst. Spiele zählen nicht für die Auswertung.</p>
  </details>`;
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
  'game-again': () => { stopGame(); renderGame(); },
  'blitz-answer': (el) => blitzAnswer(el.dataset.v === '1'),
  'scr-play': (el) => { const w = G.s.w; if (w) speak(w.foreign, currentSet().lang, { slow: !!el.dataset.slow }); },
  'scr-tile': (el) => scrambleTile(+el.dataset.id),
  'scr-slot': (el) => scrambleSlot(+el.dataset.k),
  'scr-hint': () => scrambleHint(),
  'scr-skip': () => { G.s.i++; scrambleWord(currentSet()); },
  'bl-pop': (el) => balloonPop(el),
  'rk-key': (el) => rocketGuess(el.dataset.k),
  'ws-pdf': () => searchPDF(),
  'duel-tap': (el) => duelTap(el),
};
