// Ein Druckbild perspektivisch exakt auf eine Flaeche im Bild legen (Markus, 4. Okt., Pizzakarton: "Idee ist gut,
// aber falsch drauf"). Die Bild-KI malt den Traeger (Kartondeckel, Etikett, Speisekarte ...) mit einer Flaeche in
// reinem Magenta; hier werden deren vier Ecken gemessen und das Druckbild per Homographie hineingerechnet.
// Kein Aufkleber, der flach ueber dem Bild liegt: der Druck folgt der Perspektive des Gegenstands.
import sharp from 'sharp';

// Platzhalterfarben. Reines Magenta (die Heide, Bougainvillea, Lavendel sind lila/pink, aber nie so rein): R und B hoch,
// G sehr niedrig - auch im leicht abgedunkelten Kern einer gemalten Flaeche. Cyan fuer eine zweite Flaeche (z. B. die
// Vorderseite eines Kartons).
const FARBEN = {
  magenta: (r, g, b) => r > 165 && b > 165 && g < 90 && Math.abs(r - b) < 60,
  cyan: (r, g, b) => g > 165 && b > 165 && r < 90 && Math.abs(g - b) < 60,
  gelb: (r, g, b) => r > 190 && g > 190 && b < 90 && Math.abs(r - g) < 60
};
let istMagenta = FARBEN.magenta;

/** Die Magenta-Flaeche: Pixelmaske und die vier Ecken (oben links, oben rechts, unten rechts, unten links). */
export function magentaEcken(data, W, H, kanaele = 4, farbe = 'magenta', unterkanteNahe = null) {
  istMagenta = FARBEN[farbe] || FARBEN.magenta;
  const roh = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * kanaele;
    if (kanaele === 4 && data[i + 3] < 128) continue;
    if (istMagenta(data[i], data[i + 1], data[i + 2])) roh[y * W + x] = 1;
  }
  // nur die groesste zusammenhaengende Flaeche (Fuellen von jedem Startpunkt aus)
  const marke = new Int32Array(W * H); let besteId = 0, besteN = 0, id = 0;
  const stapel = [];
  for (let start = 0; start < W * H; start++) {
    if (!roh[start] || marke[start]) continue;
    id++; let anz = 0; stapel.push(start); marke[start] = id;
    while (stapel.length) { const p = stapel.pop(); anz++; const x = p % W, y = (p - x) / W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) if (q >= 0 && roh[q] && !marke[q]) { marke[q] = id; stapel.push(q); } }
    if (anz > besteN) { besteN = anz; besteId = id; }
  }
  // Extrempunkte in acht Richtungen sammeln, daraus die vier, die die groesste Flaeche aufspannen
  const richtungen = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const best = richtungen.map(() => null);
  const maske = new Uint8Array(W * H); let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (marke[y * W + x] !== besteId || !besteId) continue;
    maske[y * W + x] = 1; n++;
    richtungen.forEach(([a, b], k) => { const v = a * x + b * y; if (!best[k] || v > best[k].v) best[k] = { x, y, v }; });
  }
  if (n < 500) return null;
  const pkt = best.map(p => [p.x, p.y]);
  const flaeche = (q) => Math.abs(q.reduce((s, p, i) => { const r = q[(i + 1) % q.length]; return s + p[0] * r[1] - r[0] * p[1]; }, 0)) / 2;
  let besteQ = null, besteF = -1;
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) for (let c = b + 1; c < 8; c++) for (let d = c + 1; d < 8; d++) {
    const q = [pkt[a], pkt[b], pkt[c], pkt[d]]; const f = flaeche(q); if (f > besteF) { besteF = f; besteQ = q; }
  }
  // im Uhrzeigersinn ordnen (Bildschirm: y nach unten), Unterkante = die Kante mit der groessten mittleren y
  const mx = besteQ.reduce((s, p) => s + p[0], 0) / 4, my = besteQ.reduce((s, p) => s + p[1], 0) / 4;
  const c = besteQ.slice().sort((p, q) => Math.atan2(p[1] - my, p[0] - mx) - Math.atan2(q[1] - my, q[0] - mx));
  let k = 0, maxY = -Infinity;
  // Unterkante: tief unter der Mitte UND eher waagerecht (bei einer langen schmalen Flaeche liegt sonst die kurze
  // Seitenkante tiefer im Mittel)
  for (let i = 0; i < 4; i++) {
    const p = c[i], q = c[(i + 1) % 4];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    // Vorgabe "Unterkante nahe Punkt X" (z. B. an der Vorderseite mit dem Griffloch), sonst: tief und waagerecht
    const wert = unterkanteNahe
      ? -Math.hypot((p[0] + q[0]) / 2 - unterkanteNahe[0], (p[1] + q[1]) / 2 - unterkanteNahe[1])
      : ((p[1] + q[1]) / 2 - my) * (Math.abs(q[0] - p[0]) / len);
    if (wert > maxY) { maxY = wert; k = i; }
  }
  // im Uhrzeigersinn laeuft die Unterkante von rechts nach links: c[k] = unten rechts, c[k+1] = unten links
  const br = c[k], bl = c[(k + 1) % 4], tl = c[(k + 2) % 4], tr = c[(k + 3) % 4];
  return { ecken: [tl, tr, br, bl], maske, anzahl: n };
}

