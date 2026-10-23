// Namenslisten-Vorlage als echte Excel-Datei zum Ausfuellen.
//
// Die alte Vorlage bestand aus einer einzigen Kopfzeile - technisch richtig, aber niemand sieht darin
// eine Liste. Diese hier ist ein fertiges Formular: Kopf mit dem Motto, kurze Anleitung, durchnummerierte
// Zeilen, Auswahllisten fuer Groesse, Artikel und Rolle, dazu ein zweites Blatt mit einem Beispiel.
//
// Wichtig fuer den Upload: die Kopfzeile der Tabelle steht NICHT in Zeile 1 (darueber steht der Kopf).
// Der Leser in motto.html sucht die Kopfzeile deshalb in den ersten Zeilen, statt Zeile 1 anzunehmen.
import ExcelJS from 'exceljs';
import { SIZES } from './names.js';

const TINTE = 'FF141414';
const DUNKEL = 'FF1B1B1F';
const GOLD = 'FFD2AA46';
const HELL = 'FFF7F4EC';
const GRAU = 'FF8A8A8A';
const RAHMEN = 'FFD8D2C4';

// Konfektionsgroessen fuer die Auswahlliste: Erwachsene zuerst, danach die Kindergroessen.
const ERW = SIZES.filter(s => !/^\d+$/.test(s));
const KIND = SIZES.filter(s => /^\d+$/.test(s));

const ZEILEN = 50;

// Excel-Auswahllisten muessen als eine Formel uebergeben werden und duerfen dabei nicht zu lang werden.
const liste = (werte) => ['"' + werte.join(',') + '"'];

function rahmen(seiten = ['top', 'left', 'bottom', 'right']) {
  const b = {};
  for (const s of seiten) b[s] = { style: 'thin', color: { argb: RAHMEN } };
  return b;
}

/**
 * Vorlage bauen.
 * @param {object} opts
 * @param {string} opts.mottoName  Anzeigename des Mottos ('' = allgemeine Vorlage)
 * @param {string[]} opts.artikel  Artikel zur Auswahl, z. B. ['T-Shirt','Hoodie']
 * @param {boolean} opts.kontakt   E-Mail/Handy/Rolle anbieten (fuer die Abstimmung)
 * @returns {Promise<Buffer>}
 */
