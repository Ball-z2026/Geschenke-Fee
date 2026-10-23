# Audit der bestehenden Startseite (home.html, ausgeliefert unter /)

Stand: 1. Oktober 2026, gemessen an https://www.motto-otto.de/ im Headless-Chromium bei 375 x 800 px
(iPhone-Breite). Jede Zeile traegt das Messergebnis; was nicht gemessen werden konnte, steht unten
unter "Nicht nachgestellt".

## Probleme

1. **Die Farbwelt kommt nicht aus dem Logo.** Seite: Dunkelgrund `#111017` mit Gelb `#ffc542`.
   Logo: Gruen `#77C500`, Magenta `#E9166A`, Creme `#F6EDDD`, schwarze Kontur. Weder Gruen noch
   Magenta tragen die Seite; das Gelb kommt im Logo nicht vor.
2. **Die Suche steht zu tief.** Das Suchfeld "Zu welchem Motto?" beginnt bei 1.212 px - also erst
   auf dem zweiten Handy-Bildschirm. Davor: Aufmacher mit zwei Karten, eine zweite Ueberschrift
   ("Finde deinen Anlass.") und die Otto-Vorfuehrung.
3. **Zwei Ueberschriften-Bloecke uebereinander.** "Sag Otto, dein Motto." (Aufmacher) und direkt
   darunter "Finde deinen Anlass." - zwei Anfaenge auf einem Weg.
4. **Drei H1 im HTML.** Gezaehlt: 3 (`Sag Otto, dein Motto.`, `So geht's`, `Alle Mottos`). Je nach
   Unterseite per Klasse versteckt, im Quelltext aber alle drei da.
5. **Die Liste der Mottos beginnt erst bei 3.296 px**, die Seite ist 7.679 px hoch. Dazwischen
   steht unter anderem eine 20-zeilige Preisliste aller Artikel - auf der Startseite, obwohl es
   dafuer /so-gehts gibt.
6. **Die Navigation ist am Handy abgeschnitten.** `nav`: scrollWidth 375 px bei 296 px sichtbarer
   Breite - "Event" steht nur noch als "Eve" da, "Konto" ist ganz rechts aus dem Bild. Wischen
   geht, sieht aber niemand.
7. **Schwere Bilder fuer kleine Kacheln.** Motto-Kachel `hochzeit.jpg` 166 kB, `abi.jpg` 214 kB,
   angezeigt bei rund 160 px Breite; Galerie-Mockup 157 kB je Stueck. Gemessene Uebertragung bis
   zum `load`-Ereignis: 2,76 MB.
8. **Viele gesperrte Versal-Etiketten.** 19 sichtbare Elemente mit `text-transform: uppercase`
   ("AUFGABE", "FEIERN & REISEN", "DAS SIND ALLE 20 ARTIKEL" ...) - Schablonen-Optik.
9. **Zeichen statt Icons.** Die Lupe im Suchfeld ist das Schriftzeichen `⌕`; an Links haengen
   Pfeile als Text (`→`, `↓`, `‹`). Haengt von der Schrift des Geraets ab.
10. **Dauerbewegung.** Die Galerie "Das hat Otto gezeichnet" laeuft als zwei gegenlaeufige
    Endlosbaender; dazu die animierte Otto-Vorfuehrung im Kopf. Mehr als ein Bewegungsmoment.
11. **Fusszeile ohne Konto und mit "AGB" statt "Nutzungsbedingungen".** Beide Adressen liefern
    dieselbe Seite; der Konto-Zugang steht nur oben.

## Was gut ist und bleiben soll

- Inhalte kommen echt aus dem System (Motto-Liste, Galerie aus freigegebenen Auftraegen,
  Preise aus preise.cjs) - nichts erfunden. Strukturierte Daten ohne Fake-Bewertungen.
- Schriften liegen im eigenen Haus (Anton, Archivo), mit Vorladen.
- Die Motto-Kacheln sind serverseitig fertiges HTML (gut fuer Google).
- Bei 375 px kein seitliches Scrollen der Seite (scrollWidth 375 == clientWidth 375).

## Nicht nachgestellt

- Im Headless-Browser dieser Sandbox luden die Motto-Kacheln und Galerie-Bilder nicht
  (`net::ERR_TOO_MANY_RETRIES` am Proxy der Sandbox). Mit `curl` liefern dieselben Adressen
  HTTP 200. Das ist ein Problem der Messumgebung, KEIN Befund ueber die Seite.
- Ladezeit auf einem echten Handy im Mobilfunk - nicht messbar von hier.
