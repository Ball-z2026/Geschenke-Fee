// firmen-freigabe.js - Firmenlogos auf der Postkarte
// =============================================================================================
// Markus, 22. Sept. 2026: "Wenn wir zum Beispiel über den Standort feststellen, dass diese Person
// auf einem Firmengelände ist, dass wir dann das Firmenlogo und dann den Rand in den Firmenfarben
// machen. Das hätte wieder zur Folge, dass wir die Firmen anschreiben könnten, das Logo nutzen zu
// dürfen. Das wäre marketingtechnisch ein absoluter Durchbruch."
// Und am selben Tag: "Ich habe von drei Firmen schon die Erlaubnis, das Logo zu nutzen:
// C.C.E. Sportswear in Marschacht, DTF Express in Erkelenz und Ballz in Harmstorf. Wenn von diesen
// drei Standpunkten eine Postkarte kreiert wird, dort bitte das Original-Logo nehmen und den Rand
// dann in Firmenfarben."
//
// Dieselbe Mechanik wie beim Wappen (wappen-freigabe.js), und aus demselben Grund: Ein fremdes
// Logo ist eine Marke. Ohne Eintrag in postkarte/firmen-freigaben.json kommt NIE ein Logo auf eine
// Karte - kein Ratespiel, keine Ausnahme. Was auch ohne Freigabe geht, sind die FARBEN: Farben
// sind nicht schutzfaehig (genau wie beim Wappen). Der Rand darf sie also tragen, das Logo nicht.
//
// Ein Eintrag beschreibt, WO die Freigabe gilt (Gebietsgrenzen aus OpenStreetMap, Ortsname, PLZ),
// WELCHE Datei das Logo ist und WELCHE Farben der Rand bekommt. Fehlt die Datei, bleibt es beim
// Rand - die Karte wird dadurch nicht schlechter, nur schlichter.
// =============================================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const HIER = new URL('./postkarte/', import.meta.url);

/** Alle Eintraege lesen. Fehlt die Datei, gibt es einfach keine Freigaben. */
export async function freigaben() {
  try { return JSON.parse(await fs.readFile(new URL('firmen-freigaben.json', HIER), 'utf8')); }
  catch (e) { return []; }
}

/**
 * Welche Firmen kommen an diesem Standort ueberhaupt in Frage?
 *
 * Wer steht auf einem freigegebenen Firmengelaende? Das GELAENDE ist ein Punkt mit Radius um die
 * Anschrift der Firma (Standard 150 m), nicht die Gemeinde: ein Gemeindegebiet waere viel zu
 * grob, dann traege jede Karte aus Marschacht das Logo von C.C.E. Sportswear, auch die vom
 * Elbdeich. Ohne Anschrift (punkt) gibt es deshalb gar keinen Treffer - lieber keinen als einen
 * falschen. Die Anschrift holt der Server von der Firmenseite (logo-holen.js) und legt sie mit
 * Koordinaten im Nachweis ab.
 * Mehrere Treffer kommen im Buerohaus vor: der naechste steht vorn.
 * Reine Rechnung, damit die Abnahme sie ohne Netz durchrechnen kann.
 */
/**
 * Wie weit darf eine Karte von dieser Firma Gebrauch machen?
 *
 * 22. Sept., Markus: "Und wir brauchen dafuer ja zwei Varianten: einmal Logo freigegeben von der
 * Firma, und einmal ohne Logo und ohne Bilder von der Homepage."
 * Die Trennlinie ist dieselbe wie beim Wappen, und sie hat denselben Grund: ein Logo und die
 * Fotos einer Firma sind geschuetzt, ihre FARBEN sind es nicht.
 *   'voll'    - Freigabe liegt vor: Logo im Markenbalken, ihre eigenen Fotos als Motiv.
 *   'farben'  - Eintrag ohne Freigabe: nur der Balken in ihren Farben, kein Logo, keine Fotos.
 *               Das Motiv ist dann der Ort, wie bei jeder normalen Postkarte.
 *   null      - gar kein Eintrag: die Firma kommt auf der Karte nicht vor.
 */
