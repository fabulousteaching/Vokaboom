"""Testsammlung für die Lauterkennung: Wörter × Stimmen × (richtig | typische Fehler) → Wahrscheinlichkeiten des Modells.
Aufruf: python3 gen.py <shard> <nshards> [wortliste]   → posts/<id>.npy + meta-<shard>.jsonl"""
import sys, json, os, hashlib, re
import numpy as np
from scipy.signal import resample_poly
import onnxruntime as ort
from piper import PiperVoice
from piper.config import SynthesisConfig

P = '../phtest/'
SHARD, NSH = int(sys.argv[1]), int(sys.argv[2])
WORDFILE = sys.argv[3] if len(sys.argv) > 3 else 'words.txt'
OUT = sys.argv[4] if len(sys.argv) > 4 else 'posts'
os.makedirs(OUT, exist_ok=True)

VOICES = {  # name: (Datei, Sprecher, Akzent)
    'alba': (P + 'en_GB-alba-medium.onnx', [None], 'gb'),
    'lessac': (P + 'en_US-lessac-medium.onnx', [None], 'us'),
    'ryan': (P + 'en_US-ryan-medium.onnx', [None], 'us'),
    'vctk': (P + 'voices/en_GB-vctk-medium.onnx', [0, 3, 7, 12, 20, 33, 47, 60], 'gb'),
    'libri': (P + 'voices/en_US-libritts_r-medium.onnx', [1, 5, 14, 30, 77, 120, 333, 512], 'us'),
}
# Stimmen für die Fehler-Varianten (weniger, dafür viele Fehlerarten)
ERR_SPK = [('alba', None), ('lessac', None), ('vctk', 3), ('vctk', 20), ('libri', 14), ('libri', 120)]

# ---------- Fehlerregeln auf der Lautschrift (IPA von espeak) ----------
CONS = set('bdfɡhjklmnpɹstvwzðθʃʒŋɾ')
def sub_all(a, b):
    return lambda s, w: s.replace(a, b) if a in s else None
def sub_first_stressed(a, b):
    def f(s, w):
        i = s.find('ˈ' + a)
        if i < 0: return None
        return s[:i + 1] + b + s[i + 1 + len(a):]
    return f
def sh_s(s, w):
    t = re.sub(r'(?<!t)ʃ', 's', s)
    return t if t != s else None
def devoice_final(s, w):
    m = {'v': 'f', 'z': 's', 'd': 't', 'b': 'p', 'ɡ': 'k'}
    if s[-1] in m and not s.endswith('dʒ'): return s[:-1] + m[s[-1]]
    return None
def drop_final(s, w):
    if len(s) > 4 and s[-1] in CONS and s[-2] not in CONS: return s[:-1]
    return None
def initial(a, b):
    return lambda s, w: (b + s[len(a):]) if s.startswith(a) else None
def final(a, b):
    return lambda s, w: (s[:-len(a)] + b) if s.endswith(a) else None
def er_ur(s, w):
    return s.replace('ɜː', 'uːɹ') if 'ˈɜː' in s else None

