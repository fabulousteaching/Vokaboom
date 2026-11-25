import json,collections,sys
from feat import DE_OK,test_word
R=[json.loads(l) for l in open(sys.argv[1] if len(sys.argv)>1 else 'res.jsonl')]
R=[r for r in R if r['voice']!='ryan' and not (r['cat']=='de_read' and r['word'] in DE_OK)]
if len(sys.argv)>2: R=[r for r in R if test_word(r['word'])]
c=collections.defaultdict(lambda:[0,0])
for r in R:
    c[(r['expect'],r['cat'])][0]+= (r['expect']=='ok')==r['ok']; c[(r['expect'],r['cat'])][1]+=1
print('  '.join(f"{k[1]}:{100*v[0]/v[1]:.0f}%({v[1]})" for k,v in sorted(c.items(), key=lambda kv:(kv[0][0],-kv[1][0]/kv[1][1]))))
