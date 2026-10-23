// Beutel pruefen (Markus, 2. Okt.: "Bei einigen Beuteln war das Motiv nie so richtig richtig.")
// Drei Formate, die wirklich auf dem Beutel landen: das eigene Beutel-Motiv (30 x 30), ein deckendes
// Querformat (14,8 x 10,5) und ein Shirt-Motiv hoch (2:3) - je auf hellem und dunklem Beutel, vorn und Szene.
import sharp from 'sharp';
import * as M from '../mockups.js';
const ziel = process.argv[2] || '/tmp';
await M.ensureTemplates('./storage');
const probe = async (w, h, deckend) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${deckend ? `<rect width="100%" height="100%" fill="#1450C8"/><rect x="${w * .04}" y="${h * .04}" width="${w * .92}" height="${h * .92}" fill="#C02020"/>` : ''}<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * .38}" fill="#F2B705"/><text x="50%" y="54%" font-size="${Math.round(Math.min(w, h) / 7)}" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#111">MOTIV</text></svg>`)).png().toBuffer();
const faelle = [
  ['eigen-30x30', await probe(1200, 1200, false), { id: 'shopper', ansicht: 'beutel', motivart: 'freistehend', netto: [30, 30] }],
  ['quer-deckend', await probe(1400, 1000, true), null],
  ['shirt-hoch', await probe(1000, 1500, false), null]
];
for (const [name, png, artikel] of faelle) for (const farbe of ['white', 'black']) for (const szene of [false]) {
  try {
    const jpg = await M.makeMockup(png, 'beutel', farbe, false, { place: 'front', artikel: artikel || undefined, ansicht: szene ? 'szene' : undefined });
    await sharp(jpg).resize({ width: 420 }).jpeg({ quality: 72 }).toFile(`${ziel}/${name}_${farbe}${szene ? '_szene' : ''}.jpg`);
    console.log(name, farbe, szene ? 'szene' : 'vorn', 'ok');
  } catch (e) { console.log(name, farbe, szene ? 'szene' : 'vorn', 'FEHLER', e.message.slice(0, 100)); }
}
