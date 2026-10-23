// Ausschnitt eines Bildes mit Pixelraster (alle 20 px, Beschriftung alle 40 px), vergroessert - zum Abmessen.
import sharp from 'sharp';
const [, , datei, x0, y0, w, h, aus, faktor = '3'] = process.argv;
const X = +x0, Y = +y0, W = +w, H = +h, F = +faktor;
const linien = [];
for (let x = Math.ceil(X / 20) * 20; x < X + W; x += 20) linien.push(`<line x1="${(x - X) * F}" y1="0" x2="${(x - X) * F}" y2="${H * F}" stroke="${x % 40 ? '#00f8' : '#f00c'}" stroke-width="1"/>` + (x % 40 ? '' : `<text x="${(x - X) * F + 2}" y="12" font-size="12" fill="#f00">${x}</text>`));
for (let y = Math.ceil(Y / 20) * 20; y < Y + H; y += 20) linien.push(`<line x1="0" y1="${(y - Y) * F}" x2="${W * F}" y2="${(y - Y) * F}" stroke="${y % 40 ? '#00f8' : '#f00c'}" stroke-width="1"/>` + (y % 40 ? '' : `<text x="2" y="${(y - Y) * F - 2}" font-size="12" fill="#f00">${y}</text>`));
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * F}" height="${H * F}">${linien.join('')}</svg>`);
await sharp(datei).extract({ left: X, top: Y, width: W, height: H }).resize(W * F, H * F, { kernel: 'nearest' }).composite([{ input: svg }]).jpeg({ quality: 85 }).toFile(aus);
