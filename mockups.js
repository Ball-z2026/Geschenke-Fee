import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Textil-Vorlagen: Produktfotos ohne Druck, plus die Druckflaeche in Pixeln der 1024er-Vorlage.
// Die Bilder werden beim ersten Start einmal heruntergeladen und auf dem Volume abgelegt.
// flaecheCm: wofuer die box in echten Zentimetern steht. Ohne diese Angabe wird jedes Motiv
// formatfuellend in die box gelegt - ein 10-cm-Brustprint sah dann aus wie ein Frontprint ueber
// die ganze Brust, und die Bemassung daneben sagte 9,4 cm. Bild und Zahl widersprachen sich.
// Mit der Angabe wird das Motiv in dem Verhaeltnis gezeichnet, in dem es wirklich auf dem Teil
// landet. Das Mass ist die volle Druckflaeche vorne, 36 x 46 cm - dieselbe, die jede Druckdatei
// ohne besondere Platzierung bekommt (PRINT_MAX_CM in images.js).
export const GARMENTS = {
  tee:    { label: 'T-Shirt',   view: 'vorn',    flaecheCm: [36, 46], box: { x: 330, y: 250, w: 370, h: 555 } },
  // Polo: der Klassiker fuer Firmen- und Arbeitskleidung. Die Druckflaeche sitzt etwas tiefer und
  // schmaler als beim T-Shirt, weil Kragen und Knopfleiste oben Platz brauchen.
  // 22. Sept., Markus: "Bei Polos passt der Front Print nicht in die Mitte. Bei einem Polo gehoert
  // ein Front Print auf die Hauptseite und das kleiner." Stimmt - mittig laeuft die Knopfleiste,
  // ein grosses Motiv reitet darauf. Auf dem Polo ist der Brustdruck der Frontdruck: linke
  // Brustseite des Traegers (im Foto rechts), rund 10 cm breit. Als Anteil der Druckflaeche
  // notiert, nicht in Pixeln - dann stimmt die Stelle auch auf den Herstellerfotos (bc-polo,
  // ss-polo), deren Flaeche ein Stueck anders sitzt.
  polo:   { label: 'Polo',      view: 'vorn',    flaecheCm: [36, 46], box: { x: 345, y: 300, w: 340, h: 470 },
            brustLinks: { xAnteil: 0.815, yAnteil: 0.181, cm: 10 } },
  hoodie: { label: 'Hoodie',    view: 'vorn',    flaecheCm: [36, 46], box: { x: 384, y: 215, w: 257, h: 385 } },
  zip:    { label: 'Zip-Jacke', view: 'hinten',  flaecheCm: [36, 46], box: { x: 332, y: 300, w: 360, h: 540 } },
  // 21. Sept., Markus (Startseiten-Band, Postkarte auf der Tasse): "nicht an der Tasse
  // ausgerichtet - Katastrophe." Die Flaeche sass links neben der Tassenmitte, und das Motiv
  // lag flach auf. Gemessen an den Herstellerfotos: der Tassenkoerper liegt bei x 260-710 (weiss)
  // und 240-706 (schwarz). Die Flaeche ist jetzt der sichtbare Koerper, und zylinder: true legt
  // das Motiv um die Woelbung (mockups: zylindrisch) - an den Raendern kuerzer und dunkler.
  // 21. Sept., Markus: "Bei einer Tasse ist die vollflaechig bedruckt - voll, voll, vollflaechig.
  // Recherchiere, wie's richtig gemacht wird." Recherchiert (fototasse.com, giftcampaign.de,
  // merkur-werbemittel.de): Sublimationstassen tragen einen Rundumdruck von 19-20 x 8-9 cm, der
  // Streifen am Henkel bleibt frei.
  // 08:05, Markus: "Recherchiere bitte, wie eine Tasse aussieht mit einem vollflaechigen Druck
  // komplett einmal rum." Panoramatasse (pixelnet.de: 20 x 8,9 cm; die-fototasse.de: 19 x 8,05 cm;
  // fototassen.de: "Druck vom Boden bis zum Trinkrand", "rechts und links vom Henkel bleibt
  // daumenbreit eine weisse Flaeche"). Also 20 x 8,9 cm auf 9,5 cm Hoehe und 25,8 cm Umfang:
  // der Druck laeuft ueber 279 Grad, vorn sieht man den halben Umfang bis zur Silhouette,
  // gewoelbt (zylindrisch). Die box ist der GANZE Tassenkoerper je Farbe (BOX_OVERRIDES),
  // ellipse = wie viel hoeher Ober- und Unterkante am Rand liegen als vorn (Trinkrand-Ellipse).
  // 22. Sept., Markus: "Es muss immer so aussehen, als waere es original in der Umgebung" - die
  // Tasse steht auf dem Fruehstueckstisch (tasse-szene), Zylinder dort abgemessen (BOX_OVERRIDES).
  tasse:  { label: 'Tasse',     view: 'vorn',    voll: true, flaecheCm: [20, 8.9], umfangCm: 25.8, hoeheCm: 9.5, box: { x: 266, y: 275, w: 449, h: 520 }, sizes: false, zylinder: true, szene: { label: 'Auf dem Frühstückstisch', box: { x: 278, y: 240, w: 432, h: 544 } } },
  // 23. Sept., Markus: "Die Beutel sind nicht ordentlich befuellt. Wir haben gesagt, dass jeder
  // Artikel, der ausserhalb von Textilien zu sehen ist, extra designt wird."
  // Nachgesehen, wie ein Baumwollbeutel wirklich bedruckt wird (siehe DRUCKPOSITIONEN.md):
  // Standardbeutel 38 x 42 cm, Druckflaeche bei den meisten Anbietern 30 x 30 cm je Seite,
  // Verfahren DTF (Sublimation ginge nur auf weissem Polyester, nicht auf Baumwolle).
  // Bis hierher stand die ganze Beutelflaeche als Druckflaeche drin - ein Hochformat-Shirtmotiv
  // wurde darin eingepasst und sass klein und hoch. Jetzt die ehrliche Flaeche: ein QUADRAT.
  // Die Zahlen kommen aus dem bisherigen, am Foto gemessenen Kasten (340 px = 38 cm, also
  // Korpus am Foto ausgemessen: 453 px = 38 cm (11,92 px/cm) und 576 px = 42 cm (13,71 px/cm).
  // Das Foto ist leicht gestaucht, darum ist der Kasten fuer 30 x 30 cm nicht quadratisch -
  // genau so sitzt der Druck perspektivisch richtig. 6 cm Luft oben, 6 cm unten.
  beutel: { label: 'Beutel',    view: 'vorn',    flaecheCm: [30, 30], box: { x: 369, y: 482, w: 358, h: 411 }, sizes: false },
  // 8. Okt., Markus: "Und nehme bitte als Artikel noch eine Grillschuerze auf." Baumwoll-Canvas,
  // DTF auf der Brust. Druckflaeche 25 x 25 cm wie bei Drucksaal (drucksaal.de, Grillschuerze -
  // Latzschuerze, "Druckflaeche 25 x 25 cm"). Am Foto: Schuerze unten 520 px = 70 cm (7,4 px/cm),
  // also 186 px; mittig, 8 cm unter der Oberkante des Latzes (y 180 + 60).
  grillschuerze: { label: 'Grillschürze', view: 'vorn', flaecheCm: [25, 25], box: { x: 419, y: 240, w: 186, h: 186 }, sizes: false },
  // Fassung 73 (Markus, 17. Sept.: "Bei Handtuch und solchen Artikeln - wir machen doch einen
  // Vollflaechendruck"). Er hat recht, und der Fehler steckte schon in den bestehenden Mockups:
  // Bei Sublimation und UV gibt es keine Druckflaeche AUF dem Teil - das Teil IST die
  // Druckflaeche, das Motiv laeuft von Kante zu Kante. Die box ist bei diesen Artikeln also
  // nicht "wo der Aufdruck sitzt", sondern "wo das Teil im Foto liegt", und das Motiv wird
  // formatfuellend hineingelegt (voll: true), nicht mittig daraufgesetzt.
  // 19. Sept., 04:48, Markus: "Auf dem Strandtuch ist ein Rand." Gemessen am Herstellerfoto
  // (Pixel heller als der Studiogrund): das Tuch liegt bei x 310-713, y 73-949. Die Flaeche hier
  // stand bei y 120-920 - 47 px Tuch oben und 30 px unten blieben weisz, und genau das war der
  // Rand. Jetzt ist die Flaeche das Tuch.
  strandtuch: { label: 'Strandtuch', view: 'vorn', voll: true, flaecheCm: [70, 140], box: { x: 310, y: 73, w: 404, h: 877 }, sizes: false },
  kissen:     { label: 'Kissen',     view: 'vorn', voll: true, flaecheCm: [40, 40], box: { x: 275, y: 300, w: 475, h: 430 }, sizes: false },
  poster:     { label: 'Poster',     view: 'vorn', voll: true, box: { x: 270, y: 150, w: 470, h: 700 }, sizes: false },
  sticker:    { label: 'Sticker',    view: 'vorn', box: { x: 250, y: 230, w: 520, h: 520 }, sizes: false },
  // Fassung 73 (Markus, 17. Sept.: "Ein Handtuch kann ja zum Beispiel auch am Strand haengen,
  // einmal als Ansicht und einmal schon fertig ... das muss alles viel schoener werden"):
  // Ein Artikel darf zwei Ansichten haben. Die PRODUKT-Ansicht ist sachlich und zeigt mit der
  // Bemassung, was der Kunde bekommt - danach entscheidet er. Die SZENE zeigt dasselbe Teil in
  // Benutzung, ohne Masslinien - dafuer entscheidet er sich. Beide zeigen dasselbe Design.
  // Fussmatte: liegt flach auf dem Boden, von oben fotografiert - dadurch ist die bedruckte
  // Flaeche im Bild ein sauberes Rechteck, und das Motiv laesst sich formatfuellend einlegen.
  // 22. Sept., Markus: "Die Fussmatte liegt doch anders vor der Tuer, d. h. das Format ist falsch."
  // Quer (60 x 40), so wie sie vor der Tuer liegt; Vorlagen in MITGELIEFERT (fussmatte, fussmatte-szene).
  fussmatte: {
    label: 'Fußmatte', view: 'vorn', sizes: false, voll: true, flaecheCm: [60, 40],
    box: { x: 44, y: 223, w: 934, h: 585 },
    szene: { label: 'Vor der Haustür', box: { x: 90, y: 337, w: 844, h: 506 } }
  },
  handtuch: {
    label: 'Handtuch', view: 'vorn', sizes: false, voll: true, flaecheCm: [50, 100],
    // 21. Sept.: Flaechen im Verhaeltnis des Artikels (1:2), siehe MITGELIEFERT handtuch / handtuch-szene
    box: { x: 303, y: 32, w: 418, h: 955 },
    szene: { label: 'Am Strand', box: { x: 272, y: 31, w: 474, h: 962 } }
  },

  // ---------- Fassung 85: die sieben Artikel, die bisher gar keine Vorlage hatten ----------
  // Markus, 18. Sept.: "Wir brauchen von jedem Artikel ein geiles Mockup." Diese sieben waren
  // verkaufsfaehig, aber ohne Bild - der Kunde sah nur das nackte Motiv.
  // Alle sind FLACHWARE (voll: true): das Teil ist die Druckflaeche, das Motiv laeuft von Kante
  // zu Kante. Genau dafuer kann die Flaeche sich selbst messen (vorlagen.js).
  // Die box hier ist nur ein STARTWERT, bis die erste eigene Vorlage erzeugt und vermessen ist -
  // danach gilt die gemessene (gelernteBox). Ein Startwert, der nie greift, waere sauberer;
  // ohne ihn wuerde makeMockup aber abbrechen, bevor ueberhaupt etwas erzeugt werden kann.
  // 21. Sept.: flaecheCm ist die ERSTE Groesse des Artikelkatalogs (die Abnahme misst beide
  // Quellen gegeneinander) - seit die sieben in ARTIKEL_ANSICHT stehen, gilt das auch hier.
  // Hundedecke 70x50, Acrylbild A4, Napfunterlage 40x30 standen vorher auf der zweiten Groesse.
  // Fuer ein eigenes Design zaehlt ohnehin das bestellte Mass (artikel.netto). Das Brett bleibt
  // bei 40x30 und ohne Eintrag in ARTIKEL_ANSICHT: mit 30x20 kaeme es in die Postkarten-Reihe
  // (Tasse, Poster, Acrylbild, Tuerschild - Abnahme 9), und die hat Markus so festgelegt.
  mousepad: {
    label: 'XXL-Mousepad', view: 'vorn', sizes: false, voll: true, flaecheCm: [70, 30],
    box: { x: 112, y: 292, w: 800, h: 343 },
    szene: { label: 'Auf dem Schreibtisch', box: { x: 112, y: 292, w: 800, h: 343 } }
  },
  hundedecke: {
    label: 'Hundedecke', view: 'vorn', sizes: false, voll: true, flaecheCm: [70, 50],
    box: { x: 154, y: 266, w: 716, h: 501 },
    szene: { label: 'Im Körbchen', box: { x: 154, y: 266, w: 716, h: 501 } }
  },
  acrylbild: {
    label: 'Acrylbild', view: 'vorn', sizes: false, voll: true, flaecheCm: [21, 29.7],
    box: { x: 331, y: 210, w: 362, h: 512 },
    szene: { label: 'An der Wand', box: { x: 331, y: 210, w: 362, h: 512 } }
  },
  tuerschild: {
    label: 'Türschild', view: 'vorn', sizes: false, voll: true, flaecheCm: [20, 30],
    box: { x: 341, y: 220, w: 341, h: 512 },
    szene: { label: 'An der Tür', box: { x: 341, y: 220, w: 341, h: 512 } }
  },
  brett: {
    // 1. Okt., Markus: "das Schneidebrett nehmen wir komplett raus, ueberall." Der Eintrag bleibt
    // fuer alte Designs lesbar (Mockups, Label), aber aus = true nimmt ihn aus jeder Liste:
    // Produkte je Motto (produkte.js), Vorzeige (passtVorzeige), Katalog (artikel.js), Preise.
    aus: true,
    label: 'Schneidebrett', view: 'vorn', sizes: false, voll: true, flaecheCm: [40, 30],
    box: { x: 171, y: 256, w: 682, h: 512 },
    szene: { label: 'Auf dem Tisch', box: { x: 171, y: 256, w: 682, h: 512 } }
  },
  napfunterlage: {
    label: 'Napfunterlage', view: 'vorn', sizes: false, voll: true, flaecheCm: [40, 30],
    box: { x: 154, y: 333, w: 716, h: 501 },
    szene: { label: 'Vor dem Napf', box: { x: 154, y: 333, w: 716, h: 501 } }
  },
  gepaeckanhaenger: {
    label: 'Gepäckanhänger', view: 'vorn', sizes: false, voll: true, flaecheCm: [7, 10],
    box: { x: 329, y: 357, w: 362, h: 554 },
    szene: { label: 'Am Koffer', box: { x: 333, y: 205, w: 358, h: 512 } }
  },
  // 22. Sept., Markus: "Alle anderen Hersteller sind nicht in der Lage, ein Design zu erzeugen,
  // das fuer den jeweiligen Artikel ist - wir koennen jeden Artikel, auch die Brotdose,
  // vollflaechig bespielen. Das ist unser Vorsprung." Also ist die Brotdose ein EIGENER Artikel
  // mit vollflaechigem Deckeldruck, kein Traeger fuer einen Aufkleber. Deckel 18,5 x 12 cm
  // (Mepal Bento, nachgesehen); Produktansicht von oben, Situation auf dem Kuechentisch.
  brotdose: {
    label: 'Brotdose', view: 'vorn', sizes: false, voll: true, flaecheCm: [18.5, 12],
    // nurEigen: wird nur gezeigt, wenn die Brotdose auch BESTELLT ist. Ihr Deckel hat fast das
    // Verhaeltnis einer Postkarte, damit rutschte sie in die Angebotsreihe der Postkarte - und
    // die hat Markus am 20. Sept. auf Tasse, Poster, Acrylbild und Tuerschild festgelegt.
    // Niemand bestellt eine Ansichtskarte und bekommt eine Kinder-Brotdose angeboten.
    nurEigen: true,
    box: { x: 80, y: 214, w: 866, h: 552 },
    szene: { label: 'Auf dem Frühstückstisch', box: { x: 164, y: 276, w: 694, h: 440 } }
  }
};

// Fassung 85: Welche Artikel eine SITUATION bekommen sollen - das Teil in Benutzung statt
// sachlich vor grauem Grund. Markus: "einmal das Poster und einmal ein Bild, wo das Poster an
// der Wand haengt". Die Produktansicht zeigt, WAS man kauft; die Situation, WARUM.
// Hier stehen die Artikel, die oben noch keine szene tragen - ihre Beschriftung und ihre
// Druckflaeche kommen dazu, sobald die Vorlage erzeugt und vermessen ist.
export const SZENEN_LABELS = {
  tee: 'Getragen', polo: 'Getragen', hoodie: 'Getragen', zip: 'Getragen',
  tasse: 'Auf dem Frühstückstisch', beutel: 'Über der Schulter', kissen: 'Auf dem Sofa',
  poster: 'An der Wand', sticker: 'Auf der Trinkflasche', strandtuch: 'Am Strand',
  fussmatte: 'Vor der Haustür', brotdose: 'Auf dem Frühstückstisch'
};
export const COLORS = ['black', 'white'];

// ---------- Welche Teile bekommt ein fertiges Design angeboten? ----------
// 20. Sept., Markus zur Postkarte: "Die weiterfuehrenden Artikel klappen leider auch nicht."
// Gemessen am Live-Auftrag MO-GRUESSEA-20260920-BRSW: angeboten wurden Poster, Acrylbild und
// Tuerschild - Poster kam (200), Acrylbild und Tuerschild antworteten 503 "vorlage fehlt", der
// Kunde sah zwei leere Bilder. Die beiden haben keine Produktvorlage (SOURCES), konnten also nie
// gezeigt werden und standen trotzdem in der Reihe. Regel ab jetzt: angeboten wird nur, was
// auch daliegt. Reine Rechnung, damit die Abnahme sie mit festen Eingaben prueft.
//   teile          Teile, die fuer das Motto eingeschaltet sind (Reihenfolge = Anzeige)
//   artikel        bestellter Artikel { motivart, netto:[cm,cm] } oder null (dann alles wie bisher)
//   eigeneAnsicht  das Mockup des bestellten Artikels ('' wenn es keins gibt)
//   bereit         Menge der Teile, deren Vorlagen (beide Farben) daliegen
export function angebotReihe({ teile, artikel, eigeneAnsicht = '', bereit }) {
  const daliegt = (g) => !bereit || bereit.has(g);
  const passtAuf = (g) => {
    if (!GARMENTS[g]) return false;
    if (g === eigeneAnsicht) return true;
    if (GARMENTS[g].nurEigen) return false;   // 22. Sept.: nur, wenn dieser Artikel selbst bestellt ist
    if (!artikel) return true;
    // Randlos gebautes Motiv auf freistehender Ware: das ist eine Kachel auf der Brust, kein Druck.
    if (artikel.motivart === 'vollflaechig' && !GARMENTS[g].voll) return false;
    // Groessenverhaeltnis: Was auf ein Drittel schrumpfen muss, sieht nach Aufkleber aus. Was
    // umgekehrt nur ein Viertel des Teils fuellt, sieht verloren aus.
    const fl = GARMENTS[g].flaecheCm, netto = artikel.netto;
    if (Array.isArray(fl) && Array.isArray(netto) && netto[0] > 0 && netto[1] > 0) {
      const k = Math.min(fl[0] / netto[0], fl[1] / netto[1]);
      if (k < 0.6 || k > 2.2) return false;
    }
    return true;
  };
  const moeglich = (teile || []).filter(g => !!GARMENTS[g] && daliegt(g));
  // Fiele alles durch das Groessen-Raster, saehe der Kunde gar kein Teil mehr - dann lieber alle,
  // die daliegen. Was keine Vorlage hat, kommt aber in keinem Fall in die Reihe.
  const passend = moeglich.filter(passtAuf);
  const reihe = passend.length ? passend : moeglich.slice();
  if (eigeneAnsicht && GARMENTS[eigeneAnsicht] && daliegt(eigeneAnsicht)) {
    // Das bestellte Teil steht vorn - es ist das, was der Kunde bekommt, der Rest ist Vorschlag.
    reihe.sort((a, b) => (a === eigeneAnsicht ? -1 : 0) - (b === eigeneAnsicht ? -1 : 0));
    if (!reihe.includes(eigeneAnsicht)) reihe.unshift(eigeneAnsicht);
  }
  return reihe;
}

// Fruehere Fassungen haben die weisse Vorlage eingefaerbt. Das hat auf den echten Produktfotos immer
// Streifen hinterlassen (die Fuellung lief an hellen Faltenkanten ins Textil). Faellt weg - fuer die
// Abwechslung auf der Uebersicht sorgen jetzt die echten Fotos: T-Shirt, Hoodie und Zip-Jacke, je schwarz und weiss.
const ALTE_TOENUNGEN = ['navy', 'gruen', 'bordeaux', 'anthrazit', 'royal'];

// HINWEIS: fuer das Polo fehlen noch die zwei Produktfotos. Sobald sie da sind, hier eintragen:
//   'polo_black': 'https://.../polo-schwarz.png',
//   'polo_white': 'https://.../polo-weiss.png',
// Bis dahin bleibt der Polo-Reiter aus - templateReady() meldet false und die Seite zeigt ihn nicht.
const SOURCES = {
  'tee_black':    'https://mcp.markusassemacher.de/generated/69a3577a-aca7-4bd0-b0d8-ab1a17cb36af.png',
  'tee_white':    'https://mcp.markusassemacher.de/generated/44c1126e-af7e-4fee-804d-fb1410f90efa.png',
  'hoodie_black': 'https://mcp.markusassemacher.de/generated/e1377665-488d-479b-aacc-49c41365726e.png',
  'hoodie_white': 'https://mcp.markusassemacher.de/generated/8fd49d4b-1358-44ce-8ce3-b8f9d24b86e7.png',
  'zip_black':    'https://mcp.markusassemacher.de/generated/57f74927-521f-4df1-9061-79b402eac1eb.png',
  'zip_white':    'https://mcp.markusassemacher.de/generated/e9cc141c-4a66-4bb9-8d7f-26232e1f13ce.png',
  'tasse_white':  'https://mcp.markusassemacher.de/generated/bc977f39-2c9b-454c-a312-5db5c949224e.png',
  'tasse_black':  'https://mcp.markusassemacher.de/generated/972b7a15-e65e-4962-98cb-ee7663d6b8dd.png',
  'beutel_white': 'https://mcp.markusassemacher.de/generated/48328b88-0791-400c-b602-c2d180dc24e0.png',
  'beutel_black': 'https://mcp.markusassemacher.de/generated/783bf222-694c-4961-8ac4-e57b4b5eb1dc.png',
  // Accessoires: helle/naturfarbene Vorlage fuer beide Farb-Keys (Druck sitzt sichtbar mittig).
  'strandtuch_white': 'https://mcp.markusassemacher.de/generated/76b00783-9c1e-45e2-8666-635a0a62e634.png',
  'strandtuch_black': 'https://mcp.markusassemacher.de/generated/76b00783-9c1e-45e2-8666-635a0a62e634.png',
  'kissen_white':  'https://mcp.markusassemacher.de/generated/91395075-529f-4d53-8ea2-094ab7e00f2d.png',
  'kissen_black':  'https://mcp.markusassemacher.de/generated/91395075-529f-4d53-8ea2-094ab7e00f2d.png',
  'poster_white':  'https://mcp.markusassemacher.de/generated/6c2f4c13-e5b1-4428-9b74-36b26821be7c.png',
  'poster_black':  'https://mcp.markusassemacher.de/generated/6c2f4c13-e5b1-4428-9b74-36b26821be7c.png',
  'sticker_white': 'https://mcp.markusassemacher.de/generated/dc5f730b-21bf-4105-8dd6-f53abfbd3374.png',
  'sticker_black': 'https://mcp.markusassemacher.de/generated/dc5f730b-21bf-4105-8dd6-f53abfbd3374.png',
  // 21. Sept.: Handtuch und Handtuch-Szene sind aus SOURCES raus - die alten Fotos hatten ein
  // Tuch im Verhaeltnis 3:4 (Artikel 1:2), das Motiv wurde abgeschnitten. Jetzt MITGELIEFERT
  // mit Stand (ersetzt die Datei auf dem Volume), Fotos in vorlagen-original/handtuch*.jpg.
  // 22. Sept.: Fussmatte aus SOURCES raus (das Foto war hochkant, die Matte liegt quer vor der
  // Tuer) - jetzt MITGELIEFERT mit Stand, Fotos in vorlagen-original/fussmatte*.jpg.
};

