// Maske eines WEISSEN Tuchs auf Sand: hell und ungesaettigt = Tuch. Groesste zusammenhaengende
// Flaeche, Loecher (dunkle Falten) geschlossen. Ausgabe: <name>.maske.png (weiss = bedruckbar) + Box.
import sharp from 'sharp';
const [,, eingabe, ausgabe, xa = '0', xb = '1023', ya = '0', yb = '1023'] = process.argv;
const W = 1024, H = 1024;
const inBereich = (i) => { const x = i % W, y = (i / W) | 0; return x >= +xa && x <= +xb && y >= +ya && y <= +yb; };
const { data } = await sharp(eingabe).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const m = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx ? (mx - mn) / mx : 0;
  if (mx > +(process.env.HELL || 150) && sat < +(process.env.SAT || 0.13) && inBereich(i)) m[i] = 1;
}
// Loecher schliessen: 5x dilatieren, dann erodieren (Radius 6)
function morph(src, r, wert) {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let hit = false;
    for (let dy = -r; dy <= r && !hit; dy++) for (let dx = -r; dx <= r; dx++) {
      const yy = y + dy, xx = x + dx; if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
      if (src[yy * W + xx] === wert) { hit = true; break; }
    }
    out[y * W + x] = hit ? wert : 1 - wert;
  }
  return out;
}
let mm = morph(m, 6, 1);   // dilate
mm = morph(mm, 6, 0);       // erode
// Groesste Komponente
const lab = new Int32Array(W * H).fill(-1); let best = -1, bestN = 0, n = 0;
const stack = [];
for (let s = 0; s < W * H; s++) {
  if (!mm[s] || lab[s] >= 0) continue;
  let cnt = 0; stack.push(s); lab[s] = n;
  while (stack.length) { const p = stack.pop(); cnt++; const x = p % W, y = (p / W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (mm[q] && lab[q] < 0) { lab[q] = n; stack.push(q); } } }
  if (cnt > bestN) { bestN = cnt; best = n; }
  n++;
}
const out = Buffer.alloc(W * H);
let x0 = W, x1 = 0, y0 = H, y1 = 0;
for (let i = 0; i < W * H; i++) if (lab[i] === best) { out[i] = 255; const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
// Loecher innerhalb der Komponente fuellen: alles, was von aussen nicht erreichbar ist
const aussen = new Uint8Array(W * H); const st2 = [];
for (let x = 0; x < W; x++) { st2.push(x, (H - 1) * W + x); } for (let y = 0; y < H; y++) { st2.push(y * W, y * W + W - 1); }
while (st2.length) { const p = st2.pop(); if (aussen[p] || out[p]) continue; aussen[p] = 1; const x = p % W, y = (p / W) | 0;
  if (x > 0) st2.push(p - 1); if (x < W - 1) st2.push(p + 1); if (y > 0) st2.push(p - W); if (y < H - 1) st2.push(p + W); }
for (let i = 0; i < W * H; i++) if (!aussen[i]) out[i] = 255;
await sharp(out, { raw: { width: W, height: H, channels: 1 } }).png().toFile(ausgabe);
console.log(JSON.stringify({ box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, anteil: +(bestN / (W * H)).toFixed(3), verh: +((x1 - x0 + 1) / (y1 - y0 + 1)).toFixed(3) }));
