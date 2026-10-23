import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
const execFileP = promisify(execFile);
import { PDFDocument } from 'pdf-lib';
// Die vier Textiltoene kommen aus mottos.js - EINE Quelle, sonst driften Prompt und Bild
// auseinander. mottos.js zieht seinerseits nichts aus images.js, es gibt also keinen Ring.
import { textilTon, istHell, stoffLiefertFarbe } from './mottos.js';

// ---------- Notbremse: ist das Bild praktisch leer? ----------
export async function whiteCheck(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let white = 0, total = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 10) continue;
    total++;
    if (data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250) white++;
  }
  return total ? white / total : 0;
}

// ---------- Hintergrund freistellen ----------
function near(d, i, s, tol) {
  return Math.abs(d[i] - s[0]) <= tol && Math.abs(d[i + 1] - s[1]) <= tol && Math.abs(d[i + 2] - s[2]) <= tol;
}

// Der Bildgenerator malt den "transparenten" Hintergrund oft als Karomuster oder Flaeche.
// Erst vom Rand her fluten, dann eingeschlossene Karo-Reste am Wechsel der Hintergrundtoene erkennen.
export async function cutout(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const at = (x, y) => (y * w + x) * ch;

  const seeds = [];
  const seed = (x, y) => {
    const i = at(x, y);
    if (data[i + 3] < 250) return;
    for (const s of seeds) if (near(data, i, s, 14)) return;
    if (seeds.length < 4) seeds.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < w; x += 4) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y += 4) { seed(0, y); seed(w - 1, y); }
  if (!seeds.length) return pngBuffer;

  const isBg = (i) => { for (const s of seeds) if (near(data, i, s, 30)) return true; return false; };
  const seen = new Uint8Array(w * h);
  const qx = new Int32Array(w * h), qy = new Int32Array(w * h);
  let head = 0, tail = 0, cleared = 0;
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    seen[p] = 1; qx[tail] = x; qy[tail] = y; tail++;
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (head < tail) {
    const x = qx[head], y = qy[head]; head++;
    const i = at(x, y);
    if (data[i + 3] !== 0 && !isBg(i)) continue;
    data[i + 3] = 0; cleared++;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  if (seeds.length >= 2) {
    const tone = (i) => { for (let k = 0; k < seeds.length; k++) if (near(data, i, seeds[k], 30)) return k; return -1; };
    const hits = new Uint8Array(w * h);
    const off = [-24, -16, -8, 8, 16, 24];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x, i = p * ch;
        if (data[i + 3] === 0) continue;
        const t = tone(i); if (t < 0) continue;
        let other = false;
        for (let k = 0; k < off.length && !other; k++) {
          const nx = x + off[k], ny = y + off[k];
          if (nx >= 0 && nx < w) { const nt = tone((y * w + nx) * ch); if (nt >= 0 && nt !== t) other = true; }
          if (!other && ny >= 0 && ny < h) { const nt = tone((ny * w + x) * ch); if (nt >= 0 && nt !== t) other = true; }
        }
        if (other) hits[p] = 1;
      }
    }
    for (let p = 0; p < w * h; p++) if (hits[p]) { data[p * ch + 3] = 0; cleared++; }
  }

  // Fassung 35: Punzen. Das Fluten vom Rand kommt nie in das Loch im b, e, a, o - dort blieb der
  // weisse Hintergrund als Fleck im Buchstaben stehen (auf schwarzem Shirt sofort sichtbar).
  // Kleine, rundum eingeschlossene Inseln in Hintergrundfarbe (unter 0,6 % der Flaeche) sind
  // mit grosser Sicherheit solche Punzen und fliegen mit raus. Grosse helle Flaechen bleiben -
  // die koennten Teil des Logos sein.
  {
    const grenze = Math.max(4, Math.floor(w * h * 0.006));
    const komp = new Uint8Array(w * h);
    let punzen = 0;
    for (let start = 0; start < w * h; start++) {
      if (komp[start] || data[start * ch + 3] === 0 || !isBg(start * ch)) continue;
      // Insel einsammeln
      const liste = [start]; komp[start] = 1;
      let k = 0, zuGross = false;
      while (k < liste.length) {
        const p = liste[k++];
        if (liste.length > grenze) { zuGross = true; }
        const x = p % w, y = (p - x) / w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (komp[q] || data[q * ch + 3] === 0 || !isBg(q * ch)) continue;
          komp[q] = 1; liste.push(q);
        }
        if (zuGross && k > 4 * grenze) break; // sehr grosse Flaeche - Rest muss nicht gezaehlt werden
      }
      if (!zuGross && liste.length <= grenze) { for (const p of liste) data[p * ch + 3] = 0; cleared += liste.length; punzen++; }
    }
    if (punzen) console.log('cutout: ' + punzen + ' Punzen geleert');
  }

  console.log('cutout', w + 'x' + h, 'toene=' + seeds.length, 'frei=' + Math.round(cleared / (w * h) * 100) + '%');
  return sharp(Buffer.from(data), { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
}

// ---------- Fassung 22: Chroma-Freistellen statt Fluten vom Rand ----------
// Das cutout oben flutet vom Bildrand nach innen und stoppt am Motiv. Damit kommt es
// PRINZIPIELL nie in eine geschlossene Flaeche hinein - das Loch im O, A, B, R behaelt
// seinen Hintergrund. Ausserdem keyt es auf Weiss, und Weiss ist im Motiv eine Druckfarbe.
// freistellen() keyt stattdessen GLOBAL auf Chromagruen: jedes Pixel faellt weg, egal wo
// es liegt. Chromagruen hat Gruen 255, Waldgruen nur 51 - der Abstand traegt die Trennung.
export const CHROMA = { r: 0, g: 255, b: 0, hex: '#00FF00' };

// Wie deutlich ein Pixel "Chroma" ist: Gruen minus der staerkere der beiden anderen Kanaele.
const chromaWert = (d, i) => d[i + 1] - Math.max(d[i], d[i + 2]);

// Echter Alphakanal vorhanden UND benutzt? Ein Bild mit vier Kanaelen, die alle auf 255
// stehen, hat zwar Alpha, aber keine Transparenz - das ist kein Erfolg, sondern derselbe
// Fehler mit einem Kanal mehr.
export async function hatAlpha(pngBuffer) {
  try {
    const m = await sharp(pngBuffer).metadata();
    if (!m.hasAlpha) return false;
    const st = await sharp(pngBuffer).stats();
    const a = st.channels[st.channels.length - 1];
    return !!a && a.min < 250;
  } catch (e) { return false; }
}

// Sitzt das Motiv auf Chromagrund? Zum Entscheiden reicht eine kleine Fassung des Bildes.
export async function hatChromagrund(pngBuffer, schwelle = 90) {
  try {
    const { data, info } = await sharp(pngBuffer).resize({ width: 256, fit: 'inside' })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    let chroma = 0, gesamt = 0;
    for (let i = 0; i < data.length; i += ch) {
      if (data[i + 3] < 10) continue;
      gesamt++;
      if (chromaWert(data, i) > schwelle) chroma++;
    }
    return gesamt > 0 && chroma / gesamt > 0.05;
  } catch (e) { return false; }
}

// Global keyen, harte Maske, 1 Pixel Choke, Entstichen nur an der Kante.
// - harte Maske: keine halbe Deckung, sonst drucken weiche Kanten als Schleier mit
// - Choke: der Mischsaum aus Motivfarbe und Chroma fliegt raus - genau der Saum, der
//   sonst als heller Rand mitdruckt
// - Entstichen nur an der Kante: im Motiv wuerde es echte Gruentoene kippen
export async function freistellen(pngBuffer, opts = {}) {
  const schwelle = opts.schwelle === undefined ? 90 : opts.schwelle;
  const choke = opts.choke === undefined ? 1 : Math.max(0, Math.round(opts.choke));
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const n = w * h;

  // 1 = bleibt, 0 = faellt weg. Global, nicht vom Rand.
  const bleibt = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    bleibt[p] = (data[i + 3] >= 10 && chromaWert(data, i) <= schwelle) ? 1 : 0;
  }

  // Choke: wer an ein weggefallenes Pixel grenzt, faellt mit. Je Runde ein Pixel.
  for (let runde = 0; runde < choke; runde++) {
    const vorher = Uint8Array.from(bleibt);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!vorher[p]) continue;
        if ((x > 0 && !vorher[p - 1]) || (x < w - 1 && !vorher[p + 1]) ||
            (y > 0 && !vorher[p - w]) || (y < h - 1 && !vorher[p + w])) bleibt[p] = 0;
      }
    }
  }

  // Entstichen: nur Pixel direkt an der neuen Kante, und nur wenn Gruen dort ueberwiegt.
  let entstochen = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!bleibt[p]) continue;
      const amRand = (x > 0 && !bleibt[p - 1]) || (x < w - 1 && !bleibt[p + 1]) ||
                     (y > 0 && !bleibt[p - w]) || (y < h - 1 && !bleibt[p + w]);
      if (!amRand) continue;
      const i = p * ch, hoch = Math.max(data[i], data[i + 2]);
      if (data[i + 1] > hoch) { data[i + 1] = hoch; entstochen++; }
    }
  }

  // Harte Maske setzen - 0 oder 255, nie dazwischen.
  let frei = 0;
  for (let p = 0; p < n; p++) {
    if (bleibt[p]) { data[p * ch + 3] = 255; }
    else { const i = p * ch; data[i + 3] = 0; frei++; }
  }

  const png = await sharp(Buffer.from(data), { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
  const freiProzent = Math.round(frei / n * 1000) / 10;
  console.log('freistellen', w + 'x' + h, 'frei=' + freiProzent + '%', 'entstochen=' + entstochen);
  return { png, freiProzent, entstochen };
}

// Ist das Band fuer den Namen wirklich frei? nameZonePrompt bestellt 14 % der Hoehe als
// leere Flaeche - ob die Bild-KI sich daran haelt, ist eine andere Frage. Ungeprueft setzt
// renderName den Namen ueber gezeichnete Schrift, und dann ist beides unlesbar: genau so
// gemeldet (der Name lag auf einem gezeichneten Spruchband).
// Gemessen wird auf dem FREIGESTELLTEN Motiv - auf Chromagruen sagt der Alphakanal nichts.
export async function bandBelegt(pngBuffer, zone = 'unten', anteil = 0.14) {
  const m = await sharp(pngBuffer).metadata();
  const h = Math.max(1, Math.round(m.height * anteil));
  const top = zone === 'oben' ? 0 : m.height - h;
  const { data, info } = await sharp(pngBuffer).ensureAlpha()
    .extract({ left: 0, top, width: m.width, height: h })
    // kernel 'nearest': messen, nicht verschoenern - weiches Skalieren erfindet Kanten
    .resize({ width: 240, kernel: 'nearest' })
    .raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 40) n++;
  return n / (info.width * info.height);
}

