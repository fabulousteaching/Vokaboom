/* Vokaboom – Wörterregen
 * Regentropfen mit deutschen Wörtern fallen aus den Wolken. Wer das Wort in der Fremdsprache tippt, bringt den
 * Tropfen zum Zerplatzen. Verpasste Tropfen fallen ins Wasser: der Pegel steigt. Jedes gelöste Wort lässt eine
 * Seerose aufblühen. Die Stufen kommen nacheinander im selben Spiel: Nieseln → Regen → Gewitter.
 * Zwei Arten: Antippen (Wort aus Knöpfen wählen) oder Eintippen (Wort schreiben).
 * Szene (Himmel, Stadt, Wolken, Regen, Wasser, Spritzer) auf einem <canvas>, die Tropfen als DOM-Elemente
 * (scharfe Schrift, gut lesbar).
 */
'use strict';

const RAIN_LEVELS = {
  1: { name: 'Nieseln', icon: '🌦️', fall: 15, fallMin: 8.5, every: 4.6, everyMin: 2.9, max: 2, streaks: 70, storm: false,
    sky: ['#8FA9BF', '#C9D7E2', '#E9EFF3'], city: '#F3EEE4', win: '#3B4A5C', rain: '80,105,135' },
  2: { name: 'Regen', icon: '🌧️', fall: 12, fallMin: 6.5, every: 3.7, everyMin: 2.2, max: 3, streaks: 130, storm: false,
    sky: ['#6F8396', '#A7B5C1', '#D3DBE2'], city: '#E8E2D6', win: '#33404F', rain: '70,90,115' },
  3: { name: 'Gewitter', icon: '⛈️', fall: 9.5, fallMin: 5, every: 3, everyMin: 1.8, max: 4, streaks: 190, storm: true,
    sky: ['#3B4652', '#66727E', '#97A2AC'], city: '#CFC8BB', win: '#252E38', rain: '210,220,235' },
};
const RAIN_MAX_LEVEL = 3; // drei Fehler (Tropfen im Meer oder falsche Antwort), dann versinkt die Stadt – Atlantis
const RAIN_UP = { 1: 8, 2: 18 }; // so viele gelöste Wörter, dann regnet es stärker
const RAIN_MODE_KEY = 'vokaboom.rainMode';

function rainDefaultMode() {
  try { const m = localStorage.getItem(RAIN_MODE_KEY); if (m === 'tap' || m === 'type') return m; } catch { /* egal */ }
  return typeof kidReviewMode === 'function' && kidReviewMode() === 'choice' ? 'tap' : 'type';
}
function startRain(set) {
  const lang = LANGS[langOf(set)].name;
  $('#view').innerHTML = gameShell('Wörterregen', `<div class="test-card setup choose-card rain-choose">
    <h2>Wie willst du spielen?</h2>
    <p class="muted">Bring die Tropfen zum Platzen, bevor sie ins Wasser fallen. Es fängt mit Nieseln an, dann regnet es stärker – am Schluss kommt ein Gewitter.</p>
    <div class="choose-grid">
      <button class="choose-tile rain-tile rain-tile-tap" data-action="rain-start" data-mode="tap">
        <span class="choose-demo big-emoji" aria-hidden="true">👆</span>
        <strong>Antippen</strong><small>Tippe das passende Wort auf ${lang} an.</small></button>
      <button class="choose-tile rain-tile rain-tile-type" data-action="rain-start" data-mode="type">
        <span class="choose-demo big-emoji" aria-hidden="true">⌨️</span>
        <strong>Eintippen</strong><small>Schreib das Wort auf ${lang} selbst.</small></button>
    </div>
    <p class="small muted">🌦️ Nieseln → 🌧️ Regen → ⛈️ Gewitter</p>
  </div>`);
  $(`.rain-tile-${rainDefaultMode()}`)?.classList.add('last');
}

