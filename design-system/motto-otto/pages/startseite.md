# Startseite - Seitenregeln (ergaenzt MASTER.md)

Stand: 1. Oktober 2026. Datei: `home-neu.html`, seit Markus' "uebernehmen" (1. Okt.) die Startseite `/`.
Die alte Fassung (home.html) steht zum Vergleich unter `/startseite-alt` (noindex).

## Aufgabe der Seite

Ein Besucher am Handy soll in einem Bildschirm verstehen, was Otto tut, und sofort sein Motto
finden. Erklaert wird nur, was zum Losgehen noetig ist; den Rest hat /so-gehts.

## Aufbau (von oben nach unten)

```
Handy (375)                          Laptop (ab 900)
+-----------------------------+      +--------------------------------------------+
| Logo          Konto         |      | Logo   Mottos So geht's Firmen Event Konto |
| Mottos So geht's Firmen Ev. |      +--------------------------------------------+
+-----------------------------+      | H1 Sag Otto, dein Motto.   |  [Otto-Logo   |
| [Otto-Logo als Aufkleber]   |      | Satz                       |   als grosser |
| H1 Sag Otto, dein Motto.    |      | [Suche............]        |   Aufkleber]  |
| Satz                        |      | (Abi)(JGA)(Malle)...       |               |
| [Suche.................]    |      +--------------------------------------------+
| (Abi)(JGA)(Malle)(...)      |      | Das hat Otto gezeichnet  < >               |
+-----------------------------+      | [Bild][Bild][Bild][Bild][Bild] ->          |
| Das hat Otto gezeichnet     |      +--------------------------------------------+
| [Bild][Bild]->  (wischen)   |      | Hervorgehoben (highlight / membersOnly)    |
+-----------------------------+      +--------------------------------------------+
| Hervorgehoben               |      | Alle N Mottos  (4 Spalten)                 |
+-----------------------------+      +--------------------------------------------+
| Alle N Mottos (2 Spalten)   |      | So laeuft es: 1 2 3 4 (4 Spalten)          |
+-----------------------------+      +--------------------------------------------+
| So laeuft es 1-4            |      | Fusszeile                                  |
| Fusszeile                   |
```

Links ausgerichtet, nichts zentriert ausser dem Logo am Handy.

## Daten (alles aus dem System, nichts hart eingebaut)

- Mottos: `GET /api/mo/mottos` (dieselbe Liste wie die Mottoseiten). Anzahl, Namen, Akzentfarbe,
  `highlight`, `freestyle`, und - falls vorhanden - `membersOnly`.
- Motto-Bild: `/api/mo/motto-kachel/<slug>.jpg`, faellt zurueck auf `/api/mo/sample/<slug>.jpg`,
  sonst Buchstabe auf der Akzentfarbe.
- Galerie: `GET /api/mo/showcase?mode=rate&limit=40&vielfalt=1` - derselbe Aufruf wie in home.html.
  Bild, Motto, Stil, Teil, Ziel-Link je Design.
- Teil-Namen und "ab"-Preis: `/preise.js` (`window.MoPreise.label`, `MoPreise.TEXTIL`).
- Otto in drei Haltungen: `/api/mo/otto/nimmt-auf.png`, `zeichnet.png`, `jubelt.png`.

## Design Edition

Taucht in der Motto-Liste ein Eintrag mit `membersOnly: true` auf, steht er als eigene,
schwarze Flaeche ueber allen anderen Hervorhebungen ("Exklusive Linie"). Der Name kommt aus den
Daten - "Design Edition" ist nur der Arbeitstitel. Ohne solchen Eintrag faellt der Block weg.
Stand 1. Okt.: in /api/mo/mottos gibt es keinen solchen Eintrag (gemessen: 29 Mottos, keins mit
membersOnly).

## Ablauf, wie er heute wirklich ist

1. Motto waehlen, ein paar Felder ausfuellen (Motto, Ort, Jahrgang; Logo und Namensliste nach Wunsch).
2. Otto zeichnet - meist in unter fuenf Minuten. Erster Entwurf ohne Konto, fuenf weitere nach
   Anmeldung mit E-Mail (ohne Passwort), jeder weitere 1 EUR, der beim Kauf verrechnet wird.
3. Gemeinsam abstimmen: Link herumschicken, Sterne und Kommentare.
4. Anfrage schicken: Produkt, Menge, E-Mail - wir melden uns. Einen Warenkorb gibt es noch nicht.
   Lieferzeit 4-5 Arbeitstage nach vollstaendiger Bezahlung.

## Bewegung

Ein Moment: Otto springt beim Laden einmal auf die Seite (0,55 s, nur Groesse und Deckkraft - das Logo selbst bekommt keinen Effekt). Sonst nur
Antworten auf Tippen. Die Galerie bewegt sich nur, wenn man wischt oder die Pfeile drueckt.

## Neu am 1. Okt. (Markus): Postkarte als Einstieg, Textil als Ziel, Abstimmung als Highlight

Markus: "Das Thema mit den Postkarten soll der Einstieg werden, weil da die geringste Huerde ist."
Und: "nicht die Leute denken, wir machen nur Postkarten, weil unser Hauptgeschaeft sind natuerlich
Textilien ... die goldene Mitte zu finden". Und zur Abstimmung: "das muessen wir ausarbeiten als
Mega Highlight" - "wenn ich was fuer mich alleine mache, brauche ich keine Abstimmung."

Reihenfolge der Seite (gilt ab jetzt):
1. AUFMACHER - "Selfie rein. <Wort> raus." (das Wort wechselt durch T-Shirt, Hoodie, Kissen, Poster,
   Beutel, Strandtuch), ein Satz, Knopf "Zu den Shirts" (#gruppe) und "Kissen, Poster und mehr" (#artikel).
   (Bis 12. Okt. 2026 stand hier die Postkarte - sie ist nicht mehr Teil von Motto Otto.)
2. SHIRTS FUER EURE GRUPPE (gruen) - echte Designs auf Textil aus der Galerie, Suche, Schnellwahl.
3. ABSTIMMUNG UND KONSENS (schwarz, "Fuer Gruppen") - Link in die Gruppe, Sterne und Kommentare,
   Otto zeichnet den Konsens. So steht es im Code (abstimmung.js, consensusDesign).
   NICHT auf der Seite: "gibt es weltweit noch nicht" - eine Alleinstellung muss belegbar sein.
4. UND FUER JEDEN ARTIKEL EIN EIGENES DESIGN - Galerie ohne Textil (Tasse, Kissen, Poster ...).
5. Alle Mottos, So laeuft es, Fuss.

Preis-Satz (Markus, 1. Okt.): digital verschicken ist kostenlos, solange es eines der freien Designs
ist; als echte Postkarte per Post nicht kostenlos.
