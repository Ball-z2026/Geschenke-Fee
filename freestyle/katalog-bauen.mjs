// Erzeugt freestyle/artikel-katalog.json aus freestyle/artikelliste-markus.csv.
// Aufruf aus dem Projektwurzelverzeichnis:  node freestyle/katalog-bauen.mjs
//
// Danach EINMAL von Hand nachziehen, so wie es im Katalog vom 13. Sept. steht:
//   - acrylbild bekommt zusaetzlich a4 (21 x 29,7) und a3 (29,7 x 42), druckflaecheOffen false
//   - tshirt bekommt garment:'shirt', hoodie bekommt garment:'hoodie', beide
//     druckflaecheOffen false und hinweis 'Druckflaechen kommen aus GARMENTS in mottos.js'
// Diese vier Werte sind Normmasse bzw. Verweise, keine Schaetzungen.
//   - postkarte (Nr. 31, A6 quer / A6 hoch / Panorama) steht NUR im JSON, nicht in der CSV.
// 22. Sept.: NICHT blind laufen lassen - der Lauf wirft alles Nachgezogene weg (85 Zeilen).
// Eine einzelne Aenderung (z. B. Fussmatte quer, 60x40) kommt in CSV UND JSON von Hand.

import fs from 'fs';
const roh = fs.readFileSync('./freestyle/artikelliste-markus.csv','utf8').trim().split('\n');
const kopf = roh.shift();

const ID = { 'T-Shirt':'tshirt','Tasse':'tasse','Hoodie':'hoodie','Thermobecher / Tumbler':'thermobecher',
 'Trinkflasche':'trinkflasche','Kissen':'kissen','Schlüsselanhänger':'schluesselanhaenger','Handyhülle':'handyhuelle',
 'Socken':'socken','Cap':'cap','Shopper':'shopper','XXL-Mousepad':'mousepad','Hundedecke':'hundedecke',
 'Acrylbild':'acrylbild','Türschild':'tuerschild','Schürze':'schuerze','Handtuch':'handtuch','Strandtuch':'strandtuch',
 'Fußmatte':'fussmatte','Schneide- / Servierbrett':'brett','Hundemarke':'hundemarke','Futternapf':'futternapf',
 'Napfunterlage':'napfunterlage','Puzzle':'puzzle','Untersetzer-Set':'untersetzer','Acryl-Magnet':'magnet',
 'Gepäckanhänger':'gepaeckanhaenger','Weihnachtsanhänger':'weihnachtsanhaenger','Hundebandana':'bandana',
 'Acryl- / Holz-Geschenkschild':'geschenkschild' };

const GRUPPE = { tshirt:'Textil',hoodie:'Textil',cap:'Textil',shopper:'Textil',schuerze:'Textil',socken:'Textil',
 bandana:'Haustier',hundedecke:'Haustier',hundemarke:'Haustier',futternapf:'Haustier',napfunterlage:'Haustier',
 tasse:'Kueche',thermobecher:'Kueche',trinkflasche:'Kueche',brett:'Kueche',untersetzer:'Kueche',
 kissen:'Wohnen',fussmatte:'Wohnen',tuerschild:'Wohnen',acrylbild:'Wohnen',magnet:'Wohnen',
 handtuch:'Bad und Strand',strandtuch:'Bad und Strand',
 mousepad:'Buero und Gaming',handyhuelle:'Buero und Gaming',
 puzzle:'Geschenk',schluesselanhaenger:'Geschenk',gepaeckanhaenger:'Geschenk',weihnachtsanhaenger:'Geschenk',geschenkschild:'Geschenk' };

// Bei diesen Artikeln IST das Produktmass die Druckflaeche - Motiv laeuft randlos ueber alles.
const VOLLFLAECHIG = new Set(['kissen','mousepad','hundedecke','handtuch','strandtuch','fussmatte','napfunterlage',
 'puzzle','acrylbild','tuerschild','brett','magnet','gepaeckanhaenger','geschenkschild','weihnachtsanhaenger',
 'schluesselanhaenger','hundemarke','untersetzer','handyhuelle','socken','bandana']);

const verfahrenLesen = (s) => {
  const t = s.toLowerCase();
  const gefunden = [];
  if (t.includes('dtf')) gefunden.push('dtf');
  if (t.includes('sublimation')) gefunden.push('sublimation');
  if (t.includes('uv')) gefunden.push('uv');
  // Reihenfolge im Original entscheidet, was primaer ist
  gefunden.sort((a,b)=> t.indexOf(a==='dtf'?'dtf':a) - t.indexOf(b==='dtf'?'dtf':b));
  return gefunden;
};

const massLesen = (s) => {
  const treffer = [...s.matchAll(/(\d{1,3})\s*[x×]\s*(\d{1,3})/g)].map(m => [ +m[1], +m[2] ]);
  return treffer;
};

const artikel = {};
const offen = [];
for (const zeile of roh) {
  const [nr, name, beschreibung, material, groesse, personalisierung, druck, ziel] = zeile.split(';');
  const id = ID[name];
  if (!id) { console.warn('KEINE ID FUER', name); continue; }
  const verfahren = verfahrenLesen(druck);
  const masse = massLesen(groesse);
  const vollflaechig = VOLLFLAECHIG.has(id);

  const flaechen = {};
  if (masse.length) {
    for (const [b,h] of masse) flaechen[`${b}x${h}`] = { label: `${b} x ${h} cm`, cm: [b,h] };
  }
  if (!Object.keys(flaechen).length) {
    offen.push({ id, name, grund: 'keine Druckflaeche in cm ableitbar', angabe: groesse });
  }

  artikel[id] = {
    nr: +nr, name, beschreibung, material,
    gruppe: GRUPPE[id] || 'Sonstiges',
    varianten: groesse,
    verfahren: verfahren[0] || null,
    verfahrenAlternativ: verfahren.slice(1),
    verfahrenRoh: druck,
    motivart: vollflaechig ? 'vollflaechig' : 'freistehend',
    personalisierung: personalisierung.split(' ').filter(Boolean),
    zielgruppe: ziel.split(' ').filter(Boolean),
    flaechen,
    druckflaecheOffen: !Object.keys(flaechen).length,
    produzent: null,
    mindestmenge: null,
    hinweis: ''
  };
}

fs.writeFileSync('./freestyle/artikel-katalog.json', JSON.stringify(artikel, null, 2));
console.log('Artikel:', Object.keys(artikel).length);
console.log('Mit Druckflaeche:', Object.values(artikel).filter(a=>!a.druckflaecheOffen).length);
console.log('\nOHNE Druckflaeche (', offen.length, '):');
for (const o of offen) console.log('  -', o.name.padEnd(30), '|', o.angabe);
const proVerfahren = {};
for (const a of Object.values(artikel)) proVerfahren[a.verfahren] = (proVerfahren[a.verfahren]||0)+1;
console.log('\nPrimaeres Verfahren:', proVerfahren);
