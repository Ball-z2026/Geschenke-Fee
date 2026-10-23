// Wie "Placken" ist ein Textilmotiv? Anteil der 64-px-Zellen im Motivumriss, die ganz deckend sind (Alpha >= 96
// in jedem Pixel), wie im CLAUDE.md-Abschnitt "TEXTIL LOCKER, KEIN PLACKEN": Placken 58 %, gut 24-39 %.
import sharp from 'sharp';
const [, , datei] = process.argv;
const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, Z = 64;
let imUmriss = 0, voll = 0, halb = 0, a96 = 0, a250 = 0;
for (let i = 0; i < W * H; i++) { const a = data[i * 4 + 3]; if (a >= 96) a96++; if (a >= 250) a250++; if (a > 0 && a < 96) halb++; }
for (let zy = 0; zy + Z <= H; zy += Z) for (let zx = 0; zx + Z <= W; zx += Z) {
  let n = 0;
  for (let y = zy; y < zy + Z; y++) for (let x = zx; x < zx + Z; x++) if (data[(y * W + x) * 4 + 3] >= 96) n++;
  if (n > 0) imUmriss++;
  if (n === Z * Z) voll++;
}
console.log(JSON.stringify({ zellenVoll: Math.round(voll / imUmriss * 100) + ' %', deckend96: Math.round(a96 / (W * H) * 100) + ' %', deckend250: Math.round(a250 / (W * H) * 100) + ' %', schleier: Math.round(halb / (W * H) * 100) + ' %' }));
