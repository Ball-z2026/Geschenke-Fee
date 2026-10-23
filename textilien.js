import fsSync from 'node:fs';

// Textil-Katalog fuer den Firmen- und (spaeter) Vereinsbereich.
//
// Hier steht, WAS bestellbar ist - nicht, wie es aussieht. Das Aussehen (Produktfoto plus
// Druckflaeche in Pixeln) liegt in mockups.js. Die Klammer zwischen beiden ist der Schluessel:
// tee, polo, sweater, hoodie, softshell entsprechen den Schluesseln in GARMENTS.
//
// Zwei Quellen:
//   1. Stanley/Stella-Daten aus dem Drive-Dokument "TEXTIL-BLANKS (verbindlich)", Stand 27.07.2026.
//      Die stehen schon drin - Modell, Material, Schnitt, Preis und die DTF-Eigenheiten.
//   2. Farben, Groessenmasse und Produktfotos vom Lieferanten (L-Shop-Team). Die Felder farben,
//      masse und fotos sind bis dahin leer. katalogLuecken() sagt jederzeit, was noch fehlt -
//      der Firmenbereich zeigt nur an, was vollstaendig ist.

// Gilt fuer die ganze Stanley/Stella-Linie.
export const ZERTIFIKATE = ['GOTS', 'OEKO-TEX Standard 100', 'Fair Wear', 'PETA-Approved Vegan'];

export const PFLEGE = 'Bei 30 °C auf links waschen, nicht bleichen, nicht in den Trockner, '
  + 'niedrig bügeln, nicht über den Druck, kein Weichspüler.';

// Standard-Groessenreihe. Ein Textil darf davon abweichen (groessen: [...]).
const STANDARD_GROESSEN = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export const TEXTILIEN = {
  tee: {
    label: 'T-Shirt',
    marke: 'Stanley/Stella',
    modell: 'Creator 2.0',
    material: '100 % Bio-Baumwolle, ringgesponnen',
    gramm: null,
    schnitt: 'Medium Fit',
    details: 'Breiterer Kragen. Bewusst kein Oversize-Schnitt.',
    preis: 39,
    groessen: STANDARD_GROESSEN,
    // Wohin der Druck darf. brust = kleines Logo auf der Herzseite, ruecken = grosses Motiv.
    druck: {
      brust: { moeglich: true, hinweis: 'Glatte Fläche, Standard-Chestprint vorn.' },
      ruecken: { moeglich: true, hinweis: 'Rückseite großflächig bedruckbar.' }
    },
    farben: [],
    masse: {},
    fotos: {}
  },

  polo: {
    label: 'Poloshirt',
    marke: 'Stanley/Stella',
    modell: 'Prepster 2.0',
    material: '100 % Bio-Baumwolle',
    gramm: '220–230 g/m²',
    schnitt: 'Normal Fit',
    details: '2-Knopf-Leiste.',
    preis: 49,
    groessen: STANDARD_GROESSEN,
    druck: {
      brust: { moeglich: true, hinweis: 'Kleinerer Druckbereich vorn wegen der Knopfleiste – Motiv enger zuschneiden.' },
      ruecken: { moeglich: true, hinweis: 'Rückseite großflächig bedruckbar.' }
    },
    farben: [],
    masse: {},
    fotos: {}
  },

  sweater: {
    label: 'Sweater',
    marke: 'Stanley/Stella',
    modell: 'Changer 2.0',
    artikelLieferant: 'STSU178',
    material: 'Bio-Baumwolle, gebürstet',
    gramm: null,
    schnitt: null,
    details: null,
    preis: 59,
    groessen: STANDARD_GROESSEN,
    druck: {
      brust: { moeglich: true, hinweis: 'Glatte Fläche, Standard-Chestprint vorn.' },
      ruecken: { moeglich: true, hinweis: 'Rückseite großflächig bedruckbar.' }
    },
    farben: [],
    masse: {},
    fotos: {}
  },

  hoodie: {
    label: 'Hoodie',
    marke: 'Stanley/Stella',
    modell: 'Cruiser 2.0',
    artikelLieferant: 'STSU177',
    material: '100 % Bio-Baumwolle, gebürstet',
    gramm: '350 g/m²',
    schnitt: 'Modern Medium Fit',
    details: 'Doppelkapuze, Känguru-Tasche.',
    preis: 79,
    groessen: STANDARD_GROESSEN,
    druck: {
      brust: { moeglich: true, hinweis: 'Chestprint sitzt ÜBER der Känguru-Tasche.' },
      ruecken: { moeglich: true, hinweis: 'Großer Rückenbereich.' }
    },
    farben: [],
    masse: {},
    fotos: {}
  },

  // Softshell kommt nicht von Stanley/Stella - Modell und Daten kommen komplett vom Lieferanten.
  softshell: {
    label: 'Softshell-Jacke',
    marke: null,
    modell: null,
    material: null,
    gramm: null,
    schnitt: null,
    details: null,
    preis: null,
    groessen: STANDARD_GROESSEN,
    druck: {
      // Softshell wird in der Regel bestickt oder mit Flex beklebt, nicht mit DTF grossflaechig bedruckt.
      brust: { moeglich: true, hinweis: 'Kleines Logo auf der Herzseite – Softshell verträgt keinen großflächigen Druck.' },
      ruecken: { moeglich: true, hinweis: 'Rücken nur in Maßen – Nähte und Taschen beachten.' }
    },
    farben: [],
    masse: {},
    fotos: {}
  },

  // Zip-Hoodie ist bei Kiez Fashion im Sortiment und hat die kniffligste Druckregel.
  // Im Firmenbereich vorerst aus (siehe imFirmenbereich unten), aber die Daten stehen bereit.
  zip: {
    label: 'Zip-Hoodie',
    marke: 'Stanley/Stella',
    modell: 'Mixer',
    material: '85 % Bio-Baumwolle / 15 % recyceltes Polyester',
    gramm: '280 g/m²',
    schnitt: 'Medium Fit',
    details: 'Durchgehender Metallzipper.',
    preis: 79,
    groessen: STANDARD_GROESSEN,
    druck: {
      brust: { moeglich: true, hinweis: 'Vorderseite ist durch den Zipper geteilt – das Motiv darf NICHT über den Zipper laufen. Vorn nur ein kleines seitliches Emblem.' },
      ruecken: { moeglich: true, hinweis: 'Hauptmotiv gehört auf die Rückseite.' }
    },
    farben: [],
    masse: {},
    fotos: {}
  }
};

