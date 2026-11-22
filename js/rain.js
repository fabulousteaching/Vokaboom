/* Vokaboom – Wörterregen
 * Regentropfen mit deutschen Wörtern fallen aus den Wolken. Wer das Wort in der Fremdsprache tippt, bringt den
 * Tropfen zum Zerplatzen. Verpasste Tropfen fallen ins Wasser: der Pegel steigt. Jedes gelöste Wort lässt eine
 * Seerose aufblühen. Stufen: Nieseln, Regen, Gewitter.
 * Szene (Himmel, Stadt, Wolken, Regen, Wasser, Spritzer) auf einem <canvas>, die Tropfen als DOM-Elemente
 * (scharfe Schrift, gut lesbar).
 */
'use strict';

const RAIN_LEVELS = {
  1: { name: 'Nieseln', icon: '🌦️', fall: 15, fallMin: 8.5, every: 4.6, everyMin: 2.9, max: 2, streaks: 70, storm: false,
    sky: ['#2B2D6E', '#6A4C93', '#E98A9B'], city: '#2A2457', win: '#FFD58A' },
  2: { name: 'Regen', icon: '🌧️', fall: 12, fallMin: 6.5, every: 3.7, everyMin: 2.2, max: 3, streaks: 130, storm: false,
    sky: ['#0F1C3F', '#24427A', '#4B79B6'], city: '#14213F', win: '#FFE29A' },
  3: { name: 'Gewitter', icon: '⛈️', fall: 9.5, fallMin: 5, every: 3, everyMin: 1.8, max: 4, streaks: 190, storm: true,
    sky: ['#070B1A', '#1C2440', '#3A4565'], city: '#0B1022', win: '#C9D8FF' },
};
const RAIN_MAX_LEVEL = 5; // Pegel: so viele verpasste Tropfen, dann ist das Wasser oben

function startRain(set) {
  const lv = G.s.rainLevel || 1;
  $('#view').innerHTML = gameShell('Wörterregen', `<div class="test-card setup choose-card rain-choose">
    <h2>Wie stark regnet es?</h2>
    <p class="muted">Tippe das Wort auf ${LANGS[langOf(set)].name}, bevor der Tropfen ins Wasser fällt.</p>
    <div class="choose-grid three">
      ${[1, 2, 3].map((n) => `<button class="choose-tile rain-tile rain-tile-${n}" data-action="rain-level" data-level="${n}">
        <span class="choose-demo big-emoji" aria-hidden="true">${RAIN_LEVELS[n].icon}</span>
        <strong>${RAIN_LEVELS[n].name}</strong><small>${['Langsam, höchstens 2 Tropfen.', 'Schneller, bis 3 Tropfen.', 'Blitz und Donner, bis 4 Tropfen!'][n - 1]}</small></button>`).join('')}
    </div>
    <p class="small muted">Tipp: Kleine Tippfehler? Drück ⏎ – fast richtig gibt halbe Punkte.</p>
  </div>`);
  $(`.rain-tile-${lv}`)?.classList.add('last');
}

