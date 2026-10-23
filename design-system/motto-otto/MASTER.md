# Motto Otto – Designsystem (MASTER)

Stand: 1. Oktober 2026. Gilt ab jetzt fuer ALLE Seiten von Motto Otto. Wer eine Seite baut oder
umbaut, liest diese Datei zuerst; Seiten-Ausnahmen stehen in `pages/<seite>.md` und schlagen
diese Datei nur dort, wo sie es ausdruecklich sagen.

**Entstehung:** Der Auftrag sah vor, diese Datei mit dem Skill "UI UX Pro Max" zu erzeugen und
dann gegen die festen Vorgaben zu pruefen. Der Skill konnte in dieser Sitzung nicht installiert
werden (die Sandbox hat Skills aus Fremdquellen gesperrt). Die Datei ist deshalb von Hand
geschrieben - direkt aus den festen Vorgaben und aus GEMESSENEN Werten (Logo-Farben, Kontraste).
Kommt der Skill spaeter dazu, wird sein Vorschlag gegen DIESE Datei geprueft, nicht umgekehrt.

## 1. Feste Vorgaben (nicht verhandelbar)

- Das Logo **/logo.png** (Otto mit Schirmmuetze und Daumen hoch) bleibt unveraendert. Es wird
  nie nachgezeichnet, umgefaerbt, beschnitten oder mit Effekten belegt.
- Die Farbwelt kommt AUS DEM LOGO, nicht aus einer Farbdatenbank.
- Sprache Deutsch. Ansprache wie auf der bestehenden Seite: "ihr" an die Gruppe, "du" im
  Einzelfall, Otto spricht in der Ich-Form nur, wo es schon so steht. Kurze Saetze, keine
  Werbefloskeln.
- Zielgruppe: Gruppen - JGA, Abi, Vereine, Firmen, Handwerker - die meist AM HANDY bestellen.
  Jede Seite wird zuerst fuer 375 px gebaut und erst dann breiter.
- Nichts versprechen, was die Seite nicht kann (Stand 1. Okt.: kein Warenkorb, bestellt wird per
  Anfrage). Keine erfundenen Bewertungen, Kundenzahlen, Siegel oder Preise. Preise nur aus
  `preise.cjs` (/preise.js, `window.MoPreise`).

## 2. Farben (gemessen aus logo-vektor/MottoOtto-Logo-farben.md)

| Token | Hex | Herkunft im Logo | Rolle |
|---|---|---|---|
| `--papier` | `#F6EDDD` | Schriftzug "OTTO" | Seitengrund |
| `--tinte` | `#000000` | Kontur um alles | Text, Konturen, harte Schatten |
| `--gruen` | `#77C500` | Kreis, Schriftzug "MOTTO" | Hauptflaeche, Hauptknopf |
| `--magenta` | `#E9166A` | Muetze, Spritzer | Markierung, Deko-Flaeche |
| `--beere` | `#AF0D6D` | Brusttasche | Links und Akzenttext auf Papier |
| `--haut` | `#F9D9A7` | Gesicht, Hand | ruhige Zweitflaeche |
| `--hemd` | `#E1E2E3` | T-Shirt | Bildgrund hinter Mockups |
| `--text2` | `#4A4136` | (abgeleitet, warm) | Nebentext |

GEMESSENE KONTRASTE (WCAG, gerechnet am 1. Okt.):

| Paar | Kontrast | Erlaubt fuer |
|---|---|---|
| Tinte auf Papier | 18,1 : 1 | jeder Text |
| `--text2` auf Papier | 8,6 : 1 | Nebentext |
| Tinte auf Gruen | 9,8 : 1 | Text auf gruenen Knoepfen und Flaechen |
| Beere auf Papier | 5,8 : 1 | Links, Akzenttext |
| Weiss auf Beere | 6,8 : 1 | Text auf beerenfarbenen Flaechen |
| Tinte auf Magenta | 4,8 : 1 | Text auf Magenta (nur fett, ab 14 px) |
| Weiss auf Magenta | **4,39 : 1** | **VERBOTEN** fuer Text |
| Magenta auf Papier | **3,8 : 1** | **VERBOTEN** fuer Text, nur Flaeche/Linie |
| Gruen auf Papier | **1,85 : 1** | **VERBOTEN** fuer Text, nur Flaeche mit Kontur |

Regeln:
- Gruen und Magenta sind FLAECHEN, nie Schriftfarbe auf Papier.
- Keine Verlaeufe zwischen Logo-Farben, keine lila/rosa KI-Verlaeufe, keine Glas-Effekte.
- Eine Seite hat eine Hauptfarbe pro Bildschirm. Gruen ist "los geht's", Magenta ist "schau her".
- Die Akzentfarbe je Motto (`accent` aus /api/mo/mottos) darf als kleiner Punkt oder Streifen
  vorkommen, nie als Textfarbe.

## 3. Form: der Aufkleber

