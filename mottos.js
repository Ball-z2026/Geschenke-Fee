import fs from 'node:fs/promises';
import path from 'node:path';

// ---------- Fassung 22: wie der Hintergrund entsteht ----------
// Zwei Wege, und der Prompt muss zum Bildserver passen:
//   'alpha'  - der Server fragt background:'transparent' an und liefert einen echten
//              Alphakanal. Dann steht im Prompt KEIN WORT ueber einen Hintergrund; jedes
//              Wort darueber verleitet das Modell nur, einen zu malen.
//   'chroma' - der Server liefert keinen Alphakanal. Dann verlangt der Prompt Chromagruen,
//              ausdruecklich AUCH in jeder eingeschlossenen Flaeche (Loch im O), und
//              verbietet reines Gruen im Motiv - sonst keyt freistellen() das Motiv mit weg.
// Umgestellt wird ueber die Railway-Variable GRUND_MODUS, nicht im Code.
export const GRUND = {
  alpha: 'Print rules: bold, clearly separated color fields, no gradients fading out.',
  // Fassung 24: Freestyle-Artikel wie Fussmatte, Tasse oder Brett werden RANDLOS bedruckt.
  // Dort ist ein transparenter Grund falsch - das Motiv IST die ganze Flaeche.
  vollflaechig: 'Print rules: the artwork covers the entire canvas edge to edge - no transparent areas, no plain background panel, nothing floating on empty ground. Bold, clearly separated colour fields, no gradients fading out, crisp hard edges everywhere.',
  // 24. Sept., Markus zur Harmstorf-Postkarte: "sieht immer noch fuerchterlich aus. Macht
  // wirklich die KI in diesem Entwurf?" Die KI kann gar nichts dafuer - der Auftrag widersprach
  // sich. Die Zeile darueber ist eine TEXTILDRUCK-Regel: flache Farbfelder und harte Kanten,
  // weil weiche Verlaeufe auf Stoff schlecht kommen. Die Postkarte wird aber auf PAPIER
  // gedruckt (digitaldruck), und beide Postkartenstile verlangen ausdruecklich das Gegenteil:
  // "photorealistic ... golden-hour light with long warm shadows ... sparkle on water ...
  // strong depth from foreground to horizon". Ein Foto BESTEHT aus Verlaeufen. Das Modell
  // musste sich fuer eine der beiden Ansagen entscheiden - heraus kam ein halb geplaettetes
  // Pseudo-Foto. Auf Papier gilt deshalb die volle Tonwertskala.
  vollflaechigFoto: 'Print rules: the artwork covers the entire canvas edge to edge - no transparent areas, no plain background panel, nothing floating on empty ground. This is printed on PAPER in full colour, so the whole tonal range is available and wanted: soft light, graded skies, shadows, depth and atmosphere are all correct here. Keep the picture rich and sharp, never muddy - but do NOT flatten it into poster-like colour fields.',
  // Fassung 28: beim Chromaweg liest das Modell nur diesen Text - die Punzen-Regel aus
  // RULES_SCHWARZ hilft dort nicht, also steht sie hier noch einmal.
  chroma: 'Print rules: place the artwork on a FLAT PURE CHROMA GREEN background, exact color #00FF00, perfectly even, no checkerboard, no gradient, no shadow on it. The green must also fill EVERY enclosed area - inside the holes of letters like O, A, B, R, between limbs, inside rings and frames - so the artwork can be cut out cleanly. The counter inside every letter is GREEN, not dark: the bowl of B, P, R, D, O, the eye of A, e, a, g, the gap in U, G, S - all pure green, exactly like the space around the word. NEVER use pure or near-pure green anywhere inside the artwork itself; darker greens like forest or olive green are fine. Bold, clearly separated color fields, no gradients fading out.'
};
export let GRUND_MODUS = 'alpha';
export function setGrundModus(m) {
  // 6. Okt., Markus: "ob wirklich 100 % alles transparent ausgeliefert wird ... nicht nachtraeglich freigestellt".
  // Chromagruen hiess: auf Gruen malen und danach ausschneiden - das ist Freistellen. Es gibt nur noch 'alpha',
  // egal was die Railway-Variable oder das Backend sagt.
  void m;
  GRUND_MODUS = 'alpha';
  return GRUND_MODUS;
}

// ---------- Gemeinsame Druckregeln, haengen an JEDEM Master-Prompt ----------

// ===================================================================================
// Fassung 73 - DIE SCHLANKE FASSUNG (Schalter PROMPT_FASSUNG=schlank)
// -----------------------------------------------------------------------------------
// Markus, 17. Sept.: "Jede Sache, die wir aendern, bringt irgendwo eine Verschlechterung.
// Wir brauchen Qualitaet von der ersten Sekunde."
//
// Gemessen ueber alle 19 aktiven Mottos: 4257 Zeichen je Prompt, davon rund 600 Auftrag
// und 3700 Regeln - 44 Verbote der Form "no/never/not" in EINEM Prompt. Gewachsen ueber
// die Fassungen 15 bis 72, jede Fassung hat einen Einzelfehler geflickt.
//
// Zwei Dinge gehen dabei schief, und beide sieht man an den Bildern:
//   1. Verbote arbeiten gegen uns. "no glow, no haze, no vignette, no halo" nennt dem
//      Modell viermal Glow, Haze, Vignette und Halo. Bildmodelle gewichten Substantive,
//      nicht das "no" davor. Genau diese vier Dinge kamen zurueck.
//   2. Dieselbe Sache steht mehrfach da, jedesmal etwas anders: "no gradients fading out"
//      und "no gradient inside a shape", "bold, clearly separated color fields" und
//      "every colour area is ONE even, flat colour". Wo zwei Formulierungen stehen,
//      entscheidet das Modell, welche es nimmt.
//
// Die schlanke Fassung sagt jede Regel GENAU EINMAL und sagt sie POSITIV - was gemalt
// werden soll, nicht was nicht. Keine Regel faellt inhaltlich weg; sie stehen nur nicht
// mehr dreimal da. Etwa 1200 statt 3100 Zeichen Regelwerk.
//
// Der Schalter steht auf 'alt', bis die Bilder das Gegenteil beweisen. Umgestellt wird
// ueber die Railway-Variable PROMPT_FASSUNG, nicht im Code - damit laesst sich dasselbe
// Motto zweimal laufen und vergleichen, ohne dass etwas verloren gehen kann.
export let PROMPT_FASSUNG = 'alt';
export function setPromptFassung(f) {
  PROMPT_FASSUNG = f === 'schlank' ? 'schlank' : 'alt';
  return PROMPT_FASSUNG;
}
const schlank = () => PROMPT_FASSUNG === 'schlank';

// Aufbau: was das Motiv IST. (ersetzt GRUND.alpha + RULES_FREIRAUM)
// 8. Okt.: "emblem ... like a patch" zog kompakte Aufnaeher-Bloecke (Markus: "ein grosser Fleck mit bisschen bunter Farbe").
const S_AUFBAU = 'The artwork is a free-standing graphic with an irregular, open silhouette - not a compact patch, sticker or badge block. It ends exactly where its last drawn element ends, and the fabric shows through everywhere else - around the artwork and in the gaps between the elements. A quarter of the canvas stays bare fabric, and at least 6 percent stays bare along every edge. Every outer edge is crisp: where the artwork ends, the fabric begins, in a single hard step. NOTHING sits behind the elements: no grey, off-white or faded disc, no distressed or smudged texture plate, no felt or paper patch filling the space behind the emblem - between the elements the fabric shows through.';
// Malweise: WIE gemalt wird. (ersetzt CLEAN FLAT PRINT ARTWORK + die Farbzeile aus GRUND)
// Nachgeschaerft nach dem ersten A/B-Lauf (Malle, 17. Sept.): die schlanke Fassung liess
// eine Vintage-Koernung durch, die alte hatte sie mit "no brush strokes, no canvas texture,
// no paper grain, no noise" verboten. Nicht jedes Verbot laesst sich streichen - manches hat
// kein positives Gegenstueck. Es hat aber eins: eine Oberflaeche IST glatt. Also positiv
// bestellt statt vier Dinge verboten.
const S_MALWEISE = 'Draw it as flat vector-style print artwork: each colour area is one even, flat colour with a crisp, exact outline, cut as if from vinyl. Every surface is perfectly smooth and uniform - the colour sits as evenly as printed ink, with no visible grain, weave, brush or paper structure inside it. Volume and shadow come from two or three clearly separated flat tones. This holds for distance and scenery exactly as for the main subject - mountains, sky, water and clouds are flat colour shapes with the same crisp outlines. Lettering has clean even edges and solid flat fills.';
// Schwarzes Textil: Schwarz IST der Stoff. (ersetzt RULES_DUNKEL + RULES_SCHWARZ)
//
// Am 25. Sept. stand hier kurz eine schaerfere Fassung ("es gibt keine schwarze Farbe, die
// Flaeche bleibt LEER, die Kontur wird zum leeren Spalt"). Sie ist zurueckgenommen - warum,
// steht ausfuehrlich beim Gegenstueck S_WEISS weiter unten. Kurz: das Modell laesst die
// Flaeche nicht weg, es malt sie halbdurchsichtig, und das druckt milchig.
//
// Ein Nebenbefund aus derselben Messung, der stehen bleiben soll, weil er jeden spaeteren
// Versuch betrifft: 14 der 17 Stiltexte bestellen in ihrem EIGENEN Text Schwarz oder Weiss
// (Handwerker: "palette of ... steel grey, cream and black", dazu "heavy outlines"). Der
// Stiltext steht VOR der Textilzeile. Deshalb schwankt jede Textilregel stark - sie wirkt
// entweder ganz oder gar nicht. Wer das aendern will, muss an die Stiltexte, und die
// gehoeren nach CLAUDE.md ("Mehrere Chats am selben Repo") nicht in diesen Bereich.
const S_SCHWARZ = 'The garment is black and supplies the black wherever there is no artwork: the space around the artwork, the gaps between its elements, the space behind the type and the counters inside the letters (the bowl of B, P, R, D, O, the eye of A, e, a, g, the gap in U, G, S) all stay bare fabric - no grey or faded backdrop plate behind the emblem. Inside the artwork black is an ordinary colour and stays where the drawing needs it - a shadow, the dark side of an object, a pupil, a contour line. All lettering is light - cream, off-white, gold, bright colour - carrying a dark outline; light shapes carry a dark outline, dark shapes a light one. Print as little as possible: where no colour is needed, the fabric stays bare.';

// Helles/weisses Textil: dort ist Schwarz eine echte Farbe.
//
// ---------------------------------------------------------------------------------------
// 25. September - EIN VERSUCH, DER ZURUECKGENOMMEN WURDE. Der Grund steht hier, damit ihn
// niemand ein zweites Mal macht.
//
// Markus wollte den Koenigsweg: "wenn jemand weisses Textil gewaehlt hat, dass alle 100 %
// rein weissen Stellen transparent bleiben, bei Schwarz genauso" - und ausdruecklich ueber
// den Prompt, "nicht nachtraeglich rausgeholt". Dafuer stand hier eine schaerfere Regel:
// "es gibt keine weisse Farbe", "die Flaeche ist LEFT COMPLETELY EMPTY", dazu das
// Gegenstueck fuer Schwarz mit dem leeren Spalt statt der Kontur.
//
// An selbst geschriebenen Testprompts sah das grossartig aus: 0,0 % Reinweiss statt 29,4 %.
// Am ECHTEN Prompt aus buildPrompt() blieb davon nichts - der enthaelt laengst
// "no large white fills" -, und dann kam der eigentliche Schaden heraus, sichtbar erst,
// als Markus sagte: "Lege mal einen weissen Untergrund dahinter dann sehen wir das."
//
// Das Modell laesst die Flaeche naemlich nicht weg. Es malt sie HALBDURCHSICHTIG.
// Anteil voll deckender Flaeche am Motiv, dieselben Motive je zweimal erzeugt:
//   bewaehrte Regel:  93,2 / 94,3 / 93,3 / 93,0 / 92,4 / 97,0 / 98,8 %
//   schaerfere Regel: 89,4 / 75,7 / 89,1 / 74,3 / 82,5 / 83,8 / 82,3 / 46,8 %
// Acht von acht schlechter, im schlimmsten Fall ueber die Haelfte des Motivs. Auf schwarzem
// Grund sieht so etwas satt aus, weil der Grund durchscheint - im DTF-Druck kommt es milchig
// und fleckig. Genau das hatte Markus befuerchtet ("Wichtig ist, dass er von der Qualitaet
// her nichts verliert").
//
// Also: die Textilregeln stehen woertlich wie vor dem 25. September, nachgewiesen an allen
// 272 Kombinationen aus Ton, Stil, Fassung und Motivart. Was BLEIBT, ist alles, was nicht
// am Prompt haengt: die vier Toene als Angabe, der Schwarz-Freisteller nur noch auf reinem
// Schwarz, Sublimation als weisser Traeger, und die Deckungsmessung in images.js, die diesen
// Fehler kuenftig meldet, egal woher er kommt.
// ---------------------------------------------------------------------------------------
const S_WEISS = 'The garment is white or light: all lettering in dark or strongly saturated colour (black, navy, deep red, forest green) with a thin contrasting outline. White and cream would vanish on this fabric, so they appear only inside a carrier or name surface that was explicitly ordered above, and that surface keeps a clear dark outline. Every light shape carries a dark outline.';


// ---- Die beiden BUNTfarben (26. Sept., Markus: "Dass die Leute ganz genau waehlen
// koennen fuer weisses Textil helles Textil dunkles Textil und schwarzes Textil, das ist
// glaub ich ganz ganz wichtig.") ---------------------------------------------------------
//
// Er hat recht, und der Grund ist nicht Bequemlichkeit: die bewaehrten Regeln sind fuer
// REINES Weiss und REINES Schwarz geschrieben. Wer ein sandfarbenes Shirt waehlt, bekommt
// heute "White and cream would vanish on this fabric" - auf Sand stimmt das nicht, dort ist
// Creme eine gut sichtbare Farbe. Wer Navy waehlt, bekommt "black is the garment" - auf Navy
// ist Schwarz sehr wohl eine Druckfarbe. Zwei falsche Ansagen fuer zwei echte Stoffe.
//
// Diese beiden Zeilen sind bewusst MILDER als die reinen: sie erlauben mehr Farbe, nie
// weniger. Ein Irrtum kostet damit Tinte, aber nie ein fehlendes Motiv - die einzige
// Richtung, in die man hier irren darf. Das "LEFT COMPLETELY EMPTY" vom 25. September
// kommt NICHT zurueck, in keiner Form (siehe die Notiz oben bei S_WEISS).
const S_HELL = 'The garment is a light colour but not white - sand, beige, cream or heather grey: all lettering in dark or strongly saturated colour (black, navy, deep red, forest green) with a thin contrasting outline. White and cream ARE printed colours here and stay wherever the drawing needs them - a white sail, a cloud, a highlight - but they need a dark outline against the fabric, which is close to them in brightness. Every light shape carries a dark outline.';
const S_DUNKEL = 'The garment is a dark colour but not black - navy, bottle green, burgundy or charcoal: it supplies its own colour wherever there is no artwork, so the space around the artwork, the gaps between its elements, the space behind the type and the counters inside the letters (the bowl of B, P, R, D, O, the eye of A, e, a, g, the gap in U, G, S) all stay bare fabric - no background panel or box behind the motif, no dark haze beside it, no slab or drop shadow behind the type. Black INSIDE the artwork is a printed colour like any other and stays where the drawing needs it - a shadow, the dark side of an object, a pupil, a contour line - because the fabric is dark but it is not black. All lettering is light - cream, off-white, gold, bright colour - carrying a dark outline; light shapes carry a dark outline, dark shapes a light one. Print as little as possible: where no colour is needed, the fabric stays bare.';

// Dasselbe fuer die gewachsene Fassung. Die Zeilen ersetzen dort RULES_HELL bzw. RULES_DUNKEL.
const RULES_HELL_BUNT = 'The print goes on a LIGHT COLOURED shirt - sand, beige, cream or heather grey, not white: all lettering in dark or strong saturated colours (black, navy, deep red, forest green). White and cream are real printed colours here and may be used, but every light shape needs a dark outline, because the fabric itself is light and a pale shape would otherwise dissolve into it.';
const RULES_DUNKEL_BUNT = 'THE GARMENT IS THE BACKGROUND WHERE THERE IS NO ARTWORK: around the artwork and in every gap between its elements the fabric stays bare - no background panel or box behind the motif, no dark haze beside it, no dark slab or drop shadow behind the type. The counters inside the letters stay open too - the bowl of B, P, R, D, O, the eye of A, e, a, g, the gap in U, G, S - so the fabric shows through them exactly as it does around the word. The print goes on a DARK COLOURED shirt - navy, bottle green, burgundy or charcoal, not black: all lettering light (cream, off-white, gold, bright colours) with a dark outline, dark shapes with a light outline. Black INSIDE the artwork is a printed colour like any other and stays where the drawing needs it: the shadow under a roof tile, the dark side of a hammer, a pupil, a black jacket, a contour line. The fabric is dark, but it is not black. No large flat white plates or panels - except a carrier or name surface that is explicitly ordered above. Print as little as possible: wherever no colour is needed, the fabric stays bare.';


// ---------- Die vier Textiltoene ----------
// Bis zum 25. Sept. gab es nur hell und dunkel. Der Unterschied, der jetzt dazukommt, ist
// nicht kosmetisch: unbedruckt zeigt IMMER den Stoff. Auf reinem Weiss ist das genau richtig -
// die Stelle liest sich als Weiss, ohne einen Tropfen Farbe. Auf beige oder graumeliert waere
// es falsch, dort kaeme beige heraus. Darum bekommen nur weiss und schwarz den Satz
// "der Stoff liefert die Farbe", hell und dunkel behalten ihre Farbregeln.
export const TEXTILTOENE = ['weiss', 'hell', 'dunkel', 'schwarz'];
// Unbekanntes und Altbestand: 'dunkel' bleibt 'dunkel', alles andere Unbekannte wird schwarz.
export function textilTon(t) {
  const x = String(t || '').toLowerCase();
  return TEXTILTOENE.includes(x) ? x : (x === 'hell' ? 'hell' : 'schwarz');
}
/** Heller Stoff (weiss oder helle Buntfarbe)? Ersetzt das alte `textile === 'hell'`. */
export function istHell(t) {
  const x = textilTon(t);
  return x === 'weiss' || x === 'hell';
}
/** Liefert der Stoff selbst die Farbe, die sonst gedruckt werden muesste? Nur weiss und schwarz. */
export function stoffLiefertFarbe(t) {
  const x = textilTon(t);
  return x === 'weiss' ? '#ffffff' : (x === 'schwarz' ? '#000000' : null);
}
// Text und Marken - knapp und noetig, bleibt wie gehabt.
const S_TEXT = 'All text is readable at A4 print size and spelled exactly as given. The artwork sits centred in the canvas. Leave out: coats of arms, club or brand logos, real trademarks - and no wordless brand marks either: no three parallel stripes in the sportswear manner, no swoosh tick, no leaping big cat, no crocodile, no polo rider, no interlocking double C, no designer monogram pattern, no fashion-house check pattern, no bitten apple, recognizable real people, cars, and any word that was not given above.';
// ===================================================================================

const RULES_COMMON_1 = () => GRUND[GRUND_MODUS];
// Fassung 23: Es fehlte die Regel, dass ein Druck eine FORM ist. Die einzige Flaechenvorgabe war
// "empty margin of at least 6 percent" - ein Block, der 88 Prozent fuellt, erfuellt sie und sieht
// trotzdem aus wie ein aufgeklebtes Poster ("ganz ganz viele Motive, die sehr grossflaechig waren").
// Haengt in ALLEN drei Regelsaetzen direkt nach der Grundzeile, gilt damit fuer jeden Stil.
export const STOFF_DECKEND = 'PRINTABLE ON FABRIC: every printed pixel is fully opaque. The texture of this style - washes, tide lines, granulation, blooms, spray mist, drips, distress and cracks - is drawn as hard-edged, fully opaque specks and shapes of solid colour, never as see-through colour, never as a fade into the fabric, never as a soft halo, cloud or smoky shadow around or behind the artwork. Where the style would show bare paper or bare wall, the bare fabric shows.';
const RULES_FREIRAUM = 'THE PRINT IS A SHAPE, NOT A PICTURE: the artwork must read as a free-standing piece with its own silhouette - the silhouette follows the layout of this design (tall, wide, ragged, the outline of the motif itself), it is NOT automatically a round or shield-shaped badge - never a filled rectangle, square, oval or rounded block, never a scene running out to the canvas edges. At least a quarter of the canvas stays completely empty, and the empty background reaches INTO the composition between the elements, not only around it. No sky, no ground, no wash, no glow, no haze, no vignette and no atmosphere behind the motif, and no sheet of paper, no card, no grey, off-white or faded disc, no distressed or textured plate, no felt or paper patch behind the elements - the shirt itself is the background, also between the elements. The outer edge of the artwork is crisp: no soft glow, no pale fringe, no blurred outer stroke, no drop shadow and no halo of light colour around the silhouette - where the artwork ends, the background begins immediately.';
// Fassung 15: 'Portrait' ist raus - bei Brust mittig und Nacken ist das Querformat richtig, die Regel
// widersprach dem Format. Die Orientierung kommt jetzt aus der Platzierung bzw. der Canvas-Groesse.
const RULES_COMMON_2 = 'EVERY BODY PART BELONGS TO A BODY: if a hand, an arm, a leg or a head appears, the whole figure it belongs to is drawn as well. Never a hand or an arm reaching in from nowhere, never a limb cut off by nothing. If the figure does not fit, draw the object alone instead. All text readable at A4 print size and spelled exactly as given. Centered inside the canvas with an empty margin of at least 6 percent on every side - nothing touches the edges. Never: coats of arms, club or brand logos, real trademarks - and no wordless brand marks either: no three parallel stripes in the sportswear manner, no swoosh tick, no leaping big cat, no crocodile, no polo rider, no interlocking double C, no designer monogram pattern, no fashion-house check pattern, no bitten apple, recognizable people, cars, or words other than the ones given.';
// Fassung 24: bei randlosen Artikeln gibt es keinen Rand, den etwas beruehren koennte - dafuer
// eine Beschnittzone, in der nichts Wichtiges stehen darf.
const RULES_COMMON_2_VOLL = 'EVERY BODY PART BELONGS TO A BODY: if a hand, an arm, a leg or a head appears, the whole figure it belongs to is drawn as well. Never a hand or an arm reaching in from nowhere, never a limb cut off by nothing. If the figure does not fit, draw the object alone instead. All text readable at A4 and spelled exactly as given. Keep every text and every element that must survive at least 8 percent away from each edge - the outer band is trimmed off. Never: coats of arms, club or brand logos, real trademarks - and no wordless brand marks either: no three parallel stripes in the sportswear manner, no swoosh tick, no leaping big cat, no crocodile, no polo rider, no interlocking double C, no designer monogram pattern, no fashion-house check pattern, no bitten apple, recognizable people, cars, or words other than those specified.';
const RULES_DUNKEL = 'The print goes on BLACK or dark shirts: all lettering light (cream, off-white, gold, bright colors) with a dark outline, dark shapes with a light outline; never dark lettering without a light outline. No large flat white plates or panels - except a carrier or name surface that is explicitly ordered above.';
const RULES_HELL = 'The print goes on WHITE or light shirts: all lettering in dark or strong saturated colors (black, navy, deep red, forest green) with a thin light or contrasting outline; no white or cream lettering and no large white fills - white would vanish on the shirt - except a carrier or name surface that is explicitly ordered above, which keeps a clear dark outline. Light shapes always get a dark outline.';
// Fassung 27: Schwarz ist das Textil, keine Druckfarbe. Auf einem schwarzen Shirt ist gedrucktes
// Schwarz unsichtbar, kostet aber Tinte, glaenzt im Streiflicht und macht den Druck steif.
// EIGENE Zeile, nicht in RULES_DUNKEL: ein Stil darf die Textilzeile ersetzen (STYLES[k].dark,
// Street Art) - stuende die Schwarz-Regel darin, wuerde Street Art sie mit wegwerfen.
// Fassung 28: die Punzen (Innenflaechen der Buchstaben) und der Schlagschatten hinter der Schrift
// waren trotzdem dunkel gefuellt - "keine schwarze Flaeche" meint fuer das Modell die Schrift
// offenbar nicht mit. Deshalb steht es jetzt ausdruecklich da. Nachtraeglich ist das nicht zu
// reparieren (Punze und Kontur haben dieselbe Dicke und Farbe), siehe 00k-ZUSATZ.
// Fassung 73, Abend des 17. Sept. - Markus stellt die Regel klar:
// "Wenn schwarze unnoetige Flaechen sind bei einem schwarzen T-Shirt, dann waere die erst gar
//  nicht drin haben. Wenn wir in so einem geschlossenen Motiv irgendwo schwarz haben, dann ist
//  es vollkommen okay."
//
// Die alte Fassung verbot Schwarz pauschal - "every area that would be black must be left
// COMPLETELY EMPTY". Das trifft auch den Schatten unter einem Dachziegel, die dunkle Seite
// eines Hammers, eine schwarze Hose. Das Modell musste dagegen arbeiten und lieferte entweder
// flache Motive ohne Tiefe oder hielt sich gar nicht daran.
//
// Es kommt nicht auf die FARBE an, sondern auf die LAGE: Schwarz, das an den freien Grund
// grenzt, ist Hintergrund und gehoert nicht in die Datei. Schwarz, das vom Motiv selbst
// umschlossen ist, ist Zeichnung und bleibt. Die Punzen der Buchstaben sind die Ausnahme in der
// Ausnahme - dort soll das Textil durchscheinen, sonst druckt jedes O als schwarzer Klotz.