// Torwaechter: misst die fertige Datei, statt ihr zu glauben. Im Browser sieht Weiss
// aus wie Transparenz - darum zaehlen hier nur die Zahlen.
// opts.vollflaechig: bei randlos bedruckten Artikeln (Fussmatte, Tasse, Strandtuch) ist ein
// dunkler Grund GEWOLLT - dort darf die Hintergrund-Messung nicht anschlagen.
export async function pruefeDruckdatei(pngBuffer, opts = {}) {
  const befund = { druckfaehig: false, gruende: [] };
  try {
    const m = await sharp(pngBuffer).metadata();
    befund.breite = m.width; befund.hoehe = m.height; befund.kanaele = m.channels;
    befund.alpha = !!m.hasAlpha;
    // Nur zum Messen verkleinern, und dabei NICHT rechnen lassen: eine glaettende
    // Verkleinerung erfindet Zwischenwerte im Alphakanal und meldet weiche Kanten,
    // die es in der Datei gar nicht gibt. 'nearest' greift echte Pixel heraus.
    const { data, info } = await sharp(pngBuffer).resize({ width: 512, fit: 'inside', kernel: 'nearest' })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels, n = info.width * info.height;
    let frei = 0, weich = 0, chromaRest = 0, sichtbar = 0, alphaMin = 255, dunkel = 0;
    const dunkelMaske = Buffer.alloc(n);
    for (let p = 0; p < n; p++) {
      const i = p * ch, a = data[i + 3];
      if (a < alphaMin) alphaMin = a;
      if (a < 10) { frei++; continue; }
      if (a < 245) weich++;
      sichtbar++;
      if (chromaWert(data, i) > 90) chromaRest++;
      // Fassung 73: Wie viel von dem, was GEDRUCKT wird, ist so dunkel, dass es auf einem
      // schwarzen Shirt ohnehin verschwindet? Genau das war der Befund vom 17. September:
      // bis zu 78 Prozent der deckenden Flaeche fast schwarz - Tinte, die niemand sieht,
      // aber jeder bezahlt, und auf hellem Textil ein schwarzer Klotz. Schwelle 70 statt der
      // 32 aus schwarzflaechenFreistellen: ein dunkelblauer Nebel bei Kanalwert 33 bis 70
      // faellt sonst komplett durch die Messung.
      if (Math.max(data[i], data[i + 1], data[i + 2]) <= 70) { dunkel++; dunkelMaske[p] = 1; }
    }
    // Der Anteil allein trennt nicht, die groesste zusammenhaengende Flaeche auch nicht:
    // gemessen an den drei Dateien vom 17. September fiel die schwarze Scheibe des
    // Rheinfunken-Designs durch (das Motiv zerschneidet sie in Teile), und ein legitimes
    // vollflaechiges Strandtuch-Motiv schlug falsch an.
    //
    // Was Hintergrund WIRKLICH von Kontur unterscheidet, ist die LAGE: ein Hintergrund haengt
    // mit dem freien Aussenbereich zusammen, eine Kontur im Motiv nicht. Also vom Bildrand
    // aus fluten, ueber durchsichtige UND dunkle Pixel - und zaehlen, wie viel DECKENDE
    // dunkle Flaeche dabei erreicht wird. Bei einem randlosen Motiv ohne freien Aussenbereich
    // kommt dabei null heraus, also kein Fehlalarm bei Fussmatte, Tasse oder Strandtuch.
    let randDunkel = 0;
    if (dunkel > 0) {
      const W = info.width, H = info.height, hg = new Uint8Array(n), stapel = new Int32Array(n);
      let oben = 0;
      const istHg = (q) => data[q * ch + 3] < 128 || dunkelMaske[q] === 1;
      const rein = (q) => { if (!hg[q] && istHg(q)) { hg[q] = 1; stapel[oben++] = q; } };
      for (let x = 0; x < W; x++) { rein(x); rein((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { rein(y * W); rein(y * W + W - 1); }
      while (oben > 0) {
        const q = stapel[--oben], x = q % W, y = (q / W) | 0;
        if (x > 0) rein(q - 1);
        if (x < W - 1) rein(q + 1);
        if (y > 0) rein(q - W);
        if (y < H - 1) rein(q + W);
      }
      for (let q = 0; q < n; q++) if (hg[q] && data[q * ch + 3] >= 128) randDunkel++;
    }
    befund.alphaMin = alphaMin;
    befund.freiProzent = Math.round(frei / n * 1000) / 10;
    befund.weicheKantenProzent = Math.round(weich / n * 1000) / 10;
    // 25. Sept.: Deckung. weicheKantenProzent gibt es laenger, aber es misst am gesamten
    // Blatt - bei einem kleinen Motiv auf grosser Leinwand sagt die Zahl nichts. Diese hier
    // misst am SICHTBAREN Motiv und trennt damit die weiche Kante (ein paar Prozent, normal)
    // von einem halbdurchsichtig gemalten Motiv (zig Prozent, kaputt).
    //
    // Der Anlass: an einer Prompt-Fassung, die "lass die Flaeche LEER" bestellte, hat das
    // Modell die Flaechen nicht weggelassen, sondern HALBDURCHSICHTIG gemalt - bei einem Lauf
    // 53 % des Motivs. In der Vorschau auf schwarzem Grund sah das satt aus, weil der dunkle
    // Grund durchschien; im DTF-Druck kommt so etwas milchig und fleckig. Gesunde Dateien
    // liegen bei 94 bis 99 % Deckung, die kaputten bei 47 bis 84.
    befund.deckungProzent = sichtbar ? Math.round((sichtbar - weich) / sichtbar * 1000) / 10 : 0;
    befund.chromaRestProzent = sichtbar ? Math.round(chromaRest / sichtbar * 1000) / 10 : 0;
    // Anteil an der DECKENDEN Flaeche, nicht an der Leinwand - sonst sagt die Zahl bei einem
    // kleinen Motiv auf grosser Leinwand nichts aus.
    befund.dunkelProzent = sichtbar ? Math.round(dunkel / sichtbar * 1000) / 10 : 0;
    befund.dunkelGrundProzent = sichtbar ? Math.round(randDunkel / sichtbar * 1000) / 10 : 0;

    if (!befund.alpha || alphaMin >= 250) befund.gruende.push('kein freigestellter Hintergrund - die Datei druckt als Kasten');
    if (befund.freiProzent < 3) befund.gruende.push('fast nichts ist frei (' + befund.freiProzent + ' %)');
    // Schwelle bewusst sehr hoch: ein Design aus duennen Buchstaben auf grosser Leinwand
    // ist legitim zu 98 % frei. Bei 97 % schlug der Waechter genau dort falsch an.
    if (befund.freiProzent > 99.5) befund.gruende.push('praktisch alles ist frei (' + befund.freiProzent + ' %) - das Motiv fehlt');
    if (befund.chromaRestProzent > 0.2) befund.gruende.push('Chromagrün steht noch im Motiv (' + befund.chromaRestProzent + ' %)');
    // Schwelle 75 statt 90: ein Aquarell oder ein Farbverlauf DARF weiche Uebergaenge haben,
    // gemessen bis etwa 84 % bei gewollt weichen Motiven. Erst darunter ist es kein Stil mehr,
    // sondern eine Datei, die im Druck milchig wird.
    if (befund.deckungProzent && befund.deckungProzent < 75) befund.gruende.push('das Motiv ist grossteils halbdurchsichtig gemalt (nur ' + befund.deckungProzent + ' % volle Deckung) - das druckt milchig');
    befund.druckfaehig = befund.gruende.length === 0;
    // Bewusst KEIN Grund, der die Datei durchfallen laesst - erst wird gemessen, dann
    // entschieden. dunkelGrundProzent ist die Zahl, auf die es ankommt: dunkle Flaeche, die
    // vom freien Aussenbereich aus erreichbar ist, also gemalter Hintergrund. Schon 2 Prozent
    // sind auffaellig - eine Kontur haengt nie so weit am Rand.
    befund.dunkelAuffaellig = !opts.vollflaechig && befund.dunkelGrundProzent > 2;
  } catch (e) {
    befund.gruende.push('Datei nicht lesbar: ' + (e && e.message ? e.message : e));
  }
  return befund;
}

// ---------- Druckdatei: freistellen, Logo exakt setzen, auf reale Druckgroesse bringen ----------
// WICHTIG: Die Druckdatei ist maximal 36 cm breit und 46 cm hoch und wird in ECHTER Groesse
// abgelegt - d. h. die Pixelmasse entsprechen bei 300 dpi genau diesen Zentimetern und die
// DPI (pHYs) sind eingebettet. Ohne eingebettete DPI interpretiert ein RIP die Datei sonst als
// 72 dpi und macht daraus mehrere Meter. Seitenverhaeltnis bleibt erhalten (fit: inside).
export const PRINT_DPI = 300;
export const PRINT_MAX_CM = { w: 36, h: 46 };
const cmToPx = (cm, dpi = PRINT_DPI) => Math.round((cm / 2.54) * dpi);
export const PRINT_MAX_PX = { w: cmToPx(PRINT_MAX_CM.w), h: cmToPx(PRINT_MAX_CM.h) }; // 4252 x 5433 @300dpi

// Drei Stufen, in dieser Reihenfolge - die beste Kante ist die, die nie gekeyt wurde:
//   1. Das Modell liefert einen echten Alphakanal  -> gar nicht anfassen
//   2. Das Motiv sitzt auf Chromagruen             -> global freistellen
//   3. Weder noch                                  -> der alte Notnagel cutout
// opts.erwarte === 'alpha' schreibt eine deutliche Warnung ins Log, wenn Stufe 1 ausbleibt.
// Genau daran hat es gefehlt: ein stiller Rueckfall faellt monatelang nicht auf.
// Nur das Freistellen (die drei Stufen von oben), als eigener Schritt aufrufbar. Grund:
// das Motiv OHNE Logo muss aufbewahrt werden koennen. Steckt das Logo einmal in der
// Druckdatei, laesst es sich nie mehr verschieben - man muesste neu zeichnen lassen.
export async function motivFreistellen(pngBuffer, erwarte) {
  let png, weg;
  if (await hatAlpha(pngBuffer)) {
    // Fassung 23: der Alphakanal vom Modell ist echt, aber WEICH - um jedes Element ein breiter
    // halbdurchsichtiger Hof. Auf DTF ein milchiger Rand, in jeder Vorschau ein randfuellender
    // Kasten. Deshalb wird er hier gehaertet statt nur durchgereicht.
    // 6. Okt., Markus: "Das nachtraegliche Kanten schaerfen und hochrechnen muss natuerlich drin bleiben. Es geht nur um das
    // Freistellen." - Haerten der vom Bilddienst gelieferten Kante ist kein Freistellen und bleibt.
    const geschaerft = await alphaSchaerfen(pngBuffer, {});
    png = geschaerft.buffer; weg = 'alpha';
    if (geschaerft.weichVorher > 1) console.log('makeMaster: Alphakanal gehaertet, weiche Kanten ' + geschaerft.weichVorher + '% -> ' + geschaerft.weichNachher + '%');
  }
  // 6. Okt., Markus: "finde heraus, warum ueberhaupt irgendwas freigestellt werden muss. Das ist verboten worden, da wir in der
  // Lage sind, immer transparente Dateien herzustellen." Freigestellte Designs (auf Grund gemalt, dann ausgeschnitten) haben
  // gefuellte Buchstaben-Innenraeume und Reste vom Grund - live das Meister-Shirt FAJB. Kommt kein Alphakanal an, ist das ein
  // FEHLER und kein Anlass zum Ausschneiden. Nur der ausdrueckliche Testmodus 'chroma' (Backend) stellt noch frei.
  // Der fruehere Testmodus 'chroma' (Gruen malen, hier ausschneiden) ist ebenfalls aus - es gibt nur noch den Alphakanal.
  else {
    console.error('FREISTELLEN VERBOTEN: Bild kam ohne Alphakanal - es wird nicht ausgeschnitten.');
    throw new Error('Bild ohne Transparenz - Freistellen ist verboten');
  }
  console.log('makeMaster Weg:', weg);
  return { png, weg };
}

// Fassung 64 (Markus, 16. Sept.: "Warum sind die Raender so ausgefranst?"): Die Kante wird in
// Generatorgroesse (etwa 1000 px) hart gemacht und dann um den Faktor 4 auf Druckgroesse
// hochgerechnet - jede Pixeltreppe der kleinen Maske wird dabei zu einer vier Pixel breiten
// Zacke. Darum wird der Alphakanal NACH dem Hochrechnen noch einmal geglaettet: weichzeichnen
// (mittelt die Treppen zu einer runden Linie) und die Rampe wieder steil ziehen (kein Schleier,
// nur etwa zwei Pixel Kantenglaettung). Das Ergebnis ist eine glatte Kontur wie aus einer Vektorgrafik.
export async function kanteGlaetten(pngBuffer, opts = {}) {
  const sigma = opts.sigma ?? 3.5, gain = opts.gain ?? 4;
  const m = await sharp(pngBuffer).metadata();
  if (!m.hasAlpha) return pngBuffer;
  const W = m.width, H = m.height;
  // 21. Sept. (Markus, Robotic: "Katastrophe an den Raendern"): nachgemessen - die Kante war nach
  // diesem Schritt BREITER (Rampe 7 -> 15 px, 1,5 mm im Druck), nicht schmaler. Grund: in EINER
  // sharp-Kette auf dem RGBA-Bild wirkt linear() nur auf die Farbkanaele, nie auf Alpha; das
  // Weichzeichnen traf Alpha, das Steilziehen nicht - uebrig blieb ein reiner Weichzeichner.
  // Deshalb wird der Alphakanal erst herausgeloest und dann als eigenes Graubild weichgezeichnet
  // UND steil gezogen. Ergebnis: Rampe 2 bis 3 px (siehe Abnahme).
  const alphaRoh = await sharp(pngBuffer).extractChannel(3).raw().toBuffer();
  const alpha = await sharp(alphaRoh, { raw: { width: W, height: H, channels: 1 } }).toColourspace('b-w').blur(sigma).linear(gain, 128 * (1 - gain)).raw().toBuffer();
  if (alpha.length !== W * H) throw new Error('kanteGlaetten: Alphakanal hat ' + alpha.length + ' statt ' + (W * H) + ' Werte');
  const rgb = await sharp(pngBuffer).removeAlpha().raw().toBuffer();
  return sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
}

export async function makeMaster(pngBuffer, opts) {
  const o = opts || {};
  // schonFrei: das Motiv ist bereits freigestellt (weil es fuers spaetere Verschieben
  // aufbewahrt wurde). Dann nicht noch einmal - und keine irrefuehrende zweite Log-Zeile.
  let buf = o.schonFrei ? pngBuffer : (await motivFreistellen(pngBuffer, o.erwarte)).png;

  // Fassung 27: grosse schwarze Flaechen raus, Konturen bleiben - NUR auf Ansage. Auf hellem
  // Textil und bei vollflaechigen Artikeln ist Schwarz eine echte Farbe, dort waere es falsch.
  // Vor dem Logo: dessen dunkle Aussenlinie soll stehen bleiben.
  if (o.schwarzRaus) {
    const sw = await schwarzflaechenFreistellen(buf, o.schwarz || {});
    if (sw.entferntProzent > 0.1) console.log('makeMaster: schwarze Flaechen entfernt, ' + sw.entferntProzent + ' % der Leinwand');
    buf = sw.buffer;
  }

  // Fassung 30: ERST auf Druckgroesse, DANN das Logo. Bisher wurde das Logo in das Zwischenbild
  // in Generatorgroesse (etwa 1000 bis 1500 px) gesetzt und danach mit dem ganzen Motiv auf
  // 4252 x 5433 hochgerechnet - Faktor 3 bis 4. Das Logo kommt aber als scharfe Datei mit bis
  // zu 2400 px: Markus sah in der Druckdatei "Pixel rund um das Logo", Kontur und Schatten des
  // Logoblocks waren weichgerechnete Zwischenbildpixel. Jetzt wird das Motiv allein skaliert
  // und das Logo in voller Aufloesung auf die fertige Leinwand gesetzt.
  // Fassung 24: Freestyle-Artikel haben ihre eigene Leinwand (aus artikelLeinwand). Die Pixel
  // bleiben, wie sie sind - nur die dpi der Flaeche werden eingebettet. Auf 36x46 cm skalieren
  // waere fuer eine 40x60-Matte oder ein 30x20-Brett schlicht das falsche Mass.
  // Fassung 73: Der eingebettete dpi-Wert BESTIMMT das Druckmass - er muss exakt sein.
  // Vorher stand hier Math.max(72, Math.round(dpi)). Beides ging schief: das Runden machte aus
  // 69,64 dpi eine 70, und die Untergrenze 72 machte daraus eine 72. Ein Strandtuch mit
  // 1936 x 3840 px behauptete damit 68,3 x 135,5 cm statt der bestellten 70,6 x 140,6 cm -
  // zwei Zentimeter zu schmal und fuenf zu kurz.
  //
  // Nachgemessen am Abend: es reicht NICHT, den exakten Wert einzutragen. Ein PNG speichert
  // Pixel pro Meter, und sharp rundet die dpi-Angabe beim Schreiben auf eine ganze Zahl - aus
  // 69,37 wird 69, und damit steht in der Datei 71,3 statt 70,6 cm. Also andersherum: die
  // dpi-Zahl wird ganzzahlig gewaehlt UND die Datei auf genau die Pixelzahl gebracht, die bei
  // dieser dpi das bestellte Mass ergibt. Dann stimmt das Mass auf den Millimeter, und der
  // Beschnitt dafuer liegt unter einem Prozent - bei randlos bedruckter Ware ohnehin vorgesehen.
  const dpi = o.leinwand ? Math.max(1, Math.round(o.leinwand.dpiExakt || o.leinwand.dpi)) : PRINT_DPI;
  if (o.leinwand && Array.isArray(o.leinwand.cm) && o.leinwand.cm.length === 2) {
    const zielB = Math.round(o.leinwand.cm[0] / 2.54 * dpi);
    const zielH = Math.round(o.leinwand.cm[1] / 2.54 * dpi);
    try {
      const jetzt = await sharp(buf).metadata();
      if (jetzt.width !== zielB || jetzt.height !== zielH) {
        buf = await sharp(buf).resize({ width: zielB, height: zielH, fit: 'cover', position: 'centre', kernel: 'lanczos3' }).png().toBuffer();
        console.log(`makeMaster: auf ${zielB}x${zielH} px gebracht - das sind bei ${dpi} dpi genau ${o.leinwand.cm[0]}x${o.leinwand.cm[1]} cm (vorher ${jetzt.width}x${jetzt.height})`);
      }
    } catch (e) { console.error('Mass exakt setzen:', e && e.message ? e.message : e); }
  }
  // Fassung 72 (Markus, 17. Sept.: "unten bei Customer Show Case die Raender teilweise
  // abgeschnitten"): Der Prompt bestellt 6 Prozent Rand, aber das Modell malt Banderolen und
  // Schwuenge trotzdem bis an die Kante - und dort sind sie ab. Also nachmessen und, wenn das
  // Motiv den Rand beruehrt, das GANZE Motiv so weit verkleinern, dass ringsum Luft bleibt.
  // Verkleinern ist verlustfrei genug (wir rechnen ohnehin hoch) und rettet das Design, statt es
  // zu verwerfen. Bei randlosen Artikeln (eigene Leinwand) gilt das nicht - dort ist der Rand gewollt.
  if (!(o.leinwand && o.leinwand.dpi) && o.randLuft !== false) {
    try {
      const luft = Math.min(0.08, Math.max(0.01, +o.randLuft || 0.03));
      const m0 = await sharp(buf).metadata();
      const ec = await edgeCheck(buf);
      const beruehrt = Math.max(ec.top, ec.bottom, ec.left, ec.right);
      if (beruehrt > 0.005) {
        const innen = 1 - 2 * luft;
        const kleiner = await sharp(buf).resize({ width: Math.round(m0.width * innen), height: Math.round(m0.height * innen), fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
        const km = await sharp(kleiner).metadata();
        buf = await sharp({ create: { width: m0.width, height: m0.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: kleiner, left: Math.round((m0.width - km.width) / 2), top: Math.round((m0.height - km.height) / 2) }]).png().toBuffer();
        console.log('makeMaster: Motiv beruehrte den Rand (' + Math.round(beruehrt * 100) + ' %) - auf ' + Math.round(innen * 100) + ' % verkleinert, Rand jetzt frei');
      }
    } catch (e) { console.error('Randluft:', e && e.message ? e.message : e); }
  }
  const vorher = await sharp(buf).metadata();
  if (!(o.leinwand && o.leinwand.dpi)) {
    buf = await sharp(buf).resize({ width: PRINT_MAX_PX.w, height: PRINT_MAX_PX.h, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
    // Fassung 64: nach dem Hochrechnen die Aussenkontur glaetten - die harte Maske aus der
    // Generatorgroesse wird sonst als Treppe mitvergroessert (Markus: "Raender ausgefranst").
    // 6. Okt., Markus: Kanten schaerfen und hochrechnen bleiben - verboten ist nur das Freistellen.
    try { buf = await kanteGlaetten(buf); }
    catch (e) { console.error('Kante glaetten:', e && e.message ? e.message : e); }
  }

  if (o.logo) {
    // Feinjustierung in Zentimetern - die Leinwand ist jetzt schon in echter Druckgroesse,
    // ein Zentimeter ist also genau dpi/2,54 Pixel.
    const fein = o.fein || {};
    const pxProCm = dpi / 2.54;
    const dx = (+fein.dxCm || 0) * pxProCm;
    const dy = (+fein.dyCm || 0) * pxProCm;
    // Fassung 37: kam das Logo als Vorlage ins Modell, steht die Fundstelle fest (logoTreffer,
    // in Pixeln des Motivs VOR dem Skalieren) - mitskalieren, keine Lochsuche mehr.
    let treffer = null;
    if (o.logoTreffer && o.logoTreffer.breite > 0) {
      const nach = await sharp(buf).metadata();
      const fak = nach.width / vorher.width;
      treffer = { cx: o.logoTreffer.cx * fak, cy: o.logoTreffer.cy * fak, breite: o.logoTreffer.breite * fak };
    }
    buf = await placeLogo(buf, await logoTrimmen(await freeLogo(o.logo)), o.place, o.widthPct, { dx, dy, groesse: fein.groesse, treffer }, o.bericht);
  }
  return sharp(buf).withMetadata({ density: dpi }).png({ compressionLevel: 9 }).toBuffer();
}

// Co-Branding: zwei Logos nebeneinander zu einem Logo-Block verbinden (gleiche Hoehe, Luecke dazwischen).
// Der Block wird danach wie ein einzelnes Logo in die freie Zone gesetzt (placeLogo).
export async function combineLogos(logoA, logoB, gapPct = 12) {
  const a = await freeLogo(logoA), b = await freeLogo(logoB);
  const H = 800;
  const fit = async (buf) => sharp(buf).trim().resize({ height: H, fit: 'inside' }).png().toBuffer();
  const [pa, pb] = [await fit(a), await fit(b)];
  const [ma, mb] = [await sharp(pa).metadata(), await sharp(pb).metadata()];
  const gap = Math.round(H * gapPct / 100);
  const W = ma.width + gap + mb.width;
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: pa, left: 0, top: Math.round((H - ma.height) / 2) }, { input: pb, left: ma.width + gap, top: Math.round((H - mb.height) / 2) }])
    .png().toBuffer();
}

// ---------- 6. Okt.: Kundenlogos selbstaendig sauber freistellen ----------
// Markus: "Weiter ausschneiden bei den Kunden-Logos. Dort muessen wir so gut werden, dass alle Logos, die wir bekommen,
// selbstaendig so hinbekommen, dass es gut aussieht." Pruefstand mit 14 typischen Kundenlogos: cutout() frass ein Logo,
// das den Rand beruehrt (die Logofarbe wurde zum Hintergrund), stanzte weisse Schrift aus farbigen Kreisen, liess das
// Weiss in grossen O und B stehen, zerstoerte Rahmen-Logos und hinterliess bei JPGs einen hellen Saum und Kruemel.
// Neu, in vier Regeln:
//   1. Der Hintergrund ist die HAEUFIGSTE Farbe am Bildrand (gezaehlt, nicht die ersten Randpixel). Karomuster
//      (falsche Transparenz) = zwei helle Grautoene. Ist der Rand nicht einfarbig genug, wird nicht geraten.
//   2. Eingeschlossene Flaechen in Hintergrundfarbe werden nur durchsichtig, wenn sie LEER sind und in einem
//      DUENNEN Strich sitzen (Loch im O, e, B). Weiss mit Inhalt (Kino-Flaeche mit Schrift) und Weiss in einer grossen
//      Flaeche (weisse Schrift, weisser Stern im roten Kreis) ist gewollt und bleibt.
//   3. Weiche Kante: Mischpixel am Rand bekommen echte Teiltransparenz in der Farbe des Logos - kein heller Saum.
//   4. Kruemel (vereinzelte JPG-Pixel) fliegen raus.
export async function logoFreistellen(pngBuffer, opts = {}) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, N = w * h;
  // 1. Hintergrund am Rand zaehlen (Farben auf 16er-Stufen gerundet)
  const zaehl = new Map(); let rand = 0;
  const randPx = (x, y) => { const i = (y * w + x) * 4; if (data[i + 3] < 128) return; rand++; const k = (data[i] >> 4) + ',' + (data[i + 1] >> 4) + ',' + (data[i + 2] >> 4); zaehl.set(k, (zaehl.get(k) || 0) + 1); };
  for (let x = 0; x < w; x++) { randPx(x, 0); randPx(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { randPx(0, y); randPx(w - 1, y); }
  if (!rand) return { png: pngBuffer, sicher: false, grund: 'Rand ist schon durchsichtig' };
  const sortiert = [...zaehl.entries()].sort((a, b) => b[1] - a[1]);
  const mittel = (key) => { const [r, g, b] = key.split(',').map(Number); let sr = 0, sg = 0, sb = 0, n = 0;
    const nimm = (x, y) => { const i = (y * w + x) * 4; if (data[i + 3] < 128) return; if ((data[i] >> 4) === r && (data[i + 1] >> 4) === g && (data[i + 2] >> 4) === b) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++; } };
    for (let x = 0; x < w; x++) { nimm(x, 0); nimm(x, h - 1); } for (let y = 1; y < h - 1; y++) { nimm(0, y); nimm(w - 1, y); }
    return [sr / n, sg / n, sb / n]; };
  const gruende = [mittel(sortiert[0][0])];
  // Nachbarstufen gehoeren zum selben Grund (JPG-Rauschen): Anteil ueber alle Randpixel nahe der Hauptfarbe
  const nah = (i, c, t) => Math.abs(data[i] - c[0]) <= t && Math.abs(data[i + 1] - c[1]) <= t && Math.abs(data[i + 2] - c[2]) <= t;
  let anteil = 0; { let n = 0; for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const i = (y * w + x) * 4; if (data[i + 3] >= 128 && nah(i, gruende[0], 24)) n++; } for (let y = 1; y < h - 1; y++) for (const x of [0, w - 1]) { const i = (y * w + x) * 4; if (data[i + 3] >= 128 && nah(i, gruende[0], 24)) n++; } anteil = n / rand; }
  // Karomuster: zweite helle, graue Stufe mit grossem Anteil
  if (sortiert[1]) { const c2 = mittel(sortiert[1][0]); const grau = (c) => Math.max(...c) - Math.min(...c) < 18 && Math.min(...c) > 150;
    if (grau(gruende[0]) && grau(c2) && sortiert[1][1] / rand > 0.2 && Math.abs(c2[0] - gruende[0][0]) > 12) { gruende.push(c2); anteil += sortiert[1][1] / rand; } }
  if (anteil < 0.45) return { png: pngBuffer, sicher: false, grund: 'Hintergrund nicht einfarbig (' + Math.round(anteil * 100) + ' % am Rand)' };
  const T = 30;
  const istGrund = (p) => { const i = p * 4; if (data[i + 3] < 128) return true; for (const c of gruende) if (nah(i, c, T)) return true; return false; };
  const abstand = (p) => { const i = p * 4; let best = 1e9; for (const c of gruende) { const d = Math.max(Math.abs(data[i] - c[0]), Math.abs(data[i + 1] - c[1]), Math.abs(data[i + 2] - c[2])); if (d < best) best = d; } return best; };
  // Aussen-Grund vom Rand fluten
  const weg = new Uint8Array(N); const q = new Int32Array(N); let qh = 0, qt = 0;
  const rein = (p) => { if (!weg[p] && istGrund(p)) { weg[p] = 1; q[qt++] = p; } };
  for (let x = 0; x < w; x++) { rein(x); rein((h - 1) * w + x); } for (let y = 0; y < h; y++) { rein(y * w); rein(y * w + w - 1); }
  while (qh < qt) { const p = q[qh++], x = p % w; if (x > 0) rein(p - 1); if (x < w - 1) rein(p + 1); if (p >= w) rein(p - w); if (p < N - w) rein(p + w); }
  // Motiv-Komponenten (alles, was kein Grund ist) mit Dicke (Schachbrett-Abstandskarte)
  const motiv = new Uint8Array(N); for (let p = 0; p < N; p++) motiv[p] = istGrund(p) ? 0 : 1;
  const dt = new Float32Array(N);
  for (let p = 0; p < N; p++) dt[p] = motiv[p] ? 1e6 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (!motiv[p]) continue; let m = dt[p]; if (x > 0) m = Math.min(m, dt[p - 1] + 1); if (y > 0) m = Math.min(m, dt[p - w] + 1); if (x > 0 && y > 0) m = Math.min(m, dt[p - w - 1] + 1); if (x < w - 1 && y > 0) m = Math.min(m, dt[p - w + 1] + 1); if (x === 0 || y === 0 || x === w - 1 || y === h - 1) m = Math.min(m, 1); dt[p] = m; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const p = y * w + x; if (!motiv[p]) continue; let m = dt[p]; if (x < w - 1) m = Math.min(m, dt[p + 1] + 1); if (y < h - 1) m = Math.min(m, dt[p + w] + 1); if (x < w - 1 && y < h - 1) m = Math.min(m, dt[p + w + 1] + 1); if (x > 0 && y < h - 1) m = Math.min(m, dt[p + w - 1] + 1); dt[p] = m; }
  const lab = new Int32Array(N).fill(-1); const komp = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (!motiv[s0] || lab[s0] >= 0) continue;
    const k = komp.length; const st = { x0: w, y0: h, x1: 0, y1: 0, dick: 0, n: 0 }; komp.push(st);
    lab[s0] = k; qh = 0; qt = 0; q[qt++] = s0;
    while (qh < qt) { const p = q[qh++], x = p % w, y = (p - x) / w; st.n++; if (x < st.x0) st.x0 = x; if (x > st.x1) st.x1 = x; if (y < st.y0) st.y0 = y; if (y > st.y1) st.y1 = y; if (dt[p] > st.dick) st.dick = dt[p];
      for (const r of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (r >= 0 && r < N && motiv[r] && lab[r] < 0) { lab[r] = k; q[qt++] = r; } }
  }
  // 2. Eingeschlossene Flaechen in Grundfarbe: Loch (durchsichtig) oder gewollt (bleibt)?
  const loch = new Int32Array(N).fill(-1); let geleert = 0, behalten = 0; const unklar = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (weg[s0] || motiv[s0] || loch[s0] >= 0) continue;
    const pix = []; let x0 = w, y0 = h, x1 = 0, y1 = 0; const nachbar = new Map();
    loch[s0] = s0; qh = 0; qt = 0; q[qt++] = s0;
    while (qh < qt) { const p = q[qh++], x = p % w, y = (p - x) / w; pix.push(p); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const r of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) { if (r < 0 || r >= N) continue; if (motiv[r]) { nachbar.set(lab[r], (nachbar.get(lab[r]) || 0) + 1); continue; } if (!weg[r] && loch[r] < 0) { loch[r] = s0; q[qt++] = r; } } }
    // Inhalt: liegt innerhalb des Lochs Motiv, das nicht zu seinem Rand gehoert? (Fluten im Rahmen von aussen)
    const bw = x1 - x0 + 3, bh = y1 - y0 + 3; const drin = new Uint8Array(bw * bh); const zq = [];
    const inLoch = (bx, by) => { const x = bx + x0 - 1, y = by + y0 - 1; return x >= 0 && y >= 0 && x < w && y < h && loch[y * w + x] === s0; };
    for (let bx = 0; bx < bw; bx++) for (const by of [0, bh - 1]) if (!inLoch(bx, by)) { drin[by * bw + bx] = 1; zq.push(by * bw + bx); }
    for (let by = 0; by < bh; by++) for (const bx of [0, bw - 1]) if (!inLoch(bx, by) && !drin[by * bw + bx]) { drin[by * bw + bx] = 1; zq.push(by * bw + bx); }
    for (let i = 0; i < zq.length; i++) { const b = zq[i], bx = b % bw, by = (b - bx) / bw; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = bx + dx, ny = by + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue; const nb = ny * bw + nx; if (drin[nb] || inLoch(nx, ny)) continue; drin[nb] = 1; zq.push(nb); } }
    let inhalt = 0; for (let by = 1; by < bh - 1; by++) for (let bx = 1; bx < bw - 1; bx++) { if (drin[by * bw + bx] || inLoch(bx, by)) continue; const x = bx + x0 - 1, y = by + y0 - 1; if (motiv[y * w + x]) inhalt++; }
    // Duenner Strich: die umgebende Motivflaeche ist schmal im Verhaeltnis zu ihrer eigenen Groesse (Buchstabe, Rahmen),
    // nicht eine volle Flaeche (Kreis, Schild, Knopf).
    // Duenner Strich: vom Loch aus in 16 Richtungen bis zum Aussen-Grund messen. Beim O ist es rundherum eine
    // Strichbreite, beim Stern oder bei weisser Schrift im Kreis in den meisten Richtungen weit.
    let cx = 0, cy = 0; for (const p of pix) { cx += p % w; cy += (p - p % w) / w; } cx /= pix.length; cy /= pix.length;
    const laeufe = [];
    for (let k = 0; k < 16; k++) {
      const dx = Math.cos(k * Math.PI / 8), dy = Math.sin(k * Math.PI / 8);
      let x = cx, y = cy, raus = false, lauf = 0, fertig = false;
      for (let t = 0; t < w + h; t++) {
        const ix = Math.round(x), iy = Math.round(y);
        if (ix < 0 || iy < 0 || ix >= w || iy >= h) break;
        const r = iy * w + ix;
        if (!raus) { if (loch[r] !== s0) raus = true; }
        if (raus) { if (weg[r] && loch[r] !== s0) { fertig = true; break; } lauf++; }
        x += dx; y += dy;
      }
      laeufe.push(fertig ? lauf : 1e5);
    }
    laeufe.sort((a, b) => a - b);
    const lauf = laeufe[8], dEq = 2 * Math.sqrt(pix.length / Math.PI);
    const strich = lauf <= 1.8 * Math.max(dEq, 6);
    const verh = lauf / Math.max(dEq, 6), leer = inhalt < Math.max(4, pix.length * 0.002);
    if (process.env.LOGO_DEBUG) console.log('  Loch', pix.length, 'px bei', x0 + ',' + y0, 'inhalt', inhalt, 'lauf', lauf, 'dEq', Math.round(dEq), 'verh', verh.toFixed(2), 'strich', strich);
    // Unklar (zwischen eindeutigem Buchstabenloch und eindeutigem Ziermotiv in einer Flaeche): fettes kleines A, grosser
    // Stern in einem Quadrat. Die Geometrie allein kann das nicht trennen - ein Mensch sieht es sofort. Mit opts.frage
    // entscheidet die Bildpruefung, sonst die Geometrie.
    if (leer && opts.frage && pix.length >= 12 && verh >= 0.6 && verh <= 3.2) { unklar.push({ pix, strich }); continue; }
    if (leer && strich) { for (const p of pix) weg[p] = 1; geleert++; } else behalten++;
  }
  // Unklare Loecher: je eines magenta markiert der Bildpruefung zeigen (hoechstens 8, die groessten zuerst)
  let gefragt = 0;
  if (unklar.length) {
    unklar.sort((a, b) => b.pix.length - a.pix.length);
    const basis = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).flatten({ background: '#ffffff' }).raw().toBuffer();
    const antworten = await Promise.all(unklar.map(async (u, i) => {
      if (i >= 8) return null;
      try {
        const b = Buffer.from(basis); for (const p of u.pix) { b[p * 3] = 255; b[p * 3 + 1] = 0; b[p * 3 + 2] = 255; }
        const bild = await sharp(b, { raw: { width: w, height: h, channels: 3 } }).resize({ width: 768, height: 768, fit: 'inside' }).png().toBuffer();
        return await opts.frage(bild);
      } catch (e) { return null; }
    }));
    unklar.forEach((u, i) => {
      const a = antworten[i]; if (a) gefragt++;
      const istLoch = a === 'loch' ? true : a === 'weiss' ? false : u.strich;
      if (istLoch) { for (const p of u.pix) weg[p] = 1; geleert++; } else behalten++;
    });
  }
  // 3. Weiche Kante: Motivpixel neben weggenommenem Grund bekommen Teiltransparenz, Farbe vom Kern daneben
  const out = Buffer.from(data);
  for (let p = 0; p < N; p++) if (weg[p]) out[p * 4 + 3] = 0;
  let kante = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (weg[p]) continue;
    let grenzt = false; for (let dy = -2; dy <= 2 && !grenzt; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && weg[ny * w + nx]) { grenzt = true; break; } }
    if (!grenzt) continue;
    // Kernfarbe: das Pixel im Umkreis 3, das am weitesten vom Grund weg ist
    let fp = -1, fd = -1; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const r = ny * w + nx; if (weg[r]) continue; const d = abstand(r); if (d > fd) { fd = d; fp = r; } }
    if (fp < 0 || fd < 24) continue;
    const i = p * 4, f = fp * 4; let gb = gruende[0]; if (gruende[1] && abstand(p) !== Math.max(Math.abs(data[i] - gb[0]), Math.abs(data[i + 1] - gb[1]), Math.abs(data[i + 2] - gb[2]))) gb = gruende[1];
    const vx = data[f] - gb[0], vy = data[f + 1] - gb[1], vz = data[f + 2] - gb[2]; const vv = vx * vx + vy * vy + vz * vz; if (vv < 400) continue;
    const a = Math.max(0, Math.min(1, ((data[i] - gb[0]) * vx + (data[i + 1] - gb[1]) * vy + (data[i + 2] - gb[2]) * vz) / vv));
    if (a > 0.97) continue;
    out[i] = data[f]; out[i + 1] = data[f + 1]; out[i + 2] = data[f + 2]; out[i + 3] = Math.round(a * data[i + 3]); kante++;
  }
  // 4. Kruemel: kleine, freistehende Reste (unter 0,01 % der Flaeche, hoechstens 40 px)
  const gesehen = new Uint8Array(N); const grenzeK = Math.min(40, Math.max(3, Math.round(N * 0.0001))); let kruemel = 0;
  for (let s0 = 0; s0 < N; s0++) {
    if (gesehen[s0] || out[s0 * 4 + 3] < 20) continue;
    const pix = [s0]; gesehen[s0] = 1; let zuGross = false;
    for (let i = 0; i < pix.length; i++) { const p = pix[i], x = p % w; for (const r of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) { if (r < 0 || r >= N || gesehen[r] || out[r * 4 + 3] < 20) continue; gesehen[r] = 1; pix.push(r); } if (pix.length > grenzeK) { zuGross = true; } }
    if (!zuGross) { for (const p of pix) out[p * 4 + 3] = 0; kruemel++; }
  }
  console.log('logoFreistellen', w + 'x' + h, 'Grund ' + gruende.map(c => c.map(Math.round).join('/')).join(' + '), 'Rand-Anteil ' + Math.round(anteil * 100) + '%', 'Loecher geleert ' + geleert + ', behalten ' + behalten + (unklar.length ? ' (' + unklar.length + ' unklar, ' + gefragt + ' per Bildpruefung)' : ''), 'Kante ' + kante, 'Kruemel ' + kruemel);
  return { png: await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(), sicher: true, geleert, behalten };
}

