// Maske des Gepaeckanhaengers (8. Okt.): die weisse Vorderseite, OHNE Oese und Lederschlaufe -
// die liegen vor dem Druck und bleiben stehen. Kein Loecherschliessen (anders als maske-weiss):
// das Loch der Oese ist echt. Groesste helle, ungesaettigte Insel = Druckflaeche.
// Aufruf: node werkzeug/maske-anhaenger.mjs <foto.png> <maske.png>
import sharp from 'sharp';
const [,, eingabe, ausgabe] = process.argv;
const W = 1024, H = 1024;
const { data } = await sharp(eingabe).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const m = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mn > 232 && mx - mn < 14) m[i] = 1;   // Studiogrund #DCDCDC liegt bei 220 - die Flaeche bei 245+
}
const lab = new Int32Array(W * H).fill(-1); let best = -1, bestN = 0, n = 0; const stack = [];
for (let s = 0; s < W * H; s++) {
  if (!m[s] || lab[s] >= 0) continue;
  let cnt = 0; stack.push(s); lab[s] = n;
  while (stack.length) {
    const p = stack.pop(); cnt++; const x = p % W, y = (p / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const q = yy * W + xx; if (m[q] && lab[q] < 0) { lab[q] = n; stack.push(q); }
    }
  }
  if (cnt > bestN) { bestN = cnt; best = n; }
  n++;
}
let x0 = W, x1 = 0, y0 = H, y1 = 0; const out = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) if (lab[i] === best) {
  out[i] = 255; const x = i % W, y = (i / W) | 0;
  x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
}
await sharp(out, { raw: { width: W, height: H, channels: 1 } }).blur(0.6).png().toFile(ausgabe);
console.log('Flaeche', bestN, 'px · box', { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, '· Verhaeltnis', ((x1 - x0 + 1) / (y1 - y0 + 1)).toFixed(3), '(7 x 10 = 0.700)');
