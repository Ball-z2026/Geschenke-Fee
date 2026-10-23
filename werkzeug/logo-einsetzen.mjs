// Ein von der Bild-KI nachgezeichnetes Partner-Logo auf einem fertigen Artikelbild durch das ORIGINAL ersetzen.
// 4. Okt., Markus (EAST26-Shirt im Shop): "Warum wurde das Logo vom East hier verfremdet? Das Logo ist doch ganz klar."
// Je Bild: die Flaeche der gemalten Plakette (Ellipse oder Rechteck) wird mit ihrer eigenen Grundfarbe und
// Koernung gefuellt (Median und Streuung der hellen Pixel darin - die goldene Schrift faellt so heraus), dann
// kommt das Original-Logo unveraendert hinein (auf w x h eingepasst; ungleiche w/h = Neigung der Flaeche).
//   node werkzeug/logo-einsetzen.mjs <bild.jpg> <logo.png> <aus.jpg> '<json>'
//   json: { form: 'ellipse'|'rechteck', cx, cy, rx, ry  |  x0, y0, x1, y1,  logo: { cx, cy, w, h } }
import sharp from 'sharp';
const [, , bildDatei, logoDatei, ausDatei, js] = process.argv;
const a = JSON.parse(js);
const { data, info } = await sharp(bildDatei).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const drin = a.form === 'ellipse'
  ? (x, y) => ((x - a.cx) / a.rx) ** 2 + ((y - a.cy) / a.ry) ** 2 <= 1
  : (x, y) => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1;
// Grundfarbe der Plakette: die hellsten 60 % der Pixel in der Flaeche (Schrift ist dunkler)
const px = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (drin(x, y)) { const i = (y * W + x) * 3; px.push([data[i], data[i + 1], data[i + 2]]); }
px.sort((p, q) => (q[0] + q[1] + q[2]) - (p[0] + p[1] + p[2]));
const hell = px.slice(0, Math.max(1, Math.floor(px.length * 0.6)));
const kanal = (k) => { const v = hell.map(p => p[k]).sort((m, n) => m - n); return v[Math.floor(v.length / 2)]; };
const grund = [kanal(0), kanal(1), kanal(2)];
const streu = Math.sqrt(hell.reduce((s, p) => s + ((p[0] + p[1] + p[2]) / 3 - (grund[0] + grund[1] + grund[2]) / 3) ** 2, 0) / hell.length);
// fuellen, mit Koernung und weichem Rand (1,5 px)
let seed = 7; const zufall = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const out = Buffer.from(data);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!drin(x, y)) continue;
  let rand = 1;
  if (a.form === 'ellipse') { const d = Math.sqrt(((x - a.cx) / a.rx) ** 2 + ((y - a.cy) / a.ry) ** 2); rand = Math.min(1, (1 - d) * Math.min(a.rx, a.ry) / 1.5); }
  else rand = Math.min(1, (Math.min(x - a.x0, a.x1 - x, y - a.y0, a.y1 - y) + 0.5) / 1.5);
  const n = (zufall() - 0.5) * 2 * Math.min(streu, 14);
  const i = (y * W + x) * 3;
  for (let k = 0; k < 3; k++) out[i + k] = Math.round(out[i + k] * (1 - rand) + Math.max(0, Math.min(255, grund[k] + n)) * rand);
}
const L = a.logo;
const logo = await sharp(logoDatei).trim().resize(L.w, L.h, { fit: L.verzerren ? 'fill' : 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' }).png().toBuffer();
await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .composite([{ input: logo, left: Math.round(L.cx - L.w / 2), top: Math.round(L.cy - L.h / 2) }])
  .jpeg({ quality: 92 }).toFile(ausDatei);
console.log(ausDatei, 'Grund', grund.join(','), 'Streuung', streu.toFixed(1));
