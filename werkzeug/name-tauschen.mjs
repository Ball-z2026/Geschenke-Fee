// Namen in einem fertigen Vorzeige-Bild tauschen, ohne den Rest anzufassen (9. Okt., Markus: Hochzeits-Bilder mit gesperrtem Vornamen neu bauen).
// Schritt "aus": schneidet den Namensbereich (Anteile 0..1) aus, dehnt ihn auf eine erlaubte Groesse fuer den Bilddienst
//   (Vielfache von 16, mind. 655.360 Pixel, Verhaeltnis hoechstens 3:1) und schreibt <name>_aus.png + <name>_box.json.
// Schritt "ein": legt das bearbeitete Stueck auf die Originalgroesse zurueck und setzt NUR diesen Bereich mit weicher
//   Kante (24 px) auf das Original - alles andere bleibt pixelgleich. Alphakanal bleibt erhalten.
// Aufruf: node werkzeug/name-tauschen.mjs aus <bild> <x> <y> <w> <h> <ziel-praefix>
//         node werkzeug/name-tauschen.mjs ein <bild> <bearbeitet.png> <ziel-praefix> <ausgabe.png>
import fs from 'node:fs/promises';
import sharp from 'sharp';
const [,, schritt, bild, ...rest] = process.argv;
const meta = await sharp(bild).metadata();
if (schritt === 'aus') {
  const [x, y, w, h, praefix] = rest;
  let box = { left: Math.round(meta.width * x), top: Math.round(meta.height * y), width: Math.round(meta.width * w), height: Math.round(meta.height * h) };
  if (box.width / box.height > 3) { const nh = Math.ceil(box.width / 3); box.top = Math.max(0, box.top - Math.round((nh - box.height) / 2)); box.height = Math.min(nh, meta.height - box.top); }
  // mind. 655.360 Pixel, hoechstens 3840 px Kante und 8,29 Megapixel (Grenzen des Bilddienstes)
  const faktor = Math.min(Math.max(1, Math.sqrt(700000 / (box.width * box.height))), 3824 / Math.max(box.width, box.height), Math.sqrt(8000000 / (box.width * box.height)));
  let ew = Math.round(box.width * faktor / 16) * 16, eh = Math.round(box.height * faktor / 16) * 16;
  while (ew / eh > 3) ew -= 16;   // nach dem Runden nie ueber 3:1
  await sharp(bild).extract(box).resize(ew, eh, { fit: 'fill', kernel: 'lanczos3' }).png().toFile(praefix + '_aus.png');
  await fs.writeFile(praefix + '_box.json', JSON.stringify({ box, ew, eh }));
  console.log(JSON.stringify({ box, groesse: ew + 'x' + eh }));
} else if (schritt === 'ein') {
  const [bearbeitet, praefix, ausgabe] = rest;
  const { box } = JSON.parse(await fs.readFile(praefix + '_box.json', 'utf8'));
  const stueck = await sharp(bearbeitet).ensureAlpha().resize(box.width, box.height, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
  // Weiche Kante: Deckung 0 am Rand, 1 ab 24 px nach innen
  const R = 24, out = Buffer.from(stueck);
  for (let yy = 0; yy < box.height; yy++) for (let xx = 0; xx < box.width; xx++) {
    const d = Math.min(xx, yy, box.width - 1 - xx, box.height - 1 - yy), a = Math.min(1, d / R);
    out[(yy * box.width + xx) * 4 + 3] = Math.round(stueck[(yy * box.width + xx) * 4 + 3] * a);
  }
  const orig = await sharp(bild).ensureAlpha().raw().toBuffer();
  const W = meta.width;
  for (let yy = 0; yy < box.height; yy++) for (let xx = 0; xx < box.width; xx++) {
    const s = (yy * box.width + xx) * 4, o = ((box.top + yy) * W + box.left + xx) * 4;
    const d = Math.min(xx, yy, box.width - 1 - xx, box.height - 1 - yy), a = Math.min(1, d / R);
    for (let c = 0; c < 4; c++) orig[o + c] = Math.round(orig[o + c] * (1 - a) + stueck[s + c] * a);
  }
  let img = sharp(orig, { raw: { width: W, height: meta.height, channels: 4 } });
  if (!meta.hasAlpha) img = img.removeAlpha();
  await img.png().toFile(ausgabe);
  console.log('eingesetzt', ausgabe, JSON.stringify(box));
}
