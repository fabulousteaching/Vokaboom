/* Vokaboom – Zaubertrank mit dem eigenen Avatar
 * Auf dem Rezept stehen die Zutaten auf Deutsch, im Regal Fläschchen mit den Wörtern in der Fremdsprache.
 * Fläschchen antippen → der Avatar giesst sie in den Kessel. Ob es die richtigen waren, zeigt sich erst am Schluss:
 * Stimmt der Trank, leuchtet er und es passiert etwas Lustiges. Stimmt er nicht, misslingt er sichtbar (grauer Schlamm,
 * Rauch, Russ im Gesicht) und die richtigen Zutaten werden gezeigt. 6 Tränke pro Spiel; 2–4 Zutaten je nach Lernstand.
 */
'use strict';

const POTION_EFFECTS = [
  { id: 'float', name: 'Schwebetrank', text: 'Du schwebst wie ein Ballon!', icon: '🎈' },
  { id: 'tiny', name: 'Mini-Trank', text: 'Huch – du bist ganz klein!', icon: '🐜' },
  { id: 'rainbow', name: 'Regenbogentrank', text: 'Alles wird bunt!', icon: '🌈' },
  { id: 'ducks', name: 'Entchen-Trank', text: 'Es regnet Gummienten!', icon: '🦆' },
  { id: 'disco', name: 'Disco-Trank', text: 'Party in der Zauberküche!', icon: '🪩' },
  { id: 'invisible', name: 'Unsichtbar-Trank', text: 'Wo bist du? … Buh!', icon: '👻' },
  { id: 'bubble', name: 'Seifenblasen-Trank', text: 'Du steckst in einer Riesen-Seifenblase!', icon: '🫧' },
  { id: 'spin', name: 'Kreisel-Trank', text: 'Dir ist ganz schwindlig!', icon: '🌀' },
  { id: 'food', name: 'Pizza-Trank', text: 'Es regnet Pizza und Donuts!', icon: '🍕' },
  { id: 'cat', name: 'Katzen-Trank', text: 'Miau! Eine Katze springt aus dem Kessel!', icon: '🐈' },
  { id: 'tall', name: 'Gummi-Trank', text: 'Du wirst lang wie ein Gummiband!', icon: '🤸' },
  { id: 'fireworks', name: 'Feuerwerks-Trank', text: 'Ein Feuerwerk in der Küche!', icon: '🎆' },
  { id: 'dance', name: 'Tanz-Trank', text: 'Der Kessel tanzt mit dir!', icon: '💃' },
  { id: 'snow', name: 'Winter-Trank', text: 'Es schneit drinnen!', icon: '❄️' },
];
const POTION_COLORS = ['#7CFFB2', '#FF8AD8', '#8AB6FF', '#FFD36E', '#C69BFF', '#6EF3FF', '#FF9E6E'];
const POTION_ROUNDS = 6;
const POTION_HUES = [0, 35, 200, 280, 140, 320, 50, 180];

function ptTween(ms, fn) {
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1 && G.id === 'potion') requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
}

