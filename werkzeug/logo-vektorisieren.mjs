// Motto-Otto-Logo freistellen und vektorisieren (Auftrag vom 13. Sept. 2026).
// Aufruf aus dem Projektordner:  node werkzeug/logo-vektorisieren.mjs [eingang.png] [ausgabeordner]
// Eingang: die Originaldatei mit beiden Logos (1198 x 607, Trennspalte 604), die rechte Haelfte
// auf Weiss (594 x 607, wie logo-source.png im Repo) oder ein bereits freigestelltes RGBA-PNG.
// Ergebnis: MottoOtto-Logo.svg/.pdf, PNGs 4000/1000/512 (aus der SVG gerendert), Farbliste,
// dazu Kontrollbilder auf Weiss, Schwarz und Magenta.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
const execFileP = promisify(execFile);

const EINGANG = process.argv[2] || 'logo-source.png';
const AUS = process.argv[3] || 'logo-vektor';
const SCHWELLE = 242;      // gemessen: Hintergrund 254, hellster Motivteil 246 (Creme)
const TRENNSPALTE = 604;   // Originaldatei: linke Fassung auf Schwarz bis 603, rechte ab 604
const SKALIERUNG = 4;      // vor vtracer hochskalieren, sonst werden die Kurven eckig
const FARBEN = +process.env.LOGO_FARBEN || 14;   // Volltonfarben nach der Quantisierung (Gruen, Pink, Beere, Creme, Haut, Grau, Schwarz + Schatten)
// Gemessene Farben aus dem Auftrag, die in der Palette stehen MUESSEN: Brillenglaeser, Creme, Keyline
// Dazu der Fingerabdruck auf dem Daumen: feine graubraune Linien (gemessen 156,132,116), zu duenn,
// um als Flaeche in die Palette zu kommen - ohne diesen Eintrag wird er weggeglaettet.
const PFLICHTFARBEN = ['#e2fae3', '#f6eddd', '#e1e2e3', '#9c8474'];
const LINIENFARBEN = ['#9c8474'];   // nur als feine Linie, nie als Flaeche, nie neben Schwarz
// filter_speckle: der Auftrag nennt 2 fuer das Originalmass. Nach 4x Hochskalierung entspricht
// das 16 Pixeln Flaeche (ein Originalpixel = 16 Pixel) - der Daumenabdruck bleibt damit erhalten,
// die Kruemel aus der Quantisierung der weichen Schatten fallen weg.
const PARAMS = { filter_speckle: +process.env.LOGO_SPECKLE || 16, color_precision: 8, layer_difference: 16, corner_threshold: 60, length_threshold: 3.5 };

const PY = `
import sys, vtracer
vtracer.convert_image_to_svg_py(sys.argv[1], sys.argv[2],
  colormode='color', hierarchical='stacked', mode='spline',
  filter_speckle=${PARAMS.filter_speckle}, color_precision=${PARAMS.color_precision},
  layer_difference=${PARAMS.layer_difference}, corner_threshold=${PARAMS.corner_threshold},
  length_threshold=${PARAMS.length_threshold}, max_iterations=10, splice_threshold=45, path_precision=3)
`;

