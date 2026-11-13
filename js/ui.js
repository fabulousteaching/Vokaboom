/* Vokaboom – Oberfläche: Rahmen, Startseite, Portionsübersicht, Dialoge */
'use strict';

const ICONS = {
  speaker: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  check: '<path d="M5 12.5 10 17 19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  shuffle: '<path d="M3 7h3c4 0 6 10 10 10h5"/><path d="M3 17h3c1.5 0 2.7-1.4 3.7-3.2M14.3 10.2C15.3 8.4 16.5 7 18 7h3"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  flip: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  down: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  stack: '<rect x="7" y="3" width="13" height="16" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/>',
  pencil2: '<path d="M3 21l3.5-1 11-11-2.5-2.5-11 11z"/><path d="M14 6.5l2.5-2.5 3.5 3.5-2.5 2.5"/>',
  brush: '<path d="M14.5 4.5l5 5-7.5 7.5-5-5z"/><path d="M7 12c-2 0-4 1.5-4 4.5V20h3.5C9.5 20 11 18 11 16"/>',
  picto: '<circle cx="12" cy="5.5" r="2.5"/><path d="M12 9v6M7.5 11.5 12 9l4.5 2.5M9 21l3-6 3 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  snail: '<path d="M3 18h15a3 3 0 0 0 3-3V9"/><path d="M19 6l1 3 1-3"/><circle cx="10" cy="12" r="5"/><path d="M10 12a1.8 1.8 0 1 1 1.8-1.8"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

let flagCounter = 0;
function flag() {
  const id = 'ukclip' + (++flagCounter);
  return `<svg class="flag" viewBox="0 0 60 30" aria-hidden="true"><clipPath id="${id}"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath><path d="M0,0v30h60v-30z" fill="#012169"/><path d="M0,0 60,30M60,0 0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 60,30M60,0 0,30" clip-path="url(#${id})" stroke="#C8102E" stroke-width="4"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></svg>`;
}
const stars = (n, max = 3) => `<span class="stars" aria-label="${n} von ${max} Sternen">${Array.from({ length: max }, (_, i) => `<svg viewBox="0 0 24 24" class="star ${i < n ? 'on' : ''}" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>`).join('')}</span>`;

/* ---------------- Zustand der Oberfläche ---------------- */
const ui = {
  view: 'home',
  setId: null,
  draft: { text: '', name: '', swap: false },
  confirmDelete: null,
  modal: null,
  picTab: 'picto',
  reviewCands: {},
};
const currentSet = () => getSet(ui.setId);
const MODE_NAMES = { cards: 'Lernkarten', match: 'Zuordnen', speak: 'Aussprechen', dictation: 'Hören & Schreiben', test: 'Test', pics: 'Bilder prüfen' };

/* ---------------- Rahmen ---------------- */
function renderShell() {
  document.getElementById('app').innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <button class="brand" data-action="home" aria-label="Vokaboom – zur Startseite">
          <span class="brand-mark" aria-hidden="true"><svg class="brand-svg" viewBox="0 -6 80 78" aria-hidden="true"><defs><linearGradient id="brandgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs><rect x="6" y="22" width="36" height="42" rx="10" fill="#FFB703" transform="rotate(-12 24 43)"/><rect x="14" y="20" width="38" height="46" rx="11" fill="url(#brandgrad)"/><path d="M23 34l10 18 10-18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><g stroke-linecap="round"><path d="M54 13.1L52 2.3" stroke="#EC4899" stroke-width="4"/><path d="M57.8 13.2L63.3 1.9" stroke="#FFB703" stroke-width="4.4"/><path d="M60.3 16.2L70 11" stroke="#EC4899" stroke-width="4"/><path d="M61.5 19.7L68.9 20.5" stroke="#FFB703" stroke-width="3.6"/><path d="M50.2 14.7L45.7 10.6" stroke="#FFB703" stroke-width="3.6"/></g><circle cx="57.9" cy="-1.8" r="2" fill="#EC4899"/><circle cx="75.1" cy="14.7" r="1.9" fill="#FFB703"/><circle cx="71" cy="2.5" r="1.5" fill="#EC4899"/><circle cx="46.5" cy="3.1" r="1.5" fill="#EC4899"/></svg></span>
          <span class="brand-name">Voka<span class="hot">boom</span></span>
        </button>
        <nav class="crumbs" id="crumbs" aria-label="Wo du gerade bist"></nav>
        <div class="topbar-actions">
          ${searchSlotHTML()}
          <span id="account-slot">${accountButtonHTML()}</span>
          <button class="icon-btn" data-action="settings" aria-label="Einstellungen" title="Einstellungen">${icon('sliders')}</button>
        </div>
      </div>
    </header>
    <main id="view" class="view" tabindex="-1"></main>
    <div id="toasts" class="toasts" role="status" aria-live="polite"></div>`;
}

function renderCrumbs() {
  const el = $('#crumbs');
  if (!el) return;
  const set = currentSet();
  if (ui.view === 'classes' || ui.view === 'class') { el.innerHTML = classesCrumbs(); return; }
  if (!set || ui.view === 'home') { el.innerHTML = ''; return; }
  let html = `<span class="crumb-sep" aria-hidden="true">/</span><button class="crumb" data-action="open-set" data-id="${set.id}">${flag(set.lang)}<span>${esc(set.name)}</span></button>`;
  if (MODE_NAMES[ui.view]) html += `<span class="crumb-sep sep-current" aria-hidden="true">/</span><span class="crumb current">${MODE_NAMES[ui.view]}</span>`;
  el.innerHTML = html;
}

function render() {
  const v = $('#view');
  const set = currentSet();
  if (!['home', 'classes', 'class'].includes(ui.view) && !set) ui.view = 'home';
  if (isKid() && ['classes', 'class', 'pics'].includes(ui.view)) ui.view = 'home';
  renderCrumbs();
  switch (ui.view) {
    case 'set': v.innerHTML = viewSet(set); break;
    case 'cards': renderCards(); break;
    case 'match': renderMatch(); break;
    case 'speak': renderSpeak(); break;
    case 'dictation': renderDictation(); break;
    case 'test': renderTest(); break;
    case 'pics': v.innerHTML = viewPics(set); loadReview(set); break;
    case 'classes': renderClasses(); break;
    case 'class': renderClass(); break;
    default: v.innerHTML = viewHome(); bindHome();
  }
}

function go(view, extra = {}) {
  stopModes();
  Object.assign(ui, extra);
  ui.view = view;
  render();
  window.scrollTo({ top: 0 });
  $('#view')?.focus({ preventScroll: true });
}

function stopModes() {
  stopListening(true);
  stopMeter();
  stopSpeaking();
  clearTimeout(speakM?.timer);
  clearTimeout(cards?.speakTimer);
  clearTimeout(test?.timer);
  clearTimeout(dict?.timer);
  clearInterval(match?.tick);
}

/* ---------------- Meldungen ---------------- */
function toast(msg, kind = '') {
  const host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, kind === 'bad' ? 6000 : 3200);
}

/* ---------------- Dialoge ---------------- */
function openModal(html, { cls = '', onClose, label = 'Dialog' } = {}) {
  closeModal(true);
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
  document.body.classList.add('has-modal');
  ui.modal = { el: wrap, onClose, returnFocus: document.activeElement };
  setTimeout(() => (wrap.querySelector('[autofocus]') || wrap.querySelector('input, button'))?.focus(), 40);
  return wrap;
}
function closeModal(silent = false) {
  const m = ui.modal;
  if (!m) return;
  if (m.el.querySelector('#mic-test-out')) { stopListening(true); stopMeter(); }
  ui.modal = null;
  m.el.remove();
  document.body.classList.remove('has-modal');
  if (!silent) m.onClose?.();
  m.returnFocus?.focus?.({ preventScroll: true });
}

/* ---------------- Konfetti ---------------- */
function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const dpr = window.devicePixelRatio || 1;
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#FFD43B', '#2450C8', '#EF6F6C', '#2B9348', '#F783AC', '#4DABF7', '#FF922B'];
  const parts = Array.from({ length: 150 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.38,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5,
    s: Math.random() * 7 + 5, c: colors[Math.floor(Math.random() * colors.length)],
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35, rect: Math.random() < 0.6,
  }));
  let frame = 0;
  (function tick() {
    frame++;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.38; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.rect) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (frame < 170) requestAnimationFrame(tick); else c.remove();
  })();
}

/* ---------------- Startseite ---------------- */
/* „BOOM“ im Titel: Buchstaben fliegen beim Darüberfahren auseinander und setzen sich wieder zusammen */
const BOOM_LETTERS = [['B', -0.85, -0.7, -40], ['O', -0.25, -1.15, 30], ['O', 0.35, -1.05, -26], ['M', 0.95, -0.6, 44]];
const BOOM_SPARKS = ['#FFB703', '#EC4899', '#7C3AED', '#FFB703', '#4F46E5', '#EC4899', '#FFB703', '#7C3AED', '#EC4899', '#4F46E5'];
function boomHTML() {
  const letters = BOOM_LETTERS.map(([l, dx, dy, r], i) => `<span class="boom-l" style="--dx:${dx}em;--dy:${dy}em;--r:${r}deg;--i:${i}">${l}</span>`).join('');
  const sparks = BOOM_SPARKS.map((c, i) => {
    const a = (i / BOOM_SPARKS.length) * Math.PI * 2 - Math.PI / 2, d = 1.1 + (i % 3) * 0.3;
    return `<i class="boom-spark" style="--c:${c};--x:${(Math.cos(a) * d * 1.4).toFixed(2)}em;--y:${(Math.sin(a) * d).toFixed(2)}em"></i>`;
  }).join('');
  return `<span class="boom" id="boom">${letters}<span class="boom-sparks" aria-hidden="true">${sparks}</span><svg class="boom-burst" viewBox="44 -4 34 28" aria-hidden="true"><g stroke-linecap="round"><path d="M54 13.1L52 2.3" stroke="#EC4899" stroke-width="4"/><path d="M57.8 13.2L63.3 1.9" stroke="#FFB703" stroke-width="4.4"/><path d="M60.3 16.2L70 11" stroke="#EC4899" stroke-width="4"/><path d="M61.5 19.7L68.9 20.5" stroke="#FFB703" stroke-width="3.6"/><path d="M50.2 14.7L45.7 10.6" stroke="#FFB703" stroke-width="3.6"/></g><circle cx="71" cy="2.5" r="1.5" fill="#EC4899"/></svg></span>`;
}
function bindBoom() {
  const el = $('#boom');
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const go = () => {
    if (el.classList.contains('explode')) return;
    el.classList.add('explode');
    setTimeout(() => el.classList.remove('explode'), 1150);
  };
  el.addEventListener('pointerenter', go);
  el.addEventListener('click', go);
}

function viewHome() {
  if (isKid()) return kidHomeHTML();
  const d = ui.draft;
  const sets = db.sets;
  return `
  <section class="home">
    <div class="home-intro">
      <p class="eyebrow">${flag()} Englisch-Vokabeln üben</p>
      <h1>Nimm deine Vokabelliste und ${boomHTML()} werden daraus ganz einfach <mark>Lernkarten, Übungen, Spiele und Tests.</mark></h1>
      <p class="lead">Vokabeln einfügen und fertig. Und Bildvorschläge für die Karten macht dir Vokaboom auch gleich schon.</p>
    </div>
    <div class="home-grid">
      <form class="panel new-set" id="new-set-form" autocomplete="off">
        <div class="panel-head">
          <h2>Neue Vokabelportion</h2>
        </div>
        <label class="field" for="set-name">
          <span class="label">Name der Portion</span>
          <input id="set-name" type="text" maxlength="80" placeholder="z. B. Unit 3 – Food" value="${esc(d.name)}">
        </label>
        <label class="field" for="vocab-input">
          <span class="label">Vokabeln</span>
          <textarea id="vocab-input" rows="9" spellcheck="false" placeholder="apple – Apfel&#10;the dog – der Hund&#10;to swim – schwimmen&#10;…">${esc(d.text)}</textarea>
        </label>
        <p class="hint">Eine Vokabel pro Zeile, zum Beispiel <code>apple – Apfel</code> oder <code>the dog = der Hund</code>. Tabellen aus Word, Excel oder dem Schulbuch kannst du direkt hineinkopieren.</p>
        <div id="parse-preview" class="parse-preview"></div>
        <button class="btn primary big" type="submit" data-action="create-set">${icon('stack')} Karten erstellen</button>
      </form>

      <aside class="panel library" aria-labelledby="lib-title">
        <div class="lib-head"><h2 id="lib-title">Meine Vokabelportionen</h2>${cloud.uid ? `<button class="btn small secondary" data-action="classes">${icon('user')} Meine Klassen</button>` : ''}</div>
        ${libraryNote()}
        ${sets.length ? `<ul class="lib-list">${sets.map(libItem).join('')}</ul>` : '<p class="empty">Noch keine Portion gespeichert. Füge links deine Vokabeln ein – sie bleiben in diesem Browser gespeichert.</p>'}
      </aside>
    </div>
  </section>`;
}

function libItem(s) {
  const t = s.progress?.test?.best;
  if (ui.confirmDelete === s.id) {
    return `<li class="lib-item confirm">
      <span class="lib-text"><strong>„${esc(s.name)}“ löschen?</strong><small>Das kann man nicht rückgängig machen.</small></span>
      <span class="lib-confirm">
        <button class="btn small danger" data-action="delete-set-yes" data-id="${s.id}">Löschen</button>
        <button class="btn small ghost" data-action="delete-set-no">Behalten</button>
      </span>
    </li>`;
  }
  return `<li class="lib-item">
    <button class="lib-open" data-action="open-set" data-id="${s.id}">
      <span class="lib-text"><strong>${esc(s.name)}</strong><small>${s.words.length} Vokabeln${t != null ? ` · Test ${t} %` : ''}</small></span>
    </button>
    <button class="icon-btn subtle" data-action="delete-set" data-id="${s.id}" aria-label="„${esc(s.name)}“ löschen" title="Löschen">${icon('trash')}</button>
  </li>`;
}

function bindHome() {
  if (!$('#vocab-input')) return; // Kinder-Ansicht
  bindBoom();
  const ta = $('#vocab-input'), name = $('#set-name');
  const update = () => { ui.draft.text = ta.value; renderPreview(); };
  ta.addEventListener('input', debounce(update, 120));
  name.addEventListener('input', () => { ui.draft.name = name.value; });
  $('#new-set-form').addEventListener('submit', (e) => { e.preventDefault(); createSetFromDraft(); });
  renderPreview();
}

function renderPreview() {
  const box = $('#parse-preview');
  if (!box) return;
  const d = ui.draft;
  const res = parseVocab(d.text, { swap: d.swap });
  if (!res.rows.length) { box.innerHTML = ''; return; }
  const L = 'Englisch';
  const missing = res.rows.filter((r) => !r.foreign || !r.german).length;
  box.innerHTML = `
    <div class="preview-head">
      <strong>${res.rows.length} ${res.rows.length === 1 ? 'Vokabel' : 'Vokabeln'} erkannt</strong>
      <button type="button" class="btn small ghost" data-action="draft-swap" title="Falls Deutsch und ${L} vertauscht sind">${icon('swap')} Spalten tauschen</button>
    </div>
    ${missing ? `<p class="warn">${missing === 1 ? 'Bei einer Zeile fehlt' : `Bei ${missing} Zeilen fehlt`} die Übersetzung. Trenne die Wörter mit – oder =.</p>` : ''}
    <div class="preview-table" role="table" aria-label="Erkannte Vokabeln">
      <div class="pt-row pt-head" role="row"><span role="columnheader">${flag()} ${L}</span><span role="columnheader">Deutsch</span></div>
      ${res.rows.map((r) => `<div class="pt-row" role="row"><span role="cell" class="${r.foreign ? '' : 'missing'}">${esc(r.foreign) || 'fehlt'}</span><span role="cell" class="${r.german ? '' : 'missing'}">${esc(r.german) || 'fehlt'}</span></div>`).join('')}
    </div>`;
}

function createSetFromDraft() {
  const d = ui.draft;
  // direkt aus den Feldern lesen – falls gerade erst eingefügt wurde
  const ta = $('#vocab-input'), nm = $('#set-name');
  if (ta) d.text = ta.value;
  if (nm) d.name = nm.value;
  const res = parseVocab(d.text, { swap: d.swap });
  const rows = res.rows.filter((r) => r.foreign);
  if (!rows.length) {
    toast('Füge zuerst ein paar Vokabeln ein – eine pro Zeile.', 'bad');
    $('#vocab-input')?.focus();
    return;
  }
  const name = d.name.trim() || autoName(rows);
  const set = newSet({ name, lang: 'en', rows });
  ui.draft = { text: '', name: '', swap: false };
  openSet(set.id);
  startPictureFill(set);
}
function autoName(rows) {
  const first = rows.slice(0, 3).map((r) => core(r.foreign, 'en')).join(', ');
  return `${first}${rows.length > 3 ? ' …' : ''}`;
}

function openSet(id) {
  ui.confirmDelete = null;
  go('set', { setId: id });
  const set = getSet(id);
  if (set && set.words.some((w) => w.picStatus !== 'done' && !(w.pic && w.pic.manual))) startPictureFill(set);
}

/* ---------------- Portionsübersicht ---------------- */
function progressInfo(set) {
  const p = set.progress || {};
  return {
    cards: p.cards ? `${p.cards.known} von ${p.cards.total} sofort gewusst` : 'Noch nicht geübt',
    match: (p.match && (p.match.pic != null || p.match.de != null || p.match.times))
      ? [['pic', 'Bild'], ['de', 'Deutsch']].map(([k, t]) => (p.match[k] != null || p.match.times?.[k]
        ? `${t} ${p.match[k] != null ? stars(p.match[k]) : ''}${p.match.times?.[k] ? ` ${fmtTime(p.match.times[k])}` : ''}` : '')).join(' ') : 'Noch nicht gespielt',
    speak: p.speak ? `${p.speak.correct} von ${p.speak.total} gleich richtig` : 'Noch nicht geübt',
    dictation: p.dictation ? `${p.dictation.correct} von ${p.dictation.total} gleich richtig` : 'Noch nicht geübt',
    test: p.test ? `Bestes Ergebnis ${p.test.best} %` : 'Noch kein Test',
  };
}

function viewSet(set) {
  const L = LANGS[set.lang].name;
  const info = progressInfo(set);
  const step = (no, title, text, prog, actions, done, ic) => `
    <li class="step step-${no} ${done ? 'done' : ''}">
      <span class="step-no" aria-hidden="true">${icon(ic)}<b>${no}</b></span>
      <div class="step-body">
        <h3>${title}</h3>
        <p>${text}</p>
        <p class="step-progress">${prog}</p>
      </div>
      <div class="step-actions">${actions}</div>
    </li>`;
  const p = set.progress || {};
  // Über QR-Code bekommen oder von der Lehrperson freigegeben: nur die Übungen, keine Karten-Ansicht
  const locked = !!set.shareId || !!set.assigned || isKid();
  return `
  <section class="set-view ${locked ? 'locked' : ''}">
    <header class="set-head">
      <div class="set-title-wrap">
        <p class="eyebrow">${flag()} ${L} · ${set.words.length} Vokabeln</p>
        <h1 class="set-title">${esc(set.name)}</h1>
      </div>
      ${locked ? '' : `<div class="set-tools">
        <button class="btn ghost" data-action="edit-words">${icon('edit')} Bearbeiten</button>
        <button class="btn ghost" data-action="share">${icon(isFramed ? 'copy' : 'link')} ${isFramed ? 'Liste kopieren' : 'Teilen'}</button>
      </div>`}
    </header>

    <ol class="path" aria-label="Lernweg">
      ${step(1, 'Lernkarten', 'Karten umdrehen und merken.', info.cards,
        `<button class="btn primary" data-action="mode" data-mode="cards">Karten üben</button>`, !!p.cards, 'stack')}
      ${step(2, 'Zuordnen', 'Verbinde, was zusammengehört.', info.match,
        `<button class="btn primary" data-action="mode" data-mode="match">Zuordnen üben</button>`, !!p.match, 'link')}
      ${step(3, 'Aussprechen', 'Sag das Wort ins Mikrofon.', info.speak,
        `<button class="btn primary" data-action="mode" data-mode="speak">Aussprache üben</button>`, !!p.speak, 'mic')}
      ${step(4, 'Hören & Schreiben', 'Hör das Wort und schreib es auf.', info.dictation,
        `<button class="btn primary" data-action="mode" data-mode="dictation">Diktat üben</button>`, !!p.dictation, 'speaker')}
      ${step(5, 'Test', 'Zeig, was du kannst.', info.test,
        `<button class="btn primary" data-action="mode" data-mode="test">Test starten</button>`, !!p.test, 'pencil2')}
    </ol>

    ${locked ? '' : `<section class="deck" aria-labelledby="deck-title">
      <div class="deck-head">
        <h2 id="deck-title">Deine Karten</h2>
        <div class="deck-controls">
          <span class="label-inline">Bilder:</span>
          <div class="seg small" role="group" aria-label="Bildquelle">
            ${[['picto', 'picto', 'Piktogramme'], ['clipart', 'brush', 'Cliparts'], ['emoji', 'smile', 'Emojis']].map(([k, ic, t]) => `<button class="seg-btn" data-action="pic-style" data-style="${k}" aria-pressed="${set.picStyle === k}">${icon(ic)}<span>${t}</span></button>`).join('')}
          </div>
          <button class="btn small primary" data-action="review-pics">${icon('check')} Bilder prüfen</button>
          ${claudeSample ? `<button class="btn small secondary" data-action="draw-missing">${icon('brush')} Fehlende Bilder zeichnen</button>` : ''}
        </div>
      </div>
      <p class="pic-status" id="pic-status">${picStatusText(set)}</p>
      <div class="deck-grid" id="deck-grid">${set.words.map((w) => deckCard(set, w)).join('')}</div>
      <p class="credits" id="credits">${creditsText(set)}</p>
    </section>`}
  </section>`;
}

function deckCard(set, w) {
  return `<button class="deck-card" data-action="pic-dialog" data-wid="${w.id}" aria-label="Bild für „${esc(w.foreign)}“ ändern">
    ${picHTML(w, set.lang, 'deck-pic')}
    <span class="deck-words"><strong lang="${set.lang}">${esc(w.foreign)}</strong><small lang="de">${esc(w.german)}</small></span>
    <span class="deck-edit" aria-hidden="true">${icon('image')}</span>
  </button>`;
}

function picStatusText(set) {
  const job = picJobs.get(set.id);
  if (job) return `<span class="spinner" aria-hidden="true"></span> Bilder werden gesucht … ${job.done} von ${job.total}`;
  if (set.picStyle === 'picto' && net.arasaacDown) return 'Die Piktogramm-Sammlung ist gerade nicht erreichbar – deshalb siehst du Emojis. Tippe auf eine Karte, um ein Bild selbst zu wählen.';
  if (set.picStyle === 'clipart' && net.clipartDown) return 'Die Clipart-Sammlung ist gerade nicht erreichbar. Stattdessen siehst du Piktogramme oder Emojis. Tippe auf eine Karte, um ein Bild selbst zu wählen.';
  return 'Tipp: Prüfe die Bilder einmal mit „Bilder prüfen“, bevor du die Portion mit der Klasse teilst. Wörter ohne eindeutiges Bild lässt du einfach ohne Bild.';
}

function creditsText(set) {
  const pics = set.words.map((w) => w.pic).filter((p) => p && p.kind === 'picto');
  const parts = [];
  if (pics.some((p) => /arasaac/.test(p.src))) parts.push('Piktogramme: Sergio Palao, <a href="https://arasaac.org" target="_blank" rel="noopener">ARASAAC</a>, Eigentum der Regierung von Aragón, Lizenz CC BY-NC-SA.');
  if (pics.some((p) => !/arasaac/.test(p.src))) parts.push('Symbole über <a href="https://globalsymbols.com" target="_blank" rel="noopener">Global Symbols</a> (Lizenzen der jeweiligen Sammlung).');
  return parts.join(' ');
}

function refreshDeck(set, word) {
  if (ui.view === 'set' && ui.setId === set.id) {
    const st = $('#pic-status');
    if (st) st.innerHTML = picStatusText(set);
    const cr = $('#credits');
    if (cr) cr.innerHTML = creditsText(set);
    if (word) {
      const el = $(`.deck-card[data-wid="${word.id}"]`);
      if (el) el.outerHTML = deckCard(set, word);
    } else {
      const grid = $('#deck-grid');
      if (grid) grid.innerHTML = set.words.map((w) => deckCard(set, w)).join('');
    }
  }
  if (ui.view === 'pics' && ui.setId === set.id && word) renderReviewRow(set, word);
  if (ui.modal?.wid && word && ui.modal.wid === word.id) refreshPicDialogHead(set, word);
}

function startPictureFill(set, force = false) {
  if (picJobs.has(set.id)) return;
  fillPictures(set, { force, onProgress: (w) => refreshDeck(set, w) });
}

/* ---------------- Vokabeln bearbeiten ---------------- */
function openEditDialog(set) {
  const row = (w) => `<div class="edit-row" data-wid="${w ? w.id : ''}">
      <input class="e-foreign" type="text" value="${esc(w?.foreign || '')}" aria-label="Englisch" lang="en" spellcheck="false">
      <input class="e-german" type="text" value="${esc(w?.german || '')}" aria-label="Deutsch" lang="de">
      <button type="button" class="icon-btn subtle" data-action="edit-remove-row" aria-label="Zeile löschen">${icon('trash')}</button>
    </div>`;
  openModal(`
    <form id="edit-form" class="edit-form">
      <header class="modal-head"><h2>Vokabeln bearbeiten</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
      <label class="field" for="edit-name"><span class="label">Name</span><input id="edit-name" type="text" value="${esc(set.name)}" maxlength="80"></label>
      <div class="edit-table">
        <div class="edit-row edit-head"><span>Englisch</span><span>Deutsch</span><span></span></div>
        <div id="edit-rows">${set.words.map(row).join('')}</div>
      </div>
      <button type="button" class="btn small ghost" data-action="edit-add-row">${icon('plus')} Vokabel hinzufügen</button>
      <footer class="modal-foot">
        <button type="button" class="btn ghost" data-action="close-modal">Abbrechen</button>
        <button type="submit" class="btn primary">Speichern</button>
      </footer>
    </form>`, { cls: 'wide', label: 'Vokabeln bearbeiten' });
  ui.modal.newRow = () => row(null);
  $('#edit-form').addEventListener('submit', (e) => { e.preventDefault(); saveEditDialog(set); });
}

function saveEditDialog(set) {
  const rows = $$('#edit-rows .edit-row').map((r) => ({
    id: r.dataset.wid, foreign: $('.e-foreign', r).value.trim(), german: $('.e-german', r).value.trim(),
  })).filter((r) => r.foreign || r.german);
  if (!rows.some((r) => r.foreign)) { toast('Mindestens eine Vokabel braucht ein Wort.', 'bad'); return; }
  const old = new Map(set.words.map((w) => [w.id, w]));
  set.name = $('#edit-name').value.trim() || set.name;
  set.words = rows.map((r) => {
    const w = old.get(r.id);
    if (w) {
      const changed = w.foreign !== r.foreign || w.german !== r.german;
      w.foreign = r.foreign; w.german = r.german;
      if (changed && !(w.pic && w.pic.manual)) { w.pic = null; w.picStatus = 'stale'; }
      return w;
    }
    return { id: uid(), foreign: r.foreign, german: r.german, pic: null, picStatus: 'stale' };
  });
  set.updated = Date.now();
  saveDB();
  closeModal(true);
  render();
  startPictureFill(set);
  toast('Gespeichert.');
}

/* ---------------- Bild wählen ---------------- */
function openPicDialog(set, word) {
  openModal(`
    <header class="modal-head">
      <div class="pd-head" id="pd-head"></div>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button>
    </header>
    <div class="tabs" role="tablist">
      ${[['picto', 'picto', 'Piktogramm'], ['clipart', 'brush', 'Clipart'], ['emoji', 'smile', 'Emoji'], ...(claudeSample ? [['draw', 'brush', 'Zeichnen']] : []), ['own', 'upload', 'Eigenes Bild']]
        .map(([k, ic, t]) => `<button type="button" role="tab" class="tab" data-action="pic-tab" data-tab="${k}" aria-selected="${ui.picTab === k}">${icon(ic)}<span>${t}</span></button>`).join('')}
    </div>
    <div class="pd-body" id="pd-body"></div>
    <footer class="modal-foot">
      <button type="button" class="btn ghost" data-action="pic-none">Ohne Bild</button>
      <button type="button" class="btn ghost" data-action="pic-auto">Automatisch</button>
      <button type="button" class="btn primary" data-action="close-modal">Fertig</button>
    </footer>`, { cls: 'wide pic-dialog', label: `Bild für ${word.foreign}` });
  ui.modal.wid = word.id;
  if ((!claudeSample && ui.picTab === 'draw') || ui.picTab === 'photo') ui.picTab = 'picto';
  refreshPicDialogHead(set, word);
  renderPicTab(set, word);
}

function refreshPicDialogHead(set, word) {
  const head = $('#pd-head');
  if (!head) return;
  const p = word.pic;
  const credit = p?.credit ? `<a href="${esc(p.credit.url)}" target="_blank" rel="noopener">${esc(p.credit.text)}</a>` : (p?.kind === 'upload' ? 'Eigenes Bild' : p?.kind === 'drawn' ? 'Gezeichnet von Claude' : '');
  head.innerHTML = `${picHTML(word, set.lang, 'pd-current')}
    <div><h2 lang="${set.lang}">${esc(word.foreign)}</h2><p>${esc(word.german)}</p>${credit ? `<p class="credit">Quelle: ${credit}</p>` : ''}</div>`;
}

function choosePic(set, word, pic) {
  word.pic = { ...pic, manual: true };
  word.picStatus = 'done';
  brokenPics.delete(pic.src);
  saveDB();
  refreshPicDialogHead(set, word);
  refreshDeck(set, word);
  $$('#pd-body .cand').forEach((c) => c.classList.toggle('chosen', c.dataset.src === pic.src));
}

function candHTML(c, kind) {
  return `<button type="button" class="cand ${kind === 'picto' || kind === 'clipart' ? 'picto' : ''}" data-action="pic-choose" data-kind="${kind}" data-src="${esc(c.src)}" data-credit="${esc(c.credit ? JSON.stringify(c.credit) : '')}" title="${esc(c.title || '')}">
    <img src="${esc(c.src)}" alt="${esc(c.title || '')}" loading="lazy" onerror="this.closest('.cand').classList.add('failed')">
    ${c.title ? `<span>${esc(c.title)}</span>` : ''}
  </button>`;
}

async function renderPicTab(set, word) {
  const body = $('#pd-body');
  if (!body) return;
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === ui.picTab)));
  const tab = ui.picTab;
  const deCore = core(word.german, 'de'), foCore = core(word.foreign, 'en');

  if (tab === 'picto') {
    body.innerHTML = `
      <p class="muted">Piktogramme sind einfache, eindeutige Zeichnungen. Es gibt sie auch für Verben, Gefühle und Eigenschaften.</p>
      <form class="search-row" id="picto-search">
        <input id="picto-q" type="search" value="${esc(deCore || foCore)}" aria-label="Suchbegriff (Deutsch oder Englisch)">
        <button class="btn secondary" type="submit">${icon('search')} Suchen</button>
      </form>
      <p class="label">ARASAAC</p>
      <div class="cands" id="picto-results"><p class="muted"><span class="spinner"></span> Suche Piktogramme …</p></div>
      <p class="label">Weitere Symbol-Sammlungen <small class="muted">(Global Symbols: Mulberry, Sclera, Tawasol u. a.)</small></p>
      <div class="cands" id="gs-results"><p class="muted"><span class="spinner"></span> Suche Symbole …</p></div>
      <p class="muted small">Piktogramme: Sergio Palao, <a href="https://arasaac.org" target="_blank" rel="noopener">ARASAAC</a> (CC BY-NC-SA) · Symbole: <a href="https://globalsymbols.com" target="_blank" rel="noopener">Global Symbols</a> (offene Lizenzen der jeweiligen Sammlung)</p>`;
    const show = (boxId, list, down, empty) => {
      const box = $(boxId);
      if (!box) return;
      if (down && !list.length) box.innerHTML = '<p class="muted">Diese Sammlung ist gerade nicht erreichbar. Bist du online?</p>';
      else if (!list.length) box.innerHTML = `<p class="muted">${empty}</p>`;
      else box.innerHTML = list.map((c) => candHTML(c, 'picto')).join('');
      $$(`${boxId} .cand`).forEach((c) => c.classList.toggle('chosen', c.dataset.src === word.pic?.src));
    };
    const runGS = async (q) => {
      net.gsDown = false;
      const list = await globalSymbolsSearch(q, 18);
      show('#gs-results', list, net.gsDown, 'Keine weiteren Symbole gefunden. Diese Sammlungen sind englisch beschriftet – probiere ein englisches Wort.');
    };
    net.arasaacDown = false;
    $('#picto-search').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = $('#picto-q').value.trim();
      net.arasaacDown = false;
      $('#picto-results').innerHTML = '<p class="muted"><span class="spinner"></span> Suche …</p>';
      $('#via-note')?.remove();
      $('#gs-results').innerHTML = '<p class="muted"><span class="spinner"></span> Suche …</p>';
      runGS(q);
      show('#picto-results', await pictoSearch(q), net.arasaacDown, 'Kein Piktogramm gefunden. Probiere ein anderes, einfacheres Wort.');
    });
    runGS(foCore || deCore);
    const first = await pictoCandidates(word, set.lang, 12);
    show('#picto-results', first.length ? first : await pictoSearch(deCore || foCore), net.arasaacDown, 'Kein Piktogramm gefunden. Probiere ein anderes, einfacheres Wort.');
    const via = first.find((c) => c.via)?.via;
    if (via && first[0]?.via && $('#picto-results')) {
      $('#picto-results').insertAdjacentHTML('beforebegin', `<p class="via-note" id="via-note">${icon('sparkle')}<span>Für „${esc(deCore || foCore)}“ gibt es kein eigenes Piktogramm. Diese Bilder passen zu <strong>„${esc(via)}“</strong> aus derselben Wortfamilie.</span></p>`);
    }
  } else if (tab === 'clipart') {
    const kind = ui.clipKind || 'color';
    body.innerHTML = `
      <p class="muted">Cliparts und Symbole aus offenen Sammlungen (z. B. Microsoft Fluent Emoji, Google Noto, OpenMoji, Material Symbols, Game Icons). Am besten auf Englisch suchen.</p>
      <form class="search-row" id="clip-search">
        <input id="clip-q" type="search" value="${esc(foCore)}" aria-label="Suchbegriff (Englisch)">
        <button class="btn secondary" type="submit">${icon('search')} Suchen</button>
      </form>
      <div class="seg small" role="group" aria-label="Art der Bilder">
        <button type="button" class="seg-btn" data-action="clip-kind" data-kind="color" aria-pressed="${kind === 'color'}">Farbig</button>
        <button type="button" class="seg-btn" data-action="clip-kind" data-kind="mono" aria-pressed="${kind === 'mono'}">Einfarbige Symbole</button>
      </div>
      <div class="cands" id="clip-results"><p class="muted"><span class="spinner"></span> Suche …</p></div>`;
    const runClip = async (q) => {
      const box = $('#clip-results');
      if (!box) return;
      net.clipartDown = false;
      box.innerHTML = '<p class="muted"><span class="spinner"></span> Suche …</p>';
      const list = await clipartSearch(q, 36, ui.clipKind || 'color');
      if (!$('#clip-results')) return;
      if (net.clipartDown && !list.length) box.innerHTML = '<p class="muted">Die Clipart-Sammlung ist gerade nicht erreichbar. Bist du online?</p>';
      else if (!list.length) box.innerHTML = `<p class="muted">Nichts gefunden. Probiere ein anderes englisches Wort${(ui.clipKind || 'color') === 'color' ? ' oder „Einfarbige Symbole“' : ''}.</p>`;
      else box.innerHTML = list.map((c) => candHTML(c, 'clipart')).join('');
      $$('#clip-results .cand').forEach((c) => c.classList.toggle('chosen', c.dataset.src === word.pic?.src));
    };
    $('#clip-search').addEventListener('submit', (e) => { e.preventDefault(); runClip($('#clip-q').value.trim()); });
    ui.modal.clipKind = (k) => {
      ui.clipKind = k;
      $$('[data-action="clip-kind"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === k)));
      runClip($('#clip-q').value.trim());
    };
    runClip(foCore || deCore);
  } else if (tab === 'draw') {
    body.innerHTML = `
      <p class="muted">Claude zeichnet ein Bild für diese Karte. Das dauert etwa 20 Sekunden.</p>
      <div class="cands" id="draw-results"></div>
      <button type="button" class="btn secondary" data-action="draw-one">${icon('brush')} Bild zeichnen lassen</button>`;
  } else if (tab === 'emoji') {
    const local = localPicture(word, set.lang);
    const guess = [...(foCore ? searchEmojis(foCore, 0, 8, 3) : []), ...(deCore ? searchEmojis(deCore, 0, 8, 3) : [])];
    const seen = new Set(local ? [local.src] : []);
    const sugg = guess.filter((r) => (seen.has(r.e) ? false : seen.add(r.e))).slice(0, 10);
    const cats = [['school', 'Schulwörter'], ...EMOJI_GROUPS.map(([g, t]) => [String(g), t])];
    const cat = ui.emojiCat || 'school';
    body.innerHTML = `
      <form class="search-row" id="emoji-search" role="search">
        <input id="emoji-q" type="search" placeholder="Suchen: Apfel, traurig, teacher …" aria-label="Emoji suchen" value="">
        <input id="emoji-own" type="text" maxlength="16" placeholder="Eigenes Emoji" aria-label="Eigenes Emoji eingeben" class="emoji-own">
        <button class="btn secondary" type="submit">Nehmen</button>
      </form>
      ${local || sugg.length ? `<p class="label">Vorschläge</p><div class="emoji-grid">${local ? emojiBtn(local) : ''}${sugg.map((r) => emojiBtn({ kind: 'emoji', src: r.e }, r.de)).join('')}</div>` : ''}
      <div class="chips" role="group" aria-label="Kategorie" id="emoji-cats">
        ${cats.map(([k, t]) => `<button type="button" class="chip" data-action="emoji-cat" data-cat="${k}" aria-pressed="${cat === k}">${t}</button>`).join('')}
      </div>
      <div class="emoji-grid" id="emoji-grid"></div>
      <p class="muted small">${EMOJIS.rows.length + PICTURES.entries.length} Emojis. Namen aus Unicode CLDR (emojibase, MIT). Wie die Emojis aussehen, hängt vom Gerät ab.</p>`;
    const draw = (q) => {
      const grid = $('#emoji-grid');
      if (!grid) return;
      const c = ui.emojiCat || 'school';
      if (!q && c === 'school') {
        grid.innerHTML = searchPictureEntries('', 600).map((e) => emojiBtn(entryToPic(e), e.de[0])).join('');
        return;
      }
      const curated = q ? searchPictureEntries(q, 30).map((e) => emojiBtn(entryToPic(e), e.de[0])) : [];
      const all = searchEmojis(q, +c || 0, 400).map((r) => emojiBtn({ kind: 'emoji', src: r.e }, r.de));
      grid.innerHTML = [...curated, ...all].join('') || '<p class="muted">Kein passendes Emoji gefunden. Probiere ein anderes Wort, auf Deutsch oder Englisch.</p>';
    };
    $('#emoji-q').addEventListener('input', (e) => {
      $$('#emoji-cats .chip').forEach((b) => b.setAttribute('aria-pressed', String(!e.target.value && b.dataset.cat === (ui.emojiCat || 'school'))));
      draw(e.target.value);
    });
    $('#emoji-search').addEventListener('submit', (e) => {
      e.preventDefault();
      const own = $('#emoji-own').value.trim();
      if (own) choosePic(set, word, { kind: 'emoji', src: own });
    });
    ui.modal.emojiCat = (k) => {
      ui.emojiCat = k;
      const q = $('#emoji-q');
      if (q) q.value = '';
      $$('#emoji-cats .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === k)));
      draw('');
    };
    draw('');
  } else if (tab === 'own') {
    const q0 = foCore || deCore;
    body.innerHTML = `
      <div class="own-grid">
        <section class="web-search" aria-labelledby="web-title">
          <p class="label" id="web-title">Bild im Internet suchen</p>
          <div class="search-row">
            <input id="web-q" type="search" value="${esc(q0)}" aria-label="Suchwort für Google oder Pixabay">
          </div>
          <div class="row">
            <a class="btn secondary" id="web-google" target="_blank" rel="noopener" href="#">${icon('search')} Google Bilder ↗</a>
            <a class="btn secondary" id="web-pixabay" target="_blank" rel="noopener" href="#">${icon('search')} Pixabay ↗</a>
          </div>
          <ol class="howto small">
            <li>Passendes Bild anklicken, damit es groß angezeigt wird.</li>
            <li>Rechtsklick → <strong>„Bild kopieren“</strong> (iPhone/iPad: Bild lange drücken → <strong>Kopieren</strong>).</li>
            <li>Hierher zurück und unten einfügen.</li>
          </ol>
          <div class="paste-zone" id="paste-zone" contenteditable="true" role="textbox" aria-label="Kopiertes Bild hier einfügen"
            data-placeholder="Hier einfügen: Strg+V (Mac: ⌘+V) oder lange tippen → Einsetzen"></div>
          <p class="muted small">Achte bei Bildern aus Google auf die Rechte. Eingefügte Bilder bleiben auf deinem Gerät und werden mit dem Teilen-Link nicht mitgeschickt.</p>
        </section>
        <div class="own-side">
          <label class="drop" for="own-file">
            ${icon('upload', 'big')}
            <strong>Foto auswählen oder aufnehmen</strong>
            <small>Vom Gerät oder mit der Kamera.</small>
            <input id="own-file" type="file" accept="image/*">
          </label>
          <form class="own-url" id="own-url">
            <label class="field" for="own-url-input"><span class="label">Oder Bild-Adresse</span>
              <input id="own-url-input" type="url" placeholder="https://…/bild.jpg"></label>
            <button class="btn secondary" type="submit">Übernehmen</button>
          </form>
        </div>
      </div>`;
    const setLinks = () => {
      const q = ($('#web-q')?.value || '').trim();
      const g = $('#web-google'), px = $('#web-pixabay');
      if (g) g.href = `https://www.google.com/search?udm=2&q=${encodeURIComponent(q)}`;
      if (px) px.href = `https://pixabay.com/de/images/search/${encodeURIComponent(q)}/`;
    };
    $('#web-q').addEventListener('input', setLinks);
    setLinks();
    $('#own-file').addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (f) await useOwnFile(set, word, f);
    });
    $('#own-url').addEventListener('submit', async (e) => {
      e.preventDefault();
      await useImageUrl(set, word, $('#own-url-input').value.trim());
    });
  }
}

