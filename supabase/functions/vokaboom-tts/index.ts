// Vokaboom – Cloud-Stimme (Google Cloud Text-to-Speech) als Supabase Edge Function „vokaboom-tts“
//
// Eine angemeldete Lehrperson schickt { text, voice }. Gibt es die Aufnahme schon, kommt sofort der Pfad zurück.
// Sonst erzeugt Google sie einmal, sie wird im öffentlichen Speicher „vokaboom-tts“ abgelegt und gilt ab dann für
// alle (jedes Wort pro Stimme nur ein einziges Mal). Kinder spielen die Dateien nur ab, sie rufen diese Funktion nie auf.
//
// Einrichten (siehe supabase/ANLEITUNG.md, Abschnitt „Cloud-Stimme“):
//   Secret GOOGLE_TTS_KEY = API-Schlüssel aus Google Cloud (nur „Cloud Text-to-Speech API“ erlaubt)
// An Google geht nur der Text der Vokabel – keine Namen, keine Daten der Kinder.

import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'vokaboom-tts';
const CLOUD_V = 'c1';                 // gleich wie in js/core.js (CLOUD_TTS_V)
const PER_TEACHER_DAY = 600;          // höchstens so viele neue Wörter pro Lehrperson und Tag
const ALL_DAY = 2000;                 // und insgesamt pro Tag (~60'000 Wörter im Monat: sicher im Gratis-Kontingent)
const MAX_LEN = 120;                  // längere Texte werden abgeschnitten

// Stimmen: Vokaboom-Kennung → Google-Stimme (Neural2: natürliche Frauenstimmen, im Gratis-Kontingent)
const VOICES: Record<string, { languageCode: string; name: string }> = {
  bf_emma: { languageCode: 'en-GB', name: 'en-GB-Neural2-A' },   // britisch
  af_heart: { languageCode: 'en-US', name: 'en-US-Neural2-F' },  // amerikanisch
  ff_siwis: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-A' },  // französisch
};

/** gleich wie textHash in js/core.js */
function textHash(t: string): string {
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = (Math.imul(b, 33) + c) | 0; }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    // Server-Schlüssel: alte Bezeichnung (service_role) oder neue Secret Keys (sb_secret_…)
    let svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
    if (!svc) { try { const k = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'); svc = String(Object.values(k)[0] ?? ''); } catch { /* */ } }
    if (!svc) return json({ error: 'no_service_key' }, 500);
    const key = Deno.env.get('GOOGLE_TTS_KEY') ?? '';
    if (!key) return json({ error: 'no_key' }, 500);
    const admin = createClient(url, svc, { auth: { persistSession: false } });

    // nur angemeldete Lehrpersonen
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u } = await admin.auth.getUser(token);
    const user = u?.user;
    if (!user) return json({ error: 'login' }, 401);

    const body = await req.json().catch(() => ({}));
    const voice = String(body.voice ?? '');
    const text = String(body.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    const v = VOICES[voice];
    if (!v || !text) return json({ error: 'bad_input' }, 400);

    const path = `${voice}/${CLOUD_V}-${textHash(`${CLOUD_V}|${voice}|${text}`)}.mp3`;
    // schon vorhanden? (dann nichts erzeugen, nichts zählen)
    const head = await fetch(`${url}/storage/v1/object/public/${BUCKET}/${path}`, { method: 'HEAD' });
    if (head.ok) return json({ path, cached: true });

    // Tagesgrenzen
    const day = new Date().toISOString().slice(0, 10);
    const { data: used } = await admin.from('vokaboom_tts_usage').select('teacher_id,n').eq('day', day);
    const mine = used?.find((x) => x.teacher_id === user.id)?.n ?? 0;
    const all = (used ?? []).reduce((a, x) => a + (x.n ?? 0), 0);
    if (mine >= PER_TEACHER_DAY || all >= ALL_DAY) return json({ error: 'limit' }, 429);

    const g = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: { text }, voice: v, audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95, sampleRateHertz: 24000 } }),
    });
    if (!g.ok) return json({ error: 'google', status: g.status, detail: (await g.text()).slice(0, 300) }, 502);
    const { audioContent } = await g.json();
    const bytes = Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0));

    const up = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000' });
    if (up.error) return json({ error: 'storage', detail: up.error.message }, 500);
    await admin.from('vokaboom_tts_usage').upsert({ day, teacher_id: user.id, n: mine + 1 }, { onConflict: 'day,teacher_id' });
    return json({ path, cached: false });
  } catch (e) {
    return json({ error: 'fail', detail: String(e) }, 500);
  }
});
