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
const kid = { token: '', first: '', initial: '', username: '', cls: '', sent: {}, busy: false, again: false, status: 'ok' };
const isKid = () => !!kid.token;
const kidName = (k = kid) => `${k.first || k.first_name || ''}${(k.initial ?? k.last_initial) ? ` ${k.initial ?? k.last_initial}.` : ''}`;
const displayUser = (u) => String(u || '').charAt(0).toUpperCase() + String(u || '').slice(1);
const kidSvgURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const kidWordOf = (username) => (String(username || '').match(/^[a-z]+/) || [''])[0];
const kidWordImg = (username, cls = '') => {
  const s = typeof KID_WORDS === 'object' && KID_WORDS[kidWordOf(username)];
  return s ? `<img class="${cls}" src="${kidSvgURL(s)}" alt="" draggable="false">` : '';
};
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
  const { token, first, initial, username, cls, sent } = kid;
  try { localStorage.setItem(KID_KEY, JSON.stringify({ token, first, initial, username, cls, sent })); } catch { /* */ }
}

function kidErrorText(e) {
  const msg = String(e?.message || e || '');
  if (/too_many_attempts/.test(msg)) return 'Zu viele falsche Versuche. Warte 5 Minuten und probier es dann nochmal.';
  if (/session_invalid/.test(msg)) return 'Du wurdest abgemeldet. Melde dich mit deinem Kärtchen neu an.';
  if (/vokaboom_student|could not find the function|PGRST202/i.test(msg)) return 'Die Klassen sind in Supabase noch nicht eingerichtet: supabase/vokabelwelt.sql nochmals ganz ausführen.';
  return cloudErrorText(e);
}

/** Meldet ein Kind an. Liefert true (angemeldet) oder false (Name oder Bilder falsch). */
async function kidLogin(username, pics) {
  const c = await cloudClient();
  const user = String(username || '').trim().toLowerCase();
  const { data, error } = await c.rpc('vokaboom_student_login', { p_username: user, p_pics: pics.join(',') });
  if (error) throw error;
  if (!data || !data.token) return false;
  if (isKid()) kidForget(false); // anderes Kind war noch angemeldet (geteiltes iPad)
  else saveNow(); // eigene Portionen bleiben unter dem normalen Speicherplatz
  Object.assign(kid, { token: data.token, username: user, first: '', initial: '', cls: '', sent: {}, status: 'ok' });
  STORE_KEY = KID_DB_KEY;
  db = { sets: [], settings: { ...structuredClone(DEFAULT_SETTINGS), ...db.settings } };
  kidSaveSession();
  await kidRefresh();
  return true;
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
    if (o) s.words.forEach((w) => { const ow = o.words.find((x) => x.id === w.id); if (ow && w.picStatus !== 'done' && ow.picStatus === 'done' && ow.foreign === w.foreign) { w.pic = ow.pic; w.picStatus = 'done'; } });
    return s;
  }).filter(Boolean);
  kid.status = 'ok';
  kidSaveSession();
  saveNow();
  renderShell(); bindTopSearch();
  if (ui.view !== 'home' && !currentSet()) ui.view = 'home';
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
  kidForget();
  toast('Abgemeldet. Tschüss!');
}
/** Kind abmelden: dessen Daten vom Gerät entfernen, eigene Portionen wieder laden */
function kidForget(rerender = true) {
  try { localStorage.removeItem(KID_KEY); localStorage.removeItem(KID_DB_KEY); } catch { /* */ }
  Object.assign(kid, { token: '', first: '', initial: '', username: '', cls: '', sent: {}, status: 'ok' });
  STORE_KEY = MAIN_STORE_KEY;
  db = { sets: [], settings: structuredClone(DEFAULT_SETTINGS) };
  loadDB();
  if (!rerender) return;
  closeModal(true);
  ui.setId = null; ui.view = 'home';
  renderShell(); bindTopSearch(); render();
}

