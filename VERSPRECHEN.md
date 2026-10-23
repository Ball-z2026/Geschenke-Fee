# Was wir versprechen – und womit wir es einlösen

Markus, 17. September 2026: *„Es ist verdammt wichtig, und das schreibst du dir wirklich ganz
genau auf: alles, was wir versprechen, muss 100 % eingehalten werden."*

Diese Datei ist die Prüfliste dazu. Jede Zeile, mit der die Seite dem Kunden etwas zusagt,
steht hier mit drei Angaben: **der Wortlaut**, **die Stelle im Code, die ihn einlöst**, und
**der geprüfte Stand**. Wo etwas nicht eingehalten wird, steht das hier genauso deutlich wie
das, was funktioniert. Eine Zusage ohne Eintrag in dieser Datei ist eine Zusage, die niemand
geprüft hat.

Stand: 17. September 2026. Wer ein Versprechen ändert, ändert diese Datei mit.

---

## 1 · Preis und Kontingent

### 1.1 „Erster Entwurf ohne Konto, fünf weitere nach dem Anmelden" — **GEHALTEN, seit 17.9.**

| | |
|---|---|
| Wortlaut | „Erster Entwurf ohne Konto · nach dem Anmelden fünf weitere frei · danach 1 € – beim Kauf verrechnet" |
| Steht in | `home.html:433`, sinngemäß `home.html:502`, `535`, `576`; `motto.html:713`; AGB § 3 |
| Einlösung | `accounts.js`: `GUEST_FREE = 1`, `PLANS.free.designs = 5` |

Vorher stand dort „Fünf Entwürfe kostenlos … **ohne Konto**". Das stimmte nicht: Ohne Konto gibt
es genau einen. Markus hat am 17. September entschieden, es so zu lassen — „ich finde es gut,
wenn die Leute einen Entwurf so kriegen und sich dann anmelden" — und die Texte sind angepasst.

Nachgeprüft in `quotaCheck()`: Der Gast-Entwurf zählt **nicht** gegen die fünf freien im Konto
(`user.freeUsed` wird beim Gastlauf nicht erhöht). Es sind also tatsächlich **sechs** kostenlose
Entwürfe — einer ohne Konto, fünf danach. Genau so steht es jetzt auf der Seite.

### 1.2 Mitgliedschaft: 100 Designs für 29 €, 400 für 49 € — **GEHALTEN, seit 17.9.**

| | |
|---|---|
| AGB § 3 | „100 Designs im Monat für 29 € inkl. USt. oder 400 Designs im Monat für 49 € inkl. USt." (`rechtliches.js`) |
| Konto-Seite | Member 100 = 29 € / Monat, Member 400 = 49 € / Monat (`konto.html`) |
| Code | `accounts.js`: `m100 = 2900 Cent / 100 Designs`, `m400 = 4900 Cent / 400 Designs` |

Vorher stand in der AGB „100 Designs für 29 €", im Shop dagegen 100 für 10 € und 400 für 29 € —
dieselbe Leistung mit zwei Preisen, und die AGB ist der Text, der im Streitfall zählt. Markus
hat am 17. September entschieden: 100 bleiben bei 29 €, 400 gehen auf 49 € hoch.

**Die Preise stehen an genau einer Stelle** (`accounts.js`, `PLANS`), und die Konto-Seite holt
sie von dort (`accountView().prices`). Die Zahlen im HTML sind nur Platzhalter für den
Augenblick vor dem Laden — sie wurden mitgezogen, damit nie ein falscher Preis aufblitzt. Der
AGB-Text ist die einzige Stelle, die von Hand nachgezogen werden muss: **wer `PLANS` ändert,
ändert AGB § 3 mit.**

### 1.3 „Jeder weitere Entwurf kostet 1 € – und wird beim Textilkauf voll verrechnet" — **OFFEN**

| | |
|---|---|
| Steht in | `home.html:433`, `home.html:502`, `home.html:536` |
| Einlösung | `accounts.js`: `PLANS.single = 100 Cent` ✅ |
| Verrechnung | **nicht gebaut** |

