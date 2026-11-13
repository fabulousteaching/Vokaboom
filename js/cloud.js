/* Vokaboom – Konto: Portionen im eigenen Konto speichern (Supabase)
 *
 * Anmeldung mit E-Mail-Adresse und Passwort. Links aus E-Mails von Supabase (Konto bestätigen,
 * Passwort vergessen) führen zurück auf diese Seite; supabase-js liest sie aus der Adresse.
 * Tabelle und Zugriffsregeln: supabase/vokabelwelt.sql, Einrichtung: supabase/ANLEITUNG.md.
 * Ohne Eintrag in js/config.js läuft Vokaboom wie bisher, nur im Browser.
 */
'use strict';

const CLOUD_CFG = { supabaseUrl: '', supabaseKey: '', ...(window.VOKABELWELT_CONFIG || {}) };
const SB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
const SB_SRI = 'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok';
const CLOUD_TABLE = 'vokabelwelt_sets';
const CLOUD_STATE_KEY = 'vokabelwelt.cloud';
const AUTH_KEY = 'vokabelwelt-auth'; // eigener Speicherplatz, damit sich andere Seiten auf github.io nicht vermischen

const cloud = {
  client: null, loading: null, uid: '', user: '', status: 'off', error: '', lastSync: 0,
  busy: false, again: false, synced: {}, deleted: [], sent: {},
};
/* Kurzer Fingerabdruck einer Portion: Hat sie sich seit dem letzten Hochladen geändert? */
function setHash(set) {
  const str = JSON.stringify(set);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + str.length.toString(36);
}
const isDirty = (s) => cloud.sent[s.id] !== setHash(s);
const cloudUrl = () => String(CLOUD_CFG.supabaseUrl || '').trim().replace(/\/+$/, '');
const cloudConfigured = () => /^https:\/\/[^/\s]+$/.test(cloudUrl()) && !!String(CLOUD_CFG.supabaseKey || '').trim();

/* ---------- E-Mail-Adresse ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const normEmail = (e) => String(e || '').trim().toLowerCase();
const emailProblem = (e) => (!e ? 'Gib deine E-Mail-Adresse ein.' : !EMAIL_RE.test(e) ? 'Das sieht nicht wie eine E-Mail-Adresse aus.' : '');
const shortName = (email) => String(email || '').split('@')[0];
const siteUrl = () => location.origin + location.pathname;

/* ---------- Zustand merken (welche Portionen schon im Konto sind) ---------- */
function loadCloudState() {
  try {
    const d = JSON.parse(localStorage.getItem(CLOUD_STATE_KEY) || '{}');
    cloud.synced = d.synced && typeof d.synced === 'object' ? d.synced : {};
    cloud.deleted = Array.isArray(d.deleted) ? d.deleted.filter((x) => typeof x === 'string') : [];
    cloud.sent = d.sent && typeof d.sent === 'object' ? d.sent : {};
    cloud.stateUid = typeof d.uid === 'string' ? d.uid : '';
  } catch { /* */ }
}
function saveCloudState() {
  try { localStorage.setItem(CLOUD_STATE_KEY, JSON.stringify({ uid: cloud.uid, synced: cloud.synced, deleted: cloud.deleted, sent: cloud.sent })); } catch { /* */ }
}

/* ---------- Supabase laden ---------- */
function loadSupabase() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (cloud.loading) return cloud.loading;
  cloud.loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SB_URL; s.integrity = SB_SRI; s.crossOrigin = 'anonymous';
    s.onload = () => (window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('load')));
    s.onerror = () => { cloud.loading = null; s.remove(); reject(new Error('load')); };
    document.head.appendChild(s);
  });
  return cloud.loading;
}
async function cloudClient() {
  if (cloud.client) return cloud.client;
  const sb = await loadSupabase();
  cloud.client = sb.createClient(cloudUrl(), String(CLOUD_CFG.supabaseKey).trim(), {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_KEY },
  });
  cloud.client.auth.onAuthStateChange((ev, session) => {
    // Supabase rät, hier nicht direkt auf Supabase zu warten
    if (ev === 'SIGNED_OUT' && cloud.uid) setTimeout(() => { forgetCloudUser(); toast('Du wurdest abgemeldet.'); }, 0);
    if (ev === 'PASSWORD_RECOVERY' && session?.user) setTimeout(() => { setCloudUser(session.user); renderAccountSlot(); openNewPassword(); }, 0);
    if (ev === 'USER_UPDATED' && session?.user && cloud.uid) setTimeout(() => { cloud.user = session.user.email || cloud.user; renderAccountSlot(); }, 0);
  });
  return cloud.client;
}

function setCloudUser(user) {
  if (cloud.stateUid && cloud.stateUid !== user.id) { cloud.synced = {}; cloud.deleted = []; cloud.sent = {}; }
  cloud.uid = user.id;
  cloud.stateUid = user.id;
  cloud.user = user.email || '';
  saveCloudState();
}
function forgetCloudUser() {
  cloud.uid = ''; cloud.user = ''; cloud.status = 'off'; cloud.error = '';
  if (typeof klass === 'object') Object.assign(klass, { list: [], students: {}, progress: {}, loaded: false, error: '' });
  if (['classes', 'class'].includes(ui.view)) { ui.view = 'home'; setTimeout(render, 0); }
  cloud.sent = {}; cloud.synced = {}; cloud.deleted = [];
  saveCloudState();
  renderAccountSlot();
}

