/* Avatar – gemeinsam für Vokaboom und Teilmal (diese Datei ist in beiden Tools gleich)
 *
 * Kinder mit Login-Kärtchen gestalten im Bereich „Mein Avatar“ ihre eigene Ganzkörper-Figur:
 * Hautfarbe, Augen, Mund, Haare (Frisur und Farbe), Oberteil, Hose/Rock, Schuhe, Hut, Brille,
 * etwas in der Hand, etwas auf dem Rücken, ein Haustier und einen Hintergrund.
 * Das Basic-Set ist gratis. Weitere Teile kosten Münzen – die verdienen die Kinder beim Üben.
 *
 * Gespeichert wird in Supabase (supabase/avatar.sql): Avatar, gekaufte Teile und Münzen.
 * Verbundene Kinder (gleiches Login in Vokaboom und Teilmal) haben denselben Avatar und dieselben Münzen.
 * Preise und Tageslimit prüft die Datenbank, nicht der Browser.
 *
 * Braucht vom Tool: cloudClient(), kid.token, isKid(), avToast() – in beiden Tools vorhanden.
 * Welches Tool: window.AVATAR_APP ('vokaboom' oder 'einmaleins'); ohne Angabe 'vokaboom'.
 */
'use strict';

const AV_APP = window.AVATAR_APP || 'vokaboom';
const avEsc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const avAll = (sel) => [...document.querySelectorAll(sel)];
const avToast = (msg, kind) => (typeof window.toast === 'function' ? window.toast(msg, kind) : console.log(msg));
const AV_POINTS_PER_COIN = 10;
const AV = { state: null, loading: null, draft: null, cat: 'body', tried: null, busy: false, pts: 0, capWarned: false };

/* ---------------- Katalog ---------------- */
// price: Münzen (0 = Basic-Set). Die Preise der Datenbank (fab_avatar_items) sind massgebend.
const AV_COLORS = {
  skin: [['s1', '#FCE3D3'], ['s2', '#F6CFB0'], ['s3', '#E9B48C'], ['s4', '#D59A6C'], ['s5', '#B97A4F'], ['s6', '#93593A'], ['s7', '#6E4129'], ['s8', '#4B2B1C']],
  hairc: [['brown', '#6B4226'], ['dark', '#3B2416'], ['black', '#1F1A1D'], ['blond', '#E8C26A'], ['red', '#B4472B'], ['ginger', '#D9772F'], ['gray', '#B9B6C3'],
    ['pink', '#F472B6', 8], ['mint', '#4ED6B4', 8], ['violet', '#8B5CF6', 8], ['rainbow', 'url(#av-rainbow)', 20]],
  topc: [['indigo', '#5B54E8'], ['pink', '#E8478F'], ['teal', '#14A39A'], ['sun', '#FFBE2E'], ['red', '#E2483D'], ['green', '#3DAA5B'], ['sky', '#48A7F0'], ['white', '#F4F4F8'], ['gray', '#7C8197'],
    ['gold', 'url(#av-gold)', 15], ['galaxy', 'url(#av-galaxy)', 20]],
  bottomc: [['denim', '#3E63B5'], ['navy', '#26305E'], ['black', '#2B2B33'], ['khaki', '#B59B6A'], ['pink', '#E47FB0'], ['teal', '#1E9A8E'], ['white', '#EDEDF3']],
};
const AV_ITEMS = {
  hair: [['short', 'Kurz'], ['bob', 'Bob'], ['long', 'Lang'], ['ponytail', 'Pferdeschwanz'], ['buns', 'Dutts'], ['curly', 'Locken'], ['spiky', 'Stachelig'], ['braids', 'Zöpfe'], ['buzz', 'Raspel'],
    ['mohawk', 'Irokese', 15], ['wavy', 'Wellen', 12], ['space', 'Space-Dutts', 18]],
  eyes: [['round', 'Rund'], ['dot', 'Punkte'], ['happy', 'Fröhlich'], ['wink', 'Zwinkern'], ['sleepy', 'Verschlafen'], ['lashes', 'Wimpern'], ['star', 'Sterne', 12], ['heart', 'Herzen', 12]],
  mouth: [['smile', 'Lächeln'], ['grin', 'Grinsen'], ['open', 'Staunen'], ['cat', 'Katzenmund'], ['smirk', 'Schmunzeln'], ['tongue', 'Zunge', 6]],
  face: [['none', 'Nichts'], ['blush', 'Rote Bäckchen'], ['freckles', 'Sommersprossen', 5], ['stars', 'Glitzer', 10]],
  glasses: [['none', 'Keine'], ['round', 'Rund'], ['square', 'Eckig'], ['sun', 'Sonnenbrille'], ['star', 'Sternbrille', 12], ['heart', 'Herzbrille', 12]],
  top: [['tshirt', 'T-Shirt'], ['hoodie', 'Hoodie'], ['stripes', 'Ringel'], ['sweater', 'Pulli mit Herz'], ['dress', 'Kleid'], ['jersey', 'Trikot'],
    ['hero', 'Superheld', 25], ['space', 'Raumanzug', 30], ['tux', 'Anzug', 22], ['rainbow', 'Regenbogen', 20], ['kimono', 'Kimono', 22]],
  bottom: [['jeans', 'Hose'], ['shorts', 'Shorts'], ['skirt', 'Rock'], ['leggings', 'Leggings'], ['sparkle', 'Glitzerrock', 18], ['cargo', 'Cargohose', 10]],
  shoes: [['sneakers', 'Turnschuhe'], ['boots', 'Stiefel'], ['sandals', 'Sandalen'], ['rocket', 'Raketenschuhe', 20], ['roller', 'Rollschuhe', 18]],
  hat: [['none', 'Nichts'], ['cap', 'Cap'], ['beanie', 'Mütze'], ['flower', 'Blume'], ['headphones', 'Kopfhörer'], ['bow', 'Masche'],
    ['party', 'Partyhut', 10], ['cat', 'Katzenohren', 15], ['viking', 'Wikingerhelm', 22], ['wizard', 'Zauberhut', 25], ['crown', 'Krone', 30]],
  back: [['none', 'Nichts'], ['cape', 'Umhang', 30], ['wings', 'Flügel', 40], ['jetpack', 'Jetpack', 40], ['dragon', 'Drachenflügel', 45]],
  hand: [['none', 'Nichts'], ['book', 'Buch'], ['ball', 'Ball'], ['wand', 'Zauberstab', 18], ['trophy', 'Pokal', 20], ['guitar', 'Gitarre', 25]],
  pet: [['none', 'Keins'], ['cat', 'Katze', 35], ['dog', 'Hund', 35], ['bunny', 'Hase', 35], ['owl', 'Eule', 40], ['dragon', 'Mini-Drache', 50]],
  bg: [['lilac', 'Flieder'], ['sky', 'Himmel'], ['mint', 'Minze'], ['peach', 'Pfirsich'], ['beach', 'Strand', 15], ['jungle', 'Dschungel', 15], ['rainbow', 'Regenbogen', 18], ['space', 'Weltall', 20], ['castle', 'Schloss', 25]],
};
const AV_SLOT_NAMES = { skin: 'Hautfarbe', eyes: 'Augen', mouth: 'Mund', face: 'Gesicht', glasses: 'Brille', hair: 'Frisur', hairc: 'Haarfarbe', top: 'Oberteil', topc: 'Farbe Oberteil',
  bottom: 'Hose / Rock', bottomc: 'Farbe Hose / Rock', shoes: 'Schuhe', hat: 'Auf dem Kopf', hand: 'In der Hand', back: 'Auf dem Rücken', pet: 'Haustier', bg: 'Hintergrund' };
const AV_CATS = [
  ['body', '🙂', 'Körper', ['skin']],
  ['face', '😊', 'Gesicht', ['eyes', 'mouth', 'face', 'glasses']],
  ['hair', '💇', 'Haare', ['hair', 'hairc']],
  ['top', '👕', 'Oberteil', ['top', 'topc']],
  ['legs', '👖', 'Unten', ['bottom', 'bottomc', 'shoes']],
  ['extra', '🎩', 'Extras', ['hat', 'hand', 'back']],
  ['pet', '🐾', 'Haustier', ['pet']],
  ['bg', '🖼️', 'Hintergrund', ['bg']],
];
const AV_DEFAULT = { skin: 's3', eyes: 'round', mouth: 'smile', face: 'blush', glasses: 'none', hair: 'short', hairc: 'brown', top: 'tshirt', topc: 'teal',
  bottom: 'jeans', bottomc: 'denim', shoes: 'sneakers', hat: 'none', hand: 'none', back: 'none', pet: 'none', bg: 'lilac' };