// Welche Textilien der Firmenbereich anbietet, in dieser Reihenfolge.
// Markus' Vorgabe: T-Shirt, Polo, Sweater, Hoodie, Softshell.
export const FIRMEN_TEXTILIEN = ['tee', 'polo', 'sweater', 'hoodie', 'softshell'];

// Die zwei Druckplaetze, die der Firmenkunde waehlen kann.
export const PLAETZE = [
  { key: 'brust', label: 'Brust (Herzseite)', place: 'chest' },
  { key: 'ruecken', label: 'Rücken', place: 'back' }
];

// Ein Textil ist erst bestellbar, wenn Farben, Masse und mindestens ein Foto da sind.
export function textilFertig(key) {
  const t = TEXTILIEN[key];
  if (!t) return false;
  if (!t.farben.length) return false;
  if (!t.groessen.every((g) => t.masse[g])) return false;
  return t.farben.some((f) => t.fotos[f.key]);
}

// Sagt im Klartext, was noch fehlt - fuer die Lage-Karte im Backend.
export function katalogLuecken() {
  const luecken = [];
  for (const key of FIRMEN_TEXTILIEN) {
    const t = TEXTILIEN[key];
    if (!t) { luecken.push({ textil: key, fehlt: ['ganzer Eintrag'] }); continue; }
    const fehlt = [];
    if (!t.modell) fehlt.push('Modell');
    if (!t.material) fehlt.push('Material');
    if (t.preis == null) fehlt.push('Preis');
    if (!t.farben.length) fehlt.push('Farben');
    const ohneMass = t.groessen.filter((g) => !t.masse[g]);
    if (ohneMass.length) fehlt.push('Maße (' + ohneMass.join(', ') + ')');
    const ohneFoto = t.farben.filter((f) => !t.fotos[f.key]).map((f) => f.name);
    if (t.farben.length && ohneFoto.length) fehlt.push('Fotos (' + ohneFoto.join(', ') + ')');
    if (fehlt.length) luecken.push({ textil: key, label: t.label, fehlt });
  }
  return luecken;
}

// Was der Firmenbereich ueber ein Textil ausgibt. Ohne Einkaufsdaten.
export function textilView(key) {
  const t = TEXTILIEN[key];
  if (!t) return null;
  return {
    key,
    label: t.label,
    marke: t.marke,
    modell: t.modell,
    material: t.material,
    gramm: t.gramm,
    schnitt: t.schnitt,
    details: t.details,
    preis: t.preis,
    groessen: t.groessen,
    masse: t.masse,
    farben: t.farben.map((f) => ({ key: f.key, name: f.name, hex: f.hex })),
    druck: t.druck,
    zertifikate: t.marke === 'Stanley/Stella' ? ZERTIFIKATE : [],
    pflege: PFLEGE,
    fertig: textilFertig(key)
  };
}