/* ---------- Beim Start: noch angemeldet? ---------- */
async function cloudInit() {
  if (!cloudConfigured()) return;
  loadCloudState();
  // Kommt man über einen Link aus einer E-Mail (Konto bestätigen, Passwort vergessen)?
  const hp = new URLSearchParams(location.hash.slice(1));
  const fromMail = hp.has('access_token') ? (hp.get('type') || 'link') : '';
  if (hp.has('message') && !hp.has('access_token')) {
    // Neue E-Mail-Adresse: erster von zwei Bestätigungs-Links angeklickt
    try { history.replaceState(null, '', siteUrl() + location.search); } catch { /* */ }
    toast(/other email/i.test(hp.get('message'))
      ? 'Bestätigt! Klicke jetzt noch auf den Link in der E-Mail an die andere Adresse – dann gilt die neue E-Mail-Adresse.'
      : hp.get('message'));
  }
  if (hp.has('error') || hp.has('error_code') || hp.has('error_description')) {
    const code = hp.get('error_code') || hp.get('error') || '';
    try { history.replaceState(null, '', siteUrl() + location.search); } catch { /* */ }
    toast(/expired|invalid/i.test(code + (hp.get('error_description') || ''))
      ? 'Dieser Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.'
      : `Der Link aus der E-Mail hat nicht geklappt (${code}).`, 'bad');
  }
  let stored = false;
  try { stored = !!localStorage.getItem(AUTH_KEY); } catch { /* */ }
  if (!stored && !fromMail) return; // nie angemeldet: Supabase gar nicht erst laden
  try {
    const c = await cloudClient();
    const { data } = await c.auth.getSession();
    if (fromMail) { try { history.replaceState(null, '', siteUrl() + location.search); } catch { /* */ } }
    if (data?.session?.user) {
      setCloudUser(data.session.user);
      renderAccountSlot();
      if (fromMail === 'signup') toast('Deine E-Mail-Adresse ist bestätigt. Willkommen bei Vokaboom!');
      if (fromMail === 'email_change') toast(`Deine neue E-Mail-Adresse ${data.session.user.email} ist bestätigt.`);
      await cloudSync();
    }
  } catch (e) {
    cloud.status = 'error'; cloud.error = cloudErrorText(e);
  }
  renderAccountSlot();
}

/* ---------- Anmelden, Konto erstellen, Abmelden ---------- */
/** Liefert 'ok' (angemeldet) oder 'confirm' (Supabase hat eine Bestätigungs-E-Mail geschickt) */
async function cloudLogin(email, password, create) {
  const c = await cloudClient();
  const res = create
    ? await c.auth.signUp({ email, password, options: { emailRedirectTo: siteUrl() } })
    : await c.auth.signInWithPassword({ email, password });
  if (res.error) throw res.error;
  if (!res.data?.session?.user) {
    // Ein Konto ohne Anmeldearten heißt: Die Adresse ist schon vergeben
    if (create && res.data?.user && Array.isArray(res.data.user.identities) && !res.data.user.identities.length) throw Object.assign(new Error('exists'), { code: 'user_already_exists' });
    if (create) return 'confirm';
    throw Object.assign(new Error('confirm'), { code: 'email_not_confirmed' });
  }
  setCloudUser(res.data.session.user);
  renderAccountSlot();
  await cloudSync();
  return 'ok';
}

async function cloudResetPassword(email) {
  const c = await cloudClient();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() });
  if (error) throw error;
}

async function cloudLogout() {
  // Was noch nicht hochgeladen ist, bleibt auf dem Gerät
  const keep = (s) => !cloud.synced[s.id] || isDirty(s);
  const before = db.sets.length;
  db.sets = db.sets.filter(keep);
  const removed = before - db.sets.length;
  forgetCloudUser(); // zuerst, damit die Abmelde-Meldung von Supabase nicht doppelt erscheint
  saveNow();
  try { await cloud.client?.auth.signOut({ scope: 'local' }); } catch { /* */ }
  return removed;
}

/** E-Mail-Adresse ändern. Liefert 'done' (gilt sofort) oder 'confirm' (Bestätigungs-E-Mail unterwegs). */
async function cloudChangeEmail(newEmail, password) {
  const c = await cloudClient();
  // Zur Sicherheit: aktuelles Passwort prüfen (z. B. an einem offenen Schulcomputer)
  const check = await c.auth.signInWithPassword({ email: cloud.user, password });
  if (check.error) {
    if (check.error.code === 'invalid_credentials' || /invalid login/i.test(check.error.message)) throw Object.assign(new Error('pw'), { code: 'wrong_password' });
    throw check.error;
  }
  const { data, error } = await c.auth.updateUser({ email: newEmail }, { emailRedirectTo: siteUrl() });
  if (error) throw error;
  if (data?.user?.email && normEmail(data.user.email) === newEmail) {
    setCloudUser(data.user);
    renderAccountSlot();
    return 'done';
  }
  return 'confirm';
}

async function cloudChangePassword(password) {
  const c = await cloudClient();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw error;
}

