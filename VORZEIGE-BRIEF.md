# Vorzeige-Designs (Stil-Galerie) – Brief für die neuen Mottos

Es fehlen die Vorzeige-Bilder für **zwei** Mottos:

- `geburt-baby` (Geburt / Baby)
- `fan-shirt` (Lieblingsverein)

Alle anderen 19 Mottos sind bereits in `vorzeige-designs.json` hinterlegt.

## So läuft es (wie bei den anderen Mottos)

1. Du erzeugst je Motto **11 Bilder** – für jeden Stil eines – mit den unten
   angegebenen Eingaben. Es sind die **Original-Prompts der Seite**, du
   gibst also einfach die Werte auf der jeweiligen Motto-Seite ein und
   wählst nacheinander jeden der 11 Stile.
2. Jedes fertige Bild bekommt eine Bild-ID (die Datei liegt unter
   `https://mcp.markusassemacher.de/generated/<ID>.png`).
3. Diese IDs trägst du in `vorzeige-designs.json` unter `mottos.<slug>.styles`
   ein (Skelette unten). Beim nächsten Start importiert Motto Otto sie
   automatisch in die Stil-Galerie.
4. Empfohlene Dateibenennung (nur Konvention, für dich zur Übersicht):
   `vorzeige_geburtbaby_<stil>.png` bzw. `vorzeige_fanshirt_<stil>.png`
   (Motto-Slug ohne Bindestrich). Verlinkt wird intern über die ID.

Die **11 Stile** (Reihenfolge wie überall):
`standard` (Wie vorgesehen), `streetart`, `meisterwerk`, `minimal`,
`popart`, `vintage`, `tattoo`, `comic`, `japan`, `college`, `neon`.

---

## 1) Geburt / Baby (`geburt-baby`)

**Textil-Empfehlung:** hell (die zarte Pastell-Optik wirkt auf Weiß am besten)

**Eingaben (auf der Motto-Seite eintippen):**

| Feld | Wert |
|------|------|
| Überschrift / Spruch | `Willkommen auf der Welt` |
| Name des Babys | `Emma` |
| Geburtsdatum | `08.09.2026` |
| Uhrzeit | `07:14` |
| Gewicht | `3480 g` |
| Größe | `52 cm` |
| Geburtsort (optional) | `Bremen` |

> Der Geburtsort erzeugt automatisch das kleine GPS-Koordinaten-Abzeichen –
> für die Galerie ruhig ausfüllen, dann sieht man das Feature.

**Danach in `vorzeige-designs.json` unter `mottos` einfügen:**

```json
"geburt-baby": {
  "values": {
    "spruch": "Willkommen auf der Welt",
    "babyname": "Emma",
    "geburtsdatum": "08.09.2026",
    "uhrzeit": "07:14",
    "gewicht": "3480 g",
    "groesse": "52 cm",
    "geburtsort": "Bremen"
  },
  "textile": "hell",
  "styles": {
    "standard": "",
    "streetart": "",
    "meisterwerk": "",
    "minimal": "",
    "popart": "",
    "vintage": "",
    "tattoo": "",
    "comic": "",
    "japan": "",
    "college": "",
    "neon": ""
  }
}
```

---

## 2) Lieblingsverein (`fan-shirt`)

**Textil-Empfehlung:** dunkel (kräftige Vereinsfarben kommen auf Schwarz gut)

**Eingaben (auf der Motto-Seite eintippen):**

| Feld | Wert |
|------|------|
| Dein Lieblingsverein | `HSV` |
| Stadt (optional) | `Hamburg` |
| Fan-Spruch (optional) | `Hier schlägt mein Herz` |

> Otto recherchiert daraus Stadt + Vereinsfarben und baut ein
> **lizenzfreies** Design (kein Wappen/Logo/Maskottchen/Sponsor).
> **Wichtig:** Der Vereinsname wird **nicht** gedruckt (Markenschutz) – auf
> dem Design steht die **Stadt** (hier „Hamburg") plus optional der Spruch.
> Das Feld „Verein" dient nur der Recherche.

**Danach in `vorzeige-designs.json` unter `mottos` einfügen:**

```json
"fan-shirt": {
  "values": {
    "verein": "HSV",
    "stadt": "Hamburg",
    "spruch": "Hier schlägt mein Herz"
  },
  "textile": "dunkel",
  "styles": {
    "standard": "",
    "streetart": "",
    "meisterwerk": "",
    "minimal": "",
    "popart": "",
    "vintage": "",
    "tattoo": "",
    "comic": "",
    "japan": "",
    "college": "",
    "neon": ""
  }
}
```

---

## Kontrolle nach dem Einpflegen

- `count` oben im Manifest ggf. um 2 erhöhen (kosmetisch, kein Muss).
- Nach dem Deploy im Backend unter **„Vorzeige-Designs · Stil-Galerie"**
  prüfen: beide Mottos sollten je 11 Beispiele zeigen.
- `/health` sollte weiterhin `vektor: true` melden.
