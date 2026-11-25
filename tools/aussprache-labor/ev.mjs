// Auswertung der Testsammlung mit dem echten Code aus js/phonetic.js (ohne Browser)
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
const CH = path.resolve('../phtest/charsiu/package/dist/');
const core = await import(CH + '/index.js'); const an = await import(CH + '/assets-node.js');
const vocab = an.loadPhoneVocab(); const phonemizer = new core.PhonemizerEn(new core.G2p(an.loadG2pAssets()), vocab);
const engine = { core, phonemizer, vocab };
const SRC = process.env.PHSRC || '/home/user/Vokabelwelt/js/phonetic.js';
globalThis.db = { settings: {} }; globalThis.window = globalThis; globalThis.passMinNow = () => Number(process.env.PASS || 60);
vm.runInThisContext(fs.readFileSync(SRC, 'utf8').replace("'use strict';", ''), { filename: 'phonetic.js' });
const api = vm.runInThisContext('({ phAssessPost, phDecide, phTemplate })');
const dir = process.argv[2] || 'posts'; const V = 42;
const load = (f) => { const b = fs.readFileSync(f); const probs = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); return { probs, frames: probs.length / V, V }; };
const md5 = (await import('node:crypto')).createHash;
const refCache = new Map();
const US = new Set(['lessac', 'libri', 'ryan']);
let metas0 = null;
const refFile = (word, us) => {
  if (!us) return `${dir}/ref-${md5('md5').update(word).digest('hex').slice(0, 10)}.f32`;
  const m = metas0.find((x) => x.word === word && x.voice === 'lessac' && x.cat === 'correct');
  return m ? `${dir}/${m.id}.f32` : '';
};
const refOf = (word, us = false) => { const k = word + '|' + us; if (!refCache.has(k)) { const f = refFile(word, us); let r = null; if (f && fs.existsSync(f)) { const po = load(f); r = api.phAssessPost(engine, po, [word]); if (!r || r.silent) r = null; else { r.heardSeq = api.phTemplate(engine, po); r.file = f; } } refCache.set(k, r); } return refCache.get(k); };
const metas = fs.readdirSync('.').filter((f) => f.startsWith(`meta-${dir}-`)).flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
metas0 = metas;
const only = process.env.WORDS ? new Set(process.env.WORDS.split(',')) : null;
const out = [], seenId = new Set();
for (const m of metas) {
  if (seenId.has(m.id)) continue; seenId.add(m.id);
  if (only && !only.has(m.word)) continue;
  const f = `${dir}/${m.id}.f32`; if (!fs.existsSync(f)) continue;
  let r, rf = null;
  try { rf = process.env.NOREF ? null : refOf(m.word, US.has(m.voice)); if (rf && rf.file === f) continue; r = api.phAssessPost(engine, load(f), [m.word], process.env.NOTPL ? null : rf?.heardSeq); if (r && !r.silent) api.phDecide(r, rf); } catch (e) { r = { err: String(e) }; }
  out.push({ ...m, ok: !!r?.ok, silent: !!r?.silent, score: r?.score, gop: r?.gop, rival: r?.rival ? `${r.rival.exp}>${r.rival.ph}+${r.rival.diff}` : '', extra: (r?.extra || []).join(','), ph: (r?.phones || []).map((x) => `${x.exp}/${x.heard}:${x.score}`).join(' '), dec: r?.dec, top: (r?.rivals || []).slice().sort((x, y) => y.diff - x.diff).slice(0, 2).map((x) => `${x.exp}>${x.phs || x.ph}:${x.diff.toFixed(1)}`).join(','), err: r?.err, llr: r?.llr, nf: r?.nf, seq: r?.seqKey, tpl: r?.tpl ? 1 : 0, tplseq: (rf?.heardSeq || []).join(' '), riv: (r?.rivals || []).map((x) => [x.exp, x.phs || x.ph, x.pos, x.fin ? 1 : 0, +x.diff.toFixed(2), +((rf?.rivals || []).find((y) => y.key === x.key)?.diff ?? 999).toFixed(2)]), phs: (r?.phones || []).map((x) => [x.exp, x.heard, x.score, x.t1 - x.t0 + 1]), rawscore: r?.rawScore ?? r?.score });
}
fs.writeFileSync(process.env.OUT || 'res.jsonl', out.map((x) => JSON.stringify(x)).join('\n'));
// Zusammenfassung
const by = {}; for (const r of out) { const k = r.cat; by[k] = by[k] || { n: 0, right: 0, exp: r.expect }; by[k].n++; if ((r.expect === 'ok') === r.ok) by[k].right++; }
const tot = (e) => { const x = out.filter((r) => r.expect === e); return `${x.filter((r) => (e === 'ok') === r.ok).length}/${x.length} = ${(100 * x.filter((r) => (e === 'ok') === r.ok).length / Math.max(1, x.length)).toFixed(1)} %`; };
console.log('RICHTIG gesprochen und akzeptiert:', tot('ok')); console.log('FALSCH gesprochen und abgelehnt:  ', tot('bad'));
for (const [k, v] of Object.entries(by).sort((a, b) => a[1].right / a[1].n - b[1].right / b[1].n)) console.log(`${k.padEnd(14)} ${v.exp.padEnd(3)} ${String(v.right).padStart(5)}/${String(v.n).padEnd(5)} ${(100 * v.right / v.n).toFixed(0)} %`);
