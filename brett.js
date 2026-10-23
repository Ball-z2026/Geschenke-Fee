// Bretter erkennen (4. Okt.). Markus: "Die muessen Unterbrechung haben. Das Ganze fuehlt sich sonst an
// wie ein Brett." Gemessen wird der Anteil voll deckender Zellen im Motivumriss: Druckdatei auf 512 px,
// Zellen 16 px (rund 3 % der Breite), eine Zelle zaehlt zum Motiv ab Alpha 96, voll ist sie, wenn jedes
// Pixel Alpha 230 hat. Geeicht an den Live-Designs: Kegeltour Japan 79, Neon 77, Angler 72 (Bretter),
// Abinauten 42, Steffi 37, Dart Devils 33 (locker); Luigi am 2. Okt.: 58 = "Placken", 33-39 gut.
import sharp from 'sharp';

export const PLACKEN_GRENZE = 45;

// Die Druckdatei einmal auf hoechstens 512 px bringen (mit Alpha); kleinere Bilder bleiben, wie sie sind.
export async function kleinFassung(buf) {
  const m = await sharp(buf).metadata();
  if ((m.width || 0) <= 512 && (m.height || 0) <= 512) return buf;
  return sharp(buf).ensureAlpha().resize(512, 512, { fit: 'inside' }).png({ compressionLevel: 1 }).toBuffer();
}

export async function vollDeckend(buf) {

  const { data, info } = await sharp(buf).ensureAlpha().resize(512, 512, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, Z = 16;
  let inhalt = 0, voll = 0;
  for (let cy = 0; cy + Z <= H; cy += Z) for (let cx = 0; cx + Z <= W; cx += Z) {
    let a96 = 0, a230 = 0;
    for (let y = cy; y < cy + Z; y++) for (let x = cx; x < cx + Z; x++) { const a = data[(y * W + x) * 4 + 3]; if (a >= 96) a96++; if (a >= 230) a230++; }
    if (a96) inhalt++;
    if (a230 === Z * Z) voll++;
  }
  return inhalt ? Math.round(voll / inhalt * 100) : 0;
}

// Welche Textilfarbe traegt ein Design (4. Okt., Markus: "so dass es zum Design hervorragend passt")?
// Je Farbe der Anteil der Motivflaeche, der auf diesem Stoff kaum zu sehen ist: Druckdatei auf 48 px (wie die
// Dunkel-Messung vom 1. Okt.), ein Pixel zaehlt, wenn Helligkeits-Kontrast unter 1,6 : 1 UND Farbabstand
// (Lab, Delta E 76) unter 65 liegen. Geeicht am Abinauten-Design: die dunkle Schrift hat auf Rot Abstand 86
// (im Bild gut lesbar), auf Royalblau 58 (schwach), auf Schwarz 9 - gemessen Rot 13 %, Royal 28 %.
// Dazu der Farbton des Designs (nach Buntheit gewichtet), damit die Stofffarbe zu ihm passt.
export const FARB_GRENZE = 15;
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function lab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function farbton(hex) { const l = lab(...hex3(hex)); return Math.hypot(l[1], l[2]) < 12 ? null : (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360; }

// Grober Farbton eines Pixels fuer den Farbbiss: rot, orange, gruen, blau oder nichts (unbunt/gemischt).
export function grobTon(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 60) return '';
  if (r === mx && r > g * 1.6 && r > b * 1.4) return 'rot';
  if (r === mx && g > b * 1.4 && g < r * 0.75) return 'orange';   // Gelb (g fast wie r) ist kein Orange
  if (b === mx && b > r * 1.3) return 'blau';
  if (g === mx && g > r * 1.15) return 'gruen';
  return '';
}
// Flimmernde Paare (CLAUDE.md 9b; Markus, 5. Okt.: "rot auf blau sieht einfach Scheisse aus" - "blau auf Rot ganz klar
// verboten"): Motivfarbe auf diesem Stofffarbton.
export const BEISST = { rot: ['blau', 'gruen'], blau: ['rot', 'orange'], gruen: ['rot'], orange: ['blau'] };
export const BISS_GRENZE = 12;
// Feine Schrift und Linien (5. Okt., Markus mit Bild: Motorrad minimal, weisse Schrift auf weisser Zip-Jacke): die
// 48-px-Messung verwischt duenne Linien und sah sie nicht. Zusaetzlich auf 320 px, nur fuer HELLE Stoffe - auf dunklem
// Stoff zaehlten sonst die schwarzen Umrisse jedes Comics mit. Geeicht am 5. Okt.: Motorrad minimal U857 auf Weiss 29
// (unlesbar), Fan-Shirt minimal C9WE 43, gut lesbare Designs 0-11.
export const FEIN_GRENZE = 15;
// 6. Okt., Markus (Meister-Shirt FAJB auf Weiss: cremeweisse Schrift "MEISTER", "TTC Buchholz", helle Schlaeger-Umrisse):
// "Da ist schon wieder weiss auf weissem T-Shirt." Gemessen Rand 19 - knapp unter der alten Grenze 20. Die guten Designs liegen
// bei 0 bis 8 (Fanshirt NSYH 8), also 10.
export const RAND_GRENZE = 10;
const lumi = (p) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);