/* ---------------- Bilder prüfen ---------------- */
function viewPics(set) {
  const L = LANGS[set.lang].name;
  return `<section class="mode pics-view">
    <div class="mode-bar">
      <h1 class="mode-title">Bilder prüfen</h1>
      <div class="mode-controls"><button class="btn primary" data-action="open-set" data-id="${set.id}">${icon('check')} Fertig</button></div>
    </div>
    <p class="lead pics-lead">Passt jedes Bild eindeutig zu seinem Wort? Tippe auf ein besseres Bild. Lässt sich ein Wort nicht gut zeigen, wähle <strong>Kein Bild</strong> – dann kommt es nur bei „${L} ↔ Deutsch“ dran, nicht beim Bilder-Zuordnen.</p>
    <ol class="review-list">${set.words.map((w) => `<li class="rrow" id="rr-${w.id}">${reviewRowHTML(set, w)}</li>`).join('')}</ol>
    <p class="credits">${creditsText(set) || 'Piktogramme: Sergio Palao, <a href="https://arasaac.org" target="_blank" rel="noopener">ARASAAC</a>, Lizenz CC BY-NC-SA.'}</p>
  </section>`;
}

function candPicHTML(c) {
  if (c.kind === 'emoji') return `<span class="emo">${esc(c.src)}</span>`;
  if (c.kind === 'color') return `<span class="swatch" style="--swatch:${esc(c.src)}"></span>`;
  if (c.kind === 'number') return `<span class="num">${esc(c.src)}</span>`;
  return `<img src="${esc(c.src)}" alt="${esc(c.title || '')}" loading="lazy" onerror="this.closest('.rcand').classList.add('failed')">`;
}

