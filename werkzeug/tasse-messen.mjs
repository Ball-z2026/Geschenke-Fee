import sharp from 'sharp';
const [,, maske] = process.argv; const W = 1024, H = 1024;
const { data } = await sharp(maske).resize(W, H).greyscale().raw().toBuffer({ resolveWithObject: true });
const oben = new Int16Array(W).fill(-1), unten = new Int16Array(W).fill(-1), links = new Int16Array(H).fill(-1), rechts = new Int16Array(H).fill(-1);
let x0 = W, x1 = 0, y0 = H, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (data[y * W + x] < 128) continue; if (oben[x] < 0) oben[x] = y; unten[x] = y; if (links[y] < 0) links[y] = x; rechts[y] = x; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const cx = (x0 + x1) / 2, R = (x1 - x0) / 2;
const mid = (arr, a, b) => { const v = []; for (let x = a; x <= b; x++) if (arr[x] >= 0) v.push(arr[x]); v.sort((p, q) => p - q); return v[Math.floor(v.length / 2)]; };
const obenMitte = mid(oben, Math.round(cx) - 6, Math.round(cx) + 6), obenRandL = mid(oben, x0 + 4, x0 + 14), obenRandR = mid(oben, x1 - 14, x1 - 4);
const untenMitte = mid(unten, Math.round(cx) - 6, Math.round(cx) + 6), untenRandL = mid(unten, x0 + 4, x0 + 14), untenRandR = mid(unten, x1 - 14, x1 - 4);
// Henkel: Zeilen, in denen die rechte Kante deutlich vor der Silhouette endet
const kerben = []; let lauf = null;
for (let y = y0; y <= y1; y++) { const k = rechts[y] >= 0 && rechts[y] < x1 - 10; if (k && !lauf) lauf = { von: y, minX: rechts[y] }; if (k && lauf) lauf.minX = Math.min(lauf.minX, rechts[y]); if (!k && lauf) { lauf.bis = y - 1; kerben.push(lauf); lauf = null; } }
if (lauf) { lauf.bis = y1; kerben.push(lauf); }
console.log(JSON.stringify({ box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, cx, R, oben: { mitte: obenMitte, randL: obenRandL, randR: obenRandR }, unten: { mitte: untenMitte, randL: untenRandL, randR: untenRandR }, kerben: kerben.filter(k => k.bis - k.von > 6).map(k => ({ von: k.von, bis: k.bis, minX: k.minX })) }));
