# Preise

Nachgeschlagen am 23. September 2026, weil Markus gesagt hat: *„Du kannst selbständig die Preise
recherchieren für Polos und alle anderen Artikel. Wir möchten nicht die günstigsten sein, aber
natürlich auch nicht die teuersten. Kunden mit Mehrwertsteuer anzeigen und bei Firmenkunden immer
die Nettopreise."*

Die Zahlen stehen in `preise.cjs` – **eine Quelle für Server und Browser**. Hier steht, **woher**
jede Zahl kommt. Wer eine ändert, ändert sie erst hier.

## Die Regel

Markus' Satz ist eine Positionierung, keine Formel: **nicht der billigste, nicht der teuerste.**
Übersetzt heißt das für jeden Artikel: wir schauen nach, was ein vergleichbares, einzeln
personalisiertes Stück in Deutschland kostet, und legen uns in die obere Mitte dieser Spanne. Nicht
in die untere – wir zeichnen jedes Motiv selbst, das ist kein Massendruck mit Namensfeld.

## Textilien

Drei Stufen, weil dahinter drei echte Marken stehen: Starter = Roly, Liebling = B&C,
Deluxe = Stanley/Stella (bio).

| Artikel | Starter | Liebling | Deluxe | Woher |
|---|---|---|---|---|
| Shirt | 19,90 | 24,90 | 32,90 | Preisvorgabe, unverändert |
| **Polo** | **24,90** | **29,90** | **39,90** | **neu, siehe unten** |
| Hoodie | 39,90 | 49,90 | 64,90 | Preisvorgabe, unverändert |
| Zip-Jacke | 42,90 | 52,90 | 69,90 | Preisvorgabe, unverändert |

**Polo (neu am 23. Sept.):** Das Polo war im Konfigurator zu sehen, hatte aber keinen Preis – es
wäre mit 0,00 € im Warenkorb gelandet. Markt für ein einzeln bedrucktes Polo: Shirtlabor nennt
14,90–29,90 als Textilgrundpreis zuzüglich Druck, Tshirtdeal beginnt bei rund 12 € im Bulk. Einzeln
und bedruckt landet man im deutschen Handel bei 25–35 €. Unser Liebling liegt mit 29,90 mittendrin,
also genau 5 € über dem Shirt – derselbe Abstand, den das Polo im Einkauf auch hat.

## Merch

| Artikel | Preis | Marktanker | Quelle |
|---|---|---|---|
| Sticker-Pack | 7,90 | – | Preisvorgabe |
| **Gepäckanhänger** | **11,90** | Aluminium 6,4 × 11,1 cm: **10,40** | PrinterStudio |
| Tasse | 14,90 | – | Preisvorgabe |
| Beutel | 14,90 | – | gleiche Klasse wie die Tasse |
| Poster (A2) | 16,90 | – | Preisvorgabe |
| **Brotdose** | **17,90** | Kunststoff **12,90**, Mepal Bento **29,90**, Alu **29,90** | PrintPlanet |
| **Türschild** | **19,90** | PVC graviert **ab 7**, Metall **ab 29,95**, Holz **ab 39,95** | exaschilder, Herzensprojekt |
| **Napfunterlage** | **19,90** | 45 × 25 cm **17,99** (regulär 20,95) | ROSSMANN Fotowelt |
| **XXL-Mousepad** | **25,90** | **20,95 bis 29,90** | Tassendruck (ab-Preis, vier Groessen) · Mauspad-Zone (genau 70×30) |
| **Acrylbild (A4)** | **24,90** | Direktdruck **ab 15,95**, Gallery-Bond **ab 29,95** | Kartenliebe |
| Kissen | 24,90 | – | Preisvorgabe |
| **Hundedecke** | **24,90** | in dieser Größe **ab 17,95** | Contrado |
| **Handtuch** | **26,90** | 50 × 100 cm **ab 25,90** | PrintPlanet |
| **Fußmatte** | **27,90** | 60 × 40 cm **24,95** | Personello |
| **Schneidebrett** | **32,90** | Buche 40 × 30 **29,90**, Bambus mit Baumkante **36,90** | Laserliebe |
| **Strandtuch** | **34,90** | Duschtuch 70 × 140 **ab 39,90** | PrintPlanet |

Fett = am 23. Sept. neu gesetzt oder geändert. Die vier Zeilen ohne Anker (Tasse, Kissen, Poster,
Sticker) stammen aus der ersten Preisvorgabe und wurden nicht angefasst.

### Was sich geändert hat und warum

- **Elf Artikel hatten ein Mockup, aber keinen Preis** – Polo, Fußmatte, Handtuch, Mousepad,
  Hundedecke, Acrylbild, Türschild, Schneidebrett, Napfunterlage, Gepäckanhänger, Brotdose. Sie
  waren im Konfigurator sichtbar und hätten mit 0,00 € abgerechnet werden müssen. Das ist der
  eigentliche Fund dieser Recherche.
