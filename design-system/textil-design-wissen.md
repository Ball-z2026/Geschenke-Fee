# Textil-Design-Wissen fuer Motto Otto (DTF)

Angelegt am 5. Okt. 2026 auf Markus' Auftrag: "dass du dich 100-prozentig fokussiert auf deine Aufgaben nicht mehr fantasierst
und nur noch fundiert recherchiert designt ... Design-Grundlagen, angesagte Designs, achte darauf, dass wir mit DTF drucken und
dass wir 100 % perfekte Ergebnisse bekommen, und dir dieses Wissen vor allen Dingen auch abspeicherst" - und: "eigentlich
gegensaetzlich zur KI arbeiten, nicht immer alles gleich".

Grundlage: drei Recherchen vom 5. Okt. (rund 60 Quellen: Druckdienstleister und Hersteller, Designlehre, Trendberichte).
Jede Regel traegt ihre Quelle. "(Suchauszug)" = Seite war gesperrt, belegt nur ueber den Text der Suchergebnisse.
[Schluss] = eigene Ableitung, nicht direkt belegt. KEINE ZAHL HIER IST ERFUNDEN - wer eine aendert, nennt die Quelle.

WER DIESE DATEI LIEST: jeder Chat, bevor er ein Design, einen Bildauftrag, ein Shop-Bild, ein Band oder eine Pruefung anfasst.

---

## 0. Der Grundsatz: gegen den KI-Look, nie alles gleich

- Kaeufer wenden sich 2026 bewusst von "AI-overload" ab, hin zu "personal, imperfect and made with intention" (Etsy-
  Trendexpertin): https://www.stylist.co.uk/home/etsy-spring-summer-2026-trends/1067354
- KI-Merkmale: zu glatt, glaenzend, "zu perfekt", uebersaettigt, starke Lichtkontraste, Glitzer, Goldblatt, Farbspritzer
  (Suchauszuege): https://roblaughter.medium.com/is-that-image-ai-here-are-14-telltale-signs-to-look-for-d40e5cff2d0a ,
  https://medium.com/@ecekaya78/how-to-tell-if-an-artwork-was-generated-by-artificial-intelligence-0b81100cc90b
- KI wiederholt bekannte Paletten, Kompositionen und Motive - das Publikum ermuedet (Suchauszug):
  https://theloyalbrand.com/blogs/blog/ai-t-shirt-design-in-2026-we-tested-it-so-you-dont-have-to
- Gegenmittel Unvollkommenheit: Korn, rohe Texturen, Gezeichnetes, Handlettering, schiefe Kompositionen, Kopier-Texturen:
  https://purplecreative.co.uk/blog/the-imperfection-paradox ; Trend 2026 gescannte Oberflaechen, leicht wackelnde Typo
  (Suchauszug): https://creativebloq.com/design/graphic-design/texture-warmth-and-tactile-rebellion-the-big-graphic-design-trends-for-2026
- "KI-Motive ohne eigene Bearbeitung" gelten als ueberholt: https://www.tapstitch.com/blog/post/2025-t-shirt-trends-whats-hot-and-what-to-avoid

MOTTO-OTTO-REGELN DARAUS [Schluss]:
1. Jeder Stil beschreibt ein ECHTES VERFAHREN mit seinen Fehlern (Siebdruck mit Passerversatz, Stickstich, Letterpress,
   Pinselstrich, Kopierkorn) - nie eine Abstraktion ("clean vector look"). Vorbild: der Aquarell-Stiltext (CLAUDE.md 27. Sept.).
2. ABWECHSLUNG AUF JEDER EBENE, je Auftrag gezogen: Aufbau (VARIETY.layout), Platz der Schrift (VARIETY.schriftPlatz),
   Schriftart, Bildausschnitt, Groesse auf dem Stoff, Zahl der Farben. Ausdruecklich verboten als Standard: Bogenschrift
   oben + Banderole unten, Glow, glaenzende Verlaeufe, alles mittig und randvoll, Rahmen um das Motiv.
