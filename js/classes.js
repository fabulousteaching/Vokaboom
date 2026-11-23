/* Vokaboom – Klassen (für Lehrpersonen) und Kinder-Login
 *
 * Lehrperson (mit Konto): Klassen anlegen, Kinder eintragen (Vorname + erster Buchstabe des Nachnamens),
 * Portionen freigeben, Login-Kärtchen als PDF, Auswertung pro Kind und pro Wort.
 * Kind: meldet sich mit Benutzername (z. B. Maus67) und drei Bildern an – oder scannt den QR-Code auf dem
 * Kärtchen. Es sieht nur die freigegebenen Portionen; der Übungsstand wird ins Konto der Lehrperson gemeldet.
 * Datenbank: supabase/vokabelwelt.sql (Abschnitt „Klassen und Kinder-Logins“).
 */
'use strict';

/* =========================================================
   Kinder-Login
   ========================================================= */
const KID_KEY = 'vokaboom.kid';        // Anmeldung des Kindes auf diesem Gerät
const KID_DB_KEY = 'vokaboom.kiddb';   // Portionen + Übungsstand des Kindes, getrennt von eigenen Portionen
const kid = { token: '', first: '', initial: '', username: '', cls: '', sent: {}, busy: false, again: false, status: 'ok', sso: false, e1: false };
const isKid = () => !!kid.token;
const kidName = (k = kid) => `${k.first || k.first_name || ''}${(k.initial ?? k.last_initial) ? ` ${k.initial ?? k.last_initial}.` : ''}`;
const displayUser = (u) => String(u || '').charAt(0).toUpperCase() + String(u || '').slice(1);
const kidSvgURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const kidWordOf = (username) => (String(username || '').match(/^[a-z]+/) || [''])[0];
const kidWordImg = (username, cls = '') => {
  const s = typeof KID_WORDS === 'object' && KID_WORDS[kidWordOf(username)];
  return s ? `<img class="${cls}" src="${kidSvgURL(s)}" alt="" draggable="false">` : '';
};
// Kurzform fürs Kärtchen: die ersten zwei Buchstaben des Vornamens und der Anfangsbuchstabe („Le. M.“) –
// so sind Kinder mit gleichen Initialen trotzdem auseinanderzuhalten
const kidInitials = (k) => {
  const f = Array.from(String(k.first || k.first_name || '?').trim());
  const li = String((k.initial ?? k.last_initial) || '');
  return `${(f[0] || '?').toUpperCase()}${(f[1] || '').toLowerCase()}.${li ? ` ${li.charAt(0).toUpperCase()}.` : ''}`;
};
/** Was auf dem Kärtchen steht: 'pics' (3 Bilder), 'password' (eigenes Passwort pro Kind, Spalte pw) oder
 *  'class' (Klassenpasswort der Lehrperson, Spalte class_pw). Fehlt das Passwort, gelten die Bilder. */
function kidSecretOf(st) {
  const m = typeof cardCfg === 'function' ? cardCfg().secret : 'pics';
  if (m === 'password' && st?.pw) return 'password';
  if (m === 'class' && klass.list.find((c) => c.id === st?.class_id)?.class_pw) return 'class';
  return 'pics';
}
// Passwort: ein Wort und eine Zahl („Teich23“) – gleiche Wörter wie in supabase/vokabelwelt.sql (vokaboom_new_pw)
const KID_PW_WORDS = ['teich', 'wiese', 'wald', 'bach', 'see', 'hafen', 'garten', 'turm', 'strand', 'stein', 'regen', 'schnee', 'nebel', 'wind', 'blatt', 'nest', 'feder', 'kerze', 'lampe', 'tisch', 'stuhl', 'fenster', 'dach', 'zelt', 'kiste', 'korb', 'glocke', 'ring', 'perle', 'mantel', 'schal', 'socke', 'kappe', 'brille', 'pinsel', 'farbe', 'papier', 'karte', 'nudel', 'suppe', 'honig', 'butter', 'zucker', 'kakao', 'tomate', 'gurke', 'karotte', 'mais', 'nuss', 'beere', 'traube', 'zitrone', 'orange', 'flocke', 'welle', 'sonnenhut', 'kugel', 'besen', 'leiter', 'koffer'];
const rndInt = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const newKidPw = () => `${KID_PW_WORDS[rndInt(KID_PW_WORDS.length)]}${10 + rndInt(90)}`;
/** Anzeige wie beim Benutzernamen: gross geschrieben („Teich23“); beim Eintippen spielt gross/klein keine Rolle */
const showPw = (pw) => (pw ? pw.charAt(0).toUpperCase() + pw.slice(1) : '');
const KID_MODE_KEY = 'vokaboom.kidLoginMode';
const kidPwImg = (i, cls = '') => `<img class="${cls}" src="${kidSvgURL(KID_PW[i].svg)}" alt="${esc(KID_PW[i].de)}" draggable="false">`;
const picsList = (pics) => String(pics || '').split(',').map(Number).filter((n) => n >= 0 && n < 12);
const kidLoginUrl = (st) => `${siteUrl()}#k=${st.username}.${picsList(st.pics).join('-')}`;

/** Beim Start: Ist auf diesem Gerät ein Kind angemeldet? Dann dessen Speicher benutzen. */
function kidLoadSession() {
  try {
    const d = JSON.parse(localStorage.getItem(KID_KEY) || 'null');
    if (d && typeof d.token === 'string' && d.token) Object.assign(kid, d, { sent: d.sent && typeof d.sent === 'object' ? d.sent : {} });
  } catch { /* */ }
  if (isKid()) STORE_KEY = KID_DB_KEY;
}
function kidSaveSession() {
  const { token, first, initial, username, cls, clsSettings, sent, sso, e1 } = kid;
  try { localStorage.setItem(KID_KEY, JSON.stringify({ token, first, initial, username, cls, clsSettings, sent, sso, e1 })); } catch { /* */ }
}

function kidErrorText(e) {
  const msg = String(e?.message || e || '');
  if (/too_many_attempts/.test(msg)) return 'Zu viele falsche Versuche. Warte 5 Minuten und probier es dann nochmal.';
  if (/session_invalid/.test(msg)) return 'Du wurdest abgemeldet. Melde dich mit deinem Kärtchen neu an.';
  if (/vokaboom_student|could not find the function|PGRST202/i.test(msg)) return 'Die Klassen sind in Supabase noch nicht eingerichtet: supabase/vokabelwelt.sql nochmals ganz ausführen.';
  return cloudErrorText(e);
}

/** Meldet ein Kind an. Liefert true (angemeldet) oder false (Name oder Bilder falsch). */
async function kidLogin(username, pics) { // pics: [3, 7, 11] oder Passwort-Text („teich23“ oder Klassenpasswort)
  const c = await cloudClient();
  const user = String(username || '').trim().toLowerCase();
  const { data, error } = await c.rpc('vokaboom_student_login', { p_username: user, p_pics: Array.isArray(pics) ? pics.join(',') : String(pics || '').trim().slice(0, 80) });
  if (error) throw error;
  if (!data || !data.token) return false;
  await kidStart(data.token, user);
  return isKid();
}
/** Mit einem Anmelde-Schlüssel als Kind anmelden. fromCookie: kam über das gemeinsame Anmelden aus Einmaleins. */
async function kidStart(token, user, { fromCookie = false } = {}) {
  if (isKid()) kidForget(false); // anderes Kind war noch angemeldet (geteiltes iPad)
  else saveNow(); // eigene Portionen bleiben unter dem normalen Speicherplatz
  Object.assign(kid, { token, username: user, first: '', initial: '', cls: '', sent: {}, status: 'ok', sso: fromCookie, e1: false });
  STORE_KEY = KID_DB_KEY;
  db = { sets: [], settings: { ...structuredClone(DEFAULT_SETTINGS), ...db.settings } };
  kidSaveSession();
  await kidRefresh();
  if (isKid() && !fromCookie) { kid.sso = SSO.kid.set({ u: kid.username, tool: 'v', t: kid.token }); kidSaveSession(); }
}
/** Gibt es das Kind auch in Einmaleins? (für den Knopf „1×1 Rechnen“) */
async function kidCheckEinmaleins() {
  if (!isKid() || !CLOUD_CFG.einmaleinsUrl) return;
  try {
    const c = await cloudClient();
    const { data, error } = await c.rpc('einmaleins_kid_linked', { p_from: 'vokaboom', p_token: kid.token });
    if (error) return;
    if (!!data !== kid.e1) { kid.e1 = !!data; kidSaveSession(); renderAccountSlot(); if (ui.view === 'home') render(); }
  } catch { /* Einmaleins nicht eingerichtet oder offline */ }
}

/** Freigegebene Portionen und eigenen Übungsstand holen */
async function kidRefresh() {
  if (!isKid()) return;
  const c = await cloudClient();
  const { data, error } = await c.rpc('vokaboom_student_data', { p_token: kid.token });
  if (error) {
    if (/session_invalid/.test(error.message || '')) { kidForget(); toast(kidErrorText(error), 'bad'); return; }
    throw error;
  }
  kid.first = data.student?.first || ''; kid.initial = data.student?.initial || ''; kid.cls = data.class?.name || '';
  kid.clsSettings = data.class?.settings && typeof data.class.settings === 'object' ? data.class.settings : {};
  kid.username = data.student?.username || kid.username;
  kidCheckEinmaleins();
  const prog = new Map((data.progress || []).map((p) => [p.set_id, p.data]));
  const old = new Map(db.sets.map((s) => [s.id, s]));
  db.sets = (data.sets || []).map((r) => {
    const s = cleanRemoteSet(r.data, r.set_id);
    if (!s) return null;
    const o = old.get(r.set_id);
    const localDirty = o && kid.sent[r.set_id] !== setHash(o.progress || {});
    s.progress = localDirty ? o.progress : (prog.get(r.set_id) || {});
    if (!localDirty) kid.sent[r.set_id] = setHash(s.progress);
    s.assigned = true;
    const gOff = data.games_off && Array.isArray(data.games_off[r.set_id]) ? data.games_off[r.set_id].filter((x) => typeof x === 'string') : [];
    if (gOff.length) s.gamesOff = [...new Set([...(s.gamesOff || []), ...gOff])];
    if (o) s.words.forEach((w) => { const ow = o.words.find((x) => x.id === w.id); if (ow && w.picStatus !== 'done' && ow.picStatus === 'done' && ow.foreign === w.foreign) { w.pic = ow.pic; w.picStatus = 'done'; } });
    return s;
  }).filter(Boolean);
  kid.status = 'ok';
  kidSaveSession();
  saveNow();
  renderShell(); bindTopSearch();
  if (typeof avatarLoad === 'function') avatarLoad(true).then(() => { if (ui.view === 'home' && isKid()) render(); });
  if (ui.view !== 'home' && ui.view !== 'avatar' && !currentSet()) ui.view = 'home';
  if (['home', 'set'].includes(ui.view)) render(); else renderCrumbs();
}