// ---------- Schritt 1: Freistellen ----------
async function freistellen(buffer) {
  const meta = await sharp(buffer).metadata();
  if (meta.hasAlpha) {
    // schon freigestellt: nur Kanten haerten und Rand abschneiden
    console.log('Eingang ist bereits freigestellt (RGBA)', meta.width, 'x', meta.height);
    return sharp(buffer).ensureAlpha().trim().png().toBuffer();
  }
  let img = sharp(buffer);
  if (meta.width > 1000) {
    console.log('Originaldatei mit beiden Logos - rechte Fassung ab Spalte', TRENNSPALTE);
    img = img.extract({ left: TRENNSPALTE, top: 0, width: meta.width - TRENNSPALTE, height: meta.height });
  }
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const hell = (p) => { const i = p * ch; return Math.min(data[i], data[i + 1], data[i + 2]) >= SCHWELLE; };

  // 1. Vom Rand fluten: nur zusammenhaengendes Weiss ist Hintergrund. Punzen der Buchstaben
  //    und die Brillenglaeser sind eingeschlossen und bleiben stehen.
  const hinter = new Uint8Array(w * h);
  const stapel = [];
  for (let x = 0; x < w; x++) { stapel.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stapel.push(y * w, y * w + w - 1); }
  while (stapel.length) {
    const p = stapel.pop();
    if (hinter[p] || !hell(p)) continue;
    hinter[p] = 1;
    const x = p % w, y = (p - x) / w;
    if (x > 0) stapel.push(p - 1);
    if (x < w - 1) stapel.push(p + 1);
    if (y > 0) stapel.push(p - w);
    if (y < h - 1) stapel.push(p + w);
  }
  let alpha = Buffer.alloc(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = hinter[p] ? 0 : 255;

  // 2. Eine Pixelreihe Kantenglaettung (Gauss 0,6), darunter alles unter Alpha 40 hart auf null.
  //    toColourspace('b-w') mit Absicht: ohne das blaest sharp das 1-Kanal-Bild still auf drei
  //    Kanaele auf, und die Maske kommt mit falschem Zeilenversatz zurueck (Streifenmuster).
  alpha = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(0.6).toColourspace('b-w').raw().toBuffer();
  if (alpha.length !== w * h) throw new Error('Alphamaske hat ' + alpha.length + ' Bytes statt ' + (w * h));
  for (let p = 0; p < w * h; p++) if (alpha[p] < 40) alpha[p] = 0;

  // 3. Farbe 3 px nach aussen ziehen: transparente Pixel bekommen die Farbe des naechsten
  //    deckenden Nachbarn, sonst blutet beim Skalieren der weisse Grund in die Kante.
  const rgb = Buffer.from(data);
  let deckend = Uint8Array.from(alpha, a => (a >= 128 ? 1 : 0));
  for (let runde = 0; runde < 3; runde++) {
    const neu = Uint8Array.from(deckend);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (deckend[p]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!deckend[q]) continue;
        r += rgb[q * ch]; g += rgb[q * ch + 1]; b += rgb[q * ch + 2]; n++;
      }
      if (n) { rgb[p * ch] = Math.round(r / n); rgb[p * ch + 1] = Math.round(g / n); rgb[p * ch + 2] = Math.round(b / n); neu[p] = 1; }
    }
    deckend = neu;
  }
  const png = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png().toBuffer();
  return sharp(png).trim().png().toBuffer();
}

