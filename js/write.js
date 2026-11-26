/* Vokaboom – Übung „Schreiben“ (Nr. 2 im Lernweg)
 * Ein Wort wird gezeigt, das Kind schreibt die Übersetzung. Oben wählbar:
 *   Deutsch → Fremdsprache (das deutsche Wort steht da, man schreibt das englische/französische) oder umgekehrt.
 * Pro Wort 3 Versuche; nach dem dritten falschen kommt die Lösung. Wer nicht gleich beim ersten Mal richtig
 * schreibt, hat das Wort für die Lernkarten-Berechnung „nicht gewusst“. Falsche Wörter kommen kurz darauf noch einmal. Zählt für Wiederholen (Vergessenskurve) und Münzen.
 */
'use strict';

const WR_DIR_KEY = 'vokaboom.writeDir';
const wr = { ids: [], queue: [], total: 0, firstTry: new Map(), checked: false, status: '', timer: null, finished: false, dir: 'de' };
function wrDir() { try { return localStorage.getItem(WR_DIR_KEY) === 'fx' ? 'fx' : 'de'; } catch { return 'de'; } }

function startWrite(set, ids) {
  wr.dir = wrDir();
  wr.ids = ids || set.words.filter((w) => w.foreign && w.german).map((w) => w.id);
  wr.queue = shuffle(wr.ids);
  wr.total = wr.queue.length;
  wr.firstTry = new Map();
  wr.finished = false;
  wrReset();
}
const WR_TRIES = 3; // so oft darf man ein Wort versuchen, dann kommt die Lösung
function wrReset() { wr.checked = false; wr.status = ''; wr.tries = 0; clearTimeout(wr.timer); }
const wrWord = (set) => set.words.find((w) => w.id === wr.queue[0]);
const wrOk = () => [...wr.firstTry.values()].filter(Boolean).length;
/** was gezeigt wird und was geschrieben werden muss */
function wrPair(set, w) {
  return wr.dir === 'de'
    ? { show: w.german, showLang: 'de', want: w.foreign, wantLang: set.lang }
    : { show: w.foreign, showLang: set.lang, want: w.german, wantLang: 'de' };
}

function renderWrite() {
  const set = currentSet();
  const v = $('#view');
  const L = LANGS[set.lang].name;
  const dirSeg = `<div class="seg wr-dir" role="radiogroup" aria-label="Richtung">
      <button class="seg-btn" data-action="wr-dir" data-dir="de" role="radio" aria-pressed="${wr.dir === 'de'}">Deutsch → ${esc(L)}</button>
      <button class="seg-btn" data-action="wr-dir" data-dir="fx" role="radio" aria-pressed="${wr.dir === 'fx'}">${esc(L)} → Deutsch</button>
    </div>`;
  const bar = `<div class="mode-bar"><h1 class="mode-title">Schreiben</h1>${dirSeg}</div>`;
  if (!wr.total) {
    v.innerHTML = `<section class="mode wr-mode">${bar}<p class="empty">In dieser Portion gibt es keine Wörter mit Übersetzung.</p></section>`;
    return;
  }
  if (wr.finished) {
    const ok = wrOk(), hard = [...wr.firstTry].filter(([, k]) => !k).map(([id]) => id), pct = wr.total ? ok / wr.total : 0;
    v.innerHTML = `<section class="mode wr-mode">${bar}
      <div class="result">
        ${stars(pct >= 0.9 ? 3 : pct >= 0.6 ? 2 : 1)}
        <h2>${ok === wr.total ? 'Super, alles gleich richtig geschrieben!' : 'Gut geschrieben!'}</h2>
        <p class="result-line">${ok} von ${wr.total} Wörtern gleich beim ersten Mal richtig.</p>
        ${hard.length ? `<ul class="word-chips">${wordsById(set, hard).map((w) => `<li><span lang="${set.lang}">${esc(w.foreign)}</span> <span class="muted" lang="de">${esc(w.german)}</span></li>`).join('')}</ul>` : ''}
        <div class="row center">
          ${hard.length ? `<button class="btn primary" data-action="wr-again" data-which="hard">${icon('pencil2')} Diese ${hard.length} nochmal</button>` : ''}
          <button class="btn ${hard.length ? 'secondary' : 'primary'}" data-action="wr-again" data-which="all">${icon('shuffle')} Alle nochmal</button>
          <button class="btn secondary" data-action="mode" data-mode="speak">Weiter: Aussprechen ${icon('right')}</button>
        </div>
      </div></section>`;
    return;
  }
  const w = wrWord(set);
  if (!w) { finishWrite(set); return; }
  const P = wrPair(set, w);
  const done = wr.total - wr.queue.length;
  v.innerHTML = `<section class="mode wr-mode">${bar}
    ${progressBar(done / wr.total, 'Fortschritt')}
    <p class="progress-label"><span>Noch ${wr.queue.length} ${wr.queue.length === 1 ? 'Wort' : 'Wörter'}</span><span class="tally"><b class="ok">${icon('check')} ${wrOk()}</b></span></p>
    <div class="test-card wr-card">
      <p class="q-kind">${icon('pencil2')} Schreib das Wort auf ${P.wantLang === 'de' ? 'Deutsch' : esc(L)}.</p>
      <div class="q-prompt"><p class="wr-show" lang="${P.showLang}">${esc(P.show)}</p></div>
      <form class="answer-form" id="w-form" autocomplete="off">
        <input id="w-answer" type="text" lang="${P.wantLang}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="${P.wantLang === 'de' ? 'Auf Deutsch …' : `Auf ${esc(L)} …`}" aria-label="Deine Antwort">
        <button class="btn primary" type="submit" id="w-submit">Prüfen</button>
      </form>
      <div id="w-feedback" class="feedback" aria-live="polite"></div>
      <div class="row center" id="w-more"><button class="btn ghost small" data-action="wr-unknown">Weiß ich nicht</button></div>
    </div>
  </section>`;
  $('#w-form').addEventListener('submit', (e) => { e.preventDefault(); wr.checked ? nextWrite() : checkWrite(); });
  setTimeout(() => $('#w-answer')?.focus(), 60);
}

