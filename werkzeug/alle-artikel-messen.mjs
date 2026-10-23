import sharp from 'sharp';
import * as M from '../mockups.js';
import { ARTIKEL, verkaufsfaehig, flaechenVon, artikelLeinwand, ansichtVon } from '../artikel.js';
// Aufruf: node werkzeug/alle-artikel-messen.mjs <ordner> - legt je Artikel und Groesse ein Mockup (vorn und Szene) ab.
const SP = process.argv[2] || '/tmp';
await M.ensureTemplates('./storage');
const zeilen = [];
for (const aid of Object.keys(ARTIKEL)) {
  if (!verkaufsfaehig(aid)) continue;
  const a = ARTIKEL[aid];
  if (a.motivart !== 'vollflaechig') continue;
  const g = ansichtVon(aid) || aid;
  if (!M.GARMENTS[g]) { zeilen.push([aid, '-', 'keine Ansicht (' + g + ')']); continue; }
  for (const fl of Object.keys(flaechenVon(aid))) {
    const lw = artikelLeinwand(aid, fl);
    if (!lw) continue;
    const [pw, ph] = lw.px;
    const s = 1200 / Math.max(pw, ph);
    const w = Math.round(pw * s), h = Math.round(ph * s);
    // Rot mit dunklem Rand-Rahmen 2 %, damit man sieht, ob der Rand sichtbar bleibt
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#1450C8"/><rect x="${w*0.03}" y="${h*0.03}" width="${w*0.94}" height="${h*0.94}" fill="#C02020"/></svg>`;
    const img = await sharp(Buffer.from(svg)).png().toBuffer();
    for (const szene of [false, true]) {
      try {
        const jpg = await M.makeMockup(img, g, 'white', false, { place: 'front', artikel: { id: aid, ansicht: g, motivart: a.motivart, netto: lw.netto }, ansicht: szene ? 'szene' : undefined });
        const name = `${aid}_${fl}${szene ? '_szene' : ''}.jpg`;
        await sharp(jpg).resize({ width: 360 }).jpeg({ quality: 70 }).toFile(SP + '/alle/' + name);
        // Messen: wie viel der Box (vorn) ist NICHT rot/blau (= aufgefuellt)?
        let anteil = '';
        if (!szene) {
          const box = M.GARMENTS[g].box;
          const { data, info } = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
          let fremd = 0, n = 0;
          for (let y = box.y + 6; y < box.y + box.h - 6; y += 4) for (const x of [box.x + 8, box.x + box.w - 8]) {
            const i = (y * info.width + x) * info.channels; n++;
            const r = data[i], gg = data[i + 1], b = data[i + 2];
            const meins = (r > 110 && gg < 100 && b < 100) || (b > 110 && r < 100);
            if (!meins) fremd++;
          }
          for (let x = box.x + 8; x < box.x + box.w - 8; x += 4) for (const y of [box.y + 8, box.y + box.h - 8]) {
            const i = (y * info.width + x) * info.channels; n++;
            const r = data[i], gg = data[i + 1], b = data[i + 2];
            if (!((r > 110 && gg < 100 && b < 100) || (b > 110 && r < 100))) fremd++;
          }
          anteil = Math.round(100 * fremd / n) + ' % Rand nicht Motiv';
        }
        zeilen.push([aid, fl + (szene ? ' szene' : ''), anteil || 'ok']);
      } catch (e) { zeilen.push([aid, fl + (szene ? ' szene' : ''), 'FEHLER ' + e.message.slice(0, 80)]); }
    }
  }
}
for (const z of zeilen) console.log(z.join(' | '));