/* ---------- Abgleichen ---------- */
function cleanRemoteSet(d, id) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.words)) return null;
  const words = d.words.filter((w) => w && typeof w.foreign === 'string').map((w) => ({
    ...w, id: String(w.id || uid()), german: String(w.german || ''),
    picStatus: w.picStatus === 'pending' ? 'stale' : (w.picStatus || 'stale'),
  }));
  return {
    ...d, id, lang: 'en', name: String(d.name || 'Vokabeln').slice(0, 200), words,
    picStyle: ['picto', 'clipart', 'emoji'].includes(d.picStyle) ? d.picStyle : 'picto',
    progress: d.progress && typeof d.progress === 'object' ? d.progress : {},
    updated: Number(d.updated) || 0,
  };
}

async function cloudSync() {
  if (!cloud.uid) return;
  if (cloud.busy) { cloud.again = true; return; }
  cloud.busy = true; cloud.status = 'syncing'; renderAccountSlot();
  try {
    const c = await cloudClient();
    // 1) Löschungen, die noch nicht angekommen sind
    if (cloud.deleted.length) {
      const { error } = await c.from(CLOUD_TABLE).delete().in('set_id', cloud.deleted);
      if (error) throw error;
      cloud.deleted = [];
    }
    // 2) Holen
    const { data, error } = await c.from(CLOUD_TABLE).select('set_id,data');
    if (error) throw error;
    const remote = new Map((data || []).map((r) => [r.set_id, r]));
    let changed = false;
    for (const [id, r] of remote) {
      const rs = cleanRemoteSet(r.data, id);
      if (!rs) continue;
      const i = db.sets.findIndex((s) => s.id === id);
      if (i < 0) { db.sets.push(rs); changed = true; } else if (rs.updated > (db.sets[i].updated || 0)) { db.sets[i] = rs; changed = true; } else continue;
      cloud.sent[id] = setHash(rs);
    }
    // 3) Schon einmal hochgeladen, aber nicht mehr im Konto → auf einem anderen Gerät gelöscht
    const gone = db.sets.filter((s) => cloud.synced[s.id] && !remote.has(s.id));
    if (gone.length) { db.sets = db.sets.filter((s) => !gone.includes(s)); changed = true; }
    // 4) Neue oder geänderte Portionen von diesem Gerät hochladen
    const ups = db.sets.filter((s) => {
      const r = remote.get(s.id);
      return !r || (s.updated || 0) > (Number(r.data?.updated) || 0) || (cloud.sent[s.id] && isDirty(s));
    });
    ups.forEach((s) => { if (remote.has(s.id) && (s.updated || 0) <= (Number(remote.get(s.id).data?.updated) || 0)) { s.updated = Date.now(); changed = true; } });
    if (ups.length) await cloudUpload(ups);
    db.sets.forEach((s) => { cloud.synced[s.id] = 1; if (!cloud.sent[s.id]) cloud.sent[s.id] = setHash(s); });
    Object.keys(cloud.synced).forEach((id) => { if (!getSet(id)) delete cloud.synced[id]; });
    Object.keys(cloud.sent).forEach((id) => { if (!getSet(id)) delete cloud.sent[id]; });
    saveCloudState();
    if (changed) {
      db.sets.sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0));
      saveNow();
      if (ui.view === 'home') render();
    }
    cloud.status = 'ok'; cloud.error = ''; cloud.lastSync = Date.now();
    if (applyTeacherPrefs()) saveDB(); // Akzent/Punktzahl der Lehrperson in alle eigenen Portionen
  } catch (e) {
    cloud.status = 'error'; cloud.error = cloudErrorText(e);
    if (e?.status === 401 || e?.code === 'PGRST301') forgetCloudUser();
  } finally {
    cloud.busy = false;
    renderAccountSlot();
  }
  if (cloud.again) { cloud.again = false; cloudSync(); }
}

async function cloudUpload(sets) {
  const c = await cloudClient();
  const rows = sets.map((s) => ({ user_id: cloud.uid, set_id: s.id, name: String(s.name || '').slice(0, 200), data: s }));
  const { error } = await c.from(CLOUD_TABLE).upsert(rows, { onConflict: 'user_id,set_id' });
  if (error) throw error;
  sets.forEach((s) => { cloud.sent[s.id] = setHash(s); cloud.synced[s.id] = 1; });
  saveCloudState();
  // Freigegebene Portionen: öffentliche Kopie aktuell halten
  try { await cloudPublish(sets); } catch { /* Suche ist nicht eingerichtet – das Speichern hat trotzdem geklappt */ }
}

/* Nach jedem Speichern: geänderte Portionen kurz danach hochladen */
const cloudPushSoon = debounce(async () => {
  if (!cloud.uid) return;
  if (cloud.busy) { cloud.again = true; return; }
  const changed = db.sets.filter(isDirty);
  if (!changed.length) return;
  changed.forEach((s) => { if (cloud.sent[s.id]) s.updated = Date.now(); });
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* */ }
  cloud.busy = true; cloud.status = 'syncing'; renderAccountSlot();
  try {
    await cloudUpload(changed);
    cloud.status = 'ok'; cloud.error = ''; cloud.lastSync = Date.now();
  } catch (e) {
    cloud.status = 'error'; cloud.error = cloudErrorText(e);
  } finally {
    cloud.busy = false;
    renderAccountSlot();
  }
  if (cloud.again) { cloud.again = false; cloudSync(); }
}, 2500);
function onDbSaved() { if (isKid()) kidPushSoon(); else if (cloud.uid) cloudPushSoon(); }

