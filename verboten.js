// Verbotene Zeichen und Parolen: Hakenkreuz, SS-Runen, NS-Parolen, Kennzeichen verbotener
// Organisationen, Volksverhetzung.
//
// Warum eigenes Modul und nicht einfach in marken.js dazu:
// Die Markensperre laesst sich je Motto abschalten (markenfrei) - Handwerker duerfen ihr
// Firmenlogo drucken, Fanclubs ihr Vereinswappen. DIESE Sperre darf sich NIE abschalten
// lassen, auch nicht fuer Fanclub, auch nicht fuer den Chef im Backend. Waeren beide Listen
// ein Modul, haette ein Schalter frueher oder spaeter beide erwischt.
//
// Rechtlicher Hintergrund (kurz): § 86a StGB verbietet das Verbreiten von Kennzeichen
// verfassungswidriger und terroristischer Organisationen, § 130 StGB die Volksverhetzung.
// Ein bedrucktes Textil ist Verbreiten. Das trifft den Druckenden, nicht nur den Besteller -
// darum haengt die Pruefung nicht am Kunden, sondern an der Produktion.
//
// Drei Stellen, an denen geprueft wird:
//   1. jede Kundeneingabe und jeder Name (Text)
//   2. das fertig gezeichnete Bild (Bild-KI meldet erkannte Symbole)   -> pruefeSymbole
//   3. das hochgeladene Kundenlogo, bevor es in die Druckdatei kommt   -> pruefeSymbole
//
// Die Liste im Code ist der Grundstock und laesst sich NICHT loeschen. Im Backend kann man
// nur ERGAENZEN (storage/verboten.json). Bewusst keine Freigabe-Liste wie bei den Marken:
// fuer ein Hakenkreuz gibt es keinen legitimen Anwendungsfall auf einem Partyshirt.

import fs from 'node:fs/promises';
import path from 'node:path';