function rainBegin(set, level) {
  stopGame();
  G.id = 'rain';
  const L = RAIN_LEVELS[level];
  const words = gameWords(set);
  Object.assign(G.s, {
    rainLevel: level, L, set, words, pk: makePicker(words), lang: langOf(set),
    drops: [], parts: [], ripples: [], lilies: [], streaks: [], clouds: [],
    score: 0, combo: 0, best: 0, hits: 0, almost: 0, missed: [], pegel: 0, pegelShown: 0,
    speed: 1, nextSpawn: 0.8, t: 0, last: 0, flash: 0, bolt: null, nextBolt: 6 + Math.random() * 6,
    shake: 0, paused: false, done: false, reduce: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  });
  $('#view').innerHTML = gameShell('Wörterregen', `
    <div class="rain-hud">
      <span class="rain-score" id="rain-score">0</span>
      <span class="rain-combo" id="rain-combo" aria-live="polite"></span>
      <span class="rain-lvl" title="${L.name}">${L.icon} ${L.name}</span>
      <span class="rain-gauge" id="rain-gauge" title="Wasserpegel" aria-label="Wasserpegel">${'<i></i>'.repeat(RAIN_MAX_LEVEL)}</span>
      <button type="button" class="icon-btn subtle rain-pause" data-action="rain-pause" aria-label="Pause">${icon('stop')}</button>
    </div>
    <div class="rain-stage" id="rain-stage">
      <canvas class="rain-canvas" id="rain-canvas" aria-hidden="true"></canvas>
      <div class="rain-drops" id="rain-drops" aria-live="polite"></div>
      <div class="rain-msg" id="rain-msg" hidden></div>
    </div>
    <form class="rain-form" id="rain-form" autocomplete="off">
      <input id="rain-q" type="text" lang="${langOf(set)}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"
        enterkeyhint="done" placeholder="Wort auf ${LANGS[langOf(set)].name} tippen …" aria-label="Wort auf ${LANGS[langOf(set)].name}">
      <button class="btn primary" type="submit" aria-label="Prüfen">⏎</button>
    </form>`);
  const stage = $('#rain-stage'), cv = $('#rain-canvas'), input = $('#rain-q');
  G.s.stage = stage; G.s.cv = cv; G.s.ctx = cv.getContext('2d'); G.s.dropsEl = $('#rain-drops');
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
  input.addEventListener('input', rainTyping);
  $('#rain-form').addEventListener('submit', (e) => { e.preventDefault(); rainSubmit(); });
  stage.addEventListener('pointerdown', () => input.focus());
  // Spielfeld ganz zeigen
  const top = $('.rain-hud'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  setTimeout(() => input.focus({ preventScroll: true }), 120);
  G.s.last = performance.now();
  const loop = (now) => {
    if (G.id !== 'rain' || !G.s.stage?.isConnected) return;
    const dt = Math.min(0.05, (now - G.s.last) / 1000);
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
  const h = Math.round(Math.max(260, Math.min(1000, vh - 210))); // möglichst viel vom Bildschirm
  stage.style.height = `${h}px`;
  const W = stage.clientWidth, H = h, dpr = Math.min(2, window.devicePixelRatio || 1);
  s.W = W; s.H = H; s.dpr = dpr;
  s.cv.width = Math.round(W * dpr); s.cv.height = Math.round(H * dpr);
  s.cv.style.width = `${W}px`; s.cv.style.height = `${H}px`;
  s.waterBase = H * 0.84; // Wasseroberfläche bei Pegel 0
  s.bg = rainBackdrop(W, H, dpr, s.L);
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
  g.addColorStop(0, L.sky[0]); g.addColorStop(0.55, L.sky[1]); g.addColorStop(1, L.sky[2]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // Mond mit Schein
  if (!L.storm) {
    const mx = W * 0.82, my = H * 0.2;
    const glow = x.createRadialGradient(mx, my, 4, mx, my, 90);
    glow.addColorStop(0, 'rgba(255,240,210,.45)'); glow.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = glow; x.fillRect(mx - 100, my - 100, 200, 200);
    x.fillStyle = 'rgba(255,246,225,.92)'; x.beginPath(); x.arc(mx, my, 17, 0, Math.PI * 2); x.fill();
  }
  // Sterne (nur bei leichtem Regen)
  if (L.name === 'Nieseln') for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`; x.fillRect(Math.random() * W, Math.random() * H * 0.45, 1.4, 1.4); }
  // Stadt: zwei Ebenen, hinten heller und neblig
  const skyline = (base, minH, maxH, col, winA, seed) => {
    let px = -10, r = seed;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    while (px < W + 20) {
      const bw = 26 + rnd() * 52, bh = minH + rnd() * (maxH - minH);
      x.fillStyle = col; x.fillRect(px, base - bh, bw, bh + 4);
      if (rnd() > 0.6) { x.fillRect(px + bw * 0.4, base - bh - 14, 3, 14); } // Antenne
      for (let wy = base - bh + 8; wy < base - 10; wy += 11) {
        for (let wx = px + 5; wx < px + bw - 6; wx += 9) {
          if (rnd() < winA) { x.fillStyle = L.win; x.globalAlpha = 0.35 + rnd() * 0.55; x.fillRect(wx, wy, 4, 5); x.globalAlpha = 1; }
        }
      }
      px += bw + 2 + rnd() * 6;
    }
  };
  const base = H * 0.84;
  skyline(base, H * 0.2, H * 0.42, shade(L.city, 0.18), 0.12, 7);
  const fog = x.createLinearGradient(0, base - H * 0.42, 0, base);
  fog.addColorStop(0, 'rgba(255,255,255,0)'); fog.addColorStop(1, 'rgba(200,215,255,.14)');
  x.fillStyle = fog; x.fillRect(0, base - H * 0.42, W, H * 0.42);
  skyline(base, H * 0.1, H * 0.28, L.city, 0.22, 3);
  return c;
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(Math.min(255, v + (255 - v) * amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
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
    const sway = Math.sin(s.t * 1.6 + d.ph) * 6;
    const bottom = d.y + d.size * 1.28;
    d.el.style.transform = `translate3d(${(d.x - d.size / 2 + sway).toFixed(1)}px, ${d.y.toFixed(1)}px, 0) scaleY(${(1 + Math.min(0.06, d.v / 6000)).toFixed(3)})`;
    if (bottom >= surf + 6) rainMiss(d);
  }
  // Hintergrundregen
  const ang = s.L.storm ? 0.22 : 0.12;
  for (const r of s.streaks) {
    r.y += r.v * dt; r.x += r.v * ang * dt;
    if (r.y > surf) {
      if (!s.reduce && Math.random() < 0.25) s.ripples.push({ x: r.x, y: surf + 2 + Math.random() * (s.H - surf - 4), r: 1, max: 6 + Math.random() * 8, a: 0.35 });
      Object.assign(r, rainStreak(s.W, s.H, false));
    }
  }
  s.clouds.forEach((c) => { c.x += c.v * dt * (c.layer ? 1.4 : 1); if (c.x - c.r > s.W) c.x = -c.r * 1.5; });
  // Partikel
  for (const p of s.parts) {
    p.life -= dt;
    if (p.kind === 'drop') { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > rainSurface() && p.vy > 0) p.life = 0; }
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
  if (s.flash <= 0) s.bolt = null;
  s.shake = Math.max(0, s.shake - dt);
}
const rainSurface = () => G.s.waterBase - (G.s.pegelShown / RAIN_MAX_LEVEL) * G.s.H * 0.42;
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
  x.drawImage(s.bg, 0, 0, W, H);
  // Blitz-Licht
  if (s.flash > 0) { x.fillStyle = `rgba(210,225,255,${s.flash * 0.45})`; x.fillRect(0, 0, W, H); }
  if (s.bolt) {
    x.strokeStyle = `rgba(255,255,255,${0.6 + s.flash * 0.4})`; x.lineWidth = 2.4; x.shadowColor = '#BFD6FF'; x.shadowBlur = 18;
    x.beginPath(); s.bolt.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke(); x.shadowBlur = 0;
  }
  // Wolken (zwei Ebenen)
  for (const c of s.clouds) {
    const g = x.createRadialGradient(c.x, c.y, c.r * 0.2, c.x, c.y, c.r);
    const col = s.L.storm ? '70,78,105' : s.L.name === 'Regen' ? '120,140,175' : '190,170,210';
    g.addColorStop(0, `rgba(${col},${c.a})`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.beginPath(); x.ellipse(c.x, c.y, c.r * 1.6, c.r * 0.7, 0, 0, Math.PI * 2); x.fill();
  }
  // Hintergrundregen
  const ang = s.L.storm ? 0.22 : 0.12;
  x.lineCap = 'round';
  for (const r of s.streaks) {
    x.strokeStyle = `rgba(200,225,255,${r.a})`; x.lineWidth = r.w;
    x.beginPath(); x.moveTo(r.x, r.y); x.lineTo(r.x - r.len * ang, r.y - r.len); x.stroke();
  }
  // Wasser
  const surf = rainSurface();
  const wg = x.createLinearGradient(0, surf, 0, H);
  wg.addColorStop(0, s.L.storm ? 'rgba(40,60,100,.92)' : 'rgba(60,110,190,.9)'); wg.addColorStop(1, s.L.storm ? 'rgba(10,18,40,.98)' : 'rgba(20,40,100,.98)');
  x.fillStyle = wg;
  x.beginPath(); x.moveTo(0, H);
  for (let px = 0; px <= W; px += 8) x.lineTo(px, surf + Math.sin(px / 38 + s.t * 1.8) * 2.2 + Math.sin(px / 17 - s.t * 2.6) * 1.1);
  x.lineTo(W, H); x.closePath(); x.fill();
  // Spiegelung der Stadtlichter
  x.save(); x.globalAlpha = 0.18; x.beginPath(); x.rect(0, surf, W, H - surf); x.clip();
  x.translate(0, surf * 2); x.scale(1, -1); x.drawImage(s.bg, 0, 0, W, H); x.restore();
  // Glanzlinie
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.2; x.beginPath();
  for (let px = 0; px <= W; px += 8) { const py = surf + Math.sin(px / 38 + s.t * 1.8) * 2.2 + Math.sin(px / 17 - s.t * 2.6) * 1.1; px ? x.lineTo(px, py) : x.moveTo(px, py); }
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
    else {
      x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = `hsla(${p.hue},95%,72%,${a})`;
      x.beginPath(); for (let i = 0; i < 5; i++) { const ang2 = (i * 4 * Math.PI) / 5 - Math.PI / 2; x.lineTo(Math.cos(ang2) * p.r, Math.sin(ang2) * p.r); } x.closePath(); x.fill(); x.restore();
    }
  }
  x.restore();
}
function rainLily(x, l, surf) {
  const bob = Math.sin(G.s.t * 1.5 + l.ph) * 1.6, k = easeOutBack(l.grow), y = surf + 6 + l.dy + bob;
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
  s.combo = 0; rainHud();
  sfx.bad();
  input.select();
}
function rainPop(d, status) {
  const s = G.s;
  d.gone = true;
  s.drops = s.drops.filter((x) => x !== d);
  markResult(s.pk, d.w, true);
  const cx = d.x, cy = d.y + d.size * 0.85;
  const pts = status === 'correct' ? 10 + Math.min(20, s.combo * 2) : 5;
  if (status === 'correct') { s.combo++; s.hits++; } else { s.almost++; s.combo = 0; }
  s.best = Math.max(s.best, s.combo);
  s.score += pts;
  s.speed = Math.min(2.2, s.speed * 1.035);
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
function rainMiss(d) {
  const s = G.s;
  d.gone = true;
  s.drops = s.drops.filter((x) => x !== d);
  markResult(s.pk, d.w, false);
  s.missed.push(d.w);
  s.combo = 0;
  s.pegel = Math.min(RAIN_MAX_LEVEL, s.pegel + 1);
  const surf = rainSurface();
  for (let i = 0; i < (s.reduce ? 6 : 16); i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 160 + Math.random() * 220;
    s.parts.push({ kind: 'drop', x: d.x, y: surf, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.6 + Math.random() * 2.6, life: 1, max: 1 });
  }
  s.ripples.push({ x: d.x, y: surf + 3, r: 4, max: 90, a: 0.9, big: true }, { x: d.x, y: surf + 3, r: 1, max: 60, a: 0.7, big: true });
  d.el.classList.add('splash');
  setTimeout(() => d.el.remove(), 300);
  rainFloat(d.x, surf - 34, `${d.w.german} = ${gameForm(d.w)}`, 'miss'); // Lösung zeigen
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
  $$('#rain-gauge i').forEach((el, i) => el.classList.toggle('on', i < s.pegel));
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
  const record = gameRecord(s.set, 'rain', s.score);
  const missed = [...new Map(s.missed.map((w) => [w.id, w])).values()].slice(0, 8);
  gLater(() => {
    if (G.id !== 'rain') return;
    const m = $('#rain-msg');
    if (!m) return;
    m.hidden = false;
    m.innerHTML = `<div class="rain-endbox">
      <div class="rain-end-art" aria-hidden="true">${s.hits >= 10 ? '🌈' : '☔'}</div>
      <h2>${record ? 'Neuer Rekord!' : 'Der Pegel ist voll!'}</h2>
      <p class="lead"><b>${s.score}</b> Punkte · ${s.hits} Wörter gelöst${s.almost ? ` · ${s.almost} fast richtig` : ''}${s.best >= 3 ? ` · beste Kombo ${s.best}` : ''}</p>
      ${missed.length ? `<div class="rain-missed"><p class="small">Diese Wörter sind ins Wasser gefallen:</p><ul>${missed.map((w) => `<li><b lang="${s.lang}">${esc(gameForm(w))}</b> <span>${esc(w.german)}</span></li>`).join('')}</ul></div>` : ''}
      <div class="row center"><button class="btn primary" data-action="rain-level" data-level="${s.rainLevel}">${icon('shuffle')} Nochmal</button>
        <button class="btn ghost" data-action="game-again">Andere Stufe</button>
        <button class="btn ghost" data-action="games">Anderes Spiel</button></div>
    </div>`;
    if (s.hits >= 8 && typeof confetti === 'function') confetti();
  }, 900);
}

const rainActions = {
  'rain-level': (el) => rainBegin(currentSet(), +el.dataset.level || 1),
  'rain-pause': () => rainPause(),
};
