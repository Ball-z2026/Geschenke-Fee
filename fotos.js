// fotos.js - Motto Otto: Kundenfotos
// -----------------------------------------------------------------------------
// Entscheidung Markus, 13. Sept. 2026: "Wenn Kunden ihr eigenes Foto hochladen moechten,
// koennen wir natuerlich das originale verbauen oder es wird in dem Stil nachgebaut."
// Also zwei Wege, wie beim Logo-Upload - und der Kunde waehlt.
//
//   original    Das Foto wird UNVERAENDERT in die Druckdatei gesetzt. Es geht nie durch
//               das Bildmodell. Das Modell baut nur die Umgebung, das Foto wird danach
//               hineinkomponiert. Nur so bekommt der Kunde WIRKLICH sein Foto.
//   nachgebaut  Das Foto geht als Vorlage in edit_ballz_image und kommt im gewaehlten
//               Stil zurueck. Das Ergebnis AEHNELT dem Foto, ist aber ein neues Bild.
//
// Der Unterschied muss dem Kunden vor dem Bezahlen klar sein, sonst gibt es Reklamationen.

import sharp from 'sharp';

export const FOTO_MODUS = {
  original: {
    label: 'Mein Foto so einsetzen',
    erklaerung: 'Dein Foto kommt genau so auf den Artikel, wie du es hochgeladen hast. Drumherum bauen wir das Design.',
    durchsBildmodell: false
  },
  nachgebaut: {
    label: 'Mein Foto im gewaehlten Stil nachzeichnen',
    erklaerung: 'Wir zeichnen dein Foto im gewaehlten Stil nach. Das Ergebnis sieht deinem Foto aehnlich, ist aber eine Zeichnung - keine Fotokopie.',
    durchsBildmodell: true
  }
};

// ---------- Aufloesung pruefen --------------------------------------------------
// Der haeufigste Reklamationsgrund bei Fotoartikeln: ein Handyfoto aus WhatsApp auf
// einer 60x40-Flaeche. Deshalb wird VOR der Bestellung gerechnet, nicht danach.
export const FOTO_DPI = { gut: 300, grenzwertig: 150, minimum: 100 };

// Nachzeichnen ist etwas ganz anderes als Einsetzen. Beim Einsetzen gehen die Pixel des
// Fotos direkt in den Druck - dort zaehlen dpi. Beim Nachzeichnen ist das Foto nur VORLAGE:
// das Bildmodell malt das Motiv neu, in voller Druckaufloesung. Die Aufloesung der Vorlage
// entscheidet dann nur darueber, ob wir auf dem Foto genug ERKENNEN, um es nachzuzeichnen.
// Fassung 73 (Markus, 17. Sept.: "er schreibt die dpi Zahlen, die definitiv nicht stimmen
// koennen"): vorher wurde beim Nachzeichnen sogar STRENGER gerechnet als beim Einsetzen
// (anteil 1 statt 0,55) - ein Handyfoto scheiterte an einer Rechnung, die fuer diesen Weg
// gar keine Bedeutung hat. Das Bildmodell bekommt die Vorlage ohnehin auf gut 1000 Pixel.
export const FOTO_VORLAGE_PX = { gut: 900, grenzwertig: 600, minimum: 400 };