// =============================================================================================
// Fassung 80 - Die Textil-Linie: drei Stufen, achtzehn Artikel
// =============================================================================================
// Grundlage ist Markus' Bildmanifest vom 18. September 2026
// (BALL-Z_BILDMANIFEST_18_ARTIKEL_RIGHTS_2026) und seine Einteilung:
//
//   Roly            -> "Ottos Starter"   wenn viele mitmachen und es guenstig bleiben soll
//   B&C             -> "Ottos Liebling"  unsere Mitte
//   Stanley/Stella  -> "Otto Deluxe"     schwer, weich, teuer
//
// Der Katalog oben bleibt unveraendert: er traegt die verbindlichen Stanley/Stella-Angaben aus
// dem Drive-Dokument (Material, Schnitt, Preis, Druckregeln) und die sind weiterhin gueltig.
// Was hier dazukommt, ist die Stufen-Ebene darueber - und vor allem die Bildrechte.
//
// DIE BILDRECHTE SIND DER EIGENTLICHE INHALT DIESES ABSCHNITTS
// Die drei Hersteller erlauben NICHT dasselbe, und der Unterschied entscheidet, ob wir von
// einem Artikel ueberhaupt ein Mockup zeigen duerfen:
//
//   Stanley/Stella  Packshots OHNE Modellkopf duerfen auf der TEXTILFLAECHE mit Illustration
//                   oder Schrift versehen werden - genau das, was wir tun. Modellgesichter mit
//                   KI bearbeiten, Kampagnenbilder fuer bedruckte Mockups, Umfaerben: verboten.
//   B&C             Packshots und Studio-Bilder duerfen dekoriert werden. Eigene Website, Shop
//                   und soziale Netze ja - Amazon und Marktplaetze nein.
//   Roly            KEINE Bearbeitung. Im Wortlaut: "without editing and in the original
//                   downloaded format/composition", "no editing, recoloring, compositing or
//                   other modification".
//
// Roly war damit der harte Fall: ein Roly-Produktfoto mit unserem Motiv darauf ist eine
// Bearbeitung und war nicht gedeckt - egal wie gut es aussieht. Der Schalter mockupErlaubt
// steht dafuer an der Marke, und die Abnahme prueft ihn - so faellt ein Verstoss beim Bauen
// auf und nicht erst, wenn Post vom Anwalt kommt.
//
// 25. SEPTEMBER: DIESER FALL IST ERLEDIGT. Markus: "Ich erlaube dir, die Roly-Sachen zu zeigen,
// da ich von denen eine Genehmigung habe." Die Rechtedokumentation hatte den Weg selbst genannt
// ("ohne eine separate ausdrueckliche Freigabe") - er fuehrte ueber Roly, und dort ist er
// langgegangen. Der Schalter steht jetzt auf true, mit Datum und Herkunft an der Marke.
// Unberuehrt davon bleibt die Regel gegen gespiegelte Rueckansichten: die stammt nicht von
// Roly, sondern gilt fuer die ganze Linie.
//
// WAS IM MANIFEST STEHT UND WAS NICHT (Stand nach dem zweiten Paket,
// BALL-Z_CLAUDE_FINAL_18_ARTIKEL vom 18.09.)
//   Farben         bei VIER Artikeln echte Listen, zusammen 77 Farbnamen - alle drei von B&C.
//                  Ich hatte zuerst "keine Farben" gemeldet; das war falsch, weil ich nur den
//                  ersten Eintrag geprueft hatte und der einen Platzhalter enthaelt. Bei den
//                  uebrigen vierzehn steht tatsaechlich nur ein Verweis auf die Hersteller-
//                  galerie, und dazu die Anweisung "do not invent additional colours".
//   Groessen       keine - ausser einer Einschraenkung: beim B&C Zip-Hoodie gibt es 4XL und
//                  5XL nur in Schwarz.
//   Beschreibungen keine.
//   Bildadressen   EINE von achtzehn (Stanley/Stella Bomber 2.0). Bei den uebrigen siebzehn
//                  steht ausdruecklich "do not invent or substitute third-party asset URLs".
// Das zweite Paket enthaelt im Datenteil genau dieselben Werte wie das erste - nachgerechnet,
// Feld fuer Feld identisch. Neu sind nur die Rechtedokumentation und ein Download-Helfer.
//
// ZWEI REGELN AUS DER RECHTEDOKUMENTATION, DIE UNS TECHNISCH BETREFFEN
//   1. "Claude darf keine fehlenden Front-/Back-Bilder erfinden. Wenn ein offizielles Front-
//      oder Back-Asset nicht verifiziert vorliegt, muss es als NOT_VERIFIED behandelt werden.
//      Keine Spiegelung einer Frontansicht als vermeintliches Backbild."
//      Das trifft uns direkt: makeMockup() nimmt fuer Ruecken-Mockups von T-Shirt und Hoodie
//      heute die VORDERE Vorlage. Bei eigenen Vorlagen ist das unsere Sache - bei diesen
//      Herstellerbildern ist es ausdruecklich verboten. Deshalb steht unten rueckseite:
//      'NOT_VERIFIED' an jedem Artikel, und die Abnahme prueft, dass kein Artikel mit
//      unverifizierter Rueckseite ein Ruecken-Mockup bekommt.
//   2. Roly, wortwoertlich aus der Dokumentation: "Ein eigenes BALL-Z-Dekor sollte nicht in das
//      offizielle Roly-Marketingbild hineinmontiert werden, ohne eine separate ausdrueckliche
//      Freigabe." Der Weg dorthin ist also nicht verbaut - er fuehrt ueber eine Freigabe von
//      Roly, nicht ueber unsere Auslegung.
// =============================================================================================