async function kidPushNow() {
  if (!isKid()) return;
  if (kid.busy) { kid.again = true; return; }
  const dirty = db.sets.filter((s) => kid.sent[s.id] !== setHash(s.progress || {}));
  if (!dirty.length) return;
  kid.busy = true;
  try {
    const c = await cloudClient();
    for (const s of dirty) {
      const h = setHash(s.progress || {});
      const { error } = await c.rpc('vokaboom_student_save', { p_token: kid.token, p_set_id: s.id, p_data: s.progress || {} });
      if (error) throw error;
      kid.sent[s.id] = h;
    }
    kid.status = 'ok';
    kidSaveSession();
  } catch (e) {
    kid.status = 'error';
    if (/session_invalid/.test(e?.message || '')) { kid.busy = false; kidForget(); toast(kidErrorText(e), 'bad'); return; }
  } finally {
    kid.busy = false;
    renderAccountSlot();
  }
  if (kid.again) { kid.again = false; kidPushNow(); }
}
const kidPushSoon = debounce(kidPushNow, 1500);

async function kidLogout() {
  try { await kidPushNow(); } catch { /* */ }
  try { const c = await cloudClient(); await c.rpc('vokaboom_student_logout', { p_token: kid.token }); } catch { /* */ }
  if (SSO.kid.get()?.u === kid.username) SSO.kid.clear(); // gemeinsames Anmelden: auch in Einmaleins abmelden
  kidForget();
  toast('Abgemeldet. Tschüss!');
}
/** Kind abmelden: dessen Daten vom Gerät entfernen, eigene Portionen wieder laden */
function kidForget(rerender = true) {
  try { localStorage.removeItem(KID_KEY); localStorage.removeItem(KID_DB_KEY); } catch { /* */ }
  Object.assign(kid, { token: '', first: '', initial: '', username: '', cls: '', sent: {}, status: 'ok', sso: false, e1: false });
  if (typeof AV === 'object') { AV.state = null; AV.draft = null; }
  STORE_KEY = MAIN_STORE_KEY;
  db = { sets: [], settings: structuredClone(DEFAULT_SETTINGS) };
  loadDB();
  if (!rerender) return;
  closeModal(true);
  ui.setId = null; ui.view = 'home';
  renderShell(); bindTopSearch(); render();
}

/** Gemeinsames Anmelden mit Einmaleins (Cookie auf fabulousteaching.ch): Kind übernehmen oder abmelden */
const ssoTried = new Set();
async function kidSsoCheck() {
  if (!SSO.DOMAIN || !cloudConfigured() || cloud.uid || SSO.teacherSignedIn(AUTH_KEY)) return;
  const c = SSO.kid.get();
  if (!c) { if (isKid() && kid.sso) { kidForget(); toast('Abgemeldet.'); } return; }
  if (isKid() && kid.username === c.u) { SSO.kid.set(c); if (!kid.sso) { kid.sso = true; kidSaveSession(); } return; } // Cookie erneuern
  const key = c.tool + c.t;
  if (ssoTried.has(key)) return;
  ssoTried.add(key);
  try {
    let tok = c.tool === 'v' ? c.t : '', user = c.u;
    if (c.tool === 'e') {
      const cl = await cloudClient();
      const { data } = await cl.rpc('einmaleins_kid_bridge', { p_from: 'einmaleins', p_token: c.t });
      if (data?.token) { tok = data.token; user = data.username || c.u; }
    }
    if (!tok) { if (isKid() && kid.sso) { kidForget(); toast('Abgemeldet.'); } return; } // anderes Kind ohne Vokaboom
    await kidStart(tok, user, { fromCookie: true });
    if (isKid()) toast(`Hallo ${kid.first}! Du bist angemeldet.`);
  } catch { ssoTried.delete(key); /* offline: später nochmals */ }
}
/** Knopf „1×1 Rechnen“: mit derselben Anmeldung nach Einmaleins */
function goEinmaleins() {
  const base = String(CLOUD_CFG.einmaleinsUrl || '').trim();
  if (!base) return;
  saveNow();
  kidPushNow().finally(() => { location.href = isKid() ? `${base}#sso=v.${kid.token}` : base; });
}

