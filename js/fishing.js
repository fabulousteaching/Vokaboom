/* Vokaboom – Angeln mit dem eigenen Avatar
 * Der Avatar steht auf dem Steg und angelt. Oben steht das deutsche Wort, im See schwimmen Fische mit Wörtern in der
 * Fremdsprache. Tippe den richtigen Fisch an: Der Avatar wirft die Angel aus und zieht ihn heraus. Ein falscher Fisch
 * ist zu stark – er zieht den Avatar ins Wasser! Drei Würmer (Leben). Stufen: Teich, See, Meer.
 */
'use strict';

const FISH_LEVELS = {
  1: { name: 'Teich', icon: '🪷', n: 3, v: 34, sky: ['#9ED8FF', '#DFF3FF'], water: ['#3FB6C9', '#1C6E8C'], hills: ['#7CC47F', '#4E9E62'] },
  2: { name: 'See', icon: '🏞️', n: 4, v: 46, sky: ['#FFC9A8', '#FFE9C9'], water: ['#3E8FD0', '#173F7A'], hills: ['#6B9F7C', '#3D6E58'] },
  3: { name: 'Meer', icon: '🌊', n: 5, v: 60, sky: ['#7FB8FF', '#CFE6FF'], water: ['#1E7FC9', '#0B2E66'], hills: ['#A9C7D9', '#7EA3BC'] },
};
const FISH_COLORS = [['#FF9F43', '#FF6B6B'], ['#54A0FF', '#5F27CD'], ['#1DD1A1', '#10AC84'], ['#FECA57', '#FF9F43'], ['#FF6B9D', '#C44569'], ['#48DBFB', '#0ABDE3']];

function fishAvatar() {
  if (isKid() && typeof AV === 'object' && AV.state?.avatar) return AV.state.avatar;
  return typeof avStarter === 'function' ? avStarter((typeof cloud === 'object' && cloud.user) || 'vokaboom') : {};
}

function startFishing(set) {
  const lv = G.s.fishLevel || 1;
  $('#view').innerHTML = gameShell('Angeln', `<div class="test-card setup choose-card">
    <h2>Wo möchtest du angeln?</h2>
    <p class="muted">Tippe den Fisch mit dem richtigen ${LANGS[langOf(set)].name}-Wort an. Aber Vorsicht: Ein falscher Fisch zieht dich ins Wasser!</p>
    <div class="choose-grid three">${[1, 2, 3].map((n) => `<button class="choose-tile ${lv === n ? 'last' : ''}" data-action="fish-level" data-level="${n}">
      <span class="choose-demo big-emoji" aria-hidden="true">${FISH_LEVELS[n].icon}</span><strong>${FISH_LEVELS[n].name}</strong>
      <small>${[`${FISH_LEVELS[1].n} Fische, gemütlich`, `${FISH_LEVELS[2].n} Fische, flinker`, `${FISH_LEVELS[3].n} Fische, wilde Wellen`][n - 1]}</small></button>`).join('')}</div>
  </div>`);
}

