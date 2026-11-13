/* Vokaboom – Aktionen und Start */
'use strict';

function startMode(mode, opts = {}) {
  const set = currentSet();
  if (!set) return;
  if (mode === 'cards') startCards(set, opts);
  if (mode === 'match') {
    if (opts.variant) startMatch(set, opts.variant);
    else match.choosing = true; // zuerst wählen: Bild ↔ Englisch oder Englisch ↔ Deutsch
    match.covered = !!db.settings.memCovered;
  }
  if (mode === 'speak') startSpeak(set, opts.ids);
  if (mode === 'dictation') startDictation(set, opts.ids);
  if (mode === 'test') startTest(set, opts.ids);
  go(mode);
}

const actions = {
  home: () => { ui.confirmDelete = null; go('home'); },
  'open-set': (el) => openSet(el.dataset.id),
  settings: () => openSettings(),
  'close-modal': () => closeModal(),

  /* Konto */
  login: (el) => openLogin(el.dataset.mode || 'login'),
  account: () => openAccount(),
  'cloud-sync': () => cloudSync(),
  'pw-forgot': () => forgotPassword(),
  'pub-open': (el) => openPublicPreview(+el.dataset.i),
  'search-open': () => openTopSearch(),
  'search-close': () => closeTopSearch(),
  'pub-take': (el) => takePublicSet(+el.dataset.i),
  logout: async () => {
    closeModal(true);
    const n = await cloudLogout();
    go('home');
    toast(n ? `Abgemeldet. ${n === 1 ? 'Deine Portion bleibt' : `Deine ${n} Portionen bleiben`} im Konto und ${n === 1 ? 'wurde' : 'wurden'} von diesem Gerät entfernt.` : 'Abgemeldet.');
  },

  /* Startseite */
  'draft-swap': () => { ui.draft.swap = !ui.draft.swap; renderPreview(); },
  'delete-set': (el) => { ui.confirmDelete = el.dataset.id; render(); },
  'delete-set-no': () => { ui.confirmDelete = null; render(); },
  'delete-set-yes': (el) => {
    db.sets = db.sets.filter((s) => s.id !== el.dataset.id);
    cloudDeleteSet(el.dataset.id);
    ui.confirmDelete = null; saveDB(); render(); toast('Gelöscht.');
  },

  /* Portionsübersicht */
  mode: (el) => startMode(el.dataset.mode, { variant: el.dataset.variant }),
  'edit-words': () => openEditDialog(currentSet()),
  'edit-add-row': () => {
    $('#edit-rows').insertAdjacentHTML('beforeend', ui.modal.newRow());
    $('#edit-rows .edit-row:last-child .e-foreign')?.focus();
  },
  'edit-remove-row': (el) => el.closest('.edit-row')?.remove(),
  share: () => openShare(currentSet()),
  copy: (el) => copyFrom(el.dataset.target),
  'copy-link': () => { if (ui.share?.url) copyText(ui.share.url); },
  'qr-full': () => openQRFull(),
  'qr-full-close': () => closeQRFull(),
  'qr-save': () => saveQRImage(),
  'pic-style': (el) => {
    const set = currentSet();
    const style = el.dataset.style;
    set.picStyle = style;
    if (style === 'clipart') net.clipartDown = false;
    if (style === 'picto') { net.arasaacDown = false; net.gsDown = false; }
    saveDB();
    $$('.deck-controls .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.style === style)));
    if (picJobs.has(set.id)) { toast('Einen Moment – die Bilder werden noch gesucht.'); return; }
    startPictureFill(set, true);
  },
  'pic-dialog': (el) => {
    const set = currentSet();
    const w = set.words.find((x) => x.id === el.dataset.wid);
    if (w) openPicDialog(set, w);
  },
  'pic-tab': (el) => {
    ui.picTab = el.dataset.tab;
    const set = currentSet();
    const w = set.words.find((x) => x.id === ui.modal?.wid);
    if (w) renderPicTab(set, w);
  },
  'pic-choose': (el) => {
    const set = currentSet();
    const w = set.words.find((x) => x.id === ui.modal?.wid);
    if (!w || el.classList.contains('failed')) return;
    let credit = null;
    try { credit = el.dataset.credit ? JSON.parse(el.dataset.credit) : null; } catch { /* */ }
    choosePic(set, w, { kind: el.dataset.kind, src: el.dataset.src, credit });
  },
  'pic-none': () => {
    const set = currentSet();
    const w = set.words.find((x) => x.id === ui.modal?.wid);
    if (!w) return;
    w.pic = { kind: 'none', src: '', manual: true };
    w.picStatus = 'done';
    saveDB(); refreshPicDialogHead(set, w); refreshDeck(set, w);
  },
  'pic-auto': async () => {
    const set = currentSet();
    const w = set.words.find((x) => x.id === ui.modal?.wid);
    if (!w) return;
    w.pic = null; w.picStatus = 'pending';
    refreshPicDialogHead(set, w); refreshDeck(set, w);
    w.pic = await autoPicture(w, set);
    w.picStatus = 'done';
    saveDB(); refreshPicDialogHead(set, w); refreshDeck(set, w);
  },
  'clip-kind': (el) => ui.modal?.clipKind?.(el.dataset.kind),
  'emoji-cat': (el) => ui.modal?.emojiCat?.(el.dataset.cat),
  'draw-one': async (el) => {
    const set = currentSet();
    const w = set.words.find((x) => x.id === ui.modal?.wid);
    if (!w || !claudeSample) return;
    const box = $('#draw-results');
    el.disabled = true;
    box.innerHTML = '<div class="cand loading"><span class="spinner"></span></div>';
    try {
      const src = await claudeDraw(w, set.lang);
      if (!$('#draw-results')) return;
      box.innerHTML = candHTML({ src, title: '' }, 'drawn');
      choosePic(set, w, { kind: 'drawn', src });
    } catch (e) {
      if ($('#draw-results')) box.innerHTML = `<p class="muted">${e?.code === 'rate_limited' ? 'Claude braucht eine kurze Pause. Versuch es gleich noch einmal.' : e?.code === 'not_granted' ? 'Zeichnen wurde nicht erlaubt.' : 'Das hat nicht geklappt. Versuch es noch einmal.'}</p>`;
    }
    el.disabled = false;
  },
  'draw-missing': () => drawMissing(currentSet()),
  'review-pics': () => { ui.reviewCands = {}; go('pics'); },
  'review-pick': (el) => {
    const set = currentSet();
    const w = set.words.find((x) => x.id === el.dataset.wid);
    const c = ui.reviewList?.[w?.id]?.[+el.dataset.i];
    if (!w || !c || el.classList.contains('failed')) return;
    w.pic = { kind: c.kind, src: c.src, credit: c.credit || null, title: c.title || '', manual: true };
    w.picStatus = 'done';
    brokenPics.delete(c.src);
    saveDB();
    renderReviewRow(set, w);
  },
  'review-none': (el) => {
    const set = currentSet();
    const w = set.words.find((x) => x.id === el.dataset.wid);
    if (!w) return;
    w.pic = { kind: 'none', src: '', manual: true };
    w.picStatus = 'done';
    saveDB();
    renderReviewRow(set, w);
  },

  /* Einstellungen */
  'set-accent': (el) => {
    db.settings.accent = el.dataset.accent; saveDB();
    $$('[data-action="set-accent"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === db.settings.accent)));
    const vf = $('#voice-field'); if (vf) vf.innerHTML = voiceFieldHTML();
    speak('Hello! The apple is red.', 'en');
    if (currentSet()) audioWarm(currentSet());
  },
  'set-voice-sex': (el) => {
    db.settings.voiceSex = el.dataset.sex; saveDB();
    const vf = $('#voice-field'); if (vf) vf.innerHTML = voiceFieldHTML();
    speak('Hello! The apple is red.', 'en');
    if (currentSet()) audioWarm(currentSet());
  },
  'voice-test': () => speak('Hello! The apple is red.', 'en'),
  wipe: async (el) => {
    if (!el.dataset.sure) { el.dataset.sure = '1'; el.innerHTML = `${icon('trash')} Wirklich alles auf diesem Gerät löschen? Nochmal tippen`; return; }
    const wasIn = !!cloud.user;
    if (wasIn) await cloudLogout();
    db.sets = []; saveNow(); closeModal(true); go('home');
    toast(wasIn ? 'Alles auf diesem Gerät gelöscht und abgemeldet. Dein Konto bleibt erhalten.' : 'Alles gelöscht.');
  },

  /* Allgemein */
  say: (el) => speak(el.dataset.text, el.dataset.lang),

  /* Lernkarten */
  flip: (el) => {
    if (cards.justSwiped) return; // nach dem Wischen nicht auch noch umdrehen
    if (el.closest('.flash-grid')) {
      el.classList.toggle('is-flipped'); sfx.flip();
      const set = currentSet(), w = set.words.find((x) => x.id === el.dataset.wid);
      if (w && db.settings.autoSpeak && englishShowing(set, w, el.classList.contains('is-flipped'))) speak(w.foreign, set.lang); else stopSpeaking();
      return;
    }
    flipCurrent();
  },
  'flip-current': () => flipCurrent(),
  'card-known': () => flyCard(true),
  'card-again': () => flyCard(false),
  'card-front': (el) => { cards.front = el.dataset.front; db.settings.cardFront = cards.front; saveDB(); cards.flipped = false; renderCards(); },
  'card-layout': (el) => { cards.layout = el.dataset.layout; cards.flipped = false; renderCards(); },
  'cards-again': (el) => {
    const hard = [...cards.firstTry].filter(([, ok]) => !ok).map(([id]) => id);
    resetCards(true, el.dataset.which === 'hard' && hard.length ? hard : currentSet().words.map((w) => w.id));
    renderCards();
  },

  /* Zuordnen */
  'match-variant': (el) => { startMatch(currentSet(), el.dataset.variant); renderMatch(); },
  'mem-tap': (el) => memTap(+el.dataset.i),
  'mem-mode': (el) => {
    match.covered = el.dataset.covered === '1';
    db.settings.memCovered = match.covered; saveDB();
    if (match.choosing) { $$('[data-action="mem-mode"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); return; }
    startMatch(currentSet(), match.variant); renderMatch();
  },

  /* Aussprechen */
  listen: () => doListen(),
  'speak-show': (el) => { speakM.show = el.dataset.show; stopListening(true); resetSpeakWord(); renderSpeak(); },
  'speak-hear': (el) => {
    const set = currentSet();
    const w = speakWord(set);
    if (!w) return;
    revealSpeakWord();
    speak(w.foreign, set.lang, { slow: !!el.dataset.slow });
  },
  'speak-reveal': () => {
    const set = currentSet();
    const w = speakWord(set);
    revealSpeakWord();
    speakM.results.set(w.id, 'retry');
    speak(w.foreign, set.lang);
    updateSpeakZone();
  },
  'speak-skip': () => { const set = currentSet(); const w = speakWord(set); if (w && !speakM.results.has(w.id)) speakM.results.set(w.id, 'skip'); nextSpeak(); },
  'speak-next': () => nextSpeak(),
  'ph-load': () => { loadPhoneticEngine().catch(() => {}); updatePhSettings(); },
  'speak-no-ph': () => {
    speakM.noPh = true;
    speakM.state = 'idle';
    updateSpeakZone();
    toast('Für diese Runde mit der normalen Spracherkennung.');
  },
  'speak-fallback': () => {
    stopListening(true);
    speakM.fallback = true;
    speakM.reason = speakM.error && speakM.error !== 'busy' ? speakM.error : 'chosen';
    speakM.state = 'idle';
    updateSpeakZone();
  },
  'mic-test': async (el) => {
    const out = $('#mic-test-out');
    if (!out) return;
    if (!canListen()) { out.textContent = speechBrowserMissing ? 'Dieser Browser (Brave oder Opera) hat keine Spracherkennung. Nimm Chrome, Edge oder Safari.' : micErrorText('not-supported', 'en'); return; }
    const lang = 'en';
    const bar = $('#mic-test-level');
    const setBar = (lv) => { if (bar) bar.style.setProperty('--lv', lv.toFixed(3)); };
    el.disabled = true;
    const same = meterDuringListen(); // Chrome/Edge: Pegel und Erkennung gleichzeitig
    // 1) Pegel: kommt Ton an?
    out.textContent = 'Mikrofon wird eingeschaltet …';
    let stream = await startMeter(setBar, db.settings.micId).catch(() => null);
    fillMicSelect();
    let peak = null;
    if (stream && !same) {
      out.textContent = `Sag jetzt etwas – der Balken sollte sich bewegen.`;
      await sleep(3000);
      peak = micMeter.peak;
      stopMeter(); setBar(0);
    }
    // 2) Spracherkennung
    out.textContent = 'Ich höre zu – sag etwas auf Englisch!';
    try {
      const alts = await listenOnce(lang, {
        track: same && stream && db.settings.micId ? stream.getAudioTracks()[0] : null,
        onStart: () => { out.textContent = 'Ich höre zu – sag etwas auf Englisch!'; },
        onInterim: (t) => { out.textContent = `Ich höre: „${t}“`; },
      });
      if (same && stream) peak = micMeter.peak;
      out.textContent = alts.length ? `Es klappt! Erkannt: „${alts.best?.t || alts[0]}“` : `Ich habe nichts erkannt. ${silenceHelp(peak) || 'Sprich lauter oder näher am Mikrofon.'}`;
    } catch (err) {
      if (same && stream) peak = micMeter.peak;
      out.textContent = err === 'no-speech'
        ? `Ich habe nichts erkannt. ${silenceHelp(peak) || 'Sprich lauter oder näher am Mikrofon.'}`
        : `${micErrorText(err, lang)} (Fehlercode: ${err})`;
    }
    stopMeter(); setBar(0);
    el.disabled = false;
  },

  'speak-self': (el) => {
    const set = currentSet();
    const w = speakWord(set);
    if (!w) return;
    if (el.dataset.ok === '1') {
      if (!speakM.results.has(w.id)) speakM.results.set(w.id, 'ok');
      sfx.good(); nextSpeak();
    } else {
      speakM.results.set(w.id, 'retry');
      speak(w.foreign, set.lang, { slow: true });
    }
  },
  'speak-again': (el) => {
    const set = currentSet();
    const hard = speakM.ids.filter((id) => speakM.results.get(id) !== 'ok');
    startSpeak(set, el.dataset.which === 'hard' && hard.length ? hard : null);
    renderSpeak();
  },

  /* Hören & Schreiben */
  'dict-play': (el) => {
    const set = currentSet();
    const w = dictWord(set);
    if (w) speak(w.foreign, set.lang, { slow: !!el.dataset.slow });
    $('#d-answer')?.focus();
  },
  'dict-hint': () => {
    const set = currentSet();
    const w = dictWord(set);
    dict.showDe = true;
    const h = $('#dict-hint');
    if (h && w) h.innerHTML = `<p class="cw-german" lang="de">${esc(w.german)}</p>`;
    $('#d-answer')?.focus();
  },
  'dict-unknown': () => checkDict(true),
  'dict-again': (el) => {
    const set = currentSet();
    const hard = [...dict.firstTry].filter(([, ok]) => !ok).map(([id]) => id);
    startDictation(set, el.dataset.which === 'hard' && hard.length ? hard : null);
    renderDictation();
  },

  /* Test */
  'test-start': () => {
    const set = currentSet();
    if (![...test.types].some((t) => typeAvailable(set, t))) { toast('Wähle mindestens eine Aufgabenart aus.', 'bad'); return; }
    test.questions = buildTest(set);
    if (!test.questions.length) { toast('Für diesen Test fehlen noch Vokabeln.', 'bad'); return; }
    test.idx = 0; test.points = 0; test.phase = 'q';
    renderTest();
  },
  'test-play': (el) => {
    const set = currentSet();
    const q = test.questions[test.idx];
    const w = set.words.find((x) => x.id === q.wid);
    speak(w.foreign, set.lang, { slow: !!el.dataset.slow });
    $('#t-answer')?.focus();
  },
  'test-choice': (el) => chooseOption(+el.dataset.i),
  'test-next': () => nextQuestion(),
  'test-restart': () => { startTest(currentSet()); renderTest(); },
  'test-retry-wrong': () => {
    const ids = [...new Set(test.questions.filter((q) => q.result !== 'correct').map((q) => q.wid))];
    startTest(currentSet(), ids);
    test.questions = buildTest(currentSet());
    test.idx = 0; test.points = 0; test.phase = 'q';
    renderTest();
  },
  'test-practice': (el) => {
    const ids = [...new Set(test.questions.filter((q) => q.result !== 'correct').map((q) => q.wid))];
    startMode(el.dataset.mode, { ids });
  },
  'cards-from-test': () => {
    const ids = [...new Set(test.questions.filter((q) => q.result !== 'correct').map((q) => q.wid))];
    startMode('cards', { ids });
  },
};

Object.assign(actions, classActions); // Klassen und Kinder-Login (js/classes.js)

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName === 'A') return;
  if (el.type === 'submit' && el.closest('form')) return; // Formular kümmert sich selbst
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.qrFull) { closeQRFull(); return; }
  if (e.key === 'Escape' && !ui.modal && (pubPopOpen() || $('.topbar.searching'))) { closeTopSearch(); return; }
  if (e.key === 'Escape' && ui.modal) { closeModal(); return; }
  if (ui.modal) return;
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (ui.view === 'cards' && cards.layout === 'stack' && !cards.finished && !typing) {
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest('button:not(.flash)') && e.key === 'Enter') return;
      e.preventDefault(); flipCurrent();
    } else if (e.key === 'ArrowRight') { e.preventDefault(); flyCard(true); } else if (e.key === 'ArrowLeft') { e.preventDefault(); flyCard(false); }
  } else if (ui.view === 'cards' && cards.layout === 'grid' && (e.key === ' ' || e.key === 'Enter') && e.target.classList?.contains('flash')) {
    e.preventDefault(); actions.flip(e.target);
  } else if (ui.view === 'test' && test.phase === 'q' && !typing) {
    const q = test.questions[test.idx];
    if (q?.type === 'choice' && !test.checked && /^[1-4]$/.test(e.key) && +e.key <= q.options.length) { e.preventDefault(); chooseOption(+e.key - 1); }
    else if (test.checked && e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); nextQuestion(); }
  } else if (ui.view === 'speak' && !typing && e.key === ' ' && !e.target.closest('button')) {
    e.preventDefault(); doListen();
  }
});