// Das Gegenstueck fuer reines Weiss (25. Sept.). Steht wie RULES_SCHWARZ in einer EIGENEN
// Zeile, damit ein Stil mit eigener Textilzeile sie nicht mit wegwirft.
const RULES_SCHWARZ = 'BLACK IS THE GARMENT WHERE THERE IS NO ARTWORK: around the artwork and in every gap between its elements the fabric stays bare - no black background, no black panel or box behind the motif, no dark haze beside it, no dark slab or drop shadow behind the type. The counters inside the letters stay open too - the bowl of B, P, R, D, O, the eye of A, e, a, g, the gap in U, G, S - so the fabric shows through them exactly as it does around the word. INSIDE the artwork, black is an ordinary colour and stays: the shadow under a roof tile, the dark side of a hammer, a pupil, a black jacket, a contour line - wherever black is enclosed by the drawing itself, it belongs to the drawing. Print as little as possible: wherever no colour is needed, the fabric stays bare.';
// PRINT_RULES und PRINT_RULES_LIGHT standen hier als fertig zusammengesetzte Regelsaetze.
// Sie wurden von nirgendwo mehr aufgerufen - printRules() baut den Satz seit Fassung 24 selbst
// zusammen - und haetten ab heute einen Widerspruch enthalten: RULES_DUNKEL bestellt eine
// dunkle Kontur, RULES_SCHWARZ verbietet jede schwarze Farbe. Ein toter Regelsatz, der sich
// selbst widerspricht, ist genau die Sorte Falle, die irgendwann jemand ahnungslos benutzt.
// Deshalb raus statt repariert.

// Fassung 24: EIN Regelsatz-Bauer fuer alle Faelle. motivart 'vollflaechig' (Fussmatte, Tasse,
// Brett) laesst die Freiraum-Regel weg und wechselt den Grund - sonst widerspricht sich der
// Prompt (freistehend gegen randlos) und das Bildmodell entscheidet selbst, welche Haelfte es
// glaubt. Ohne motivart verhaelt sich alles wie in Fassung 23.
export function printRules(textile, style, motivart, fassung, verfahren) {
  const ton = textilTon(textile);
  const voll = motivart === 'vollflaechig';
  // Papierdruck: volle Tonwertskala statt flacher Farbfelder (siehe GRUND.vollflaechigFoto).
  const grundVoll = verfahren === 'digitaldruck' ? GRUND.vollflaechigFoto : GRUND.vollflaechig;
  // Fassung 73: schlanke Fassung - jede Regel genau einmal, positiv formuliert.
  // Ein Stil, der seine eigene Textilzeile mitbringt (STYLES[k].dark), behaelt sie auch hier.
  // fassung ueberstimmt den globalen Schalter - so laeuft ein A/B-Vergleich, ohne dass
  // gleichzeitige Kundenauftraege die andere Fassung abbekommen.
  if (fassung ? fassung === 'schlank' : schlank()) {
    if (voll) return [grundVoll, S_MALWEISE, RULES_COMMON_2_VOLL].join('\n');
    const eigen = style && STYLES[style] && STYLES[style].dark;
    // weiss und schwarz behalten WOERTLICH die bewaehrten Zeilen. hell und dunkel bekommen
    // ihre eigenen - dort ist Weiss bzw. Schwarz eine echte Druckfarbe.
    // Die Stilzeile (STYLES[k].dark, z. B. Street Art) gilt weiter nur auf dunklem Stoff.
    // Auf einer dunklen BUNTfarbe steht die Tonzeile in einer EIGENEN Zeile hinter der
    // Stilzeile. Sonst waere sie bei Street Art und Fotoreal - den beiden Stilen mit eigener
    // dark-Zeile - einfach verschwunden, und die Wahl "dunkel" haette dort gar nichts
    // bewirkt. Genau dieser Fehler hat schon einmal die Schwarz-Regel still ausgeschaltet
    // (Fassung 27), deshalb hier von vornherein getrennt.
    const zeilen = ton === 'weiss' ? [S_WEISS]
      : ton === 'hell' ? [S_HELL]
      : ton === 'dunkel' ? [eigen || null, S_DUNKEL]
      : [eigen || S_SCHWARZ];
    return [S_AUFBAU, S_MALWEISE, ...zeilen, S_TEXT].filter(Boolean).join('\n');
  }
  const grund = voll ? grundVoll : RULES_COMMON_1();
  const raum = voll ? null : RULES_FREIRAUM;
  const rest = voll ? RULES_COMMON_2_VOLL : RULES_COMMON_2;
  if (istHell(ton) && !voll) return [grund, raum, ton === 'hell' ? RULES_HELL_BUNT : RULES_HELL, rest].filter(Boolean).join('\n');
  // Fassung 15: Ein Stil darf seine eigene Textilzeile mitbringen (STYLES[k].dark). Street Art braucht
  // echtes Reinweiss - die Standardzeile nennt "cream, off-white, gold" an erster Stelle und weicht es auf.
  const own = style && STYLES[style] && STYLES[style].dark;
  const textilzeile = voll ? null : (own || (ton === 'dunkel' ? RULES_DUNKEL_BUNT : RULES_DUNKEL));
  // Die Schwarz-Regel ("Schwarz IST der Stoff") gilt nur auf REINEM Schwarz und nur beim
  // freistehenden Druck - bei vollflaechigen Artikeln und auf hellem Stoff ist Schwarz eine
  // echte Druckfarbe. Auf navy oder flaschengruen ebenfalls: dort wuerde eine ausgesparte
  // Stelle navy zeigen, nicht schwarz. RULES_DUNKEL_BUNT sagt das schon selbst.
  const schwarz = voll || ton === 'dunkel' ? null : RULES_SCHWARZ;
  return [grund, raum, textilzeile, schwarz, rest].filter(Boolean).join('\n');
}

// Fassung 25: Die Standardregel verbietet "recognizable people". Bei einem Kundenfoto ist
// genau das der Zweck - ohne diese Ausnahme streicht die Regel dem Kunden sein Motiv weg.
// Fassung 73 (Markus, 17. Sept.: "Die Datei, wo der Dachdecker auf dem Dach ist - das ist in
// meinen Augen fotorealistisch"). Genau diese Figur fehlte im ersten Lauf des neuen Stils: die
// Regel "Never: recognizable people" steht NACH dem Stiltext und gewinnt damit - das Modell
// laesst Menschen dann ganz weg und malt nur Werkzeug. Die Regel schuetzt vor dem Abbild einer
// WIRKLICHEN Person (Persoenlichkeitsrecht) - eine erfundene Figur bei der Arbeit ist davon
// nicht beruehrt und ist beim fotorealistischen Stil der Punkt der Sache. Also dieselbe
// Mechanik wie bei FOTO_AUSNAHME: nach den Druckregeln, damit die Ausnahme die Regel aufhebt.
export const FIGUR_AUSNAHME = "EXCEPTION to the general rule for this style: a person AT WORK is wanted here and is the heart of the piece - a roofer on a roof, a mechanic at the engine, a cook at the pass. Invent that person; they must not resemble any actual, identifiable individual, and no celebrity, no portrait of a real face. Show them doing the work: seen from behind, from the side or bent over the task, hands and tools in full view. The ban on recognizable people means no REAL person - it does not mean no people.";
// 2. Okt., Gruppen-Mottos mit Foto (gruppenFoto): anders als bei FOTO_AUSNAHME entscheidet das Foto
// nur, WER im Design ist - die Szene, die Posen und alles andere kommen vom Motto. Bild 1 ist das
// Foto, schon im gewaehlten Stil gemalt (Stufe 1, wie bei der Postkarte); der Hintergrund des Fotos
// gehoert nicht ins Design.
export const GRUPPENFOTO_AUSNAHME = "EXCEPTION to the general rule: the customers supplied a photograph of themselves. Image 1 shows those people, already redrawn in the chosen style. The ban on recognizable people does not apply here: the people in this design ARE the people from image 1. IMAGE 1 DECIDES WHO IS IN THE DESIGN - exactly as many people as it shows, never more and never fewer, each one unmistakably that person: the same hair, the same beard, the same glasses, the same skin tone, the same build and expression, in their own clothes with their own colours. THE THEME DESCRIBED ABOVE DECIDES EVERYTHING ELSE - the scene, the poses, the props, the lettering and the whole composition; the people are the cast of that scene and act it out. The room, the furniture, the background and any bystanders of image 1 are NOT taken over. Everything is drawn in the style of this design; nothing photographic survives.";
export const FOTO_AUSNAHME = "EXCEPTION to the general rule: this piece is built around the customer's own photograph, so the people and animals in it ARE allowed and ARE the subject. The ban on recognizable people does not apply here. THE PHOTOGRAPH DECIDES THE CONTENT: who is in the picture, how they are posed, what they wear and how closely they are framed all come from the photograph and are kept - a portrait stays a portrait, a dog on a beach stays a dog on a beach. If a style instruction above asks for a different subject, a different pose or a scene of its own - someone at work, a particular setting - the photograph wins. The style decides only HOW the picture is drawn, never WHO or WHAT is in it.";

// ---------- Text saeubern ----------
const BLOCKLIST = /(nazi|hitler|afd|nsdap|hakenkreuz|fick|hure|wichser|nutte|schlampe)/i;

// Erlaubt sind Buchstaben, Zahlen, Leerzeichen und die ueblichen Satz- und Schriftzeichen.
// 1. Okt. (Markus: "Und warum sollten wir keine Emojis und Sonderzeichen drucken koennen?" - und
// sein "Jedes Jahr..." wurde zu "Jedes Jahr", weil das iPhone aus drei Punkten das EINE Zeichen
// "…" macht): Anfuehrungszeichen, %, €, @, °, *, ;, = sind erlaubt, "…" wird zu "...", und
// EMOJIS BLEIBEN - diese Texte malt die Bild-KI, sie zeichnet ein Emoji als kleines Bildzeichen
// im Stil des Designs (emojiSatz). Nur Namenslisten setzen wir selbst in einer Schrift ohne
// Emojis (names.js) - dort fallen sie weiter weg, mit Hinweis.
const EMOJI_ZEICHEN = '\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u{1F3FB}-\\u{1F3FF}\\u{FE0F}\\u{200D}\\u{20E3}';
export const ALLOWED_CHARS = new RegExp(`[^\\p{L}\\p{N} .,!?&'’\\-–+/():#„“”"‚‘«»%€@°*;=${EMOJI_ZEICHEN}]`, 'gu');
export const HAT_EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u;
export function stripChars(value) {
  return String(value || '').replace(/…/g, '...').replace(ALLOWED_CHARS, '').replace(/\s+/g, ' ').trim();
}
// Der Satz fuer den Bild-Auftrag, wenn ein Kundentext Emojis enthaelt (Shirt und Postkarte gleich).
export const EMOJI_SATZ = 'Some of the customer texts contain emoji. Draw each emoji as a small hand-drawn pictogram IN THE STYLE AND COLOURS OF THIS DESIGN, placed exactly where it stands in the text, about the height of the letters - never as a glossy phone emoji, never as a sticker, and never spell out its name.';
export function cleanValue(value, max) {
  if (value === undefined || value === null) return '';
  // Fassung 74: Obergrenze fuer einzeilige Felder von 120 auf 200 Zeichen. Sie ist nur die
  // Decke - was wirklich gilt, steht als max am Feld. Ein Sprueche-Shirt lebt vom Spruch, und
  // ein Witz mit Pointe passt nicht in 50 Zeichen (Markus, 17. Sept.).
  const t = stripChars(value).slice(0, Math.min(+max || 40, 200));
  if (!t) return '';
  if (BLOCKLIST.test(t)) return null;
  return t;
}

export function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// ---------- Prompt bauen ----------
// {feld}      wird durch den Kundenwert ersetzt
// [[ ... ]]   faellt komplett weg, wenn ein darin genanntes Feld leer ist
export function fillPrompt(template, values) {
  let out = String(template || '');

  out = out.replace(/\[\[([\s\S]*?)\]\]/g, (whole, inner) => {
    const keys = [...inner.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m => m[1]);
    for (const k of keys) if (!values[k]) return '';
    return inner;
  });

  out = out.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, key) => values[key] || '');
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- Stile, die der Kunde auf jeder Motto-Seite waehlen kann ----------
// Der gewaehlte Stil ueberschreibt die Stilzeile des Master-Prompts, die Komposition bleibt.
export const STYLES = {
  standard:  { label: "Wie vorgesehen", desc: "So, wie das Motto gedacht ist", text: "" },
  streetart: { label: "Street Art", desc: "Kiezwand, Ebenen, Plakatreste",
    text: "A piece put down by a street-art writer on a raw city wall - dirty, loud, layered, still clearly readable. NEVER crowns, NEVER stars, no clean flat vector shapes, no smooth digital gradient or glow. The background is never empty: layers stacked over each other - bare wall and concrete, torn poster remnants, older paint painted over, scratch marks, sprayed arrows, dots and spirals, splatter, coarse halftone fields. Over that the main motif as a rough hand illustration with FAT BLACK OUTLINES and hard contrast, often mostly black and white so the colour screams - never smooth, touristy or postcard-clean. COLOUR MUST SCREAM: blazing red, electric blue, bright yellow at FULL saturation in blocks, strokes and sprayed patches - never muted, dusty, washed-out or pastel. PURE WHITE IS PURE WHITE: the brightest value is clean opaque white, never cream, off-white or beige; lettering and highlights sit in that hard white against deep black so they punch. Spray behaviour must be physically right: fuzzy overspray halo at the edges, drips running DOWNWARD from the underside of shapes and stopping where they dried, marker strokes, one stencil element with visible bridge gaps, one or two hand-scrawled tags - tags are abstract scribbles, never readable words. Lettering is rough display type with brush, graffiti and poster character and must be PART of the wall: angled, stacked, warped into the surface, partly overlaid, rubbed and worn, with its own drips and shadow - never a clean centred text block on a finished picture, never a printed-looking font. Small deco allowed: smileys, hearts, peace signs.",
    // Markus' Text, Wort fuer Wort. Angehaengt ist nur der letzte Satz (17. Sept., auf seine
    // Zustimmung): Eine eigene dark-Zeile ERSETZT RULES_DUNKEL, und damit fiel deren Schutz
    // "No large flat white plates or panels" still weg - derselbe Mechanismus, der beim
    // fotorealistischen Stil die weisse Tafel hinter dem Schriftzug erzeugt hat.
    dark: "The print goes on BLACK or dark shirts: the lettering is PURE BRIGHT WHITE with a black outline, never cream, never off-white, never beige; dark shapes get a white outline. Colours stay fully saturated. Never dark lettering without a light outline. No large flat white plates or panels - except a carrier or name surface that is explicitly ordered above." },
  // 13. Okt., Markus: "Graffiti bitte raus." Bleibt fuer alte Auftraege definiert, ist aber nirgends mehr waehlbar (weg).
  graffiti: { label: "Graffiti", desc: "Wildstyle, Spraydose, Drips", weg: true, off: true,
    // Fassung 73 (17. Sept.): Markus hat klargestellt, dass der Street-Art-Text von ihm stammt
    // und dieser hier von mir. Die Abnahme hatte 20 woertlich gleiche Stellen zwischen beiden
    // gemessen - darunter der ganze Spray-Block, der bei Street Art im Original steht. Weil sein
    // Text unangetastet bleibt, ist dieser hier umgeschrieben: auf das, was ein Piece von einem
    // Wandbild unterscheidet, naemlich den AUFBAU der Buchstaben und die Dose als Werkzeug.
    text: "A graffiti piece: the WORD is the artwork, nothing else. Wildstyle or bubble lettering in which the letters interlock, overlap and grow arrows and serifs out of each other until the word reads as one solid construction. Build it the way a writer builds a piece, in this order and all of it visible: a fill-in of flat colour inside each letter, a clean outline around the fill, a second outline offset behind it, a fat 3D extrusion block dropping to one side with its own darker shade, and hard white highlight sparks where the light would hit. Can control decides the texture: wide soft passes inside the fill, tight hard lines on the outlines, a fine mist where two colours meet. Strictly THREE spot colours plus the outline and the highlight - never every neon at once. Any shading is coarse halftone dots, never a soft blend. Around the word there is nothing: no wall, no panel, no scene - the fabric is the wall." },
  // Fassung 23: gekuerzt und druckfest gemacht. Inhaltlich unveraendert gegenueber dem
  // Drive-Masterprompt V1 plus Nachtrag HELL - nur drei Dinge kommen dazu, die dort fuer
  // ein gemaltes Stadtmotiv nicht noetig waren, fuer ein Textmotiv auf Stoff aber schon:
  // begrenzte Palette, harte Formgrenzen, und die Schrift wird NICHT mitgemalt.
  meisterwerk: { label: 'Meisterwerk', desc: 'Gemalte Wirbel, Goldornament, hell',
    satz: 'Render the ENTIRE artwork in exactly this technique - the lettering too: count out the faceted letters and the gold letter the lettering rule demands, and keep only the outer edge hard.',
    text: 'Painted artwork, Meisterwerk fusion: the brushwork of VAN GOGH, the broken forms of PICASSO and the gold ornament of KLIMT fused into ONE picture - never a copy of a real painting. VAN GOGH is the paint: short thick swirling impasto strokes with visible ridges in clear directions, always INSIDE a colour field, never a blend between two. PICASSO is the construction: every HARD BUILT object - boat, building, vehicle, tool - breaks into a few large flat facets at different angles, like folded paper; living things stay whole. KLIMT is the ornament: flat gold squares, gold spirals, one bold gold border - warm yellow-ochre, flat and matt, NEVER shiny or metallic, no filigree. MOOD IS BRIGHT: cream, ivory and sunlit ochre cover most of the area; deep blue only as two or three small swirl cores, never a large dark field. FACES AND FIGURES ARE PAINTED: same visible strokes, simplified features, never photographic or airbrushed. PALETTE: at most SIX colours in the whole picture - count them. PLAY WITH THE LETTERS, AND COUNT IT: in EVERY line of text, AT LEAST THREE letters are cut by ONE straight diagonal into two flat facets of clearly different tone, like folded paper (Picasso); AT LEAST ONE letter per line is solid flat gold with a dark outline (Klimt); a few strokes carry one or two ridges running ALONG them (van Gogh). This is not optional decoration - a line of plain even letters is WRONG. BIG DELIBERATE SHAPES ONLY, never fine texture: no swirl field, no streaks, no speckle - a letter full of brushwork is drawn shut and equally WRONG. THE LETTER MUST STILL READ: one hard clean outer edge that no stroke crosses, strong contrast to what lies behind. NOTHING PASSES BEHIND THE LETTERING: rays, ornament and motif stop short, leaving a clear gap around every word. Contrasting outline all round, nothing thinner than 1.5 mm, legible from two metres. PRINT DISCIPLINE: every shape ends on a hard boundary; no colour fades out; no pure white inside the motif.' },
  // 27. Sept., Markus: "Minimalistisch ist nicht einfarbig, sondern es ist nur minimalistisch
  // GEZEICHNET - d.h. wir koennen trotzdem alle Farben nutzen. Das sieht doch Scheisse aus."
  // Hier stand woertlich "very few colours - off-white plus one or two accents". Das war die
  // Farbrationierung, nicht der Stil. Und sein zweiter Satz, zu Aquarell: "dass es nicht jeder
  // Idiot sieht, dass es mit KI gemacht ist" - Aquarell wirkt echt, weil der Text ein MATERIAL
  // beschreibt (Papier, Wasserraender, Koernung). "Mono-line, geometric shapes" beschreibt eine
  // Abstraktion, und die malt die KI in ihrer eigenen glatten Handschrift. Also jetzt ein echtes
  // Verfahren: Siebdruck in voller Farbe, mit den kleinen Zufaellen eines von Hand gezogenen Drucks.
  // 27. Sept., zweiter Anlauf. Der erste machte daraus einen bunten Siebdruck mit Farbflaechen -
  // Markus: "Das hat aber noch mit unserem vorherigen Minimalistic Design nichts zu tun." Recht
  // hat er: gemeint war die feine LINIENZEICHNUNG von vorher, nur ohne die Farbsperre. Also
  // bleibt der Stil die Linie - und die Linie darf jede Farbe haben, die das Motiv hat.
  minimal: { label: "Minimalistisch", desc: "Feine Linien, alle Farben",
    text: "MINIMALIST LINE DRAWING, IN COLOUR. Every subject is reduced to a clean, continuous line - the fewest lines it takes to recognise it, and those few correct, in proportion and true to the real thing - with at most a few small flat fills where a shape needs them. THE MINIMALISM IS IN THE DRAWING, NOT IN THE PALETTE: the lines and the small fills take the REAL colours of what they show - the flag its colours, the landmark its stone or iron, the trees green, the water blue, the clothes and faces their own colours - as many colours as the picture really has, never rationed to one or two accents and never a colour invented for decoration. Large empty space between the lines - that space is the bare shirt, never a drawn sheet; no shading, no gradient, no texture, no halftone, no outline around an outline, no drop shadow, no ornament. Lettering in a light, widely letter-spaced geometric sans-serif (Futura-like), small and understated. DRAWN BY HAND WITH FINE PENS, NOT GENERATED: the shirt is the paper - no sheet, no off-white or grey panel or disc is drawn behind the lines - the line weight breathing slightly along its length, a corner where two lines do not quite meet, a fill that stops a hair short of its line. Calm, airy and expensive, like a gallery poster." },
  // 27. Sept., Markus: "Recherchiere bitte auch mal nach Kalligraphie, dass es so aussieht, als
  // waer's mit Bleistift gemalt, auch sehr minimalistisch, jedoch relativ detailgetreu."
  // Recherchiert (Urban Sketching, Reiseskizzenbuecher): die Skizzierer bauen die grossen Massen
  // auf, zeichnen das Bauwerk sorgfaeltiger als die Umgebung, setzen Detail nur dort, wo es
  // zaehlt, und lassen viel Papier weiss - "selective detail". Und die Handschrift kommt aus dem
  // Material: Graphit in mehreren Haerten, Papierkorn in jedem Strich, Schraffur statt
  // verwischtem Grau, leicht unregelmaessige Linien. Die Kalligraphie steckt in der Schrift:
  // der Gruss in einer fliessenden Bleistift-Schreibschrift derselben Hand.
  // Zuerst nur fuer die Postkarte (nurMotto). 8. Okt., Markus nach dem ABIrama-Probedruck:
  // "Entscheide diesen Stil bitte auf jeden Fall fuer alles frei" - seitdem fuer jedes Motto.
  bleistift: { label: "Bleistift", desc: "Skizze, fein und detailgetreu", nurGraphit: true,
    text: "GRAPHITE PENCIL DRAWING ON PAPER, as a travelling architect draws in a sketchbook: minimal in its means, faithful in its detail. Pure graphite in several grades - a hard pencil for the fine, precise construction lines, a soft one for the few deep accents - on off-white, lightly textured drawing paper whose grain shows in every stroke. Confident, slightly imperfect lines of varying weight, drawn in one go; shading only where it matters, as open hatching and cross-hatching that lets the paper breathe, never smooth blended grey. SELECTIVE DETAIL: the building, the landmark and the faces are rendered carefully and correctly - true proportions, the real windows, the real roofline, the real face - while the surroundings are only suggested with a few loose lines, and a great deal of paper stays white. THE LETTERING IS WRITTEN BY THE SAME HAND in a flowing, calligraphic pencil script - the greeting in one elegant, confident line, with the natural swell and fade of pressure a pencil gives. No colour at all but the warm tone of the paper and the grey of the graphite; a single small touch of colour is allowed only where the subject demands it, such as a flag. No digital smoothness, no vector edges, no perfect symmetry: a stray construction line, a lightly smudged shadow, an uneven stroke are what make it real. Nothing on this card looks generated - it looks drawn on a bench in front of the building." },
  popart: { label: "Pop-Art", desc: "Comic-Raster, knallige Farben",
    text: "Authentic 1960s pop art in the manner of Roy Lichtenstein and Andy Warhol: every fill built from coarse, clearly visible Ben-Day halftone dots, thick uniform black outlines, flat unmixed primary colours (lemon yellow, tomato red, cyan blue, magenta) on off-white, deliberate slight misregistration of the colour plates, a comic-panel explosion burst shape as accent (no extra words in it), optionally the motif repeated in a 2x2 grid in different colourways like a silkscreen. No smooth shading, no gradients, no realism, no subtle colours - loud, graphic, printed-comic look." },
  vintage: { label: "Vintage", desc: "Retro-Look, abgenutzt",
    text: "Genuine 1970s vintage screen print that has been washed a hundred times: heavily distressed with cracked and flaked ink, uneven faded areas, grain and speckle texture, slight misregistration between the colour layers. Palette sun-bleached and muted: cream, mustard yellow, burnt orange, rust, olive, dusty teal, faded brown - never bright or saturated. Typography of the era: arched retro badge lettering, thick-thin 70s serifs, rounded scripts, sunset stripes and simple emblem shapes. No crisp edges, no modern fonts, no neon colours." },
  tattoo: { label: "Tattoo", desc: "Old-School, dicke Linien",
    text: "American traditional old-school tattoo flash as drawn by a Sailor-Jerry-era tattoo artist: bold, even, uniform black outlines, solid black shading with whip-shading and dot stippling, a strictly limited flat palette of red, green, yellow, cream and black, no gradients. Classic flash motifs as accents: roses, daggers, swallows, anchors, skulls, stars, hearts and a curling banner ribbon. Lettering in tattoo script or chunky block letters inside the ribbon. It must look like it could be tattooed exactly as drawn - no thin lines, no realism, no cartoon softness." },
  comic: { label: "Comic", desc: "Cartoon, lustig, bunt",
    text: "Hand-drawn comic-book panel: expressive ink linework of varying weight, cross-hatching and heavy spot blacks for shadows, flat cel-shaded colours in bright primaries and secondaries, exaggerated cartoon characters with big eyes, wide grins and rubbery poses, motion lines, sweat drops, impact bursts and a hand-lettered comic title with a drop shadow. Slight imperfection of pen and ink is welcome. No clean vector logo look, no photorealism, no muted tones - it must feel like a page torn from a funny comic." },
  japan: { label: "Japan", desc: "Wellen, Kirschblüten, Pinselschrift",
    text: "Japanese ukiyo-e woodblock print in the manner of Hokusai and Hiroshige: flat colour areas with visible woodgrain and paper texture, bold black key-block outlines, stylised great waves with clawed foam fingers, flowing cloud bands, cherry blossom branches, a red rising sun disc, koi, cranes or Mount Fuji as accents, a small red seal stamp. Palette: Prussian blue indigo, vermilion red, cream, ochre and black. Lettering with the character of brush calligraphy strokes. No Western fonts, no gradients, no cartoon style - it must look like a real woodblock print." },
  college: { label: "College", desc: "Varsity, Sport, Streifen",
    text: "Classic American collegiate varsity print: big arched block letters in a slab-serif athletic font with a contrasting inline stroke and a hard drop shadow, chenille-patch and felt texture INSIDE the letters and shapes only - never a felt, paper or distressed patch behind the emblem, no round or oval backdrop -, chevrons, twin stripes and a pennant or laurel, a mascot-style animal silhouette. Exactly two school colours (for example navy and gold, or maroon and cream) plus off-white. Clean, symmetrical, athletic-department look - no grunge, no graffiti, no neon. Never invent a year or number - only the given texts appear." },
  aquarell: { label: "Aquarell", desc: "Handgemalt, Verlaufskanten, Papier",
    text: "A real watercolour painted on rough cotton paper. NEVER airbrush smoothness, never a digital gradient, never a glow, never opaque flat fills, never a wash without its tide line. What makes watercolour read as watercolour is NOT softness but the HARD DRIED EDGE: every wash is bounded by a darker tide line where the pigment collected at the rim as it dried, with blooms and backruns inside where water pushed pigment away. Pigment granulates and settles into the tooth of the paper, so no area is ever evenly filled - flat colour is mottled and grainy. Where two colours touch while wet they bleed into each other but stay separate colours rather than mixing to mud. Dry-brush drags leave broken, skipped strokes across the rough surface. The lightest values are bare untouched paper - never white paint over the top. A few loose ink or pencil lines drawn over the dry washes carry the drawing; they wander, break and overshoot, and they do not outline every shape. Limited palette of three or four transparent pigments that layer into deeper tones where they overlap. Generous untouched paper around everything." },
  // Fassung 73 (Markus, 17. Sept.: "Des Weiteren ein weiterer Stil, fotorealistisch, so wie
  // zum Beispiel bei dem Dachdecker-Foto, das sieht cool aus"). Gemeint ist der Look des
  // Laien-Vergleichsbildes: eine fotoechte Figur, dramatisch ausgeleuchtet, dazu gemeisselte
  // Typo. Fuer den DTF-Druck ist Fotorealismus die schwierigste Gattung - weiche Verlaeufe
  // saufen ab, und auf schwarzem Textil verschwinden dunkle Partien im Stoff. Darum steht
  // hier beides drin: fotoecht JA, aber mit hartem Kontrast, begrenzter Palette und einer
  // hellen Kante um alles, was sonst mit dem Shirt verschmelzen wuerde.
  fotoreal: { label: "Fotorealistisch", desc: "Fotoecht, dramatisch, wie ein Filmplakat",
    text: "Photorealistic illustration, rendered like a dramatic film poster or an editorial photograph: real materials, real anatomy, real light. Wherever the subject allows it, a person at work carries the picture - caught mid-task, muscles and hands doing something real, tools in use - and the objects around them support that scene rather than replacing it. The subject is lit from one strong side so the form reads through light and shadow, with deep contrast and a clear silhouette. Keep the palette tight - one or two real colours carrying the whole picture plus neutral greys, never a full rainbow. Detail belongs where the eye goes: faces, hands, tools, texture of fabric and metal; everything else simplifies into clean dark and light masses. Lettering is solid and dimensional - carved metal, cast concrete, heavy condensed type with a bevelled edge - and sits as its own block, not painted onto the scene. The whole thing is cut along its own irregular outline like a patch; there is NO rectangular photo frame, no photographic backdrop, no sky and no scenery filling the corners. ONE SCENE, NOT A COLLECTION OF EMBLEMS: everything in the picture belongs to the same moment and touches something else - the person, the tool in their hands, the material under it. Every object appears exactly once, and nothing hovers beside or above the scene as a separate symbol. The light falls from high on one side, so the upward-facing surfaces - shoulders, forearms, the top edge of every tile, tool and letter - come out bright by themselves and carry the picture against dark fabric.",
    // Fassung 73, nachgebessert am Abend des 17. Sept. (Markus zur Druckdatei
    // MO-HANDWERK-20260917-HQDC: "Da machst du doch schon wieder Muell"). Zwei Fehler, beide
    // in DIESEM Text, nicht in der Nachbearbeitung:
    //   1. Eine eigene dark-Zeile ERSETZT RULES_DUNKEL - und damit fiel deren Satz "No large
    //      flat white plates or panels" weg. Das Modell malte prompt eine weisse Tafel hinter
    //      den Schriftzug; auf schwarzem Shirt waere das ein weisser Block, auf weissem Grund
    //      sieht sie aus wie ein ausgefranster Rand. Der Satz steht jetzt hier wieder drin.
    //   2. "every dark mass is separated from the fabric by a lighter edge" bestellte woertlich
    //      einen hellen Saum um alles - genau der weisse Halo um die Buchstaben. Raus. Ein Motiv
    //      wird lesbar, weil sein Material hell beleuchtet ist, nicht weil eine Linie darum liegt.
    dark: "The print goes on BLACK or dark shirts: the artwork stays readable because its own materials are lit bright - polished metal, pale wood, light cloth, warm highlights - never because a line or a glow is drawn around it. There is no outline, no rim stroke and no pale edge around the artwork or around the lettering. Lettering is bright in itself (warm white, steel grey, gold) and any plate or banner behind it is made of a real material with its own texture and shading - no large flat white panels. A shape that would come out as dark as the fabric is either lit differently or left out." },
  // 8. Okt., Markus (ABIrama Neon, "viel zu voll, ein grosser Fleck"): "Darfst du so aendern, aber bitte achte darauf, dass die
  // Fuellungen, zum Beispiel bei ABIrama, oder die Konturen so sind, dass sie nicht zulaufen." Vorher: komplette Buehne mit
  // Laser-Raster bis zum Horizont, Sonne und Glow aus gestaffelten Halo-Ringen - auf dem Stoff ein Block, und die dichten Ringe
  // verschmelzen im DTF-Druck. Jetzt: einzelne Neon-Teile frei auf dem Stoff, klare Roehren, offene Buchstaben, Mindestabstaende.
  neon: { label: "Neon", desc: "Synthwave, Glühen, 80er",
    text: "1980s synthwave neon sign art, built as SEPARATE NEON PIECES standing free on the fabric - like single neon signs hung on a dark wall, NOT a complete lit-up scene: no full stage, no laser grid running to a horizon, no filled sky or background behind the pieces. The lettering is bent neon tube: a bold, even tube stroke with a cream-white core and one crisp coloured outline around it - no soft glow, no blur, no stacked halo rings, no fade. PRINTABLE AND OPEN: the inner spaces of the letters (the holes in a, b, d, e, o, p, R, A) stay clearly open; between two tubes, two outlines or two letters there is always a clean gap at least as wide as the tube itself, so nothing runs together in print; no hairlines thinner than the tube. A few accents in the same tube technique - a striped retro sun cut by horizontal gaps, a palm silhouette, a star, a single laser beam - each standing on its own with bare fabric around it. Palette: hot pink, electric purple and cyan with cream-white tube cores, deep midnight blue only as small solid accents. No daylight colours, no distressed textures, no serif typography." }
};
// 2. Okt., Markus: "noch zwei weitere Stile: einmal Glitter, alles voll mit Glitzer, und einmal Disco,
// wirklich wie in den Siebzigern, mit Spiegelkugeln." Beide nach seinem Prinzip vom 27. Sept.: das
// MATERIAL mit seinen Zufaellen beschreiben (Flocken, Pailletten, Spiegelplaettchen), nicht einen Effekt
// - sonst malt das Modell seinen eigenen glatten Schimmer.
// 6. Okt., Markus (gedruckt): "Das muss viel mehr glitzern und viel eher rueberkommen, dass es auch Glitzer ist." Die winzigen
// Flocken des ersten Textes gehen im DTF-Druck unter (nur 0 oder 100 % Deckung, alles unter 1 mm verschwimmt zu Brei). Glitzer
// muss im Druck GROSS und HART sein: grobe Facetten mit Schwarz-Weiss-Kontrast in jeder Flocke, viele grosse weisse Sternblitze,
// Pailletten mit hellem Lichtmond - wie Glitzer auf einem Foto mit Blitz, nicht wie Glitzer aus der Ferne.
STYLES.glitzer = { label: "Glitzer", desc: "Alles voller Glitzer und Pailletten",
  text: "MAXIMUM GLITTER, PHOTOGRAPHED WITH A FLASH: every shape of the motif - lettering, figures, objects - is solid chunky glitter, and it must read as GLITTER at first glance from three metres away. The glitter is COARSE, not fine: big angular flakes and hexagonal facets, each one clearly visible (as big as a lentil at print size, never smaller than 2 mm), packed edge to edge. Every flake is HARD-CONTRASTED in itself: one side blazing near-white where the flash hits it, the other side deep and dark, so each area is a mosaic of bright and dark facets - this sharp light-dark flicker is what makes glitter look like glitter in print. Over that, MANY big crisp white four-point and eight-point star glints with long thin rays, sitting on the edges and peaks of the shapes, some large enough to cross a letter. Big round sequins with a bright crescent highlight and a dark rim are layered on the outlines. The lettering is fat and rounded, stuffed with glitter, with a bold dark outline so it stays readable. No soft glow, no blur, no airbrush haze, no tiny dust that would print as a grey smear - only big, sharp, high-contrast sparkle. Palette: gold, silver and rose or holographic violet-teal flakes, each area in one colour family with its own near-white highlights and deep shadow facets." };
