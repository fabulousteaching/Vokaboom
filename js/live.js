/* Vokaboom – Live in der Klasse: Quiz und Hör-Bingo
 * Starten kann jede erwachsene Person, mit oder ohne Konto (in einer eigenen oder per Link bekommenen Portion,
 * nicht im Kinder-Login und nicht in Portionen, die eine Klasse zugeteilt bekommt). Kinder machen mit einem Code oder QR-Code mit –
 * mit Kinder-Login (Name automatisch) oder ohne (Vorname eingeben).
 * Verbindung: Supabase Realtime „Broadcast“ (nichts wird gespeichert). Ohne Supabase: nur Fenster auf demselben Gerät.
 */
'use strict';

const LV = { role: '', code: '', ch: null, kind: '', set: null, players: new Map(), timers: [], me: null, st: {} };
const lvLater = (fn, ms) => { const t = setTimeout(fn, ms); LV.timers.push(t); return t; };
const lvEvery = (fn, ms) => { const t = setInterval(fn, ms); LV.timers.push(t); return t; };
const liveLocal = () => !cloudConfigured() || !!window.__liveLocal;
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
// Antwortfarben im Vokaboom-Stil: Indigo, Pink, Sonnengelb, Petrol – mit Buchstaben A–D
const QUIZ_COLORS = [['#4F46E5', 'A', '#fff'], ['#DB2777', 'B', '#fff'], ['#FFB703', 'C', '#161A33'], ['#0E9F8E', 'D', '#fff']];
const optStyle = (k) => `--c:${QUIZ_COLORS[k][0]};--fg:${QUIZ_COLORS[k][2]}`;