function startPotion(set) {
  stopGame();
  G.id = 'potion';
  const sk = runnerSkill(set);
  const k = sk.stage <= 1 ? 3 : sk.stage <= 3 ? 4 : 5;
  const words = gameWords(set);
  Object.assign(G.s, { set, lang: langOf(set), words, pk: makePicker(words), k: Math.min(k, Math.max(1, words.length - 2)), round: 0, mistakes: 0, good: 0, done: false, busy: false, got: [], added: [], effects: [], usedFx: [] });
  const av = avatarSVG(fishAvatar(), { bg: false, label: 'Dein Avatar' });
  $('#view').innerHTML = gameShell('Zaubertrank', `
    <div class="pt-hud"><span id="pt-round">Trank 1 von ${POTION_ROUNDS}</span><span id="pt-book" title="Zauberbuch">📖 0</span></div>
    <div class="pt-stage" id="pt-stage">
      <div class="pt-wall">
        <div class="pt-bricks"></div>
        <div class="pt-window"><i></i><i></i><i></i><span class="pt-moon"></span></div>
        <div class="pt-herbs" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="pt-books" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><b>🔮</b></div>
        <div class="pt-candles"><span></span><span></span></div>
        <div class="pt-floor"></div>
        <div class="pt-motes">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 37) % 100}%;--d:${(i % 7) * 0.9}s;--t:${6 + (i % 5)}s"></i>`).join('')}</div>
      </div>
      <div class="pt-shelf" id="pt-shelf"></div>
      <div class="pt-recipe" id="pt-recipe"></div>
      <div class="pt-lab">
        <div class="pt-avatar" id="pt-avatar">${av}<svg class="pt-hat" viewBox="0 0 100 80" aria-hidden="true"><path d="M50 2 L80 64 L20 64Z" fill="#5B2A9E"/><path d="M50 2 L80 64 L64 64Z" fill="#4A1F86"/><ellipse cx="50" cy="66" rx="46" ry="10" fill="#6A35B5"/><text x="44" y="46" font-size="16">⭐</text></svg>
          <span class="pt-spoon" aria-hidden="true"></span></div>
        <div class="pt-cauldron" id="pt-cauldron">
          <svg viewBox="0 0 200 170" aria-hidden="true"><defs><radialGradient id="pt-brew" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="var(--brew, #7CFFB2)"/><stop offset="1" stop-color="var(--brew2, #2E9E6B)"/></radialGradient>
            <linearGradient id="pt-pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2B2B3A"/><stop offset=".45" stop-color="#4A4A5E"/><stop offset="1" stop-color="#1C1C27"/></linearGradient></defs>
            <ellipse cx="100" cy="58" rx="80" ry="18" fill="url(#pt-brew)" class="pt-surface"/>
            <g class="pt-runes" fill="var(--brew, #7CFFB2)" opacity=".75"><text x="58" y="122" font-size="16">✦</text><text x="92" y="132" font-size="18">☽</text><text x="128" y="122" font-size="16">✧</text></g>
            <path d="M22 58 Q14 150 100 156 Q186 150 178 58 Q100 82 22 58Z" fill="url(#pt-pot)"/>
            <ellipse cx="100" cy="58" rx="84" ry="16" fill="none" stroke="#5C5C74" stroke-width="8"/>
            <rect x="40" y="150" width="14" height="16" rx="4" fill="#1C1C27"/><rect x="146" y="150" width="14" height="16" rx="4" fill="#1C1C27"/>
          </svg>
          <div class="pt-bubbles" id="pt-bubbles"></div>
          <div class="pt-fire"><i></i><i></i><i></i></div>
        </div>
      </div>
      <div class="pt-fx" id="pt-fx"></div>
      <div class="pt-msg" id="pt-msg" hidden></div>
    </div>`);
  const top = $('.pt-hud'), bar = $('.topbar');
  if (top) window.scrollTo({ top: Math.max(0, top.getBoundingClientRect().top + window.scrollY - (bar?.offsetHeight || 64) - 8), behavior: 'smooth' });
  gEvery(() => potionBubble(), 380);
  potionRound();
  // 3D-Avatar (wenn möglich) neben dem Kessel
  if (typeof s3Potion === 'function') s3Potion();
  if (typeof ambStart === 'function') ambStart('lab');
  if (typeof gavMount === 'function') gavMount($('#pt-avatar'), { rotY: 0.55, pad: { top: 1.3, x: 1.1 } }).then((c) => { if (c && G.id === 'potion') { G.s.av3 = c; c.setAnim('idle'); } });
}
/** kurze Bewegung des 3D-Avatars */
function ptAnim(name, ms = 0, after = 'idle') {
  const a = G.s.av3;
  if (!a?.alive) return;
  a.setAnim(name);
  clearTimeout(G.s.animT);
  if (ms) G.s.animT = setTimeout(() => a.alive && a.setAnim(after), ms);
}

/* ---------- Runde ---------- */
function potionRound() {
  const s = G.s;
  if (s.done) return;
  s.round++;
  $('#pt-round').textContent = `Trank ${s.round} von ${POTION_ROUNDS}`;
  const need = [];
  for (let i = 0; i < 12 && need.length < s.k; i++) { const w = pickNext(s.pk); if (!need.includes(w) && !need.some((x) => gameForm(x).toLowerCase() === gameForm(w).toLowerCase())) need.push(w); }
  const key = (x) => gameForm(x).toLowerCase();
  const others = shuffle(s.words.filter((w) => !need.includes(w) && !need.some((n) => key(n) === key(w)))).slice(0, need.length <= 3 ? 4 : 3);
  s.need = need; s.got = []; s.added = []; s.bottles = shuffle([...need.map((w) => ({ w, ok: true })), ...others.map((w) => ({ w, ok: false }))]);
  s.color = POTION_COLORS[s.round % POTION_COLORS.length];
  potionBrew('#7CFFB2', '#2E9E6B');
  $('#pt-recipe').innerHTML = `<span class="pt-pin" aria-hidden="true"></span><h3>Rezept Nr. ${s.round}</h3><ul>${need.map((w, i) => `<li data-i="${i}" lang="de">${esc(w.german || '?')}</li>`).join('')}</ul>
    <p class="pt-kettle" id="pt-kettle">Im Kessel: <span>${need.map(() => '<i></i>').join('')}</span></p>`;
  $('#pt-recipe').classList.remove('in'); void $('#pt-recipe').offsetWidth; $('#pt-recipe').classList.add('in');
  potionCur();
  $('#pt-shelf').innerHTML = s.bottles.map((b, i) => `<button class="pt-bottle" data-action="pt-bottle" data-i="${i}" lang="${s.lang}" style="--h:${POTION_HUES[i % POTION_HUES.length]};--d:${i * 0.06}s">
      <span class="pt-glass" aria-hidden="true"><i></i></span><span class="pt-label">${esc(gameForm(b.w))}</span></button>`).join('');
  s.busy = false;
  potionFitRecipe();
}
/** Das Rezeptblatt bleibt immer gleich gross: bei mehr Text wird die Schrift kleiner */
function potionFitRecipe() {
  const r = $('#pt-recipe');
  if (!r) return;
  const ul = r.querySelector('ul');
  const over = () => r.scrollHeight > r.clientHeight + 1 || (ul && ul.scrollHeight > ul.clientHeight + 1);
  let fs = 1.4;
  r.style.setProperty('--rfs', `${fs}rem`);
  while (fs > 0.62 && over()) { fs -= 0.05; r.style.setProperty('--rfs', `${fs.toFixed(2)}rem`); }
  if (!r.dataset.fitLater) { r.dataset.fitLater = '1'; document.fonts?.ready.then(() => { if (r.isConnected) potionFitRecipe(); }); } // einmal nach dem Laden der Schrift nachmessen
}
/** Das nächste Wort auf dem Zettel leuchtet (Reihenfolge als Hilfe – ob richtig, zeigt sich erst am Schluss) */
function potionCur() {
  const s = G.s, n = s.added?.length || 0;
  $$('#pt-recipe li').forEach((li, i) => { li.classList.toggle('cur', i === n && n < s.need.length); li.classList.toggle('poured', i < n); });
}
function potionBrew(c1, c2) {
  const c = $('#pt-cauldron');
  if (c) { c.style.setProperty('--brew', c1); c.style.setProperty('--brew2', c2); }
}
async function potionPick(i) {
  const s = G.s, b = s.bottles?.[i], el = $$('.pt-bottle')[i];
  if (!b || !el || s.busy || s.done || el.classList.contains('used') || s.added.length >= s.need.length) return;
  s.busy = true;
  el.classList.add('used');
  s.added.push(b);
  const hue = POTION_HUES[i % POTION_HUES.length], col = `hsl(${hue}, 85%, 60%)`;
  // Fläschchen fliegt über den Kessel, kippt und wird ausgegossen – richtig oder falsch zeigt sich erst am Schluss
  const st = $('#pt-stage').getBoundingClientRect(), r0 = el.getBoundingClientRect(), cv = $('#pt-cauldron').getBoundingClientRect();
  const fly = el.cloneNode(true);
  fly.classList.add('flying'); fly.removeAttribute('data-action');
  fly.style.left = `${r0.left - st.left}px`; fly.style.top = `${r0.top - st.top}px`; fly.style.width = `${r0.width}px`;
  $('#pt-fx').appendChild(fly);
  const x0 = r0.left - st.left, y0 = r0.top - st.top;
  const x1 = cv.left - st.left + cv.width * 0.5 - r0.width * 1.05, y1 = cv.top - st.top - r0.height * 1.15;
  ptAnim('present');
  if (typeof sfxx === 'function') sfxx('clink'); else tone([660], 0.05, 'sine', 0.05);
  await ptTween(520, (k) => {
    const e = k * k * (3 - 2 * k);
    fly.style.transform = `translate(${(x1 - x0) * e}px, ${(y1 - y0) * e - Math.sin(k * Math.PI) * 70}px)`;
  });
  if (G.id !== 'potion') return;
  // Korken springt auf
  fly.classList.add('uncorked');
  if (typeof gavSound === 'function') gavSound('plop');
  await ptTween(320, (k) => { fly.style.transform = `translate(${x1 - x0}px, ${y1 - y0 - Math.sin(k * Math.PI) * 6}px)`; });
  // kippen …
  await ptTween(380, (k) => { const e = k * k * (3 - 2 * k); fly.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px) rotate(${e * 118}deg)`; });
  // … ausgiessen: der Trank fliesst aus der Öffnung in einem Bogen in den Kessel
  const glass = fly.querySelector('.pt-glass');
  const surfY = cv.top - st.top + cv.height * 0.28, surfX = cv.left - st.left + cv.width * 0.5;
  const svgNS = 'http://www.w3.org/2000/svg';
  const sv = document.createElementNS(svgNS, 'svg'); sv.setAttribute('class', 'pt-pour');
  sv.setAttribute('viewBox', `0 0 ${st.width} ${st.height}`); sv.setAttribute('width', st.width); sv.setAttribute('height', st.height);
  const path = document.createElementNS(svgNS, 'path'); path.setAttribute('stroke', col);
  const core = document.createElementNS(svgNS, 'path'); core.setAttribute('class', 'core');
  sv.append(path, core); $('#pt-fx').appendChild(sv);
  fly.classList.add('pouring');
  $('#pt-cauldron')?.classList.add('pouring');
  if (typeof gavSound === 'function') gavSound('pour');
  ptAnim('hold');
  potionStir(true);
  // Farbe im Kessel ändert sich während des Eingiessens (fliessend)
  const cols = s.added.map((x) => POTION_HUES[s.bottles.indexOf(x) % POTION_HUES.length]);
  const avg = Math.round(cols.reduce((a2, h) => a2 + h, 0) / cols.length);
  potionBrew(`hsl(${avg}, 80%, 58%)`, `hsl(${avg}, 70%, 30%)`);
  let lastSplash = 0;
  await ptTween(1000, (k) => {
    const ang = 118 + Math.sin(k * 16) * 4;
    fly.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px) rotate(${ang}deg)`;
    const gr = glass.getBoundingClientRect(), cx = gr.left - st.left + gr.width / 2, cy = gr.top - st.top + gr.height / 2;
    const a = ang * Math.PI / 180, L = glass.offsetHeight * 0.52;
    const ox = cx + Math.sin(a) * L, oy = cy - Math.cos(a) * L;
    const flow = k < 0.12 ? k / 0.12 : k > 0.85 ? (1 - k) / 0.15 : 1;
    const ex = surfX - 8 + Math.sin(k * 30) * 3, ey = surfY;
    const d = `M${ox.toFixed(1)} ${oy.toFixed(1)} C${(ox + 22).toFixed(1)} ${(oy + 4).toFixed(1)} ${(ex - 4).toFixed(1)} ${(oy + (ey - oy) * 0.35).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    path.setAttribute('d', d); core.setAttribute('d', d);
    path.style.strokeWidth = `${(3 + flow * 7).toFixed(1)}px`; core.style.strokeWidth = `${(1 + flow * 2).toFixed(1)}px`;
    if (performance.now() - lastSplash > 120 && flow > 0.5) { lastSplash = performance.now(); potionSplash(ex, ey, col, 4); }
  });
  sv.classList.add('end'); setTimeout(() => sv.remove(), 300);
  $('#pt-cauldron')?.classList.remove('pouring');
  await ptTween(260, (k) => { fly.style.transform = `translate(${x1 - x0}px, ${y1 - y0 - k * 20}px) rotate(${118 * (1 - k)}deg)`; fly.style.opacity = String(1 - k); });
  fly.remove();
  potionBubbleBurst(5);
  potionStir(false);
  $$('#pt-kettle i')[s.added.length - 1]?.setAttribute('style', `background:${col};box-shadow:0 0 8px ${col}`);
  potionCur();
  if (G.id !== 'potion') return;
  if (s.added.length >= s.need.length) { await potionReveal(); return; }
  ptAnim('idle');
  s.busy = false;
}
function potionStir(on) {
  $('#pt-avatar')?.classList.toggle('stir', on);
}
function potionBubbleBurst(n) { for (let i = 0; i < n; i++) gLater(() => potionBubble(), i * 60); }

