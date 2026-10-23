// Stoff statt glatter Flaeche in den Motto-Szenen (2. Okt.).
//
// Markus zum Abi-Ruecken: "nicht in den Stoff eingearbeitet" und "wir wollten verhindern, dass wir einfach
// eine richtige Platte da draufhaben". Gemessen: wo frueher die Magenta-Flaeche war, hat magentaEntfernen
// einen glatten Verlauf mit Rauschen hinterlassen - Faltenstaerke 1,2 gegen 3,5 im echten Stoff direkt
// darunter (Std-Abweichung von blur 3 minus blur 20, faltenStaerke unten). Alle 36 Szenen lagen innen bei
// 0,4 bis 1,8. Ohne Falten in der Vorlage kann stoffSchatten() nichts einarbeiten - der Druck liegt wie ein
// Blatt drauf, und auf dem Shirt sieht man ein graues Rechteck.
//
// Erster Versuch (verworfen): die Struktur des Stoffs UNTER der Flaeche hineinspiegeln. Beim Ruecken gut,
// bei jeder Vorderseite liegt dort der Saum - gespiegelt malte er Boegen ins Shirt.
// Jetzt: der Bilddienst fuellt die Flaeche als Stoff (das Bild mit durchsichtigem Loch IST die Maske),
// und hier wird NUR die Flaeche mit weichem Rand ins Original uebernommen. Alles andere bleibt pixelgleich,
// also passen weisse und schwarze Fassung weiter aufeinander (stoffMaske, Vermessung).
//
//   node werkzeug/falten-einsetzen.mjs loch <ordner>             je Szene und Farbe <key>_<farbe>.png mit Loch
//   node werkzeug/falten-einsetzen.mjs einsetzen <ordner>        <key>_<farbe>-ki.png -> vorlagen-original/
// Danach MITGELIEFERT[...].stand hochsetzen, sonst kopiert ensureTemplates die alte Datei nicht neu.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MITGELIEFERT } from '../mockups.js';

export const LOCH_RAND = 6;     // so viel groesser als die Flaeche wird das Loch geschnitten
export const UEBERGANG = 10;    // weicher Rand beim Zurueckholen

export async function faltenStaerke(buf, box) {
  const g = sharp(buf).greyscale();
  const { width: W } = await g.metadata();
  const a = await g.clone().blur(3).raw().toBuffer(), b = await g.clone().blur(20).raw().toBuffer();
  const x0 = box.x + (box.w * 0.2 | 0), y0 = box.y + (box.h * 0.2 | 0), w = box.w * 0.6 | 0, h = box.h * 0.5 | 0;
  let s = 0, q = 0, n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const d = a[y * W + x] - b[y * W + x]; s += d; q += d * d; n++; }
  return Math.sqrt(q / n - (s / n) ** 2);
}

export async function lochSchneiden(buf, box) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  for (let y = Math.max(0, box.y - LOCH_RAND); y < Math.min(H, box.y + box.h + LOCH_RAND); y++)
    for (let x = Math.max(0, box.x - LOCH_RAND); x < Math.min(W, box.x + box.w + LOCH_RAND); x++) data[(y * W + x) * 4 + 3] = 0;
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

// Nur das Loch (plus Uebergang nach innen) aus dem KI-Bild ins Original.
export async function flaecheUebernehmen(original, ki, box) {
  const o = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = o.info.width, H = o.info.height;
  const k = await sharp(ki).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer();
  const x0 = Math.max(0, box.x - LOCH_RAND), x1 = Math.min(W, box.x + box.w + LOCH_RAND), y0 = Math.max(0, box.y - LOCH_RAND), y1 = Math.min(H, box.y + box.h + LOCH_RAND);
  // Das KI-Bild ist insgesamt ein wenig heller oder dunkler als das Original (gemessen: Tonsprung an der
  // Kante 2-13 statt 0,2-3). Der Unterschied Original minus KI wird im Ring 6-40 px AUSSERHALB des Lochs
  // gemessen (dort zeigen beide dasselbe) und als Ebene je Kanal auf die Fuellung gelegt. Pixel mit grossem
  // Unterschied (verschobene Kante, Hand) zaehlen nicht.
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const ebene = [];
  for (let c = 0; c < 3; c++) {
    const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0]; let n = 0;
    for (let y = Math.max(0, y0 - 40); y < Math.min(H, y1 + 40); y++) for (let x = Math.max(0, x0 - 40); x < Math.min(W, x1 + 40); x++) {
      if (x >= x0 - 6 && x < x1 + 6 && y >= y0 - 6 && y < y1 + 6) continue;
      const i = (y * W + x) * 3, d = o.data[i + c] - k[i + c];
      if (Math.abs(d) > 30) continue;
      const v = [1, (x - x0) / 100, (y - y0) / 100];
      for (let a = 0; a < 3; a++) { r[a] += v[a] * d; for (let b = 0; b < 3; b++) S[a][b] += v[a] * v[b]; }
      n++;
    }
    const D = n > 300 ? det(S) : 0;
    ebene.push(D ? [0, 1, 2].map(q => det(S.map((row, a) => row.map((val, b) => b === q ? r[a] : val))) / D) : [0, 0, 0]);
  }
  const out = Buffer.from(o.data);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const g = Math.min(1, (Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y) + 1) / UEBERGANG);
    const i = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) {
      const [a, b, cc] = ebene[c];
      const kk = k[i + c] + a + b * (x - x0) / 100 + cc * (y - y0) / 100;
      out[i + c] = Math.max(0, Math.min(255, Math.round(kk * g + o.data[i + c] * (1 - g))));
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } });
}

