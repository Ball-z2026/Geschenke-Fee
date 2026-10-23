// Prüfstand: typische Kundenlogos, wie sie ankommen (JPG mit Kompression, weißer/grauer/farbiger Grund ...)
import fs from 'fs'; import { createRequire } from 'module';
const sharp = createRequire(import.meta.url)('sharp');
const D = process.argv[2];
const F = 'DejaVu Sans';
const fall = {
  '01-schwarzer-text-weiss-jpg': { bg: '#fff', svg: `<text x="400" y="240" font-family="${F}" font-weight="700" font-size="150" text-anchor="middle" fill="#111">Bobo</text>`, jpg: 70 },
  '02-roter-badge-weisse-schrift': { bg: '#fff', svg: `<circle cx="400" cy="200" r="170" fill="#C8102E"/><text x="400" y="225" font-family="${F}" font-weight="700" font-size="80" text-anchor="middle" fill="#fff">ABO</text><polygon points="400,60 412,95 450,95 419,117 431,152 400,130 369,152 381,117 350,95 388,95" fill="#fff"/>`, jpg: 80 },
  '03-duenne-linien': { bg: '#fff', svg: `<rect x="150" y="80" width="500" height="240" rx="30" fill="none" stroke="#1F4AA8" stroke-width="4"/><text x="400" y="225" font-family="${F}" font-size="90" text-anchor="middle" fill="#1F4AA8">Tischlerei</text>`, jpg: 75 },
  '04-hellgrauer-grund': { bg: '#E6E6E6', svg: `<text x="400" y="240" font-family="${F}" font-weight="700" font-size="140" text-anchor="middle" fill="#2E7D32">GRÜN</text>`, jpg: 80 },
  '05-farbiger-grund-weiss-logo': { bg: '#0B3D91', svg: `<text x="400" y="240" font-family="${F}" font-weight="700" font-size="140" text-anchor="middle" fill="#fff">NAVY</text>`, jpg: 80 },
  '06-logo-am-rand': { bg: '#fff', svg: `<rect x="0" y="0" width="800" height="90" fill="#E9166A"/><text x="400" y="260" font-family="${F}" font-weight="700" font-size="130" text-anchor="middle" fill="#E9166A">RAND</text>`, jpg: 85 },
  '07-verlauf': { bg: '#fff', svg: `<defs><linearGradient id="g"><stop offset="0" stop-color="#FF8A00"/><stop offset="1" stop-color="#E52E71"/></linearGradient></defs><circle cx="250" cy="200" r="120" fill="url(#g)"/><text x="560" y="230" font-family="${F}" font-weight="700" font-size="90" text-anchor="middle" fill="#333">Sonne</text>`, jpg: 80 },
  '08-schlagschatten': { bg: '#fff', svg: `<text x="408" y="248" font-family="${F}" font-weight="700" font-size="140" text-anchor="middle" fill="#999" opacity=".6">HAUS</text><text x="400" y="240" font-family="${F}" font-weight="700" font-size="140" text-anchor="middle" fill="#7B1FA2">HAUS</text>`, jpg: 80 },
  '09-grosse-punzen': { bg: '#fff', svg: `<text x="400" y="330" font-family="${F}" font-weight="700" font-size="330" text-anchor="middle" fill="#000">OB</text>`, jpg: 75 },
  '10-weisses-element-im-logo': { bg: '#fff', svg: `<rect x="200" y="60" width="400" height="280" rx="20" fill="#111"/><rect x="250" y="110" width="300" height="180" fill="#fff"/><text x="400" y="225" font-family="${F}" font-weight="700" font-size="70" text-anchor="middle" fill="#111">KINO</text>`, jpg: 80 },
  '11-kleines-jpg-unscharf': { bg: '#fff', svg: `<text x="400" y="240" font-family="${F}" font-weight="700" font-size="150" text-anchor="middle" fill="#0D47A1">Maler</text>`, jpg: 40, klein: 200 },
  '12-karomuster-falsch-transparent': { bg: 'karo', svg: `<text x="400" y="240" font-family="${F}" font-weight="700" font-size="150" text-anchor="middle" fill="#D32F2F">KARO</text>`, jpg: 0 },
  '13-gelb-auf-weiss': { bg: '#fff', svg: `<circle cx="400" cy="200" r="150" fill="#F6D33C"/><text x="400" y="230" font-family="${F}" font-weight="700" font-size="80" text-anchor="middle" fill="#fff">SUN</text>`, jpg: 80 },
  '15-fette-kleine-punzen': { bg: '#fff', svg: `<text x="400" y="250" font-family="${F}" font-weight="700" font-size="120" text-anchor="middle" fill="#1B5E20">beagle</text>`, jpg: 80 },
  '16-weisse-augen-figur': { bg: '#fff', svg: `<ellipse cx="400" cy="210" rx="150" ry="140" fill="#5D4037"/><circle cx="345" cy="180" r="32" fill="#fff"/><circle cx="455" cy="180" r="32" fill="#fff"/><circle cx="352" cy="186" r="12" fill="#111"/><circle cx="462" cy="186" r="12" fill="#111"/><ellipse cx="400" cy="270" rx="40" ry="18" fill="#fff"/>`, jpg: 80 },
  '17-schreibschrift-verbunden': { bg: '#fff', svg: `<text x="400" y="250" font-family="DejaVu Serif" font-style="italic" font-weight="700" font-size="130" text-anchor="middle" fill="#AD1457" letter-spacing="-12">Sabbe</text>`, jpg: 80 },
  '18-stern-mitte-weiss': { bg: '#fff', svg: `<rect x="250" y="50" width="300" height="300" rx="40" fill="#0D47A1"/><polygon points="400,110 425,180 500,180 440,225 462,295 400,252 338,295 360,225 300,180 375,180" fill="#fff"/>`, jpg: 80 },
  '14-schon-transparent-png': { bg: 'none', svg: `<text x="400" y="240" font-family="${F}" font-weight="700" font-size="150" text-anchor="middle" fill="#00897B">FREI</text>`, jpg: 0 },
};
for (const [n, f] of Object.entries(fall)) {
  let bg = '';
  if (f.bg === 'karo') { bg = '<defs><pattern id="k" width="32" height="32" patternUnits="userSpaceOnUse"><rect width="32" height="32" fill="#fff"/><rect width="16" height="16" fill="#ccc"/><rect x="16" y="16" width="16" height="16" fill="#ccc"/></pattern></defs><rect width="800" height="400" fill="url(#k)"/>'; }
  else if (f.bg !== 'none') bg = `<rect width="800" height="400" fill="${f.bg}"/>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">${bg}${f.svg}</svg>`);
  let img = sharp(svg, { density: 72 });
  if (f.klein) img = sharp(await img.png().toBuffer()).resize({ width: f.klein });
  const out = f.jpg ? await img.flatten({ background: '#fff' }).jpeg({ quality: f.jpg }).toBuffer() : await img.png().toBuffer();
  fs.writeFileSync(`${D}/${n}.${f.jpg ? 'jpg' : 'png'}`, out);
}
console.log(Object.keys(fall).length, 'Logos');