3. Zwei Designs desselben Mottos, die nebeneinander gleich aussehen, werden nicht beide gezeigt.

---

## 1. DTF-Technik (was der Druck verlangt)

| Thema | Regel | Quelle |
|---|---|---|
| Aufloesung | 300 dpi in Endgroesse; 150 dpi Untergrenze mit Verlust | https://www.transfersuperstars.com/blogs/news/dtf-file-requirements-how-to-prep-your-artwork-for-perfect-prints , https://assets.stahls.com/stahls/content/pdf/ultracolor-max/UltraColorMax-ArtSpecs.pdf |
| Format | PNG mit Transparenz, nie JPEG; Schrift in Pfade | https://printify.com/knowledge-hub/dtf-file-types-for-printing/ |
| Farbraum | Quellen widersprechen sich (sRGB / CMYK FOGRA39 / Originalprofil) - beim Dienstleister fragen | Printify, Transfer Superstars, Stahls |
| Halbtransparenz | gibt es nicht: nur 0 oder 100 % Deckung; Zwischenwerte druckt die Software unvorhersehbar, mit weissem/grauem Schleier | https://help.inkthreadable.co.uk/en/articles/435627-gradients-transparency , Stahls ("no transparency or fading on the edges") |
| Weisser Unterdruck | unter JEDEM nicht transparenten Pixel; 50-%-Pixel = 50 % Farbe + 50 % Weiss | Printify, https://www.turboprint.info/phpwcms/en_support_dtf.phtml |
| Verlaeufe | als Halbtonraster (Coldesi: Standard 35-45 LPI, Vintage 25-35, Foto 45-55; DTF Dallas 45-65) oder Farbe-zu-Farbe; kleine Schrift, Konturen, Logos NICHT rastern | https://coldesi.com/artwork-for-t-shirts/halftoning-dtf-prints-why-it-matters-and-how-to-get-it-right/ , https://dtfdallas.com/blogs/news/what-is-a-dtf-halftone |
| Linien | Quellen 0,2-3 mm; produktionssicher 1-1,5 mm (Kolormatrix) | https://kolormatrix.com/blogs/news/how-small-is-too-small-for-dtf-printing-text-lines-detail-guidelines |
| Luecken/Punzen | >= 1 mm; ausgesparte (negative) Linien brauchen das Doppelte der positiven | https://help.inkthreadable.co.uk/en/articles/15805586-designing-for-dtf-neck-label-printing , WirMachenDruck-PDF |
| Schrift | sicher ab 11-14 pt (Kolormatrix), WirMachenDruck 3,5 mm positiv / 4,2 mm negativ; WEISSE Schrift groesser als schwarze (InkExperts: duenn 5 mm, fett 3 mm) | Kolormatrix, https://inkexperts.co.uk/dtf-support/5-creating-artwork |
| Vollflaechen | werden steif und schwer ("bulletproof"); aufbrechen mit Aussparungen, Raster, grossem bewusstem Distress | https://dtfsheet.com/blogs/blog/dtf-transfer-thickness-fix , https://ninjatransfers.com/pages/tips-to-reduce-plastic-feel-of-dtf-transfers |
| Schwarz auf Schwarz | "Black Knockout": Schwarz aussparen, der Stoff ist das Schwarz | Ninja, https://www.transfersuperstars.com/blogs/dtf-transfer-printing/revolutionizing-t-shirt-printing-with-the-black-knockout-technique |
| Flaeche in Stofffarbe | wird mitgedruckt - nie eine Hintergrundflaeche in Shirtfarbe | Stahls |
| Kanten | 100 % deckend, keine Kantenglaettung ins Transparente, keine Restpixel (sonst Halo) | Kolormatrix, https://help.mayzing.com/en/articles/45-dtf-printing-design-guide |
| Farbtreue | nicht Pantone-genau; Neon/Gold/Metallic werden flach angenaehert (echte Effekte nur als Spezialtransfer) | https://dtfdallas.com/blogs/news/dtf-logo-printing-color-match-tolerance |
| Platzierung | Linke Brust 2,5-4,5" (6-11 cm), 3" unter Kragen; Brustmitte 6-10" breit; Front 10-12" x 10-14"; Ruecken 11-13" x 13-15"; Polo-Flaeche 3,5 x 6" | https://ninjatransfers.com/pages/dtf-transfer-placement-guide |
| Polo/Pique | Struktur zeichnet durch - kleine kompakte Logos statt Full-Front | https://ninjatransfers.com/pages/can-you-press-dtf-transfers-on-materials-that-arent-flat |
| Polyester | Farbstoff wandert ins Weiss (rosa/grau) - reinweisse Flaechen auf farbigem Polyester sparsam | https://printify.com/knowledge-hub/best-fabric-for-dtf-transfers/ |
| Hoodie | Kaenguru-Naht und Kordeln meiden, 3-4" unter dem Kragen | https://www.transfersuperstars.com/blogs/news/dtf-transfers-for-hoodies-everything-you-need-to-know |
| Pruefung | bei 100-300 % Zoom ansehen, auf hellem UND dunklem Grund | Inkthreadable, Kolormatrix |