// ---------- 20. Sept.: mitgelieferte Vorlagen ----------
// Markus, mit Bild: "Es ist auch kein direkter Vergleich, wie es auf dem Handtuch am Strand
// aussieht. Weder beim Poster noch sonst irgendwo." Gemessen am Live-Design: Situationen gab
// es nur fuer Hoodie, Polo, Tasse (schwarz), Handtuch, T-Shirt (weisz), Poster (weisz) - und die
// sieben Artikel aus Fassung 85 hatten gar keine Vorlage (503 "vorlage fehlt"). Der Weg ueber
// den Knopf im Backend haengt an jemandem, der ihn drueckt. Diese hier liegen deshalb im Repo
// (vorlagen-original/<key>.jpg), gebaut mit demselben Magenta-Weg wie vorlagen.js (Bestellzettel
// VORLAGEN, Flaeche gemessen, Platzhalter entfernt) und mit ihrer Flaeche HIER, damit sie auf
// jedem Server sofort da sind. Eine Datei je Schluessel, sie gilt fuer beide Farben - Flachware
// gibt es nicht in Schwarz und Weisz. Sie sind keine Herstellerfotos (istOriginalfoto: nein):
// der Knopf im Backend darf sie ersetzen, dann gilt die dort gemessene Flaeche (gelernteBox).
export const MITGELIEFERT = {
  // ---------- 21. Sept.: Herstellerfotos der Textil-Linie als Mockup-Vorlagen ----------
  // Markus: "da du jetzt ueberall online gehen kannst, erwarte ich auch, dass du die ganzen
  // Mockups von den Textilien, die wir ausgesucht haben, dir selber ziehst." Die bisherigen
  // Textil-Vorlagen (tee, hoodie, zip in SOURCES) sind KI-Bilder. Hier die echten Packshots aus
  // textil-bilder/ (Quellen in quellen.json), normiert auf 1024 px (Textil 850 px hoch, mittig),
  // je Farbe eine Datei (dateien). Druckflaeche aus der Silhouette: T-Shirt/Polo 78 % der
  // Saumbreite ab 35 % (Polo 42 %) unter dem Kragen, Hoodie 40 % ab 20 % (zwischen Kordeln und
  // Tasche), Zip-Jacke von HINTEN (PBM0) 60 % ab 22 % - vorn laeuft der Reissverschluss.
  // Nur B&C (bc) und Stanley/Stella (ss): Roly erlaubt keine Bearbeitung seiner Bilder (MARKEN).
  // Fehlt eine Farbe (Bomber nur in Schwarz), bleibt fuer sie die bisherige Vorlage.
  'grillschuerze': { box: { x: 419, y: 240, w: 186, h: 186 }, dateien: { white: 'grillschuerze_white.jpg', black: 'grillschuerze_black.jpg' }, stand: 1 },   // 8. Okt.: schwarz und Natur, dasselbe Foto umgefaerbt
  'bc-tee': { box: { x: 358, y: 255, w: 309, h: 464 }, dateien: { white: 'bc-tee_white.jpg', black: 'bc-tee_black.jpg' }, linie: 'bc', stand: 1 },
  'bc-polo': { box: { x: 332, y: 284, w: 359, h: 539 }, dateien: { white: 'bc-polo_white.jpg', black: 'bc-polo_black.jpg' }, linie: 'bc', stand: 1 },
  'bc-hoodie': { box: { x: 386, y: 217, w: 252, h: 378 }, dateien: { white: 'bc-hoodie_white.jpg', black: 'bc-hoodie_black.jpg' }, linie: 'bc', stand: 1 },
  'ss-tee': { box: { x: 320, y: 289, w: 385, h: 578 }, dateien: { white: 'ss-tee_white.jpg', black: 'ss-tee_black.jpg' }, linie: 'ss', stand: 1 },
  'ss-polo': { box: { x: 332, y: 291, w: 361, h: 542 }, dateien: { white: 'ss-polo_white.jpg', black: 'ss-polo_black.jpg' }, linie: 'ss', stand: 1 },
  'ss-hoodie': { box: { x: 375, y: 228, w: 274, h: 411 }, dateien: { white: 'ss-hoodie_white.jpg', black: 'ss-hoodie_black.jpg' }, linie: 'ss', stand: 1 },
  'ss-zip': { box: { x: 299, y: 248, w: 429, h: 549 }, dateien: { black: 'ss-zip_black.jpg' }, linie: 'ss', stand: 1 },
  // 6. Okt., Markus: "Mal was von Roly, mal was von Stanley/Stella und das auch dazuschreiben" - Roly als dritte Linie (Ottos
  // Starter; Freigabe textilien.js MARKEN.roly). Roly-Packshots 600 px (static.gorfactory.es, unveraendert), mit
  // werkzeug/roly-vorlagen.mjs auf 1024 px gebracht; die Flaeche an der B&C-Vorlage desselben Teils geeicht.
  'roly-tee': { boxen: { white: { x: 340, y: 252, w: 344, h: 517 }, black: { x: 341, y: 252, w: 344, h: 517 } }, dateien: { white: 'roly-tee_white.jpg', black: 'roly-tee_black.jpg' }, linie: 'roly', stand: 1 },
  'roly-polo': { boxen: { white: { x: 352, y: 281, w: 322, h: 483 }, black: { x: 351, y: 280, w: 322, h: 483 } }, dateien: { white: 'roly-polo_white.jpg', black: 'roly-polo_black.jpg' }, linie: 'roly', stand: 1 },
  'roly-hoodie': { boxen: { white: { x: 388, y: 214, w: 250, h: 375 }, black: { x: 388, y: 215, w: 250, h: 375 } }, dateien: { white: 'roly-hoodie_white.jpg', black: 'roly-hoodie_black.jpg' }, linie: 'roly', stand: 1 },
  'roly-tee-ruecken': { boxen: { white: { x: 371, y: 257, w: 283, h: 357 }, black: { x: 372, y: 261, w: 283, h: 358 } }, dateien: { white: 'roly-tee-ruecken_white.jpg', black: 'roly-tee-ruecken_black.jpg' }, stand: 1 },
  'roly-hoodie-ruecken': { boxen: { white: { x: 393, y: 342, w: 240, h: 303 }, black: { x: 392, y: 341, w: 240, h: 303 } }, dateien: { white: 'roly-hoodie-ruecken_white.jpg', black: 'roly-hoodie-ruecken_black.jpg' }, stand: 1 },
  // 5. Okt. abends, Markus (Hoodie mit "Ruecken 30 x 35" bestellt, die Vorschau zeigte es vorn): die Rueckansicht von
  // T-Shirt und Hoodie, Stanley/Stella-Packshot von hinten (textil-bilder/ss-*_back.jpg), gebaut mit werkzeug/ruecken-vorlagen.mjs
  // (1024 px, Textil 850 px hoch; Flaeche 38 x 48 im Verhaeltnis, unter Kragen bzw. Kapuze). makeMockup nimmt sie bei
  // opts.rueckenFoto - fuer ein Design, das auf den Ruecken bestellt ist (job.artikel.seite 'ruecken').
  'tee-ruecken': { boxen: { white: { x: 350, y: 257, w: 324, h: 409 }, black: { x: 351, y: 257, w: 322, h: 407 } }, dateien: { white: 'tee-ruecken_white.jpg', black: 'tee-ruecken_black.jpg' }, stand: 1 },
  'hoodie-ruecken': { boxen: { white: { x: 364, y: 342, w: 296, h: 374 }, black: { x: 377, y: 342, w: 270, h: 341 } }, dateien: { white: 'hoodie-ruecken_white.jpg', black: 'hoodie-ruecken_black.jpg' }, stand: 1 },
  // ---------- 27. Sept.: die getragenen Textilien als Frau und als Mann ----------
  // Markus (Screenshot "Anne · 65" an einem Mann): "Am Namen ist zu erkennen, dass es sich um
  // eine Frau handelt. Dann sollte es auch als Frau als Beispiel kommen." Sechzehn Bilder, ueber
  // den Bilddienst nach den Bestellzetteln in vorlagen.js (getragen) erzeugt, Flaeche am
  // Magenta-Platzhalter gemessen, Platzhalter entfernt - je Farbe eine Datei und eine Flaeche
  // (boxen), denn es sind zwei Fotos. Welche gezeigt wird, entscheidet der Vorname auf dem Design
  // (vornamen.js, szeneVarianteDa). Der Knopf im Backend darf sie ersetzen (gelernteBox gewinnt).
  'tee-szene-frau':    { boxen: { white: { x: 352, y: 183, w: 312, h: 534 }, black: { x: 348, y: 208, w: 333, h: 495 } }, dateien: { white: 'tee-szene-frau_white.jpg', black: 'tee-szene-frau_black.jpg' }, stand: 1 },
  'tee-szene-mann':    { boxen: { white: { x: 366, y: 184, w: 294, h: 521 }, black: { x: 361, y: 182, w: 301, h: 512 } }, dateien: { white: 'tee-szene-mann_white.jpg', black: 'tee-szene-mann_black.jpg' }, stand: 1 },
  'polo-szene-frau':   { boxen: { white: { x: 358, y: 249, w: 314, h: 465 }, black: { x: 376, y: 259, w: 280, h: 444 } }, dateien: { white: 'polo-szene-frau_white.jpg', black: 'polo-szene-frau_black.jpg' }, stand: 1 },
  'polo-szene-mann':   { boxen: { white: { x: 366, y: 212, w: 300, h: 467 }, black: { x: 362, y: 226, w: 297, h: 467 } }, dateien: { white: 'polo-szene-mann_white.jpg', black: 'polo-szene-mann_black.jpg' }, stand: 1 },
  'hoodie-szene-frau': { boxen: { white: { x: 369, y: 226, w: 285, h: 407 }, black: { x: 377, y: 205, w: 272, h: 412 } }, dateien: { white: 'hoodie-szene-frau_white.jpg', black: 'hoodie-szene-frau_black.jpg' }, stand: 1 },
  'hoodie-szene-mann': { boxen: { white: { x: 380, y: 186, w: 262, h: 386 }, black: { x: 378, y: 175, w: 269, h: 432 } }, dateien: { white: 'hoodie-szene-mann_white.jpg', black: 'hoodie-szene-mann_black.jpg' }, stand: 1 },
  'zip-szene-frau':    { boxen: { white: { x: 372, y: 284, w: 285, h: 415 }, black: { x: 357, y: 293, w: 313, h: 458 } }, dateien: { white: 'zip-szene-frau_white.jpg', black: 'zip-szene-frau_black.jpg' }, stand: 1 },
  'zip-szene-mann':    { boxen: { white: { x: 349, y: 246, w: 314, h: 477 }, black: { x: 335, y: 261, w: 326, h: 442 } }, dateien: { white: 'zip-szene-mann_white.jpg', black: 'zip-szene-mann_black.jpg' }, stand: 1 },
  // ---------- 2. Okt.: das Shirt in der Szene seines Mottos ----------
  // Markus (1./2. Okt.): "Wenn Weihnachtsmotiv drauf ist, dass es ne weihnachtliche Umgebung ist und
  // vielleicht auch ganz zu sehen ist ... fuer ne Abifeier dann natuerlich auf der Abifeier, ein
  // Angler beim Angeln, jemand auf einer Bowlingbahn, so dass wir da Abwechslung rein kriegen" -
  // "die Szenen machst du direkt mit". Je Motto ein Foto (Bilddienst, Bestellzettel wie bei den
  // getragenen Shirts: Person von der Huefte aufwaerts, frontal, Magenta-Platzhalter auf der Brust;
  // Bestellzettel SZENEN_ZETTEL in vorlagen.js),
  // die schwarze Fassung als Bearbeitung DESSELBEN Fotos (nur das Shirt umgefaerbt), Flaeche mit
  // flaecheAusMagenta gemessen, Platzhalter mit magentaEntfernen entfernt. wer: die Person auf dem
  // Foto - hat das Design einen eindeutigen Vornamen des anderen Geschlechts, gewinnt die Person.
  'tee-szene-thema-abi': { boxen: { white: { x: 420, y: 376, w: 177, h: 282 }, black: { x: 421, y: 376, w: 176, h: 282 } }, dateien: { white: 'tee-szene-thema-abi_white.jpg', black: 'tee-szene-thema-abi_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-abschlussfahrt': { boxen: { white: { x: 421, y: 413, w: 177, h: 280 }, black: { x: 421, y: 412, w: 177, h: 280 } }, dateien: { white: 'tee-szene-thema-abschlussfahrt_white.jpg', black: 'tee-szene-thema-abschlussfahrt_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-angler-shirt': { boxen: { white: { x: 416, y: 400, w: 192, h: 301 }, black: { x: 416, y: 400, w: 192, h: 301 } }, dateien: { white: 'tee-szene-thema-angler-shirt_white.jpg', black: 'tee-szene-thema-angler-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-bowling': { boxen: { white: { x: 425, y: 408, w: 182, h: 266 }, black: { x: 425, y: 408, w: 182, h: 266 } }, dateien: { white: 'tee-szene-thema-bowling_white.jpg', black: 'tee-szene-thema-bowling_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-darts': { boxen: { white: { x: 408, y: 361, w: 199, h: 331 }, black: { x: 408, y: 360, w: 199, h: 332 } }, dateien: { white: 'tee-szene-thema-darts_white.jpg', black: 'tee-szene-thema-darts_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-familie': { boxen: { white: { x: 427, y: 391, w: 177, h: 307 }, black: { x: 427, y: 391, w: 177, h: 307 } }, dateien: { white: 'tee-szene-thema-familie_white.jpg', black: 'tee-szene-thema-familie_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-fan-shirt': { boxen: { white: { x: 426, y: 413, w: 189, h: 325 }, black: { x: 426, y: 413, w: 189, h: 325 } }, dateien: { white: 'tee-szene-thema-fan-shirt_white.jpg', black: 'tee-szene-thema-fan-shirt_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-fanclub': { boxen: { white: { x: 417, y: 367, w: 183, h: 304 }, black: { x: 417, y: 367, w: 183, h: 304 } }, dateien: { white: 'tee-szene-thema-fanclub_white.jpg', black: 'tee-szene-thema-fanclub_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-firmenausflug': { boxen: { white: { x: 413, y: 444, w: 190, h: 307 }, black: { x: 413, y: 443, w: 191, h: 308 } }, dateien: { white: 'tee-szene-thema-firmenausflug_white.jpg', black: 'tee-szene-thema-firmenausflug_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-geburt-baby': { boxen: { white: { x: 432, y: 381, w: 163, h: 278 }, black: { x: 432, y: 381, w: 163, h: 278 } }, dateien: { white: 'tee-szene-thema-geburt-baby_white.jpg', black: 'tee-szene-thema-geburt-baby_black.jpg' }, wer: 'frau', stand: 2, nameFeld: 'babyname', nachName: { frau: 'geburt-baby-rosa' } },
  // 2. Okt., Markus: Maedchenname -> rosa Zimmer, "da duerfen wir schon gerne klassisch bleiben".
  // Dasselbe Foto, nur das Zimmer umgefaerbt (Flaeche nachgemessen, 1-2 px neben der hellen Fassung).
  // variante: gehoert zur Szene geburt-baby und ist kein eigenes Motto.
  'tee-szene-thema-geburt-baby-rosa': { boxen: { white: { x: 432, y: 381, w: 163, h: 278 }, black: { x: 432, y: 380, w: 163, h: 280 } }, dateien: { white: 'tee-szene-thema-geburt-baby-rosa_white.jpg', black: 'tee-szene-thema-geburt-baby-rosa_black.jpg' }, wer: 'frau', stand: 2, variante: 'geburt-baby' },
  'tee-szene-thema-geburtstag': { boxen: { white: { x: 425, y: 392, w: 184, h: 302 }, black: { x: 425, y: 391, w: 184, h: 303 } }, dateien: { white: 'tee-szene-thema-geburtstag_white.jpg', black: 'tee-szene-thema-geburtstag_black.jpg' }, wer: 'frau', stand: 2 },
  // 7. Okt., Markus: "Maurer ist doch nicht in einer Tischlerwerkstatt?" - die erste Szene nach Begriff (szene-begriff.js),
  // am Bilddienst bestellt, vermessen und angesehen: Rohbau mit Mauerwerk, Geruest, Mischmaschine, Maurerkelle. Mitgeliefert,
  // damit live genau dieses Foto kommt; weitere Begriffe erzeugt der Server selbst (storage/templates).
  'tee-szene-thema-b-maurer-mann': { boxen: { white: { x: 409, y: 363, w: 203, h: 308 }, black: { x: 410, y: 363, w: 202, h: 308 } }, dateien: { white: 'tee-szene-thema-b-maurer-mann_white.jpg', black: 'tee-szene-thema-b-maurer-mann_black.jpg' }, wer: 'mann', stand: 2 },   // Stand 2: holt das angesehene Foto zurueck (live am 7. Okt. von einem ungeprueften ueberschrieben)
  'tee-szene-thema-handwerker-shirt': { boxen: { white: { x: 419, y: 364, w: 174, h: 334 }, black: { x: 421, y: 364, w: 173, h: 334 } }, dateien: { white: 'tee-szene-thema-handwerker-shirt_white.jpg', black: 'tee-szene-thema-handwerker-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  // 2. Okt., Markus: "Hochzeit das unpassend" (Gast im Shirt zwischen Anzuegen) - jetzt der Braeutigam am Hochzeitsauto.
  // 2. Okt., Markus zum Schaufenster: "warum immer ein T-Shirt ... mal Hoodie, mal T-Shirt, mal was auf
  // dem Ruecken". Dieselbe Szene im Hoodie (hoodie-szene-thema-<motto>) und von hinten (<motto>-ruecken,
  // variante: kein eigenes Motto, die Route waehlt sie nur auf ?druck=ruecken). Flaeche gemessen wie oben.
  'hoodie-szene-thema-motorrad-shirt': { boxen: { white: { x: 421, y: 374, w: 167, h: 243 }, black: { x: 420, y: 374, w: 168, h: 244 } }, dateien: { white: 'hoodie-szene-thema-motorrad-shirt_white.jpg', black: 'hoodie-szene-thema-motorrad-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  'hoodie-szene-thema-jaeger-shirt': { boxen: { white: { x: 441, y: 378, w: 164, h: 251 }, black: { x: 441, y: 378, w: 165, h: 251 } }, dateien: { white: 'hoodie-szene-thema-jaeger-shirt_white.jpg', black: 'hoodie-szene-thema-jaeger-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  'hoodie-szene-thema-handwerker-shirt': { boxen: { white: { x: 417, y: 354, w: 183, h: 251 }, black: { x: 416, y: 354, w: 184, h: 252 } }, dateien: { white: 'hoodie-szene-thema-handwerker-shirt_white.jpg', black: 'hoodie-szene-thema-handwerker-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  'hoodie-szene-thema-weihnachtsfeier': { boxen: { white: { x: 437, y: 370, w: 157, h: 226 }, black: { x: 438, y: 370, w: 156, h: 226 } }, dateien: { white: 'hoodie-szene-thema-weihnachtsfeier_white.jpg', black: 'hoodie-szene-thema-weihnachtsfeier_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-abi-ruecken': { boxen: { white: { x: 493, y: 331, w: 186, h: 331 }, black: { x: 493, y: 331, w: 185, h: 331 } }, dateien: { white: 'tee-szene-thema-abi-ruecken_white.jpg', black: 'tee-szene-thema-abi-ruecken_black.jpg' }, wer: 'mann', stand: 2, variante: 'abi', ruecken: true },
  'tee-szene-thema-junggesellenabschied-ruecken': { boxen: { white: { x: 486, y: 298, w: 176, h: 364 }, black: { x: 486, y: 298, w: 176, h: 364 } }, dateien: { white: 'tee-szene-thema-junggesellenabschied-ruecken_white.jpg', black: 'tee-szene-thema-junggesellenabschied-ruecken_black.jpg' }, wer: 'mann', stand: 2, variante: 'junggesellenabschied', ruecken: true },
  'tee-szene-thema-malle-fahrt-ruecken': { boxen: { white: { x: 460, y: 384, w: 170, h: 328 }, black: { x: 459, y: 384, w: 171, h: 328 } }, dateien: { white: 'tee-szene-thema-malle-fahrt-ruecken_white.jpg', black: 'tee-szene-thema-malle-fahrt-ruecken_black.jpg' }, wer: 'frau', stand: 2, variante: 'malle-fahrt', ruecken: true },
  'tee-szene-thema-vereinsjubilaeum-ruecken': { boxen: { white: { x: 425, y: 320, w: 184, h: 344 }, black: { x: 425, y: 320, w: 184, h: 344 } }, dateien: { white: 'tee-szene-thema-vereinsjubilaeum-ruecken_white.jpg', black: 'tee-szene-thema-vereinsjubilaeum-ruecken_black.jpg' }, wer: 'mann', stand: 2, variante: 'vereinsjubilaeum', ruecken: true },
  'tee-szene-thema-hochzeit': { boxen: { white: { x: 384, y: 361, w: 175, h: 271 }, black: { x: 384, y: 361, w: 175, h: 271 } }, dateien: { white: 'tee-szene-thema-hochzeit_white.jpg', black: 'tee-szene-thema-hochzeit_black.jpg' }, wer: 'mann', stand: 3 },
  'tee-szene-thema-jaeger-shirt': { boxen: { white: { x: 416, y: 357, w: 177, h: 299 }, black: { x: 416, y: 357, w: 178, h: 299 } }, dateien: { white: 'tee-szene-thema-jaeger-shirt_white.jpg', black: 'tee-szene-thema-jaeger-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-junggesellenabschied': { boxen: { white: { x: 419, y: 413, w: 186, h: 301 }, black: { x: 419, y: 413, w: 186, h: 301 } }, dateien: { white: 'tee-szene-thema-junggesellenabschied_white.jpg', black: 'tee-szene-thema-junggesellenabschied_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-karneval': { boxen: { white: { x: 408, y: 443, w: 218, h: 312 }, black: { x: 409, y: 442, w: 217, h: 313 } }, dateien: { white: 'tee-szene-thema-karneval_white.jpg', black: 'tee-szene-thema-karneval_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-kegeltour': { boxen: { white: { x: 407, y: 379, w: 188, h: 312 }, black: { x: 407, y: 379, w: 188, h: 311 } }, dateien: { white: 'tee-szene-thema-kegeltour_white.jpg', black: 'tee-szene-thema-kegeltour_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-kinder-tiershirt': { boxen: { white: { x: 448, y: 397, w: 166, h: 263 }, black: { x: 448, y: 397, w: 166, h: 263 } }, dateien: { white: 'tee-szene-thema-kinder-tiershirt_white.jpg', black: 'tee-szene-thema-kinder-tiershirt_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-landwirt-shirt': { boxen: { white: { x: 414, y: 392, w: 199, h: 315 }, black: { x: 414, y: 391, w: 199, h: 316 } }, dateien: { white: 'tee-szene-thema-landwirt-shirt_white.jpg', black: 'tee-szene-thema-landwirt-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-malle-fahrt': { boxen: { white: { x: 402, y: 414, w: 199, h: 317 }, black: { x: 403, y: 414, w: 198, h: 317 } }, dateien: { white: 'tee-szene-thema-malle-fahrt_white.jpg', black: 'tee-szene-thema-malle-fahrt_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-meister-shirt': { boxen: { white: { x: 433, y: 383, w: 172, h: 316 }, black: { x: 433, y: 383, w: 172, h: 316 } }, dateien: { white: 'tee-szene-thema-meister-shirt_white.jpg', black: 'tee-szene-thema-meister-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-motorrad-shirt': { boxen: { white: { x: 429, y: 391, w: 187, h: 324 }, black: { x: 429, y: 390, w: 187, h: 325 } }, dateien: { white: 'tee-szene-thema-motorrad-shirt_white.jpg', black: 'tee-szene-thema-motorrad-shirt_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-schulmotto': { boxen: { white: { x: 434, y: 449, w: 194, h: 341 }, black: { x: 434, y: 449, w: 194, h: 341 } }, dateien: { white: 'tee-szene-thema-schulmotto_white.jpg', black: 'tee-szene-thema-schulmotto_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-sprueche-shirt': { boxen: { white: { x: 417, y: 415, w: 181, h: 279 }, black: { x: 418, y: 415, w: 181, h: 279 } }, dateien: { white: 'tee-szene-thema-sprueche-shirt_white.jpg', black: 'tee-szene-thema-sprueche-shirt_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-tier-shirt': { boxen: { white: { x: 371, y: 351, w: 157, h: 270 }, black: { x: 373, y: 351, w: 154, h: 269 } }, dateien: { white: 'tee-szene-thema-tier-shirt_white.jpg', black: 'tee-szene-thema-tier-shirt_black.jpg' }, wer: 'frau', stand: 2 },
  'tee-szene-thema-vereinsjubilaeum': { boxen: { white: { x: 413, y: 398, w: 203, h: 327 }, black: { x: 414, y: 398, w: 202, h: 327 } }, dateien: { white: 'tee-szene-thema-vereinsjubilaeum_white.jpg', black: 'tee-szene-thema-vereinsjubilaeum_black.jpg' }, wer: 'mann', stand: 2 },
  'tee-szene-thema-weihnachtsfeier': { boxen: { white: { x: 434, y: 376, w: 182, h: 292 }, black: { x: 434, y: 375, w: 182, h: 292 } }, dateien: { white: 'tee-szene-thema-weihnachtsfeier_white.jpg', black: 'tee-szene-thema-weihnachtsfeier_black.jpg' }, wer: 'frau', stand: 2 },
  // Strandtuch am Strand: dieselbe Szene wie das Handtuch (ueber dem Liegestuhl im Abendlicht) -
  // Markus, 20. Sept.: "wir hatten doch schon was Gutes, wo es am Strand zu sehen ist" und "eine
  // schoene Szene am Strand, nicht einfach so dahingeknallt". Ein Bild, zwei Artikel.
  // stand 2: die erste Fassung (Tuch flach im Sand, Flaeche schwarz gefuellt) lag schon auf dem
  // Live-Volume, als die richtige kam - ein hoeherer Stand ersetzt die Datei dort.
  // Stand 3 (Markus, 20. Sept.: "Leg das Strandtuch einfach auf den Strand - nicht von oben,
  // sondern so, wie es da liegen wuerde"): liegend am Wasser, aus Augenhoehe. Die Flaeche ist ein
  // schraeges Viereck (ecken), das Motiv wird perspektivisch hineingelegt; box ist nur die Huelle.
  // Stand 4 (21. Sept., 20:54, Markus: "Abgeschnitten" - die obere Haelfte des Strandtuch-Designs
  // fehlte): das liegende Tuch im Sand hatte im Foto nicht das Verhaeltnis 1:2 des Artikels.
  // Jetzt ein Foto von oben, Tuch 398 x 846 px (0,47, Artikel 0,50), keine Perspektive mehr.
  // Stand 5: dasselbe Foto mit echtem Stoff statt flacher Flaeche (Stand 4 lag schon auf dem Volume).
  // 22. Sept., Markus: "einfach auf dem Sand drauf geknallt ... Wellen schlagen, halbwegs natuerlich."
  // Neue Fotos: das Tuch liegt locker mit echten Wellen und Falten; Maske aus dem Weiss des Tuchs.
  'strandtuch-szene': { box: { x: 291, y: 63, w: 440, h: 904 }, stand: 6 },
  // 21. Sept.: Handtuch (50 x 100) - Produktansicht an der Stange und flach im Sand, beide im
  // Verhaeltnis des Artikels (0,48 und 0,49). Ein Foto fuer beide Farben (die Flaeche ist der Druck).
  // Stand 3: echter Stoff statt flacher Flaeche (Stand 2 lag schon auf dem Volume).
  // 21:25, Markus: "Was soll das linke Foto? Handtuecher an der Wand?" - jetzt liegt das Handtuch
  // flach auf hellem Holz, von oben (dasselbe Prinzip wie im Sand).
  'handtuch':       { box: { x: 303, y: 32, w: 418, h: 955 }, datei: 'handtuch.jpg', stand: 3 },
  'handtuch-szene': { box: { x: 292, y: 26, w: 441, h: 962 }, datei: 'handtuch-szene.jpg', stand: 4 },   // 22. Sept.: mit Wellen
  // 21. Sept., Markus: "Das Foto vom Kissen auf dem Sofa ist einfach nur ein Rechteck drauf
  // gemalt. Das ist kein Kissen." Jetzt ein echtes Kissenfoto (Falten, Keder, Licht) und eine
  // Maske der Vorderseite bis zum Keder (maske: true -> <key>.maske.png); der Druck folgt der
  // Maske und traegt die Schattierung des Fotos (flaecheAufMaske). box = Huelle der Maske.
  // Stand 3 (21. Sept., "Oben abgeschnitten"): das Kissen im Foto war 1,19 breit zu hoch, der
  // Artikel ist quadratisch. Neues Foto gerade von vorn, 831 x 758 (1,10) - und makeMockup
  // beschneidet ein eigenes Motiv ohnehin nicht mehr, wenn das Verhaeltnis abweicht.
  // Stand 5 (21. Sept., 21:20, Markus: "Das Kissen passt jetzt nicht mehr!! Was vorher top war"):
  // das Foto von Stand 2 (Keder, Falten, Licht) ist zurueck - unveraendert. Beschnitten wird es
  // nicht mehr, weil makeMockup ein eigenes Motiv ganz einpasst, wenn das Verhaeltnis abweicht.
  'kissen-szene':     { box: { x: 90, y: 153, w: 862, h: 724 }, stand: 5 },
  // 22. Sept., Markus: "Die anderen Artikel kann ich gar nicht erkennen, was es sein soll." Der
  // Sticker klebt jetzt auf der Brotdose eines Kindes (Apfel, Saft, Stifte daneben); die Flaeche
  // ist ein Ausschnitt des Deckels, der Sticker fuellt nicht den ganzen Deckel.
  // 22. Sept.: die Brotdose ist ein eigener Artikel geworden - der Sticker klebt jetzt auf der
  // Trinkflasche eines Schulkinds (Rucksack, Stifte, Heft daneben). Die Flaeche ist ein Stueck
  // des Flaschenkoerpers in der Mitte; der Sticker ist freistehend und fuellt sie nicht aus.
  'sticker-szene':    { box: { x: 376, y: 440, w: 260, h: 260 }, stand: 3 },
  'brotdose':         { box: { x: 80, y: 214, w: 866, h: 552 }, datei: 'brotdose.jpg', stand: 1 },
  'brotdose-szene':   { box: { x: 164, y: 276, w: 694, h: 440 }, datei: 'brotdose-szene.jpg', stand: 1 },
  'tasse-szene':      { box: { x: 278, y: 240, w: 432, h: 544 }, datei: 'tasse-szene.jpg', stand: 1 },   // 22. Sept.: auf dem Fruehstueckstisch
  // 22. Sept., Markus: "Das Poster ist nicht vollflaechig, der weisse Abstand hat verschiedene
  // Abstaende" - das war das Passepartout der Vorlage. Neuer Rahmen ohne Passepartout: das
  // Poster fuellt die Rahmenoeffnung bis an den schwarzen Rahmen, hoch und quer.
  'poster-szene':     { box: { x: 296, y: 89, w: 433, h: 625 }, stand: 2 },
  'mousepad':         { box: { x: 27, y: 311, w: 969, h: 396 } },
  'hundedecke':       { box: { x: 38, y: 143, w: 948, h: 736 } },
  'acrylbild':        { box: { x: 208, y: 84, w: 607, h: 833 } },
  'tuerschild':       { box: { x: 243, y: 92, w: 537, h: 828 } },
  'brett':            { box: { x: 46, y: 187, w: 931, h: 649 }, stand: 2 },   // 22. Sept.: Bambusbrett statt weisser Flaeche, Aufhaengeloch bleibt frei
  'napfunterlage':    { box: { x: 60, y: 205, w: 905, h: 600 } },
  'gepaeckanhaenger': { box: { x: 329, y: 357, w: 362, h: 554 }, stand: 2 },   // 8. Okt.: echter Anhaenger mit Oese und Lederschlaufe (vorher eine leere Platte)
  'mousepad-szene':         { box: { x: 16, y: 263, w: 992, h: 477 } },
  // 22. Sept., Markus: "Hundedecke ist einfach nur reingeknallt" - jetzt liegt die Decke locker
  // im Korb, mit Falten an den Korbwaenden; die Maske folgt dem Oval, das Motiv den Falten.
  'hundedecke-szene':       { box: { x: 85, y: 132, w: 877, h: 677 }, stand: 2 },
  'acrylbild-szene':        { box: { x: 245, y: 86, w: 537, h: 827 } },
  'tuerschild-szene':       { box: { x: 226, y: 86, w: 570, h: 798 } },
  'brett-szene':            { box: { x: 70, y: 194, w: 880, h: 634 }, stand: 2 },   // 22. Sept.: Bambusbrett auf dem Kuechentisch mit Zitronen, Basilikum, Knoblauch
  'napfunterlage-szene':    { box: { x: 122, y: 436, w: 780, h: 498 }, stand: 2 },   // 22. Sept.: mit Naepfen und Hund davor
  // 22. Sept.: Fussmatte quer (60 x 40) - Produktansicht auf Holz und vor der Haustuer auf Stein.
  'fussmatte':              { box: { x: 44, y: 223, w: 934, h: 585 }, datei: 'fussmatte.jpg', stand: 2 },
  'fussmatte-szene':        { box: { x: 90, y: 337, w: 844, h: 506 }, datei: 'fussmatte-szene.jpg', stand: 1 },
  'gepaeckanhaenger-szene': { box: { x: 309, y: 263, w: 398, h: 632 } },
  // 20. Sept., Markus: "Warum zeichnest du eine Postkarte auf ein grosses Poster, was aufgrund
  // des Formats nicht funktionieren kann? Entweder ein anderer Rahmen ..." - also: Querformat-
  // Vorlagen. Liegt zu <artikel>-quer eine Vorlage da, nimmt makeMockup sie fuer ein Motiv, das
  // breiter als hoch ist (Postkarte, Panorama). Produkt und Situation, wie beim Hochformat.
  'poster-quer':            { box: { x: 67, y: 226, w: 889, h: 599 } },
  'poster-quer-szene':      { box: { x: 130, y: 148, w: 765, h: 476 }, stand: 2 },   // 22. Sept.: ohne Passepartout
  'acrylbild-quer':         { box: { x: 62, y: 207, w: 900, h: 572 } },
  'acrylbild-quer-szene':   { box: { x: 193, y: 250, w: 749, h: 475 } },
  'tuerschild-quer':        { box: { x: 74, y: 277, w: 876, h: 431 } },
  'tuerschild-quer-szene':  { box: { x: 83, y: 250, w: 859, h: 484 } }
};
// ---------- 21. Sept.: Masken der bedruckbaren Flaeche ----------
// Markus: "Es muss alles 100 % sein, immer wiederkehrend und skalierbar." Je Vorlage (Produkt
// oder Situation, Schluessel ohne Farbe) eine Maske vorlagen-original/<key>.maske.png: weiss =
// bedruckbar. Sie entsteht aus einer Magenta-Fassung desselben Fotos (Bildmodell malt die
// Flaeche magenta, ein Skript liest sie aus) und wird beim Start nach templates/ kopiert
// (masken.json merkt den Stand). makeMockup legt den Druck dann mit flaecheAufMaske auf:
// er folgt der Maske (auch einer bauchigen Kante) und traegt die Schattierung des Fotos.
export const MASKEN = {
  'kissen-szene': { stand: 3 },   // 21. Sept.: die Maske zum Foto von Stand 2 ist zurueck
  'kissen':  { stand: 1 },   // Produktansicht: die ganze Vorderseite bis zur Naht
  'poster':  { stand: 1 },   // das Papier, Klammern bleiben davor
  'sticker': { stand: 1 },   // die Flaeche innerhalb des weissen Stanzrands
  'strandtuch': { stand: 1 },
  'handtuch':   { stand: 2 },   // 21. Sept.: haengt ganz an der Stange, das ganze Tuch ist zu sehen (vorher nur die untere Haelfte)
  'fussmatte':  { stand: 2, kontrast: 1.2 },   // 22. Sept.: quer, 60 x 40
  'fussmatte-szene': { stand: 1, kontrast: 1.3 },   // vor der Haustuer auf Stein
  'poster-szene':     { stand: 2 },   // 22. Sept.: die ganze Rahmenoeffnung, kein Passepartout mehr
  // 22. Sept.: 'sticker-szene' hat keine Maske mehr. Der Sticker ist FREISTEHEND - er wird in die
  // Flaeche gelegt, nicht auf sie abgebildet; eine Maske des ganzen Flaschenkoerpers waere nie
  // benutzt worden und haette nur behauptet, der Sticker fuelle die Flasche aus.
  'brotdose':         { stand: 1, kontrast: 1.15 },   // 22. Sept.: der ganze Deckel, vollflaechig
  'brotdose-szene':   { stand: 1, kontrast: 1.15 },
  // 22. Sept., Markus: "Wellen schlagen, halbwegs natuerlich" - Fotos mit echten Falten; wellen =
  // das Motiv folgt den Falten (px bei 1024), kontrast = die Faltenschatten kraeftiger als im Foto.
  'handtuch-szene':   { stand: 3, wellen: 9, kontrast: 1.6 },   // im Sand von oben, das ganze Tuch, locker mit Wellen
  'strandtuch-szene': { stand: 3, wellen: 9, kontrast: 1.6 },   // im Sand am Wasser, von oben, locker mit Wellen
  'mousepad':   { stand: 1 },
  'hundedecke': { stand: 1 },
  'acrylbild':  { stand: 1 },
  'tuerschild': { stand: 1 },
  'brett':            { stand: 2, kontrast: 1.2 },   // 22. Sept.: Bambus, Loch bleibt frei
  'napfunterlage':    { stand: 1 },
  'gepaeckanhaenger': { stand: 2 },   // 8. Okt.: neues Foto, Maske ohne Oese und Schlaufe
  'mousepad-szene':         { stand: 1 },
  'hundedecke-szene':       { stand: 2, wellen: 9, kontrast: 1.5 },   // 22. Sept.: Decke locker im Korb, Motiv folgt den Falten
  'acrylbild-szene':        { stand: 1 },
  'tuerschild-szene':       { stand: 1 },
  'brett-szene':            { stand: 2, kontrast: 1.2 },   // 22. Sept.: Bambus auf dem Kuechentisch
  'napfunterlage-szene':    { stand: 2, kontrast: 1.2 },   // 22. Sept.: Naepfe und Hund davor
  'gepaeckanhaenger-szene': { stand: 1 },
  'poster-quer':            { stand: 1 },
  'poster-quer-szene':      { stand: 2 },   // 22. Sept.: ohne Passepartout
  'acrylbild-quer':         { stand: 1 },
  'acrylbild-quer-szene':   { stand: 1 },
  'tuerschild-quer':        { stand: 1 },
  'tuerschild-quer-szene':  { stand: 1 }
};
// ---------- 20. Sept.: schraege Flaechen ----------
// Markus: "Leg das Strandtuch doch einfach auf den Strand - nicht von oben, sondern wirklich so,
// wie es da liegen wuerde." Ein liegendes Tuch aus Augenhoehe ist im Foto ein schraeges Viereck,
// kein Rechteck. Eine Vorlage kann deshalb statt der box vier ECKEN tragen (oben links, oben
// rechts, unten rechts, unten links, in Pixeln der 1024er-Vorlage); das Motiv wird dann
// perspektivisch hineinprojiziert (Homographie, bilinear abgetastet).
function homographie(ecken, sw, sh) {
  // Einheitsquadrat -> Viereck (Heckbert), dann auf die Quellgroesse skaliert.
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = ecken;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  // Matrix (u,v,1) -> (x,y,w); u,v in [0,1]. Quelle in Pixeln: u = px/sw, v = py/sh.
  const M = [a / sw, b / sh, c, d / sw, e / sh, f, g / sw, h / sh, 1];
  // Inverse 3x3
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = M;
  const D = m0 * (m4 * m8 - m5 * m7) - m1 * (m3 * m8 - m5 * m6) + m2 * (m3 * m7 - m4 * m6);
  return [
    (m4 * m8 - m5 * m7) / D, (m2 * m7 - m1 * m8) / D, (m1 * m5 - m2 * m4) / D,
    (m5 * m6 - m3 * m8) / D, (m0 * m8 - m2 * m6) / D, (m2 * m3 - m0 * m5) / D,
    (m3 * m7 - m4 * m6) / D, (m1 * m6 - m0 * m7) / D, (m0 * m4 - m1 * m3) / D
  ];
}
/** Ein Bild (PNG/Buffer) perspektivisch in das Viereck 'ecken' einer W x H grossen Ebene legen; RGBA-PNG. */
export async function perspektivisch(quellePng, ecken, W = 1024, H = 1024) {
  const q = await sharp(quellePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sw = q.info.width, sh = q.info.height, src = q.data;
  const inv = homographie(ecken, sw, sh);
  const out = Buffer.alloc(W * H * 4, 0);
  const xs = ecken.map(e => e[0]), ys = ecken.map(e => e[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  const SS = 2;   // 2x2 Unterabtastung je Pixel: weiche Kanten statt Treppen
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
      const w = inv[6] * px + inv[7] * py + inv[8];
      const u = (inv[0] * px + inv[1] * py + inv[2]) / w, v = (inv[3] * px + inv[4] * py + inv[5]) / w;
      n++;
      if (u < 0 || v < 0 || u > sw - 1 || v > sh - 1) continue;
      const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy;
      const ix1 = Math.min(sw - 1, ix + 1), iy1 = Math.min(sh - 1, iy + 1);
      const p00 = (iy * sw + ix) * 4, p10 = (iy * sw + ix1) * 4, p01 = (iy1 * sw + ix) * 4, p11 = (iy1 * sw + ix1) * 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const al = src[p00 + 3] * w00 + src[p10 + 3] * w10 + src[p01 + 3] * w01 + src[p11 + 3] * w11;
      r += (src[p00] * w00 + src[p10] * w10 + src[p01] * w01 + src[p11] * w11) * al / 255;
      g += (src[p00 + 1] * w00 + src[p10 + 1] * w10 + src[p01 + 1] * w01 + src[p11 + 1] * w11) * al / 255;
      b += (src[p00 + 2] * w00 + src[p10 + 2] * w10 + src[p01 + 2] * w01 + src[p11 + 2] * w11) * al / 255;
      a += al;
    }
    if (a <= 0) continue;
    const o = (y * W + x) * 4;
    out[o] = Math.round(r * 255 / a); out[o + 1] = Math.round(g * 255 / a); out[o + 2] = Math.round(b * 255 / a); out[o + 3] = Math.round(a / n);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
/** Die vier Ecken der magentafarbenen Flaeche (oben links, oben rechts, unten rechts, unten links). */
export async function eckenAusMagenta(png, { toleranz = 72 } = {}) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let tl = null, tr = null, br = null, bl = null, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const dr = 255 - data[i], dg = data[i + 1], db = 230 - Math.min(230, data[i + 2]);
    if (dr + dg * 2 + db > toleranz * 3) continue;
    n++;
    const s = x + y, d = x - y;
    if (!tl || s < tl.s) tl = { x, y, s };
    if (!br || s > br.s) br = { x, y, s };
    if (!tr || d > tr.d) tr = { x, y, d };
    if (!bl || d < bl.d) bl = { x, y, d };
  }
  if (n < W * H * 0.001) throw new Error('Keine Platzhalterflaeche im Bild gefunden');
  return { ecken: [[tl.x, tl.y], [tr.x, tr.y], [br.x, br.y], [bl.x, bl.y]], pixel: n };
}
/** Magenta-artige Pixel durch einen ruhigen Materialton ersetzen (fuer schraege Flaechen, wo kein Rechteck passt). */
export async function magentaZuTon(png, rgb = [240, 237, 230], { toleranz = 90 } = {}) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const dr = 255 - data[i], dg = data[i + 1], db = 230 - Math.min(230, data[i + 2]);
    const nah = dr + dg * 2 + db;
    if (nah > toleranz * 3) continue;
    const t = Math.min(1, nah / (toleranz * 3));   // am Saum weich in den Stoff uebergehen
    data[i] = Math.round(rgb[0] * (1 - t) + data[i] * t); data[i + 1] = Math.round(rgb[1] * (1 - t) + data[i + 1] * t); data[i + 2] = Math.round(rgb[2] * (1 - t) + data[i + 2] * t);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Das Viereck mit einem Materialton fuellen, die Helligkeit (Falten, Licht) des Originals bleibt. */
export async function viereckAufTon(png, ecken, rgb = [240, 237, 230]) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const drin = (x, y) => {   // Punkt im konvexen Viereck (Ecken im Uhrzeigersinn)
    let vz = 0;
    for (let i = 0; i < 4; i++) { const [ax, ay] = ecken[i], [bx, by] = ecken[(i + 1) % 4]; const k = (bx - ax) * (y - ay) - (by - ay) * (x - ax); if (k !== 0) { if (vz === 0) vz = Math.sign(k); else if (Math.sign(k) !== vz) return false; } }
    return true;
  };
  // Bezugshelligkeit: der helle Teil des Platzhalters (90. Perzentil), damit der Stoff hell bleibt
  const lum = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (drin(x, y)) { const i = (y * W + x) * 4; lum.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]); }
  lum.sort((a, b) => a - b); const ref = lum.length ? lum[Math.floor(lum.length * 0.9)] : 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const dr = 255 - data[i], dg = data[i + 1], db = 230 - Math.min(230, data[i + 2]);
    const nah = dr + dg * 2 + db;
    const innen = drin(x, y);
    if (!innen && nah > 90 * 3) continue;
    const L = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const f = Math.max(0.72, Math.min(1.04, L / ref));
    const t = innen ? 0 : Math.min(1, nah / (90 * 3));
    data[i] = Math.round(rgb[0] * f * (1 - t) + data[i] * t); data[i + 1] = Math.round(rgb[1] * f * (1 - t) + data[i + 1] * t); data[i + 2] = Math.round(rgb[2] * f * (1 - t) + data[i + 2] * t);
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

// ---------- 20. Sept.: was passiert mit der leeren Flaeche? ----------
// Markus: "Es bleiben ja zwangslaeufig leere Flaechen - was machen wir automatisch damit?"
// Ein DECKENDES Motiv (eine Postkarte, ein Foto) auf einer Flaeche, die es nicht ganz fuellt:
// der Rest bekommt das Motiv selbst als Hintergrund - formatfuellend, stark weichgezeichnet,
// etwas dunkler. So ist die ganze Flaeche bedruckt und das Motiv sitzt scharf in der Mitte.
// Ein FREISTEHENDES Motiv (Shirt-Design mit Transparenz) bleibt, wie es ist: da ist der Stoff
// der Hintergrund, so wird es auch gedruckt.
// Markus, 23:50: "Bei der Postkarte aus Frankreich wuerde mir die Frankreich-Flagge einfallen."
// Ist das Land bekannt und seine Flagge ein Streifenmuster, fuellt die Flagge den Rest (etwas
// abgedunkelt, damit das Motiv vorn bleibt). Flaggen mit Wappen, Kreuz oder Sternen stehen
// nicht hier - dann bleibt es beim weichgezeichneten Motiv. Farben nach den amtlichen Angaben.
export const FLAGGEN = {
  frankreich:  { richtung: 'senkrecht',  farben: ['#0055A4', '#FFFFFF', '#EF4135'] },
  deutschland: { richtung: 'waagerecht', farben: ['#000000', '#DD0000', '#FFCE00'] },
  italien:     { richtung: 'senkrecht',  farben: ['#009246', '#FFFFFF', '#CE2B37'] },
  spanien:     { richtung: 'waagerecht', farben: ['#AA151B', '#F1BF00', '#F1BF00', '#AA151B'] },
  oesterreich: { richtung: 'waagerecht', farben: ['#ED2939', '#FFFFFF', '#ED2939'] },
  niederlande: { richtung: 'waagerecht', farben: ['#AE1C28', '#FFFFFF', '#21468B'] },
  belgien:     { richtung: 'senkrecht',  farben: ['#000000', '#FDDA24', '#EF3340'] },
  polen:       { richtung: 'waagerecht', farben: ['#FFFFFF', '#DC143C'] },
  ungarn:      { richtung: 'waagerecht', farben: ['#CE2939', '#FFFFFF', '#477050'] },
  irland:      { richtung: 'senkrecht',  farben: ['#169B62', '#FFFFFF', '#FF883E'] },
  rumaenien:   { richtung: 'senkrecht',  farben: ['#002B7F', '#FCD116', '#CE1126'] },
  luxemburg:   { richtung: 'waagerecht', farben: ['#ED2939', '#FFFFFF', '#00A1DE'] },
  estland:     { richtung: 'waagerecht', farben: ['#0072CE', '#000000', '#FFFFFF'] },
  lettland:    { richtung: 'waagerecht', farben: ['#9E3039', '#FFFFFF', '#9E3039'] },
  litauen:     { richtung: 'waagerecht', farben: ['#FDB913', '#006A44', '#C1272D'] },
  bulgarien:   { richtung: 'waagerecht', farben: ['#FFFFFF', '#00966E', '#D62612'] },
  // 1. Okt., Markus (Strandtuch des Hauses): "beim Griechen vom Griechen ist ja logisch" - neun
  // Streifen Blau und Weiss; das Kreuzfeld zeichnet flaggeSvg nicht, die Streifen tragen die Flagge.
  griechenland: { richtung: 'waagerecht', farben: ['#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF', '#FFFFFF', '#0D5EAF'] }
};
export function flaggeFuer(land) {
  const k = String(land || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').trim();
  return FLAGGEN[k] || null;
}
function flaggeSvg(fl, w, h) {
  const n = fl.farben.length;
  const teile = fl.farben.map((c, i) => fl.richtung === 'senkrecht'
    ? `<rect x="${(w * i / n).toFixed(1)}" y="0" width="${(w / n + 1).toFixed(1)}" height="${h}" fill="${c}"/>`
    : `<rect x="0" y="${(h * i / n).toFixed(1)}" width="${w}" height="${(h / n + 1).toFixed(1)}" fill="${c}"/>`).join('');
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${teile}</svg>`);
}
export async function flaecheMitMotiv(quelle, w, h, { randlos = false, deckend = false, flagge = null, mitteX = 0.5, maxBreite = 1 } = {}) {
  if (randlos) return sharp(quelle).resize({ width: w, height: h, fit: 'cover', position: 'centre', kernel: 'lanczos3' }).png().toBuffer();
  // maxBreite: Anteil der Flaeche, den das Motiv hoechstens breit sein darf (Tasse: das von vorn
  // sichtbare Fenster des Rundlaufs - ein Motiv, das darueber hinausragt, waere abgeschnitten).
  const motiv = await sharp(quelle).resize({ width: Math.max(8, Math.round(w * Math.min(1, maxBreite))), height: h, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  // mitteX: wo auf der Flaeche die Mitte des Motivs liegt (0.5 = Mitte). Die Tasse legt das
  // Motiv dorthin, wo man es von vorn sieht - nicht in die Mitte des Rundlaufs, die am Rand liegt.
  let lage = { gravity: 'centre' };
  if (mitteX !== 0.5) {
    const mm = await sharp(motiv).metadata();
    const cx = Math.min(w - mm.width / 2, Math.max(mm.width / 2, mitteX * w));
    lage = { left: Math.round(cx - mm.width / 2), top: Math.round((h - mm.height) / 2) };
  }
  let grund;
  if (deckend && flagge) {
    // 1. Okt., Markus (Strandtuch des Hauses): "links und rechts italienische Flagge, beim
    // Spanier die spanische". Die Streifen laufen entlang der Achse, die das Motiv ausfuellt -
    // dann liegen an BEIDEN freien Enden alle Farben der Flagge. Gemessen am EAST26-Tuch: Spanien
    // waagerecht (rot-gold-gold-rot quer) legte das Gold unter die Karte, zu sehen war nur Rot.
    const mm = await sharp(motiv).metadata();
    const richtung = (mm.width / mm.height >= w / h) ? 'senkrecht' : 'waagerecht';
    grund = await sharp(flaggeSvg({ ...flagge, richtung }, w, h)).png().modulate({ brightness: 0.9 }).toBuffer();
  }
  else if (deckend) {
    // 21. Sept. (Tasse mit deckendem Hochformat-Motiv): der weichgezeichnete Hintergrund liess
    // verwaschene Buchstaben neben dem Motiv stehen. Hat das Motiv einen einfarbigen Rand
    // (Karte auf Papier, Block auf Farbe), wird die Flaeche in genau dieser Farbe weitergefuehrt;
    // sonst so stark weichgezeichnet, dass keine Form mehr zu erkennen ist.
    const rf = await randfarbe(quelle);
    if (rf) grund = await sharp({ create: { width: w, height: h, channels: 4, background: { r: Math.round(rf.r * 0.94), g: Math.round(rf.g * 0.94), b: Math.round(rf.b * 0.94), alpha: 1 } } }).png().toBuffer();
    else grund = await sharp(quelle).resize({ width: w, height: h, fit: 'cover', position: 'centre' }).blur(Math.max(20, Math.round(Math.min(w, h) / 8))).modulate({ brightness: 0.88, saturation: 0.9 }).png().toBuffer();
  }
  else grund = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  return sharp(grund).composite([{ input: motiv, ...lage }]).png().toBuffer();
}
/** Einfarbiger Rand des (beschnittenen) Motivs? Dann diese Farbe, sonst null. */
export async function randfarbe(png) {
  let bild = await sharp(png).resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  try { bild = await sharp(bild).trim({ threshold: 2 }).png().toBuffer(); } catch (e) { /* nichts zu beschneiden */ }
  const { data, info } = await sharp(bild).ensureAlpha().resize({ width: 160, height: 160, fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ring = 4;
  const s = [0, 0, 0], q = [0, 0, 0]; let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x >= ring && x < W - ring && y >= ring && y < H - ring) continue;
    const i = (y * W + x) * 4;
    if (data[i + 3] < 128) continue;
    for (let c = 0; c < 3; c++) { s[c] += data[i + c]; q[c] += data[i + c] * data[i + c]; }
    n++;
  }
  if (n < (2 * ring * (W + H)) * 0.6) return null;   // Rand grossteils durchsichtig (rund, ausgefranst)
  const m = s.map(v => v / n), sd = q.map((v, c) => Math.sqrt(Math.max(0, v / n - m[c] * m[c])));
  return Math.max(...sd) < 18 ? { r: Math.round(m[0]), g: Math.round(m[1]), b: Math.round(m[2]) } : null;
}
/** Ist das Motiv deckend (praktisch ohne durchsichtige Stellen)? */
export async function istDeckend(png) {
  const m = await sharp(png).metadata();
  if (!m.hasAlpha) return true;
  // Gezaehlt wird im beschnittenen Motiv (ohne durchsichtige Raender): sind fast alle Pixel
  // darin deckend, ist es eine Karte oder ein Foto - ein Shirt-Design hat Luft zwischen den Teilen.
  // Gemessen 21. Sept.: trim auf einer grossen Druckdatei kostet eine Sekunde - fuer eine
  // Statistik reicht eine kleine Fassung (erst verkleinern, dann beschneiden).
  let bild = await sharp(png).resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  try { bild = await sharp(bild).trim({ threshold: 2 }).png().toBuffer(); } catch (e) { /* nichts zu beschneiden */ }
  const { data, info } = await sharp(bild).ensureAlpha().resize({ width: 256, fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let deck = 0, n = 0;
  for (let i = 3; i < data.length; i += 4) { n++; if (data[i] > 128) deck++; }
  return n > 0 && deck / n >= 0.97;
}

// ---------- 21. Sept.: das laufende Band auf der Startseite ----------
// Markus: "quer durch alle Artikel, die wir haben - abwechslungsreich Handtuecher, T-Shirts,
// Hoodies, und auch mal von hinten mit Namensliste." Fuer das i-te Design der Reihe: das Teil
// aus der Liste des Mottos im Wechsel; hat das Design eine Rueckseite mit Namen, kommt jedes
// dritte Textil von hinten. Reine Rechnung, damit die Abnahme sie prueft.
const REIHENFOLGE = ['tee', 'strandtuch', 'hoodie', 'kissen', 'poster', 'tasse', 'zip', 'beutel', 'polo', 'sticker', 'handtuch', 'fussmatte', 'acrylbild', 'tuerschild', 'mousepad', 'hundedecke', 'brett', 'napfunterlage', 'gepaeckanhaenger', 'brotdose', 'grillschuerze'];
// 22. Sept., 10:00, Markus: "Auf eine Hundedecke ein Hochzeitsmotiv zu machen, ist total
// bescheuert. Da kommt natuerlich ein Hundemotiv rein. Ein Tuerschild muss natuerlich irgendwas mit
// einer Familie zu tun haben. Napfunterlage hat ja auch was mit dem Tier zu tun." Welche Mottos
// auf welchem Artikel VORGEZEIGT werden (Band, Startseite). Bestellen kann jeder alles - das hier
// ist nur, womit wir werben. Artikel ohne Eintrag: jedes Motto.
export const ARTIKEL_MOTTOS = {
  hundedecke: ['tier-shirt', 'kinder-tiershirt'],
  napfunterlage: ['tier-shirt', 'kinder-tiershirt'],
  tuerschild: ['familie', 'geburt-baby'],
  fussmatte: ['familie', 'geburt-baby', 'hochzeit'],
  brotdose: ['kinder-tiershirt', 'tier-shirt', 'familie'],   // 22. Sept.: Brotdose und Sticker sind Kindersachen
  sticker: ['kinder-tiershirt', 'tier-shirt', 'familie', 'geburt-baby']
};
export function passtVorzeige(garment, slug) {
  if (GARMENTS[garment] && GARMENTS[garment].aus) return false;   // 1. Okt.: Schneidebrett raus, ueberall
  const l = ARTIKEL_MOTTOS[String(garment || '')];
  return !l || l.includes(String(slug || ''));
}
export function schaufensterTeil(teile, i, hatRueckseite = false) {
  const da = REIHENFOLGE.filter(g => (teile || []).includes(g));
  if (!da.length) return { garment: 'tee', side: '' };
  const garment = da[Math.max(0, i) % da.length];
  const textil = ['tee', 'hoodie', 'zip', 'polo'].includes(garment);
  return { garment, side: hatRueckseite && textil && (i % 3 === 2) ? 'back' : '' };
}
// 22. Sept., 07:01, Markus (Band nur mit Beutel, Shirt, Hoodie): "Warum sind hier schon wieder
// nicht alle Artikel, die wir besprochen haben?" - und: "Warum faellt das immer wieder zurueck?"
// Weil das Band 24 Designs ZUFAELLIG aus gut 230 zog und die paar, die fuer Kissen, Handtuch,
// Mousepad oder Hundedecke gezeichnet sind, so gut wie nie drankamen - und keine Abnahme das
// gemessen hat. Jetzt eine reine Rechnung, die die Abnahme prueft: zuerst je Artikel EIN eigenes
// Design (zufaellig aus denen, die es fuer ihn gibt), dann die Shirt-Designs; die Artikel-Designs
// gleichmaessig ueber das Band verteilt. items: { artikel: '' | <garment>, ... }.
export function bandAuswahl(items, limit, zufall = Math.random) {
  const mischen = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const k = Math.floor(zufall() * (i + 1)); [arr[i], arr[k]] = [arr[k], arr[i]]; } return arr; };
  const jeArtikel = {};
  for (const x of mischen(items.filter(x => x && x.artikel))) (jeArtikel[x.artikel] = jeArtikel[x.artikel] || []).push(x);
  const eigene = mischen(Object.values(jeArtikel).map(l => l[0]));
  const textil = mischen(items.filter(x => x && !x.artikel));
  const n = Math.max(0, Math.min(limit, eigene.length + textil.length));
  const plaetze = new Set(eigene.map((_, k) => Math.min(n - 1, Math.floor((k + 0.5) * n / Math.max(1, eigene.length)))));
  const out = [];
  for (let i = 0; i < n; i++) out.push((plaetze.has(i) && eigene.length ? eigene.shift() : null) || textil.shift() || eigene.shift());
  return out.filter(Boolean);
}

/**
 * Ein Motiv um einen Zylinder legen (Tasse): die Breite des Motivs wird als Bogen auf die Vorder-
 * seite gelegt - in der Mitte in voller Breite, zu den Raendern hin verkuerzt (Sinus) und
 * abgedunkelt. box ist der sichtbare Koerper; thetaMax der halbe sichtbare Winkel.
 * Rueckgabe: RGBA-PNG (W x H) mit dem gewoelbten Motiv, vertikal mittig in der box.
 */
// 21. Sept., 08:05, Markus: "Recherchiere bitte, wie eine Tasse aussieht mit einem vollflaechigen
// Druck komplett einmal rum." Beim Rundumdruck (Panoramatasse) laeuft der Druck bis zur Silhouette
// der Tasse - vorn sieht man den halben Umfang (thetaMax 90 Grad), am Rand grasend und dunkler.
// `ellipse`: der Trinkrand ist von leicht oben gesehen eine Ellipse; Ober- und Unterkante des
// Drucks folgen ihr (am Rand um so viele Pixel hoeher als vorn in der Mitte).
// 08:40, Markus: "Bei der Tasse arbeite bitte genauer - das ist nicht genau da drauf und die
// Rundung ueberhaupt nicht genau berechnet. Einmal ordentlich machen, dann kann man's immer
// wieder nutzen." Deshalb ein echtes Zylindermodell, an der Vorlage abgemessen (zyl):
//   cx, R        Mitte und Radius des Koerpers im Bild (Silhouette links/rechts)
//   oben {y, e}  Ellipse des Trinkrands: y in der Mitte der Ellipse, e = halbe Hoehe; die
//                vordere Kante liegt bei y + e, die Seiten bei y
//   unten {y, e} dasselbe fuer den Boden (von schraeg oben gesehen ist e unten groesser)
//   henkel       Rechtecke am Henkelansatz, die frei bleiben
// Das Motiv (die GANZE Rundumflaeche, aw x ah) liegt ueber druckWinkel um den Zylinder, die
// Mitte vorn. Jede Bildspalte ist ein Winkel theta = asin((x - cx) / R); Ober- und Unterkante
// des Drucks folgen den beiden Ellipsen, dazwischen wird die Hoehe linear abgetragen.
// Schattierung: aus der Vorlage selbst - die Helligkeit des unbedruckten Koerpers, bezogen auf
// die Mitte vorn (template). So bleiben Lichtkante, Abdunkelung und Henkelschatten echt.
export async function zylindrisch(wrapPng, zyl, { druckWinkel = Math.PI * 1.55, randOben = 0.03, randUnten = 0.03, template = null, W = 1024, H = 1024 } = {}) {
  const q = await sharp(wrapPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const aw = q.info.width, ah = q.info.height, src = q.data;
  let lum = null, lumRef = 1;
  if (template) {
    const t = await sharp(template).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    lum = t.data;
    const yc = Math.round((zyl.oben.y + zyl.oben.e + zyl.unten.y + zyl.unten.e) / 2), xc = Math.round(zyl.cx);
    let s = 0, n = 0;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { s += lum[(yc + dy) * W + xc + dx]; n++; }
    lumRef = Math.max(8, s / n);
  }
  const out = Buffer.alloc(W * H * 4, 0);
  const halb = druckWinkel / 2;
  // Der Rundlauf liegt gegenueber dem Henkel: seine Mitte bei henkelWinkel - 180 Grad, der
  // freie Streifen (Umfang minus Druck) mittig um den Henkel. Henkel rechts im Bild = +90 Grad.
  const henkel = typeof zyl.henkelWinkel === 'number' ? zyl.henkelWinkel : Math.PI / 2;
  const versatz = henkel - Math.PI;
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const winkelZu = (theta) => { let d = theta - versatz; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  for (let x = Math.max(0, Math.floor(zyl.cx - zyl.R)); x <= Math.min(W - 1, Math.ceil(zyl.cx + zyl.R)); x++) {
    const sm = (x + 0.5 - zyl.cx) / zyl.R;
    if (Math.abs(sm) >= 1) continue;
    const n = Math.abs(sm) > 0.9 ? 8 : 2;   // am Rand laeuft das Motiv steil zusammen: feiner abtasten
    const thetaM = Math.asin(sm);
    const yT = zyl.oben.y + zyl.oben.e * Math.cos(thetaM), yB = zyl.unten.y + zyl.unten.e * Math.cos(thetaM);
    const yS = yT + (yB - yT) * randOben, yE = yB - (yB - yT) * randUnten;
    for (let y = Math.max(0, Math.floor(yS)); y <= Math.min(H - 1, Math.ceil(yE)); y++) {
      const v = (y + 0.5 - yS) / (yE - yS);
      if (v < 0 || v >= 1) continue;
      const sy = Math.min(ah - 1, Math.floor(v * ah));
      let r = 0, g = 0, b = 0, a = 0, k = 0;
      for (let i = 0; i < n; i++) {
        const s0 = (x + (i + 0.5) / n - zyl.cx) / zyl.R;
        if (Math.abs(s0) >= 1) continue;
        const d = winkelZu(Math.asin(s0));
        if (d < -halb || d > halb) continue;
        const u = Math.min(aw - 1, Math.max(0, Math.floor((d / druckWinkel + 0.5) * aw)));
        const p = (sy * aw + u) * 4;
        r += src[p]; g += src[p + 1]; b += src[p + 2]; a += src[p + 3]; k++;
      }
      if (!k) continue;
      const sh = lum ? Math.min(1.6, Math.max(0.25, lum[y * W + x] / lumRef)) : 0.66 + 0.34 * Math.cos(thetaM);
      const o = (y * W + x) * 4;
      out[o] = clamp(r / k * sh); out[o + 1] = clamp(g / k * sh); out[o + 2] = clamp(b / k * sh); out[o + 3] = Math.round(a / n);
    }
  }
  for (const [hx, hy, hw, hh] of (zyl.henkel || [])) {
    for (let y = Math.max(0, hy); y < Math.min(H, hy + hh); y++) for (let x = Math.max(0, hx); x < Math.min(W, hx + hw); x++) out[(y * W + x) * 4 + 3] = 0;
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}
// ---------- 21. Sept.: Druck auf eine MASKIERTE Flaeche mit echter Schattierung ----------
// Markus (Kissen auf dem Sofa): "Das ist einfach nur ein Rechteck drauf gemalt. Das ist kein
// Kissen. Es muss alles 100 % sein, immer wiederkehrend und skalierbar." Der Weg fuer jeden
// Artikel: ein echtes Foto des unbedruckten Teils (Falten, Naehte, Licht) und eine Maske der
// bedruckbaren Flaeche (aus einer Magenta-Fassung desselben Fotos). Das Motiv wird Zeile fuer
// Zeile zwischen linkem und rechtem Maskenrand und Spalte fuer Spalte zwischen oberem und
// unterem Rand abgetragen - so folgt es auch einer bauchigen Kante, nichts wird abgeschnitten,
// nichts bleibt unbedruckt. Die Helligkeit des Fotos (Falten, Schatten, Lichtkante) bleibt als
// Schattierung auf dem Druck: Motiv mal (Helligkeit / Referenz), Referenz = die helle Mitte.
export async function maskeKanten(maskPng, W = 1024, H = 1024) {
  const m = await sharp(maskPng).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const d = m.data, ch = m.info.channels;
  const links = new Int16Array(H).fill(-1), rechts = new Int16Array(H).fill(-1), oben = new Int16Array(W).fill(-1), unten = new Int16Array(W).fill(-1);
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * ch] < 128) continue;
    if (links[y] < 0) links[y] = x; rechts[y] = x;
    if (oben[x] < 0) oben[x] = y; unten[x] = y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  // Die vier Ecken der Flaeche (oben links, oben rechts, unten rechts, unten links) - die
  // aeussersten Randpunkte in den vier Diagonalrichtungen. Sie sagen, wo eine Kante WIRKLICH
  // die obere bzw. seitliche Kante ist: bei einem Tuch, dessen rechte Kante schraeg nach aussen
  // laeuft (ueber dem Liegestuhl), gibt es Spalten, die nur im unteren Bereich zur Flaeche
  // gehoeren - ihr "oberer Rand" ist die schraege Seitenkante, nicht die Oberkante.
  let TL = null, TR = null, BR = null, BL = null;
  for (let y = y0; y <= y1; y++) {
    if (links[y] < 0) continue;
    for (const x of [links[y], rechts[y]]) {
      if (!TL || x + y < TL.x + TL.y) TL = { x, y };
      if (!TR || x - y > TR.x - TR.y) TR = { x, y };
      if (!BR || x + y > BR.x + BR.y) BR = { x, y };
      if (!BL || x - y < BL.x - BL.y) BL = { x, y };
    }
  }
  const ecken = TL ? [TL, TR, BR, BL] : null;
  // Die Kanten glaetten: an vorstehenden Ecken (ein Kissen hat welche) ist eine Spalte nur ein
  // paar Pixel hoch, und ohne Glaettung wuerde dort das ganze Motiv hineingequetscht. Ein
  // breiter gleitender Mittelwert macht aus der Kante eine ruhige Linie; was darueber hinaus in
  // der Maske liegt, bekommt den Rand des Motivs (fu/fv werden begrenzt).
  // Gemittelt wird nur innerhalb der Spanne zwischen den beiden Ecken der Kante - sonst zieht
  // eine schraege Seitenkante die Oberkante an der Ecke nach unten.
  const glatt = (arr, von, bis) => {
    const n = arr.length, out = new Float32Array(n), R = 40;
    const a = Math.max(0, Math.min(von, bis)), b = Math.min(n - 1, Math.max(von, bis));
    for (let i = 0; i < n; i++) {
      if (arr[i] < 0) { out[i] = -1; continue; }
      let s = 0, k = 0;
      for (let j = Math.max(a, i - R); j <= Math.min(b, i + R); j++) if (arr[j] >= 0) { s += arr[j]; k++; }
      out[i] = k ? s / k : arr[i];
    }
    return out;
  };
  const e = ecken || [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  return { links: glatt(links, e[0].y, e[3].y), rechts: glatt(rechts, e[1].y, e[2].y), oben: glatt(oben, e[0].x, e[1].x), unten: glatt(unten, e[3].x, e[2].x), ecken: e, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, maske: d, ch, W, H };
}
// 22. Sept., Markus (Handtuecher im Band): "einfach auf dem Sand drauf geknallt. Wir wollten,
// dass sie auch Wellen schlagen, so dass es halbwegs natuerlich aussieht." Zwei Dinge dafuer:
// wellen = das Motiv folgt den Falten des Fotos - die weichgezeichnete Helligkeit des Tuchs
// verschiebt die Abtastung (hell = Wellenkamm, dunkel = Tal), so wie ein Druck auf gewelltem
// Frottee wirklich liegt; kontrast = die Schattierung der Falten wird verstaerkt (1 = wie das
// Foto), damit Kaemme und Taeler auch auf einem kraeftigen Motiv sichtbar bleiben.
export async function flaecheAufMaske(basisPng, maskPng, motivPng, { schatten = true, hell = 0.92, weich = 1, W = 1024, H = 1024, wellen = 0, kontrast = 1 } = {}) {
  const k = await maskeKanten(maskPng, W, H);
  const q = await sharp(motivPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const aw = q.info.width, ah = q.info.height, src = q.data;
  let lum = null, ref = 1, welle = null;
  if (wellen > 0) {
    // Weich (Radius ~6 px bei 1024): Frottee-Koernung faellt raus, die Falten bleiben.
    const w = await sharp(basisPng).resize(W, H, { fit: 'fill' }).greyscale().blur(6).raw().toBuffer({ resolveWithObject: true });
    welle = w.data;
  }
  if (schatten) {
    const t = await sharp(basisPng).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
    lum = t.data;
    // Referenz: die hellen Stellen der Flaeche (90. Perzentil), nicht das Maximum - sonst
    // wuerde ein einzelner Glanzpunkt alles andere dunkel machen.
    const werte = [];
    for (let y = k.box.y; y < k.box.y + k.box.h; y += 3) for (let x = k.box.x; x < k.box.x + k.box.w; x += 3) if (k.maske[(y * W + x) * k.ch] >= 128) werte.push(lum[y * W + x]);
    werte.sort((a, b) => a - b);
    ref = Math.max(16, werte[Math.floor(werte.length * 0.9)] || 200) / hell;
  }
  const out = Buffer.alloc(W * H * 4, 0);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  // Abbildung: waagerecht zwischen linker und rechter Kante DIESER Zeile (fu). Senkrecht
  // zwischen Ober- und Unterkante - aber nicht der Spalte x, sondern der Spalte, die auf der
  // Oberkante (zwischen den oberen Ecken) bzw. Unterkante (zwischen den unteren Ecken) zu fu
  // gehoert. Bei einer schraegen Seitenkante (Handtuch ueber dem Liegestuhl) laege in der
  // Spalte x sonst die Seitenkante als "Oberkante", und das Motiv wuerde dort zusammengequetscht.
  const [TL, TR, BR, BL] = k.ecken;
  const spalte = (x) => Math.max(0, Math.min(W - 1, Math.round(x)));
  // Mittlere Helligkeit der weichen Flaeche: Verschiebung 0 auf mittlerer Hoehe, Kaemme nach
  // der einen, Taeler nach der anderen Seite.
  let welleMitte = 128;
  if (welle) { let s = 0, c = 0; for (let y = k.box.y; y < k.box.y + k.box.h; y += 2) for (let x = k.box.x; x < k.box.x + k.box.w; x += 2) if (k.maske[(y * W + x) * k.ch] >= 128) { s += welle[y * W + x]; c++; } welleMitte = c ? s / c : 128; }
  for (let y = k.box.y; y < k.box.y + k.box.h; y++) {
    if (k.links[y] < 0) continue;
    for (let x = k.box.x; x < k.box.x + k.box.w; x++) {
      const i = (y * W + x);
      if (k.maske[i * k.ch] < 128) continue;
      // Wellen: die Abtaststelle rutscht mit der Falte - innerhalb der Maske bleiben.
      let xs = x, ys = y;
      if (welle) {
        const d = (welle[i] - welleMitte) / 128 * wellen;
        // Die Kanten sind geglaettet (Kommazahlen) - die Abtaststelle muss ganzzahlig bleiben.
        xs = Math.round(Math.max(k.links[y] >= 0 ? k.links[y] : x, Math.min(k.rechts[y] >= 0 ? k.rechts[y] : x, x + d)));
        ys = Math.round(Math.max(k.oben[x] >= 0 ? k.oben[x] : y, Math.min(k.unten[x] >= 0 ? k.unten[x] : y, y + d * 0.6)));
        if (!(k.links[ys] >= 0)) ys = y;
        if (!(xs >= 0 && xs < W)) xs = x;
      }
      const l = k.links[ys], r = k.rechts[ys], breite = Math.max(1, r - l);
      const fu = Math.min(1, Math.max(0, (xs - l + 0.5) / (breite + 1)));
      let o = k.oben[spalte(TL.x + fu * (TR.x - TL.x))], u = k.unten[spalte(BL.x + fu * (BR.x - BL.x))];
      if (!(o >= 0)) o = k.oben[xs]; if (!(u >= 0)) u = k.unten[xs];
      const hoehe = Math.max(1, u - o);
      const fv = Math.min(1, Math.max(0, (ys - o + 0.5) / (hoehe + 1)));
      // bilinear im Motiv
      const sx = Math.min(aw - 1.001, Math.max(0, fu * aw - 0.5)), sy = Math.min(ah - 1.001, Math.max(0, fv * ah - 0.5));
      const ix = Math.floor(sx), iy = Math.floor(sy), tx = sx - ix, ty = sy - iy;
      const p00 = (iy * aw + ix) * 4, p10 = p00 + 4, p01 = p00 + aw * 4, p11 = p01 + 4;
      const mix = (c) => (src[p00 + c] * (1 - tx) + src[p10 + c] * tx) * (1 - ty) + (src[p01 + c] * (1 - tx) + src[p11 + c] * tx) * ty;
      const sh = lum ? Math.min(1.15, Math.max(0.3, 1 + (lum[i] / ref - 1) * kontrast)) : 1;
      // Weiche Kante: am Maskenrand die Deckung zuruecknehmen
      const rand = Math.min(x - k.links[y], k.rechts[y] - x, y - k.oben[x], k.unten[x] - y);
      const deck = rand < weich ? (rand + 0.5) / (weich + 0.5) : 1;
      const oo = i * 4;
      out[oo] = clamp(mix(0) * sh); out[oo + 1] = clamp(mix(1) * sh); out[oo + 2] = clamp(mix(2) * sh); out[oo + 3] = clamp(mix(3) * deck);
    }
  }
  const ebene = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return { ebene, box: k.box };
}
/**
 * Eine fertig gelegte Ebene (z. B. perspektivisch ins Viereck gelegt) an der Maske beschneiden
 * und mit der Schattierung des Fotos versehen - derselbe Weg wie flaecheAufMaske, nur ohne das
 * Abtragen: fuer Flaechen, deren Perspektive ein Viereck (ecken) besser trifft als die Kanten.
 */
export async function maskeUndSchatten(basisPng, maskPng, ebenePng, { hell = 0.92, W = 1024, H = 1024 } = {}) {
  const k = await maskeKanten(maskPng, W, H);
  const e = await sharp(ebenePng).ensureAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const t = await sharp(basisPng).resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const lum = t.data, werte = [];
  for (let y = k.box.y; y < k.box.y + k.box.h; y += 3) for (let x = k.box.x; x < k.box.x + k.box.w; x += 3) if (k.maske[(y * W + x) * k.ch] >= 128) werte.push(lum[y * W + x]);
  werte.sort((a, b) => a - b);
  const ref = Math.max(16, werte[Math.floor(werte.length * 0.9)] || 200) / hell;
  const out = Buffer.alloc(W * H * 4, 0);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  for (let i = 0; i < W * H; i++) {
    if (k.maske[i * k.ch] < 128) continue;
    const sh = Math.min(1.15, Math.max(0.3, lum[i] / ref));
    const o = i * 4;
    out[o] = clamp(e.data[o] * sh); out[o + 1] = clamp(e.data[o + 1] * sh); out[o + 2] = clamp(e.data[o + 2] * sh); out[o + 3] = e.data[o + 3];
  }
  return { ebene: await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), box: k.box };
}
/** Zylinder aus einer schlichten Flaeche (kein abgemessenes Modell): Silhouette = Flaeche, keine Ellipsen. */
export function zylinderAusBox(box) {
  return box.zylinder || { cx: box.x + box.w / 2, R: box.w / 2, oben: { y: box.y, e: 0 }, unten: { y: box.y + box.h, e: 0 }, henkel: [] };
}

/** Ist ein Motiv (Breite x Hoehe in Pixeln) Querformat im Sinne der Vorlagenwahl? */
export const istQuer = (w, h) => w > 0 && h > 0 && w > h * 1.15;
/** Gibt es fuer dieses Teil eine Querformat-Vorlage (Produktansicht) in dieser Farbe? */
export async function querVorlageDa(garment, color) {
  return !!mitgelieferteBox(garment + '-quer_' + color) && templateReady(garment + '-quer', color);
}
/** Flaeche einer mitgelieferten Vorlage - key mit Farbe ('poster-szene_black'). */
/** Die Textil-Linien mit eigenen Mockup-Vorlagen (Herstellerfotos), siehe MITGELIEFERT. */
export const LINIEN = { bc: 'B&C', ss: 'Stanley/Stella', roly: 'Roly' };   // 6. Okt.: Roly dazu (Ottos Starter)
export const LINIE_STANDARD = 'bc';   // Ottos Liebling - die Mitte, und die Vorgabe im Kauf
/** Gibt es fuer diese Linie, dieses Teil und diese Farbe ein Herstellerfoto als Vorlage? */
export async function linieVorlageDa(linie, garment, color) {
  const k = String(linie || '') + '-' + garment;
  const m = MITGELIEFERT[k];
  if (!m || !m.linie || !(m.dateien && m.dateien[color])) return false;
  return templateReady(k, color);
}
export function mitgelieferteBox(key) {
  const k = String(key);
  const farbe = (k.match(/_(black|white)$/) || [])[1];
  const m = MITGELIEFERT[k.replace(/_(black|white)$/, '')];
  if (!m) return null;
  // boxen: je Farbe eine eigene Flaeche (zwei Fotos, z. B. die getragenen Textilien als Frau/Mann)
  return (farbe && m.boxen && m.boxen[farbe]) || m.box || null;
}

// Leichte Abweichungen der weissen Vorlagen von den schwarzen.
export const BOX_OVERRIDES = {
  'hoodie_white': { x: 390, y: 240, w: 243, h: 365 },
  'zip_white':    { x: 342, y: 320, w: 340, h: 510 },
  // Tasse: der ganze Koerper von der vorderen Kante des Trinkrands bis zum Boden, von der linken
  // Silhouette bis zum Henkelansatz (21. Sept. an den Herstellerfotos abgemessen). ellipse: der
  // Trinkrand liegt am Rand rund 20 px hoeher als vorn in der Mitte.
  // 08:40: abgemessen im 3x-Raster (scratchpad mug-*-top/bottom/handle): Silhouette, Ellipse des
  // Trinkrands (Mitte/halbe Hoehe), Ellipse des Bodens, Henkelansatz. x/y/w/h = vordere Kante
  // des Trinkrands bis Boden vorn, Silhouette bis Henkelansatz (fuer Logos und Masse).
  'tasse_white':  { x: 266, y: 275, w: 449, h: 520, zylinder: { cx: 490.5, R: 224.5, oben: { y: 245, e: 30 }, unten: { y: 748, e: 47 }, henkel: [[700, 296, 16, 96], [700, 586, 16, 94]] } },
  'tasse_black':  { x: 242, y: 242, w: 480, h: 588, zylinder: { cx: 482, R: 240, oben: { y: 217, e: 25 }, unten: { y: 791, e: 39 }, henkel: [[700, 277, 23, 104], [700, 600, 23, 110]] } },
  // 22. Sept.: die Tasse auf dem Fruehstueckstisch, an der Magenta-Fassung des Fotos abgemessen
  // (Koerper x 278-709, Trinkrand vorn 261 / seitlich 244, Boden vorn 783 / seitlich 735).
  'tasse-szene_white': { x: 278, y: 240, w: 432, h: 544, zylinder: { cx: 493.5, R: 215.5, oben: { y: 244, e: 17 }, unten: { y: 735, e: 48 }, henkel: [[700, 300, 12, 60], [696, 590, 16, 60]] } },
  // 2. Okt., Markus: "Bei einigen Beuteln war das Motiv nie so richtig." Der weisse und der schwarze
  // Beutel sind zwei verschiedene Fotos, es galt aber EINE Flaeche (GARMENTS.beutel.box) - auf dem
  // weissen sass der Druck 38 px rechts der Mitte, auf dem schwarzen klebte er fast am rechten Rand
  // und an der Naht oben. Korpus nachgemessen (werkzeug/beutel-korpus.mjs):
  //   weiss   x 244-775, y 396-970 (531 x 574 px = 38 x 42 cm, 13,97 / 13,67 px/cm)
  //   schwarz x 288-733, y 430-941 (445 x 511 px = 38 x 42 cm, 11,71 / 12,17 px/cm)
  // Druck 30 x 30 cm, waagrecht mittig, 6 cm unter der Oberkante, 6 cm Luft unten.
  'beutel_white': { x: 300, y: 478, w: 419, h: 410 },
  'beutel_black': { x: 335, y: 503, w: 351, h: 365 }
};
// Der gemessene Korpus der beiden Beutelfotos, fuer die Abnahme (Druck mittig und innen).
export const BEUTEL_KORPUS = { white: { x0: 244, x1: 775, y0: 396, y1: 970 }, black: { x0: 288, x1: 733, y0: 430, y1: 941 } };

let dir = null;

export async function ensureTemplates(storeDir) {
  dir = path.join(storeDir, 'templates');
  await fs.mkdir(dir, { recursive: true });
  // Aufraeumen: die eingefaerbten Vorlagen werden nicht mehr benutzt und belegen nur das Volume.
  try {
    const alt = new RegExp('_(' + ALTE_TOENUNGEN.join('|') + ')(_v2)?\\.png$');
    for (const f of await fs.readdir(dir)) if (alt.test(f)) await fs.rm(path.join(dir, f), { force: true });
  } catch (e) { /* nicht wichtig */ }
  // Fassung 76 (Markus, 17. Sept.: "Leider sind die Fotos alle weg"): Hier stand nur, ob die
  // DATEI da ist. Das ist eine viel zu schwache Pruefung fuer etwas so Sichtbares. An dem Tag
  // waren graue Platzhalter aus einem Testlauf in den Ordner geraten - sie existierten, also
  // lud der Server die echten Produktfotos nie nach, und jedes Mockup war eine graue Flaeche.
  //
  // Jetzt wird nachgesehen, ob wirklich ein Foto drinsteckt: ein echtes Produktfoto hat viele
  // verschiedene Farbwerte, eine Platzhalterkachel hat genau einen Ton. Gemessen wird an der
  // Standardabweichung ueber alle Kanaele - unter 4 ist das Bild praktisch einfarbig, und das
  // ist NIE ein Produktfoto. Solche Dateien fliegen raus und werden neu geholt.
  const missing = [];
  for (const key of Object.keys(SOURCES)) {
    const p = path.join(dir, key + '.png');
    try {
      await fs.access(p);
      const st = await sharp(p).stats();
      const streuung = st.channels.reduce((s, c) => s + (c.stdev || 0), 0) / (st.channels.length || 1);
      if (streuung < 4) {
        console.warn('Vorlage ist einfarbig, also kein Produktfoto - wird neu geholt:', key, '(Streuung ' + streuung.toFixed(1) + ')');
        await fs.rm(p, { force: true });
        missing.push(key);
      }
    } catch (e) { missing.push(key); }
  }
  // Fassung 90: Die Herstellerfotos lagen bis heute NUR auf einem fremden Host
  // (mcp.markusassemacher.de bzw. dem Bildserver). Faellt der aus oder raeumt er auf, kann kein
  // einziges Mockup mehr entstehen - jede Kachel der Startseite haengt daran. Seit dem 18. Sept.
  // liegt eine Kopie jedes Fotos im Repo (vorlagen-original/, 1024 px, JPEG, zusammen 2 MB).
  // Die wird ZUERST genommen; der Host ist nur noch der Rueckfall fuer ein Foto, das dort fehlt.
  for (const key of missing) {
    const kopie = path.resolve('vorlagen-original', key + '.jpg');
    try {
      const buf = await fs.readFile(kopie);
      const png = await sharp(buf).resize({ width: 1024, height: 1024, fit: 'cover' }).png().toBuffer();
      await fs.writeFile(path.join(dir, key + '.png'), png);
      console.log('Vorlage aus dem Repo:', key);
      continue;
    } catch (e) { /* keine Kopie im Repo - dann vom Host */ }
    try {
      const r = await fetch(SOURCES[key], { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const png = await sharp(buf).resize({ width: 1024, height: 1024, fit: 'cover' }).png().toBuffer();
      await fs.writeFile(path.join(dir, key + '.png'), png);
      console.log('Vorlage vom Host geladen:', key);
    } catch (e) {
      console.error('Vorlage fehlt:', key, '- weder im Repo noch vom Host:', e && e.message ? e.message : e);
    }
  }
  // Mitgelieferte Vorlagen (siehe MITGELIEFERT): liegt zu einem Schluessel und einer Farbe noch
  // keine Datei da, kommt sie aus dem Repo. Eine vorhandene Datei bleibt - es sei denn, das Repo
  // bringt einen HOEHEREN STAND (MITGELIEFERT[key].stand) als den, der beim Kopieren vermerkt
  // wurde (templates/mitgeliefert.json): dann ersetzt die neue Datei die alte. Eine Vorlage, die
  // ueber den Knopf im Backend erzeugt wurde (selbst gemessene Flaeche, gelernteBox), wird nie
  // ersetzt. Live am 20. Sept.: die erste Strandtuch-Szene lag schon auf dem Volume, die
  // korrigierte kam nie an.
  const standDatei = path.join(dir, 'mitgeliefert.json');
  let staende = {};
  try { staende = JSON.parse(await fs.readFile(standDatei, 'utf8')) || {}; } catch (e) { staende = {}; }
  let geaendert = false, boxenNeu = false;
  for (const key of Object.keys(MITGELIEFERT)) {
    const soll = +MITGELIEFERT[key].stand || 1;
    for (const c of COLORS) {
      const k = key + '_' + c;
      const p = path.join(dir, k + '.png');
      let da = true;
      try { await fs.access(p); } catch (e) { da = false; }
      const alt = +staende[k] || 0;
      // 22. Sept., Markus (Poster im Band): "wieder auf ein altes Muster zurueckgefallen, es ist
      // nicht komplett ausgefuellt, das hatten wir doch schon fertig!!!" Der Fix WAR fertig -
      // Stand 89 hat ein Posterfoto ohne Passepartout gebracht. Angekommen ist er nie: hier stand
      // "&& !gelernteBox(k)", also blieb eine Vorlage, zu der irgendwann einmal eine Flaeche
      // gemessen wurde, fuer immer liegen. Das ist genau falsch herum - eine gemessene Flaeche
      // gehoert zu EINEM Foto. Kommt ein neues, ist die alte Messung nicht schuetzenswert,
      // sondern schlicht ungueltig: sie zeigt auf eine Rahmenoeffnung, die es nicht mehr gibt.
      const veraltet = da && alt < soll;
      if (da && !veraltet) continue;
      // Linien-Vorlagen bringen je Farbe eine eigene Datei (dateien); fehlt eine Farbe, gibt es sie nicht
      if (MITGELIEFERT[key].dateien && !MITGELIEFERT[key].dateien[c]) continue;
      try {
        const buf = await fs.readFile(path.resolve('vorlagen-original', (MITGELIEFERT[key].dateien && MITGELIEFERT[key].dateien[c]) || MITGELIEFERT[key].datei || (key + '.jpg')));
        await fs.writeFile(p, await sharp(buf).resize({ width: 1024, height: 1024, fit: 'cover' }).png().toBuffer());
        staende[k] = soll; geaendert = true;
        // Mit dem Foto faellt auch seine Messung. Sonst gewinnt gelernteBox() weiter gegen die
        // Flaeche aus dem Repo (makeMockup fragt sie zuerst), und der Druck landet im alten
        // Ausschnitt auf dem neuen Bild.
        const hatte = !!gelernteBox(k);
        if (hatte) { boxVergessen(k); boxenNeu = true; }
        // 7. Okt.: ersetzte Motto-/Begriff-Szene - die damit schon gebauten Getragen-Bilder (Cache) gehoeren zum alten Foto
        if (veraltet && key.includes('-szene-thema-')) {
          const th = '_thema-' + key.slice(key.indexOf('-szene-thema-') + '-szene-thema-'.length) + '-';
          try { const md = path.join(dir, '..', 'mockups'); for (const f of await fs.readdir(md)) if (f.includes(th)) await fs.unlink(path.join(md, f)).catch(() => {}); } catch (e) { /* kein Cache */ }
        }
        console.log('Vorlage aus dem Repo (mitgeliefert' + (veraltet ? ', ersetzt Stand ' + alt : '') + '):', k, 'Stand', soll
          + (hatte ? ' - alte gemessene Flaeche verworfen' : ''));
      } catch (e) { console.error('Mitgelieferte Vorlage fehlt im Repo:', key, e && e.message ? e.message : e); }
    }
  }
  if (geaendert) { try { await fs.writeFile(standDatei, JSON.stringify(staende, null, 1)); } catch (e) { console.error('mitgeliefert.json:', e && e.message ? e.message : e); } }
  // Verworfene Messungen auch auf dem Volume loeschen - sonst sind sie beim naechsten Start wieder da.
  if (boxenNeu) { try { await fs.writeFile(path.join(dir, 'boxen.json'), JSON.stringify(GELERNT, null, 2)); } catch (e) { console.error('boxen.json:', e && e.message ? e.message : e); } }
  // Masken (siehe MASKEN): eine je Schluessel, Stand in masken.json.
  const maskenDatei = path.join(dir, 'masken.json');
  let mstaende = {};
  try { mstaende = JSON.parse(await fs.readFile(maskenDatei, 'utf8')) || {}; } catch (e) { mstaende = {}; }
  let mgeaendert = false;
  for (const key of Object.keys(MASKEN)) {
    const soll = +MASKEN[key].stand || 1;
    const p = path.join(dir, key + '.maske.png');
    let da = true;
    try { await fs.access(p); } catch (e) { da = false; }
    if (da && (+mstaende[key] || 0) >= soll) continue;
    try {
      const mb = await fs.readFile(path.resolve('vorlagen-original', key + '.maske.png'));
      await fs.writeFile(p, await sharp(mb).resize({ width: 1024, height: 1024, fit: 'cover' }).png().toBuffer());
      mstaende[key] = soll; mgeaendert = true;
      console.log('Maske aus dem Repo:', key, 'Stand', soll);
    } catch (e) { console.error('Maske fehlt im Repo:', key, e && e.message ? e.message : e); }
  }
  if (mgeaendert) { try { await fs.writeFile(maskenDatei, JSON.stringify(mstaende, null, 1)); } catch (e) { console.error('masken.json:', e && e.message ? e.message : e); } }
}

// 22. Sept., Markus: "Warum muss ich dich auf solche Fehler immer wieder hinweisen?"
// Weil ein Blick ins Repo nicht sagt, was auf dem Volume liegt. Das Posterfoto war im Repo neu
// und auf dem Volume alt, und gesehen hat das niemand - bis der Chef die Seite aufmachte.
// Diese Auskunft stellt beides nebeneinander: was das Repo will (soll) und was wirklich
// daliegt (ist). Damit kann eine Abnahme von aussen messen statt raten.
export async function vorlagenStand(storeDir) {
  const t = path.join(storeDir, 'templates');
  const lies = async (datei) => { try { return JSON.parse(await fs.readFile(path.join(t, datei), 'utf8')) || {}; } catch (e) { return {}; } };
  const staende = await lies('mitgeliefert.json');
  const mstaende = await lies('masken.json');
  const vorlagen = {}, masken = {};
  for (const key of Object.keys(MITGELIEFERT)) {
    const soll = +MITGELIEFERT[key].stand || 1;
    for (const c of COLORS) {
      if (MITGELIEFERT[key].dateien && !MITGELIEFERT[key].dateien[c]) continue;
      const k = key + '_' + c;
      let da = true;
      try { await fs.access(path.join(t, k + '.png')); } catch (e) { da = false; }
      vorlagen[k] = { soll, ist: +staende[k] || 0, da, gelernt: !!gelernteBox(k) };
    }
  }
  for (const key of Object.keys(MASKEN)) {
    const soll = +MASKEN[key].stand || 1;
    let da = true;
    try { await fs.access(path.join(t, key + '.maske.png')); } catch (e) { da = false; }
    masken[key] = { soll, ist: +mstaende[key] || 0, da };
  }
  const zurueck = [
    ...Object.entries(vorlagen).filter(([, v]) => !v.da || v.ist < v.soll).map(([k, v]) => `Vorlage ${k}: Repo ${v.soll}, Volume ${v.da ? v.ist : 'fehlt'}`),
    ...Object.entries(masken).filter(([, v]) => !v.da || v.ist < v.soll).map(([k, v]) => `Maske ${k}: Repo ${v.soll}, Volume ${v.da ? v.ist : 'fehlt'}`)
  ];
  return { mockupStand: MOCKUP_STAND, vorlagen, masken, zurueck };
}

// ---------- Fassung 88: die Notbremse ----------
// Am 18. September hat der neue Vorlagen-Erzeuger die echten Produktfotos ueberschrieben.
// Der Grund ist banal und deshalb so gefaehrlich: beide Systeme legen ihre Bilder unter
// DEMSELBEN Namen ab. Ein erzeugtes T-Shirt heiszt tee_black.png - genau wie das echte Foto,
// das ensureTemplates einmal geladen hat. Ein Klick auf "erzeugen", und das Foto war weg.
// Auf der Kundenseite standen danach leere Kaesten statt Designs.
// Was aus SOURCES kommt, ist ab jetzt geschuetzt: es darf nur nachgeladen, nie ueberschrieben
// werden. Die SITUATIONEN (…-szene_…) sind davon nicht betroffen - die gibt es dort gar nicht.
export function istOriginalfoto(key) { return Object.prototype.hasOwnProperty.call(SOURCES, key); }

// Ein ueberschriebenes Original wieder holen: Datei weg, dann laedt ensureTemplates sie neu.
// Nur fuer Schluessel aus SOURCES - alles andere waere Datenverlust ohne Rueckweg.
export async function originalZurueckholen(storeDir, key) {
  if (!istOriginalfoto(key)) throw new Error(key + ' ist kein Herstellerfoto - dafuer gibt es keine Quelle zum Nachladen');
  await fs.rm(path.join(storeDir, 'templates', key + '.png'), { force: true });
  // Die selbst gemessene Flaeche muss mit weg: sie gehoert zum erzeugten Bild, nicht zum Foto.
  if (GELERNT[key]) {
    delete GELERNT[key];
    try { await fs.writeFile(path.join(storeDir, 'templates', 'boxen.json'), JSON.stringify(GELERNT, null, 2)); } catch (e) { /* nicht schlimm */ }
  }
  await ensureTemplates(storeDir);
  return templateReady(key.split('_')[0], key.split('_')[1]);
}

// Beim Start selbst aufraeumen. Ein ueberschriebenes Herstellerfoto ist ein Schaden, den
// niemand von Hand beheben koennen soll - schon gar nicht, indem er erst merkt, dass die
// Kundenseite leer ist. Erkennungszeichen: zu einem Schluessel aus SOURCES liegt eine selbst
// gemessene Flaeche vor. Die gibt es nur, wenn dort ein erzeugtes Bild hingeschrieben wurde.
export async function originaleWiederherstellen(storeDir) {
  const kaputt = Object.keys(GELERNT).filter((k) => istOriginalfoto(k));
  if (!kaputt.length) return { geprueft: Object.keys(GELERNT).length, geholt: [] };
  console.warn('Vorlagen: ' + kaputt.length + ' Herstellerfotos waren durch erzeugte Bilder ersetzt - werden zurueckgeholt:', kaputt.join(', '));
  for (const k of kaputt) {
    await fs.rm(path.join(storeDir, 'templates', k + '.png'), { force: true });
    delete GELERNT[k];
  }
  try { await fs.writeFile(path.join(storeDir, 'templates', 'boxen.json'), JSON.stringify(GELERNT, null, 2)); } catch (e) { /* nicht schlimm */ }
  await ensureTemplates(storeDir);
  // Nur die Mockups der BETROFFENEN Artikel wegwerfen. Beim ersten Versuch habe ich den ganzen
  // Ordner geleert - damit waren auch hunderte Bilder weg, die voellig in Ordnung waren, und die
  // Startseite stand minutenlang leer, waehrend alles neu gerechnet wurde. Ein Aufraeumen darf
  // nie mehr kaputtmachen als der Schaden, den es behebt.
  const betroffen = [...new Set(kaputt.map((k) => k.split('_')[0].replace('-szene', '')))];
  const weg = await mockupsVerwerfen(storeDir, betroffen);
  console.log('Vorlagen: Herstellerfotos zurueckgeholt,', weg, 'veraltete Mockups geloescht');
  return { geprueft: kaputt.length, geholt: kaputt, mockupsGeloescht: weg };
}

export async function templateReady(garment, color) {
  if (!dir) return false;
  try { await fs.access(path.join(dir, garment + '_' + color + '.png')); return true; }
  catch (e) { return false; }
}

// ---------- Veraltete Mockups ----------
// Fertige Mockups liegen unter storage/mockups in mehreren Namensformen:
//   <design>_<artikel>_<farbe>[_deckend][_szene]_v<Stand des Artikels>.jpg (Kundendesigns, dazu .avif/.webp)
//     - der Stand im Namen ist mockupStandFuer(artikel), nicht der Gesamtstand (s. u.)
//   stil_<motto>_<stil>.jpg                                 (Vorzeige, T-Shirt sachlich)
//   stil_<motto>_<stil>_<artikel>[-szene].jpg               (Vorzeige, andere Artikel / Situation)
//   firma_v3_…_<artikel>_<farbe>_<platz>.jpg, named_…, back_…, chest_…
// 19. Sept.: an vier Stellen stand "_tee_ oder _tee." - die Situationsbilder (…_tee-szene.jpg)
// und das sachliche Vorzeige-Shirt (stil_abi_standard.jpg) blieben stehen, obwohl ihre
// Vorlage laengst nachgeputzt war. Die Startseite zeigte den alten Kasten weiter.

/** Gehoert diese Mockup-Datei zu einem der Artikel? */
export function mockupGehoertZu(dateiname, artikel) {
  for (const a of artikel) {
    if (dateiname.includes('_' + a + '_') || dateiname.includes('_' + a + '.') || dateiname.includes('_' + a + '-szene')) return true;
  }
  return artikel.includes('tee') && /^stil_[^_]+_[^_]+\.jpg(\.\w+)?$/.test(dateiname);
}

/** Welche Vorlage (Schluessel ohne Farbe, z. B. "tee-szene") steckt hinter dieser Mockup-Datei? */
export function vorlageZuMockup(dateiname) {
  for (const g of Object.keys(GARMENTS)) {
    if (dateiname.includes('_' + g + '-szene')) return g + '-szene';
    if (dateiname.includes('_' + g + '_') || dateiname.includes('_' + g + '.')) return dateiname.includes('_szene') ? g + '-szene' : g;
  }
  if (/^stil_[^_]+_[^_]+\.jpg(\.\w+)?$/.test(dateiname)) return 'tee';
  return null;
}

/** Alle Mockups dieser Artikel wegwerfen (nur die - nie den ganzen Ordner). */
export async function mockupsVerwerfen(storeDir, artikel) {
  const mk = path.join(storeDir, 'mockups');
  let weg = 0;
  for (const f of await fs.readdir(mk).catch(() => [])) {
    if (!mockupGehoertZu(f, artikel)) continue;
    await fs.rm(path.join(mk, f), { force: true }); weg++;
  }
  return weg;
}

// ---------- 20. Sept.: der Stand der Mockup-Rechnung ----------
// Markus: "Die Masse sind wieder mit auf dem Motiv" und "auf dem Strandtuch viel zu klein".
// Beides ist im Code behoben - aber die fertigen Bilder liegen als Cache auf dem Volume, und
// die Kundenseite, die Startseite und die Stil-Galerie liefern den Cache aus. Die Zahl hier
// steigt, sobald makeMockup anders zeichnet; beim Start fliegt dann alles weg, was makeMockup
// je gebaut hat (Kundenbilder, Vorzeige, Kacheln, Firmen-Vorschau). Zwischenstufen der
// Druckdatei (named_, back_, chest_ als PNG) bleiben - die tragen keine Masslinien.
// 20. Sept., 23:38, Markus: "Es dauert ganz schoen lange, bis sich die Flaechen von den Reitern
// fuellen." Der Stand 77 hat ALLE fertigen Mockups weggeworfen, und die Startseite stand danach
// minutenlang leer, bis jedes Bild auf Zuruf neu gerechnet war. Ab jetzt sagt jeder Stand, welche
// Artikel er betrifft - nur deren Mockups fliegen raus, der Rest bleibt liegen.
export const FLACHWARE = ['strandtuch', 'kissen', 'poster', 'sticker', 'fussmatte', 'handtuch', 'mousepad', 'hundedecke', 'acrylbild', 'tuerschild', 'brett', 'napfunterlage', 'gepaeckanhaenger', 'brotdose'];
export const MOCKUP_STAND = 96;
export const MOCKUP_STAENDE = {
  // 85 steht unten (Reihenfolge nach Zahl): Handtuch, Strandtuch, Kissen - neue Vorlagen im
  // Verhaeltnis des Artikels, eigenes Motiv nie mehr beschnitten (21. Sept.).
  77: null,        // Masslinien weg: alle Teile
  78: FLACHWARE,   // Drehung, Hintergrund aus dem Motiv
  79: FLACHWARE,   // deckend wird im beschnittenen Motiv gemessen (die Postkarte blieb ohne Fuellung)
  80: ['tasse'],   // Tasse: Flaeche auf dem Koerper, Motiv zylindrisch
  81: ['tasse'],   // Tasse: Rundumdruck ueber den ganzen Koerper, bis zur Silhouette, Rand-Ellipse
  82: null,        // Tasse: abgemessenes Zylindermodell; Textilien: zu kleines Motiv wird eingepasst (Beutel)
  83: FLACHWARE,   // Flachware: Druck auf Maske mit Schattierung des Fotos (alle Produkt- und Situationsfotos)
  84: ['tee', 'polo', 'hoodie', 'zip'],   // Textilien: Herstellerfotos (B&C, Stanley/Stella) statt KI-Vorlagen
  85: ['handtuch', 'strandtuch', 'kissen'],  // Vorlagen im Verhaeltnis des Artikels, eigenes Motiv ganz zu sehen
  86: ['handtuch', 'strandtuch', 'kissen'],  // dieselben Vorlagen mit echtem Stoff (die flachen Flaechen von 85 lagen schon auf dem Volume)
  87: ['handtuch', 'strandtuch'],            // 22. Sept.: Tuecher liegen locker mit Wellen und Falten, das Motiv folgt ihnen
  88: ['hundedecke', 'napfunterlage', 'fussmatte'],  // 22. Sept.: Decke im Korb mit Falten, Napfunterlage mit Naepfen, Fussmatte quer
  89: ['tasse', 'sticker', 'brett', 'poster'],       // 22. Sept.: Tasse auf dem Fruehstueckstisch, Sticker auf der Trinkflasche, Bambusbrett, Poster ohne Passepartout
  // 22. Sept., Markus: "Das Poster ist wieder auf ein altes Muster zurueckgefallen." Stand 89 war
  // richtig gerechnet - nur ist das neue Posterfoto nie auf dem Volume angekommen (eine einmal
  // gemessene Flaeche hat den Austausch blockiert, siehe ensureTemplates). Die Mockups, die
  // seitdem mit dem ALTEN Foto gebaut wurden, tragen aber schon _v89 und wuerden weiter
  // ausgeliefert. Darum ein neuer Stand fuer genau die vier Teile von 89.
  90: ['tasse', 'sticker', 'brett', 'poster'],
  // 23. Sept., Markus: "Die Poloshirts mit dem Meeting-Aufdruck sind immer noch drin, die haben
  // da nichts verloren. Beim Polo kommt wenn ein kleiner Druck vorne auf die Brust, auf die
  // Herzseite." Ohne diesen Stand waere die neue Rechnung wirkungslos geblieben: die Polo-
  // Mockups liegen als _v84 auf dem Volume und wuerden weiter mit dem grossen Mitteldruck
  // ausgeliefert. Genau dieser Fehler ist beim Poster passiert.
  91: ['polo'],
  // 2. Okt., Markus (EAST26-Kissen mit braunen Streifen): "... dann sollte es zu 100 % passen." Ein
  // fuer das Teil gebautes Motiv fuellt die Flaeche jetzt ganz ('fill', passtZumArtikel) - die
  // alten Flachware-Mockups mit aufgefuellten Seiten liegen als _v88/_v89/_v90/_v86 auf dem Volume.
  92: FLACHWARE,
  // 2. Okt., Markus: "Bei einigen Beuteln war das Motiv nie so richtig." Je Beutelfoto eine eigene,
  // mittige Flaeche (BOX_OVERRIDES beutel_white/beutel_black); die alten Beutel liegen als _v82.
  93: ['beutel'],
  // 4. Okt.: Stand 92 setzte voraus, dass das Mass des Artikels ankommt - fuer jedes Design, dessen gespeicherte Datei
  // den Artikel OBEN traegt (artikel statt input.artikel), kam es nie an (server.js artikelVon). Deren Flachware-Mockups
  // liegen eingepasst statt gefuellt als _v92 auf dem Volume.
  94: FLACHWARE,
  // 7. Okt.: Hoodie vorne - grosser Druck unter den Kordelspitzen, ueber der Tasche (HOODIE_KORDEL)
  95: ['hoodie'],
  96: ['gepaeckanhaenger', 'grillschuerze']   // 8. Okt.: echter Anhaenger mit Oese und Lederschlaufe; neue Grillschuerze
};
/**
 * Der Stand, den ein Artikel im Mockup-Dateinamen traegt: der juengste Stand, der ihn betrifft.
 * 21. Sept., 07:55: Stand 80 (nur Tasse) liess die Startseite trotzdem minutenlang leer - jede
 * Kundendatei hiess "_v<Gesamtstand>", also musste nach dem Deploy JEDES Mockup neu gebaut werden,
 * obwohl nur die Tassen weggeraeumt waren. Jetzt heisst ein Shirt "_v77", solange kein Stand das
 * Shirt betrifft, und bleibt ueber Tassen- und Flachware-Staende hinweg gueltig.
 */
export function mockupStandFuer(garment, stand = MOCKUP_STAND) {
  let s = 0;
  for (const [st, liste] of Object.entries(MOCKUP_STAENDE)) {
    if (+st > stand) continue;
    if (liste === null || (Array.isArray(liste) && liste.includes(garment))) s = Math.max(s, +st);
  }
  return s || stand;
}
export async function mockupStandAngleichen(storeDir, stand = MOCKUP_STAND) {
  const mk = path.join(storeDir, 'mockups');
  const datei = path.join(mk, 'stand.txt');
  let alt = 0;
  try { alt = parseInt(await fs.readFile(datei, 'utf8'), 10) || 0; } catch (e) { /* noch nie vermerkt */ }
  const dateien = await fs.readdir(mk).catch(() => []);
  // 1) Kundendesigns mit Stand im Namen - bei jedem Start, unabhaengig vom vermerkten Stand:
  //    aelter als der Stand ihres Artikels -> veraltet, weg. Neuer (bis 21. Sept. trug jede Datei
  //    den Gesamtstand) -> umbenennen, das Bild ist gueltig und muss nicht neu gerechnet werden.
  //    Liegen beide Fassungen da, bleibt die juengere.
  let geloescht = 0, umbenannt = 0;
  const versioniert = [];
  for (const f of dateien) {
    const m = /^(.*_)v(\d+)(\.jpg(?:\.avif|\.webp)?)$/.exec(f);
    if (!m) continue;
    const g = Object.keys(GARMENTS).find(k => f.includes('_' + k + '_'));
    if (!g) continue;
    versioniert.push({ f, kopf: m[1], ist: +m[2], ende: m[3], soll: mockupStandFuer(g, stand) });
  }
  versioniert.sort((a, b) => b.ist - a.ist);
  const vergeben = new Set(dateien);
  for (const v of versioniert) {
    if (v.ist === v.soll) continue;
    const ziel = v.kopf + 'v' + v.soll + v.ende;
    if (v.ist < v.soll || vergeben.has(ziel)) { await fs.rm(path.join(mk, v.f), { force: true }); vergeben.delete(v.f); geloescht++; continue; }
    await fs.rename(path.join(mk, v.f), path.join(mk, ziel)); vergeben.delete(v.f); vergeben.add(ziel); umbenannt++;
  }
  if (alt >= stand) return { alt, neu: stand, geloescht, umbenannt };
  // 2) Vorzeige- und Kachel-Mockups ohne Stand im Namen: beim Sprung des Standes weg, wenn ihr
  //    Artikel betroffen ist. Welche Artikel sind zwischen alt und neu betroffen? Ein Stand ohne
  //    Liste betrifft alle.
  let alle = false; const artikel = new Set();
  for (let st = alt + 1; st <= stand; st++) {
    const b = MOCKUP_STAENDE[st];
    if (b === null) alle = true; else if (Array.isArray(b)) b.forEach(a => artikel.add(a));
    else if (b === undefined && st === stand) alle = true;   // unbekannter Stand: lieber alles
  }
  for (const f of dateien) {
    if (!vergeben.has(f) || !/\.(jpg|avif|webp)$/i.test(f)) continue;
    if (!/^(stil_|sample_|firmadesign_|named_|back_|chest_)/.test(f) || /_v\d+\.jpg/.test(f)) continue;
    if (!alle && !mockupGehoertZu(f, [...artikel])) continue;
    await fs.rm(path.join(mk, f), { force: true }); geloescht++;
  }
  await fs.mkdir(mk, { recursive: true });
  await fs.writeFile(datei, String(stand));
  return { alt, neu: stand, geloescht, umbenannt, alle, artikel: [...artikel] };
}

/**
 * Beim Start: jedes Mockup, das AELTER ist als die Vorlage, aus der es gebaut wurde, ist
 * veraltet - egal, warum die Vorlage neuer ist (nachgeputzt, neu erzeugt, zurueckgeholt).
 * Ist die Farbe aus dem Namen nicht ablesbar (stil_…), zaehlt die neuere der beiden Vorlagen.
 */
export async function veralteteMockupsRaeumen(storeDir) {
  const tpl = path.join(storeDir, 'templates'), mk = path.join(storeDir, 'mockups');
  const stand = new Map();
  const vorlageStand = async (key) => {
    if (stand.has(key)) return stand.get(key);
    let t = 0;
    try { t = (await fs.stat(path.join(tpl, key + '.png'))).mtimeMs; } catch (e) { /* keine Vorlage */ }
    stand.set(key, t);
    return t;
  };
  const geloescht = [];
  let geprueft = 0;
  for (const f of await fs.readdir(mk).catch(() => [])) {
    const key = vorlageZuMockup(f);
    if (!key) continue;
    geprueft++;
    const farben = f.includes('_white') ? ['white'] : f.includes('_black') ? ['black'] : ['white', 'black'];
    let neueste = 0;
    for (const c of farben) neueste = Math.max(neueste, await vorlageStand(key + '_' + c));
    if (!neueste) continue;
    let eigen = 0;
    try { eigen = (await fs.stat(path.join(mk, f))).mtimeMs; } catch (e) { continue; }
    if (eigen >= neueste) continue;
    await fs.rm(path.join(mk, f), { force: true });
    geloescht.push(f);
  }
  return { geprueft, geloescht };
}

// ---------- Fassung 85: selbst erzeugte Vorlagen ----------
// Bis hierher kam jede Vorlage von einer festen Adresse in SOURCES, und ihre Druckflaeche stand
// von Hand abgemessen im Code. Fuer die fehlenden siebenundzwanzig Vorlagen geht das nicht mehr
// auf: von Hand abgemessene Zahlen veralten still, sobald ein Bild ersetzt wird.
// Selbst erzeugte Vorlagen bringen ihre Flaeche deshalb SELBST mit. Das Bild liegt neben den
// anderen im templates-Ordner, die gemessene Flaeche in einer Datei daneben. Damit gilt ueberall
// dieselbe Regel: EIN Bild, EINE Flaeche, und beide entstehen im selben Augenblick.
// Die Datei liegt auf dem Volume und nicht im Code - sonst braeuchte jede neue Vorlage einen
// Deploy, und der Knopf im Backend waere sinnlos.
let GELERNT = {};
export async function ladeGelernteBoxen(storeDir) {
  try {
    const d = JSON.parse(await fs.readFile(path.join(storeDir, 'templates', 'boxen.json'), 'utf8'));
    GELERNT = {};
    // Nur brauchbare Eintraege uebernehmen. Eine Flaeche ohne Masz waere schlimmer als keine:
    // makeMockup legte das Motiv auf null Pixel und lieferte ein leeres Teil aus.
    for (const [k, b] of Object.entries(d)) {
      if (b && b.w > 0 && b.h > 0 && b.x >= 0 && b.y >= 0) GELERNT[k] = { x: b.x, y: b.y, w: b.w, h: b.h };
    }
    const n = Object.keys(GELERNT).length;
    if (n) console.log('Vorlagen:', n, 'selbst gemessene Druckflaechen geladen');
  } catch (e) { GELERNT = {}; }
  return GELERNT;
}
export function gelernteBox(key) { return GELERNT[key] || null; }
// Eine Messung gehoert zu EINEM Foto. Wird das Foto aus dem Repo ersetzt (hoeherer Stand),
// muss die alte Messung weg - sie zeigt sonst auf einen Ausschnitt, den es nicht mehr gibt.
export function boxVergessen(key) { delete GELERNT[key]; }
export function alleGelerntenBoxen() { return { ...GELERNT }; }

// ---------- Fassung 86: gibt es zu diesem Teil eine SITUATION? ----------
// Markus, 18. Sept.: "Wir muessen lebendig werden. Wenn wir ein Poster zeigen, muss es an der
// Wand in einem Wohnzimmer haengen. Und wenn der Kunde ein Poster erstellt hat, muss sein Motiv
// genauso dort haengen - bei allen anderen Artikeln auch."
// Die Mechanik dafuer gibt es seit Fassung 73 (GARMENTS[x].szene, makeMockup mit
// ansicht: 'szene'). Benutzt hat sie bis heute NIEMAND: die Strandszene des Handtuchs lag
// wochenlang als Vorlage da und ist nie auf der Seite gelandet.
// Damit das nicht wieder passiert, entscheidet ab jetzt EINE Funktion, ob eine Situation
// gezeigt werden kann - und alle Stellen fragen sie. Ist die Vorlage da, wird sie gezeigt;
// fehlt sie, kommt die sachliche Ansicht. Die Seite wird also von selbst lebendiger, sobald
// eine Vorlage erzeugt ist - ohne dass irgendwo ein Schalter umgelegt werden muss.
export async function szeneMoeglich(garment, color, quer = false) {
  if (!GARMENTS[garment]) return false;
  // Querformat-Motiv: die Situation der Querformat-Vorlage, wenn es die gibt (sonst wie bisher).
  if (quer && (await querVorlageDa(garment, color)) && mitgelieferteBox(garment + '-quer-szene_' + color) && (await templateReady(garment + '-quer-szene', color))) return true;
  const key = garment + '-szene_' + color;
  // Beides muss da sein: das Bild UND eine Druckflaeche dazu. Ein Wohnzimmer ohne bekannte
  // Flaeche waere schlimmer als gar keins - das Motiv laege irgendwo.
  if (!(BOX_OVERRIDES[key] || gelernteBox(key) || mitgelieferteBox(key) || (GARMENTS[garment].szene && GARMENTS[garment].szene.box))) return false;
  return templateReady(garment + '-szene', color);
}
// 27. Sept.: Situation mit passender Person - <teil>-szene-frau_<farbe> bzw. -mann. Sie wird im
// Backend erzeugt und dabei vermessen (gelernteBox); ohne Bild UND Flaeche gibt es sie nicht.
export const SZENE_PERSONEN = ['frau', 'mann'];
// 2. Okt.: welche Mottos eine eigene Szene haben - aus MITGELIEFERT abgelesen, nicht von Hand gepflegt.
export const SZENE_THEMEN = Object.fromEntries(Object.entries(MITGELIEFERT)
  .filter(([k, v]) => k.startsWith('tee-szene-thema-') && !k.startsWith('tee-szene-thema-b-') && !v.variante)   // b- = Szene nach Begriff, kein Motto
  .map(([k, v]) => [k.slice('tee-szene-thema-'.length), { wer: v.wer || '', nameFeld: v.nameFeld || '', nachName: v.nachName || null }]));
// Die Szene des Mottos, wenn sie fuer dieses Teil und diese Farbe daliegt und zur Person passt
// (wer = Vorname auf dem Design; leer = egal). Sonst ''.
export async function szeneThemaFuer(garment, color, motto, wer = '') {
  const da = async (slug) => {
    const key = garment + '-szene-thema-' + slug;
    if (!(BOX_OVERRIDES[key + '_' + color] || gelernteBox(key + '_' + color) || mitgelieferteBox(key + '_' + color))) return false;
    return templateReady(key, color);
  };
  const t = SZENE_THEMEN[String(motto || '')];
  // Schon gewaehlte Variante (die Mockup-Route reicht "geburt-baby-rosa" an makeMockup weiter).
  // 7. Okt.: Szene nach Begriff (szene-begriff.js, "b-<begriff>-<wer>") - im Speicher erzeugt, Flaeche gemessen (gelernteBox).
  if (!t && /^b-[a-z0-9-]+$/.test(String(motto || ''))) return (await da(String(motto))) ? String(motto) : '';
  if (!t) { const v = MITGELIEFERT[garment + '-szene-thema-' + motto]; return v && v.variante && await da(String(motto)) ? String(motto) : ''; }
  // nachName (Babyshirt): der Name gehoert dem Kind - er waehlt das Zimmer, er sperrt die Szene nie.
  if (t.nachName) {
    const ziel = wer && t.nachName[wer];
    if (ziel && await da(ziel)) return ziel;
  } else if (wer && t.wer && wer !== t.wer) return '';
  return (await da(String(motto))) ? String(motto) : '';
}
// Ansichten im Schaufenster (?druck=, nur in einer Motto-Szene) - GENAU die Masse, die der Kunde im
// Schritt "Wie gross soll das Design werden?" waehlen kann (GROESSEN in motto-seite.js). Markus, 2. Okt.:
// "Wir haben doch festgelegt, wir haben doch eigene Masse und die soll doch nutzen." [Breite, Hoehe, Platz]
// in cm auf der Druckflaeche; herz = Herzseite, mitte = mittig oben, ruecken = die Szene von hinten.
// Leer = das echte Mass der Druckdatei. Die Magenta-Flaeche IST die Druckflaeche (unter den Achseln
// gemessen 63 % des Rumpfes, wie tee-szene-mann/-frau mit 61 und 71 %).
export const DRUCK_MASSE = {
  'brust-klein': { cm: [8, 8], platz: 'herz', label: 'Brust klein 8 × 8 cm' },
  brust: { cm: [10, 10], platz: 'herz', label: 'Brust 10 × 10 cm' },
  streifen: { cm: [25, 10], platz: 'mitte', label: 'Streifen 25 × 10 cm' },
  'brust-gross': { cm: [28, 20], platz: 'mitte', label: 'Brust groß 28 × 20 cm' },
  ruecken: { cm: [30, 35], platz: 'ruecken', label: 'Rücken 30 × 35 cm' },
  // 2. Okt., Markus zur Abi-Rueckseite mit Namen: "das kann gerne ueber die maximale Groesse gehen ...
  // unterhalb der Kapuze bis oberhalb des Buendchens" - das Hoechstmass 38 x 48 cm.
  'ruecken-max': { cm: [38, 48], platz: 'ruecken', label: 'Rücken 38 × 48 cm' }
};
export const DRUCK_ARTEN = Object.keys(DRUCK_MASSE);
// 2. Okt., Markus zum Abi-Ruecken: "Auf dem Bild ... nicht in Hoechstmass" - und das sah man: der Druck
// deckte 40 % der Shirtbreite. Die Magenta-Flaeche wurde als 36 cm gerechnet, ist aber in jeder Szene
// verschieden gross gezeichnet. GEMESSEN je Szene: die Shirtbreite in Pixeln aus dem Unterschied der
// weissen und der schwarzen Fassung desselben Fotos (dort, wo sie sich unterscheiden, IST das Shirt),
// Median aus vier Zeilen auf 40-70 % der Flaechenhoehe. Ein T-Shirt in M ist flach 53 cm breit
// (B&C E190). Daraus der Massstab: px je cm = Shirtbreite / 53. Gemessen ergab das bei den
// Vorderseiten 27-33 cm fuer die Magenta-Flaeche, beim Abi-Ruecken 23 cm, beim Vereinsruecken 21 cm.
// Hoodies: dort zaehlt die Messung die anliegenden Aermel mit - die Flaeche gilt als 30,7 cm, der
// Median der T-Shirt-Vorderseiten (dieselbe Bestellung "a third of the garment width").
export const SHIRT_CM = 53;
// 2. Okt., zweite Messung (Markus: "das geht ueber die Breite des Rueckens, das ist ja schon auf dem Aermel"):
// die erste Messung lag bei den Ruecken auf Hoehe der Aermel (Abi 428, Verein 458 px) - der Druck war 35 % zu
// breit. Jetzt der RUMPF: Zeilen von der Mitte der Flaeche bis zu ihrem Ende, 25. Perzentil (Aermel machen
// breiter). Hoodies fehlen absichtlich: die Aermel liegen am Koerper an, die Maske zaehlt die Arme mit.
export const SZENE_SHIRT_PX = {"tee-szene-thema-abi": 308, "tee-szene-thema-abschlussfahrt": 288, "tee-szene-thema-angler-shirt": 342, "tee-szene-thema-bowling": 298, "tee-szene-thema-darts": 328, "tee-szene-thema-familie": 347, "tee-szene-thema-fan-shirt": 326, "tee-szene-thema-fanclub": 308, "tee-szene-thema-firmenausflug": 309, "tee-szene-thema-geburt-baby": 291, "tee-szene-thema-geburt-baby-rosa": 291, "tee-szene-thema-geburtstag": 306, "tee-szene-thema-handwerker-shirt": 324, "tee-szene-thema-abi-ruecken": 315, "tee-szene-thema-junggesellenabschied-ruecken": 317, "tee-szene-thema-malle-fahrt-ruecken": 283, "tee-szene-thema-vereinsjubilaeum-ruecken": 325, "tee-szene-thema-hochzeit": 315, "tee-szene-thema-jaeger-shirt": 311, "tee-szene-thema-junggesellenabschied": 329, "tee-szene-thema-karneval": 343, "tee-szene-thema-kegeltour": 345, "tee-szene-thema-kinder-tiershirt": 287, "tee-szene-thema-landwirt-shirt": 352, "tee-szene-thema-malle-fahrt": 318, "tee-szene-thema-meister-shirt": 319, "tee-szene-thema-motorrad-shirt": 318, "tee-szene-thema-schulmotto": 328, "tee-szene-thema-sprueche-shirt": 298, "tee-szene-thema-tier-shirt": 276, "tee-szene-thema-vereinsjubilaeum": 351, "tee-szene-thema-weihnachtsfeier": 294};
// Ruecken: der Traeger dreht sich ueber die Schulter, die Flaeche des Bilddienstes lag 36-51 px neben der
// Rumpfmitte - der Druck rutschte auf den Aermel. Dort zaehlt die gemessene Rumpfmitte (x bei 1024 px).
// 2. Okt., Markus nach der Rumpf-Messung: "noch ein bisschen groesser und vor allen Dingen mittig". Gemessen:
// in allen vier Ruecken-Fotos ist das Shirt optisch doppelt so lang wie breit (Kragen bis Saum 583-660 px bei
// 283-325 px Rumpf), ein echtes T-Shirt in M ist 53 x 72 cm (1,4 : 1) - der Ruecken, leicht von der Seite
// gesehen, wirkt schmaler. Der Breiten-Massstab allein machte den Druck also zu klein. Fuer die Ruecken:
// Massstab aus der Laenge (Kragen bis Saum = 72 cm), hoechstens 85 % der sichtbaren Rumpfbreite fuer 38 cm,
// und die Mitte des Drucks auf 45 % der Laenge unter dem Kragen (Mitte des Rueckens, Schulterblaetter).
export const SHIRT_LAENGE_CM = 72;
// halbe: halber Abstand der Seitenkanten des Rueckenteils (Armlochnaehte), am Bild abgelesen - daraus die
// Woelbung (RUECKEN_WOELBUNG): der Ruecken ist ein Zylinder, dessen Rand dort unter 75 Grad weggeht.
export const SZENE_RUECKEN = { 'tee-szene-thema-abi-ruecken': { kragen: 267, laenge: 646, halbe: 155 }, 'tee-szene-thema-junggesellenabschied-ruecken': { kragen: 235, laenge: 646, halbe: 152 }, 'tee-szene-thema-malle-fahrt-ruecken': { kragen: 317, laenge: 583, halbe: 155 }, 'tee-szene-thema-vereinsjubilaeum-ruecken': { kragen: 248, laenge: 660, halbe: 145 } };
// 2. Okt., Markus: "Du musst die Kruemmung vom T-Shirt mit rechnen." Der Ruecken als Zylinder: Radius r aus
// halbe (Rand unter randGrad), die Rueckenbreite 53 cm liegt als Bogen zwischen den Raendern; die Kamera steht
// abstand px vor dem Ruecken auf Hoehe horizont (Anteil der Laenge unter dem Kragen). Zu den Seiten hin wird der
// Druck gestaucht, und weil die Seiten weiter weg sind, ruecken ihre Zeilen zur Augenhoehe hin.
export const RUECKEN_WOELBUNG = { randGrad: 75, abstand: 1200, horizont: 0.3 };
export function rueckenRadius(halbe) { return halbe / Math.sin(RUECKEN_WOELBUNG.randGrad * Math.PI / 180); }
// Rohes RGBA (W0 x H0, Zeile 0 bei y = top) auf den Zylinder legen. ax(y) = Rueckenachse, hor = Augenhoehe (y).
// Rueckwaerts gerechnet: je Bildpunkt die Stelle auf dem Druck, bilinear mit vormultipliziertem Alpha.
export function rueckenWoelben(data, W0, H0, { top, ax, r, hor, abstand = RUECKEN_WOELBUNG.abstand }) {
  const phiMax = Math.min(W0 / 2 / r, Math.PI / 2 - 0.01);
  const halbBreit = Math.ceil(r * Math.sin(phiMax)) + 2;
  let axMin = Infinity, axMax = -Infinity;
  for (let y = top - 4; y <= top + H0 + 4; y++) { const a = ax(y); axMin = Math.min(axMin, a); axMax = Math.max(axMax, a); }
  const left = Math.floor(axMin - halbBreit), right = Math.ceil(axMax + halbBreit);
  const oben = top - 2, unten = top + H0 + 2;
  const W1 = right - left + 1, H1 = unten - oben + 1, out = Buffer.alloc(W1 * H1 * 4, 0);
  const px = (u, v, k) => data[(v * W0 + u) * 4 + k];
  for (let j = 0; j < H1; j++) {
    const Y = oben + j;
    for (let i = 0; i < W1; i++) {
      const X = left + i;
      let s = 1, yw = Y, phi = 0, ok = true;
      for (let it = 0; it < 4; it++) {
        yw = hor + (Y - hor) / s;
        const x = (X - ax(yw)) / s;
        if (Math.abs(x) >= r * Math.sin(phiMax) + 1) { ok = false; break; }
        phi = Math.asin(Math.max(-1, Math.min(1, x / r)));
        s = abstand / (abstand + r * (1 - Math.cos(phi)));
      }
      if (!ok) continue;
      const u = r * phi + W0 / 2 - 0.5, v = yw - top - 0.5;
      if (u < -0.5 || v < -0.5 || u > W0 - 0.5 || v > H0 - 0.5) continue;
      const u0 = Math.max(0, Math.min(W0 - 1, Math.floor(u))), v0 = Math.max(0, Math.min(H0 - 1, Math.floor(v)));
      const u1 = Math.min(W0 - 1, u0 + 1), v1 = Math.min(H0 - 1, v0 + 1);
      const fu = Math.max(0, Math.min(1, u - u0)), fv = Math.max(0, Math.min(1, v - v0));
      const w = [(1 - fu) * (1 - fv), fu * (1 - fv), (1 - fu) * fv, fu * fv], q = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
      let a = 0, rr = 0, gg = 0, bb = 0;
      for (let n = 0; n < 4; n++) { const al = px(q[n][0], q[n][1], 3) * w[n]; a += al; rr += px(q[n][0], q[n][1], 0) * al; gg += px(q[n][0], q[n][1], 1) * al; bb += px(q[n][0], q[n][1], 2) * al; }
      if (a < 0.5) continue;
      const o = (j * W1 + i) * 4;
      out[o] = Math.round(rr / a); out[o + 1] = Math.round(gg / a); out[o + 2] = Math.round(bb / a); out[o + 3] = Math.round(a);
    }
  }
  return { data: out, width: W1, height: H1, left, top: oben };
}
// 2. Okt., Markus: "nicht mittig auf dem Ruecken und nicht so platziert, dass es zum T-Shirt passt", "die Mitte
// musst du doch von der Rueckseite nehmen" und "die gruene Linie sitzt nicht auf der Mitte des Rueckens".
// Massgebend ist das RUECKENTEIL des Shirts: oben die Mitte zwischen den beiden Armlochnaehten, unten die Mitte
// des Saums - AM BILD MIT RASTER ABGELESEN, [y, x] bei 1024 px. Was daneben lag: der Kragen (sitzt bei gedrehtem
// Kopf nicht mittig), der Rumpf aus der Maske (den verdeckt der haengende Arm) und der aeussere Umriss mit den
// Aermeln (der vordere Aermel steht weiter ab - Abi 526 statt 555, Verein 458 statt 488).
export const SZENE_RUECKEN_ACHSE = {"tee-szene-thema-abi-ruecken": [[267, 555], [502, 555], [892, 520]], "tee-szene-thema-junggesellenabschied-ruecken": [[235, 542], [470, 542], [860, 515]], "tee-szene-thema-malle-fahrt-ruecken": [[317, 530], [487, 530], [877, 495]], "tee-szene-thema-vereinsjubilaeum-ruecken": [[248, 488], [518, 488], [883, 442]]};
// 2. Okt., Markus zum gewoelbten Druck auf dieser Achse: "jetzt noch 2 cm nach rechts circa und dann bist du in der
// Mitte". Auf dem Stoff gemessen (Massstab des Rueckens), fuer alle vier Ruecken gleich.
export const RUECKEN_VERSATZ_CM = 2;
export const SZENE_RUMPF_MITTE = {"tee-szene-thema-abi-ruecken": 539, "tee-szene-thema-junggesellenabschied-ruecken": 535, "tee-szene-thema-malle-fahrt-ruecken": 509, "tee-szene-thema-vereinsjubilaeum-ruecken": 466};
export function szeneMassstab(key, box) {
  const shirt = SZENE_SHIRT_PX[String(key || '').replace(/_(white|black)$/, '')];
  return shirt ? shirt / SHIRT_CM : box.w / 30.7;
}

// Dateiname der Themen-Ansicht; "-stoff" seit der Schattierung (stoffSchatten).
export function themaEndung(thema, druck = '') {
  return thema ? '_thema-' + thema + (druck ? '-' + druck : '') + (/-ruecken$/.test(thema) ? '-woelb' : '-mass') : '';
}
// 2. Okt., Markus: "Die Motive ... sind nicht ins Textil eingearbeitet, sondern einfach nur drauf
// geknallt." Das Motiv bekommt die Falten und das Licht des Fotos darunter: Helligkeit der Vorlage
// (leicht weichgezeichnet) gegen ihren Mittelwert im Druckbereich. Auf weissem Stoff mit 'multiply'
// liegt der Stoff schon teilweise durch, dort schwaecher.
export async function stoffSchatten(artPng, template, left, top, staerke = 2.2) {
  const a = await sharp(artPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = a.info.width, h = a.info.height, px = a.data;
  // Fast durchsichtiges Rauschen des Bildmodells (Alpha unter 16) gilt als leer - auf dem Stoff
  // summierte es sich zu einer grauen Punktflaeche hinter den Namen (2. Okt., Abi-Ruecken).
  for (let i = 3; i < px.length; i += 4) if (px[i] < 16) { px[i] = 0; px[i - 1] = px[i - 2] = px[i - 3] = 255; }
  const tm = await sharp(template).metadata();
  const l = Math.max(0, left), t = Math.max(0, top);
  const cw = Math.min(w - (l - left), tm.width - l), ch = Math.min(h - (t - top), tm.height - t);
  const sauber = () => sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  if (cw < 4 || ch < 4) return sauber();
  const roh = sharp(template).extract({ left: l, top: t, width: cw, height: ch }).greyscale();
  const lum = await roh.clone().blur(1.5).raw().toBuffer();
  // 2. Okt., Markus: "nicht in den Stoff eingearbeitet". Nur heller/dunkler machen reicht nicht - ein Druck
  // im Stoff folgt den Falten (er verschiebt sich mit ihnen), traegt die Webstruktur und hat keine
  // messerscharfe Kante. Darum zusaetzlich: Verschiebung entlang der groben Faltenneigung, die feine
  // Struktur der Vorlage obendrauf, und eine leicht weiche Kante.
  const fein = await roh.clone().raw().toBuffer();
  const grob = await roh.clone().blur(8).raw().toBuffer();
  const quelle = Buffer.from(px);
  const wert = (xx, yy, k) => { xx = Math.max(0, Math.min(w - 1, xx)); yy = Math.max(0, Math.min(h - 1, yy)); return quelle[(yy * w + xx) * 4 + k]; };
  const verschiebung = Math.max(2, Math.round(w / 260));
  for (let y = 1; y < ch - 1; y++) for (let x = 1; x < cw - 1; x++) {
    const gx = (grob[y * cw + x + 1] - grob[y * cw + x - 1]) / 2, gy = (grob[(y + 1) * cw + x] - grob[(y - 1) * cw + x]) / 2;
    const ax = (x + l - left) - Math.max(-1, Math.min(1, gx / 4)) * verschiebung, ay = (y + t - top) - Math.max(-1, Math.min(1, gy / 4)) * verschiebung;
    const x0 = Math.floor(ax), y0 = Math.floor(ay), fx = ax - x0, fy = ay - y0, o = ((y + t - top) * w + (x + l - left)) * 4;
    for (let k = 0; k < 4; k++) px[o + k] = Math.round(wert(x0, y0, k) * (1 - fx) * (1 - fy) + wert(x0 + 1, y0, k) * fx * (1 - fy) + wert(x0, y0 + 1, k) * (1 - fx) * fy + wert(x0 + 1, y0 + 1, k) * fx * fy);
  }
  let s = 0, n = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { if (px[((y + t - top) * w + (x + l - left)) * 4 + 3] > 128) { s += lum[y * cw + x]; n++; } }
  if (!n) return sauber();
  const mittel = s / n;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const o = ((y + t - top) * w + (x + l - left)) * 4;
    if (!px[o + 3]) continue;
    const sh = Math.min(1.2, Math.max(0.6, 1 + staerke * (lum[y * cw + x] - mittel) / 255)) * (1 + 1.6 * (fein[y * cw + x] - lum[y * cw + x]) / 255);
    px[o] = Math.min(255, Math.round(px[o] * sh)); px[o + 1] = Math.min(255, Math.round(px[o + 1] * sh)); px[o + 2] = Math.min(255, Math.round(px[o + 2] * sh));
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } }).blur(0.35).png().toBuffer();
}
// Wo in einer Szene Stoff ist: die weisse und die schwarze Fassung sind dasselbe Foto (Bearbeitung), sie
// unterscheiden sich also nur auf dem Textil. Summe der RGB-Unterschiede ueber 240 = Stoff (dieselbe
// Schwelle wie bei der Vermessung der Shirtbreite). Liefert eine Alpha-Maske in der Groesse des Motivs,
// oder null, wenn eine Fassung fehlt oder die Maske fast leer ist (dann lieber ohne Maske als ohne Druck).
const STOFF_MASKEN = new Map();
export async function stoffMaske(dir, form, left, top, artPng) {
  let m = STOFF_MASKEN.get(form);
  if (m === undefined) {
    m = null;
    try {
      const [w, b] = await Promise.all(['white', 'black'].map(f => sharp(path.join(dir, form + '_' + f + '.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
      if (w.info.width === b.info.width && w.info.height === b.info.height) {
        const n = w.info.width * w.info.height, a = Buffer.alloc(n);
        for (let i = 0; i < n; i++) { const o = i * 3; a[i] = (w.data[o] + w.data[o + 1] + w.data[o + 2]) - (b.data[o] + b.data[o + 1] + b.data[o + 2]) > 240 ? 255 : 0; }
        m = { data: await sharp(a, { raw: { width: w.info.width, height: w.info.height, channels: 1 } }).median(5).blur(0.8).toColourspace('b-w').raw().toBuffer(), width: w.info.width, height: w.info.height };
      }
    } catch (e) { console.log('stoffMaske ' + form + ': keine zweite Fassung (' + (e && e.message ? e.message : e) + ') - ohne Maske'); }
    STOFF_MASKEN.set(form, m);
  }
  if (!m) return null;
  const am = await sharp(artPng).metadata();
  // RGBA mit dem Wert als Alpha - eine Graustufen-PNG haette kein Alpha, und dest-in nimmt das Alpha.
  const out = Buffer.alloc(am.width * am.height * 4, 255);
  let stoff = 0;
  for (let y = 0; y < am.height; y++) for (let x = 0; x < am.width; x++) {
    const tx = x + left, ty = y + top;
    const v = tx >= 0 && ty >= 0 && tx < m.width && ty < m.height ? m.data[ty * m.width + tx] : 0;
    out[(y * am.width + x) * 4 + 3] = v; if (v) stoff++;
  }
  if (stoff < am.width * am.height * 0.2) { console.log('stoffMaske ' + form + ': nur ' + Math.round(stoff / (am.width * am.height) * 100) + ' % Stoff unter dem Motiv - ohne Maske'); return null; }
  return sharp(out, { raw: { width: am.width, height: am.height, channels: 4 } }).png().toBuffer();
}
// Hoodie-Herstellerfotos: wo die Kordeln enden und wo die Kaenguru-Tasche beginnt (y in px, 1024er-Vorlage; 7. Okt. gemessen).
const HOODIE_KORDEL = {
  'bc-hoodie': { kordelEnde: 384, taschenOben: 704 },
  'ss-hoodie': { kordelEnde: 481, taschenOben: 686 },
  'roly-hoodie': { kordelEnde: 276, taschenOben: 704 }
};
export async function szeneVarianteDa(garment, color, wer) {
  if (!GARMENTS[garment] || !SZENE_PERSONEN.includes(wer)) return false;
  const key = garment + '-szene-' + wer + '_' + color;
  if (!(BOX_OVERRIDES[key] || gelernteBox(key) || mitgelieferteBox(key))) return false;
  return templateReady(garment + '-szene-' + wer, color);
}
export async function merkeBox(storeDir, key, box) {
  if (!box || !(box.w > 0) || !(box.h > 0)) throw new Error('unbrauchbare Flaeche fuer ' + key);
  GELERNT[key] = { x: box.x, y: box.y, w: box.w, h: box.h };
  const datei = path.join(storeDir, 'templates', 'boxen.json');
  await fs.mkdir(path.dirname(datei), { recursive: true });
  await fs.writeFile(datei, JSON.stringify(GELERNT, null, 2));
  return GELERNT[key];
}

// Druckdatei auf das Textil legen. Auf hellem Stoff multiplizieren (Stoffstruktur bleibt sichtbar),
// auf dunklem Stoff deckend wie ein DTF-Transfer.
// opts.place (Fassung 9): 'front' = Druckflaeche wie bisher; 'back' = Kaderliste auf dem Ruecken (gleiche Flaeche, oben
// buendig - die Vorlagen zeigen Vorder- bzw. Rueckseite, fuer Ruecken-Mockups von T-Shirt/Hoodie dient die Vorderseite
// als Platzhalter, bis eigene Rueckseiten-Vorlagen in SOURCES liegen); 'chest' = kleiner Brust-Print links auf der Brust.
// opts.print ('hell'|'dunkel'): fuer welches Textil das Design gezeichnet wurde. Ein Design fuer dunkles Textil hat
// helle Schrift - die wuerde beim Multiplizieren auf weissem Stoff verschwinden, deshalb liegt sie deckend auf.
/**
 * Durchsichtigen Rand wegschneiden - der Rahmen wird an einer kleinen Fassung gemessen und dann
 * aus der grossen Datei ausgeschnitten (sharp.trim auf 2000 px kostete eine Sekunde je Aufruf).
 */
export async function beschneiden(png, meta = null) {
  const mm = meta || await sharp(png).metadata();
  const klein = 800, k = Math.min(1, klein / Math.max(mm.width, mm.height));
  if (k >= 1) return sharp(png).trim({ threshold: 2 }).png().toBuffer();
  // Zwei Schritte: sharp fuehrt trim VOR resize aus, in einer Kette kaemen die Offsets in
  // grossen Koordinaten zurueck. 800 px Messfassung: der Rahmen stimmt auf zwei Pixel genau.
  const kleinPng = await sharp(png).resize({ width: Math.round(mm.width * k), height: Math.round(mm.height * k), fit: 'fill' }).png().toBuffer();
  const t = await sharp(kleinPng).trim({ threshold: 2 }).toBuffer({ resolveWithObject: true });
  const x0 = Math.max(0, Math.floor(-(t.info.trimOffsetLeft || 0) / k)), y0 = Math.max(0, Math.floor(-(t.info.trimOffsetTop || 0) / k));
  const w = Math.min(mm.width - x0, Math.ceil(t.info.width / k)), h = Math.min(mm.height - y0, Math.ceil(t.info.height / k));
  if (!(w > 0) || !(h > 0)) return png;
  let s = sharp(png).extract({ left: x0, top: y0, width: w, height: h }).png();
  if (mm.density) s = s.withMetadata({ density: mm.density });
  return s.toBuffer();
}
/** Druckdatei fuer die Mockup-Rechnung verkleinern (lange Seite hoechstens maxKante), dpi mitskalieren. */
export async function mockupQuelle(png, maxKante = 1600) {
  const m = await sharp(png).metadata();
  const lang = Math.max(m.width || 0, m.height || 0);
  if (!(lang > maxKante)) return png;
  const k = maxKante / lang;
  const dpi = m.density && m.density > 20 ? m.density * k : undefined;
  let s = sharp(png).resize({ width: Math.round(m.width * k), height: Math.round(m.height * k), fit: 'fill', kernel: 'lanczos3' }).png();
  if (dpi) s = s.withMetadata({ density: dpi });
  return s.toBuffer();
}
// 4. Okt., Markus: "den Anteil an schwarzen Textilien auf nur noch 20 % begrenzen ... gerne mal was schoen gelbes, zart
// gruenes, zart blau, so dass es zum Design hervorragend passt, und natuerlich auch rot" - "Farben nehmen wir das, was alles
// zur Verfuegung steht und das gut aussieht". Die Farben unten fuehrt B&C fuer genau diese Teile (textilien.js: BC_E190_FARBEN
// fuer das T-Shirt, BC_POLO_FARBEN fuer das Polo); der Name steht dran, wie der Hersteller ihn nennt. Die Farbwerte sind
// ANGENAEHERT - der Hersteller nennt keine (siehe textilien.js); fuer die Ansicht im Band, nicht fuer den Druck.
// hell: Farbe fuer Designs, die fuer helles Textil gezeichnet sind; sonst fuer dunkles (helle Schrift darauf lesbar).
export const TEXTIL_FARBEN = {
  gelb: { label: 'Gelb', hex: '#F6D33C', hell: true, name: { tee: 'Solar Yellow', polo: 'Solar Yellow' } },
  mint: { label: 'Mint', hex: '#B9E2CB', hell: true, name: { tee: 'Millennial Mint', polo: 'Blush Mint' } },
  hellblau: { label: 'Hellblau', hex: '#A8CCE6', hell: true, name: { tee: 'Sky Blue', polo: 'Blush Blue' } },
  rot: { label: 'Rot', hex: '#C8102E', hell: false, name: { tee: 'Red', polo: 'Red' } },
  royal: { label: 'Royalblau', hex: '#1F4AA8', hell: false, name: { tee: 'Royal Blue', polo: 'Royal Blue' } },
  gruen: { label: 'Grün', hex: '#1E4D3A', hell: false, name: { tee: 'Bottle Green', polo: 'Dark Forest' } },
  // 6. Okt., Markus: "ein cooles rotes Shirt und orangenes Shirt mit Weiss fuer Sprueche ... und diese cremefarbenen Sachen sind auch schoen".
  // B&C #E190 Datenblatt: Orange #FB6407, Natural #EDE2D1. Nur das T-Shirt - fuers Polo ist die Farbe nicht belegt (kein name.polo).
  orange: { label: 'Orange', hex: '#FB6407', hell: false, name: { tee: 'Orange' } },
  natur: { label: 'Creme', hex: '#EDE2D1', hell: true, name: { tee: 'Natural' } }
};
export const FARB_TEILE = ['tee', 'polo'];
// Einfaerben aus der weissen Vorlage: Stoff ist, wo weisse und schwarze Fassung sich unterscheiden (dasselbe Foto -
// wie stoffMaske). Licht und Falten kommen aus der Helligkeit des weissen Stoffs. Gemessen am 4. Okt.: sauber nur, wo
// beide Fassungen dasselbe Foto sind (Uebergangszone unter 5 %: alle T-Shirt-/Hoodie-Motto-Szenen, bc-tee, bc-polo);
// die KI-Produktfotos tee/zip/beutel und die Szenen Mann/Frau sind zwei verschiedene Fotos - dort gibt es KEINE Farbe.
const FAERB_MASKEN = new Map();
export async function faerbMaske(dir, key) {
  if (FAERB_MASKEN.has(key)) return FAERB_MASKEN.get(key);
  let m = null;
  try {
    const [w, b] = await Promise.all(['white', 'black'].map(f => sharp(path.join(dir, key + '_' + f + '.png')).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
    if (w.info.width === b.info.width && w.info.height === b.info.height) {
      const W = w.info.width, H = w.info.height, n = W * H, roh = Buffer.alloc(n);
      let stoff = 0, zwischen = 0;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(w.data[i * 3] - b.data[i * 3]) + Math.abs(w.data[i * 3 + 1] - b.data[i * 3 + 1]) + Math.abs(w.data[i * 3 + 2] - b.data[i * 3 + 2]);
        roh[i] = Math.round(Math.max(0, Math.min(1, (d - 40) / 100)) * 255);
        if (d > 120) stoff++; else if (d > 25) zwischen++;
      }
      const lums = [];
      for (let i = 0; i < n; i += 7) if (roh[i] > 242) lums.push(0.299 * w.data[i * 3] + 0.587 * w.data[i * 3 + 1] + 0.114 * w.data[i * 3 + 2]);
      lums.sort((x, y) => x - y);
      const data = await sharp(roh, { raw: { width: W, height: H, channels: 1 } }).blur(1.2).toColourspace('b-w').raw().toBuffer();
      m = { data, width: W, height: H, ref: lums[Math.floor(lums.length * 0.75)] || 235, zwischen: zwischen / n, stoff: stoff / n };
      if (m.zwischen > 0.05 || m.stoff < 0.08) { console.log('Einfaerben ' + key + ': nicht sauber (Uebergangszone ' + Math.round(m.zwischen * 100) + ' %, Stoff ' + Math.round(m.stoff * 100) + ' %) - keine Farbe'); m = null; }
    }
  } catch (e) { console.log('Einfaerben ' + key + ': keine zweite Fassung (' + (e && e.message ? e.message : e) + ')'); }
  FAERB_MASKEN.set(key, m);
  return m;
}
export async function einfaerben(templateBuf, maske, hex) {
  const a = await sharp(templateBuf).removeAlpha().resize(maske.width, maske.height, { fit: 'fill' }).raw().toBuffer();
  const c = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
  const n = maske.width * maske.height, out = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    const t = maske.data[i] / 255, o = i * 3;
    if (!t) { out[o] = a[o]; out[o + 1] = a[o + 1]; out[o + 2] = a[o + 2]; continue; }
    const l = (0.299 * a[o] + 0.587 * a[o + 1] + 0.114 * a[o + 2]) / maske.ref;
    for (let k = 0; k < 3; k++) {
      const v = l <= 1 ? c[k] * l : c[k] + (255 - c[k]) * Math.min(1, (l - 1) * 2);
      out[o + k] = Math.round(a[o + k] * (1 - t) + Math.max(0, Math.min(255, v)) * t);
    }
  }
  return sharp(out, { raw: { width: maske.width, height: maske.height, channels: 3 } }).png().toBuffer();
}

export async function makeMockup(masterPng, garment, color, watermark, opts = {}) {
  const g = GARMENTS[garment];
  if (!g || !COLORS.includes(color)) throw new Error('unbekanntes Textil');
  const place = opts.place || 'front';
  const print = opts.print || (color === 'white' ? 'hell' : 'dunkel');
  // 21. Sept., 09:00, live: ein Poster-Mockup einer Postkarte brauchte ueber 30 s (502 am Rand).
  // Gemessen: fast alles ging fuer die Druckdatei drauf - 8 Megapixel dreimal beschneiden und
  // verkleinern. Ein Mockup ist 1024 px gross; eine Vorlage mit 2200 px auf der langen Seite
  // ist dafuer mehr als genug. Die dpi werden mitskaliert, damit Echtmass und Bemassung stimmen.
  masterPng = await mockupQuelle(masterPng);
  // 9. Okt., Markus: "Schaufenster und Wand, bitte das Wasserzeichen entfernen und gute Aufloesung" - die saubere Fassung
  // (opts.hochwertig) ohne Farbunterabtastung und mit hoeherer Qualitaet; feine Schrift im Druck bleibt scharf.
  const jpgOpt = opts.hochwertig ? { quality: 93, chromaSubsampling: '4:4:4' } : { quality: 84 };

  // opts.ansicht === 'szene': dasselbe Teil in Benutzung statt sachlich vor grauem Grund.
  // Es hat eine eigene Vorlage und eine eigene Druckflaeche - ein Handtuch ueber einem
  // Liegestuhl haengt anders als eines am Halter.
  // Fassung 86: Ob eine Situation gezeigt werden kann, entscheidet die VORLAGE - nicht ein
  // Eintrag im Code. Vorher musste ein Artikel ein szene-Feld in GARMENTS tragen; die meisten
  // hatten keins, also waere ihre Situation nie gezeigt worden, auch wenn das Bild schon
  // dalag. Genau so ist die Strandszene des Handtuchs wochenlang unbenutzt liegen geblieben.
  // Jetzt gilt: liegt <artikel>-szene_<farbe>.png da und ist eine Druckflaeche dazu bekannt,
  // wird sie genommen. Die selbst erzeugten Vorlagen bringen ihre Flaeche selbst mit.
  // 20. Sept. (Markus: "eine Postkarte auf ein grosses Poster kann aufgrund des Formats nicht
  // funktionieren"): ein Motiv, das breiter als hoch ist, kommt auf die Querformat-Vorlage des
  // Teils, wenn es eine gibt (<artikel>-quer, MITGELIEFERT). Sonst bleibt es beim Hochformat.
  const mmEarly = await sharp(masterPng).metadata();
  const quer = istQuer(mmEarly.width, mmEarly.height) && await querVorlageDa(garment, color);
  const form = quer ? garment + '-quer' : garment;
  // 27. Sept., Markus: "am Namen ist zu erkennen, dass es sich um eine Frau handelt, dann sollte
  // es auch als Frau als Beispiel kommen." opts.wer ('frau' | 'mann') waehlt die Situation mit
  // der passenden Person (<teil>-szene-frau_<farbe>), wenn sie daliegt und vermessen ist. Fehlt
  // sie, bleibt es bei der allgemeinen Situation - nie eine Adresse ohne Bild dahinter.
  // 2. Okt.: opts.thema (Motto-Slug) - das Shirt in der Szene seines Mottos, wenn sie daliegt.
  const thema = opts.ansicht === 'szene' && !quer && opts.thema ? await szeneThemaFuer(garment, color, opts.thema, opts.wer || '') : '';
  const szeneForm = thema ? form + '-szene-thema-' + thema
    : opts.ansicht === 'szene' && !quer && opts.wer && await szeneVarianteDa(garment, color, opts.wer)
    ? form + '-szene-' + opts.wer : form + '-szene';
  const szeneKey = szeneForm + '_' + color;
  // 20. Sept., live gemessen: Kissen, Poster (schwarz), Sticker und Strandtuch zeigten trotz
  // mitgelieferter Situation die sachliche Ansicht - hier fehlte die mitgelieferte Flaeche,
  // szeneMoeglich kannte sie schon. Beide muessen dieselbe Reihe fragen.
  const szeneBox = BOX_OVERRIDES[szeneKey] || gelernteBox(szeneKey) || mitgelieferteBox(szeneKey) || (!quer && szeneForm === form + '-szene' && g.szene && g.szene.box) || null;
  const szeneDa = opts.ansicht === 'szene' && !!szeneBox && await templateReady(szeneForm, color);
  const szene = szeneDa ? { box: szeneBox } : null;
  // 21. Sept.: opts.linie ('bc' | 'ss') - das Herstellerfoto der gewaehlten Textil-Linie statt der
  // KI-Vorlage, wenn es fuer dieses Teil und diese Farbe eine gibt (MITGELIEFERT, dateien).
  const linieKey = !szene && !quer && opts.linie && await linieVorlageDa(opts.linie, garment, color) ? opts.linie + '-' + garment : null;
  // 5. Okt. abends: ein Design fuer den Ruecken liegt auf dem Foto von hinten (MITGELIEFERT <teil>-ruecken), wenn es eins gibt.
  // 6. Okt.: zuerst der Ruecken der gewaehlten Linie (Roly hat einen eigenen), sonst der von Stanley/Stella.
  const rueckenLinie = opts.rueckenFoto && !szene && opts.linie && MITGELIEFERT[opts.linie + '-' + garment + '-ruecken'] && await templateReady(opts.linie + '-' + garment + '-ruecken', color) ? opts.linie + '-' + garment + '-ruecken' : null;
  const rueckenKey = rueckenLinie || (opts.rueckenFoto && !szene && MITGELIEFERT[garment + '-ruecken'] && await templateReady(garment + '-ruecken', color) ? garment + '-ruecken' : null);
  const key = (szene ? szeneForm : (rueckenKey || linieKey || form)) + '_' + color;
  let template = await fs.readFile(path.join(dir, key + '.png'));
  // 4. Okt.: opts.szeneVorlage (Buffer) - dieselbe Szene, nur mit anderem Inhalt AUSSERHALB der Druckflaeche
  // (Haustier-Szene: das Tier vom Shirt daneben, tier-szene.js). Gleiche Groesse wie die Vorlage, sonst
  // stimmt die Vermessung nicht - darum auf deren Mass gebracht.
  if (szene && opts.szeneVorlage) {
    const tm = await sharp(template).metadata();
    template = await sharp(opts.szeneVorlage).resize(tm.width, tm.height, { fit: 'fill' }).png().toBuffer();
  }
  // opts.farbe (Schluessel aus TEXTIL_FARBEN): der weisse Stoff eingefaerbt. Nur, wo es sauber geht - sonst kein Bild
  // (lieber keins als ein falsches; das Band zeigt nur, was fertig daliegt).
  const farbe = opts.farbe && TEXTIL_FARBEN[opts.farbe] && color === 'white' && FARB_TEILE.includes(garment) ? TEXTIL_FARBEN[opts.farbe] : null;
  if (opts.farbe && !farbe) throw new Error('Farbe ' + opts.farbe + ' gibt es fuer ' + garment + '/' + color + ' nicht');
  if (farbe) {
    const fm = await faerbMaske(dir, key.replace(/_white$/, ''));
    if (!fm) throw new Error('Vorlage ' + key + ' laesst sich nicht sauber einfaerben');
    template = await einfaerben(template, fm, farbe.hex);
  }
  // Reihenfolge der Quellen, und sie ist Absicht:
  //   1. BOX_OVERRIDES - von Hand abgemessen fuer eine BESTIMMTE Vorlage. Wer das eingetragen
  //      hat, hat hingesehen; das schlaegt jede Messung.
  //   2. die selbst gemessene Flaeche - sie gehoert zu genau dem Bild, das gerade geladen wurde.
  //   3. der Wert aus GARMENTS - bei selbst erzeugten Vorlagen nur ein Startwert, bis gemessen
  //      wurde.
  // 20. Sept.: dazwischen die Flaeche der mitgelieferten Vorlage (MITGELIEFERT) - vor dem
  // Startwert aus GARMENTS, nach einer im Backend gemessenen.
  const boxRoh = BOX_OVERRIDES[key] || gelernteBox(key) || mitgelieferteBox(key) || (szene ? szene.box : (quer ? null : g.box));
  const themaSzene = !!(szene && thema && boxRoh && Array.isArray(g.flaecheCm));
  // Themen-Szene: die Druckflaeche (36 x 46 cm) im gemessenen Massstab der Szene, mittig auf der
  // Magenta-Flaeche, oben an ihrer Oberkante (szeneMassstab).
  const pxCm = themaSzene ? szeneMassstab(szeneForm, boxRoh) : 0;
  const rumpfMitte = SZENE_RUMPF_MITTE[szeneForm];
  const ruecken = themaSzene ? SZENE_RUECKEN[szeneForm] : null;
  if (ruecken) {
    const rumpf = SZENE_SHIRT_PX[szeneForm];
    // Massstab auf der Stoffoberflaeche: der Bogen zwischen den Raendern des Rueckenteils sind 53 cm, dazu
    // hoechstens die Laenge (Kragen bis Saum = 72 cm). rumpf bleibt der Ersatz ohne gemessene Raender.
    const r = ruecken.halbe ? rueckenRadius(ruecken.halbe) : 0;
    const bogen = r ? 2 * r * RUECKEN_WOELBUNG.randGrad * Math.PI / 180 : rumpf / 0.85 * 38 / SHIRT_CM;
    const pxR = Math.min(ruecken.laenge / SHIRT_LAENGE_CM, bogen / SHIRT_CM);
    const hoehe = Math.round(48 * pxR);
    var rueckenPxCm = pxR;
    var rueckenBox = { x: Math.round((rumpfMitte || boxRoh.x + boxRoh.w / 2) - g.flaecheCm[0] * pxR / 2), y: Math.round(ruecken.kragen + ruecken.laenge * 0.45 - hoehe / 2), w: Math.round(g.flaecheCm[0] * pxR), h: hoehe };
  }
  const box = ruecken ? rueckenBox : themaSzene ? { x: Math.round((rumpfMitte || boxRoh.x + boxRoh.w / 2) - g.flaecheCm[0] * pxCm / 2), y: boxRoh.y, w: Math.round(g.flaecheCm[0] * pxCm), h: Math.min(Math.round(g.flaecheCm[1] * pxCm), 1015 - boxRoh.y) } : boxRoh;
  const druck = themaSzene && DRUCK_ARTEN.includes(opts.druck) ? opts.druck : '';
  if (!box || !(box.w > 0) || !(box.h > 0)) throw new Error('Vorlage ' + key + ' hat keine brauchbare Druckflaeche');

  // box ist die MOTIV-Flaeche: mittig auf der Brust, so gross wie ein Design werden darf.
  // Ein Firmenlogo gehoert woanders hin - auf die Herzseite, deutlich aus der Mitte heraus,
  // und auf dem Ruecken gross zwischen die Schulterblaetter. Deshalb rechnet opts.logo mit
  // eigenen Werten, waehrend der Design-Weg (Motiv, Brust-Print mit Namen) unveraendert bleibt.
  // mitte 0.83 = Mitte der Flaeche (0.5) plus ein Drittel nach aussen. Das ist die Stelle, an der
  // ein Brustlogo auf einem echten Teil sitzt. Der alte Wert richtete die LINKE KANTE bei 0.56 aus -
  // dadurch klebte das Logo fast in der Mitte, beim schmalen Hoodie-Kasten besonders deutlich.
  // Gerechnet in echten Druckmassen. Die Druckflaeche ist 36 cm breit (siehe Druckdatei 36x46 cm).
  //   Brustlogo: rund 9 cm breit  -> 0.25 der Flaeche
  //   linke Kante rund 6 cm rechts der Koerpermitte -> 0.5 + 6/36 = 0.67
  // Der alte Wert 0.56 lag nur 2 cm neben der Mitte - deshalb sah es nicht nach Herzseite aus,
  // beim schmalen Hoodie-Kasten besonders deutlich.
  // rand: das Logo darf die Kante nie beruehren, sonst sitzt es an der Aermelnaht.
  const LOGO_BRUST = { kante: 0.67, oben: 0.12, breite: 0.25, rand: 0.05 };
  // Rueckendruck rund 29 cm auf 36 cm Flaeche.
  const LOGO_RUECKEN = { oben: 0.08, breite: 0.80 };
  // Wo die Prozentrechnung nicht reicht: feste Brustzone je Vorlage (Pixel auf 1024), abgemessen
  // an Markus' Screenshots der echten Fotos. Beim Hoodie sass das Logo direkt unter der Kapuze
  // und fast mittig - die Zone liegt jetzt zwischen Kapuzenansatz (y~190) und Tasche (y~594),
  // deutlich auf der Herzseite. Weisse Hoodie-Vorlage sitzt etwas tiefer (siehe BOX_OVERRIDES).
  const LOGO_BRUST_ZONE = {
    hoodie_black: { cx: 612, cy: 385, w: 84 },
    hoodie_white: { cx: 618, cy: 408, w: 82 },
    tee:          { cx: 626, cy: 296, w: 92 },   // "etwas zu niedrig" -> ein Stueck hoeher
    polo:         { cx: 622, cy: 385, w: 86 }
  };
  const alsLogo = !!opts.logo;
  // 22. Sept., Markus: "Bei Polos passt der Front Print nicht in die Mitte." Auf einem Polo IST
  // der Frontdruck der Brustdruck - mittig sitzt die Knopfleiste. Die Stelle kommt als Anteil der
  // Druckflaeche (g.brustLinks), damit sie auf jeder Vorlage stimmt, auch auf den Herstellerfotos.
  // Ein ausdruecklich gewaehlter Platz (Ruecken, Brust) bleibt unberuehrt, ein Vollflaechen-
  // artikel und der Logo-Weg ebenso.
  // g.voll direkt statt der Variablen "voll" - die steht erst weiter unten, und ein const davor
  // zu lesen bricht zur Laufzeit.
  const brustAnteil = !alsLogo && place === 'front' && !g.voll && box && g.brustLinks && Array.isArray(g.flaecheCm) && g.flaecheCm[0] > 0
    ? g.brustLinks : null;
  // druck mit platz 'herz' (8 x 8, 10 x 10): auf der Herzseite, wie ein kleiner Brustdruck sitzt (LOGO_BRUST).
  const dm = druck ? DRUCK_MASSE[druck] : null;
  const zone = dm && dm.platz === 'herz'
    ? { cx: Math.round(box.x + box.w * (LOGO_BRUST.kante + 0.14)), cy: Math.round(box.y + box.h * 0.17), w: Math.round(box.w * dm.cm[0] / g.flaecheCm[0]) }
    : alsLogo && place === 'chest'
    ? (LOGO_BRUST_ZONE[key] || LOGO_BRUST_ZONE[garment] || null)
    : (brustAnteil ? {
      cx: Math.round(box.x + box.w * brustAnteil.xAnteil),
      cy: Math.round(box.y + box.h * brustAnteil.yAnteil),
      w: Math.max(24, Math.round(box.w * (brustAnteil.cm / g.flaecheCm[0])))
    } : null);

  let anteil = 1;
  if (place === 'chest') anteil = alsLogo ? LOGO_BRUST.breite : 0.34;
  else if (place === 'back' && alsLogo) anteil = LOGO_RUECKEN.breite;
  const fitW = zone ? zone.w : Math.round(box.w * anteil);
  const fitH = zone ? zone.w : Math.round(box.h * anteil);
  // Die Druckdatei hat rundherum Luft (sie ist auf die volle Druckflaeche 36x46 cm gerechnet).
  // Fuers Mockup zaehlt nur, was wirklich auf dem Textil landet: sonst sitzt das Motiv je nach
  // Luftverteilung neben der Mitte und faellt kleiner aus, als es soll - genau das sah auf dem
  // Shirt schief aus. Darum vor dem Einpassen auf die sichtbaren Pixel beschneiden.
  const voll = !!g.voll;
  // Fassung 74 (Markus, 17. Sept.: "Auf dem Kissen ist die Datei abgeschnitten"): Ein Motiv,
  // das fuer Textil 30 x 35 cm gebaut wurde, wurde auf dem Kissen formatfuellend eingelegt -
  // Hochformat in eine querformatige Flaeche, also oben und unten abgeschnitten. Die untere
  // Zeile des Spruchs war weg.
  //
  // Randlos ist nur dann richtig, wenn DIESES Teil auch das bestellte ist: dann ist die
  // Druckdatei genau auf seine Flaeche gerechnet und laeuft von Kante zu Kante. Auf jedem
  // anderen Teil ist das Mockup eine Vorschau - dort wird das Motiv HINEINGELEGT, nie
  // beschnitten. Lieber ein Rand, der ehrlich ist, als ein Motiv, dem die Pointe fehlt.
  const eigen = !!(opts.artikel && opts.artikel.ansicht === garment);
  const randlos = voll && eigen && opts.artikel.motivart === 'vollflaechig';
  // Hat der Kunde ein Mass bestellt, ist DAS die Zahl, die er kennt - sie steht unter dem Bild
  // ("Textil · 30 x 35 cm"). Dann wird die ganze Druckdatei eingepasst und auch so bemasst,
  // statt den beschnittenen Motivbereich zu messen: Markus sah sonst 27,9 x 31,7 cm neben dem
  // Beutel und 30 x 35 cm in der Zeile darunter - zwei Zahlen fuer dieselbe Sache.
  const bestellt = eigen && opts.artikel && Array.isArray(opts.artikel.netto) ? opts.artikel.netto : null;
  const ganzeDatei = randlos || !!bestellt;
  let quelle = masterPng;
  // Fassung 73 (Markus, 17. Sept.: "immer auch direkt mit Bemassung, ueberall wo ein Mass
  // nutzbar ist - bau das direkt so ein, dass der Kunde sofort sieht, was los ist"):
  // Das Mass steht in der Druckdatei selbst. Sie ist in Echtgroesse abgelegt und traegt ihre
  // dpi im Kopf - also ergibt der beschnittene Motivbereich direkt die Zentimeter, die auf dem
  // Teil landen. Kein geschaetzter Wert, keine zweite Quelle, die auseinanderlaufen koennte.
  let motivCm = null, gedreht = false;
  const deckend = voll && !randlos ? await istDeckend(masterPng) : false;
  const flagge = deckend ? flaggeFuer(opts.land) : null;
  try {
    const mm = await sharp(masterPng).metadata();
    const dpi = mm.density && mm.density > 20 ? mm.density : null;
    // Beschnitten wird nur beim freistehenden Druck. Beim echten Vollflaechendruck gehoert der
    // Rand zum Motiv - wer ihn wegschneidet, zeigt ein anderes Teil, als der Kunde bekommt.
    let tm = mm;
    if (!ganzeDatei) {
      // Beschnitt ueber eine kleine Fassung gemessen (trim auf der grossen Datei kostet eine Sekunde)
      const t = await beschneiden(masterPng, mm);
      tm = await sharp(t).metadata();
      if (tm.width >= 64 && tm.height >= 64) quelle = t; else tm = mm;
    }
    if (dpi) motivCm = [tm.width / dpi * 2.54, tm.height / dpi * 2.54];
    // 20. Sept., Markus: "Eine Postkarte passt so nicht aufs Handtuch - bitte drehen." Auf
    // Flachware, deren Flaeche laenglich ist, wird ein Motiv, das quer zur Flaeche steht
    // (Querformat auf Hochformat oder umgekehrt), um 90 Grad gedreht und liegt dann laengs.
    // Nur fuer fremde Motive: ein randlos fuer dieses Teil gebautes passt schon.
    // 21. Sept.: liegt das Teil auf seiner Querformat-Vorlage (quer), ist seine Flaeche gedreht -
    // sonst wuerde ein Querformat-Motiv auf dem Querformat-Tuerschild noch einmal gedreht.
    const flTeil = quer && Array.isArray(g.flaecheCm) ? [g.flaecheCm[1], g.flaecheCm[0]] : g.flaecheCm;
    if (voll && !randlos && !alsLogo && !g.zylinder && Array.isArray(flTeil) && flTeil[0] > 0 && flTeil[1] > 0) {   // Tasse: nichts drehen, ein Motiv steht auf der Tasse aufrecht
      const teilHoch = flTeil[1] > flTeil[0] * 1.15;
      const motivQuer = tm.width > tm.height * 1.15;
      // 21. Sept., 20:59, Markus (Geburt-Motiv seitlich auf dem XXL-Mousepad): "Fuer ein Mousepad
      // ist die Ausrichtung nicht gut." Gedreht wird nur noch ein Querformat-Motiv auf einem
      // hohen Teil (die Postkarte auf dem Handtuch, wie am 20. bestellt). Ein Hochformat-Motiv
      // auf einem breiten Teil (Mousepad, Hundedecke, Brett) bleibt aufrecht - Schrift liest
      // niemand seitlich - und wird in der Hoehe eingepasst.
      if (teilHoch && motivQuer) {
        quelle = await sharp(quelle).rotate(90).png().toBuffer();
        if (motivCm) motivCm = [motivCm[1], motivCm[0]];
        gedreht = true;
      }
    }
  } catch (e) { /* laesst sich nicht beschneiden oder messen: dann eben ohne Bemassung */ }
  // Fassung 74: Wenn bekannt ist, wie gross die Flaeche der Vorlage in echt ist (flaecheCm) und
  // wie gross das Motiv in echt wird (motivCm), dann wird es in GENAU diesem Verhaeltnis
  // gezeichnet - ein 10-cm-Brustprint erscheint als 10-cm-Brustprint, nicht formatfuellend.
  // Brustlogo und Rueckenlogo bleiben aussen vor, die haben ihre eigenen Massregeln
  // (LOGO_BRUST, LOGO_RUECKEN). masstabEcht sagt hinterher, ob eine Bemassung zum Bild passt -
  // eine Zahl neben einem Motiv, das in einem anderen Massstab gezeichnet ist, luegt.
  let zielW = voll ? box.w : fitW, zielH = voll ? box.h : fitH;
  let masstabEcht = randlos;
  // 20. Sept., Markus mit Bild vom Strandtuch: "Es ist viel zu klein da drauf. Warum geht das
  // jetzt nicht mehr? Wir haben doch ganz klare Absprachen getroffen." Die Absprache ist die
  // von Fassung 73: Handtuch, Kissen, Poster und alle Flachware sind VOLLFLAECHENDRUCK. Das
  // Echtmass-Zeichnen (Fassung 74) galt trotzdem auch fuer sie - ein 30 x 35 cm gebautes Motiv
  // stand als Briefmarke auf dem 70 x 140 cm grossen Tuch. Ab jetzt: auf Flachware wird das
  // Motiv formatfuellend EINGEPASST (so gross, wie es ohne Beschnitt geht, Proportion bleibt);
  // das Echtmass bleibt den Textilien mit Druckflaeche auf der Brust vorbehalten.
  if (!randlos && !alsLogo && !zone && !voll && place === 'front' && !druck && motivCm && Array.isArray(g.flaecheCm)) {
    // Umgerechnet wird ueber EINE Achse, die Breite. Die box ist das Teil im Foto und selten
    // exakt so proportioniert wie seine Druckflaeche (ein Kissen baucht, ein Shirt faellt) -
    // wer beide Achsen einzeln streckt, verzerrt das Motiv, und wer beide einzeln begrenzt,
    // zeichnet es kleiner als die Zahl daneben behauptet. Ein Massstab, beide Seiten.
    const pxProCm = box.w / g.flaecheCm[0];
    let bw = Math.round(motivCm[0] * pxProCm), bh = Math.round(motivCm[1] * pxProCm);
    if (bw > box.w || bh > box.h) {
      // Passt nicht auf dieses Teil - dann verkleinern UND die Bemassung weglassen, statt eine
      // Groesse hinzuschreiben, die hier gar nicht draufgeht.
      const k = Math.min(box.w / bw, box.h / bh);
      bw = Math.round(bw * k); bh = Math.round(bh * k);
    } else if (bw < box.w * 0.55 && bh < box.h * 0.55) {
      // 21. Sept., 08:35, Markus (Beutel mit briefmarkengrossem Motiv): "Wir wollten das doch
      // ausschliessen, dass das passiert. Das ist doch viel zu klein." Ein Motiv, das in echt
      // nicht einmal die halbe Flaeche des Teils fuellt, wird formatfuellend eingepasst
      // (Proportion bleibt, ein Rand bleibt) - und nicht bemasst, weil es dann nicht Echtmass ist.
      const k = Math.min(box.w * 0.86 / bw, box.h * 0.86 / bh);
      bw = Math.round(bw * k); bh = Math.round(bh * k);
    } else {
      masstabEcht = true;
    }
    zielW = Math.max(24, bw);
    zielH = Math.max(24, bh);
  } else if (!randlos && voll) {
    // Flachware mit einem Motiv, das fuer ein anderes Teil gebaut wurde: formatfuellend
    // eingepasst, nichts abgeschnitten (Fassung 74, "Auf dem Kissen ist die Datei
    // abgeschnitten"). Ein Rand bleibt nur dort, wo die Proportion des Motivs nicht zur
    // Flaeche passt - der ist ehrlich, eine Briefmarke in der Mitte war es nicht.
    zielW = box.w;
    zielH = box.h;
  }
  // Echter Vollflaechendruck: das Motiv fuellt die Flaeche des Teils formatfuellend aus.
  // Alles andere wird eingepasst und behaelt seine Proportion - nichts wird beschnitten.
  // 21. Sept., 20:54, Markus (Handtuch, Strandtuch, Kissen mit eigenem Design): "Abgeschnitten" -
  // "Genau die gleiche Scheisse wie am Anfang bei den Kissen." Ein fuer das Teil gezeichnetes
  // Motiv wurde mit 'cover' in die Flaeche des FOTOS gelegt; hat das Foto nicht das Verhaeltnis
  // des Artikels (Handtuch-Foto 3:4, Artikel 1:2), war die Schrift weg. Regel: NIE beschneiden.
  // Weicht die Flaeche im Foto mehr als 6 % vom Motiv ab, wird das Motiv ganz eingepasst und der
  // Rest aus dem Motiv weitergefuehrt (Randfarbe oder unkenntlich weich) - wie bei deckenden
  // Fremdmotiven. Stimmt das Verhaeltnis, bleibt 'cover' (Bruchteile eines Prozents).
  // druck mit platz 'mitte' oder 'ruecken': das Motiv in genau diesem Mass (Breite x Hoehe in cm, eingepasst).
  if (dm && dm.platz !== 'herz') { zielW = Math.round(box.w * dm.cm[0] / g.flaecheCm[0]); zielH = Math.round(box.w * dm.cm[1] / g.flaecheCm[0]); masstabEcht = false; }
  let quelleVerh = null;
  if (randlos) { try { const qm = await sharp(quelle).metadata(); quelleVerh = qm.width / qm.height; } catch (e) { quelleVerh = null; } }
  const passtZu = (w, h) => quelleVerh == null || Math.abs(quelleVerh / (w / h) - 1) <= 0.06;
  const randlosPasst = passtZu(box.w, box.h);
  // 2. Okt., Markus (Kissen-Design von EAST26 mit braunen Streifen links und rechts): "Wenn wir schon
  // antippen, ein Design fuer ein Kissen zu machen, dann sollte es zu 100 % passen." Gemessen: die
  // Druckdatei ist 2877 x 2877 (40,6 x 40,6 cm), das Kissen 40 x 40 - sie passt. Nur die Flaeche im
  // FOTO ist 475 x 430 (gepolstert, leicht von vorn oben), 10 % breiter als hoch, und ab 6 % legte
  // die Ansicht das Motiv eingepasst hinein und fuellte die Seiten auf. Ist die Datei fuer DIESES
  // Teil gebaut und stimmt ihr Verhaeltnis mit dem ECHTEN Mass (bestellt, sonst flaecheCm), dann ist
  // die Flaeche im Foto genau die Druckflaeche: sie wird ganz ausgefuellt ('fill'), nichts beschnitten.
  const echtCm = bestellt && bestellt.length === 2 ? bestellt : (Array.isArray(g.flaecheCm) && g.flaecheCm.length === 2 ? g.flaecheCm : null);
  const passtZumArtikel = randlos && quelleVerh != null && !!echtCm && Math.abs(quelleVerh / (echtCm[0] / echtCm[1]) - 1) <= 0.03;
  let art = randlos
    ? (passtZumArtikel
      ? await sharp(quelle).resize({ width: box.w, height: box.h, fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
      : randlosPasst
      ? await sharp(quelle).resize({ width: box.w, height: box.h, fit: 'cover', position: 'centre', kernel: 'lanczos3' }).png().toBuffer()
      : await flaecheMitMotiv(quelle, box.w, box.h, { deckend: true }))
    // Flachware mit deckendem Motiv: die ganze Flaeche, Rest aus dem Motiv (siehe flaecheMitMotiv)
    : (voll && deckend)
      ? await flaecheMitMotiv(quelle, box.w, box.h, { deckend: true, flagge })
      // 'inside' statt 'fill': zielW/zielH stammen bei bekanntem Echtmass aus EINEM Massstab und
      // tragen das Seitenverhaeltnis des Motivs schon in sich - da aendert 'inside' nichts. Wo das
      // Echtmass fehlt, sind es nur Schranken, und dann muss die Proportion erhalten bleiben.
      : await sharp(quelle).resize({ width: zielW, height: zielH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  let am = await sharp(art).metadata();

  // 20. Sept., Markus: "Ein Strandtuch ueber dem Liegestuhl, wo das ganze Motiv drauf passt, kann
  // nicht stimmen - es ist ja nur zur Haelfte." In so einer Situation ist nur ein Teil des Teils
  // zu sehen (sicht: 'unten' = der untere). Wie viel, sagt die Geometrie: die sichtbare Flaeche
  // (box) gegen das ganze Teil (flaecheCm). Erst wird das Motiv auf das GANZE Teil gelegt, wie
  // sonst auch (randlos oder eingepasst), dann kommt nur der sichtbare Ausschnitt ins Bild.
  // 21. Sept.: Vorlage mit Maske (echtes Foto, bedruckbare Flaeche als Maske, siehe MITGELIEFERT
  // und flaecheAufMaske) - der Druck folgt der Maske und traegt die Schattierung des Fotos.
  const maskeKey = szene ? szeneForm : form;
  if (!alsLogo && place === 'front' && voll && MASKEN[maskeKey]) {
    let maskBuf = null;
    try { maskBuf = await fs.readFile(path.join(dir, maskeKey + '.maske.png')); } catch (e) { maskBuf = null; }
    if (maskBuf) {
      const flG = quer && Array.isArray(g.flaecheCm) ? [g.flaecheCm[1], g.flaecheCm[0]] : g.flaecheCm;   // Querformat-Vorlage: Flaeche gedreht
      const fl = Array.isArray(flG) && flG[0] > 0 && flG[1] > 0 ? flG : [box.w, box.h];
      const mk = await maskeKanten(maskBuf);
      // Die ganze Flaeche im Verhaeltnis der MASKE (so, wie das Foto sie zeigt) - nicht im
      // Echtmass. Beide weichen leicht voneinander ab (das Strandtuch-Foto ist etwas laenger als
      // 70x140), und die Abbildung streckt die Flaeche ohnehin auf die Maske: mit dem Echtmass
      // wuerde ein eingepasstes Motiv um genau diese Abweichung verzerrt. Nur wenn ein Teil des
      // Teils verdeckt ist (sicht 'unten'), braucht es das Echtmass, um zu wissen, wie viel.
      const ganzW = 1000;
      // 21. Sept., 21:20, Markus (Kissen mit Raendern): "Das Kissen passt jetzt nicht mehr!! Was
      // vorher top war." Ein eigenes Motiv wird auf die Flaeche der MASKE abgebildet, so wie ein
      // echter Druck auf einem schraeg fotografierten Kissen aussieht: die Flaeche wird im
      // Verhaeltnis des MOTIVS gebaut (nichts beschnitten, keine Raender) und von
      // flaecheAufMaske auf die Maske gestreckt - bei einem leicht schraegen Foto ist das genau
      // die Perspektive. Fremde Motive und 'sicht: unten' wie bisher.
      const ganzH = MASKEN[maskeKey].sicht === 'unten' ? Math.round(ganzW * fl[1] / fl[0])
        : (randlos && quelleVerh ? Math.round(ganzW / quelleVerh) : Math.round(ganzW * mk.box.h / Math.max(1, mk.box.w)));
      let ganz = await flaecheMitMotiv(quelle, ganzW, ganzH, { randlos, deckend, flagge });
      // sicht 'unten' (Handtuch ueber der Stange): nur der untere Teil des Teils ist zu sehen.
      // Wie viel, sagt die Maske: ihr Verhaeltnis gegen das ganze Teil.
      if (MASKEN[maskeKey].sicht === 'unten') {
        const anteil = Math.min(1, (mk.box.h / Math.max(1, mk.box.w)) / (fl[1] / fl[0]));
        const hSicht = Math.max(8, Math.round(ganzH * anteil));
        ganz = await sharp(ganz).extract({ left: 0, top: ganzH - hSicht, width: ganzW, height: hSicht }).png().toBuffer();
      }
      // Liegt die Flaeche schraeg im Bild (ecken, z. B. das Strandtuch im Sand), trifft das
      // Viereck die Perspektive besser als die Kanten: dann perspektivisch hinein, danach an der
      // Maske beschneiden und schattieren.
      const eckenM = MITGELIEFERT[maskeKey] && Array.isArray(MITGELIEFERT[maskeKey].ecken) ? MITGELIEFERT[maskeKey].ecken : null;
      const { ebene } = eckenM
        ? await maskeUndSchatten(template, maskBuf, await perspektivisch(ganz, eckenM))
        : await flaecheAufMaske(template, maskBuf, ganz, { schatten: true, wellen: MASKEN[maskeKey].wellen || 0, kontrast: MASKEN[maskeKey].kontrast || 1 });
      const lagen = [{ input: ebene, left: 0, top: 0, blend: 'over' }];
      if (watermark) lagen.push({ input: Buffer.from(`<svg width="1024" height="1024"><style>text{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:#000;fill-opacity:.18}</style><text x="50%" y="52%" font-size="54" text-anchor="middle" transform="rotate(-28 512 512)">MOTTO OTTO - VORSCHAU</text></svg>`) });
      return sharp(template).composite(lagen).jpeg(jpgOpt).toBuffer();
    }
  }
  const eckenVon = szene && MITGELIEFERT[form + '-szene'] && Array.isArray(MITGELIEFERT[form + '-szene'].ecken) ? MITGELIEFERT[form + '-szene'].ecken : null;
  if (eckenVon && Array.isArray(g.flaecheCm) && g.flaecheCm[0] > 0) {
    // Das ganze Teil in seinem echten Verhaeltnis (flaecheCm), das Motiv darauf wie sonst auch
    // (randlos: formatfuellend; sonst eingepasst), dann perspektivisch ins Viereck.
    const ganzW = 1000, ganzH = Math.round(ganzW * g.flaecheCm[1] / g.flaecheCm[0]);
    const rp = randlos && passtZu(ganzW, ganzH);
    const ganz = await flaecheMitMotiv(quelle, ganzW, ganzH, { randlos: rp, deckend: deckend || (randlos && !rp), flagge });
    const schraeg = await perspektivisch(ganz, eckenVon);
    const ebene = [{ input: schraeg, left: 0, top: 0, blend: color === 'white' && print === 'hell' ? 'multiply' : 'over' }];
    if (watermark) ebene.push({ input: Buffer.from(`<svg width="1024" height="1024"><style>text{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:#000;fill-opacity:.18}</style><text x="50%" y="52%" font-size="54" text-anchor="middle" transform="rotate(-28 512 512)">MOTTO OTTO - VORSCHAU</text></svg>`) });
    return sharp(template).composite(ebene).jpeg(jpgOpt).toBuffer();
  }
  const sichtVon = szene ? ((MITGELIEFERT[form + '-szene'] && MITGELIEFERT[form + '-szene'].sicht) || (g.szene && g.szene.sicht) || '') : '';
  if (sichtVon === 'unten' && Array.isArray(g.flaecheCm) && g.flaecheCm[0] > 0) {
    const ganzH = Math.round(box.w * g.flaecheCm[1] / g.flaecheCm[0]);
    if (ganzH > box.h + 8) {
      const ganz = await flaecheMitMotiv(quelle, box.w, ganzH, { randlos, deckend, flagge });
      const teil = await sharp(ganz).extract({ left: 0, top: ganzH - box.h, width: box.w, height: box.h }).png().toBuffer();
      am = await sharp(teil).metadata();
      const ebene = [{ input: teil, left: box.x, top: box.y, blend: color === 'white' && print === 'hell' ? 'multiply' : 'over' }];
      if (watermark) ebene.push({ input: Buffer.from(`<svg width="1024" height="1024"><style>text{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:#000;fill-opacity:.18}</style><text x="50%" y="52%" font-size="54" text-anchor="middle" transform="rotate(-28 512 512)">MOTTO OTTO - VORSCHAU</text></svg>`) });
      return sharp(template).composite(ebene).jpeg(jpgOpt).toBuffer();
    }
  }

  // Brust-Print sitzt auf der linken Brust des Traegers = im Bild rechts der Mitte.
  // Als Logo wird auf die MITTE ausgerichtet, nicht auf die linke Kante - sonst wandert ein
  // breites Logo nach aussen und ein schmales bleibt in der Mitte haengen.
  let left, top;
  if (randlos) { left = box.x; top = box.y; }
  // Vollflaechenware, auf die ein fremdes Motiv gelegt wird: mittig auf dem Teil, nicht oben
  // angeschlagen wie ein Transfer auf der Brust. Ein Kissen hat keine Schulter.
  else if (voll) {
    left = box.x + Math.round((box.w - am.width) / 2);
    top = box.y + Math.round((box.h - am.height) / 2);
  }
  else if (zone) {
    left = Math.round(zone.cx - am.width / 2);
    top = Math.round(zone.cy - am.height / 2);
  } else if (place === 'chest') {
    if (alsLogo) {
      const rechts = box.x + box.w - Math.round(box.w * LOGO_BRUST.rand) - am.width;
      left = Math.min(box.x + Math.round(box.w * LOGO_BRUST.kante), rechts);
    } else {
      left = box.x + Math.round(box.w * 0.56);
    }
    top = box.y + Math.round(box.h * (alsLogo ? LOGO_BRUST.oben : 0.05));
  } else {
    left = box.x + Math.round((box.w - am.width) / 2);
    if (place === 'back') {
      top = box.y + (alsLogo ? Math.round(box.h * LOGO_RUECKEN.oben) : 0);
    } else {
      // Ein Transfer wird oben angelegt, nicht in die Mitte der Flaeche gelegt. Vorher wurde
      // mittig ausgerichtet - ein breites, flaches Motiv landete dadurch auf Bauchhoehe statt
      // auf der Brust. Ein bisschen Luft nach oben bleibt, damit nichts am Kragen klebt.
      const luft = Math.max(0, box.h - am.height);
      top = box.y + Math.min(Math.round(box.h * 0.08), Math.round(luft * 0.25));
      // 7. Okt., Markus (Abi-Hoodie auf "So geht's"): "auch die Platzierung ist falsch. Die Kordeln sind nicht zu sehen." Der
      // grosse Druck vorne beginnt UNTER den Kordelspitzen und endet ueber der Tasche (CLAUDE.md, Hoodie) - je Herstellerfoto
      // gemessen (Vorlage 1024 px). Passt er nicht ganz dazwischen, endet er ueber der Tasche.
      const hk = !szene && HOODIE_KORDEL[String(key).replace(/_(white|black)$/, '')];
      if (hk && !alsLogo) {
        top = Math.max(top, hk.kordelEnde + 12);
        if (top + am.height > hk.taschenOben - 10) top = Math.max(hk.kordelEnde - 40, hk.taschenOben - 10 - am.height);
      }
    }
  }

  // Tasse: Rundumdruck (siehe GARMENTS.tasse). Das Motiv kommt erst auf die GANZE Druckflaeche
  // (19 x 8 cm; randlos, deckend mit Hintergrund, oder freistehend eingepasst), dann wird der
  // vorn sichtbare Ausschnitt des Rundlaufs um die Woelbung gelegt. Logos auf der Herzseite bleiben flach.
  // 22. Sept.: auch in der Situation (Tasse auf dem Fruehstueckstisch), wenn dort ein Zylinder abgemessen ist.
  if (g.zylinder && (!szene || (box && box.zylinder)) && !alsLogo && place === 'front' && Array.isArray(g.flaecheCm)) {
    // Die ganze Rundumflaeche (20 x 8,9 cm) in einem Bild; vorn sichtbar ist der halbe Umfang,
    // also 180 von den 279 Grad. Das Zylindermodell (zyl) ist an der Vorlage abgemessen.
    const ganzW = 1600, ganzH = Math.round(ganzW * g.flaecheCm[1] / g.flaecheCm[0]);
    const druckWinkel = 2 * Math.PI * g.flaecheCm[0] / (g.umfangCm || 25.8);          // wie viel vom Umfang der Druck bedeckt
    const zyl = zylinderAusBox(box);
    // Der Rundlauf liegt gegenueber dem Henkel, der freie Streifen um den Henkel. Von vorn sieht
    // man also nicht die Mitte des Rundlaufs, sondern das Stueck von der linken Silhouette bis
    // kurz vor den Henkel. Ein freistehendes Motiv kommt in die Mitte DIESES Fensters - so, wie
    // es der Kunde spaeter in der Hand sieht; ein randloses fuellt ohnehin alles.
    const henkel = typeof zyl.henkelWinkel === 'number' ? zyl.henkelWinkel : Math.PI / 2;
    const frei = (2 * Math.PI - druckWinkel) / 2;
    const links = Math.max(-Math.PI / 2, henkel + frei - 2 * Math.PI), rechts = Math.min(Math.PI / 2, henkel - frei);
    const fensterMitte = (links + rechts) / 2;
    let d = fensterMitte - (henkel - Math.PI); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    const mitteX = Math.min(1, Math.max(0, 0.5 + d / druckWinkel));
    const maxBreite = Math.max(0.2, (rechts - links) / druckWinkel);   // nicht breiter als das sichtbare Fenster
    let ganz = await flaecheMitMotiv(quelle, ganzW, ganzH, { randlos, deckend, flagge, mitteX, maxBreite });
    // 22. Sept.: Bei einem RANDLOSEN Rundumdruck fuellt das Design den ganzen Streifen - seine
    // Mitte laege dann an der linken Silhouette, und von vorn saehe man den Rand des Designs.
    // (Der Druck sitzt fest gegenueber dem Henkel; drehen laesst er sich nicht.) Also wird der
    // STREIFEN zyklisch verschoben, bis seine Mitte im sichtbaren Fenster liegt - die Naht
    // wandert damit an den Henkel, wo sie hingehoert. Ein eingepasstes Motiv steht ueber mitteX
    // schon richtig, hier passiert nichts.
    if (randlos && Math.abs(mitteX - 0.5) > 0.01) {
      const v = ((Math.round((mitteX - 0.5) * ganzW) % ganzW) + ganzW) % ganzW;
      if (v > 0 && v < ganzW) {
        const links = await sharp(ganz).extract({ left: 0, top: 0, width: ganzW - v, height: ganzH }).png().toBuffer();
        const rechts = await sharp(ganz).extract({ left: ganzW - v, top: 0, width: v, height: ganzH }).png().toBuffer();
        ganz = await sharp({ create: { width: ganzW, height: ganzH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: rechts, left: 0, top: 0 }, { input: links, left: v, top: 0 }]).png().toBuffer();
      }
    }
    const rand = Math.max(0, ((g.hoeheCm || g.flaecheCm[1]) - g.flaecheCm[1]) / 2 / (g.hoeheCm || g.flaecheCm[1]));   // unbedruckt oben und unten
    const gewoelbt = await zylindrisch(ganz, zyl, { druckWinkel, randOben: rand, randUnten: rand, template });
    const ebene = [{ input: gewoelbt, left: 0, top: 0, blend: 'over' }];
    if (watermark) ebene.push({ input: Buffer.from(`<svg width="1024" height="1024"><style>text{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:#000;fill-opacity:.18}</style><text x="50%" y="52%" font-size="54" text-anchor="middle" transform="rotate(-28 512 512)">MOTTO OTTO - VORSCHAU</text></svg>`) });
    return sharp(template).composite(ebene).jpeg(jpgOpt).toBuffer();
  }
  // Ruecken: der Druck liegt auf dem gewoelbten Ruecken (rueckenWoelben) - mittig auf der Rueckenachse ihrer
  // Hoehe (SZENE_RUECKEN_ACHSE), zu den Seiten hin gestaucht, die Zeilen leicht gebogen.
  const achse = ruecken ? SZENE_RUECKEN_ACHSE[szeneForm] : null;
  if (achse && achse.length > 1 && ruecken.halbe) {
    const ax = (y) => {
      if (y <= achse[0][0]) return achse[0][1];
      for (let i = 1; i < achse.length; i++) if (y <= achse[i][0]) { const [y0, x0] = achse[i - 1], [y1, x1] = achse[i]; return x0 + (x1 - x0) * (y - y0) / (y1 - y0); }
      return achse[achse.length - 1][1];
    };
    const roh = await sharp(art).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const axV = (y) => ax(y) + RUECKEN_VERSATZ_CM * rueckenPxCm;
    const w = rueckenWoelben(roh.data, roh.info.width, roh.info.height, { top, ax: axV, r: rueckenRadius(ruecken.halbe), hor: ruecken.kragen + ruecken.laenge * RUECKEN_WOELBUNG.horizont });
    art = await sharp(w.data, { raw: { width: w.width, height: w.height, channels: 4 } }).png().toBuffer();
    left = w.left; top = w.top;
    am = await sharp(art).metadata();
  }
  // Auf farbigem Stoff liegt der Druck deckend (DTF mit weissem Unterdruck) - multiply wuerde ihn einfaerben.
  const blendArt = color === 'white' && print === 'hell' && !farbe ? 'multiply' : 'over';
  let artStoff = themaSzene ? await stoffSchatten(art, template, left, top, blendArt === 'multiply' ? 1.2 : 2.2) : art;
  // 2. Okt.: der Ruecken im Hoechstmass reichte in der Abi-Szene ueber den haengenden Arm - eine Welle
  // auf der Haut. Gedruckt wird nur, wo Stoff ist (stoffMaske), nie auf Arm, Haar oder Hintergrund.
  if (themaSzene) {
    const maske = await stoffMaske(dir, szeneForm, left, top, artStoff);
    if (maske) artStoff = await sharp(artStoff).composite([{ input: maske, blend: 'dest-in' }]).png().toBuffer();
  }
  const layers = [{ input: artStoff, left, top, blend: blendArt }];

  // Bemassung: eine Linie unter dem Motiv fuer die Breite, eine rechts daneben fuer die Hoehe.
  // Nur wenn das Mass wirklich bekannt ist und das Motiv gross genug, damit die Zahlen lesbar
  // bleiben - bei einem Brustlogo von drei Zentimetern waere die Bemassung groesser als das Logo.
  // masstabEcht: nur bemassen, wenn das Motiv auch in seinem echten Verhaeltnis gezeichnet ist.
  // Sonst stehen Bild und Zahl gegeneinander - und man glaubt dem Bild.
  // Und nur auf dem BESTELLTEN Teil: auf einem anderen waere die Zahl eine Hochrechnung, die
  // niemand bestellt hat - und sie widerspraeche der Zeile unter dem Bild. Wurde gar kein
  // Artikel gewaehlt, ist das gemessene Motiv die einzige Wahrheit, die es gibt.
  // 20. Sept., Markus: "Die Masse sind wieder mit auf dem Motiv. Das soll nicht sein." Die gelben
  // Masslinien kommen deshalb NUR noch, wenn jemand sie ausdruecklich bestellt (masse: true) -
  // im Kundenbild, auf der Startseite und in der Stil-Galerie bleibt das Teil sauber. Was der
  // Kunde bekommt, steht als Zahl unter dem Bild ("Textil · 30 x 35 cm"), nicht im Bild.
  const massErlaubt = !opts.artikel || eigen;
  if (opts.masse === true && !szene && masstabEcht && massErlaubt && motivCm && am.width >= 120 && am.height >= 120) {
    const cm = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
    const b = cm(motivCm[0]), h = cm(motivCm[1]);
    const x1 = left, x2 = left + am.width, y1 = top, y2 = top + am.height;
    const ab = 18;                                   // Abstand der Masslinie zum Motiv
    const my = Math.min(1006, y2 + ab), mx = Math.min(1006, x2 + ab);
    const svg = Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
<style>
  .l{stroke:#ffc542;stroke-width:2.5;stroke-linecap:round}
  .h{stroke:#ffc542;stroke-width:1.5;stroke-dasharray:4 5;opacity:.85}
  .t{font-family:Arial,Helvetica,sans-serif;font-size:21px;font-weight:700;fill:#ffc542;
     paint-order:stroke;stroke:#14131a;stroke-width:4.5;stroke-linejoin:round}
</style>
<path class="h" d="M${x1} ${y2} V${my + 6} M${x2} ${y2} V${my + 6}"/>
<path class="l" d="M${x1} ${my} H${x2} M${x1} ${my - 5} V${my + 5} M${x2} ${my - 5} V${my + 5}"/>
<text class="t" x="${(x1 + x2) / 2}" y="${my + 24}" text-anchor="middle">${b} cm</text>
<path class="h" d="M${x2} ${y1} H${mx + 6} M${x2} ${y2} H${mx + 6}"/>
<path class="l" d="M${mx} ${y1} V${y2} M${mx - 5} ${y1} H${mx + 5} M${mx - 5} ${y2} H${mx + 5}"/>
<text class="t" x="${mx + 10}" y="${(y1 + y2) / 2}" text-anchor="start" dominant-baseline="middle">${h} cm</text>
</svg>`);
    layers.push({ input: svg });
  }

  if (watermark) {
    const svg = Buffer.from(`<svg width="1024" height="1024">
<style>text{font-family:Arial,Helvetica,sans-serif;font-weight:700;fill:#000;fill-opacity:.18}</style>
<text x="50%" y="52%" font-size="54" text-anchor="middle" transform="rotate(-28 512 512)">MOTTO OTTO - VORSCHAU</text>
</svg>`);
    layers.push({ input: svg });
  }

  return sharp(template).composite(layers).jpeg(jpgOpt).toBuffer();
}