// ---------- Schritt 2: Vektorisieren ----------
async function vektorisieren(pngFrei, tmp) {
  const meta = await sharp(pngFrei).metadata();
  // Erst hochskalieren, dann auf wenige Volltonfarben quantisieren (ohne Dithering): das Pixelbild
  // traegt weiche Schattierungen und Antialiasing, daraus macht vtracer sonst tausende Farbschichten.
  // Ein Logo hat eine Handvoll Markenfarben - genau die soll die SVG haben.
  const hoch = await sharp(pngFrei).resize({ width: meta.width * SKALIERUNG, kernel: 'lanczos3' }).png().toBuffer();
  // Die Palette nur aus FLAECHEN lernen, nicht aus Kanten: Antialiasing-Pixel zwischen Schwarz und
  // Gruen sind so haeufig, dass der Quantisierer sonst "Dunkeloliv" als eigene Farbe anlegt - und
  // die SVG bekommt einen olivfarbenen Saum an jeder schwarzen Kontur. Pixel, die sich von einem
  // Nachbarn unterscheiden, werden vor der Quantisierung durchsichtig gemacht (werden ignoriert).
  const kern = await sharp(pngFrei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  {
    const k = kern.data, kw = kern.info.width, kh = kern.info.height;
    const alt = Buffer.from(k);
    const gleich = (a, b) => Math.abs(alt[a] - alt[b]) <= 10 && Math.abs(alt[a + 1] - alt[b + 1]) <= 10 && Math.abs(alt[a + 2] - alt[b + 2]) <= 10;
    for (let y = 0; y < kh; y++) for (let x = 0; x < kw; x++) {
      const i = (y * kw + x) * 4;
      if (alt[i + 3] < 128) { k[i + 3] = 0; continue; }
      let flach = x > 0 && x < kw - 1 && y > 0 && y < kh - 1;
      if (flach) for (const j of [i - 4, i + 4, i - kw * 4, i + kw * 4]) { if (alt[j + 3] < 128 || !gleich(i, j)) { flach = false; break; } }
      if (!flach) k[i + 3] = 0;
    }
  }
  const kernPng = await sharp(kern.data, { raw: { width: kern.info.width, height: kern.info.height, channels: 4 } }).png().toBuffer();
  const quant = await sharp(kernPng).png({ palette: true, colours: FARBEN, dither: 0 }).toBuffer();
  const q = await sharp(quant).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Palette aus der Quantisierung ...
  const zaehl = new Map();
  for (let i = 0; i < q.data.length; i += 4) if (q.data[i + 3] >= 128) { const k = `#${hex2(q.data[i])}${hex2(q.data[i + 1])}${hex2(q.data[i + 2])}`; zaehl.set(k, (zaehl.get(k) || 0) + 1); }
  const palette = [...zaehl.entries()].sort((a, b) => b[1] - a[1]).map(([hex, px]) => ({ hex, px, rgb: parseHex(hex) }));
  // ... plus die gemessenen Pflichtfarben aus dem Auftrag, die der Quantisierer gern mit einer
  // Nachbarfarbe zusammenlegt (Brillenglaeser 226,250,227 landen sonst im Keyline-Grau).
  for (const p of PFLICHTFARBEN) {
    const rgb = parseHex(p);
    if (!palette.some(x => dist(x.rgb, rgb) < 12)) palette.push({ hex: p, px: 0, rgb });
  }
  // Fast gleiche Palettenfarben zusammenlegen (drei Hellgraus fuer ein T-Shirt sind keine Marke)
  for (let a = 0; a < palette.length; a++) for (let b = palette.length - 1; b > a; b--) if (dist(palette[a].rgb, palette[b].rgb) < 14) palette.splice(b, 1);

  // Jedes deckende Pixel des HOCHSKALIERTEN Originals auf eine Palettenfarbe ziehen - in zwei
  // Durchgaengen. Flaechenpixel bekommen einfach die naechste Farbe. Kantenpixel sind Mischungen
  // zweier Nachbarn (Schwarz+Haut = Braun) - "naechste Farbe" waere dann Beere, und die SVG haette
  // einen pinken Saum an jeder Kontur. Darum duerfen Kantenpixel nur eine Farbe nehmen, die im
  // Umkreis auch als Flaeche vorkommt.
  const gross = await sharp(hoch).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const d = gross.data, W = gross.info.width, H = gross.info.height, N = W * H;
  for (const p of palette) p.px = 0;
  const naechste = (rgb, erlaubt) => {
    let best = -1, bd = Infinity;
    for (let k = 0; k < palette.length; k++) { if (erlaubt && !erlaubt.has(k)) continue; const dd = dist(palette[k].rgb, rgb); if (dd < bd) { bd = dd; best = k; } }
    return best;
  };
  const zu = new Int16Array(N).fill(-1);          // Palettenindex je Pixel, -1 = noch offen
  const linie = new Set(LINIENFARBEN.map(hx => palette.findIndex(p => p.hex === hx)).filter(k => k >= 0));
  const orig = Buffer.from(d);
  const gleich = (a, b) => Math.abs(orig[a] - orig[b]) <= 10 && Math.abs(orig[a + 1] - orig[b + 1]) <= 10 && Math.abs(orig[a + 2] - orig[b + 2]) <= 10;
  // Durchgang 1: Flaechenpixel
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, i = p * 4;
    if (orig[i + 3] < 128) { d[i + 3] = 0; continue; }
    let flach = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = (ny * W + nx) * 4;
      if (orig[j + 3] < 128 || !gleich(i, j)) { flach = false; break; }
    }
    // Flaechenpixel - oder ein Pixel, das einer Palettenfarbe eindeutig nahe ist (feine Linien wie
    // der Fingerabdruck haben keine Flaeche, aber eine klare Farbe)
    const rgb = [orig[i], orig[i + 1], orig[i + 2]];
    const k = naechste(rgb, null);
    if (flach && !linie.has(k)) zu[p] = k;
  }
  // Linienfarben (Fingerabdruck): Pixel, die der Farbe eindeutig nahe sind, bekommen sie - aber
  // nur fern von schwarzen Konturen. Sonst wird jede Mischkante Schwarz/Haut zur braunen Linie.
  const schwarz = palette.findIndex(p => p.rgb[0] + p.rgb[1] + p.rgb[2] < 60);
  const R = 6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, i = p * 4;
    if (orig[i + 3] < 128 || zu[p] >= 0) continue;
    const rgb = [orig[i], orig[i + 1], orig[i + 2]];
    const k = naechste(rgb, null);
    if (!linie.has(k) || dist(palette[k].rgb, rgb) > 28) continue;
    let schwarzNah = false;
    for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R) && !schwarzNah; yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++) if (zu[yy * W + xx] === schwarz) { schwarzNah = true; break; }
    if (!schwarzNah) zu[p] = k;
  }
  // Die Linienfarbe darf nur EIN zusammenhaengendes Feld sein (der Abdruck auf dem Daumen). Alles
  // andere in dieser Farbe (Schatten auf dem Shirt, die zufaellig aehnlich sind) wird wieder
  // freigegeben und im zweiten Durchgang wie eine Kante behandelt.
  for (const li of linie) {
    const label = new Int32Array(N).fill(-1);
    const comps = [];
    for (let start = 0; start < N; start++) {
      if (zu[start] !== li || label[start] >= 0) continue;
      const id = comps.length, stapel = [start]; label[start] = id;
      let n = 0;
      while (stapel.length) {
        const p = stapel.pop(); n++;
        const x = p % W, y = (p - x) / W;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) if (q >= 0 && zu[q] === li && label[q] < 0) { label[q] = id; stapel.push(q); }
      }
      comps.push(n);
    }
    if (!comps.length) continue;
    let gross = 0;
    for (let c = 1; c < comps.length; c++) if (comps[c] > comps[gross]) gross = c;
    for (let p = 0; p < N; p++) if (zu[p] === li && label[p] !== gross) zu[p] = -1;
    console.log('Linienfarbe', palette[li].hex + ':', comps.length, 'Felder, behalten das groesste mit', comps[gross], 'Pixeln');
  }
  // Durchgang 2: Kantenpixel - nur Farben, die im Umkreis als Flaeche vorkommen (Fenster waechst bei Bedarf)
  let offen = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, i = p * 4;
    if (orig[i + 3] < 128 || zu[p] >= 0) continue;
    let gewaehlt = -1;
    for (const r of [3, 6, 12, 24]) {
      const erlaubt = new Set();
      for (let yy = Math.max(0, y - r); yy <= Math.min(H - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(W - 1, x + r); xx++) { const q = zu[yy * W + xx]; if (q >= 0) erlaubt.add(q); }
      if (erlaubt.size) { gewaehlt = naechste([orig[i], orig[i + 1], orig[i + 2]], erlaubt); break; }
    }
    if (gewaehlt < 0) { gewaehlt = naechste([orig[i], orig[i + 1], orig[i + 2]], null); offen++; }
    zu[p] = gewaehlt;
  }
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    if (zu[p] < 0) continue;
    const c = palette[zu[p]].rgb; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; palette[zu[p]].px++;
  }
  if (offen) console.log('Kantenpixel ohne Flaeche im Umkreis:', offen);
  // Lage des Fingerabdrucks merken (Schwerpunkt, Ausdehnung, Neigung der Linienfarbe) - siehe
  // fingerabdruck(). VOR dem Sortieren der Palette, die Indizes in `zu` gelten nur bis dahin.
  let abdruck = null;
  if (linie.size) {
    const li = [...linie][0];
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let p = 0; p < N; p++) if (zu[p] === li) { const x = p % W, y = (p - x) / W; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (n > 50) {
      const mx = sx / n, my = sy / n, vx = sxx / n - mx * mx, vy = syy / n - my * my, cxy = sxy / n - mx * my;
      const winkel = 0.5 * Math.atan2(2 * cxy, vx - vy);
      // Ausdehnung aus dem umschliessenden Kasten (die Linien sind duenn, die Streuung waere zu klein)
      const halbB = (x1 - x0) / 2 * 1.15, halbH = (y1 - y0) / 2 * 1.15;
      abdruck = { cx: mx, cy: my, rx: Math.max(halbB, halbH), ry: Math.min(halbB, halbH), winkel: winkel * 180 / Math.PI, farbe: palette[li].hex, n };
    }
  }
  palette.sort((a, b) => b.px - a.px);
  for (let k = palette.length - 1; k >= 0; k--) if (!palette[k].px) palette.splice(k, 1);
  const src = path.join(tmp, 'in.png'), dst = path.join(tmp, 'out.svg');
  await sharp(d, { raw: { width: gross.info.width, height: gross.info.height, channels: 4 } }).png().toFile(src);
  await new Promise((resolve, reject) => {
    const p = spawn('python3', ['-c', PY, src, dst], { stdio: ['ignore', 'inherit', 'pipe'] });
    let err = '';
    p.stderr.on('data', x => { err += x; });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error('vtracer: ' + err.slice(0, 400)))));
  });
  return { svg: await fs.readFile(dst, 'utf8'), w: gross.info.width, h: gross.info.height, palette, abdruck };
}