// --- Was NICHT auf der Liste steht, und warum -------------------------------
// "88", "18", "HH", "Totenkopf", "Triskele", "Schwarze Sonne" als nackte Zahl/Wort:
// Das sind im Alltag voellig harmlose Angaben - Rueckennummer 88, 18. Geburtstag, Hamburg,
// der Totenkopf auf jedem zweiten Motorradshirt. Wer sie pauschal sperrt, wirft hunderte
// echte Bestellungen weg und faengt den Taeter trotzdem nicht, weil der ausweicht.
// Gesperrt wird darum die eindeutige KOMBINATION (1488, "Heil 88") - und das Bild selbst
// uebernimmt den Rest: eine schwarze Sonne erkennt man am Motiv, nicht am Wort.
export const GRUNDSTOCK = {
  // Trifft als ganzes Wort oder ganze Wortfolge
  wort: [
    // NS-Parolen und Grussformeln
    'SIEG HEIL', 'SIEGHEIL', 'HEIL HITLER', 'HEIL DEM FUEHRER', 'MIT DEUTSCHEM GRUSS',
    'MEINE EHRE HEISST TREUE', 'BLUT UND EHRE', 'BLOOD AND HONOUR', 'BLOOD AND HONOR',
    'DEUTSCHLAND ERWACHE', 'RUHM UND EHRE DER WAFFEN SS', 'ALLES FUER DEUTSCHLAND',
    'ARBEIT MACHT FREI', 'JEDEM DAS SEINE', 'UNSERE EHRE HEISST TREUE',
    'EIN VOLK EIN REICH EIN FUEHRER', 'DEUTSCHLAND DEN DEUTSCHEN', 'AUSLAENDER RAUS',
    // Bewusst NICHT "der Fuehrer": "Der Fuehrerschein ist da!" ist ein voellig normales
    // Shirt und wuerde sonst gesperrt. Die eindeutigen Faelle fangen die Eintraege darueber.
    // Verbotene bzw. verfassungsfeindliche Organisationen und ihre Kuerzel
    'NSDAP', 'WAFFEN SS', 'HITLERJUGEND', 'HITLER JUGEND', 'BUND DEUTSCHER MAEDEL',
    'GESTAPO', 'REICHSSICHERHEITSHAUPTAMT', 'DRITTES REICH', 'TAUSENDJAEHRIGES REICH',
    'COMBAT 18', 'COMBAT18', 'BLOOD HONOUR', 'HAMMERSKINS', 'HAMMERSKIN',
    // "Nordadler" ist zwar eine verbotene Gruppierung, aber auch ein voellig normaler
    // Vereinsname (Segelclub, Schuetzenverein). Zu unspezifisch fuer eine harte Sperre.
    'ATOMWAFFEN DIVISION', 'WEISSE WOELFE TERRORCREW',
    'SKINHEADS SAECHSISCHE SCHWEIZ', 'NATIONALSOZIALISTISCHER UNTERGRUND', 'COMBAT EIGHTEEN',
    // Terrororganisationen. Bewusst NICHT das blosse "ISIS" (aegyptische Goettin, auch ein
    // Vorname) und nicht "Bozkurt" (haeufiger tuerkischer Familienname) - die ausgeschriebenen
    // Namen daneben treffen den Fall, ohne jemanden mit diesem Namen abzuweisen.
    // 6. Okt., Markus ("Hast du eigentlich auch alle Woerter, die auf dem Index stehen?" - "Ja"): weitere verbotene
    // Organisationen (Bundesinnenministerium / Verfassungsschutz) und eindeutige Szene-Codes. Nur, was als Wortfolge
    // nichts Harmloses bedeuten kann - alles Mehrdeutige (Zahlen, "Landser", "ZOG") prueft die Text-KI im Zusammenhang.
    'HEIMATTREUE DEUTSCHE JUGEND', 'WIKING JUGEND', 'FREIHEITLICHE DEUTSCHE ARBEITERPARTEI',
    'NATIONALISTISCHE FRONT', 'STURMBRIGADE 44', 'FEUERKRIEG DIVISION', 'GEEINTE DEUTSCHE VOELKER UND STAEMME',
    'HAMMERSKINS DEUTSCHLAND', 'BLOOD AND HONOUR DIVISION DEUTSCHLAND',
    'HKNKRZ', 'WHITE POWER', 'WHITE PRIDE WORLD WIDE', 'WPWW', 'RAHOWA', 'RACIAL HOLY WAR',
    'BLUT UND BODEN', 'HOONARA',
    'ISLAMISCHER STAAT', 'DAESH', 'AL QAIDA', 'ALQAIDA', 'AL KAIDA',
    'HISBOLLAH', 'HIZBOLLAH', 'TALIBAN', 'GRAUE WOELFE',
    // Zahlencodes - nur die eindeutigen Kombinationen, siehe Erklaerung oben
    '1488', '14 88', '8814', '88 14', '14 WORDS', 'FOURTEEN WORDS', '168 1',
    'HEIL 88', '88 HEIL', 'SIEG 88', 'C18',
    // Personen, deren Name auf einem Textil nur eine Aussage haben kann
    'ADOLF HITLER', 'HEINRICH HIMMLER', 'JOSEPH GOEBBELS', 'HERMANN GOERING',
    'RUDOLF HESS', 'REINHARD HEYDRICH', 'JOSEF MENGELE', 'ADOLF EICHMANN',
    // Zeichen, die man auch ausschreibt
    'HAKENKREUZ', 'SWASTIKA', 'SS RUNE', 'SS RUNEN', 'SIGRUNE', 'SIEGRUNE',
    'WOLFSANGEL', 'ODALRUNE', 'SCHWARZE SONNE', 'SONNENRAD SS', 'REICHSKRIEGSFLAGGE',
    'REICHSADLER MIT HAKENKREUZ'
  ],
  // Trifft auch als Bestandteil eines laengeren Wortes - nur bei Begriffen, die sonst
  // durch Zusammenschreiben durchrutschen wuerden ("Hakenkreuzfahne", "SiegHeil2026")
  teil: [
    'HAKENKREUZ', 'SIEGHEIL', 'HEILHITLER', 'MEINEEHREHEISSTTREUE', 'BLUTUNDEHRE',
    'ARBEITMACHTFREI', 'DEUTSCHLANDERWACHE', 'ALLESFUERDEUTSCHLAND', 'SCHWARZESONNE',
    'COMBAT18', 'HAMMERSKIN', 'ADOLFHITLER', 'WAFFENSS', 'AUSLAENDERRAUS', '1488', 'WHITEPOWER', 'BLUTUNDBODEN'
  ]
};

// Dasselbe Auffalten wie in marken.js: Umlaute, Sonderzeichen und Schreibweisen egal.
// Zusaetzlich die Ziffernersetzungen (Leetspeak), mit denen Sperren gern umgangen werden:
// "H€IL", "S1EG", "N4ZI".
export function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
    .replace(/[ÀÁÂÃÅ]/g, 'A').replace(/[ÈÉÊË€]/g, 'E').replace(/[ÌÍÎÏ]/g, 'I')
    .replace(/[ÒÓÔÕØ]/g, 'O').replace(/[ÙÚÛ]/g, 'U').replace(/Ç/g, 'C').replace(/Ñ/g, 'N')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}
// Fuer den Vergleich zusaetzlich Leetspeak aufloesen. NUR hier, nicht in normalize:
// sonst wuerde aus der harmlosen Eingabe "Klasse 10B" beim Anzeigen "Klasse 1OB".
function entleet(s) {
  return String(s || '')
    .replace(/0/g, 'O').replace(/1/g, 'I').replace(/3/g, 'E').replace(/4/g, 'A')
    .replace(/5/g, 'S').replace(/7/g, 'T').replace(/9/g, 'G');
}
const compact = (s) => normalize(s).replace(/\s+/g, '');

