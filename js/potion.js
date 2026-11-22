/* Vokaboom – Zaubertrank mit dem eigenen Avatar
 * Auf dem Rezept stehen die Zutaten auf Deutsch, im Regal Fläschchen mit den Wörtern in der Fremdsprache.
 * Die richtigen Fläschchen antippen → sie fliegen in den Kessel. Ist der Trank fertig, passiert jedes Mal etwas
 * anderes Lustiges. 6 Tränke pro Spiel; 2–4 Zutaten je nach Lernstand.
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
  const k = sk.stage <= 1 ? 2 : sk.stage <= 3 ? 3 : 4;
  const words = gameWords(set);
  Object.assign(G.s, { set, lang: langOf(set), words, pk: makePicker(words), k: Math.min(k, Math.max(1, words.length - 2)), round: 0, mistakes: 0, done: false, busy: false, got: [], effects: [], usedFx: [] });
  const av = avatarSVG(fishAvatar(), { bg: false, label: 'Dein Avatar' });
  $('#view').innerHTML = gameShell('Zaubertrank', `
    <div class="pt-hud"><span id="pt-round">Trank 1 von ${POTION_ROUNDS}</span><span id="pt-book" title="Zauberbuch">📖 0</span></div>
    <div class="pt-stage" id="pt-stage">
      <div class="pt-wall"><div class="pt-window"><i></i><i></i><i></i><span class="pt-moon"></span></div><div class="pt-candles"><span></span><span></span></div></div>
      <div class="pt-shelf" id="pt-shelf"></div>
      <div class="pt-recipe" id="pt-recipe"></div>
      <div class="pt-lab">
        <div class="pt-avatar" id="pt-avatar">${av}<svg class="pt-hat" viewBox="0 0 100 80" aria-hidden="true"><path d="M50 2 L80 64 L20 64Z" fill="#5B2A9E"/><path d="M50 2 L80 64 L64 64Z" fill="#4A1F86"/><ellipse cx="50" cy="66" rx="46" ry="10" fill="#6A35B5"/><text x="44" y="46" font-size="16">⭐</text></svg>
          <span class="pt-spoon" aria-hidden="true"></span></div>
        <div class="pt-cauldron" id="pt-cauldron">
          <svg viewBox="0 0 200 170" aria-hidden="true"><defs><radialGradient id="pt-brew" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="var(--brew, #7CFFB2)"/><stop offset="1" stop-color="var(--brew2, #2E9E6B)"/></radialGradient>
            <linearGradient id="pt-pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2B2B3A"/><stop offset=".45" stop-color="#4A4A5E"/><stop offset="1" stop-color="#1C1C27"/></linearGradient></defs>
            <ellipse cx="100" cy="58" rx="80" ry="18" fill="url(#pt-brew)" class="pt-surface"/>
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
  const others = shuffle(s.words.filter((w) => !need.includes(w) && !need.some((n) => key(n) === key(w)))).slice(0, Math.min(4, Math.max(2, 7 - need.length)));
  s.need = need; s.got = []; s.bottles = shuffle([...need.map((w) => ({ w, ok: true })), ...others.map((w) => ({ w, ok: false }))]);
  s.color = POTION_COLORS[s.round % POTION_COLORS.length];
  potionBrew('#7CFFB2', '#2E9E6B');
  $('#pt-recipe').innerHTML = `<h3>Rezept ${s.round}</h3><ul>${need.map((w, i) => `<li data-i="${i}" lang="de">${esc(w.german || '?')}</li>`).join('')}</ul>`;
  $('#pt-recipe').classList.remove('in'); void $('#pt-recipe').offsetWidth; $('#pt-recipe').classList.add('in');
  const hues = [0, 35, 200, 280, 140, 320, 50, 180];
  $('#pt-shelf').innerHTML = s.bottles.map((b, i) => `<button class="pt-bottle" data-action="pt-bottle" data-i="${i}" lang="${s.lang}" style="--h:${hues[i % hues.length]};--d:${i * 0.06}s">
      <span class="pt-glass" aria-hidden="true"><i></i></span><span class="pt-label">${esc(gameForm(b.w))}</span></button>`).join('');
  s.busy = false;
}
function potionBrew(c1, c2) {
  const c = $('#pt-cauldron');
  if (c) { c.style.setProperty('--brew', c1); c.style.setProperty('--brew2', c2); }
}
async function potionPick(i) {
  const s = G.s, b = s.bottles?.[i], el = $$('.pt-bottle')[i];
  if (!b || !el || s.busy || s.done || el.classList.contains('used')) return;
  s.busy = true;
  el.classList.add('used');
  // Fläschchen fliegt im Bogen in den Kessel
  const st = $('#pt-stage').getBoundingClientRect(), r0 = el.getBoundingClientRect(), cv = $('#pt-cauldron').getBoundingClientRect();
  const fly = el.cloneNode(true);
  fly.classList.add('flying'); fly.removeAttribute('data-action');
  fly.style.left = `${r0.left - st.left}px`; fly.style.top = `${r0.top - st.top}px`; fly.style.width = `${r0.width}px`;
  $('#pt-fx').appendChild(fly);
  const x0 = r0.left - st.left, y0 = r0.top - st.top, x1 = cv.left - st.left + cv.width / 2 - r0.width / 2, y1 = cv.top - st.top + cv.height * 0.18;
  tone([660], 0.05, 'sine', 0.05);
  await ptTween(560, (k) => {
    const e = k * k * (3 - 2 * k);
    fly.style.transform = `translate(${(x1 - x0) * e}px, ${(y1 - y0) * e - Math.sin(k * Math.PI) * 90}px) rotate(${k * 300}deg) scale(${1 - k * 0.5})`;
  });
  fly.remove();
  if (G.id !== 'potion') return;
  potionSplash(x1 + r0.width / 2, y1 + 10, b.ok ? s.color : '#9BE564');
  const idx = s.need.indexOf(b.w);
  if (b.ok && idx >= 0 && !s.got.includes(b.w)) {
    sfx.good();
    markResult(s.pk, b.w, true);
    s.got.push(b.w);
    $(`#pt-recipe li[data-i="${idx}"]`)?.classList.add('done');
    const f = s.got.length / s.need.length;
    potionBrew(s.color, `color-mix(in srgb, ${s.color} ${Math.round(50 + f * 30)}%, #1a1a2e)`);
    $('#pt-avatar')?.classList.add('stir'); setTimeout(() => $('#pt-avatar')?.classList.remove('stir'), 700);
    if (s.got.length >= s.need.length) { await potionDone(); return; }
  } else {
    sfx.bad();
    s.mistakes++;
    s.need.filter((w) => !s.got.includes(w)).forEach((w) => markResult(s.pk, w, false));
    potionSmoke(x1 + r0.width / 2, y1, `${gameForm(b.w)} = ${b.w.german}`);
    const av = $('#pt-avatar'); av?.classList.add('cough', 'soot'); setTimeout(() => av?.classList.remove('cough'), 900); setTimeout(() => av?.classList.remove('soot'), 2600);
  }
  s.busy = false;
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
function potionSplash(x, y, color) {
  const fx = $('#pt-fx');
  if (!fx) return;
  for (let i = 0; i < 14; i++) {
    const d = document.createElement('i');
    d.className = 'pt-drop';
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 60 + Math.random() * 90;
    d.style.left = `${x}px`; d.style.top = `${y}px`; d.style.background = color;
    d.style.setProperty('--dx', `${Math.cos(a) * v}px`); d.style.setProperty('--dy', `${Math.sin(a) * v}px`);
    fx.appendChild(d); setTimeout(() => d.remove(), 900);
  }
}
function potionSmoke(x, y, text) {
  const fx = $('#pt-fx');
  if (!fx) return;
  for (let i = 0; i < 6; i++) {
    const d = document.createElement('i');
    d.className = 'pt-smoke';
    d.style.left = `${x + (Math.random() - 0.5) * 50}px`; d.style.top = `${y}px`; d.style.animationDelay = `${i * 0.06}s`;
    fx.appendChild(d); setTimeout(() => d.remove(), 1600);
  }
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
  cauldron.classList.add('glow');
  await ptTween(700, () => {});
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
  if (e.id === 'cat') { const c = document.createElement('i'); c.className = 'pt-cat'; c.textContent = '🐈'; fx.appendChild(c); setTimeout(() => c.remove(), 3000); }
  if (e.id === 'invisible') { const b = document.createElement('i'); b.className = 'pt-boo'; b.textContent = 'Buh!'; fx.appendChild(b); setTimeout(() => b.remove(), 3000); }
  if (e.id === 'dance') cauldron.classList.add('fx-dance');
  if (typeof tone === 'function') tone([523, 659, 784, 1047, 1319], 0.12, 'triangle', 0.08);
  await ptTween(3000, () => {});
  if (G.id !== 'potion') return;
  stage.classList.remove(`fx-${e.id}`); av.classList.remove(`fx-${e.id}`); cauldron.classList.remove('glow', 'fx-dance');
  msg.hidden = true;
  if (s.round >= POTION_ROUNDS) { potionEnd(); return; }
  potionRound();
}
function potionEnd() {
  const s = G.s;
  s.done = true;
  const score = POTION_ROUNDS * 10 - s.mistakes * 3;
  const record = gameRecord(s.set, 'potion', Math.max(0, score));
  const msg = $('#pt-msg');
  msg.hidden = false;
  msg.innerHTML = `<div class="pt-endbox"><div class="pt-msg-icon">📖</div><h2>${record ? 'Neuer Rekord!' : 'Zauberbuch voll!'}</h2>
    <p class="lead">${POTION_ROUNDS} Tränke gebraut${s.mistakes ? ` · ${s.mistakes} Puff-Wolken` : ' · keine einzige Puff-Wolke!'}</p>
    <ul class="pt-booklist">${s.effects.map((e) => `<li>${e.icon} ${esc(e.name)}</li>`).join('')}</ul>
    <div class="row center"><button class="btn primary" data-action="game-again">${icon('shuffle')} Nochmal brauen</button><button class="btn ghost" data-action="games">Anderes Spiel</button></div></div>`;
  if (typeof confetti === 'function') confetti();
}

const potionActions = {
  'pt-bottle': (el) => potionPick(+el.dataset.i),
};
