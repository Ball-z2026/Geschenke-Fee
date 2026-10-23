// Mockup-Vorlagen selbst erzeugen: Produktansicht und Szene, je Artikel.
//
// WARUM
// Markus, 18. Sept.: "Wir brauchen von jedem Artikel ein geiles Mockup - fuer ein Poster
// natuerlich einmal das Poster und einmal ein Bild, wo das Poster an der Wand haengt. Ein
// Handtuch, und natuerlich, wo das Handtuch am Strand liegt."
// Die Mechanik dafuer steht schon: GARMENTS[x].szene, makeMockup(..., { ansicht: 'szene' }).
// Benutzt hat sie bisher genau ein Artikel - das Handtuch. Es fehlen nicht Funktionen,
// es fehlen Bilder.
//
// DER ENGPASS IST NICHT DAS BILD, SONDERN DIE DRUCKFLAECHE
// Ein Produktfoto ist schnell erzeugt. Aber makeMockup braucht zu jeder Vorlage eine box:
// wo genau im Bild das Motiv landet, in Pixeln. Die bisherigen zwoelf boxen sind von Hand
// abgemessen. Bei siebenundzwanzig fehlenden Vorlagen ist das keine Arbeit, die jemand
// zweimal machen will - und von Hand abgemessene Zahlen veralten still, sobald ein Bild
// ersetzt wird.
// Deshalb wird die Flaeche MITBESTELLT: das Teil entsteht mit einer magentafarbenen Flaeche
// genau dort, wo spaeter gedruckt wird. Magenta kommt in keinem Produktfoto natuerlich vor und
// ist deshalb eindeutig zu finden. Danach wird der Platzhalter entfernt und durch den
// umliegenden Materialton ersetzt - derselbe Trick wie beim Logo-Platzhalter (Fassung 41).
// Bei Flachware (Poster, Kissen, Handtuch) deckt der Platzhalter das ganze Teil, denn dort IST
// das Teil die Druckflaeche. Bei einem Shirt deckt er nur die Brust.
// Fassung 85e: Vorher gab es einen zweiten Weg ueber den Alphakanal freigestellter Teile. Der
// ist am echten Bild gescheitert (weiszer Schein um die Papierkante, siehe unten) und wurde
// entfernt. Ein Weg statt zwei.
//
// WAS HIER NICHT PASSIERT
// Diese Vorlagen sind UNSERE eigenen, generischen Teile - ein T-Shirt, eine Tasse, ein
// Poster. Sie haben nichts mit den Herstellerfotos von Roly, B&C und Stanley/Stella zu tun.
// Fuer die gilt weiter: kein KI-Bild an der Stelle eines Herstellerfotos (textil-bilder.js).
// Die beiden Wege duerfen nie vermischt werden, und deshalb liegen sie in zwei Dateien.
import sharp from 'sharp';
// 19. Sept.: vorlagenNachputzen liest und schreibt Dateien - ohne diese beiden Zeilen stuerzte es
// beim Serverstart mit "path is not defined" ab, still im catch. Zwei Deploys lang hat die
// Reparatur nie eine Vorlage angefasst. Gefunden durch den ersten Test, der sie wirklich aufruft.
import fs from 'node:fs/promises';
import path from 'node:path';

// Magenta als Platzhalterfarbe: kommt in keinem echten Produktfoto vor.
const MAGENTA = { r: 255, g: 0, b: 230 };

/**
 * Die Umrandung aller Pixel, die nicht durchsichtig sind - also: wo liegt das Teil im Bild?
 * Fuer Flachware ist das zugleich die Druckflaeche.
 * schwelle: ab welchem Alphawert ein Pixel als "da" gilt.
 * Fassung 85d, am ersten echten Bild gelernt: Das freigestellte Poster kam mit einem weichen
 * weiszen Schein um die Papierkante - und zwar auch, nachdem ich ihn im Bestellzettel
 * ausdruecklich verboten hatte. Das Modell macht das bei hellen freigestellten Teilen
 * systematisch; gegen Sprache ist da nicht anzukommen.
 * Also technisch: nur VOLL deckende Pixel zaehlen. Ein Schein ist weich und faellt damit weg.
 * Das geht hier gefahrlos, weil dieser Weg nur fuer Flachware benutzt wird - ein Poster, ein
 * Brett, eine Fuszmatte haben eine scharfe Kante, kein weiches Fell.
 */
export async function flaecheAusAlpha(png, { schwelle = 250 } = {}) {
  const bild = sharp(png);
  const { width, height, channels } = await bild.metadata();
  if (!width || !height) throw new Error('Bild ohne Maszangabe');
  if (channels !== 4) throw new Error('Das Bild hat keinen Alphakanal - ohne den ist die Kontur nicht zu finden');
  const roh = await bild.ensureAlpha().raw().toBuffer();
  let oben = height, unten = -1, links = width, rechts = -1;
  for (let y = 0; y < height; y++) {
    const zeile = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (roh[zeile + x * 4 + 3] < schwelle) continue;
      if (y < oben) oben = y;
      if (y > unten) unten = y;
      if (x < links) links = x;
      if (x > rechts) rechts = x;
    }
  }
  if (unten < 0) throw new Error('Das Bild ist vollstaendig durchsichtig - kein Teil zu sehen');
  const box = { x: links, y: oben, w: rechts - links + 1, h: unten - oben + 1 };
  // Plausibilitaetspruefung. Bestellt ist ein freigestelltes Teil "mit einem kleinen gleichen
  // Rand ringsum". Fuellt das Gemessene fast das ganze Bild, wurde etwas mitgemessen, das nicht
  // zum Teil gehoert - ein Schein, ein Rahmen, ein Rest Hintergrund. Dann lieber ehrlich
  // scheitern: eine zu grosze Flaeche merkt niemand, bis das Motiv ueber den Rand haengt.
  if (box.w > width * 0.97 && box.h > height * 0.97) {
    throw new Error('Das Teil fuellt das ganze Bild (' + box.w + 'x' + box.h + ' von ' + width + 'x' + height
      + ') - es ist nicht sauber freigestellt oder hat einen Schein um die Kante. Bild neu erzeugen.');
  }
  return box;
}

/**
 * Die Umrandung der magentafarbenen Flaeche - also die mitbestellte Druckstelle.
 * toleranz: wie weit ein Pixel von reinem Magenta abweichen darf. Ein Bildmodell trifft die
 * Farbe nie exakt, und JPEG-artige Weichzeichnung am Rand verschiebt sie zusaetzlich.
 */
export async function flaecheAusMagenta(png, { toleranz = 72 } = {}) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let oben = height, unten = -1, links = width, rechts = -1, treffer = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      // Magenta heiszt: viel Rot, viel Blau, wenig Gruen. Der Gruen-Abstand traegt doppelt,
      // sonst rutschen helle Rosatoene eines Stoffes mit hinein.
      const dr = 255 - data[i], dg = data[i + 1], db = 230 - Math.min(230, data[i + 2]);
      if (dr + dg * 2 + db > toleranz * 3) continue;
      treffer++;
      if (y < oben) oben = y;
      if (y > unten) unten = y;
      if (x < links) links = x;
      if (x > rechts) rechts = x;
    }
  }
  // Ein paar versprengte Pixel sind kein Platzhalter. Unter einem Promille der Bildflaeche
  // hat das Modell die Flaeche schlicht nicht gemalt - dann lieber ehrlich scheitern, als
  // eine winzige Flaeche zu melden und das Motiv spaeter briefmarkengrosz zu drucken.
  if (treffer < width * height * 0.001) throw new Error('Keine Platzhalterflaeche im Bild gefunden (nur ' + treffer + ' Pixel)');
  // Fassung 90: Das hier ist der KERN - satt magenta, eindeutig. Aber der Bilddienst malt die
  // Flaeche mit Licht und Schatten: oben ein heller Rosasaum, unten ein dunkler Lilasaum. Beides
  // gehoert zum Platzhalter, beides lag auszerhalb der engen Toleranz. Die Flaeche wurde also zu
  // klein gemessen - am Probebild 258 statt 300 px hoch -, das Motiv sasz zu tief und zu klein,
  // und der Ersatzton beim Entfernen wurde aus dem Saum statt aus dem Stoff gemittelt: rosa.
  // Deshalb waechst die Flaeche jetzt vom Kern aus nach auszen, Zeile fuer Zeile, solange die
  // naechste Zeile noch ueberwiegend magenta-artig ist. Der Kern verhindert, dass ein rosa
  // Kissen am Bildrand zur Druckflaeche wird; das Wachsen holt den Saum dazu.
  const box = wachsen(data, width, height, { x: links, y: oben, w: rechts - links + 1, h: unten - oben + 1 });
  return { ...box, pixel: treffer };
}

