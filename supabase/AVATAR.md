# Mein Avatar – für Vokaboom und Teilmal

Kinder mit Login-Kärtchen gestalten im Bereich **Mein Avatar** eine eigene Ganzkörper-Figur. Das **Basic-Set** ist gratis, weitere Teile kosten **Münzen**, die die Kinder beim Üben verdienen. Verbundene Kinder (gleiches Kärtchen in Vokaboom und Teilmal) haben **denselben Avatar und dieselben Münzen** in beiden Tools.

## Einrichten (einmal)

Im Supabase **SQL Editor** den Inhalt von `supabase/avatar.sql` einfügen und **Run** drücken. Das genügt für beide Tools (gleiches Supabase-Projekt). Mehrmals ausführen schadet nicht.

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

## 3D-Welt in Teilmal (Avatar und Garage)

Teilmal hat zusätzlich eine 3D-Welt mit eigenem 3D-Avatar und einer Garage fürs Turbo-Rennen (siehe README von Teilmal).
Sie nutzt dasselbe Münzkonto: Teile heissen `a3:<platz>:<wert>` (Avatar) bzw. `car:<platz>:<wert>` (Kart) und stehen mit Preis
und Freischaltung in `fab_avatar_items`. Gekauft wird mit `fab_avatar_buy` (wie beim 2D-Avatar), gespeichert mit
`fab_avatar3d_save` bzw. `fab_garage_save`. Der 2D-Avatar von Vokaboom bleibt unverändert.
In Vokaboom ändert sich dadurch nichts; `js/avatar.js` fragt nur nach einem 3D-Kopfbild für die Münz-Anzeige, falls es eines gibt.
