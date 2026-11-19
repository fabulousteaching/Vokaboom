/* Vokaboom – Bibliothek: Portionen von anderen Lehrpersonen, geordnet nach
 * Fach (Sprache) → Lehrmittel → Schuljahr → Unit → Portion.
 * Lehrmittel und Units legen Lehrpersonen beim Teilen selbst an (Tabellen vokaboom_lib_*). Gleiche Namen gibt es nur
 * einmal – auch anders geschrieben (gross/klein, Leerzeichen, Akzente). Ohne Konto: ansehen und übernehmen.
 */
'use strict';

const LIB = { lang: '', lm: '', grade: 0, unit: '', loose: false, q: '', hits: null, data: null, loading: null, err: '', noSql: false, seq: 0 };
const LIB_GRADES = [3, 4, 5, 6, 7, 8, 9]; // Fremdsprachen: 3. bis 9. Klasse
const gradeName = (g) => `${g}. Klasse`;
const unitWord = (lang) => (lang === 'fr' ? 'Unité' : 'Unit');
/** gleich wie vokaboom_lib_key in der Datenbank */
const libKey = (t) => String(t || '').toLowerCase().replace(/œ/g, 'o').replace(/æ/g, 'a').replace(/ß/g, 's')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const libSort = (a, b) => a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' });

/** Lehrmittel, Units und das Verzeichnis der geteilten Portionen (ohne Vokabeln) laden */
function libLoad(force = false) {
  if (LIB.data && !force) return Promise.resolve(LIB.data);
  if (LIB.loading) return LIB.loading;
  LIB.loading = (async () => {
    const c = await cloudClient();
    const [lm, un, ix] = await Promise.all([
      c.from('vokaboom_lib_lehrmittel').select('id,lang,name,key'),
      c.from('vokaboom_lib_units').select('id,lehrmittel_id,grade,name,key'),
      c.from(PUBLIC_TABLE).select('set_id,name,word_count,lang,unit_id,updated_at').order('updated_at', { ascending: false }).limit(5000),
    ]);
    LIB.noSql = !!(lm.error || un.error || ix.error);
    let items = ix.data;
    if (ix.error) { // Datenbank noch ohne Bibliothek: wenigstens die Portionen zeigen
      const r = await c.from(PUBLIC_TABLE).select('set_id,name,word_count,lang,updated_at').order('updated_at', { ascending: false }).limit(5000);
      if (r.error) throw r.error;
      items = r.data;
    }
    LIB.data = {
      lms: (lm.data || []).sort(libSort),
      units: (un.data || []).sort(libSort),
      items: (items || []).map((x) => ({ ...x, lang: x.lang === 'fr' ? 'fr' : 'en', unit_id: x.unit_id || null })),
    };
    LIB.err = '';
    return LIB.data;
  })().catch((e) => { LIB.err = cloudErrorText(e); throw e; }).finally(() => { LIB.loading = null; });
  return LIB.loading;
}
const libUnit = (id) => LIB.data?.units.find((u) => u.id === id);
const libLm = (id) => LIB.data?.lms.find((l) => l.id === id);
/** „Englisch › New World › 7. Klasse › Unit 3“ */
function libPath(unitId, withLang = true) {
  const u = libUnit(unitId); const l = u && libLm(u.lehrmittel_id);
  if (!u || !l) return '';
  return [withLang ? LANGS[l.lang].name : '', l.name, gradeName(u.grade), u.name].filter(Boolean).join(' › ');
}
function libCounts() {
  const byUnit = new Map(), byLm = new Map(), byLang = { en: 0, fr: 0 }, loose = { en: 0, fr: 0 };
  for (const it of LIB.data.items) {
    byLang[it.lang]++;
    const u = it.unit_id && libUnit(it.unit_id);
    if (!u) { loose[it.lang]++; continue; }
    byUnit.set(u.id, (byUnit.get(u.id) || 0) + 1);
    byLm.set(u.lehrmittel_id, (byLm.get(u.lehrmittel_id) || 0) + 1);
  }
  return { byUnit, byLm, byLang, loose };
}

/* ---------------- Knopf oben ---------------- */
function libraryButtonHTML() {
  if (!cloudConfigured() || isKid()) return '';
  return `<button class="lib-btn" data-action="library" title="Bibliothek – Portionen von anderen Lehrpersonen">${icon('book')}<span>Bibliothek</span></button>`;
}
function openLibrary(reset = false) {
  if (reset) Object.assign(LIB, { lang: '', lm: '', grade: 0, unit: '', loose: false, q: '', hits: null });
  go('library');
}

