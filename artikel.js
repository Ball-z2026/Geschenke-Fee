// artikel.js - Motto Otto FREESTYLE
// -----------------------------------------------------------------------------
// Freestyle heisst: kein Master-Prompt gibt das Motiv vor, der Kunde schreibt selbst.
// Vorgegeben ist nur der ARTIKEL - und der bestimmt drei Dinge, die der Kunde nicht
// entscheiden darf: das Druckverfahren, die Druckflaeche in Zentimetern und ob das
// Motiv vollflaechig laeuft oder freistehend sitzt.
//
// Der Katalog kommt aus freestyle/artikel-katalog.json und wird aus der Artikelliste
// von Markus erzeugt (freestyle/katalog-bauen.mjs, Quelle artikelliste-markus.csv).
// Nichts darin ist geschaetzt: Artikel ohne belastbares Mass tragen druckflaecheOffen
// und werden vom Konfigurator NICHT angeboten, statt mit einer Fantasiezahl zu laufen.

import { readFileSync } from 'node:fs';
import { druckLeinwand, GARMENTS, placementFor } from './mottos.js';

export const ARTIKEL = JSON.parse(
  readFileSync(new URL('./freestyle/artikel-katalog.json', import.meta.url), 'utf8')
);

// ---------- Druckverfahren -----------------------------------------------------
// DTF ist gemessen (Marktrecherche 10. Sept. 2026). Sublimation und UV stehen mit
// branchenueblichen STARTWERTEN - beim jeweiligen Produzenten bestaetigen lassen.
// geprueft:false heisst genau das und soll sichtbar bleiben.
export const VERFAHREN = {
  dtf: {
    label: 'DTF-Transfer', traeger: 'Textil',
    grund: 'transparent', motivart: 'freistehend',
    minLinieMm: 1.5, minVersalMm: 3.8, beschnittMm: 0,
    weissdruck: true, geprueft: true,
    prompt: 'This is a DTF transfer pressed onto fabric.',
    promptFreistehend: ' The artwork stands free on a fully transparent background - the garment colour IS the background, so never draw one.',
    promptVollflaechig: ' The transfer covers the whole panel, so the artwork is printed edge to edge and the fabric colour is not part of the design.'
  },
  sublimation: {
    label: 'Sublimationsdruck', traeger: 'Polyester oder beschichtete Ware',
    grund: 'vollflaechig', motivart: 'vollflaechig',
    minLinieMm: 0.5, minVersalMm: 2.5, beschnittMm: 3,
    weissdruck: false, geprueft: false,
    prompt: 'This is a sublimation print. There is NO white ink: every light value comes from the bare white substrate, so the design must never rely on printed white and must not use a white outline as a separating device. Colours come out slightly softer and warmer after pressing, so keep contrast strong and avoid very pale tints that would vanish.'
  },
  uv: {
    label: 'UV-Direktdruck', traeger: 'Holz, Metall, Acryl, Kunststoff',
    grund: 'vollflaechig', motivart: 'vollflaechig',
    minLinieMm: 0.3, minVersalMm: 2, beschnittMm: 3,
    weissdruck: true, geprueft: false,
    prompt: 'This is a UV direct print onto a rigid surface. The material texture stays faintly visible through light areas, so avoid large pale washes that would read as dirty on wood or brushed metal.'
  },
  // Digitaldruck auf Papier (Poster, Sticker), randlos mit 3 mm Beschnitt.
  digitaldruck: {
    label: 'Digitaldruck', traeger: 'Papier, Vinyl',
    grund: 'vollflaechig', motivart: 'vollflaechig',
    minLinieMm: 0.3, minVersalMm: 2, beschnittMm: 3,
    weissdruck: true, geprueft: true,
    prompt: 'This is a full-bleed digital print on paper. Colours print rich and saturated; the picture runs to every edge.'
  }
};

