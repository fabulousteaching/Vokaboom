import json, numpy as np, hashlib
VOW=set('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split())
DE_OK=set('bed pen ten red big pig milk fish ship hot dog dogs box clock sing song long six lemon tennis pencil elephant hospital banana tomato family animal doctor garden farm man bag cat black hat bad sister winter window want warm wall week work word world woman women water white'.split())
def test_word(w): return int(hashlib.md5(w.encode()).hexdigest(), 16) % 5 == 0
NAMES=['n','mean','min','min2','lt20','lt50','first','last','minV','minC','llr','extra','rivV','rivC','rivDE','rivFin','tpl','durmin']
def feats(r, gate=3.0):
    ph=r['phs']; sc=[p[2] for p in ph]; n=len(sc); s=sorted(sc)
    v=[p[2] for p in ph if p[0] in VOW] or [100]; c=[p[2] for p in ph[1:-1] if p[0] not in VOW] or [100]
    g={'V':-60.,'C':-60.,'DE':-60.,'F':-60.}
    for exp,phs,pos,fin,d,rd in r['riv']:
        if rd!=999 and rd>=-gate: continue
        if rd==999: d-=4
        k='DE' if exp=='DE' else 'F' if fin else 'V' if exp in VOW else 'C'
        g[k]=max(g[k],min(120.,d))
    return [n, np.mean(sc), s[0], s[1] if n>1 else s[0], sum(x<20 for x in sc), sum(x<50 for x in sc), sc[0], sc[-1], min(v), min(c), max(-8,r['llr']), len(r['extra'].split(',')) if r['extra'] else 0, g['V'], g['C'], g['DE'], g['F'], r.get('tpl',0), min(p[3] for p in ph)]
def load(f='res.jsonl'):
    R=[json.loads(l) for l in open(f)]
    return [r for r in R if r['voice']!='ryan' and not r['silent'] and r.get('phs') and r.get('riv') is not None and not (r['cat']=='de_read' and r['word'] in DE_OK)]
