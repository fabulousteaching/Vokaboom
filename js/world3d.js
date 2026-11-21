/* Teilmal – 3D-Welt: «Mein Avatar» und «Garage»
 *
 * Links eine grosse 3D-Bühne (drehen: ziehen, zoomen: Mausrad oder zwei Finger), rechts die Auswahl:
 * Kategorien, Teile mit Vorschaubild, Preis und Seltenheit. Anprobieren geht immer und ist gratis.
 * Gespeichert wird automatisch, sobald alles, was die Figur trägt, dem Kind gehört (js/shop3d.js).
 * three.js und der Avatar-Baukasten (js/avatar3d.js) werden erst geladen, wenn man die 3D-Welt öffnet.
 */
'use strict';

const W3V = {
  page: 'avatar', cat: { avatar: 'body', garage: 'body' }, draft: { a3: null, car: null }, saved: { a3: null, car: null },
  st: null, token: 0, tryEmote: null, status: '', thumbs: new Map(), thumbQ: [], thumbBusy: false, tr: null,
};
const W3_PRE = { avatar: 'a3', garage: 'car' };
const w3Clone = (o) => JSON.parse(JSON.stringify(o));
const w3Same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const w3Hex = (c) => `#${(+c).toString(16).padStart(6, '0')}`;
const w3ColorsOf = (pre, slot, d) => { const it = w3Item(pre, slot, d[slot]); return it && it.v !== 'none' ? it.colors : 0; };
const W3_OUTFIT = (d) => w3Item('a3', 'top', d.top)?.cat === 'outfit' || d.top === 'dress';

/* ---------------- Kategorien ---------------- */
const A3_CATS = [
  { id: 'body', icon: '🙂', name: 'Ich', groups: [
    { t: 'color', key: 'skin', label: 'Hautfarbe', colors: W3_SKINS },
    { t: 'items', slot: 'eyes', label: 'Augen' },
    { t: 'color', key: 'eyeC', label: 'Augenfarbe', colors: W3_EYEC },
    { t: 'items', slot: 'brows', label: 'Augenbrauen' },
    { t: 'items', slot: 'mouth', label: 'Mund' },
    { t: 'toggles', label: 'Extras', opts: [['lashes', '👁️ Wimpern'], ['blush', '🌸 Rote Wangen'], ['freckles', '✨ Sommersprossen']] },
    { t: 'items', slot: 'deco', label: 'Gesicht verzieren' },
  ] },
  { id: 'hair', icon: '💇', name: 'Frisuren', groups: [
    { t: 'items', slot: 'hair', label: 'Frisur' },
    { t: 'color', key: 'hairC', label: 'Haarfarbe', colors: W3_HAIRC, extra: 'a3:hairC:rainbow' },
    { t: 'color', key: 'hairC2', label: 'Farbige Strähne', colors: W3_TRIM.slice(1, 7), when: (d) => w3ColorsOf('a3', 'hair', d) >= 2 },
  ] },
  { id: 'top', icon: '👕', name: 'Oberteile', groups: [
    { t: 'items', slot: 'top', cat: 'top', label: 'Oberteil' },
    { t: 'color', key: 'topC', label: 'Farbe', colors: W3_CLOTH },
    { t: 'color', key: 'topT', label: 'Akzentfarbe', colors: W3_TRIM, when: (d) => w3ColorsOf('a3', 'top', d) >= 2 },
    { t: 'color', key: 'topU', label: 'Shirt darunter', colors: [0xf4f4f6, 0x1f2430, 0xffbe2e, 0x22d3ee, 0xf9a8d4, 0x7c3aed], when: (d) => w3Item('a3', 'top', d.top)?.under },
  ] },
  { id: 'outfit', icon: '🦸', name: 'Outfits', groups: [
    { t: 'info', html: 'Ein Outfit ist Oberteil und Hose in einem.' },
    { t: 'items', slot: 'top', cat: 'outfit', label: 'Besondere Outfits' },
    { t: 'color', key: 'topC', label: 'Farbe', colors: W3_CLOTH, when: (d) => W3_OUTFIT(d) },
    { t: 'color', key: 'topT', label: 'Akzentfarbe', colors: W3_TRIM, when: (d) => W3_OUTFIT(d) },
  ] },
  { id: 'bottom', icon: '👖', name: 'Hosen', groups: [
    { t: 'info', html: 'Dein Outfit bedeckt gerade die Hose – wähle bei «Oberteile» ein Oberteil, dann siehst du sie.', when: (d) => W3_OUTFIT(d) },
    { t: 'items', slot: 'bottom', label: 'Hose oder Rock' },
    { t: 'color', key: 'bottomC', label: 'Farbe', colors: W3_PANTS },
    { t: 'color', key: 'bottomT', label: 'Akzentfarbe', colors: W3_TRIM, when: (d) => w3ColorsOf('a3', 'bottom', d) >= 2 },
  ] },
  { id: 'shoes', icon: '👟', name: 'Schuhe', groups: [
    { t: 'items', slot: 'shoes', label: 'Schuhe' },
    { t: 'color', key: 'shoesC', label: 'Farbe', colors: W3_CLOTH },
    { t: 'color', key: 'shoesC2', label: 'Akzentfarbe', colors: W3_TRIM, when: (d) => w3ColorsOf('a3', 'shoes', d) >= 2 },
  ] },
  { id: 'head', icon: '🧢', name: 'Hüte & Brillen', groups: [
    { t: 'items', slot: 'hat', label: 'Kopfbedeckung' },
    { t: 'color', key: 'hatC', label: 'Farbe', colors: W3_CLOTH, when: (d) => w3ColorsOf('a3', 'hat', d) >= 1 },
    { t: 'color', key: 'hatC2', label: 'Akzentfarbe', colors: W3_TRIM, when: (d) => w3ColorsOf('a3', 'hat', d) >= 2 },
    { t: 'items', slot: 'glasses', label: 'Brille' },
    { t: 'color', key: 'glassesC', label: 'Farbe der Brille', colors: [0x1f2430, 0x7c4a26, 0xe2483d, 0x2453d6, 0x8b5cf6, 0xec4899, 0xf5c518, 0x14a39a], when: (d) => w3ColorsOf('a3', 'glasses', d) >= 1 },
  ] },
  { id: 'acc', icon: '💍', name: 'Accessoires', groups: [
    { t: 'items', slot: 'neck', label: 'Um den Hals' },
    { t: 'color', key: 'neckC', label: 'Farbe', colors: W3_CLOTH, when: (d) => w3ColorsOf('a3', 'neck', d) >= 1 },
    { t: 'color', key: 'neckC2', label: 'Akzentfarbe', colors: W3_TRIM, when: (d) => w3ColorsOf('a3', 'neck', d) >= 2 },
    { t: 'items', slot: 'wrist', label: 'Am Handgelenk' },
    { t: 'color', key: 'wristC', label: 'Farbe', colors: W3_CLOTH, when: (d) => w3ColorsOf('a3', 'wrist', d) >= 1 },
    { t: 'items', slot: 'bag', label: 'Tasche' },
    { t: 'color', key: 'bagC', label: 'Farbe', colors: W3_CLOTH, when: (d) => w3ColorsOf('a3', 'bag', d) >= 1 },
    { t: 'color', key: 'bagC2', label: 'Akzentfarbe', colors: W3_TRIM, when: (d) => w3ColorsOf('a3', 'bag', d) >= 2 },
  ] },
  { id: 'hand', icon: '🎈', name: 'In der Hand', groups: [
    { t: 'items', slot: 'hand', label: 'Gadgets und Dinge zum Halten' },
    { t: 'color', key: 'handC', label: 'Farbe', colors: W3_CLOTH, when: (d) => w3ColorsOf('a3', 'hand', d) >= 1 },
  ] },
  { id: 'back', icon: '🎒', name: 'Rücken', groups: [
    { t: 'items', slot: 'back', label: 'Auf dem Rücken' },
    { t: 'color', key: 'backC', label: 'Farbe', colors: W3_CLOTH, when: (d) => w3ColorsOf('a3', 'back', d) >= 1 },
    { t: 'color', key: 'backC2', label: 'Akzentfarbe', colors: W3_TRIM, when: (d) => w3ColorsOf('a3', 'back', d) >= 2 },
  ] },
  { id: 'fun', icon: '🐾', name: 'Tiere & Effekte', groups: [
    { t: 'items', slot: 'pet', label: 'Haustier' },
    { t: 'color', key: 'petC', label: 'Farbe des Tiers', colors: [0xf59e0b, 0x7c4a26, 0x26222e, 0xf8f4f6, 0x9ca3af, 0xf9a8d4, 0x22c55e, 0x3b82f6], when: (d) => w3ColorsOf('a3', 'pet', d) >= 1 },
    { t: 'items', slot: 'effect', label: 'Effekt' },
    { t: 'color', key: 'effectC', label: 'Farbe', colors: [0xa78bfa, 0x22d3ee, 0xf472b6, 0xfacc15, 0x4ade80], when: (d) => w3ColorsOf('a3', 'effect', d) >= 1 },
  ] },
  { id: 'emote', icon: '💃', name: 'Animationen', groups: [
    { t: 'info', html: 'Tippe eine Animation an, um sie anzuschauen. Gekaufte Animationen findest du unter der Bühne.' },
    { t: 'items', slot: 'emote', label: 'Bewegungen und Mimik' },
  ] },
];
const CAR_CATS = [
  { id: 'body', icon: '🚗', name: 'Form', groups: [
    { t: 'info', html: 'Deine Figur fährt selbst! Die Grundformen sind gratis, die besonderen kosten Münzen. Alle fahren gleich schnell.' },
    { t: 'items', slot: 'body', label: 'Karosserie' },
    { t: 'info', html: 'Der Hotdog hat feste Farben – Lack und Muster gelten hier nicht.', when: (d) => d.body === 'hotdog' },
    { t: 'info', html: 'Bananen-Kart und Biene haben feste Farben – Lack und Muster gelten hier nicht.', when: (d) => d.body === 'banana' || d.body === 'bee' },
  ] },
  { id: 'paint', icon: '🎨', name: 'Lack', groups: [
    { t: 'color', key: 'paint', label: 'Farbe', colors: W3_PAINT },
    { t: 'items', slot: 'finish', label: 'Lackart' },
  ] },
  { id: 'pattern', icon: '🏁', name: 'Muster', groups: [
    { t: 'items', slot: 'pattern', label: 'Muster' },
    { t: 'color', key: 'paint2', label: 'Zweite Farbe (Muster und Spoiler)', colors: W3_PAINT },
  ] },
  { id: 'rims', icon: '🛞', name: 'Felgen', groups: [{ t: 'items', slot: 'rims', label: 'Felgen' }] },
  { id: 'wing', icon: '🪽', name: 'Spoiler', groups: [{ t: 'items', slot: 'wing', label: 'Heckflügel' }, { t: 'items', slot: 'exhaust', label: 'Auspuff' }] },
  { id: 'turbo', icon: '🔥', name: 'Turbo & Licht', groups: [{ t: 'items', slot: 'flames', label: 'Turbo-Flammen' }, { t: 'items', slot: 'glow', label: 'Unterboden-Licht' }] },
  { id: 'topper', icon: '🚩', name: 'Dach', groups: [{ t: 'items', slot: 'topper', label: 'Hinten oben auf dem Kart' }] },
  { id: 'num', icon: '🔢', name: 'Nummer', groups: [{ t: 'num', key: 'num', label: 'Startnummer' }] },
];
const W3_ANIM_NAMES = { idle: 'Stehen', wave: '👋 Winken', cheer: '🙌 Jubeln' };