export const MARKEN = {
  roly: {
    name: 'Roly', stufe: 'Ottos Starter', kurz: 'Starter',
    wofuer: 'Wenn viele mitmachen und es günstig bleiben soll.',
    // 25. Sept., Markus: "Ich erlaube dir, die Roly-Sachen zu zeigen, da ich von denen eine
    // Genehmigung habe."
    //
    // Bis hierher stand der Schalter auf false, und zwar aus gutem Grund: Roly erlaubt seine
    // Bilder nur unveraendert ("no editing, recoloring, compositing or other modification"),
    // und ein Motiv daraufzulegen IST eine Bearbeitung. Die Rechtedokumentation nennt aber
    // selbst den Weg heraus, wortwoertlich: "Ein eigenes BALL-Z-Dekor sollte nicht in das
    // offizielle Roly-Marketingbild hineinmontiert werden, OHNE EINE SEPARATE AUSDRUECKLICHE
    // FREIGABE." Genau diese Freigabe hat Markus nach eigener Aussage eingeholt. Der Weg war
    // also nie verbaut, er fuehrte ueber Roly - und da ist er jetzt langgegangen.
    //
    // Festgehalten wird, worauf sich das stuetzt: auf Markus' Angabe vom 25. September, nicht
    // auf ein Schreiben, das ich selbst gesehen haette. Das ist kein Misstrauen, sondern die
    // gleiche Sorgfalt wie beim Gemeindewappen und bei der Unternehmer-Erklaerung: eine
    // Freigabe ohne Datum und ohne Herkunft ist kein Nachweis, sondern eine Erinnerung.
    mockupErlaubt: true,
    freigabe: {
      datum: '2026-09-25',
      von: 'Roly',
      belegt: 'Angabe von Markus, 25.09.2026 - das Schreiben selbst liegt im Code nicht vor',
      umfang: 'Roly-Produktbilder duerfen mit unserem Motiv versehen gezeigt werden'
    },
    // Was die Freigabe NICHT aufhebt, weil es nicht Roly-spezifisch ist: die Regel gegen
    // gespiegelte Rueckansichten ("Keine Spiegelung einer Frontansicht als vermeintliches
    // Backbild") gilt fuer die ganze Linie weiter, und rueckseite: 'NOT_VERIFIED' bleibt an
    // jedem Roly-Artikel stehen. Ein Ruecken-Mockup gibt es erst mit einem echten Rueckenbild.
    nutzung: 'Nur Website und Online-Medien, auch soziale Netze und E-Mail.',
    ablauf: 'Die Nutzungsrechte enden jeden 31. Dezember; die Bilder müssen zu Jahresbeginn neu '
      + 'heruntergeladen und ersetzt werden.',
    quelle: 'https://roly.eu/en/clientArea/marketing-tools/images', geprueft: '2026-09-18'
  },
  bc: {
    name: 'B&C', stufe: 'Ottos Liebling', kurz: 'Liebling',
    wofuer: 'Unsere Mitte: gutes Gewicht, guter Griff, fairer Preis.',
    mockupErlaubt: true,
    bedingungen: [
      'Nur Packshots und Studio-Bilder dekorieren.',
      'B&C-Material nicht mit Material oder Produkten anderer Marken mischen.',
      'Nicht für Amazon oder andere Marktplätze.',
      'Rechte von Fotografen, Modellen und Plattformen beachten.'
    ],
    nutzung: 'Eigene Website, Shop (B2B und B2C) und soziale Netze.',
    offen: 'Die öffentlich auffindbare Richtlinie ist von 2024. Vor dem Produktionsstart bei B&C '
      + 'bestätigen lassen, dass sie 2026 unverändert gilt.',
    quelle: 'https://assets.bc-collection.eu/privacy-policy/Images_Policy_2024_BC.pdf', geprueft: '2026-09-18'
  },
  stanleystella: {
    name: 'Stanley/Stella', stufe: 'Otto Deluxe', kurz: 'Deluxe',
    wofuer: 'Schwerer Stoff, weicher Griff - wenn das Produkt etwas hermachen soll.',
    mockupErlaubt: true,
    bedingungen: [
      'Nur Packshots OHNE Modellkopf verwenden.',
      'Bedruckt wird ausschließlich die Textilfläche.',
      'Modellgesichter nicht mit KI bearbeiten.',
      'Keine Kampagnen- oder Modellbilder für bedruckte Mockups.',
      'Das Herstellerbild nicht umfärben.',
      'Nicht mit Produkten anderer Marken mischen.'
    ],
    nutzung: 'Eigene Website, Shop und soziale Netze. Fremde Seiten und Werbung nur mit '
      + 'vorheriger schriftlicher Erlaubnis.',
    ablauf: 'Die Erlaubnis ist nicht ausschließlich, widerruflich und an die laufende Kollektion '
      + 'gebunden - veraltete Bilder ersetzen.',
    quelle: 'https://stanleystella.com/nl-nl/legal/ip-policy', geprueft: '2026-09-18'
  }
};

