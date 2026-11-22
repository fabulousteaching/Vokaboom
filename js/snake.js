/* Vokaboom – Wortschlange (Technik wie die Zahlen-Schlange in Teilmal)
 * Stufe 1 „Buchstaben“: Oben steht das deutsche Wort. Die Schlange frisst die Buchstaben des Worts in der Fremdsprache
 *   der Reihe nach – sie wird länger und das Wort entsteht in ihrem Körper. Ist es fertig, leuchtet es auf.
 * Stufe 2 „Wörter“: Oben steht das deutsche Wort, auf dem Feld liegen drei Wörter. Die Schlange frisst das richtige.
 * Falsch → kürzer und ein Leben weg (3 Leben). Beisst sie sich selbst, ist das Spiel vorbei.
 */
'use strict';

const WS = { R: 14, TURN: 3.4, V0: 100, VMAX: 190, GROW: 24, SHRINK: 34, LEN0: 150, BITE_SKIP: 3.2, GAP: 30 };
const WS_SKINS = [
  { a: '#22d3ee', b: '#6366f1', band: 'rgba(15, 23, 80, .26)', eye: '#0f172a' },
  { a: '#a3e635', b: '#0d9488', band: 'rgba(5, 46, 22, .26)', eye: '#052e16' },
  { a: '#fb923c', b: '#db2777', band: 'rgba(80, 7, 36, .24)', eye: '#3b0764' },
  { a: '#facc15', b: '#16a34a', band: 'rgba(20, 50, 10, .24)', eye: '#1c1917' },
];

function startSnakeGame(set) {
  $('#view').innerHTML = gameShell('Wortschlange', `<div class="test-card setup choose-card">
    <h2>Wortschlange</h2>
    <p class="muted">Oben steht ein deutsches Wort. Friss das richtige ${LANGS[langOf(set)].name}-Wort und werde immer länger!</p>
    <div class="row center"><button class="btn primary big" data-action="ws-mode" data-mode="words">🐍 Los geht's</button></div>
    <p class="small muted">Lenken: Finger oder Maus aufs Feld halten, Pfeiltasten ↑ ↓ ← → oder der Joystick. Beiss dich nicht selbst!</p>
  </div>`);
}

