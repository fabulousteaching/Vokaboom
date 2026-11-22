/* Vokaboom – Hör-Detektiv
 * Vokaboom spricht ein Wort, das Kind tippt die passende Karte an. 10 Fälle in einer Akte:
 * Fall 1–4: 4 Bildkarten · Fall 5–7: 6 Karten mit ähnlich klingenden Wörtern · Fall 8–10: Wortkarten ohne Bild.
 * Beim ersten Versuch gelöst: 3 Punkte, beim zweiten 1 Punkt.
 */
'use strict';

const DET_CASES = 10;

function startDetective(set) {
  stopGame();
  G.id = 'det';
  const words = gameWords(set);
  Object.assign(G.s, { set, lang: langOf(set), words, pk: makePicker(words), case: 0, score: 0, first: 0, tries: 0, results: [], done: false, busy: false });
  const canSay = typeof canSpeak === 'function' && canSpeak();
  $('#view').innerHTML = gameShell('Hör-Detektiv', `
    <div class="det-file">
      <div class="det-head">
        <span class="det-stamp">AKTE</span>
        <strong id="det-case">Fall 1 von ${DET_CASES}</strong>
        <span class="det-prints" id="det-prints" aria-label="Gelöste Fälle">${'<i></i>'.repeat(DET_CASES)}</span>
        <span class="det-score" id="det-score">0 Punkte</span>
      </div>
      ${canSay ? '' : '<p class="banner bad small">Dieses Gerät kann nicht vorlesen – für den Hör-Detektiv braucht es Ton.</p>'}
      <div class="det-listen">
        <button class="det-play" id="det-play" data-action="det-play" aria-label="Wort anhören">${icon('speaker', 'big')}<span>Anhören</span></button>
        <button class="btn ghost small" data-action="det-play" data-slow="1">${icon('snail')} Langsam</button>
        <p class="det-hint" id="det-hint">Hör genau hin – welche Karte passt?</p>
      </div>
      <div class="det-cards" id="det-cards"></div>
      <div class="det-end" id="det-end" hidden></div>
    </div>`);
  const top = $('.det-file'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  detCase();
}

function detCase() {
  const s = G.s;
  if (s.done) return;
  s.case++; s.tries = 0; s.busy = false;
  $('#det-case').textContent = `Fall ${s.case} von ${DET_CASES}`;
  const w = pickNext(s.pk);
  s.cur = w;
  const n = Math.min(s.case <= 4 ? 4 : 6, s.words.length);
  const noPic = s.case >= 8;
  // ähnlich klingende Wörter zuerst (ab Fall 5)
  const key = (x) => gameForm(x).toLowerCase();
  let others = s.words.filter((x) => x !== w && key(x) !== key(w) && (x.german || '').toLowerCase() !== (w.german || '').toLowerCase());
  others = s.case >= 5 ? others.map((x) => ({ x, d: lev(key(x), key(w)) + Math.random() * 1.5 })).sort((a, b) => a.d - b.d).map((o) => o.x) : shuffle(others);
  const cards = shuffle([w, ...others.slice(0, n - 1)]);
  s.cards = cards;
  const withPic = !noPic && cards.every((c) => hasPicture(c, s.lang));
  $('#det-cards').className = `det-cards n${cards.length} ${withPic ? 'pics' : 'words'}`;
  $('#det-cards').innerHTML = cards.map((c, i) => `<button class="det-card" data-action="det-pick" data-i="${i}" style="--d:${i * 0.05}s">
      ${withPic ? `<span class="det-pic">${picHTML(c, s.lang, 'card-pic')}</span>` : ''}<span class="det-de" lang="de">${esc(c.german || '?')}</span>
      <span class="det-mark" aria-hidden="true"></span></button>`).join('');
  $('#det-hint').textContent = noPic ? 'Jetzt ohne Bilder: Welches deutsche Wort passt?' : s.case >= 5 ? 'Achtung, die Wörter klingen ähnlich!' : 'Hör genau hin – welche Karte passt?';
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
    el.insertAdjacentHTML('beforeend', `<span class="det-solved">GELÖST</span><span class="det-word" lang="${s.lang}">${esc(gameForm(s.cur))}</span>`);
    sfx.good();
    detProgress();
    gLater(() => { if (s.case >= DET_CASES) detEnd(); else detCase(); }, 1500);
  } else {
    el.classList.add('no');
    el.insertAdjacentHTML('beforeend', `<span class="det-word wrong" lang="${s.lang}">${esc(gameForm(c))}</span>`);
    sfx.bad();
    if (s.tries >= 2) { // zweiter Fehler: Lösung zeigen
      s.busy = true;
      s.results.push('no');
      markResult(s.pk, s.cur, false);
      const j = s.cards.indexOf(s.cur);
      $$('.det-card')[j]?.classList.add('show');
      $$('.det-card')[j]?.insertAdjacentHTML('beforeend', `<span class="det-word" lang="${s.lang}">${esc(gameForm(s.cur))}</span>`);
      detProgress();
      gLater(() => { if (s.case >= DET_CASES) detEnd(); else detCase(); }, 2000);
    }
  }
  $('#det-score').textContent = `${s.score} Punkte`;
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
  'det-pick': (el) => detPick(+el.dataset.i),
};
