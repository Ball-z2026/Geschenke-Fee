// Muster: geschlossener Pizzakarton (von der Bild-KI mit LEEREM Deckel gemalt), der Deckeldruck kommt aus dem Code -
// Original-Logo, Lieblings-Satz, Ort, Koordinaten - und wird mit dem Deckel gedreht (Markus, 4. Okt.: "der geschlossene
// Pizzakarton mit dem Logo von Luigi obendrauf und mit Standort dort ein bisschen schoen gemacht").
//   node werkzeug/karton-deckel.mjs <karton.png> <aus-ordner>   (Deckel: Mitte 500/490, um -9 Grad gedreht)
import sharp from 'sharp';
import * as M from '../mockups.js';
import { koordinatenText } from '../minimal-design.js';
const [, , quelle, S] = process.argv;
const { data, info } = await sharp(quelle).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 3; i < data.length; i += 4) if (data[i] < 96) data[i] = 0;
let motiv = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
const D = 600, rot = '#C8262B', gruen = '#2E8B3D', tinte = '#231F1A';
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}">
  <rect x="22" y="22" width="${D - 44}" height="${D - 44}" fill="none" stroke="${gruen}" stroke-width="5"/>
  <rect x="32" y="32" width="${D - 64}" height="${D - 64}" fill="none" stroke="${rot}" stroke-width="2.5"/>
  <text x="${D / 2}" y="92" text-anchor="middle" font-family="Archivo" font-weight="700" font-size="25" letter-spacing="6" fill="${tinte}">MEINE LIEBLINGSPIZZA</text>
  <text x="${D / 2 - 232}" y="91" text-anchor="middle" font-size="20" fill="${rot}">★</text><text x="${D / 2 + 232}" y="91" text-anchor="middle" font-size="20" fill="${rot}">★</text>
  <line x1="${D / 2 - 110}" y1="452" x2="${D / 2 + 110}" y2="452" stroke="${rot}" stroke-width="2"/>
  <text x="${D / 2}" y="500" text-anchor="middle" font-family="Playfair Display" font-weight="700" font-size="40" letter-spacing="8" fill="${tinte}">JESTEBURG</text>
  <text x="${D / 2}" y="538" text-anchor="middle" font-family="Archivo" font-weight="600" font-size="19" letter-spacing="3" fill="${gruen}">${koordinatenText([53.3121, 9.9647])}</text>
</svg>`);
const logo = await sharp('postkarte/logos/luigis-pizza.png').trim().resize({ width: 470, height: 300, fit: 'inside' }).png().toBuffer();
const lm = await sharp(logo).metadata();
const deckel = await sharp({ create: { width: D, height: D, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: svg }, { input: logo, left: Math.round((D - lm.width) / 2), top: Math.round(270 - lm.height / 2) }]).png().toBuffer();
const gedreht = await sharp(deckel).rotate(-9, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const gm = await sharp(gedreht).metadata();
motiv = await sharp(motiv).composite([{ input: gedreht, left: Math.round(500 - gm.width / 2), top: Math.round(490 - gm.height / 2), blend: 'multiply' }]).png().toBuffer();
await sharp(motiv).toFile(S + '/luigi-zu-motiv.png');
await sharp(motiv).flatten({ background: '#ffffff' }).resize(700).jpeg({ quality: 88 }).toFile(S + '/luigi-zu-nah.jpg');
await M.ensureTemplates('./storage');
const jpg = await M.makeMockup(motiv, 'tee', 'white', false, { place: 'front' });
await sharp(jpg).resize(900).jpeg({ quality: 88 }).toFile(S + '/luigi-zu-shirt.jpg');
console.log('ok');