/* ---------------- Seite ---------------- */
function renderWorld3D(page = 'avatar') {
  const v = document.getElementById('view');
  if (!v) return;
  stopWorld3D(true);
  if (w3Mode() === 'kid' && !AV.state) {   // zuerst Münzen und gekaufte Teile holen
    v.innerHTML = '<section class="w3-page"><div class="w3-stage"><div class="w3-loading"><span class="spinner"></span><span>Deine 3D-Welt wird geladen …</span></div></div></section>';
    avatarLoad(true).then(() => { if (ui.view === (page === 'garage' ? 'garage' : 'avatar')) { if (AV.state) renderWorld3D(page); else v.innerHTML = '<section class="w3-page"><p class="banner bad">Dein Avatar konnte nicht geladen werden. Bist du online?</p></section>'; } });
    return;
  }
  W3V.page = page;
  const pre = W3_PRE[page];
  W3V.saved.a3 = w3Saved('a3'); W3V.saved.car = w3Saved('car');
  const fresh = !!W3V.saved.a3.fresh; delete W3V.saved.a3.fresh;
  W3V.draft.a3 = w3Clone(W3V.saved.a3); W3V.draft.car = w3Clone(W3V.saved.car);
  W3V.tryEmote = null; W3V.status = fresh && w3Mode() === 'kid' && page === 'avatar' ? 'fresh' : '';
  const car = page === 'garage';
  v.innerHTML = `<section class="w3-page w3-${page}">
    <header class="w3-head">
      <div class="w3-title"><p class="eyebrow">${car ? 'Turbo-Garage' : 'Meine 3D-Welt'}</p><h1>${car ? 'Mein Kart' : 'Mein Avatar'}</h1></div>
      ${w3Garage() ? `<nav class="w3-switch" aria-label="Bereich wählen">
        <button data-action="w3-page" data-page="avatar" class="${car ? '' : 'on'}" aria-pressed="${!car}">🧍 Avatar</button>
        <button data-action="w3-page" data-page="garage" class="${car ? 'on' : ''}" aria-pressed="${car}">🏎️ Garage</button>
      </nav>` : ''}
      <div class="w3-wallet-slot" id="w3-wallet">${w3WalletHTML()}</div>
    </header>
    <div class="w3-main">
      <section class="w3-stage" id="w3-stage" aria-label="${car ? 'Dein Kart in 3D' : 'Dein Avatar in 3D'}">
        <div class="w3-status" id="w3-status" aria-live="polite"></div>
        <div class="w3-try" id="w3-try" hidden></div>
        <div class="w3-bar" id="w3-bar"></div>
        <p class="w3-hint">Drehen: ziehen · Zoomen: Mausrad oder zwei Finger</p>
        <div class="w3-loading" id="w3-loading"><span class="spinner"></span><span>Die 3D-Welt wird geladen …</span></div>
      </section>
      <section class="w3-panel">
        ${car ? '<div class="w3-fair"><b>Alle Karts fahren gleich schnell.</b> <span>Tempo, Kurven und Turbo sind für alle gleich – hier geht es nur ums Aussehen.</span></div>' : ''}
        <nav class="w3-tabs" id="w3-tabs" role="tablist" aria-label="Kategorien"></nav>
        <div class="w3-opts" id="w3-opts"></div>
        <div class="w3-actions">
          <button class="btn ghost" data-action="w3-random" title="Zufälliger Look aus deinen Teilen">🎲 Zufall</button>
          <button class="btn ghost" data-action="w3-revert" id="w3-revert" title="Zurück zum gespeicherten Look">↩︎ Zurück</button>
          ${car ? `<button class="btn primary" data-action="w3-race" title="Zum Turbo-Rennen">🏁 Rennen</button>` : w3Garage() ? `<button class="btn primary" data-action="w3-page" data-page="garage">🏎️ Garage</button>` : '<button class="btn primary" data-action="home">✓ Fertig</button>'}
        </div>
      </section>
    </div>
  </section>`;
  w3Panel(); w3TryBanner(); w3StatusShow(); w3Bar();
  w3StageStart(page, pre);
}
function w3WalletHTML() {
  const m = w3Mode();
  if (m === 'kid') return `<button class="w3-wallet" data-action="avatar-coins" title="So verdienst du Münzen">${AV_COIN_SVG}<b class="av-coin-n">${w3Coins()}</b><span>Münzen</span></button>`;
  if (m === 'teacher') return '<span class="w3-preview-tag" title="Lehrpersonen können alles ausprobieren">👀 Vorschau: alles frei</span>';
  if (m === 'off') return '<span class="w3-preview-tag">Shop bei deiner Klasse ausgeschaltet</span>';
  return '<span class="w3-preview-tag" title="Mit dem Login-Kärtchen anmelden">👀 Vorschau – zum Einkaufen anmelden</span>';
}
const w3Cats = () => (W3V.page === 'garage' ? CAR_CATS : A3_CATS);
const w3Pre = () => W3_PRE[W3V.page];
const w3D = () => W3V.draft[w3Pre()];

