// Magenta-Abnahme: der Platzhalter in den Vorlagen wird gemessen, entfernt und nachgeputzt -
// an einem Bild, das genau so gemalt ist, wie der Bilddienst es liefert.
//
// Warum es das gibt (Fassung 90, 18. Sept., 21:27): Auf Markus' Startseite stand ein rosa
// Kasten hinter dem Aquarell auf dem weiszen Shirt. Die Kette dahinter: die Messung nahm nur
// sattes Magenta und uebersah den hellen Lichtsaum, den das Modell malt -> die Flaeche wurde
// zu klein gemessen -> der Ring, aus dem der Stoffton gemittelt wird, lag im rosa Saum -> die
// Flaeche wurde mit Rosa gefuellt. Drei Glieder, jedes fuer sich plausibel, zusammen ein Kasten.
//
// Das Probebild hat alles, was das echte hat: ungleichmaessigen Stoff, einen Platzhalter mit
// hellem Rosa oben und dunklem Lila unten, eine weiche 3-px-Kante - und ein rosa Kissen weit
// weg, das NICHT zur Druckflaeche werden darf und NICHT grau werden darf.

import sharp from 'sharp';
import { magentaEntfernen, magentaRest, flaecheAusMagenta, flaecheNachmessen, flaecheBefund, boxNachCover } from './vorlagen.js';

const W = 600, H = 600, bx = 180, by = 150, bw = 240, bh = 300;

// Gesaeter Zufall fuer das Korn - jeder Lauf dasselbe Bild.
function zufallsquelle(saat) {
  let s = saat | 0;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// verlauf: Stoff wird nach unten hin heller (200 -> 250), wie Licht von unten - damit die
// Fuellung zeigen muss, dass sie dem Verlauf folgt statt eine Farbe zu nehmen.
// korn: +-3 Rauschen wie fotografierter Stoff.
function probebild({ kissen = false, verlauf = false, korn = false } = {}) {
  const px = Buffer.alloc(W * H * 4);
  const zufall = zufallsquelle(4711);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    let stoff = verlauf ? 200 + 50 * y / H : 228 + 10 * Math.sin(x / 37) * Math.cos(y / 53);   // 218..238, wie ein Foto
    if (korn) stoff += (zufall() - 0.5) * 6;
    stoff = Math.round(stoff);
    let r = stoff, g = stoff, b = stoff - 4;
    const dx = Math.max(bx - x, x - (bx + bw - 1), 0), dy = Math.max(by - y, y - (by + bh - 1), 0);
    const d = Math.max(dx, dy);
    if (d <= 3) {
      const t = (y - by) / bh; let mr, mg, mb;
      if (t < 0.5) { const u = t / 0.5; mr = 255; mg = Math.round(150 * (1 - u)); mb = Math.round(245 - 15 * u); }   // Licht: helles Rosa
      else { const u = (t - 0.5) / 0.5; mr = Math.round(255 - 85 * u); mg = 0; mb = Math.round(230 - 80 * u); }       // Schatten: Lila
      const a = d === 0 ? 1 : (1 - d / 4);                                                                            // weiche Kante
      r = Math.round(mr * a + r * (1 - a)); g = Math.round(mg * a + g * (1 - a)); b = Math.round(mb * a + b * (1 - a));
    }
    if (kissen && y >= 20 && y < 120 && x >= 450 && x < 580) { r = 240; g = 170; b = 225; }
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  }
  return px;
}
const alsPng = (px) => sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
// Echtes Pixelmittel eines Ausschnitts. NICHT sharp().extract().stats(): das liefert die
// Statistik des ganzen Eingangsbilds und hat mich eine Stunde gekostet.
async function mittel(buf, x, y, w, h) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = (yy * info.width + xx) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}
const nahe = (a, b, tol) => Math.abs(a - b) <= tol;
const trifft = (box) => nahe(box.x, bx, 3) && nahe(box.y, by, 3) && nahe(box.w, bw, 6) && nahe(box.h, bh, 6);

