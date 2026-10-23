// Die schlichte Linie der Partner-Kollektion (Markus, 4. Okt.): "komplett minimalistisch, zum Beispiel das Logo vorne
// gross mit Standort und dann ... mein Lieblingsrestaurant" - "es gibt durchaus Leute, die so grosse Prints gar nicht
// moegen." Alles hier setzt der Code, keine Bild-KI: das Logo ist das Original (unveraendert, nur eingepasst), Ort und
// Koordinaten sind immer drauf, Name und Datum nur, wenn der Gast sie will. Freistehend auf transparentem Grund -
// kein Placken: nur Logo und Schrift.
import sharp from 'sharp';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Koordinaten als Grad, Minuten, Sekunden: "39°21′14″ N · 3°07′37″ E" */
export function koordinatenText(punkt) {
  if (!Array.isArray(punkt) || punkt.length !== 2) return '';
  const dms = (g, pos, neg) => {
    const a = Math.abs(g); let d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60);
    if (s === 60) { s = 0; m += 1; } if (m === 60) { m = 0; d += 1; }
    return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″ ${g >= 0 ? pos : neg}`;
  };
  return `${dms(+punkt[0], 'N', 'S')} · ${dms(+punkt[1], 'E', 'W')}`;
}

/** Ortszeile: "SANTANYÍ · MALLORCA" (Insel/Region nur ausserhalb Deutschlands, letzter Teil der Region). */
export function ortsZeile(e = {}) {
  const ort = String(e.ort || '').trim();
  const land = String(e.land || '').trim();
  const region = String(e.region || '').split(',').map(x => x.trim()).filter(Boolean).pop() || '';
  const zusatz = land && !/^deutschland$/i.test(land) ? (region || land) : '';
  return [ort, zusatz].filter(Boolean).join(' · ').toLocaleUpperCase('de-DE');
}

// Breite eines Textes in px: einmal gerendert und beschnitten (librsvg liefert keine Textmasse).
const breiteCache = new Map();
async function breite(text, fam, gew, size, sp = 0) {
  const key = [text, fam, gew, size, sp].join('|');
  if (breiteCache.has(key)) return breiteCache.get(key);
  const w = Math.ceil(size * text.length * 1.3 + 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${size * 2}"><text x="10" y="${size * 1.4}" font-family="${fam}" font-weight="${gew}" font-size="${size}" letter-spacing="${sp}" fill="#000">${esc(text)}</text></svg>`;
  let b = 0;
  try { const { info } = await sharp(Buffer.from(svg)).flatten({ background: '#fff' }).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true }); b = info.width; } catch (e) { b = size * text.length * 0.6; }
  if (breiteCache.size > 2000) breiteCache.clear();
  breiteCache.set(key, b); return b;
}
async function passend(text, fam, gew, max, w, spAnteil) {
  for (let s = max; s > 12; s -= Math.max(1, Math.round(max / 60))) if (await breite(text, fam, gew, s, s * spAnteil) <= w) return s;
  return 12;
}

/** Helligkeit und Farbe des Logos: Median der deckenden Pixel, und die kraeftigste bunte Farbe als Akzent. */
export async function logoTon(logoBuf) {
  const { data, info } = await sharp(logoBuf).ensureAlpha().resize({ width: 300, withoutEnlargement: true }).raw().toBuffer({ resolveWithObject: true });
  const hell = [], bunt = [];
  let dunkel = 0, n = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    if (data[i * 4 + 3] < 200) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    hell.push(l); n++; if (l < 0.25) dunkel++;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 60 && r + g + b < 620) bunt.push([r, g, b]);
  }
  hell.sort((a, b) => a - b);
  const med = (k) => bunt.length ? bunt.map(p => p[k]).sort((a, b) => a - b)[Math.floor(bunt.length / 2)] : 0;
  return { helligkeit: n ? hell[Math.floor(n / 2)] : 0.5, dunkelAnteil: n ? dunkel / n : 0, akzent: bunt.length ? `rgb(${med(0)},${med(1)},${med(2)})` : '' };
}

/** Auf welches Textil passt das Logo? Viel Schwarz im Logo (Konturen, Schrift) verschwindet auf dunklem Stoff. */
export function textilFuerLogo(ton) { return ton.dunkelAnteil > 0.12 || ton.helligkeit < 0.3 ? 'hell' : 'dunkel'; }

/**
 * Das schlichte Motiv als transparentes PNG (Hochformat, Breite W).
 * opts: { logo: Buffer, lieblings: 'Mein Lieblingsrestaurant', ort: 'SANTANYÍ · MALLORCA', punkt: [lat, lon],
 *         zusatz: 'Clara · 02.10.2026' (freiwillig), sterne: 0-5, textil: 'hell'|'dunkel', W: 2400 }
 */
