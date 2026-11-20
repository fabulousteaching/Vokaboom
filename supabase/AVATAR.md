# Mein Avatar – für Vokaboom und Teilmal

Kinder mit Login-Kärtchen gestalten im Bereich **Mein Avatar** eine eigene Ganzkörper-Figur. Das **Basic-Set** ist gratis, weitere Teile kosten **Münzen**, die die Kinder beim Üben verdienen. Verbundene Kinder (gleiches Kärtchen in Vokaboom und Teilmal) haben **denselben Avatar und dieselben Münzen** in beiden Tools.

## Einrichten (einmal)

Im Supabase **SQL Editor** den Inhalt von `supabase/avatar.sql` einfügen und **Run** drücken. Das genügt für beide Tools (gleiches Supabase-Projekt). Mehrmals ausführen schadet nicht. **Nach jedem Update dieser Datei nochmals ausführen** (zuletzt: 3D-Avatar in beiden Tools und Umtausch der 2D-Teile).

**Neu (3D-Welt in Teilmal):** Die Datei nochmals ganz ausführen. Sie ergänzt – ohne bestehende Daten zu ändern –
die Spalten `avatar3d` und `garage` (3D-Avatar und Kart), die Preise der 3D-Teile mit Freischaltung (`min_earned`),
das Münz-Protokoll `fab_coin_log` und die Funktionen `fab_avatar3d_save`, `fab_garage_save` und `fab_coins_spend`
(Spiele mit den Münzen aus dem gemeinsamen Konto bezahlen). Bis dahin speichert Teilmal den 3D-Look nur auf dem Gerät,
und die Spiele werden wie bisher mit den Münzen auf dem Gerät bezahlt.

## Was es gibt

| Bereich | Basic (gratis) | Mit Münzen |
|---|---|---|
| Körper | 8 Hautfarben | – |
| Gesicht | 6 Augen, 5 Münder, rote Bäckchen, 3 Brillen | Sternen- und Herzaugen, Zunge, Sommersprossen, Glitzer, Stern- und Herzbrille |
| Haare | 9 Frisuren, 7 Haarfarben | Irokese, Wellen, Space-Dutts; Pink, Mint, Lila, Regenbogen |
| Oberteil | T-Shirt, Hoodie, Ringel, Pulli mit Herz, Kleid, Trikot; 9 Farben | Superheld, Raumanzug, Anzug, Regenbogen, Kimono; Gold, Galaxie |
| Unten | Hose, Shorts, Rock, Leggings; 7 Farben; Turnschuhe, Stiefel, Sandalen | Glitzerrock, Cargohose; Raketen- und Rollschuhe |
| Extras | Cap, Mütze, Blume, Kopfhörer, Masche; Buch, Ball | Partyhut, Katzenohren, Wikingerhelm, Zauberhut, Krone; Zauberstab, Pokal, Gitarre; Umhang, Flügel, Jetpack, Drachenflügel |
| Haustier | – | Katze, Hund, Hase, Eule, Mini-Drache |
| Hintergrund | Flieder, Himmel, Minze, Pfirsich | Strand, Dschungel, Regenbogen, Weltall, Schloss |

Preise: 5 bis 50 Münzen. **Anprobieren** geht immer – gekauft wird erst mit „Für … kaufen“. Weitere Ideen im Bereich: 🎲 Zufall (aus den eigenen Teilen), Avatar antippen = er hüpft, er atmet, blinzelt, das Haustier hüpft. In Live-Spielen erscheint der Avatar im Warteraum und auf dem Siegerpodest.

## Münzen

- **Vokaboom:** richtige Antwort 1 Punkt (Lernkarten „gewusst“ ½), ein Wort, das vorher schon falsch war, +½; Test ab 80 % +3, alles richtig +5; fertig gespieltes Spiel +1. **10 Punkte = 1 Münze** (Lehrperson kann das ändern, siehe unten).
- **Teilmal:** jede Münze, die ein Kind in den Übungen verdient, zählt auch für den Avatar.
- Höchstens **40 Münzen pro Tag** (Lehrperson kann das ändern; prüft die Datenbank). Preise, Besitz und Tageslimit prüft die Datenbank, nicht der Browser – Schummeln über die Entwicklerwerkzeuge bringt nichts.

## Einstellungen der Lehrperson

Im **Menü → Avatar & Münzen** (Vokaboom, mit Konto) legt die Lehrperson fest – gilt für alle ihre Klassen, in Vokaboom und Teilmal (Tabelle `fab_teacher_settings`):

