"""Mehrere Tonhöhen: Aufnahme langsamer/schneller abspielen (tiefere/höhere Stimme), Wahrscheinlichkeiten mitteln."""
import sys, os, json, wave, numpy as np, shutil
from scipy.signal import resample_poly
import onnxruntime as ort
so = ort.SessionOptions(); so.intra_op_num_threads = 1
sess = ort.InferenceSession('../phtest/model.onnx', so, providers=['CPUExecutionProvider'])
def post(x):
    x = (x - x.mean()) / np.sqrt(x.var() + 1e-7)
    lg = sess.run(None, {'input_values': x[None, :].astype(np.float32)})[0][0]
    e = np.exp(lg - lg.max(1, keepdims=True)); return e / e.sum(1, keepdims=True)
def warp(y, f):   # f < 1: tiefer und langsamer
    return resample_poly(y, 100, int(round(100 * f))).astype(np.float32)
def back(p, n):   # Zeitachse zurück auf n Frames
    src = np.linspace(0, len(p) - 1, n); i = np.floor(src).astype(int); j = np.minimum(i + 1, len(p) - 1); w = (src - i)[:, None]
    return p[i] * (1 - w) + p[j] * w
shard, nsh = int(sys.argv[1]), int(sys.argv[2])
FS = [float(x) for x in sys.argv[3].split(',')]   # z. B. 0.88,1.12
files = sorted(f for f in os.listdir('wav2') if f.endswith('.wav'))
for d in ['posts2_' + str(f) for f in FS] + ['posts2_avg']: os.makedirs(d, exist_ok=True)
for k, fn in enumerate(files):
    if k % nsh != shard: continue
    cid = fn[:-4]
    if os.path.exists(f'posts2_avg/{cid}.f32') or not os.path.exists(f'posts2/{cid}.f32'): continue
    w = wave.open('wav2/' + fn); y = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768; w.close()
    p0 = np.fromfile(f'posts2/{cid}.f32', dtype=np.float32).reshape(-1, 42); acc = [p0]
    for f in FS:
        pf = back(post(warp(y, f)), len(p0)).astype(np.float32); pf.tofile(f'posts2_{f}/{cid}.f32'); acc.append(pf)
    (np.mean(acc, 0)).astype(np.float32).tofile(f'posts2_avg/{cid}.f32')
print('fertig', shard)