async function cloudDeleteSet(id) {
  if (!cloud.uid || !cloud.synced[id]) return;
  delete cloud.synced[id];
  delete cloud.sent[id];
  cloud.deleted.push(id);
  saveCloudState();
  try {
    const c = await cloudClient();
    const { error } = await c.from(CLOUD_TABLE).delete().eq('set_id', id);
    if (error) throw error;
    try { await c.from(PUBLIC_TABLE).delete().eq('set_id', id); } catch { /* */ }
    cloud.deleted = cloud.deleted.filter((x) => x !== id);
    saveCloudState();
  } catch (e) {
    cloud.status = 'error'; cloud.error = cloudErrorText(e); renderAccountSlot();
  }
}

window.addEventListener('online', () => { if (cloud.uid && cloud.status === 'error') cloudSync(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && cloud.uid && Date.now() - cloud.lastSync > 60000) cloudSync();
});

/* ---------- Fehlermeldungen ---------- */
function cloudErrorText(e) {
  const code = String(e?.code || ''), msg = String(e?.message || e || '');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Bitte bestätige zuerst deine E-Mail-Adresse: Klicke auf den Link in der E-Mail, die du beim Erstellen des Kontos bekommen hast.';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'E-Mail-Adresse oder Passwort stimmt nicht.';
  if (code === 'user_already_exists' || code === 'email_exists' || /already (registered|exists)/i.test(msg)) return 'Mit dieser E-Mail-Adresse gibt es schon ein Konto. Melde dich an – oder nutze „Passwort vergessen?“.';
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(msg)) return 'Es wurden gerade zu viele E-Mails verschickt. Versuch es in einer Stunde nochmal.';
  if (/error sending|sending (recovery|confirmation)|smtp/i.test(msg)) return 'Die E-Mail konnte nicht verschickt werden. Dafür muss in Supabase ein E-Mail-Versand (SMTP) eingerichtet sein – siehe supabase/ANLEITUNG.md.';
  if (code === 'weak_password' || /password.*(least|short|weak|characters)/i.test(msg)) return 'Das Passwort ist zu schwach. Nimm mindestens 8 Zeichen, am besten mit Buchstaben und Ziffern.';
  if (code === 'same_password') return 'Das ist schon dein Passwort.';
  if (code === 'wrong_password') return 'Das aktuelle Passwort stimmt nicht.';
  if (code === 'signup_disabled' || /signups? not allowed/i.test(msg)) return 'Neue Konten sind gerade ausgeschaltet. Frag die Person, die Vokaboom eingerichtet hat.';
  if (code === 'email_address_invalid' || code === 'email_address_not_authorized' || /email.*invalid|invalid.*email|not authorized/i.test(msg)) return 'An diese E-Mail-Adresse kann Supabase gerade nichts schicken. Prüf die Adresse – oder richte in Supabase einen E-Mail-Versand (SMTP) ein.';
  if (code === 'over_request_rate_limit' || e?.status === 429) return 'Zu viele Versuche. Warte einen Moment und versuch es nochmal.';
  if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg)) return 'In Supabase fehlt eine Tabelle: Bitte supabase/vokabelwelt.sql im SQL Editor nochmals ganz ausführen.';
  if (code === '42501' || /permission denied|row-level security/i.test(msg)) return 'Keine Berechtigung: Bitte supabase/vokabelwelt.sql in Supabase nochmals ganz ausführen.';
  if (msg === 'load') return 'Die Anmeldung konnte nicht geladen werden. Bist du online?';
  if (e instanceof TypeError || /failed to fetch|network|load failed/i.test(msg)) return 'Keine Verbindung zum Server. Bist du online? (Gratis-Projekte bei Supabase pausieren nach einer Woche ohne Nutzung.)';
  return msg || 'Unbekannter Fehler.';
}

/* ---------- Oberfläche ---------- */
function accountButtonHTML() {
  if (isKid()) return kidAccountButtonHTML();
  if (cloud.user) {
    const st = cloud.status === 'syncing' ? 'syncing' : cloud.status === 'error' ? 'error' : 'ok';
    const label = st === 'syncing' ? 'wird gespeichert' : st === 'error' ? 'Problem beim Speichern' : 'gespeichert';
    return `<button class="account-btn in" data-action="account" title="Konto: ${esc(cloud.user)} (${label})" aria-label="Konto ${esc(cloud.user)}, ${label}">
      ${icon('user')}<span class="account-name">${esc(shortName(cloud.user))}</span><i class="sync-dot ${st}" aria-hidden="true"></i></button>`;
  }
  return `<button class="account-btn" data-action="login" title="Anmelden, um deine Portionen im Konto zu speichern">${icon('user')}<span>Anmelden</span></button>`;
}
function renderAccountSlot() {
  const slot = document.getElementById('account-slot');
  if (slot) slot.innerHTML = accountButtonHTML();
  const note = document.getElementById('lib-note');
  if (note) note.outerHTML = libraryNote();
  const st = document.getElementById('acct-status');
  if (st) st.innerHTML = accountStatusText();
}
function libraryNote() {
  if (!cloud.user) return '';
  return `<p class="lib-note ${cloud.status === 'error' ? 'bad' : ''}" id="lib-note">${icon(cloud.status === 'error' ? 'x' : 'check')} ${cloud.status === 'error' ? esc(cloud.error) : `In deinem Konto <strong>${esc(cloud.user)}</strong> gespeichert.`}</p>`;
}
function accountStatusText() {
  if (cloud.status === 'syncing') return '<span class="spinner"></span> Wird abgeglichen …';
  if (cloud.status === 'error') return `<span class="warn-text">${esc(cloud.error)}</span>`;
  if (cloud.lastSync) return `Alles gespeichert (${new Date(cloud.lastSync).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}).`;
  return '';
}