// ---------- Fingerabdruck als Zeichnung ----------
// Der Abdruck auf dem Daumen besteht im Original aus Linien von einem Pixel Breite in einem 40 Pixel
// grossen Feld. Das ist unter der Aufloesung, die sich nachvektorisieren laesst: vtracer macht daraus
// einen braunen Fleck (gemessen, mit filter_speckle 2 wie 16). Darum wird der Fleck durch eine
// gezeichnete Fassung ersetzt: konzentrische, unterbrochene Ringe in derselben Farbe, an derselben
// Stelle, mit derselben Neigung. Das ist eine Rekonstruktion, keine Nachzeichnung - steht so im Bericht.
function fingerabdruck(svg, a) {
  if (!a) return { svg, ersetzt: false };
  const ohne = svg.replace(new RegExp(`<path[^>]*fill="${a.farbe}"[^>]*/>\\s*`, 'gi'), '');
  const ringe = [];
  const n = 5, strich = Math.max(3, Math.round(Math.min(a.rx, a.ry) / 9));
  for (let k = 1; k <= n; k++) {
    const rx = a.rx * k / n, ry = a.ry * k / n;
    const umfang = Math.PI * (rx + ry);
    // Unterbrechungen wie bei einem echten Abdruck: Striche und Luecken, je Ring anders versetzt
    const dash = `${(umfang * 0.28).toFixed(1)} ${(strich * 2.2).toFixed(1)} ${(umfang * 0.17).toFixed(1)} ${(strich * 2.2).toFixed(1)}`;
    ringe.push(`<ellipse cx="${a.cx.toFixed(1)}" cy="${a.cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" stroke-dasharray="${dash}" stroke-dashoffset="${(umfang * 0.13 * k).toFixed(1)}"/>`);
  }
  const g = `<g fill="none" stroke="${a.farbe}" stroke-width="${strich}" stroke-linecap="round" transform="rotate(${a.winkel.toFixed(1)} ${a.cx.toFixed(1)} ${a.cy.toFixed(1)})">\n${ringe.join('\n')}\n</g>\n`;
  return { svg: ohne.replace('</svg>', g + '</svg>'), ersetzt: true };
}

