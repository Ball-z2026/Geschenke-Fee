// Preise, Staffel, zweite Druckseite und Versand - eine Quelle fuer Server und Browser.
// Die Zahlen kommen 1:1 aus der Preisvorgabe. Nichts hier ist geschaetzt oder gerundet abgelegt.
//
// Wichtig beim Rechnen: der Stueckpreis wird ERST auf zwei Stellen gerundet, DANN mit der Menge
// multipliziert. Die Gegenrechnung in der Vorgabe geht nur so auf (25 x (19,42 + 4,90) = 608,00).
//
// Browser:  <script src="/preise.js"></script>  ->  window.MoPreise   (Route liefert diese Datei)
// Node:     import preise from './preise.cjs'   (.cjs, damit es in diesem ESM-Projekt ladbar bleibt)

(function (root, bauen) {
  var M = bauen();
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.MoPreise = M;
})(typeof self !== 'undefined' ? self : this, function () {

  // ---- Textilien mit drei Stufen (nur Shirt, Hoodie, Zip) ----
  var STUFEN = [
    { key: 'starter',  label: 'Ottos Starter' },
    { key: 'liebling', label: 'Ottos Liebling', standard: true, hinweis: 'Empfohlen' },
    { key: 'deluxe',   label: 'Otto Deluxe',    unterzeile: 'Bio, Stanley/Stella' }
  ];

  // ALLE Preise hier sind BRUTTO, also inklusive 19 % Umsatzsteuer. Das ist die Zahl, die
  // Privatkunden sehen muessen (Preisangabenverordnung). Firmenkunden bekommen daraus den
  // Nettopreis gerechnet - siehe netto()/warenkorb({ netto: true }) weiter unten.
  var TEXTIL = {
    tee:    { label: 'Shirt',     starter: 19.90, liebling: 24.90, deluxe: 32.90 },
    // 23. Sept.: Polo wurde gezeigt, hatte aber keinen Preis. Markt fuer ein einzeln bedrucktes
    // Polo: Shirtlabor 14,90-29,90 Grundpreis zuzueglich Druck, Tshirtdeal ab 12 - einzeln
    // landet man bei 25-35. Wir liegen dazwischen, wie bei allen anderen Artikeln auch.
    polo:   { label: 'Polo',      starter: 24.90, liebling: 29.90, deluxe: 39.90 },
    hoodie: { label: 'Hoodie',    starter: 39.90, liebling: 49.90, deluxe: 64.90 },
    zip:    { label: 'Zip-Jacke', starter: 42.90, liebling: 52.90, deluxe: 69.90 }
  };

  // ---- Merch: ein Preis, keine Stufen ----
  // 23. Sept., Markus: "Recherchiere die Preise ... wir moechten nicht die guenstigsten sein,
  // aber natuerlich auch nicht die teuersten." Die Marktpreise in den Kommentaren sind
  // nachgeschlagen (Quellen in PREISE.md). Die vier Artikel ohne Kommentar (Tasse, Kissen,
  // Poster, Sticker) stehen seit der ersten Preisvorgabe so da und wurden nicht angefasst.
  var MERCH = {
    tasse:            { label: 'Tasse',            preis: 14.90 },
    strandtuch:       { label: 'Strandtuch',       preis: 34.90 },   // Markt: Duschtuch 70x140 ab 39,90 (PrintPlanet) - wir lagen mit 32,90 darunter
    kissen:           { label: 'Kissen',           preis: 24.90 },
    poster:           { label: 'Poster (A2)',      preis: 16.90 },
    sticker:          { label: 'Sticker-Pack',     preis:  7.90 },
    beutel:           { label: 'Beutel',           preis: 14.90 },   // gleiche Klasse wie die Tasse
    handtuch:         { label: 'Handtuch',         preis: 26.90 },   // Markt: 50x100 ab 25,90 (PrintPlanet)
    fussmatte:        { label: 'Fußmatte',         preis: 27.90 },   // Markt: 60x40 24,95 (Personello)
    // 24. Sept., Markus: "Das Mauspad in der Groesse kommt mir sehr guenstig vor." Er hatte
    // recht. Der Anker "Tassendruck 20,95" stand OHNE GROESSE in PREISE.md - und es ist ein
    // ab-Preis fuer vier Groessen. Wer genau unser Format 70x30 fuehrt (Mauspad-Zone), nimmt
    // 29,90. Mitte der beiden Anker: rund 25,40.
    mousepad:         { label: 'XXL-Mousepad',     preis: 25.90 },   // Markt: 20,95 ab-Preis (Tassendruck, vier Groessen) bis 29,90 fuer 70x30 (Mauspad-Zone)
    hundedecke:       { label: 'Hundedecke',       preis: 24.90 },   // Markt: ab 17,95 in dieser Groesse (Contrado)
    acrylbild:        { label: 'Acrylbild (A4)',   preis: 24.90 },   // Markt: Direktdruck ab 15,95, Gallery-Bond ab 29,95 (Kartenliebe)
    tuerschild:       { label: 'Türschild',        preis: 19.90 },   // Markt: PVC graviert ab 7 (exaschilder), Metall ab 29,95 (Herzensprojekt)
    napfunterlage:    { label: 'Napfunterlage',    preis: 19.90 },   // Markt: 45x25 cm 17,99 statt 20,95 (Rossmann Fotowelt)
    brotdose:         { label: 'Brotdose',         preis: 17.90 },   // Markt: Kunststoff 12,90, Mepal Bento 29,90, Alu 29,90 (PrintPlanet)
    gepaeckanhaenger: { label: 'Gepäckanhänger',   preis: 11.90 },   // Markt: Aluminium 6,4x11,1 cm 10,40 (PrinterStudio)
    grillschuerze:    { label: 'Grillschürze',     preis: 19.90 }    // 8. Okt.: Markt: Drucksaal 14,95 (Druck 25x25), personalisiert bei eBay rund 17 - Vorschlag, Markus entscheidet
  };

  // ---- Staffel: vorerst NUR fuer Textilien (Shirt, Hoodie, Zip). Merch bleibt immer beim Listenpreis.
  // Auch die Stufe richtet sich allein nach der Zahl der Textilien - eine Tasse hebt sie nicht an.
  // Fuer den Versand zaehlen dagegen alle Artikel zusammen, das ist unveraendert. ----
  var STAFFEL = [
    { ab: 50, rabatt: 0.28 },
    { ab: 25, rabatt: 0.22 },
    { ab: 20, rabatt: 0.18 },
    { ab: 10, rabatt: 0.12 },
    { ab: 5,  rabatt: 0.08 },
    { ab: 1,  rabatt: 0    }
  ];

  var ZWEITE_SEITE = 4.90;      // je Stueck, nur Shirt/Hoodie/Zip, ohne Rabatt
  var VERSAND = 4.90;
  var VERSANDFREI_AB_ARTIKEL = 4;
  var VERSANDFREI_AB_WERT = 79.00;

  // ---- Umsatzsteuer ----
  // 23. Sept., Markus: "Kunden mit Mehrwertsteuer anzeigen und bei Firmenkunden immer die
  // Nettopreise." Rechtlich ist das keine Geschmacksfrage: gegenueber Verbrauchern MUSS der
  // Gesamtpreis inklusive Umsatzsteuer stehen (Preisangabenverordnung), gegenueber Unternehmern
  // darf und soll netto ausgezeichnet werden.
  //
  // Die Brutto-Zahl bleibt die Quelle. Netto wird daraus gerechnet, nicht umgekehrt - sonst
  // stuende beim Privatkunden am Ende 24,89 statt 24,90, und genau die Zahl hat er gesehen.
  var MWST = 0.19;
  function netto(brutto) { return rund(brutto / (1 + MWST)); }
  function steuer(brutto) { return rund(brutto - netto(brutto)); }

  var hatStufen = function (key) { return !!TEXTIL[key]; };
  var istBekannt = function (key) { return !!TEXTIL[key] || !!MERCH[key]; };
  // 1. Okt., Markus: "das Schneidebrett nehmen wir komplett raus, ueberall." Aus MERCH gestrichen
  // (Startseite, Preisliste, Warenkorb); das Label bleibt fuer alte Bestellungen lesbar.
  var AUSSER_HANDEL = { brett: { label: 'Schneidebrett' } };
  var label = function (key) { return (TEXTIL[key] || MERCH[key] || AUSSER_HANDEL[key] || {}).label || key; };

  // kaufmaennisch auf zwei Stellen - ohne das Epsilon kippt 19.422 je nach Rechenweg
  function rund(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

  function euro(v) {
    try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v); }
    catch (e) { return rund(v).toFixed(2).replace('.', ',') + ' €'; }
  }

  function rabattFuer(anzahl) {
    for (var i = 0; i < STAFFEL.length; i++) if (anzahl >= STAFFEL[i].ab) return STAFFEL[i].rabatt;
    return 0;
  }

  function listenpreis(key, stufe) {
    if (TEXTIL[key]) {
      var s = stufe && TEXTIL[key][stufe] !== undefined ? stufe : 'liebling';
      return TEXTIL[key][s];
    }
    return MERCH[key] ? MERCH[key].preis : 0;
  }

  // Stueckpreis nach Staffel, ohne Aufpreis fuer die zweite Seite.
  // anzahl = Zahl der Textilien im Korb; bei Merch ohne Wirkung.
  function stueckpreis(key, stufe, anzahl) {
    const r = hatStufen(key) ? rabattFuer(anzahl) : 0;
    return rund(listenpreis(key, stufe) * (1 - r));
  }

  /**
   * Warenkorb rechnen.
   * @param {Array} positionen  [{ artikel:'tee', stufe:'liebling', menge:12, zweiteSeite:false }]
   * @param {Object} [opts]     { netto: true } fuer Firmenkunden - dieselbe Rechnung, netto ausgewiesen
   * @returns {{posten:Array, artikel:number, rabatt:number, ware:number, versand:number, gesamt:number, versandfrei:boolean}}
   */
  function warenkorb(positionen, opts) {
    var liste = (positionen || []).filter(function (p) { return p && istBekannt(p.artikel) && (+p.menge || 0) > 0; });
    var artikel = liste.reduce(function (n, p) { return n + Math.floor(+p.menge); }, 0);
    // Die Staffel zaehlt nur die Textilien. Zehn Tassen bringen also keinen Rabatt aufs Shirt.
    var textilien = liste.reduce(function (n, p) { return n + (hatStufen(p.artikel) ? Math.floor(+p.menge) : 0); }, 0);
    var rabatt = rabattFuer(textilien);

    var posten = liste.map(function (p) {
      var menge = Math.floor(+p.menge);
      var stufe = hatStufen(p.artikel) ? (p.stufe || 'liebling') : null;
      var mitStaffel = hatStufen(p.artikel);
      var stueck = rund(listenpreis(p.artikel, stufe) * (1 - (mitStaffel ? rabatt : 0)));
      var seite2 = (hatStufen(p.artikel) && p.zweiteSeite) ? ZWEITE_SEITE : 0;   // ohne Rabatt
      return {
        artikel: p.artikel, label: label(p.artikel), stufe: stufe,
        stufeLabel: stufe ? (STUFEN.filter(function (s) { return s.key === stufe; })[0] || {}).label : null,
        menge: menge, listenpreis: listenpreis(p.artikel, stufe), rabatt: mitStaffel ? rabatt : 0,
        stueck: stueck, zweiteSeite: !!seite2, seite2: seite2,
        summe: rund((stueck + seite2) * menge)
      };
    });

    var ware = rund(posten.reduce(function (s, p) { return s + p.summe; }, 0));
    var versandfrei = artikel >= VERSANDFREI_AB_ARTIKEL || ware >= VERSANDFREI_AB_WERT;
    var versand = versandfrei ? 0 : VERSAND;
    var gesamt = rund(ware + versand);

    // Firmenkunde: dieselbe Rechnung, nur netto ausgewiesen. Gerechnet wird weiter in Brutto -
    // die Staffel und die Rundung bleiben damit Zeichen fuer Zeichen dieselben, und die
    // Umsatzsteuer ist die Differenz zum Gesamtbetrag. Wuerde man je Posten netto rechnen und
    // dann aufaddieren, wiche die Summe um Cents vom Bruttopreis ab, den der Kunde gesehen hat.
    var nettoAnsicht = !!(opts && opts.netto);
    var gesamtNetto = netto(gesamt);
    var ergebnis = {
      posten: posten, artikel: artikel, textilien: textilien, rabatt: rabatt,
      ware: ware, versand: versand, versandfrei: versandfrei, gesamt: gesamt,
      // immer beides mitliefern, damit die Seite nicht selbst rechnen muss
      netto: nettoAnsicht, mwstSatz: MWST,
      wareNetto: netto(ware), versandNetto: netto(versand),
      gesamtNetto: gesamtNetto, mwst: rund(gesamt - gesamtNetto)
    };
    if (nettoAnsicht) for (var i = 0; i < posten.length; i++) {
      posten[i].stueckNetto = netto(posten[i].stueck);
      posten[i].seite2Netto = netto(posten[i].seite2);
      posten[i].summeNetto = netto(posten[i].summe);
    }
    return ergebnis;
  }

  return {
    STUFEN: STUFEN, TEXTIL: TEXTIL, MERCH: MERCH, STAFFEL: STAFFEL,
    ZWEITE_SEITE: ZWEITE_SEITE, VERSAND: VERSAND,
    VERSANDFREI_AB_ARTIKEL: VERSANDFREI_AB_ARTIKEL, VERSANDFREI_AB_WERT: VERSANDFREI_AB_WERT,
    hatStufen: hatStufen, istBekannt: istBekannt, label: label,
    listenpreis: listenpreis, stueckpreis: stueckpreis, rabattFuer: rabattFuer,
    warenkorb: warenkorb, euro: euro, rund: rund,
    MWST: MWST, netto: netto, steuer: steuer
  };
});
