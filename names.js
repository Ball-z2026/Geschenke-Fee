import sharp from 'sharp';
import { platzFuerText } from './images.js';
import { dominantColors } from './images.js';
import { istHell } from './mottos.js';

// Namensliste: ein Design, viele Namen. Der Name wird NICHT von der KI gemalt, sondern als
// Schriftzug in ein freigehaltenes Band gesetzt - so bleibt das Design bei jedem Namen gleich.
// 23. Sept. - zwei Fehler auf einmal, beide gefunden, weil Markus sagte: "Wir haben auch das
// Problem mit dem Namen und dem Design von vorne bei Abi noch nicht wirklich fertig."
//
// ERSTENS: Hier standen 'Poppins', 'DejaVu Sans Condensed' und 'TeX Gyre Bonum'. KEINE dieser
// Schriften war im Container installiert - das Dockerfile bringt kein Schriftpaket mit, und in
// fonts/ lagen nur .woff2-Dateien, die fontconfig nicht liest. Alle drei Kundenwahlen landeten
// also bei derselben Ersatzschrift; unterschiedlich war nur die Groesse, weil ratio sich
// unterscheidet. Jetzt liegen echte .ttf im Repo (fonts/, OFL bzw. Apache 2.0).
//
// ZWEITENS: Die Schrift des Namens hatte mit dem Stil des Designs nichts zu tun. Unter einem
// 70er-Siebdruck stand ein glatter moderner Grotesk mit scharfen Kanten - wie danebengeklebt.
// Darum entscheidet ab jetzt der STIL die Schrift (STIL_SCHRIFT), genau wie er das Textil
// entscheidet. Die drei Kundenwahlen bleiben fuer Mottos ohne Stil.
export const NAME_FONTS = {
  rund:    { label: 'Rund & kräftig',      family: 'Archivo',          weight: 800, ratio: 0.62 },
  schmal:  { label: 'Schmal & hoch',       family: 'Anton',            weight: 400, ratio: 0.46 },
  serif:   { label: 'Klassisch (Serifen)', family: 'Playfair Display', weight: 800, ratio: 0.60 },
  // Nicht in der Kundenauswahl - diese kommen ueber den Stil.
  slab:    { label: 'Slab',    family: 'Alfa Slab One',    weight: 400, ratio: 0.78, intern: true },
  comic:   { label: 'Comic',   family: 'Bangers',          weight: 400, ratio: 0.52, intern: true },
  techno:  { label: 'Techno',  family: 'Orbitron',         weight: 800, ratio: 0.78, intern: true },
  marker:  { label: 'Marker',  family: 'Permanent Marker', weight: 400, ratio: 0.55, intern: true },
  western: { label: 'Western', family: 'Rye',              weight: 400, ratio: 0.70, intern: true }
};

/**
 * Welche Schrift gehoert zum Namen, wenn ein Stil gewaehlt ist?
 * Dieselbe Logik wie beim Textil: der Stil bringt seine Handschrift mit, und der Name gehoert
 * zum Design - nicht daneben. Die Begruendung steht je Zeile.
 */
export const STIL_SCHRIFT = {
  vintage:     'slab',     // 70er-Siebdruck: die dicken Slab-Serifen der Zeit
  college:     'slab',     // Varsity lebt vom Slab-Block
  tattoo:      'western',  // Old-School-Flash: Western-Display im Spruchband
  comic:       'comic',    // handgeletterter Comic-Titel
  popart:      'comic',    // Ben-Day-Raster und Comic-Lettering gehoeren zusammen
  streetart:   'marker',   // Marker und Spraydose
  graffiti:    'marker',
  neon:        'techno',   // Leuchtroehren brauchen eine geometrische Techno-Schrift
  robotic:     'techno',
  meisterwerk: 'serif',    // gemalt und elegant
  aquarell:    'serif',
  japan:       'serif',    // Holzschnitt: Serifen stehen der Pinselschrift naeher als ein Grotesk
  minimal:     'rund',     // klar und ruhig, ohne Ornament
  fotoreal:    'schmal'    // schwere, schmale Blockschrift wie auf einem Filmplakat
};

/** Die Schrift fuer diesen Auftrag: der Stil schlaegt die Kundenwahl. */
export function schriftFuerStil(style, wahl) {
  const ausStil = STIL_SCHRIFT[style];
  if (ausStil && NAME_FONTS[ausStil]) return ausStil;
  return NAME_FONTS[wahl] ? wahl : 'rund';
}
export const NAME_ZONES = ['oben', 'unten'];
export const MAX_NAMES = 100;

const NEUTRAL = ['white', 'black', 'grey', 'silver', 'cream'];
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

// Zusatz fuer den Master-Prompt: Band freihalten
// Fassung 54: Der Name soll auf ein Kleidungsstueck im Motiv. Dafuer braucht es eine Figur mit
// einer grossen, glatten, einfarbigen Flaeche - der Ruecken eines Shirts von hinten gesehen.
export const NAME_TRAEGER_MENSCHEN = [
  'one person in the centre is seen FROM BEHIND so that the whole back of their shirt faces the viewer',
  'one person in the scene holds up a smooth blank board or sign with both hands',
  'a figure of the scene wears a sports jersey seen from the back, its back panel smooth and blank'
];
export const NAME_TRAEGER_ALLE = [
  'a smooth blank banner or ribbon is stretched across a part of the scene',
  'a smooth blank sign, plate or board is part of the scene and clearly visible',
  'a blank rectangular label, tag or plaque hangs on an object of the scene',
  'the flat blank side of a main object of the scene faces the viewer like a panel',
  'a blank screen, display or scoreboard belonging to the scene faces the viewer'
];
// Fassung 54 (Markus, 16. Sept.: "es muss nicht zwangslaeufig auf das Shirt sein"): Irgendetwas im
// Motiv traegt den Namen - ein Ruecken, ein Schild, ein Banner, die glatte Seite eines Gegenstands.
// Entscheidend ist nur, dass die Flaeche gross, glatt und EINFARBIG bleibt: dort wird der Name
// spaeter hineingesetzt, und das geht nur auf ruhigem Grund.
export function nameImMotivPrompt(traeger) {
  const t = traeger || NAME_TRAEGER_ALLE[0];
  return `A NAME IS PRINTED INTO THE ARTWORK AFTERWARDS. Therefore: ${t}. That surface is one large, smooth, EVENLY COLOURED area in a single flat colour - no print, no pattern, no logo, no lettering, no seams, no folds, no shading and no texture inside it. It is at least a quarter of the picture wide, broader than it is tall, and it stays completely bare. Everything around it can be as rich and detailed as you like. Do not leave an empty band at the bottom of the composition - the artwork fills its own shape.`;
}
export function nameTraegerFuer(mitMenschen) {
  const liste = mitMenschen ? NAME_TRAEGER_ALLE.concat(NAME_TRAEGER_MENSCHEN) : NAME_TRAEGER_ALLE;
  return liste[Math.floor(Math.random() * liste.length)];
}