function rainBegin(set, mode) {
  stopGame();
  G.id = 'rain';
  mode = mode === 'tap' ? 'tap' : 'type';
  try { localStorage.setItem(RAIN_MODE_KEY, mode); } catch { /* egal */ }
  const L = RAIN_LEVELS[1];
  const words = gameWords(set);
  // „Nochmal“ nach dem Versinken: das Wasser sinkt ab und die Stadt baut sich wieder auf, dann beginnt der Regen
  const again = G.id === 'rain' && !!G.s.done && (G.s.atl || 0) > 0.3;
  Object.assign(G.s, {
    rainMode: mode, lv: 1, L, set, words, pk: makePicker(words), lang: langOf(set),
    drops: [], sinking: [], slots: [], parts: [], ripples: [], lilies: [], streaks: [], clouds: [], bgOld: null, bgFade: 0, wacc: 0,
    score: 0, combo: 0, best: 0, hits: 0, almost: 0, missed: [], pegel: 0, pegelShown: 0,
    speed: 1, nextSpawn: again ? 2.6 : 0.8, t: 0, last: 0, flash: 0, bolt: null, nextBolt: 6 + Math.random() * 6,
    shake: 0, paused: false, done: false, atl: again ? 1 : 0, atlFx: null, s3: null, rebuildT0: again ? performance.now() : 0, reduce: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  });
  $('#view').innerHTML = gameShell('Wörterregen', `
    <div class="rain-hud">
      <span class="rain-score" id="rain-score">0</span>
      <span class="rain-combo" id="rain-combo" aria-live="polite"></span>
      <span class="rain-lvl" id="rain-lvl">${L.icon} ${L.name}</span>
      <span class="rain-hearts" id="rain-gauge" aria-label="Leben">❤️❤️❤️</span>
      <button type="button" class="icon-btn subtle rain-pause" data-action="rain-pause" aria-label="Pause">${icon('stop')}</button>
    </div>
    <div class="rain-stage" id="rain-stage">
      <canvas class="rain-canvas" id="rain-canvas" aria-hidden="true"></canvas>
      <div class="rain-drops" id="rain-drops" aria-live="polite"></div>
      <div class="rain-msg" id="rain-msg" hidden></div>
    </div>
    ${mode === 'tap' ? '<div class="rain-choices" id="rain-choices"></div>' : `<form class="rain-form" id="rain-form" autocomplete="off">
      <input id="rain-q" type="text" lang="${langOf(set)}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"
        enterkeyhint="done" placeholder="Wort auf ${LANGS[langOf(set)].name} tippen …" aria-label="Wort auf ${LANGS[langOf(set)].name}">
      <button class="btn primary" type="submit" aria-label="Prüfen">⏎</button>
    </form>`}`);
  const stage = $('#rain-stage'), cv = $('#rain-canvas'), input = $('#rain-q');
  if (mode === 'tap') rainSyncChoices();
  G.s.stage = stage; G.s.cv = cv; G.s.ctx = cv.getContext('2d'); G.s.dropsEl = $('#rain-drops');
  if (typeof s3Rain === 'function') s3Rain(); // Stadt im Avatar-Stil (3D)
  rainResize();
  const onResize = () => { rainResize(); };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  const onVis = () => { if (document.hidden && !G.s.done) rainPause(true); };
  document.addEventListener('visibilitychange', onVis);
  G.rainCleanup = () => {
    window.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
  };
  if (input) {
    input.addEventListener('input', rainTyping);
    $('#rain-form').addEventListener('submit', (e) => { e.preventDefault(); rainSubmit(); });
    stage.addEventListener('pointerdown', () => input.focus());
  }
  // Spielfeld ganz zeigen
  const top = $('.rain-hud'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  if (input) setTimeout(() => input.focus({ preventScroll: true }), 120);
  if (again) { const drain = gEvery(() => { G.s.atl = Math.max(0, G.s.atl - 0.02); if (!G.s.atl) clearInterval(drain); }, 40); }
  G.s.last = performance.now();
  const loop = (now) => {
    if (G.id !== 'rain' || G.s.stage !== stage || !stage.isConnected) return; // alte Schleife (nach „Nochmal“) beendet sich
    const dt = Math.max(0, Math.min(0.05, (now - G.s.last) / 1000));
    G.s.last = now;
    if (!G.s.paused) rainStep(dt);
    rainDraw();
    G.raf = requestAnimationFrame(loop);
  };
  G.raf = requestAnimationFrame(loop);
}

/* ---------- Grösse, vorgezeichnete Ebenen ---------- */
function rainResize() {
  const s = G.s, stage = s.stage;
  if (!stage) return;
  // Bei offener Bildschirmtastatur (Handy) die Bühne kleiner machen, damit das Eingabefeld sichtbar bleibt
  const vv = window.visualViewport, vh = vv ? vv.height : innerHeight;
  const below = s.rainMode === 'tap' ? ($('#rain-choices')?.offsetHeight || 120) - 56 : 0; // Antwortknöpfe brauchen mehr Platz
  const h = Math.round(Math.max(260, Math.min(1000, vh - 210 - below))); // möglichst viel vom Bildschirm
  stage.style.height = `${h}px`;
  const W = stage.clientWidth, H = h, dpr = Math.min(2, window.devicePixelRatio || 1);
  s.W = W; s.H = H; s.dpr = dpr;
  s.cv.width = Math.round(W * dpr); s.cv.height = Math.round(H * dpr);
  s.cv.style.width = `${W}px`; s.cv.style.height = `${H}px`;
  s.waterBase = H * 0.84; // Wasseroberfläche bei Pegel 0
  s.bg = rainBackdrop(W, H, dpr, s.L); s.bgOld = null;
  // Wasseroberfläche als Federkette: Tropfen schlagen Wellen, die sich ausbreiten
  const n = Math.ceil(W / 6) + 2;
  if (!s.wave || s.wave.n !== n) s.wave = { n, dx: W / (n - 1), h: new Float32Array(n), v: new Float32Array(n) };
  else s.wave.dx = W / (n - 1);
  if (!s.streaks.length) s.streaks = Array.from({ length: s.reduce ? 20 : s.L.streaks }, () => rainStreak(W, H, true));
  if (!s.clouds.length) s.clouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * W, y: 10 + Math.random() * 42, r: 46 + Math.random() * 56, v: 4 + Math.random() * 8, a: 0.55 + Math.random() * 0.3, layer: i % 2 }));
  s.drops.forEach((d) => { d.x = Math.min(d.x, W - d.w / 2 - 8); });
}
/** Himmel, Mond, Stadt mit Fenstern – einmal pro Grösse gezeichnet */
function rainBackdrop(W, H, dpr, L) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, L.sky[0]); g.addColorStop(0.6, L.sky[1]); g.addColorStop(1, L.sky[2]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  let r = 11; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const base = H * 0.84;
  const shade = (hex, amt) => { const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(Math.max(0, Math.min(255, amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  // Berge in der Ferne (im Dunst)
  const hill = (y0, amp, col, seed) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, base); for (let px = 0; px <= W; px += 8) x.lineTo(px, y0 - Math.abs(Math.sin(px * 0.004 + seed)) * amp - Math.sin(px * 0.013 + seed) * amp * 0.2); x.lineTo(W, base); x.fill(); };
  hill(base - H * 0.28, H * 0.12, shade(L.sky[1], -0.18), 1.3);
  hill(base - H * 0.2, H * 0.08, shade(L.sky[1], -0.28), 4.1);
  // der Stadthügel
  const hx = W * 0.5, hw = W * 0.46, hh = H * 0.3;
  x.fillStyle = '#8f9a6e'; x.beginPath(); x.moveTo(hx - hw, base); x.quadraticCurveTo(hx - hw * 0.4, base - hh * 1.05, hx, base - hh); x.quadraticCurveTo(hx + hw * 0.45, base - hh * 1.02, hx + hw, base); x.fill();
  const hillY = (px) => { const t = Math.max(-1, Math.min(1, (px - hx) / hw)); return base - hh * (1 - t * t) * 0.98; };
  // Häuser in Terrassen: weiss/creme, flache Dächer oder blaue/rote Kuppeln, Bogenfenster
  const house = (px, py, w, h, roof) => {
    const wall = shade(L.city, (rnd() - 0.5) * 0.08);
    x.fillStyle = wall; x.fillRect(px, py - h, w, h);
    x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(px + w * 0.78, py - h, w * 0.22, h);
    x.fillStyle = L.win;
    const nw = Math.max(1, Math.floor(w / 12));
    for (let k = 0; k < nw; k++) { const wx = px + 4 + k * (w - 8) / nw, wy = py - h * 0.62; x.beginPath(); x.moveTo(wx, wy + 8); x.lineTo(wx, wy + 3); x.arc(wx + 2.5, wy + 3, 2.5, Math.PI, 0); x.lineTo(wx + 5, wy + 8); x.fill(); }
    if (roof === 'dome') { x.fillStyle = rnd() < 0.6 ? '#3D7CC9' : '#C8553D'; x.beginPath(); x.arc(px + w / 2, py - h, w * 0.32, Math.PI, 0); x.fill(); x.fillStyle = wall; x.fillRect(px + w / 2 - 1, py - h - w * 0.32 - 5, 2, 5); }
    else if (roof === 'tile') { x.fillStyle = '#B9543C'; x.beginPath(); x.moveTo(px - 2, py - h); x.lineTo(px + w / 2, py - h - h * 0.35); x.lineTo(px + w + 2, py - h); x.fill(); }
    else { x.fillStyle = shade(L.city, -0.12); x.fillRect(px - 1, py - h - 3, w + 2, 3); }
  };
  for (let row = 0; row < 5; row++) {
    let px = hx - hw * (0.85 - row * 0.13);
    const end = hx + hw * (0.85 - row * 0.13);
    while (px < end) {
      const w = 18 + rnd() * 26, h = 14 + rnd() * 16;
      const gy = hillY(px + w / 2) + row * H * 0.045 + 6;
      if (gy < base) house(px, Math.min(base, gy), w, h, rnd() < 0.22 ? 'dome' : rnd() < 0.4 ? 'tile' : 'flat');
      px += w + 2 + rnd() * 5;
    }
  }
  // Tempel mit Säulen oben auf dem Hügel
  { const tw = Math.min(150, W * 0.16), tx = hx - tw / 2, ty = hillY(hx) + 4, th = tw * 0.42;
    x.fillStyle = shade(L.city, 0.05); x.fillRect(tx - 6, ty - 8, tw + 12, 8); x.fillRect(tx - 3, ty - 13, tw + 6, 5);
    const n = 6; for (let k = 0; k < n; k++) { const cx0 = tx + 6 + k * (tw - 12) / (n - 1); x.fillStyle = shade(L.city, 0.08); x.fillRect(cx0 - 4, ty - 13 - th, 8, th); x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(cx0 + 1, ty - 13 - th, 3, th); }
    x.fillStyle = shade(L.city, 0.02); x.fillRect(tx - 6, ty - 19 - th, tw + 12, 7);
    x.beginPath(); x.moveTo(tx - 8, ty - 19 - th); x.lineTo(tx + tw / 2, ty - 19 - th - tw * 0.18); x.lineTo(tx + tw + 8, ty - 19 - th); x.fill(); }
  // Turm am Hafen (antiker Leuchtturm) rechts
  { const lx = W * 0.88, lh = H * 0.3;
    x.fillStyle = shade(L.city, -0.04); x.fillRect(lx - 16, base - lh * 0.45, 32, lh * 0.45); x.fillRect(lx - 11, base - lh * 0.8, 22, lh * 0.35); x.fillRect(lx - 7, base - lh, 14, lh * 0.2);
    x.fillStyle = '#E0A526'; x.beginPath(); x.arc(lx, base - lh - 3, 6, 0, Math.PI * 2); x.fill(); }
  // Zypressen
  for (const px of [W * 0.1, W * 0.17, W * 0.74, W * 0.8]) { const gy = Math.min(base, hillY(px) + 8); x.fillStyle = '#2E4A2E'; x.beginPath(); x.ellipse(px, gy - 26, 6, 26, 0, 0, Math.PI * 2); x.fill(); }
  // Hafenmauer
  x.fillStyle = shade(L.city, -0.25); x.fillRect(0, base - 6, W, 8);
  x.fillStyle = 'rgba(0,0,0,.12)'; for (let px = 0; px < W; px += 22) x.fillRect(px, base - 6, 1.5, 8);
  // Dunst über der Stadt (Regen)
  const fog = x.createLinearGradient(0, base - H * 0.45, 0, base);
  fog.addColorStop(0, 'rgba(255,255,255,0)'); fog.addColorStop(1, L.storm ? 'rgba(160,170,180,.25)' : 'rgba(230,236,240,.28)');
  x.fillStyle = fog; x.fillRect(0, base - H * 0.45, W, H * 0.45);
  return c;
}
function rainStreak(W, H, anyY) {
  const z = Math.random();
  return { x: Math.random() * (W + 80) - 40, y: anyY ? Math.random() * H : -20 - Math.random() * 60, len: 10 + z * 22, v: 380 + z * 520, a: 0.12 + z * 0.3, w: 0.6 + z * 1.1 };
}

/* ---------- Tropfen ---------- */
function rainSpawn() {
  const s = G.s;
  const onScreen = new Set(s.drops.map((d) => d.w));
  let w = null;
  for (let i = 0; i < 6; i++) { const c = pickNext(s.pk); if (!onScreen.has(c) && !s.drops.some((d) => d.w.german === c.german)) { w = c; break; } }
  if (!w) return;
  const text = w.german || gameForm(w);
  const size = Math.max(84, Math.min(150, 58 + text.length * 7.2));
  const W = s.W;
  // freie Bahn suchen (nicht über einem anderen Tropfen, der noch oben ist)
  let x = 0;
  for (let t = 0; t < 12; t++) {
    x = size / 2 + 10 + Math.random() * Math.max(10, W - size - 20);
    if (!s.drops.some((d) => Math.abs(d.x - x) < (d.size + size) / 2 + 6 && d.y < 160)) break;
  }
  const el = document.createElement('div');
  el.className = 'rdrop';
  el.style.width = `${size}px`; el.style.height = `${size * 1.28}px`;
  el.innerHTML = `<svg viewBox="0 0 100 128" aria-hidden="true"><defs>
      <radialGradient id="rg${s.t | 0}${w.id}" cx="38%" cy="62%" r="70%"><stop offset="0" stop-color="#E8F6FF" stop-opacity=".95"/><stop offset=".45" stop-color="#8CCBFF" stop-opacity=".78"/><stop offset="1" stop-color="#3D7FD9" stop-opacity=".88"/></radialGradient></defs>
      <path class="rd-body" d="M50 3 C 50 3, 92 58, 92 84 A 42 42 0 1 1 8 84 C 8 58, 50 3, 50 3 Z" fill="url(#rg${s.t | 0}${w.id})"/>
      <path d="M50 3 C 50 3, 92 58, 92 84 A 42 42 0 1 1 8 84 C 8 58, 50 3, 50 3 Z" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2"/>
      <ellipse cx="33" cy="70" rx="9" ry="16" fill="rgba(255,255,255,.75)" transform="rotate(24 33 70)"/>
      <circle cx="68" cy="104" r="4" fill="rgba(255,255,255,.5)"/></svg>
    <span class="rd-text" lang="de" style="font-size:${Math.max(0.78, Math.min(1.15, 11 / Math.max(6, text.length) + 0.32))}rem">${esc(text)}</span>`;
  s.dropsEl.appendChild(el);
  const fall = Math.max(s.L.fallMin, s.L.fall / s.speed);
  s.drops.push({ w, el, x, y: -size * 1.3, size, v: (s.waterBase + size * 1.3) / fall, ph: Math.random() * 6.28, born: s.t });
  if (s.rainMode === 'tap') rainSyncChoices();
}
function rainStep(dt) {
  const s = G.s;
  s.t += dt;
  // neue Tropfen
  s.nextSpawn -= dt;
  if (s.nextSpawn <= 0 && s.drops.length < s.L.max && !s.done) {
    rainSpawn();
    s.nextSpawn = Math.max(s.L.everyMin, s.L.every / s.speed) * (0.8 + Math.random() * 0.4);
  } else if (!s.drops.length && s.nextSpawn > 0.6) s.nextSpawn = 0.6;
  const surf = rainSurface();
  for (const d of s.drops.slice()) {
    d.y += d.v * dt;
    d.sway = Math.sin(s.t * 1.6 + d.ph) * 6;
    const bottom = d.y + d.size * 1.28;
    d.el.style.transform = `translate3d(${(d.x - d.size / 2 + d.sway).toFixed(1)}px, ${d.y.toFixed(1)}px, 0) scaleY(${(1 + Math.min(0.06, d.v / 6000)).toFixed(3)})`;
    if (bottom >= rainWaterY(d.x) + 2) rainMiss(d);
  }
  // verpasste Tropfen tauchen ins Wasser ein und werden zu Wasser
  for (const d of s.sinking) {
    d.age += dt;
    d.v = Math.max(40, d.v * (1 - dt * 3.2));
    d.y += d.v * dt;
    const hgt = d.size * 1.28, cut = Math.max(0, Math.min(hgt, d.y + hgt - rainWaterY(d.x)));
    const sq = 1 + Math.min(0.25, d.age * 0.8);
    d.el.style.transform = `translate3d(${(d.x - d.size / 2 + d.sway).toFixed(1)}px, ${d.y.toFixed(1)}px, 0) scaleX(${sq.toFixed(3)})`;
    d.el.style.clipPath = `inset(0 -20% ${cut.toFixed(1)}px -20%)`;
    rainKick(d.x, d.size * 0.3, 1.6 * dt * 60 * Math.max(0, 1 - d.age * 1.5));
    if (cut >= hgt - 1 || d.age > 1.4) { d.el.remove(); d.dead = true; }
  }
  s.sinking = s.sinking.filter((d) => !d.dead);
  rainWave(dt);
  // Hintergrundregen
  const ang = s.L.storm ? 0.22 : 0.12;
  for (const r of s.streaks) {
    r.y += r.v * dt; r.x += r.v * ang * dt;
    if (r.y > surf) {
      if (!s.reduce && Math.random() < 0.25) s.ripples.push({ x: r.x, y: surf + 2 + Math.random() * (s.H - surf - 4), r: 1, max: 6 + Math.random() * 8, a: 0.35 });
      if (!s.reduce && Math.random() < 0.35) rainKick(r.x, 4, s.L.storm ? 0.9 : 0.45);
      Object.assign(r, rainStreak(s.W, s.H, false));
    }
  }
  s.clouds.forEach((c) => { c.x += c.v * dt * (c.layer ? 1.4 : 1); if (c.x - c.r > s.W) c.x = -c.r * 1.5; });
  // Partikel
  for (const p of s.parts) {
    p.life -= dt;
    if (p.kind === 'drop' || p.kind === 'jet') {
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vy > 0 && p.y > rainWaterY(p.x)) { p.life = 0; rainKick(p.x, 5, p.kind === 'jet' ? 3 : 1.2); }
    }
    else { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.rot += dt * 4; }
  }
  s.parts = s.parts.filter((p) => p.life > 0);
  for (const r of s.ripples) { r.r += dt * (r.big ? 90 : 26); r.a -= dt * (r.big ? 0.55 : 0.9); }
  s.ripples = s.ripples.filter((r) => r.a > 0 && r.r < r.max);
  s.lilies.forEach((l) => { l.grow = Math.min(1, l.grow + dt * 1.6); });
  s.pegelShown += (s.pegel - s.pegelShown) * Math.min(1, dt * 3);
  // Gewitter
  if (s.L.storm && !s.reduce) {
    s.nextBolt -= dt;
    if (s.nextBolt <= 0) { s.flash = 1; s.bolt = rainBolt(); s.shake = 0.35; s.nextBolt = 5 + Math.random() * 7; tone([70, 55], 0.5, 'sawtooth', 0.04); }
  }
  s.flash = Math.max(0, s.flash - dt * 2.6);
  s.bgFade = Math.max(0, s.bgFade - dt * 0.45);
  if (s.bgFade <= 0) s.bgOld = null;
  if (s.flash <= 0) s.bolt = null;
  s.shake = Math.max(0, s.shake - dt);
}
const rainSurface = () => G.s.waterBase - (G.s.pegelShown / RAIN_MAX_LEVEL) * G.s.H * 0.3 - (G.s.atl || 0) * G.s.H * 0.9;
/** Höhe der Wasseroberfläche an der Stelle px (mit Wellen) */
function rainWaterY(px) {
  const s = G.s, wv = s.wave;
  let off = 0;
  if (wv) {
    const f = Math.max(0, Math.min(wv.n - 1.001, px / wv.dx)), i = f | 0, k = f - i;
    off = wv.h[i] * (1 - k) + wv.h[i + 1] * k;
  }
  return rainSurface() + off + Math.sin(px / 38 + s.t * 1.8) * 1.6 + Math.sin(px / 17 - s.t * 2.6) * 0.8;
}
/** Stoss ins Wasser: drückt die Oberfläche um x herum nach unten */
function rainKick(x, r, force) {
  const wv = G.s.wave;
  if (!wv || !force) return;
  const c = x / wv.dx, rr = Math.max(1, r / wv.dx);
  for (let i = Math.max(0, Math.floor(c - rr)); i <= Math.min(wv.n - 1, Math.ceil(c + rr)); i++) {
    const t = 1 - Math.abs(i - c) / (rr + 1);
    if (t > 0) wv.v[i] += force * t * t;
  }
}
/** Wellen rechnen (Federn + Ausbreitung), feste 60 Schritte pro Sekunde */
function rainWave(dt) {
  const s = G.s, wv = s.wave;
  if (!wv) return;
  s.wacc = Math.min(0.1, s.wacc + dt);
  const { h, v, n } = wv;
  while (s.wacc >= 1 / 60) {
    s.wacc -= 1 / 60;
    for (let i = 0; i < n; i++) { v[i] += -0.022 * h[i] - 0.03 * v[i]; h[i] += v[i]; }
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < n; i++) {
        if (i > 0) { const d = 0.22 * (h[i] - h[i - 1]); v[i - 1] += d; }
        if (i < n - 1) { const d = 0.22 * (h[i] - h[i + 1]); v[i + 1] += d; }
      }
    }
    for (let i = 0; i < n; i++) { if (h[i] > 40) h[i] = 40; else if (h[i] < -40) h[i] = -40; }
  }
}
function rainBolt() {
  const s = G.s, pts = [[s.W * (0.15 + Math.random() * 0.7), 0]];
  while (pts[pts.length - 1][1] < s.H * 0.6) { const [px, py] = pts[pts.length - 1]; pts.push([px + (Math.random() - 0.5) * 50, py + 18 + Math.random() * 26]); }
  return pts;
}

