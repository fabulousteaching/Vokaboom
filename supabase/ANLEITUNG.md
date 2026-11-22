# Vokaboom mit Anmeldung einrichten

Mit einem Konto speichert Vokaboom deine Vokabelportionen bei [Supabase](https://supabase.com) (Datenbank und Anmeldung, gratis für kleine Projekte). Du meldest dich mit **E-Mail-Adresse und Passwort** an und hast deine Portionen auf jedem Gerät.
Solange in `js/config.js` nichts eingetragen ist, läuft Vokaboom ohne Anmeldung, und alles bleibt nur im Browser.

Die Kinder brauchen kein Konto. Sie bekommen die Portionen weiterhin über den QR-Code.

Die Menünamen in Supabase ändern sich ab und zu leicht. Die Wege unten stimmen sinngemäss.

## 1. Projekt erstellen

1. Auf supabase.com anmelden und **New project** wählen.
2. Name z. B. `vokabelwelt`. **Region in Europa** wählen (z. B. Frankfurt).
3. Das Datenbank-Passwort gut aufbewahren (Vokaboom braucht es nicht).

## 2. Tabelle anlegen

1. Links **SQL Editor** öffnen, **New query**.
2. Den ganzen Inhalt von `supabase/vokabelwelt.sql` einfügen und **Run** klicken.
3. Es erscheint «Success. No rows returned». Mehrmals ausführen schadet nicht.

Das SQL legt die Tabelle `vokabelwelt_sets` an und sorgt dafür, dass jede Person nur ihre eigenen Portionen sieht und ändern kann.

## 3. Adresse der Seite eintragen

**Authentication → URL Configuration**

- **Site URL:** `https://vokaboom.fabulousteaching.ch/`
- **Redirect URLs:** `https://vokaboom.fabulousteaching.ch/**` hinzufügen. Die alte Adresse `https://fabulousteaching.github.io/Vokabelwelt/**` darf in der Liste bleiben.

Dorthin führen die Links in den E-Mails (Konto bestätigen, Passwort vergessen).

## 4. E-Mails

Der eingebaute E-Mail-Versand von Supabase ist nur zum Testen da: Er schickt nur an Mitglieder des eigenen Supabase-Teams und nur wenige E-Mails pro Stunde. Es gibt zwei Wege:

**Schnell:** Unter **Authentication → Sign In / Providers → Email** die Option **Confirm email** ausschalten.
Neue Konten sind dann sofort aktiv, ohne Bestätigungs-E-Mail. Nachteil: «Passwort vergessen?» schickt nur an Mitglieder des Supabase-Teams eine E-Mail (also an dich, wenn du dich mit derselben Adresse wie bei Supabase anmeldest). Für alle anderen kannst du das Passwort selbst neu setzen (siehe unten).

**Richtig:** Einen eigenen E-Mail-Versand (SMTP) eintragen, unter **Authentication → Emails → SMTP Settings**.
Zum Beispiel mit Brevo (gratis bis 300 E-Mails pro Tag) oder mit dem Postausgang der Schule.
Dann kann **Confirm email** eingeschaltet bleiben, und «Passwort vergessen?» funktioniert für alle.
Danach unter **Authentication → Rate Limits** die Zahl der E-Mails pro Stunde nach Bedarf erhöhen.

Ebenfalls unter **Authentication → Sign In / Providers → Email** empfohlen:

- **Minimum password length:** 8 (Vokaboom verlangt das auch).

Die Texte der E-Mails lassen sich unter **Authentication → Emails** auf Deutsch übersetzen.

**Wer darf ein Konto erstellen?** Mit «Neues Konto» kann sich jede Person, die die Seite kennt, ein Konto machen. Wenn du das nicht willst: Erst dein eigenes Konto erstellen, dann unter **Authentication → Sign In / Providers** die Option **Allow new users to sign up** ausschalten. Weitere Konten (z. B. für Kolleginnen und Kollegen) legst du danach unter **Authentication → Users → Add user → Create new user** an (E-Mail-Adresse, Passwort und **Auto Confirm User** anhaken).

## 5. Schlüssel in Vokaboom eintragen

Beim Projekt auf **Connect** klicken (oder **Project Settings → API Keys**) und zwei Werte kopieren:

- die **Project URL** (`https://….supabase.co`)
- den **Publishable key** (`sb_publishable_…`) oder den älteren **anon public** Schlüssel

Beide in `js/config.js` eintragen (bei `supabaseUrl` und `supabaseKey`). Diese beiden Werte dürfen öffentlich sein.
Den **secret** bzw. **service_role** Schlüssel nie eintragen und nie weitergeben.

Nach dem Speichern (Commit) ist die Anmeldung nach ein bis zwei Minuten auf GitHub Pages da: oben rechts **Anmelden** → **Neues Konto**.

## Was beim Anmelden passiert

- Portionen, die schon auf dem Gerät sind, kommen mit ins Konto.
- Jede Änderung (neue Portion, Bilder, Bearbeiten, Löschen) wird ein paar Sekunden später ins Konto gespeichert. Oben rechts zeigt ein Punkt den Stand: grün = gespeichert, gelb = wird gespeichert, rot = Problem (Maus darüber oder antippen für Details).
- Auf einem anderen Gerät anmelden: Die Portionen werden geholt.
- **Abmelden** entfernt die Portionen von diesem Gerät (sie bleiben im Konto). Praktisch auf Schulcomputern, die mehrere Personen benutzen.
- Ohne Internet geht alles weiter wie bisher; gespeichert wird beim nächsten Mal mit Verbindung.
- Unter **Konto** (oben rechts auf deinen Namen) lassen sich **Passwort** und **E-Mail-Adresse ändern**. Für eine neue E-Mail-Adresse fragt Vokaboom zur Sicherheit das aktuelle Passwort ab. Ist «Confirm email» ausgeschaltet, gilt die neue Adresse sofort. Ist es eingeschaltet, schickt Supabase einen Bestätigungs-Link an die neue Adresse (mit «Secure email change» auch einen an die bisherige); erst nach dem Klick gilt die neue Adresse.

## Bibliothek: Portionen von anderen

Oben in der Titelleiste gibt es den Knopf **Bibliothek**. Dort sind die geteilten Portionen geordnet:
**Fach** (Englisch / Französisch) → **Lehrmittel** → **Schuljahr** → **Unit / Unité** → Portion. Oben auf der Seite kann man auch suchen (Lehrmittel, Unit, Name oder ein Wort aus den Vokabeln).

**Eigene Portion teilen** (mit Konto): Portion öffnen → **Bibliothek** (oder Teilen → „In der Bibliothek teilen“). Dann mit Häkchen wählen:
1. **Lehrmittel** – gibt es das Lehrmittel noch nicht, unten den Namen eintippen und **Anlegen**.
2. **Schuljahr** – 3. bis 9. Klasse (feste Auswahl; angezeigt werden die Schuljahre, für die das Lehrmittel Bände hat – „Anderes Schuljahr“ zeigt alle).
3. **Unit / Unité** – wie beim Lehrmittel auswählen oder neu anlegen.

Jedes Lehrmittel und jede Unit gibt es nur einmal. Wer „new world“ anlegen will, obwohl es „New World“ schon gibt, bekommt die Meldung **„Dieses Lehrmittel existiert bereits“**, und das bestehende ist gleich ausgewählt (gross/klein, Leerzeichen, Bindestriche und Akzente zählen nicht). Gleich bei den Units – innerhalb desselben Lehrmittels und Schuljahrs.

- Öffentlich gespeichert wird nur eine Kopie mit Name, Vokabeln und Bildauswahl. Eigene Fotos, der Übungsstand und die E-Mail-Adresse werden **nicht** geteilt; wer eine Portion geteilt hat, sehen andere nicht.
- Ändert der Besitzer die Portion, wird die Kopie ein paar Sekunden später nachgeführt. „Aus der Bibliothek nehmen“ oder Portion löschen entfernt sie.
- Ansehen und „Übernehmen“ geht auch ohne Konto. Übernommene Portionen sind eigenständige Kopien.
- Früher geteilte Portionen stehen unter **„Noch nicht eingeordnet“**, bis ihr Besitzer sie einordnet (Portion öffnen → In der Bibliothek → Einordnung ändern). Lehrmittel und Units ohne Portion werden nicht angezeigt.
- Dafür `supabase/vokabelwelt.sql` nochmals ganz im SQL Editor ausführen (bestehende Daten bleiben erhalten).
- Unpassende Einträge kannst du in Supabase im **Table Editor** löschen: Portionen in `vokabelwelt_public`, Lehrmittel in `vokaboom_lib_lehrmittel`, Units in `vokaboom_lib_units`. Tippfehler korrigierst du dort direkt in der Spalte `name`.

## Klassen und Kinder-Logins

Mit Konto gibt es auf der Startseite (und im **Menü → Klassenübersicht**) den Knopf **Meine Klassen**. In der Klassenübersicht steht jede Klasse mit Direktlinks zu Kinder, Portionen, Kärtchen und Auswertung sowie der Einstellung fürs Wiederholen.

**Menü:** Oben rechts gibt es einen einzigen Knopf **Menü**. Links die Bereiche, rechts die Einstellungen: Konto · Klassenübersicht · Login-Kärtchen · Avatar & Münzen · Stimme & Aussprache · Mikrofon.

1. **Klasse anlegen**, z. B. „5a Englisch“.
2. **Kinder**: Vorname und im kleinen Kästchen den ersten Buchstaben des Nachnamens eintragen – oder eine ganze Namensliste einfügen (eine Zeile pro Kind). Gespeichert wird nur der Vorname und der erste Buchstabe des Nachnamens.
3. Jedes Kind bekommt automatisch einen eigenen **Benutzernamen** (z. B. `Baum34`, nie doppelt vergeben) und ein **Bilder-Passwort** aus 3 Bildern.
4. **Portionen**: anhaken, welche Portionen die Klasse sieht. Kinder sehen nur diese – mit allen Übungen, aber ohne Bearbeiten. Unter jeder angehakten Portion gibt es **„Für einzelne Kinder anpassen“**: Häkchen weg bei „Sieht die Portion“ = dieses Kind bekommt die Portion nicht; Häkchen weg bei einem Spiel = dieses Kind bekommt das Spiel in dieser Portion nicht. In der Auswertung steht dann „ausgenommen“.
5. **Kärtchen**: als PDF herunterladen (10 pro A4-Seite), ausdrucken, ausschneiden. Die Kärtchen sind neutral, ohne Logo (gleich wie in Teilmal). Auf dem Kärtchen ist ein QR-Code: Kinder, die auch in Teilmal sind, wählen beim Scannen „bei Vokaboom“ oder „bei Teilmal“; die anderen kommen direkt zu Vokaboom. Bereits gedruckte Kärtchen mit zwei QR-Codes gelten weiterhin.
6. **Auswertung**: pro Kind und Portion der Anteil richtiger Antworten, wie viele Wörter und Übungen gemacht sind und der beste Test. Antippen eines Kindes zeigt seine schwierigsten Wörter; unten stehen die schwierigsten Wörter der ganzen Klasse.

**Anmelden als Kind:** QR-Code auf dem Kärtchen mit der Kamera scannen – oder auf **Anmelden → Kinder-Login**, Benutzernamen eintippen und die 3 Bilder der Reihe nach antippen. Nach 8 falschen Versuchen ist 5 Minuten Pause. Auf einem Gerät, auf dem eine Lehrperson angemeldet ist, geht das Kinder-Login erst nach dem Abmelden.

**Anmelden mit Bildern oder Passwort** (Menü → Login-Kärtchen): Was auf dem Kärtchen steht, wählst du:
- **Bilder** – die Kinder tippen 3 Bilder an (ideal für die Unterstufe).
- **Passwort pro Kind** – Vokaboom erzeugt für jedes Kind ein eigenes einfaches Passwort: ein Wort und eine Zahl, z. B. `Teich23` (andere Wörter als bei den Benutzernamen).
- **Klassenpasswort** – du legst für jede Klasse ein Passwort fest (mind. 4 Zeichen, z. B. `Sommer2026`). Einfach zu merken, dafür könnten sich Kinder gegenseitig anmelden. Klassen ohne Klassenpasswort bekommen Kärtchen mit Bildern.

Alle drei funktionieren immer (auch der QR-Code). Gross/klein, Leerzeichen und Bindestriche spielen beim Eintippen keine Rolle. Im Kinder-Login wählen die Kinder „Mit Bildern“ oder „Mit Passwort“; das Gerät merkt sich die Wahl. Ausserdem: Name als Vorname + Anfangsbuchstabe oder **nur Initialen**, QR-Code und Klassenname ein/aus. In Teilmal geht das Passwort auch, wenn das Kind mit Vokaboom verbunden ist (gleiches Kärtchen).

Dafür `supabase/vokabelwelt.sql` nochmals ganz ausführen (bestehende Kinder bekommen dabei automatisch ein Passwort; Bilder und Kärtchen bleiben gültig) – und für Teilmal `einmaleins.sql` aus dem Teilmal-Projekt.

**Kärtchen verloren?** Beim Kind auf das Symbol mit den gekreuzten Pfeilen tippen: Es bekommt neue Bilder und ein neues Passwort, das alte Kärtchen gilt nicht mehr. (Ein Klassenpasswort änderst du im Menü.)

Dafür braucht es die Tabellen für Klassen: `supabase/vokabelwelt.sql` nochmals ganz im SQL Editor ausführen (bestehende Daten bleiben erhalten).

- **Neu: Ausnahmen für einzelne Kinder** brauchen die Spalte `rules`. Dafür `supabase/vokabelwelt.sql` nochmals ganz ausführen. Bis dahin funktionieren die Klassen wie bisher, nur das Anpassen für einzelne Kinder ist noch nicht möglich (Vokaboom zeigt dann einen Hinweis).

## Zusammen mit Teilmal (früher «Einmaleins»)

Teilmal (Mathe-Tool) benutzt dieses Supabase-Projekt mit. Die Einrichtung steht im Repository von Teilmal, `fabulousteaching/Einmaleins` (`supabase/einmaleins.sql` und `supabase/ANLEITUNG.md`). Danach:

- Klassen lassen sich in Teilmal mit Vokaboom verbinden: Jedes Kind hat in beiden Tools dasselbe Login (ein Kärtchen).
- Laufen beide Tools unter fabulousteaching.ch, ist man in beiden gleichzeitig angemeldet bzw. abgemeldet (Lehrperson und Kind).
- Ohne die Tabellen von Teilmal (`einmaleins_…`) läuft Vokaboom wie bisher.

## Vokaboom-Stimmen (Audio-Speicher)

Vokaboom liest mit zwei Frauenstimmen vor: britisch Emma und amerikanisch Heart (Einstellungen: Britisch/Amerikanisch). Angemeldete Lehrpersonen, Kinder mit Klassen-Login und Kinder mit dem QR-Code einer Lehrperson hören die gespeicherten Aufnahmen. Wer sonst nicht angemeldet ist, hört zuerst die beste Frauenstimme des Geräts; die Vokaboom-Stimme lädt im Hintergrund und liest danach vor.

- Die Stimmen werden im Browser erzeugt, das dauert pro Wort ein paar Sekunden. Deshalb passiert es nur **einmal**: Öffnet eine angemeldete Lehrperson eine eigene Portion, erzeugt ihr Gerät im Hintergrund alle Wörter mit beiden Stimmen und speichert sie im Supabase-Speicher (Bucket `vokaboom-audio`). Oben in der Portion steht der Fortschritt („Aufnahmen werden vorbereitet: 37 von 120“). Seite offen lassen, bis „Alle Wörter sind … gespeichert“ erscheint.
- Beim ersten Mal lädt das Gerät der Lehrperson dafür einmalig ca. 90 MB.
- Kinder-Geräte laden nichts davon: Sie spielen die fertigen Aufnahmen sofort ab. Gibt es für ein Wort noch keine Aufnahme, liest die Gerätestimme.
- Eine Aufnahme ist ca. 40 KB gross. Der Gratis-Speicher von Supabase (1 GB) reicht für viele tausend Wörter.
- Dafür braucht es den Speicher: `supabase/vokabelwelt.sql` nochmals ganz im SQL Editor ausführen.

## Englisch und Französisch

Auf der Startseite gibt es zwei Reiter: **Englisch** und **Französisch**. Jeder Reiter hat seine eigenen Portionen; neue Portionen bekommen die Sprache des gewählten Reiters. Kinder sehen alle freigegebenen Portionen mit Flagge.

- Französisch liest die Vokaboom-Stimme **Siwis** vor (Kokoro, Apache-2.0). Die Aufnahmen entstehen wie bei Englisch einmal auf dem Gerät der Lehrperson und kommen in den Audio-Speicher. Dafür lädt dieses Gerät zusätzlich die französische Lautschrift (eSpeak NG, ca. 6 MB, GPL-3.0, wird nur nachgeladen). Bis eine Aufnahme da ist, liest die beste französische Gerätestimme.
- Beim Schreiben gehört der Artikel dazu: „chien“ statt „le chien“ ist fast richtig (Hinweis auf den Artikel), „la chien“ ist falsch.
- Beim Aussprechen prüft Französisch mit einer eigenen Lauterkennung auf dem Gerät, Laut für Laut (Modell [wav2vec2-french-phonemizer](https://huggingface.co/Cnam-LMSSC/wav2vec2-french-phonemizer), MIT, ca. 95 MB einmalig; erwartete Lautschrift von eSpeak NG). Die Spracherkennung des Browsers wird für Französisch nicht mehr benutzt: Sie „verbessert“ falsch Gesagtes zum richtigen Wort. Erlaubt sind übliche Varianten (Zungen-r, „un“ wie „in“), zusätzliche Laute wie „beaucoupe“ zählen als Fehler.
- Damit die Suche weiss, welche Sprache eine Portion hat, `supabase/vokabelwelt.sql` nochmals ganz ausführen (neue Spalte `lang`).

## Vokabelspiele und Live in der Klasse

**Vokabelspiele** (Schritt 2 jeder Portion): Memory (allein oder zu zweit), Ballon-Platzen (2 Stufen), Blitzrunde (2 Stufen), Buchstabensalat, Wortsuchsel (deutsche Wörter als Hinweis, antippen zeigt die Übersetzung; wahlweise auch rückwärts), Weck nicht den Drachen, Duell zu zweit, Welten-Lauf und neu:
- **Wörterregen** – eine antike Stadt am Meer im Regen (bei Tag); die Kinder wählen **Antippen** oder **Eintippen**. Es beginnt mit Nieseln und wird stärker (nach 8 Wörtern Regen, nach 18 Gewitter). Jeder Tropfen, der ins Meer fällt, und jede falsche Antwort lassen das Wasser steigen – nach 3 Fehlern versinkt die Stadt und wird zu Atlantis.
- **Wortschlange** – oben steht das deutsche Wort, die Schlange frisst das richtige Wort in der Fremdsprache und wird länger. Ab dem 8. Wort schwimmen die Wörter langsam umher – trifft ein falsches Wort den Kopf, kostet das ein Leben.
- **Angeln** – der eigene Avatar angelt den Fisch mit dem richtigen Wort; ein falscher Fisch zieht ihn ins Wasser (Teich, See, Meer). Verschiedene Fischarten.
- **Brückenbau** – Blick von hinten über die Schulter des Avatars: jedes richtige Wort legt eine Platte vor ihn hin, und er geht einen Schritt weiter; eine falsche Platte bricht und stürzt in die Tiefe; 10–20 Bretter je nach Lernstand, jedes Mal eine andere Landschaft.
- **Zaubertrank** – der Avatar giesst die gewählten Fläschchen in den Kessel. Ob es die richtigen waren, zeigt sich erst am Schluss: Ein richtiger Trank leuchtet und hat einen lustigen Effekt, ein falscher misslingt (grauer Schlamm, Rauch), und die richtigen Zutaten werden gezeigt.
- Angeln, Brückenbau und Zaubertrank zeigen den **3D-Avatar** des Kindes (aus dem 3D-Shop), auf älteren Geräten ohne 3D den gewohnten Avatar.
- **Hör-Detektiv** – Wort anhören und die passende Karte finden; auf den Karten stehen die deutschen Wörter (am Anfang mit Bild). 10 Fälle, zuletzt ähnlich klingende Wörter. Im Detektivlabor klappt jede Akte auf, wird gestempelt und wandert auf den Stapel.

Oben links führt ein Zurück-Pfeil immer eine Ebene höher. Spiele zählen nicht für die Auswertung, aber für das Wiederholen nach der Vergessenskurve. Vorgelesen wird nie automatisch, nur auf Knopfdruck.

**Für die Kinder** (Bereich in der eigenen Portion, unter den Übungen):
- **Vokabeln zeigen: Mit Bildern / Nur Wörter.** Bei „Nur Wörter“ zeigen Lernkarten, Übungen, Spiele und Test keine Bilder. In der eigenen Kartenübersicht bleiben die Bilder sichtbar.
- **Welche Spiele?** Einzelne Spiele für diese Portion ausschalten.
- Beides gilt für Klassen und für Portionen, die per Link oder QR-Code geteilt werden. Einzelne Kinder lassen sich zusätzlich unter **Klassen → Portionen → Für einzelne Kinder anpassen** ausnehmen.

**Live in der Klasse** (mit oder ohne Konto starten, in der eigenen oder per Link bekommenen Portion; nicht im Kinder-Login):
- **Einstellungen im Warteraum** (während die Kinder beitreten): Richtung (Deutsch → Fremdsprache oder umgekehrt), Anzahl Fragen, Zeit pro Frage (10–60 s) und welche Wörter vorkommen; beim Hör-Bingo, welche Wörter und ob Vokaboom von Hand oder automatisch (alle 6/10/15 s) vorliest. Die Einstellungen werden gemerkt.
- **Quiz:** Die Fragen erscheinen am Beamer, die Kinder antworten auf ihren Geräten. Schnelle richtige Antworten geben mehr Punkte. Nach jeder Frage zeigt der Beamer die Auflösung und eine Live-Tabelle (Plätze rutschen, Punkte zählen hoch); jedes Kind sieht auf seinem Gerät, ob es richtig war, wie viele Punkte es geholt hat und seinen Platz. Weiter geht es erst, wenn die Lehrperson „Nächste Frage“ drückt. Am Schluss: Siegerehrung mit Podest (Platz 3, Platz 2, Trommelwirbel, Platz 1); die Kinder sehen ihren Platz erst danach.
- **Hör-Bingo:** Jedes Kind bekommt 9 Wortkarten. Die Lehrperson liest mit „Nächstes Wort“ vor; wer drei in einer Reihe hat, drückt BINGO, und Vokaboom prüft, ob alle Wörter schon vorgelesen wurden.
- Die Kinder machen mit dem QR-Code mit (ohne Code eintippen; mit Kinder-Login sind sie sofort dabei, sonst geben sie ihren Vornamen ein) oder über „Live-Spiel beitreten“ mit dem 5-stelligen Code. Beim Quiz sehen die Kinder auf ihrem Gerät nur die vier Farbfelder A–D; Frage und Wörter stehen am Beamer (ohne Bilder). Namen ohne Login werden geprüft: Beleidigungen und Schimpfwörter (Deutsch, Schweizerdeutsch, Englisch, Französisch, auch mit Tricks wie „A.r.s.c.h“) werden nicht angenommen, auch nicht, wenn jemand die Prüfung auf dem eigenen Gerät umgeht.
- Dafür nutzt Vokaboom Supabase Realtime („Broadcast“). Das ist bei Supabase standardmässig eingeschaltet, es braucht keine Tabelle, und es wird nichts gespeichert.

## Passwort vergessen

- **Mit E-Mail-Versand:** Im Anmelde-Fenster die E-Mail-Adresse eingeben und auf **Passwort vergessen?** klicken. Der Link in der E-Mail öffnet Vokaboom, dort wählt man ein neues Passwort.
- **Ohne eigenen E-Mail-Versand** kannst du ein Passwort in Supabase selbst neu setzen: **SQL Editor** öffnen und Folgendes ausführen (E-Mail-Adresse und neues Passwort anpassen):

```sql
update auth.users
set encrypted_password = extensions.crypt('NeuesPasswort123', extensions.gen_salt('bf'))
where email = 'name@schule.ch';
```

Danach mit dem neuen Passwort anmelden und es unter «Konto → Passwort ändern» gleich durch ein eigenes ersetzen.

## Gut zu wissen

- **Pause bei Gratis-Projekten:** Supabase pausiert Gratis-Projekte nach etwa 7 Tagen ohne Nutzung. Die Daten bleiben erhalten. Beim Projekt in Supabase **Restore** klicken, dann geht es nach ein paar Minuten weiter. Während der Pause meldet Vokaboom «Keine Verbindung zum Server»; auf dem Gerät gespeicherte Portionen funktionieren trotzdem.
- **Datenschutz:** Gespeichert werden die E-Mail-Adresse (für die Anmeldung) und die Portionen: Vokabeln, Bilder-Auswahl und der Übungsstand dieses Geräts. Von Kindern nur Vorname, erster Buchstabe des Nachnamens, Benutzername, Bilder-Passwort und Übungsstand – keine E-Mail-Adressen. Kläre mit deiner Schule, ob das so erlaubt ist.
- **Eigene Fotos** (hochgeladen oder eingefügt) werden mitgespeichert. Eine Portion darf im Konto höchstens ca. 3 MB gross sein.

## Wiederholen nach der Vergessenskurve

Vokaboom merkt sich bei jedem Wort, wann es wieder dran ist (Lernkartei mit 5 Fächern):
**Fach 1:** nach 1 Tag · **2:** nach 3 Tagen · **3:** nach 1 Woche · **4:** nach 2 Wochen · **5:** nach 1 Monat („sicher“).
Richtig → ein Fach weiter. Falsch → zurück ins 1. Fach (morgen wieder). Fast richtig (Tippfehler) → Fach bleibt, morgen nochmals.

- Alle Übungen und Spiele zählen mit (Aussprechen, Hören & Schreiben, Test, Wiederholen, Wörterregen, Angeln, Memory …). Ausnahme: Duell zu zweit (zwei Kinder an einem Gerät). Für die Auswertung der Lehrperson zählen die Spiele weiterhin nicht. Bei den Lernkarten schätzen sich die Kinder selbst ein – dort kommen Wörter nur neu in den Kasten, sie rücken nicht vor.
- Auf der Startseite erscheint **„Heute wiederholen: 12 Wörter“** mit dem Knopf **Los geht's**. Eine Runde hat höchstens 20 Wörter aus allen Portionen gemischt. Am Schluss sehen die Kinder, welche Wörter morgen nochmals kommen und wie viele schon sicher sitzen. Richtige Antworten geben Münzen für den Avatar.
- **Eintippen oder Auswählen:** **Menü → Klassenübersicht** (bei jeder Klasse „🧠 Wiederholen“) oder Klasse → **Portionen** → **Wiederholen**. Eintippen: Deutsch sehen, Wort in der Fremdsprache schreiben (automatisch geprüft, Tippfehler zählen als „fast“). Auswählen: das richtige Wort aus 4. Ohne Einstellung wählt Vokaboom nach dem Klassennamen: „3a“, „4b“ → Auswählen, sonst Eintippen.
- **Auswertung:** Klasse → **Auswertung** → Spalte **🧠 Wiederholen**: wie viele Wörter heute fällig sind, wie viele sicher sitzen und wann das Kind zuletzt wiederholt hat. Rot = fällige Wörter und seit mehr als 4 Tagen nicht wiederholt.
- Erinnert werden die Kinder, wenn sie Vokaboom öffnen (keine Push-Nachrichten). Mit Login-Kärtchen ist der Stand auf jedem Gerät gleich; ohne Login nur auf diesem Gerät.
- Für die Einstellung Eintippen/Auswählen `supabase/vokabelwelt.sql` nochmals ganz ausführen.

## Mein Avatar und Münzen (Kinder mit Login-Kärtchen)

Kinder gestalten unter **Mein Avatar** eine eigene Figur (Haut, Gesicht, Haare, Kleider, Schuhe, Extras, Haustier, Hintergrund). Das Basic-Set ist gratis, weitere Teile kosten Münzen, die sie beim Üben verdienen (Standard: 10 Punkte = 1 Münze, höchstens 40 Münzen pro Tag – im **Menü → Avatar & Münzen** einstellbar, dort auch Shop ein/aus und Bonus-Münzen). Verbundene Kinder haben in Vokaboom und Teilmal denselben Avatar und dieselben Münzen.

**Einrichten:** `supabase/avatar.sql` im SQL Editor ausführen (nach Updates nochmals ganz – bestehende Avatare und Münzen bleiben). Details, Preise und die Schritte für Teilmal: `supabase/AVATAR.md`.