function fishBegin(set, level) {
  stopGame();
  G.id = 'fish';
  const L = FISH_LEVELS[level];
  const words = gameWords(set);
  Object.assign(G.s, { fishLevel: level, L, set, lang: langOf(set), words, pk: makePicker(words), score: 0, lives: 3, caught: [], busy: false, done: false, fish: [], speed: 1, t: 0, last: 0 });
  const av = avatarSVG(fishAvatar(), { bg: false, label: 'Dein Avatar' });
  $('#view').innerHTML = gameShell('Angeln', `
    <div class="fi-hud"><span class="fi-score" id="fi-score">0 Punkte</span><span class="fi-catch" id="fi-catch">🪣 0</span><span class="fi-lives" id="fi-lives" aria-label="Würmer">🪱🪱🪱</span></div>
    <div class="fi-stage fi-l${level}" id="fi-stage" style="--sky1:${L.sky[0]};--sky2:${L.sky[1]};--w1:${L.water[0]};--w2:${L.water[1]};--h1:${L.hills[0]};--h2:${L.hills[1]}">
      <div class="fi-sky"><span class="fi-sun"></span><span class="fi-cloud c1"></span><span class="fi-cloud c2"></span><span class="fi-bird"></span></div>
      <svg class="fi-hills" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 140 Q120 60 250 110 T520 90 T780 100 T1000 70 V200 H0Z" fill="var(--h1)"/>
        <path d="M0 170 Q160 110 330 150 T680 140 T1000 130 V200 H0Z" fill="var(--h2)"/>
        ${level === 1 ? Array.from({ length: 9 }, (_, i) => `<path transform="translate(${560 + i * 48} ${118 + (i % 3) * 8})" d="M0 0 L12 -34 L24 0Z" fill="#2F6B4A"/>`).join('') : ''}
        ${level === 3 ? '<path d="M820 120 l10 -40 l6 0 l6 40z" fill="#fff"/><path d="M826 80 l10 6 l-10 6z" fill="#FF6B6B"/>' : ''}
      </svg>
      <div class="fi-water"><div class="fi-wave w1"></div><div class="fi-wave w2"></div><div class="fi-caustic"></div><div class="fi-bubbles" id="fi-bubbles"></div></div>
      <div class="fi-plants" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => `<i style="left:${8 + i * 14}%;--d:${(i % 3) * 0.6}s;--h:${30 + (i * 17) % 40}px"></i>`).join('')}</div>
      <div class="fi-dock" aria-hidden="true"><span class="fi-bucket"><b id="fi-bucket-n">0</b></span></div>
      <div class="fi-avatar" id="fi-avatar">${av}</div>
      <svg class="fi-lines" id="fi-lines" aria-hidden="true"><path id="fi-rod" class="fi-rod"/><path id="fi-line" class="fi-line"/><circle id="fi-bob" class="fi-bob" r="6"/></svg>
      <div class="fi-school" id="fi-school"></div>
      <div class="fi-front" aria-hidden="true"></div>
      <div class="fi-ask" id="fi-ask" aria-live="polite"></div>
      <div class="fi-fx" id="fi-fx"></div>
      <div class="fi-end" id="fi-end" hidden></div>
    </div>`);
  const stage = $('#fi-stage');
  G.s.stage = stage;
  fishLayout();
  const onResize = () => fishLayout();
  window.addEventListener('resize', onResize);
  G.fishCleanup = () => window.removeEventListener('resize', onResize);
  $('#fi-school').addEventListener('pointerdown', (e) => { const f = e.target.closest('.fi-fish'); if (f) { e.preventDefault(); fishTap(+f.dataset.i); } });
  const top = $('.fi-hud'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  fishRound();
  G.s.last = performance.now();
  const loop = (now) => {
    if (G.id !== 'fish' || !$('#fi-stage')) return;
    const dt = Math.min(0.05, (now - G.s.last) / 1000); G.s.last = now;
    fishStep(dt);
    G.raf = requestAnimationFrame(loop);
  };
  G.raf = requestAnimationFrame(loop);
  gEvery(() => fishBubble(), 900);
}
/** Masse der Szene (Pixel) */
function fishLayout() {
  const s = G.s, st = s.stage;
  if (!st) return;
  const W = st.clientWidth, H = st.clientHeight;
  s.W = W; s.H = H; s.waterY = Math.round(H * 0.4);
  st.style.setProperty('--water-y', `${s.waterY}px`);
  const aw = Math.round(Math.max(56, Math.min(128, W * 0.13, (s.waterY - 30) / 1.5))); // passt auch auf niedrige Bildschirme
  s.aw = aw; s.ah = aw * 1.5;
  s.avX = Math.round(W * 0.03 + aw * 0.1); s.avY = s.waterY - 12 - s.ah * 0.955; // Füsse auf dem Steg
  const av = $('#fi-avatar');
  if (av && !av.classList.contains('falling')) { av.style.width = `${aw}px`; av.style.left = `${s.avX}px`; av.style.top = `${s.avY}px`; }
  st.style.setProperty('--dock-w', `${Math.round(aw * 1.9 + W * 0.03)}px`);
  // Angelrute: von der Hand schräg nach rechts oben
  s.hand = { x: s.avX + (141 / 200) * aw, y: s.avY + (197 / 300) * s.ah };
  s.tip = { x: s.hand.x + aw * 1.25, y: s.hand.y - aw * 1.05 };
  const svg = $('#fi-lines'); if (svg) svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  s.hook = s.hook || { x: s.tip.x + 20, y: s.waterY + 4 };
  s.swimTop = s.waterY + 46; s.swimBottom = H - 40; s.swimLeft = s.tip.x - 30;
}

/* ---------- Runde ---------- */
function fishRound() {
  const s = G.s;
  if (s.done) return;
  const w = pickNext(s.pk);
  s.cur = w;
  const ask = $('#fi-ask');
  if (ask) { ask.innerHTML = `<small>Fang das Wort für</small><strong lang="de">${esc(w.german || '?')}</strong>`; ask.classList.remove('in'); void ask.offsetWidth; ask.classList.add('in'); }
  // neuer Schwarm: alter schwimmt weg, neuer schwimmt herein
  s.fish.forEach((f) => { f.leaving = true; f.dir = f.x > s.W / 2 ? 1 : -1; f.v *= 2.2; });
  const key = (x) => gameForm(x).toLowerCase();
  const others = shuffle(s.words.filter((x) => x !== w && key(x) !== key(w))).slice(0, s.L.n - 1);
  const items = shuffle([{ w, ok: true }, ...others.map((x) => ({ w: x, ok: false }))]);
  const lanes = items.length, span = (s.swimBottom - s.swimTop) / lanes;
  const school = $('#fi-school');
  items.forEach((it, k) => {
    const text = gameForm(it.w), [c1, c2] = FISH_COLORS[(k + s.caught.length) % FISH_COLORS.length];
    const bw = Math.max(92, Math.min(190, 40 + text.length * 10.5)), bh = 50;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'fi-fish'; el.dataset.i = String(s.fish.length);
    el.setAttribute('aria-label', text); el.lang = s.lang;
    el.style.width = `${bw + 34}px`; el.style.height = `${bh}px`;
    el.innerHTML = `<span class="fi-body-wrap"><svg viewBox="0 0 ${bw + 34} ${bh}" aria-hidden="true">
        <defs><linearGradient id="fg${s.t | 0}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
        <path class="fi-tail" d="M${bw - 2} ${bh / 2} L${bw + 32} 6 Q${bw + 22} ${bh / 2} ${bw + 32} ${bh - 6} Z" fill="${c2}"/>
        <path d="M${bw * 0.35} 6 Q${bw * 0.55} -6 ${bw * 0.7} 8" fill="${c2}"/>
        <ellipse cx="${bw / 2}" cy="${bh / 2}" rx="${bw / 2}" ry="${bh / 2 - 2}" fill="url(#fg${s.t | 0}${k})"/>
        <ellipse cx="${bw / 2}" cy="${bh / 2 - 8}" rx="${bw / 2 - 14}" ry="6" fill="rgba(255,255,255,.28)"/>
        <circle cx="16" cy="${bh / 2 - 6}" r="5.5" fill="#fff"/><circle cx="15" cy="${bh / 2 - 6}" r="3" fill="#1b1b2f"/>
        <path d="M5 ${bh / 2 + 6} q5 3 9 0" stroke="#7a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg><span class="fi-word">${esc(text)}</span></span>`;
    school.appendChild(el);
    const y = s.swimTop + span * k + span / 2 - bh / 2 + (Math.random() - 0.5) * Math.max(0, span - bh) * 0.6;
    const x = dir > 0 ? -bw - 40 - k * 30 : s.W + 6 + k * 30;
    s.fish.push({ el, w: it.w, ok: it.ok, x, y, y0: y, dir, v: s.L.v * s.speed * (0.8 + Math.random() * 0.45), ph: Math.random() * 6, bw: bw + 34, bh, enter: true });
  });
  s.busy = false;
}
function fishStep(dt) {
  const s = G.s;
  s.t += dt;
  for (const f of s.fish) {
    if (f.hooked) continue;
    f.x += f.dir * f.v * dt * (f.enter ? 3.2 : 1); // schnell hereinschwimmen
    f.y = f.y0 + Math.sin(s.t * 1.6 + f.ph) * 6;
    const minX = s.swimLeft, maxX = s.W - f.bw - 10;
    if (f.enter && f.x > minX && f.x < maxX) f.enter = false;
    if (!f.enter && !f.leaving) {
      if (f.x < minX && f.dir < 0) f.dir = 1;
      if (f.x > maxX && f.dir > 0) f.dir = -1;
    }
    f.el.style.transform = `translate3d(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px, 0)`;
    f.el.classList.toggle('flip', f.dir > 0); // Kopf zeigt in Schwimmrichtung (Fisch-Grafik schaut nach links)
  }
  const gone = s.fish.filter((f) => f.leaving && (f.x < -f.bw - 40 || f.x > s.W + 40));
  gone.forEach((f) => f.el.remove());
  if (gone.length) s.fish = s.fish.filter((f) => !gone.includes(f));
  s.fish.forEach((f, i) => { f.el.dataset.i = String(i); });
  fishDrawLine();
}
/** Rute, Schnur und Schwimmer */
function fishDrawLine() {
  const s = G.s, rod = $('#fi-rod'), line = $('#fi-line'), bob = $('#fi-bob');
  if (!rod || !s.hand) return;
  const pull = s.pull || 0; // Rute biegt sich, wenn ein Fisch zieht
  const tip = { x: s.tip.x + pull * 26, y: s.tip.y + pull * 46 };
  const mid = { x: (s.hand.x + tip.x) / 2 + pull * 8, y: (s.hand.y + tip.y) / 2 - 8 + pull * 6 };
  rod.setAttribute('d', `M${s.hand.x} ${s.hand.y} Q${mid.x} ${mid.y} ${tip.x} ${tip.y}`);
  let hk = s.hook;
  if (!s.casting) { hk = { x: s.tip.x + 26, y: s.waterY + 6 + Math.sin(s.t * 2.4) * 3 }; s.hook = hk; }
  const sag = s.casting ? (pull ? 0 : 30) : 40;
  line.setAttribute('d', `M${tip.x} ${tip.y} Q${(tip.x + hk.x) / 2} ${Math.max(tip.y, hk.y) + sag - (pull ? 60 : 0)} ${hk.x} ${hk.y}`);
  bob.setAttribute('cx', hk.x); bob.setAttribute('cy', hk.y - 2);
  bob.style.opacity = s.casting ? 0 : 1;
}
function fishTween(ms, fn) {
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1 && G.id === 'fish') requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
}
const fishEase = (k) => 1 - Math.pow(1 - k, 3);