STYLES.disco = { label: "Disco", desc: "70er, Spiegelkugeln, Tanzfläche",
  text: "1970s DISCO, like a record sleeve from 1977: a big mirror ball built from hundreds of small square mirror tiles, every tile reflecting its own patch of colour, throwing round light spots and thin beams across the whole motif. An illuminated dance floor of glowing coloured glass squares in perspective. The lettering is fat 70s bubble script or chrome-edged display type with stacked rainbow-stripe shadows in orange, gold, magenta and purple, plus starburst sparkles at the corners. If people appear they wear the era: flared trousers, platform shoes, wide collars, sequinned tops, afro or feathered hair, frozen mid dance move. Rendered as airbrush and screen print of the time: soft airbrushed gradients, a fine halftone dot in the shadows, slightly warm, slightly off-register ink. Palette: sunset orange, mustard gold, hot magenta, violet and chocolate brown on deep night purple. No neon tubes, no laser grid, no synthwave sun - that is the 1980s, not disco." };
// 21. Sept., Markus: "Wie vorgesehen austauschen gegen Robotic - alles im Cyber-Stil, alles im
// Robotics-Style." Der Standard bleibt die stille Vorgabe; als waehlbare Kachel steht hier Robotic.
STYLES.robotic = { label: "Robotic", desc: "Cyber, Roboter, Chrom, Schaltkreise",
  text: "Cyber robotics look: the whole motif re-imagined as sleek robots, mech parts and cybernetic machinery - brushed chrome and gunmetal plates, carbon-fibre panels, hydraulic joints, cables, glowing circuit traces and hexagonal armour, small HUD readouts and scanlines. Palette: steel grey, gunmetal and electric blue with neon-cyan light lines and one hot orange accent. Hard clean edges, crisp metallic shading, no hand-drawn wobble. The lettering is a futuristic techno typeface with bevelled metal faces and thin glowing edges. No photorealistic real people - people become androids or armoured figures." };
// 13. Okt., Markus: "Streetart erweiterst du um weitere Streetart-Kuenstler" - auf seine Zustimmung zu den Vorschlaegen.
// Sein Street-Art-Text bleibt Wort fuer Wort; dazu zieht jedes Design EINE Technik, wie sie bekannte Street-Art-Kuenstler
// gepraegt haben (Schablone wie Blek le Rat/C215, Paste-up wie Baby Guerrilla/Jaune, Propaganda-Poster wie Shepard Fairey,
// Sticker-Bombing, Fliesen-Mosaik wie Invader, Figuren-Wandbild wie KAWS/Os Gemeos). Die Namen stehen NUR hier im Kommentar,
// nie im Auftrag - die Bild-KI soll die Technik malen, kein Werk eines Kuenstlers nachbauen.
STYLES.streetart.techniken = [
  "STENCIL: multi-layer hand-cut spray-paint stencil on a weathered wall, 3-5 flat tonal layers sprayed light to dark with slight misregistration, crisp cut edges with a soft overspray halo, visible stencil bridges, paint drips and drifting mist, wall texture showing through thin coats, limited palette with one bold accent colour. Flat tones, never airbrushed gradients.",
  "PASTE-UP: wheatpasted paper posters on rough brick or concrete, the figures hand-printed in black ink on thin off-white paper, assembled from several overlapping sheets with visible seams, wrinkles, air bubbles and glossy paste sheen, cut out along the figures, torn and peeling edges revealing older posters beneath, sun-faded and rain-stained.",
  "PROPAGANDA POSTER: screen-printed street poster in red, black and cream ink on off-white paper, high-contrast figures reduced to flat posterised shapes, radiating sunburst and ornamental border, halftone dots and aged-newsprint texture, slight ink misregistration, heavy condensed sans-serif capitals, pasted on the wall and partly torn. A flag, if any, is the one exception to the three inks: a flat panel in its exact true colours.",
  "STICKER BOMBING: the motif sits on a dense cluster of overlapping slap stickers - hand-drawn marker tags on blank postal labels and name-tag stickers, die-cut vinyl with white borders, glossy and matte mixed, half-torn layers leaving white paper residue and glue ghosts, sun-faded colours, scuffs and rust peeking through; many styles and sizes, never a neat grid, never real brands or logos.",
  "TILE MOSAIC: the key figures are pixel art built from small square glazed ceramic tiles cemented to the wall, each tile one pixel on a strict grid, visible grey grout lines, slightly uneven tiles catching the light, flat saturated 8-bit colours, crisp stepped edges with no curves, weathered with grime and chipped corners.",
  "CHARACTER MURAL: a large hand-painted mural on a building facade, the person turned into a stylised character with patterned clothing, flat roller-painted colour fields with spray-paint shading and hand-painted outlines, bold graphic shapes, wall seams, windows and pipes interrupting the paint, matte house paint, sun-faded patches - never a glossy 3D render, never a copy of a known cartoon character."
];
// 13. Okt., Markus: "Ein neuer Stil ist mit sehr viel Totenkoepfen - recherchiere, was die best laufenden Totenkoepfe sind."
// Recherche (Gelato, Inkdyno, Tapstitch, Accio, Sullen Clothing, 13. Okt.): Tattoo-Totenkopf mit Rosen/Dolch/Schlange,
// Zuckerschaedel (Calavera), Blumen-Totenkopf, Punk mit Sicherheitsnadeln, Biker mit Fluegeln, Piraten mit Knochen,
// "spooky cute", Skelett-Cowboys und tanzende Skelette - 2026 nicht mehr nur zu Halloween.
STYLES.totenkopf = { flaggeEcht: true, label: "Totenkopf", desc: "Viele Totenköpfe, Tattoo, Zuckerschädel",
  text: "SKULL ART with MANY skulls: the whole subject is told with skulls, skeletons and bones, built like a sheet of tattoo flash or a skull parade. Mix several of the best-selling skull lanes, each skull clearly one of them: American-traditional tattoo skull with roses and a ribbon banner (heavy even black outlines, whip shading); floral vanitas skull with roses, peonies and poppies growing around it; joyful Posada-style calavera with marigolds, candles and folk ornament; cute-spooky skull with rounded shapes and big eye sockets; winged skull; skeletons dancing, toasting and playing out the theme in its own places, wearing its hats and holding its objects. Every skull is stylised but believable, always WITH its lower jaw, grinning or calm. The real people of the design stay ALIVE and recognisable with their own faces, hair and clothes - never turned into skulls or skeletons; at most they wear a small skull pin or hold a skull-shaped object. Companions: roses, banners, wings, flames, stars, moons, a snake coiling AROUND a skull. COLOUR IS CRISP AND BRILLIANT: razor-sharp clean linework and fully saturated, luminous spot colours - vivid crimson red, bright marigold yellow-orange, rich emerald green, one clear turquoise accent - with clean bright bone white against deep solid black for maximum contrast; never muted, dusty, faded, sepia, aged-paper or vintage-washed. Clear negative space, closed sticker-like groups, 3-5 flat spot colours, no soft gradients or transparency, shading only as solid hatching or coarse halftone, lines at least 0.5 mm. NEVER: any sword, dagger, knife, blade, arrow or spike through or into a skull, nothing pierces anything; crossed bones under a frontal skull or anything resembling the SS/Nazi Totenkopf, military badges, runes, eagles; gore, blood, splatter, wounds; band, club or brand logos." };
// 13. Okt., Markus: "recherchiere ueber den Kuenstler Bengtzon" - gemeint ist Lisa Bengtsson (Studio Lisa Bengtsson, Stockholm):
// kraeftige, malerische Muster, Tiere und Pflanzen, die sich stapeln und wiederholen (ihre Nilpferde klettern aufeinander).
// Dazu der "Bengtsson-Effekt" aus seiner Recherche: Schwarz-Weiss mit genau EINER ultra-gesaettigten Akzentfarbe, und
// Retro-Folklore - laendliche Muster modern und clean. Ihr Name steht nur hier, nie im Auftrag.
STYLES.skandifolk = { flaggeEcht: true, label: "Skandi-Folk", desc: "Schwarz-weiß, das Wahrzeichen grell",
  text: "SKANDI-FOLK, a modern Swedish folk-pattern print: everything in black, white and soft greys on a warm off-white paper ground. Flat, poster-like shapes that feel hand-cut or brush-made, with slightly irregular edges. Motifs: stylised kurbits flowers and leaves, Dala-horse-like animals, birds, fruit, frames and stripes, big and confident - animals may climb on top of each other in a playful repeat, arranged with ornamental borders or symmetry, clear grid, generous white space, one witty hidden detail drawn in black. EXACTLY ONE element of the whole image is fully coloured, and it is the LANDMARK: the main landmark of the place (for example the Eiffel Tower) - or, where there is no place, the single most important object of the theme - filled in ONE glaring, ultra-saturated neon colour (neon pink, neon orange, acid green or electric blue), flat and solid, so it glows out of the black-and-white image. All colour stays inside that one shape. Everything else, including people, buildings, sky and lettering, stays black and white. Lettering in bold sans-serif or simple hand lettering, black only. A flag in true colours counts as the one coloured element. NEVER: a second coloured element; colour scattered as small dots, flowers, hearts or confetti; gradients, shading, glow or 3D; photorealism; muted multicolour palettes; Sami symbols." };
export const STYLE_KEYS = Object.keys(STYLES);
// Der Stiltext fuer einen Auftrag: bei Stilen mit Techniken (Street Art) kommt genau eine dazu, fest an der Auftragsnummer
// (gleiche Nummer = gleiche Technik in Stufe 1 und Stufe 2), ohne Nummer zufaellig.
const FLAGGE_ECHT = "Any national flag appears ONLY in its exact true colours and correct stripe order (France: vertical blue, white, red from left to right) - never recoloured to fit the palette; if that does not fit the piece, leave the flag out.";
export function stilText(key, seed) {
  const st = STYLES[key];
  if (!st || !st.text) return '';
  const t = Array.isArray(st.techniken) && st.techniken.length ? st.techniken : null;
  if (!t) return st.flaggeEcht ? st.text + ' ' + FLAGGE_ECHT : st.text;
  let h = 0;
  const z = seed ? String(seed) : String(Math.random());
  for (let i = 0; i < z.length; i++) h = (h * 31 + z.charCodeAt(i)) >>> 0;
  return st.text + ' TECHNIQUE OF THIS PIECE (one street-art technique, used for the whole design): ' + t[h % t.length] + ' ' + FLAGGE_ECHT;
}

// ---------- Hell oder dunkel: eine Entscheidung, kein Messwert ----------
// 23. Sept., Markus: "Wenn du doch ein Design selber erstellst, musst du auch wissen, ob du es
// fuer hell oder dunkel gemacht hast - ist doch alles ganz einfach." Er hat recht, und mein
// Fehler war der Weg: Ich habe viermal versucht, das Textil am FERTIGEN Bild zu messen. Alle
// vier Messungen waren unbrauchbar, weil sie dunkle Konturlinien bestrafen, die auf Schwarz
// genau richtig sind. Das Textil ist aber keine Eigenschaft des fertigen Bildes - es ist die
// Entscheidung, die VOR dem Zeichnen faellt, weil sie die Palette bestimmt.
//
// Vorher: 25 von 28 Mottos standen auf "dunkel", und von 17 Stilen bekam genau EINER (Aquarell)
// ein helles Textil. Das war kein Entschluss, das war ein nie angefasster Standardwert.
//
// Die Begruendung steht je Stil in seinem eigenen Palettentext oben - hier steht das Zitat, das
// den Ausschlag gibt. Wer ein Textil aendert, aendert zuerst den Palettentext.
const STIL_TEXTIL = {
  // "PURE WHITE IS PURE WHITE ... lettering and highlights sit in that hard white against deep black"
  streetart: 'dunkel',
  // "Around the word there is nothing ... the fabric is the wall" - die weissen Highlight-Funken
  // brauchen einen dunklen Grund, sonst sind sie unsichtbar.
  graffiti: 'dunkel',
  // Totenkopf: Knochenweiss und harte Tattoo-Linien leuchten auf Schwarz.
  totenkopf: 'dunkel',
  // Skandi-Folk: Schwarz und Weiss tragen das Bild, die Akzentfarbe braucht hellen Grund.
  skandifolk: 'hell',
  // "MOOD IS BRIGHT: warm cream, ivory and sunlit ochre dominate and cover most of the area",
  // dazu ausdruecklich "no pure white inside the motif". Ein Hell-Stil, der bis heute auf Dunkel
  // stand - genau so ein Bild hat Markus gemeint.
  meisterwerk: 'hell',
  // "off-white plus one or two accents" - Off-White traegt das Bild, auf weissem Stoff bliebe
  // davon nichts uebrig. (25. Sept., Markus: "Minimalistic ist doch nicht auf eine Farbe
  // festgelegt, d. h. nur der Stil ist minimalistisch" - die Akzentfarbe kommt seitdem aus dem
  // Motiv, nicht aus einer Liste. Der helle Grund bleibt davon unberuehrt.)
  minimal: 'dunkel',
  // "flat unmixed primary colours ... ON OFF-WHITE" - der Grund selbst ist hell.
  popart: 'hell',
  // "sun-bleached and muted: cream, mustard yellow, burnt orange, rust, olive, dusty teal,
  // faded brown - never bright or saturated". Mitteltoene ohne Leuchtkraft saufen auf Schwarz ab;
  // ein echter 70er-Siebdruck sitzt auf einem cremefarbenen Shirt.
  vintage: 'hell',
  // "bold, even, uniform black outlines, solid black shading with whip-shading and dot stippling"
  // - Schwarz ist hier das Geruest der Zeichnung, nicht der Stoff.
  tattoo: 'hell',
  // "heavy spot blacks for shadows", "cross-hatching" - Tinte auf Papier.
  comic: 'hell',
  // "flat colour areas with visible woodgrain and PAPER TEXTURE, bold black key-block outlines"
  // - ein Holzschnitt ist Druckfarbe auf hellem Papier.
  japan: 'hell',
  // "Exactly two school colours (for example navy and gold, or maroon and cream) plus off-white"
  // - der Varsity-Druck sitzt klassisch auf dem dunklen Koerper.
  college: 'dunkel',
  // "The lightest values are bare untouched paper - never white paint over the top."
  aquarell: 'hell',
  // "Pure graphite ... on off-white, lightly textured drawing paper", "a great deal of paper stays
  // white" - Graphit auf Papier, das Weiss des Stoffs ist das Papier.
  bleistift: 'hell',
  // Bringt seine eigene dark-Zeile mit: "readable because its own materials are lit bright ...
  // against dark fabric".
  fotoreal: 'dunkel',
  // "everything appears lit from within like a neon sign AT NIGHT", "deep midnight blue"
  neon: 'dunkel',
  // "brushed chrome and gunmetal plates ... GLOWING circuit traces", "neon-cyan light lines"
  robotic: 'dunkel',
  // Glitzer funkelt auf dunklem Stoff; "deep night purple" ist der Grund der Disco.
  glitzer: 'dunkel',
  disco: 'dunkel'
  // Bewusst NICHT hier: 'standard' - der Stil hat keine eigene Palette, da entscheidet das Motto.
};

/**
 * Welches Textil gehoert zu diesem Stil?
 * @param {string} style         Stilschluessel; '' oder 'standard' = der Stil entscheidet nicht
 * @param {string} [mottoTextil] Das am Motto hinterlegte Textil - gilt nur ohne Stilvorgabe
 * @returns {'hell'|'dunkel'}
 */
export function textilFuerStil(style, mottoTextil) {
  const eigen = STIL_TEXTIL[style];
  if (eigen) return eigen;
  return mottoTextil === 'hell' ? 'hell' : 'dunkel';
}
/**
 * Worauf wird dieser Auftrag gezeichnet? 27. Sept., Markus (Screenshot: dunkles Textil gewaehlt,
 * weisses Shirt bekommen): "Wichtig ist natuerlich, wenn ein Textil gewaehlt ist, dass das dann
 * auch beim Weiterschicken so benutzt wird." Bis dahin hat der STIL die Wahl des Kunden still
 * ueberschrieben (Comic, Tattoo, Vintage ... -> hell). Jetzt gilt: hat der Kunde einen Ton
 * gewaehlt, wird genau darauf gezeichnet. Der Stil empfiehlt nur noch (die Seite belegt seine
 * Kachel vor und sagt, warum) - entscheiden tut der Kunde. Nur ein Auftrag OHNE gueltigen Ton
 * (alte Seite, fremder Aufruf) faellt auf die Stil-Regel zurueck.
 * @param {string} style   Stilschluessel
 * @param {string} wunsch  der vom Kunden gewaehlte Ton (TEXTILTOENE) oder '' / etwas Ungueltiges
 * @returns {string} einer der TEXTILTOENE
 */
export function textilFuerAuftrag(style, wunsch) {
  const w = String(wunsch || '').toLowerCase();
  if (TEXTILTOENE.includes(w)) return w;
  return textilFuerStil(style, w) === 'hell' ? 'weiss' : 'schwarz';
}
/** Die Tabelle selbst - fuer die Abnahme, das Backend und PREISE-artige Uebersichten. */
export function stilTextilTabelle() {
  return STYLE_KEYS
    .filter(k => k !== 'standard' && !STYLES[k].nurMotto)
    .map(k => ({ key: k, label: STYLES[k].label, textil: STIL_TEXTIL[k] || '' }));
}