// Magenta-artig: Rot und Blau beide deutlich ueber Gruen. Faengt helles Rosa (255,200,250) wie
// dunkles Lila (180,0,150), laesst Stoff, Haut und Holz in Ruhe.
const magentaArtig = (d, i) => (d[i] - d[i + 1] > 40) && (d[i + 2] - d[i + 1] > 40) && d[i + 3] >= 128;

// Eine Flaeche von einem sicheren Kern aus nach auszen wachsen lassen, solange die naechste
// Zeile bzw. Spalte zu mindestens der Haelfte magenta-artig ist. Hoechstens bis zum Bildrand.
function wachsen(data, width, height, k) {
  let x0 = k.x, y0 = k.y, x1 = k.x + k.w - 1, y1 = k.y + k.h - 1;
  const zeileVoll = (y) => { let n = 0; for (let x = x0; x <= x1; x++) if (magentaArtig(data, (y * width + x) * 4)) n++; return n >= (x1 - x0 + 1) * 0.5; };
  const spalteVoll = (x) => { let n = 0; for (let y = y0; y <= y1; y++) if (magentaArtig(data, (y * width + x) * 4)) n++; return n >= (y1 - y0 + 1) * 0.5; };
  let bewegt = true;
  while (bewegt) {
    bewegt = false;
    if (y0 > 0 && zeileVoll(y0 - 1)) { y0--; bewegt = true; }
    if (y1 < height - 1 && zeileVoll(y1 + 1)) { y1++; bewegt = true; }
    if (x0 > 0 && spalteVoll(x0 - 1)) { x0--; bewegt = true; }
    if (x1 < width - 1 && spalteVoll(x1 + 1)) { x1++; bewegt = true; }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Die Flaeche in einer BEREITS GEBAUTEN Vorlage neu messen, in der es keinen satten Kern mehr
 * gibt (der wurde beim alten Entfernen schon ersetzt) - nur noch den rosa Rest. Gesucht wird
 * in der Naehe der gespeicherten Flaeche, damit ein rosa Kissen anderswo im Bild nicht
 * mitgezaehlt wird. Faengt bei der gespeicherten Flaeche an und waechst von dort.
 */
export async function flaecheNachmessen(png, gespeichert) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const k = {
    x: Math.max(0, gespeichert.x), y: Math.max(0, gespeichert.y),
    w: Math.min(width - Math.max(0, gespeichert.x), gespeichert.w), h: Math.min(height - Math.max(0, gespeichert.y), gespeichert.h)
  };
  return wachsen(data, width, height, k);
}

/**
 * Das Magenta wieder aus der Vorlage nehmen: die Flaeche bekommt den Farbton, der sie
 * umgibt. Ohne diesen Schritt leuchtet der Platzhalter durch, sobald ein Motiv die Flaeche
 * nicht ganz ausfuellt - und genau das tut jedes freigestellte Motiv.
 */
export async function magentaEntfernen(png, box, opts = {}) {
  const toleranz = opts.toleranz || 72;
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Der Ersatzton wird aus einem Ring um die Flaeche gemittelt - das ist der Stoff bzw. das
  // Material, auf dem gedruckt wird.
  // Fassung 90: Der Ring beginnt erst 4 px auszerhalb (die weiche Kante bleibt drauszen) und
  // reicht bis 14 px. Und alles, was im Ring selbst noch magenta-artig ist, zaehlt NICHT mit.
  // Vorher lag der Ring bei zu klein gemessener Flaeche mitten im rosa Lichtsaum, und der
  // "Stoffton" war 230,173,222 - rosa. Damit wurde die ganze Flaeche rosa gefuellt. Das war
  // Markus' Kasten.
  const um = umgebungMessen(data, width, height, box);
  if (um.n < 50) throw new Error('Kein Stoff um die Platzhalterflaeche herum gefunden - der Ersatzton laesst sich nicht bestimmen');
  const [er, eg, eb] = um.ring;
  // Fassung 90, am echten Poster-an-der-Wand gesehen: die Flaeche wurde DUNKELGRAU statt
  // papierweisz. Der Ring um ein gerahmtes Bild ist der Rahmen, nicht das Papier. Bei einem
  // Shirt ist der Ring Stoff - da stimmt die Mittelung. Bei allem mit Rahmen, Kante oder Saum
  // in anderer Farbe stimmt sie nicht. Deshalb: widerspricht der Ringtón der bestellten
  // Artikelfarbe (weisz bestellt, Ring dunkel - oder umgekehrt), gilt die Artikelfarbe. Ein
  // weiszes Poster ist Papier, ein schwarzes Shirt ist schwarz, egal was drumherum ist.
  // Seit der Verlaufsfuellung zaehlt auch der Streifen DIREKT an der Flaeche (siehe
  // umgebungMessen): aus ihm werden die Stuetzwerte genommen. Ein duenner Rahmen laege im Ring
  // kaum ins Gewicht, im Streifen aber ganz - und das Poster wuerde rahmendunkel.
  const farbe = opts.farbe === 'black' ? 'black' : opts.farbe === 'white' ? 'white' : '';
  let flach = null;
  if (widerspricht(farbe, um)) flach = farbe === 'white' ? [246, 245, 241] : [28, 28, 31];
  // Fassung 90, an Markus' Startseite gesehen (18. Sept., 21:27): ein rosa Kasten hinter dem
  // Aquarell auf dem weiszen Shirt. Hier stand dieselbe enge Toleranz wie beim Messen: nur
  // Pixel nahe REINEM Magenta wurden ersetzt. Zum Messen ist das richtig - die Kante soll
  // scharf sein. Zum Entfernen ist es falsch: der Bilddienst malt die Flaeche mit Licht und
  // Schatten, und alles, was ihm zu hellem Rosa oder dunklem Lila geraten ist, blieb stehen.
  // Genau das war der Kasten.
  //
  // 19. Sept., an der laufenden Seite gesehen: auf dem getragenen schwarzen Shirt und dem
  // weiszen Hoodie stand ein KASTEN hinter dem Motiv - flach gefuellt, mit einer lila Haarlinie
  // am Rand. Fotografierter Stoff ist nie flach: er hat Falten, Licht von oben, Schatten unter
  // dem Arm. Eine Flaeche in EINER Farbe faellt darin auf wie ein aufgeklebtes Blatt. Und die
  // Haarlinie: der Saum von 2 px war zu schmal, und die Schwelle (Rot und Blau je 40 ueber
  // Gruen) liesz dunkles Lila wie 53,24,64 stehen.
  //
  // Deshalb jetzt drei Regeln:
  //   1) INNERHALB der gemessenen Flaeche wird ALLES ersetzt - das ist der Platzhalter, da
  //      gibt es nichts zu bewahren. Im Saum von 3 px drumherum faellt alles, was auch nur
  //      leicht magenta-artig ist (Rot und Blau je 12 ueber Gruen). Stoff ist neutral, den
  //      trifft das nicht.
  //   2) Die Ersatzfarbe ist KEINE Farbe, sondern der Verlauf des umliegenden Stoffs: jedes
  //      Pixel wird aus dem Stoff links, rechts, oben und unten der Flaeche interpoliert.
  //      Licht von oben bleibt Licht von oben, die Falte laeuft durch. Nur wenn die
  //      Artikelfarbe der Umgebung widerspricht (Poster im Rahmen: der Ring ist Rahmen), wird
  //      flach in der Artikelfarbe gefuellt - Papier ist wirklich flach.
  //   3) AUSZERHALB der Flaeche gilt weiter die enge Toleranz - dort darf nur verschwinden,
  //      was zweifelsfrei Platzhalter ist, nie ein rosa Kissen oder ein lila Muster.
  const maske = fuellMaske(data, width, height, box, FUELL_SAUM);
  if (flach) {
    for (let p = 0; p < width * height; p++) if (maske[p]) { data[p * 4] = flach[0]; data[p * 4 + 1] = flach[1]; data[p * 4 + 2] = flach[2]; }
  } else {
    verlaufFuellen(data, width, height, maske, [er, eg, eb]);
  }
  const weit = FUELL_SAUM + FUELL_KANTE;
  const x0 = Math.max(0, box.x - weit), x1 = Math.min(width, box.x + box.w + weit);
  const y0 = Math.max(0, box.y - weit), y1 = Math.min(height, box.y + box.h + weit);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const dr = 255 - r, dg = g, db = 230 - Math.min(230, b);
      if (dr + dg * 2 + db > toleranz * 3) continue;
      data[i] = er; data[i + 1] = eg; data[i + 2] = eb;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

const FUELL_SAUM = 3;

/**
 * Was um die Flaeche herum ist - an zwei Stellen gemessen, magenta-artige Pixel ausgenommen:
 *   ring: 4..14 px auszerhalb (Mittel und Streuung der Helligkeit) - der Stoff im Groszen.
 *   nah:  1..4 px auszerhalb der Kante (box plus FUELL_KANTE) - daraus kommen die Stuetzwerte
 *         der Verlaufsfuellung, also muss auch DAS zur Artikelfarbe passen.
 */
function umgebungMessen(data, width, height, box) {
  let sr = 0, sg = 0, sb = 0, n = 0, s = 0, s2 = 0, sn = 0, nn = 0;
  const kante = FUELL_KANTE, nahBis = kante + 4, ringVon = 4, ringBis = 14;
  for (let y = Math.max(0, box.y - ringBis); y < Math.min(height, box.y + box.h + ringBis); y++) {
    for (let x = Math.max(0, box.x - ringBis); x < Math.min(width, box.x + box.w + ringBis); x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128 || magentaArtig(data, i)) continue;
      const imRingLoch = x >= box.x - ringVon && x < box.x + box.w + ringVon && y >= box.y - ringVon && y < box.y + box.h + ringVon;
      const hell = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (!imRingLoch) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++; s += hell; s2 += hell * hell; }
      const imKern = x >= box.x - kante && x < box.x + box.w + kante && y >= box.y - kante && y < box.y + box.h + kante;
      const imNah = !imKern && x >= box.x - nahBis && x < box.x + box.w + nahBis && y >= box.y - nahBis && y < box.y + box.h + nahBis;
      if (imNah && !leichtMagenta(data, i)) { sn += hell; nn++; }
    }
  }
  const hellRing = n ? s / n : 0;
  return {
    n, ring: n ? [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)] : [0, 0, 0],
    hellRing, streuung: n ? Math.sqrt(Math.max(0, s2 / n - hellRing * hellRing)) : 0,
    hellNah: nn ? sn / nn : hellRing
  };
}