// ---------- Flaechen ------------------------------------------------------------
// Textilien holen ihre Druckflaechen aus GARMENTS, damit es nur EINE Wahrheit gibt.
export function flaechenVon(artikelId) {
  const a = ARTIKEL[artikelId];
  if (!a) return {};
  if (a.garment && GARMENTS[a.garment]) {
    const out = {};
    for (const [key, cm] of Object.entries(GARMENTS[a.garment].cm)) {
      const pl = placementFor(key, a.garment);
      out[key] = { label: (pl && pl.label) || key, cm };
    }
    return out;
  }
  return a.flaechen || {};
}

// ---------- Welche Mockup-Ansicht zeigt DIESEN Artikel? -------------------------
// Keys rechts sind die gebauten Mockups aus mockups.js. Hier steht NUR drin, was
// wirklich passt: wer ein Strandtuch bestellt, bekommt das Strandtuch zu sehen und
// nicht ersatzweise ein T-Shirt. Fuer alles andere (Tuerschild, Hundemarke, Puzzle ...)
// gibt es bewusst keinen Eintrag - dann zeigt die Seite das Motiv selbst, statt ein
// Teil vorzugaukeln, das der Kunde gar nicht bestellt hat.
export const ARTIKEL_ANSICHT = {
  tshirt: 'tee',
  hoodie: 'hoodie',
  tasse: 'tasse',
  kissen: 'kissen',
  strandtuch: 'strandtuch',
  shopper: 'beutel',
  grillschuerze: 'grillschuerze',   // 8. Okt.
  handtuch: 'handtuch',
  fussmatte: 'fussmatte',
  // Fassung 85 (18. Sept.) hat fuer diese sieben eigene Vorlagen gebracht (mockups.js GARMENTS,
  // vorlagen-original/<teil>.jpg). Bis zum 21. Sept. fehlten sie HIER - darum uebersprang die
  // Startseiten-Reihe "Eigenes Design fuer ..." Hundedecke und XXL-Mousepad (flachwareKarten
  // fragt ansichtVon), obwohl ihre Vorzeige-Designs freigegeben und die Mockups gebaut waren.
  mousepad: 'mousepad',
  hundedecke: 'hundedecke',
  acrylbild: 'acrylbild',
  tuerschild: 'tuerschild',
  // 22. Sept., Markus: "Hole die fehlenden Designs nach" - Brett (Katalog jetzt mit 40x30 als
  // erster Groesse, damit Vorlagenmass und Katalogmass dasselbe sagen), Poster und Sticker
  // (eigene Katalogeintraege, sie werden seit Fassung 85 gezeigt und verkauft).
  brett: 'brett',
  poster: 'poster',
  sticker: 'sticker',
  // 22. Sept., Markus: "Wir koennen jeden Artikel, auch die Brotdose, vollflaechig bespielen."
  brotdose: 'brotdose',
  napfunterlage: 'napfunterlage',
  gepaeckanhaenger: 'gepaeckanhaenger'
};
export function ansichtVon(artikelId) { return ARTIKEL_ANSICHT[artikelId] || ''; }