// Backend-Aenderungen an den Stilen (storage/styles.json) einspielen; "standard" bekommt keinen Text.
export function applyStyleOverrides(over) {
  for (const k of STYLE_KEYS) {
    const o = over && over[k];
    if (!o) continue;
    if (typeof o.label === 'string' && o.label.trim()) STYLES[k].label = o.label.trim().slice(0, 30);
    if (typeof o.desc === 'string') STYLES[k].desc = o.desc.trim().slice(0, 60);
    // Fassung 14: 900 Zeichen waren zu wenig - ausgearbeitete Stile (Meisterwerk, Street Art, Aquarell)
    // wurden dadurch im Backend stillschweigend abgeschnitten und kamen schwammig heraus.
    if (typeof o.text === 'string' && k !== 'standard') STYLES[k].text = o.text.trim().slice(0, 2000);
    if (typeof o.dark === 'string') STYLES[k].dark = o.dark.trim().slice(0, 600) || undefined;
    STYLES[k].off = !!o.off || !!STYLES[k].weg;
  }
}
export function stylesForAdmin() {
  // textil reist mit: die Mottoseite liest daraus, welche Textilkachel zum Stil gehoert.
  // Es ist bewusst NICHT im Backend aenderbar - wer das Textil dreht, muss den Palettentext
  // des Stils mitdrehen, sonst zeichnet Otto weiter fuer den alten Stoff.
  return STYLE_KEYS.map(k => ({ key: k, label: STYLES[k].label, desc: STYLES[k].desc, text: STYLES[k].text, dark: STYLES[k].dark || '', off: !!STYLES[k].off, textil: STIL_TEXTIL[k] || '' }));
}

// ---------- Farbstimmung: zweiter Knopf neben der Stilauswahl ----------
// Aufbau bewusst exakt wie STYLES, damit sich beides im Backend gleich pflegen laesst.
// Die Texte sind kurz (180-200 Zeichen) - sie haengen an JEDEM Prompt und duerfen kein Budget fressen.
// Fassung 55 (Markus, 16. Sept.): Wie sollen die Leute im Motiv gezeichnet werden? Bisher hat das
// allein der Motto-Text entschieden, und heraus kamen immer aehnliche Strichfiguren. Jetzt waehlt
// der Kunde - und die Wahl faerbt auf das ganze Design ab, bis hin zu der Frage, ob Haende das
// Logo halten koennen.
export const FIGUREN = {
  standard: { label: "Wie vorgesehen", desc: "wie es zum Motto passt", text: "", menschen: true },
  strich: {
    label: "Otto-Strichmännchen", desc: "Spray-Look mit Cap, unser Haus-Stil",
    // Fassung 55: Markus' eigene Strichmaennchen aus dem Motivkatalog - das ist der Hausstil und
    // gehoert genau so beschrieben, sonst malt das Modell beliebige Strichfiguren.
    text: "The people in the scene are stick figures in a spray-can street-art style, exactly like this: every line is a single confident black spray stroke with slightly ragged, sprayed edges and a few paint drips running downward from the joints and feet. Round head drawn as one sprayed circle, a simple X for each eye and NO mouth and no nose, a baseball cap sitting sideways or backwards on the head, thin sprayed arms and legs with small mitten hands and simple shoe shapes. No colour inside the figures, no shading, no faces beyond the two X eyes - black spray on the bare shirt. The figures are lively: they high-five, jump, point, sit, climb, hold things up.",
    menschen: true
  },
  comic: {
    label: "Comic-Figuren", desc: "Gesichter, Charakter",
    text: "The people in the scene are lively cartoon characters with real faces: big expressive eyes, clear grins, individual hair and small props that give each of them character. Bold outlines, exaggerated poses, nothing photo-real.",
    menschen: true
  },
  silhouette: {
    label: "Silhouetten", desc: "Scherenschnitt, plakativ",
    text: "The people in the scene are solid one-colour silhouettes, cut out cleanly like a paper cut: no faces, no inner lines, no shading - only the outline shape tells who they are, through pose, hair and the objects they carry.",
    menschen: true
  },
  maskottchen: {
    label: "Ein Maskottchen", desc: "eine Figur statt Gruppe",
    text: "Instead of a group of people there is ONE mascot character carrying the whole scene: a friendly, memorable figure fitting the theme, drawn large and central with a lot of character, surrounded by the objects and symbols of the subject.",
    menschen: true
  },
  karikatur: {
    label: "Karikaturen", desc: "große Köpfe, viel Charakter",
    text: "The people in the scene are caricatures: oversized heads on small bodies, strongly exaggerated individual features, cheeky expressions, drawn with lively hand-inked lines. Each one is clearly a different character, never a uniform crowd.",
    menschen: true
  },
  helden: {
    label: "Helden-Pose", desc: "dynamisch, von unten gesehen",
    text: "The people in the scene stand like heroes: seen slightly from below, confident wide stances, chins up, strong simplified shapes, motion lines and bursts radiating behind them. Bold, graphic, poster-like - the team looks unstoppable.",
    menschen: true
  },
  keine: {
    label: "Ohne Menschen", desc: "nur Gegenstände und Symbole",
    text: "NO people at all in the image: no figures, no faces, no hands, no arms, no silhouettes of persons. The scene is built entirely from the objects, tools, symbols and landscape of the theme.",
    menschen: false
  }
};
export const FIGUREN_KEYS = Object.keys(FIGUREN);

// 24. Sept., Markus zur Postkarte: "Vielleicht waere es da sogar hilfreich, dass wir ein Teil
// unserer Menschen - Strichmaennchen natuerlich nicht - dort mit einbinden und da lustige Sachen
// erzeugen koennen."
// Wo der Mensch aus einem echten Foto kommt, passen nur die Figurenarten, die einen WIRKLICHEN
// Menschen umzeichnen. Nicht dabei: 'strich' (Markus ausdruecklich), 'maskottchen' (ersetzt den
// Menschen durch eine erfundene Figur - dann waere es nicht mehr seine Karte) und 'keine' (ohne
// Menschen gaebe es die Karte gar nicht, das Selfie ist Pflichtfeld).
export const FIGUREN_FOTO = ['standard', 'comic', 'karikatur', 'silhouette', 'helden'];
// Auf der Karte heisst "Wie vorgesehen" etwas anderes als auf einem Shirt: dort ist es die Vorgabe
// des Mottos, hier ist es der Mensch, so wie er auf dem Foto steht - nur eben gemalt.
const FIGUREN_FOTO_TEXT = { standard: { label: "So wie ihr seid", desc: "gemalt, aber nicht verändert" } };
// 1. Okt., Markus (Abschlussfahrt, Schritt "Wie sollen die Leute aussehen?"): "Am Anfang soll man ein
// Foto hochladen, wo wahrscheinlich auch Menschen drauf sind. Wenn ich da an der Stelle kein Foto
// hochlade, brauche ich nicht die Frage, wie die Menschen aussehen sollen." Und am 2. Okt.: "Figuren-
// Frage ist geklaert." Also bekommen die Mottos mit Figurenwahl (ohne Freestyle, der hat seinen
// eigenen Foto-Weg, und ohne die Postkarte, die das Selfie ohnehin verlangt) einen ersten Schritt
// "Habt ihr ein Foto von euch?" - freiwillig. Mit Foto werden die Leute vom Foto gezeichnet, und
// die Figurenfrage kommt; ohne Foto zeichnet Otto, wie es zum Motto passt, und es gibt keine Frage.
export function gruppenFoto(motto) { return !!(motto && !motto.freestyle && figurenWahl(motto)); }
export const GRUPPENFOTO_FELDER = [
  { key: 'foto', label: 'Habt ihr ein Foto von euch?', type: 'upload', required: false, ohneGeht: true, printed: false, braucht: 'mensch',
    hint: 'Dann zeichnet Otto genau euch ins Design – mit Frisuren, Brillen und euren Klamotten. Ohne Foto zeichnet Otto die Leute so, wie es zum Motto passt. Mit dem Hochladen bestätigst du, dass du das Foto verwenden darfst und alle darauf einverstanden sind.' }
];
// Die Zusage zu den Rechten steht im Hinweis am Foto - wer hochlaedt, hat bestaetigt (wie bei der
// Postkarte, Markus am 20. Sept.: ein Haken, der am Ende fehlt, "killt jeden Prozess").
export function figurenNachFoto(motto) { return gruppenFoto(motto); }
export function figurenFuer(motto) {
  const foto = figurenNachFoto(motto);
  const keys = foto ? FIGUREN_FOTO : FIGUREN_KEYS;
  return keys.filter(k => FIGUREN[k]).map(k => ({
    key: k,
    label: (foto && FIGUREN_FOTO_TEXT[k] && FIGUREN_FOTO_TEXT[k].label) || FIGUREN[k].label,
    desc: (foto && FIGUREN_FOTO_TEXT[k] && FIGUREN_FOTO_TEXT[k].desc) || FIGUREN[k].desc
  }));
}

export const MOODS = {
  standard: { label: "Wie vorgesehen", desc: "Farben passend zum Motto", text: "" },
  // Fassung 53 (Markus, 16. Sept.): Eigene Wahl "alles passend zum Logo". Der Text kommt aus
  // logoPalette, weil nur dort die wirklichen Logofarben bekannt sind. Voreinstellung, sobald
  // ein Logo hochgeladen ist - wer bewusst etwas anderes waehlt, bekommt das andere.
  logo: { label: "Passend zum Logo", desc: "Farben aus dem Logo", text: "" },
  knallig: { label: "Bunt und knallig", desc: "Signalfarben, voller Kontrast",
    text: "Colour mood: loud and saturated. Use full-strength signal colours at maximum contrast against each other, large confident colour fields, no muted or dusty tones. AT LEAST FOUR clearly different hues from different parts of the colour wheel - never one colour family alone, never an all-blue, all-red or all-green picture. The piece should be visible across a room." },
  dezent: { label: "Dezent", desc: "Gedämpfte Töne, ruhig",
    text: "Colour mood: restrained. Use muted, slightly greyed tones in a narrow related range, soft contrast, no signal colours and no neon. The piece should read as calm and grown-up rather than loud." },
  clean: { label: "Clean", desc: "Reduziert, viel Luft",
    text: "Colour mood: reduced. Two or three colours in total, generous empty space, no decorative extras, every element earning its place. The piece should read as clear and uncluttered." }
};
export const MOOD_KEYS = Object.keys(MOODS);

// Backend-Aenderungen an den Farbstimmungen (storage/moods.json) einspielen; "standard" bekommt keinen Text.
export function applyMoodOverrides(over) {
  for (const k of MOOD_KEYS) {
    const o = over && over[k];
    if (!o) continue;
    if (typeof o.label === 'string' && o.label.trim()) MOODS[k].label = o.label.trim().slice(0, 30);
    if (typeof o.desc === 'string') MOODS[k].desc = o.desc.trim().slice(0, 60);
    if (typeof o.text === 'string' && k !== 'standard') MOODS[k].text = o.text.trim().slice(0, 600);
    MOODS[k].off = !!o.off;
  }
}
export function moodsForAdmin() {
  return MOOD_KEYS.map(k => ({ key: k, label: MOODS[k].label, desc: MOODS[k].desc, text: MOODS[k].text, off: !!MOODS[k].off }));
}

// ---------- Druckplatzierung auf dem Kleidungsstueck ----------
// Nicht zu verwechseln mit upload.place - das sagt, wo das Logo IM Motiv sitzt.
// Jede Platzierung ist eine eigene Druckdatei mit eigenem Format und eigener Motivdichte:
// ein 10x10-Brustprint bekommt EIN Element, kein Panorama. Masse aus der DTF-Recherche,
// ab 2XL kommen 10-15 % dazu. Die Canvas-Groesse muss an den Generator gehen, nicht die Motto-Groesse.
export const PRINT_PLACEMENTS = {
  // Fassung 74 (Markus, 17. Sept.: "Ich bekomme eine E-Mail, dass das Design fertig ist, jetzt auch
  // tatsaechlich mit einer Groesse beschriftet. Aber die ist falsch. Das ist nicht das, was ich
  // angeklickt habe."): Er hatte ein T-Shirt gewaehlt und bekam 9,4 x 9,7 cm. Kein Rechenfehler -
  // die Liste hier begann mit dem 10x10-Brustprint, und die erste Flaeche ist ueberall die
  // Vorauswahl (Auswahlfeld im Browser wie auch der Rueckfall in artikelLeinwand). Wer ein Shirt
  // anklickte und das Feld "Flaeche" nicht bemerkte, bestellte damit still einen Mini-Aufnaeher.
  // Deshalb steht die ganze Vorderseite jetzt an erster Stelle: dasselbe Mass, das jeder
  // Motto-Auftrag ohne Platzierung ohnehin bekommt (36 x 46 cm, siehe PRINT_MAX_CM in images.js).
  // Die kleinen Flaechen bleiben waehlbar - sie sind nur nicht mehr das, was ungefragt passiert.
  vorne: { label: "Vorne, ganze Fläche", mass: "36 x 46 cm", size: "1024x1536",
    text: "PLACEMENT: the full front print, 36 x 46 cm, portrait. This is the whole front panel and the big stage - one complete composition, taller than wide, using the full height from chest to hem." },
  brust_klein: { label: "Brust links (klein)", mass: "10 x 10 cm", size: "1024x1024",
    text: "PLACEMENT: a small left-chest print, 10 x 10 cm, square. ONE single compact emblem or mark - no scene, no panorama, no background field. Few, large, clearly separated elements; the smallest detail must survive at 10 cm." },
  brust_gross: { label: "Brust mittig (groß)", mass: "28 x 20 cm", size: "1536x1024",
    text: "PLACEMENT: a wide chest print, 28 x 20 cm, landscape. Build the composition wider than tall, spreading across the width." },
  ruecken: { label: "Rücken (groß)", mass: "30,5 x 35,6 cm", size: "1024x1536",
    text: "PLACEMENT: a large back print, 30,5 x 35,6 cm, portrait. This is the big stage - a full composition with foreground, motif and surrounding detail, taller than wide." },
  nacken: { label: "Nacken (klein)", mass: "10 x 5 cm", size: "1536x1024",
    text: "PLACEMENT: a small neck print, 10 x 5 cm, a wide flat strip. ONE line of lettering or one tiny mark, nothing else - it must stay readable at 5 cm height." },
  aermel: { label: "Ärmel", mass: "8 x 25 cm", size: "1024x1536",
    text: "PLACEMENT: a sleeve print, 8 x 25 cm, a tall narrow strip. Stack the elements vertically along the strip - no wide composition." },
  kapuze: { label: "Kapuze", mass: "10 x 12,7 cm", size: "1024x1024",
    text: "PLACEMENT: a hood print, 10 x 12,7 cm, nearly square and small. ONE compact motif, no scene." }
};
export const PLACEMENT_KEYS = Object.keys(PRINT_PLACEMENTS);
export function placementsForPublic() {
  return PLACEMENT_KEYS.map(k => ({ key: k, label: PRINT_PLACEMENTS[k].label, mass: PRINT_PLACEMENTS[k].mass, size: PRINT_PLACEMENTS[k].size }));
}

// ---------- Fassung 22: die groesste erlaubte Leinwand je Druckformat ----------
// Grenzen von gpt-image-2. Die Pixelgrenze von 8,29 Megapixeln ist die eigentliche Fessel:
// hohe Hochformate landen dadurch bei gut 200 dpi, nicht bei 300. Ein Bitmap hochzurechnen
// erfindet keine Schaerfe - darum endet die Kette in vectorize.js (SVG, aufloesungsunabhaengig).
export const BILD_GRENZEN = {
  maxKante: 3840, raster: 16, minPixel: 655360, maxPixel: 8294400,
  minVerhaeltnis: 1 / 3, maxVerhaeltnis: 3
};
// Ab dieser Aufloesung ist eine Leinwand druckfertig (300 dpi plus Luft) - groesser wird nur langsamer.
export const LEINWAND_ZIEL_DPI = 320;
// Die Stufen, die der Bilddienst kennt (gpt-image-2.5: alle sechs; aeltere Modelle nur bis
// 'high', darum der Rueckfall in server.js). EINE Wahrheit - server.js und die Motto-Datei
// pruefen gegen dieselbe Liste, sonst laesst sich im Backend eine Stufe eintragen, die der
// Auftragslauf gar nicht kennt.
export const BILD_STUFEN = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'];
// Welche Stufe gilt fuer diesen Auftrag? Drei Ebenen, die vorderste gewinnt:
//   1. die Motto-Datei ('bildStufe' - Postkarte: 'high')
//   2. der Backend-Schalter (bildmodell.json, gilt fuer alles)
//   3. IMAGE_QUALITY (Umgebung)
// Der Rueckfall ist etwas anderes als eine Wahl: Er entsteht, wenn der Bilddienst eine Stufe
// ablehnt, die das eingestellte Modell nicht kann - das betrifft nur 'xhigh' und 'max'. Eine
// bewusst gewaehlte niedrigere Stufe darf er nicht anheben oder ueberschreiben, sonst zoege ein
// einziger abgelehnter Lauf alle Mottos auf dieselbe Stufe.
// 22. Sept.: Was an einem Motto STRUKTUR ist (kein Text des Chefs), muss auch dann ankommen,
// wenn die Fassungsnummer nicht hochgezaehlt wurde oder das Motto im Backend bearbeitet ist -
// genau daran ist die Bildstufe beim ersten Anlauf haengen geblieben: Vorlage geaendert, Motto
// auf dem Volume blieb bei seedRev 10, und die Postkarte lief weiter auf 'max'.
// Was der Chef selbst gesetzt hat, bleibt: nachgezogen wird nur, was FEHLT.
// Reine Rechnung, damit die Abnahme sie ohne laufenden Server pruefen kann.
export function seedStruktur(vorlage, vorhanden, felder) {
  const setzen = {};
  for (const f of felder || []) {
    const soll = (vorlage || {})[f];
    const ist = (vorhanden || {})[f];
    if (soll === undefined || soll === '' || soll === false) continue;   // die Vorlage will nichts
    if (ist === undefined || ist === '' || ist === false) setzen[f] = soll;
  }
  return setzen;
}
// 22. Sept., Markus ("wie schliessen wir die andere Luecke?"): Ein Saat-Eintrag trug bisher nur
// Text und Felder. Alle Schalter standen allein auf dem Volume - und der Server legt ein
// fehlendes Motto mit {...Eintrag} an, nimmt also genau das, was in der Saat steht, und fuer
// alles andere den Standard aus sanitizeMotto. Gemessen an den 29 Mottos: dreizehn kaemen nach
// einem leeren Volume falsch zurueck. Elf verloeren nur ihre Akzentfarbe, aber "freestyle"
// waere kein Freestyle mehr (freestyle, artikelPflicht, fotoUpload, noExtra alle weg) und
// Deshalb: was vom Standard ABWEICHT, gehoert in die Saat.
// SAAT_STANDARD haelt fest, was sanitizeMotto einsetzt, wenn die Saat schweigt.
export const SAAT_STANDARD = {
  active: true, styleChoice: true, kader: true, colorChoice: true, moodChoice: true, vary: true,
  markenfrei: false, placementChoice: false, nurLogo: false, gewerblich: false, freestyle: false,
  artikelPflicht: false, fotoUpload: false, noExtra: false, einfach: false,
  research: false, requiresApproval: false, ohneAbfolge: false,
  artikelFest: '', listeWort: '', researchField: '', researchKind: '', backPrompt: '',
  backNamesField: '', sample: '', bildStufe: '', accent: '#ffc542',
  stileVorne: [], abfolge: []
};
/** Welche Werte eines Mottos wuerde ein leeres Volume FALSCH zurueckbekommen?
 *  Reine Rechnung ueber SAAT_STANDARD - die Abnahme prueft sie ohne laufenden Server.
 *  Ein Schluessel, den das Motto gar nicht nennt, IST der Standard und fehlt der Saat nicht. */
export function saatLuecken(motto, eintrag) {
  const m = motto || {}, e = eintrag || {};
  const fehlt = [];
  for (const [k, standard] of Object.entries(SAAT_STANDARD)) {
    const ist = m[k];
    let gleich;
    if (Array.isArray(standard)) gleich = !Array.isArray(ist) || !ist.length;
    else if (typeof standard === 'boolean') gleich = (ist === undefined ? standard : !!ist) === standard;
    else gleich = String(ist === undefined ? standard : (ist ?? '')) === String(standard);
    if (gleich) continue;          // Motto steht auf dem Standard - die Saat muss nichts sagen
    if (k in e) continue;          // die Saat nennt den Schluessel bereits
    fehlt.push(k);
  }
  return fehlt;
}

// Reine Rechnung, damit die Abnahme sie ohne Bildlauf pruefen kann.
export function stufeFuer(motto, backend = '', standard = 'max', rueckfall = '') {
  const gewuenscht = (motto && BILD_STUFEN.includes(String(motto.bildStufe || '')) ? String(motto.bildStufe) : '')
    || (BILD_STUFEN.includes(String(backend || '')) ? String(backend) : '')
    || standard;
  return (rueckfall && ['xhigh', 'max'].includes(gewuenscht)) ? rueckfall : gewuenscht;
}

// Groesste Leinwand fuer eine Druckflaeche in Zentimetern, unter Einhaltung ALLER Regeln
// und mit moeglichst genauem Seitenverhaeltnis - sonst sitzt die Druckdatei spaeter nicht
// passgenau in der Flaeche. Sucht in 16er-Schritten, das sind ein paar hundert Versuche.
export function druckLeinwand(cmB, cmH) {
  // Fassung 24: artikel.js ruft mit einem Paar [breite, hoehe] auf - beides geht.
  if (Array.isArray(cmB)) { cmH = cmB[1]; cmB = cmB[0]; }
  const b0 = +cmB, h0 = +cmH;
  if (!(b0 > 0) || !(h0 > 0)) return null;
  // Das Modell kann nur zwischen 1:3 und 3:1. Ein schmaleres Format (z. B. der Aermel mit
  // 8 x 25 cm = 1:3,1) laesst sich nicht exakt treffen. Das wird gekappt - aber NICHT still:
  // verzugProzent misst immer gegen das echte Mass, verhaeltnisGekappt sagt, dass es passiert ist.
  const zielRoh = b0 / h0;
  const ziel = Math.min(Math.max(zielRoh, BILD_GRENZEN.minVerhaeltnis), BILD_GRENZEN.maxVerhaeltnis);
  let beste = null;
  for (let h = BILD_GRENZEN.raster; h <= BILD_GRENZEN.maxKante; h += BILD_GRENZEN.raster) {
    const b = Math.round(ziel * h / BILD_GRENZEN.raster) * BILD_GRENZEN.raster;
    if (b < BILD_GRENZEN.raster || b > BILD_GRENZEN.maxKante) continue;
    const px = b * h;
    if (px < BILD_GRENZEN.minPixel || px > BILD_GRENZEN.maxPixel) continue;
    const v = b / h;
    if (v < BILD_GRENZEN.minVerhaeltnis || v > BILD_GRENZEN.maxVerhaeltnis) continue;
    const fehler = Math.abs(v - ziel) / ziel;
    if (fehler > 0.01) continue;                       // mehr als 1 % Verzug waere sichtbarer Versatz
    // 21. Sept.: die Postkarte (14,8 x 10,5 cm) wurde mit 3376 x 2432 px gezeichnet - 580 dpi,
    // 8 Megapixel, ueber sechs Minuten beim Bilddienst; die Seite verspricht "in einer Minute".
    // Der Druck braucht 300 dpi, mehr Pixel machen ihn nicht schaerfer, nur langsamer. Also:
    // die KLEINSTE Leinwand, die 300 dpi (mit etwas Luft: LEINWAND_ZIEL_DPI) erreicht; erst wo
    // keine Leinwand so weit kommt (Shirt 36 x 46 cm, Kissen, Poster, Tuch), bleibt es die groesste.
    const reicht = Math.min(b / (b0 / 2.54), h / (h0 / 2.54)) >= LEINWAND_ZIEL_DPI;
    if (reicht) { if (!beste || !beste.reicht || px < beste.px) beste = { b, h, px, fehler, reicht }; }
    else if (!beste || (!beste.reicht && px > beste.px)) beste = { b, h, px, fehler, reicht };
  }
  if (!beste) return null;
  const verzug = Math.abs(beste.b / beste.h - zielRoh) / zielRoh;
  return {
    breite: beste.b, hoehe: beste.h, size: `${beste.b}x${beste.h}`, px: [beste.b, beste.h],
    dpi: Math.round(beste.b / (b0 / 2.54)),
    // Fassung 73 (Markus, 17. Sept.: "Ich habe Strandtuch angegeben, es muesste also 70 x 140
    // sein"): Die gerundete dpi-Zahl ist zum ANZEIGEN da. In die Druckdatei gehoert der exakte
    // Wert - mit 70 statt 69,64 dpi kommt ein Strandtuch als 70,2 x 139,3 cm heraus statt als
    // 70,6 x 140,6. Ein Zentimeter zu kurz ist bei einem Handtuch schon sichtbar.
    //
    // Das Bildmodell kann nur bestimmte Kantenmasse, also trifft die Leinwand das Verhaeltnis
    // nie auf den Punkt (verzugProzent misst, wie weit). Darum die KLEINERE der beiden
    // dpi-Zahlen: dann deckt die Datei beide Masse mindestens ab. Bei randlosem Druck wird
    // ohnehin beschnitten - ein halber Millimeter zu viel faellt weg, ein halber zu wenig
    // hinterlaesst einen unbedruckten Streifen an der Kante.
    dpiExakt: Math.min(beste.b / (b0 / 2.54), beste.h / (h0 / 2.54)),
    verzugProzent: Math.round(verzug * 1000) / 10,
    verhaeltnisGekappt: ziel !== zielRoh,
    experimentell: Math.max(beste.b, beste.h) > 2560 || Math.min(beste.b, beste.h) > 1440
  };
}