export function verbotenStore(storeDir) {
  const file = path.join(storeDir, 'verboten.json');
  let eigene = { wort: [], teil: [] };   // bewusst KEINE "frei"-Liste
  let idx = null;

  function build() {
    // Jeder Eintrag zweimal: einmal wie geschrieben, einmal mit aufgeloestem Leetspeak.
    // So trifft "1488" weiter als Zahl und "H31L H1TL3R" trotzdem auch.
    const wort = new Set();
    for (const w of [...GRUNDSTOCK.wort, ...eigene.wort]) {
      const c = compact(w); if (!c) continue;
      wort.add(c); wort.add(entleet(c));
    }
    const teil = [];
    for (const t of [...GRUNDSTOCK.teil, ...eigene.teil]) {
      const c = compact(t); if (!c) continue;
      teil.push(c); if (entleet(c) !== c) teil.push(entleet(c));
    }
    // Auseinandergezogen geschrieben ("S I E G  H E I L", "H-A-K-E-N-K-R-E-U-Z") faellt durch
    // jede Wortpruefung, weil jeder Buchstabe ein eigenes Wort ist. Darum wird der komplett
    // zusammengezogene Text zusaetzlich als Ganzes durchsucht - aber nur nach Eintraegen ab
    // 8 Zeichen. Kuerzere ("ISIS", "C18", "1488") wuerden so in harmlosen Woertern auftauchen.
    const lang = [...wort].filter(w => w.length >= 8);
    idx = { wort, teil, lang };
  }
  async function ready() {
    try { const j = JSON.parse(await fs.readFile(file, 'utf8')); eigene = { wort: j.wort || [], teil: j.teil || [] }; }
    catch (e) { /* nur Grundstock */ }
    build();
  }
  // Speichern kann nur ERGAENZEN. Der Grundstock bleibt immer drin - er laesst sich
  // ueber das Backend nicht wegkonfigurieren, auch nicht versehentlich.
  async function save(next) {
    const clean = (a) => (Array.isArray(a) ? a : []).map(x => String(x).trim()).filter(Boolean).slice(0, 500);
    eigene = { wort: clean(next && next.wort), teil: clean(next && next.teil) };
    await fs.writeFile(file, JSON.stringify(eigene, null, 2));
    build();
    return list();
  }
  function list() { return { grundstock: GRUNDSTOCK, eigene }; }

  /** Prueft einen Text. null = sauber, sonst { wort, eingabe }. */
  function pruefeText(text) {
    if (!idx) build();
    const eingabe = String(text || '');
    const norm = normalize(eingabe);
    if (!norm) return null;
    const woerter = norm.split(' ');
    // Wortfolgen bis 6 Woerter - "meine ehre heisst treue" sind allein schon vier
    for (let i = 0; i < woerter.length; i++) {
      for (let n = 1; n <= 6 && i + n <= woerter.length; n++) {
        const w = woerter.slice(i, i + n).join('');
        if (idx.wort.has(w) || idx.wort.has(entleet(w))) return { wort: woerter.slice(i, i + n).join(' '), eingabe };
      }
    }
    const c = compact(eingabe), cl = entleet(c);
    for (const t of idx.teil) if (c.includes(t) || cl.includes(t)) return { wort: t, eingabe };
    // Letzte Runde: der ganze Text ohne Leerzeichen gegen die langen Eintraege
    for (const t of idx.lang) if (c.includes(t) || cl.includes(t)) return { wort: t, eingabe };
    return null;
  }
  function pruefeTexte(texte) {
    for (const t of texte || []) { const hit = pruefeText(t); if (hit) return hit; }
    return null;
  }

  /**
   * Fuer Bild und hochgeladenes Logo: die Bild-KI meldet, welche Symbole sie sieht.
   * Jeder Eintrag: { art, beschreibung, sicher }
   * Hier wird bewusst schon bei "unsicher" gesperrt: ein faelschlich abgelehntes
   * Partyshirt kostet einen neuen Lauf, ein faelschlich gedrucktes Hakenkreuz kostet
   * eine Anzeige. Die Abwaegung ist nicht symmetrisch.
   */
  function pruefeSymbole(symbole) {
    for (const s of symbole || []) {
      if (!s || typeof s !== 'object') continue;
      const art = String(s.art || '').trim();
      const beschreibung = String(s.beschreibung || '').trim();
      if (!art && !beschreibung) continue;
      return { wort: art || 'verbotenes Zeichen', beschreibung };
    }
    return null;
  }

  return { ready, save, list, pruefeText, pruefeTexte, pruefeSymbole, normalize };
}