Der Euro wird kassiert (sobald Stripe scharf ist), die Verrechnung beim Textilkauf gibt es noch
nicht — es gibt bis jetzt keinen Textilkauf. Solange nicht verkauft wird, wird auch nichts
falsch abgerechnet. **Vor dem ersten Textilverkauf muss die Verrechnung stehen**, sonst wird aus
einem Versprechen eine Falschangabe.

---

## 2 · Die Druckdatei

### 2.1 „Druckdatei: 36 × 46 cm, 300 dpi, freigestellt" — **GEHALTEN**

| | |
|---|---|
| Steht in | `home.html` (Preisblock „Nur die Druckdatei · DTF-Transfer") |
| Einlösung | `images.js:287-290`: `PRINT_DPI = 300`, `PRINT_MAX_CM = { w: 36, h: 46 }` → 4252 × 5433 px |
| Prüfung | `pruefeDruckdatei()` misst jede fertige Datei; der Befund hängt am Auftrag und steht im Backend |

Bei Freestyle-Artikeln gilt das Maß des Artikels statt 36 × 46 — dort wird die tatsächliche
dpi-Zahl **vor** der Bestellung ausgewiesen (`artikel.js`, `artikelLeinwand().warnung`). Große
Artikel wie ein Strandtuch erreichen keine 300 dpi; das sagen wir dort ausdrücklich, statt es zu
verschweigen. Siehe 2.4.

### 2.1b „Das Maß, das der Kunde bestellt hat, steht in der Datei" — **GEHALTEN, seit 17.9.**

| | |
|---|---|
| Zusage | Der Kunde wählt einen Artikel mit festem Maß (Strandtuch 70,6 × 140,6 cm). Die Druckdatei muss genau dieses Maß tragen. |
| Einlösung | `mottos.js`, `druckLeinwand().dpiExakt`; `images.js`, `makeMaster()` trägt ihn per `withMetadata({ density })` ein |

**Am 17. September gebrochen:** Markus hat ein Strandtuch bestellt und die Druckdatei
heruntergeladen — 1936 × 3840 px mit **72 dpi** im Kopf. Jedes Programm liest daraus
**68,3 × 135,5 cm** statt 70,6 × 140,6: zwei Zentimeter zu schmal, fünf zu kurz.

Zwei Fehler in einer Zeile (`images.js`, `makeMaster`):

```js
const dpi = o.leinwand && o.leinwand.dpi ? Math.max(72, Math.round(o.leinwand.dpi)) : PRINT_DPI;
```

1. `Math.round` machte aus 69,64 dpi eine 70.
2. `Math.max(72, …)` machte daraus eine 72. Die Untergrenze schützte vor nichts — ein PNG
   speichert Pixel pro Meter als ganze Zahl, 69 dpi sind darin völlig normal.

Jetzt trägt die Datei den exakten Wert, und zwar die **kleinere** der beiden Achsen-dpi: Das
Bildmodell kann nur bestimmte Kantenmaße, trifft das Seitenverhältnis also nie auf den Punkt
(`verzugProzent` misst, wie weit). Mit der kleineren Zahl deckt die Datei **beide** Maße
mindestens ab. Bei randlosem Druck wird ohnehin beschnitten: ein halber Millimeter zu viel
fällt weg, ein halber zu wenig hinterlässt einen unbedruckten Streifen.

Geprüft über alle großen Artikel — Strandtuch, Handtuch, Fußmatte, Hundedecke, Mousepad,
Kissen, Acrylbild: jede Datei deckt ihr bestelltes Maß ab.

**Die angezeigte dpi-Zahl bleibt gerundet** (`lw.dpi`) — die ist zum Lesen da. In die Datei
geht `dpiExakt`. Wer an einer der beiden Zahlen dreht, muss wissen, welche er meint.

### 2.1c „Du bekommst die Größe, die du angeklickt hast" — **GEHALTEN, seit 17.9. abends**

| | |
|---|---|
| Zusage | Wer einen Artikel wählt und sonst nichts einstellt, bekommt die Größe, die er erwartet — und die Mail zeigt sie ihm richtig. |
| Einlösung | `mottos.js`, `PRINT_PLACEMENTS.vorne` + `GARMENTS` (Reihenfolge); `mockups.js`, `GARMENTS[].flaecheCm`; `server.js`, `fertigMail()` |
| Geprüft | `node abnahme.mjs 2 3` — „Textil: die Vorauswahl ist die ganze Flaeche", „jede Textilvorlage weiss, wie gross ihre Druckflaeche in echt ist" |

**Am 17. September gebrochen:** Markus bekam die Fertig-Mail zu einem T-Shirt, beschriftet mit
**9,4 × 9,7 cm**. Seine Worte: *„Aber die ist falsch. Das ist nicht das, was ich angeklickt habe."*

Die Zahl war nicht falsch gerechnet — sie war richtig gerechnet zu einer Bestellung, die so
niemand aufgeben wollte. Drei Fehler übereinander:

1. **Die Vorauswahl war der Mini-Print.** Die Flächenliste eines Shirts begann mit
   `brust_klein` (10 × 10 cm). Die erste Fläche ist überall die Vorauswahl — im Auswahlfeld
   des Browsers wie auch als Rückfall in `artikelLeinwand()`. Wer „T-Shirt" anklickte und das
   Feld „Fläche" nicht bemerkte, bestellte still einen Aufnäher. Jetzt steht `vorne`
   (36 × 46 cm) an erster Stelle — dasselbe Maß, das jeder Motto-Auftrag ohne Platzierung
   ohnehin bekommt. Die kleinen Flächen bleiben wählbar, sie passieren nur nicht mehr ungefragt.
2. **Das Mockup verschwieg es.** Jedes freistehende Motiv wurde formatfüllend in die
   Druckfläche gelegt. Der 10-cm-Print sah aus wie ein Frontprint über die ganze Brust,
   während die Bemaßung daneben 9,4 cm sagte — Bild und Zahl widersprachen sich, und man
   glaubt dem Bild. Jede Textilvorlage trägt jetzt `flaecheCm`, und das Motiv wird in dem
   Verhältnis gezeichnet, in dem es wirklich auf dem Teil landet.
3. **Die Mail zeigte immer ein T-Shirt.** `fertigMail()` griff fest auf `job.mockups.tee` zu —
   wer ein Strandtuch bestellt hatte, bekam ein Shirt zu sehen (Markus schon am Vormittag:
   *„Ich habe mir ein Strandtuch ausgesucht, bekomme aber ein Mockup mit T-Shirt"*). Jetzt
   entscheidet `ansichtVon(artikel.id)`; gibt es für den Artikel kein eigenes Mockup, zeigt
   die Mail das nackte Motiv statt eines fremden Teils. Der Text darunter nennt den Artikel
   beim Namen und das Maß in Zentimetern.

4. **Auf fremden Teilen wurde das Motiv beschnitten.** Zwei Stunden später, Markus: *„Auf dem
   Kissen ist die Datei abgeschnitten. Maße stimmen in meinen Augen auch nicht."* Ein Motiv für
   Textil 30 × 35 cm wurde auf dem Kissen formatfüllend eingelegt — Hochformat in eine
   querformatige Fläche, also oben und unten abgeschnitten. Die Pointe des Spruchs war weg.
   Randlos ist jetzt nur noch, was auch randlos bestellt wurde (`eigen && motivart ===
   'vollflaechig'`); auf jedem anderen Teil wird das Motiv hineingelegt, mittig, in seinem
   echten Verhältnis — nie beschnitten.

**Die Regeln dahinter, als Prüfungen festgehalten:**

Bei Kissen oder Hundedecke sind die Einträge Größen desselben Teils — dort ist die kleinste
zuerst richtig, sie ist die günstigste. Bei Textilien sind es Platzierungen auf ein und
demselben Shirt. Dort muss die Vorauswahl die größte sein. `abnahme.mjs` prüft das getrennt
nach `a.garment`.

Jede Vorlage kennt über `flaecheCm`, wofür ihre Fläche in echten Zentimetern steht, und die
zweite Prüfung rechnet das gegen den Artikelkatalog nach — zwei Quellen für dieselbe Zahl laufen
sonst auseinander. Umgerechnet wird über **eine** Achse, die Breite: die Box ist das Teil im
Foto und selten exakt so proportioniert wie seine Druckfläche (ein Kissen baucht, ein Shirt
fällt). Wer beide Achsen einzeln streckt, verzerrt das Motiv; wer beide einzeln begrenzt,
zeichnet es kleiner als die Zahl daneben behauptet.

**Bemaßt wird nur, wo die Zahl auch trägt:** auf dem bestellten Teil, und dort auf die ganze
Druckdatei statt auf den beschnittenen Motivbereich. Vorher standen 27,9 × 31,7 cm neben dem
Beutel und 30 × 35 cm in der Zeile darunter — zwei Zahlen für dieselbe Sache. Auf einem Teil,
das gar nicht bestellt wurde, steht jetzt keine Zahl: sie wäre eine Hochrechnung, die niemand
bestellt hat.

### 2.2 „Schwarz ist das Shirt: kein Schwarz als Farbe, kein Tintenklotz, kein Kasten" — **URSACHE BEHOBEN, NACHWEIS OFFEN**

| | |
|---|---|
| Steht in | `home.html`, Vergleichsabschnitt, Spalte „Motto Otto" |
| Einlösung | Prompt-Regel `RULES_SCHWARZ` bzw. `S_DUNKEL` in `mottos.js`; Nachbesserung `schwarzflaechenFreistellen()` in `images.js` |

**Am 17. September gebrochen:** Drei Druckdateien, die Markus geschickt hat, trugen genau das,
was hier ausgeschlossen wird — bis zu 78 % der deckenden Fläche fast schwarz, beim
Rheinfunken-Design eine schwarze Scheibe hinter dem ganzen Motiv.

Zwei Ursachen, beide gefunden:

1. **Der Prompt bestellte den Hintergrund selbst.** `"isolated on a plain empty background"`
   stand in 18 von 19 Mottos und wurde nur im Chroma-Modus herausgeschnitten, nicht im
   Alpha-Modus, der läuft. Behoben (Fassung 73): Der Satzteil fällt jetzt immer weg.
2. **Die Nachbesserung griff nicht.** `schwarzflaechenFreistellen()` erkennt nur, was in allen
   Kanälen ≤ 32 liegt, und entfernte an allen drei Dateien **0 %**. Ein dunkelblauer Nebel bei
   Kanalwert 33–70 fällt komplett durch.

**Offen:** Die Schwelle in `schwarzflaechenFreistellen()` ist unverändert. Solange der Prompt
sauber liefert, fällt das nicht auf — als Sicherheitsnetz taugt die Stufe so aber nicht. Zu tun:
Schwelle prüfen und eine Messung einbauen, die eine Datei mit großer dunkler Fläche gar nicht
erst durchlässt.

### 2.3 „Kommt freigestellt aus der Pipeline – pixelgenau, auch die Innenflächen der Buchstaben" — **GEHALTEN**

| | |
|---|---|
| Steht in | `home.html`, Vergleichsabschnitt |
| Einlösung | `GRUND_MODUS = 'alpha'`: Der Bilddienst liefert einen echten Alphakanal; `motivFreistellen()` und `alphaSchaerfen()` in `images.js` |
| Prüfung | `pruefeDruckdatei()` misst `alpha`, `alphaMin`, `freiProzent` und meldet „NICHT freigestellt – druckt als Kasten", wenn der Kanal fehlt |

Gemessen an den drei Dateien vom 17. September: Alphakanal sauber binär, 1,0–1,3 %
Zwischenwerte. Die Freistellung selbst arbeitet korrekt — der Fehler in 2.2 lag im Motiv, nicht
im Freistellen.

### 2.5 „… und die Druckdatei herunterladen" (Fertig-Mail) — **ZURÜCKGENOMMEN, weil unhaltbar**

| | |
|---|---|
| Stand in | `server.js`, `fertigMail()` — jede Fertig-Mail, an jeden Kunden |
| Wirklichkeit | `/api/mo/master/:file` kommt nur durch `masterGuard` — Chef-Token oder Druckerei-Token. Ein Kunde hat keines von beiden, egal ob angemeldet oder bezahlt. |

Markus am 17. September: *„Die Druckdatei kann er sich auch nicht runterladen, weil er nicht
bezahlt."* Er hat recht, und es ist schlimmer als gedacht: Es gibt für einen Kunden **überhaupt
keinen** Weg zur Druckdatei, bezahlt oder nicht. Die Kaufform „Nur die Druckdatei" ist ein
Angebot (`kaufformen.js`), aber ausgeliefert wird sie heute von Hand, nach einer Anfrage per
Mail — so steht es auch im Kopf der Datei.

Der Satz ist deshalb aus der Mail raus. Sie sagt jetzt, was stimmt: auf welchem Teil das Motiv
zu sehen ist und welches Maß die Druckdatei hat. **Offen bleibt** der Weg dahinter — wer die
Kaufform „Nur die Druckdatei" bezahlt, muss die Datei auch selbst bekommen. Das gehört an den
Warenkorb (Shopify) und ist dort mitzudenken, nicht vorher zu versprechen.

### 2.4 „Wir sagen dir sofort, ob es für die gewählte Größe reicht" (Foto-Upload) — **GEHALTEN, seit 17.9. richtig gerechnet**

| | |
|---|---|
| Einlösung | `fotos.js`, `pruefeFoto()`; Aufruf in `server.js` beim Hochladen und beim Erzeugen |

Bis zum 17. September wurde beim **Nachzeichnen** die dpi-Zahl gegen die volle Druckfläche
gerechnet — dort ist das Foto aber nur Vorlage, das Bildmodell malt neu. Ein iPhone-Original mit
4032 px wurde mit „nur 54 dpi, reicht nicht" abgewiesen. Jetzt trennt `pruefeFoto()` die beiden
Wege: Einsetzen misst dpi (dort zählen die Pixel wirklich), Nachzeichnen misst die Pixelzahl der
kurzen Kante.

---

## 3 · Der Kundenfoto-Umgang

### 3.1 „Dein Foto wird nicht gespeichert" — **GEHALTEN**

| | |
|---|---|
| Wortlaut | „Dein Foto wird nicht gespeichert. Es liegt nur so lange bei uns, wie du an deinem Design arbeitest – und wird sofort gelöscht, sobald du sagst, dass dir das Design gefällt." |
| Steht in | `fotos.js`, `FOTO_TEXTE.beimHochladen`; angezeigt im Konfigurator |
| Einlösung | `fotos.js`: Das Foto liegt ausschließlich im Arbeitsspeicher (`Map`), nie auf der Platte. `fotoAufraeumen()` löscht nach einer Stunde, `designFreigeben()` sofort nach dem Ja des Kunden |

Kein Schreibvorgang nach `storage/` für Kundenfotos — geprüft. Das Foto ist danach nur noch im
fertigen Design enthalten, und genau das sagt der Text auch („Auf dem fertigen Design bleibt es
natürlich, sonst könnten wir es nicht drucken").

### 3.3 „Dein Foto kommt so aufs Design, wie du es willst" — **GEHALTEN, seit 17.9.**

| | |
|---|---|
| Zusage | „So einsetzen heißt: dein Foto kommt genau so auf den Artikel. Nachzeichnen heißt: wir zeichnen es im gewählten Stil nach — es sieht deinem Foto ähnlich, ist aber eine Zeichnung." |
| Steht in | Konfigurator, Foto-Abschnitt; `fotos.js`, `FOTO_MODI` |
| Einlösung | `mottos.js`, `FOTO_AUSNAHME`, angehängt nach den Druckregeln; `fotos.js`, `nachbauPrompt()` |

Markus, 17. September: *„Wenn dort allerdings ein Foto von einer Person hochgeladen ist, sollte
die natürlich genauso auch dargestellt werden, wie der Kunde das will."*

Ein Stil kann eine eigene Vorstellung vom Motiv mitbringen — „Fotorealistisch" bestellt zum
Beispiel eine Person **bei der Arbeit**. Bei einem Porträt der Oma wäre das falsch. `FOTO_AUSNAHME`
sagt deshalb jetzt ausdrücklich, wer gewinnt:

> „THE PHOTOGRAPH DECIDES THE CONTENT: who is in the picture, how they are posed, what they wear
> and how closely they are framed all come from the photograph and are kept … The style decides
> only HOW the picture is drawn, never WHO or WHAT is in it."

**Die Trennlinie: Der Stil bestimmt die Malweise, das Foto den Inhalt.** Geprüft an einem
gebauten Prompt (Freestyle + Stil „Fotorealistisch" + Kundenfoto): Die Foto-Ausnahme steht als
letzter Absatz, hinter Stiltext und Druckregeln — also dort, wo sie beide überstimmt.

Die Ausnahme für erfundene Figuren (`FIGUR_AUSNAHME`, siehe 4.4) hängt bewusst an
`style === 'fotoreal' && !foto`: Sobald ein Kundenfoto da ist, greift sie gar nicht erst.

### 3.2 „Bleibt eine Stunde bei uns, dann ist es automatisch weg" — **GEHALTEN**

`fotos.js`, Aufräumtakt; die Sitzung verfällt nach `FOTO_TTL`. Der Kunde bekommt beim Ablauf
`FOTO_TEXTE.abgelaufen` zu sehen statt einer leeren Fehlermeldung.

---

## 4 · Anmeldung und Ablauf

### 4.1 „Deine Eingaben bleiben erhalten, nach dem Anmelden geht es automatisch weiter" — **GEHALTEN, seit 17.9.**

| | |
|---|---|
| Steht in | `motto.html:2641` (Text der Anmelde-Aufforderung) |
| Einlösung | `motto.html`: `weiterMerken()` / `weiterNachLogin()` |

Am 17. September gebrochen und behoben. Drei Lücken:

1. Bei Freestyle standen Artikel, Fläche und Maß nicht in `values()` — der automatische
   Zweitversuch lief in „artikel fehlt".
2. Checkboxen wurden über `el.value` wiederhergestellt statt über `.checked`; „Ich darf dieses
   Foto verwenden" blieb leer.
3. Der Fotobesitz wechselt beim Anmelden von `g:<gast>` auf `u:<konto>` — das eigene Foto
   gehörte dem Kunden danach nicht mehr.

Alle drei behoben. **Der Weg ist noch nicht end-to-end durchgeklickt** — das steht aus.

### 4.2 „In unter fünf Minuten da" — **MEIST GEHALTEN, NICHT ZUGESICHERT**

| | |
|---|---|
| Steht in | `home.html:502` |
| Einlösung | Warteschlange in `server.js`; `eta` je Auftrag, `wartezeitSek()` |

Ein Lauf dauert real 2–4 Minuten. Bei Andrang wird die Schlange länger; die Seite nennt dann die
tatsächliche Wartezeit und bietet die Benachrichtigung per Mail an, statt die fünf Minuten
weiter zu behaupten. Das ist ehrlich, aber der Satz auf der Startseite ist unbedingt formuliert.
**Empfehlung:** „meist in unter fünf Minuten" — kostet nichts und ist immer wahr.

### 4.3 „Jedes Motto gibt es in dreizehn Stilen" — **GEHALTEN**

`mottos.js`, `STYLE_KEYS`: 14 Einträge, davon einer `standard` („Wie vorgesehen"). Also dreizehn
wählbare Stile plus die Vorgabe des Mottos.

Am 17. September kam „Fotorealistisch" dazu (Markus, nach dem Dachdecker-Vergleichsbild). Die
Zahl im Text steht an zwei Stellen in `home.html` und wurde mitgezogen — **wer einen Stil
hinzufügt oder entfernt, zieht sie mit.** Eine Zahl, die niemand pflegt, wird zur Falschangabe.

### 4.4 „Auch ein langer Spruch geht – Otto setzt ihn dann in mehreren Zeilen" — **GEHALTEN, seit 17.9. abends**

| | |
|---|---|
| Steht in | Hinweis unter dem Feld „Spruch" (Sprüche-Shirt) |
| Einlösung | `seed.json` rev 3: `spruch` max 160 statt 50; `mottos.js`, `cleanValue()` Decke 200 statt 120; `buildPrompt()` Block „LONG SENTENCE – SET IT AS A TYPE BLOCK"; `motto.html`: ab 70 Zeichen zweizeiliges Feld mit Zähler |

Markus am 17. September: *„Beim Sprüche Shirt sind die Buchstaben begrenzt. Ist natürlich doof
für längere Sprüche."* Bei 50 Zeichen war Schluss — beim Motto, dessen ganzer Sinn der Spruch
ist. Ein Witz mit Pointe passt da nicht hinein.

Die Grenze allein hochzusetzen hätte den Fehler nur verschoben: Ein langer Satz in einer Zeile
wird auf dem Shirt zu einem unlesbaren Band, und das Modell fängt an, Buchstaben zu verschlucken.
Deshalb sagt der Prompt jetzt, WIE gesetzt wird — drei bis sechs kurze Zeilen, mittig gestapelt,
zwei bis drei Schlüsselwörter groß, Umbruch nur zwischen Wörtern, kein Wort und kein Bindestrich
dazuerfunden, das Motiv tritt hinter den Textblock zurück.

Die Regel greift nur bei Text, der wirklich als Schrift ins Motiv geht: bei den Feldern, die der
Master-Prompt in Anführungszeichen setzt (`"{spruch}"`). Ein Themenfeld wie „Worauf soll's
anspielen?" steht ohne Anführungszeichen im Prompt — das ist Regie, kein Druckinhalt, und bleibt
außen vor.

**Warum über `seed.json` und nicht über die Motto-Datei:** Die Mottos liegen auf dem Volume, ein
Deploy fasst sie nicht an. Nur eine erhöhte `rev` in `seed.json` zieht die Änderung nach — und
auch die nur, solange `userEdited` false ist. Wer das Motto im Backend anfasst, behält seinen
Stand; die Grenze ist dann dort zu setzen.

---

## 5 · Der Vergleich auf der Startseite

### 5.1 „Beide Bilder stammen aus demselben Bildmodell" — **GEHALTEN, seit 17.9. wieder aussagekräftig**

Bis zum 17. September stand als „Standard-KI" ein Bild, das über unseren eigenen Dienst **mit**
Alphakanal erzeugt worden war. Die naive Freistellung hatte daran nichts zu tun, und das
abschreckende Beispiel sah sauberer aus als unser eigenes Ergebnis. Markus: „Der Standard sieht
vom Designer total schick aus. Die Leute verstehen überhaupt nicht, wo das Problem ist."

Jetzt liegt dort ein Bild aus einem Laien-Prompt ohne Alphakanal, `naivFreistellen()` misst die
echte Hintergrundfarbe, und die Lupe zeigt die kantenreichste Stelle statt einer beliebigen.
**Der Vergleich muss ehrlich bleiben:** Das Standard-Bild darf nie künstlich verschlechtert
werden — es muss das sein, was ein Kunde tatsächlich bekommt.

---

## 6 · Marken und Rechte

### 6.1 „Mit Marken- und Symbolprüfung" — **GEHALTEN**

`marken.js`, eingebunden an fünf Stellen in `server.js` (Eingabe, Namensliste, Freitext,
Logo-Upload, QA nach dem Zeichnen). Geschützte Namen werden vor dem Zeichnen abgelehnt, mit
Nennung des Wortes und einem Vorschlag, wie es ohne geht.

Ausnahme mit Absicht: **Fanclubs.** Vereinsmotive sind erlaubt, der Druck erst nach Nachweis
(`needsApproval()`, Freigabe im Backend). Die Sperre sitzt am Download, nicht am Entwurf.

### 6.2 „Bis zur vollständigen Bezahlung bleiben alle Rechte bei uns" — **GEHALTEN**

AGB § 4 (`rechtliches.js`). Technisch: Die Vorschau trägt ein Wasserzeichen
(`MOTTO-OTTO-VORSCHAU`), die Druckdatei liegt hinter `masterGuard` und ist ohne Token nicht
abrufbar.

---

## Offene Punkte, nach Dringlichkeit

1. **2.2 absichern** — Schwelle in `schwarzflaechenFreistellen()` prüfen und eine Messung
   einbauen, die eine Datei mit großer dunkler Fläche gar nicht erst ausliefert.
   (1.1 und 1.2 sind am 17.9. entschieden und umgesetzt.)
2. **4.1 durchklicken** — Freestyle mit Foto, Abmeldung, Anmeldung, automatischer Weiterlauf.
3. **1.3 vor dem ersten Textilverkauf bauen** — die Verrechnung des Entwurf-Euros.
4. **2.5 an den Warenkorb hängen** — wer die Kaufform „Nur die Druckdatei" bezahlt, braucht
   einen eigenen, zeitlich begrenzten Download. Heute geht die Datei nur von Hand raus.
   Gehört zur Shopify-Anbindung, nicht davor.
5. **4.2 Wortlaut** — „meist in unter fünf Minuten".
