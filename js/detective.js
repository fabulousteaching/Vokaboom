/* Vokaboom – Hör-Detektiv
 * Vokaboom spricht ein Wort, das Kind tippt die passende Karte an. 10 Fälle in einer Akte:
 * Fall 1–4: 4 Bildkarten · Fall 5–7: 6 Karten mit ähnlich klingenden Wörtern · Fall 8–10: Wortkarten ohne Bild.
 * Beim ersten Versuch gelöst: 3 Punkte, beim zweiten 1 Punkt.
 * Design: Detektivlabor (Pinnwand, Schreibtisch, Lampe). Jeder Fall ist eine Akte: sie rutscht herein, klappt auf,
 * wird gestempelt (GELÖST / UNGELÖST), klappt zu und wandert auf den Stapel der erledigten Akten.
 */
'use strict';

const DET_CASES = 10;

const DET_MODE_KEY = 'vokaboom.detMode';
function startDetective(set) { detBegin(set, 'de'); }
function detBegin(set, mode) {
  stopGame();
  G.id = 'det';
  mode = mode === 'fx' ? 'fx' : 'de';
  try { localStorage.setItem(DET_MODE_KEY, mode); } catch { /* egal */ }
  const words = gameWords(set);
  Object.assign(G.s, { set, mode, lang: langOf(set), words, pk: makePicker(words), case: 0, score: 0, first: 0, tries: 0, results: [], done: false, busy: false });
  const canSay = typeof canSpeak === 'function' && canSpeak();
  $('#view').innerHTML = gameShell('Hör-Detektiv', `
    <div class="det-lab det-file">
      <div class="det-wall" aria-hidden="true">
        <span class="det-lamp"></span>
        <span class="det-note n1">🗺️</span><span class="det-note n2">🔍</span><span class="det-note n3">❓</span><span class="det-note n4">👣</span>
        <svg class="det-strings" viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M12 10 L40 20 L66 8 L88 18" fill="none" stroke="#C62828" stroke-width=".5"/></svg>
      </div>
      <div class="det-head">
        <span class="det-stamp">LABOR</span>
        <strong id="det-case">Fall 1 von ${DET_CASES}</strong>
        <span class="det-prints" id="det-prints" aria-label="Gelöste Fälle">${'<i></i>'.repeat(DET_CASES)}</span>
        <span class="det-score" id="det-score">0 Punkte</span>
      </div>
      ${canSay ? '' : '<p class="banner bad small">Dieses Gerät kann nicht vorlesen – für den Hör-Detektiv braucht es Ton.</p>'}
      <div class="det-desk">
        <div class="det-listen">
          <button class="det-play" id="det-play" data-action="det-play" aria-label="Wort anhören"><span class="det-reel" aria-hidden="true"></span>${icon('speaker', 'big')}<span>Anhören</span><span class="det-reel" aria-hidden="true"></span></button>
          <p class="det-hint" id="det-hint">Hör genau hin – welche Karte passt?</p>
        </div>
        <div class="det-slot" id="det-slot"></div>
        <div class="det-pile" id="det-pile" aria-label="Erledigte Akten"><b id="det-pile-n">0</b></div>
        <span class="det-glass" aria-hidden="true"></span>
      </div>
      <div class="det-end" id="det-end" hidden></div>
    </div>`);
  const top = $('.det-file'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  detCase();
}

function detCase() {
  const s = G.s;
  if (s.done) return;
  s.case++; s.tries = 0;
  $('#det-case').textContent = `Fall ${s.case} von ${DET_CASES}`;
  const w = pickNext(s.pk);
  s.cur = w;
  const n = Math.min(s.case <= 4 ? 4 : 6, s.words.length);
  const noPic = s.case >= 8 || s.mode === 'fx';
  // ähnlich klingende Wörter zuerst (ab Fall 5)
  const key = (x) => gameForm(x).toLowerCase();
  let others = s.words.filter((x) => x !== w && key(x) !== key(w) && (x.german || '').toLowerCase() !== (w.german || '').toLowerCase());
  others = s.case >= 5 ? others.map((x) => ({ x, d: lev(key(x), key(w)) + Math.random() * 1.5 })).sort((a, b) => a.d - b.d).map((o) => o.x) : shuffle(others);
  const cards = shuffle([w, ...others.slice(0, n - 1)]);
  s.cards = cards;
  const withPic = !noPic && cards.every((c) => hasPicture(c, s.lang));
  // neue Akte: rutscht geschlossen herein und klappt auf
  s.busy = true;
  const slot = $('#det-slot');
  slot.innerHTML = `<div class="det-folder enter" id="det-folder">
      <span class="det-tab">FALL ${s.case}</span>
      <div class="det-page"><span class="det-clip" aria-hidden="true"></span>
        <div class="det-cards n${cards.length} ${withPic ? 'pics' : 'words'}" id="det-cards">${cards.map((c, i) => `<button class="det-card" data-action="det-pick" data-i="${i}" style="--d:${0.55 + i * 0.06}s">
          ${withPic ? `<span class="det-pic">${picHTML(c, s.lang, 'card-pic')}</span>` : ''}${s.mode === 'fx' ? `<span class="det-de" lang="${s.lang}">${esc(gameForm(c))}</span>` : `<span class="det-de" lang="de">${esc(c.german || '?')}</span>`}
          <span class="det-mark" aria-hidden="true"></span></button>`).join('')}</div>
      </div>
      <div class="det-cover" aria-hidden="true"><span class="det-cover-t">AKTE</span><span class="det-cover-n">Fall ${s.case}</span><span class="det-secret">STRENG GEHEIM</span><span class="det-cover-print"></span></div>
    </div>`;
  const folder = $('#det-folder');
  gLater(() => { folder.classList.remove('enter'); folder.classList.add('open'); tone([392, 523], 0.06, 'triangle', 0.04); }, 420);
  gLater(() => { if (G.s === s) s.busy = false; }, 900);
  $('#det-hint').textContent = s.case >= 5 ? 'Achtung, die Wörter klingen ähnlich!' : 'Hör genau hin – welche Karte passt?';
  const play = $('#det-play'); play?.classList.add('pulse');
}
function detPlay(slow) {
  const s = G.s;
  if (!s.cur) return;
  $('#det-play')?.classList.remove('pulse');
  speak(gameForm(s.cur), s.lang, { slow: !!slow });
}
function detPick(i) {
  const s = G.s, c = s.cards?.[i], el = $$('.det-card')[i];
  if (!c || !el || s.busy || s.done || el.classList.contains('no')) return;
  s.tries++;
  if (c === s.cur) {
    s.busy = true;
    const pts = s.tries === 1 ? 3 : 1;
    s.score += pts; if (s.tries === 1) s.first++;
    s.results.push(s.tries === 1 ? 'ok' : 'late');
    markResult(s.pk, s.cur, s.tries === 1, s.tries === 1 ? 'correct' : 'almost'); // zweiter Versuch = „fast“
    el.classList.add('yes');
    el.insertAdjacentHTML('beforeend', detReveal(s.cur));
    sfx.good();
    detProgress();
    detClose(true);
  } else {
    el.classList.add('no');
    el.insertAdjacentHTML('beforeend', detReveal(c, true));
    sfx.bad();
    if (s.tries >= 2) { // zweiter Fehler: Lösung zeigen
      s.busy = true;
      s.results.push('no');
      markResult(s.pk, s.cur, false);
      const j = s.cards.indexOf(s.cur);
      $$('.det-card')[j]?.classList.add('show');
      $$('.det-card')[j]?.insertAdjacentHTML('beforeend', detReveal(s.cur));
      detProgress();
      detClose(false);
    }
  }
  $('#det-score').textContent = `${s.score} Punkte`;
}
/** Was nach dem Antippen auf der Karte erscheint: bei deutschen Karten das Wort in der Fremdsprache, sonst die Bedeutung */
function detReveal(w, wrong = false) {
  const s = G.s;
  return s.mode === 'fx'
    ? `<span class="det-word ${wrong ? 'wrong' : ''}" lang="de">${esc(w.german || '?')}</span>`
    : `<span class="det-word ${wrong ? 'wrong' : ''}" lang="${s.lang}">${esc(gameForm(w))}</span>`;
}
/** Akte zuklappen, dann drückt ein Stempel GELÖST/UNGELÖST auf den Deckel, dann auf den Stapel – und die nächste kommt */
function detClose(solved) {
  const s = G.s, folder = $('#det-folder');
  const t0 = solved ? 800 : 1800; // so lange bleibt die offene Akte sichtbar
  gLater(() => { folder?.classList.remove('open'); folder?.classList.add('closing'); tone([330, 262], 0.06, 'triangle', 0.04); }, t0);
  gLater(() => { // Stempel kommt von oben und drückt
    if (!folder) return;
    folder.insertAdjacentHTML('beforeend', `<span class="det-stamper ${solved ? 'ok' : 'no'}" aria-hidden="true"><i></i><b></b></span>`);
  }, t0 + 650);
  gLater(() => {
    if (!folder) return;
    folder.insertAdjacentHTML('beforeend', `<span class="det-bigstamp ${solved ? 'ok' : 'no'}">${solved ? 'GELÖST' : 'UNGELÖST'}</span>`);
    folder.classList.add('thud');
    tone(solved ? [150, 110] : [110, 80], 0.1, 'square', 0.08);
  }, t0 + 650 + 380);
  gLater(() => { folder?.classList.add('leave'); }, t0 + 650 + 1300);
  gLater(() => {
    const pile = $('#det-pile'), n = $('#det-pile-n');
    if (pile) { pile.insertAdjacentHTML('afterbegin', `<i class="${solved ? 'ok' : 'no'}" style="--r:${(Math.random() - 0.5) * 10}deg"></i>`); pile.classList.remove('bump'); void pile.offsetWidth; pile.classList.add('bump'); }
    if (n) n.textContent = String(s.case);
    if (s.case >= DET_CASES) detEnd(); else detCase();
  }, t0 + 650 + 1850);
}
function detProgress() {
  const s = G.s;
  $$('#det-prints i').forEach((el, i) => { el.className = s.results[i] || ''; });
}
function detEnd() {
  const s = G.s;
  s.done = true;
  const record = gameRecord(s.set, 'detective', s.score);
  const rank = s.first >= 9 ? ['🕵️', 'Meisterdetektiv!'] : s.first >= 6 ? ['🔎', 'Super Spürnase!'] : ['🐾', 'Gute Spurensuche!'];
  const box = $('#det-end');
  box.hidden = false;
  box.innerHTML = `<div class="det-endbox"><div class="det-rank">${rank[0]}</div><h2>${rank[1]}${record ? ' · Rekord!' : ''}</h2>
    <p class="lead"><b>${s.score}</b> Punkte · ${s.first} von ${DET_CASES} Fällen beim ersten Hinhören gelöst</p>
    <div class="row center"><button class="btn primary" data-action="game-again">${icon('shuffle')} Neue Akte</button><button class="btn ghost" data-action="games">Anderes Spiel</button></div></div>`;
  if (s.first >= 8 && typeof confetti === 'function') confetti();
}

const detActions = {
  'det-play': (el) => detPlay(el.dataset.slow === '1'),
  'det-start': (el) => detBegin(currentSet(), el.dataset.mode),
  'det-pick': (el) => detPick(+el.dataset.i),
};