export async function pruefeFoto(buffer, zielCm, opts = {}) {
  const m = await sharp(buffer).metadata();
  if (!m.width || !m.height) return { ok: false, grund: 'Datei ist kein lesbares Bild' };

  if (opts.vorlage) {
    const kurz = Math.min(m.width, m.height);
    const stufe = kurz >= FOTO_VORLAGE_PX.gut ? 'gut'
      : kurz >= FOTO_VORLAGE_PX.grenzwertig ? 'grenzwertig'
      : kurz >= FOTO_VORLAGE_PX.minimum ? 'schwach' : 'zu_klein';
    const mass = `${m.width} × ${m.height} Pixel`;
    const text = {
      gut: 'Das Foto reicht als Vorlage.',
      grenzwertig: `Das Foto ist etwas klein (${mass}). Als Vorlage reicht es, sehr feine Details koennen dabei verloren gehen.`,
      schwach: `Das Foto ist klein (${mass}). Gesichter und feine Details erkennen wir darauf kaum - das Ergebnis wird entsprechend ungenau.`,
      zu_klein: `Das Foto ist zu klein (${mass}). Darauf erkennen wir zu wenig, um damit zu arbeiten. Bitte ein groesseres Foto - das Original vom Handy, nicht die WhatsApp-Version.`
    }[stufe];
    return { ok: stufe !== 'zu_klein', stufe, text, vorlage: true, px: [m.width, m.height], format: m.format, hatAlpha: !!m.hasAlpha };
  }

  // Wie gross soll das Foto auf dem Artikel werden? Standard: die ganze Flaeche.
  const anteil = Math.min(1, Math.max(0.05, opts.anteil || 1));
  const [bCm, hCm] = zielCm;
  const zielB = bCm * anteil, zielH = hCm * anteil;

  // Das Foto wird formatfuellend eingepasst, also zaehlt die knappere Achse.
  const dpiB = m.width / (zielB / 2.54);
  const dpiH = m.height / (zielH / 2.54);
  const dpi = Math.floor(Math.min(dpiB, dpiH));

  const stufe = dpi >= FOTO_DPI.gut ? 'gut'
    : dpi >= FOTO_DPI.grenzwertig ? 'grenzwertig'
    : dpi >= FOTO_DPI.minimum ? 'schwach' : 'zu_klein';

  const text = {
    gut: 'Das Foto reicht fuer diese Groesse.',
    grenzwertig: `Das Foto hat ${dpi} dpi bei dieser Groesse. Aus normalem Abstand geht das, aus der Naehe sieht man es leicht.`,
    schwach: `Das Foto hat nur ${dpi} dpi bei dieser Groesse. Der Druck wird sichtbar weich. Ein groesseres Foto oder ein kleinerer Artikel waere besser.`,
    zu_klein: `Das Foto hat nur ${dpi} dpi bei dieser Groesse - das reicht nicht. Bitte das Originalfoto hochladen, nicht die WhatsApp-Version.`
  }[stufe];

  return {
    ok: stufe !== 'zu_klein',
    stufe, dpi, text,
    px: [m.width, m.height],
    zielCm: [+zielB.toFixed(1), +zielH.toFixed(1)],
    format: m.format,
    hatAlpha: !!m.hasAlpha,
    // Empfehlung, welche Pixelzahl das Foto haben sollte
    empfohlenPx: [Math.round(zielB / 2.54 * FOTO_DPI.gut), Math.round(zielH / 2.54 * FOTO_DPI.gut)]
  };
}