UNSERE GRENZEN DARAUS [Schluss]: Linie >= 1 mm, Luecke >= 1 mm, Versalhoehe >= 4 mm (weiss/negativ >= 5 mm), Alpha hart
(0 oder 255, Schwelle 50 % - die Zahl ist NICHT belegt, nur das Prinzip), keine Flaeche in Stofffarbe, Schwarz auf schwarzem
Stoff aussparen. Groesste Vollflaeche: Regel 9a (Placken-Messung, Grenze 40 %).

---

## 2. Design-Grundlagen

KOMPOSITION
- Genau EIN Blickfang (Groesse, Farbe oder Lage hebt ihn ab): https://graphics-pro.com/feature/creating-standout-t-shirt-graphics/
- Eine Hauptidee; was konkurriert, fliegt raus (Suchauszug): https://design.tutsplus.com/articles/30-kick-ass-vector-based-t-shirts-from-top-designers--vector-355
- In Sekunden verstanden: https://gomedia.com/insights/seven-questions-to-ask-yourself-when-you-want-to-create-an-iconic-t-shirt-design/
- Silhouette-Test: als 32 x 32 px noch erkennbar; auf Schwarz UND Weiss; einfarbige Fassung muss tragen:
  https://pulsemerch.com/band-logo-design-tips-for-merch-that-actually-holds-up/
