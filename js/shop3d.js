/* Teilmal – 3D-Avatar-Welt und Turbo-Garage: Katalog, Münzkonto und Speichern
 *
 * Ein Konto für alles: Die Münzen liegen in der Datenbank (fab_avatars.coins, gemeinsam mit Vokaboom).
 * Damit kauft das Kind Avatar-Teile, Kart-Teile und bezahlt die Spiele.
 *  - Jedes Teil hat eine feste Nummer (id), Kategorie, Platz (slot), Preis, Seltenheit und manchmal eine Freischaltbedingung
 *    («ab 60 gesammelten Münzen»). Grundlegendes (Hautfarbe, Augen, Frisuren, Alltagskleider, Brillen, Farben) ist gratis.
 *  - Preise und Freischaltung prüft die Datenbank (fab_avatar_items); Kaufen ist dort atomar und doppelt kaufen kostet nichts.
 *  - Gekauftes bleibt für immer. Kein echtes Geld, keine Zufallskisten, kein Zeitdruck.
 *  - Avatar (avatar3d) und Kart (garage) werden pro Konto gespeichert; die Datenbank lässt nur gekaufte Teile zu.
 * Ohne Anmeldung (oder als Lehrperson) ist alles eine Vorschau, die nur auf diesem Gerät gespeichert wird.
 *
 * Gemeinsam für Teilmal und Vokaboom (die Dateien shop3d.js, world3d.js, avatar3d.js und world3d.css sind in beiden
 * Repositories gleich). Die Garage und das Bezahlen der Spiele gibt es nur, wo das Turbo-Rennen geladen ist (Teilmal).
 */
'use strict';