// Homographie, die das Einheitsquadrat (0,0)-(1,0)-(1,1)-(0,1) auf das Viereck q abbildet
function quadratZuViereck(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const z = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / z, h = (dx1 * dy3 - dx3 * dy1) / z;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
function invers(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

/**
 * Legt `druck` (PNG, wird ganz in das Viereck gerechnet) auf die Magenta-Flaeche von `bild`.
 * opts.grund: Farbe, mit der Magenta-Reste am Rand ueberdeckt werden (der Traeger selbst, z. B. Karton-Creme).
 */
export async function aufMagenta(bild, druck, opts = {}) {
  const b = await sharp(bild).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = b.info.width, H = b.info.height, px = b.data;
  const m = magentaEcken(px, W, H, 4, opts.farbe || 'magenta', opts.unterkanteNahe || null);
  if (!m) throw new Error('keine Magenta-Flaeche gefunden');
  const d = await sharp(druck).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const DW = d.info.width, DH = d.info.height, dp = d.data;
  const Hm = invers(quadratZuViereck(m.ecken));
  const grund = opts.grund || [239, 230, 210];
  // Maske um 2 px erweitern, damit kein Magenta-Saum bleibt
  const weit = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.maske[y * W + x]) for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) { const X = x + xx, Y = y + yy; if (X >= 0 && Y >= 0 && X < W && Y < H) weit[Y * W + X] = 1; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!weit[y * W + x]) continue;
    const i = (y * W + x) * 4;
    const w = Hm[6] * x + Hm[7] * y + Hm[8];
    const u = (Hm[0] * x + Hm[1] * y + Hm[2]) / w, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / w;
    // Grund: Magenta (auch der Saum) wird zum Traeger
    if (m.maske[y * W + x] || istMagenta(px[i], px[i + 1], px[i + 2]) || (opts.farbe === 'cyan' ? (px[i + 1] > 150 && px[i + 2] > 150 && px[i] < px[i + 1] - 70) : opts.farbe === 'gelb' ? (px[i] > 150 && px[i + 1] > 150 && px[i + 2] < px[i] - 70) : (px[i] > 150 && px[i + 2] > 150 && px[i + 1] < px[i] - 70))) { px[i] = grund[0]; px[i + 1] = grund[1]; px[i + 2] = grund[2]; px[i + 3] = 255; }
    if (u < 0 || v < 0 || u > 1 || v > 1) continue;
    // bilinear im Druckbild
    const fx = u * (DW - 1), fy = v * (DH - 1), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(DW - 1, x0 + 1), y1 = Math.min(DH - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
    for (let k = 0; k < 4; k++) {
      const v00 = dp[(y0 * DW + x0) * 4 + k], v10 = dp[(y0 * DW + x1) * 4 + k], v01 = dp[(y1 * DW + x0) * 4 + k], v11 = dp[(y1 * DW + x1) * 4 + k];
      out[k] = (v00 * (1 - ax) + v10 * ax) * (1 - ay) + (v01 * (1 - ax) + v11 * ax) * ay;
    }
    const a = out[3] / 255;
    for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * (1 - a) + out[k] * a);
  }
  return { png: await sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), ecken: m.ecken };
}
const out = [0, 0, 0, 0];

/** Schwerpunkt einer Platzhalterflaeche (z. B. um die Vorderseite als Unterkante des Deckels zu nehmen). */
export async function flaechenMitte(bild, farbe) {
  const b = await sharp(bild).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = magentaEcken(b.data, b.info.width, b.info.height, 4, farbe);
  if (!m) return null;
  return [m.ecken.reduce((s, p) => s + p[0], 0) / 4, m.ecken.reduce((s, p) => s + p[1], 0) / 4];
}