- Distanz-Test 1,8 m: https://printify.com/blog/how-to-create-a-selling-text-design-for-clothes/
- Negativraum: mehr Raum um ein Element = mehr Aufmerksamkeit (https://www.nngroup.com/articles/visual-hierarchy-ux-definition/);
  Gestaltgesetze Figur/Grund, Geschlossenheit, Naehe (https://ixdf.org/literature/topics/gestalt-principles)
- Varianten statt immer gleich: gestapelter Text, Badge/Kreis, linksbuendig editorial, Text mit kleinen Icons, Schrift als
  Form, asymmetrisch mit Gegengewicht, nicht mittig, andere Druckstellen (Ruecken, Nacken, Aermel vertikal):
  Printify (oben), https://graphics-pro.com/education/8-ways-to-approach-typography-for-t-shirt-design/ ,
  https://www.rushordertees.com/blog/alternative-print-locations/
- Motive mit Rahmen/Border gelten als veraltet: https://designshack.net/articles/graphics/t-shirt-design-tips/

HIERARCHIE
- Hoechstens 3 Groessenstufen, hoechstens 2 grosse Elemente, 3 Kontraststufen (NN/g, aus UX uebertragen).
- Hierarchie ueber Helligkeits-/Saettigungskontrast, nie nur ueber Farbton (Farbsehschwaeche).
- Monochrom anlegen, EIN Bereich in Farbe (Clement, graphics-pro).

TYPOGRAFIE
- Hoechstens zwei Schriften, jede mit fester Rolle; eine dritte vertraegt kaum ein Design: https://practicaltypography.com/mixing-fonts.html
- Versalien 5-12 % weiter sperren: https://practicaltypography.com/letterspacing.html
- Erst Komposition skizzieren, dann Schrift; Kerning pruefen; unlesbare "coole" Schrift bringt nichts (graphics-pro).
- Duenne Scripts verschwinden im Druck; Script unter 1" meiden; offene Punzen waehlen (Printify, Pulse Merch).
- Ueberholte Schriften: Comic Sans, Papyrus, Curlz, Brush Script, Copperplate, Chiller, Jokerman:
  https://theshirtstorm.beehiiv.com/p/stop-using-these-tshirt-fonts-in-2025

FARBE
- 2-4 Farben, so wenig wie moeglich; ein gutes Zeichen funktioniert einfarbig: https://www.vistaprint.com/hub/what-makes-a-good-t-shirt-design ,
  https://live.ink/why-your-first-t-shirt-design-should-be-one-colour
- DEN STOFF ALS FARBE MITDENKEN: Arbeitsflaeche in Stofffarbe; auf Schwarz keine schwarzen Schatten (der Stoff ist der Schatten);
  Negativraum ist eine Gratisfarbe: https://graphics-pro.com/feature/artwork-considerations-for-screen-printers/
- Verbotene Paare: Navy auf Schwarz, Hellgrau auf Sportgrau, Eisgrau auf Weiss: https://cdn.rushordertees.com/blog/10-t-shirt-design-tips-for-better-results
- FLIMMERN: nie Blau oder Gruen auf Rot und nie Rot auf Blau/Gruen (Chromostereopsis):
  https://thevisualcommunicationguy.com/2015/10/16/design-principle-chromostereopsis-or-why-blue-on-red-doesnt-work/
- Schwarz und Weiss verkaufen am besten, Grau weit dahinter; knallige Kombinationen schrecken ab:
  https://diymusician.cdbaby.com/music-career/color-band-t-shirts/

BILLIG / CLIPART
- Ueberladen (zu viele Farben, Effekte, Details), fuer den Bildschirm statt fuer den Stoff gedacht:
  https://www.ooshirts.com/blog/avoid-these-top-5-common-mistakes-in-designing-a-shirt/ , Pulse Merch
- Je komplexer, desto schneller veraltet (live.ink). Konzept vor Dekoration, auf mehreren Ebenen (Humor, Bezug):
  https://blog.threadless.com/concept-key/

PROZESS EINES PROFIS
Recherche/Briefing -> Konzept (Wortlisten) -> Skizzen (Komposition vor Schrift) -> auf der echten Stofffarbe -> Massstab 1:1
("Print it out. Hold it up to a shirt") -> Distanz- und Squint-Test -> Druckverfahren mitdenken -> Feedback.
Quellen: Go Media, Threadless, designshack, graphics-pro (oben).

---

## 3. Was 2025/26 angesagt ist

| Trend | Bildsprache | passt zu | Quelle |
|---|---|---|---|
| Handgemacht / Stick-Optik | gestickt wirkende Schrift, Doodles, gedaempfte Farben, bewusst unperfekt | Geschenke, JGA, Hochzeit | Stylist/Etsy, https://www.kittl.com/blogs/2026-t-shirt-design-ideas-trends-dsi/ |
| Bootleg-Style | 90er-Rap-Tee: Foto-Collage einer Person/eines Haustiers als Star, Retro-Typo, Name gross | Paare, Geburtstag, Abschluss, Haustier | Kittl |
| Vintage-Athletic / Varsity | Blockbuchstaben, Bogen, grosse Nummern, Wappen/Maskottchen, verblasst, Distress per Halbton | Vereine, Abi, Run Clubs | https://dtfdallas.com/blogs/news/spring-2026-t-shirt-design-trends |
| Vorne klein, hinten gross | kleine Brust + grosses Rueckenmotiv, dicke Konturen, wenig Feindetail | Streetwear, Gruppen | DTF Dallas, Tapstitch |
| Y2K / Cutecore | Neon oder Pastell, Metallic-Look, Schmetterlinge, Kawaii | Gen Z | https://www.printful.com/blog/design-trends |
| Verspielte Typo | Bubble, Puffy, verzerrt, 3D | breit | https://www.adobe.com/express/learn/blog/graphic-design-trends-2026 |
| Analog / organisch | Letterpress, Sand-/Steintextur, Erdtoene, "Patina Blue" | erwachsene Kunden | Adobe, Stylist/Etsy |
| Collage / Zine | Stempel, Handschrift, Klebeband, Papierfetzen, Fotos, asymmetrisch | Reise, Freunde | Creative Market (AccessNewswire), Adobe |
| Food-Art | malerisch gezeichnete Lebensmittel, Vintage-Europa, Wortspiele | Gastro-Partner | Printful, Pinterest Predicts |
| Dark Romance | dunkle Blumen, Spitze, Kirchenfenster | Nische | Printful DE, Etsy |
| MIDImalism | neutrale Basis + EIN starker Akzent, Line-Art | ueberall | https://printify.com/blog/leading-trends-for-etsy-sellers-in-2026/ |
| Pastell + Neon-Akzent | Salbei, Creme, Lavendel + Neon - besser auf Creme/Natur als auf Reinweiss | Sommer | DTF Dallas |
| Firmen-Merch wie Modemarke | schwere Stoffe, garment-dyed, gewaschene Toene, Boxy Cut, kleines Logo | Firmen | https://www.customink.com/about/press/swag-trends-2026 |

GRUPPEN: gemeinsame Vorlage + je Person Name/Nummer (DTF Dallas); Verein mit Herkunft (Stadt, Region; Adobe "local flavor");
Abi: Spruch vorne, Logo am Aermel, Namen hinten (Gelato DE, Suchauszug); JGA: Retro-Serif, Stick-Optik, Disco/Y2K,
nach der Feier noch tragbar (Bridesmaid for Hire, Suchauszug). Deutschland: kein eigener Trendbericht 2025/26 gefunden;
Retro-Trikot/Blokecore ist indirekt belegt (leinetal24, NSS Sports).

UEBERHOLT: Allerweltssprueche ("Good Vibes Only", "Live Laugh Love"), "lazy minimalism" (nur eine Standardschrift auf leerem
Shirt), Meme ohne Kontext, KI-Motive ohne Bearbeitung, kleines Brustlogo als EINZIGE Position, generische Tropen-Blumen,
reine Pastellflaechen, Gruppensets ohne Personalisierung, JGA mit Glitzerfolie + Schreibschrift, Wegwerf-Werbemerch.
Quellen: Tapstitch, DTF Dallas, Custom Ink, Bridesmaid for Hire (Suchauszug).

---

## 4. Wie das im System steckt (Stand 5. Okt.)

- brett.js: zeigbar() (unsichtbar, feine Schrift auf hellem Stoff, Farbbiss Rot/Blau/Gruen, Rahmen, Rot nur fuer weisse
  Motive), vollDeckend() (Placken). werkzeug/selbstpruefung.mjs fuer einzelne Motive.
- mottos.js: VARIETY.layout, VARIETY.schriftPlatz (Platz der Hauptschrift), RULES_FREIRAUM (keine Platte, kein Glow, kein Rahmen).
- images.js makeMaster: Alpha wird gehaertet (alphaSchaerfen) - Halbtransparenz an den Kanten wird so weitgehend vermieden.
- OFFEN (nicht gebaut, Vorschlag an Markus): Messung der kleinsten Linie/Schrift in Druckgroesse (1 mm / 4 mm), Halbtransparenz
  im Motivinneren als Pruefwert, Aehnlichkeitspruefung zweier Designs desselben Mottos, Stiltexte aller Stile nach dem
  Material-Prinzip, Black Knockout bei schwarzen Elementen auf schwarzem Stoff.
