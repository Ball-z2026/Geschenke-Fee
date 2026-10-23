// EAST26 in der schlichten Linie auf cremefarbenem Textil (Markus, 4. Okt. abends: "auf cremefarbenes Textil mit
// diesem East-Design"). B&C "Natural" (E190) - Farbwert angenaehert. Shirt: Frontprint gross. Hoodie: vorne kleines
// Brustemblem, hinten der grosse Ruecken. Keine Bild-KI: Logo ist das Original, Schrift setzt der Code.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import * as M from '../mockups.js';
import { minimalMotiv, ortsZeile } from '../minimal-design.js';
import { lieblingsSatz } from '../partner.js';
const aus = process.argv[2] || '/tmp';
M.TEXTIL_FARBEN.natural = { hex: '#EDE3CF', hell: true, name: { tee: 'Natural', hoodie: 'Natural' } };
if (!M.FARB_TEILE.includes('hoodie')) M.FARB_TEILE.push('hoodie');
const f = JSON.parse(await fs.readFile('postkarte/firmen-freigaben.json', 'utf8'));
const e = (f.freigaben || f).find(x => /EAST/i.test(x.firma));
const logo = await fs.readFile('postkarte/logos/' + e.datei);
await M.ensureTemplates('./storage');
const gross = await minimalMotiv({ logo, lieblings: lieblingsSatz(e), ort: ortsZeile(e), punkt: e.punkt, zusatz: 'Clara · 02.10.2026', textil: 'hell' });
const tee = await M.makeMockup(gross.png, 'tee', 'white', false, { place: 'front', linie: 'bc', farbe: 'natural' });
await sharp(tee).resize(900).jpeg({ quality: 88 }).toFile(aus + '/east-creme-tee.jpg');
// 5. Okt., Markus: "das Brust Logo sitzt falsch und an dem dritten ist das ... viel zu hoch". Abgelesen am Raster der
// B&C-Hoodie-Vorlage (1024 px, Rumpf auf Brusthoehe x 340-690 = rund 58 cm, also 6 px/cm; Kragennaht y 175, Achsel y 290,
// Kordeln x 485/555 bis y 380, Tasche ab y 685): Brustemblem 8 cm breit auf der Herzseite (vom Betrachter rechts,
// rechts neben der Kordel), Mitte x 605, Oberkante y 262 (Achselhoehe). Grosser Druck: unter den Kordelspitzen
// beginnend (y 300), endet ueber der Tasche, hoechstens 32 cm breit.
const leer = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const hoodieLeer = await M.makeMockup(leer, 'hoodie', 'white', false, { place: 'front', linie: 'bc', farbe: 'natural' });
const hm = await sharp(hoodieLeer).metadata();
const k = hm.width / 1024;
const setzen = async (motiv, breiteCm, cx, oben, maxUnten) => {
  let b = await sharp(motiv).trim().resize({ width: Math.round(breiteCm * 6 * k) }).png().toBuffer();
  let m = await sharp(b).metadata();
  if (maxUnten && oben * k + m.height > maxUnten * k) { b = await sharp(b).resize({ height: Math.round((maxUnten - oben) * k) }).png().toBuffer(); m = await sharp(b).metadata(); }
  return sharp(hoodieLeer).composite([{ input: b, left: Math.round(cx * k - m.width / 2), top: Math.round(oben * k) }]).png().toBuffer();
};
const emblem = await minimalMotiv({ logo, lieblings: '', ort: ortsZeile(e), punkt: null, zusatz: '', textil: 'hell' });
const vorn = await setzen(emblem.png, 8, 605, 262);
const hinten = await setzen(gross.png, 30, 512, 300, 665);
for (const [n, b] of [['hoodie-vorn', vorn], ['hoodie-hinten', hinten]]) await sharp(b).resize(900).jpeg({ quality: 88 }).toFile(aus + '/east-creme-' + n + '.jpg');
console.log('ok', lieblingsSatz(e), '|', ortsZeile(e));