/* ---------------- Ansicht ---------------- */
function renderLibrary() {
  const v = document.getElementById('view');
  if (!v) return;
  updateBackBtn();
  if (!LIB.data) {
    v.innerHTML = `<section class="libr"><div class="libr-loading">${LIB.err ? `<p class="banner bad">${esc(LIB.err)}</p>` : '<span class="spinner"></span> Bibliothek wird geladen …'}</div></section>`;
    if (!LIB.err) libLoad().then(() => { if (ui.view === 'library') renderLibrary(); }).catch(() => { if (ui.view === 'library') renderLibrary(); });
    return;
  }
  v.innerHTML = `<section class="libr">
    <header class="libr-head">
      <div><p class="eyebrow">Portionen von anderen Lehrpersonen</p><h1>Bibliothek</h1></div>
      <form class="libr-search" id="libr-search" role="search" autocomplete="off">
        ${icon('search')}<input id="libr-q" type="search" value="${esc(LIB.q)}" placeholder="Suchen: Lehrmittel, Unit, Thema oder Wort" aria-label="In der Bibliothek suchen" enterkeyhint="search">
      </form>
    </header>
    ${LIB.noSql ? '<p class="banner bad small">Für Lehrmittel und Units zuerst <code>supabase/vokabelwelt.sql</code> in Supabase nochmals ausführen.</p>' : ''}
    ${LIB.q ? libSearchHTML() : `${libPathHTML()}<div class="libr-body">${libLevelHTML()}</div>`}
  </section>`;
  bindLibrarySearch();
}
function libPathHTML() {
  const parts = [['', 'Bibliothek', { lang: '', lm: '', grade: 0, unit: '', loose: false }]];
  if (LIB.lang) parts.push([LIB.lang, `${flag(LIB.lang)} ${LANGS[LIB.lang].name}`, { lm: '', grade: 0, unit: '', loose: false }]);
  if (LIB.loose) parts.push(['loose', 'Noch nicht eingeordnet', {}]);
  const lm = libLm(LIB.lm); if (lm) parts.push(['lm', esc(lm.name), { grade: 0, unit: '' }]);
  if (LIB.grade) parts.push(['grade', gradeName(LIB.grade), { unit: '' }]);
  const u = libUnit(LIB.unit); if (u) parts.push(['unit', esc(u.name), {}]);
  return `<nav class="libr-path" aria-label="Wo du in der Bibliothek bist">${parts.map(([k, label, reset], i) => (i === parts.length - 1
    ? `<span class="libr-crumb current">${label}</span>`
    : `<button class="libr-crumb" data-action="lib-nav" data-reset='${JSON.stringify(reset)}'>${label}</button><span class="libr-sep" aria-hidden="true">›</span>`)).join('')}</nav>`;
}
const libRow = (attrs, title, sub, count) => `<li><button class="libr-row" ${attrs}>
  <span class="libr-row-text"><strong>${title}</strong>${sub ? `<small>${sub}</small>` : ''}</span>
  ${count != null ? `<span class="libr-count">${count}</span>` : ''}${icon('right')}</button></li>`;
const portionsWord = (n) => `${n} ${n === 1 ? 'Portion' : 'Portionen'}`;