// ---------- Schritt 3: Farben aufraeumen ----------
const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const parseHex = (s) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

function farbenBereinigen(svg, palette) {
  // Jede Fuellfarbe der SVG auf die naechste Palettenfarbe ziehen - Zwischentoene verschwinden
  const zaehler = new Map();
  for (const m of svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)) zaehler.set(m[1].toLowerCase(), (zaehler.get(m[1].toLowerCase()) || 0) + 1);
  const map = new Map();
  const pfade = new Map();
  for (const [hx, n] of zaehler) {
    const rgb = parseHex(hx);
    let best = palette[0];
    for (const p of palette) if (dist(p.rgb, rgb) < dist(best.rgb, rgb)) best = p;
    map.set(hx, best.hex);
    pfade.set(best.hex, (pfade.get(best.hex) || 0) + n);
  }
  const out = svg.replace(/fill="(#[0-9a-fA-F]{6})"/g, (m, hx) => `fill="${map.get(hx.toLowerCase()) || hx}"`);
  const benutzt = palette.filter(p => pfade.has(p.hex)).map(p => ({ hex: p.hex, px: p.px, pfade: pfade.get(p.hex) }));
  return { svg: out, vorher: zaehler.size, nachher: benutzt.length, palette: benutzt };
}

// ---------- Kontrollbilder ----------
async function rendern(svg, width, hintergrund) {
  let img = sharp(Buffer.from(svg)).resize({ width, kernel: 'lanczos3' });
  if (hintergrund) img = img.flatten({ background: hintergrund });
  return img.png().toBuffer();
}