/** Alle Teile eines Platzes: [{ id, name, price, color? }] */
function avOptions(slot) {
  if (AV_COLORS[slot]) {
    const names = { s1: 'Sehr hell', s2: 'Hell', s3: 'Mittel', s4: 'Gebräunt', s5: 'Braun', s6: 'Dunkel', s7: 'Sehr dunkel', s8: 'Tiefbraun',
      brown: 'Braun', dark: 'Dunkelbraun', black: 'Schwarz', blond: 'Blond', red: 'Rot', ginger: 'Kupfer', gray: 'Grau', pink: 'Pink', mint: 'Mint', violet: 'Lila', rainbow: 'Regenbogen',
      indigo: 'Indigo', teal: 'Petrol', sun: 'Sonnengelb', green: 'Grün', sky: 'Himmelblau', white: 'Weiss', gold: 'Gold', galaxy: 'Galaxie',
      denim: 'Jeansblau', navy: 'Marine', khaki: 'Khaki' };
    return AV_COLORS[slot].map(([id, color, price]) => ({ id, name: names[id] || id, price: price || 0, color }));
  }
  return (AV_ITEMS[slot] || []).map(([id, name, price]) => ({ id, name, price: price || 0 }));
}
const avKey = (slot, id) => `${slot}:${id}`;
const avPrice = (slot, id) => avOptions(slot).find((o) => o.id === id)?.price || 0;
const avOwned = (slot, id) => !avPrice(slot, id) || !!AV.state?.owned?.includes(avKey(slot, id));
const avColor = (slot, id) => (AV_COLORS[slot].find((c) => c[0] === id) || AV_COLORS[slot][0])[1];

/** Vollständiger Avatar (fehlende Teile mit Basic-Werten auffüllen, unbekannte verwerfen) */
function avFill(a = {}) {
  const out = { ...AV_DEFAULT };
  for (const k of Object.keys(AV_DEFAULT)) if (a && a[k] && avOptions(k).some((o) => o.id === a[k])) out[k] = a[k];
  return out;
}
/** Start-Avatar je nach Benutzername etwas verschieden */
function avStarter(seed = '') {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = (slot) => { const free = avOptions(slot).filter((o) => !o.price && o.id !== 'none'); return free[(h = (h * 1103515245 + 12345) >>> 0) % free.length].id; };
  return avFill({ skin: pick('skin'), hair: pick('hair'), hairc: pick('hairc'), top: pick('top'), topc: pick('topc'), eyes: 'round', mouth: 'smile', face: 'blush' });
}

/* ---------------- Zeichnen ---------------- */
function avShade(hex, amt) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map(f).map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
const AV_DEFS = `<defs>
  <linearGradient id="av-rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5E7E"/><stop offset=".25" stop-color="#FFB13D"/><stop offset=".5" stop-color="#5BD47A"/><stop offset=".75" stop-color="#4CA8FF"/><stop offset="1" stop-color="#A66BFF"/></linearGradient>
  <linearGradient id="av-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE38A"/><stop offset=".5" stop-color="#F5B400"/><stop offset="1" stop-color="#C98A00"/></linearGradient>
  <linearGradient id="av-galaxy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B1A6B"/><stop offset=".55" stop-color="#6D28D9"/><stop offset="1" stop-color="#DB2777"/></linearGradient>
  <radialGradient id="av-shine" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>`;

function avBg(id) {
  const g = (a, b) => `<defs><linearGradient id="avbg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="200" height="300" fill="url(#avbg-${id})"/>`;
  switch (id) {
    case 'sky': return g('#CFE6FF', '#EEF6FF') + '<g fill="#fff" opacity=".9"><ellipse cx="44" cy="52" rx="22" ry="9"/><ellipse cx="58" cy="46" rx="14" ry="10"/><ellipse cx="160" cy="80" rx="20" ry="8"/></g>';
    case 'mint': return g('#C9F2E1', '#EFFBF5') + '<g fill="#fff" opacity=".6"><circle cx="30" cy="40" r="5"/><circle cx="170" cy="60" r="4"/><circle cx="160" cy="150" r="6"/></g>';
    case 'peach': return g('#FFDCC8', '#FFF4EC') + '<circle cx="168" cy="44" r="18" fill="#FFB98F" opacity=".6"/>';
    case 'beach': return '<rect width="200" height="300" fill="#9ED8FF"/><circle cx="160" cy="44" r="18" fill="#FFD84D"/><rect y="170" width="200" height="40" fill="#3FA9E8"/><path d="M0 172 q25 -8 50 0 t50 0 t50 0 t50 0 v6 h-200z" fill="#7FD0FF"/><rect y="210" width="200" height="90" fill="#F5DCA0"/><g fill="#E9C77E"><circle cx="30" cy="250" r="2"/><circle cx="170" cy="270" r="2"/><circle cx="120" cy="290" r="2"/></g>';
    case 'jungle': return g('#BDE8B0', '#E8F8DF') + '<g fill="#3DAA5B" opacity=".8"><path d="M0 60 q40 10 30 60 q-20 -30 -30 -20z"/><path d="M200 40 q-50 10 -36 70 q16 -34 36 -26z"/><path d="M0 200 q30 -10 40 40 q-24 -20 -40 -10z"/><path d="M200 190 q-30 0 -36 48 q20 -24 36 -20z"/></g><g fill="#2E8A49"><circle cx="20" cy="120" r="6"/><circle cx="185" cy="120" r="5"/></g>';
    case 'rainbow': return g('#FDF4FF', '#EEF2FF') + '<g fill="none" stroke-width="10" opacity=".55"><path d="M10 170 a90 90 0 0 1 180 0" stroke="#FF8FA3"/><path d="M20 170 a80 80 0 0 1 160 0" stroke="#FFC46B"/><path d="M30 170 a70 70 0 0 1 140 0" stroke="#7BDA8F"/><path d="M40 170 a60 60 0 0 1 120 0" stroke="#7EBBFF"/><path d="M50 170 a50 50 0 0 1 100 0" stroke="#B994FF"/></g>';
    case 'space': return '<rect width="200" height="300" fill="#141A3D"/><g fill="#fff"><circle cx="20" cy="30" r="1.4"/><circle cx="60" cy="80" r="1"/><circle cx="150" cy="24" r="1.6"/><circle cx="180" cy="110" r="1.1"/><circle cx="30" cy="170" r="1.3"/><circle cx="175" cy="200" r="1"/><circle cx="110" cy="40" r=".9"/><circle cx="12" cy="250" r="1.2"/></g><circle cx="160" cy="60" r="20" fill="#F59E0B"/><ellipse cx="160" cy="60" rx="32" ry="7" fill="none" stroke="#FCD34D" stroke-width="3" transform="rotate(-18 160 60)"/><circle cx="38" cy="110" r="9" fill="#8B5CF6" opacity=".8"/>';
    case 'castle': return g('#C7B8FF', '#F3EEFF') + '<g fill="#8E7FD6" opacity=".7"><path d="M20 230 v-70 h12 v-10 h8 v10 h8 v-10 h8 v10 h12 v70z"/><path d="M130 230 v-90 h12 v-12 h8 v12 h8 v-12 h8 v12 h12 v90z"/><path d="M68 230 v-50 h64 v50z"/><path d="M90 230 v-20 a10 10 0 0 1 20 0 v20z" fill="#5B4BB0"/></g><path d="M136 140 l8 -18 l8 18z M26 160 l8 -16 l8 16z" fill="#E8478F"/>';
    default: return g('#E4DEFF', '#F6F3FF') + '<g fill="#fff" opacity=".7"><circle cx="26" cy="44" r="4"/><circle cx="176" cy="34" r="3"/><circle cx="168" cy="160" r="5"/><circle cx="20" cy="190" r="3"/></g>';
  }
}

