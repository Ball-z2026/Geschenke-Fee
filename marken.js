// Markensperre: geschuetzte Vereins- und Markennamen duerfen NIE auf ein Textil - egal ueber welches Feld.
// Geprueft wird (1) jede Kundeneingabe, die gedruckt wird, (2) jede Namensliste, (3) der Text im fertigen Bild (QA),
// (4) der Recherche-Steckbrief, (5) Logos/Wappen/Embleme im fertigen Bild (QA, checkLogos). Die Liste im Code ist der Grundstock; im Backend laesst sie sich um eigene Woerter
// erweitern (storage/marken.json), ohne dass etwas aus dem Grundstock verschwindet.
//
// Einbindung in server.js:
//   import { markenStore } from './marken.js';
//   const marken = markenStore(STORE);  await marken.ready();
//   marken.check(text)  -> null oder { wort, eingabe }   (erstes gefundenes geschuetztes Wort)
//   marken.checkAll([texte]) -> null oder Treffer
import fs from 'node:fs/promises';
import path from 'node:path';

// Grundstock. Zwei Sorten:
//  - "wort": trifft als ganzes Wort (auch ohne Punkte/Leerzeichen geschrieben: "H.S.V.", "st pauli", "StPauli")
//  - "teil": trifft auch als Bestandteil laengerer Woerter ("Werder" in "Werderfan", "Borussia" in "Borussen")
export const GRUNDSTOCK = {
  wort: [
    // Kurzformen deutscher Profivereine (als Wortmarken fuer Bekleidung eingetragen bzw. abgemahnt)
    'HSV', 'BVB', 'FCB', 'S04', 'KSC', 'FCN', 'FCK', 'F95', 'SGE', 'SCF', 'FCA', 'TSG', 'RBL', 'BMG', 'SVW', 'FCSP', 'D98', 'SCP', 'FCH', 'FCM', 'DSC', 'SVD', 'FCU', 'VFB', 'MSV', 'SVWW', 'FCE', 'FSV', 'RWE', 'SSV', 'TSV1860', '1860', 'HANNOVER96', 'MAINZ05', 'BAYER04', 'SCHALKE04', 'DARMSTADT98',
    // Kurzformen / Kunstnamen
    'ST PAULI', 'ST.PAULI', 'STPAULI', 'SANKT PAULI', 'GLADBACH', 'HERTHA', 'EINTRACHT', 'FORTUNA', 'ARMINIA', 'HANSA', 'DYNAMO', 'HOFFENHEIM', 'LEVERKUSEN', 'HOLSTEIN', 'KICKERS', 'JAHN', 'WEHEN', 'WALDHOF', 'PREUSSEN', 'ALEMANNIA', 'ENERGIE COTTBUS', 'ERZGEBIRGE AUE', 'GREUTHER', 'FUERTH', 'UNION BERLIN', 'RB LEIPZIG', 'RED BULL', 'BAYERN MUENCHEN', 'FC BAYERN', 'HAMBURGER SV', 'WERDER BREMEN', 'FC KOELN', 'VFB STUTTGART', 'VFL WOLFSBURG', 'VFL BOCHUM', 'SC FREIBURG', 'FC AUGSBURG', 'FC NUERNBERG', 'FC KAISERSLAUTERN', 'FC MAGDEBURG', 'FC HEIDENHEIM', 'FC SAARBRUECKEN', 'FC INGOLSTADT', 'SC PADERBORN', 'HANNOVER 96', 'MAINZ 05', 'BAYER 04', 'SCHALKE 04', 'DARMSTADT 98', 'ULM 1846', 'TSV 1860', '1860 MUENCHEN', 'VIKTORIA KOELN', 'ROT-WEISS ESSEN', 'ROT WEISS ESSEN', 'ROT-WEISS OBERHAUSEN', 'ROT-WEISS AHLEN', 'KARLSRUHER SC', 'WUPPERTALER SV', 'MUENSTER SC', 'SC VERL', 'SV ELVERSBERG', 'SV SANDHAUSEN', 'FC ST PAULI', 'SV WEHEN WIESBADEN', 'SV DARMSTADT', 'SV WERDER', 'FC HANSA', 'DYNAMO DRESDEN', 'TSG HOFFENHEIM', 'TSG 1899', '1899 HOFFENHEIM', 'SPVGG UNTERHACHING', 'SPVGG GREUTHER',
    // Verbaende, Ligen, Wettbewerbe
    'DFB', 'DFL', 'UEFA', 'FIFA', 'BUNDESLIGA', 'CHAMPIONS LEAGUE', 'EUROPA LEAGUE', 'DFB-POKAL', 'DFB POKAL', 'DIE MANNSCHAFT',
    // International (Auswahl der bekanntesten, oft auf Fanartikeln)
    'REAL MADRID', 'FC BARCELONA', 'BARCA', 'BARÇA', 'ATLETICO', 'MANCHESTER UNITED', 'MAN UNITED', 'MAN UTD', 'MANCHESTER CITY', 'MAN CITY', 'LIVERPOOL FC', 'FC LIVERPOOL', 'CHELSEA FC', 'FC CHELSEA', 'ARSENAL', 'TOTTENHAM', 'SPURS', 'JUVENTUS', 'JUVE', 'AC MILAN', 'AC MAILAND', 'INTER MAILAND', 'INTER MILAN', 'PSG', 'PARIS SAINT-GERMAIN', 'PARIS SAINT GERMAIN', 'AJAX', 'CELTIC', 'GALATASARAY', 'FENERBAHCE', 'FENERBAHÇE', 'BESIKTAS', 'BEŞIKTAŞ', 'BENFICA', 'FC PORTO', 'RAPID WIEN', 'RED BULL SALZBURG', 'FC BASEL', 'YOUNG BOYS',
    // Weitere geschuetzte Fan-Begriffe
    'VOLKSPARKSTADION', 'WESERSTADION', 'SIGNAL IDUNA PARK', 'ALLIANZ ARENA', 'VELTINS-ARENA', 'VELTINS ARENA', 'MILLERNTOR', 'OLYMPIASTADION BERLIN', 'MERCEDES-BENZ ARENA', 'BAYARENA', 'RHEINENERGIESTADION', 'DEUTSCHE BANK PARK', 'BORUSSIA-PARK', 'BORUSSIA PARK',
    // Bekannte Nicht-Sport-Marken, die gern auf Shirts landen
    'ADIDAS', 'NIKE', 'PUMA', 'SWOOSH', 'NIKE-HAKEN', 'ADIDAS-STREIFEN', 'JAKO', 'UHLSPORT', 'KAPPA', 'COCA-COLA', 'COCA COLA', 'RED BULL', 'JAEGERMEISTER', 'JÄGERMEISTER', 'HARIBO', 'ASTRA', 'HOLSTEN', 'BECKS', "BECK'S", 'KROMBACHER', 'WARSTEINER', 'BITBURGER', 'VELTINS', 'PAULANER', 'ERDINGER', 'DISNEY', 'MARVEL', 'STAR WARS', 'POKEMON', 'POKÉMON', 'NINTENDO', 'PLAYSTATION', 'XBOX', 'FERRARI', 'PORSCHE', 'MERCEDES', 'BMW', 'AUDI', 'VOLKSWAGEN', 'HARLEY-DAVIDSON', 'HARLEY DAVIDSON', 'HELLS ANGELS', 'BANDIDOS', 'BALLERMANN', 'BIERKOENIG', 'BIERKÖNIG', 'MEGAPARK', 'OKTOBERFEST'
  ],
  teil: [
    'WERDER', 'BORUSS', 'SCHALKE', 'BAYERN', 'HERTHA', 'GLADBACH', 'EINTRACHT', 'JUVENTUS', 'BARCELONA', 'MANUTD', 'DORTMUND', 'LEVERKUSEN', 'HOFFENHEIM', 'SANKTPAULI', 'STPAULI', 'HARLEY', 'DISNEY', 'POKEMON', 'MARVEL', 'JAEGERMEISTER'
  ]
};