export function artikelLeinwand(artikelId, flaeche, opts = {}) {
  const a = ARTIKEL[artikelId];
  if (!a) return null;
  const fl = flaechenVon(artikelId);
  const f = fl[flaeche] || fl[Object.keys(fl)[0]];
  if (!f) return null;
  const v = VERFAHREN[opts.verfahren || a.verfahren];
  if (!v) return null;
  const zugabe = (v.beschnittMm * 2) / 10;                 // Beschnitt auf beiden Seiten
  const cm = [ +(f.cm[0] + zugabe).toFixed(2), +(f.cm[1] + zugabe).toFixed(2) ];
  const lw = druckLeinwand(cm, opts);
  if (!lw) return null;
  // Grosse Artikel sprengen die 8,29-Megapixel-Grenze des Bildmodells. Das ist Physik,
  // kein Fehler - aber es muss sichtbar sein, sonst geht eine 99-dpi-Datei in den Druck.
  // Der Text ist bewusst fuer den Kunden geschrieben: "nur 70 dpi" klingt nach Panne,
  // gemeint ist "grosses Format, wird vor dem Druck hochgerechnet".
  const mass = `${String(cm[0]).replace('.', ',')} × ${String(cm[1]).replace('.', ',')} cm`;
  const warnung = lw.dpi < 150
    ? `Großes Format: ${a.name} wird über ${mass} bedruckt. Das Motiv entsteht in der höchsten Auflösung, die das Bildmodell hergibt – auf diese Fläche gerechnet sind das ${lw.dpi} dpi. Für die Produktion rechnen wir die Druckdatei sauber hoch; aus normalem Betrachtungsabstand sieht man davon nichts. Wer es messerscharf braucht, lässt das Motiv zusätzlich vektorisieren.`
    : (lw.dpi < 300 ? `${lw.dpi} dpi auf ${mass} – unter den 300 dpi einer Druckerei, bei diesem Artikel und Betrachtungsabstand aber üblich und unauffällig.` : null);
  return { ...lw, label: f.label, verfahren: v.label, netto: f.cm, brutto: cm, warnung };
}

// Millimeter werden erst dann zu einer wirksamen Vorgabe, wenn sie als PIXEL im
// Prompt stehen - das Bildmodell kennt keine Zentimeter.
export function minStrichPx(artikelId, flaeche, opts = {}) {
  const a = ARTIKEL[artikelId];
  const lw = artikelLeinwand(artikelId, flaeche, opts);
  if (!a || !lw) return null;
  const v = VERFAHREN[opts.verfahren || a.verfahren];
  const mmProPixel = (lw.brutto[0] * 10) / lw.px[0];
  return {
    linie: Math.max(1, Math.ceil(v.minLinieMm / mmProPixel)),
    versal: Math.max(1, Math.ceil(v.minVersalMm / mmProPixel)),
    mmProPixel: Math.round(mmProPixel * 1000) / 1000
  };
}

// ---------- Der Prompt-Baustein aus dem Artikel ---------------------------------
// Steht IMMER im Prompt, egal was der Kunde schreibt. Das ist der Teil, den der
// Kunde nicht ueberstimmen darf, sonst kommt eine unbrauchbare Datei heraus.
export function druckBlock(artikelId, flaeche, opts = {}) {
  const a = ARTIKEL[artikelId];
  const lw = artikelLeinwand(artikelId, flaeche, opts);
  const px = minStrichPx(artikelId, flaeche, opts);
  if (!a || !lw || !px) return '';
  const v = VERFAHREN[opts.verfahren || a.verfahren];
  const art = opts.motivart || a.motivart;
  const quer = lw.netto[0] >= lw.netto[1];

  const teile = [
    `PRODUCT: ${a.name}. Printed area ${lw.netto[0]} x ${lw.netto[1]} cm, ${quer ? 'LANDSCAPE' : 'PORTRAIT'}.`,
    v.prompt + (art === 'vollflaechig' ? (v.promptVollflaechig || '') : (v.promptFreistehend || '')),
    `MINIMUM DETAIL at this size: no line thinner than ${px.linie} pixels and no capital letter shorter than ${px.versal} pixels in this image. Anything finer breaks in production.`
  ];

  if (art === 'vollflaechig') {
    teile.push('FULL BLEED: the design covers the whole surface and runs off all four edges - no transparent areas, no empty margin, no free-standing emblem on a plain ground. Keep every text and every element that must survive at least 8 percent away from each edge, because the outer band is trimmed off.');
    // 6. Okt., Markus: "Kissen ... vollflaechig sein kann oder auch muss sogar, es sei denn einfach nur Sprueche,
    // wo der Rest bleibt weiss."
    teile.push('ONLY EXCEPTION: if the order is pure lettering (a saying, names, a date) and no picture was asked for, the ground stays plain white - the white of the product itself - and the lettering sits as one calm composition in the middle, in dark, saturated colours. Never white or very pale lettering.');
  } else {
    teile.push('FREE-STANDING: the artwork is a shape with an irregular silhouette, never a filled rectangle or oval. At least a quarter of the canvas stays completely empty and the empty ground reaches between the elements, not only around them.');
  }
  return teile.join('\n');
}

