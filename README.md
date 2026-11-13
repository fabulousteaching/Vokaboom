# Vokaboom

Ein Vokabelspiel für Englisch. Vokabeln einfügen, und daraus werden:

1. **Lernkarten** mit Bild: Antippen dreht die Karte um. Dann nach rechts wischen = gewusst, nach links = nochmal (oder die Knöpfe darunter, am Computer auch die Pfeiltasten). Wählbar: Englisch → Deutsch, Deutsch → Englisch, Bild oder Bild + Wort. Auf jeder Kartenseite steht das Wort nur in einer Sprache; Anhören gibt es auf der englischen Seite. Beim Wischen färbt sich die Karte grün (gewusst) oder orange (nochmal). Als Stapel oder alle Karten auf einmal.
2. **Zuordnen** wie Memory: Nach „Zuordnen üben“ wählst du Bild ↔ Englisch oder Englisch ↔ Deutsch. Alle Kärtchen liegen gemischt da; tippe zwei an, die zusammengehören, dann verschwinden sie. Wahlweise **offen** oder **verdeckt** (klassisches Memory). Eine Stoppuhr misst die Zeit, die Bestzeit wird gespeichert.
3. **Aussprechen**: Wort oder Bild wird gezeigt, das Kind spricht ins Mikrofon. Ist es richtig, wird es grün und das nächste Wort kommt automatisch. Wenn nicht, kann es sich die richtige Aussprache anhören (auch langsam) und es nochmal versuchen. Verglichen wird die **Aussprache**, nicht die Schreibweise (englisches Aussprache-Wörterbuch CMUdict): Gleich klingende Wörter zählen als richtig („there“ für „their“, „Thai“ für „tie“, „hour“ für „our“). Kurze Wörter (he, his, she, we …), Wörter mit th-Laut und Wörter mit stummen Buchstaben dürfen um einen ähnlichen Laut abweichen (d/th, w/v, verschlucktes h), dort zählen auch die weiteren Vorschläge der Spracherkennung. Längere Wörter bleiben streng: „Brad“ oder „bird“ statt „bread“ ist falsch, ebenso „bad“ statt „bed“. Stehen mehrere Wörter da („he, his“ oder „colour / color“), müssen alle gesagt werden. Die Mehrzahl ist ok.
4. **Hören & Schreiben** (Diktat als Übung): Das Wort wird vorgelesen (auch langsam), das Kind schreibt es. Auf Wunsch zeigt ein Tipp die deutsche Bedeutung. Falsche Wörter kommen etwas später nochmal dran.
5. **Test**: Bild → schreiben, Deutsch → schreiben, Hören → schreiben (Diktat) und Bedeutung wählen. Fast richtige Antworten zählen einen halben Punkt. Am Ende gibt es eine Auswertung und man kann nur die Fehler wiederholen.

Ist eine Antwort richtig, geht es in allen Übungen nach einem kurzen Moment automatisch weiter.

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

Mit „Ein Wort zählt ab … Punkten“ (Standard 60) stellst du ein, wie streng bewertet wird. Ab dieser Punktzahl ist das Wort richtig (grün) und das nächste kommt automatisch. Das Modell wurde mit erwachsenen Muttersprachlern trainiert; wie gut es Kinderstimmen bewertet, muss sich im Einsatz zeigen.

## Browser

- **Spracherkennung** gibt es in Chrome, Edge und Safari (auch auf iPad/iPhone). Firefox kann das nicht; dort bewerten sich die Kinder selbst (anhören und vergleichen).
- **Vorlesen**: Englisch lesen vier ausgewählte Stimmen von [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) vor (frei nutzbar, Apache-2.0-Lizenz): britisch Emma (Frau) und George (Mann), amerikanisch Heart (Frau) und Michael (Mann). In den Einstellungen wählt man nur noch britisch/amerikanisch und Frau/Mann. Die Stimmen laufen direkt im Browser: Beim ersten Mal lädt jedes Gerät einmalig ca. 90 MB, danach sind sie gespeichert. Die Wörter einer Portion werden beim Öffnen schon vorbereitet. Solange die Stimmen laden – oder auf sehr alten Geräten, wo sie nicht laufen – liest die Stimme des Geräts vor. Deutsche Wörter liest immer die Gerätestimme.

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
| `js/cloud.js` | Anmelden und Speichern im Konto (Supabase) |
| `js/main.js` | Aktionen und Start |
| `supabase/` | Tabelle mit Zugriffsregeln (`vokabelwelt.sql`) und Anleitung |
| `js/tts-worker.js` | Vorlesen mit Kokoro im Hintergrund ([kokoro-js](https://github.com/hexgrad/kokoro), Apache-2.0; Modell Kokoro-82M, Apache-2.0) |
| `js/classes.js` | Klassen, Kinder-Login, Login-Kärtchen (PDF), Auswertung |
| `js/kid-pics.js` | Bildchen für Kinder-Logins ([Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji), MIT-Lizenz) |
| `js/vendor/qrcode.js` | QR-Code-Erzeugung ([qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT-Lizenz, Kazuhiko Arase) |
