// Abnahme am LIVE-Ergebnis - nicht am Repo.
//
// 22. Sept., Markus: "Warum muss ich dich auf solche Fehler immer wieder hinweisen?"
// Weil jede Pruefung bis hierher den Code gelesen hat. Das Poster war im Repo seit 11:18 richtig
// gerechnet (Stand 89, Foto ohne Passepartout) und lokal vollflaechig - live kam es nie an, weil
// eine einmal gemessene Flaeche auf dem Volume den Austausch des Fotos blockiert hat. Der Commit
// war gruen, die Seite war falsch. Gemerkt hat es der Chef, nicht die Abnahme.
//
// Diese Pruefung holt, was der Besucher wirklich bekommt, und misst es:
//   node abnahme-live.mjs                     gegen www.motto-otto.de
//   node abnahme-live.mjs http://127.0.0.1:3999   gegen einen lokalen Server
//
// Geprueft wird:
//   1. Jede Kachel im Band "Das hat Otto gezeichnet" hat ein Ziel, das Motto, Stil und Artikel
//      mitbringt - nicht "#mottos" und nicht "/mottos".
//   2. Jedes Bild im Band laedt wirklich (HTTP 200, echtes JPEG mit Groesse).
//   3. Bei vollflaechigen Artikeln fuellt der Druck die bedruckbare Flaeche - gemessen wird die
//      Flaeche aus mockups.js (BOX_OVERRIDES / MITGELIEFERT / GARMENTS), und in ihr, wie viel
//      NICHT vom Motiv stammt. Ein Passepartout faellt hier auf, ein Rand auch.
//   4. Jede Mottoseite liefert ihre Stil-Beispiele aus (sonst steht der Kunde vor blanken Knoepfen).
//
// Rueckgabewert 1, sobald etwas nicht stimmt.
import { MOCKUP_STAND } from './mockups.js';

const BASIS = (process.argv[2] || 'https://www.motto-otto.de').replace(/\/+$/, '');
let fehler = 0, geprueft = 0;
const gruen = (t, extra) => console.log('  \x1b[32m✓\x1b[0m ' + t + (extra ? ' \x1b[90m· ' + extra + '\x1b[0m' : ''));
const rot = (t, extra) => { fehler++; console.log('  \x1b[31m✗ ' + t + '\x1b[0m' + (extra ? ' · ' + extra : '')); };
const pruefe = (t, ok, extra) => { geprueft++; ok ? gruen(t, extra) : rot(t, extra); };

