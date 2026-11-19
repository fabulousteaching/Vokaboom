/* Vokaboom – Wiederholen nach der Vergessenskurve (Lernkartei mit 5 Fächern)
 *
 * Jedes Wort wandert durch 5 Fächer: richtig → ein Fach weiter, falsch → zurück ins 1. Fach.
 * Fach 1: morgen · 2: in 3 Tagen · 3: in 1 Woche · 4: in 2 Wochen · 5: in 1 Monat („sicher“).
 * Gespeichert pro Wort im Übungsstand: set.progress.words[wid].box (1–5), .due (Zeitpunkt), .rt (zuletzt wiederholt).
 * Alle Übungen zählen mit (Lernkarten nur zum Aufnehmen, weil sich die Kinder dort selbst einschätzen).
 * Die Wiederholungsrunde: Deutsch sehen → Fremdsprache eintippen (oder aus 4 auswählen, je nach Klasse).
 */
'use strict';

const SRS_DAYS = [0, 1, 3, 7, 14, 30]; // Fach 1–5
const SRS_DAY = 864e5;
const SRS_ROUND = 20; // höchstens so viele Wörter pro Runde
const dayStart = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const inDays = (n, t = Date.now()) => { const d = new Date(dayStart(t)); d.setDate(d.getDate() + n); return d.getTime(); };

/** Nach jeder Antwort (aus trackWord): Wort im Kasten weiterschieben */
function srsUpdate(s, mode, result) {
  const now = Date.now(), box = s.box || 0;
  if (mode === 'review') s.rt = now;
  if (result === 'wrong') { s.box = 1; s.due = inDays(1, now); return; }
  if (!box) { s.box = 1; s.due = inDays(1, now); return; } // neu im Kasten: morgen das erste Mal
  if (mode === 'cards') return; // selbst eingeschätzt: schiebt nicht weiter
  if (result === 'almost') { if ((s.due || 0) <= now) s.due = inDays(1, now); return; } // fast: nochmals morgen, Fach bleibt
  if ((s.due || 0) > now) return; // heute schon gekonnt, noch nicht fällig: nichts ändern
  s.box = Math.min(5, box + 1);
  s.due = inDays(SRS_DAYS[s.box], now);
}

/** Alle fälligen Wörter (heute oder früher) über alle Portionen */
function srsItems(when = Date.now()) {
  const end = inDays(1, when) - 1;
  const due = [];
  let inBox = 0, safe = 0, tomorrow = 0, today = false;
  const t0 = dayStart(when);
  const tEnd = inDays(2, when) - 1;
  for (const set of srsSets()) {
    const pw = set.progress?.words || {};
    for (const w of set.words) {
      const s = pw[w.id];
      if (!s?.box || !w.foreign) continue;
      inBox++;
      if (s.box >= 5) safe++;
      if ((s.rt || 0) >= t0) today = true;
      if ((s.due || 0) <= end) due.push({ setId: set.id, wid: w.id, due: s.due || 0, box: s.box });
      else if ((s.due || 0) <= tEnd) tomorrow++;
    }
  }
  due.sort((a, b) => a.due - b.due || a.box - b.box);
  return { due, inBox, safe, tomorrow, today };
}
/** Welche Portionen zählen: Kinder alle freigegebenen, sonst die eigenen */
const srsSets = () => db.sets.filter((s) => s.words?.length && (isKid() || !s.shareId || s.progress?.words));

/** Wie die Kinder antworten: Eintippen (Standard) oder Auswählen – Lehrperson stellt es pro Klasse ein */
function reviewMode(cls) {
  const set = cls?.settings?.review;
  if (set === 'type' || set === 'choice') return set;
  const g = parseInt(String(cls?.name || '').match(/\d+/)?.[0] || '', 10); // „4b“ → 4
  return g >= 1 && g <= 4 ? 'choice' : 'type';
}
const kidReviewMode = () => (isKid() ? reviewMode({ name: kid.cls, settings: kid.clsSettings }) : 'type');