// Umlaute auffalten, Punkte/Bindestriche/Leerzeichen entfernen, Grossschreibung
export function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
    .replace(/Ç/g, 'C').replace(/Ş/g, 'S').replace(/É|È/g, 'E')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}
const compact = (s) => normalize(s).replace(/\s+/g, '');

// 3. Okt., Markus: "Barca hat nicht geklappt wegen Sperre Fussball .. Aber das Hotel heisst Hotel Barca,
// das darf natuerlich nicht passieren." Ein einzelnes geschuetztes Wort direkt neben einem Wort fuer
// einen Betrieb ist der Name dieses Betriebs, kein Verein: "Hotel Barca", "Bar Juve", "Pizzeria Ajax".
// Wortfolgen wie "FC Barcelona" oder "Real Madrid" bleiben gesperrt, egal was daneben steht.
export const BETRIEB = new Set(['HOTEL', 'HOTELS', 'APARTHOTEL', 'HOSTAL', 'HOSTEL', 'MOTEL', 'RESORT', 'APARTMENTS', 'APARTAMENTOS', 'APPARTEMENTS',
  'PENSION', 'GASTHAUS', 'GASTHOF', 'LANDGASTHOF', 'RESTAURANT', 'RESTAURANTE', 'RISTORANTE', 'TRATTORIA', 'OSTERIA', 'PIZZERIA', 'BISTRO', 'BRASSERIE',
  'CAFE', 'CAFFE', 'BAR', 'TAPASBAR', 'TAPAS', 'BODEGA', 'TAVERNA', 'TAVERNE', 'KNEIPE', 'IMBISS', 'KIOSK', 'BAECKEREI', 'KONDITOREI', 'EISCAFE',
  'CAMPING', 'CAMPINGPLATZ', 'VILLA', 'CASA', 'FINCA', 'CHIRINGUITO', 'BEACH', 'BEACHCLUB', 'PLAYA', 'STRANDBAR', 'SPA', 'LODGE', 'INN',
  'FERIENWOHNUNG', 'FERIENHAUS', 'SALON', 'FRISEUR', 'BOUTIQUE', 'LADEN', 'METZGEREI', 'WEINGUT', 'WEINSTUBE', 'BRAUHAUS', 'BIERGARTEN']);