function avBack(id) {
  switch (id) {
    case 'cape': return '<path d="M74 132 Q100 140 126 132 L148 250 Q100 262 52 250 Z" fill="#D7263D"/><path d="M74 132 Q100 140 126 132 L132 160 Q100 168 68 160 Z" fill="#B51F33"/>';
    case 'wings': return '<g fill="#FFFFFF" stroke="#D6DCF5" stroke-width="2"><path d="M80 150 Q30 110 16 150 Q26 160 22 172 Q36 172 38 184 Q52 178 58 190 Q70 174 80 170 Z"/><path d="M120 150 Q170 110 184 150 Q174 160 178 172 Q164 172 162 184 Q148 178 142 190 Q130 174 120 170 Z"/></g>';
    case 'dragon': return '<g fill="#3DAA5B" stroke="#24733C" stroke-width="2" stroke-linejoin="round"><path d="M80 150 L24 112 L34 140 L14 146 L34 160 L22 176 L46 172 L44 192 L80 168 Z"/><path d="M120 150 L176 112 L166 140 L186 146 L166 160 L178 176 L154 172 L156 192 L120 168 Z"/></g>';
    case 'jetpack': return '<g><rect x="60" y="138" width="22" height="58" rx="10" fill="#9AA3B8" stroke="#6B7489" stroke-width="2"/><rect x="118" y="138" width="22" height="58" rx="10" fill="#9AA3B8" stroke="#6B7489" stroke-width="2"/><path class="av-flame" d="M63 196 Q71 230 79 196 Z M121 196 Q129 230 137 196 Z" fill="#FFB13D"/><path d="M66 196 Q71 214 76 196 Z M124 196 Q129 214 134 196 Z" fill="#FFF0A0"/></g>';
    default: return '';
  }
}

