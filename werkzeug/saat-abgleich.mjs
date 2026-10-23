// Saat-Abgleich: traegt in seed.json nach, was ein leeres Volume sonst falsch zurueckbekaeme.
//
// Hintergrund (22. Sept., Markus: "wie schliessen wir die andere Luecke?"): Der Server legt ein
// fehlendes Motto mit {...Saat-Eintrag} an. Steht ein Schalter nicht in der Saat, gilt der
// Standard aus sanitizeMotto. Solange die Saat nur Text und Felder trug, waere "freestyle"
// nach einem leeren Volume kein Freestyle mehr gewesen.
//
//   node werkzeug/saat-abgleich.mjs            traegt die fehlenden Werte nach
//   node werkzeug/saat-abgleich.mjs --pruefen  meldet nur, Rueckgabewert 1 bei Luecken
//
// Nachgetragen wird NUR, was vom Standard abweicht und in der Saat fehlt. Vorhandene Werte
// bleiben unangetastet, und rev wird nicht hochgezaehlt: diese Schluessel wirken allein auf dem
// Weg "Motto fehlt -> neu anlegen", und der liest ohnehin immer den ganzen Eintrag.
import fs from 'node:fs/promises';
import path from 'node:path';
import { saatLuecken } from '../mottos.js';

const wurzel = new URL('..', import.meta.url).pathname;
const nurPruefen = process.argv.includes('--pruefen');

const saatDatei = path.join(wurzel, 'seed.json');
const saat = JSON.parse(await fs.readFile(saatDatei, 'utf8'));
const nachSlug = new Map(saat.map(m => [m.slug, m]));

const ordner = path.join(wurzel, 'storage', 'mottos');
const dateien = (await fs.readdir(ordner)).filter(f => f.endsWith('.json')).sort();

// Was am Motto NICHT in die Saat gehoert: der Stand des Volumes selbst.
const FLUECHTIG = ['updated', 'seedRev', 'userEdited'];

let luecken = 0, ergaenzt = 0, angelegt = 0, ohneEintrag = [];
for (const f of dateien) {
  const motto = JSON.parse(await fs.readFile(path.join(ordner, f), 'utf8'));
  let eintrag = nachSlug.get(motto.slug);
  if (!eintrag) {
    // Gar kein Eintrag: dieses Motto waere nach einem leeren Volume ganz weg.
    ohneEintrag.push(motto.slug);
    if (nurPruefen) continue;
    eintrag = { ...motto, rev: 1 };
    for (const k of FLUECHTIG) delete eintrag[k];
    saat.push(eintrag);
    nachSlug.set(motto.slug, eintrag);
    angelegt++;
    console.log(motto.slug.padEnd(22), 'NEU in die Saat aufgenommen (' + Object.keys(eintrag).length + ' Schluessel)');
    continue;
  }
  const fehlt = saatLuecken(motto, eintrag);
  if (!fehlt.length) continue;
  luecken++;
  console.log(motto.slug.padEnd(22), fehlt.map(k => `${k}=${JSON.stringify(motto[k])}`).join(', '));
  if (nurPruefen) continue;
  for (const k of fehlt) eintrag[k] = motto[k];
  ergaenzt++;
}

if (nurPruefen) {
  if (ohneEintrag.length) console.log('\nohne Saat-Eintrag (waeren nach einem leeren Volume ganz weg):', ohneEintrag.join(', '));
  console.log(`\n${luecken} Mottos mit Luecken · ${ohneEintrag.length} ohne Eintrag`);
  process.exit(luecken || ohneEintrag.length ? 1 : 0);
}
if (ergaenzt || angelegt) {
  saat.sort((a, b) => (+a.order || 100) - (+b.order || 100) || String(a.slug).localeCompare(String(b.slug)));
  await fs.writeFile(saatDatei, JSON.stringify(saat, null, 2) + '\n');
  console.log(`\n${angelegt} Mottos neu aufgenommen, ${ergaenzt} Eintraege ergaenzt - seed.json geschrieben (${saat.length} Mottos).`);
} else {
  console.log('\nnichts nachzutragen - die Saat stellt jedes Motto vollstaendig wieder her.');
}