/* ---------- Zeichnen ---------- */
function rainDraw() {
  const s = G.s, x = s.ctx;
  if (!x || !s.bg) return;
  const { W, H, dpr } = s;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sh = s.shake > 0 ? (Math.random() - 0.5) * 6 * s.shake : 0;
  x.save(); x.translate(sh, 0);
  if (s.s3?.alive) x.clearRect(0, 0, W, H); // Stadt und Himmel zeichnet die 3D-Szene darunter
  else x.drawImage(s.bg, 0, 0, W, H);
  if (!s.s3?.alive && s.bgOld && s.bgFade > 0) { x.globalAlpha = s.bgFade; x.drawImage(s.bgOld, 0, 0, W, H); x.globalAlpha = 1; }
  // Blitz-Licht
  if (s.flash > 0) { x.fillStyle = `rgba(210,225,255,${s.flash * 0.45})`; x.fillRect(0, 0, W, H); }
  if (s.bolt) {
    x.strokeStyle = `rgba(255,255,255,${0.6 + s.flash * 0.4})`; x.lineWidth = 2.4; x.shadowColor = '#BFD6FF'; x.shadowBlur = 18;
    x.beginPath(); s.bolt.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); x.shadowBlur = 0;
  }
  // Wolken (zwei Ebenen)
  for (const c of s.clouds) {
    const g = x.createRadialGradient(c.x, c.y, c.r * 0.2, c.x, c.y, c.r);
    const col = s.L.storm ? '70,78,92' : s.L.name === 'Regen' ? '150,160,172' : '215,222,230';
    g.addColorStop(0, `rgba(${col},${c.a})`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.beginPath(); x.ellipse(c.x, c.y, c.r * 1.6, c.r * 0.7, 0, 0, Math.PI * 2); x.fill();
  }
  // Hintergrundregen
  const ang = s.L.storm ? 0.22 : 0.12;
  x.lineCap = 'round';
  for (const r of s.streaks) {
    x.strokeStyle = `rgba(${s.L.rain || '200,225,255'},${r.a})`; x.lineWidth = r.w;
    x.beginPath(); x.moveTo(r.x, r.y); x.lineTo(r.x - r.len * ang, r.y - r.len); x.stroke();
  }
  // Wasser
  const surf = rainSurface();
  const wg = x.createLinearGradient(0, surf, 0, H);
  const ta = 1 - (s.atl || 0) * 0.45; // in Atlantis klarer: die versunkene Stadt ist zu sehen
  wg.addColorStop(0, s.L.storm ? `rgba(30,80,110,${0.72 * ta})` : `rgba(30,120,170,${0.66 * ta})`); wg.addColorStop(1, s.L.storm ? `rgba(8,24,48,${0.94 * ta})` : `rgba(10,40,90,${0.93 * ta})`);
  x.fillStyle = wg;
  x.beginPath(); x.moveTo(0, H);
  const wy = [];
  for (let px = 0; px <= W + 5; px += 5) wy.push([Math.min(px, W), rainWaterY(Math.min(px, W))]);
  wy.forEach(([px, py]) => x.lineTo(px, py));
  x.lineTo(W, H); x.closePath(); x.fill();
  // Unter Wasser: Lichtstrahlen, Blasen; in Atlantis Fische und Seetang an den Häusern
  if (s.atl > 0 || surf < H * 0.8) rainUnder(x, surf);
  // Spiegelung der Stadtlichter
  x.save(); x.globalAlpha = 0.18 * (1 - (s.atl || 0)); x.beginPath(); x.rect(0, surf, W, H - surf); x.clip();
  if (!s.s3?.alive) { x.translate(0, surf * 2); x.scale(1, -1); x.drawImage(s.bg, 0, 0, W, H); } x.restore();
  // Glanzlinie
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.2; x.beginPath();
  wy.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.stroke();
  // Wellenringe
  for (const r of s.ripples) {
    x.strokeStyle = `rgba(220,235,255,${Math.max(0, r.a)})`; x.lineWidth = r.big ? 2 : 1;
    x.beginPath(); x.ellipse(r.x, r.y, r.r, r.r * 0.28, 0, 0, Math.PI * 2); x.stroke();
  }
  // Seerosen (gelöste Wörter)
  for (const l of s.lilies) rainLily(x, l, surf);
  // Partikel
  for (const p of s.parts) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    if (p.kind === 'drop') { x.fillStyle = `rgba(190,225,255,${a})`; x.beginPath(); x.arc(p.x, p.y, p.r, 0, Math.PI * 2); x.fill(); }
    else if (p.kind === 'jet') { // längliche Tropfen der Spritzkrone, in Flugrichtung gestreckt
      const sp = Math.hypot(p.vx, p.vy) || 1, st = Math.min(3.2, 1 + sp / 260);
      x.save(); x.translate(p.x, p.y); x.rotate(Math.atan2(p.vy, p.vx));
      x.fillStyle = `rgba(215,236,255,${Math.min(1, a * 1.2)})`; x.beginPath(); x.ellipse(0, 0, p.r * st, p.r, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = `rgba(255,255,255,${a * 0.8})`; x.beginPath(); x.arc(p.r * st * 0.35, -p.r * 0.3, p.r * 0.35, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    else {
      x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = `hsla(${p.hue},95%,72%,${a})`;
      x.beginPath(); for (let i = 0; i < 5; i++) { const ang2 = (i * 4 * Math.PI) / 5 - Math.PI / 2; x.lineTo(Math.cos(ang2) * p.r, Math.sin(ang2) * p.r); } x.closePath(); x.fill(); x.restore();
    }
  }
  x.restore();
}
function rainUnder(x, surf) {
  const s = G.s, { W, H, t } = s, a = Math.min(1, (s.atl || 0) * 1.5);
  x.save(); x.beginPath(); x.rect(0, Math.max(0, surf), W, H); x.clip();
  // Lichtstrahlen
  for (let i = 0; i < 5; i++) {
    const rx = (i / 5) * W + Math.sin(t * 0.3 + i) * 30, g = x.createLinearGradient(0, surf, 0, H);
    g.addColorStop(0, `rgba(200,240,255,${0.10 + a * 0.08})`); g.addColorStop(1, 'rgba(200,240,255,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(rx, surf); x.lineTo(rx + 50, surf); x.lineTo(rx + 140, H); x.lineTo(rx + 60, H); x.fill();
  }
  if (a > 0) {
    // Atlantis: Seetang an den Häusern, Fische, Blasen aus den Fenstern
    s.atlFx = s.atlFx || { fish: Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * W, y: H * (0.3 + Math.random() * 0.6), v: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 30), c: ['#ffb84d', '#ff6f91', '#4ecdc4', '#ffd166'][i % 4], sz: 6 + Math.random() * 6 })), bub: Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: H * Math.random(), r: 1 + Math.random() * 3, v: 20 + Math.random() * 40 })) };
    x.globalAlpha = a;
    for (let i = 0; i < 14; i++) { const kx = (i / 14) * W + 10, kh = 40 + (i % 4) * 22; x.strokeStyle = i % 2 ? '#2f8a5a' : '#3fa66a'; x.lineWidth = 4; x.beginPath(); x.moveTo(kx, H); for (let k = 1; k <= 6; k++) x.lineTo(kx + Math.sin(t * 1.4 + i + k) * 6, H - (kh * k) / 6); x.stroke(); }
    for (const f of s.atlFx.fish) {
      f.x += f.v / 60; if (f.x < -30) f.x = W + 30; if (f.x > W + 30) f.x = -30;
      x.fillStyle = f.c; x.beginPath(); x.ellipse(f.x, f.y + Math.sin(t * 2 + f.x * 0.02) * 4, f.sz * 1.6, f.sz, 0, 0, Math.PI * 2); x.fill();
      const dir = f.v > 0 ? -1 : 1; x.beginPath(); x.moveTo(f.x + dir * f.sz * 1.4, f.y); x.lineTo(f.x + dir * f.sz * 2.6, f.y - f.sz); x.lineTo(f.x + dir * f.sz * 2.6, f.y + f.sz); x.fill();
    }
    x.strokeStyle = 'rgba(220,245,255,.7)'; x.lineWidth = 1;
    for (const b of s.atlFx.bub) { b.y -= b.v / 60; if (b.y < surf) b.y = H + 5; x.beginPath(); x.arc(b.x + Math.sin(t + b.y * 0.05) * 3, b.y, b.r, 0, Math.PI * 2); x.stroke(); }
    x.globalAlpha = 1;
  }
  x.restore();
}
function rainLily(x, l, surf) {
  const bob = Math.sin(G.s.t * 1.5 + l.ph) * 1.6, k = easeOutBack(l.grow), y = rainWaterY(l.x) + 6 + l.dy + bob;
  x.save(); x.translate(l.x, y); x.scale(k, k);
  x.fillStyle = '#2E9E5B'; x.beginPath(); x.ellipse(0, 0, 22, 7, 0, 0.25, Math.PI * 2 - 0.25); x.lineTo(0, 0); x.fill();
  x.fillStyle = '#48C27A'; x.beginPath(); x.ellipse(-2, -1, 16, 4.5, 0, 0.3, Math.PI * 2 - 0.3); x.lineTo(-2, -1); x.fill();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    x.fillStyle = i % 2 ? l.c2 : l.c1;
    x.save(); x.translate(0, -4); x.rotate(a + Math.PI / 2); x.beginPath(); x.ellipse(0, -8, 3.6, 9, 0, 0, Math.PI * 2); x.fill(); x.restore();
  }
  x.fillStyle = '#FFD54A'; x.beginPath(); x.arc(0, -5, 3, 0, Math.PI * 2); x.fill();
  x.restore();
}
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/* ---------- Tippen ---------- */
function rainAnswers(w) { return [gameForm(w), ...answerAlts(w.foreign).map(stripParens)].map((a) => normAnswer(a)).filter(Boolean); }
function rainTyping() {
  const s = G.s, q = $('#rain-q')?.value || '';
  if (s.done) return;
  const nq = normAnswer(q);
  let hit = null;
  for (const d of s.drops) {
    if (d.gone) continue;
    if (checkAnswer(q, d.w, s.lang).status === 'correct') { hit = d; break; }
  }
  if (hit) { rainPop(hit, 'correct'); return; }
  // Tropfen, der zum Getippten passt, leuchtet
  s.drops.forEach((d) => d.el.classList.toggle('aim', nq.length >= 2 && rainAnswers(d.w).some((a) => a.startsWith(nq))));
}
function rainSubmit() {
  const s = G.s, input = $('#rain-q');
  if (s.done || !input) return;
  if (s.paused) { rainPause(false); return; }
  const q = input.value;
  if (!q.trim()) return;
  let best = null;
  for (const d of s.drops) {
    const st = checkAnswer(q, d.w, s.lang).status;
    if (st === 'correct') { best = { d, st }; break; }
    if (st === 'almost' && !best) best = { d, st };
  }
  if (best) { rainPop(best.d, best.st); return; }
  input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
  s.combo = 0;
  sfx.bad();
  input.select();
  rainStrike(s.W / 2, 'Falsch!');
}
function rainPop(d, status) {
  const s = G.s;
  d.gone = true;
  s.drops = s.drops.filter((x) => x !== d);
  markResult(s.pk, d.w, true, status); // Tippfehler = „fast“
  const cx = d.x, cy = d.y + d.size * 0.85;
  const pts = status === 'correct' ? 10 + Math.min(20, s.combo * 2) : 5;
  if (status === 'correct') { s.combo++; s.hits++; } else { s.almost++; s.combo = 0; }
  s.best = Math.max(s.best, s.combo);
  s.score += pts;
  s.speed = Math.min(1.8, s.speed * 1.03);
  if (RAIN_UP[s.lv] && s.hits + s.almost >= RAIN_UP[s.lv]) rainLevelUp();
  // Zerplatzen: Spritzer + Glitzer
  const n = s.reduce ? 6 : 18;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
    s.parts.push({ kind: 'drop', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180, r: 1.5 + Math.random() * 2.8, life: 1, max: 1 });
  }
  for (let i = 0; i < (s.reduce ? 3 : 10); i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
    s.parts.push({ kind: 'star', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3 + Math.random() * 4, rot: Math.random() * 6, hue: 40 + Math.random() * 180, life: 0.9, max: 0.9 });
  }
  // Seerose wächst
  const colors = [['#FF8FB1', '#FFC2D4'], ['#FFFFFF', '#FFE3EE'], ['#C9A4FF', '#E7D6FF'], ['#FFB86B', '#FFE0B8']];
  const [c1, c2] = colors[s.hits % colors.length];
  s.lilies.push({ x: 24 + Math.random() * (s.W - 48), dy: Math.random() * Math.max(4, (s.H - rainSurface()) - 18), ph: Math.random() * 6, grow: 0, c1, c2 });
  if (s.lilies.length > 26) s.lilies.shift();
  d.el.classList.add('pop', status);
  setTimeout(() => d.el.remove(), 420);
  rainFloat(cx, cy - d.size * 0.4, status === 'correct' ? `+${pts}` : `+${pts} · ${gameForm(d.w)}`, status);
  (status === 'correct' ? sfx.good : sfx.almost)();
  const input = $('#rain-q'); if (input) input.value = '';
  s.drops.forEach((x) => x.el.classList.remove('aim'));
  rainHud();
}
/** Nächste Stufe im selben Spiel: Nieseln → Regen → Gewitter */
function rainLevelUp() {
  const s = G.s;
  s.lv++;
  s.L = RAIN_LEVELS[s.lv];
  s.speed = 1;
  s.bgOld = s.bg; s.bgFade = 1;
  s.bg = rainBackdrop(s.W, s.H, s.dpr, s.L);
  const want = s.reduce ? 20 : s.L.streaks;
  while (s.streaks.length < want) s.streaks.push(rainStreak(s.W, s.H, false));
  if (s.L.storm) s.nextBolt = 1.2;
  const lv = $('#rain-lvl');
  if (lv) { lv.textContent = `${s.L.icon} ${s.L.name}`; lv.classList.remove('up'); void lv.offsetWidth; lv.classList.add('up'); }
  const el = document.createElement('div');
  el.className = 'rain-levelup';
  el.innerHTML = `<span aria-hidden="true">${s.L.icon}</span>${s.L.storm ? 'Gewitter! Jetzt wird’s wild!' : 'Es regnet stärker!'}`;
  s.dropsEl.appendChild(el);
  setTimeout(() => el.remove(), 2600);
  tone([523, 659, 784], 0.14, 'triangle', 0.07);
  if (s.rainMode === 'tap') rainSyncChoices();
}
/* ---------- Antippen: Knöpfe mit Wörtern in der Fremdsprache ---------- */
const rainKey = (w) => normAnswer(gameForm(w));
function rainSyncChoices() {
  const s = G.s, box = $('#rain-choices');
  if (!box) return;
  const n = Math.min(s.L.max + 2, Math.max(2, new Set(s.words.map(rainKey)).size));
  if (s.slots.length > n) s.slots.length = n;
  while (s.slots.length < n) s.slots.push(null);
  const needed = s.drops.filter((d) => !d.gone).map((d) => d.w);
  const has = (w) => s.slots.some((x) => x && rainKey(x) === rainKey(w));
  const isNeeded = (x) => x && needed.some((w) => rainKey(w) === rainKey(x));
  const changed = new Set();
  for (const w of needed) {
    if (has(w)) continue;
    const free = s.slots.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
    const spare = s.slots.map((x, i) => (x && !isNeeded(x) ? i : -1)).filter((i) => i >= 0);
    const pool = free.length ? free : spare;
    if (!pool.length) continue;
    const i = pool[Math.floor(Math.random() * pool.length)];
    s.slots[i] = w; changed.add(i);
    // damit der neue Knopf nicht verrät, welcher richtig ist: auch einen anderen austauschen
    const other = spare.filter((j) => j !== i);
    if (!free.length && other.length) { const j = other[Math.floor(Math.random() * other.length)]; s.slots[j] = null; changed.add(j); }
  }
  for (let i = 0; i < n; i++) {
    if (s.slots[i]) continue;
    const cand = shuffle(s.words.filter((w) => !has(w)));
    s.slots[i] = cand[0] || s.words[Math.floor(Math.random() * s.words.length)];
    changed.add(i);
  }
  if (box.children.length !== n) {
    box.style.setProperty('--n', n); box.style.setProperty('--n2', Math.ceil(n / 2));
    box.innerHTML = s.slots.map((w, i) => `<button type="button" class="rain-choice" data-action="rain-pick" data-i="${i}" lang="${s.lang}">${esc(gameForm(w))}</button>`).join('');
    return;
  }
  changed.forEach((i) => {
    const b = box.children[i];
    if (!b) return;
    b.textContent = gameForm(s.slots[i]);
    b.classList.remove('new', 'shake'); void b.offsetWidth; b.classList.add('new');
  });
}
function rainPick(i) {
  const s = G.s, w = s.slots[i], b = $('#rain-choices')?.children[i];
  if (!w || s.done) return;
  if (s.paused) { rainPause(false); return; }
  const d = s.drops.find((x) => !x.gone && rainKey(x.w) === rainKey(w));
  if (d) { b?.classList.remove('new', 'shake'); rainPop(d, 'correct'); return; }
  if (b) { b.classList.remove('shake', 'new'); void b.offsetWidth; b.classList.add('shake'); }
  s.combo = 0;
  sfx.bad();
  rainStrike(s.W / 2, `Falsch: ${gameForm(w)}`);
}
/** Fehler: das Meer steigt eine Stufe, ein Leben weg */
function rainStrike(x, text) {
  const s = G.s;
  if (s.done) return;
  s.pegel = Math.min(RAIN_MAX_LEVEL, s.pegel + 1);
  rainKick(x, 60, 6);
  rainFloat(x, rainSurface() - 60, text, 'miss');
  rainHud();
  if (s.pegel >= RAIN_MAX_LEVEL) rainEnd();
}
function rainMiss(d) {
  const s = G.s;
  d.gone = true;
  s.drops = s.drops.filter((x) => x !== d);
  markResult(s.pk, d.w, false);
  s.missed.push(d.w);
  s.combo = 0;
  s.pegel = Math.min(RAIN_MAX_LEVEL, s.pegel + 1);
  const surf = rainWaterY(d.x), cx = d.x + (d.sway || 0), half = d.size * 0.42;
  // Spritzkrone: Tropfen spritzen schräg nach aussen und oben, in der Mitte schiesst eine Säule hoch
  const nCrown = s.reduce ? 8 : 26;
  for (let i = 0; i < nCrown; i++) {
    const side = i % 2 ? 1 : -1, a = -Math.PI / 2 + side * (0.35 + Math.random() * 0.75), v = 220 + Math.random() * 260;
    s.parts.push({ kind: 'jet', x: cx + side * half * (0.4 + Math.random() * 0.6), y: surf, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.8 + Math.random() * 2.6, life: 1.4, max: 1.4 });
  }
  if (!s.reduce) {
    for (let i = 0; i < 3; i++) s.parts.push({ kind: 'jet', x: cx + (Math.random() - 0.5) * 6, y: surf - 4, vx: (Math.random() - 0.5) * 40, vy: -(340 + i * 70 + Math.random() * 60), r: 3.6 - i * 0.7, life: 1.6, max: 1.6 });
  }
  rainKick(cx, half, 7);
  s.ripples.push({ x: cx, y: surf + 3, r: 4, max: 110, a: 0.9, big: true }, { x: cx, y: surf + 3, r: 1, max: 70, a: 0.7, big: true });
  // Der Tropfen taucht ein (wird unten abgeschnitten) statt zu verschwinden
  Object.assign(d, { age: 0, v: d.v * 0.55, sway: d.sway || 0 });
  d.el.classList.add('sink');
  s.sinking.push(d);
  rainFloat(d.x, surf - Math.min(110, d.size * 0.9), `${d.w.german} = ${gameForm(d.w)}`, 'miss'); // Lösung zeigen
  tone([220, 130], 0.22, 'sine', 0.08);
  rainHud();
  if (s.pegel >= RAIN_MAX_LEVEL) rainEnd();
}
function rainFloat(x, y, text, kind) {
  const s = G.s, el = document.createElement('div');
  el.className = `rain-float ${kind}`;
  el.textContent = text;
  el.style.left = `${Math.max(60, Math.min(s.W - 60, x))}px`; el.style.top = `${y}px`;
  s.dropsEl.appendChild(el);
  setTimeout(() => el.remove(), kind === 'miss' ? 2400 : 1200);
}
function rainHud() {
  const s = G.s;
  const sc = $('#rain-score'); if (sc) { sc.textContent = s.score; sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump'); }
  const cb = $('#rain-combo'); if (cb) cb.textContent = s.combo >= 3 ? `🔥 ${s.combo}er-Kombo` : '';
  const g = $('#rain-gauge'); if (g) g.textContent = '❤️'.repeat(Math.max(0, RAIN_MAX_LEVEL - s.pegel)) + '🤍'.repeat(Math.min(RAIN_MAX_LEVEL, s.pegel));
}
function rainPause(on) {
  const s = G.s;
  if (s.done) return;
  s.paused = on ?? !s.paused;
  const m = $('#rain-msg');
  if (m) {
    m.hidden = !s.paused;
    m.innerHTML = s.paused ? `<div class="rain-pausebox"><strong>Pause</strong><button class="btn primary" data-action="rain-pause">${icon('right')} Weiter</button></div>` : '';
  }
  if (!s.paused) { s.last = performance.now(); $('#rain-q')?.focus({ preventScroll: true }); }
}
function rainEnd() {
  const s = G.s;
  if (s.done) return;
  s.done = true;
  s.drops.forEach((d) => d.el.classList.add('fade'));
  // die Stadt versinkt im Meer …
  s.atl = 0;
  const sink = gEvery(() => { s.atl = Math.min(1, s.atl + 0.02); }, 40);
  tone([392, 330, 262, 196], 0.35, 'sine', 0.06);
  const record = gameRecord(s.set, 'rain', s.score);
  const missed = [...new Map(s.missed.map((w) => [w.id, w])).values()].slice(0, 8);
  gLater(() => {
    if (G.id !== 'rain') return;
    const m = $('#rain-msg');
    if (!m) return;
    m.hidden = false;
    m.innerHTML = `<div class="rain-endbox">
      <div class="rain-end-art" aria-hidden="true">🔱</div>
      <h2>${record ? 'Neuer Rekord!' : 'Die Stadt ist versunken!'}</h2>
      <p class="small">Willkommen in <b>Atlantis</b> 🐠</p>
      <p class="lead"><b>${s.score}</b> Punkte · ${s.hits} Wörter gelöst${s.almost ? ` · ${s.almost} fast richtig` : ''}${s.best >= 3 ? ` · beste Kombo ${s.best}` : ''}</p>
      ${missed.length ? `<div class="rain-missed"><p class="small">Diese Wörter sind ins Wasser gefallen:</p><ul>${missed.map((w) => `<li><b lang="${s.lang}">${esc(gameForm(w))}</b> <span>${esc(w.german)}</span></li>`).join('')}</ul></div>` : ''}
      <p class="small muted">Erreicht: ${s.L.icon} ${s.L.name}</p>
      <div class="row center"><button class="btn primary" data-action="rain-start" data-mode="${s.rainMode}">${icon('shuffle')} Nochmal</button>
        <button class="btn ghost" data-action="game-again">${s.rainMode === 'tap' ? 'Lieber eintippen' : 'Lieber antippen'}</button>
        <button class="btn ghost" data-action="games">Anderes Spiel</button></div>
    </div>`;
    if (s.hits >= 8 && typeof confetti === 'function') confetti();
  }, 4600); // zuerst die versunkene Stadt zeigen
}

const rainActions = {
  'rain-start': (el) => rainBegin(currentSet(), el.dataset.mode),
  'rain-pick': (el) => rainPick(+el.dataset.i),
  'rain-pause': () => rainPause(),
};