export function umfang(eintrag) {
  if (!eintrag) return null;
  if (eintrag.freigabe && eintrag.freigabe.datum) return 'voll';
  return 'farben';
}

/**
 * Die Strasse aus einer Anschrift: "Hauptstrasse 16, 21228 Harmstorf" -> "hauptstrasse".
 * Klein geschrieben und ohne Endung "strasse/str.", damit "Dorfstr." und "Dorfstrasse"
 * dasselbe sind. Reine Rechnung.
 */
export function strasseAus(text) {
  const t = String(text || '').split(',')[0].trim();
  if (!t) return '';
  return t
    .replace(/\s+\d+\s*[a-z]?$/i, '')          // die Hausnummer weg
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/str\.?$/, 'strasse')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * 24. Sept., Markus: "Aber wieso koennen wir den Standort nicht genauer machen? Ball-z ist
 * Hauptstrasse 16, ich hab fotografiert in Dorfstrasse 9."
 * Genau so geht es genauer - nicht ueber das GPS (das ist auf 25 m genau und wird nie ein Haus
 * vom anderen unterscheiden), sondern ueber den STRASSENNAMEN. Die Rueckwaertssuche liefert ihn
 * ohnehin bei jedem Standort mit ("road"), und in der Freigabe steht die Anschrift der Firma.
 * Zwei verschiedene Strassen sind nie dasselbe Grundstueck, egal wie gross der Radius ist.
 * Kennen wir eine der beiden Strassen nicht, entscheidet wie bisher allein die Entfernung -
 * lieber grosszuegig als eine Firma zu Unrecht ausschliessen.
 */
export function kandidatenAmOrt(koord, eintraege, { strasse = '' } = {}) {
  const liste = Array.isArray(eintraege) ? eintraege : [];
  const m = String(koord || '').match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return [];
  const lat = +m[1], lon = +m[2];
  const treffer = [];
  for (const e of liste) {
    const p = e.punkt;
    if (!Array.isArray(p) || p.length !== 2) continue;
    const radius = Math.max(20, Math.min(+e.radiusM || 150, 2000));
    const d = entfernungM(lat, lon, p[0], p[1]);
    if (d > radius) continue;
    // Die Strasse muss passen, wenn wir beide kennen.
    const meine = strasseAus(strasse);
    const ihre = strasseAus(e.adresse || '');
    if (meine && ihre && meine !== ihre) continue;
    treffer.push({ eintrag: e, entfernungM: d, strasse: ihre || '' });
  }
  // Das naechste zuerst - im Buerohaus mit vielen Firmen steht oben, wer am dichtesten dran ist.
  treffer.sort((a, b) => a.entfernungM - b.entfernungM);
  return treffer;
}

/**
 * Gilt fuer diesen Auftrag eine Firmen-Freigabe?
 *
 * 22. Sept., Markus: "Das funktioniert nicht so. Es muss so funktionieren mit Standort." Und
 * davor schon: "Ganz klar, die Reihenfolge ist der Standort. Eine Firma - dann wird es eine
 * Firmenkarte. Ist der Standort ein privates Haus oder eine Sehenswuerdigkeit oder irgendwas
 * anderes, was nichts mit der Firma zu tun hat, dann gilt die Logik, die wir bis jetzt haben."
 *
 * Also entscheidet DER STANDORT, nicht der Kunde: Wer auf dem Gelaende steht, bekommt die
 * Firmenkarte. Niemand wird gefragt, niemand waehlt etwas aus. Die vorige Fassung liess die
 * Kacheln entscheiden - das war meine Idee, nicht seine, und sie ist wieder raus.
 *
 * Das Gelaende ist ein PUNKT MIT RADIUS um die Anschrift der Firma, nicht die Gemeinde. Ein
 * Gemeindegebiet waere viel zu grob: dann traege jede Karte aus Marschacht das Logo von
 * C.C.E. Sportswear, auch die vom Elbdeich - und genau das waere "ein privates Haus", auf das
 * die Firma nichts zu suchen hat. Der Radius steht im Eintrag (Standard 150 m).
 *
 * Der Name bleibt als zweiter Weg: wer "Ball-z" als Ort eintippt, meint die Firma.
 * Reine Rechnung, damit die Abnahme sie ohne Netz durchrechnen kann.
 */