function libLevelHTML() {
  const d = LIB.data, cnt = libCounts();
  // 1. Fach
  if (!LIB.lang) {
    return `<div class="libr-tiles">${['en', 'fr'].map((l) => `<button class="libr-tile" data-action="lib-nav" data-reset='${JSON.stringify({ lang: l })}'>
      <span class="libr-flag">${flag(l)}</span><strong>${LANGS[l].name}</strong><small>${d.lms.filter((x) => x.lang === l && cnt.byLm.get(x.id)).length} Lehrmittel · ${portionsWord(cnt.byLang[l])}</small></button>`).join('')}</div>`;
  }
  // nicht eingeordnet
  if (LIB.loose) return libItemsHTML(d.items.filter((it) => it.lang === LIB.lang && !libUnit(it.unit_id)), 'Hier sind Portionen, die noch keinem Lehrmittel zugeordnet sind.');
  // 2. Lehrmittel
  if (!LIB.lm) {
    const lms = d.lms.filter((x) => x.lang === LIB.lang && cnt.byLm.get(x.id)); // nur mit Portionen
    return `${lms.length ? `<ul class="libr-list">${lms.map((l) => libRow(`data-action="lib-nav" data-reset='${JSON.stringify({ lm: l.id })}'`, esc(l.name), '', cnt.byLm.get(l.id) || 0)).join('')}</ul>`
      : `<p class="empty">Noch kein ${LANGS[LIB.lang].name}-Lehrmittel in der Bibliothek.</p>`}
      ${cnt.loose[LIB.lang] ? `<ul class="libr-list loose">${libRow(`data-action="lib-nav" data-reset='${JSON.stringify({ loose: true })}'`, 'Noch nicht eingeordnet', 'Ältere geteilte Portionen ohne Lehrmittel', cnt.loose[LIB.lang])}</ul>` : ''}
      ${libAddHint()}`;
  }
  // 3. Schuljahr
  if (!LIB.grade) {
    const units = d.units.filter((u) => u.lehrmittel_id === LIB.lm && cnt.byUnit.get(u.id));
    const grades = LIB_GRADES.filter((g) => units.some((u) => u.grade === g));
    return grades.length ? `<ul class="libr-list">${grades.map((g) => {
      const n = units.filter((u) => u.grade === g).reduce((a, u) => a + (cnt.byUnit.get(u.id) || 0), 0);
      return libRow(`data-action="lib-nav" data-reset='${JSON.stringify({ grade: g })}'`, gradeName(g), '', n);
    }).join('')}</ul>${libAddHint()}` : `<p class="empty">Noch keine Units bei diesem Lehrmittel.</p>${libAddHint()}`;
  }
  // 4. Unit
  if (!LIB.unit) {
    const units = d.units.filter((u) => u.lehrmittel_id === LIB.lm && u.grade === LIB.grade && cnt.byUnit.get(u.id));
    return `<ul class="libr-list">${units.map((u) => libRow(`data-action="lib-nav" data-reset='${JSON.stringify({ unit: u.id })}'`, esc(u.name), '', cnt.byUnit.get(u.id) || 0)).join('')}</ul>${libAddHint()}`;
  }
  // 5. Portionen
  return libItemsHTML(d.items.filter((it) => it.unit_id === LIB.unit), '');
}
function libAddHint() {
  return `<p class="hint small libr-add">${icon('plus')}<span>Dein Lehrmittel oder deine ${unitWord(LIB.lang || 'en')} fehlt? Öffne eine eigene Portion und tippe auf <strong>Bibliothek</strong> – dort kannst du es anlegen.</span></p>`;
}
function libItemsHTML(items, note) {
  if (!items.length) return `<p class="empty">Hier ist noch keine Portion.</p>${libAddHint()}`;
  return `${note ? `<p class="hint small">${note}</p>` : ''}<ul class="lib-list libr-items">${items.map((it) => `<li class="lib-item"><button class="lib-open" data-action="lib-open" data-sid="${esc(it.set_id)}">
    <span class="lib-text"><strong>${flag(it.lang)} ${esc(it.name)}</strong><small>${it.word_count || '?'} Vokabeln${LIB.q && it.unit_id ? ` · ${esc(libPath(it.unit_id))}` : ''}</small></span>${icon('right')}</button></li>`).join('')}</ul>`;
}