function avHairBack(style, H) {
  switch (style) {
    case 'long': return `<path d="M56 92 Q52 170 66 178 L134 178 Q148 170 144 92 Z" fill="${H}"/>`;
    case 'wavy': return `<path d="M56 92 Q44 120 58 140 Q46 160 64 178 Q100 190 136 178 Q154 160 142 140 Q156 120 144 92 Z" fill="${H}"/>`;
    case 'braids': return `<g fill="${H}"><path d="M60 104 q-6 20 0 34 q-6 14 0 28 q4 8 10 0 q6 -14 0 -28 q6 -14 0 -34z"/><path d="M140 104 q6 20 0 34 q6 14 0 28 q-4 8 -10 0 q-6 -14 0 -28 q-6 -14 0 -34z"/></g><g fill="#F472B6"><circle cx="64" cy="168" r="4"/><circle cx="136" cy="168" r="4"/></g>`;
    case 'ponytail': return `<path d="M136 64 Q176 70 168 120 Q164 150 150 156 Q158 120 140 96 Z" fill="${H}"/>`;
    case 'bob': return `<path d="M56 92 Q54 126 64 132 L136 132 Q146 126 144 92 Z" fill="${H}"/>`;
    default: return '';
  }
}
function avHairFront(style, H) {
  const H2 = avShade(H.startsWith('#') ? H : '#8B5CF6', -0.2);
  switch (style) {
    case 'buzz': return `<path d="M60 84 Q62 50 100 48 Q138 50 140 84 Q120 66 100 66 Q80 66 60 84Z" fill="${H}" opacity=".9"/>`;
    case 'spiky': return `<path d="M58 88 L56 60 L70 68 L72 44 L86 58 L96 38 L106 56 L120 40 L124 60 L140 52 L138 72 L146 76 L142 90 Q124 70 100 70 Q76 70 58 88Z" fill="${H}"/>`;
    case 'curly': return `<g fill="${H}">${[[60, 78], [66, 62], [78, 50], [94, 44], [110, 44], [124, 50], [136, 62], [142, 78], [72, 72], [88, 60], [104, 58], [120, 62], [132, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13"/>`).join('')}</g>`;
    case 'mohawk': return `<path d="M60 88 Q60 70 74 66 Q100 66 126 66 Q140 70 140 88 Q120 76 100 76 Q80 76 60 88Z" fill="${H2}" opacity=".7"/><path d="M90 70 L84 30 L96 40 L100 22 L106 40 L116 30 L110 70 Z" fill="${H}"/>`;
    case 'buns': return `<g fill="${H}"><circle cx="70" cy="50" r="15"/><circle cx="130" cy="50" r="15"/><path d="M58 90 Q58 50 100 48 Q142 50 142 90 Q132 68 112 64 Q100 74 76 70 Q64 76 58 90Z"/></g>`;
    case 'space': return `<g fill="${H}"><circle cx="66" cy="54" r="17"/><circle cx="134" cy="54" r="17"/><path d="M58 90 Q58 50 100 48 Q142 50 142 90 Q120 70 100 70 Q80 70 58 90Z"/></g><g fill="#FFE066"><path d="M66 46 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z"/><path d="M134 46 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z"/></g>`;
    case 'ponytail': return `<path d="M58 92 Q58 48 100 46 Q142 48 142 92 Q134 72 118 66 Q104 76 80 72 Q66 78 58 92Z" fill="${H}"/><circle cx="138" cy="66" r="6" fill="#F472B6"/>`;
    case 'bob': return `<path d="M56 100 Q54 48 100 46 Q146 48 144 100 Q140 80 128 70 Q110 80 84 74 Q66 80 56 100Z" fill="${H}"/>`;
    case 'long': case 'wavy': case 'braids': return `<path d="M56 104 Q54 48 100 46 Q146 48 144 104 Q140 78 124 68 Q100 82 76 70 Q60 80 56 104Z" fill="${H}"/>`;
    default: return `<path d="M58 92 Q58 48 100 46 Q142 48 142 92 Q134 70 116 66 Q100 76 78 72 Q64 78 58 92Z" fill="${H}"/>`; // short
  }
}
function avEyes(id) {
  const ink = '#1F1B2E';
  const pair = (fn) => fn(84) + fn(116);
  switch (id) {
    case 'dot': return pair((x) => `<circle cx="${x}" cy="96" r="4.2" fill="${ink}"/>`);
    case 'happy': return pair((x) => `<path d="M${x - 7} 98 Q${x} 89 ${x + 7} 98" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>`);
    case 'wink': return `<g class="av-blink"><ellipse cx="84" cy="96" rx="6" ry="7" fill="#fff"/><circle cx="85" cy="97" r="4" fill="${ink}"/><circle cx="86.5" cy="95" r="1.4" fill="#fff"/></g><path d="M109 97 Q116 92 123 97" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>`;
    case 'sleepy': return pair((x) => `<path d="M${x - 7} 96 Q${x} 102 ${x + 7} 96" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`);
    case 'lashes': return `<g class="av-blink">${pair((x) => `<ellipse cx="${x}" cy="96" rx="6" ry="7" fill="#fff"/><circle cx="${x + 1}" cy="97" r="4" fill="${ink}"/><circle cx="${x + 2.5}" cy="95" r="1.4" fill="#fff"/><path d="M${x - 7} 91 l-4 -3 M${x - 4} 89 l-2 -4" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`)}</g>`;
    case 'star': return pair((x) => `<path d="M${x} 88 l2.6 5.4 5.9 .8 -4.3 4.1 1 5.8 -5.2 -2.8 -5.2 2.8 1 -5.8 -4.3 -4.1 5.9 -.8z" fill="#F5B400" stroke="#C98A00" stroke-width="1"/>`);
    case 'heart': return pair((x) => `<path d="M${x} 102 q-9 -6 -7 -11 q2 -4 7 -1 q5 -3 7 1 q2 5 -7 11z" fill="#E8478F"/>`);
    default: return `<g class="av-blink">${pair((x) => `<ellipse cx="${x}" cy="96" rx="6.5" ry="7.5" fill="#fff"/><circle cx="${x + 1}" cy="97" r="4.6" fill="${ink}"/><circle cx="${x + 2.6}" cy="94.8" r="1.6" fill="#fff"/>`)}</g>`;
  }
}
function avMouth(id) {
  const ink = '#7A2E3A';
  switch (id) {
    case 'grin': return '<path d="M88 110 Q100 124 112 110 Z" fill="#7A2E3A"/><path d="M90 111 Q100 115 110 111 L109 113 Q100 116 91 113Z" fill="#fff"/>';
    case 'open': return '<ellipse cx="100" cy="114" rx="5" ry="6" fill="#7A2E3A"/>';
    case 'cat': return `<path d="M90 110 Q95 116 100 111 Q105 116 110 110" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'smirk': return `<path d="M92 113 Q102 116 110 108" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`;
    case 'tongue': return '<path d="M89 109 Q100 122 111 109 Z" fill="#7A2E3A"/><path d="M95 114 Q100 124 105 114 Z" fill="#F07A8A"/>';
    default: return `<path d="M90 110 Q100 119 110 110" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`;
  }
}
function avFace(id) {
  switch (id) {
    case 'blush': return '<g fill="#FF8FA3" opacity=".45"><ellipse cx="74" cy="108" rx="7" ry="4"/><ellipse cx="126" cy="108" rx="7" ry="4"/></g>';
    case 'freckles': return '<g fill="#B5714A" opacity=".7"><circle cx="72" cy="106" r="1.3"/><circle cx="77" cy="109" r="1.3"/><circle cx="70" cy="111" r="1.2"/><circle cx="128" cy="106" r="1.3"/><circle cx="123" cy="109" r="1.3"/><circle cx="130" cy="111" r="1.2"/></g><g fill="#FF8FA3" opacity=".3"><ellipse cx="74" cy="108" rx="7" ry="4"/><ellipse cx="126" cy="108" rx="7" ry="4"/></g>';
    case 'stars': return '<g fill="#B78BFF"><path d="M70 108 l1.6 3.4 3.7.5 -2.7 2.6.6 3.7 -3.2 -1.8 -3.3 1.8.7 -3.7 -2.7 -2.6 3.7 -.5z"/><circle cx="130" cy="110" r="2.2" fill="#FFB13D"/><circle cx="125" cy="104" r="1.4" fill="#4ED6B4"/></g>';
    default: return '';
  }
}
function avGlasses(id) {
  const frame = (d, fill = 'none', stroke = '#2B2B33') => `<g fill="${fill}" stroke="${stroke}" stroke-width="2.6">${d}</g><path d="M94 96 L106 96" stroke="${stroke}" stroke-width="2.6"/>`;
  switch (id) {
    case 'round': return frame('<circle cx="84" cy="96" r="10"/><circle cx="116" cy="96" r="10"/>', 'rgba(255,255,255,.15)');
    case 'square': return frame('<rect x="73" y="87" width="21" height="17" rx="4"/><rect x="106" y="87" width="21" height="17" rx="4"/>', 'rgba(255,255,255,.15)');
    case 'sun': return frame('<rect x="72" y="88" width="22" height="15" rx="6"/><rect x="106" y="88" width="22" height="15" rx="6"/>', '#1F1B2E');
    case 'star': return frame('<path d="M84 84 l3.6 7.4 8.1 1.1 -5.9 5.7 1.4 8 -7.2 -3.8 -7.2 3.8 1.4 -8 -5.9 -5.7 8.1 -1.1z M116 84 l3.6 7.4 8.1 1.1 -5.9 5.7 1.4 8 -7.2 -3.8 -7.2 3.8 1.4 -8 -5.9 -5.7 8.1 -1.1z"/>', 'rgba(245,180,0,.55)', '#C98A00');
    case 'heart': return frame('<path d="M84 107 q-14 -8 -11 -16 q3 -6 11 -2 q8 -4 11 2 q3 8 -11 16z M116 107 q-14 -8 -11 -16 q3 -6 11 -2 q8 -4 11 2 q3 8 -11 16z"/>', 'rgba(232,71,143,.55)', '#B3185E');
    default: return '';
  }
}
function avHat(id) {
  switch (id) {
    case 'cap': return '<path d="M58 78 Q60 44 100 42 Q140 44 142 78 Z" fill="#E2483D"/><path d="M58 78 Q100 70 160 82 Q150 90 100 84 Q70 84 58 82Z" fill="#B5352C"/><circle cx="100" cy="44" r="3" fill="#B5352C"/>';
    case 'beanie': return '<path d="M56 82 Q58 38 100 38 Q142 38 144 82 Z" fill="#5B54E8"/><rect x="54" y="74" width="92" height="14" rx="7" fill="#463FCC"/><circle cx="100" cy="34" r="9" fill="#FFBE2E"/>';
    case 'flower': return '<g transform="translate(128 58)"><g fill="#FF8FB8">' + [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-8" rx="5" ry="8" transform="rotate(${a})"/>`).join('') + '</g><circle r="5" fill="#FFD84D"/></g>';
    case 'headphones': return '<path d="M58 92 Q58 40 100 40 Q142 40 142 92" fill="none" stroke="#3B3F55" stroke-width="7"/><rect x="48" y="84" width="16" height="24" rx="7" fill="#E8478F"/><rect x="136" y="84" width="16" height="24" rx="7" fill="#E8478F"/>';
    case 'bow': return '<g transform="translate(126 56) rotate(15)"><path d="M0 0 L-16 -10 L-16 10 Z M0 0 L16 -10 L16 10 Z" fill="#E8478F"/><circle r="4.5" fill="#B3185E"/></g>';
    case 'party': return '<path d="M78 52 L104 6 L122 52 Z" fill="#4CA8FF"/><path d="M84 42 L116 42 M90 30 L112 30 M96 18 L108 18" stroke="#FFD84D" stroke-width="4"/><circle cx="104" cy="6" r="6" fill="#E8478F"/>';
    case 'cat': return '<path d="M62 64 L66 30 L88 54 Z M138 64 L134 30 L112 54 Z" fill="#3B3F55"/><path d="M68 56 L70 40 L82 52 Z M132 56 L130 40 L118 52 Z" fill="#FF8FB8"/>';
    case 'viking': return '<path d="M58 80 Q58 42 100 42 Q142 42 142 80 Z" fill="#9AA3B8"/><rect x="56" y="74" width="88" height="10" rx="5" fill="#7A8299"/><path d="M60 66 Q36 60 34 30 Q48 50 64 52Z M140 66 Q164 60 166 30 Q152 50 136 52Z" fill="#F4ECD8" stroke="#C9B98F" stroke-width="2"/>';
    case 'wizard': return '<path d="M52 80 Q100 92 148 80 Q130 72 124 66 L102 0 L76 66 Q66 72 52 80Z" fill="#4B3BB5"/><path d="M80 62 Q100 70 122 62" stroke="#FFD84D" stroke-width="5" fill="none"/><path d="M98 30 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z" fill="#FFD84D"/>';
    case 'crown': return '<path d="M66 60 L66 30 L80 44 L92 22 L100 40 L108 22 L120 44 L134 30 L134 60 Z" fill="url(#av-gold)" stroke="#C98A00" stroke-width="2"/><circle cx="100" cy="50" r="5" fill="#E8478F"/><circle cx="80" cy="52" r="3.4" fill="#4CA8FF"/><circle cx="120" cy="52" r="3.4" fill="#5BD47A"/>';
    default: return '';
  }
}
function avHand(id) {
  switch (id) {
    case 'book': return '<g transform="translate(140 190) rotate(-8)"><rect x="-4" y="-14" width="26" height="30" rx="3" fill="#5B54E8"/><rect x="-1" y="-11" width="20" height="24" fill="#fff" opacity=".9"/><path d="M3 -5 h12 M3 0 h12 M3 5 h8" stroke="#5B54E8" stroke-width="1.6"/></g>';
    case 'ball': return '<g transform="translate(152 196)"><circle r="12" fill="#FFBE2E"/><path d="M-12 0 Q0 -6 12 0 M0 -12 Q-6 0 0 12" stroke="#E2483D" stroke-width="2.4" fill="none"/></g>';
    case 'wand': return '<g transform="translate(142 196) rotate(-35)"><rect x="-2" y="-34" width="4" height="36" rx="2" fill="#3B3F55"/><path d="M0 -46 l3.4 7 7.7 1 -5.6 5.4 1.4 7.6 -6.9 -3.6 -6.9 3.6 1.4 -7.6 -5.6 -5.4 7.7 -1z" fill="#FFD84D"/></g><g fill="#FFE066" class="av-sparkle"><circle cx="128" cy="150" r="2"/><circle cx="150" cy="146" r="1.5"/><circle cx="160" cy="160" r="1.8"/></g>';
    case 'trophy': return '<g transform="translate(150 186)"><path d="M-12 -16 h24 v10 a12 12 0 0 1 -24 0z" fill="url(#av-gold)"/><path d="M-12 -12 q-8 0 -6 8 q2 4 6 4 M12 -12 q8 0 6 8 q-2 4 -6 4" fill="none" stroke="#C98A00" stroke-width="2.4"/><rect x="-3" y="5" width="6" height="8" fill="#C98A00"/><rect x="-9" y="12" width="18" height="5" rx="2" fill="#8E6200"/></g>';
    case 'guitar': return '<g transform="translate(148 200) rotate(-40)"><rect x="-2.5" y="-48" width="5" height="34" fill="#7A4A26"/><path d="M0 -14 q14 0 12 12 q-2 8 4 14 q-4 14 -16 14 q-12 0 -16 -14 q6 -6 4 -14 q-2 -12 12 -12z" fill="#E2483D"/><circle cy="4" r="4" fill="#5B1A12"/></g>';
    default: return '';
  }
}
function avPet(id) {
  const eyes = (x1, x2, y) => `<circle cx="${x1}" cy="${y}" r="2.6" fill="#1F1B2E"/><circle cx="${x2}" cy="${y}" r="2.6" fill="#1F1B2E"/><circle cx="${x1 + 1}" cy="${y - 1}" r=".9" fill="#fff"/><circle cx="${x2 + 1}" cy="${y - 1}" r=".9" fill="#fff"/>`;
  let body = '';
  switch (id) {
    case 'cat': body = `<path d="M18 268 q-4 -26 16 -30 q20 4 16 30z" fill="#F2A65A"/><circle cx="34" cy="232" r="13" fill="#F2A65A"/><path d="M23 226 l2 -12 8 8z M45 226 l-2 -12 -8 8z" fill="#F2A65A"/>${eyes(29, 39, 232)}<path d="M32 238 q2 2 4 0" stroke="#7A2E3A" stroke-width="1.4" fill="none"/><path d="M50 262 q14 -4 10 -20" stroke="#F2A65A" stroke-width="5" fill="none" stroke-linecap="round"/>`; break;
    case 'dog': body = `<path d="M16 268 q-2 -26 18 -30 q20 4 18 30z" fill="#C89B6D"/><circle cx="34" cy="232" r="14" fill="#C89B6D"/><ellipse cx="21" cy="232" rx="5" ry="10" fill="#8C6239"/><ellipse cx="47" cy="232" rx="5" ry="10" fill="#8C6239"/>${eyes(29, 39, 230)}<ellipse cx="34" cy="238" rx="3.5" ry="2.6" fill="#1F1B2E"/><path d="M34 241 q0 4 4 4" stroke="#E8478F" stroke-width="2" fill="none"/>`; break;
    case 'bunny': body = `<path d="M18 268 q-4 -24 16 -28 q20 4 16 28z" fill="#F4F4F8"/><circle cx="34" cy="234" r="13" fill="#F4F4F8"/><ellipse cx="27" cy="210" rx="4.5" ry="14" fill="#F4F4F8"/><ellipse cx="41" cy="210" rx="4.5" ry="14" fill="#F4F4F8"/><ellipse cx="27" cy="210" rx="2" ry="9" fill="#FFB8CC"/><ellipse cx="41" cy="210" rx="2" ry="9" fill="#FFB8CC"/>${eyes(29, 39, 233)}<circle cx="34" cy="239" r="1.8" fill="#FF8FA3"/>`; break;
    case 'owl': body = `<ellipse cx="34" cy="250" rx="17" ry="21" fill="#8C6239"/><ellipse cx="34" cy="256" rx="10" ry="12" fill="#E9CFA8"/><circle cx="27" cy="240" r="7" fill="#fff"/><circle cx="41" cy="240" r="7" fill="#fff"/>${eyes(27, 41, 240)}<path d="M31 246 l3 5 3 -5z" fill="#F5B400"/><path d="M18 232 l4 -8 4 6 M50 232 l-4 -8 -4 6" fill="#8C6239"/>`; break;
    case 'dragon': body = `<path d="M14 268 q-2 -24 18 -28 q20 4 20 28z" fill="#5BBF73"/><path d="M14 244 L4 228 L16 232 Z M52 244 L64 226 L50 234 Z" fill="#3E9E57"/><circle cx="34" cy="232" r="14" fill="#5BBF73"/><path d="M24 220 l2 -10 6 8z M44 220 l-2 -10 -6 8z" fill="#FFBE2E"/>${eyes(29, 39, 230)}<path d="M28 239 q6 4 12 0" stroke="#24733C" stroke-width="1.6" fill="none"/><circle cx="28" cy="236" r="1" fill="#24733C"/><path class="av-flame" d="M48 236 q10 -4 16 0 q-6 4 -16 0z" fill="#FFB13D"/>`; break;
    default: return '';
  }
  return `<g class="av-pet">${body}</g>`;
}
function avShoes(id) {
  const pair = (fn) => fn(88) + fn(112);
  switch (id) {
    case 'boots': return pair((x) => `<path d="M${x - 10} 244 h20 v22 q6 2 6 8 h-28 z" fill="#7A4A26"/><rect x="${x - 10}" y="244" width="20" height="5" fill="#5B361B"/>`);
    case 'sandals': return pair((x) => `<path d="M${x - 11} 270 h24 q2 -6 -4 -7 h-18 q-4 1 -2 7z" fill="#C89B6D"/><path d="M${x - 6} 263 l6 -6 6 6" stroke="#E8478F" stroke-width="3" fill="none"/>`);
    case 'rocket': return pair((x) => `<path class="av-flame" d="M${x - 10} 272 q-8 8 -4 14 q4 -6 8 -6z" fill="#FFB13D"/><path d="M${x - 11} 258 h20 q10 4 10 14 h-30z" fill="#E2483D"/><path d="M${x - 11} 268 h30" stroke="#fff" stroke-width="3"/><path d="M${x - 2} 260 l4 6" stroke="#FFD84D" stroke-width="2"/>`);
    case 'roller': return pair((x) => `<path d="M${x - 11} 256 h20 q10 4 10 12 h-30z" fill="#E8478F"/><rect x="${x - 11}" y="267" width="30" height="4" fill="#fff"/><circle cx="${x - 5}" cy="275" r="4" fill="#5B54E8"/><circle cx="${x + 13}" cy="275" r="4" fill="#5B54E8"/>`);
    default: return pair((x) => `<path d="M${x - 11} 258 h20 q10 4 10 14 h-30z" fill="#5B54E8"/><path d="M${x - 11} 268 h30" stroke="#fff" stroke-width="3.4"/><path d="M${x - 4} 261 l6 0 M${x - 4} 264 l7 0" stroke="#fff" stroke-width="1.5"/>`);
  }
}
function avBottom(id, C, S) {
  const C2 = avShade(C, -0.18);
  switch (id) {
    case 'shorts': return `<path d="M76 196 h48 l2 34 h-23 l-3 -18 -3 18 h-23 z" fill="${C}"/><path d="M76 200 h48" stroke="${C2}" stroke-width="3"/>`;
    case 'skirt': return `<path d="M78 196 h44 l14 42 h-72 z" fill="${C}"/><path d="M78 200 h44" stroke="${C2}" stroke-width="3"/>`;
    case 'sparkle': return `<path d="M78 196 h44 l14 42 h-72 z" fill="url(#av-galaxy)"/><g fill="#FFE066">${[[86, 214], [104, 222], [118, 210], [96, 232], [124, 230], [74, 232]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8"/>`).join('')}</g>`;
    case 'leggings': return `<path d="M78 196 h44 l-2 64 h-18 l-2 -44 -2 44 h-18 z" fill="${C}"/>`;
    case 'cargo': return `<path d="M76 196 h48 l1 64 h-22 l-3 -46 -3 46 h-22 z" fill="${C}"/><rect x="78" y="222" width="12" height="12" rx="2" fill="${C2}"/><rect x="110" y="222" width="12" height="12" rx="2" fill="${C2}"/>`;
    default: return `<path d="M76 196 h48 l1 64 h-22 l-3 -46 -3 46 h-22 z" fill="${C}"/><path d="M100 200 v12" stroke="${C2}" stroke-width="2"/><path d="M76 200 h48" stroke="${C2}" stroke-width="3"/>`; // jeans
  }
}
function avTop(id, C, S) {
  const C2 = avShade(C.startsWith('#') ? C : '#6D28D9', -0.18);
  const torso = (fill) => `<path d="M72 142 Q72 130 86 128 L114 128 Q128 130 128 142 L130 202 Q100 208 70 202 Z" fill="${fill}"/>`;
  const arms = (sleeve, long) => `<g stroke-linecap="round"><path d="M76 138 L66 164" stroke="${sleeve}" stroke-width="16"/><path d="M124 138 L134 164" stroke="${sleeve}" stroke-width="16"/>
    <path d="M66 162 L60 192" stroke="${long ? sleeve : S}" stroke-width="13"/><path d="M134 162 L140 192" stroke="${long ? sleeve : S}" stroke-width="13"/></g>`;
  const neck = `<path d="M90 128 Q100 138 110 128" fill="${S}"/>`;
  switch (id) {
    case 'hoodie': return arms(C, true) + torso(C) + `<path d="M84 128 Q100 150 116 128 Q112 120 100 120 Q88 120 84 128Z" fill="${C2}"/><path d="M95 136 v14 M105 136 v14" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M84 176 h32 l-4 16 h-24 z" fill="${C2}"/>`;
    case 'stripes': return arms(C, false) + `<defs><clipPath id="av-cl-st"><path d="M72 142 Q72 130 86 128 L114 128 Q128 130 128 142 L130 202 Q100 208 70 202 Z"/></clipPath></defs>` + torso(C) + `<g clip-path="url(#av-cl-st)" fill="#fff" opacity=".85">${[140, 156, 172, 188].map((y) => `<rect x="60" y="${y}" width="80" height="7"/>`).join('')}</g>` + neck;
    case 'sweater': return arms(C, true) + torso(C) + `<path d="M100 178 q-14 -9 -11 -17 q3 -6 11 -2 q8 -4 11 2 q3 8 -11 17z" fill="#fff" opacity=".9"/><path d="M70 196 h60" stroke="${C2}" stroke-width="5"/>` + neck;
    case 'dress': return arms(C, false) + `<path d="M74 140 Q74 130 86 128 L114 128 Q126 130 126 140 L124 190 L146 244 Q100 252 54 244 L76 190 Z" fill="${C}"/><path d="M76 190 h48" stroke="${C2}" stroke-width="4"/><circle cx="100" cy="150" r="3.5" fill="#fff"/>` + neck;
    case 'jersey': return arms(C, false) + torso(C) + `<path d="M74 140 v60 M126 140 v60" stroke="#fff" stroke-width="4"/><text x="100" y="180" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="26" fill="#fff">10</text>` + neck;
    case 'hero': return arms(C, true) + torso(C) + `<path d="M100 146 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2z" fill="#FFD84D" stroke="#E2483D" stroke-width="2"/><rect x="72" y="192" width="56" height="8" fill="#FFD84D"/>` + neck;
    case 'space': return arms('#F4F4F8', true) + torso('#F4F4F8') + `<rect x="86" y="146" width="28" height="22" rx="4" fill="#48A7F0"/><circle cx="92" cy="176" r="3" fill="#E2483D"/><circle cx="100" cy="176" r="3" fill="#FFD84D"/><circle cx="108" cy="176" r="3" fill="#3DAA5B"/><path d="M66 180 h8 M126 180 h8" stroke="#48A7F0" stroke-width="5"/>` + neck;
    case 'tux': return arms('#26283A', true) + torso('#26283A') + `<path d="M88 128 L100 172 L112 128 Z" fill="#fff"/><path d="M92 134 l8 4 8 -4 -8 6z" fill="#E2483D"/><circle cx="100" cy="152" r="1.6" fill="#26283A"/><circle cx="100" cy="162" r="1.6" fill="#26283A"/>`;
    case 'rainbow': return arms('#FF5E7E', false) + `<defs><clipPath id="av-cl-rb"><path d="M72 142 Q72 130 86 128 L114 128 Q128 130 128 142 L130 202 Q100 208 70 202 Z"/></clipPath></defs><g clip-path="url(#av-cl-rb)">${['#FF5E7E', '#FFB13D', '#FFE066', '#5BD47A', '#4CA8FF', '#A66BFF'].map((c, i) => `<rect x="60" y="${128 + i * 13}" width="80" height="14" fill="${c}"/>`).join('')}</g>` + neck;
    case 'kimono': return arms(C, true) + torso(C) + `<path d="M86 128 L112 186 M114 128 L94 168" stroke="#fff" stroke-width="4"/><rect x="70" y="170" width="60" height="14" fill="#E2483D"/><path d="M96 177 h8" stroke="#FFD84D" stroke-width="4"/>`;
    default: return arms(C, false) + torso(C) + neck; // T-Shirt
  }
}