export async function farbWerte(buf, farben) {
  // 5. Okt.: die Druckdatei (bis 40 MB) nur EINMAL entpacken - alles Weitere laeuft auf 512 px (vorher viermal ganz entpackt,
  // rund 10 s je Design; nach dem Deploy stand das Band darum ueber eine Stunde leer).
  buf = await kleinFassung(buf);
  const { data } = await sharp(buf).ensureAlpha().resize(48, 48, { fit: 'inside', kernel: 'cubic' }).raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] / 255 >= 0.6) px.push([data[i], data[i + 1], data[i + 2]]);
  const gross = await sharp(buf).ensureAlpha().resize(320, 320, { fit: 'inside' }).raw().toBuffer();
  const pg = [];
  for (let i = 0; i < gross.length; i += 4) if (gross[i + 3] >= 160) pg.push([gross[i], gross[i + 1], gross[i + 2]]);
  const werte = {}, biss = {}, fein = {};
  for (const [k, hex] of Object.entries(farben)) {
    const c = hex3(hex), Lc = lumi(c), lc = lab(...c);
    let schlecht = 0;
    for (const p of px) {
      const L = lumi(p);
      if ((Math.max(L, Lc) + 0.05) / (Math.min(L, Lc) + 0.05) >= 1.6) continue;
      const lp = lab(...p);
      if (Math.hypot(lp[0] - lc[0], lp[1] - lc[1], lp[2] - lc[2]) < 65) schlecht++;
    }
    werte[k] = px.length ? Math.round(schlecht / px.length * 100) : 0;
    const feinde = BEISST[grobTon(...c)] || [];
    let b = 0, f = 0;
    for (const p of pg) {
      if (feinde.length && feinde.includes(grobTon(...p))) b++;
      if (Lc > 0.5) { const L = lumi(p); if ((Math.max(L, Lc) + 0.05) / (Math.min(L, Lc) + 0.05) < 1.6) f++; }
    }
    biss[k] = pg.length ? Math.round(b / pg.length * 100) : 0;
    fein[k] = pg.length ? Math.round(f / pg.length * 100) : 0;
  }
  // Farbton: Summe der Buntheitsvektoren (a, b) aller bunten Pixel
  let sa = 0, sb = 0, bunt = 0;
  for (const p of px) { const l = lab(...p), ch = Math.hypot(l[1], l[2]); if (ch < 20) continue; sa += l[1]; sb += l[2]; bunt++; }
  const ton = bunt >= px.length * 0.1 && Math.hypot(sa, sb) > bunt * 8 ? Math.round((Math.atan2(sb, sa) * 180 / Math.PI + 360) % 360) : null;
  // Woraus das Motiv besteht: weiss (hell und unbunt), schwarz (dunkel und unbunt), bunt - fuer Rot (siehe NUR_WEISS).
  let pw = 0, ps = 0, pb = 0;
  for (const p of pg) {
    const ch = Math.max(...p) - Math.min(...p), L = lumi(p);
    if (ch >= 40) pb++; else if (L > 0.6) pw++; else if (L < 0.08) ps++;
  }
  // Rand (5. Okt. nachmittags, Markus: "da ist schon wieder weiss auf weiss"): Motivpunkte, die an den Stoff grenzen und
  // so hell sind wie er - dort loest sich das Motiv im Stoff auf, auch wenn insgesamt wenig Helles drin ist. Geeicht an
  // den Druckdateien aus dem Band: Motorrad minimal 4UWQ auf Weiss 74, Abschluss minimal 7258 45, gute Designs 0-8.
  const rand = {};
  {
    const { data: rd, info: ri } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = ri.width, H = ri.height, randPx = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (rd[i + 3] < 160) continue;
      if (rd[i - 4 + 3] < 60 || rd[i + 4 + 3] < 60 || rd[i - W * 4 + 3] < 60 || rd[i + W * 4 + 3] < 60) randPx.push(lumi([rd[i], rd[i + 1], rd[i + 2]]));
    }
    for (const [k, hex] of Object.entries(farben)) {
      const Lc = lumi(hex3(hex));
      if (Lc <= 0.5) continue;
      let n = 0; for (const L of randPx) if ((Math.max(L, Lc) + 0.05) / (Math.min(L, Lc) + 0.05) < 1.6) n++;
      rand[k] = randPx.length ? Math.round(n / randPx.length * 100) : 0;
    }
  }
  const palette = pg.length ? { weiss: Math.round(pw / pg.length * 100), schwarz: Math.round(ps / pg.length * 100), bunt: Math.round(pb / pg.length * 100) } : { weiss: 0, schwarz: 0, bunt: 100 };
  return { werte, ton, biss, fein, rand, palette, rahmen: await rahmenAnteil(buf), v: MESS_STAND };
}
// Stand der Messung: aeltere Eintraege (ohne Biss, Fein, Rahmen) werden nachgemessen.
export const MESS_STAND = 3;