function w3Panel() {
  const tabs = document.getElementById('w3-tabs'), opts = document.getElementById('w3-opts');
  if (!tabs || !opts) return;
  const cats = w3Cats(), cur = W3V.cat[W3V.page];
  tabs.innerHTML = cats.map((c) => `<button role="tab" class="${c.id === cur ? 'on' : ''}" aria-selected="${c.id === cur}" data-action="w3-cat" data-cat="${c.id}"><span aria-hidden="true">${c.icon}</span><small>${c.name}</small></button>`).join('');
  const C = cats.find((c) => c.id === cur) || cats[0];
  const d = w3D(), pre = w3Pre(), shop = w3ShopOpen();
  opts.innerHTML = (shop ? '' : '<p class="w3-note">🔒 Der Shop ist gerade geschlossen – du kannst mit deinen Teilen gestalten.</p>')
    + C.groups.filter((g) => !g.when || g.when(d)).map((g) => {
      if (g.t === 'info') return `<p class="w3-note">${g.html}</p>`;
      let body = '';
      if (g.t === 'items') {
        const list = w3Slot(pre, g.slot).filter((it) => (!g.cat || it.cat === g.cat) && (shop || w3Owns(it) || it.v === d[g.slot]));
        body = `<div class="w3-items">${list.map((it) => w3ItemHTML(it, g.slot === 'emote' ? it.v === W3V.tryEmote?.v || (d.emote === it.v && !W3V.tryEmote) : d[g.slot] === it.v)).join('')}</div>`;
      }
      if (g.t === 'color') {
        const ex = g.extra ? W3_ITEM[g.extra] : null;
        body = `<div class="w3-swatches">${g.colors.map((c) => `<button class="w3-sw ${d[g.key] === c ? 'on' : ''}" style="--c:${w3Hex(c)}" data-action="w3-color" data-k="${g.key}" data-c="${c}" aria-label="Farbe ${w3Hex(c)}" aria-pressed="${d[g.key] === c}"></button>`).join('')}
          ${ex && (shop || w3Owns(ex)) ? `<button class="w3-sw rainbow ${d[ex.slot] === ex.v ? 'on' : ''} ${w3Owns(ex) ? '' : 'locked'}" data-action="w3-pick" data-id="${ex.id}" aria-label="${esc(ex.name)}${w3Owns(ex) ? '' : `, ${ex.price} Münzen`}" title="${esc(ex.name)}">${w3Owns(ex) ? '' : `<i class="w3-sw-price">${ex.price}</i>`}</button>` : ''}</div>`;
      }
      if (g.t === 'toggles') body = `<div class="w3-chips">${g.opts.map(([k, n]) => `<button class="w3-chip ${d[k] ? 'on' : ''}" data-action="w3-toggle" data-k="${k}" aria-pressed="${!!d[k]}">${n}</button>`).join('')}</div>`;
      if (g.t === 'num') body = `<div class="w3-num"><button class="w3-chip" data-action="w3-num" data-d="-1" aria-label="Kleinere Nummer">−</button><b>${d.num}</b><button class="w3-chip" data-action="w3-num" data-d="1" aria-label="Grössere Nummer">+</button>
          <span class="w3-num-quick">${[1, 7, 10, 23, 42, 77, 99].map((n) => `<button class="w3-chip ${d.num === n ? 'on' : ''}" data-action="w3-num" data-n="${n}">${n}</button>`).join('')}</span></div>`;
      return `<div class="w3-group"><h3>${g.label}</h3>${body}</div>`;
    }).join('');
  w3QueueThumbs();
  const rv = document.getElementById('w3-revert');
  if (rv) rv.disabled = w3Same(W3V.draft[pre], W3V.saved[pre]);
}
function w3ItemHTML(it, on) {
  const own = w3Owns(it), locked = w3Locked(it);
  const thumb = W3V.thumbs.get(w3ThumbKey(it));
  const badge = !it.price ? '' : own ? '<i class="w3-own" title="Gehört dir">✓</i>'
    : locked ? `<i class="w3-lock" title="Ab ${it.unlock.earned} gesammelten Münzen">🔒 ${it.unlock.earned}</i>` : `<i class="w3-price">${AV_COIN_SVG}${it.price}</i>`;
  const rar = it.rarity !== 'basic' && it.rarity !== 'common' ? `<i class="w3-rar">${W3_RARITY[it.rarity]}</i>` : '';
  return `<button class="w3-item r-${it.rarity} ${on ? 'on' : ''} ${own ? '' : 'buy'} ${locked ? 'locked' : ''}" data-action="w3-pick" data-id="${it.id}" aria-pressed="${on}"
    title="${esc(it.name)}${own || !it.price ? '' : locked ? ` – ab ${it.unlock.earned} gesammelten Münzen` : ` – ${it.price} Münzen`}">
    <span class="w3-thumb" data-thumb="${it.id}">${thumb ? `<img src="${thumb}" alt="">` : `<span class="w3-emo" aria-hidden="true">${it.icon}</span>`}</span>
    <small>${esc(it.name)}</small>${badge}${rar}</button>`;
}
/** Teile, die gerade angezogen, aber noch nicht gekauft sind */
function w3Unowned(pre = w3Pre()) {
  const list = w3PaidIn(pre, W3V.draft[pre]).filter((it) => !w3Owns(it));
  if (pre === 'a3' && W3V.tryEmote && !w3Owns(W3V.tryEmote)) list.push(W3V.tryEmote);
  return list;
}
function w3TryBanner() {
  const el = document.getElementById('w3-try');
  if (!el) return;
  const list = w3Unowned();
  el.hidden = !list.length;
  if (!list.length) { el.innerHTML = ''; return; }
  const m = w3Mode(), coins = w3Coins();
  const total = list.reduce((a, it) => a + it.price, 0);
  el.innerHTML = `<p><b>${list.length === 1 ? 'Du probierst an:' : `Du probierst ${list.length} Teile an:`}</b></p>
    <ul>${list.map((it) => {
      let btn;
      if (m === 'off') btn = '<span class="w3-try-why">Shop ausgeschaltet</span>';
      else if (m !== 'kid') btn = '<span class="w3-try-why">Zum Kaufen anmelden</span>';
      else if (w3Locked(it)) btn = `<span class="w3-try-why">🔒 ab ${it.unlock.earned} gesammelten Münzen (du: ${w3Earned()})</span>`;
      else if (!w3ShopOpen()) btn = '<span class="w3-try-why">Shop geschlossen</span>';
      else if (coins < it.price) btn = `<button class="btn small" disabled>${AV_COIN_SVG} ${it.price} – noch ${it.price - coins} fehlen</button>`;
      else btn = `<button class="btn small primary" data-action="w3-buy" data-id="${it.id}">${AV_COIN_SVG} Für ${it.price} kaufen</button>`;
      return `<li><span class="w3-try-name">${it.icon} ${esc(it.name)} <i class="w3-rar-dot r-${it.rarity}">${W3_RARITY[it.rarity]}</i></span>${btn}</li>`;
    }).join('')}</ul>
    ${list.length > 1 && m === 'kid' ? `<p class="small muted">Zusammen ${total} Münzen.</p>` : ''}
    <button class="btn small ghost" data-action="w3-untry">↩︎ ${list.length === 1 ? 'Wieder ausziehen' : 'Alles wieder ausziehen'}</button>`;
}
function w3StatusShow() {
  const el = document.getElementById('w3-status');
  if (!el) return;
  const s = W3V.status;
  const txt = { saving: '💾 Wird gespeichert …', ok: '✓ Gespeichert', local: '✓ Auf diesem Gerät gespeichert', err: '⚠️ Nicht gespeichert – bist du online?', fresh: '👋 Gestalte deine Figur – alles wird automatisch gespeichert.' }[s] || '';
  el.textContent = txt;
  el.className = `w3-status ${s}`;
  if (s === 'ok' || s === 'local') { clearTimeout(W3V.statusT); W3V.statusT = setTimeout(() => { if (W3V.status === s) { W3V.status = ''; w3StatusShow(); } }, 2200); }
}
/** Leiste unter der Bühne: eigene Animationen (Avatar) bzw. Turbo (Garage) */
function w3Bar() {
  const el = document.getElementById('w3-bar');
  if (!el) return;
  if (W3V.page === 'garage') {
    el.innerHTML = `<button data-action="w3-turbo">🔥 Turbo zeigen</button><button data-action="w3-honk">📣 Hupen</button>`;
    return;
  }
  const own = ['idle', ...w3Slot('a3', 'emote').filter((it) => w3Owns(it)).map((it) => it.v)];
  const cur = W3V.st?.anim || 'idle';
  el.innerHTML = own.map((a) => { const it = w3Item('a3', 'emote', a); return `<button class="${a === cur ? 'on' : ''}" data-action="w3-anim" data-a="${a}">${it ? `${it.icon} ${esc(it.name)}` : W3_ANIM_NAMES[a]}</button>`; }).join('');
}
function w3Refresh() { w3Panel(); w3TryBanner(); w3Bar(); const w = document.getElementById('w3-wallet'); if (w) w.innerHTML = w3WalletHTML(); }