// 3. Okt., Markus: "Die gesperrten Woerter wie Barca, Barcelona duerfen nur gesperrt werden, wenn sie im
// Kontext mit Fussball sind. Wenn jemand Barcelona schreibt, weil er in Barcelona ist, darf das doch nicht
// gesperrt werden. Das machen wir mit allen so. HSV kann jeder drauf schreiben. Ist es HSV Hamburg, dann
// ist es klar der Fussball-Bezug."
// Darum drei Sorten Vereinswoerter:
//  - EINDEUTIG: bedeutet nichts anderes als Fussball - gesperrt ohne Wenn und Aber: volle Vereinsnamen mit
//    FC/SV/TSV/... oder Gruendungsjahr ("FC Barcelona", "Hamburger SV", "Mainz 05"), Verbaende und Ligen
//    (DFB, Bundesliga, Champions League), Stadien, und die grossen Namen ohne zweite Bedeutung (Real Madrid).
//  - alles andere aus dem Fussball-Teil (Kurzformen, Spitznamen, Staedte: HSV, Barca, Barcelona, Dortmund,
//    Leverkusen, Hertha, Eintracht ...) ist nur mit FUSSBALL-BEZUG gesperrt: ein Fussballwort im selben
//    Design (Fussball, Fan, Stadion, Trikot, Liga ...), "...fan" angehaengt ("Werderfan"), die Heimatstadt
//    einer Kurzform daneben ("HSV Hamburg"), oder ein Fan-Motto.
//  - Produktmarken (Adidas, Disney, Ferrari ... ab 'ADIDAS' im Grundstock) bleiben wie bisher immer gesperrt.
const VEREINS_KUERZEL = new Set(['FC', 'SV', 'VFB', 'VFL', 'TSV', 'SC', 'AC', 'SSC', 'SPVGG', 'BSC', 'RB', 'TSG', 'SG', 'FSV', 'KSV', 'SSV', 'MSV', 'BV', 'CF', 'CD', 'AS', 'SS', 'US', 'OSC', 'SK', 'FK']);
const EINDEUTIG_NAMEN = new Set(['DFB', 'DFL', 'UEFA', 'FIFA', 'BUNDESLIGA', 'CHAMPIONSLEAGUE', 'EUROPALEAGUE', 'DFBPOKAL', 'DIEMANNSCHAFT',
  'REALMADRID', 'MANCHESTERUNITED', 'MANCHESTERCITY', 'MANUNITED', 'MANUTD', 'MANCITY', 'PARISSAINTGERMAIN', 'INTERMAILAND', 'INTERMILAN',
  'BAYERNMUENCHEN', 'WERDERBREMEN', 'UNIONBERLIN', 'RAPIDWIEN', 'REDBULLSALZBURG', 'ENERGIECOTTBUS', 'ERZGEBIRGEAUE', 'DYNAMODRESDEN', 'ROTWEISSESSEN', 'ROTWEISSOBERHAUSEN', 'ROTWEISSAHLEN',
  'VOLKSPARKSTADION', 'WESERSTADION', 'SIGNALIDUNAPARK', 'ALLIANZARENA', 'VELTINSARENA', 'OLYMPIASTADIONBERLIN', 'MERCEDESBENZARENA', 'BAYARENA', 'RHEINENERGIESTADION', 'DEUTSCHEBANKPARK', 'BORUSSIAPARK']);