export function freigabeFuer({ firma = '', ort = '', koord = null, strasse = '' } = {}, eintraege) {
  const liste = Array.isArray(eintraege) ? eintraege : [];

  // 24. Sept., Markus: "Ich war auf der anderen Seite des Hauses, wo meine andere Firma ist, und
  // er kennt die Ball-z, obwohl es die Dorfstrasse ist."
  // Hier stand: "DER STANDORT hat Vorrang" - und er gewann bedingungslos. Bei zwei Betrieben auf
  // einem Grundstueck, oder bei 25 m Ortungsgenauigkeit und einem Nachbarn, trifft das
  // zwangslaeufig manchmal die falsche Firma. Und es widersprach seiner eigenen Ansage vom
  // 22. Sept.: "Der Standort entscheidet nicht, er BIETET AN."
  // Jetzt gilt genau das: gewaehlt wird auf der Seite, der Standort BESTAETIGT die Wahl.
  // Waehlt niemand eine Firma, wird es eine Ortskarte - die ist nie falsch, eine fremde
  // Firmenkarte schon.
  const nah = kandidatenAmOrt(koord, liste, { strasse });
  const gewaehlt = String(firma || '').trim();
  if (!gewaehlt) return null;

  // Die Wahl, so geschrieben, wie sie jemand tippt ("CCE", "C.C.E.", "C C E", "Ball-z").
  const getippt = (gewaehlt + ' ' + String(ort || '')).trim();
  const sauber = (s) => String(s).toLowerCase().replace(/[.\-_]/g, '').replace(/\s+/g, ' ').trim();
  const ziel = sauber(getippt);
  if (!ziel) return null;
  for (const e of liste) {
    for (const n of (e.namen || [e.firma])) {
      if (!n) continue;
      const nn = sauber(n);
      // Kurze Namen nur als ganzes Wort - sonst wuerde "Ballzfeld" auch treffen.
      if (!nn || nn.length < 4) continue;
      if (ziel === nn || new RegExp('(^|\\s)' + nn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|\\s)').test(ziel)) {
        // Steht eine Anschrift im Eintrag, muss der Standort dazu passen - sonst koennte jemand
        // "Ball-z" von Mallorca aus eintippen und das Logo mitnehmen. Der Standort BESTAETIGT
        // also die Wahl, statt sie zu treffen.
        if (Array.isArray(e.punkt) && e.punkt.length === 2 && koord && !nah.some(t => t.eintrag === e)) continue;
        return e;
      }
    }
  }
  return null;
}