/** Login über den QR-Code auf dem Kärtchen (…#k=maus67.11-0-2) oder über den Knopf in Einmaleins (…#sso=e.<Schlüssel>) */
async function kidLoginFromHash() {
  const sso = location.hash.match(/^#sso=([ve])\.([0-9a-f-]{36})$/i);
  if (sso) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
    render();
    if (cloud.uid || SSO.teacherSignedIn(AUTH_KEY)) return true;
    try {
      let tok = sso[2], user = '';
      if (sso[1] === 'e') {
        const cl = await cloudClient();
        const { data } = await cl.rpc('einmaleins_kid_bridge', { p_from: 'einmaleins', p_token: sso[2] });
        tok = data?.token || ''; user = data?.username || '';
      }
      if (!tok) { toast('Für dich gibt es in Vokaboom noch keine Klasse. Frag deine Lehrperson.', 'bad'); return true; }
      if (isKid() && kid.token === tok) return true;
      await kidStart(tok, user);
      if (isKid()) toast(`Hallo ${kid.first}! Du bist angemeldet.`);
    } catch (e) { toast(kidErrorText(e), 'bad'); }
    return true;
  }
  // QR-Code eines Kärtchens: #k= meldet direkt an, #w= (Kind in beiden Tools) fragt zuerst, wo
  const m = location.hash.match(/^#([kw])=([a-z]+[0-9]{2,4})\.(\d{1,2})-(\d{1,2})-(\d{1,2})$/i);
  if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
  const user = m[2].toLowerCase(), pics = [m[3], m[4], m[5]].map(Number);
  render();
  if (m[1].toLowerCase() === 'w' && !(cloud.uid || SSO.teacherSignedIn(AUTH_KEY))) { openToolChooser(user, pics.join('-')); return true; }
  await kidLoginFromCard(user, pics);
  return true;
}

/* ---------- Ein QR-Code für beide Tools (gleich in Vokaboom und Teilmal) ----------
 * Kinder mit demselben Login in Vokaboom und Teilmal haben auf dem Kärtchen nur einen QR-Code (…#w=baum34.1-2-3).
 * Er fragt „Wo willst du dich anmelden?“: „bei Vokaboom“ oder „bei Teilmal“. Kinder, die nur ein Tool haben,
 * kommen mit ihrem QR-Code (…#k=…) direkt dorthin. */
const TOOL_HERE = 'vokaboom';
const TOOL_LOGOS = {
  vokaboom: '<svg viewBox="0 -6 80 78" aria-hidden="true"><defs><linearGradient id="tool-vk-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs><rect x="6" y="22" width="36" height="42" rx="10" fill="#FFB703" transform="rotate(-12 24 43)"/><rect x="14" y="20" width="38" height="46" rx="11" fill="url(#tool-vk-g)"/><path d="M23 34l10 18 10-18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><g stroke-linecap="round"><path d="M54 13.1L52 2.3" stroke="#EC4899" stroke-width="4"/><path d="M57.8 13.2L63.3 1.9" stroke="#FFB703" stroke-width="4.4"/><path d="M60.3 16.2L70 11" stroke="#EC4899" stroke-width="4"/><path d="M61.5 19.7L68.9 20.5" stroke="#FFB703" stroke-width="3.6"/><path d="M50.2 14.7L45.7 10.6" stroke="#FFB703" stroke-width="3.6"/></g><circle cx="57.9" cy="-1.8" r="2" fill="#EC4899"/><circle cx="75.1" cy="14.7" r="1.9" fill="#FFB703"/><circle cx="71" cy="2.5" r="1.5" fill="#EC4899"/><circle cx="46.5" cy="3.1" r="1.5" fill="#EC4899"/></svg>',
  teilmal: '<svg viewBox="3 11 69 69" aria-hidden="true"><defs><linearGradient id="tool-tm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F766E"/><stop offset="1" stop-color="#0E7490"/></linearGradient></defs><path d="M27 12H56a15 15 0 0 1 15 15V42a15 15 0 0 1-15 15H39L22 70l3-13H27a15 15 0 0 1-15-15V27a15 15 0 0 1 15-15z" fill="#FF6B4A" transform="translate(-5 5) rotate(-7 41 40)"/><path d="M27 12H56a15 15 0 0 1 15 15V42a15 15 0 0 1-15 15H39L22 70l3-13H27a15 15 0 0 1-15-15V27a15 15 0 0 1 15-15z" fill="url(#tool-tm-g)"/><path d="M23 27l15 15M38 27 23 42" stroke="#fff" stroke-width="6.8" stroke-linecap="round"/><g fill="#FF6B4A"><circle cx="54" cy="27.5" r="4.3"/><circle cx="54" cy="41.5" r="4.3"/></g></svg>',
};
/** Adresse fürs Kärtchen: ein QR-Code; bei Kindern in beiden Tools zuerst die Frage, wo sie sich anmelden */
const cardQrUrl = (st, both) => `${siteUrl()}#${both ? 'w' : 'k'}=${st.username}.${picsList(st.pics).join('-')}`;
function openToolChooser(user, pics) {
  const other = String(CLOUD_CFG.einmaleinsUrl || '').trim();
  const tile = (tool, name, sub) => {
    const inner = `<span class="tool-logo" aria-hidden="true">${TOOL_LOGOS[tool]}</span><strong>bei ${name}</strong><small>${sub}</small>`;
    return tool === TOOL_HERE || !other
      ? `<button type="button" class="role-tile tool-tile ${tool}" data-action="tool-here" data-u="${esc(user)}" data-p="${esc(pics)}">${inner}</button>`
      : `<a class="role-tile tool-tile ${tool}" href="${esc(other)}#k=${esc(user)}.${esc(pics)}">${inner}</a>`;
  };
  openModal(`
    <header class="modal-head"><h2>Wo willst du dich anmelden?</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schliessen">${icon('x')}</button></header>
    <div class="role-pick tool-pick">
      ${tile('vokaboom', 'Vokaboom', 'ABC Vokabeln üben')}
      ${tile('teilmal', 'Teilmal', '1×1 Rechnen üben')}
    </div>
    <p class="small center muted">Wechseln kannst du später jederzeit mit dem Knopf auf deiner Startseite.</p>`, { label: 'Wo willst du dich anmelden?', cls: 'auth-modal role-modal tool-modal' });
}
/** Login mit dem QR-Code des Kärtchens (Benutzername und Bilder) */
async function kidLoginFromCard(user, pics) {
  if (isKid() && kid.username === user) { render(); return; }
  if (cloud.uid || SSO.teacherSignedIn(AUTH_KEY)) { openTeacherBlocks(); return; }
  toast('Anmelden …');
  try {
    if (await kidLogin(user, pics)) toast(`Hallo ${kid.first}! Du bist angemeldet.`);
    else toast('Dieses Kärtchen gilt nicht mehr. Frag deine Lehrperson nach einem neuen.', 'bad');
  } catch (e) { toast(kidErrorText(e), 'bad'); }
}
function openTeacherBlocks() {
  openModal(`
    <header class="modal-head"><h2>Kinder-Login</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <p>Auf diesem Gerät ist gerade eine Lehrperson angemeldet${cloud.user ? ` (<strong>${esc(cloud.user)}</strong>)` : ''}.</p>
    <p class="muted">Damit sich ein Kind anmelden kann, zuerst abmelden. Die Portionen der Lehrperson bleiben in ihrem Konto.</p>
    <footer class="modal-foot"><button type="button" class="btn ghost" data-action="close-modal">Abbrechen</button><button type="button" class="btn primary" data-action="logout">Lehrperson abmelden</button></footer>`, { label: 'Kinder-Login' });
}

/* ---------- Anmelde-Fenster für Kinder ---------- */
const kidForm = { picks: [] };
function openKidLogin() {
  if (!cloudConfigured()) { openLogin(); return; }
  if (cloud.uid) { openTeacherBlocks(); return; }
  kidForm.picks = [];
  openModal(`
    <header class="modal-head"><h2>Kinder-Login</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <form id="kid-form" class="auth-form kid-form" autocomplete="off" novalidate>
      <label class="field" for="kid-user"><span class="label">Dein Benutzername</span>
        <input id="kid-user" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" placeholder="z. B. Baum34" enterkeyhint="next"></label>
      <div class="seg kid-mode" role="group" aria-label="Wie meldest du dich an?">
        <button type="button" class="seg-btn" data-action="kid-pw-mode" data-mode="pics" aria-pressed="true">${icon('image')} Mit Bildern</button>
        <button type="button" class="seg-btn" data-action="kid-pw-mode" data-mode="password" aria-pressed="false">${icon('edit')} Mit Passwort</button>
      </div>
      <div class="kid-pw-pics" id="kid-pw-pics">
        <p class="label">Tippe deine 3 Bilder der Reihe nach an</p>
        <div class="kid-slots" id="kid-slots" aria-live="polite"></div>
        <div class="kid-grid">${KID_PW.map((p, i) => `<button type="button" class="kid-pic" data-action="kid-pick" data-i="${i}" aria-label="${esc(p.de)}">${kidPwImg(i)}</button>`).join('')}</div>
      </div>
      <label class="field kid-pw-words" for="kid-pw" hidden><span class="label">Dein Passwort</span>
        <input id="kid-pw" type="text" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" maxlength="60" placeholder="steht auf deinem Kärtchen" enterkeyhint="go"></label>
      <p class="form-error" id="kid-error" role="alert"></p>
      <button class="btn primary big" type="submit" id="kid-submit">Los geht's ${icon('right')}</button>
    </form>
    <p class="muted small">${icon('image')} Oder scanne den QR-Code auf deinem Kärtchen mit der Kamera.</p>
    <p class="small"><button type="button" class="link-btn" data-action="login-choose">Zurück</button></p>`, { label: 'Kinder-Login', cls: 'auth-modal kid-modal' });
  renderKidSlots();
  let mode = 'pics'; try { mode = localStorage.getItem(KID_MODE_KEY) || 'pics'; } catch { /* */ }
  setKidLoginMode(mode === 'password' ? 'password' : 'pics', false);
  setTimeout(() => $('#kid-user')?.focus(), 60);
  $('#kid-form').addEventListener('submit', (e) => { e.preventDefault(); submitKidLogin(); });
}
function setKidLoginMode(mode, focus = true) {
  const w = $('.kid-pw-words'), p = $('#kid-pw-pics');
  if (!w) return;
  w.hidden = mode !== 'password'; p.hidden = mode === 'password';
  $$('.kid-mode .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  try { localStorage.setItem(KID_MODE_KEY, mode); } catch { /* */ }
  kidForm.picks = []; renderKidSlots();
  const e = $('#kid-error'); if (e) e.textContent = '';
  if (focus) (!$('#kid-user')?.value.trim() ? $('#kid-user') : mode === 'password' ? $('#kid-pw') : null)?.focus();
}
function renderKidSlots() {
  const box = $('#kid-slots');
  if (!box) return;
  box.innerHTML = [0, 1, 2].map((k) => `<span class="kid-slot ${kidForm.picks[k] != null ? 'full' : ''}"><b>${k + 1}</b>${kidForm.picks[k] != null ? kidPwImg(kidForm.picks[k]) : ''}</span>`).join('')
    + `<button type="button" class="icon-btn subtle" data-action="kid-unpick" aria-label="Letztes Bild wegnehmen" title="Zurück" ${kidForm.picks.length ? '' : 'disabled'}>${icon('left')}</button>`;
}
function kidPick(i) {
  if (kidForm.picks.length >= 3) return;
  kidForm.picks.push(i);
  sfx.flip();
  renderKidSlots();
  if (kidForm.picks.length === 3 && $('#kid-user')?.value.trim()) submitKidLogin();
}
function kidUnpick() { kidForm.picks.pop(); renderKidSlots(); }
async function submitKidLogin() {
  const err = $('#kid-error'), btn = $('#kid-submit'), input = $('#kid-user');
  if (!err) return;
  const user = input.value.trim().replace(/\s+/g, '');
  if (!user) { err.textContent = 'Schreib zuerst deinen Benutzernamen (er steht auf deinem Kärtchen).'; input.focus(); return; }
  const typed = !$('.kid-pw-words')?.hidden;
  const pwText = ($('#kid-pw')?.value || '').trim();
  if (typed && pwText.replace(/[^a-z0-9äöü]/gi, '').length < 4) { err.textContent = 'Schreib dein Passwort vom Kärtchen.'; $('#kid-pw')?.focus(); return; }
  if (!typed && kidForm.picks.length < 3) { err.textContent = 'Tippe deine 3 Bilder an.'; return; }
  err.textContent = '';
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Anmelden …';
  try {
    const ok = await kidLogin(user, typed ? pwText : kidForm.picks);
    if (!ok) {
      if (!$('#kid-error')) return;
      err.textContent = typed ? 'Benutzername oder Passwort stimmt leider nicht. Schau genau auf dein Kärtchen und probier es nochmal.' : 'Das stimmt leider nicht. Schau genau auf dein Kärtchen und probier es nochmal.';
      sfx.bad();
      kidForm.picks = []; renderKidSlots();
      if (typed) $('#kid-pw')?.select();
      btn.disabled = false; btn.innerHTML = `Los geht's ${icon('right')}`;
      return;
    }
    closeModal(true);
    toast(`Hallo ${kid.first}! Du bist angemeldet.`);
  } catch (e) {
    if (!$('#kid-error')) return;
    err.textContent = kidErrorText(e);
    btn.disabled = false; btn.innerHTML = `Los geht's ${icon('right')}`;
  }
}

function kidAccountButtonHTML() {
  const st = kid.status === 'error' ? 'error' : kid.busy ? 'syncing' : 'ok';
  return `<button class="account-btn in kid" data-action="kid-account" title="${esc(kidName())} (${esc(displayUser(kid.username))})" aria-label="Angemeldet als ${esc(kidName())}">
    ${kidWordImg(kid.username, 'kid-av') || icon('user')}<span class="account-name">${esc(kid.first || displayUser(kid.username))}</span><i class="sync-dot ${st}" aria-hidden="true"></i></button>`;
}
function openKidAccount() {
  openModal(`
    <header class="modal-head"><h2>Hallo ${esc(kid.first)}!</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <div class="account-card">
      <span class="account-avatar kid-avatar" aria-hidden="true">${kidWordImg(kid.username)}</span>
      <div><strong>${esc(kidName())}</strong><p class="small muted">${esc(kid.cls)} · Benutzername ${esc(displayUser(kid.username))}</p></div>
    </div>
    <p class="muted small">${kid.status === 'error' ? 'Dein Übungsstand konnte gerade nicht gemeldet werden. Er wird gespeichert, sobald es wieder Internet hat.' : 'Was du übst, sieht deine Lehrperson automatisch.'}</p>
    <div class="row">
      <button type="button" class="btn secondary" data-action="kid-refresh">${icon('flip')} Neue Portionen holen</button>
      <button type="button" class="btn ghost" data-action="kid-logout">Abmelden</button>
    </div>`, { label: 'Mein Login' });
}

function kidHomeHTML() {
  const steps = ['cards', 'match', 'speak', 'dictation', 'test'];
  return `<section class="home kid-home">
    <div class="kid-hello">
      <span class="kid-hello-pic" aria-hidden="true">${kidWordImg(kid.username)}</span>
      <div><p class="eyebrow">${esc(kid.cls)}</p><h1>Hallo ${esc(kid.first)}!</h1><p class="lead">Wähle eine Portion und leg los.</p>
        <span class="row kid-hello-btns"><button class="btn secondary live-join-btn" data-action="live-join">🎯 Live-Spiel beitreten</button>
        ${kid.e1 && CLOUD_CFG.einmaleinsUrl ? '<button class="btn secondary other-tool" data-action="go-einmaleins"><span class="ot-tag">1×1</span> Rechnen üben</button>' : ''}</span></div>
    </div>
    ${typeof reviewCardHTML === 'function' ? reviewCardHTML() : ''}
    ${typeof w3HomeCardsHTML === 'function' && avatarOn() && w3WebGL() ? (setTimeout(w3HomeSnaps), w3HomeCardsHTML()) : typeof avatarSVG === 'function' && avatarOn() ? `<button class="av-home-card" data-action="avatar-open">
      <span class="av-home-fig">${AV.state ? avatarSVG(AV.state.avatar, { idle: true, label: 'Mein Avatar' }) : ''}</span>
      <span><strong>Mein Avatar${AV.state?.fresh ? '<span class="av-new">Neu</span>' : ''}</strong>
        <span class="muted">${AV.state?.fresh ? 'Gestalte deine eigene Figur!' : 'Frisur, Kleider, Haustier …'}</span><br>
        ${AV_COIN_SVG} <b class="av-coin-n">${AV.state?.coins ?? '…'}</b> Münzen – verdiene mehr beim Üben</span>
    </button>` : ''}
    ${db.sets.length ? `<ul class="kid-sets">${db.sets.map((s) => {
      const p = s.progress || {};
      const done = steps.filter((k) => p[k]).length;
      return `<li><button class="kid-set" data-action="open-set" data-id="${s.id}">
        <strong>${flag(s.lang)} ${esc(s.name)}</strong>
        <small>${LANGS[langOf(s)].name} · ${s.words.length} Vokabeln${p.test?.best != null ? ` · Test ${p.test.best} %` : ''}</small>
        <span class="kid-steps" aria-label="${done} von 5 Übungen gemacht">${steps.map((k) => `<i class="${p[k] || (k === 'match' && p.games) ? 'on' : ''}"></i>`).join('')}</span>
      </button></li>`;
    }).join('')}</ul>` : `<div class="panel empty-kid"><p>Deine Lehrperson hat noch keine Portion freigegeben.</p><button class="btn secondary" data-action="kid-refresh">${icon('flip')} Nochmal schauen</button></div>`}
  </section>`;
}

/* =========================================================
   Klassen der Lehrperson
   ========================================================= */
const klass = { list: [], students: {}, progress: {}, loaded: false, loading: null, error: '', tab: 'kids', statSet: '', kidDetail: '', confirm: '', busy: false };
const classById = (id) => klass.list.find((c) => c.id === id);
const currentClass = () => classById(ui.classId);
const studentsOf = (cid) => klass.students[cid] || [];

async function loadClasses() {
  if (klass.loading) return klass.loading;
  klass.loading = (async () => {
    try {
      const c = await cloudClient();
      const [cl0, st] = await Promise.all([
        c.from('vokaboom_classes').select('*').order('created_at'),
        c.from('vokaboom_students').select('*').order('first_name'),
        typeof loadCardCfg === 'function' ? loadCardCfg() : null, // Kärtchen-Einstellungen (gleich wie in Teilmal)
      ]);
      const cl = cl0;
      // Datenbank noch ohne neue Spalten (SQL-Skript nicht neu ausgeführt)?
      klass.noRules = !!cl.data?.length && !('rules' in cl.data[0]);
      klass.noPw = !!cl.data?.length && !('class_pw' in cl.data[0]);
      klass.noSettings = !!cl.data?.length && !('settings' in cl.data[0]);
      klass.oldPw = (st.data || []).some((x) => /-/.test(x.pw || '')); // Datenbank erzeugt noch lange Passwörter (altes SQL)
      if (cl.error) throw cl.error;
      if (st.error) throw st.error;
      klass.list = (cl.data || []).map((x) => ({ ...x, rules: x.rules && typeof x.rules === 'object' && !Array.isArray(x.rules) ? x.rules : {} }));
      klass.students = {};
      (st.data || []).forEach((s) => { (klass.students[s.class_id] = klass.students[s.class_id] || []).push(s); });
      await loadEinmaleinsLinks();
      klass.loaded = true; klass.error = '';
    } catch (e) {
      klass.error = classErrorText(e);
    } finally { klass.loading = null; }
  })();
  return klass.loading;
}
/** Einmaleins (gleiches Supabase-Projekt): Welche Kinder haben dort dasselbe Login? */
async function loadEinmaleinsLinks() {
  klass.e1 = null;
  try {
    const c = await cloudClient();
    const [a, b] = await Promise.all([
      c.from('einmaleins_classes').select('vokaboom_class,settings'),
      c.from('einmaleins_students').select('username,vokaboom_id'),
    ]);
    if (a.error || b.error) return;
    const linked = new Map();
    (a.data || []).forEach((x) => { if (x.vokaboom_class) linked.set(x.vokaboom_class, new Set(Array.isArray(x.settings?.vbSkip) ? x.settings.vbSkip : [])); });
    klass.e1 = { byVid: new Map((b.data || []).filter((x) => x.vokaboom_id).map((x) => [x.vokaboom_id, x.username])), usernames: new Set((b.data || []).map((x) => x.username)), linked };
  } catch { /* Einmaleins nicht eingerichtet */ }
}
/** Hat dieses Kind in Einmaleins dasselbe Login (oder bekommt es beim ersten Anmelden dort)? */
function einmaleinsLoginOf(st) {
  const e = klass.e1, base = String(CLOUD_CFG.einmaleinsUrl || '').trim();
  if (!e || !base) return '';
  const u = e.byVid.get(st.id);
  const ok = u ? u === st.username : (e.linked.has(st.class_id) && !e.linked.get(st.class_id).has(st.id) && !e.usernames.has(st.username));
  return ok ? `${base}#k=${st.username}.${picsList(st.pics).join('-')}` : '';
}
async function loadClassProgress(cid) {
  const ids = studentsOf(cid).map((s) => s.id);
  const map = {};
  if (ids.length) {
    const c = await cloudClient();
    const { data, error } = await c.from('vokaboom_progress').select('student_id,set_id,data,updated_at').in('student_id', ids);
    if (error) throw error;
    (data || []).forEach((r) => { (map[r.student_id] = map[r.student_id] || {})[r.set_id] = { ...(r.data || {}), _at: r.updated_at }; });
  }
  klass.progress[cid] = map;
}
function classErrorText(e) {
  const msg = String(e?.message || e || ''), code = String(e?.code || '');
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /vokaboom_|does not exist|could not find/i.test(msg)) return 'Die Klassen sind in Supabase noch nicht eingerichtet: Bitte supabase/vokabelwelt.sql im SQL Editor nochmals ganz ausführen.';
  if (/class_full/.test(msg)) return 'In einer Klasse haben höchstens 60 Kinder Platz.';
  return cloudErrorText(e);
}

function openClasses() {
  if (!cloud.uid) { toast('Für Klassen brauchst du ein Konto. Melde dich zuerst an.'); openLogin(); return; }
  closeModal(true);
  ui.confirmDelete = null; klass.confirm = '';
  go('classes', { setId: null });
  loadClasses().then(() => { if (ui.view === 'classes') render(); });
}
function openClass(id, tab) {
  klass.tab = tab || klass.tab || 'kids'; klass.confirm = ''; klass.kidDetail = '';
  go('class', { classId: id, setId: null });
  if (klass.tab === 'stats') refreshStats();
}

function classesCrumbs() {
  const c = currentClass();
  return `<span class="crumb-sep" aria-hidden="true">/</span>${ui.view === 'class' ? '<button class="crumb" data-action="classes"><span>Klassen</span></button>' : '<span class="crumb current">Klassen</span>'}`
    + (ui.view === 'class' && c ? `<span class="crumb-sep sep-current" aria-hidden="true">/</span><span class="crumb current">${esc(c.name)}</span>` : '');
}

function renderClasses() {
  const v = $('#view');
  if (!cloud.uid) { ui.view = 'home'; render(); return; }
  const body = klass.error ? `<p class="banner bad">${icon('x')} ${esc(klass.error)}</p>`
    : !klass.loaded ? '<p class="muted"><span class="spinner"></span> Klassen werden geladen …</p>'
      : klass.list.length ? `<ul class="class-list">${klass.list.map((c) => {
        if (klass.confirm === c.id) {
          return `<li class="lib-item confirm"><span class="lib-text"><strong>Klasse „${esc(c.name)}“ löschen?</strong><small>Alle Logins und der Übungsstand dieser Klasse werden gelöscht.</small></span>
            <span class="lib-confirm"><button class="btn small danger" data-action="class-delete-yes" data-id="${c.id}">Löschen</button><button class="btn small ghost" data-action="class-delete-no">Behalten</button></span></li>`;
        }
        const n = studentsOf(c.id).length, m = (c.set_ids || []).length;
        return `<li class="lib-item"><button class="lib-open" data-action="class-open" data-id="${c.id}">
            <span class="class-badge" aria-hidden="true">${esc(c.name.slice(0, 3))}</span>
            <span class="lib-text"><strong>${esc(c.name)}</strong><small>${n} ${n === 1 ? 'Kind' : 'Kinder'} · ${m} ${m === 1 ? 'Portion' : 'Portionen'}</small></span></button>
          <button class="icon-btn subtle" data-action="class-delete" data-id="${c.id}" aria-label="Klasse „${esc(c.name)}“ löschen" title="Löschen">${icon('trash')}</button></li>`;
      }).join('')}</ul>` : '<p class="empty">Noch keine Klasse. Lege oben deine erste Klasse an.</p>';
  v.innerHTML = `<section class="classes-view">
    <div class="mode-bar"><h1 class="mode-title">Meine Klassen</h1></div>
    <div class="classes-grid">
      <form class="panel" id="new-class-form" autocomplete="off">
        <h2>Neue Klasse</h2>
        <label class="field" for="new-class"><span class="label">Name der Klasse</span><input id="new-class" type="text" maxlength="60" placeholder="z. B. 5a Englisch"></label>
        <button class="btn primary" type="submit">${icon('plus')} Klasse anlegen</button>
        <p class="hint">Danach trägst du die Kinder ein, wählst die Portionen aus und druckst die Login-Kärtchen.</p>
      </form>
      <div class="panel"><h2>Klassen</h2>${body}</div>
    </div>
    <p class="muted small privacy-note">${icon('check')} Gespeichert werden nur der Vorname und der erste Buchstabe des Nachnamens – keine E-Mail-Adressen der Kinder.</p>
  </section>`;
  $('#new-class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#new-class').value.trim();
    if (!name) { $('#new-class').focus(); return; }
    try {
      const c = await cloudClient();
      const { data, error } = await c.from('vokaboom_classes').insert({ name, set_ids: [] }).select('id,name,set_ids,created_at').single();
      if (error) throw error;
      klass.list.push(data);
      openClass(data.id, 'kids');
      toast(`Klasse „${name}“ angelegt. Trag jetzt die Kinder ein.`);
    } catch (ex) { toast(classErrorText(ex), 'bad'); }
  });
}