function reviewRowHTML(set, w) {
  const cands = ui.reviewCands[w.id];
  const cur = w.pic;
  let list = cands ? cands.slice() : [];
  if (cur && cur.kind !== 'none' && cur.src && !list.some((c) => c.src === cur.src)) list.unshift(cur);
  ui.reviewList = ui.reviewList || {};
  ui.reviewList[w.id] = list;
  const curSrc = effectivePic(w, set.lang)?.src;
  const label = { picto: 'Piktogramm', clipart: 'Clipart', emoji: 'Emoji', photo: 'Foto', upload: 'eigenes Bild', drawn: 'Zeichnung', url: 'Bild', color: 'Farbe', number: 'Zahl' };
  return `<div class="rrow-word"><strong lang="${set.lang}">${esc(w.foreign)}</strong><small lang="de">${esc(w.german)}</small></div>
    <div class="rrow-cands">
      ${cands ? '' : '<span class="rcand loading"><span class="spinner"></span></span>'}
      ${list.map((c, i) => `<button type="button" class="rcand ${c.kind === 'picto' || c.kind === 'clipart' ? 'picto' : ''} ${cur?.kind !== 'none' && c.src === curSrc ? 'chosen' : ''}" data-action="review-pick" data-wid="${w.id}" data-i="${i}" title="${esc(label[c.kind] || '')}${c.title ? ': ' + esc(c.title) : ''}" aria-label="${esc(label[c.kind] || 'Bild')} wählen">${candPicHTML(c)}</button>`).join('')}
      <button type="button" class="rcand text ${cur?.kind === 'none' ? 'chosen' : ''}" data-action="review-none" data-wid="${w.id}">${icon('x')}<span>Kein Bild</span></button>
      <button type="button" class="rcand text" data-action="pic-dialog" data-wid="${w.id}">${icon('search')}<span>Mehr …</span></button>
    </div>`;
}

