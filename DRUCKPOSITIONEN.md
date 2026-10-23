# Druckpositionen auf Textilien

Nachgeschlagen am 23. September 2026, weil Markus gesagt hat: *„Beim Polo kommt wenn ein kleiner
Druck vorne auf die Brust, auf die Herzseite"* und *„Recherchiere bitte ebenso über Positionen bei
Textilien und speicher dir das ab."*

Das hier ist die Grundlage für `GARMENTS` in `mockups.js` (Druckflächen und Brustzonen) und für
alles, was wir später an Positionen anbieten. Wer eine Zahl ändert, ändert sie hier zuerst.

## Wie gemessen wird

Die Branche misst **senkrecht von der Unterkante der Kragennaht** bis zum Motiv und **waagerecht
von der Textilmitte** bis zum Motivrand. Nicht von der Schulter, nicht von der Oberkante.

## Die Positionen und ihre Maße

| Position | Abstand Kragennaht → Motiv | Breite |
|---|---|---|
| **Brust links (Herzseite)** | ca. 17 cm bis zur **waagerechten Mittelachse** des Motivs | 8–10 cm |
| **Brust mittig, schmal** | ca. 10 cm bis zur waagerechten Mittelachse | bis ca. 20 cm |
| **Front groß** | ca. 6 cm bis zur **Oberkante** des Motivs | bis Druckfläche |
| **Rücken groß** | ca. 10 cm bis zur Oberkante | bis Druckfläche |
| **Nacken** | ca. 3 cm bis zur Oberkante | klein, mittig |
| **Ärmel** | ca. 2 cm über der Ärmelborte bis zur **Unterkante** | max. 10 cm (Siebdruck) |

Die Herzseite ist die **linke Brust des Trägers** – auf einem Produktfoto von vorn liegt sie also
**rechts im Bild**. Senkrecht sitzt sie mittig unter der linken Kragenrundung.

## Poloshirt

Das Polo ist der Sonderfall, und genau daran sind wir hängengeblieben: **mittig läuft die
Knopfleiste**, ein großes Frontmotiv reitet darauf. Darum gilt:

- Die Vorderseite wird **nur unterhalb bzw. neben der Knopfleiste** veredelt.
- Gemessen wird beim Polo **von der Knopfleiste**, nicht von der Textilmitte:
  **ca. 5 cm Abstand zwischen Knopfleiste und Motivrand**.
- Waagerecht mittig zur Unterkante der Knopfleiste (große Fassung) bzw. bündig zur Unterkante
  (schmale Fassung).
- Bei **Damen-Poloshirts** darf das Motiv auf der Brust **nicht größer als 8 cm** sein.

**Unsere Regel:** Auf dem Polo ist der Frontdruck der Brustdruck – links, rund 10 cm breit.
Hinterlegt als `GARMENTS.polo.brustLinks` (Anteil der Druckfläche, damit die Stelle auf jeder
Vorlage stimmt, auch auf den Herstellerfotos von B&C und Stanley/Stella).

## Hoodie

- Mit Kängurutasche: **kein Bauchdruck**, und die Motivhöhe auf der Vorderseite liegt bei
  **max. 25 cm** – darunter beginnt die Tasche.
- Die Brustzone sitzt zwischen Kapuzenansatz und Tasche (siehe `LOGO_BRUST_ZONE` in `mockups.js`).

## Druckgrößen

Die Position sagt, *wo* – die Größe sagt, *wie groß*. Beides muss stimmen, sonst sitzt ein
Briefmarkenmotiv auf einer freien Brust.

| Position | Motivbreite Erwachsene |
|---|---|
| **Frontprint groß** | 24–32 cm, klassisch **25–30 cm** |
| **Brustdruck links** | 7–10 cm (Stickerei max. 29 cm breit, max. 12 cm hoch) |
| **Rückendruck** | 26–34 cm |
| **Ärmel** | 6–9 cm |
| **Nacken** | 5–8 cm |