// ---------- Weg "original": Foto in die Druckdatei setzen ------------------------
// Das Motiv kommt vom Bildmodell MIT einer freien Flaeche (wie beim Logo), das Foto
// wird danach hineingesetzt. Kein Keying, keine Neuberechnung - Pixel bleiben Pixel.
export async function fotoEinsetzen(motivBuffer, fotoBuffer, opts = {}) {
  const ziel = await sharp(motivBuffer).metadata();
  const W = ziel.width, H = ziel.height;

  // Bereich in Anteilen der Leinwand: { left, top, width, height }, je 0..1
  const b = opts.bereich || { left: 0, top: 0, width: 1, height: 1 };
  const x = Math.round(b.left * W), y = Math.round(b.top * H);
  const w = Math.max(1, Math.round(b.width * W)), h = Math.max(1, Math.round(b.height * H));

  let foto = sharp(fotoBuffer).rotate();          // EXIF-Drehung mitnehmen
  foto = foto.resize({ width: w, height: h, fit: opts.fit || 'cover', position: opts.position || 'centre' });

  // Runde oder abgerundete Ausschnitte kommen als Maske dazu - sauberer als ein
  // gemalter Rahmen, weil die Kante dann wirklich am Pixel sitzt.
  if (opts.form === 'kreis' || opts.form === 'abgerundet') {
    const r = opts.form === 'kreis' ? Math.min(w, h) / 2 : Math.round(Math.min(w, h) * 0.08);
    const maske = Buffer.from(opts.form === 'kreis'
      ? `<svg width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#fff"/></svg>`
      : `<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
    foto = sharp(await foto.png().toBuffer())
      .composite([{ input: maske, blend: 'dest-in' }]);
  }

  return sharp(motivBuffer)
    .composite([{ input: await foto.png().toBuffer(), left: x, top: y }])
    .png({ compressionLevel: 9 }).toBuffer();
}

// ---------- Prompt-Bausteine ------------------------------------------------------

// Weg "original": das Bildmodell muss die Flaeche FREI lassen und das Motiv darum bauen.
// Gleiches Prinzip wie beim Logo - die Flaeche ist das Herz, nicht ein Loch am Rand.
export function fotoZonePrompt(anteil = 0.55, form = 'rechteck') {
  const formText = {
    kreis: 'a clean circle',
    abgerundet: 'a rectangle with softly rounded corners',
    rechteck: 'a plain rectangle'
  }[form] || 'a plain rectangle';
  const pct = Math.round(anteil * 100);
  return `THE DESIGN IS BUILT AROUND A PHOTOGRAPH that is placed into it afterwards as a real file. Reserve ${formText} covering about ${pct} percent of the canvas and leave it COMPLETELY EMPTY - no colour, no pattern, no frame drawn inside it, nothing crossing into it. Grow the composition out of that shape so it looks like the heart of the design, never a gap left over at an edge. Decoration, lettering and ornament sit around it.`;
}

// Weg "veraendert" (19. Okt., Markus, Freestyle: "ein Foto hochzuladen oder eine Datei, so dass diese geaendert
// werden kann"): das Foto geht in die Bild-Bearbeitung, und der Wunsch des Kunden sagt, WAS sich aendert.
// Alles, was er nicht nennt, bleibt wie im Foto - es bleibt ein Foto, keine Zeichnung.
export function fotoAendernPrompt(wunsch) {
  const w = String(wunsch || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
  return [
    'This is the customer\'s own photograph. Change it exactly as the customer asks, in their own words:',
    `"${w}"`,
    'Everything the customer did not mention stays as it is in the photo: the same people and animals with the same faces, the same pose, framing and lighting, the same photographic look - the result is still a photograph, not a drawing or a painting, unless the customer asks for one.',
    'Do not add any text, logo, watermark, border or frame. Do not crop away the subject.'
  ].join('\n');
}

// Weg "nachgebaut": das Foto geht als Vorlage in die Bild-Bearbeitung.
export function nachbauPrompt(stilText, opts = {}) {
  const teile = [
    'Redraw the supplied photograph completely by hand in the art style described below. This is a drawing made after the photo, not a filtered photo: every surface is redrawn, no photographic texture survives.',
    opts.person
      // 21. Sept., Markus: "dass es nicht das Foto genommen ist mit dem, was ich da anhabe" -
      // die Kleidung ist Teil der Person: was im Foto getragen wird, wird gezeichnet, nichts anderes.
      ? 'Keep the people and animals in the photo clearly recognizable - same faces, same posture, same proportions, same coat or hair colour, same glasses, beard and hairstyle. Draw them in EXACTLY the clothes they wear in the photo - the same garments, cut, colours and patterns; never re-dress them, never invent a different outfit, hat or accessory. Recognizability comes before stylistic freedom.'
      : 'Keep the subject clearly recognizable - same shapes, same proportions, same colours.',
    // 21. Sept., Markus: "Wir muessen sogar den Hintergrund nehmen!!! spaetestens dann, wenn jemand
    // im Stadion ein Foto macht." Bei der Postkarte (umgebung: true) ist der Hintergrund des
    // Fotos der Ort selbst - er bleibt. Bei Shirt-Motiven faellt er weg wie bisher.
    opts.umgebung
      ? 'KEEP THE SURROUNDINGS OF THE PHOTO: the picture was taken at the very place the card is about - its background (stadium, street, houses, beach, landscape, whatever the photo shows) is the real place and must appear on the card, redrawn in the same style, as it is in the photo. Never replace it with invented scenery. Only the weather and the light may be improved to postcard weather - sunshine, blue sky, warm light - the place itself stays exactly as photographed.'
      : 'Drop the photographic background unless it is named as important; replace it with the plain treatment the style calls for.'
  ];
  if (stilText) teile.push(`ART STYLE (mandatory): ${stilText}`);
  return teile.join('\n');
}

// ---------- Stufe 1 der Postkarte: Otto malt das Foto ------------------------------
//
// 24. Sept., Markus: "Die Person beziehungsweise Personen auf dem Foto sollen in dem jeweiligen
// Stil ebenfalls mit nach gemalt werden."
//
// Gemessen an einer echten Aquarellkarte aus Harmstorf: die Karte war ringsum gemalt, die beiden
// Menschen waren ein unveraendertes Foto, mitten hineingeklebt. Im Auftrag stand zweimal und in
// Grossbuchstaben, dass NICHTS auf der Karte ein Foto sein darf. Es half nichts - und der Grund
// ist keine Formulierung, sondern die Bauweise: Das Kundenfoto ist das EINGANGSBILD der
// Bildbearbeitung. Das Modell haelt daran fest, wo es kann, und am staerksten am Gesicht. Gegen
// gelieferte Pixel verliert jeder Satz.
//
// Also wird es in zwei Schritten gemalt, und der erste hat nur eine Aufgabe:
//   Stufe 1 - aus dem Foto wird ein Bild im gewaehlten Stil (dieser Auftrag hier).
//   Stufe 2 - die Karte entsteht aus diesem GEMALTEN Bild; ein Foto ist dann nirgends mehr im Spiel.
// Nachgemessen: Stufe 1 allein liefert Aquarell mit sichtbarem Pinselstrich, nassen Raendern und
// durchscheinendem Papier - und die Leute bleiben erkennbar, samt Brille, Bart und Jacke.
export function fotoNachmalenPrompt({ stilText = '', figurenText = '', umgebung = false } = {}) {
  const teile = [
    'Redraw this entire photograph completely by hand in the technique described below - the people, their clothes, and everything around them alike. This is a picture PAINTED after the photo, not a filtered photo: every single surface is drawn again with the marks of that technique. No photographic skin, no photographic hair, no photographic fabric, no photographic foliage, no photographic sky anywhere. IF ANY SQUARE CENTIMETRE OF THE RESULT COULD BE MISTAKEN FOR AN UNTOUCHED PHOTOGRAPH, THE PICTURE IS WRONG.',
    // Die Aehnlichkeit ist das, was die Karte wertvoll macht - sie steht vor der Stilfreiheit.
    //
    // 24. Sept., gemessen: Mit dem Wunsch "Karikatur" kam zweimal hintereinander keine Karikatur
    // heraus, sondern ein braves, sehr genaues Portraet. Der Grund stand hier: "same faces, same
    // posture and proportions" und "oversized heads on small bodies, strongly exaggerated features"
    // sind derselbe Auftrag mit zwei entgegengesetzten Vorzeichen - und das Modell loest so einen
    // Widerspruch immer zugunsten des Eingangsbildes auf. Also wird die Aehnlichkeit umgehaengt,
    // sobald eine Figurenart gewaehlt ist: sie haengt dann an den Kennzeichen (Haar, Bart, Brille,
    // Kleidung, Ausdruck), nicht an den Proportionen - denn genau die soll die Figurenart ja biegen.
    figurenText
      ? 'Every person and every animal from the photo appears, and each one stays unmistakably THAT person: the same hair, the same beard, the same glasses, the same expression, the same number of people in the same order - and EXACTLY the clothes they wear in the photo, the same garments, the same cut, the same colours and patterns. Never re-dress anyone, never invent an outfit, a hat or a bag, never add a person who is not in the photo and never leave one out. Their PROPORTIONS, however, belong to the drawing style ordered below and may be pushed as far as that style demands - that is what was asked for.'
      : 'Keep every person and every animal in the photo clearly recognisable: same faces, same expressions, same posture and proportions, same hair, same beard, same glasses. Draw them in EXACTLY the clothes they wear in the photo - the same garments, the same cut, the same colours and patterns. Never re-dress anyone, never invent an outfit, a hat or a bag, never add a person who is not in the photo and never leave one out. Someone who knows them must recognise them at once.',
    umgebung
      // 21. Sept., Markus: "Wir muessen sogar den Hintergrund nehmen!!!" Auf der Postkarte ist
      // der Hintergrund des Selfies das echteste Bild vom Ort - er bleibt, nur das Wetter wird besser.
      ? 'Keep the place exactly as photographed: the same houses, the same roofs, the same street, the same hedge, the same trees, the same landscape - painted, but unchanged in shape and arrangement. Invent nothing and leave nothing out. The ONE thing you improve is the weather: a grey or overcast sky becomes bright postcard weather - blue sky, a few white clouds, warm sunlight and soft shadows.'
      : 'Keep the background only where it belongs to the subject; otherwise leave it plain and let the technique decide what fills it.'
  ];
  // Markus, 24. Sept.: "Vielleicht waere es da sogar hilfreich, dass wir ein Teil unserer Menschen
  // ... dort mit einbinden und da lustige Sachen erzeugen koennen." Die Figurenwahl greift GENAU
  // hier - an der Stelle, an der der Mensch entsteht, nicht irgendwo im Kartenauftrag.
  if (figurenText) teile.push('HOW THE PEOPLE ARE DRAWN - this is a firm order from the customer, not a suggestion, and it OVERRULES any wish to stay close to the photograph\'s shapes: ' + figurenText + ' Push it far enough that anyone can see at a glance which drawing style was chosen. What stays untouched are the marks that say who they are: hair, beard, glasses, expression, and their own clothes in their own colours.');
  if (stilText) teile.push('THE TECHNIQUE (mandatory, for the whole picture): ' + stilText);
  return teile.join('\n\n');
}

// Die Ausnahme von "recognizable people" steht in mottos.js, weil buildPrompt sie setzt.
// Hier nur weitergereicht, damit man sie nicht an zwei Stellen pflegt.
export { FOTO_AUSNAHME } from './mottos.js';

// =============================================================================
// Fassung 26: Personenfotos werden NICHT gespeichert
// -----------------------------------------------------------------------------
// Entscheidung Markus, 13. Sept. 2026: Es gibt einen Knopf, der fragt, ob das Design
// gefaellt. Sobald der Kunde ja sagt, wird das Gesichtsfoto SOFORT geloescht - und
// genau so wird es ihm auch erklaert.
//
// Warum das aufgeht: Das Foto wird nur so lange gebraucht, wie noch ein neuer Versuch
// moeglich ist. Sagt der Kunde ja, ist die Druckdatei gebaut und das Rohfoto hat keinen
// Zweck mehr. Sagt er nein, bleibt es fuer den naechsten Versuch.
//
// Drei Regeln, die dabei nicht verhandelbar sind:
//   1. Das Foto beruehrt NIE die Festplatte. Nur Arbeitsspeicher, nie STORAGE_DIR,
//      nie das Railway-Volume, nie Drive.
//   2. Vor dem Loeschen wird die Druckdatei in voller Aufloesung gebaut. Erst danach
//      faellt das Foto weg - sonst ist die Reihenfolge falsch und der Kunde hat nichts.
//   3. Auch ohne Antwort verschwindet es: harte Frist, plus weg bei jedem Neustart.

const FOTO_SPEICHER = new Map();          // sitzungsId -> [ { buffer, mime, abgelegt, name }, ... ]
export const FOTO_FRIST_MS = 60 * 60 * 1000;   // eine Stunde ohne Antwort, dann weg
export const FOTO_MAX_MB = 25;

// 26. Sept., Markus: "Wenn wir durch den Standort erkennen, dass jemand an einer Privatadresse
// ist, sollte es die Moeglichkeit geben, bis zu fuenf Fotos hochzuladen."
// Bis dahin hielt eine Sitzung GENAU EIN Foto ("ein Foto je Sitzung, kein Sammeln"). Jetzt haelt
// sie eine kurze Liste - hoechstens FOTOS_MAX, und das Selfie bleibt Nummer eins. An der
// Hausregel aendert sich nichts: alles liegt im Arbeitsspeicher, eine Stunde, dann weg.
// fotoHolen() gibt weiterhin EIN Foto zurueck (das erste) - jeder alte Aufrufer bleibt richtig.
export const FOTOS_MAX = 5;

export function fotoAblegen(sitzungsId, buffer, opts = {}) {
  if (!sitzungsId) throw new Error('fotoAblegen ohne Sitzung');
  const mb = buffer.length / 1024 / 1024;
  if (mb > FOTO_MAX_MB) return { ok: false, grund: `Das Foto ist ${mb.toFixed(1)} MB gross, erlaubt sind ${FOTO_MAX_MB} MB.` };
  const bisher = opts.dazu ? (fotosHolen(sitzungsId) || []) : [];
  if (bisher.length >= FOTOS_MAX) return { ok: false, grund: `Mehr als ${FOTOS_MAX} Fotos gehen nicht auf eine Karte.` };
  if (!opts.dazu) fotoLoeschen(sitzungsId);     // ein neues Selfie ersetzt die ganze Sitzung
  // motiv: was das Sehmodell auf DIESEM Bild erkannt hat (ein Wort aus der Liste in
  // FOTO_INHALT_FRAGE).
  const eintrag = { buffer, mime: opts.mime || 'image/jpeg', name: opts.name || 'foto', motiv: String(opts.motiv || ''), abgelegt: Date.now() };
  FOTO_SPEICHER.set(sitzungsId, bisher.concat([eintrag]));
  return { ok: true, laeuftAbUm: Date.now() + FOTO_FRIST_MS, anzahl: bisher.length + 1, platzFrei: FOTOS_MAX - bisher.length - 1 };
}

/** ALLE Fotos der Sitzung, in der Reihenfolge des Hochladens. Leer oder abgelaufen: null. */
export function fotosHolen(sitzungsId) {
  const liste = FOTO_SPEICHER.get(sitzungsId);
  if (!liste || !liste.length) return null;
  // Die Frist gilt fuer die Sitzung, nicht fuer das einzelne Bild: wer sein zweites Foto
  // nachreicht, soll nicht das erste verlieren. Gemessen wird am AELTESTEN.
  if (Date.now() - liste[0].abgelegt > FOTO_FRIST_MS) { fotoLoeschen(sitzungsId); return null; }
  return liste;
}

export function fotoHolen(sitzungsId) {
  const liste = fotosHolen(sitzungsId);
  return liste ? liste[0] : null;
}

// Ueberschreiben vor dem Freigeben: der Puffer soll nicht als Leiche im Speicher liegen,
// bis der Garbage Collector vorbeikommt.
export function fotoLoeschen(sitzungsId) {
  const liste = FOTO_SPEICHER.get(sitzungsId);
  if (!liste) return false;
  for (const e of liste) { try { e.buffer.fill(0); } catch { /* egal, Hauptsache raus aus der Map */ } }
  FOTO_SPEICHER.delete(sitzungsId);
  return true;
}

export function fotoAufraeumen() {
  const jetzt = Date.now();
  let n = 0;
  for (const [id, liste] of FOTO_SPEICHER) if (liste.length && jetzt - liste[0].abgelegt > FOTO_FRIST_MS) { fotoLoeschen(id); n++; }
  return n;
}

// Im Server einmal starten: setInterval(fotoAufraeumen, 5 * 60 * 1000).unref()
export function fotoStatus() {
  let bilder = 0; for (const liste of FOTO_SPEICHER.values()) bilder += liste.length;
  return { imSpeicher: FOTO_SPEICHER.size, bilder, fristMinuten: FOTO_FRIST_MS / 60000 };
}

// ---------- Der Knopf ------------------------------------------------------------
// "Gefaellt dir das Design?" - Ja baut die Druckdatei fertig und loescht das Foto.
export async function designFreigeben(sitzungsId, { motivBuffer, bereich, form, entwurf }) {
  const e = fotoHolen(sitzungsId);
  if (!e) return { ok: false, grund: 'Das Foto ist nicht mehr da - die Sitzung ist abgelaufen. Bitte noch einmal hochladen.' };

  // Reihenfolge ist entscheidend: erst die fertige Datei, dann loeschen.
  const druckdatei = await fotoEinsetzen(motivBuffer, e.buffer, { bereich, form });
  const geloescht = fotoLoeschen(sitzungsId);

  return {
    ok: true, druckdatei, fotoGeloescht: geloescht,
    entwurf: entwurf || null,
    protokoll: {
      sitzung: sitzungsId, zeit: new Date().toISOString(),
      ereignis: 'Design freigegeben, Originalfoto geloescht'
    }
  };
}

// Ablehnen: Foto bleibt, der Kunde will einen neuen Versuch.
export function designAblehnen(sitzungsId) {
  const e = fotoHolen(sitzungsId);
  return { ok: true, fotoNochDa: !!e,
    hinweis: e ? 'Dein Foto liegt noch fuer den naechsten Versuch bereit.'
               : 'Dein Foto ist abgelaufen. Bitte noch einmal hochladen.' };
}

// ---------- Ist ueberhaupt drauf, was drauf sein soll? ----------------------------
//
// Markus, 26. September: "Wenn jemand ein Foto hochlaedt, sollten wir schon erkennen koennen,
// dass auch ein Mensch da drauf ist oder ein Tier - jetzt gerade einfach ne Datei hochgeladen,
// und er erkennt das an."
//
// Nachgestellt, bevor hier etwas geaendert wurde: ein graues Rechteck mit der Aufschrift
// "Rechnung 2026-0815" als PNG an /api/mo/foto - Antwort HTTP 200, "Das Foto reicht fuer diese
// Groesse." Geprueft wurde bis dahin nur, ob es eine LESBARE Bilddatei ist und ob die Pixel fuer
// das Mass reichen. WAS darauf zu sehen ist, hat nie jemand angesehen.
//
// Fuer die Postkarte ist das kein Schoenheitsfehler: Stufe 1 malt "die Person aus Bild 1" im
// gewaehlten Stil. Ist dort keine Person, malt sie irgendetwas - und der Kunde merkt es erst an
// der fertigen Karte, also nach sechs Minuten Wartezeit und einer Bezahlung.
//
// Die Frage stellt der Server dem Sehmodell (server.js, fotoZeigtMotiv) - hier steht die
// FRAGE und die ENTSCHEIDUNG, damit beides ohne Netz nachpruefbar ist.
export const FOTO_INHALT_FRAGE = [
  'Look at this picture and say what is actually shown on it.',
  'We need to know whether it is a real photograph of living beings, because we are going to draw',
  'the people on it by hand.',
  '- mensch: is at least one REAL person visible - a face, a body, a group of people? A drawn',
  '  figure, a statue, a doll, a photo of a photo on a screen or a person on a poster is NOT a',
  '  real person here.',
  '- tier: is at least one real animal visible - dog, cat, horse, bird, and so on?',
  '- was: what the picture shows, in two or three German words ("Screenshot", "Dokument",',
  '  "Landschaft", "Zwei Menschen vor einem Haus").',
  // 26. Sept., Markus: "Per Bilderkennung erkennen - jemand fotografiert Blumen in seinem Garten,
  // dann eine Flower-Karte; sitzen die Leute beim Essen oder fotografiert man sein Essen, eine
  // Food-Karte - so dass das, was auf den Bildern ist, mit ins Design kommt."
  // Dafuer reicht der freie Text "was" nicht: daraus kann niemand rechnen. Also ein FESTES Feld
  // mit einer festen Liste - und "sonstiges", wenn nichts davon passt. Geraten wird nicht.
  '- motiv: choose EXACTLY ONE word from this list, whichever fits the picture best:',
  '  selfie (people posing for the camera), menschen (people, not posing),',
  '  essen (food or drink, no people), essen_mit_leuten (people eating or drinking together),',
  '  blumen_garten (flowers, a garden, plants), tier (an animal), feier (a party, a celebration,',
  '  a cake, balloons), landschaft (landscape, nature, a view), gebaeude (a building, a street,',
  // 27. Sept., Markus: "wenn jemand ein Foto macht mit seinem Auto, dann irgendwie was passend
  // zum Auto - und wenn jemand was mit seinem Motorrad oder mit seinem Fahrrad macht, dann was
  // passend zum Motorrad und Fahrrad." Drei Worte mehr in der festen Liste, drei Saetze mehr in
  // MOTIV_THEMA. Der Mensch NEBEN seinem Auto ist "auto", nicht "selfie" - das Fahrzeug ist der
  // Grund fuer das Foto.
  '  a town), auto (a car - someone posing with or beside their car counts as auto, not selfie),',
  '  motorrad (a motorcycle, someone with their motorcycle), fahrrad (a bicycle, someone with',
  '  their bicycle, a cycling tour), sonstiges (none of these fits).',
  'Answer ONLY with JSON: {"mensch":true|false,"tier":true|false,"was":"...","motiv":"...","grund":"one short sentence, German"}'
].join('\n');

/**
 * Was das Sehmodell geantwortet hat -> was der Kunde zu sehen bekommt.
 * @param antwort  {mensch,tier,was,uebersprungen} oder null
 * @param braucht  'mensch' | 'tier' | 'mensch_tier' | '' (leer = keine Pruefung)
 *
 * IM ZWEIFEL IMMER FUER DAS FOTO. Nur ein klares Nein auf ALLES, was gebraucht wird, haelt das
 * Foto auf. Ein Modell, das nicht antwortet, keinen Schluessel hat oder unlesbar antwortet, darf
 * niemandem sein Selfie verweigern - das waere der schlimmere Fehler.
 */
export function fotoInhaltBefund(antwort, braucht) {
  const b = String(braucht || '');
  if (!b || !antwort || antwort.uebersprungen) return { ok: true, geprueft: false };
  const mensch = antwort.mensch === true, tier = antwort.tier === true;
  // Nur ein ausdrueckliches false haelt auf; alles andere (true, fehlt, unlesbar) laesst durch.
  const ok = b === 'mensch' ? antwort.mensch !== false
    : b === 'tier' ? antwort.tier !== false
      : antwort.mensch !== false || antwort.tier !== false;
  if (ok) return { ok: true, geprueft: true, mensch, tier, was: String(antwort.was || '').slice(0, 60) };
  const was = String(antwort.was || '').trim().slice(0, 60);
  const gesehen = was ? ' Wir sehen darauf: ' + was + '.' : '';
  const gebraucht = b === 'tier'
    ? 'Für dieses Motto brauchen wir ein Foto deines Tieres.'
    : b === 'mensch'
      ? 'Für dieses Motto brauchen wir ein Foto von dir – gern mit allen, die dabei sind.'
      : 'Für dieses Motto brauchen wir ein Foto von dir oder deinem Tier – gern mit allen, die dabei sind.';
  return {
    ok: false, geprueft: true, mensch, tier, was,
    hinweis: 'Auf diesem Bild erkennen wir ' + (b === 'tier' ? 'kein Tier' : b === 'mensch' ? 'keinen Menschen' : 'weder einen Menschen noch ein Tier') + '.'
      + gesehen + ' ' + gebraucht + ' Bitte nimm ein anderes Foto.'
  };
}

// ---------- Was dem Kunden angezeigt wird -----------------------------------------
// Wortlaut gehoert hierher und nicht in die Seite, damit er nur an einer Stelle steht.
export const FOTO_TEXTE = {
  beimHochladen:
    'Dein Foto wird nicht gespeichert. Es liegt nur so lange bei uns, wie du an deinem Design arbeitest - '
    + 'und wird sofort gelöscht, sobald du sagst, dass dir das Design gefällt. Auf dem fertigen Design '
    + 'bleibt es natürlich, sonst könnten wir es nicht drucken.',
  frage: 'Gefällt dir dein Design?',
  jaKnopf: 'Ja, so ist es gut',
  jaErklaerung: 'Wir bauen die Druckdatei fertig und löschen dein Originalfoto sofort danach.',
  neinKnopf: 'Nein, noch mal',
  neinErklaerung: 'Dein Foto bleibt für den nächsten Versuch bei uns.',
  nachDemLoeschen:
    'Dein Originalfoto ist gelöscht. Es liegt nur noch in deinem fertigen Design. '
    + 'Wenn du später etwas ändern möchtest, das das Foto betrifft, lade es einfach noch einmal hoch.',
  abgelaufen:
    'Dein Foto ist nach einer Stunde automatisch gelöscht worden. Bitte lade es noch einmal hoch.',
  // 19. Okt., Freestyle: "ein Foto ... oder eine Datei" - eine PDF lesen wir hier nicht, das sagen wir so.
  pdf: 'Eine PDF können wir hier nicht lesen. Bitte speichere die Seite als JPG oder PNG (oder SVG) und lade sie noch einmal hoch.',
  aendernFehlgeschlagen: 'Dein Foto konnte gerade nicht verändert werden – das liegt nicht an dir. Bitte in ein paar Minuten noch einmal starten; dein Foto bleibt so lange bei uns.',
  // 21. Sept.: ein Neustart des Dienstes (z. B. eine neue Fassung) leert den Arbeitsspeicher - und
  // damit das Foto. Der Kunde bekam dann faelschlich "nach einer Stunde geloescht". Ehrlich sagen.
  nachNeustart:
    'Wir mussten den Dienst gerade kurz neu starten. Dabei ist dein Foto aus dem Arbeitsspeicher gelöscht worden - '
    + 'wir speichern es nie auf der Festplatte. Bitte lade es noch einmal hoch und starte neu; deine Angaben sind noch da.'
};
