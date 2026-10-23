// Produktfotos der Textil-Linie holen und ablegen.
//
// WARUM ES DIESE DATEI GIBT
// Das Paket vom 18.09. nennt je Artikel eine URL. Die sieht aus wie eine Bildadresse, ist aber
// die offizielle PRODUKTSEITE - das Paket schreibt es selbst dazu: "direct binary not embedded
// in this package", "MANUAL/WEB DOWNLOAD REQUIRED". Eine Produktseite in ein <img src> zu
// schreiben ergibt kein Foto, sondern ein kaputtes Bild. Das Herunterladen ist ein eigener
// Schritt - und genau der steht hier.
//
// WAS DER WEG IST
//   1. Produktseite oeffnen (der Link steht im Backend neben dem Artikel).
//   2. Das Packshot-Bild dort kopieren - die Bildadresse, nicht die Seitenadresse.
//   3. Im Backend einfuegen. Der Server laedt die Datei, prueft, dass es wirklich ein Bild ist,
//      und legt sie auf dem Volume ab.
// Damit bleibt die Entscheidung, WELCHES Bild das richtige ist, bei einem Menschen. Genau das
// verlangen die Bildregeln: bei Stanley/Stella nur Packshots ohne Modellkopf, bei B&C nur
// Packshots und Studiobilder, bei Roly das Bild unveraendert.
//
// WAS HIER NICHT PASSIERT
// Kein Umfaerben, kein Zuschneiden, kein Nachzeichnen. Die Datei wird abgelegt, wie sie kommt.
// Und niemals tritt ein KI-Bild an die Stelle eines Herstellerfotos - "Do not replace with
// AI-generated product image" steht bei jedem einzelnen Artikel im Manifest.
//
// SICHERHEIT
// Die Adresse kommt aus dem Backend, wird aber NICHT blind geholt. Nur die Hersteller und ihre
// bekannten Bildspeicher sind zugelassen (ERLAUBTE_HOSTS). Ohne diese Liste waere die Route
// ein offener Abruf-Dienst: wer das Backend erreicht, koennte den Server jede beliebige Adresse
// abrufen lassen - auch Adressen im internen Netz von Railway.
import fs from 'node:fs/promises';
import path from 'node:path';
import { LINIE, MARKEN } from './textilien.js';
import { createRequire } from 'node:module';
// Die Stufenpreise liegen seit Langem in preise.cjs - Starter, Liebling, Deluxe je Schnitt.
// Markus: "Wir hatten da sowieso ein allgemeines Schema gemacht fuer Einsteiger, Mittel und
// Hoch - die kannst du auf die Marken einfach uebernehmen. Die Zahlen hast du!!!"
// Er hatte recht: ich habe ein zweites Preisfeld gebaut, statt das vorhandene anzuschlieszen.
const preise = createRequire(import.meta.url)('./preise.cjs');

// Je Marke: die Hersteller-Domain und die Speicher, auf denen ihre Bilder wirklich liegen.
// Die Cloudinary-Adresse ist belegt - der Bomber 2.0 aus dem Bildmanifest liegt dort.
const ERLAUBTE_HOSTS = {
  stanleystella: ['stanleystella.com', 'res.cloudinary.com'],
  bc: ['bc-collection.eu', 'assets.bc-collection.eu', 'cdn.bc-collection.eu'],
  roly: ['roly.eu', 'static.roly.eu', 'cdn.roly.eu', 'static.gorfactory.es']   // gorfactory: der Bildspeicher hinter roly.eu (gemessen 21. Sept.)
};
// 21. Sept.: die Vorderansichten aller 17 Artikel liegen im Repo (textil-bilder/<id>_<white|black>.jpg,
// Quellen in textil-bilder/quellen.json). Sie sind der Rueckfall, wenn im Backend kein Bild geholt wurde.
const REPO_BILDER = path.resolve('textil-bilder');
async function repoBild(id, farbe) {
  for (const f of [farbe, 'white', 'black']) {
    const p = path.join(REPO_BILDER, id + '_' + f + '.jpg');
    try { await fs.access(p); return { pfad: p, farbe: f }; } catch (e) { /* naechste Farbe */ }
  }
  return null;
}
const TYPEN = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };

// Gehoert diese Adresse zu dieser Marke? Endet-auf-Pruefung mit Punkt davor, damit
// "boesestanleystella.com" nicht als "stanleystella.com" durchgeht.
function hostErlaubt(marke, url) {
  let h;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    h = u.hostname.toLowerCase();
  } catch (e) { return false; }
  return (ERLAUBTE_HOSTS[marke] || []).some(d => h === d || h.endsWith('.' + d));
}