// Woerter, die einen Fussball-Bezug herstellen (ganze Woerter), und Wortteile fuer Zusammensetzungen.
const FUSSBALL_WORT = new Set(['FUSSBALL', 'FUSBALL', 'FOOTBALL', 'SOCCER', 'FUTBOL', 'CALCIO', 'FAN', 'FANS', 'FANCLUB', 'FANSHIRT', 'FANKURVE', 'KURVE',
  'ULTRAS', 'ULTRA', 'STADION', 'STADIUM', 'ESTADIO', 'TRIKOT', 'KICKEN', 'MANNSCHAFT', 'MEISTERSCHAFT', 'POKAL', 'POKALSIEGER', 'LIGA', 'LEAGUE',
  'DERBY', 'TORE', 'TORJAEGER', 'ANPFIFF', 'ABPFIFF', 'SPIELTAG', 'AUFSTIEG', 'ABSTIEG', 'SAISON', 'KADER', 'ELFMETER', 'HOOLIGAN', 'HOOLIGANS',
  'CHAMPIONS', 'TIFO', 'FANGESANG', 'VEREIN', 'VEREINSLIEBE', 'AUSWAERTSSPIEL', 'HEIMSPIEL', 'OLE']);
const FUSSBALL_TEIL = ['FUSSBALL', 'FANCLUB', 'FANKURVE', 'STADION', 'TRIKOT', 'BUNDESLIGA', 'ULTRAS', 'MEISTERSCHAFT', 'TORJAEGER', 'AUSWAERTS'];
// Heimatstadt (bzw. Stadtteil) je Kurzform: "HSV Hamburg" ist Fussball, "HSV" allein nicht.
export const VEREINS_STADT = {
  HSV: ['HAMBURG'], BVB: ['DORTMUND'], FCB: ['MUENCHEN', 'BAYERN'], S04: ['GELSENKIRCHEN', 'SCHALKE'], KSC: ['KARLSRUHE'], FCN: ['NUERNBERG'], FCK: ['KAISERSLAUTERN'],
  F95: ['DUESSELDORF'], SGE: ['FRANKFURT'], SCF: ['FREIBURG'], FCA: ['AUGSBURG'], TSG: ['HOFFENHEIM', 'SINSHEIM'], RBL: ['LEIPZIG'], BMG: ['GLADBACH', 'MOENCHENGLADBACH'],
  SVW: ['BREMEN'], FCSP: ['PAULI', 'HAMBURG'], D98: ['DARMSTADT'], SCP: ['PADERBORN'], FCH: ['HEIDENHEIM'], FCM: ['MAGDEBURG'], DSC: ['BIELEFELD'], SVD: ['DARMSTADT'],
  FCU: ['UNION', 'BERLIN'], VFB: ['STUTTGART'], MSV: ['DUISBURG'], SVWW: ['WIESBADEN'], FCE: ['AUE'], FSV: ['MAINZ', 'FRANKFURT'], RWE: ['ESSEN'], SSV: ['ULM'],
  // Nur Kurzformen und Spitznamen ohne zweite Bedeutung. Nicht: Hertha (Vorname), Schalke/Benfica/Besiktas
  // (Stadtteile), Arsenal, Celtic, Fortuna, Eintracht (gewoehnliche Woerter) - "Oma Hertha aus Berlin" ist kein Fussball.
  BARCA: ['BARCELONA'], JUVE: ['TURIN', 'TORINO'], JUVENTUS: ['TURIN', 'TORINO'], PSG: ['PARIS'], ATLETICO: ['MADRID'], AJAX: ['AMSTERDAM'],
  WERDER: ['BREMEN'], BORUSS: ['DORTMUND', 'GLADBACH', 'MOENCHENGLADBACH']
};