/* ---------- Anbeissen ---------- */
async function fishTap(i) {
  const s = G.s, f = s.fish[i];
  if (!f || s.busy || s.done || f.leaving) return;
  s.busy = true;
  f.hooked = true;
  f.el.classList.add('hooked');
  s.casting = true;
  // Angel auswerfen: Haken fliegt zum Maul des Fisches
  const from = { ...s.hook }, mouth = () => ({ x: f.x + (f.dir > 0 ? f.bw - 6 : 6), y: f.y + f.bh / 2 });
  tone([880], 0.05, 'sine', 0.05);
  await fishTween(420, (k) => { const m = mouth(), e = fishEase(k); s.hook = { x: from.x + (m.x - from.x) * e, y: from.y + (m.y - from.y) * e - Math.sin(k * Math.PI) * 60 }; });
  if (G.id !== 'fish') return;
  if (f.ok) await fishCatch(f); else await fishFail(f);
}
async function fishCatch(f) {
  const s = G.s;
  sfx.good();
  markResult(s.pk, f.w, true);
  s.score += 10 + s.caught.length; s.caught.push(f.w); s.speed = Math.min(1.8, s.speed * 1.04);
  fishFloat(f.x + f.bw / 2, f.y - 10, `+10 · ${gameForm(f.w)} = ${f.w.german}`, 'good');
  // Fisch zappelt, dann im Bogen aus dem Wasser in den Eimer
  f.el.classList.add('wiggle');
  s.pull = 0.6;
  await fishTween(380, (k) => { s.pull = 0.6 * (1 - k) + 0.25; });
  fishSplash(f.x + f.bw / 2, s.waterY, 10);
  const start = { x: f.x, y: f.y }, bucket = { x: s.avX + s.aw * 1.25, y: s.waterY - 46 };
  await fishTween(720, (k) => {
    const e = fishEase(k);
    f.x = start.x + (bucket.x - start.x) * e; f.y = start.y + (bucket.y - start.y) * e - Math.sin(k * Math.PI) * 120;
    f.el.style.transform = `translate3d(${f.x}px, ${f.y}px, 0) rotate(${(f.dir > 0 ? 1 : -1) * k * 360}deg) scale(${1 - k * 0.55})`;
    s.hook = { x: f.x + f.bw / 2, y: f.y + 10 };
  });
  f.el.remove();
  s.fish = s.fish.filter((x) => x !== f);
  s.pull = 0; s.casting = false;
  $('#fi-avatar')?.classList.add('cheer'); gLater(() => $('#fi-avatar')?.classList.remove('cheer'), 800);
  fishSparkles(bucket.x + 10, bucket.y);
  fishHud();
  gLater(() => fishRound(), 500);
}
async function fishFail(f) {
  const s = G.s;
  markResult(s.pk, s.cur, false);
  s.lives--;
  sfx.bad();
  // Der Fisch zieht! Rute biegt sich, Avatar lehnt sich nach vorne …
  const av = $('#fi-avatar');
  fishFloat(f.x + f.bw / 2, f.y - 10, `Uff! ${gameForm(f.w)} = ${f.w.german}`, 'bad');
  s.fish.filter((x) => x.ok).forEach((x) => x.el.classList.add('right'));
  await fishTween(600, (k) => {
    s.pull = Math.min(1, k * 1.4) * (0.8 + Math.sin(k * 30) * 0.2);
    f.x += f.dir * 2.5; f.y += Math.sin(k * 20) * 1.5;
    f.el.style.transform = `translate3d(${f.x}px, ${f.y}px, 0)`;
    s.hook = { x: f.x + (f.dir > 0 ? f.bw - 6 : 6), y: f.y + f.bh / 2 };
    if (av) av.style.transform = `rotate(${k * 22}deg)`;
  });
  if (G.id !== 'fish') return;
  // … und plumpst ins Wasser
  av.classList.add('falling');
  const x0 = s.avX, y0 = s.avY, x1 = Math.min(s.W * 0.42, s.avX + s.aw * 2.2), y1 = s.waterY + s.ah * 0.35;
  tone([300, 200, 120], 0.3, 'triangle', 0.08);
  await fishTween(700, (k) => {
    const e = k * k;
    av.style.left = `${x0 + (x1 - x0) * k}px`; av.style.top = `${y0 + (y1 - y0) * e - Math.sin(k * Math.PI) * 50}px`;
    av.style.transform = `rotate(${22 + k * 140}deg)`;
    s.hook = { x: f.x + f.bw / 2, y: f.y + 10 };
  });
  fishSplash(x1 + s.aw / 2, s.waterY, 26, true);
  tone([160, 90], 0.35, 'sine', 0.12);
  s.pull = 0; s.casting = false;
  // Der Fisch schwimmt mit der Angel davon
  f.hooked = false; f.leaving = true; f.v *= 3;
  f.el.classList.remove('hooked');
  for (let i = 0; i < 6; i++) gLater(() => fishBubble(x1 + s.aw / 2 + (Math.random() - 0.5) * 30, s.waterY + 30), i * 120);
  await fishTween(500, () => {});
  if (G.id !== 'fish') return;
  // Kopf taucht auf, schüttelt sich und klettert zurück auf den Steg
  av.style.transform = 'rotate(0deg)';
  await fishTween(450, (k) => { av.style.top = `${y1 + 40 - k * (s.ah * 0.55)}px`; });
  av.classList.add('shake');
  await fishTween(600, () => {});
  av.classList.remove('shake');
  await fishTween(650, (k) => { const e = fishEase(k); av.style.left = `${x1 + (x0 - x1) * e}px`; av.style.top = `${(y1 + 40 - s.ah * 0.55) + (y0 - (y1 + 40 - s.ah * 0.55)) * e - Math.sin(k * Math.PI) * 30}px`; });
  av.classList.remove('falling'); av.style.transform = ''; av.classList.add('drip');
  gLater(() => av.classList.remove('drip'), 1600);
  fishLayout();
  fishHud();
  if (s.lives <= 0) { fishEnd(); return; }
  fishRound();
}

