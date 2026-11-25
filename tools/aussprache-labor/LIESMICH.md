# Aussprache-Labor

Mess- und Lernwerkzeug für die Lauterkennung (`js/phonetic.js`). Läuft nur auf dem Entwicklungsrechner, nicht in der App.

- `gen.py` erzeugt mit Computerstimmen (piper) eine Testsammlung: jedes Wort aus `words.txt` von vielen Stimmen
  richtig gesprochen (auch höher gestellt als „Kinderstimme“) und mit typischen Fehlern (th→s, w→v, falscher Vokal …).
  Gespeichert werden nur die Wahrscheinlichkeiten des Modells, keine Aufnahmen von Menschen.
- `gen_de.py` lässt deutsche Stimmen die englischen Wörter „auf Deutsch“ lesen.
- `ev.mjs` bewertet die Sammlung mit dem echten Code aus `js/phonetic.js`.
- `learn.py conf rival eval` misst, was das Modell selbst bei richtiger Aussprache verwechselt (`EN_CONF`), bestimmt
  die Grenzen je Gegenkandidat (`PH_RIVAL_T`), schreibt beides in `js/phonetic.js` und zeigt die Trefferquoten
  (getrennt für Lern-Wörter und für Wörter, die beim Lernen nicht dabei waren).

Die Pfade in den Skripten zeigen auf einen Arbeitsordner mit dem Modell (`model.onnx`), charsiu-js und den piper-Stimmen.
Grenze des Verfahrens: Es sind Computerstimmen. Echte Kinderstimmen mit deutschem Akzent können sich anders verhalten.
