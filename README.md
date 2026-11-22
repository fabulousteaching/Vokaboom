# Vokaboom

Ein Vokabelspiel für Englisch. Vokabeln einfügen, und daraus werden:

1. **Lernkarten** mit Bild: Antippen dreht die Karte um. Dann nach rechts wischen = gewusst, nach links = nochmal (oder die Knöpfe darunter, am Computer auch die Pfeiltasten). Wählbar: Deutsch → Englisch (Standard), Englisch → Deutsch (beide nur Wörter, ohne Bild), Bild, oder Bild + Wort (vorne Bild und deutsches Wort, hinten Englisch). Anhören gibt es auf der englischen Seite. Beim Wischen färbt sich die Karte grün (gewusst) oder orange (nochmal). Als Stapel oder alle Karten auf einmal.
2. **Vokabelspiele** (zählen nicht für die Auswertung):
   - **Memory**: Bild ↔ Englisch oder Englisch ↔ Deutsch. **Allein** (offen oder verdeckt, mit Stoppuhr und Bestzeit) oder **zu zweit** (verdeckt, abwechselnd; wer ein Paar findet, bekommt einen Punkt und darf nochmal).
   - **Ballon-Platzen**: Das deutsche Wort steht oben in einer Wolke. Stufe 1 den Ballon mit dem passenden Wort antippen, Stufe 2 den richtig geschriebenen (3, 4 oder 5 Ballone). Beginnt langsam; nach je 5 Treffern wird es schneller, jeder Fehler macht wieder etwas langsamer.
   - **Blitzrunde**: richtig oder falsch geschrieben? Erst häufige, kleine Fehler, später seltenere. Je 3 richtige Antworten hintereinander geben 2 Sekunden dazu; die Auflösung bleibt 2–3 Sekunden stehen (die Uhr hält solange an). Stufe 2: die falsche Stelle im Wort antippen oder „richtig“ wählen.
   - **Spielfeld so gross wie möglich**: Während Welten-Lauf und Ballon-Platzen laufen, verschwinden Titel und breite Ränder, und das Spielfeld bekommt die ganze Höhe unter der Kopfzeile – auf Handy, Tablet (hoch oder quer) und PC, ohne Scrollen (`vbFit` in `js/games.js`). Das Duell zu zweit ist schon Vollbild.
   - In allen Spielen gilt: Richtige Wörter kommen nicht mehr, bis alle anderen durch sind. Falsche kommen nach 2–4 anderen Wörtern zufällig nochmal.
   - **Buchstabensalat**, **Wortsuchsel** (deutsche Wörter; antippen dreht sie zur Übersetzung um; waagrecht und senkrecht, wahlweise auch rückwärts), **Duell zu zweit**.
   - **Welten-Lauf** 🏃 (3D, mit dem eigenen Avatar): rennen auf drei Spuren durch Dschungel, über Hochhausdächer, durch die Wüste, die Ritterburg oder unter Wasser. Oben steht das deutsche Wort (oder das Bild), über den Spuren schweben drei Blasen mit Wörtern (im gleichen Glas-Stil wie die Frage, gut lesbar) – unter der richtigen durchlaufen (ohne Vorlesen). Wischen oder Pfeiltasten: ← → Spur, ↑ springen (in der Luft nochmals: Doppelsprung), ↓ rutschen. Alle Hindernisse lassen sich überspringen; wer in einen Abgrund fällt, verliert ein Leben. Jedes richtige Wort macht ein bisschen schneller, und mit der Zeit kommt ohne Ankündigung Neues dazu: Löcher, hohe Wände (Doppelsprung), rollende Fässer, eine schmale Strasse durchs Gelände (zwei oder eine Spur) und Kurven (rechtzeitig ← → wischen, sonst prallt man in die Leitwand). Auf einer Spur schweben die Wörter übereinander: oben = springen, Mitte = weiterlaufen, unten = rutschen. **Start-Stufe** (1–5 Sterne auf der Startkarte): Wer die Wörter der Portion schon gut kann (Quote und sichere Wörter aus dem Üben, ab 20 Antworten), bekommt die schwierigeren Hindernisse früher; leichter als bisher wird es nie. Aufklappbar: **Regeln und Hindernisse**. Wahl: **3 Leben** (ein falsches Wort, ein Hindernis oder ein Absturz kostet eines) oder **Ein Leben** (bis zum ersten Fehler). Am Ende: Rekord (je Modus) und die Wörter zum Merken. Dasselbe Spiel gibt es in Teilmal mit Rechnungen (Dateien `js/runner3d.js`, `js/runworlds.js`, `css/runner3d.css` sind in beiden Repositories gleich).
   - **Weck nicht den Drachen**: Buchstaben raten. Jeder falsche Buchstabe weckt den schlafenden Drachen ein bisschen mehr (ein Auge, gähnen, Rauchwölkchen …); beim 6. Fehler ist er wach. Die Sätze unter dem Drachen stehen in der Sprache der Portion.
