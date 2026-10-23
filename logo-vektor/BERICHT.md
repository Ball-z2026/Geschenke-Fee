# Motto-Otto-Logo vektorisiert – Bericht (13. September 2026)

Auftrag: „AUFTRAG AN CODE – Motto-Otto-Logo freistellen und vektorisieren“ (Drive-Ordner
FÜR CODE – Motto Otto Fassung 5+6). Eingang war `logo-source.png` aus dem Repo: die rechte
Fassung auf Weiß, 594 × 607 px, Hintergrund 254/254/254 – dieselbe Datei, aus der der Server
beim Start das Seitenlogo baut. Werkzeug: `werkzeug/logo-vektorisieren.mjs`, reproduzierbar mit

```
node werkzeug/logo-vektorisieren.mjs logo-source.png logo-vektor
```

## Ergebnis in diesem Ordner

| Datei | Inhalt |
|---|---|
| `MottoOtto-Logo.svg` | die Vektordatei, 46 Pfade, 11 Farben, viewBox 2024 × 2344 |
| `MottoOtto-Logo.pdf` | aus der SVG (rsvg-convert), eine Seite, Vektor |
| `MottoOtto-Logo-4000.png` | aus der SVG gerendert, transparent |
| `MottoOtto-Logo-1000.png` | aus der SVG gerendert, transparent |
| `MottoOtto-Logo-512.png` | Web und Favicon-Quelle, aus der SVG |
| `MottoOtto-Logo-farben.md` | die Markenfarben als Hex, aus der bereinigten SVG |
| `kontrolle-weiss/-schwarz/-magenta.png` | die SVG auf den drei Untergründen |
| `kontrolle-vergleich.png` | Original (links) neben der Vektorfassung (rechts) auf Magenta |

## Was gemacht wurde – und was anders lief als im Auftrag beschrieben

**Freistellen** wie beschrieben: vom Rand geflutet ab Schwelle 242, eine Pixelreihe Gauß 0,6 mit
hartem Schnitt unter Alpha 40, Farbe 3 px nach außen gezogen, dann 4x Lanczos.

**Farben.** Mit den vtracer-Werten aus dem Auftrag kamen aus dem Pixelbild 4.489 Farben und
9.189 Pfade heraus (4,6 MB) – das Bild trägt weiche Schattierungen und Antialiasing, und vtracer
legt für jede Mischung eine Schicht an. Deshalb wird vor dem Vektorisieren auf Volltonfarben
gebracht, in zwei Durchgängen: Flächenpixel bekommen die nächste Palettenfarbe; Kantenpixel
(Mischungen wie Schwarz+Haut = Braun) dürfen nur eine Farbe nehmen, die im Umkreis als Fläche
vorkommt. Ohne diese Regel entsteht an jeder schwarzen Kontur ein oliv- oder pinkfarbener Saum,
gemessen und gesehen. Die Palette wird nur aus Flächen gelernt, nicht aus Kanten. Die aus dem
Auftrag gemessenen Farben (Brillengläser 226/250/227, Creme, Keyline) sind als Pflichtfarben
gesetzt – der Quantisierer hätte die Brillengläser sonst ins Keyline-Grau gelegt.

**filter_speckle 16 statt 2.** Der Wert im Auftrag gilt für das Originalmaß; nach 4x
Hochskalierung ist ein Originalpixel 16 Pixel groß. Mit 2 oder 4 bleiben Krümel aus der
Quantisierung stehen (625 Pfade), mit 16 sind es 46.

**Der Fingerabdruck auf dem Daumen ist eine Rekonstruktion.** Im Original sind das Linien von
einem Pixel Breite in einem 40 Pixel großen Feld. Das liegt unter dem, was sich nachvektorisieren
lässt: vtracer macht daraus einen braunen Fleck, egal welche Einstellung. Darum ersetzt das
Werkzeug den Fleck durch fünf konzentrische, unterbrochene Ringe in derselben Farbe (#9c8474),
an derselben Stelle und mit derselben Neigung, gemessen aus dem Pixelbild. Das ist gezeichnet,
nicht nachgezeichnet. Wer den Abdruck lieber weglässt: die Gruppe `<g fill="none"
stroke="#9c8474" …>` am Ende der SVG löschen.

## Die fünf Prüfstellen aus dem Auftrag

1. Farben: 11, keine Doppelgrüns, Liste in `MottoOtto-Logo-farben.md`.
2. Punzen in M, O, T und OTTO: echte Löcher, auf Magenta geprüft.
3. Äußerer Keyline: durchgehend, ein Pfad.
4. Daumen und Brille: Brille mit Minttönung erhalten, Daumenabdruck siehe oben.
5. Schrift „MOTTO OTTO“: Pfad, keine Systemschrift.

Kontrolle auf Weiß, Schwarz und Magenta: kein heller Saum, keine vergessene weiße Füllung.

## Grenze

Die Quelle hat 504 px. Kappenform, Brillenrundung und Konturstärken stimmen mit dem Original
überein, feine Binnenzeichnung (Falten im Shirt, Schattierungen) ist zu Volltonflächen
geworden – das ist bei einer flachen Comic-Grafik gewollt. Die Originaldatei vom Gestalter (AI,
EPS, SVG) bleibt die bessere Quelle, falls sie auftaucht.
