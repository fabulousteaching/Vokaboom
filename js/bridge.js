/* Vokaboom – Brückenbau mit dem eigenen Avatar
 * Der Avatar steht am Rand einer Schlucht. Jede richtige Antwort setzt ein Brett, eine falsche lässt das Brett in die
 * Tiefe fallen. Ist die Brücke fertig, läuft der Avatar hinüber. Jedes Mal eine andere Landschaft und Brücke:
 * Hängebrücke über dem Dschungelfluss, Holzbrücke über der Felsschlucht, Eisbrücke im Gebirge, Steinbrücke über Lava.
 * Länge (10–20 Bretter) und Fragen (Auswählen/Eintippen) richten sich danach, wie gut das Kind die Wörter schon kann.
 */
'use strict';

const BRIDGE_THEMES = {
  jungle: { name: 'Hängebrücke im Dschungel', sky: ['#7ED6C3', '#E3FAF0'], far: '#5FAF8E', cliff: ['#6B8E3A', '#4E3A24'], deep: ['#1E7F8C', '#0B3F4D'], plank: ['#D9AE62', '#9C7134'], rope: '#7A5A2E', sag: 0.09, posts: true, ropes: true, deco: 'river' },
  canyon: { name: 'Holzbrücke über der Felsschlucht', sky: ['#FFB76B', '#FFE3C2'], far: '#D98452', cliff: ['#C8653A', '#6E2F1A'], deep: ['#5A2416', '#1E0B07'], plank: ['#B98552', '#7A5230'], rope: '#5B3A1E', sag: 0.05, posts: true, ropes: true, deco: 'birds' },
  ice: { name: 'Eisbrücke im Gebirge', sky: ['#9CC6FF', '#F0F6FF'], far: '#C9DBF2', cliff: ['#F4F8FF', '#8DA8C8'], deep: ['#5C7FA8', '#1D2F4D'], plank: ['#CFEAFF', '#86B8E0'], rope: '#6C8FB5', sag: 0, posts: false, ropes: false, deco: 'snow' },
  lava: { name: 'Steinbrücke über dem Vulkan', sky: ['#2A0F35', '#8A2C2C'], far: '#4A1F35', cliff: ['#4B4452', '#1E1A24'], deep: ['#FF7A1A', '#B81D0D'], plank: ['#8D8794', '#55505C'], rope: '#2E2A33', sag: 0.03, posts: true, ropes: false, deco: 'lava' },
};
const BRIDGE_ORDER = ['jungle', 'canyon', 'ice', 'lava'];

/** Animation (läuft nur, solange der Brückenbau offen ist) */
function brTween(ms, fn) {
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1 && G.id === 'bridge') requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
}

function startBridge(set) {
  const sk = runnerSkill(set);
  const n = [10, 12, 14, 17, 20][sk.stage - 1] || 10;
  // jedes Mal eine andere Landschaft
  const last = db.settings.bridgeLast || '';
  const theme = BRIDGE_ORDER[(BRIDGE_ORDER.indexOf(last) + 1) % BRIDGE_ORDER.length];
  db.settings.bridgeLast = theme; saveDB();
  bridgeBegin(set, theme, n, sk.stage);
}