Siebdruck-Brustdruck maximal 32 × 26 cm. **Kindershirts bekommen kleinere Motive** – feste
Zentimeterwerte nennt keine der Quellen, die Größe wächst nicht linear mit der Konfektionsgröße,
und die Hersteller fallen unterschiedlich aus. Wer das ernsthaft je Größe staffeln will, muss es
am echten Textil prüfen; hier steht kein erfundener Wert.

## Hell oder dunkel – wann kommt welches Textil?

Das war bei uns keine Entscheidung, sondern eine Gewohnheit: **25 von 28 Mottos standen auf
Dunkel**, und die einzige Ausnahme hieß überall „aquarell". Markus, 23. Sept.: *„Du hast einfach
immer dunkles Textil, du machst dir gar keine Gedanken."* Er hat recht. Was die Drucktechnik dazu
wirklich sagt:

**Auf dunklem Stoff** liegt unter jedem Motiv ein **Weißunterdruck**, sonst deckt keine Farbe.
Darum gilt dort:
- Warme und satte Töne funktionieren: Gelb, Orange, Magenta, Türkis, kräftiges Grün leuchten.
- **Pastell verliert seine Kraft** – Hellblau wirkt grau.
- **Dunkle Töne haben keinen Kontrast** und verschwinden im Stoff.
- **Harte Kanten und klare Farbblöcke** wirken kräftiger als weiche Aquarell-Verläufe.
- Feine Linien verdicken (über 0,5 mm), Schatten verstärken statt sanft auslaufen lassen.

**Auf hellem Stoff** ist es umgekehrt: dort verschwindet alles Weiße und sehr Helle, und dieselbe
hochgesättigte Datei, die auf Schwarz knallt, wirkt überspitzt.

**Unsere Regel, und sie hängt an Markus' Grundsatz:** *„Wir machen Designs, die nicht vollflächig
bedruckt sind, und das ist auch gar nicht nötig. Wir schaffen im Design Platz für kleine
Aussparungen."* Genau deshalb ist die Stofffarbe kein Hintergrund, sondern **Teil des Bildes** –
sie scheint durch jede Lücke. Daraus folgt dreierlei:

1. **Die Lücken müssen offen bleiben.** Eine deckende Platte in Stofffarbe hinter dem Motiv (ein
   schwarzer Kasten auf Schwarz, ein weißer auf Weiß) füllt genau das zu, was das Design ausmacht.
   Das verbietet die Schwarz-Regel in `mottos.js` – und genau das ist bei Abi · Graffiti passiert.
2. **Der Stil entscheidet das Textil, und zwar vorher.** Das war lange falsch herum: Ich habe
   viermal versucht, das richtige Textil am *fertigen* Bild zu messen. Alle vier Messungen waren
   unbrauchbar, weil sie dunkle Konturlinien bestrafen, die auf Schwarz genau richtig sind.
   Markus, 23. Sept.: *„Wenn du doch ein Design selber erstellst, musst du auch wissen, ob du es
   für hell oder dunkel gemacht hast – ist doch alles ganz einfach."* Er hat recht: das Textil ist
   keine Eigenschaft des fertigen Bildes, sondern **die Entscheidung, die vor dem Zeichnen fällt,
   weil sie die Palette bestimmt.** Sie steht deshalb je Stil in `STIL_TEXTIL` (`mottos.js`) und
   ist aus dem Palettentext des Stils selbst begründet.
3. **Was auf beiden Stoffen schlecht aussieht, wird neu gezeichnet.** Umschalten hilft da nicht.

### Die Tabelle

Vorher standen 25 von 28 Mottos auf Dunkel, und von siebzehn Stilen bekam genau **einer**
(Aquarell) ein helles Textil – als handgetippte Zeile `var NUR_HELL = { aquarell: true }` im
Browserskript. Jetzt steht es für alle vierzehn wählbaren Stile fest, sieben zu sieben:

| Stil | Textil | Der Satz aus dem Stil, der den Ausschlag gibt |
|---|---|---|
| **Meisterwerk** | hell | „MOOD IS BRIGHT: warm cream, ivory and sunlit ochre dominate" |
| **Pop-Art** | hell | „flat unmixed primary colours … **on off-white**" |
| **Vintage** | hell | „sun-bleached and muted: cream, mustard, rust, olive – never bright" |
| **Tattoo** | hell | „bold, even, uniform **black** outlines, solid **black** shading" |
| **Comic** | hell | „heavy spot blacks for shadows" – Tinte auf Papier |
| **Japan** | hell | „visible woodgrain and **paper texture**, bold black key-block outlines" |
| **Aquarell** | hell | „the lightest values are **bare untouched paper**" |
| **Street Art** | dunkel | „hard white **against deep black** so they punch" |
| **Graffiti** | dunkel | „Around the word there is nothing – **the fabric is the wall**" |
| **Minimalistisch** | dunkel | „exactly two colours (**off-white** plus one accent)" |
| **College** | dunkel | „two school colours (navy and gold, or maroon and cream) plus off-white" |
| **Fotorealistisch** | dunkel | „its own materials are lit bright … **against dark fabric**" |
| **Neon** | dunkel | „lit from within like a neon sign **at night**" |
| **Robotic** | dunkel | „chrome and gunmetal … **glowing** circuit traces" |

Nicht in der Tabelle: **Wie vorgesehen** (der Stil hat keine eigene Palette, da entscheidet das
Motto) sowie **Ansichtskarte** und **Retro-Reiseposter** – Postkartenstile, die vollflächig
gedruckt werden, wo also gar kein Stoff durchscheinen kann.

Die Regel gilt an drei Stellen gleichzeitig: die Mottoseite stellt die Kachel ein und sperrt die
andere, der Server rechnet sie im Auftrag noch einmal nach (damit sie auch für Aufträge gilt, die
nicht über die Seite kommen), und die Vorzeige-Galerie liest sie, statt still auf „dunkel"
zurückzufallen. Abschnitt 4 der Abnahme misst alle drei.

## Was daraus für uns folgt

1. **Eine Position ist eine Eigenschaft des Teils, keine Kundenwahl.** Auf einem Polo gibt es
   keinen großen Mitteldruck – nicht weil wir ihn nicht anbieten wollen, sondern weil dort die
   Knopfleiste ist.
2. **Maße gehören als Anteil der Druckfläche in den Code**, nicht als Pixel. Die Herstellerfotos
   (B&C, Stanley/Stella) haben leicht andere Flächen; ein Pixelwert stimmt dann nur auf einer
   Vorlage.
3. **Wer die Rechnung ändert, muss den Mockup-Stand hochzählen** (`MOCKUP_STAND` in `mockups.js`),
   sonst liegen die alten Bilder weiter auf dem Volume und die Änderung ist unsichtbar. Genau das
   ist beim Poster passiert.

## Quellen

- [Stick & Druck24 – Druck- und Stickpositionen](https://stickunddruck24.de/druck-und-stick-positionen/) (die konkreten Zentimeter-Angaben oben)
- [Textil-Großhandel – Druckpositionen](https://www.textil-grosshandel.eu/textildruck/druckpositionen/) (Damen-Polo max. 8 cm, Ärmel max. 10 cm, Hoodie-Bauchtasche max. 25 cm, Messsystem)
- [DTF Turbo – Druckpositionen auf Textilien](https://dtfturbo.de/blogs/wissen-praxis/druckpositionen-textilien-motiv-platzierung) (Positionsübersicht, kein Bauchdruck beim Hoodie)
- [Kunstdrucke-Textildruck – Druckgrößen-Rechner](https://www.kunstdrucke-textildruck.de/t-shirt-druckgroesse-platzierungsrechner/) (Motivbreiten je Position, Hinweis auf kleinere Kindermotive)
- [DTF-Blitz – Druck auf dunklen Stoffen](https://dtf-blitz.de/blogs/news/dtf-druck-auf-dunklen-stoffen-so-holst-du-brillante-farben-raus) (welche Farben auf Dunkel tragen, Pastell verliert, harte Kanten statt Verläufe, Linien über 0,5 mm)
- [Shirtspezialist – DTF für dunkle Textilien](https://shirtspezialist.de/detail/dtf-transfers-transferdrucke-digitaltransferdruck-fur-dunkle-textilien) (Weißunterdruck als Voraussetzung auf dunklem Stoff)