/* ---------------- Ändern, Anprobieren, Speichern ---------------- */
function w3Change(fn, { anim = null } = {}) {
  const pre = w3Pre();
  fn(W3V.draft[pre]);
  if (W3V.status === 'fresh') { W3V.status = ''; w3StatusShow(); }
  w3Refresh();
  w3Rebuild();
  if (anim) w3PlayAnim(anim, 2600);
  w3ScheduleSave(pre);
}
function w3ScheduleSave(pre) {
  clearTimeout(W3V.saveT);
  const d = W3V.draft[pre];
  if (w3PaidIn(pre, d).some((it) => !w3Owns(it)) || w3Same(d, W3V.saved[pre])) {
    if (W3V.status === 'saving') { W3V.status = ''; w3StatusShow(); }
    return;
  }
  W3V.status = 'saving'; w3StatusShow();
  W3V.saveT = setTimeout(() => w3SaveNow(pre), 900);
}
async function w3SaveNow(pre) {
  clearTimeout(W3V.saveT);
  const d = w3Clone(W3V.draft[pre]);
  if (w3PaidIn(pre, d).some((it) => !w3Owns(it)) || w3Same(d, W3V.saved[pre])) return;
  try {
    const r = await w3Save(pre, d);
    W3V.saved[pre] = d;
    W3V.status = r.local ? 'local' : 'ok';
    w3SnapSoon(pre);
  } catch (e) {
    console.warn('3D-Welt speichern', e);
    W3V.status = 'err';
  }
  if (W3V.st) { w3StatusShow(); const rv = document.getElementById('w3-revert'); if (rv) rv.disabled = w3Same(W3V.draft[pre], W3V.saved[pre]); }
}
async function w3BuyId(id) {
  const it = W3_ITEM[id];
  if (!it) return;
  const ok = await w3Buy(it);
  if (!ok) { w3Refresh(); return; }
  if (it.slot === 'emote') { W3V.tryEmote = null; W3V.draft.a3.emote = it.v; w3PlayAnim(it.v, 4000); }
  else if (W3V.page === 'avatar') w3PlayAnim('cheer', 2200);
  else { w3Turbo(2200); W3V.st?.kart?.setMood('win'); setTimeout(() => W3V.st?.kart?.setMood(''), 2200); }
  if (typeof confetti === 'function') confetti();
  W3V.thumbs.forEach((_, k) => { if (k.startsWith(`${id}|`)) W3V.thumbs.delete(k); });
  w3Refresh();
  w3ScheduleSave(w3Pre());
}
function w3Random() {
  const pre = w3Pre(), d = W3V.draft[pre];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const ownList = (slot, filter = () => true) => w3Slot(pre, slot).filter((it) => w3Owns(it) && filter(it)).map((it) => it.v);
  if (pre === 'a3') {
    for (const slot of ['hair', 'top', 'bottom', 'shoes']) d[slot] = pick(ownList(slot, (it) => slot !== 'top' || it.cat === 'top' || Math.random() < 0.3));
    for (const slot of ['hat', 'glasses', 'neck', 'wrist', 'bag', 'hand', 'back', 'pet', 'effect']) d[slot] = Math.random() < 0.55 ? 'none' : pick(ownList(slot));
    Object.assign(d, { topC: pick(W3_CLOTH), topT: pick(W3_TRIM), bottomC: pick(W3_PANTS), shoesC: pick(W3_CLOTH), shoesC2: pick(W3_TRIM), hatC: pick(W3_CLOTH), backC: pick(W3_CLOTH), neckC: pick(W3_CLOTH), bagC: pick(W3_CLOTH) });
    w3PlayAnim('cheer', 1800);
  } else {
    for (const slot of ['body', 'finish', 'pattern', 'rims', 'wing', 'exhaust', 'flames', 'glow', 'topper']) d[slot] = pick(ownList(slot));
    Object.assign(d, { paint: pick(W3_PAINT), paint2: pick(W3_PAINT) });
    w3Turbo(1500);
  }
  w3Refresh(); w3Rebuild(); w3ScheduleSave(pre);
}

