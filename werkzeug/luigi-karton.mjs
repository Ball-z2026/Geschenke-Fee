// Muster Luigi, NUR der Karton - gestaltet wie ein echter Pizzakarton (Markus, 4. Okt.: "vollkommen lieblos. Jetzt fehlt
// Jesteburg, das Datum fehlt ... mal ne italienische Flagge. Schau dir doch im Internet mal an, wie die Pizzakartons
// normalerweise aussehen"). Recherche: wenige Druckfarben (Rot, Gruen, Schwarz) auf Kraft, Karo-Rand, Tricolore,
// "Buon Appetito", der Ort, die Ankreuzliste der Sorten, die der Baecker mit Stift abhakt.
// Deckel = Magenta-Flaeche, Vorderseite = Cyan-Flaeche (traeger-druck.js rechnet beides perspektivisch hinein).
import sharp from 'sharp';
import * as M from '../mockups.js';
import { koordinatenText } from '../minimal-design.js';
import { aufMagenta, flaechenMitte } from '../traeger-druck.js';
const [, , quelle, S] = process.argv;
const name = 'Clara', datum = '02.10.2026', ort = 'JESTEBURG', punkt = [53.3121, 9.9647];
const kraft = [205, 170, 125], KRAFT = '#CDAA7D', ROT = '#C8262B', GRUEN = '#1F7A3A', SCHWARZ = '#231F1A';
const D = 1000;
// Karo-Rand
let karo = ''; const k = 30;
for (let i = 0; i * k < D; i++) for (const [x, y] of [[i * k, 0], [i * k, D - k], [0, i * k], [D - k, i * k]]) if (i % 2 === 0) karo += `<rect x="${x}" y="${y}" width="${k}" height="${k}" fill="${ROT}"/>`;
const flagge = (x, y, w, h, kipp) => `<g transform="rotate(${kipp} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w / 3}" height="${h}" fill="${GRUEN}"/><rect x="${x + w / 3}" y="${y}" width="${w / 3}" height="${h}" fill="#F4EEE2"/><rect x="${x + 2 * w / 3}" y="${y}" width="${w / 3}" height="${h}" fill="${ROT}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${SCHWARZ}" stroke-width="2"/></g>`;
const sorten = ['Margherita', 'Salami', 'Funghi', 'Tonno'];
const liste = sorten.map((s, i) => `<rect x="90" y="${770 + i * 44}" width="26" height="26" fill="none" stroke="${SCHWARZ}" stroke-width="3"/><text x="130" y="${792 + i * 44}" font-family="Archivo" font-weight="700" font-size="26" letter-spacing="2" fill="${SCHWARZ}">${s.toUpperCase()}</text>`).join('');
const haken = `<path d="M 86 782 L 102 802 L 128 760" fill="none" stroke="#1d2b5a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}">
  <rect width="${D}" height="${D}" fill="${KRAFT}"/>${karo}
  <rect x="${k + 10}" y="${k + 10}" width="${D - 2 * k - 20}" height="${D - 2 * k - 20}" fill="none" stroke="${GRUEN}" stroke-width="4"/>
  <text x="${D / 2}" y="150" text-anchor="middle" font-family="Alfa Slab One" font-size="54" letter-spacing="2" fill="${ROT}">MEINE LIEBLINGSPIZZA</text>
  <path d="M 230 560 L 770 560 L 750 590 L 770 620 L 230 620 L 250 590 Z" fill="${ROT}"/>
  <text x="${D / 2}" y="606" text-anchor="middle" font-family="Alfa Slab One" font-size="46" letter-spacing="10" fill="#F4EEE2">${ort}</text>
  ${flagge(150, 565, 66, 48, -6)}${flagge(784, 565, 66, 48, 6)}
  ${liste}${haken}
  <g transform="rotate(-7 760 830)">
    <text x="760" y="820" text-anchor="middle" font-family="Caveat" font-weight="600" font-size="84" fill="#1d2b5a">für ${name} ♡</text>
    <text x="760" y="890" text-anchor="middle" font-family="Caveat" font-weight="600" font-size="58" fill="#1d2b5a">${datum}</text>
  </g>
</svg>`);
const logo = await sharp('postkarte/logos/luigis-pizza.png').trim().resize({ width: 560, height: 340, fit: 'inside' }).png().toBuffer();
const lm = await sharp(logo).metadata();
const deckel = await sharp(svg).composite([{ input: logo, left: Math.round((D - lm.width) / 2), top: Math.round(360 - lm.height / 2) }]).png().toBuffer();
await sharp(deckel).resize(600).jpeg({ quality: 90 }).toFile(S + '/luigi-deckel-flach.jpg');
// Vorderseite
const VW = 1400, VH = 160;
const vorn = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}"><rect width="${VW}" height="${VH}" fill="${KRAFT}"/>
  ${flagge(40, 52, 72, 52, 0)}${flagge(VW - 112, 52, 72, 52, 0)}
  <text x="${VW / 2}" y="${VH * 0.6}" text-anchor="middle" font-family="Archivo" font-weight="700" font-size="31" letter-spacing="4" fill="${SCHWARZ}">${ort} · ${koordinatenText(punkt)} · ${datum}</text></svg>`);
const { data, info } = await sharp(quelle).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 3; i < data.length; i += 4) if (data[i] < 96) data[i] = 0;
let bild = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
// Linke Seite (Gelb): Luigis Anschrift
const seite = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${VW}" height="${VH}"><rect width="${VW}" height="${VH}" fill="${KRAFT}"/>
  <text x="${VW / 2}" y="${VH * 0.6}" text-anchor="middle" font-family="Archivo" font-weight="700" font-size="34" letter-spacing="5" fill="${ROT}">LUIGI'S PIZZA · HARBURGER STRASSE 10 · 21266 JESTEBURG</text></svg>`);
const vorneMitte = await flaechenMitte(bild, 'cyan');
bild = (await aufMagenta(bild, deckel, { grund: kraft, farbe: 'magenta', unterkanteNahe: vorneMitte })).png;
bild = (await aufMagenta(bild, await sharp(vorn).png().toBuffer(), { grund: kraft, farbe: 'cyan' })).png;
try { bild = (await aufMagenta(bild, await sharp(seite).png().toBuffer(), { grund: kraft, farbe: 'gelb' })).png; } catch (e) { console.log('keine gelbe Seite'); }
const motiv = await sharp(bild).trim().png().toBuffer();
await sharp(motiv).toFile(S + '/luigi-karton3-motiv.png');
await sharp(motiv).flatten({ background: '#fff' }).resize(760).jpeg({ quality: 90 }).toFile(S + '/luigi-karton3-nah.jpg');
const mm = await sharp(motiv).metadata();
const L = Math.round(mm.width / 0.62);
const lein = await sharp({ create: { width: L, height: Math.max(mm.height, Math.round(L * 0.9)), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: motiv, left: Math.round((L - mm.width) / 2), top: 0 }]).png().toBuffer();
await M.ensureTemplates('./storage');
const jpg = await M.makeMockup(lein, 'tee', 'white', false, { place: 'front' });
await sharp(jpg).resize(900).jpeg({ quality: 88 }).toFile(S + '/luigi-karton3-shirt.jpg');
console.log('ok');
