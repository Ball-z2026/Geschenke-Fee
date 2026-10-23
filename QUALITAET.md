# Qualität der Druckdateien – Stand 14. September 2026

Alle Zahlen stammen aus dem Code (mottos.js, images.js, vectorize.js, artikel.js, server.js),
nicht aus dem Gedächtnis. Wo etwas von einer Railway-Variable oder einer Backend-Wahl abhängt,
steht es dabei.

## 1. Was der Bildserver liefert (Quelle)

| Was | Wert | Woher |
|---|---|---|
| Bildmodell | gpt-image-2.5 (Sunburst), gewählt im Backend oder Variable IMAGE_MODEL am Bildserver | ballz-image-mcp |
| Qualitätsstufe | `high` als Startwert (seit 14. Sept.), im Backend umstellbar (low … max) | IMAGE_QUALITY, BILD_WAHL |
| Hintergrund | Alphakanal direkt (task `design`, background transparent); Chromagrün nur noch für Tests | GRUND_MODUS = alpha |
| Leinwand Standard-Mottos | seit 14. Sept.: **2352 × 3520 px** (größte legale Leinwand im Format 2:3; vorher 1024 × 1536) | grosseLeinwand, LEINWAND=gross |
| Leinwand Platzierungen | quadratisch 2880×2880, quer 3504×2336, hoch 2352×3520 (vorher 1024/1536) | PRINT_PLACEMENTS + grosseLeinwand |
| Leinwand Freestyle / freie Größe | größte legale Leinwand für die Zentimeter, z. B. 25×10 cm → 3840×1536 px, 10×10 cm → 2880×2880 px | druckLeinwand |
| Grenzen des Modells | längste Kante 3840 px, Vielfache von 16, 0,66 bis 8,29 Megapixel, Seitenverhältnis 1:3 bis 3:1 | BILD_GRENZEN |

## 2. Was daraus die Druckdatei wird

| Datei | Entstehung | Maß |
|---|---|---|
| PNG (Master) | Motiv freigestellt (Alphakanal gehärtet, dunkler Hof weg), Schwarz-Regel auf dunklem Textil, Logo in voller Auflösung gesetzt, dann auf 36 × 46 cm bei 300 dpi skaliert (4252 × 5433 px, Seitenverhältnis bleibt). Freestyle/freie Größe: Pixel bleiben, dpi der Fläche werden eingebettet. | dpi im PNG-Kopf, daraus cm |
| SVG | Vektorisierung des Masters mit vtracer bei 2048 px Arbeitsbreite, mehrfarbig, Kurven; Maß in cm vom PNG übernommen | gleich wie PNG |
| PDF | **Vektor**, aus der SVG (rsvg-convert); Varianten mit Namen, Rücken, Brust als Raster aus dem PNG bei dessen dpi | gleich wie PNG |
| Drive-Archiv | PNG + SVG je Design (kein PDF) | |

**Das ist der entscheidende Punkt:** Die 300 dpi der PNG sind ein Skalierungsergebnis. Echt ist,
was das Modell zeichnet. Seit dem 14. September ist das die größte legale Leinwand:

| Druckbreite | echte Pixel je cm | entspricht | vorher (1024 px) |
|---|---|---|---|
| 30,7 cm (Rücken, Hochformat voll) | 77 px/cm | **≈ 195 dpi** | 85 dpi |
| 20 cm (Brust groß, 3504 px quer über 28 cm) | 125 px/cm | ≈ 318 dpi | 139 dpi |
| 10 cm (Brust klein, 2880 px) | 288 px/cm | ≈ 730 dpi | 260 dpi |

Die SVG und die Vektor-PDF haben glatte Kurven, aber nicht mehr Detail als die Zeichnung: eine
Kontur ist glatt, ein Muster im Motiv bleibt so grob, wie das Modell es gezeichnet hat.

Freestyle und freie Größe sind heute schon besser, weil dort die größte legale Leinwand angefordert
wird: 25 × 10 cm kommen mit 390 dpi echt, 10 × 10 cm mit 732 dpi echt.

## 3. Was geprüft wird, bevor etwas ankommt

- Texte im Bild (Rechtschreibung der Pflichttexte), Marken, verbotene Zeichen, Alkohol bei U18 – je Versuch, bis zu 3 Versuche, der beste wird geliefert.
- Motiv am Rand angeschnitten, fast leeres Bild, Namensband zugemalt, Logo-Lücke zu klein.
- Druckdatei: Alphakanal vorhanden, Anteil frei, Chromareste, weiche Kanten (pruefeDruckdatei).
- Dunkle Füllflächen nur als Warnung (Punzen werden nicht automatisch weggerechnet).
- Logo-Upload: Preflight (Pixelgröße, weiße Kästen, weiche Kanten), auf Wunsch Nachzeichnen in 2048 px.
- Kantenlupe: `/api/mo/kante/<id>.png`, Link „Kante prüfen“ auf der Druckseite.

## 4. Verfahren und ihre Grenzen (artikel.js)

| Verfahren | dünnste Linie | kleinste Versalhöhe | Beschnitt |
|---|---|---|---|
| DTF-Transfer (Textil) | 1,5 mm | 3,8 mm | 0 |
| Sublimation | 0,5 mm | 2,5 mm | 3 mm |
| UV-Direktdruck | 0,3 mm | 2,0 mm | 3 mm |

Diese Grenzen gehen bei Freestyle als Pixelwerte in den Prompt. Bei den Standard-Mottos steht
nur die allgemeine Regel (klare Farbflächen, keine Verläufe) im Prompt.

## 5. Umgesetzt am 14. September

- Alle Mottos und Platzierungen auf der größten legalen Leinwand (grosseLeinwand in server.js).
  Rückfall auf die alten 1024er Werte: Railway-Variable LEINWAND=klein.
- Qualitätsstufe `high` als Startwert.
- Kosten: rund das Fünffache an Bildfläche je Bild, also mehr Zeit und Geld je Auftrag.
  Frist je Versuch 260 s, je Auftrag 15 min – beobachten, ob das bei `high` reicht.