/* ---------------- Start ---------------- */
async function importFromHash() {
  if (await kidLoginFromHash()) return true;
  const m = location.hash.match(/^#v=([A-Za-z0-9_-]+)$/);
  if (!m) return false;
  if (isKid()) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
    toast('Du bist mit deinem Kärtchen angemeldet. Hier siehst du die Portionen deiner Lehrperson.');
    return false;
  }
  const code = m[1];
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* */ }
  try {
    const share = await hashString(code);
    const existing = db.sets.find((s) => s.shareId === share);
    if (existing) { openSet(existing.id); toast(`„${existing.name}“ ist schon da.`); return true; }
    const data = await decodeShare(code);
    if (!data.rows.length) throw new Error('leer');
    const set = newSet({ name: data.name, lang: 'en', rows: data.rows, picStyle: data.picStyle });
    set.shareId = share;
    if (data.audioOwner) set.audio = { o: data.audioOwner, h: {} };
    saveDB();
    openSet(set.id);
    toast(`Neue Vokabelportion „${set.name}“ geladen.`);
    return true;
  } catch {
    toast('Dieser Link ist leider kaputt oder unvollständig.', 'bad');
    return false;
  }
}

/* ---------------- Neue Version? ----------------
   GitHub Pages lässt Dateien eine Weile im Browser-Zwischenspeicher. Deshalb fragen wir beim Start
   und beim Zurückkehren in den Tab nach, ob index.html eine neuere Versionsnummer hat – und laden dann neu. */