export function szenenListe() {
  const liste = [];
  for (const [key, v] of Object.entries(MITGELIEFERT)) {
    if (!/-szene-thema-/.test(key) || !v.boxen || !v.dateien) continue;
    for (const farbe of ['white', 'black']) if (v.dateien[farbe] && v.boxen[farbe]) liste.push({ key, farbe, datei: v.dateien[farbe], box: v.boxen[farbe], teil: key.split('-')[0], ruecken: !!v.ruecken });
  }
  return liste;
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const [modus, ordner] = process.argv.slice(2);
  if (!ordner) { console.log('node werkzeug/falten-einsetzen.mjs loch|einsetzen <ordner>'); process.exit(1); }
  await fs.mkdir(ordner, { recursive: true });
  for (const s of szenenListe()) {
    const pfad = path.join('vorlagen-original', s.datei), name = path.join(ordner, s.key + '_' + s.farbe);
    const buf = await fs.readFile(pfad);
    if (modus === 'loch') {
      await fs.writeFile(name + '.png', await lochSchneiden(buf, s.box));
    } else if (modus === 'einsetzen') {
      let ki; try { ki = await fs.readFile(name + '-ki.png'); } catch { console.log(s.key, s.farbe, 'kein KI-Bild - bleibt'); continue; }
      const vor = await faltenStaerke(buf, s.box);
      const neu = await (await flaecheUebernehmen(buf, ki, s.box)).jpeg({ quality: 92 }).toBuffer();
      await fs.writeFile(pfad, neu);
      console.log(s.key, s.farbe, 'Faltenstaerke', vor.toFixed(2), '->', (await faltenStaerke(neu, s.box)).toFixed(2));
    }
  }
}

// Sichtbarkeit einer Ersatzflaeche: (a) Tonsprung an der Kante - mittlere Helligkeit 3-8 px innen gegen
// 3-8 px aussen, je Seite, das Maximum der Seiten (unten nicht: dort liegt oft der Saum);
// (b) Kornrauschen - Std-Abweichung von (Bild - blur 1) innen geteilt durch dieselbe aussen. Der graue
// Punkteteppich von magentaEntfernen hatte deutlich mehr Korn als der Stoff daneben.
export async function ersatzSichtbar(buf, box) {
  const g = sharp(buf).greyscale();
  const { width: W, height: H } = await g.metadata();
  const a = await g.clone().raw().toBuffer(), b = await g.clone().blur(1).raw().toBuffer();
  const mittel = (x0, y0, w, h) => { let s = 0, n = 0; for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) { s += a[y * W + x]; n++; } return n ? s / n : 0; };
  const korn = (x0, y0, w, h) => { let s = 0, q = 0, n = 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const d = a[y * W + x] - b[y * W + x]; s += d; q += d * d; n++; } return Math.sqrt(q / n - (s / n) ** 2); };
  const hy = box.y + (box.h * 0.25 | 0), hh = box.h * 0.5 | 0, wx = box.x + (box.w * 0.25 | 0), ww = box.w * 0.5 | 0;
  const sprung = Math.max(
    Math.abs(mittel(box.x + 3, hy, 5, hh) - mittel(box.x - 8, hy, 5, hh)),
    Math.abs(mittel(box.x + box.w - 8, hy, 5, hh) - mittel(box.x + box.w + 3, hy, 5, hh)),
    Math.abs(mittel(wx, box.y + 3, ww, 5) - mittel(wx, box.y - 8, ww, 5)));
  const kornInnen = korn(box.x + (box.w * 0.3 | 0), box.y + (box.h * 0.3 | 0), box.w * 0.4 | 0, box.h * 0.4 | 0);
  const kornAussen = korn(Math.max(0, box.x - 30), box.y + (box.h * 0.3 | 0), 20, box.h * 0.4 | 0);
  return { sprung, kornVerhaeltnis: kornInnen / Math.max(0.3, kornAussen) };
}