// Die achtzehn Artikel: sechs Schnitte in drei Stufen, damit der Kunde nur den Geldbeutel
// wechselt und nicht das Teil. `form` ist die Bruecke zu GARMENTS in mockups.js.
// bild/farben/groessen/beschreibung/preisCent bleiben leer, bis die echten Angaben da sind.
// rueckseite ist ueberall 'NOT_VERIFIED': fuer keinen der achtzehn Artikel liegt ein geprueftes
// Rueckenbild vor, und die Rechtedokumentation verbietet ausdruecklich, eines zu erfinden oder
// die Vorderansicht zu spiegeln.
const T = (marke, id, form, name, nummer, seite, bild, zusatz) => ({
  marke, id, form, name, nummer, seite, bild: bild || '',
  rueckseite: 'NOT_VERIFIED',
  farben: [], groessen: [], beschreibung: '', preisCent: null,
  hinweis: '', dtfGeeignet: null,     // null = ungeklaert, false = vom Hersteller nicht empfohlen
  ...(zusatz || {})
});

// ---------------------------------------------------------------------------------------------
// Fassung 84 (Markus, 18.09.): das vollstaendige Paket
// BALL-Z_CLAUDE_17_ARTIKEL_VOLLSTAENDIG.zip. Damit ist da, was in der Nacht noch fehlte: Farben
// fuer ALLE Artikel (431 statt 77), Gewicht, Passform, Material, Merkmale, die Groessenreihe
// und die Herstellerseite.
// Drei Dinge entscheidet das Paket selbst - ich lege sie deshalb nicht aus:
//   - NEBRASKA 6436 ist ausgeschlossen ("Do not show NEBRASKA 6436."). Der Artikel faellt damit
//     aus der Linie; die Begruendung steht unten bei AUSGESCHLOSSEN, damit sie nicht verloren
//     geht. Aus achtzehn Artikeln sind siebzehn geworden.
//   - Der Zip-Hoodie von Stanley/Stella heiszt Bomber 2.0 (STJU251). Die offene Frage
//     Mixer/Bomber aus dem Drive-Dokument vom 27.07. ist damit beantwortet.
//   - Roly hat jetzt Farben - mit den Herstellercodes, so wie sie dastehen.
// Die Werte liegen in textil-linie.json, Feld fuer Feld aus catalog.json uebernommen, und
// bewuszt in einer eigenen Datei: das naechste Paket ist dann ein Dateitausch statt einer
// Codeaenderung. Was hier im Code steht, sind unsere eigenen Hinweise - die bleiben.
export const PAKET = JSON.parse(fsSync.readFileSync(new URL('./textil-linie.json', import.meta.url), 'utf8'));
export const AUSGESCHLOSSEN = {
  'roly-jacke': {
    name: 'Nebraska', nummer: '6436', marke: 'roly',
    grund: 'Im Paket vom 18.09. ausdrücklich ausgeschlossen. Dazu der ältere Befund aus dem '
      + 'Bildmanifest: Roly empfiehlt für dieses Produkt kein DTF – und wir drucken DTF.'
  }
};

// Die Farblisten, die schon vor dem vollstaendigen Paket im Bildmanifest standen - vier Artikel
// von B&C. Sie bleiben stehen, damit nachrechenbar ist, dass das neue Paket dieselben Farben
// nennt; die Abnahme tut genau das. Die Farbwerte (hex) fehlen in beiden Quellen, deshalb nur
// die Namen, so wie der Hersteller sie nennt - erfundene Farbwerte waeren im Konfigurator
// schlimmer als keine.
export const BC_E190_FARBEN = ['White', 'Natural', 'Sand', 'Solar Yellow', 'Gold', 'Apricot', 'Orange',
  'Urban Orange', 'Sunset Orange', 'Fire Red', 'Red', 'Burgundy', 'Orchid Pink', 'Sorbet',
  'Millennial Lilac', 'Radiant Purple', 'Urban Purple', 'Swimming Pool', 'Atoll',
  'Millennial Mint', 'Black', 'Navy', 'Sport Grey', 'Royal Blue', 'Diva Blue', 'Sky Blue',
  'Stone Blue', 'Navy Blue', 'Cobalt Blue', 'Pixel Lime', 'Orchid Green', 'Kelly Green',
  'Bottle Green', 'Urban Khaki', 'Ash', 'Pacific Grey', 'Dark Grey', 'Used Black'];
const BC_POLO_FARBEN = ['Red', 'Dark Forest', 'Off White', 'Mastic', 'Roasted Coffee',
  'Camo Green', 'Burgundy', 'Ivy Green', 'Navy Pure', 'Meta Turquoise', 'Apple Green',
  'Meta Orange', 'Pixel Lime', 'Meta Lilac', 'Meta Fuchsia', 'Meta Gold', 'Blush Blue',
  'Blush Pink', 'Blush Mint', 'Lavender', 'Pure Orange', 'Solar Yellow', 'Lotus Pink',
  'Radiant Purple', 'Black', 'Navy', 'White', 'Dark Grey', 'Sport Grey', 'Royal Blue'];

