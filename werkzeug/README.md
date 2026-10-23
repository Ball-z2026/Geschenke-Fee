# Werkzeug: Masken fuer neue Vorlagen (22. Sept.)

Aufruf aus dem Projektwurzelverzeichnis, Ausgabe immer 1024 x 1024, weiss = bedruckbar.

- `node werkzeug/maske-weiss.mjs <foto.jpg> <maske.png> [x0 x1 y0 y1]` - weisses Teil auf farbigem
  Grund (Tuch im Sand, Decke im Korb). `HELL=205 SAT=0.10` schaerft die Schwelle.
- `node werkzeug/maske-magenta.mjs <magenta.jpg> <maske.png>` - aus der Magenta-Fassung des Fotos
  (Bildmodell malt die Flaeche magenta, edit_ballz_image). `LOECHER=0` laesst Loecher offen
  (Aufhaengeloch im Brett).
- `node werkzeug/maske-viereck.mjs <maske.png> <maske.png>` - rechteckige Flaeche: die vier Ecken
  als Viereck fuellen (angebissene Ecke, Poster im Rahmen).
- `node werkzeug/tasse-messen.mjs <maske.png>` - Zylindermodell einer Tasse aus der Koerpermaske
  (cx, R, Trinkrand, Boden, Henkelkerben) fuer BOX_OVERRIDES.