3. **Aussprechen**: Wort oder Bild wird gezeigt, das Kind spricht ins Mikrofon. Ist es richtig, wird es grün und das nächste Wort kommt automatisch. Wenn nicht, kann es sich die richtige Aussprache anhören (auch langsam) und es nochmal versuchen. Verglichen wird die **Aussprache**, nicht die Schreibweise (englisches Aussprache-Wörterbuch CMUdict): Gleich klingende Wörter zählen als richtig („there“ für „their“, „Thai“ für „tie“, „hour“ für „our“). Kurze Wörter (he, his, she, we …), Wörter mit th-Laut und Wörter mit stummen Buchstaben dürfen um einen ähnlichen Laut abweichen (d/th, w/v, verschlucktes h), dort zählen auch die weiteren Vorschläge der Spracherkennung. Längere Wörter bleiben streng: „Brad“ oder „bird“ statt „bread“ ist falsch, ebenso „bad“ statt „bed“. Stehen mehrere Wörter da („he, his“ oder „colour / color“), müssen alle gesagt werden. Die Mehrzahl ist ok.
4. **Hören & Schreiben** (Diktat als Übung): Das Wort wird vorgelesen (auch langsam), das Kind schreibt es. Auf Wunsch zeigt ein Tipp die deutsche Bedeutung. Falsche Wörter kommen etwas später nochmal dran.
5. **Test**: Bild → schreiben, Deutsch → schreiben, Hören → schreiben (Diktat) und Bedeutung wählen. Fast richtige Antworten zählen einen halben Punkt. Am Ende gibt es eine Auswertung und man kann nur die Fehler wiederholen.

Ist eine Antwort richtig, geht es in allen Übungen nach einem kurzen Moment automatisch weiter.

## Mein Avatar (Kinder mit Login)

Kinder mit Login-Kärtchen gestalten eine eigene **3D-Figur** (runde Voxel-Figur wie in Teilmal: Frisuren, Oberteile, Outfits, Hosen, Schuhe, Hüte & Brillen, Accessoires, Gadgets, Rücken, Tiere & Effekte, Animationen – über 170 Teile) und kaufen mit Münzen, die sie beim Üben verdienen, besondere Teile. Grosse drehbare Figur, Anprobieren gratis, Speichern automatisch. Avatar und Münzen gelten in Vokaboom und Teilmal gleich (gleiche Oberfläche, gleiche Dateien). In Live-Spielen erscheinen die Kinder mit ihrem 3D-Kopf. Früher im 2D-Shop gekaufte Teile werden in passende 3D-Teile umgetauscht oder zurückbezahlt. Ohne 3D-Grafik gibt es den bisherigen 2D-Avatar. Siehe `supabase/AVATAR.md`.

## Portion in die andere Sprache verschieben

Aus Versehen beim falschen Reiter gespeichert? Auf der Startseite die Portion am Griff ⠿ packen und auf den Reiter Englisch bzw. Französisch ziehen (am Handy erscheint beim Ziehen oben eine Ablage-Leiste). Automatisch gefundene Bilder werden danach für die neue Sprache neu gesucht; selbst gewählte Bilder bleiben.

## Vokabeln einfügen

Eine Vokabel pro Zeile. Diese Schreibweisen werden erkannt:

```
apple – Apfel
the dog = der Hund
to swim - schwimmen
house	Haus          (Tabelle aus Word/Excel, mit Tabulator)
```

Ist Deutsch links, erkennt Vokaboom das meistens selbst. Sonst hilft der Knopf „Spalten tauschen“.