/**
 * Avatar als SVG. opts: { size, crop: 'full' | 'head' | 'top' | 'legs', bg: true/false, idle: Animation, cls }
 */
function avatarSVG(a, opts = {}) {
  const v = avFill(a);
  const S = avColor('skin', v.skin), S2 = avShade(S, -0.14);
  const H = avColor('hairc', v.hairc);
  const T = avColor('topc', v.topc);
  const B = avColor('bottomc', v.bottomc);
  const box = { full: '0 0 200 300', head: '42 20 116 116', top: '40 110 120 120', legs: '40 186 120 100', pet: '0 196 80 80' }[opts.crop || 'full'];
  const bg = opts.bg === false ? '' : avBg(v.bg);
  const body = `
    ${avBack(v.back)}
    ${avHairBack(v.hair, H)}
    <ellipse cx="100" cy="282" rx="46" ry="7" fill="rgba(30,30,60,.14)"/>
    <g fill="${S}"><rect x="82" y="200" width="15" height="62" rx="7"/><rect x="103" y="200" width="15" height="62" rx="7"/></g>
    ${avBottom(v.bottom, B, S)}
    ${avShoes(v.shoes)}
    <rect x="92" y="114" width="16" height="20" rx="6" fill="${S2}"/>
    ${avTop(v.top, T, S)}
    <g fill="${S}"><circle cx="59" cy="197" r="8.5"/><circle cx="141" cy="197" r="8.5"/></g>
    <g class="av-head">
      <circle cx="58" cy="98" r="9" fill="${S}"/><circle cx="142" cy="98" r="9" fill="${S}"/>
      <circle cx="100" cy="90" r="42" fill="${S}"/>
      <circle cx="100" cy="90" r="42" fill="url(#av-shine)"/>
      ${avFace(v.face)}
      <path d="M77 84 q7 -5 14 -1 M109 83 q7 -4 14 1" stroke="${avShade(H.startsWith('#') ? H : '#6B4226', -0.25)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      ${avEyes(v.eyes)}
      ${avMouth(v.mouth)}
      ${avHairFront(v.hair, H)}
      ${avGlasses(v.glasses)}
      ${avHat(v.hat)}
    </g>
    ${avHand(v.hand)}`;
  return `<svg class="av-svg ${opts.idle ? 'av-idle' : ''} ${opts.cls || ''}" viewBox="${box}" ${opts.size ? `width="${opts.size}" height="${opts.size}"` : ''} role="img" aria-label="${avEsc(opts.label || 'Avatar')}">
    ${AV_DEFS}${bg ? `<g class="av-bg">${bg}</g>` : ''}${opts.crop === 'pet' ? '' : `<g class="av-body">${body}</g>`}${avPet(v.pet)}</svg>`;
}

