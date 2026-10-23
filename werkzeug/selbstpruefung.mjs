// Selbstpruefung VOR dem Zeigen (Markus, 5. Okt.: "Du musst dich staendig ueberpruefen und Abfragen machen. Ist alles
// richtig, sieht alles gut aus. Ich kann dir nicht die ganze Zeit hinterher rennen"). Ausloeser: Luigis rote Pizza auf
// einem royalblauen Hoodie - das alte Motiv war nur umgefaerbt, niemand hatte geprueft, ob es auf dem Stoff wirkt.
// Je Textilmotiv drei Zahlen, jede mit Grenze:
//   1. UNSICHTBAR: Anteil der Motivflaeche, der auf diesem Stoff kaum zu sehen ist (brett.js farbWerte, dieselbe
//      Messung wie die Farbwahl im Band; Grenze FARB_GRENZE 15 %).
//   2. PLACKEN: Anteil voll deckender 64-px-Zellen im Umriss (deckung-zellen; Regel 9a: ueber 40 % ist ein Placken).
//   3. ROT AUF BLAU / GRUEN AUF ROT: Anteil kraeftig roter Motivflaeche auf blauem oder gruenem Stoff und umgekehrt -
//      flimmert, auch wenn der Helligkeitskontrast reicht (Grenze 12 %).
//   node werkzeug/selbstpruefung.mjs <motiv.png> <#stoff> [name] [druckbreite cm]   -> Zeile mit OK / NICHT ZEIGEN, Exit 1 bei NICHT
import sharp from 'sharp';
import { farbWerte, FARB_GRENZE } from '../brett.js';

export async function pruefen(motiv, stoffHex, breiteCm = 0) {
  const { werte } = await farbWerte(motiv, { stoff: stoffHex });
  const unsichtbar = werte.stoff;
  const { data, info } = await sharp(motiv).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, Z = Math.max(16, Math.round(64 * W / 2400));
  let umriss = 0, voll = 0;
  for (let zy = 0; zy + Z <= H; zy += Z) for (let zx = 0; zx + Z <= W; zx += Z) {
    let n = 0;
    for (let y = zy; y < zy + Z; y++) for (let x = zx; x < zx + Z; x++) if (data[(y * W + x) * 4 + 3] >= 96) n++;
    if (n > 0) umriss++;
    if (n === Z * Z) voll++;
  }
  const placken = umriss ? Math.round(voll / umriss * 100) : 0;
  // Farbton von Stoff und Motivpixeln (grob: rot, gruen, blau)
  const ton = (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 60) return '';
    if (r === mx && r > g * 1.6 && r > b * 1.4) return 'rot';
    if (b === mx && b > r * 1.3) return 'blau';
    if (g === mx && g > r * 1.15) return 'gruen';
    return '';
  };
  const s = [1, 3, 5].map(i => parseInt(stoffHex.slice(i, i + 2), 16));
  const stoffTon = ton(...s);
  const beissen = { blau: 'rot', gruen: 'rot', rot: 'gruen' }[stoffTon];
  let bunt = 0, alle = 0;
  for (let i = 0; i < W * H; i++) {
    if (data[i * 4 + 3] < 96) continue;
    alle++;
    if (beissen && ton(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) === beissen) bunt++;
  }
  const beisst = alle ? Math.round(bunt / alle * 100) : 0;
  const fehler = [];
  if (unsichtbar > FARB_GRENZE) fehler.push(`${unsichtbar} % kaum sichtbar (Grenze ${FARB_GRENZE})`);
  // Regel 9a: ein geschlossener Gegenstand (Karton, Schild) ist erlaubt, wenn er KLEIN ist (hoechstens 18 cm).
  if (placken > 40 && !(breiteCm && breiteCm <= 18)) fehler.push(`Placken ${placken} % (Grenze 40, ausser Gegenstand bis 18 cm)`);
  if (beisst > 12) fehler.push(`${beisst} % ${beissen} auf ${stoffTon} (Grenze 12)`);
  return { unsichtbar, placken, beisst, ok: !fehler.length, fehler };
}

if (process.argv[1] && process.argv[1].endsWith('selbstpruefung.mjs')) {
  const [motiv, stoff, name, breite] = process.argv.slice(2);
  const r = await pruefen(motiv, stoff, +breite || 0);
  console.log(`${r.ok ? 'OK          ' : 'NICHT ZEIGEN'} ${name || motiv} auf ${stoff}: unsichtbar ${r.unsichtbar} % · Placken ${r.placken} % · Farbbiss ${r.beisst} %${r.fehler.length ? ' -> ' + r.fehler.join('; ') : ''}`);
  process.exit(r.ok ? 0 : 1);
}