export const LINIE = [
  // Otto Deluxe - Stanley/Stella
  T('stanleystella', 'ss-tee', 'tee', 'Creator 2.0', 'STTU169', 'https://stanleystella.com/de-eu/creator-2-0-sttu169'),
  T('stanleystella', 'ss-oversize', 'tee-oversize', 'Freestyler', 'STTU788', 'https://stanleystella.com/de-eu/freestyler-sttu788'),
  T('stanleystella', 'ss-polo', 'polo', 'Prepster 2.0', 'STPU222', 'https://stanleystella.com/de-eu/prepster-2-0-stpu222'),
  T('stanleystella', 'ss-sweater', 'sweater', 'Changer 2.0', 'STSU178', 'https://stanleystella.com/de-eu/changer-2-0-stsu178'),
  T('stanleystella', 'ss-hoodie', 'hoodie', 'Cruiser 2.0', 'STSU177', 'https://stanleystella.com/de-eu/cruiser-2-0-stsu177'),
  // Der einzige Artikel im ganzen Manifest mit geprueft oeffentlicher Bildadresse.
  // ACHTUNG, Abweichung: im Katalog oben steht als Zip-Hoodie noch "Mixer" aus dem
  // Drive-Dokument vom 27.07. Das Manifest vom 18.09. nennt Bomber 2.0. Ich habe den
  // Katalogeintrag NICHT angefasst - Markus muss sagen, welches der beiden gilt.
  T('stanleystella', 'ss-zip', 'zip', 'Bomber 2.0', 'STJU251', 'https://stanleystella.com/de-eu/bomber-2-0-stju251',
    'https://res.cloudinary.com/www-stanleystella-com/t_pim/TechnicalNames/SFM1_STJU251_C727.jpg'),

  // Ottos Liebling - B&C. Die vier Artikel mit echter Farbliste stehen hier mit ihren Farben.
  T('bc', 'bc-tee', 'tee', '#E190', 'TU03T', 'https://www.bc-collection.eu/de/t-shirts/bc-e190-tu03t',
    '', { farben: BC_E190_FARBEN }),
  T('bc', 'bc-oversize', 'tee-oversize', '#E220 Oversized', 'TG001', 'https://www.bc-collection.eu/',
    '', { farben: ['Black', 'White', 'Navy', 'Mastic'] }),
  T('bc', 'bc-polo', 'polo', 'MY POLO 180', 'PU424', 'https://www.bc-collection.eu/',
    '', { farben: BC_POLO_FARBEN, hinweis: '30 Farben von B&C bestätigt.' }),
  T('bc', 'bc-sweater', 'sweater', '#Set In', 'WU01W', 'https://www.bc-collection.eu/'),
  T('bc', 'bc-hoodie', 'hoodie', '#Hoodie', 'WU03W', 'https://www.bc-collection.eu/'),
  T('bc', 'bc-zip', 'zip', 'ID.224 Zip Hood', 'WG009', 'https://www.bc-collection.eu/',
    '', { farben: ['Black', 'Navy', 'Sport Grey', 'Royal Blue', 'Dark Grey'],
          hinweis: '4XL und 5XL gibt es nur in Schwarz.' }),

  // Ottos Starter - Roly. Farbnamen stehen im Manifest nicht; dafuer die Anweisung, den
  // Roly-Farbcode zu behalten und keine Namen aus Drittquellen abzuleiten.
  T('roly', 'roly-tee', 'tee', 'Stafford', '6681', 'https://roly.eu/',
    '', { hinweis: 'Roly-Farbcode behalten, keine Farbnamen aus Drittquellen ableiten.' }),
  T('roly', 'roly-oversize', 'tee-oversize', 'Bull', '6560', 'https://roly.eu/',
    '', { hinweis: 'Roly-Farbcode behalten, keine Farbnamen aus Drittquellen ableiten.' }),
  T('roly', 'roly-polo', 'polo', 'Star', '6638', 'https://roly.eu/',
    '', { hinweis: 'Die Herstellergalerie ist die Farbautorität.' }),
  T('roly', 'roly-sweater', 'sweater', 'Clasica', '1070', 'https://roly.eu/',
    '', { hinweis: 'Roly-Farbcode behalten.' }),
  T('roly', 'roly-hoodie', 'hoodie', 'Capucha', '1087', 'https://roly.eu/',
    '', { hinweis: 'Roly-Farbcode behalten.' }),
  // Hier stand bis Fassung 84 die Roly Nebraska (6436). Sie ist raus: das vollstaendige Paket
  // vom 18.09. schlieszt sie aus. Der Grund, warum sie ohnehin nie haette verkauft werden
  // duerfen, steht in AUSGESCHLOSSEN - Roly empfiehlt fuer dieses Teil kein DTF, und wir
  // drucken DTF. Ottos Starter hat damit keinen Zip-Artikel mehr.
];

