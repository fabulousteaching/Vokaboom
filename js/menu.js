/* Vokaboom – Menü für Lehrpersonen (und alle ohne Kinder-Login)
 * Links die Bereiche, rechts die Einstellungen des gewählten Bereichs:
 * Konto · Klassen & Kärtchen · Avatar & Münzen · Stimme & Aussprache · Mikrofon · Daten & Hilfe
 */
'use strict';

const MENU = { sec: 'konto', avCfg: null, avLoading: false, bonus: { cls: '', kid: '', n: 10 } };
const MENU_SECTIONS = [
  ['konto', 'user', 'Konto'],
  ['klassen', 'users', 'Klassen & Kärtchen'],
  ['avatar', 'sparkle', 'Avatar & Münzen'],
  ['stimme', 'speaker', 'Stimme & Aussprache'],
  ['mikro', 'mic', 'Mikrofon'],
  ['daten', 'shield', 'Daten & Hilfe'],
];
const CARD_DEFAULTS = { secret: 'pics', names: 'full', qr: true, cls: true };
const cardCfg = () => {
  const c = { ...CARD_DEFAULTS, ...(db.settings.cards || {}) };
  if (!['pics', 'password', 'class'].includes(c.secret)) c.secret = 'pics'; // alte Werte („words“, „both“)
  return c;
};

/** Knopf oben rechts: ein einziger „Menü“-Knopf mit Konto-Status */
function menuButtonHTML() {
  const st = cloud.user ? (cloud.status === 'syncing' ? 'syncing' : cloud.status === 'error' ? 'error' : 'ok') : '';
  const who = cloud.user ? `<span class="menu-who" aria-hidden="true">${esc(cloud.user.charAt(0).toUpperCase())}</span>` : '';
  return `<button class="menu-btn ${cloud.user ? 'in' : ''}" data-action="menu" aria-label="Menü${cloud.user ? `, angemeldet als ${esc(cloud.user)}` : ''}" title="Menü – Konto und Einstellungen">
    ${who}${icon('sliders')}<span>Menü</span>${st ? `<i class="sync-dot ${st}" aria-hidden="true"></i>` : ''}</button>`;
}

function openMenu(sec) {
  if (isKid()) { openSettings(); return; }
  if (sec) MENU.sec = sec;
  const html = `<div class="menu">
    <nav class="menu-nav" aria-label="Bereiche">
      <p class="menu-title">Menü</p>
      ${MENU_SECTIONS.map(([id, ic, name]) => `<button type="button" class="menu-tab ${MENU.sec === id ? 'on' : ''}" data-action="menu-sec" data-sec="${id}" aria-current="${MENU.sec === id}">
        ${icon(ic)}<span>${name}</span>${id === 'konto' && cloud.user ? '<i class="menu-dot" aria-hidden="true"></i>' : ''}</button>`).join('')}
    </nav>
    <div class="menu-main">
      <header class="modal-head"><h2 id="menu-h">${esc(MENU_SECTIONS.find((x) => x[0] === MENU.sec)?.[2] || '')}</h2><span class="menu-saved" id="menu-saved" role="status" aria-live="polite"></span><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
      <div class="menu-body" id="menu-body">${menuSectionHTML(MENU.sec)}</div>
    </div>
  </div>`;
  if (ui.modal?.el?.querySelector('.menu')) {
    ui.modal.el.querySelector('.modal').innerHTML = html;
  } else {
    MENU.cardsChanged = false;
    openModal(html, { label: 'Menü', cls: 'menu-modal', onClose: () => { if (MENU.cardsChanged && ui.view === 'class') render(); } });
    menuBindOnce(ui.modal.el);
  }
  menuAfterRender();
}
function menuAfterRender() {
  if (MENU.sec === 'konto' && cloud.user) bindAccountForms();
  if (MENU.sec === 'mikro') fillMicSelect();
  if (MENU.sec === 'stimme') updatePhSettings();
  if (MENU.sec === 'avatar' && cloud.uid && !MENU.avCfg && !MENU.avLoading) menuLoadAvatarCfg();
  const sec = MENU.sec;
  if ((sec === 'avatar' || sec === 'klassen') && cloud.uid && typeof loadClasses === 'function' && !klass.loaded) loadClasses().then(() => { if (MENU.sec === sec && $('#menu-body')) $('#menu-body').innerHTML = menuSectionHTML(sec); });
}
function menuBindOnce(m) {
  const s = db.settings;
  m.addEventListener('input', (e) => {
    if (e.target.id === 'ph-min') { const v = $('#ph-min-val'); if (v) v.textContent = e.target.value; }
  });
  m.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'mic-device') s.micId = t.value;
    if (t.id === 'set-rate') s.rate = parseFloat(t.value);
    if (t.id === 'ph-min') { s.phonetic = { ...(s.phonetic || {}), passMin: parseInt(t.value, 10) || 60 }; applyTeacherPrefs(); }
    if (t.dataset.card) {
      s.cards = { ...cardCfg(), [t.dataset.card]: t.type === 'checkbox' ? t.checked : t.value }; MENU.cardsChanged = true; menuSaved();
      if (t.dataset.card === 'secret') { saveDB(); $('#menu-body').innerHTML = menuSectionHTML('klassen'); return; }
    }
    if (t.dataset.classPw) { saveClassPw(t.dataset.classPw, t.value).then((ok) => { if (ok) { MENU.cardsChanged = true; menuSaved(); } }); return; }
    if (t.dataset.av) {
      const v = t.type === 'checkbox' ? t.checked : +t.value;
      MENU.avCfg = { ...(MENU.avCfg || {}), [t.dataset.av]: v };
      menuSaveAvatarCfg();
    }
    if (t.id === 'bonus-cls') { MENU.bonus.cls = t.value; MENU.bonus.kid = ''; $('#menu-body').innerHTML = menuSectionHTML('avatar'); }
    if (t.id === 'bonus-kid') MENU.bonus.kid = t.value;
    saveDB();
  });
}