const APP_VERSION = (document.querySelector('script[src*="js/main.js"]')?.getAttribute('src').match(/[?&]v=(\d+)/) || [])[1] || '';
let lastUpdateCheck = 0;
async function checkForUpdate() {
  if (!APP_VERSION || location.protocol === 'file:' || Date.now() - lastUpdateCheck < 60000) return;
  lastUpdateCheck = Date.now();
  try {
    const r = await fetch(`${location.pathname}?update=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const live = ((await r.text()).match(/js\/main\.js\?v=(\d+)/) || [])[1];
    if (!live || live <= APP_VERSION) return;
    const key = 'vokaboom.reloadedFor';
    let tried = '';
    try { tried = sessionStorage.getItem(key) || ''; sessionStorage.setItem(key, live); } catch { /* */ }
    const busy = ['test', 'dictation', 'speak'].includes(ui.view) || !!ui.modal;
    if (tried === live || busy) { toast('Es gibt eine neue Version von Vokaboom. Lade die Seite neu, um sie zu bekommen.'); return; }
    location.reload();
  } catch { /* offline */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });

async function boot() {
  kidLoadSession(); // Kind angemeldet? Dann dessen Speicher (js/classes.js)
  loadDB();
  renderShell();
  bindTopSearch();
  initClaude();
  window.addEventListener('load', initClaude);
  setTimeout(initClaude, 1500);
  if (!(await importFromHash())) render();
  window.addEventListener('hashchange', importFromHash);
  if (isKid()) kidRefresh().catch(() => { kid.status = 'error'; renderAccountSlot(); });
  else cloudInit();
  setTimeout(checkForUpdate, 1500);
}
boot();