const world3dActions = {
  'garage-open': () => go('garage'),
  'world-open': () => go('avatar'),
  'w3-page': (el) => { if (W3V.page !== el.dataset.page) go(el.dataset.page === 'garage' ? 'garage' : 'avatar'); },
  'w3-cat': (el) => { W3V.cat[W3V.page] = el.dataset.cat; w3Panel(); document.getElementById('w3-opts')?.scrollTo({ top: 0 }); },
  'w3-pick': (el) => {
    const it = W3_ITEM[el.dataset.id];
    if (!it) return;
    if (it.slot === 'emote') {
      W3V.tryEmote = w3Owns(it) ? null : it;
      if (w3Owns(it)) w3Change((d) => { d.emote = it.v; }); else w3Refresh();
      w3PlayAnim(it.v, 4200);
      return;
    }
    const anim = it.slot === 'hand' && it.v !== 'none' ? 'present' : !w3Owns(it) && W3V.page === 'avatar' ? 'wave' : null;
    w3Change((d) => { d[it.slot] = it.v; }, { anim });
    if (W3V.page === 'garage' && (it.slot === 'flames' || it.slot === 'glow')) w3Turbo(2000);
  },
  'w3-color': (el) => w3Change((d) => { d[el.dataset.k] = +el.dataset.c; }),
  'w3-toggle': (el) => w3Change((d) => { d[el.dataset.k] = !d[el.dataset.k]; }),
  'w3-num': (el) => w3Change((d) => { d.num = el.dataset.n ? +el.dataset.n : ((d.num - 1 + +el.dataset.d + 99) % 99) + 1; }),
  'w3-buy': (el) => w3BuyId(el.dataset.id),
  'w3-untry': () => {
    const pre = w3Pre(), d = W3V.draft[pre];
    for (const it of w3PaidIn(pre, d)) if (!w3Owns(it)) d[it.slot] = W3V.saved[pre][it.slot];
    W3V.tryEmote = null;
    w3Refresh(); w3Rebuild(); w3PlayAnim('idle');
  },
  'w3-revert': () => { const pre = w3Pre(); W3V.draft[pre] = w3Clone(W3V.saved[pre]); W3V.tryEmote = null; w3Refresh(); w3Rebuild(); },
  'w3-random': () => w3Random(),
  'w3-anim': (el) => w3PlayAnim(el.dataset.a, ['wave', 'cheer', 'jump', 'clap', 'bow', 'laugh', 'flex', 'spin'].includes(el.dataset.a) ? 4000 : 0),
  'w3-turbo': () => w3Turbo(2600),
  'w3-honk': () => { if (typeof tone === 'function') tone([392, 523], 0.16, 'square', 0.08); W3V.st && (W3V.st.bounce = 1); },
  'w3-race': () => go('game', { game: 'kart' }),
};

/* ---------------- Bühne ---------------- */
function w3PlayAnim(a, ms = 0) {
  const st = W3V.st;
  if (!st) return;
  st.anim = a; st.animUntil = ms ? performance.now() + ms : 0;
  st.fig?.setAnim(a);
  w3Bar();
}
function w3Turbo(ms) { if (W3V.st) W3V.st.turboUntil = performance.now() + ms; }

