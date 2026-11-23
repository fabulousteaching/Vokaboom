/* Vokaboom – Vokabelkärtchen als PDF zum Ausschneiden (für Lehrpersonen und Kinder)
 *
 * Zum beidseitigen Drucken: Seite 1 Vorderseiten (Deutsch mit Bild), Seite 2 Rückseiten (Fremdsprache), gespiegelt,
 * so dass jedes Wort nach dem Wenden an der langen Kante genau hinter seiner Übersetzung liegt. A4, 3 × 6 Kärtchen pro Blatt. Das PDF entsteht im Browser (Seiten als Bilder, buildPDF aus js/classes.js).
 */
'use strict';

const VC_W = 62, VC_H = 42; // mm pro Kärtchen
const VC_COLS = 3, VC_ROWS = 6;
const VC_X0 = (210 - VC_COLS * VC_W) / 2, VC_Y0 = 22; // links und rechts gleich viel Rand: die Rückseite liegt beim Wenden genau darauf

/** Bild eines Worts laden (nur, wenn es sich ins PDF zeichnen lässt) */
function vcLoadImg(src) {
  return new Promise((res) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = (ok) => {
      if (!ok) { res(null); return; }
      try { const c = document.createElement('canvas'); c.width = c.height = 2; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 2, 2); g.getImageData(0, 0, 1, 1); res(img); } catch { res(null); } // fremdes Bild ohne Freigabe: weglassen
    };
    img.onload = () => done(true); img.onerror = () => done(false);
    setTimeout(() => done(false), 6000);
    img.src = src;
  });
}
function vcPic(set, w) {
  if (set.noPics) return null;
  const p = w.pic;
  if (p && p.kind === 'none') return null;
  if (p && !(p.src && brokenPics.has(p.src))) return p;
  return typeof localPicture === 'function' ? localPicture(w, set.lang) : null;
}
/** Text in ein Feld setzen: bis zu 3 Zeilen, Schrift wird kleiner, bis alles passt */
function vcText(ctx, text, cx, cy, maxW, maxH, max, font, color) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let size = max, lines = [String(text)];
  for (; size >= max * 0.35; size *= 0.93) {
    ctx.font = font(size);
    lines = []; let cur = '';
    for (const wd of words) {
      const t = cur ? `${cur} ${wd}` : wd;
      if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = wd; }
    }
    if (cur) lines.push(cur);
    const lh = size * 1.15;
    if (lines.length <= 3 && lines.every((l) => ctx.measureText(l).width <= maxW) && lines.length * lh <= maxH) break;
  }
  ctx.font = font(size); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lh = size * 1.15, y0 = cy - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh));
}
/** Ein Kärtchen: Vorderseite Deutsch (mit Bild), Rückseite Fremdsprache */
function vcDrawCard(ctx, x, y, s, set, w, imgs, back) {
  const X = (mm) => (x + mm) * s, Y = (mm) => (y + mm) * s, L = (mm) => mm * s;
  const disp = (px) => `800 ${px}px 'Bricolage Grotesque', Lexend, system-ui, sans-serif`;
  const body = (px) => `600 ${px}px Lexend, system-ui, sans-serif`;
  // Schneidelinien nur auf der Vorderseite (die Rückseite bleibt ohne Rand, falls der Drucker ein wenig verschiebt)
  if (!back) {
    ctx.save(); ctx.strokeStyle = '#A3A8B4'; ctx.lineWidth = L(0.25); ctx.setLineDash([L(1.8), L(1.3)]);
    ctx.strokeRect(X(0), Y(0), L(VC_W), L(VC_H)); ctx.restore();
  }
  const tag = back ? (LANGS[set.lang]?.short || '') : 'DE';
  ctx.font = body(L(2.2)); ctx.fillStyle = back ? '#7C6FD6' : '#C08A14'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(tag, X(3.5), Y(3.2));
  if (back) { vcText(ctx, stripParens(w.foreign) || w.foreign, X(VC_W / 2), Y(VC_H / 2), L(VC_W - 10), L(VC_H - 12), L(7.5), disp, '#2A2266'); return; }
  const p = vcPic(set, w);
  let pic = false;
  const pcx = X(VC_W / 2), pcy = Y(15), ps = L(17);
  if (p) {
    pic = true;
    if (p.kind === 'emoji') { ctx.font = `${ps * 0.86}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.src, pcx, pcy + ps * 0.04); }
    else if (p.kind === 'color') { ctx.fillStyle = p.src; ctx.beginPath(); ctx.arc(pcx, pcy, ps * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = L(0.3); ctx.stroke(); }
    else if (p.kind === 'number') vcText(ctx, p.src, pcx, pcy, ps * 1.6, ps, ps * 0.8, disp, '#C08A14');
    else {
      const img = imgs.get(p.src);
      if (img) { const k = Math.min(ps / img.width, ps / img.height); ctx.drawImage(img, pcx - (img.width * k) / 2, pcy - (img.height * k) / 2, img.width * k, img.height * k); } else pic = false;
    }
  }
  const de = stripParens(w.german) || w.german;
  if (pic) vcText(ctx, de, X(VC_W / 2), Y(32.5), L(VC_W - 10), L(12), L(5.2), disp, '#3B2A00');
  else vcText(ctx, de, X(VC_W / 2), Y(VC_H / 2), L(VC_W - 10), L(VC_H - 12), L(7.5), disp, '#3B2A00');
}

/** PDF mit allen Vokabeln der Portion herunterladen */
async function downloadVocabCardsPDF(set, btn) {
  const words = (set?.words || []).filter((w) => w.foreign && w.german);
  if (!words.length) { toast('In dieser Portion gibt es keine Vokabeln mit Übersetzung.', 'bad'); return; }
  if (typeof buildPDF !== 'function') { toast('Das PDF konnte nicht erstellt werden.', 'bad'); return; }
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> PDF wird erstellt …'; }
  try {
    try { await Promise.all(["800 20px 'Bricolage Grotesque'", '600 20px Lexend'].map((f) => document.fonts.load(f))); } catch { /* egal */ }
    // Bilder vorab laden
    const imgs = new Map();
    await Promise.all([...new Set(words.map((w) => vcPic(set, w)).filter((p) => p && p.src && !['emoji', 'color', 'number'].includes(p.kind)).map((p) => p.src))]
      .map(async (src) => { const im = await vcLoadImg(src); if (im) imgs.set(src, im); }));
    const s = 11.81; // 300 dpi
    const PW = 210, PH = 297, per = VC_COLS * VC_ROWS, sheets = Math.ceil(words.length / per);
    const pages = [];
    const page = (batch, back, no) => {
      const cv = document.createElement('canvas');
      cv.width = Math.round(PW * s); cv.height = Math.round(PH * s);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (!back) {
        ctx.fillStyle = '#2A2266'; ctx.font = `800 ${5 * s}px 'Bricolage Grotesque', Lexend, sans-serif`;
        ctx.fillText(set.name, VC_X0 * s, 11 * s);
        ctx.font = `500 ${2.7 * s}px Lexend, system-ui, sans-serif`; ctx.fillStyle = '#5B6070';
        ctx.fillText(`Beidseitig drucken (an der langen Kante wenden), dann entlang der Linien ausschneiden.  ·  Vorne Deutsch, hinten ${LANGS[set.lang]?.name || ''}  ·  Blatt ${no}/${sheets}`, VC_X0 * s, 16.5 * s);
      }
      batch.forEach((w, k) => {
        const c = k % VC_COLS, r = Math.floor(k / VC_COLS);
        const col = back ? VC_COLS - 1 - c : c; // Rückseite gespiegelt: liegt nach dem Wenden genau hinter dem Wort
        vcDrawCard(ctx, VC_X0 + col * VC_W, VC_Y0 + r * VC_H, s, set, w, imgs, back);
      });
      const url = cv.toDataURL('image/jpeg', 0.9);
      const bin = atob(url.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let j2 = 0; j2 < bin.length; j2++) bytes[j2] = bin.charCodeAt(j2);
      pages.push({ jpeg: bytes, w: cv.width, h: cv.height });
    };
    for (let i = 0; i < words.length; i += per) {
      const batch = words.slice(i, i + per), no = i / per + 1;
      page(batch, false, no); page(batch, true, no);
      await new Promise((r) => setTimeout(r, 0));
    }
    const blob = buildPDF(pages);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Vokabelkaertchen-${set.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'Portion'}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast('PDF heruntergeladen.');
  } catch (e) {
    console.warn('Kärtchen-PDF', e);
    toast('Das PDF konnte nicht erstellt werden.', 'bad');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  }
}

const cardPdfActions = {
  'cards-print': (el) => downloadVocabCardsPDF(currentSet(), el),
};