export async function minimalMotiv(opts) {
  const W = opts.W || 2400;
  const ton = await logoTon(opts.logo);
  const textil = opts.textil || textilFuerLogo(ton);
  const tinte = textil === 'hell' ? '#1B1710' : '#F3EAD3';
  // Akzent fuer die Koordinaten: die Logofarbe, wenn sie auf dem Stoff lesbar ist, sonst die Tinte
  let akzent = ton.akzent || tinte;
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(akzent);
  if (m) { const l = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255; if ((textil === 'dunkel' && l < 0.35) || (textil === 'hell' && l > 0.75)) akzent = tinte; }
  const rand = Math.round(W * 0.1), breit = W - 2 * rand;
  const KOPF = 'Playfair Display, DejaVu Serif, serif', KLEIN = 'Archivo, Liberation Sans, DejaVu Sans, sans-serif';
  const lieb = String(opts.lieblings || '').toLocaleUpperCase('de-DE');
  const ort = String(opts.ort || '');
  const koord = koordinatenText(opts.punkt);
  const zusatz = String(opts.zusatz || '').trim();

  const gLieb = Math.min(Math.round(W * 0.042), await passend(lieb, KLEIN, 600, Math.round(W * 0.042), breit, 0.22));
  const gOrt = Math.min(Math.round(W * 0.06), await passend(ort, KOPF, 700, Math.round(W * 0.06), breit, 0.14));
  const gKoord = Math.round(W * 0.026);
  const gZusatz = Math.min(Math.round(W * 0.034), await passend(zusatz || ' ', KOPF, 400, Math.round(W * 0.034), breit, 0.03));

  // Logo: hoechstens 80 % der Breite und 60 % der Breite hoch, unveraendert eingepasst
  const logo = await sharp(opts.logo).trim().resize({ width: Math.round(W * 0.8), height: Math.round(W * 0.6), fit: 'inside' }).png().toBuffer();
  const lm = await sharp(logo).metadata();

  let y = 0; const teile = [];
  if (lieb) { y += Math.round(gLieb * 1.1); teile.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${KLEIN}" font-weight="600" font-size="${gLieb}" letter-spacing="${(gLieb * 0.22).toFixed(1)}" fill="${tinte}">${esc(lieb)}</text>`); y += Math.round(gLieb * 1.1); }
  const logoTop = y; y += lm.height + Math.round(W * 0.05);
  const strichY = y; y += Math.round(W * 0.05);
  if (ort) { y += Math.round(gOrt * 0.8); teile.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${KOPF}" font-weight="700" font-size="${gOrt}" letter-spacing="${(gOrt * 0.14).toFixed(1)}" fill="${tinte}">${esc(ort)}</text>`); y += Math.round(gOrt * 0.55); }
  if (koord) { y += Math.round(gKoord * 1.4); teile.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${KLEIN}" font-weight="600" font-size="${gKoord}" letter-spacing="${(gKoord * 0.18).toFixed(1)}" fill="${akzent}">${esc(koord)}</text>`); y += Math.round(gKoord * 0.5); }
  // Sterne des Gastes (5. Okt., Markus: "wir aendern nur Name, Datum, Spruch und Bewertung"): eine Reihe in der Akzentfarbe.
  const sterne = Math.max(0, Math.min(5, Math.round(+opts.sterne || 0)));
  if (sterne) {
    const r = Math.round(W * 0.022), abst = Math.round(r * 2.6); y += Math.round(r * 2.6);
    const x0 = W / 2 - (abst * (sterne - 1)) / 2;
    for (let i = 0; i < sterne; i++) {
      const cx = x0 + i * abst, pts = [];
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; pts.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (y - r + rr * Math.sin(a) + r).toFixed(1)); }
      teile.push(`<polygon points="${pts.join(' ')}" fill="${akzent}"/>`);
    }
    y += r;
  }
  if (zusatz) { y += Math.round(gZusatz * 1.9); teile.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${KOPF}" font-weight="400" font-size="${gZusatz}" letter-spacing="${(gZusatz * 0.03).toFixed(1)}" fill="${tinte}">${esc(zusatz)}</text>`); }
  const H = y + Math.round(W * 0.03);
  const strich = `<line x1="${W / 2 - W * 0.16}" y1="${strichY}" x2="${W / 2 + W * 0.16}" y2="${strichY}" stroke="${akzent}" stroke-width="${Math.max(2, Math.round(W * 0.0018))}"/>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${teile.join('')}${strich}</svg>`);
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: svg, left: 0, top: 0 }, { input: logo, left: Math.round((W - lm.width) / 2), top: logoTop }]).png().toBuffer();
  return { png, textil, akzent, tinte };
}