/* ---------------- Karte auf der Startseite ---------------- */
function reviewCardHTML() {
  const { due, inBox, safe, tomorrow, today } = srsItems();
  if (!inBox) return '';
  const n = due.length;
  const pct = Math.round((safe / inBox) * 100);
  return `<div class="rv-card ${n ? 'due' : 'done'}">
    <div class="rv-card-main">
      <span class="rv-icon" aria-hidden="true">${n ? '🧠' : '✅'}</span>
      <div>
        <strong>${n ? `Heute wiederholen: ${n} ${n === 1 ? 'Wort' : 'Wörter'}` : today ? 'Alles wiederholt für heute!' : 'Heute ist nichts zu wiederholen'}</strong>
        <small>${n ? 'Damit du die Wörter nicht wieder vergisst – dauert nur ein paar Minuten.' : tomorrow ? `Morgen ${tomorrow === 1 ? 'ist 1 Wort' : `sind ${tomorrow} Wörter`} dran.` : 'Komm in ein paar Tagen wieder vorbei.'}</small>
      </div>
      ${n ? `<button class="btn primary" data-action="review-start">${icon('flip')} Los geht's</button>` : ''}
    </div>
    <div class="rv-meter" title="${safe} von ${inBox} Wörtern sitzen sicher (5. Fach)">
      <span class="rv-meter-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <small><b>${safe}</b> von ${inBox} Wörtern sitzen sicher</small>
    </div>
  </div>`;
}

/* ---------------- Wiederholungsrunde ---------------- */
const RV = { items: [], idx: 0, mode: 'type', checked: false, results: [], opts: [], timer: null };

function startReview() {
  const { due } = srsItems();
  if (!due.length) { toast('Heute ist nichts mehr fällig. 🎉'); go('home'); return; }
  // fälligste zuerst, dann gemischt
  RV.items = shuffle(due.slice(0, SRS_ROUND));
  Object.assign(RV, { idx: 0, checked: false, results: [], mode: kidReviewMode() });
  go('review');
}
function rvItem() {
  const it = RV.items[RV.idx];
  const set = it && db.sets.find((s) => s.id === it.setId);
  const w = set?.words.find((x) => x.id === it.wid);
  return w ? { set, w } : null;
}
function renderReview() {
  const v = $('#view');
  if (!v) return;
  clearTimeout(RV.timer);
  if (RV.idx >= RV.items.length) { renderReviewDone(); return; }
  const cur = rvItem();
  if (!cur) { RV.idx++; renderReview(); return; }
  const { set, w } = cur;
  const lang = langOf(set);
  const total = RV.items.length;
  const pic = hasPicture(w, lang) ? `<div class="rv-pic">${picHTML(w, lang, 'card-pic')}</div>` : '';
  let answer;
  if (RV.mode === 'choice') {
    RV.opts = rvOptions(set, w);
    answer = `<div class="choices">${RV.opts.map((o, i) => `<button class="choice" data-action="review-choice" data-i="${i}" lang="${lang}"><kbd>${i + 1}</kbd><span>${esc(o.foreign)}</span></button>`).join('')}</div>`;
  } else {
    answer = `<form class="answer-form" id="rv-form" autocomplete="off">
      <input id="rv-answer" type="text" lang="${lang}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="${LANGS[lang].name} …" aria-label="Deine Antwort auf ${LANGS[lang].name}">
      <button class="btn primary" type="submit" id="rv-submit">Prüfen</button>
    </form>`;
  }
  v.innerHTML = `<section class="mode test-mode rv-mode">
    <div class="mode-bar"><h1 class="mode-title">Wiederholen</h1></div>
    ${progressBar(RV.idx / total, 'Fortschritt')}
    <p class="progress-label"><span>Wort ${RV.idx + 1} von ${total}</span><span class="tally"><b class="ok">${RV.results.filter((r) => r === 'correct').length} richtig</b></span></p>
    <div class="test-card">
      <p class="q-kind">${flag(lang)} ${esc(set.name)} · ${RV.mode === 'choice' ? `Was heisst das auf ${LANGS[lang].name}?` : `Schreib das Wort auf ${LANGS[lang].name}.`}</p>
      <div class="q-prompt">${pic}<p class="cw-german xl" lang="de">${esc(w.german)}</p></div>
      ${answer}
      <div id="rv-feedback" class="feedback" aria-live="polite"></div>
    </div>
  </section>`;
  RV.checked = false;
  const form = $('#rv-form');
  if (form) {
    form.addEventListener('submit', (e) => { e.preventDefault(); RV.checked ? reviewNext() : reviewCheck(); });
    setTimeout(() => $('#rv-answer')?.focus(), 60);
  }
}
/** 4 Möglichkeiten: das richtige Wort und 3 andere aus derselben Portion (sonst aus anderen derselben Sprache) */
function rvOptions(set, w) {
  const lang = langOf(set);
  const key = (x) => normAnswer(x.foreign);
  let pool = set.words.filter((x) => x.id !== w.id && x.foreign && key(x) !== key(w));
  if (pool.length < 3) pool = pool.concat(db.sets.filter((s) => s !== set && langOf(s) === lang).flatMap((s) => s.words).filter((x) => x.foreign && key(x) !== key(w)));
  const seen = new Set([key(w)]);
  const others = shuffle(pool).filter((x) => (seen.has(key(x)) ? false : seen.add(key(x)))).slice(0, 3);
  return shuffle([w, ...others]);
}
function reviewCheck() {
  const cur = rvItem();
  const input = $('#rv-answer');
  if (!cur || !input) return;
  if (!input.value.trim()) { input.focus(); input.classList.add('nudge'); setTimeout(() => input.classList.remove('nudge'), 400); return; }
  const r = checkAnswer(input.value, cur.w, langOf(cur.set));
  rvResult(cur, r.status, r.note);
  input.readOnly = true;
  input.classList.add(r.status);
  $('#rv-submit').innerHTML = `Weiter ${icon('right')}`;
  $('#rv-submit').focus();
}
function reviewChoice(i) {
  if (RV.checked) return;
  const cur = rvItem();
  const picked = RV.opts[i];
  if (!cur || !picked) return;
  const ok = picked.id === cur.w.id || normAnswer(picked.foreign) === normAnswer(cur.w.foreign);
  $$('.rv-mode .choice').forEach((b, j) => {
    b.disabled = true;
    if (RV.opts[j].id === cur.w.id) b.classList.add('correct');
    else if (j === i) b.classList.add('wrong');
  });
  rvResult(cur, ok ? 'correct' : 'wrong');
  $('#rv-feedback').insertAdjacentHTML('beforeend', `<div class="row center"><button class="btn primary" data-action="review-next" id="rv-next">Weiter ${icon('right')}</button></div>`);
  $('#rv-next')?.focus();
}
function rvResult(cur, status, note) {
  RV.checked = true;
  RV.results[RV.idx] = status;
  trackWord(cur.set, cur.w.id, 'review', status); // Fach weiterschieben, Münzen, speichern
  $('#rv-feedback').innerHTML = feedbackHTML(cur.set, cur.w, status, note);
  (status === 'correct' ? sfx.good : status === 'almost' ? sfx.almost : sfx.bad)();
  const t = $('.rv-mode .tally .ok'); if (t) t.textContent = `${RV.results.filter((r) => r === 'correct').length} richtig`;
  if (status === 'correct') { const idx = RV.idx; RV.timer = setTimeout(() => { if (ui.view === 'review' && RV.idx === idx && RV.checked) reviewNext(); }, AUTO_NEXT_MS); }
}
function reviewNext() {
  clearTimeout(RV.timer);
  if (typeof stopSpeaking === 'function') stopSpeaking();
  RV.idx++;
  renderReview();
  window.scrollTo({ top: 0 });
}
function renderReviewDone() {
  const ok = RV.results.filter((r) => r === 'correct').length, total = RV.results.length;
  const wrong = RV.items.map((it, i) => ({ it, r: RV.results[i] })).filter((x) => x.r && x.r !== 'correct');
  const { due, tomorrow, safe, inBox } = srsItems();
  if (total && ok / total >= 0.8 && typeof confetti === 'function') confetti();
  $('#view').innerHTML = `<section class="mode rv-mode rv-done">
    <div class="panel rv-result">
      <p class="rv-big" aria-hidden="true">${ok === total ? '🌟' : ok / Math.max(1, total) >= 0.6 ? '💪' : '🌱'}</p>
      <h1>${ok === total ? 'Super, alles gewusst!' : 'Gut wiederholt!'}</h1>
      <p class="lead">${ok} von ${total} ${total === 1 ? 'Wort' : 'Wörtern'} richtig.</p>
      ${wrong.length ? `<div class="rv-wrong"><p class="small muted">Diese Wörter kommen morgen nochmals:</p><ul>${wrong.map(({ it }) => {
        const set = db.sets.find((s) => s.id === it.setId); const w = set?.words.find((x) => x.id === it.wid);
        return w ? `<li><strong lang="${langOf(set)}">${esc(w.foreign)}</strong> <span class="muted">${esc(w.german)}</span></li>` : '';
      }).join('')}</ul></div>` : ''}
      <p class="small"><b>${safe}</b> von ${inBox} Wörtern sitzen jetzt sicher.${due.length ? '' : tomorrow ? ` Morgen ${tomorrow === 1 ? 'ist 1 Wort' : `sind ${tomorrow} Wörter`} dran.` : ''}</p>
      <div class="row center">
        ${due.length ? `<button class="btn primary" data-action="review-start">${icon('flip')} Noch ${due.length} ${due.length === 1 ? 'Wort' : 'Wörter'} wiederholen</button>` : ''}
        <button class="btn ${due.length ? 'ghost' : 'primary'}" data-action="home">Zur Startseite</button>
      </div>
    </div>
  </section>`;
}

/* ---------------- Lehrperson: Auswertung pro Kind ---------------- */
/** Aus dem Übungsstand eines Kindes (alle Portionen der Klasse): fällig, sicher, im Kasten, zuletzt wiederholt */
function kidSrsStats(progBySet, sets) {
  const end = inDays(1) - 1;
  let due = 0, safe = 0, inBox = 0, last = 0;
  for (const set of sets) {
    const pw = progBySet?.[set.id]?.words || {};
    for (const w of set.words) {
      const s = pw[w.id];
      if (!s?.box) continue;
      inBox++;
      if (s.box >= 5) safe++;
      if ((s.due || 0) <= end) due++;
      if (s.rt > last) last = s.rt;
    }
  }
  return { due, safe, inBox, last };
}

const reviewActions = {
  'review-start': () => startReview(),
  'review-choice': (el) => reviewChoice(+el.dataset.i),
  'review-next': () => reviewNext(),
};