/* ---------- Auflösung erst am Schluss ---------- */
async function potionReveal() {
  const s = G.s, cauldron = $('#pt-cauldron');
  // Umrühren und Spannung: der Kessel blubbert immer stärker
  ptAnim('think');
  potionStir(true);
  cauldron?.classList.add('brewing');
  for (let i = 0; i < 4; i++) gLater(() => { potionBubbleBurst(4); tone([220 + i * 70], 0.09, 'sine', 0.05); }, i * 260);
  await ptTween(1300, () => {});
  potionStir(false); cauldron?.classList.remove('brewing');
  if (G.id !== 'potion') return;
  const okSet = s.added.filter((b) => b.ok).map((b) => b.w);
  const allOk = s.need.every((w) => okSet.includes(w));
  // fürs Wiederholen: gefundene Zutaten richtig, vergessene falsch
  s.need.forEach((w) => markResult(s.pk, w, okSet.includes(w)));
  const items = $$('#pt-recipe li');
  s.need.forEach((w, i) => {
    const li = items[i];
    if (!li) return;
    li.classList.remove('cur', 'poured');
    li.classList.add(okSet.includes(w) ? 'done' : 'miss');
    li.insertAdjacentHTML('beforeend', ` <b class="pt-sol" lang="${s.lang}">= ${esc(gameForm(w))}</b>`);
  });
  potionFitRecipe();
  if (allOk) { s.good++; await potionDone(); return; }
  await potionFail();
}
/** Trank misslungen: grauer Schlamm, Rauch, Russ – danach die richtigen Zutaten zeigen */
async function potionFail() {
  const s = G.s, cauldron = $('#pt-cauldron'), av = $('#pt-avatar');
  s.mistakes++;
  sfx.bad();
  if (typeof gavSound === 'function') gavSound('fizzle');
  potionBrew('#7A7F5A', '#2E3020');
  cauldron?.classList.add('fail');
  const cv = cauldron.getBoundingClientRect(), st = $('#pt-stage').getBoundingClientRect();
  const cx = cv.left - st.left + cv.width / 2, cy = cv.top - st.top + cv.height * 0.3;
  potionSmoke(cx, cy, '', 14);
  for (let i = 0; i < 3; i++) gLater(() => potionSplash(cx, cy, '#4B4A3A', 10), i * 180);
  ptAnim('oops', 900, 'shy');
  av?.classList.add('cough', 'soot'); setTimeout(() => av?.classList.remove('cough'), 900);
  const msg = $('#pt-msg');
  msg.hidden = false;
  msg.innerHTML = `<div class="pt-msgbox bad"><span class="pt-msg-icon">🤢</span><strong>Pfui – der Trank ist misslungen!</strong><small>So wäre es richtig gewesen:</small></div>`;
  // falsche Fläschchen rot mit Bedeutung, richtige leuchten
  $$('.pt-bottle').forEach((el, i) => {
    const b = s.bottles[i];
    el.classList.remove('used');
    el.disabled = true;
    if (b.ok) el.classList.add('sol');
    else if (s.added.includes(b)) { el.classList.add('wrongpick'); el.insertAdjacentHTML('beforeend', `<small class="pt-mean" lang="de">= ${esc(b.w.german)}</small>`); }
    else el.classList.add('dim');
  });
  await ptTween(900, () => {});
  if (G.id !== 'potion') return;
  msg.innerHTML += `<button class="btn primary pt-next" data-action="pt-next">${icon('right')} ${s.round >= POTION_ROUNDS ? 'Zum Zauberbuch' : 'Nächster Trank'}</button>`;
  msg.classList.add('wait');
}
/** Zauber wird ausgelöst: Lichtsäule aus dem Kessel, Druckwelle, Funkenspirale, Blitzlicht */
function potionSpell(color) {
  const fx = $('#pt-fx'), cv = $('#pt-cauldron'), stg = $('#pt-stage');
  if (!fx || !cv || !stg) return;
  const st = stg.getBoundingClientRect(), r = cv.getBoundingClientRect();
  const x = r.left - st.left + r.width / 2, y = r.top - st.top + r.height * 0.3;
  const add = (cls, css = {}, ms = 1800) => { const el = document.createElement('i'); el.className = cls; el.style.left = `${x}px`; el.style.top = `${y}px`; for (const [k, v] of Object.entries(css)) el.style.setProperty(k, v); fx.appendChild(el); setTimeout(() => el.remove(), ms); return el; };
  add('pt-beam', { '--c': color, height: `${y + 20}px` });
  for (let i = 0; i < 3; i++) add('pt-wave', { '--c': color, 'animation-delay': `${i * 0.16}s` });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, rr = 40 + (i % 5) * 16;
    add('pt-spark', { '--c': i % 3 ? color : '#fff', '--x': `${Math.cos(a) * rr}px`, '--y': `${-60 - (i % 7) * 30}px`, '--r': `${(i % 2 ? 1 : -1) * 280}deg`, 'animation-delay': `${(i % 9) * 0.04}s` }, 1600);
  }
  stg.classList.remove('pt-flashing'); void stg.offsetWidth; stg.classList.add('pt-flashing');
  // Kamera fährt kurz auf den Kessel zu und wieder zurück
  if (typeof stageZoom === 'function') stageZoom(stg, x, y + 40, 1.14, 2600);
  setTimeout(() => stg.classList.remove('pt-flashing'), 900);
}
function potionNext() {
  const s = G.s, msg = $('#pt-msg'), av = $('#pt-avatar');
  if (!msg || msg.hidden) return;
  msg.hidden = true; msg.classList.remove('wait');
  $('#pt-cauldron')?.classList.remove('fail');
  av?.classList.remove('soot');
  ptAnim('idle');
  if (s.round >= POTION_ROUNDS) { potionEnd(); return; }
  potionRound();
}
function potionBubble() {
  const box = $('#pt-bubbles');
  if (!box) return;
  const b = document.createElement('i');
  b.style.left = `${18 + Math.random() * 64}%`;
  const r = 6 + Math.random() * 12;
  b.style.width = b.style.height = `${r}px`;
  box.appendChild(b); setTimeout(() => b.remove(), 1600);
}
function potionSplash(x, y, color, n = 14) {
  const fx = $('#pt-fx');
  if (!fx) return;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'pt-drop';
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 60 + Math.random() * 90;
    d.style.left = `${x}px`; d.style.top = `${y}px`; d.style.background = color;
    d.style.setProperty('--dx', `${Math.cos(a) * v}px`); d.style.setProperty('--dy', `${Math.sin(a) * v}px`);
    fx.appendChild(d); setTimeout(() => d.remove(), 900);
  }
}
function potionSmoke(x, y, text, n = 6) {
  const fx = $('#pt-fx');
  if (!fx) return;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'pt-smoke';
    d.style.left = `${x + (Math.random() - 0.5) * 50}px`; d.style.top = `${y}px`; d.style.animationDelay = `${i * 0.06}s`;
    fx.appendChild(d); setTimeout(() => d.remove(), 1600);
  }
  if (!text) return;
  const t = document.createElement('div');
  t.className = 'pt-float bad'; t.textContent = `Puff! ${text}`;
  t.style.left = `${x}px`; t.style.top = `${y - 30}px`;
  fx.appendChild(t); setTimeout(() => t.remove(), 2200);
  tone([140, 90], 0.25, 'sawtooth', 0.05);
}

