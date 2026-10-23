// Shop-Bilder Shirt + Hoodie fuer einen Partner nach CLAUDE.md 9, 9a, 9b (Markus, 5. Okt.: "Luigi und Elbdeich gleich bitte").
// Motiv und Stoff werden ZUSAMMEN gewaehlt, jedes Motiv laeuft vor dem Setzen durch werkzeug/selbstpruefung.mjs - faellt es
// durch, wird NICHTS geschrieben. Abgelesen am Raster der B&C-Vorlagen (1024 px):
//   T-Shirt: Rumpf auf Brusthoehe x 315-710 (rund 53 cm, 7,5 px/cm), Kragennaht y 150; Frontdruck oben ab y 250.
//   Hoodie:  Regel 9 - Brustemblem 8 cm, Herzseite, Mitte x 605, Oberkante y 262 (6 px/cm).
//   node werkzeug/partner-textil.mjs <EAST|Luigi|Elbdeich> <weiss|natural> <aus> [tee-motiv.png tee-breite-cm]
import sharp from 'sharp';
import fs from 'node:fs/promises';
import * as M from '../mockups.js';
import { minimalMotiv, ortsZeile } from '../minimal-design.js';
import { lieblingsSatz } from '../partner.js';
import { pruefen } from './selbstpruefung.mjs';

const [wer, stoffName, aus, teeMotivDatei, teeBreite] = process.argv.slice(2);
const STOFFE = { weiss: { hex: '#FFFFFF', farbe: '' }, natural: { hex: '#EDE3CF', farbe: 'natural' } };
const stoff = STOFFE[stoffName];
if (!stoff || !aus) { console.log('node werkzeug/partner-textil.mjs <Name> <weiss|natural> <aus> [motiv.png breite-cm]'); process.exit(1); }
M.TEXTIL_FARBEN.natural = { hex: '#EDE3CF', hell: true, name: { tee: 'Natural', hoodie: 'Natural' } };
if (!M.FARB_TEILE.includes('hoodie')) M.FARB_TEILE.push('hoodie');

const f = JSON.parse(await fs.readFile('postkarte/firmen-freigaben.json', 'utf8'));
const e = (f.freigaben || f).find(x => new RegExp(wer, 'i').test(x.firma));
const logo = await fs.readFile('postkarte/logos/' + e.datei);
await M.ensureTemplates('./storage');
const leer = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const opts = { place: 'front', linie: 'bc', ...(stoff.farbe ? { farbe: stoff.farbe } : {}) };

async function setzen(teil, motiv, breiteCm, pxCm, cx, oben) {
  const grund = await M.makeMockup(leer, teil, 'white', false, opts);
  const k = (await sharp(grund).metadata()).width / 1024;
  const b = await sharp(motiv).trim().resize({ width: Math.round(breiteCm * pxCm * k) }).png().toBuffer();
  const m = await sharp(b).metadata();
  return sharp(grund).composite([{ input: b, left: Math.round(cx * k - m.width / 2), top: Math.round(oben * k) }]).png().toBuffer();
}
async function geprueft(name, motiv, breiteCm) {
  const r = await pruefen(motiv, stoff.hex, breiteCm);
  console.log(`${r.ok ? 'OK          ' : 'NICHT ZEIGEN'} ${name} auf ${stoffName}: unsichtbar ${r.unsichtbar} % · Placken ${r.placken} % · Farbbiss ${r.beisst} %${r.fehler.length ? ' -> ' + r.fehler.join('; ') : ''}`);
  return r.ok;
}

const slug = (e.anzeige || e.firma).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
// T-Shirt: eigenes Motiv (z. B. Luigis Karton) oder die schlichte Linie gross
let teeMotiv, teeCm;
if (teeMotivDatei) { teeMotiv = await fs.readFile(teeMotivDatei); teeCm = +teeBreite || 18; }
else { teeMotiv = (await minimalMotiv({ logo, lieblings: lieblingsSatz(e), ort: ortsZeile(e), punkt: e.punkt, zusatz: 'Clara · 02.10.2026', textil: 'hell' })).png; teeCm = 26; }
const emblem = (await minimalMotiv({ logo, lieblings: '', ort: ortsZeile(e), punkt: null, zusatz: '', textil: 'hell' })).png;
const okTee = await geprueft(slug + ' Shirt', teeMotiv, teeCm);
const okHoodie = await geprueft(slug + ' Hoodie-Emblem', emblem, 8);
if (!okTee || !okHoodie) { console.log('Nicht gesetzt - erst das Motiv aendern.'); process.exit(1); }
const tee = await setzen('tee', teeMotiv, teeCm, 7.5, 512, 250);
const hoodie = await setzen('hoodie', emblem, 8, 6, 605, 262);
for (const [n, b] of [['tee', tee], ['hoodie', hoodie]]) await sharp(b).resize(900, 900, { fit: 'contain', background: '#fff' }).jpeg({ quality: 90 }).toFile(`${aus}/${slug}-${n}.jpg`);
console.log('geschrieben:', `${aus}/${slug}-tee.jpg`, `${aus}/${slug}-hoodie.jpg`);