/* ---------------- Suche ---------------- */
function libSearchHTML() {
  if (LIB.hits == null) return '<p class="pub-empty"><span class="spinner"></span> Suche …</p>';
  const q = libKey(LIB.q);
  const d = LIB.data;
  const lms = d.lms.filter((l) => libKey(l.name).includes(q)).slice(0, 8);
  const units = d.units.filter((u) => libKey(u.name).includes(q) || libKey(libLm(u.lehrmittel_id)?.name).includes(q)).slice(0, 12);
  const items = LIB.hits;
  if (!lms.length && !units.length && !items.length) return `<p class="empty">Nichts gefunden für „${esc(LIB.q)}“.</p>`;
  return `${lms.length ? `<h2 class="libr-h">Lehrmittel</h2><ul class="libr-list">${lms.map((l) => libRow(`data-action="lib-nav" data-reset='${JSON.stringify({ q: '', lang: l.lang, lm: l.id, grade: 0, unit: '', loose: false })}'`, `${flag(l.lang)} ${esc(l.name)}`, LANGS[l.lang].name, null)).join('')}</ul>` : ''}
    ${units.length ? `<h2 class="libr-h">Units</h2><ul class="libr-list">${units.map((u) => { const l = libLm(u.lehrmittel_id); return libRow(`data-action="lib-nav" data-reset='${JSON.stringify({ q: '', lang: l?.lang || 'en', lm: u.lehrmittel_id, grade: u.grade, unit: u.id, loose: false })}'`, esc(u.name), esc(libPath(u.id)), null); }).join('')}</ul>` : ''}
    ${items.length ? `<h2 class="libr-h">Portionen</h2>${libItemsHTML(items, '')}` : ''}`;
}
function bindLibrarySearch() {
  const form = $('#libr-search'), input = $('#libr-q');
  if (!form) return;
  const run = async () => {
    const q = input.value.trim();
    LIB.q = q;
    const seq = ++LIB.seq;
    if (!q) { LIB.hits = null; renderLibrary(); $('#libr-q')?.focus(); return; }
    LIB.hits = null;
    const pos = input.selectionStart;
    renderLibrary();
    const inp = $('#libr-q'); inp?.focus(); try { inp?.setSelectionRange(pos, pos); } catch { /* */ }
    let hits = [];
    try {
      const res = await publicSearch(q); // Name und Vokabeln
      const byId = new Map(LIB.data.items.map((it) => [it.set_id, it]));
      hits = res.map((r) => byId.get(r.set_id) || { set_id: r.set_id, name: r.name, word_count: r.word_count, lang: r.lang === 'fr' ? 'fr' : 'en', unit_id: null });
    } catch { hits = LIB.data.items.filter((it) => libKey(it.name).includes(libKey(q))).slice(0, 30); }
    if (seq !== LIB.seq || ui.view !== 'library') return;
    LIB.hits = hits;
    const p2 = $('#libr-q')?.selectionStart;
    renderLibrary();
    const i2 = $('#libr-q'); i2?.focus(); try { i2?.setSelectionRange(p2, p2); } catch { /* */ }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  input.addEventListener('input', debounce(() => { const v = input.value.trim(); if (v.length >= 2 || !v) run(); }, 450));
}

/** Portion ansehen (Vokabeln erst jetzt laden) und übernehmen */
async function libOpenItem(setId) {
  try {
    const c = await cloudClient();
    let { data, error } = await c.from(PUBLIC_TABLE).select('set_id,name,words,word_count,pic_style,lang').eq('set_id', setId).limit(1);
    if (error && /lang/i.test(error.message || '')) ({ data, error } = await c.from(PUBLIC_TABLE).select('set_id,name,words,word_count,pic_style').eq('set_id', setId).limit(1));
    if (error) throw error;
    if (!data?.length) { toast('Diese Portion gibt es nicht mehr.', 'bad'); return; }
    pub.results = data;
    openPublicPreview(0);
  } catch (e) { toast(cloudErrorText(e), 'bad'); }
}

/* ---------------- Eigene Portion einordnen (Häkchen) ---------------- */
const ASG = { setId: '', lm: '', grade: 0, unit: '', msg: { lm: '', unit: '' }, busy: false, allGrades: false };
/** Schuljahre, für die das Lehrmittel Bände hat (neues Lehrmittel: alle) */
const lmGrades = (lmId) => LIB_GRADES.filter((g) => LIB.data?.units.some((u) => u.lehrmittel_id === lmId && u.grade === g));
async function openLibAssign(set) {
  if (!set) return;
  if (!cloud.uid) { openLogin(); return; }
  const cur = libUnit(set.libUnit);
  Object.assign(ASG, { setId: set.id, lm: '', grade: 0, unit: '', msg: { lm: '', unit: '' }, busy: false });
  openModal('<div class="asg"><p class="muted"><span class="spinner"></span> Bibliothek wird geladen …</p></div>', { cls: 'wide asg-modal', label: 'In der Bibliothek teilen' });
  const wrap = ui.modal.el;
  wrap.addEventListener('submit', (e) => { const f = e.target.closest('.asg-new'); if (f) { e.preventDefault(); libCreate(f.dataset.kind, f.querySelector('input').value); } });
  try { await libLoad(true); } catch { /* Meldung unten */ }
  const u = libUnit(set.libUnit) || cur;
  if (u) Object.assign(ASG, { lm: u.lehrmittel_id, grade: u.grade, unit: u.id });
  asgRender();
}
function asgRender() {
  const box = ui.modal?.el?.querySelector('.modal');
  const set = db.sets.find((s) => s.id === ASG.setId);
  if (!box || !set) return;
  const lang = langOf(set);
  if (!LIB.data || LIB.noSql) {
    box.innerHTML = `<header class="modal-head"><h2>In der Bibliothek teilen</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
      <p class="banner bad">${LIB.noSql ? 'Für die Bibliothek zuerst <code>supabase/vokabelwelt.sql</code> in Supabase nochmals ausführen.' : esc(LIB.err || 'Die Bibliothek konnte nicht geladen werden.')}</p>`;
    return;
  }
  const lms = LIB.data.lms.filter((l) => l.lang === lang);
  const units = LIB.data.units.filter((u) => u.lehrmittel_id === ASG.lm && u.grade === ASG.grade);
  const tick = (on) => `<span class="asg-tick ${on ? 'on' : ''}" aria-hidden="true">${on ? icon('check') : ''}</span>`;
  const step = (n, title, done, body, on = true) => `<section class="asg-step ${on ? '' : 'off'}" ${on ? '' : 'aria-disabled="true"'}>
    <h3><span class="asg-n ${done ? 'done' : ''}">${done ? icon('check') : n}</span>${title}</h3>${on ? body : ''}</section>`;
  const newForm = (kind, ph) => `<form class="asg-new" data-kind="${kind}"><input type="text" maxlength="60" placeholder="${ph}" aria-label="${ph}" autocomplete="off"><button class="btn small secondary" type="submit">${icon('plus')} Anlegen</button></form>
    ${ASG.msg[kind] ? `<p class="asg-msg" role="alert">${ASG.msg[kind]}</p>` : ''}`;
  box.innerHTML = `<header class="modal-head"><div><p class="eyebrow">${flag(lang)} ${LANGS[lang].name} · „${esc(set.name)}“</p><h2>In der Bibliothek teilen</h2></div>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></header>
    <div class="asg">
      ${step(1, 'Lehrmittel', !!ASG.lm, `${lms.length ? `<ul class="asg-list">${lms.map((l) => `<li><button type="button" class="asg-opt ${ASG.lm === l.id ? 'on' : ''}" data-action="asg-pick" data-k="lm" data-v="${l.id}" aria-pressed="${ASG.lm === l.id}">${tick(ASG.lm === l.id)}${esc(l.name)}</button></li>`).join('')}</ul>` : '<p class="small muted">Noch keine Lehrmittel – leg das erste an.</p>'}
        ${newForm('lm', 'Neues Lehrmittel, z. B. ' + (lang === 'fr' ? 'dis donc!' : 'New World'))}`)}
      ${step(2, 'Schuljahr', !!ASG.grade, `<div class="asg-grades">${asgGrades().map((g) => `<button type="button" class="asg-opt chip ${ASG.grade === g ? 'on' : ''}" data-action="asg-pick" data-k="grade" data-v="${g}" aria-pressed="${ASG.grade === g}">${tick(ASG.grade === g)}${gradeName(g)}</button>`).join('')}</div>
        ${!ASG.allGrades && asgGrades().length < LIB_GRADES.length ? '<button type="button" class="link-btn small" data-action="asg-all-grades">Anderes Schuljahr</button>' : ''}`, !!ASG.lm)}
      ${step(3, unitWord(lang), !!ASG.unit, `${units.length ? `<ul class="asg-list">${units.map((u) => `<li><button type="button" class="asg-opt ${ASG.unit === u.id ? 'on' : ''}" data-action="asg-pick" data-k="unit" data-v="${u.id}" aria-pressed="${ASG.unit === u.id}">${tick(ASG.unit === u.id)}${esc(u.name)}</button></li>`).join('')}</ul>` : `<p class="small muted">Noch keine ${unitWord(lang)} für dieses Schuljahr – leg sie an.</p>`}
        ${newForm('unit', `Neue ${unitWord(lang)}, z. B. ${unitWord(lang)} 3`)}`, !!ASG.lm && !!ASG.grade)}
      <p class="small muted">Geteilt werden nur Name, Vokabeln und Bildauswahl – keine eigenen Fotos, kein Übungsstand, nicht deine E-Mail-Adresse.</p>
    </div>
    <footer class="modal-foot">
      ${set.published ? '<button type="button" class="btn ghost danger-ghost" data-action="asg-remove">Aus der Bibliothek nehmen</button>' : ''}
      <button type="button" class="btn ghost" data-action="close-modal">Abbrechen</button>
      <button type="button" class="btn primary" data-action="asg-save" ${ASG.unit && !ASG.busy ? '' : 'disabled'}>${icon('book')} ${set.published ? 'Speichern' : 'Teilen'}</button>
    </footer>`;
}
function asgGrades() {
  const own = lmGrades(ASG.lm);
  return ASG.allGrades || !own.length ? LIB_GRADES : [...new Set([...own, ...(ASG.grade ? [ASG.grade] : [])])].sort((a, b) => a - b);
}
function asgPick(k, v) {
  if (k === 'lm') { if (ASG.lm !== v) Object.assign(ASG, { lm: v, unit: '', allGrades: false, grade: lmGrades(v).includes(ASG.grade) || !lmGrades(v).length ? ASG.grade : 0 }); }
  else if (k === 'grade') { if (ASG.grade !== +v) Object.assign(ASG, { grade: +v, unit: '' }); }
  else ASG.unit = v;
  ASG.msg = { lm: '', unit: '' };
  asgRender();
}
/** Neues Lehrmittel / neue Unit anlegen – gibt es das schon (auch anders geschrieben), wird das bestehende gewählt */
async function libCreate(kind, raw) {
  const set = db.sets.find((s) => s.id === ASG.setId);
  if (!set || ASG.busy) return;
  const lang = langOf(set);
  const name = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const key = libKey(name);
  ASG.msg = { lm: '', unit: '' };
  if (key.length < (kind === 'lm' ? 2 : 1)) { ASG.msg[kind] = 'Bitte einen Namen eingeben.'; asgRender(); return; }
  const find = () => (kind === 'lm'
    ? LIB.data.lms.find((l) => l.lang === lang && libKey(l.name) === key)
    : LIB.data.units.find((u) => u.lehrmittel_id === ASG.lm && u.grade === ASG.grade && libKey(u.name) === key));
  const exists = (x) => {
    ASG.msg[kind] = kind === 'lm' ? `Dieses Lehrmittel existiert bereits: „${esc(x.name)}“. Es ist jetzt ausgewählt.`
      : `Diese ${unitWord(lang)} existiert bereits: „${esc(x.name)}“. Sie ist jetzt ausgewählt.`;
    if (kind === 'lm') Object.assign(ASG, { lm: x.id, unit: '' }); else ASG.unit = x.id;
    asgRender();
  };
  let x = find();
  if (x) { exists(x); return; }
  ASG.busy = true;
  try {
    const c = await cloudClient();
    const row = kind === 'lm' ? { lang, name } : { lehrmittel_id: ASG.lm, grade: ASG.grade, name };
    const { data, error } = await c.from(kind === 'lm' ? 'vokaboom_lib_lehrmittel' : 'vokaboom_lib_units').insert(row).select(kind === 'lm' ? 'id,lang,name,key' : 'id,lehrmittel_id,grade,name,key').single();
    if (error) {
      if (error.code === '23505') { await libLoad(true); ASG.busy = false; x = find(); if (x) { exists(x); return; } }
      throw error;
    }
    if (kind === 'lm') { LIB.data.lms.push(data); LIB.data.lms.sort(libSort); Object.assign(ASG, { lm: data.id, unit: '' }); }
    else { LIB.data.units.push(data); LIB.data.units.sort(libSort); ASG.unit = data.id; }
    toast(kind === 'lm' ? `Lehrmittel „${data.name}“ angelegt.` : `${unitWord(lang)} „${data.name}“ angelegt.`);
  } catch (e) {
    ASG.msg[kind] = esc(/check|23514/.test(`${e?.code} ${e?.message}`) ? 'Dieser Name geht nicht – bitte etwas länger.' : cloudErrorText(e));
  } finally { ASG.busy = false; asgRender(); }
}
async function asgSave() {
  const set = db.sets.find((s) => s.id === ASG.setId);
  if (!set || !ASG.unit || ASG.busy) return;
  ASG.busy = true; asgRender();
  const was = { published: set.published, libUnit: set.libUnit };
  set.published = true; set.libUnit = ASG.unit;
  try {
    await cloudPublish(set);
    saveDB();
    const it = LIB.data.items.find((i) => i.set_id === set.id);
    if (it) Object.assign(it, { unit_id: set.libUnit, name: set.name }); else LIB.data.items.unshift({ set_id: set.id, name: set.name, word_count: set.words.length, lang: langOf(set), unit_id: set.libUnit });
    closeModal(true);
    toast(`„${set.name}“ ist in der Bibliothek: ${libPath(set.libUnit, false)}`);
    if (ui.view === 'set') render();
  } catch (e) {
    Object.assign(set, was);
    ASG.busy = false; ASG.msg.unit = esc(/unit_id/.test(e?.message || '') ? 'Für die Bibliothek zuerst supabase/vokabelwelt.sql in Supabase nochmals ausführen.' : cloudErrorText(e));
    asgRender();
  }
}
async function asgRemove() {
  const set = db.sets.find((s) => s.id === ASG.setId);
  if (!set) return;
  try {
    await cloudUnpublish(set.id);
    set.published = false; set.libUnit = '';
    saveDB();
    if (LIB.data) LIB.data.items = LIB.data.items.filter((i) => i.set_id !== set.id);
    closeModal(true);
    toast(`„${set.name}“ ist nicht mehr in der Bibliothek.`);
    if (ui.view === 'set') render();
  } catch (e) { toast(cloudErrorText(e), 'bad'); }
}

/** Kasten im Teilen-Fenster und auf der Portion: wo die Portion in der Bibliothek steht */
function libStatusHTML(set) {
  if (!cloudConfigured()) return '';
  if (!cloud.user) return `<div class="pub-box"><p class="small">${icon('book')} Mit Konto kannst du Portionen in der Bibliothek teilen. <button type="button" class="link-btn" data-action="login">Anmelden</button></p></div>`;
  const path = set.published && set.libUnit ? (libPath(set.libUnit) || '…') : '';
  return `<div class="pub-box lib-status" id="lib-status">
    ${set.published
    ? `<p>${icon('book')} <strong>In der Bibliothek</strong>${path ? `: ${esc(path)}` : ' – noch nicht eingeordnet. Ordne sie einem Lehrmittel zu, damit andere sie finden.'}</p>
       <div class="row"><button type="button" class="btn small secondary" data-action="lib-assign">${path ? 'Einordnung ändern' : 'Jetzt einordnen'}</button></div>`
    : `<p class="muted small">${icon('book')} Andere Lehrpersonen finden die Portion in der Bibliothek – geordnet nach Lehrmittel, Schuljahr und ${unitWord(langOf(set))}.</p>
       <div class="row"><button type="button" class="btn small secondary" data-action="lib-assign">${icon('book')} In der Bibliothek teilen</button></div>`}
  </div>`;
}
/** Pfad nachladen, wenn die Bibliothek noch nicht geladen war */
function libStatusRefresh(set) {
  if (!set?.published || !set.libUnit || libUnit(set.libUnit)) return;
  libLoad().then(() => { const el = $('#lib-status'); if (el) el.outerHTML = libStatusHTML(set); }).catch(() => {});
}

/** Zurück-Pfeil in der Bibliothek: eine Ebene nach oben */
const libCanGoUp = () => !!(LIB.q || LIB.lang);
function libUp() {
  if (LIB.q) Object.assign(LIB, { q: '', hits: null });
  else if (LIB.unit) LIB.unit = '';
  else if (LIB.grade) LIB.grade = 0;
  else if (LIB.lm || LIB.loose) Object.assign(LIB, { lm: '', loose: false });
  else LIB.lang = '';
  renderLibrary(); renderCrumbs(); window.scrollTo({ top: 0 });
}

const libraryActions = {
  library: () => openLibrary(ui.view !== 'library'),
  'lib-nav': (el) => { Object.assign(LIB, JSON.parse(el.dataset.reset || '{}')); if (!LIB.q) LIB.hits = null; renderLibrary(); renderCrumbs(); window.scrollTo({ top: 0 }); },
  'lib-open': (el) => libOpenItem(el.dataset.sid),
  'lib-assign': () => openLibAssign(currentSet()),
  'asg-pick': (el) => asgPick(el.dataset.k, el.dataset.v),
  'asg-save': () => asgSave(),
  'asg-all-grades': () => { ASG.allGrades = true; asgRender(); },
  'asg-remove': () => asgRemove(),
};