/* ---------- Inhalte der Bereiche ---------- */
function menuSectionHTML(sec) {
  const s = db.settings;
  const needLogin = (what) => `<div class="menu-empty">${icon('user')}<p>${what} gibt es mit einem Konto für Lehrpersonen.</p>
    <button type="button" class="btn primary" data-action="login-choose">Anmelden oder Konto erstellen</button></div>`;
  const seg = (action, attr, val, items) => `<div class="seg" role="group">${items.map(([v, t]) => `<button type="button" class="seg-btn" data-action="${action}" data-${attr}="${v}" aria-pressed="${String(val) === String(v)}">${t}</button>`).join('')}</div>`;
  switch (sec) {
    case 'konto':
      if (!cloud.user) {
        return `<p class="muted">Du bist nicht angemeldet. Alle Vokabeln und Ergebnisse werden nur in diesem Browser gespeichert.</p>
          <div class="menu-cards">
            <button type="button" class="menu-card" data-action="login-choose">${icon('user')}<strong>Anmelden</strong><small>Lehrperson: Portionen im Konto speichern, Klassen und Kinder-Logins, Live-Spiele mit Namen.</small></button>
            <button type="button" class="menu-card" data-action="kid-login">${icon('image')}<strong>Kinder-Login</strong><small>Mit Benutzername und Bilder-Passwort vom Kärtchen.</small></button>
          </div>`;
      }
      return accountSectionHTML();
    case 'klassen': {
      if (!cloud.user) return needLogin('Klassen, Kinder-Logins und Auswertungen');
      const c = cardCfg();
      const nList = (klass.list || []).length;
      return `<div class="menu-cards">
          <button type="button" class="menu-card" data-action="classes">${icon('users')}<strong>Meine Klassen</strong><small>${nList ? `${nList} ${nList === 1 ? 'Klasse' : 'Klassen'} · ` : ''}Kinder, Portionen freigeben, Kärtchen drucken, Auswertung.</small></button>
        </div>
        <section class="menu-group">
          <h3>Login-Kärtchen</h3>
          <p class="small muted">Gilt für die Kärtchen, die du ab jetzt druckst (Klasse → Kärtchen). Das Passwort bleibt gleich – nur die Darstellung ändert sich.</p>
          <div class="field"><span class="label">Passwort auf dem Kärtchen</span>
            <label class="radio"><input type="radio" name="card-secret" data-card="secret" value="pics" ${c.secret === 'pics' ? 'checked' : ''}><span><b>Bilder</b> – die Kinder tippen 3 Bilder an (ideal für Unterstufe)</span></label>
            <label class="radio"><input type="radio" name="card-secret" data-card="secret" value="password" ${c.secret === 'password' ? 'checked' : ''}><span><b>Passwort pro Kind</b> – Vokaboom erzeugt für jedes Kind ein eigenes Passwort, z. B. „blau-tiger-47“</span></label>
            <label class="radio"><input type="radio" name="card-secret" data-card="secret" value="class" ${c.secret === 'class' ? 'checked' : ''}><span><b>Klassenpasswort</b> – du legst ein Passwort für die ganze Klasse fest (einfach zu merken; dafür könnten sich Kinder gegenseitig anmelden)</span></label>
          </div>
          <div class="field"><span class="label">Name auf dem Kärtchen</span>
            <label class="radio"><input type="radio" name="card-names" data-card="names" value="full" ${c.names === 'full' ? 'checked' : ''}><span>Vorname und Anfangsbuchstabe („Lena M.“)</span></label>
            <label class="radio"><input type="radio" name="card-names" data-card="names" value="initials" ${c.names === 'initials' ? 'checked' : ''}><span>Nur Initialen („L. M.“) – datensparsam, z. B. für Kärtchen, die herumliegen</span></label>
          </div>
          ${c.secret === 'class' ? `<div class="field class-pw-list"><span class="label">Klassenpasswörter</span>
            ${(klass.list || []).length ? klass.list.map((k) => `<label class="class-pw-row"><span>${esc(k.name)}</span>
              <input type="text" data-class-pw="${k.id}" value="${esc(k.class_pw || '')}" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="z. B. Sommer2026"></label>`).join('')
              : '<p class="small muted">Noch keine Klassen.</p>'}
            <small class="muted">Klassen ohne Klassenpasswort bekommen Kärtchen mit Bildern. Die Bilder und das eigene Passwort jedes Kindes funktionieren weiterhin.</small></div>` : ''}
          ${c.secret !== 'pics' && klass.noPw ? '<p class="banner bad small">Für Passwörter zuerst <code>supabase/vokabelwelt.sql</code> in Supabase nochmals ausführen.</p>' : ''}
          <label class="switch"><input type="checkbox" data-card="qr" ${c.qr ? 'checked' : ''}><span>QR-Code aufs Kärtchen (Anmelden ohne Tippen)</span></label>
          <label class="switch"><input type="checkbox" data-card="cls" ${c.cls ? 'checked' : ''}><span>Klassenname oben aufs Kärtchen</span></label>
        </section>`;
    }
    case 'avatar': {
      if (!cloud.user) return needLogin('Einstellungen für Avatar und Münzen');
      const a = { on: true, coins: true, shop: true, games: true, perCoin: 10, dayMax: 40, ...(MENU.avCfg || {}) };
      if (!MENU.avCfg) return '<p class="muted"><span class="spinner"></span> Wird geladen …</p>';
      const kids = MENU.bonus.cls ? (studentsOf(MENU.bonus.cls) || []) : [];
      return `<p class="small muted">Gilt für alle deine Klassen – in Vokaboom und in Teilmal. Die Datenbank hält sich daran (Kinder können es nicht umgehen).</p>
        <section class="menu-group">
          <label class="switch big"><input type="checkbox" data-av="on" ${a.on ? 'checked' : ''}><span><b>„Mein Avatar“ für die Kinder</b><small>Ausgeschaltet sehen die Kinder weder Avatar noch Münzen.</small></span></label>
        </section>
        <fieldset class="menu-group" ${a.on ? '' : 'disabled'}>
          <h3>Münzen</h3>
          <label class="switch"><input type="checkbox" data-av="coins" ${a.coins ? 'checked' : ''}><span>Kinder sammeln Münzen beim Üben</span></label>
          <label class="field"><span class="label">Tempo: Punkte pro Münze</span>
            <select data-av="perCoin">${[[5, '5 – schnell (viele Münzen)'], [10, '10 – normal'], [15, '15 – gemütlich'], [20, '20 – sparsam']].map(([v, t]) => `<option value="${v}" ${a.perCoin === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <small class="muted">1 richtige Antwort = 1 Punkt (Lernkarten ½). Bei 10 Punkten pro Münze gibt eine Lektion mit 50 richtigen Antworten 5 Münzen.</small></label>
          <label class="field"><span class="label">Höchstens pro Tag</span>
            <select data-av="dayMax">${[10, 20, 40, 60, 100].map((v) => `<option value="${v}" ${a.dayMax === v ? 'selected' : ''}>${v} Münzen</option>`).join('')}</select></label>
          <label class="switch"><input type="checkbox" data-av="games" ${a.games ? 'checked' : ''}><span>Auch Spiele geben Punkte (1 Punkt pro fertigem Spiel)</span></label>
          <h3>Shop</h3>
          <label class="switch"><input type="checkbox" data-av="shop" ${a.shop ? 'checked' : ''}><span>Kinder dürfen mit Münzen besondere Teile kaufen<small>Ausgeschaltet: nur das Basic-Set (gekaufte Teile bleiben).</small></span></label>
        </fieldset>
        <section class="menu-group">
          <h3>Bonus-Münzen verteilen</h3>
          <p class="small muted">Für eine besondere Leistung, als Belohnung oder zum Start. Höchstens 50 auf einmal.</p>
          <div class="bonus-row">
            <select id="bonus-cls" aria-label="Klasse"><option value="">Klasse wählen …</option>${(klass.list || []).map((c) => `<option value="${c.id}" ${MENU.bonus.cls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
            <select id="bonus-kid" aria-label="Kind" ${kids.length ? '' : 'disabled'}><option value="">Kind wählen …</option><option value="*" ${MENU.bonus.kid === '*' ? 'selected' : ''}>Ganze Klasse</option>${kids.map((k) => `<option value="${k.id}" ${MENU.bonus.kid === k.id ? 'selected' : ''}>${esc(kidName(k))}</option>`).join('')}</select>
            ${seg('bonus-n', 'n', MENU.bonus.n, [[5, '+5'], [10, '+10'], [20, '+20']])}
            <button type="button" class="btn primary" data-action="bonus-give">Verteilen</button>
          </div>
        </section>`;
    }
    case 'stimme':
      return `${isTeacher() ? `<div class="field"><span class="label">Englische Aussprache</span>
          ${seg('set-accent', 'accent', s.accent === 'us' ? 'us' : 'gb', [['gb', 'Britisch'], ['us', 'Amerikanisch']])}
          <p class="small muted">Gilt auch für deine Klassen und für Portionen, die du per QR-Code teilst.</p></div>` : ''}
        ${canSpeak() ? `${isTeacher() ? `<div class="field" id="voice-field">${voiceFieldHTML()}</div>` : ''}
          <label class="field" for="set-rate"><span class="label">Sprechtempo</span><input type="range" id="set-rate" min="0.6" max="1.2" step="0.05" value="${s.rate}"></label>
          <div class="row"><button type="button" class="btn small secondary" data-action="voice-test" data-lang="en">${icon('speaker')} Stimme testen</button></div>`
        : '<p class="warn">Dieser Browser kann nicht vorlesen.</p>'}
        ${mayEditPoints() ? phoneticSettingsHTML(s) : ''}`;
    case 'mikro':
      return canListen()
        ? `<label class="field" for="mic-device"><span class="label">Mikrofon</span>
             <select id="mic-device"><option value="">Standard-Mikrofon</option></select></label>
           <div class="row"><button type="button" class="btn small secondary" data-action="mic-test">${icon('mic')} Mikrofon testen</button></div>
           <div class="mic-level big" id="mic-test-level" aria-hidden="true"><span></span></div>
           <p class="small" id="mic-test-out" aria-live="polite">Tippe auf „Mikrofon testen“ und sag ein Wort. Der Balken sollte sich beim Sprechen bewegen.</p>`
        : `<p class="muted small">${speechBrowserMissing ? 'Dieser Browser (Brave oder Opera) hat keine Spracherkennung. Am besten Chrome, Edge oder Safari benutzen.' : esc(micErrorText('not-supported', 'en'))}</p>`;
    case 'daten':
      return `<section class="menu-group">
          <h3>Wo sind die Daten?</h3>
          <ul class="menu-list">
            <li>${cloud.user ? `Deine Portionen sind in deinem Konto gespeichert (<strong>${esc(cloud.user)}</strong>) und auf diesem Gerät.` : 'Ohne Anmeldung bleibt alles nur in diesem Browser.'}</li>
            <li>Kinder mit Login: Vorname, Anfangsbuchstabe, Übungsstand, Avatar und Münzen – bis du das Kind oder die Klasse löschst.</li>
            <li>Aussprechen: Die Lauterkennung läuft auf dem Gerät, Aufnahmen werden nicht gespeichert.</li>
            <li>Live-Spiele: Es wird nichts gespeichert.</li>
          </ul>
        </section>
        <section class="menu-group">
          <h3>Hilfe</h3>
          <div class="row"><a class="btn small secondary" href="https://github.com/fabulousteaching/Vokaboom/blob/claude/vokabelwelt-app/supabase/ANLEITUNG.md" target="_blank" rel="noopener">${icon('link')} Anleitung öffnen</a></div>
        </section>
        <section class="menu-group danger-zone">
          <h3>Alles löschen</h3>
          <p class="small muted">Löscht alle Portionen und Einstellungen auf diesem Gerät${cloud.user ? ' (nicht im Konto)' : ''}.</p>
          <button type="button" class="btn small danger-ghost" data-action="wipe">${icon('trash')} Alles löschen</button>
        </section>
        <p class="muted small app-version">Vokaboom · Version ${esc(typeof APP_VERSION === 'string' && APP_VERSION ? APP_VERSION.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/, '$3.$2.$1 $4:$5') : 'lokal')}</p>`;
    default: return '';
  }
}

/** kleines „✓ Gespeichert“ neben dem Titel statt vieler Meldungen */
let menuSavedTimer = null;
function menuSaved(msg = 'Gespeichert') {
  const el = $('#menu-saved');
  if (!el) return;
  el.innerHTML = `${icon('check')} ${esc(msg)}`; el.classList.add('on');
  clearTimeout(menuSavedTimer); menuSavedTimer = setTimeout(() => el.classList.remove('on'), 1800);
}

/* ---------- Avatar & Münzen: Einstellungen der Lehrperson ---------- */
async function menuLoadAvatarCfg() {
  MENU.avLoading = true;
  try {
    const c = await cloudClient();
    const { data, error } = await c.from('fab_teacher_settings').select('avatar').eq('teacher_id', cloud.uid).maybeSingle();
    if (error) throw error;
    MENU.avCfg = { ...(data?.avatar || {}) };
  } catch (e) {
    MENU.avCfg = null;
    const b = $('#menu-body');
    if (b && MENU.sec === 'avatar') b.innerHTML = `<p class="banner bad">${icon('x')} Die Avatar-Einstellungen konnten nicht geladen werden. Wurde <code>supabase/avatar.sql</code> in Supabase ausgeführt?</p>`;
    MENU.avLoading = false;
    return;
  }
  MENU.avLoading = false;
  const b = $('#menu-body');
  if (b && MENU.sec === 'avatar') b.innerHTML = menuSectionHTML('avatar');
}
let menuAvTimer = null;
function menuSaveAvatarCfg() {
  clearTimeout(menuAvTimer);
  const b = $('#menu-body'); if (b && MENU.sec === 'avatar') b.innerHTML = menuSectionHTML('avatar');
  menuAvTimer = setTimeout(async () => {
    try {
      const c = await cloudClient();
      const { error } = await c.from('fab_teacher_settings').upsert({ teacher_id: cloud.uid, avatar: MENU.avCfg, updated_at: new Date().toISOString() }, { onConflict: 'teacher_id' });
      if (error) throw error;
      menuSaved();
    } catch (e) { toast('Speichern hat nicht geklappt. Bist du online?', 'bad'); }
  }, 400);
}
async function menuGiveBonus() {
  const { cls, kid: k, n } = MENU.bonus;
  if (!cls || !k) { toast('Wähle zuerst Klasse und Kind.'); return; }
  const ids = k === '*' ? studentsOf(cls).map((x) => x.id) : [k];
  try {
    const c = await cloudClient();
    for (const id of ids) {
      const { error } = await c.rpc('fab_teacher_bonus', { p_student: id, p_n: n });
      if (error) throw error;
    }
    if (typeof confetti === 'function') confetti();
    toast(ids.length > 1 ? `${ids.length} Kinder bekommen je ${n} Münzen. 🪙` : `${n} Münzen verschenkt. 🪙`);
  } catch (e) { toast('Das hat nicht geklappt. Wurde supabase/avatar.sql in Supabase ausgeführt?', 'bad'); }
}

const menuActions = {
  menu: () => openMenu(),
  'menu-sec': (el) => {
    if (ui.modal?.el?.querySelector('#mic-test-out')) { stopListening(true); stopMeter(); }
    openMenu(el.dataset.sec);
    $(`.menu-tab[data-sec="${el.dataset.sec}"]`)?.focus({ preventScroll: true });
  },
  'bonus-n': (el) => { MENU.bonus.n = +el.dataset.n; avAllSet('[data-action="bonus-n"]', el); },
  'bonus-give': () => menuGiveBonus(),
};
function avAllSet(sel, el) { $$(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === el))); }