const SPORT_ENDE = GRUNDSTOCK.wort.indexOf('ADIDAS');
const PRODUKT_WORT = new Set(GRUNDSTOCK.wort.slice(SPORT_ENDE).map(w => normalize(w).replace(/\s+/g, '')));
const PRODUKT_TEIL = new Set(['HARLEY', 'DISNEY', 'POKEMON', 'MARVEL', 'JAEGERMEISTER']);
// Bedeutet dieses Wort (diese Wortfolge) nichts anderes als Fussball?
function eindeutig(woerter) {
  const c = woerter.join('');
  if (EINDEUTIG_NAMEN.has(c)) return true;
  if (woerter.length >= 2 && woerter.some(w => VEREINS_KUERZEL.has(w))) return true;          // FC Barcelona, Hamburger SV
  if (woerter.length >= 2 && woerter.some(w => /^\d{2,4}$/.test(w))) return true;               // Mainz 05, TSV 1860
  if (woerter.length === 1 && /^[A-Z]{4,}\d{2,4}$/.test(c)) return true;                         // HANNOVER96, SCHALKE04
  return false;
}
/**
 * Der Fussball-Bezug eines Designs: aus allen Texten zusammen (Eingaben, Motto-Name, Text im Bild).
 * { fussball: true/false, woerter: Set aller Woerter (fuer die Heimatstadt) }
 */
export function fussballKontext(texte) {
  const woerter = new Set();
  let compactAlles = '';
  for (const t of texte || []) {
    const n = normalize(t);
    if (!n) continue;
    for (const w of n.split(' ')) woerter.add(w);
    compactAlles += ' ' + n.replace(/\s+/g, '');
  }
  let fussball = false;
  for (const w of woerter) if (FUSSBALL_WORT.has(w)) { fussball = true; break; }
  if (!fussball) fussball = FUSSBALL_TEIL.some(t => compactAlles.includes(t));
  return { fussball, woerter };
}