async function deleteClass(id) {
  try {
    const c = await cloudClient();
    const { error } = await c.from('vokaboom_classes').delete().eq('id', id);
    if (error) throw error;
    klass.list = klass.list.filter((x) => x.id !== id);
    delete klass.students[id];
    klass.confirm = '';
    render();
    toast('Klasse gelöscht.');
  } catch (e) { toast(classErrorText(e), 'bad'); }
}

/* ---------- Eine Klasse ---------- */
const CLASS_TABS = [['kids', 'user', 'Kinder'], ['sets', 'stack', 'Portionen'], ['cards', 'image', 'Kärtchen'], ['stats', 'check', 'Auswertung']];

function renderClass() {
  const v = $('#view');
  const c = currentClass();
  if (!klass.loaded) { v.innerHTML = '<p class="muted"><span class="spinner"></span> Wird geladen …</p>'; loadClasses().then(() => { if (ui.view === 'class') render(); }); return; }
  if (!c) { ui.view = 'classes'; render(); return; }
  const kids = studentsOf(c.id);
  let body = '';
  if (klass.tab === 'kids') body = classKidsHTML(c, kids);
  else if (klass.tab === 'sets') body = classSetsHTML(c);
  else if (klass.tab === 'cards') body = classCardsHTML(c, kids);
  else body = classStatsHTML(c, kids);
  v.innerHTML = `<section class="class-view">
    <div class="mode-bar class-bar">
      <h1 class="mode-title">${esc(c.name)}</h1>
      <button class="btn ghost small" data-action="class-rename">${icon('edit')} Umbenennen</button>
    </div>
    <div class="seg class-tabs" role="tablist" aria-label="Bereiche der Klasse">
      ${CLASS_TABS.map(([k, ic, t]) => `<button class="seg-btn" role="tab" data-action="class-tab" data-tab="${k}" aria-selected="${klass.tab === k}" aria-pressed="${klass.tab === k}">${icon(ic)}<span>${t}</span></button>`).join('')}
    </div>
    <div class="class-body">${body}</div>
  </section>`;
  if (klass.tab === 'kids') bindClassKids(c);
  if (klass.tab === 'sets') bindClassSets(c);
  if (klass.tab === 'cards') renderCardPreviews(c, kids);
}

