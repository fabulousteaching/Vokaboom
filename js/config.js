/* Vokaboom: Verbindung zu Supabase (Anmeldung mit E-Mail-Adresse und gespeicherte Vokabelportionen)

   Beide Werte stehen in Supabase beim Projekt unter «Connect» oder «Project Settings → API Keys».
   Sie dürfen öffentlich sein: Die Daten schützen die Zugriffsregeln aus supabase/vokabelwelt.sql,
   dort sieht jede Person nur ihre eigenen Portionen.
   Den «secret» bzw. «service_role» Schlüssel nie hier eintragen.

   Bleiben die Werte leer, läuft Vokaboom ohne Anmeldung, alles bleibt nur im Browser. */
window.VOKABELWELT_CONFIG = {
  supabaseUrl: 'https://cppgdrwpwcshtbavesrm.supabase.co',
  supabaseKey: 'sb_publishable_66QwDLf_H_O1aNdn2mP1LA_A40he3mM',   // «Publishable key», darf öffentlich sein
  // Einmaleins (Mathe-Tool im selben Supabase-Projekt): für den QR-Code „1×1 Rechnen“ auf den Login-Kärtchen
  // und den Knopf für Kinder. Die github.io-Adresse leitet auf die eigene Adresse weiter, sobald es eine gibt.
  // Cloud-Stimme (Google Text-to-Speech über die Supabase-Funktion „vokaboom-tts“). false = KI-Stimme im Browser (Kokoro).
  cloudTts: true,
  einmaleinsUrl: 'https://fabulousteaching.github.io/Einmaleins/',   // Teilmal (früher Einmaleins); leitet auf die eigene Adresse teilmal.fabulousteaching.ch weiter
};