export function markenStore(storeDir) {
  const file = path.join(storeDir, 'marken.json');
  let eigene = { wort: [], teil: [], frei: [] };   // frei = Ausnahmen, die der Chef bewusst erlaubt (z. B. eigener Amateurverein)
  let idx = null;

  function build() {
    const wort = new Set([...GRUNDSTOCK.wort, ...eigene.wort].map(compact).filter(Boolean));
    const teil = [...GRUNDSTOCK.teil, ...eigene.teil].map(compact).filter(Boolean);
    const frei = new Set((eigene.frei || []).map(compact).filter(Boolean));
    idx = { wort, teil, frei };
  }
  async function ready() {
    try { const j = JSON.parse(await fs.readFile(file, 'utf8')); eigene = { wort: j.wort || [], teil: j.teil || [], frei: j.frei || [] }; } catch (e) { /* nur Grundstock */ }
    build();
  }
  async function save(next) {
    const clean = (a) => (Array.isArray(a) ? a : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
    eigene = { wort: clean(next.wort), teil: clean(next.teil), frei: clean(next.frei) };
    await fs.writeFile(file, JSON.stringify(eigene, null, 2));
    build();
    return list();
  }
  function list() { return { grundstock: GRUNDSTOCK, eigene }; }

  // Woerter, die fuer EINE Pruefung frei sind: die Namen des Ortes bzw. Betriebs auf der Karte
  // ("Hotel Barca"). Ein Name zaehlt nur, wenn er selbst sauber ist (mit der Betriebs-Regel) - ein
  // nacktes "Barca" als Ortsname macht nichts frei. Frei werden nur EINZELNE Woerter daraus.
  function freiAusNamen(namen) {
    const out = new Set();
    for (const n of namen || []) {
      if (!n || pruefe(String(n), null)) continue;
      for (const w of normalize(n).split(' ')) if (w) out.add(w);
    }
    return out;
  }
  // Prueft einen Text. Rueckgabe: null (sauber) oder { wort, eingabe }
  // erlaubt: Namen von Ort/Betrieb der Karte (siehe freiAusNamen), freiwillig.
  // kontext: weitere Texte desselben Designs (andere Felder, Motto-Name, Text im Bild) - nur fuer den Fussball-Bezug.
  function check(text, erlaubt, kontext) { return pruefe(text, erlaubt && erlaubt.length ? freiAusNamen(erlaubt) : null, kontextFuer([text, ...(kontext || [])])); }
  function kontextFuer(texte) { return fussballKontext(texte); }
  // Ist dieser Treffer gesperrt? Produktmarken und eindeutige Vereinsnamen immer, der Rest nur mit Fussball-Bezug.
  function sperrt(woerter, schluessel, ctx) {
    if (!ctx) return true;
    if (PRODUKT_WORT.has(schluessel) || PRODUKT_TEIL.has(schluessel)) return true;
    if (eindeutig(woerter)) return true;
    if (ctx.fussball) return true;
    const staedte = VEREINS_STADT[schluessel] || [];
    return staedte.some(s => ctx.woerter.has(s) && !woerter.includes(s));
  }
  function pruefe(text, freiWoerter, ctx) {
    if (!idx) build();
    const eingabe = String(text || '');
    const norm = normalize(eingabe);
    if (!norm) return null;
    const c = compact(eingabe);
    if (idx.frei.has(c)) return null;
    const words = norm.split(' ');
    // 1) ganze Woerter und Wortfolgen (bis 4 Woerter), auch zusammengeschrieben
    for (let i = 0; i < words.length; i++) {
      for (let n = 1; n <= 4 && i + n <= words.length; n++) {
        const w = words.slice(i, i + n).join('');
        if (!idx.wort.has(w) || idx.frei.has(w)) continue;
        const folge = words.slice(i, i + n);
        if (n === 1 && !PRODUKT_WORT.has(w) && (BETRIEB.has(words[i - 1]) || BETRIEB.has(words[i + 1]))) continue;
        if (n === 1 && freiWoerter && freiWoerter.has(w)) continue;
        if (!sperrt(folge, w, ctx)) continue;
        return { wort: folge.join(' '), eingabe };
      }
    }
    // 2) Bestandteile ("Werderfan", "Borussen"). Ein Ortsname der Karte, der den Teil enthaelt, macht ihn frei.
    for (const t of idx.teil) {
      if (!c.includes(t)) continue;
      if (freiWoerter && [...freiWoerter].some(f => f.includes(t))) continue;
      if (!PRODUKT_TEIL.has(t) && words.some(w => w.includes(t) && (BETRIEB.has(words[words.indexOf(w) - 1]) || BETRIEB.has(words[words.indexOf(w) + 1])))) continue;
      // "Werderfan", "Bayernfans": das angehaengte "fan" ist der Fussball-Bezug.
      const alsFan = words.some(w => w.includes(t) && /FANS?$/.test(w.slice(w.indexOf(t) + t.length)));
      if (!alsFan && !sperrt([t], t, ctx)) continue;
      return { wort: t, eingabe };
    }
    return null;
  }
  function checkAll(texts, erlaubt, kontext) {
    const frei = erlaubt && erlaubt.length ? freiAusNamen(erlaubt) : null;
    const ctx = kontextFuer([...(texts || []), ...(kontext || [])]);
    for (const t of texts || []) { const hit = pruefe(t, frei, ctx); if (hit) return hit; }
    return null;
  }
  // Fuer die Bild-QA: liest den erkannten Text im Bild (Liste von Strings). Die Bild-KI meldet
  // "HOTEL" und "BARCA" oft als zwei Texte, darum zaehlt hier auch der Ortsname der Karte.
  function checkImageTexts(texts, erlaubt, kontext) { return checkAll(texts, erlaubt, kontext); }

  // Fuer die Bild-QA: Logos/Wappen, die die Bild-KI gemeldet hat.
  // Jeder Eintrag: { beschreibung, echt (echte oder nachempfundene Marke/Verein), name (erkannter Name), sicher }
  // Gesperrt, wenn (a) der erkannte Name in der Wortliste steht (auch bei unsicherer Erkennung) oder
  // (b) die KI sich sicher ist, dass es ein echtes Vereins-/Markenzeichen ist - egal welches.
  // Ausnahme: der erkannte Name steht in "frei" (z. B. der eigene Amateurverein).
  // 20. Sept. (Befund der Pruef-Sitzung, hier nachgestellt): Die Bild-KI meldet eine
  // Nationalflagge als "echtes Zeichen, sicher" - und Regel (b) sperrte sie als Marke. Eine
  // Landes-, Staats- oder Stadtflagge ist keine Marke. Sie faellt nur, wenn ihr Name selbst in
  // der Wortliste steht (Regel a), nie ueber Regel (b).
  const FLAGGE = /\bflags?\b|flagge|fahne|tricolou?r|national colou?rs|bundesflagge|banner|drapeau|bandera|union jack|stars and stripes/i;
  function checkLogos(logos) {
    if (!idx) build();
    for (const l of logos || []) {
      if (!l || typeof l !== 'object') continue;
      const name = String(l.name || '').trim();
      const beschreibung = String(l.beschreibung || '').trim();
      if (name && idx.frei.has(compact(name))) continue;
      // Ein erkanntes Wappen IST Fussball-Bezug: hier gilt die strenge Pruefung ohne Kontext.
      const byName = name ? pruefe(name, null, null) : null;
      if (byName) return { wort: byName.wort, beschreibung, name };
      const byDesc = beschreibung ? pruefe(beschreibung, null, null) : null;
      if (byDesc) return { wort: byDesc.wort, beschreibung, name };
      if (FLAGGE.test(beschreibung) || FLAGGE.test(name)) continue;
      if (l.echt === true && l.sicher === true) return { wort: name || 'echtes Vereins-/Markenzeichen', beschreibung, name };
    }
    return null;
  }

  // Geschuetzte Woerter aus einem Freitext entfernen (z. B. Recherche-Steckbrief): jede Fundstelle wird zu "the club"
  function scrub(text) {
    const tokens = String(text || '').split(/(\s+)/);   // Woerter und Trenner behalten
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      if (/^\s+$/.test(tokens[i]) || !tokens[i]) { out.push(tokens[i]); continue; }
      let hit = false;
      // Wortfolgen bis 4 Woerter (Trenner ueberspringen)
      for (let n = 4; n >= 1 && !hit; n--) {
        const idxs = []; let j = i;
        while (idxs.length < n && j < tokens.length) { if (!/^\s+$/.test(tokens[j]) && tokens[j]) idxs.push(j); j++; }
        if (idxs.length < n) continue;
        const phrase = idxs.map(k => tokens[k]).join(' ');
        const h = check(phrase);
        if (h && (compact(h.wort) === compact(phrase) || (n === 1 && compact(phrase).includes(compact(h.wort))))) { out.push('the club'); i = idxs[idxs.length - 1]; hit = true; }
      }
      if (!hit) out.push(tokens[i]);
    }
    return out.join('');
  }

  return { ready, save, list, check, checkAll, checkImageTexts, checkLogos, scrub, normalize };
}
