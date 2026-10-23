// Rueckenfotos fuer T-Shirt und Hoodie (5. Okt. abends, Markus mit Bild: "ausgewaehlt ist ... gross auf Hoodie, gekommen ist
// Hoodie vorne" - die Groesse "Ruecken 30 x 35" kam in der Vorschau auf die Brust). Es gab kein Foto von hinten, nur vier
// Motto-Szenen. Stanley/Stella liefert die Rueckansicht als Packshot (PBM0, textil-bilder/ss-*_back.jpg, unveraendert vom
// Hersteller) und erlaubt Mockups darauf (textilien.js MARKEN). Wie bei den Vorderseiten (Stand 84): auf 1024 px normiert,
// Textil 850 px hoch und mittig; die Druckflaeche aus der Silhouette - so breit wie bei der Zip-Jacke von hinten (60 % der
// Saumbreite beim Shirt: 38 cm von rund 55 cm Saum in L = 69 %), Seitenverhaeltnis 38 x 48 (das Hoechstmass), oben unter dem Kragen bzw. unter der Kapuze.
//   node werkzeug/ruecken-vorlagen.mjs   schreibt vorlagen-original/<teil>-ruecken_<farbe>.jpg und gibt die Flaechen aus
import sharp from 'sharp';
// breite: Anteil der Saumbreite (T-Shirt) bzw. der Gesamtbreite mit Aermeln (Hoodie - unten haengen die Buendchen neben dem Saum)
const TEILE = { tee: { quelle: 'ss-tee', oben: 0.20, breite: 0.69, ganz: false }, hoodie: { quelle: 'ss-hoodie', oben: 0.30, breite: 0.40, ganz: true } };
const erg = {};
for (const [teil, t] of Object.entries(TEILE)) {
  for (const farbe of ['white', 'black']) {
    const roh = sharp(`textil-bilder/${t.quelle}_${farbe}_back.jpg`);
    // Hintergrund ist hell und flach: alles, was deutlich davon abweicht, ist Textil
    const { data, info } = await roh.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, bg = [data[0], data[1], data[2]];
    const istTextil = (x, y) => { const i = (y * W + x) * 3; return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 24; };
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (istTextil(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const k = 850 / (y1 - y0 + 1);
    const bw = Math.round((x1 - x0 + 1) * k), left = Math.round((1024 - bw) / 2), top = Math.round((1024 - 850) / 2);
    const textil = await roh.clone().extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).resize(bw, 850).toBuffer();
    const bild = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: bg[0], g: bg[1], b: bg[2] } } }).composite([{ input: textil, left, top }]).jpeg({ quality: 92 }).toBuffer();
    await sharp(bild).toFile(`vorlagen-original/${teil}-ruecken_${farbe}.jpg`);
    // Saumbreite: unterste 4 % des Textils
    const { data: d2 } = await sharp(bild).raw().toBuffer({ resolveWithObject: true });
    const ist2 = (x, y) => { const i = (y * 1024 + x) * 3; return Math.abs(d2[i] - bg[0]) + Math.abs(d2[i + 1] - bg[1]) + Math.abs(d2[i + 2] - bg[2]) > 24; };
    const yS = top + Math.round(850 * 0.96); let s0 = 1024, s1 = 0;
    for (let x = 0; x < 1024; x++) if (ist2(x, yS)) { if (x < s0) s0 = x; if (x > s1) s1 = x; }
    const w = Math.round((t.ganz ? bw : (s1 - s0)) * t.breite), h = Math.round(w * 48 / 38);
    erg[`${teil}-ruecken`] = erg[`${teil}-ruecken`] || {};
    erg[`${teil}-ruecken`][farbe] = { x: Math.round(512 - w / 2), y: top + Math.round(850 * t.oben), w, h };
  }
}
console.log(JSON.stringify(erg));