/** Widerspricht die Umgebung (Ring ODER Streifen an der Kante) der bestellten Artikelfarbe? */
function widerspricht(farbe, um) {
  if (farbe === 'white') return um.hellRing < 150 || um.hellNah < 150;
  if (farbe === 'black') return um.hellRing > 110 || um.hellNah > 110;
  return false;
}
// Leicht magenta-artig: reicht fuer den Saum, wo der Bilddienst die Kante weich in den Stoff
// laufen laesst. Neutraler Stoff (Rot, Gruen, Blau nah beieinander) bleibt drauszen.
const leichtMagenta = (d, i) => (d[i] - d[i + 1] > 12) && (d[i + 2] - d[i + 1] > 12);

// Am weiszen Hoodie (19. Sept.) malte der Bilddienst um den Platzhalter eine 1 px helle Kante
// (232 statt 223 an der Unterkante). Die zaehlte als Stoff, zog den Stuetzwert hoch, und die
// ganze Flaeche geriet 2 Stufen zu hell - auf Weisz sieht man das. Deshalb werden die 2 px
// direkt um die Flaeche IMMER mit ersetzt, Kante hin oder her.
const FUELL_KANTE = 2;

/** Welche Pixel ersetzt werden: alles in der Flaeche samt 2 px Kante, im Saum darueber hinaus nur das Magenta-artige. */
function fuellMaske(data, width, height, box, saum) {
  const maske = new Uint8Array(width * height);
  const weit = saum + FUELL_KANTE;
  const x0 = Math.max(0, box.x - weit), x1 = Math.min(width, box.x + box.w + weit);
  const y0 = Math.max(0, box.y - weit), y1 = Math.min(height, box.y + box.h + weit);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128) continue;
    const kern = x >= box.x - FUELL_KANTE && x < box.x + box.w + FUELL_KANTE && y >= box.y - FUELL_KANTE && y < box.y + box.h + FUELL_KANTE;
    if (kern || leichtMagenta(data, i)) maske[y * width + x] = 1;
  }
  return maske;
}

/**
 * Die maskierten Pixel aus dem Stoff drumherum interpolieren. Fuer jede Zeile wird links und
 * rechts der Maske ein Stoffwert genommen (Mittel ueber 8 px, ohne Magenta-Reste), fuer jede
 * Spalte oben und unten; die Stuetzwerte werden entlang der Kante geglaettet. Jedes Pixel
 * bekommt die Mischung aus waagerechter und senkrechter Interpolation, gewichtet nach der
 * Naehe zur jeweiligen Kante - an der Kante stimmt es also mit dem Stoff daneben ueberein.
 * Der Rueckfall (kein Stoff an einer Seite, etwa am Bildrand) ist der mittlere Ringtón.
 */