export function mountTextilBilder(app, deps) {
  const { STORE, adminGuard } = deps;
  const DIR = path.join(STORE, 'textil');
  const AKTE = path.join(DIR, 'bilder.json');

  async function lesen() { try { return JSON.parse(await fs.readFile(AKTE, 'utf8')); } catch (e) { return {}; } }
  async function schreiben(d) { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(AKTE, JSON.stringify(d, null, 2)); }

  // Preise liegen auf dem VOLUME, nicht im Code. Ein Preis ist eine Geschaeftsentscheidung und
  // aendert sich haeufiger als der Code - er darf keinen Deploy brauchen. Die Linie im Code
  // bleibt die Stammdatei (Farben, Groessen, Rechte), der Preis kommt aus dieser Datei daneben.
  const PREISE = path.join(DIR, 'preise.json');
  async function preiseLesen() { try { return JSON.parse(await fs.readFile(PREISE, 'utf8')); } catch (e) { return {}; } }
  async function preiseSchreiben(d) { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(PREISE, JSON.stringify(d, null, 2)); }

  // Was haben wir, was fehlt - Artikel fuer Artikel, mit dem Link dorthin, wo das Bild liegt.
  // Marke -> Preisstufe. Steht schon in MARKEN als Klartext ("Ottos Starter"); hier nur die
  // Zuordnung auf die Schluessel, mit denen preise.cjs rechnet.
  const STUFE_ZU_MARKE = { roly: 'starter', bc: 'liebling', stanleystella: 'deluxe' };
  // Der Schnitt der Linie auf den Schnitt der Preisliste. Ein Oversize-T-Shirt kostet dort
  // nicht extra - bis eine eigene Zahl da ist, gilt der T-Shirt-Preis. Wo die Preisliste 0
  // sagt (Polo, Sweater), bleibt der Preis offen statt bei null zu stehen.
  const FORM_ZU_PREIS = { tee: 'tee', 'tee-oversize': 'tee', polo: 'polo', sweater: 'sweater', hoodie: 'hoodie', zip: 'zip' };
  function stufenpreisCent(a) {
    const stufe = STUFE_ZU_MARKE[a.marke];
    const form = FORM_ZU_PREIS[a.form];
    if (!stufe || !form) return null;
    try {
      const euro = preise.stueckpreis(form, stufe, 1);
      return euro > 0 ? Math.round(euro * 100) : null;
    } catch (e) { return null; }
  }

  async function stand() {
    const haben = await lesen();
    const preise = await preiseLesen();
    const repoBilder = {};
    for (const a of LINIE) { const w = await repoBild(a.id, 'white'), b = await repoBild(a.id, 'black'); if (w || b) repoBilder[a.id] = { white: !!w, black: !!(b && b.farbe === 'black') }; }
    return LINIE.map(a => ({
      // Reihenfolge: eigener Preis fuer genau diesen Artikel schlaegt die Stufe. Die Stufe ist
      // die Regel, der Einzelpreis die Ausnahme - so muss niemand siebzehn Felder tippen.
      preisCent: preise[a.id] != null ? preise[a.id] : (stufenpreisCent(a) != null ? stufenpreisCent(a) : a.preisCent),
      preisAusStufe: preise[a.id] == null && stufenpreisCent(a) != null,
      stufeKey: STUFE_ZU_MARKE[a.marke] || '',
      id: a.id, marke: MARKEN[a.marke].name, stufe: MARKEN[a.marke].stufe,
      name: a.name, nameHersteller: a.nameHersteller || '', nummer: a.nummer,
      kategorie: a.kategorie || '', gramm: a.gramm || null, passform: a.passform || '',
      farben: (a.farben || []).length,
      // Die volle Groessenliste ("XXS, XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL") hat die Tabelle im
      // Backend so breit gemacht, dass der Knopf rechts herausfiel. Der Bereich sagt dasselbe.
      groessen: a.groessenRoh || (a.groessen || []).join(', '),
      groessenAlle: (a.groessen || []).join(', '),
      beschreibung: a.beschreibung || '',
      quelle: a.bildQuelle || a.seite || '',
      regel: a.bildRegel || '',
      mockupErlaubt: MARKEN[a.marke].mockupErlaubt,
      bild: haben[a.id] || repoBilder[a.id] ? `/api/mo/textil/${a.id}.jpg` : '',
      bildSchwarz: repoBilder[a.id] && repoBilder[a.id].black ? `/api/mo/textil/${a.id}_black.jpg` : '',
      geholt: haben[a.id] ? haben[a.id].geholt : (repoBilder[a.id] ? 'im Repo (21. Sept.)' : ''),
      von: haben[a.id] ? haben[a.id].von : (repoBilder[a.id] ? 'Herstellerfoto aus dem Repo (textil-bilder/quellen.json)' : '')
    }));
  }

  // Preis je Artikel setzen. In Euro, wie man ihn auch ausspricht - gerechnet wird in Cent,
  // damit aus 39,90 nie 39,900000000000006 wird.
  app.post('/api/admin/textil-linie/preis', adminGuard, async (req, res) => {
    const id = String((req.body && req.body.id) || '');
    if (!LINIE.find(x => x.id === id)) return res.status(404).json({ error: 'unbekannter Artikel ' + id });
    const roh = String((req.body && req.body.preis) != null ? req.body.preis : '').trim().replace(',', '.');
    const preise = await preiseLesen();
    if (!roh) { delete preise[id]; await preiseSchreiben(preise); return res.json({ ok: true, entfernt: true }); }
    const euro = Number(roh);
    if (!(euro > 0) || euro > 1000) return res.status(400).json({ error: 'Preis muss zwischen 0 und 1000 € liegen.' });
    preise[id] = Math.round(euro * 100);
    await preiseSchreiben(preise);
    res.json({ ok: true, id, preisCent: preise[id] });
  });

  // ---- oeffentlich: das abgelegte Herstellerfoto ----
  // <id>.jpg = das im Backend geholte Bild, sonst die Vorderansicht aus dem Repo (weiss);
  // <id>_black.jpg = die schwarze Vorderansicht aus dem Repo.
  app.get('/api/mo/textil/:file', async (req, res) => {
    const roh = String(req.params.file).replace(/\.(jpg|png|webp|avif)$/i, '').replace(/[^a-z0-9_-]/g, '');
    const m = /^([a-z0-9-]+?)(?:_(white|black))?$/.exec(roh);
    if (!m) return res.status(404).end();
    const id = m[1], farbe = m[2] || '';
    if (!LINIE.find(x => x.id === id)) return res.status(404).end();
    const haben = await lesen();
    const e = !farbe ? haben[id] : null;
    if (e) {
      try { return res.type(e.typ).set('cache-control', 'public, max-age=86400').send(await fs.readFile(path.join(DIR, e.datei))); }
      catch (err) { /* dann das Repo */ }
    }
    const r = await repoBild(id, farbe || 'white');
    if (!r) return res.status(404).end();
    try { res.type('image/jpeg').set('cache-control', 'public, max-age=86400').send(await fs.readFile(r.pfad)); }
    catch (err) { res.status(404).end(); }
  });

  // ---- Backend ----
  app.get('/api/admin/textil-linie', adminGuard, async (req, res) => {
    res.json({ artikel: await stand() });
  });

  // Ein Produktfoto holen. Die Adresse muss zur Marke DIESES Artikels gehoeren.
  app.post('/api/admin/textil-linie/bild', adminGuard, async (req, res) => {
    const id = String((req.body && req.body.id) || '');
    const url = String((req.body && req.body.url) || '').trim();
    const a = LINIE.find(x => x.id === id);
    if (!a) return res.status(404).json({ error: 'unbekannter Artikel ' + id });
    if (!url) {
      // Leere Adresse = Bild wieder entfernen.
      const haben = await lesen();
      if (haben[id]) { try { await fs.rm(path.join(DIR, haben[id].datei), { force: true }); } catch (e) { /* egal */ } delete haben[id]; await schreiben(haben); }
      return res.json({ ok: true, entfernt: true });
    }
    if (!hostErlaubt(a.marke, url)) {
      return res.status(400).json({
        error: 'Diese Adresse gehört nicht zu ' + MARKEN[a.marke].name + '. Erlaubt sind nur: '
          + (ERLAUBTE_HOSTS[a.marke] || []).join(', ') + ' (und nur über https).'
      });
    }
    let r, buf;
    try {
      r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { accept: 'image/*' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      buf = Buffer.from(await r.arrayBuffer());
    } catch (e) { return res.status(502).json({ error: 'Nicht ladbar: ' + (e && e.message ? e.message : e) }); }
    const typ = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = TYPEN[typ];
    // Eine Fehlerseite ist auch eine Antwort mit 200. Ohne diese Pruefung laege irgendwann
    // eine HTML-Seite als "Produktfoto" auf dem Volume und jedes Mockup waere kaputt.
    if (!ext) return res.status(400).json({ error: 'Das ist kein Bild, sondern ' + (typ || 'ohne Typangabe') + '. Bitte die Adresse des Bildes kopieren, nicht die der Seite.' });
    if (buf.length < 2000) return res.status(400).json({ error: 'Die Datei ist nur ' + buf.length + ' Bytes gross - das ist kein Produktfoto.' });
    const datei = id + ext;
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(path.join(DIR, datei), buf);
    const haben = await lesen();
    // Ein alter Eintrag mit anderer Endung darf nicht als Leiche liegen bleiben.
    if (haben[id] && haben[id].datei !== datei) { try { await fs.rm(path.join(DIR, haben[id].datei), { force: true }); } catch (e) { /* egal */ } }
    haben[id] = { datei, typ, von: url, bytes: buf.length, geholt: new Date().toISOString() };
    await schreiben(haben);
    res.json({ ok: true, id, bytes: buf.length, typ, bild: `/api/mo/textil/${id}.jpg` });
  });

  return { stand, lesen, preiseLesen };
}
