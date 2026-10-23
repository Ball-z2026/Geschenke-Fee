// Muster: Partner-Logo als Emblem mit Ort, Koordinaten und (freiwillig) Datum - drei Bauformen.
// Markus, 4. Okt.: "das Logo ist nicht gut eingebaut" - "Standort und/oder Koordinaten sollten auf jeden Fall
// immer mit drauf", Datum freiwillig. Alles Gesetzte kommt aus dem Code: Logo unveraendert, Schrift exakt.
import sharp from 'sharp';
const [, , aus] = process.argv;
const dms = (g, pos, neg) => { const a = Math.abs(g), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60); return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″ ${g >= 0 ? pos : neg}`; };
const koord = (p) => `${dms(p[0], 'N', 'S')} · ${dms(p[1], 'E', 'W')}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function logoFarbe(datei) {
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < info.width * info.height; i++) { const a = data[i * 4 + 3]; if (a < 200) continue; const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]; const sat = Math.max(r, g, b) - Math.min(r, g, b); if (sat > 60 && r + g + b < 600) px.push([r, g, b]); }
  if (!px.length) return '#1B1710';
  const med = (k) => px.map(p => p[k]).sort((x, y) => x - y)[Math.floor(px.length / 2)];
  return `rgb(${med(0)},${med(1)},${med(2)})`;
}
const partner = [
  { name: 'EAST26', logo: 'postkarte/logos/east26.png', ort: 'SANTANYÍ · MALLORCA', punkt: [39.354, 3.1269], datum: '02.10.2026' },
  { name: 'Luigi', logo: 'postkarte/logos/luigis-pizza.png', ort: 'JESTEBURG', punkt: [53.3121, 9.9647], datum: '' },
  { name: 'Elbdeich', logo: 'postkarte/logos/bestes-vom-elbdeich.png', ort: 'HAMBURG-MOORBURG', punkt: [53.4987, 9.8893], datum: '02.10.2026' }
];
const G = 600;
// Breite eines Textes in px: einmal gerendert und beschnitten (librsvg kennt kein textPath und keine Masse).
const breiteCache = new Map();
async function breite(text, fam, gew, size, sp = 0) {
  const key = [text, fam, gew, size, sp].join('|');
  if (breiteCache.has(key)) return breiteCache.get(key);
  if (text === ' ') { const b = size * 0.28 + sp; breiteCache.set(key, b); return b; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * text.length * 1.2 + 40)}" height="${size * 2}"><text x="10" y="${size * 1.4}" font-family="${fam}" font-weight="${gew}" font-size="${size}" fill="#000">${esc(text)}</text></svg>`;
  const { info } = await sharp(Buffer.from(svg)).flatten({ background: '#fff' }).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
  const b = info.width + sp * text.length; breiteCache.set(key, b); return b;
}
// Groesste Schrift (bis max), bei der der Text in w passt
async function passend(text, fam, gew, max, w, sp) { for (let s = max; s > 10; s -= 1) if (await breite(text, fam, gew, s, sp) <= w) return s; return 10; }
// Text auf einem Kreisbogen, Buchstabe fuer Buchstabe (oben: im Uhrzeigersinn ueber die Mitte, unten: lesbar von links nach rechts)
async function bogen(text, cx, cy, r, oben, fam, gew, size, sp, farbe) {
  const zeichen = [...text];
  const w = await Promise.all(zeichen.map(c => breite(c, fam, gew, size, 0)));
  const gesamt = w.reduce((a, b) => a + b, 0) + sp * (zeichen.length - 1);
  let pos = -gesamt / 2, out = '';
  for (let i = 0; i < zeichen.length; i++) {
    const mitte = pos + w[i] / 2;
    const winkel = mitte / r;                                     // Bogenmass ab der Mitte
    const a = oben ? -Math.PI / 2 + winkel : Math.PI / 2 - winkel;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    const dreh = oben ? winkel * 180 / Math.PI : -winkel * 180 / Math.PI;
    out += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${dreh.toFixed(2)} ${x.toFixed(1)} ${y.toFixed(1)})" text-anchor="middle" dominant-baseline="${oben ? 'auto' : 'hanging'}" font-family="${fam}" font-weight="${gew}" font-size="${size}" fill="${farbe}">${esc(zeichen[i])}</text>`;
    pos += w[i] + sp;
  }
  return out;
}
async function emblem(p, form, farbe, grund) {
  const k = koord(p.punkt);
  let svg, logoBox;
  if (form === 'siegel') {
    // A: rundes Siegel - Ort im Bogen oben, Koordinaten im Bogen unten, Logo in der Mitte
    const ortGr = Math.min(40, await passend(p.ort, 'Playfair Display', 700, 40, 600, 5) );
    const ob = await bogen(p.ort, 300, 300, 228, true, 'Playfair Display', 700, Math.min(ortGr, 40), 5, farbe);
    const ub = await bogen(k, 300, 300, 222, false, 'Archivo', 600, 24, 2, farbe);
    svg = `<circle cx="300" cy="300" r="286" fill="${grund}" stroke="${farbe}" stroke-width="6"/><circle cx="300" cy="300" r="272" fill="none" stroke="${farbe}" stroke-width="2"/>
      <circle cx="300" cy="300" r="196" fill="none" stroke="${farbe}" stroke-width="2"/>${ob}${ub}
      <text x="78" y="312" text-anchor="middle" font-size="26" fill="${farbe}">★</text><text x="522" y="312" text-anchor="middle" font-size="26" fill="${farbe}">★</text>
      ${p.datum ? `<text x="300" y="455" text-anchor="middle" font-family="Archivo" font-weight="700" font-size="22" letter-spacing="4" fill="${farbe}">${esc(p.datum)}</text>` : ''}`;
    logoBox = { cx: 300, cy: p.datum ? 285 : 300, w: 270, h: 230 };
  } else if (form === 'stapel') {
    // B: gestapelt - Logo oben, darunter feine Linien, Ort gesperrt, Koordinaten, Datum
    const og = await passend(p.ort, 'Playfair Display', 700, 40, 470, 6);
    svg = `<rect x="0" y="0" width="600" height="600" rx="24" fill="${grund}"/>
      <line x1="80" y1="410" x2="520" y2="410" stroke="${farbe}" stroke-width="2"/>
      <text x="300" y="460" text-anchor="middle" font-family="Playfair Display" font-weight="700" font-size="${og}" letter-spacing="6" fill="${farbe}">${esc(p.ort)}</text>
      <text x="300" y="502" text-anchor="middle" font-family="Archivo" font-weight="600" font-size="24" letter-spacing="3" fill="${farbe}">${esc(k)}</text>
      <line x1="80" y1="528" x2="520" y2="528" stroke="${farbe}" stroke-width="2"/>
      ${p.datum ? `<text x="300" y="568" text-anchor="middle" font-family="Archivo" font-weight="700" font-size="22" letter-spacing="5" fill="${farbe}">★ ${esc(p.datum)} ★</text>` : `<text x="300" y="566" text-anchor="middle" font-size="24" letter-spacing="10" fill="${farbe}">★★★★★</text>`}`;
    logoBox = { cx: 300, cy: 210, w: 400, h: 340 };
  } else {
    // C: Etikett quer - Logo links, Trennstrich, rechts Ort, Koordinaten, Datum
    const [o1, o2] = p.ort.split(' · ');
    const eg = Math.min(await passend(o1, 'Playfair Display', 700, 34, 260, 3), o2 ? await passend(o2, 'Playfair Display', 700, 34, 260, 3) : 99);
    svg = `<rect x="10" y="150" width="580" height="300" rx="18" fill="${grund}" stroke="${farbe}" stroke-width="4"/>
      <line x1="282" y1="185" x2="282" y2="415" stroke="${farbe}" stroke-width="2"/>
      <text x="306" y="262" font-family="Playfair Display" font-weight="700" font-size="${eg}" letter-spacing="3" fill="${farbe}">${esc(o1)}</text>
      ${p.ort.includes(' · ') ? `<text x="306" y="300" font-family="Playfair Display" font-weight="700" font-size="${eg}" letter-spacing="3" fill="${farbe}">${esc(o2)}</text>` : ''}
      <text x="306" y="345" font-family="Archivo" font-weight="600" font-size="19" letter-spacing="1" fill="${farbe}">${esc(dms(p.punkt[0], 'N', 'S'))}</text>
      <text x="306" y="372" font-family="Archivo" font-weight="600" font-size="19" letter-spacing="1" fill="${farbe}">${esc(dms(p.punkt[1], 'E', 'W'))}</text>
      ${p.datum ? `<text x="306" y="408" font-family="Archivo" font-weight="700" font-size="19" letter-spacing="3" fill="${farbe}">${esc(p.datum)}</text>` : ''}`;
    logoBox = { cx: 148, cy: 300, w: 230, h: 230 };
  }
  const basis = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${G}">${svg}</svg>`);
  const logo = await sharp(p.logo).trim().resize(logoBox.w, logoBox.h, { fit: 'inside' }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  return sharp(basis).composite([{ input: logo, left: Math.round(logoBox.cx - lm.width / 2), top: Math.round(logoBox.cy - lm.height / 2) }]).png().toBuffer();
}
const kacheln = [];
for (const p of partner) {
  const farbe = await logoFarbe(p.logo);
  for (const form of ['siegel', 'stapel', 'etikett']) kacheln.push(await emblem(p, form, farbe, '#FBF6EA'));
}
const T = 420, comp = kacheln.map((b, i) => ({ input: b, left: (i % 3) * (T + 10) + 10, top: Math.floor(i / 3) * (T + 10) + 10 }));
const klein = await Promise.all(comp.map(async c => ({ ...c, input: await sharp(c.input).resize(T, T).toBuffer() })));
await sharp({ create: { width: 3 * (T + 10) + 10, height: 3 * (T + 10) + 10, channels: 3, background: '#2A2622' } }).composite(klein).jpeg({ quality: 88 }).toFile(aus);
console.log('ok', aus);
