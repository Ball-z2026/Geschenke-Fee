// textil-neu.mjs - die Bilder auflisten und neu beauftragen, die gegen das falsche Textil
// gezeichnet wurden.
//
// 23. Sept., Markus: "Wenn du doch ein Design selber erstellst, musst du auch wissen, ob du es
// fuer hell oder dunkel gemacht hast." Seit STIL_TEXTIL (mottos.js) steht das je Stil fest.
// Die BILDER im Manifest sind aber gegen den alten Standardwert "dunkel" gezeichnet - Vintage,
// Tattoo, Comic, Japan, Pop-Art und Meisterwerk auf Schwarz, obwohl ihre Paletten helles Textil
// verlangen. Umschalten hilft da nicht: die Palette selbst ist eine andere, das Bild muss neu.
//
// Dieses Werkzeug ZEICHNET NICHTS. Es sagt nur, was dran ist, und baut den Prompt - denselben,
// den vorzeigeBildZeichnen() in server.js baut, damit hier nichts anderes entsteht als dort.
//
//   node werkzeug/textil-neu.mjs                 Liste: was ist betroffen, je Motto
//   node werkzeug/textil-neu.mjs <slug>          Liste nur fuer ein Motto
//   node werkzeug/textil-neu.mjs <slug> <stil>   der fertige Prompt fuer genau ein Bild
//
// Der Weg danach: Bild erzeugen, die neue Bild-Adresse in vorzeige-designs.json eintragen
// (styles.<stil>), styleTextile fuer den Stil setzen. Der Deploy spielt das Manifest ein.

import fs from 'node:fs/promises';
import { buildPrompt, pickVariation, STYLES, textilFuerStil } from '../mottos.js';

const MANIFEST = new URL('../vorzeige-designs.json', import.meta.url);
const MOTTO_DIR = new URL('../storage/mottos/', import.meta.url);

/** Dieselbe Rechnung wie grosseLeinwand() in server.js - ohne die Druckleinwand-Umrechnung,
 *  die nur auf dem Server liegt. Fuer die Vorzeige-Bilder ist das Mass im Manifest massgeblich. */
function leinwand(manifest, motto) {
  return String(motto.size || manifest.size || '1024x1536');
}

async function mottoLesen(slug) {
  return JSON.parse(await fs.readFile(new URL(slug + '.json', MOTTO_DIR), 'utf8'));
}

/** Alle Bilder, die gegen ein anderes Textil gezeichnet wurden, als heute gilt. */
export async function betroffen() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  const raus = [];
  for (const [slug, m] of Object.entries(manifest.mottos || {})) {
    for (const [style, id] of Object.entries(m.styles || {})) {
      const gezeichnetAuf = (m.styleTextile && m.styleTextile[style]) || m.textile || 'dunkel';
      const gehoertAuf = textilFuerStil(style, (m.styleTextile && m.styleTextile[style]) || m.textile);
      if (gezeichnetAuf !== gehoertAuf) raus.push({ slug, style, id, gezeichnetAuf, gehoertAuf });
    }
  }
  return { manifest, liste: raus };
}

/** Der Prompt fuer ein Bild - Zeichen fuer Zeichen der Weg aus vorzeigeBildZeichnen(). */
export async function promptFuer(slug, style) {
  const { manifest } = await betroffen();
  const eintrag = (manifest.mottos || {})[slug];
  if (!eintrag) throw new Error('kein Manifest-Eintrag fuer ' + slug);
  if (!STYLES[style]) throw new Error('unbekannter Stil ' + style);
  const motto = await mottoLesen(slug);
  const werte = { ...(eintrag.values || {}) };
  const textile = textilFuerStil(style, (eintrag.styleTextile && eintrag.styleTextile[style]) || eintrag.textile);
  const variation = pickVariation(motto, { styled: !!(style && style !== 'standard') });
  const prompt = buildPrompt(motto, werte, { style, colors: '', variation, textile, nameZone: '' });
  return { prompt, textile, size: leinwand(manifest, motto), values: werte, variation };
}

const [slug, style] = process.argv.slice(2);

if (slug && style) {
  const p = await promptFuer(slug, style);
  console.log('# ' + slug + ' / ' + style + ' (' + STYLES[style].label + ') auf ' + p.textile.toUpperCase() +
    'EM TEXTIL · ' + p.size);
  console.log(p.prompt);
} else {
  const { liste } = await betroffen();
  const nurSlug = slug ? liste.filter(x => x.slug === slug) : liste;
  const proMotto = {};
  for (const x of nurSlug) (proMotto[x.slug] = proMotto[x.slug] || []).push(x);
  console.log(nurSlug.length + ' Bilder wurden gegen das falsche Textil gezeichnet\n');
  for (const [s, xs] of Object.entries(proMotto)) {
    console.log(s + '  (' + xs.length + ')');
    for (const x of xs) console.log('   ' + x.style.padEnd(14) + x.gezeichnetAuf + ' -> ' + x.gehoertAuf);
  }
}
