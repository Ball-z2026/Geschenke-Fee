// produzenten.js - Motto Otto: Fertigung ausser Haus
// -----------------------------------------------------------------------------
// Entscheidung vom 13. Sept. 2026 (Markus):
//   - Auftraege werden vorerst NUR VORBEREITET, nichts wird verschickt.
//   - JEDER Auftrag braucht seine Freigabe, bevor er rausgeht.
// Deshalb ist der Versandweg hier nur als Adapter angelegt: die Auftragsdaten sind
// vollstaendig und pruefbar, der letzte Schritt ist bewusst nicht verdrahtet.

import { ARTIKEL, VERFAHREN, artikelLeinwand, flaechenVon } from './artikel.js';

// ---------- Produzenten ---------------------------------------------------------
// LEER, bis Markus sagt, wer was fertigt. Ein Artikel ohne Produzent ist nicht
// verkaufsfaehig - pruefeArtikel meldet das.
//
// Form je Eintrag:
//   name, ansprechpartner, email, weg: 'email' | 'api' | 'manuell',
//   api: { url, authVariable }   - authVariable ist der NAME der Umgebungsvariable,
//                                  nie der Wert. Zugangsdaten stehen nie in Dateien.
//   dateiformat: ['png'] | ['pdf','png'], farbprofil, beschnittMm,
//   vorlaufTage, mindestmenge, hinweis
export const PRODUZENTEN = {
  // haus: {
  //   name: 'Eigene Fertigung', weg: 'manuell', dateiformat: ['png','pdf'],
  //   farbprofil: 'sRGB', beschnittMm: 0, vorlaufTage: 2, mindestmenge: 1
  // },
};

export const STATUS = {
  ENTWURF: 'entwurf',
  WARTET: 'wartet_auf_freigabe',
  FREIGEGEBEN: 'freigegeben',
  VERSANDT: 'an_produzent_uebermittelt',
  ABGELEHNT: 'abgelehnt'
};

// ---------- Auftrag vorbereiten -------------------------------------------------
// Erzeugt den vollstaendigen Auftragsdatensatz. Verschickt nichts.
export function auftragVorbereiten({ bestellNr, positionen, kunde, notiz }) {
  const zeit = new Date().toISOString();
  const geprueft = [];
  const probleme = [];

  for (const [i, p] of (positionen || []).entries()) {
    const a = ARTIKEL[p.artikelId];
    if (!a) { probleme.push(`Position ${i + 1}: Artikel unbekannt (${p.artikelId})`); continue; }
    const verfahren = p.verfahren || a.verfahren;
    const v = VERFAHREN[verfahren];
    if (!v) { probleme.push(`Position ${i + 1}: Verfahren unbekannt (${verfahren})`); continue; }
    if (!a.produzent) { probleme.push(`Position ${i + 1}: ${a.name} hat keinen Produzenten`); continue; }
    const prod = PRODUZENTEN[a.produzent];
    if (!prod) { probleme.push(`Position ${i + 1}: Produzent "${a.produzent}" nicht hinterlegt`); continue; }

    const fl = flaechenVon(p.artikelId);
    const key = p.flaeche && fl[p.flaeche] ? p.flaeche : Object.keys(fl)[0];
    const lw = artikelLeinwand(p.artikelId, key, { verfahren });
    if (!lw) { probleme.push(`Position ${i + 1}: keine gueltige Leinwand`); continue; }
    if (!p.druckdatei) probleme.push(`Position ${i + 1}: keine Druckdatei angehaengt`);
    if (lw.warnung && lw.dpi < 150) probleme.push(`Position ${i + 1}: ${lw.warnung}`);

    const menge = Math.max(1, parseInt(p.menge, 10) || 1);
    const mindest = a.mindestmenge || prod.mindestmenge || 1;
    if (menge < mindest) probleme.push(`Position ${i + 1}: Menge ${menge} unter Mindestmenge ${mindest} bei ${prod.name}`);

    geprueft.push({
      artikelId: p.artikelId, artikel: a.name, variante: p.variante || null,
      flaeche: key, flaecheLabel: lw.label,
      verfahren, verfahrenLabel: v.label,
      masseCm: lw.netto, mitBeschnittCm: lw.brutto, beschnittMm: v.beschnittMm,
      leinwand: lw.size, dpi: lw.dpi, dpiHinweis: lw.warnung || null,
      motivart: p.motivart || a.motivart,
      menge, produzent: a.produzent, produzentName: prod.name,
      druckdatei: p.druckdatei || null
    });
  }

  // nach Produzent buendeln - jeder bekommt genau einen Auftrag
  const buendel = {};
  for (const g of geprueft) (buendel[g.produzent] = buendel[g.produzent] || []).push(g);

  return {
    id: `AUF-${bestellNr || zeit.slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`,
    bestellNr: bestellNr || null,
    erstellt: zeit,
    status: probleme.length ? STATUS.ENTWURF : STATUS.WARTET,
    kunde: kunde ? { name: kunde.name || null, lieferadresse: kunde.lieferadresse || null } : null,
    notiz: notiz || '',
    positionen: geprueft,
    auftraege: Object.entries(buendel).map(([pid, pos]) => ({
      produzent: pid, produzentName: PRODUZENTEN[pid].name,
      weg: PRODUZENTEN[pid].weg, vorlaufTage: PRODUZENTEN[pid].vorlaufTage || null,
      positionen: pos, teileGesamt: pos.reduce((s, x) => s + x.menge, 0)
    })),
    probleme,
    freigabe: null
  };
}