export async function pruefeMagenta({ pruefe, abschnitt }) {
  abschnitt(8, 'Magenta-Platzhalter: messen, entfernen, nachputzen');
  const echt = { x: bx, y: by, w: bw, h: bh };

  // 1) Neue Vorlage, neuer Weg
  const png = await alsPng(probebild());
  const box = await flaecheAusMagenta(png);
  pruefe('Messung nimmt den Lichtsaum mit (nicht nur sattes Magenta)', trifft(box), `${box.w}x${box.h} bei ${box.x}/${box.y} · soll 240x300 bei 180/150`);
  const sauber = await magentaEntfernen(png, box);
  pruefe('nach dem Entfernen kein Rosa mehr in der Flaeche', (await magentaRest(sauber, echt)) === 0);
  const m = await mittel(sauber, bx, by, bw, bh);
  pruefe('Ersatzton ist der Stoff, nicht Rosa', nahe(m[0], 228, 6) && nahe(m[1], 228, 6) && nahe(m[2], 224, 6), m.join(','));
  const rand = await mittel(sauber, 0, 0, 150, H);
  pruefe('Stoff auszerhalb der Flaeche unangetastet', nahe(rand[1], 228, 3), rand.join(','));

  // 2) Vorlage vom Volume, mit der alten Regel gebaut: Flaeche zu klein, Kern rosa gefuellt
  const alt = probebild();
  const altBox = { x: 179, y: 192, w: 242, h: 258 };
  for (let y = altBox.y; y < altBox.y + altBox.h; y++) for (let x = altBox.x; x < altBox.x + altBox.w; x++) { const i = (y * W + x) * 4; alt[i] = 230; alt[i + 1] = 173; alt[i + 2] = 222; }
  const altPng = await alsPng(alt);
  const neuBox = await flaecheNachmessen(altPng, altBox);
  pruefe('Nachmessen einer alten Vorlage findet die echte Flaeche', trifft(neuBox), `${neuBox.w}x${neuBox.h} bei ${neuBox.x}/${neuBox.y}`);
  const geputzt = await magentaEntfernen(altPng, neuBox);
  pruefe('Nachputzen laesst kein Rosa zurueck', (await magentaRest(geputzt, echt)) === 0);
  const m2 = await mittel(geputzt, bx, by, bw, bh);
  pruefe('Nachputzen fuellt mit Stoffton', nahe(m2[0], 228, 6) && nahe(m2[1], 228, 6), m2.join(','));

  // 3) Rosa Kissen weit weg
  const kPng = await alsPng(probebild({ kissen: true }));
  const kBox = await flaecheAusMagenta(kPng);
  pruefe('rosa Kissen wird nicht Teil der Druckflaeche', trifft(kBox), `${kBox.w}x${kBox.h}`);
  const kiss = await mittel(await magentaEntfernen(kPng, kBox), 450, 20, 130, 100);
  pruefe('rosa Kissen bleibt rosa', kiss[0] === 240 && kiss[1] === 170, kiss.join(','));

  // 4) Gerahmtes Bild: der Ring um die Flaeche ist der schwarze Rahmen, nicht das Papier.
  //    Am echten Poster-an-der-Wand wurde die Flaeche dunkelgrau - die Artikelfarbe muss gelten.
  const gerahmt = probebild();
  for (let y = by - 30; y < by + bh + 30; y++) for (let x = bx - 30; x < bx + bw + 30; x++) {
    const drin = x >= bx - 3 && x < bx + bw + 3 && y >= by - 3 && y < by + bh + 3;
    if (drin) continue;
    const i = (y * W + x) * 4; gerahmt[i] = 22; gerahmt[i + 1] = 22; gerahmt[i + 2] = 24;   // Rahmen
  }
  const gPng = await alsPng(gerahmt);
  const gBox = await flaecheAusMagenta(gPng);
  const gWeiss = await mittel(await magentaEntfernen(gPng, gBox, { farbe: 'white' }), bx + 10, by + 10, bw - 20, bh - 20);
  pruefe('weisses Poster im schwarzen Rahmen wird papierweiss, nicht rahmengrau', gWeiss[0] >= 235 && gWeiss[1] >= 235, gWeiss.join(','));
  const gOhne = await mittel(await magentaEntfernen(gPng, gBox, {}), bx + 10, by + 10, bw - 20, bh - 20);
  pruefe('ohne Farbangabe gilt weiter der Ring (hier: der Rahmen)', gOhne[0] < 60, gOhne.join(','));
  const sWeiss = await mittel(await magentaEntfernen(png, box, { farbe: 'white' }), bx, by, bw, bh);
  pruefe('weisses Shirt: Ring ist Stoff und bleibt der Ersatzton', nahe(sWeiss[0], 228, 6) && nahe(sWeiss[1], 228, 6), sWeiss.join(','));
  // 4a) DUENNER Rahmen (6 px): im Ring 4..14 px liegt fast nur helle Wand, der Ring
  //     widerspricht Weisz also nicht - aber die Stuetzwerte der Verlaufsfuellung kaemen aus
  //     dem Rahmen direkt an der Kante. Das Poster wuerde rahmendunkel. Der Streifen an der
  //     Kante muss mitentscheiden.
  const duenn = probebild();
  for (let y = by - 9; y < by + bh + 9; y++) for (let x = bx - 9; x < bx + bw + 9; x++) {
    const drin = x >= bx - 3 && x < bx + bw + 3 && y >= by - 3 && y < by + bh + 3;
    if (drin) continue;
    const i = (y * W + x) * 4; duenn[i] = 22; duenn[i + 1] = 22; duenn[i + 2] = 24;
  }
  const dPng = await alsPng(duenn);
  const dBox = await flaecheAusMagenta(dPng);
  const dWeiss = await mittel(await magentaEntfernen(dPng, dBox, { farbe: 'white' }), bx + 10, by + 10, bw - 20, bh - 20);
  pruefe('weisses Poster im DUENNEN Rahmen wird papierweiss (Streifen an der Kante zaehlt)', dWeiss[0] >= 235 && dWeiss[1] >= 235, dWeiss.join(','));

  // 4b) Vorlage vom Volume, vom alten Code DUNKEL gefuellt (Ring = Rahmen), kein Rosa mehr drin.
  //     19. Sept., 04:48, Markus' Poster an der Wand. Das Nachputzen muss die falsche Farbe erkennen.
  {
    const os = await import('node:os'); const fsp = await import('node:fs/promises'); const pathm = await import('node:path');
    const { vorlagenNachputzen } = await import('./vorlagen.js');
    const tmp = await fsp.mkdtemp(pathm.join(os.tmpdir(), 'mo-nachputz-'));
    await fsp.mkdir(pathm.join(tmp, 'templates'), { recursive: true });
    const dunkel = probebild();
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { const i = (y * W + x) * 4; dunkel[i] = 45; dunkel[i + 1] = 45; dunkel[i + 2] = 48; }
    await fsp.writeFile(pathm.join(tmp, 'templates', 'poster-szene_white.png'), await alsPng(dunkel));
    const erg = await vorlagenNachputzen(tmp, { 'poster-szene_white': { x: bx, y: by, w: bw, h: bh } });
    const nachher = await mittel(await fsp.readFile(pathm.join(tmp, 'templates', 'poster-szene_white.png')), bx + 10, by + 10, bw - 20, bh - 20);
    pruefe('dunkel gefuellte weisse Vorlage wird beim Nachputzen papierweiss', erg.geputzt.length === 1 && nachher[0] >= 240, nachher.join(',') + ' · geputzt: ' + erg.geputzt.length);
    // "Sauber" heisst seit dem 19. Sept.: so gefuellt, wie magentaEntfernen es heute tut - mit
    // dem Verlauf des Stoffs. Das Nachputzen darf daran nichts mehr aendern (sonst wuerde jeder
    // Serverstart alle Vorlagen neu schreiben und alle Mockups verwerfen).
    const sauber = await magentaEntfernen(await alsPng(probebild({ korn: true })), echt, { farbe: 'white' });
    await fsp.writeFile(pathm.join(tmp, 'templates', 'tee_probe_white.png'), sauber);
    const erg2 = await vorlagenNachputzen(tmp, { 'tee_probe_white': { x: bx, y: by, w: bw, h: bh } });
    pruefe('korrekt gefuellte Vorlage bleibt unangetastet', erg2.sauber.includes('tee_probe_white') && erg2.geputzt.length === 0, 'geputzt: ' + erg2.geputzt.length);
    // 4c) Vorlage vom Volume, vom alten Code FLACH gefuellt, in der richtigen Farbe, ohne Rosa.
    //     19. Sept., laufende Seite: der Kasten hinter dem Motiv auf dem getragenen Abi-Shirt.
    const flach = probebild({ korn: true });
    for (let y = by - 2; y < by + bh + 2; y++) for (let x = bx - 2; x < bx + bw + 2; x++) { const i = (y * W + x) * 4; flach[i] = 228; flach[i + 1] = 228; flach[i + 2] = 224; }
    await fsp.writeFile(pathm.join(tmp, 'templates', 'tee-szene_white.png'), await alsPng(flach));
    const erg3 = await vorlagenNachputzen(tmp, { 'tee-szene_white': { x: bx, y: by, w: bw, h: bh } });
    const nachFlach = await fsp.readFile(pathm.join(tmp, 'templates', 'tee-szene_white.png'));
    const befund = await flaecheBefund(nachFlach, echt, 'white');
    pruefe('flach gefuellte Vorlage auf koernigem Stoff wird beim Nachputzen neu gefuellt', erg3.geputzt.length === 1 && erg3.geputzt[0].verlauf === true && !befund.flachAufStoff, 'geputzt: ' + erg3.geputzt.length + ' · Spanne danach: ' + befund.innenSpanne);
    await fsp.rm(tmp, { recursive: true, force: true });
  }

  // 4d) Die Fuellung ist ein Verlauf, kein Farbwert: Stoff, der nach unten heller wird, muss
  //     in der Flaeche nach unten heller werden - und an keiner Kante eine Stufe haben.
  {
    const vPng = await alsPng(probebild({ verlauf: true, korn: true }));
    const vBox = await flaecheAusMagenta(vPng);
    const gefuellt = await magentaEntfernen(vPng, vBox, { farbe: 'white' });
    const obenM = await mittel(gefuellt, bx + 20, by + 5, bw - 40, 20), untenM = await mittel(gefuellt, bx + 20, by + bh - 25, bw - 40, 20);
    pruefe('Fuellung folgt dem Verlauf des Stoffs (unten heller als oben)', untenM[1] - obenM[1] >= 15, `oben ${obenM[1]} · unten ${untenM[1]} · Stoff daneben 212 -> 237`);
    const helligkeit = (m) => 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    const stufe = (aussen, innen) => Math.abs(helligkeit(aussen) - helligkeit(innen));
    const y0 = by + 20, hh = bh - 40, x0 = bx + 20, ww = bw - 40;
    const stufen = [
      stufe(await mittel(gefuellt, bx - 12, y0, 6, hh), await mittel(gefuellt, bx + 1, y0, 6, hh)),
      stufe(await mittel(gefuellt, bx + bw + 6, y0, 6, hh), await mittel(gefuellt, bx + bw - 7, y0, 6, hh)),
      stufe(await mittel(gefuellt, x0, by - 12, ww, 6), await mittel(gefuellt, x0, by + 1, ww, 6)),
      stufe(await mittel(gefuellt, x0, by + bh + 6, ww, 6), await mittel(gefuellt, x0, by + bh - 7, ww, 6))
    ];
    pruefe('keine Stufe an den vier Kanten der Flaeche (< 3 Helligkeitsstufen)', stufen.every(s => s < 3), stufen.map(s => s.toFixed(1)).join(' / '));
    // Korn: die Flaeche soll so koernig sein wie der Stoff, nicht glatt wie Lack
    const { data: gd, info: gi } = await sharp(gefuellt).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const kornVon = (xa, xb, ya, yb) => {
      let s = 0, s2 = 0, n = 0;
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb - 1; x++) { const i = (y * gi.width + x) * 4; const d = gd[i + 5] - gd[i + 1]; s += d; s2 += d * d; n++; }
      return Math.sqrt(s2 / n - (s / n) ** 2) / Math.SQRT2;
    };
    const kornInnen = kornVon(bx + 20, bx + bw - 20, by + 20, by + bh - 20), kornAussen = kornVon(20, 140, 20, H - 20);
    pruefe('Flaeche traegt das Korn des Stoffs', kornInnen > kornAussen * 0.6 && kornInnen < kornAussen * 1.5, `innen ${kornInnen.toFixed(2)} · Stoff ${kornAussen.toFixed(2)}`);
    // Kein lila Saum: nichts leicht Magenta-artiges mehr in und um die Flaeche (5 px)
    let lila = 0;
    for (let y = by - 5; y < by + bh + 5; y++) for (let x = bx - 5; x < bx + bw + 5; x++) { const i = (y * gi.width + x) * 4; if (gd[i] - gd[i + 1] > 12 && gd[i + 2] - gd[i + 1] > 12) lila++; }
    pruefe('keine lila Haarlinie um die Flaeche', lila === 0, lila + ' Pixel');
    pruefe('zweimal gebaut ist zweimal gleich (gesaetes Korn)', Buffer.compare(gefuellt, await magentaEntfernen(vPng, vBox, { farbe: 'white' })) === 0);
  }

  // 4e) Veraltete Mockups: nach dem Nachputzen muessen ALLE Bilder des Artikels weg - auch die
  //     Situationsbilder (…_tee-szene.jpg) und das sachliche Vorzeige-Shirt (stil_abi_standard.jpg).
  //     19. Sept., 12:05: genau die blieben stehen, und die Startseite zeigte den alten Kasten.
  {
    const os = await import('node:os'); const fsp = await import('node:fs/promises'); const pathm = await import('node:path');
    const { mockupGehoertZu, vorlageZuMockup, mockupsVerwerfen, veralteteMockupsRaeumen } = await import('./mockups.js');
    const trifft = ['stil_abi_standard_tee-szene.jpg', 'stil_abi_standard.jpg', 'stil_abi_standard.jpg.avif', 'MO-ABI-1_tee_black_szene_v76.jpg', 'MO-ABI-1_tee_white_deckend_v76.jpg.webp', 'stil_malle-fahrt_minimal_tee.jpg'];
    const bleibt = ['stil_abi_standard_hoodie-szene.jpg', 'MO-ABI-1_hoodie_black_v76.jpg', 'firma_v3_x_zip_white_brust.jpg', 'stil_sprueche-shirt_kachel_kissen.jpg'];
    pruefe('Mockup-Dateien des T-Shirts werden in jeder Namensform erkannt', trifft.every(f => mockupGehoertZu(f, ['tee'])) && bleibt.every(f => !mockupGehoertZu(f, ['tee'])));
    pruefe('Vorlage zum Mockup: Situation und Artikel aus dem Namen', vorlageZuMockup('stil_abi_standard_tee-szene.jpg') === 'tee-szene' && vorlageZuMockup('MO-ABI-1_tee_black_szene_v76.jpg') === 'tee-szene' && vorlageZuMockup('stil_abi_standard.jpg') === 'tee' && vorlageZuMockup('MO-ABI-1_hoodie_black_v76.jpg') === 'hoodie' && vorlageZuMockup('irgendwas.jpg') === null);
    const tmp = await fsp.mkdtemp(pathm.join(os.tmpdir(), 'mo-mockups-'));
    await fsp.mkdir(pathm.join(tmp, 'templates'), { recursive: true }); await fsp.mkdir(pathm.join(tmp, 'mockups'), { recursive: true });
    for (const f of [...trifft, ...bleibt]) await fsp.writeFile(pathm.join(tmp, 'mockups', f), 'x');
    const weg = await mockupsVerwerfen(tmp, ['tee']);
    const rest = await fsp.readdir(pathm.join(tmp, 'mockups'));
    pruefe('Verwerfen loescht genau die Mockups des Artikels', weg === trifft.length && rest.length === bleibt.length && bleibt.every(f => rest.includes(f)), `${weg} weg, ${rest.length} bleiben`);
    // Mockup aelter als seine Vorlage: erst Mockup schreiben, dann die Vorlage - das Mockup ist veraltet.
    const frueher = new Date(Date.now() - 60000);
    await fsp.writeFile(pathm.join(tmp, 'mockups', 'stil_abi_standard_hoodie-szene.jpg'), 'x');
    await fsp.utimes(pathm.join(tmp, 'mockups', 'stil_abi_standard_hoodie-szene.jpg'), frueher, frueher);
    await fsp.writeFile(pathm.join(tmp, 'templates', 'hoodie-szene_black.png'), 'x');
    await fsp.writeFile(pathm.join(tmp, 'templates', 'zip_white.png'), 'x');
    await fsp.utimes(pathm.join(tmp, 'templates', 'zip_white.png'), frueher, frueher);
    const alt = await veralteteMockupsRaeumen(tmp);
    pruefe('Mockup aelter als seine Vorlage wird geraeumt, juengeres bleibt', alt.geloescht.length === 1 && alt.geloescht[0] === 'stil_abi_standard_hoodie-szene.jpg' && (await fsp.readdir(pathm.join(tmp, 'mockups'))).includes('firma_v3_x_zip_white_brust.jpg'), alt.geloescht.join(','));
    await fsp.rm(tmp, { recursive: true, force: true });
  }

  // 5) Zuschnitt auf 1024x1024: die Flaeche wandert mit dem Bild, nicht daneben
  const c = boxNachCover({ x: 300, y: 400, w: 400, h: 500 }, 1024, 1280);
  pruefe('Flaeche folgt dem mittigen Zuschnitt eines Hochformats', c.x === 300 && c.y === 272 && c.w === 400 && c.h === 500, JSON.stringify(c));
  let abgelehnt = false;
  try { boxNachCover({ x: 300, y: 0, w: 400, h: 300 }, 1024, 1280); } catch (e) { abgelehnt = true; }
  pruefe('Platzhalter im Beschnitt wird abgelehnt statt still falsch gespeichert', abgelehnt);
}