function wsBegin(set, mode) {
  stopGame();
  G.id = 'snake';
  const words = gameWords(set).filter((w) => gameForm(w).replace(/[^\p{L}]/gu, '').length >= 1);
  Object.assign(G.s, { snMode: mode, set, lang: langOf(set), words, pk: makePicker(words), score: 0, lives: 3, solved: 0, done: false });
  $('#view').innerHTML = gameShell('Wortschlange', `
    <div class="ws-hud"><span class="ws-score" id="ws-score">0 Punkte</span><span class="ws-lives" id="ws-lives" aria-label="Leben">❤️❤️❤️</span></div>
    <div class="ws-task" id="ws-task" aria-live="polite"></div>
    <div class="ws-stage" id="ws-stage"><canvas id="ws-cv"></canvas><div class="ws-go" id="ws-go">Bereit?</div><div class="ws-end" id="ws-end" hidden></div></div>
    <div class="ws-pad"><div class="ws-joy" id="ws-joy" aria-label="Joystick"><i></i></div>
      <span class="ws-hint">Finger aufs Feld, Joystick oder Pfeiltasten</span></div>`);
  const st = $('#ws-stage'), cv = $('#ws-cv');
  const W = st.clientWidth, H = st.clientHeight;
  const sn = { W, H, x: W * 0.3, y: H * 0.55, ang: 0, aim: null, keys: { l: 0, r: 0, u: 0, dn: 0 }, joy: { x: 0, y: 0 }, path: [], len: WS.LEN0, travel: 0,
    foods: [], skin: WS_SKINS[Math.floor(Math.random() * WS_SKINS.length)], flash: 0, glow: 0, parts: [], floats: [], started: false, dead: false, last: 0, open: 0, tongue: 0,
    w: null, target: '', got: '', letters: [], show: 0 };
  for (let i = 0; i < 60; i++) sn.path.push({ x: sn.x - i * 2.5, y: sn.y });
  G.s.sn = sn;
  wsResize();
  const onResize = () => wsResize();
  window.addEventListener('resize', onResize);
  // Lenken: Finger/Maus aufs Feld → Schlange schwimmt dorthin
  const local = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * sn.W, y: ((e.clientY - r.top) / r.height) * sn.H }; };
  let down = false;
  cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); sn.aim = local(e); wsGo(); });
  cv.addEventListener('pointermove', (e) => { if (down || e.pointerType === 'mouse') sn.aim = local(e); });
  const up = () => { down = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (!down) sn.aim = null; });
  // Joystick
  const joy = wsJoystick($('#ws-joy'), (x, y) => { sn.joy = { x, y }; if (Math.hypot(x, y) > 0.3) { sn.aim = null; wsGo(); } });
  const KEYS = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'dn' };
  G.keys = (e) => { const k = KEYS[e.key]; if (!k) return; e.preventDefault(); sn.keys[k] = 1; sn.aim = null; wsGo(); };
  document.addEventListener('keydown', G.keys);
  const keyUp = (e) => { const k = KEYS[e.key]; if (k) sn.keys[k] = 0; };
  document.addEventListener('keyup', keyUp);
  G.wsCleanup = () => { window.removeEventListener('resize', onResize); document.removeEventListener('keyup', keyUp); joy?.dispose(); };
  wsTask();
  gLater(() => wsGo(), 1500);
  const top = $('.ws-hud'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  const loop = (now) => {
    if (G.id !== 'snake' || !$('#ws-cv')) return;
    G.raf = requestAnimationFrame(loop);
    const dt = Math.max(0, Math.min(0.05, (now - (sn.last || now)) / 1000)); sn.last = now;
    if (sn.started && !sn.dead && !G.s.done) wsStep(dt);
    wsFx(dt);
    wsDraw(now / 1000);
  };
  G.raf = requestAnimationFrame(loop);
}
function wsJoystick(el, onChange) {
  if (!el) return null;
  const knob = el.querySelector('i');
  let id = null, cx = 0, cy = 0;
  const set = (x, y) => { const r = el.clientWidth / 2, d = Math.hypot(x, y), k = d > r ? r / d : 1; knob.style.transform = `translate(${x * k}px, ${y * k}px)`; onChange((x * k) / r, (y * k) / r); };
  const down = (e) => { id = e.pointerId; el.setPointerCapture(id); const b = el.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; el.classList.add('on'); set(e.clientX - cx, e.clientY - cy); e.preventDefault(); };
  const move = (e) => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); };
  const up = (e) => { if (e.pointerId !== id) return; id = null; el.classList.remove('on'); knob.style.transform = ''; onChange(0, 0); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.style.touchAction = 'none';
  return { dispose() { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); } };
}
function wsGo() {
  const sn = G.s.sn;
  if (!sn || sn.started) return;
  sn.started = true;
  const g = $('#ws-go'); if (g) { g.textContent = 'Los!'; g.classList.add('out'); }
}
function wsResize() {
  const sn = G.s.sn, cv = $('#ws-cv'), st = $('#ws-stage');
  if (!sn || !cv || !st) return;
  const W = st.clientWidth, H = st.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = `${W}px`; cv.style.height = `${H}px`;
  sn.scale = (W / sn.W) * dpr; sn.scaleY = (H / sn.H) * dpr;
}