/* ---------------- Speicher (Supabase) ---------------- */
async function avRpc(fn, args = {}) {
  const c = await cloudClient();
  const { data, error } = await c.rpc(fn, { p_app: AV_APP, p_token: kid.token, ...args });
  if (error) throw error;
  return data;
}
function avApply(st) {
  if (!st) return;
  AV.state = { ...st, avatar: Object.keys(st.avatar || {}).length ? avFill(st.avatar) : avStarter(kid.username), fresh: !Object.keys(st.avatar || {}).length };
  avCoinUI();
}
/** Beim Anmelden und Auffrischen: Avatar und Münzen holen (still, ohne Fehlermeldung) */
function avatarLoad(force = false) {
  if (!isKid()) return Promise.resolve(null);
  if (AV.state && !force) return Promise.resolve(AV.state);
  if (AV.loading) return AV.loading;
  AV.loading = avRpc('fab_avatar_get').then((st) => { avApply(st); return AV.state; })
    .catch(() => null).finally(() => { AV.loading = null; avFlushPoints(); });
  return AV.loading;
}
const avMine = () => (isKid() && AV.state ? AV.state.avatar : null);

/* ---------------- Münzen verdienen ----------------
   Punkte beim Üben → alle 10 Punkte eine Münze (pro Tag höchstens 40 Münzen, prüft die Datenbank).
   Vokaboom: richtige Antwort 1 Punkt (Lernkarten „gewusst“ ½), ein Wort, das vorher schon mal falsch war, +½,
   Test ab 80 % +3, alles richtig +5, ein fertig gespieltes Spiel +1. Teilmal: jede verdiente Münze zählt hier auch. */