/* ---------- Trank fertig: etwas Lustiges passiert ---------- */
async function potionDone() {
  const s = G.s, av = $('#pt-avatar'), cauldron = $('#pt-cauldron'), fx = $('#pt-fx'), stage = $('#pt-stage');
  sfx.win();
  if (typeof gavSound === 'function') gavSound('magic');
  cauldron.classList.add('glow');
  ptAnim('cheer');
  $('#pt-recipe')?.classList.add('right');
  const msg0 = $('#pt-msg');
  msg0.hidden = false;
  msg0.innerHTML = '<div class="pt-msgbox good"><span class="pt-msg-icon">✨</span><strong>Richtig! Der Trank wirkt …</strong></div>';
  potionSpell(s.color);
  await ptTween(1500, () => {});
  $('#pt-recipe')?.classList.remove('right');
  // Effekt wählen, der in diesem Spiel noch nicht kam
  let pool = POTION_EFFECTS.filter((e) => !s.usedFx.includes(e.id));
  if (!pool.length) { s.usedFx = []; pool = POTION_EFFECTS; }
  const e = pool[Math.floor(Math.random() * pool.length)];
  s.usedFx.push(e.id); s.effects.push(e);
  $('#pt-book').textContent = `📖 ${s.effects.length}`;
  const msg = $('#pt-msg');
  msg.hidden = false;
  msg.innerHTML = `<div class="pt-msgbox"><span class="pt-msg-icon">${e.icon}</span><strong>${esc(e.name)}</strong><small>${esc(e.text)}</small></div>`;
  const rain = (chars, n = 18) => {
    n = Math.round(n * 1.6);
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i');
      d.className = 'pt-rain'; d.textContent = chars[i % chars.length];
      d.style.left = `${Math.random() * 96}%`; d.style.animationDelay = `${Math.random() * 1.2}s`; d.style.fontSize = `${20 + Math.random() * 18}px`;
      fx.appendChild(d); setTimeout(() => d.remove(), 3200);
    }
  };
  stage.classList.add(`fx-${e.id}`);
  av.classList.add(`fx-${e.id}`);
  if (e.id === 'ducks') rain(['🦆']);
  if (e.id === 'food') rain(['🍕', '🍩', '🧁', '🍪']);
  if (e.id === 'snow') rain(['❄️', '❅', '❆'], 26);
  if (e.id === 'fireworks') rain(['✨', '🎆', '🎇', '⭐'], 22);
  if (e.id === 'disco') rain(['🎵', '🎶'], 12);
  if (e.id === 'cat' && !(typeof s3PotionCat === 'function' && s3PotionCat())) { const c = document.createElement('i'); c.className = 'pt-cat'; c.textContent = '🐈'; fx.appendChild(c); setTimeout(() => c.remove(), 3000); }
  if (e.id === 'invisible') { const b = document.createElement('i'); b.className = 'pt-boo'; b.textContent = 'Buh!'; fx.appendChild(b); setTimeout(() => b.remove(), 3000); }
  if (e.id === 'dance') cauldron.classList.add('fx-dance');
  if (typeof tone === 'function') tone([523, 659, 784, 1047, 1319], 0.12, 'triangle', 0.08);
  await potionFx(e);
  if (G.id !== 'potion') return;
  stage.classList.remove(`fx-${e.id}`); av.classList.remove(`fx-${e.id}`); cauldron.classList.remove('glow', 'fx-dance');
  msg.hidden = true;
  if (s.round >= POTION_ROUNDS) { potionEnd(); return; }
  potionRound();
}
/* ---------- Zauber-Effekte (intensiv, mit dem 3D-Avatar) ---------- */
/** Teilchen-Explosion an (x, y): Emojis oder farbige Sterne fliegen in alle Richtungen */
function ptBurst(x, y, items, n = 30, power = 1) {
  const fx = $('#pt-fx');
  if (!fx) return;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    const a = Math.random() * Math.PI * 2, v = (90 + Math.random() * 220) * power;
    d.className = 'pt-burst';
    const it = items[i % items.length];
    if (it.startsWith('#') || it.startsWith('hsl')) { d.classList.add('star'); d.style.setProperty('--c', it); } else d.textContent = it;
    d.style.left = `${x}px`; d.style.top = `${y}px`;
    d.style.setProperty('--x', `${Math.cos(a) * v}px`); d.style.setProperty('--y', `${Math.sin(a) * v - 60 * power}px`);
    d.style.setProperty('--r', `${(Math.random() - 0.5) * 720}deg`); d.style.setProperty('--s', (0.7 + Math.random() * 0.9).toFixed(2));
    d.style.animationDelay = `${Math.random() * 0.15}s`;
    fx.appendChild(d); setTimeout(() => d.remove(), 1700);
  }
}
/** Mitte des Avatars im Spielfeld */
function ptAvatarCenter() {
  const st = $('#pt-stage')?.getBoundingClientRect(), r = $('#pt-avatar')?.getBoundingClientRect();
  return st && r ? { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height * 0.45 } : { x: 100, y: 100 };
}
async function potionFx(e) {
  const s = G.s, a3 = s.av3?.alive ? s.av3 : null, stage = $('#pt-stage'), av = $('#pt-avatar');
  const c = ptAvatarCenter(), col = s.color || '#7CFFB2';
  stage.classList.add('pt-shake');
  setTimeout(() => stage.classList.remove('pt-shake'), 600);
  ptBurst(c.x, c.y, [col, '#ffffff', '#FFE066', col], 40, 1.2); // grosse Funken-Explosion um den Avatar
  if (typeof gavSound === 'function') gavSound('magic');
  const anim = { float: 'jump', tiny: 'shy', rainbow: 'dance', ducks: 'laugh', disco: 'dance', invisible: 'think', bubble: 'wave', spin: 'spin', food: 'clap', cat: 'laugh', tall: 'flex', fireworks: 'cheer', dance: 'dance', snow: 'shy' }[e.id] || 'cheer';
  if (a3) { a3.setAnim(anim); av.classList.add('fx3d'); }
  const ease = (k) => k * k * (3 - 2 * k);
  // so viel Platz ist über dem Avatar (bis zum oberen Rand des Spielfelds, höchstens so weit, wie die 3D-Leinwand reicht)
  const sr = stage.getBoundingClientRect(), ar = av.getBoundingClientRect();
  const room = Math.max(0, Math.min(ar.height * 1.25, ar.top - sr.top - 12));
  const tallMax = Math.min(0.75, room / Math.max(1, ar.height));
  const trail = (items, every = 90) => { const id = setInterval(() => { if (G.id !== 'potion') { clearInterval(id); return; } const p = ptAvatarCenter(); ptBurst(p.x, p.y + 30, items, 3, 0.35); }, every); return () => clearInterval(id); };
  let stop = () => {};
  if (a3) {
    switch (e.id) {
      case 'float': // hebt ab, schwebt mit Funkenspur, landet sanft
        stop = trail([col, '#FFE066', '#ffffff']);
        await ptTween(3000, (k) => { const up = k < 0.2 ? ease(k / 0.2) : k > 0.8 ? ease((1 - k) / 0.2) : 1; a3.lift = up * room * 0.85 + Math.sin(k * 14) * Math.min(8, room * 0.05); a3.lean = Math.sin(k * 9) * 0.15; });
        break;
      case 'tiny': // Puff! ganz klein, hüpft herum, Puff! wieder gross
        ptBurst(c.x, c.y, ['#ffffff', '#d8d8e8'], 14, 0.6);
        await ptTween(500, (k) => { a3.scale = 1 - ease(k) * 0.72; });
        await ptTween(1700, (k) => { a3.lift = Math.abs(Math.sin(k * Math.PI * 4)) * 40; });
        ptBurst(c.x, c.y, ['#ffffff', '#d8d8e8'], 14, 0.6);
        await ptTween(500, (k) => { a3.scale = 0.28 + ease(k) * 0.72 + Math.sin(k * Math.PI) * 0.15; });
        break;
      case 'tall': // Gummiband: lang – breit – lang – normal
        await ptTween(3000, (k) => { const w = Math.sin(k * Math.PI * 3) * (1 - k * 0.6); a3.sy = 1 + w * (w > 0 ? tallMax : 0.4); a3.sx = 1 - w * 0.35; });
        break;
      case 'spin': // Wirbelsturm: dreht sich immer schneller, hebt dabei ab
        stop = trail([col, '#ffffff'], 70);
        await ptTween(2800, (k) => { a3.rotY = 0.55 + ease(k) * Math.PI * 14; a3.lift = Math.sin(k * Math.PI) * Math.min(90, room * 0.6); });
        a3.rotY = 0.55;
        break;
      case 'invisible': // löst sich in Funken auf, «Buh!» und taucht wieder auf
        ptBurst(c.x, c.y, [col, '#ffffff'], 36, 0.8);
        await ptTween(600, (k) => { a3.alpha = 1 - k; });
        await ptTween(1500, () => {});
        ptBurst(c.x, c.y, [col, '#ffffff', '#FFE066'], 30, 1.2);
        await ptTween(400, (k) => { a3.alpha = k; a3.scale = 1 + Math.sin(k * Math.PI) * 0.35; });
        break;
      case 'bubble': // in einer Riesenblase davonschweben
        await ptTween(3000, (k) => { const up = Math.sin(k * Math.PI); a3.lift = up * room * 0.7; a3.lean = Math.sin(k * 7) * 0.2; });
        ptBurst(c.x, c.y - 100, ['🫧', '💦', '#ffffff'], 24, 0.8);
        break;
      case 'rainbow': case 'disco': case 'dance': // Party: hüpfen und wippen
        stop = trail(e.id === 'rainbow' ? ['🌈', '#ff5e7e', '#ffd166', '#4ca8ff'] : ['🎵', '🎶', '✨'], 140);
        await ptTween(3000, (k) => { a3.lift = Math.abs(Math.sin(k * Math.PI * 6)) * 30; a3.lean = Math.sin(k * Math.PI * 6) * 0.18; });
        break;
      case 'fireworks':
        for (let i = 0; i < 6; i++) gLater(() => { const st = stage.getBoundingClientRect(); ptBurst(st.width * (0.2 + Math.random() * 0.6), st.height * (0.15 + Math.random() * 0.3), ['#ff5e7e', '#ffd166', '#4ca8ff', '#7cffb2', '#ffffff'], 36, 1.1); tone([300 + i * 60, 90], 0.25, 'sawtooth', 0.04); }, i * 420);
        await ptTween(3000, (k) => { a3.lift = Math.abs(Math.sin(k * Math.PI * 4)) * 25; });
        break;
      default:
        await ptTween(3000, (k) => { a3.lift = Math.abs(Math.sin(k * Math.PI * 3)) * 22; });
    }
    stop();
    Object.assign(a3, { lift: 0, lean: 0, scale: 1, sx: 1, sy: 1, alpha: 1, rotY: 0.55 });
    ptBurst(c.x, c.y, [col, '#ffffff'], 18, 0.6);
    av.classList.remove('fx3d');
  } else await ptTween(3000, () => {});
}
function potionEnd() {
  const s = G.s;
  s.done = true;
  const score = POTION_ROUNDS * 10 - s.mistakes * 3;
  const record = gameRecord(s.set, 'potion', Math.max(0, score));
  const msg = $('#pt-msg');
  msg.hidden = false;
  msg.innerHTML = `<div class="pt-endbox"><div class="pt-msg-icon">📖</div><h2>${record ? 'Neuer Rekord!' : 'Zauberbuch voll!'}</h2>
    <p class="lead">${s.good} von ${POTION_ROUNDS} Tränken gelungen${s.mistakes ? '' : ' – alle perfekt!'}</p>
    <ul class="pt-booklist">${s.effects.map((e) => `<li>${e.icon} ${esc(e.name)}</li>`).join('')}</ul>
    <div class="row center"><button class="btn primary" data-action="game-again">${icon('shuffle')} Nochmal brauen</button><button class="btn ghost" data-action="games">Anderes Spiel</button></div></div>`;
  if (typeof confetti === 'function') confetti();
}

const potionActions = {
  'pt-bottle': (el) => potionPick(+el.dataset.i),
  'pt-next': () => potionNext(),
};