Das Logo ist ein gestanzter Sticker: alles hat eine kraeftige schwarze Kontur. Daraus folgt die
eine Formensprache der Seite:

- `--kontur: 2.5px solid #000` um Knoepfe, Bildkarten, Eingabefelder.
- `--stempel: 4px 4px 0 #000` - harter Versatzschatten, KEIN weicher Grauschatten. Nur fuer
  Dinge, die man antippt (Knopf, Kachel). Beim Druecken rutscht das Element in den Schatten
  (translate 2px 2px, Schatten 2px 2px).
- Radien: 14 px fuer Karten, 999 px fuer Knoepfe/Chips, 8 px fuer Eingaben. Nicht ueberall
  derselbe Radius.
- Bilder von Designs stehen immer auf `--hemd` oder ihrem eigenen Grund, nie auf Papier mit
  rohem Alpha.

## 4. Schrift

- **Anton** (/fonts/anton-v1.woff2) - Ueberschriften. Schmal geschnitten: deutsche
  Wortungetueme passen auf 375 px. Gross, eng (line-height 0.95-1.05), nie in Versalien
  gesperrt als Etikett.
- **Archivo** (/fonts/archivo-v1.woff2, variabel 400-900) - alles andere.
- Beide liegen im eigenen Haus (kein Google-Fonts-Aufruf), `font-display: swap`, Vorladen nur
  der Schriften, die oben auf dem ersten Bildschirm stehen.
- Skala (Handy -> Laptop): H1 44 -> 84 px, H2 32 -> 52 px, H3 19 -> 22 px, Text 16.5 px /
  1.55, klein 14 px. Zeilenlaenge unter 70 Zeichen.
- Nicht: einzelne Woerter in der Ueberschrift einfaerben, Versal-Etiketten ueber jeder
  Ueberschrift, Pfeile hinter jedem Link.

## 5. Abstand und Raster

- Seitenrand 16 px am Handy, 24 px ab 700 px, Inhalt hoechstens 1120 px breit.
- Abschnitte 56 px (Handy) / 96 px (Laptop) Abstand.
- 8er-Raster fuer alles Innere (8, 16, 24, 32).
- Ziel-Flaeche zum Antippen mindestens 44 x 44 px.

## 6. Regler (Taste-Skill, fuer Motto Otto gesetzt)

DESIGN_VARIANCE 6 · MOTION_INTENSITY 3 · VISUAL_DENSITY 5 - lebendig, aber schnell auf dem Handy.
Der Taste-Skill selbst ist noch nicht installiert (siehe oben); die Werte stehen hier, damit sie
gelten, sobald er da ist.

## 7. Bewegung

- Hoechstens EIN orchestrierter Moment je Seite (z. B. der Kopf beim Laden). Keine
  Einblend-Animation je Abschnitt, keine Scroll-Effekte, keine Animations-Bibliothek.
- Bewegung als Antwort auf Tippen ist erwuenscht (Knopf rutscht in den Schatten, 120 ms).
- `prefers-reduced-motion: reduce` schaltet alles ab, was sich von selbst bewegt.

## 8. Icons

- Nur SVG, inline, `stroke: currentColor`, Strichstaerke 2-2.5 (passt zur Kontur).
- Keine Emojis als Icons. Keine Icon-Schriftarten.

## 9. Bilder und Ladezeit

- Nur echte Designs aus dem System (Galerie /api/mo/showcase, Motto-Kacheln
  /api/mo/motto-kachel/<slug>.jpg, Stilbeispiele /api/mo/stilbeispiel/<slug>/<stil>.jpg,
  Otto-Bilder /api/mo/otto/<name>.png). Keine Stockfotos, keine Platzhalter.
- `loading="lazy"` und `decoding="async"` fuer alles unterhalb des ersten Bildschirms, immer
  `width`/`height` oder `aspect-ratio`, damit nichts springt.
- Faellt ein Bild aus, nimmt es sich selbst aus der Seite (onerror) - nie ein kaputtes Symbol.

## 10. Zugaenglichkeit (Pflicht, wird bei jeder Seite gemessen)

- Kontrast mindestens 4,5 : 1 fuer Text (Tabelle oben).
- Sichtbarer Fokus: `outline: 3px solid #000; outline-offset: 3px` plus Magenta-Ring
  (`box-shadow: 0 0 0 6px #E9166A`) auf Papier.
- Bei 375 px kein seitliches Scrollen der Seite (gemessen: scrollWidth == clientWidth).
- Ueberschriften-Reihenfolge ohne Spruenge, eine H1 je Seite, `lang="de"`.

## 11. Text

- Schreiben, was passiert: "Motto waehlen", "Anfrage schicken" - nicht "Jetzt durchstarten".
- Fehler sagen, was los ist und was man tun kann. Leere Stellen laden zum Handeln ein.
- Zahlen nur, wenn sie aus dem System kommen (Anzahl Mottos aus der API, Preise aus preise.cjs).