/** Kanal öffnen: Supabase Realtime, sonst BroadcastChannel (gleiches Gerät) */
async function liveChannel(code, onMsg) {
  if (liveLocal()) {
    const bc = new BroadcastChannel(`vokaboom-live-${code}`);
    bc.onmessage = (e) => onMsg(e.data);
    return { send: (m) => bc.postMessage(m), close: () => bc.close() };
  }
  const c = await cloudClient();
  const ch = c.channel(`vokaboom-live-${code}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload));
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), 12000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); reject(new Error(status)); }
    });
  });
  return { send: (m) => ch.send({ type: 'broadcast', event: 'm', payload: m }), close: () => { try { c.removeChannel(ch); } catch { /* */ } } };
}
function liveStop() {
  LV.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  LV.timers = [];
  try { LV.ch?.close(); } catch { /* */ }
  Object.assign(LV, { role: '', code: '', ch: null, kind: '', set: null, players: new Map(), me: null, st: {} });
}
const joinUrl = (code) => `${siteUrl()}#live=${code}`;

/* ---------- Einstellungen vor dem Start ---------- */
/** Wörter, die sich für das Spiel eignen */
function liveEligible(set, kind) {
  const seen = new Set();
  return set.words.filter((w) => {
    if (!w.foreign) return false;
    if (kind === 'quiz' && !(w.german || hasPicture(w, set.lang))) return false;
    const k = gameForm(w).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const liveSelected = () => liveEligible(LV.set, LV.kind).filter((w) => LV.cfg.ids.has(w.id));
function liveCfgSave() {
  db.settings.liveCfg = { n: LV.cfg.n, time: LV.cfg.time, auto: LV.cfg.auto };
  saveDB();
}
function liveProblem() {
  const sel = liveSelected().length;
  if (LV.kind === 'quiz') {
    if (liveEligible(LV.set, 'quiz').length < 4) return 'Das Quiz braucht mindestens 4 Vokabeln mit deutschem Wort oder Bild.';
    if (!sel) return 'Wähle mindestens ein Wort aus.';
  } else if (sel < 9) return `Hör-Bingo braucht mindestens 9 Wörter (ausgewählt: ${sel}).`;
  return '';
}
function liveSetupHTML() {
  const c = LV.cfg, all = liveEligible(LV.set, LV.kind), sel = liveSelected().length;
  const seg = (action, val, items) => `<div class="seg small" role="group">${items.map(([v, t]) => `<button class="seg-btn" data-action="${action}" data-v="${v}" aria-pressed="${String(val) === String(v)}">${t}</button>`).join('')}</div>`;
  const quiz = LV.kind === 'quiz';
  const nChoices = [5, 10, 15, 20].filter((n) => n < sel).map((n) => [n, String(n)]).concat([['all', `Alle (${sel})`]]);
  return `<div class="live-setup panel" id="live-setup">
    <h3>${icon('sliders')} Einstellungen</h3>
    ${quiz ? `<div class="ls-row"><span class="label">Anzahl Fragen</span>${seg('lv-n', c.n === 'all' || c.n >= sel ? 'all' : c.n, nChoices)}</div>
      <div class="ls-row"><span class="label">Zeit pro Frage</span>${seg('lv-time', c.time, [10, 15, 20, 30, 45, 60].map((t) => [t, `${t} s`]))}</div>`
      : `<div class="ls-row"><span class="label">Wörter vorlesen</span>${seg('lv-auto', c.auto, [[0, 'Von Hand'], [6, 'Alle 6 s'], [10, 'Alle 10 s'], [15, 'Alle 15 s']])}</div>`}
    <details class="ls-words" ${LV.ui?.wordsOpen ? 'open' : ''}>
      <summary>Welche Wörter? <small class="muted">(${sel} von ${all.length})</small></summary>
      <div class="row"><button class="btn small ghost" data-action="lv-words" data-v="all">Alle</button><button class="btn small ghost" data-action="lv-words" data-v="none">Keine</button></div>
      <div class="ls-grid">${all.map((w) => `<label class="ls-word"><input type="checkbox" data-lv-word="${w.id}" ${c.ids.has(w.id) ? 'checked' : ''}><span lang="${LV.set.lang}">${esc(gameForm(w))}</span><small lang="de">${esc(w.german || '')}</small></label>`).join('')}</div>
    </details>
    ${liveProblem() ? `<p class="small form-error">${esc(liveProblem())}</p>` : ''}
  </div>`;
}
function liveRefreshLobby() {
  if (LV.role !== 'host' || LV.st.phase !== 'lobby') return;
  const box = $('#live-setup'); if (box) box.outerHTML = liveSetupHTML();
  const start = $('[data-action="quiz-start"], [data-action="bingo-start"]');
  if (start) start.disabled = !LV.players.size || !!liveProblem();
}
document.addEventListener('change', (e) => {
  const id = e.target?.dataset?.lvWord;
  if (!id || LV.role !== 'host') return;
  if (e.target.checked) LV.cfg.ids.add(id); else LV.cfg.ids.delete(id);
  liveRefreshLobby();
});
document.addEventListener('toggle', (e) => { if (e.target?.classList?.contains('ls-words')) LV.ui = { ...(LV.ui || {}), wordsOpen: e.target.open }; }, true);

/* ---------- Start (mit oder ohne Konto, nicht als Kind) ---------- */
const mayHostLive = (set) => !!set && !isKid() && !set.assigned;
function liveStartHTML(set) {
  if (!mayHostLive(set)) return '';
  const n = set.words.filter((w) => w.foreign).length;
  return `<section class="live-start panel">
    <div><h2>${icon('user')} Live in der Klasse</h2>
      <p class="hint">Am Beamer starten, die Kinder machen auf ihren Geräten mit (Code oder QR-Code).</p></div>
    <div class="row">
      <button class="btn primary" data-action="live-host" data-kind="quiz" ${n >= 4 ? '' : 'disabled'}>🏁 Quiz starten</button>
      <button class="btn secondary" data-action="live-host" data-kind="bingo" ${n >= 9 ? '' : 'disabled'}>🔢 Hör-Bingo starten</button>
    </div>
    ${n < 9 ? `<p class="small muted">${n < 4 ? 'Das Quiz braucht mindestens 4 Vokabeln.' : 'Hör-Bingo braucht mindestens 9 Vokabeln.'}</p>` : ''}
  </section>`;
}

async function liveHost(kind) {
  const set = currentSet();
  if (!mayHostLive(set)) return;
  liveStop();
  const saved = db.settings.liveCfg || {};
  const elig = liveEligible(set, kind);
  Object.assign(LV, { role: 'host', kind, set, code: newCode(), players: new Map(), st: { phase: 'lobby' }, ui: {},
    cfg: { n: saved.n || 10, time: saved.time || 20, auto: saved.auto || 0, ids: new Set(elig.map((w) => w.id)) } });
  go('live');
  try {
    LV.ch = await liveChannel(LV.code, hostMsg);
  } catch (e) {
    $('#view').innerHTML = `<section class="mode"><p class="banner bad">${icon('x')} Die Live-Verbindung hat nicht geklappt (${esc(e.message)}). Bist du online?</p>
      <button class="btn ghost" data-action="open-set" data-id="${set.id}">Zurück</button></section>`;
    return;
  }
  lvEvery(() => hostBroadcastState(), 2500);
  renderLive();
}
function hostBroadcastState() {
  if (LV.role !== 'host' || !LV.ch) return;
  const s = LV.st, set = LV.set;
  const base = { t: 'state', kind: LV.kind, title: set.name, lang: set.lang, phase: s.phase };
  if (LV.kind === 'bingo') Object.assign(base, { words: liveSelected().map(gameForm), round: s.round || 1, calls: (s.called || []).length });
  if (LV.kind === 'quiz' && s.phase === 'q') Object.assign(base, { q: s.qMsg });
  LV.ch.send(base);
}
function hostMsg(m) {
  if (!m || LV.role !== 'host') return;
  if (m.t === 'join' && m.id) {
    if (!LV.players.has(m.id)) LV.players.set(m.id, { name: String(m.name || 'Kind').slice(0, 24), score: 0 });
    hostBroadcastState();
    if (LV.st.phase === 'lobby') { const pl = $('#live-players'); if (pl) pl.outerHTML = livePlayersHTML(); else renderLive(); liveRefreshLobby(); }
    else if (LV.kind === 'bingo') renderLive();
  }
  if (m.t === 'a' && LV.kind === 'quiz') quizAnswer(m);
  if (m.t === 'bingo' && LV.kind === 'bingo') bingoClaim(m);
}

/* ---------- Bildschirm der Lehrperson ---------- */
function renderLive() {
  const v = $('#view');
  if (LV.role === 'host') {
    if (!LV.set) { go('home'); return; }
    if (LV.kind === 'quiz') v.innerHTML = quizHostHTML(); else v.innerHTML = bingoHostHTML();
    return;
  }
  if (LV.role === 'player') { v.innerHTML = playerHTML(); bindPlayer(); return; }
  v.innerHTML = joinFormHTML(); bindJoinForm();
}
function livePlayersHTML() {
  const names = [...LV.players.values()].map((p) => p.name);
  return `<div class="live-players" id="live-players">
      <h2>${esc(LV.kind === 'quiz' ? `Quiz: ${LV.set.name}` : `Hör-Bingo: ${LV.set.name}`)}</h2>
      <p class="lead">${names.length} ${names.length === 1 ? 'Kind ist' : 'Kinder sind'} dabei</p>
      <div class="live-chips">${names.map((n) => `<span class="live-chip">${esc(n)}</span>`).join('') || '<span class="muted">Warte auf die ersten Kinder …</span>'}</div>
    </div>`;
}
function lobbyHTML() {
  const q = makeQR(joinUrl(LV.code));
  return `<div class="live-lobby">
    <div class="live-join-box">
      <p class="label">Mitmachen auf ${esc(location.host || 'Vokaboom')}</p>
      <p class="live-code">${LV.code.split('').join(' ')}</p>
      ${q ? `<div class="live-qr">${qrSVG(q, 'QR-Code zum Mitmachen')}</div>` : ''}
      <p class="small muted">QR-Code scannen – oder auf Vokaboom „Live-Spiel beitreten“ und den Code eingeben.</p>
    </div>
    ${livePlayersHTML()}
  </div>
  ${liveSetupHTML()}`;
}

/* =========================================================
   Quiz
   ========================================================= */
function quizQuestions(set) {
  const words = liveEligible(set, 'quiz');
  const pool = shuffle(liveSelected());
  const n = LV.cfg.n === 'all' ? pool.length : Math.min(LV.cfg.n, pool.length);
  return pool.slice(0, n).map((w) => {
    const others = shuffle(words.filter((x) => x !== w && gameForm(x).toLowerCase() !== gameForm(w).toLowerCase())).slice(0, 3);
    const opts = shuffle([w, ...others]);
    const p = effectivePic(w, set.lang);
    return { w, options: opts.map(gameForm), correct: opts.indexOf(w), german: w.german || '', pic: p && (p.kind === 'emoji' ? { kind: 'emoji', src: p.src } : p.src && !/^data:/.test(p.src) ? { kind: 'img', src: p.src } : null) };
  });
}
function quizStart() {
  const s = LV.st;
  if (liveProblem() || !LV.players.size) return;
  liveCfgSave();
  s.qs = quizQuestions(LV.set);
  s.i = -1;
  LV.players.forEach((p) => { p.score = 0; p.gain = 0; p.right = 0; });
  quizNext();
}
function quizNext() {
  const s = LV.st;
  s.i++;
  if (s.i >= s.qs.length) { s.phase = 'end'; LV.ch.send({ t: 'end', ranking: quizRanking() }); renderLive(); podiumShow(); return; }
  const q = s.qs[s.i];
  s.phase = 'q'; s.answers = new Map(); s.t0 = Date.now(); s.dur = (LV.cfg.time || 20) * 1000;
  s.qMsg = { t: 'q', i: s.i, total: s.qs.length, options: q.options, german: q.german, pic: q.pic, dur: s.dur, at: s.t0 };
  LV.ch.send(s.qMsg);
  renderLive();
  clearTimeout(s.timer);
  s.timer = lvLater(quizReveal, s.dur + 300);
  s.tick = s.tick || lvEvery(() => { const el = $('#quiz-left'); if (el && LV.st.phase === 'q') el.textContent = Math.max(0, Math.ceil((LV.st.t0 + LV.st.dur - Date.now()) / 1000)); }, 250);
}
function quizAnswer(m) {
  const s = LV.st;
  if (s.phase !== 'q' || m.i !== s.i || s.answers.has(m.id) || !LV.players.has(m.id)) return;
  s.answers.set(m.id, { choice: m.choice, ms: Math.max(0, Date.now() - s.t0) });
  const el = $('#quiz-count'); if (el) el.textContent = `${s.answers.size} von ${LV.players.size} haben geantwortet`;
  if (s.answers.size >= LV.players.size) { clearTimeout(s.timer); quizReveal(); }
}
function quizRanking() { return [...LV.players.entries()].map(([id, p]) => ({ id, name: p.name, score: p.score })).sort((a, b) => b.score - a.score); }
function quizReveal() {
  const s = LV.st;
  if (s.phase !== 'q') return;
  const q = s.qs[s.i];
  s.phase = 'reveal';
  s.counts = [0, 0, 0, 0];
  s.prevRank = new Map(quizRanking().map((r, k) => [r.id, k]));
  const results = {};
  LV.players.forEach((p) => { p.prev = p.score; p.gain = 0; });
  s.answers.forEach((a, id) => {
    s.counts[a.choice] = (s.counts[a.choice] || 0) + 1;
    const ok = a.choice === q.correct;
    const pts = ok ? Math.round(500 + 500 * Math.max(0, 1 - a.ms / s.dur)) : 0;
    const p = LV.players.get(id); if (p) { p.score += pts; p.gain = pts; if (ok) p.right = (p.right || 0) + 1; }
    results[id] = { ok, pts, answered: true };
  });
  const ranking = quizRanking();
  ranking.forEach((r, k) => {
    const ahead = ranking[k - 1], behind = ranking[k + 1];
    results[r.id] = { ...(results[r.id] || { ok: false, pts: 0, answered: false }), score: r.score, rank: k + 1, move: (s.prevRank.get(r.id) ?? k) - k,
      ahead: ahead ? { name: ahead.name, gap: ahead.score - r.score } : null, behind: behind ? { name: behind.name, gap: r.score - behind.score } : null };
  });
  LV.ch.send({ t: 'reveal', i: s.i, correct: q.correct, answer: q.options[q.correct], results, total: ranking.length, last: s.i + 1 >= s.qs.length });
  sfx.win();
  renderLive();
  liveTableAnimate();
}
/** Live-Tabelle: Plätze rutschen an ihren neuen Ort, Punkte zählen hoch */
function liveTableHTML() {
  const s = LV.st;
  const r = quizRanking();
  const max = Math.max(1, ...r.map((x) => x.score));
  const shown = r.slice(0, 10);
  return `<div class="live-table" id="live-table">
    <h3>Zwischenstand</h3>
    <ol class="lt-list">${shown.map((x, k) => {
      const p = LV.players.get(x.id) || {};
      const was = s.prevRank?.get(x.id) ?? k;
      const move = was - k;
      return `<li class="lt-row ${k < 3 ? `top top${k + 1}` : ''}" style="--d:${move};--k:${k}">
        <span class="lt-rank">${k + 1}</span>
        <span class="lt-name">${esc(x.name)}${move > 0 ? `<i class="lt-up">▲${move}</i>` : ''}</span>
        <span class="lt-bar"><i style="--w0:${((p.prev || 0) / max * 100).toFixed(1)}%;--w:${(x.score / max * 100).toFixed(1)}%"></i></span>
        <b class="lt-score" data-from="${p.prev || 0}" data-to="${x.score}">${p.prev || 0}</b>
        ${p.gain ? `<span class="lt-gain">+${p.gain}</span>` : '<span class="lt-gain zero">+0</span>'}
      </li>`;
    }).join('')}</ol>
    ${r.length > 10 ? `<p class="small muted center">… und ${r.length - 10} weitere</p>` : ''}
  </div>`;
}
function liveTableAnimate() {
  const t0 = performance.now() + 700;
  const els = $$('#live-table .lt-score');
  const step = (now) => {
    const q = Math.max(0, Math.min(1, (now - t0) / 1100));
    const e = 1 - (1 - q) ** 3;
    els.forEach((el) => { const a = +el.dataset.from, b = +el.dataset.to; el.textContent = Math.round(a + (b - a) * e); });
    if (q < 1 && document.contains(els[0] || document.body)) requestAnimationFrame(step);
  };
  if (els.length) requestAnimationFrame(step);
}
function quizHostHTML() {
  const s = LV.st;
  if (s.phase === 'lobby') {
    return `<section class="mode live-host">${lobbyHTML()}
      <div class="row center"><button class="btn primary big" data-action="quiz-start" ${LV.players.size && !liveProblem() ? '' : 'disabled'}>Quiz starten ${icon('right')}</button>
        <button class="btn ghost" data-action="live-close">Beenden</button></div></section>`;
  }
  if (s.phase === 'end') return podiumHTML();
  const q = s.qs[s.i];
  const prompt = `${q.pic ? (q.pic.kind === 'emoji' ? `<span class="quiz-emoji">${esc(q.pic.src)}</span>` : `<img class="quiz-pic" src="${esc(q.pic.src)}" alt="">`) : ''}<span class="quiz-de" lang="de">${esc(q.german)}</span>`;
  const answered = Math.max(1, s.answers?.size || 0);
  const opts = q.options.map((o, k) => `<div class="quiz-opt ${s.phase === 'reveal' ? (k === q.correct ? 'right' : 'dim') : ''}" style="${optStyle(k)}">
      <span class="quiz-shape">${QUIZ_COLORS[k][1]}</span><span lang="${LV.set.lang}">${esc(o)}</span>${s.phase === 'reveal' ? `<b class="quiz-n">${s.counts[k] || 0}</b><i class="quiz-bar" style="--p:${((s.counts[k] || 0) / answered * 100).toFixed(0)}%"></i>` : ''}</div>`).join('');
  const timer = s.phase === 'q' ? `<span class="quiz-left" id="quiz-left" style="--dur:${s.dur}ms">${Math.ceil(s.dur / 1000)}</span>` : '';
  if (s.phase === 'reveal') {
    const last = s.i + 1 >= s.qs.length;
    return `<section class="mode live-host quiz-host is-reveal">
      <div class="quiz-head"><span>Frage ${s.i + 1} von ${s.qs.length}</span><span class="small muted">Code ${LV.code}</span></div>
      <div class="quiz-reveal-grid">
        <div class="quiz-reveal-q">
          <div class="quiz-prompt small">${prompt}</div>
          <div class="quiz-opts compact">${opts}</div>
          <p class="center muted small">${s.answers.size} von ${LV.players.size} haben geantwortet</p>
        </div>
        ${liveTableHTML()}
      </div>
      <div class="row center"><button class="btn primary big" data-action="quiz-next">${last ? '🏆 Zur Siegerehrung' : `Nächste Frage ${icon('right')}`}</button></div>
    </section>`;
  }
  return `<section class="mode live-host quiz-host">
    <div class="quiz-head"><span>Frage ${s.i + 1} von ${s.qs.length}</span>${timer}<span class="small muted">Code ${LV.code}</span></div>
    <div class="quiz-timebar" style="--dur:${s.dur}ms"><i></i></div>
    <div class="quiz-prompt"><p class="small muted">Wie heisst das auf ${LANGS[LV.set.lang].name}?</p>${prompt}</div>
    <div class="quiz-opts">${opts}</div>
    <p class="center muted" id="quiz-count">${s.answers.size} von ${LV.players.size} haben geantwortet</p>
    <div class="row center"><button class="btn ghost" data-action="quiz-reveal">Jetzt auflösen</button></div>
  </section>`;
}

/* ---------- Siegerehrung: Podest baut sich auf, Platz 3 → 2 → Trommelwirbel → 1 ---------- */
const POD_T = { p3: 600, p2: 2200, drum: 3700, p1: 5600, rest: 7000 };
function podiumHTML() {
  const r = quizRanking();
  const place = (k) => {
    const x = r[k];
    const cls = ['p1', 'p2', 'p3'][k];
    const right = x ? (LV.players.get(x.id)?.right || 0) : 0;
    return `<div class="pd-col ${cls}">
      <div class="pd-person">${x ? `<span class="pd-medal">${['🥇', '🥈', '🥉'][k]}</span><span class="pd-avatar">${esc(x.name.charAt(0).toUpperCase())}</span><strong class="pd-name">${esc(x.name)}</strong><small>${x.score} Punkte · ${right} richtig</small>` : ''}</div>
      <div class="pd-block"><span>${k + 1}</span></div>
    </div>`;
  };
  return `<section class="mode live-host podium-stage">
    <div class="pd-lights" aria-hidden="true"><i></i><i></i><i></i></div>
    <h2 class="pd-title">🏆 Siegerehrung</h2>
    <p class="pd-drum" aria-live="polite">🥁 Und der erste Platz geht an …</p>
    <div class="pd-wrap">${place(1)}${place(0)}${place(2)}</div>
    ${r.length > 3 ? `<ol class="pd-rest" start="4">${r.slice(3, 12).map((x) => `<li><span>${esc(x.name)}</span><b>${x.score}</b></li>`).join('')}</ol>` : ''}
    <div class="row center pd-actions"><button class="btn primary" data-action="lv-lobby">${icon('shuffle')} Nochmal spielen</button><button class="btn ghost" data-action="live-close">Beenden</button></div>
  </section>`;
}
function podiumShow() {
  const n = LV.players.size;
  if (n >= 3) lvLater(() => tone([392, 523], 0.18, 'triangle', 0.08), POD_T.p3 + 600);
  if (n >= 2) lvLater(() => tone([440, 587], 0.18, 'triangle', 0.08), POD_T.p2 + 600);
  for (let i = 0; i < 14; i++) lvLater(() => tone([110 + (i % 2) * 8], 0.06, 'square', 0.04), POD_T.drum + 200 + i * 110); // Trommelwirbel
  lvLater(() => { sfx.win(); confetti(); }, POD_T.p1 + 700);
  lvLater(() => confetti(), POD_T.p1 + 2200);
}

/* =========================================================
   Hör-Bingo
   ========================================================= */
function bingoStart() {
  const s = LV.st;
  if (liveProblem() || !LV.players.size) return;
  liveCfgSave();
  clearInterval(s.autoT);
  s.phase = 'play'; s.called = []; s.round = (s.round || 0) + 1; s.winners = []; s.paused = false; s.claim = null;
  if (LV.cfg.auto) { s.autoT = lvEvery(() => { if (LV.st.phase === 'play' && !LV.st.paused) bingoCall(); }, LV.cfg.auto * 1000); }
  LV.ch.send({ t: 'bingo-new', round: s.round, words: liveSelected().map(gameForm) }); // Karten nur aus den ausgewählten Wörtern
  hostBroadcastState();
  renderLive();
}
function bingoCall(again = false) {
  const s = LV.st, set = LV.set;
  const words = liveSelected();
  if (!again) {
    const left = words.filter((w) => !s.called.includes(gameForm(w)));
    if (!left.length) { clearInterval(s.autoT); toast('Alle Wörter wurden schon vorgelesen.'); return; }
    s.called.push(gameForm(shuffle(left)[0]));
    LV.ch.send({ t: 'call', n: s.called.length });
  }
  const last = s.called[s.called.length - 1];
  const w = words.find((x) => gameForm(x) === last);
  if (w) speak(w.foreign, set.lang);
  renderLive();
}
function bingoClaim(m) {
  const s = LV.st;
  const p = LV.players.get(m.id) || { name: String(m.name || 'Kind') };
  const marked = Array.isArray(m.line) ? m.line : [];
  const ok = marked.length >= 3 && marked.every((x) => s.called.includes(x));
  const wrongWords = marked.filter((x) => !s.called.includes(x));
  if (ok) s.winners.push(p.name);
  LV.ch.send({ t: 'bingo-result', id: m.id, name: p.name, ok, wrong: wrongWords });
  s.claim = { name: p.name, ok, wrong: wrongWords };
  if (ok) { sfx.win(); confetti(); } else sfx.bad();
  renderLive();
}
function bingoHostHTML() {
  const s = LV.st;
  if (s.phase === 'lobby') {
    return `<section class="mode live-host">${lobbyHTML()}
      <p class="center hint">Jedes Kind bekommt 9 Wortkarten aus den ausgewählten Wörtern. Vokaboom liest die Wörter vor – am besten über den Lautsprecher am Beamer. Wer drei in einer Reihe hat, ruft BINGO.</p>
      <div class="row center"><button class="btn primary big" data-action="bingo-start" ${LV.players.size && !liveProblem() ? '' : 'disabled'}>Bingo starten ${icon('right')}</button>
        <button class="btn ghost" data-action="live-close">Beenden</button></div></section>`;
  }
  const n = s.called.length;
  return `<section class="mode live-host bingo-host">
    <div class="quiz-head"><span>Runde ${s.round}</span><span class="small muted">Code ${LV.code} · ${LV.players.size} Kinder</span></div>
    ${s.claim ? `<div class="banner ${s.claim.ok ? 'good' : 'bad'} bingo-claim">${s.claim.ok ? '🎉' : icon('x')}<div><strong>${esc(s.claim.name)} ${s.claim.ok ? 'hat BINGO!' : 'hat noch kein Bingo.'}</strong>${s.claim.ok ? '' : ` Noch nicht vorgelesen: ${s.claim.wrong.map(esc).join(', ')}`}</div></div>` : ''}
    <div class="bingo-call">
      <p class="bingo-n">${n ? `Wort ${n}` : 'Bereit?'}</p>
      <div class="row center">
        <button class="btn primary big" data-action="bingo-call">${icon('speaker')} Nächstes Wort</button>
        ${n ? `<button class="btn secondary" data-action="bingo-again">${icon('flip')} Nochmal vorlesen</button>` : ''}
        ${LV.cfg.auto ? `<button class="btn ghost" data-action="bingo-pause">${s.paused ? '▶ Weiter vorlesen' : `⏸ Pause (alle ${LV.cfg.auto} s)`}</button>` : ''}
      </div>
    </div>
    <details class="bingo-list"><summary>Vorgelesene Wörter anzeigen (${n})</summary>
      <ol>${s.called.map((x) => `<li lang="${LV.set.lang}">${esc(x)}</li>`).join('')}</ol></details>
    ${s.winners.length ? `<p class="center">Bingo: ${s.winners.map(esc).join(', ')}</p>` : ''}
    <div class="row center"><button class="btn ghost" data-action="bingo-start">${icon('shuffle')} Neue Runde (neue Karten)</button><button class="btn ghost" data-action="lv-lobby">${icon('sliders')} Einstellungen</button><button class="btn ghost" data-action="live-close">Beenden</button></div>
  </section>`;
}

/* =========================================================
   Kinder: mitmachen
   ========================================================= */
function openJoin(code = '') {
  liveStop();
  LV.role = '';
  LV.st = { code: (code || '').toUpperCase() };
  ui.setId = ui.setId || null;
  go('live');
}
function joinFormHTML() {
  const name = isKid() ? kidName() : (sessionStorage.getItem?.('vokaboom.liveName') || '');
  return `<section class="mode live-join"><div class="test-card">
    <h2>Live-Spiel beitreten</h2>
    <form id="join-form" class="auth-form" autocomplete="off">
      <label class="field" for="join-code"><span class="label">Code (steht am Beamer)</span>
        <input id="join-code" class="join-code" type="text" maxlength="5" autocapitalize="characters" spellcheck="false" value="${esc(LV.st.code || '')}" placeholder="ABCDE"></label>
      ${isKid() ? `<p>Du machst mit als <strong>${esc(name)}</strong>.</p>` : `<label class="field" for="join-name"><span class="label">Dein Vorname</span>
        <input id="join-name" type="text" maxlength="24" value="${esc(name)}" placeholder="z. B. Lena"></label>`}
      <p class="form-error" id="join-error" role="alert"></p>
      <button class="btn primary big" type="submit" id="join-btn">Mitmachen ${icon('right')}</button>
    </form>
  </div></section>`;
}
function bindJoinForm() {
  const f = $('#join-form');
  if (!f) return;
  setTimeout(() => (LV.st.code ? $('#join-name') : $('#join-code'))?.focus(), 60);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#join-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const name = isKid() ? kidName() : ($('#join-name')?.value || '').trim();
    const err = $('#join-error');
    if (code.length !== 5) { err.textContent = 'Der Code hat 5 Zeichen.'; return; }
    if (!name) { err.textContent = 'Schreib deinen Vornamen.'; return; }
    try { sessionStorage.setItem('vokaboom.liveName', name); } catch { /* */ }
    $('#join-btn').disabled = true;
    await liveJoin(code, name);
  });
}
async function liveJoin(code, name) {
  liveStop();
  let id = '';
  try { id = sessionStorage.getItem('vokaboom.liveId') || ''; } catch { /* */ }
  if (!id) { id = Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('vokaboom.liveId', id); } catch { /* */ } }
  Object.assign(LV, { role: 'player', code, me: { id, name }, st: { phase: 'wait' } });
  try {
    LV.ch = await liveChannel(code, playerMsg);
  } catch (e) {
    LV.role = ''; LV.st = { code };
    renderLive();
    const err = $('#join-error'); if (err) err.textContent = 'Keine Verbindung. Bist du online?';
    return;
  }
  const hello = () => LV.ch?.send({ t: 'join', id, name });
  hello();
  lvEvery(() => { if (!LV.st.kind) hello(); }, 2000); // bis die Lehrperson antwortet
  renderLive();
}
function playerMsg(m) {
  if (!m || LV.role !== 'player') return;
  const s = LV.st;
  if (m.t === 'state') {
    const first = !s.kind;
    Object.assign(s, { kind: m.kind, title: m.title, lang: m.lang });
    if (m.kind === 'bingo') {
      s.words = m.words;
      if (!s.card || s.round !== m.round) bingoNewCard(m.round);
      if (m.phase === 'play') s.phase = 'bingo';
    }
    if (m.kind === 'quiz' && m.phase === 'q' && m.q && s.qi !== m.q.i) playerQuestion(m.q);
    else if (first) renderLive();
    return;
  }
  if (m.t === 'q') { playerQuestion(m); return; }
  if (m.t === 'reveal' && m.i === s.qi) {
    const r = m.results?.[LV.me.id] || { ok: false, pts: 0 };
    Object.assign(s, { phase: 'reveal', res: r, answerText: m.answer, total: m.total, last: m.last });
    (r.ok ? sfx.good : sfx.bad)();
    renderLive();
    return;
  }
  if (m.t === 'end') {
    const k = m.ranking.findIndex((x) => x.id === LV.me.id);
    const me = m.ranking[k], ah = m.ranking[k - 1], be = m.ranking[k + 1];
    Object.assign(s, { phase: 'end', rank: k + 1, total: m.ranking.length, score: me?.score || 0, endShown: false,
      stand: me ? { rank: k + 1, ahead: ah ? { name: ah.name, gap: ah.score - me.score } : null, behind: be ? { name: be.name, gap: me.score - be.score } : null } : null });
    renderLive();
    // Spannung wie am Beamer: eigener Platz erst nach der Siegerehrung
    lvLater(() => { if (LV.st.phase !== 'end') return; LV.st.endShown = true; renderLive(); if (k >= 0 && k < 3) { sfx.win(); confetti(); } }, POD_T.p1 + 900);
    return;
  }
  if (m.t === 'lobby') { Object.assign(s, { phase: 'wait', q: null, res: null }); renderLive(); return; }
  if (m.t === 'bingo-new') { if (Array.isArray(m.words) && m.words.length) s.words = m.words; bingoNewCard(m.round); s.phase = 'bingo'; renderLive(); return; }
  if (m.t === 'call') { s.calls = m.n; const el = $('#bingo-calls'); if (el) el.textContent = `${m.n} Wörter vorgelesen`; return; }
  if (m.t === 'bingo-result' && m.id === LV.me.id) {
    s.result = m;
    if (m.ok) { sfx.win(); confetti(); } else sfx.bad();
    renderLive();
  } else if (m.t === 'bingo-result' && m.ok) {
    toast(`${m.name} hat BINGO! 🎉`);
  }
}
/** „Du bist aktuell auf dem 3. Platz – knapp hinter Mia“ */
function standingText(r, now = 'aktuell ') {
  if (!r || !r.rank) return '';
  let tail = '';
  if (r.rank > 1 && r.ahead) tail = r.ahead.gap === 0 ? ` – gleich viele Punkte wie ${esc(r.ahead.name)}` : ` – ${r.ahead.gap <= 300 ? 'knapp ' : ''}hinter ${esc(r.ahead.name)}`;
  else if (r.rank === 1 && r.behind) tail = r.behind.gap === 0 ? ` – gleich viele Punkte wie ${esc(r.behind.name)}` : ` – ${r.behind.gap <= 300 ? 'knapp ' : ''}vor ${esc(r.behind.name)}`;
  return `Du bist ${now}auf dem <strong>${r.rank}. Platz</strong>${tail}`;
}
function playerQuestion(q) {
  Object.assign(LV.st, { phase: 'q', q, qi: q.i, chosen: null, res: null });
  renderLive();
}
function bingoNewCard(round) {
  const s = LV.st;
  const size = 3;
  s.card = shuffle((s.words || []).slice()).slice(0, size * size);
  s.marked = new Set(); s.round = round; s.result = null;
}
const BINGO_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function bingoLine() { const m = LV.st.marked; return BINGO_LINES.find((l) => l.every((i) => m.has(i))) || null; }
function playerHTML() {
  const s = LV.st;
  const head = `<p class="live-me">${esc(LV.me.name)} · Code ${LV.code}</p>`;
  if (!s.kind || s.phase === 'wait') return `<section class="mode live-play">${head}<div class="test-card center"><span class="spinner"></span><h2>Du bist dabei!</h2><p class="lead">Warte, bis deine Lehrperson startet …</p></div></section>`;
  if (s.kind === 'quiz') {
    if (s.phase === 'q') {
      const q = s.q;
      return `<section class="mode live-play">${head}
        <p class="center muted">Frage ${q.i + 1} von ${q.total}</p>
        <div class="quiz-prompt small">${q.pic ? (q.pic.kind === 'emoji' ? `<span class="quiz-emoji">${esc(q.pic.src)}</span>` : `<img class="quiz-pic" src="${esc(q.pic.src)}" alt="">`) : ''}<span class="quiz-de" lang="de">${esc(q.german)}</span></div>
        <div class="quiz-opts player">${q.options.map((o, k) => `<button class="quiz-opt" style="${optStyle(k)}" data-action="quiz-pick" data-k="${k}" ${s.chosen != null ? 'disabled' : ''} ${s.chosen === k ? 'aria-pressed="true"' : ''}>
          <span class="quiz-shape">${QUIZ_COLORS[k][1]}</span><span lang="${s.lang}">${esc(o)}</span></button>`).join('')}</div>
        ${s.chosen != null ? '<p class="center lead">Antwort gesendet – warte auf die Auflösung …</p>' : ''}
      </section>`;
    }
    if (s.phase === 'reveal') {
      const r = s.res;
      return `<section class="mode live-play">${head}<div class="test-card center quiz-result ${r.ok ? 'good' : 'bad'}">
        <div class="qr-badge">${r.ok ? '✓' : '✗'}</div>
        <h2>${r.ok ? 'Richtig!' : (s.chosen == null ? 'Zu spät!' : 'Leider falsch')}</h2>
        <p class="qr-pts">${r.ok ? `+${r.pts} Punkte` : '+0 Punkte'}</p>
        ${r.ok ? '' : `<p class="lead">Richtig ist: <strong lang="${s.lang}">${esc(s.answerText || '')}</strong></p>`}
        ${r.rank ? `<div class="qr-stand"><span>${standingText(r)}${r.move > 0 ? ` <i class="lt-up">▲${r.move}</i>` : ''}</span><span><strong>${r.score}</strong> Punkte total</span></div>` : ''}
        <p class="small muted">${s.last ? 'Gleich kommt die Siegerehrung …' : 'Warte auf die nächste Frage …'}</p></div></section>`;
    }
    if (s.phase === 'end') {
      if (!s.endShown) return `<section class="mode live-play">${head}<div class="test-card center"><div class="game-end-art pd-drum-kid">🥁</div><h2>Siegerehrung!</h2><p class="lead">Schau nach vorne zum Beamer …</p></div></section>`;
      return `<section class="mode live-play">${head}<div class="test-card center kid-final ${s.rank && s.rank <= 3 ? 'top' : ''}"><div class="game-end-art">${s.rank && s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : '🏁'}</div>
        <h2>${s.rank === 1 ? 'Gewonnen! 🎉' : s.rank && s.rank <= 3 ? 'Aufs Podest geschafft!' : 'Geschafft!'}</h2><p class="lead">${s.stand ? standingText(s.stand, '') : ''}</p><p>${s.score} Punkte</p><button class="btn ghost" data-action="live-leave">Fertig</button></div></section>`;
    }
  }
  if (s.kind === 'bingo') {
    if (s.phase !== 'bingo') return `<section class="mode live-play">${head}<div class="test-card center"><h2>Hör-Bingo</h2><p class="lead">Gleich geht's los. Hör gut zu!</p></div></section>`;
    const line = bingoLine();
    return `<section class="mode live-play">${head}
      <p class="center muted" id="bingo-calls">${s.calls || 0} Wörter vorgelesen</p>
      ${s.result ? `<div class="banner ${s.result.ok ? 'good' : 'bad'}">${s.result.ok ? '🎉' : icon('x')}<div><strong>${s.result.ok ? 'BINGO! Super!' : 'Noch kein Bingo.'}</strong>${s.result.ok ? '' : ` Diese Wörter wurden noch nicht vorgelesen: ${s.result.wrong.map(esc).join(', ')}`}</div></div>` : ''}
      <div class="bingo-card" lang="${s.lang}">${s.card.map((w, i) => `<button class="bingo-cell ${s.marked.has(i) ? 'on' : ''} ${line && line.includes(i) ? 'line' : ''}" data-action="bingo-mark" data-i="${i}">${esc(w)}</button>`).join('')}</div>
      <div class="row center"><button class="btn primary big bingo-btn" data-action="bingo-shout" ${line ? '' : 'disabled'}>BINGO!</button></div>
      <p class="hint center">Tippe die Wörter an, die du hörst. Drei in einer Reihe (waagrecht, senkrecht oder schräg) = BINGO.</p>
    </section>`;
  }
  return `<section class="mode live-play">${head}</section>`;
}
function bindPlayer() { /* alles über data-action */ }

/* ---------- Aktionen ---------- */
const liveActions = {
  'live-host': (el) => liveHost(el.dataset.kind),
  'live-close': () => { const set = LV.set; liveStop(); if (set) openSet(set.id); else go('home'); },
  'live-join': () => openJoin(),
  'live-leave': () => { liveStop(); go('home'); },
  'quiz-start': () => quizStart(),
  'lv-n': (el) => { LV.cfg.n = el.dataset.v === 'all' ? 'all' : +el.dataset.v; liveRefreshLobby(); },
  'lv-time': (el) => { LV.cfg.time = +el.dataset.v; liveRefreshLobby(); },
  'lv-auto': (el) => { LV.cfg.auto = +el.dataset.v; liveRefreshLobby(); },
  'lv-words': (el) => { LV.cfg.ids = new Set(el.dataset.v === 'all' ? liveEligible(LV.set, LV.kind).map((w) => w.id) : []); LV.ui = { ...(LV.ui || {}), wordsOpen: true }; liveRefreshLobby(); },
  'lv-lobby': () => {
    // zurück in den Warteraum: gleiche Kinder, Einstellungen anpassen, neu starten
    LV.timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); LV.timers = [];
    LV.st = { phase: 'lobby', round: LV.st.round };
    LV.ch?.send({ t: 'lobby' });
    lvEvery(() => hostBroadcastState(), 2500);
    renderLive();
  },
  'bingo-pause': () => { LV.st.paused = !LV.st.paused; renderLive(); },
  'quiz-next': () => quizNext(),
  'quiz-reveal': () => { clearTimeout(LV.st.timer); quizReveal(); },
  'quiz-pick': (el) => {
    const s = LV.st;
    if (s.phase !== 'q' || s.chosen != null) return;
    s.chosen = +el.dataset.k;
    LV.ch?.send({ t: 'a', id: LV.me.id, i: s.qi, choice: s.chosen });
    sfx.flip();
    renderLive();
  },
  'bingo-start': () => bingoStart(),
  'bingo-call': () => bingoCall(),
  'bingo-again': () => bingoCall(true),
  'bingo-mark': (el) => {
    const s = LV.st, i = +el.dataset.i;
    if (s.marked.has(i)) s.marked.delete(i); else s.marked.add(i);
    sfx.flip();
    renderLive();
  },
  'bingo-shout': () => {
    const s = LV.st, line = bingoLine();
    if (!line) return;
    LV.ch?.send({ t: 'bingo', id: LV.me.id, name: LV.me.name, line: line.map((i) => s.card[i]) });
  },
};

/** Über QR-Code: …#live=ABCDE */
function liveFromHash() {
  const m = location.hash.match(/^#live=([A-Za-z0-9]{5})$/);
  if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
  openJoin(m[1]);
  return true;
}
