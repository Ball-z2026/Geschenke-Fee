// Logo-Pruefstand (Regel 46): node werkzeug/logo-pruefstand/bauen.mjs <ordner-ein>; node werkzeug/logo-pruefstand/laufen.mjs <ein> <aus> freeLogo
// Jede Tafel zeigt das freigestellte Logo auf Weiss und Schwarz - einzeln ansehen.
import fs from 'fs'; import { createRequire } from 'module';
const IM = await import('../../images.js');
const sharp = createRequire(import.meta.url)('sharp');
const [ein, aus, fn] = process.argv.slice(2);
const f = IM[fn || 'freeLogo'];
for (const n of fs.readdirSync(ein).sort()) {
  const buf = fs.readFileSync(ein + '/' + n);
  let frei; try { frei = await f(buf); } catch (e) { console.log(n, 'FEHLER', e.message); continue; }
  const m = await sharp(frei).metadata();
  const W = 640, H = Math.round(m.height / m.width * W);
  const r = await sharp(frei).resize({ width: W }).png().toBuffer();
  const tafel = await sharp({ create: { width: W * 2 + 30, height: H + 20, channels: 3, background: '#777' } })
    .composite([{ input: await sharp({ create: { width: W, height: H, channels: 3, background: '#fff' } }).composite([{ input: r }]).png().toBuffer(), left: 10, top: 10 },
                { input: await sharp({ create: { width: W, height: H, channels: 3, background: '#111' } }).composite([{ input: r }]).png().toBuffer(), left: W + 20, top: 10 }]).jpeg({ quality: 90 }).toBuffer();
  fs.writeFileSync(aus + '/' + n.replace(/\.\w+$/, '.jpg'), tafel);
}
console.log('fertig');