- **Mein Avatar** für die Kinder ein/aus (aus: weder Avatar noch Münzen sichtbar)
- **Münzen sammeln** ein/aus, **Tempo** per Regler (3–30 Punkte pro Münze), **Höchstens pro Tag** per Regler (5–100 Münzen)
- **Spiele geben Punkte** ein/aus
- **Shop** ein/aus (aus: nur das Basic-Set und schon gekaufte Teile; die Datenbank lehnt Käufe ab)
- **Bonus-Münzen** an ein Kind oder die ganze Klasse verteilen (höchstens 50 auf einmal, `fab_teacher_bonus`)
- **Münzensperre** für ein Kind (in Teilmal: Klasse → Übersicht → «Münzensperren» oder beim Kind): für heute, 3 Tage, 1 Woche oder bis die Lehrperson sie aufhebt. Das Kind übt und spielt weiter, verdient aber keine neuen Münzen; schon gesammelte Münzen bleiben. Die Datenbank schreibt dann nichts gut (`fab_coin_locks`, `fab_teacher_coin_lock`, `fab_teacher_coin_locks`). Die Sperre gilt im Tool, in dem sie gesetzt wurde (Teilmal-Sperre → Münzen aus Teilmal), und kommt spätestens nach ein paar Minuten beim Kind an. Das Kind sieht oben beim Münzstand ein 🔒 und beim Antippen, bis wann.

## In Teilmal einbauen

Die Dateien `js/avatar.js`, `css/avatar.css` und `supabase/avatar.sql` sind in beiden Tools **gleich** – einfach aus Vokaboom kopieren. Danach in Teilmal:

1. **index.html** – nach `css/styles.css`: `<link rel="stylesheet" href="css/avatar.css?v=1">`; vor `js/classes.js`:
   ```html
   <script>window.AVATAR_APP = 'einmaleins';</script>
   <script src="js/avatar.js?v=1"></script>
   ```
2. **js/main.js** – nach `const actions = { … };`: `if (typeof avatarActions === 'object') Object.assign(actions, avatarActions);`
3. **js/ui.js** – in `render()`: `case 'avatar': renderAvatar(); break;` und in `renderShell()` neben `#coin-slot`: `${isKid() ? '<span id="av-coin-slot">' + avCoinPillHTML() + '</span>' : ''}` (Zurück-Pfeil/Brotkrumen: „Mein Avatar“ → Startseite).
4. **js/classes.js** – am Ende von `kidRefresh()`: `if (typeof avatarLoad === 'function') avatarLoad(true);`; beim Abmelden `AV.state = null;`; auf der Kinder-Startseite die Avatar-Karte (gleicher Baustein wie in Vokaboom `kidHomeHTML()`: `<button class="av-home-card" data-action="avatar-open">…`).
5. **js/coins.js** – in `earnPoints()` nach `if (gained) coinGainFx(gained, from);`: `if (gained && typeof avatarEarnCoins === 'function') avatarEarnCoins(gained);`

Ohne diese Schritte läuft Teilmal wie bisher; die Datenbank ist schon für beide vorbereitet (inkl. Zusammenführen, wenn ein Kind später verbunden wird).

## 3D-Avatar in Vokaboom und Teilmal

Seit November 2026 ist der **3D-Avatar** (runde Voxel-Figur, über 170 Teile, Animationen) der Avatar in **beiden** Tools –
mit derselben Oberfläche: grosse drehbare Figur, Kategorien, Vorschaubilder, Anprobieren, Kaufen, automatisch speichern.
Die Dateien `js/avatar3d.js`, `js/shop3d.js`, `js/world3d.js`, `css/world3d.css` und `js/vendor/three.module.min.js` sind
in beiden Repositories **gleich** (wie `avatar.js`, `avatar.css` und `avatar.sql`). Nur Teilmal hat zusätzlich die **Garage**
fürs Turbo-Rennen (sie erscheint nur, wo das Rennen geladen ist).

- Teile heissen `a3:<platz>:<wert>` (Avatar) bzw. `car:<platz>:<wert>` (Kart, z. B. `car:body:rocket`) und stehen mit Preis und
  Freischaltung in `fab_avatar_items`. Gekauft wird mit `fab_avatar_buy`, gespeichert mit `fab_avatar3d_save` bzw. `fab_garage_save`.
- **Umtausch der 2D-Teile:** Wer im bisherigen 2D-Shop eingekauft hat, bekommt beim nächsten Laden (`fab_avatar_get` →
  `fab_migrate_2d`) das passende 3D-Teil geschenkt (z. B. Irokese, Krone, Katzenohren, Flügel, Katze); für 2D-Teile ohne 3D-Gegenstück
  oder mit einem Gegenstück, das in 3D gratis ist (z. B. Hintergründe, Eule, Haarfarben), gibt es die Münzen zurück. Jedes 2D-Teil wird
  nur einmal umgetauscht (Spalte `m2d`); im Münz-Protokoll steht «umtausch 2d-teile».
- **Live-Spiele (Vokaboom):** Kinder mit 3D-Avatar erscheinen im Warteraum und auf dem Siegerpodest mit ihrem 3D-Kopf
  (der Bildschirm der Lehrperson zeichnet ihn); sonst wie bisher mit der 2D-Figur.
- **Ohne 3D-Grafik** (sehr alte Geräte) gibt es weiterhin den 2D-Avatar.
- three.js und der Baukasten werden erst geladen, wenn man den 3D-Avatar öffnet bzw. sein Bild zeichnet.

**Dafür `supabase/avatar.sql` nochmals ganz ausführen** (ergänzt `m2d` und `fab_migrate_2d`; bestehende Daten bleiben).