// Rahmen und Platte (5. Okt., Markus zur Bowling-Tasche: "dieser komische Schatten"): das Motiv steckt in einem
// gezeichneten Kasten - auf mindestens drei Seiten laeuft eine Linie (auch gestrichelt) an der Aussenkante entlang.
// Gemessen je Seite: Anteil der Kante, an dem im aeussersten Streifen (3 % des Umrisses) Motiv liegt. Ein rundes Emblem
// beruehrt seine Kanten nur in der Mitte (rund 35 %), Schrift oben und unten macht hoechstens zwei Seiten voll.
export const RAHMEN_GRENZE = 3;
export async function rahmenAnteil(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().trim({ threshold: 1 }).resize(400, 400, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, d = Math.max(3, Math.round(Math.min(W, H) * 0.03));
  const da = (x, y) => data[(y * W + x) * 4 + 3] >= 96;
  const seite = (laenge, an) => { let n = 0; for (let t = 0; t < laenge; t++) if (an(t)) n++; return n / laenge; };
  const s = [
    seite(W, (x) => { for (let y = 0; y < d; y++) if (da(x, y)) return true; return false; }),
    seite(W, (x) => { for (let y = H - d; y < H; y++) if (da(x, y)) return true; return false; }),
    seite(H, (y) => { for (let x = 0; x < d; x++) if (da(x, y)) return true; return false; }),
    seite(H, (y) => { for (let x = W - d; x < W; x++) if (da(x, y)) return true; return false; }),
  ];
  return s.filter((v) => v >= 0.55).length;
}

// Die beste Farbe fuer ein Design: nur Farben unter FARB_GRENZE; dann die, deren Farbton dem Design am naechsten
// ist (Ton-Abstand zaehlt wie bis zu 8 Prozentpunkte). Ohne bunten Farbton entscheidet nur die Sichtbarkeit.
// frei (5. Okt., Markus: "Ich wuerde es nicht sperren, weil es kann sein, dass der Kunde das ausdruecklich moechte"): beim
// BESTELLEN entscheidet der Kunde - dann zaehlt nur, dass das Motiv sichtbar ist; die strengen Paare (Biss, Rot nur Weiss,
// eigener Ton) ordnen nur die Reihenfolge. Was WIR zeigen (Band, Schaufenster), bleibt streng.
export function besteFarbe(messung, farben, erlaubt = Object.keys(farben), opts = {}) {
  if (!messung || !messung.werte) return null;
  if (opts.frei) {
    const streng = besteFarbe(messung, farben, erlaubt) || [];
    const sichtbar = erlaubt.filter((k) => typeof messung.werte[k] === 'number' && messung.werte[k] <= FARB_GRENZE)
      .sort((a, b) => messung.werte[a] - messung.werte[b]);
    const alle = streng.concat(sichtbar.filter((k) => !streng.includes(k)));
    return alle.length ? alle : null;
  }
  // Nie eine Farbe auf ihrem eigenen Ton (CLAUDE.md 9b: "Rot auf Rot, Gruen auf Gruen"): Stoff, dessen Farbton naeher
  // als 35 Grad am Ton des Designs liegt, faellt raus. Nie ein flimmerndes Paar (biss), nie feine Schrift, die auf
  // hellem Stoff verschwindet (fein). Unter den guten: die am besten sichtbare.
  const kand = erlaubt.filter((k) => typeof messung.werte[k] === 'number' && messung.werte[k] <= FARB_GRENZE)
    .filter((k) => !(messung.biss && messung.biss[k] > BISS_GRENZE) && !(messung.fein && messung.fein[k] > FEIN_GRENZE))
    .filter((k) => !NUR_WEISS.includes(k) || nurWeiss(messung))
    .filter((k) => { const t = farbton(farben[k]); return messung.ton == null || t == null || Math.min(Math.abs(t - messung.ton), 360 - Math.abs(t - messung.ton)) >= 35; })
    .map((k) => ({ k, punkte: messung.werte[k] + (messung.fein ? messung.fein[k] || 0 : 0) / 2 }))
    .sort((a, b) => a.punkte - b.punkte);
  return kand.length ? kand.map((x) => x.k) : null;
}
// ROT nur fuer einfarbig Weiss mit ein bisschen Schwarz (Markus, 5. Okt.: "bei Rot ... kann nur einfarbig weiss drauf
// mit ein bisschen schwarz - Rot finde ich eine ganz schwierige Farbe").
export const NUR_WEISS = ['rot'];
export function nurWeiss(m) { return !!(m && m.palette && m.palette.weiss >= 60 && m.palette.bunt <= 5); }
// Darf das Design so gezeigt werden? Weiss/Schwarz ohne Einfaerben: Weiss braucht fein <= FEIN_GRENZE, beides braucht
// werte <= FARB_GRENZE; ein Rahmen auf drei Seiten wird nie gezeigt. Ohne neue Messung (v < 2): nicht zeigen.
export function zeigbar(messung, stoff) {
  if (!messung || messung.v !== MESS_STAND) return false;
  if (messung.rahmen >= RAHMEN_GRENZE) return false;
  if (typeof messung.werte[stoff] === 'number' && messung.werte[stoff] > FARB_GRENZE) return false;
  if (messung.fein && messung.fein[stoff] > FEIN_GRENZE) return false;
  if (!messung.rand || (typeof messung.rand[stoff] === 'number' && messung.rand[stoff] > RAND_GRENZE)) return false;
  if (messung.biss && messung.biss[stoff] > BISS_GRENZE) return false;
  if (NUR_WEISS.includes(stoff) && !nurWeiss(messung)) return false;
  return true;
}