function classKidsHTML(c, kids) {
  const rows = kids.map((s) => {
    if (klass.confirm === s.id) {
      return `<li class="kid-row confirm"><span><strong>${esc(kidName(s))} löschen?</strong> <small class="muted">Das Login und der Übungsstand werden gelöscht.</small></span>
        <span class="lib-confirm"><button class="btn small danger" data-action="kid-delete-yes" data-id="${s.id}">Löschen</button><button class="btn small ghost" data-action="kid-delete-no">Behalten</button></span></li>`;
    }
    return `<li class="kid-row">
      <span class="kid-av-big" aria-hidden="true">${kidWordImg(s.username)}</span>
      <span class="kid-who"><strong>${esc(kidName(s))}</strong><small>${esc(displayUser(s.username))}${einmaleinsLoginOf(s) ? ' <span class="e1-tag" title="Gleiches Kärtchen wie in Teilmal">auch in Teilmal</span>' : ''}</small></span>
      ${kidSecretOf(s) === 'password' ? `<span class="kid-pw-text" aria-label="Passwort">${esc(showPw(s.pw))}</span>`
        : kidSecretOf(s) === 'class' ? '<span class="kid-pw-text muted" title="Klassenpasswort">Klassenpasswort</span>'
          : `<span class="kid-pw" aria-label="Bilder-Passwort">${picsList(s.pics).map((i) => `<span>${kidPwImg(i)}</span>`).join('')}</span>`}
      <span class="kid-actions">
        <button class="icon-btn subtle" data-action="kid-newpics" data-id="${s.id}" title="Neues Passwort (neue Bilder)" aria-label="Neues Passwort für ${esc(kidName(s))}">${icon('shuffle')}</button>
        <button class="icon-btn subtle" data-action="kid-delete" data-id="${s.id}" title="Löschen" aria-label="${esc(kidName(s))} löschen">${icon('trash')}</button>
      </span>
    </li>`;
  }).join('');
  return `<div class="class-grid">
    <div class="panel">
      <h2>Kind hinzufügen</h2>
      <form id="add-kid-form" class="add-kid" autocomplete="off">
        <label class="field" for="kid-first"><span class="label">Vorname</span><input id="kid-first" type="text" maxlength="40" autocomplete="off" placeholder="Lena"></label>
        <label class="field initial-field" for="kid-initial"><span class="label">Nachname</span><input id="kid-initial" class="initial-box" type="text" maxlength="1" autocomplete="off" placeholder="M" aria-describedby="initial-hint"></label>
        <button class="btn primary" type="submit" id="add-kid-btn">${icon('plus')} Hinzufügen</button>
      </form>
      <p class="hint" id="initial-hint">Vom Nachnamen nur den ersten Buchstaben.</p>
      <details class="kid-import">
        <summary>Mehrere Kinder auf einmal (Liste einfügen)</summary>
        <textarea id="kid-import" rows="7" spellcheck="false" placeholder="Lena Meier&#10;Tim Keller&#10;Noah"></textarea>
        <p class="hint">Eine Zeile pro Kind: Vorname und Nachname. Gespeichert wird nur der erste Buchstabe des Nachnamens. Eine Liste aus Excel kannst du direkt einfügen.</p>
        <div id="kid-import-preview" class="muted small"></div>
        <button class="btn secondary" type="button" data-action="kid-import">${icon('plus')} Alle hinzufügen</button>
      </details>
    </div>
    <div class="panel">
      <h2>${kids.length} ${kids.length === 1 ? 'Kind' : 'Kinder'}</h2>
      ${kids.length ? `<ul class="kid-list">${rows}</ul>
        <div class="row"><button class="btn primary" data-action="class-tab" data-tab="cards">${icon('image')} Login-Kärtchen ansehen</button></div>`
        : '<p class="empty">Noch keine Kinder. Trag links die Namen ein.</p>'}
    </div>
  </div>`;
}

/** „Lena Meier“, „Tim K.“, „Keller, Tim“ (mit Komma: Nachname zuerst) → { first, initial } */
function parseKidLine(line) {
  let l = line.replace(/\s+/g, ' ').trim();
  if (!l) return null;
  let first = '', last = '';
  const parts = l.split(/\t|;/).map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) { first = parts[0]; last = parts[1]; }
  else if (l.includes(',')) { const [a, b] = l.split(',').map((x) => x.trim()); first = b || a; last = b ? a : ''; }
  else { const t = l.split(' '); first = t.slice(0, Math.max(1, t.length - 1)).join(' '); last = t.length > 1 ? t[t.length - 1] : ''; }
  first = first.slice(0, 40);
  const initial = (last.match(/\p{L}/u) || [''])[0].toUpperCase();
  return first ? { first, initial } : null;
}

function bindClassKids(c) {
  const form = $('#add-kid-form');
  const ini = $('#kid-initial');
  ini?.addEventListener('input', () => { ini.value = (ini.value.match(/\p{L}/u) || [''])[0].toUpperCase(); });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = $('#kid-first').value.trim();
    if (!first) { $('#kid-first').focus(); return; }
    await addKids(c, [{ first, initial: ini.value.trim() }]);
    setTimeout(() => $('#kid-first')?.focus(), 30);
  });
  const ta = $('#kid-import');
  ta?.addEventListener('input', () => {
    const list = ta.value.split(/\r?\n/).map(parseKidLine).filter(Boolean);
    $('#kid-import-preview').textContent = list.length ? `${list.length} erkannt: ${list.slice(0, 8).map((k) => `${k.first}${k.initial ? ` ${k.initial}.` : ''}`).join(', ')}${list.length > 8 ? ' …' : ''}` : '';
  });
}

async function addKids(c, list) {
  if (!list.length || klass.busy) return;
  klass.busy = true;
  try {
    const cl = await cloudClient();
    const { data, error } = await cl.rpc('vokaboom_add_students', { p_class: c.id, p_students: list });
    if (error) throw error;
    const arr = klass.students[c.id] = klass.students[c.id] || [];
    (data || []).forEach((s) => arr.push(s));
    arr.sort((a, b) => a.first_name.localeCompare(b.first_name, 'de'));
    render();
    toast(list.length === 1 ? `${list[0].first} ist dabei.` : `${(data || []).length} Kinder hinzugefügt.`);
  } catch (e) { toast(classErrorText(e), 'bad'); } finally { klass.busy = false; }
}

/** Klassenpasswort (eines für alle Kinder der Klasse); leer = keines */
async function saveClassPw(cid, raw) {
  const c = klass.list.find((x) => x.id === cid);
  if (!c) return false;
  const v = String(raw || '').trim().slice(0, 40);
  if (v && v.replace(/[^a-z0-9äöü]/gi, '').length < 4) { toast('Das Klassenpasswort braucht mindestens 4 Buchstaben oder Zahlen.', 'bad'); return false; }
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('vokaboom_classes').update({ class_pw: v || null }).eq('id', cid);
    if (error) throw error;
    c.class_pw = v || null;
    return true;
  } catch (e) {
    toast(/class_pw/.test(e?.message || '') ? 'Dafür zuerst supabase/vokabelwelt.sql in Supabase nochmals ausführen.' : classErrorText(e), 'bad');
    return false;
  }
}
function randomPics() {
  const all = [...Array(12).keys()];
  for (let i = all.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, 3).join(',');
}
async function kidNewPics(id) {
  const c = currentClass();
  const s = studentsOf(c?.id).find((x) => x.id === id);
  if (!s) return;
  let pics = randomPics();
  while (pics === s.pics) pics = randomPics();
  const pw = newKidPw();
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('vokaboom_students').update(s.pw ? { pics, pw, ...('pw_prev' in s ? { pw_prev: null } : {}) } : { pics }).eq('id', id); // altes Kärtchen gilt nicht mehr
    if (error) throw error;
    s.pics = pics; if (s.pw) s.pw = pw; if ('pw_prev' in s) s.pw_prev = null;
    render();
    toast(`${kidName(s)} hat ein neues Passwort und neue Bilder. Das alte Kärtchen gilt nicht mehr – druck ein neues aus.`);
  } catch (e) { toast(classErrorText(e), 'bad'); }
}
async function kidDelete(id) {
  const c = currentClass();
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('vokaboom_students').delete().eq('id', id);
    if (error) throw error;
    klass.students[c.id] = studentsOf(c.id).filter((x) => x.id !== id);
    klass.confirm = '';
    render();
  } catch (e) { toast(classErrorText(e), 'bad'); }
}

