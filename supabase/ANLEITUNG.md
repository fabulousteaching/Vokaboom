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

## Portionen von anderen finden

Oben in der Titelleiste gibt es die Suche „Portionen von anderen suchen“ (am Handy hinter der Lupe). Dort erscheinen nur Portionen, die ihr Besitzer selbst freigegeben hat: **Teilen → „In der Suche zeigen“** (dafür braucht es ein Konto).

- Öffentlich gespeichert wird nur eine Kopie mit Name, Vokabeln und Bildauswahl. Eigene Fotos, der Übungsstand und die E-Mail-Adresse werden **nicht** geteilt; wer eine Portion freigegeben hat, sehen andere nicht.
- Ändert der Besitzer die Portion, wird die Kopie in der Suche ein paar Sekunden später nachgeführt. Schalter aus oder Portion löschen entfernt sie aus der Suche.
- Suchen und „Übernehmen“ geht auch ohne Konto. Übernommene Portionen sind eigenständige Kopien.
- Dafür braucht es die Tabelle `vokabelwelt_public`: einfach `supabase/vokabelwelt.sql` nochmals ganz im SQL Editor ausführen (bestehende Daten bleiben erhalten).
- Unpassende Einträge kannst du in Supabase unter **Table Editor → vokabelwelt_public** löschen.

## Klassen und Kinder-Logins

Mit Konto gibt es auf der Startseite (und unter **Konto**) den Knopf **Meine Klassen**.

1. **Klasse anlegen**, z. B. „5a Englisch“.
2. **Kinder**: Vorname und im kleinen Kästchen den ersten Buchstaben des Nachnamens eintragen – oder eine ganze Namensliste einfügen (eine Zeile pro Kind). Gespeichert wird nur der Vorname und der erste Buchstabe des Nachnamens.
3. Jedes Kind bekommt automatisch einen eigenen **Benutzernamen** (z. B. `Baum34`, nie doppelt vergeben) und ein **Bilder-Passwort** aus 3 Bildern.
4. **Portionen**: anhaken, welche Portionen die Klasse sieht. Kinder sehen nur diese – mit allen Übungen, aber ohne Bearbeiten.
5. **Kärtchen**: als PDF herunterladen (10 pro A4-Seite), ausdrucken, ausschneiden.
6. **Auswertung**: pro Kind und Portion der Anteil richtiger Antworten, wie viele Wörter und Übungen gemacht sind und der beste Test. Antippen eines Kindes zeigt seine schwierigsten Wörter; unten stehen die schwierigsten Wörter der ganzen Klasse.

**Anmelden als Kind:** QR-Code auf dem Kärtchen mit der Kamera scannen – oder auf **Anmelden → Kinder-Login**, Benutzernamen eintippen und die 3 Bilder der Reihe nach antippen. Nach 8 falschen Versuchen ist 5 Minuten Pause. Auf einem Gerät, auf dem eine Lehrperson angemeldet ist, geht das Kinder-Login erst nach dem Abmelden.

**Kärtchen verloren?** Beim Kind auf das Symbol mit den gekreuzten Pfeilen tippen: Es bekommt neue Bilder, das alte Kärtchen gilt nicht mehr.

Dafür braucht es die Tabellen für Klassen: `supabase/vokabelwelt.sql` nochmals ganz im SQL Editor ausführen (bestehende Daten bleiben erhalten).

## Vokaboom-Stimmen (Audio-Speicher)

Angemeldete Lehrpersonen und Kinder mit Klassen-Login hören die vier Vokaboom-Stimmen (britisch Emma/George, amerikanisch Heart/Michael). Wer nicht angemeldet ist, wählt in den Einstellungen eine der besten Stimmen seines Geräts.

- Die Stimmen werden im Browser erzeugt, das dauert pro Wort ein paar Sekunden. Deshalb passiert es nur **einmal**: Öffnet eine angemeldete Lehrperson eine eigene Portion, erzeugt ihr Gerät im Hintergrund alle Wörter mit allen 4 Stimmen und speichert sie im Supabase-Speicher (Bucket `vokaboom-audio`). Oben in der Portion steht der Fortschritt („Aufnahmen werden vorbereitet: 37 von 120“). Seite offen lassen, bis „Alle Wörter sind … gespeichert“ erscheint.
- Beim ersten Mal lädt das Gerät der Lehrperson dafür einmalig ca. 90 MB.
- Kinder-Geräte laden nichts davon: Sie spielen die fertigen Aufnahmen sofort ab. Gibt es für ein Wort noch keine Aufnahme, liest die Gerätestimme.
- Eine Aufnahme ist ca. 40 KB gross. Der Gratis-Speicher von Supabase (1 GB) reicht für viele tausend Wörter.
- Dafür braucht es den Speicher: `supabase/vokabelwelt.sql` nochmals ganz im SQL Editor ausführen.

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