async function w3StageStart(page, pre) {
  const token = ++W3V.token;
  const host = document.getElementById('w3-stage');
  let T;
  try {
    T = await w3Three();
    await w3LoadEngine();
    if (typeof loadNumFont === 'function') await loadNumFont().catch(() => null);
  } catch (e) {
    console.warn('3D-Welt laden', e);
    if (token === W3V.token) host.querySelector('#w3-loading').innerHTML = '<span>Die 3D-Welt konnte nicht geladen werden. Bist du online?</span>';
    return;
  }
  if (token !== W3V.token || !document.body.contains(host)) return;
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch {
    host.querySelector('#w3-loading').innerHTML = '<span>Dieses Gerät kann leider keine 3D-Grafik anzeigen.</span>';
    return;
  }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = 'w3-canvas';
  host.prepend(renderer.domElement);
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(30, 1, 0.1, 80);
  w3Lights(T, scene, renderer, page === 'garage');
  const st = W3V.st = { T, renderer, scene, cam, host, page, pre, dead: false, raf: 0, last: performance.now(), t: 0, anim: 'idle', animUntil: 0, turboUntil: 0, bounce: 0,
    view: { yaw: page === 'garage' ? 0.75 : -0.35, zoom: 1, fit: 7.4, drag: null, pinch: null, pts: new Map(), autoUntil: 0 }, fig: null, kart: null, driver: null, ro: null };
  // Sockel
  const gar = page === 'garage';
  const pm = new T.MeshStandardMaterial({ color: gar ? 0x334155 : 0xf7c62a, roughness: gar ? 0.4 : 0.5, metalness: gar ? 0.3 : 0 });
  const R = gar ? 2.75 : 1.15;
  const plate = new T.Group(); scene.add(plate); st.plate = plate;
  const top = new T.Mesh(new T.CylinderGeometry(R, R + 0.05, 0.16, gar ? 48 : 8), pm); top.position.y = -0.08; top.receiveShadow = true; top.rotation.y = Math.PI / 8; plate.add(top);
  const base = new T.Mesh(new T.CylinderGeometry(R + 0.05, R + 0.17, 0.14, gar ? 48 : 8), new T.MeshStandardMaterial({ color: gar ? 0x1e293b : 0xd9a514, roughness: 0.6 })); base.position.y = -0.23; base.rotation.y = Math.PI / 8; scene.add(base);
  if (gar) {
    const ring = new T.Mesh(new T.TorusGeometry(R - 0.12, 0.035, 8, 96), new T.MeshStandardMaterial({ color: 0xffc233, emissive: 0xffa000, emissiveIntensity: 0.35 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.005; plate.add(ring);
    for (let i = 0; i < 12; i++) { const s = new T.Mesh(new T.BoxGeometry(0.34, 0.012, 0.08), new T.MeshStandardMaterial({ color: 0xffc233 })); const a = (i / 12) * Math.PI * 2; s.position.set(Math.cos(a) * (R - 0.38), 0.006, Math.sin(a) * (R - 0.38)); s.rotation.y = -a; plate.add(s); }
  }
  host.querySelector('#w3-loading')?.remove();
  w3Rebuild(true);
  w3Input(st);
  const size = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const t = Math.tan((cam.fov * Math.PI) / 360);
    st.view.fit = gar ? Math.max(1.75 / t, 2.75 / (t * cam.aspect)) : Math.max(1.85 / t, 1.55 / (t * cam.aspect));
  };
  st.ro = new ResizeObserver(size); st.ro.observe(host); size();
  const loop = (now) => {
    if (st.dead) return;
    st.raf = requestAnimationFrame(loop);
    if (document.hidden) { st.last = now; return; }
    const dt = Math.max(0, Math.min(0.05, (now - st.last) / 1000)); st.last = now; st.t += dt;
    const v = st.view;
    if (st.animUntil && now > st.animUntil) w3PlayAnim('idle');
    if (gar) {
      if (!v.drag && !v.pinch && now > v.autoUntil) v.yaw += dt * 0.28;
      plate.rotation.y = v.yaw;
      const turbo = now < st.turboUntil;
      if (st.kart) {
        st.kart.tick?.(st.t, dt);
        st.kart.setSteer?.(Math.sin(st.t * 0.9) * 0.5);
        if (turbo) st.kart.setMood?.('turbo'); else if (st.kart.fig?.anim === 'drive' && !st.moodHold) st.kart.setMood?.('');
        const fs = turbo ? 0.9 + Math.random() * 0.5 : 0.01;
        st.kart.flames.forEach((f) => { const k = f.userData.k || 1; f.scale.set(fs * k, fs * k, 1); });
        for (const w of st.kart.wheels) w.spin.rotation.x += (turbo ? 14 : 0) * dt;
        st.bounce = Math.max(0, st.bounce - dt * 2.5);
        st.kart.body.position.y = (turbo ? Math.abs(Math.sin(st.t * 30)) * 0.02 : 0) + Math.sin(st.bounce * Math.PI * 3) * 0.06 * st.bounce;
      }

      const dist = v.fit * v.zoom, z = 1 - v.zoom;
      cam.position.set(0, 2.5 + z * 0.4, dist); cam.lookAt(0, 0.85 + z * 0.35, 0);
    } else {
      st.fig?.update(dt);
      if (st.fig) st.fig.root.rotation.y = v.yaw;
      const dist = v.fit * v.zoom, z = 1 - v.zoom;                // beim Zoomen zum Gesicht hin
      cam.position.set(0, 1.5 + z * 0.55, dist); cam.lookAt(0, 1.3 + z * 0.75, 0);
    }
    renderer.render(scene, cam);
  };
  st.raf = requestAnimationFrame(loop);
  if (W3V.status === 'fresh') w3PlayAnim('wave', 3000);
}
function w3Lights(T, scene, renderer, gar) {
  scene.add(new T.HemisphereLight(0xffffff, gar ? 0x334155 : 0x8a6a3a, 1.45));
  const key = new T.DirectionalLight(0xffffff, 2.4); key.position.set(-2.5, 4.5, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 0.5, far: 14 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  const fill = new T.DirectionalLight(0xfff1e0, 0.7); fill.position.set(3, 2, 2);
  const rim = new T.DirectionalLight(0xffffff, 1.3); rim.position.set(0, 3, -4);
  scene.add(key, fill, rim);
  try {     // Spiegelungen für Metallic, Chrom und Perlmutt
    const env = new T.Scene();
    env.add(new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.MeshBasicMaterial({ color: 0x8a96a8, side: T.BackSide })));
    for (const [x, y, z, c] of [[0, 8, 0, 0xffffff], [6, 3, 4, 0xfff1d0], [-6, 2, -3, 0xbfe0ff], [0, 1, 8, 0xffe9a8]]) { const m = new T.Mesh(new T.PlaneGeometry(7, 3), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); }
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.02).texture; scene.environmentIntensity = 0.8; pm.dispose();
  } catch { /* ohne Spiegelungen */ }
}
/** Figur bzw. Kart neu bauen (nach jeder Änderung, kurz verzögert) */
function w3Rebuild(now = false) {
  const st = W3V.st;
  if (!st) return;
  clearTimeout(st.rebuildT);
  if (!now) { st.rebuildT = setTimeout(() => w3Rebuild(true), 25); return; }
  const T = st.T;
  if (st.page === 'avatar') {
    if (typeof vxFigure !== 'function') return;
    let next;
    try { next = vxFigure(T, a3Look(W3V.draft.a3)); } catch (e) { console.warn('Avatar bauen', e); return; }
    if (st.fig) { st.scene.remove(st.fig.root); st.fig.dispose(); }
    st.fig = next; st.scene.add(next.root); next.setAnim(st.anim);
    next.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  } else {
    if (typeof kartVoxModel !== 'function') { w3LoadEngine().then(() => { if (W3V.st === st) w3Rebuild(true); }).catch(() => null); }
    // die eigene Figur sitzt am Steuer (einmal gebaut, bei jeder Änderung ins neue Kart gesetzt)
    if (!st.driver && typeof vxFigure === 'function') { try { st.driver = vxFigure(T, kvDriverLook(a3Look(W3V.saved.a3))); st.driver.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); } catch (e) { console.warn('Figur im Kart', e); } }
    const L = { ...W3V.draft.car }; delete L.v;
    if (st.kart) { st.plate.remove(st.kart.g); w3DisposeKart(st.kart); }
    const next = kartModel(T, L.paint, 0xffffff, L.num, L, null, { fig: st.driver });
    st.kart = next; next.g.position.set(0, 0, 0); next.g.rotation.y = 0; st.plate.add(next.g);
  }
}
function w3DisposeKart(k) {
  if (k.voxel) { k.dispose(); return; }
  const shared = new Set(Object.values(KART_SHARED));
  k.g.traverse((o) => { if (o.isMesh && o.geometry && !shared.has(o.geometry)) o.geometry.dispose(); });
  k.dispose?.();
}
function w3Input(st) {
  const el = st.renderer.domElement, v = st.view;
  el.addEventListener('pointerdown', (e) => {
    v.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture?.(e.pointerId);
    if (v.pts.size === 1) v.drag = { x: e.clientX, yaw: v.yaw };
    if (v.pts.size === 2) { const [a, b] = [...v.pts.values()]; v.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: v.zoom }; v.drag = null; }
  });
  el.addEventListener('pointermove', (e) => {
    if (!v.pts.has(e.pointerId)) return;
    v.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (v.pinch && v.pts.size === 2) { const [a, b] = [...v.pts.values()]; v.zoom = Math.min(1.4, Math.max(0.4, v.pinch.zoom * v.pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)))); }
    else if (v.drag) v.yaw = v.drag.yaw + (e.clientX - v.drag.x) * 0.012;
  });
  const up = (e) => { v.pts.delete(e.pointerId); if (v.pts.size < 2) v.pinch = null; if (!v.pts.size) { v.drag = null; v.autoUntil = performance.now() + 4000; } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { e.preventDefault(); v.zoom = Math.min(1.4, Math.max(0.4, v.zoom * (1 + e.deltaY * 0.0012))); }, { passive: false });
  el.addEventListener('dblclick', () => (st.page === 'garage' ? w3Turbo(2000) : w3PlayAnim('cheer', 1600)));
}
/** Seite verlassen: offene Änderungen sofort speichern, 3D aufräumen */
function stopWorld3D(keepThumbs = false) {
  W3V.token++;
  const st = W3V.st;
  if (st) {
    st.dead = true; cancelAnimationFrame(st.raf); st.ro?.disconnect(); clearTimeout(st.rebuildT);
    st.fig?.dispose(); if (st.kart) w3DisposeKart(st.kart); st.driver?.dispose();
    st.scene.environment?.dispose?.();
    st.renderer.dispose(); st.renderer.forceContextLoss?.(); st.renderer.domElement.remove();
    W3V.st = null;
    if (W3V.saveT) { for (const pre of ['a3', 'car']) if (W3V.draft[pre] && !w3Same(W3V.draft[pre], W3V.saved[pre])) w3SaveNow(pre); }
  }
  W3V.thumbQ = [];
  if (!keepThumbs && W3V.tr) { W3V.tr.renderer.dispose(); W3V.tr.renderer.forceContextLoss?.(); W3V.tr = null; }
}