async function main() {
  await fs.mkdir(AUS, { recursive: true });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mo-logo-'));
  const eingang = await fs.readFile(EINGANG);
  const frei = await freistellen(eingang);
  await fs.writeFile(path.join(AUS, 'zwischen-freigestellt.png'), frei);
  const fm = await sharp(frei).metadata();
  console.log('Freigestellt:', fm.width, 'x', fm.height);

  const v = await vektorisieren(frei, tmp);
  const roh = v.svg;
  await fs.writeFile(path.join(AUS, 'zwischen-vtracer-roh.svg'), roh);
  const b = farbenBereinigen(roh, v.palette);
  console.log('Farben: vtracer', b.vorher, '-> bereinigt', b.nachher);

  // Kopf der SVG: viewBox in Originalpixeln, physische Groesse offen (Logo, kein Druckmass)
  let svg = b.svg;
  const fa = fingerabdruck(svg, v.abdruck);
  svg = fa.svg;
  if (fa.ersetzt) console.log('Fingerabdruck als Zeichnung ersetzt:', JSON.stringify(v.abdruck));
  if (!/viewBox=/.test(svg)) svg = svg.replace('<svg', `<svg viewBox="0 0 ${v.w} ${v.h}"`);
  svg = svg.replace(/<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, (m, a) => `<svg${a}`);
  svg = svg.replace('<svg', '<!-- Motto Otto Logo, vektorisiert aus dem Pixel-Original (vtracer). Schrift ist Pfad. -->\n<svg');
  await fs.writeFile(path.join(AUS, 'MottoOtto-Logo.svg'), svg);

  // PNGs aus der SVG, transparent
  for (const w of [4000, 1000, 512]) await fs.writeFile(path.join(AUS, `MottoOtto-Logo-${w}.png`), await rendern(svg, w, null));
  // Kontrolle auf Weiss, Schwarz, Magenta
  for (const [name, bg] of [['weiss', '#ffffff'], ['schwarz', '#000000'], ['magenta', '#ff00ff']]) {
    await fs.writeFile(path.join(AUS, `kontrolle-${name}.png`), await rendern(svg, 1200, bg));
  }
  // Vergleich: Original (freigestellt) neben der Vektorfassung
  const links = await sharp(frei).resize({ width: 800 }).flatten({ background: '#ff00ff' }).png().toBuffer();
  const rechts = await rendern(svg, 800, '#ff00ff');
  const lh = (await sharp(links).metadata()).height, rh = (await sharp(rechts).metadata()).height;
  await sharp({ create: { width: 1640, height: Math.max(lh, rh), channels: 3, background: '#ff00ff' } })
    .composite([{ input: links, left: 0, top: 0 }, { input: rechts, left: 840, top: 0 }]).png().toFile(path.join(AUS, 'kontrolle-vergleich.png'));

  // PDF aus der SVG (rsvg-convert)
  try {
    await execFileP('rsvg-convert', ['-f', 'pdf', '-o', path.join(AUS, 'MottoOtto-Logo.pdf'), path.join(AUS, 'MottoOtto-Logo.svg')]);
    console.log('PDF geschrieben');
  } catch (e) { console.warn('PDF nicht erzeugt:', e.message); }

  // Farbliste
  const zeilen = ['# Motto Otto – Markenfarben aus der bereinigten SVG', '', `Quelle: ${path.basename(EINGANG)}, ${SKALIERUNG}x hochskaliert, auf ${FARBEN} Volltonfarben quantisiert, vtracer ${JSON.stringify(PARAMS)}.`, '', '| Hex | RGB | Anteil im Bild | Pfade in der SVG |', '|---|---|---|---|'];
  const gesamt = b.palette.reduce((s, p) => s + p.px, 0);
  for (const p of b.palette) zeilen.push(`| ${p.hex} | ${parseHex(p.hex).join(', ')} | ${(p.px / gesamt * 100).toFixed(1)} % | ${p.pfade} |`);
  zeilen.push('', `vtracer hatte ${b.vorher} Fuellwerte erzeugt (Zwischentoene an Kanten), alle auf die ${b.nachher} Palettenfarben gezogen.`);
  await fs.writeFile(path.join(AUS, 'MottoOtto-Logo-farben.md'), zeilen.join('\n') + '\n');
  console.log('Palette:', b.palette.map(p => p.hex + '(' + p.pfade + ')').join(' '));
  console.log('Pfade in der SVG:', (svg.match(/<path/g) || []).length, '· Groesse', Math.round(svg.length / 1024), 'KB');
  await fs.rm(tmp, { recursive: true, force: true });
}
main().catch(e => { console.error(e); process.exit(1); });
