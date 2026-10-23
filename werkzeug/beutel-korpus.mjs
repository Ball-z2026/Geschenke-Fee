// Misst den Beutelkorpus in beiden Vorlagen (Kanten je Zeile/Spalte gegen den grauen Hintergrund).
import sharp from 'sharp';
const ist = { white: (p) => p[0] - p[2] > 10, black: (p) => p[0] + p[1] + p[2] < 200 };
for (const f of ['white', 'black']) {
  const { data, info } = await sharp(`storage/templates/beutel_${f}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const zeile = (y) => { let l = -1, r = -1; for (let x = 0; x < W; x++) if (ist[f](px(x, y))) { if (l < 0) l = x; r = x; } return [l, r]; };
  const spalte = (x) => { let o = -1, u = -1; for (let y = 0; y < H; y++) if (ist[f](px(x, y))) { if (o < 0) o = y; u = y; } return [o, u]; };
  console.log(f);
  for (const y of [500, 600, 700, 800, 900]) console.log('  y', y, zeile(y));
  for (const x of [330, 360, 660, 700]) console.log('  x', x, spalte(x));
}