/* ---------- Aufgabe ---------- */
const wsLetters = (t) => [...t].filter((c) => /\p{L}|['’-]/u.test(c)); // Buchstaben, die gefressen werden (Leerzeichen überspringen)
function wsTask() {
  const s = G.s, sn = s.sn;
  if (!sn || s.done) return;
  const w = pickNext(s.pk);
  sn.w = w; sn.target = gameForm(w); sn.got = ''; sn.letters = []; sn.show = 0;
  const el = $('#ws-task');
  if (el) {
    el.innerHTML = `<span class="ws-de" lang="de">${esc(w.german || '?')}</span>${s.snMode === 'letters' ? `<span class="ws-slots" id="ws-slots" lang="${s.lang}">${wsSlotsHTML()}</span>` : ''}`;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  }
  wsPlaceFoods();
}
function wsSlotsHTML() {
  const sn = G.s.sn, letters = wsLetters(sn.target);
  let k = 0;
  return [...sn.target].map((c) => {
    if (!/\p{L}|['’-]/u.test(c)) return '<i class="sp"></i>';
    const has = k < sn.got.length; k++;
    return `<i class="${has ? 'on' : ''}">${has ? esc(c) : ''}</i>`;
  }).join('') + (letters.length ? '' : '');
}
/** Futter verteilen: Stufe 1 der nächste Buchstabe + 2 andere, Stufe 2 das Wort + 2 andere */
function wsPlaceFoods() {
  const s = G.s, sn = s.sn;
  let items;
  if (s.snMode === 'letters') {
    const need = wsLetters(sn.target)[sn.got.length];
    if (!need) return;
    const pool = [...new Set(s.words.flatMap((w) => wsLetters(gameForm(w).toLowerCase())))].filter((c) => c.toLowerCase() !== need.toLowerCase() && /\p{L}/u.test(c));
    const alpha = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => c !== need.toLowerCase());
    const others = shuffle(pool.length >= 2 ? pool : alpha).slice(0, 2).map((c) => (need === need.toUpperCase() && need !== need.toLowerCase() ? c.toUpperCase() : c));
    items = shuffle([{ text: need, ok: true }, ...others.map((c) => ({ text: c, ok: false }))]);
  } else {
    const key = (w) => gameForm(w).toLowerCase();
    const others = shuffle(s.words.filter((w) => w !== sn.w && key(w) !== key(sn.w))).slice(0, 2);
    items = shuffle([{ text: sn.target, ok: true }, ...others.map((w) => ({ text: gameForm(w), ok: false, w }))]);
  }
  const M = 40;
  sn.foods = [];
  const ctx = $('#ws-cv')?.getContext('2d');
  for (const it of items) {
    let rad = 22;
    if (ctx && it.text.length > 1) { ctx.font = '800 17px "Bricolage Grotesque", Lexend, system-ui, sans-serif'; rad = Math.max(24, ctx.measureText(it.text).width / 2 + 16); }
    let p = null;
    for (let k = 0; k < 90 && !p; k++) {
      const q = { x: M + rad + Math.random() * (sn.W - 2 * (M + rad)), y: M + Math.random() * (sn.H - 2 * M) };
      if (Math.hypot(q.x - sn.x, q.y - sn.y) < 130) continue;
      if (sn.foods.some((f) => Math.hypot(f.x - q.x, f.y - q.y) < f.rad + rad + 26)) continue;
      if (sn.path.some((b, i) => i % 4 === 0 && Math.hypot(b.x - q.x, b.y - q.y) < WS.R * 2.6)) continue;
      p = q;
    }
    p = p || { x: sn.W / 2, y: sn.H / 2 };
    // ab dem 8. gelösten Wort schwimmen die Wörter langsam umher (und werden mit jedem Wort etwas schneller)
    let vx = 0, vy = 0;
    if (s.solved >= WS_MOVE_FROM) { const a = Math.random() * Math.PI * 2, v = Math.min(55, 24 + (s.solved - WS_MOVE_FROM) * 2.5); vx = Math.cos(a) * v; vy = Math.sin(a) * v; }
    sn.foods.push({ ...p, ...it, rad, vx, vy, born: performance.now() / 1000, ph: Math.random() * 6 });
  }
  if (s.solved === WS_MOVE_FROM && !sn.moveTold) {
    sn.moveTold = true;
    sn.floats.push({ x: sn.W / 2, y: sn.H * 0.35, text: 'Achtung: Jetzt bewegen sich die Wörter!', good: false, t: 0 });
    tone([660, 880], 0.1, 'triangle', 0.06);
  }
}
const WS_MOVE_FROM = 8;

/* ---------- Bewegung ---------- */
const wsNorm = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
function wsStep(dt) {
  const s = G.s, sn = s.sn;
  if (sn.show > 0) { sn.show -= dt; if (sn.show <= 0) { sn.letters = []; wsTask(); } }
  const v = Math.min(WS.VMAX, WS.V0 + s.solved * 4);
  const kx = sn.keys.r - sn.keys.l, ky = sn.keys.dn - sn.keys.u;
  let want = null;
  if (kx || ky) want = Math.atan2(ky, kx);
  else if (Math.hypot(sn.joy.x, sn.joy.y) > 0.3) want = Math.atan2(sn.joy.y, sn.joy.x);
  else if (sn.aim && Math.hypot(sn.aim.x - sn.x, sn.aim.y - sn.y) > WS.R) want = Math.atan2(sn.aim.y - sn.y, sn.aim.x - sn.x);
  if (want != null) sn.ang += Math.max(-WS.TURN * dt, Math.min(WS.TURN * dt, wsNorm(want - sn.ang)));
  sn.x += Math.cos(sn.ang) * v * dt; sn.y += Math.sin(sn.ang) * v * dt;
  sn.travel += v * dt;
  const m = WS.R + 2;
  if (sn.x < m) { sn.x = m; sn.ang = Math.PI - sn.ang; } else if (sn.x > sn.W - m) { sn.x = sn.W - m; sn.ang = Math.PI - sn.ang; }
  if (sn.y < m) { sn.y = m; sn.ang = -sn.ang; } else if (sn.y > sn.H - m) { sn.y = sn.H - m; sn.ang = -sn.ang; }
  const h = sn.path[0];
  if (!h || Math.hypot(h.x - sn.x, h.y - sn.y) >= 2.5) sn.path.unshift({ x: sn.x, y: sn.y });
  let acc = 0;
  for (let i = 1; i < sn.path.length; i++) {
    acc += Math.hypot(sn.path[i].x - sn.path[i - 1].x, sn.path[i].y - sn.path[i - 1].y);
    if (acc > sn.len) { sn.path.length = i + 1; break; }
  }
  const near = sn.foods.reduce((d, f) => Math.min(d, Math.hypot(f.x - sn.x, f.y - sn.y) - f.rad), 999);
  sn.open += ((near < 40 ? 1 : 0) - sn.open) * Math.min(1, dt * 10);
  // in sich selbst gebissen?
  acc = 0;
  for (let i = 1; i < sn.path.length; i++) {
    acc += Math.hypot(sn.path[i].x - sn.path[i - 1].x, sn.path[i].y - sn.path[i - 1].y);
    if (acc < WS.R * 2 * WS.BITE_SKIP) continue;
    if (Math.hypot(sn.path[i].x - sn.x, sn.path[i].y - sn.y) < WS.R * 1.2) { wsBite(); return; }
  }
  // bewegte Wörter: prallen an den Rändern ab (ein falsches Wort, das den Kopf trifft, kostet ein Leben)
  for (const f of sn.foods) {
    if (!f.vx && !f.vy) continue;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (f.x < f.rad + 6 && f.vx < 0) f.vx = -f.vx; else if (f.x > sn.W - f.rad - 6 && f.vx > 0) f.vx = -f.vx;
    if (f.y < 26 && f.vy < 0) f.vy = -f.vy; else if (f.y > sn.H - 26 && f.vy > 0) f.vy = -f.vy;
    for (const g of sn.foods) { if (g === f) continue; const dx = f.x - g.x, dy = f.y - g.y, d = Math.hypot(dx, dy) || 1; if (d < f.rad + g.rad + 6) { f.vx += (dx / d) * 8; f.vy += (dy / d) * 8; const sp = Math.hypot(f.vx, f.vy) || 1, v0 = Math.min(55, 24 + (G.s.solved - WS_MOVE_FROM) * 2.5); f.vx = f.vx / sp * v0; f.vy = f.vy / sp * v0; } }
  }
  // fressen
  for (let i = 0; i < sn.foods.length; i++) {
    const f = sn.foods[i];
    if (Math.hypot(f.x - sn.x, f.y - sn.y) > WS.R + f.rad * 0.85) continue;
    wsEat(f, i);
    return;
  }
}
function wsEat(f, i) {
  const s = G.s, sn = s.sn;
  wsBurst(f.x, f.y, f.ok ? ['#fde047', '#86efac', '#ffffff', sn.skin.a] : ['#fca5a5', '#f87171', '#ffffff'], f.ok ? 24 : 14);
  if (f.ok) {
    sfx.good();
    sn.len += s.snMode === 'letters' ? WS.GAP : WS.GROW;
    if (s.snMode === 'letters') {
      sn.got += f.text; s.score += 1;
      sn.letters.unshift(f.text); // neuester Buchstabe direkt hinter dem Kopf
      const slots = $('#ws-slots'); if (slots) slots.innerHTML = wsSlotsHTML();
      if (sn.got.length >= wsLetters(sn.target).length) wsSolved();
      else wsPlaceFoods();
    } else {
      s.score += 10;
      sn.floats.push({ x: f.x, y: f.y, text: `${sn.target} = ${sn.w.german}`, good: true, t: 0 });
      markResult(s.pk, sn.w, true);
      s.solved++;
      sn.glow = 1;
      sn.foods = [];
      gLater(() => wsTask(), 250);
    }
  } else {
    sfx.bad();
    sn.foods.splice(i, 1);
    sn.len = Math.max(WS.LEN0 * 0.7, sn.len - WS.SHRINK);
    if (s.snMode === 'letters' && sn.letters.length) { sn.letters.shift(); sn.got = sn.got.slice(0, -1); const slots = $('#ws-slots'); if (slots) slots.innerHTML = wsSlotsHTML(); }
    sn.flash = 0.45;
    sn.floats.push({ x: f.x, y: f.y, text: s.snMode === 'letters' ? `Nicht „${f.text}“` : `Nein: ${f.text}${f.w?.german ? ` = ${f.w.german}` : ''}`, good: false, t: 0 });
    markResult(s.pk, sn.w, false);
    s.lives--;
    if (s.lives <= 0) { sn.dead = true; wsEnd('lives'); }
    else if (s.snMode === 'letters') wsPlaceFoods();
    else wsTask();
  }
  wsHud();
}
/** Wort fertig: es leuchtet im Körper, kurz darauf kommt das nächste */
function wsSolved() {
  const s = G.s, sn = s.sn;
  s.score += 5; s.solved++;
  markResult(s.pk, sn.w, true);
  sn.foods = []; sn.glow = 1.6; sn.show = 1.8;
  sn.floats.push({ x: sn.x, y: sn.y, text: `${sn.target} ✓`, good: true, t: 0 });
  sfx.win();
  const el = $('#ws-task'); if (el) el.classList.add('done');
}
function wsBite() {
  const sn = G.s.sn;
  sn.dead = true; sn.flash = 1;
  wsBurst(sn.x, sn.y, ['#ef4444', '#fca5a5', '#ffffff'], 30);
  sn.floats.push({ x: sn.x, y: sn.y, text: 'Autsch – in dich selbst gebissen!', good: false, t: 0 });
  sfx.bad(); tone([330, 220, 147], 0.14, 'sawtooth', 0.06);
  wsEnd('bite');
}
function wsHud() {
  const s = G.s;
  const sc = $('#ws-score'); if (sc) sc.textContent = `${s.score} ${s.score === 1 ? 'Punkt' : 'Punkte'}`;
  const lv = $('#ws-lives'); if (lv) lv.textContent = '❤️'.repeat(Math.max(0, s.lives)) + '🤍'.repeat(Math.max(0, 3 - s.lives));
}
function wsEnd(why) {
  const s = G.s;
  if (s.done) return;
  s.done = true;
  const record = gameRecord(s.set, `snake-${s.snMode}`, s.score);
  gLater(() => {
    const box = $('#ws-end');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `<div class="ws-endbox"><div class="game-end-art" aria-hidden="true">${why === 'bite' ? '🐍💥' : '🐍'}</div>
      <h2>${record ? 'Neuer Rekord!' : why === 'bite' ? 'In den eigenen Schwanz gebissen!' : 'Keine Leben mehr'}</h2>
      <p class="lead"><b>${s.score}</b> Punkte · ${s.solved} ${s.solved === 1 ? 'Wort' : 'Wörter'} gefressen</p>
      <div class="row center"><button class="btn primary" data-action="ws-mode" data-mode="${s.snMode}">${icon('shuffle')} Nochmal</button>
        <button class="btn ghost" data-action="games">Anderes Spiel</button></div></div>`;
  }, 1100);
}
function wsBurst(x, y, cols, n) {
  const sn = G.s.sn;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  for (let k = 0; k < n; k++) { const a = Math.random() * 7, sp = 40 + Math.random() * 140; sn.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.5, t: 0, c: cols[k % cols.length], r: 2 + Math.random() * 3 }); }
}
function wsFx(dt) {
  const sn = G.s.sn;
  sn.flash = Math.max(0, sn.flash - dt);
  sn.glow = Math.max(0, sn.glow - dt * 0.8);
  sn.tongue = (sn.tongue + dt) % 2.4;
  sn.parts = sn.parts.filter((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; return p.t < p.life; });
  sn.floats = sn.floats.filter((f) => { f.t += dt; return f.t < 1.6; });
}

/* ---------- Zeichnen ---------- */
function wsSegs(path) {
  const out = [{ ...path[0], d: 0 }];
  let acc = 0;
  for (let i = 1; i < path.length; i++) { acc += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); out.push({ ...path[i], d: acc }); }
  return out;
}
function wsAt(pts, d) { // Punkt auf dem Körper in Abstand d vom Kopf
  for (let i = 1; i < pts.length; i++) if (pts[i].d >= d) { const a = pts[i - 1], b = pts[i], t = (d - a.d) / Math.max(0.01, b.d - a.d); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  return pts[pts.length - 1];
}
function wsDraw(T) {
  const s = G.s, sn = s.sn, cv = $('#ws-cv');
  if (!sn || !cv) return;
  const g = cv.getContext('2d');
  g.setTransform(sn.scale, 0, 0, sn.scaleY, 0, 0);
  const bg = g.createRadialGradient(sn.W * 0.5, sn.H * 0.45, 20, sn.W * 0.5, sn.H * 0.5, Math.max(sn.W, sn.H) * 0.75);
  bg.addColorStop(0, '#1e3a5f'); bg.addColorStop(1, '#0b1326');
  g.fillStyle = bg; g.fillRect(0, 0, sn.W, sn.H);
  g.fillStyle = 'rgba(148, 197, 255, .09)';
  for (let y = 14; y < sn.H; y += 28) for (let x = (y / 28) % 2 ? 14 : 28; x < sn.W; x += 28) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  if (sn.flash > 0) { g.fillStyle = `rgba(239, 68, 68, ${sn.flash * 0.35})`; g.fillRect(0, 0, sn.W, sn.H); }
  // Futter: leuchtende Kugeln (Buchstaben) oder Wort-Kapseln
  for (const f of sn.foods) {
    const age = Math.max(0, T - f.born), k = Math.min(1, age / 0.3), bob = Math.sin(T * 2.2 + f.ph) * 2.5;
    const x = f.x, y = f.y + bob, r = f.rad * (0.6 + 0.4 * k), hgt = 22 * (0.6 + 0.4 * k);
    const glow = g.createRadialGradient(x, y, 6, x, y, r * 1.6);
    glow.addColorStop(0, 'rgba(253, 224, 71, .38)'); glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, r * 1.6, 0, 7); g.fill();
    const gr = g.createLinearGradient(x, y - hgt, x, y + hgt);
    gr.addColorStop(0, '#fffbeb'); gr.addColorStop(0.5, '#fde68a'); gr.addColorStop(1, '#f59e0b');
    g.fillStyle = gr; g.beginPath();
    if (f.text.length > 1) { if (g.roundRect) g.roundRect(x - r, y - hgt, r * 2, hgt * 2, hgt); else g.rect(x - r, y - hgt, r * 2, hgt * 2); } else g.arc(x, y, r, 0, 7);
    g.fill();
    g.fillStyle = '#451a03'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${f.text.length > 1 ? 17 : 22}px "Bricolage Grotesque", Lexend, system-ui, sans-serif`;
    g.fillText(f.text, x, y + 1);
  }
  // Körper
  const pts = wsSegs(sn.path), L = pts[pts.length - 1].d || 1, R = WS.R;
  const widthAt = (d) => R * 2 * (d / L > 0.75 ? 1 - ((d / L - 0.75) / 0.25) * 0.6 : 1);
  const N = Math.max(8, Math.ceil(L / 14));
  const chunks = [];
  for (let c = 0; c < N; c++) {
    const a = (c / N) * L, b = ((c + 1) / N) * L;
    const seg = pts.filter((p) => p.d >= a - 3 && p.d <= b + 3);
    if (seg.length > 1) chunks.push({ seg, w: widthAt((a + b) / 2), t: (a + b) / 2 / L });
  }
  const stroke = (seg, w, style, dash) => {
    g.beginPath(); g.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) g.lineTo(seg[i].x, seg[i].y);
    g.lineWidth = w; g.strokeStyle = style;
    if (dash) { g.setLineDash(dash); g.lineDashOffset = -(sn.travel - seg[0].d); g.lineCap = 'butt'; } else { g.setLineDash([]); g.lineCap = 'round'; }
    g.stroke();
  };
  g.lineJoin = 'round';
  g.save(); g.shadowColor = sn.glow > 0 ? '#fde047' : sn.skin.a; g.shadowBlur = 16 + sn.glow * 26;
  for (let i = chunks.length - 1; i >= 0; i--) stroke(chunks[i].seg, chunks[i].w + 5, 'rgba(8, 15, 35, .85)');
  g.restore();
  const mix = (t) => { const A = parseInt(sn.skin.a.slice(1), 16), B = parseInt(sn.skin.b.slice(1), 16); const c = [16, 8, 0].map((sh) => Math.round(((A >> sh) & 255) * (1 - t) + ((B >> sh) & 255) * t)); return `rgb(${c.join(',')})`; };
  for (let i = chunks.length - 1; i >= 0; i--) stroke(chunks[i].seg, chunks[i].w, mix(chunks[i].t));
  if (!sn.letters.length) for (let i = chunks.length - 1; i >= 0; i--) stroke(chunks[i].seg, chunks[i].w * 0.92, sn.skin.band, [7, 13]);
  for (let i = chunks.length - 1; i >= 0; i--) stroke(chunks[i].seg, chunks[i].w * 0.28, 'rgba(255, 255, 255, .25)');
  // Buchstaben im Körper: das Wort entsteht (neuester direkt hinter dem Kopf → von hinten gelesen ergibt es das Wort)
  if (sn.letters.length) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    sn.letters.forEach((ch, i) => {
      const p = wsAt(pts, R * 1.9 + i * WS.GAP);
      const pop = sn.show > 0 ? 1 + Math.sin(T * 9 + i) * 0.08 : 1;
      g.save(); g.translate(p.x, p.y); g.scale(pop, pop);
      g.fillStyle = sn.show > 0 ? 'rgba(255, 251, 235, .97)' : 'rgba(255, 255, 255, .9)';
      g.beginPath(); g.arc(0, 0, R * 0.86, 0, 7); g.fill();
      g.fillStyle = sn.show > 0 ? '#b45309' : '#0f172a';
      g.font = `800 ${Math.round(R * 1.15)}px "Bricolage Grotesque", Lexend, system-ui, sans-serif`;
      g.fillText(ch, 0, 1);
      g.restore();
    });
  }
  // Kopf
  g.save(); g.translate(sn.x, sn.y); g.rotate(sn.ang);
  g.fillStyle = 'rgba(8, 15, 35, .85)'; g.beginPath(); g.ellipse(2, 0, R * 1.42, R * 1.22, 0, 0, 7); g.fill();
  const hg = g.createRadialGradient(-2, -4, 2, 2, 0, R * 1.4); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.25, sn.skin.a); hg.addColorStop(1, mix(0.15));
  g.fillStyle = hg; g.beginPath(); g.ellipse(2, 0, R * 1.3, R * 1.1, 0, 0, 7); g.fill();
  if (sn.open > 0.05) { g.fillStyle = '#7f1d1d'; g.beginPath(); g.moveTo(R * 1.35, 0); g.arc(R * 0.95, 0, R * 0.55, -0.6 * sn.open, 0.6 * sn.open); g.closePath(); g.fill(); }
  else if (sn.tongue < 0.35) { g.strokeStyle = '#ef4444'; g.lineWidth = 2; g.beginPath(); g.moveTo(R * 1.3, 0); g.lineTo(R * 2.0, 0); g.lineTo(R * 2.3, -3); g.moveTo(R * 2.0, 0); g.lineTo(R * 2.3, 3); g.stroke(); }
  const target = sn.foods.find((x) => x.ok);
  for (const sd of [-1, 1]) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(R * 0.45, sd * R * 0.55, R * 0.42, 0, 7); g.fill();
    let ex = 0.12, ey = 0;
    if (target) { const la = Math.atan2(target.y - sn.y, target.x - sn.x) - sn.ang; ex = Math.cos(la) * 0.14; ey = Math.sin(la) * 0.14; }
    g.fillStyle = sn.skin.eye; g.beginPath(); g.arc(R * (0.45 + ex), sd * R * 0.55 + R * ey, R * 0.22, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(R * (0.45 + ex) - 1.5, sd * R * 0.55 + R * ey - 1.5, R * 0.07, 0, 7); g.fill();
  }
  g.restore();
  for (const p of sn.parts) { g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  for (const f of sn.floats) {
    const a = Math.min(1, (1.6 - f.t) / 0.4);
    g.globalAlpha = a; g.font = '800 15px "Bricolage Grotesque", Lexend, system-ui, sans-serif'; g.textAlign = 'center';
    const tw = g.measureText(f.text).width + 18, yy = Math.max(18, f.y - 26 - f.t * 22), xx = Math.max(tw / 2 + 4, Math.min(sn.W - tw / 2 - 4, f.x));
    g.fillStyle = f.good ? 'rgba(220, 252, 231, .95)' : 'rgba(254, 226, 226, .95)';
    g.beginPath(); if (g.roundRect) g.roundRect(xx - tw / 2, yy - 13, tw, 26, 13); else g.rect(xx - tw / 2, yy - 13, tw, 26); g.fill();
    g.fillStyle = f.good ? '#14532d' : '#7f1d1d'; g.textBaseline = 'middle'; g.fillText(f.text, xx, yy + 1);
  }
  g.globalAlpha = 1;
}

const snakeActions = {
  'ws-mode': () => wsBegin(currentSet(), 'words'), // nur noch Wörter einsammeln
};