REJECT = {
    'th_s': sub_all('θ', 's'), 'th_f': sub_all('θ', 'f'), 'th_t': sub_all('θ', 't'),
    'dh_d': sub_all('ð', 'd'), 'dh_z': sub_all('ð', 'z'),
    'w_v': sub_all('w', 'v'), 'sh_s': sh_s, 'ch_sh': sub_all('tʃ', 'ʃ'),
    'j_y': initial('dʒ', 'j'), 'j_ch_init': initial('dʒ', 'tʃ'),
    'er_or': sub_first_stressed('ɜː', 'ɔː'), 'er_ur': er_ur, 'er_e': sub_first_stressed('ɜː', 'ɛɹ'),
    'ae_e': sub_first_stressed('æ', 'ɛ'), 'ae_a': sub_first_stressed('æ', 'ɑː'),
    'uh_au': sub_first_stressed('ʌ', 'aʊ'), 'uh_u': sub_first_stressed('ʌ', 'ʊ'), 'uh_o': sub_first_stressed('ʌ', 'ɒ'),
    'ei_e': sub_first_stressed('eɪ', 'ɛ'), 'ei_ai': sub_first_stressed('eɪ', 'aɪ'), 'ei_a': sub_first_stressed('eɪ', 'æ'),
    'ai_ei': sub_first_stressed('aɪ', 'eɪ'), 'ai_i': sub_first_stressed('aɪ', 'ɪ'), 'ai_ii': sub_first_stressed('aɪ', 'iː'),
    'au_o': sub_first_stressed('aʊ', 'ɔː'), 'au_ou': sub_first_stressed('aʊ', 'əʊ'), 'au_u': sub_first_stressed('aʊ', 'uː'),
    'ou_au': lambda s, w: (sub_first_stressed('əʊ', 'aʊ')(s, w) or sub_first_stressed('oʊ', 'aʊ')(s, w)),
    'ou_o': lambda s, w: (sub_first_stressed('əʊ', 'ɒ')(s, w) or sub_first_stressed('oʊ', 'ɒ')(s, w)),
    'ii_ai': sub_first_stressed('iː', 'aɪ'), 'ii_e': sub_first_stressed('iː', 'ɛ'), 'i_ai': sub_first_stressed('ɪ', 'aɪ'), 'i_e': sub_first_stressed('ɪ', 'ɛ'),
    'uu_au': sub_first_stressed('uː', 'aʊ'), 'uu_o': sub_first_stressed('uː', 'ɒ'),
    'e_i': sub_first_stressed('ɛ', 'ɪ'), 'e_ii': sub_first_stressed('ɛ', 'iː'), 'e_ei': sub_first_stressed('ɛ', 'eɪ'),
    'o_ou': sub_first_stressed('ɒ', 'əʊ'), 'oo_ou': sub_first_stressed('ɔː', 'əʊ'), 'oo_au': sub_first_stressed('ɔː', 'aʊ'),
    'aa_ae': sub_first_stressed('ɑː', 'æ'), 'aa_ei': sub_first_stressed('ɑː', 'eɪ'),
    'devoice': devoice_final, 'drop_final': drop_final,
    'z_ts': initial('z', 'ts'), 's_z': initial('s', 'z'), 'v_f_init': initial('v', 'f'),
    'ng_nk': final('ŋ', 'ŋk'), 'r_l': initial('ɹ', 'l'), 'l_r': initial('l', 'ɹ'),
}
ACCEPT = {
    'v_w_init': initial('v', 'w'), 'j_ch_final': final('dʒ', 'tʃ'),
}
# Schrift-Aussprachen (stumme Buchstaben usw.): Wort → falsche Lautschrift
SPELL = {
    'knife': 'knˈaɪf', 'know': 'knˈəʊ', 'knee': 'knˈiː', 'listen': 'lˈɪstən', 'island': 'ˈɪslænd', 'answer': 'ˈænswɜː', 'comb': 'kˈɒmb', 'climb': 'klˈɪmb',
    'castle': 'kˈæstəl', 'half': 'hˈælf', 'walk': 'wˈɔːlk', 'talk': 'tˈɔːlk', 'write': 'vɹˈaɪt', 'hour': 'hˈaʊə', 'two': 'tvˈuː', 'friend': 'fɹˈiːnd',
    'said': 'sˈeɪd', 'people': 'pˈiːɒpəl', 'busy': 'bˈʊsi', 'fruit': 'fɹˈuːɪt', 'biscuit': 'bˈɪskuːɪt', 'juice': 'dʒˈuːɪs', 'Wednesday': 'wˈɛdnɛsdeɪ',
    'vegetable': 'vˈɛɡɛtɑːbəl', 'comfortable': 'kɒmfɔːtˈeɪbəl', 'chocolate': 'tʃˈɒkɒlˈeɪt', 'lamb': 'lˈæmp', 'thumb': 'θˈʌmb', 'autumn': 'ˈɔːtʌmn',
    'eight': 'ˈaɪt', 'great': 'ɡɹˈiːt', 'bread': 'bɹˈiːd', 'break': 'bɹˈiːk', 'head': 'hˈiːd', 'heart': 'hˈɜːt', 'early': 'ˈiəli', 'bear': 'bˈiə', 'pear': 'pˈiə',
    'blood': 'blˈuːd', 'flood': 'flˈuːd', 'does': 'dˈuːz', 'shoe': 'ʃˈəʊ', 'move': 'mˈəʊv', 'love': 'lˈəʊv', 'come': 'kˈəʊm', 'one': 'ˈɒn', 'once': 'ˈɒns',
    'woman': 'wˈəʊmən', 'women': 'wˈəʊmɛn', 'minute': 'mˈɪnjuːt', 'mountain': 'mˈaʊnteɪn', 'language': 'lˈænɡuːeɪdʒ', 'tongue': 'tˈɒŋɡuː', 'iron': 'ˈaɪɹɒn',
    'beautiful': 'bˈeɪaʊtɪfʊl', 'because': 'bɪkˈaʊs', 'laugh': 'lˈaʊɡ', 'daughter': 'dˈaʊɡtɐ', 'enough': 'ɪnˈaʊɡ', 'through': 'θɹˈaʊɡ', 'though': 'θˈaʊɡ',
    'bought': 'bˈaʊɡt', 'night': 'nˈɪɡt', 'light': 'lˈɪɡt', 'right': 'ɹˈɪɡt', 'high': 'hˈɪɡ', 'sugar': 'sˈʌɡɐ', 'sure': 'sˈʊɹ', 'ocean': 'ˈəʊkɪən',
    'school': 'ʃˈuːl', 'stomach': 'stˈɒmætʃ', 'ache': 'ˈeɪtʃ', 'chemist': 'tʃˈɛmɪst', 'Christmas': 'kɹˈɪstmæs', 'February': 'fˈɛbɹuːɑːɹi', 'January': 'jˈɑːnuːɑːɹi',
    'July': 'jˈuːli', 'June': 'jˈuːn', 'yellow': 'dʒˈɛləʊ', 'year': 'dʒˈiə', 'young': 'dʒˈʌŋ', 'bicycle': 'bˈaɪsaɪkəl', 'clothes': 'klˈəʊðɪz', 'cupboard': 'kˈʌpbɔːd',
    'breakfast': 'bɹˈeɪkfɑːst', 'Tuesday': 'tˈuːɛsdeɪ', 'Thursday': 'tˈʊɹsdeɪ', 'Saturday': 'sˈɛtɐdeɪ', 'Monday': 'mˈɒndeɪ', 'birthday': 'bˈɪɹtdeɪ',
}

