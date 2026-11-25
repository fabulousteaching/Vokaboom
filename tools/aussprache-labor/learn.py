"""Lernt aus der Testsammlung: (1) Verwechslungen des Modells je Position (EN_CONF), (2) Grenzen je Gegenkandidat (PH_RIVAL_T).
Schreibt beides in js/phonetic.js. Aufruf: python3 learn.py conf | rival | eval"""
import json, collections, sys, subprocess, hashlib, re, os
JS = '/home/user/Vokabelwelt/js/phonetic.js'
def test_word(w): return int(hashlib.md5(w.encode()).hexdigest(), 16) % 5 == 0   # 20 % der Wörter nur zum Prüfen
def run(env=None, out='res.jsonl'):
    e = dict(os.environ); e.update(env or {}); e['OUT'] = out
    subprocess.run(['node', 'ev.mjs'], env=e, stdout=subprocess.DEVNULL, check=True)
    return [json.loads(l) for l in open(out)]
def block(name, text):
    s = open(JS).read()
    a, b = f'/*{name}_BEGIN*/', f'/*{name}_END*/'
    i, j = s.index(a), s.index(b)
    open(JS, 'w').write(s[:i + len(a)] + '\n' + text + '\n' + s[j:])
DE_OK = set('bed pen ten red big pig milk fish ship hot dog dogs box clock sing song long six lemon tennis pencil elephant hospital banana tomato family animal doctor garden farm man bag cat black hat bad sister winter window want warm wall week work word world woman women water white'.split())
good = lambda r: r['expect'] == 'ok' and r['cat'].startswith('correct') and r['voice'] != 'ryan'
RIVAL_PAIRS = set()  # echte Lernfehler: nie als „nah“ gutschreiben
for a, bs in {'TH': 'S F T', 'DH': 'D Z', 'W': 'V', 'SH': 'S', 'CH': 'SH', 'NG': 'N'}.items():
    for b in bs.split(): RIVAL_PAIRS.add((a, b))

def learn_conf():
    block('EN_CONF', "const EN_CONF = { ini: {}, mid: {}, fin: {} };")
    block('PH_RIVAL_T', "const PH_RIVAL_T = { '*': 1e9 };")
    R = [r for r in run({'NOTPL': '1'}) if not r['silent'] and r.get('phs') and good(r) and not test_word(r['word'])]
    C = collections.defaultdict(collections.Counter); N = collections.Counter()
    for r in R:
        n = len(r['phs'])
        for i, (e, h, s, d) in enumerate(r['phs']):
            pos = 'ini' if i == 0 else 'fin' if i == n - 1 else 'mid'
            N[(e, pos)] += 1
            if s < 40 and h != e: C[(e, pos)][h] += 1
    conf = {'ini': {}, 'mid': {}, 'fin': {}}
    PLOS = set('P T K B D G'.split())
    for (e, pos), n in N.items():
        if n < 20: continue
        hs = []
        for h, c in C[(e, pos)].most_common():
            if c < 3 or c / n < 0.025: continue
            if (e, h) in RIVAL_PAIRS: continue
            if h == '[SIL]' and not (pos == 'fin' and e in PLOS): continue
            hs.append(h)
        if hs: conf[pos][e] = hs
    txt = "const EN_CONF = {\n" + ",\n".join(f"  {pos}: {{ " + ", ".join(f"{e}: {json.dumps(h)}" for e, h in sorted(conf[pos].items())) + " }" for pos in ('ini', 'mid', 'fin')) + ",\n};"
    block('EN_CONF', txt.replace('"', "'"))
    print(txt)

GRID = [3, 4, 5, 6, 8, 10, 13, 16, 20, 25, 30, 40, 50, 65, 80]
def learn_rival(ref_gate=3.0, noref=4.0):
    block('PH_RIVAL_T', "const PH_RIVAL_T = { '*': 1e9 };")
    R = [r for r in run() if not r['silent'] and r.get('riv') is not None and r['voice'] != 'ryan' and not test_word(r['word']) and not (r['cat'] == 'de_read' and r['word'] in DE_OK)]
    OK = collections.defaultdict(list); BAD = collections.defaultdict(list)
    for r in R:
        for exp, ph, pos, fin, d, rd in r['riv']:
            k = f"{exp}>{ph}{'$' if fin else ''}"
            if rd != 999 and rd >= -ref_gate: continue          # Vorlage zeigt den Unterschied nicht: zählt nie
            dd = d - (noref if rd == 999 else 0)
            if good(r): OK[k].append(dd)
            elif r['expect'] == 'bad': BAD[k].append(dd)
    T = {}
    for k in sorted(set(OK) | set(BAD)):
        ok, bad = OK[k], BAD[k]
        if len(ok) < 25: T[k] = 1e9; continue   # zu wenig Belege
        allow = max(1, int(len(ok) * float(os.environ.get("ALLOW", "0.012")))) if len(ok) >= 60 else 0
        t = next((g for g in GRID if sum(x > g for x in ok) <= allow), None)
        if t is not None:  # eine Stufe Abstand
            t = GRID[min(len(GRID) - 1, GRID.index(t) + 1)]
        det = sum(x > t for x in bad) if t is not None else 0
        T[k] = t if t is not None and det >= 2 else 1e9
        print(f"{k:12} ok n={len(ok):4} max={max(ok):6.1f}  bad n={len(bad):4}  T={T[k]}  trifft {det}")
    # ausdrücklich gewünschte, typische Lernfehler bleiben streng (auch wenn das einzelne Fehlalarme kostet)
    for k, cap in {'SH>S': 8, 'W>V': 4, 'TH>S': 10, 'Z>S$': 12, 'V>F$': 12, 'AE>EH': 18, 'AH>AW': 8, 'AH>OW': 20}.items(): T[k] = min(T.get(k, 1e9), cap)
    T['*'] = 1e9
    txt = "const PH_RIVAL_T = { " + ", ".join(f"'{k}': {('1e9' if v >= 1e9 else v)}" for k, v in sorted(T.items())) + " };"
    block('PH_RIVAL_T', txt)

def evaluate(tag=''):
    R = [r for r in run(out='res.jsonl') if r['voice'] != 'ryan' and not (r['cat'] == 'de_read' and r['word'] in DE_OK)]
    for name, sel in (('LERN', lambda r: not test_word(r['word'])), ('TEST', lambda r: test_word(r['word']))):
        X = [r for r in R if sel(r)]
        ok = [r for r in X if r['expect'] == 'ok']; bad = [r for r in X if r['expect'] == 'bad']
        c = [r for r in ok if r['cat'].startswith('correct')]
        kid = [r for r in c if r['cat'] == 'correct_kid']
        f = lambda xs, v: f"{100 * sum(r['ok'] == v for r in xs) / max(1, len(xs)):.1f} % ({len(xs)})"
        de = [r for r in bad if r['cat'] == 'de_read']; sp = [r for r in bad if r['cat'] == 'spell']
        print(f"   deutsch gelesen→abgelehnt {f(de, False)} | Schrift-Aussprache→abgelehnt {f(sp, False)}")
        print(f"{tag}{name}: richtig→akzeptiert {f(c, True)} | Kinderstimme {f(kid, True)} | erlaubte Variante {f([r for r in ok if not r['cat'].startswith('correct')], True)} | falsch→abgelehnt {f(bad, False)}")
if __name__ == '__main__':
    for a in sys.argv[1:]:
        {'conf': learn_conf, 'rival': learn_rival, 'eval': evaluate}[a]()
