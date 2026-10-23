# Erklärvideo „Das Konsens-Design"

Das Video zum einzigen echten Alleinstellungsmerkmal: **aus den Kommentaren einer Abstimmung
entsteht ein neues Design.** Recherche im deutschen Abi-Markt (Gradoo, AbiHoodie, Mediatrix,
Cantana, LYTD, myAbiMerch, Hoodify): Abstimmen können mehrere, Einzelbezahlung bieten mehrere,
KI für Motto-Ideen gibt es auch – ein Design, das aus der Diskussion entsteht, bei keinem.

**Länge:** 62 Sekunden · **Format:** Hochformat 1080 × 1920 · **Ton:** eine Sprecherstimme, leise Musik

---

## Aufbau

| Zeit | Bild | Woher |
|---|---|---|
| 0:00 – 0:05 | Otto am Rechner | **Google Flow** – die einzige KI-Einstellung |
| 0:05 – 1:02 | der Bildschirm | **`konsens.webm`** – liegt fertig daneben |

Der Bildschirmteil ist gebaut und nicht generiert. Video-KI erfindet Oberflächen: Buttons ohne
Funktion, Text als Buchstabensalat, springende Zahlen. Ausgerechnet beim Erklären eines
Mechanismus wäre das tödlich. Jede Zahl, jeder Kommentar und jeder Haken im Film stimmt.

Die Entwürfe sind in **unseren echten Stilen** gezeichnet – College, Minimalistisch, Neon,
Vintage –, so wie sie auf der Motto-Seite zur Auswahl stehen.

---

## Die eine Einstellung in Google Flow (0:00 – 0:05)

Vor den Prompt gehört der Character-Block aus dem Otto-Referenzbrief. Zusätzlich gilt:

> **Exactly ONE character in the entire shot. No text, no letters, no numbers anywhere in the frame.**

```
Vertical 9:16 video, 5 seconds, single continuous shot, no cuts.

A friendly cartoon character sits at a wooden desk in a warm, cosy studio, seen from behind and
slightly to the side, so we look over his shoulder. He wears a flat cap and round glasses. In front
of him stands a large monitor, its screen turned away from us or facing us at a steep angle so its
content is not readable. He leans forward with interest, one hand on a pen, as if reading something
carefully. Soft warm desk lamp from the left, gentle golden rim light on his shoulder, dark cosy
background with a few blurred plants and paper sketches pinned to the wall.

Camera: very slow push-in towards the desk, barely moving. Calm, patient mood.

Exactly ONE character in the entire shot. No other people, no reflections of other characters.
No text, no letters, no numbers anywhere in the frame. No logos. No captions. No subtitles.
```

**Negativ-Prompt:** `text, letters, words, numbers, watermark, logo, subtitles, captions, two people,
duplicate character, extra hands, distorted face, readable screen content`

Liefert Flow eine Fassung mit Schrift im Bild oder zwei Figuren: verwerfen und neu erzeugen, nicht
ausschneiden.

---

## Sprechertext

Ruhig sprechen, etwas langsamer als es sich anfühlt. Die Zeiten gelten für den fertigen Schnitt,
also **Otto-Clip plus 5 Sekunden Versatz** gegenüber der Animation.

| Zeit | Akt | Text |
|---|---|---|
| 0:00 – 0:05 | Otto | Ihr wollt Hoodies für die ganze Stufe. Und genau einer muss das organisieren. |
| 0:05 – 0:09 | 01 | Also setzt du dich hin und machst einen Entwurf. Sieht doch gut aus. |
| 0:09 – 0:15 | 01 | Und dann kommen die anderen. Zweiundneunzig Leute, zweiundneunzig Meinungen. |
| 0:15 – 0:18 | 01 | Bring das mal unter einen Hut. |
| 0:18 – 0:21 | 02 | Genau dafür haben wir eine Lösung. Und die heißt nicht „einer entscheidet". |
| 0:21 – 0:27 | 03 | Otto zeichnet dein Motto in mehreren Stilen. College, minimalistisch, Neon, Vintage – such dir was aus. |
| 0:27 – 0:31 | 03 | Du schickst einen Link. Die Stufe stimmt ab, und du siehst, wer noch fehlt. |
| 0:31 – 0:36 | 04 | Und sie schreiben dazu, was sie denken. Wie immer. |
| 0:36 – 0:40 | 05 | Jetzt kommt der Teil, den es sonst nirgends gibt. |
| 0:40 – 0:46 | 05 | Otto liest jeden einzelnen Kommentar und sucht, worin ihr euch eigentlich einig seid. |
| 0:46 – 0:51 | 06 | Und zeichnet daraus einen neuen Entwurf. Nicht irgendeinen – deinen. |
| 0:51 – 0:57 | 06 | Gleicher Aufbau, gleicher Stil. Nur das Ufo größer, die Schrift fetter, der Spruch dazu. Genau wie ihr es wolltet. |
| 0:57 – 1:02 | 07 | Du musst niemanden mehr überzeugen. Das Ding ist schon der Kompromiss. Motto Otto Punkt de. |

Die Bildschirmtexte stehen bereits im Bild – **im Schnitt keine weiteren Einblendungen darüberlegen.**
Untertitel für den Ton sind natürlich in Ordnung.

### Betonung

- „**einer** muss das organisieren" – auf *einer*.
- „Bring das mal unter einen Hut." – trocken, mit einer kleinen Pause davor.
- „Nicht irgendeinen – **deinen**." – das ist der Satz, der hängen bleiben soll.

---

## Stimme

Zwei Wege:

1. **Selbst einsprechen.** Ruhiger Raum, Handy-Diktiergerät reicht, 15 cm Abstand, etwas langsamer
   als es sich anfühlt. Eine Datei je Zeile aus der Tabelle, benannt `sprecher_01`, `sprecher_02` …
   Das wirkt bei einem Erklärvideo deutlich persönlicher als eine KI-Stimme.
2. **Erzeugen lassen.** Eine deutsche Stimme, ruhig und jung – nicht die Nachrichtensprecher-Variante.

Bei beiden Wegen: die Aufnahmen in den Drive-Ordner „Motto Otto – Videos" legen.

---

## Schnitt

1. Otto-Clip (5 s) an den Anfang.
2. `konsens.webm` direkt dahinter, ungeschnitten.
3. Sprecher als eigene Spur, Videoton auf 0.
4. Musik ruhig, unter dem Sprecher auf etwa 12 Prozent. Bei „Genau dafür haben wir eine Lösung"
   (0:18) darf sie aufmachen.
5. Export 1080 × 1920, MP4.

`konsens.webm` ist WebM. CapCut am Rechner nimmt das direkt; falls dein Programm zickt:

```
ffmpeg -i konsens.webm -c:v libx264 -crf 20 -pix_fmt yuv420p konsens.mp4
```

---

## Etwas ändern?

- **Texte und Ablauf:** `video/konsens.html`. Alle Zeiten gesammelt im Block „Zeitplan" am Ende des
  Style-Abschnitts, eine Zeile je Einblendung, in Sekunden.
- **Die Entwürfe:** `video/entwurf-svg.js`. Ein Modul für alle fünf, `entwurfSVG('college')` für den
  ersten Entwurf, `entwurfSVG('college', true)` für den Konsens. Zum Ansehen `video/entwuerfe.html`
  im Browser öffnen.
- **Danach neu aufnehmen:** `node video/aufnahme.cjs`