function verlaufFuellen(data, width, height, maske, mittel) {
  let rx0 = width, rx1 = -1, ry0 = height, ry1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (maske[y * width + x]) {
    if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; if (y < ry0) ry0 = y; if (y > ry1) ry1 = y;
  }
  if (rx1 < 0) return;
  // Stuetzwert: die 4 px Stoff DIREKT neben der Maske in dieser Zeile bzw. Spalte. Nicht
  // breiter - am schwarzen Shirt wurde der Stoff neben der Flaeche auf 8 px um 20 Stufen
  // heller, und ein breites Mittel lag 11 Stufen unter dem Stoff an der Kante: sichtbare Stufe.
  const band = 4;
  const probe = (xa, xb, ya, yb) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = Math.max(0, ya); y <= Math.min(height - 1, yb); y++) for (let x = Math.max(0, xa); x <= Math.min(width - 1, xb); x++) {
      const p = y * width + x, i = p * 4;
      if (maske[p] || data[i + 3] < 128 || leichtMagenta(data, i)) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    return n >= 2 ? [r / n, g / n, b / n] : null;
  };
  const glaetten = (werte) => {
    // Luecken mit dem Nachbarn fuellen, dann entlang der Kante glaetten. Das Fenster ist
    // breit (41 px): das Gewebe des Stoffs ist feinkoernig, und jeder Stuetzwert zieht sich
    // als Linie durch die ganze Flaeche - mit einem schmalen Fenster (9 px) standen Streifen
    // im Shirt. Uebrig bleiben soll nur, was grosz ist: Licht, Schatten, Falte.
    const n = werte.length;
    let letzter = null;
    for (let k = 0; k < n; k++) { if (werte[k]) letzter = werte[k]; else if (letzter) werte[k] = letzter; }
    letzter = null;
    for (let k = n - 1; k >= 0; k--) { if (werte[k]) letzter = werte[k]; else werte[k] = letzter || mittel; }
    const out = new Array(n), halb = 20;
    for (let k = 0; k < n; k++) {
      let r = 0, g = 0, b = 0, c = 0;
      for (let j = Math.max(0, k - halb); j <= Math.min(n - 1, k + halb); j++) { r += werte[j][0]; g += werte[j][1]; b += werte[j][2]; c++; }
      out[k] = [r / c, g / c, b / c];
    }
    return out;
  };
  const L = [], R = [], T = [], B = [];
  for (let y = ry0; y <= ry1; y++) {
    let xa = -1, xb = -1;
    for (let x = rx0; x <= rx1; x++) if (maske[y * width + x]) { if (xa < 0) xa = x; xb = x; }
    L.push(xa < 0 ? null : probe(xa - band, xa - 1, y, y)); R.push(xb < 0 ? null : probe(xb + 1, xb + band, y, y));
  }
  for (let x = rx0; x <= rx1; x++) {
    let ya = -1, yb = -1;
    for (let y = ry0; y <= ry1; y++) if (maske[y * width + x]) { if (ya < 0) ya = y; yb = y; }
    T.push(ya < 0 ? null : probe(x, x, ya - band, ya - 1)); B.push(yb < 0 ? null : probe(x, x, yb + 1, yb + band));
  }
  const l = glaetten(L), r = glaetten(R), t = glaetten(T), b = glaetten(B);
  const bw = rx1 - rx0 + 2, bh = ry1 - ry0 + 2;
  for (let y = ry0; y <= ry1; y++) {
    const ty = (y - ry0 + 1) / bh, dV = Math.min(y - ry0 + 1, ry1 - y + 1);
    for (let x = rx0; x <= rx1; x++) {
      const p = y * width + x;
      if (!maske[p]) continue;
      const tx = (x - rx0 + 1) / bw, dH = Math.min(x - rx0 + 1, rx1 - x + 1);
      const wH = 1 / dH, wV = 1 / dV, ws = wH + wV;
      const ly = l[y - ry0], ry = r[y - ry0], tx_ = t[x - rx0], bx_ = b[x - rx0];
      for (let c = 0; c < 3; c++) {
        const h = ly[c] * (1 - tx) + ry[c] * tx;
        const v = tx_[c] * (1 - ty) + bx_[c] * ty;
        data[p * 4 + c] = Math.max(0, Math.min(255, Math.round((h * wH + v * wV) / ws)));
      }
    }
  }
  koernungAngleichen(data, width, height, maske, rx0, ry0, rx1, ry1);
}

/**
 * Der Verlauf allein ist glatt wie Lack; fotografierter Stoff hat Korn (am schwarzen Shirt
 * rund 2 Stufen von Pixel zu Pixel). Eine glatte Flaeche im koernigen Stoff ist immer noch
 * ein Kasten, nur ein leiser. Deshalb bekommt die Flaeche dasselbe Korn wie der Stoff im
 * Ring drumherum: gemessen als Streuung der Nachbardifferenzen, aufgetragen als Helligkeits-
 * rauschen (alle drei Kanaele gleich, so wie im Foto). Der Zufall ist gesaet, damit dieselbe
 * Vorlage zweimal gleich gebaut wird.
 */
function koernungAngleichen(data, width, height, maske, rx0, ry0, rx1, ry1) {
  let s = 0, s2 = 0, n = 0;
  const hell = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  for (let y = Math.max(0, ry0 - 14); y <= Math.min(height - 1, ry1 + 14); y++) {
    for (let x = Math.max(0, rx0 - 14); x < Math.min(width - 1, rx1 + 14); x++) {
      const p = y * width + x;
      if (maske[p] || maske[p + 1]) continue;
      const nah = x >= rx0 - 4 && x <= rx1 + 4 && y >= ry0 - 4 && y <= ry1 + 4;
      if (nah) continue;
      if (data[p * 4 + 3] < 128 || leichtMagenta(data, p * 4) || leichtMagenta(data, p * 4 + 4)) continue;
      const d = hell(p * 4 + 4) - hell(p * 4);
      s += d; s2 += d * d; n++;
    }
  }
  if (n < 200) return;
  const sigma = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) / Math.SQRT2;
  if (sigma < 0.5 || sigma > 12) return;   // glatt (Papier) oder Muster - kein Korn auftragen
  let saat = (rx0 * 73856093) ^ (ry0 * 19349663) ^ (rx1 * 83492791) ^ 0x9e3779b9;
  const zufall = () => { saat |= 0; saat = saat + 0x6D2B79F5 | 0; let t = Math.imul(saat ^ saat >>> 15, 1 | saat); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) {
    const p = y * width + x;
    if (!maske[p]) continue;
    // Summe von drei Gleichverteilungen: glockenfoermig genug, Streuung 1 bei /sqrt(0.25)
    const k = (zufall() + zufall() + zufall() - 1.5) * 2 * sigma;
    for (let c = 0; c < 3; c++) data[p * 4 + c] = Math.max(0, Math.min(255, Math.round(data[p * 4 + c] + k)));
  }
}

/**
 * Befund einer bereits gefuellten Flaeche: ist sie FLACH (eine Farbe), waehrend der Stoff
 * drumherum Struktur hat? Das ist der Kasten vom alten Entfernen. Dazu, ob der Ring der
 * Artikelfarbe widerspricht - dann ist flach richtig (Poster im Rahmen).
 */
export async function flaecheBefund(png, box, farbe = '') {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const x0 = Math.max(0, box.x + 10), x1 = Math.min(width, box.x + box.w - 10);
  const y0 = Math.max(0, box.y + 10), y1 = Math.min(height, box.y + box.h - 10);
  let min = [255, 255, 255], max = [0, 0, 0];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) { if (data[i + c] < min[c]) min[c] = data[i + c]; if (data[i + c] > max[c]) max[c] = data[i + c]; }
  }
  const innenSpanne = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  // Dieselbe Messung wie beim Entfernen - sonst kaeme das Nachputzen zu einem anderen Schluss
  // als das Fuellen und wuerde dieselbe Vorlage bei jedem Start neu schreiben.
  const um = umgebungMessen(data, width, height, box);
  const ringWiderspricht = widerspricht(farbe, um);
  const flachAufStoff = innenSpanne <= 2 && um.streuung > 2 && !ringWiderspricht;
  return { innenSpanne, ringStreuung: um.streuung, ringHell: um.hellRing, nahHell: um.hellNah, ringWiderspricht, flachAufStoff, ring: um.n ? um.ring : null };
}

/**
 * Wie viele magenta-artige Pixel stehen noch in einer Flaeche? Null ist das Ziel. Damit
 * prueft die Abnahme das Entfernen, und der Server erkennt beim Start Vorlagen, die mit der
 * alten, zu engen Regel gebaut wurden.
 */
export async function magentaRest(png, box) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let rest = 0;
  for (let y = Math.max(0, box.y); y < Math.min(height, box.y + box.h); y++) {
    for (let x = Math.max(0, box.x); x < Math.min(width, box.x + box.w); x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      if ((data[i] - data[i + 1] > 40) && (data[i + 2] - data[i + 1] > 40)) rest++;
    }
  }
  return rest;
}

/** Mittlerer Farbwert (RGB) innerhalb einer Flaeche, 10 px Rand ausgespart. */
export async function flaecheMittel(png, box) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const x0 = Math.max(0, box.x + 10), x1 = Math.min(width, box.x + box.w - 10);
  const y0 = Math.max(0, box.y + 10), y1 = Math.min(height, box.y + box.h - 10);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * width + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 0, 0];
}

