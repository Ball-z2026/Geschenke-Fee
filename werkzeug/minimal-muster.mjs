// Muster der schlichten Linie fuer die drei Partner: Shirt und Hoodie, je mit und ohne Name/Datum.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import * as M from '../mockups.js';
import { minimalMotiv, ortsZeile } from '../minimal-design.js';
import { lieblingsSatz } from '../partner.js';
const aus = process.argv[2] || '/tmp';
const f = JSON.parse(await fs.readFile('postkarte/firmen-freigaben.json', 'utf8'));
const liste = (f.freigaben || f).filter(e => /EAST|Luigi|Elbdeich/i.test(e.firma));
await M.ensureTemplates('./storage');
const kacheln = [];
for (const e of liste) {
  const logo = await fs.readFile('postkarte/logos/' + e.datei);
  for (const [teil, zusatz] of [['tee', ''], ['hoodie', 'Clara · 02.10.2026']]) {
    const r = await minimalMotiv({ logo, lieblings: lieblingsSatz(e), ort: ortsZeile(e), punkt: e.punkt, zusatz });
    const farbe = r.textil === 'hell' ? 'white' : 'black';
    const jpg = await M.makeMockup(r.png, teil, farbe, false, { place: 'front' });
    const datei = `${aus}/minimal-${(e.anzeige || e.firma).replace(/[^A-Za-z0-9]/g, '')}-${teil}.jpg`;
    await sharp(jpg).resize(600).jpeg({ quality: 86 }).toFile(datei);
    kacheln.push(datei);
    console.log(e.firma, teil, farbe, lieblingsSatz(e), '|', ortsZeile(e));
  }
}
const comp = kacheln.map((k, i) => ({ input: k, left: (i % 2) * 606, top: Math.floor(i / 2) * 606 }));
await sharp({ create: { width: 1212, height: Math.ceil(kacheln.length / 2) * 606, channels: 3, background: '#fff' } }).composite(comp).jpeg({ quality: 85 }).toFile(aus + '/minimal-bogen.jpg');