export async function namenslisteVorlage(opts = {}) {
  const mottoName = String(opts.mottoName || '').trim();
  const artikel = (opts.artikel && opts.artikel.length ? opts.artikel : ['T-Shirt', 'Hoodie', 'Zip-Jacke']).slice(0, 12);
  const kontakt = opts.kontakt !== false;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Motto Otto';
  wb.created = new Date();

  const spalten = [
    { key: 'nr', kopf: 'Nr.', breite: 6 },
    { key: 'name', kopf: 'Name', breite: 26 },
    { key: 'size', kopf: 'Größe', breite: 12 },
    { key: 'art', kopf: 'Artikel', breite: 16 }
  ];
  if (kontakt) spalten.push(
    { key: 'mail', kopf: 'E-Mail', breite: 30 },
    { key: 'handy', kopf: 'Handy', breite: 18 },
    { key: 'rolle', kopf: 'Rolle', breite: 14 }
  );
  const N = spalten.length;
  const letzte = String.fromCharCode(64 + N); // A..G
  const KOPFZEILE = 6;              // hier stehen die Spaltenueberschriften
  const ERSTE = KOPFZEILE + 1;      // ab hier wird eingetragen

  // ---------------- Blatt 1: die Liste ----------------
  const ws = wb.addWorksheet('Namensliste', {
    views: [{ state: 'frozen', ySplit: KOPFZEILE }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } }
  });
  ws.columns = spalten.map(s => ({ width: s.breite }));

  const block = (zeile, text, stil) => {
    ws.mergeCells(`A${zeile}:${letzte}${zeile}`);
    const c = ws.getCell(`A${zeile}`);
    c.value = text;
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    Object.assign(c, stil);
    return c;
  };

  block(1, 'MOTTO OTTO  ·  NAMENSLISTE', {
    font: { name: 'Calibri', size: 18, bold: true, color: { argb: HELL } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DUNKEL } }
  });
  ws.getRow(1).height = 34;

  block(2, mottoName ? 'Motto: ' + mottoName : 'Eine Person je Zeile', {
    font: { name: 'Calibri', size: 12, bold: true, color: { argb: GOLD } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DUNKEL } }
  });
  ws.getRow(2).height = 22;

  block(3, 'So geht’s: Ab Zeile ' + ERSTE + ' eintragen – eine Person je Zeile. Pflicht ist nur der Name. '
    + 'Größe und Artikel wählt ihr per Klick aus der Liste. Leere Zeilen einfach stehen lassen.', {
    font: { name: 'Calibri', size: 11, color: { argb: TINTE } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HELL } }
  });
  ws.getRow(3).height = 30;

  block(4, kontakt
    ? 'E-Mail und Handy nur ausfüllen, wenn die Gruppe über die Designs abstimmen soll – sie sind die Einladung dazu. '
      + 'Kontaktdaten kommen nie auf ein Textil und nie in die Druckdaten.'
    : 'Fertig ausgefüllt speichern und auf motto-otto.de wieder hochladen.', {
    font: { name: 'Calibri', size: 11, color: { argb: GRAU } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: HELL } }
  });
  ws.getRow(4).height = 30;
  ws.getRow(5).height = 8;

  // Spaltenueberschriften
  const kopf = ws.getRow(KOPFZEILE);
  spalten.forEach((s, i) => {
    const c = kopf.getCell(i + 1);
    c.value = s.kopf;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: HELL } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DUNKEL } };
    c.alignment = { vertical: 'middle', horizontal: s.key === 'nr' ? 'center' : 'left' };
    c.border = rahmen();
  });
  kopf.height = 24;

  // Leere, durchnummerierte Zeilen - erst dadurch sieht die Datei aus wie eine Liste zum Ausfuellen
  for (let i = 0; i < ZEILEN; i++) {
    const r = ws.getRow(ERSTE + i);
    r.height = 20;
    spalten.forEach((s, j) => {
      const c = r.getCell(j + 1);
      c.border = rahmen();
      c.font = { name: 'Calibri', size: 11, color: { argb: TINTE } };
      if (s.key === 'nr') {
        c.value = i + 1;
        c.font = { name: 'Calibri', size: 11, color: { argb: GRAU } };
        c.alignment = { horizontal: 'center' };
      }
      if (s.key === 'handy') c.numFmt = '@'; // als Text, sonst frisst Excel die fuehrende Null
    });
    if (i % 2 === 1) spalten.forEach((s, j) => {
      r.getCell(j + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBF9F4' } };
    });
  }

  // Auswahllisten (Excel: Datenueberpruefung). Falsche Eingaben werden nur angemerkt, nicht verboten -
  // wer eine Sondergroesse braucht, soll sie trotzdem eintragen koennen.
  const spalte = (key) => String.fromCharCode(65 + spalten.findIndex(s => s.key === key));
  const bereich = (key) => `${spalte(key)}${ERSTE}:${spalte(key)}${ERSTE + ZEILEN - 1}`;
  const pruefung = (key, werte, titel, text) => {
    if (!spalten.some(s => s.key === key)) return;
    ws.dataValidations.add(bereich(key), {
      type: 'list', allowBlank: true, formulae: liste(werte), showErrorMessage: true,
      errorStyle: 'warning', errorTitle: titel, error: text
    });
  };
  pruefung('size', ERW.concat(KIND), 'Größe prüfen',
    'Das ist keine der üblichen Größen. Wenn ihr eine Sondergröße braucht, könnt ihr sie trotzdem eintragen.');
  pruefung('art', artikel, 'Artikel prüfen',
    'Dieses Produkt steht für euer Motto nicht zur Auswahl. Ihr könnt es trotzdem eintragen – wir melden uns dann.');
  pruefung('rolle', ['Teilnehmer', 'Orga'], 'Rolle prüfen',
    'Bitte „Teilnehmer“ oder „Orga“. Leer lassen geht auch – dann zählt die Person als Teilnehmer.');

  ws.autoFilter = { from: { row: KOPFZEILE, column: 1 }, to: { row: KOPFZEILE, column: N } };

  // ---------------- Blatt 2: Beispiel und Hinweise ----------------
  const hb = wb.addWorksheet('Beispiel & Hinweise');
  hb.columns = [{ width: 6 }, { width: 26 }, { width: 12 }, { width: 16 }, { width: 30 }, { width: 18 }, { width: 14 }];

  const zeile = (nr, text, stil) => {
    hb.mergeCells(`A${nr}:G${nr}`);
    const c = hb.getCell(`A${nr}`);
    c.value = text;
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    Object.assign(c, stil);
    return c;
  };
  zeile(1, 'SO SIEHT EINE AUSGEFÜLLTE LISTE AUS', {
    font: { name: 'Calibri', size: 14, bold: true, color: { argb: HELL } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DUNKEL } }
  });
  hb.getRow(1).height = 28;
  hb.getRow(2).height = 8;

  const bKopf = ['Nr.', 'Name', 'Größe', 'Artikel', 'E-Mail', 'Handy', 'Rolle'];
  const bZeilen = [
    [1, 'Lena Brandt', 'M', artikel[0] || 'T-Shirt', 'lena@example.de', '0170 1234567', 'Orga'],
    [2, 'Jonas Peters', 'L', artikel[0] || 'T-Shirt', 'jonas@example.de', '', 'Teilnehmer'],
    [3, 'Mia', '128', artikel[1] || artikel[0] || 'Hoodie', '', '', ''],
    [4, 'Opa Hinrich', 'XXL', '', '', '', '']
  ];
  bKopf.forEach((t, i) => {
    const c = hb.getRow(3).getCell(i + 1);
    c.value = t;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: HELL } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DUNKEL } };
    c.border = rahmen();
  });
  hb.getRow(3).height = 22;
  bZeilen.forEach((werte, i) => {
    const r = hb.getRow(4 + i);
    r.height = 20;
    werte.forEach((v, j) => {
      const c = r.getCell(j + 1);
      c.value = v;
      c.border = rahmen();
      c.font = { name: 'Calibri', size: 11, color: { argb: j === 0 ? GRAU : TINTE } };
      if (j === 0) c.alignment = { horizontal: 'center' };
      if (j === 5) c.numFmt = '@';
    });
  });

  const hinweise = [
    ['Nur der Name ist Pflicht.', 'Alles andere könnt ihr weglassen. Wer keine Größe angibt, taucht in der Bestellliste unter „ohne Größe“ auf.'],
    ['Größen bleiben unter sich.', 'Sie werden nie auf ein Textil gedruckt, sondern nur in eurer Bestellliste zusammengezählt.'],
    ['E-Mail und Handy sind freiwillig.', 'Sie dienen einzig der Einladung zur Abstimmung – nie einem Design, nie einem Prompt, nie der Druckdatei.'],
    ['Rolle.', '„Orga“ darf die Abstimmung anlegen und das Ergebnis sehen, „Teilnehmer“ stimmt ab. Leer = Teilnehmer.'],
    ['Bis zu 100 Personen.', 'Diese Vorlage hat ' + ZEILEN + ' Zeilen – braucht ihr mehr, kopiert ihr einfach weitere dazu.'],
    ['Eigene Liste?', 'Geht auch. Wichtig ist nur eine Spalte mit den Namen; Größe, Artikel, E-Mail, Handy und Rolle erkennen wir automatisch.'],
    ['Und dann?', 'Speichern und die Datei auf motto-otto.de wieder hochladen – fertig.']
  ];
  let z = 4 + bZeilen.length + 1;
  zeile(z, 'GUT ZU WISSEN', {
    font: { name: 'Calibri', size: 12, bold: true, color: { argb: TINTE } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE7D8' } }
  });
  hb.getRow(z).height = 24;
  z++;
  for (const [titel, text] of hinweise) {
    hb.mergeCells(`A${z}:B${z}`);
    const a = hb.getCell(`A${z}`);
    a.value = titel;
    a.font = { name: 'Calibri', size: 11, bold: true, color: { argb: TINTE } };
    a.alignment = { vertical: 'top', wrapText: true };
    hb.mergeCells(`C${z}:G${z}`);
    const b = hb.getCell(`C${z}`);
    b.value = text;
    b.font = { name: 'Calibri', size: 11, color: { argb: TINTE } };
    b.alignment = { vertical: 'top', wrapText: true };
    hb.getRow(z).height = 30;
    z++;
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Route anmelden: GET /api/mo/namensliste/:slug.xlsx (slug optional -> allgemeine Vorlage).
 * deps: { mottos, produkte, GARMENTS }
 */
export function mountNamensliste(app, deps) {
  const { mottos, produkte, GARMENTS } = deps;
  // Dieselbe Quelle wie die Auswahl auf der Motto-Seite: gebuchte Teile des Mottos, Zubehoer ohne Groessen raus.
  const artikelFuer = (slug) => {
    if (!produkte || typeof produkte.enabledFor !== 'function' || !GARMENTS) return null;
    const a = produkte.enabledFor(slug).filter(k => GARMENTS[k] && GARMENTS[k].sizes !== false).map(k => GARMENTS[k].label);
    return a.length ? a : null;
  };

  app.get('/api/mo/namensliste/:file', async (req, res) => {
    const slug = String(req.params.file).replace(/\.xlsx$/i, '').replace(/[^a-z0-9-]/gi, '');
    let mottoName = '', artikel = null;
    try {
      const m = slug && slug !== 'vorlage' ? await mottos.get(slug) : null;
      if (m) {
        mottoName = m.name || '';
        artikel = artikelFuer(m.slug);
      }
    } catch (e) { /* ohne Motto ist die Vorlage trotzdem brauchbar */ }
    try {
      const buf = await namenslisteVorlage({ mottoName, artikel });
      const datei = 'motto-otto-namensliste' + (slug && slug !== 'vorlage' ? '-' + slug : '') + '.xlsx';
      res.set('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('content-disposition', 'attachment; filename="' + datei + '"');
      res.send(buf);
    } catch (e) {
      console.error('Namenslisten-Vorlage:', e && e.message ? e.message : e);
      res.status(500).json({ error: 'Vorlage konnte nicht gebaut werden' });
    }
  });
}
