// Schwarzes Textil auf einem fertigen Shop-Bild umfaerben (4. Okt. abends, Markus: "die ganzen schwarzen
// Textilien ... Ich moechte sie nicht mehr ... nur noch 10 %"). Keine Bild-KI: Druck und Original-Logo bleiben
// Pixel fuer Pixel, nur der Stoff bekommt eine Farbe. Stoff = grosse zusammenhaengende Flaeche aus fast schwarzen,
// unbunten Pixeln; Licht und Falten kommen aus der Helligkeit des schwarzen Stoffs.
//   node werkzeug/textil-umfaerben.mjs <ein.jpg> <aus.jpg> <#hex>
import sharp from 'sharp';

const [ein, aus, hex] = process.argv.slice(2);
if (!ein || !aus || !/^#[0-9a-f]{6}$/i.test(hex || '')) { console.log('node werkzeug/textil-umfaerben.mjs <ein> <aus> <#hex>'); process.exit(1); }
const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

const { data, info } = await sharp(ein).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, n = W * H;
const mx = (i) => Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
const unbunt = (i) => mx(i) - Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) < 20;
const kern = new Uint8Array(n);
for (let i = 0; i < n; i++) kern[i] = mx(i) < 80 && unbunt(i) ? 1 : 0;

// Zusammenhaengende Flaechen; nur grosse (ueber 3 % des Bildes) sind Stoff, kleine schwarze Stellen gehoeren zum Druck.
const lab = new Int32Array(n).fill(-1), groesse = [];
for (let s = 0; s < n; s++) {
  if (!kern[s] || lab[s] >= 0) continue;
  const id = groesse.length; let z = 0; const st = [s]; lab[s] = id;
  while (st.length) {
    const p = st.pop(); z++;
    const x = p % W, y = (p - x) / W;
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1])
      if (q >= 0 && kern[q] && lab[q] < 0) { lab[q] = id; st.push(q); }
  }
  groesse.push(z);
}
const stoff = new Uint8Array(n);
for (let i = 0; i < n; i++) if (lab[i] >= 0 && groesse[lab[i]] > n * 0.03) stoff[i] = 1;
// Kanten weich: Nachbarn des Stoffs, die noch dunkel und unbunt sind, anteilig mitnehmen (Kantenglaettung).
const gewicht = new Float32Array(n);
for (let i = 0; i < n; i++) if (stoff[i]) gewicht[i] = 1;
for (let runde = 0; runde < 2; runde++) {
  const neu = gewicht.slice();
  for (let i = 0; i < n; i++) {
    if (gewicht[i] >= 1 || !unbunt(i)) continue;
    const x = i % W;
    const nb = [x > 0 ? i - 1 : i, x < W - 1 ? i + 1 : i, i >= W ? i - W : i, i < n - W ? i + W : i];
    if (!nb.some(q => gewicht[q] > 0.5)) continue;
    neu[i] = Math.max(0, Math.min(1, (130 - mx(i)) / 50));
  }
  gewicht.set(neu);
}

// Mittlere Stoffhelligkeit; Licht relativ dazu auf die neue Farbe
let summe = 0, z = 0;
for (let i = 0; i < n; i++) if (stoff[i]) { summe += mx(i); z++; }
const mittel = z ? summe / z : 30;
const out = Buffer.from(data);
for (let i = 0; i < n; i++) {
  const g = gewicht[i]; if (!g) continue;
  const licht = Math.max(0.35, Math.min(2.2, 0.45 + 0.55 * (mx(i) + 4) / (mittel + 4)));
  for (let k = 0; k < 3; k++) {
    const neu = Math.min(255, c[k] * licht + Math.max(0, mx(i) - mittel) * 0.35);
    out[i * 3 + k] = Math.round(data[i * 3 + k] * (1 - g) + neu * g);
  }
}
const s = sharp(out, { raw: { width: W, height: H, channels: 3 } });
await (aus.endsWith('.webp') ? s.webp({ quality: 88 }) : s.jpeg({ quality: 90, mozjpeg: true })).toFile(aus);
console.log(`ok · Stoff ${Math.round(z / n * 100)} % des Bildes · Mittel ${mittel.toFixed(0)}`);