/** Eine Flaeche flach mit einem Farbwert fuellen - fuer den Platzhalter, der immer flach war. */
export async function flaecheFuellen(png, box, rgb) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  for (let y = Math.max(0, box.y); y < Math.min(height, box.y + box.h); y++) {
    for (let x = Math.max(0, box.x); x < Math.min(width, box.x + box.w); x++) {
      const i = (y * width + x) * 4; data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * Bereits erzeugte Vorlagen nachputzen: alle, die mit der alten, zu engen Regel gebaut
 * wurden und noch Rosa in der Flaeche tragen. Laeuft beim Serverstart im Hintergrund,
 * kauft kein neues Bild und fasst Herstellerfotos nie an (die haben keine gemessene Flaeche).
 * Gibt zurueck, welche Artikel sich geaendert haben - deren fertige Mockups sind veraltet.
 */
export async function vorlagenNachputzen(storeDir, boxen, { istOriginal = () => false } = {}) {
  const dir = path.join(storeDir, 'templates');
  const geputzt = [], sauber = [];
  for (const [key, alt] of Object.entries(boxen || {})) {
    if (istOriginal(key)) continue;
    const datei = path.join(dir, key + '.png');
    let png;
    try { png = await fs.readFile(datei); } catch (e) { continue; }
    try {
      // Erst die Flaeche neu messen: die alte war zu klein (ohne den Saum), und die alte
      // Fuellung ist selbst rosa - beides zaehlt jetzt als Platzhalter und ergibt die echte Flaeche.
      const box = await flaecheNachmessen(png, alt);
      const rest = await magentaRest(png, box);
      const farbe = /_black$/.test(key) ? 'black' : /_white$/.test(key) ? 'white' : '';
      // 19. Sept., 04:48, Markus' Poster an der Wand: die Flaeche war DUNKEL gefuellt - vom
      // alten Code, der den Ring (= schwarzer Rahmen) als Stoffton nahm. Kein Rosa drin, also
      // galt sie hier als sauber. Eine Fuellung, die der Artikelfarbe widerspricht, ist aber
      // genauso falsch wie Rosa: weisz bestellt und dunkel gefuellt, oder umgekehrt.
      const innen = await flaecheMittel(png, box);
      const hell = 0.2126 * innen[0] + 0.7152 * innen[1] + 0.0722 * innen[2];
      const falscheFarbe = (farbe === 'white' && hell < 150) || (farbe === 'black' && hell > 110);
      // 19. Sept., laufende Seite: flach gefuellte Flaeche auf fotografiertem Stoff = Kasten.
      // Auch ohne Rosa und in der richtigen Farbe ist das falsch; die Flaeche bekommt den
      // Verlauf des Stoffs (magentaEntfernen ersetzt alles in der Flaeche, Rosa hin oder her).
      const befund = await flaecheBefund(png, box, farbe);
      const flach = befund.flachAufStoff;
      if (rest < 50 && !falscheFarbe && !flach) { sauber.push(key); continue; }
      let neu = (rest >= 50 || flach) ? await magentaEntfernen(png, box, { farbe }) : png;
      if (falscheFarbe) neu = await flaecheFuellen(neu, box, farbe === 'white' ? [246, 245, 241] : [28, 28, 31]);
      const danach = await magentaRest(neu, box);
      await fs.writeFile(datei, neu);
      geputzt.push({ key, vorher: rest, nachher: danach, boxAlt: alt, box, farbeKorrigiert: falscheFarbe, verlauf: flach });
    } catch (e) { console.error('Vorlage nachputzen:', key, e && e.message ? e.message : e); }
  }
  return { geputzt, sauber };
}

/** Die box auf die 1024er-Vorlage umrechnen, in der mockups.js denkt. */
export function boxAuf1024(box, breite, hoehe) {
  const f = 1024 / Math.max(breite, hoehe);
  return {
    x: Math.round(box.x * f), y: Math.round(box.y * f),
    w: Math.round(box.w * f), h: Math.round(box.h * f)
  };
}

// =============================================================================================
// Die Bestellzettel fuer die Bilder
// =============================================================================================
// Zwei Bilder je Artikel, und sie haben verschiedene Aufgaben:
//   PRODUKT  - sachlich, vor ruhigem Grund, gerade von vorn. Es zeigt, WAS man kauft. Hier
//              darf nichts ablenken: kein Tisch, keine Hand, keine Stimmung.
//   SITUATION- dasselbe Teil in Benutzung. Es zeigt, WARUM man es will. Hier darf die Stimmung
//              her, aber das Teil muss trotzdem gerade und vollstaendig im Bild liegen - sonst
//              sitzt das Motiv spaeter schief darauf.
// Beide muessen LEER sein: kein Aufdruck, kein Text, kein Logo. Was daraufkommt, ist das Design
// des Kunden, und das wird spaeter hineingerechnet.
const GEMEINSAM = 'No print, no pattern, no text, no letters, no logo, no watermark on the item - '
  + 'it is completely blank and undecorated. Photorealistic product photography, sharp focus, '
  + 'high detail, realistic material and texture, natural colours.';

// Fuer Flachware: das Teil steht frei, der Hintergrund ist durchsichtig. Genau daraus misst
// flaecheAusAlpha die Druckflaeche - deshalb darf NICHTS anderes im Bild stehen.
// Fassung 85e, am zweiten echten Bild gelernt und deshalb umgebaut.
// Zuerst wurde Flachware freigestellt bestellt und ihre Kontur im Alphakanal gemessen. Das
// klang sauber, scheiterte aber am echten Bild: der Bilddienst legt um ein helles
// freigestelltes Teil einen weichen weiszen Schein - auch dann noch, als ich ihn im
// Bestellzettel ausdruecklich verboten hatte. Der Schein ist DECKEND, also half auch eine
// haertere Alphaschwelle nicht: gemessen wurden 860x1010 statt 700x950. Das Motiv haette
// ueber den Papierrand gehangen.
// Jetzt gibt es nur noch EINEN Messweg, und zwar den, der am echten Bild bewiesen funktioniert
// hat: den Magenta-Platzhalter. Bei Flachware deckt er das ganze Teil, bei einem Shirt nur die
// Brust. Ein Weg statt zwei ist auch sonst besser - was nur an einer Stelle passiert, kann nur
// an einer Stelle kaputtgehen.
// Nebeneffekt, der nichts kostet: die Produktansicht darf jetzt einen ruhigen Grund und einen
// weichen Schatten haben. Ein freigestelltes Blatt Papier vor dem Nichts sah aus wie nichts.
const GRUND = 'The item stands on its own in the middle of a plain light grey seamless studio '
  + 'background with a soft natural shadow beneath it, the whole item inside the frame with an '
  + 'even margin, seen straight on, not tilted, not in perspective.';

// Fuer Teilflaechen: die Druckstelle wird als magentafarbene Flaeche mitbestellt.
const PLATZ = 'On the print area there is a perfectly flat, solid rectangle of bright magenta '
  + '(RGB 255,0,230), completely even, with sharp straight edges, no gradient, no shading, no '
  + 'texture, no folds across it. This magenta rectangle marks where a design will be placed '
  + 'later. Everything outside the rectangle is the normal blank product.';

// Fuer eine SITUATION bei Flachware: dort liegt das Teil in einer Umgebung, die Kontur hilft
// also nicht mehr. Deshalb wird auch hier der Platzhalter mitbestellt - er deckt die ganze
// sichtbare Flaeche des Teils, denn bei Flachware IST das Teil die Druckflaeche.
const PLATZ_VOLL = 'The entire visible face of the item is covered by a perfectly flat, solid '
  + 'rectangle of bright magenta (RGB 255,0,230), completely even, with sharp straight edges, no '
  + 'gradient, no shading, no texture, no reflection and no shadow across it. This magenta area '
  + 'marks where a design will be placed later. Everything around the item stays as described.';

// weg: 'magenta' = Flaeche aus der Kontur (Flachware), 'magenta' = Flaeche am Platzhalter.
// 27. Sept., Markus (Screenshot "Anne · 65" an einem Mann): "Am Namen ist zu erkennen, dass es
// sich um eine Frau handelt. Dann sollte es auch als Frau als Beispiel kommen." Die getragenen
// Textilien gibt es deshalb dreimal: allgemein (szene), als Frau (szene-frau) und als Mann
// (szene-mann). Derselbe Bestellzettel, nur die Person wechselt - sonst saehe "die Frau" anders
// aus als "der Mann" (anderes Licht, andere Haltung) und der Kunde wuerde zwei Fotos vergleichen
// statt zwei Shirts. Welche Vorlage gezeigt wird, entscheidet der Vorname auf dem Design
// (vornamen.js, mockups.js szeneVarianteDa).
export const PERSONEN = { '': 'A person', frau: 'A woman', mann: 'A man' };
// Die Brustflaeche eines Textils ist HOCHformatig (Druckdatei 36 x 46 cm, GARMENTS tee.box 370 x 555).
// 27. Sept., erste Probe: ohne diesen Satz malte das Modell ein breites Querformat auf die Brust,
// und das Motiv waere darin klein eingepasst worden. Also wird die Form mitbestellt.
const BRUST = 'The magenta rectangle sits flat on the chest, centred, clearly taller than wide (about 3:4), '
  + 'reaching from just below the neckline down to the stomach, about a third of the garment width.';
const getragen = (satz) => ({
  szene: (f) => satz(f, PERSONEN['']),
  'szene-frau': (f) => satz(f, PERSONEN.frau),
  'szene-mann': (f) => satz(f, PERSONEN.mann)
});

// 2. Okt., Markus: "Wenn Weihnachtsmotiv drauf ist, dass es ne weihnachtliche Umgebung ist ... fuer ne
// Abifeier dann natuerlich auf der Abifeier, ein Angler beim Angeln, jemand auf einer Bowlingbahn, so
// dass wir da Abwechslung rein kriegen" - "die Szenen machst du direkt mit". Je Motto EIN Foto: wer
// (Person), wo (die Szene) und was er in der Hand haelt - nie vor der Brust, damit die Druckflaeche
// frei bleibt. Von der Huefte aufwaerts: so ist die Szene zu sehen und das Design trotzdem gross
// genug (von den Knien aufwaerts gemessen nur 166 px Flaechenbreite von 1024). Die schwarze Fassung
// ist eine Bearbeitung DESSELBEN Fotos (szeneSchwarzAuftrag). Abgelegt als vorlagen-original/
// tee-szene-thema-<motto>_<farbe>.jpg, Flaeche in mockups.js MITGELIEFERT.
export const SZENEN_ZETTEL = {
  weihnachtsfeier: { wer: 'frau', satz: 'A woman in her mid-thirties at an office Christmas party in the evening: a decorated Christmas tree with warm lights, paper stars, colleagues chatting softly out of focus behind her, a table with mulled wine mugs and biscuits', haelt: 'holding a mug of mulled wine low at her side' },
  abi: { wer: 'mann', satz: 'A young man of nineteen at his school graduation party in the evening: a decorated school hall with balloons, paper garlands and classmates celebrating out of focus behind him', haelt: 'holding a rolled diploma tied with a ribbon low at his side' },
  bowling: { wer: 'frau', satz: 'A woman around thirty in a bowling alley: polished wooden lanes, the ten white pins at the far end of the lane behind her, ball returns and soft neon light', haelt: 'holding a glossy marbled bowling ball with three finger holes low at her side' },
  'angler-shirt': { wer: 'mann', satz: 'A man around fifty on the grassy shore of a calm lake in the early morning, light mist over the water, reeds and a wooden jetty behind him', haelt: 'holding a fishing rod upright beside him' },
  darts: { wer: 'mann', satz: 'A man in his mid-thirties in a cosy pub, a dartboard on the wooden wall behind him, warm lamps and friends at the bar out of focus', haelt: 'holding three darts low at his side' },
  'malle-fahrt': { wer: 'frau', satz: 'A woman in her mid-twenties on a sunny beach promenade on Mallorca, palm trees, turquoise sea and a sandy beach behind her', haelt: 'sunglasses pushed up into her hair, one hand relaxed at her side' },
  // 2. Okt., Markus zur ersten Fassung (Gast im Shirt zwischen Anzuegen und Abendkleidern): "Hochzeit
  // das unpassend". Ein Hochzeitsshirt traegt das Paar, nicht der Gast - also der Braeutigam am
  // geschmueckten Hochzeitsauto, die Braut lachend hinter ihm.
  hochzeit: { wer: 'mann', satz: 'A groom around thirty right after his wedding ceremony, in dark suit trousers, standing in front of a white vintage convertible decorated as a wedding car with white ribbons, flowers and tin cans tied to the rear bumper, his bride in a white wedding dress laughing out of focus behind him, confetti in the air, warm summer evening light', haelt: 'holding a glass of champagne low at his side' },
  junggesellenabschied: { wer: 'mann', satz: 'A man around thirty on a lively harbour street at night during a stag party, colourful lights reflected on the wet street and his friends laughing out of focus behind him', haelt: 'holding a bottle low at his side' },
  karneval: { wer: 'frau', satz: 'A woman around thirty at a street carnival, colourful confetti in the air and in her hair, costumed people celebrating out of focus behind her', haelt: 'one hand raised in a cheerful wave beside her head' },
  vereinsjubilaeum: { wer: 'mann', satz: 'A man in his mid-fifties beside a village football pitch with a small clubhouse, bunting and club members celebrating at long tables behind him', haelt: 'holding a glass of beer low at his side' },
  'jaeger-shirt': { wer: 'mann', satz: 'A man around fifty at the edge of a forest at dawn, a wooden raised hunting hide and a meadow with morning mist behind him', haelt: 'holding binoculars in one hand low at his side' },
  'handwerker-shirt': { wer: 'mann', satz: 'A man around forty in a bright carpentry workshop, a workbench with tools, planks and wood shavings behind him', haelt: 'holding a hammer low at his side' },
  'motorrad-shirt': { wer: 'mann', satz: 'A man in his mid-forties at a mountain road pull-out, his motorbike parked behind him and a winding pass road in the valley', haelt: 'holding a motorbike helmet low at his side' },
  'sprueche-shirt': { wer: 'frau', satz: 'A woman in her late twenties on a sunny city cafe terrace, small tables, plants and a cobbled street behind her', haelt: 'holding a coffee cup low at her side' },
  'geburt-baby': { wer: 'frau', satz: 'A woman in her early thirties in a bright nursery, a white crib, soft toys and a mobile behind her', haelt: 'holding a small soft toy low at her side' },
  geburtstag: { wer: 'frau', satz: 'A woman around forty at her birthday party at home, colourful balloons, a cake with candles on the table and friends out of focus behind her', haelt: 'holding a glass of sparkling wine low at her side' },
  abschlussfahrt: { wer: 'mann', satz: 'A boy of about sixteen on a class trip in a historic old town square, classmates with backpacks out of focus behind him', haelt: 'a backpack strap over one shoulder, the other hand relaxed at his side' },
  kegeltour: { wer: 'mann', satz: 'A man around fifty in a traditional German skittle alley with a wooden lane and nine skittles at the far end behind him', haelt: 'holding a wooden skittle ball without finger holes low at his side' },
  firmenausflug: { wer: 'frau', satz: 'A woman around forty on a company outing at a lakeside beer garden, colleagues at long wooden tables out of focus behind her', haelt: 'one hand relaxed at her side' },
  familie: { wer: 'mann', satz: 'A grandfather around seventy in a sunny family garden, a coffee table with cake and his family out of focus behind him', haelt: 'one hand relaxed at his side' },
  'landwirt-shirt': { wer: 'mann', satz: 'A farmer around forty-five in front of his farm, a green tractor and a golden wheat field behind him', haelt: 'one hand resting on his hip' },
  fanclub: { wer: 'mann', satz: 'A football fan around thirty in a stadium stand on match day, other fans and a green pitch out of focus behind him, no club colours, no flags with symbols', haelt: 'holding a plain knitted scarf without any lettering low at his side' },
  'fan-shirt': { wer: 'frau', satz: 'A woman around thirty outside a stadium on match day, fans walking by out of focus behind her, no club colours, no flags with symbols', haelt: 'one hand relaxed at her side' },
  'meister-shirt': { wer: 'mann', satz: 'An amateur football player around twenty-five on a pitch after winning the league, teammates celebrating out of focus behind him', haelt: 'holding a shiny trophy cup low at his side' },
  'tier-shirt': { wer: 'frau', satz: 'A woman around thirty-five in a sunny park with her dog sitting beside her on the grass', haelt: 'holding a dog leash low at her side' },
  'kinder-tiershirt': { wer: 'frau', satz: 'A girl of about eight in a sunny garden with a swing and flowers behind her', haelt: 'holding a small soft toy animal low at her side' },
  schulmotto: { wer: 'frau', satz: 'A girl of about fifteen in a school yard on a sunny day, the school building and classmates out of focus behind her', haelt: 'a school bag strap over one shoulder' }
};
const PERSON_WORT = { frau: ['she', 'her'], mann: ['he', 'his'] };
// 2. Okt., Markus zum Schaufenster: "warum immer ein T-Shirt und immer die gleiche Groesse ... mal
// Hoodie, mal T-Shirt, mal klein, mal gross, mal was auf dem Ruecken". opts.teil 'hoodie' zieht
// derselben Person in derselben Szene einen Hoodie an (hoodie-szene-thema-<motto>), opts.ruecken
// dreht sie um (tee-szene-thema-<motto>-ruecken). Die Flaeche ist in allen Fassungen gleich bestellt
// ("about a third of the garment width"), damit EIN Massstab fuer alle Szenen gilt (THEMA_BREITE_CM).
const RUECKEN = 'The magenta rectangle sits flat on the upper back, centred, clearly taller than wide (about 3:4), '
  + 'reaching from just below the collar down to the lower back, about a third of the garment width.';
export function szeneThemaAuftrag(motto, opts = {}) {
  const z = opts.zettel || SZENEN_ZETTEL[motto]; if (!z) return '';   // 7. Okt.: opts.zettel = Szene nach Begriff (szene-begriff.js)
  const [er, sein] = PERSON_WORT[z.wer] || ['they', 'their'];
  const Er = er[0].toUpperCase() + er.slice(1);
  const teil = opts.teil === 'hoodie' ? 'pullover hoodie with the hood lying down behind the neck and a kangaroo pocket' : 'crew-neck t-shirt';
  const haltung = opts.ruecken
    ? `${Er} stands with ${sein === 'his' ? 'his' : 'her'} back to the camera, shoulders level, head turned over one shoulder towards the camera with a relaxed natural smile, ${z.haelt} - nothing in front of the back. Framed from the hips up, the surroundings clearly visible around. ${Er} wears a blank plain white ${teil}, smooth and flat on the back. ${PLATZ} ${RUECKEN}`
    : `${Er} stands upright facing the camera straight on, shoulders level, relaxed natural smile, ${z.haelt} - nothing in front of the chest. Framed from the hips up, the surroundings clearly visible behind and around. ${Er} wears a blank plain white ${teil}, smooth and flat on the chest. ${PLATZ} ${BRUST}${opts.teil === 'hoodie' ? ' It sits above the kangaroo pocket.' : ''}`;
  return `${z.satz}. ${haltung} No print, no pattern, no text, no letters, no logo on any clothing; no readable text, no signs and no brand names anywhere in the scene. Photorealistic photograph, natural light, sharp focus on ${sein === 'her' ? 'her' : sein === 'his' ? 'him' : 'them'}, realistic fabric.`;
}
export const szeneSchwarzAuftrag = 'Change ONLY the colour of the t-shirt from white to plain black - the same t-shirt, same cut, same fit, same folds and light, now a blank plain black crew-neck t-shirt. The bright magenta rectangle on the chest stays EXACTLY as it is: same position, same size, same flat solid magenta (RGB 255,0,230), sharp straight edges. Everything else in the photo stays exactly the same: the person, the face, the pose, the other clothes, what they hold, the scene, the people and the light. No print, no text, no logo anywhere on the clothing.';

export const szeneSchwarzAuftragTeil = (teil, ruecken) => szeneSchwarzAuftrag
  .replace(/t-shirt/g, teil === 'hoodie' ? 'hoodie' : 't-shirt').replace('crew-neck hoodie', 'pullover hoodie')
  .replace('on the chest', ruecken ? 'on the back' : 'on the chest');

export const VORLAGEN = {
  tee: {
    weg: 'magenta',
    produkt: (f) => `A blank ${f} t-shirt laid out flat and seen straight from the front on a plain light grey seamless studio background, sleeves slightly spread, shoulders level, the whole shirt inside the frame. ${PLATZ} The magenta rectangle sits on the chest, centred, about a third of the shirt width. ${GEMEINSAM}`,
    ...getragen((f, p) => `${p} from the shoulders down wearing a blank ${f} t-shirt, standing relaxed and facing the camera straight on in warm daylight, upper body filling the frame, no face visible. ${PLATZ} ${BRUST} ${GEMEINSAM}`)
  },
  polo: {
    weg: 'magenta',
    produkt: (f) => `A blank ${f} polo shirt laid out flat and seen straight from the front on a plain light grey seamless studio background, collar and two-button placket visible, the whole shirt inside the frame. ${PLATZ} The magenta rectangle sits on the chest below the placket, centred. ${GEMEINSAM}`,
    ...getragen((f, p) => `${p} from the shoulders down wearing a blank ${f} polo shirt, standing relaxed, facing the camera straight on, soft daylight, no face visible. ${PLATZ} ${BRUST} ${GEMEINSAM}`)
  },
  hoodie: {
    weg: 'magenta',
    produkt: (f) => `A blank ${f} hoodie laid out flat and seen straight from the front on a plain light grey seamless studio background, hood flat behind the shoulders, kangaroo pocket visible at the bottom, the whole hoodie inside the frame. ${PLATZ} The magenta rectangle sits on the chest ABOVE the kangaroo pocket, centred. ${GEMEINSAM}`,
    ...getragen((f, p) => `${p} from the shoulders down wearing a blank ${f} hoodie, standing outdoors in soft daylight, facing the camera straight on, no face visible. ${PLATZ} ${BRUST} It sits above the kangaroo pocket. ${GEMEINSAM}`)
  },
  zip: {
    weg: 'magenta',
    produkt: (f) => `A blank ${f} full-zip hooded jacket seen straight from the BACK, laid out flat on a plain light grey seamless studio background, the whole jacket inside the frame. ${PLATZ} The magenta rectangle sits large and centred on the back, between the shoulder blades. ${GEMEINSAM}`,
    ...getragen((f, p) => `${p} seen from behind from the shoulders down wearing a blank ${f} full-zip hooded jacket, standing outdoors in soft daylight. ${PLATZ} The magenta rectangle sits large and centred on the back, clearly taller than wide (about 3:4), from between the shoulder blades down to the lower back. ${GEMEINSAM}`)
  },
  tasse: {
    weg: 'magenta',
    produkt: (f) => `A blank ${f} ceramic mug standing upright, seen straight from the front at eye level, on a plain light grey seamless studio background, handle pointing to the right, soft even studio light. ${PLATZ} The magenta rectangle sits on the front wall of the mug, centred, following the gentle curve of the cylinder. ${GEMEINSAM}`,
    szene: (f) => `A blank ${f} ceramic mug standing on a wooden desk next to a notebook and a pair of glasses, warm morning light through a window, seen from the front at eye level, handle pointing right, the mug sharp and filling most of the frame. ${PLATZ} The magenta rectangle sits on the front wall of the mug, centred. ${GEMEINSAM}`
  },
  beutel: {
    weg: 'magenta',
    produkt: (f) => `A blank ${f} cotton tote bag hanging flat and seen straight from the front on a plain light grey seamless studio background, both handles visible at the top, the whole bag inside the frame. ${PLATZ} The magenta rectangle sits centred on the front of the bag. ${GEMEINSAM}`,
    szene: (f) => `A blank ${f} cotton tote bag hanging over a person's shoulder, seen from the side so the front of the bag faces the camera flat, sunny street in soft focus behind, no face visible. ${PLATZ} The magenta rectangle sits centred on the front of the bag. ${GEMEINSAM}`
  },
  // ---- Flachware: das Teil IST die Druckflaeche, die Kontur genuegt ----
  poster: {
    weg: 'magenta',
    produkt: () => `A blank matte poster print in portrait format, plain off-white paper, seen perfectly straight on. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank matte poster in a thin black frame hanging on a plain painted wall above a sideboard, seen straight on, soft daylight from the side, the frame filling most of the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  sticker: {
    weg: 'magenta',
    produkt: () => `A blank square vinyl sticker with rounded corners and a thin white border, glossy surface, seen perfectly straight on. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank square vinyl sticker with a thin white border stuck flat on the lid of a laptop, seen straight on, soft indoor daylight. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  kissen: {
    weg: 'magenta',
    produkt: () => `A blank square cushion with a plain light woven cover, plump and evenly filled, seen perfectly straight from the front. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank light square cushion standing upright in the corner of a grey fabric sofa, seen straight from the front, warm daylight from a window, the cushion sharp and filling most of the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  handtuch: {
    weg: 'magenta',
    produkt: () => `A blank light terry towel hanging flat and fully unfolded, portrait format, seen perfectly straight on. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank light terry towel spread out flat on golden beach sand, seen straight from above, the whole towel inside the frame, bright summer daylight, a few shells at the edge of the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  strandtuch: {
    weg: 'magenta',
    produkt: () => `A blank light beach towel hanging flat and fully unfolded, tall portrait format, seen perfectly straight on. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank light beach towel spread out flat on golden sand next to a straw hat and sunglasses, seen straight from above, the whole towel inside the frame, bright summer daylight. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  fussmatte: {
    weg: 'magenta',
    produkt: () => `A blank coir doormat with a thin dark rubber edge, landscape format (wider than deep), seen perfectly straight from above. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank coir doormat lying flat on a stone doorstep in front of a wooden house door, seen straight from above, soft daylight, the whole mat inside the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  mousepad: {
    weg: 'magenta',
    produkt: () => `A blank wide desk mat with stitched edges, very wide landscape format, lying flat, seen perfectly straight from above. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank wide desk mat lying on a wooden desk with a keyboard and mouse resting on it, seen straight from above, soft daylight, the whole mat inside the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  hundedecke: {
    weg: 'magenta',
    produkt: () => `A blank soft fleece pet blanket, landscape format, laid out flat and fully unfolded, seen perfectly straight from above. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank soft fleece pet blanket spread flat inside a wicker dog basket, seen straight from above, warm indoor daylight, the whole blanket inside the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  acrylbild: {
    weg: 'magenta',
    produkt: () => `A blank glossy acrylic glass panel in portrait format with polished edges and small metal wall mounts at the corners, seen perfectly straight on. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank glossy acrylic glass panel mounted on a plain painted wall with small metal spacers, seen straight on, soft daylight from the side, a plant out of focus at the edge. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  tuerschild: {
    weg: 'magenta',
    produkt: () => `A blank rectangular door sign in portrait format, smooth matte surface with rounded corners and two small screw holes, seen perfectly straight on. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank rectangular door sign screwed onto a wooden door at eye level, seen straight on, soft daylight. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  brett: {
    weg: 'magenta',
    produkt: () => `A blank light wooden chopping board in landscape format with rounded corners and a small hanging hole, lying flat, seen perfectly straight from above. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank light wooden chopping board lying on a kitchen worktop next to a bowl and a linen cloth, seen straight from above, warm daylight, the whole board inside the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  napfunterlage: {
    weg: 'magenta',
    produkt: () => `A blank rectangular pet feeding mat of soft matte silicone with a thin raised rim, landscape format, lying flat, seen perfectly straight from above. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank rectangular pet feeding mat lying on a kitchen floor with two empty stainless steel bowls standing at one end, seen straight from above, soft daylight, the whole mat inside the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  },
  gepaeckanhaenger: {
    weg: 'magenta',
    produkt: () => `A blank rectangular luggage tag in portrait format with rounded corners and a small hole at the top, matte surface, seen perfectly straight on. ${GRUND} ${PLATZ_VOLL} ${GEMEINSAM}`,
    szene: () => `A blank rectangular luggage tag hanging from the handle of a dark suitcase by a short leather strap, seen straight on, soft airport daylight, the tag sharp and filling much of the frame. ${PLATZ_VOLL} ${GEMEINSAM}`
  }
};

/** Farbwort fuer den Bestellzettel - die Vorlagen gibt es in Schwarz und Weiss. */
export const farbWort = (farbe) => (farbe === 'white' ? 'plain white' : 'plain black');

/** Gibt es fuer diesen Artikel einen Bestellzettel? */
export const kenntVorlage = (artikel) => !!VORLAGEN[artikel];

/**
 * Eine Vorlage fertig machen: Bild -> Flaeche messen -> Platzhalter entfernen -> auf 1024 px.
 * Das Erzeugen selbst steckt NICHT hier drin, sondern wird hereingereicht (erzeugeBild) - so
 * wie beim Aufmacher. vorlagen.js soll messen und aufraeumen koennen, nicht den Bilddienst kennen.
 */
export async function vorlageBauen({ artikel, ansicht, farbe, erzeugeBild }) {
  const v = VORLAGEN[artikel];
  if (!v) throw new Error('kein Bestellzettel fuer ' + artikel);
  if (typeof v[ansicht] !== 'function') throw new Error('ansicht muss produkt oder szene sein' + (ansicht.startsWith('szene-') ? ' - ' + artikel + ' hat keine Situation mit Person' : ''));
  const prompt = v[ansicht](farbWort(farbe));
  // Kein Freistellen mehr: jede Vorlage braucht ihre Umgebung (Studiogrund oder Situation),
  // und gemessen wird ueberall am Platzhalter. Siehe Fassung 85e oben.
  const png = await erzeugeBild({ prompt, freigestellt: false });

  const { width, height } = await sharp(png).metadata();
  const box = await flaecheAusMagenta(png);
  // Sicherheitsnetz gegen ein Modell, das den Platzhalter ueber das ganze Bild legt statt nur
  // auf das Teil: dann waere die "Druckflaeche" das ganze Foto samt Wand und Sideboard.
  if (box.w > width * 0.97 && box.h > height * 0.97) {
    throw new Error('Der Platzhalter bedeckt das ganze Bild (' + box.w + 'x' + box.h + ') - das ist nicht die Druckflaeche. Bild neu erzeugen.');
  }
  const bild = await magentaEntfernen(png, box, { farbe });

  // Auf 1024 x 1024 bringen - in dieser Groesse denkt mockups.js, und dort liegen alle anderen.
  // Fassung 90: 'cover' BESCHNEIDET ein nicht-quadratisches Bild, boxAuf1024 rechnete aber wie
  // bei 'inside'. Bei jedem Hochformat sasz die Flaeche danach falsch - das waren die
  // "verdaechtigen Querformate" vom Vormittag. Jetzt wird die Flaeche mit derselben Rechnung
  // verschoben wie das Bild; und ragt der Platzhalter dabei aus dem Beschnitt heraus, ist die
  // Vorlage unbrauchbar und wird abgelehnt statt still falsch gespeichert.
  const fertig = await sharp(bild).resize({ width: 1024, height: 1024, fit: 'cover', position: 'centre' }).png().toBuffer();
  const skaliert = boxNachCover(box, width, height);
  return { png: fertig, box: skaliert, prompt, roh: { box, width, height } };
}

/** Die Flaeche so umrechnen, wie sharp das Bild mit fit 'cover' (mittig) auf 1024x1024 bringt. */
export function boxNachCover(box, breite, hoehe, ziel = 1024) {
  const s = ziel / Math.min(breite, hoehe);
  const dx = (breite * s - ziel) / 2, dy = (hoehe * s - ziel) / 2;
  const x = box.x * s - dx, y = box.y * s - dy, w = box.w * s, h = box.h * s;
  const ueber = Math.max(0, -x) + Math.max(0, x + w - ziel) + Math.max(0, -y) + Math.max(0, y + h - ziel);
  if (ueber > 0.05 * (w + h)) throw new Error('Der Platzhalter liegt zu weit am Rand und wuerde beim Zuschnitt auf 1024x1024 abgeschnitten. Bild neu erzeugen.');
  const cx = Math.max(0, Math.round(x)), cy = Math.max(0, Math.round(y));
  return { x: cx, y: cy, w: Math.min(ziel - cx, Math.round(x + w) - cx), h: Math.min(ziel - cy, Math.round(y + h) - cy) };
}