/* ---------------- 3D-Grafik: three.js laden (Teilmal hat dafür schon loadThree/webglOK, Vokaboom nicht) ---------------- */
let W3_THREE = null, w3ThreeP = null;
function w3Three() {
  if (W3_THREE) return Promise.resolve(W3_THREE);
  if (typeof loadThree === 'function') return loadThree().then((m) => (W3_THREE = m));
  if (!w3ThreeP) w3ThreeP = import(w3Asset('js/vendor/three.module.min.js')).then((m) => (W3_THREE = m)).catch((e) => { w3ThreeP = null; throw e; });
  return w3ThreeP;
}
const w3T = () => W3_THREE || (typeof THREE !== 'undefined' ? THREE : null);
let w3GL = null;
function w3WebGL() {
  if (typeof webglOK === 'function') return webglOK();
  if (w3GL == null) { try { const c = document.createElement('canvas'); w3GL = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { w3GL = false; } }
  return w3GL;
}
/** Garage nur dort, wo es das Turbo-Rennen gibt */
const w3Garage = () => typeof kartModel === 'function';
/** Für Live-Spiele: der gespeicherte 3D-Look des Kindes (oder null, wenn es noch keinen hat) */
function w3LiveLook() {
  try {
    if (!w3WebGL() || w3Mode() !== 'kid' || !AV.state?.avatar3d || !Object.keys(AV.state.avatar3d).length) return null;
    const c = w3Saved('a3'); delete c.fresh;
    return c;
  } catch { return null; }
}

/* ---------------- Farben (alle gratis) ---------------- */
const W3_SKINS = [0xfce3d3, 0xf6cfb0, 0xf2c9a5, 0xe9b48c, 0xd59a6c, 0xb97a4f, 0x93593a, 0x6e4129, 0x4b2b1c];
const W3_HAIRC = [0x2b1d14, 0x3b2416, 0x7a4422, 0xa0522d, 0xe8c26a, 0xf3e3b5, 0xb4472b, 0xb9b6c3, 0x231d2b, 0xf28dbb, 0x8b5cf6, 0x3b82f6, 0x4ed6b4];
const W3_EYEC = [0x6b4423, 0x3b2416, 0x3b82f6, 0x16a34a, 0x64748b, 0x7c3aed, 0x0f766e, 0xd97706];
const W3_CLOTH = [0x2453d6, 0x3b82f6, 0x14a39a, 0x22c55e, 0xffbe2e, 0xf97316, 0xe2483d, 0xe8478f, 0xf9a8d4, 0x8b5cf6, 0x7c4a26, 0x26222e, 0x64748b, 0xf8f4f6];
const W3_TRIM = [0xffffff, 0xf5c518, 0x22d3ee, 0xf472b6, 0x8b5cf6, 0xe2483d, 0x3daa5b, 0x1f2430];
const W3_PANTS = [0x3e63b5, 0x26305e, 0x24232b, 0x374151, 0xb59b6a, 0x7c4a26, 0x1e9a8e, 0x7c3aed, 0xf9a8d4, 0xe2483d, 0xf8f4f6];
const W3_PAINT = [0xff5a36, 0xe2483d, 0xf97316, 0xf5c518, 0x84cc16, 0x16a34a, 0x14b8a6, 0x22d3ee, 0x2453d6, 0x1e3a8a, 0x8b5cf6, 0xec4899, 0xf9a8d4, 0xffffff, 0xcbd5e1, 0x111827];

/* ---------------- Katalog ----------------
   [wert, name, icon, preis, extras] – extras: c = wie viele Farben wählbar (0, 1, 2), u = ab so vielen gesammelten Münzen */
const W3_RARITY = { basic: 'Basis', common: 'Normal', rare: 'Gold', epic: 'Episch', legend: 'Legendär' };
const w3Rarity = (p) => (!p ? 'basic' : p <= 10 ? 'common' : p <= 20 ? 'rare' : p <= 35 ? 'epic' : 'legend');
function w3Items(pre, slot, list, cat = slot) {
  return list.map(([v, name, icon, price = 0, x = {}]) => ({
    id: `${pre}:${slot}:${v}`, pre, slot, v, name, icon, price, cat, colors: x.c ?? 1, under: !!x.under, unlock: x.u ? { earned: x.u } : null, rarity: w3Rarity(price),
  }));
}
const A3_ITEMS = [
  ...w3Items('a3', 'eyes', [['round', 'Rund', '👀'], ['wide', 'Gross', '😳'], ['happy', 'Fröhlich', '😊'], ['sleepy', 'Verschlafen', '😌'], ['wink', 'Zwinkern', '😉'], ['dot', 'Knopfaugen', '⚫'], ['cool', 'Cool', '😎'],
    ['star', 'Sternenaugen', '🤩', 10], ['heart', 'Herzaugen', '😍', 10], ['cat', 'Katzenaugen', '🐱', 10], ['sparkle', 'Glitzeraugen', '✨', 12]], 'body'),
  ...w3Items('a3', 'brows', [['normal', 'Normal', '〰️'], ['thick', 'Kräftig', '➖'], ['thin', 'Fein', '﹏'], ['raised', 'Hochgezogen', '🤨'], ['angry', 'Entschlossen', '😤'], ['sad', 'Besorgt', '🥺']], 'body'),
  ...w3Items('a3', 'mouth', [['smile', 'Lächeln', '🙂'], ['grin', 'Grinsen', '😁'], ['calm', 'Ruhig', '😶'], ['smirk', 'Schief', '😏'], ['open', 'Offen', '😮'], ['braces', 'Zahnspange', '😬'],
    ['tongue', 'Zunge raus', '😛', 6], ['wavy', 'Wackelig', '🥴', 6], ['cat', 'Katzenmund', '😺', 8], ['fang', 'Vampirzahn', '🧛', 8], ['kiss', 'Kussmund', '😗', 8]], 'body'),
  ...w3Items('a3', 'deco', [['none', 'Nichts', '—'], ['mole', 'Muttermal', '•'], ['bandaid', 'Pflaster', '🩹', 5], ['whiskers', 'Schnurrhaare', '🐭', 8], ['stars', 'Sternchen', '⭐', 10], ['hearts', 'Herzchen', '💗', 10], ['paint', 'Farbstriche', '🎨', 12]], 'body'),
  ...w3Items('a3', 'hair', [['spiky', 'Strubbel', '⚡'], ['emo', 'Seitenscheitel', '🌙', 0, { c: 2 }], ['buzz', 'Kurz', '✂️'], ['bob', 'Bob', '💁'], ['bowl', 'Topfschnitt', '🥣'], ['wavy', 'Wellen', '🌊'],
    ['long', 'Lang', '💇'], ['ponytail', 'Pferdeschwanz', '🐴'], ['pigtails', 'Zöpfchen', '🎀'], ['braid', 'Zopf', '🪢'], ['buns', 'Dutts', '🍡'], ['afro', 'Afro', '☁️'], ['mohawk', 'Irokese', '🦔', 15]]),
  ...w3Items('a3', 'hairC', [['rainbow', 'Regenbogen-Haare', '🌈', 20]], 'hair'),
  ...w3Items('a3', 'top', [['tshirt', 'T-Shirt', '👕', 0, { c: 2 }], ['sweater', 'Pullover', '🧶', 0, { c: 2 }], ['hoodie', 'Hoodie', '🧥', 0, { c: 2, under: 1 }], ['tank', 'Top', '🎽', 0, { c: 2 }], ['dress', 'Kleid', '👗', 0, { c: 2 }],
    ['jersey', 'Trikot', '⚽', 12, { c: 2 }], ['denim', 'Jeansjacke', '🧑‍🎤', 12, { c: 2, under: 1 }], ['sport', 'Sportjacke', '🏃', 15, { c: 2, under: 1 }], ['puffer', 'Daunenjacke', '🧊', 15, { c: 2, under: 1 }], ['pastel', 'Flicken-Jacke', '🩷', 18, { c: 2, under: 1 }]]),
  ...w3Items('a3', 'top', [['overalls', 'Latzhose', '🧑‍🌾', 12, { c: 2 }], ['tux', 'Smoking', '🤵', 22, { c: 2 }], ['robe', 'Zaubergewand', '🧙', 25, { c: 2 }], ['hero', 'Superheld', '🦸', 28, { c: 2 }], ['space', 'Astronaut', '🚀', 30, { c: 2, u: 40 }]], 'outfit'),
  ...w3Items('a3', 'bottom', [['jeans', 'Jeans', '👖'], ['shorts', 'Shorts', '🩳'], ['joggers', 'Jogginghose', '🏃', 0, { c: 2 }], ['leggings', 'Leggings', '🧘', 0, { c: 2 }], ['skirt', 'Karo-Rock', '🎀', 0, { c: 2 }],
    ['cargo', 'Cargohose', '🧭', 10, { c: 2 }], ['tutu', 'Tutu', '🩰', 15, { c: 2 }]]),
  ...w3Items('a3', 'shoes', [['sneakers', 'Turnschuhe', '👟', 0, { c: 2 }], ['lowtops', 'Halbschuhe', '👞', 0, { c: 2 }], ['sandals', 'Sandalen', '🩴'], ['slippers', 'Hausschuhe', '🥿', 8, { c: 2 }], ['boots', 'Stiefel', '🥾', 10, { c: 2 }],
    ['rollers', 'Rollschuhe', '🛼', 18, { c: 2 }], ['rocket', 'Raketenschuhe', '🚀', 25, { c: 2, u: 30 }]]),
  ...w3Items('a3', 'hat', [['none', 'Nichts', '—', 0, { c: 0 }], ['cap', 'Cap', '🧢', 8, { c: 2 }], ['capback', 'Cap verkehrt', '🔄', 8, { c: 2 }], ['beanie', 'Mütze', '🧶', 8, { c: 2 }], ['bucket', 'Fischerhut', '👒', 10, { c: 2 }],
    ['helmet', 'Velohelm', '🚲', 10, { c: 2 }], ['party', 'Partyhut', '🥳', 10, { c: 2 }], ['flower', 'Blumenkranz', '🌼', 12, { c: 0 }], ['catbeanie', 'Katzenmütze', '🐱', 15, { c: 2 }], ['bunny', 'Hasenohren', '🐰', 15, { c: 2 }],
    ['headset', 'Headset', '🎧', 15, { c: 2 }], ['tiara', 'Diadem', '👸', 18], ['viking', 'Wikingerhelm', '🪓', 22, { c: 0 }], ['wizard', 'Zauberhut', '🧙', 25, { c: 2 }], ['crown', 'Krone', '👑', 35, { c: 0, u: 60 }]], 'acc'),
  ...w3Items('a3', 'glasses', [['none', 'Keine', '—', 0, { c: 0 }], ['round', 'Runde Brille', '👓'], ['square', 'Eckige Brille', '🤓'], ['sun', 'Sonnenbrille', '🕶️', 10], ['star', 'Sternenbrille', '⭐', 12], ['heart', 'Herzbrille', '💖', 12],
    ['goggles', 'Schutzbrille', '🥽', 15], ['visor', 'Cyber-Visier', '🤖', 18]], 'acc'),
  ...w3Items('a3', 'neck', [['none', 'Nichts', '—', 0, { c: 0 }], ['scarf', 'Schal', '🧣', 8, { c: 2 }], ['bandana', 'Halstuch', '🤠', 8, { c: 2 }], ['bowtie', 'Fliege', '🎀', 10], ['medal', 'Medaille', '🥇', 15, { c: 2 }],
    ['pearls', 'Perlenkette', '📿', 15], ['headphones', 'Kopfhörer', '🎧', 18], ['goldchain', 'Goldkette', '⛓️', 20, { c: 0 }]], 'acc'),
  ...w3Items('a3', 'wrist', [['none', 'Nichts', '—', 0, { c: 0 }], ['band', 'Schweissband', '🎾', 6, { c: 2 }], ['bracelet', 'Armreif', '💍', 10, { c: 0 }], ['watch', 'Uhr', '⌚', 12, { c: 2 }], ['smartwatch', 'Smartwatch', '📱', 15, { c: 2 }]], 'acc'),
  ...w3Items('a3', 'bag', [['none', 'Nichts', '—', 0, { c: 0 }], ['fanny', 'Bauchtasche', '👝', 10, { c: 2 }], ['messenger', 'Umhängetasche', '💼', 12, { c: 2 }], ['paw', 'Pfoten-Tasche', '🐾', 15, { c: 2 }]], 'acc'),
  ...w3Items('a3', 'hand', [['none', 'Nichts', '—', 0, { c: 0 }], ['pencil', 'Bleistift', '✏️', 6, { c: 0 }], ['calculator', 'Taschenrechner', '🧮', 8, { c: 0 }], ['book', 'Buch', '📘', 8], ['flag', 'Fahne', '🚩', 8], ['lollipop', 'Lolli', '🍭', 8],
    ['balloon', 'Ballon', '🎈', 10], ['icecream', 'Glace', '🍦', 10, { c: 0 }], ['magnifier', 'Lupe', '🔍', 10, { c: 0 }], ['glowstick', 'Leuchtstab', '🪄', 10], ['basketball', 'Basketball', '🏀', 12, { c: 0 }],
    ['flowers', 'Blumenstrauss', '💐', 12, { c: 0 }], ['umbrella', 'Schirm', '☂️', 12], ['teddy', 'Teddy', '🧸', 15, { c: 0 }], ['gamepad', 'Controller', '🎮', 15], ['microphone', 'Mikrofon', '🎤', 15, { c: 0 }],
    ['camera', 'Kamera', '📷', 15, { c: 0 }], ['wand', 'Zauberstab', '🪄', 18, { c: 0 }], ['trophy', 'Pokal', '🏆', 20, { c: 0 }], ['skateboard', 'Skateboard', '🛹', 20, { c: 0 }], ['guitar', 'Gitarre', '🎸', 25, { c: 0 }]]),
  ...w3Items('a3', 'back', [['none', 'Nichts', '—', 0, { c: 0 }], ['backpack', 'Rucksack', '🎒', 12, { c: 2 }], ['guitar', 'Gitarre am Rücken', '🎸', 22], ['cape', 'Umhang', '🦸', 25, { c: 2 }],
    ['butterfly', 'Schmetterlingsflügel', '🦋', 30, { c: 2 }], ['wings', 'Engelsflügel', '🪽', 35], ['jetpack', 'Jetpack', '🚀', 40, { u: 50 }], ['dragon', 'Drachenflügel', '🐉', 40, { u: 50 }]]),
  ...w3Items('a3', 'pet', [['none', 'Kein Tier', '—', 0, { c: 0 }], ['cat', 'Katze', '🐈', 35], ['dog', 'Hund', '🐕', 35], ['bunny', 'Hase', '🐇', 35], ['robot', 'Roboter', '🤖', 45, { u: 80 }], ['dragon', 'Drache', '🐲', 50, { u: 100 }]], 'fun'),
  ...w3Items('a3', 'effect', [['none', 'Kein Effekt', '—', 0, { c: 0 }], ['bubbles', 'Seifenblasen', '🫧', 20, { c: 0 }], ['notes', 'Musiknoten', '🎵', 20, { c: 0 }], ['sparkles', 'Glitzer', '✨', 25, { c: 0 }], ['hearts', 'Herzen', '💕', 25, { c: 0 }], ['aura', 'Leuchten', '🌟', 35, { u: 60 }]], 'fun'),
  ...w3Items('a3', 'emote', [['wave', 'Winken', '👋', 0, { c: 0 }], ['cheer', 'Jubeln', '🙌', 0, { c: 0 }], ['clap', 'Klatschen', '👏', 6, { c: 0 }], ['jump', 'Hüpfen', '🦘', 8, { c: 0 }], ['think', 'Nachdenken', '🤔', 8, { c: 0 }],
    ['bow', 'Verbeugen', '🙇', 8, { c: 0 }], ['shy', 'Schüchtern', '☺️', 8, { c: 0 }], ['sit', 'Sitzen', '🪑', 10, { c: 0 }], ['flex', 'Muskeln', '💪', 10, { c: 0 }], ['laugh', 'Lachen', '😂', 10, { c: 0 }],
    ['dance', 'Tanzen', '💃', 15, { c: 0 }], ['spin', 'Pirouette', '🌀', 15, { c: 0 }]]),
];
const CAR_ITEMS = [
  ...w3Items('car', 'body', [['formula', 'Formel-Kart', '🏎️', 0, { c: 0 }], ['kart', 'Go-Kart', '🛞', 0, { c: 0 }], ['buggy', 'Strandbuggy', '🏖️', 0, { c: 0 }], ['bubble', 'Kugelauto', '🫧', 0, { c: 0 }],
    ['bathtub', 'Badewanne', '🛁', 20, { c: 0 }], ['hotdog', 'Hotdog', '🌭', 25, { c: 0 }], ['duck', 'Quietscheente', '🦆', 25, { c: 0 }], ['shark', 'Hai', '🦈', 30, { c: 0 }],
    ['rocket', 'Rakete', '🚀', 30, { c: 0 }], ['monster', 'Monster-Truck', '🛻', 30, { c: 0 }], ['carriage', 'Kutsche', '👑', 35, { c: 0 }], ['ufo', 'UFO', '🛸', 40, { c: 0, u: 50 }]]),
  ...w3Items('car', 'finish', [['gloss', 'Glanz', '✨', 0, { c: 0 }], ['matte', 'Matt', '🧱', 10, { c: 0 }], ['metal', 'Metallic', '🔩', 12, { c: 0 }], ['pearl', 'Perlmutt', '🫧', 18, { c: 0 }], ['glow', 'Leuchtlack', '💡', 20, { c: 0 }], ['chrome', 'Chrom', '🪞', 25, { c: 0, u: 40 }]]),
  ...w3Items('car', 'pattern', [['none', 'Ohne', '—', 0, { c: 0 }], ['center', 'Mittelstreifen', '▮', 8], ['racing', 'Rennstreifen', '🏁', 10], ['duo', 'Zweifarbig', '◩', 12], ['dots', 'Punkte', '⚪', 12], ['stars', 'Sterne', '⭐', 15],
    ['checker', 'Zielflagge', '🏁', 15], ['lightning', 'Blitz', '⚡', 18], ['flames', 'Flammen', '🔥', 20]]),
  ...w3Items('car', 'rims', [['classic', 'Klassisch', '⚙️', 0, { c: 0 }], ['black', 'Schwarz', '⚫', 8, { c: 0 }], ['star', 'Stern', '⭐', 12, { c: 0 }], ['spoke', 'Speichen', '🎡', 12, { c: 0 }], ['turbine', 'Turbine', '🌀', 15, { c: 0 }], ['gold', 'Gold', '🥇', 20, { c: 0 }], ['neon', 'Neon', '💫', 22, { c: 0 }]]),
  ...w3Items('car', 'wing', [['standard', 'Standard', '➖', 0, { c: 0 }], ['duck', 'Entenbürzel', '🦆', 10, { c: 0 }], ['big', 'Gross', '🪽', 15, { c: 0 }], ['fin', 'Haifischflosse', '🦈', 18, { c: 0 }], ['double', 'Doppeldecker', '🛩️', 20, { c: 0 }]]),
  ...w3Items('car', 'exhaust', [['chrome', 'Chrom', '💨', 0, { c: 0 }], ['black', 'Schwarz', '⚫', 8, { c: 0 }], ['gold', 'Gold', '🥇', 12, { c: 0 }], ['quad', 'Vierfach', '🎺', 15, { c: 0 }]]),
  ...w3Items('car', 'flames', [['classic', 'Orange', '🔥', 0, { c: 0 }], ['blue', 'Blau', '💙', 12, { c: 0 }], ['green', 'Grün', '💚', 12, { c: 0 }], ['violet', 'Violett', '💜', 12, { c: 0 }], ['plasma', 'Plasma', '🩷', 18, { c: 0 }], ['rainbow', 'Regenbogen', '🌈', 25, { c: 0 }]]),
  ...w3Items('car', 'glow', [['none', 'Aus', '—', 0, { c: 0 }], ['cyan', 'Türkis', '🩵', 18, { c: 0 }], ['pink', 'Pink', '🩷', 18, { c: 0 }], ['green', 'Grün', '💚', 18, { c: 0 }], ['violet', 'Violett', '💜', 18, { c: 0 }], ['gold', 'Gold', '💛', 20, { c: 0 }], ['rainbow', 'Regenbogen', '🌈', 30, { c: 0, u: 50 }]]),
];
/* Erweiterung: noch mehr Teile (Preise: bis 10 Normal, bis 20 Gold, bis 35 Episch, darüber Legendär) */
A3_ITEMS.push(
  ...w3Items('a3', 'eyes', [['spiral', 'Spiralaugen', '😵‍💫', 12], ['robot', 'Roboteraugen', '🤖', 14], ['diamond', 'Diamantaugen', '💎', 22]], 'body'),
  ...w3Items('a3', 'top', [['striped', 'Ringel-Shirt', '🦓', 8, { c: 2 }], ['hawaii', 'Hawaiihemd', '🌺', 14, { c: 2 }]]),
  ...w3Items('a3', 'hat', [['ninja', 'Stirnband', '🥷', 8, { c: 2 }], ['chef', 'Kochmütze', '👨‍🍳', 10, { c: 0 }], ['santa', 'Zipfelmütze', '🎅', 10], ['antlers', 'Geweih', '🦌', 15, { c: 0 }],
    ['propeller', 'Propellermütze', '🚁', 15, { c: 2 }], ['frog', 'Froschmütze', '🐸', 16], ['cowboy', 'Cowboyhut', '🤠', 16, { c: 2 }], ['graduation', 'Doktorhut', '🎓', 18],
    ['pirate', 'Piratenhut', '🏴‍☠️', 20, { c: 0 }], ['tophat', 'Zylinder', '🎩', 20, { c: 2 }], ['unicorn', 'Einhorn-Horn', '🦄', 28, { c: 0 }], ['dino', 'Dino-Mütze', '🦖', 30, { c: 2 }],
    ['halo', 'Heiligenschein', '😇', 45, { c: 0, u: 80 }]], 'acc'),
  ...w3Items('a3', 'glasses', [['monocle', 'Monokel', '🧐', 14, { c: 0 }], ['ski', 'Skibrille', '⛷️', 16], ['mask', 'Heldenmaske', '🦹', 18], ['rainbow', 'Regenbogen-Brille', '🌈', 22, { c: 0 }], ['pixel', 'Pixel-Brille', '😎', 25, { c: 0 }]], 'acc'),
  ...w3Items('a3', 'neck', [['whistle', 'Trillerpfeife', '📯', 6, { c: 0 }], ['tie', 'Krawatte', '👔', 8, { c: 2 }], ['lei', 'Blumenkette', '🌺', 14, { c: 0 }], ['diamond', 'Diamantkette', '💎', 42, { c: 0, u: 80 }]], 'acc'),
  ...w3Items('a3', 'hand', [['donut', 'Donut', '🍩', 8, { c: 0 }], ['pizza', 'Pizzastück', '🍕', 8, { c: 0 }], ['paintbrush', 'Pinsel', '🖌️', 8], ['duck', 'Badeente', '🐤', 10, { c: 0 }],
    ['tennis', 'Tennisschläger', '🎾', 14, { c: 0 }], ['telescope', 'Fernrohr', '🔭', 15, { c: 0 }], ['fishing', 'Angel', '🎣', 16, { c: 0 }], ['lantern', 'Laterne', '🏮', 16, { c: 0 }],
    ['sword', 'Ritterschwert', '🗡️', 26, { c: 0 }], ['trident', 'Dreizack', '🔱', 30, { c: 0 }], ['orb', 'Zauberkugel', '🔮', 40], ['laser', 'Laserschwert', '⚔️', 45, { u: 80 }]]),
  ...w3Items('a3', 'back', [['quiver', 'Köcher', '🏹', 18, { c: 0 }], ['tank', 'Taucherflasche', '🤿', 18, { c: 0 }], ['surfboard', 'Surfbrett', '🏄', 26, { c: 2 }], ['shell', 'Schildkrötenpanzer', '🐢', 28, { c: 0 }],
    ['bat', 'Fledermausflügel', '🦇', 32], ['fairy', 'Feenflügel', '🧚', 42, { c: 2 }], ['phoenix', 'Phönixflügel', '🔥', 55, { c: 0, u: 120 }]]),
  ...w3Items('a3', 'pet', [['penguin', 'Pinguin', '🐧', 35, { c: 0 }], ['owl', 'Eule', '🦉', 38], ['parrot', 'Papagei', '🦜', 38], ['fox', 'Fuchs', '🦊', 40], ['panda', 'Panda', '🐼', 42, { c: 0 }],
    ['slime', 'Glibber', '🟢', 45, { u: 60 }], ['unicorn', 'Einhorn', '🦄', 60, { u: 150 }]], 'fun'),
  ...w3Items('a3', 'effect', [['snow', 'Schneeflocken', '❄️', 22, { c: 0 }], ['leaves', 'Blätterwirbel', '🍃', 22, { c: 0 }], ['confetti', 'Konfetti', '🎊', 30, { c: 0 }],
    ['lightning', 'Blitze', '⚡', 40, { c: 0, u: 80 }], ['fire', 'Feuer-Aura', '🔥', 48, { c: 0, u: 100 }], ['coins', 'Münzregen', '🪙', 60, { c: 0, u: 150 }]], 'fun'),
  ...w3Items('a3', 'emote', [['run', 'Rennen', '🏃', 10, { c: 0 }], ['robo', 'Roboter-Tanz', '🤖', 15, { c: 0 }], ['hero', 'Heldenpose', '🦸', 22, { c: 0 }]]),
);
CAR_ITEMS.push(
  ...w3Items('car', 'body', [['banana', 'Bananen-Kart', '🍌', 25, { c: 0 }], ['shoe', 'Turnschuh', '👟', 28, { c: 0 }], ['snail', 'Schnecke', '🐌', 30, { c: 0 }], ['bee', 'Biene', '🐝', 32, { c: 0 }],
    ['dragon', 'Drache', '🐉', 50, { c: 0, u: 100 }]]),
  ...w3Items('car', 'finish', [['carbon', 'Carbon', '🖤', 16, { c: 0 }], ['candy', 'Bonbon-Lack', '🍬', 24, { c: 0 }], ['neon', 'Neon', '🌟', 28, { c: 0 }], ['gold', 'Goldlack', '🏆', 45, { c: 0, u: 100 }]]),
  ...w3Items('car', 'pattern', [['waves', 'Wellen', '🌊', 10], ['camo', 'Tarnmuster', '🪖', 14], ['hearts', 'Herzen', '💖', 15], ['zebra', 'Zebra', '🦓', 15], ['pixel', 'Pixel', '👾', 16],
    ['leopard', 'Leopard', '🐆', 16], ['tiger', 'Tiger', '🐯', 18], ['circuit', 'Platine', '🔌', 25], ['galaxy', 'Galaxie', '🌌', 30], ['rainbow', 'Regenbogen', '🌈', 36]]),
  ...w3Items('car', 'rims', [['flower', 'Blume', '🌼', 14, { c: 0 }], ['fire', 'Feuerrad', '🔥', 24, { c: 0 }], ['rainbow', 'Regenbogen', '🌈', 28, { c: 0 }], ['diamond', 'Diamant', '💎', 40, { c: 0, u: 80 }]]),
  ...w3Items('car', 'wing', [['heart', 'Herz', '💗', 18, { c: 0 }], ['jet', 'Düsenflügel', '✈️', 24, { c: 0 }], ['dragon', 'Drachenflügel', '🐲', 30, { c: 0 }], ['angel', 'Engelsflügel', '😇', 42, { c: 0, u: 80 }]]),
  ...w3Items('car', 'exhaust', [['candy', 'Zuckerstange', '🍭', 14, { c: 0 }], ['trumpet', 'Trompete', '🎺', 16, { c: 0 }], ['rocket', 'Raketendüse', '🚀', 22, { c: 0 }]]),
  ...w3Items('car', 'flames', [['gold', 'Gold', '💛', 18, { c: 0 }], ['sun', 'Sonne', '☀️', 20, { c: 0 }], ['ice', 'Eis', '🧊', 22, { c: 0 }], ['shadow', 'Schatten', '🌑', 24, { c: 0 }]]),
  ...w3Items('car', 'glow', [['red', 'Rot', '❤️', 18, { c: 0 }], ['orange', 'Orange', '🧡', 18, { c: 0 }], ['white', 'Weiss', '🤍', 18, { c: 0 }]]),
  ...w3Items('car', 'topper', [['none', 'Nichts', '—', 0, { c: 0 }], ['flag', 'Fähnchen', '🚩', 8, { c: 0 }], ['antenna', 'Antennen-Ball', '🔴', 10, { c: 0 }], ['duck', 'Gummiente', '🐤', 15, { c: 0 }],
    ['propeller', 'Propeller', '🚁', 18, { c: 0 }], ['siren', 'Blaulicht', '🚨', 25, { c: 0 }], ['crown', 'Krone', '👑', 32, { c: 0 }], ['unicorn', 'Einhorn-Horn', '🦄', 40, { c: 0, u: 80 }], ['trophy', 'Pokal', '🏆', 48, { c: 0, u: 120 }]]),
);
const W3_ITEM = Object.fromEntries([...A3_ITEMS, ...CAR_ITEMS].map((i) => [i.id, i]));
const w3Item = (pre, slot, v) => W3_ITEM[`${pre}:${slot}:${v}`];
const w3Slot = (pre, slot) => (pre === 'a3' ? A3_ITEMS : CAR_ITEMS).filter((i) => i.slot === slot);

/* ---------------- Grundausstattung ---------------- */
const A3_DEFAULT = {
  v: 1, skin: 0xe9b48c, eyes: 'round', eyeC: 0x6b4423, brows: 'normal', mouth: 'grin', lashes: false, blush: false, freckles: false, deco: 'none',
  hair: 'spiky', hairC: 0x7a4422, hairC2: 0x8b5cf6,
  top: 'tshirt', topC: 0x14a39a, topT: 0xffffff, topU: 0xf4f4f6,
  bottom: 'jeans', bottomC: 0x3e63b5, bottomT: 0xf5c518,
  shoes: 'sneakers', shoesC: 0xffffff, shoesC2: 0x2453d6,
  hat: 'none', hatC: 0x2453d6, hatC2: 0xf4f4f6, glasses: 'none', glassesC: 0x1f2430, neck: 'none', neckC: 0xe2483d, neckC2: 0xffffff,
  wrist: 'none', wristC: 0x2453d6, wristC2: 0x5eead4, bag: 'none', bagC: 0x22c55e, bagC2: 0xf5c518, back: 'none', backC: 0xe2483d, backC2: 0xf5c518,
  hand: 'none', handC: 0xe2483d, pet: 'none', petC: 0xf59e0b, effect: 'none', effectC: 0xa78bfa, emote: 'wave',
};
const CAR_DEFAULT = { v: 1, body: 'formula', paint: 0xff5a36, paint2: 0xffffff, finish: 'gloss', pattern: 'none', rims: 'classic', wing: 'standard', exhaust: 'chrome', flames: 'classic', glow: 'none', topper: 'none', num: 1 };
const A3_COLOR_KEYS = ['skin', 'eyeC', 'hairC2', 'topC', 'topT', 'topU', 'bottomC', 'bottomT', 'shoesC', 'shoesC2', 'hatC', 'hatC2', 'glassesC', 'neckC', 'neckC2', 'wristC', 'wristC2', 'bagC', 'bagC2', 'backC', 'backC2', 'handC', 'petC', 'effectC'];

/** Gespeicherte Daten säubern: unbekannte Werte → Grundausstattung (so bricht nie etwas, auch bei alten Ständen) */
function w3Clean(pre, raw) {
  const D = pre === 'a3' ? A3_DEFAULT : CAR_DEFAULT;
  const c = { ...D };
  const r = raw && typeof raw === 'object' ? raw : {};
  const isCol = (x) => Number.isInteger(x) && x >= 0 && x <= 0xffffff;
  for (const k of Object.keys(D)) {
    const v = r[k];
    if (v == null) continue;
    if (typeof D[k] === 'boolean') c[k] = !!v;
    else if (typeof D[k] === 'number' && k !== 'v' && k !== 'num') { if (isCol(v) || (k === 'hairC' && v === 'rainbow')) c[k] = v; }
    else if (k === 'num') c[k] = Math.min(99, Math.max(1, Math.round(+v) || 1));
    else if (k === 'hairC') c[k] = v === 'rainbow' || isCol(v) ? v : D[k];
    else if (typeof D[k] === 'string') { if (w3Item(pre, k, v)) c[k] = v; }
  }
  if (pre === 'a3' && r.hairC === 'rainbow') c.hairC = 'rainbow';
  return c;
}
/** Zufälliger Start-Look aus Gratis-Teilen (aus dem Benutzernamen, also immer gleich für das Kind) */
function a3Starter(seed = '') {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const free = (slot) => w3Slot('a3', slot).filter((i) => !i.price && i.v !== 'none').map((i) => i.v);
  return { ...A3_DEFAULT, skin: pick(W3_SKINS), eyes: pick(['round', 'happy', 'wide', 'round']), eyeC: pick(W3_EYEC), mouth: pick(['smile', 'grin', 'smile']), hair: pick(free('hair').filter((v) => v !== 'emo')),
    hairC: pick(W3_HAIRC.slice(0, 8)), top: pick(['tshirt', 'sweater', 'hoodie']), topC: pick(W3_CLOTH), topT: pick(W3_TRIM), bottom: pick(['jeans', 'shorts', 'joggers', 'jeans']), bottomC: pick(W3_PANTS.slice(0, 6)),
    shoesC: pick(W3_CLOTH), shoesC2: pick(W3_TRIM), freckles: rnd() < 0.25, blush: rnd() < 0.4 };
}

/** Avatar-Einstellungen → Bauplan für die 3D-Figur (avatar3d.js) */
function a3Look(c) {
  const L = {
    skin: c.skin,
    face: { eyes: c.eyes, eyeC: c.eyeC, brows: c.brows, mouth: c.mouth, lashes: !!c.lashes, blush: !!c.blush, freckles: !!c.freckles, deco: c.deco === 'none' ? undefined : c.deco },
    hair: { id: c.hair, c: c.hairC, c2: c.hairC2 },
    top: { id: c.top, c: c.topC, trim: c.topT, under: c.topU, patches: [c.topT, 0x7dd3fc], logoC: c.topT },
    bottom: { id: c.bottom, c: c.bottomC, trim: c.bottomT, warmers: [c.bottomT, 0xbae6fd] },
    shoes: { id: c.shoes, c: c.shoesC, c2: c.shoes === 'sandals' ? 0 : c.shoesC2 },
  };
  if (c.hat !== 'none') L.hat = { id: c.hat, c: c.hatC, c2: c.hatC2, c3: c.topT };
  if (c.glasses !== 'none') L.glasses = { id: c.glasses, c: c.glassesC };
  if (c.neck !== 'none') L.neck = { id: c.neck, c: c.neckC, c2: c.neckC2 };
  if (c.wrist !== 'none') L.wrist = { id: c.wrist, c: c.wristC, c2: c.wristC2 };
  if (c.bag !== 'none') L.bag = { id: c.bag, c: c.bagC, c2: c.bagC2 };
  if (c.back !== 'none') L.back = { id: c.back, c: c.backC, c2: c.backC2 };
  if (c.hand !== 'none') L.hand = { id: c.hand, c: c.handC };
  if (c.pet !== 'none') L.pet = { id: c.pet, c: c.petC };
  if (c.effect !== 'none') L.effect = { id: c.effect, c: c.effectC };
  return L;
}
/** Teile in einer Einstellung, die etwas kosten (für Besitz-Prüfung) */
function w3PaidIn(pre, c) {
  const out = [];
  for (const [k, v] of Object.entries(c)) { const it = w3Item(pre, k, v); if (it && it.price) out.push(it); }
  return out;
}

/* ---------------- Konto ---------------- */
const W3 = { mode: 'guest', a3: null, car: null, savedA3: null, savedCar: null, sqlOld: false, busy: false, saveT: 0, saving: false, status: '' };
const w3Kid = () => typeof isKid === 'function' && isKid() && typeof avatarOn === 'function' && avatarOn() && typeof AV === 'object';
const w3Teacher = () => typeof cloud === 'object' && !!cloud.uid && !(typeof isKid === 'function' && isKid());
/** kid: echtes Konto · teacher: alles frei zur Vorschau · guest: nur Gratis-Teile, Kaufen nach dem Anmelden
    off: Kind, bei dessen Klasse der Avatar ausgeschaltet ist (nur Gratis-Teile, gespeichert auf dem Gerät) */
const w3Mode = () => (w3Kid() ? 'kid' : w3Teacher() ? 'teacher' : typeof isKid === 'function' && isKid() ? 'off' : 'guest');
const W3_LOCAL = (what) => `teilmal.w3.${what}.${typeof kid === 'object' && kid.username ? kid.username : w3Teacher() ? 'lp' : 'gast'}`;
function w3LocalGet(what) { try { return JSON.parse(localStorage.getItem(W3_LOCAL(what))); } catch { return null; } }
function w3LocalSet(what, v) { try { localStorage.setItem(W3_LOCAL(what), JSON.stringify(v)); } catch { /* voll */ } }

const w3Coins = () => (w3Mode() === 'kid' ? AV.state?.coins ?? 0 : 0);
const w3Earned = () => (w3Mode() === 'kid' ? AV.state?.earned ?? 0 : 0);
function w3Owns(it) {
  if (!it || !it.price) return true;
  const m = w3Mode();
  if (m === 'teacher') return true;
  if (m === 'kid') return !!AV.state?.owned?.includes(it.id);
  return false;
}
const w3Locked = (it) => !!(it?.unlock && w3Mode() === 'kid' && w3Earned() < it.unlock.earned && !w3Owns(it));
const w3ShopOpen = () => w3Mode() !== 'kid' || (typeof avCfg === 'function' ? avCfg().shop !== false : true);

/** Gespeicherten Stand holen (Konto → Gerät → Start-Look) */
function w3Saved(pre) {
  const m = w3Mode();
  const field = pre === 'a3' ? 'avatar3d' : 'garage';
  let raw = null;
  if (m === 'kid' && AV.state) {
    if (!(field in AV.state)) W3.sqlOld = true;
    raw = AV.state[field] && Object.keys(AV.state[field]).length ? AV.state[field] : null;
  }
  if (!raw) raw = w3LocalGet(pre);
  if (!raw && pre === 'a3') return { ...a3Starter(typeof kid === 'object' ? kid.username : ''), fresh: true };
  const c = w3Clean(pre, raw);
  // Sicherheit: nicht (mehr) gekaufte Teile weglassen
  for (const it of w3PaidIn(pre, c)) if (!w3Owns(it)) c[it.slot] = (pre === 'a3' ? A3_DEFAULT : CAR_DEFAULT)[it.slot];
  return c;
}
/** Für das Rennen: die Kart-Optik des angemeldeten Kindes (oder der Vorschau auf diesem Gerät) */
function garageLook() {
  try {
    const c = w3Saved('car');
    const L = { ...c }; delete L.v;
    return L;
  } catch { return null; }
}
/** Avatar-Bauplan des Kindes (für Startseite usw.) */
const a3Mine = () => a3Look(w3Saved('a3'));

async function w3Rpc(fn, args) {
  if (typeof avRpc !== 'function') throw new Error('offline');
  return avRpc(fn, args);
}
const w3ErrNoFn = (e) => /PGRST202|Could not find the function|does not exist|404/i.test(`${e?.code || ''} ${e?.message || ''}`);

/** Speichern (Kind: Datenbank + Gerät; sonst nur Gerät) – nur mit gekauften Teilen */
async function w3Save(pre, cfg) {
  const c = w3Clean(pre, cfg);
  if (w3PaidIn(pre, c).some((it) => !w3Owns(it))) throw new Error('not_owned');
  w3LocalSet(pre, c);
  if (w3Mode() !== 'kid' || W3.sqlOld) return { local: true };
  try {
    const st = await w3Rpc(pre === 'a3' ? 'fab_avatar3d_save' : 'fab_garage_save', pre === 'a3' ? { p_look: c } : { p_car: c });
    w3Apply(st);
    return { ok: true };
  } catch (e) {
    if (w3ErrNoFn(e)) { W3.sqlOld = true; return { local: true }; }
    throw e;
  }
}
/** Neuen Server-Stand übernehmen, ohne den 2D-Avatar zu verlieren */
function w3Apply(st) {
  if (!st || typeof avApply !== 'function') return;
  const keep = AV.state?.avatar, fresh = AV.state?.fresh;
  avApply(st);
  if (keep && AV.state) { AV.state.avatar = keep; AV.state.fresh = fresh; }
}
/** Ein Teil kaufen. Liefert true, wenn es jetzt dem Kind gehört. */
async function w3Buy(it) {
  if (!it || w3Owns(it)) return true;
  if (w3Mode() === 'off') { toast('Der Shop ist bei deiner Klasse gerade ausgeschaltet.'); return false; }
  if (w3Mode() !== 'kid') { toast('Melde dich mit deinem Kärtchen an, dann kannst du mit deinen Münzen einkaufen.'); return false; }
  if (!w3ShopOpen()) { toast('Der Shop ist gerade geschlossen.'); return false; }
  if (w3Locked(it)) { toast(`Das gibt es ab ${it.unlock.earned} gesammelten Münzen. Du hast schon ${w3Earned()}.`); return false; }
  if (w3Coins() < it.price) { toast(`Dir fehlen noch ${it.price - w3Coins()} Münzen. Üben bringt Münzen!`); return false; }
  if (W3.busy) return false;
  W3.busy = true;
  try {
    const st = await w3Rpc('fab_avatar_buy', { p_item: it.id });
    w3Apply(st);
    if (!AV.state?.owned?.includes(it.id)) throw new Error('not_saved');
    if (typeof tone === 'function') tone([784, 1046, 1318], 0.1, 'triangle', 0.1);
    toast(`«${it.name}» gehört jetzt dir! 🎉`, 'good');
    return true;
  } catch (e) {
    const m = `${e?.message || ''}`;
    toast(/not_enough/.test(m) ? 'Nicht genug Münzen.' : /shop_off/.test(m) ? 'Der Shop ist gerade geschlossen.' : /locked/.test(m) ? 'Dieses Teil ist noch nicht freigeschaltet.'
      : /no_item/.test(m) ? 'Dieses Teil gibt es im Shop noch nicht. Deine Lehrperson muss die Datenbank aktualisieren (avatar.sql).' : 'Kaufen hat nicht geklappt. Bist du online?', 'bad');
    return false;
  } finally { W3.busy = false; }
}

/* ---------------- Spiele bezahlen (ein Konto) ----------------
   Angemeldete Kinder zahlen mit den Münzen aus dem gemeinsamen Konto (fab_coins_spend, mit Auftragsnummer gegen
   doppeltes Abbuchen). Ist die Datenbank noch alt oder das Gerät offline, zahlt das Kind wie bisher mit den Münzen
   auf diesem Gerät. */
const w3Wallet = () => w3Mode() === 'kid' && !!AV.state && (typeof avCfg !== 'function' || avCfg().coins !== false) && !W3.walletOff;
function w3Uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
/** Liefert 'ok', 'poor' (zu wenig Münzen) oder 'local' (mit Münzen auf diesem Gerät bezahlen) */
async function w3PayGame(n, reason) {
  if (!w3Wallet()) return 'local';
  if ((AV.state.coins ?? 0) < n) return 'poor';
  const req = W3.pendingReq || (W3.pendingReq = w3Uuid());
  try {
    const st = await w3Rpc('fab_coins_spend', { p_n: n, p_reason: reason, p_request: req });
    W3.pendingReq = null;
    w3Apply(st);
    return 'ok';
  } catch (e) {
    const m = `${e?.message || ''}`;
    if (/not_enough/.test(m)) { W3.pendingReq = null; await avatarLoad?.(true); return 'poor'; }
    if (w3ErrNoFn(e)) { W3.walletOff = true; W3.pendingReq = null; return 'local'; }
    return 'local'; // offline: bezahlt mit den Münzen auf diesem Gerät (die gleiche Auftragsnummer bleibt für den nächsten Versuch)
  }
}

/* ---------------- 3D-Teile erst laden, wenn sie gebraucht werden ---------------- */
function w3Asset(path) {
  const v = document.querySelector('script[src*="js/shop3d.js"]')?.getAttribute('src')?.match(/\?v=[^&]+/)?.[0] || '';
  return new URL(path + v, document.baseURI).href;
}
let w3EngineP = null;
const w3Script = (path) => new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = w3Asset(path);
  s.onload = () => res();
  s.onerror = () => rej(new Error(path));
  document.head.appendChild(s);
});
/** Welten-Lauf (js/runner3d.js + js/runworlds.js) erst bei Bedarf laden. Die Liste der Welten steht hier, damit die Startkarte sie schon zeigen kann. */
const RUN_WORLD_INFO = [
  { id: 'jungle', name: 'Dschungel', emoji: '🌴', desc: 'Alter Steinweg mitten durch den Urwald' },
  { id: 'roofs', name: 'Über den Dächern', emoji: '🏙️', desc: 'Von Hochhaus zu Hochhaus in der Abendsonne' },
  { id: 'desert', name: 'Wüste', emoji: '🏜️', desc: 'Dünen, Schluchten und alte Ruinen' },
  { id: 'castle', name: 'Ritterburg', emoji: '🏰', desc: 'Zwischen Burgmauern, Türmen und Fahnen' },
  { id: 'sea', name: 'Unter Wasser', emoji: '🐠', desc: 'Über den Meeresgrund zwischen Korallen' },
];
let w3RunnerP = null;
function w3LoadRunner() {
  if (typeof runnerStart === 'function' && typeof RUN_WORLDS === 'object') return w3LoadEngine();
  if (!w3RunnerP) {
    w3RunnerP = w3LoadEngine()
      .then(() => (typeof runnerStart === 'function' ? null : w3Script('js/runner3d.js')))
      .then(() => (typeof RUN_WORLDS === 'object' ? null : w3Script('js/runworlds.js')))
      .catch((e) => { w3RunnerP = null; throw e; });
  }
  return w3RunnerP;
}
/** Welt-Auswahl (Startkarte in beiden Tools) */
function w3RunWorldsHTML(cur, action = 'run-world') {
  return `<div class="rn-worlds" role="radiogroup" aria-label="Welt">${RUN_WORLD_INFO.map((w) => `<button type="button" class="rn-world w-${w.id}" data-action="${action}" data-v="${w.id}" role="radio" aria-checked="${w.id === cur}"><span class="e" aria-hidden="true">${w.emoji}</span><b>${w.name}</b><small>${w.desc}</small></button>`).join('')}</div>`;
}
/** Avatar-Baukasten (js/avatar3d.js) und – wo es das Rennen gibt – Karts im Avatar-Stil (js/kartvox.js) erst bei Bedarf laden */
function w3LoadEngine() {
  if (typeof vxFigure === 'function' && (typeof kartVoxModel === 'function' || !w3Garage())) return Promise.resolve();
  if (!w3EngineP) {
    w3EngineP = (typeof vxFigure === 'function' ? Promise.resolve() : w3Script('js/avatar3d.js'))
      .then(() => (typeof kartVoxModel === 'function' || !w3Garage() ? null : w3Script('js/kartvox.js')))
      .catch((e) => { w3EngineP = null; throw e; });
  }
  return w3EngineP;
}