/** Login über den QR-Code auf dem Kärtchen: …#k=maus67.11-0-2 */
async function kidLoginFromHash() {
  const m = location.hash.match(/^#k=([a-z]+[0-9]{2,4})\.(\d{1,2})-(\d{1,2})-(\d{1,2})$/i);
  if (!m) return false;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
  const user = m[1].toLowerCase(), pics = [m[2], m[3], m[4]].map(Number);
  if (isKid() && kid.username === user) { render(); return true; }
  let teacher = false;
  try { teacher = !!localStorage.getItem(AUTH_KEY); } catch { /* */ }
  render();
  if (teacher || cloud.uid) { openTeacherBlocks(); return true; }
  toast('Anmelden …');
  try {
    if (await kidLogin(user, pics)) toast(`Hallo ${kid.first}! Du bist angemeldet.`);
    else toast('Dieses Kärtchen gilt nicht mehr. Frag deine Lehrperson nach einem neuen.', 'bad');
  } catch (e) { toast(kidErrorText(e), 'bad'); }
  return true;
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
      <p class="label">Tippe deine 3 Bilder der Reihe nach an</p>
      <div class="kid-slots" id="kid-slots" aria-live="polite"></div>
      <div class="kid-grid">${KID_PW.map((p, i) => `<button type="button" class="kid-pic" data-action="kid-pick" data-i="${i}" aria-label="${esc(p.de)}">${kidPwImg(i)}</button>`).join('')}</div>
      <p class="form-error" id="kid-error" role="alert"></p>
      <button class="btn primary big" type="submit" id="kid-submit">Los geht's ${icon('right')}</button>
    </form>
    <p class="muted small">${icon('image')} Oder scanne den QR-Code auf deinem Kärtchen mit der Kamera.</p>
    <p class="small"><button type="button" class="link-btn" data-action="login-choose">Zurück</button></p>`, { label: 'Kinder-Login', cls: 'auth-modal kid-modal' });
  renderKidSlots();
  setTimeout(() => $('#kid-user')?.focus(), 60);
  $('#kid-form').addEventListener('submit', (e) => { e.preventDefault(); submitKidLogin(); });
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
  if (kidForm.picks.length < 3) { err.textContent = 'Tippe deine 3 Bilder an.'; return; }
  err.textContent = '';
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Anmelden …';
  try {
    const ok = await kidLogin(user, kidForm.picks);
    if (!ok) {
      if (!$('#kid-error')) return;
      err.textContent = 'Das stimmt leider nicht. Schau genau auf dein Kärtchen und probier es nochmal.';
      sfx.bad();
      kidForm.picks = []; renderKidSlots();
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
        <button class="btn secondary live-join-btn" data-action="live-join">🎯 Live-Spiel beitreten</button></div>
    </div>
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
      const [cl, st] = await Promise.all([
        c.from('vokaboom_classes').select('id,name,set_ids,created_at').order('created_at'),
        c.from('vokaboom_students').select('id,class_id,first_name,last_initial,username,pics,created_at').order('first_name'),
      ]);
      if (cl.error) throw cl.error;
      if (st.error) throw st.error;
      klass.list = cl.data || [];
      klass.students = {};
      (st.data || []).forEach((s) => { (klass.students[s.class_id] = klass.students[s.class_id] || []).push(s); });
      klass.loaded = true; klass.error = '';
    } catch (e) {
      klass.error = classErrorText(e);
    } finally { klass.loading = null; }
  })();
  return klass.loading;
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
      <span class="kid-who"><strong>${esc(kidName(s))}</strong><small>${esc(displayUser(s.username))}</small></span>
      <span class="kid-pw" aria-label="Bilder-Passwort">${picsList(s.pics).map((i) => `<span>${kidPwImg(i)}</span>`).join('')}</span>
      <span class="kid-actions">
        <button class="icon-btn subtle" data-action="kid-newpics" data-id="${s.id}" title="Neue Bilder (neues Passwort)" aria-label="Neue Bilder für ${esc(kidName(s))}">${icon('shuffle')}</button>
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
  try {
    const cl = await cloudClient();
    const { error } = await cl.from('vokaboom_students').update({ pics }).eq('id', id);
    if (error) throw error;
    s.pics = pics;
    render();
    toast(`${kidName(s)} hat neue Bilder. Das alte Kärtchen gilt nicht mehr – druck ein neues aus.`);
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
      </label></li>`).join('')}</ul>` : '<p class="empty">Du hast noch keine Portion. Erstelle zuerst auf der Startseite eine.</p>'}
    ${missing.length ? `<p class="muted small">${missing.length} freigegebene ${missing.length === 1 ? 'Portion gibt' : 'Portionen gibt'} es nicht mehr. <button class="link-btn" data-action="class-clean-sets">Entfernen</button></p>` : ''}
  </div>`;
}
function bindClassSets(c) {
  $$('.set-pick input').forEach((cb) => cb.addEventListener('change', async () => {
    const ids = new Set(c.set_ids || []);
    if (cb.checked) ids.add(cb.dataset.set); else ids.delete(cb.dataset.set);
    const order = [...db.sets.map((s) => s.id).filter((id) => ids.has(id)), ...[...ids].filter((id) => !getSet(id))];
    await saveClassSets(c, order);
    if (cb.checked && !cloud.synced[cb.dataset.set]) cloudSync();
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
function classCardsHTML(c, kids) {
  if (!kids.length) return '<div class="panel"><p class="empty">Noch keine Kinder in dieser Klasse.</p></div>';
  return `<div class="panel">
    <div class="cards-head">
      <div><h2>Login-Kärtchen</h2>
        <p class="hint">Ausdrucken, ausschneiden und verteilen. Anmelden: QR-Code scannen – oder Benutzername eintippen und die 3 Bilder der Reihe nach antippen.</p></div>
      <button class="btn primary" data-action="cards-pdf" id="cards-pdf">${icon('down')} PDF herunterladen</button>
    </div>
    <div class="card-previews">${kids.map((s) => `<figure class="card-prev" data-sid="${s.id}"><span class="spinner"></span></figure>`).join('')}</div>
  </div>`;
}

const CARD_W = 85, CARD_H = 54; // mm, wie eine Kreditkarte
const CARD_COLORS = [['#4F46E5', '#EEF0FF'], ['#DB2777', '#FDE7F1'], ['#D97706', '#FFF2D9'], ['#0891B2', '#DDF6FB'], ['#059669', '#DCF7EC'], ['#7C3AED', '#F1EAFF'], ['#E8730C', '#FFEDD8'], ['#0E7490', '#DFF5F9'], ['#BE185D', '#FCE7F3'], ['#4D7C0F', '#ECFCCB']];
const BRAND_MARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -6 80 78"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4F46E5"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs><rect x="6" y="22" width="36" height="42" rx="10" fill="#FFB703" transform="rotate(-12 24 43)"/><rect x="14" y="20" width="38" height="46" rx="11" fill="url(#g)" stroke="#fff" stroke-width="2.5"/><path d="M23 34l10 18 10-18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><g stroke-linecap="round"><path d="M54 13.1L52 2.3" stroke="#FFB703" stroke-width="4"/><path d="M57.8 13.2L63.3 1.9" stroke="#FFB703" stroke-width="4.4"/><path d="M60.3 16.2L70 11" stroke="#FFD166" stroke-width="4"/><path d="M61.5 19.7L68.9 20.5" stroke="#FFB703" stroke-width="3.6"/><path d="M50.2 14.7L45.7 10.6" stroke="#FFD166" stroke-width="3.6"/></g></svg>';
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

/** Zeichnet ein Kärtchen. x, y in mm; s = Pixel pro mm */
async function drawKidCard(ctx, x, y, s, st, className) {
  const [accent, wash] = cardColor(st.username);
  const X = (mm) => (x + mm) * s, Y = (mm) => (y + mm) * s, L = (mm) => mm * s;
  const disp = "'Bricolage Grotesque', Lexend, system-ui, sans-serif", body = "Lexend, system-ui, sans-serif";
  ctx.save();
  // Karte
  rrect(ctx, X(0), Y(0), L(CARD_W), L(CARD_H), L(3.5));
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(X(0), Y(0), X(CARD_W), Y(11));
  g.addColorStop(0, '#4F46E5'); g.addColorStop(1, '#7C3AED');
  ctx.fillStyle = g; ctx.fillRect(X(0), Y(0), L(CARD_W), L(11));
  // Farbstreifen unten in der Farbe des Kindes
  ctx.fillStyle = accent; ctx.fillRect(X(0), Y(CARD_H - 1.6), L(CARD_W), L(1.6));
  ctx.restore();
  rrect(ctx, X(0), Y(0), L(CARD_W), L(CARD_H), L(3.5));
  ctx.lineWidth = L(0.25); ctx.strokeStyle = '#CDD2E2'; ctx.stroke();
  // Kopf: Logo, „Vokaboom“, Klasse
  const mark = await svgImage(BRAND_MARK_SVG);
  if (mark) ctx.drawImage(mark, X(2.6), Y(0.9), L(9.2), L(9));
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${L(4.6)}px ${disp}`;
  ctx.fillStyle = '#fff'; ctx.fillText('Voka', X(12.6), Y(7.3));
  const vw = ctx.measureText('Voka').width;
  ctx.fillStyle = '#FFB703'; ctx.fillText('boom', X(12.6) + vw, Y(7.3));
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.fillText(fitText(ctx, className, L(36), (z) => `500 ${z}px ${body}`, L(3)), X(CARD_W - 3.5), Y(7));
  ctx.textAlign = 'left';
  // Bild zum Benutzernamen
  rrect(ctx, X(4), Y(14), L(19), L(19), L(4)); ctx.fillStyle = wash; ctx.fill();
  const wimg = await svgImage(KID_WORDS[kidWordOf(st.username)] || '');
  if (wimg) ctx.drawImage(wimg, X(5.5), Y(15.5), L(16), L(16));
  // Name und Benutzername
  ctx.fillStyle = '#161A33';
  ctx.fillText(fitText(ctx, kidName(st), L(28), (z) => `600 ${z}px ${body}`, L(3.6)), X(26), Y(18.6));
  ctx.fillStyle = '#7A80A0'; ctx.font = `500 ${L(2.3)}px ${body}`; ctx.fillText('Benutzername', X(26), Y(24));
  ctx.fillStyle = accent;
  ctx.fillText(fitText(ctx, displayUser(st.username), L(28), (z) => `800 ${z}px ${disp}`, L(6.4)), X(26), Y(31));
  // Bilder-Passwort
  ctx.fillStyle = '#7A80A0'; ctx.font = `500 ${L(2.3)}px ${body}`;
  ctx.fillText('Passwort: diese 3 Bilder antippen', X(4), Y(38.4));
  const pics = picsList(st.pics);
  for (let k = 0; k < 3; k++) {
    const bx = 4 + k * 12.6, by = 40.3;
    rrect(ctx, X(bx), Y(by), L(10.6), L(10.6), L(2.2));
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = L(0.45); ctx.strokeStyle = accent; ctx.stroke();
    const im = pics[k] != null ? await svgImage(KID_PW[pics[k]].svg) : null;
    if (im) ctx.drawImage(im, X(bx + 1.6), Y(by + 1.6), L(7.4), L(7.4));
    ctx.beginPath(); ctx.arc(X(bx + 0.4), Y(by + 0.4), L(1.9), 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${L(2.5)}px ${body}`; ctx.textAlign = 'center';
    ctx.fillText(String(k + 1), X(bx + 0.4), Y(by + 1.3)); ctx.textAlign = 'left';
  }
  // QR-Code
  const qx = 56, qy = 13.3, qs = 26;
  ctx.fillStyle = '#fff'; ctx.fillRect(X(qx), Y(qy), L(qs), L(qs));
  try {
    const q = qrcode(0, 'M'); q.addData(kidLoginUrl(st), 'Byte'); q.make();
    const n = q.getModuleCount(), m = 1.5, cell = qs / (n + m * 2);
    ctx.fillStyle = '#161A33';
    for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) {
      if (q.isDark(r, cc)) ctx.fillRect(Math.floor(X(qx + (cc + m) * cell)), Math.floor(Y(qy + (r + m) * cell)), Math.ceil(L(cell)), Math.ceil(L(cell)));
    }
  } catch { /* zu lang – kommt nicht vor */ }
  ctx.textAlign = 'center'; ctx.fillStyle = '#4A5072'; ctx.font = `600 ${L(2.3)}px ${body}`;
  ctx.fillText('Scannen = anmelden', X(qx + qs / 2), Y(43.4));
  ctx.fillStyle = '#7A80A0'; ctx.font = `400 ${L(1.9)}px ${body}`;
  ctx.fillText(location.host || 'vokaboom', X(qx + qs / 2), Y(47.4));
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
    a.download = `Vokaboom-Logins-${c.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'Klasse'}.pdf`;
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
    <thead><tr><th scope="col">Kind</th>${sets.map((s) => `<th scope="col">${esc(s.name)}</th>`).join('')}</tr></thead>
    <tbody>${kids.map((st) => `<tr class="${klass.kidDetail === st.id ? 'sel' : ''}">
      <th scope="row"><button class="link-btn kid-link" data-action="stats-kid" data-id="${st.id}">${kidWordImg(st.username, 'kid-mini')}${esc(kidName(st))}</button></th>
      ${sets.map((set) => {
        const k = kidSetStats(prog[st.id]?.[set.id], set);
        if (!k || !k.n) return '<td class="cell empty">–</td>';
        return `<td class="cell ${accClass(k.acc)}" title="${k.n} Antworten, ${k.bad} falsch">
          <b>${pctTxt(k.acc)}</b><small>${k.words}/${k.total} Wörter · ${k.steps}/4 Übungen${k.test != null ? ` · Test ${k.test} %` : ''}</small><small class="muted">${fmtDay(k.last)}</small></td>`;
      }).join('')}
    </tr>`).join('')}</tbody></table></div>
    <p class="muted small">Prozent = Anteil richtiger Antworten in allen Übungen (fast richtig zählt halb). Tippe auf ein Kind für seine schwierigsten Wörter.</p>`;

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
  'stats-kid': (el) => { klass.kidDetail = klass.kidDetail === el.dataset.id ? '' : el.dataset.id; render(); if (klass.kidDetail) $('.kid-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  /* Kinder */
  'kid-login': () => openKidLogin(),
  'kid-pick': (el) => kidPick(+el.dataset.i),
  'kid-unpick': () => kidUnpick(),
  'kid-account': () => openKidAccount(),
  'kid-logout': () => kidLogout(),
  'kid-refresh': async () => { closeModal(true); try { await kidRefresh(); toast('Auf dem neuesten Stand.'); } catch (e) { toast(kidErrorText(e), 'bad'); } },
};

document.addEventListener('change', (e) => {
  if (e.target.id === 'stat-set') { klass.statSet = e.target.value; render(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isKid()) { kidPushNow(); }
});
window.addEventListener('online', () => { if (isKid()) kidPushNow(); });
