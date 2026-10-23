// Muster Luigi: Szene mit Karton (Magenta-Deckel), Wagen, Heide - Deckeldruck perspektivisch exakt.
import sharp from 'sharp';
import * as M from '../mockups.js';
import { koordinatenText } from '../minimal-design.js';
import { aufMagenta } from '../traeger-druck.js';
const [, , quelle, S] = process.argv;
const D = 900, rot = '#C8262B', gruen = '#2E8B3D', tinte = '#231F1A';
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}">
  <rect width="${D}" height="${D}" fill="#EFE6D2"/>
  <rect x="34" y="34" width="${D - 68}" height="${D - 68}" fill="none" stroke="${gruen}" stroke-width="8"/>
  <rect x="50" y="50" width="${D - 100}" height="${D - 100}" fill="none" stroke="${rot}" stroke-width="4"/>
  <text x="${D / 2}" y="140" text-anchor="middle" font-family="Archivo" font-weight="700" font-size="40" letter-spacing="9" fill="${tinte}">MEINE LIEBLINGSPIZZA</text>
  <line x1="${D / 2 - 170}" y1="682" x2="${D / 2 + 170}" y2="682" stroke="${rot}" stroke-width="3"/>
  <text x="${D / 2}" y="752" text-anchor="middle" font-family="Playfair Display" font-weight="700" font-size="62" letter-spacing="12" fill="${tinte}">JESTEBURG</text>
  <text x="${D / 2}" y="808" text-anchor="middle" font-family="Archivo" font-weight="600" font-size="29" letter-spacing="4" fill="${gruen}">${koordinatenText([53.3121, 9.9647])}</text>
</svg>`);
const logo = await sharp('postkarte/logos/luigis-pizza.png').trim().resize({ width: 700, height: 450, fit: 'inside' }).png().toBuffer();
const lm = await sharp(logo).metadata();
const druck = await sharp(svg).composite([{ input: logo, left: Math.round((D - lm.width) / 2), top: Math.round(405 - lm.height / 2) }]).png().toBuffer();
// Schleier weg, dann Druck auf den Deckel
const { data, info } = await sharp(quelle).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 3; i < data.length; i += 4) if (data[i] < 96) data[i] = 0;
const sauber = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
const r = await aufMagenta(sauber, druck, { grund: [239, 230, 210] });
console.log('Ecken', JSON.stringify(r.ecken));
await sharp(r.png).toFile(S + '/luigi-szene-motiv.png');
await sharp(r.png).extract({ left: 100, top: 760, width: 840, height: 460 }).flatten({ background: '#fff' }).resize(800).jpeg({ quality: 90 }).toFile(S + '/luigi-szene-deckel.jpg');
await M.ensureTemplates('./storage');
const jpg = await M.makeMockup(r.png, 'tee', 'black', false, { place: 'front' });
await sharp(jpg).resize(900).jpeg({ quality: 88 }).toFile(S + '/luigi-szene-shirt.jpg');