function openLogin(mode = 'login') {
  if (!cloudConfigured()) {
    openModal(`
      <header class="modal-head"><h2>Anmelden</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
      <p>Mit einem Konto speicherst du deine Vokabelportionen online und hast sie auf jedem Gerät.</p>
      <p class="muted">Der Login ist noch nicht eingerichtet. Wie das geht, steht im Repository in <code>supabase/ANLEITUNG.md</code>: ein Projekt bei Supabase anlegen, die Tabelle erstellen und Adresse und Schlüssel in <code>js/config.js</code> eintragen.</p>
      <footer class="modal-foot"><button type="button" class="btn primary" data-action="close-modal">OK</button></footer>`, { label: 'Anmelden' });
    return;
  }
  const create = mode === 'create';
  const prevEmail = $('#auth-email')?.value || '';
  openModal(`
    <header class="modal-head"><h2>${create ? 'Konto erstellen' : 'Anmelden'}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <button type="button" class="kid-entry" data-action="kid-login"><span class="kid-entry-pics" aria-hidden="true">${[0, 5, 8].map((i) => kidPwImg(i)).join('')}</span><span><strong>Kinder-Login</strong><small>mit deinem Kärtchen</small></span>${icon('right')}</button>
    <div class="seg auth-seg" role="group" aria-label="Anmelden oder Konto erstellen">
      <button type="button" class="seg-btn" data-action="login" data-mode="login" aria-pressed="${!create}">Anmelden</button>
      <button type="button" class="seg-btn" data-action="login" data-mode="create" aria-pressed="${create}">Neues Konto</button>
    </div>
    <form class="auth-form" id="auth-form" autocomplete="on" novalidate>
      <label class="field" for="auth-email"><span class="label">E-Mail-Adresse</span>
        <input id="auth-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="200" required autofocus placeholder="name@schule.ch" value="${esc(prevEmail)}"></label>
      <label class="field" for="auth-pass"><span class="label">Passwort</span>
        <input id="auth-pass" name="password" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" minlength="8" required></label>
      ${create ? `<label class="field" for="auth-pass2"><span class="label">Passwort wiederholen</span>
        <input id="auth-pass2" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="muted small">Mindestens 8 Zeichen.</p>` : ''}
      <p class="form-error" id="auth-error" role="alert"></p>
      <p class="form-info" id="auth-info" role="status"></p>
      <button class="btn primary big" type="submit" id="auth-submit">${create ? 'Konto erstellen' : 'Anmelden'}</button>
      ${create ? '' : '<button type="button" class="link-btn" data-action="pw-forgot">Passwort vergessen?</button>'}
    </form>
    <p class="muted small">Deine Portionen werden dann in deinem Konto gespeichert und sind auf jedem Gerät da, auf dem du dich anmeldest. Portionen, die schon auf diesem Gerät sind, kommen mit ins Konto.</p>`, { label: create ? 'Konto erstellen' : 'Anmelden', cls: 'auth-modal' });
  const form = $('#auth-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#auth-error'), info = $('#auth-info'), btn = $('#auth-submit');
    const email = normEmail($('#auth-email').value), pw = $('#auth-pass').value;
    const problem = emailProblem(email) || (pw.length < 8 ? 'Das Passwort braucht mindestens 8 Zeichen.' : '')
      || (create && pw !== $('#auth-pass2').value ? 'Die beiden Passwörter sind nicht gleich.' : '');
    if (problem) { err.textContent = problem; return; }
    err.textContent = ''; info.textContent = '';
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${create ? 'Konto wird erstellt …' : 'Anmelden …'}`;
    try {
      const res = await cloudLogin(email, pw, create);
      if (res === 'confirm') {
        if (!$('#auth-info')) return;
        info.textContent = `Fast geschafft! Wir haben dir eine E-Mail an ${email} geschickt. Klicke auf den Link darin, dann bist du angemeldet.`;
        btn.disabled = false;
        btn.textContent = 'Konto erstellen';
        return;
      }
      closeModal(true);
      toast(create ? 'Willkommen! Dein Konto ist bereit.' : `Angemeldet als ${email}.`);
      render();
    } catch (ex) {
      if (!$('#auth-error')) return;
      err.textContent = cloudErrorText(ex);
      btn.disabled = false;
      btn.textContent = create ? 'Konto erstellen' : 'Anmelden';
    }
  });
}

/** „Passwort vergessen?“: Link per E-Mail schicken */
async function forgotPassword() {
  const err = $('#auth-error'), info = $('#auth-info');
  if (!err) return;
  const email = normEmail($('#auth-email').value);
  const problem = emailProblem(email);
  if (problem) { err.textContent = `${problem} Dann schicken wir dir einen Link für ein neues Passwort.`; $('#auth-email').focus(); return; }
  err.textContent = ''; info.textContent = 'E-Mail wird verschickt …';
  try {
    await cloudResetPassword(email);
    if ($('#auth-info')) info.textContent = `Wenn es ein Konto mit ${email} gibt, ist jetzt eine E-Mail unterwegs. Klicke auf den Link darin und wähle ein neues Passwort.`;
  } catch (ex) {
    if (!$('#auth-error')) return;
    info.textContent = '';
    err.textContent = cloudErrorText(ex);
  }
}

/** Nach dem Link aus der „Passwort vergessen“-E-Mail: neues Passwort festlegen */
function openNewPassword() {
  openModal(`
    <header class="modal-head"><h2>Neues Passwort</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <p class="muted">Du bist angemeldet als <strong>${esc(cloud.user)}</strong>. Wähle jetzt ein neues Passwort.</p>
    <form class="auth-form" id="newpw-form" novalidate>
      <input type="email" name="email" autocomplete="username" value="${esc(cloud.user)}" hidden>
      <label class="field" for="newpw-1"><span class="label">Neues Passwort</span><input id="newpw-1" type="password" autocomplete="new-password" minlength="8" autofocus></label>
      <label class="field" for="newpw-2"><span class="label">Passwort wiederholen</span><input id="newpw-2" type="password" autocomplete="new-password" minlength="8"></label>
      <p class="form-error" id="newpw-error" role="alert"></p>
      <button class="btn primary big" type="submit">Passwort speichern</button>
    </form>`, { label: 'Neues Passwort', cls: 'auth-modal' });
  $('#newpw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('#newpw-1').value, b = $('#newpw-2').value, err = $('#newpw-error');
    if (a.length < 8) { err.textContent = 'Das Passwort braucht mindestens 8 Zeichen.'; return; }
    if (a !== b) { err.textContent = 'Die beiden Passwörter sind nicht gleich.'; return; }
    try {
      await cloudChangePassword(a);
      closeModal(true);
      toast('Neues Passwort gespeichert. Du bist angemeldet.');
      cloudSync();
    } catch (ex) { err.textContent = cloudErrorText(ex); }
  });
}

function openAccount() {
  openModal(`
    <header class="modal-head"><h2>Dein Konto</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <div class="account-card">
      <span class="account-avatar" aria-hidden="true">${esc(cloud.user.charAt(0).toUpperCase())}</span>
      <div><strong>${esc(cloud.user)}</strong><p class="small" id="acct-status">${accountStatusText()}</p></div>
    </div>
    <p class="muted small">Deine Portionen werden automatisch in deinem Konto gespeichert. Beim Abmelden werden sie von diesem Gerät entfernt – sie bleiben in deinem Konto und sind beim nächsten Anmelden wieder da.</p>
    <div class="row">
      <button type="button" class="btn primary" data-action="classes">${icon('user')} Klassen & Kinder-Logins</button>
      <button type="button" class="btn secondary" data-action="cloud-sync">${icon('flip')} Jetzt abgleichen</button>
      <button type="button" class="btn ghost" data-action="logout">Abmelden</button>
    </div>
    <details class="pw-change"><summary>Passwort ändern</summary>
      <form id="pw-form" class="auth-form" novalidate>
        <input type="email" name="email" autocomplete="username" value="${esc(cloud.user)}" hidden>
        <label class="field" for="pw-new"><span class="label">Neues Passwort</span><input id="pw-new" type="password" autocomplete="new-password" minlength="8"></label>
        <p class="form-error" id="pw-error" role="alert"></p>
        <button type="submit" class="btn small primary">Speichern</button>
      </form>
    </details>
    <details class="pw-change"><summary>E-Mail-Adresse ändern</summary>
      <form id="mail-form" class="auth-form" novalidate>
        <label class="field" for="mail-new"><span class="label">Neue E-Mail-Adresse</span>
          <input id="mail-new" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="200" placeholder="name@schule.ch"></label>
        <label class="field" for="mail-pw"><span class="label">Aktuelles Passwort</span><input id="mail-pw" type="password" autocomplete="current-password"></label>
        <p class="form-error" id="mail-error" role="alert"></p>
        <p class="form-info" id="mail-info" role="status"></p>
        <button type="submit" class="btn small primary" id="mail-submit">E-Mail-Adresse ändern</button>
      </form>
    </details>`, { label: 'Konto' });
  $('#mail-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#mail-error'), info = $('#mail-info'), btn = $('#mail-submit');
    const email = normEmail($('#mail-new').value), pw = $('#mail-pw').value;
    const problem = emailProblem(email) || (email === normEmail(cloud.user) ? 'Das ist schon deine E-Mail-Adresse.' : '') || (!pw ? 'Gib zur Sicherheit dein aktuelles Passwort ein.' : '');
    if (problem) { err.textContent = problem; info.textContent = ''; return; }
    err.textContent = ''; info.textContent = '';
    btn.disabled = true;
    try {
      const res = await cloudChangeEmail(email, pw);
      if (res === 'done') {
        openAccount();
        toast(`Deine E-Mail-Adresse ist jetzt ${email}. Melde dich ab jetzt damit an.`);
        return;
      }
      if (!$('#mail-info')) return;
      $('#mail-pw').value = '';
      info.textContent = `Fast geschafft! Wir haben eine E-Mail an ${email} geschickt (eventuell auch eine an deine bisherige Adresse). Klicke auf den Link darin – erst dann gilt die neue Adresse. Bis dahin meldest du dich weiter mit ${cloud.user} an.`;
    } catch (ex) {
      if (!$('#mail-error')) return;
      err.textContent = ['email_exists', 'user_already_exists'].includes(ex?.code) || /already (registered|exists)/i.test(ex?.message || '')
        ? 'Diese E-Mail-Adresse gehört schon zu einem anderen Konto.'
        : cloudErrorText(ex);
    } finally {
      if ($('#mail-submit')) btn.disabled = false;
    }
  });
  $('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('#pw-new').value, err = $('#pw-error');
    if (pw.length < 8) { err.textContent = 'Das Passwort braucht mindestens 8 Zeichen.'; return; }
    try { await cloudChangePassword(pw); err.textContent = ''; $('#pw-new').value = ''; toast('Passwort geändert.'); } catch (ex) { err.textContent = cloudErrorText(ex); }
  });
}

/* ---------- Portionen von anderen finden (öffentliche Suche) ----------
   Nur Portionen, die ihr Besitzer im Teilen-Fenster für die Suche freigibt. Öffentlich gespeichert wird eine
   bereinigte Kopie: Name, Vokabeln und Bildauswahl – keine eigenen Fotos, kein Übungsstand, keine E-Mail-Adresse.
   Suchen und übernehmen geht auch ohne Konto. */
const PUBLIC_TABLE = 'vokabelwelt_public';
const pub = { results: [], q: '', busy: false, seq: 0 };

function publicCopy(set) {
  const words = set.words.filter((w) => w.foreign).slice(0, 400).map((w) => {
    const code = picToCode(w.pic);
    return code ? [w.foreign, w.german || '', code] : [w.foreign, w.german || ''];
  });
  const search = [set.name, ...words.flatMap(([f, g]) => [f, g])].join(' | ').toLowerCase().slice(0, 20000);
  return { user_id: cloud.uid, set_id: set.id, name: String(set.name || 'Vokabeln').slice(0, 200), words, search, pic_style: set.picStyle || 'picto' };
}
async function cloudPublish(sets) {
  const list = [].concat(sets).filter((s) => s && s.published && s.words.some((w) => w.foreign));
  if (!cloud.uid || !list.length) return;
  const c = await cloudClient();
  const { error } = await c.from(PUBLIC_TABLE).upsert(list.map(publicCopy), { onConflict: 'user_id,set_id' });
  if (error) throw error;
}
async function cloudUnpublish(setId) {
  if (!cloud.uid) return;
  const c = await cloudClient();
  const { error } = await c.from(PUBLIC_TABLE).delete().eq('set_id', setId);
  if (error) throw error;
}
/** Suche: alle Wörter müssen im Namen oder in den Vokabeln vorkommen. Leer: die neuesten. */
async function publicSearch(q) {
  const c = await cloudClient();
  const terms = String(q || '').toLowerCase().replace(/[%_*(),.:;"'\\|]/g, ' ').split(/\s+/).filter((t) => t.length >= 2).slice(0, 4);
  let query = c.from(PUBLIC_TABLE).select('set_id,name,words,word_count,pic_style,updated_at').order('updated_at', { ascending: false }).limit(30);
  terms.forEach((t) => { query = query.or(`name.ilike."*${t}*",search.ilike."*${t}*"`); });
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).filter((r) => r && Array.isArray(r.words) && r.words.length);
}

/** Suchfeld in der Titelleiste (am Handy hinter der Lupe) */
function searchSlotHTML() {
  if (!cloudConfigured() || isKid()) return '';
  return `<div class="top-search" id="top-search">
    <button type="button" class="icon-btn search-toggle" data-action="search-open" aria-label="Portionen von anderen suchen" title="Portionen von anderen suchen">${icon('search')}</button>
    <form class="top-search-form" id="pub-form" role="search" autocomplete="off">
      ${icon('search')}
      <input id="pub-q" type="search" placeholder="Portionen von anderen suchen" aria-label="Portionen von anderen suchen" aria-controls="pub-pop" aria-expanded="false" enterkeyhint="search">
      <button type="button" class="icon-btn subtle search-close" data-action="search-close" aria-label="Suche schließen">${icon('x')}</button>
    </form>
    <div class="pub-pop" id="pub-pop" hidden><div id="pub-results" aria-live="polite"></div></div>
  </div>`;
}
function pubResultsHTML() {
  const head = pub.q ? `Treffer für „${esc(pub.q)}“` : 'Neu in der Suche';
  if (!pub.results.length) {
    return `<p class="pub-empty">${pub.q ? `Nichts gefunden für „${esc(pub.q)}“.` : 'Noch keine Portionen in der Suche.'}
      <small>Hier erscheinen nur Portionen, die jemand unter Teilen → „In der Suche zeigen“ freigegeben hat.</small></p>`;
  }
  return `<p class="pub-head">${head}</p><ul class="lib-list">${pub.results.map((r, i) => {
    const sample = r.words.slice(0, 4).map((w) => w[0]).join(', ');
    return `<li class="lib-item"><button class="lib-open" data-action="pub-open" data-i="${i}">
      <span class="lib-text"><strong>${esc(r.name)}</strong><small>${r.word_count || r.words.length} Vokabeln · ${esc(sample)}${r.words.length > 4 ? ' …' : ''}</small></span>
    </button></li>`;
  }).join('')}</ul>`;
}
const pubPopOpen = () => !!$('#pub-pop') && !$('#pub-pop').hidden;
function showPubPop(show) {
  const pop = $('#pub-pop'), q = $('#pub-q');
  if (!pop) return;
  pop.hidden = !show;
  q?.setAttribute('aria-expanded', String(show));
}
function openTopSearch() {
  $('.topbar')?.classList.add('searching');
  const q = $('#pub-q');
  q?.focus();
}
function closeTopSearch() {
  showPubPop(false);
  $('.topbar')?.classList.remove('searching');
  $('#pub-q')?.blur();
}
function bindTopSearch() {
  const form = $('#pub-form'), input = $('#pub-q');
  if (!form) return;
  const run = async (q) => {
    const box = $('#pub-results');
    const seq = ++pub.seq;
    pub.q = q.trim();
    showPubPop(true);
    box.innerHTML = '<p class="pub-empty"><span class="spinner"></span> Suche …</p>';
    try {
      const res = await publicSearch(pub.q);
      if (seq !== pub.seq) return;
      pub.results = res;
      box.innerHTML = pubResultsHTML();
    } catch (e) {
      if (seq !== pub.seq) return;
      box.innerHTML = `<p class="warn">${esc(cloudErrorText(e))}</p>`;
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); });
  const live = debounce(() => { const v = input.value.trim(); if (v.length >= 2 || !v) run(v); }, 400);
  input.addEventListener('input', live);
  input.addEventListener('focus', () => { if (pub.seq) showPubPop(true); else run(''); });
  // Klick daneben schließt die Trefferliste
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#top-search') && !e.target.closest('.modal-wrap')) closeTopSearch();
  });
}

/** Vorschau einer gefundenen Portion, mit „Übernehmen“ */
function openPublicPreview(i) {
  const r = pub.results[i];
  if (!r) return;
  closeTopSearch();
  openModal(`
    <header class="modal-head"><div><p class="eyebrow">${flag()} ${r.word_count || r.words.length} Vokabeln</p><h2>${esc(r.name)}</h2></div>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <div class="preview-table pub-preview" role="table" aria-label="Vokabeln">
      <div class="pt-row pt-head" role="row"><span role="columnheader">${flag()} Englisch</span><span role="columnheader">Deutsch</span></div>
      ${r.words.map((w) => `<div class="pt-row" role="row"><span role="cell" lang="en">${esc(w[0])}</span><span role="cell" lang="de">${esc(w[1] || '')}</span></div>`).join('')}
    </div>
    <footer class="modal-foot">
      <button type="button" class="btn ghost" data-action="close-modal">Abbrechen</button>
      <button type="button" class="btn primary" data-action="pub-take" data-i="${i}">${icon('plus')} Übernehmen</button>
    </footer>`, { cls: 'wide', label: r.name });
}
function takePublicSet(i) {
  const r = pub.results[i];
  if (!r) return;
  const ref = `pub:${r.set_id}:${r.name}`;
  const existing = db.sets.find((s) => s.publicRef === ref);
  closeModal(true);
  if (existing) { openSet(existing.id); toast(`„${existing.name}“ hast du schon.`); return; }
  const set = newSet({
    name: r.name, lang: 'en', picStyle: ['picto', 'clipart', 'emoji'].includes(r.pic_style) ? r.pic_style : 'picto',
    rows: r.words.map((w) => ({ foreign: String(w[0] || ''), german: String(w[1] || ''), pic: codeToPic(w[2]) })).filter((x) => x.foreign),
  });
  set.publicRef = ref;
  saveDB();
  openSet(set.id);
  toast(`„${set.name}“ ist jetzt bei deinen Portionen.`);
}

/** Schalter im Teilen-Fenster */
function publishBoxHTML(set) {
  if (!cloudConfigured()) return '';
  return `<div class="pub-box">
    <label class="switch"><input type="checkbox" id="pub-on" ${set.published ? 'checked' : ''} ${cloud.user ? '' : 'disabled'}><span>In der Suche zeigen</span></label>
    <p class="muted small">Dann finden andere „${esc(set.name)}“ über die Suche oben und können sie übernehmen. Geteilt werden nur die Vokabeln und die Bildauswahl – keine eigenen Fotos, kein Übungsstand, nicht deine E-Mail-Adresse.</p>
    ${cloud.user ? '' : '<p class="small">Dafür musst du angemeldet sein. <button type="button" class="link-btn" data-action="login">Anmelden</button></p>'}
    <p class="form-error" id="pub-error" role="alert"></p>
  </div>`;
}
function bindPublishBox(set) {
  const cb = $('#pub-on');
  if (!cb) return;
  cb.addEventListener('change', async () => {
    const on = cb.checked, err = $('#pub-error');
    err.textContent = '';
    cb.disabled = true;
    set.published = on;
    try {
      if (on) await cloudPublish(set); else await cloudUnpublish(set.id);
      saveDB();
      toast(on ? `„${set.name}“ ist jetzt in der Suche zu finden.` : `„${set.name}“ ist nicht mehr in der Suche.`);
    } catch (e) {
      set.published = !on;
      cb.checked = !on;
      if ($('#pub-error')) err.textContent = cloudErrorText(e);
    } finally {
      cb.disabled = false;
    }
  });
}