/** Luftlinie in Metern (Haversine) - fuer den Radius um die Firmenadresse. */
export function entfernungM(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = (g) => g * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** Wie die Logo-Datei heissen darf - nie ein Pfad, nie ein Ausbruch aus dem Verzeichnis. */
export function dateiName(eintrag) {
  return eintrag ? String(eintrag.datei || '').replace(/[^A-Za-z0-9_.-]/g, '') : '';
}

/**
 * Das freigegebene Logo als PNG - oder null, wenn (noch) keine Datei da ist.
 * Zwei Orte, und die Reihenfolge ist wichtig:
 *  1. das VOLUME (storage/firmenlogos) - dorthin legt der Server ab, was er von der Firmenseite
 *     geholt hat. Nur dort ueberlebt es den naechsten Deploy.
 *  2. das REPO (postkarte/logos) - was ein Mensch dauerhaft hinterlegt hat.
 * Das Geholte gewinnt, weil es das neuere ist.
 */
export async function logoBild(eintrag, volumePfad = '') {
  const datei = dateiName(eintrag);
  if (!datei) return null;
  if (volumePfad) {
    try { return await fs.readFile(path.join(volumePfad, 'firmenlogos', datei)); } catch (e) { /* dann das Repo */ }
  }
  try { return await fs.readFile(new URL('logos/' + datei, HIER)); }
  catch (e) { return null; }
}

/** Ein geholtes Logo auf dem Volume ablegen. Gibt den Pfad zurueck, unter dem es jetzt liegt. */
export async function logoAblegen(eintrag, png, volumePfad) {
  const datei = dateiName(eintrag);
  if (!datei) throw new Error('Eintrag hat keinen Dateinamen');
  const ordner = path.join(volumePfad, 'firmenlogos');
  await fs.mkdir(ordner, { recursive: true });
  const ziel = path.join(ordner, datei);
  await fs.writeFile(ziel, png);
  return ziel;
}

/**
 * Gemessene Farben auf die wirklich verschiedenen eindampfen, hoechstens drei.
 * Am Ball-z-Logo gemessen kamen #FAFBFA, #45E916 und #E0E0E0 heraus - zwei davon sind dasselbe
 * Weiss, und ein Rand aus "weiss, gruen, weiss" waere schlicht ein weisser Rand. Gemessen liegen
 * die beiden 79 auseinander (Summe der Kanalabstaende), die gruene 300 bis 400 von beiden weg -
 * die Grenze liegt darum bei 90: Grautoene fallen zusammen, echte Farben bleiben getrennt.
 * Reine Rechnung, damit die Abnahme sie ohne Bild nachrechnen kann.
 */
export function farbenKuerzen(farben) {
  const raus = [];
  for (const c of (farben || [])) {
    if (!c || !Number.isFinite(c.r)) continue;
    if (raus.some(v => Math.abs(v.r - c.r) + Math.abs(v.g - c.g) + Math.abs(v.b - c.b) < 90)) continue;
    raus.push(c);
    if (raus.length === 3) break;
  }
  return raus.map(c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase());
}

/**
 * Die Farben des Rands zu einer Firma: erst die im Eintrag hinterlegten (sie gewinnen, weil ein
 * Mensch sie gesetzt hat), sonst am Logo GEMESSEN - nie geraten.
 */
export async function firmenFarben(eintrag, messen, volumePfad = '', seiteFarben = []) {
  const gesetzt = (eintrag && Array.isArray(eintrag.farben) ? eintrag.farben : [])
    .map(h => String(h).toUpperCase()).filter(h => /^#[0-9A-F]{6}$/.test(h));
  if (gesetzt.length) return gesetzt;
  const png = await logoBild(eintrag, volumePfad);
  if (!png || typeof messen !== 'function') return [];
  // 23. Sept.: hier stand farbenKuerzen - Sortierung nach FLAECHE. Damit wurde bei DTF Express
  // Schwarz (73,9 %) zur Hausfarbe und das Gruen fiel raus. hausfarben() entscheidet richtig
  // (unbunt fuehrt nie; bei einem Logo aus vielen kleinen bunten Teilen entscheidet die
  // Webseite). Die Seitenfarben kommen aus dem Nachweis - hat ihn niemand, bleibt es beim Logo.
  try { return hausfarben(await messen(png), seiteFarben || []); }
  catch (e) { return []; }
}

/**
 * Der Bestellzettel-Zusatz: die Bild-KI haelt eine Ecke ruhig, das Logo kommt danach als Aufkleber
 * darauf - genau wie beim Wappen. Sie zeichnet es NIE selbst: ein nachgezeichnetes Firmenlogo ist
 * kein Logo mehr, sondern eine Faelschung.
 */
// 26. Sept., Markus: "Fang nicht schon wieder an, das Logo da drauf hinzusetzen, sondern schreib
// den Prompt so, dass alles ums Logo gebaut wird. Es ist doch schon wieder einfach nur
// draufgesetzt, ich seh es doch sofort. Es funktioniert nicht, das einfache Draufsetzen."
// Hier stand der Gegenentwurf, woertlich: "a small company logo will be STUCK onto the finished
// card afterwards, LIKE A STICKER". Der Satz ging an kein Modell mehr (der Aufruf im Server stand
// hinter einer Bedingung, die nie wahr wurde), aber er stand da und haette jederzeit wieder
// gegriffen. Das Logo geht als VORLAGE in den Auftrag, und der Auftrag baut das Design um das
// Logo herum.
export function logoPromptBlock() { return ''; }

/**
 * Helligkeit der SICHTBAREN Pixel eines Logos (0 = schwarz, 255 = weiss).
 * Die durchsichtigen zaehlen nicht mit - sonst waere jedes freigestellte Logo "dunkel",
 * weil ringsum nichts steht.
 */
export async function logoHelle(png, { perzentil = 0 } = {}) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const werte = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const a = info.channels === 4 ? data[i + 3] : 255;
    if (a < 128) continue;
    werte.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  if (!werte.length) return 128;
  // Ohne Perzentil der Mittelwert (fuer die Frage "helles oder dunkles Logo?").
  if (!perzentil) return werte.reduce((s, v) => s + v, 0) / werte.length;
  // MIT Perzentil die Farbe der HAUPTSCHRIFT. Das Ball-z-Logo ist weiss mit einem gruenen
  // Zeichen; im Mittel kam 204 heraus, und danach gewann ein weisses Band mit drei Punkten
  // Vorsprung vor dem gruenen - weisse Schrift auf weissem Band. Gemessen am oberen Ende
  // (90 Prozent) sind es 250, und damit gewinnt Gruen um Laengen.
  werte.sort((a, b) => a - b);
  return werte[Math.min(werte.length - 1, Math.floor(werte.length * perzentil))];
}


/**
 * Welche Farbe traegt das Band unter dem Logo?
 *
 * 22. Sept., Markus: "Das Logo muss anders eingearbeitet werden." Eingearbeitet heisst: es muss
 * dort auch LESBAR sein. Das Ball-z-Logo hat ZWEI Farben, weiss und gruen. Ein weisses Band
 * verschluckt die Schrift, ein gruenes verschluckt das Zeichen - gemessen: auf Gruen blieb vom
 * "b" nichts uebrig. Gesucht ist also die Farbe mit dem groessten Abstand zu BEIDEN Enden des
 * Logos. Reichen die gemessenen Firmenfarben dafuer nicht, kommen ein sehr dunkler und ein sehr
 * heller Ton dazu - die sind nicht schutzfaehig und stehen bei fast jeder Marke ohnehin daneben.
 * Reine Rechnung, damit die Abnahme sie ohne Bild nachrechnen kann.
 */
export function bandFarbeFuerLogo(farben, { hell, dunkel }) {
  const werte = (farben || []).filter(h => /^#[0-9A-Fa-f]{6}$/.test(String(h || '')));
  const kandidaten = werte.concat(['#111827', '#FFFFFF']);
  const helligkeit = (h) => { const n = h.replace('#', ''); return 0.299 * parseInt(n.slice(0, 2), 16) + 0.587 * parseInt(n.slice(2, 4), 16) + 0.114 * parseInt(n.slice(4, 6), 16); };
  let beste = kandidaten[0], bester = -1;
  for (const k of kandidaten) {
    const h = helligkeit(k);
    // Der SCHLECHTESTE Abstand zaehlt - eine Farbe taugt nur, wenn beide Logo-Toene darauf stehen.
    const wert = Math.min(Math.abs(h - hell), Math.abs(h - dunkel));
    // Eine gemessene Firmenfarbe gewinnt bei Gleichstand gegen den Notnagel.
    const bonus = werte.includes(k) ? 12 : 0;
    if (wert + bonus > bester) { bester = wert + bonus; beste = k; }
  }
  return { farbe: beste, abstand: Math.round(bester) };
}

/** Mittlere Helligkeit eines Ausschnitts der Karte. */
export async function flaecheHelle(kartePng, { left, top, width, height }) {
  const stats = await sharp(kartePng).extract({ left, top, width, height }).greyscale().stats();
  return stats.channels[0].mean;
}

/**
 * Das Logo auf die fertige Karte setzen - dieselbe Rechnung wie beim Wappen, mit einem Zusatz:
 *
 * Gemessen am echten Ball-z-Logo (1495x512 von ball-z.de): es ist WEISS auf durchsichtig. Auf
 * einem hellen Kartenhimmel waere davon nichts zu sehen - das Logo waere da und trotzdem
 * unsichtbar, und niemand haette es gemerkt. Also wird die Helligkeit beider Seiten gemessen;
 * liegen sie zu dicht beieinander, kommt eine weiche Platte in der Gegenfarbe darunter, so wie
 * ein Aufkleber sie mitbringt. Ist der Unterschied gross genug, bleibt das Logo nackt.
 */
export async function logoAufKarte(kartePng, logoPng, { anteil = 0.16, rand = 0.14, ecke = 'or', mindestKontrast = 60, randBreite = 0.12, fussPx = 0 } = {}) {
  const km = await sharp(kartePng).metadata();
  const W = km.width, H = km.height;
  // Im Rand muss das Logo in das Band passen: hoechstens zwei Drittel der Randbreite hoch,
  // damit ueber und unter ihm Luft bleibt und der Beschnitt es nicht anschneidet.
  const fussHoehe = fussPx || Math.round(H * randBreite);
  const anteilJetzt = ecke === 'rand' ? Math.min(anteil, (fussHoehe * 0.6) / H) : anteil;
  const hoehe = Math.max(24, Math.round(H * anteilJetzt));
  const logo = await sharp(logoPng).ensureAlpha().resize({ height: hoehe, kernel: 'lanczos3' }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  // 22. Sept., Markus ("???"): erst sass das Logo im Gesicht, dann auf der Unterschrift. Auf
  // dieser Karte sind alle vier Ecken vergeben - zwei vom Kopf, eine von der Handschrift, eine
  // von Koordinaten und Datum. Ein Aufkleber findet da keinen Platz, und soll ihn auch nicht
  // suchen: auf einer gedruckten Postkarte steht das Zeichen des Absenders IM RAND, unten,
  // wie der Vermerk des Druckers. Da deckt es nie etwas zu, weil im Rand nichts stehen darf.
  const imRand = ecke === 'rand';
  const mitte = ecke === 'mitte';
  const rechts = /r$/.test(ecke), unten = /^u/.test(ecke);
  const links = (imRand || mitte) ? Math.round((W - lm.width) / 2) : (rechts ? W - Math.round(W * rand) - lm.width : Math.round(W * rand));
  const oben = imRand ? Math.round(H - fussPx / 2 - lm.height / 2)
    : (mitte ? Math.round((H - lm.height) / 2) : (unten ? H - Math.round(H * rand) - lm.height : Math.round(H * rand)));

  const logoHell = await logoHelle(logo);
  const grundHell = await flaecheHelle(kartePng, {
    left: Math.max(0, links), top: Math.max(0, oben),
    width: Math.min(lm.width, W - Math.max(0, links)), height: Math.min(lm.height, H - Math.max(0, oben))
  });
  const kontrast = Math.abs(logoHell - grundHell);
  const auflagen = [];
  if (kontrast < mindestKontrast) {
    // Platte in der Gegenrichtung des Logos: helles Logo -> dunkle Platte und umgekehrt.
    const luft = Math.round(hoehe * 0.16);
    const pb = lm.width + 2 * luft, ph = lm.height + 2 * luft, r = Math.round(hoehe * 0.14);
    const ton = logoHell >= 128 ? '17,24,39' : '255,255,255';
    const platte = Buffer.from(`<svg width="${pb}" height="${ph}"><rect x="0" y="0" width="${pb}" height="${ph}" rx="${r}" ry="${r}" fill="rgba(${ton},0.82)"/></svg>`);
    auflagen.push({ input: await sharp(platte).png().toBuffer(), left: links - luft, top: oben - luft });
  }
  auflagen.push({ input: logo, left: links, top: oben });
  const png = await sharp(kartePng).composite(auflagen).png().toBuffer();
  return {
    png,
    lage: { x: links, y: oben, w: lm.width, h: lm.height, ecke },
    kontrast: { logo: Math.round(logoHell), grund: Math.round(grundHell), abstand: Math.round(kontrast), platte: auflagen.length > 1 }
  };
}

/**
 * Die Hausfarben einer Firma - aus dem Logo, bei Bedarf entschieden von der Webseite.
 *
 * Markus, 22. Sept., zu DTF Express: "Du sollst dir die Farben aus dem Logo ziehen. Ich glaube,
 * auf der Seite ist ganz schoen viel gruen, oder?" Er hatte in beidem recht, und farbenKuerzen
 * hat sich zweimal vertan. Gemessen:
 *   DTF-Logo: schwarz 73,9 % (Saettigung 0,10) · cyan 7,2 % · purpur 4,0 % · rot 3,9 %
 *             · gelb 3,7 % · blau 2,5 % · gruen 2,0 % · gold 1,7 %
 * farbenKuerzen sortiert nur nach FLAECHE und nimmt die ersten drei. Also wurde SCHWARZ zur
 * Hausfarbe erklaert - dabei ist es nur der Grund, auf dem die Schrift steht.
 *
 * Erste Regel: ein fast unbunter Ton fuehrt nie. Er darf als Grund mitkommen, aber er regiert
 * die Karte nicht. Damit steht bei Ball-z das Gruen vorn (38 % der Flaeche) und bei
 * C.C.E. das Gold (26,8 %, Saettigung 0,97).
 *
 * Zweite Regel, fuer Logos wie das von DTF: ein Zeichen aus vielen gleich grossen bunten Teilen
 * hat gar keine dominante Farbe - die groesste kommt auf 7,2 %. Dann entscheidet die Webseite,
 * denn dort steht die Hausfarbe im Stylesheet: auf dtf-express.de achtmal #95C11F, ein
 * kraeftiges Limegruen. Genommen wird sie nur, wenn sie auch im Logo vorkommt (dort gemessen
 * als rgb(115,169,59) und rgb(144,180,60)) - sonst gewaennen die Farben der Bezahl-Symbole,
 * die auf jeder Shopseite stehen.
 */
export function hausfarben(logoFarben, seiteFarben = [], { wieviele = 3, bunteSchwelle = 0.35, regenbogenUnter = 0.10 } = {}) {
  const saettigung = (c) => { const max = Math.max(c.r, c.g, c.b); return max ? (max - Math.min(c.r, c.g, c.b)) / max : 0; };
  const hell = (c) => Math.max(c.r, c.g, c.b);
  const nah = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 90;
  const istBunt = (c) => saettigung(c) >= bunteSchwelle && hell(c) >= 60;

  const brauchbar = (logoFarben || []).filter(c => c && Number.isFinite(c.r));
  const bunt = brauchbar.filter(istBunt);
  const grund = brauchbar.filter(c => !istBunt(c));

  // Regenbogen-Fall: keine der bunten Farben traegt das Zeichen. Dann fuehrt die Farbe, die die
  // Webseite am haeufigsten nennt UND die im Logo wirklich vorkommt.
  let fuehrend = null;
  if (!bunt.length || (bunt[0].share || 0) < regenbogenUnter) {
    fuehrend = (seiteFarben || [])
      .filter(s => istBunt(s) && bunt.some(c => nah(c, s)))
      .sort((a, b) => (b.n || 0) - (a.n || 0))[0] || null;
  }

  const raus = [];
  for (const c of [...(fuehrend ? [fuehrend] : []), ...bunt, ...grund]) {
    if (raus.some(v => nah(v, c))) continue;
    raus.push(c);
    if (raus.length === wieviele) break;
  }
  return raus.map(c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase());
}
