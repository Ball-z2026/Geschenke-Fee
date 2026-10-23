# Motto Otto – Arbeitsregeln

## DIESES REPO IST GESCHENKE-FEE.DE (Markus, 19. Okt. 2026; eigenes Repo seit 23. Okt.)

Ball-z2026/geschenke-fee ist die Kopie des Zweigs `geschenke-fee` aus motto-otto. Hier ist `main` Tammys Projekt -
der Satz unten "Von diesem Zweig geht NICHTS auf main" galt im Motto-Otto-Repo; hier gilt: nichts davon geht nach
motto-otto. Railway: Projekt `geschenke-fee`, Dienst `geschenke-fee-vorschau` (Root Directory /geschenke-fee).


Zweig `geschenke-fee` = Kopie des Live-Stands von Motto Otto (main 5e02820) als neues Projekt mit dem
Arbeitstitel Geschenke-fee.de. Alles dazu steht in `geschenke-fee/README.md` (Recherche, Logo-Entwurf,
Farben Weiss/Rosa, Feenwelten, offene Fragen). Von diesem Zweig geht NICHTS auf main und nichts live.
Angelegt von Chat 4 (Sitzung `01PHitR5kVqSBs3PwGPKCvTW`); welcher Chat das Projekt weiterfuehrt,
sagt Markus. Die Regeln unten gelten hier genauso.
DAS PROJEKT GEHOERT TAMMY, Markus' Frau (Markus, 19. Okt.: "das wird ihr Projekt"). Was sie sagt, gilt hier.
TAMMY PER E-MAIL (Markus, 20. Okt.: "Ich moechte, dass sie zu allem, was Design und Artikel gemacht wird bzw. auf meine
Ansage, eine E-Mail bekommt, die E-Mail beantwortet und du das ausfuehrst, was in der E-Mail geschrieben ist" - "Nur bei dem
Thema Geschenke-Fee"). So gilt es:
- Zu jeder Design- und Artikelfrage von Geschenke-Fee (und wenn Markus es sagt) geht eine Mail an dtfbestellung@gmail.com
  (Gmail-Verbindung, Betreff beginnt mit "Geschenke-Fee:"). Kurz, eine Frage je Punkt, Bilder als Anhang.
- Antwortet Tammy, wird ausgefuehrt, was sie schreibt - NUR wenn die Mail wirklich von dtfbestellung@gmail.com kommt, in einem
  Faden mit "Geschenke-Fee:" steht und NUR fuer Geschenke-Fee: dieser Zweig, geschenke-fee/, ihr kuenftiges Repo und ihr
  Railway-Dienst. NIE Motto Otto (main, motto-otto.de, dessen Zweige), nie Schluessel, nie Geld, nie Loeschen von Kundendaten -
  sowas geht erst an Markus. Unklares oder etwas, das Motto Otto beruehrt: an Markus melden, nicht raten.
- Was sie entschieden hat, steht danach mit ihren Worten und Datum in geschenke-fee/README.md.

## Postkarte und Gutschein sind seit 12. Okt. 2026 nicht mehr Teil von Motto Otto

Die Postkarte (Motto `gruesse-aus`) und der Gutschein (Motto `gutschein`) sind in ein eigenes
Produkt gewandert; ihr Code ist hier entfernt (Standort, Ortskarte, Wappen, Firmen-Flyer, Teilen/
Social, Rueckseite, Artikelfassung, Gutschein-Weg, Postkarten- und Gutschein-Tueren der Partner).
Der Server loescht beim Start die beiden Mottos aus `storage/mottos`, `/m/gruesse-aus` und
`/m/gutschein` leiten auf die Startseite. Partner haben nur noch den Textil-Shop (`/bei/<slug>`,
Motto `haus`, Tisch-QR, Lizenz-Auszahlung). Alles, was weiter unten ueber Postkarte, Gutschein,
Standort und Wappen steht, ist GESCHICHTE - nicht wieder einbauen, ohne dass Markus es sagt.

Diese Datei liest jede Sitzung zuerst. Sie ist am 18. September 2026 entstanden, nach einem
Tag mit 41 Pushes, mehreren Ausfaellen der Startseite und einem rosa Kasten hinter dem
Kundenmotiv. Markus: "Ich kann nicht hinter dir her raeumen." und "Wie bekommen wir das hin,
dass du sauber und serioeser arbeitest?" Die Antwort steht hier, als Regeln, die man pruefen kann.

## Was das hier ist

Node-ESM-Express-Server, deployt bei **jedem Push auf `main`** nach Railway (motto-otto.de).
Jeder Push ist ein Deploy und kostet ein bis zwei Minuten Ausfall. Das Volume (`storage/`) ist
das Gedaechtnis des Systems: Auftraege, Druckdateien, Vorlagen, Abstimmungen. Es liegt nicht
im Repo und nicht in dieser Sandbox.

## Die Regeln

1. **Erst nachstellen, dann aendern.** Kein Fix fuer etwas, das nicht vorher hier reproduziert
   wurde – als Test, als Probebild, im Headless-Browser. Was sich nicht nachstellen laesst,
   wird als "nicht nachstellbar" gemeldet, nicht als Diagnose verkauft.
2. **Messen statt vermuten.** Jede Aussage ueber ein Bild, eine Datei, eine Zahl traegt das
   Messergebnis ("gemessen: 30,7 x 46,0 cm"), nie ein "sollte". Bilder werden so angesehen,
   wie der Kunde sie sieht: auf der Textilfarbe, in Handybreite – nie als rohe Transparenz
   auf dem schwarzen Grund des eigenen Betrachters.
3. **Ein Thema, ein Push, einmal am Tag – ausser bei Ausfall.** Sammeln, die komplette
   Abnahme fahren, einmal ausliefern. Nie zwei Pushes hintereinander, um den ersten zu
   reparieren. Bei einem laufenden Ausfall gilt: der Fix darf raus, sonst nichts.
4. **Vor jedem Push: `node abnahme.mjs` komplett gruen.** Das schliesst den Browser auf
   Laptop, iPhone und Android ein (Abschnitt 7) und den Magenta-Platzhalter (Abschnitt 8).
   Danach `git checkout -- storage/ && git clean -fdq storage/`, damit keine Laufzeitdateien
   mitkommen.
5. **Nichts faengt still.** Jeder `catch` protokolliert Ursache und Kontext. Was der Kunde als
   leere Kachel sieht, muss in der Lage-Karte (`/api/admin/lage`) mit Grund stehen.
6. **Nichts, was Netz braucht, vor `app.listen`.** Reparaturen, Downloads, Vorbau laufen als
   `setTimeout` nach dem Start.
7. **Der Kunde testet nicht.** Wenn ich etwas nur auf der laufenden Seite pruefen kann und sie
   nicht erreiche, sage ich das – und bitte nicht um Screenshots.
8. **Herstellerfotos (`SOURCES` in mockups.js) werden nie ueberschrieben, nie geloescht.**
   `istOriginalfoto()` ist die Sperre; jede neue Stelle, die Vorlagen schreibt, fragt sie.
9a. **VERBOTEN: grosse, vollflaechige Drucke auf Textil** (Markus, 4. Okt.: "dass so grosse, komplett vollflaechige
   Drucke einfach sich Scheisse anfuehlen und dir verboten sind ... Wichtig ist, dass wir verkaufbare Designs haben").
   - Ein Shirt-/Hoodie-Motiv ist freistehend und locker: Gegenstaende mit Luft dazwischen, nie eine gemalte Szene mit
     Himmel/Wand/Boden als Flaeche. Ein geschlossener Gegenstand (Karton, Schild) nur KLEIN (hoechstens ca. 18 cm breit).
   - EIN Thema je Entwurf: entweder der Wagen ODER die Verpackung - nicht alles in ein Bild ("Du musst nicht alles in
     einem Entwurf unterkriegen"). Persoenliches gehoert auf den Gegenstand (handschriftlich "fuer Clara" auf dem
     Karton), Koordinaten/Webseite auf eine andere Seite des Gegenstands.
   - Messen vor dem Zeigen: `node werkzeug/deckung-zellen.mjs <motiv.png>` - ueber 40 % voll deckende Zellen im
     Umriss ist ein Placken und wird nicht gezeigt. Volle Szenen nur fuer Flachware (Kissen, Poster, Tasse, Acryl).
9b. **TEXTIL-DESIGN: SO DENKT EIN DESIGNER** (Markus, 5. Okt.: "Ich bin ein wenig enttaeuscht ... bei Luigi hast du einfach
   einen blauen Hoodie genommen und das alte Motiv einfach draufgesetzt ... rot auf blau sieht einfach Scheisse aus. Du musst
   dich staendig ueberpruefen ... Ich kann dir nicht die ganze Zeit hinterher rennen" - "Lese dich noch mal ein, was macht
   ein gutes Design aus" - "Du musst lernen, wie ein hochwertiger Textil-Designer zu denken").
   Gelesen (Printful, Gelato, ooshirts, Ninja Transfers, Lightspeed/Webstaurant zu Restaurant-Merch, Okt. 2026), dazu
   alles, was Markus bisher gesagt hat. VOR JEDEM BILD, DAS MARKUS ODER EIN KUNDE SIEHT, diese Fragen - in dieser Reihenfolge:
   1. MOTIV UND STOFF ZUSAMMEN ENTWERFEN, nie ein fertiges Motiv auf eine andere Farbe setzen oder umfaerben. Die Stoff-
      farbe ist Teil des Designs: sie ist die hellste oder dunkelste Farbe im Bild, und das Motiv wird fuer GENAU sie
      gemacht. Wechselt der Stoff, wird das Motiv neu gedacht.
   2. FARBEN: hoechstens drei bis vier, eine fuehrt, die anderen sind Akzent. Keine Farbe auf ihrem eigenen Ton (Rot auf
      Rot, Gruen auf Gruen) und keine flimmernden Paare in der Flaeche: Rot auf Blau/Gruen, Gruen auf Rot, Blau auf Orange.
      Lesbar heisst: Schrift hat klaren Hell-Dunkel-Abstand zum Stoff. Die Logo-Farben bestimmen den Stoff (Gold ->
      Creme/Natural, Rot-Gruen-Italien -> Weiss/Creme), nicht umgekehrt.
   3. KEIN PLACKEN (Regel 9a): Hintergrund raus, Luft im Motiv, Rasterpunkte statt Vollflaeche, weiche Auslaeufe. DTF
      liegt auf dem Stoff - grosse Vollflaechen machen das Teil steif und schwer. Ein geschlossener Gegenstand nur klein.
   4. GROESSE UND PLATZ nach Regel 9 und 19: T-Shirt-Front 25-30 cm, Brust-Logo 8-10 cm auf der Herzseite, Hoodie vorne
      klein, hinten gross. Bei Firmen/Partnern: der Gast ist keine Litfasssaeule - das Logo klein vorne oder als Teil
      eines Motivs, das GROSSE Motiv ist Kunst (Ort, Szene, Gegenstand des Partners), nie ein grosses Werbelogo allein.
   5. EIN THEMA, EIN BLICKFANG: was sieht man aus drei Metern? Genau eine Sache. Alles andere (Name, Datum, Koordinaten)
      ist klein und gehoert dazu.
   6. FEINHEIT: keine Linie unter 0,5 mm, keine Schrift unter 2,5 mm Hoehe in Druckgroesse.
   7. DER VERKAUFS-TEST: wuerde ich das fuer 30 Euro kaufen und tragen? Sieht es aus wie Kunst oder wie Werbung? Sieht es
      anders aus als die anderen Teile im selben Shop?
   GEMESSEN wird 2 und 3 vor dem Zeigen: `node werkzeug/selbstpruefung.mjs <motiv.png> <#stoff> <name> [breite cm]` -
   unsichtbar (farbWerte, Grenze 15 %), Placken (Grenze 40 %, Gegenstand bis 18 cm erlaubt), Farbbiss (rot auf blau/gruen
   und umgekehrt, Grenze 12 %). "NICHT ZEIGEN" heisst: nicht zeigen, nicht einsetzen. 1, 4, 5 und 7 prueft das Auge -
   und ich sage beim Zeigen in einem Satz, wie ich sie geprueft habe. Geeicht am 5. Okt.: Karneval auf Royal -> 20 %
   unsichtbar, 17 % Farbbiss (durchgefallen), auf Gelb 7 % / 0 %; der Luigi-Karton ist ein geschlossener Gegenstand
   (81 % voll) und nur bis 18 cm zulaessig.
9c. **DESIGN-WISSEN MIT QUELLEN: `design-system/textil-design-wissen.md` - VOR JEDEM DESIGN LESEN** (Markus, 5. Okt.: "nicht mehr
   fantasierst und nur noch fundiert recherchiert designt ... dass wir mit DTF drucken ... und dir dieses Wissen abspeicherst" -
   "gegensaetzlich zur KI arbeiten, nicht immer alles gleich"). Dort: DTF-Technik (0 oder 100 % Deckung, Linie/Luecke >= 1 mm,
   Schrift >= 4 mm, Black Knockout, Polo nur kleines Emblem), Design-Grundlagen (ein Blickfang, 2 Schriften, 2-4 Farben, Stoff
   als Farbe, nie Rot/Blau/Gruen gegeneinander), Trends 2025/26 und was ueberholt ist, je Regel die Quelle. Keine Zahl ohne Quelle.
9. **Positionierung auf den Artikeln ist fertig und gilt fuer jedes neue Design (Markus, 2. Okt.:
   "so gespeichert, dass jeder Chat drauf zugreifen kann ... speziell mit der Positionierung").**
   Nicht zuruecksetzen, nicht "vereinfachen":
   - Beutel: je Foto eine eigene Flaeche, `BOX_OVERRIDES.beutel_white` / `beutel_black` in
     mockups.js, 30 x 30 cm mittig, 6 cm Luft oben und unten. Gilt nur fuer GENAU die Fotos
     `vorlagen-original/beutel_*.jpg`; die Abnahme misst den Korpus darin nach. Wer ein Beutelfoto
     tauscht, misst neu (`node werkzeug/beutel-korpus.mjs`) und traegt `BEUTEL_KORPUS` + Box neu ein.
   - Kissen und alle Flachware: ein fuer das Teil gebautes Motiv fuellt die Flaeche zu 100 %
     (`passtZumArtikel` in makeMockup, `fit: 'fill'`), keine aufgefuellten Seitenstreifen.
   - HOODIE (Markus, 5. Okt.: "das Brust Logo sitzt falsch ... viel zu hoch" - auf die neue Fassung: "Ja passt"),
     abgelesen am Raster der B&C-Hoodie-Vorlage (1024 px; Rumpf auf Brusthoehe x 340-690 = rund 58 cm, also 6 px/cm;
     Kragennaht y 175, Achsel y 290, Kordeln x 485/555 bis y 380, Tasche ab y 685):
     BRUSTEMBLEM 8 cm breit auf der HERZSEITE (vom Betrachter rechts, rechts neben der Kordel), Mitte x 605, Oberkante
     y 262 = Achselhoehe - nie mittig zwischen den Kordeln, nie direkt unter der Kapuze. GROSSER DRUCK vorne: beginnt
     unter den Kordelspitzen (y 300), endet ueber der Tasche (y 665), hoechstens 30 cm breit. Gilt fuer jedes neue
     Hoodie-Muster und Shop-Bild; Werkzeug: werkzeug/east-creme.mjs (setzen()). T-Shirt-Frontdruck gross ist richtig.
   - Partner-Logos auf Shop- und Beispielbildern sind IMMER das Original (Markus, 4. Okt.: "Warum wurde das Logo
     vom East hier verfremdet? Das Logo ist doch ganz klar."). Die Bild-KI setzt reine Schriftlogos (EAST26) in
     ihrer eigenen Schrift neu. Nach jedem neu erzeugten Shop-Bild: Logo mit `werkzeug/logo-einsetzen.mjs` durch
     das Original ersetzen und die Stelle in `postkarte/haus/logo-plaetze.json` eintragen - die Abnahme misst dort.
   - NIE den Namen "Anna" in eigenen Beispielen, Platzhaltern, Vorzeige- oder Shop-Bildern (Markus, 4. Okt.:
     "Streich den Namen aus der Liste, wenn wir selber was bauen"). Die Abnahme prueft die Dateien.
   - Aendert sich, wie makeMockup zeichnet: neuen Eintrag in `MOCKUP_STAENDE` fuer genau die
     betroffenen Artikel und `MOCKUP_STAND` hoch (zuletzt 94 = Flachware, Artikel aus artikelVon), sonst liefert das Volume
     die alten Bilder weiter aus.

## Wie ich arbeite - nachgeschaerft am 23. September

Markus an diesem Tag: "Warum verfaellst du immer wieder in alte Muster? Das ist total krank." Und:
"Wir haben gesagt, wir arbeiten hoechst professionell. Das kommt mir manchmal leider nicht so vor."
Er hat in beidem recht gehabt. Was an dem Tag schiefging und was daraus folgt:

- SIEBEN DEPLOYS AUF main AN EINEM TAG, gegen Regel 3, die seit dem 18. September hier steht. Es
  blieb nicht folgenlos: waehrend eines dieser Neustarts hat ein Kunde in Spanien seine Postkarte
  verloren - gemessen, kein Auftrag in der Liste, und die Datei wird erst nach dem Start
  geschrieben, also gibt es nicht einmal eine Spur davon.
  **Daraus: kein Push auf main ohne Markus' Wort.** Alles geht auf einen Zweig, er entscheidet,
  wann es raus geht. Ein laufender Ausfall bleibt die Ausnahme, wie in Regel 3.
- ZWEIMAL GEBAUT, WAS ER NICHT WOLLTE: erst Rahmen, Flaeche, Schrift und Logo aus dem Server
  (firmen-layout.js), dann ein Verfahren mit Magenta-Feldern, in die der Server die echten Fotos
  setzt. Beides war meine Erfindung. Seine Ansage hiess von Anfang an: ein Master-Prompt, die
  Variablen und das Material von der Homepage dazu, den Rest macht das Bildmodell.
  **Daraus: was nicht funktioniert, wird im AUFTRAG repariert, nicht im Server.** Wer zu Code
  greift, um ein Bildproblem zu loesen, fragt vorher. Und: nur bauen, was gesagt wurde - Ideen
  kommen als Satz, nicht als fertiger Zweig.
- FALSCH GEMESSEN UND ES SO GEZEIGT: "9 von 9 Feldern NICHT LEER" war ein kaputtes Messgeraet
  (sharp .stats() rechnet ueber das Eingangsbild, nicht ueber den Ausschnitt). Erst ausschneiden,
  dann messen. **Daraus: eine Messung, die ein ueberraschendes Ergebnis liefert, wird zuerst am
  bekannten Fall geprueft** - hier waere aufgefallen, dass alle Felder DESSELBEN Bildes exakt
  denselben Wert hatten.
- BEI "AENDERE DAS FORMAT" ALLES UMGEBAUT. Er musste es dreimal sagen.
  **Daraus: die kleinste Aenderung, die das Gesagte erfuellt - und nichts daneben.**

## Firmenkarte: zwei Wege, und welcher wann gilt (Markus, 23. Sept.)

DIE REGEL, in seinen Worten (23. Sept., nachmittags):
"Es gibt doch ganz klare Regeln bei einer Firma, wo wir das Logo nutzen duerfen. Dann wird es
eingebaut. Hat die Firma allerdings eine eigene Karte/Flyer entworfen, wird strikt diese benutzt.
Ansonsten ist es Freestyle - und lass den Prompt immer was Schoenes bauen."

Also drei Saetze, und sie entscheiden alles:
1. **Logo-Freigabe da -> das Logo kommt auf die Karte.** Keine weitere Frage, kein Abwaegen.
2. **Die Firma hat selbst eine Karte oder einen Flyer entworfen -> STRIKT diese.** Nichts daran
   wird verbessert, umgestellt oder "angepasst". Nur die Bilder des Kunden kommen hinein.
3. **Sonst Freestyle** - der Master-Prompt baut, und er soll etwas Schoenes bauen.

WICHTIG, weil ich genau hier zweimal danebenlag: Weg 1 gilt nur, wenn die FIRMA etwas entworfen
hat. Ein Rahmen, den ich mir ausdenke, ist kein Firmenentwurf - er ist Freestyle mit Extraschritt.
Ohne Entwurf der Firma gibt es also immer den Master-Prompt.

Frueher gesagt, gleicher Inhalt: "Wenn eine Firma beschlossen hat mitzumachen und wir bauen einen
festen Rahmen, der vorgegeben ist - dann kommen ja nur noch die Bilder von den Kunden drauf. Aber
solange es Freestyle ist, sollte es so gemacht sein."

Damit sind es ZWEI Wege, und sie duerfen nicht vermischt werden:

1. **KOOPERATION - fester Rahmen.** Die Firma macht mit. Ihr Rahmen wird EINMAL gebaut und von
   ihr freigegeben: Farben, Form, Logoplatz, leere Bildfelder. Danach sieht jede Karte dieser
   Firma gleich aus, nur die Fotos des Kunden wechseln. Genau das will ein Unternehmen mit
   eigenem Auftritt - nicht jedes Mal ein anderes Design, sondern seins.
   Technisch: die leeren Felder sind Magenta-Flaechen, platzhalterFelder() in images.js findet
   sie (jede Insel einzeln, von gross nach klein, mit der Fuellung ihres Kastens - daran
   unterscheidet sich ein Bildfeld von einem Pinselstrich derselben Farbe), und der Server setzt
   Selfie, Firmenfoto und Strassenkarte hinein, immer mit fit 'cover', nie gezogen. Gemessen an
   vier Rahmen aus dem echten Bilddienst: 9 von 9 Feldern sauber leer (Streuung unter 1,1),
   Feldzahl jedes Mal wie bestellt.
   Hierher gehoeren auch Idee 1 (Firmen-Kooperation per Link) und Idee 8 (Gastro, QR am Tisch):
   wer mitmacht, bekommt seinen Rahmen.

2. **FREESTYLE - Master-Prompt.** Kein fester Rahmen, einmalige Sache. Dann baut die Bild-KI die
   ganze Karte: firmen-flyer.js schreibt den Auftrag, die Variablen (Firma, Hausfarben, Gewerk,
   Ort, Koordinaten, Datum, Kopfzeile, Stil) und das Material von der Homepage (Logo, ein bis
   zwei Fotos, Strassenkarte) gehen mit. Jeder Stil sieht anders aus - das ist hier erwuenscht.
   Markus dazu: "Das Einzige, was wir vorgeben, ist ein Rahmen und ein Prompt, den Rest macht
   ChatGPT ... Du musst doch nur einen Master-Prompt haben, und die Variablen werden mitgegeben."

**Der Rahmen kommt von der Firma, nicht von mir** (Markus, 23. Sept.): "Dann musst du natuerlich
auch eine Moeglichkeit bieten fuer denjenigen, der mitmacht, der in seinem Account die Postkarte
styled." Genau daran haengt, ob Weg 1 traegt. Heute heisst "Firma macht mit": ich bearbeite von
Hand postkarte/firmen-freigaben.json. Das geht fuer drei Firmen, nicht fuer dreissig.

Der Hebel ist, dass die Firma fast nichts eintippen muss - logo-holen.js zieht Logo, Gewerk,
Adresse und Fotos von ihrer Seite, hausfarben() misst die Hausfarben aus Logo und Stylesheet.
Sie gibt die Webseite an, der Rest laeuft von selbst.

MARKUS GIBT NICHTS FREI (23. Sept.: "Das muss relativ automatisiert laufen. Ich will da nichts
freigeben oder sonst irgendwas."). Kein Schritt der Strecke wartet auf ihn. Die Firma traegt ihre
Webseite ein, der Server holt Logo, Farben, Gewerk und Fotos, erzeugt den Rahmen und stellt ihn
scharf. Wer im eigenen Konto etwas anders haben will, aendert es dort selbst - das ist Sache der
Firma, nicht seine. Zu bauen ist also weder ein Baukasten noch eine Freigabestrecke, sondern eine
Strasse, die von allein durchlaeuft.

Was dafuer da ist: Konten (/api/mo/me, Gastsitzungen, Benutzerverwaltung im Backend), die
Freigabe-Eintraege, die automatische Beschaffung. Was fehlt: ein Zugang fuer die Firma selbst
(heute kommt man nur ueber den Chef-Zugang ans Backend), die Zuordnung Konto -> Freigabe-Eintrag,
und der abgelegte Rahmen je Firma mit seinen Feldern. Offen und vor dem Bauen zu klaeren: wer in
der Firma darf freigeben, und wie weist die Firma nach, dass ihr die Seite gehoert, von der wir
Logo und Fotos ziehen.

Der haeufigste Fehler dabei (mir am 23. Sept. zweimal passiert): das Verfahren von Weg 1 auf Weg 2
anwenden. Wer keinen freigegebenen Rahmen hat, bekommt den Master-Prompt - nicht einen Rahmen,
den ich mir ausdenke.

## Mehrere Chats am selben Repo (Markus, 24. September)

An diesem Tag liefen zwei Sitzungen gleichzeitig an der Postkarte. Der eine Chat pushte dreimal
direkt auf `main` (10:12, 10:31, 12:11), der andere arbeitete auf einem Zweig - und BEIDE
schrieben denselben Absatz im Bild-Auftrag um, beide setzten GA_REV auf 16, sieben Dateien
kollidierten. Markus merkte es daran, dass er live immer wieder dieselben Fehler fand: er testete
einen Stand, in dem die Reparaturen des anderen Chats gar nicht drin waren.
Sein Satz dazu: "Vielleicht sollten wir ein Chat machen nur fuer Postkarten, ein Chat nur fuer
Verbesserung vom Workflow, damit nichts mehr durcheinander kommt."

WICHTIG: Ein anderer Chat kann das Gespraech hier nicht lesen. Was zwischen Sitzungen gelten
soll, steht in DIESER Datei - sonst erreicht es die anderen nie.

1. **KEIN CHAT PUSHT AUF `main`.** Ausnahmslos, auch nicht "nur eine Kleinigkeit". Jede Sitzung
   arbeitet auf einem eigenen Zweig und meldet Markus, dass etwas fertig ist. Er entscheidet,
   was und wann ausgeliefert wird. Das ist Regel 3 und "kein Push auf main ohne Markus' Wort" -
   mit zwei Sitzungen wird daraus eine harte Bedingung, weil sonst der Boden unter der anderen
   Sitzung wegrutscht.
2. **Vor der ersten Aenderung: `git fetch origin && git rebase origin/main`.** Wer darauf
   verzichtet, baut auf einem Stand, den es nicht mehr gibt - und diagnostiziert Fehler in Code,
   der schon ersetzt wurde. Genau das ist am 24. Sept. passiert.
3. **ES GIBT GENAU ZWEI CHATS. Hier stehen sie, damit Markus nicht raten muss.**

   Am 24. Sept. standen hier vier geplante Bereiche - "Postkarten-Motiv", "Standort & Firmen",
   "Shop & Artikel", "Werkbank & Ablauf". Zwei davon hat es nie gegeben. Am 26. Sept. fragte
   Markus, in welchem Chat die Startseite gemacht wird, und bekam von mir einen Chat genannt,
   den es gar nicht gibt. Deshalb steht hier jetzt der GEMESSENE Stand, nicht der geplante.
   Gezaehlt wurde ueber die Sitzungsnummern in den Commits (`Claude-Session:`).

   **Chat 1 - "Shop & Seiten"**, Sitzung `01H7hTCfFZh5pe693TCPCHp5`, laeuft seit 6. Sept.
   Alles, was der Kunde sieht und kauft. 249 Commits seit dem 15. Sept.
   - Seiten: `home.html` (die Startseite), `motto.html`, `admin.html`, `firma.html`
   - Shop: `artikel.js`, `mockups.js`, `vorlagen.js`, `textilien.js`, `kaufformen.js`,
     `preise.cjs`
   - Bilder und Druckdateien: `images.js`, `names.js`, `vectorize.js`
   - Abnahme: `abnahme.mjs`, `abnahme-browser.mjs`, `abnahme-magenta.mjs`
   - Motto-Inhalte: `seed.json`, `vorzeige-designs.json`, die Motto-Felder in `mottos.js`

   **Chat 2 - "Postkarte & Standort"**, Sitzung `01KhuipFhT8EXnL7kyWmLjY6`, seit 21. Sept.
   Die Ortskarte: wie sie gezeichnet wird, wo der Kunde steht, was drauf darf. 71 Commits.
   - `firmen-flyer.js`, `postkarte-rand.js`, `postkarte/`, `fotos.js`, `ortsgeschichte.js`
   - `standort.js`, `nachbarschaft.js`, `wappen-freigabe.js`, `firmen-freigabe.js`,
     `logo-holen.js`
   - Gutscheine (seit 30. Sept.): `gutscheine.js`, `gutschein-route.js`, `gutschein.html`,
     `postkarte/motto-gutschein.json`; die Connect-Funktionen in `billing.js` (gemeinsam)
   - Partner und Tor (seit 1./2. Okt.): `haus-route.js`, `haus.html`, `partner.js`, `partner-route.js`,
     `partner.html`, `partner-werden.html`, `partner-bereich.html`, `bei-machen.html`, `partner.css`,
     `lizenzen.js`, `postkarte/haus/`, `postkarte/motto-haus.json`
   - `abnahme-postkarte.mjs`, die Stiltexte in `mottos.js`

   **Woran ein Chat erkennt, welcher er ist:** an seiner eigenen Sitzungsnummer, die in jedem
   Commit steht, den er schreibt. Wer unsicher ist, zaehlt nach:
   `git log --format='%b' --since=2026-09-10 | grep -o "session_[A-Za-z0-9]*" | sort | uniq -c`
   Taucht die eigene Nummer dort nicht auf, ist es ein NEUER Chat - dann gehoert er hier
   eingetragen, bevor er anfaengt, und Markus sagt ihm, welcher Bereich seiner ist.

   **Chat 3 - "Design & neue Startseite"**, Sitzung `015KLAfRMfPUJgA9Dje7oq6v`, seit 1. Okt.
   Auftrag von Markus (Google-Doc "AUFTRAG AN CODE - Design-Skills einrichten + neue Startseite",
   1. Okt.). Nur diese Dateien:
   - `home-neu.html` - SEIT 1. OKT. DIE STARTSEITE `/` (Markus: "uebernehmen"), dazu in server.js
     `startseiteNeuHtml()` und die Routen `/`, `/startseite-alt`, `/startseite/postkarten/:datei`
   - `design-system/motto-otto/` (MASTER.md gilt ab jetzt fuer ALLE Seiten - vor jeder
     Seitenarbeit lesen), `.claude/skills/`, `.dockerignore`
   `home.html` bleibt Chat 1: es traegt weiter /so-gehts, /mottos, /stile und die alte
   Startseite unter /startseite-alt (noindex).
   Auf Markus' Wort am 1. Okt. ausserdem in Chat 1s Bereich geaendert (klein, siehe unten
   "Stand 1. Okt. von Chat 3"): `abfolge.js`, `motto-seite.js`, `abstimmung.js`, dazu neu
   `gruppen-mottos.json`.
   Ebenso auf Markus' Wort in Chat 2s Bereich (Stil Grossbuchstaben, siehe dort Punkt 7):
   `firmen-flyer.js`, Stiltext in `mottos.js`, `postkarte/motto-gruesse-aus.json`, GA_REV in server.js.
   **SEIT 1. OKT. ABENDS: DAS DESIGN ALLER KUNDENSEITEN** (Markus: "ich moechte, dass alle Designs
   fuer die Seite jetzt hier an der Stelle gemacht werden" - und `motto.html`/`konto.html` "darf
   angefasst" werden). Gemeint ist das AUSSEHEN: Farben, Schrift, Kopf, Knoepfe, Abstaende, Symbole
   von Mottoseite (`motto.html`), `home.html` (/so-gehts, /mottos, /stile), `konto.html`,
   `firma.html`, /event. Die Abfolge, die Felder und was die Seiten TUN, bleiben bei Chat 1 und
   Chat 2 - wer dort etwas aendert, das man sieht, nimmt die Bausteine aus `marke.css`.
   `marke.css` (neu, ausgeliefert unter /marke.css?v=<ASSET_V>) ist das gemeinsame Farbblatt:
   Logo-Farben, Schriften, der Kopf `.mo-kopf` und der Knopf `.mo-knopf`.

   **Chat 4 - "Kundenweg & Freestyle-Foto"**, Sitzung `01PHitR5kVqSBs3PwGPKCvTW`, seit 20. Sept.
   Auftrag 20. Sept.: Stolperstellen-Liste KUNDENWEG.md (Zweig `kundenweg-liste`, nur Doku).
   Auftrag 19. Okt.: Foto oder Datei bei Freestyle, die nach dem Wunsch geaendert wird (Zweig
   `freestyle-foto-aendern`; Abschnitt "Freestyle mit Foto oder Datei" unten). Beruehrt dafuer klein
   die gemeinsamen Dateien `server.js`, `mottos.js`, `motto-seite.js`, dazu `fotos.js`,
   `freestyle/motto-freestyle.json`, `abnahme.mjs`, `abnahme-browser.mjs`.

   **Wenn ein neuer Bereich aufgemacht wird**, kommt er erst hier in die Liste und dann in den
   Code - nicht umgekehrt. Ein Bereich ohne Chat ist eine Falle: der naechste schickt Markus
   dorthin, und dort ist niemand.

   **Gemeinsame Dateien** - `server.js`, `motto-seite.js`, `mottos.js` gehoeren BEIDEN. Dort
   wird besonders klein geaendert, und wer eine Fassungsnummer hochsetzt (GA_REV,
   MOCKUP_STAND, PROMPT_FASSUNG), schaut vorher, ob der andere Chat sie schon hochgesetzt hat.
   `standort.js` und `wappen-freigabe.js` hat Chat 1 gebaut, bevor es Chat 2 gab - sie gehoeren
   jetzt Chat 2. Wer dort alte Spuren von sich findet, laesst sie liegen.
4. **Ein Befund gehoert dem Bereich, nicht dem Finder.** Wer in einem fremden Bereich etwas
   kaputt findet, meldet es Markus in einem Satz und fasst es NICHT an.

## Stand 1. Okt. von Chat 3 (fuer Chat 1 und Chat 2 - vor der naechsten Aenderung lesen)

Alles ist auf main (Pull Requests Ball-z2026/motto-otto#1, #2, #3; zuletzt 819f2d7, live geprueft
am 1. Okt.). Vor der naechsten Aenderung: `git fetch origin && git rebase origin/main`.

1. NEUE STARTSEITE ALS VORSCHAU - `home-neu.html` unter `/vorschau-start` (noindex). `/` (home.html)
   ist unveraendert. Aufbau (Markus): Postkarte als Einstieg ("Selfie rein. Postkarte raus.",
   sechs Stile auf Tippen, "Foto waehlen" -> /m/gruesse-aus?stil=<stil>), daneben "Lieber Shirts
   fuer eure Gruppe?"; dann Shirts fuer Gruppen; dann Abstimmung und Konsens als Highlight "Fuer
   Gruppen"; dann die uebrigen Artikel; alle Mottos; Ablauf. Bilder: `startseite/postkarten/`.
   Regeln dazu: `design-system/motto-otto/MASTER.md` (Farben aus dem Logo, gemessene Kontraste),
   `pages/startseite.md`, `pages/startseite-audit.md`.
2. FREESTYLE OHNE TEXTIL-FRAGE BEI NICHT-TEXTIL (Markus: "wo Textilien steht, muss natuerlich
   geaendert werden, wenn's keine Textilien sind"). motto-seite.js `textilNurBeiTextil()`: Textil
   = Katalog-Gruppe Textil (tshirt, hoodie, shopper); sonst ist #f-textile zu und textile =
   'weiss'. `farbHinweis()` passt den Satz unter den Farben an (dunkler Stoff / heller Stoff /
   kein Stoff) - der feste Satz in motto.html ("schwarzen Shirt") wird dabei ueberschrieben.
   abfolge.js `leer(s)`: ein Schritt ohne sichtbaren Inhalt wird uebersprungen, nicht gezaehlt,
   nicht in der Zusammenfassung gezeigt.
3. ABSTIMMUNG NUR BEI GRUPPEN-MOTTOS (Markus: "wenn jemand das T-Shirt fuer Opa macht, nicht so
   sinnvoll ... Firmenausflug, Malle-Fahrt, Kegel, Bowling ... macht das Sinn"; "Geburtstag ist
   auch eher ein Einzelding"). Liste in `gruppen-mottos.json`; server.js `istGruppenMotto()` gibt
   `gruppe` mit /api/mo/mottos und der Mottoseite aus; motto-seite.js zeigt "Zur Abstimmung
   schicken" nur bei `current.gruppe`; abstimmung.js lehnt eine Abstimmung fuer andere Mottos ab
   (400). Sprueche = allein und Freestyle = Gruppe sind gesetzt, NICHT von Markus entschieden.
   Neues Gruppen-Motto = Slug in gruppen-mottos.json.
4. BEFUNDE OHNE AENDERUNG (Chat 1, im iPhone-Browser gemessen):
   - Optik-Bruch: neue Startseite hell in Logo-Farben, Mottoseiten dunkel mit Gelb.
   - Tasse, Polo, Zip-Jacke fehlen im Freestyle-Katalog, stehen aber mit Preis im Shop.
   - Ein von der Startseite gewaehlter Stil (?stil=neon) ist gewaehlt, steht im Stil-Schritt aber
     hinter "Mehr Stile zeigen".
   - Emojis als Symbole ("Jetzt Selfie machen", "Standort erlauben") - MASTER.md will SVG.
   - Durchgespielt bis "Otto starten": 28 von 28 Mottos, 17 von 17 Freestyle-Artikel, ohne Fehler.
5. NICHT INSTALLIERT: Taste-Skill, Taste-Redesign, UI UX Pro Max (Sandbox sperrt Fremdquellen).
   `.claude/skills/frontend-design` ist da.
6. STARTSEITE: ZWEI TUEREN (#2, Markus: "es kommt ueberhaupt nicht mehr rueber, dass wir auch
   Einzelstuecke machen fuer Geburtstage, Geburt"). Im Abschnitt "Shirts und mehr" von home-neu.html
   zwei Wege: "Fuer eure Gruppe" (Gruppen-Mottos aus gruppen-mottos.json) und "Als Geschenk oder fuer
   dich" (alle anderen, Geburtstag, Geburt & Baby, Familie vorn). Der zweite Knopf im Aufmacher heisst
   "Lieber ein Shirt - fuer die Gruppe oder als Geschenk?". Nur home-neu.html.
7. NEUER POSTKARTEN-STIL "GROSSBUCHSTABEN" (#3, Markus: "die sieht megacool aus"; "Bei Buchholz
   wuerde klein drunter stehen in der Nordheide"). Die klassische Grossbuchstaben-Ansichtskarte:
   der Ortsname riesig in 3D-Blockbuchstaben, in jedem Buchstaben ein Bild. NUR Gruesse aus
   (nurMotto). Geaendert in CHAT-2-DATEIEN auf Markus' Wort ("baue du das analog"):
   - mottos.js: STYLES.grossbuchstaben (vor neon).
   - firmen-flyer.js: `ortTeilen(ort)` teilt "Buchholz in der Nordheide" in gross "BUCHHOLZ" und
     klein "in der Nordheide"; flyerPrompt nimmt `grossbuchstaben` und setzt dann statt der acht
     Bauplaene "THE PLACE NAME FILLS THE CARD" (je Buchstabe ein Fenster, gelieferte Bilder zuerst,
     Rest typische Landschaft, nie eine erfundene Sehenswuerdigkeit, Zusatz klein darunter, Karte
     nur klein, Datum/Koordinaten auf einem Band).
   - server.js: ortsflyer bekommt `grossbuchstaben` (getippter Ort, sonst ortName); GA_REV = 24.
   - postkarte/motto-gruesse-aus.json: stileVorne beginnt mit grossbuchstaben (Startseite auch).
   - Beispiel postkarte/beispiele/grossbuchstaben.jpg (Paris mit Otto), Eintrag in
     vorzeige-designs.json; Startseite startseite/postkarten/grossbuchstaben.webp.
   - Abnahme: abnahme-postkarte.mjs (Reihenfolge, ortTeilen, BUCHHOLZ in 8 Buchstaben, Beispiel da),
     abnahme-browser.mjs (erster Stil "Grossbuchstaben").
   LIVE GEPRUEFT (1. Okt.): /api/mo/mottos stileVorne grossbuchstaben, ansichtskarte, reiseplakat;
   Beispielbild 200. NOCH NICHT GESEHEN: die erste echte Kundenkarte, vor allem bei einem Dorf
   ohne Fotos (dann muessen die Buchstaben aus Landschaft kommen, ohne erfundene Kirche).
8. UEBERNOMMEN (Markus, 1. Okt.: "uebernehmen!"): `/` liefert home-neu.html ueber
   `startseiteNeuHtml()` - ohne noindex, mit canonical, og-Angaben, LD-JSON (ldStartseite) und den
   Motto-Kacheln als fertigem HTML (das Skript baut das Raster nur, wenn es leer ist). Die ERSTE
   Freestyle-Kachel steht am Ende; "Gruesse aus" traegt auch freestyle und bleibt eine normale
   Kachel (gemessen: 29 Mottos in /api/mo/mottos, 28 Kacheln + "Alle 28 Mottos").
   `/vorschau-start` -> 301 auf `/`. Bilder unter `/startseite/postkarten/` (alte Adresse geht weiter).
   Die alte Startseite steht unter `/startseite-alt` (noindex, X-Robots-Tag); die bisherigen
   Startseiten-Pruefungen in abnahme-browser.mjs laufen dort, die neuen gegen `/` (Google-Angaben,
   Postkarte vorn, Stilwechsel, zwei Tueren, Abstimmung, Kacheln nicht doppelt, ein Tipp oeffnet
   das Motto, keine kaputten Bilder, Weiterleitung). Abnahme: 1491 von 1491.
   NICHT GEMACHT: home.html geloescht oder umbenannt - es traegt drei weitere Seiten.
9. MOTTOSEITE IN DEN LOGO-FARBEN (Markus, 1. Okt.: "sobald die Leute weitergehen, sehen die naechsten
   Seiten ueberhaupt nicht mehr so schoen aus"). motto.html: dieselben Variablennamen wie bisher
   (--bg, --card, --ink, --accent ...), jetzt mit den Werten aus marke.css - Papier statt Schwarz,
   Gruen als Knopf (Tinte darauf, 9,8 : 1), wo die Akzentfarbe SCHRIFT war, steht Beere (5,8 : 1).
   Die Farbe des Mottos (`__ACCENT__`) ist nur noch `--motto`, ein Streifen am Einleitungskasten.
   Kopf wie die Startseite (Mottos, So geht's, Firmen, Event, Konto). Keine Versal-Etiketten mehr.
   motto-seite.js: SYM_KAMERA und SYM_ORT (SVG) statt Kamera- und Nadel-Emoji. #abfolge hat
   scroll-margin-top, sonst springt der naechste Schritt unter den Kopf. Abnahme prueft Grund,
   Kopf, gruenen Knopf, SVG statt Emoji und Anton im Titel. NOCH NICHT ANGESEHEN: die Ergebnisseite
   nach "Otto starten" (braucht den Bilddienst) - das ist die naechste Stelle zum Nachsehen.
10. ALLE MENUESEITEN IN DEN LOGO-FARBEN (Markus, 1. Okt.: "alle Unterkategorien oben auf der Seite
   verweisen noch auf die alten schwarzen Seiten"). home.html (/so-gehts, /mottos, /stile,
   /startseite-alt), konto.html, firma.html und die Huelle der Rechtstexte und von /event
   (rechtliches.js seitenHuelle) tragen jetzt body.mo-seite und denselben Kopf .mo-kopf wie
   Startseite und Mottoseite. marke.css belegt unter .mo-seite die ALTEN Variablennamen um (--bg,
   --card, --ink, --accent ...), die Seiten behalten ihre Regeln; nur, was dort Gelb/Violett,
   dunkler Schleier oder Akzent-als-Schrift war, ist je Seite ueberschrieben. Keine Versal-Etiketten
   (.mo-seite * text-transform none). Die Abnahme sucht den Kopf jetzt unter .mo-kopf.
   EINGABEN MINDESTENS 16 PX (Markus' Bild vom 1. Okt.: Seite seitlich verschoben, nachdem er im
   Warte-Fenster seine Mail eingetippt hatte): iPhone zoomt bei kleinerer Schrift hinein. Gemessen
   18 Felder unter 16 px auf der Mottoseite, jetzt 0; die Abnahme prueft das.
   OFFEN (Markus, 1. Okt.): "Am Anfang soll man ein Foto hochladen, wo wahrscheinlich auch Menschen
   drauf sind. Wenn ich da kein Foto hochlade, brauche ich nicht die Frage, wie die Menschen
   aussehen sollen." Betrifft die 13 Mottos mit Figurenwahl - GEBAUT am 2. Okt., siehe Punkt 15.
11. ZEICHEN UND EMOJIS (Markus, 1. Okt.: "Und warum sollten wir keine Emojis und Sonderzeichen
   drucken koennen?" - Ja zum Vorschlag). mottos.js stripChars: "…" (macht das iPhone aus drei
   Punkten) wird "...", Anfuehrungszeichen „“”" ‚‘ « », % € @ ° * ; = sind erlaubt, EMOJIS BLEIBEN in
   allen Texten, die die Bild-KI malt. Enthaelt ein Text Emojis, steht EMOJI_SATZ im Auftrag
   (buildPrompt) bzw. derselbe Satz im Postkarten-Auftrag (firmen-flyer.js): als kleines
   handgezeichnetes Bildzeichen im Stil des Designs, nie als Handy-Emoji, nie ausgeschrieben.
   Namenslisten (names.js cleanNames, eigene Schrift ohne Emojis) lassen Emojis weiter weg, mit
   Hinweis. Noch NICHT am Bilddienst gemessen, wie ein Emoji im Bild aussieht.
12. HELL ODER DUNKEL (Markus, 1. Okt.: "ganz oft seh ich Dunkeltextilien mit einem dunklen Design ...
   wir muessen 100 % sein"). GEMESSEN an allen 40 Designs der Bewertungsliste (Druckdateien, auf 48 px
   verkleinert, damit duenne Konturen nicht zaehlen; Anteil der Motivflaeche unter 1,6 : 1 Kontrast
   auf der gezeigten Shirtfarbe): Opa der Beste MO-FAMILIE-20260907-WGK9 69 % (Buchstaben schwarz
   gefuellt), Landwirt MO-LANDWIRT-20260907-NCMU 45 % (dunkler Traktor), ABInauten MO-ABI-20260922-T6ZV
   31 % (Grenzfall), alle anderen unter 26 % und im Bild in Ordnung. Die Pixel-Messung OHNE
   Verkleinern hat das NICHT getrennt (Opa 28 % sichtbar und lesbar, Landwirt 43 % und kaum zu
   sehen) - Lehre: erst gegen das Auge eichen. Die gezeigte Shirtfarbe passte bei allen 12
   Auftraegen mit bekanntem Textil. BEHOBEN: Admin-Auftragsliste zeigte IMMER tee/black, jetzt die
   Farbe des Auftrags (RX8S war weiss bestellt und erschien schwarz). NICHT GEBAUT: automatische
   Pruefung beim Erzeugen und in der Bewertungsliste (Vorschlag an Markus) - beim Vorzeigen
   GEBAUT am 2. Okt., siehe Punkt 14.
   RX8S (Abschlussfahrt, 1. Okt.): bestellt 28 x 20 cm, Druckdatei 3406 x 2433 px bei 309 dpi =
   genau 28,0 x 20,0 cm, Motiv 26,9 x 17,6 cm, Hintergrund durchsichtig. Befund dazu: Sportart
   "Handball", gemalt ist ein FUSSBALL; die Bildpruefung fiel dreimal durch ("Handball" fehlt) und
   das Design ging trotzdem raus.
13. SCHAUFENSTER AUF DER STARTSEITE (Markus, 1. Okt.: "ein Fleckchen, wo wir rotierende Bilder auf der
   gleichen Stelle haben. Mit wirklich schoenen Designs"). Abschnitt "Das hat Otto gezeichnet" direkt
   nach der Postkarte (home-neu.html, #schaufenster): EIN Rahmen, darin wechselt alle 4 s ein Design,
   getragen (Mockup szene=1), darunter Motto und Stil; Pfeile, Anhalten, Zaehler; laeuft nur, solange
   es zu sehen ist; prefers-reduced-motion: nur Pfeile. Unter dem Mauszeiger haelt es nur bei echter
   Maus an - auf dem Handy loest ein Tippen mouseenter ohne mouseleave aus (gefunden in der Abnahme,
   Android, stand danach still). Die Auswahl ist VON HAND: startseite/schaufenster.json, 16 Designs,
   16 Anlaesse, 13 Stile - die Sterne taugen nicht (40 von 40 "besten" bei 5 Sternen, fast alle mit
   einer Stimme). Jedes vorher getragen auf seiner Textilfarbe angesehen; ausgetauscht wurden dabei
   Team Nordlicht College (dunkelgruen auf schwarz) und Steffi 40 Fotorealistisch (dunkler Kuchen auf
   schwarz). DER STIL, DER DRANSTEHT, IST DER AUS DEM AUFTRAG (Markus: "muss natuerlich auch der
   richtige sein, der auch auf dem Shirt ist") - Designs ohne festgehaltenen Stil (style "kachel")
   zeigt schaufensterHtml() nicht. Der Server setzt nur ein, was fertig auf der Platte liegt, sonst
   baut er es im Hintergrund; zurueckgezogene Designs fallen raus. Neues Design = Nummer in die Liste,
   vorher getragen ansehen.
   OFFEN, IDEE VON MARKUS (1. Okt.): "die T-Shirts so praesentieren ... Weihnachtsmotiv in
   weihnachtlicher Umgebung, ganz zu sehen, Abifeier auf der Abifeier, ein Angler beim Angeln, Bowling
   auf der Bowlingbahn". Heute traegt jedes Shirt dieselbe Person im selben Wohnzimmer. Das waeren neue
   Situations-Vorlagen je Motto (Magenta-Weg, mockups.js - Chat-1-Bereich). GEBAUT am 2. Okt. auf
   Markus' Wort ("die Szenen machst du direkt mit"), siehe Punkt 16.

14. DUNKEL AUF DUNKEL BEIM VORZEIGEN (Markus, 2. Okt., auf die Frage: "Ja, auf hellem Shirt zeigen").
   server.js: dunkleFlaeche() misst die Druckdatei wie am 1. Okt. geeicht (48 px, Anteil unter 1,6 : 1
   auf Schwarz) - im Server nachgemessen: WGK9 69, NCMU 45, T6ZV 31, 9YAG 29, JYTG 19, JV5K 1.
   dunkelNachtragen() schreibt den Wert 90 s nach dem Start und dann halbstuendlich in den Pool
   (e.dunkel), anzeigeTextil() zeigt ein Design fuer dunkles Textil ueber 27 % auf hellem Shirt -
   in Bewertung, Galerie-Band, Stil-/Figurenbeispielen, Admin-Liste und Schaufenster. Der
   Kundenauftrag bleibt, wie bestellt. NICHT erkannt: duenne dunkle Linien (JV5K Team Nordlicht
   College, dunkelgruen, 1 %) - das misst die Flaechen-Messung nicht.
15. FOTO ZUERST, FIGUREN NUR MIT FOTO (Markus, 1. Okt.: "Wenn ich da an der Stelle kein Foto hochlade,
   brauche ich nicht die Frage, wie die Menschen aussehen sollen"; 2. Okt.: "geklaert"). Die 13
   Mottos mit Figurenwahl (ohne Freestyle und Postkarte, mottos.js gruppenFoto) bekommen in withBezug
   als erstes Feld "Habt ihr ein Foto von euch?" (upload, ohneGeht, braucht mensch). Schritt 1 mit
   grossem Knopf "Foto waehlen", "Ohne Foto weiter"; ohne Foto ist die Figurenfrage zu und der Server
   nimmt 'standard'; mit Foto kommt sie (nur FIGUREN_FOTO). Die Rechte bestaetigt der Satz am Foto
   (wie bei der Postkarte). Im Lauf: foto.modus 'gruppe' -> Stufe 1 malt die Leute im Stil
   (fotoNachmalenPrompt, ohne Umgebung), Stufe 2 baut das Motto-Design mit dem gemalten Bild als
   Bild 1 und GRUPPENFOTO_AUSNAHME (die Leute vom Foto, die Szene vom Motto). GEMESSEN am Bilddienst
   (drei Testleute, Abschlussfahrt "Klasse 10b / Prag", Comic + Karikatur, Auftrag woertlich aus
   buildPrompt): alle drei erkennbar (Locken, Brille, Bart, Kleidung), Prag mit Karlsbruecke und
   Burg, Texte richtig, auf Schwarz sauber freigestellt. Die Karikatur blieb mild (Stufe 1 hielt die
   Proportionen). Abnahme: Abschnitt 1 (Rechnung) und 7 (drei Geraete).
16. SZENEN JE MOTTO (Markus, 2. Okt.: "die T-Shirts so praesentieren ... Weihnachtsmotiv in
   weihnachtlicher Umgebung ... Abifeier auf der Abifeier, ein Angler beim Angeln, Bowling auf der
   Bowlingbahn" - "die Szenen machst du direkt mit"). 27 Szenen, je Motto ein Foto in Weiss und
   Schwarz (vorlagen-original/tee-szene-thema-<motto>_<farbe>.jpg), Bestellzettel SZENEN_ZETTEL in
   vorlagen.js (Person von der Huefte aufwaerts, frontal, Ding in der Hand, nie vor der Brust), die
   schwarze Fassung als Bearbeitung desselben Fotos, Flaeche mit flaecheAusMagenta gemessen,
   Magenta mit magentaEntfernen entfernt (nachgezaehlt: kein Rest in 54 Dateien). Bei Bowling und JGA
   (schwarz) hielt die Messung Neonlicht fuer Magenta - dort gilt die Flaeche der weissen Fassung
   (gleiches Foto, alle anderen Paare liegen 1-2 px beieinander). mockups.js MITGELIEFERT
   'tee-szene-thema-<motto>' (boxen je Farbe, wer), SZENE_THEMEN, szeneThemaFuer; die Mockup-Route
   nimmt bei szene=1 die Szene des Mottos (Datei ..._szene_thema-<motto>_v<Stand>.jpg), wenn der
   Vorname auf dem Design nicht zum anderen Geschlecht passt. Erste Probe ab den Knien: Flaeche nur
   166 px breit - deshalb ab der Huefte (rund 180-200 px). Nur das T-Shirt; Hoodie, Polo, Zip nicht.
   BABYSHIRT (Markus, 2. Okt.: "Jungs Name ist dann natuerlich kein rosa Zimmer ... wenn's Maedels
   Name ist, dann rosa Zimmer, da duerfen wir schon gerne klassisch bleiben"): beim Babyshirt ist der
   Name der des KINDES. Er sperrt die Szene nie, er waehlt das Zimmer: nameFeld 'babyname',
   nachName { frau: 'geburt-baby-rosa' } (mockups.js, eigener Eintrag mit variante, kein eigenes
   Motto). Rosa nur, wenn jeder erkannte Name ein Maedchenname ist (vornamen.js); Jungenname,
   unbekannter Name ("Lasse", "Chantal" stehen nicht in der Liste) oder Zwillinge gemischt -> das
   helle Zimmer. Vorher las werFuerMockup nur das Feld mit personal - babyname hat das nicht, der
   Name wurde also nie gelesen. Lokal nachgestellt: Emma -> rosa, Lasse -> hell, beide Farben.

17. GROESSEN GEMESSEN (Markus, 2. Okt.: "alle Groessen machen und messen, ob die Groessen stimmen").
   Kopf aller 199 Live-Druckdateien gelesen, 22 davon ausgemessen (Motivflaeche ohne durchsichtigen
   Rand, geeicht an RX8S = 26,9 x 17,6 cm), 8 x 8 und 25 x 10 neu durch Server und Bilddienst:
   die DATEI hat immer genau das Mass (8,0 x 8,0 · 10,0 x 10,0 · 25,0 x 10,0 · 28,0 x 20,0 · 30,0 x 35,0
   bei 225 dpi). Das MOTIV darin nicht beim Streifen: 9,4 / 12,2 / 13,6 cm breit statt 25 - die erste
   Zeile der Motto-Auftraege sagt "portrait" (Markus' Text in seed.json, nicht angefasst) und der
   Aufbau-Zufall zog Raute, Kreis, Wappen. BEHOBEN im Auftrag (mottos.js formatAusMass, VARIETY.layoutBreit,
   buildPrompt extra.format setzt in der ERSTEN Zeile das echte Format; server.js freierDruckBlock
   "THE ARTWORK FILLS THE WIDTH"): gemessen 24,5 x 6,8 und 24,1 x 9,1 cm. Hochgerechnet wird nur die
   Standardgroesse (makeMaster, ohne Mass); ein freies Mass bleibt bei seinen dpi (30 x 35: 225).
   GROESSE ALS EIGENER SCHRITT (Markus: "noch ein Feld dazu packen mit freier Groessenauswahl, ganz
   wichtig" - Antwort auf die Frage: "Eigener Schritt"): nach dem Stil, Kacheln Brust klein 8 x 8 ·
   Brust 10 x 10 · Streifen 25 x 10 · Brust gross 28 x 20 · Ruecken 30 x 35 · Eigene Groesse (oeffnet
   Breite x Hoehe) · Standard. Freestyle: dieselben Kacheln bei "Worauf soll es?", ohne Standard.
   Der Kasten heisst jetzt f-druckmass - f_groesse ist beim Babyshirt das Feld "Groesse" (Laenge),
   und mit zwei gleichen Kennungen fand die Seite immer das Babyfeld (live so, im Browser gemessen).
   In abnahme-postkarte.mjs (Chat 2) deshalb drei Erwartungen nachgezogen: Kennung und die Abi-Abfolge
   mit dem Schritt groesse - sonst nichts.

18. KEIN SPORT AUF DER STARTSEITE (Markus, 2. Okt.: "Das Thema Sport hat jetzt erst mal hier gar
   nichts zu suchen. Erst in dem Moment, wo wir was mit Sportvereinen machen ... Sport erst mal
   rauslassen, mit Fussball und Handball faellt"). Ein Entwurf mit gezeichneten Fussball- und
   Handballfeldern hinter den Abschnitten (3a12b58) ist zurueckgenommen, er war nie live. Sport als
   Gestaltung erst, wenn es ein Angebot fuer Sportvereine gibt.

19. SCHAUFENSTER: HOODIE, DIE EIGENEN MASSE, RUECKEN (Markus, 2. Okt., mit Bild vom Schaufenster: "bis auf
   Hochzeit das unpassend, aber warum immer ein T-Shirt und immer die gleiche Groesse ... mal Hoodie, mal
   T-Shirt, mal klein, mal gross, mal was auf dem Ruecken").
   FESTE VORGABEN VON MARKUS - NICHT WIEDER VERGESSEN ("Ich moechte nicht immer wieder alles neu erklaeren"):
   - HOECHSTMASS AUF TEXTIL: 38 x 48 cm (Breite x Hoehe). server.js FREI_CM {maxBreite 38, maxHoehe 48},
     Eingabefelder der eigenen Groesse max 38 / 48 (vorher 45 x 45).
   - GANZ GROSS SIEHT DOOF AUS. Kein Motiv bis an die Naht.
   - ES GELTEN UNSERE EIGENEN MASSE ("wir haben doch eigene Masse und die soll doch nutzen"): Brust klein
     8 x 8 · Brust 10 x 10 · Streifen 25 x 10 · Brust gross 28 x 20 · Ruecken 30 x 35 (GROESSEN in
     motto-seite.js) - nichts dazuerfinden (ein "mittel" und ein "gross" von mir waren falsch).
   - BEIM ABI-SHIRT STEHEN HINTEN DIE NAMEN. Ein Abi-Design kommt nicht als Motiv auf den Ruecken.
   - DAS MOTIV GEHOERT INS TEXTIL, nicht "drauf geknallt": Falten und Licht des Fotos liegen auf dem Druck.
   GEBAUT: mockups.js DRUCK_MASSE (genau die fuenf Masse, herz/mitte/ruecken), ?druck=<schluessel> in der
   Motto-Szene; startseite/schaufenster.json je Eintrag teil (tee|hoodie) und druck, das Mass steht unter
   dem Bild ("Hoodie, Brust 10 x 10 cm"). Das Mass muss zur Form des Designs passen - die Designs sind
   hochkant (gemessen 26-30 x 35-45 cm in Dateien von 30,7 x 46 cm), also kein Streifen. Ruecken nimmt die
   Rueckseite des Designs (backMaster: KI-Rueckseite oder Namensliste), nur ohne beides das Motiv.
   stoffSchatten(): Helligkeit der Vorlage (weich) gegen ihren Mittelwert im Druckbereich, auf weissem
   Stoff mit multiply schwaecher; Dateien ..._thema-<motto>[-<druck>]-stoff.
   Neue Szenen (Bilddienst, szeneThemaAuftrag mit teil/ruecken): Hochzeit = Braeutigam am Hochzeitsauto,
   Braut lachend dahinter (vorher ein Gast im Shirt zwischen Anzuegen); Hoodie fuer Motorrad, Jaeger,
   Handwerker, Weihnachtsfeier; Ruecken fuer Abi, JGA, Malle, Vereinsjubilaeum.
   MEIN MESSFEHLER, damit er nicht wiederkommt: ich hatte die Magenta-Flaeche auf Brusthoehe gegen die
   Shirtbreite gemessen - MIT den Aermeln - und daraus "halb so gross" gemacht und alles verdoppelt (bis an
   den Rand). Unter den Achseln gemessen ist die Flaeche 63 % des Rumpfes (Median aller Szenen), genau wie
   die alten Szenen tee-szene-mann/-frau (61 / 71 %): die Flaeche IST die Druckflaeche 36 x 46. Regel
   "ueberraschende Messung erst am bekannten Fall pruefen" - hier haette der Vergleich mit tee-szene-mann
   den Fehler sofort gezeigt.
   ABI-RUECKEN, ZWEITER ANLAUF (Markus, 2. Okt.: "nicht in Hoechstmass gebaut", "nicht in den Stoff eingearbeitet",
   "verhindern, dass wir einfach eine richtige Platte da draufhaben"). Vier Ursachen, alle gemessen:
   - MASSSTAB: die Szenen-Flaeche ist je Foto verschieden gross (vorne rund 30 cm, Abi-Ruecken 23 cm, Hoodie 17 cm
     ihrer Breite) - wer sie als "36 x 46" nahm, druckte zu klein. Jetzt SZENE_SHIRT_PX (gemessene Shirtbreite je
     Szene, weisse gegen schwarze Fassung) und SHIRT_CM 53: 38 cm sind rund 72 % der Shirtbreite.
     ZWEITER MESSFEHLER (Markus mit Bild: "das geht doch ueber die Breite des Rueckens, das ist ja schon auf dem
     Aermel"): bei den Ruecken lagen die Messzeilen auf Hoehe der Aermel - Abi 428 statt 315 px Rumpf, Verein 458
     statt 325; der Druck war 35 % zu breit. Jetzt der RUMPF (Zeilen ab Mitte der Flaeche abwaerts, 25. Perzentil)
     und bei den Ruecken die Rumpfmitte statt der Flaechenmitte (SZENE_RUMPF_MITTE, Versatz 36-51 px: der Traeger
     dreht sich ueber die Schulter). Vorderseiten aenderten sich um hoechstens 32 px (Angler). Hoodies NICHT
     gemessen: die anliegenden Aermel zaehlen in der Maske mit; dort gilt weiter die Flaeche als 30,7 cm.
     DANN "NOCH EIN BISSCHEN GROESSER UND MITTIG": in allen vier Ruecken-Fotos ist das Shirt optisch doppelt so lang
     wie breit (echt 53 x 72 cm) - der Ruecken wirkt schmaler. Ruecken-Massstab jetzt aus der Laenge (Kragen bis
     Saum = 72 cm, SZENE_RUECKEN), hoechstens 85 % des Rumpfs fuer 38 cm; Mitte des Drucks auf 45 % der Laenge.
     DANN "NICHT MITTIG", "DIE MITTE MUSST DU DOCH VON DER RUECKSEITE NEHMEN" und "DIE GRUENE LINIE SITZT NICHT AUF DER
     MITTE DES RUECKENS": massgebend ist das RUECKENTEIL - oben die Mitte zwischen den Armlochnaehten, unten die Mitte
     des Saums, AM BILD MIT RASTER ABGELESEN (SZENE_RUECKEN_ACHSE: Abi 555 -> 520, JGA 542 -> 515, Malle 530 -> 495,
     Verein 488 -> 442). Drei Messungen davor lagen daneben, alle mit Markus' Bild widerlegt: der Kragen (bei
     gedrehtem Kopf nicht mittig), der Rumpf aus der Maske (den verdeckt der haengende Arm) und der aeussere Umriss
     MIT Aermeln (der vordere Aermel steht weiter ab, Abi 526 statt 555). Lehre: eine Mitte, die das Auge beurteilt,
     wird am Bild abgelesen - an den Naehten -, nicht aus einer Maske gerechnet. Jede Zeile des Drucks sitzt auf der Achse.
     DANN "DU MUSST DIE KRUEMMUNG VOM T-SHIRT MIT RECHNEN": der Ruecken ist ein Zylinder (rueckenWoelben, mockups.js).
     Radius aus dem halben Abstand der Seitenkanten des Rueckenteils (SZENE_RUECKEN.halbe, am Bild abgelesen: Abi 155,
     JGA 152, Malle 155, Verein 145 px), dort geht der Ruecken unter 75 Grad weg; die 53 cm Rueckenbreite liegen als
     Bogen dazwischen, 38 cm Druck sind auf dem STOFF gemessen. Kamera 1200 px vor dem Ruecken auf 30 % der Laenge:
     zu den Seiten hin gestaucht, die unteren Zeilen steigen an den Seiten leicht an. Abi: 285 px Bogen -> 249 px im
     Bild (flach vorher 254), Hoehe 381 statt 338 px. Bekannter Fall in der Abnahme: 200 px auf r 100 -> 162 px.
     DANN "JETZT NOCH 2 CM NACH RECHTS CIRCA UND DANN BIST DU IN DER MITTE": RUECKEN_VERSATZ_CM = 2, auf dem Stoff
     gemessen (Massstab des Rueckens, Abi rund 16 px), fuer alle vier Ruecken. ACHTUNG, Widerspruch zur Messung: aus
     den sichtbaren Stoffkanten unter den Achseln gemessen sass der Druck VOR dem Versatz schon 10-16 px rechts der
     Rumpfmitte (Abi L 57 / R 25 px bei y 700), oben an den Armlochnaehten links davon. Eine Achse aus diesen Kanten
     (Neigung -0,13 bis -0,16) hatte ich gebaut, aber nicht gezeigt - Markus' Auge entscheidet. Wenn er das naechste
     Mal "zu weit rechts" sagt: diese Messung liegt in der Geschichte von 2. Okt.
   - DIE PLATTE WAR DIE VORLAGE: magentaEntfernen hatte in ALLEN 36 Szenen ein glattes, verrauschtes Rechteck ohne
     Falten hinterlassen - sichtbar schon auf dem leeren Shirt. werkzeug/falten-einsetzen.mjs: Loch schneiden (das
     durchsichtige Loch ist die Maske - kein Base64 von Hand), Bilddienst malt Stoff hinein, NUR die Flaeche kommt
     zurueck, Ton per Ebene angeglichen (Kantensprung vorher 2-13, danach am Kontaktbogen unsichtbar). 72 Dateien,
     Stand je Szene +1. Die Abnahme bewacht nur grob (Kantensprung unter 12) - das Auge war die Pruefung.
   - DRUCK AUF DEM ARM: gedruckt wird nur noch, wo Stoff ist (stoffMaske: weisse und schwarze Fassung unterscheiden
     sich). Rauschen des Bildmodells unter Alpha 16 gilt als leer (war eine graue Punktflaeche hinter den Namen).
     stoffSchatten verschiebt den Druck zusaetzlich mit den Falten und legt die Webstruktur darauf.
   - RAHMEN: der Abi-Ruecken (backPrompt in seed.json, nur dieser Absatz) bestellt keine durchgehenden Seitenleisten
     mehr, sondern lose Stuecke und "NO FRAME, NO BOX, NO PLATE"; ein Serverstart zieht den Auftrag nach, wenn er
     noch der alte ist. Namensliste: Korridorbreite aus den breiten Zeilen (vorher bestimmte die engste: 45 % statt 59 %).

20. EIN TIPP, UND DIE NAECHSTE FRAGE IST DA (Markus, 2. Okt.: "wenn ich was angeklickt hab, dass sofort die
   naechste Auswahl aufgeht, ohne auf Weiter zu druecken" - "das muss mega schnell gehen"). abfolge.js (gilt fuer
   jedes Motto): ein Tipp auf eine Wahl-Kachel (data-x Textil, data-s Stil, data-w Kachelwahl, data-fg Figuren,
   data-b/data-standard Groesse) oeffnet nach 280 ms den naechsten Schritt - wenn es die LETZTE sichtbare
   Kachelreihe des Schritts war, kein Feld zum Tippen offen ist und nichts fehlt. Nicht bei "Eigene Groesse"
   (danach wird getippt), nicht in Schritten mit Foto oder Ort (dort kommen weitere Fotos, Ort pruefen). Ein
   Schritt mit nur einer Liste (select) geht nach der Wahl genauso weiter; in einem Textfeld fuehrt die
   Eingabetaste weiter. Weiter bleibt fuer alles andere. Browser-Abnahme (drei Geraete): Kartenform -> Stil ->
   Personen ohne Weiter, "Mein Foto im Original" springt zum Text, "Im Stil" bleibt stehen bis zur Figur,
   "Meine eigenen Fotos" im Ortsschritt bleibt stehen.
21. PARTNER-STILE (Markus, 2. Okt.: bei EAST26 und Luigi "stehen jetzt drei Stile ... Wir sollten Aquarell,
   Meisterwerk, Minimalistic und Popart nehmen"). Live gemessen: beide zeigten die Vorgabe Aquarell, Comic, Pop-Art
   (es gab dort kein Graffiti - die Pop-Art-Kachel). partner.js (Chat 2, auf Markus' Wort): STANDARD_STILE =
   aquarell, meisterwerk, minimal, popart, MAX_STILE 4; bei-machen.html zeigt vier als 2 x 2. Wer im Partnerbereich
   eigene Stile gewaehlt hat, behaelt sie.
22. ZWEI NEUE STILE: GLITZER UND DISCO (Markus, 2. Okt.: "einmal Glitter, alles voll mit Glitzer, und einmal Disco,
   wirklich wie in den Siebzigern, mit Spiegelkugeln"). mottos.js STYLES.glitzer / STYLES.disco, beide nach dem
   Material-Prinzip (Flocken und Pailletten wie Glitzerkleber; Spiegelkugel aus Spiegelplaettchen, Airbrush und
   Siebdruck von 1977, ausdruecklich NICHT die 80er von Neon), Textil dunkel, im Partner-Shop waehlbar. Kacheln
   stile/kacheln/glitzer.jpg, disco.jpg und Paris-Karten postkarte/beispiele/glitzer.jpg, disco.jpg (Auftrag aus
   werkzeug/stilbeispiele.mjs, Disco im zweiten Anlauf: "Gruese" -> "Gruesse"). GEMESSEN am Bilddienst mit dem
   Geburtstags-Auftrag (Lena, 40, "Endlich 40!", schwarzes Shirt, Szene geburtstag): beide Texte richtig, frei
   stehend, 43-48 % leer, 3-4 % halbtransparente Kante. Startseite (home.html): "in sechzehn Stilen".

23. LUIGIS SHOP: JEDER ARTIKEL SEIN DESIGN, MINIMAL RAUS, ZURUECK (Markus, 2. Okt., mit Bild vom Tor: "das Luigi Logo kann
   nicht auf dem schwarzen Hintergrund stehen", "jeder Artikel sein eigenes Design ... genau auf die Artikelgroesse
   abgestimmt", "zu sehen, dass man es personalisieren kann", "ueberall fuenf Sterne", "nicht alle im gleichen Stil",
   "Minimalistic ist nichts ... wir nehmen den Glitzer Stil anstatt", "keine Moeglichkeit, wieder zurueckzukommen").
   - postkarte/haus/luigispizzaug-<teil>.jpg: sieben eigene Designs im Format des Artikels, alle mit Logo auf Creme,
     Name/Datum und fuenf Sternen: Shirt Pop Art, Hoodie Glitzer, Kissen Meisterwerk, Poster Pop Art, Strandtuch und
     Acrylbild Aquarell, Fussmatte Glitzer. Haus-Karte neu: Logo auf Creme statt auf der schwarzen Platte.
   - TEXTIL LOCKER, KEIN PLACKEN (Markus: "genuegend freistellen ... dass das DTF sonst wie ein grosser Placken nicht
     schoen anzufassen ist"). Gemessen: Anteil 64-px-Zellen im Motivumriss, die ganz deckend sind - erstes Shirt 58 %
     (Placken); zweites 20 %, aber lose verstreute Teile (Markus: "wie gewollt und nicht gekonnt"); drittes = EIN
     geschlossenes Emblem mit Luft darin (Kaesefaeden, Sterne, Rasterpunkte): 33 %, Hoodie 37 %, zum Vergleich Geburtstag Glitzer 24 %, Disco 39 %. Alpha unter 96 = leer
     (der Glitzer-Schein lag dort). Hoodie: Motiv endet ueber der Tasche (Rand unten 48 % der Hoehe frei).
   - partner.js STANDARD_STILE = aquarell, meisterwerk, glitzer, popart (Minimal raus).
   - haus.html: Leiste oben "Zurueck" (eigene Seite davor -> history.back, sonst /partner), "Alle Partner", "Motto Otto";
     im Shop "Dein Name · Dein Datum · Dein Selfie · fuenf Sterne" und je Kachel "mit deinem Namen".
   - partner-werden.html: Kasten "Das absolute Highlight - Personalisiertes Merch".
   ERLEDIGT mit Punkt 24: EAST26 und der neue Partner Bestes vom Elbdeich haben ebenso je Artikel ein Design.
24. EAST26 UMGEBAUT, NEUER PARTNER BESTES VOM ELBDEICH HAMBURG (Markus, 2. Okt.: "East 26 umbauen und wir haben einen
   neuen Partner. Da muss es natuerlich auch schick gemacht werden und da ist der Gutschein nicht zu finden" - und:
   "dass du dir einmal die Adresse anguckst, ob die Bilder halbwegs hinkommen koennen").
   - Der neue Partner hat sich SELBST angemeldet (Volume, Slug bestesvomelbdeichhamburg, Status aktiv) - nicht derselbe
     Eintrag wie "Bestes vom Elbdeich" im Repo (bestesvomelbdeich, ohne Tor). Seine Bilder liegen im REPO unter
     postkarte/haus/bestesvomelbdeichhamburg-<teil>.jpg (+ -karte.jpg); haus-route nimmt das Repo vor dem Volume.
   - ADRESSE GEPRUEFT (Seite bestes-vom-elbdeich.de gelesen): ANGUS-Rinder (schwarz, ohne Hoerner), Freilandhuehner,
     Wasserbueffel, eigener Obsthof (50.000 Apfel-, 9.000 Kirschbaeume), Saft, Joghurt, Eingemachtes; Moorburg = Marsch
     am Deich, Weiden, Kraene nur fern. Die erste Runde hatte Holstein-Kuehe, einen Leuchtturm und einen Elbstrand -
     alles falsch, neu gebaut mit einem Faktenabsatz im Auftrag ("FACTS OF THIS FARM ... NO lighthouse ...").
     EAST26: Santanyi ist goldener Sandstein, die Cala Santanyi liegt rund 3 km entfernt - passt.
   - EAST26: das Logo kam beim ersten Lauf dreimal auf einer SCHWARZEN Platte und als Wandschild ein zweites Mal -
     im Auftrag jetzt "gold letters directly on ivory, no black square" und "EAST26 appears ONLY in that logo".
   - Flachware (Kissen, Poster, Tuch, Acryl, Matte) mit artikel {ansicht, motivart 'vollflaechig'} gebaut -> Regel 9,
     100 % Flaeche, keine Flaggenstreifen mehr (auch Luigis Kissen, Tuch, Acryl neu). Die Abnahme misst am Tuch,
     dass oben kein Flaggenband liegt (geeicht: alte Tuecher 12,8 / 79,1, neue 162 / 164, Grenze 100).
   - Textil gemessen (voll deckende 64-px-Zellen): EAST26 Shirt 37 %, Hoodie 6 %; Elbdeich Shirt 37 %, Hoodie 31 %.
   - HAUSFARBE CREME (#FFF2D5, vom Partner gesetzt): Schrift, Etiketten und Knoepfe des Tors waren unsichtbar.
     haus-route akzentVon(): eine Hausfarbe heller als 0,6 wird nie Schrift - naechste dunkle Hausfarbe, sonst die
     kraeftigste bunte Logofarbe (dominantColors, mind. 4 %), sonst Tinte; Log "Tor-Akzent: ...". Lokal nachgestellt
     mit dem Live-Eintrag: #FFF2D5 -> #FF353A (Logo-Rot); EAST26 und Luigi unveraendert.
   - GUTSCHEIN: beim Elbdeich steht im gespeicherten Angebot gutschein: false - der Haken "Gutschein" im
     Partnerbereich ist nicht gesetzt. Nicht von Hand auf dem Volume geaendert. Neue Anmeldungen bekommen den
     Gutschein ab jetzt angeboten (partner.js, Anmeldung gutschein: true). Kaufen braucht weiter STRIPE_SECRET_KEY
     und ein Connect-Konto des Betriebs.
   - AUS DER GROK-ANALYSE (Markus: "nur das, was du selber fuer sinnvoll haeltst"): gemessen bestaetigt und gebaut:
     (1) Menue brach bei 390 px um ("Event" allein) - jetzt eine Zeile bis 320 px, Kopf 112 px (home-neu.html,
     marke.css); (2) Filter "Alle / Fuer eure Gruppe / Als Geschenk oder fuer dich" ueber den Mottos (gruppen-
     mottos.json, data-art an der Kachel); (3) Fanclub-Kachel: "Braucht die Freigabe des Vereins" (needsApproval).
     NICHT uebernommen: Hero auf Gruppen-Shirt drehen (Postkarte vorn ist Markus' Entscheidung), Alt-Texte (gemessen
     0 von 89 Links ohne Namen, leere Alt nur an Zierbildern), "sechs frei / fuenf nach Login" (kein Widerspruch:
     1 + 5 = 6, Markus' Text).

25. FREIWILLIGES FOTO SPERRTE DEN START (Markus, 3. Okt., Hochzeit ohne Foto: "lässt er mich unten nicht
   weitermachen"). Mein Fehler aus Punkt 15: die Abfolge liess "Ohne Foto weiter" zu, aber refresh() in
   motto-seite.js zaehlte jedes upload-Feld als Pflicht (ok = !!fotoSitzung) - "Bitte noch ausfuellen: Habt ihr
   ein Foto von euch?", Start gesperrt, in allen 13 Mottos mit Figurenwahl. Lokal nachgestellt (Hochzeit, Paar
   ausgefuellt, kein Foto -> gesperrt), jetzt ok bei ohneGeht; die Browser-Abnahme prueft es auf drei Geraeten.
   Lehre: die Abnahme ging den Foto-Schritt, aber nie bis zum Startknopf ohne Foto.
26. NAMENSFRAGEN NUR MIT NAMEN (Markus, 3. Okt.: "wenn jemand keinen Namen ausgewaehlt hat, dann muss man
   ja auch nicht mehr angeben, wo die Namen hin sollen" - und: die Feinheiten bleiben, das war mein Vorschlag,
   nicht sein Wort). Gemessen: in allen 10 Mottos mit Namensliste (alle freiwillig) standen "Wo sollen die Namen
   hin?", "Wie soll der Name erscheinen?" und "Schriftart fuer die Namen" auch ohne einen Namen da - die Seite
   fragte nur, ob das Motto eine Liste HAT. Jetzt refresh() in motto-seite.js: die drei Kaesten nur, wenn ein
   Name eingetragen ist; Loeschen nimmt sie wieder weg. Hochzeit ohne Namen: Foto, Paar, Namen, Dazu, Textil,
   Stil, Groesse, Feinheiten (Stimmung, Farben), Los. Abnahme Abschnitt 7 auf drei Geraeten.
   Dazu "Alle Namen auf die Rueckseite" (13 Mottos): ohne Namen weg, ein gesetzter Haken geht dabei aus.
27. EINE SEITE JE FRAGE (Markus, 3. Okt.: "die Abfolge bitte jetzt umbauen ueberall, so dass es fuer den Kunden ganz
   einfach ist, dass immer wieder eine neue Seite aufgeht - eingetippt, naechste Seite geht auf bis zum Ende").
   abfolge.js teilen() in planen(): jeder Schritt mit mehreren Fragen wird geteilt - "Noch etwas dazu?" (bis zu
   fuenf Felder auf einer Seite) wird je Feld eine Seite, "Feinheiten" je Kasten (Farbstimmung, Lieblingsfarben,
   Schrift, Name), Freestyle "Worauf soll es?" in Artikel und Groesse, Postkarte und Gutschein Gruss/Absender/
   Zeile je eine Seite. Gilt fuer die Standard-Abfolge UND die Mottos mit eigener Abfolge (Postkarte, Gutschein -
   deren Dateien sind nicht angefasst). Zusammen bleibt: ein Feld mit seinen zeigeWenn-Feldern, die Vorschlaege
   bei ihrem Feld, Foto mit Rechte-Haken, der Ort der Postkarte (nur bei standort - Hochzeit hat auch ein Feld
   "ort"), Foto-Weg mit Figuren, das Logo mit seiner Art. Eine Seite, deren Frage gerade zu ist, wird
   uebersprungen (leer). Jede Seite beginnt oben (scrollTo 0, ohne Gleiten); ist sie eine Tippfrage, steht der
   Cursor schon im Feld und die Taste heisst "Weiter" (enterkeyhint next); Eingabetaste, Kachel, Vorschlag und
   ein Haken als einzige Frage gehen von selbst weiter. GEMESSEN: alle 30 Mottos plus Gutschein und Haus-Textil im
   Browser bis "Alles klar?" (ein Probelauf je Motto, iPhone-Breite) - ausser Postkarte und Gutschein, die lokal
   am Foto/Ort haengen (ohne Bilddienst und Ortung, im alten Stand genauso; Abschnitt 7 geht beide mit Probefoto).
   Mehr Seiten (Hochzeit 9 -> 13), jede mit einer Frage. NICHT GEMACHT: das Design der Seiten selbst (groessere
   Kacheln, Kopf kleiner) - das war mein Vorschlag, nicht sein Auftrag.
28. SCHAUFENSTER MIT DEN NEUEN ENTWUERFEN (Markus, 3. Okt., mit Bild vom Handwerk-Hoodie: "Warum sind die eigentlich
   noch nicht ausgetauscht? Da haben wir doch ... dran gearbeitet" - auf die Frage, wer waehlt: "2" = ich waehle).
   Am 2. Okt. waren 30 Entwuerfe gebaut (je Motto zwei, Auswahlseite https://claude.ai/artifact/PqJAwei4dXxUTkUQJQ5LUr,
   Markus: "Diese Abwechslung finde ich gut") - eingesetzt wurden sie nie, der Abi-Ruecken hat den Tag gefressen. MEIN
   VERSAEUMNIS. Jetzt: je Motto einer, gewaehlt auf Abwechslung im Aufbau (Abi 1, Motorrad 1, Hochzeit 1, Darts 2, Malle 1,
   Karneval 2, Verein 2, Jaeger 2, Weihnachten 2, Sprueche 1 - die 2 stand auf einer Platte -, JGA 1, Bowling 2 - die 1 ist
   ein Placken -, Angler 1, Baby 2, Geburtstag 1); Handwerk war nicht dabei und ist neu (Vintage, "Tischlerei Brandt /
   Buchholz / Aus Holz gemacht", 43 % frei - Beispielwerte von mir, passend zur Tischler-Szene).
   SO LIEGEN SIE: Bild im REPO startseite/schaufenster/<motto>.webp (verlustfrei, Alpha), Eintrag in vorzeige-designs.json
   mottos.<motto>.schaufenster {style, textile, datei, values}. vorzeige.js autoImport legt daraus beim Start ein echtes
   Design an, Platz "<stil>#schaufenster" (NICHT in der Stil-Galerie, publicSamples laesst '#' weg), syncVorzeigeShowcase
   nimmt es freigegeben in den Pool (Stil ohne '#...'). startseite/schaufenster.json zeigt mit {vorzeige, stil} darauf,
   teil/druck wie am 2. Okt.; Darts und Handwerk ohne druck (Brust gross 28 x 20 machte das hochkante Darts-Motiv klein - Brust gross traegt jetzt das runde Hochzeit-Emblem,
   10 x 10 war genau der Fleck auf Markus' Bild). Ein getauschtes Bild (andere Groesse) wird beim naechsten Start neu
   angelegt. Lokal gemessen: 16 von 16 angelegt, 0 Fehler, 16 Bilder im Schaufenster, alle getragen angesehen.
   LIVE nach dem Deploy: der Import laeuft 20 s nach dem Start, die getragenen Bilder baut der erste Besuch im Hintergrund -
   bis dahin zeigt das Schaufenster weniger Bilder (nie einen leeren Rahmen).
29. AUTO-WEITER AUF JEDER SEITE (Markus, 3. Okt., nach dem Deploy von Punkt 27: "Die naechste Seite funktioniert
   nicht wieder ... das muss immer weiter gedrueckt werden"). Nachgestellt im iPhone-Browser, Hochzeit: Farbstimmung,
   Schrift, Namensart standen nach dem Tipp still - ihre Kacheln (data-m, data-f, data-n, dazu data-p Druckplatz und
   data-l Logo-Art) fehlten in WAHL (abfolge.js), solange sie nur auf "Feinheiten" mit anderen Kaesten zusammen
   standen, fiel das nicht auf. Freestyle: die Groesse stand still, weil Breite x Hoehe dort immer offen sind - eine
   Groessen-Kachel fuellt sie, sie zaehlen dann nicht als offenes Tippfeld. Mehrzeilige Felder (langer Spruch,
   "Was soll drauf?"): die Eingabetaste fuehrt jetzt auch dort weiter (Zeilenumbrueche macht stripChars ohnehin zu
   Leerzeichen). GEMESSEN: Hochzeit, Abi, Freestyle, Firmenausflug, Geburtstag, JGA, Babyshirt bis "Alles klar?" -
   Weiter nur noch auf Foto- und Logo-Seiten (dort wird hochgeladen). Abnahme Abschnitt 7 geht Hochzeit (mit Namen)
   und Freestyle so auf drei Geraeten.
30. WAS ES ALLES GIBT, AUF DEN ERSTEN BLICK (Markus, 4. Okt., mit Bild der Startseite auf dem Handy: "wenn die
   Menschen das auf dem Handy aufmachen, denken sie erst mal nur, dass es nur Postkarten gibt ... einer coolen
   Laufschrift oder Aehnliches" - auf meine Vorschlaege: "Ja, mach das so"). home-neu.html: LAUFBAND direkt unter
   dem Kopf (nav.laufband): Postkarten, T-Shirts, Hoodies, Kissen, Gruppen-Shirts, Poster, Beutel, Strandtuecher je
   mit Bildchen (startseite/laufband/<teil>.webp, 160 x 200, echte Schaufenster-Designs mit makeMockup auf den
   Vorlagen gebaut), dazu "Fuer eure Gruppe", "Als Geschenk", "Gemeinsam abstimmen"; jedes antippbar (Postkarte ->
   /m/gruesse-aus, Textil -> #gruppe, Flachware -> #artikel = Abschnitt "Und fuer jeden Artikel"). Laeuft 38 s je
   Runde, haelt unter Maus/Fokus an, bei "weniger Bewegung" steht es und laesst sich wischen. Die Tasse fehlt
   (nicht verkaeuflich). UEBERSCHRIFT: "Selfie rein. <Wort> raus." - das Wort (Beere) wechselt alle 2,2 s durch
   Postkarte, T-Shirt, Hoodie, Kissen, Poster, Beutel, Strandtuch, nur solange es zu sehen ist; die Postkarte darunter
   bleibt stehen (Markus' Entscheidung "Postkarte vorn"). Gemessen: Hoehe der Ueberschrift bei jedem Wort gleich
   (iPhone SE 80, iPhone 13 90, Laptop 264 px - dort steht das Wort auf eigener Zeile), kein seitliches Scrollen.
   DAZU (Markus, 4. Okt.: "Unter Motto steht Shirt, Tasse und Co. - das hat nichts bei Motto zu suchen, und Gutschein
   hat auch nichts bei Motto zu suchen. Gutscheine funktionieren ja definitiv nur bei Partnern vorerst"): server.js
   NUR_UEBER_PARTNER {haus, gutschein} / inMottoListe() - raus aus /api/mo/mottos, Sitemap, Startseiten-Kacheln
   (neu und alt). /m/haus und /m/gutschein bleiben fuer das Tor erreichbar.
31. VIER BEFUNDE VOM 4. OKT. (Markus, mit Bildern vom Laptop):
   - BRETTER ("Wir hatten das eigentlich so gebrummt, dass so grosse Flaechen komplett gedruckt eigentlich nicht mehr
     vorkommen" - "Die muessen Unterbrechung haben. Das Ganze fuehlt sich sonst an wie ein Brett", Bild: Kegeltour Japan
     auf der Zip-Jacke im Band). brett.js vollDeckend(): Anteil voll deckender 16-px-Zellen (Druckdatei auf 512 px,
     Alpha ab 96 = Motiv, voll = jede Zelle ab 230) - dieselbe Messung wie bei Luigi am 2. Okt. GEMESSEN an 24 Live-
     Druckdateien: Kegeltour Japan TF3Z 79, Neon PMQU 77, Angler TUZN 72, Abschlussfahrt 3R7S 67 (Bretter); Abinauten
     42, Steffi 37, Dart Devils 33, Landwirt 21 (locker). PLACKEN_GRENZE 45: ueber 45 zeigen Band, Bewertung
     (/api/mo/showcase, nur Textil-Designs - Flachware ist vollflaechig gewollt) und Schaufenster das Design nicht mehr.
     server.js plackenNachtragen misst alle 10 min NUR Druckdateien, die auf der Platte liegen (ein Holen von Drive
     schriebe 446 x rund 30 MB auf ein Volume mit 1 GB frei); was im Band laeuft, liegt fuer seine Mockups ohnehin da.
     MEIN BEFUND: fuenf meiner Schaufenster-Designs vom 3. Okt. liegen darueber - Hochzeit 58, Weihnachten 56,
     Verein 55, Steffi 52, Tischlerei 52. Sie fallen damit raus (Schaufenster 11 statt 16), bis Ersatz gewaehlt ist.
     Die Vorschau-Bilder (storage/previews) taugen NICHT zum Messen: sie sind flach auf Grund gelegt (Alpha 255) -
     erste Messung "alle 100 %", am bekannten Fall erkannt.
   - "ANDERE SPORTART - WELCHE?" ALS EIGENE SEITE ("Unnoetiger Schritt, das muss vorne irgendwo mit rein"): mottos.js
     freiBedingung() gibt jedem Freitext <feld>_frei die Bedingung "<feld> = Andere ..." (Meister-Shirt sportart_frei,
     Handwerker gewerk_frei) - beim Speichern UND beim Ausliefern (publicView), weil die Motto-Dateien auf der Platte
     schon aufbereitet liegen. Das Feld steht damit auf der Seite der Auswahl und nur bei "Andere".
   - VORNE/HINTEN BEI NAMEN ("einmal vorne klein mit Namen und hinten gross - das ist ueberhaupt nicht erklaert und
     auch nicht anzutippen"): die Aufteilung (v_aufteilung) war eine Liste unten auf der Namensseite. Jetzt eigene Seite
     "Vorne und hinten - wie soll das Shirt aussehen?" direkt vor der Groesse (abfolge.js Bereich aufteilung), drei
     Kacheln mit Zeichnung Vorder-/Rueckseite (motto-seite.js aufBild, data-au): Name vorne im Motiv / Vorne das Motiv,
     hinten alle Namen / Vorne klein mit Namen, hinten gross. Ohne Namen ist die Seite zu. Dabei gefunden: das
     Listenwort beim Meister-Shirt war "Mitarbeiterliste" (meister = Handwerk) - jetzt Kaderliste, Vereinsjubilaeum
     Mitgliederliste (listeWortFuer).
   - EINGABETASTE ERKLAERT ("Und es soll doch erklaert werden, dass man mit Enter auch direkt weiterkommt"): jede Seite
     mit Tippfeld zeigt ueber dem Knopf "Fertig getippt? Eingabetaste ... und es geht direkt zur naechsten Frage".
     Dabei gefunden und behoben: in der Namensliste sprang die Eingabetaste nach dem ERSTEN Namen auf die naechste
     Seite - jetzt zum naechsten Namen, erst in einer leeren Zeile weiter (der Hinweis sagt es dort so).
   - HAUSTIER-SZENE MIT DEM TIER VOM SHIRT ("sollte der Hund daneben wenigstens der gleiche Hund sein" - Wahl: "Gleiches
     Tier je Design"). tier-szene.js: Loch neben der Frau (TIER_LOCH), der Bilddienst malt dort das Tier von der
     Druckdatei als Foto, NUR das Loch kommt zurueck (flaecheUebernehmen) - Frau, Shirt, Druckflaeche pixelgleich.
     Einmal je Design und Farbe, storage/szenen-tier/<design>_<farbe>.png; bis dahin die Szene OHNE Tier
     (vorlagen-original/tee-szene-thema-tier-shirt-leer_<farbe>.jpg), nie ein fremder Hund. Danach werden die Mockups
     des Designs in der Szene neu gebaut. makeMockup opts.szeneVorlage. GEMESSEN am Bilddienst mit Nelli (7VTY): der
     dreifarbige Hund mit blauem Auge sitzt an der Leine. Nebenbei gesehen, nicht angefasst: die Kinder-Tiershirt-
     Szene hat ein Kuscheltier.

32. ANMELDEN MITTEN IM MOTTO (Markus, 4. Okt.: "wenn die Leute ... sich den Link zuschicken lassen und mit dem Link dann auch
   wieder sofort auf die gleiche Stelle zurueckkommen und da weitermachen, sonst brechen ganz viele Leute ab ... derjenige hatte
   sogar schon ein Konto ... musste alles wieder neu eingeben, Katastrophe"). NACHGESTELLT (werkzeug/probe-anmelden.mjs, ACCOUNTS
   on, Gast mit verbrauchtem Freidesign, Hochzeit bis "Alles klar?", Otto starten -> "Bitte kurz anmelden"): im SELBEN Browser kam
   der Kunde auf Frage 1 zurueck (Felder im Hintergrund gefuellt, die Seite zeigte "Habt ihr ein Foto von euch?"); in einem ANDEREN
   Browser (die Mail-App oeffnet den Link oft woanders) kamen 2 von 11 Eingaben an, nichts startete - der Zwischenstand lag nur im
   localStorage. Jetzt: /api/mo/login nimmt den Zwischenstand mit (weiter) und legt ihn unter storage/weiter/<nr>.json ab (24 h,
   einmal, nur fuer genau die angemeldete Adresse), der Link fuehrt auf dieselbe Seite samt Zusatz (?stil= ...) mit ?weiter=<nr>;
   GET /api/mo/weiter/<nr> gibt ihn zurueck, uebertraegt das Foto der Sitzung (FOTO_BESITZ) und die Designs des Gastes auf das Konto.
   Die Seite fuellt alles, springt ans Ende (zumWartescreen) und startet. Dabei gefunden: die Druckgroesse (8 x 8 ...) kam nur bei
   Freestyle zurueck. "Design sichern" nach dem fertigen Design startet nichts Neues (gateWeiter). GEMESSEN: gleich/anderer Browser,
   Hochzeit, Freestyle, Geburtstag, Hochzeit mit Gruppenfoto - alle Felder da, "Alles klar?", /generate 200; die Abnahme geht den Weg
   mit Foto im anderen Browser.
33. BAND: ARTIKEL, SCHWARZ, FARBE (Markus, 4. Okt., Bilder: "Nora und Afee" auf Hoodie/Zip, "Nora" auf Polo - "ein Design fuer ein
   Strandtuch auf einem Hoodie und ebenso auf einem Polo ... Otto Freestyle darf dann auch wirklich mein Freestyle sein" - "den Anteil an
   schwarzen Textilien auf nur noch 20 % begrenzen ... gelb, zart gruen, zart blau ... und natuerlich auch rot" - "Farben nehmen wir das,
   was alles zur Verfuegung steht und das gut aussieht").
   - URSACHE ARTIKEL: die gespeicherte Design-Datei traegt den Artikel OBEN (artikel), Band, Mockup-Route und Artikel-Kacheln lasen
     input.artikel (die Lehre vom 27. Sept., hier uebersehen). server.js artikelVon(j) liest beides. Pool-Eintraege werden einmal neu
     gelesen (artikelV 2): Textil-Artikel laufen ueber alle Textilien, ein anderer Artikel nur auf sich selbst, ein Artikel ohne Vorlage
     ('-') gar nicht. Lokal nachgestellt: Strandtuch -> strandtuch, Puzzle -> '-', T-Shirt -> Textil. MOCKUP_STAND 94 = Flachware.
   - NEBENBEFUND, behoben: mockupLiegtDa (womit das Band nachsieht, ob ein Bild fertig ist) kannte Motto-Szenen und Linie nicht - die
     Route legte "..._szene_thema-<motto>-mass_v.." ab, das Band suchte "..._szene_v.." und fand sie nie. Jetzt rechnen beide mit
     mockupPlan().
   - FARBE (mockups.js TEXTIL_FARBEN, nur B&C-Farben fuer GENAU diese Teile, Name wie der Hersteller, Farbwert angenaehert): Gelb (Solar
     Yellow), Mint (Millennial/Blush Mint), Hellblau (Sky/Blush Blue), Rot (Red), Royalblau, Gruen (Bottle Green/Dark Forest). Nur T-Shirt
     und Polo. Eingefaerbt wird der weisse Stoff der Vorlage (faerbMaske/einfaerben: Stoff = weisse und schwarze Fassung unterscheiden
     sich, Licht und Falten aus der weissen) - GEMESSEN sauber nur, wo beide Fassungen dasselbe Foto sind (Uebergangszone unter 5 %):
     alle Motto-Szenen ausser JGA (7 %) und Abschlussfahrt (5 %), bc-tee, bc-polo. Nicht: KI-Produktfotos tee/zip/beutel, Szenen
     Mann/Frau (zwei Fotos). Auf Farbe liegt der Druck deckend (over, DTF mit weissem Unterdruck), nie multiply.
   - WELCHE FARBE (brett.js farbWerte/besteFarbe): je Farbe der Anteil der Motivflaeche, der auf ihr kaum zu sehen ist (48 px,
     Kontrast unter 1,6 : 1 UND Delta E unter 65 - geeicht am Abinauten-Design: Schrift auf Rot Abstand 86 lesbar, auf Royal 58 schwach),
     hoechstens 15 %; unter den guten die mit passendem Farbton, im Band die noch seltene. Gemessen im Hintergrund mit der Bretter-
     Messung (nur Dateien auf der Platte). SCHWARZ hoechstens 10 % der GEZEIGTEN Textil-Bilder (abends verschaerft: "nur noch 10 %" - gilt fuer ALLE gezeigten Bilder: Band, Partner-Shop, Schaufenster); ein Design fuer dunkles Textil ohne
     passende Farbe faellt raus, wenn Schwarz voll ist. LOKAL GEMESSEN (418 Vorzeige-Designs, Band 11 Bilder): Schwarz 1, Mint 1, Gelb 2,
     Rot 2, Hellblau 2, Royal 1, Gruen 1, Weiss 1 - angesehen. SCHWAECHE wie am 2. Okt.: feine dunkle Linien misst die Flaeche nicht
     (Motorrad-Minimal auf Rot). Das Schaufenster hat seine eigene Auswahl (unveraendert).
   - BESTELLBAR (Markus, 4. Okt.: "Natuerlich sollen die auch bestellbar sein"): beim fertigen Design misst der Server die Druckdatei
     (bestellFarben: farbWerte/besteFarbe wie im Band, hoechstens vier, Vorlage B&C muss sauber faerben) und gibt bei T-Shirt und
     Polo job.mockups[teil].farben {key, name deutsch, bc} plus Bild 'f-<farbe>' mit. Die Ergebnisseite zeigt sie neben Schwarz und
     Weiss (nur Ottos Liebling = B&C; bei Deluxe nicht, Stanley/Stella hat andere Farben), die Zeile darunter nennt die Farbe, die
     Anfrage (/api/mo/anfrage) traegt farbe/farbeName ("Gelb (B&C Solar Yellow)") in Datei und beiden Mails. Gemessen an 50 lokalen
     Druckdateien: jede hat mindestens eine Farbe (Gelb 39, Mint 35, Hellblau 27, Royal 27, Rot 20, Gruen 7), sechs angesehen.
     Abnahme: werkzeug/probe-farbwahl.mjs (iPhone). Nur NEUE Designs bekommen Farben (die Liste entsteht beim Fertigwerden).
     Im Motto selbst waehlt der Kunde weiter hell/dunkel - die Farbe kommt danach, am fertigen Motiv.
34. "DEIN FREESTYLE" (Markus, 4. Okt.: "Otto Freestyle darf dann auch wirklich mein Freestyle sein" - "Wenn schon dein
   Freestyle"). Name und Kopfzeile in seed.json, freestyle/motto-freestyle.json, home-neu.html, home.html. Live benennt ein
   eigener Schritt beim Start NUR name/headline um (nicht FS_REV: ein hoeherer Stand schriebe die Felder neu - gemessen:
   anderer Foto-Hinweis, Laenge 120 -> 200, beides im Repo, aber live nie angekommen). Lokal nachgestellt: alter Stand ->
   Start -> "Dein Freestyle", sonst nur Vorgaben ergaenzt.

35. KNOEPFE AM LAPTOP OHNE SCROLLEN (Markus, 5. Okt.: "Bitte auch am Laptop-Bildschirm ueberpruefen, dass alle Buttons auch
   direkt zu sehen sind, ohne grossartig zu scrollen, so dass der Ablauf einfach und schnell geht. Bitte immer dran denken.
   Irgendwann werden wir betrunkene Menschen drauf haben, und das muss schnell gehen."). GILT FUER JEDE SEITE, JEDE AENDERUNG.
   Gemessen mit `node werkzeug/probe-laptop.mjs 1366 768` (geht Hochzeit, Freestyle, Geburtstag, Abi, Postkarte Seite fuer Seite
   und die Partnerseite /bei/<slug>/machen; BILD=<pfad> legt Bildschirmfotos ab): vorher lag "Weiter" bei Stil, Spruch, Abi-Motto,
   Namen 990-1320 px tief, "Otto starten" auf der Partnerseite bei 1539-1931 px. Jetzt (motto.html): der Weiter-Kasten (.ab-fuss)
   und #go kleben unten im Fenster, Stile am Laptop vier nebeneinander, Vorschlaege dreispaltig; bei-machen.html: zwei Spalten ab
   900 px, Startleiste klebt unten. 1366 x 768: alles im Fenster. 1280 x 720: fuenf Seiten 9-48 px darueber (Namensliste,
   Vorne/hinten-Kacheln, Spruch) - der Weiter-Knopf ist dort trotzdem zu sehen.
36. NUR ZEIGEN, WAS AUF DEM STOFF FUNKTIONIERT (Markus, 5. Okt., drei Bilder aus dem Band: blaues Hamburg-Wappen auf rotem Polo,
   "Leben auf zwei Raedern" weiss auf weisser Zip-Jacke, Bowling im gezeichneten Kasten auf dem Beutel - "Das ist nicht dein Ernst,
   mir sowas anzubieten" - "blau auf Rot ganz klar verboten" - "bei Rot kann nur einfarbig weiss drauf mit ein bisschen schwarz"
   - "Leben auf zwei Raedern ... muessen wir 100 % ausschliessen"). brett.js misst jetzt je Stoff (MESS_STAND 2, server.js misst
   alles neu, was auf der Platte liegt): werte (48 px, wie bisher), FEIN (320 px, nur helle Stoffe: duenne helle Linien und Schrift,
   Grenze 15 - U857 auf Weiss 29), BISS (rot auf blau/gruen, blau auf rot/orange, gruen auf rot; Grenze 12), RAHMEN (Linie auf
   drei Seiten der Aussenkante, auch gestrichelt), PALETTE (weiss/schwarz/bunt; ROT nur bei weiss >= 60 % und bunt <= 5 %).
   besteFarbe: keine Farbe auf ihrem eigenen Ton (unter 35 Grad Abstand), kein Biss, nichts Feines, das verschwindet.
   zeigbar(messung, stoff) entscheidet in Band und Schaufenster - ohne neue Messung wird NICHT gezeigt.
   NUR FUER DAS, WAS WIR ZEIGEN. Beim Bestellen waehlt der Kunde frei (Markus, 5. Okt.: "Ich wuerde es nicht sperren, weil es
   kann sein, dass der Kunde das ausdruecklich moechte"): bestellFarben nimmt besteFarbe(..., { frei: true }) - jede Farbe, auf
   der das Motiv sichtbar ist (werte <= 15), die strengen zuerst. Gesperrt wird dort nur, was man gar nicht sieht.
37. SCHRIFT NICHT IMMER OBEN IM BOGEN (Markus, 5. Okt.: "Es sieht immer gleich aus. Da steht jetzt Hamburg immer oben drueber ...
   Hamburg kann mal in der Mitte stehen ... von unten nach oben geschrieben ... 1000 Variationen ... Wir muessen lernen zu denken
   wie ein Designer"). mottos.js VARIETY.schriftPlatz: je Auftrag ein Platz fuer die Hauptschrift (senkrecht, quer durch die
   Mitte, unten als Fundament, gebrochen, klein unter dem Motiv, im Motiv gemalt, steil diagonal, gerade oben ohne Bogen, Spalte),
   mit "NOT the stock look of an arched headline over the motif with a ribbon banner underneath"; nicht beim Abzeichen und nicht
   beim breiten Band. Das Ornament "double-line frame" ist raus (Kasten um das Motiv). Markus' Motto-Texte sind nicht angefasst.
38. PARTNER-DESIGN WIE IM SHOP (Markus, 5. Okt., EAST26: "wenn ich das Design auswaehle ... Gross ist mit dem Namen drauf. Dann muss
   das auch so hinten rauskommen ... ein Partner hat ein vorgegebenes Design und wir aendern nur Name, Datum, Spruch und
   Bewertung"). bei-machen.html: beim T-Shirt "Wie soll es aussehen?" - "Wie im Shop" (vorgewaehlt, Bild = Shop-Bild) oder
   "Eigenes Motiv". Wie im Shop: Spruch (vorbelegt lieblingsSatz), Name, Datum (heute), Sterne bei Gastro - kein Foto, kein Stil.
   /generate {vorlage:'linie', linie:{spruch,name,datum,sterne}} -> runJob setzt minimalMotiv (Logo-Original, Ort, Koordinaten,
   Sterne in der Akzentfarbe) OHNE Bild-KI (wie der Nur-Logo-Druck: codeBild), auf die Leinwand des Artikels gelegt, dann der
   normale Weg (Druckdatei, Mockups, Kauf). OFFEN: der Stoff im Shop ist bei EAST26/Elbdeich Natural - bestellt wird Weiss, bis
   Natural als Textilfarbe im Katalog steht (Chat-1-Gebiet).

39. DER WUNSCH (Markus, 5. Okt.: "Ich haette gerne einen absoluten Highlight-Button relativ oben platziert ... der Kunde tippt
   oder spricht seinen Wunsch nur ein und wir bauen daraus ein geiles Design" - im Trikot-Designer gibt es das schon; dessen Code
   lag in keinem Zweig, den diese Sitzung sieht, also eigener Bau). home-neu.html: gruener Kasten "Sag Otto einfach, was du
   willst." direkt unter dem Laufband - Textfeld, Mikrofon (Web Speech API, de-DE; ohne Unterstuetzung kein Knopf), "Design
   bauen". POST /api/mo/wunsch {text}: das Textmodell (QA_MODEL, WUNSCH_LESEN) waehlt aus dem Katalog (alle Mottos der Liste ohne
   Postkarte, Gutschein, Haus, festen Artikel) das Motto, fuellt dessen Felder (nie erfundene Namen), Stil und Stoff; wunschSauber
   prueft alles gegen das Motto (nur bekannte Felder, Auswahl nur aus Optionen, Laengen). Ohne Modell oder bei Unsinn: Dein
   Freestyle mit dem Wunsch als Motiv, T-Shirt vorne 28 x 20 (Brust gross). Abgelegt in storage/wunsch/<nr>.json (3 h, ohne
   Kundendaten ausser dem Text), die Seite geht auf /m/<motto>?wunsch=<nr>; motto-seite.js weiterAnwenden(..., {wunsch}) fuellt
   ohne Anmeldung und bleibt auf "Alles klar?" stehen - gestartet wird erst mit "Otto starten" (der Kunde sieht, was Otto
   verstanden hat). Messung: werkzeug/probe-wunsch.mjs (iPhone + Laptop). NICHT gemessen: die Wahl des Textmodells (kein
   Schluessel hier) - das erste Live-Log "Wunsch: ... -> <motto>" zeigt sie.

40. WAS SICH VERKAUFT - RECHERCHE VOM 5. OKT. (Markus: "Entscheidet ja nicht mein Geschmack ... schau dir an, was sich am besten
   verkauft" - danach: "Du hast ueber Design nichts gelesen und nichts gelernt. Katastrophe."). Vier Recherchen (Etsy-Auswertung
   Listadum mit 2.015 Top-Listings, Printful/Printify-Platzierung, Abi-Anbieter abigrafen/abisachen/gradoo, Car-Culture-Marken,
   Restaurant-Merch Katz's/Russ & Daughters/Kith). Echte Verkaufszahlen veroeffentlicht niemand; das sind die Muster:
   - EIN AUFHAENGER, SEHR KONKRET: Insider-Satz, ein Bildzeichen, lesbar in unter einer Sekunde auch als Vorschaubild. Allerweltssprueche
     und "Your text here"-Vorlagen verkaufen schlecht.
   - 1-3 DRUCKFARBEN, viel Stoff sichtbar (Negativraum ist Qualitaet), keine Halbtransparenz, keine grossen Vollflaechen, kein Rahmen.
   - MASSE: Brustmitte rund 20-28 cm, linke Brust 6-13 cm, Ruecken bis 30 x 40. HOODIE: vorne leise (kleines Emblem), hinten laut.
     Ein Polo traegt nur ein kleines Emblem - also nur schlichte Motive.
   - ABI: vorne Motto als ABI-Wortspiel mit Schule und Jahr, hinten die Namensliste in 2 Spalten, eine Farbe, hoechstens 3 Druckfarben.
   - AUTO: ein bestimmtes Modell (Seitenansicht, Blaupause, Strichzeichnung), nie Herstellerlogo oder -name; vorne klein, hinten gross.
   - GASTRO: eine Geschichte statt nur Logo (Hausspruch, Ofen, Wagen), Herkunft ("seit", Ort), ruhige Farben, muss auch ohne Namen
     als Kleidung bestehen.
   - BILLIG WIRKT: Clipart, zu viele Elemente, Glow und Verlaeufe, Platte hinter dem Motiv, zu klein auf zu grossem Stoff, dunkel auf
     dunkel, hell auf hell, bunte Motive auf kraeftigen Stoffen (Rot!).
   VOR JEDEM BILD, DAS GEZEIGT WIRD (Band, Schaufenster, Bewertung, Shop, Beispiel): die Messung (brett.js zeigbar) UND das eigene Auge
   am Bild, so wie der Kunde es sieht. Was ich nicht selbst angesehen habe, sage ich nicht als "fertig".

41. WEISS AUF WEISS IST VERBOTEN - OHNE DISKUSSION (Markus, 5. Okt. abends, Motorrad-Aquarell "Leben auf zwei Raedern / Harz"
   auf weissem Hoodie: "was allerdings nicht geht und da brauchen wir auch nicht drueber zu diskutieren, ist weiss auf weiss" -
   "Das Motiv mit dem Motorradfahrer koennen wir ja gerne nehmen ... aber definitiv nicht fuer weiss und schreib das bitte auch
   rein das weiss auf weiss verboten ist"). Gilt fuer alles, was wir zeigen (Band, Schaufenster, Bewertung, Beispiele):
   - brett.js RAND (MESS_STAND 3): Anteil der Motiv-Randpunkte, die so hell sind wie der Stoff; ueber 20 % nicht zeigbar
     (Motorrad 4UWQ 74, Abschluss 7258 45, gute Designs 0-8). Beutel wird gegen Natur gemessen.
   - AQUARELL NIE AUF WEISS ODER NATUR (server.js NIE_AUF_HELL, zeigbarAuf): Aquarell laeuft weich ins Papierweiss aus - die
     Messung sieht das nicht (Motorrad 6KZC: Rand 6, weiche Kante 8 %), das Auge schon. Erst wenn Markus fuer Aquarell eine
     Stofffarbe bestimmt, darf es wieder gezeigt werden.
   - FARBEN: bunt nur auf Wunsch des Kunden und bei Karneval (Markus: "Bunte Farben nur noch auf Wunsch und bei Karneval passt
     das. Ansonsten cremefarben, weiss, ganz dezenter Anteil an schwarz"). BAND_FARBIG = false. Welche Farben dazukommen
     (Grau, Creme, Zitronengelb ...), bestimmt Markus - nach dem Blick auf die echten Farben am Shirt, nicht nach Namen.
   - 6. OKT.: GRENZE 10 STATT 20. Meister-Shirt FAJB (cremeweisse Schrift "MEISTER", "TTC Buchholz") lag mit Rand 19 knapp drunter
     und stand im Band - Markus: "Das geht mir so hart auf den Sack, dass du das nicht lernst." Gute Designs: 0 bis 8.
   - ICH PRUEFE JEDES BILD EINZELN IN VOLLER GROESSE (mindestens 600 px), nie nur auf einem Kontaktbogen mit kleinen Kacheln - dort
     war die helle Schrift nicht zu sehen, und ich habe "kein Weiss auf Weiss" gemeldet. Erst angesehen, dann gemeldet.

42. DIE ANSICHT IST DAS, WAS DER KUNDE GEWAEHLT HAT (Markus, 6. Okt., Konto mit Tier-Shirt fuer hell gestaltet, gezeigt auf Schwarz:
   "Die Ansichten, die man geschickt bekommt, muessen natuerlich genau das sein, was der Kunde ausgewaehlt hat"). Konto, Mails,
   Ergebnisseite: Teil und Stofffarbe aus dem Auftrag (job.textile, Artikel), nie fest Schwarz oder T-Shirt.

43. FREISTELLEN IST VERBOTEN (Markus, 6. Okt., Meister-Shirt FAJB mit schwarz gefuellten Buchstaben-Innenraeumen: "finde heraus, warum
   ueberhaupt irgendwas freigestellt werden muss. Das ist verboten worden, da wir in der Lage sind, immer transparente Dateien auch
   herzustellen"). Jedes Design kommt TRANSPARENT vom Bildserver (task 'design', Grund-Modus alpha; live seit 29. Sept. ausnahmslos
   "makeMaster Weg: alpha"). images.js motivFreistellen: ohne Alphakanal ein FEHLER, kein Ausschneiden (nur der Testmodus 'chroma').
   Stilbeispiel-Import nur transparent. Was vor dem 21. Sept. entstand (258 von 447 freigegebenen), ist teils freigestellt - es
   kommt nur nach Markus' Freigabe ins Band (44). Ausnahme: Logos und Wappen von Kunden (Upload) und das Vergleichswerkzeug.

44. KUNDENDATEIEN WERDEN NIE UEBERSCHRIEBEN - OHNE MARKUS' ZUSTIMMUNG (Markus, 6. Okt.). Eine Druckdatei entsteht einmal unter
   einer freien Nummer (freieNummer, auch beim Stilbeispiel-Import). Danach: kein Lauf schreibt sie neu von selbst
   (druckkantenNachschaerfen startet nicht mehr automatisch), das Auslagern ersetzt keine vorhandene Drive-Kopie (abweichend =
   bleibt lokal, steht auf der Liste fuer Markus), die Feinjustierung der Druckerei sichert vorher <nr>_PRINT_MASTER.original.png.
   UND: Ins Band kommt nur, was Markus freigegeben hat - ich mache die Vorauswahl, jedes Bild einzeln in voller Groesse angesehen
   ("du machst mir immer eine Vorauswahl, und ich gebe das frei, anders wird's nicht funktionieren").
45. WER EINEN ARTIKEL ANTIPPT, BEKOMMT KEINE SHIRT-FRAGEN (Markus, 6. Okt., Kissen aus der Galerie, dann "Fuer welches Textil?" und
   "Brust klein 8 x 8 cm": "Was sollen denn diese schwachsinnigen Fragen?"). Kissen = Sublimation, randlos - es sei denn, es ist
   nur Schrift, dann bleibt der Rest weiss (druckBlock: ONLY EXCEPTION, nie die Postkarte). /m/<motto>?artikel=<kein Textil>:
   Textil-, Groessen- und Platzierungsfrage weg, der Server zeichnet auf die Flaeche des Artikels (artikelId bei normalen Mottos).
   Und bei JEDEM Artikel oben der Kasten "Einfach einsprechen" -> /m/freestyle?artikel=<id> (Freestyle einfach mit Mikrofon);
   wer will, geht unten den normalen Ablauf. Jeden neuen Artikel so durchgehen (werkzeug: Artikel-Weg im Browser).
   Groesse ohne Wahl = die erste Flaeche des Artikels; Kissen: 40 x 40 ist der Standard (Markus, 6. Okt.).
46. FREISTELLEN NUR BEI KUNDENLOGOS - DORT ABER SELBSTAENDIG SAUBER (Markus, 6. Okt.: "Es geht nur um das Freistellen" -
   Kanten schaerfen und hochrechnen bleiben; "Weiter ausschneiden bei den Kunden-Logos. Dort muessen wir so gut werden, dass
   alle Logos ... selbstaendig ... gut aussehen"). Designs: nur Alphakanal (task design + background transparent ausdruecklich),
   kein Schwarz-Wegrechnen, kein Chroma-Modus. Kundenlogos: logoFreistellen beim Upload (Hintergrund = haeufigste Randfarbe,
   Karomuster erkannt; Punze nur leer + im duennen Strich; unklare Loecher per Bildpruefung logoLochFragen; weiche Kante ohne
   hellen Saum; Kruemel raus), Original bleibt als <id>.original.png. Pruefstand: 18 typische Logos, jedes einzeln auf Weiss
   und Schwarz ansehen, bevor etwas daran geaendert wird.
47. OTTO IM GESPRAECH (Markus, 6. Okt.: "Dialog, so dass Motto Otto in der Sprechblase Dinge abfragt ... Mikrofon bleibt an ...
   per Sprachbefehl bis zur Bestellung" - "Otto soll sprechen ... bekommt meine Stimme"). otto-gespraech.js ist eine Schicht UEBER
   der Seite (window.MoSeite gibt Abfolge, Motto, laeuft frei): fragt den aktiven Schritt ab, schnelle Befehle lokal (weiter,
   zurueck, los, nochmal, stopp), alles andere mit den SICHTBAREN Elementen an /api/mo/gespraech (Aktionen setzen/klick/weiter).
   Gilt dadurch fuer jedes Motto. Foto/Kamera nur per Tipp (grosser Knopf in Ottos Blase), Bezahlen nie per Sprache (Button-
   Loesung; Knoepfe "zahlungspflichtig" filtert der Server). Ottos Stimme = Markus' echte Aufnahmen, FESTE Saetze
   (otto-stimme/saetze.json, <schluessel>.mp3); fehlt eine Aufnahme, steht der Satz nur in der Blase. Startseite: Ottos eigene
   Blase, das Mikro dort schaltet das Gespraech ein (sessionStorage mo_gespraech), weiter auf der naechsten Seite.

48. DER KAUFWEG (Markus, 6. Okt.: "bitte den zahlungsweg auf der seite ueberpruefen" - "ja alles machen"). LIVE GEMESSEN vorher:
   Shopify-Kasse an (Verbindung ok, brutto), ein Entwurf #D1, bezahlt nur Shopifys Testbestellung #9999; Stripe AUS (/api/mo/me stripe:false,
   Entwuerfe nach den freien laufen kostenlos). Im Browser nachgestellt (iPhone 13, Laptop 1366 x 768): Karte "Fertiges Produkt" sagte
   "auf Anfrage" (kfPreis las f.preise, der Server schickt preisliste), "Drei Wege" bei zwei, Kaufknopf bei 4177 px (iPhone) bzw. 3653 px,
   Groesse doppelt, "Euer Name" ohne Zweck an der Kasse, nur ein Teil je Kasse, Kissen & Co. nur als Anfrage, der Satz "dieser Euro geht
   beim Textilkauf wieder ab" ohne Umsetzung, kein Rueckweg nach dem Bezahlen. GEBAUT:
   - motto-seite.js/motto.html: Preis aus /preise.js ("ab 19,90 €", Flachware ihr Preis), "Zwei Wege", Bestellleiste (#kauf-leiste) klebt
     unten im Fenster unter dem Design, ein Tipp oeffnet das fertige Teil; Kassenknoepfe kleben unten im Formular (gemessen: im Fenster auf
     beiden Geraeten); Produkt -> Groesse -> Menge -> E-Mail, Groesse nur bei Textil und nur einmal (#sizesel am Bild zu, wenn die Kasse
     offen ist), Name nur bei der Anfrage; WARENKORB ("+ Noch ein Teil dazu", kfKorb, Staffel ueber alle Textilien); Knopf mit Endsumme.
   - shopify-kasse.js: posten[] (bis 20, alte Einzelfelder gehen weiter), Textil UND Flachware (preise.istBekannt), Verrechnung: bezahlte
     Einzelentwuerfe (billing.js schreibt verrechenbarCent = 100 je Stueck) gehen als appliedDiscount auf Textil-Ware ab, abgebucht erst beim
     Eingang der Bestellung (fulfillment beiBestellung -> bestellungEingang, genau einmal). Kasse-Nummer unratbar; GET /api/mo/kasse/<nr>,
     Seite /bestellung/<nr> (bestellung.html). Die Mottoseite merkt sich die Nummer (localStorage mo_kasse, 3 Tage) und zeigt beim
     Wiederkommen "noch nicht bezahlt / Zurueck zur Kasse" oder "Bezahlt - Bestellung #...".
   - Abnahme: werkzeug/probe-kasse.mjs (Server mit vorgetaeuschtem Shopify + Browser auf zwei Geraeten).
   NICHT GEMESSEN: der Nachlass (appliedDiscount) an der echten Shopify-API (greift erst, wenn Stripe Einzelentwuerfe verkauft - heute bei
   niemandem), Flachware-Bestellungen landen bei fulfillment als POD "ausstehend" (kein GELATO/PRINTFUL-Schluessel, kein Produkt-Mapping)
   und bekommen die Druckdatei des Designs (bei einem Shirt-Motiv das Shirt-Format) - bis das steht, druckt Markus' Werkstatt von Hand.
   Shopify selbst (Kassen-Adresse, Logo, Link zurueck auf der Dankeseite) ist Einstellung im Shop, nicht Code.

49. OTTOS STIMME AUFNEHMEN: /admin/stimme (Markus, 6. Okt.: "Bau mir doch hier einen Aufnahmeknopf" - "so eine kleine Seite, wo wir
   immer Zugriff haben, wo du die Saetze hinschreibst und ich sie im Nachgang anspreche"; Ton: "moderner ... hier im Norden, es
   faengt an mit Moin"). Ich schreibe neue Saetze in otto-stimme/saetze.json (Schluessel + Text, Nord-Ton, kurz); Markus nimmt sie
   auf der Seite auf (Anmeldung wie /admin/band). Je Satz: Text (aenderbar - seine Fassung liegt in storage/otto-stimme/texte.json
   und gilt vor meiner), Aufnehmen/Stopp, Probehoeren, Speichern -> der Server bereitet auf (ffmpeg im Docker-Image: Hochpass,
   Rauschen, Stille vorn/hinten, -16 LUFS, Mono mp3) und legt storage/otto-stimme/<schluessel>.mp3 ab, Rohes unter roh/. Otto spielt
   immer die neueste (?v=Stand aus /otto-stimme/saetze.json); ohne Aufnahme nur die Blase. Neuer Satz = Eintrag in saetze.json und
   eine Zeile in WO (stimme.html), damit Markus weiss, wo Otto ihn sagt.
50. DER OTTO-WEG /otto (Markus, 6. Okt.: "Magst du das fuer 'ne Gruppe, als Geschenk oder fuer dich selber ... und danach muss es
   sich logisch aufbauen"; "Jeder Weg ... logisch ineinander aufgebaut, so dass es keinen Grund gibt, die Seite zu verlassen";
   abgesegnet: "Wir testen den Ablauf so"). Der Wunsch der Startseite geht an /otto?w=<text> (&m=1 = Mikro war an).
   /api/mo/otto-lesen liest nur die Weichen (artikel, fuer, motto, idee) - Otto fragt NIE, was schon gesagt wurde. Reihenfolge:
   Artikel -> fuer wen (Gruppe/Geschenk/fuer mich; entfaellt, wenn das Motto schon feststeht) -> Gruppe: Gruppen-Mottos,
   Geschenk: Einzel-Mottos + Hochzeit, fuer mich: eigene Idee oder Ottos Mottos (Idee schon gesagt = direkt Freestyle) ->
   Freestyle ohne Idee: "Hau raus" -> Ende: Motto ohne Idee = /m/<slug>?artikel=<id> (Kissen & Co. ohne Textilfragen), sonst
   /api/mo/wunsch mit slug + artikelId (das Motto ist fest, der Text fuellt nur noch dessen Felder). Jede Frage zeigt ihre
   Kacheln; die Chips oben nehmen eine Antwort zurueck. Auf der Mottoseite: stil_frage vor stil, menge statt kaufen ohne Textil.
51. GETRAGEN-BILD PASST GENAU ZUM BEGRIFF (Markus, 7. Okt., Maurer-Spruch auf einer Frau im Strassencafe, dann in der
   Tischlerwerkstatt: "Maurer ist doch nicht in einer Tischlerwerkstatt?" - "Das muessen wir schon genau machen, und wenn du den
   Begriff nicht kennst, musst du ihn halt jedes Mal recherchieren"). Bei Spruechen, Freestyle und Handwerk liest szene-begriff.js
   den EINEN Begriff des Designs (Beruf, Hobby, Sport) und wer es traegt, schlaegt ihn nach (Wikipedia), schreibt den Szenen-
   Zettel (der echte Ort dieses Menschen, sein typisches Werkzeug in der Hand) und laesst das Foto EINMAL je Begriff machen:
   weiss + schwarz als Bearbeitung desselben Fotos (dann geht auch Orange & Co.), vermessen, gemerkt. Nie eine Szene "ungefaehr"
   (Tischler fuer Maurer). Bis das Foto da ist: Szene nach Schlagwort bzw. Person nach Inhalt. Neue Szene am Bilddienst immer
   selbst ansehen, bevor sie mitgeliefert wird (erste: tee-szene-thema-b-maurer-mann, Rohbau mit Kelle).
   "Nur das Produkt" heisst "Nur das Design" und zeigt das Motiv ohne Shirt.

## 2. Okt., 07:03 und 07:13: zwei Kundenlaeufe von MIR abgebrochen

Markus testete Malle-Fahrt mit Foto, beide Laeufe brachen ab ("Dein Foto ist nach einer Stunde
automatisch geloescht worden"). Gemessen im Railway-Log: Lauf mo_67c1b033ed6e131e war bei Stufe 1,
als mein Deploy daa2c38 um 05:03:50 UTC kam; Lauf mo_b2d78da68ca5c12e hatte Bild 2/3 fertig, als
mein zweiter Deploy 958bc3d um 05:13:17 UTC kam. Beide Male "SIGTERM ... 1 Auftraege laufen noch,
sie werden nach dem Neustart wieder aufgenommen" - und danach "0 neu eingereiht": das Foto liegt
nur im Arbeitsspeicher, der Neustart loescht es, der Lauf ist verloren. Der zweite Deploy war ein
Nachschieben fuer den ersten (HAUS_REV) - genau das verbietet Regel 3.
DARAUS: vor jedem Push auf main ins Log sehen, ob gerade ein Auftrag laeuft ("Bild n/3",
"Stufe 1"), und dann warten. Ein Nachbesserungs-Push am selben Tag nur bei Ausfall.
BEFUND (server.js, gemeinsam - nicht angefasst): die Meldung nennt "nach einer Stunde geloescht",
obwohl der Grund der Neustart war; und das Versprechen "werden wieder aufgenommen" haelt nicht,
wenn ein Foto dabei ist.

## Markensperre: nur mit Fussball-Bezug (Markus, 3. Okt.)

"Barca, Barcelona duerfen nur gesperrt werden, wenn sie im Kontext mit Fussball sind ... Das machen wir
mit allen so. HSV kann jeder drauf schreiben. Ist es HSV Hamburg, dann ist es klar der Fussball-Bezug."
Ausloeser: "Hotel Barca" wurde als Fussball gesperrt. Umsetzung in marken.js:
- Immer gesperrt (EINDEUTIG): volle Vereinsnamen mit FC/SV/TSV/... oder Gruendungsjahr, Verbaende/Ligen
  (DFB, Bundesliga, Champions League), Stadien, Real Madrid & Co. Produktmarken (ab 'ADIDAS') wie bisher.
- Alles andere aus dem Fussball-Teil nur mit Bezug im GANZEN Design (markenKontext in server.js: alle
  Felder + Motto-Name, in der Bild-QA dazu der Text im Bild): Fussballwort, "...fan", Heimatstadt einer
  Kurzform (VEREINS_STADT), Fan-Motto.
- Ein Vereinswort neben Hotel/Bar/Pizzeria/... ist der Name des Betriebs (BETRIEB); der gewaehlte Ort der
  Karte (ortsNamen) zaehlt auch, wenn die Bild-KI "HOTEL" und "BARCA" getrennt liest.
- Wappen im Bild (checkLogos) bleiben streng - ein Wappen IST Fussball-Bezug.
- Jede Sperre landet im Sperr-Protokoll und geht SOFORT als Mail an Markus (sperreMelden, SPERR_MAIL=aus).

## Was Markus nie sehen darf

- Schluessel (ADMIN_TOKEN, MASTER_TOKEN, BREVO_API_KEY, OPENAI_API_KEY, STRIPE_SECRET_KEY) im Chat.
- Einen Modellnamen in Commits oder PRs.
- Sein Prompt- und Copy-Text umgeschrieben, ohne dass er es wollte. Otto wird nie nachgezeichnet.
- Kundenfotos auf der Platte. Railway-Volumes von Hand angefasst. `uebermitteln()` aktiviert.
- Eine Sperre bei Fanclubs. Marken bei Handwerkern.

## Startseite (Markus, 20. Sept. abends)

"Firmen: direkter Zugang oben. Ein Reiter Event - wie die Postkarte, nur fuer Veranstaltungen,
erst mal eine Erklaerung. 'So geht's' als einzelner Knopf oben und von der Startseite runter, so
dass die Leute direkt die Beispiele sehen und sofort aufs Motto tippen. Amazon- und Apple-Prinzip:
die grosse Erklaerung brauchen sie nicht, wenn wir sie zum Motto fuehren." Umgesetzt: Startseite =
Kopf (ein Satz), Schnellwahl, Werkbank, Formate, Kacheln. /so-gehts = Ablauf, Preise, "Gut zu
wissen" aus derselben Vorlage (Klasse am body). /event = Erklaerung mit Kontakt (seitenHuelle).
Knoepfe oben auf jedem Geraet: So geht's · Firmen · Event · Konto.

## Freestyle mit Foto oder Datei, die geaendert wird (Markus, 19. Okt.) - GEBAUT auf Zweig freestyle-foto-aendern

Markus: "Baue bitte bei dem Stil Freestyle die Moeglichkeit, noch dazu ein Foto hochzuladen oder eine
Datei, so dass diese geaendert werden kann." NACHGESTELLT vorher (iPhone 13, Pruefstand, main 8953e6a):
Freestyle hatte drei Seiten - Artikel, Wunsch, Alles klar - und nirgends einen Weg fuer ein Foto; die
Foto-Felder waren seit FS_REV 4 ("einfach") alle versteckt, obwohl der Server beide alten Wege
(so einsetzen, nachzeichnen) noch konnte.
SO IST ES GEBAUT (Sitzung `01PHitR5kVqSBs3PwGPKCvTW`, Chat 4 "Kundenweg & Freestyle-Foto"):
- `freestyle/motto-freestyle.json`, FS_REV 6: das Feld `foto` steht direkt nach dem Wunsch, freiwillig
  (`ohneGeht`), grosser Knopf "Foto oder Datei waehlen", "Ohne Foto weiter"; die Rechte-Zusage steht im
  Hinweis am Knopf (wie bei den Gruppen-Mottos), der Haken `foto_rechte` ist weg. `foto_modus` bleibt
  versteckt und hat den dritten Weg "Mein Foto nach meinem Wunsch veraendern". `mottos.js` laesst
  `ohneGeht` und `knopf` aus der Motto-Datei durch.
- Der Weg kommt aus dem Wunsch: `freestyleBruecke(body, motto, mitFoto)` fragt das Textmodell mit
  "PHOTO ATTACHED" nach `foto` (aendern / original / nachzeichnen); ohne klare Ansage - und ohne
  Textmodell - gilt VERAENDERN. Ohne Foto bleibt der Weg leer.
- `veraendert` in runJob: der Bilddienst aendert ZUERST das Foto nach dem Wunsch (`fotoAendernPrompt` in
  fotos.js, input_fidelity high, Hintergrund bleibt, Groesse im Seitenverhaeltnis des Fotos, laengste
  Seite 1024-2048). Das geaenderte Bild liegt wie das Original NUR im Arbeitsspeicher, in der Sitzung
  `<original>_x` desselben Kunden; dann laeuft alles wie "so einsetzen" (Flaeche frei, Vorschau im
  Speicher zusammengesetzt, Foto erst nach "Ja, so ist es gut" in die Datei). Das Motiv drumherum
  kommt weiter aus demselben Wunsch. Scheitert das Aendern, steht der Grund am Auftrag und der Kunde
  liest `FOTO_TEXTE.aendernFehlgeschlagen` - nicht "Bilddienst nicht erreichbar".
- "oder eine Datei": `/api/mo/foto` rastert eine SVG zu PNG (2048 px) und sagt bei PDF ehrlich, dass
  wir sie nicht lesen (`FOTO_TEXTE.pdf`). Die Datei-Waehler nehmen `.svg` an.
- GEMESSEN im Pruefstand mit Bild-Stub (iPhone 13): Schritt 3 von 4 "Hast du ein Foto oder eine Datei
  dazu?", nach JPG "Weiter" und "Foto ist da", Auftrag MO-FREESTYL-20261019-UQP2 mit foto_modus
  "veraendern", edit_ballz_image 1200x896, Vorschau mit eingesetztem (geaendertem) Bild 800x800, SVG
  angenommen, PDF mit Satz abgelehnt. Mit dem echten Bilddienst NICHT gemessen - das ist Markus' Lauf.
- Abnahme: drei Pruefpunkte in abnahme.mjs (nach dem "Dein Freestyle"-Punkt) und der Browser-Weg
  (PDF, SVG, JPG, Zusammenfassung) in abnahme-browser.mjs auf allen drei Geraeten.
NICHT gebaut (Ideen, keine Auftraege): eine Kachelwahl fuer die drei Foto-Wege, PDF-Lesen, mehrere Dateien.
LIVE seit 19. Okt., 20:54 (8a060e4). Am selben Abend nachgeschaerft (Zweig freestyle-foto-sichtbar, FS_REV 8):
- Markus: "Ich muss erst einsprechen, was geaendert werden soll, und kann gar nicht sagen, was geaendert werden
  soll - nicht cool." Reihenfolge jetzt: Worauf soll es? -> Foto oder Datei? -> Wunsch -> Alles klar. Liegt ein
  Foto vor, fragt der Wunsch-Schritt "Was soll Otto an deinem Foto aendern?" (Feld-Eigenschaft `mitFoto` am
  Feld motiv: label + hint; mottos.js laesst sie durch, motto-seite.js mitFotoTexte() in refresh()).
- Der Foto-Hinweis beginnt mit der Rechte-Zusage - auf dem iPhone lag sie unter der festen Knopfleiste.
- Wunsch von der Startseite (?wunsch=) landet auf "Alles klar?": dort steht jetzt ein Knopf "Foto oder Datei
  waehlen" oben in der Zusammenfassung (#wunsch-foto), ein Tipp fuehrt in den Foto-Schritt. Kein Sprung
  zurueck in den Foto-Schritt selbst (Markus, 4. Okt.: nicht auf der Foto-Frage landen).

TEIL-AENDERUNG AM FERTIGEN DESIGN (Markus, 19. Okt., gleicher Zweig): "ein Tool, um an einem Design, das
den Kunden gefaellt, nur Teilstuecke zu aendern" (sein Beispiel: "aendere die Ohren in gruen"). GEBAUT auf
dem Weg von "Text korrigieren" (Fassung 33): unter dem fertigen Design die Zeile "Nur das aendern" mit
Eingabe und Knopf (motto.html `#aendern-row`). Der Knopf setzt korrekturVon auf das gezeigte Design und
startet sofort; die Seite schickt `aenderung` mit. Der Server haengt den Wunsch als EINZIGE Aenderung an
den Korrektur-Auftrag ("Make ONLY this change ... Everything else stays exactly as it is"), das fertige
Design (ART/PRINT_MASTER) ist das Eingangsbild, input_fidelity high; die Markensperre gilt fuer den
Wunsch. Ein nach dem Wunsch geaendertes Foto (Sitzung `_x`) wird bei der Aenderung nicht noch einmal
geaendert. GEMESSEN im Pruefstand mit Bild-Stub (iPhone 13): Design 1, dann Zeile sichtbar, ohne Text
ehrliche Ansage, mit Text "Aenderung starten" und zweites Design mit korrekturVon. Mit dem echten
Bilddienst NICHT gemessen - ob das Modell wirklich nur das Genannte aendert, zeigt erst Markus' Lauf.
NICHT gebaut: eine Stelle im Bild markieren (Maske) - der Korrektur-Weg kann eine Maske (grund.maske),
dafuer fehlt ein Zeichenwerkzeug auf der Vorschau; das ist eine eigene Entscheidung.

## Werkzeuge

- `node abnahme.mjs` – alles. `node abnahme.mjs 7` – nur Browser. `node abnahme.mjs 8` – nur Magenta.
- Lokal starten: `BALLZ_MCP_URL=http://127.0.0.1:1/mcp ADMIN_TOKEN=probe MASTER_TOKEN=probe PORT=4090 node server.js`
- Commit-Text aus Datei (`git commit -F`), Abschluss mit den Zeilen aus der Sitzungsvorgabe.

## Zurueckgestellte Ideen von Markus (19. Sept. 2026) - erst, wenn alles andere fertig ist, aber nie vergessen

1. **Firmen-Kooperation per Link** (Beispiel Futterhaus): Die Firma schickt einen Link an ihre
   Kunden. Nur mit diesem Link laesst sich ein Design entwerfen (eines oder mehrere, je nach
   Freigabe). Der Kunde kreiert z. B. ein Poster, der Druckdienstleister verschickt es, die Firma
   zahlt Druck und Versand und uns einen Obolus. Pflicht: das Logo der beauftragenden Firma ist
   ganz dezent irgendwo auf dem Design versteckt - als Pflichtangabe, nicht abwaehlbar.
2. **Einladungskarten** (Hochzeit, andere Feiern): Gedruckte Karten mit QR-Code, digitale mit
   Link. Dahinter ein privater Bereich der Veranstaltung: die Gaeste laden ganz viele Fotos der
   Feier hoch, sichtbar nur fuer Menschen mit diesem Link, und wer mag, laesst daraus Designs
   entstehen. Ziel: sehr viel Traffic auf der Seite. Zu klaeren: Speichern der Gaestefotos
   (bisher liegt kein Kundenfoto auf der Platte) und die Rechte der abgebildeten Gaeste.
3. **Festival-Edition mit Sponsor** (Markus, 19. Sept., Beispiel Wacken / Hauptsponsor): Auf dem
   Gelaende liegen ueberall QR-Codes, der Link fuehrt direkt zu Motto Otto. Die Leute machen ein
   Foto, die KI macht es schick, das Shirt kostet z. B. 5 Euro (den Rest zahlt der Sponsor),
   Festival und Sponsor stehen drauf - und es geht nur auf dem Festivalgelaende, durch unser
   System (Standort plus Code plus Zeitfenster; GPS allein ist faelschbar). Technisch dieselbe
   Kampagnen-Mechanik wie Idee 1 (Link/Code, Pflicht-Logo, Dritter zahlt), plus Ortsbindung und
   Abholung/Druck vor Ort. Gebrauchsmuster-Frage ist recherchiert (Antwort vom 19. Sept. im
   Chat): nur als System/Vorrichtung anmeldbar, nie als Verfahren oder Geschaeftsmodell;
   Naechstes am Markt: Noonah "MerchLab AI" (UK), Snapchat Sponsored Geofilters (seit 2015).
4. **Postkartenseite aufraeumen** (Markus, 20. Sept.): "Es muss ganz einfach sein, da haben Dinge
   mit den T-Shirts nichts zu suchen, und die Ansicht muss wesentlich schneller kommen. Zu dem
   Aufraeumen mache ich mir Gedanken, du dir bitte nicht." Also: warten, bis Markus sagt, wie.
   Offen dazu (technisch, spaeter): echtes Foto der Sehenswuerdigkeit (Wikipedia Commons) als
   zweite Vorlage fuer die Bild-KI, damit die Kirche wie die Kirche aussieht.
5. **Orts- und Stadtwappen auf der Postkarte** (Markus, 20. Sept.): "Gerade bei Doerfern oder
   kleineren Staedten koennte auch das Stadtwappen beziehungsweise Dorfwappen genutzt werden."
   Technisch: Wappen liegen bei Wikipedia als Vektorgrafik im Ortsartikel, als zweite Vorlage
   wie das Foto der Sehenswuerdigkeit. Rechtlich: Hoheitszeichen, unbefugte Benutzung ist eine
   Ordnungswidrigkeit (§ 124 OWiG) - also nur fuer Orte, die es erlaubt haben. Passt zu Idee 1:
   Gemeinde oder Tourismusbuero sagt ja, bekommt Link/QR fuer den Ortskern, ab dann traegt die
   Karte das Wappen. Erster Testfall: Jesteburg.
   Dazu (Markus, 20. Sept., zur Karte aus Jesteburg): "Du kannst dir nicht irgendwas ausdenken.
   Das muss zu 100 % korrekt sein. Fakten, Fakten, Fakten." Und: nur ein Foto vom Rathaus ist
   langweilig. Also: Ansichtskarte mit mehreren Feldern, JEDES nach einem echten Foto (Rathaus,
   Bossard, Kirche, Seeve) - der Bilddienst nimmt seit dem 20. Sept. mehrere Vorlagen
   (edit_ballz_image, reference_image_urls). Zweite Idee von Markus: der Umriss der Gemeinde
   (OpenStreetMap-Grenze, echte Daten) mit Punkt oder Herz am Aufnahmeort - als exaktes
   Element, nicht von der KI gemalt.
   Vorlagen-Regel (Markus, 20. Sept.): "Nicht zwanghaft, dass man Fotos mitgeben muss. Es muss
   moeglich sein, die Fotos ueber Wikipedia rauszusuchen und nachzubilden, ohne Stress, dass wir
   das Originalfoto nicht nutzen. Hoechstgradig automatisiert. Nur wenn eine Gemeinde freiwillig
   Fotos gibt, nutzen wir die." Umgesetzt am 20. Sept.: Titelbild des Wikipedia-Artikels je
   Sehenswuerdigkeit (nur freie Lizenz, Fotograf und Lizenz im Auftrag als Nachweis) geht als
   Zusatzvorlage an den Bilddienst; die KI malt das Gebaeude exakt nach, waehlt aber Blickwinkel
   und Licht selbst. Google-Bilder nie (keine Rechte).
   Erweitert am 21. Sept. (Markus: "ein, zwei Fotos wirst du im Internet immer finden, beiss
   dich nicht nur an Wikipedia fest" - "wenn man nicht so viel findet, zeichnet man die
   Ortskarte und pumpt ein bisschen auf"): Ein Wappen, eine Flagge, eine Karte oder ein SVG als
   Wikipedia-Titelbild ist KEIN Foto des Ortes (Harmstorf: das Wappen galt als Foto, die KI
   erfand eine Kirche). Ohne Titelbild sucht der Server Openverse (Commons, Flickr u. a.; nur
   CC BY, CC BY-SA, CC0, Public Domain - kein NC/ND, weil die Karte verkauft wird) und dann die
   Commons-Volltextsuche; Ortsname muss im Titel stehen, Graeber/Personen/Wappen fallen raus.
   Gibt es gar kein Foto, wird die echte Ortskarte (OpenStreetMap, 3 x 3 Kacheln, Zoom 15) zur
   Vorlage und die KI zeichnet daraus eine grosse, vereinfachte Karte des Dorfes als Held;
   Nachweis "Karte: © OpenStreetMap-Mitwirkende" auf der Rueckseite. Das Wappen kommt nach dem
   Bild in die ruhigste Ecke (ruhigeEcke), nie auf Schrift oder eine gemalte Tafel.
   Openverse ohne Schluessel: 200 Suchen am Tag; OPENVERSE_CLIENT_ID/-SECRET (Umgebung) hebt das.
   Der Hintergrund des Selfies (Markus, 21. Sept.: "Wir muessen sogar den Hintergrund nehmen!!!
   spaetestens dann, wenn jemand im Stadion ein Foto macht"): das Selfie ist AM ORT aufgenommen,
   sein Hintergrund ist der Ort und bleibt auf der Karte - immer, auch ohne Vorlagenfoto. Nie
   "nur die Person aus dem Selfie" bestellen (das stand am 21. Sept. kurz im Bestellzettel und
   war falsch). Bei Shirt-Motiven faellt der Foto-Hintergrund weiter weg (nachbauPrompt ohne
   umgebung).
   Vorzeige-Designs fuer einen Artikel (21. Sept., "mach das selber"): im Manifest je Motto
   "artikel": { "kissen": { style, textile, url } } - Bild in der Leinwand des Artikels erzeugen
   (Bestellzettel des Mottos + druckBlock(artikel)), importOne legt es mit input.artikel an,
   Platz "<stil>@<artikel>". Die Startseite zeigt es unter "Eigenes Design fuer das Kissen".
   Ohne ADMIN_TOKEN ist das der Weg ins Backend: Manifest im Repo, Import beim Deploy.
   Abfolge (Markus, 20. Sept., umgesetzt): "Zuerst Selfie, dann muss das neue Fenster aufgehen,
   Ort bestaetigen, Stil, Postkartenart - immer mit Beispielen belegt - dann Otto starten. Bei
   jedem Produkt: nichts scrollen und eintragen, sondern eine Abfolge." Motor: abfolge.js (planen,
   fehlt, zusammenfassung sind reine Rechnung, Abschnitt 9 prueft sie; starten baut im Browser die
   Bildschirme aus den VORHANDENEN Feldern der Seite, Abschnitt 7 geht den Weg auf drei Geraeten).
   Welche Schritte es gibt, steht in der Motto-Datei ("abfolge": Felder und Bereiche je Schritt).
   Markus, 20. Sept. abends: "Das muessten wir bei allen Themen, bei jedem Motto, ueberall genauso
   machen." Seitdem gilt die Abfolge fuer JEDES Motto: ohne eigenen Eintrag baut standardAbfolge()
   die Schritte aus den Feldern (Freestyle: erst der Artikel; jedes Pflichtfeld eine Frage,
   Abhaengige beim Schalter; Freiwilliges gesammelt; dann Logo, Textil, Stil, Figuren; Feinheiten
   gesammelt). Notausgang je Motto: "ohneAbfolge": true. Stile: vier vorn, Rest hinter "Mehr Stile". Postkartenart =
   Feld 'karte' vom Typ 'wahl' (Kacheln mit Beispielbild, Prompt-Text fuer {karte}, Flaeche des
   Artikels: a6, a6-hoch, panorama). Neue Form = neuer Eintrag in options plus Beispielbild in
   postkarte/beispiele. Beispiele sind Paris mit Otto (jubel-gross) im Stil Ansichtskarte.
   Offen (Markus, 20. Sept., Screenshot Poster-Mockup mit Postkarte): das Querformat-Motiv sitzt
   klein im Hochformat-Rahmen. "Entweder verkleinern wir den Bilderrahmen, oder das Motiv muss
   sich aendern." Fuer Querformat-Motive braucht Poster/Acrylbild ein Querformat-Mockup.
6. **Veranstaltungsstaetten: was laeuft dort gerade?** (Markus, 20. Sept.): Wird als Standort eine
   Halle oder ein Stadion erkannt (Beispiel Uber Arena Berlin: mehrere Vereine, Konzerte), soll
   der Server automatisch im Veranstaltungskalender nachsehen, was an diesem Tag laeuft (Alba
   Berlin -> Basketball, Konzert -> Kuenstler) und die Karte danach ausrichten. "Das muessen wir
   auf alle Veranstaltungsstaetten umbauen." Zu klaeren: Datenquelle (kein einheitlicher
   Kalender; Ticketmaster Discovery API, Eventim, Liga-Spielplaene wie openligadb, Website der
   Halle), Markensperre fuer Vereins- und Sponsornamen, Fanclub-Regel. Recherche zuerst.
   Erweiterung (Markus, 20. Sept.): alle Gemeinden, Doerfer und Staedte Deutschlands (rund
   10.800) automatisiert anschreiben - Einverstaendnis fuer das Wappen, Moeglichkeit, Fotos
   mitzugeben, und das Angebot, die Motive als Textilien in unserem Shop anzubieten. "Mach dir
   Gedanken, dann koennen wir es richtig gross machen." Konzept vom 20. Sept. im Chat: kein
   Massen-Mailing ohne Einwilligung (§ 7 UWG gilt auch fuer Behoerden), stattdessen Ortsseite je
   Gemeinde + Anschreiben in Stufen (Landkreis Harburg -> Niedersachsen -> Bund), Einwilligung
   per Online-Formular, Foto-Upload aus Idee 2, Heimat-Kollektion im Shop.
   Stand 20. Sept., abends: ERSTE FREIGABE. Markus: "Fuer die Postkarten haben wir die Freigabe
   von Harmstorf 21228 - wenn von da jemand was macht, bitte das Original-Wappen mit drauf
   bringen." Umgesetzt in wappen-freigabe.js: postkarte/wappen-freigaben.json (ein Eintrag je
   Gemeinde: Name, PLZ, Gebietsgrenzen, Quelle, Lizenz, Datum der Freigabe), das amtliche Wappen
   freigestellt unter postkarte/wappen/<datei>. Beim Postkarten-Auftrag: Treffer ueber den
   Ortsnamen oder den Standort im Gemeindegebiet -> die Bild-KI laesst die Ecke oben links frei,
   danach kommt das Original pixelgenau darauf (nach der Bildpruefung, vor der Druckdatei).
   Neue Gemeinde = neuer Eintrag plus Bild (wappenFreistellen macht aus dem Wikipedia-Bild das
   PNG). Ohne Eintrag nie ein Wappen.
   Offen (Markus, 20. Sept., 23:40): "Die ganzen Mockups muessen wir wahrscheinlich eh neu
   zeichnen, weil ganz fuerchterliche Dinge dabei sind." Welche, hat er nicht gesagt - vor dem
   Neuzeichnen einen Kontaktbogen aller Vorlagen (Produkt und Situation, vorlagen-original/)
   vorlegen und die schlechten benennen lassen. Neue Vorlage = Magenta-Weg (vorlagen.js),
   Flaeche messen, MITGELIEFERT mit hoeherem Stand; schraege Flaechen mit ecken (perspektivisch).
   Markus dazu: "Aber natuerlich richtig und schoen." Und: "Bei Graffiti und Street Art soll es
   einfach nicht gleich aussehen" - der Street-Art-Text ist seiner (Wort fuer Wort), Graffiti ist
   der andere; die Abnahme misst, dass beide sich unterscheiden (Abschnitt 4, Stile). Nie angleichen.
   Stil-Kacheln (21. Sept.): stile/kacheln/<stil>.jpg - der Stilname als Schrift im eigenen Stil,
   keine Textilien. Markus' Vorgaben: Street Art hat einen STOERER hinter der Schrift (gemalter
   Farbblock, z. B. weiss, dazu Smiley, Krone, Herzen, Spiralen, Schwarzweiss-Stadtcollage - siehe
   seine Referenzen Koelle/Berlin/Reeperbahn vom 21. Sept.); Meisterwerk sieht aus wie sein
   Roemer-Bild (Van-Gogh-Wirbel, Goldornament, Mosaikfacetten, Goldschrift). "Wie vorgesehen" ist
   keine Kachel mehr, Robotic (Cyber, Chrom, Schaltkreise) ist neu. Keine Motto-Variante je Stil.
   Offen (Markus, 00:29, Kissen auf dem Sofa): ein deckendes Motiv auf hellem Grund wird auf dem
   Kissen ein heller Block. Seine Idee: Elemente des Motivs (Sterne, Sonne) herausnehmen und auf
   die freie Flaeche streuen - das braucht einen Bildlauf je Design (Streumuster), noch nicht gebaut.
7. **Vorher-Foto und Nachher-Foto beim Event** (Markus, 20. Sept., zur neuen Weihnachtsfeier):
   "Unser Event: die Leute nehmen ein Vorher-Foto auf und ein Nachher-Foto." Beim Ankommen ein
   Selfie, am Ende des Abends noch eins, Otto macht aus beiden EIN Motiv (zwei Felder, ein Bild,
   Stil wie die Postkarte). "Geht natuerlich auch wunderbar auf einer Hochzeitsfeier." Gehoert
   zur Event-Mechanik (Idee 3: Link/QR je Veranstaltung); das Motto "Weihnachtsfeier" (seed.json,
   Gruppe Feiern & Reisen) ist seit dem 20. Sept. da, das Vorher/Nachher kommt mit dem Event.
   Steht so auf /event. Zu klaeren wie bei Idee 2: zwei Fotos ueber Stunden - das erste darf
   nicht auf die Platte (Regel: kein Kundenfoto auf der Platte), also Foto 1 im Browser des
   Gastes halten (sessionStorage/IndexedDB) oder verschluesselt mit Ablauf beim Event-Link.
9. **Aus der Karte wird ein fertiger Social-Beitrag** (Markus, 23. Sept., abends): "Jetzt noch eine
   weitere Moeglichkeit, interessant fuer Firmen und natuerlich auch fuer die Gastronomie: dass die
   Leute nicht nur eine Postkarte machen koennen, sondern daraus direkt inklusive Text und Hashtags
   und Bild fuer Instagram, TikTok und Facebook."
   Warum das billig ist: seit dem 23. Sept. baut die Bild-KI die ganze Karte aus EINEM Auftrag
   (firmen-flyer.js). Ein anderes Format ist deshalb kein neues Design, sondern derselbe Auftrag in
   einer anderen Leinwand - hochkant 1080x1920 fuer Story/Reel/TikTok, 1080x1350 fuer den Feed.
   Der Text ist kein Bildproblem: Firma, Gewerk, Ort, Datum und die Kopfzeile stehen schon im
   Auftrag, daraus schreibt das Textmodell (env.QA_MODEL, wie bei research.js) Bildunterschrift und
   Hashtags. Ortsname, Firmenname und Gewerk sind belegte Fakten - erfunden wird nichts.
   ENTSCHIEDEN (Markus, 23. Sept.): **"Definitiv nur zum Kopieren."**
   Motto Otto postet NICHT selbst. Kein Meta-App-Review, kein Instagram-Business-Konto, keine
   TikTok-Freigabe, kein OAuth je Kunde, kein Zugriff auf fremde Konten - und damit auch keine
   Sperre, die alle Kunden gleichzeitig trifft. Geliefert wird: das Bild zum Herunterladen, der
   Text daneben, ein Knopf zum Kopieren. Wer das aufweicht, aendert eine Entscheidung, die
   ausdruecklich gefallen ist.
   Meine Vorgaben dazu, bis er etwas anderes sagt: hochkant 1080x1920 ist der Standard (Story,
   Reel, TikTok), 1080x1350 fuer den Feed kommt auf Wunsch dazu - jedes Format ist ein eigener
   Aufruf beim Bilddienst.
   MOTTO OTTO FAEHRT MIT, UND DAS WIRD BEZAHLT (Markus, 23. Sept.): "Wer das postet und wir das so
   hinkriegen, dass Motto Otto praesent ist - definitiv auch als Hashtag. Dann bekommen die fuenf
   Credits geschenkt je Posting."
   Also: #mottootto ist PFLICHT in jedem Beitrag, nicht abwaehlbar, und es steht vorn, nicht
   hinten im Rudel. Dafuer fuenf Credits je Beitrag, geschenkt - dieselbe Waehrung wie in Idee 8
   (nur intern, nur gegen Designs, nie Auszahlung, kein Geldfluss).
   ENTSCHIEDEN (Markus, 23. Sept.): **MIT NACHWEIS.** "Ich wuerde das schon gerne ueberpruefen."
   Also keine blosse Zusage: der Kunde fuegt den Link zu seinem Beitrag ein, der Server holt die
   Seite und sieht nach, ob #mottootto darin steht (beitragPruefen in social.js).
   DREI ERGEBNISSE, NIE ZWEI - das ist der Kern: ja (Hashtag nachgewiesen, fuenf Credits), nein
   (Seite lesbar, Hashtag fehlt - der Kunde erfaehrt es und kann ihn nachtragen), UNPRUEFBAR
   (privates Konto, Anmeldeschranke, Seite weg, Netzaerger). Unpruefbar ist KEIN Vorwurf und darf
   nie als "hat nicht gepostet" behandelt werden - wir posten nicht selbst, also gibt es Faelle,
   die wir schlicht nicht sehen. Dort entscheidet ein Mensch.
   Geholt werden nur Instagram, TikTok und Facebook, nur ueber https, nur die bekannten Hosts -
   sonst laedt der Server auf Zuruf beliebige Seiten. Gutschrift einmal je Karte.
   GILT FUER JEDE KARTE, nicht nur fuer Firmen (Markus, 23. Sept.): "Das kann natuerlich auch bei
   jeder Postkarte wunderbar funktionieren." Eine Karte aus Paris ist genauso ein Beitrag - dann
   tragen Ort und Land die Hashtags, und der Satz heisst "Grueße aus Paris!". Die Firma ist eine
   Zutat, keine Voraussetzung.
   Regeln, die schon feststehen: kein Kundenfoto auf der Platte (Regel), das Firmenlogo bleibt
   unveraendert, und ein Hashtag mit einer fremden Marke wird nie erfunden - nur die Firma selbst,
   der Ort und das Gewerk.

8. **Gastro: QR-Code auf dem Tisch** (Markus, 23. Sept., zum Firmen-Flyer): "Der Firmenflyer
   muesste sogar noch ein wenig erweitert werden, um einen Gastroteil fuer Restaurants, Imbiss
   und Hotels. Kooperation mit den Gastronomen, die einen QR-Code auf den Tisch stellen. Die
   Leute scannen den QR-Code, kommen sofort auf die dementsprechende Karte beziehungsweise
   Flyer, koennen liebe Gruesse schicken, koennen schicken, wie's geschmeckt hat, vielleicht
   sogar mit einer kleinen Bewertungsfunktion mit Sternen. Und dass der Versender der Bilder
   Credits bekommt, die er wieder in Designs umaendern kann. Und dass gespeichert wird, wann und
   wo, in welchem Restaurant er war, und dann frei einstellbar Erinnerungen an diese Person
   geschickt werden, als Marketing-Tool."

   **Was davon schon steht** (das ist der Grund, warum die Idee traegt):
   - Der Gastronom IST eine Firma mit Freigabe. firmen-freigabe.js entscheidet ueber Punkt und
     Radius, wer Absender ist - ein Restaurant ist genau dieser Fall, nur dass der Gast am Tisch
     sitzt statt davorzustehen. Logo, Hausfarben und Fotos holt logo-holen.js von seiner Seite.
   - Die Karte selbst ist der Firmen-Flyer (firmen-flyer.js): Selfie am prominentesten, Farben
     aus dem Logo, ein Foto von der Seite, die Strassenkarte. Fuer Gastro kaeme der Anlass dazu -
     was es zu essen gab, wie es geschmeckt hat.
   - Der QR-Weg ist dieselbe Mechanik wie Idee 1 (Futterhaus) und Idee 3 (Festival): Link oder
     Code, Pflicht-Logo, ein Dritter zahlt. Wer das eine baut, hat das andere fast mit.
   - Standort, Datum und Koordinaten laufen schon (standort.js, Feld standort_koord).

   **Was neu gebaut werden muss:**
   - Rueckmeldung des Gastes: wie es geschmeckt hat, Sterne. Das ist neue Art von Daten - sie
     gehoert dem Gastronomen, nicht dem Design.
   - CREDITS: ein Guthaben je Person, verdient durch Verschicken, ausgegeben fuer Designs.
   - Besuchsverlauf je Person: wann, wo, welches Haus.
   - Erinnerungen nach frei einstellbarer Frist.

   **Vier Dinge, die vorher geklaert sein muessen - erst recherchieren, dann bauen:**
   1. ERINNERUNGEN SIND WERBUNG. § 7 UWG gilt hier genauso wie bei den Gemeinden (Idee 6): ohne
      ausdrueckliche Einwilligung des GASTES keine Mail, und die Einwilligung kann der Gastronom
      nicht fuer ihn geben. Double-Opt-in, jederzeit abbestellbar, und der Absender muss klar
      sein (wir oder das Restaurant?).
   2. "WANN UND WO ER WAR" IST EIN BEWEGUNGSPROFIL. Das ist die heikelste Zeile der ganzen Idee.
      Es braucht Zweck, Frist und Loeschung, und es muss ausdruecklich gewollt sein - nicht als
      Nebenwirkung des Scannens entstehen. Passt zur Hausregel "kein Kundenfoto auf der Platte":
      wir speichern so wenig wie moeglich, und was wir speichern, sagen wir.
   3. STERNE - ENTSCHIEDEN (Markus, 23. Sept.): "Die Bewertungen sind ja nur auf dem Tool, was die
      verschicken." Also KEINE oeffentliche Bewertungsplattform: die Sterne gehen mit der Karte
      raus und an den Gastronomen, sie werden nicht als Rezension veroeffentlicht. Damit faellt
      der ganze Komplex Manipulation und Haftung fuer fremde Aussagen weg. Wenn das je
      veroeffentlicht werden soll, ist das eine neue Entscheidung - veroeffentlichen kann man
      spaeter, zurueckholen nicht.
   4. CREDITS - ENTSCHIEDEN (Markus, 23. Sept.): "Die Credits machen wir nur intern und werden nur
      mit Designs verrechnet beziehungsweise freigeschaltet, so dass kein Geldfluss entsteht, und
      koennen auch nicht ausgezahlt werden." Das ist der entscheidende Zuschnitt: ein Guthaben,
      das AUSSCHLIESSLICH die eigene Leistung freischaltet und NIE in Geld zurueckgeht, ist ein
      Treuepunkt wie bei Payback - kein Zahlungsmittel, kein E-Geld, kein Gutschein, den jemand
      einloesen koennte. Damit bleibt es aus dem Zahlungsdiensterecht heraus.
      Was trotzdem in die AGB gehoert, damit es dabei bleibt: kein Barwert, keine Auszahlung,
      nicht uebertragbar, und wir duerfen das Programm aendern oder beenden. Und was der
      Steuerberater einmal ansehen sollte, kein Blocker: wenn ein Credit ein Design freischaltet,
      das sonst Geld kostet, ist der Moment des Einloesens der Moment, in dem etwas verguenstigt
      abgegeben wird.

   **Der Wert, festgelegt** (Markus, 23. Sept.): "Ich wuerde da als Wert eintragen: pro Karte, die
   verschickt wird, an mindestens drei Personen aus der Gastronomie heraus, erhaelt der, der
   verschickt hat, fuenf freie Designs. Bei allem, was wir an Kunden verschicken, muessen wir
   natuerlich probieren, dass wir die auch auf unsere Seite ziehen."
   Also: eine Karte, mindestens drei Empfaenger, fuenf freie Designs fuer den Absender. Und jede
   Karte, die rausgeht, ist zugleich der Weg, auf dem die Empfaenger zu uns kommen - der Absender
   bekommt das Guthaben, die Empfaenger sind die naechsten Kunden.

   **Achtung, genau an diesem Anreiz haengt eine Rechtsfrage** (recherchiert, nicht vermutet):
   Verschickt UNSER Server die Karte an drei fremde Adressen, ist das Werbung von uns an diese
   Fremden. Der BGH hat Empfehlungs-E-Mails 2016 so eingeordnet (I ZR 7/16, "Empfehlungs-E-Mail"):
   der empfehlende Kunde kann die Einwilligung fuer den Empfaenger nicht geben, versandt hat es
   der Betreiber. Und weil wir fuer genau dieses Verhalten fuenf Designs geben, ist es ein System
   und kein Einzelfall.
   Der Ausweg kostet nichts und erhaelt die Idee ganz: DER GAST VERSCHICKT SELBST. Er bekommt die
   fertige Karte als Bild oder Link und schickt sie ueber WhatsApp oder sein eigenes Mailprogramm.
   Dann kommuniziert er, nicht wir. Das Guthaben gibt es trotzdem - und sauberer, wenn es erst
   zaehlt, sobald die Empfaenger den Link wirklich oeffnen. Das ist zugleich der Schutz dagegen,
   dass jemand drei erfundene Adressen eintippt, um fuenf Designs zu bekommen. Weitere Bremsen,
   falls noetig: nur verschiedene Empfaenger zaehlen, Obergrenze je Person und Tag.

      **Wo es hingehoert:** derselbe Kampagnen-Bau wie Idee 1 und 3 - ein Eintrag je Haus (Name,
   Standort, Freigabe, was der Gast darf), ein Link oder Code je Tisch, und die Auswertung beim
   Gastronomen. Nicht als vierter getrennter Weg danebenbauen.

10. **Der Gastronom als Tor: QR am Tisch -> Motto Otto im Design des Hauses** (Markus, 1. Okt.):
   "Die Idee mit der Postkarte mit dem Gastronom findet guten Anklang, und daraus eventuell auch
   diese Gutschein-Nummer zu machen. Der Gast scannt den QR-Code auf dem Tisch, dann geht Motto
   Otto im Design des Gastronomen auf: Postkarte, Gutschein, aber eventuell auch Merchandise,
   sprich Textilien aus unserem Shop in einem gewissen Design - analog zur Postkarte, passend zum
   Gastronomen, nur mit der Moeglichkeit, dass es noch personalisiert werden kann."
   RECHERCHIERT (1. Okt.): Restaurant-Merch ist 2026 ein echter Trend (The World's 50 Best, Tim
   Raue Berlin mit eigenem Shop; Lightspeed und SevenRooms raten Gastronomen aktiv dazu). Was es
   am Markt gibt: Print-on-Demand-Shops fuer das Haus (Spreadshop, Printful, Gelato) - EIN festes
   Design, kein Gast-Bezug, kein Tisch-QR, kein Selfie. Niemand verkauft "dein Abend bei uns, auf
   dem Shirt, mit dir drauf". Genau das koennen wir, und zwar aus Teilen, die stehen:
   - Postkarte vom Haus: firmen-flyer.js, Freigabe-Eintrag, Sterne (Idee 8), fester Rahmen (EAST26).
   - Gutschein: der Gutschein-Weg (30. Sept.), gleiches Design, Stripe Connect an das Haus.
   - Merch aus der Karte: artikelfassung.js setzt den Karten-Master schon heute auf Tasse,
     Poster, Acryl - Textilien fehlen dort noch; und "Vorzeige-Designs je Artikel" (21. Sept.)
     erzeugt ein Design in der Leinwand des Artikels. Fuer ein Shirt des Hauses braucht es eine
     Textil-Fassung des Firmen-Auftrags (Logo, Hausfarben, Dinge des Hauses, kein Rand, keine
     Ortskarte) plus die Personalisierung (Name, Datum, "Ich war da", Selfie gemalt) - das ist
     derselbe Auftrag mit anderer Leinwand, wie beim Social-Hochformat.
   - Das Tor: eine Seite je Haus (z. B. /bei/<slug>) in Logo und Hausfarben mit drei Tueren
     (Postkarte, Gutschein, Shirt); der QR am Tisch zeigt dorthin. Die Gutschein-Seite
     (/gutschein/<slug>) ist die erste Tuer davon.
   ZWEI DINGE, DIE VORHER KLAR SEIN MUESSEN:
   1. LIZENZ: ein Logo auf einem VERKAUFTEN Shirt ist Merchandising - markenrechtlich (und oft
      urheberrechtlich) nur mit Lizenzvertrag erlaubt, ueblich mit Umsatzbeteiligung des
      Rechteinhabers. Unsere Freigabe-Eintraege decken heute die POSTKARTE. Fuer Merch braucht
      die Freigabe einen Satz mehr (Textilien, Verkauf durch uns, Provision an das Haus) - das
      ist Text fuer Markus, kein Code.
   2. KAUFMOMENT: am Tisch kauft niemand ein Shirt fuer 30 Euro aus dem Stand. Gemessen am Markt:
      Tisch-QR wandelt 1-2 % der Gaeste (Bewertungen; der QR auf der RECHNUNG liegt hoeher). Also
      Postkarte zuerst (billig, sofort, Selfie), das Shirt als zweite Tuer DANACH: "dein Motiv
      auch auf dem Shirt" - mit dem Design, das der Gast gerade gemacht hat. Das ist die
      Artikelfassung, nur fuer Textil.
   GEBAUT am 1. Okt. (Markus: "Mach das komplett fertig mit 20 % Lizenzgebuehr fuer EAST26,
   generiere mir auch einen QR-Code dazu, und mit dem QR-Code soll diese Seite direkt so
   aufgehen und auch schon das EAST26-Logo direkt anzeigen. Die Moeglichkeit Postkarte,
   Gutschein und all unsere Artikel schoen gemacht."):
   - haus-route.js + haus.html: /bei/<slug> in Logo und Hausfarbe des Betriebs (Elfenbein-
     Papier, Akzent = farben[0]), drei Tueren: Postkarte (/m/gruesse-aus?firma=<slug>),
     Gutschein (/m/gutschein?firma=<slug>), Shirt & Co. (/m/gruesse-aus?firma=<slug>&teil=tee -
     erst die Karte, dann das Motiv auf den Artikeln, wie entschieden: Kaufmoment). Darunter das
     Design des Hauses auf acht Artikeln (Shirt, Hoodie, Tasse, Kissen, Poster, Beutel,
     Acrylbild, Brett) mit Listenpreis aus preise.cjs, und die Lizenzzeile.
   - /bei/<slug>/aufsteller: der Tischaufsteller A6 (Logo, QR, drei Worte), druckfertig.
     /api/mo/bei/<slug>/qr.png: der QR (1200 px) auf motto-otto.de/bei/<slug>.
   - Vorgebaut im Repo (postkarte/haus/): east26-karte.jpg = fester Rahmen A mit dem Patio-
     Foto im Feld (Magenta-Rest 0), die acht Mockups (makeMockup, 900 px), east26-qr.png.
     Fuer ein neues Haus: Karte und Mockups mit demselben Dreizeiler bauen (siehe Commit).
   - motto-seite.js: ?firma=<slug> bei der Postkarte -> wunschFirma, sofort im versteckten
     Feld, Absender-Knopf vorbelegt, sobald die Liste kommt (absenderAnbieten). Der Server
     prueft Freigabe und Standort wie immer (freigabeFuer).
   - LIZENZ, AUTOMATISCH AUSGEZAHLT (Markus, 1. Okt.: "ueber Stripe direkt ausgezahlt - die
     20 % an den Gastronom oder wer auch immer mitmacht, und bei Gutscheinen genau andersrum"):
     EAST26-Eintrag lizenz {prozent 20, artikel, postkarte, gutschein: false, seit 1. Okt.}; der
     Server haengt sie an jedes Design mit dem Logo (job.firma.lizenz). lizenzen.js: der Shopify-
     Webhook (fulfillment.js, eine Zeile: deps.beiBestellung) meldet jede Bestellung; je Zeile mit
     lizenziertem Design entsteht ein Satz (storage/lizenzen/<bestellung>__<design>.json) mit
     20 % vom NETTO (24,90 brutto -> 4,18 EUR), und die Ueberweisung geht als Stripe-TRANSFER von
     unserem Guthaben auf das Connect-Konto des Hauses (billing.js connectUeberweisung,
     transfer_group lizenz-<bestellung>). Ohne Konto wartet der Satz (ohne_konto), ohne Schluessel
     bleibt er offen; stuendlich wird nachgeholt (2 min nach dem Start, dann jede Stunde). Backend:
     GET /api/admin/lizenzen?firma=east26 (Saetze + Summen), POST /api/admin/lizenzen/<id>/
     ueberweisen, POST /api/admin/lizenzen/probe {designId, produkt, preis, menge} spielt eine
     Bestellung ohne Shopify durch. GUTSCHEIN ist die andere Richtung und bleibt es: der Betrag
     geht per Direct Charge an das Haus, 5 % application fee an uns, keine Lizenz obendrauf.
     Der Transfer selbst ist am Stripe-Konto NICHT gemessen (kein Schluessel hier); lokal
     gemessen: Satz 2 x 24,90 -> 8,37 EUR, Status ohne_konto, doppelter Webhook legt nichts an.
     Voraussetzung live: STRIPE_SECRET_KEY, ein Connect-Konto je Haus (POST /api/admin/firmen/
     <slug>/stripe), und Guthaben auf unserem Stripe-Konto, aus dem der Transfer geht.
   - Der Freigabe-Satz fuer Merch (Lizenzvertrag mit dem Haus) ist Text fuer Markus - der
     Eintrag traegt nur sein Wort vom 1. Okt.
   TUER 3 = TEXTIL, NICHT DIE KARTE (Markus, 1. Okt., abends: "Wenn jemand dort auf Textil machen
   drueckt, muss man genau da auch hinkommen und nicht wieder auf die Postkarte, und es soll alles
   so funktionieren wie immer, nur dass 100 % das EAST-Logo drauf ist - bei Luigi Luigi, beim
   Sportverein das Logo vom Sportverein."): Motto "haus" (postkarte/motto-haus.json, beim Start
   wie Gutschein angelegt, HAUS_REV) = der Freestyle-Eintrag der Saat mit verstecktem Feld firma,
   Logo-Upload exakt und Pflicht, markenfrei, hausTextil. Der Betrieb kommt aus dem Link
   (/m/haus?firma=<slug>&teil=<artikel>), die Seite setzt sein Logo als Upload fr_<slug>.png
   (Vorschau /api/mo/firmenlogo/<slug>.png, kein Entfernen-Knopf); /generate loest fr_ ueber die
   Freigabe auf (firmenLogoBild -> storage/uploads/fr_<slug>.png, nur fuer hausTextil, nur mit
   Freigabe), danach laeuft der normale Logo-Weg (eingearbeitet oder exakt, Preflight, Magenta-
   Platzhalter). runJob haengt Betrieb und Lizenz an den Auftrag (kartenart haus). Tuer 3 und
   die Artikel-Kacheln des Tors zeigen auf /m/haus. NICHT gemessen: ein Lauf am Bilddienst
   (kein Schluessel) und der Browser-Weg (Pins pruefen Motto, Server, Seite, Tor).
   Nicht gemessen: ein Live-Lauf ueber /bei/east26.
   Die Seite zum Ansehen (Markus, 1. Okt.: "Zeige mir jetzt einmal die EAST26-Seite"): als
   Artefakt gebaut aus der lokal gerenderten Seite, Bilder eingebettet -
   https://claude.ai/artifact/GDbrAornLwKkKQ5mzP9Zv1 - plus zwei QR-Codes (Vorschau jetzt, Live
   nach dem Deploy). Sein Urteil: "Beutel sieht Katastrophe aus ... und das Schneidebrett
   nehmen wir komplett raus, ueberall." BEUTEL: die Querkarte wird auf dem Beutel winzig - aus
   dem Tor genommen (Fussmatte stattdessen, quer und vollflaechig), die Beutel-Vorlage selbst ist
   Chat 1 (Befund: Querformat-Motiv auf dem Beutel). Dann Markus: "Zum EAST in Mallorca wuerde
   natuerlich auch ein Handtuch passen, richtig?" - das Strandtuch ist drin (die Karte liegt
   laengs auf dem aufrechten Tuch, so werden Strandtuecher gedruckt), das Mousepad dafuer raus.
   Tor-Artikel: Shirt, Hoodie, Tasse, Kissen, Poster, Strandtuch, Acrylbild, Fussmatte. SCHNEIDEBRETT
   RAUS, UEBERALL - mit einem Schalter statt Loeschen, damit alte Designs lesbar bleiben:
   GARMENTS.brett.aus (mockups.js) -> produkte.enabledFor laesst es weg (keine Mockup-Reihe,
   kein Backend-Produkt), passtVorzeige sagt nein (keine Vorzeige-Designs), Katalog
   ausserHandel -> verkaufsfaehig false (nicht im Freestyle), aus preise.cjs MERCH gestrichen
   (Startseite, Preisliste); label('brett') liefert weiter "Schneidebrett" fuer alte
   Bestellungen. Das ist Chat 1-Gebiet (mockups.js, artikel.js, preise.cjs, produkte.js) -
   auf Markus' Wort, so klein wie moeglich.
   KUNDENSEITE OHNE LIZENZ (Markus, 1. Okt., abends: "Es geht keinen Kunden an, wie viel Prozent
   der Lizenz ... das ist doch Kundenseite!"): die Lizenzzeile ist aus haus.html und haus-route.js
   raus; die Lizenz steht nur am Auftrag und in /api/admin/lizenzen. Die Abnahme verbietet
   "Lizenz" und "\d+ %" in der Vorlage.
   RAUS (Markus, 1. Okt., abends: "Heraus damit, einmal fuer Luigi und fuer das EAST26, bitte
   direkt mit jeweiligem QR-Code. Wichtig ist, wenn die Leute den Standort waehlen, dass das
   genauso aufgeht, als haette man einen QR-Code gescannt." - "Bitte veroeffentlichen"):
   - LUIGI hat sein Tor: /bei/luigispizzaug (auch /bei/luigi ueber die Namen), tisch.tor im
     Eintrag, Haus-Karte = die Pop-Art-Probekarte vom 26. Sept. mit seinem Logo
     (postkarte/haus/luigispizzaug-karte.jpg), acht Mockups, Tisch-QR 1200 px. Fuer ein neues
     Haus: Karte nach postkarte/haus/<slug>-karte.jpg, dann der Dreizeiler
     ensureTemplates('./storage') -> makeMockup(master, teil, farbe, false, { place: 'front',
     land }) je TOR_TEILE -> qrPng(basis + '/bei/' + slug, 1200).
   - STANDORT = QR: tippt der Kunde einen freigegebenen Betrieb an (Knopf mit data-tor), geht
     das Tor SELBST auf (location.href), nicht mehr nur der Hinweis - ausser er kommt schon vom
     Tor (?firma= im Link), sonst liefe er im Kreis. Das Selfie von vor dem Sprung ist weg; auf
     dem Tor faengt er neu an. Im Browser NICHT gemessen (die Abnahme prueft die Zeile).
   - DIE FLAGGE AUF DEM TUCH (Markus, 1. Okt.: "Beim Strandtuch mit dem Auffuellen ... beim
     Italiener links und rechts die italienische Flagge, beim Spanier die spanische, beim
     Griechen vom Griechen"): makeMockup kannte opts.land schon (Chat 1, flaecheMitMotiv legt
     die Flagge als Grund unter ein deckendes Motiv auf Flachware) - live kam dort aber das
     GETIPPTE Land des Kunden an (values.land), bei Luigi also Deutschland. Jetzt: server.js
     flaggenLandFuer(eintrag) = Land der Kueche (kuecheLand -> FLAGGEN_LAND -> Schluessel der
     Flaggentabelle), sonst das Land des Eintrags (EAST26: Spanien); haengt als
     job.firma.flaggeLand am Design (Firmenkarte, Gutschein, Haus-Textil) und geht in /api/mo/
     mockup VOR values.land. In mockups.js (Chat 1, auf Markus' Wort, zwei Stellen): Griechenland
     in FLAGGEN (neun Streifen, kein Kreuz), und die Streifen laufen entlang der Achse, die das
     Motiv fuellt - sonst lag bei Spanien (waagerecht) das Gold unter der Karte und zu sehen war
     nur Rot (gemessen am EAST26-Tuch). Die Tor-Tuecher sind damit gebaut: Luigi gruen-weiss-rot
     laengs, EAST26 rot-gold-rot laengs; die Abnahme misst die Pixel an beiden Enden.
     NICHT gemessen: ein Live-Design eines Hauses auf dem Tuch (Bilddienst).
   DER ANZEIGENAME (Markus, 2. Okt., zum Live-Tor: "Haus-Design hoert sich total scheisse an.
   Auch der Name kann nicht aus der kompletten Firmenbezeichnung genommen werden. Bei Luigi
   gehoert Luigi drauf, und nicht Luigi's Pizza UG - sonst stuende bei einer Firma die komplette
   Firmenbezeichnung da."): der Eintrag traegt `anzeige` (Luigi: "Luigi"; fehlt es, gilt
   `firma`). Der Kunde sieht NUR den Anzeigenamen: Tor (haus-route h.name), Absender-Knoepfe und
   Hinweis (Liste traegt `anzeige`, der Wert data-firma bleibt die Firmenbezeichnung, weil der
   Server damit den Eintrag findet), Gruss ("Wir sind bei Luigi"), Gutscheinzeile, der Auftrag
   (firma, geschaeft.name -> "Liebe Gruesse von Luigi!"). Die Firmenbezeichnung bleibt im
   Nachweis (autor), in der Lizenz-Liste und im Backend. Kein "Haus" mehr auf der Kundenseite:
   haus.html spricht vom Betrieb mit Namen ("Liebe Gruesse von Luigi", "Luigi auf unseren
   Artikeln"), das Motto heisst "Shirt, Tasse & Co. mit Logo" (HAUS_REV 2). Die Luigi-Haus-Karte
   ist neu am Bilddienst gebaut (2. Okt., popart, ohne Person, Pizza als Held, Logo exakt, Flagge,
   fuenf Sterne, "Liebe Gruesse von Luigi!") - die Pop-Art-Probekarte mit "Ich bin bei Luigi's
   Pizza UG" ist ersetzt; Prompt-Fassung in der Sitzung (flyerPrompt mit firma 'Luigi',
   ohnePerson, Bild 1 = heller Karton statt Seitenfoto, da Luigi keine produktbilder hat).
   ZWEI NUMMERN FUER EIN MOTTO (gemessen live, 2. Okt.): das Motto haus steht in postkarte/
   motto-haus.json (HAUS_REV) UND in seed.json (rev, vom Freestyle-Eintrag geerbt: 2). Der Saat-
   Abgleich schrieb am 1. Okt. seedRev 2, darum hat HAUS_REV 2 am 2. Okt. live NICHTS mehr
   aktualisiert - der Name blieb "Mit Logo des Hauses", obwohl das Tor schon neu war. Lokal
   nachgestellt (seedRev 2, alter Name -> Start -> "Haus-Textil: Motto aktualisiert"). Regel:
   HAUS_REV und seed.json rev des Mottos haus steigen immer ZUSAMMEN (jetzt 3); die Abnahme
   prueft beide. Gleiches Muster droht beim Gutschein (GU_REV, seed.json ohne rev = 1).

11. **Vereinskarte in der Halle oder auf dem Platz** (Markus, 2. Okt.): "Wenn jetzt jemand zum
   Beispiel in der Handballhalle ist, nehmen wir zum Beispiel den Verein VfV Spandau, geh dort auf
   die Homepage schauen, wo die spielen, und in diesen Hallen ist es dann genauso mit Standort, dass
   das so aufgeht im Stil von VfV Spandau mit diesen Artikeln mit Postkarte und Gutschein, und da
   kannst du zum Beispiel das Handballfeld mit einbauen. Macht das Ganze jemand auf dem Fussballplatz,
   dann natuerlich ein Fussballplatz im Hintergrund." Logo: "Ja, das Logo darf mit drauf" (VfV).
   Fussballverein (Markus, 2. Okt.): FV Rheinbrohl. Das ist der Ort, an dem Sport als Gestaltung erlaubt
   ist (Punkt 18 im Stand von Chat 3).
   NACHGESEHEN am 2. Okt. auf vfv-handball.de: Hallen laut Seite "Hallen": Falkenseer Damm 20,
   Falkenseer Damm 28, Martin-Buber-Oberschule, Havelgrundschule, B-Traven, Carl-Schurz-Halle
   (Helen-Keller-Weg 11). Logo wp-content/uploads/VFVSpandau.png, 512 x 512, schwarzes V im Kreis,
   Kanten weich (fuer den Druck grenzwertig). Hausfarbe nicht aus dem Logo (schwarz), sondern von der
   Seite: #AAD75B (21x im Quelltext), #088216 (15x). Spielplan: handball.net (nuLiga HV Berlin).
   Passt zu: Geschaeftskarte (Homepage lesen, Logo, Hausfarben, Rahmen aus den Dingen), Idee 6
   (Veranstaltungsstaetten) und Weg 1 (Freigabe = Logo drauf). Liegt im Bereich von Chat 2
   (Postkarte, Standort, logo-holen.js) - Markus, 2. Okt., auf die Frage, wer es baut: "du" (Chat 3).
   Baut auf dem Tor je Betrieb aus Idee 10 auf (/bei/<slug>, haeuser), nicht als eigener Weg daneben.

## Partner: eigener Bereich, eigener kleiner Shop (Markus, 2. Okt.) - GEBAUT auf eigene-fotos

Markus: "Die Bereiche EAST, Luigi und alle, die noch dazukommen, muessen selber einen Login-Bereich
bekommen, wo sie eigenstaendig einstellen koennen, was die Leute kaufen koennen, wie das gestaltet
ist etc. Das muss viel viel einfacher werden ... Foto hochladen, ein kleines Textfeld, was drauf
soll, automatisiert das Logo vom Partner, dann vielleicht auch nur zwei oder drei Stile ... Er muss
auch die Moeglichkeit haben, ein Logo hochzuladen ... eine Seite, wo die Partner gesucht werden
koennen und wo es die Moeglichkeit gibt, dass Partner sich eigenstaendig anmelden - Partner
werden." Und: "Ziel ist es, ... fuer den Gastronom, fuer den Partner, fuer den Verein einen
kleinen Merchandising-Shop direkt mit anbieten zu koennen."

SO IST ES GEBAUT (Dateien: partner.js, partner-route.js, partner.html, partner-werden.html,
partner-bereich.html, bei-machen.html, partner.css; klein in server.js, haus-route.js, haus.html,
motto-seite.js):
- EIN Partner = EIN Freigabe-Eintrag. Was ein Partner anlegt oder einstellt, liegt auf dem VOLUME
  (storage/partner/<slug>.json). server.js firmenFreigaben() = Repo-Freigaben + Ablage
  (partner.zusammenfuehren) - alle Wege, die Freigaben kennen (Standort, Tor, Logo, Haus-Textil,
  Gutschein, Lizenz, Flagge), kennen damit auch die Partner, ohne geaendert zu werden.
  Eigener Partner: der ganze Eintrag (firma = Slug, anzeige = Name, datei = partner-<slug>.png
  in storage/firmenlogos). Repo-Partner (EAST26, Luigi): nur ein Overlay mit basis = Repo-Firma
  (Angebot, Stile, Anzeigename, Farbe, Zugang, eigenes Logo).
- /partner: Partner finden (Suche nach Name/Ort, "In meiner Naehe" per Browser-Standort), nur wer
  ein Tor hat (tisch) oder Partner ist - nicht jede Firma mit Postkarten-Freigabe. Dazu
  "Partner werden" und "Partner-Login".
- /partner/werden: Art (Gastronomie/Betrieb/Verein), Name, Firmenbezeichnung, Anschrift (wird mit
  Nominatim verortet - daran erkennt der Standort den Partner), Webseite, Kueche (Flagge), Logo
  (Pflicht; weisser Grund wird vom Rand her freigestellt, logoAufbereiten), E-Mail, Freigabe-
  Haekchen (Wortlaut ERKLAERUNG in partner.js). Status "bestaetigen", der Anmelde-Link (3 Tage)
  geht an die E-Mail. ERST der Klick macht den Shop live (Status "aktiv"). Ein Name, den die
  Markensperre kennt, geht auf "pruefen" und NICHT live (gemessen: "Adidas Shop" -> MARKE ADIDAS).
- /partner/bereich (Login per Mail-Link, derselbe wie im Konto): Name, Hausfarbe, Webseite,
  Gastro/Sterne, Kueche, Logo neu hochladen, Angebot (Postkarte, Gutschein, Teile), bis zu drei
  Stile, Links zu Shop, QR-Code, Tischaufsteller. Nach Logo/Bestaetigung baut der Server die
  Logo-Bilder fuer den Shop (storage/partner/bilder/<slug>-<teil>.jpg).
- DER EINFACHE WEG /bei/<slug>/machen: EIN Bildschirm - Foto (bei der Postkarte Pflicht), Gruss
  bzw. "Was soll drauf?", Artikel (nur das Angebot), helles/dunkles Shirt, Stil (nur die 2-3 des
  Partners), Sterne bei Gastro. Logo kommt automatisch und exakt (fr_<slug>.png, logoArt exakt).
  Postkarte = Motto gruesse-aus mit Ort, Punkt und Absender des Partners; Artikel = Motto haus.
  Die Seite wartet SELBST (Uhr, Status-Abfrage); erst wenn das Motiv fertig ist, geht es zur
  Mottoseite, die den Auftrag ueber mo_lauf aufnimmt und Ergebnis, Artikel und Kauf zeigt - es
  gibt nur EINEN Kaufweg. Scheitert der Lauf, bleibt der Gast auf der einfachen Seite.
- Das Ergebnis eines Motivs mit Partner-Logo zeigt nur die Teile aus dem Angebot (/api/mo/job).
- Das Tor /bei/<slug>: Tueren Postkarte und Textil fuehren in den einfachen Weg, Gutschein bleibt;
  Tueren und Shop richten sich nach dem Angebot; Kopfzeile nach Art ("Dein Verein, zum
  Mitnehmen." / "Dein Abend hier" / "Dein Besuch hier"). Die Tasse ist aus dem Shop raus, weil sie
  im Freestyle-Katalog nicht verkaufsfaehig ist (Chat-1-Befund vom 1. Okt.).
- SHOP NUR MIT ZUSTIMMUNG (shopErlaubt): selbst angemeldet, im Partnerbereich, Tisch-Tor (Markus'
  Wort, EAST26, Luigi) oder Artikel-Lizenz. Ball-z, C.C.E., DTF Express, DTF Factory, Elbdeich
  haben eine Logo-Freigabe fuer die POSTKARTE - das deckt keinen Verkauf von Shirts.
- Motto haus: kein "Haus" mehr in Kopf, Text und Logo-Feld (HAUS_REV 4 = seed.json rev 4).
- MOTTOSEITE (gemeinsam, eine Zeile): ein schon FERTIGER Auftrag lag beim Oeffnen hinter Schritt 1
  der Abfolge (laufAufnehmen ohne zumWartescreen). Betraf auch jeden Kunden, der nach dem
  Fertigwerden neu laedt. Jetzt zumWartescreen() vor laufTakt().
- Backend: GET /api/admin/partner (alle, auch unbestaetigte), POST /api/admin/partner/<slug>
  {"email"} gibt einem Repo-Partner (EAST26, Luigi) einen Zugang und schickt den Link,
  {"status":"aktiv"|"aus"|"pruefen"} schaltet; POST /api/admin/partner/<slug>/bilder baut die
  Shop-Bilder neu.
GEMESSEN (lokal, Ersatz-Bilddienst, iPhone-Breite): Anmeldung TSV Harmstorf (Logo JPG auf Weiss ->
483x220 freigestellt, verortet 53.3487/9.9870, Farbe #1D6B39), Link -> "Dein Shop ist online",
Angebot und Stile gespeichert, Shop zeigt 5 Teile, einfacher Weg -> Warten -> Ergebnis mit dem
Logo exakt auf dem Shirt, Teile nur aus dem Angebot. NICHT gemessen: ein echter Bildlauf, eine
echte Mail (Brevo), der Gutschein eines selbst angemeldeten Partners (braucht Stripe-Konto).
PARTNER- UND LIZENZVEREINBARUNG (Markus, 2. Okt.: "Die Lizenzvereinbarung koennen wir doch, wenn
jemand Partner werden will, mit anhaengen - die soll er einmal bestaetigen."): Text in
partner-vereinbarung.html unter /partner/vereinbarung (Betreiber aus dem Impressum, Fassung und
Stand aus partner.js VEREINBARUNG). Bei "Partner werden" Pflicht-Haken; ohne ihn keine Anmeldung.
Wer bestaetigt, bekommt die Standard-Lizenz LIZENZ_STANDARD (20 % vom Netto auf Artikel und
gedruckte Postkarte, nicht auf Gutscheine) im Eintrag - lizenzen.js zahlt sie wie bei EAST26 aus.
Bestehende Partner (EAST26, Luigi) sehen im Partnerbereich "Bestaetigen"; eine Lizenz aus dem Repo
bleibt. Neue Fassung = VEREINBARUNG.fassung hochzaehlen, dann muss jeder neu bestaetigen.
DER TEXT IST MEIN ENTWURF, nicht von einem Anwalt. Drei Saetze darin sind Geschaeftsentscheidungen,
die Markus bestaetigen muss: (1) keine Gebuehren fuer den Partner ausser 5 % auf Gutscheine,
(2) Erstattung = Lizenz wird mit spaeteren Auszahlungen verrechnet - das macht lizenzen.js NICHT
automatisch, (3) Kuendigung jederzeit ohne Frist.
DESIGN-SERVICE (Markus, 2. Okt.: "Ich wuerde noch eine Design-Gebuehr einrichten: wenn der Kunde das
nicht selber hinbekommt, dass wir fuer 99 Euro ihm alle Wunsch-Designs fertig machen."): im
Partnerbereich "Lieber machen lassen?" mit Wunsch-Feld und "Fuer 99 Euro beauftragen". Mit
STRIPE_SECRET_KEY: Stripe Checkout als Einmalzahlung an UNS (billing.js einmalCheckout, kein
Connect), Rueckkehr nach /partner/bereich?designservice=<Sitzung>, dort nachgeschlagen -> Status
"bezahlt" und Mail an uns (ADMIN_EMAIL, sonst Impressum-Mail) mit dem Wunsch. Ohne Schluessel:
Status "angefragt", Mail an uns, Rechnung von Hand. Erledigt: POST /api/admin/partner/<slug>
{"designService":"erledigt"}. Im Vertrag Nummer 8 (Preis aus partner.js DESIGN_SERVICE).
ANNAHMEN, die Markus bestaetigen muss: 99 Euro sind brutto (inkl. MwSt.), und "alle Wunsch-
Designs" ist ohne Obergrenze formuliert.
MENUE (Markus, 2. Okt.: "Ich moechte, dass du das machst"): "Partner" steht jetzt auf allen Seiten
hinter "Firmen" - home-neu.html, home.html, motto.html, konto.html, firma.html, rechtliches.js
(Chat 1/3-Gebiet, auf sein Wort, je eine Zeile); abnahme-browser.mjs erwartet /partner im Menue.
NETTO FUER FIRMEN (Markus, 2. Okt.: "Fuer Firmen ist der Preis natuerlich netto zuzueglich der
Mehrwertsteuer" - "Die 5 % Gebuehren auf den Gutschein sind natuerlich auch zusaetzlich
Mehrwertsteuer"): Design-Service 99 Euro netto, bezahlt 117,81 Euro (DESIGN_SERVICE.cents);
Gutschein-Provision 5 % netto + 19 % (gutscheine.provisionCents: 50 Euro -> 2,98 Euro,
provisionNettoCents 2,50 Euro). Vertrag, Partnerbereich und Anmeldung nennen "zzgl. MwSt.".
Die Lizenz an den Partner (20 % vom Netto) ist davon nicht beruehrt.
OFFEN: Lizenz fuer selbst angemeldete Partner (heute keine); Partnerbedingungen/AGB
fuer die Freigabe (Text fuer Markus).

## Kissen zu 100 % (Markus, 2. Okt., Design MO-HAUS-20261002-DSK6 von EAST26)

"Wenn wir schon antippen, ein Design fuer ein Kissen zu machen, dann sollte es zu 100 % passen."
Gemessen: Druckdatei 2877 x 2877 (40,6 x 40,6 cm) - richtig. Die Flaeche im Kissenfoto ist aber
475 x 430 (gepolstert, leicht von vorn oben), 10 % breiter als hoch; ab 6 % Abweichung legte
makeMockup das Motiv eingepasst hinein und fuellte die Seiten mit der Randfarbe (braune Streifen).
Jetzt (mockups.js, Chat-1-Gebiet, auf Markus' Wort): ist die Datei fuer DIESES Teil gebaut und
stimmt ihr Verhaeltnis mit dem ECHTEN Mass (bestellt, sonst flaecheCm, 3 %), fuellt sie die Flaeche
im Foto ganz ('fill'). Gilt fuer jede Flachware mit eigenem Design (Poster, Strandtuch ...).
ALLE ARTIKEL (Markus: "Das muss natuerlich fuer alle Artikel gelten, die wir anbieten"): gemessen mit
werkzeug/alle-artikel-messen.mjs - jeder verkaeufliche vollflaechige Artikel in jeder Groesse (31),
vorn und Szene, mit einem Probemotiv im echten Mass samt Rand: ueberall das ganze Motiv bis an die
Kante, nichts beschnitten, nichts aufgefuellt. Die Abnahme prueft je Artikel eine Groesse an der
Box-Kante (ausser Mousepad, Fussmatte, Napfunterlage, Brotdose: deren Box ist groesser als die
sichtbare Flaeche, dort nur im Bild geprueft). Textilien (freistehend) und die Postkarte (keine
Produktansicht) betrifft das nicht; die Tasse ist derzeit nicht verkaeuflich.
Nebenbefund im Log, nicht angefasst: "Druckdatei mit Maengeln ... nur 29.7 % volle Deckung - das
druckt milchig" - das Haus-Motto laeuft im Alpha-Weg (Grund-Modus alpha); fuer ein vollflaechiges
Kissen gehoert die Datei deckend. Erst ansehen, wenn ein gedrucktes Kissen milchig kommt.

## Vorzeigen: der Vorsprung (Markus, 22. Sept., 11:40)
"Alle anderen Hersteller sind nicht in der Lage, ein Design zu erzeugen, das fuer den jeweiligen
Artikel ist - wir koennen jeden Artikel, auch die Brotdose, vollflaechig bespielen. Wir haben einen
enormen Vorsprung vom kompletten Markt." Daraus folgt fuer alles, was wir zeigen:
- Je Artikel ein EIGENES Design in seinem Mass (nie ein Shirt-Design draufgesetzt), vollflaechig,
  wo der Artikel es hergibt (Tasse: Rundumdruck 20 x 8,9 cm; Poster: bis an den Rahmen; Brett,
  Matte, Decke, Tuch: Kante zu Kante). Nur echte Freisteller (Sticker, Shirt) bleiben freistehend.
- Jeder Artikel in seiner echten Umgebung "mit allen Dingen, die dazugehoeren" (Tasse auf dem
  Fruehstueckstisch, Sticker auf der Brotdose, Brett in der Kueche, Poster gerahmt im Zimmer) -
  vorher im Netz nachsehen, wie das Produkt bei CEWE, Vistaprint, Personello, Bloomingwood,
  Jabalou, dm/ifolor aussieht, und den Druck der Form folgen lassen (Rundung, Falten, Licht).
- Motiv passend zum Artikel (ARTIKEL_MOTTOS in mockups.js) und im Format des Artikels
  (artikelQuer im Pool, formatPasst in server.js).
- Neue Vorlage = Foto (weiss, unbedruckt) + Magenta-Fassung (edit) + Maske (Skripte in werkzeug/:
  maske-weiss.mjs, maske-magenta.mjs, maske-viereck.mjs, tasse-messen.mjs) +
  MITGELIEFERT/MASKEN mit hoeherem Stand + MOCKUP_STAND fuer den Artikel.
- Weiss und Schwarz sind oft ZWEI verschiedene Fotos (Beutel: Korpus 531 px gegen 445 px breit).
  Dann je Farbe eine eigene Flaeche (BOX_OVERRIDES <key>_white/_black) - eine gemeinsame Box sass
  beim Beutel auf Weiss 38 px rechts, auf Schwarz fast am Rand (2. Okt., Stand 93,
  werkzeug/beutel-korpus.mjs misst, werkzeug/beutel-messen.mjs rendert).

## Firmenkarten: Farben und fremde Marken (Markus, 22. Sept.)

**Die Hausfarbe kommt aus dem Logo - aber nicht nach Flaeche.** Gemessen am DTF-Logo: Schwarz
73,9 Prozent, die bunten Teile je 2 bis 7 Prozent. Wer nach Flaeche sortiert, erklaert Schwarz
zur Hausfarbe und wirft das Gruen raus. `hausfarben()` in firmen-freigabe.js macht es richtig:
ein fast unbunter Ton fuehrt nie, und wenn ein Logo aus vielen gleich grossen bunten Teilen
besteht (groesste Farbe unter 10 Prozent), entscheidet die Webseite - `seitenFarben()` liest die
Hex-Werte aus dem Quelltext, genommen wird nur, was auch im Logo vorkommt. Markus: "Du sollst dir
die Farben aus dem Logo ziehen. Ich glaube, auf der Seite ist ganz schoen viel gruen, oder?"
Nachgesehen: dtf-express.de ist durchgehend Limegruen auf Schwarz, #95C11F steht achtmal im
Quelltext, in den Aufmacherbildern gemessen rgb(210,235,45) und rgb(247,231,24).
Stand: Ball-z #45E916 · C.C.E. #ECA207 · DTF Express #95C11F.

**Fremde Marken auf Fotos der Firmenseite sind in Ordnung.** Auf dem C.C.E.-Foto steht ein Trikot
mit ING DiBa und Spalding. Markus: "Wenn du auf einer Homepage von einer Firma, die freigegeben
ist, irgendwo was findest, wo was anderes drauf ist, so hat diese Firma das auch im Netz, also
darf sie das machen. Es kommt ja eh nur zum Tragen, wenn die Firma eine Einverstaendniserklaerung
gegeben hat, und dann schreiben wir das in die AGB mit rein." Also kein Filter dagegen. Das
Verbot fremder Marken im Auftrag gilt weiter fuer alles, was die Bild-KI sich AUSDENKT.

## Wovon die Karte handelt: Privatadresse, Firma, Sehenswuerdigkeit (Markus, 26. Sept.)

ANLASS: Markus stand in Jesteburg, Im Lohmoor - eine Wohnstrasse. Die Karte zeigte einen
Kircheninnenraum, einen Holzbau, eine gemalte Burg und die Ortskarte. Alles Motive aus dem Ort,
und keines hatte mit ihm zu tun.
Nachgestellt am 26. Sept. an der Live-Antwort (53.31896 / 9.96535, Genauigkeit 20 m):
  sehenswuerdigkeit: false · Standorte: [{art:'strasse', text:'Im Lohmoor', 98 m}]
  umgebung: ["Kunststaette Bossard"]
Genau da kommt es her: An einer Wohnstrasse fuellt der Server die Karte weiter mit den
Sehenswuerdigkeiten des DORFES (umgebung -> vorlagenFuer). Er hat nichts falsch gerechnet - es
war nie gesagt, dass eine Privatadresse etwas anderes ist als ein Ortsmittelpunkt.

SEINE WORTE: "Wenn wir durch den Standort erkennen, dass jemand an einer Privatadresse ist,
sollte es die Moeglichkeit geben, bis zu fuenf Fotos hochzuladen, und es wird aus den Fotos was
gebaut. Baut er nur ein Foto ein, heisst es nur das Foto natuerlich und den Ort, die Koordinaten,
das Datum und die Karte. Baut er mehrere Fotos ein, wird das genauso uebernommen. Das sollten wir
auch bei der Firma machen, und wenn wir erkennen, dass jemand an Sehenswuerdigkeiten ist, dann
brauchen wir die Auswahl."

DREI FAELLE, und der Standort entscheidet, welcher gilt:
1. **PRIVAT** - der gewaehlte Standort-Knopf ist `adresse` oder `strasse` (standorteBauen in
   nachbarschaft.js) und in der Suchweite liegt KEINE Sehenswuerdigkeit.
   - Bis zu FUENF eigene Fotos; das Selfie ist Foto 1.
   - Die Karte besteht NUR aus diesen Fotos plus Ortsname, Koordinaten, Datum und Strassenkarte.
   - KEINE Wikipedia-Sehenswuerdigkeiten, KEINE Ortsgeschichte, KEINE Vorlagen aus vorlagenFuer,
     keine gemalte Burg.
   - Ein Foto = ein Bildfeld. Mehrere Fotos = je Foto ein Feld, alle uebernommen, keins erfunden.
2. **FIRMA** - der gewaehlte Absender ist eine Firma. Ebenfalls bis zu fuenf eigene Fotos.
   Logo-Freigabe und fester Rahmen der Firma gelten unveraendert weiter.
   ENTSCHIEDEN (Markus, 26. Sept., auf genau diese Frage): "Bei der Firma bitte nur mindestens
   ein Foto von der Homepage, ansonsten auch die Auswahl, mehrere Fotos hochzuladen." Also
   faellt das Material der Firma NICHT weg: mindestens EIN Foto von ihrer Seite bleibt immer auf
   der Karte, und die eigenen Fotos des Kunden kommen dazu.
3. **SEHENSWUERDIGKEIT** - der gewaehlte Standort ist eine (`art: 'sehenswuerdigkeit'`). Dann
   bekommt der Kunde die WAHL: die Sehenswuerdigkeits-Karte wie bisher, oder eine Karte aus
   seinen eigenen Fotos wie in Fall 1.
4. **GESCHAEFT** (27. Sept., Markus zur Karte KWH3 aus Buchholz-Dibbersen, auf der Moebel Kraft
   und eine Maschine standen: "Ich habe bei dem Foto Baeckerei Weiss angetippt!!!") - der
   angetippte Standort ist ein benanntes Geschaeft (`art: 'firma'` in der Liste), aber NICHT der
   gewaehlte Absender (values.firma leer). Im Log von gestern stand der Grund: "Vorlagen (am
   Punkt): Buchholz Moebel Kraft 05 (325 m) · Emissions Reduzierungs Concept (341 m)" - Commons-
   Fotos aus dem Umkreis, weil ein Geschaeft nicht als privat galt (istPrivat sagt bei art firma
   bewusst nein). Markus dazu, als ich es "privat" nannte: "Ich habe ein Geschaeft rausgesucht,
   bestaetigt - waere dann nicht die Abfolge, auf die Homepage zu gehen, zu gucken, was die
   macht, und dann auch nur Dinge von diesem Geschaeft zu nehmen und kein erfundenes Motiv von
   einem Moebelhaus." Also: keine Vorlagen aus der Nachbarschaft, keine Geschichte, und die Seite
   des Geschaefts wird GELESEN (OpenStreetMap kennt sie: website / contact:website - gemessen
   an 53.3517/9.8637: Baeckerei Weiss -> baecker-weiss.de, famila, MediaMarkt). geschaeftText()
   (logo-holen.js) holt den sichtbaren Seitentext, das Textmodell (GESCHAEFT_LESEN, QA_MODEL)
   macht daraus einen Satz und bis zu sechs zeichenbare Dinge; faellt es aus, firmaAusSeite wie
   bei der Firmenkarte (die allein gab bei baecker-weiss.de nur "Moderner Baecker mit Tradition
   seit 1908" und das Stichwort "Sohn" - gemessen, deshalb das Modell). Der Auftrag bekommt
   geschaeft {name, was, stichworte}: "THE PLACE THE TRAVELLER CHOSE IS A BUSINESS ... NOTHING OF
   ANY OTHER BUSINESS ... no logo, no lettering of the business name, no shop front" - die Dinge,
   nie die Marke (Rechte: Logo und Name gehoeren dem Geschaeft, ein Brotkorb nicht). Das Wort
   "privat" im Code ist nur der Name des Rezepts "eigene Fotos + Ort + Karte"; im Log heisst die
   Karte GESCHAEFT.
   GEMESSEN am 28. Sept. am Bilddienst (werkzeug/geschaeft-probe.mjs, Auftrag woertlich wie der
   Server, Beschreibung und Dinge von Hand aus dem gemessenen Seitentext, Aquarell, A6 quer,
   Testselfie mit Fachwerkhaus im Hintergrund), Markus: "Mache einen Durchlauf mit Baeckerei
   Weiss, famila und MediaMarkt":
   - Baeckerei Weiss: Butterkuchen (Seitenbild), Broetchen, Brezeln, Kaffee, Karte mit Kartusche,
     Flaggenrand; kein Moebelhaus, kein Logo. Das Fachwerkhaus auf der Karte ist das aus dem
     SELFIE-Hintergrund ("taken AT this place ... surroundings STAY"), NICHT das 1908er Haus vom
     Seitenbild - ich hatte es Markus erst falsch zugeordnet, dann berichtigt. Das zweite
     Seitenbild (Haus 1908) wurde nicht als eigenes Feld gemalt.
   - famila: Gemuese, Kaese, Fisch, Brot, Einkaufswagen - und ein FREMDER KUNDE mit Handy aus dem
     Newsletter-Bild der Seite. Deshalb im Auftrag: "NO PERSON from them is drawn".
   - MediaMarkt: Fernseher, Laptop, Handy, Kopfhoerer, Waschmaschine - und rote App-Symbole aus
     dem myMediaMarkt-Werbebild nachgemalt (Marke durch die Hintertuer). Deshalb: aus einem Bild,
     das vor allem Logo, App-Schirm, Symbole oder Schrift ist, nur die ART der Waren, keine Grafik.
   Beide Saetze sind im Auftrag, NICHT erneut am Bilddienst gemessen.
   DER RAHMEN (Markus, 28. Sept.: "Bei einer Firma traegt nicht der Rahmen des Ortes, sondern
   der Rahmen in Firmenfarben"): die Farben kommen wie bei der Firmenkarte aus dem LOGO auf der
   Seite (logoVonWebseite + dominantColors + hausfarben). GEMESSEN: Baeckerei Weiss #F58000,
   famila #E2031A, MediaMarkt #E00B0B - alle drei stimmen. Aus dem Stylesheet allein (seitenFarben)
   kaeme Unsinn: bei baecker-weiss.de die Standardpalette von WordPress (#ff6900, #cf2e2e,
   #fcb900 ...), bei famila Tailwind-Blau. Das Logo selbst kommt NICHT auf die Karte, nur seine
   Farbe; findet der Leser keins, bleibt der Rahmen des Ortes (Flagge/Wappen). Die drei
   Probekarten oben liefen noch mit dem Flaggenrand.
   DER HINTERGRUND DES SELFIES (Markus, 28. Sept.: "bei einem Selfie, wo der Hintergrund zum Ort
   passt oder zum Innenraum, wird der Hintergrund mitgenommen; ist es so fotografiert, dass man
   gar nichts erkennen kann, dann wird der Hintergrund aus den Bildern der Homepage gemacht"):
   genau so laeuft es (hintergrundNutzbar -> "surroundings STAY" bzw. "take ONLY the people",
   dann fuellen die Seitenbilder). Das Fachwerkhaus auf allen drei Probekarten ist der Hintergrund
   des TESTSELFIES - Markus: "das Haus ist definitiv nicht das Baecker-Haus". Richtig.
   "JEDE KARTE SIEHT EIGENTLICH IMMER GENAU GLEICH AUS" (Markus, 28. Sept., zu den drei Probekarten
   und den Harmstorf-Karten): stimmte. Drei Gruende: (1) im Gestaltungsabsatz stand fest "the
   person is the largest thing by far" - Mensch links gross, Kopfzeile oben, Felder rechts, Karte
   unten rechts, jedes Mal; (2) alle drei Proben liefen mit demselben Stil (Aquarell), demselben
   Testselfie und demselben Flaggenrand; (3) live waehlt der Kunde den Stil, aber der Bauplan war
   trotzdem einer. Jetzt: KOMPOSITIONEN (firmen-flyer.js, acht Bauplaene: Mensch links gross,
   Karte als Grund, die Dinge tragen, Kopfzeile als Plakat, eine Szene, Vignette, zwei Haelften,
   Karte gross links); komposition(seed) zieht einen fest an der Auftragsnummer (zweiter Versuch =
   derselbe Plan, vergleichbar), der Auftrag sagt "THIS CARD IS ARRANGED LIKE THIS, and no other
   way", das Log "Komposition: <nr> <name>". Gilt fuer Orts- UND Firmenkarte. Die Regeln darunter
   (Ueberlappen, kein Raster, Tiefe, Leere) bleiben fuer alle.
   GEMESSEN am 28. Sept. am Bilddienst (Markus: "Zeige mir hier bitte Beispiele" - "famila und
   MediaMarkt"; werkzeug/geschaeft-probe.mjs mit Seed mo_c bzw. mo_g, Aquarell, Testselfie):
   - famila, Bauplan 6 "Zwei Haelften": Mensch links in voller Hoehe, rechts Gemuese, Fischtheke,
     Kaese und Einkaufswagen, Karte klein an der Naht, Kopfzeile ueber beide Haelften - genau so
     bestellt. Rand gemessen #e2051b (bestellt #E2031A). Kein fremder Kunde mehr, kein Logo.
   - MediaMarkt, Bauplan 2 "Die Dinge tragen": Ladenszene mit Fernseher, Laptop, Handy,
     Kopfhoerer, Box und Waschmaschinen oben, der Mensch klein unten rechts mit Rissrand, Kopfzeile
     schraeg oben links, Karte unten links. Rand gemessen #dd0102 (bestellt #E00B0B). Keine
     App-Symbole mehr; auf der Box ein kleines Zeichen, das ein Markenlogo sein koennte.
   Die beiden Karten sehen zum ersten Mal verschieden aus. Beide Male: "B 75" von der Ortskarte
   abgeschrieben (der Auftrag sagt "no copied map lettering") und das Fachwerkhaus ist der
   Hintergrund des Testselfies. Baeckerei mit Bauplan 5 "Vignette" nicht gezogen (Markus wollte
   famila und MediaMarkt).
   MARKUS DAZU: "Die Supermarkt-Karte sieht genauso aus wie MediaMarkt und ist auch rot. Wir
   muessen es schaffen, dass jede Postkarte ein bisschen anders aussieht." Gemessen, was trotz
   Bauplan gleich blieb: rote Pinselschrift auf weissem Rissband, Rissraender an allen Feldern,
   Mittagslicht, rote Nadel auf beiger Karte, "B 75". Der Bauplan ordnet nur an - alles andere
   war dem Modell freigestellt, und frei gestellt waehlt es jedes Mal dasselbe. Jetzt zieht
   gestaltung(seed) in firmen-flyer.js VIER weitere Dinge fest an der Auftragsnummer, jedes mit
   eigenem Salz: HANDSCHRIFTEN (8: Pinselschrift, Blockbuchstaben, Federzug, Kreide, Stempel,
   Serifen, Schild, Banderole), ZIERDEN (8, nur eine davon ist der Rissrand, die anderen sagen
   "no torn paper"), LICHTER (6: Mittag, goldener Abend, Morgen, nach dem Regen, Hochsommer,
   blaue Stunde), MARKEN (6: Nadel, Herz, Ring, Kreuz, Stern, Faehnchen). Log und Auftrag:
   job.gestaltung = "Bauplan · Schrift · Zier · Licht · Marke". Die Firmenfarbe bleibt, was sie
   ist - zwei rote Firmen geben zwei rote Raender, der Unterschied kommt aus allem anderen.
   GEMESSEN am 28. Sept. (KI-Testfotos einer Frau, Aquarell): famila (Zwei Haelften · Banderole ·
   Ecken · Mittag · Ring) und MediaMarkt (Die Dinge tragen · Kreide · Spritzer · Hochsommer ·
   Nadel) - Banderole vs. Kreideschrift, Eckornamente vs. rosa Farbwaesche, Ring vs. Nadel, kein
   "B 75" mehr. Raender #ee0d1d / #e70203. OFFEN: auf der MediaMarkt-Karte ein Windows-artiges
   Logo auf dem Laptop und ein Herstellerzeichen auf der Box (aus den Produktfotos der Seite) -
   dagegen steht jetzt "THE GOODS CARRY NO MAKER'S MARK EITHER" im Auftrag, NICHT erneut gemessen.
   DER TEST MIT ZWEI SELFIES (Markus, 28. Sept.: "ein Foto mit einer Person in einem Cafe mit
   Standort Baeckerei Weiss, ebenso ein Foto, wo der Hintergrund nicht zu erkennen ist ... ist zu
   sehen, dass die Person in der Baeckerei ist, nehmen wir den Hintergrund mit; erkennen wir
   keinen Hintergrund, wird die Person reingesetzt; der Rahmen immer in der Farbe des
   Unternehmens"): beide mit derselben Nummer mo_a (Eine Szene · Serifen · Rissrand · Morgen ·
   Stern), hintergrund von Hand gesetzt (das Textmodell fehlt hier). Cafe-Selfie: Theke, Regale,
   Tafel, Croissant und Cappuccino bleiben, die fremden Gaeste sind weg, dazu das 1908er Haus und
   der Butterkuchen von der Seite. Wand-Selfie: die Frau sitzt IN der Baeckerei aus den
   Seitenbildern (Brotregal, Brezeln, Kuchen) - dafuer sagt der Auftrag bei Geschaeft und
   !hintergrund jetzt "SET THEM INTO THIS BUSINESS AS ITS OWN WEBSITE PICTURES SHOW IT" statt
   "build everything around them from ... the empty space". Raender #fd7f01 / #fe7e02 bei
   bestelltem #F58000. Beide Karten gleich gebaut (gleiche Nummer), nur der Hintergrund anders -
   genau das war der Test.
   DER RAHMEN AUS DEN DINGEN DES GESCHAEFTS (Markus, 28. Sept.: "wenn zum Beispiel eine Baeckerei
   erkannt wird, dass der Rahmen aus Brezeln, Kuchen ein bisschen cool und stylisch ist, bei
   MediaMarkt aus Elektronikartikeln, bei der Apotheke, was dazu passt, und so weiter"): der
   Rahmen bleibt in der Firmenfarbe (Grund) und traegt darauf die Stichworte des Geschaefts
   ("THE BAND IS THE SHOP WINDOW OF THIS BUSINESS"); WIE er sie traegt, zieht RANDMUSTER an der
   Nummer (Girlande, Linienmuster, Scherenschnitt, Gestreut). Nur mit Firmenfarbe - ohne Logo
   auf der Seite traegt der Ort den Rand (Flagge/Wappen), und da haben Brezeln nichts zu suchen.
   Die Firmenkarte (DTF: "komplett in diesem Limegruen") bleibt ruhig. Das Fahrzeug-/Blumen-Motiv
   im Rand (themaImRand) tritt beim Geschaeft zurueck. GEMESSEN am 28. Sept.: Baeckerei = weisse
   Linienzeichnungen (Brot, Broetchen, Kuchen, Tasse, Schieber, Brezel) auf Orange #fc8313,
   MediaMarkt = gestreute Geraete (Waschmaschine, Fernseher, Kopfhoerer, Laptop, Handy) auf Rot
   #d91e22, beide rundum geschlossen, nichts ragt in die Karte; kein Herstellerzeichen mehr auf
   den Geraeten (Schirme zeigen Landschaften). Die Baeckerei-Karte hielt sich nicht ganz an
   "Eine Szene" (die Karte kam als Feld statt als Poststempel) - der Bauplan ist eine Bestellung,
   keine Garantie.
   NUR WEISS (Markus, 28. Sept., zu den bunten Geraeten im MediaMarkt-Rand): "Aber ich wuerde die
   ganzen Zeichnungen von den Elementen immer nur in Weiss machen - es sei denn, der Rahmen ist
   weiss vorgegeben, was aeusserst selten der Fall ist." Also alle Dinge im Rand in EINER Farbe:
   Weiss auf der Firmenfarbe ("DRAWN IN PURE WHITE AND NOTHING ELSE"); ist die Firmenfarbe selbst
   hell (randTinte, Helligkeit ueber 0,8), die zweite Firmenfarbe oder Schwarz. Die vier Muster
   unterscheiden sich nur noch darin, wie die weissen Dinge liegen. GEMESSEN (MediaMarkt, mo_g,
   Gestreut): weisse Zeichen von Fernseher, Laptop, Handy, Kopfhoerer und Waschmaschine auf Rot
   #e71714, rundum, nichts Buntes mehr im Rand.
   DAS ORIGINAL-LOGO AUF DER KARTE (Markus, 28. Sept.: "Zieh dir das Original-Logo von der Seite
   von Baeckerei Weiss, famila und MediaMarkt, so dass ich dort hingehen kann"): das Logo, das
   logoVonWebseite ohnehin fuer die Farben holt, geht jetzt als Vorlage mit - Bild 2, an der
   Stelle des Wappens (eine Karte hat EINEN Absender; mit Geschaeftslogo kein Wappen daneben,
   wappenGezeichnet dann false). Es liegt eine Stunde im Speicher (GESCHAEFT_LOGOS, nie auf der
   Platte) und wird unter /api/mo/geschaeftlogo/<jobId>.png ausgeliefert, weil der Bildplan
   eine Adresse braucht. Im Auftrag: "IMAGE 2 IS THE ORIGINAL LOGO OF <NAME>, the business the
   traveller is at" mit denselben Saetzen wie das Firmenlogo (unveraendert, genau einmal, die
   Karte darum gebaut), und "ITS BRAND APPEARS EXACTLY ONCE, as the supplied logo" statt "never
   its brand". GEMESSEN am 28. Sept. (Probe: Logos als kleine RGB-PNGs per reference_images_base64,
   die der Bilddienst HINTER den Adressen einreiht - Paletten-PNGs lehnt die Bildschnittstelle ab):
   Baeckerei "weiss." mit Aehre oben rechts (#fc8721), famila oben rechts (#f32c33), MediaMarkt
   (#e10e18) - alle drei unveraendert und einmal. ZWEI BEFUNDE: (1) die MediaMarkt-Filialseite
   liefert als Logo das kombinierte MediaMarkt-SATURN-Zeichen (MMS_Logo_outline.svg), ein reines
   MediaMarkt-Logo gibt die Seite nicht her - so steht es auf der Karte; (2) famila-Logo: die
   weisse Zeile "besser als gut!" ist beim Flachlegen auf Weiss fuer die Probe verschwunden (mein
   Fehler; live geht das PNG mit Transparenz). Die Logos der drei Seiten sind SVG; logoVonWebseite
   rendert sie zu PNG.
   WEITER DURCHGESPIELT (Markus, 28. Sept.: "Such dir mal irgendwo einen Maler raus, eine
   Apotheke und so weiter"): aus der OSM-Karten-API fuer den Buchholzer Stadtkern (Overpass und
   seine Spiegel waren an dem Tag nicht zu erreichen - Connection reset, Timeouts; die
   Karten-API /api/0.6/map.json lieferte 11 MB und alle Geschaefte mit Webseite: fuenf
   Apotheken, drei Optiker, zwei Friseure, eine Schlachterei - KEIN Maler mit Webseite; Nominatim
   kennt "Maler Team Buchholz" und "Juergen Neumann", beide ohne Seite).
   - Heide-Apotheke (heide-apotheke-buchholz.de, apocdn-Plattform): Logo webp 162x56 als
     Adresse, Farben #FD76A2 #53B150 #325932, zwei Seitenbilder (eines davon ein Plattform-Bild
     "recipe" - nicht die Apotheke selbst). GEMESSEN mit Testselfie in einer Apotheke: Hygieia-
     Schale, Moerser, Cremes, Blutroehrchen, das gruene Kreuz aus dem Selfie-Hintergrund, Logo
     oben rechts, weisse Apothekendinge auf Rosa #fc80a5, Faehnchen auf der Karte. Sehr gut.
   - Landschlachterei Wiese (landschlachterei-wiese.de): Logo PNG 250x250 als Adresse, Farben
     #D27488 #0099E7 #6B4049; ein Seitenbild kommt nur als http:// (fuer den Bilddienst auf
     https gesetzt, gleicher Host). GEMESSEN mit Wand-Selfie (ohne Hintergrund): die Frau steht
     hinter der Fleischtheke, Wuerste, Steaks, Beil, Logo rechts, Karte gross links mit Kreuz,
     Briefmarke, weisse Silhouetten auf Rosa #ee8b9c. BEFUND: das Modell hat ihr eine rote
     SCHUERZE angezogen - "EXACTLY the clothes from the photo" verloren gegen "set them into the
     business". Nicht behoben; wenn das wieder vorkommt, gehoert ein Satz in den
     Hintergrund-Absatz ("they keep their own clothes, they do not become staff").
   - Maler: painter FEHLTE in GATTUNG (nachbarschaft.js) - ohne Webseite haette die Karte nichts
     vom Handwerk gehabt. Jetzt painter, electrician, plumber, carpenter, roofer, gardener dazu.
     Ohne Seite: Gattung, Flaggenrand, kein Logo. GEMESSEN (Wand-Selfie, mo_e, Mensch links
     gross · Blockbuchstaben): Rolle, Farbeimer, Pinsel, Leiter an frisch gestrichener Wand als
     Feld rechts, Karte mit Stern, Flaggenrand Schwarz-Rot-Gold (aussen #1b1b1a), kein Logo. Der
     Auftrag verbot "no landscape to fill the gap" - hinter der Frau steht trotzdem eine weiche
     Baumkulisse. Nicht behoben.
   KARTE 9JZG AUS "LA" (Markus, 28. Sept., 21:00: "Gab's in dem Bild irgendeinen Hinweis, wo das
   ist, oder wie kommen diese Platinen da drauf?" - "Wir haben keinen Standort mitgegeben, muss
   dann in der Bildinformation sein"). GEMESSEN am Auftrag (/api/admin/jobs) und im Railway-Log:
   values.ort = "LA" von Hand getippt, standort_koord LEER, standort_art leer - kein GPS, keine
   Adresse. Der Browser liest den Aufnahmeort aus dem EXIF des Originalfotos (standortAusFoto,
   exifGps) BEVOR es neu kodiert wird; in diesem Foto stand keiner (iPhone entfernt ihn beim
   Hochladen ueber den Browser, WhatsApp auch - die Seite sagt das dann im Ortsfeld). Der Ort
   auf der Karte kam also allein aus dem getippten "LA" und aus dem Selfie-Hintergrund
   ("Hintergrund im Selfie: nutzbar · Zapfsaeule und Lkw" - daher Zapfsaeule "76 E85" und der
   Pickup; Motiv "auto"). Wikipedia fuer "LA": kein Wappen, keine Vorlagen. Und dann:
   "Vorlagen (Openverse): LA -> La Gard Electronic Digital Lock Teardown (CC BY 2.0)" ZWEIMAL -
   das sind die Platinen: ortNamePasst liess "la" als eigenes Wort irgendwo im Titel gelten, und
   "La Gard" ist ein Schlosshersteller. BEHOBEN in standort.js: ein Name mit weniger als vier
   Buchstaben ist eine Abkuerzung und zaehlt nur genau so geschrieben (LA, nicht La), als Wort.
   Nebenbefund derselben Karte: "Druckdatei mit Maengeln: fast nichts ist frei (0 %), nur 72,4 %
   volle Deckung" - der Neon-Stil malt halbtransparent.
   DIE FRAGE "NUR DIESES FOTO ALS POSTKARTE?" (Markus, 28. Sept., zu 9JZG: "Hier war der Wunsch,
   nur das Foto als Postkarte zu verschicken, mit dem, was geschrieben ist. Wir sollten vorher
   noch mal abfragen: Moechtest du das hochgeladene Foto als Postkarten-Design? Wenn dort Ja
   gedrueckt wird, wird nur dieses eine Foto genutzt. Kein Standort, kein gar nichts, sondern nur
   schick gemacht in dem Design in der Groesse der Postkarte." Und: "passend zu LA natuerlich
   schon die Palmen nehmen und das so schreiben, nur halt keine Zusatzfotos dazu generieren.")
   GEBAUT: Feld nurfoto (wahl nein/ja, Vorgabe nein) als eigener Schritt "Nur dieses Foto?"
   direkt nach dem Selfie, vor "Wo bist du?" (GA_REV 23, 18 Felder, 7 Schritte). "Wo bist du?"
   bleibt - der getippte Ort ist die Zeile und die Stimmung. Bei Ja im Server (nurFoto): die
   Koordinaten bleiben liegen (keine Nachbarschaft, keine Karte, keine Koordinatenzeile), privat
   = true (keine Vorlagen aus Wikipedia/Openverse/Commons, keine Geschichte), kein Wappen, Rand
   aus dem Bild, keine weiteren eigenen Fotos, Kartenart "nurfoto" im Log; die Seite versteckt
   "+ Weitere Fotos" und die Sehenswuerdigkeits-Wahl. Im Auftrag (flyerPrompt nurFoto): "THIS
   CARD IS ONE PICTURE AND NOTHING ELSE ... NO SECOND PICTURE OF ANY KIND ... The place named in
   the text may colour the picture as ATMOSPHERE ONLY - palms if it is a palm place" und der
   Bauplan "ONE PICTURE FILLS THE CARD" statt eines der acht. GEMESSEN am Bilddienst (Supermarkt-
   Selfie, "Gruesse von LK aus LA!", Neon, hoch): ein Bild, Palmen und Neon-Sonne als Stimmung
   hinter dem Supermarkt, Gruss, "LA", Datum, kein zweites Bild, keine Karte. Die Browser-Abnahme
   geht den neuen Schritt mit (Vorgabe Nein, Weiter -> "Wo bist du?").
   Die Karten sind auf einer
   Artefakt-Seite gesammelt (Markus konnte die Dateikarten im Chat nicht antippen):
   https://claude.ai/artifact/U7DpSgXufdwGv14BdbtkbT
   Dazu (Markus, 28. Sept.: "Bei der Firmenkarte brauchen wir ein bis maximal
   zwei Bilder"): bis zu ZWEI echte Bilder von der Seite des Geschaefts (produktBilder, wie bei
   der Firmenkarte) gehen als Vorlage mit und stehen im Auftrag als "REAL PHOTOGRAPHS FROM THE
   WEBSITE OF <Name>" - gezeichnet, nie geklebt, nie ein Logo daraus. OFFEN: der Modell-Aufruf
   ist am Bilddienst nicht gemessen (kein Schluessel hier); das erste Live-Log "Geschaeft
   gelesen:" zeigt, was er liefert und wie viele Bilder die Seite hergab.

## EAST26, Santanyí - die erste Freigabe in Spanien (Markus, 29. Sept.)

"Das ist das erste Objekt in Spanien, was mitmachen moechte, dass das Logo freigegeben - und wenn
da vor Ort jemand eine Postkarte verschicken will, muss die Postkarte wirklich megageil sein."
EAST26 Restaurante, Carrer del Bisbe Verger 26, 07650 Santanyí (Mallorca), east26-restaurante.com.
Logo als PDF von ihm (Vektor, Gold rgb(153,114,9) = #997209 auf Weiss), freigestellt nach
postkarte/logos/east26.png (1025x1024, Alphakanal). Eintrag in postkarte/firmen-freigaben.json
mit allem, was der Server sonst von der Seite holen wuerde - denn er holt hier NICHTS: Punkt und
Logo liegen vor, der Start ueberspringt das Holen (und ein Holen von Hand ersetzte das Original
auf dem Volume durch ein Seitenbild - nicht tun). Also stehen Beschreibung (was), sechs Dinge
(stichworte), zwei Patio-Fotos in voller Groesse (produktbilder) und das Motiv (Teller im Patio)
im Eintrag, jeweils mit Quelle; der Server nimmt den Nachweis, wenn er da ist, sonst den Eintrag.
Gemessen: produktBilder() faende auf der Wix-Seite nur 147-Pixel-Vorschauen; OSM-Knoten 502313544
"East26" (restaurant, bar, cuisine international;regional;japanese) bei 39.3540 / 3.1269; die
Strasse heisst in OSM wie in der Anschrift. Kueche "mediterranean" -> keine Flagge (richtig so).
Nominatim mag nur eine Anfrage je Sekunde (429 beim zweiten Aufruf).

FREESTYLE ZUERST GEMESSEN (werkzeug/firma-probe.mjs, baut den Firmen-Auftrag aus dem echten
Eintrag; KI-Testselfie eines Paares im Patio; Aquarell, A6 quer, fuenf Sterne):
- Karte 1 (Eine Szene · Blaue Stunde): Paar, Oktopus-Teller, Wein, Patio, Palmen, Mallorca als
  Poststempel, goldener Rand mit weissen Dingen (Oktopus, Glas, Cocktail, Fisch, Palmwedel,
  Segel), Rand gemessen rgb(152-160, 104-112, 0). DREI BEFUNDE, alle im Auftrag behoben:
  (1) das Logo kam auf einer SCHWARZEN Platte - der Server misst jetzt die Hauptschrift des
  Logos (logoHelle, 90. Perzentil) und der Auftrag sagt "ITS GROUND IS LIGHT/DARK" (logoGrund);
  (2) "EAST 26" von der Fassade im Seitenfoto stand ein zweites Mal auf der Karte - der Auftrag
  sagt jetzt "LEAVE THAT LETTERING OUT and paint the wall bare"; (3) die Unterschrift des Gastes
  fehlte: sie stand in der Buchstabierliste, aber nicht in der Textliste (istOrt-Bedingung) -
  jetzt unterschreibt der Gast auch auf der Firmenkarte, und der Server gibt "von" mit.
- Karte 2 danach (Vignette · Mittag · Linienmuster): Unterschrift da, Wand ohne Schriftzug -
  aber das LOGO FEHLT GANZ. Nicht weiter verfolgt (siehe unten), fuer Ball-z & Co. offen.
- Dazu im Firmen-Auftrag: geschaeft {name, was, stichworte, farben} geht jetzt AUCH bei der
  freigegebenen Firma mit (Rahmen = Schaufenster in Weiss, Dinge als Objekte), das Motiv der
  Firma ist ein eigener Absatz (motiv) statt in der Klammer der Gattung, und "WHAT THE COMPANY
  DOES ... invent no goods" faellt weg, sobald der Geschaefts-Absatz da ist (Widerspruch).
- Auf dem Bilddienst brauchen Vorlagen eine Adresse; base64 von Hand abzutippen geht NICHT
  (2580 Zeichen, ab Zeichen 2133 falsch - der zweite Versuch war es auch). Fuer Proben: das
  Logo auf einen Wegwerf-Host laden (uguu.se, 3 h; tmpfiles.org liefert nur einen signierten,
  bald ablaufenden Link). Live hat das Logo seine Adresse /api/mo/firmenlogo/<slug>.png.

DANN DIE ANSAGE (Markus, 29. Sept.): "Bei einer freigegebenen Geschichte mit Logo soll der Kunde
einen QR-Code auf den Tisch stellen, der direkt zu dieser Karte fuehrt, so dass die Karte dann
ausnahmsweise bis auf das dazugehoerige Selfie immer gleich aussieht - also entwerfe ein schoenes
Design im Stile von EAST26, wie auch die Homepage gemacht ist, so dass es mega stylisch aussieht."
Das ist WEG 1 (Kooperation, fester Rahmen) aus dem Abschnitt "Firmenkarte: zwei Wege".
ENTWORFEN, beide in postkarte/rahmen/ (1952x1408, Magenta-Feld #FF00E6 fuer das Selfie):
- east26-A.png: Elfenbein und Gold, Serifen-Kapitalen, Patio-Vignette rechts, Oktopus und Wein
  klein unten links, Logo oben rechts auf Elfenbein. Feld 829x803 bei (184,202), Fuellung 1,0.
- east26-B.png: Patio zur blauen Stunde als ganze Szene, das Feld als vergoldeter Bilderrahmen
  an der Wand, Logo auf Elfenbein-Tafel. Feld 678x759 bei (283,315), Fuellung 0,999.
  Beide: goldener Rand #997209 mit weissen Linienzeichnungen, Text fest "Liebe Gruesse aus dem
  EAST26 / Santanyí · Mallorca / east26-restaurante.com". Gemessen mit platzhalterFelder():
  je genau EIN Feld; nach dem Einsetzen (fit cover) kein Magenta-Pixel uebrig. Auf der
  Artefakt-Seite mit gemaltem Selfie (Stufe 1, Aquarell) und mit Foto im Original.
WELTWEIT? (Markus, 30. Sept.: "Pruefe bitte, ob das weltweit funktioniert.") GEMESSEN am lebenden
/api/mo/ort fuer 39.3540 / 3.1269: name "Santanyí", land "Spanien", landCode "es", Strasse
"Carrer del Bisbe Verger", Standort-Knoepfe "East26 (Restaurant, gastro, international) 3 m",
"Carrer del Bisbe Verger 26 (Adresse) 3 m", dazu mimar, Dog's Paradise, Galerie Flohr, Suma;
lokal mit dem Zweig steht EAST26 als Absender daneben (0 m, Logo, #997209, gastro), in Palma
nicht. Nominatim, OSM-Karten-API, Overpass und die Rueckseite (Zeile "land") kennen kein Land-
Limit; Accept-Language "de" liefert nur deutsche Namen, wo es sie gibt. EINE Stelle war deutsch:
die Anschrift einer von der Seite geholten Firma wurde mit ", Deutschland" verortet - jetzt mit
dem Land aus dem Eintrag (land). Nicht gemessen: das Textmodell auf einer fremdsprachigen Seite
(GESCHAEFT_LESEN, kein Schluessel hier). Die Seite selbst spricht nur Deutsch - fuer EAST26
(deutschsprachige Seite, deutsche Gaeste) passt das, fuer ein spanisches Publikum nicht.
BESTES VOM ELBDEICH (Markus, 30. Sept.: "https://bestes-vom-elbdeich.de - fuer diese Seite und
diesen Standort haben wir die Freigabe, das Logo zu benutzen ... eine Postkarte ... ein cooles
Design von Bestes vom Elbdeich." Und: "Das wird auch der erste Startpunkt, die Gutscheine zu
testen.") Hofladen und SmartStore, Moorburger Elbdeich 447, 21079 Hamburg. Eintrag wie EAST26
(Punkt aus OSM-Knoten 12589821801, shop=farm; Rot der Seite #C03A2B vorn, Taupe und Gruen aus
dem Logo; Beschreibung, sechs Dinge, zwei Seitenfotos, Motiv Erntetisch). ZWEI BEFUNDE:
(1) Das Logo gibt es auf der Seite NUR als 72x72-AVIF (LogoBVE.avif; /assets/logo.png und alle
ueblichen Pfade 404) - erst auf 512 hochgerechnet; am 30. Sept. kam das ORIGINAL von Markus
(PNG 3126x2266 mit Alphakanal, Bildmarke plus Schriftzug), jetzt 1413x1024 im Repo. Gemessen:
Rot rgb(255,53,58) 58 %, Taupe 38 %, Gruen 4 %, Helle(90%) 138 -> Logo-Grund "mitte". Die
Hausfarben im Eintrag sind seitdem die des Logos (#FF353A, #9C8977, #449A23); die Homepage
baut mit dem dunkleren #C03A2B, und die ersten Karten und die drei Gutschein-Entwuerfe liefen
noch damit - bei der Neuausgabe mit dem Original entscheidet Markus, welches Rot der Rand traegt. (2) Die Seite hat AUSSCHLIESSLICH AVIF-Bilder, und der Bilddienst weist eine AVIF-Adresse
als Vorlage ab (gemessen: 400 "Invalid image data"). Also sieht der Server jetzt jede Vorlage vor
dem ersten Aufruf an (vorlagenTauglich): was kein PNG/JPEG/WebP ist, wird zu JPEG und eine Stunde
aus dem Speicher ausgeliefert (/api/mo/vorlage/<jobId>-v<n>.jpg, dieselbe Ablage wie das
Geschaeftslogo). Gilt fuer JEDE Karte mit Vorlagen, auch Wikipedia/Openverse.
(3) Der Logo-Grund hat jetzt DREI Klassen: das Taupe-Logo (Helle 138) galt mit der Grenze 128 als
"light lettering" - falsch. Ueber 180 dunkler Grund, unter 120 heller, dazwischen "clearly lighter
or clearly darker, never a plate in its own tone".
GEMESSEN (werkzeug/firma-probe.mjs mit fotos= und gruss=, KI-Testselfie Vater und Tochter am
Hofladen, Aquarell, A6 quer): Rand rgb(192,56,32) bei #C03A2B, weisse Kuh, Kirschen, Glaeser,
Eier, Aepfel, Flaschen rundum, Logo einmal und sauber (das Modell glaettet die 72-Pixel-Vorlage),
"Moin vom Elbdeich!", Unterschrift, Erntetisch mit Aepfeln, Eiern, Kirschen, Saft, Angus-Rinder
aus dem Selfie-Hintergrund. Sehr gut. Der feste Rahmen (Weg 1) und der Gutschein-Weg sind fuer
diesen Betrieb noch nicht gebaut.
GUTSCHEINE (Markus, 30. Sept.: "welche Automatisierungswege gibt es, dass das Geld vom Gutschein
sofort zum Anbieter geht"): Stripe Connect mit Direct Charges auf dem Konto des Betriebs, unsere
Gebuehr als application_fee - das Geld liegt nie bei uns. Instant Payouts (docs.stripe.com/
connect/instant-payouts, gelesen 30. Sept.): fuer Plattform und Konto im Euroraum verfuegbar,
Geld "typically within 30 minutes" auf dem Bankkonto, 1 % Gebuehr von Stripe, Mindestbetrag
0,40 EUR, Voraussetzung ein instant-faehiges Bankkonto oder eine Debitkarte. Ohne Instant:
Standard-Auszahlung nach dem Stripe-Rhythmus des Kontos.
GUTSCHEIN-ENTWUERFE (Markus, 30. Sept.: "drei schoene Vorschlaege speziell fuer Weihnachten,
Geburtstage, fuer einen Gutschein" - das Original-Logo kommt von ihm nach): drei feste Entwuerfe
in postkarte/rahmen/gutschein-bve-{weihnachten,geburtstag,jahr}.jpg (1952x1408, JPEG q92 mit
4:4:4 - gemessen: platzhalterFelder findet das Magenta-Feld auch im JPEG, je genau eines,
Fuellung 1,0). Aufbau: Elfenbein, Rot #C03A2B fuer Rand und "GUTSCHEIN", Taupe fuer die kleinen
Zeilen, weisse Linienzeichnungen im Rand; die Zeilen WERT / FUER / VON bleiben LEER (der Server
schreibt sie beim Kauf hinein), das Magenta-Quadrat ist der QR-Platz. Motive: Weihnachten
(Tanne, Aepfel, Marmelade, Zimt, Eier, Kuh mit Schal), Geburtstag (Apfelkuchen mit Kerze, Saft
mit Schleife, Kirschen, Luftschlangen, Henne mit Partyhut), Jahr ("Echt vom Elbdeich. Fuer
dich.", Rinder und Henne auf dem Deich). QR-Felder gemessen: 210x208 / 251x254 / 297x296 px -
bei A6 sind das 1,6 / 1,9 / 2,2 cm; unter 2 cm wird ein QR mit Adresse eng, beim Weihnachts-
Entwurf das Feld groesser bestellen, falls er gewaehlt wird. Das Logo ist noch die 72-Pixel-
Fassung. Der Gutschein-WEG (Kauf, Stripe Connect, QR erzeugen, Einloeseseite) ist nicht gebaut;
kein QR-Modul im Repo (npm "qrcode" waere der Weg).
DER GUTSCHEIN IST PERSONALISIERBAR WIE EINE POSTKARTE (Markus, 30. Sept.: "Der Gutschein muss
genauso cool sein und die Moeglichkeit haben, ausgewaehlt zu werden: in welchem Stil, von wem,
fuer was, und der Wert ganz ganz klein und auf Wunsch ganz weg, nur mit einem QR-Code, wo der Wert
hinterlegt ist" - "genauso personalisierbar wie eine Postkarte, das ist ja das Coole"). Also
KEINE feste Vorlage je Anlass, sondern der Firmen-Auftrag mit einem Gutschein-Absatz: Anlass
(Weihnachten, Geburtstag, Danke, einfach so) als Motiv, Stil aus der Stilwahl, "Gutschein" als
Kopfzeile, Anlasszeile mit Namen, "Fuer einen Einkauf am Elbdeich", Unterschrift, Wert winzig in
einer Ecke oder gar nicht, ein Magenta-Quadrat fuer den QR (der Server setzt ihn hinterher).
GEMESSEN am 30. Sept. mit dem Original-Logo (postkarte/gutschein/beispiel-bve-*.jpg, Auftraege
von Hand nach dem Muster des Firmen-Auftrags): Weihnachten/Aquarell (50 EUR winzig), Geburtstag/
Reiseplakat (ohne Wert), Danke/Bleistift (25 EUR winzig) - alle Texte richtig, Logo einmal, QR-
Felder 236x234 / 254x256 / 249x242 px (1,8-1,9 cm bei A6; 22 % Hoehe bestellt, 17-18 % geliefert -
fuer 2 cm eher 26 % bestellen). Beim Reiseplakat hat der Stil die Henne im Logo mit schwarzem
Umriss versehen - der einzige Logo-Fehler von sechs Gutscheinen. Die drei festen Vorlagen von
zuvor (postkarte/rahmen/gutschein-bve-*.jpg) bleiben als Anschauung.
WEIHNACHTEN, ZWEITER ANLAUF (Markus, 30. Sept.: "Weihnachten muss viel viel weihnachtlicher und
viel viel stylischer, passend zur Seite sein"): die Seite arbeitet mit Elfenbein #F7F1E4, dem
Nachtton (--nacht), Rot und warmem Gold #E8B45A. Zwei Varianten gemessen (postkarte/gutschein/
beispiel-bve-weihnachten-nacht.jpg und -kranz.jpg): "Winternacht am Deich" (dunkel, leuchtender
Hofladen, Gold-Lettering, Logo auf Elfenbein-Tafel, QR 274x271 = 2,0 cm) und "Kranz und Gold"
(Elfenbein, grosser Tannenkranz mit Kuh in der Mitte, QR 212x214 = 1,6 cm). Beide Texte richtig,
Logo exakt. Lehre fuer den Gutschein-Absatz: die Anlass-Beschreibung muss so konkret sein wie
hier (Szene, Licht, Dinge, Ton der Seite) - "Christmas at the farm" allein war zu duenn.
DER WERT LIEGT NICHT IM QR-CODE, sondern hinter einer unratbaren Nummer auf unserem Server
(Guthaben, Teileinloesung, Restwert, Protokoll) - wie jede Geschenkkarte im Supermarkt; ein Code
mit Klartext-Wert liesse sich abfotografieren und doppelt einloesen. Markus' Idee (30. Sept.):
Wert plus Einmalnummer im Code, die Kasse behandelt ihn wie Bargeld und druckt fuer den Rest einen
neuen Code - geht nur mit SIGNIERTEM Inhalt und einer Liste eingeloester Nummern in der Kasse, und
die Kasse muss den Restwert-Code selbst signieren koennen. Entscheidung offen; Vorschlag: der Code
traegt beides (signierter Wert plus unsere Einloeseadresse). Der SmartStore in Moorburg (Seite
/smartstore, gelesen 30. Sept.): Karte an den Leser, Tuer auf, Produkte am Terminal selbst
scannen, Karte/Apple Pay/Google Pay - keine App, kein Konto. Welches Kassensystem dort laeuft,
steht nicht auf der Seite; ohne Anbindung nimmt kein Terminal einen fremden Gutschein an. Start
darum mit Einloesen per Handy-Scan im bemannten Hofladen.
RECHERCHE 30. SEPT. (Markus: "Wir wollen das Geld gar nicht haben. Stripe Connect, 5 % Provision,
der Rest an den Betrieb abzueglich Stripe. Der QR-Code wird an der Kasse gescannt, ohne
Verbindung zu uns; alles im QR; Rest 30 EUR als neuer QR von der Kasse; wir haben die Daten
nie."):
- GELD: genau so bei Stripe Connect mit DIRECT CHARGES auf dem Konto des Betriebs und
  application_fee_amount (5 %). Die Zahlung landet auf dem Konto des Betriebs, Stripe zieht dort
  seine Gebuehr, unsere Provision wird zu uns geleitet; wir halten nie Geld
  (docs.stripe.com/connect/charges, /connect/direct-charges).
- DER SMARTSTORE IN MOORBURG ist ein SmartStore24 (Augsburg; Bildpfade assets/smartstore24 und
  "Ich bin ein SmartStore 24" auf bestes-vom-elbdeich.de/smartstore). SmartStore24 setzt als
  Kasse das Cloud-Kassensystem von LocaFox (Bielefeld) ein (stores+shops / smartstore24.de).
- LOCAFOX GUTSCHEINE (help.locafox.de/portal/de/kb/articles/gutscheine): eigene Gutscheine mit
  Barcode auf dem Gutschein-Bon, Einloesen durch Scannen, Teileinloesung mit Restwert im System;
  "Fremder Gutschein" nur als von Hand eingetippter Betrag - an einer unbemannten Kasse
  unbrauchbar (der Kunde tippte seinen eigenen Wert). Keine Schnittstelle, keine Signaturpruefung
  fremder Codes dokumentiert. DiKAS (doku.dikas.de) druckt Restwert-Bons mit QR, aber nur fuer
  eigene Gutscheine mit Guthaben im System.
- KEINE Kasse gefunden, die einen fremden, signierten Offline-Gutschein prueft und einen
  signierten Restwert-Code ausgibt. Technisch moeglich (Signatur + Liste eingeloester Nummern +
  Kasse signiert den Rest), aber nur als Sonderbau des Kassenherstellers.
- GANGBARER WEG OHNE UNSERE DATEN: der Gutschein ist ein LOCAFOX-Gutschein des Hofs. Der Hof legt
  Gutscheine in festen Werten (10/25/50 EUR) vorab in LocaFox an und gibt uns die Nummern; wir
  verkaufen einen davon (Stripe Connect), drucken seinen Barcode in unser Design, und Einloesen
  samt Restwert laeuft ganz in LocaFox an der SB-Kasse. Wir halten nur die Liste unverkaufter
  Nummern. ZWEI FRAGEN an SmartStore24/LocaFox: nimmt die SB-Kasse LocaFox-Gutscheine per Scan
  an, und lassen sich Gutscheine gesammelt oder per Schnittstelle anlegen?
NOCH NICHT GEBAUT - erst, wenn Markus einen Entwurf gewaehlt hat: der Server-Weg fuer den festen
Rahmen (Eintrag "rahmen" in firmen-freigaben.json, kein Flyer-Auftrag, Selfie in Stufe 1 in der
Technik des Rahmens malen oder im Original, in das Feld setzen; Datum und Unterschrift auf die
Rueckseite; der QR-Link je Firma, der die Seite direkt mit dieser Firma oeffnet).

## DTF Factory, Harmstorf - Markus' zweite Firma (1. Okt.)

Markus stand Im Dorfe, Harmstorf, und die Seite bot DTF Factory nicht an: "Aber er findet DTF
Factory ja noch nicht mal als Firma, da faengt das Problem ja schon an - und hiermit ist das Logo
und die Internetseite freigegeben, weil es ist ja meine Firma." Und: "Wichtig ist doch, dass das
System erkennt, was fuer Firmen in der Naehe sind."
WARUM SIE FEHLTE: die Standort-Knoepfe kommen aus OpenStreetMap, und dort gibt es weder "DTF
Factory" noch die Hausnummer Im Dorfe 9 (gemessen, Nominatim, 1. Okt.). Absender-Knoepfe kommen
nur aus postkarte/firmen-freigaben.json - und da stand sie nicht. Eine Firma, die in keiner der
beiden Quellen steht, kann das System nicht kennen.
EINGETRAGEN wie EAST26 (DTF Factory GmbH, Im Dorfe 9, 21228 Harmstorf, HRB 209743 Tostedt;
Markus, 1. Okt.: "DTF-factory.com" - die Firmenseite, B2B: eigene Folien, Tinten, Pulver,
Trockner, Thermodruckpressen, Beratung, Showroom; dtf-queen.com ist nur der Transfer-Shop
derselben GmbH, als Name im Eintrag): Punkt der Strasse Im Dorfe 53.3487 / 9.9870 (die Hausnummer
kennt OSM nicht), Radius 150 m. Logo = das Original von der Seite (buntes Einhorn, gruene Schrift
"DTF Factory GmbH", 420x270 PNG auf Weiss), per Flutfuellung vom Rand freigestellt und auf 1024
breit gebracht (postkarte/logos/dtf-factory.png; 81,6 % der Pixel durchsichtig, die weissen
Lichter IM Einhorn bleiben). Hausfarbe = das Gruen der Schrift #6FAF33 (gemessen auf der
Schriftzeile; das Einhorn ist ein Regenbogen, der taugt nicht als Rand). Zwei Seitenfotos (die
eigene Produktion, der Trockner 630; WebP), Motiv "die Presse bei der Arbeit, kein Einhorn, kein
Logo im Druck". Ein erster Versuch mit dtf-queen.com (Pink/Violett, 170-Pixel-Logo) ist damit
ersetzt. Gemessen: an Im Dorfe werden DTF Factory (0 m) und Ball-z
(70 m) angeboten, am Ball-z-Eingang Ball-z zuerst und DTF Factory 55 m dahinter; "DTF Queen" und
"DTF-Factory GmbH" treffen den Eintrag, "DTF Express" bleibt die andere Firma. Drei Abnahme-Pins
(Gelaende, Buerohaus, Namensliste) zaehlen die zweite Firma in Harmstorf jetzt mit.
OFFEN, und das ist Markus' eigentlicher Punkt: Firmen, die nicht in OSM stehen, kennt das System
nur ueber die Freigabe-Datei. Eine dritte Quelle waere das Handelsregister je Anschrift
(openregister.de hat eine API, implisense listet "Firmen an der Adresse Im Dorfe 9") - damit
wuesste die Seite, welche Firmen an einem Punkt SITZEN, auch ohne OSM. Nicht gebaut, nicht
geprueft (Nutzungsbedingungen, Kosten); nur als Weg notiert.
NACH DEM REBASE auf main (1. Okt.) waren die Momentaufnahmen in storage/mottos auf main veraltet
(gruesse-aus seedRev 16 bei GA_REV 24; Kegeln, Abi, Saat-Abgleich rot). Ein Serverstart erneuert
sie aus seed.json; die erneuerten Dateien sind mit diesem Stand eingecheckt, damit die Abnahme
wieder gruen ist. Das ist Chat 1/3-Gebiet - nur nachgezogen, nichts daran veraendert.

## Luigi, 1. Okt. abends: zwei Karten, drei Befunde (Railway-Log gemessen)

Markus: "Es wurden heute Postkarten bei Luigi gemacht. Das Schwarz ist Katastrophe, und ich habe
selber eine Postkarte bei Luigi gemacht: weder ist das Logo drauf, und da wird ne Pommes angezeigt.
Das ist Italiener, da gibt's Pizza, und das hatten wir ganz klar schon festgelegt."
Das Railway-Log von Motto Otto liegt im Projekt kiez-design-api, Service motto-otto (NICHT im
Projekt ball-z - das ist der Trikot-Konfigurator). Gemessen fuer 17:45 und 17:57 UTC:
1. KARTE 5UEL (Gast, 17:45, "Mein Foto im Original", Ort von Hand "21266 Jesteburg", keine
   Koordinaten): "Vorlagen (keine)" und damit KEINE Ortskarte als Bild 1 - der Aufruf fiel auf
   das FOTO als Eingangsbild zurueck (der Ausdruck `(fotoOriginal && originalEingang64) ?
   originalEingang64 : (fotoGemalt || fotoRaw)`), gegen die Regel vom 24. Sept. Das Modell malte
   statt des Magenta-Feldes einen SCHWARZEN KASTEN ("KEINE Magenta-Flaeche gefunden - das Foto
   kommt in die Mitte"), und die Chef-Mail zeigte die Karte so. BEHOBEN: ohne Ortskarte ein
   heller Karton #F4EFE6 in Kartengroesse als Bild 1 (am Bilddienst nicht gemessen; der Log sagt
   "heller Karton ... statt des Fotos"). Dass "Luigis Pizza" auf der Karte stand, kam aus dem
   Feld "von" - der Gast hatte es als Absender getippt; values.firma war leer, also kein Logo.
2. KARTE NERS (Markus, 17:57, Koordinaten am Wagen): er tippte den Standort-Knopf "Luigi
   Pizzawagen (Imbiss)" an, keinen Absender-Knopf. Der Server machte aus dem Knopftext eine
   "Strasse" (luigipizzawagenimbiss), die zu keiner Anschrift passte, values.firma war leer ->
   "keine Firma" -> Geschaeftsweg mit Gattung fast_food -> POMMES, kein Logo. BEHOBEN: nur
   standort_art adresse/strasse (oder ein Text mit Hausnummer) wird zur Strasse; ein angetippter
   Betrieb (standort_art firma) ohne Absender-Wahl wird ueber seinen Namen (ohne Klammerzusatz)
   gegen die Freigaben geprueft - "Luigi Pizzawagen" steht in Luigis namen. Lokal nachgestellt:
   "der angetippte Standort "Luigi Pizzawagen" ist der freigegebene Betrieb Luigi's Pizza UG ·
   Standort-Strasse Harburger Strasse · passt · Firmen-Flyer ... Vorlagen 2=logo 3=karte".
   DANN DIE REGEL (Markus, 1. Okt., abends): "Wenn jemand ein Selfie gemacht hat, der Standort
   geortet ist und dann jemand was auswaehlt wie Luigis Pizzawagen, dann darf es ueberhaupt keine
   Moeglichkeit geben, irgendwas falsch zu machen, sondern es wird dieser Standort uebernommen zu
   100 % - und macht der Gastronom oder wer auch immer mitmacht unter diesem Standort mit, wie zum
   Beispiel mit dem QR-Code, dann soll direkt die gleiche Seite aufgehen." GEBAUT: /api/mo/ort
   prueft jeden Standort-Knopf der Art firma gegen die Freigaben (firmenFreigabeFuer mit dem
   Namen ohne Klammerzusatz) und traegt freigabe + tor (/bei/<slug>) ein; die Seite setzt beim
   Antippen den Betrieb als Absender (wunschFirma -> absenderAnbieten belegt den Knopf vor) und
   zeigt darunter "Du bist bei <Betrieb> ... zur Seite des Hauses" - dasselbe Tor wie der QR am
   Tisch. Gemessen lokal am Pizzawagen (53.3122/9.9645): Standort "Luigi Pizzawagen (Imbiss)"
   traegt freigabe "Luigi's Pizza UG" und tor /bei/luigispizzaug; der Server-Fallback (angetippter
   Betrieb ohne Absender-Wahl) bleibt als zweites Netz. Im Browser NICHT gemessen (die Abnahme
   geht den Weg ohne Firma); der erste Live-Lauf zeigt es.
3. PIZZA STATT POMMES braucht ausserdem den Zweig: der Motiv-Absatz ("A WHOLE PIZZA ...") als
   eigener Absatz und der Logo-Grund sind seit dem 29. Sept. nur auf eigene-fotos; live (main)
   geht das Motiv noch als Gattungs-Klammer mit. Erst mit dem Deploy des Zweigs gilt beides.
Nebenbefund (Chat 3, nicht angefasst): die Chef-Mail listet unter "Eingaben" auch den Prompt-Text
des versteckten Feldes karte ("NO BORDER, NO FRAME ...") - dort gehoeren nur sichtbare Felder hin.

## Der Gutschein-Weg - GEBAUT am 30. Sept. (Zweig eigene-fotos)

Markus, 30. Sept., nach der Recherche: "Wir brauchen eine Loesung, die funktioniert, wie wir das
machen ist mir ziemlich egal, und die brauchen wir schnell." Also gebaut, was ohne Kassenanbindung
sofort laeuft - und so, dass die LocaFox-Variante spaeter dazukommen kann, ohne den Weg umzubauen.

SO LAEUFT ES:
1. Der Betrieb setzt einen Link auf seine Seite: `/m/gutschein?firma=<slug>` (auch
   `/gutschein/<slug>` leitet dorthin; slug = Firmenname klein, ohne Leerzeichen - Bindestriche
   sind erlaubt: `bestesvomelbdeich` und `bestes-vom-elbdeich` treffen beide). Ohne Freigabe-
   Eintrag mit Datum gibt es keinen Gutschein - der Auftrag endet mit klarer Meldung.
2. Das Motto `gutschein` (postkarte/motto-gutschein.json, im Server-Start wie die Postkarte
   angelegt, GU_REV) fragt in fuenf Schritten: Anlass (Weihnachten, Geburtstag, Danke, einfach so,
   Kacheln aus postkarte/beispiele/gutschein-*.jpg), Stil, fuer wen / von wem / ein Satz, Wert
   (10/25/50/100) und ob er draufsteht (winzig oder gar nicht), optional ein Foto.
3. runJob: der Gutschein-Zweig (nach der Firmen-Erkennung) findet den Betrieb aus `values.firma`,
   legt SOFORT einen Entwurf an (gutscheine.anlegen: Code wie HZJ7-ZSCW-PBTF, ohne 0/O/1/I/L;
   Datei storage/gutscheine/<code>.json) und laeuft dann durch den FIRMEN-BLOCK - dieselbe Karte
   wie EAST26 oder Elbdeich, mit dem Gutschein-Absatz aus firmen-flyer.js (gutscheinKopf,
   gutscheinZeilen, Anlass-Szene aus gutscheine.ANLAESSE, "THE QR FIELD": ein Magenta-Quadrat,
   26 % der Hoehe). Ohne Foto ist Bild 1 das erste Seitenfoto des Betriebs (AVIF -> JPEG,
   gemessen: das Eier-Foto der Elbdeich-Seite), und der Auftrag sagt OHNE_PERSON; mit Foto
   laeuft Stufe 1 (Nachmalen) wie bei der Postkarte.
4. Nach dem Bild, VOR makeMaster: gutscheine.qrEinsetzen misst mit platzhalterFelder das kleinste
   quadratische Magenta-Feld und setzt den QR-Code (`/g/<code>`, nur die Adresse - der Wert
   steht NIE im Bild) hinein; ohne Feld eine Elfenbein-Tafel unten rechts, Befund am Auftrag
   (job.gutschein.qr.gefunden). Der Status (/api/mo/job) traegt `gutschein` {code, wert, url,
   qr}; die Seite zeigt unter der fertigen Karte "Gutschein bezahlen · 50 €" -> /g/<code>.
5. /g/<code> (gutschein.html): Stand, Kaufknopf, nach Zahlung das Bild (Master als JPEG, nur bei
   aktiv/leer), Teilen, und fuer den Betrieb das Einloesen: Betrag + PIN, Teileinloesung, Rest
   bleibt auf dem Code, Verlauf. Drei Jahre gueltig (bis Jahresende, Paragraf 195 BGB).
6. Bezahlen: /api/mo/gutschein/<code>/kaufen -> Stripe Checkout als DIRECT CHARGE auf dem
   Connect-Konto des Betriebs (Stripe-Account-Kopf), unsere 5 % als application_fee_amount
   (billing.js gutscheinCheckout) - das Geld liegt nie bei uns. Zurueck auf /g/<code>?session_id=
   liest der Server die Sitzung und aktiviert bei "paid"; ein Abgleich alle 5 Minuten faengt, wer
   nicht zurueckkam; Entwuerfe ohne Zahlung fallen nach drei Tagen weg.

WAS MARKUS TUN MUSS, damit es live geht (nichts davon kann ich hier):
- `STRIPE_SECRET_KEY` bei Railway setzen (Plattform-Konto mit Connect). Ohne Schluessel meldet
  /kaufen 503 "noch nicht eingerichtet" - der Rest des Weges laeuft, und ein Gutschein laesst
  sich im Backend von Hand freischalten: `POST /api/admin/gutschein/<code>/aktivieren`.
- Je Betrieb ein Connect-Konto: `POST /api/admin/firmen/<slug>/stripe` (Body {"email"}) legt ein
  Express-Konto an und liefert den Einrichtungs-Link fuer den Betrieb; die Konto-Nummer steht
  danach im Nachweis (storage/firmenlogos/nachweis.json, `stripeKonto`).
- Je Betrieb eine PIN zum Einloesen: `POST /api/admin/firmen/<slug>/pin` (Body {"pin"}), nur der
  Hash wird gespeichert (`einloesePinHash`). Ohne PIN meldet das Einloesen 403.
- Backend-Liste: `GET /api/admin/gutscheine?firma=<slug>`.

GEMESSEN am 30. Sept. (lokal, Bilddienst nicht erreichbar - der Bild-Aufruf selbst ist NICHT
gemessen): Auftrag ohne Foto fuer Bestes vom Elbdeich -> Log "Gutschein: ... Y8TF-HMVC-RA86 ·
50 € · weihnachten · fuer Oma Inge · von Max und Lena · Wert winzig · ohne Foto", "Bild 1 =
Seitenfoto Freiland_eier_hamburg_moorburg.avif", "Gutschein-Auftrag: ... Vorlagen 2=logo 3=foto
4=foto · 19049 Zeichen". Lebenslauf ueber die Wege: PIN setzen, falsche PIN 403, 20 EUR eingeloest
-> Rest 30, 40 EUR abgelehnt ("Nur noch 30 € Guthaben"), ohne Stripe-Schluessel /kaufen 503,
unbekannter Code 404. Abnahme (Abschnitt 9): Code-Format, Werte und Provision, Anlaesse,
Lebenslauf im Wegwerf-Speicher, Aufraeumen, PIN-Hash, QR-Feldwahl (von zwei Magenta-Feldern das
kleine quadratische, das Fotofeld bleibt), Tafel ohne Feld, Gutschein-Absatz, Motto mit 11 Feldern
in der Saat (seed.json), Server-Regexe, Wege, Stripe-Saetze, Seite.

OFFEN:
- Der Bild-Aufruf mit dem Gutschein-Auftrag ist nur mit den Proben von Hand belegt
  (postkarte/gutschein/), nicht durch den Server. Erster Live-Lauf ansehen: sitzt der QR im Feld
  (Log "Gutschein QR: ... im Magenta-Feld ... mm bei A6")? Unter 2 cm wird der Code eng.
- Kasse: Einloesen ist Handy-Scan plus PIN durch den Betrieb. Die beiden Fragen an SmartStore24/
  LocaFox (Scan an der SB-Kasse, Gutscheine per Schnittstelle anlegen) sind offen; wenn ja,
  wird der LocaFox-Barcode zusaetzlich ins Bild gesetzt - der Weg hier bleibt.
- Stripe-Webhook fuer Connect-Zahlungen gibt es nicht; der Abgleich per Sitzung reicht fuer den
  Start. Rechnung/Beleg an den Kaeufer kommt von Stripe (Checkout), nicht von uns.
- Das Motto steht mit order 99 in den Motto-Listen; ohne ?firma sagt die Seite, dass der Link des
  Betriebs fehlt. Wenn es dort nicht stehen soll, braucht mottos.js einen Schalter dafuer.

UNBEMANNTE LAEDEN (Markus, 30. Sept.: "Die ganzen SmartStores sind unbemannt, deswegen ist alles,
was haendisch eingescannt werden muss, vollkommen uninteressant." - "Recherchiere, ob es noch
andere Moeglichkeiten gibt."). Der PIN-Weg gilt damit NUR fuer bemannte Theken. Recherchiert:
- SmartStore24 heisst seit 2026 SimpliStore (simplistore.de; smartstore24.de nur noch Hinweis).
  Zwei Betriebsarten: KARTE (Bank-/Kreditkarte am Leser oeffnet die Tuer, Zahlung Karte/Apple
  Pay/Google Pay/PayPal, "keine App, keine Registrierung, kein Konto" - so laeuft der Elbdeich)
  und QR (Registrierung, persoenlicher QR-Code per Mail, hinterlegte Zahlungsart, Beispiel
  Zinnecker & Schmidt). Kein Wort zu Gutscheinen, Guthaben oder Kundenkarten; Schnittstellen
  nur zu Warenwirtschaft (Bizerba, Aprocon, WinWeb, PC Lin).
- LocaFox: Gutscheine mit Barcode, Teileinloesung, aber die Hilfe beschreibt nur die bemannte
  Kasse; die oeffentliche API (pos-api.locafox.de, gemessen am JS-Bundle) hat KEINEN Gutschein-
  Endpunkt - nur Produkte, Kunden, Transaktionen (payment_type VOUCHER als Filter). Gutscheine
  liessen sich also nur von Hand an der Kasse anlegen.
- Stripe Issuing (virtuelle Karte mit dem Gutscheinwert in Apple/Google Pay, zahlt an jedem
  Terminal): FAELLT WEG - Stripe verbietet "consumer use" von Issuing-Karten und "gift cards,
  stored value" ausdruecklich (stripe.com/legal/restricted-businesses); Issuing ist nur fuer
  Firmenkarten. Andere Kartenherausgeber (Marqeta, Weavr) waeren ein eigenes Projekt und
  hielten das Geld bei uns.
- secucard/secupay (secuconnect-API, POST /api/v2/Loyalty/MerchantCards/.../CreateMerchantcards):
  geschlossene Gutscheinkarten je Haendler, physisch oder als Code, Teileinloesung, Einloesung
  per Barcode am EC-Terminal, an der Kasse oder - laut secucard.com - am Self-Checkout; Verkauf
  per API moeglich. Der eine offene Punkt: das Terminal bzw. die SCO-Software des Ladens muss
  secucard koennen (secupay-Terminals oder SDK-Anbindung). Keine Preise auf der Seite.
- Arcavis/Zahlpunkt (Selbstbedienungslaeden, Schweiz/DE): Gutscheine und Kundenkarten werden am
  Self-Scanning-Terminal gescannt, Kundenkarten liegen in Apple/Google Wallet - der Beweis, dass
  es SB-Kassen gibt, die das koennen. Korona/kassen24: keine Gutscheine dokumentiert.
- Bluecode: Kunde zeigt Barcode in der App, Gutscheine werden dort automatisch verrechnet -
  braucht ein Terminal mit Bluecode (in Deutschland nur Rossmann, Mueller, Globus u. a.).
FAZIT: es gibt keinen Weg an einer unbemannten Kasse OHNE den Kassenanbieter. Drei realistische
Wege, alle ueber den Anbieter: (1) LocaFox-Gutschein (Barcode ins Bild), wenn die SimpliStore-
Kasse ihn per Scan nimmt und Gutscheine gesammelt angelegt werden koennen; (2) secucard als
Gutschein-Rueckgrat (per API angelegt, Barcode ins Bild), wenn Terminal/SCO secucard annimmt;
(3) bei Laeden im QR-Modus ein Guthaben im SimpliStore-Kundenkonto - ein Feature, das SimpliStore
bauen muesste. Unser Teil bleibt in allen drei Faellen gleich: Gestalten, Stripe Connect mit 5 %,
Barcode/QR ins Bild, Gutscheinseite. Was wechselt, ist nur die Einloesung.

DIE FORM BLEIBT (Markus, 26. Sept., auf die Frage, ob sie mit der Aufteilung mit wegfaellt):
"Die Form bleibt." Also weiter ein eigener Schritt: quer 14,8 x 10,5 · hoch · Panorama 21 x 10,5.
Sie ist das PAPIER, nicht das Design - sie entscheidet die Druckflaeche. Weggefallen ist nur die
AUFTEILUNG (Mehrbildkarte, Einbildkarte, geteilte Karte); die macht die Bild-KI, und mit der
Regel oben kommt sie ohnehin aus der Zahl der Fotos.

HAUSREGEL BLEIBT: kein Kundenfoto auf der Platte. Die bis zu fuenf Fotos liegen wie das Selfie
nur im Arbeitsspeicher (FOTO_SPEICHER haelt jetzt eine LISTE je Sitzung, eine Stunde). Sie gehen
als Daten an den Bilddienst (referenceImagesBase64), nie unter einer Adresse im Netz.

GEBAUT am 27. Sept. (Zweig `eigene-fotos`), und so sieht man es:
- Die WAHL bei der Sehenswuerdigkeit ist das Feld `kartenstoff` ("Die Sehenswuerdigkeit" /
  "Meine eigenen Fotos", vorbelegt mit dem Ort). Es steht im Schritt "Wo bist du?" und zeigt sich
  nur, wenn das versteckte `standort_art` auf `sehenswuerdigkeit` steht - das schreibt die Seite
  aus der Erkennung (auch wenn es gar keine Auswahl anzutippen gibt) und aus dem angetippten Knopf.
- Im Server hoert beides auf EINEN Schalter: `privat = istPrivat(...) || kartenstoff === 'eigene'`.
  Wer "eigene" waehlt, bekommt genau die Karte aus Fall 1.
- GEMESSEN und dabei gefunden: wer "eigene" antippt und danach doch die Hausnummer nebenan waehlt,
  hatte die Frage nicht mehr vor sich - aber "eigene" stand noch im versteckten Feld, und der
  Server baute eine Karte ohne den Ort. Jetzt gilt: ein Feld, das nicht mehr zu sehen ist, traegt
  wieder seine Vorgabe (zurueckAufVorgabe in motto-seite.js). Das gilt genauso fuer die Sterne.

WAS AUF DEN BILDERN IST, GEHOERT INS DESIGN (Markus, 26. Sept., zweite Idee): "Per Bilderkennung
erkennen - jemand fotografiert Blumen in seinem Garten, dann eine Flower-Karte; sitzen die Leute
beim Essen oder fotografiert man sein Essen, eine Food-Karte - so dass das, was auf den Bildern
ist, mit ins Design kommt."
GEBAUT am 27. Sept.: FOTO_INHALT_FRAGE fragt zusaetzlich ein FESTES Feld `motiv` ab - EIN Wort aus
einer festen Liste (selfie, menschen, essen, essen_mit_leuten, blumen_garten, tier, feier,
landschaft, gebaeude, sonstiges). Aus freiem Text kann niemand rechnen, aus einem Wort schon.
`MOTIV_THEMA` gibt jedem Wort EINEN Satz fuer den Bildauftrag, `kartenThema()` macht daraus das
Thema der ganzen Karte: das haeufigste Motiv gewinnt, bei Gleichstand das ERSTE Foto (das Selfie).
DER SATZ SCHMUECKT NUR. Er erfindet nie ein zweites Motiv - sonst steht wieder ein Kuchen auf der
Karte, den niemand fotografiert hat. selfie, menschen, gebaeude und sonstiges haben deshalb gar
keinen Satz: dann bleibt die Karte, wie sie ohne Erkennung waere. Ein einziger Blick auf das Foto
beantwortet beide Fragen (Mensch/Tier UND Motiv) - kein zweiter Aufruf.
Im Zweifel (keine Antwort, kein Modell, unbekanntes Wort) bleibt die Karte wie ohne Erkennung.
Nie raten.

## Stile, die nicht nach KI aussehen - und das Foto im Original (Markus, 27. Sept.)

MINIMALISTISCH: "ist nicht einfarbig, sondern es ist nur minimalistisch GEZEICHNET - d.h. wir
koennen trotzdem alle Farben nutzen. Das sieht doch Scheisse aus." Im Stiltext stand "very few
colours - off-white plus one or two accents": das war die Farbrationierung, nicht der Stil. Jetzt:
wenige Linien, flache Flaechen, VOLLE Farbe - als handgezogener Siebdruck.
DAS PRINZIP DAHINTER (seine Frage: "Was machen wir so wie Aquarell, dass es nicht jeder Idiot
sieht, dass es mit KI gemacht ist"): Aquarell wirkt echt, weil der Stiltext ein MATERIAL mit
seinen Zufaellen beschreibt - Papier, Wasserraender, Koernung, "bare paper is the lightest
value". Ein Text, der eine Abstraktion beschreibt ("mono-line, geometric shapes"), malt die KI in
ihrer eigenen glatten Handschrift, und das sieht jeder. Also fuer jeden Stil: das Verfahren, das
Papier oder den Stoff, die Werkzeuge, und die kleinen Fehler der Hand (Passer, Wackler, ein
Strich, der uebersteht). Bei Minimal und Bleistift gemacht; die uebrigen Stile sind offen.
BLEISTIFT (neu, nur Postkarte): "Kalligraphie, dass es so aussieht, als waer's mit Bleistift
gemalt, auch sehr minimalistisch, jedoch relativ detailgetreu." Recherchiert im Urban Sketching:
grosse Massen zuerst, das Bauwerk sorgfaeltiger als die Umgebung, Detail nur wo es zaehlt, viel
Papier weiss; Graphit in mehreren Haerten, Schraffur statt verwischtem Grau; der Gruss in einer
fliessenden Bleistift-Schreibschrift derselben Hand. Beispiel postkarte/beispiele/bleistift.jpg.
Beide Beispiele mit werkzeug/stilbeispiele.mjs erzeugt - dieselbe Paris-Karte wie alle Stile.

ROBOTIC: seine Karte aus Harmstorf (MO-GRUESSEA-20260926-55R5) hatte zwei Fehler.
1. "was soll ein Foto von einem umgestuerzten Baum auf der Karte" - nachgestellt mit der echten
   Punktsuche fuer Im Dorfe 3: Commons liefert dort genau "Buchenwald im Fruehling Klecker Wald"
   (758 m) und "Die Rotbuche lebt nach dem Sturm" (1117 m, Kategorie "Fallen trees in Germany").
   Beides Naturfotos aus dem Landschaftsschutzgebiet nebenan. Der Punkt bleibt der Schluessel,
   aber Commons sagt in den KATEGORIEN, was ein Bild zeigt: Wiki Loves Earth, Naturschutz,
   Landschaftsschutz, fallen trees, Pilze, Pflanzen, Tiere -> nicht auf eine Ortskarte
   (KEIN_NATURFOTO in standort.js, geoKandidaten liest die Kategorien mit).
2. "wenn schon, muss der Rand einmal komplett rum gehen" - gemessen: links, rechts, unten das
   Band, oben die Titelplatte bis an die Kante. Der Stil bringt HUD-Platten mit, und die hatten
   das Band oben ersetzt. RAHMEN.robotic sagt jetzt ausdruecklich: das Band schliesst auf allen
   vier Seiten, die Titelplatte sitzt INNEN.

"MEIN FOTO IM ORIGINAL" - "und natuerlich Foto Original statt im Stil, sollte auch in der Auswahl
stehen." Der Foto-Weg (foto_modus) war eine versteckte Liste mit einem Eintrag; jetzt ist er eine
sichtbare Kachelwahl im Schritt "Wie sollen die Leute aussehen?": "Im Stil nachgemalt"
(vorbelegt) oder "Mein Foto im Original". Bei Original verschwindet die Figurenwahl (niemand
malt die Leute).
SO IST ES GEBAUT: kein Stufe-1-Malen. Das Foto geht NIE an den Bilddienst - gelernt am 24. Sept.:
gegen gelieferte Pixel verliert jeder Satz; bekaeme das Modell das Foto, malte es die Gesichter.
Der Auftrag (flyerPrompt, fotoOriginal) sagt: kein Bild des Reisenden ist dabei, EIN Feld bleibt
flach magenta (#ff00e6) in der Proportion des Fotos (als Zahl, fotoVerhaeltnis), niemand wird
gemalt, die Karte wird um das Feld herum gebaut. Nach dem Bild wird die Magenta-Flaeche GEMESSEN
(platzhalterFinden, groesste INSEL allein; findHole misst Alpha und faende auf einer
vollflaechigen Karte nichts). Das Foto kommt erst nach dem "Ja, so ist es gut" des Kunden hinein
(designFreigeben) - die Vorschau zeigt es schon drin, im Arbeitsspeicher zusammengesetzt. Wird
keine Magenta-Flaeche gefunden, steht der Befund am Auftrag (job.fotoFlaeche.gefunden = false)
und das Foto kommt in die Mitte; der Kunde sagt Nein.
GEMESSEN am 27. Sept. mit dem Bilddienst (Harmstorf, Robotic, Ortskarte als Vorlage):
- Eine flache Magenta-Flaeche als EINGANGSBILD weist der Sicherheitsfilter ab (400, "rejected by
  the safety system") - zweimal, reproduzierbar. Mit der ORTSKARTE als Eingangsbild geht dieselbe
  Bestellung durch, und das Modell malt das Magenta-Feld sauber aus dem Text heraus: 52 % breit,
  4:3, links, Rand rundum geschlossen, Karte mit Nadel, Ortstafel, Unterschrift. Also ist Bild 1
  die Ortskarte (originalEingang64), sonst ein neutraler heller Karton - nie das Foto.
- platzhalterFinden nahm mit seiner Nachbarschaftsregel den rosa Punkt der Ortskarte in den
  Kasten (68 % statt 52 %, Deckung 0,66). Fuer ein Logo ist die Regel richtig (getrennt gemalte
  Buchstaben), fuer ein Foto-Feld nicht: es liefert jetzt zusaetzlich `insel` (groesste Insel
  allein), und die Postkarte nimmt die.
NOCH OFFEN: die Karte MIT eingesetztem Foto am lebenden Objekt ansehen (Vorschau, "Ja"-Weg).
Weitere eigene Fotos (2-5) werden bei Original weiter GEZEICHNET - nur Foto 1 kommt als Foto.
Wenn Markus alle im Original will, ist das ein eigenes Thema.

DOPPELTE KOORDINATEN (Markus, 27. Sept., Graffiti-Karte aus Harmstorf): "die Koordinaten links
und rechts einmal doppelt". Die Textliste bestellte die Zeile, der Kartenabsatz bestellte sie
noch einmal in die Kartusche - zwei Absaetze, dieselbe Zeile, das Modell malt beides. Mit
Ortskarte gehoeren Koordinaten und Datum jetzt NUR in die Kartusche (firmen-flyer.js, zeilen).

DIE ARTIKELFASSUNG (Markus, 27. Sept.): "auf alle weiteren Artikel stimmt das Mass hinten und
vorne nicht" - gemessen an MO-GRUESSEA-20260927-H5NW: die Karte (14,8 x 10,5, mit Rand) wurde
1:1 auf Poster, Tasse, Acrylbild gelegt; graue Streifen auf dem Acrylbild, angeschnittener Rand
auf der Tasse. Seine Antwort: "Wir muessen doch nur den Prompt ein bisschen schaerfen, wie es
zum Beispiel auf die Tasse kommt, wie es aufs Poster kommt." GEBAUT wie das Social-Hochformat:
artikelfassung.js traegt je Teil EINEN Absatz (Tasse: ein breiter Streifen, die Elemente
nebeneinander, die Enden frei; Poster/Acryl/Tuerschild: gestapelt) und die Leinwand im echten
Verhaeltnis der Druckflaeche. Der Server (artikelFassung) schickt den fertigen Karten-Master
mit dem Karten-Auftrag plus Zusatz an den Bilddienst - NUR auf Anfrage (die Seite haengt
?fassung=1 an, sobald der Kunde das Teil antippt), einmal je Design und Teil, Datei in
storage/fassungen. Die Kacheln in der Reihe zeigen bis dahin die alte 1:1-Ansicht; wer alle
vier vorbauen will, zahlt vier Bilder je Karte - das ist Markus' Entscheidung, nicht meine.
ENTSCHIEDEN (Markus, 27. Sept.): "Vielleicht wuerde da auch einfach ein Hinweis reichen, dass,
wenn jemand explizit Poster oder Aehnliches moechte, man dann einen genauen Designdurchlauf
braucht - und erst mal nur die Voransicht macht, so dass die Leute wissen." Also KEIN Bauen von
selbst: der Tipp auf Poster zeigt den schnellen Blick, darunter "Das ist nur ein Blick ... ein
Poster braucht einen eigenen Design-Durchlauf" und den Knopf "Fuer das Poster neu aufbauen - ca.
1 Minute". Erst der Knopf haengt ?fassung=1 an; danach steht "Fuer das Poster neu aufgebaut - so
wird es gedruckt", und die Kachel traegt "passt". Der Hinweis je Teil (fassungHinweis) kommt vom
Server mit den Mockups (job.mockups[g].fassung), nur bei Karten mit Karten-Auftrag.
GEMESSEN am 27. Sept. mit dem Bilddienst (Testkarte Harmstorf/Robotic): Tassen-Streifen und
Poster kommen genau so, wie der Absatz es bestellt - nichts gequetscht, Rand rundum, alle Texte
einmal.
OFFEN: die Druckdatei fuer eine BESTELLTE Tasse/Poster aus einer Postkarte ist weiter der
Karten-Master (/api/mo/master liefert nur PRINT); die Fassung muesste dort mitgeliefert werden.
"ES GIBT JA NOCH GAR KEINE MOEGLICHKEIT, FOTOS HOCHZULADEN" (Markus, 27. Sept.): stimmte. Nach dem
ERSTEN Foto setzte die Seite fotoAnzahl nie und rief pkMehrZeigen() nicht - der Block "+ Weitere
Fotos dazu (bis zu 4)" war seit dem 26. Sept. fuer immer versteckt; nur der Server und der
Auftrag waren geprueft, kein Browser hatte je ein zweites Foto nachgeladen. Lehre wie beim
Bewertungsschalter: WAS DIE SEITE ZEIGT, PRUEFT NUR EIN BROWSER. Jetzt laedt die Browser-Abnahme
wirklich Dateien nach (1 -> 3 -> 5, bei fuenf ist Schluss).
"WARUM KANN ICH IMMER NOCH NICHT MEHR FOTOS AUSWAEHLEN?" - "UND TEILEN. FUER SOCIAL MEDIA FINDE ICH
AUCH NICHT." (Markus, 27. Sept., kurz nach dem Deploy von bf0409f). LIVE NACHGESTELLT mit einer echten
Karte im iPhone-Browser (Playwright ueber den Proxy, ignoreHTTPSErrors): "Karte teilen", "Als echte
Postkarte verschicken" und "Als Beitrag ins Netz" stehen alle unter der fertigen Karte. Der Server
lieferte die richtige Fassung (?v= der Seite == sha1 von main). Also lief SEIN Reiter noch mit dem
Skript von VOR dem Deploy - ein Reiter, der seit gestern offen ist, laedt nicht von selbst neu; das
Skript liegt ein Jahr im Speicher, und die Seite hing noch an der alten Adresse. Drei Symptome, eine
Ursache. Zwei Dinge daraus:
(1) Die Seite fragt beim Zurueckkommen (visibilitychange, pageshow) /api/mo/fassung (no-store) und
laedt sich neu, wenn noch nichts angefangen ist (kein Foto, keine Vorschau, kein Lauf, keine Karte,
touched !== '1' - Achtung: dataset.touched ist die ZEICHENKETTE '0', also wahr); sonst nur der Kasten
#neue-fassung mit Knopf. Die Mottoseite selbst traegt Cache-Control: no-cache (ETag-Nachfrage).
(2) Der Knopf "+ Weitere Fotos dazu" kam erst mit der Antwort des Servers (live gemessen: 3,5 s
Erkennung plus Hochladen vom Handy) - und "Foto verwenden" stand laengst da; wer tippt, ist weiter,
bevor der Knopf je erschien. Jetzt: der Galerie-Waehler hat multiple (das erste ist das Selfie, der
Rest wartet in fotoWarteschlange, bis der Server das erste angenommen hat, und geht dann an dieselbe
Sitzung), der Knopf steht ab der Vorschau da, ein neues erstes Foto leert Sitzung und Warteschlange.
Die Browser-Abnahme waehlt zwei Dateien auf einmal, prueft den Hinweis-Fall und den Neulade-Fall.
ZUSAMMENGEFUEHRT am 27. Sept. mit bc221f3 (Zweig weitere-fotos-am-ort, anderer Chat): der Block
"+ Weitere Fotos dazu" wohnt im Schritt "Wo bist du?" (pkMehrPlatz, aus refresh()), Ueberschrift je
Lage (Privatadresse, Firma, eigene Fotos an der Sehenswuerdigkeit), an der Sehenswuerdigkeit selbst
ohne Knopf. Beides gilt zusammen: Mehrfachauswahl im Galerie-Waehler + Warteschlange (hier) und der
Platz im Ortsschritt (dort). Die Abnahme laeuft den echten Weg: zwei Fotos waehlen, "Foto verwenden",
im Ortsschritt "2 Fotos sind da", dann 3, dann 5.
KEIN WASSERZEICHEN BEIM VERSCHICKEN, LINK BEIM TEILEN (Markus, 27. Sept.: "Wenn Postkarten verschickt
werden, dann sollte natuerlich nicht das Wasserzeichen drauf sein, und wenn wir das Teilen per
WhatsApp machen, dann muss natuerlich ein Link drauf sein zum motto-otto.de" - "Also kein
Wasserzeichen, weil jetzt ist ja schon drauf"). Befund: "Karte teilen" und "Als Bild speichern"
nahmen die VORSCHAU (800 px, zweimal "MOTTO OTTO - VORSCHAU" quer drueber). Die Druck-PDF der
echten Postkarte nahm schon immer den Master (druckPdf(masterLesen)), da war nie ein Wasserzeichen.
Jetzt: teilenJpg (postkarte-rueckseite.js) = Master ohne Wasserzeichen, 1400 breit, darunter eine
weisse Zeile "motto-otto.de" (fett) und "Mach dir deine eigene Karte"; JPEG (PNG waere mehrere MB).
Der Link dazu (/api/mo/teilen/<id>.jpg, signiert wie die Vorschau, no-store) kommt als "teilen" mit
dem fertigen Auftrag; nur Mottos mit teilen: true. Bei "Mein Foto im Original" vor dem "Ja" wird das
Foto wie in /foto/vorschau nur im Arbeitsspeicher eingesetzt (410, wenn es weg ist). Der Teilen-Text
traegt https://www.motto-otto.de - WhatsApp auf dem iPhone laesst den Begleittext bei Bildern oft
weg, deshalb steht die Adresse AUF dem Bild. Die Vorschau auf der Seite behaelt das Wasserzeichen.
"DAS DESIGN IST ABGESCHNITTEN" (Markus, 27. Sept., Konto, Panorama-Karte "klogschieder" MO-GRUESSEA-
20260927-RV7E): NACHGEMESSEN am Master (2738x1407): Gruss und "Anne" laufen rechts aus dem Bild, die
Frau links angeschnitten. Railway-Log des Laufs: "Bild 1/3 2400x1072", dann "makeMaster: auf
2736x1408 gebracht". Ursache: das Bild wurde im INNENMASS bestellt (Karte minus 12 % Rand, seit dem
22. Sept. fuer den vom Server gezeichneten Rand), aber seit dem 23. Sept. zeichnet die Bild-KI den
Rahmen selbst (flyerPrompt) und randZeichnen laeuft nur noch OHNE flyerPrompt - der Rand kam also nie
dazu, und makeMaster hat das 2,24:1-Bild per Zuschnitt (fit cover) auf 1,94:1 gebracht: 13 % der
Breite weg. Bei A6 quer waren es 8 % (1616x1072 auf 1952x1408). Jetzt: Innenmass nur, wenn der Rand
wirklich vom Server kommt (randWirdGezeichnet prueft !job.flyerPrompt) - mit flyerPrompt wird die
ganze Karte bestellt (2736x1408, 1952x1408, 1408x1952). LEHRE: wer eine Stufe abschaltet (Rand vom
Server), muss ALLE Stellen finden, die dafuer gerechnet haben - das Innenmass stand 4 Tage lang
falsch, und die Abnahme hat nur Prompt und Groessenlogik einzeln gesehen, nie "bestellt vs. Master".
"ZEIGT ES AUF DEM T-SHIRT, OBWOHL ES EINE POSTKARTE IST" (Konto): /api/mo/me gibt je Design den
Artikel und karte:true mit; die Kontoseite zeigt eine Karte als Karte, ohne Teil- und Farbwahl.
NACHTRAG (Markus, 27. Sept., 17:18: "Design erhalten ... geht auf, aber es ist nichts zu sehen.
Wenn du drauf klickst, kommst du aufs Motiv"): Railway-HTTP-Log - er war eingeloggt, die Mail
fuehrte direkt auf /konto; die Kachel der frischen Karte 73V9 blieb leer, weil das Konto WEITER
das T-Shirt-Mockup holte (28 s, Browser gab auf, HTTP 499); der Tipp auf die Kachel geht auf die
Vorschau. Ursache: die Design-Datei storage/jobs/<designId>.json traegt den Artikel OBEN
(artikel), nur der laufende Auftrag hat input.artikel - die erste Fassung las nur input.artikel.
LEHRE: readJob(designId) liefert die GESPEICHERTE Form, nicht den Auftrag im Speicher; wer Felder
daraus liest, prueft sie an einer Datei in storage/jobs, nicht am Auftrag.
GEN.B64 GAB ES NIE: editViaBallz liefert { png, url } (ballz.js pullImage). Artikelfassung (7288) und
Social-Bild (7345) lasen gen.b64 - im Log vom 27. Sept., 13:51: "Social-Bild: ... The first argument
must be of type string or an instance of Buffer ... Received undefined". Beide Wege waren am
Bilddienst gemessen, aber NIE durch den Server gelaufen. Jetzt gen.png; die Abnahme verbietet gen.b64.
"EIGENTLICH WAR AUCH NUR EINE PERSON AUF DEM FOTO" (dieselbe Karte, zwei Personen gemalt): NICHT
nachpruefbar - das Foto liegt nur eine Stunde im Speicher, das Log traegt nur das Motivwort
("selfie") und den Hintergrund ("Terrasse und Garten ... Fahrrad"). Der Auftrag verbietet ausdruecklich,
eine Person dazuzuerfinden (fotos.js: "never add a person who is not in the photo"). Zum Nachstellen
braucht es das Foto.
GEMESSEN am 27. Sept. mit dem Bilddienst (drei Testfotos: Paar vorm Backsteinhaus, Garten,
Kaffeetisch; Privatadresse Harmstorf, Aquarell, Auftrag woertlich wie der Server ihn baut): jedes
Foto bekam sein eigenes Feld, keins wiederholt, keins erfunden, Karte mit Nadel, Koordinaten und
Datum nur in der Kartusche, Rand rundum. Der Absatz "HOW MUCH THERE IS TO WORK WITH" zaehlt bei
nurEigene weiter nur "the person (image 1)" - das Modell hat es trotzdem richtig gemacht; wenn
einmal ein Foto fehlt, ist das die erste Stelle zum Nachsehen.
DIE MOTIVERKENNUNG, GEMESSEN (Markus, 27. Sept.: "probiere das bitte einmal aus mit Fotos mit
Essen und dann so ne Food-Karte, und wenn jemand im Garten Fotos macht, dann ne florale
AUTO, MOTORRAD, FAHRRAD (Markus, 27. Sept.: "wenn jemand ein Foto macht mit seinem Auto, dann
irgendwie was passend zum Auto ... Motorrad ... Fahrrad"): drei Worte mehr in der festen Liste
(FOTO_INHALT_FRAGE), drei Saetze mehr in MOTIV_THEMA - Strasse und Route als Motiv, das Fahrzeug
EXAKT wie im Foto, kein zweites erfunden, kein Markenlogo, das nicht im Foto steht. Der Mensch
neben seinem Auto ist "auto", nicht "selfie": das Fahrzeug ist der Grund fuer das Foto.
GEMESSEN am 27. Sept. (Mann mit Motorrad + Motorrad an der Landstrasse, Aquarell): beide Fotos je
in ihrem Feld, das Motorrad in beiden dasselbe (Farbe, Form, Satteltasche), Karte mit Nadel,
Kartusche einmal, Rand rundum. Die Tour-Deko (Strasse am Rand) blieb zurueckhaltend - die
Landstrasse steckt schon in den Fotos. Auto und Fahrrad noch nicht am lebenden Objekt gemessen.
DER RAHMEN ALS MOTIV (Markus, 27. Sept., zur ersten Motorrad-Karte): "Aber vielleicht koennen
wir ja irgendwas Passendes zum Motorrad in den Rahmen machen, genauso im Auto - so wie bei dem
Floralen." Und genauer: "irgendwas, das nicht zu dem Auto auf dem Bild, sondern im Allgemeinen
passt - obwohl es auch cool sein koennte, was aus dem Auto rauszunehmen; muessen wir probieren."
Also: der Rand traegt das ALLGEMEINE Motiv (Strasse mit Mittellinie bei Auto und Motorrad,
Radweg mit Routenlinie beim Fahrrad, Ranken bei Blumen), die Farben kommen aus dem Fahrzeug im
Bild. Gemessen, warum es beim ersten Mal ausblieb: der Rahmen-Absatz in flyerPrompt bestellt
"ruhig, kein Muster" und gewinnt gegen "am Rand entlang". Jetzt traegt jedes Thema, das den Rand
meint, woertlich "THE FRAME BAND ITSELF", und flyerPrompt nimmt daran erkennbar die Ausnahme in
den Rahmen-Absatz auf (themaImRand) - nur dann; Essen und Feier lassen den Rand ruhig.
GEMESSEN (Motorrad, Aquarell, mit dem freigegebenen Harmstorfer Wappen als Vorlage, wie live):
Rand = Strasse mit gestrichelter Mittellinie, Kurvenschild oben rechts, Kilometerstein unten
links; Wappen exakt und vollstaendig; beide Fotos je in ihrem Feld; Kartusche mit Kompass.
Markus dazu: "Harmstorf hat ein freigegebenes Wappen" - live kommt es immer mit (wappenUrl im
Bildplan, auch bei der Privatadresse); nur meine ersten Testauftraege hatten es weggelassen.
Geschichte"): Selfie am Gartentisch + Bratwurstteller + Pflaumenkuchen -> Motive
[essen_mit_leuten, essen, essen] -> "essen" -> FOOD CARD: warme Toene, Kraeuterzweig, Kruemel
um die Felder, jedes Foto in seinem Feld. Selfie im Garten + Gartenweg + Dahlien -> [selfie,
blumen_garten, blumen_garten] -> "blumen_garten" -> FLOWER CARD: Blueten und Ranken am Rand und
zwischen den Feldern, Farben aus den Blumen. Beides so, wie MOTIV_THEMA es bestellt; kein
zweites Motiv erfunden. Und seine Regel dazu, woertlich: "Wenn jemand drei Fotos auswaehlt,
nehmen wir drei. Fuenf, dann fuenf. Nur ein Foto, dann nur ein Foto." Genau so ist es gebaut -
die Zahl der Felder ist die Zahl der Fotos, nie mehr, nie weniger.

DER BEITRAG FUERS NETZ AUF DER SEITE (Markus, 27. Sept.: "was ist mit dem Social Media Post?" -
"Ja"): der Server war seit dem 23. Sept. fertig (/api/mo/social, /api/mo/social/nachweis), der
Kasten auf der Ergebnisseite hat gefehlt. Jetzt unter der fertigen Postkarte: "Als Beitrag ins
Netz - und 5 Credits dafuer", Knopf "Beitrag machen" -> Hochformat-Bild, Text mit #mottootto
vorn, "Text kopieren", "Bild speichern"; darunter das Link-Feld "Gepostet? Der Link zu deinem
Beitrag" -> "Pruefen und Credits holen" mit den drei Ergebnissen (ja mit Credits und Kontostand,
nein mit Grund, unpruefbar: "Wir schauen selbst nach"). Nur zum Kopieren, wie entschieden.
DABEI GEFUNDEN (Browser-Abnahme, 27. Sept.): motto-seite.js hatte ZWEI Funktionen drawTeilen im
selben Geltungsbereich - die Teilen-Zeile mit der Rueckseite und den Bewertungsschalter
drawTeilen(b). Die spaetere Deklaration gewinnt; drawResult rief seither den Schalter mit
undefined, und "Karte teilen" sowie "Als echte Postkarte verschicken" wurden auf der
Ergebnisseite nie mehr eingeblendet (Markus' Screenshot vom 27. Sept.: beide fehlen). Jetzt
drawTeilenKarte, und die Abnahme zaehlt doppelte Funktionsnamen im Seitenskript.

"Beim Bewerten wird gerade kein Bild gezeigt": am 27. Sept., 08:50 UTC lieferten alle 24 Bilder
der Bewertungsliste HTTP 200 - nicht reproduziert; naechster Schritt ist ein Fehler-Ereignis am
<img> der Bewertungsbox, damit die Seite meldet, WELCHE Adresse nicht lud.

MAX_FELDER (mottos.js): die Postkarte hat jetzt 17 Felder. Die Grenze stand bei 16, und
abgeschnitten wurde `foto_modus` - das Feld, das das Nachmalen des Selfies steuert. Die
zweistufige Karte waere lautlos verschwunden; die Warnung stand in den Logs, nicht in der Abnahme.
Jetzt prueft die Abnahme die ZAHL der Felder, nicht nur einzelne Namen. Wer ein Feld dazunimmt,
sieht sofort, ob es durchkommt.

## Sachkunde: erst nachsehen, dann zeichnen (Markus, 22. Sept., zum Bowling)
"Da sind nicht neun, da sind glaub ich zehn Pins, bitte recherchieren" - und "die Kugel ist anders".
Er hatte recht. Bei jedem Motto, das eine echte Sportart, ein Handwerk oder ein Geraet zeigt, gilt:
vorher nachschlagen, dann in den Auftrag schreiben, was stimmt, und die Abnahme darauf festnageln -
sonst faellt es beim naechsten Neuzeichnen wieder zurueck.
- Bowling ist Ten-Pin, nicht Kegeln: ZEHN Pins im gleichseitigen Dreieck aus vier Reihen
  (1-2-3-4, Kopfpin zum Spieler, Mitten 12 Zoll auseinander), Pins weiss mit zwei roten
  Halsringen, 15 Zoll hoch. Die Kugel ist gross (rund 21,6 cm), glaenzend, farbig/marmoriert und
  hat DREI Bohrloecher: zwei Fingerloecher dicht beieinander, das Daumenloch etwas abgesetzt.
- "Alle Neune" gehoert zum Kegeln (neun Pins, Raute, lochlose Handkugel) und hat im Bowling
  nichts zu suchen - im Motto heisst der Vorschlag "Alle Zehn". Beim Motto kegeltour bleibt
  "Alle Neune" und "Gut Holz!" natuerlich richtig.
- Quellen: Wikipedia "Bowling pin", "Bowling ball", "Nine-pin bowling"; dimensions.com Pin Deck.
  Die Abnahme (abnahme-postkarte.mjs, Abschnitt Motto-Kacheln) misst Auftrag, Kugel und dass
  "Neune" nirgends mehr im Bowling-Motto steht.
