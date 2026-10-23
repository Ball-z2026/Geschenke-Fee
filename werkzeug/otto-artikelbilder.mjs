// Die Artikel-Kacheln des Otto-Wegs (/otto): je Artikel das echte Produktfoto mit einem
// unserer Vorzeige-Designs darauf - nie ein Emoji (Markus, 8. Okt., Bild der Artikelwahl mit
// Trenchcoat fuer Hoodie und Tuer fuer Fussmatte: "Was soll das jetzt?").
// Aufruf: node werkzeug/otto-artikelbilder.mjs <ordner mit <artikel>-<motto>.png>
// Die Textil-Designs kommen aus startseite/schaufenster (Repo), die uebrigen aus den
// Vorzeige-Designs je Artikel (vorzeige-designs.json, mottos.<motto>.artikel.<artikel>.url).
// NIE "Anna" (CLAUDE.md): die Hochzeits-Vorzeige-Designs tragen "Anna & Ben" und sind hier nicht dabei.
// Ergebnis: startseite/artikel/<artikel>.webp, 640 x 480.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ensureTemplates, makeMockup, GARMENTS } from '../mockups.js';

const quelle = process.argv[2];
const WAHL = {
  tshirt: { garment: 'tee', datei: 'startseite/schaufenster/abi.webp' },
  hoodie: { garment: 'hoodie', datei: 'startseite/schaufenster/handwerker-shirt.webp' },
  shopper: { garment: 'beutel', datei: 'startseite/schaufenster/angler-shirt.webp' },
  acrylbild: { quelle: 'brett-familie' },
  fussmatte: { motto: 'familie' },
  kissen: { motto: 'geburt-baby' },
  poster: { motto: 'geburt-baby' },
  tuerschild: { motto: 'familie' },
  mousepad: { motto: 'sprueche-shirt' },
  hundedecke: { motto: 'tier-shirt' },
  napfunterlage: { motto: 'tier-shirt' },
  handtuch: { motto: 'malle-fahrt' },
  strandtuch: { motto: 'junggesellenabschied' },
  gepaeckanhaenger: { quelle: 'gepaeckanhaenger-reise' },   // 8. Okt.: eigenes Reise-Design 7 x 10 (Familie Mueller, Ab ans Meer!)
  sticker: { motto: 'kinder-tiershirt' },
  brotdose: { motto: 'kinder-tiershirt' },
  grillschuerze: { garment: 'grillschuerze', quelle: 'grill', farbe: 'black' }   // 8. Okt.: neuer Artikel, Grillmeister auf schwarzer Schuerze
};

await ensureTemplates('./storage');
await fs.mkdir('startseite/artikel', { recursive: true });
for (const [id, w] of Object.entries(WAHL)) {
  const garment = w.garment || id;
  const datei = w.datei || path.join(quelle, (w.quelle || `${id}-${w.motto}`) + '.png');
  const farbe = w.farbe || 'white';
  let master = await sharp(await fs.readFile(datei)).png().toBuffer();
  // Flachware: das Design genau im Format des Artikels (flaecheCm), sonst fuellt die Ansicht
  // die Seiten mit Randstreifen auf. Die Vorzeige-Designs sind fuer den Artikel gebaut, der
  // Zuschnitt nimmt nur wenige Prozent.
  const cm = !w.garment && GARMENTS[garment] && GARMENTS[garment].flaecheCm;
  const m0 = cm ? await sharp(master).metadata() : null;
  // Nur kleine Abweichungen zuschneiden; ein Querformat auf hochkantem Artikel waehlt die Ansicht selbst (Quer-Vorlage)
  if (cm && Math.abs((m0.width / m0.height) / (cm[0] / cm[1]) - 1) <= 0.1) {
    const m = m0;
    const breit = Math.min(m.width, Math.round(m.height * cm[0] / cm[1]));
    const hoch = Math.round(breit * cm[1] / cm[0]);
    master = await sharp(master).resize(breit, hoch, { fit: 'cover', position: 'centre' }).withMetadata({ density: Math.round(breit / (cm[0] / 2.54)) }).png().toBuffer();
    console.log(id, 'Zuschnitt', m.width + 'x' + m.height, '->', breit + 'x' + hoch, 'Flaeche', cm.join(' x '), 'cm');
  }
  // Flachware: das Design IST fuer dieses Teil gebaut - randlos von Kante zu Kante (makeMockup: eigen + vollflaechig)
  const bild = await makeMockup(master, garment, farbe, false, { place: 'front', artikel: cm ? { ansicht: garment, motivart: 'vollflaechig' } : undefined });
  const ziel = path.join('startseite', 'artikel', id + '.webp');
  // Ganz zeigen, nie beschneiden: der Rest der 4:3-Kachel bekommt den Grund des Fotos (Ecke oben links)
  const { data } = await sharp(bild).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const grund = { r: data[0], g: data[1], b: data[2] };
  await sharp(bild).resize(640, 480, { fit: 'contain', background: grund }).flatten({ background: grund }).webp({ quality: 82 }).toFile(ziel);
  console.log(id, garment, '->', ziel);
}