// ---------------------------------------------------------------------------------------------
// DIE RUECKANSICHTEN (25. Sept. 2026)
//
// Markus: "Warum haben wir keine Rueckansicht? Besorge die noch!"
//
// Die Antwort auf das Warum stand in dieser Datei: T() setzt rueckseite pauschal auf
// 'NOT_VERIFIED', weil das Manifest keine Rueckenbilder mitgeliefert hat - und geholt hat sie
// danach niemand. Dabei stand der Weg schon in textil-bilder/quellen.json: dort ist "PBM0 =
// Packshot HINTEN" notiert und fuer die Zip-Jacke auch benutzt worden. Nur fuer die uebrigen
// Artikel hat das nie jemand nachgezogen.
//
// GERATEN WURDE NICHTS. Das Manifest verbietet ausdruecklich, Bildadressen zu erfinden. Also:
// die dokumentierten Muster genommen (Stanley/Stella PBM0 statt PFM0, Roly _2_ statt _1_),
// jede Adresse wirklich abgerufen - und dann jedes einzelne der 21 Bilder angesehen. Alle 21
// zeigen den Ruecken: Kapuze von hinten, keine Knopfleiste, keine Bauchtasche, kein
// Reissverschluss vorn. Was nicht abrufbar war, ist nicht dabei.
//
// B&C FEHLT WEITERHIN. Ihre Bildadressen tragen keine Ansichtsnummer, die sich ableiten
// liesze (TU03T_P_BC_001_01 mit _02, _03, _B: alles 404). Dort etwas zu konstruieren waere
// genau das Raten, das verboten ist. Die sechs B&C-Rueckenbilder muessen aus ihrem
// Kundenbereich kommen - bis dahin bleibt es bei NOT_VERIFIED, und es gibt fuer sie kein
// Ruecken-Mockup.
//
// Die Regel, die das alles ausgeloest hat, bleibt unangetastet: "Keine Spiegelung einer
// Frontansicht als vermeintliches Backbild." Genau deshalb wurde hier gesucht statt gespiegelt.
export const RUECKANSICHT_GEHOLT = '2026-09-25';
const RUECKSEITE_DA = {
  // Stanley/Stella: PBM0_<Nummer>_<Farbcode>.jpg auf ihrem Cloudinary-Speicher
  'ss-tee': 'PBM0_STTU169', 'ss-oversize': 'PBM0_STTU788', 'ss-polo': 'PBM0_STPU222',
  'ss-sweater': 'PBM0_STSU178', 'ss-hoodie': 'PBM0_STSU177', 'ss-zip': 'PBM0_STJU251',
  // Roly: p_<Modell>_<Farbe>_2_1.jpg auf ihrem Bildspeicher (_2_ = hinten)
  'roly-tee': 'p_6681_*_2_1', 'roly-oversize': 'p_6560_*_2_1', 'roly-polo': 'p_6638_*_2_1',
  'roly-sweater': 'p_1070_*_2_1', 'roly-hoodie': 'p_1087_*_2_1'
};
for (const a of LINIE) if (RUECKSEITE_DA[a.id]) a.rueckseite = RUECKSEITE_DA[a.id];

// Das Paket ueber die Linie legen. Nur, was im Paket wirklich steht - unsere eigenen Angaben
// (bild, rueckseite, hinweis, dtfGeeignet, preisCent) bleiben unberuehrt, dazu sagt es nichts.
// Der Anzeigename bleibt unserer ("Stafford"); wie der Hersteller schreibt ("STAFFORD"), steht
// daneben, damit eine Bestellung beim Hersteller eindeutig bleibt.
for (const a of LINIE) {
  const p = PAKET.artikel[a.id];
  if (!p) { console.warn('Textil-Linie: kein Paketeintrag fuer', a.id); continue; }
  a.nummer = p.nummer;
  a.seite = p.seite;
  a.kategorie = p.kategorie;
  a.gramm = p.gramm;
  a.passform = p.passform;
  a.material = p.material;
  a.merkmale = p.merkmale;
  a.groessen = p.groessen;
  a.groessenRoh = p.groessenRoh;
  a.nameHersteller = p.name;
  if (p.farben.length) a.farben = p.farben;
  // Die Bildquelle. WICHTIG, weil es sich leicht verwechseln laeszt: das ist die offizielle
  // PRODUKTSEITE, auf der die Fotos liegen - keine Bilddatei. Das Paket sagt es selbst:
  // "direct binary not embedded in this package", "MANUAL/WEB DOWNLOAD REQUIRED". Deshalb
  // bleibt `bild` leer, bis eine echte Datei da ist, und `bildQuelle` sagt, wo sie zu holen ist.
  // Ohne diese Trennung stuende irgendwann eine Produktseite im src eines <img>.
  a.bildQuelle = p.bildQuelle || '';
  a.bildStatus = p.bildStatus || '';
  a.bildRegel = p.bildRegel || '';
  // Die Beschreibung wird NICHT gedichtet, sondern aus den gelieferten Angaben gesetzt:
  // Gewicht, Passform, Material. Der Brief im Paket sagt dasselbe - "from the supplied facts
  // only. Do not invent certifications, stock, wholesale prices or exact current retail prices."
  a.beschreibung = `${p.gramm} g/m² · ${p.passform} · ${p.material}`;
}