/* ---------- Effekte ---------- */
function fishSplash(x, y, n, big) {
  const fx = $('#fi-fx');
  if (!fx) return;
  const ring = document.createElement('span');
  ring.className = `fi-ring ${big ? 'big' : ''}`; ring.style.left = `${x}px`; ring.style.top = `${y}px`;
  fx.appendChild(ring); setTimeout(() => ring.remove(), 1100);
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'fi-drop';
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, v = (big ? 140 : 90) + Math.random() * 90;
    d.style.left = `${x}px`; d.style.top = `${y}px`;
    d.style.setProperty('--dx', `${Math.cos(a) * v}px`); d.style.setProperty('--dy', `${Math.sin(a) * v}px`);
    fx.appendChild(d); setTimeout(() => d.remove(), 900);
  }
}
function fishSparkles(x, y) {
  const fx = $('#fi-fx');
  if (!fx) return;
  for (let i = 0; i < 10; i++) {
    const d = document.createElement('i');
    d.className = 'fi-spark'; d.textContent = ['✨', '⭐', '💫'][i % 3];
    const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 50;
    d.style.left = `${x}px`; d.style.top = `${y}px`;
    d.style.setProperty('--dx', `${Math.cos(a) * v}px`); d.style.setProperty('--dy', `${Math.sin(a) * v - 30}px`);
    fx.appendChild(d); setTimeout(() => d.remove(), 900);
  }
}
function fishBubble(x, y) {
  const s = G.s, box = $('#fi-bubbles');
  if (!box || !s.W) return;
  const b = document.createElement('i');
  const r = 4 + Math.random() * 8;
  b.style.left = `${x ?? Math.random() * s.W}px`; b.style.top = `${(y ?? s.H - 10) - s.waterY}px`;
  b.style.width = b.style.height = `${r}px`;
  b.style.setProperty('--rise', `${-((y ?? s.H) - s.waterY - 10)}px`);
  box.appendChild(b); setTimeout(() => b.remove(), 3200);
}
function fishFloat(x, y, text, kind) {
  const fx = $('#fi-fx');
  if (!fx) return;
  const el = document.createElement('div');
  el.className = `fi-float ${kind}`; el.textContent = text;
  el.style.left = `${Math.max(80, Math.min(G.s.W - 80, x))}px`; el.style.top = `${Math.max(70, y)}px`;
  fx.appendChild(el); setTimeout(() => el.remove(), 1900);
}
function fishHud() {
  const s = G.s;
  const sc = $('#fi-score'); if (sc) sc.textContent = `${s.score} Punkte`;
  const c = $('#fi-catch'); if (c) c.textContent = `🪣 ${s.caught.length}`;
  const b = $('#fi-bucket-n'); if (b) { b.textContent = s.caught.length; b.parentElement.classList.remove('bump'); void b.offsetWidth; b.parentElement.classList.add('bump'); }
  const lv = $('#fi-lives'); if (lv) lv.textContent = '🪱'.repeat(Math.max(0, s.lives)) + '·'.repeat(Math.max(0, 3 - s.lives));
}
function fishEnd() {
  const s = G.s;
  s.done = true;
  s.fish.forEach((f) => { f.leaving = true; });
  const record = gameRecord(s.set, 'fish', s.score);
  const box = $('#fi-end');
  if (!box) return;
  const list = [...new Map(s.caught.map((w) => [w.id, w])).values()];
  box.hidden = false;
  box.innerHTML = `<div class="fi-endbox"><div class="game-end-art" aria-hidden="true">🎣</div>
    <h2>${record ? 'Neuer Rekord!' : 'Die Würmer sind alle!'}</h2>
    <p class="lead"><b>${s.score}</b> Punkte · ${s.caught.length} ${s.caught.length === 1 ? 'Fisch' : 'Fische'} gefangen</p>
    ${list.length ? `<div class="fi-catchlist"><p class="small">🪣 Fang des Tages</p><ul>${list.slice(0, 12).map((w) => `<li><b lang="${s.lang}">${esc(gameForm(w))}</b> ${esc(w.german)}</li>`).join('')}</ul></div>` : ''}
    <div class="row center"><button class="btn primary" data-action="fish-level" data-level="${s.fishLevel}">${icon('shuffle')} Nochmal</button>
      <button class="btn ghost" data-action="game-again">Anderer Ort</button><button class="btn ghost" data-action="games">Anderes Spiel</button></div></div>`;
  if (s.caught.length >= 8 && typeof confetti === 'function') confetti();
}

const fishActions = {
  'fish-level': (el) => fishBegin(currentSet(), +el.dataset.level || 1),
};