- **Strandtuch 32,90 → 34,90.** Ein Duschtuch 70 × 140 beginnt im Markt bei 39,90; wir lagen
  darunter. Jetzt liegen wir sichtbar unter dem Marktpreis, aber nicht als Billiganbieter.
- **Acrylbild 29,90 → 24,90.** Zuerst hatte ich 29,90 aus dem Schneidebrett abgeleitet, ohne
  nachzusehen. Nachgeschlagen liegt der Direktdruck bei 15,95 und erst die Gallery-Bond-Fassung bei
  29,95 – 29,90 wäre also der Preis der teuersten Machart gewesen. 24,90 liegt dazwischen.
- **Gepäckanhänger 9,90 → 11,90.** Ebenfalls zuerst geraten („kleinster Artikel im Sortiment").
  Ein einzelner personalisierter Aluminium-Anhänger kostet 10,40 – mit 9,90 wären wir der
  billigste gewesen, und genau das wollen wir nicht.

Die letzten beiden Punkte stehen hier, weil sie zeigen, was passiert, wenn man einen Preis aus einem
anderen Artikel „ableitet", statt nachzusehen: einmal 5 € zu teuer, einmal zu billig. Es steht jetzt
hinter **jedem** Merch-Preis eine nachgeschlagene Zahl.

## Was noch keinen Preis hat – und warum das in Ordnung ist

Der Katalog (`freestyle/artikel-katalog.json`) führt 34 Artikel, die Preisliste 20. Die Brücke ist
`ansichtVon()` in `artikel.js`: der Katalog heißt `shopper`, die Preisliste `beutel`; `tshirt`
heißt dort `tee`. **Jeder Katalogartikel, der eine Ansicht hat, findet darüber seinen Preis** –
geprüft in Abschnitt 5 der Abnahme.

Ohne Preis sind nur die **fünfzehn Artikel ohne Mockup** (Thermobecher, Trinkflasche,
Schlüsselanhänger, Handyhülle, Socken, Cap, Schürze, Hundemarke, Futternapf, Puzzle, Untersetzer,
Magnet, Weihnachtsanhänger, Bandana, Geschenkschild) – Aufgabe 71 – und die Postkarte, die ihren
eigenen Weg hat. Ohne Vorlage sind sie nicht bestellbar; der Preis kommt zusammen mit dem Mockup,
und zwar nach derselben Regel wie hier.

## Die Abnahme misst das jetzt

Der Fund „elf sichtbare Artikel ohne Preis" wäre keinem aufgefallen, bis die erste Bestellung über
0,00 € hereingekommen wäre. Darum steht das jetzt in `abnahme.mjs`, Abschnitt 5:

1. **Jeder Artikel mit Mockup hat einen Preis.**
2. **Jeder Katalogartikel mit Ansicht findet über `ansichtVon()` seinen Preis.**
3. **Jedes Textil hat alle drei Stufen** – fehlt eine, fällt `listenpreis()` still auf „Liebling"
   zurück, und der Kunde zahlt für Deluxe den mittleren Preis.
4. **netto + MwSt ergibt wieder brutto**, und die Firmenansicht rechnet denselben Bruttobetrag wie
   die Privatansicht.
5. **Die Mottoseite kennt die Nettoansicht** und weist die MwSt aus.

## Staffel, zweite Seite, Versand

Unverändert aus der Preisvorgabe:

| Ab Stück | Rabatt |
|---|---|
| 5 | 8 % |
| 10 | 12 % |
| 20 | 18 % |
| 25 | 22 % |
| 50 | 28 % |

- Die Staffel zählt **nur Textilien**. Zehn Tassen heben den Rabatt aufs Shirt nicht.
- Zweite Druckseite: 4,90 € je Stück, **ohne** Rabatt, nur bei Shirt/Hoodie/Zip/Polo.
- Versand 4,90 €, frei ab vier Artikeln oder 79 € Warenwert. Dafür zählen **alle** Artikel.

**Die Rundungsregel ist keine Kleinigkeit:** der Stückpreis wird **erst** auf zwei Stellen gerundet,
**dann** mit der Menge multipliziert. Nur so geht die Gegenrechnung der Vorgabe auf
(25 × (19,42 + 4,90) = 608,00). Andersherum wären es 607,97.

## Mehrwertsteuer: brutto für Private, netto für Firmen

Das ist keine Geschmacksfrage, sondern Recht:

- **Gegenüber Verbrauchern muss der Gesamtpreis inklusive Umsatzsteuer stehen** (Preisangaben­-
  verordnung, § 3). Eine Nettoangabe als Hauptpreis wäre abmahnfähig.
- **Gegenüber Unternehmern** darf und soll netto ausgezeichnet werden – der Firmenkunde zieht die
  Vorsteuer, für ihn ist der Nettopreis der Preis.

### Wie wir rechnen

**Brutto bleibt die Quelle. Netto wird daraus gerechnet, nicht umgekehrt.**

```
netto(brutto) = runden(brutto / 1,19)
MwSt          = Gesamt brutto − Gesamt netto
```

Der Grund steht im Code, aber er ist wichtig genug für hier: rechnete man je Posten netto und
addierte auf, stünde beim Privatkunden am Ende **24,89 €** statt der **24,90 €**, die er in der
Liste gesehen hat. Die Umsatzsteuer ist deshalb die **Differenz zum Bruttogesamtbetrag**, nicht die
Summe der Einzelsteuern. Damit stimmt jede Zeile mit dem überein, was auf der Seite stand.

`warenkorb()` liefert immer **beides** mit – `ware/versand/gesamt` (brutto) und
`wareNetto/versandNetto/gesamtNetto/mwst` –, damit keine Seite selbst rechnen muss. Mit
`warenkorb(pos, { netto: true })` kommen zusätzlich `stueckNetto`, `seite2Netto` und `summeNetto`
je Posten dazu; das ist die Firmenansicht.

Probe (25 Polos, Stufe Liebling, mit zweiter Seite):

```
BRUTTO  Ware 612,80 € · Versand 0,00 € · Gesamt 612,80 €
NETTO   Ware 514,96 € · Gesamt 514,96 € + MwSt 97,84 € = 612,80 €
Polo Stück (25 Stk, 22 % Staffel): 23,32 € · netto 19,60 €
```

### 24. September: der Anker ohne Groesse

Markus: *"Das Mauspad in der Groesse kommt mir sehr guenstig vor."* Er hatte recht, und der
Fehler lag in dieser Datei: als Anker stand hier **"Tassendruck 20,95" ohne die Groesse**.
Das ist ein **ab**-Preis fuer vier verschiedene Groessen – wir hatten also gegen den Einstieg
gerechnet und verkaufen die grosse Flaeche. Ein Anbieter, der genau unser Format 70×30 fuehrt,
nimmt 29,90. Mitte der beiden Anker rund 25,40, neuer Preis **25,90**.

**Lehre fuer jede weitere Preisrecherche:** Ein Marktpreis ohne die Groesse, auf die er sich
bezieht, ist kein Anker. "ab" gehoert dazugeschrieben. Die Spalte heisst deshalb jetzt
nicht mehr nur "Markt", sondern nennt Spanne und Bezug.

## Quellen

- [Shirtlabor – Poloshirt bedrucken](https://www.shirtlabor.de/poloshirts-bedrucken) (Textilgrundpreis Polo)
- [Tshirtdeal – Poloshirt bedrucken](https://www.tshirtdeal.de/poloshirt-bedrucken) (Mengenpreise Polo)
- [Personello – Fußmatte mit Foto](https://www.personello.de/) (60 × 40 cm, 24,95)
- [PrintPlanet – Handtuch mit Namen](https://www.printplanet.de/handtuecher.html) (50 × 100 ab 25,90, Duschtuch 70 × 140 ab 39,90)
- [PrintPlanet – Brotdose mit Namen](https://www.printplanet.de/produkte/brotdose-mit-namen.html) (Kunststoff 12,90, Mepal Bento 29,90, Alu 29,90)
- [Tassendruck – XXL-Mousepads in vier Groessen](https://tassendruck.de/XXL-Mousepads-selbst-gestalten-in-vier-Groessen) (20,95 – **ab**-Preis, 60×35 bis 90×40)
- [Mauspad-Zone – personalisiertes Mauspad 70×30](https://mauspad-zone.com/products/personalisierte-mauspad-mit-foto-l-70x30cm) (29,90 – genau unser Format)
- [Contrado – Hundedecke personalisiert](https://www.contrado.de/hundedecken) (ab 17,95)
- [Laserliebe – Schneidebrett mit Gravur](https://laserliebe.de/) (Buche 40 × 30 29,90, Bambus 36,90)
- [Kartenliebe – Acrylglasbilder](https://www.kartenliebe.de/acrylglas/) (Direktdruck ab 15,95, Gallery-Bond ab 29,95)
- [ROSSMANN Fotowelt – Fressnapfunterlage](https://www.rossmann-fotowelt.de/detail/fressnapfunterlage) (45 × 25 cm 17,99 statt 20,95)
- [PrinterStudio – personalisierte Kofferanhänger](https://www.printerstudio.de/fotogeschenke/personalisierte-kofferanhanger.html) (Aluminium 6,4 × 11,1 cm, 10,40)
- [exaschilder – Türschild](https://exaschilder.de/turschild/) (PVC/Plexiglas graviert ab 7)
- [Herzensprojekt – Türschilder](https://www.herzensprojekt.de/collections/tuerschilder-familie) (Metall ab 29,95, Holz ab 39,95)
- [Preisangabenverordnung § 3 – Gesamtpreis gegenüber Verbrauchern](https://www.gesetze-im-internet.de/pangv_2022/__3.html)