function renderReviewRow(set, w) {
  const el = document.getElementById('rr-' + w.id);
  if (el) el.innerHTML = reviewRowHTML(set, w);
}

async function loadReview(set) {
  const queue = set.words.filter((w) => !ui.reviewCands[w.id]);
  let i = 0;
  const worker = async () => {
    while (i < queue.length) {
      const w = queue[i++];
      if (ui.view !== 'pics') return;
      const [pictos, symbols, cliparts] = await Promise.all([
        pictoCandidates(w, set.lang, 4).catch(() => []),
        globalSymbolsSearch(core(w.foreign, 'en'), 2).catch(() => []),
        clipartCandidates(w, set.lang, 3).catch(() => []),
      ]);
      const local = localPicture(w, set.lang);
      const list = [...pictos, ...symbols, ...cliparts];
      if (local) list.push(local);
      const seen = new Set();
      ui.reviewCands[w.id] = list.filter((c) => (seen.has(c.src) ? false : seen.add(c.src)));
      if (ui.view === 'pics') renderReviewRow(set, w);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

function emojiBtn(pic, title = '') {
  const inner = pic.kind === 'color' ? `<span class="swatch" style="--swatch:${esc(pic.src)}"></span>` : pic.kind === 'number' ? `<span class="num">${esc(pic.src)}</span>` : esc(pic.src);
  return `<button type="button" class="emoji-btn" data-action="pic-choose" data-kind="${pic.kind}" data-src="${esc(pic.src)}" title="${esc(title)}" aria-label="${esc(title || pic.src)}">${inner}</button>`;
}

async function useOwnFile(set, word, file) {
  if (!file.type.startsWith('image/')) { toast('Das ist kein Bild.', 'bad'); return; }
  try {
    const data = await fileToDataURL(file);
    choosePic(set, word, { kind: 'upload', src: data });
    toast('Eigenes Bild gespeichert.');
  } catch { toast('Das Bild konnte nicht gelesen werden.', 'bad'); }
}

async function useImageUrl(set, word, url) {
  if (!/^https?:\/\//i.test(url)) { toast('Bitte eine Adresse eingeben, die mit https:// beginnt.', 'bad'); return; }
  const ok = await loadImage(url, 15000);
  if (!ok) { toast('Dieses Bild lässt sich nicht laden. Kopiere besser das Bild selbst (Rechtsklick → Bild kopieren) und füge es ein.', 'bad'); return; }
  choosePic(set, word, { kind: 'url', src: url, credit: { text: new URL(url).hostname, url } });
  toast('Bild übernommen.');
}

document.addEventListener('paste', (e) => {
  if (!ui.modal?.wid) return;
  const set = currentSet();
  const word = set?.words.find((w) => w.id === ui.modal.wid);
  if (!set || !word) return;
  const items = [...(e.clipboardData?.items || [])];
  const file = items.find((i) => i.type.startsWith('image/'))?.getAsFile()
    || [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
  if (file) { e.preventDefault(); useOwnFile(set, word, file); clearPasteZone(); return; }
  // Kein Bild, aber eine Bild-Adresse oder ein kopiertes <img>?
  const html = e.clipboardData?.getData('text/html') || '';
  const text = (e.clipboardData?.getData('text/plain') || '').trim();
  const src = (html.match(/<img[^>]+src="(https?:[^"]+)"/i) || [])[1] || (/^https?:\/\/\S+$/i.test(text) ? text : '');
  const inField = e.target.closest?.('input, textarea');
  if (src && (!inField || e.target.id === 'own-url-input')) { e.preventDefault(); useImageUrl(set, word, src.replace(/&amp;/g, '&')); clearPasteZone(); return; }
  if (e.target.id === 'paste-zone') { e.preventDefault(); toast('In der Zwischenablage ist kein Bild. Kopiere zuerst ein Bild (Rechtsklick → Bild kopieren).', 'bad'); }
});
function clearPasteZone() { const z = $('#paste-zone'); if (z) z.innerHTML = ''; }

/* ---------------- Claude zeichnet (nur in claude.ai-Artifacts verfügbar) ---------------- */
let claudeSample = null;
function initClaude() {
  const c = window.claude;
  if (!c?.use || initClaude.done) return;
  initClaude.done = true;
  c.use('sample').then((s) => {
    if (!s) return;
    claudeSample = s;
    if (ui.view === 'set') render();
  }).catch(() => { /* nicht verfügbar */ });
}

function sanitizeSvg(text) {
  const m = String(text).match(/<svg[\s\S]*<\/svg>/i);
  if (!m) throw new Error('Keine Zeichnung erhalten');
  let svg = m[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(image|use|a)\b[^>]*>/gi, '').replace(/<\/(a)>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');
  if (!/xmlns=/.test(svg)) svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

async function claudeDraw(word, lang) {
  const fo = core(word.foreign, lang), de = core(word.german, 'de');
  const prompt = `Draw a picture for a children's vocabulary flash card.
Word: "${fo}" (English)${de ? `, German meaning: "${de}"` : ''}.
Reply with ONE standalone SVG document and nothing else.
Rules:
- Start with <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
- A cute, friendly flat illustration with bold cheerful colours and simple soft shading. The subject is large, centred and easy to recognise for a 9-year-old. If the word is a verb or adjective, show a child or animal doing or being it.
- No text, letters or numbers. No <script>, <image>, <use>, links or fonts.
- At most 70 shapes and under 7000 characters.`;
  const r = await claudeSample(prompt, { modelTier: 'default' });
  return sanitizeSvg(r.text);
}

async function drawMissing(set) {
  if (!claudeSample || ui.drawing) return;
  const todo = set.words.filter((w) => !hasPicture(w, set.lang));
  if (!todo.length) { toast('Alle Karten haben schon ein Bild.'); return; }
  ui.drawing = true;
  let n = 0;
  for (const w of todo) {
    w.picStatus = 'pending'; refreshDeck(set, w);
    try {
      const src = await claudeDraw(w, set.lang);
      w.pic = { kind: 'drawn', src, manual: true };
    } catch (e) {
      if (e?.code === 'not_granted' || e?.code === 'rate_limited') { w.picStatus = 'done'; refreshDeck(set, w); toast(e.code === 'rate_limited' ? 'Claude braucht eine Pause. Versuch es gleich noch einmal.' : 'Zeichnen ist nicht erlaubt.', 'bad'); break; }
    }
    w.picStatus = 'done'; n++;
    saveDB(); refreshDeck(set, w);
  }
  ui.drawing = false;
  if (n) toast(`${n} ${n === 1 ? 'Bild' : 'Bilder'} gezeichnet.`);
}

/* ---------------- Einstellungen ---------------- */
function openSettings() {
  const s = db.settings;
  const voiceSelect = (lang) => {
    const vs = voicesFor(lang);
    return `<select id="voice-${lang}" data-lang="${lang}">
      <option value="">Automatisch</option>
      ${vs.map((v) => `<option value="${esc(v.name)}" ${s.voice?.[lang] === v.name ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}
    </select>`;
  };
  openModal(`
    <header class="modal-head"><h2>Einstellungen</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <div class="settings">
      <label class="switch"><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}><span>Klänge bei richtig und falsch</span></label>
      <label class="switch"><input type="checkbox" id="set-autospeak" ${s.autoSpeak ? 'checked' : ''}><span>Wörter automatisch vorlesen</span></label>
      <div class="field"><span class="label">Englische Aussprache</span>
        <div class="seg" role="group" aria-label="Englische Aussprache">
          <button type="button" class="seg-btn" data-action="set-accent" data-accent="gb" aria-pressed="${s.accent !== 'us'}">Britisch</button>
          <button type="button" class="seg-btn" data-action="set-accent" data-accent="us" aria-pressed="${s.accent === 'us'}">Amerikanisch</button>
        </div>
      </div>
      ${canSpeak() ? `
      <label class="field" for="voice-en"><span class="label">Stimme</span>${voiceSelect('en')}</label>
      <label class="field" for="set-rate"><span class="label">Sprechtempo</span><input type="range" id="set-rate" min="0.6" max="1.2" step="0.05" value="${s.rate}"></label>
      <div class="row"><button type="button" class="btn small secondary" data-action="voice-test" data-lang="en">${icon('speaker')} Stimme testen</button></div>`
        : '<p class="warn">Dieser Browser kann nicht vorlesen.</p>'}
      ${phoneticSettingsHTML(s)}
      <div class="field"><span class="label">Mikrofon und Spracherkennung</span>
        ${canListen()
          ? `<label class="field" for="mic-device"><span class="small muted">Mikrofon</span>
               <select id="mic-device"><option value="">Standard-Mikrofon</option></select></label>
             <div class="row"><button type="button" class="btn small secondary" data-action="mic-test">${icon('mic')} Mikrofon testen</button></div>
             <div class="mic-level big" id="mic-test-level" aria-hidden="true"><span></span></div>
             <p class="small" id="mic-test-out" aria-live="polite">Tippe auf „Mikrofon testen“ und sag ein Wort. Der Balken sollte sich beim Sprechen bewegen.</p>`
          : `<p class="muted small">${speechBrowserMissing ? 'Dieser Browser (Brave oder Opera) hat keine Spracherkennung. Am besten Chrome, Edge oder Safari benutzen.' : esc(micErrorText('not-supported', 'en'))}</p>`}
      </div>
      <hr>
      <p class="muted small">${cloud.user ? `Angemeldet als <strong>${esc(cloud.user)}</strong>: Deine Portionen werden in deinem Konto gespeichert.` : 'Alle Vokabeln und Ergebnisse werden in diesem Browser gespeichert. Mit „Anmelden“ (oben) speicherst du sie in deinem Konto.'}</p>
      <button type="button" class="btn small danger-ghost" data-action="wipe">${icon('trash')} Alles löschen</button>
      <p class="muted small app-version">Vokaboom · Version ${esc(typeof APP_VERSION === 'string' && APP_VERSION ? APP_VERSION.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/, '$3.$2.$1 $4:$5') : 'lokal')}</p>
    </div>`, { label: 'Einstellungen' });
  const m = ui.modal.el;
  fillMicSelect();
  updatePhSettings();
  m.addEventListener('input', (e) => {
    if (e.target.id === 'ph-min') { const v = $('#ph-min-val'); if (v) v.textContent = e.target.value; }
  });
  m.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'mic-device') { s.micId = t.value; saveDB(); }
    if (t.id === 'set-sound') s.sound = t.checked;
    if (t.id === 'set-autospeak') s.autoSpeak = t.checked;
    if (t.id === 'set-rate') s.rate = parseFloat(t.value);
    if (t.id?.startsWith('voice-')) s.voice = { ...(s.voice || {}), [t.dataset.lang]: t.value };
    if (t.id === 'ph-on' || t.id === 'ph-min') {
      s.phonetic = { ...phCfg(), on: $('#ph-on').checked, passMin: parseInt($('#ph-min').value, 10) || 60 };
      if (t.id === 'ph-on' && t.checked && !phState.engine) loadPhoneticEngine().catch(() => {});
    }
    saveDB();
  });
}

/* ---------- Lauterkennung ---------- */
function phoneticSettingsHTML(s) {
  const c = { on: false, passMin: 60, ...(s.phonetic || {}) };
  return `<div class="field ph-box">
    <span class="label">Lauterkennung</span>
    <p class="muted small">Prüft jeden einzelnen Laut statt nur das Wort. So fällt auch auf, wenn ein Wort so ausgesprochen wird, wie es geschrieben ist. Läuft ganz auf diesem Gerät, keine Aufnahme verlässt es. Beim ersten Mal werden ca. ${PH.MB} MB geladen und gespeichert. Auf älteren Handys kann es langsam sein.</p>
    <label class="switch"><input type="checkbox" id="ph-on" ${c.on ? 'checked' : ''}><span>Lauterkennung einschalten</span></label>
    <div class="row"><button type="button" class="btn small secondary" data-action="ph-load">${icon('upload')} Jetzt laden</button><span class="small" id="ph-status"></span></div>
    <div class="ph-progress" id="ph-progress-set" hidden><span id="ph-bar-set"></span></div>
    <label for="ph-min"><span class="small muted">Ein Wort zählt ab <strong id="ph-min-val">${c.passMin}</strong> von 100 Punkten</span></label>
    <input type="range" id="ph-min" min="30" max="90" step="5" value="${c.passMin}">
  </div>`;
}

async function updatePhSettings() {
  const st = $('#ph-status'), box = $('#ph-progress-set'), bar = $('#ph-bar-set');
  if (!st) return;
  const pct = Math.round((phState.progress || 0) * 100);
  if (box) box.hidden = phState.status !== 'loading';
  if (bar) bar.style.width = pct + '%';
  if (phState.status === 'loading') st.textContent = `Wird geladen … ${pct} %`;
  else if (phState.status === 'ready') st.textContent = 'Geladen und bereit ✓';
  else if (phState.status === 'error') st.textContent = `Laden hat nicht geklappt: ${phState.error}`;
  else st.textContent = (await phIsCached()) ? 'Auf diesem Gerät gespeichert – wird beim Üben geladen.' : 'Noch nicht geladen.';
}

async function fillMicSelect() {
  const sel = $('#mic-device');
  if (!sel) return;
  const mics = await listMics();
  const cur = db.settings.micId;
  sel.innerHTML = '<option value="">Standard-Mikrofon</option>' + mics.filter((d) => d.deviceId && d.deviceId !== 'default')
    .map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || `Mikrofon ${i + 1}`)}</option>`).join('');
}

/* ---------------- Teilen: nur QR-Code ---------------- */
async function openShare(set) {
  const text = set.words.map((w) => `${w.foreign} – ${w.german}`).join('\n');
  if (isFramed) {
    openModal(`
      <header class="modal-head"><h2>Vokabelliste kopieren</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
      <p class="muted">Kopiere die Liste und füge sie in Vokaboom auf einem anderen Gerät wieder ein.</p>
      <textarea id="share-text" class="share-box" rows="8" readonly>${esc(text)}</textarea>
      <footer class="modal-foot"><button type="button" class="btn primary" data-action="copy" data-target="share-text">${icon('copy')} Kopieren</button></footer>`, { label: 'Liste kopieren' });
    return;
  }
  const base = `${location.origin}${location.pathname}#v=`;
  const url = base + await encodeShare(set);
  // Für den QR-Code: so kurz wie möglich. Notfalls ohne Bild-Adressen (die Kinder-Geräte suchen dann selbst).
  let qrUrl = url;
  if (url.length > QR_COMFORT) {
    const lite = base + await encodeShare(set, { lite: true });
    if (lite.length < url.length) qrUrl = lite;
  }
  const qr = makeQR(qrUrl);
  ui.share = { url, qrUrl, qr, name: set.name };
  const hasUploads = set.words.some((w) => w.pic && (w.pic.kind === 'upload' || w.pic.kind === 'drawn'));
  openModal(`
    <header class="modal-head"><h2>Mit der Klasse teilen</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <div class="qr-box">
      ${qr ? `<button type="button" class="qr-btn" data-action="qr-full" aria-label="QR-Code groß anzeigen">${qrSVG(qr)}</button>
        <p class="qr-caption">Mit der Handy- oder Tablet-Kamera scannen – dann ist „${esc(set.name)}“ mit allen Karten da.${qr.getModuleCount() > 89 ? ' Viele Wörter: Der Code ist fein, am besten groß anzeigen.' : ''}</p>
        <div class="row center">
          <button type="button" class="btn primary" data-action="qr-full">${icon('grid')} Groß anzeigen</button>
          <button type="button" class="btn secondary" data-action="qr-save">${icon('upload')} Als Bild</button>
          <button type="button" class="btn ghost" data-action="copy-link">${icon('link')} Link kopieren</button>
        </div>`
        : `<p class="warn">Für einen QR-Code sind es zu viele Wörter. Teile die Portion in zwei kleinere auf – oder kopiere den Link.</p>
        <div class="row center"><button type="button" class="btn primary" data-action="copy-link">${icon('link')} Link kopieren</button></div>`}
      ${hasUploads ? '<p class="muted small">Eigene Fotos sind zu groß für den QR-Code. Dort erscheinen bei den Kindern automatisch gesuchte Bilder.</p>' : ''}
      ${publishBoxHTML(set)}
      ${location.protocol === 'file:' ? '<p class="warn">Du hast Vokaboom als Datei geöffnet. Damit der QR-Code bei anderen funktioniert, muss Vokaboom im Internet liegen (zum Beispiel über GitHub Pages).</p>' : ''}
    </div>`, { cls: 'share-modal', label: 'Teilen' });
  bindPublishBox(set);
}

function copyText(text) {
  const done = () => toast('Link kopiert.');
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy') ? done() : toast('Kopieren hat nicht geklappt.', 'bad'); } catch { toast('Kopieren hat nicht geklappt.', 'bad'); }
    ta.remove();
  };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch { fallback(); }
}

/* ---------- QR-Code ---------- */
const QR_COMFORT = 900; // bis hierhin bleibt der Code grob genug für den Beamer

function makeQR(text) {
  if (typeof qrcode !== 'function') return null;
  try {
    const q = qrcode(0, 'L'); // Größe automatisch, wenig Fehlerkorrektur = gröbere Punkte
    q.addData(text, 'Byte');
    q.make();
    return q;
  } catch { return null; } // zu lang für einen QR-Code
}

function qrSVG(q, label = 'QR-Code zum Scannen') {
  const n = q.getModuleCount(), m = 4, size = n + m * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

function openQRFull() {
  const sh = ui.share;
  if (!sh?.qr) return;
  const prevModal = ui.modal;
  const wrap = document.createElement('div');
  wrap.className = 'qr-full';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'QR-Code groß');
  wrap.innerHTML = `<div class="qr-full-inner">
      <h2>${esc(sh.name)}</h2>
      ${qrSVG(sh.qr)}
      <p>Kamera öffnen und den Code scannen</p>
      <button type="button" class="btn ghost" data-action="qr-full-close">${icon('x')} Schließen</button>
    </div>`;
  document.body.appendChild(wrap);
  ui.qrFull = wrap;
  try { wrap.requestFullscreen?.().catch(() => {}); } catch { /* */ }
  wrap.querySelector('button').focus();
  void prevModal;
}
function closeQRFull() {
  const w = ui.qrFull;
  if (!w) return;
  ui.qrFull = null;
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* */ }
  w.remove();
}

function saveQRImage() {
  const sh = ui.share;
  if (!sh?.qr) return;
  const n = sh.qr.getModuleCount(), m = 4, cell = 12, size = (n + m * 2) * cell;
  const c = document.createElement('canvas');
  c.width = size; c.height = size + 70;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (sh.qr.isDark(r, k)) x.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
  x.fillStyle = '#18264A'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center';
  x.fillText(sh.name.slice(0, 40), size / 2, size + 30);
  c.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Vokaboom-QR-${sh.name.replace(/[^\wäöüÄÖÜß-]+/g, '-').slice(0, 40)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('QR-Code als Bild gespeichert.');
  }, 'image/png');
}

function copyFrom(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const done = () => toast('Kopiert.');
  const fallback = () => { el.focus(); el.select(); try { document.execCommand('copy') ? done() : toast('Markiert – jetzt mit Strg+C kopieren.'); } catch { toast('Markiert – jetzt mit Strg+C kopieren.'); } };
  try { navigator.clipboard.writeText(el.value).then(done, fallback); } catch { fallback(); }
}