const AV_PTS_KEY = () => `fab.avpts.${kid.username || ''}`;
function avPtsGet() { try { return parseFloat(localStorage.getItem(AV_PTS_KEY())) || 0; } catch { return 0; } }
function avPtsSet(v) { try { localStorage.setItem(AV_PTS_KEY(), String(Math.round(v * 100) / 100)); } catch { /* */ } }
function avatarEarnPoints(pts, from = null) {
  if (!isKid() || !pts) return;
  avPtsSet(avPtsGet() + pts);
  avCoinUI();
  if (avPtsGet() >= AV_POINTS_PER_COIN) avFlushPoints(from);
}
/** Münzen direkt gutschreiben (Teilmal: das Tool zeigt seine eigene Münz-Meldung, darum hier still) */
function avatarEarnCoins(n, from = null, quiet = true) {
  if (!isKid() || !n) return;
  AV.quiet = quiet;
  avatarEarnPoints(n * AV_POINTS_PER_COIN, from);
}
let avFlushing = false;
async function avFlushPoints(from = null) {
  if (avFlushing || !isKid()) return;
  const n = Math.min(5, Math.floor(avPtsGet() / AV_POINTS_PER_COIN));
  if (n < 1) return;
  avFlushing = true;
  let again = false;
  try {
    const st = await avRpc('fab_coins_earn', { p_n: n });
    avPtsSet(Math.max(0, avPtsGet() - n * AV_POINTS_PER_COIN));
    const keepAvatar = AV.state?.avatar;
    avApply(st);
    if (keepAvatar && AV.state.fresh) AV.state.avatar = keepAvatar;
    again = st.granted > 0;
    if (st.granted > 0 && AV.quiet) { const p = document.querySelector('.av-coin-pill'); p?.classList.remove('bump'); void p?.offsetWidth; p?.classList.add('bump'); }
    else if (st.granted > 0) { try { avCoinFx(st.granted, from); } catch (e) { console.warn('Münzen-Animation', e); } }
    else if (!AV.capWarned) { AV.capWarned = true; avToast('Für heute hast du alle Münzen gesammelt (40). Morgen gibt es neue!'); }
  } catch (e) {
    console.warn('Münzen gutschreiben', e); // offline: Punkte bleiben gespeichert und werden später eingelöst
  } finally {
    avFlushing = false;
    if (again && avPtsGet() >= AV_POINTS_PER_COIN) setTimeout(() => avFlushPoints(from), 400);
  }
}

/* ---------------- Anzeige: Münzen ---------------- */
const AV_COIN_SVG = '<svg class="av-coin" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#F4B400"/><circle cx="20" cy="20" r="14.5" fill="#FFCF3F" stroke="#E09A00" stroke-width="1.6"/><path d="M20 11 l2.6 5.4 5.9.8 -4.3 4.1 1 5.8 -5.2 -2.8 -5.2 2.8 1 -5.8 -4.3 -4.1 5.9 -.8z" fill="#E09A00"/><path d="M9 14a12 12 0 0 1 9-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".75"/></svg>';
function avCoinPillHTML() {
  if (!isKid()) return '';
  const c = AV.state?.coins ?? '…';
  const p = Math.min(100, (avPtsGet() / AV_POINTS_PER_COIN) * 100);
  return `<button class="av-coin-pill" data-action="avatar-open" title="Mein Avatar und meine Münzen" aria-label="${c} Münzen – Mein Avatar">
    <span class="av-pill-face">${AV.state ? avatarSVG(AV.state.avatar, { crop: 'head', bg: false }) : ''}</span>${AV_COIN_SVG}<b class="av-coin-n">${c}</b><i class="av-coin-prog" aria-hidden="true"><i style="width:${p}%"></i></i></button>`;
}
function avCoinUI() {
  const slot = document.getElementById('av-coin-slot');
  if (slot) slot.innerHTML = avCoinPillHTML();
  avAll('.av-coin-n').forEach((el) => { if (AV.state) el.textContent = AV.state.coins; });
  const w = Math.min(100, (avPtsGet() / AV_POINTS_PER_COIN) * 100);
  avAll('.av-coin-prog > i').forEach((el) => { el.style.width = `${w}%`; });
}
function avCoinFx(n, from) {
  if (typeof tone === 'function') tone([1318, 1760, 2093], 0.09, 'triangle', 0.12);
  const target = document.querySelector('.av-coin-pill .av-coin, .av-wallet .av-coin');
  const tr = target?.getBoundingClientRect();
  const fr = from?.getBoundingClientRect?.() || { left: innerWidth / 2 - 30, top: innerHeight / 2 - 30, width: 60, height: 60 };
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for (let i = 0; i < Math.min(n, 5); i++) {
    const el = document.createElement('div');
    el.className = 'av-coin-fly';
    el.innerHTML = AV_COIN_SVG;
    document.body.appendChild(el);
    const x0 = fr.left + fr.width / 2 - 20, y0 = fr.top + fr.height / 2 - 20;
    const x1 = tr ? tr.left - 8 : innerWidth - 80, y1 = tr ? tr.top - 8 : 10;
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 120, my = Math.min(y0, y1) - 100;
    el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0 },
      { transform: `translate(${x0}px, ${y0 - 40}px) scale(1.4) rotateY(360deg)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${mx}px, ${my}px) scale(1.1) rotateY(720deg)`, offset: 0.6 },
      { transform: `translate(${x1}px, ${y1}px) scale(.7) rotateY(1080deg)`, opacity: 1 },
    ], { duration: reduce ? 1 : 1300, delay: i * 140, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' }).finished.then(() => {
      el.remove();
      const p = document.querySelector('.av-coin-pill');
      p?.classList.remove('bump'); void p?.offsetWidth; p?.classList.add('bump');
    });
  }
  avToast(n === 1 ? 'Du hast eine Münze verdient! 🪙' : `Du hast ${n} Münzen verdient! 🪙`);
}

