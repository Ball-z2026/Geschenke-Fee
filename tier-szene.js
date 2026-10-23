// Haustier-Szene mit genau dem Tier vom Shirt (4. Okt.).
//
// Markus, mit Bild aus dem Band (Berner "Nelli" auf dem Shirt, daneben ein Golden Retriever): "Wenn du
// schon was mit meinem Haustier machst und da ist dein Hund auf dem T-Shirt, sollte der Hund daneben
// wenigstens der gleiche Hund sein." Auf die Frage, wie: "Gleiches Tier je Design".
//
// So: die Szene des Mottos (tee-szene-thema-tier-shirt) bekommt dort, wo der Hund sitzt, ein Loch
// (TIER_LOCH). Der Bilddienst malt ins Loch das Tier von der Druckdatei - als echtes Foto, gleiche Art,
// gleiche Farben und Zeichnung. Zurueck kommt NUR das Loch (flaecheUebernehmen aus dem Falten-Werkzeug),
// Frau, Shirt und Druckflaeche bleiben pixelgleich - die Vermessung der Szene gilt weiter.
// Einmal je Design und Shirtfarbe, abgelegt in storage/szenen-tier/<design>_<farbe>.png. Bis es fertig
// ist, zeigt die Szene die Frau ohne Tier (vorlagen-original/tee-szene-thema-tier-shirt-leer_<farbe>.jpg,
// am 4. Okt. mit demselben Loch gebaut) - nie einen fremden Hund.
// GEMESSEN am 4. Okt. am Bilddienst (Nelli MO-TIERSHIR-20260906-7VTY, weisses Shirt): dreifarbiger Hund mit
// blauem Auge wie auf dem Shirt, sitzend, Leine am Halsband, Licht und Schaerfe wie im Foto.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { flaecheUebernehmen } from './werkzeug/falten-einsetzen.mjs';

export const TIER_MOTTO = 'tier-shirt';
// In der 1024er Szene: rechts unten neben der Frau, wo der Hund sitzt (Hand und Leine bleiben links davon).
export const TIER_LOCH = { x: 640, y: 610, w: 384, h: 414 };

export const TIER_AUFTRAG = 'Photo edit. Image 1 is a real photograph of a woman in a sunny park; its transparent area (bottom right, beside her legs) is the ONLY place you paint. '
  + 'Fill it with the pet that is drawn on image 2 - the SAME animal: same species, same breed, same coat colours and markings, same ear shape - but as a REAL, photographed animal '
  + '(not a drawing, no costume, no furniture, no crown, no text, nothing else from image 2). If it is a dog, it sits calmly on the grass beside her, facing the camera, the end of her black leash attached to its collar; '
  + 'any other pet sits or stands naturally on the grass beside her at its real size (a big animal may show only its head and shoulders entering the picture). '
  + 'If image 2 shows no animal at all, paint only the empty sunlit lawn there and let the leash end lie on the grass. '
  + 'Match the photo exactly: the same sunlight from the left, soft shadow on the grass, same depth of field, same colour grading. '
  + 'Everything outside the transparent area stays exactly as it is - the woman, her hand, the leash, the T-shirt, the park.';

export function tierDatei(store, designId, color) {
  return path.join(store, 'szenen-tier', `${String(designId).replace(/[^A-Za-z0-9_-]/g, '')}_${color === 'white' ? 'white' : 'black'}.png`);
}
export function leerDatei(color) {
  return path.resolve('vorlagen-original', `tee-szene-thema-tier-shirt-leer_${color === 'white' ? 'white' : 'black'}.jpg`);
}

// Szene mit durchsichtigem Loch - das Loch ist fuer den Bilddienst die Maske.
export async function tierLoch(szene) {
  const { data, info } = await sharp(szene).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, f = W / 1024;
  const b = { x: Math.round(TIER_LOCH.x * f), y: Math.round(TIER_LOCH.y * f), w: Math.round(TIER_LOCH.w * f), h: Math.round(TIER_LOCH.h * f) };
  for (let y = b.y; y < Math.min(H, b.y + b.h); y++) for (let x = b.x; x < Math.min(W, b.x + b.w); x++) data[(y * W + x) * 4 + 3] = 0;
  return { png: await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), box: b, W, H };
}

// edit({ prompt, imageBase64, referenceImagesBase64 }) -> { png } (der Bildaufruf des Servers)
export async function tierSzeneBauen({ szene, master, edit }) {
  const loch = await tierLoch(szene);
  // Die Druckdatei als Vorlage: klein, flach auf Weiss (Paletten-PNGs und riesige Dateien mag der Bilddienst nicht).
  const vorlage = await sharp(master).resize(1024, 1024, { fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
  const g = await edit({ prompt: TIER_AUFTRAG, imageBase64: loch.png.toString('base64'), referenceImagesBase64: [vorlage.toString('base64')] });
  if (!g || !g.png || !g.png.length) throw new Error('Bilddienst lieferte kein Bild');
  const ki = await sharp(g.png).resize(loch.W, loch.H, { fit: 'fill' }).png().toBuffer();
  return (await flaecheUebernehmen(szene, ki, loch.box)).png().toBuffer();
}