// ---------- Pruefen -------------------------------------------------------------
export function pruefeArtikel(id) {
  const a = ARTIKEL[id];
  if (!a) return ['Artikel unbekannt: ' + id];
  const fehler = [];
  if (!VERFAHREN[a.verfahren]) fehler.push('Verfahren unbekannt: ' + a.verfahren);
  if (!a.produzent) fehler.push('kein Produzent hinterlegt - ohne den kann kein Auftrag raus');
  const fl = flaechenVon(id);
  if (!Object.keys(fl).length) fehler.push('keine Druckflaeche: ' + (a.varianten || ''));
  for (const [k, f] of Object.entries(fl)) {
    if (!Array.isArray(f.cm) || !(f.cm[0] > 0 && f.cm[1] > 0)) { fehler.push(`Flaeche ${k}: Mass unbrauchbar`); continue; }
    if (!artikelLeinwand(id, k)) fehler.push(`Flaeche ${k}: ${f.cm[0]}x${f.cm[1]} cm ergibt keine gueltige Leinwand`);
  }
  return fehler;
}

// Was darf der Kunde ueberhaupt sehen? Nur Artikel, die durchgepruefte Masse haben.
export function verkaufsfaehig(id) {
  const a = ARTIKEL[id];
  // 1. Okt., Markus: "das Schneidebrett nehmen wir komplett raus, ueberall" - ausserHandel im Katalog.
  return !!a && !a.ausserHandel && !a.druckflaecheOffen && !!VERFAHREN[a.verfahren] && !!Object.keys(flaechenVon(id)).length;
}

export function artikelAuswahl({ nurVerkaufsfaehig = true } = {}) {
  const gruppen = {};
  for (const [id, a] of Object.entries(ARTIKEL)) {
    if (nurVerkaufsfaehig && !verkaufsfaehig(id)) continue;
    // Ein Artikel, der zu EINEM Motto gehoert (nurMotto), steht nicht in der freien Auswahl.
    if (a.nurMotto) continue;
    const g = a.gruppe || 'Sonstiges';
    (gruppen[g] = gruppen[g] || []).push({
      id, name: a.name, beschreibung: a.beschreibung, material: a.material,
      verfahren: VERFAHREN[a.verfahren] ? VERFAHREN[a.verfahren].label : a.verfahren,
      verfahrenAlternativ: (a.verfahrenAlternativ || []).map(v => VERFAHREN[v] && VERFAHREN[v].label).filter(Boolean),
      motivart: a.motivart,
      personalisierung: a.personalisierung,
      flaechen: Object.entries(flaechenVon(id)).map(([k, f]) => ({
        key: k, label: f.label, cm: f.cm, masse: `${f.cm[0]} x ${f.cm[1]} cm`
      })),
      mindestmenge: a.mindestmenge, hinweis: a.hinweis || ''
    });
  }
  for (const g of Object.keys(gruppen)) gruppen[g].sort((x, y) => x.name.localeCompare(y.name, 'de'));
  return gruppen;
}

export function katalogBericht() {
  const offen = [], bereit = [], fehlerhaft = {};
  for (const id of Object.keys(ARTIKEL)) {
    const f = pruefeArtikel(id);
    if (ARTIKEL[id].druckflaecheOffen) offen.push({ id, name: ARTIKEL[id].name, angabe: ARTIKEL[id].varianten });
    else if (f.length) fehlerhaft[id] = f;
    else bereit.push(id);
  }
  return { gesamt: Object.keys(ARTIKEL).length, bereit: bereit.length, offen, fehlerhaft };
}
