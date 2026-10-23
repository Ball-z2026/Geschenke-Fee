// Roly als Mockup-Vorlage (6. Okt., Markus: "Mal was von Roly, mal was von Stanley/Stella und das auch dazuschreiben" - und "der
// Kunde muss bei jedem Design die Auswahl haben, welches Textil er sich danach aussucht"). Bis hierher zeigte "Ottos Starter" das
// Design auf dem B&C-Shirt, weil Roly keine Vorlage hatte; die Freigabe von Roly (textilien.js MARKEN.roly, 25. Sept.) erlaubt es.
// Quelle: textil-bilder/roly-<teil>_<farbe>[_back].jpg (static.gorfactory.es, 600 x 600, unveraendert; vorn _1_, hinten _2_, am
// 25. Sept. einzeln angesehen). Wie Stand 84: 1024 px, Textil 850 px hoch und mittig. Die Druckflaeche ist an der B&C-Vorlage
// desselben Teils GEEICHT: dieselben Anteile an Saumbreite und Hoehe - so sitzt das Motiv auf dem Roly-Shirt wie auf dem B&C-Shirt.
// Hinten wie werkzeug/ruecken-vorlagen.mjs (Stanley/Stella hinten), ebenfalls geeicht.
//   node werkzeug/roly-vorlagen.mjs   schreibt vorlagen-original/roly-<teil>[-ruecken]_<farbe>.jpg und gibt die Flaechen aus
import sharp from 'sharp';
import { MITGELIEFERT } from '../mockups.js';

async function silhouette(datei) {
  const { data, info } = await sharp(datei).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, bg = [data[0], data[1], data[2]];
  const ist = (x, y) => { const i = (y * W + x) * 3; return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 24; };
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ist(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  // Breite auf 85 % der Hoehe: unten ist der Saum mancher Teile rund geschnitten (Roly hinten) - dort waere er zu schmal
  const yS = y0 + Math.round((y1 - y0) * 0.85); let s0 = W, s1 = 0;
  for (let x = 0; x < W; x++) if (ist(x, yS)) { if (x < s0) s0 = x; if (x > s1) s1 = x; }
  return { x0, x1, y0, y1, saum: s1 - s0, bg };
}
async function normieren(quelle, ziel) {
  const s = await silhouette(quelle);
  const k = 850 / (s.y1 - s.y0 + 1), bw = Math.round((s.x1 - s.x0 + 1) * k);
  const textil = await sharp(quelle).extract({ left: s.x0, top: s.y0, width: s.x1 - s.x0 + 1, height: s.y1 - s.y0 + 1 }).resize(bw, 850, { kernel: 'lanczos3' }).toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: s.bg[0], g: s.bg[1], b: s.bg[2] } } })
    .composite([{ input: textil, left: Math.round((1024 - bw) / 2), top: 87 }]).jpeg({ quality: 92 }).toFile(ziel);
  return silhouette(ziel);
}
// Eichung: Anteile der Flaeche an der Silhouette der Referenzvorlage
async function anteile(refKey, farbe) {
  const m = MITGELIEFERT[refKey]; const box = (m.boxen && m.boxen[farbe]) || m.box;
  const s = await silhouette('vorlagen-original/' + m.dateien[farbe]);
  return { w: box.w / s.saum, y: (box.y - s.y0) / (s.y1 - s.y0), h: box.h / box.w, mitte: (box.x + box.w / 2 - (s.x0 + s.x1) / 2) };
}
const PLAN = [
  { teil: 'tee', ref: 'bc-tee', ziel: 'roly-tee', quelle: 'roly-tee' },
  { teil: 'polo', ref: 'bc-polo', ziel: 'roly-polo', quelle: 'roly-polo' },
  { teil: 'hoodie', ref: 'bc-hoodie', ziel: 'roly-hoodie', quelle: 'roly-hoodie' },
  { teil: 'tee', ref: 'tee-ruecken', ziel: 'roly-tee-ruecken', quelle: 'roly-tee', hinten: true },
  { teil: 'hoodie', ref: 'hoodie-ruecken', ziel: 'roly-hoodie-ruecken', quelle: 'roly-hoodie', hinten: true }
];
const erg = {};
for (const p of PLAN) {
  erg[p.ziel] = {};
  for (const farbe of ['white', 'black']) {
    const a = await anteile(p.ref, farbe);
    const s = await normieren(`textil-bilder/${p.quelle}_${farbe}${p.hinten ? '_back' : ''}.jpg`, `vorlagen-original/${p.ziel}_${farbe}.jpg`);
    const w = Math.round(s.saum * a.w), h = Math.round(w * a.h);
    erg[p.ziel][farbe] = { x: Math.round((s.x0 + s.x1) / 2 + a.mitte - w / 2), y: Math.round(s.y0 + a.y * (s.y1 - s.y0)), w, h };
  }
}
console.log(JSON.stringify(erg));