function classSetsHTML(c) {
  const sets = db.sets.filter((s) => !s.shareId || (c.set_ids || []).includes(s.id));
  const missing = (c.set_ids || []).filter((id) => !getSet(id));
  return `<div class="panel">
    <h2>Welche Portionen sieht die Klasse?</h2>
    <p class="hint">Die Kinder sehen nur die angehakten Portionen – mit allen Übungen, aber ohne Bearbeiten. Änderst du eine Portion, haben die Kinder die neue Version beim nächsten Öffnen.</p>
    ${sets.length ? `<ul class="set-pick">${sets.map((s) => `<li><label class="set-pick-item">
        <input type="checkbox" data-set="${s.id}" ${(c.set_ids || []).includes(s.id) ? 'checked' : ''}>
        <span><strong>${flag(s.lang)} ${esc(s.name)}</strong><small>${LANGS[langOf(s)].name} · ${s.words.length} Vokabeln${!cloud.synced[s.id] ? ' · wird noch ins Konto gespeichert' : ''}</small></span>
      </label>${(c.set_ids || []).includes(s.id) ? kidRulesHTML(c, s) : ''}</li>`).join('')}</ul>` : '<p class="empty">Du hast noch keine Portion. Erstelle zuerst auf der Startseite eine.</p>'}
    ${missing.length ? `<p class="muted small">${missing.length} freigegebene ${missing.length === 1 ? 'Portion gibt' : 'Portionen gibt'} es nicht mehr. <button class="link-btn" data-action="class-clean-sets">Entfernen</button></p>` : ''}
  </div>
  ${classReviewHTML(c)}`;
}
/** Wiederholen nach der Vergessenskurve: wie die Kinder antworten */
function classReviewHTML(c) {
  const mode = reviewMode(c);
  const auto = !(c.settings?.review);
  return `<div class="panel rv-setting">
    <h2>🧠 Wiederholen</h2>
    <p class="hint">Vokaboom erinnert die Kinder auf ihrer Startseite an Wörter, die sie wieder anschauen sollten – nach 1 Tag, 3 Tagen, 1 Woche, 2 Wochen und 1 Monat (Vergessenskurve). Falsch beantwortete Wörter kommen am nächsten Tag nochmals.</p>
    <div class="field"><span class="label">So antworten die Kinder beim Wiederholen</span>
      <div class="seg" role="group" aria-label="Antwortart beim Wiederholen">
        <button type="button" class="seg-btn" data-action="class-review" data-mode="type" aria-pressed="${mode === 'type'}">⌨️ Eintippen</button>
        <button type="button" class="seg-btn" data-action="class-review" data-mode="choice" aria-pressed="${mode === 'choice'}">👆 Auswählen (aus 4)</button>
      </div>
      <small class="muted">${mode === 'type' ? 'Deutsch sehen, Wort in der Fremdsprache schreiben – automatisch geprüft (empfohlen ab der 5. Klasse).' : 'Deutsch sehen, das richtige Wort aus 4 auswählen – gut für die 3. und 4. Klasse.'}${auto ? ' Automatisch gewählt nach dem Klassennamen.' : ''}</small></div>
    ${klass.noSettings ? '<p class="banner bad small">Damit die Einstellung bei den Kindern ankommt, zuerst <code>supabase/vokabelwelt.sql</code> in Supabase nochmals ausführen.</p>' : ''}
  </div>`;
}
async function saveClassReview(c, mode) {
  const settings = { ...(c.settings || {}), review: mode };
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('vokaboom_classes').update({ settings }).eq('id', c.id);
    if (error) throw error;
    c.settings = settings;
    toast(mode === 'type' ? 'Die Kinder tippen die Wörter beim Wiederholen ein.' : 'Die Kinder wählen die Wörter beim Wiederholen aus.');
  } catch (e) { toast(/settings/.test(e?.message || '') ? 'Dafür zuerst supabase/vokabelwelt.sql in Supabase nochmals ausführen.' : classErrorText(e), 'bad'); }
  render();
}
/* ---------- Ausnahmen: Portion oder einzelne Spiele für einzelne Kinder ausschalten ---------- */
const kidRule = (c, kidId) => (c.rules || {})[kidId] || {};
const kidHidesSet = (c, kidId, setId) => (kidRule(c, kidId).h || []).includes(setId);
const kidGamesOff = (c, kidId, setId) => kidRule(c, kidId).g?.[setId] || [];
function kidRulesHTML(c, set) {
  const kids = studentsOf(c.id);
  if (!kids.length) return '';
  if (klass.noRules) return `<p class="muted small kid-rules-note">Einzelne Kinder ausnehmen: Bitte zuerst das SQL-Skript in Supabase nochmals ausführen (siehe Anleitung).</p>`;
  const games = typeof gamesOn === 'function' ? gamesOn(set) : [];
  const hidden = kids.filter((k) => kidHidesSet(c, k.id, set.id)).length;
  const fewer = kids.filter((k) => !kidHidesSet(c, k.id, set.id) && kidGamesOff(c, k.id, set.id).some((g) => games.some((x) => x.id === g))).length;
  const sum = [hidden ? `${hidden} ohne diese Portion` : '', fewer ? `${fewer} mit weniger Spielen` : ''].filter(Boolean).join(' · ') || 'alle Kinder haben alles';
  return `<details class="kid-rules" data-set="${set.id}" ${klass.openRules?.has(set.id) ? 'open' : ''}>
    <summary>${icon('sliders')} Für einzelne Kinder anpassen <small class="muted">(${sum})</small></summary>
    <div class="kr-scroll"><table class="kr-table">
      <thead><tr><th scope="col">Kind</th><th scope="col">Sieht die Portion</th>${games.map((g) => `<th scope="col" class="kr-game" title="${esc(g.name)}"><span aria-hidden="true">${g.art}</span><small>${esc(g.name)}</small></th>`).join('')}</tr></thead>
      <tbody>${kids.map((k) => {
        const hid = kidHidesSet(c, k.id, set.id), off = new Set(kidGamesOff(c, k.id, set.id));
        return `<tr class="${hid ? 'kr-hidden' : ''}"><th scope="row">${kidWordImg(k.username, 'kid-mini')}${esc(kidName(k))}</th>
          <td><input type="checkbox" class="kr-cb" data-kr="h" data-kid="${k.id}" data-set="${set.id}" ${hid ? '' : 'checked'} aria-label="${esc(kidName(k))} sieht ${esc(set.name)}"></td>
          ${games.map((g) => `<td><input type="checkbox" class="kr-cb" data-kr="g" data-game="${g.id}" data-kid="${k.id}" data-set="${set.id}" ${off.has(g.id) ? '' : 'checked'} ${hid ? 'disabled' : ''} aria-label="${esc(kidName(k))}: ${esc(g.name)}"></td>`).join('')}
        </tr>`;
      }).join('')}</tbody></table></div>
    <p class="hint">Häkchen weg = dieses Kind bekommt die Portion bzw. dieses Spiel nicht. ${games.length < (typeof GAMES === 'object' ? GAMES.length : 0) ? 'Spiele, die du für die ganze Portion ausgeschaltet hast, fehlen hier.' : ''}</p>
  </details>`;
}
function setKidRule(c, kidId, fn) {
  const rules = structuredClone(c.rules || {});
  const r = rules[kidId] || {};
  fn(r);
  if (!r.h?.length) delete r.h;
  if (r.g) { Object.keys(r.g).forEach((sid) => { if (!r.g[sid]?.length) delete r.g[sid]; }); if (!Object.keys(r.g).length) delete r.g; }
  if (Object.keys(r).length) rules[kidId] = r; else delete rules[kidId];
  c.rules = rules;
}
let rulesTimer = null;
function saveClassRulesSoon(c) {
  clearTimeout(rulesTimer);
  rulesTimer = setTimeout(async () => {
    try {
      const cl = await cloudClient();
      const { error } = await cl.from('vokaboom_classes').update({ rules: c.rules || {} }).eq('id', c.id);
      if (error) throw error;
      toast('Gespeichert.');
    } catch (e) { toast(classErrorText(e), 'bad'); }
  }, 500);
}
function bindKidRules(c) {
  $$('.kid-rules').forEach((d) => d.addEventListener('toggle', () => {
    klass.openRules = klass.openRules || new Set();
    if (d.open) klass.openRules.add(d.dataset.set); else klass.openRules.delete(d.dataset.set);
  }));
  $$('.kr-cb').forEach((cb) => cb.addEventListener('change', () => {
    const { kr, kid, set, game } = cb.dataset;
    setKidRule(c, kid, (r) => {
      if (kr === 'h') {
        const h = new Set(r.h || []);
        if (cb.checked) h.delete(set); else h.add(set);
        r.h = [...h];
      } else {
        r.g = r.g || {};
        const g = new Set(r.g[set] || []);
        if (cb.checked) g.delete(game); else g.add(game);
        r.g[set] = [...g];
      }
    });
    saveClassRulesSoon(c);
    if (kr === 'h') render();
    else { const sm = cb.closest('.kid-rules')?.querySelector('summary small'); const st = getSet(set); if (sm && st) sm.outerHTML = kidRulesHTML(c, st).match(/<small class="muted">[^<]*<\/small>/)[0]; }
  }));
}
function bindClassSets(c) {
  bindKidRules(c);
  $$('.set-pick-item > input').forEach((cb) => cb.addEventListener('change', async () => {
    const ids = new Set(c.set_ids || []);
    if (cb.checked) ids.add(cb.dataset.set); else ids.delete(cb.dataset.set);
    const order = [...db.sets.map((s) => s.id).filter((id) => ids.has(id)), ...[...ids].filter((id) => !getSet(id))];
    await saveClassSets(c, order);
    if (cb.checked && !cloud.synced[cb.dataset.set]) cloudSync();
    if (ui.view === 'class' && klass.tab === 'sets') render(); // Bereich für einzelne Kinder ein-/ausblenden
  }));
}
async function saveClassSets(c, ids) {
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('vokaboom_classes').update({ set_ids: ids }).eq('id', c.id);
    if (error) throw error;
    c.set_ids = ids;
    toast('Gespeichert.');
  } catch (e) { toast(classErrorText(e), 'bad'); render(); }
}
async function renameClass() {
  const c = currentClass();
  if (!c) return;
  const name = (prompt('Neuer Name der Klasse:', c.name) || '').trim().slice(0, 60);
  if (!name || name === c.name) return;
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('vokaboom_classes').update({ name }).eq('id', c.id);
    if (error) throw error;
    c.name = name; render();
  } catch (e) { toast(classErrorText(e), 'bad'); }
}

/* ---------- Login-Kärtchen ---------- */
const OLD_PW_NOTE = '<p class="banner bad small">Die Passwörter haben noch das alte Format (z. B. „Rot-kuh-78“). Bitte <code>supabase/vokabelwelt.sql</code> in Supabase im SQL Editor nochmals ganz ausführen – dann bekommen alle Kinder einfache Passwörter wie „Teich23“. Danach Seite neu laden.</p>';
function classCardsHTML(c, kids) {
  if (!kids.length) return '<div class="panel"><p class="empty">Noch keine Kinder in dieser Klasse.</p></div>';
  return `<div class="panel">
    ${klass.oldPw && kidSecretOf(kids[0]) === 'password' ? OLD_PW_NOTE : ''}
    <div class="cards-head">
      <div><h2>Login-Kärtchen</h2>
        <p class="hint">Ausdrucken, ausschneiden und verteilen. Anmelden: QR-Code scannen – oder Benutzername eintippen und die 3 Bilder der Reihe nach antippen – oder mit Passwort, wenn du das im Menü so eingestellt hast.</p>
        <p class="hint">Die Kärtchen sind neutral, ohne Logo. ${kids.some((x) => einmaleinsLoginOf(x)) ? 'Kinder, die auch in Teilmal sind, haben einen QR-Code für beide Tools: Beim Scannen wählen sie <strong>bei Vokaboom</strong> oder <strong>bei Teilmal</strong>. Kinder, die nur in Vokaboom sind, kommen direkt dorthin.' : 'Der QR-Code <strong>ABC Vokabeln</strong> öffnet Vokaboom.'}</p></div>
      <span class="row"><button class="btn secondary" data-action="menu-sec" data-sec="klassen">${icon('sliders')} Kärtchen anpassen</button>
      <button class="btn primary" data-action="cards-pdf" id="cards-pdf">${icon('down')} PDF herunterladen</button></span>
    </div>
    <div class="card-previews">${kids.map((s) => `<figure class="card-prev" data-sid="${s.id}"><span class="spinner"></span></figure>`).join('')}</div>
  </div>`;
}

const CARD_W = 85, CARD_H = 54; // mm, wie eine Kreditkarte
const CARD_COLORS = [['#4F46E5', '#EEF0FF'], ['#DB2777', '#FDE7F1'], ['#D97706', '#FFF2D9'], ['#0891B2', '#DDF6FB'], ['#059669', '#DCF7EC'], ['#7C3AED', '#F1EAFF'], ['#E8730C', '#FFEDD8'], ['#0E7490', '#DFF5F9'], ['#BE185D', '#FCE7F3'], ['#4D7C0F', '#ECFCCB']];
function cardColor(username) {
  let h = 0;
  for (const ch of String(username)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_COLORS[h % CARD_COLORS.length];
}
const cardImgCache = new Map();
function svgImage(svg) {
  if (cardImgCache.has(svg)) return cardImgCache.get(svg);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = kidSvgURL(svg);
  });
  cardImgCache.set(svg, p);
  return p;
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fitText(ctx, text, maxW, font, size) {
  let s = size;
  ctx.font = font(s);
  while (s > size * 0.55 && ctx.measureText(text).width > maxW) { s *= 0.94; ctx.font = font(s); }
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function drawQR(ctx, url, qx, qy, qs, X, Y, L) {
  ctx.fillStyle = '#fff'; ctx.fillRect(X(qx), Y(qy), L(qs), L(qs));
  try {
    const q = qrcode(0, 'M'); q.addData(url, 'Byte'); q.make();
    const n = q.getModuleCount(), m = 1, cell = qs / (n + m * 2);
    ctx.fillStyle = '#1E293B';
    for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) {
      if (q.isDark(r, cc)) ctx.fillRect(Math.floor(X(qx + (cc + m) * cell)), Math.floor(Y(qy + (r + m) * cell)), Math.ceil(L(cell)), Math.ceil(L(cell)));
    }
  } catch { /* */ }
}
/**
 * Zeichnet ein Login-Kärtchen (x, y in mm; s = Pixel pro mm). Ohne Logo und ohne Namen eines Tools:
 * Es gilt für alle Tools, in denen das Kind dasselbe Login hat. Ein QR-Code: bei Kindern in beiden Tools mit der Frage
 * „bei Vokaboom“ oder „bei Teilmal“ (#w=…), sonst direkt ins Tool (#k=…). Gleiches Kärtchen in Vokaboom und Teilmal.
 * Aufbau: oben „Login-Kärtchen“ (und Klasse), rechts der Name bzw. die Initialen; links Benutzername und Passwort
 * untereinander, rechts unten der QR-Code.
 */