function bridgeBegin(set, theme, n, stage) {
  stopGame();
  G.id = 'bridge';
  const T = BRIDGE_THEMES[theme];
  const words = gameWords(set);
  Object.assign(G.s, { set, lang: langOf(set), words, pk: makePicker(words), theme, T, n, stage, placed: 0, wrong: 0, q: 0, busy: false, done: false, walking: false, cur: null });
  const av = avatarSVG(fishAvatar(), { bg: false, label: 'Dein Avatar' });
  $('#view').innerHTML = gameShell('Brückenbau', `
    <div class="br-hud"><span class="br-theme">${esc(T.name)}</span><span class="br-count" id="br-count">0 / ${n} Bretter</span></div>
    <div class="br-stage br-${theme}" id="br-stage">
      <svg class="br-svg" id="br-svg" aria-hidden="true"></svg>
      <div class="br-avatar" id="br-avatar">${av}</div>
      <div class="br-fx" id="br-fx"></div>
      <div class="br-end" id="br-end" hidden></div>
    </div>
    <div class="br-panel" id="br-panel" aria-live="polite"></div>`);
  G.s.el = $('#br-stage');
  bridgeLayout();
  const onResize = () => { bridgeLayout(); };
  window.addEventListener('resize', onResize);
  G.bridgeCleanup = () => window.removeEventListener('resize', onResize);
  const top = $('.br-hud'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  bridgeAsk();
  if (typeof s3Bridge === 'function') s3Bridge();
  // 3D-Avatar (wenn möglich): schaut zur Schlucht und feuert an
  if (typeof gavMount === 'function') gavMount($('#br-avatar'), { rotY: 0.45 }).then((c) => { if (c && G.id === 'bridge') { G.s.av3 = c; c.setAnim('idle'); } });
}
/** kurze Bewegung des 3D-Avatars, danach wieder ruhig stehen */
function brAnim(name, ms = 1100, after = 'idle') {
  const a = G.s.av3;
  if (!a?.alive || G.s.walking) return;
  a.setAnim(name);
  clearTimeout(G.s.animT);
  G.s.animT = setTimeout(() => { if (a.alive && !G.s.walking) a.setAnim(after); }, ms);
}

/* ---------- Szene ---------- */
function bridgeLayout() {
  const s = G.s, st = s.el, svg = $('#br-svg');
  if (!st || !svg) return;
  const W = st.clientWidth, H = st.clientHeight, T = s.T;
  s.W = W; s.H = H;
  s.top = Math.round(H * 0.58);
  s.L = Math.round(Math.max(90, W * 0.17)); s.R = Math.round(Math.max(80, W * 0.15));
  const gap = W - s.L - s.R;
  s.slot = (i) => {
    const t = (i + 0.5) / s.n;
    return { x: s.L + gap * t, y: s.top + T.sag * gap * Math.sin(Math.PI * t), w: gap / s.n - 3, a: Math.atan(T.sag * gap * Math.PI * Math.cos(Math.PI * t) / gap) * 180 / Math.PI };
  };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const g = (id, c1, c2, vert = true) => `<linearGradient id="${id}" x1="0" y1="0" x2="${vert ? 0 : 1}" y2="${vert ? 1 : 0}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
  const mtn = Array.from({ length: 7 }, (_, i) => {
    const x = (i / 6) * W, h = H * (0.18 + ((i * 37) % 10) / 40);
    return `M${x - W * 0.14} ${s.top} L${x} ${s.top - h} L${x + W * 0.14} ${s.top}Z`;
  }).join('');
  const deco = {
    river: `<path class="br-water" d="M0 ${H - 28} Q${W * 0.25} ${H - 38} ${W * 0.5} ${H - 28} T${W} ${H - 28} V${H} H0Z" fill="#3FB8C9" opacity=".9"/>
      ${Array.from({ length: 6 }, (_, i) => `<path class="br-vine" d="M${s.L + 10 + i * 9} ${s.top} q6 30 -2 ${50 + i * 8}" stroke="#2F7A3E" stroke-width="3" fill="none"/>`).join('')}`,
    birds: `<g class="br-birds" fill="none" stroke="#5B2E1A" stroke-width="2.4"><path d="M0 0 q8 -8 16 0 q8 -8 16 0"/><path d="M50 22 q6 -6 12 0 q6 -6 12 0"/></g>`,
    snow: Array.from({ length: 24 }, (_, i) => `<circle class="br-flake" cx="${(i * 97) % W}" cy="${(i * 53) % H}" r="${1.5 + (i % 3)}" fill="#fff" style="animation-delay:${-(i % 7)}s;animation-duration:${6 + (i % 5)}s"/>`).join(''),
    lava: `<path class="br-lava" d="M0 ${H - 40} Q${W * 0.2} ${H - 52} ${W * 0.4} ${H - 40} T${W * 0.8} ${H - 40} T${W * 1.2} ${H - 40} V${H} H0Z" fill="#FFB020"/>
      ${Array.from({ length: 5 }, (_, i) => `<circle class="br-ember" cx="${s.L + (gap * (i + 0.5)) / 5}" cy="${H - 40}" r="3" fill="#FFD27A" style="animation-delay:${-i * 0.7}s"/>`).join('')}`,
  }[T.deco] || '';
  const cliff = (x0, x1, left) => {
    const d = left ? `M0 ${s.top} L${x1} ${s.top} L${x1 - 10} ${H} L0 ${H} Z` : `M${x0} ${s.top} L${W} ${s.top} L${W} ${H} L${x0 + 10} ${H} Z`;
    return `<path d="${d}" fill="url(#br-cliff)"/>
      <path d="M${x0} ${s.top} L${x1} ${s.top}" stroke="${T.cliff[0]}" stroke-width="6"/>`;
  };
  const postL = { x: s.L - 6, y: s.top }, postR = { x: W - s.R + 6, y: s.top };
  const ropeY = (x) => { const t = (x - s.L) / gap; return s.top - 34 + T.sag * gap * Math.sin(Math.PI * Math.max(0, Math.min(1, t))) * 0.75; };
  let rope = '';
  if (T.ropes) {
    const pts = Array.from({ length: 21 }, (_, i) => { const x = s.L + (gap * i) / 20; return `${x},${ropeY(x)}`; }).join(' ');
    rope = `<polyline points="${pts}" fill="none" stroke="${T.rope}" stroke-width="3" opacity=".9"/>`;
  }
  svg.innerHTML = `<defs>${g('br-sky', T.sky[0], T.sky[1])}${g('br-cliff', T.cliff[0], T.cliff[1])}${g('br-deep', T.deep[0], T.deep[1])}${g('br-plank', T.plank[0], T.plank[1])}</defs>
    <rect width="${W}" height="${H}" fill="url(#br-sky)"/>
    <path d="${mtn}" fill="${T.far}" opacity=".55"/>
    <rect x="0" y="${s.top}" width="${W}" height="${H - s.top}" fill="url(#br-deep)"/>
    ${deco}
    ${cliff(0, s.L, true)}${cliff(W - s.R, W, false)}
    ${T.posts ? `<rect x="${postL.x - 5}" y="${postL.y - 44}" width="10" height="48" rx="3" fill="${T.rope}"/><rect x="${postR.x - 5}" y="${postR.y - 44}" width="10" height="48" rx="3" fill="${T.rope}"/>` : ''}
    <g id="br-slots">${Array.from({ length: s.n }, (_, i) => { const p = s.slot(i); return `<rect x="${p.x - p.w / 2}" y="${p.y - 4}" width="${p.w}" height="8" rx="3" transform="rotate(${p.a} ${p.x} ${p.y})" fill="none" stroke="rgba(255,255,255,.45)" stroke-dasharray="4 3"/>`; }).join('')}</g>
    <g id="br-planks">${Array.from({ length: s.placed }, (_, i) => bridgePlankSVG(i)).join('')}</g>
    ${rope}
    <g class="br-goal" transform="translate(${W - s.R * 0.5} ${s.top})"><rect x="-2" y="-62" width="4" height="62" fill="#5B3A1E"/><path class="br-flag" d="M2 -62 L34 -52 L2 -42Z" fill="#FF5A5F"/>
      <g transform="translate(-30 -18)"><rect width="28" height="18" rx="4" fill="#A86B3C"/><rect y="-8" width="28" height="10" rx="5" fill="#C98B4E"/><rect x="11" y="-2" width="6" height="7" rx="1" fill="#FFD54A"/></g></g>`;
  // Avatar
  const aw = Math.round(Math.max(48, Math.min(124, s.L * 0.62, (s.top - 20) / 1.55)));
  s.aw = aw; s.ah = aw * 1.5;
  const av = $('#br-avatar');
  if (av && !s.walking) { av.style.width = `${aw}px`; av.style.left = `${s.L * 0.42 - aw / 2}px`; av.style.top = `${s.top - s.ah * 0.955}px`; }
}
function bridgePlankSVG(i, extra = '') {
  const s = G.s, p = s.slot(i), T = s.T;
  const h = T.deco === 'ice' ? 12 : 10;
  return `<g class="br-plank ${extra}" data-i="${i}" transform="translate(${p.x} ${p.y}) rotate(${p.a})"><rect x="${-p.w / 2}" y="${-h / 2}" width="${p.w}" height="${h}" rx="${T.deco === 'ice' ? 4 : 2}" fill="url(#br-plank)" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
    ${T.deco === 'ice' ? '' : `<line x1="${-p.w / 2 + 3}" y1="0" x2="${p.w / 2 - 3}" y2="0" stroke="rgba(0,0,0,.12)"/>`}
    ${T.ropes ? `<line x1="0" y1="${-h / 2}" x2="0" y2="-30" stroke="${T.rope}" stroke-width="1.4" opacity=".75"/>` : ''}</g>`;
}

/* ---------- Fragen ---------- */
function bridgeAsk() {
  const s = G.s, panel = $('#br-panel');
  if (!panel || s.done) return;
  const w = pickNext(s.pk);
  s.cur = w; s.q++;
  // gute Kinder: öfter eintippen
  const type = s.stage >= 4 ? s.q % 3 !== 0 : s.stage === 3 ? s.q % 2 === 0 : false;
  s.mode = type ? 'type' : 'choice';
  const L = LANGS[s.lang].name;
  if (s.mode === 'type') {
    panel.innerHTML = `<p class="br-q"><small>Brett ${s.placed + 1} von ${s.n} · Schreib auf ${L}</small><strong lang="de">${esc(w.german || '?')}</strong></p>
      <form class="br-form" id="br-form" autocomplete="off"><input id="br-in" type="text" lang="${s.lang}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="${L} …"><button class="btn primary" type="submit">${icon('check')}</button></form>`;
    $('#br-form').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#br-in').value; if (!v.trim()) return; const r = checkAnswer(v, w, s.lang); bridgeAnswer(r.status !== 'wrong', r.status === 'almost' ? `Fast: ${gameForm(w)}` : ''); });
    setTimeout(() => $('#br-in')?.focus({ preventScroll: true }), 60);
  } else {
    const key = (x) => gameForm(x).toLowerCase();
    const opts = shuffle([w, ...shuffle(s.words.filter((x) => x !== w && key(x) !== key(w))).slice(0, 3)]);
    s.opts = opts;
    panel.innerHTML = `<p class="br-q"><small>Brett ${s.placed + 1} von ${s.n} · Was heisst das auf ${L}?</small><strong lang="de">${esc(w.german || '?')}</strong></p>
      <div class="br-opts">${opts.map((o, i) => `<button class="br-opt" data-action="br-pick" data-i="${i}" lang="${s.lang}">${esc(gameForm(o))}</button>`).join('')}</div>`;
  }
  panel.classList.remove('in'); void panel.offsetWidth; panel.classList.add('in');
  s.busy = false;
}
function bridgePick(i) {
  const s = G.s, o = s.opts?.[i];
  if (!o || s.busy) return;
  const ok = o === s.cur;
  $$('.br-opt').forEach((b, j) => { b.disabled = true; if (s.opts[j] === s.cur) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
  bridgeAnswer(ok);
}
async function bridgeAnswer(ok, note = '') {
  const s = G.s;
  if (s.busy || s.done) return;
  s.busy = true;
  markResult(s.pk, s.cur, ok);
  const panel = $('#br-panel');
  if (ok) {
    sfx.good();
    if (note && panel) panel.insertAdjacentHTML('beforeend', `<p class="br-note">${esc(note)}</p>`);
    brAnim(s.placed % 3 === 2 ? 'cheer' : s.placed % 3 === 1 ? 'clap' : 'present', 1000);
    await bridgeDropPlank(s.placed);
    s.placed++;
    $('#br-count').textContent = `${s.placed} / ${s.n} Bretter`;
    if (s.placed >= s.n) { bridgeWalk(); return; }
  } else {
    sfx.bad();
    s.wrong++;
    if (panel) panel.insertAdjacentHTML('beforeend', `<p class="br-note bad">Richtig ist: <b lang="${s.lang}">${esc(gameForm(s.cur))}</b></p>`);
    brAnim('oops', 700, 'shy');
    setTimeout(() => brAnim('shy', 1200), 700);
    await bridgeFallPlank(s.placed);
  }
  gLater(() => bridgeAsk(), ok ? 250 : 900);
}
/** Brett fliegt von oben an seinen Platz */
function bridgeDropPlank(i) {
  const s = G.s, g = $('#br-planks');
  if (!g) return Promise.resolve();
  g.insertAdjacentHTML('beforeend', bridgePlankSVG(i, 'drop'));
  const el = g.lastElementChild, p = s.slot(i);
  tone([523, 784], 0.07, 'triangle', 0.08);
  return brTween(520, (k) => {
    const e = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2); // leicht überschwingen
    el.setAttribute('transform', `translate(${p.x} ${p.y - 160 * (1 - e)}) rotate(${p.a + (1 - k) * 40})`);
  }).then(() => { bridgeDust(p.x, p.y); tone([196], 0.06, 'square', 0.05); });
}
/** Falsch: Brett bricht und fällt in die Tiefe */
function bridgeFallPlank(i) {
  const s = G.s, g = $('#br-planks');
  if (!g) return Promise.resolve();
  g.insertAdjacentHTML('beforeend', bridgePlankSVG(i, 'ghost'));
  const el = g.lastElementChild, p = s.slot(i);
  // das letzte Brett wackelt mit
  const prev = g.querySelector(`.br-plank[data-i="${i - 1}"]`);
  prev?.classList.add('wobble'); setTimeout(() => prev?.classList.remove('wobble'), 600);
  return brTween(900, (k) => {
    const y = p.y - 60 + (k < 0.25 ? 0 : (k - 0.25) * (k - 0.25) * (s.H * 1.6));
    el.setAttribute('transform', `translate(${p.x + k * 30} ${y}) rotate(${p.a + k * 220})`);
    el.style.opacity = String(1 - Math.max(0, k - 0.7) / 0.3);
  }).then(() => el.remove());
}
function bridgeDust(x, y) {
  const fx = $('#br-fx');
  if (!fx) return;
  for (let i = 0; i < 7; i++) {
    const d = document.createElement('i');
    d.className = 'br-dust';
    d.style.left = `${x}px`; d.style.top = `${y}px`;
    d.style.setProperty('--dx', `${(Math.random() - 0.5) * 50}px`); d.style.setProperty('--dy', `${-10 - Math.random() * 20}px`);
    fx.appendChild(d); setTimeout(() => d.remove(), 700);
  }
}
/** Brücke fertig: der Avatar läuft hinüber */
async function bridgeWalk() {
  const s = G.s, av = $('#br-avatar');
  s.done = true; s.walking = true;
  const panel = $('#br-panel');
  if (panel) panel.innerHTML = '<p class="br-q"><strong>Geschafft! 🎉</strong><small>Die Brücke steht – los geht\'s!</small></p>';
  sfx.win();
  const path = [{ x: s.L * 0.42, y: s.top }, ...Array.from({ length: s.n }, (_, i) => s.slot(i)), { x: s.W - s.R * 0.55, y: s.top }];
  const a3 = s.av3?.alive ? s.av3 : null;
  if (a3) { clearTimeout(s.animT); a3.rotY = Math.PI / 2; a3.setAnim('run'); a3.fig.setRate(0.55); } else av.classList.add('walk');
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k];
    const pl = $(`.br-plank[data-i="${k - 1}"]`);
    pl?.classList.add('step');
    await brTween(Math.max(110, 1400 / path.length), (t) => {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      av.style.left = `${x - s.aw / 2}px`; av.style.top = `${y - s.ah * 0.955 - Math.abs(Math.sin(t * Math.PI)) * 6}px`;
    });
    setTimeout(() => pl?.classList.remove('step'), 250);
    if (G.id !== 'bridge') return;
  }
  if (a3) { a3.fig.setRate(1); a3.rotY = 0.2; a3.setAnim('cheer'); setTimeout(() => a3.alive && a3.setAnim('dance'), 1600); }
  else { av.classList.remove('walk'); av.classList.add('jump'); }
  $('.br-goal')?.classList.add('open');
  if (typeof confetti === 'function') confetti();
  const stars = s.wrong === 0 ? 3 : s.wrong <= 2 ? 2 : 1;
  const record = gameRecord(s.set, 'bridge', s.n * 10 - s.wrong * 5 + stars * 10);
  gLater(() => {
    const box = $('#br-end');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = `<div class="br-endbox"><div class="br-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <h2>${esc(s.T.name)} gebaut!</h2>
      <p class="lead">${s.n} Bretter · ${s.wrong ? `${s.wrong} ${s.wrong === 1 ? 'Brett' : 'Bretter'} in die Tiefe gefallen` : 'kein einziges Brett verloren'}${record ? ' · Rekord!' : ''}</p>
      <div class="row center"><button class="btn primary" data-action="br-next">${icon('right')} Nächste Brücke</button><button class="btn ghost" data-action="games">Anderes Spiel</button></div></div>`;
  }, 900);
}

const bridgeActions = {
  'br-pick': (el) => bridgePick(+el.dataset.i),
  'br-next': () => startBridge(currentSet()),
};