// Fassung 24: Textilien im Freestyle-Katalog (T-Shirt, Hoodie) tragen keine eigenen Masse -
// sie holen ihre Druckflaechen hier ab, aus denselben Platzierungen wie jedes andere Motto.
// EINE Wahrheit, nicht zwei. Nicht zu verwechseln mit GARMENTS in mockups.js (Vorlagenfotos).
function cmVon(keys) {
  const out = {};
  for (const k of keys) { const m = massInCm(PRINT_PLACEMENTS[k] && PRINT_PLACEMENTS[k].mass); if (m) out[k] = [m.b, m.h]; }
  return out;
}
// Die REIHENFOLGE ist eine Zusage, keine Geschmacksfrage: Platz eins ist das, was ein Kunde
// bekommt, der nur den Artikel anklickt. Deshalb steht 'vorne' vorn (siehe Fassung 74 oben).
export const GARMENTS = {
  shirt: { label: 'T-Shirt', cm: cmVon(['vorne', 'brust_klein', 'brust_gross', 'ruecken', 'nacken', 'aermel']) },
  hoodie: { label: 'Hoodie', cm: cmVon(['vorne', 'brust_klein', 'brust_gross', 'ruecken', 'nacken', 'aermel', 'kapuze']) }
};
export function placementFor(key) {
  return PRINT_PLACEMENTS[key] || null;
}

// Zentimeter aus der Massangabe der Platzierung lesen ("30,5 x 35,6 cm").
function massInCm(mass) {
  const m = /([\d,.]+)\s*[x×]\s*([\d,.]+)/.exec(String(mass || ''));
  if (!m) return null;
  const z = (s) => parseFloat(String(s).replace(',', '.'));
  const b = z(m[1]), h = z(m[2]);
  return (b > 0 && h > 0) ? { b, h } : null;
}

// Sonderfaelle je Teil, falls eine Druckflaeche dort kleiner ist als im Standardmass.
// Bewusst leer: belastbare Masse je Teil liegen mir nicht vor, und geratene Masse waeren
// schlimmer als gar keine. Eintragen als 'platzierung|teil': { b, h } in Zentimetern.
export const LEINWAND_SONDER = {};

// Die Leinwand fuer eine Platzierung (optional je Teil). Ohne Platzierung: null, dann
// bleibt es bei der Groesse des Mottos.
export function leinwandFuer(place, garment) {
  const p = PRINT_PLACEMENTS[place];
  if (!p) return null;
  const cm = LEINWAND_SONDER[`${place}|${garment}`] || massInCm(p.mass);
  if (!cm) return null;
  const l = druckLeinwand(cm.b, cm.h);
  return l ? { ...l, place, garment: garment || null, mass: p.mass } : null;
}