export function nameZonePrompt(zone) {
  const where = zone === 'oben' ? 'top' : 'bottom';
  return `Leave a clear empty horizontal band across the whole width at the very ${where} of the composition, about 14 percent of the height: a personal name is typeset there afterwards. Do not draw any text, banner, ribbon, line or ornament inside that band - it stays completely empty transparent background.`;
}

// Namen saeubern: Zeilen/Kommas/Semikolons trennen, Duplikate raus, Laenge begrenzen
// Nicht druckbare Zeichen (Emojis usw.) werden entfernt, nicht abgelehnt; 'changed' listet die Faelle.
export function cleanNames(input, max) {
  let raw = Array.isArray(input) ? input.flatMap(x => String(x || '').split(/[\n;,]/)) : String(input || '').split(/[\n;,]/);
  // Alles in einer Zeile getippt ("Lasse Marcus Tim Tobi")? Ab vier Woertern in einem Eintrag sind es einzelne Namen.
  if (raw.filter(x => x.trim()).length === 1 && raw.join(' ').trim().split(/\s+/).length >= 4) raw = raw.join(' ').trim().split(/\s+/);
  const out = [];
  const changed = [];
  const seen = new Set();
  for (let n0 of raw) {
    const orig = String(n0 || '').replace(/\s+/g, ' ').trim();
    if (!orig) continue;
    // 1. Okt.: "…" (ein Zeichen, macht das iPhone aus drei Punkten) wird zu "...". Emojis bleiben
    // hier draussen - Namen setzen wir selbst in einer Schrift, die keine hat.
    let n = orig.replace(/…/g, '...').replace(/[^\p{L}\p{N} .,'’\-&+!?/()]/gu, '').replace(/\s+/g, ' ').trim().slice(0, Math.min(+max || 24, 40));
    if (!n) { changed.push({ vorher: orig, nachher: '' }); continue; }
    if (n !== orig) changed.push({ vorher: orig, nachher: n });
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(n);
    if (out.length >= MAX_NAMES) break;
  }
  return { names: out, changed };
}

// Bestell-Infos je Person: eine Zeile = "Name, Groesse, Artikel" (Excel-Spalten Name/Groesse/Artikel).
// Aendert NICHT die Namensdarstellung - liefert zusaetzlich groesse/artikel je Name.
const SIZE_MAP = { XS: 'XS', S: 'S', M: 'M', L: 'L', XL: 'XL', XXL: 'XXL', '2XL': 'XXL', '3XL': '3XL', XXXL: '3XL', '4XL': '4XL', '5XL': '5XL' };
function normSize(v) {
  const s = String(v || '').toUpperCase().replace(/GR(Ö|OE)SSE|GR\.?|SIZE/g, '').replace(/[^A-Z0-9]/g, '').trim();
  if (!s) return '';
  if (SIZE_MAP[s]) return SIZE_MAP[s];
  if (/^\d{2,3}$/.test(s)) return s;            // Kindergroessen wie 116, 128
  return '';
}
function normGarment(v) {
  const s = String(v || '').toLowerCase();
  if (/hoodie|pulli|pullover|kapuz/.test(s)) return 'Hoodie';
  if (/zip/.test(s)) return 'Zip-Jacke';
  if (/shirt|tee|t-?shirt/.test(s)) return 'T-Shirt';
  return '';
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function normEmailLocal(v) { const s = String(v || '').trim().toLowerCase(); return EMAIL_RE.test(s) ? s : null; }
// Handynummer nach E.164 (Standard Deutschland): +49..., 0049..., 0... -> +49...
function normPhone(v) {
  let s = String(v || '').replace(/[\s\-()/.]/g, '');
  if (!/^(\+|00|0)?\d{6,15}$/.test(s)) return null;
  if (s.startsWith('+')) return '+' + s.slice(1).replace(/\D/g, '');
  if (s.startsWith('00')) return '+' + s.slice(2);
  if (s.startsWith('0')) return '+49' + s.slice(1);
  return '+' + s; // schon mit Laendercode ohne +
}
function normRole(v) {
  const s = String(v || '').trim().toLowerCase();
  if (/^(orga|orga-?team|organisation|team)$/.test(s)) return 'orga';
  if (/^(abstimmung|teilnehmer|voter)$/.test(s)) return 'teilnehmer';
  return null;
}
const HEAD_WORD = /^(name|namen|vorname|nachname|spieler|teilnehmer|mitarbeiter|person)$/i;
function isHeaderLine(parts, first) {
  const low = parts.map(p => p.toLowerCase());
  if (low.some(p => HEAD_WORD.test(p)) && low.some(p => /mail|e-mail|handy|telefon|nummer|rolle|role|gr(ö|oe)(ss|ß)e|gr\.|size|artikel|teil/.test(p))) return true;
  // Erste Zeile nur "Name" o. Ae. (Kopfzeile einer Ein-Spalten-Liste)
  return !!first && parts.length === 1 && HEAD_WORD.test(parts[0]);
}
// Personenliste einlesen. Erste Spalte = Name; alle weiteren Spalten werden anhand ihres
// Inhalts erkannt (E-Mail, Handy, Rolle, Groesse, Artikel) - Reihenfolge egal. Kopfzeile wird uebersprungen.
export function parsePeople(input, max) {
  let lines = Array.isArray(input) ? input.slice() : String(input || '').split(/\r?\n/);
  // Fallback: alles in einer Zeile ohne Trenner, viele Woerter -> einzelne Namen (nur Namen)
  const nonEmpty = lines.filter(x => String(x).trim());
  if (nonEmpty.length === 1 && !/[;,\t]/.test(nonEmpty[0]) && String(nonEmpty[0]).trim().split(/\s+/).length >= 4) {
    lines = String(nonEmpty[0]).trim().split(/\s+/);
  }
  const people = [], changed = [], seen = new Set(), seenContact = new Set();
  for (const line of lines) {
    const raw = String(line || '');
    if (!raw.trim()) continue;
    const parts = raw.split(/[;,\t]/).map(s => s.trim()).filter(s => s !== '');
    if (!parts.length) continue;
    if (isHeaderLine(parts, !people.length)) continue;
    const nameOrig = (parts[0] || '').replace(/\s+/g, ' ').trim();
    if (!nameOrig) continue;
    const name = nameOrig.replace(/[^\p{L}\p{N} .,'’\-&+!?/()]/gu, '').replace(/\s+/g, ' ').trim().slice(0, Math.min(+max || 24, 40));
    if (!name) { changed.push({ vorher: nameOrig, nachher: '' }); continue; }
    if (name !== nameOrig) changed.push({ vorher: nameOrig, nachher: name });
    // Restspalten inhaltsbasiert klassifizieren
    let email = null, phone = null, role = null, size = '', garment = '';
    for (const p of parts.slice(1)) {
      if (!email && normEmailLocal(p)) { email = normEmailLocal(p); continue; }
      if (!role && normRole(p)) { role = normRole(p); continue; }
      if (!size && normSize(p)) { size = normSize(p); continue; }
      if (!garment && normGarment(p)) { garment = normGarment(p); continue; }
      if (!phone && normPhone(p)) { phone = normPhone(p); continue; }
    }
    // Duplikate: nach Kontakt (E-Mail/Handy) wenn vorhanden, sonst nach Name|Groesse|Artikel
    const contactKey = email ? 'e:' + email : (phone ? 'p:' + phone : null);
    if (contactKey) { if (seenContact.has(contactKey)) continue; seenContact.add(contactKey); }
    const k = (name + '|' + size + '|' + garment).toLowerCase();
    if (!contactKey && seen.has(k)) continue;
    seen.add(k);
    people.push({ name, size, garment, email, phone, role: role || 'teilnehmer' });
    if (people.length >= MAX_NAMES) break;
  }
  return { people, names: people.map(p => p.name), changed };
}

// Zusatz fuer den Rueckseiten-Prompt: grossen unteren Bereich fuer die Namensliste freihalten.
// 23. Sept., Markus: "Das Rueckseite-Design darf ruhig ein bisschen fetziger sein, nicht nur
// einfach das Motiv von vorne obendrueber gelegt."
// Hier stand: "keep the LOWER 60 percent empty ... put the headline only in the upper 40 percent."
// Das erlaubte genau eine Bauform - Bild oben, Loch unten - und verbot alles, was eine Rueckseite
// interessant macht: einen Abschluss unten, schmale Bordueren an den Seiten. Der neue backPrompt
// bestellt beides, und dann haette hier das Verbot dagegengestanden: ein Auftrag, der sich selbst
// widerspricht. Jetzt wird nicht mehr der untere Teil freigehalten, sondern ein KORRIDOR in der
// Mitte - und renderNameList misst genau diesen Korridor, statt "alles unterhalb des Motivs".
export function nameListZonePrompt() {
  return 'IMPORTANT - THE MIDDLE BELONGS TO THE NAMES: keep a continuous empty, transparent corridor across the central 76 percent of the width, running at least half the height of the canvas, absolutely free. A list of many names is typeset into it afterwards. Draw no text, no names, no lines, no boxes, no ribbons and no ornaments inside that corridor. Everything you draw belongs ABOVE it, BELOW it, or in the narrow margins to its left and right - and nothing may reach into it.';
}

// Alle Namen als Liste in den unteren Bereich der Rueckseite setzen (echter Text, nicht von der KI gemalt).
// Gleiche Kontur-Optik wie renderName. Spaltenanzahl richtet sich nach der Namensmenge.
export async function renderNameList(masterPng, names, opts = {}) {
  const list = (Array.isArray(names) ? names : []).map(n => String(n || '').trim()).filter(Boolean);
  if (!list.length) return masterPng;
  const meta = await sharp(masterPng).metadata();
  const W = meta.width, H = meta.height;
  // Der Stil des Designs bestimmt die Schrift des Namens; ohne Stil gilt die Kundenwahl.
  const font = NAME_FONTS[schriftFuerStil(opts.style, opts.font)] || NAME_FONTS.rund;

  // Bereich fuer die Liste (Vorgabe: untere 60 %)
  let zoneTop = Math.round(H * (opts.topPct != null ? opts.topPct : 0.38));
  let zoneH = Math.round(H * (opts.heightPct != null ? opts.heightPct : 0.56));
  let padX = Math.round(W * 0.07);
  let usableW = W - padX * 2;
  // Eine gerahmte Rueckseite hat auch unten Motiv - dann darf die Liste nicht bis zum
  // Blattrand aufgezogen werden, sonst laeuft die letzte Zeile in den Abschluss hinein.
  let gerahmt = false;

  // 23. Sept.: Der Prompt BESTELLT die unteren 60 Prozent leer - geliefert wird das nicht immer.
  // Beim Abi-Beispiel reichte das Motiv bis 53 Prozent hinunter, und die ersten drei Zeilen
  // lagen auf dem Schriftzug. renderName() misst sein Band laengst und schafft notfalls Platz;
  // die Liste hat das nie getan. Also wird jetzt auch hier gemessen, wo das Motiv wirklich
  // endet, statt es zu glauben.
  try {
    const probeH = 240;
    const { data, info } = await sharp(masterPng).ensureAlpha()
      .resize({ width: 120, height: probeH, fit: 'fill', kernel: 'nearest' })
      .raw().toBuffer({ resolveWithObject: true });
    // 23. Sept., Markus: "Das Rueckseite-Design darf ruhig ein bisschen fetziger sein, nicht
    // nur einfach das Motiv von vorne obendrueber gelegt." Eine Rueckseite, die die Liste
    // RAHMT - Kopf oben, schmale Bordueren links und rechts, ein Abschluss unten - hat aber
    // auch unten und an den Seiten Motiv. "Alles unterhalb des Motivs" taugt dann nicht mehr
    // als Regel. Gemessen wird deshalb der freie KORRIDOR in der Mitte: eine Zeile gilt als
    // frei, wenn die mittleren 76 Prozent leer sind - die Bordueren am Rand stoeren nicht.
    // 16 Prozent, nicht 12: gemessen an der ersten gerahmten Rueckseite reichten die
    // Sternenleisten bis 14 Prozent herein, und bei 12 Prozent fand die Messung deshalb gar
    // keinen freien Korridor. Bei 16 Prozent liegen 42 Prozent Hoehe frei.
    const RAND = 0.16;
    const korrVon = Math.round(info.width * RAND), korrBis = Math.round(info.width * (1 - RAND));
    const freiInZeile = (y) => {
      let n = 0;
      for (let x = korrVon; x < korrBis; x++) if (data[(y * info.width + x) * 4 + 3] > 40) n++;
      return n / (korrBis - korrVon) <= 0.02;
    };
    // Der laengste zusammenhaengende freie Lauf ist der Platz fuer die Namen.
    let besterAb = -1, besteLaenge = 0, ab = -1;
    for (let y = 0; y <= info.height; y++) {
      const frei = y < info.height && freiInZeile(y);
      if (frei && ab < 0) ab = y;
      if (!frei && ab >= 0) { if (y - ab > besteLaenge) { besteLaenge = y - ab; besterAb = ab; } ab = -1; }
    }
    let korridorOben = besterAb >= 0 ? Math.round(besterAb / info.height * H) : H;
    let korridorHoehe = Math.round(besteLaenge / info.height * H);
    // 2. Okt., Abi-Rueckseite (Wellen und Kirschblueten als Rahmen): die Seitenleisten reichten
    // ueber 16 Prozent herein, die Messung oben fand keinen Korridor, und die Namen landeten
    // UNTER dem Rahmen, waehrend sein Inneres leer blieb. Zweite Messung: je Zeile von der Mitte
    // aus nach links und rechts, bis Motiv kommt - der freie Innenraum eines Rahmens, wie breit
    // die Leisten auch sind. Er zaehlt, wenn er mindestens 40 Prozent der Breite hat.
    let innenVon = 0, innenBis = 0;
    {
      const mitte = Math.floor(info.width / 2);
      const belegt = (x, y) => data[(y * info.width + x) * 4 + 3] > 40;
      const lauf = (y) => { if (belegt(mitte, y)) return null; let l = mitte, r = mitte; while (l > 0 && !belegt(l - 1, y)) l--; while (r < info.width - 1 && !belegt(r + 1, y)) r++; return [l, r]; };
      let best = null, cur = null;
      for (let y = 0; y <= info.height; y++) {
        const run = y < info.height ? lauf(y) : null;
        const ok = run && (run[1] - run[0]) >= info.width * 0.4;
        if (ok) { if (!cur) cur = { ab: y, runs: [], n: 0 }; cur.runs.push(run); cur.n++; }
        else if (cur) { if (!best || cur.n > best.n) best = cur; cur = null; }
      }
      // 2. Okt.: die engste Zeile bestimmte die Breite - am Abi-Ruecken streiften die obersten Zeilen
      // noch die Wellenenden unter der Ueberschrift, und die Namen bekamen 45 Prozent der Breite.
      // Jetzt: Zeilen, die deutlich enger sind als der Median, gehoeren nicht zum Korridor (sie liegen
      // an seinem Rand); er beginnt und endet bei den breiten Zeilen.
      if (best) {
        const breiten = best.runs.map(r => r[1] - r[0]).sort((a, b) => a - b);
        const median = breiten[breiten.length >> 1];
        const gut = best.runs.map((r, i) => (r[1] - r[0]) >= median * 0.9 ? i : -1).filter(i => i >= 0);
        const von = gut[0], bis = gut[gut.length - 1];
        const teil = best.runs.slice(von, bis + 1).filter(r => (r[1] - r[0]) >= median * 0.9);
        best = { ab: best.ab + von, n: bis - von + 1, l: Math.max(...teil.map(r => r[0])), r: Math.min(...teil.map(r => r[1])) };
      }
      if (best && best.n > besteLaenge && best.n / info.height >= 0.2 && best.r - best.l >= info.width * 0.4) {
        korridorOben = Math.round(best.ab / info.height * H);
        korridorHoehe = Math.round(best.n / info.height * H);
        innenVon = Math.round(best.l / info.width * W); innenBis = Math.round((best.r + 1) / info.width * W);
      }
    }

    // Die alte Messung bleibt als Rueckfall: wo endet das Motiv ueberhaupt?
    let unterkante = 0;
    for (let y = 0; y < info.height; y++) {
      let n = 0;
      for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) n++;
      if (n / info.width > 0.02) unterkante = y;        // hier ist noch Motiv
    }
    const luft = Math.round(H * 0.035);
    const unten = Math.round(H * 0.04);
    const motivEnde = Math.round((unterkante + 1) / info.height * H);
    // Wie viel Platz braucht die Liste wirklich? So viel, wie ihre Zeilen brauchen - nicht
    // ein fester Prozentsatz. Bei zwanzig Namen in zwei Spalten sind das zehn Zeilen.
    const spalten = list.length <= 9 ? 1 : (list.length <= 22 ? 2 : 3);
    const zeilen = Math.ceil(list.length / spalten);
    // Das ist die MINDESThoehe, die die Liste braucht - nicht die bequeme. Mit 5,2 Prozent je
    // Zeile verlangte sie bei zehn Zeilen 52 Prozent der Hoehe; der gemessene freie Korridor
    // der gerahmten Rueckseite ist 42 Prozent hoch, und die Liste waere nie hineingezogen,
    // obwohl sie dort gut sitzt. 3,8 Prozent je Zeile sind eng, aber lesbar.
    const brauchtH = Math.min(Math.round(H * 0.62), Math.max(Math.round(H * 0.28), Math.round(zeilen * H * 0.038)));
    const maxTop = H - brauchtH - unten;

    // Gibt es einen freien Korridor, der gross genug ist? Dann gehoert die Liste dorthin -
    // auch wenn unter ihr noch ein Abschluss steht und links und rechts Bordueren.
    if (korridorHoehe >= brauchtH && korridorOben > Math.round(H * 0.12)) {
      zoneTop = korridorOben + Math.round(luft * 0.5);
      zoneH = Math.max(1, korridorHoehe - luft);
      gerahmt = true;
      // Die Namen halten denselben Abstand wie der gemessene Korridor - sonst laufen die
      // aeusseren Spalten unter die Bordueren.
      padX = Math.round(W * RAND); usableW = W - padX * 2;
      if (innenBis > innenVon) { const rand = Math.round((innenBis - innenVon) * 0.06); padX = innenVon + rand; usableW = innenBis - innenVon - rand * 2; }
      console.log('renderNameList: freier Korridor von ' + Math.round(korridorOben / H * 100)
        + ' % bis ' + Math.round((korridorOben + korridorHoehe) / H * 100) + ' % - Liste sitzt darin');
    } else if (motivEnde + luft > maxTop) {
      // Zu wenig Platz: das Motiv genau so weit verkleinern, dass es bei maxTop endet -
      // nicht weiter. Vorher wurde pauschal auf 38 Prozent gestaucht; dann stand oben ein
      // Briefmarkenmotiv und darunter ein Loch.
      const obenRand = Math.round(H * 0.025);
      const f = (maxTop - luft - obenRand) / Math.max(1, motivEnde);
      const klein = await sharp(masterPng)
        .resize({ width: Math.max(1, Math.round(W * f)), height: Math.max(1, Math.round(H * f)), kernel: 'lanczos3' })
        .png().toBuffer();
      const km = await sharp(klein).metadata();
      masterPng = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: klein, left: Math.round((W - km.width) / 2), top: obenRand }])
        .png().toBuffer();
      console.log('renderNameList: Motiv auf ' + Math.round(f * 100) + ' % verkleinert, Liste beginnt bei '
        + Math.round(maxTop / H * 100) + ' %');
      zoneTop = maxTop;
    } else if (motivEnde + luft > zoneTop) {
      zoneTop = motivEnde + luft;
      console.log('renderNameList: Motiv reicht bis ' + Math.round(motivEnde / H * 100) + ' % - Liste rueckt nach unten');
    }
    // Ohne Rahmen fuellt die Liste bis zum unteren Rand - so entsteht nie eine Luecke dazwischen.
    if (!gerahmt) zoneH = H - zoneTop - unten;
  } catch (e) { console.error('renderNameList Messung:', e && e.message ? e.message : e); }

  const n = list.length;
  // 2. Okt., Markus zur Abi-Rueckseite: "die Namen muessen natuerlich richtig gross, dass man's auch
  // lesen kann". Die Spaltenzahl hing nur an der Anzahl (bis 22 Namen zwei, darueber drei) - in einem
  // schmalen Rahmen gab das drei enge Spalten und winzige Schrift. Jetzt wird die Spaltenzahl gewaehlt,
  // bei der die Schrift am groessten wird (Hoehe der Zeile gegen Breite des laengsten Namens).
  // Laufweite 0,18 statt 0,32: die Kontur braucht Luft, aber nicht ein Drittel Buchstabe.
  const spacing = 0.18;
  const laengster = list.reduce((m, t) => Math.max(m, t.length), 1);
  const zeichenBreite = (font.ratio || 0.62) + spacing;
  let cols = 1, besteGroesse = 0;
  for (let c = 1; c <= 4; c++) {
    const r = Math.ceil(n / c);
    const g = Math.min((zoneH / r) * 0.62, (usableW / c) * 0.92 / (laengster * zeichenBreite));
    if (g > besteGroesse * 1.03) { besteGroesse = g; cols = c; }
  }
  const rows = Math.ceil(n / cols);
  const colW = usableW / cols;
  const rowH = zoneH / rows;

  let size = Math.round(rowH * 0.62);
  size = Math.max(Math.round(H * 0.014), Math.min(size, Math.round(H * 0.05)));
  const maxTextW = colW * 0.92;

  let accent = '#d2aa46';
  try {
    const cols2 = await dominantColors(masterPng);
    const vivid = cols2.find(c => !NEUTRAL.includes(c.name) && c.share > 0.03);
    if (vivid) accent = hex(vivid);
  } catch (e) { /* Gold bleibt */ }

  const light = istHell(opts.textile);
  const ink = light ? '#141414' : '#f6efe0';
  // 8. Okt.: die Wechselfarbe (jeder zweite Name) muss sich vom Stoff abheben - gemessen kam beim ABInauten-Ruecken ein
  // dunkles Grau heraus, auf Schwarz kaum lesbar. Zu wenig Helligkeitsabstand: dann Gold bzw. ein tiefes Rot.
  const lum = (h) => { const n = parseInt(String(h).replace('#', ''), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const wechsel = (light ? lum(accent) < 0.5 : lum(accent) > 0.5) ? accent : (light ? '#a3122e' : '#e8b931');
  const edge = light ? '#f6efe0' : '#141414';
  const strokeDark = Math.max(2, Math.round(size * 0.10));
  const strokeAccent = Math.max(1, Math.round(size * 0.045));

  // 23. Sept. - der Grund, warum die Rueckseite nie ordentlich aussah:
  // Hier stand textLength="..." lengthAdjust="spacingAndGlyphs", um lange Namen auf die
  // Spaltenbreite zu stauchen. librsvg setzt textLength aber NICHT um - gemessen: bestellt
  // 405 px, gerendert 1024 px (am Rand abgeschnitten, in Wahrheit noch breiter). Also lief
  // jeder Name in seiner natuerlichen Breite weiter, ueberlappte die Nachbarspalte und wurde
  // links und rechts vom Rand abgeschnitten. Das galt fuer JEDE Schrift, auch die alte - der
  // Fehler ist so alt wie die Rueckseite.
  //
  // renderName() hatte das Problem nie, weil es den fertigen Schriftzug misst und dann
  // einpasst. Genau das macht die Liste jetzt auch: jeder Name wird einzeln in eine
  // absichtlich viel zu grosse Ebene gezeichnet, auf seinen Inhalt beschnitten, auf die
  // Zelle verkleinert und erst dann gesetzt. Abschneiden und Ueberlappen sind damit unmoeglich.
  // 8. Okt., Markus: "Mit dem Namen kann man spielen" - nicht jede Rueckseite als braves Raster. opts.anordnung:
  //   'raster'  wie bisher, Spalten und Zeilen;
  //   'versetzt' die Zeilen springen im Zickzack nach links und rechts (wie verlegte Steine);
  //   'bogen'   die Zeilen schwingen wie Sitzreihen im Theater - in der Mitte tiefer, aussen hoeher.
  // Ausser beim Raster wechselt jeder zweite Name in die Akzentfarbe des Designs.
  const anordnung = ['versetzt', 'bogen'].includes(opts.anordnung) && cols > 1 ? opts.anordnung : 'raster';
  const zelleW = Math.round(colW * (anordnung === 'versetzt' ? 0.78 : 0.92));
  const zelleH = Math.round(rowH * (anordnung === 'bogen' ? 0.7 : 0.82));
  const ebeneW = Math.round(colW * 4);          // reichlich Luft, nie die Begrenzung
  const ebeneH = Math.round(rowH * 3);
  const grund = Math.round(ebeneH * 0.62);

  // Erst alle Namen zeichnen und messen, dann EINE gemeinsame Verkleinerung anwenden.
  // Passte jeder Name fuer sich in seine Zelle, waere "Ben Ziegler" gross und
  // "Pia Engelhardt" klein - eine Klassenliste mit acht Schriftgroessen. Es zaehlt der
  // laengste Name: was der braucht, bekommen alle.
  const roh = [];
  for (let i = 0; i < list.length; i++) {
    const text = list[i].toUpperCase();
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ebeneW}" height="${ebeneH}">
<style>text{font-family:'${font.family}';font-weight:${font.weight};font-size:${size}px;letter-spacing:${Math.round(size * spacing)}px}</style>
<text x="${Math.round(ebeneW / 2)}" y="${grund}" text-anchor="middle" fill="none" stroke="${edge}" stroke-width="${strokeDark * 2 + strokeAccent * 2}" stroke-linejoin="round">${esc(text)}</text>
<text x="${Math.round(ebeneW / 2)}" y="${grund}" text-anchor="middle" fill="none" stroke="${accent}" stroke-width="${strokeAccent * 2 + strokeDark}" stroke-linejoin="round">${esc(text)}</text>
<text x="${Math.round(ebeneW / 2)}" y="${grund}" text-anchor="middle" fill="none" stroke="${edge}" stroke-width="${strokeDark}" stroke-linejoin="round">${esc(text)}</text>
<text x="${Math.round(ebeneW / 2)}" y="${grund}" text-anchor="middle" fill="${anordnung !== 'raster' && i % 2 ? wechsel : ink}">${esc(text)}</text>
</svg>`);
    let bild = await sharp(svg, { density: 72 }).png().toBuffer();
    try { bild = await sharp(bild).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 }).png().toBuffer(); }
    catch (e) { /* dann eben ungetrimmt - die Verkleinerung unten faengt es auf */ }
    const bm = await sharp(bild).metadata();
    roh.push({ bild, w: bm.width, h: bm.height });
  }

  // Die gemeinsame Verkleinerung: der engste Fall bestimmt sie fuer alle.
  let f = 1;
  for (const r of roh) f = Math.min(f, zelleW / r.w, zelleH / r.h);
  f = Math.min(1, f);

  const lagen = [];
  for (let i = 0; i < roh.length; i++) {
    let bild = roh[i].bild, bw = roh[i].w, bh = roh[i].h;
    if (f < 0.999) {
      bw = Math.max(1, Math.round(bw * f)); bh = Math.max(1, Math.round(bh * f));
      bild = await sharp(bild).resize({ width: bw, height: bh, kernel: 'lanczos3' }).png().toBuffer();
    }
    const col = i % cols, row = Math.floor(i / cols);
    let cx = Math.round(padX + colW * (col + 0.5));
    let cy = Math.round(rowH * (row + 0.5));
    if (anordnung === 'versetzt') cx += Math.round(colW * 0.11 * (row % 2 ? 1 : -1));
    if (anordnung === 'bogen') { const t = (cx - (padX + usableW / 2)) / (usableW / 2); cy += Math.round(rowH * 0.5 * (1 - t * t) - rowH * 0.25); }
    lagen.push({
      input: bild,
      left: Math.max(0, Math.min(W - bw, Math.round(cx - bw / 2))),
      top: Math.max(0, Math.min(zoneH - bh, Math.round(cy - bh / 2)))
    });
  }

  const flaeche = await sharp({ create: { width: W, height: zoneH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(lagen).png().toBuffer();
  return sharp(masterPng).composite([{ input: flaeche, left: 0, top: zoneTop }]).withMetadata({ density: 300 }).png().toBuffer();
}

// Fassung 54: Name INS MOTIV - zum Beispiel auf den Ruecken eines Shirts, das eine Figur im
// Design traegt (Markus, 16. Sept.: "die Namen auf die T-Shirts der Personen im Design bringen").
// Gesucht wird die ruhigste einfarbige Flaeche im Motiv, der Name wird hineingesetzt und nimmt die
// Gegenfarbe des Untergrunds. Findet sich keine passende Flaeche, faellt es auf das Band zurueck.
export async function renderNameImMotiv(masterPng, name, opts = {}) {
  const text = String(name || '').toUpperCase().trim();
  if (!text) return { png: masterPng, gesetzt: false };
  // Der Stil des Designs bestimmt die Schrift des Namens; ohne Stil gilt die Kundenwahl.
  const font = NAME_FONTS[schriftFuerStil(opts.style, opts.font)] || NAME_FONTS.rund;
  const ratio = Math.max(1.4, Math.min(6, text.length * (font.ratio + 0.12)));
  // Fassung 58: Flaeche vorgegeben (Name und Logo teilen sich ein Schild) - dann nicht suchen
  let platz = opts.platz && opts.platz.breite > 0 ? { gefunden: true, ...opts.platz } : null;
  if (!platz) { try { platz = await platzFuerText(masterPng, ratio, {}); } catch (e) { platz = null; } }
  if (!platz || !platz.gefunden) return { png: masterPng, gesetzt: false };
  const dunkel = platz.helligkeit < 130;
  const ink = dunkel ? '#f6efe0' : '#141414';
  const edge = dunkel ? '#141414' : '#f6efe0';
  // Der Text bekommt 86 Prozent der Flaeche, damit ein Rand bleibt
  const zielB = Math.round(platz.breite * 0.86), zielH = Math.round(platz.hoehe * 0.72);
  const size = Math.max(12, Math.round(zielH * 0.9));
  const spacing = 0.18;
  const strokeDark = Math.max(2, Math.round(size * 0.08));
  const ebeneH = Math.round(size * 3), ebeneB = Math.round(zielB * 2.2);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ebeneB}" height="${ebeneH}">
<style>text{font-family:'${font.family}';font-weight:${font.weight};font-size:${size}px;letter-spacing:${Math.round(size * spacing)}px}</style>
<text x="${Math.round(ebeneB / 2)}" y="${Math.round(ebeneH * 0.62)}" text-anchor="middle" fill="none" stroke="${edge}" stroke-width="${strokeDark * 2}" stroke-linejoin="round">${esc(text)}</text>
<text x="${Math.round(ebeneB / 2)}" y="${Math.round(ebeneH * 0.62)}" text-anchor="middle" fill="${ink}">${esc(text)}</text>
</svg>`);
  let ebene = await sharp(svg, { density: 72 }).png().toBuffer();
  try { ebene = await sharp(ebene).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 }).png().toBuffer(); } catch (e) { /* ganze Ebene */ }
  ebene = await sharp(ebene).resize({ width: zielB, height: zielH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const em = await sharp(ebene).metadata();
  const links = Math.round(platz.cx - em.width / 2), oben = Math.round(platz.cy - em.height / 2);
  const png = await sharp(masterPng).composite([{ input: ebene, left: Math.max(0, links), top: Math.max(0, oben) }]).withMetadata({ density: 300 }).png().toBuffer();
  console.log('renderNameImMotiv: "' + text + '" ' + em.width + 'x' + em.height + ' px bei ' + platz.cx + '/' + platz.cy + ', Untergrund ' + (dunkel ? 'dunkel' : 'hell') + ' (' + platz.helligkeit + '), Streuung ' + platz.streuung);
  return { png, gesetzt: true, platz };
}

// Name in das Band setzen. Farbe: helle Schrift mit dunkler Kontur plus Kontur in der Motivfarbe.
export async function renderName(masterPng, name, opts = {}) {
  const meta = await sharp(masterPng).metadata();
  const W = meta.width, H = meta.height;
  const zone = NAME_ZONES.includes(opts.zone) ? opts.zone : 'unten';
  // Der Stil des Designs bestimmt die Schrift des Namens; ohne Stil gilt die Kundenwahl.
  const font = NAME_FONTS[schriftFuerStil(opts.style, opts.font)] || NAME_FONTS.rund;

  const bandH = Math.round(H * 0.13);
  // Groesserer Sicherheitsabstand zum Rand, damit der Name nirgends angeschnitten wird.
  const margin = Math.round(H * 0.045);
  let top = zone === 'oben' ? margin : H - bandH - margin;
  const text = String(name || '').toUpperCase();

  // Fassung 36 (Markus, 14. Sept., "Er ueberschreibt zu viel"): der Name lag ueber einem gemalten
  // Spruchband. Der Prompt bestellt das Band leer, die Pruefung je Versuch straft ein volles Band -
  // aber der beste von drei Versuchen kann trotzdem eins haben. Deshalb wird hier GEMESSEN:
  // ist das Band belegt, kommt der Name in das andere Band, wenn das frei ist; sonst wird das
  // Motiv so weit verkleinert, dass ein leeres Band entsteht. Ein Name ueber Schrift kommt
  // nie mehr vor.
  const belegt = async (png, zoneX) => {
    const hh = bandH + margin;
    const { data, info } = await sharp(png).ensureAlpha().extract({ left: 0, top: zoneX === 'oben' ? 0 : H - hh, width: W, height: hh })
      .resize({ width: 240, kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
    let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 40) n++;
    return n / (info.width * info.height);
  };
  let zoneJetzt = zone;
  try {
    if ((await belegt(masterPng, zone)) > 0.04) {
      const andere = zone === 'oben' ? 'unten' : 'oben';
      if ((await belegt(masterPng, andere)) <= 0.04) {
        zoneJetzt = andere;
      } else {
        // Platz schaffen: Motiv verkleinern, Band bleibt frei (Breite bleibt, Hoehe schrumpft)
        const freiH = H - bandH - margin * 2;
        const klein = await sharp(masterPng).resize({ width: W, height: freiH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
        const km = await sharp(klein).metadata();
        masterPng = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: klein, left: Math.round((W - km.width) / 2), top: zone === 'oben' ? H - margin - km.height : margin }])
          .png().toBuffer();
        console.log('renderName: Band belegt - Motiv auf ' + km.height + ' px Hoehe verkleinert, Band frei gemacht');
      }
    }
  } catch (e) { console.error('renderName Bandmessung:', e && e.message ? e.message : e); }
  top = zoneJetzt === 'oben' ? margin : H - bandH - margin;
  const maxW = W * 0.86;
  let size = Math.round(bandH * 0.72);
  // Fassung 42 (Markus, 15. Sept.: "der Name ist immer noch abgeschnitten"): Die Buchstaben tragen
  // aussen eine dicke Kontur (0,29 der Schriftgroesse). Bei 0,04 Laufweite lagen die Konturen
  // uebereinander, und die Fuellung des naechsten Buchstabens schnitt die Kontur des vorigen ab -
  // "LEO" sah aus wie angeschnitten. Die Laufweite muss also mindestens so gross sein wie die
  // Kontur breit ist, plus etwas Luft.
  const spacing = 0.34;
  const est = text.length * (font.ratio + spacing) * size;
  let fit = '';
  if (est > maxW) { size = Math.round(size * maxW / est); fit = ` textLength="${Math.round(maxW)}" lengthAdjust="spacingAndGlyphs"`; }
  size = Math.max(size, Math.round(H * 0.02));
  // Laufweite haengt hinter dem letzten Buchstaben mit im Vorschub - ohne Ausgleich sitzt der
  // Name um eine halbe Laufweite zu weit links.
  const mitte = Math.round(W / 2);

  let accent = '#d2aa46';
  try {
    const cols = await dominantColors(masterPng);
    const vivid = cols.find(c => !NEUTRAL.includes(c.name) && c.share > 0.03);
    if (vivid) accent = hex(vivid);
  } catch (e) { /* Gold bleibt */ }

  const light = istHell(opts.textile);
  const ink = light ? '#141414' : '#f6efe0';      // Schriftfarbe
  const edge = light ? '#f6efe0' : '#141414';     // aeussere Kontur
  const strokeDark = Math.max(2, Math.round(size * 0.10));
  const strokeAccent = Math.max(1, Math.round(size * 0.045));
  // Fassung 52 (Markus, 16. Sept.: "Name wieder abgeschnitten"): Bisher wurde der Name in eine
  // Ebene genau in Bandhoehe gezeichnet und mit dominant-baseline mittig gesetzt. Die Schriftart
  // bringt aber Ober- und Unterlaengen mit, und die dicke Aussenkontur kommt oben und unten noch
  // dazu - beides ragte ueber die Ebene hinaus und wurde hart abgeschnitten. Jetzt wird in eine
  // absichtlich viel zu hohe Ebene gezeichnet, das Ergebnis auf seinen Inhalt beschnitten, bei
  // Bedarf verkleinert und erst dann mittig in das Band gesetzt. Abschneiden ist damit unmoeglich.
  const ebeneH = Math.round(bandH * 3);
  const grund = Math.round(ebeneH * 0.62);   // Grundlinie, reichlich Luft nach oben und unten
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ebeneH}">
<style>text{font-family:'${font.family}';font-weight:${font.weight};font-size:${size}px;letter-spacing:${Math.round(size * spacing)}px}</style>
<text x="${mitte}" y="${grund}"${fit} text-anchor="middle" fill="none" stroke="${edge}" stroke-width="${strokeDark * 2 + strokeAccent * 2}" stroke-linejoin="round">${esc(text)}</text>
<text x="${mitte}" y="${grund}"${fit} text-anchor="middle" fill="none" stroke="${accent}" stroke-width="${strokeAccent * 2 + strokeDark}" stroke-linejoin="round">${esc(text)}</text>
<text x="${mitte}" y="${grund}"${fit} text-anchor="middle" fill="none" stroke="${edge}" stroke-width="${strokeDark}" stroke-linejoin="round">${esc(text)}</text>
<text x="${mitte}" y="${grund}"${fit} text-anchor="middle" fill="${ink}">${esc(text)}</text>
</svg>`);
  let layer = await sharp(svg, { density: 72 }).png().toBuffer();
  // Auf den wirklich bemalten Teil beschneiden
  try { layer = await sharp(layer).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 }).png().toBuffer(); }
  catch (e) { /* dann eben die ganze Ebene */ }
  let lm = await sharp(layer).metadata();
  // Passt der Block nicht ins Band, wird er verkleinert - lieber etwas kleiner als angeschnitten
  const platzH = Math.round(bandH * 0.92), platzW = Math.round(maxW);
  if (lm.height > platzH || lm.width > platzW) {
    layer = await sharp(layer).resize({ width: platzW, height: platzH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
    lm = await sharp(layer).metadata();
  }
  const links = Math.max(0, Math.round((W - lm.width) / 2));
  const oben = Math.max(0, top + Math.round((bandH - lm.height) / 2));
  console.log('renderName: "' + text + '" ' + lm.width + 'x' + lm.height + ' px in ein Band von ' + bandH + ' px, oben ' + oben);
  return sharp(masterPng).composite([{ input: layer, left: links, top: oben }]).withMetadata({ density: 300 }).png().toBuffer();

}

// ---------- Fassung 9: Bestellliste (CSV), Kaderliste auf dem Ruecken, Brust-Print ----------

// Reihenfolge der Konfektionsgroessen in der Summenzeile der Bestellliste (Erwachsene + Kinder)
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '98', '104', '110', '116', '122', '128', '134', '140', '146', '152', '158', '164', '176'];

// Bestellliste als CSV (Semikolon, Excel-tauglich): Nr;Name;Groesse;Artikel + Summen je Groesse.
// people = [{ name, size, garment }] (aus parsePeople) - Kontaktdaten kommen NICHT in die Liste.
export function rosterCsv(people, info = {}) {
  const list = (people || []).map(p => (typeof p === 'string' ? { name: p } : p) || {}).filter(p => p.name);
  // Menge und Dateiname gehoeren dazu: die Druckerei soll die Zeile der CSV und die
  // gelieferte Datei ohne Nachdenken einander zuordnen koennen.
  const rows = [['Auftrag', 'Nr', 'Name', 'Größe', 'Artikel', 'Menge', 'Datei', 'Motto', 'Design', 'Textil', 'Druck']];
  list.forEach((p, i) => rows.push([info.lfdNr ? String(info.lfdNr).padStart(5, '0') : '', i + 1, p.name, p.size || '', p.garment || '', Math.max(1, +p.menge || 1),
    typeof info.datei === 'function' ? info.datei(i) : '',
    info.motto || '', info.designId || '', istHell(info.textile) ? 'hell' : 'dunkel', info.aufteilung || 'vorne']));
  rows.push([]);
  rows.push(['Summe je Größe']);
  const counts = {};
  for (const p of list) { const k = (p.size || 'ohne Größe') + (p.garment ? ' ' + p.garment : ''); counts[k] = (counts[k] || 0) + Math.max(1, +p.menge || 1); }
  const order = (s) => { const i = SIZES.indexOf(String(s).split(' ')[0]); return i < 0 ? 99 : i; };
  for (const s of Object.keys(counts).sort((a, b) => order(a) - order(b) || a.localeCompare(b))) rows.push([s, counts[s]]);
  rows.push(['Gesamt', list.reduce((n, p) => n + Math.max(1, +p.menge || 1), 0)]);
  const cell = (v) => { const t = String(v == null ? '' : v); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

function textStyle(size, font, opts) {
  const light = istHell(opts.textile);
  return { ink: light ? '#141414' : '#f6efe0', edge: light ? '#f6efe0' : '#141414', strokeDark: Math.max(2, Math.round(size * 0.10)), strokeAccent: Math.max(1, Math.round(size * 0.045)), font };
}
async function accentOf(masterPng) {
  try {
    const cols = await dominantColors(masterPng);
    const vivid = cols.find(c => !NEUTRAL.includes(c.name) && c.share > 0.03);
    if (vivid) return hex(vivid);
  } catch (e) { /* Gold bleibt */ }
  return '#d2aa46';
}
function outlinedText(x, y, text, size, st, accent, extra = '') {
  const t = esc(text);
  return `<text x="${x}" y="${y}"${extra} fill="none" stroke="${st.edge}" stroke-width="${st.strokeDark * 2 + st.strokeAccent * 2}" stroke-linejoin="round">${t}</text>
<text x="${x}" y="${y}"${extra} fill="none" stroke="${accent}" stroke-width="${st.strokeAccent * 2 + st.strokeDark}" stroke-linejoin="round">${t}</text>
<text x="${x}" y="${y}"${extra} fill="none" stroke="${st.edge}" stroke-width="${st.strokeDark}" stroke-linejoin="round">${t}</text>
<text x="${x}" y="${y}"${extra} fill="${st.ink}">${t}</text>`;
}

// Kaderliste fuer den Ruecken: Kopf = das Frontmotiv (verkleinert, Anteil kopfPct der Breite), darunter alle Namen
// in 1-3 Spalten. Gleiche Breite wie der Master, Hoehe nach Bedarf. Ohne Groessen - die gehoeren in die Bestellliste.
export async function renderRoster(masterPng, people, opts = {}) {
  const meta = await sharp(masterPng).metadata();
  const W = meta.width;
  // Der Stil des Designs bestimmt die Schrift des Namens; ohne Stil gilt die Kundenwahl.
  const font = NAME_FONTS[schriftFuerStil(opts.style, opts.font)] || NAME_FONTS.rund;
  const names = (people || []).map(r => (typeof r === 'string' ? r : r && r.name) || '').filter(Boolean).map(n => n.toUpperCase());
  const kopfPct = Math.min(100, Math.max(0, +opts.kopfPct >= 0 ? +opts.kopfPct : 45));
  const gap = Math.round(W * 0.035);

  let head = null, headH = 0;
  if (kopfPct > 0) {
    const hw = Math.round(W * kopfPct / 100);
    head = await sharp(masterPng).resize({ width: hw }).png().toBuffer();
    headH = (await sharp(head).metadata()).height;
  }

  const n = names.length;
  const cols = n <= 12 ? 1 : n <= 30 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const colW = (W * 0.9) / cols;
  const longest = names.reduce((m, s) => Math.max(m, s.length), 1);
  // Schriftgroesse: passt in die Spalte, aber hoechstens 6 Prozent der Breite, mindestens 2,2 Prozent
  let size = Math.round(Math.min(W * 0.06, colW * 0.92 / (longest * (font.ratio + 0.03))));
  size = Math.max(size, Math.round(W * 0.022));
  const lineH = Math.round(size * 1.35);
  const listH = n ? rows * lineH + Math.round(size * 0.5) : 0;
  const H = Math.round(headH + (head && n ? gap : 0) + listH + gap);

  const accent = await accentOf(masterPng);
  // 23. Sept.: Hier stand dasselbe textLength wie in der Namensliste - und librsvg setzt es
  // nicht um (gemessen). Lange Namen liefen also ueber ihre Spalte hinaus. Statt zu stauchen
  // wird die Schrift jetzt so weit verkleinert, dass der LAENGSTE Name in seine Spalte passt;
  // alle bekommen dieselbe Groesse, sonst haette eine Kaderliste acht Schriftgroessen.
  const platz = colW * 0.95;
  let breiteste = 0;
  for (const name of names) breiteste = Math.max(breiteste, name.length * (font.ratio + 0.03) * size);
  if (breiteste > platz) size = Math.max(10, Math.floor(size * platz / breiteste));
  const st = textStyle(size, font, opts);
  let texts = '';
  names.forEach((name, i) => {
    const c = Math.floor(i / rows), r = i % rows;
    const x = Math.round(W * 0.05 + colW * (c + 0.5));
    const y = Math.round(headH + (head && n ? gap : 0) + size * 0.25 + r * lineH + lineH / 2);
    texts += outlinedText(x, y, name, size, st, accent, ' text-anchor="middle" dominant-baseline="central"') + '\n';
  });
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<style>text{font-family:'${font.family}';font-weight:${font.weight};font-size:${size}px;letter-spacing:${Math.round(size * 0.03)}px}</style>
${texts}</svg>`);
  const layer = await sharp(svg, { density: 72 }).png().toBuffer();
  const layers = [{ input: layer, left: 0, top: 0 }];
  if (head) layers.unshift({ input: head, left: Math.round((W - Math.round(W * kopfPct / 100)) / 2), top: 0 });
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).withMetadata({ density: 300 }).png().toBuffer();
}

// Brust-Print: das Frontmotiv klein (Anteil der Masterbreite, Standard 34 Prozent = ca. 12 cm bei 36 cm Druckbreite)
// mit dem Namen im Band - sieht aus wie das grosse Design, nur klein auf der Brust.
export async function renderChest(masterPng, name, opts = {}) {
  const meta = await sharp(masterPng).metadata();
  const pct = Math.min(60, Math.max(15, +opts.widthPct || 34));
  const small = await sharp(masterPng).resize({ width: Math.round(meta.width * pct / 100) }).withMetadata({ density: 300 }).png().toBuffer();
  return name ? renderName(small, name, opts) : small;
}
