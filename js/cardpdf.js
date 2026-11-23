/* Vokaboom – Vokabelkärtchen als PDF zum Ausschneiden (für Lehrpersonen und Kinder)
 *
 * Faltkärtchen: links das Wort in der Fremdsprache, rechts Deutsch (mit Bild). Entlang der gestrichelten Linie
 * ausschneiden, in der Mitte falten (und zusammenkleben) – so braucht es keinen beidseitigen Druck.
 * A4, 2 × 7 Kärtchen pro Seite. Das PDF entsteht im Browser (Seiten als Bilder, buildPDF aus js/classes.js).
 */
'use strict';

const VC_HALF_W = 46, VC_H = 34; // mm: eine Kartenseite (gefaltet)
const VC_COLS = 2, VC_ROWS = 7, VC_GX = 8, VC_GY = 3.5;

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
async function vcDrawCard(ctx, x, y, s, set, w, imgs) {
  const X = (mm) => (x + mm) * s, Y = (mm) => (y + mm) * s, L = (mm) => mm * s;
  const disp = (px) => `800 ${px}px 'Bricolage Grotesque', Lexend, system-ui, sans-serif`;
  const body = (px) => `600 ${px}px Lexend, system-ui, sans-serif`;
  const W2 = VC_HALF_W * 2;
  // Hintergründe der beiden Seiten
  ctx.fillStyle = '#F3F1FF'; ctx.fillRect(X(0), Y(0), L(VC_HALF_W), L(VC_H));
  ctx.fillStyle = '#FFFBEF'; ctx.fillRect(X(VC_HALF_W), Y(0), L(VC_HALF_W), L(VC_H));
  // Schneidelinie (gestrichelt) und Faltlinie (gepunktet)
  ctx.save();
  ctx.strokeStyle = '#9AA0AE'; ctx.lineWidth = L(0.3); ctx.setLineDash([L(2), L(1.4)]);
  ctx.strokeRect(X(0), Y(0), L(W2), L(VC_H));
  ctx.strokeStyle = '#C4C8D2'; ctx.setLineDash([L(0.5), L(1.2)]);
  ctx.beginPath(); ctx.moveTo(X(VC_HALF_W), Y(0)); ctx.lineTo(X(VC_HALF_W), Y(VC_H)); ctx.stroke();
  ctx.restore();
  // Fremdsprache (links)
  ctx.font = body(L(2.2)); ctx.fillStyle = '#7C6FD6'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(LANGS[set.lang]?.short || '', X(2.2), Y(2));
  vcText(ctx, stripParens(w.foreign) || w.foreign, X(VC_HALF_W / 2), Y(VC_H / 2 + 0.5), L(VC_HALF_W - 6), L(VC_H - 8), L(6.2), disp, '#2A2266');
  // Deutsch (rechts), mit Bild
  ctx.font = body(L(2.2)); ctx.fillStyle = '#C08A14'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('DE', X(VC_HALF_W + 2.2), Y(2));
  const p = vcPic(set, w);
  let picH = 0;
  const pcx = X(VC_HALF_W + VC_HALF_W / 2), pcy = Y(11.5), ps = L(14);
  if (p) {
    picH = 15;
    if (p.kind === 'emoji') { ctx.font = `${ps * 0.86}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.src, pcx, pcy + ps * 0.04); }
    else if (p.kind === 'color') { ctx.fillStyle = p.src; ctx.beginPath(); ctx.arc(pcx, pcy, ps * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = L(0.3); ctx.stroke(); }
    else if (p.kind === 'number') { vcText(ctx, p.src, pcx, pcy, ps * 1.6, ps, ps * 0.8, disp, '#C08A14'); }
    else {
      const img = imgs.get(p.src);
      if (img) { const k = Math.min(ps / img.width, ps / img.height); ctx.drawImage(img, pcx - (img.width * k) / 2, pcy - (img.height * k) / 2, img.width * k, img.height * k); } else picH = 0;
    }
  }
  if (picH) vcText(ctx, stripParens(w.german) || w.german, X(VC_HALF_W * 1.5), Y(26.5), L(VC_HALF_W - 6), L(10), L(4.4), disp, '#5A3C00');
  else vcText(ctx, stripParens(w.german) || w.german, X(VC_HALF_W * 1.5), Y(VC_H / 2 + 0.5), L(VC_HALF_W - 6), L(VC_H - 8), L(6.2), disp, '#5A3C00');
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
    const PW = 210, PH = 297, per = VC_COLS * VC_ROWS, CW = VC_HALF_W * 2;
    const x0 = (PW - VC_COLS * CW - (VC_COLS - 1) * VC_GX) / 2, y0 = 20;
    const pages = [], nPages = Math.ceil(words.length / per);
    for (let i = 0; i < words.length; i += per) {
      const cv = document.createElement('canvas');
      cv.width = Math.round(PW * s); cv.height = Math.round(PH * s);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      // Kopfzeile mit Anleitung
      ctx.fillStyle = '#2A2266'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `800 ${5 * s}px 'Bricolage Grotesque', Lexend, sans-serif`;
      ctx.fillText(set.name, x0 * s, 11 * s);
      ctx.font = `500 ${2.7 * s}px Lexend, system-ui, sans-serif`; ctx.fillStyle = '#5B6070';
      ctx.fillText(`✂ Ausschneiden (gestrichelte Linie), in der Mitte falten und zusammenkleben.  ·  ${LANGS[set.lang]?.name || ''} – Deutsch  ·  Seite ${pages.length + 1}/${nPages}`, x0 * s, 16 * s);
      const batch = words.slice(i, i + per);
      for (let k = 0; k < batch.length; k++) {
        const cx = x0 + (k % VC_COLS) * (CW + VC_GX), cy = y0 + Math.floor(k / VC_COLS) * (VC_H + VC_GY);
        await vcDrawCard(ctx, cx, cy, s, set, batch[k], imgs);
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