def stable(*a):
    return int(hashlib.md5('|'.join(map(str, a)).encode()).hexdigest()[:8], 16)

sess = ort.InferenceSession(P + 'model.onnx', providers=['CPUExecutionProvider'])
def posteriors(w16):
    x = w16.astype(np.float32)
    x = (x - x.mean()) / np.sqrt(x.var() + 1e-7)
    lg = sess.run(None, {'input_values': x[None, :]})[0][0]
    e = np.exp(lg - lg.max(axis=1, keepdims=True))
    return (e / e.sum(axis=1, keepdims=True)).astype(np.float32)

def to16k(a, sr, kid=1.0, seed=0):
    a = a.astype(np.float32)
    if a.dtype != np.float32 or np.abs(a).max() > 2: a = a / 32768.0
    src = int(round(sr * kid))  # „Kind“: so tun, als wäre die Aufnahme schneller abgetastet → höhere Stimme
    g = np.gcd(16000, src)
    y = resample_poly(a, 16000 // g, src // g).astype(np.float32)
    rng = np.random.default_rng(seed)
    mode = seed % 3  # 0 = sauber, 1 = etwas Stille + leises Rauschen, 2 = mehr Stille + Rauschen
    if mode:
        pad0, pad1 = int(16000 * rng.uniform(0.1, 0.45)), int(16000 * rng.uniform(0.1, 0.5))
        y = np.concatenate([np.zeros(pad0, np.float32), y, np.zeros(pad1, np.float32)])
        lvl = np.abs(y).max() * (10 ** (rng.uniform(-46, -34 if mode == 2 else -40) / 20))
        y = y + rng.normal(0, lvl, len(y)).astype(np.float32)
    return y

voices = {}
def voice(name):
    if name not in voices: voices[name] = PiperVoice.load(VOICES[name][0])
    return voices[name]
def tokens(v, phon):
    # manche Stimmen haben Doppelzeichen als ein Laut („aɪ“): längster Treffer zuerst
    multi = sorted([k for k in v.config.phoneme_id_map if len(k) > 1], key=len, reverse=True)
    out, i = [], 0
    while i < len(phon):
        for k in multi:
            if phon.startswith(k, i): out.append(k); i += len(k); break
        else: out.append(phon[i]); i += 1
    return out
def synth(name, spk, phon, length=1.0):
    v = voice(name)
    ids = v.phonemes_to_ids(tokens(v, phon))
    cfg = SynthesisConfig(speaker_id=spk, length_scale=length, noise_scale=0.333, noise_w_scale=0.333)
    a = v.phoneme_ids_to_audio(ids, cfg)
    return np.asarray(a).reshape(-1), v.config.sample_rate

words = [w.strip() for w in open(WORDFILE) if w.strip() and not w.startswith('#')]
START = int(os.environ.get('START', '-1'))
meta = open(f'meta-{OUT}-{SHARD}' + ('b' if START >= 0 else '') + '.jsonl', 'a')
n = 0
for wi, word in enumerate(words):
    if wi % NSH != SHARD: continue
    if wi <= START: continue
    jobs = []  # (voice, spk, phon, expect, cat, kid, length)
    ipa = {}
    for name in VOICES:
        ipa[name] = ''.join(sum(voice(name).phonemize(word), []))
    # richtig: alle Stimmen; dazu „Kind“-Varianten und Tempo
    for name, (_, spks, acc) in VOICES.items():
        for spk in spks:
            s = stable(word, name, spk)
            jobs.append((name, spk, ipa[name], 'ok', 'correct', 1.0, 1.0))
            if s % 2 == 0: jobs.append((name, spk, ipa[name], 'ok', 'correct_kid', 1.16 + (s % 7) * 0.02, 1.25))
            if s % 5 == 1: jobs.append((name, spk, ipa[name], 'ok', 'correct_slow', 1.0, 1.45))
            if s % 5 == 2: jobs.append((name, spk, ipa[name], 'ok', 'correct_fast', 1.0, 0.8))
    for name, spk in ERR_SPK:
        base = ipa[name]
        for cat, fn in list(REJECT.items()) + list(ACCEPT.items()):
            t = fn(base, word)
            if t and t != base:
                exp = 'ok' if cat in ACCEPT else 'bad'
                jobs.append((name, spk, t, exp, cat, 1.0, 1.0))
                if stable(word, name, spk, cat) % 3 == 0: jobs.append((name, spk, t, exp, cat, 1.2, 1.25))
        if word in SPELL:
            jobs.append((name, spk, SPELL[word], 'bad', 'spell', 1.0, 1.0))
            jobs.append((name, spk, SPELL[word], 'bad', 'spell', 1.2, 1.25))
    for (name, spk, phon, exp, cat, kid, length) in jobs:
        cid = hashlib.md5(f'{word}|{name}|{spk}|{phon}|{kid}|{length}'.encode()).hexdigest()[:14]
        try:
            a, sr = synth(name, spk, phon, length)
            y = to16k(a, sr, kid, stable(cid))
            post = posteriors(y)
            if os.environ.get('WAV'):
                import wave as _w
                os.makedirs(os.environ['WAV'], exist_ok=True)
                with _w.open(f"{os.environ['WAV']}/{cid}.wav", 'wb') as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(16000); f.writeframes((np.clip(y / max(1e-6, np.abs(y).max()) * 0.9, -1, 1) * 32767).astype(np.int16).tobytes())
            post.astype(np.float32).tofile(f'{OUT}/{cid}.f32')
            meta.write(json.dumps({'id': cid, 'word': word, 'voice': name, 'spk': spk, 'ipa': phon, 'expect': exp, 'cat': cat, 'kid': kid, 'len': length, 'frames': int(post.shape[0])}, ensure_ascii=False) + '\n')
            n += 1
        except Exception as e:
            print('ERR', word, name, spk, phon, e, flush=True)
    # Vorlage (wie die Google-Stimme: sauber, britisch)
    a, sr = synth('alba', None, ipa['alba'], 1.0)
    posteriors(to16k(a, sr, 1.0, 0)).astype(np.float32).tofile(f'{OUT}/ref-{hashlib.md5(word.encode()).hexdigest()[:10]}.f32')
    meta.flush()
    print(SHARD, wi, word, n, flush=True)
print('fertig', SHARD, n)