/* ---------------- Vorschaubilder der Teile ----------------
   Werden nach und nach im Hintergrund gezeichnet (eins pro Bild), zuerst steht das Symbol da. */
const W3_FRAME = {
  head: [[0, 1.98, 3.3], [0, 1.9, 0]], face: [[0, 1.92, 2.5], [0, 1.88, 0]], upper: [[0, 1.6, 4.4], [0, 1.4, 0]], legs: [[0, 0.62, 3.6], [0, 0.48, 0]],
  full: [[0, 1.5, 6.6], [0, 1.2, 0]], pet: [[1.2, 1.2, 6.4], [0.9, 0.95, 0]], back: [[0, 1.6, 4.6], [0, 1.4, 0]], hand: [[0.4, 1.4, 4.4], [0.3, 1.25, 0]],
};
const W3_FOCUS = { eyes: 'face', brows: 'face', mouth: 'face', deco: 'face', hair: 'head', hairC: 'head', hat: 'head', glasses: 'face', top: 'upper', neck: 'upper', wrist: 'upper', bag: 'upper', hand: 'hand', back: 'back', bottom: 'legs', shoes: 'legs', pet: 'pet', effect: 'full' };
function w3ThumbBase() {
  const s = W3V.saved.a3 || A3_DEFAULT;
  return { ...A3_DEFAULT, skin: s.skin, eyeC: s.eyeC, hair: s.hair, hairC: s.hairC, top: s.top, topC: s.topC, topT: s.topT, bottom: s.bottom, bottomC: s.bottomC, shoes: s.shoes, shoesC: s.shoesC, shoesC2: s.shoesC2 };
}
function w3ThumbKey(it) {
  if (it.pre === 'a3') { const b = w3ThumbBase(); return `${it.id}|${b.skin}|${b.hair}|${b.hairC}|${b.top}|${b.topC}|${b.bottom}`; }
  const d = W3V.draft.car || CAR_DEFAULT;
  return `${it.id}|${d.body}|${d.paint}|${d.paint2}|${d.finish}|${d.pattern}`;
}
function w3QueueThumbs() {
  const q = [];
  document.querySelectorAll('#w3-opts [data-thumb]').forEach((el) => {
    const it = W3_ITEM[el.dataset.thumb];
    if (!it || it.v === 'none' || it.slot === 'emote' || W3V.thumbs.has(w3ThumbKey(it))) return;
    q.push(it);
  });
  W3V.thumbQ = q;
  if (!W3V.thumbBusy) setTimeout(w3PumpThumbs, 120);
}
async function w3PumpThumbs() {
  const it = W3V.thumbQ.shift();
  if (!it || !W3V.st) { W3V.thumbBusy = false; return; }
  W3V.thumbBusy = true;
  const key = w3ThumbKey(it);
  try {
    if (!W3V.thumbs.has(key)) {
      const url = w3RenderThumb(it);
      if (url) {
        W3V.thumbs.set(key, url);
        document.querySelectorAll(`#w3-opts [data-thumb="${it.id}"]`).forEach((el) => { el.innerHTML = `<img src="${url}" alt="">`; });
      }
    }
  } catch (e) { console.warn('Vorschaubild', it.id, e); }
  setTimeout(w3PumpThumbs, 16);
}
function w3ThumbStage() {
  if (W3V.tr) return W3V.tr;
  const T = w3T();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(176, 176, false);
  renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene();
  w3Lights(T, scene, renderer, false);
  const floor = new T.Mesh(new T.CircleGeometry(3.2, 40), new T.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01;
  const cam = new T.PerspectiveCamera(30, 1, 0.1, 60);
  W3V.tr = { renderer, scene, cam, floor };
  return W3V.tr;
}
function w3RenderThumb(it) {
  const { renderer, scene, cam, floor } = w3ThumbStage();
  const T = w3T();
  if (it.pre === 'a3') {
    if (typeof vxFigure !== 'function') return null;
    const c = { ...w3ThumbBase(), [it.slot]: it.v };
    if (it.slot === 'top' && W3V.saved.a3) { c.topC = W3V.saved.a3.topC; c.topT = W3V.saved.a3.topT; }
    const fig = vxFigure(T, a3Look(c));
    const f = W3_FOCUS[it.slot] || 'full';
    fig.root.rotation.y = f === 'back' ? 2.7 : f === 'face' || f === 'legs' ? -0.15 : -0.4;
    fig.update(0.016);
    scene.add(fig.root);
    const [p, l] = W3_FRAME[(it.slot === 'top' && it.cat === 'outfit') ? 'full' : f];
    cam.position.set(...p); cam.lookAt(...l);
    if (it.slot === 'effect') fig.update(1.2);
    renderer.render(scene, cam);
    scene.remove(fig.root); fig.dispose();
  } else {
    if (typeof kartVoxModel !== 'function') return null;
    const L = { ...W3V.draft.car, [it.slot]: it.v }; delete L.v;
    const k = kartModel(T, L.paint, 0xffffff, L.num, L, null);
    k.tick(1.3);
    const turbo = it.slot === 'flames';
    k.flames.forEach((s) => s.scale.set(turbo ? 1.3 : 0.01, turbo ? 1.3 : 0.01, 1));
    scene.add(k.g); scene.add(floor);
    const view = {
      rims: [[3.4, 0.75, 2.4], [0.9, 0.42, 1.0]], wing: [[3.2, 2.6, -4.2], [0, 0.95, -0.8]], exhaust: [[2.2, 1.6, -4.2], [0, 0.8, -1.2]], flames: [[1.8, 1.7, -5.2], [0, 0.85, -1.6]],
      visor: [[0.9, 1.75, 1.6], [0, 1.45, -0.18]], glow: [[3.6, 3.4, 3.6], [0, 0.3, 0]],
    }[it.slot] || [[3.9, 2.6, 3.9], [0, 0.55, 0]];
    cam.position.set(...view[0]); cam.lookAt(...view[1]);
    renderer.render(scene, cam);
    scene.remove(k.g); scene.remove(floor); w3DisposeKart(k);
  }
  return renderer.domElement.toDataURL('image/png');
}

/* ---------------- Bilder für die Startseite ---------------- */
const W3_SNAP = (pre) => `teilmal.w3.snap.${pre}.${typeof kid === 'object' && kid.username ? kid.username : 'gast'}`;
const w3Hash = (o) => { let h = 0; for (const ch of JSON.stringify(o)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0; return String(h); };
function w3SnapGet(pre) { try { return JSON.parse(localStorage.getItem(W3_SNAP(pre))); } catch { return null; } }
function w3SnapSoon(pre) { clearTimeout(W3V.snapT); W3V.snapT = setTimeout(() => w3MakeSnap(pre).catch(() => null), 600); }
async function w3MakeSnap(pre) {
  const cfg = w3Saved(pre); delete cfg.fresh;
  const h = w3Hash(cfg);
  if (w3SnapGet(pre)?.h === h) return w3SnapGet(pre);
  const T = await w3Three();
  await w3LoadEngine();
  const { renderer, scene, cam, floor } = w3ThumbStage();
  renderer.setSize(220, 260, false); cam.aspect = 220 / 260; cam.updateProjectionMatrix();
  try {
    if (pre === 'a3') {
      const fig = vxFigure(T, a3Look(cfg));
      fig.root.rotation.y = -0.3; fig.update(0.016); scene.add(fig.root);
      cam.position.set(0, 1.45, 6.2); cam.lookAt(0, 1.18, 0);
      renderer.render(scene, cam);
      var url = renderer.domElement.toDataURL('image/png');
      renderer.setSize(96, 96, false); cam.aspect = 1; cam.updateProjectionMatrix();
      fig.root.rotation.y = -0.15; cam.position.set(0, 1.98, 2.7); cam.lookAt(0, 1.9, 0);
      renderer.render(scene, cam);
      var head = renderer.domElement.toDataURL('image/png');
      scene.remove(fig.root); fig.dispose();
    } else {
      const L = { ...cfg }; delete L.v;
      const k = kartModel(T, L.paint, 0xffffff, L.num, L, typeof vxFigure === 'function' ? a3Look(w3Saved('a3')) : null); k.tick(1);
      k.g.rotation.y = 0.75; scene.add(k.g); scene.add(floor);
      cam.position.set(0, 3.1, 7.2); cam.lookAt(0, 0.6, 0);
      renderer.render(scene, cam);
      scene.remove(k.g); scene.remove(floor); w3DisposeKart(k);
    }
    const snap = pre === 'a3' ? { h, url, head } : { h, url: renderer.domElement.toDataURL('image/png') };
    try { localStorage.setItem(W3_SNAP(pre), JSON.stringify(snap)); } catch { /* voll */ }
    document.querySelectorAll(`[data-w3snap="${pre}"]`).forEach((el) => { el.innerHTML = `<img src="${snap.url}" alt="">`; });
    if (pre === 'a3' && typeof avCoinUI === 'function') avCoinUI();
    return snap;
  } finally {
    renderer.setSize(176, 176, false); cam.aspect = 1; cam.updateProjectionMatrix();
    if (!W3V.st) { W3V.tr?.renderer.dispose(); W3V.tr?.renderer.forceContextLoss?.(); W3V.tr = null; }
  }
}
/** Startseite der Kinder: zwei Karten (Avatar und Garage) mit Bild; fehlt ein Bild, wird es im Hintergrund gezeichnet */
function w3HomeCardsHTML() {
  if (!w3WebGL()) return '';
  const a = w3SnapGet('a3'), c = w3SnapGet('car');
  const coins = w3Mode() === 'kid' ? `${AV_COIN_SVG} <b class="av-coin-n">${w3Coins()}</b> Münzen` : '';
  return `<div class="w3-home">
    <button class="w3-home-card" data-action="world-open"><span class="w3-home-pic" data-w3snap="a3">${a ? `<img src="${a.url}" alt="">` : '<span class="w3-emo">🧍</span>'}</span>
      <span><strong>Mein Avatar</strong><span class="muted">Frisuren, Outfits, Gadgets, Tiere …</span><span class="w3-home-coins">${coins}</span></span></button>
    ${w3Garage() ? `<button class="w3-home-card car" data-action="garage-open"><span class="w3-home-pic" data-w3snap="car">${c ? `<img src="${c.url}" alt="">` : '<span class="w3-emo">🏎️</span>'}</span>
      <span><strong>Meine Garage</strong><span class="muted">Lack, Felgen, Spoiler, Turbo-Flammen …</span></span></button>` : ''}
  </div>`;
}
function w3HomeSnaps() {
  if (!w3WebGL()) return;
  clearTimeout(W3V.homeT);
  W3V.homeT = setTimeout(async () => {
    if (W3V.st || !document.querySelector('[data-w3snap]') || (w3Mode() === 'kid' && !AV.state)) return;
    for (const pre of w3Garage() ? ['a3', 'car'] : ['a3']) {
      const cfg = w3Saved(pre); delete cfg.fresh;
      if (w3SnapGet(pre)?.h !== w3Hash(cfg)) { try { await w3MakeSnap(pre); } catch (e) { console.warn('Bild für die Startseite', e); } }
    }
  }, 1500);
}

/** Kopf in der Münz-Anzeige oben (js/avatar.js fragt hier nach): der 3D-Kopf, sobald es ein Bild davon gibt */
function avPillFace() {
  if (!w3WebGL()) return '';
  const s = w3SnapGet('a3');
  return s?.head ? `<img src="${s.head}" alt="">` : '';
}

/* ---------------- Köpfe aus einem 3D-Look (z. B. für Live-Spiele) ----------------
   w3HeadHTML(look) liefert sofort ein <img>; das Bild wird im Hintergrund gezeichnet und dann eingesetzt. */
const W3_HEADS = new Map();
const W3_HEADQ = [];
let w3HeadBusy = false;
function w3HeadHTML(look, fallback = '') {
  if (!look || typeof look !== 'object' || !w3WebGL()) return fallback;
  const cfg = w3Clean('a3', look), key = w3Hash(cfg);
  const url = W3_HEADS.get(key);
  if (url) return `<img class="w3-head" src="${url}" alt="">`;
  if (!W3_HEADQ.some((x) => x.key === key)) W3_HEADQ.push({ key, cfg });
  setTimeout(w3HeadPump, 30);
  return `<span class="w3-head-wait" data-w3head="${key}">${fallback}</span>`;
}
async function w3HeadPump() {
  if (w3HeadBusy || !W3_HEADQ.length) return;
  w3HeadBusy = true;
  try {
    const T = await w3Three();
    await w3LoadEngine();
    while (W3_HEADQ.length) {
      const { key, cfg } = W3_HEADQ.shift();
      if (W3_HEADS.has(key)) continue;
      const { renderer, scene, cam } = w3ThumbStage();
      renderer.setSize(128, 128, false); cam.aspect = 1; cam.updateProjectionMatrix();
      const fig = vxFigure(T, a3Look(cfg));
      fig.root.rotation.y = -0.15; fig.update(0.016); scene.add(fig.root);
      cam.position.set(0, 1.98, 2.9); cam.lookAt(0, 1.88, 0);
      renderer.render(scene, cam);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(fig.root); fig.dispose();
      W3_HEADS.set(key, url);
      document.querySelectorAll(`[data-w3head="${key}"]`).forEach((el) => { el.outerHTML = `<img class="w3-head" src="${url}" alt="">`; });
      await new Promise((r) => setTimeout(r, 16));
    }
  } catch (e) { console.warn('3D-Köpfe', e); } finally {
    w3HeadBusy = false;
    if (W3V.tr && !W3V.st) { W3V.tr.renderer.setSize(176, 176, false); }
  }
}