async function drawKidCard(ctx, x, y, s, st, className) {
  const [accent, wash] = cardColor(st.username);
  const X = (mm) => (x + mm) * s, Y = (mm) => (y + mm) * s, L = (mm) => mm * s;
  const disp = "'Bricolage Grotesque', Lexend, system-ui, sans-serif", body = 'Lexend, system-ui, sans-serif';
  const cc = { ...(typeof cardCfg === 'function' ? cardCfg() : { names: 'full', qr: true, cls: true }), secret: kidSecretOf(st) };
  const both = cc.qr && !!einmaleinsLoginOf(st);
  const colW = cc.qr ? 48 : CARD_W - 8; // Breite der linken Spalte (Benutzername, Passwort)
  ctx.save();
  // Karte: weiss, runde Ecken, feiner Rand, zwei weiche Farbflächen
  rrect(ctx, X(0), Y(0), L(CARD_W), L(CARD_H), L(4));
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = wash;
  ctx.beginPath(); ctx.arc(X(CARD_W + 4), Y(-6), L(27), 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(X(-7), Y(CARD_H + 9), L(17), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  rrect(ctx, X(0), Y(0), L(CARD_W), L(CARD_H), L(4));
  ctx.lineWidth = L(0.25); ctx.strokeStyle = '#E2E8F0'; ctx.stroke();
  // Kopf: „Login-Kärtchen“ als Pille (daneben die Klasse), rechts der Name bzw. die Initialen
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `800 ${L(2.6)}px ${disp}`;
  const pillW = ctx.measureText('Login-Kärtchen').width + L(4.4);
  rrect(ctx, X(4), Y(4), pillW, L(5.4), L(2.7)); ctx.fillStyle = accent; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText('Login-Kärtchen', X(4) + L(2.2), Y(7.65));
  ctx.font = `800 ${L(4)}px ${disp}`;
  const who = fitText(ctx, cc.names === 'initials' ? kidInitials(st) : kidName(st), L(32), (z) => `800 ${z}px ${disp}`, L(4));
  const whoW = ctx.measureText(who).width;
  ctx.textAlign = 'right'; ctx.fillStyle = '#1E293B'; ctx.fillText(who, X(CARD_W - 4.5), Y(8.2));
  if (cc.cls) {
    ctx.textAlign = 'left'; ctx.fillStyle = '#64748B';
    const room = X(CARD_W - 4.5) - whoW - L(3) - (X(4) + pillW + L(2));
    if (room > L(6)) ctx.fillText(fitText(ctx, className, room, (z) => `600 ${z}px ${body}`, L(2.5)), X(4) + pillW + L(2), Y(7.6));
  }
  ctx.textAlign = 'left';
  // Links: Benutzername und Passwort untereinander
  const label = (t, yy) => { ctx.fillStyle = '#94A3B8'; ctx.font = `600 ${L(2.2)}px ${body}`; ctx.fillText(t, X(4), Y(yy)); };
  label('Benutzername', 17);
  ctx.fillStyle = accent;
  ctx.fillText(fitText(ctx, displayUser(st.username), L(colW), (z) => `800 ${z}px ${disp}`, L(6.6)), X(4), Y(24.6));
  const pics = picsList(st.pics);
  if (cc.secret === 'password' || cc.secret === 'class') {
    const pwTxt = cc.secret === 'class' ? klass.list.find((c) => c.id === st.class_id)?.class_pw || '' : showPw(st.pw);
    label(cc.secret === 'class' ? 'Passwort (für die ganze Klasse)' : 'Passwort', 32.2);
    const t = fitText(ctx, pwTxt, L(colW - 6), (z) => `700 ${z}px ui-monospace, Menlo, Consolas, monospace`, L(5));
    const tw = ctx.measureText(t).width;
    rrect(ctx, X(4), Y(34.4), tw + L(6), L(10.4), L(3.2));
    ctx.fillStyle = wash; ctx.fill(); ctx.lineWidth = L(0.35); ctx.strokeStyle = accent; ctx.stroke();
    ctx.fillStyle = '#1E293B'; ctx.fillText(t, X(7), Y(41.4));
  } else {
    label('Passwort: diese 3 Bilder antippen', 32.2);
    for (let k = 0; k < 3; k++) {
      const bx = 4 + k * 13, by = 34.4;
      rrect(ctx, X(bx), Y(by), L(11), L(11), L(3));
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = L(0.4); ctx.strokeStyle = accent; ctx.stroke();
      const im = pics[k] != null ? await svgImage(KID_PW[pics[k]].svg) : null;
      if (im) ctx.drawImage(im, X(bx + 1.7), Y(by + 1.7), L(7.6), L(7.6));
      ctx.beginPath(); ctx.arc(X(bx + 0.6), Y(by + 0.6), L(1.9), 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${L(2.4)}px ${body}`; ctx.textAlign = 'center';
      ctx.fillText(String(k + 1), X(bx + 0.6), Y(by + 1.45)); ctx.textAlign = 'left';
    }
  }
  ctx.restore();
  if (cc.qr) drawCardQR(ctx, st, both, X, Y, L);
}
/** Ein grosser QR-Code rechts unten in einem weissen Rahmen, ohne Text darunter */
function drawCardQR(ctx, st, both, X, Y, L) {
  ctx.save();
  rrect(ctx, X(55), Y(23.5), L(26.5), L(26.5), L(3.4));
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = L(0.3); ctx.strokeStyle = '#E2E8F0'; ctx.stroke();
  drawQR(ctx, cardQrUrl(st, both), 55.75, 24.25, 25, X, Y, L);
  ctx.restore();
}
async function cardFontsReady() {
  try { await Promise.all(["800 20px 'Bricolage Grotesque'", '600 20px Lexend', '500 20px Lexend'].map((f) => document.fonts.load(f))); } catch { /* */ }
}
async function renderCardPreviews(c, kids) {
  await cardFontsReady();
  for (const st of kids) {
    const fig = $(`.card-prev[data-sid="${st.id}"]`);
    if (!fig || ui.view !== 'class' || klass.tab !== 'cards') return;
    const s = 8;
    const cv = document.createElement('canvas');
    cv.width = Math.round(CARD_W * s); cv.height = Math.round(CARD_H * s);
    await drawKidCard(cv.getContext('2d'), 0, 0, s, st, c.name);
    fig.innerHTML = `<img src="${cv.toDataURL('image/png')}" alt="Login-Kärtchen für ${esc(kidName(st))}">`;
  }
}

/** PDF (A4, 10 Kärtchen pro Seite) aus Bildern der Seiten – ohne Zusatzbibliothek */
async function downloadCardsPDF() {
  const c = currentClass();
  const kids = studentsOf(c?.id);
  if (!kids.length) return;
  const btn = $('#cards-pdf');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> PDF wird erstellt …'; }
  try {
    await cardFontsReady();
    const s = 11.81; // 300 dpi
    const PW = 210, PH = 297, cols = 2, rows = 5, gx = 6, gy = 3;
    const x0 = (PW - cols * CARD_W - (cols - 1) * gx) / 2, y0 = (PH - rows * CARD_H - (rows - 1) * gy) / 2;
    const pages = [];
    for (let i = 0; i < kids.length; i += cols * rows) {
      const cv = document.createElement('canvas');
      cv.width = Math.round(PW * s); cv.height = Math.round(PH * s);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      const batch = kids.slice(i, i + cols * rows);
      for (let k = 0; k < batch.length; k++) {
        const cx = x0 + (k % cols) * (CARD_W + gx), cy = y0 + Math.floor(k / cols) * (CARD_H + gy);
        await drawKidCard(ctx, cx, cy, s, batch[k], c.name);
      }
      const url = cv.toDataURL('image/jpeg', 0.9);
      const bin = atob(url.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      pages.push({ jpeg: bytes, w: cv.width, h: cv.height });
    }
    const blob = buildPDF(pages);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Logins-${c.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'Klasse'}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast('PDF heruntergeladen.');
  } catch (e) {
    toast('Das PDF konnte nicht erstellt werden.', 'bad');
  } finally {
    const b = $('#cards-pdf');
    if (b) { b.disabled = false; b.innerHTML = `${icon('down')} PDF herunterladen`; }
  }
}
function buildPDF(pages) {
  const enc = new TextEncoder();
  const chunks = [], offs = [];
  let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
  const W = 595.28, H = 841.89;
  const obj = (id, fill) => { offs[id] = len; push(`${id} 0 obj\n`); fill(); push('\nendobj\n'); };
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${pages.length} >>`));
  pages.forEach((p, i) => {
    const id = 3 + 3 * i;
    obj(id, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(id + 1, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(id + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg); push('\nendstream');
    });
  });
  const xref = len, count = 3 + 3 * pages.length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offs[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}

/* ---------- Auswertung ---------- */
async function refreshStats() {
  const c = currentClass();
  if (!c) return;
  klass.statsLoading = true; klass.statsError = '';
  if (ui.view === 'class' && klass.tab === 'stats') render();
  try { await loadClassProgress(c.id); } catch (e) { klass.statsError = classErrorText(e); }
  klass.statsLoading = false;
  if (ui.view === 'class' && klass.tab === 'stats') render();
}

/** Zahlen eines Kindes zu einer Portion */
function kidSetStats(p, set) {
  if (!p) return null;
  const ids = new Set((set?.words || []).map((w) => w.id));
  let n = 0, bad = 0, almost = 0, words = 0, last = 0;
  Object.entries(p.words || {}).forEach(([wid, s]) => {
    if (set && !ids.has(wid)) return;
    if (!s || !s.n) return;
    words++; n += s.n; bad += s.bad || 0; almost += s.almost || 0; last = Math.max(last, s.t || 0);
  });
  const steps = ['cards', 'speak', 'dictation', 'test'].filter((k) => p[k]).length; // Spiele (auch Memory) zählen nicht
  return { n, bad, words, total: set ? set.words.length : words, acc: n ? (n - bad - almost * 0.5) / n : null, test: p.test?.best ?? null, steps, last: last || Date.parse(p._at || '') || 0 };
}
const pctTxt = (x) => (x == null ? '–' : `${Math.round(x * 100)} %`);
const accClass = (x) => (x == null ? '' : x >= 0.85 ? 'good' : x >= 0.65 ? 'mid' : 'low');
function fmtDay(t) {
  if (!t) return '';
  const d = new Date(t), now = new Date();
  const days = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  return days === 0 ? 'heute' : days === 1 ? 'gestern' : days < 7 ? `vor ${days} Tagen` : d.toLocaleDateString('de-CH', { day: 'numeric', month: 'numeric' });
}

/** Schwierigkeit pro Wort über alle Kinder */
function wordDifficulty(c, setIds) {
  const prog = klass.progress[c.id] || {};
  const out = [];
  for (const sid of setIds) {
    const set = getSet(sid);
    if (!set) continue;
    for (const w of set.words) {
      let n = 0, bad = 0, kidsTried = 0, kidsBad = 0;
      for (const st of studentsOf(c.id)) {
        const s = prog[st.id]?.[sid]?.words?.[w.id];
        if (!s || !s.n) continue;
        kidsTried++; n += s.n; bad += s.bad || 0; if (s.bad) kidsBad++;
      }
      out.push({ set, w, n, bad, kidsTried, kidsBad, rate: n ? bad / n : 0 });
    }
  }
  return out.filter((x) => x.n).sort((a, b) => b.rate - a.rate || b.kidsBad - a.kidsBad || b.n - a.n);
}

function classStatsHTML(c, kids) {
  const prog = klass.progress[c.id];
  const sets = (c.set_ids || []).map(getSet).filter(Boolean);
  const head = `<div class="stats-head"><h2>Auswertung</h2><button class="btn small ghost" data-action="stats-refresh">${icon('flip')} Aktualisieren</button></div>`;
  if (klass.statsError) return `<div class="panel">${head}<p class="banner bad">${icon('x')} ${esc(klass.statsError)}</p></div>`;
  if (!prog) return `<div class="panel">${head}<p class="muted"><span class="spinner"></span> Wird geladen …</p></div>`;
  if (!kids.length || !sets.length) return `<div class="panel">${head}<p class="empty">${!kids.length ? 'Noch keine Kinder in dieser Klasse.' : 'Noch keine Portion freigegeben (Bereich „Portionen“).'}</p></div>`;

  const matrix = `<div class="stat-scroll"><table class="stat-table">
    <thead><tr><th scope="col">Kind</th><th scope="col" title="Wiederholen nach der Vergessenskurve">🧠 Wiederholen</th>${sets.map((s) => `<th scope="col">${esc(s.name)}</th>`).join('')}</tr></thead>
    <tbody>${kids.map((st) => `<tr class="${klass.kidDetail === st.id ? 'sel' : ''}">
      <th scope="row"><button class="link-btn kid-link" data-action="stats-kid" data-id="${st.id}">${kidWordImg(st.username, 'kid-mini')}${esc(kidName(st))}</button></th>
      ${(() => {
        const r = kidSrsStats(prog[st.id], sets);
        if (!r.inBox) return '<td class="cell empty">–</td>';
        const stale = r.due && (!r.last || Date.now() - r.last > 4 * 864e5);
        return `<td class="cell rv-cell ${stale ? 'stale' : ''}" title="${r.inBox} Wörter im Kasten">
          <b>${r.due ? `${r.due} fällig` : 'nichts fällig'}</b><small>${r.safe} sicher</small><small class="muted">${r.last ? `wiederholt ${fmtDay(r.last)}` : 'noch nie wiederholt'}</small></td>`;
      })()}
      ${sets.map((set) => {
        const k = kidSetStats(prog[st.id]?.[set.id], set);
        if (kidHidesSet(c, st.id, set.id)) return '<td class="cell empty" title="Für dieses Kind ausgeschaltet"><small>ausgenommen</small></td>';
        if (!k || !k.n) return '<td class="cell empty">–</td>';
        return `<td class="cell ${accClass(k.acc)}" title="${k.n} Antworten, ${k.bad} falsch">
          <b>${pctTxt(k.acc)}</b><small>${k.words}/${k.total} Wörter · ${k.steps}/4 Übungen${k.test != null ? ` · Test ${k.test} %` : ''}</small><small class="muted">${fmtDay(k.last)}</small></td>`;
      }).join('')}
    </tr>`).join('')}</tbody></table></div>
    <p class="muted small">Prozent = Anteil richtiger Antworten in allen Übungen (fast richtig zählt halb). Tippe auf ein Kind für seine schwierigsten Wörter.
      🧠 Wiederholen: „fällig“ = Wörter, die das Kind heute wiederholen sollte; „sicher“ = im 5. Fach (sitzt seit über 2 Wochen). Rot = fällige Wörter und seit mehr als 4 Tagen nicht wiederholt.</p>`;

  let detail = '';
  const st = kids.find((x) => x.id === klass.kidDetail);
  if (st) {
    detail = `<div class="panel kid-detail"><div class="stats-head"><h3>${kidWordImg(st.username, 'kid-mini')} ${esc(kidName(st))}</h3><button class="icon-btn subtle" data-action="stats-kid" data-id="" aria-label="Schließen">${icon('x')}</button></div>
      ${sets.map((set) => {
        const p = prog[st.id]?.[set.id];
        const k = kidSetStats(p, set);
        if (!k || !k.n) return `<div class="kd-set"><h4>${esc(set.name)}</h4><p class="muted small">Noch nicht geübt.</p></div>`;
        const hard = set.words.map((w) => ({ w, s: p.words?.[w.id] })).filter((x) => x.s && x.s.bad)
          .sort((a, b) => b.s.bad / b.s.n - a.s.bad / a.s.n || b.s.bad - a.s.bad).slice(0, 8);
        return `<div class="kd-set"><h4>${esc(set.name)} <span class="pill ${accClass(k.acc)}">${pctTxt(k.acc)}</span></h4>
          <p class="small muted">${k.words} von ${k.total} Wörtern geübt · ${k.steps} von 4 Übungen${k.test != null ? ` · bester Test ${k.test} %` : ''}</p>
          ${hard.length ? `<ul class="hw-list">${hard.map(({ w, s }) => `<li class="hw"><span class="hw-word"><strong lang="en">${esc(w.foreign)}</strong> <span class="muted">${esc(w.german)}</span></span><span class="hw-tag">${s.bad}× falsch von ${s.n}</span></li>`).join('')}</ul>` : '<p class="small">Keine Fehler. 🎉</p>'}
        </div>`;
      }).join('')}</div>`;
  }

  const sel = klass.statSet && (klass.statSet === 'all' || sets.some((s) => s.id === klass.statSet)) ? klass.statSet : sets[0].id;
  const diff = wordDifficulty(c, sel === 'all' ? sets.map((s) => s.id) : [sel]);
  const words = `<div class="panel">
    <div class="stats-head"><h3>Schwierigste Wörter der Klasse</h3>
      <select id="stat-set" aria-label="Portion">${sets.length > 1 ? `<option value="all" ${sel === 'all' ? 'selected' : ''}>Alle Portionen</option>` : ''}${sets.map((s) => `<option value="${s.id}" ${sel === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    ${diff.length ? `<ol class="diff-list">${diff.slice(0, 40).map((d) => `<li class="diff-row">
        <span class="diff-word"><strong lang="en">${esc(d.w.foreign)}</strong> <span class="muted">${esc(d.w.german)}</span>${sel === 'all' ? ` <small class="muted">· ${esc(d.set.name)}</small>` : ''}</span>
        <span class="diff-bar" aria-hidden="true"><i style="width:${(d.rate * 100).toFixed(1)}%"></i></span>
        <span class="diff-num"><b>${Math.round(d.rate * 100)} %</b> falsch · ${d.kidsBad} von ${d.kidsTried} ${d.kidsTried === 1 ? 'Kind' : 'Kindern'}</span>
      </li>`).join('')}</ol>` : '<p class="empty">Noch keine Übungsdaten für diese Portion.</p>'}
  </div>`;
  return `<div class="panel">${head}${matrix}</div>${detail}${words}`;
}

/* ---------- Aktionen (werden in main.js eingehängt) ---------- */
const classActions = {
  classes: () => openClasses(),
  'class-open': (el) => openClass(el.dataset.id),
  'class-tab': (el) => { klass.tab = el.dataset.tab; klass.confirm = ''; render(); if (klass.tab === 'stats') refreshStats(); },
  'class-delete': (el) => { klass.confirm = el.dataset.id; render(); },
  'class-delete-no': () => { klass.confirm = ''; render(); },
  'class-delete-yes': (el) => deleteClass(el.dataset.id),
  'class-rename': () => renameClass(),
  'class-clean-sets': () => { const c = currentClass(); if (c) saveClassSets(c, (c.set_ids || []).filter((id) => getSet(id))).then(render); },
  'kid-import': () => {
    const c = currentClass(), ta = $('#kid-import');
    const list = (ta?.value || '').split(/\r?\n/).map(parseKidLine).filter(Boolean);
    if (!list.length) { toast('Füge zuerst die Namen ein – ein Kind pro Zeile.', 'bad'); ta?.focus(); return; }
    addKids(c, list);
  },
  'kid-newpics': (el) => kidNewPics(el.dataset.id),
  'kid-delete': (el) => { klass.confirm = el.dataset.id; render(); },
  'kid-delete-no': () => { klass.confirm = ''; render(); },
  'kid-delete-yes': (el) => kidDelete(el.dataset.id),
  'cards-pdf': () => downloadCardsPDF(),
  'stats-refresh': () => refreshStats(),
  'class-review': (el) => { const c = currentClass(); if (c) saveClassReview(c, el.dataset.mode); },
  'stats-kid': (el) => { klass.kidDetail = klass.kidDetail === el.dataset.id ? '' : el.dataset.id; render(); if (klass.kidDetail) $('.kid-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  /* Kinder */
  'kid-login': () => openKidLogin(),
  'kid-pw-mode': (el) => setKidLoginMode(el.dataset.mode),
  'tool-here': (el) => { closeModal(true); kidLoginFromCard(el.dataset.u, el.dataset.p.split('-').map(Number)); },
  'kid-pick': (el) => kidPick(+el.dataset.i),
  'kid-unpick': () => kidUnpick(),
  'kid-account': () => openKidAccount(),
  'kid-logout': () => kidLogout(),
  'go-einmaleins': () => goEinmaleins(),
  'kid-refresh': async () => { closeModal(true); try { await kidRefresh(); toast('Auf dem neuesten Stand.'); } catch (e) { toast(kidErrorText(e), 'bad'); } },
};

document.addEventListener('change', (e) => {
  if (e.target.id === 'stat-set') { klass.statSet = e.target.value; render(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isKid()) { kidPushNow(); }
});
window.addEventListener('online', () => { if (isKid()) kidPushNow(); });