// ---------- Unikat-Variation: jedes Teil bekommt eine eigene Mischung ----------
// Der Master-Prompt legt Aufbau und Texte fest; diese Zutaten werden je Auftrag zufaellig gezogen,
// damit nie zweimal dasselbe Motiv mit nur anderem Namen entsteht.
export const VARIETY = {
  // 2. Okt., Markus: "es darf nicht jedes Design im Endeffekt die gleichen Abmasse haben, die gleichen
  // Rundungen, dass alles gleich aussieht ... wenn ich ein Shirt von einem Angler hab, dann muss da
  // eine grosse Angel zu sehen sein, Fisch". Gemessen: von den acht alten Aufbauten waren fuenf ein
  // Abzeichen (Bogen-Kopfzeile mit Banner, Band, Kreis, Raute, Wappen), und die Druckregel verlangte
  // zusaetzlich "a free-standing emblem". Jetzt ist das Abzeichen EINER von zehn Aufbauten.
  layout: [
    'POSTER: the main motif is huge and dramatic and fills most of the print area, the headline set boldly across its lower part - no badge, no ring, no banner around it',
    'TYPE IS THE DESIGN: the words are the artwork - huge expressive lettering filling the width, the motif only as a detail woven into or between the letters',
    'BREAKOUT: the main motif bursts out of a simple rough shape (a torn square, a brush circle) and overlaps its edge, the text set tight below',
    'ACTION DIAGONAL: the motif moves dynamically across the print on a strong diagonal, the headline follows the same diagonal',
    'ASYMMETRIC: the motif large and off-centre to one side, the texts stacked small and clean on the other side',
    'ICON: one bold, very simple graphic motif like a sign, with one short line of text under it - lots of bare fabric',
    'MOTIF AS FRAME: a small scene is drawn INSIDE the outline of the main object (inside the fish, the guitar, the heart), the text beneath',
    'TALL STACK: a narrow vertical composition like a vintage poster strip - headline at the top, motif in the middle, the small line at the bottom',
    'VINTAGE BADGE: a classic round or shield-shaped emblem with the text along its edge',
    'HEADLINE FIRST: the headline huge and dominant, the motif small underneath like a signature'
  ],
  // 2. Okt., gemessen: beim Streifen 25 x 10 cm zog die Liste oben Raute, Kreis oder Wappen - das
  // Modell malte ein rundes Emblem von 9 bis 14 cm in die Mitte, links und rechts leeres Shirt.
  // Fuer ein breites Mass (formatAusMass 'breit') kommt der Aufbau aus dieser Liste.
  layoutBreit: [
    'one long horizontal row: the main motif on the left, the headline stretched out to the right of it',
    'the headline stretched across the full width, small motifs at both ends',
    'a long waving ribbon across the full width carrying the main text, the motif in its middle',
    'the main motif in the centre, the texts running out to the left and the right of it like wings',
    'two halves side by side: the motif on one side, the stacked texts on the other'
  ],
  ornament: [
    'a few scattered stars and sparkles',
    'sunburst rays behind the motif',
    'laurel branches at the sides',
    'halftone dot shading in the background shapes',
    // 5. Okt.: 'thin double-line frame with corner flourishes' ist raus - ein gezeichneter Kasten um das Motiv
    // (Markus zur Bowling-Tasche: "dieser komische Schatten").
    'paint splatter and ink drips as accents',
    'small geometric confetti pieces',
    // Fassung 64: "worn, distressed print texture" ist raus - Markus, 16. Sept.: "Warum sind die
    // Raender so ausgefranst?" Absichtlich abgenutzte Kanten lesen sich im Druck als Fehler.
    'no ornaments at all, clean and reduced'
  ],
  // 5. Okt., Markus: "Es sieht immer gleich aus. Da steht jetzt Hamburg immer oben drueber. Hamburg kann mal in der Mitte
  // stehen, dann kann alles drumherum gebaut werden. Hamburg kann von unten nach oben geschrieben werden, 1000 Variationen
  // ... Im Idealfall sieht der Kunde nicht im ersten Schritt, dass das ganz normal mit KI gemacht ist." Gemessen an acht
  // Hamburg-Designs: jedes Mal Bogen-Schrift oben, Motiv, Spruchband unten - der Aufbau aus layout aenderte daran nichts,
  // weil niemand sagte, WO die Schrift steht. Darum ein eigener Zug fuer den Platz der Hauptschrift (nicht beim Abzeichen
  // und nicht beim breiten Band).
  schriftPlatz: [
    'the main word runs VERTICALLY up one side of the motif, read from bottom to top, as tall as the whole design',
    'the main word sits right ACROSS THE MIDDLE of the design, the motif is built around and behind it and comes out on both sides',
    'the main word stands at the BOTTOM, very large and dead straight like a foundation, the motif rises out of it',
    'the main word is broken into two or three short stacked lines of letters, and the motif cuts through between them',
    'the main word is small and quiet, set tight under the motif in widely spaced capitals - the picture carries the design',
    'the main word is part of the motif itself - painted on the object, the sign, the scarf or the wall in the picture - not floating above it',
    'the main word runs on a steep diagonal across the design and overlaps the motif',
    'the main word is huge and straight at the top, the motif tucked tight under and into its letters, no arch',
    'the main word is set in a narrow column beside the motif, one letter under the other'
  ],
  // 8. Okt., Markus: "Designs bauen, wo nicht jeder vorzieht, dass es KI ist - mit Unterbrechungen, nicht zugekleistert. Und
  // versuchen, dass die Motive nicht alle immer die gleiche Form haben. Gerade mit dem Vorhang kann man doch spielen, mit dem
  // Namen kann man spielen ... viel, viel stylisher, nicht einfach nur ein grosser Fleck mit bisschen bunter Farbe drauf."
  // Gemessen an drei ABIrama-Neon-Laeufen: jedes Mal ein dichter, kompakter Block, jede Ecke gefuellt. Darum je Auftrag ein
  // eigener Zug fuer Dichte und Umriss - er gilt auch bei gewaehltem Stil (der Stil sagt, WIE gemalt wird, nicht wie voll).
  luft: [
    'AIRY: only the essentials - the main motif, the headline and one small line - with clear gaps of bare fabric between them; nothing is glued together into one block',
    'SPLIT: the design falls into two or three separate parts with bare fabric between them (for example the headline floating above, the motif below, the small line set apart) - read together, but not touching',
    'OPEN SILHOUETTE: single elements reach out of the design on different sides (a curtain swinging out, a beam of light, a raised hand, a flying object) so the outline is jagged and unique - never a compact rounded blob',
    'NEGATIVE SPACE: part of the main motif is formed by bare fabric - cut-out shapes, the fabric showing through the letters or through the object - so the design breathes from the inside',
    'REDUCED: one strong motif and the words, no background scene and no filler behind them - the bare fabric around them is part of the look',
    'INTERRUPTED: the main shape is broken by deliberate gaps - a frame or curtain that stops and starts again, a line that is cut, letters that overlap the motif and leave it open'
  ],
  lettering: [
    'heavy slab-serif block lettering',
    'condensed tall sans-serif lettering',
    'varsity-style college lettering with an inline stroke',
    'brush script for the headline, small caps for the rest',
    'rounded bubbly lettering with a thick outline',
    'classic engraved serif lettering',
    'stencil lettering with cut gaps',
    'hand-drawn sign-painter lettering'
  ]
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Das Format eines freien Masses (Breite x Hoehe in cm). 'breit' ab 1,8 : 1 (Streifen 25 x 10).
export function formatAusMass(b, h) {
  const r = +b / +h;
  if (!(r > 0)) return '';
  if (r >= 1.8) return 'breit';
  if (r >= 1.15) return 'quer';
  if (r <= 1 / 1.15) return 'hoch';
  return 'quadrat';
}
const FORMAT_WORT = { breit: 'WIDE HORIZONTAL BAND, far wider than tall', quer: 'landscape', quadrat: 'square', hoch: 'portrait' };

export function pickVariation(motto, opts = {}) {
  if (motto && motto.vary === false) return null;
  const own = String((motto && motto.variations) || '').split('\n').map(l => l.trim()).filter(Boolean);
  const parts = [];
  if (own.length) parts.push(pick(own));
  const aufbau = pick(opts.format === 'breit' ? VARIETY.layoutBreit : VARIETY.layout);
  parts.push('layout: ' + aufbau);
  if (opts.format !== 'breit' && !/^VINTAGE BADGE/.test(aufbau)) parts.push('placement of the main lettering (this decides where the text goes, over anything the layout says): ' + pick(VARIETY.schriftPlatz.filter(x => !(/^(TYPE IS|HEADLINE FIRST)/.test(aufbau) && /small and quiet/.test(x)))) + ' - NOT the stock look of an arched headline over the motif with a ribbon banner underneath');
  // 8. Okt. (siehe VARIETY.luft): Dichte und Umriss je Auftrag, auch beim breiten Band; dazu die Absage an den vollen Block.
  parts.push('density and outline: ' + pick(VARIETY.luft) + ' - stylish and graphic like a designer streetwear print, NOT a dense sticker where every corner is filled, NOT one big colourful blob, no filler details just to fill space');
  // Bei gewaehltem Kunststil bestimmen Schmuck und Schrift der Stil, nicht der Zufall
  if (!opts.styled) {
    parts.push('ornaments: ' + pick(VARIETY.ornament));
    parts.push('lettering: ' + pick(VARIETY.lettering));
  }
  return parts.join('; ');
}

// Fassung 10: Logo-Integration - die freie Flaeche bekommt die Form des Kundenlogos, und das Motiv umarmt sie
export const LOGO_SHAPES = {
  breit: 'a wide horizontal wordmark, about three times wider than tall',
  hoch: 'an upright emblem, clearly taller than wide',
  rund: 'a round emblem',
  quadratisch: 'a compact, roughly square emblem'
};
// Fassung 29: "um das Logo herum gebaut" heisst: die Elemente laufen HINTER dem Logo durch und
// beruehren seinen Rand. Der Ring "at a small distance" ist raus - genau der ergab das Loch mit
// Luft drumherum. Und "company name" ist zu "main text" geworden, die Rahmen gelten fuer jedes Motto.
// Fassung 51 (Markus, 16. Sept.: "die Haende aus der Menschenmenge tragen das Logo - einfach nur
// draufgeknallt bringt keine Punkte"): Die freie Flaeche darf nicht nur ausgespart sein, sie muss
// einen GRUND haben. Das Motiv traegt, haelt, umrahmt oder zeigt sie. Kein Wort ueber Logo - das
// Modell baut nur einen Traeger fuer eine leere Flaeche, und genau da sitzt spaeter das Logo.
// Traeger fuer die freie Flaeche. Zwei Gruppen, weil nicht jedes Motiv Menschen zeigt: Haende,
// die niemandem gehoeren, sind Unsinn (Markus, 16. Sept.: "wenn keine Menschen da sind, kann es
// auch nicht auf den Haenden getragen werden"). Die erste Gruppe passt IMMER, die zweite nur,
// wenn im Motiv ueberhaupt Figuren vorkommen.
export const FREI_TRAEGER_ALLE = [
  'a heavy ribbon banner is stretched between two elements of the scene and the empty area sits inside it like the field of the banner',
  'the empty area is the face of an object from the theme - a sign, a display, a plaque, a dial - and the frame of that object surrounds it closely',
  'sun rays, sparks and splashes burst outwards from directly behind the empty area, their inner ends hidden by it',
  'the empty area hangs from a bar, a rope or a chain above it, with knots, rings or hooks touching its upper edge',
  'a wreath or an arch built from the materials and objects of the theme is pressed tightly around the empty area',
  'two wings, flags or branches spread out left and right from behind the empty area, their roots hidden by it',
  'the empty area rests on a pedestal built from objects of the theme, with ornaments climbing up its sides',
  'the main objects of the theme are crossed behind the empty area, their ends showing on all sides'
];
export const FREI_TRAEGER_MENSCHEN = [
  'several hands reach up out of the crowd from below and hold the empty area up like a sign, fingers gripping its lower edge',
  'two figures of the scene lift the empty area together, one on each side, their arms and hands touching its edge',
  'one figure of the scene holds the empty area in front of their chest like a board, both hands on its edge',
  'the figures of the scene stand in a half circle around the empty area and look towards it, shoulders touching its edge'
];
// Zeigt dieses Motto ueberhaupt Menschen? Grobe, aber verlaessliche Lesart des Motto-Prompts.
export function hatMenschen(motto) {
  const t = (String(motto && motto.prompt || '') + ' ' + String(motto && motto.title || '') + ' ' + String(motto && motto.slug || '')).toLowerCase();
  return /\b(people|person|persons|figure|figures|crowd|team|crew|friends|group|kids|children|silhouett|hands|arms|family|guests|players|colleagues|students|pupils|graduates|class|dancers|riders|fans|squad|couple|bride|groom|baby|supporters|spectators|audience|hikers|runners|dancers|crowd)\b|menschen|figuren|gruppe|freunde|kollegen|familie|mannschaft|team|crew|schueler|abiturient|jahrgang|klasse|kader|verein|fans|zuschauer|publikum|anhaenger/.test(t);
}
// 21. Sept., Markus: "Die Menschen-Auswahl nur noch da, wo es Sinn macht - Firmenausflug,
// Freestyle, wo koennte es noch passen?" Die Wortsuche (hatMenschen) traf zu viel: Baby, Handwerker
// (Silhouetten ohne Gesicht), Fan-Embleme, Kinder-Tiershirt. Die Auswahl "Wie sollen die Leute
// aussehen?" gibt es nur noch bei Mottos, in deren Motiv wirklich Menschen als Figuren stehen.
// Ein Motto kann es in seiner Datei ausdruecklich an- oder abschalten (figurenChoice: true/false).
export const FIGUREN_MOTTOS = ['freestyle', 'firmenausflug', 'junggesellenabschied', 'kegeltour', 'abschlussfahrt', 'schulmotto', 'malle-fahrt', 'familie', 'karneval', 'weihnachtsfeier', 'vereinsjubilaeum', 'hochzeit', 'darts', 'bowling'];
export function figurenWahl(motto) {
  if (!motto) return false;
  if (motto.figurenChoice === true) return true;
  if (motto.figurenChoice === false) return false;
  return FIGUREN_MOTTOS.includes(String(motto.slug || ''));
}
export function traegerFuer(motto) {
  const liste = hatMenschen(motto) ? FREI_TRAEGER_ALLE.concat(FREI_TRAEGER_MENSCHEN) : FREI_TRAEGER_ALLE;
  return liste[Math.floor(Math.random() * liste.length)];
}

// Fassung 57 (Markus, 16. Sept.): "Das Design soll um das Logo herum gebaut werden - Banner, Kette,
// Haende tragen." Das Modell kann keine Flaeche freihalten und kein mitgegebenes Logo stehen lassen -
// aber es kann zuverlaessig einen LEEREN TRAEGER zeichnen: ein Banner, ein Schild, eine Plakette,
// gehalten von der Szene (das leere Namensbanner im Ruegen-Design war makellos). Genau dieser
// Traeger wird bestellt, hinterher gemessen, und das Original-Logo wird auf seine leere Flaeche
// gedruckt. Nichts wird gestanzt, nichts ueberdeckt - die Flaeche ist leer, weil sie so bestellt war.
export function logoTraegerPrompt(t) {
  return `${t.mitName ? "THE CUSTOMER'S REAL LOGO AND A PERSON'S NAME ARE PRINTED INTO THE ARTWORK AFTERWARDS - BOTH ONTO ONE CARRIER THAT YOU DRAW (the logo onto a blank plaque, the name onto a plain blank band or ribbon directly below that plaque, as part of the same object). " : "THE CUSTOMER'S REAL LOGO IS PRINTED INTO THE ARTWORK AFTERWARDS - ONTO A CARRIER THAT YOU DRAW. "}Therefore: ${t.traeger}. The face of that carrier is ${t.form}, about ${t.breite} percent of the picture wide and ${t.hoehe} percent tall, ${t.text}. Its face is ONE smooth, EVENLY COLOURED ${t.farbe} surface in a single flat colour: no print, no pattern, no emblem, no logo, no lettering, no symbol, no number, no seams, no folds, no shading, no gradient and no texture inside it - it stays completely bare, like a sign waiting for its print. The outline of the carrier may have a simple drawn border or edge; the face stays plain. The carrier is the heart of the design, never a small badge in a corner: the scene holds, frames or presents it, and figures, ornaments and splashes touch its edge and continue behind it. Do NOT draw any logo, emblem, wordmark, badge, seal, monogram or company name anywhere in the image - the carrier stays empty. Do not leave an empty band at the bottom of the composition - the artwork fills its own shape.`;
}
export function logoTraegerForm(aspect) {
  const a = +aspect || 1;   // Breite geteilt durch Hoehe
  if (a >= 1.6) return 'a wide rectangular plaque, banner field or sign with straight edges';
  if (a > 0.8 && a < 1.25) return 'a round or square sign, medallion, shield or badge face';
  if (a <= 0.8) return 'an upright rectangular sign or plaque';
  return 'a rectangular sign or plaque';
}

export const LOGO_FRAMES = [
  'bold sun rays fan out from directly behind the reserved area, their inner ends hidden by it',
  'two laurel branches rise left and right of the reserved area, touching its edge, and meet above it',
  'a ribbon banner passes behind the reserved area, its ends fluttering out to both sides',
  'sparks, splashes or dust burst out from behind the reserved area, starting right at its edge',
  'the two main objects of the theme are crossed behind the reserved area, their ends showing at the sides',
  'a thick rope, chain or scarf wraps tightly around the reserved area, touching its edge with no gap',
  'an arch of small stars or rivets sits right on the upper edge of the reserved area',
  'two wings spread out from behind the reserved area, their roots hidden by it',
  'the reserved area rests on a decorated pedestal or plinth, ornaments climbing up its sides',
  'a wreath of the theme\'s materials or leaves is pressed tightly around the reserved area',
  'lightning bolts, flames or beams radiate from behind the reserved area, their bases hidden by it',
  'the main text below curves in an arch that hugs the bottom edge of the reserved area like a seal'
];

// Nimmt dem Motto-Text die Vorschrift, WO das Logo sitzt. Grundsatz (Fassung 15): das
// Design wird immer um das Logo herum gebaut, nie das Logo an einen festen Platz genagelt.
// Der Grundsatz stand im Code, aber der Motto-Text hat ihn ueberstimmt - "freie Flaeche,
// darunter der Firmenname" ist genau so ein fester Platz. Und ohne Logo blieb davon ein
// leeres Schild uebrig. Die Regeln in buildPrompt sind ab hier die einzige Quelle dafuer.
// Der PFLICHTTEXT bleibt erhalten: nur die Ortsangabe faellt weg, nicht "{firma}".
function logoStelleRaus(parts) {
  for (let i = 0; i < parts.length; i++) {
    parts[i] = String(parts[i])
      .replace(/Leave one clearly bounded empty area for the [^.]*\.\s*Draw nothing inside it\.\s*/gi, '')
      // Fassung 29: auch "In the middle leave a clearly empty rectangular area ..." (Fanclub) und
      // "Leave a clearly empty area of roughly one quarter ..." (Malle) - beide nagelten die Mitte fest
      .replace(/(In the (middle|centre|center),? )?leave (an?|one) (clearly )?(bounded )?empty( \w+)? area[^.]*\.\s*(Do not draw any [^.]*\.\s*)?/gi, '')
      .replace(/,?\s*and the empty logo area as above/gi, ' as above')
      .replace(/\s*Below the empty area,\s*/gi, '')
      .replace(/the empty area for the logo and /gi, '')
      // Fassung 60 (22. Sept., Markus: "wir haben doch umgebaut, dass es keine festen Stellen
      // fuer irgendwas gibt"): Zwei Motto-Texte sagten die Stelle ohne das Wort "leave" an und
      // sind durch alle Regeln oben geschluepft - Vereinsjubilaeum als Aufzaehlungspunkt
      // ("a clearly empty area, roughly one third of the width, for the club's own crest"),
      // Firmenausflug als Lagebeschreibung ("the top quarter of the composition stays completely
      // empty for the company logo"). Ohne Logo stand dann beides im selben Auftrag: die
      // bestellte Leerflaeche UND "Do NOT reserve or leave any empty area". Ein Auftrag, der
      // sich selbst widerspricht - und das Modell hat sich fuer das Loch entschieden.
      .replace(/^[-\s]*an? (clearly )?empty[^.\n]*\bfor the [^.\n]*\.[^\n]*\n?/gim, '')
      .replace(/^[-\s]*the [^.\n]{0,60}\bstays (completely )?empty\b[^.\n]*\.[^\n]*\n?/gim, '');
  }
}

// Fassung 60: Dieselbe Ortsangabe steckt auch in den Variationen ("laurel wreath around the
// empty emblem area") und in der Variations-Ansage selbst. Die werden erst NACH logoStelleRaus
// angehaengt, also hat sie bisher nichts geputzt. Kommt ein Logo, ist die Flaeche richtig und
// wird weiter oben zum Logo bzw. zum Traeger umbenannt; kommt keins, darf sie gar nicht
// vorkommen - dann ist die Stelle einfach die Mitte des Motivs.
function logoFlaecheNeutral(parts) {
  for (let i = 0; i < parts.length; i++) {
    parts[i] = String(parts[i])
      // Der Artikel darf fehlen: die Variationen schreiben "empty emblem area in the middle"
      // genauso wie "around the empty emblem area". Nach "no", "any" oder "or" bleibt die Stelle
      // stehen - dort steht das VERBOT der Flaeche, und das gehoert genau so in den Auftrag.
      .replace(/(?<!\b(?:no|any|or)\s)\b(?:the\s+|an?\s+)?(?:free|empty|reserved)(?:\s+\w+)?\s+area\b(?:\s+for the logo)?/gi, 'the central motif')
      .replace(/,?\s*keep all texts, the central motif and the print rules/gi, ', keep all texts and the print rules');
  }
}

// Fassung 29: Die Farben des hochgeladenen Logos bestimmen die Palette des Designs. Hat der Kunde
// selbst Farben gewaehlt, bleiben seine die Hauptfarben und das Logo faerbt nur die Akzente -
// sonst widersprechen sich zwei Farbansagen und das Modell nimmt keine von beiden ernst.
// Fassung 34: Schrift darf NIE in die Logo-Flaeche ragen. "the headline ... touches its upper
// edge" hat das Modell so verstanden, dass die Kopfzeile in die Flaeche hineinlaufen darf -
// und das Logo deckte sie danach halb zu. Jetzt steht es unmissverstaendlich da.
const LOGO_TEXT_FREI = 'Every letter of every text stays completely outside the reserved area - no word, no ornament and no line crosses into it, because whatever lies there ends up hidden behind the emblem.';
// Das Mass der Flaeche haengt vom Format ab: 40 % der Breite sind auf einem Hochformat richtig,
// auf einem 25 x 10 cm Brustbanner waere das Logo damit so hoch wie das ganze Motiv. server.js
// rechnet den Anteil aus Leinwand und Logo-Form aus (logo.pct, logo.hoehePct); ohne Angabe gilt 40.
function logoMass(logo) {
  const pct = logo && +logo.pct > 0 ? Math.round(+logo.pct) : 40;
  const hp = logo && +logo.hoehePct > 0 ? Math.round(+logo.hoehePct) : 0;
  return `it spans about ${pct} percent of the artwork's width${hp ? ` (about ${hp} percent of its height)` : ''}, not less`;
}
function logoPalette(logoColors, customerColors, mood) {
  const lc = String(logoColors || '').trim();
  if (!lc) return '';
  // Fassung 53: Klare Rangfolge. 1. Der Kunde hat Farben getippt - die gelten, das Logo gibt nur
  // Akzente. 2. Der Kunde hat "Passend zum Logo" gewaehlt (oder nichts gewaehlt, dann ist das die
  // Voreinstellung) - die Logofarben sind die Palette. 3. Der Kunde hat eine andere Stimmung
  // gewaehlt (bunt und knallig, dezent, clean) - die Stimmung gewinnt, das Logo gibt Akzente.
  if (customerColors) return ` The logo's main colors are ${lc}: pick them up in the ribbons, outlines and accents so the emblem looks like a natural part of the artwork.`;
  const nachLogo = mood === 'logo' || !mood || mood === 'standard';
  if (nachLogo) return ` The logo's main colors are ${lc}. THESE ARE THE COLORS OF THE WHOLE DESIGN: use them as the dominant palette for lettering, ribbons, rays and ornaments, plus cream, black and one neutral - so the emblem and the artwork read as one piece.`;
  return ` The logo's main colors are ${lc}: pick them up in a few ribbons, outlines or accents so the emblem does not look foreign - but do NOT make the whole design that color. The palette of the artwork comes from the chosen colour mood, not from the logo.`;
}

export function buildPrompt(motto, values, extra = {}) {
  // Felder "je Person" werden nicht gemalt: jede Zeile, die den Platzhalter nennt, faellt weg
  let template = String(motto.prompt || '');
  // 2. Okt.: die erste Zeile der Motto-Auftraege sagt "portrait". Hat der Kunde ein Mass gewaehlt,
  // nennt sie das echte Format - sonst gewinnt sie gegen "Printed area 25 x 10 cm" am Ende.
  if (extra.format && FORMAT_WORT[extra.format]) {
    const [kopf, ...rest] = template.split('\n');
    template = [kopf.replace(/\bportrait\b/i, FORMAT_WORT[extra.format]), ...rest].join('\n');
  }
  for (const f of (motto.fields || [])) {
    if (!f.personal) continue;
    const re = new RegExp('\\{' + f.key + '\\}');
    template = template.split('\n').filter(l => !re.test(l)).join('\n');
  }
  // Fassung 24: Bei Otto Freestyle stehen die Textzeilen ohne [[...]] im Master-Prompt
  // ('- small: "{text_klein}"'). Eine leere Zeile wuerde als 'small: ""' stehen bleiben und das
  // Modell malt dann Anfuehrungszeichen. Zeilen, deren Platzhalter alle leer sind, fallen weg.
  // 20. Sept., Postkartenart: Kachel-Felder ('wahl') stehen im Auftrag als Kuerzel (collage,
  // panorama ...); in den Prompt kommt der Text der gewaehlten Kachel. Das passiert HIER, damit
  // jeder Aufrufer (Auftrag, Vorzeige, Abnahme) denselben Prompt bekommt.
  const werte = werteFuerPrompt(motto, values);
  if (motto.freestyle) {
    template = template.split('\n').filter(l => {
      const keys = [...l.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(x => x[1]);
      return !keys.length || keys.some(k => String(werte[k] || '').trim());
    }).join('\n');
  }
  let body = fillPrompt(template, werte);
  const style = stilText(extra.style, extra.seed || extra.jobId);
  if (style) body = body.replace(/^\s*Style:.*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
  const colors = extra.colors ? String(extra.colors).trim() : '';
  const parts = [body];
  // Der Name ist Programm: "Die Strandhaie" bekommen Haie, "Die Ankerwerfer" einen Anker - nicht
  // irgendein Urlaubsmotiv. 22. Sept.: das zweite Beispiel war "Alle Neune" = neun Kegel. Im Motto
  // Bowling stand dieser Satz dann neben der Regel "niemals neun Pins" und widersprach ihr direkt.
  // Ein Beispiel darf nie gegen die Sachkunde eines Mottos arbeiten - deshalb ein neutrales.
  if (Object.values(werte || {}).some(v => HAT_EMOJI.test(String(v || '')))) parts.push(EMOJI_SATZ);
  parts.push('If any of the texts above names something concrete - an animal, an object, a place, a profession or a theme (a crew called "Strandhaie" means beach sharks, a team called "Die Ankerwerfer" means anchors) - the central motif must show exactly that thing, clearly and prominently. The variation below then only decides the arrangement and the props around it.');
  // Fassung 62 (Markus, 16. Sept., ChatGPT-Vergleich "der hat sofort Ruegen aufgegriffen"): ein
  // genanntes Reiseziel oder eine Stadt praegt die Szenerie - Kreidefelsen und Leuchtturm fuer
  // Ruegen, Skyline fuer Hamburg - nicht nur als Wort, sondern als Bildwelt hinter dem Motiv.
  const zielFeld = (motto.fields || []).find(f => ['ziel', 'stadt'].includes(f.key) && values[f.key] && String(values[f.key]).trim());
  // 9. Okt., Markus (Karneval-Design mit Harlekin und Federmaske): "Karneval ist aber eher gerade in Koeln, mit einer
  // Narrenkappe und nicht so wie ein Eulenspiegel". Nachgesehen: die Koelner Narrenkappe ist das "Schiffchen" (Kraetzchen,
  // Elferratsmuetze) in Rot-Weiss, geringelt oder als Flicken, mit goldener Borte - internetkarneval.de, kappeskoeln.shop.
  if (motto.slug === 'karneval' && Object.values(values || {}).some(v => /k(ö|oe|o)ln|k(ö|oe)lle|cologne/i.test(String(v || '')))) parts.push(KOELN_KARNEVAL);
  if (zielFeld) parts.push(`THE PLACE "${String(values[zielFeld.key]).trim()}" SETS THE SCENERY: show its most recognisable real landmarks, landscape or skyline (coast, cliffs, lighthouse, mountains, harbour, famous buildings - whatever this place is known for) as the backdrop and surroundings of the motif, so that anyone who knows the place recognises it at once. Keep it in the same print style as the rest, no photo.`);
  // Wird in diesem Auftrag ueberhaupt eine leere Flaeche fuer ein Logo bestellt? Die Antwort
  // braucht die Stilzeile (gleich) und die Variationszeile (weiter unten) - beide zeigten bisher
  // auf eine Flaeche, die es bei Mottos ohne Logo-Upload nie gab. Die Bedingungen spiegeln die
  // Kette unten Zweig fuer Zweig: Platzhalter, eingearbeitetes Logo und Vorlage setzen ein
  // ECHTES Logo, keine Leerflaeche; logoMoeglich verbietet sie sogar ausdruecklich.
  const logoFlaecheKommt = extra.logoZoneFrei ? true
    : (extra.logoPlatzhalter || extra.logoEingearbeitet || extra.logoVorlage) ? false
      : !!((extra.logo && (extra.logo.colors || extra.logo.shape)) || extra.logoColors);
  if (extra.reference) parts.push('The uploaded reference photo shows the customer\'s own subject - it may be a vehicle (e.g. a tractor or motorcycle), a farm animal, a pet, a building or anything else. Redraw EXACTLY WHAT IS IN THE PHOTO as the central motif in the chosen art style - keep its true kind, recognizable shape, colour and key details. Never change it into a different object (do not turn an animal into a vehicle or vice versa). Render it as a bold print illustration, not a photograph. Keep the emblems and badges that belong to the vehicle as they are - it is the customer\'s own machine.');
  if (extra.research) parts.push(extra.research);
  if (style) {
    // Fassung 23: Ein Stil darf einen eigenen Abschlusssatz mitbringen (STYLES[k].satz). Meisterwerk
    // braucht ihn: "Render EVERY ... letter in this technique" malte die Buchstaben mit Pinselstruktur,
    // Facetten und Goldflecken - das war das "Schwammige". Dasselbe Muster wie STYLES[k].dark.
    const satz = (STYLES[extra.style] && STYLES[extra.style].satz)
      || 'Render the ENTIRE artwork - motifs, ornaments and letters - in exactly this technique, no other style mixed in.';
    // 23. Sept.: "and the empty logo area as above" stand hier unbedingt. Bei jedem Motto MIT
    // Logo raeumt logoStelleRaus() den Halbsatz spaeter wieder weg - aber bei einem Motto ganz
    // OHNE Logo-Upload laeuft keine dieser Regeln, und der Halbsatz blieb stehen und zeigte auf
    // eine Flaeche, die nie bestellt wurde. Aufgefallen beim Nachzeichnen der Stilbeispiele.
    parts.push(`ART STYLE (mandatory): ${style}\n${satz} Keep the composition${logoFlaecheKommt ? ', all texts and the empty logo area' : ' and all texts'} as above.`);
    // 2. Okt., Markus zu Steffi im Aquarell: "Schleiermotive, die sind so nicht druckbar". Gemessen an 30
    // neuen Entwuerfen: saubere Drucke haben 2-9 % halbdurchsichtige Pixel (nur die Kantenglaettung),
    // Aquarell, Street Art, Graffiti und Vintage bis 37 %. Der Stil darf seine Technik behalten - aber
    // jede Farbe liegt DECKEND auf dem Stoff; Lasur, Nebel und Abrieb werden zu harten deckenden Flecken.
    parts.push(STOFF_DECKEND);
  } else {
    // Fassung 65 (Markus, 16. Sept.: "Mir geht es um die Schaerfe"): Gemessen ist die Druckdatei
    // scharf - die Kantenrampe liegt bei 0,25 mm auf 36 cm. Weich WIRKT sie, weil das Modell ohne
    // Stilvorgabe malerisch arbeitet: Pinselstruktur in den Flaechen, weiche Verlaeufe, ausgefranste
    // Konturen. Nachtraeglich glaetten macht Farbflecken (getestet). Also hier bestellen, was ein
    // Textildruck braucht: flache Farbflaechen und exakte Kanten. Nur ohne gewaehlten Stil - ein
    // Stil bringt seine eigene Technik mit (Aquarell, Meisterwerk, Vintage leben von Textur).
    if (!(extra.fassung ? extra.fassung === 'schlank' : schlank())) parts.push('CLEAN FLAT PRINT ARTWORK: every colour area is ONE even, flat colour - no brush strokes, no painted or canvas texture, no paper grain, no noise, no airbrush, no soft shading and no gradient inside a shape. Volume and shadow only as clearly separated flat tones, two or three steps at most. Every outline and every edge is crisp, smooth and exact, as if cut from vinyl or drawn as a vector - no frayed, rough or sketchy edges. Letters have clean even edges and solid flat fills.'
      // Fassung 72 (Markus, 17. Sept.: "die Berge total weich oben gezeichnet"): Vorne flach, hinten
      // verwaschen - das Modell behandelt Hintergruende wie ein Gemaelde. Der Hintergrund gehoert
      // ausdruecklich dazu, sonst bleibt die halbe Grafik weich.
      + ' THIS APPLIES TO THE BACKGROUND EXACTLY AS TO THE FOREGROUND: mountains, sky, water, trees, distant scenery, rays and clouds are built from the same flat, clearly bounded colour shapes with crisp outlines - never soft, misty, blurred, airbrushed or faded, never a painted haze and never a colour that fades into nothing at the top or at the edges.');
  }
  // Fassung 60: merken, ob am Ende gar kein Logo kommt - dann muss auch die Variation von der
  // alten festen Stelle befreit werden, und die haengt weiter unten dran.
  let ohneLogo = false;
  if (extra.logoZoneFrei) {
    // Fassung 47: Das Logo kommt spaeter per Software in ein eigenes Band. Das Modell erfaehrt
    // NICHTS davon - kein Platz, keine Form, kein Name. Es zeichnet ein vollstaendiges Motiv.
    logoStelleRaus(parts);
    parts.push(`${extra.logoTraegerFlaeche ? logoTraegerPrompt(extra.logoTraegerFlaeche) : `Do NOT draw any logo, emblem, wordmark, badge, seal, monogram or company sign anywhere in the image, and do not write a company name.${extra.logoFrei ? '' : ' No empty reserved area, no frame and no panel for one either - the artwork is complete in itself and fills its own shape.'}`}${extra.logoFrei ? ` THE MOST IMPORTANT RULE OF THIS IMAGE - AN OPEN SPACE THE DESIGN IS BUILT AROUND: ${extra.logoFrei.text}, about ${extra.logoFrei.breite} percent of the width and ${extra.logoFrei.hoehe} percent of the height, stays COMPLETELY EMPTY. Not a single pixel is drawn there: no figure, no head, no hand, no arm, no letter, no number, no ray, no splash, no star, no dot, no outline, no frame, no shadow, no texture, no faint colour. It is a hole in the artwork - bare shirt fabric shows through it. Whatever you would have drawn in that spot moves OUTSIDE of it, and if the composition gets tight, draw the whole artwork SMALLER rather than letting anything cross into this space. The design is built around it and gives it a REASON to be there: ${extra.logoFrei.traeger}. If that carrier does not fit the scene you are drawing, invent one that does - something from this very theme that holds, frames or presents the space. Never draw hands or arms that belong to nobody, and never a carrier that has nothing to do with the subject. Figures, ornaments, splashes and lettering come right up to the edge of the space, hug it and continue on the other side, so it reads as carried and held by the artwork, never as a gap someone forgot. Everything else in the picture is rich, full and detailed - only this one space stays bare.` : ''}${logoPalette(extra.logo && extra.logo.colors, colors, extra.mood)}`);
  } else if (extra.logoPlatzhalter) {
    // Fassung 44: Der Platzhalter ist eine neutrale Flaeche - und das Wort "Logo" kommt hier
    // bewusst NICHT vor. Sobald das Modell ahnt, dass dort ein Logo hin soll, malt es selbst
    // eins hin (Safety team 2029: der Schriftzug stand dreimal im Bild).
    logoStelleRaus(parts);
    const sig = typeof extra.logoPlatzhalter === 'object' && extra.logoPlatzhalter ? extra.logoPlatzhalter : { hex: '#ff00e6', name: 'magenta' };
    const F = 'the ' + sig.name + ' panel';
    const frame = extra.logoFrame || pick(LOGO_FRAMES).replace(/the reserved area/g, F);
    parts.push(`THE SUPPLIED IMAGE CONTAINS A FLAT ${sig.name.toUpperCase()} PANEL - a plain rounded rectangle in solid ${sig.name} (${sig.hex}). It is a cut-out: that space is already taken and must come out of your image exactly as it went in. Copy it pixel for pixel: same position, same size, same rounded outline, same flat ${sig.name}, no shading, no texture, no gradient, no bevel, no shadow, no border and no frame around it. NOTHING may be drawn inside it or on it: no shape, no figure, no face, no hand, no letter, no number, no word, no symbol, no emblem, no ornament, not a single stroke - it stays one empty flat ${sig.name} area. Do not invent anything to fill it with. Build the whole design AROUND it: ${frame}. Elements run up to ${F} and continue on the other side of it, as if they passed behind it, but nothing overlaps it - they may only touch its edge. The headline sits completely above it; something carries it from below. The artwork touches the ${sig.name} edge on every side - no ring, halo, outline or band of empty space around it. ${F} is the heart of the design, never a badge tucked into a corner. Use ${sig.name} ONLY there, nowhere else in the artwork.${logoPalette(extra.logo && extra.logo.colors, colors, extra.mood)}`);
  } else if (extra.logoEingearbeitet) {
    // Fassung 59 (Markus, 16. Sept., ChatGPT-Beweis "Beim ersten Versuch"): das Modell bekommt das
    // Logo als Bild, zeichnet es sauber NACH und baut das Design darum herum - auch klein auf den
    // Ruecken der Figuren. Nichts wird hinterher daraufgelegt; darum darf das Modell es zeichnen.
    logoStelleRaus(parts);
    const le = extra.logoEingearbeitet;
    const worte = Array.isArray(le.worte) ? le.worte.map(w => '"' + String(w).replace(/"/g, '') + '"') : [];
    const traeger = le.traeger ? String(le.traeger).replace(/the empty area/g, 'the logo') : (extra.logoFrame || pick(LOGO_FRAMES).replace(/the reserved area/g, 'the logo'));
    const beschreibung = le.beschreibung ? ` The logo, described precisely: ${String(le.beschreibung).replace(/\s+/g, ' ').trim()} Reproduce every one of these elements - each ring, bar, frame and colour accent - exactly as described.` : '';
    // Fassung 69 (Markus, 16. Sept.): Ein hochgeladenes Bildschirmfoto wurde mitsamt Adressleiste und
    // Uhrzeit nachgezeichnet - unsere eigene Web-Adresse stand im Kundendesign. Die Vorlage kann alles
    // Moegliche enthalten; gezeichnet wird ausschliesslich das Logo.
    const nurLogo = ` The supplied file may contain more than the logo${le.screenshot ? ' - it IS a screenshot of a screen' : ''}: window or browser frames, an address bar, a web address, a clock, battery or signal icons, tabs, buttons, scrollbars, watermarks, captions or page background. NONE of that belongs in the design. Draw the logo ALONE, freed from its background, and never write a web address, a URL, a time of day, a percentage or any other interface text anywhere in the image.`;
    const schrift = beschreibung + (worte.length
      ? ` The lettering in the logo reads exactly: ${worte.join(', ')}. Reproduce every one of these words completely, correctly spelled, in the same lettering style and position as in the logo - big, sharp and clearly legible. Letters that touch the graphic (a ring, a swoosh, a frame) are part of the lettering, keep them. No letter may be missing, cut off, hidden or replaced.`
      : ' Keep every letter and word of the logo exactly as it is, correctly spelled, big and clearly legible.');
    parts.push(`THE SUPPLIED IMAGE IS THE CUSTOMER'S OWN LOGO. It is the FOUNDATION of this design. REDRAW IT FAITHFULLY as a clean, sharp print illustration: the same shapes, the same layout, the same proportions and the same colours (the supplied file may be small or blurry - your version is crisp and vector-like, never a copy of the blur, never a different logo).${nurLogo}${schrift} Place the logo LARGE in the composition - the biggest single element after the headline, never a small badge tucked into a corner - and build everything else around it: ${traeger}. If that carrier does not fit the scene you are drawing, invent one from this very theme that holds, frames or presents the logo. Never draw hands or arms that belong to nobody. Elements pass BEHIND the logo and come out on the other side; they touch its edge and hug it - no halo, ring, outline or band of empty space around it, and nothing is drawn over it or covers any part of it.${le.menschen ? ' In addition, the SAME logo may appear small on the shirts, backs or caps of the figures as a print on their clothing - drawn simply, but recognisably the same logo. If a blank name surface is ordered elsewhere in this brief, that surface stays completely bare - no logo on it.' : ''} Draw NO other logo, emblem, badge, crest, seal or company name anywhere in the image - only this one logo${le.menschen ? ' and its small repeats on the clothing' : ''}.${extra.textile === 'dunkel' ? ' This print goes on DARK fabric: every black or very dark part of the logo (dark lettering, dark lines) gets a thin, even light keyline around it so it stays readable on the dark shirt - the logo itself keeps its true colours.' : ''}${logoPalette(extra.logo && extra.logo.colors, colors, extra.mood)}`);
  } else if (extra.logoVorlage) {
    // Fassung 37: das Logo liegt als Bild in der Vorlage - an Ort und Stelle. Keine leere Flaeche
    // mehr bestellen, sondern das Design um das SICHTBARE Logo herum bauen.
    logoStelleRaus(parts);
    const frame = extra.logoFrame || pick(LOGO_FRAMES).replace(/the reserved area/g, 'the logo');
    // Fassung 55: der Traeger kommt aus dem Motto (Haende nur, wo Menschen sind), und das Logo darf
    // nirgends ein zweites Mal auftauchen - das Modell neigt dazu, es "zur Sicherheit" zu wiederholen.
    const traeger = extra.logoTraeger ? String(extra.logoTraeger).replace(/the empty area/g, 'the logo') : frame;
    parts.push(`THE SUPPLIED IMAGE CONTAINS THE CUSTOMER'S REAL LOGO, already placed at its final position and size. It is the FOUNDATION of this design - everything else is built around it. Keep it EXACTLY as it is: same position, same size, same shapes, same lettering, same colours. Do not redraw, restyle, recolour, rotate, resize or move it, never cover any part of it, and do NOT draw it a second time anywhere - no copy, no echo, no variation, no other logo, emblem, badge or company name. Build the whole design around it and give it a REASON to be there: ${traeger}. If that carrier does not fit the scene you are drawing, invent one that does - something from this very theme that holds, frames or presents the logo. Never draw hands or arms that belong to nobody. Elements pass BEHIND the logo and come out on the other side; the headline sits completely above the logo; something carries it from below. The artwork touches the logo's edge on every side - NO ring, halo, outline, border or band of empty space around it, no drawn circle or frame around it. The logo is the heart of the design, never a badge tucked into a corner. ${LOGO_TEXT_FREI.replace(/the reserved area/g, 'the logo').replace('hidden behind the emblem', 'covered by the logo')}${logoPalette(extra.logo && extra.logo.colors, colors, extra.mood)}`);
  } else if (extra.logo && (extra.logo.colors || extra.logo.shape)) {
    // Fassung 10: Form und Farben des Kundenlogos bestimmen die freie Flaeche und wie das Motiv sie umarmt
    const shapeText = LOGO_SHAPES[extra.logo.shape] || LOGO_SHAPES.quadratisch;
    const frame = extra.logoFrame || pick(LOGO_FRAMES);
    // Fassung 15, Grundsatz: das Design wird IMMER um das Logo herum gebaut, nie das Logo an einen
    // festen Platz genagelt. Die Regel steht zentral hier und gilt damit fuer jedes Motto mit Upload.
    // Der Motto-Text darf die Stelle NICHT vorschreiben - auch nicht, wenn ein Logo kommt.
    // Sonst steht dort "freie Flaeche, darunter der Firmenname" und nagelt genau den festen
    // Platz fest, den es laut Grundsatz nicht geben soll. Die Regel unten ist die einzige
    // Quelle dafuer, wo das Logo sitzt.
    logoStelleRaus(parts);
    // Fassung 29: "einfach irgendwo in der Mitte Loch lassen und das Logo reinpacken" war das
    // Ergebnis von "reserved area ... grow the composition out of it" - das Modell malte ein Loch
    // mit Luft drumherum. Jetzt steht drin, WIE eingebunden aussieht: die Elemente laufen hinter
    // dem Logo durch und beruehren seinen Rand, kein Ring, kein Hof, keine Luft. Und die Logo-
    // Farben sind die Palette des ganzen Designs, nicht nur "Akzente" - ausser der Kunde hat
    // selbst Farben gewaehlt, dann bleiben seine vorne und das Logo faerbt die Akzente.
    parts.push(`THE DESIGN IS BUILT AROUND THE LOGO. A real emblem (the customer's own logo) is placed into the reserved empty area afterwards. It is ${shapeText}. Make the reserved area exactly that shape, and make it BIG: ${logoMass(extra.logo)} - it is the largest single element after the main headline, never a small badge, medallion or button tucked into another element. Build everything else so it physically holds the emblem: ${frame}. Elements pass BEHIND the reserved area and come out on the other side; the headline sits completely ABOVE the reserved area, its baseline resting on the area's upper edge; something carries it from below. The surrounding artwork touches the edge of the reserved area on every side - NO ring, halo, outline, border or band of empty space around it, no drawn circle or frame that merely encloses a hole. It is the heart of the design - never a leftover gap at an edge, never just parked at the top. Inside the reserved area nothing is drawn: no disc, plate, circle, shield or shape - only transparent background. ${LOGO_TEXT_FREI}${logoPalette(extra.logo.colors, colors, extra.mood)}`);
  } else if (extra.logoColors) {
    logoStelleRaus(parts);
    parts.push(`A real emblem (the customer's own logo) is placed into the reserved empty area afterwards. The reserved area is BIG - ${logoMass(null)}, the largest single element after the main headline, never a small badge or medallion. Build the composition so it physically holds the emblem: elements pass behind the reserved area and come out on the other side, the headline sits completely above it with its baseline on the area's upper edge, the artwork touches its edge on every side - no ring, halo or band of empty space around it. It is the heart of the design, never a leftover gap at an edge. The reserved area itself stays completely empty: no disc, no plate, no circle, no shield, no shape of any kind there - only transparent background. ${LOGO_TEXT_FREI}${logoPalette(extra.logoColors, colors, extra.mood)}`);
  }
  else if (extra.logoMoeglich) {
    // KEIN Logo hochgeladen, das Motto haette aber eins vorgesehen. Dann darf die freie
    // Flaeche NICHT bestellt werden - sonst bleibt ein leeres Schild mitten im Design
    // stehen, und der Kunde bekommt ein Shirt mit einem weissen Rechteck darauf.
    // Genau so passiert und gemeldet. Der Motto-Text fordert die Flaeche bedingungslos;
    // hier wird das zurueckgenommen - erst die Neutralisierung, dann die Ansage.
    logoStelleRaus(parts);
    parts.push('NO logo is added afterwards. Do NOT reserve or leave any empty area, plate, shield, badge, frame, cartouche or blank panel for one, and do not draw an empty box anywhere. Fill the composition completely with the motif and the given texts.');
    ohneLogo = true;
  }
  // 8. Okt., Markus zum Abi-Shirt im Bleistift-Stil (Rot und Gold): "Das hat doch nichts mit einem
  // Bleistift-Stil zu tun, der ist definitiv nur mit Bleistift, sonst waer's ja ein Buntstiftstil" -
  // "Bei den Karten hat's da wunderbar funktioniert." Auf der Karte steht der Stiltext fast allein;
  // im Shirt-Auftrag ueberstimmten Farbwunsch, Farbstimmung und Motto (roter Vorhang) das Graphit.
  // Ein Stil mit nurGraphit bekommt darum keine Farbzeilen und am Ende die Graphit-Regel.
  const nurGraphit = !!(STYLES[extra.style] && STYLES[extra.style].nurGraphit);
  if (colors && !nurGraphit) parts.push(`Color scheme chosen by the customer - make these the dominant colors of the whole design, harmonious and print-safe: ${colors}. ${extra.textile === 'hell' ? 'Keep lettering dark with a light outline so it stays readable on a white shirt.' : 'Keep lettering light with dark outlines so it stays readable on a black shirt.'}`);
  const mood = extra.mood && MOODS[extra.mood] && MOODS[extra.mood].text;
  if (mood && !nurGraphit) parts.push(mood);
  // Fassung 55: Wie die Leute gezeichnet werden, ist eine eigene Ansage - sie steht bewusst NEBEN
  // dem Stil, damit "Comic-Figuren" und "Pop-Art" sich nicht widersprechen, sondern ergaenzen.
  const fig = extra.figuren && FIGUREN[extra.figuren] && FIGUREN[extra.figuren].text;
  if (fig) parts.push(fig);
  // Die Platzierung bestimmt Format und Motivdichte - sie gehoert nach vorne, nicht ans Ende.
  const platz = extra.placement && PRINT_PLACEMENTS[extra.placement] && PRINT_PLACEMENTS[extra.placement].text;
  if (platz) parts.push(platz);
  if (extra.nameZone) parts.push(extra.nameZone);
  // Fassung 60: "keep ... the empty area for the logo" stand hier unbedingt - auch dann, wenn gar
  // kein Logo kommt. Zusammen mit der Ansage oben ("Do NOT reserve or leave any empty area") war
  // das ein Auftrag, der sich selbst widerspricht.
  // 23. Sept.: ohneLogo allein reichte nicht. Es ist nur dann wahr, wenn das Motto ein Logo
  // VORSIEHT und keines hochgeladen wurde. Bei einem Motto ganz OHNE Logo-Upload (Abi, Malle,
  // Weihnachtsfeier ...) blieb es falsch - und die Zeile bestellte weiter "keep ... the empty
  // area for the logo", obwohl im ganzen Prompt nie eine Flaeche bestellt worden war. Ein
  // Auftrag, der auf nichts zeigt, und genau daraus wird das Loch im Design, das Markus meint,
  // wenn er sagt, es soll keine festen Stellen geben. Darum wird jetzt nachgesehen statt geraten:
  // die Flaeche wird nur erwaehnt, wenn ein Teil des Prompts sie wirklich bestellt hat.
  const flaecheBestellt = logoFlaecheKommt && !ohneLogo;
  if (extra.variation) parts.push(`This piece is a one-of-a-kind design - every design of this series must look clearly different. Use this variation for this piece (keep all texts${flaecheBestellt ? ', the empty area for the logo' : ''} and the print rules): ${extra.variation}.`);
  if (extra.consensus) parts.push(`ART DIRECTION FROM THE GROUP (this is a fresh, improved version based on their feedback - keep the same theme and all the required texts above, but apply these concrete changes): ${extra.consensus}`);
  if (extra.extraWish) parts.push(`The customer additionally wants this worked into the design, as motifs or atmosphere where it fits (keep all texts and print rules; licence-safe - never draw real logos, brand names or trademarks, and none of their wordless marks such as three parallel sportswear stripes or a swoosh tick): ${extra.extraWish}.`);
  // Fassung 60: erst jetzt hat die Variation ihren Platz in parts - also jetzt auch sie von der
  // alten Ortsangabe befreien ("laurel wreath around the empty emblem area").
  if (ohneLogo) logoFlaecheNeutral(parts);
  // Wunsch und Gruppen-Feedback sind freier Text vom Kunden - und zwar ANWEISUNGEN, keine
  // Druckinhalte. Die Bild-KI malt sie aber gern als Schrift ins Motiv: gemeldet wurde ein
  // Shirt, auf dem oben "VORNE NAME AN BRUST" stand. Das ist ein Platzierungswunsch, der
  // befolgt und nicht geschrieben werden sollte. Die Regel steht ABSICHTLICH hinter den
  // beiden Bloecken - spaetere Anweisungen im Prompt wiegen schwerer.
  if (extra.consensus || extra.extraWish) {
    parts.push('The block(s) directly above are DIRECTION, not content. Never render their words or any part of them as lettering in the artwork. The only words that may appear as letters are the texts explicitly quoted in double quotes earlier in this prompt. An instruction about position or placement ("on the chest", "at the front", "name goes here", "logo bigger") must be FOLLOWED, never written into the picture.');
  }
  // Fassung 74 (Markus, 17. Sept.: "Beim Sprueche Shirt sind die Buchstaben begrenzt. Ist
  // natuerlich doof fuer laengere Sprueche."): Die Grenze ist hoch - jetzt muss der Prompt auch
  // sagen, WIE ein langer Satz gesetzt wird. Ein Witz mit Pointe in einer Zeile wird auf dem
  // Shirt zu einem unlesbaren Band, und das Modell faengt an, Buchstaben zu verschlucken.
  // Es zaehlt nur, was wirklich als Schrift ins Motiv geht: das sind die Felder, die der
  // Master-Prompt in Anfuehrungszeichen setzt ("{spruch}"). Ein Themenfeld wie "wunsch" steht
  // ohne Anfuehrungszeichen im Prompt und ist damit Regie, kein Druckinhalt - der bleibt aussen vor.
  const gedrucktLang = (motto.fields || [])
    .filter(f => f.printed !== false && !f.personal && f.type === 'text' && String(motto.prompt || '').includes(`"{${f.key}}"`))
    .map(f => String(values[f.key] || '').trim())
    .filter(t => t.length > 42)
    .sort((a, b) => b.length - a.length)[0];
  if (gedrucktLang) {
    const woerter = gedrucktLang.split(/\s+/).filter(Boolean).length;
    parts.push(`LONG SENTENCE - SET IT AS A TYPE BLOCK: "${gedrucktLang}" is ${gedrucktLang.length} characters and ${woerter} words. It is the design itself, not a caption. Break it into ${woerter > 12 ? 'four to six' : 'three to four'} short lines of roughly equal width and stack them centred, one under the other, as one solid block of lettering that fills the artwork. Never set it as a single long line, never bend it around the motif, never let it run off the edge, never let it get so small that it reads as fine print. Two or three key words are set clearly larger or in a second lettering style so the block has rhythm; the small connecting words stay small, but EVERY word is complete and easy to read at arm's length. Break only between words, never inside a word, and add no word, no hyphen and no punctuation that is not in the sentence. The motif then plays the supporting part: above, below or behind the type block, smaller than the lettering, and it never covers a letter.`);
  }
  // Fassung 24: die Druckregeln kennen jetzt die Motivart (freistehend oder vollflaechig).
  parts.push(printRules(extra.textile, extra.style, extra.motivart, extra.fassung, extra.verfahren));
  // Fassung 25: Kundenfoto - erst NACH den Druckregeln, damit die Ausnahme die Regel aufhebt
  // und nicht umgekehrt. Der Server setzt extra.foto = true bei jedem Kundenfoto.
  if (extra.foto === 'gruppe') parts.push(GRUPPENFOTO_AUSNAHME);
  else if (extra.foto) parts.push(FOTO_AUSNAHME);
  // Fassung 73: beim fotorealistischen Stil gehoert der Mensch ins Bild - siehe FIGUR_AUSNAHME.
  if (extra.style === 'fotoreal' && !extra.foto) parts.push(FIGUR_AUSNAHME);

  // Fassung 22: Widerspruch aufloesen. JEDER Master-Prompt sagt bisher "isolated on a plain
  // empty background", und der Absatz zur Logoflaeche verlangt "transparent background".
  // Im Chroma-Modus steht das Gegenteil in den Druckregeln - zwei entgegengesetzte Ansagen im
  // selben Prompt, und das Modell folgt irgendeiner davon. Darum hier gezielt angleichen,
  // statt 18 Mottos von Hand umzuschreiben (die bleiben so auch fuer den Alpha-Modus richtig).
  //
  // Fassung 73 (17. Sept.): Der Satzteil "isolated on a plain empty background" steht in 18 von
  // 19 Mottos - und wurde bisher NUR im Chroma-Modus herausgeschnitten. Im Alpha-Modus, der
  // laeuft, blieb er stehen: Satz 1 bestellt "einen einfachen leeren Hintergrund", Regel 4 sagt
  // "das Shirt IST der Hintergrund", Regel 5 verlangt "jede schwarze Flaeche bleibt leer". Drei
  // Ansagen, die einander aufheben - und heraus kamen schwarze Kaesten, Scheiben und Nebel um
  // das Motiv. Ein Bildmodell malt, was es liest: "background" bestellt einen Hintergrund.
  // Also faellt der Satzteil JETZT IMMER weg, im Alpha-Modus ersatzlos.
  {
    const chroma = GRUND_MODUS === 'chroma';
    const angleichen = (t) => {
      let x = String(t).replace(/,?\s*isolated on a plain empty background/gi, '');
      if (!chroma) return x;
      return x
        .replace(/completely empty transparent background/gi, 'completely empty chroma green background')
        .replace(/only transparent background/gi, 'only the flat chroma green background')
        .replace(/transparent background/gi, 'chroma green background');
    };
    for (let i = 0; i < parts.length; i++) {
      // Recherche und Platzierungszeile auslassen: die werden weiter unten ueber ihre
      // Identitaet wiedergefunden (indexOf), und die Platzierung meint mit "background field"
      // ohnehin die Bildkomposition, nicht den Untergrund.
      if (parts[i] === extra.research || parts[i] === platz) continue;
      parts[i] = angleichen(parts[i]);
    }
  }

  // Fassung 58: beim Traeger-Weg heisst die "free/empty area" aus Variationen und Alttexten der Traeger -
  // sonst bestellt der Prompt an einer Stelle ein Loch und an der anderen eine Plakette.
  if (extra.logoTraegerFlaeche) {
    for (let i = 0; i < parts.length; i++) if (typeof parts[i] === 'string' && !parts[i].startsWith("THE CUSTOMER'S REAL LOGO")) parts[i] = parts[i].replace(/the (free|empty|reserved) area( for the logo)?/g, 'the logo carrier');
  }
  // Fassung 58 (16. Sept.): Die 3960 stammten von einem alten Modell mit 4000-Zeichen-Grenze. Das
  // heutige erlaubt 32 000 - und die harte Grenze hat in Produktion still das ENDE jedes laengeren
  // Prompts abgeschnitten: Namens-Ansage, Logo-Traeger, Figuren, mitten im Wort. Grosszuegig, aber
  // nicht grenzenlos: die Kuerzungsstufen unten bleiben als Sicherheitsnetz fuer Extremfaelle.
  let out = parts.filter(Boolean).join('\n\n');
  const LIMIT = 12000;
  // Fassung 22: An der Wortgrenze schneiden und mit einem Punkt schliessen. Vorher endete
  // ein gekuerzter Abschnitt mitten im Wort ("the trade's material st") - das Bildmodell
  // liest so einen Rest als eigenes Wort und malt danach.
  const kuerzen = (text, max) => {
    if (max <= 0) return '';
    if (text.length <= max) return text;
    let t = text.slice(0, max);
    const luecke = t.lastIndexOf(' ');
    if (luecke > max * 0.6) t = t.slice(0, luecke);
    t = t.replace(/[\s,;:\-–(]+$/, '');
    return /[.!?]$/.test(t) ? t : t + '.';
  };
  if (out.length > LIMIT && extra.research) {
    const i = parts.indexOf(extra.research);
    // Fassung 14: Hat der Kunde einen Stil gewaehlt, darf die Recherche notfalls ganz entfallen -
    // ein vollstaendiger Stiltext ist wichtiger als Hintergrundwissen, das im Bild niemand sieht.
    const floor = style ? 0 : 400;
    parts[i] = kuerzen(extra.research, Math.max(floor, extra.research.length - (out.length - LIMIT) - 50));
    out = parts.filter(Boolean).join('\n\n');
  }
  // Fassung 15: naechster Puffer ist die Variation - sie darf auf 220 Zeichen schrumpfen,
  // ihr Kern (WIE sich das Motiv legt) steht im ersten Halbsatz.
  if (out.length > LIMIT && style && extra.variation) {
    const i = parts.findIndex(p => p.startsWith('This piece is a one-of-a-kind design'));
    if (i >= 0) {
      parts[i] = kuerzen(parts[i], Math.max(220, parts[i].length - (out.length - LIMIT) - 20));
      out = parts.filter(Boolean).join('\n\n');
    }
  }
  // Fassung 14: letzter Puffer vor dem Stil - der allgemeine "Name ist Programm"-Absatz.
  // Bei sehr langen Master-Prompts (Meister-Shirt, Handwerker-Shirt) nennt der Prompt das Motiv
  // ohnehin selbst, der Absatz ist dort entbehrlich. Der gewaehlte Stil bleibt dafuer vollstaendig.
  if (out.length > LIMIT && style) {
    const i = parts.findIndex(p => p.startsWith('If any of the texts above names something concrete'));
    if (i >= 0) {
      const need = out.length - LIMIT;
      parts[i] = need >= parts[i].length ? '' : kuerzen(parts[i], parts[i].length - need - 2);
      out = parts.filter(Boolean).join('\n\n');
    }
  }
  // Fassung 15: die Platzierungszeile darf fallen - ihr eigentlicher Job, Format und Orientierung,
  // steckt ohnehin in der Canvas-Groesse, mit der der Auftrag laeuft.
  if (out.length > LIMIT && style && platz) {
    const i = parts.indexOf(platz);
    if (i >= 0) { parts[i] = ''; out = parts.filter(Boolean).join('\n\n'); }
  }
  if (out.length > LIMIT && style) {
    const i = parts.findIndex(p => p.startsWith('ART STYLE'));
    parts[i] = kuerzen(parts[i], Math.max(300, parts[i].length - (out.length - LIMIT) - 20));
    out = parts.filter(Boolean).join('\n\n');
  }
  // Die Graphit-Regel steht als LETZTES (spaetere Anweisungen wiegen schwerer) und wird nie gekuerzt.
  if (nurGraphit) {
    if (out.length > LIMIT - GRAPHIT_REGEL.length - 2) out = kuerzen(out, LIMIT - GRAPHIT_REGEL.length - 2);
    return out + '\n\n' + GRAPHIT_REGEL;
  }
  // Allerletzter Schnitt: an der Wortgrenze, nie mitten im Wort
  if (out.length > LIMIT) out = kuerzen(out, LIMIT);
  return out;
}
// Koelner Karneval (9. Okt., Markus): die Narrenkappe ist das Schiffchen, nicht die Schellenmuetze. Gilt vor jeder Variation.
export const KOELN_KARNEVAL = 'THIS IS THE CARNIVAL OF COLOGNE (Koelner Karneval), and it has its own look - this overrides any motif named in the variation: the fool\'s cap is the COLOGNE "SCHIFFCHEN" (also called Kraetzchen or Elferrat cap) - a soft boat-shaped garrison cap, red and white (striped or patchwork), trimmed with a gold braid. Cologne\'s colours are red and white; the number eleven, the Cologne Cathedral, the Rhine and the Hohenzollern Bridge, the red-and-white Funken guards with their tricorn hat, confetti and Kamelle (sweets thrown from the floats) belong here. NEVER a jester hat with bells or points (that is a harlequin / Till Eulenspiegel), NEVER a harlequin or jester figure, NEVER a Venetian or feathered mask - none of that is Cologne.';
export const GRAPHIT_REGEL = 'FINAL RULE, IT OVERRIDES EVERY COLOUR MENTIONED ANYWHERE ABOVE: this is a PURE GRAPHITE PENCIL DRAWING. The ONLY colour in the whole image is the grey to near-black of graphite - NO red, NO gold, NO yellow, NO blue, NO colour of any kind, not even a small accent, not in the lettering, not in the curtain, not in the flag. Things that are coloured in reality (a red curtain, a golden ticket, a flag) are drawn in graphite tones only: darker hatching for darker colours, lighter for lighter ones. No colour pencil, no tint, no wash. Everything that is not graphite stays bare.';

// ---------- Die Rueckseite: eine Namensliste, die wie ein Tour-Poster gerahmt ist ----------
// 23. Sept., Markus: "Schulausflug, Meisterfeier, Firmenausflug - ueberall dort, wo Namen
// eingetragen werden koennen, und natuerlich auf Wunsch auch bei Freestyle."
//
// Bis dahin hatte GENAU EIN Motto eine Rueckseite (Abi), und ihr Text war von Hand getippt.
// Zehn weitere Mottos nehmen aber ebenfalls eine Namensliste entgegen. Zehnmal denselben Text
// abzuschreiben waere zehnmal dieselbe Stelle zum Vergessen - darum wird die Rueckseite hier
// aus den Feldern des Mottos gebaut. Ein neues Motto mit Namensliste bekommt sie damit
// automatisch, ohne dass jemand daran denken muss.

/** Traegt dieses Motto eine LISTE von Namen (nicht nur einen einzelnen)? */
export function hatNamensliste(motto) {
  return (motto.fields || []).some(f => f && f.key === 'namen' && f.type !== 'upload');
}

/** Das Feld, aus dem die Namen fuer die Rueckseite kommen. */
export function namensFeldFuer(motto) {
  if (motto.backNamesField) return motto.backNamesField;
  const f = (motto.fields || []).find(x => x && x.key === 'namen' && x.type !== 'upload');
  return f ? f.key : '';
}

/**
 * Der Rueckseiten-Prompt. Nimmt die gedruckten Textfelder des Mottos: das erste wird die
 * Kopfzeile, die naechsten zwei landen im Abschluss unten. Platzhalter bleiben in der
 * {feld}-Schreibweise, damit fillPrompt() sie wie ueberall sonst ersetzt; optionale Felder
 * stehen in [[...]] und fallen weg, wenn der Kunde sie leer laesst.
 */
export function rueckseitePrompt(motto) {
  if (motto.backPrompt) return motto.backPrompt;          // von Hand gesetzt schlaegt gebaut
  const texte = (motto.fields || [])
    .filter(f => f && f.printed !== false && !f.personal && (f.type === 'text' || f.type === 'select'))
    .map(f => ({ key: f.key, pflicht: !!f.required }));
  if (!texte.length) return '';
  const kopf = texte[0];
  const unten = texte.slice(1, 3);
  // "showing X and Y" - nicht "showing X showing Y". Das erste Feld traegt das Wort
  // "showing", jedes weitere haengt sich mit "and" an; optionale Felder stehen in [[...]]
  // und fallen ersatzlos weg, wenn der Kunde sie leer laesst.
  const untenText = unten
    .map((f, i) => {
      const wort = i === 0 ? ' showing' : ' and';
      return f.pflicht ? `${wort} "{${f.key}}"` : `[[${wort} "{${f.key}}"]]`;
    })
    .join('');
  return [
    'BACK PRINT of the shirt, and it is a DESIGN IN ITS OWN RIGHT - never the front motif copied and parked at the top.',
    'Build it like the back of a tour shirt, where the list of names IS the star of the show and the artwork frames it:',
    `- TOP: the main text "{${kopf.key}}" as a big arched headline, and the signature character or icon of the front is WOVEN INTO it - peeking over the top edge of the letters, sitting on them, holding them, or reaching around them. Never a separate picture stacked above the word.`,
    '- Directly under the headline a wide OPENING ornament spanning most of the width: a rule with stars, a striped bar, a ribbon or a burst - whatever fits the art style. It announces the list.',
    '- THE WHOLE MIDDLE STAYS COMPLETELY EMPTY. No text, no names, no boxes, no lines, no ornaments, nothing - a list of names is typeset there afterwards.',
    // 23. Sept., Markus zum Firmenausflug: "Links und rechts neben der Jahreszahl ist das
    // Edelweiss. Das koennte man auf dem Ruecken zwischen oben und unten auch noch verwenden,
    // anstatt den anderen Rahmen." Genau richtig, und allgemeiner als das Beispiel: die
    // Seitenleisten gehoeren aus dem Vokabular der VORDERSEITE gebaut - die Blume, das
    // Werkzeug, der Stern, was dort schon neben der Jahreszahl oder dem Wappen steht. Vorher
    // stand hier eine Wunschliste (Streifen, Sterne, Lorbeer, Nieten), und das Modell hat sich
    // daraus bedient, statt die Vorderseite anzusehen: zum Bergmotiv mit Edelweiss kam ein
    // Lorbeerkranz, der mit dem Shirt nichts zu tun hatte.
    '- LEFT and RIGHT of that empty middle, two narrow vertical borders run down the sides, no wider than one tenth of the canvas each. Build them from a SMALL SIGNATURE ELEMENT THAT ALREADY APPEARS ON THE FRONT - the little flower, tool, star, leaf, badge or symbol that flanks the front\'s year or headline - repeated down the side as a few LOOSE, separate pieces with bare fabric between them - never a continuous column, never a band. Do NOT invent a generic frame: no laurel, no rivets, no random stars, unless that is exactly what the front already uses. They accompany the list without ever entering it.',
    // 2. Okt., Markus zum Abi-Ruecken (Wellenrahmen rundum): "Wir wollten noch verhindern, dass wir einfach
    // eine richtige Platte da draufhaben. Das sieht Scheisse aus." Die Seitenleisten liefen von oben bis
    // unten durch und schlossen mit Kopf und Fuss ein Rechteck - auf dem Shirt ein Schild mit Rand.
    '- NO FRAME, NO BOX, NO PLATE: the top, the sides and the bottom NEVER join into a closed rectangle or border around the names. Top and bottom stand free, the side pieces stop well before them, and the bare fabric runs in between everywhere - on the shirt the back reads as headline, names and a closing banner, never as a panel or sign with an edge.',
    `- BOTTOM: a closing element under the names - a badge, a banner or a crest${untenText}. Small and wide, not a second main motif, and not connected to the sides.`,
    'The empty middle is at least half the height of the canvas. Same art style, palette and technique as the front, but a different composition - someone looking at front and back must see two designs of one family, not the same picture twice.'
  ].join('\n');
}

/**
 * Die Farben der Vorderseite als verbindliche Palette fuer die Rueckseite.
 *
 * 23. Sept., Markus: "Finde ich gut, nur dass vorne und hinten verschiedene Farben sind,
 * ist natuerlich doof."
 * Im Prompt stand "Same art style, palette and technique as the front" - das reicht nicht.
 * Gemessen am Firmenausflug: die Vorderseite hatte 36 % Navy und 21 % Creme und KEIN Gold,
 * die Rueckseite 14 % Gold, 7 % Gelb und nur noch 5 % Navy. Der Stil (College) erlaubt
 * "navy and gold ODER maroon and cream" - also hat das Modell zweimal unabhaengig gewaehlt.
 * Eine Absichtserklaerung laesst ihm die Wahl; konkrete Farbwerte nicht.
 *
 * @param {Array} farben Ergebnis von dominantColors(vorderseite)
 */
export function palettePrompt(farben) {
  const wichtig = (farben || []).filter(c => c && c.share >= 0.05).slice(0, 5);
  if (wichtig.length < 2) return '';
  const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  const liste = wichtig.map(c => `${hex(c)} (${c.name}, ${Math.round(c.share * 100)} %)`).join(', ');
  const fuehrend = wichtig[0];
  return `PALETTE (mandatory, measured from the front of this very shirt): use EXACTLY these colours and NO others - ${liste}. `
    + `${hex(fuehrend)} carries the design here just as it does on the front. `
    + `Introduce NO new colour: no gold or yellow unless it is listed above, no extra accent, no second version of the palette. `
    + `Front and back are printed on the same shirt and must look like one set - a viewer holding both must not see two different colour schemes.`;
}

// Welche Texte muessen nachher wirklich im Bild stehen?
export function printedTexts(motto, values) {
  return (motto.fields || [])
    .filter(f => f.printed !== false && !f.personal && (f.type === 'text' || f.type === 'select'))
    .map(f => values[f.key])
    .filter(Boolean);
}

// ---------- Motto pruefen ----------
const UPLOAD_MODES = ['off', 'exact', 'reference'];
// Fassung 24/25: textarea (Freitext-Motiv), checkbox (Rechte-Haken), upload (Kundenfoto, nur RAM)
// 20. Sept. 2026, Markus ("eine Abfolge ... immer mit Beispielen belegt"): 'wahl' ist eine
// Auswahl als Kacheln mit Beispielbild. Jede Moeglichkeit bringt ihren eigenen Prompt-Text
// mit (er ersetzt {feld} im Master-Prompt) und darf eine Druckflaeche des festen Artikels
// nennen (Postkarte hoch statt quer). Neue Formen kommen als Eintrag in die Motto-Datei, nicht in den Code.
const FIELD_TYPES = ['text', 'select', 'list', 'textarea', 'checkbox', 'upload', 'wahl'];
// Wie viele Felder ein Motto haben darf. Die Postkarte braucht allein fuenf versteckte
// (Koordinaten, gewaehlte Stelle, Firma, Umgebung, Land, Datum, Foto-Weg) - bei 12 war Schluss.
// 27. Sept.: die Postkarte hat jetzt 17 - dazugekommen sind 'sterne' und 'gastro' (Luigi),
// 'kartenstoff' und 'standort_art' (Karte vom Ort ODER aus den eigenen Fotos). Bei 16 fiel
// 'foto_modus' raus, und das ist das Feld, das das Nachmalen des Selfies steuert: die
// zweistufige Karte waere lautlos verschwunden. Grenze auf 20, Luft fuer die naechsten zwei.
const MAX_FELDER = 20;
function wahlOptionen(list) {
  return (Array.isArray(list) ? list : [])
    .map(o => (o && typeof o === 'object') ? o : { key: o, label: o })
    .map(o => ({
      key: slugify(o.key || o.label || '').replace(/-/g, '_').slice(0, 30),
      label: String(o.label || o.key || '').slice(0, 40),
      desc: String(o.desc || '').slice(0, 140),
      bild: String(o.bild || '').slice(0, 200),
      flaeche: String(o.flaeche || '').replace(/[^A-Za-z0-9_.x-]/g, '').slice(0, 40),
      // 26. Sept.: das Seitenverhaeltnis der Form ("148/105"), damit die Seite die FORM zeigen kann,
      // ohne ein Beispielbild - Markus, 26. Sept.: "erst ne Karte aussuchen, dann noch mal ein
      // Karten-Design ... das ist total Banane". Die Form ist jetzt ein kleiner Schalter beim Stil,
      // und ein Kaestchen im richtigen Verhaeltnis sagt mehr als eine Postkarte in Kachelgroesse.
      seiten: String(o.seiten || '').replace(/[^0-9/]/g, '').slice(0, 12),
      // 22. Sept., Markus: "Warum werden die Karten-Prompts auf 900 Zeichen gekuerzt? Gibt es
      // eine Moeglichkeit, dass der Prompt so lang sein kann, wie er moechte?" Die 900 waren eine
      // willkuerliche Schutzgrenze beim Einfuehren der Kachelwahl - der MASTER-Prompt hat keine,
      // und das Kuerzen passierte still: der Text der geteilten Karte war 1234 Zeichen lang, der
      // Satz mit der Kartusche fiel hinten ab, ohne dass irgendwo etwas stand. Also keine Grenze
      // mehr, genau wie beim Master-Prompt - nur Leerraum weg.
      prompt: String(o.prompt || '').trim()
    }))
    .filter(o => o.key && o.label)
    .slice(0, 12);
}
export function wahlOption(feld, wert) {
  return (feld && feld.type === 'wahl' ? (feld.options || []) : []).find(o => o.key === String(wert || '')) || null;
}
/** Kundenwerte fuer den Prompt: bei 'wahl' steht statt des Kuerzels der Prompt-Text der Kachel. */
/**
 * Kurze Texte buchstabieren, damit die Bild-KI sie nicht verhunzt.
 *
 * 22. Sept., Markus ("???" zur Firmenkarte): auf der Karte stand "Mankus" statt "Markus". Der
 * Auftrag sagte "reads exactly Markus" - das genuegt bei kurzen Eigennamen nicht, weil das
 * Modell sie als Bild eines Wortes malt und dabei einen Buchstaben verschiebt. Ein Name, der
 * Buchstabe fuer Buchstabe dasteht, laesst sich nicht verschieben.
 * Nur kurze Texte (bis 28 Zeichen) - bei einem ganzen Satz waere die Buchstabenreihe laenger als
 * der Satz und haette den umgekehrten Effekt.
 * Reine Rechnung, damit die Abnahme sie ohne Bildlauf nachrechnen kann.
 */
export function buchstabierBlock(texte) {
  const sauber = [];
  for (const roh of (texte || [])) {
    const s = String(roh || '').trim();
    if (!s || s.length > 28) continue;
    if (!/[A-Za-zÄÖÜäöüß]/.test(s)) continue;          // reine Zahlen und Koordinaten nicht
    if (sauber.some(x => x.t === s)) continue;
    sauber.push({ t: s, b: s.split('').map(c => c === ' ' ? '_' : c).join('-') });
    if (sauber.length >= 6) break;
  }
  if (!sauber.length) return '';
  return '\n\nSPELLING - these short texts are the ones that get mis-drawn, so here they are letter by letter. Draw exactly these letters in exactly this order, nothing added, nothing swapped, no letter left out ("_" marks a space): '
    + sauber.map(x => `"${x.t}" = ${x.b}`).join('; ') + '.';
}

export function werteFuerPrompt(motto, values) {
  const out = { ...(values || {}) };
  for (const f of (motto && motto.fields) || []) {
    if (f.type !== 'wahl') continue;
    // Ohne Wert gilt die Vorgabe der Kachelwahl (der Server setzt sie ohnehin, die Vorzeige nicht).
    const o = wahlOption(f, out[f.key]) || wahlOption(f, f.default);
    out[f.key] = o ? o.prompt : '';
  }
  return out;
}
/** Die Druckflaeche, die eine gewaehlte Kachel verlangt (leer: die erste Flaeche des Artikels). */
export function wahlFlaeche(motto, values) {
  for (const f of (motto && motto.fields) || []) {
    if (f.type !== 'wahl') continue;
    const o = wahlOption(f, (values || {})[f.key]);
    if (o && o.flaeche) return o.flaeche;
  }
  return '';
}
// Die Abfolge (Markus, 20. Sept.: "ein Bildschirm nach dem anderen ... nichts scrollen und
// eintragen"): jeder Schritt nennt Felder des Mottos und/oder Bereiche der Seite. Die
// Zusammenfassung mit dem Start-Knopf haengt die Seite immer selbst als letzten Schritt an.
export const ABFOLGE_BEREICHE = ['stil', 'textil', 'stimmung', 'farben', 'figuren', 'platzierung', 'logo', 'artikel', 'groesse', 'schrift', 'namen', 'vorschlaege'];
function abfolgeSanitize(list, fields) {
  return (Array.isArray(list) ? list : []).slice(0, 12).map(s => ({
    id: slugify((s && (s.id || s.titel)) || '').replace(/-/g, '_').slice(0, 30),
    titel: String((s && s.titel) || '').slice(0, 60),
    text: String((s && s.text) || '').slice(0, 220),
    felder: (Array.isArray(s && s.felder) ? s.felder : []).map(k => slugify(k).replace(/-/g, '_')).filter(k => fields.some(f => f.key === k)).slice(0, 8),
    bereiche: (Array.isArray(s && s.bereiche) ? s.bereiche : []).map(String).filter(b => ABFOLGE_BEREICHE.includes(b)).slice(0, 6),
    weiter: String((s && s.weiter) || '').slice(0, 40)
  })).filter(s => s.id && s.titel && (s.felder.length || s.bereiche.length));
}

// Wie cleanValue, aber fuer den Freitext bei Otto Freestyle: bis 1000 Zeichen statt 120.
export function cleanLong(value, max) {
  if (value === undefined || value === null) return '';
  // 6. Okt., Markus: "Die Mikrofon-Seite schneidet wieder bei den Woertern ab. Lass das doch bitte unbegrenzt." Obergrenze
  // 5000 Zeichen (rund fuenf Minuten Sprechen) - nur gegen Missbrauch, kein Kunde erreicht sie.
  const t = stripChars(value).slice(0, Math.min(+max || 700, 5000));
  if (!t) return '';
  if (BLOCKLIST.test(t)) return null;
  return t;
}

// zeigeWenn: { feldKey: ['Wert', ...] } - das Feld gilt nur, wenn jedes genannte Feld einen der Werte hat
export function zeigeWennErfuellt(f, values) {
  if (!f || !f.zeigeWenn || typeof f.zeigeWenn !== 'object') return true;
  for (const [k, liste] of Object.entries(f.zeigeWenn)) {
    if (!Array.isArray(liste) || !liste.includes(String((values || {})[k] || ''))) return false;
  }
  return true;
}
const PLACES = ['oben', 'mitte', 'unten'];

// Fassung 36 (Markus, 14. Sept.): "Im Firmenausflug gibt es keine Kaderliste, sondern eine
// Mitarbeiterliste." Das Wort fuer die Namensliste haengt am Motto: im Backend setzbar
// (listeWort), sonst aus Kuerzel und Name abgeleitet. Gilt fuer die Auswahl "Wo sollen die
// Namen hin?", die Vorschau der Rueckseite und die Druckseite.
export function listeWortFuer(m) {
  const eigen = String((m && m.listeWort) || '').trim();
  if (eigen) return eigen;
  const k = (String((m && m.slug) || '') + ' ' + String((m && m.name) || '')).toLowerCase();
  if (/abi|abschluss|schul|stufe|klasse/.test(k)) return 'Stufenliste';
  // 4. Okt.: "Meister & Aufsteiger" ist die Mannschaft nach dem Titel, kein Handwerksmeister - und ein
  // Vereinsjubilaeum listet Mitglieder. Beide liefen bisher in "Mitarbeiterliste" (gesehen auf der neuen
  // Seite "Vorne und hinten" beim Meister-Shirt).
  if (/meister-shirt|aufsteig/.test(k)) return 'Kaderliste';
  if (/vereinsjubil/.test(k)) return 'Mitgliederliste';
  if (/firm|betrieb|meister|handwerk|mitarbeit|kolleg|team|abteilung|messe|jubil/.test(k)) return 'Mitarbeiterliste';
  if (/fan|verein|kader|mannschaft|sport|turnier/.test(k)) return 'Kaderliste';
  if (/jga|junggesell|maedels|jungs|crew/.test(k)) return 'Crew-Liste';
  if (/famil|opa|oma/.test(k)) return 'Familienliste';
  if (/kegel|stammtisch|skat|karneval|verein/.test(k)) return 'Mitgliederliste';
  return 'Namensliste';
}

export function sanitizeMotto(input) {
  const m = input || {};
  const name = String(m.name || '').trim().slice(0, 60);
  if (!name) throw new Error('Name fehlt');
  const prompt = String(m.prompt || '').trim();
  if (prompt.length < 30) throw new Error('Master-Prompt ist zu kurz');

  const slug = slugify(m.slug || name);
  if (!slug) throw new Error('Kuerzel laesst sich nicht bilden');

  const seen = {};
  // 24. Sept.: Die Grenze stand bei 12, und die Postkarte hatte genau 12 Felder. Das 13.
  // (standort_adresse) fiel hier LAUTLOS raus - die Abnahme stolperte erst zwei Pruefungen
  // spaeter ueber ein fehlendes Feld. Regel 5 sagt: nichts faengt still. Also sagt es das
  // jetzt (siehe MAX_FELDER, die Grenze wanderte seither von 12 auf 16 auf 20).
  const roheFelder = Array.isArray(m.fields) ? m.fields : [];
  if (roheFelder.length > MAX_FELDER) {
    console.warn('Motto', slug, 'hat', roheFelder.length, 'Felder - abgeschnitten bei', MAX_FELDER + ':',
      roheFelder.slice(MAX_FELDER).map(f => f && (f.key || f.label)).join(', '));
  }
  const fields = roheFelder.slice(0, MAX_FELDER).map((f, i) => {
    const key = slugify(f.key || f.label || ('feld' + (i + 1))).replace(/-/g, '_') || ('feld' + (i + 1));
    if (seen[key]) throw new Error('Zwei Felder heissen gleich: ' + key);
    seen[key] = 1;
    const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
    return {
      key,
      label: String(f.label || key).slice(0, 60),
      type,
      required: !!f.required,
      // Namenslisten werden nicht im Front-Motiv gemalt (kommen auf die Rueckseite).
      printed: type === 'list' ? false : (f.printed !== false),
      personal: !!f.personal,
      max: Math.min(Math.max(+f.max || 40, 1), type === 'textarea' ? 1000 : 200),
      placeholder: String(f.placeholder || '').slice(0, 60),
      // 5. Okt. abends: 140 schnitten Hinweise mitten im Wort ab (Freestyle: "... gemuetlich, warme" - Markus' Bildschirmfoto)
      hint: String(f.hint || '').slice(0, 300),
      // Fassung 25: Vorgabe bei Auswahlfeldern und "nur zeigen, wenn ..." (Foto-Felder bei Freestyle)
      default: f.default !== undefined ? String(f.default).slice(0, 60) : undefined,
      zeigeWenn: f.zeigeWenn && typeof f.zeigeWenn === 'object' && !Array.isArray(f.zeigeWenn)
        ? Object.fromEntries(Object.entries(f.zeigeWenn).slice(0, 4).map(([k, v]) => [slugify(k).replace(/-/g, '_'), (Array.isArray(v) ? v : [v]).map(x => String(x).slice(0, 60)).slice(0, 12)]))
        : undefined,
      // unit/format: der Server vereinheitlicht die Eingabe vor dem Druck ("4040" -> "4040 g", "7.54 h" -> "07:54")
      unit: ['g', 'cm'].includes(f.unit) ? f.unit : undefined,
      format: f.format === 'time' ? 'time' : undefined,
      // geo: Adresse -> Koordinaten (Landwirt); steers: Wert bestimmt das Hauptmotiv (Motorrad-Typ)
      geo: !!f.geo,
      steers: !!f.steers,
      // versteckt: die Seite fuellt das Feld selbst (Standort bei "Gruesse aus"), der Kunde sieht es nicht
      versteckt: !!f.versteckt,
      // 26. Sept., Markus: "Wenn jemand ein Foto hochlaedt, sollten wir schon erkennen koennen,
      // dass auch ein Mensch da drauf ist oder ein Tier." Was das Motto von seinem Foto verlangt,
      // steht am Feld und nicht im Code: 'mensch', 'tier', 'mensch_tier'. Ohne Eintrag wird nichts
      // geprueft - beim Freestyle darf auf dem Foto auch eine Landschaft oder ein Auto sein.
      braucht: type === 'upload' && ['mensch', 'tier', 'mensch_tier'].includes(f.braucht) ? f.braucht : undefined,
      // 19. Okt., Freestyle: ein Foto, ohne das es auch geht (grosser Knopf, "Ohne Foto weiter" - wie bei den
      // Gruppen-Mottos), darf jetzt auch in der Motto-Datei stehen; knopf ist die Beschriftung des Knopfs.
      ohneGeht: type === 'upload' && !!f.ohneGeht ? true : undefined,
      knopf: type === 'upload' && String(f.knopf || '').trim() ? String(f.knopf).slice(0, 40) : undefined,
      // 19. Okt. abends (Markus: "Ich muss erst einsprechen, was geaendert werden soll, und kann gar nicht sagen, was
      // geaendert werden soll"): liegt ein Foto vor, fragt das Feld anders ("Was soll Otto an deinem Foto aendern?").
      mitFoto: f.mitFoto && typeof f.mitFoto === 'object' && (f.mitFoto.label || f.mitFoto.hint)
        ? { label: String(f.mitFoto.label || '').slice(0, 60), hint: String(f.mitFoto.hint || '').slice(0, 300) } : undefined,
      options: type === 'select'
        ? (Array.isArray(f.options) ? f.options : []).map(o => String(o).slice(0, 60)).filter(Boolean).slice(0, 80)
        : type === 'wahl' ? wahlOptionen(f.options) : []
    };
  });
  // 4. Okt., Markus (Meister-Shirt, Seite "Andere Sportart - welche?"): "Unnoetiger Schritt, das muss
  // vorne irgendwo mit rein." Ein Freitext <feld>_frei gehoert zu seiner Auswahl <feld> und gilt nur,
  // wenn dort "Andere ..." gewaehlt ist (Hinweis im Motto: "Nur noetig, wenn oben ... gewaehlt ist").
  // Ohne eigene Bedingung bekommt er diese - dann steht er auf der Seite der Auswahl und nur bei Bedarf.
  freiBedingung(fields, true);

  if (fields.filter(f => f.personal).length > 1) throw new Error('Nur ein Feld darf "je Person" sein');
  const up = m.upload || {};
  const mode = UPLOAD_MODES.includes(up.mode) ? up.mode : 'off';

  return {
    slug,
    name,
    active: m.active !== false,
    order: Math.min(Math.max(+m.order || 100, 0), 9999),
    intro: String(m.intro || '').slice(0, 400),
    headline: String(m.headline || '').slice(0, 90),
    text: String(m.text || '').slice(0, 1200),
    sample: String(m.sample || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40),
    accent: /^#[0-9a-fA-F]{6}$/.test(String(m.accent || '')) ? String(m.accent) : '#ffc542',
    size: ['1024x1536', '1024x1024', '1536x1024'].includes(m.size) ? m.size : '1024x1536',
    // 22. Sept., Markus ("im Backend kann ich nur immer das Bildmodell einstellen fuer alles, und
    // ich moechte nicht, dass wir Qualitaet einbuessen bei allen anderen Sachen"): die Stufe des
    // Bilddienstes je Motto. Leer = die allgemeine Einstellung gilt weiter (Backend oder
    // IMAGE_QUALITY). Gemessen am 22. Sept. mit demselben Selfie: 1952x1408 in 'high' 23 s,
    // in 'max' laut Lage-Karte im Schnitt 310 s je Design - bei der Postkarte ist das der
    // Unterschied zwischen "gleich da" und "Kunde wartet Minuten". Nur dieses Motto geht runter.
    bildStufe: BILD_STUFEN.includes(String(m.bildStufe || '')) ? String(m.bildStufe) : '',
    styleChoice: m.styleChoice !== false,
    // Markensperre fuer dieses Motto ausschalten (z. B. Handwerker: eigene Firmenlogos, Werkzeugmarken sind unkritisch)
    markenfrei: !!m.markenfrei,
    // Kaderliste auf dem Ruecken + Brust-Print mit Namen anbieten (Fassung 9); greift nur bei Mottos mit Namensliste
    kader: m.kader !== false,
    listeWort: String(m.listeWort || '').trim().slice(0, 30),
    colorChoice: m.colorChoice !== false,
    moodChoice: m.moodChoice !== false,
    placementChoice: !!m.placementChoice,
    // Nur-Logo: dieses Motto darf auch ganz ohne gezeichnetes Design bestellt werden
    nurLogo: !!m.nurLogo,
    // Gewerblich (B2B): Firmen- und Vereinsbekleidung. Solche Designs kommen NIE automatisch in
    // den oeffentlichen Bewertungs-Pool - eine Firma will ihr Motiv dort nicht oeffentlich sehen.
    // Der Kunde darf es trotzdem freigeben, aber nur ausdruecklich per Schalter.
    gewerblich: !!m.gewerblich,
    vary: m.vary !== false,
    // Fassung 24: Otto Freestyle - der Artikel bestimmt Verfahren, Flaeche und Motivart
    freestyle: !!m.freestyle,
    // 5. Okt. abends: Freestyle einfach - nur Artikel und Wunsch, den Rest fuellt freestyleBruecke im Server
    einfach: !!m.einfach,
    artikelPflicht: !!m.artikelPflicht,
    fotoUpload: !!m.fotoUpload,
    noExtra: !!m.noExtra,
    // Ein Motto mit festem Artikel: der Artikel steht am Motto, nicht in der Wahl des Kunden.
    artikelFest: slugify(m.artikelFest || '').replace(/-/g, '_').slice(0, 40),
    hausTextil: !!m.hausTextil,   // 1. Okt.: Freestyle mit dem Logo des freigegebenen Betriebs (Motto haus)
    stileVorne: (Array.isArray(m.stileVorne) ? m.stileVorne : []).map(s => String(s)).filter(s => STYLE_KEYS.includes(s)).slice(0, 12),
    variations: String(m.variations || '').slice(0, 2000),
    research: !!m.research,
    researchField: slugify(m.researchField || '').replace(/-/g, '_'),
    researchKind: ['verein'].includes(m.researchKind) ? m.researchKind : '',
    requiresApproval: !!m.requiresApproval,
    suggestions: String(m.suggestions || '').slice(0, 3000),
    suggestField: slugify(m.suggestField || '').replace(/-/g, '_'),
    nameZone: ['oben', 'unten'].includes(m.nameZone) ? m.nameZone : 'unten',
    nameFont: ['rund', 'schmal', 'serif'].includes(m.nameFont) ? m.nameFont : 'rund',
    abfolge: abfolgeSanitize(m.abfolge, fields),
    // Notausgang: ein Motto darf die Abfolge abschalten (dann die alte Seite mit allen Feldern untereinander)
    ohneAbfolge: !!m.ohneAbfolge,
    fields,
    upload: {
      mode,
      label: String(up.label || 'Logo oder Foto').slice(0, 60),
      hint: String(up.hint || '').slice(0, 200),
      required: !!up.required,
      place: PLACES.includes(up.place) ? up.place : 'unten',
      widthPct: Math.min(Math.max(+up.widthPct || 38, 8), 90),
      // Co-Branding: zweites Logo (z. B. Partner, Innung, Sponsor) - wird neben das erste gesetzt
      coBrand: !!up.coBrand,
      label2: String(up.label2 || 'Zweites Logo (Co-Branding)').slice(0, 60)
    },
    prompt,
    // Rueckseite (z. B. Abi/Schulmotto): eigener Prompt + Feld mit der Namensliste.
    // Ist backPrompt gesetzt UND kommen Namen an, wird zusaetzlich eine Rueckseite erzeugt.
    backPrompt: String(m.backPrompt || '').slice(0, 2000),
    backNamesField: slugify(m.backNamesField || '').replace(/-/g, '_'),
    seedRev: Math.max(0, +m.seedRev || 0),
    userEdited: !!m.userEdited,
    updated: new Date().toISOString()
  };
}

// 6. Okt., Markus (Malle-Fahrt BC4W, gedruckt: "Nuechtern seid ihr alle nicht zu ertr"): "hat er leider Gottes einfach den
// Satz abgebrochen". Das Spruchfeld liess 36 Zeichen zu und schnitt beim Tippen still ab - 25 Mottos hatten Grenzen von 28
// bis 40. Ein Spruch darf so lang sein, wie Leute ihn sagen: mindestens 80 Zeichen. Gilt beim Lesen jeder Motto-Datei (Seite
// und Server sehen dieselbe Grenze), die Motto-Dateien selbst bleiben unangetastet.
export const SPRUCH_MIN = 80;
const SPRUCH_FELD = /^(spruch|sub|motto|bezug|text_gross|text_klein)$/;
export function spruchLaenge(m) {
  if (!m || !Array.isArray(m.fields)) return m;
  for (const f of m.fields) {
    if (f && SPRUCH_FELD.test(f.key || '') && (f.type === 'text' || f.type === 'textarea' || !f.type) && f.max && f.max < SPRUCH_MIN) f.max = SPRUCH_MIN;
  }
  return m;
}

// ---------- Ablage auf der Platte ----------
export function mottoStore(dir) {
  const file = (slug) => path.join(dir, slug + '.json');

  return {
    async all() {
      let names = [];
      try { names = await fs.readdir(dir); } catch (e) { return []; }
      const out = [];
      for (const n of names) {
        if (!n.endsWith('.json')) continue;
        try { out.push(spruchLaenge(JSON.parse(await fs.readFile(path.join(dir, n), 'utf8')))); } catch (e) { /* kaputte Datei ueberspringen */ }
      }
      return out.sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name)));
    },
    async get(slug) {
      try { return spruchLaenge(JSON.parse(await fs.readFile(file(slugify(slug)), 'utf8'))); } catch (e) { return null; }
    },
    async save(motto) {
      const clean = sanitizeMotto(motto);
      await fs.writeFile(file(clean.slug), JSON.stringify(clean, null, 2));
      return clean;
    },
    async remove(slug) {
      try { await fs.rm(file(slugify(slug)), { force: true }); return true; } catch (e) { return false; }
    }
  };
}

// Was der Kunde sieht - ohne Master-Prompt.
/** Welche Stile ein Motto anbietet, in welcher Reihenfolge. */
export function stileFuer(m) {
  const passt = STYLE_KEYS.filter(k => !STYLES[k].off && (!STYLES[k].nurMotto || STYLES[k].nurMotto.includes(m.slug)));
  const vorne = (m.stileVorne || []).filter(k => passt.includes(k));
  return [...vorne, ...passt.filter(k => !vorne.includes(k))];
}

// 4. Okt., Markus (Meister-Shirt, Seite "Andere Sportart - welche?"): "Unnoetiger Schritt, das muss
// vorne irgendwo mit rein." Ein Freitext <feld>_frei gehoert zu seiner Auswahl <feld> und gilt nur,
// wenn dort "Andere ..." gewaehlt ist (Hinweis im Motto: "Nur noetig, wenn oben ... gewaehlt ist").
// Ohne eigene Bedingung bekommt er diese - dann steht er auf der Seite der Auswahl und nur bei Bedarf.
// Gilt beim Speichern (sanitizeMotto) und beim Ausliefern (publicView), weil die Motto-Dateien auf
// der Platte schon aufbereitet liegen und beim Lesen nicht neu durchlaufen.
export function freiBedingung(fields, vorOrt) {
  const liste = Array.isArray(fields) ? fields : [];
  return liste.map(f => {
    if (!f || f.zeigeWenn || !/_frei$/.test(f.key || '')) return f;
    const basis = liste.find(x => x && x.key === f.key.replace(/_frei$/, '') && x.type === 'select');
    const andere = basis && (basis.options || []).filter(o => /^ander/i.test(o));
    if (!andere || !andere.length) return f;
    if (vorOrt) { f.zeigeWenn = { [basis.key]: andere }; return f; }
    return { ...f, zeigeWenn: { [basis.key]: andere } };
  });
}
export function publicView(m) {
  return {
    slug: m.slug, name: m.name, intro: m.intro, headline: m.headline || '', text: m.text || '', accent: m.accent || '#ffc542', hasSample: !!m.sample,
    styleChoice: m.styleChoice !== false, colorChoice: m.colorChoice !== false, markenfrei: !!m.markenfrei,
    // Farbstimmung und Druckplatzierung: die Knopfreihen erscheinen nur, wenn das Motto sie anbietet
    moodChoice: m.moodChoice !== false,
    nurLogo: !!m.nurLogo,
    moods: MOOD_KEYS.filter(k => !MOODS[k].off).map(k => ({ key: k, label: MOODS[k].label, desc: MOODS[k].desc })),
    figurenChoice: figurenWahl(m),
    gruppenFoto: gruppenFoto(m),
    figuren: figurenFuer(m),
    placementChoice: !!m.placementChoice,
    placements: m.placementChoice ? placementsForPublic() : [],
    kader: m.kader !== false && (m.fields || []).some(f => f.personal),
    listeWort: listeWortFuer(m),
    nameZone: m.nameZone || 'unten', nameFont: m.nameFont || 'rund',
    research: !!m.research, researchField: m.researchField || '',
    requiresApproval: !!m.requiresApproval || m.slug === 'fanclub',
    freestyle: !!m.freestyle, einfach: !!m.einfach, artikelPflicht: !!m.artikelPflicht, fotoUpload: !!m.fotoUpload,
    artikelFest: m.artikelFest || '', hausTextil: !!m.hausTextil, stileVorne: m.stileVorne || [],
    // Fassung 31: gewerbliche Mottos (Handwerker) fragen nach dem Design, ob die ganze Firma es braucht
    firmenFrage: !!m.gewerblich || !!m.hausTextil,   // 1. Okt.: das Haus-Motto schlaegt das Logo des Betriebs vor
    suggestField: m.suggestField || '',
    suggestions: String(m.suggestions || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 60),
    // Stile, die nur zu einem Motto gehoeren (Ansichtskarte, Reiseplakat), erscheinen nur dort;
    // stileVorne legt die Reihenfolge fest, der Rest folgt in der ueblichen Ordnung.
    // textil reist mit: die Mottoseite stellt danach die Textilkachel ein und sperrt die andere.
    // Vorher stand diese Zuordnung als "var NUR_HELL = { aquarell: true }" im Browserskript -
    // EIN Stil von siebzehn, von Hand eingetragen. Jetzt kommt sie aus STIL_TEXTIL.
    styles: stileFuer(m).map(k => ({ key: k, label: STYLES[k].label, desc: STYLES[k].desc, textil: STIL_TEXTIL[k] || '' })),
    abfolge: Array.isArray(m.abfolge) ? m.abfolge : [],
    ohneAbfolge: !!m.ohneAbfolge,
    fields: freiBedingung(m.fields), upload: { mode: m.upload.mode, label: m.upload.label, hint: m.upload.hint, required: m.upload.required, coBrand: !!m.upload.coBrand, label2: m.upload.label2 || 'Zweites Logo (Co-Branding)' }
  };
}
