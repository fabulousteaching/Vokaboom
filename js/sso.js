/* fabulousteaching – gemeinsame Anmeldung für Vokaboom und Einmaleins
 *
 * Laufen beide Tools unter *.fabulousteaching.ch (vokaboom.… und einmaleins.…), teilen sie sich die
 * Anmeldung über Cookies dieser Domain:
 *  - Lehrperson: Die Supabase-Sitzung liegt in einem gemeinsamen Cookie (statt nur im Browser-Speicher
 *    des einzelnen Tools). Anmelden oder Abmelden im einen Tool gilt damit auch im anderen.
 *  - Kind: Ein kleines Cookie sagt, welches Kind auf diesem Gerät angemeldet ist (Benutzername,
 *    Tool und Anmelde-Schlüssel). Das andere Tool meldet das Kind damit ebenfalls an.
 * Läuft ein Tool unter einer anderen Adresse (z. B. github.io oder lokal), arbeitet es wie bisher allein.
 * Diese Datei ist in beiden Repositories gleich.
 */
'use strict';

const SSO = (() => {
  const DOMAIN = /(^|\.)fabulousteaching\.ch$/i.test(location.hostname) ? 'fabulousteaching.ch' : '';
  const AUTH = 'fbt_auth', OUT = 'fbt_auth_out', KID = 'fbt_kid';
  const CHUNK = 3600, MAX_CHUNKS = 6, MAX_AGE = 400 * 86400;

  const esc = (s) => s.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&');
  const read = (name) => {
    const m = document.cookie.match(new RegExp('(?:^|; )' + esc(name) + '=([^;]*)'));
    return m ? m[1] : null;
  };
  const write = (name, val, maxAge = MAX_AGE) => {
    document.cookie = `${name}=${val}; Domain=${DOMAIN}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
  };
  const del = (name) => { document.cookie = `${name}=; Domain=${DOMAIN}; Path=/; Max-Age=0; Secure; SameSite=Lax`; };

  // Text ↔ Base64url (nur Zeichen, die in Cookies erlaubt sind)
  const b64 = (s) => {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64 = (s) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  /* ---------- Sitzung der Lehrperson (in Stücken, weil ein Cookie höchstens ~4 KB fasst) ---------- */
  function readAuth() {
    const n = Number(read(AUTH + '_n')) || 0;
    if (!n) return null;
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = read(`${AUTH}_${i}`);
      if (c == null) return null;
      s += c;
    }
    try { return unb64(s); } catch { return null; }
  }
  function writeAuth(val) {
    const enc = b64(val);
    const parts = [];
    for (let i = 0; i < enc.length; i += CHUNK) parts.push(enc.slice(i, i + CHUNK));
    if (parts.length > MAX_CHUNKS) return false;
    const old = Number(read(AUTH + '_n')) || 0;
    parts.forEach((p, i) => write(`${AUTH}_${i}`, p));
    write(AUTH + '_n', String(parts.length));
    for (let i = parts.length; i < old; i++) del(`${AUTH}_${i}`);
    if (readAuth() !== val) return false;
    del(OUT);
    return true;
  }
  function clearAuth() {
    const n = Math.max(Number(read(AUTH + '_n')) || 0, MAX_CHUNKS);
    for (let i = 0; i < n; i++) del(`${AUTH}_${i}`);
    del(AUTH + '_n');
    write(OUT, String(Date.now()), 30 * 86400); // „abgemeldet“: alte Sitzungen im Browser-Speicher nicht wiederbeleben
  }

  /**
   * Speicher für supabase-js (Option auth.storage). localKey = bisheriger Schlüssel im Browser-Speicher.
   * Mit gemeinsamer Domain liegt die Sitzung im Cookie; eine ältere Sitzung im Browser-Speicher zieht einmal dorthin um.
   */
  function authStorage(localKey) {
    const ls = window.localStorage;
    const lsGet = (k) => { try { return ls.getItem(k); } catch { return null; } };
    const lsSet = (k, v) => { try { ls.setItem(k, v); } catch { /* */ } };
    const lsDel = (k) => { try { ls.removeItem(k); } catch { /* */ } };
    return {
      getItem(key) {
        if (!DOMAIN || key !== localKey) return lsGet(key);
        const v = readAuth();
        if (v != null) { if (lsGet(key) != null) lsDel(key); return v; }
        const old = lsGet(key);
        if (old == null) return null;
        if (read(OUT)) { lsDel(key); return null; } // inzwischen im anderen Tool abgemeldet
        if (writeAuth(old)) lsDel(key);
        return old;
      },
      setItem(key, val) {
        if (!DOMAIN || key !== localKey) { lsSet(key, val); return; }
        if (writeAuth(val)) lsDel(key); else lsSet(key, val); // zu gross fürs Cookie: wie bisher nur hier
      },
      removeItem(key) {
        lsDel(key);
        if (DOMAIN && key === localKey) clearAuth();
      },
    };
  }

  /* ---------- Angemeldetes Kind ---------- */
  const kid = {
    /** { u: Benutzername, tool: 'v' | 'e', t: Anmelde-Schlüssel dieses Tools } oder null */
    get() {
      if (!DOMAIN) return null;
      try {
        const d = JSON.parse(decodeURIComponent(read(KID) || ''));
        return d && typeof d.u === 'string' && typeof d.t === 'string' && (d.tool === 'v' || d.tool === 'e') ? d : null;
      } catch { return null; }
    },
    set(d) {
      if (!DOMAIN) return false;
      write(KID, encodeURIComponent(JSON.stringify({ u: d.u, tool: d.tool, t: d.t })));
      return !!kid.get();
    },
    clear() { if (DOMAIN) del(KID); },
  };

  /** Lehrperson auf diesem Gerät angemeldet (in irgendeinem der Tools)? */
  const teacherSignedIn = (localKey) => !!authStorage(localKey).getItem(localKey);

  return { DOMAIN, authStorage, kid, teacherSignedIn };
})();