/* ---------------- Bereich „Mein Avatar“ ---------------- */
function avatarOpen() {
  if (!isKid()) return;
  AV.draft = null; AV.tried = null;
  if (typeof go === 'function') go('avatar'); else renderAvatar();
}
function renderAvatar() {
  const v = document.getElementById('view');
  if (!v) return;
  if (!AV.state) {
    v.innerHTML = `<section class="av-page"><div class="av-loading"><span class="spinner"></span> Dein Avatar wird geladen …</div></section>`;
    avatarLoad(true).then(() => { if (AV.state) renderAvatar(); else v.innerHTML = `<section class="av-page"><p class="banner bad">Der Avatar konnte nicht geladen werden. Bist du online?</p></section>`; });
    return;
  }
  if (!AV.draft) AV.draft = { ...AV.state.avatar };
  const cat = AV_CATS.find((c) => c[0] === AV.cat) || AV_CATS[0];
  const unpaid = Object.entries(AV.draft).filter(([s, id]) => !avOwned(s, id));
  const cost = unpaid.reduce((a, [s, id]) => a + avPrice(s, id), 0);
  const changed = JSON.stringify(avFill(AV.draft)) !== JSON.stringify(avFill(AV.state.avatar));
  v.innerHTML = `<section class="av-page">
    <header class="av-top">
      <div><p class="eyebrow">Gestalte dich selbst</p><h1>Mein Avatar</h1></div>
      <button class="av-wallet" data-action="avatar-coins" title="So verdienst du Münzen">${AV_COIN_SVG}<b class="av-coin-n">${AV.state.coins}</b><span>Münzen</span><i class="av-coin-prog"><i style="width:${Math.min(100, (avPtsGet() / AV_POINTS_PER_COIN) * 100)}%"></i></i></button>
    </header>
    <div class="av-layout">
      <div class="av-prev-box"><button class="av-preview" id="av-preview" data-action="avatar-poke" aria-label="Avatar antippen">${avatarSVG(AV.draft, { idle: true, label: 'Dein Avatar' })}</button>
        ${unpaid.length === 1 ? `<button class="av-quickbuy" data-action="avatar-buy" data-slot="${unpaid[0][0]}" data-id="${unpaid[0][1]}" ${AV.state.coins >= cost ? '' : 'disabled'}>${AV_COIN_SVG} ${AV.state.coins >= cost ? `Für ${cost} kaufen` : `${cost} – noch ${cost - AV.state.coins} fehlen`}</button>` : ''}</div>
      <div class="av-stage">
        ${unpaid.length ? `<div class="av-try">
            <p><strong>Du probierst gerade an:</strong> ${unpaid.map(([s, id]) => avEsc(avOptions(s).find((o) => o.id === id)?.name || id)).join(', ')}</p>
            ${unpaid.length === 1 ? `<button class="btn primary" data-action="avatar-buy" data-slot="${unpaid[0][0]}" data-id="${unpaid[0][1]}" ${AV.state.coins >= cost ? '' : 'disabled'}>${AV_COIN_SVG} Für ${cost} kaufen</button>`
              : `<p class="small">Zusammen ${cost} Münzen – kaufe die Teile einzeln (tippe sie unten an).</p>`}
            ${AV.state.coins < cost ? `<p class="small muted">Dir fehlen noch ${cost - AV.state.coins} Münzen. Üben bringt Münzen!</p>` : ''}
          </div>` : ''}
        <div class="av-actions">
          <button class="btn ghost" data-action="avatar-random" title="Zufälliger Look aus deinen Teilen">🎲 Zufall</button>
          <button class="btn ghost" data-action="avatar-reset" ${changed ? '' : 'disabled'}>↩︎ Zurück</button>
          <button class="btn primary" data-action="avatar-save" ${changed && !unpaid.length ? '' : 'disabled'}>${typeof icon === 'function' ? icon('check') : '✓'} Speichern</button>
        </div>
        <p class="small muted center">${AV_APP === 'vokaboom' ? 'Dein Avatar gilt auch in Teilmal.' : 'Dein Avatar gilt auch in Vokaboom.'}</p>
      </div>
      <div class="av-shop">
        <nav class="av-tabs" role="tablist">${AV_CATS.map(([id, emo, name]) => `<button class="av-tab ${id === cat[0] ? 'on' : ''}" role="tab" aria-selected="${id === cat[0]}" data-action="avatar-cat" data-cat="${id}"><span>${emo}</span><small>${name}</small></button>`).join('')}</nav>
        ${cat[3].map((slot) => avSlotHTML(slot)).join('')}
      </div>
    </div>
  </section>`;
}
function avSlotHTML(slot) {
  const opts = avOptions(slot);
  const crop = { hair: 'head', hairc: 'head', eyes: 'head', mouth: 'head', face: 'head', glasses: 'head', hat: 'head', top: 'top', topc: 'top', bottom: 'legs', bottomc: 'legs', shoes: 'legs', pet: 'pet' }[slot] || 'full';
  return `<div class="av-slot"><h3>${avEsc(AV_SLOT_NAMES[slot])}</h3><div class="av-grid ${AV_COLORS[slot] ? 'colors' : ''}">${opts.map((o) => {
    const sel = AV.draft[slot] === o.id;
    const own = avOwned(slot, o.id);
    const pic = AV_COLORS[slot] && slot !== 'skin' && slot !== 'hairc'
      ? `<span class="av-swatch" style="background:${o.color.startsWith('url') ? { 'url(#av-gold)': 'linear-gradient(135deg,#FFE38A,#F5B400,#C98A00)', 'url(#av-galaxy)': 'linear-gradient(135deg,#2B1A6B,#6D28D9,#DB2777)' }[o.color] : o.color}"></span>`
      : AV_COLORS[slot] ? `<span class="av-swatch" style="background:${o.color.startsWith('url') ? 'linear-gradient(135deg,#FF5E7E,#FFB13D,#5BD47A,#4CA8FF,#A66BFF)' : o.color}"></span>`
        : `<span class="av-thumb">${avatarSVG({ ...AV.draft, [slot]: o.id }, { crop, bg: slot === 'bg' })}</span>`;
    return `<button class="av-item ${sel ? 'on' : ''} ${own ? '' : 'locked'}" data-action="avatar-pick" data-slot="${slot}" data-id="${o.id}" aria-pressed="${sel}" title="${avEsc(o.name)}${own ? '' : ` – ${o.price} Münzen`}">
      ${pic}<small>${avEsc(o.name)}</small>${own ? (o.price ? '<i class="av-own">✓</i>' : '') : `<i class="av-price">${AV_COIN_SVG}${o.price}</i>`}</button>`;
  }).join('')}</div></div>`;
}
function avPoke() {
  const p = document.querySelector('#av-preview .av-svg');
  if (!p) return;
  p.classList.remove('av-jump'); void p.getBoundingClientRect(); p.classList.add('av-jump');
  if (typeof tone === 'function') tone([660, 990], 0.08, 'triangle', 0.06);
}
function avCoinsInfo() {
  const st = AV.state || { coins: 0, earned: 0, spent: 0, today: 0, dayMax: 40 };
  const left = Math.max(0, Math.ceil((AV_POINTS_PER_COIN - avPtsGet()) * 10) / 10);
  const html = `<div class="av-modal" role="dialog" aria-modal="true" aria-label="Meine Münzen"><div class="av-modal-card">
    <button class="av-modal-x" data-action="avatar-modal-close" aria-label="Schliessen">✕</button>
    <div class="av-coins-hero">${AV_COIN_SVG}<b>${st.coins}</b><span>${st.coins === 1 ? 'Münze' : 'Münzen'}</span></div>
    <div class="av-next"><span>Nächste Münze</span><i class="av-coin-prog big"><i style="width:${Math.min(100, (avPtsGet() / AV_POINTS_PER_COIN) * 100)}%"></i></i><small>noch ${String(left).replace('.', ',')} Punkte</small></div>
    <ul class="av-rules">
      ${AV_APP === 'vokaboom' ? `<li><b>Richtige Antwort = 1 Punkt</b> (beim Aussprechen, Hören & Schreiben, im Test und in den Übungen; Lernkarten „gewusst“ ½ Punkt).</li>
      <li><b>Dranbleiben lohnt sich:</b> Ein Wort, das du vorher schon mal falsch hattest, gibt ½ Punkt extra.</li>
      <li><b>Test ab 80 %:</b> 3 Punkte Bonus, alles richtig: 5 Punkte.</li>
      <li><b>Spiel fertig gespielt:</b> 1 Punkt.</li>` : '<li><b>Jede Münze aus den Übungen</b> zählt auch für deinen Avatar.</li>'}
      <li><b>10 Punkte = 1 Münze.</b> Pro Tag kannst du bis zu ${st.dayMax} Münzen sammeln (heute: ${st.today}).</li>
      <li><b>Münzen gelten in Vokaboom und Teilmal</b> – wenn du in beiden mit demselben Kärtchen angemeldet bist.</li>
    </ul>
    <p class="muted small">Bisher verdient: ${st.earned} · ausgegeben: ${st.spent}</p>
  </div></div>`;
  document.querySelector('.av-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}
async function avBuy(slot, id) {
  if (AV.busy) return;
  const o = avOptions(slot).find((x) => x.id === id);
  if (!o || avOwned(slot, id)) return;
  if ((AV.state.coins || 0) < o.price) { avToast(`Dir fehlen noch ${o.price - AV.state.coins} Münzen.`); return; }
  AV.busy = true;
  try {
    const keep = AV.state.avatar;
    const st = await avRpc('fab_avatar_buy', { p_item: avKey(slot, id) });
    avApply(st); AV.state.avatar = keep;
    AV.draft[slot] = id;
    if (typeof tone === 'function') tone([784, 1046, 1318], 0.1, 'triangle', 0.1);
    if (typeof confetti === 'function') confetti();
    avToast(`„${o.name}“ gehört jetzt dir! 🎉`);
    renderAvatar();
  } catch (e) {
    avToast(/not_enough/.test(e?.message || '') ? 'Nicht genug Münzen.' : 'Kaufen hat nicht geklappt. Bist du online?', 'bad');
  } finally { AV.busy = false; }
}
async function avSave() {
  if (AV.busy) return;
  AV.busy = true;
  try {
    const st = await avRpc('fab_avatar_save', { p_avatar: avFill(AV.draft) });
    avApply(st);
    AV.draft = { ...AV.state.avatar };
    renderAvatar();
    avPoke();
    avToast('Dein Avatar ist gespeichert! ✨');
  } catch (e) {
    avToast(/not_owned/.test(e?.message || '') ? 'Ein Teil musst du zuerst kaufen.' : 'Speichern hat nicht geklappt. Bist du online?', 'bad');
  } finally { AV.busy = false; }
}
function avRandom() {
  const d = { ...AV.draft };
  for (const slot of Object.keys(AV_DEFAULT)) {
    const own = avOptions(slot).filter((o) => avOwned(slot, o.id));
    if (['back', 'pet', 'hand', 'glasses'].includes(slot) && Math.random() < 0.5) { d[slot] = 'none'; continue; }
    d[slot] = own[Math.floor(Math.random() * own.length)].id;
  }
  if (Math.random() < 0.6) d.hat = 'none';
  AV.draft = d;
  renderAvatar();
  avPoke();
}

const avatarActions = {
  'avatar-open': () => avatarOpen(),
  'avatar-cat': (el) => { AV.cat = el.dataset.cat; renderAvatar(); },
  'avatar-pick': (el) => {
    AV.draft[el.dataset.slot] = el.dataset.id;
    renderAvatar();
    if (!avOwned(el.dataset.slot, el.dataset.id)) document.querySelector('.av-try')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
  'avatar-buy': (el) => avBuy(el.dataset.slot, el.dataset.id),
  'avatar-save': () => avSave(),
  'avatar-reset': () => { AV.draft = { ...AV.state.avatar }; renderAvatar(); },
  'avatar-random': () => avRandom(),
  'avatar-poke': () => avPoke(),
  'avatar-coins': () => avCoinsInfo(),
  'avatar-modal-close': () => document.querySelector('.av-modal')?.remove(),
};
document.addEventListener('click', (e) => { if (e.target.classList?.contains('av-modal')) e.target.remove(); });