// ---------- Freigabe -------------------------------------------------------------
export function freigeben(auftrag, { durch, bemerkung } = {}) {
  if (auftrag.probleme && auftrag.probleme.length) {
    return { ok: false, grund: 'Es liegen ungeloeste Probleme vor', probleme: auftrag.probleme };
  }
  if (auftrag.status !== STATUS.WARTET) {
    return { ok: false, grund: `Status ist "${auftrag.status}", erwartet "${STATUS.WARTET}"` };
  }
  auftrag.status = STATUS.FREIGEGEBEN;
  auftrag.freigabe = { durch: durch || 'Markus', zeit: new Date().toISOString(), bemerkung: bemerkung || '' };
  return { ok: true, auftrag };
}

export function ablehnen(auftrag, grund) {
  auftrag.status = STATUS.ABGELEHNT;
  auftrag.freigabe = { durch: null, zeit: new Date().toISOString(), bemerkung: grund || '' };
  return auftrag;
}

// ---------- Versand: bewusst nicht verdrahtet ------------------------------------
// Wenn Markus den Versand freischaltet, wird HIER angesetzt und sonst nirgends.
// Bis dahin meldet die Funktion ehrlich, dass nichts passiert ist - sie tut nicht so,
// als haette sie etwas verschickt.
export async function uebermitteln(auftrag) {
  if (auftrag.status !== STATUS.FREIGEGEBEN) {
    return { ok: false, grund: 'Nicht freigegeben - es wird nichts uebermittelt' };
  }
  return {
    ok: false,
    grund: 'Versand ist noch abgeschaltet (Entscheidung 13. Sept. 2026: erst mal nur vorbereiten). ' +
           'Zum Aktivieren hier den Adapter je Produzent einbauen: weg "email" verschickt Auftragsblatt ' +
           'plus Druckdateien, weg "api" postet gegen PRODUZENTEN[x].api.url mit dem Schluessel aus der ' +
           'in api.authVariable genannten Umgebungsvariable.',
    auftrag: auftrag.id
  };
}

// ---------- Auftragsblatt als Text ------------------------------------------------
// Das, was der Produzent lesen muss - unabhaengig davon, wie es zu ihm kommt.
export function auftragsblatt(auftrag, produzentId) {
  const teil = auftrag.auftraege.find(x => x.produzent === produzentId);
  if (!teil) return '';
  const z = [];
  z.push(`AUFTRAG ${auftrag.id}`);
  z.push(`Motto Otto  |  erstellt ${auftrag.erstellt.slice(0, 16).replace('T', ' ')}`);
  if (auftrag.bestellNr) z.push(`Bestellnummer: ${auftrag.bestellNr}`);
  z.push(`An: ${teil.produzentName}`);
  z.push('');
  for (const [i, p] of teil.positionen.entries()) {
    z.push(`${i + 1}. ${p.artikel}${p.variante ? ' / ' + p.variante : ''}  -  ${p.menge} Stueck`);
    z.push(`   Flaeche:   ${p.flaecheLabel}, ${p.masseCm[0]} x ${p.masseCm[1]} cm` +
           (p.beschnittMm ? ` (mit ${p.beschnittMm} mm Beschnitt: ${p.mitBeschnittCm[0]} x ${p.mitBeschnittCm[1]} cm)` : ''));
    z.push(`   Verfahren: ${p.verfahrenLabel}, ${p.motivart === 'vollflaechig' ? 'randlos ueber die ganze Flaeche' : 'freigestellt'}`);
    z.push(`   Datei:     ${p.druckdatei || 'FEHLT'}  (${p.leinwand} px, ${p.dpi} dpi)`);
    if (p.dpiHinweis) z.push(`   Hinweis:   ${p.dpiHinweis}`);
    z.push('');
  }
  z.push(`Gesamt: ${teil.teileGesamt} Stück`);
  if (auftrag.notiz) z.push(`Notiz: ${auftrag.notiz}`);
  if (auftrag.kunde && auftrag.kunde.lieferadresse) {
    z.push('', 'Lieferadresse:', auftrag.kunde.lieferadresse);
  }
  return z.join('\n');
}