// Formen, fuer die es in mockups.js noch gar keine Vorlage gibt. Wer hier steht, bekommt kein
// Mockup - und zwar nicht aus Rechtsgruenden, sondern weil schlicht kein Produktfoto da ist.
export const FORMEN_OHNE_VORLAGE = ['tee-oversize', 'sweater'];

// Darf von diesem Artikel ein Mockup MIT unserem Druck gezeigt werden? Keine Geschmacksfrage,
// sondern die Rechtslage der Marke.
export function linieMockupErlaubt(artikelId) {
  const a = LINIE.find((x) => x.id === artikelId);
  return !!(a && MARKEN[a.marke] && MARKEN[a.marke].mockupErlaubt);
}

// Verkaufsfertig ist ein Artikel erst mit Bild, Farben, Groessen und Preis. Lieber ein Artikel
// weniger als einer, bei dem der Kunde eine Farbe waehlt, die es nicht gibt.
// Ein Artikel, den der Hersteller nicht fuer DTF empfiehlt, ist hier NIE bereit - wir drucken
// DTF, und ein Teil, das das nicht mitmacht, gehoert nicht in den Verkauf.
export function linieBereit(a) {
  if (!a || a.dtfGeeignet === false) return false;
  return !!(a.bild && a.farben.length && a.groessen.length && a.preisCent);
}

// Darf von diesem Artikel ein RUECKEN-Mockup gezeigt werden? Nur mit geprueftem Rueckenbild.
// Die Rechtedokumentation, wortwoertlich: "Keine Spiegelung einer Frontansicht als
// vermeintliches Backbild." makeMockup() tut genau das bei T-Shirt und Hoodie - mit unseren
// eigenen Vorlagen ist das unsere Sache, mit diesen Herstellerbildern nicht.
export function linieRueckenErlaubt(artikelId) {
  const a = LINIE.find((x) => x.id === artikelId);
  return !!(a && a.rueckseite && a.rueckseite !== 'NOT_VERIFIED' && linieMockupErlaubt(artikelId));
}

// Was fehlt noch, Artikel fuer Artikel - fuer das Backend und die Abnahme.
export function linieBericht() {
  return {
    gesamt: LINIE.length,
    bereit: LINIE.filter(linieBereit).length,
    ohneMockuprecht: LINIE.filter((a) => !MARKEN[a.marke].mockupErlaubt).length,
    zeilen: LINIE.map((a) => ({
      id: a.id, marke: MARKEN[a.marke].name, stufe: MARKEN[a.marke].stufe,
      name: a.name, nummer: a.nummer, form: a.form,
      mockup: MARKEN[a.marke].mockupErlaubt ? 'erlaubt' : 'NICHT erlaubt',
      fehlt: [
        a.bild ? null : 'Bild', a.farben.length ? null : 'Farben',
        a.groessen.length ? null : 'Größen', a.beschreibung ? null : 'Beschreibung',
        a.preisCent ? null : 'Preis', a.dtfGeeignet === false ? 'DTF ungeeignet' : null
      ].filter(Boolean)
    }))
  };
}

// Lieferantendaten nachtragen. Erwartet pro Textil:
//   { gramm, schnitt, details, preis, artikelLieferant,
//     farben: [{ key, name, hex, artikel }],
//     masse:  { 'M': { laenge: 72, breite: 52 }, ... },
//     fotos:  { 'schwarz': { vorn: '<url>', hinten: '<url>' }, ... } }
// Vorhandene Werte werden nur ueberschrieben, wenn im Nachtrag wirklich etwas steht -
// die verbindlichen Stanley/Stella-Angaben oben gehen dabei nicht verloren.
export function katalogErgaenzen(daten) {
  for (const [key, neu] of Object.entries(daten || {})) {
    const t = TEXTILIEN[key];
    if (!t || !neu) continue;
    for (const feld of ['marke', 'modell', 'material', 'gramm', 'schnitt', 'details', 'artikelLieferant']) {
      if (neu[feld] != null && neu[feld] !== '') t[feld] = neu[feld];
    }
    if (typeof neu.preis === 'number') t.preis = neu.preis;
    if (Array.isArray(neu.groessen) && neu.groessen.length) t.groessen = neu.groessen;
    if (Array.isArray(neu.farben) && neu.farben.length) t.farben = neu.farben;
    if (neu.masse) Object.assign(t.masse, neu.masse);
    if (neu.fotos) Object.assign(t.fotos, neu.fotos);
  }
  return katalogLuecken();
}