/* ---------- Prüfen ---------- */
/** Mehrere Bedeutungen („leben, wohnen“, „gross / hoch“): ausserhalb von Klammern an , ; / trennen */
function wrParts(text) {
  const out = []; let cur = '', depth = 0;
  for (const ch of String(text || '')) {
    if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
    if (!depth && (ch === ',' || ch === ';' || ch === '/')) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
const wrBetter = (a, b) => { const rank = { correct: 2, almost: 1, wrong: 0 }; return !a || rank[b.status] > rank[a.status] ? b : a; };
/**
 * Auf Deutsch schreiben: Hier geht es um die Bedeutung, nicht um deutsche Rechtschreibung. Darum gilt:
 * EINE der Bedeutungen reicht, der Artikel (der/die/das/ein …) und „sich“ dürfen fehlen, Gross-/Kleinschreibung
 * und ss/ß sind egal. Ein Tippfehler gibt „fast richtig“.
 */
function wrCheckGerman(input, german) {
  const norm = (x) => String(x || '').toLowerCase().replace(/ß/g, 'ss').replace(/\([^)]*\)/g, ' ').replace(/[.!?…]+$/g, '').replace(/\s+/g, ' ').trim();
  const bare = (x) => x.replace(/^(der|die|das|den|dem|ein|eine|einen|einem|einer|sich|zu|etwas|jemanden|jemandem|jdn\.?|jdm\.?|etw\.?)\s+/, '').trim();
  const mine = norm(input);
  if (!mine) return { status: 'wrong', note: 'Keine Antwort.' };
  const targets = new Set();
  for (const p of [german, ...wrParts(german)]) { const n = norm(p); if (n) { targets.add(n); targets.add(bare(n)); targets.add(bare(bare(n))); } }
  let best = null;
  for (const t of targets) {
    if (!t) continue;
    for (const m of new Set([mine, bare(mine)])) {
      if (m === t) return { status: 'correct' };
      best = wrBetter(best, checkAnswerBase(m, { foreign: t }));
    }
  }
  return best && best.status !== 'wrong' ? { status: 'almost', note: 'Fast! Ein kleiner Rechtschreibfehler.' } : { status: 'wrong' };
}
/** Nur Gross-/Kleinschreibung anders („winner“ statt „Winner“): zählt als richtig, mit einem kleinen Hinweis */
const wrCaseOk = (r) => (r.status === 'almost' && r.note === 'Fast! Achte auf die Groß- und Kleinschreibung.' ? { status: 'correct', hint: 'Achte noch auf die Gross- und Kleinschreibung.' } : r);
/** In der Fremdsprache schreiben: wie bisher; zusätzlich reicht bei mit Komma getrennten Wörtern („grandma, grandmother“) eines davon */
function wrCheckForeign(input, w) {
  const r = wrCaseOk(checkAnswer(input, w));
  if (r.status === 'correct') return r;
  const parts = wrParts(w.foreign);
  if (parts.length < 2 || /[.!?]/.test(w.foreign) || !/[,;]/.test(w.foreign)) return r;
  let best = r;
  for (const p of parts) best = wrBetter(best, wrCaseOk(checkAnswer(input, { ...w, foreign: p })));
  return best;
}

function checkWrite(giveUp = false) {
  const set = currentSet(), w = wrWord(set), input = $('#w-answer');
  if (!w || !input || wr.checked) return;
  if (!giveUp && !input.value.trim()) { input.focus(); input.classList.add('nudge'); setTimeout(() => input.classList.remove('nudge'), 400); return; }
  const P = wrPair(set, w);
  const r = giveUp ? { status: 'wrong' } : wr.dir === 'de' ? wrCheckForeign(input.value, w) : wrCheckGerman(input.value, w.german);
  // zählt für die Lernkarten (Vergessenskurve) nur beim ersten Versuch: falsch beim 1. Mal = nicht gewusst
  if (!wr.firstTry.has(w.id)) { wr.firstTry.set(w.id, r.status === 'correct'); trackWord(set, w.id, 'write', r.status); }
  wr.tries = (wr.tries || 0) + 1;
  if (r.status === 'wrong' && !giveUp && wr.tries < WR_TRIES) {
    const left = WR_TRIES - wr.tries;
    $('#w-feedback').innerHTML = `<div class="banner bad">${icon('x')}<div><strong>Noch nicht richtig.</strong> Versuch es nochmal – du hast noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}.</div></div>`;
    sfx.bad();
    input.classList.add('wrong', 'nudge'); setTimeout(() => input.classList.remove('nudge'), 400);
    input.select(); input.focus();
    input.addEventListener('input', () => input.classList.remove('wrong'), { once: true });
    return;
  }
  wr.checked = true; wr.status = r.status;
  input.readOnly = true; input.classList.add(r.status);
  $('#w-submit').innerHTML = `Weiter ${icon('right')}`;
  $('#w-more')?.remove();
  const sol = `<span class="solution"><strong lang="${P.wantLang}">${esc(P.want)}</strong>${P.wantLang === 'de' ? '' : sayBtn(P.want, set.lang)}</span>`;
  $('#w-feedback').innerHTML = (r.status === 'correct' ? `<div class="banner good">${icon('check')}<div><strong>Richtig!</strong> ${sol}${r.hint ? ` <span class="small">${esc(r.hint)}</span>` : ''}</div></div>`
    : r.status === 'almost' ? `<div class="banner almost">${icon('pencil2')}<div><strong>${esc(r.note || 'Fast richtig!')}</strong> Richtig ist: ${sol}</div></div>`
      : `<div class="banner bad">${icon('x')}<div><strong>Leider falsch.</strong> Richtig ist: ${sol}</div></div>`)
    + (r.status === 'wrong' ? '<p class="muted small center">Das Wort kommt gleich noch einmal.</p>' : '');
  (r.status === 'correct' ? sfx.good : r.status === 'almost' ? sfx.almost : sfx.bad)();
  const t = $('.wr-mode .tally .ok'); if (t) t.innerHTML = `${icon('check')} ${wrOk()}`;
  $('#w-submit').focus();
  if (r.status === 'correct' && !r.hint) { const id = w.id; wr.timer = setTimeout(() => { if (ui.view === 'write' && wr.checked && wr.queue[0] === id) nextWrite(); }, AUTO_NEXT_MS); }
}
function nextWrite() {
  clearTimeout(wr.timer);
  const id = wr.queue.shift();
  if (wr.status === 'wrong') wr.queue.splice(Math.min(wr.queue.length, 2 + Math.floor(Math.random() * 2)), 0, id);
  wrReset();
  const set = currentSet();
  if (!wr.queue.length) finishWrite(set); else renderWrite();
}
function finishWrite(set) {
  wr.finished = true;
  const ok = wrOk();
  saveProgress(set, 'write', { correct: ok, total: wr.total, dir: wr.dir, date: Date.now() });
  sfx.win();
  if (wr.total && ok / wr.total >= 0.8) confetti();
  renderWrite();
}

const writeActions = {
  'wr-dir': (el) => {
    const d = el.dataset.dir === 'fx' ? 'fx' : 'de';
    try { localStorage.setItem(WR_DIR_KEY, d); } catch { /* egal */ }
    startWrite(currentSet()); renderWrite();
  },
  'wr-unknown': () => checkWrite(true),
  'wr-again': (el) => {
    const set = currentSet(), hard = [...wr.firstTry].filter(([, ok]) => !ok).map(([id]) => id);
    startWrite(set, el.dataset.which === 'hard' && hard.length ? hard : null); renderWrite();
  },
};