// Logo ohne Transparenz (JPG, PNG mit weissem Kasten): Hintergrund vom Rand her freistellen
// Hat das Logo schon echte Transparenz? (mindestens 1 % wirklich durchsichtige Pixel - Fassung 35, siehe freeLogo)
export async function logoHatTransparenz(logoBuffer) {
  const m = await sharp(logoBuffer).metadata();
  if (!m.hasAlpha) return false;
  const { data, info } = await sharp(logoBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let frei = 0; for (let p = 3; p < data.length; p += 4) if (data[p] < 128) frei++;
  return frei / (info.width * info.height) >= 0.01;
}

export async function freeLogo(logoBuffer) {
  const m = await sharp(logoBuffer).metadata();
  if (m.hasAlpha) {
    // Fassung 35: "hat schon durchsichtige Stellen" wurde am MINIMUM des Alphakanals
    // festgemacht. Ein einziges halbdurchsichtiges Kantenpixel - jede aus SVG oder PDF
    // gerasterte Datei hat so eins, viele PNG-Exporte auch - reichte, und der weisse
    // Hintergrund blieb stehen: das Logo kam als weisser Kasten aufs Shirt (Markus,
    // 14. Sept., "Logo-Einbindung klappt 0,0"). Jetzt zaehlt der ANTEIL wirklich
    // durchsichtiger Pixel: unter einem Prozent ist das kein Freistellen, sondern Kantenrauschen.
    const { data, info } = await sharp(logoBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let frei = 0;
    for (let p = 3; p < data.length; p += 4) if (data[p] < 128) frei++;
    if (frei / (info.width * info.height) >= 0.01) return logoBuffer; // wirklich freigestellt
  }
  // 6. Okt.: logoFreistellen statt cutout (siehe dort). Ist der Grund nicht einfarbig, wird nicht geraten - dann bleibt der
  // alte Weg als Notnagel, und das Log sagt es (das Logo gehoert dann vor dem Druck angesehen).
  try {
    const r = await logoFreistellen(await sharp(logoBuffer).png().toBuffer());
    if (r.sicher) return r.png;
    console.warn('Logo freistellen: ' + r.grund + ' - Notnagel cutout, bitte vor dem Druck ansehen');
    return await cutout(await sharp(logoBuffer).png().toBuffer());
  } catch (e) { return logoBuffer; }
}

// Beruehrt das Motiv den Bildrand (abgeschnitten)? Anteil deckender Pixel in den Randstreifen.
// 8. Okt., Markus: "nicht zugekleistert ... nicht einfach nur ein grosser Fleck mit bisschen bunter Farbe". Wie voll ist ein
// freigestelltes Motiv IN seinem Umriss? zeilen = Anteil deckender Pixel zwischen dem linken und rechten Rand jeder Zeile (Luecken
// innen zaehlen, die Form aussen nicht), box = Anteil im umschliessenden Rechteck. Geeicht an 25 Kundendesigns (8. Okt.): luftige
// Motive 0,33-0,56, die "Flecken" (Landwirt, Opa-Welle, Prag, Motorrad-Wappen) 0,92-0,99. Ohne Alphakanal: null.
export async function fuelleMessen(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().resize({ width: 400, height: 400, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0, spanne = 0, leer = 0;
  for (let y = 0; y < H; y++) {
    let l = -1, r = -1, c = 0;
    for (let x = 0; x < W; x++) { if (data[(y * W + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; c++; } else leer++; }
    if (l >= 0) { n += c; spanne += r - l + 1; x0 = Math.min(x0, l); x1 = Math.max(x1, r); y0 = Math.min(y0, y); y1 = y; }
  }
  if (!n || leer < W * H * 0.02) return null;   // nichts gemalt oder gar keine Transparenz
  // Dasselbe spaltenweise: getrennte Teile UEBEREINANDER (Schrift oben, Motiv unten, Luft dazwischen) sieht nur diese Richtung.
  let spanneS = 0;
  for (let x = 0; x < W; x++) {
    let o = -1, u = -1;
    for (let y = 0; y < H; y++) if (data[(y * W + x) * 4 + 3] > 128) { if (o < 0) o = y; u = y; }
    if (o >= 0) spanneS += u - o + 1;
  }
  const zeilen = n / spanne, spalten = n / spanneS;
  return { zeilen, spalten, fuelle: (zeilen + spalten) / 2, box: n / ((x1 - x0 + 1) * (y1 - y0 + 1)) };
}
export async function edgeCheck(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().resize({ width: 256, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, band = 3;
  let top = 0, bottom = 0, left = 0, right = 0;
  for (let x = 0; x < w; x++) for (let y = 0; y < band; y++) {
    if (data[(y * w + x) * 4 + 3] > 60) top++;
    if (data[((h - 1 - y) * w + x) * 4 + 3] > 60) bottom++;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < band; x++) {
    if (data[(y * w + x) * 4 + 3] > 60) left++;
    if (data[(y * w + (w - 1 - x)) * 4 + 3] > 60) right++;
  }
  return { top: top / (w * band), bottom: bottom / (w * band), left: left / (h * band), right: right / (h * band) };
}

// ---------- Farben lesen (fuer Logo-Einbindung und Prompt) ----------
const NAMED = [
  ['red', 214, 40, 40], ['dark red', 140, 20, 30], ['orange', 240, 130, 40], ['yellow', 245, 215, 60], ['gold', 205, 165, 60],
  ['green', 60, 160, 70], ['dark green', 25, 90, 50], ['teal', 30, 130, 130], ['cyan', 60, 190, 220], ['blue', 40, 90, 200],
  ['navy', 20, 35, 90], ['purple', 120, 60, 160], ['pink', 235, 100, 160], ['brown', 120, 75, 45], ['cream', 240, 230, 200],
  ['white', 250, 250, 250], ['black', 15, 15, 15], ['grey', 130, 130, 130], ['silver', 195, 195, 200]
];
const NEUTRAL = ['white', 'black', 'grey', 'silver', 'cream'];

// Haeufigste Farben der deckenden Pixel, als Liste [{name, r, g, b, share}]
export async function dominantColors(pngBuffer, region) {
  let img = sharp(pngBuffer).ensureAlpha();
  if (region) img = img.extract(region);
  const { data, info } = await img.resize({ width: 160, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const counts = new Map(); let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    total++;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let best = null, bd = 1e9;
    for (const n of NAMED) { const d = (r - n[1]) ** 2 + (g - n[2]) ** 2 + (b - n[3]) ** 2; if (d < bd) { bd = d; best = n; } }
    const e = counts.get(best[0]) || { name: best[0], r: 0, g: 0, b: 0, n: 0 };
    e.r += r; e.g += g; e.b += b; e.n++; counts.set(best[0], e);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)
    .map(e => ({ name: e.name, r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n), share: total ? e.n / total : 0 }));
}

// Kurze englische Farbliste fuer den Prompt: bunte Farben zuerst, dann hoechstens ein Neutralton.
export async function describeColors(pngBuffer) {
  const cols = (await dominantColors(pngBuffer)).filter(c => c.share >= 0.04);
  const vivid = cols.filter(c => !NEUTRAL.includes(c.name)).slice(0, 3).map(c => c.name);
  if (vivid.length) return vivid.join(', ');
  return cols.filter(c => NEUTRAL.includes(c.name) && c.name !== 'white').slice(0, 1).map(c => c.name).join(', ');
}

// Fassung 10: Logo beschreiben - Farben UND Form, damit der Prompt die freie Flaeche passend anlegt
// und das Motiv das Logo umarmt (Strahlen, Lorbeer, Banner ...). shape: breit | hoch | rund | quadratisch
export async function describeLogo(pngBuffer) {
  const colors = await describeColors(pngBuffer).catch(() => '');
  let shape = 'quadratisch', aspect = 1;
  try {
    const clear = await freeLogo(pngBuffer);
    const trimmed = await sharp(clear).ensureAlpha().trim().png().toBuffer();
    const m = await sharp(trimmed).metadata();
    aspect = m.width / m.height;
    if (aspect > 1.7) shape = 'breit';
    else if (aspect < 0.6) shape = 'hoch';
    else {
      // rund, wenn alle vier Ecken der Bounding-Box durchsichtig sind
      const { data, info } = await sharp(trimmed).ensureAlpha().resize({ width: 64, height: 64, fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
      const w = info.width, h = info.height;
      const corner = (x0, y0) => { let n = 0, t = 0; for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) { t++; if (data[(y * w + x) * 4 + 3] > 60) n++; } return n / t; };
      const filled = [corner(0, 0), corner(w - 8, 0), corner(0, h - 8), corner(w - 8, h - 8)];
      if (filled.every(f => f < 0.15)) shape = 'rund';
    }
  } catch (e) { /* Form unbekannt */ }
  return { colors, shape, aspect: Math.round(aspect * 100) / 100 };
}

// Wenn die KI trotz Verbot einen Teller/eine Scheibe in die Mitte malt: einfarbige Flaeche
// um den Mittelpunkt herum entfernen, damit das Logo wirklich in ein Loch kommt.
export async function removePlate(artBuffer) {
  const { data, info } = await sharp(artBuffer).ensureAlpha().resize({ width: 512, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const at = (x, y) => (y * w + x) * 4;
  if (data[at(cx, cy) + 3] < 60) return { buffer: artBuffer, removed: false };
  const c0 = [data[at(cx, cy)], data[at(cx, cy) + 1], data[at(cx, cy) + 2]];
  const mask = new Uint8Array(w * h);
  const stack = [cx + cy * w]; mask[cx + cy * w] = 1;
  let n = 0, minx = cx, maxx = cx, miny = cy, maxy = cy;
  while (stack.length) {
    const p = stack.pop(); n++;
    const x = p % w, y = (p - x) / w;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = nx + ny * w; if (mask[q]) continue;
      const i = q * 4;
      if (data[i + 3] < 60) continue;
      if (Math.abs(data[i] - c0[0]) + Math.abs(data[i + 1] - c0[1]) + Math.abs(data[i + 2] - c0[2]) > 90) continue;
      mask[q] = 1; stack.push(q);
    }
  }
  const share = n / (w * h);
  const bw = maxx - minx + 1, bh = maxy - miny + 1;
  const compact = n / (bw * bh);
  // Teller: gross genug, kompakt, nicht der ganze Hintergrund
  if (share < 0.015 || share > 0.45 || compact < 0.55 || bw < w * 0.12) return { buffer: artBuffer, removed: false };

  const meta = await sharp(artBuffer).metadata();
  const m8 = Buffer.alloc(w * h); for (let i = 0; i < w * h; i++) m8[i] = mask[i] ? 255 : 0;
  // Maske leicht aufweiten, damit kein heller Rand stehen bleibt
  const grown = dilate(m8, w, h, 2, 255);
  const big = await sharp(grown, { raw: { width: w, height: h, channels: 1 } }).resize({ width: meta.width, height: meta.height, fit: 'fill', kernel: 'cubic' }).toColourspace('b-w').raw().toBuffer();
  const black = await sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: '#000' } }).raw().toBuffer();
  const cutter = await sharp(black, { raw: { width: meta.width, height: meta.height, channels: 3 } }).joinChannel(big, { raw: { width: meta.width, height: meta.height, channels: 1 } }).png().toBuffer();
  const out = await sharp(artBuffer).ensureAlpha().composite([{ input: cutter, blend: 'dest-out' }]).png().toBuffer();
  console.log('Teller entfernt', { share: +share.toFixed(3), compact: +compact.toFixed(2), color: c0 });
  return { buffer: out, removed: true };
}

const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

// Freie Flaeche im Motiv finden, in die das Logo soll.
// mitte: vom Bildmittelpunkt nach aussen bis zum ersten deckenden Pixel.
// oben/unten: leeres Band bis zur ersten Zeile mit Inhalt.
// Fassung 34: ratio (Logo-Hoehe / Logo-Breite) angeben, dann wird nicht mehr das Kreuz durch den
// Mittelpunkt gemessen, sondern das groesste LEERE Rechteck in Logo-Form. Die Kreuzmessung nahm
// die Breite auf der Mittelzeile und die Hoehe auf der Mittelspalte - bei einer ovalen oder
// unregelmaessigen Luecke liegt in den Ecken dieses Rechtecks aber Motiv, und das Logo deckte es
// zu (Screenshot Markus 14. Sept.: die Kopfzeile "Motto Otto" halb hinter dem Logo).
export async function findHole(artBuffer, place, ratio) {
  const { data, info } = await sharp(artBuffer).ensureAlpha().resize({ width: 384, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = 4;
  const solid = (x, y) => data[(y * w + x) * ch + 3] > 60;
  const rowHas = (y) => { let n = 0; for (let x = 0; x < w; x++) if (solid(x, y)) n++; return n > w * 0.01; };
  const rechteck = ratio > 0 ? rechteckMesser(data, w, h, ratio) : null;

  if (place === 'oben' || place === 'unten') {
    // Fassung 10: Das Motiv darf die Logo-Flaeche umarmen (Strahlen, Lorbeer, Banner). Dann ist oben kein leeres
    // Band mehr, sondern eine umschlossene Luecke - die messen wir zuerst; nur wenn sie zu klein ist, gilt das Band.
    const py = place === 'oben' ? Math.round(h * 0.13) : Math.round(h * 0.87);
    const px = Math.floor(w / 2);
    if (!solid(px, py)) {
      const hole = measure(px, py);
      if (hole.w >= 0.22 && hole.h >= 0.08 && hole.w < 0.98) return rechteck ? rechteck(px, py, hole) : hole;
    }
    let y0 = -1;
    if (place === 'oben') { for (let y = 0; y < h; y++) if (rowHas(y)) { y0 = y; break; } }
    else { for (let y = h - 1; y >= 0; y--) if (rowHas(y)) { y0 = y; break; } }
    if (y0 < 0) return null;
    const band = place === 'oben' ? y0 : (h - 1 - y0);
    return { kind: 'band', band: band / h };
  }

  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  if (solid(cx, cy)) {
    // Mittelpunkt ist belegt (z. B. Teller): nach einer freien Stelle in der Naehe suchen
    let found = null;
    for (let r = 2; r < h / 4 && !found; r += 2) for (const [dx, dy] of [[0, -r], [0, r], [-r, 0], [r, 0]]) {
      const x = cx + dx, y = cy + dy; if (x >= 0 && x < w && y >= 0 && y < h && !solid(x, y)) { found = [x, y]; break; }
    }
    if (!found) return null;
    const hole = measure(found[0], found[1]);
    return rechteck ? rechteck(found[0], found[1], hole) : hole;
  }
  const hole = measure(cx, cy);
  return rechteck ? rechteck(cx, cy, hole) : hole;

  function measure(x0, y0) {
    let l = x0; while (l > 0 && !solid(l - 1, y0)) l--;
    let r = x0; while (r < w - 1 && !solid(r + 1, y0)) r++;
    let t = y0; while (t > 0 && !solid(x0, t - 1)) t--;
    let b = y0; while (b < h - 1 && !solid(x0, b + 1)) b++;
    return { kind: 'hole', cx: (l + r) / 2 / w, cy: (t + b) / 2 / h, w: (r - l + 1) / w, h: (b - t + 1) / h };
  }
}

// Groesstes leeres Rechteck mit festem Seitenverhaeltnis (ratio = Hoehe/Breite) rund um einen
// Startpunkt. Summentabelle ueber die deckenden Pixel, damit "ist das Rechteck leer?" eine
// Rechnung mit vier Zugriffen ist; dann fuer ein Raster von Mittelpunkten rund um den Start
// die groesste passende Breite per Halbierung suchen. Das Ergebnis liegt immer INNERHALB der
// Kreuzmessung - nie groesser, meist etwas kleiner, und nie ueber Motiv.
function rechteckMesser(data, w, h, ratio) {
  const S = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let zeile = 0;
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 60) zeile++;
      S[(y + 1) * (w + 1) + (x + 1)] = S[y * (w + 1) + (x + 1)] + zeile;
    }
  }
  const belegt = (l, t, r, b) => S[(b + 1) * (w + 1) + (r + 1)] - S[t * (w + 1) + (r + 1)] - S[(b + 1) * (w + 1) + l] + S[t * (w + 1) + l];
  const leer = (mx, my, breite) => {
    const hoehe = breite * ratio;
    const l = Math.floor(mx - breite / 2), r = Math.ceil(mx + breite / 2), t = Math.floor(my - hoehe / 2), b = Math.ceil(my + hoehe / 2);
    if (l < 0 || t < 0 || r >= w || b >= h) return false;
    return belegt(l, t, r, b) === 0;
  };
  return function (x0, y0, kreuz) {
    let best = null;
    const schritt = Math.max(2, Math.round(w / 48)), weite = Math.round(w * 0.12);
    for (let dy = -weite; dy <= weite; dy += schritt) for (let dx = -weite; dx <= weite; dx += schritt) {
      const mx = x0 + dx, my = y0 + dy;
      if (mx < 0 || my < 0 || mx >= w || my >= h) continue;
      let lo = 0, hi = Math.min(w, h / ratio);
      if (!leer(mx, my, 4)) continue;
      while (hi - lo > 1) { const mid = (lo + hi) / 2; if (leer(mx, my, mid)) lo = mid; else hi = mid; }
      if (!best || lo > best.breite) best = { mx, my, breite: lo };
    }
    if (!best) return kreuz;
    return { kind: 'hole', cx: best.mx / w, cy: best.my / h, w: best.breite / w, h: best.breite * ratio / h, kreuz: { w: kreuz.w, h: kreuz.h } };
  };
}

// Motiv einmal klein einlesen, damit die Deckungsmessung mehrfach laufen kann, ohne jedes Mal
// die ganze Druckleinwand zu verkleinern.
async function artKontext(artBuffer) {
  const am = await sharp(artBuffer).metadata();
  const { data, info } = await sharp(artBuffer).ensureAlpha().resize({ width: 384, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, W: am.width, H: am.height, f: info.width / am.width };
}

// Wie viel Motiv laege unter den deckenden Pixeln des Logos? Anteil 0..1 der Logo-Flaeche.
// cx, cy, target in Pixeln der Leinwand.
async function logoDeckung(ctx, logoBuffer, cx, cy, target) {
  const { data, w, h, f } = ctx;
  const lw = Math.max(2, Math.round(target * f));
  const { data: la, info: li } = await sharp(logoBuffer).ensureAlpha().resize({ width: lw, fit: 'inside' }).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  const left = Math.round(cx * f - li.width / 2), top = Math.round(cy * f - li.height / 2);
  let deckend = 0, drunter = 0;
  for (let y = 0; y < li.height; y++) for (let x = 0; x < li.width; x++) {
    if (la[y * li.width + x] <= 60) continue;
    deckend++;
    const ax = left + x, ay = top + y;
    if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
    if (data[(ay * w + ax) * 4 + 3] > 60) drunter++;
  }
  return deckend ? drunter / deckend : 0;
}

// Fassung 34: Wie gross darf DIESES Logo in der Luecke werden? Erst das leere Rechteck in
// Logo-Form (sicher frei), dann per Halbierung bis zur Kreuzmessung hochtasten, solange die
// echte Logo-Form (ihre deckenden Pixel) hoechstens 1,5 % Motiv zudeckt. Ein rundes Logo
// fuellt so eine runde Luecke ganz aus, ein eckiges eine ovale nur bis zum eingeschriebenen
// Rechteck - und in eine Kopfzeile ragt keins von beiden.
// Ergebnis: { hole, cx, cy, breite } in Pixeln; ohne Loch nur { hole }.
async function logoPassung(artBuffer, logoBuffer, place, ratio) {
  const hole = await findHole(artBuffer, place, ratio);
  if (!hole || hole.kind !== 'hole') return { hole };
  const ctx = await artKontext(artBuffer);
  const cx = hole.cx * ctx.W, cy = hole.cy * ctx.H;
  let lo = Math.min(hole.w * ctx.W, hole.h * ctx.H / ratio);
  const k = hole.kreuz || { w: hole.w, h: hole.h };
  let hi = Math.max(lo, Math.min(k.w * ctx.W, k.h * ctx.H / ratio));
  for (let i = 0; i < 8 && hi - lo > ctx.W * 0.004; i++) {
    const mid = (lo + hi) / 2;
    if ((await logoDeckung(ctx, logoBuffer, cx, cy, mid)) <= 0.015) lo = mid; else hi = mid;
  }
  return { hole, cx, cy, breite: lo, ctx };
}

// Fassung 34: Wie gross ist die Luecke fuer DIESES Logo wirklich? Fuer die Pruefung je Versuch
// (server.js): liefert die Breite, die das Logo bekaeme, als Anteil der Bildbreite.
// Kein Loch (nur ein Band oben/unten) -> Breite, die das Logo im Band bekaeme.
export async function logoLuecke(artBuffer, logoBuffer, place) {
  const lg = await freeLogo(logoBuffer);
  const lm = await sharp(lg).metadata();
  const ratio = lm.height / lm.width;
  const art = await sharp(artBuffer).metadata();
  const p = await logoPassung(artBuffer, lg, place, ratio);
  const hole = p.hole;
  if (!hole) return { w: 0, kind: 'keine' };
  if (hole.kind === 'hole') return { w: p.breite / art.width, cx: hole.cx, cy: hole.cy, kind: 'hole' };
  const bandPx = hole.band * art.height, margin = Math.round(art.height * 0.04);
  return { w: Math.max(0, (bandPx - margin * 1.5) / ratio) / art.width, kind: 'band' };
}

// Maske rund um deckende Pixel aufweiten (Kreis mit Radius r), Ergebnis 0/opacity.
function dilate(alpha, w, h, r, opacity) {
  const out = new Uint8Array(w * h);
  const offs = [[0, 0]];
  for (const rad of [r, r * 0.66, r * 0.33]) {
    const n = Math.max(8, Math.round(rad * 1.5));
    for (let i = 0; i < n; i++) offs.push([Math.round(rad * Math.cos(2 * Math.PI * i / n)), Math.round(rad * Math.sin(2 * Math.PI * i / n))]);
  }
  for (const [dx, dy] of offs) {
    for (let y = 0; y < h; y++) {
      const sy = y - dy; if (sy < 0 || sy >= h) continue;
      const row = sy * w, orow = y * w;
      for (let x = 0; x < w; x++) {
        const sx = x - dx; if (sx < 0 || sx >= w) continue;
        if (alpha[row + sx] > 128) out[orow + x] = opacity;
      }
    }
  }
  return Buffer.from(out);
}

// Kundenlogo unveraendert auf das Motiv setzen - Kanten bleiben scharf, Farben stimmen.
// Groesse richtet sich nach der freien Flaeche, dazu Kontur in der Motivfarbe und weicher Schatten,
// damit das Logo wie ein Teil des Designs wirkt und nicht wie aufgeklebt.
// fein = { dx, dy, groesse } greift NACH der automatischen Platzierung: die Automatik sucht
// weiter die freie Flaeche, und die Feinjustierung schiebt das Ergebnis von dort aus. So
// bleibt der gute Standardfall gut, und korrigieren kann man trotzdem.
export async function placeLogo(artBuffer, logoBuffer, place, widthPct, fein, bericht) {
  const art = await sharp(artBuffer).metadata();
  const W = art.width, H = art.height;
  const pct = Math.min(Math.max(+widthPct || 38, 8), 90) / 100;
  const lmeta = await sharp(logoBuffer).metadata();
  const ratio = lmeta.height / lmeta.width;

  let target = Math.round(W * pct);
  let cx = W / 2, cy = H / 2;
  let plate = false;
  const treffer = fein && fein.treffer;
  if (place === 'mitte' && !treffer) {
    const r = await removePlate(artBuffer).catch(() => ({ buffer: artBuffer, removed: false }));
    artBuffer = r.buffer; plate = r.removed;
  }
  // Fassung 37: Fundstelle bekannt (Logo war Vorlage) - genau dorthin, in genau der Groesse.
  const passung = treffer ? { hole: null } : await logoPassung(artBuffer, logoBuffer, place, ratio).catch(() => ({ hole: null }));
  const hole = passung.hole;
  const margin = Math.round(H * 0.04);
  let fit = 1;
  let ctx = passung.ctx || null;

  if (hole && hole.kind === 'hole') {
    // Fassung 29: das Logo deckt die Innenkante der Luecke leicht ab (1.06 statt 0.9). Mit Luft
    // zwischen Logo und Motiv sah es aus wie "Loch gelassen und Logo reingepackt"; mit leichter
    // Ueberlappung verschwinden Strahlen, Baender und Lorbeer hinter dem Logo - eingebunden.
    // Der Rahmen (Kontur + Schatten) liegt ohnehin ueber dem Motiv und kaschiert die Kante.
    fit = plate ? 1.04 : 1.06;
    target = Math.round(passung.breite * fit);
    // Fassung 34: KEINE Zwangsvergroesserung mehr auf 70 % des Wunschmasses. Genau die hob das
    // Logo ueber die Luecke hinaus und legte es ueber die Kopfzeile. Ist die Luecke zu klein,
    // bleibt das Logo klein und der Befund geht in den Bericht - neu zeichnen entscheidet
    // der Aufrufer (server.js prueft die Luecke je Versuch, bevor es so weit kommt).
    target = Math.min(target, Math.round(W * pct * 1.8));
    if (bericht && target < W * pct * 0.7) bericht.klein = Math.round(target / W * 100);
    cx = passung.cx; cy = passung.cy;
  } else if (hole && hole.kind === 'band' && hole.band * H > margin * 2) {
    const bandPx = hole.band * H;
    const byHeight = (bandPx - margin * 1.5) / ratio;
    target = Math.round(Math.min(Math.round(W * pct * 1.4), byHeight));
    if (bericht && target < W * pct * 0.7) bericht.klein = Math.round(target / W * 100);
    cy = place === 'oben' ? bandPx / 2 : H - bandPx / 2;
  }
  // Boden: unter 55 % des Wunschmasses wird das Logo unlesbar - dann lieber sichtbar und im
  // Bericht als "Luecke zu klein" gemeldet, als ein Logo, das keiner mehr findet. Der Normalfall
  // kommt hier nicht an: server.js prueft die Luecke je Versuch und laesst neu zeichnen.
  const boden = Math.round(W * pct * 0.55);
  if (treffer) {
    target = Math.max(24, Math.round(treffer.breite)); cx = treffer.cx; cy = treffer.cy;
  } else {
    if (target < boden) target = boden;
    if (!(hole && hole.kind === 'hole') && !(hole && hole.kind === 'band' && hole.band * H > margin * 2)) {
      if (place === 'oben') cy = margin + (target * ratio) / 2;
      else if (place === 'unten') cy = H - margin - (target * ratio) / 2;
    }
  }
  if (target * ratio > H * 0.9) target = Math.round(H * 0.9 / ratio);

  // ---- Feinjustierung ----
  const f = fein || {};
  if (f.groesse && +f.groesse !== 1) {
    target = Math.round(target * Math.min(Math.max(+f.groesse, 0.25), 3));
    if (target * ratio > H * 0.95) target = Math.round(H * 0.95 / ratio);
    if (target > W * 0.95) target = Math.round(W * 0.95);
  }
  // Der Rahmen (Kontur, dunkle Linie, Schatten) macht den Logo-Block deutlich breiter als
  // das Logo selbst. Passt der Block nicht mehr auf die Flaeche, verweigert sharp das
  // Zusammensetzen mit "Image to composite must have same dimensions or smaller" - das kam
  // beim Test mit starker Vergroesserung. Also einmal nachrechnen und notfalls
  // verkleinern; im Normalfall greift die Schleife gar nicht.
  {
    const rand = (t) => 2 * (Math.max(4, Math.round(t * 0.032)) * 2 + Math.round(t * 0.04));
    const vorher = target;
    let schutz = 0;
    while (schutz++ < 12 && (target + rand(target) > W || target * ratio + rand(target) > H)) {
      target = Math.floor(target * 0.94);
    }
    target = Math.max(24, target);
    // Wurde gekuerzt, muss der Aufrufer das erfahren. Sonst klickt jemand "groesser",
    // nichts passiert, und der gespeicherte Wert behauptet trotzdem 3x - genau die Art
    // stiller Abweichung, die man stundenlang sucht.
    if (bericht && target < vorher) { bericht.begrenzt = true; bericht.faktorEcht = target / vorher; }
  }
  cx += (+f.dx || 0);
  cy += (+f.dy || 0);
  // In der Flaeche halten: eine Verschiebung darf das Logo nicht halb aus der Druckdatei
  // schieben. Lieber am Rand anstossen als abgeschnitten drucken.
  {
    const halbW = target / 2, halbH = (target * ratio) / 2;
    cx = Math.min(Math.max(cx, halbW), W - halbW);
    cy = Math.min(Math.max(cy, halbH), H - halbH);
  }
  // Fassung 34, zweites Netz: liegt unter dem Logo trotzdem Motiv (Schrift, Ornament), wird
  // das Logo schrittweise kleiner, bis hoechstens 2 % seiner Flaeche etwas zudecken - aber nur
  // bis 60 % der berechneten Groesse, darunter meldet der Bericht den Rest. Nicht bei einer
  // Feinjustierung von Hand: wer im Backend "groesser" oder "nach links" sagt, meint das so.
  // Gemessen wird OHNE die gewollte Ueberlappung (fit): die 6 % ueber die Lueckenkante hinaus
  // sind Absicht und zaehlen nicht als Zudecken.
  const vonHand = !!(f.dx || f.dy || (f.groesse && +f.groesse !== 1)) || !!treffer;
  if (!vonHand) {
    try {
      if (!ctx) ctx = await artKontext(artBuffer);
      const untergrenze = Math.max(boden, Math.round(target * 0.6));
      let deckung = await logoDeckung(ctx, logoBuffer, cx, cy, target / fit);
      let runden = 0;
      while (deckung > 0.02 && target > untergrenze && runden++ < 12) {
        target = Math.max(untergrenze, Math.floor(target * 0.95));
        deckung = await logoDeckung(ctx, logoBuffer, cx, cy, target / fit);
      }
      if (bericht) bericht.deckung = Math.round(deckung * 1000) / 10;
      if (deckung > 0.02) console.warn('Logo deckt Motiv zu:', Math.round(deckung * 100) + ' % der Logoflaeche, Logo', target, 'px breit');
    } catch (e) { console.error('Logo-Deckung messen:', e && e.message ? e.message : e); }
  }

  // Konturfarbe: haeufigste bunte Farbe des Motivs, sonst Gold
  const cols = await dominantColors(artBuffer).catch(() => []);
  const vivid = cols.find(c => !NEUTRAL.includes(c.name) && c.share > 0.03);
  const accent = vivid ? hex(vivid) : '#d2aa46';

  const logo = await sharp(logoBuffer).ensureAlpha().resize({ width: target, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  const r1 = Math.max(3, Math.round(target * 0.022));   // Kontur in Motivfarbe
  const r2 = Math.max(4, Math.round(target * 0.032));   // dunkle Aussenlinie
  const pad = r2 * 2 + Math.round(target * 0.04);
  const cw = lm.width + pad * 2, chh = lm.height + pad * 2;

  const padded = await sharp(logo).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  // Fassung 30: Kontur, Aussenlinie und Schatten in VOLLER Aufloesung. Bisher wurde die Maske in
  // Viertelaufloesung aufgeweitet und kubisch hochgerechnet - auf der Druckleinwand (Logo bis
  // 1700 px) ergab das treppige Ringe, sichtbar als "Pixel rund um das Logo". Jetzt: Weichzeichnen
  // und Schwelle - eine Gaussglocke mit sigma = radius/2,5 reicht bei Schwelle 6/255 rund um den
  // gewuenschten Radius nach aussen; danach eine halbe Pixelreihe Glaettung gegen Treppen.
  const alphaVoll = await sharp(padded).extractChannel('alpha').toColourspace('b-w').png().toBuffer();
  const ring = async (radius, color, opacity) => {
    const mask = await sharp(alphaVoll).blur(Math.max(0.5, radius / 2.5)).threshold(6).blur(0.7).toColourspace('b-w').raw().toBuffer();
    if (opacity < 255) for (let i = 0; i < mask.length; i++) mask[i] = Math.round(mask[i] * opacity / 255);
    const fill = await sharp({ create: { width: cw, height: chh, channels: 3, background: color } }).raw().toBuffer();
    return sharp(fill, { raw: { width: cw, height: chh, channels: 3 } }).joinChannel(mask, { raw: { width: cw, height: chh, channels: 1 } }).png().toBuffer();
  };
  // Fassung 30: Der farbige Leuchtrand (Kontur in der Motivfarbe) kam aus Fassung 10, als das
  // Logo noch in ein Loch gesetzt wurde und "aufgeklebt" wirkte. Seit das Design um das Logo
  // herum gebaut wird, wirkt der Rand als weicher gruener Hof um jede Kante (Screenshot Markus,
  // 14. Sept.: "auf gar keinen Fall von Qualitaeten abweichen"). Standard ist jetzt eine duenne
  // dunkle Aussenlinie plus weicher Schatten - das Logo bleibt, wie der Kunde es geliefert hat.
  // LOGO_RINGE=voll (Railway) holt den alten Leuchtrand zurueck, LOGO_RINGE=keine setzt nur das Logo.
  const ringe = String(process.env.LOGO_RINGE || 'keyline');
  const layers = [];
  if (ringe !== 'keine') {
    const dick = ringe === 'voll' ? r2 : Math.max(2, Math.round(target * 0.012));
    layers.push({ input: await ring(dick + Math.round(target * 0.03), '#000000', ringe === 'voll' ? 90 : 70), blend: 'over' });
    layers.push({ input: await ring(dick, '#141414', 255), blend: 'over' });
    if (ringe === 'voll') layers.push({ input: await ring(r1, accent, 255), blend: 'over' });
  }
  layers.push({ input: padded, blend: 'over' });
  const block = await sharp({ create: { width: cw, height: chh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png().toBuffer();

  const left = Math.round(Math.max(0, Math.min(W - cw, cx - cw / 2)));
  const top = Math.round(Math.max(0, Math.min(H - chh, cy - chh / 2)));
  console.log('logo', { place, target, cx: Math.round(cx), cy: Math.round(cy), accent, hole: hole && hole.kind, luecke: hole && hole.w ? Math.round(hole.w * 100) + '%' : null, plate, deckung: bericht && bericht.deckung });
  return sharp(artBuffer).composite([{ input: block, left, top }]).png().toBuffer();
}

// ---------- Vorschau mit Wasserzeichen ----------
export async function makePreview(pngBuffer) {
  const base = sharp(await sharp(pngBuffer).resize({ width: 800 }).png().toBuffer());
  const { width = 800, height = 1200 } = await base.metadata();
  const svg = Buffer.from(`<svg width="${width}" height="${height}">
<style>text{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:#fff;fill-opacity:.35}</style>
<text x="50%" y="46%" font-size="42" text-anchor="middle" transform="rotate(-30 ${width / 2} ${height / 2})">MOTTO OTTO - VORSCHAU</text>
<text x="50%" y="60%" font-size="42" text-anchor="middle" transform="rotate(-30 ${width / 2} ${height / 2})">MOTTO OTTO - VORSCHAU</text>
</svg>`);
  return base.flatten({ background: '#1a1a1a' }).composite([{ input: svg }]).png().toBuffer();
}

// ---------- Kleines Bild der Druckdatei fuer die Produktionsseite ----------
// Ohne Wasserzeichen und ohne Mockup-Vorlage: die Druckdatei selbst, quadratisch eingepasst.
// Der Hintergrund hat die Farbe des Textils, fuer das gezeichnet wurde - sonst verschwindet
// heller Druck auf hellem Grund (und dunkler Druck auf dunklem).
export async function druckThumb(pngBuffer, textile = 'schwarz', size = 360) {
  // Der Grund zeigt den echten Ton: reines Weiss und reines Schwarz genau so, wie sie sind -
  // sonst sieht man auf dem Bildschirm einen Kontrast, den das Kleidungsstueck nicht hat.
  const bg = { weiss: '#ffffff', hell: '#f3f1ee', dunkel: '#1b1a21', schwarz: '#000000' }[textilTon(textile)];
  return sharp(pngBuffer)
    .resize({ width: size, height: size, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background: bg })
    .jpeg({ quality: 84 })
    .toBuffer();
}

// ---------- Druck-PDF mit echtem Seitenmass ----------
// Fassung 35: EINE Quelle fuer das Mass. Die Druckdatei (PNG) traegt ihre dpi im Kopf (pHYs),
// daraus folgen Zentimeter. PDF und SVG uebernehmen genau dieses Mass - nie eine andere Zahl.
export async function druckMass(pngBuffer) {
  const meta = await sharp(pngBuffer).metadata();
  const dpi = meta.density && meta.density >= 72 ? Math.round(meta.density) : PRINT_DPI;
  return { px: [meta.width, meta.height], dpi, cm: [Math.round(meta.width / dpi * 254) / 100, Math.round(meta.height / dpi * 254) / 100] };
}
// Vektor-PDF aus der SVG (rsvg-convert, librsvg). Seitengroesse = SVG-Mass in cm.
export async function makePdfVonSvg(svg) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const p = spawn('rsvg-convert', ['-f', 'pdf'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [], err = [];
    p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => err.push(d));
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(Buffer.concat(out)) : reject(new Error('rsvg-convert ' + code + ': ' + Buffer.concat(err).toString().slice(0, 200))));
    p.stdin.end(svg);
  });
}
// Raster-PDF (Rueckfall und fuer Varianten mit Namen): Seite exakt so gross wie das PNG bei seinen dpi.
export async function makePdf(pngBuffer, dpi) {
  const mass = await druckMass(pngBuffer);
  const d = Math.min(Math.max(+dpi || mass.dpi, 72), 600);
  const meta = await sharp(pngBuffer).metadata();
  const wPt = (meta.width / d) * 72;
  const hPt = (meta.height / d) * 72;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([wPt, hPt]);
  const img = await pdf.embedPng(pngBuffer);
  page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
  pdf.setTitle('Motto Otto Druckdatei');
  pdf.setProducer('motto-otto');
  return Buffer.from(await pdf.save());
}

// ---------- Kunden-Upload pruefen und vereinheitlichen ----------
// Was der Kunde tatsaechlich in der Hand hat, entscheidet - nicht was uns bequem ist. Ein Betrieb
// bekommt sein Logo von der Agentur als SVG oder TIFF, ein Handy macht HEIC, eine Datei aus dem
// Netz ist WebP. All das wird angenommen und hier zu PNG vereinheitlicht.
const UPLOAD_FORMATE = ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif', 'heif', 'heic', 'svg', 'tiff', 'tif'];
// Vektor braucht eine Zielbreite, sonst rastert sharp in der winzigen Originalgroesse der Datei.
const SVG_ZIELBREITE = 2000;

// Was es ist, wenn sharp es nicht lesen kann. Der Kunde soll "PDF koennen wir nicht direkt lesen"
// lesen und nicht "Format nicht unterstuetzt".
export function dateiArt(buffer) {
  if (!buffer || buffer.length < 4) return null;
  const kopf = buffer.subarray(0, 8).toString('latin1');
  if (kopf.startsWith('%PDF')) return 'PDF';
  if (kopf.startsWith('%!PS')) return 'EPS';
  if (buffer[0] === 0xc5 && buffer[1] === 0xd0 && buffer[2] === 0xd3 && buffer[3] === 0xc6) return 'EPS';
  if (kopf.startsWith('PK')) return 'ZIP-Archiv';
  return null;
}

// ---------- PDF-Logos ----------
// Die meisten Firmen haben ihr Logo als PDF von der Agentur. sharp kann kein PDF, also rendert
// poppler (pdftocairo, im Dockerfile installiert) die erste Seite als PNG mit Transparenz -
// Vektoren bleiben scharf, weil gleich in Zielgroesse gerastert wird. Fehlt das Werkzeug
// (etwa lokal ohne Docker), meldet pdfWerkzeugDa() false und die freundliche Fehlermeldung bleibt.
let pdfWerkzeug = null; // null = noch nicht geprueft, true/false danach
export async function pdfWerkzeugDa() {
  if (pdfWerkzeug === null) {
    try { await execFileP('pdftocairo', ['-v'], { timeout: 5000 }); pdfWerkzeug = true; }
    catch (e) { pdfWerkzeug = false; }
  }
  return pdfWerkzeug;
}

export async function pdfZuPng(buffer, zielBreite = SVG_ZIELBREITE) {
  if (!(await pdfWerkzeugDa())) throw new Error('PDF koennen wir nicht direkt lesen');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mo-pdf-'));
  const rendern = async (kante) => {
    // Nur Seite 1, transparenter Hintergrund, lange Seitenkante auf `kante` Pixel.
    await execFileP('pdftocairo', ['-png', '-transp', '-singlefile', '-f', '1', '-l', '1', '-scale-to', String(kante), path.join(tmp, 'logo.pdf'), path.join(tmp, 'seite')],
      { timeout: 30000, maxBuffer: 1024 * 1024 });
    return fs.readFile(path.join(tmp, 'seite.png'));
  };
  try {
    await fs.writeFile(path.join(tmp, 'logo.pdf'), buffer);
    let seite;
    try { seite = await rendern(zielBreite); }
    catch (e) { throw new Error('PDF koennen wir nicht lesen - Datei beschaedigt oder geschuetzt'); }

    // Eine Logo-Seite hat meist viel Luft um das Motiv (A4 mit einem 6 cm grossen Logo). Die Luft
    // schneiden wir weg - und wenn das Logo danach viel kleiner als die Zielgroesse ist, rendern
    // wir ein zweites Mal groesser. Vektoren kosten das nichts, das Ergebnis bleibt scharf.
    let geschnitten;
    try { geschnitten = await sharp(seite).trim().png().toBuffer({ resolveWithObject: true }); }
    catch (e) { return seite; } // ganz leere Seite: trim wirft, dann eben ungeschnitten
    const lang = Math.max(geschnitten.info.width, geschnitten.info.height);
    if (lang < zielBreite * 0.8) {
      const faktor = Math.min(8, zielBreite / Math.max(1, lang));
      try {
        const gross = await rendern(Math.min(12000, Math.round(zielBreite * faktor)));
        return await sharp(gross).trim().png().toBuffer();
      } catch (e) { /* dann eben die erste, kleinere Fassung */ }
    }
    return geschnitten.data;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

export async function normalizeUpload(buffer) {
  // PDF (und Illustrator-Dateien, die als PDF gespeichert sind) vorab in ein PNG wandeln,
  // danach geht es den normalen Weg wie jedes andere Bild.
  if (dateiArt(buffer) === 'PDF') buffer = await pdfZuPng(buffer);

  let meta = null;
  try { meta = await sharp(buffer).metadata(); } catch (e) { meta = null; }
  if (!meta || !meta.width || !meta.height) {
    const art = dateiArt(buffer);
    throw new Error(art ? `${art} koennen wir nicht direkt lesen` : 'kein Bild');
  }
  const format = String(meta.format);
  if (!UPLOAD_FORMATE.includes(format)) {
    const art = dateiArt(buffer);
    throw new Error(art ? `${art} koennen wir nicht direkt lesen` : 'Format nicht unterstuetzt');
  }

  const max = 2400;
  // Aus einer Vektordatei gleich gross genug rastern - spaeteres Hochskalieren waere unscharf.
  const img = format === 'svg'
    ? sharp(buffer, { density: Math.min(2400, Math.max(72, Math.round(72 * SVG_ZIELBREITE / meta.width))) })
    : sharp(buffer);

  // Nach dem Rastern die ECHTE Groesse holen, nicht die aus der Datei.
  const roh = await img.png().toBuffer();
  const rm = await sharp(roh).metadata();
  let fertig = sharp(roh);
  if (rm.width > max || rm.height > max) fertig = fertig.resize({ width: max, height: max, fit: 'inside' });
  const png = await fertig.png().toBuffer();
  const out = await sharp(png).metadata();
  return { png, width: out.width, height: out.height, format };
}

// ---------- Signierte Vorschau-URL ----------
export function signPreview(designId, exp, secret) {
  return crypto.createHmac('sha256', secret).update(`${designId}:${exp}`).digest('hex').slice(0, 24);
}

// ---------- Otto-Maskottchen laden, freistellen und Icons erzeugen ----------
// Laedt das Logo-PNG einmal beim Start, stellt den Hintergrund frei, schneidet
// transparente Raender ab und legt logo.png + Favicons im Storage ab.
// Wird ueber /logo.png bzw. /favicon.png ausgeliefert und in den Seiten eingebunden.
export async function ensureLogo(storeDir, opts = {}) {
  const { localPath, url } = typeof opts === 'string' ? { url: opts } : opts;
  const logoPath = path.join(storeDir, 'logo.png');
  let raw = null;
  // Bevorzugt ein fest eingebundenes Quellbild (logo-source.png). Ist es vorhanden, wird das
  // Logo bei jedem Start daraus neu erzeugt und ueberschreibt ein evtl. gecachtes altes Logo.
  if (localPath) { try { raw = await fs.readFile(localPath); } catch (e) { raw = null; } }
  if (!raw) {
    // Kein lokales Quellbild: bereits vorhandenes Logo behalten, sonst von URL laden.
    try { await fs.access(logoPath); return logoPath; } catch (e) { /* neu laden */ }
    if (!url) throw new Error('keine Logo-Quelle');
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    raw = Buffer.from(await r.arrayBuffer());
  }
  let cut;
  try { cut = await cutout(await sharp(raw).png().toBuffer()); }
  catch (e) { cut = await sharp(raw).png().toBuffer(); }
  const voll = await sharp(cut).trim().png().toBuffer();
  // Das freigestellte Logo in voller Auflaesung bleibt liegen - falls es irgendwo gross
  // gebraucht wird. Ausgeliefert wird es nicht.
  await fs.writeFile(path.join(storeDir, 'logo-full.png'), voll);
  // Fassung 77 (Ladezeit-Messung): Vorher ging genau dieses Bild ueber /logo.png an jeden
  // Besucher - 73 kB fuer ein Logo, das in der Kopfzeile 36 bis 38 px hoch steht. Und
  // favicon.png waren 512 px unkomprimiert, also 154 kB fuer ein Reitersymbol; es war damit
  // die schwerste Datei der ganzen Startseite. Beides liegt jetzt in der Groesse, in der es
  // angezeigt wird, und mit Palette gepackt.
  const packen = { palette: true, colors: 128, effort: 10, compressionLevel: 9 };
  await fs.writeFile(logoPath, await sharp(voll)
    .resize({ height: 152, fit: 'inside', withoutEnlargement: true })   // 4x von 38 px
    .png(packen).toBuffer());
  const square = (size) => sharp(voll)
    .resize({ width: size, height: size, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png(packen).toBuffer();
  await fs.writeFile(path.join(storeDir, 'favicon.png'), await square(512));
  await fs.writeFile(path.join(storeDir, 'favicon-64.png'), await square(64));
  await fs.writeFile(path.join(storeDir, 'favicon-32.png'), await square(32));
  await fs.writeFile(path.join(storeDir, 'apple-touch-icon.png'), await square(180));
  return logoPath;
}

// ---------- Nur-Logo-Druck: ohne Bildgenerator ----------
// Fuer Fanclubs, die kein gezeichnetes Design wollen, sondern genau zwei Dinge auf dem Teil:
// ihr eigenes Logo und das Wappen des Vereins, den sie supporten - dazu hoechstens ein, zwei
// kurze Zeilen. Hier hat eine Bild-KI nichts zu suchen: die Logos werden unveraendert gesetzt,
// nichts wird nachgezeichnet, nichts kann schiefgehen. Ergebnis ist ein freigestelltes PNG,
// das danach denselben Weg geht wie jedes andere Motiv (Master, Vorschau, Mockups, Freigabe).
const svgEsc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function logoPrint(opts) {
  const o = opts || {};
  const [cw, ch] = String(o.size || '1024x1536').split('x').map(n => parseInt(n, 10) || 1024);
  // Grosszuegig rechnen und am Ende einmal skalieren - so bleiben Kanten und Schrift sauber.
  const F = 2;
  const W = cw * F, H = ch * F;
  const rand = Math.round(Math.min(W, H) * 0.07);        // Sicherheitsabstand zum Rand

  // Die beiden Logos: nebeneinander bei liegendem Format, sonst uebereinander -
  // so fuellen sie die Flaeche, statt in der Mitte zu versanden.
  const quer = W > H;
  let block = null;
  if (o.logoA && o.logoB) {
    block = quer ? await combineLogos(o.logoA, o.logoB, 14) : await stackLogos(o.logoA, o.logoB, 14);
  } else if (o.logoA || o.logoB) {
    block = await freeLogo(o.logoA || o.logoB);
  }
  if (!block) throw new Error('Fuer den Nur-Logo-Druck fehlt mindestens ein Logo');
  block = await sharp(block).trim().png().toBuffer();

  const zeilen = (o.zeilen || []).map(z => String(z || '').trim()).filter(Boolean).slice(0, 3);
  // 23. Sept.: 'Poppins' war im Container nie installiert - siehe NAME_FONTS in names.js.
  // Archivo liegt als .ttf im Repo und wird ueber fonts.conf gefunden.
  const font = o.font || { family: 'Archivo', weight: 800, ratio: 0.62 };
  const hell = istHell(o.textile);
  const ink = hell ? '#141414' : '#f6efe0';
  const edge = hell ? '#f6efe0' : '#141414';

  // Wie viel Platz die Schrift bekommt: pro Zeile ein Anteil der Hoehe, der Rest gehoert dem Logo.
  const zeileH = zeilen.length ? Math.round(H * (zeilen.length === 1 ? 0.13 : 0.11)) : 0;
  const textH = zeilen.length ? zeileH * zeilen.length + Math.round(H * 0.03) : 0;

  // Groesse des Logoblocks: der Kunde waehlt klein / mittel / gross, gemeint ist die Breite.
  const anteil = { klein: 0.52, mittel: 0.72, gross: 0.92 }[o.groesse] || 0.92;
  const maxW = Math.round((W - 2 * rand) * anteil);
  const maxH = H - 2 * rand - textH;
  const passend = await sharp(block).resize({ width: maxW, height: maxH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const pm = await sharp(passend).metadata();

  // Logo und Schrift zusammen mittig - nicht das Logo mittig und die Schrift irgendwo drunter.
  const gesamtH = pm.height + textH;
  const oben = Math.round((H - gesamtH) / 2);
  const links = Math.round((W - pm.width) / 2);

  const ebenen = [{ input: passend, left: links, top: oben }];

  if (zeilen.length) {
    const maxTextW = (W - 2 * rand) * 0.94;
    const teile = zeilen.map((t, i) => {
      const text = i === 0 ? t.toUpperCase() : t;
      const gross = i === 0 ? 0.62 : 0.42;
      let size = Math.round(zeileH * gross);
      const spacing = 0.04;
      const est = text.length * (font.ratio + spacing) * size;
      let fit = '';
      if (est > maxTextW) { size = Math.round(size * maxTextW / est); fit = ` textLength="${Math.round(maxTextW)}" lengthAdjust="spacingAndGlyphs"`; }
      const y = Math.round(zeileH * i + zeileH * 0.62);
      const kontur = Math.max(2, Math.round(size * 0.11));
      return `<text x="50%" y="${y}"${fit} text-anchor="middle" fill="none" stroke="${edge}" stroke-width="${kontur * 2}" stroke-linejoin="round" style="font-size:${size}px">${svgEsc(text)}</text>` +
             `<text x="50%" y="${y}"${fit} text-anchor="middle" fill="${ink}" style="font-size:${size}px">${svgEsc(text)}</text>`;
    }).join('');
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${zeileH * zeilen.length}">
<style>text{font-family:'${font.family}';font-weight:${font.weight};letter-spacing:0.03em}</style>${teile}</svg>`);
    const layer = await sharp(svg, { density: 72 }).png().toBuffer();
    ebenen.push({ input: layer, left: 0, top: oben + pm.height + Math.round(H * 0.03) });
  }

  const roh = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(ebenen).png().toBuffer();
  return sharp(roh).resize({ width: cw, height: ch, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
}

// Zwei Logos uebereinander, auf gleiche Breite gebracht - das Gegenstueck zu combineLogos.
export async function stackLogos(logoA, logoB, gapPct = 12) {
  const a = await freeLogo(logoA), b = await freeLogo(logoB);
  const B = 800;
  const fit = async (buf) => sharp(buf).trim().resize({ width: B, fit: 'inside' }).png().toBuffer();
  const [pa, pb] = [await fit(a), await fit(b)];
  const [ma, mb] = [await sharp(pa).metadata(), await sharp(pb).metadata()];
  const gap = Math.round(B * gapPct / 100);
  const H = ma.height + gap + mb.height;
  return sharp({ create: { width: B, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: pa, left: Math.round((B - ma.width) / 2), top: 0 }, { input: pb, left: Math.round((B - mb.width) / 2), top: ma.height + gap }])
    .png().toBuffer();
}

// --- Fassung 23: Alphakanal haerten -------------------------------------------------
// Befund vom 13. Sept. 2026: background=transparent liefert zwar echtes Alpha, aber KEINE
// saubere Schnittkante. Um jedes Element liegt ein breiter, halbdurchsichtiger Hof (im
// Kontrollbild rund 100 px). Auf DTF druckt sich dieser Hof als milchiger Rand - genau das
// "Schlammige". Die Buchstabenform selbst ist scharf, nur der Alphakanal ist weich.
// Deshalb: Alpha hart schneiden, einen Hauch einziehen, und eine einzige Pixelreihe
// Kantenglaettung wieder aufsetzen, damit keine Treppen entstehen.
export async function alphaSchaerfen(pngBuffer, opts = {}) {
  const schwelle = opts.schwelle ?? 128;   // ab hier gilt ein Pixel als deckend
  // 22. Sept. 2026: Das Einziehen stand auf 1 Pixel, um Reste des Hofs loszuwerden. Zusammen mit
  // dem Medianfilter weiter unten loescht es aber DUENNE Striche ganz: ein 3 px breiter
  // Schriftstrich wird beidseitig um ein Pixel eingezogen, bleibt als 1-px-Linie uebrig, und die
  // raeumt der Median weg. Gemessen an der Probe: 0 Prozent uebrig. Seit die Hof-Regel nur noch
  // den echten Aussenrand anfasst, braucht es das Einziehen nicht mehr - wer es doch will, gibt
  // choke ausdruecklich mit.
  const choke = opts.choke ?? 0;           // Pixel nach innen einziehen
  const glaetten = opts.glaetten ?? true;  // eine Pixelreihe Kantenglaettung zurueckgeben
  // Fassung 35: der Hof des Bildservers ist DUNKEL (Schein, Schatten) und halbdurchsichtig. Wo er
  // dicht an der Kante ueber die Schwelle kommt, blieb nach dem Haerten ein schwarzer Saum um das
  // Motiv - auf DTF ein Ring aus schwarzer Tinte, auf hellem Textil sofort sichtbar. Ein Pixel, das
  // nicht voll deckt UND fast schwarz ist, ist Hof, nicht Motiv. Eine schwarze Kontur verliert
  // dadurch hoechstens ihre aeusserste, ohnehin halbdurchsichtige Pixelreihe.
  const hofDunkel = opts.hofDunkel ?? 48;

  const bild = sharp(pngBuffer).ensureAlpha();
  const { data, info } = await bild.raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels, n = w * h;

  // 22. Sept. 2026, Markus zu einer Kundenkarte ("John Black"): "Guck dir die Schriften an, das
  // ist Katastrophe. Wir brauchen nichts freistellen, wir haben einen Alpha Kanal."
  // Er hatte recht, und der Fehler stand genau hier. Die Hof-Regel darunter nimmt Pixel weg, die
  // DUNKEL und NICHT GANZ DECKEND sind. Zwei Annahmen darin waren falsch:
  //   1. "nicht ganz deckend" hiess a < 250. Der Bilddienst liefert aber nie 255 - gemessen an
  //      dem Kundenbild: HOECHSTES Alpha 254, voll deckende Pixel 0,0 Prozent der Leinwand.
  //      Damit galt praktisch jedes schwarze Pixel als Hof.
  //   2. Ein Hof liegt AUSSEN. Die Regel fragte nie danach. Gemessen: 96 Prozent dessen, was sie
  //      wegnahm, lag MITTEN im Motiv - die Schrift und die Schraffur. Aus "John Black" wurden
  //      Fetzen.
  // Jetzt gilt: voll deckend ist, was das hoechste Alpha DIESES Bildes erreicht, und Hof ist nur,
  // was ausserdem an durchsichtigem Grund liegt. Eine schwarze Schrift mitten im Motiv wird nie
  // mehr angefasst.
  let maxAlpha = 0;
  for (let p = 0; p < n; p++) { const a = data[p * ch + 3]; if (a > maxAlpha) maxAlpha = a; }
  const vollDeckend = Math.max(200, maxAlpha - 5);
  const alphaVon = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : data[(y * w + x) * ch + 3];

  // 1. harte Maske
  const maske = Buffer.alloc(n);
  let vorherWeich = 0, hof = 0;
  for (let p = 0; p < n; p++) {
    const i = p * ch, a = data[i + 3];
    if (a > 0 && a < vollDeckend) vorherWeich++;
    let deckt = a >= schwelle;
    if (deckt && a < vollDeckend && data[i] < hofDunkel && data[i + 1] < hofDunkel && data[i + 2] < hofDunkel) {
      const x = p % w, y = (p / w) | 0;
      // Nur wenn es wirklich am Aussenrand sitzt: ein Nachbar muss (fast) durchsichtig sein.
      if (alphaVon(x - 1, y) < 16 || alphaVon(x + 1, y) < 16 || alphaVon(x, y - 1) < 16 || alphaVon(x, y + 1) < 16) { deckt = false; hof++; }
    }
    maske[p] = deckt ? 255 : 0;
  }
  if (hof) console.log('alphaSchaerfen: dunkler Hof entfernt, ' + Math.round(hof / n * 1000) / 10 + ' % der Leinwand');

  // 2. einziehen: ein Randpixel der harten Maske wegnehmen, damit vom Hof nichts stehen bleibt
  if (choke > 0) {
    for (let r = 0; r < choke; r++) {
      const kopie = Buffer.from(maske);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          if (!kopie[p]) continue;
          const oben = y > 0 ? kopie[p - w] : 0;
          const unten = y < h - 1 ? kopie[p + w] : 0;
          const links = x > 0 ? kopie[p - 1] : 0;
          const rechts = x < w - 1 ? kopie[p + 1] : 0;
          if (!oben || !unten || !links || !rechts) maske[p] = 0;
        }
      }
    }
  }

  // Fassung 64: einzelne herausgebrochene oder stehengebliebene Kantenpixel (Hof-Regel, Schwelle)
  // machen die Kontur ausgefranst - ein Medianfilter glaettet die harte Maske, bevor sie weich wird.
  // Der Medianfilter glaettet ausgefranste Kanten - er raeumt aber auch einzelne duenne Linien
  // weg. Darum laeuft er nur noch ueber die KANTE: wo ein Pixel ringsum gleich ist, bleibt es,
  // wie es ist. (Ohne das verschwand in der Probe eine 3-px-Schrift restlos.)
  {
    const med = await sharp(maske, { raw: { width: w, height: h, channels: 1 } }).toColourspace('b-w').median(3).raw().toBuffer();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const o = y > 0 ? maske[p - w] : maske[p], u = y < h - 1 ? maske[p + w] : maske[p];
      const li = x > 0 ? maske[p - 1] : maske[p], re = x < w - 1 ? maske[p + 1] : maske[p];
      const amRand = (o !== maske[p]) || (u !== maske[p]) || (li !== maske[p]) || (re !== maske[p]);
      if (amRand) maske[p] = med[p] >= 128 ? 255 : 0;
    }
  }
  // 3. eine Pixelreihe Kantenglaettung - sonst treppt die Kante im Grossformat
  let alpha = maske;
  if (glaetten) {
    // sharp macht aus einem 1-Kanal-Rohbild beim Weichzeichnen sonst still drei Kanaele -
    // toColourspace('b-w') haelt es einkanalig, sonst passt die Laenge nicht mehr.
    // Steht mit Absicht da, bitte nicht "aufraeumen".
    alpha = await sharp(maske, { raw: { width: w, height: h, channels: 1 } })
      .toColourspace('b-w').blur(0.6).raw().toBuffer();
    // Der Weichzeichner zieht die Kante auch nach aussen; alles unter einem Viertel
    // gehoert nicht mehr zum Motiv und wird hart auf null gesetzt.
    for (let p = 0; p < n; p++) if (alpha[p] < 64) alpha[p] = 0;
  }

  const rgb = Buffer.alloc(n * 3);
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    rgb[p * 3] = data[i]; rgb[p * 3 + 1] = data[i + 1]; rgb[p * 3 + 2] = data[i + 2];
  }

  // 4. Randfarben nachziehen. Bisher wurde NUR der Alphakanal gehaertet, die FARBE der Randpixel
  // blieb, wie sie war - und die ist im Original mit dem Hof verrechnet, also zu hell oder zu
  // dunkel. Nach dem Haerten stand dieser Mischton hart neben der Motivfarbe: ein milchiger
  // bzw. schmutziger Saum um jedes Element, den Markus am fertigen Druck gesehen hat
  // ("die Kanten sehen fuerchterlich aus", 16. Sept.). Jeder Randpixel bekommt darum die Farbe
  // seines naechsten voll deckenden Nachbarn - dann laeuft die Flaechenfarbe sauber bis an die
  // Kante, und erst die Kantenglaettung macht den Uebergang.
  {
    const voll = new Uint8Array(n);
    for (let p = 0; p < n; p++) voll[p] = data[p * ch + 3] >= 250 ? 1 : 0;
    let gezogen = 0;
    const kopie = Buffer.from(rgb);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!maske[p] || voll[p]) continue;          // nur gehaertete Randpixel
        let sr = 0, sg = 0, sb = 0, sw2 = 0;
        for (let dy = -2; dy <= 2; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const q = yy * w + xx;
            if (!voll[q]) continue;
            const g2 = 1 / (1 + Math.abs(dx) + Math.abs(dy));
            sr += kopie[q * 3] * g2; sg += kopie[q * 3 + 1] * g2; sb += kopie[q * 3 + 2] * g2; sw2 += g2;
          }
        }
        if (sw2 > 0) {
          rgb[p * 3] = Math.round(sr / sw2); rgb[p * 3 + 1] = Math.round(sg / sw2); rgb[p * 3 + 2] = Math.round(sb / sw2);
          gezogen++;
        }
      }
    }
    if (gezogen) console.log('alphaSchaerfen: Randfarben nachgezogen, ' + Math.round(gezogen / n * 1000) / 10 + ' % der Leinwand');
  }
  const out = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png({ compressionLevel: 9 }).toBuffer();

  let nachherWeich = 0;
  for (let p = 0; p < n; p++) if (alpha[p] > 0 && alpha[p] < 255) nachherWeich++;
  return { buffer: out, weichVorher: Math.round(vorherWeich / n * 1000) / 10, weichNachher: Math.round(nachherWeich / n * 1000) / 10 };
}

// ANHANG fuer images.js - Fassung 27 und 28. Kompletter Block, ans Dateiende anfuegen.
// sharp ist in images.js bereits importiert, kein zusaetzlicher Import noetig.
// Der alphaSchaerfen-Block aus Fassung 23 steht vollstaendig im Nachtrag 00g.

// --- Fassung 27: Schwarzflaechen auf dunklen Textilien -------------------------------
// Beanstandung Markus (13. Sept. 2026, an einem echten DTF-Motiv gesehen): "Da sind ueberall
// noch schwarze Sachen, die da eigentlich nicht hingehoeren. Bei DTF so viel Freiraum wie
// moeglich, und wo es nicht noetig ist, sollte auch nicht in Schwarz gedruckt werden - das
// sieht so aus, als waeren die Flaechen eigentlich durchsichtig."
//
// Er hat recht, und es ist nicht nur Optik:
//   - Auf einem schwarzen Shirt ist gedruckt Schwarz unsichtbar, kostet aber Tinte.
//   - Die gedruckte Flaeche fuehlt sich anders an und glaenzt anders als der Stoff. Man
//     sieht den Fleck im Streiflicht, auch wenn die Farbe stimmt.
//   - Jede Flaeche mehr heisst mehr Kleber, mehr Griff, mehr Bruchgefahr beim Dehnen.
// Also: grosse schwarze Flaechen raus, duenne schwarze Konturen bleiben.
//
// Die Unterscheidung macht eine Erosion: was ein Wegnehmen von minDicke Pixeln ueberlebt,
// ist eine FLAECHE. Was dabei verschwindet, war eine LINIE und bleibt erhalten.

const istSchwarz = (r, g, b, schwelle) => r <= schwelle && g <= schwelle && b <= schwelle;

function erodiere(maske, w, h, r) {
  let a = maske;
  for (let i = 0; i < r; i++) {
    const kopie = Buffer.from(a);
    const b = Buffer.alloc(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (!kopie[p]) continue;
        const oben = y > 0 ? kopie[p - w] : 0, unten = y < h - 1 ? kopie[p + w] : 0;
        const li = x > 0 ? kopie[p - 1] : 0, re = x < w - 1 ? kopie[p + 1] : 0;
        b[p] = (oben && unten && li && re) ? 255 : 0;
      }
    }
    a = b;
  }
  return a;
}

function dilatiere(maske, w, h, r) {
  let a = maske;
  for (let i = 0; i < r; i++) {
    const kopie = Buffer.from(a);
    const b = Buffer.from(kopie);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (kopie[p]) continue;
        const oben = y > 0 ? kopie[p - w] : 0, unten = y < h - 1 ? kopie[p + w] : 0;
        const li = x > 0 ? kopie[p - 1] : 0, re = x < w - 1 ? kopie[p + 1] : 0;
        if (oben || unten || li || re) b[p] = 255;
      }
    }
    a = b;
  }
  return a;
}

// Nur messen, nichts aendern - fuer die Anzeige im Backend.
export async function pruefeSchwarzflaechen(pngBuffer, opts = {}) {
  const schwelle = opts.schwelle ?? 32;
  const minDicke = opts.minDicke ?? 6;      // 6 px = rund 1,5 mm bei 26 cm auf 1024 px
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels, n = w * h;

  const schwarz = Buffer.alloc(n);
  let schwarzPx = 0, deckend = 0;
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    if (data[i + 3] < 128) continue;
    deckend++;
    if (istSchwarz(data[i], data[i + 1], data[i + 2], schwelle)) { schwarz[p] = 255; schwarzPx++; }
  }
  const kern = erodiere(schwarz, w, h, minDicke);
  let flaechePx = 0;
  for (let p = 0; p < n; p++) if (kern[p]) flaechePx++;

  const pct = (v) => Math.round(v / n * 1000) / 10;
  return {
    groesse: [w, h],
    schwarzAnteil: pct(schwarzPx),
    davonFlaeche: pct(flaechePx),          // das, was raus soll
    davonLinien: pct(schwarzPx - flaechePx), // das, was bleibt
    deckendAnteil: pct(deckend),
    empfehlung: flaechePx > 0
      ? 'Es gibt grosse schwarze Flaechen. Auf dunklem Textil gehoeren die transparent.'
      : 'Keine grossen schwarzen Flaechen - nur Konturen.'
  };
}

// Fassung 65 (Markus, 16. Sept., Lupe auf MO-VEREINSJ-FUWA): Das Modell malt hinter das Emblem
// gern eine reinweisse Flaeche - ein Banner, eine Aura, ein Tuch. Auf schwarzem Textil ist das ein
// grosser weisser Fleck: teuer im Druck, steif auf dem Stoff, und es sieht aus wie ein Fehler.
// Gemessen wird der Anteil DICKER reinweisser Flaechen am Motiv: die Maske wird erodiert, damit
// Konturlinien, Buchstaben und Glanzlichter (alles duenn) herausfallen und nur Flaechen bleiben.
// Creme, Off-White und Gold zaehlen NICHT - die sind die bestellte Schriftfarbe (RULES_DUNKEL).
export async function weisseFlaeche(artBuffer, opts = {}) {
  const grenze = opts.grenze ?? 248;      // ab hier gilt ein Kanal als reinweiss
  const neutral = opts.neutral ?? 8;      // hoechster Abstand der Kanaele: creme/gold faellt raus
  const schaelen = opts.schaelen ?? 3;    // Erosionsschritte: duenne Striche verschwinden
  const B = 400;
  const { data, info } = await sharp(artBuffer).ensureAlpha().resize({ width: B, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, n = w * h;
  let motiv = 0;
  let maske = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4, a = data[i + 3];
    if (a < 128) continue;
    motiv++;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (min >= grenze && max - min <= neutral) maske[p] = 1;
  }
  const roh = maske.reduce((s, v) => s + v, 0);
  for (let s = 0; s < schaelen; s++) {
    const kopie = maske; maske = new Uint8Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (kopie[p] && kopie[p - 1] && kopie[p + 1] && kopie[p - w] && kopie[p + w]) maske[p] = 1;
    }
  }
  const dick = maske.reduce((s, v) => s + v, 0);
  return {
    anteil: motiv ? Math.round(dick / motiv * 1000) / 1000 : 0,      // dicke weisse Flaeche am Motiv
    rohAnteil: motiv ? Math.round(roh / motiv * 1000) / 1000 : 0,    // alles Reinweisse, auch Striche
    motivAnteil: Math.round(motiv / n * 1000) / 1000
  };
}

// Aendern: grosse schwarze Flaechen auf transparent setzen, Konturen behalten.
export async function schwarzflaechenFreistellen(pngBuffer, opts = {}) {
  const schwelle = opts.schwelle ?? 32;
  const minDicke = opts.minDicke ?? 6;
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels, n = w * h;

  const schwarz = Buffer.alloc(n);
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    if (data[i + 3] < 128) continue;
    if (istSchwarz(data[i], data[i + 1], data[i + 2], schwelle)) schwarz[p] = 255;
  }
  // Kern der Flaechen finden, dann wieder aufblasen - aber nur bis minDicke-1, damit
  // die aeusserste Pixelreihe der Flaeche als Kante stehen bleibt und die Nachbarfarbe
  // nicht ausfranst.
  const kern = erodiere(schwarz, w, h, minDicke);
  const weg = dilatiere(kern, w, h, Math.max(0, minDicke - 1));

  // Fassung 35: nur FLAECHEN, keine Schatten. Markus, 14. Sept. (Geburtstag "Guenther 86",
  // Druckdatei): hunderte kleine Loecher in Haar, Hemd und Ziffern - jede dunkle Schattierung
  // im gemalten Motiv, die dicker als minDicke war, flog raus. Auf dem schwarzen Shirt sieht
  // man das in der Vorschau nicht, im Druck schon (Stoff statt Farbe mitten im Motiv).
  // Also: eine dunkle Stelle geht nur raus, wenn sie eine echte Flaeche ist - gross genug UND
  // an den freien Hintergrund grenzend (der Kasten hinter dem Text, das Panel hinter der
  // Skyline), oder so gross, dass es keine Schattierung mehr sein kann.
  const minFlaeche = opts.minFlaeche ?? Math.round(n * 0.004);
  const riesig = opts.riesig ?? Math.round(n * 0.03);
  const minRandFrei = opts.minRandFrei ?? 0.15;
  const maske = Buffer.alloc(n);
  for (let p = 0; p < n; p++) if (weg[p] && schwarz[p]) maske[p] = 1;
  const { label, liste } = komponenten(maske, w, h);
  const rand = new Int32Array(liste.length), randFrei = new Int32Array(liste.length);
  for (let p = 0; p < n; p++) {
    const id = label[p]; if (id < 0) continue;
    const x = p % w, y = (p - x) / w;
    let fremd = false, frei = false;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (q < 0) { fremd = true; frei = true; continue; }
      if (label[q] === id) continue;
      fremd = true;
      if (data[q * ch + 3] < 128) frei = true;
    }
    if (fremd) rand[id]++;
    if (frei) randFrei[id]++;
  }
  const raus = new Uint8Array(liste.length);
  let behalten = 0;
  for (const k of liste) {
    const grenztAnFrei = rand[k.id] ? randFrei[k.id] / rand[k.id] : 0;
    // fuellgrad: eine Flaeche fuellt ihren Kasten, ein Ring oder Rahmen nicht - der bleibt Kontur
    if (k.flaeche >= minFlaeche && k.fuellgrad >= 0.45 && (k.flaeche >= riesig || grenztAnFrei >= minRandFrei)) raus[k.id] = 1;
    else behalten++;
  }
  if (behalten) console.log('schwarzflaechenFreistellen: ' + behalten + ' dunkle Stellen als Schattierung behalten, ' + liste.filter(k => raus[k.id]).length + ' Flaechen entfernt');
  for (let p = 0; p < n; p++) if (label[p] >= 0 && !raus[label[p]]) weg[p] = 0;

  const rgb = Buffer.alloc(n * 3);
  const alpha = Buffer.alloc(n);
  let entfernt = 0;
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    rgb[p * 3] = data[i]; rgb[p * 3 + 1] = data[i + 1]; rgb[p * 3 + 2] = data[i + 2];
    if (weg[p] && schwarz[p]) { alpha[p] = 0; entfernt++; }
    else alpha[p] = data[i + 3];
  }
  const out = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png({ compressionLevel: 9 }).toBuffer();
  return { buffer: out, entferntProzent: Math.round(entfernt / n * 1000) / 10 };
}


// --- Fassung 28: dunkle Flaechen nach FORM erkennen, nicht nach Dicke ---------------
// Nachbesserung zu Fassung 27. Markus hat es an der Schrift gesehen: "Schau mal im B,
// zwischen dem U und dem R - das ist ueberall schwarz." Die Punzen der Buchstaben und
// der Schlagschatten dahinter waren gefuellt.
//
// Die Erosion aus Fassung 27 packt das nicht: eine Punze im B ist genauso schmal wie
// die Kontur eines Buchstabens. Nach Dicke sind beide gleich - nach FORM nicht:
//   Punze, Schlagschatten, Fuellblock = KOMPAKT. Fuellt seinen eigenen Kasten fast aus.
//   Kontur = SPARRIG. Ein Ring oder Strich beruehrt seinen Kasten nur am Rand und
//   fuellt vielleicht ein Drittel davon.
// Also: Zusammenhangskomponenten bilden und ueber das Fuellverhaeltnis entscheiden.
//
// ACHTUNG, gemessen am echten Motiv: Punzen, die dieselbe Farbe haben wie die Kontur und
// sie beruehren, sind EINE Komponente - die trennt auch das nicht. Deshalb bleibt die
// eigentliche Loesung im Prompt (RULES_SCHWARZ, GRUND.chroma). Diese Funktionen sind fuer
// freistehende Fuellflaechen da: ein Panel hinter der Skyline, ein Kasten hinter dem Text.
// Empfehlung: als WARNUNG neben der Vorschau anzeigen, nicht automatisch reparieren.

function komponenten(maske, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const liste = [];
  const stapel = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!maske[start] || label[start] >= 0) continue;
    const id = liste.length;
    let sp = 0; stapel[sp++] = start; label[start] = id;
    let flaeche = 0, x0 = w, x1 = 0, y0 = h, y1 = 0, amRand = false;
    while (sp > 0) {
      const p = stapel[--sp];
      const x = p % w, y = (p - x) / w;
      flaeche++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) amRand = true;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && maske[q] && label[q] < 0) { label[q] = id; stapel[sp++] = q; }
    }
    const kasten = (x1 - x0 + 1) * (y1 - y0 + 1);
    liste.push({ id, flaeche, kasten, fuellgrad: flaeche / kasten, amRand, breite: x1 - x0 + 1, hoehe: y1 - y0 + 1 });
  }
  return { label, liste };
}

// Analysieren, ohne zu aendern.
export async function pruefeDunkleFlaechen(pngBuffer, opts = {}) {
  const schwelle = opts.schwelle ?? 60;
  const minFuellgrad = opts.minFuellgrad ?? 0.55;
  const minFlaeche = opts.minFlaeche ?? 40;
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels, n = w * h;
  const maske = Buffer.alloc(n);
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    if (data[i + 3] < 128) continue;
    if (data[i] <= schwelle && data[i + 1] <= schwelle && data[i + 2] <= schwelle) maske[p] = 1;
  }
  const { liste } = komponenten(maske, w, h);
  const raus = liste.filter(k => !k.amRand && k.flaeche >= minFlaeche && k.fuellgrad >= minFuellgrad);
  const bleibt = liste.filter(k => !raus.includes(k));
  const summe = (a) => a.reduce((s, k) => s + k.flaeche, 0);
  const pct = (v) => Math.round(v / n * 1000) / 10;
  return {
    groesse: [w, h],
    komponenten: liste.length,
    dunkelAnteil: pct(summe(liste)),
    gefuellteFlaechen: raus.length,
    davonAnteil: pct(summe(raus)),
    konturenAnteil: pct(summe(bleibt)),
    groesste: raus.sort((a, b) => b.flaeche - a.flaeche).slice(0, 5)
      .map(k => ({ px: k.flaeche, kasten: `${k.breite}x${k.hoehe}`, fuellgrad: Math.round(k.fuellgrad * 100) + '%' }))
  };
}

// Aendern: kompakte dunkle Flaechen auf transparent, Konturen bleiben.
export async function dunkleFlaechenFreistellen(pngBuffer, opts = {}) {
  const schwelle = opts.schwelle ?? 60;
  const minFuellgrad = opts.minFuellgrad ?? 0.55;
  const minFlaeche = opts.minFlaeche ?? 40;
  const saum = opts.saum ?? 1;          // eine Pixelreihe der Flaeche als Kante stehen lassen
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels, n = w * h;
  const maske = Buffer.alloc(n);
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    if (data[i + 3] < 128) continue;
    if (data[i] <= schwelle && data[i + 1] <= schwelle && data[i + 2] <= schwelle) maske[p] = 1;
  }
  const { label, liste } = komponenten(maske, w, h);
  const wegId = new Set(liste.filter(k => !k.amRand && k.flaeche >= minFlaeche && k.fuellgrad >= minFuellgrad).map(k => k.id));

  const weg = Buffer.alloc(n);
  for (let p = 0; p < n; p++) if (label[p] >= 0 && wegId.has(label[p])) weg[p] = 255;
  const kern = saum > 0 ? erodiere(weg, w, h, saum) : weg;

  const rgb = Buffer.alloc(n * 3), alpha = Buffer.alloc(n);
  let entfernt = 0;
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    rgb[p * 3] = data[i]; rgb[p * 3 + 1] = data[i + 1]; rgb[p * 3 + 2] = data[i + 2];
    if (kern[p]) { alpha[p] = 0; entfernt++; } else alpha[p] = data[i + 3];
  }
  const out = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png({ compressionLevel: 9 }).toBuffer();
  return { buffer: out, entferntProzent: Math.round(entfernt / n * 1000) / 10, flaechen: wegId.size };
}

// ---------- Fassung 35: Vergleich auf der Startseite - Standard-KI gegen Motto Otto ----------
// Derselbe Auftrag zweimal: einmal so, wie ein Bildgenerator ohne Druckregeln liefert, einmal
// aus der Motto-Otto-Pipeline. Aus jedem Rohbild entstehen drei Ansichten: A (wie es aus dem
// Generator kommt), B (freigestellt fuers Shirt) und die Lupe (eine Kante vierfach vergroessert).
// "Standard" wird so freigestellt, wie es der Zauberstab in jedem Bildprogramm macht: die
// Hintergrundfarbe aus den Ecken nehmen und alles wegnehmen, was ihr aehnlich ist - ohne
// Kantenbehandlung. Das ist keine Karikatur, sondern genau das, was ein Kunde bekommt, der
// sein KI-Bild "durchsichtig macht".
//
// Fassung 73 (Markus, 17. Sept.: "der Standard sieht vom Designer total schick aus, die Leute
// verstehen ueberhaupt nicht wo das Problem ist"): vorher fiel nur weg, was NAHE WEISS war.
// Bei einem Rohbild auf schwarzem Grund passierte damit genau nichts - das "Standard"-Beispiel
// auf der Startseite war ein makelloses Emblem und der Vergleich zeigte keinen Unterschied.
// Jetzt wird die tatsaechliche Hintergrundfarbe gemessen, und dann faellt genau das weg, was
// ihr aehnlich ist: samt der Loecher, die das im Motiv reisst (das schwarze Shirt des Mannes
// auf schwarzem Grund), samt Saum und Fransen an jeder Kante.
async function naivFreistellen(pngBuffer, opts = {}) {
  const tol = opts.toleranz ?? 46;
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, n = w * h;
  // Hintergrundfarbe = Median der vier Ecken (je ein 8x8-Feld), so wie man den Zauberstab ansetzt
  const proben = [];
  for (const [ox, oy] of [[0, 0], [w - 8, 0], [0, h - 8], [w - 8, h - 8]]) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = ((oy + y) * w + (ox + x)) * 4;
      if (data[i + 3] >= 128) proben.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (!proben.length) return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const med = (k) => { const v = proben.map(p => p[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const hr = med(0), hg = med(1), hb = med(2);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (Math.abs(data[i] - hr) <= tol && Math.abs(data[i + 1] - hg) <= tol && Math.abs(data[i + 2] - hb) <= tol) data[i + 3] = 0;
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}
// Die Lupe zeigt die Stelle, an der am meisten Kante ist - nicht irgendeine.
// Fassung 73: vorher wurde blind die erste Kante in einer Zeile bei 64 Prozent Hoehe genommen
// und 12 Prozent der Bildkante gezeigt (etwa vierfach). Das traf bei einem Emblem oft eine
// glatte Aussenkante, und der Schaden blieb unsichtbar. Jetzt: das Bild in Kacheln teilen, je
// Kachel die Uebergaenge deckend/durchsichtig zaehlen und die dichteste nehmen - dieselbe Regel
// fuer beide Seiten, also fair. Kachel 6 Prozent der kuerzeren Kante, das sind rund acht Mal.
async function lupe(pngBuffer, hintergrund, opts = {}) {
  const anteil = opts.anteil ?? 0.06;
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const a = (x, y) => data[(y * w + x) * 4 + 3];
  const g = Math.max(16, Math.round(Math.min(w, h) * anteil));
  const schritt = Math.max(8, Math.round(g / 2));
  let best = null;
  for (let top = 0; top + g <= h; top += schritt) {
    for (let left = 0; left + g <= w; left += schritt) {
      let kanten = 0, deckend = 0;
      for (let y = top; y < top + g; y += 2) {
        for (let x = left; x < left + g; x += 2) {
          const d = a(x, y) > 128;
          if (d) deckend++;
          if (x + 2 < left + g && d !== (a(x + 2, y) > 128)) kanten++;
          if (y + 2 < top + g && d !== (a(x, y + 2) > 128)) kanten++;
        }
      }
      // Kacheln, die fast ganz voll oder fast ganz leer sind, zeigen keine Kante
      const gesamt = Math.ceil(g / 2) * Math.ceil(g / 2);
      if (deckend < gesamt * 0.15 || deckend > gesamt * 0.85) continue;
      if (!best || kanten > best.kanten) best = { left, top, kanten };
    }
  }
  const left = best ? best.left : Math.max(0, Math.round((w - g) / 2));
  const top = best ? best.top : Math.max(0, Math.round((h - g) / 2));
  const stueck = await sharp(pngBuffer).extract({ left, top, width: g, height: g }).resize({ width: 480, height: 480, kernel: 'nearest' }).png().toBuffer();
  return sharp({ create: { width: 480, height: 480, channels: 4, background: hintergrund } }).composite([{ input: stueck }]).png().toBuffer();
}
// art: 'standard' | 'otto'. Liefert { a, b, lupe } als PNG-Puffer fuer die Webseite (max. 1200 px).
export async function vergleichAbleiten(art, rohBuffer) {
  const web = (buf) => sharp(buf).resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const a = await web(rohBuffer);
  let frei;
  if (art === 'otto') {
    // Das Vergleichswerkzeug fuer HOCHGELADENE Bilder zeigt, wie wir freistellen - das Verbot vom 6. Okt. gilt fuer Designs.
    frei = (await hatAlpha(rohBuffer)) ? (await motivFreistellen(rohBuffer, 'alpha')).png : await cutout(rohBuffer);
    frei = (await schwarzflaechenFreistellen(frei, { minDicke: 8 })).buffer;
  } else {
    frei = await naivFreistellen(rohBuffer);
  }
  const b = await web(frei);
  const l = await lupe(frei, { r: 24, g: 23, b: 30, alpha: 1 });
  return { a, b, lupe: l };
}

// ---------- Fassung 35: Logo-Preflight ----------
// Markus, 14. Sept.: ein Kunde lud ein 70 x 55 Pixel grosses Logo mit einem weissen Kasten
// darin hoch - und wunderte sich ueber das Shirt. "Wir muessen Preflight ueberlegen, der den
// Kunden sagt: Achtung, Logo nicht brauchbar." Genau das hier. Geprueft wird die Datei, wie sie
// spaeter gesetzt wuerde (nach freeLogo). Stufen: gut | maessig | unbrauchbar.
// scharfBisCm: bis zu welcher Druckbreite das Logo scharf bleibt (150 dpi als Untergrenze).
export async function logoPreflight(pngBuffer) {
  const gruende = [], hinweise = [];
  let stufe = 'gut';
  const schlechter = (s) => { if (s === 'unbrauchbar' || stufe === 'gut') stufe = s; };
  const m = await sharp(pngBuffer).metadata();
  const frei = await freeLogo(pngBuffer);
  const { data, info } = await sharp(frei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  // Nur der belegte Teil zaehlt fuer die Schaerfe - ein Logo mit viel Luft drumherum ist
  // nicht groesser, nur die Datei ist es.
  let minx = w, maxx = -1, miny = h, maxy = -1, deckend = 0, weich = 0, dunkel = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = data[i + 3];
    if (a > 20 && a < 235) weich++;
    if (a < 128) continue;
    deckend++;
    // schwarz oder sehr dunkel: auf dunklem Textil unsichtbar (Luminanz unter 60)
    if (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 60) dunkel++;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  const bw = maxx >= minx ? maxx - minx + 1 : w, bh = maxy >= miny ? maxy - miny + 1 : h;
  const lang = Math.max(bw, bh);
  const scharfBisCm = Math.round(bw / 59 * 10) / 10; // 150 dpi = 59 px je cm
  if (!deckend) { gruende.push('Auf dem Bild ist nichts zu erkennen (alles durchsichtig oder weiss).'); schlechter('unbrauchbar'); }
  else if (lang < 240) { gruende.push(`Nur ${bw} × ${bh} Pixel – auf dem Shirt wird das unscharf und pixelig.`); schlechter('unbrauchbar'); }
  else if (lang < 700) { gruende.push(`${bw} × ${bh} Pixel: scharf nur bis etwa ${scharfBisCm} cm Breite. Für Brust oder Rücken ist das zu wenig.`); schlechter('maessig'); }
  if (deckend && weich / deckend > 0.25) { gruende.push('Die Kanten sind weich oder unscharf (viele halbdurchsichtige Pixel).'); schlechter('maessig'); }

  // Weisser Kasten: eine deckende, fast weisse, rechteckige Flaeche, die ringsum an
  // Durchsichtiges grenzt - der klassische Rest eines misslungenen Freistellens.
  if (deckend) {
    const seen = new Uint8Array(w * h);
    const weiss = (p) => data[p * 4 + 3] >= 128 && data[p * 4] > 225 && data[p * 4 + 1] > 225 && data[p * 4 + 2] > 225;
    let kasten = 0;
    for (let s = 0; s < w * h; s++) {
      if (seen[s] || !weiss(s)) continue;
      const liste = [s]; seen[s] = 1;
      let k = 0, mx0 = w, mx1 = -1, my0 = h, my1 = -1;
      while (k < liste.length) {
        const p = liste[k++]; const x = p % w, y = (p - x) / w;
        if (x < mx0) mx0 = x; if (x > mx1) mx1 = x; if (y < my0) my0 = y; if (y > my1) my1 = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (weiss(q) && !seen[q]) { seen[q] = 1; liste.push(q); }
        }
      }
      const flaeche = liste.length, box = (mx1 - mx0 + 1) * (my1 - my0 + 1);
      // Aussenrand der Bounding-Box pruefen, nicht den Rand der Flaeche selbst: im Kasten steht
      // meist Schrift, deren Rand sonst alles verwaessert. Ausserhalb des Bildes gilt als durchsichtig.
      let aussen = 0, aussenFrei = 0;
      const pruef = (x, y) => { aussen++; if (x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] < 128) aussenFrei++; };
      for (let x = mx0 - 1; x <= mx1 + 1; x++) { pruef(x, my0 - 1); pruef(x, my1 + 1); }
      for (let y = my0; y <= my1; y++) { pruef(mx0 - 1, y); pruef(mx1 + 1, y); }
      if (flaeche >= w * h * 0.03 && flaeche / box >= 0.6 && aussen && aussenFrei / aussen >= 0.35) kasten++;
    }
    if (kasten) { gruende.push('Im Logo steckt ein weißer Kasten – ein Rest vom Freistellen. Der würde genau so mitgedruckt.'); schlechter('unbrauchbar'); }
  }
  if (stufe === 'gut') hinweise.push(`Scharf bis etwa ${scharfBisCm} cm Breite.`);
  // Freistehendes Dunkel: schwarze Pixel, die an Durchsichtiges grenzen und KEINE helle Nachbarschaft
  // haben - schwarze Schrift auf durchsichtigem Grund. Eine schwarze Kontur um eine helle Flaeche
  // zaehlt nicht (Motto-Otto-Logo: 35 % dunkel, aber alles Kontur um Creme und Gruen).
  let dunkelFrei = 0;
  try {
    const k = await sharp(frei).ensureAlpha().resize({ width: 480, fit: 'inside', withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
    const kw = k.info.width, kh = k.info.height, d = k.data;
    const lum = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let deck = 0;
    for (let y = 0; y < kh; y++) for (let x = 0; x < kw; x++) {
      const i = (y * kw + x) * 4; if (d[i + 3] < 128) continue;
      deck++;
      if (lum(i) >= 60) continue;
      let hell = false, leer = false;
      for (let dy = -3; dy <= 3 && !hell; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= kw || ny >= kh) { leer = true; continue; }
        const j = (ny * kw + nx) * 4;
        if (d[j + 3] < 128) { leer = true; continue; }
        if (lum(j) > 140) { hell = true; break; }
      }
      if (!hell && leer) dunkelFrei++;
    }
    dunkelFrei = deck ? Math.round(dunkelFrei / deck * 100) : 0;
  } catch (e) { dunkelFrei = 0; }
  return { stufe, brauchbar: stufe !== 'unbrauchbar', gruende, hinweise, breite: m.width, hoehe: m.height, motivBreite: bw, motivHoehe: bh, scharfBisCm, dunkelAnteil: deckend ? Math.round(dunkel / deckend * 100) : 0, dunkelFrei };
}

// ---------- Fassung 35: Kantenlupe fuer die Druckdatei ----------
// Markus: "Mache noch einmal einen Test, wo die Kante schoen scharf ist." Von aussen ist die
// Kante einer 4000-px-Datei nicht zu beurteilen. Diese Lupe schneidet drei Stellen am Rand des
// Motivs aus (oben, Mitte, unten - immer dort, wo Motiv auf Leere trifft), vergroessert sie
// sechsfach ohne Glaettung und legt sie einmal auf Weiss und einmal auf Schwarz. Ein weicher
// Saum, ein dunkler Ring oder Treppen sind so sofort zu sehen - im Backend und auf der Druckseite.
export async function kantenLupe(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const a = (x, y) => data[(y * w + x) * 4 + 3];
  const g = Math.max(40, Math.round(Math.min(w, h) * 0.05));
  const stellen = [];
  for (const yy of [0.3, 0.5, 0.7]) {
    const y = Math.floor(h * yy);
    let x0 = -1;
    for (let x = Math.floor(w / 2); x > 1; x--) { if ((a(x, y) > 128) !== (a(x - 1, y) > 128)) { x0 = x; break; } }
    if (x0 < 0) for (let x = Math.floor(w / 2); x < w - 1; x++) { if ((a(x, y) > 128) !== (a(x + 1, y) > 128)) { x0 = x; break; } }
    if (x0 < 0) continue;
    stellen.push({ left: Math.max(0, Math.min(w - g, x0 - Math.floor(g / 2))), top: Math.max(0, Math.min(h - g, y - Math.floor(g / 2))), width: g, height: g });
  }
  if (!stellen.length) stellen.push({ left: Math.floor(w / 2 - g / 2), top: Math.floor(h / 2 - g / 2), width: g, height: g });
  const kachel = 300, luft = 8;
  const teile = [];
  for (let i = 0; i < stellen.length; i++) {
    const stueck = await sharp(pngBuffer).extract(stellen[i]).resize({ width: kachel, height: kachel, kernel: 'nearest' }).png().toBuffer();
    for (let r = 0; r < 2; r++) {
      const bg = r === 0 ? { r: 255, g: 255, b: 255 } : { r: 20, g: 20, b: 22 };
      teile.push({ input: await sharp({ create: { width: kachel, height: kachel, channels: 3, background: bg } }).composite([{ input: stueck }]).png().toBuffer(), left: i * (kachel + luft), top: r * (kachel + luft) });
    }
  }
  const W = stellen.length * (kachel + luft) - luft, H = 2 * (kachel + luft) - luft;
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 } } }).composite(teile).png().toBuffer();
}

// ---------- Fassung 37: Logo als Vorlage - das Modell baut das Design UM das echte Logo ----------
// Markus, 14. Sept.: "Das Logo muss eingebunden sein und nicht einfach ein Loch gemacht und dann
// Logo rein." Bisher bekam das Modell nur eine Beschreibung (Form, Farben) und liess eine leere
// Flaeche; das Logo kam danach hinein - mit Luft, Ring, versetzt. Jetzt bekommt das Modell das Logo
// als BILD, schon an seinem Platz und in seiner Groesse (logoVorlage). Es zeichnet alles drumherum.
// Danach suchen wir seine Kopie des Logos (logoFinden), loeschen sie (logoLoeschen) und setzen das
// scharfe Original exakt dorthin (placeLogo mit fein.treffer).

// Logo ohne durchsichtigen Rand - Exporte haben fast immer Luft drumherum, und die verschiebt jede
// Platzierung nach oben links (die Cybernetics-Datei sass deshalb in der Kopfzeile).
export async function logoTrimmen(logoBuffer) {
  try {
    const t = await sharp(logoBuffer).ensureAlpha().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 }).png().toBuffer();
    const m = await sharp(t).metadata();
    return m.width >= 8 && m.height >= 8 ? t : logoBuffer;
  } catch (e) { return logoBuffer; }
}

// Vorlage fuer die Bildbearbeitung: leere (durchsichtige) Leinwand in Generatorgroesse, das Logo
// sitzt dort, wo es im fertigen Design stehen soll. Liefert auch die Sollposition (Pixel).
export async function logoVorlage(logoBuffer, size, place, widthPct, opts = {}) {
  const [W, H] = String(size).split('x').map(Number);
  const logo = await logoTrimmen(await freeLogo(logoBuffer));
  const lm = await sharp(logo).metadata();
  const pct = Math.min(Math.max(+widthPct || 38, 8), 90) / 100;
  let breite = Math.round(W * pct);
  const ratio = lm.height / lm.width;
  if (breite * ratio > H * 0.55) breite = Math.round(H * 0.55 / ratio);
  const hoehe = Math.round(breite * ratio);
  // Fassung 45: waagerechte Lage darf wechseln, damit nicht jedes Design gleich aussieht.
  // Mittig bleibt mittig (Brustdruck), links/rechts halten 8 Prozent Rand zur Leinwand.
  const lagen = { links: 0.34, mitte: 0.5, rechts: 0.66 };
  let anteilX = lagen[opts.lage] != null ? lagen[opts.lage] : 0.5;
  const halb = breite / 2 / W + 0.08;
  anteilX = Math.min(Math.max(anteilX, halb), 1 - halb);
  const cx = Math.round(W * anteilX);
  const cy = place === 'oben' ? Math.round(H * 0.22) : place === 'unten' ? Math.round(H * 0.78) : Math.round(H * 0.47);
  let klein = await sharp(logo).resize({ width: breite, height: hoehe, fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  // Fassung 41, Platzhalter statt echtem Logo: Ein Bildmodell kann keinen Bereich unveraendert
  // durchreichen - es malt IMMER alles neu, also auch ein mitgeliefertes Logo (Markus, 15. Sept.:
  // "Das Logo in der Vorschau sieht gut aus, warum wird daraus Muell?"). Darum bekommt es die
  // Silhouette des Logos in einer Signalfarbe. Die Form stimmt also weiter, das Design waechst um
  // die echte Kontur - aber verschmiert das Modell sie, bleibt es Signalfarbe und laesst sich
  // hinterher zweifelsfrei ausstanzen. Kein Suchen, kein Raten, keine Geisterschrift.
  let farbe = null;
  if (opts.platzhalter) {
    farbe = await platzhalterFarbe(logo, { ohneGruen: !!opts.ohneGruen });
    // Fassung 44 (Safety team 2029): Die Silhouette des Logos als Platzhalter war ein Fehler. Das
    // Modell ERKENNT darin ein Logo und malt es nach - im Ergebnis stand der Schriftzug zweimal
    // als Geist neben dem echten Logo. Es darf die Form des Logos also gar nicht erst sehen.
    // Der Platzhalter ist jetzt eine neutrale Flaeche in Logogroesse: nichts zum Nachmalen.
    klein = await platzhalterForm(logo, breite, hoehe, farbe.hex);
  }
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: klein, left: Math.round(cx - breite / 2), top: Math.round(cy - hoehe / 2) }]).png().toBuffer();
  return { png, erwartet: { cx, cy, breite, hoehe }, logo, platzhalter: !!opts.platzhalter, farbe, lage: opts.lage || 'mitte' };
}

// Fassung 48: Logo INTEGRIERT, ohne dass es je durch den Bilddienst laeuft.
// Der Denkfehler der letzten Fassungen war, dem Modell eine Flaeche freihalten zu wollen und
// hinterher zu reparieren. Es geht andersherum: das Modell zeichnet ein vollstaendiges, schoenes
// Motiv (ohne jede Logo-Absicht), und DANACH suchen wir darin die ruhigste Stelle und setzen das
// Logo dort hinein - mitten im Motiv, ringsum von Motiv umgeben, mit einem schmalen Saum, damit
// es sauber liest. Nichts wird nachgemalt, nichts geraten, nichts geloescht ausser dem Saum.
// Gesucht wird die Stelle, die (a) gut vom Motiv gedeckt ist - sonst schwebt das Logo im Leeren -
// und (b) wenig Struktur hat, damit kein Gesicht und keine Schrift zugedeckt wird.
// Wie viel Motiv steht in einem bestimmten Fenster? 0 = voellig frei, 1 = ganz zugemalt.
// Damit wird nach der Generierung geprueft, ob die bestellte Flaeche wirklich frei geblieben ist.
export async function flaecheBelegt(artBuffer, mx, my, breiteAnteil, hoeheAnteil) {
  const { data, info } = await sharp(artBuffer).ensureAlpha().resize({ width: 320, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const bw = Math.max(4, Math.round(W * breiteAnteil)), bh = Math.max(4, Math.round(H * hoeheAnteil));
  const x0 = Math.max(0, Math.round(mx * W - bw / 2)), y0 = Math.max(0, Math.round(my * H - bh / 2));
  const x1 = Math.min(W - 1, x0 + bw - 1), y1 = Math.min(H - 1, y0 + bh - 1);
  let n = 0, voll = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { n++; if (data[(y * W + x) * 4 + 3] >= 128) voll++; }
  return n ? voll / n : 1;
}

// Fassung 54 (Markus, 16. Sept.): Platz fuer TEXT im fertigen Motiv - zum Beispiel der Ruecken
// eines Shirts, auf das der Name gedruckt wird. Gesucht wird eine Flaeche im gewuenschten
// Seitenverhaeltnis, die gut gedeckt, sehr ruhig (keine Gesichter, keine Schrift) und moeglichst
// einfarbig ist. Zurueck kommen Lage, Groesse und die mittlere Helligkeit - daraus waehlt der
// Aufrufer die Schriftfarbe.
export async function platzFuerText(artBuffer, ratio, opts = {}) {
  const am = await sharp(artBuffer).metadata();
  const W = am.width, H = am.height;
  const AW = 320, f = AW / W, AH = Math.max(8, Math.round(H * f));
  const roh = await sharp(artBuffer).ensureAlpha().resize({ width: AW, height: AH, fit: 'fill' }).raw().toBuffer();
  const kanten = kantenMaske(roh, AW, AH, 40);
  const N1 = (AW + 1) * (AH + 1);
  const deck = new Float64Array(N1), kant = new Float64Array(N1), hell = new Float64Array(N1), hell2 = new Float64Array(N1);
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const i = y * AW + x;
    const d = roh[i * 4 + 3] >= 128 ? 1 : 0;
    const l = d ? 0.299 * roh[i * 4] + 0.587 * roh[i * 4 + 1] + 0.114 * roh[i * 4 + 2] : 0;
    const p = (y + 1) * (AW + 1) + (x + 1);
    deck[p] = d + deck[p - 1] + deck[p - (AW + 1)] - deck[p - (AW + 1) - 1];
    kant[p] = (kanten[i] ? 1 : 0) + kant[p - 1] + kant[p - (AW + 1)] - kant[p - (AW + 1) - 1];
    hell[p] = l + hell[p - 1] + hell[p - (AW + 1)] - hell[p - (AW + 1) - 1];
    hell2[p] = l * l + hell2[p - 1] + hell2[p - (AW + 1)] - hell2[p - (AW + 1) - 1];
  }
  const summe = (tab, x0, y0, x1, y1) => tab[(y1 + 1) * (AW + 1) + (x1 + 1)] - tab[y0 * (AW + 1) + (x1 + 1)] - tab[(y1 + 1) * (AW + 1) + x0] + tab[y0 * (AW + 1) + x0];
  const minBreite = opts.minBreite || 0.16;
  let best = null;
  // Fuer den Namen reichen 38 Prozent; der Logo-Traeger wird groesser bestellt und darf auch
  // groesser gefunden werden (opts.stufen), sonst bliebe das Logo klein auf einer grossen Plakette.
  for (const anteil of (opts.stufen || [0.38, 0.32, 0.26, 0.21, 0.17])) {
    const bw = Math.round(AW * anteil), bh = Math.max(6, Math.round(bw / ratio));
    if (anteil < minBreite) break;
    if (bw >= AW * 0.8 || bh >= AH * 0.5) continue;
    const schritt = Math.max(2, Math.round(AW / 110));
    for (let y0 = 1; y0 + bh < AH - 1; y0 += schritt) for (let x0 = 1; x0 + bw < AW - 1; x0 += schritt) {
      const x1 = x0 + bw - 1, y1 = y0 + bh - 1, flaeche = bw * bh;
      const gedeckt = summe(deck, x0, y0, x1, y1) / flaeche;
      if (gedeckt < 0.94) continue;                       // die Flaeche muss ganz bemalt sein
      const struktur = summe(kant, x0, y0, x1, y1) / flaeche;
      // Fassung 58: der bestellte Logo-Traeger hat im echten Bild eine leichte Koernung (Stil
      // "distressed") - dafuer etwas mehr Toleranz (opts.grob), fuer den Namen die strengen Werte.
      if (struktur > (opts.grob ? 0.035 : 0.02)) continue;   // ruhig: keine Gesichter, keine Schrift
      const mittel = summe(hell, x0, y0, x1, y1) / flaeche;
      const streu = Math.sqrt(Math.max(0, summe(hell2, x0, y0, x1, y1) / flaeche - mittel * mittel));
      if (streu > (opts.grob ? 34 : 26)) continue;            // moeglichst einfarbig
      const note = anteil * 2.2 - struktur * 12 - streu / 60 - Math.abs((x0 + bw / 2) / AW - 0.5) * 0.6;
      if (!best || note > best.note) best = { note, x0, y0, bw, bh, mittel, streu, struktur };
    }
  }
  if (!best) return { gefunden: false };
  return {
    gefunden: true,
    cx: Math.round((best.x0 + best.bw / 2) / f), cy: Math.round((best.y0 + best.bh / 2) / f),
    breite: Math.round(best.bw / f), hoehe: Math.round(best.bh / f),
    helligkeit: Math.round(best.mittel), streuung: Math.round(best.streu), struktur: Math.round(best.struktur * 1000) / 1000
  };
}

export async function logoPlatzSuchen(artBuffer, logoBuffer, place, widthPct, opts = {}) {
  const am = await sharp(artBuffer).metadata();
  const W = am.width, H = am.height;
  const logo = await logoTrimmen(await freeLogo(logoBuffer));
  const lm = await sharp(logo).metadata();
  const ratio = lm.height / lm.width;
  const pct = Math.min(Math.max(+widthPct || 34, 10), 60) / 100;
  const AW = 320, f = AW / W, AH = Math.max(8, Math.round(H * f));
  const roh = await sharp(artBuffer).ensureAlpha().resize({ width: AW, height: AH, fit: 'fill' }).raw().toBuffer();
  const deck = new Float64Array((AW + 1) * (AH + 1));
  const kant = new Float64Array((AW + 1) * (AH + 1));
  const hell = new Float64Array((AW + 1) * (AH + 1));
  const kanten = kantenMaske(roh, AW, AH, 45);
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const i = y * AW + x;
    const d = roh[i * 4 + 3] >= 128 ? 1 : 0;
    const k = kanten[i] ? 1 : 0;
    const l = d ? 0.299 * roh[i * 4] + 0.587 * roh[i * 4 + 1] + 0.114 * roh[i * 4 + 2] : 0;
    const p = (y + 1) * (AW + 1) + (x + 1);
    deck[p] = d + deck[p - 1] + deck[p - (AW + 1)] - deck[p - (AW + 1) - 1];
    kant[p] = k + kant[p - 1] + kant[p - (AW + 1)] - kant[p - (AW + 1) - 1];
    hell[p] = l + hell[p - 1] + hell[p - (AW + 1)] - hell[p - (AW + 1) - 1];
  }
  const summe = (tab, x0, y0, x1, y1) => {
    const a0 = Math.max(0, x0), b0 = Math.max(0, y0), a1 = Math.min(AW - 1, x1), b1 = Math.min(AH - 1, y1);
    if (a1 < a0 || b1 < b0) return 0;
    return tab[(b1 + 1) * (AW + 1) + (a1 + 1)] - tab[b0 * (AW + 1) + (a1 + 1)] - tab[(b1 + 1) * (AW + 1) + a0] + tab[b0 * (AW + 1) + a0];
  };
  let logoHell = 128;
  try {
    const lr = await sharp(logo).ensureAlpha().resize({ width: 120, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    let sum = 0, n = 0;
    for (let i = 0; i < lr.info.width * lr.info.height; i++) {
      if (lr.data[i * 4 + 3] < 128) continue;
      sum += 0.299 * lr.data[i * 4] + 0.587 * lr.data[i * 4 + 1] + 0.114 * lr.data[i * 4 + 2]; n++;
    }
    if (n) logoHell = sum / n;
  } catch (e) { /* Mittelwert bleibt */ }
  // Wunschlage: dort hat der Prompt die freie Flaeche bestellt. Wird sie nicht eingehalten,
  // zaehlt nur noch, wo es im fertigen Motiv wirklich am besten passt.
  const wunschX = opts.wunschX != null ? opts.wunschX : 0.5;
  const wunschY = opts.wunschY != null ? opts.wunschY : (place === 'oben' ? 0.30 : place === 'unten' ? 0.70 : 0.50);
  // Erst nachsehen, ob die BESTELLTE Flaeche wirklich frei geblieben ist. Wenn ja, gilt sie -
  // dann hat das Modell das Motiv genau darum herum gebaut, und das ist der ganze Sinn der Sache.
  let best = null;
  {
    const bw = Math.max(8, Math.round(AW * pct)), bh = Math.max(8, Math.round(bw * ratio));
    const rw = Math.round(bw * 0.5), rh = Math.round(bh * 0.5);
    let bester = null;
    const zx = Math.round(wunschX * AW), zy = Math.round(wunschY * AH);
    const spanne = Math.round(AW * 0.12), schritt = Math.max(2, Math.round(AW / 100));
    for (let cy = zy - spanne; cy <= zy + spanne; cy += schritt) for (let cx = zx - spanne; cx <= zx + spanne; cx += schritt) {
      const x0 = Math.round(cx - bw / 2), y0 = Math.round(cy - bh / 2), x1 = x0 + bw - 1, y1 = y0 + bh - 1;
      if (x0 < 1 || y0 < 1 || x1 >= AW - 1 || y1 >= AH - 1) continue;
      const flaeche = bw * bh;
      const innenDeck = summe(deck, x0, y0, x1, y1) / flaeche;
      if (innenDeck > 0.10) continue;                 // hier steht Motiv - nicht die bestellte Luecke
      const gross = (x1 + rw - (x0 - rw) + 1) * (y1 + rh - (y0 - rh) + 1);
      const ringDeck = (summe(deck, x0 - rw, y0 - rh, x1 + rw, y1 + rh) - summe(deck, x0, y0, x1, y1)) / Math.max(1, gross - flaeche);
      if (ringDeck < 0.58) continue;                  // Luecke muss vom Motiv umschlossen sein
      const note = ringDeck - innenDeck - (Math.abs(cx - zx) + Math.abs(cy - zy)) / AW * 0.5;
      if (!bester || note > bester.note) bester = { note, x0, y0, bw, bh, innenDeck, innenKant: summe(kant, x0, y0, x1, y1) / flaeche, ringDeck, skala: 1, kontrast: 1 };
    }
    if (bester) best = bester;
  }
  for (const skala of best ? [] : [1, 0.9, 0.8]) {
    const bw = Math.max(8, Math.round(AW * pct * skala)), bh = Math.max(8, Math.round(bw * ratio));
    if (bw >= AW * 0.95 || bh >= AH * 0.8) continue;
    const schritt = Math.max(2, Math.round(AW / 90));
    // Breiter Ring: er soll bis in die dichten Teile des Motivs reichen, damit eine frei
    // gelassene Flaeche am oberen Rand nicht faelschlich als "nicht eingerahmt" gilt.
    const rw = Math.round(bw * 0.5), rh = Math.round(bh * 0.5);
    for (let y0 = 1; y0 + bh < AH - 1; y0 += schritt) for (let x0 = 1; x0 + bw < AW - 1; x0 += schritt) {
      const x1 = x0 + bw - 1, y1 = y0 + bh - 1;
      const flaeche = bw * bh;
      const innenDeck = summe(deck, x0, y0, x1, y1) / flaeche;
      const innenKant = summe(kant, x0, y0, x1, y1) / flaeche;
      // Ring rundherum: wie gut ist die Stelle vom Motiv eingefasst?
      const gross = (x1 + rw - (x0 - rw) + 1) * (y1 + rh - (y0 - rh) + 1);
      const ringFlaeche = Math.max(1, gross - flaeche);
      const ringDeck = (summe(deck, x0 - rw, y0 - rh, x1 + rw, y1 + rh) - summe(deck, x0, y0, x1, y1)) / ringFlaeche;
      if (ringDeck < 0.55) continue;                 // muss vom Motiv eingerahmt sein, nicht am Rand kleben
      // NUR ein echtes Loch. Frueher galt auch eine "ruhige, gut gedeckte Flaeche" als Platz -
      // und genau das war der Fehler: die ruhigste Flaeche in einem Motiv ist die grosse
      // Schriftflaeche. Das Logo landete mitten im Schriftzug, der Saum stanzte ein Loch hinein,
      // und das Design war kaputt (Markus, 16. Sept.: "Nachtraeglich einsetzen kannst du nicht").
      // Es wird nichts mehr verdeckt: liegt etwas an der Stelle, ist es keine Stelle.
      if (innenDeck > 0.08) continue;
      const mx = (x0 + bw / 2) / AW, my = (y0 + bh / 2) / AH;
      const wunschWeg = Math.abs(mx - wunschX) * 1.4 + Math.abs(my - wunschY) * 1.2;
      const kontrast = 1;
      const note = ringDeck * 1.6 + (1 - innenKant * 6) * 0.6 + (1 - innenDeck) * 0.8
        - wunschWeg * 1.6 + (skala - 1) * 0.5;
      if (!best || note > best.note) best = { note, x0, y0, bw, bh, innenDeck, innenKant, ringDeck, skala, kontrast: Math.round(kontrast * 100) / 100 };
    }
  }
  if (!best) {
    const bw = Math.round(W * pct);
    return { cx: Math.round(W * wunschX), cy: Math.round(H * wunschY), breite: bw, hoehe: Math.round(bw * ratio), gedeckt: 0, struktur: 0, ring: 0, gefunden: false, score: 0, deckung: 0 };
  }
  return {
    cx: Math.round((best.x0 + best.bw / 2) / f), cy: Math.round((best.y0 + best.bh / 2) / f),
    breite: Math.round(best.bw / f), hoehe: Math.round(best.bh / f),
    gedeckt: Math.round(best.innenDeck * 100) / 100, struktur: Math.round(best.innenKant * 100) / 100,
    ring: Math.round(best.ringDeck * 100) / 100, kontrast: best.kontrast,
    loch: best.innenDeck < 0.2, gefunden: true, score: 1, deckung: 1
  };
}

// Fassung 47: Logo in eigener Zone - der Weg, der nicht schiefgehen kann.
// Das Bildmodell kann eine Flaeche nicht freihalten: es malt hinein, es malt das Logo nach, es
// schreibt den Firmennamen dort hin, es faerbt den Platzhalter um. Jede Reparatur danach (suchen,
// stanzen, fuellen) hat neue Fehler erzeugt - Loecher, Kaesten, rosa Schrift (Markus, 15. Sept.).
// Darum: das Motiv wird OHNE jede Logo-Absicht gezeichnet, danach verkleinert und das Original-
// Logo in das frei gewordene Band gesetzt. Nichts zu suchen, nichts zu loeschen, nichts zu raten.
export async function logoZoneLegen(artBuffer, logoBuffer, place, widthPct, opts = {}) {
  const am = await sharp(artBuffer).metadata();
  const W = am.width, H = am.height;
  const logo = await logoTrimmen(await freeLogo(logoBuffer));
  const lm = await sharp(logo).metadata();
  const ratio = lm.height / lm.width;
  const pct = Math.min(Math.max(+widthPct || 34, 10), 60) / 100;
  let breite = Math.round(W * pct);
  let hoehe = Math.round(breite * ratio);
  const luft = Math.round(H * 0.03);                  // Abstand Logo <-> Motiv
  // Das Band darf dem Motiv nicht den Platz nehmen: hoechstens ein Drittel der Hoehe. Passt das
  // Logo in dieser Breite nicht hinein, wird es schmaler gerechnet statt das Motiv zu quetschen.
  const bandMax = Math.round(H * 0.32);
  let band = Math.min(bandMax, hoehe + 2 * luft);
  if (hoehe + 2 * luft > band) { hoehe = band - 2 * luft; breite = Math.round(hoehe / ratio); }
  const oben = place !== 'unten';                      // Standard: Logo oben, Motiv darunter
  // Motiv auf die verbleibende Hoehe bringen (Seitenverhaeltnis bleibt), waagerecht mittig
  const restH = H - band;
  const klein = await sharp(artBuffer).ensureAlpha().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize({ width: W, height: restH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const km = await sharp(klein).metadata();
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: klein, left: Math.round((W - km.width) / 2), top: oben ? band + Math.round((restH - km.height) / 2) : Math.round((restH - km.height) / 2) }])
    .png().toBuffer();
  const cy = oben ? Math.round(band / 2) : Math.round(H - band / 2);
  return { png, treffer: { cx: Math.round(W / 2), cy, breite, hoehe, gefunden: true, score: 1, deckung: 1 }, band, oben };
}

// Fassung 45: Saum um das Logo. Die Logoform, um `prozent` der Logobreite aufgeweitet, wird aus
// dem Motiv gestanzt, BEVOR das Logo hineinkommt. Damit ist ausgeschlossen, dass unter oder neben
// dem Logo noch etwas Gemaltes steht - egal was das Modell in die reservierte Flaeche gemalt hat.
// In der Luecke zeigt sich das Textil (Markus, 15. Sept.: "Wir starten mit 4 %").
// Wie duenn sind die feinsten tragenden Striche des Logos (in Pixeln der Zielgroesse)?
// Abstand jedes deckenden Pixels zum naechsten durchsichtigen, davon ein unteres Perzentil mal
// zwei. Daran haengt der Saum: er muss schmaler sein als ein halber Buchstabenstrich.
async function strichStaerke(logoBuffer, w, h) {
  try {
    const B = Math.min(300, Math.max(60, w));
    const { data, info } = await sharp(logoBuffer).ensureAlpha().resize({ width: B, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, N = W * H;
    const d = new Float32Array(N).fill(1e9);
    for (let i = 0; i < N; i++) if (data[i * 4 + 3] < 128) d[i] = 0;
    const relax = (a, b, s2) => { if (d[b] + s2 < d[a]) d[a] = d[b] + s2; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = y * W + x; if (x > 0) relax(a, a - 1, 1); if (y > 0) { relax(a, a - W, 1); if (x > 0) relax(a, a - W - 1, 1.4); if (x < W - 1) relax(a, a - W + 1, 1.4); } }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const a = y * W + x; if (x < W - 1) relax(a, a + 1, 1); if (y < H - 1) { relax(a, a + W, 1); if (x < W - 1) relax(a, a + W + 1, 1.4); if (x > 0) relax(a, a + W - 1, 1.4); } }
    const werte = [];
    for (let i = 0; i < N; i++) if (data[i * 4 + 3] >= 128 && d[i] < 1e8) werte.push(d[i]);
    if (!werte.length) return Math.max(3, w * 0.01);
    werte.sort((a, b) => a - b);
    // Das 30. Perzentil, nicht das 80.: massgeblich sind die DUENNSTEN tragenden Striche
    // (die Buchstaben), nicht der dicke Ring. Sonst frisst der Saum die Schrift zusammen.
    const p30 = werte[Math.floor(werte.length * 0.3)];
    return Math.max(2, p30 * 2 * (w / W));   // auf Zielgroesse umrechnen
  } catch (e) { return Math.max(3, w * 0.01); }
}

export async function logoSaumStanzen(artBuffer, logoBuffer, treffer, prozent = 4) {
  if (!(prozent > 0) || !treffer || !(treffer.breite > 0)) return artBuffer;
  const am = await sharp(artBuffer).metadata();
  const lm = await sharp(logoBuffer).metadata();
  const w = Math.max(8, Math.round(treffer.breite)), h = Math.max(8, Math.round(w * lm.height / lm.width));
  // Fassung 49 (Markus, 15. Sept., schwarzer Kasten um das Logo im Druck): Der Saum darf sich
  // NICHT nach der Logobreite richten. 4 Prozent von 600 px sind 24 px - damit wachsen die
  // Buchstaben zu einem Block zusammen und aus dem Saum wird ein Kasten. Massgeblich ist die
  // Strichstaerke des Logos: der Saum bleibt schmaler als ein halber Strich, dann bleibt jeder
  // Zwischenraum offen. Die Prozentangabe ist nur noch die Obergrenze.
  const strich = await strichStaerke(logoBuffer, w, h);
  const randWunsch = Math.round(w * prozent / 100);
  const rand = Math.max(2, Math.min(randWunsch, Math.round(strich * 0.45)));
  const roh = await sharp(logoBuffer).ensureAlpha().resize({ width: w, height: h, fit: 'fill' })
    .extend({ top: rand * 2, bottom: rand * 2, left: rand * 2, right: rand * 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  const cw = roh.info.width, ch = roh.info.height, ka = roh.info.channels;
  // Harte Dilatation ueber zwei Durchlaeufe (erst Zeilen, dann Spalten) - eine weiche Maske
  // wuerde halbdurchsichtige Pixel hinterlassen, und die drucken als Schleier.
  const a0 = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) a0[i] = roh.data[i * ka + (ka - 1)] >= 128 ? 1 : 0;
  const a1 = new Uint8Array(cw * ch), a2 = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { let v = 0; for (let d = -rand; d <= rand && !v; d++) { const xx = x + d; if (xx >= 0 && xx < cw && a0[y * cw + xx]) v = 1; } a1[y * cw + x] = v; }
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { let v = 0; for (let d = -rand; d <= rand && !v; d++) { const yy = y + d; if (yy >= 0 && yy < ch && a1[yy * cw + x]) v = 1; } a2[y * cw + x] = v; }
  const maske = Buffer.alloc(cw * ch);
  for (let i = 0; i < cw * ch; i++) maske[i] = a2[i] ? 255 : 0;
  const schwarz = await sharp({ create: { width: cw, height: ch, channels: 3, background: '#000' } }).raw().toBuffer();
  const stanzer = await sharp(schwarz, { raw: { width: cw, height: ch, channels: 3 } })
    .joinChannel(maske, { raw: { width: cw, height: ch, channels: 1 } }).png().toBuffer();
  const left = Math.round(treffer.cx - cw / 2), top = Math.round(treffer.cy - ch / 2);
  const l = Math.max(0, left), t = Math.max(0, top);
  const r = Math.min(am.width, left + cw), b = Math.min(am.height, top + ch);
  if (r <= l || b <= t) return artBuffer;
  const stueck = await sharp(stanzer).extract({ left: l - left, top: t - top, width: r - l, height: b - t }).png().toBuffer();
  return sharp(artBuffer).ensureAlpha().composite([{ input: stueck, left: l, top: t, blend: 'dest-out' }]).png().toBuffer();
}

// Wie hell ist ein Logo im Mittel (0 dunkel .. 255 hell)? Entscheidet, welche Farbe die Traeger-
// flaeche bekommt: dunkles Logo auf heller Plakette, helles Logo auf dunkler.
export async function logoHelligkeit(logoBuffer) {
  const { data, info } = await sharp(logoBuffer).ensureAlpha().resize({ width: 160, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let n = 0, sum = 0;
  for (let p = 0; p < info.width * info.height; p++) {
    if (data[p * 4 + 3] < 128) continue;
    n++; sum += 0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2];
  }
  return n ? Math.round(sum / n) : 128;
}

// Fassung 60 (Markus, 16. Sept.: "Die Flaeche muss in Form des Logos sein"): Die Plakette wird in der
// Umrissform des Logos bestellt. Beim Einsetzen reicht dann das ruhige Rechteck (platzFuerText) nicht -
// es ist nur das Quadrat IN der Form. Von seiner Mitte aus wird die ganze einfarbige Plakette
// geflutet; ihr Kasten (abzueglich Saum) ist der Platz des Logos. So fuellt ein Wappen sein
// Wappenschild und ein rundes Logo sein Medaillon - bis auf den Saum.
export async function traegerBlob(artBuffer, pl) {
  const am = await sharp(artBuffer).metadata();
  const W = am.width, H = am.height;
  const AW = 400, f = AW / W, AH = Math.max(8, Math.round(H * f));
  const roh = await sharp(artBuffer).ensureAlpha().resize({ width: AW, height: AH, fit: 'fill' }).raw().toBuffer();
  const sx = Math.round(pl.cx * f), sy = Math.round(pl.cy * f);
  const px = (i) => [roh[i * 4], roh[i * 4 + 1], roh[i * 4 + 2], roh[i * 4 + 3]];
  // Bezugsfarbe: Mittel ueber ein kleines Fenster um die Mitte
  let r0 = 0, g0 = 0, b0 = 0, n0 = 0;
  for (let y = sy - 3; y <= sy + 3; y++) for (let x = sx - 3; x <= sx + 3; x++) {
    if (x < 0 || y < 0 || x >= AW || y >= AH) continue; const [r, g, b, a] = px(y * AW + x); if (a < 128) continue; r0 += r; g0 += g; b0 += b; n0++;
  }
  if (!n0) return null;
  r0 /= n0; g0 /= n0; b0 /= n0;
  const nah = (i) => { const [r, g, b, a] = px(i); return a >= 128 && Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0) < 96; };
  const seen = new Uint8Array(AW * AH); const stack = [sy * AW + sx]; seen[sy * AW + sx] = 1;
  const drin = new Uint8Array(AW * AH);
  let x0 = sx, x1 = sx, y0 = sy, y1 = sy, flaeche = 0;
  while (stack.length) {
    const i = stack.pop(); if (!nah(i)) continue;
    flaeche++; drin[i] = 1; const x = i % AW, y = (i - x) / AW;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (x > 0 && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
    if (x < AW - 1 && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !seen[i - AW]) { seen[i - AW] = 1; stack.push(i - AW); }
    if (y < AH - 1 && !seen[i + AW]) { seen[i + AW] = 1; stack.push(i + AW); }
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const fuellung = flaeche / Math.max(1, bw * bh);
  // Plausibel: kompakt (kein Ausfluss ueber die halbe Leinwand) und ordentlich gefuellt
  if (bw > AW * 0.9 || bh > AH * 0.8 || fuellung < 0.45) return null;
  return { cx: Math.round((x0 + bw / 2) / f), cy: Math.round((y0 + bh / 2) / f), breite: Math.round(bw / f), hoehe: Math.round(bh / f), fuellung: Math.round(fuellung * 100) / 100, maske: drin, AW, AH, f };
}

// Passt das Logo in dieser Breite in die geflutete Plakette? Anteil der deckenden Logo-Pixel, die
// auf Plakettenpixeln liegen (1 = ganz drin). Damit ragt ein Wappen nie ueber eine runde Scheibe.
export async function logoInBlob(blob, logoBuffer, cx, cy, breite) {
  const lm = await sharp(logoBuffer).metadata();
  const bw = Math.max(4, Math.round(breite * blob.f)), bh = Math.max(4, Math.round(bw * lm.height / lm.width));
  const { data, info } = await sharp(logoBuffer).ensureAlpha().resize({ width: bw, height: bh, fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const left = Math.round(cx * blob.f - bw / 2), top = Math.round(cy * blob.f - bh / 2);
  let n = 0, drin = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] < 128) continue;
    n++; const X = left + x, Y = top + y;
    if (X >= 0 && Y >= 0 && X < blob.AW && Y < blob.AH && blob.maske[Y * blob.AW + X]) drin++;
  }
  return n ? drin / n : 0;
}

// Fassung 60 (Markus, 16. Sept.: "den Umriss eines Logos erkennen, eine Plakette daraus machen, die
// 4 % groesser ist als das Logo, und dann das Logo reinsetzen - nicht ein rechteckiges Schild um ein
// abgerundetes Logo"). Das Modell haelt sich nicht an die bestellte Umrissform. Also wird seine
// Plakette (der geflutete Blob) GELOESCHT und durch eine eigene ersetzt: die Silhouette des Logos,
// Loecher geschlossen, ringsum um 'saum' Prozent der Logobreite vergroessert, in Plakettenfarbe mit
// schmaler dunkler Kontur. Das Logo selbst setzt makeMaster danach mittig darauf (treffer).
// Rueckgabe: das Motiv mit neuer Plakette und der Treffer fuer das Logo.
export async function logoPlakette(artBuffer, logoBuffer, blob, opts = {}) {
  const am = await sharp(artBuffer).metadata();
  const W = am.width, H = am.height;
  const saum = Math.min(12, Math.max(1, Number(opts.saum) || 4));
  const lm = await sharp(logoBuffer).metadata();
  const aspect = lm.width / lm.height;
  // Logobreite: so gross, dass Logo plus Saum plus Kontur den Blob nicht sprengt
  const zug = 1 + 2 * (saum / 100) + 0.03;
  const breite = Math.max(8, Math.round(Math.min(blob.breite / zug, blob.hoehe * aspect / zug)));
  const hoehe = Math.max(8, Math.round(breite / aspect));
  const cx = blob.cx, cy = blob.cy;

  // 1) Die Modell-Plakette loeschen: Blobmaske (AW x AH) etwas erweitern, damit auch ihre Kontur
  //    weggeht, auf Motivgroesse bringen und hart schwellen (kein Schleier).
  {
    const AW = blob.AW, AH = blob.AH;
    const r = Math.max(1, Math.round(blob.breite * blob.f * 0.025));
    const a1 = new Uint8Array(AW * AH), a2 = new Uint8Array(AW * AH);
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { let v = 0; for (let d = -r; d <= r && !v; d++) { const xx = x + d; if (xx >= 0 && xx < AW && blob.maske[y * AW + xx]) v = 1; } a1[y * AW + x] = v; }
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) { let v = 0; for (let d = -r; d <= r && !v; d++) { const yy = y + d; if (yy >= 0 && yy < AH && a1[yy * AW + x]) v = 1; } a2[y * AW + x] = v; }
    const klein = Buffer.alloc(AW * AH); for (let i = 0; i < AW * AH; i++) klein[i] = a2[i] ? 255 : 0;
    const gross = await sharp(klein, { raw: { width: AW, height: AH, channels: 1 } }).resize({ width: W, height: H, fit: 'fill' }).threshold(128).raw().toBuffer();
    const schwarz = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).raw().toBuffer();
    const stanzer = await sharp(schwarz, { raw: { width: W, height: H, channels: 3 } }).joinChannel(gross, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
    artBuffer = await sharp(artBuffer).ensureAlpha().composite([{ input: stanzer, blend: 'dest-out' }]).png().toBuffer();
  }

  // 2) Die eigene Plakette: Silhouette des Logos, von aussen geflutet (Loecher zu), um den Saum
  //    erweitert; darunter dieselbe Form noch einmal um die Kontur erweitert in dunklerer Farbe.
  const rand = Math.max(2, Math.round(breite * saum / 100));
  const kontur = Math.max(1, Math.round(breite * 0.012));
  const pad = rand + kontur + 2;
  const roh = await sharp(logoBuffer).ensureAlpha().resize({ width: breite, height: hoehe, fit: 'fill' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  const cw = roh.info.width, ch = roh.info.height, ka = roh.info.channels;
  const a0 = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) a0[i] = roh.data[i * ka + (ka - 1)] >= 96 ? 1 : 0;
  // Loecher schliessen: alles, was vom Rand aus nicht erreichbar ist, gehoert zur Silhouette
  {
    const besucht = new Uint8Array(cw * ch), stapel = new Int32Array(cw * ch); let sp = 0;
    const push = (p) => { if (!besucht[p] && !a0[p]) { besucht[p] = 1; stapel[sp++] = p; } };
    for (let x = 0; x < cw; x++) { push(x); push((ch - 1) * cw + x); }
    for (let y = 0; y < ch; y++) { push(y * cw); push(y * cw + cw - 1); }
    while (sp) { const p = stapel[--sp], x = p % cw, y = (p - x) / cw;
      if (x > 0) push(p - 1); if (x < cw - 1) push(p + 1); if (y > 0) push(p - cw); if (y < ch - 1) push(p + cw); }
    for (let p = 0; p < cw * ch; p++) if (!a0[p] && !besucht[p]) a0[p] = 1;
  }
  // Runde Dilatation (Kreis-Scheibe), damit Ecken weich bleiben statt kantig
  const dilat = (src, r) => {
    const out = new Uint8Array(cw * ch);
    const off = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) off.push([dx, dy]);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      if (!src[y * cw + x]) continue;
      for (const [dx, dy] of off) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < cw && Y < ch) out[Y * cw + X] = 1; }
    }
    return out;
  };
  const innen = dilat(a0, rand), aussen = dilat(innen, kontur);
  const hex = (s) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(s || '')); const v = m ? parseInt(m[1], 16) : 0xf4ead2; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const [fr, fg, fb] = hex(opts.farbe || '#f4ead2');
  const [kr, kg, kb] = hex(opts.kontur || (opts.farbe && /^#?[0-3]/i.test(String(opts.farbe).replace('#', '')) ? '#f4ead2' : '#1b2a3a'));
  const pix = Buffer.alloc(cw * ch * 4);
  for (let p = 0; p < cw * ch; p++) {
    if (innen[p]) { pix[p * 4] = fr; pix[p * 4 + 1] = fg; pix[p * 4 + 2] = fb; pix[p * 4 + 3] = 255; }
    else if (aussen[p]) { pix[p * 4] = kr; pix[p * 4 + 1] = kg; pix[p * 4 + 2] = kb; pix[p * 4 + 3] = 255; }
  }
  const plakette = await sharp(pix, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer();
  const left = Math.round(cx - cw / 2), top = Math.round(cy - ch / 2);
  const l = Math.max(0, left), t = Math.max(0, top), r2 = Math.min(W, left + cw), b2 = Math.min(H, top + ch);
  if (r2 <= l || b2 <= t) return { png: artBuffer, treffer: { cx, cy, breite, hoehe }, plakette: null };
  const stueck = await sharp(plakette).extract({ left: l - left, top: t - top, width: r2 - l, height: b2 - t }).png().toBuffer();
  const png = await sharp(artBuffer).ensureAlpha().composite([{ input: stueck, left: l, top: t }]).png().toBuffer();
  return { png, treffer: { cx, cy, breite, hoehe }, plakette: { breite: cw, hoehe: ch, saum: rand, kontur } };
}

// Fassung 55: DAS LOGO IST DIE GRUNDLAGE (Markus, 16. Sept.: "Du musst das so prompten, dass die
// Grundlage das Logo ist und der Rest aussen rum passiert"). Das Modell bekommt eine Leinwand, auf
// der das echte Logo schon an seinem Platz liegt, UND eine Maske, die genau diese Stelle (Logo
// plus Saum) sperrt. Wo die Maske deckt, darf das Modell nicht malen - das ist eine Eigenschaft
// der Edit-API, kein Wunsch im Prompt. Also: kein Suchen, kein Nachzeichnen, kein Einsetzen.
// Das Design entsteht um das Logo herum, und am Ende liegt an derselben Stelle das Original.
// Die Lage variiert (opts.x/opts.y aus FREI_LAGEN), damit jedes Stueck ein Unikat ist.
export async function logoGrundlage(logoBuffer, size, place, widthPct, opts = {}) {
  const [W, H] = String(size).split('x').map(Number);
  const logo = await logoTrimmen(await freeLogo(logoBuffer));
  const lm = await sharp(logo).metadata();
  const pct = Math.min(Math.max(+widthPct || 34, 8), 80) / 100;
  let breite = Math.round(W * pct);
  const ratio = lm.height / lm.width;
  if (breite * ratio > H * 0.5) breite = Math.round(H * 0.5 / ratio);
  const hoehe = Math.round(breite * ratio);
  // Rand zur Leinwand: das Logo klebt nie an der Kante, sonst hat das Motiv dort keinen Platz mehr
  const halbX = breite / 2 / W + 0.07, halbY = hoehe / 2 / H + 0.07;
  const ax = Math.min(Math.max(opts.x != null ? +opts.x : 0.5, halbX), 1 - halbX);
  const ay = Math.min(Math.max(opts.y != null ? +opts.y : (place === 'oben' ? 0.28 : place === 'unten' ? 0.70 : 0.47), halbY), 1 - halbY);
  const cx = Math.round(W * ax), cy = Math.round(H * ay);
  const klein = await sharp(logo).resize({ width: breite, height: hoehe, fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: klein, left: Math.round(cx - breite / 2), top: Math.round(cy - hoehe / 2) }]).png().toBuffer();
  const erwartet = { cx, cy, breite, hoehe };
  const maske = await logoMaske(logo, W, H, erwartet, opts.saum);
  return { png, maske, erwartet, logo, lage: opts.lage || '' };
}

// Die Maske fuer die Edit-API: deckend (Alpha 255) an Logo plus Saum, durchsichtig ueberall
// sonst. Der Saum ist DERSELBE wie beim spaeteren Stanzen (logoSaumStanzen) - die Stelle, die
// das Modell nicht anfassen durfte, wird hinterher geleert und bekommt das Original. Dadurch
// passt beides pixelgenau zusammen, und vom Modell bleibt an der Logostelle nichts uebrig.
export async function logoMaske(logoBuffer, W, H, erwartet, saumProzent) {
  const saum = Math.max(2, Number(saumProzent) || 0);
  const weiss = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
  // Stanzen liefert: Alpha 0 an Logo+Saum, 255 sonst - genau umgekehrt zu dem, was die API will
  const gestanzt = await logoSaumStanzen(weiss, logoBuffer, erwartet, saum);
  const alpha = await sharp(gestanzt).ensureAlpha().extractChannel(3).negate().raw().toBuffer();
  // Loecher IM Logo (Ringinneres, Buchstabeninneres) gehoeren zum Logo: dort darf das Modell auch
  // nicht malen, sonst steht Motiv zwischen Ring und Schrift. Alles, was vom Leinwandrand aus
  // nicht erreichbar ist, wird zugesperrt (Flutfuellung von aussen).
  {
    const n = W * H, besucht = new Uint8Array(n), stapel = new Int32Array(n); let sp = 0;
    const push = (p) => { if (!besucht[p] && alpha[p] < 128) { besucht[p] = 1; stapel[sp++] = p; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (sp) { const p = stapel[--sp], x = p % W, y = (p - x) / W;
      if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (y > 0) push(p - W); if (y < H - 1) push(p + W); }
    for (let p = 0; p < n; p++) if (alpha[p] < 128 && !besucht[p]) alpha[p] = 255;
  }
  const schwarz = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).raw().toBuffer();
  return sharp(schwarz, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
}

// Die Huellform eines Logos: konvexe Huelle seiner deckenden Pixel, als Polygon. Das ist die
// Flaeche, die das Logo wirklich braucht - ohne Ring, ohne Schrift, ohne ein einziges Merkmal,
// das ein Bildmodell nachmalen koennte. Fassung 44 (Safety team 2029: der Schriftzug stand
// dreimal im Bild, weil das Modell die Logoform als Vorlage genommen hat).
async function huellPunkte(logoBuffer) {
  const B = 160;
  const { data, info } = await sharp(logoBuffer).ensureAlpha().resize({ width: B, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const pts = [];
  for (let y = 0; y < H; y++) {
    let links = -1, rechts = -1;
    for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] >= 40) { if (links < 0) links = x; rechts = x; }
    if (links >= 0) { pts.push([links, y]); pts.push([rechts, y]); }
  }
  if (pts.length < 3) return { hull: [[0, 0], [W, 0], [W, H], [0, H]], W, H };
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const kreuz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const unten = [], oben = [];
  for (const q of pts) { while (unten.length >= 2 && kreuz(unten[unten.length - 2], unten[unten.length - 1], q) <= 0) unten.pop(); unten.push(q); }
  for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (oben.length >= 2 && kreuz(oben[oben.length - 2], oben[oben.length - 1], q) <= 0) oben.pop(); oben.push(q); }
  unten.pop(); oben.pop();
  return { hull: unten.concat(oben), W, H };
}
export async function platzhalterForm(logoBuffer, breite, hoehe, hex) {
  try {
    const { hull, W, H } = await huellPunkte(logoBuffer);
    const punkte = hull.map(q => (q[0] / W * breite).toFixed(1) + ',' + (q[1] / H * hoehe).toFixed(1)).join(' ');
    // Die Ecken der Huelle leicht abrunden (runder Linienabschluss), damit keine Zacken entstehen
    const dick = Math.max(2, Math.round(Math.min(breite, hoehe) * 0.02));
    return await sharp(Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${hoehe}">` +
      `<polygon points="${punkte}" fill="${hex}" stroke="${hex}" stroke-width="${dick}" stroke-linejoin="round"/></svg>`
    )).png().toBuffer();
  } catch (e) {
    const r = Math.round(Math.min(breite, hoehe) * 0.12);
    return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${hoehe}"><rect x="0" y="0" width="${breite}" height="${hoehe}" rx="${r}" ry="${r}" fill="${hex}"/></svg>`)).png().toBuffer();
  }
}

// Die Silhouette eines Logos in Signalfarbe - fuer Korrekturen, wo der Platzhalter nicht auf eine
// leere Leinwand, sondern in das aufbewahrte Motiv gesetzt wird.
export async function platzhalterBild(logoBuffer, farbe) {
  const hex = (farbe && farbe.hex) || PLATZHALTER_HEX;
  const m = await sharp(logoBuffer).metadata();
  // Fassung 44: neutrale Flaeche in Logogroesse, NICHT die Logoform - das Modell soll nichts
  // zum Nachmalen bekommen.
  return platzhalterForm(logoBuffer, m.width, m.height, hex);
}

// Signalfarben des Platzhalters. Kraeftig, im Farbkreis weit auseinander und in Designs selten -
// auch wenn das Modell sie aufhellt oder abdunkelt, bleibt der Farbton erkennbar. Gewaehlt wird
// die Farbe, die am weitesten von den Farben des Kundenlogos weg liegt: ein pinkes Logo bekommt
// keinen pinken Platzhalter, sonst wuerde die Suche spaeter das Logo selbst treffen.
const PLATZHALTER_FARBEN = [
  { hex: '#ff00e6', hue: 306, name: 'magenta' },
  { hex: '#00ff5a', hue: 141, name: 'bright green' },
  { hex: '#ff8a00', hue: 33, name: 'orange' }
];
const PLATZHALTER_HEX = PLATZHALTER_FARBEN[0].hex;
function farbTon(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 60 || (mx - mn) / mx < 0.25) return -1;
  let h;
  if (mx === r) h = 60 * (((g - b) / (mx - mn)) % 6);
  else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2);
  else h = 60 * ((r - g) / (mx - mn) + 4);
  return h < 0 ? h + 360 : h;
}
function tonAbstand(h1, h2) { const d = Math.abs(h1 - h2); return Math.min(d, 360 - d); }
function signalGrad(r, g, b, hue) {
  const h = farbTon(r, g, b);
  if (h < 0) return 0;
  const d = tonAbstand(h, hue);
  return d > 34 ? 0 : 1 - d / 34;
}
// Welche Signalfarbe kommt im Logo am wenigsten vor?
export async function platzhalterFarbe(logoBuffer, opts = {}) {
  // Im Chroma-Modus faellt Gruen weg - es wuerde beim Freistellen mit dem Hintergrund verschwinden.
  const kandidaten = opts.ohneGruen ? PLATZHALTER_FARBEN.filter(f => f.name !== 'bright green') : PLATZHALTER_FARBEN;
  try {
    const { data, info } = await sharp(logoBuffer).ensureAlpha().resize({ width: 240, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    const N = info.width * info.height;
    const zaehler = kandidaten.map(() => 0);
    let deckend = 0;
    for (let i = 0; i < N; i++) {
      if (data[i * 4 + 3] < 128) continue;
      deckend++;
      const h = farbTon(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      if (h < 0) continue;
      kandidaten.forEach((f, k) => { if (tonAbstand(h, f.hue) <= 45) zaehler[k]++; });
    }
    if (!deckend) return kandidaten[0];
    let beste = 0;
    for (let k = 1; k < kandidaten.length; k++) if (zaehler[k] < zaehler[beste]) beste = k;
    return kandidaten[beste];
  } catch (e) { return PLATZHALTER_FARBEN[0]; }
}
// Wo steht der Platzhalter im fertigen Motiv? Groesster zusammenhaengender Fleck in Signalfarbe.
export async function platzhalterFinden(artBuffer, farbe) {
  const hue = (farbe && farbe.hue) || PLATZHALTER_FARBEN[0].hue;
  const { data, info } = await sharp(artBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const m = new Uint8Array(N);
  let treffer = 0;
  for (let i = 0; i < N; i++) {
    if (data[i * 4 + 3] < 40) continue;
    if (signalGrad(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], hue) > 0) { m[i] = 1; treffer++; }
  }
  if (!treffer) return { gefunden: false, anteil: 0 };
  // Groesste Insel (4er-Nachbarschaft, iterativ)
  const gesehen = new Uint8Array(N);
  let best = null;
  for (let s = 0; s < N; s++) {
    if (!m[s] || gesehen[s]) continue;
    const stapel = [s]; gesehen[s] = 1;
    let n = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
    while (stapel.length) {
      const k = stapel.pop(); n++;
      const x = k % W, y = (k - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1];
      for (const kn of nb) if (kn >= 0 && m[kn] && !gesehen[kn]) { gesehen[kn] = 1; stapel.push(kn); }
    }
    if (!best || n > best.n) best = { n, x0, x1, y0, y1 };
  }
  // Teile des Logos, die das Modell getrennt gemalt hat (Buchstaben neben dem Ring), zaehlen mit:
  // alle Inseln, die im Umkreis der groessten liegen, in den Kasten aufnehmen.
  const mx = (best.x0 + best.x1) / 2, my = (best.y0 + best.y1) / 2;
  const reich = Math.max(best.x1 - best.x0, best.y1 - best.y0);
  let X0 = best.x0, X1 = best.x1, Y0 = best.y0, Y1 = best.y1;
  for (let i = 0; i < N; i++) {
    if (!m[i]) continue;
    const x = i % W, y = (i - x) / W;
    if (Math.abs(x - mx) > reich || Math.abs(y - my) > reich) continue;
    if (x < X0) X0 = x; if (x > X1) X1 = x; if (y < Y0) Y0 = y; if (y > Y1) Y1 = y;
  }
  const breite = X1 - X0 + 1, hoehe = Y1 - Y0 + 1;
  return {
    gefunden: breite > W * 0.04 && hoehe > H * 0.02,
    cx: Math.round((X0 + X1) / 2), cy: Math.round((Y0 + Y1) / 2), breite, hoehe,
    anteil: Math.round(treffer / N * 10000) / 10000, pixel: treffer,
    kasten: { x0: X0, y0: Y0, x1: X1, y1: Y1 },
    // 27. Sept., gemessen an der Testkarte "Foto im Original" (Harmstorf, Robotic): das Magenta-
    // Feld war 52 % breit, der Kasten 68 % - die Nachbarschaftsregel oben hatte den rosa Punkt
    // auf der Ortskarte dazugenommen. Fuer ein LOGO ist das richtig (getrennt gemalte Buchstaben
    // gehoeren dazu), fuer ein FOTO-FELD nicht: das ist EINE Flaeche, und ihr Kasten ist die
    // groesste Insel allein. Deckung im Kasten damit 0,66 -> mit der Insel allein nahe 1.
    insel: { x0: best.x0, y0: best.y0, x1: best.x1, y1: best.y1, breite: best.x1 - best.x0 + 1, hoehe: best.y1 - best.y0 + 1, pixel: best.n }
  };
}
// Wie viel von der reservierten Flaeche hat ueberlebt? Anteil der Pixel im gefundenen Kasten,
// die noch Signalfarbe tragen. Malt das Modell Figuren oder Schrift hinein (Safety tour Ruegen:
// die Koepfe standen im Logo), faellt der Wert und der Versuch geht zurueck.
export async function platzhalterDeckung(artBuffer, fund, farbe) {
  const hue = (farbe && farbe.hue) || PLATZHALTER_FARBEN[0].hue;
  if (!fund || !fund.gefunden) return 0;
  const { data, info } = await sharp(artBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const k = fund.kasten;
  let n = 0, drauf = 0;
  const stride = Math.max(1, Math.round(Math.sqrt(((k.x1 - k.x0 + 1) * (k.y1 - k.y0 + 1)) / 6000)));
  for (let y = k.y0; y <= k.y1; y += stride) for (let x = k.x0; x <= k.x1; x += stride) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    n++;
    const i = (y * W + x) * 4;
    if (data[i + 3] >= 40 && signalGrad(data[i], data[i + 1], data[i + 2], hue) > 0) drauf++;
  }
  return n ? Math.round(drauf / n * 100) / 100 : 0;
}

// Eine Luecke im Motiv mit den Farben ringsum schliessen. Gebraucht, wenn das Modell den
// Platzhalter groesser ausgemalt hat als das Logo: die Signalfarbe muss raus, aber ein Loch darf
// nicht bleiben (Safety tour Ruegen, 15. Sept.: "da sind immer noch ein paar Sachen drin" - rund
// um das Logo klaffte mehr als die Haelfte des Kastens). Gefuellt wird NUR, was gerade ausgestanzt
// wurde (maske), mit der Farbe des naechsten deckenden Pixels, danach nur dort geglaettet. Das
// Motiv laeuft damit hinter dem Logo weiter, statt an der Stanzkante zu enden.
export async function lochAuffuellen(artBuffer, kasten, maske, opts = {}) {
  // Quellfarben, die noch nach Signalfarbe aussehen (angeschraegte Kante des Platzhalters),
  // duerfen nicht als Vorlage dienen - sonst faerbt sich die Fuellung lila.
  const meidenHue = typeof opts.meidenHue === 'number' ? opts.meidenHue : -1;
  const meiden = (i) => { if (meidenHue < 0) return false; const h = farbTon(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]); return h >= 0 && tonAbstand(h, meidenHue) <= 60; };
  const { data, info } = await sharp(artBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  if (!maske) return { png: artBuffer, gefuellt: 0 };
  const k = kasten || { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  const luft = Math.round(Math.max(k.x1 - k.x0, k.y1 - k.y0) * 0.12) + 4;
  const X0 = Math.max(0, k.x0 - luft), X1 = Math.min(W - 1, k.x1 + luft);
  const Y0 = Math.max(0, k.y0 - luft), Y1 = Math.min(H - 1, k.y1 + luft);
  const FW = X1 - X0 + 1, FH = Y1 - Y0 + 1;
  if (FW < 4 || FH < 4) return { png: artBuffer, gefuellt: 0 };
  const N = FW * FH;
  const idx = (x, y) => (y + Y0) * W + (x + X0);
  const lueck = new Uint8Array(N);
  let offen = 0;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (maske[idx(x, y)]) { lueck[y * FW + x] = 1; offen++; }
  if (!offen) return { png: artBuffer, gefuellt: 0 };
  // Naechstes deckendes Pixel, das NICHT zur Luecke gehoert (Chamfer, zwei Durchlaeufe)
  const seed = new Int32Array(N).fill(-1), dist = new Float32Array(N).fill(1e9);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const a = y * FW + x;
    const i0 = idx(x, y);
    if (!lueck[a] && data[i0 * 4 + 3] >= 200 && !meiden(i0)) { seed[a] = i0; dist[a] = 0; }
  }
  const relax = (a, b, s2) => { if (dist[b] + s2 < dist[a]) { dist[a] = dist[b] + s2; seed[a] = seed[b]; } };
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const a = y * FW + x; if (x > 0) relax(a, a - 1, 1); if (y > 0) { relax(a, a - FW, 1); if (x > 0) relax(a, a - FW - 1, 1.4); if (x < FW - 1) relax(a, a - FW + 1, 1.4); } }
  for (let y = FH - 1; y >= 0; y--) for (let x = FW - 1; x >= 0; x--) { const a = y * FW + x; if (x < FW - 1) relax(a, a + 1, 1); if (y < FH - 1) { relax(a, a + FW, 1); if (x < FW - 1) relax(a, a + FW + 1, 1.4); if (x > 0) relax(a, a + FW - 1, 1.4); } }
  const grenze = opts.reichweite || Math.round(Math.max(k.x1 - k.x0, k.y1 - k.y0) * 0.75);
  const gefuelltMaske = new Uint8Array(N);
  let gefuellt = 0;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const a = y * FW + x; if (!lueck[a] || seed[a] < 0 || dist[a] > grenze) continue;
    const i = idx(x, y), s2 = seed[a];
    data[i * 4] = data[s2 * 4]; data[i * 4 + 1] = data[s2 * 4 + 1]; data[i * 4 + 2] = data[s2 * 4 + 2]; data[i * 4 + 3] = 255;
    gefuelltMaske[a] = 1; gefuellt++;
  }
  if (!gefuellt) return { png: artBuffer, gefuellt: 0 };
  // Streifen glaetten: kleiner Kastenfilter, nur auf den gefuellten Pixeln, ein paar Durchlaeufe
  const runden = Math.max(1, Math.min(4, Math.round(Math.max(k.x1 - k.x0, k.y1 - k.y0) / 250)));
  for (let r = 0; r < runden; r++) {
    const kopie = Buffer.from(data);
    for (let y = 1; y < FH - 1; y++) for (let x = 1; x < FW - 1; x++) {
      const a = y * FW + x; if (!gefuelltMaske[a]) continue;
      let sr = 0, sg = 0, sb = 0, n2 = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = idx(x + dx, y + dy) * 4;
        if (kopie[j + 3] < 200) continue;
        if (meidenHue >= 0) { const hh = farbTon(kopie[j], kopie[j + 1], kopie[j + 2]); if (hh >= 0 && tonAbstand(hh, meidenHue) <= 60) continue; }
        sr += kopie[j]; sg += kopie[j + 1]; sb += kopie[j + 2]; n2++;
      }
      if (!n2) continue;
      const i = idx(x, y) * 4;
      data[i] = Math.round(sr / n2); data[i + 1] = Math.round(sg / n2); data[i + 2] = Math.round(sb / n2);
    }
  }
  const png = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return { png, gefuellt };
}

// Den Platzhalter (und seinen Farbsaum) aus dem Motiv nehmen. Nur im Bereich des Fundes, damit
// ein pinkes Element anderswo im Design stehen bleibt.
export async function platzhalterLoeschen(artBuffer, fund, farbe) {
  const hue = (farbe && farbe.hue) || PLATZHALTER_FARBEN[0].hue;
  // Fassung 46 (Markus, 15. Sept., rosa Schrift in der Druckdatei "Reeperbahn"): Bisher wurde nur
  // im Kasten des groessten Flecks gesucht. Malt das Modell die Signalfarbe woanders hin - etwa
  // als Schriftzug -, blieb sie stehen und landete im Druck. Jetzt wird die GANZE Leinwand
  // abgesucht. Die Signalfarbe ist im Prompt ueberall sonst verboten und kommt im Logo nicht vor.
  const { data, info } = await sharp(artBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const weg = new Uint8Array(W * H);
  let n = 0, bx0 = W, bx1 = -1, by0 = H, by1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (data[i * 4 + 3] < 40) continue;
    if (signalGrad(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], hue) > 0) {
      weg[i] = 1; n++;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  if (!n) return { png: artBuffer, weg: 0 };
  const k = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
  const x0 = 0, x1 = W - 1, y0 = 0, y1 = H - 1;
  // Saum mitnehmen: der Farbverlauf an der Kante des Platzhalters ist mehrere Pixel breit
  const saum = Math.max(2, Math.round(Math.max(k.x1 - k.x0, k.y1 - k.y0) * 0.006));
  for (let s2 = 0; s2 < saum; s2++) {
    const rand = new Uint8Array(weg);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (rand[i]) continue;
      if ((x > 0 && rand[i - 1]) || (x < W - 1 && rand[i + 1]) || (y > 0 && rand[i - W]) || (y < H - 1 && rand[i + W])) weg[i] = 1;
    }
  }
  for (let i = 0; i < W * H; i++) if (weg[i]) data[i * 4 + 3] = 0;
  let png = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  // Das Modell malt den Platzhalter gern voll aus - dann klafft nach dem Ausstanzen ein Loch, das
  // groesser ist als das Logo. Mit den Farben ringsum schliessen, damit das Motiv hinter dem Logo
  // weiterlaeuft statt dort zu enden.
  let gefuellt = 0;
  if (fund && fund.kasten) { const f = await lochAuffuellen(png, fund.kasten, weg, { meidenHue: hue }); png = f.png; gefuellt = f.gefuellt; }
  return { png, weg: n, gefuellt };
}

// Wo hat das Modell das Logo hingemalt? Normalisierte Kreuzkorrelation (RGB, nur deckende
// Logopixel) in einem Fenster um die Sollposition, ueber mehrere Groessen, erst grob, dann fein.
// Ergebnis in Pixeln des uebergebenen Motivs. score 1 = perfekt, unter 0,3 = nicht gefunden.
export async function logoFinden(artBuffer, logoBuffer, erwartet) {
  const am = await sharp(artBuffer).metadata();
  const AW = 320, f = AW / am.width, AH = Math.round(am.height * f);
  const art = await sharp(artBuffer).ensureAlpha().resize({ width: AW, height: AH, fit: 'fill' }).raw().toBuffer();
  const artVal = (x, y, k) => { const i = (y * AW + x) * 4; return art[i + 3] < 128 ? 0 : art[i + k]; };
  const lmeta = await sharp(logoBuffer).metadata();
  const ratio = lmeta.height / lmeta.width;
  let best = { score: -1 };
  const pruefe = async (scale, x0, y0, x1, y1, schritt) => {
    const tw = Math.max(6, Math.round(erwartet.breite * f * scale)), th = Math.max(6, Math.round(tw * ratio));
    const t = await sharp(logoBuffer).ensureAlpha().resize({ width: tw, height: th, fit: 'fill' }).raw().toBuffer();
    // Stuetzpunkte: deckende Logopixel, hoechstens ~1500
    const pts = [];
    const stride = Math.max(1, Math.round(Math.sqrt((tw * th) / 1500)));
    for (let y = 0; y < th; y += stride) for (let x = 0; x < tw; x += stride) { const i = (y * tw + x) * 4; if (t[i + 3] >= 128) pts.push([x, y, t[i], t[i + 1], t[i + 2]]); }
    if (pts.length < 20) return;
    const n = pts.length * 3;
    let mt = 0; for (const p of pts) mt += p[2] + p[3] + p[4]; mt /= n;
    let st = 0; for (const p of pts) for (let k = 2; k < 5; k++) st += (p[k] - mt) ** 2; st = Math.sqrt(st / n) || 1;
    for (let cy = y0; cy <= y1; cy += schritt) for (let cx = x0; cx <= x1; cx += schritt) {
      const left = Math.round(cx - tw / 2), top = Math.round(cy - th / 2);
      if (left < 0 || top < 0 || left + tw > AW || top + th > AH) continue;
      let ma = 0; for (const p of pts) ma += artVal(left + p[0], top + p[1], 0) + artVal(left + p[0], top + p[1], 1) + artVal(left + p[0], top + p[1], 2); ma /= n;
      let sa = 0, cov = 0;
      for (const p of pts) for (let k = 0; k < 3; k++) { const a = artVal(left + p[0], top + p[1], k) - ma; sa += a * a; cov += a * (p[2 + k] - mt); }
      sa = Math.sqrt(sa / n) || 1;
      const score = cov / n / (sa * st);
      if (score > best.score) best = { score, cx, cy, tw, scale };
    }
  };
  const ecx = erwartet.cx * f, ecy = erwartet.cy * f, fenster = Math.round(AW * 0.22);
  // Fassung 38: das Modell malt die Kopie auch mal anderthalbfach so gross (Safety-Team: Ring um
  // den Ring) - Groessenspanne 0,7 bis 1,6, danach zwei Feinstufen statt einer.
  for (const scale of [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6]) await pruefe(scale, Math.round(ecx - fenster), Math.round(ecy - fenster), Math.round(ecx + fenster), Math.round(ecy + fenster), 3);
  if (best.score > 0) {
    let g = best;
    for (const m of [0.92, 0.96, 1, 1.04, 1.08]) await pruefe(g.scale * m, g.cx - 4, g.cy - 4, g.cx + 4, g.cy + 4, 1);
    g = best;
    for (const m of [0.98, 1, 1.02]) await pruefe(g.scale * m, g.cx - 2, g.cy - 2, g.cx + 2, g.cy + 2, 1);
  }
  if (best.score < 0) return { score: 0, cx: erwartet.cx, cy: erwartet.cy, breite: erwartet.breite, gefunden: false };
  return { score: Math.round(best.score * 100) / 100, cx: Math.round(best.cx / f), cy: Math.round(best.cy / f), breite: Math.round(best.tw / f), gefunden: best.score >= 0.3 };
}

// Die vom Modell gemalte Logo-Kopie entfernen: Alphamaske des Originals an der Fundstelle, etwas
// aufgeweitet (das Modell zeichnet nie pixelgenau), aus dem Motiv ausstanzen. Elemente, die
// hinter dem Logo durchlaufen, bleiben bis an seine Kante stehen - kein Loch mit Luft.
export async function logoLoeschen(artBuffer, logoBuffer, treffer, aufweiten = 0.035) {
  const am = await sharp(artBuffer).metadata();
  const lm = await sharp(logoBuffer).metadata();
  const w = Math.max(4, Math.round(treffer.breite)), h = Math.max(4, Math.round(w * lm.height / lm.width));
  const rand = Math.max(2, Math.round(w * aufweiten));
  const alpha = await sharp(logoBuffer).ensureAlpha().resize({ width: w, height: h, fit: 'fill' })
    .extend({ top: rand * 2, bottom: rand * 2, left: rand * 2, right: rand * 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extractChannel('alpha').toColourspace('b-w').blur(Math.max(0.5, rand / 2.5)).threshold(6).blur(0.7).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
  const cw = alpha.info.width, ch = alpha.info.height;
  const black = await sharp({ create: { width: cw, height: ch, channels: 3, background: '#000' } }).raw().toBuffer();
  const cutter = await sharp(black, { raw: { width: cw, height: ch, channels: 3 } }).joinChannel(alpha.data, { raw: { width: cw, height: ch, channels: 1 } }).png().toBuffer();
  const left = Math.round(treffer.cx - cw / 2), top = Math.round(treffer.cy - ch / 2);
  // Ausstanzen darf ueber den Rand hinausgehen: dafuer den Stanzer auf die Leinwand beschneiden
  const l = Math.max(0, left), t = Math.max(0, top);
  const r = Math.min(am.width, left + cw), b = Math.min(am.height, top + ch);
  if (r <= l || b <= t) return artBuffer;
  const stueck = await sharp(cutter).extract({ left: l - left, top: t - top, width: r - l, height: b - t }).png().toBuffer();
  return sharp(artBuffer).ensureAlpha().composite([{ input: stueck, left: l, top: t, blend: 'dest-out' }]).png().toBuffer();
}

// Fassung 38: Reste der gemalten Logo-Kopie rund um das Loch tilgen. Das Modell zeichnet die Kopie
// nie pixelgenau - mal ein Fuenftel groesser, mal versetzt, mal mit dickerem Strich. Die Stanze
// (logoLoeschen) trifft dann nur den Kern, und um das eingesetzte Original bleibt ein zweiter
// Ring stehen (Safety-Team, 14. Sept.: "nachgezeichnet und drueber gelegt ... dilettantisch").
// Getilgt wird, was (a) direkt ans Loch anschliesst, (b) hoechstens `band` Logobreiten vom
// naechsten Logopixel entfernt liegt und (c) dessen Farbe traegt - auch aufgehellt oder
// abgedunkelt (gleiche Farbrichtung im RGB-Raum, Helligkeit im Rahmen). Andersfarbige Motivteile,
// die ans Logo stossen (Karte, Schrift, Linien), bleiben bis an die Kante stehen.
export async function logoRestTilgen(artBuffer, logoBuffer, treffer, band = 0.07) {
  const am = await sharp(artBuffer).metadata();
  const lm = await sharp(logoBuffer).metadata();
  const w = Math.max(4, Math.round(treffer.breite)), h = Math.max(4, Math.round(w * lm.height / lm.width));
  const rand = Math.max(4, Math.round(w * band));
  const left0 = Math.round(treffer.cx - w / 2), top0 = Math.round(treffer.cy - h / 2);
  // Arbeitsfenster: Logokasten plus Band, auf die Leinwand beschnitten
  const L = Math.max(0, left0 - rand), T = Math.max(0, top0 - rand);
  const R = Math.min(am.width, left0 + w + rand), B = Math.min(am.height, top0 + h + rand);
  const FW = R - L, FH = B - T;
  if (FW < 4 || FH < 4) return { png: artBuffer, getilgt: 0 };
  const art = await sharp(artBuffer).ensureAlpha().extract({ left: L, top: T, width: FW, height: FH }).raw().toBuffer();
  const t = await sharp(logoBuffer).ensureAlpha().resize({ width: w, height: h, fit: 'fill' }).raw().toBuffer();
  const tl = left0 - L, tt = top0 - T;
  const N = FW * FH;
  // Naechstes deckendes Logopixel je Fensterpixel (Chamfer-Abstand, zwei Durchlaeufe)
  const seed = new Int32Array(N).fill(-1), dist = new Float32Array(N).fill(1e9);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (t[i + 3] < 128) continue;
    const fx = tl + x, fy = tt + y; if (fx < 0 || fy < 0 || fx >= FW || fy >= FH) continue;
    const k = fy * FW + fx; seed[k] = i; dist[k] = 0;
  }
  const relax = (k, kn, d) => { if (dist[kn] + d < dist[k]) { dist[k] = dist[kn] + d; seed[k] = seed[kn]; } };
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const k = y * FW + x; if (x > 0) relax(k, k - 1, 1); if (y > 0) { relax(k, k - FW, 1); if (x > 0) relax(k, k - FW - 1, 1.4); if (x < FW - 1) relax(k, k - FW + 1, 1.4); } }
  for (let y = FH - 1; y >= 0; y--) for (let x = FW - 1; x >= 0; x--) { const k = y * FW + x; if (x < FW - 1) relax(k, k + 1, 1); if (y < FH - 1) { relax(k, k + FW, 1); if (x < FW - 1) relax(k, k + FW + 1, 1.4); if (x > 0) relax(k, k + FW - 1, 1.4); } }
  let gekappt = 0; // Pixel in Logofarbe, die nur am Bandende scheiterten
  const farbePasst = (k) => {
    const s = seed[k]; if (s < 0) return false;
    const r = art[k * 4], g = art[k * 4 + 1], b = art[k * 4 + 2];
    const tr = t[s], tg = t[s + 1], tb = t[s + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b, tlum = 0.299 * tr + 0.587 * tg + 0.114 * tb;
    // Fassung 40: Unbunt gegen unbunt (schwarze Logoschrift, vom Modell weiss mit grauer Kontur
    // nachgemalt) nur noch dicht am Logo - hoechstens ein Drittel des Bandes weit. Ueber das ganze
    // Band galt damit auch cremefarbene Motivschrift als Logofarbe und wurde weggefressen: im
    // Druck ein heller Kasten, auf Schwarz ein Loch (Safety Group Ruegen, 15. Sept.).
    const sat = (a, b2, c) => { const mx = Math.max(a, b2, c); return mx ? (mx - Math.min(a, b2, c)) / mx : 0; };
    if (dist[k] <= rand * 0.34 && sat(tr, tg, tb) < 0.2 && sat(r, g, b) < 0.12) return true;
    if (Math.abs(lum - tlum) > 95) return false;
    const n1 = Math.hypot(r, g, b) || 1, n2 = Math.hypot(tr, tg, tb) || 1;
    return Math.hypot(r / n1 - tr / n2, g / n1 - tg / n2, b / n1 - tb / n2) < 0.2;
  };
  const passt = (k) => { if (!farbePasst(k)) return false; if (dist[k] > rand) { gekappt++; return false; } return true; };
  // Vom Loch aus wachsen: Start sind die durchsichtigen Pixel im Fenster
  const weg = new Uint8Array(N); const stapel = [];
  for (let k = 0; k < N; k++) if (art[k * 4 + 3] < 128) { weg[k] = 1; stapel.push(k); }
  let getilgt = 0;
  while (stapel.length) {
    const k = stapel.pop(); const x = k % FW, y = (k - x) / FW;
    const nb = [x > 0 ? k - 1 : -1, x < FW - 1 ? k + 1 : -1, y > 0 ? k - FW : -1, y < FH - 1 ? k + FW : -1];
    for (const kn of nb) { if (kn < 0 || weg[kn]) continue; if (passt(kn)) { weg[kn] = 2; getilgt++; stapel.push(kn); } }
  }
  // Am Bandende noch deutlich Logofarbe (Kopie groesser oder weiter versetzt als gedacht)?
  // Dann einmal mit weiterem Band wiederholen - aber nicht endlos, sonst frisst es das Motiv.
  if (band < 0.1 && gekappt > w * h * 0.003) return logoRestTilgen(artBuffer, logoBuffer, treffer, 0.1);
  if (!getilgt) return { png: artBuffer, getilgt: 0 };
  // Notbremse: ein Rest ist ein duenner Saum. Wer mehr als ein Drittel der Logoflaeche wegnimmt,
  // hat kein Logo mehr getroffen, sondern das Motiv. Dann lieber der Saum als ein Loch.
  if (getilgt > w * h * 0.35) {
    console.warn('Logo-Reste: Tilgung verworfen -', getilgt, 'Pixel waeren weg, das ist zu viel fuer einen Saum');
    return { png: artBuffer, getilgt: 0, verworfen: true };
  }
  const alpha = Buffer.alloc(N, 0);
  for (let k = 0; k < N; k++) if (weg[k] === 2) alpha[k] = 255;
  const black = await sharp({ create: { width: FW, height: FH, channels: 3, background: '#000' } }).raw().toBuffer();
  const cutter = await sharp(black, { raw: { width: FW, height: FH, channels: 3 } }).joinChannel(alpha, { raw: { width: FW, height: FH, channels: 1 } }).png().toBuffer();
  const weich = await sharp(cutter).blur(0.6).png().toBuffer();
  const png = await sharp(artBuffer).ensureAlpha().composite([{ input: weich, left: L, top: T, blend: 'dest-out' }]).png().toBuffer();
  return { png, getilgt };
}

// Fassung 39: Formsuche statt Farbvergleich. Das Modell malt das Logo nicht nur groesser, es
// faerbt es um - hellblauer Ring, weisse Buchstaben mit grauer Kontur (Safety Group Ruegen,
// XW2A). Die Kreuzkorrelation ueber RGB findet so eine Kopie nicht mehr, die Kanten sitzen aber
// noch an denselben Stellen. Darum: Kantenbild der Schablone gegen die Abstandskarte der
// Motivkanten (Chamfer) - und umgekehrt, damit kantenreiche Stellen (Schriftzuege) nicht als
// Treffer durchgehen. deckung = Anteil der Schablonenkanten, die im Motiv eine Kante finden,
// genau = Anteil der Motivkanten im Kasten, die zur Schablone passen. Farbunabhaengig.
function kantenMaske(raw, W, H, schwelle) {
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = raw[i * 4 + 3] < 128 ? -1 : 0.299 * raw[i * 4] + 0.587 * raw[i * 4 + 1] + 0.114 * raw[i * 4 + 2];
  const m = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x;
    const a = lum[k + 1], b = lum[k - 1], c = lum[k + W], d = lum[k - W];
    // Kante: Helligkeitssprung oder Sprung ins Durchsichtige
    const gx = (a < 0 || b < 0) ? (a < 0 && b < 0 ? 0 : 255) : a - b;
    const gy = (c < 0 || d < 0) ? (c < 0 && d < 0 ? 0 : 255) : c - d;
    if (lum[k] >= 0 && Math.hypot(gx, gy) >= schwelle) m[k] = 1;
  }
  return m;
}
function kantenAbstand(m, W, H, cap) {
  const d = new Float32Array(W * H).fill(cap);
  for (let i = 0; i < W * H; i++) if (m[i]) d[i] = 0;
  const relax = (k, kn, s) => { const v = d[kn] + s; if (v < d[k]) d[k] = v; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (x > 0) relax(k, k - 1, 1); if (y > 0) { relax(k, k - W, 1); if (x > 0) relax(k, k - W - 1, 1.4); if (x < W - 1) relax(k, k - W + 1, 1.4); } }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const k = y * W + x; if (x < W - 1) relax(k, k + 1, 1); if (y < H - 1) { relax(k, k + W, 1); if (x < W - 1) relax(k, k + W + 1, 1.4); if (x > 0) relax(k, k + W - 1, 1.4); } }
  return d;
}
export async function logoFindenForm(artBuffer, logoBuffer, erwartet, opts = {}) {
  const am = await sharp(artBuffer).metadata();
  const AW = opts.AW || 480, f = AW / am.width, AH = Math.round(am.height * f);
  const art = await sharp(artBuffer).ensureAlpha().resize({ width: AW, height: AH, fit: 'fill' }).raw().toBuffer();
  const ak = kantenMaske(art, AW, AH, 40);
  const cap = 4;
  const ad = kantenAbstand(ak, AW, AH, cap);
  const lmeta = await sharp(logoBuffer).metadata();
  const ratio = lmeta.height / lmeta.width;
  let best = { score: -1 };
  const cache = new Map();
  const schablone = async (tw, th) => {
    const key = tw + 'x' + th; if (cache.has(key)) return cache.get(key);
    const t = await sharp(logoBuffer).ensureAlpha().resize({ width: tw, height: th, fit: 'fill' }).extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } }).raw().toBuffer();
    const ew = tw + 4, eh = th + 4;
    const tk = kantenMaske(t, ew, eh, 40);
    const td = kantenAbstand(tk, ew, eh, cap);
    const pts = []; for (let y = 0; y < eh; y++) for (let x = 0; x < ew; x++) if (tk[y * ew + x]) pts.push([x - 2, y - 2]);
    const r = { pts, td, ew, eh }; cache.set(key, r); return r;
  };
  const pruefe = async (scale, x0, y0, x1, y1, schritt) => {
    const tw = Math.max(8, Math.round(erwartet.breite * f * scale)), th = Math.max(8, Math.round(tw * ratio));
    const { pts, td, ew, eh } = await schablone(tw, th);
    if (pts.length < 30) return;
    const stride = Math.max(1, Math.round(pts.length / 1500));
    const sx = Math.max(1, Math.round(Math.sqrt((tw * th) / 3000)));
    for (let cy = y0; cy <= y1; cy += schritt) for (let cx = x0; cx <= x1; cx += schritt) {
      const left = Math.round(cx - tw / 2), top = Math.round(cy - th / 2);
      if (left < -tw * 0.3 || top < -th * 0.3 || left + tw > AW + tw * 0.3 || top + th > AH + th * 0.3) continue;
      let s1 = 0, n1 = 0;
      for (let i = 0; i < pts.length; i += stride) { const x = left + pts[i][0], y = top + pts[i][1]; n1++; if (x < 0 || y < 0 || x >= AW || y >= AH) { s1 += cap; continue; } s1 += ad[y * AW + x]; }
      const deckung = 1 - s1 / n1 / cap;
      let s2 = 0, n2 = 0;
      for (let y = 0; y < th; y += sx) for (let x = 0; x < tw; x += sx) { const ax = left + x, ay = top + y; if (ax < 0 || ay < 0 || ax >= AW || ay >= AH) continue; if (!ak[ay * AW + ax]) continue; n2++; s2 += td[(y + 2) * ew + x + 2]; }
      const genau = n2 < 10 ? 0 : 1 - s2 / n2 / cap;
      const score = deckung * genau > 0 ? 2 * deckung * genau / (deckung + genau) : 0;
      if (score > best.score) best = { score, cx, cy, tw, scale, deckung, genau };
    }
  };
  const ecx = erwartet.cx * f, ecy = erwartet.cy * f, fenster = Math.round(AW * (opts.fenster || 0.2));
  for (const scale of [0.8, 0.9, 1, 1.1, 1.2, 1.32, 1.45, 1.6]) await pruefe(scale, Math.round(ecx - fenster), Math.round(ecy - fenster), Math.round(ecx + fenster), Math.round(ecy + fenster), 3);
  if (best.score > 0) {
    let g = best;
    for (const m of [0.93, 0.96, 1, 1.04, 1.07]) await pruefe(g.scale * m, g.cx - 4, g.cy - 4, g.cx + 4, g.cy + 4, 1);
    g = best;
    for (const m of [0.98, 1, 1.02]) await pruefe(g.scale * m, g.cx - 2, g.cy - 2, g.cx + 2, g.cy + 2, 1);
  }
  if (best.score < 0) return { score: 0, deckung: 0, genau: 0, cx: erwartet.cx, cy: erwartet.cy, breite: erwartet.breite, gefunden: false };
  // Schwellen aus dem Pruefstand: echte Kopien (treu, umgefaerbt, Geist) 0,68-0,86 bei Deckung
  // ueber 0,9; ohne Kopie liegt der beste Fehltreffer bei 0,57 mit Deckung 0,67.
  const deckungMin = opts.deckungMin == null ? 0.85 : opts.deckungMin, scoreMin = opts.scoreMin == null ? 0.6 : opts.scoreMin;
  return { score: Math.round(best.score * 100) / 100, deckung: Math.round(best.deckung * 100) / 100, genau: Math.round(best.genau * 100) / 100, cx: Math.round(best.cx / f), cy: Math.round(best.cy / f), breite: Math.round(best.tw / f), gefunden: best.deckung >= deckungMin && best.score >= scoreMin };
}

// Die gemalte Logo-Kopie in Schaelgaengen entfernen: Formsuche, Stanze, farbgeleitete Reste,
// dann erneut suchen - bis nichts mehr gefunden wird oder dieselbe Stelle wiederkommt.
// treffer (falls uebergeben) ist der Fund aus der Bewertung; sonst wird hier gesucht.
export async function logoKopieEntfernen(artBuffer, logoBuffer, erwartet, treffer) {
  let png = artBuffer, getilgt = 0, gaenge = 0;
  let t = treffer && treffer.gefunden ? treffer : await logoFindenForm(artBuffer, logoBuffer, erwartet);
  const erster = t.gefunden ? t : { ...erwartet, score: t.score, deckung: t.deckung, gefunden: false };
  if (!t.gefunden) {
    // Nichts gefunden: Stanze an der Sollposition, das ist die beste Annahme
    png = await logoLoeschen(png, logoBuffer, erwartet);
    const r = await logoRestTilgen(png, logoBuffer, erwartet); png = r.png; getilgt += r.getilgt;
    return { png, treffer: erster, gaenge: 1, getilgt };
  }
  let vorher = null;
  for (let gang = 1; gang <= 3; gang++) {
    if (!t.gefunden) break;
    if (vorher && Math.abs(t.breite - vorher.breite) < vorher.breite * 0.04 && Math.hypot(t.cx - vorher.cx, t.cy - vorher.cy) < vorher.breite * 0.03) break;
    // Eng stanzen (2 Prozent): jedes Prozent mehr ist ein Streifen Luft um das Logo, und genau
    // der laesst es wie aufgeklebt aussehen statt eingebunden. Was ueberhaengt, holt die Tilgung.
    png = await logoLoeschen(png, logoBuffer, t, 0.02);
    const r = await logoRestTilgen(png, logoBuffer, t); png = r.png; getilgt += r.getilgt; gaenge = gang;
    vorher = t;
    if (gang === 3) break;
    t = await logoFindenForm(png, logoBuffer, t, { fenster: 0.15, deckungMin: 0.75 });
  }
  return { png, treffer: erster, gaenge, getilgt };
}

/**
 * Alle Platzhalter-Felder einer Vorlage finden, nicht nur das groesste.
 *
 * Markus, 23. Sept., mit einem bei ChatGPT gebauten Ball-z-Rahmen: "Das Logo ist zwar falsch,
 * aber der macht echt nette Designs." Das Entscheidende an dem Bild war nicht die Optik, sondern
 * die BAUWEISE: es ist kein fertiges Motiv, sondern ein Rahmen in den Firmenfarben mit DREI
 * leeren Feldern - ein grosses und zwei kleine. Die echten Fotos kommen hinterher hinein.
 *
 * Damit loesen sich die Probleme, die uns den ganzen 22. September gekostet haben: der Mensch
 * wird nicht umgefaerbt (er wird eingesetzt, nicht gemalt), das Logo nicht neu geschrieben, die
 * Fotos nicht erfunden - und das Design darf trotzdem bei jeder Firma anders aussehen, weil nur
 * der RAHMEN von der Bild-KI kommt.
 *
 * platzhalterFinden() gibt es dafuer schon, aber es liefert genau EIN Feld: die groesste Insel,
 * plus was dicht daneben liegt (dafuer war es gedacht - ein Logo, dessen Teile getrennt gemalt
 * wurden). Fuer einen Rahmen mit mehreren Feldern braucht es jede Insel einzeln.
 *
 * Rueckgabe: die Felder von gross nach klein, jedes mit Kasten und Flaechenanteil. Zu kleine
 * Inseln (Spritzer, Farbsaum an einer Kante) fallen raus - sonst wuerde ein Farbklecks im Rahmen
 * als Bildfeld gelten.
 */
export async function platzhalterFelder(artBuffer, farbe, { mindestAnteil = 0.01, hoechstens = 6 } = {}) {
  const hue = (farbe && farbe.hue) || PLATZHALTER_FARBEN[0].hue;
  const { data, info } = await sharp(artBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const m = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (data[i * 4 + 3] < 40) continue;
    if (signalGrad(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], hue) > 0) m[i] = 1;
  }
  const gesehen = new Uint8Array(N);
  const inseln = [];
  for (let s = 0; s < N; s++) {
    if (!m[s] || gesehen[s]) continue;
    const stapel = [s]; gesehen[s] = 1;
    let n = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
    while (stapel.length) {
      const k = stapel.pop(); n++;
      const x = k % W, y = (k - x) / W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1];
      for (const kn of nb) if (kn >= 0 && m[kn] && !gesehen[kn]) { gesehen[kn] = 1; stapel.push(kn); }
    }
    if (n / N < mindestAnteil) continue;   // Spritzer und Farbsaum sind keine Bildfelder
    inseln.push({ n, left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, anteil: n / N });
  }
  inseln.sort((a, b) => b.n - a.n);
  return {
    gefunden: inseln.length > 0,
    felder: inseln.slice(0, hoechstens).map(i => ({
      left: i.left, top: i.top, width: i.width, height: i.height,
      anteil: i.anteil,
      // Wie rechteckig ist die Insel wirklich? Ein sauberes Feld fuellt seinen Kasten fast ganz;
      // ein Pinselstrich in derselben Farbe nicht. So laesst sich beides auseinanderhalten.
      fuellung: i.n / (i.width * i.height)
    })),
    mass: { width: W, height: H }
  };
}