Regeln beim Schreiben (grün = richtig, orange = fast richtig, ein halber Punkt, rot = falsch):

- Abstände: „icecream“ statt „ice cream“ (oder „foot ball“ statt „football“) → orange, mit Hinweis, ob man das Wort getrennt oder zusammen schreibt. Doppelte Abstände zählen nicht.
- „the“, „a“, „an“ und „to“ müssen nicht mitgeschrieben werden.
- `colo(u)r` → „colour“ und „color“ sind beide richtig.
- `colour / color` → beide Varianten schreiben ist richtig, mit oder ohne `/` („colour color“ geht auch). Nur eine davon → orange, mit Hinweis.
- Groß- und Kleinschreibung falsch („monday“ statt „Monday“) → orange, mit Hinweis.
- Drei Punkte (`...` oder `…`) muss man nicht schreiben. Steht in der Lösung ein Fragezeichen, muss es dabei sein, sonst orange.
- Ein kleiner Tippfehler → orange.
- `sb.`/`sth.` werden beim Vorlesen als „somebody/something“ gesprochen.

## Bilder

Für jede Karte wird automatisch ein Bild gesucht. Oben bei „Deine Karten“ wählst du die Bildquelle:

- **Piktogramme** (Standard): einfache, einheitlich gezeichnete Bilder von [ARASAAC](https://arasaac.org). Sie sind dafür gemacht, eindeutig zu sein, und es gibt sie auch für Verben („schwimmen“), Gefühle („glücklich“) und Eigenschaften. Gesucht wird mit dem deutschen **und** dem englischen Wort. Passt ein Piktogramm zu beiden, wird es bevorzugt – bei „bat – Fledermaus“ also das Tier und nicht der Schläger. Gibt es für ein Wort kein Piktogramm, sucht Vokaboom automatisch in der Wortfamilie bei anderen Wortarten: „hilfsbereit“ → „Hilfe“, „helfen“; „Freundschaft“ → „Freund“; „gefährlich“ → „Gefahr“ (englisch ebenso: „helpful“ → „help“). Sichere Verwandte kommen zuerst, gewagtere nur, wenn die nichts finden. Im Bild-Dialog steht dann, über welches Wort das Bild gefunden wurde. Findet ARASAAC nichts, kommen weitere freie Symbol-Sammlungen über [Global Symbols](https://globalsymbols.com) dazu (z. B. Mulberry, Sclera, Tawasol).
- **Cliparts**: farbige Zeichnungen aus offenen Sammlungen (Microsoft Fluent Emoji, Google Noto Emoji, OpenMoji, Twemoji u. a.) und im Bild-Dialog auch einfarbige Symbole (Material Symbols, Game Icons, Health Icons, Phosphor, Tabler u. a.), alle über [Iconify](https://iconify.design).
- **Emojis**: ein eingebautes Bildwörterbuch mit rund 450 Schulwörtern und dazu alle gängigen Emojis (über 1800, auch Personen, Berufe, Gesichter und Gefühle) mit deutschen und englischen Namen ([emojibase](https://emojibase.dev), MIT). Funktioniert auch ohne Internet.

Grundsatz: lieber kein Bild als ein missverständliches.

### Bilder prüfen (empfohlen vor dem Teilen)

„Bilder prüfen“ zeigt alle Wörter untereinander, daneben mehrere Bildvorschläge (Piktogramme, Emoji, Foto). Ein Tipp auf ein Bild übernimmt es. Lässt sich ein Wort nicht gut zeigen (z. B. „usually“, „at the weekend“), wähle **Kein Bild**: Das Wort kommt dann nur bei „Englisch ↔ Deutsch“ dran, nicht beim Bilder-Zuordnen. Die Auswahl wird im Teilen-Link mitgegeben, die Kinder sehen also genau deine Bilder.

Tipps für eindeutige Bilder:

- Schreib die deutsche Übersetzung so eindeutig wie möglich, nur **eine** Bedeutung pro Zeile („bat – Fledermaus“, nicht „bat – Fledermaus, Schläger“). Die Bildsuche richtet sich nach dem deutschen Wort.
- Nomen mit Artikel schreiben („der Hund“), dann erkennt Vokaboom, dass es ein Nomen ist.
- Für alles andere: Karte antippen → „Mehr …“ → eigenes Suchwort, Emoji oder eigenes Foto.

Ein Klick auf eine Karte öffnet den Bild-Dialog mit allen Quellen (Piktogramm, Clipart, Emoji mit Kategorien und Suche, eigenes Bild). Unter „Eigenes Bild“ gibt es außerdem Knöpfe für **Google Bilder** und **Pixabay**: Bild dort kopieren (Rechtsklick → „Bild kopieren“, am iPhone lange drücken → „Kopieren“) und im Feld einfügen. Eigene Fotos lassen sich auch hochladen oder mit der Tablet-Kamera aufnehmen.

Piktogramme: Sergio Palao, ARASAAC (https://arasaac.org), Eigentum der Regierung von Aragón, Lizenz CC BY-NC-SA. Die Nutzung ist für nicht-kommerzielle Zwecke wie den Unterricht erlaubt.

## Mit der Klasse teilen

„Teilen“ zeigt einen **QR-Code**, der die ganze Vokabelportion samt Bildern enthält. Mit „Groß anzeigen“ kannst du ihn am Beamer oder Whiteboard zeigen; die Kinder scannen ihn mit der Kamera ihres Handys oder Tablets und haben die Portion sofort in ihrem Browser. „Als Bild“ speichert den QR-Code, z. B. für ein Arbeitsblatt. „Link kopieren“ kopiert denselben Link, ohne ihn anzuzeigen. Eigene hochgeladene Fotos passen nicht in den QR-Code; dort werden automatisch Bilder gesucht.

## Speichern und Anmelden

Ohne Anmeldung wird alles nur im Browser gespeichert (localStorage).
Mit **Anmelden** (oben rechts, mit E-Mail-Adresse und Passwort) werden deine Portionen in deinem Konto gespeichert und sind auf jedem Gerät da. Das läuft über [Supabase](https://supabase.com), wie bei SmartSlots. Die Einrichtung (Projekt, Tabelle, Schlüssel in `js/config.js`) steht in [`supabase/ANLEITUNG.md`](supabase/ANLEITUNG.md). Die Kinder brauchen kein Konto.

**Portionen von anderen finden:** Über die Suche oben in der Titelleiste (am Handy die Lupe) lassen sich Portionen anderer Lehrpersonen suchen und mit einem Klick übernehmen. Erscheinen tun dort nur Portionen, die ihr Besitzer unter Teilen → „In der Suche zeigen“ freigegeben hat (nur Vokabeln und Bildauswahl, keine eigenen Fotos).

## Online stellen (GitHub Pages)

Vokaboom läuft unter **https://vokaboom.fabulousteaching.ch** (GitHub Pages mit eigener Subdomain).

1. Im Repository unter **Settings → Pages** ist „Deploy from a branch“ gewählt: Branch `claude/vokabelwelt-app`, Ordner **/ (root)**. Jede Änderung ist nach ein bis zwei Minuten online.
2. Die Datei `CNAME` enthält die Adresse `vokaboom.fabulousteaching.ch`. Bei Infomaniak zeigt dafür in der DNS-Zone von fabulousteaching.ch ein Eintrag **CNAME `vokaboom` → `fabulousteaching.github.io`** auf GitHub.
3. Unter **Settings → Pages** ist **Enforce HTTPS** angehakt.
4. Die alte Adresse `https://fabulousteaching.github.io/Vokabelwelt/` leitet automatisch weiter, auch bereits verteilte QR-Codes und Links.

Man kann `index.html` auch einfach per Doppelklick öffnen. Für Spracherkennung und Teilen-Links ist die Online-Version aber besser.

## Lauterkennung

In den Einstellungen lässt sich eine **Lauterkennung** einschalten. Sie fragt nicht, welches *Wort* gesagt wurde, sondern prüft jeden einzelnen *Laut*:

1. Das Zielwort wird in Lautschrift übersetzt („bread“ → b r ɛ d).
2. Ein Sprachmodell bestimmt alle 10 Millisekunden, welcher Laut zu hören ist.
3. Jeder erwartete Laut bekommt 0–100 Punkte, je nachdem, wie deutlich genau dieser Laut zu hören war („Goodness of Pronunciation“). Der Durchschnitt ist die Punktzahl des Wortes. Die Lautschrift wird nicht angezeigt, sie dient nur dem Abgleich im Hintergrund.

Alles läuft auf dem Gerät, keine Aufnahme verlässt es. Beim ersten Mal werden ca. 140 MB geladen (Sprachmodell [charsiu/en_w2v2_fc_10ms](https://huggingface.co/charsiu) über [charsiu-js](https://github.com/mnaoizy/charsiu-js), MIT; [onnxruntime-web](https://onnxruntime.ai), MIT) und im Browser gespeichert. Auf älteren Handys kann es langsam sein.

**Französisch** hat eine eigene Lauterkennung auf dem Gerät (Modell [wav2vec2-french-phonemizer](https://huggingface.co/Cnam-LMSSC/wav2vec2-french-phonemizer) von Cnam-LMSSC, MIT, als ONNX ca. 95 MB; erwartete Lautschrift von eSpeak NG). Sie wird immer benutzt, auch beim ersten Mal (die Übung wartet kurz, bis sie geladen ist): Die Spracherkennung des Browsers würde falsch Gesagtes zum richtigen Wort „verbessern“. Je Laut zählt, wie klar er zu hören war; ein einziger deutlich falscher Laut („pan“ statt „pain“, „garcon“ mit k) oder ein zusätzlicher Laut („beaucoupe“) drückt die Punkte unter die Grenze. Übliche Varianten zählen als richtig (Zungen-r, „un“ wie „in“).

**Ähnliche Laute zählen als richtig** (beide Sprachen): unbetonte Vokale, britische Aussprache ohne r („Thursday“), „-day“ als [deɪ] oder [di], stimmhaft/stimmlos (s/z, d/t, b/p, f/v), th als f oder s; im Französischen e/è, o/ò, eu/œ, Zungen-r, „un“ wie „in“. Klar andere Laute bleiben falsch: bed – bad, ship – sheep, lamb – lamp, „Tursday“; pain – pan, rue – roue, garçon mit k. Stumme Buchstaben (knife, island, listen, castle, lamb, write) werden nicht erwartet – wer sie ausspricht, liegt falsch. Die Punkte: Durchschnitt aller Laute, jeder klar falsche Laut kostet zusätzlich Punkte.

Mit „Ein Wort zählt ab … Punkten“ (Standard 60) stellst du ein, wie streng bewertet wird. Ab dieser Punktzahl ist das Wort richtig (grün) und das nächste kommt automatisch. Das Modell wurde mit erwachsenen Muttersprachlern trainiert; wie gut es Kinderstimmen bewertet, muss sich im Einsatz zeigen.

## Zusammen mit Teilmal (Mathe, früher «Einmaleins»)

[Teilmal](https://github.com/fabulousteaching/Einmaleins) (Mal und Geteilt üben, https://teilmal.fabulousteaching.ch) läuft im selben Supabase-Projekt. Lehrpersonen benutzen dasselbe Konto.

- **Verbundene Klassen:** In Teilmal lässt sich eine Vokaboom-Klasse übernehmen oder eine Teilmal-Klasse mit Vokaboom verbinden. Dann hat jedes Kind in beiden Tools denselben Benutzernamen und dieselben 3 Bilder. Neue Kinder bekommen automatisch dasselbe Login im anderen Tool. In der Kinderliste steht dann „auch in Teilmal“.
- **Login-Kärtchen** sind neutral, ohne Logo, und in beiden Tools gleich: oben „Mein Login“ und die Klasse. Auch die Einstellungen (Menü → Login-Kärtchen: Bilder, Passwort pro Kind oder Klassenpasswort, Name, QR-Code, Klasse) gelten in beiden Tools; sie liegen bei der Lehrperson in `fab_teacher_settings.cards` (`supabase/avatar.sql` nochmals ausführen). Auf dem Kärtchen ist **ein QR-Code**: Kinder, die auch in Teilmal sind, wählen beim Scannen **„bei Vokaboom“** oder **„bei Teilmal“** (mit Logo); die anderen kommen direkt zu Vokaboom.
- **Gemeinsam angemeldet:** Laufen beide Tools unter fabulousteaching.ch, gilt die Anmeldung für beide (Lehrperson und Kind), ebenso das Abmelden. Kinder wechseln mit dem Knopf **„1×1 Rechnen üben“** angemeldet nach Teilmal. Technisch: Cookies der Domain fabulousteaching.ch (`js/sso.js`, in beiden Repositories gleich). Bestehende Anmeldungen ziehen beim ersten Öffnen von selbst dorthin um.
- Die Adresse von Teilmal steht in `js/config.js` (`einmaleinsUrl`). Die Datenbank-Funktionen dafür liegen in Teilmal (`supabase/einmaleins.sql`); ohne sie läuft Vokaboom wie bisher allein.

## Browser

- **Handy und iPad:** Alle Spiele sind auf Handy (hoch und quer) und iPad geprüft. Quer auf dem Handy fällt der Spieltitel weg, und die Spiele ordnen sich nebeneinander an (Ballon-Himmel so hoch wie der Bildschirm, Blitzrunde mit Knöpfen rechts, Drache links und Buchstaben rechts, Wortsuchsel mit Gitter links, Duell nebeneinander, Memory in zwei Reihen, Welten-Lauf mit kleinerer Frage-Karte). Nichts ist breiter als der Bildschirm.
- **Spracherkennung** gibt es in Chrome, Edge und Safari (auch auf iPad/iPhone). Firefox kann das nicht; dort bewerten sich die Kinder selbst (anhören und vergleichen).
- **Vorlesen**: Für angemeldete Lehrpersonen und Kinder mit Klassen-Login lesen zwei Frauenstimmen von [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) vor (frei nutzbar, Apache-2.0-Lizenz): britisch Emma und amerikanisch Heart. Jedes Wort wird nur einmal auf dem Gerät der Lehrperson erzeugt und im Audio-Speicher des Kontos abgelegt; Kinder-Geräte spielen die fertigen Aufnahmen sofort ab (siehe `supabase/ANLEITUNG.md`). Wer nicht angemeldet ist, hört zuerst die beste Frauenstimme seines Geräts; die Vokaboom-Stimme lädt im Hintergrund (einmalig ca. 90 MB, nicht im Datensparmodus) und liest danach vor. Über einen QR-Code geteilte Portionen spielen sofort die gespeicherten Aufnahmen der Lehrperson ab. Fehlt eine Aufnahme, und für deutsche Wörter, liest die Gerätestimme.

## Aufbau

Reines HTML/CSS/JavaScript ohne Build-Schritt:

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seite |
| `logo.svg`, `icon.svg`, `apple-touch-icon.png` | Logo, App-Symbol und Symbol für den iPhone-Startbildschirm |
| `css/styles.css` | Gestaltung |
| `js/config.js` | Supabase-Adresse und öffentlicher Schlüssel (leer = ohne Anmeldung) |
| `js/picture-data.js` | Bildwörterbuch (Emoji/Farbe ↔ Englisch/Deutsch) |
| `js/emoji-catalog.js` | alle gängigen Emojis mit deutschen und englischen Namen ([emojibase-data](https://github.com/milesj/emojibase) 17, MIT, Namen aus Unicode CLDR) |
| `js/core.js` | Parser, Antwortprüfung, Speicher, Bildsuche, Vorlesen, Spracherkennung |
| `js/phonetic.js` | Lauterkennung: Laut für Laut auf dem Gerät |
| `js/ui.js` | Startseite, Übersicht, Dialoge |
| `js/modes.js` | Lernkarten, Zuordnen, Aussprechen, Hören & Schreiben, Test |
| `js/sso.js` | Gemeinsames Anmelden mit Teilmal (Cookies auf fabulousteaching.ch) |
| `js/cloud.js` | Anmelden und Speichern im Konto (Supabase) |
| `js/main.js` | Aktionen und Start |
| `supabase/` | Tabelle mit Zugriffsregeln (`vokabelwelt.sql`) und Anleitung |
| `js/tts-worker.js` | Vorlesen mit Kokoro im Hintergrund ([kokoro-js](https://github.com/hexgrad/kokoro), Apache-2.0; Modell Kokoro-82M, Apache-2.0) |
| `js/classes.js` | Klassen, Kinder-Login, Login-Kärtchen (PDF), Auswertung |
| `js/kid-pics.js` | Bildchen für Kinder-Logins ([Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji), MIT-Lizenz) |
| `js/vendor/qrcode.js` | QR-Code-Erzeugung ([qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT-Lizenz, Kazuhiko Arase) |