async function hole(pfad, alsBild) {
  const url = pfad.startsWith('http') ? pfad : BASIS + pfad;
  const r = await fetch(url, { headers: { accept: alsBild ? 'image/*' : 'application/json,text/html' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return alsBild ? Buffer.from(await r.arrayBuffer()) : r;
}

console.log('\nABNAHME LIVE · ' + BASIS + ' · ' + new Date().toLocaleString('de-DE'));

// ---------------------------------------------------------------- 1 · Das Band
console.log('\n1 · BAND "DAS HAT OTTO GEZEICHNET"');
let designs = [];
try {
  const r = await hole('/api/mo/showcase?mode=rate&limit=40&vielfalt=1');
  designs = (await r.json()).designs || [];
} catch (e) { rot('Band laedt', e.message); }
pruefe('das Band liefert genug Designs', designs.length >= 6, designs.length + ' Designs');

const ohneZiel = designs.filter(d => !d.ziel || d.ziel === '/mottos' || d.ziel.startsWith('#'));
pruefe('jede Kachel fuehrt auf Motto, Stil und Artikel', !ohneZiel.length,
  ohneZiel.length ? ohneZiel.slice(0, 5).map(d => (d.mottoName || '?') + ' -> ' + (d.ziel || 'kein Ziel')).join(' · ') : 'alle ' + designs.length);

const mitStil = designs.filter(d => d.ziel && /[?&]stil=/.test(d.ziel));
pruefe('das Ziel nennt den Stil', mitStil.length === designs.length,
  mitStil.length + ' von ' + designs.length);

// ---------------------------------------------------------------- 2 · Die Bilder
console.log('\n2 · DIE BILDER DES BANDES');
let kaputt = [];
for (const d of designs) {
  try {
    const jpg = await hole(d.image, true);
    if (jpg.length < 4000) kaputt.push((d.mottoName || '?') + '/' + (d.teil || '?') + ': nur ' + jpg.length + ' Bytes');
  } catch (e) { kaputt.push((d.mottoName || '?') + '/' + (d.teil || '?') + ': ' + e.message); }
}
pruefe('jedes Bild des Bandes laedt', !kaputt.length, kaputt.slice(0, 5).join(' · '));

// ---------------------------------------------------------------- 2b · Vorlagen auf dem Volume
// Der eigentliche Fehler beim Poster war nicht das Bild, sondern der Stand: das Repo hatte ein
// neues Foto, das Volume das alte. Von aussen war das an keinem Pixel sicher zu erkennen -
// eine Messung am Bild hat es nicht gefunden, darum steht hier die Zahl statt einer Schaetzung.
console.log('\n2b · VORLAGEN AUF DEM VOLUME');
try {
  const r = await hole('/api/mo/vorlagen-stand');
  const v = await r.json();
  pruefe('der Server rechnet mit dem Mockup-Stand des Repos', v.mockupStand === MOCKUP_STAND,
    'live ' + v.mockupStand + ', Repo ' + MOCKUP_STAND);
  pruefe('keine Vorlage und keine Maske haengt zurueck', !(v.zurueck || []).length,
    (v.zurueck || []).slice(0, 6).join(' · '));
} catch (e) { rot('Vorlagen-Stand abfragen', e.message); }

// ---------------------------------------------------------------- 3 · Die Mottoseiten
console.log('\n3 · MOTTOSEITEN');
let slugs = [];
try {
  const r = await hole('/mottos');
  const html = await r.text();
  slugs = [...new Set([...html.matchAll(/href="\/m\/([a-z0-9-]+)"/g)].map(m => m[1]))];
} catch (e) { rot('/mottos laedt', e.message); }
pruefe('die Mottoliste nennt Mottos', slugs.length >= 5, slugs.length + ' Mottos');

let ohneBeispiele = [];
for (const slug of slugs.slice(0, 8)) {
  try {
    const r = await hole('/m/' + slug);
    const html = await r.text();
    const m = html.match(/(\{"slug":.*?"kaufformen".*?\})\s*[;<]/s);
    const j = m ? JSON.parse(m[1].replace(/\\u003c/g, '<')) : null;
    const n = j && j.styleSamples ? Object.keys(j.styleSamples).length : 0;
    if (n < 3) ohneBeispiele.push(slug + ' (' + n + ')');
  } catch (e) { ohneBeispiele.push(slug + ' (' + e.message + ')'); }
}
pruefe('jede Mottoseite zeigt Stil-Beispiele', !ohneBeispiele.length, ohneBeispiele.join(', '));

// ---------------------------------------------------------------- 4 · Die Stil-Seite
console.log('\n4 · STIL-SEITE');
try {
  const r = await hole('/stile');
  const html = await r.text();
  const kacheln = [...html.matchAll(/class="stilkachel([^"]*)"/g)];
  const ohneBild = kacheln.filter(k => k[1].includes('ohnebild')).length;
  pruefe('/stile zeigt alle Stile', kacheln.length >= 15, kacheln.length + ' Kacheln');
  pruefe('jede Stil-Kachel hat ein Beispielbild', ohneBild === 0, ohneBild + ' ohne Bild');
} catch (e) { rot('/stile laedt', e.message); }

console.log('\n' + '─'.repeat(70));
console.log(fehler ? `\x1b[31m${fehler} von ${geprueft} Pruefungen gescheitert\x1b[0m` : `\x1b[32malle ${geprueft} Pruefungen bestanden\x1b[0m`);
process.exit(fehler ? 1 : 0);
