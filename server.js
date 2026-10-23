import { PLACKEN_GRENZE, vollDeckend, farbWerte, besteFarbe, zeigbar, MESS_STAND, kleinFassung } from './brett.js';
import { TIER_MOTTO, tierDatei, leerDatei, tierSzeneBauen } from './tier-szene.js';
import express from 'express';
// Preise fuer die Artikelliste auf der Startseite. preise.cjs ist genau dafuer gebaut
// (Kopf der Datei: "Node: import preise from './preise.cjs'") - eine Quelle fuer Server und Browser.
import PREISE from './preise.cjs';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import sharp from 'sharp';
import OpenAI from 'openai';
import { customAlphabet } from 'nanoid';
import { generateViaBallz, editViaBallz } from './ballz.js';
import { szenenBegriff } from './szene-begriff.js';
import { mottoStore, buildPrompt, stilText, traegerFuer, hatMenschen, printedTexts, cleanValue, cleanLong, zeigeWennErfuellt, stripChars, publicView, fillPrompt, sanitizeMotto, STYLE_KEYS, STYLES, pickVariation, applyStyleOverrides, stylesForAdmin, PRINT_PLACEMENTS, MOODS, FIGUREN, FIGUREN_KEYS, figurenFuer, setGrundModus, setPromptFassung, PROMPT_FASSUNG, leinwandFuer, GRUND_MODUS, printRules, textilTon, istHell, TEXTILTOENE, textilFuerStil, textilFuerAuftrag, stilTextilTabelle, rueckseitePrompt, hatNamensliste, namensFeldFuer, palettePrompt, listeWortFuer, logoTraegerForm, BILD_STUFEN, stufeFuer, buchstabierBlock } from './mottos.js';
// Fassung 24: Otto Freestyle - der Artikel bestimmt Verfahren, Druckflaeche und Motivart
import { kaufwegPruefen, problemSchluessel } from './kaufweg-wache.js';
import { ARTIKEL, VERFAHREN, druckBlock, artikelLeinwand, artikelAuswahl, verkaufsfaehig, flaechenVon, katalogBericht, ansichtVon, ARTIKEL_ANSICHT } from './artikel.js';
import { druckLeinwand, wahlFlaeche, gruppenFoto, GRUPPENFOTO_FELDER, formatAusMass } from './mottos.js';

// Freie Groesse bei Textilien (Markus, 14. Sept.): "erstelle mir das Design in 8 x 8 cm fuer die
// Brust oder 25 breit und 10 hoch" - bei Textil bestimmt der Kunde die Flaeche, nicht die
// Platzierungsliste. Bei allen anderen Artikeln (Tasse, Brett, Matte) bleibt die Variante des
// Artikels das Mass, weil die Produktion sie vorgibt.
// 2. Okt., Markus: "Wir haben eine maximal Groesse von 38 cm mal 48 cm."
const FREI_CM = { min: 3, maxBreite: 38, maxHoehe: 48 };
function freieLeinwand(a, breiteCm, hoeheCm) {
  const b = Math.round(+breiteCm * 10) / 10, h = Math.round(+hoeheCm * 10) / 10;
  if (!(b >= FREI_CM.min && b <= FREI_CM.maxBreite && h >= FREI_CM.min && h <= FREI_CM.maxHoehe)) return null;
  const v = VERFAHREN[a.verfahren] || VERFAHREN.dtf;
  const zugabe = (v.beschnittMm * 2) / 10;
  const lw = druckLeinwand([b + zugabe, h + zugabe]);
  if (!lw) return null;
  const warnung = lw.dpi < 150 ? `Nur ${lw.dpi} dpi bei ${b}x${h} cm - fuer den Druck vektorisieren oder hochrechnen`
    : (lw.dpi < 300 ? `${lw.dpi} dpi - unter 300, bei diesem Betrachtungsabstand meist vertretbar` : null);
  return { ...lw, label: `${String(b).replace('.', ',')} × ${String(h).replace('.', ',')} cm`, netto: [b, h], brutto: [b + zugabe, h + zugabe], warnung };
}
// Der Artikel-Block fuer eine freie Groesse - derselbe Wortlaut wie druckBlock() in artikel.js,
// nur mit dem Mass des Kunden statt einer Katalogflaeche.
function freierDruckBlock(artikel) {
  const a = ARTIKEL[artikel.id]; const v = VERFAHREN[a.verfahren]; const lw = artikel;
  if (!a || !v) return '';
  const mmProPixel = (lw.brutto[0] * 10) / lw.px[0];
  const linie = Math.max(1, Math.ceil(v.minLinieMm / mmProPixel)), versal = Math.max(1, Math.ceil(v.minVersalMm / mmProPixel));
  const format = formatAusMass(lw.netto[0], lw.netto[1]);
  return [
    `PRODUCT: ${a.name}. Printed area ${lw.netto[0]} x ${lw.netto[1]} cm, ${{ breit: 'A WIDE HORIZONTAL BAND', quer: 'LANDSCAPE', quadrat: 'SQUARE', hoch: 'PORTRAIT' }[format] || 'LANDSCAPE'}.`,
    // 2. Okt., gemessen: bei 25 x 10 cm kam ein rundes Emblem von 9 bis 14 cm Breite heraus.
    ...(format === 'breit' ? [`THE ARTWORK FILLS THE WIDTH: it runs from the left margin to the right margin of this band, its elements side by side - never a round, square or upright emblem in the middle with bare fabric left and right of it. The empty quarter of the canvas lies BETWEEN and AROUND the elements, not as two empty side panels.`] : []),
    v.prompt + (a.motivart === 'vollflaechig' ? (v.promptVollflaechig || '') : (v.promptFreistehend || '')),
    `MINIMUM DETAIL at this size: no line thinner than ${linie} pixels and no capital letter shorter than ${versal} pixels in this image. Anything finer breaks in production.`,
    a.motivart === 'vollflaechig'
      ? 'FULL BLEED: the design covers the whole surface and runs off all four edges - no transparent areas, no empty margin, no free-standing emblem on a plain ground. Keep every text and every element that must survive at least 8 percent away from each edge, because the outer band is trimmed off.'
      : 'FREE-STANDING: the artwork is a shape with an irregular silhouette, never a filled rectangle or oval. At least a quarter of the canvas stays completely empty and the empty ground reaches between the elements, not only around them.'
  ].join('\n');
}
import { PRINT_DPI, makeMaster, kanteGlaetten, motivFreistellen, bandBelegt, makePreview, makePdf, whiteCheck, fuelleMessen, normalizeUpload, signPreview, describeColors, describeLogo, cutout, edgeCheck, dominantColors, ensureLogo, combineLogos, logoPrint, druckThumb, weisseFlaeche, pruefeSchwarzflaechen, pruefeDruckdatei, hatAlpha, pruefeDunkleFlaechen, findHole, logoLuecke, vergleichAbleiten, logoPreflight, makePdfVonSvg, druckMass, kantenLupe, logoVorlage, logoFindenForm, logoKopieEntfernen, platzhalterFinden, platzhalterLoeschen, platzhalterBild, platzhalterFarbe, platzhalterDeckung, logoSaumStanzen, logoZoneLegen, logoPlatzSuchen, flaecheBelegt, placeLogo, freeLogo, logoFreistellen, logoHatTransparenz, logoTrimmen, logoGrundlage, logoMaske, logoHelligkeit, platzFuerText, traegerBlob, logoInBlob, logoPlakette } from './images.js';

// Fassung 34: Wie breit soll die Logo-Flaeche sein? Der Motto-Wert (widthPct, meist 40) gilt fuer
// das Hochformat. Auf einem Querformat (Brustbanner 25 x 10 cm) waere ein Logo mit 40 % der
// Breite so hoch wie das ganze Motiv - dann bleibt kein Platz fuer Kopfzeile und Motiv, und das
// Modell malt die Schrift in die Flaeche. Also: hoechstens 62 % der Hoehe, daraus die Breite.
function logoAnteil(basisPct, genSize, logoAspect) {
  const [gw, gh] = String(genSize || '').split('x').map(Number);
  const basis = Math.min(Math.max(+basisPct || 38, 8), 90);
  if (!(gw > 0) || !(gh > 0)) return { pct: basis, hoehePct: 0 };
  const ratio = logoAspect > 0 ? 1 / logoAspect : 1;   // Hoehe / Breite des Logos
  const maxDurchHoehe = 0.62 * (gh / gw) / ratio * 100;
  const pct = Math.max(15, Math.round(Math.min(basis, maxDurchHoehe)));
  return { pct, hoehePct: Math.round(pct * ratio * gw / gh) };
}

// Fassung 27: Schwarz ist auf dunklem Textil das Shirt, keine Druckfarbe. Grosse schwarze
// Flaechen fliegen aus der Druckdatei - aber nur auf dunklem Stoff und nur beim freistehenden
// Druck; auf hellem Textil und bei randlosen Artikeln (Tasse, Matte) ist Schwarz echte Farbe.
// minDicke 8 statt der 6 aus dem Nachtrag: am echten Motiv gemessen (00k-ZUSATZ) haben Konturen
// bis 8 px Halbdicke - bei 6 wuerden die dicksten Konturen als "Flaeche" gelten und verschwinden.
function schwarzOpts(input) {
  const i = input || {};
  // Freestyle: nur bei DTF auf Textil. Auf einer Sublimationstasse oder einem UV-Brett ist
  // Schwarz eine echte Druckfarbe, die niemand aus der Datei rechnen darf.
  const textil = !i.artikel || i.artikel.verfahren === 'dtf';
  // Nur auf REINEM Schwarz: dort ersetzt der Stoff die Farbe. Auf einer dunklen Buntfarbe
  // (navy, flaschengruen) wuerde dieselbe Rechnung ein Loch hinterlassen, durch das navy
  // scheint statt des gemeinten Schwarz.
  const an = textil && textilTon(i.textile) === 'schwarz' && i.motivart !== 'vollflaechig';
  // 6. Okt., Markus: "ob wirklich 100 % alles transparent ausgeliefert wird und direkt so produziert, nicht nachtraeglich
  // freigestellt". Das Wegrechnen schwarzer Flaechen (schwarzRaus) WAR nachtraegliches Freistellen - es ist aus. Der Prompt
  // (RULES_SCHWARZ) bestellt den freien Stoff schon beim Zeichnen; gefuellte dunkle Flaechen werden nur noch GEMELDET.
  return an ? { schwarzPruefen: true } : {};
}
import { werVomNamen } from './vornamen.js';
import { TEXTIL_FARBEN, FARB_TEILE, faerbMaske, ensureTemplates, makeMockup, templateReady, szeneVarianteDa, szeneThemaFuer, SZENE_THEMEN, DRUCK_ARTEN, DRUCK_MASSE, themaEndung, LINIEN, LINIE_STANDARD, linieVorlageDa, GARMENTS, COLORS, SZENEN_LABELS, schaufensterTeil, bandAuswahl, passtVorzeige, ladeGelernteBoxen, szeneMoeglich, originaleWiederherstellen, alleGelerntenBoxen, istOriginalfoto, merkeBox, mockupsVerwerfen, angebotReihe, veralteteMockupsRaeumen, mockupStandAngleichen, mockupStandFuer, vorlagenStand} from './mockups.js';
import { vorlagenNachputzen } from './vorlagen.js';
import { saisonJetzt, saisonVorschau } from './saison.js';
import { TEXTILIEN, FIRMEN_TEXTILIEN, PLAETZE, PFLEGE, ZERTIFIKATE, LINIE as TEXTIL_LINIE, MARKEN as TEXTIL_MARKEN } from './textilien.js';
import { VORSCHLAEGE, vorschlaegeErgaenzen } from './vorschlaege.js';
import { geburtstagRegeln } from './geburtstag.js';
// Fassung 25/26: Kundenfotos - nur im Arbeitsspeicher, nie auf der Platte (siehe fotos.js)
import { fotoAufraeumen, fotoStatus, fotoAblegen, fotoHolen, fotosHolen, fotoLoeschen, pruefeFoto, fotoEinsetzen, fotoZonePrompt, nachbauPrompt, fotoNachmalenPrompt, fotoAendernPrompt, designFreigeben, designAblehnen, fotoInhaltBefund, FOTO_INHALT_FRAGE, FOTO_TEXTE, FOTO_MAX_MB } from './fotos.js';
import { accountStore, quotaCheck, bookDesign, accountView, sendLoginMail, sendMail, normEmail, readCookies, setCookie, PLANS, GUEST_FREE } from './accounts.js';
import { setupStripe, createCheckout, createPortal, verifyWebhook, applyEvent } from './billing.js';
// 1. Okt.: das Tor je Betrieb (QR am Tisch, Markus: "Mach das komplett fertig").
import { mountHaus } from './haus-route.js';
import { mountPartner, angebotVon } from './partner-route.js';
import { partnerStore, lieblingsSatz } from './partner.js';
import { minimalMotiv, ortsZeile } from './minimal-design.js';
import { whatsappAn, nummerSauber, nummerVerdeckt, whatsappSenden } from './whatsapp.js';
// 1. Okt.: die Lizenz des Hauses, per Stripe-Transfer ausgezahlt (Markus: "die 20 % an den Gastronom").
import * as lizenzen from './lizenzen.js';
import { renderName, renderNameImMotiv, nameImMotivPrompt, nameTraegerFuer, renderNameList, cleanNames, parsePeople, nameZonePrompt, nameListZonePrompt, MAX_NAMES, renderRoster, renderChest, rosterCsv, SIZES, NAME_FONTS} from './names.js';

// Druck-Aufteilung (Fassung 9): vorne = wie bisher (Name im Band); vorne-kader = vorne gross + Kaderliste hinten;
// brust-kader = hinten gross mit Kaderliste + vorne kleiner Brust-Print mit dem eigenen Namen (Abi-Klassiker)
const AUFTEILUNGEN = ['vorne', 'vorne-kader', 'brust-kader'];
const KOPF_PCT = { 'vorne-kader': 45, 'brust-kader': 100 };
import { researchMotto, researchPrompt, researchClub, researchClubPrompt } from './research.js';
import { gdrive } from './gdrive.js';
import { legalPages, seitenHuelle } from './rechtliches.js';
import { mountVorzeige } from './vorzeige.js';
import { mountAbstimmung } from './abstimmung.js';
import { mountFulfillment } from './fulfillment.js';
import { mountProdukte } from './produkte.js';
import { mountTextilBilder } from './textil-bilder.js';
import { mountVorlagen } from './vorlagen-route.js';
import { mountNamensliste } from './namensliste.js';
import { mountKaufformen } from './kaufformen.js';
import { initZaehler, zaehl, bericht as zaehlerBericht, sichern as zaehlerSichern, GRUPPEN as ZAEHLER_GRUPPEN } from './zaehler.js';
import { vectorizeMaster, vectorReady } from './vectorize.js';
import { markenStore } from './marken.js';
import { faelligerStand, jetztInZone, zeitenAus, standName, schonGesichert, naechsteNummer } from './sicherung.js';
// Freigaben der Partner und Firmen (Logo, Hausfarben) - fuer Tor, Partner-Shop und Haus-Textil.
import { freigaben as firmenFreigabenRepo, logoBild as firmenLogoBild, firmenFarben, logoHelle, bandFarbeFuerLogo, hausfarben } from './firmen-freigabe.js';
// 22. Sept., Markus: "Wir muessen dann natuerlich eine Moeglichkeit haben, das Original-Logo von
// der Homepage runterzuziehen, sonst funktioniert es natuerlich nicht."
import { logoAblegen as firmenLogoAblegen, dateiName as firmenDateiName, umfang as firmenUmfang} from './firmen-freigabe.js';
import { kuecheLand } from './kueche.js';
// 1. Okt., Markus (Strandtuch des Hauses): "beim Italiener links und rechts die italienische
// Flagge, beim Spanier die spanische ... beim Griechen vom Griechen, ist ja logisch." Die Flagge
// des Hauses ist das Land seiner Kueche (Eintrag kueche -> kuecheLand), sonst das Land des
// Eintrags - als Schluessel der Flaggentabelle (mockups.js FLAGGEN), die das Tuch damit fuellt.
const FLAGGEN_LAND = { Italy: 'italien', Spain: 'spanien', Greece: 'griechenland', France: 'frankreich', Germany: 'deutschland', Austria: 'oesterreich', 'the Netherlands': 'niederlande', Belgium: 'belgien', Poland: 'polen', Hungary: 'ungarn', Ireland: 'irland', Romania: 'rumaenien', Bulgaria: 'bulgarien' };
function flaggenLandFuer(ein) {
  const k = kuecheLand((ein && ein.kueche) || '');
  return FLAGGEN_LAND[k] || String((ein && ein.land) || '').trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
}
import { logoVonWebseite } from './logo-holen.js';
import { verbotenStore } from './verboten.js';
import os from 'node:os';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile); // fuer das tar.gz des Backups

// Fassung 72 (Markus, 17. Sept.: "Die Uhrzeiten im Backend sind nicht unsere deutschen Uhrzeiten"):
// Der Container laeuft auf UTC. Alles, was der SERVER als Zeit ausgibt - Auftragsliste, Wache,
// Mails, Protokoll - stand damit ein bis zwei Stunden zu frueh. Im Browser gilt ohnehin die Zeit
// des Geraets; hier wird die Serverzeit auf deutsche Zeit gestellt, mit Sommerzeit-Umstellung.
// Ueberschreibbar per TZ in Railway, falls einmal eine andere Zeitzone gebraucht wird.
process.env.TZ = process.env.TZ || 'Europe/Berlin';

const env = {
  PORT: 8080,
  IMAGE_QUALITY: 'max',         // Markus, 16. Sept.: "von vornherein in der hoechsten Aufloesung und besten Qualitaet" - 'max' gibt es bei den 2.5er-Modellen; sonst faellt der Lauf auf 'high' zurueck (siehe STUFE_RUECKFALL)
  LEINWAND: 'gross',            // 'gross' = groesste legale Leinwand je Format, 'klein' = alte 1024er Leinwand
  QA_MODEL: 'gpt-5-mini',
  PUBLIC_BASE_URL: 'http://localhost:8080',
  MASTER_WIDTH: 4096,
  PREVIEW_TTL_DAYS: 0,
  LIMIT_GLOBAL_DAY: 1000,
  MAX_PARALLEL_JOBS: 3,
  MAX_ATTEMPTS: 3,
  // Die Schlange darf lang werden: sie kostet nichts (eine kleine Datei je Auftrag) und
  // eine Abweisung kostet einen Kunden. Gebremst wird ueber die WARTEZEIT, nicht ueber die
  // Laenge - siehe MAX_WARTEN_SEK.
  MAX_QUEUE: 300,
  // Ab dieser angesagten Wartezeit nehmen wir nichts mehr an. Eine Stunde ist die Grenze,
  // ab der eine Ansage niemandem mehr hilft.
  MAX_WARTEN_SEK: 3600,
  CORS_ORIGINS: '',
  ACCOUNTS: 'off',            // 'on' = Anmeldung + Kontingent + Bezahlung greifen
  // 'alpha' = der Bildserver liefert Transparenz selbst - DER Weg (Markus, 14. Sept.: "direkte
  // Erzeugung transparent, ganz wichtig"). 'chroma' = Motiv kommt auf Chromagruen und wird hier
  // freigestellt - nur noch fuer Tests. Startwert; im Backend umstellbar, die Wahl liegt auf dem Volume.
  GRUND_MODUS: 'alpha',
  // Fassung 73: 'alt' = der ueber die Fassungen gewachsene Regelapparat (4221 Zeichen, 44
  // Verbote je Prompt), 'schlank' = jede Regel genau einmal und positiv formuliert (2889
  // Zeichen, 6 Verbote). Ein einzelner Auftrag kann die Fassung mitgeben (input.fassung),
  // damit sich beide am selben Motto vergleichen lassen, ohne Kundenauftraege umzustellen.
  PROMPT_FASSUNG: 'alt',
  MAIL_FROM: 'otto@motto-otto.de',
  MAIL_FROM_NAME: 'Motto Otto',
  LOGO_URL: 'https://mcp.markusassemacher.de/generated/0831727b-e5ec-444c-8ada-2cae60803eaa.png',
  ...process.env
};
if (!env.BALLZ_MCP_URL) { console.error('BALLZ_MCP_URL fehlt'); process.exit(1); }

const HAS_LLM = !!env.OPENAI_API_KEY;
// Zeitlimit + nur 1 Wiederholung: ein haengender QA-/Recherche-Aufruf darf nie das ganze Auftrags-Budget fressen
const openai = HAS_LLM ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 90000, maxRetries: 1 }) : null;
const SIGN_SECRET = env.SIGN_SECRET || crypto.randomBytes(16).toString('hex');
const newId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);
const newIdLang = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 7);
// Design-Nummern wurden bisher blind gewuerfelt: vier Zeichen aus 32, ohne nachzusehen, ob
// es die Nummer schon gibt. Bei ein paar Designs am Tag geht das gut. Bei hunderten je Motto
// an einem Tag - ein Pruefstand-Durchlauf reicht - faellt dieselbe Nummer irgendwann zweimal,
// und dann ueberschreibt der zweite Auftrag die Druckdatei und die Daten des ersten. Aus
// Kundensicht hat sich sein Design in etwas voellig anderes verwandelt. Also wird jede
// Nummer geprueft, bevor sie benutzt wird - auch gegen geloeschte, damit eine gesperrte
// Nummer nicht neu vergeben wird und das neue Design sofort wieder verschwindet.
async function nummerFrei(id) {
  if (await istGeloescht(id)) return false;
  for (const p of [path.join(STORE, 'jobs', `${id}.json`), path.join(STORE, 'masters', `${id}_PRINT_MASTER.png`)]) {
    try { await fs.access(p); return false; } catch (e) { /* frei */ }
  }
  return true;
}
// ---------- Fortlaufende Auftragsnummer ----------
// Die Design-Nummer ist bewusst gewuerfelt (niemand soll aus MO-...-A7K2 ablesen koennen,
// wie viele Designs es gibt oder was die Nachbarnummer ist). Fuer die Weiterverarbeitung
// braucht die Druckerei aber genau das Gegenteil: eine Zahl, die hochzaehlt, nach der man
// sortieren und auf die man sich am Telefon beziehen kann ("Auftrag 427").
// Also beides: gewuerfelte Nummer als Identitaet, fortlaufende Nummer als Auftragsnummer.
// Sie wird nur an echte Kundendesigns vergeben - Pruefstand-Laeufe und Galerie-Beispiele
// sind keine Auftraege und duerfen die Zaehlung nicht verfaelschen.
// Erst beim Aufruf zusammensetzen: STORE wird weiter unten definiert, ein const hier oben
// liefe beim Laden der Datei in den Fehler "Cannot access 'STORE' before initialization".
const laufDatei = () => path.join(STORE, 'laufnummer.json');
let laufStand = null;
// Hoechste bereits vergebene Nummer aus den Auftraegen selbst - die Auftraege sind die
// Wahrheit, der Zaehlerstand ist nur eine Abkuerzung.
async function hoechsteVergebene() {
  let max = 0;
  for (const ordner of ['jobs', 'queue']) {
    try {
      for (const f of await fs.readdir(path.join(STORE, ordner))) {
        if (!f.endsWith('.json')) continue;
        try { const j = JSON.parse(await fs.readFile(path.join(STORE, ordner, f), 'utf8')); if (+j.lfdNr > max) max = +j.lfdNr; } catch (e) { /* egal */ }
      }
    } catch (e) { /* Ordner gibt es noch nicht */ }
  }
  return max;
}
async function laufnummerStart() {
  if (laufStand !== null) return laufStand;
  // Beim Start IMMER beides vergleichen und das Groessere nehmen - nicht nur, wenn die
  // Zaehlerdatei fehlt. Sie kann auch zurueckfallen: ein eingespieltes Backup, ein
  // zurueckgesetztes Volume, ein fehlgeschlagener Schreibvorgang. Stuende dann eine zu
  // kleine Zahl darin, bekaeme der naechste Auftrag eine Nummer, die es schon gibt - und
  // eine doppelte Auftragsnummer ist der eine Fehler, den man hier nicht machen darf.
  let ausDatei = 0;
  try { ausDatei = +JSON.parse(await fs.readFile(laufDatei(), 'utf8')).stand || 0; } catch (e) { /* noch keine */ }
  const ausAuftraegen = await hoechsteVergebene();
  laufStand = Math.max(ausDatei, ausAuftraegen);
  if (ausAuftraegen > ausDatei) {
    console.warn('Auftragsnummer: Zaehlerstand war', ausDatei, '- vergeben ist aber schon', ausAuftraegen + '. Korrigiert.');
    try { await fs.writeFile(laufDatei(), JSON.stringify({ stand: laufStand, korrigiert: new Date().toISOString() }, null, 2)); } catch (e) { /* egal */ }
  }
  console.log('Fortlaufende Auftragsnummer: naechste ist', laufStand + 1);
  return laufStand;
}
// Eine Nummer nach der anderen: der Server ist einthreadig, aber zwischen Lesen und
// Schreiben liegt ein await - ohne diese Kette bekaemen zwei gleichzeitige Auftraege
// dieselbe Nummer. Darum reihen sie sich hier ein.
let laufKette = Promise.resolve();
function naechsteLaufnummer() {
  laufKette = laufKette.then(async () => {
    await laufnummerStart();
    laufStand++;
    try { await fs.writeFile(laufDatei(), JSON.stringify({ stand: laufStand, zuletzt: new Date().toISOString() }, null, 2)); }
    catch (e) { console.error('Laufnummer sichern:', e && e.message ? e.message : e); }
    return laufStand;
  });
  return laufKette;
}

async function freieNummer(slug) {
  const kopf = `MO-${String(slug).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
  for (let i = 0; i < 8; i++) {
    const id = kopf + newId();
    if (await nummerFrei(id)) return id;
    console.warn('Design-Nummer schon vergeben, neuer Versuch:', id);
  }
  // Nach acht Fehlversuchen ist der Tag fuer dieses Motto so voll, dass vier Zeichen nicht
  // mehr reichen. Dann lieber eine laengere Nummer als ein ueberschriebenes Kundendesign.
  for (let i = 0; i < 8; i++) {
    const id = kopf + newIdLang();
    if (await nummerFrei(id)) return id;
  }
  return kopf + Date.now().toString(36).toUpperCase();
}

const STORE = path.resolve('storage');
// 7. Okt.: Szene nach Begriff (szene-begriff.js) - Maurer auf die Baustelle, nachgeschlagen statt geraten
const szenenB = szenenBegriff({ STORE, openai, env, schnell: () => SCHNELL(), gruendlich: () => GRUENDLICH() });
// Die Schriften der Firmenkarte liegen im Repo (schriften/). fontconfig findet sie nur, wenn es
// davon weiss - ohne Installation, ohne Root. Muss VOR dem ersten sharp-Zeichnen stehen.
if (!process.env.FONTCONFIG_FILE) {
  const konf = path.resolve('schriften', 'fonts.conf');
  if (fsSync.existsSync(konf)) { process.env.FONTCONFIG_FILE = konf; console.log('Schriften:', konf); }
}
for (const d of ['mottos', 'uploads', 'masters', 'previews', 'jobs', 'mockups']) {
  await fs.mkdir(path.join(STORE, d), { recursive: true });
}
// Fassung 85: die selbst gemessenen Druckflaechen der eigenen Vorlagen. Muss VOR dem ersten
// Mockup geladen sein - sonst rechnet der Server mit dem Startwert aus dem Code weiter, und
// das Motiv saesze auf jedem selbst erzeugten Teil falsch. 20. Sept.: VOR ensureTemplates,
// denn das ersetzt mitgelieferte Vorlagen nur, wenn keine selbst gemessene Flaeche dazu vorliegt.
await ladeGelernteBoxen(STORE);
await ensureTemplates(STORE);
// Fassung 88: Selbstheilung. Hat der Vorlagen-Erzeuger ein echtes Herstellerfoto ueberschrieben,
// wird es zurueckgeholt - ohne dass jemand im Backend etwas druecken muss. Am 18. September war
// die Kundenseite deswegen leer, und Markus musste es melden. Das darf nicht sein Job sein.
//
// Fassung 88b: Das lief zuerst HIER, mit await - also vor app.listen. Und genau das hat die
// Seite ein zweites Mal umgeworfen: die Selbstheilung loescht die kaputten Vorlagen und laedt
// sechsundzwanzig Bilder neu herunter. Solange hoert der Server auf keinem Port, Railway sieht
// nichts und meldet "Die Anwendung hat nicht reagiert". Lokal fiel es nicht auf, weil hier
// nichts zu reparieren war und der Lauf sofort zurueckkam.
// Nichts, was Netz braucht, gehoert vor den Start. Die Reparatur laeuft jetzt zehn Sekunden
// NACH dem Start im Hintergrund - die Seite ist da, und die Bilder wachsen nach.
// 19. Sept.: Beide Start-Reparaturen liefen im Hintergrund, und ihr Scheitern stand nur im
// Protokoll. Die Nachputz-Reparatur ist zwei Deploys lang bei jedem Start abgestuerzt
// ("path is not defined"), und niemand hat es gesehen. Ab jetzt merkt sich der Server den
// letzten Fehler jeder Start-Reparatur, und die Lage-Karte zeigt ihn.
const startReparaturen = { originale: '', nachputzen: '', wann: '' };
// Firmenlogos: was fehlt, wird einmal nach dem Start von der Firmenseite geholt. NACH
// app.listen (Regel 6: nichts, was Netz braucht, vor dem Start) und nur fuer Firmen mit
// Freigabe. Ist die Datei schon auf dem Volume, passiert nichts - kein Abholen bei jedem Start.
startReparaturen.firmenlogos = '';
setTimeout(async () => {
  try {
    const liste = await firmenFreigaben();
    const nachweis = await firmenlogoNachweis();
    for (const e of liste) {
      if (!e.webseite || !e.freigabe || !e.freigabe.datum) continue;
      // Uebersprungen wird nur, wenn BEIDES schon da ist: das Logo und die verortete Anschrift.
      // Nach dem Deploy vom 22. Sept. lagen die Logos bereits auf dem Volume, und weil nur nach
      // ihnen gefragt wurde, holte der Server die Anschriften nie - und ohne Anschrift kann der
      // Standort nichts entscheiden, also lief die Firmenkarte ins Leere.
      const n = nachweis[e.firma];
      const anschriftDa = (Array.isArray(e.punkt) && e.punkt.length === 2) || !!(n && Array.isArray(n.punkt) && n.punkt.length === 2);
      if (anschriftDa && await firmenLogoBild(e, STORE)) continue;
      const r = await firmenlogoHolen(e);
      console.log('Firmenlogo holen:', r.firma, r.ok ? `OK ${r.masse} (${r.grund}) von ${r.quelle}` : 'nicht geholt - ' + r.grund);
      if (!r.ok) startReparaturen.firmenlogos = (startReparaturen.firmenlogos ? startReparaturen.firmenlogos + '; ' : '') + r.firma + ': ' + r.grund;
    }
  } catch (e) {
    startReparaturen.firmenlogos = (e && e.message ? e.message : String(e)).slice(0, 160);
    console.error('Firmenlogos holen:', startReparaturen.firmenlogos);
  }
}, 20000);
setTimeout(() => {
  originaleWiederherstellen(STORE)
    .then(() => { startReparaturen.originale = ''; })
    .catch(e => { startReparaturen.originale = (e && e.message ? e.message : String(e)).slice(0, 160); console.error('Vorlagen zurueckholen:', startReparaturen.originale); });
}, 10000);
// Fassung 90: Vorlagen, die mit der alten Magenta-Regel gebaut wurden, tragen noch Rosa in
// der Druckflaeche (Markus' Startseite, 18. Sept., 21:27: rosa Kasten hinter dem Aquarell).
// Sie werden beim Start nachgeputzt - kein neues Bild, kein Knopf - und die Mockups der
// betroffenen Artikel weggeworfen, damit die Seite sie mit der sauberen Vorlage neu baut.
setTimeout(async () => {
  try {
    const { geputzt } = await vorlagenNachputzen(STORE, alleGelerntenBoxen(), { istOriginal: istOriginalfoto });
    if (geputzt.length) {
      // Die neu gemessene Flaeche ist die richtige - sie ersetzt die zu kleine alte.
      for (const g of geputzt) await merkeBox(STORE, g.key, g.box);
      // 19. Sept.: auch flach gefuellte Flaechen auf fotografiertem Stoff (der Kasten hinter dem
      // Motiv auf dem getragenen Shirt) werden nachgeputzt - sie bekommen den Verlauf des Stoffs.
      console.warn('Vorlagen nachgeputzt:', geputzt.map(g => `${g.key} (${g.verlauf ? 'flach -> Stoffverlauf · ' : ''}${g.farbeKorrigiert ? 'Farbe berichtigt · ' : ''}${g.vorher} -> ${g.nachher} rosa Pixel · Flaeche ${g.boxAlt.w}x${g.boxAlt.h} -> ${g.box.w}x${g.box.h})`).join(', '));
      const artikel = [...new Set(geputzt.map(g => g.key.split('_')[0].replace('-szene', '')))];
      const weg = await mockupsVerwerfen(STORE, artikel);
      console.log('Vorlagen nachgeputzt:', weg, 'veraltete Mockups geloescht fuer', artikel.join(', '));
    }
    // 19. Sept., 12:05: die Vorlage war nachgeputzt, die Startseite zeigte trotzdem den alten
    // Kasten - das fertige Situationsbild lag noch im Ordner, weil der Filter oben es nicht
    // traf. Ab jetzt gilt beim Start eine Regel, die keinen Namen kennen muss: ein Mockup,
    // das aelter ist als seine Vorlage, ist veraltet und wird neu gebaut.
    // 20. Sept.: hat sich die Mockup-Rechnung geaendert (Masslinien weg, Flachware
    // formatfuellend), sind ALLE fertigen Mockups veraltet - egal, wie alt ihre Vorlage ist.
    const stand = await mockupStandAngleichen(STORE);
    if (stand.geloescht) console.log('Mockup-Stand', stand.alt, '->', stand.neu, '·', stand.geloescht, 'fertige Mockups geloescht, werden neu gebaut');
    const alt = await veralteteMockupsRaeumen(STORE);
    if (alt.geloescht.length) console.log('Mockups aelter als ihre Vorlage geloescht:', alt.geloescht.length, 'von', alt.geprueft, '·', alt.geloescht.slice(0, 8).join(', ') + (alt.geloescht.length > 8 ? ' …' : ''));
    // Und dann die Kacheln der Startseite vorbauen, bevor der erste Besucher es tun muss.
    // Nicht im Pruefserver der Abnahme: der holt keine Druckdateien aus dem Netz.
    if (!process.env.ABNAHME) await kachelnVorwaermen();
    // 20. Sept., 23:38, Markus: "Es dauert ganz schoen lange, bis sich die Flaechen von den
    // Reitern fuellen." Die Reihe "Das hat Otto gezeichnet" holt bis zu 40 T-Shirt-Mockups, und
    // jedes fehlende wurde erst beim Aufruf gerechnet. Jetzt werden sie nach dem Start vorgebaut,
    // eines nach dem anderen, ueber dieselbe Route (gleicher Cache, gleiche Regeln).
    if (!process.env.ABNAHME) await showcaseVorwaermen();
    // 23:44, Markus (Screenshot Stil-Kacheln leer): "Sind die Karten auch leer?" Dieselbe Ursache -
    // die Stilbeispiele je Motto (T-Shirt-Mockup je Stil) entstanden erst beim Aufruf. Auch sie
    // werden jetzt nach dem Start vorgebaut, Motto fuer Motto, Stil fuer Stil.
    if (!process.env.ABNAHME) await stilbeispieleVorwaermen();
    // 21. Sept.: vorhandene Druckdateien nachschaerfen (Kante 15 -> 3 px), im Hintergrund nach
    // den Kacheln - die Kunden merken davon nur, dass ihre Druckdatei besser wird.
    // 6. Okt., Markus: "Kunden-Dateien duerfen ohne meine Zustimmung nicht ueberschrieben werden." Der Lauf schreibt JEDE
    // Druckdatei neu - er startet nicht mehr von selbst (ein hoeherer KANTE_STAND haette alle Kundendateien ersetzt).
    // druckkantenNachschaerfen() bleibt fuer einen Lauf, den Markus ausdruecklich freigibt.
  } catch (e) {
    startReparaturen.nachputzen = (e && e.message ? e.message : String(e)).slice(0, 160);
    console.error('Vorlagen nachputzen:', startReparaturen.nachputzen);
  } finally { startReparaturen.wann = new Date().toISOString(); }
}, 20000);
// Otto-Maskottchen einmal laden, freistellen und Favicons erzeugen (nicht-fatal)
try { await ensureLogo(STORE, { localPath: path.resolve('logo-source.png'), url: env.LOGO_URL }); console.log('Logo bereit'); }
catch (e) { console.error('Logo konnte nicht geladen werden:', e && e.message ? e.message : e); }
const mottos = mottoStore(path.join(STORE, 'mottos'));
// Markensperre: geschuetzte Vereins-/Markennamen kommen nie aufs Textil (Eingaben, Namenslisten, Bild-QA, Recherche)
const marken = markenStore(STORE);
// 2. Okt., Markus: Partner melden sich selbst an und stellen ihren Shop selbst ein (partner.js).
// Was sie anlegen, liegt auf dem Volume (storage/partner) und kommt hier zu den Repo-Freigaben
// (postkarte/firmen-freigaben.json) dazu - damit kennen Tor, Logo, Haus-Textil und Lizenz
// die Partner, ohne dass einer dieser Wege geaendert werden muss.
const partner = partnerStore(STORE);
async function firmenFreigaben() { return partner.zusammenfuehren(await firmenFreigabenRepo(), await partner.alle()); }
await marken.ready();
// Verbotene Zeichen und Parolen (Hakenkreuz, SS-Runen, NS-Parolen, verbotene Organisationen).
// Getrennt von der Markensperre, weil sich diese Pruefung NIE abschalten laesst - auch nicht
// fuer Fanclub oder Handwerker, die von der Markensperre ausgenommen sind.
const verboten = verbotenStore(STORE);
await verboten.ready();

// Stil-Overrides (Label/Beschreibung/Prompt-Text/aktiv) aus dem Backend-Editor laden.
const STYLES_FILE = path.join(STORE, 'styles.json');
// Stand aus mottos.js sichern, BEVOR die Volume-Datei ihn ueberschreibt - die Migration darunter
// braucht die Texte aus dem Code, nicht die bereits ueberschriebenen.
const STILE_AUS_CODE = {};
for (const st of stylesForAdmin()) STILE_AUS_CODE[st.key] = st;

try { applyStyleOverrides(JSON.parse(await fs.readFile(STYLES_FILE, 'utf8'))); console.log('Stil-Overrides geladen'); }
catch (e) { /* keine Overrides gespeichert - Standardstile */ }

// Die styles.json auf dem Volume gewinnt gegen mottos.js. Genau das war die Ursache fuer
// "kommt schwammig raus": eine aeltere Fassung von applyStyleOverrides hat den Stiltext bei 900
// Zeichen abgeschnitten, und der abgeschnittene Text steht seitdem auf dem Volume. Eine Aenderung
// nur in mottos.js waere in der Produktion wirkungslos geblieben.
//
// Darum heilt der Start die Datei selbst, in zwei klar getrennten Faellen - nie wird eine echte
// Backend-Aenderung ueberschrieben:
//   1. Der Stil fehlt auf dem Volume ganz (z. B. Graffiti)  -> aus dem Code nachtragen.
//   2. Der Text auf dem Volume ist ein reiner Anfang des Code-Textes -> er wurde abgeschnitten,
//      niemand hat ihn so getippt. Der vollstaendige Text aus dem Code gewinnt.
// Ein im Backend bewusst umgeschriebener Text ist kein Anfang des Code-Textes und bleibt stehen.
try {
  const alt = JSON.parse(await fs.readFile(STYLES_FILE, 'utf8'));
  if (alt && typeof alt === 'object') {
    const geheilt = [];
    for (const [k, c] of Object.entries(STILE_AUS_CODE)) {
      if (k === 'standard') continue;
      const o = alt[k];
      if (!o) { alt[k] = { label: c.label, desc: c.desc, off: !!c.off, text: c.text, dark: c.dark || '' }; geheilt.push(k + ' (fehlte)'); continue; }
      const drauf = String(o.text || '');
      if (drauf && drauf.length < c.text.length && c.text.startsWith(drauf)) {
        o.text = c.text;
        o.dark = c.dark || o.dark || '';
        geheilt.push(k + ' (war bei ' + drauf.length + ' abgeschnitten)');
      } else if (c.dark && !o.dark) { o.dark = c.dark; geheilt.push(k + ' (Textilzeile ergaenzt)'); }
    }
    if (geheilt.length) {
      await fs.writeFile(STYLES_FILE, JSON.stringify(alt, null, 2));
      applyStyleOverrides(alt);
      console.log('Stile auf dem Volume geheilt:', geheilt.join(', '));
    }
  }
} catch (e) { /* noch keine styles.json - dann gelten ohnehin die Texte aus mottos.js */ }

// Fassung 15 auf das Volume nachziehen. Die Mottos liegen als Dateien auf dem Volume und gewinnen
// gegen seed.json - eine Korrektur nur im Repo bliebe in der Produktion wirkungslos. Ersetzt wird
// nur, wenn der ALTE Wortlaut noch exakt so dasteht; ein im Backend geaenderter Prompt bleibt.
const FASSUNG15_PROMPT = [
  { slug: 'meister-shirt',
    alt: 'Use only what really belongs to this sport: pure ball sports (football, handball, volleyball, basketball, water polo) have ONLY their ball plus goal, net or basket - no sticks, bats, rackets or cues; racket and stick sports show their racket, bat or stick with the matching ball or puck; strength and martial arts show belt, gloves or mat; target sports show target, arrows or darts. Never show the equipment of a different sport.',
    neu: 'Use only equipment that really belongs to this sport - pure ball sports only their ball plus goal, net or basket; racket and stick sports their racket, bat or stick with the matching ball or puck; strength and martial arts belt, gloves or mat; target sports target, arrows or darts. Never the equipment of a different sport.' },
  { slug: 'handwerker-shirt',
    alt: 'Leave the top quarter of the composition completely empty - the company logo is placed there afterwards. Do not draw any logo, emblem or symbol in that area.',
    neu: "Leave one clearly bounded empty area for the company's own logo, which is added afterwards as a real file. Draw nothing inside it.",
    // Grundsatz: die freie Flaeche folgt dem Logo, sie sitzt nicht fest oben
    place: { von: 'oben', nach: 'mitte' } }
];
try {
  for (const f of FASSUNG15_PROMPT) {
    const m = await mottos.get(f.slug);
    if (!m) continue;
    let geaendert = false;
    if (typeof m.prompt === 'string' && m.prompt.includes(f.alt)) { m.prompt = m.prompt.replace(f.alt, f.neu); geaendert = true; }
    if (f.place && m.upload && m.upload.place === f.place.von) { m.upload.place = f.place.nach; geaendert = true; }
    if (geaendert) { await mottos.save(m); console.log('Fassung 15: Prompt von', f.slug, 'nachgezogen'); }
  }
} catch (e) { console.error('Fassung 15 Prompt-Migration:', e && e.message ? e.message : e); }

// Geburtstag: Foto-Upload nachziehen. Das Motto liegt nur als Datei auf dem Volume (nicht in
// seed.json), also hilft eine Korrektur im Repo allein nicht - der Start schaltet den Upload
// ein. "Warum kann ich da kein Foto hochladen, vom Geburtstagskind zum Beispiel?" Genau das:
// Foto als Vorlage, Otto zeichnet die Person oder das Tier als Motiv nach, wie beim Landwirt.
// Greift nur, solange der Upload noch auf "aus" steht und niemand einen Hinweistext getippt
// hat - wer ihn im Backend spaeter bewusst abschaltet, behaelt seine Entscheidung.
try {
  const g = await mottos.get('geburtstag');
  if (g && g.upload && g.upload.mode === 'off' && !String(g.upload.hint || '').trim()) {
    g.upload = {
      mode: 'reference',
      label: 'Eigenes Foto (optional): Geburtstagskind, Haustier …',
      hint: 'Lade ein Foto hoch – Otto zeichnet genau das liebevoll als Motiv, ohne es zu verändern. Ohne Foto entsteht ein passendes Geburtstags-Motiv.',
      required: false, place: 'unten', widthPct: 38
    };
    await mottos.save(g);
    console.log('Geburtstag: Foto-Upload eingeschaltet (Vorlage nachzeichnen)');
  }
} catch (e) { console.error('Geburtstag Foto-Upload:', e && e.message ? e.message : e); }

// Geburtstag: Jahrgang waehlbar. "Waere ja auch cool, wenn man den Jahrgang waehlen koennte."
// Ein optionales Feld nach dem Alter, im Prompt als [[...]]-Zeile - fehlt der Jahrgang, faellt
// die Zeile weg wie beim Spruch. Greift nur, solange das Feld noch nicht existiert.
try {
  const g = await mottos.get('geburtstag');
  if (g && Array.isArray(g.fields) && !g.fields.some(f => f.key === 'jahrgang')) {
    const feld = { key: 'jahrgang', label: 'Jahrgang (optional)', type: 'text', required: false, printed: true, personal: false, max: 8,
      placeholder: 'z. B. 1975', hint: 'Steht als „Jahrgang 1975" auf dem Shirt – wie ein Vintage-Etikett.', geo: false, steers: false, options: [] };
    const i = g.fields.findIndex(f => f.key === 'alter');
    g.fields.splice(i >= 0 ? i + 1 : g.fields.length, 0, feld);
    if (typeof g.prompt === 'string' && !g.prompt.includes('{jahrgang}')) {
      const zeile = '[[- a small vintage-style label or banner reading exactly "JAHRGANG {jahrgang}", clearly smaller than the age]]';
      const anker = '- the name, reading exactly "{name}"';
      g.prompt = g.prompt.includes(anker) ? g.prompt.replace(anker, anker + '\n' + zeile) : g.prompt + '\n' + zeile;
    }
    await mottos.save(g);
    console.log('Geburtstag: Feld Jahrgang ergänzt');
  }
} catch (e) { console.error('Geburtstag Jahrgang:', e && e.message ? e.message : e); }

// Klick-Vorschlaege nachziehen. Mottos ohne Vorschlaege zeigten im Backend nur den Platzhalter
// der Textbox (Abi-Beispiele) - das sah aus wie falsche Vorschlaege, war aber ein leerer Kasten.
// Die Liste steht in vorschlaege.js; eingetragen wird nur, wo noch nichts steht und das
// Spruch-Feld existiert. Eine im Backend gepflegte Liste bleibt unangetastet.
try {
  for (const slug of Object.keys(VORSCHLAEGE)) {
    const m = await mottos.get(slug);
    if (m && vorschlaegeErgaenzen(m)) { await mottos.save(m); console.log('Vorschläge eingetragen:', slug, '(' + VORSCHLAEGE[slug].liste.length + ')'); }
  }
} catch (e) { console.error('Vorschläge nachziehen:', e && e.message ? e.message : e); }

// Fassung 24: Otto Freestyle aus freestyle/motto-freestyle.json anlegen (1:1 aus dem Drive).
// Felder, die nicht gedruckt werden (Wofuer, Motivtext, Foto-Wahl), bekommen printed:false -
// sonst erwartet die Bild-QA den ganzen Motivtext als Schrift im Bild. Wie bei seed.json:
// einmal anlegen, vom Kunden bearbeitete Fassungen nie ueberschreiben.
try {
  const fsMotto = JSON.parse(await fs.readFile(new URL('./freestyle/motto-freestyle.json', import.meta.url), 'utf8'));
  // FS_REV 2 (Markus, 14. Sept.): "Wofuer ist es?" spielt fuer die Groesse keine Rolle - das Feld
  // rutscht ans Ende und ist freiwillig; zuerst kommen Motiv, Artikel und Groesse.
  // FS_REV 3 (Markus): "Wofuer es ist, spielt bei Freestyle ueberhaupt keine Rolle. Das kann raus."
  // Das Feld faellt weg; die Prompt-Zeile "The piece is {wofuer}." verschwindet mit dem leeren Wert.
  // FS_REV 4 (Markus, 5. Okt. abends): "Wir muessen Freestyle viel, viel einfacher machen ... Die Leute sollen einfach nur
  // einsprechen" - einfach:true, alle Felder ausser dem Wunsch (motiv) versteckt; freestyleBruecke fuellt sie aus dem Wunsch.
  // FS_REV 5 (6. Okt., Markus: "unbegrenzt"): das Wunschfeld nimmt 5000 Zeichen statt 700.
  // FS_REV 6 (19. Okt., Markus: "noch dazu ein Foto hochzuladen oder eine Datei, so dass diese geaendert werden kann"):
  // das Foto ist wieder ein eigener, freiwilliger Schritt (ohneGeht, Zusage am Knopf), foto_modus hat den Weg
  // "verändern" und bleibt versteckt - die Bruecke setzt ihn aus dem Wunsch; der Haken foto_rechte faellt weg.
  // FS_REV 7 (19. Okt. abends): der Foto-Hinweis faengt mit der Rechte-Zusage an - auf dem Handy lag sie unter der Knopfleiste.
  // FS_REV 8 (19. Okt. abends, Markus: "Ich muss erst einsprechen, was geaendert werden soll ... nicht cool"): Foto VOR dem Wunsch, Wunsch fragt mit Foto "an deinem Foto aendern" (mitFoto).
  const FS_REV = 8;
  for (const f of (fsMotto.fields || [])) if (['motiv', 'foto_modus', 'foto', 'foto_form', 'foto_rechte', 'vermeiden'].includes(f.key)) f.printed = false;
  fsMotto.fields = (fsMotto.fields || []).filter(f => f.key !== 'wofuer');
  const vorlage = { ...fsMotto, noExtra: true, gewerblich: false, upload: { mode: 'off', label: 'Foto', hint: '', place: 'mitte', widthPct: 40 }, size: '1024x1536' };
  const e = await mottos.get('freestyle');
  if (!e) {
    await mottos.save({ ...vorlage, seedRev: FS_REV });
    console.log('Fassung 24: Motto "Otto Freestyle" angelegt');
  } else if (!e.userEdited && (+e.seedRev || 0) < FS_REV) {
    await mottos.save({ ...e, intro: vorlage.intro, headline: vorlage.headline, text: vorlage.text, fields: vorlage.fields, prompt: vorlage.prompt, freestyle: true, artikelPflicht: true, fotoUpload: true, noExtra: true, vary: false, einfach: !!vorlage.einfach, seedRev: FS_REV });
    console.log('Fassung 24: Motto "Otto Freestyle" aktualisiert');
  }
} catch (e) { console.error('Fassung 24 Freestyle-Motto:', e && e.message ? e.message : e); }
// 4. Okt., Markus: "Otto Freestyle darf dann auch wirklich mein Freestyle sein" - "Wenn schon dein Freestyle".
// NUR Name und Kopfzeile - ein hoeherer FS_REV schriebe auch Felder und Auftrag neu.
try {
  const e = await mottos.get('freestyle');
  if (e && !e.userEdited && (e.name === 'Otto Freestyle' || e.headline === 'Otto Freestyle')) {
    await mottos.save({ ...e, name: e.name === 'Otto Freestyle' ? 'Dein Freestyle' : e.name, headline: e.headline === 'Otto Freestyle' ? 'Dein Freestyle' : e.headline });
    console.log('Freestyle heisst jetzt "Dein Freestyle"');
  }
} catch (e) { console.error('Freestyle umbenennen:', e && e.message ? e.message : e); }

// 1. Okt. 2026, Markus: "Wenn jemand dort auf Textil machen drueckt, muss man natuerlich genau da
// auch hinkommen, und es soll alles so funktionieren wie immer,
// nur dass 100 % das EAST-Logo drauf ist - und das soll bei allen so sein, die mitmachen: bei
// Luigi Luigi, beim Sportverein das Logo vom Sportverein." Das Motto "haus" ist Freestyle mit
// dem Logo des freigegebenen Betriebs (postkarte/motto-haus.json, aus dem Freestyle-Eintrag der
// Saat gebaut); der Betrieb kommt aus dem Link (/bei/<slug> -> ?firma=), das Logo aus der Freigabe.
try {
  const hausMotto = JSON.parse(await fs.readFile(new URL('./postkarte/motto-haus.json', import.meta.url), 'utf8'));
  // 3: Name "Shirt, Tasse & Co. mit Logo" (Markus, 2. Okt.: "Haus-Design hoert sich total scheisse an").
  // ACHTUNG, gemessen am 2. Okt.: dasselbe Motto steht auch in seed.json (rev), und der Saat-Abgleich
  // unten schreibt seedRev = rev. Die Saat hatte rev 2 (vom Freestyle geerbt), also stand live schon
  // seedRev 2, und HAUS_REV 2 hat nichts mehr aktualisiert. Beide Nummern muessen zusammen steigen.
  const HAUS_REV = 4;   // 4: kein "Haus" mehr in Kopf, Text und Logo-Feld (Markus, 2. Okt.)
  const e = await mottos.get('haus');
  if (!e) { await mottos.save({ ...hausMotto, seedRev: HAUS_REV }); console.log('Haus-Textil: Motto angelegt'); }
  else if (!e.userEdited && (+e.seedRev || 0) < HAUS_REV) { await mottos.save({ ...e, ...hausMotto, seedRev: HAUS_REV }); console.log('Haus-Textil: Motto aktualisiert'); }
} catch (e) { console.error('Haus-Textil-Motto anlegen:', e && e.message ? e.message : e); }

// 12. Okt. 2026: Postkarte (gruesse-aus) und Gutschein (gutschein) sind nicht mehr Teil von Motto Otto.
// Liegen ihre Mottos noch auf dem Volume, fliegen sie beim Start raus - sonst stuenden sie weiter in
// Listen, Sitemap und unter /m/<slug>. Designs und Auftraege bleiben unberuehrt.
for (const alt of ['gruesse-aus', 'gutschein']) {
  try { if (await mottos.get(alt)) { await mottos.remove(alt); console.log('Motto entfernt (nicht mehr Teil von Motto Otto):', alt); } }
  catch (e) { console.error('Motto entfernen:', alt, e && e.message ? e.message : e); }
}

// Fassung 22: Die Variationen des Handwerker-Shirts sagten alle "central motif: ..." und
// stellten damit ein Motiv in die MITTE - also genau dorthin, wo seit Fassung 15 die freie
// Flaeche fuer das Firmenlogo liegt. Ergebnis: in jedem Stil dieselbe Kiste. Die neuen
// Variationen beschreiben stattdessen, WIE SICH DAS GEWERK UM DIE FREIE FLAECHE LEGT.
// Wie oben: nur ersetzen, wenn der alte Wortlaut noch exakt dasteht.
const F22_HANDWERK_ALT = [
  "central motif: the trade's main tool held up by a strong gloved fist",
  "central motif: two crossed main tools of the trade behind a round emblem made of the trade's material",
  'central motif: a scene of the trade at work as a bold silhouette without faces',
  "central motif: the trade's tools arranged inside a hexagon frame",
  "central motif: the trade's key machine or vehicle, big and proud",
  "central motif: the trade's material stacked like a monument, tools on top",
  'central motif: the main tool with wings and a banner ribbon',
  "central motif: a workbench still life of the trade's tools",
  "central motif: the trade's main tool breaking through a wall or plank, sparks or dust flying",
  'central motif: the helmet or cap of the trade with the tools crossed behind it',
  "central motif: the trade's tools inside a big gear ring"
].join('\n');
const F22_HANDWERK_NEU = [
  "two main tools of the trade crossed BEHIND the free area, their handles reaching out past it on both sides",
  "a ring built from the trade's own material laid around the free area, worn and hand-made, not a clean circle",
  "the trade at work as a bold silhouette without faces, standing to one side and looking towards the free area",
  "the trade's material stacked into a solid base that the free area rests on, tools leaning against it",
  "the trade's tools fanned out behind the free area like rays, longest at the top",
  "the trade's key machine or vehicle behind the free area, only its upper half visible, the rest hidden by it",
  "sparks, chips or dust bursting out from behind the free area, tools at the edges where they were struck",
  "two upright elements of the trade left and right of the free area like a gateway, a beam or ribbon across the top",
  "the trade's tools hanging on a wall of the trade's material, the free area as the empty spot among them",
  "a wide band of the trade's work, running behind the free area and out to both edges",
  "the helmet or cap of the trade sitting on top of the free area, tools crossed underneath it"
].join('\n');
try {
  const m = await mottos.get('handwerker-shirt');
  if (m && typeof m.variations === 'string' && m.variations.trim() === F22_HANDWERK_ALT) {
    m.variations = F22_HANDWERK_NEU;
    if (m.moodChoice !== true) m.moodChoice = true;
    if (m.placementChoice !== true) m.placementChoice = true;
    await mottos.save(m);
    console.log('Fassung 22: Variationen des Handwerker-Shirts nachgezogen');
  }
} catch (e) { console.error('Fassung 22 Handwerker-Migration:', e && e.message ? e.message : e); }

// Fassung 29: Fanclub und Malle-Fahrt bestellten im Motto-Text selbst "in der Mitte eine leere
// rechteckige Flaeche" - genau der feste Platz, den es seit Fassung 15 nicht geben soll. Ergebnis
// (Harmstorf): Loch in der Mitte, Logo reingesetzt. Die Ortsangabe faellt raus; wo das Logo sitzt
// und wie das Motiv es haelt, sagt allein buildPrompt. Wie oben: nur ersetzen, wenn der alte
// Wortlaut noch exakt dasteht.
// Dazu die Handwerker-Variation "a ring ... laid around the free area": ein Ring um ein Loch ist
// genau das Bild aus der Beschwerde. Jetzt liegt das Material dicht an, Werkzeuge stecken drin.
const F29_LOGO_SAETZE = [
  ['fanclub', 'prompt',
    "fan elements from the brief (scarves, flags, the home city's landmarks) may frame the composition. In the middle leave a clearly empty rectangular area, roughly one third of the width, for the club's real emblem that is added afterwards. Do not draw any emblem, crest, shield or badge anywhere - leave that area empty.",
    "fan elements from the brief (scarves, flags, the home city's landmarks) build the composition. Do not draw any emblem, crest, shield or badge anywhere."],
  ['malle-fahrt', 'prompt',
    'Leave a clearly empty area of roughly one quarter of the width for a separate club emblem that is added afterwards. Do not draw any emblem, crest, shield or badge there - leave it empty.',
    'Do not draw any emblem, crest, shield or badge anywhere.'],
  ['handwerker-shirt', 'variations',
    "a ring built from the trade's own material laid around the free area, worn and hand-made, not a clean circle",
    "the trade's own material packed tightly around the free area like a worn hand-made frame, touching its edge on every side, tools wedged into it"]
];
for (const [slug, feld, alt, neu] of F29_LOGO_SAETZE) {
  try {
    const m = await mottos.get(slug);
    if (m && typeof m[feld] === 'string' && m[feld].includes(alt)) {
      m[feld] = m[feld].replace(alt, neu);
      await mottos.save(m);
      console.log('Fassung 29: Logo-Text in', slug, feld, 'nachgezogen');
    }
  } catch (e) { console.error('Fassung 29 Logo-Migration:', slug, e && e.message ? e.message : e); }
}
// Fassung 31 (Markus, 14. Sept.): Das Handwerker-Shirt ist ein Einzelstueck - es laeuft ueber die
// Firmenkunden, die Namensliste und die Aufteilung "Wo sollen die Namen hin?" sind dort unnoetig.
// Ob die ganze Firma es braucht, wird erst gefragt, wenn das Design steht (Knopf in den
// Firmenbereich). Feld "namen" raus, Kaderliste aus. Idempotent: nur wenn das Feld noch da ist.
try {
  const m = await mottos.get('handwerker-shirt');
  if (m && ((m.fields || []).some(f => f.personal) || m.kader !== false)) {
    m.fields = (m.fields || []).filter(f => !f.personal);
    m.kader = false;
    await mottos.save(m);
    console.log('Fassung 31: Handwerker-Shirt ohne Namensliste und Aufteilung');
  }
} catch (e) { console.error('Fassung 31 Handwerker-Einzelstueck:', e && e.message ? e.message : e); }

// Fassung 29: Das Firmenlogo war mit 30 Prozent Sollbreite ein Medaillon im Motiv (Harmstorf-
// Screenshot: winziges Logo im Tornetz). Das Logo ist das Herz des Designs, also 40 Prozent -
// derselbe Wert, den der Prompt jetzt fuer die freie Flaeche verlangt. Nur den alten Standard
// anfassen, einen bewusst anders gesetzten Wert nicht.
try {
  const m = await mottos.get('handwerker-shirt');
  if (m && m.upload && +m.upload.widthPct === 30) {
    m.upload.widthPct = 40;
    await mottos.save(m);
    console.log('Fassung 29: Handwerker-Logo Sollbreite 30 -> 40 Prozent');
  }
} catch (e) { console.error('Fassung 29 Logo-Breite:', e && e.message ? e.message : e); }

// Feld "Worauf spielt das Motto an?" (bezug) bei den Recherche-Mottos (Abi/Schulmotto).
// Nicht im Bild (printed:false), fliesst als Bezug in die Recherche. Wird bei JEDER Anfrage
// deterministisch eingefuegt (direkt unter dem Motto-Feld) - unabhaengig vom gespeicherten
// Zustand, ohne die Motto-Dateien zu veraendern. Kein Startup-Schreiben mehr.
const BEZUG_FIELD = {
  key: 'bezug', label: 'Worauf spielt das Motto an?', type: 'text',
  required: false, printed: false, personal: false, max: 40,
  placeholder: 'z. B. Film Titanic oder das Wort Abitur',
  hint: 'Hilft Otto, das Wortspiel zu erkennen. Steht nicht auf dem Shirt.'
};
// Generisches Feld "Was soll noch aufs Design?" - optionaler Freitext, der als Motiv/Atmosphaere
// in den Bild-Prompt einfliesst (nicht als Text erzwungen). Wird bei jeder Anfrage angehaengt,
// ausser das Motto bringt schon ein eigenes 'extra'-Feld mit oder schaltet es per noExtra ab.
const EXTRA_FIELD = {
  key: 'extra', label: 'Was soll noch aufs Design?', type: 'text',
  required: false, printed: false, personal: false, max: 60,
  placeholder: 'z. B. ein bestimmtes Motiv, Detail oder eine Idee …',
  hint: 'Fließt in die Gestaltung ein und wird als Bildmotiv aufgegriffen. Erscheint nicht als Text im Design.'
};
// Passender Beispieltext je Motto (nur Platzhalter, keine Pflicht). Fallback: EXTRA_FIELD.placeholder.
const EXTRA_EXAMPLES = {
  abi: 'z. B. Maskottchen, ein Insider oder euer Jahrgangs-Symbol',
  junggesellenabschied: 'z. B. ein Insider, ein Getränk oder ein lustiges Detail',
  'malle-fahrt': 'z. B. Palme, Eimer, Sonnenbrille',
  fanclub: 'z. B. euer Maskottchen oder ein Symbol',
  'tier-shirt': 'z. B. Rasse, Zubehör oder ein typisches Detail',
  abschlussfahrt: 'z. B. Reiseziel, Bus oder ein Insider',
  'kinder-tiershirt': 'z. B. Lieblingsfarbe, Zubehör oder ein Detail',
  'angler-shirt': 'z. B. Zielfisch, Köder oder das Gewässer',
  'jaeger-shirt': 'z. B. Wildart, Revier oder ein Detail',
  'landwirt-shirt': 'z. B. Tierart, Gerät oder ein Hof-Detail',
  'motorrad-shirt': 'z. B. Strecke, Zubehör oder ein Detail',
  'sprueche-shirt': 'z. B. ein passendes Symbol oder Detail',
  familie: 'z. B. Anzahl Kinder, Haustier oder ein Symbol',
  karneval: 'z. B. Kostüm-Thema, Symbol oder Detail',
  'geburt-baby': 'z. B. Sternzeichen, Kuscheltier oder ein Symbol',
  geburtstag: 'z. B. das Alter, ein Hobby oder ein Symbol',
  kegeltour: 'z. B. Kegel, Getränk oder ein Insider',
  schulmotto: 'z. B. ein Symbol oder Maskottchen',
  firmenausflug: 'z. B. Branche, Ziel oder ein Symbol',
  vereinsjubilaeum: 'z. B. Gründungsjahr oder Vereins-Symbol'
};
// Nur-Logo-Druck: manche wollen gar kein gezeichnetes Design, sondern genau ihre Logos auf dem Teil -
// der Fanclub sein Wappen und das des Vereins, der Handwerksbetrieb sein Firmenlogo. Dann laeuft
// gar keine Bild-KI: die Logos werden unveraendert gesetzt. Das Feld wird bei Mottos mit nurLogo
// deterministisch eingefuegt, genau wie 'bezug' und 'extra'.
const AUFBAU_VOLL = 'Volles Design mit Motiv';
const AUFBAU_NUR_LOGO = 'Nur unsere Logos, ohne Motiv';
const AUFBAU_FIELD = {
  // Pflicht, weil es die Grundsatzfrage ist: mit dieser Antwort steht oder faellt alles
  // Weitere. Eine leere Vorauswahl wuerde den Kunden nur raten lassen.
  key: 'aufbau', label: 'Wie soll das Produkt aussehen?', type: 'select',
  required: true, printed: false, personal: false,
  options: [AUFBAU_VOLL, AUFBAU_NUR_LOGO],
  hint: 'Bei „Nur unsere Logos“ zeichnet Otto nichts dazu – eure Logos werden unverändert gesetzt, dazu höchstens ein, zwei kurze Zeilen.'
};
const GROESSE_FIELD = {
  key: 'logogroesse', label: 'Wie groß sollen die Logos sein?', type: 'select',
  required: false, printed: false, personal: false,
  options: ['klein', 'mittel', 'gross'],
  hint: 'Wo der Druck sitzen soll, wählt ihr weiter unten.'
};
const nurLogoGewaehlt = (v) => String((v || {}).aufbau || '') === AUFBAU_NUR_LOGO;
// Welche Zeilen kommen beim Nur-Logo-Druck unter die Logos? Hoechstens drei, und nur was der
// Kunde wirklich eingetragen hat - keine erfundenen Zusaetze. Reihenfolge: Name, Kuerzel/Zusatz,
// Ort oder Jahr. Felder, die nicht aufs Teil gehoeren (printed:false), bleiben aussen vor.
function nurLogoZeilen(motto, values) {
  const v = values || {};
  const darf = (k) => (motto.fields || []).some(f => f.key === k && f.printed !== false && !f.personal);
  const nimm = (...keys) => { for (const k of keys) if (darf(k) && String(v[k] || '').trim()) return String(v[k]).trim(); return ''; };
  const jahr = darf('jahr') && String(v.jahr || '').trim() ? 'SEIT ' + String(v.jahr).trim() : '';
  return [
    nimm('fanclub', 'firma', 'verein', 'gruppe'),
    nimm('kuerzel', 'zusatz', 'spruch'),
    jahr || nimm('ort', 'abteilung', 'spruch2')
  ].filter(Boolean).slice(0, 3);
}

function withBezug(m) {
  if (!m) return m;
  let fields = (m.fields || []).filter(f => f.key !== 'bezug');
  // Aufbau-Wahl nur bei Mottos, die das anbieten - ganz oben, sie aendert alles Weitere.
  if (m.nurLogo === true && !fields.some(f => f.key === 'aufbau')) {
    fields.unshift({ ...AUFBAU_FIELD }, { ...GROESSE_FIELD });
  }
  // "Worauf spielt das Motto an?" nur bei Wortspiel-Recherche (Abi/Schulmotto), nicht beim Verein.
  if (m.research === true && m.researchKind !== 'verein') {
    const rf = m.researchField || 'motto';
    let at = fields.findIndex(f => f.key === rf);
    at = at >= 0 ? at + 1 : 1;
    fields.splice(at, 0, { ...BEZUG_FIELD });
  }
  // "Was soll noch aufs Design?" fuer alle Mottos - ausser abgeschaltet oder schon vorhanden.
  if (m.noExtra !== true && !fields.some(f => f.key === 'extra')) {
    fields.push({ ...EXTRA_FIELD, placeholder: EXTRA_EXAMPLES[m.slug] || EXTRA_FIELD.placeholder });
  }
  // 1./2. Okt., Markus: bei den Mottos mit Figuren zuerst das Foto (freiwillig) - siehe gruppenFoto.
  if (gruppenFoto(m) && !fields.some(f => f.key === 'foto')) fields.unshift(...GRUPPENFOTO_FELDER.map(f => ({ ...f })));
  return { ...m, fields, gruppenFoto: gruppenFoto(m) };
}

const accounts = accountStore(STORE, SIGN_SECRET);
await accounts.ready();

// ---------- Taegliches Backup nach Google Drive (Schutz gegen Datenverlust / Hacker) ----------
// Sichert storage/ als tar.gz nach "Motto Otto/Backups/" - ohne masters/mockups/vectors (liegen je Design
// bereits in Drive bzw. sind aus dem Master ableitbar), ohne queue/ und ohne gdrive.json (Zugangsdaten).
// Markus, 22. Sept. 2026: "Wir muessen noch eine Sicherheit einbauen, dass wir eine feste Uhrzeit
// haben, auf die wir zurueckgreifen koennen - dass am Tag mal irgendwas schiefgelaufen ist. Das
// war ueberhaupt nicht gut. Dass wir zumindest auf den Stand von mir aus um 8:00 Uhr morgens und
// einmal um 14:00 Uhr zurueckgehen koennen."
//
// Bis dahin gab es EINEN Stand pro Tag, nachts um 3 Uhr UTC. Geht zwischen morgens und abends
// etwas kaputt, ist der einzige Rueckkehrpunkt die vergangene Nacht - alles vom Tag waere weg.
// Jetzt sind es feste Uhrzeiten, standardmaessig 8 und 14 Uhr, und zwar DEUTSCHE Zeit: sonst
// stimmen sie nur im Winter und verschieben sich im Sommer um eine Stunde.
//
// Jede Uhrzeit bekommt ihre eigene Datei (motto-otto-2026-09-22-08.tar.gz), sonst ueberschriebe
// der Mittagsstand den Morgenstand - beim alten Namen ohne Stunde waere genau das passiert.
// Vorhaltung BACKUP_KEEP zaehlt DATEIEN, bei zwei Staenden am Tag sind 28 also 14 Tage.
const BACKUP_FILE = path.join(STORE, 'backup.json');
const BACKUP_ZONE = env.BACKUP_ZONE || 'Europe/Berlin';
const BACKUP_ZEITEN = zeitenAus(env.BACKUP_ZEITEN);
const BACKUP_KEEP = Math.max(1, +env.BACKUP_KEEP || 28);
const standJetzt = (d) => faelligerStand(d, { zeiten: BACKUP_ZEITEN, zone: BACKUP_ZONE });
let backupRunning = false;
async function backupLog() { try { return JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8')); } catch (e) { return []; } }
async function runBackup(trigger, stand = null) {
  if (backupRunning) return { ok: false, error: 'Backup laeuft bereits' };
  backupRunning = true;
  const s = stand || jetztInZone(new Date(), BACKUP_ZONE);
  const nr = naechsteNummer(await backupLog());
  const entry = { at: new Date().toISOString(), trigger, ok: false, nr, tag: s.tag, stunde: s.stunde };
  const tmp = path.join(os.tmpdir(), `mo-backup-${Date.now()}.tar.gz`);
  try {
    if (!(await drive.status()).connected) throw new Error('Google Drive nicht verbunden');
    await execFileP('tar', ['-czf', tmp, '-C', STORE, '--exclude=./masters', '--exclude=./mockups', '--exclude=./vectors', '--exclude=./queue', '--exclude=./gdrive.json', '.'], { timeout: 600000, maxBuffer: 1024 * 1024 });
    const buf = await fs.readFile(tmp);
    // Die Stunde MUSS in den Namen: sonst traegt der Mittagsstand denselben Namen wie der
    // Morgenstand, und Drive haette am Ende nur noch einen der beiden.
    const name = standName(s, nr);
    await drive.upload(['Backups'], name, buf, 'application/gzip');
    entry.ok = true; entry.file = name; entry.size = buf.length;
    try { entry.pruned = (await drive.pruneFolder(['Backups'], BACKUP_KEEP)).trashed || 0; }
    catch (e) { entry.pruneError = String(e && e.message ? e.message : e).slice(0, 200); }
  } catch (e) {
    entry.error = String(e && e.message ? e.message : e).slice(0, 300);
    console.error('Backup:', entry.error);
  } finally {
    backupRunning = false;
    try { await fs.rm(tmp, { force: true }); } catch (e) { /* egal */ }
    try { const list = await backupLog(); list.unshift(entry); await fs.writeFile(BACKUP_FILE, JSON.stringify(list.slice(0, 30), null, 2)); } catch (e) { /* egal */ }
  }
  return entry;
}
// Zeitplan: alle 15 Minuten pruefen, ob der faellige feste Stand schon gesichert ist.
// Gezaehlt wird je TAG UND UHRZEIT, nicht je Tag - sonst bliebe es bei einem Stand taeglich.
// Steht der Server um 8 Uhr still und kommt um 9 wieder hoch, wird der 8-Uhr-Stand nachgeholt:
// faelligerStand() liefert die zuletzt erreichte Uhrzeit, nicht nur die exakt getroffene.
async function backupTick() {
  try {
    const faellig = standJetzt();
    if (!faellig) return;
    if (schonGesichert(await backupLog(), faellig)) return;
    if (!(await drive.status()).connected) return; // ohne Drive still bleiben - das Backend zeigt es rot an
    await runBackup('auto', faellig);
  } catch (e) { console.error('Backup-Zeitplan:', e && e.message ? e.message : e); }
}
setTimeout(backupTick, 120000);
setInterval(backupTick, 15 * 60000);

// ---------- Mail-Protokoll: jede Mail mit Empfaenger, Betreff und Brevo-Antwort (messageId) oder Fehler ----------
// Damit sich im Backend nachvollziehen laesst, ob eine Mail ueberhaupt rausging und wohin (letzte 100).
const MAILLOG_FILE = path.join(STORE, 'maillog.json');
async function logMail(entry) {
  let list = [];
  try { list = JSON.parse(await fs.readFile(MAILLOG_FILE, 'utf8')); } catch (e) { list = []; }
  list.unshift({ at: new Date().toISOString(), ...entry });
  try { await fs.writeFile(MAILLOG_FILE, JSON.stringify(list.slice(0, 100), null, 2)); } catch (e) { /* Protokoll darf den Versand nie blockieren */ }
}
// Fassung 69 (Markus, 16. Sept.): Woerter, die aus einer Bedienoberflaeche stammen und nie zu einem
// Logo gehoeren - Web-Adresse, Uhrzeit, Prozentwert, Pfeile. Wird an zwei Stellen gebraucht: beim
// Nachzeichnen einer Vorlage und beim eingearbeiteten Logo im Design.
const BILDSCHIRM_WORT = /^(?:\d{1,2}[:.]\d{2}|\d{1,3}\s*%|[<>×✕✖←→⌂⋯]|https?:\/\/\S+|www\.\S+|\S+\.(?:de|com|net|org|eu|io|shop)(?:\/\S*)?)$/i;

async function mailLogged(opts) {
  try {
    const r = await sendMail(opts);
    await logMail({ to: opts.to, subject: opts.subject, ok: !!r.sent, messageId: r.messageId || null, logged: !!r.logged });
    return r;
  } catch (e) {
    await logMail({ to: opts.to, subject: opts.subject, ok: false, error: String((e && e.message) || e).slice(0, 300) });
    throw e;
  }
}
const ACCOUNTS_ON = String(env.ACCOUNTS).toLowerCase() === 'on';
let stripeCfg = null;
try { stripeCfg = await setupStripe({ secretKey: env.STRIPE_SECRET_KEY, storeDir: STORE, baseUrl: env.PUBLIC_BASE_URL }); }
catch (e) { console.error('Stripe-Einrichtung fehlgeschlagen:', e && e.message ? e.message : e); }
const SECURE = String(env.PUBLIC_BASE_URL).startsWith('https');
const drive = gdrive({ clientId: env.GDRIVE_CLIENT_ID, clientSecret: env.GDRIVE_CLIENT_SECRET, storeDir: STORE, baseUrl: env.PUBLIC_BASE_URL, rootName: env.GDRIVE_ROOT || 'Motto Otto' });

// ---------- Der Name einer Druckdatei ----------
// Die Druckerei arbeitet mit dem DATEINAMEN, nicht mit unserer Oberflaeche. Was zum
// Verarbeiten noetig ist, muss also im Namen stehen: fortlaufende Nummer samt Gesamtzahl
// (damit sofort auffaellt, wenn eine Datei fehlt), Stueckzahl, Artikel und Groesse.
// EINE Funktion fuer Download und Google Drive - zwei getrennte Stellen waeren nach der
// ersten Aenderung auseinandergelaufen, und dann heisst dieselbe Datei zweimal anders.
//
// Aufbau:  <Design-Nr>_<lfd>von<gesamt>_x<Stueck>_<ARTIKEL>-<GROESSE>_<Name>_<Art>
// Beispiel: MO-GEBURTBA-20260909-Y5DZ_03von12_x1_HOODIE-L_Lasse_PRINT.png
// Ohne Namensliste gibt es nur eine Datei:  ..._GRUNDMOTIV_PRINT.png
const sauber = (t) => String(t == null ? '' : t).replace(/[^A-Za-z0-9ÄÖÜäöüß]+/g, '-').replace(/^-+|-+$/g, '');
function druckDateiName(j, { n = -1, art = 'PRINT', endung = 'png' } = {}) {
  // Die Auftragsnummer steht GANZ VORNE: dann sortiert jeder Dateimanager und jedes
  // Druckprogramm die Dateien von allein in der Reihenfolge, in der die Auftraege
  // hereingekommen sind. Designs von vor dem Einbau haben keine - die bleiben ohne.
  const nr = +(j && j.lfdNr) > 0 ? String(j.lfdNr).padStart(5, '0') + '_' : '';
  const id = nr + ((j && j.designId) || 'DESIGN');
  const leute = (j && j.people) || [];
  const namen = (j && j.names) || [];
  const gesamt = Math.max(leute.length, namen.length);
  if (art === 'RUECKSEITE') return `${id}_RUECKSEITE${gesamt ? '_' + gesamt + '-Namen' : ''}.${endung}`;
  // Die Grunddatei traegt die Gesamtzahl mit: die Druckerei sieht an EINER Datei, wie viele
  // Einzeldateien zu diesem Auftrag gehoeren - und merkt sofort, wenn welche fehlen.
  if (!(n >= 0) || !gesamt) return `${id}_GRUNDMOTIV${gesamt ? '_' + gesamt + '-Stueck' : ''}_${art}.${endung}`;
  const p = leute[n] || {};
  const name = p.name || namen[n] || '';
  const lfd = String(n + 1).padStart(2, '0');
  const ware = [sauber(p.garment) || 'TEXTIL', sauber(p.size)].filter(Boolean).join('-').toUpperCase();
  // Stueckzahl: eine Zeile der Kaderliste ist genau ein Teil. Sollte spaeter eine Bestellung
  // mehrere Stueck derselben Person vorsehen, steht die Zahl schon an der richtigen Stelle.
  const stueck = Math.max(1, +p.menge || 1);
  return [id, `${lfd}von${gesamt}`, `x${stueck}`, ware, sauber(name), art].filter(Boolean).join('_') + '.' + endung;
}

// Druckdateien eines Designs zu Google Drive: Grunddatei plus je Name eine Datei
async function pushToDrive(designId) {
  const st = await drive.status();
  if (!st.connected) return { skipped: true };
  const j = await readJob(designId);
  const motto = (j && j.motto) || 'sonstige';
  const base = await fs.readFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`));
  const parts = [motto, designId];
  const done = [];
  await drive.upload(parts, `${designId}_PRINT_MASTER.png`, base, 'image/png');
  done.push(`${designId}_PRINT_MASTER.png`);
  // Vektor-Druckdatei (SVG) - wird einmal gebaut und danach aus dem Cache genommen
  try {
    const svg = await masterSvg(designId);
    if (svg) { await drive.upload(parts, `${designId}_PRINT_VECTOR.svg`, Buffer.from(svg), 'image/svg+xml'); done.push(`${designId}_PRINT_VECTOR.svg`); }
  } catch (e) { console.error('SVG fuer Drive:', e && e.message ? e.message : e); }
  const kader = !!(j && j.aufteilung && j.aufteilung !== 'vorne' && j.names && j.names.length);
  if (j && j.names && j.names.length) {
    for (let i = 0; i < j.names.length; i++) {
      // Abi-Klassiker (brust-kader): vorne nur der kleine Brust-Print mit Namen, hinten das grosse Motiv mit allen Namen
      const { buf } = j.aufteilung === 'brust-kader' ? await chestMaster(designId, i) : await masterWithName(designId, i);
      const fn = druckDateiName(j, { n: i, art: j.aufteilung === 'brust-kader' ? 'BRUST' : 'PRINT' });
      await drive.upload(parts, fn, buf, 'image/png');
      done.push(fn);
    }
    // Bestellliste (Namen + Groessen + Artikel) fuer die Produktion
    try {
      const csv = rosterCsv(j.people && j.people.length ? j.people : j.names.map(n => ({ name: n })), { motto, designId, textile: j.textile, aufteilung: j.aufteilung || 'vorne' });
      await drive.upload(parts, `${designId}_BESTELLLISTE.csv`, Buffer.from(csv, 'utf8'), 'text/csv'); done.push(`${designId}_BESTELLLISTE.csv`);
    } catch (e) { console.error('Bestellliste fuer Drive:', e && e.message ? e.message : e); }
  }
  if (kader) {
    try {
      const back = await backMaster(designId);
      await drive.upload(parts, `${designId}_RUECKEN_KADER.png`, back, 'image/png'); done.push(`${designId}_RUECKEN_KADER.png`);
    } catch (e) { console.error('Kader fuer Drive:', e && e.message ? e.message : e); }
  }
  try {
    const info = { designId, motto, values: j && j.values, names: j && j.names, people: j && j.people, aufteilung: j && j.aufteilung, style: j && j.style, textile: j && j.textile, created: j && j.created };
    await drive.upload(parts, `${designId}_INFO.json`, Buffer.from(JSON.stringify(info, null, 2)), 'application/json');
  } catch (e) { /* Info ist Beiwerk */ }
  j.drive = { at: new Date().toISOString(), files: done };
  await fs.writeFile(path.join(STORE, 'jobs', `${designId}.json`), JSON.stringify(j, null, 2));
  return { files: done };
}

// Start-Mottos aus seed.json sicherstellen: fehlende Slugs anlegen, vorhandene NIE ueberschreiben
// (deine Aenderungen im Admin bleiben unangetastet). So kommen neue Mottos auch nach dem ersten
// Start noch per Deploy in den Shop.
{
  try {
    const seed = JSON.parse(await fs.readFile(new URL('./seed.json', import.meta.url)));
    const bySlug = new Map((await mottos.all()).map(m => [m.slug, m]));
    let added = 0, upgraded = 0;
    for (const m of seed) {
      const rev = +m.rev || 1;
      const e = bySlug.get(m.slug);
      if (!e) {
        await mottos.save({ ...m, seedRev: rev });
        added++;
      } else if (!e.userEdited && (+e.seedRev || 0) < rev) {
        // Sichere Teil-Aktualisierung: nur Prompt/Felder/Upload/Intro aus der Vorlage
        // uebernehmen, alles andere (Beispielbild, aktiv, Reihenfolge ...) bleibt erhalten.
        await mottos.save({
          ...e,
          // Fassung 76: Der NAME war bisher nicht dabei - ein Deploy konnte also alles an einem
          // Motto aktualisieren, nur nicht, wie es heisst. Genau das war aber faellig: die
          // Mottos hiessen "Sprueche-Shirt", "Tier-Shirt", "Abi-Shirt", obwohl wir laengst
          // Tassen, Kissen, Strandtuecher und Fussmatten bedrucken. Wie bei headline und text
          // nur, wenn die Vorlage ihn wirklich nennt - und ohnehin nur, solange niemand das
          // Motto im Backend angefasst hat (userEdited).
          name: m.name !== undefined ? m.name : e.name,
          intro: m.intro, fields: m.fields, upload: m.upload, prompt: m.prompt,
          suggestions: m.suggestions, suggestField: m.suggestField,
          research: m.research, researchField: m.researchField,
          nameZone: m.nameZone, nameFont: m.nameFont,
          backPrompt: m.backPrompt, backNamesField: m.backNamesField,
          headline: m.headline !== undefined ? m.headline : e.headline, text: m.text !== undefined ? m.text : e.text,
          variations: m.variations !== undefined ? m.variations : e.variations,
          markenfrei: m.markenfrei !== undefined ? m.markenfrei : e.markenfrei,
          kader: m.kader !== undefined ? m.kader : e.kader,
          seedRev: rev
        });
        upgraded++;
      }
    }
    if (added || upgraded) console.log('Start-Mottos: neu', added, '· aktualisiert', upgraded);
  } catch (e) {
    console.error('Start-Mottos konnten nicht angelegt werden:', e && e.message ? e.message : e);
  }
}

// Einmalige Motto-Korrekturen beim Start (nicht-fatal): laufen auch fuer von Hand angelegte Mottos.
async function migrateMottos() {
  // Junggesellenabschied: Rolle mit Umlaut, so wie sie gedruckt wird
  const jga = await mottos.get('junggesellenabschied');
  if (jga) {
    const f = jga.fields.find(x => x.key === 'rolle' && x.type === 'select');
    if (f && f.options.includes('BRAEUTIGAM')) {
      f.options = f.options.map(o => o === 'BRAEUTIGAM' ? 'BRÄUTIGAM' : (o === 'TEAM BRAEUTIGAM' ? 'TEAM BRÄUTIGAM' : o));
      await mottos.save(jga);
      console.log('Rolle BRAEUTIGAM -> BRÄUTIGAM');
    }
  }
  // Kegeltour: Farben nur in der Style-Zeile, nicht in den Textzeilen (sonst beissen sie sich mit gewaehlten Stilen)
  const kt = await mottos.get('kegeltour');
  if (kt && /in cream lettering with a cherry red outline/.test(kt.prompt || '')) {
    kt.prompt = kt.prompt
      .replace(/reading exactly "\{club\}", in cream lettering with a cherry red outline/, 'reading exactly "{club}", as the biggest lettering')
      .replace(/reading exactly "\{ziel\}" in big cream block letters with a red outline/, 'reading exactly "{ziel}" in big block letters')
      .replace(/a small round cherry red badge with cream text reading exactly "\{jahr\}"/, 'a small round badge reading exactly "{jahr}"')
      .replace(/a curved cream script line with a red outline reading exactly "\{spruch\}"/, 'a curved script line reading exactly "{spruch}"');
    await mottos.save(kt);
    console.log('Kegeltour-Prompt: Farben aus den Textzeilen genommen');
  }
  // Abi zusammenlegen: doppeltes "abi-shirt" entfernen, "abi" mit Name-vorne + Rueckseite ausstatten.
  try {
    if (await mottos.get('abi-shirt')) { await mottos.remove('abi-shirt'); console.log('abi-shirt entfernt (in abi zusammengelegt)'); }
    const seed = JSON.parse(await fs.readFile(new URL('./seed.json', import.meta.url)));
    const seedAbi = seed.find(m => m.slug === 'abi');
    const abi = await mottos.get('abi');
    if (abi && seedAbi && !abi.fields.some(f => f.personal)) {
      await mottos.save({
        ...abi,
        intro: seedAbi.intro, fields: seedAbi.fields, prompt: seedAbi.prompt,
        suggestions: seedAbi.suggestions, suggestField: seedAbi.suggestField,
        research: seedAbi.research, researchField: seedAbi.researchField,
        nameZone: seedAbi.nameZone, nameFont: seedAbi.nameFont,
        backPrompt: seedAbi.backPrompt, backNamesField: seedAbi.backNamesField,
        seedRev: seedAbi.rev || 2
      });
      console.log('Abi zusammengelegt: Name vorne je Shirt + alle Namen auf der Rueckseite');
    }
  } catch (e) { console.error('Abi-Merge:', e && e.message ? e.message : e); }
  // 2. Okt. (Markus: "verhindern, dass wir einfach eine richtige Platte da draufhaben"): der Abi-Ruecken
  // schloss Kopf, Seitenleisten und Fuss zu einem Rahmen. Wer noch den alten Auftrag aus der Saat traegt,
  // bekommt den neuen (ohne Rahmen); von Hand geaenderte Auftraege bleiben.
  try {
    const seedAbi = JSON.parse(await fs.readFile(new URL('./seed.json', import.meta.url))).find(m => m.slug === 'abi');
    const abi = await mottos.get('abi');
    if (abi && seedAbi && !abi.userEdited && /two narrow vertical borders run down the sides/.test(abi.backPrompt || '') && abi.backPrompt !== seedAbi.backPrompt) {
      await mottos.save({ ...abi, backPrompt: seedAbi.backPrompt });
      console.log('Abi-Ruecken: Auftrag ohne geschlossenen Rahmen');
    }
  } catch (e) { console.error('Abi-Ruecken:', e && e.message ? e.message : e); }
  // Abi: die aktuell beliebtesten Mottos als Vorschlaege sicherstellen (auch wenn im Backend editiert)
  try {
    const abiM = await mottos.get('abi');
    if (abiM) {
      const top = ['ABI Vegas – Hoch gepokert, alles gewonnen', 'Hakuna MatABI – keine Sorgen mehr, nur Freiheit', 'WhatsABI – zuletzt online 2026', 'Abicetamol – der Schmerz hat ein Ende', 'WasABI – der schärfste Jahrgang aller Zeiten'];
      const cur = String(abiM.suggestions || '');
      const missing = top.filter(w => !cur.includes(w.split(' – ')[0]));
      if (missing.length) {
        abiM.suggestions = (missing.join('\n') + (cur ? '\n' + cur : '')).trim();
        await mottos.save(abiM);
        console.log('Abi-Vorschlaege ergaenzt:', missing.length);
      }
    }
  } catch (e) { console.error('Abi-Vorschlaege:', e && e.message ? e.message : e); }
  // Neue Mottos (Angler, Jaeger, Landwirt, Motorrad, Kinder-Tiershirt, Abschlussfahrt): Motiv-Listen statt einem festen Motiv
  const NEU = {
    "angler-shirt": "central motif: a leaping pike with open jaws snapping at a lure, water splash\ncentral motif: a brown trout jumping out of a stream, fly rod and dry fly\ncentral motif: a big carp lifted out of the water, landing net and rod pod\ncentral motif: a zander (pikeperch) hunting between reeds at dusk\ncentral motif: a giant catfish rising from a dark lake, moon above\ncentral motif: a perch with spiky dorsal fin striking a spinner\ncentral motif: a salmon leaping up a waterfall\ncentral motif: an angler's silhouette casting from a rowing boat at sunrise, fish jumping\ncentral motif: a fishing rod bent to the limit, line tight, fish shadow below the surface\ncentral motif: a tackle box, lures and a reel arranged like a crest with a fish on top\ncentral motif: an eel curling around a fishing hook\ncentral motif: a fisherman in waders standing in a river, rod raised, fish on the line",
    "jaeger-shirt": "central motif: a majestic stag head with wide antlers, pine trees and a moon\ncentral motif: a wild boar charging through the undergrowth\ncentral motif: a roe deer standing at the forest edge in morning mist\ncentral motif: a fox sneaking through tall grass\ncentral motif: a hunting dog (a dachshund or a German pointer) on the scent\ncentral motif: a high seat (raised hide) at the edge of a field at dawn, deer in the distance\ncentral motif: a flying duck over reeds\ncentral motif: a pheasant taking off from a field\ncentral motif: crossed hunting rifles behind a stag skull with antlers and oak leaves\ncentral motif: a hunting horn with oak leaves and acorns\ncentral motif: a hare in a winter field under a big moon\ncentral motif: a hunter's silhouette with dog walking into the forest at sunset",
    "landwirt-shirt": "central motif: a strong classic tractor on a field with wheat ears and a rising sun\ncentral motif: a big combine harvester cutting a golden wheat field\ncentral motif: a tractor pulling a loaded hay trailer at sunset\ncentral motif: a vintage old-timer tractor with big rear wheels in front of a barn\ncentral motif: a tractor with a plough turning dark soil, crows following\ncentral motif: a round-baler and hay bales in a field\ncentral motif: a forage harvester and a tractor with trailer side by side\ncentral motif: a milk cow with a bell in front of a farmhouse\ncentral motif: a pig and a rooster in front of a barn door\ncentral motif: a modern tractor with front loader lifting a big bale\ncentral motif: a slurry tanker on a green meadow with a red sun\ncentral motif: a sower's hand scattering seeds over a field, tractor in the background\ncentral motif: a farmer's silhouette leaning on a fence looking over his fields at dawn",
    "motorrad-shirt": "central motif: a powerful classic cruiser motorcycle seen from a dynamic front angle, wings behind\ncentral motif: a sports bike leaning deep into a mountain curve, speed lines\ncentral motif: a chopper with long forks on an endless straight road, sunset\ncentral motif: a big adventure touring bike with panniers on a gravel track in the mountains\ncentral motif: a vintage cafe racer in front of a brick wall\ncentral motif: a scrambler jumping over a hill, dirt flying\ncentral motif: a vintage motorcycle engine (V-twin) with flames and a piston, drawn like an emblem\ncentral motif: a skull wearing a motorcycle helmet with goggles, wings at the sides\ncentral motif: a group of three bikes riding in formation on a winding road through hills\ncentral motif: a motorcycle wheel with wings and a winding road ribbon\ncentral motif: a rider's silhouette from behind on a bike, road ahead, mountains and a big moon\ncentral motif: a classic bike parked in front of a mountain pass sign, curvy road below",
    "kinder-tiershirt": "pose: the animal waving happily, standing on a little hill\npose: the animal peeking out from behind the name letters\npose: the animal sitting and holding a balloon\npose: the animal jumping over a rainbow\npose: the animal riding a tiny skateboard\npose: the animal hugging a big star\npose: the animal with a party hat and confetti\npose: the animal sleeping curled up under a crescent moon\npose: the animal wearing a little crown\npose: the animal in a rocket flying past planets",
    "abschlussfahrt": "central motif: a suitcase covered in travel stickers with a pennant\ncentral motif: a tour bus on a winding road with the team waving from the windows (abstract figures)\ncentral motif: a compass rose and a folded map with a route line\ncentral motif: a globe with a pin in the destination\ncentral motif: a vintage travel ticket layout with stamps\ncentral motif: a mountain range with a rising sun and a road\ncentral motif: a city skyline silhouette of the destination in a badge\ncentral motif: a backpack, a camera and a pennant arranged like a crest\ncentral motif: a big year number block with a travel stamp\ncentral motif: a train crossing a bridge, steam or speed lines",
    "sprueche-shirt": "layout: the saying stacked in three bold lines of different sizes, key word biggest\nlayout: the saying arched inside a round retro badge with a thin double ring\nlayout: the saying on a waving ribbon banner with the icon above it\nlayout: the saying as a hand-lettered brush script with one word in block capitals\nlayout: the saying in a tall condensed block with a horizontal rule and the icon centered\nlayout: the saying as a vintage sign-painter style with a drop shadow and small flourishes\nlayout: the saying split in two colours, one word highlighted in a rounded box\nlayout: the saying arranged in a circle around the icon\nlayout: the saying as a big speech bubble shape\nlayout: the saying in an old-school ticket/stamp layout with perforated edges",
    "karneval": "central motif: a jester hat with bells and a venetian mask, confetti and streamers\ncentral motif: a confetti cannon firing a burst of confetti and streamers\ncentral motif: a laughing jester face with a big red nose\ncentral motif: a marching-band bass drum with sticks, confetti flying\ncentral motif: a carnival float with cheering abstract figures throwing sweets\ncentral motif: a feathered mask with sparkles and streamers\ncentral motif: three raised hands holding streamers, balloons and a tambourine\ncentral motif: a bunch of balloons with a jester hat on top\ncentral motif: a giant clown nose and bow tie with confetti\ncentral motif: a fanfare trumpet with streamers and stars\ncentral motif: a crown of a carnival prince with confetti rain\ncentral motif: a dancing funky-guard boot (Funkenmariechen boot) with a tricorn hat",
    "familie": "accent motif: a big heart behind the role word with the names written inside a small banner\naccent motif: a little crown sitting on the role word\naccent motif: a family tree with roots, small hearts as leaves\naccent motif: a big bear with three small cubs, drawn as friendly silhouettes\naccent motif: a rising sun with rays behind the lettering\naccent motif: a cozy house with smoke from the chimney and small hearts\naccent motif: two big hands holding three small hands, drawn simply\naccent motif: a laurel wreath around the role word, a small star on top\naccent motif: a rocking chair with a mug and a small heart\naccent motif: a paper-chain of little figures holding hands\naccent motif: a ribbon medal like a first prize with the names on the ribbon\naccent motif: a vintage badge shape with stars and a heart"
};
  for (const [slug, v] of Object.entries(NEU)) {
    const m = await mottos.get(slug);
    if (!m || (m.variations && m.variations.trim())) continue;
    m.variations = v;
    if (/^Central motif: /m.test(m.prompt || '')) {
      m.prompt = m.prompt.replace(/^Central motif: [^\n]*/m, 'The central motif and the arrangement follow the variation given below - a different picture every time.' + (slug === 'jaeger-shirt' ? ' Never gory.' : ''));
    }
    if (slug === 'kinder-tiershirt') m.prompt = m.prompt.replace('as the main motif, rounded shapes', 'as the main motif (pose as in the variation below), rounded shapes');
    // Die drei juengsten Mottos (Sprueche, Karneval, Familie): festes Motiv bzw. festes Layout durch die Variation ersetzen
    if (slug === 'sprueche-shirt') m.prompt = m.prompt.replace('Strong statement-shirt look, high contrast, print-ready, balanced typographic layout.', 'The typographic arrangement follows the variation given below - a different layout every time. Strong statement-shirt look, high contrast, print-ready.');
    if (slug === 'karneval') m.prompt = m.prompt.replace('Central motif: confetti, streamers, a jester hat and mask, sparkles - festive jecke energy.', 'The central motif and the arrangement follow the variation given below - festive jecke energy, a different picture every time.');
    if (slug === 'familie') m.prompt = m.prompt.replace('A fitting warm motif as accent (a heart, a little crown or a family/roots symbol).', 'The accent motif and the arrangement follow the variation given below.');
    await mottos.save(m);
    console.log('Motiv-Liste ergaenzt bei', slug);
  }
}
migrateMottos().catch(e => console.error('Nachruestung:', e && e.message ? e.message : e));

process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e && e.message ? e.message : e));

// ---------- Tageszaehler als Kostenbremse ----------
const counter = { day: '', n: 0 };
const today = () => new Date().toISOString().slice(0, 10);
function overDailyLimit() {
  if (counter.day !== today()) { counter.day = today(); counter.n = 0; }
  if (counter.n >= +env.LIMIT_GLOBAL_DAY) return true;
  counter.n++;
  return false;
}

// ---------- Auftraege ----------
const jobs = new Map();
const queue = [];
let running = 0;

// ---------- Auftrags-Persistenz: wartende/laufende Auftraege ueberleben einen Neustart (Deploy) ----------
// Jeder Auftrag liegt als storage/queue/<jobId>.json auf dem Volume (bei Annahme, Start und Ende gesichert).
// Beim Start werden wartende und unterbrochene Auftraege neu eingereiht, fertige bleiben abrufbar,
// damit der Kunde einfach weiterpollen kann. Aeltere als 2 Tage werden aufgeraeumt.
const QUEUE_DIR = path.join(STORE, 'queue');
await fs.mkdir(QUEUE_DIR, { recursive: true });
async function saveJob(job) {
  if (!job || !job.jobId) return;
  try { await fs.writeFile(path.join(QUEUE_DIR, `${job.jobId}.json`), JSON.stringify(job)); }
  catch (e) { console.error('Auftrag sichern:', job.jobId, e && e.message ? e.message : e); }
}
async function restoreJobs() {
  let names = [];
  try { names = (await fs.readdir(QUEUE_DIR)).filter(f => f.endsWith('.json')); } catch (e) { return; }
  const cutoff = Date.now() - 2 * 86400e3;
  let requeued = 0, kept = 0;
  for (const f of names) {
    const p = path.join(QUEUE_DIR, f);
    let job;
    try { job = JSON.parse(await fs.readFile(p, 'utf8')); } catch (e) { await fs.rm(p, { force: true }); continue; }
    if (!job || !job.jobId || !(Date.parse(job.created || 0) > cutoff)) { await fs.rm(p, { force: true }); continue; }
    if (job.status === 'queued' || job.status === 'running') {
      job.restarts = (job.restarts || 0) + 1;
      // 21. Sept.: ein Auftrag mit Kundenfoto kann nach dem Neustart nicht weiterlaufen - das Foto
      // lag nur im Arbeitsspeicher. Sofort ehrlich melden, statt den Kunden Minuten warten zu lassen.
      if (job.input && job.input.foto) {
        job.status = 'error'; job.hint = 'foto'; job.error = FOTO_TEXTE.nachNeustart;
        jobs.set(job.jobId, job); await saveJob(job); kept++; continue;
      }
      if (job.restarts > 2) {
        // Schutz vor Endlosschleife, falls genau dieser Auftrag den Dienst zum Absturz bringt
        job.status = 'error'; job.hint = 'restart'; job.error = 'nach Neustart nicht wiederholbar';
        jobs.set(job.jobId, job); await saveJob(job); kept++; continue;
      }
      job.status = 'queued'; job.qa = Array.isArray(job.qa) ? job.qa : [];
      job.qa.push({ attempt: 0, pass: false, reason: 'Dienst wurde neu gestartet - Auftrag wird wiederholt' });
      jobs.set(job.jobId, job); enqueue(job); requeued++;
    } else { jobs.set(job.jobId, job); kept++; }
  }
  if (requeued || kept) console.log(`Auftraege wiederhergestellt: ${requeued} neu eingereiht, ${kept} abrufbar`);
}

function enqueue(job) { queue.push(job); saveJob(job); pump(); }
// Waechter je Auftrag: nach JOB_TIMEOUT_MS gilt der Auftrag als gescheitert und gibt seinen Platz frei,
// damit ein haengender Bilddienst nie die ganze Warteschlange blockiert.
// Die 5 Minuten von frueher passten zu quality 'medium' bei 1024x1536. Mit 'high' dauert ein
// einzelnes Bild ein Vielfaches, und ein Auftrag kann mehrere Versuche plus eine Rueckseite
// brauchen - dann lief die Uhr ab, WAEHREND noch gearbeitet wurde. Der Kunde sah einen
// Abbruch, obwohl nichts kaputt war. Darum grosszuegiger, weiter ueber JOB_TIMEOUT_MS
// einstellbar. Nach oben begrenzt, damit ein wirklich haengender Dienst nicht ewig blockiert.
const JOB_TIMEOUT_MS = Math.min(1800000, Math.max(60000, +env.JOB_TIMEOUT_MS || 900000));
// Der Anmelde-Link in der Fertig-Mail lebt laenger als die ueblichen 30 Minuten: die Mail
// kommt, waehrend der Kunde etwas anderes macht, und ein abgelaufener Link in einer
// "dein Design ist fertig"-Nachricht ist genau das Gegenteil von dem, was sie soll.
const MELDE_LOGIN_MS = 3 * 86400e3;
// Wie lange ein einzelner Bildaufruf im schlechtesten Fall braucht (ballz.js: 240 s je Aufruf).
// Reicht die Restzeit dafuer nicht mehr, wird der Schritt gar nicht erst begonnen.
const SCHRITT_MS = 260000;

// Fassung 36 (Markus, 14. Sept.): "Wir haben extra ein Topmodell, das mehr kann, und wir nutzen es
// nicht." Die Mottos standen seit dem ersten Tag auf 1024 x 1536 - auf 30 cm Ruecken sind das
// 85 dpi echt, der Rest war Hochrechnen. Jetzt bekommt jedes Format die groesste legale Leinwand
// des Bildservers (gleiches Seitenverhaeltnis, bis 3840 px Kante und 8,3 Megapixel), so wie
// Freestyle es schon tat: 1024x1536 -> 2352x3520, 1536x1024 -> 3504x2336, 1024x1024 -> 2880x2880.
// LEINWAND=klein schaltet auf die alten Werte zurueck (Kosten, Notfall).
function grosseLeinwand(size) {
  const klein = String(size || '1024x1536');
  if (String(env.LEINWAND || 'gross') === 'klein') return klein;
  const [b, h] = klein.split('x').map(Number);
  if (!(b > 0) || !(h > 0)) return klein;
  const lw = druckLeinwand([b, h]);
  return lw && lw.size ? lw.size : klein;
}
/** Bleibt weniger als `brauchtMs` bis zur Frist des Auftrags? */
const zeitKnapp = (job, brauchtMs) => !!(job && job.deadline) && (job.deadline - Date.now()) < brauchtMs;

// ---------- Wartezeit: gemessen, nicht geraten ----------
// Gemessen wurde: von den ~100 s eines Designs gehen ~98 s an den Bilddienst und nur
// ~2 s an diesen Server. Die Wartezeit haengt also fast nur daran, wie viele Bilder
// gleichzeitig laufen duerfen - nicht an unserem Code. Darum wird die Ansage aus den
// ECHTEN Laufzeiten der letzten Auftraege berechnet. Vorher stand hier "50 + Platz * 45",
// eine geratene Zahl: wer 5 Minuten hoert und 40 wartet, ist weg.
const dauern = [];
function dauerMerken(ms) { if (ms > 1000) { dauern.push(ms); if (dauern.length > 20) dauern.shift(); } }
function dauerSchnitt() {
  if (!dauern.length) return 120000;   // Startwert, bis die ersten echten Zahlen da sind
  return dauern.reduce((a, b) => a + b, 0) / dauern.length;
}
/** Geschaetzte Wartezeit in Sekunden fuer jemanden, der `vorMir` Auftraege vor sich hat. */
function wartezeitSek(vorMir) {
  const platz = Math.max(1, +env.MAX_PARALLEL_JOBS);
  const runden = Math.floor(Math.max(0, vorMir) / platz) + 1;
  return Math.round((dauerSchnitt() * runden) / 1000);
}

// ---------- Zwei verschiedene Engstellen, zwei verschiedene Grenzen ----------
// MAX_PARALLEL_JOBS sagt, wie viele Auftraege gleichzeitig LAUFEN. Davon warten sie
// ~98 % der Zeit auf den Bilddienst und tun hier gar nichts - das darf also hoch.
// Die schwere Bildarbeit hier dauert nur ~2 s je Auftrag, haelt in diesen 2 s aber
// mehrere hundert MB (die Druckdatei ist 4252 x 5433 Pixel). Liefen 12 Auftraege
// gleichzeitig in diese Phase, waere der Container weg. Darum eine EIGENE, kleine
// Grenze dafuer: viele warten draussen beim Bilddienst, wenige rechnen hier.
const MAX_BILDARBEIT = Math.max(1, +env.MAX_BILDARBEIT || 3);

// ---------- Wie viel Arbeitsspeicher haben wir, und wie nah sind wir an der Wand? ----------
// Am 18. September ist der Container an genau dieser Wand umgekippt, und niemand konnte sie
// vorher sehen. Ein Container kennt sein eigenes Limit: cgroup v2 schreibt es nach
// memory.max, v1 nach memory.limit_in_bytes. Steht dort "max" oder eine absurd grosze Zahl,
// gibt es kein eigenes Limit - dann wird nichts behauptet.
// spitzeMB ist der Hochwasserstand: Node gibt einmal geholten Speicher nicht ans System
// zurueck, und genau dieser Stand entscheidet ueber einen OOM-Abbruch - nicht der Momentwert.
let speicherSpitze = 0;
function speicherGrenzeMB() {
  for (const [datei, roh] of [['/sys/fs/cgroup/memory.max', true], ['/sys/fs/cgroup/memory/memory.limit_in_bytes', true]]) {
    try {
      const t = fsSync.readFileSync(datei, 'utf8').trim();
      if (t === 'max') continue;
      const b = Number(t);
      // Ohne eigenes Limit steht dort der ganze Maschinenspeicher (oder 2^63) - das ist keine Aussage.
      if (b > 0 && b < 64 * 1024 * 1024 * 1024) return Math.round(b / 1048576);
    } catch (e) { /* naechste Datei */ }
  }
  return null;
}
const SPEICHER_GRENZE_MB = speicherGrenzeMB();
function speicherLage() {
  try {
    const jetzt = Math.round(process.memoryUsage().rss / 1048576);
    if (jetzt > speicherSpitze) speicherSpitze = jetzt;
    return { jetztMB: jetzt, spitzeMB: speicherSpitze, grenzeMB: SPEICHER_GRENZE_MB };
  } catch (e) { return null; }
}
// Alle 20 s nachsehen, damit die Spitze auch die Momente erwischt, in denen niemand ins
// Backend schaut - eine Spitze, die nur beim Hinsehen gemessen wird, ist keine.
setInterval(() => { try { speicherLage(); } catch (e) { /* egal */ } }, 20000).unref();
let bildarbeitLaeuft = 0;
const bildarbeitWartet = [];
// 21. Sept., 08:50, live gemessen nach 3954524: die weiterfuehrenden Artikel eines Kunden
// antworteten 502 (30 s), waehrend der Server nach dem Start Kacheln, Schaufenster und
// Stilbeispiele vorbaute - alle drei Plaetze waren mit Hintergrundarbeit belegt, der Kunde
// stand hinten in derselben Schlange. Jetzt zwei Schlangen: Hintergrundarbeit (Vorwaermen,
// Nachbauen) bekommt nie den letzten Platz, ein Kunde kommt immer vor ihr dran.
const bildarbeitWartetHinten = [];
async function mitBildarbeit(was, fn, { hintergrund = false } = {}) {
  // Wer keinen Platz bekommt, wartet - und bekommt den Platz spaeter direkt zugeteilt
  // (nicht zurueckgegeben und neu gezaehlt, sonst koennte sich jemand dazwischendraengeln).
  // 09:15, live nach 7441437: Acrylbild und Tuerschild eines Kunden weiter 502 nach 30 s, obwohl
  // sie lokal 1,5 s brauchen. Die Rechenschleifen der Mockups (perspektivisch, zylindrisch)
  // laufen auf dem Hauptfaden; zwei Hintergrundjobs nebeneinander liessen dem Kunden keine
  // Luft. Also: Hintergrund nur EINER zugleich, und nach jedem Hintergrundjob eine kurze Pause.
  const grenze = hintergrund ? 1 : MAX_BILDARBEIT;
  if (bildarbeitLaeuft >= grenze) {
    const t = Date.now();
    await new Promise(r => (hintergrund ? bildarbeitWartetHinten : bildarbeitWartet).push(r));
    const wartete = Date.now() - t;
    if (wartete > 5000 && !hintergrund) console.log('Bildarbeit', was, 'wartete', Math.round(wartete / 1000) + ' s auf einen Platz (' + bildarbeitWartet.length + ' weitere warten)');
  } else {
    bildarbeitLaeuft++;
  }
  try { return await fn(); }
  finally {
    // Nach Hintergrundarbeit kurz Luft lassen, damit Anfragen von Kunden drankommen.
    if (hintergrund) await new Promise(r => setTimeout(r, 700));
    // Platz weitergeben: erst wer vorn wartet; Hintergrund nur, wenn danach ein Platz frei bleibt.
    const naechster = bildarbeitWartet.shift() || (bildarbeitLaeuft <= 1 ? bildarbeitWartetHinten.shift() : null);
    if (naechster) naechster(); else bildarbeitLaeuft--;
  }
}
// 19. Sept., 13:30: Markus am Handy, "bei 5G nicht zu nutzen". Gemessen: die Seite antwortete
// vier Minuten lang auf NICHTS - nicht mal /health, nicht mal das Logo. Grund: die Kacheln
// der Startseite lagen nach dem Aufraeumen nicht mehr im Zwischenspeicher, und ein Handy
// fordert alle zwanzig gleichzeitig an. Jede Kachel liest eine Druckdatei mit 4252 x 5433 px
// und baut ein Mockup - zwanzig davon auf einmal, ohne Platzgrenze, und der Server steht.
// Die Bildarbeit der Designs laeuft laengst ueber mitBildarbeit (hoechstens drei zugleich);
// die Kacheln und die Kunden-Mockups liefen daran vorbei. Jetzt nicht mehr - und dieselbe
// Datei wird nur EINMAL gebaut, auch wenn zwanzig Handys sie in derselben Sekunde wollen:
// alle warten auf denselben Lauf.
const bildImBau = new Map();
function bildEinmal(schluessel, fn, opts = {}) {
  if (bildImBau.has(schluessel)) return bildImBau.get(schluessel);
  const p = mitBildarbeit(path.basename(schluessel), fn, opts).finally(() => bildImBau.delete(schluessel));
  bildImBau.set(schluessel, p);
  return p;
}

// Fassung 59: den vom Modell gezeichneten Traeger finden - ohne die Form vorzuschreiben.
// Probiert mehrere Seitenverhaeltnisse (breit, quadratisch, hoch) und nimmt die groesste saubere Flaeche.
// Fassung 60: den OUTER UMRISS des Logos in Worte fassen - die Plakette wird genau in dieser Form
// bestellt (Wappenschild, Kreis, breites Rechteck ...). Ohne Bild-KI: grobe Form nach Seitenverhaeltnis.
async function logoUmriss(logoBuffer, shape, aspect) {
  const grob = shape === 'rund' ? 'a circle' : aspect >= 1.6 ? 'a wide rounded rectangle' : aspect <= 0.75 ? 'a tall rounded rectangle' : 'a rounded square';
  if (!HAS_LLM) return grob;
  try {
    const klein = await sharp(logoBuffer).ensureAlpha().resize({ width: 512, height: 512, fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
    const res = await openai.chat.completions.create({
      model: env.QA_MODEL,   // kein max_tokens: gpt-5-mini lehnt das Feld ab (19. Sept.), die Antwort ist ohnehin kurz
     
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Describe ONLY the outer silhouette of this logo, as a shape a sign-maker would cut out of a board: at most 8 English words, e.g. "a heraldic shield with a pointed bottom", "a circle", "a wide rounded rectangle", "a tall oval". No colours, no text, no contents. Answer with the shape only.' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,' + klein.toString('base64') } }
      ] }]
    });
    const t = String(res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content || '').replace(/[\r\n"]+/g, ' ').trim().replace(/\.$/, '');
    return t && t.length <= 80 ? t.charAt(0).toLowerCase() + t.slice(1) : grob;
  } catch (e) { return grob; }
}

// 6. Okt., Markus: "Weiter ausschneiden bei den Kunden-Logos. Dort muessen wir so gut werden, dass alle Logos ...
// selbstaendig so hinbekommen, dass es gut aussieht." Fuer die Faelle, die die Geometrie nicht trennen kann (Loch im
// fetten A oder gewollter weisser Stern?), fragt logoFreistellen hier nach - ein Bild, eine magenta Flaeche, A oder B.
async function logoLochFragen(bild) {
  if (!HAS_LLM) return null;
  const res = await openai.chat.completions.create({
    model: env.QA_MODEL,
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'This is a company or club logo that will be printed on a T-shirt. One area is tinted bright MAGENTA - in the original logo that area is plain white (the same white as the paper around the logo). Decide what that area is:\nA = an opening that belongs to the paper, not to the logo: the inside of a letter (the hole in o, e, a, A, B, R, D, P, g), the gap inside a ring, frame or outline, a space between strokes. On the shirt the fabric should show through.\nB = a deliberate WHITE part of the design: white lettering, a white star, a white eye or tooth, a white panel or stripe inside a coloured shape. On the shirt it must be printed white.\nAnswer with exactly one letter: A or B.' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,' + bild.toString('base64') } }
    ] }]
  });
  const t = String(res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content || '').trim().toUpperCase();
  return /^A\b/.test(t) ? 'loch' : /^B\b/.test(t) ? 'weiss' : null;
}

async function traegerSuchen(freiCand, t) {
  const kandidaten = [t.schildAspect, t.aspect, 0.7, 1.0, 1.4, 2.0, 2.8].filter(a => a > 0);
  const gesehen = new Set(); let best = null;
  for (const a of kandidaten) {
    const key = Math.round(a * 10); if (gesehen.has(key)) continue; gesehen.add(key);
    let pl = null;
    try { pl = await platzFuerText(freiCand, a, { minBreite: 0.14, grob: true, stufen: [0.7, 0.62, 0.56, 0.5, 0.44, 0.38, 0.32, 0.27, 0.22, 0.18, 0.15] }); } catch (e) { pl = null; }
    if (pl && pl.gefunden && (!best || pl.breite * pl.hoehe > best.breite * best.hoehe)) best = { ...pl, aspect: a };
  }
  return best || { gefunden: false };
}

function pump() {
  while (running < +env.MAX_PARALLEL_JOBS && queue.length) {
    const job = queue.shift();
    running++;
    // Die Frist liegt AM AUFTRAG, nicht in einem Wettlauf daneben. Frueher lief hier ein
    // Promise.race gegen einen Watchdog - und das war der Fehler: ein Promise.race bricht
    // runJob NICHT ab, es hoert nur auf zu warten. Nach Ablauf wurde der Auftrag als
    // "error/timeout" markiert, WAEHREND er weiterlief. Die Kundenseite sah einen Fehler und
    // startete automatisch neu, der erste Auftrag wurde danach fertig - und am Ende lagen
    // mehrere Designs im Backend, die der Kunde nie zu sehen bekam. Jetzt haelt sich runJob
    // selbst an die Frist (siehe zeitKnapp) und der Status sagt immer die Wahrheit.
    job.deadline = Date.now() + JOB_TIMEOUT_MS;
    // Notbremse, damit ein wirklich haengender Dienst nicht ewig einen der wenigen Plaetze
    // blockiert. Sie greift nur, wenn runJob trotz eigener Frist nicht zurueckkommt, und
    // gibt nur den PLATZ frei - den Status laesst sie in Ruhe, weil die Arbeit weiterlaeuft.
    let frei = false;
    const notbremse = setTimeout(() => {
      if (frei) return;
      frei = true; running--;
      console.error('Notbremse: Auftrag', job.jobId, 'haengt seit', Math.round((JOB_TIMEOUT_MS + 600000) / 60000), 'min - Platz freigegeben, Auftrag laeuft weiter',
        '· Stufe', bildStufe(), '· Modell', bildModell() || '(Standard)');
      pump();
    }, JOB_TIMEOUT_MS + 600000);

    const begonnen = Date.now();
    runJob(job)
      .catch(e => {
        if (job.status === 'done') return;
        job.status = 'error'; job.error = String(e && e.message ? e.message : e);
        console.error('Auftrag gescheitert:', job.jobId, job.error);
      })
      // Erst hier ist die Arbeit wirklich zu Ende: Platz freigeben, Stand sichern, Mail raus.
      .finally(() => {
        clearTimeout(notbremse);
        if (!frei) { frei = true; running--; }
        // Nur gelungene Laeufe zaehlen fuer die Wartezeit-Ansage: ein Abbruch nach 8 Sekunden
        // wuerde den Schnitt schoenfaerben und dem naechsten Kunden zu wenig ansagen.
        if (job.status === 'done') dauerMerken(Date.now() - begonnen);
        // Fassung 74: EINE Stelle fuer den Ausgang jedes Auftrags - hier laufen alle Wege
        // zusammen, egal an welchem der zwanzig Abbruchpunkte es vorher geendet hat.
        // Der Grund (job.hint) ist immer ein fester Wert aus dem Code, nie Kundentext.
        try {
          const slug = job.input && job.input.motto ? job.input.motto.slug : 'unbekannt';
          if (job.status === 'done') zaehl('fertig', slug);
          else zaehl('fehler', job.hint || 'unbekannt');
        } catch (e) { /* zaehlen darf nie stoeren */ }
        saveJob(job); meldeAdresseAusKonto(job).then(() => meldeFertig(job)); meldeChef(job); pump();
      });
  }
}

// Bild-QA: (1) Pflichttexte vorhanden und richtig geschrieben, (2) kein geschuetztes Wort im Bild,
// (3) kein Logo / Wappen / Emblem einer echten Marke oder eines echten Vereins - auch nicht nachempfunden.
// opts.marken=false: Markensperre auslassen (freigabepflichtige Mottos wie Fanclub - dort zaehlt der Nachweis, nicht die Sperre)
async function textQA(png, want, opts = {}) {
  if (!HAS_LLM) return { pass: true, skipped: true };
  const res = await openai.chat.completions.create({
    model: env.QA_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `You are a compliance checker for printed apparel sold in Germany. Examine this artwork.
1) Read ALL text visible in the artwork.
2) Look for any logo, crest, coat of arms, emblem, badge, wordmark, mascot or brand symbol. For EACH one, decide whether it is, or is clearly modelled on, a real existing sports club, league, association, company, brand, band, franchise or character (e.g. football club crests, league logos, sportswear brands, car makers, beverage brands, film/comic/game franchises). Imitations count: same shape, colours and layout as a real crest with the name altered or missing is still a match. WORDLESS BRAND MARKS COUNT TOO, even with no name anywhere: three parallel equal stripes in the sportswear manner (adidas), the swoosh tick (Nike), a leaping big cat (Puma), a small crocodile (Lacoste), a polo rider (Ralph Lauren), an interlocking double C (Chanel), the LV monogram pattern, the Burberry check, a bitten apple (Apple), a three-pointed star in a ring (Mercedes), four interlocking rings (Audi) - report each with the brand name, echt=true. National, state, regional or city FLAGS are NOT logos or brands - do not list a plain flag (e.g. the German, French or Turkish flag) at all.
3) Look for symbols of unconstitutional or terrorist organisations, which are criminal to distribute in Germany (§ 86a StGB): swastika (also mirrored, rotated, stylised or hidden in a pattern), SS runes / Sig runes, Wolfsangel, Odal rune, Black Sun (Sonnenrad), SS death's head, Reichsadler with swastika, Reichskriegsflagge, Celtic cross in the white-power sense, Ku-Klux-Klan hood, flags or emblems of IS/Al-Qaida/Hamas/Hezbollah/PKK, and Nazi slogans rendered as graphics. Report each one in "symbole".
   Do NOT report ordinary motifs that merely look edgy: a plain skull (biker/metal), a generic Celtic knot or triskelion, a Norse rune used decoratively, a black sun-ray pattern without the 12-rune geometry, military-looking gear without insignia. Those are normal and must pass.${opts.u18 ? `
4) This artwork is for a person UNDER 18. Look for anything alcohol-related: bottles (wine, beer, champagne, spirits), drinking glasses, champagne flutes, beer mugs, cocktails, corks popping, sparkling-wine bubbles rising from a glass, bar or pub scenes, "cheers"/"Prost" toasting gestures with drinks, cigarettes, cigars, gambling. Report each in "alkohol". A plain party motif (cake, balloons, confetti, fireworks) is fine.` : ''}
Answer ONLY with JSON:
{"texts":[...],
 "logos":[{"beschreibung":"...","echt":true|false,"name":"name of the real club/brand or empty","sicher":true|false}],
 "symbole":[{"art":"swastika|ss-rune|wolfsangel|odal|schwarze-sonne|ss-totenkopf|reichsadler|reichskriegsflagge|kkk|terror-flagge|ns-parole","beschreibung":"where and how it appears","sicher":true|false}],${opts.u18 ? `
 "alkohol":[{"beschreibung":"what and where","sicher":true|false}],` : ''}
 "pass":true|false,"reason":"..."}
pass is true only if each of these strings appears, case-insensitive and accents may be simplified: ${JSON.stringify(want)}, and no clearly misspelled words are present. Do NOT lower pass because of logos - report them in "logos" only. "echt" is true only when the logo depicts or imitates a real-world club/brand; a generic invented badge (e.g. a plain shield with a city name, a made-up mascot) is echt=false. "sicher" is true when you are confident in the identification.` },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,' + png.toString('base64') } }
      ]
    }]
  });
  const raw = String(res.choices[0].message.content || '').replace(/```json|```/g, '').trim();
  let out;
  try { out = JSON.parse(raw); } catch (e) { return { pass: true, reason: 'QA unlesbar', skipped: true }; }
  if (!out || typeof out !== 'object') return { pass: true, reason: 'QA unlesbar', skipped: true };
  if (!want.length) out.pass = true;
  const texts = Array.isArray(out.texts) ? out.texts : [];
  const logos = Array.isArray(out.logos) ? out.logos.filter(l => l && typeof l === 'object') : [];
  const symbole = Array.isArray(out.symbole) ? out.symbole.filter(s => s && typeof s === 'object') : [];
  // U18 (Geburtstag Kind/Jugend): Alkohol im Bild wird gemeldet, entschieden wird in runJob.
  const alkohol = opts.u18 && Array.isArray(out.alkohol) ? out.alkohol.filter(a => a && typeof a === 'object' && a.sicher !== false) : [];
  if (alkohol.length) out.alkohol = alkohol; else delete out.alkohol;
  // Verbotene Zeichen: VOR allem anderen und ohne jede Ausnahme. Kein opts-Schalter,
  // kein markenfrei, kein Fanclub. Ein solcher Versuch wird verworfen, nicht gedruckt.
  {
    const sym = verboten.pruefeSymbole(symbole);
    if (sym) return { pass: false, reason: 'verbotenes Zeichen im Bild: ' + sym.wort, verboten: sym.wort, verbotenText: sym.beschreibung, texts, logos, symbole };
    // Parolen tauchen auch als Text im Bild auf - dieselbe Liste, dieselbe Haerte.
    const par = verboten.pruefeTexte(texts);
    if (par) return { pass: false, reason: 'verbotene Parole im Bild: ' + par.wort, verboten: par.wort, texts, logos, symbole };
  }
  if (opts.marken !== false) {
    // Markensperre auf dem fertigen Bild: taucht ein geschuetztes Wort auf, ist der Versuch ungueltig
    const hit = marken.checkImageTexts(texts, opts.erlaubt, opts.kontext);
    if (hit) return { pass: false, reason: 'geschuetztes Wort im Bild: ' + hit.wort, marke: hit.wort, texts, logos };
    // Logo-/Wappen-Sperre: erkennt die Bild-KI ein echtes (oder nachempfundenes) Vereins-/Markenzeichen, ist der Versuch ungueltig
    const logo = opts.eigenesLogo ? null : marken.checkLogos(logos);
    if (logo) return { pass: false, reason: 'geschuetztes Logo/Wappen im Bild: ' + logo.wort, marke: logo.wort, logo: logo.beschreibung, texts, logos };
  }
  out.texts = texts; out.logos = logos; out.symbole = symbole;
  return out;
}

// ---------------------------------------------------------------------------------------------
// IST AUF DEM HOCHGELADENEN FOTO UEBERHAUPT EIN MENSCH ODER EIN TIER?
//
// Markus, 26. September: "Wenn jemand ein Foto hochlaedt, sollten wir schon erkennen koennen, dass
// auch ein Mensch da drauf ist oder ein Tier - jetzt gerade einfach ne Datei hochgeladen, und er
// erkennt das an."
//
// Die Frage und die Entscheidung stehen in fotos.js (FOTO_INHALT_FRAGE, fotoInhaltBefund), damit
// beides ohne Netz nachpruefbar ist. Hier steht nur der Blick - dasselbe Auge, das schon Logos
// liest und den Hintergrund des Selfies beurteilt.
//
// OHNE MODELL WIRD NICHTS ABGELEHNT. Ein fehlender Schluessel, ein Zeitfehler oder eine unlesbare
// Antwort duerfen niemandem sein Selfie verweigern; dann geht das Foto durch wie bisher.
async function fotoZeigtMotiv(buffer) {
  if (!HAS_LLM) return { uebersprungen: true };
  try {
    const klein = await sharp(buffer).resize({ width: 768, fit: 'inside' }).flatten({ background: '#ffffff' }).jpeg({ quality: 80 }).toBuffer();
    const res = await openai.chat.completions.create({
      model: env.QA_MODEL,
      messages: [{ role: 'user', content: [
        { type: 'text', text: FOTO_INHALT_FRAGE },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + klein.toString('base64') } }
      ] }]
    });
    const roh = String(res.choices[0].message.content || '').replace(/```json|```/g, '').trim();
    const a = JSON.parse(roh);
    if (!a || typeof a !== 'object') return { uebersprungen: true, grund: 'Antwort unlesbar' };
    return { mensch: a.mensch === true ? true : a.mensch === false ? false : null, tier: a.tier === true ? true : a.tier === false ? false : null,
      was: String(a.was || '').slice(0, 60),
      // 26. Sept., Markus: "so dass das, was auf den Bildern ist, mit ins Design kommt."
      motiv: String(a.motiv || '').trim().toLowerCase().replace(/[^a-z_]/g, '').slice(0, 20),
      grund: String(a.grund || '').slice(0, 200) };
  } catch (e) {
    console.error('Fotoinhalt:', e && e.message ? e.message : e);
    return { uebersprungen: true, grund: String((e && e.message) || e).slice(0, 120) };
  }
}

// Welches Motiv ein Motto von seinem Foto verlangt ('mensch', 'tier', 'mensch_tier' oder nichts).
// Es steht am Upload-FELD des Mottos, nicht im Code - so entscheidet die Motto-Datei, und ein
// neues Motto braucht keine Zeile hier.
function fotoBrauchtVon(motto) {
  for (const f of (motto && motto.fields) || []) if (f.type === 'upload' && f.braucht) return String(f.braucht);
  return (motto && motto.upload && motto.upload.braucht) ? String(motto.upload.braucht) : '';
}

// Adresse -> Koordinaten ueber OpenStreetMap (Nominatim). Nur der Hof-Standort, defensiv (Timeout, Fehler = keine Koordinaten).
async function geocode(query) {
  const q = String(query || '').trim();
  if (!q) return '';
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
  const r = await fetch(url, { headers: { 'User-Agent': 'MottoOtto/1.0 (' + env.PUBLIC_BASE_URL + ')', 'Accept-Language': 'de' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Nominatim ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j) || !j.length) return '';
  const lat = parseFloat(j[0].lat), lon = parseFloat(j[0].lon);
  if (!isFinite(lat) || !isFinite(lon)) return '';
  return Math.abs(lat).toFixed(4) + '° ' + (lat >= 0 ? 'N' : 'S') + ' · ' + Math.abs(lon).toFixed(4) + '° ' + (lon >= 0 ? 'E' : 'W');
}

// Adresse -> [lat, lon] als Zahlen. Der Geocoder darueber liefert den huebschen Text fuer die
// Karte; fuer das Firmengelaende braucht es die Zahlen, um damit zu rechnen.
async function geocodeRoh(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=' + encodeURIComponent(q);
  const r = await fetch(url, { headers: { 'User-Agent': 'MottoOtto/1.0 (' + env.PUBLIC_BASE_URL + ')', 'Accept-Language': 'de' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('Nominatim ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j) || !j.length) return null;
  const lat = parseFloat(j[0].lat), lon = parseFloat(j[0].lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  return { punkt: [lat, lon], genau: istHausnummer(j[0]), befund: j[0] };
}

/**
 * Ist das wirklich eine ANSCHRIFT - oder nur die Strasse?
 *
 * 23. Sept., Markus stand vor Ball-z und wurde nicht erkannt. Gemessen: sein Handy meldete
 * 53.3481 / 9.9867 (Ortung rund 25 m genau), gespeichert war 53.3430 / 9.9861 - 571 m daneben,
 * bei einem Radius von 150 m. Die Ursache lag nicht beim Radius, sondern beim Punkt:
 * OpenStreetMap kennt die Hausnummer 16 in der Hauptstrasse Harmstorf nicht. Jede Abfrage -
 * frei wie strukturiert - liefert die STRASSE zurueck (class "highway", type "secondary"), und
 * die ist ueber einen Kilometer lang. Der Server nahm das als "Anschrift gefunden".
 *
 * Ein Punkt irgendwo auf einer langen Strasse ist als Firmensitz wertlos. Also wird er ab jetzt
 * als ungenau gekennzeichnet und NICHT als Sitz eingetragen - dieselbe Linie wie beim Wappen:
 * lieber kein Punkt als ein falscher. Im Backend steht dann, warum, und ein Mensch kann die
 * Koordinaten vor der Tuer messen (bei Ball-z genau so geschehen).
 */
function istHausnummer(treffer) {
  if (!treffer) return false;
  const a = treffer.address || {};
  if (a.house_number) return true;
  // Ohne Hausnummer taugt es nur, wenn der Treffer ueberhaupt ein Gebaeude oder ein Grundstueck
  // ist - eine Strasse, ein Fluss, ein Waldweg ist kein Firmensitz.
  return treffer.class === 'building' || treffer.class === 'place' || treffer.class === 'shop' || treffer.class === 'office';
}

// Einheiten und Uhrzeit je Feld vereinheitlichen - egal wie der Kunde tippt. Sonst steht auf dem Shirt
// "4040" statt "4040 g" oder "um 7.54 h Uhr" (die Vorlage haengt selbst " Uhr" an). Laeuft VOR Prompt und
// Bild-QA, damit die QA genau das Gedruckte prueft. Idempotent: eine Wiederholung aendert nichts mehr.
function normalizeUnits(motto, values) {
  const num = (s) => { const m = String(s).replace(/\s+/g, '').match(/\d+(?:[.,]\d+)?/); return m ? m[0] : null; };
  for (const f of motto.fields || []) {
    const raw = values[f.key]; if (!raw) continue;
    const s = String(raw).trim(); const low = s.toLowerCase();
    if (f.unit === 'g') {
      const n = num(s); if (!n) continue;
      let grams;
      // "3,5 kg", "3.48" (Kilo mit Komma) -> Gramm; "4.040" / "4040" / "4040,0" -> Gramm
      if (/kg/.test(low) || (/[.,]/.test(n) && parseFloat(n.replace(',', '.')) < 10)) grams = Math.round(parseFloat(n.replace(',', '.')) * 1000);
      else grams = parseInt(n.replace(/[.,](?=\d{3}\b)/g, '').replace(/[.,]\d*$/, ''), 10);
      if (grams > 0) values[f.key] = grams + ' g';
    } else if (f.unit === 'cm') {
      const n = num(s); if (!n) continue;
      let v = parseFloat(n.replace(',', '.'));
      if (/\bm\b/.test(low.replace(/cm/g, '')) && v < 3) v = v * 100;   // "0,52 m"
      if (v > 0) values[f.key] = (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')) + ' cm';
    } else if (f.format === 'time') {
      const d = s.replace(/[^\d]/g, '');
      let h, mi;
      const m = s.match(/(\d{1,2})\s*[:.hH]\s*(\d{1,2})/);
      if (m) { h = +m[1]; mi = +m[2]; }
      else if (/^\d{3,4}$/.test(d)) { h = +d.slice(0, -2); mi = +d.slice(-2); }
      else if (/^\d{1,2}$/.test(d)) { h = +d; mi = 0; }
      if (h === undefined || h > 23 || mi > 59) continue;
      values[f.key] = String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
    }
  }
}

// Hat der Bilddienst das Motiv inhaltlich abgelehnt? (dann Prompt aendern statt identisch wiederholen)
function isRefusal(msg) {
  return /keine Bild-URL|refus|safety|policy|moderation|rejected|not allowed|cannot (create|generate)|unable to (create|generate)/i.test(String(msg || ''));
}

async function runJob(job) {
  job.status = 'running';
  await saveJob(job);
  const { motto, values, uploadFile, uploadFile2, style, colors, names = [], people = [], aufteilung = 'vorne', textile: textilWunsch = 'schwarz', mood = 'standard', figuren = 'standard', placement = '', artikel = null, foto = null, korrektur: korr = null } = job.input;
  // 23. Sept. galt: der STIL entscheidet den Stoff (STIL_TEXTIL), die Wahl des Kunden wurde
  // ueberschrieben. 27. Sept., Markus (dunkles Textil gewaehlt, weisses Shirt bekommen): "Wichtig
  // ist natuerlich, wenn ein Textil gewaehlt ist, dass das dann auch beim Weiterschicken so
  // benutzt wird." Seitdem gilt die Wahl des Kunden. Der Stil empfiehlt nur noch - die Seite
  // belegt seine Kachel vor und sagt, warum. Nur ein Auftrag OHNE gueltigen Ton (alte Seite,
  // fremder Aufruf: textilGewaehlt === false) faellt auf die Stil-Regel zurueck.
  const textile = textilFuerAuftrag(style, job.input.textilGewaehlt === false ? '' : textilWunsch);
  if (textile !== textilWunsch) job.input.textile = textile;   // der Auftrag haelt fest, worauf wirklich gezeichnet wurde
  const nameFont = job.input.nameFont || motto.nameFont || 'rund';
  const personal = motto.fields.find(f => f.personal);

  const useReference = motto.upload.mode === 'reference' && uploadFile;
  let upload = null, logoColors = '', logo = null;
  if (uploadFile) upload = await fs.readFile(path.join(STORE, 'uploads', uploadFile));
  // Co-Branding: zweites Logo neben das erste setzen - ab hier verhaelt sich der Block wie EIN Logo
  if (upload && uploadFile2 && motto.upload.mode === 'exact' && motto.upload.coBrand) {
    try { upload = await combineLogos(upload, await fs.readFile(path.join(STORE, 'uploads', uploadFile2))); }
    catch (e) { console.error('Co-Branding-Logo:', e && e.message ? e.message : e); }
  }
  if (upload && motto.upload.mode === 'exact') {
    // Fassung 10: Farben UND Form des Logos - der Prompt legt die freie Flaeche passend an und laesst das Motiv sie umarmen
    try { logo = await describeLogo(upload); logoColors = logo.colors; } catch (e) { logoColors = ''; logo = null; }
  }

  // Fassung 25/26: Kundenfoto liegt nur im Arbeitsspeicher. Ist es weg (Stunde um, Neustart),
  // gibt es keinen Auftrag - ehrlich sagen, nicht ohne Foto weiterzeichnen.
  let fotoRaw = foto ? fotoHolen(foto.sitzung) : null;
  // 21. Sept., Probelauf: mein Deploy hat den Dienst mitten im Auftrag neu gestartet - das Foto war
  // weg, die Meldung sagte "nach einer Stunde geloescht". Nach einem Neustart heisst es jetzt ehrlich so.
  if (foto && !fotoRaw) { job.status = 'error'; job.hint = 'foto'; job.error = job.restarts ? FOTO_TEXTE.nachNeustart : FOTO_TEXTE.abgelaufen; return; }
  // 19. Okt. (Markus, Freestyle: "ein Foto hochzuladen oder eine Datei, so dass diese geaendert werden kann"):
  // Weg 'veraendert' - der Bilddienst aendert ZUERST das Foto nach dem Wunsch des Kunden (fotoAendernPrompt,
  // hohe Vorlagentreue, Hintergrund bleibt). Das geaenderte Bild liegt wie das Original nur im Arbeitsspeicher,
  // unter einer eigenen Sitzung desselben Kunden; ab hier laeuft der Auftrag wie 'so einsetzen': das Motiv wird
  // um eine freie Flaeche gebaut, das geaenderte Foto kommt erst nach dem "Ja" des Kunden hinein. Das Original
  // bleibt in seiner Sitzung - "Noch eine Variante" aendert es noch einmal neu, nie das schon Geaenderte.
  if (foto && foto.modus === 'veraendert' && korr && fotoHolen(foto.sitzung + '_x')) {
    // Korrektur oder Teil-Aenderung am fertigen Design: das schon geaenderte Foto bleibt, wie es war.
    job.fotoQuelle = foto.sitzung; foto.sitzung += '_x'; foto.modus = 'original'; foto.veraendert = true; fotoRaw = fotoHolen(foto.sitzung);
  } else if (foto && foto.modus === 'veraendert') {
    const t0 = Date.now();
    try {
      const meta = await sharp(fotoRaw.buffer).metadata();
      const lang = Math.max(1024, Math.min(2048, Math.max(meta.width || 1024, meta.height || 1024)));
      const quer = (meta.width || 1) >= (meta.height || 1);
      const kurz = Math.max(256, Math.round(lang * (quer ? (meta.height || 1) / (meta.width || 1) : (meta.width || 1) / (meta.height || 1)) / 16) * 16);
      const size = quer ? `${lang}x${kurz}` : `${kurz}x${lang}`;
      const g = await editViaBallz(env.BALLZ_MCP_URL, {
        prompt: fotoAendernPrompt(values.motiv || ''), size, quality: bildStufe(motto), model: bildModell(),
        background: 'opaque', inputFidelity: 'high',
        imageBase64: fotoRaw.buffer.toString('base64'), mimeType: fotoRaw.mime || 'image/jpeg'
      });
      if (!g || !g.png || !g.png.length) throw new Error('Bilddienst lieferte kein Bild');
      const neu = foto.sitzung + '_x';
      const ab = fotoAblegen(neu, g.png, { mime: 'image/png', name: 'foto-geaendert' });
      if (!ab.ok) throw new Error(ab.grund);
      FOTO_BESITZ.set(neu, FOTO_BESITZ.get(foto.sitzung));
      job.fotoQuelle = foto.sitzung;
      foto.sitzung = neu; foto.modus = 'original'; foto.veraendert = true;
      fotoRaw = fotoHolen(neu);
      console.log('Foto nach Wunsch geaendert:', job.jobId, '·', size, '·', Math.round((Date.now() - t0) / 1000) + ' s ·', g.png.length, 'Bytes');
    } catch (e) {
      // Nichts faengt still (Regel 5): der Grund steht am Auftrag, der Kunde liest eine ehrliche Meldung.
      console.error('Foto aendern:', job.jobId, e && e.message ? e.message : e);
      job.status = 'error'; job.hint = 'foto'; job.error = FOTO_TEXTE.aendernFehlgeschlagen + ' (' + String(e && e.message ? e.message : e).replace(/(sk-[A-Za-z0-9_-]{6,})/g, '[schluessel]').slice(0, 160) + ')';
      return;
    }
  }
  // Fassung 24: der Artikel entscheidet die Druckregeln (motivart), das Foto hebt "no recognizable
  // people" auf (extra.foto), und beim Weg "so einsetzen" haelt das Modell die Flaeche frei.
  const fsExtra = { motivart: artikel ? artikel.motivart : undefined, verfahren: artikel ? artikel.verfahren : undefined, foto: foto ? (foto.modus === 'gruppe' ? 'gruppe' : true) : false };
  // Fassung 58: Logo UND Name auf EINEM Schild - das Modell legt zwei bestellte Flaechen ohnehin
  // zu einer zusammen (Ruegen/MBSV-Laeufe). Also gleich so bestellen: ein Traeger, Logo oben
  // bzw. links, Name darunter bzw. rechts. Die eigene Namensflaeche entfaellt dann.
  // Fassung 59 (Markus, 16. Sept., ChatGPT-Beweis): Standardweg fuer das Logo ist "eingearbeitet".
  // Das Modell bekommt das Logo als Bild, zeichnet es sauber nach und baut das Design darum herum -
  // auch klein auf den Ruecken der Figuren. Das Ergebnis bleibt, wie es kommt: nichts wird gesucht,
  // gestanzt oder daruebergelegt. Die Schrift des Logos wird hinterher gelesen und geprueft.
  // "exakt" ist die zweite Wahl: Original unveraendert auf eine leere Plakette (Fassung 57).
  const logoArt = String(job.input.logoArt || '') === 'exakt' ? 'exakt' : 'eingearbeitet';
  const logoEingearbeitet = !!(logo && upload && motto.upload.mode === 'exact' && !foto && !useReference && logoArt === 'eingearbeitet');
  const logoUndNameAufTraeger = !!(String(env.LOGO_WEG || 'traeger') === 'traeger' && !logoEingearbeitet && logo && upload && motto.upload.mode === 'exact' && !foto && personal && names.length && job.input.nameArt === 'motiv');
  const zone = foto && foto.modus === 'original'
    ? fotoZonePrompt(0.55, foto.form)
    : logoUndNameAufTraeger ? ''
    : (personal ? (job.input.nameArt === 'motiv' ? nameImMotivPrompt(nameTraegerFuer(FIGUREN[job.input.figuren || 'standard'] ? FIGUREN[job.input.figuren || 'standard'].menschen !== false && hatMenschen(motto) : hatMenschen(motto))) : nameZonePrompt(motto.nameZone)) : '');
  // Der Artikel-Block haengt NACH buildPrompt - die Kuerzungskette darf ihn nie abschneiden.
  const druck = artikel ? '\n\n' + (artikel.frei ? freierDruckBlock(artikel) : druckBlock(artikel.id, artikel.flaeche)) : '';
  // Weg "nachzeichnen": das Foto geht als Vorlage in die Bildbearbeitung, mit dem Stil davor.
  // 2. Okt.: "gruppe" (Gruppen-Mottos) geht denselben Weg - das Foto bzw. sein gemaltes Bild ist Bild 1.
  const nachbau = !!(foto && (foto.modus === 'nachgebaut' || foto.modus === 'gruppe'));
  const gruppenNachbau = !!(foto && foto.modus === 'gruppe');
  const nachbauKopf = (nachbau && !gruppenNachbau) ? nachbauPrompt(stilText(style, job.id) || '', { person: true, umgebung: false }) + '\n\n' : '';

  // ---------------------------------------------------------------------------------------
  // Stufe 1: Otto malt zuerst das Foto, dann erst das Design.
  // Gegen gelieferte Pixel verliert jeder Satz: ist das Kundenfoto das Eingangsbild der
  // Bildbearbeitung, haelt das Modell daran fest - am staerksten am Gesicht. Also zwei Schritte:
  //   1. Aus dem Foto wird ein BILD im gewaehlten Stil - dieser Aufruf hier, sonst nichts.
  //   2. Das Design entsteht aus diesem gemalten Bild.
  // Geht Stufe 1 schief, laeuft es mit dem Foto weiter.
  // 2. Okt.: gilt fuer die Gruppen-Mottos (gruppenStufe1) - das Design bekommt die schon GEMALTEN
  // Leute, nie das Foto. Den Hintergrund des Fotos braucht das Shirt nicht (umgebung: false).
  // ---------------------------------------------------------------------------------------
  let fotoGemalt = null;
  const gruppenStufe1 = !!(gruppenNachbau && fotoRaw && !korr && !zeitKnapp(job, 120000));
  if (gruppenStufe1) {
    const figurWunsch = (FIGUREN[figuren] && FIGUREN[figuren].text) || '';
    const auftrag = fotoNachmalenPrompt({
      stilText: stilText(style, job.id) || '',
      figurenText: figurWunsch,
      umgebung: false
    });
    try {
      const t0 = Date.now();
      const g = await editViaBallz(env.BALLZ_MCP_URL, {
        prompt: auftrag,
        // Quadratisch: das Selfie kommt quer oder hoch, und die Karte schneidet ohnehin neu an.
        size: '1024x1024', quality: bildStufe(motto), model: bildModell(),
        // Vollflaechig: das Bild zeigt die Menschen UND den Ort um sie herum - kein Alphakanal.
        background: 'opaque',
        imageBase64: fotoRaw.buffer.toString('base64'), mimeType: fotoRaw.mime || 'image/jpeg'
      });
      if (g && g.png && g.png.length) {
        // Das gemalte Bild bleibt im Arbeitsspeicher, genau wie das Foto selbst (Fassung 26):
        // es zeigt dieselben Menschen und hat auf der Festplatte nichts verloren.
        fotoGemalt = { buffer: g.png, mime: 'image/png' };
        job.fotoGemalt = true;
        console.log('Stufe 1 (Foto gemalt):', job.jobId, '·', style, '·', figuren,
          '·', Math.round((Date.now() - t0) / 1000) + ' s ·', g.png.length, 'Bytes');
      }
    } catch (e) {
      console.error('Stufe 1 (Foto gemalt) fehlgeschlagen:', e && e.message ? e.message : e);
    }
  }

  // Adresse -> Koordinaten (Landwirt): Geo-Feld nachschlagen und als {koordinaten} einsetzen (nie das Bild/Prompt mit der Adresse selbst).
  const geoF = (motto.fields || []).find(f => f.geo);
  if (geoF && values[geoF.key]) {
    try { const c = await geocode(values[geoF.key]); if (c) values.koordinaten = c; }
    catch (e) { console.error('Geocoding:', e && e.message ? e.message : e); }
  }
  // 1. Okt., Textil mit dem Logo des Hauses (Motto haus): der Betrieb kommt aus dem Link, das Logo
  // ist der Upload fr_<slug>.png (siehe /generate). Hier haengt der Betrieb samt Lizenz am Auftrag,
  // damit die Abrechnung (lizenzen.js) ihn findet - der Rest laeuft wie bei jedem Freestyle.
  let hausEintrag = null;
  if (motto.hausTextil && !korr) {
    try {
      const kern = (s) => firmenSlug(s).replace(/[-_]/g, '');
      const gesucht = kern(values.firma || '');
      const ff = gesucht ? (await firmenListe()).find(e => kern(e.firma) === gesucht || (e.namen || []).some(n => kern(n) === gesucht)) : null;
      if (!ff || !(ff.freigabe && ff.freigabe.datum)) { job.status = 'error'; job.error = 'Diesen Betrieb kennen wir nicht oder er hat keine Freigabe. Bitte den Link des Betriebs benutzen.'; console.error('Haus-Textil:', job.jobId, '· Betrieb unbekannt oder ohne Freigabe:', values.firma || '(leer)'); return; }
      if (!uploadFile || !uploadFile.startsWith('fr_')) { job.status = 'error'; job.error = 'Das Logo des Hauses fehlt. Bitte die Seite neu laden und noch einmal starten.'; console.error('Haus-Textil:', job.jobId, '· kein Haus-Logo im Auftrag:', uploadFile || '(leer)'); return; }
      job.kartenart = 'haus';
      job.firma = { name: ff.firma, umfang: firmenUmfang(ff), webseite: ff.webseite || '', freigabe: ff.freigabe.datum, logo: true };
      if (ff.lizenz && ff.lizenz.prozent) job.firma.lizenz = { prozent: +ff.lizenz.prozent, seit: ff.lizenz.seit || '' };
      job.firma.flaggeLand = flaggenLandFuer(ff);
      hausEintrag = ff;
      console.log('Haus-Textil:', job.jobId, '·', ff.firma, '· Logo', uploadFile, '· Lizenz', job.firma.lizenz ? job.firma.lizenz.prozent + ' %' : 'keine', '· Flagge', job.firma.flaggeLand || 'keine');
    } catch (e) { job.status = 'error'; job.error = 'Der Betrieb konnte nicht geprueft werden: ' + (e && e.message ? e.message : e); console.error('Haus-Textil pruefen:', job.jobId, e && e.message ? e.message : e); return; }
  }

  let vorlagenBlock = '';
  // 22. Sept., Markus ("???"): auf der Karte stand "Mankus" statt "Markus". Kurze Eigennamen
  // malt das Modell als Bild eines Wortes und verschiebt dabei einen Buchstaben. Jeder kurze
  // Text, der wirklich gedruckt wird, steht deshalb am Ende noch einmal Buchstabe fuer Buchstabe.
  {
    const gedruckt = (motto.fields || [])
      .filter(f => f.printed !== false && !f.personal && f.type !== 'upload' && f.type !== 'wahl' && f.type !== 'checkbox' && f.type !== 'select')
      .map(f => String(values[f.key] || '').trim())
      .filter(Boolean);
    if (gedruckt.length) vorlagenBlock += buchstabierBlock(gedruckt);
  }

  // Bei hochgeladenem Foto ist das Foto das Motiv - dann KEINE feste Motiv-Variation vorgeben
  // (sonst würde z. B. ein Hoftier zwanghaft in einen Trecker umgebaut).
  // Geburtstag: das Alter (oder der Jahrgang) bestimmt die Motivwelt. Kein Champagner fuer
  // Zwoelfjaehrige, kein Dino fuer den Fuenfzigsten. geburtstag.js liefert die passenden
  // Variationen und eine Regel, die an den Prompt kommt. Fuer alle anderen Mottos: null.
  const geb = geburtstagRegeln(motto, values);
  const mottoVar = geb ? geb.motto : motto;
  const altersRegel = geb ? geb.regel : '';
  if (geb) console.log('Geburtstag: Alter', geb.alter == null ? 'unbekannt' : geb.alter, '->', geb.gruppe);
  let variation = '';
  // 2. Okt.: ein freies Mass bestimmt das Format - Aufbau-Zufall und erste Zeile richten sich danach.
  const artikelFrei = job.input && job.input.artikel;
  const formatFrei = artikelFrei && artikelFrei.frei && Array.isArray(artikelFrei.netto) ? formatAusMass(artikelFrei.netto[0], artikelFrei.netto[1]) : '';
  if (!useReference && !korr) {
    variation = pickVariation(mottoVar, { styled: !!(style && style !== 'standard'), format: formatFrei });
    // Ein "steuerndes" Feld (z. B. Motorrad-Typ) bestimmt das Hauptmotiv.
    const steerF = (motto.fields || []).find(f => f.steers && values[f.key]);
    if (steerF) variation = 'central motif: a ' + values[steerF.key] + ', drawn as the clear hero of the design';
  }
  // Motto-Recherche: Abi/Schulmotto -> Wortspiel aufloesen; Lieblingsverein -> Stadt+Farben (lizenzfrei)
  let research = '';
  if (!korr && motto.research && motto.researchField && values[motto.researchField]) {
    try {
      if (motto.researchKind === 'verein') {
        job.research = await researchClub({ openai, model: env.QA_MODEL, storeDir: STORE, club: values[motto.researchField], extra: values.extra });
        // Fanclub: Vereinsname/-farben erlaubt (Nachweis statt Sperre); Lieblingsverein: nur Stadt + Farben
        research = researchClubPrompt(job.research, { fanclub: needsApproval(motto), club: values[motto.researchField] });
        // Der Vereinsname wird NICHT gedruckt (Markenschutz). Ist keine Stadt angegeben,
        // die recherchierte Heimatstadt als gedruckten Haupttext einsetzen.
        if (job.research && job.research.city && 'stadt' in values && !values.stadt) {
          values.stadt = String(job.research.city).replace(/[,;].*$/, '').trim().slice(0, 24);
        }
      } else {
        const ctx = Object.entries(values).filter(([k, v]) => k !== motto.researchField && k !== 'bezug' && v).map(([k, v]) => `${k}: ${v}`).join(', ');
        job.research = await researchMotto({ openai, model: env.QA_MODEL, storeDir: STORE, motto: values[motto.researchField], context: ctx, bezug: values.bezug });
        research = marken.scrub(researchPrompt(job.research));
      }
    } catch (e) { console.error('Recherche gescheitert:', e && e.message ? e.message : e); }
  }

  normalizeUnits(motto, values);
  // Fassung 33: Korrektur - das fertige Motiv (ohne Logo, wenn es eins gab) ist die Vorlage, der Prompt
  // nennt nur die geaenderten Texte. Alles andere soll bleiben, wie es ist.
  let korrQuelle = null, korrPrompt = '';
  if (korr) {
    for (const q of [path.join(STORE, 'art', `${korr.von}_ART.png`), path.join(STORE, 'masters', `${korr.von}_PRINT_MASTER.png`)]) {
      try { korrQuelle = await fs.readFile(q); break; } catch (e) { /* naechste Quelle */ }
    }
    if (!korrQuelle) { job.status = 'error'; job.hint = 'korrektur'; job.error = 'Das Original zur Korrektur ist nicht mehr da'; return; }
    const diffs = [];
    for (const f of (motto.fields || [])) {
      if (f.personal || f.type === 'list' || f.type === 'upload' || f.type === 'checkbox' || f.type === 'wahl') continue;
      const a = String(korr.alt[f.key] || '').trim(), n = String(values[f.key] || '').trim();
      if (a === n) continue;
      if (f.key === 'extra' || f.printed === false) { if (n) diffs.push(n); continue; }
      diffs.push(n ? (a ? `the text "${a}" must now read exactly "${n}"` : `add the text "${n}" in the same lettering style as the other texts`) : `remove the text "${a}"`);
    }
    // 19. Okt., Markus: "nur Teilstuecke aendern" - was der Kunde frei sagt, ist die einzige Aenderung; der Rest
    // bleibt durch den Auftrag ("Everything else stays exactly as it is") und die hohe Vorlagentreue stehen.
    if (korr.aenderung) diffs.push(`what the customer asks for, in their own words: "${String(korr.aenderung).replace(/"/g, '\'')}" - change only that part of the design`);
    if (!diffs.length) { job.status = 'error'; job.hint = 'korrektur'; job.error = 'Fuer eine Korrektur muss sich mindestens ein Text aendern'; return; }
    korrPrompt = [
      'CORRECTION of an existing, finished print design. The supplied image IS the design. Make ONLY this change: ' + diffs.join('; ') + '.',
      'Everything else stays exactly as it is - same composition, same colours, same drawing style, same letter shapes, same positions and sizes. Do not redraw, restyle, add or move anything else. Spell every text exactly as given. If the image contains a logo or emblem, keep it EXACTLY where and how it is - same position, same size, untouched.',
      printRules(textile, style, fsExtra.motivart)
    ].join('\n\n') + druck;
    console.log('Korrektur von', korr.von + ':', diffs.join(' | '));
  }
  // Fassung 15: Jede Platzierung ist eine eigene Druckdatei mit eigenem Format. Diese Groesse
  // muss an den Bilddienst gehen - sonst zeichnet er ein Hochformat fuer einen Brustprint.
  // Fassung 24: bei Freestyle kommt die Leinwand aus dem Artikel (groesste legale Groesse fuer die Flaeche).
  let genSize = (artikel && artikel.size) || grosseLeinwand((PRINT_PLACEMENTS[placement] && PRINT_PLACEMENTS[placement].size) || motto.size);
  // Fassung 34: Logo-Mass passend zum Format - in den Prompt UND spaeter in placeLogo (job.logoPct).
  if (logo) {
    const la = logoAnteil(motto.upload.widthPct, genSize, logo.aspect);
    logo.pct = la.pct; logo.hoehePct = la.hoehePct;
    job.logoPct = la.pct;
  }
  // Fassung 37: Logo als Vorlage - das Modell sieht das echte Logo an seinem Platz und baut das
  // Design darum herum (Markus: "eingebunden, nicht Loch machen und Logo rein"). Danach wird
  // seine Kopie gesucht, geloescht und das scharfe Original exakt dorthin gesetzt.
  // LOGO_WEG=loch schaltet auf den alten Weg (leere Flaeche + Lochsuche) zurueck.
  // Fassung 41: Standardweg ist der Platzhalter (Silhouette in Magenta). Ein Bildmodell reicht
  // keinen Bereich unveraendert durch - es malt auch ein mitgeliefertes Logo neu, mit verschmierter
  // Schrift und eigenem Ring. Eine einfarbige Flaeche dagegen ueberlebt, und was von ihr uebrig
  // ist, laesst sich an der Farbe zweifelsfrei ausstanzen. LOGO_WEG=vorlage schaltet auf das echte
  // Logo in der Vorlage zurueck, LOGO_WEG=loch auf die alte Lochsuche.
  let vorlage = null;
  // Fassung 47: Standardweg ist 'zone' - das Logo laeuft NICHT durch das Bildmodell. Das Motiv
  // wird ohne Logo gezeichnet, danach verkleinert, und das Original kommt in das freie Band.
  // 'platzhalter' und 'vorlage' bleiben als Versuchswege erhalten (LOGO_WEG).
  // Fassung 55: 'grundlage' - das Logo liegt fertig platziert auf der Leinwand, eine Maske sperrt
  // die Stelle fuer das Modell, das Design entsteht drumherum. Andere Wege bleiben per LOGO_WEG waehlbar.
  // Fassung 57: 'traeger' - das Modell zeichnet einen LEEREN Traeger (Banner, Schild, Plakette, von der
  // Szene gehalten), der wird gemessen, und das Original-Logo wird auf seine leere Flaeche gedruckt.
  // Fassung 59: 'eingearbeitet' (Standard) laeuft technisch als 'vorlage' - Leinwand mit dem echten
  // Logo, Bildbearbeitung statt Neuzeichnung - aber OHNE Kopiesuche, Stanzung und Einsetzen.
  const weg = logoEingearbeitet ? 'vorlage' : String(env.LOGO_WEG || 'traeger');
  // Fassung 45: Saum um das Logo (Prozent der Logobreite) und wechselnde waagerechte Lage.
  const saumProzent = Math.min(Math.max(Number(env.LOGO_SAUM != null ? env.LOGO_SAUM : 4), 0), 12);
  const lagenWahl = ['links', 'mitte', 'rechts'];
  const logoLage = motto.upload.place === 'mitte' ? 'mitte' : lagenWahl[Math.floor(Math.random() * lagenWahl.length)];
  // Fassung 50: Jedes Stueck ein Unikat. Die freie Flaeche wird bei jedem Lauf woanders
  // bestellt - das Modell baut das Motiv darum herum, und hinterher wird gemessen, wo sie
  // wirklich liegt (Markus, 15. Sept.: "nicht immer an der gleichen Stelle, jedes Stueck ein Unikat").
  const FREI_LAGEN = [
    { key: 'oben-links', text: 'in the upper left part of the composition', x: 0.30, y: 0.28 },
    { key: 'oben-mitte', text: 'in the upper middle of the composition', x: 0.50, y: 0.26 },
    { key: 'oben-rechts', text: 'in the upper right part of the composition', x: 0.70, y: 0.28 },
    { key: 'mitte-links', text: 'in the left half, at mid height', x: 0.28, y: 0.48 },
    { key: 'mitte', text: 'in the middle of the composition', x: 0.50, y: 0.46 },
    { key: 'mitte-rechts', text: 'in the right half, at mid height', x: 0.72, y: 0.48 },
    { key: 'unten-links', text: 'in the lower left part of the composition', x: 0.30, y: 0.68 },
    { key: 'unten-rechts', text: 'in the lower right part of the composition', x: 0.70, y: 0.68 }
  ];
  const freiLage = FREI_LAGEN[Math.floor(Math.random() * FREI_LAGEN.length)];
  // Traeger passend zum Motto: Haende nur, wenn im Motiv ueberhaupt Menschen vorkommen
  const menschenDa = FIGUREN[figuren] ? FIGUREN[figuren].menschen !== false && hatMenschen(motto) : hatMenschen(motto);
  const freiTraeger = traegerFuer(menschenDa ? motto : { prompt: '', slug: '' });
  // Fassung 57: der leere Traeger fuer das Logo - Form nach Logoform, Farbe nach Logohelligkeit,
  // etwas groesser als das Logo (das Logo bekommt Luft auf der Plakette), Lage wechselnd.
  let traegerFlaeche = null;
  if (logo && upload && motto.upload.mode === 'exact' && !nachbau && !useReference && weg === 'traeger') {
    try {
      const aspect = logo.aspect > 0 ? logo.aspect : 1;
      const hell = await logoHelligkeit(upload).catch(() => 128);
      const [gw, gh] = String(genSize).split('x').map(Number);
      let breite = Math.min(62, Math.round((job.logoPct || motto.upload.widthPct || 34) * 1.25));
      // Gemeinsames Schild fuer Logo und Name: rundes/hohes Logo -> Name als Band darunter (Schild
      // wird 45 % hoeher); breites Logo -> Name rechts daneben (Schild wird um zwei Hoehen breiter).
      const mitName = logoUndNameAufTraeger;
      const gestapelt = mitName && aspect < 1.6;
      let schildAspect = aspect;
      if (mitName && gestapelt) schildAspect = aspect / 1.45;
      if (mitName && !gestapelt) { schildAspect = aspect + 2.0; breite = Math.min(72, Math.round(breite * schildAspect / aspect)); }
      const hoehe = Math.min(58, Math.max(8, Math.round(breite / schildAspect * ((gw || 1024) / (gh || 1536)))));
      const umriss = await logoUmriss(upload, logo.shape, aspect);
      const form = `a blank plaque cut exactly in the logo's own outline - ${umriss} - a little larger than the logo, so that a narrow even margin stays free around it`;
      // Traegerfarbe: dunkles Logo auf heller Plakette, helles auf dunkler. Auf hellem Textil waere
      // creme fast unsichtbar - dort ein warmes Hellgrau mit klarer Kontur.
      // Immer creme (3 von 3 sauber am echten Modell); 'light warm grey' wurde als Metallscheibe mit
      // Schatten gelesen. Helles Logo -> dunkles Navy.
      const farbe = hell > 150 ? 'dark navy blue' : 'cream off-white';
      traegerFlaeche = { form, farbe, hell, breite, hoehe, aspect, schildAspect, mitName, gestapelt, umriss,
        text: freiLage.text, traeger: freiTraeger.replace(/the empty area/g, 'the carrier') };
      console.log('Logo-Traeger bestellt: Umriss "' + umriss + '" ·', traegerFlaeche.farbe, '·', breite + 'x' + hoehe, '% ·', freiLage.key, '· Logo-Helligkeit', hell, mitName ? (gestapelt ? '· mit Name darunter' : '· mit Name rechts') : '');
    } catch (e) { console.error('Logo-Traeger:', e && e.message ? e.message : e); }
  }
  const logoAlsVorlage = !!(logo && upload && motto.upload.mode === 'exact' && !korr && !nachbau && !useReference && (weg === 'platzhalter' || weg === 'vorlage'));
  if (logoAlsVorlage) {
    // Fassung 59: eingearbeitet - das Logo geht GROSS an das Modell (mehr Zeichnung zum Ablesen,
    // gerade bei winzigen Dateien); wo es im Design landet, entscheidet das Modell selbst.
    try { vorlage = await logoVorlage(upload, genSize, motto.upload.place, logoEingearbeitet ? Math.max(job.logoPct || 0, 60) : (job.logoPct || motto.upload.widthPct), { platzhalter: weg === 'platzhalter', ohneGruen: GRUND_MODUS !== 'alpha', lage: logoEingearbeitet ? 'mitte' : logoLage }); }
    catch (e) { console.error('Logo-Vorlage:', e && e.message ? e.message : e); }
  }
  // Fassung 55: Logo als Grundlage - Leinwand mit dem echten Logo an wechselnder Stelle plus Maske.
  let grund = null;
  if (logo && upload && motto.upload.mode === 'exact' && !korr && !nachbau && !useReference && weg === 'grundlage') {
    try {
      grund = await logoGrundlage(upload, genSize, motto.upload.place, job.logoPct || motto.upload.widthPct, { x: freiLage.x, y: freiLage.y, saum: saumProzent, lage: freiLage.key });
      console.log('Logo-Grundlage:', grund.erwartet.cx + '/' + grund.erwartet.cy, 'Breite', grund.erwartet.breite, '· Lage', freiLage.key, '· Saum', saumProzent, '%');
    } catch (e) { console.error('Logo-Grundlage:', e && e.message ? e.message : e); }
  }
  // Korrektur eines Grundlage-Designs: das Original an die gemerkte Stelle ins aufbewahrte Motiv,
  // dieselbe Maske davor - dann bleibt der Platz der Platz.
  if (korr && logo && upload && motto.upload.mode === 'exact' && weg === 'grundlage' && korrQuelle) {
    try {
      const jAlt = await readJob(korr.von);
      const t = jAlt && jAlt.logoTreffer;
      if (t && t.breite > 0) {
        const logoFrei = await logoTrimmen(await freeLogo(upload));
        const lm = await sharp(logoFrei).metadata();
        const mitLogo = await placeLogo(korrQuelle, logoFrei, motto.upload.place, jAlt.logoPct || motto.upload.widthPct, { treffer: { cx: t.cx, cy: t.cy, breite: t.breite } }, {});
        const [gw, gh] = String(genSize).split('x').map(Number);
        const klein = await sharp(mitLogo).resize({ width: gw || 1024, height: gh || 1536, fit: 'inside' }).png().toBuffer();
        const km = await sharp(klein).metadata();
        const am = await sharp(korrQuelle).metadata();
        const fak = km.width / am.width;
        const erwartet = { cx: Math.round(t.cx * fak), cy: Math.round(t.cy * fak), breite: Math.round(t.breite * fak), hoehe: Math.round(t.breite * fak * lm.height / lm.width) };
        grund = { png: klein, maske: await logoMaske(logoFrei, km.width, km.height, erwartet, saumProzent), erwartet, logo: logoFrei, lage: jAlt.logoLage || '' };
        console.log('Korrektur mit Logo-Grundlage:', korr.von, 'Logo bei', erwartet.cx + '/' + erwartet.cy, 'Breite', erwartet.breite);
      }
    } catch (e) { console.error('Korrektur-Logo-Grundlage:', e && e.message ? e.message : e); }
  }
  // Fassung 37, Korrektur eines Vorlage-Designs (Markus, 14. Sept.: "Korrektur hat geklappt beim
  // Text, aber das Logo ist an einem anderen Platz gelandet"): das aufbewahrte Motiv hat an der
  // Logostelle ein Loch, das Modell malte drumherum, und danach wurde wieder ein Loch gesucht.
  // Jetzt: Logo an der gemerkten Stelle in die Vorlage setzen, das Modell sieht es und laesst es
  // stehen, danach dieselbe Suche/Loeschung/Setzung wie beim Original - Platz bleibt Platz.
  if (korr && !vorlage && logo && upload && motto.upload.mode === 'exact' && (weg === 'platzhalter' || weg === 'vorlage')) {
    try {
      const jAlt = await readJob(korr.von);
      const t = jAlt && jAlt.logoTreffer;
      if (t && t.breite > 0) {
        const logoFrei = await logoTrimmen(await freeLogo(upload));
        const am = await sharp(korrQuelle).metadata();
        const lm = await sharp(logoFrei).metadata();
        // Treffer liegt in Pixeln des aufbewahrten Motivs (Generatorgroesse des Originals)
        // Fassung 41: auch hier der Platzhalter statt des echten Logos - bei einer Korrektur malt
        // das Modell genauso alles neu, und ein Magentafleck uebersteht das, ein Logo nicht.
        const korrFarbe = weg === 'platzhalter' ? await platzhalterFarbe(logoFrei, { ohneGruen: GRUND_MODUS !== 'alpha' }) : null;
        // Fassung 44: neutrale Flaeche statt Logoform - sonst malt das Modell das Logo nach
        const inQuelle = korrFarbe ? await platzhalterBild(logoFrei, korrFarbe) : logoFrei;
        korrQuelle = await placeLogo(korrQuelle, inQuelle, motto.upload.place, jAlt.logoPct || motto.upload.widthPct, { treffer: { cx: t.cx, cy: t.cy, breite: t.breite } }, {});
        // Die Vorlage geht in Generatorgroesse zum Modell - Sollposition mitskalieren
        const [gw, gh] = String(genSize).split('x').map(Number);
        const fak = Math.min((gw || am.width) / am.width, (gh || am.height) / am.height);
        vorlage = { png: null, logo: logoFrei, platzhalter: weg === 'platzhalter', farbe: korrFarbe, erwartet: { cx: Math.round(t.cx * fak), cy: Math.round(t.cy * fak), breite: Math.round(t.breite * fak), hoehe: Math.round(t.breite * fak * lm.height / lm.width) } };
        console.log('Korrektur mit Logo-Vorlage:', korr.von, 'Logo bei', vorlage.erwartet.cx + '/' + vorlage.erwartet.cy, 'Breite', vorlage.erwartet.breite);
      }
    } catch (e) { console.error('Korrektur-Logo-Vorlage:', e && e.message ? e.message : e); }
  }
  // Die freie Flaeche wird GROESSER bestellt, als das Logo spaeter braucht. Das Modell knabbert
  // fast immer an den Raendern der Luecke - mit Zugabe bleibt trotzdem eine logogrosse Flaeche
  // uebrig, in der wirklich nichts liegt. Ohne Zugabe war die Luecke zwar da, aber zu klein,
  // und das Logo musste sich seinen Platz nehmen. Das ist vorbei: genommen wird nichts mehr.
  const freiBreitePct = Math.round(job.logoPct || motto.upload.widthPct || 34);
  const freiHoehePct = Math.round(freiBreitePct * (logo && logo.aspect ? 1 / logo.aspect : 1) * (Number(String(genSize).split('x')[0]) / Number(String(genSize).split('x')[1])));
  const logoFreiBlock = (weg === 'integriert' && logo && upload)
    ? { text: freiLage.text, traeger: freiTraeger,
        breite: Math.min(58, Math.round(freiBreitePct * 1.35)),
        hoehe: Math.min(55, Math.round(freiHoehePct * 1.35)) }
    : null;
  job.logoWeg = logoEingearbeitet ? 'eingearbeitet' : vorlage ? (vorlage.platzhalter ? 'platzhalter' : 'vorlage') : grund ? 'grundlage' : traegerFlaeche ? 'traeger' : (logo ? (weg === 'zone' || weg === 'integriert' ? weg : 'loch') : null);
  // Fassung 59: Die Schrift des Logos lesen - sie geht als Pflichttext in den Prompt und wird am
  // Ergebnis geprueft (wie beim Nachzeichnen: "C" und "ne" fehlten zweimal, ohne Kontrolle nie aufgefallen).
  let logoWorte = [];
  if (logoEingearbeitet && vorlage && HAS_LLM) {
    try {
      const lesbar = await sharp(vorlage.logo).resize({ width: 768, fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
      const lese = await textQA(lesbar, [], { marken: false });
      logoWorte = Array.isArray(lese && lese.texts) ? lese.texts.map(t => String(t).replace(/\s+/g, ' ').trim()).filter(t => t && /[A-Za-zÄÖÜäöüß0-9]{2,}/.test(t)).slice(0, 12) : [];
    } catch (e) { console.error('Logo-Schrift lesen:', e && e.message ? e.message : e); }
    job.logoWorte = logoWorte;
    // Fassung 61 (Markus: "Das Cybernetics-Logo ist nicht genau nachgezeichnet"): das Modell sieht
    // ein winziges Logo nur unscharf. Darum beschreibt die Bild-KI es vorher genau - Ringe, Balken,
    // welche Buchstaben welche Farbe - und die Beschreibung geht mit in den Prompt.
    try {
      const lesbar = await sharp(vorlage.logo).resize({ width: 768, fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
      const res = await openai.chat.completions.create({
        model: env.QA_MODEL,
        messages: [{ role: 'user', content: [
          // Fassung 69 (Markus, 16. Sept.): Ein hochgeladenes Bildschirmfoto wurde samt Adressleiste,
          // Uhrzeit und Statusleiste nachgezeichnet - "motto-otto.de" stand im Kundendesign. Die
          // Beschreibung beschraenkt sich deshalb ausdruecklich auf das Logo selbst und meldet,
          // wenn das Bild ein Bildschirmfoto ist.
          { type: 'text', text: 'Describe ONLY the logo in this image for an illustrator who must redraw it EXACTLY, in at most 90 words of plain prose. Cover: every graphic shape (rings, circles, bars, frames, swooshes - how many, where, open or closed, line weight), the exact colour of every element, the text lines and their arrangement, which letters or parts carry a different colour, and the font character (sans/serif, bold/light, upper/lower case). Describe only what is there; no interpretation, no praise. IGNORE everything that is not part of the logo: browser or app chrome, address bars, web addresses, status bars, clock, battery or signal icons, tabs, buttons, window frames, scrollbars, cursors, watermarks, captions and background page content. If the image is a screenshot or a photo of a screen, begin your answer with the single word SCREENSHOT followed by a full stop, and then describe only the logo that is shown inside it.' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,' + lesbar.toString('base64') } }
        ] }]
      });
      let txt = String(res.choices[0].message.content || '').replace(/\s+/g, ' ').trim().slice(0, 700);
      // Bildschirmfoto erkannt: das Wort selbst gehoert nicht in den Prompt, die Warnung schon.
      if (/^SCREENSHOT[.:]/i.test(txt)) {
        job.logoScreenshot = true;
        txt = txt.replace(/^SCREENSHOT[.:]\s*/i, '');
        console.warn('Logo ist ein Bildschirmfoto:', job.jobId, '- nur das Logo darin wird gezeichnet');
      }
      if (txt) job.logoBeschreibung = txt;
    } catch (e) { console.error('Logo beschreiben:', e && e.message ? e.message : e); }
    // Fassung 69: Woerter aus Bildschirmelementen (Adresse, Uhrzeit, Akku) sind kein Logotext -
    // sie wuerden sonst als Pflichtschrift in den Prompt wandern und im Design landen.
    const vorher = logoWorte.length;
    logoWorte = logoWorte.filter(w => !BILDSCHIRM_WORT.test(String(w).trim()));
    if (logoWorte.length !== vorher) {
      job.logoWorteGefiltert = vorher - logoWorte.length;
      console.warn('Logo-Schrift: ' + (vorher - logoWorte.length) + ' Wort/Woerter sahen nach Bildschirmelement aus und wurden verworfen');
    }
    console.log('Logo eingearbeitet:', job.jobId, 'Schrift im Logo:', logoWorte.length ? logoWorte.map(w => '"' + w + '"').join(', ') : '(keine gelesen)', '· Lage', logoLage, job.logoBeschreibung ? '· Beschreibung: ' + job.logoBeschreibung.slice(0, 160) : '');
  }
  const prompt = korr ? korrPrompt : nachbauKopf + buildPrompt(motto, values, { seed: job.id, fassung: job.input.fassung, format: formatFrei, style, colors, logoColors, logo, variation, research, textile, mood, figuren, placement, reference: useReference, consensus: job.input.consensusNote || '', extraWish: values.extra || '', nameZone: zone, ...fsExtra, logoMoeglich: motto.upload.mode === 'exact' && !upload, logoZoneFrei: (weg === 'zone' || weg === 'integriert' || weg === 'traeger') && !!(logo && upload && motto.upload.mode === 'exact'), logoFrei: logoFreiBlock, logoTraegerFlaeche: traegerFlaeche, logoVorlage: !!vorlage || !!grund, logoEingearbeitet: logoEingearbeitet && !!vorlage ? { worte: logoWorte, beschreibung: job.logoBeschreibung || "", screenshot: !!job.logoScreenshot, traeger: freiTraeger, menschen: menschenDa } : null, logoTraeger: grund ? freiTraeger : '', logoPlatzhalter: vorlage && vorlage.platzhalter ? (vorlage.farbe || { hex: '#ff00e6', name: 'magenta' }) : null }) + altersRegel + druck;
  job.logo = logo;
  job.promptHash = crypto.createHash('sha1').update(prompt).digest('hex').slice(0, 10);
  const want = printedTexts(motto, values);
  const MAX_ATTEMPTS = Math.max(1, Math.min(+env.MAX_ATTEMPTS || 3, 5));
  // Mehrere Versuche, aber am Ende wird der BESTE geliefert - statt dem Kunden einen Abbruch
  // zu zeigen. Hart abgebrochen wird nur, wenn gar kein brauchbares Bild zustande kommt
  // (leeres Bild / Bilddienst nicht erreichbar / Motiv abgelehnt). Ein erkanntes geschuetztes
  // Zeichen disqualifiziert ein Bild IMMER - so etwas wird nie als "bestes" geliefert.
  let best = null, transientErr = null, refused = false, extraRules = '', verbotenTreffer = null, letzteDauer = 0;
  // Korrektur mit Logo-Grundlage: die Leinwand mit dem Original ist schon gebaut (siehe oben)
  let korrBild64 = (korr && grund && grund.png) ? grund.png.toString('base64') : null;

  // ---------- Nur-Logo-Druck ----------
  // Kein Prompt, kein Bilddienst, keine Bild-QA: die hochgeladenen Logos werden unveraendert
  // gesetzt. Damit kann hier auch nichts "schwammig" werden oder ein fremdes Zeichen einbauen.
  const nurLogo = motto.nurLogo === true && nurLogoGewaehlt(values);
  let nurLogoPng = null;
  // 5. Okt., Markus (EAST26): "ein Partner hat ein vorgegebenes Design, und wir aendern nur Name, Datum, Spruch und
  // Bewertung ... zusaetzlich die Moeglichkeit, dass voreingestellte Designs auch uebernommen werden." Die schlichte Linie
  // des Shops (minimal-design.js) setzt der Code, ohne Bild-KI - genau das Design aus dem Shop, mit den Angaben des Gastes.
  const linie = !!(job.input.linie && motto.hausTextil && hausEintrag);
  if (linie) {
    try {
      const l = job.input.linie;
      const logoRoh = await fs.readFile(path.join(STORE, 'uploads', uploadFile));
      const r = await minimalMotiv({
        logo: logoRoh, lieblings: l.spruch || lieblingsSatz(hausEintrag), ort: ortsZeile(hausEintrag), punkt: hausEintrag.punkt,
        zusatz: [l.name, l.datum].filter(Boolean).join(' · '), sterne: l.sterne || 0, textil: istHell(textile) ? 'hell' : 'dunkel', W: 2400
      });
      // Auf die Leinwand des Artikels (makeMaster schneidet sonst mit cover zu): mittig, oben buendig wie im Shop.
      const b = artikel && artikel.brutto, mm = await sharp(r.png).metadata();
      const H = b ? Math.max(mm.height, Math.round(mm.width * b[1] / b[0])) : mm.height, Wl = b ? Math.max(mm.width, Math.round(H * b[0] / b[1])) : mm.width;
      nurLogoPng = await sharp({ create: { width: Wl, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: r.png, left: Math.round((Wl - mm.width) / 2), top: 0 }]).png().toBuffer();
      job.qa.push({ attempt: 1, pass: true, reason: 'Schlichte Linie des Partners: ohne Bildgenerator gesetzt' });
      console.log('Partner-Linie:', job.jobId, '·', hausEintrag.firma, '·', JSON.stringify(l));
    } catch (e) {
      job.status = 'error'; job.hint = 'linie'; job.error = 'Das Design konnte nicht gesetzt werden: ' + (e && e.message ? e.message : e);
      return;
    }
  }
  const codeBild = nurLogo || linie;
  if (nurLogo) {
    try {
      // Die Rohdateien, nicht das schon zusammengesetzte 'upload' - hoch- oder nebeneinander
      // entscheidet sich nach dem Format der gewaehlten Platzierung.
      const roh = async (f) => (f ? fs.readFile(path.join(STORE, 'uploads', f)) : null);
      const A = await roh(uploadFile), B = await roh(uploadFile2);
      if (!A && !B) { job.status = 'error'; job.hint = 'logo fehlt'; job.error = 'Fuer den Nur-Logo-Druck fehlt das Logo'; return; }
      const platz = PRINT_PLACEMENTS[placement];
      nurLogoPng = await logoPrint({
        logoA: A, logoB: B,
        size: (platz && platz.size) || motto.size || '1024x1536',
        groesse: String(values.logogroesse || 'gross'),
        textile,
        font: NAME_FONTS[nameFont] || NAME_FONTS.rund,
        zeilen: nurLogoZeilen(motto, values)
      });
      job.qa.push({ attempt: 1, pass: true, reason: 'Nur-Logo-Druck: ohne Bildgenerator gesetzt' });
    } catch (e) {
      job.status = 'error'; job.hint = 'logo'; job.error = 'Logo konnte nicht gesetzt werden: ' + (e && e.message ? e.message : e);
      return;
    }
  }

  for (let attempt = 1; !codeBild && attempt <= MAX_ATTEMPTS; attempt++) {
    // Reicht die Restzeit nicht mehr fuer einen ganzen Versuch, wird keiner mehr begonnen.
    // Sonst liefe er in die Frist hinein - und genau daraus entstand der Fehler, dass der
    // Kunde einen Abbruch sah, waehrend im Hintergrund weitergezeichnet wurde.
    // Gemessen wird an der Dauer des LETZTEN Versuchs, nicht an einer festen Zahl: sonst
    // haengt es an der Stufe und am Modell, ob es ueberhaupt noch einen zweiten Versuch gibt.
    if (attempt > 1) {
      const braucht = Math.min(letzteDauer ? letzteDauer * 1.2 + 30000 : SCHRITT_MS, SCHRITT_MS);
      if (zeitKnapp(job, braucht)) {
        console.warn('Zeit reicht nicht fuer Versuch', attempt, '- letzter Versuch dauerte',
          Math.round(letzteDauer / 1000) + ' s, Restzeit', Math.round(Math.max(0, job.deadline - Date.now()) / 1000) + ' s ·', job.jobId);
        break;
      }
    }
    // Nach einer Ablehnung oder einem Marken-Treffer nicht denselben Prompt wiederholen:
    // andere Motiv-Variation waehlen und die Regeln verschaerfen.
    let attemptPrompt = prompt;
    if (attempt > 1 && (refused || extraRules)) {
      const v2 = !useReference ? pickVariation(mottoVar, { styled: !!(style && style !== 'standard'), format: formatFrei }) : '';
      // Fassung 29: `logo` fehlte hier - der zweite Versuch verlor Form und Rahmen des Logos
      attemptPrompt = korr ? korrPrompt + extraRules : nachbauKopf + buildPrompt(motto, values, { seed: job.id, fassung: job.input.fassung, format: formatFrei, style, colors, logoColors, logo, variation: v2 || variation, research, textile, mood, figuren, placement, reference: useReference, consensus: job.input.consensusNote || '', extraWish: values.extra || '', nameZone: zone, ...fsExtra, logoMoeglich: motto.upload.mode === 'exact' && !upload, logoZoneFrei: (weg === 'zone' || weg === 'integriert' || weg === 'traeger') && !!(logo && upload && motto.upload.mode === 'exact'), logoFrei: logoFreiBlock, logoTraegerFlaeche: traegerFlaeche, logoVorlage: !!vorlage || !!grund, logoEingearbeitet: logoEingearbeitet && !!vorlage ? { worte: logoWorte, beschreibung: job.logoBeschreibung || "", screenshot: !!job.logoScreenshot, traeger: freiTraeger, menschen: menschenDa } : null, logoTraeger: grund ? freiTraeger : '', logoPlatzhalter: vorlage && vorlage.platzhalter ? (vorlage.farbe || { hex: '#ff00e6', name: 'magenta' }) : null }) + altersRegel + extraRules + druck;
    }
    let gen;
    // Dauer je Versuch mitschreiben. Ohne diese Zahl ist die Frage "reicht die Zeitgrenze"
    // eine Schaetzung - und danach zu raten hat uns heute schon genug gekostet.
    const tVersuch = Date.now();
    try {
      if (korr && !korrBild64) {
        // Vorlage auf Generatorgroesse bringen - die Druckdatei ist fuer den Bilddienst zu gross
        const [gw, gh] = String(genSize).split('x').map(Number);
        korrBild64 = (await sharp(korrQuelle).resize({ width: gw || 1024, height: gh || 1536, fit: 'inside' }).png().toBuffer()).toString('base64');
      }
      gen = korr
        ? await editViaBallz(env.BALLZ_MCP_URL, { prompt: attemptPrompt, size: genSize, quality: bildStufe(motto), model: bildModell(), imageBase64: korrBild64, mimeType: 'image/png', maskBase64: grund ? grund.maske.toString('base64') : undefined, inputFidelity: (grund || korr.aenderung) ? 'high' : undefined })
        : nachbau
        // Liegt das gemalte Bild aus Stufe 1 vor, geht ES in die Bildbearbeitung - nicht das Foto.
        ? await editViaBallz(env.BALLZ_MCP_URL, { prompt: attemptPrompt + vorlagenBlock, size: genSize, quality: bildStufe(motto), model: bildModell(), imageBase64: (fotoGemalt || fotoRaw).buffer.toString('base64'), mimeType: (fotoGemalt || fotoRaw).mime || 'image/jpeg' })
        : useReference
          ? await editViaBallz(env.BALLZ_MCP_URL, { prompt: attemptPrompt, size: genSize, quality: bildStufe(motto), model: bildModell(), imageBase64: upload.toString('base64'), mimeType: 'image/png' })
          : vorlage
            ? await editViaBallz(env.BALLZ_MCP_URL, { prompt: attemptPrompt, size: genSize, quality: bildStufe(motto), model: bildModell(), imageBase64: vorlage.png.toString('base64'), mimeType: 'image/png', inputFidelity: logoEingearbeitet ? 'high' : undefined })
            : grund
              ? await editViaBallz(env.BALLZ_MCP_URL, { prompt: attemptPrompt, size: genSize, quality: bildStufe(motto), model: bildModell(), imageBase64: grund.png.toString('base64'), mimeType: 'image/png', maskBase64: grund.maske.toString('base64'), inputFidelity: 'high' })
              : await generateViaBallz(env.BALLZ_MCP_URL, { prompt: attemptPrompt, size: genSize, quality: bildStufe(motto), model: bildModell() });
      letzteDauer = Date.now() - tVersuch;
      // Fassung 72: Modell und Stufe gehoeren in den Datensatz - im Backend soll ablesbar sein,
      // womit ein Design entstanden ist.
      job.modell = bildModell() || '';
      job.stufe = bildStufe(motto) || '';
      console.log('Bild', attempt + '/' + MAX_ATTEMPTS, genSize, bildStufe(motto), bildModell() || '(Standardmodell)', Math.round(letzteDauer / 1000) + ' s');
    } catch (e) {
      letzteDauer = Date.now() - tVersuch;
      transientErr = e && e.message ? e.message : String(e);
      // Stufe vom Bilddienst abgelehnt ('max' gibt es nur bei 2.5er-Modellen): auf 'high' und denselben Versuch wiederholen
      if (/quality/i.test(transientErr) && /(ung[üu]ltig|nur bei|erlaubt|invalid|not supported)/i.test(transientErr) && bildStufe(motto) !== 'high') {
        console.warn('Bildstufe', bildStufe(motto), 'abgelehnt - ab jetzt "high":', transientErr.slice(0, 160));
        STUFE_RUECKFALL = 'high';
        attempt--; continue;
      }
      refused = isRefusal(transientErr);
      if (refused) extraRules = '\nKeep everything family-friendly and generic: no real brands, no real people, no crests, badges or logos of any kind.';
      job.qa.push({ attempt, pass: false, reason: (refused ? 'Motiv vom Bilddienst abgelehnt: ' : 'Bilddienst nicht erreichbar: ') + transientErr });
      continue;
    }

    const cand = gen.png;
    let qa;
    const u18 = !!(geb && (geb.gruppe === 'kind' || geb.gruppe === 'jugend'));
    // Fassung 37 (Markus): beim eigenen Fahrzeug auf dem Foto (Motorrad, Trecker) duerfen die
    // Embleme bleiben - der Kunde hat die Maschine mit der Marke gekauft. Ohne Foto gilt die Sperre.
    const eigenesFahrzeug = !!(useReference && upload);
    // Fassung 59: das eingearbeitete Logo ist das eigene des Kunden (beim Upload geprueft) - die
    // Wappen-Sperre auf dem Bild wuerde es sonst als "nachempfunden" abweisen. Woerter bleiben gesperrt.
    // Fassung 90: Erst messen, ob man den Druck auf dem Stoff ueberhaupt sieht. Das ist
    // billiger als die Bild-QA und faengt den Fall ab, den kein Prompt sicher verhindert.
    try {
      const kon = await textilKontrast(cand, textile);
      if (!kon.ok) {
        console.warn('Versuch', attempt, 'verworfen -', kon.grund, '·', job.jobId);
        job.qa.push({ attempt, pass: false, reason: kon.grund });
        // Die naechste Runde bekommt die Ansage hart und zusaetzlich zu allem anderen.
        extraRules += istHell(textile)
          ? '\nCRITICAL: the print goes on a WHITE garment. Use strong DARK colours for the lettering and the main shapes - deep black, dark navy, dark red. A light or pastel design would be invisible on white fabric.'
          : '\nCRITICAL: the print goes on a BLACK garment. Every letter and every main shape must be LIGHT - cream, off-white, gold, bright saturated colours. Dark navy, dark brown or any dark tone on black fabric is invisible. This overrides any instruction about muted, subtle or toned-down colours.';
        continue;
      }
      job.kontrast = { hell: kon.hellProzent, dunkel: kon.dunkelProzent, mittel: kon.mittel };
    } catch (e) { console.error('Kontrastmessung:', e && e.message ? e.message : e); }

    // Auf reinem Weiss soll Weiss gar nicht erst gedruckt werden, auf reinem Schwarz kein
    // Schwarz - der Stoff liefert die Farbe. Das steht seit dem 25. Sept. im Prompt. Ob die
    // Ansage angekommen ist, sieht man nur an der fertigen Datei, also wird hier GEMESSEN.
    // Gestanzt wird nichts: ein nachtraegliches Ausschneiden liesse an jeder Kante einen
    // grauen Saum stehen und traefe auch jeden Glanzpunkt mitten im Motiv (Markus, 25. Sept.:
    // "dass der prompt so umgeschrieben wird und nicht nachtraeglich rausgeholt wird").
    // Nebenbei: weisseFlaeche() und pruefeSchwarzflaechen() lagen seit Fassung 65 fertig in
    // images.js und wurden von nirgendwo aufgerufen - die Messung war gebaut, aber nie
    // angeschlossen.
    const stoffTon = textilTon(textile);
    if (stoffTon === 'weiss' || stoffTon === 'schwarz') {
      try {
        let flaeche = 0, gesamt = 0;
        if (stoffTon === 'weiss') {
          const m = await weisseFlaeche(cand);
          flaeche = m.anteil; gesamt = m.rohAnteil;
        } else {
          const m = await pruefeSchwarzflaechen(cand, { minDicke: 8 });
          const deckend = m.deckendAnteil || 0;
          flaeche = deckend ? +(m.davonFlaeche / deckend).toFixed(3) : 0;
          gesamt = deckend ? +(m.schwarzAnteil / deckend).toFixed(3) : 0;
        }
        job.stofffarbe = { ton: stoffTon, flaecheAnteil: flaeche, gesamtAnteil: gesamt };
        if (flaeche >= 0.05) {
          console.warn('Stofffarbe gedruckt:', job.jobId, '-', Math.round(flaeche * 100) + ' % des Motivs sind eine dicke Flaeche in ' +
            (stoffTon === 'weiss' ? 'Reinweiss auf weissem' : 'Reinschwarz auf schwarzem') + ' Textil. Die haette der Stoff selbst geliefert.');
        }
      } catch (e) { console.error('Stofffarben-Messung:', e && e.message ? e.message : e); }
    }

    try { qa = await textQA(cand, want, { marken: !markenFrei(motto) && !eigenesFahrzeug, eigenesLogo: logoEingearbeitet, u18, erlaubt: ortsNamen(values), kontext: markenKontext(motto, values) }); }
    catch (e) { console.error('textQA gescheitert:', e && e.message ? e.message : e); qa = { pass: true, reason: 'QA uebersprungen (Fehler)', skipped: true }; }

    // Geburtstag unter 18: Alkohol im Bild? Dann wird dieser Versuch verworfen wie ein
    // verbotenes Zeichen - nicht bewertet, nicht als Notloesung behalten. Der naechste
    // Versuch bekommt eine andere Motiv-Variation und eine noch haertere Ansage.
    if (u18 && qa && Array.isArray(qa.alkohol) && qa.alkohol.length) {
      const was = qa.alkohol.map(a => a.beschreibung).filter(Boolean).join('; ').slice(0, 200);
      extraRules += '\nThe previous image showed alcohol (' + was + '). This is for a child or teenager: NO bottles, glasses, drinks, bars, corks, bubbles or toasting of any kind. Replace with cake, balloons, confetti, stars or sport motifs.';
      job.qa.push({ attempt, pass: false, reason: 'Alkohol im Bild (U18): ' + was });
      console.warn('U18: Alkohol im erzeugten Bild verworfen:', job.jobId, was);
      continue;
    }

    // Verbotenes Zeichen im Bild: dieser Versuch wird NICHT bewertet, sondern weggeworfen.
    // Anders als ein Markentreffer darf er nicht einmal Notloesung werden, wenn sonst
    // nichts zustande kommt - ein Hakenkreuz wird nie gedruckt, auch nicht als bestes
    // von drei schlechten Bildern. Der naechste Versuch bekommt eine harte Ansage mit.
    if (qa.verboten) {
      verbotenTreffer = String(qa.verboten);
      extraRules += '\nAbsolutely no political, historical, military or extremist symbols of any kind: no swastikas, runes, crosses in wheel shapes, eagles over wreaths, skull insignia on caps or collars, no flags. Keep it cheerful and harmless.';
      job.qa.push({ attempt, pass: false, reason: 'verbotenes Zeichen im Bild: ' + verbotenTreffer });
      console.warn('Verbotenes Zeichen im erzeugten Bild verworfen:', job.jobId, verbotenTreffer, qa.verbotenText || '');
      await verbotenMerken({ quelle: 'bild', wort: verbotenTreffer, eingabe: qa.verbotenText || '', motto: motto.slug });
      continue;
    }

    // Bildpruefung darf nie den ganzen Auftrag reissen: unlesbares Bild = dieser Versuch verworfen, naechster.
    let white = 0, worst = 0;
    try { white = await whiteCheck(cand); }
    catch (e) { transientErr = 'Bild unlesbar'; job.qa.push({ attempt, pass: false, reason: 'Bild unlesbar' }); continue; }
    const blank = white > 0.90;
    // edgeCheck misst eine SHIRT-Eigenschaft: ein Shirt-Motiv ist eine freistehende Form, die den
    // Rand nicht beruehren darf. Ein vollflaechiger Artikel laeuft per Bestellzettel bis an alle
    // vier Kanten - da ist die Beruehrung bestellt, nicht ein Mangel. Dort wird nicht gemessen.
    const randlosBestellt = !!(artikel && artikel.motivart === 'vollflaechig');
    if (!randlosBestellt) {
      // 6. Okt.: gemessen wird das transparente Bild selbst - kein Ausschneiden, auch nicht zum Messen.
      try { if (await hatAlpha(cand)) { const ec = await edgeCheck(cand); worst = Math.max(ec.top, ec.bottom, ec.left, ec.right); } } catch (err) { /* uebersprungen */ }
    }
    // 8. Okt., Markus: "nicht zugekleistert ... nicht einfach nur ein grosser Fleck mit bisschen bunter Farbe". Ist das Motiv in
    // seinem Umriss zu voll (Fuelle in Zeilen und Spalten ueber 88 %, fuelleMessen), wird EINMAL mit Luft neu gezeichnet; danach entscheidet die
    // Wertung, ein zweites Mal wird deswegen nicht gezeichnet (Zeit und Bildkosten).
    let zuVoll = 0;
    if (!randlosBestellt && !(artikel && artikel.verfahren && artikel.verfahren !== 'dtf')) {
      try { const fm = await fuelleMessen(cand); if (fm) { job.fuelle = Math.round(fm.fuelle * 100) / 100; if (fm.fuelle > 0.88) zuVoll = fm.fuelle - 0.88; } } catch (e) { /* Messung ist Beiwerk */ }
    }
    if (zuVoll > 0 && !job.fuelleNochmal) {
      job.fuelleNochmal = true;
      extraRules += `\nThe previous image was one dense, solid block (${Math.round((0.88 + zuVoll) * 100)} % of its outline filled) - it read like a sticker, not like a designed print. This time: leave out every filler detail, keep only the main motif, the lettering and at most one accent, and let the bare fabric run INTO the design - clear gaps between the parts, an open, irregular outline, interrupted shapes. Same texts, same style, same colours.`;
    }
    const marke = !!qa.marke;
    if (marke) extraRules = '\nAbsolutely no crests, badges, emblems, shields, coats of arms or logos of any kind - only the given text, the colours and generic motifs.';

    // Ist das Band fuer den Namen frei geblieben? Der Prompt bestellt es leer, aber die
    // Bild-KI malt gern ein Spruchband hinein - und renderName setzt den Namen dann
    // darueber, sodass beides unlesbar wird. Genau so gemeldet. Gemessen wird auf dem
    // freigestellten Motiv, weil auf Chromagruen kein Alphakanal etwas verraet.
    let band = 0;
    if (personal) {
      try { band = await bandBelegt((await motivFreistellen(cand)).png, motto.nameZone); }
      catch (e) { /* Messung ist Beiwerk - daran haengt nie der Auftrag */ }
      if (band > 0.06) extraRules += `\nThe band across the whole width at the very ${motto.nameZone === 'oben' ? 'top' : 'bottom'} MUST stay completely empty - no banner, ribbon, scroll, plaque or lettering there. Move all lettering and ornaments away from it.`;
    }

    // Fassung 34: Ist die Luecke fuer das Logo wirklich gross genug - in Logo-Form gemessen, nicht
    // als Kreuz? Bisher wurde das Logo notfalls ueber die Luecke hinaus vergroessert und deckte
    // dann die Kopfzeile zu (Markus, 14. Sept.: "Motto Otto steht hinter dem Logo, das darf
    // natuerlich nicht sein"). Jetzt kostet eine zu kleine Luecke Punkte und der naechste Versuch
    // bekommt die Ansage, die Flaeche groesser und frei von Schrift zu halten. Geliefert wird am
    // Ende der beste Versuch; placeLogo vergroessert das Logo nie mehr ueber die Luecke hinaus.
    let lueckeFehlt = 0, treffer = null;
    // Fassung 47: im Weg 'zone' gibt es keine Logo-Flaeche im Motiv - also auch nichts zu pruefen.
    const logoFlaeche = !!(logo && upload && motto.upload.mode === 'exact' && !logoEingearbeitet && weg !== 'zone' && weg !== 'integriert' && weg !== 'grundlage' && weg !== 'traeger' && !(artikel && artikel.motivart === 'vollflaechig'));
    // Fassung 59: eingearbeitetes Logo - steht seine Schrift vollstaendig und richtig im Bild?
    // Fehlt ein Wort, faellt der Versuch durch und der naechste bekommt die Buchstaben vorgesagt.
    let logoSchriftFehlt = 0;
    if (logoEingearbeitet && logoWorte.length && qa && !qa.skipped) {
      const gelesen = (Array.isArray(qa.texts) ? qa.texts : []).join(' ').toLowerCase().replace(/\s+/g, ' ');
      const fehlt = logoWorte.filter(w => !gelesen.includes(w.toLowerCase()));
      job.logoSchrift = { soll: logoWorte, fehlt, gelesen: (Array.isArray(qa.texts) ? qa.texts : []).slice(0, 20) };
      if (fehlt.length) {
        logoSchriftFehlt = fehlt.length / logoWorte.length;
        extraRules += `\nThe previous image FAILED because the lettering of the customer's logo was wrong or incomplete (missing or misspelled: ${fehlt.map(w => '"' + w.replace(/"/g, '') + '"').join(', ')}). The logo's lettering must read EXACTLY, letter by letter: ${logoWorte.map(w => '"' + w.replace(/"/g, '') + '"').join(', ')}. Draw the main logo larger and its letters bigger, sharper and clearly legible.`;
      }
    }
    // Fassung 51: Im Weg 'integriert' wird geprueft, ob die BESTELLTE freie Flaeche wirklich frei
    // geblieben ist. Ist sie zugemalt, faellt der Versuch durch und der naechste bekommt die
    // Ansage - sonst landet das Logo am Ende stumpf auf den Figuren (Markus, 16. Sept.).
    if (weg === 'integriert' && logo && upload && motto.upload.mode === 'exact') {
      try {
        const bAnteil = (job.logoPct || motto.upload.widthPct || 34) / 100;
        const hAnteil = Math.min(0.5, bAnteil * (logo.aspect ? 1 / logo.aspect : 1) * (Number(String(genSize).split('x')[0]) / Number(String(genSize).split('x')[1])));
        const belegt = await flaecheBelegt((await motivFreistellen(cand)).png, freiLage.x, freiLage.y, bAnteil, hAnteil);
        job.freiBelegt = Math.round(belegt * 100) / 100;
        // Streng: die Flaeche muss praktisch leer sein. Bei 30 Prozent zugemalt hatte das Logo
        // hinterher nichts, wo es hinkonnte, ohne etwas zu verdecken - und genau das darf nicht
        // passieren. Lieber ein Versuch mehr.
        if (belegt > 0.12) {
          lueckeFehlt = 0.25 + Math.min(0.5, belegt);
          extraRules += `\nThe previous image FAILED because the area that had to stay empty was painted over (${Math.round(belegt * 100)} percent of it was covered). KEEP IT COMPLETELY EMPTY this time: ${freiLage.text}, about ${Math.round(bAnteil * 100)} percent of the width and ${Math.round(hAnteil * 100)} percent of the height, with absolutely nothing inside it - no figure, no hand, no head, no letter, no splash, no colour. The artwork only touches its edge and holds it from outside.`;
        }
      } catch (e) { console.error('Freiflaeche messen:', e && e.message ? e.message : e); }
    }
    // Fassung 57: Traeger - gibt es die bestellte leere, einfarbige Flaeche wirklich, und ist sie
    // gross genug fuer das Logo? Sonst faellt der Versuch durch und der naechste bekommt die Ansage.
    let traegerPlatz = null;
    if (traegerFlaeche) {
      try {
        const [gw] = String(genSize).split('x').map(Number);
        const freiCand = (await motivFreistellen(cand)).png;
        // Das Modell malt den Traeger in der Form, die zur Szene passt - breit, hoch oder rund - egal,
        // was bestellt war (MBSV: breites Schild statt hochkant, und die Suche mit der bestellten Form
        // ging leer aus). Darum keine Form vorschreiben: mehrere Seitenverhaeltnisse probieren, die
        // groesste saubere Flaeche gewinnt. Logo und Name werden danach passend darauf angeordnet.
        const pl = await traegerSuchen(freiCand, traegerFlaeche);
        const soll = (gw || 1024) * traegerFlaeche.breite / 100;
        const sollFlaeche = soll * soll / (traegerFlaeche.schildAspect || traegerFlaeche.aspect || 1);
        if (pl.gefunden && pl.breite * pl.hoehe >= sollFlaeche * 0.2) {
          traegerPlatz = pl;
          job.traegerPlatz = { cx: pl.cx, cy: pl.cy, breite: pl.breite, hoehe: pl.hoehe, helligkeit: pl.helligkeit, anteil: Math.round(pl.breite / soll * 100) / 100 };
        } else {
          lueckeFehlt = 0.3;
          extraRules += `\nThe previous image FAILED because there was no blank, evenly coloured carrier surface for the logo${pl.gefunden ? ' - the one there was far too small' : ''}. Draw it clearly this time: ${traegerFlaeche.traeger}. Its face is ONE flat ${traegerFlaeche.farbe} surface, ${traegerFlaeche.form}, at least ${traegerFlaeche.breite} percent of the picture wide, with absolutely nothing drawn on it.`;
        }
      } catch (e) { console.error('Traeger messen:', e && e.message ? e.message : e); }
    }
    // Fassung 55: Grundlage - das Logo steht dank Maske sicher. Zu pruefen ist nur, ob das Motiv
    // wirklich UM das Logo herum gebaut wurde: rings um die Logostelle muss Motiv liegen. Ein Logo,
    // das allein in der Luft haengt, ist kein integriertes Logo.
    if (grund && grund.erwartet) {
      try {
        const [gw, gh] = String(genSize).split('x').map(Number);
        const e = grund.erwartet, ax = e.cx / gw, ay = e.cy / gh;
        const bw = e.breite / gw, bh = e.hoehe / gh;
        const freiCand = (await motivFreistellen(cand)).png;
        const aussen = await flaecheBelegt(freiCand, ax, ay, Math.min(0.98, bw * 1.8), Math.min(0.98, bh * 1.8));
        const innen = await flaecheBelegt(freiCand, ax, ay, bw, bh);
        const aA = Math.min(0.98, bw * 1.8) * Math.min(0.98, bh * 1.8), aI = bw * bh;
        const ring = Math.max(0, Math.min(1, (aussen * aA - innen * aI) / Math.max(1e-6, aA - aI)));
        job.logoRing = Math.round(ring * 100) / 100;
        if (ring < 0.35) {
          lueckeFehlt = 0.2;
          extraRules += `\nThe previous image FAILED because the artwork did not surround the logo - only ${Math.round(ring * 100)} percent of the space around it was used. The logo must sit INSIDE the design: figures, lettering, ornaments and splashes come right up to its edge on every side and continue behind it. Give it a carrier: ${freiTraeger}.`;
        }
      } catch (e) { console.error('Grundlage pruefen:', e && e.message ? e.message : e); }
    }
    if (logoFlaeche && vorlage) {
      // Fassung 37: Hat das Modell das Logo an Ort und Stelle gelassen? Kopie suchen.
      // Fassung 39: per Formsuche (Kanten), damit auch umgefaerbte Kopien zaehlen.
      // Fassung 41: beim Platzhalter reicht die Farbe - der Fleck IST die Fundstelle.
      try {
        const freiCand = (await motivFreistellen(cand)).png;
        if (vorlage.platzhalter) {
          const p = await platzhalterFinden(freiCand, vorlage.farbe);
          const sigName = (vorlage.farbe && vorlage.farbe.name) || 'magenta';
          const sigHex = (vorlage.farbe && vorlage.farbe.hex) || '#ff00e6';
          // Das Seitenverhaeltnis muss noch stimmen, sonst hat das Modell die Flaeche verzogen
          const sollRatio = vorlage.erwartet.hoehe / vorlage.erwartet.breite;
          const istRatio = p.gefunden ? p.hoehe / p.breite : 0;
          const verzogen = p.gefunden && Math.abs(istRatio - sollRatio) > sollRatio * 0.25;
          // Fassung 42: Wie viel von der reservierten Flaeche ist noch frei? Das Modell malt sonst
          // Figuren hinein, und das eingesetzte Logo liegt spaeter mitten in ihnen (Markus,
          // 15. Sept.: "Um das Logo ist im Design drinnen zu weit unten").
          const uebrig = p.gefunden && !verzogen ? await platzhalterDeckung(freiCand, p, vorlage.farbe) : 0;
          const uebermalt = p.gefunden && !verzogen && uebrig < 0.8;
          treffer = p.gefunden && !verzogen && !uebermalt
            ? { cx: p.cx, cy: p.cy, breite: p.breite, score: 1, deckung: uebrig, gefunden: true, platzhalter: p }
            : { ...vorlage.erwartet, score: 0, deckung: uebrig, gefunden: false, platzhalter: (p.gefunden && !verzogen) ? p : null };
          job.logoTrefferScore = treffer.score;
          if (!treffer.gefunden) {
            lueckeFehlt = 0.2;
            extraRules += verzogen
              ? `\nThe previous image FAILED because the ${sigName} placeholder was stretched or distorted. Keep the ${sigName} shape at EXACTLY the outline, size and proportions it has in the supplied image - do not scale it, do not squash it, do not redraw it.`
              : uebermalt
                ? `\nThe previous image FAILED because figures, lettering or effects were painted ON TOP of the ${sigName} placeholder - only ${Math.round(uebrig * 100)} percent of it was still free. NOTHING may overlap it: every person, animal, object, splash and letter stays completely outside the ${sigName} shape and may at most touch its edge. The placeholder must come out of the image as one untouched flat ${sigName} area.`
                : `\nThe previous image FAILED because the ${sigName} placeholder was painted over, removed or turned into an object. The flat ${sigName} shape (${sigHex}) must still be there afterwards, untouched, at the same place and size, with nothing drawn on it. Build the artwork around it.`;
          }
        } else {
          treffer = await logoFindenForm(freiCand, vorlage.logo, vorlage.erwartet);
          job.logoTrefferScore = treffer.score;
          if (!treffer.gefunden) {
            lueckeFehlt = 0.2;
            extraRules += '\nThe previous image FAILED because the supplied logo was moved, altered or covered. Keep the logo from the supplied image EXACTLY where it is, at exactly that size, unchanged and fully visible, and build the design around it.';
          }
        }
      } catch (e) { console.error('Logo-Kopie suchen:', e && e.message ? e.message : e); }
    } else if (logoFlaeche) {
      try {
        const soll = (job.logoPct || motto.upload.widthPct || 38) / 100;
        const l = await logoLuecke((await motivFreistellen(cand)).png, upload, motto.upload.place);
        job.luecke = Math.round(l.w * 100);
        if (l.w < soll * 0.7) {
          lueckeFehlt = soll * 0.7 - l.w;
          extraRules += `\nThe previous image FAILED because the reserved empty area for the emblem was too small or lettering ran into it (only ${Math.round(l.w * 100)} percent of the width was free). Make the reserved area clearly larger - about ${Math.round(soll * 100)} percent of the width - and keep every letter of every text, including the headline, completely outside of it. The headline sits fully above the area, no letter reaches down into it.`;
        }
      } catch (e) { console.error('Logo-Luecke messen:', e && e.message ? e.message : e); }
    }

    // Bewertung (kleiner = besser): leeres Bild und Marken-Treffer disqualifizieren, Text-QA,
    // Randbeschnitt, ein zugemaltes Namensband und eine zu kleine Logo-Luecke kosten Punkte.
    const score = (blank ? 1000 : 0) + (marke ? 1000 : 0) + (qa.pass ? 0 : 50) + Math.max(0, worst - 0.08) * 200 + Math.max(0, band - 0.06) * 400 + (lueckeFehlt > 0 ? 80 + lueckeFehlt * 300 : 0) + (logoSchriftFehlt > 0 ? 60 + logoSchriftFehlt * 200 : 0) + zuVoll * 300;
    // zu voll macht nur den ERSTEN Versuch unsauber (dann folgt der Versuch mit Luft); danach zaehlt es nur noch in der Wertung
    const clean = !blank && qa.pass && worst <= 0.08 && band <= 0.06 && !(lueckeFehlt > 0) && !(logoSchriftFehlt > 0) && !(zuVoll > 0 && attempt === 1);
    job.qa.push({ attempt, pass: clean, reason: blank ? `fast leeres Bild (${(white * 100).toFixed(1)} % weiss)` : (!qa.pass ? qa.reason : (worst > 0.08 ? `Motiv am Rand knapp (${Math.round(worst * 100)} %)` : (band > 0.06 ? `Namensband zugemalt (${Math.round(band * 100)} % belegt)` : logoSchriftFehlt > 0 ? `Logo-Schrift unvollständig (fehlt: ${job.logoSchrift.fehlt.join(', ')})` : (lueckeFehlt > 0 ? (weg === 'traeger' ? `Keine leere Trägerfläche für das Logo im Bild` : weg === 'integriert' ? `Freie Fläche für das Logo übermalt (${Math.round((job.freiBelegt || 0) * 100)} % zugemalt)` : vorlage ? (vorlage.platzhalter ? `Reservierte Logo-Fläche übermalt (nur ${treffer ? Math.round((treffer.deckung || 0) * 100) : '?'} % frei)` : `Logo nicht an seinem Platz wiedergefunden (Übereinstimmung ${treffer ? treffer.score : '?'})`) : `Logo-Fläche zu klein (${job.luecke} % der Breite frei, gewünscht ${job.logoPct || motto.upload.widthPct} %)`) : undefined)))) });

    if (zuVoll > 0) job.qa[job.qa.length - 1].fuelle = `zu voll (${Math.round((0.88 + zuVoll) * 100)} % im Umriss)`;
    if (!best || score < best.score) {
      best = { png: cand, url: gen.url, score, blank, marke: qa.marke || (marke ? true : null), treffer, traegerPlatz };
      // Welche Woerter stehen wirklich im Bild? Die Bild-QA liest sie ohnehin, bisher wurden
      // sie nur weggeworfen. Im Pruefstand ist das die schnellste Art, durchgerutschten Text
      // zu sehen ("VORNE NAME AN BRUST") - ohne jedes Bild einzeln zu vergroessern.
      job.texte = Array.isArray(qa.texts) ? qa.texts.slice(0, 20) : [];
      job.band = Math.round(band * 1000) / 1000;
    }
    if (clean) break; // gut genug - fertig
  }

  // Jeder Versuch hatte ein verbotenes Zeichen: Abbruch, nicht Notloesung. Ein eigener
  // Grund, damit der Kunde nicht "Dienst nicht erreichbar" liest und ewig neu startet.
  if (!codeBild && !best && verbotenTreffer) {
    job.status = 'qa_failed'; job.hint = 'verboten'; job.error = 'verbotenes Zeichen im Motiv';
    return;
  }
  // Kein einziges brauchbares Bild? Nur dann Abbruch - mit ehrlichem Grund fuer den Kunden (hint).
  if (!codeBild && !best) {
    job.status = 'error';
    job.hint = refused ? 'refused' : 'unreachable';
    // Den echten Grund mitgeben - "nicht erreichbar" heisst hier nur "kein Bild bekommen".
    // Ob der Dienst weg war oder etwas abgelehnt hat, steht in der Meldung (ohne Schluessel o. ae.).
    const grund = String(transientErr || '').replace(/(sk-[A-Za-z0-9_-]{6,})/g, '[schluessel]').replace(/\s+/g, ' ').trim().slice(0, 220);
    job.error = refused ? 'Motiv vom Bilddienst abgelehnt' : 'Bilddienst gerade nicht erreichbar' + (grund ? ' – Meldung: ' + grund : '');
    console.error('Auftrag ohne Bild:', job.jobId, refused ? 'abgelehnt' : 'kein Bild', '·', grund);
    return;
  }
  if (!codeBild && best.marke) {
    job.status = 'qa_failed'; job.hint = 'marke'; job.error = 'geschuetztes Zeichen im Motiv';
    job.markeWort = typeof best.marke === 'string' ? best.marke : '';
    // Entscheidend fuer den Kunden: steht das Wort in dem, was er selbst getippt hat?
    // Dann hilft kein neuer Versuch - dann muss ein anderer Begriff her. Hat dagegen Otto
    // von sich aus ein Zeichen gemalt, ist ein neuer Lauf genau das Richtige.
    const getippt = Object.values(values).filter(v => typeof v === 'string' && v.trim());
    const ausEingabe = marken.checkAll(getippt, ortsNamen(values), markenKontext(motto, values));
    if (ausEingabe) { job.markeAusEingabe = true; job.markeWort = ausEingabe.wort; }
    verbotenMerken({ quelle: 'marke-bild', wort: job.markeWort || best.marke, eingabe: getippt.join(' · '), motto: motto.slug, auftrag: job.designId || job.jobId });
    return;
  }
  if (!codeBild && best.blank) { job.status = 'qa_failed'; job.hint = 'blank'; return; }
  const png = codeBild ? nurLogoPng : best.png;
  job.sourceUrl = codeBild ? '' : best.url;
  job.nurLogo = nurLogo;
  if (linie) job.linie = job.input.linie;

  const designId = await freieNummer(motto.slug);
  // Normalerweise steht die Auftragsnummer schon seit dem Eingang fest (siehe generate).
  // Hier nur der Rueckfall fuer Wege, die keine vergeben haben. Pruefstand-Laeufe sind
  // keine Auftraege und bleiben ohne Nummer.
  if (!job.lfdNr) job.lfdNr = job.test ? 0 : await naechsteLaufnummer();

  // Alles Schwere in einem Zug und unter der eigenen Grenze (siehe mitBildarbeit): Druckdatei
  // bauen, messen, schreiben, Vorschau ableiten. Das ist die Phase mit den grossen Puffern.
  // Fassung 59: eingearbeitet heisst eingearbeitet - das Logo steckt im Motiv, nichts wird daraufgelegt.
  const logoBuf = !codeBild && !logoEingearbeitet && motto.upload.mode === 'exact' && upload ? upload : null;
  const master = await mitBildarbeit('Druckdatei ' + designId, async () => {
    // Erst freistellen, dann das MOTIV OHNE LOGO aufbewahren. Ohne diesen Zwischenschritt
    // steckt das Logo fuer immer in der Druckdatei und kann nie mehr verschoben werden -
    // man muesste das ganze Design neu zeichnen lassen. Nur bei Designs mit Logo, sonst
    // waere es eine zweite Kopie ohne Nutzen.
    // Fassung 24: randlose Artikel (Matte, Brett, Kissen) werden NICHT freigestellt - das Motiv
    // ist die ganze Flaeche, und der Prompt hat auch kein Chromagruen bestellt.
    const vollflaechig = !!(artikel && artikel.motivart === 'vollflaechig');
    const frei = (vollflaechig || linie) ? { png } : await motivFreistellen(png, 'alpha');   // 6. Okt.: nur Alphakanal, nie ausschneiden
    // Fassung 37: die vom Modell gemalte Logo-Kopie ausstanzen - das Original kommt gleich dorthin
    let treffer = null;
    if (logoBuf && vorlage) {
      treffer = (best && best.treffer && best.treffer.gefunden) ? best.treffer : { ...vorlage.erwartet, score: 0, gefunden: false };
      let getilgt = 0, gaenge = 0;
      try {
        if (vorlage.platzhalter) {
          // Fassung 41: Die Signalfarbe raus - fertig. Der Platzhalter hat die Form des Logos,
          // das Motiv ist also schon um die richtige Kontur gewachsen; das Original kommt gleich
          // genau in diese Luecke. Kein Suchen, kein Nachputzen, keine Geisterschrift.
          // Hier liegt dasselbe Motiv noch einmal vor, also neu messen - aber nur, wenn der
          // Versuch ueberhaupt Magenta gemeldet hat. Sonst ist nichts zu stanzen.
          const fund = (treffer && treffer.platzhalter && treffer.platzhalter.gefunden)
            ? await platzhalterFinden(frei.png, vorlage.farbe) : null;
          if (fund && fund.gefunden) { const r = await platzhalterLoeschen(frei.png, fund, vorlage.farbe); frei.png = r.png; getilgt = r.weg; gaenge = 1; }
          // Fassung 45: Saum. Die Logoform plus Rand aus dem Motiv stanzen, BEVOR das Logo
          // hineinkommt - damit steht unter und neben dem Logo garantiert nichts Gemaltes mehr.
          if (saumProzent > 0 && treffer && treffer.breite > 0) {
            try { frei.png = await logoSaumStanzen(frei.png, vorlage.logo, treffer, saumProzent); }
            catch (e) { console.error('Logo-Saum:', e && e.message ? e.message : e); }
          }
        } else {
          // Fassung 39: Schaelgaenge - Formsuche, Stanze, farbgeleitete Reste, erneut suchen. Sonst
          // bleibt ein zweiter Ring oder Geisterschrift um das eingesetzte Original (XW2A).
          const k = await logoKopieEntfernen(frei.png, vorlage.logo, vorlage.erwartet, treffer);
          frei.png = k.png; getilgt = k.getilgt; gaenge = k.gaenge; treffer = k.treffer;
        }
      } catch (e) { console.error('Logo-Kopie loeschen:', e && e.message ? e.message : e); }
      job.logoTreffer = { cx: treffer.cx, cy: treffer.cy, breite: treffer.breite, score: treffer.score, deckung: treffer.deckung, gefunden: !!treffer.gefunden };
      job.logoRest = getilgt; job.logoGaenge = gaenge; job.logoFarbe = (vorlage.farbe && vorlage.farbe.name) || null; job.logoSaum = saumProzent; job.logoLage = vorlage.lage || logoLage;
      console.log(vorlage.platzhalter ? 'Logo-Platzhalter:' : 'Logo-Vorlage:', designId,
        treffer.gefunden ? (vorlage.platzhalter ? 'Platzhalter gefunden' : 'Kopie gefunden') : (vorlage.platzhalter ? 'Platzhalter WEG, Sollposition' : 'Kopie NICHT gefunden, Sollposition'),
        'bei', treffer.cx + '/' + treffer.cy, 'Breite', treffer.breite,
        vorlage.platzhalter ? '· Lage ' + (vorlage.lage || '?') + ' · Signalfarbe ' + ((vorlage.farbe && vorlage.farbe.name) || '?') + ' entfernt: ' + getilgt + ' px · Saum ' + saumProzent + ' %' : '· Score ' + treffer.score + ' Deckung ' + treffer.deckung + ' · ' + gaenge + ' Schaelgaenge, Reste getilgt: ' + getilgt + ' px');
    }
    // Fassung 47: sicherer Weg - Motiv verkleinern, Logo in das freie Band. Ohne Suchen,
    // ohne Stanzen, ohne Signalfarbe. Das Motiv hat das Logo nie gesehen.
    // Fassung 48: Logo INTEGRIERT - die ruhigste, gut gedeckte Stelle im fertigen Motiv suchen,
    // dort einen schmalen Saum stanzen und das Original hineinsetzen. Das Motiv ist ringsum da,
    // das Logo sitzt mittendrin, und der Bilddienst hat das Logo nie gesehen.
    // Fassung 57: Traeger. Die leere Plakette ist gemessen - das Original kommt mit Luft darauf.
    // Kein Stanzen, kein Saum: die Flaeche ist leer, weil sie so bestellt und geprueft wurde.
    if (logoBuf && !vorlage && traegerFlaeche) {
      const pl = best && best.traegerPlatz;
      if (pl && pl.gefunden) {
        // Die Plakette hat die Umrissform des Logos: als Ganzes fluten und den Kasten nehmen - das
        // Logo fuellt ihn bis auf den Saum. Klappt die Flutung nicht, gilt das ruhige Rechteck.
        let blob = null;
        try { blob = await traegerBlob(frei.png, pl); } catch (e) { blob = null; }
        let luft = 0.84;
        let lx = pl.cx, ly = pl.cy, lb = pl.breite, lh = pl.hoehe;
        if (blob && blob.breite >= pl.breite * 0.9) {
          // Fassung 60 (Markus: "Umriss erkennen, Plakette 4 % groesser, Logo rein - kein Rechteck um
          // ein abgerundetes Logo"): die Modell-Plakette wird geloescht und durch die eigene ersetzt -
          // Silhouette des Logos plus Saum, in der bestellten Farbe. Das Logo kommt mittig darauf.
          try {
            const logoFrei = await logoTrimmen(await freeLogo(logoBuf));
            const farbe = traegerFlaeche.hell > 150 ? '#1c2b4a' : '#f4ead2';
            const r = await logoPlakette(frei.png, logoFrei, blob, { saum: Math.max(3, saumProzent), farbe });
            frei.png = r.png;
            lx = r.treffer.cx; ly = r.treffer.cy; lb = r.treffer.breite; lh = r.treffer.hoehe;
            luft = 1;
            job.traegerBlob = { ...blob, maske: undefined, eigenePlakette: r.plakette };
            console.log('Eigene Plakette:', designId, 'Modell-Plakette', blob.breite + 'x' + blob.hoehe, 'geloescht · Logo', lb, 'breit · Plakette', r.plakette ? r.plakette.breite + 'x' + r.plakette.hoehe + ' · Saum ' + r.plakette.saum + ' px' : '(ausserhalb)', '·', farbe);
          } catch (e) { console.error('Eigene Plakette:', e && e.message ? e.message : e); }
        } else if (logo && logo.shape === 'rund' && !traegerFlaeche.mitName) {
          luft = 1.12;   // rundes Logo auf rundem Medaillon: ueber das Quadrat im Kreis hinaus
        }
        // Mit Name: die Plakette gehoert dem Logo; der Name sucht sich das Band darunter selbst
        // (renderNameImMotiv) - oder kommt unter das Motiv, wenn das Modell keins gemalt hat.
        if (false && traegerFlaeche.mitName) {
          // Anordnung nach der GEFUNDENEN Form, nicht nach der bestellten: breite Flaeche -> Logo links,
          // Name rechts; sonst Logo oben, Name als Band darunter.
          const breitGefunden = pl.breite / Math.max(1, pl.hoehe) >= 1.7;
          if (!breitGefunden) {
            // oben das Logo (69 % der Hoehe), unten das Namensband
            lh = pl.hoehe * 0.69; ly = pl.cy - pl.hoehe / 2 + lh / 2;
            job.nameTraegerPlatz = { cx: pl.cx, cy: Math.round(pl.cy + pl.hoehe / 2 - pl.hoehe * 0.155), breite: pl.breite, hoehe: Math.round(pl.hoehe * 0.31), helligkeit: pl.helligkeit };
          } else {
            // links das Logo (quadratischer Teil), rechts der Name
            lb = Math.min(pl.breite * 0.42, pl.hoehe * traegerFlaeche.aspect); lx = pl.cx - pl.breite / 2 + lb / 2;
            job.nameTraegerPlatz = { cx: Math.round(pl.cx + lb / 2), cy: pl.cy, breite: Math.round(pl.breite - lb), hoehe: pl.hoehe, helligkeit: pl.helligkeit };
          }
        }
        const breite = Math.round(Math.min(lb * luft, lh * luft * traegerFlaeche.aspect));
        treffer = { cx: Math.round(lx), cy: Math.round(ly), breite, score: 1, deckung: 1, gefunden: true };
        job.logoTreffer = { cx: Math.round(lx), cy: Math.round(ly), breite, score: 1, deckung: 1, gefunden: true };
        job.traegerSchild = { cx: pl.cx, cy: pl.cy, breite: pl.breite, hoehe: pl.hoehe };
        job.logoLage = freiLage.key;
        console.log('Logo auf Traeger:', designId, 'Plakette', pl.breite + 'x' + pl.hoehe, 'bei', pl.cx + '/' + pl.cy, '· Logo', breite, 'breit · Helligkeit', pl.helligkeit, '· bestellt', freiLage.key);
      } else {
        job.logoAusweich = 'zone';
        console.log('Logo auf Traeger:', designId, 'keine leere Traegerflaeche im besten Bild - Logo bekommt einen eigenen Platz');
      }
    }
    // Fassung 55: Grundlage. Die Stelle steht fest - sie war fuer das Modell gesperrt. Sie wird
    // geleert (was die API dort durchgereicht hat, ist nur die Kopie unserer Leinwand) und bekommt
    // gleich in makeMaster das Original in voller Aufloesung. Kein Suchen, kein Raten.
    if (logoBuf && !vorlage && grund && grund.erwartet) {
      try {
        const e = grund.erwartet;
        // Genau die gesperrte Flaeche leeren (Logo, Saum, Loecher im Logo) - dieselbe Maske wie beim Modell
        const fm = await sharp(frei.png).metadata();
        const mm = await sharp(grund.maske).metadata();
        const maskeHier = (fm.width === mm.width && fm.height === mm.height) ? grund.maske
          : await sharp(grund.maske).resize({ width: fm.width, height: fm.height, fit: 'fill', kernel: 'nearest' }).png().toBuffer();
        frei.png = await sharp(frei.png).ensureAlpha().composite([{ input: maskeHier, blend: 'dest-out' }]).png().toBuffer();
        treffer = { cx: e.cx, cy: e.cy, breite: e.breite, hoehe: e.hoehe, score: 1, deckung: 1, gefunden: true };
        job.logoTreffer = { cx: e.cx, cy: e.cy, breite: e.breite, score: 1, deckung: 1, gefunden: true };
        job.logoSaum = Math.max(2, saumProzent); job.logoLage = grund.lage || (freiLage && freiLage.key) || '';
        console.log('Logo-Grundlage:', designId, 'Original bei', e.cx + '/' + e.cy, 'Breite', e.breite, '· Ring', job.logoRing != null ? job.logoRing : '?', '· Lage', job.logoLage);
      } catch (e) { console.error('Logo-Grundlage setzen:', e && e.message ? e.message : e); }
    }
    if (logoBuf && !vorlage && weg === 'integriert') {
      try {
        const platz = await logoPlatzSuchen(frei.png, logoBuf, motto.upload.place, job.logoPct || motto.upload.widthPct, { wunschX: freiLage.x, wunschY: freiLage.y });
        // Nur in eine WIRKLICH freie Flaeche. Gibt es keine, wird nichts gestanzt und nichts
        // ueberdeckt - dann bekommt das Logo weiter unten seinen eigenen Platz. Lieber ein
        // Design mit Logo daneben als ein Design mit einem Loch mittendrin.
        if (platz.gefunden) {
          if (saumProzent > 0) {
            try { frei.png = await logoSaumStanzen(frei.png, await logoTrimmen(await freeLogo(logoBuf)), platz, saumProzent); }
            catch (e) { console.error('Logo-Saum:', e && e.message ? e.message : e); }
          }
          treffer = platz;
          job.logoTreffer = { cx: platz.cx, cy: platz.cy, breite: platz.breite, score: 1, deckung: platz.gedeckt, gefunden: true };
          job.logoSaum = saumProzent; job.logoStruktur = platz.struktur; job.logoLage = freiLage.key; job.logoLoch = !!platz.loch; job.logoRing = platz.ring;
          console.log('Logo integriert:', designId, 'bei', platz.cx + '/' + platz.cy, 'Breite', platz.breite,
            '· bestellt', freiLage.key, '· Flaeche war frei (', platz.gedeckt, 'belegt) · Rahmen', platz.ring, '· Struktur', platz.struktur, '· Saum', saumProzent, '%');
        } else {
          job.logoAusweich = 'zone';
          console.log('Logo integrieren:', designId, 'keine freie Flaeche im Motiv - Logo bekommt einen eigenen Platz (nichts wird ueberdeckt)');
        }
      } catch (e) { console.error('Logo integrieren:', e && e.message ? e.message : e); }
    }
    // Ausweich-Weg, wenn im Motiv keine freie Flaeche war (und der feste Weg 'zone'):
    // Motiv verkleinern, Logo in den frei gewordenen Streifen. Nichts wird ueberdeckt.
    if (logoBuf && !vorlage && (weg === 'zone' || job.logoAusweich === 'zone')) {
      try {
        const z = await logoZoneLegen(frei.png, logoBuf, motto.upload.place, job.logoPct || motto.upload.widthPct);
        frei.png = z.png; treffer = z.treffer;
        job.logoTreffer = { cx: z.treffer.cx, cy: z.treffer.cy, breite: z.treffer.breite, score: 1, deckung: 1, gefunden: true };
        job.logoBand = z.band; job.logoOben = z.oben;
        console.log('Logo-Zone:', designId, z.oben ? 'oben' : 'unten', '· Band', z.band, 'px · Logo', z.treffer.breite + 'x' + z.treffer.hoehe, 'bei', z.treffer.cx + '/' + z.treffer.cy);
      } catch (e) { console.error('Logo-Zone:', e && e.message ? e.message : e); }
    }
    if (logoBuf) {
      try {
        await fs.mkdir(path.join(STORE, 'art'), { recursive: true });
        await fs.writeFile(path.join(STORE, 'art', `${designId}_ART.png`), frei.png);
      } catch (e) { console.error('Motiv ohne Logo nicht ablegbar:', designId, e && e.message ? e.message : e); }
    }
    const m = await makeMaster(frei.png, {
      schonFrei: true,
      targetWidth: env.MASTER_WIDTH,
      logo: logoBuf,
      logoTreffer: treffer,
      place: motto.upload.place,
      widthPct: job.logoPct || motto.upload.widthPct,
      bericht: logoBuf ? (job.logoBericht = {}) : undefined,
      leinwand: artikel ? { dpi: artikel.dpi, dpiExakt: artikel.dpiExakt || artikel.dpi, cm: artikel.brutto || null } : null,
      ...schwarzOpts(job.input)
    });
    // Fassung 25/26, Weg "so einsetzen": das Foto kommt NICHT in diese Datei. Erst wenn der Kunde
    // "Ja, so ist es gut" drueckt, wird es hineingesetzt und danach geloescht (designFreigeben).
    // Hier wird nur gemessen, WO die freie Flaeche im fertigen Motiv liegt (findHole), damit
    // Prompt-Zone und Einsetz-Bereich nicht von Hand gleichgehalten werden muessen.
    if (foto) {
      let bereich = { left: 0.22, top: 0.14, width: 0.56, height: 0.56 };
      if (foto.modus === 'original') {
        try {
          const h = await findHole(m, 'mitte');
          if (h && h.kind === 'hole' && h.w >= 0.2 && h.h >= 0.2) {
            // In Pixeln rechnen: ein Kreis muss in Pixeln rund sein, nicht in Anteilen zweier
            // verschieden langer Kanten. Leicht groesser als die Luecke, damit keine Kante bleibt.
            const meta = await sharp(m).metadata();
            let pw = Math.min(meta.width * 0.96, h.w * 1.04 * meta.width), ph = Math.min(meta.height * 0.96, h.h * 1.04 * meta.height);
            if (foto.form === 'kreis') { const s = Math.min(pw, ph); pw = s; ph = s; }
            bereich = { left: Math.max(0, h.cx - pw / meta.width / 2), top: Math.max(0, h.cy - ph / meta.height / 2), width: pw / meta.width, height: ph / meta.height };
          }
        } catch (e) { console.error('Foto-Flaeche messen:', e && e.message ? e.message : e); }
      }
      job.foto = { sitzung: foto.sitzung, modus: foto.modus, form: foto.form, bereich, wartet: true, freigegeben: false };
    }
    // Torwaechter: die fertige Druckdatei messen, nicht ihr glauben. Der Befund haengt am
    // Auftrag und ist damit im Backend und auf der Druckseite sichtbar.
    job.modell = bildModell() || null;
    job.stufe = bildStufe(motto);
    job.druck = await pruefeDruckdatei(m, { vollflaechig: !!(artikel && artikel.motivart === 'vollflaechig') || vollflaechig });
    if (!job.druck.druckfaehig) console.warn('Druckdatei mit Maengeln:', designId, job.druck.gruende.join('; '));
    if (job.logoBericht && (job.logoBericht.klein || job.logoBericht.deckung > 2)) console.warn('Logo-Befund:', designId, job.logoBericht.klein ? `Logo nur ${job.logoBericht.klein} % breit (Luecke zu klein)` : '', job.logoBericht.deckung > 2 ? `deckt ${job.logoBericht.deckung} % seiner Flaeche Motiv zu` : '');
    // Fassung 28: gefuellte Punzen und Schlagschatten nur MELDEN, nie automatisch wegrechnen -
    // Punze und Kontur sind eine Komponente, das geht nicht sauber (00k-ZUSATZ).
    if (schwarzOpts(job.input).schwarzPruefen) {
      try {
        job.dunkel = await pruefeDunkleFlaechen(m);
        if (job.dunkel.gefuellteFlaechen) console.warn('Dunkle Fuellflaechen in der Druckdatei:', designId, job.dunkel.gefuellteFlaechen, 'Flaechen,', job.dunkel.davonAnteil, '% der Leinwand');
      } catch (e) { console.error('Punzen-Pruefung:', e && e.message ? e.message : e); }
    }
    await fs.writeFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`), m);
    // Fassung 54: Name ins Motiv gesetzt (auf Shirt, Schild, Banner) - klappt das nicht, kommt er
    // wie bisher gross unter das Motiv.
    let firstNamed = m;
    if (personal && names.length) {
      if (job.input.nameArt === 'motiv') {
        let namePlatz = null;
        if (job.nameTraegerPlatz && job.traegerSchild) {
          try {
            const mm = await sharp(m).metadata(); const am = await sharp(frei.png).metadata();
            const fak = mm.width / am.width; const np = job.nameTraegerPlatz;
            namePlatz = { cx: Math.round(np.cx * fak), cy: Math.round(np.cy * fak), breite: Math.round(np.breite * fak), hoehe: Math.round(np.hoehe * fak), helligkeit: np.helligkeit };
          } catch (e) { namePlatz = null; }
        }
        const r = await renderNameImMotiv(m, names[0], { font: nameFont, platz: namePlatz }).catch(() => ({ gesetzt: false }));
        firstNamed = r.gesetzt ? r.png : await renderName(m, names[0], { zone: motto.nameZone, font: nameFont, style, textile });
        job.nameImMotiv = !!r.gesetzt;
        if (!r.gesetzt) console.log('Name im Motiv:', designId, 'keine ruhige Flaeche gefunden - Name kommt unter das Motiv');
      } else {
        firstNamed = await renderName(m, names[0], { zone: motto.nameZone, font: nameFont, style, textile });
      }
    }
    await fs.writeFile(path.join(STORE, 'previews', `${designId}.png`), await makePreview(firstNamed));
    return m;
  });
  job.names = names;
  job.people = people || [];
  job.aufteilung = names.length && AUFTEILUNGEN.includes(aufteilung) ? aufteilung : 'vorne';
  job.textile = textile;

  // Die Auftragsdatei ist der AUSWEIS des Designs: daraus kommen Motto, Eingaben, Stil,
  // Textil und der Entstehungszeitpunkt - in der Druckliste, im Konto des Kunden, bei der
  // Druckerei. Sie wurde bisher erst ganz am Schluss geschrieben, NACH der Rueckseite. Die
  // Rueckseite ist aber eine zweite komplette Bildgenerierung; brach in dieser Minute etwas
  // ab (Neustart, Deploy, Zeitueberschreitung), lag die Druckdatei da und der Ausweis fehlte
  // fuer immer. In der Liste stand dann ein namenloses Design mit geschaetzter Uhrzeit.
  // Darum jetzt zweimal: einmal sofort, sobald die Druckdatei steht, und einmal am Ende mit
  // allem, was inzwischen dazugekommen ist (Rueckseite, Bewertungssperre).
  // 25. Sept. im Protokoll gefunden, ohne danach gesucht zu haben: seit dem 15. September
  // scheitert die ERSTE Sicherung bei JEDEM Auftrag - rund hundert Stueck bis heute frueh.
  //   "Auftragsdatei schreiben: MO-GRUESSEA-20260925-MP7V Cannot access 'firmaDesAuftrags'
  //    before initialization"
  // firmaDesAuftrags wurde erst weiter unten mit let angelegt, stand aber schon in dieser
  // Funktion - also warf sie jedes Mal, bevor auch nur ein Byte geschrieben war. Aufgefallen
  // ist es nie, weil die ZWEITE Sicherung am Ende durchlaeuft und dieselbe Datei schreibt.
  // Genau die erste war aber die Versicherung dagegen, dass eine fertige Karte bei Neustart,
  // Deploy oder Zeitueberschreitung ohne Ausweis liegen bleibt - der Fall vom 23. September,
  // als ein Kunde in Spanien seine Postkarte verloren hat. Sie hat nie funktioniert.
  // Also steht die Zuordnung jetzt VOR der Funktion, die sie benutzt.
  // Gehoert der Auftrag einem Firmenkonto? Das entscheidet mit, ob das Design privat bleibt.
  let firmaDesAuftrags = null;
  try { if (job.who && job.who.userId) { const u = await accounts.byId(job.who.userId); firmaDesAuftrags = u && u.firma && u.firma.name ? u.firma.name : null; } } catch (e) { /* im Zweifel wie bisher */ }

  const auftragSichern = async (sperrgrund) => {
    try {
      await fs.writeFile(path.join(STORE, 'jobs', `${designId}.json`), JSON.stringify({
        designId, lfdNr: job.lfdNr || 0, firma: firmaDesAuftrags || '', motto: motto.slug, values, fassung: (job.input && job.input.fassung) || PROMPT_FASSUNG, style: style || 'standard', colors: colors || '', variation: variation || '', user: job.who && job.who.userId || null, gast: job.who && job.who.guestId || null, quelle: job.who && job.who.quelle || null, via: job.who && job.who.via || null, names, people: people || [], aufteilung: job.aufteilung || 'vorne', back: job.back || null, nameZone: motto.nameZone, nameFont, textile,
        // Fassung 90: die gewaehlte Druckflaeche gehoert in den Datensatz. Sie bestimmt Format
        // und Seitenverhaeltnis der Leinwand (36x46 hochkant, 10x10 quadratisch, 28x20 quer).
        // Sie fehlte hier - deshalb konnte das Konsens-Design sie nicht uebernehmen und kam in
        // einem anderen Format zurueck als die Entwuerfe, ueber die abgestimmt wurde.
        placement: placement || '',
        logo: job.logo || null, research: job.research || null, prompt, qa: job.qa, stofffarbe: job.stofffarbe || null, created: job.created, upload: uploadFile || null, upload2: uploadFile2 || null,
        // Fassung 24-26: Artikel (Verfahren, Flaeche, dpi) und Foto-Stand. Nie das Foto selbst,
        // nur die Sitzungsnummer des RAM-Speichers und wo es eingesetzt wird.
        artikel: artikel || null,
        korrekturVon: korr ? korr.von : null,
        // Fassung 37: Logo-Weg, Sollmass und Fundstelle - braucht die Feinjustierung und die Korrektur,
        // damit das Logo dort bleibt, wo es das Original hatte.
        // Fassung 72 (Markus, 17. Sept.: "Der Stil ist nicht im Backend ersichtlich"): alles, was
        // die Gestaltung bestimmt hat, gehoert in den Datensatz - sonst ist im Nachhinein nicht
        // mehr zu sehen, womit ein Design entstanden ist.
        figuren: (job.input && job.input.figuren) || null, mood: (job.input && job.input.mood) || null,
        modell: job.modell || null, stufe: job.stufe || null,
        logoWeg: job.logoWeg || null, logoPct: job.logoPct || null, logoTreffer: job.logoTreffer || null, logoRest: typeof job.logoRest === 'number' ? job.logoRest : null, logoGaenge: job.logoGaenge || null, logoFarbe: job.logoFarbe || null, nameArt: job.input && job.input.nameArt ? job.input.nameArt : null, logoArt: job.input && job.input.logoArt ? job.input.logoArt : null, logoWorte: job.logoWorte || null, logoSchrift: job.logoSchrift || null, logoSaum: job.logoSaum != null ? job.logoSaum : null, logoLage: job.logoLage || null, logoBand: job.logoBand || null, logoOben: job.logoOben != null ? job.logoOben : null,
        foto: job.foto ? { sitzung: job.foto.sitzung, modus: job.foto.modus, form: job.foto.form, bereich: job.foto.bereich, wartet: !!job.foto.wartet, freigegeben: !!job.foto.freigegeben, rechte: !!(values && values.foto_rechte) } : null,
        // Warum dieses Design nicht automatisch in die Community-Bewertung darf (leer = darf)
        bewertungSperre: sperrgrund || '',
        // Anzahl Namen, deren Rueckseite aus Zeitmangel nicht erzeugt wurde (0 = alles da)
        backOffen: job.backOffen || 0,
        // Pruefstand-Lauf: gehoert keinem Kunden. Das MUSS in der Datei stehen, sonst steht ein
        // Testdesign spaeter ungekennzeichnet zwischen den echten Kundendesigns - und man kann
        // die Testlaeufe hinterher nicht mehr von echter Arbeit unterscheiden.
        test: !!job.test
      }, null, 2));
    } catch (e) { console.error('Auftragsdatei schreiben:', designId, e && e.message ? e.message : e); }
  };
  await auftragSichern(null);

  // ---------- Rueckseite mit allen Namen (z. B. Abi/Schulmotto) ----------
  // Nur wenn das Motto einen backPrompt hat UND eine Namensliste vorliegt. Nicht-fatal:
  // scheitert die Rueckseite, bleibt die Vorderseite trotzdem bestehen.
  try {
    // 23. Sept., Markus: "Schulausflug, Meisterfeier, Firmenausflug - ueberall dort, wo Namen
    // eingetragen werden koennen, und natuerlich auf Wunsch auch bei Freestyle."
    // Vorher haing die Rueckseite an motto.backPrompt, und den hatte genau EIN Motto (Abi).
    // Jetzt haengt sie daran, ob das Motto eine Namensliste entgegennimmt - der Prompt wird
    // aus den Feldern gebaut (rueckseitePrompt in mottos.js). Bei Freestyle entscheidet der
    // Kunde: ohne ausdruecklichen Wunsch keine Rueckseite.
    const namensFeld = namensFeldFuer(motto);
    const backNames = (namensFeld && values[namensFeld])
      ? cleanNames(values[namensFeld], 24).names
      : names;
    const rueckText = rueckseitePrompt(motto);
    // Die Rueckseite ist ein ZWEITER kompletter Bildlauf - so teuer und so lang wie die
    // Vorderseite. Sie wird deshalb nur gezeichnet, wenn der Kunde sie ausdruecklich
    // angehakt hat ("Alle Namen auf die Rueckseite"). Niemand zahlt doppelt, ohne es zu
    // wollen, und niemand wartet doppelt, ohne es zu wissen.
    const gewuenscht = /^(ja|yes|1|true|on)$/i.test(String(values.rueckseite || ''));
    const rueckseiteMoeglich = !!rueckText && hatNamensliste(motto) && gewuenscht;
    // Die Rueckseite ist eine ZWEITE komplette Bildgenerierung und damit ungefaehr so teuer
    // wie die Vorderseite. Reicht die Zeit nicht mehr, wird sie ausgelassen statt in die
    // Frist zu laufen: eine gelieferte Vorderseite ist besser als ein Abbruch fuer beides.
    // job.backOffen macht das im Backend sichtbar, damit es nicht stillschweigend fehlt.
    if (rueckseiteMoeglich && backNames.length && zeitKnapp(job, SCHRITT_MS + 60000)) {
      job.backOffen = backNames.length;
      console.warn('Rueckseite ausgelassen, Zeit zu knapp -', backNames.length, 'Namen ·', job.jobId);
    } else if (rueckseiteMoeglich && backNames.length) {
      const backMotto = { ...motto, prompt: rueckText, upload: { mode: 'off' } };
      // 23. Sept., Markus: "nur dass vorne und hinten verschiedene Farben sind, ist natuerlich
      // doof." Der Prompt sagte nur "same palette as the front" - zu schwach. Gemessen am
      // Firmenausflug: vorne 36 % Navy und KEIN Gold, hinten 14 % Gold und nur 5 % Navy. Der
      // Stil College laesst "navy and gold ODER maroon and cream" zu, also hat das Modell
      // zweimal unabhaengig gewaehlt. Jetzt bekommt es die Farben der fertigen Vorderseite als
      // Zahlenwerte vorgegeben - eine Absichtserklaerung laesst ihm die Wahl, ein Hexwert nicht.
      let palette = '';
      try { palette = palettePrompt(await dominantColors(png)); }
      catch (e) { console.warn('Palette der Vorderseite nicht messbar:', e && e.message ? e.message : e); }
      const backPrompt = buildPrompt(backMotto, values, { seed: job.id, style, colors, variation: '', textile, nameZone: nameListZonePrompt() })
        + (palette ? '\n' + palette : '');
      // 23. Sept.: Die Rueckseite bekam GENAU EINEN Versuch und keine Rechtschreibpruefung -
      // die Vorderseite dagegen bis zu drei Versuche mit textQA. Beim ersten Probelauf der
      // neuen Rueckseite schrieb das Modell "ABIñauten" statt "ABInauten", und so etwas waere
      // ungeprueft beim Kunden gelandet. Jetzt gilt fuer die Rueckseite dieselbe Huerde wie
      // fuer die Vorderseite: der Text muss stimmen, sonst wird nachgezeichnet.
      let backPng = null;
      for (let versuch = 1; versuch <= 2 && !backPng; versuch++) {
        const gen = await editViaBallz(env.BALLZ_MCP_URL, {
          prompt: backPrompt + (versuch > 1 ? '\nThe previous attempt misspelled the given text. Spell every word EXACTLY as written above - no extra accents, no tilde, no changed letters.' : ''),
          size: grosseLeinwand(motto.size), quality: bildStufe(motto), model: bildModell(),
          imageBase64: png.toString('base64'), mimeType: 'image/png'
        });
        let ok = true;
        try {
          const qa = await textQA(gen.png, want, { marken: !markenFrei(motto) && !eigenesFahrzeug, eigenesLogo: logoEingearbeitet, u18, erlaubt: ortsNamen(values), kontext: markenKontext(motto, values) });
          ok = qa.pass !== false;
          if (!ok) console.warn('Rueckseite Versuch ' + versuch + ': Text stimmt nicht -', JSON.stringify(qa).slice(0, 200));
        } catch (e) { /* QA nicht erreichbar - dann lieber das Bild nehmen als gar keine Rueckseite */ }
        // Der letzte Versuch wird genommen, auch wenn die Pruefung meckert: eine Rueckseite
        // mit einem Schoenheitsfehler ist besser als gar keine.
        if (ok || versuch === 2) backPng = gen.png;
      }
      const backMaster = await mitBildarbeit('Rueckseite ' + designId, async () => {
        const backBase = await makeMaster(backPng, { targetWidth: env.MASTER_WIDTH });
        // style mitgeben - sonst steht die Namensliste der Rueckseite in einer anderen
        // Schrift als der Name auf der Vorderseite.
        // 8. Okt. (Markus: "Mit dem Namen kann man spielen"): je Design eine Anordnung - Raster, Zickzack oder Sitzreihen im Bogen.
        const anordnung = ['raster', 'versetzt', 'bogen'][[...designId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % 3];
        return renderNameList(backBase, backNames, { font: nameFont, style, textile, anordnung });
      });
      await fs.writeFile(path.join(STORE, 'masters', `${designId}_BACK_MASTER.png`), backMaster);
      await fs.writeFile(path.join(STORE, 'previews', `${designId}_back.png`), await makePreview(backMaster));
      job.back = { names: backNames, count: backNames.length };
    }
  } catch (e) {
    console.error('Rueckseite konnte nicht erzeugt werden:', e && e.message ? e.message : e);
  }

  const exp = Date.now() + 14 * 86400e3;
  const sig = signPreview(designId, exp, SIGN_SECRET);
  job.designId = designId;
  job.preview = `${env.PUBLIC_BASE_URL}/api/mo/preview/${designId}.png?exp=${exp}&sig=${sig}`;
  job.sig = { exp, sig };
  // Fassung 74 (Markus, 17. Sept.: "Designs sind alle auf dem Shirt, obwohl sie teilweise fuer
  // ein anderes Teil erstellt worden sind, und das sieht scheisse aus"): Ein Motiv, das fuer ein
  // Strandtuch mit 70 x 140 cm gebaut wurde, hing als hohes Plakat auf dem T-Shirt. Es gehoert
  // dort nicht hin - nicht weil das Mockup falsch rechnet, sondern weil es dieses Teil nie
  // werden sollte. Also: das BESTELLTE Teil zuerst, und nur die Teile dazu, auf denen dasselbe
  // Motiv auch wirklich etwas hermacht.
  const eigeneAnsicht = artikel ? ansichtVon(artikel.id) : '';
  job.mockups = {};
  const alleTeile = produkte.enabledFor(motto.slug).filter(g => !!GARMENTS[g]);
  // 20. Sept. (Markus: "Die weiterfuehrenden Artikel klappen leider auch nicht"): Acrylbild und
  // Tuerschild standen in der Reihe, hatten aber keine Vorlage - zwei leere Bilder. Angeboten
  // wird nur, was daliegt (angebotReihe in mockups.js, Regeln zu Motivart und Groesse dort).
  const bereit = new Set();
  for (const g of alleTeile) if ((await templateReady(g, 'white')) && (await templateReady(g, 'black'))) bereit.add(g);
  const fehlen = alleTeile.filter(g => !bereit.has(g));
  if (fehlen.length) console.warn('Angebot ohne Vorlage, nicht gezeigt:', fehlen.join(', '), '·', job.jobId);
  const reihe = angebotReihe({ teile: alleTeile, artikel: artikel ? { motivart: artikel.motivart, netto: artikel.netto } : null, eigeneAnsicht, bereit });
  for (const g of reihe) {
    // 23:52, Markus: "so sieht das T-Shirt in Benutzung aus ... Druck sitzt auf dem echten Textil
    // aehnlich - total Banane." Die Seite bekommt je Teil das Wort fuer die Situation ("getragen",
    // "an der Wand") und den Weg zu einem eigenen Design fuer genau dieses Teil.
    const artikelIdFuer = (Object.entries(ARTIKEL_ANSICHT).find(([, an]) => an === g) || [])[0] || (ARTIKEL[g] ? g : '');
    job.mockups[g] = { label: GARMENTS[g].label, view: GARMENTS[g].view, sizes: GARMENTS[g].sizes !== false, bestellt: g === eigeneAnsicht,
      szeneText: (SZENEN_LABELS[g] || (GARMENTS[g].szene && GARMENTS[g].szene.label) || 'in Benutzung').toLowerCase(),
      eigenesDesign: artikelIdFuer && verkaufsfaehig(artikelIdFuer) ? `/m/freestyle?artikel=${encodeURIComponent(artikelIdFuer)}` : '' };
    for (const c of COLORS) job.mockups[g][c] = `${env.PUBLIC_BASE_URL}/api/mo/mockup/${designId}/${g}/${c}.jpg?exp=${exp}&sig=${sig}`;
    // 4. Okt., Markus: "Natuerlich sollen die auch bestellbar sein" - die Farben aus dem Band (TEXTIL_FARBEN) stehen
    // bei T-Shirt und Polo neben Schwarz und Weiss, aber nur die, auf denen DIESES Motiv gut zu sehen ist (farbWerte/
    // besteFarbe wie im Band, gemessen an der Druckdatei) und nur, wo sich die Vorlage sauber einfaerben laesst.
    if (FARB_TEILE.includes(g)) {
      const farben = await bestellFarben(designId, g);
      if (farben.length) {
        job.mockups[g].farben = farben.map(k => ({ key: k, name: TEXTIL_FARBEN[k].label, bc: TEXTIL_FARBEN[k].name[g], hex: TEXTIL_FARBEN[k].hex, hell: TEXTIL_FARBEN[k].hell }));
        for (const k of farben) job.mockups[g]['f-' + k] = `${env.PUBLIC_BASE_URL}/api/mo/mockup/${designId}/${g}/white.jpg?exp=${exp}&sig=${sig}&farbe=${k}`;
      }
    }
    // Fassung 90, Markus: "Wenn der Kunde ein Poster erstellt hat, dann muss sein Motiv auf der
    // Wand im Wohnzimmer genauso haengen - bei allen anderen Artikeln auch." Die Route kann das
    // seit Fassung 86 (?szene=1), aber die Kundenseite hat es nie angefordert. Jetzt bekommt jedes
    // Teil, fuer das eine Situation als Vorlage daliegt, zusaetzlich die Adresse dieser Ansicht -
    // je Farbe, denn die Vorlage gibt es je Farbe. Fehlt sie, fehlt der Eintrag, und die Seite
    // zeigt wie bisher die sachliche Ansicht. Nichts wird versprochen, was nicht daliegt.
    const querMotiv = !!(artikel && Array.isArray(artikel.netto) && artikel.netto[0] > artikel.netto[1] * 1.15);
    for (const c of COLORS) {
      if (!(await szeneMoeglich(g, c, querMotiv))) continue;
      job.mockups[g].szene = job.mockups[g].szene || {};
      job.mockups[g].szene[c] = `${env.PUBLIC_BASE_URL}/api/mo/mockup/${designId}/${g}/${c}.jpg?exp=${exp}&sig=${sig}&szene=1`;
    }
    // 7. Okt., Markus: "Warum bei Orange kein Model?" - die Farben bekommen das Getragen-Bild, wo sich die Szene sauber
    // einfaerben laesst (dieselbe Szene in Weiss und Schwarz = Faerbemaske, wie im Schaufenster).
    if (job.mockups[g].farben && job.mockups[g].farben.length) {
      const jf = { motto: (motto && motto.slug) || motto, values };
      const th = await szeneThemaFuer(g, 'white', await szeneMottoFuerA(jf, designId), await werFuerMockup(jf, g, 'white'));
      // Szene nach Begriff: wird gerade erst nachgeschlagen und fotografiert (szeneMottoFuerA stoesst es an) - die Adressen
      // stehen schon da; bis das Foto liegt, zeigt die Route das gefaerbte Shirt.
      if ((th && await faerbMaske(path.join(STORE, 'templates'), g + '-szene-thema-' + th)) || BEGRIFF_MOTTOS.has(String(jf.motto || ''))) {
        job.mockups[g].szene = job.mockups[g].szene || {};
        for (const f of job.mockups[g].farben) job.mockups[g].szene['f-' + f.key] = `${env.PUBLIC_BASE_URL}/api/mo/mockup/${designId}/${g}/white.jpg?exp=${exp}&sig=${sig}&szene=1&farbe=${f.key}`;
      }
    }
  }
  job.status = 'done';

  // Community-Bewertung: unbedenkliche Designs kommen automatisch in den Pool, damit beim Warten
  // immer genug zum Bewerten da ist. Alles andere (Firmenlogo, hochgeladenes Foto, Namensliste)
  // bleibt draussen - der Kunde kann es auf der Ergebnisseite selbst freigeben.
  // firmaDesAuftrags steht weiter oben, vor auftragSichern - sonst wirft die erste Sicherung.
  // Ein Kundenfoto zaehlt wie ein Upload: nie automatisch in den oeffentlichen Pool.
  const sperrgrund = bewertungSperrgrund({ motto, uploadFile: uploadFile || (foto ? 'kundenfoto' : null), uploadFile2, personal, back: job.back, firma: firmaDesAuftrags });
  job.bewertungSperre = sperrgrund;
  try {
    // Freigabepflichtige Designs (Fanclub) kommen erst nach der Freigabe in den Pool (siehe /api/mo/approval/set)
    // job.test: ein Pruefstand-Durchlauf darf das Schaufenster nicht fuellen - 40 Testdesigns
    // im Bewertungs-Pool waeren genau der Unsinn, den man hinterher einzeln wieder rauswirft.
    if (String(env.MO_AUTO_SHOWCASE || 'on') !== 'off' && !job.test && !sperrgrund && !needsApproval(motto)) {
      const sc = await loadShowcase();
      if (!sc[designId]) {
        sc[designId] = {
          approved: true, count: 0, sum: 0, motto: motto.slug,
          mottoText: mottoTextAus(values, motto),
          textile, created: job.created || new Date().toISOString(), auto: true, style: style || 'standard'
        };
        await saveShowcase();
      }
    }
  } catch (e) { /* Bewertungs-Pool ist optional */ }

  // Design dem Kunden bzw. Gast zuordnen und Verbrauch buchen
  try {
    if (job.who && job.who.userId) {
      const u = await accounts.byId(job.who.userId);
      if (u) await accounts.save(bookDesign(u, job.who.via, designId));
    } else if (job.who && job.who.guestId) {
      await accounts.guestAddDesign(job.who.guestId, designId);
    }
  } catch (e) { console.error('Buchung fehlgeschlagen:', e && e.message ? e.message : e); }

  setTimeout(() => pushToDrive(designId).catch(e => console.error('Drive:', e && e.message ? e.message : e)), 1500);

  await auftragSichern(sperrgrund);

  // Freigabepflichtige Mottos (Fanclub): Design ist erstellt, aber Druck erst nach Nachweis/Freigabe.
  if (needsApproval(motto)) {
    try {
      const ap = await loadApprovals();
      if (!ap[designId]) { ap[designId] = { motto: motto.slug, status: 'pending', fanclub: (values.fanclub || '').toString(), proof: null, at: new Date().toISOString() }; await saveApprovals(); }
    } catch (e) { console.error('Freigabe anlegen:', e && e.message ? e.message : e); }
  }
}

// ---------- App ----------
const app = express();
// 1. Okt., Markus: Abstimmen ergibt nur Sinn, wo eine Gruppe bestellt (Firmenausflug, Malle, Kegeln) -
// nicht beim Shirt fuer Opa oder beim Geburtstag. Die Liste steht in gruppen-mottos.json.
let GRUPPEN_MOTTOS = new Set();
try { GRUPPEN_MOTTOS = new Set(JSON.parse(fsSync.readFileSync(path.resolve('gruppen-mottos.json'), 'utf8')).gruppe || []); }
catch (e) { console.error('gruppen-mottos.json nicht lesbar - keine Abstimmung bei irgendeinem Motto:', e && e.message ? e.message : e); }
const istGruppenMotto = (slug) => GRUPPEN_MOTTOS.has(String(slug || ''));
app.set('trust proxy', true);

// ---------- Kein Auftrag bleibt offen liegen ----------
// 25. Sept., Markus: "Gehe ab und zu mal durch den kompletten Code und pruefe auf Fehler und
// Stabilitaet." Beim ersten Durchgang gefunden, und es ist der teuerste Fund des Tages:
//
// Express 4 leitet eine abgelehnte Zusage aus einem async-Handler NICHT an eine Fehlerbehandlung
// weiter - die Anfrage bleibt einfach offen. Nachgemessen mit einem Miniserver auf genau dieser
// Express-Fassung (4.22.2): nach drei Sekunden immer noch keine Antwort, nur eine Zeile im Log.
// Fuer den Kunden heisst das nicht "Fehler", sondern ein Rad, das sich dreht, bis er aufgibt.
// Gezaehlt: 39 Routen ohne eigenen try-Block, darunter Anmeldung, Firmendaten und Bestellliste.
//
// Statt 39 try-Bloecke nachzutragen - und beim naechsten Mal einen zu vergessen - haengt der
// Schutz hier, an der Stelle, an der eine Route ueberhaupt entsteht. Jede kuenftige Route ist
// damit automatisch mit abgesichert, ohne dass jemand daran denken muss.
//
// Was dabei NICHT passiert: der Fehler wird nicht verschluckt. Er steht weiter im Log, mit
// Methode und Pfad davor - beim stillen Durchwinken haette man spaeter nichts mehr in der Hand.
// Und wenn der Handler schon etwas gesendet hat, bevor er stolperte, wird nichts nachgeschoben.
{
  const fehlerAntwort = (e, req, res) => {
    console.error('Route', req.method, req.originalUrl, 'ist gestolpert:', e && e.stack ? e.stack : e);
    if (res.headersSent) return;
    res.status(500).json({ error: 'serverfehler', hinweis: 'Da ist bei uns etwas schiefgegangen. Bitte noch einmal versuchen.' });
  };
  for (const methode of ['get', 'post', 'put', 'delete']) {
    const original = app[methode].bind(app);
    app[methode] = (pfad, ...handler) => original(pfad, ...handler.map(h =>
      // Vier Parameter heisst Fehlerbehandlung - die bleibt unangetastet.
      (typeof h === 'function' && h.length < 4)
        ? function (req, res, next) {
            let ergebnis;
            try { ergebnis = h.call(this, req, res, next); }
            catch (e) { return fehlerAntwort(e, req, res); }
            return (ergebnis && typeof ergebnis.then === 'function')
              ? ergebnis.catch(e => fehlerAntwort(e, req, res))
              : ergebnis;
          }
        : h));
  }
}

// ---------- Textantworten gepackt ausliefern ----------
// Fassung 77, aus der Ladezeit-Messung: Die Startseite waren 84 kB HTML, roh durch die
// Leitung. Gepackt sind es 25 kB - es gingen also bei jedem Aufruf knapp 60 kB umsonst
// raus, auf dem Handy die Haelfte der ganzen Seite. Bilder, PDFs und Zip-Dateien sind
// schon gepackt und werden nicht angefasst; alles unter 1 kB auch nicht, da kostet das
// Packen mehr als es bringt.
// Absichtlich eine eigene kleine Schicht statt eines neuen Pakets: sie haengt sich nur an
// res.send, arbeitet nebenlaeufig (zlib mit Rueckruf, nichts blockiert den Hauptfaden) und
// faellt bei jedem Fehler auf "ungepackt" zurueck - lieber langsam als kaputt.
// Fassung 77b, nach Markus' Rueckmeldung "warum dauert das jetzt so lange": Gepackt wird mit
// gzip Stufe 6, NICHT mit Brotli. Brotli holt bei HTML nur wenige Prozent mehr heraus, braucht
// dafuer aber ein Mehrfaches an Rechenzeit - und die geht direkt auf die Zeit bis zum ersten
// Byte. Auf einem grossen Server merkt man das nicht, auf einem kleinen Container schon, und
// die Zeit bis zum ersten Byte ist genau das, was Google misst. Stark gepackt wird nur, was
// einmal gepackt und dann behalten wird (siehe festGepackt()).
// Obergrenze: ueber 1,5 MB wird nicht gepackt. So gross ist hier nur JSON mit einem Bild
// darin - das ist schon gepackt, laesst sich also kaum kleiner machen, wuerde aber lange
// rechnen.
const PACKBAR = /^(?:text\/|application\/(?:json|javascript|xml|manifest|rss|atom)|image\/svg)/i;
const PACK_MAX = 1500 * 1024;
app.use((req, res, next) => {
  const send = res.send.bind(res);
  res.send = function (body) {
    try {
      const roh = Buffer.isBuffer(body) ? body
        : (typeof body === 'string' ? Buffer.from(body, 'utf8') : null);
      const typ = String(res.get('Content-Type') || '');
      if (roh && roh.length >= 1024 && roh.length <= PACK_MAX
          && PACKBAR.test(typ) && !res.get('Content-Encoding')
          && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
        res.vary('Accept-Encoding');   // anhaengen, nicht ersetzen - CORS setzt hier "Origin"
        zlib.gzip(roh, { level: 6 }, (err, klein) => {
          if (err || !klein || klein.length >= roh.length) return send(body);
          res.set('Content-Encoding', 'gzip');
          res.removeHeader('Content-Length');
          send(klein);
        });
        return res;
      }
    } catch (e) { /* ungepackt weiter */ }
    return send(body);
  };
  next();
});

const ALLOWED = String(env.CORS_ORIGINS).split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && ALLOWED.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Stripe-Webhook braucht den rohen Body (Signatur) - deshalb vor dem JSON-Parser
app.post('/api/mo/stripe/webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (!stripeCfg || !env.STRIPE_SECRET_KEY) return res.status(503).end();
  const event = verifyWebhook(req.body.toString('utf8'), req.headers['stripe-signature'], stripeCfg.webhookSecret);
  if (!event) return res.status(400).json({ error: 'signatur' });
  try { await applyEvent(event, accounts, env.STRIPE_SECRET_KEY); res.json({ received: true }); }
  catch (e) { console.error('Webhook:', e && e.message ? e.message : e); res.status(500).json({ error: 'verarbeitung' }); }
});

app.use('/api/mo/upload', express.json({ limit: '9mb' }));
// Kundenfotos (Fassung 25/26): Originalaufloesung, bis FOTO_MAX_MB - als JSON-Puffer nur im RAM
app.use('/api/mo/foto', express.json({ limit: Math.round(FOTO_MAX_MB * 1.4 + 1) + 'mb' }));
app.use('/api/admin/marken/bildpruefen', express.json({ limit: '9mb' }));
app.use('/api/partner', express.json({ limit: '9mb' }));   // 2. Okt.: Partner-Logo (Anmeldung, Partnerbereich)
// Shopify-Webhook braucht den Roh-Body fuer die HMAC-Pruefung (vor dem globalen JSON-Parser).
app.use('/api/mo/shopify/webhook', express.json({ limit: '2mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.json({ limit: '256kb' }));

// ---------- Wer ist da? Gast-Cookie setzen, Sitzung lesen ----------
async function identify(req, res) {
  const c = readCookies(req);
  let guestId = /^g_[a-f0-9]{16}$/.test(c.mo_guest || '') ? c.mo_guest : null;
  if (!guestId) {
    guestId = 'g_' + crypto.randomBytes(8).toString('hex');
    if (res) setCookie(res, 'mo_guest', guestId, 365 * 86400, SECURE);
  }
  const userId = accounts.sessionUserId(c.mo_session);
  const user = userId ? await accounts.byId(userId) : null;
  const guest = user ? null : await accounts.guestGet(guestId);
  return { user, guestId, guest };
}

// ---------- Konto: Anmelde-Link, Sitzung, Kontostand ----------
app.post('/api/mo/login', async (req, res) => {
  const email = normEmail((req.body || {}).email);
  if (!email) return res.status(400).json({ error: 'email ungueltig' });
  const next = String((req.body || {}).next || '/konto');
  // Ein Zusatz in der Adresse mit ungewohnten Zeichen kostet nur den Zusatz, nicht die Seite.
  const pfad = next.split('?')[0];
  let safeNext = /^\/[a-z0-9\-\/_?=&]*$/i.test(next) ? next : (/^\/[a-z0-9\-\/_]*$/i.test(pfad) ? pfad : '/konto');
  try {
    // 4. Okt., Markus: "dass die Leute ... sich den Link zuschicken lassen und mit dem Link dann auch wieder
    // sofort auf die gleiche Stelle zurueckkommen und da weitermachen". Der Zwischenstand lag nur im Speicher
    // DIESES Browsers - die Mail-App oeffnet den Link oft in einem anderen (nachgestellt: 2 von 11 Eingaben
    // kamen an). Jetzt liegt er hier, und der Link traegt seine Nummer (?weiter=...).
    // Auch ohne Zwischenstand ("Design sichern" nach dem fertigen Design) merkt sich der Eintrag den Gast
    // DIESES Browsers - so landen seine Designs im Konto, egal in welchem Browser der Link aufgeht.
    const w = (req.body || {}).weiter && typeof (req.body || {}).weiter === 'object' ? req.body.weiter : null;
    if (/^\/m\//.test(safeNext)) {
      const roh = JSON.stringify(w);
      if (roh.length <= 60000) {
        const id = crypto.randomBytes(12).toString('hex');
        const who = await identify(req, res);
        await weiterAufraeumen();
        await fs.mkdir(WEITER_DIR, { recursive: true });
        await fs.writeFile(path.join(WEITER_DIR, id + '.json'), JSON.stringify({ email, guestId: who.guestId || '', at: Date.now(), daten: w }));
        safeNext = safeNext.replace(/([?&])weiter=[^&]*&?/, '$1').replace(/[?&]$/, '');
        safeNext += (safeNext.includes('?') ? '&' : '?') + 'weiter=' + id;
        console.log('Anmelden: Zwischenstand ' + id + ' fuer ' + ((w && w.slug) || 'ohne Eingaben') + ' gemerkt (' + roh.length + ' Zeichen)');
      }
    }
    const token = await accounts.createLogin(email, safeNext);
    const link = `${env.PUBLIC_BASE_URL}/login?t=${token}`;
    let r;
    try {
      r = await sendLoginMail({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: email, link, base: env.PUBLIC_BASE_URL });
      await logMail({ to: email, subject: 'Anmelde-Link', ok: !!r.sent, messageId: r.messageId || null, logged: !!r.logged });
    } catch (e) {
      await logMail({ to: email, subject: 'Anmelde-Link', ok: false, error: String((e && e.message) || e).slice(0, 300) });
      throw e;
    }
    res.json({ ok: true, sent: !!r.sent });
  } catch (e) {
    console.error('Login-Mail:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'mail' });
  }
});

app.get('/login', async (req, res) => {
  const l = await accounts.consumeLogin(req.query.t);
  if (!l) return res.status(400).send('<meta charset="utf-8"><p style="font-family:sans-serif;padding:30px">Der Anmelde-Link ist abgelaufen oder wurde schon benutzt. Bitte auf der Seite einen neuen anfordern.</p>');
  const who = await identify(req, res);
  let user = await accounts.getOrCreate(l.email);
  user.lastLogin = new Date().toISOString();
  user = await accounts.adoptGuest(user, who.guestId);
  await accounts.save(user);
  setCookie(res, 'mo_session', accounts.sessionValue(user.id), 180 * 86400, SECURE);
  res.redirect(l.next || '/konto');
});

// Zwischenstand vor dem Anmelden (siehe /api/mo/login): nur fuer genau die angemeldete Adresse, einmal,
// hoechstens 24 Stunden. Das Foto der Sitzung und die Designs des Gastes gehen dabei an das Konto ueber -
// auch wenn der Link in einem anderen Browser aufging als dem, in dem der Kunde angefangen hat.
const WEITER_DIR = path.join(STORE, 'weiter');
const WEITER_MS = 24 * 3600e3;
async function weiterAufraeumen() {
  for (const f of await fs.readdir(WEITER_DIR).catch(() => [])) {
    try { const st = await fs.stat(path.join(WEITER_DIR, f)); if (Date.now() - st.mtimeMs > WEITER_MS) await fs.rm(path.join(WEITER_DIR, f), { force: true }); }
    catch (e) { console.error('Zwischenstand aufraeumen ' + f + ':', e && e.message ? e.message : e); }
  }
}
app.get('/api/mo/weiter/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const id = String(req.params.id || '');
  if (!/^[a-f0-9]{24}$/.test(id)) return res.status(404).json({ error: 'unbekannt' });
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'anmelden' });
  const f = path.join(WEITER_DIR, id + '.json');
  let w = null;
  try { w = JSON.parse(await fs.readFile(f, 'utf8')); } catch (e) { return res.status(404).json({ error: 'unbekannt' }); }
  if (!w || Date.now() - (w.at || 0) > WEITER_MS) { await fs.rm(f, { force: true }); return res.status(404).json({ error: 'abgelaufen' }); }
  if (normEmail(w.email) !== normEmail(who.user.email)) { console.error('Zwischenstand ' + id + ': andere Adresse angemeldet'); return res.status(403).json({ error: 'andere adresse' }); }
  const sid = String((w.daten && w.daten.fotoSitzung) || '').replace(/[^a-z0-9_]/g, '');
  if (sid && w.guestId && FOTO_BESITZ.get(sid) === 'g:' + w.guestId) FOTO_BESITZ.set(sid, whoKey(who));
  if (w.guestId && w.guestId !== who.guestId) { try { await accounts.adoptGuest(who.user, w.guestId); } catch (e) { console.error('Zwischenstand ' + id + ': Gast uebernehmen:', e && e.message ? e.message : e); } }
  await fs.rm(f, { force: true });
  console.log('Anmelden: Zwischenstand ' + id + ' zurueckgegeben (' + ((w.daten && w.daten.slug) || '?') + (sid ? ', mit Foto' : '') + ')');
  res.json(w.daten || {});
});

app.post('/api/mo/logout', (req, res) => { setCookie(res, 'mo_session', '', 0, SECURE); res.json({ ok: true }); });

app.get('/api/mo/me', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.json({ user: null, gast: { designs: who.guest.designs.length, frei: GUEST_FREE }, accounts: ACCOUNTS_ON, stripe: !!stripeCfg });
  const view = accountView(who.user);
  const exp = Date.now() + 14 * 86400e3;
  view.items = await Promise.all(view.designs.map(async id => {
    const sig = signPreview(id, exp, SIGN_SECRET);
    let artikel = null, farbe = 'black', teil = 'tee';
    // Die Design-Datei (storage/jobs/<designId>.json) traegt den Artikel OBEN (artikel), nicht
    // unter input wie der laufende Auftrag.
    // 6. Okt., Markus (Konto, Tier-Shirt fuer hell gestaltet, gezeigt auf Schwarz): "Die Ansichten ... muessen natuerlich genau
    // das sein, was der Kunde ausgewaehlt hat." Farbe und Teil kommen aus dem Auftrag, nicht fest Schwarz und T-Shirt.
    try {
      const jk = await readJob(id); const a = jk && (jk.artikel || (jk.input && jk.input.artikel)); artikel = a ? { id: a.id, name: a.name, label: a.label || '' } : null;
      if (jk) farbe = istHell(jk.textile || (jk.input && jk.input.textile)) ? 'white' : 'black';
      let g = ''; try { g = a && a.id ? (ansichtVon(a.id) || '') : ''; } catch (e2) { g = ''; }
      if (['tee', 'hoodie', 'zip', 'polo'].includes(g)) teil = g;
    } catch (e) { /* ohne Auftrag: Textil wie bisher */ }
    const preview = `/api/mo/preview/${id}.png?exp=${exp}&sig=${sig}`;
    return {
      designId: id, artikel, farbe, teil,
      preview,
      mockup: `/api/mo/mockup/${id}/${teil}/${farbe}.jpg?exp=${exp}&sig=${sig}`,
      hoodie: `/api/mo/mockup/${id}/hoodie/${farbe}.jpg?exp=${exp}&sig=${sig}`,
      zip: `/api/mo/mockup/${id}/zip/${farbe}.jpg?exp=${exp}&sig=${sig}`
    };
  }));
  res.json({ user: view, accounts: ACCOUNTS_ON, stripe: !!stripeCfg });
});

// ---------- Bezahlen ----------
app.post('/api/mo/checkout', async (req, res) => {
  if (!stripeCfg || !env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'bezahlung nicht eingerichtet' });
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'anmelden' });
  const kind = String((req.body || {}).kind || '');
  if (!['single', 'm100', 'm400'].includes(kind)) return res.status(400).json({ error: 'angebot ungueltig' });
  try {
    const url = await createCheckout({ secretKey: env.STRIPE_SECRET_KEY, cfg: stripeCfg, user: who.user, kind, quantity: (req.body || {}).quantity, baseUrl: env.PUBLIC_BASE_URL });
    res.json({ url });
  } catch (e) { console.error('Checkout:', e && e.message ? e.message : e); res.status(500).json({ error: 'checkout' }); }
});
app.post('/api/mo/portal', async (req, res) => {
  if (!stripeCfg) return res.status(503).json({ error: 'bezahlung nicht eingerichtet' });
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'anmelden' });
  try { res.json({ url: await createPortal({ secretKey: env.STRIPE_SECRET_KEY, user: who.user, baseUrl: env.PUBLIC_BASE_URL }) }); }
  catch (e) { res.status(500).json({ error: 'portal' }); }
});

app.get('/konto', (req, res) => res.sendFile(path.resolve('konto.html')));
// 1. Okt.: Die Vorschau der neuen Startseite ist seit "uebernehmen" die Startseite selbst. Wer
// noch die alte Adresse hat, landet dort.
app.get('/vorschau-start', (req, res) => res.redirect(301, '/'));

// 4. Okt.: die Bildchen des Laufbands unter dem Kopf (startseite/laufband/<artikel>.webp, 160 x 200).
app.get('/startseite/laufband/:datei', (req, res) => {
  const datei = String(req.params.datei).replace(/[^a-z0-9-]/g, '').replace(/webp$/, '') + '.webp';
  res.set('cache-control', 'public, max-age=86400');
  res.sendFile(path.resolve('startseite', 'laufband', datei), (err) => { if (err && !res.headersSent) { console.error('Startseite, Laufband', datei, err.message); res.status(404).end(); } });
});

// 8. Okt.: die Artikel-Kacheln des Otto-Wegs (startseite/artikel/<artikel>.webp, 640 x 480, echte Produktfotos).
app.get('/startseite/artikel/:datei', (req, res) => {
  const datei = String(req.params.datei).replace(/[^a-z0-9-]/g, '').replace(/webp$/, '') + '.webp';
  res.set('cache-control', 'public, max-age=86400');
  res.sendFile(path.resolve('startseite', 'artikel', datei), (err) => { if (err && !res.headersSent) { console.error('Otto-Weg, Artikelbild', datei, err.message); res.status(404).end(); } });
});

// ---------- Firmenbereich (B2B) ----------
// Eigener Eingang, bewusst OHNE den Rest der Seite: keine Anlass-Kacheln, keine
// Abstimmung, keine Sternebewertung. Wer Arbeitskleidung fuer seinen Betrieb braucht,
// will sein Logo, seine Leute und seine letzten Auftraege sehen - sonst nichts.
// Die Anmeldung ist dieselbe wie sonst (Link per Mail), nur das Ziel ist /firma.
app.get('/firma', (req, res) => res.sendFile(path.resolve('firma.html')));

const firmaSauber = (f) => ({
  name: String(f.name || '').trim().slice(0, 120),
  strasse: String(f.strasse || '').trim().slice(0, 120),
  plz: String(f.plz || '').trim().slice(0, 12),
  ort: String(f.ort || '').trim().slice(0, 80),
  land: String(f.land || 'Deutschland').trim().slice(0, 60),
  ustId: String(f.ustId || '').trim().slice(0, 20).toUpperCase(),
  ansprech: String(f.ansprech || '').trim().slice(0, 80),
  telefon: String(f.telefon || '').trim().slice(0, 40),
  // Gewerk/Branche: damit die Design-Seite (Handwerker-Shirt) vorbelegt aufgeht statt leer
  gewerk: String(f.gewerk || '').trim().slice(0, 60),
  // 24. Sept., Markus: "Bei der Anmeldung machst du ein Haeckchen zum Auswaehlen, dass das
  // Firmenkunden sein muessen, so dass es rechtlich sauber ist."
  // Nachgeschlagen (IT-Recht Kanzlei): Nettopreise sind nur gegenueber Unternehmern erlaubt.
  // Ein blosser Hinweis "Verkauf nur an Gewerbetreibende" reicht ausdruecklich NICHT - es
  // braucht eine echte Erklaerung des Kunden. Genau die ist dieses Haeckchen.
  // Nur der Wahrheitswert kommt vom Browser; WANN bestaetigt wurde, setzt der Server (siehe
  // PUT /api/mo/firma) - ein Datum aus dem Formular waere kein Nachweis, sondern eine Behauptung.
  unternehmer: f.unternehmer === true || f.unternehmer === 'ja'
});

// Alles, was der Arbeitsplatz braucht, in EINER Antwort - der Bereich soll nach dem
// Anmelden sofort stehen und nicht in fuenf Nachladungen aufblinken.
app.get('/api/mo/firma', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.json({ angemeldet: false });
  const u = who.user;
  // Nur die gewerblichen Mottos - der Rest gehoert nicht in diesen Bereich.
  const alle = await mottos.all();
  // EIN Schalter entscheidet, was hier steht: "gewerblich" im Backend. Der erste Versuch
  // nahm auch alles mit Logo-Upload - dann standen Malle-Fahrt und Fanclub im Firmenbereich.
  // Ein Handwerksmeister soll hier genau das sehen, was fuer seinen Betrieb gedacht ist.
  const fuerFirmen = alle.filter(m => m.active !== false && m.gewerblich)
    .map(m => ({ slug: m.slug, name: m.name, kurz: m.short || m.tagline || '', logo: !!(m.upload && m.upload.mode === 'exact') }));
  res.json({
    angemeldet: true, email: u.email,
    // 7. Okt., Markus: "netto Preise duerfen nur bei eingeloggten Firmen angezeigt werden!!!!" - angemeldet allein
    // reicht nicht (jedes Privatkonto ist angemeldet); netto nur mit Firmendaten und Unternehmer-Erklaerung.
    netto: !!(u.firma && u.firma.name && u.firma.unternehmer && u.firma.unternehmerSeit),
    firma: u.firma || null,
    firmaLogo: u.firmaLogo || null,
    listen: u.listen || [],
    designs: (u.designs || []).slice(-40).reverse().map(id => {
      const exp = Date.now() + 14 * 86400e3;
      return { designId: id, bild: `/api/mo/preview/${id}.png?exp=${exp}&sig=${signPreview(id, exp, SIGN_SECRET)}` };
    }),
    mottos: fuerFirmen,
    konto: accountView(u)
  });
});

app.put('/api/mo/firma', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'nicht angemeldet' });
  const f = firmaSauber(req.body || {});
  if (!f.name) return res.status(400).json({ error: 'Firmenname fehlt' });
  // Ein Firmenname ist ein Text, der spaeter auf Textilien landet - dieselbe Sperre wie ueberall.
  const hit = verboten.pruefeText(f.name + ' ' + f.ansprech);
  if (hit) { await verbotenMerken({ quelle: 'eingabe', wort: hit.wort, eingabe: f.name, motto: 'firma', req }); return res.status(400).json({ error: 'verboten', wort: hit.wort }); }
  // Die Unternehmer-Erklaerung ist ein Nachweis, kein Formularfeld: WANN sie abgegeben wurde,
  // setzt der Server, und ein einmal gesetztes Datum bleibt stehen, auch wenn die Firma spaeter
  // ihre Telefonnummer aendert. Nimmt der Kunde das Haeckchen wieder heraus, faellt die
  // Erklaerung weg - und damit sofort auch der Blick auf die Nettopreise.
  const vorher = who.user.firma && who.user.firma.unternehmerSeit;
  who.user.firma = { ...f, unternehmerSeit: f.unternehmer ? (vorher || new Date().toISOString()) : null };
  await accounts.save(who.user);
  res.json({ ok: true, firma: who.user.firma });
});

// Das Logo wird ueber den normalen Upload-Weg hochgeladen (mit allen Pruefungen:
// Marken, verbotene Zeichen, Groesse). Hier wird nur vermerkt, welches das Firmenlogo ist.
app.post('/api/mo/firma/logo', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'nicht angemeldet' });
  const id = String((req.body || {}).uploadFile || '').replace(/[^A-Za-z0-9_.-]/g, '');
  if (id) {
    try { await fs.access(path.join(STORE, 'uploads', id)); }
    catch (e) { return res.status(400).json({ error: 'unbekanntes Bild' }); }
  }
  who.user.firmaLogo = id || null;
  await accounts.save(who.user);
  res.json({ ok: true, firmaLogo: who.user.firmaLogo });
});

// Mitarbeiterlisten: speichern, aendern, loeschen. Dieselbe Zerlegung wie bei der
// Kaderliste (parsePeople), damit "Name; Groesse; Artikel" ueberall gleich gelesen wird.
app.post('/api/mo/firma/liste', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'nicht angemeldet' });
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 60) || 'Liste';
  const pp = parsePeople(b.leute, 24);
  const hit = verboten.pruefeTexte(pp.names);
  if (hit) { await verbotenMerken({ quelle: 'namensliste', wort: hit.wort, eingabe: hit.eingabe, motto: 'firma', req }); return res.status(400).json({ error: 'verboten', wort: hit.wort }); }
  who.user.listen = who.user.listen || [];
  const id = String(b.id || '').replace(/[^a-z0-9_]/gi, '') || 'l_' + crypto.randomBytes(5).toString('hex');
  const eintrag = { id, name, leute: pp.people, geaendert: new Date().toISOString() };
  const i = who.user.listen.findIndex(x => x.id === id);
  if (i >= 0) who.user.listen[i] = eintrag; else who.user.listen.push(eintrag);
  // Nicht unbegrenzt: 50 Listen sind mehr, als ein Betrieb je braucht.
  if (who.user.listen.length > 50) who.user.listen = who.user.listen.slice(-50);
  await accounts.save(who.user);
  res.json({ ok: true, liste: eintrag, bereinigt: pp.changed });
});

// Das hinterlegte Logo anzeigen. Bewusst nur fuer den Besitzer: ein Firmenlogo ist
// Eigentum des Kunden und hat in keiner fremden Anfrage etwas zu suchen. Darum wird
// nicht die Bild-ID geprueft, sondern ob sie AM KONTO des Anfragenden steht.
app.get('/api/mo/firma/logo.png', async (req, res) => {
  const who = await identify(req, res);
  const id = who.user && who.user.firmaLogo;
  if (!id) return res.status(404).end();
  try {
    const buf = await fs.readFile(path.join(STORE, 'uploads', id));
    res.type('png').set('cache-control', 'private, max-age=600').send(buf);
  } catch (e) { res.status(404).end(); }
});

// ---- Produktuebersicht fuer Firmenkunden ------------------------------------------------
// Der Endkunden-Weg (Motto waehlen, Namen eintragen, Kaderliste, Aufteilung) ist fuer einen
// Betrieb zu viel. Ein Handwerksmeister will genau eins wissen: wie sieht MEIN Logo auf den
// Teilen aus und was kann ich bestellen. Also: Logo hoch, Platz waehlen, fertig - die
// Uebersicht baut sich von allein.
const FIRMA_PLAETZE = { brust: 'chest', ruecken: 'back' };
const FARBEN = {
  black: { name: 'Schwarz', hex: '#111111' },
  white: { name: 'Weiß', hex: '#ffffff' }
};

app.get('/api/mo/firma/produkte', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'nicht angemeldet' });
  // 24. Sept., Markus: "Nimm bitte die Preise runter im Firmenbereich und sag, dass die Preise
  // erst nach Anmeldung sichtbar werden. Und bei der Anmeldung machst du ein Haeckchen ... dass
  // das Firmenkunden sein muessen, so dass es rechtlich sauber ist."
  // Nachgeschlagen: Nettopreise duerfen NUR Unternehmern gezeigt werden, und ein Hinweis auf der
  // Seite genuegt dafuer ausdruecklich nicht. Angemeldet sein reicht also nicht - erst die
  // Erklaerung des Kunden macht ihn zum Unternehmer. Ohne sie geht hier keine einzige Zahl raus;
  // sie wird nicht ausgeblendet, sie wird gar nicht erst geschickt. Was nicht im Browser
  // ankommt, kann auch niemand aufklappen.
  const darfPreise = !!(who.user.firma && who.user.firma.unternehmer && who.user.firma.unternehmerSeit);
  // zip steht im Kiez-Sortiment und hat eine Vorlage - also mit anbieten.
  const schluessel = FIRMEN_TEXTILIEN.concat(FIRMEN_TEXTILIEN.includes('zip') ? [] : ['zip']);
  const teile = [];
  for (const key of schluessel) {
    const t = TEXTILIEN[key] || {};
    const g = GARMENTS[key];
    const farben = [];
    if (g) for (const c of COLORS) {
      if (await templateReady(key, c)) farben.push({ key: c, name: (FARBEN[c] || {}).name || c, hex: (FARBEN[c] || {}).hex || '#888888' });
    }
    teile.push({
      key, label: t.label || (g && g.label) || key,
      marke: t.marke || null, modell: t.modell || null,
      material: t.material || null, gramm: t.gramm || null,
      schnitt: t.schnitt || null, details: t.details || null,
      // Auch der Bruttopreis bleibt drinnen, solange die Erklaerung fehlt - sonst stuende die
      // Zahl im Browser und waere mit einem Handgriff sichtbar zu machen.
      preis: (!darfPreise || t.preis == null) ? null : t.preis,
      // Ob es UEBERHAUPT einen Preis gibt, darf die Seite wissen: sie muss "Preis folgt" von
      // "Preis erst nach der Bestaetigung" unterscheiden koennen.
      preisDa: t.preis != null,
      // 24. Sept., Markus: "Und denk dran, wenn Firmen, wenn die Preise netto angezeigt
      // exklusive Mehrwertsteuer."
      // Der Firmenbereich zeigt ab jetzt den NETTOPREIS. Gerechnet wird weiter mit dem
      // Bruttopreis aus dem Katalog - genau wie im Warenkorb (preise.cjs), damit Seite und
      // Rechnung nie um Cents auseinanderlaufen. Die Umsatzsteuer ist die Differenz, nicht
      // eine zweite Rechnung. Der Bruttopreis kommt mit, damit die Seite ihn nennen kann,
      // ohne selbst zu rechnen.
      preisNetto: (!darfPreise || t.preis == null) ? null : PREISE.netto(t.preis),
      mwst: (!darfPreise || t.preis == null) ? null : PREISE.steuer(t.preis),
      // Firmen bestellen in Stueckzahl - die Staffel ist fuer sie kein Kleingedrucktes,
      // sondern der Grund, warum sie hier bestellen. Also steht sie je Textil da, netto.
      staffel: (!darfPreise || t.preis == null) ? [] : PREISE.STAFFEL.filter(s => s.rabatt > 0).map(s => ({
        ab: s.ab, rabatt: s.rabatt,
        stueckNetto: PREISE.netto(PREISE.rund(t.preis * (1 - s.rabatt)))
      })).sort((a, b) => a.ab - b.ab),
      groessen: t.groessen || [],
      druck: t.druck || null,
      // Welche Seite das Produktfoto zeigt - und damit, welcher Druckplatz darauf ueberhaupt
      // gezeigt werden kann. Ein Brustlogo auf dem Rueckenfoto der Zip-Jacke war Unsinn
      // ("hinten zu klein, nicht mittig"): das Foto zeigt den Ruecken, also kommt dort der
      // Rueckendruck hin. Vorderfotos zeigen die Brust. Der Rest folgt mit den fehlenden Fotos.
      ansicht: g ? (g.view || 'vorn') : null,
      platz: g ? ((g.view || 'vorn') === 'hinten' ? 'ruecken' : 'brust') : null,
      farben,
      // bereit = es gibt eine Produktvorlage. Ohne die kann nichts gezeigt werden.
      bereit: farben.length > 0
    });
  }
  res.json({
    hatLogo: !!who.user.firmaLogo,
    firma: (who.user.firma && who.user.firma.name) || '',
    plaetze: PLAETZE,
    teile,
    // Firmenkunden rechnen netto. Der Satz kommt aus preise.cjs - es gibt genau eine Stelle,
    // an der die Umsatzsteuer steht, und das bleibt so.
    netto: true,
    mwstSatz: PREISE.MWST,
    // Darf dieser Kunde Preise sehen? Und wenn nein, woran liegt es - das entscheidet, welcher
    // Satz auf der Seite steht: "erst anmelden" oder "bitte noch bestaetigen".
    preiseSichtbar: darfPreise,
    unternehmerSeit: (who.user.firma && who.user.firma.unternehmerSeit) || null,
    // "zzgl. Versandkosten" gehoert zur Netto-Auszeichnung dazu (IT-Recht Kanzlei). Die Zahlen
    // kommen von dort, wo sie berechnet werden - die Seite tippt sie nicht ab.
    versand: { kosten: PREISE.VERSAND, freiAbWert: PREISE.VERSANDFREI_AB_WERT, freiAbArtikel: PREISE.VERSANDFREI_AB_ARTIKEL },
    pflege: PFLEGE,
    zertifikate: ZERTIFIKATE
  });
});

// Das Firmenlogo auf einem Textil. Wie logo.png bewusst nur fuer den Besitzer: gerechnet
// wird immer mit dem Logo AM KONTO des Anfragenden, eine fremde Bild-ID ist gar nicht erst
// vorgesehen. Kein Wasserzeichen - das ist sein eigenes Logo in seinem eigenen Bereich.
app.get('/api/mo/firma/mockup/:garment/:color/:datei', async (req, res) => {
  const who = await identify(req, res);
  const logoId = who.user && who.user.firmaLogo;
  if (!logoId) return res.status(404).end();
  const garment = String(req.params.garment);
  const color = String(req.params.color);
  const platz = String(req.params.datei).replace(/\.jpg$/i, '');
  if (!GARMENTS[garment] || !COLORS.includes(color) || !FIRMA_PLAETZE[platz]) return res.status(404).end();
  if (!(await templateReady(garment, color))) return res.status(503).json({ error: 'vorlage fehlt' });
  // Der Cache haengt an der Logo-ID: neues Logo = neuer Dateiname, nie ein altes Bild.
  // v2 im Namen: die Logo-Geometrie hat sich geaendert, alte Bilder duerfen nicht kleben bleiben.
  const cached = path.join(STORE, 'mockups', `firma_v3_${logoId}_${garment}_${color}_${platz}.jpg`);
  try { return res.type('jpeg').set('cache-control', 'private, max-age=600').send(await fs.readFile(cached)); }
  catch (e) { /* noch nicht gerechnet */ }
  try {
    const logo = await fs.readFile(path.join(STORE, 'uploads', logoId));
    // logo:true = Logo-Geometrie statt Motiv-Geometrie (Herzseite bzw. gross auf dem Ruecken).
    const jpg = await makeMockup(logo, garment, color, false, { place: FIRMA_PLAETZE[platz], logo: true, linie: LINIE_STANDARD });
    try { await fs.mkdir(path.join(STORE, 'mockups'), { recursive: true }); await fs.writeFile(cached, jpg); } catch (e) { /* Cache ist Kuer */ }
    res.type('jpeg').set('cache-control', 'private, max-age=600').send(jpg);
  } catch (e) {
    console.error('Firmen-Mockup fehlgeschlagen:', garment, color, platz, e && e.message ? e.message : e);
    res.status(500).json({ error: 'Vorschau fehlgeschlagen' });
  }
});

// ---- Fassung 31: ein fertiges Design direkt auf den Firmenteilen ------------------------
// Vom Handwerker-Design fuehrt "Ja, fuer die Firma" nach /firma?design=... - dort liegt das
// Design dann auf jedem Teil, statt nur das Logo. Nur fuer den Besitzer des Designs: der
// Auftrag muss am Konto haengen (oder noch im Speicher demselben Gast gehoeren).
async function designGehoert(designId, who) {
  if (!designId) return false;
  const jf = await readJob(designId);
  if (jf && who.user && jf.user === who.user.id) return true;
  const j = await jobZuDesign(designId);
  return !!(j && meinAuftrag(j, who));
}
app.get('/api/mo/firma/design/:designId', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'nicht angemeldet' });
  const designId = String(req.params.designId).replace(/[^A-Za-z0-9_-]/g, '');
  if (!(await designGehoert(designId, who))) return res.status(404).json({ error: 'design unbekannt' });
  const jf = await readJob(designId);
  let mottoName = '';
  try { const m = jf && await mottos.get(jf.motto); mottoName = m ? m.name : ''; } catch (e) { /* Name ist Beiwerk */ }
  res.json({ ok: true, designId, motto: mottoName, textile: (jf && jf.textile) || 'dunkel' });
});
app.get('/api/mo/firma/design-mockup/:designId/:garment/:color/:datei', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.status(401).end();
  const designId = String(req.params.designId).replace(/[^A-Za-z0-9_-]/g, '');
  const garment = String(req.params.garment);
  const color = String(req.params.color);
  const platz = String(req.params.datei).replace(/\.jpg$/i, '');
  if (!GARMENTS[garment] || !COLORS.includes(color) || !FIRMA_PLAETZE[platz]) return res.status(404).end();
  if (!(await designGehoert(designId, who))) return res.status(404).end();
  if (!(await templateReady(garment, color))) return res.status(503).json({ error: 'vorlage fehlt' });
  const cached = path.join(STORE, 'mockups', `firmadesign_${designId}_${garment}_${color}_${platz}.jpg`);
  try { return res.type('jpeg').set('cache-control', 'private, max-age=600').send(await fs.readFile(cached)); }
  catch (e) { /* noch nicht gerechnet */ }
  try {
    const jf = await readJob(designId);
    const print = jf && istHell(jf.textile) ? 'hell' : 'dunkel';
    // Vorderfoto: das Design als Frontdruck, Rueckenfoto (Zip-Jacke): als Rueckendruck. Kein Wasserzeichen - eigener Bereich.
    const jpg = await makeMockup(await masterLesen(designId), garment, color, false, { place: platz === 'ruecken' ? 'back' : 'front', print, linie: LINIE_STANDARD });
    try { await fs.mkdir(path.join(STORE, 'mockups'), { recursive: true }); await fs.writeFile(cached, jpg); } catch (e) { /* Cache ist Kuer */ }
    res.type('jpeg').set('cache-control', 'private, max-age=600').send(jpg);
  } catch (e) {
    console.error('Firmen-Design-Mockup fehlgeschlagen:', designId, garment, color, platz, e && e.message ? e.message : e);
    res.status(500).json({ error: 'Vorschau fehlgeschlagen' });
  }
});

app.delete('/api/mo/firma/liste/:id', async (req, res) => {
  const who = await identify(req, res);
  if (!who.user) return res.status(401).json({ error: 'nicht angemeldet' });
  const id = String(req.params.id).replace(/[^a-z0-9_]/gi, '');
  who.user.listen = (who.user.listen || []).filter(x => x.id !== id);
  await accounts.save(who.user);
  res.json({ ok: true });
});

// ---------- Vorschaubilder im besten Format, das der Browser kann ----------
// Fassung 78: Alle Vorschaubilder gingen als JPEG raus. Jedes halbwegs aktuelle Handy nimmt
// AVIF, und dasselbe Bild wiegt darin nachgemessen 50 bis 68 Prozent weniger - bei gleichem
// Aussehen. Das ist der groesste Byte-Hebel, der auf der Seite noch uebrig war.
// Der Haken: AVIF zu rechnen dauert eine halbe bis eine ganze Sekunde. Darauf darf niemand
// warten. Also: liegt die kleine Fassung schon da, geht sie raus. Liegt sie nicht da, geht
// sofort das JPEG raus, und die kleine Fassung wird im Hintergrund gebaut - der naechste
// Besucher bekommt sie. Kein Aufruf wird dadurch langsamer, keiner wartet auf eine Umrechnung.
const BILD_FORMATE = [
  // Der Typ steht hier voll ausgeschrieben: die Mime-Tabelle von Express kennt "avif" nicht und
  // haette daraus application/octet-stream gemacht - der Browser haette das Bild dann angeboten
  // zum Herunterladen statt es anzuzeigen.
  { endung: 'avif', typ: 'image/avif', nimmt: /image\/avif/, mach: (b) => sharp(b).avif({ quality: 52, effort: 4 }).toBuffer() },
  { endung: 'webp', typ: 'image/webp', nimmt: /image\/webp/, mach: (b) => sharp(b).webp({ quality: 74 }).toBuffer() }
];
const BILD_LAEUFT = new Set();   // was gerade im Hintergrund gerechnet wird, nicht doppelt anstossen
async function imHintergrund(format, jpgPfad, zielPfad) {
  if (BILD_LAEUFT.has(zielPfad)) return;
  BILD_LAEUFT.add(zielPfad);
  try {
    const jpg = await fs.readFile(jpgPfad);
    const klein = await format.mach(jpg);
    // Nur behalten, wenn es wirklich kleiner ist - bei sehr kleinen Bildern ist es das nicht.
    if (klein.length < jpg.length) await fs.writeFile(zielPfad, klein);
    else await fs.writeFile(zielPfad + '.nein', '');   // Merkzettel: hier lohnt es nicht
  } catch (e) { /* dann bleibt es beim JPEG */ }
  finally { BILD_LAEUFT.delete(zielPfad); }
}
// Liefert die beste Fassung eines bereits als JPEG abgelegten Bildes aus. Gibt true zurueck,
// wenn etwas gesendet wurde.
async function sendBestesBild(req, res, jpgPfad) {
  res.vary('Accept');   // die Antwort haengt am Accept-Kopf, das muss jeder Zwischenspeicher wissen
  const nimmt = String(req.headers.accept || '');
  const kann = BILD_FORMATE.filter(f => f.nimmt.test(nimmt));
  for (const f of kann) {
    const ziel = jpgPfad.replace(/\.jpg$/i, '.' + f.endung);
    try { res.type(f.typ).send(await fs.readFile(ziel)); return true; } catch (e) { /* nicht da */ }
  }
  let jpg;
  try { jpg = await fs.readFile(jpgPfad); } catch (e) { return false; }
  res.type('jpeg').send(jpg);
  // Erst antworten, dann rechnen. Nur das erste Format, das der Browser kann - wer AVIF nimmt,
  // braucht kein WebP daneben.
  if (kann.length) {
    const f = kann[0];
    const ziel = jpgPfad.replace(/\.jpg$/i, '.' + f.endung);
    fs.access(ziel + '.nein').catch(() => imHintergrund(f, jpgPfad, ziel));
  }
  return true;
}

// ---------- Damit Google die Seite ueberhaupt richtig findet ----------
// Fassung 78: Es gab weder robots.txt noch sitemap.xml - Google musste jede Seite selbst
// entdecken und raten, was wichtig ist. Die Sitemap kommt aus derselben Mottoliste, aus der
// die Startseite gebaut wird: ein neues Motto steht damit automatisch drin, ein abgeschaltetes
// verschwindet. Nichts von Hand zu pflegen, also auch nichts, was veralten kann.
const OEFFENTLICH = ['/', '/mottos', '/stile', '/so-gehts', '/event', '/impressum', '/datenschutz', '/agb', '/widerruf'];
function basisUrl() { return String(env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''); }
app.get('/robots.txt', (req, res) => {
  // Das Backend, die Schnittstellen und alles Persoenliche haben in einem Suchindex nichts zu
  // suchen; Abstimmungslinks schon gar nicht - die sind privat.
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(
    ['User-agent: *',
     'Allow: /',
     'Disallow: /api/',
     'Disallow: /admin',
     'Disallow: /konto',
     'Disallow: /abstimmung',
     'Disallow: /a/',
     '',
     'Sitemap: ' + basisUrl() + '/sitemap.xml',
     ''].join('\n'));
});
app.get('/sitemap.xml', async (req, res) => {
  try {
    const liste = (await mottos.all()).filter(inMottoListe);
    const basis = basisUrl();
    const heute = new Date().toISOString().slice(0, 10);
    const eintrag = (pfad, prio, wechsel) =>
      `  <url><loc>${escHtml(basis + pfad)}</loc><lastmod>${heute}</lastmod>` +
      `<changefreq>${wechsel}</changefreq><priority>${prio}</priority></url>`;
    const zeilen = [
      eintrag('/', '1.0', 'daily'),
      ...liste.map(m => eintrag('/m/' + encodeURIComponent(m.slug), '0.9', 'weekly')),
      ...OEFFENTLICH.slice(1).map(p => eintrag(p, '0.3', 'yearly'))
    ];
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + zeilen.join('\n') + '\n</urlset>\n');
  } catch (e) {
    console.error('sitemap.xml:', e && e.message ? e.message : e);
    res.status(500).end();
  }
});

// Rechtstexte
const LEGAL = legalPages(env);
app.get('/impressum', (req, res) => res.type('html').send(LEGAL.impressum));
app.get('/datenschutz', (req, res) => res.type('html').send(LEGAL.datenschutz));
// Fassung 75: die Seite heisst jetzt AGB; /nutzungsbedingungen bleibt als alter Pfad bestehen,
// damit Links aus Mails und Fusszeilen weiter funktionieren.
app.get(['/agb', '/nutzungsbedingungen', '/geschaeftsbedingungen'], (req, res) => res.type('html').send(LEGAL.agb));
// Fassung 66: Widerrufsbelehrung mit Knopf. /widerrufsbelehrung und /widerrufsformular fuehren
// auf dieselbe Seite - so findet sie auch, wer einen anderen Namen erwartet.
app.get(['/widerruf', '/widerrufsbelehrung', '/widerrufsformular'], (req, res) => res.type('html').send(LEGAL.widerruf));
// Der Kunde erklaert den Widerruf ueber das Formular: die Erklaerung geht als Mail an den Betreiber,
// der Kunde bekommt eine Bestaetigung. Beides wird auch dann protokolliert, wenn kein Mailversand
// eingerichtet ist - eine eingegangene Erklaerung darf nie verloren gehen.
app.post('/api/mo/widerruf', express.json({ limit: '64kb' }), async (req, res) => {
  const b = req.body || {};
  const feld = (v, max) => String(v == null ? '' : v).replace(/[ -]/g, ' ').trim().slice(0, max);
  const name = feld(b.name, 120), email = feld(b.email, 160);
  if (!name || !/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'angaben', hinweis: 'Bitte Name und eine gültige E-Mail-Adresse angeben.' });
  }
  const WAS = { kuendigung: 'Kündigung der Mitgliedschaft', mitgliedschaft: 'Widerruf Mitgliedschaft oder Design-Kontingent', lagerware: 'Widerruf nicht personalisierte Ware', mangel: 'Mangel / Reklamation', sonstiges: 'Sonstiges' };
  const eintrag = {
    id: 'wr_' + crypto.randomBytes(6).toString('hex'),
    eingegangen: new Date().toISOString(),
    name, email,
    adresse: feld(b.adresse, 200), nummer: feld(b.nummer, 80), datum: feld(b.datum, 40),
    was: WAS[feld(b.was, 20)] || 'Sonstiges', zeitpunkt: feld(b.zeitpunkt, 60), text: feld(b.text, 2000),
    ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 45),
  };
  // Zuerst ablegen, dann versenden: eine Erklaerung, die nur in einer Mail steht, ist weg, wenn der
  // Mailversand klemmt. Die Ablage liegt auf dem Volume und wird mitgesichert.
  try {
    await fs.mkdir(path.join(STORE, 'widerruf'), { recursive: true });
    await fs.writeFile(path.join(STORE, 'widerruf', eintrag.id + '.json'), JSON.stringify(eintrag, null, 1));
  } catch (e) { console.error('Widerruf ablegen:', e && e.message ? e.message : e); }
  console.log('Widerruf eingegangen:', eintrag.id, '·', eintrag.was, '·', eintrag.nummer || 'ohne Nummer');
  const hEsc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
  const zeile = (k, v) => v ? `<p style="margin:2px 0"><b>${k}:</b> ${hEsc(v)}</p>` : '';
  const anBetreiber = `<p>Über das Formular auf /widerruf ist eine Widerrufserklärung eingegangen.</p>
${zeile('Eingang', new Date(eintrag.eingegangen).toLocaleString('de-DE'))}${zeile('Name', eintrag.name)}${zeile('E-Mail', eintrag.email)}${zeile('Anschrift', eintrag.adresse)}${zeile('Auftrag/Design', eintrag.nummer)}${zeile('Bestellt/erhalten am', eintrag.datum)}${zeile('Betrifft', eintrag.was)}${zeile('Zum Zeitpunkt', eintrag.zeitpunkt)}
${eintrag.text ? `<p style="margin-top:10px"><b>Nachricht:</b><br>${hEsc(eintrag.text).replace(/\n/g, '<br>')}</p>` : ''}
<p style="color:#777;font-size:12px">Vorgang ${eintrag.id}</p>`;
  const kuend = /K.ndigung/.test(eintrag.was);
  const anKunden = `<p>Hallo ${hEsc(eintrag.name)},</p>
<p>wir haben deine ${kuend ? 'Kündigung' : 'Widerrufserklärung'} erhalten. Damit ist die Frist gewahrt.</p>
${zeile('Eingang', new Date(eintrag.eingegangen).toLocaleString('de-DE'))}${zeile('Betrifft', eintrag.was)}${zeile('Auftrag/Design', eintrag.nummer)}
<p>Wir melden uns bei dir, sobald wir den Vorgang bearbeitet haben. Bei Rückfragen antworte einfach auf diese E-Mail.</p>
<p>Viele Grüße<br>${hEsc(LEGAL.firma)}<br>${hEsc(LEGAL.anschrift)}<br>${hEsc(LEGAL.telefon)}</p>
<p style="color:#777;font-size:12px">Vorgang ${eintrag.id}</p>`;
  if (env.BREVO_API_KEY) {
    const an = env.WIDERRUF_MAIL || env.ADMIN_MAIL || LEGAL.mail;
    try { await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: an, subject: `${kuend ? 'Kündigung' : 'Widerruf'}: ${eintrag.was}${eintrag.nummer ? ' · ' + eintrag.nummer : ''}`, html: anBetreiber, replyTo: eintrag.email }); }
    catch (e) { console.error('Widerruf-Mail an den Betrieb:', e && e.message ? e.message : e); }
    try { await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: eintrag.email, subject: kuend ? 'Deine Kündigung ist bei uns eingegangen' : 'Dein Widerruf ist bei uns eingegangen', html: anKunden }); }
    catch (e) { console.error('Widerruf-Bestaetigung an den Kunden:', e && e.message ? e.message : e); }
  }
  res.json({ ok: true, id: eintrag.id });
});

// ---------------------------------------------------------------------------------------------
// Firmenlogos von der Firmenseite holen
// 22. Sept., Markus: "Wir muessen dann natuerlich eine Moeglichkeit haben, das Original-Logo von
// der Homepage runterzuziehen, sonst funktioniert es natuerlich nicht."
// Geholt wird NUR fuer Firmen mit Freigabe-Eintrag - dieselbe Sperre wie beim Wappen. Die Datei
// landet auf dem VOLUME (storage/firmenlogos), weil sie nur dort den naechsten Deploy ueberlebt;
// daneben liegt der Nachweis: woher, wann, wie gross.
const FIRMENLOGO_NACHWEIS = path.join(STORE, 'firmenlogos', 'nachweis.json');
/**
 * Die Freigaben MIT den geholten Koordinaten. Die Anschrift steht nicht im Repo-Eintrag, sondern
 * im Nachweis auf dem Volume - dorthin hat der Server sie von der Firmenseite geholt. Wer die
 * Freigaben zum Rechnen braucht, nimmt diese Liste, nicht die rohe Datei.
 */
async function firmenListe() {
  const liste = await firmenFreigaben();
  const nachweis = await firmenlogoNachweis();
  return liste.map(e => {
    const n = nachweis[e.firma];
    if (Array.isArray(e.punkt) && e.punkt.length === 2) return e;
    if (n && Array.isArray(n.punkt) && n.punkt.length === 2) return { ...e, punkt: n.punkt, adresse: n.anschrift || e.adresse || '' };
    return e;
  });
}

async function firmenlogoNachweis() {
  try { return JSON.parse(await fs.readFile(FIRMENLOGO_NACHWEIS, 'utf8')); } catch (e) { return {}; }
}
// Die Hausfarben einer Firma: am Logo gemessen, im Zweifel von der Webseite entschieden.
// Eine Stelle fuer alle drei Aufrufer - sonst haette eine davon die Seitenfarben vergessen,
// und genau daran hing, dass DTF Express schwarz statt gruen war.
async function firmenHausfarben(eintrag) {
  const nw = await firmenlogoNachweis().catch(() => ({}));
  const s = (nw[eintrag && eintrag.firma] && nw[eintrag.firma].seitenFarben) || [];
  return firmenFarben(eintrag, dominantColors, STORE, s);
}
async function firmenlogoHolen(eintrag) {
  const name = eintrag && eintrag.firma;
  if (!eintrag || !eintrag.freigabe || !eintrag.freigabe.datum) return { firma: name, ok: false, grund: 'keine Freigabe eingetragen' };
  if (!firmenDateiName(eintrag)) return { firma: name, ok: false, grund: 'kein Dateiname im Eintrag' };
  if (!String(eintrag.webseite || '').trim()) return { firma: name, ok: false, grund: 'keine Webseite hinterlegt' };
  const r = await logoVonWebseite(eintrag.webseite, { firma: name });
  if (!r.ok) return { firma: name, ok: false, grund: r.grund, verworfen: r.verworfen || [] };
  await firmenLogoAblegen(eintrag, r.png, STORE);
  const nachweis = await firmenlogoNachweis();
  // 22. Sept., Markus: "Es muss so funktionieren mit Standort." - "Und die Adresse ist doch auf
  // der Homepage." Beides stimmt, und beides haengt zusammen: ohne Anschrift kann der Standort
  // nichts entscheiden. Die Anschrift steht auf der Seite, die wir ohnehin lesen; Nominatim
  // macht Koordinaten daraus. Ab da entscheidet das GPS des Kunden allein.
  let punkt = null, ungenau = null;
  if (r.anschrift && r.anschrift.text) {
    try {
      // 30. Sept., Markus: "Pruefe bitte, ob das weltweit funktioniert." Hier stand ", Deutschland"
      // fest - eine Firma in Spanien ohne eingetragenen Punkt haette ihre Anschrift nie gefunden.
      // Das Land steht im Eintrag (land); ohne Angabe bleibt Deutschland.
      const lage = await geocodeRoh(r.anschrift.text + ', ' + (String(eintrag.land || '').trim() || 'Deutschland'));
      if (lage && lage.genau) punkt = lage.punkt;
      else if (lage) {
        // Nichts faengt still (Regel 5): der Grund steht im Protokoll UND im Nachweis, damit man
        // im Backend sieht, warum diese Firma keinen Sitz hat.
        ungenau = { punkt: lage.punkt, was: (lage.befund && (lage.befund.class + '/' + lage.befund.type)) || 'unbekannt' };
        console.warn('Firmenadresse nur auf Strassenebene:', name, '·', r.anschrift.text, '·', ungenau.was,
          '- kein Sitz eingetragen. Koordinaten vor Ort messen und in postkarte/firmen-freigaben.json eintragen.');
      }
    } catch (e) { console.error('Firmenadresse verorten:', name, e && e.message ? e.message : e); }
  }
  nachweis[name] = {
    quelle: r.quelle, grund: r.grund, masse: r.masse, svg: !!r.svg,
    wann: new Date().toISOString(), webseite: eintrag.webseite,
    // Was die Firma macht - von derselben Seite gelesen, fuer die Firmenkarte.
    was: r.was || '', wasQuelle: r.wasQuelle || '', stichworte: r.stichworte || [], produktbilder: r.produktbilder || [],
    // Die Farben, die die Seite selbst nennt - zweite Quelle neben dem Logo (hausfarben()).
    seitenFarben: r.seitenFarben || [],
    // Wo sie steht - damit der Standort entscheiden kann.
    anschrift: r.anschrift ? r.anschrift.text : '', anschriftQuelle: r.anschrift ? (r.anschrift.seite || r.anschrift.quelle) : '', punkt,
    // Nur die Strasse gefunden? Dann steht hier, was der Geocoder lieferte - sichtbar im Backend.
    punktUngenau: ungenau
  };
  await fs.writeFile(FIRMENLOGO_NACHWEIS, JSON.stringify(nachweis, null, 2));
  return { firma: name, ok: true, quelle: r.quelle, grund: r.grund, masse: r.masse };
}

app.get('/api/admin/firmen', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const liste = await firmenFreigaben();
  const nachweis = await firmenlogoNachweis();
  const eintraege = [];
  for (const e of liste) {
    const png = await firmenLogoBild(e, STORE);
    eintraege.push({
      firma: e.firma, ort: e.ort, webseite: e.webseite || '', datei: firmenDateiName(e),
      freigabe: e.freigabe || null, adresse: e.adresse || '', punkt: e.punkt || [], radiusM: e.radiusM || 0,
      logo: png ? { da: true, bytes: png.length } : { da: false },
      geholt: nachweis[e.firma] || null,
      farben: await firmenHausfarben(e)
    });
  }
  res.json({ anzahl: eintraege.length, eintraege });
});

// Logo jetzt holen - fuer eine Firma ("firma") oder fuer alle, denen eins fehlt.
app.post('/api/admin/firmenlogo', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const liste = await firmenFreigaben();
  const nur = String((req.body && req.body.firma) || '').trim().toLowerCase();
  const ziel = nur ? liste.filter(e => String(e.firma).toLowerCase() === nur) : liste;
  if (!ziel.length) return res.status(404).json({ fehler: 'keine solche Firma in den Freigaben' });
  const ergebnis = [];
  for (const e of ziel) {
    try { ergebnis.push(await firmenlogoHolen(e)); }
    catch (err) { ergebnis.push({ firma: e.firma, ok: false, grund: err && err.message ? err.message : String(err) }); }
  }
  res.json({ ergebnis });
});

// Otto-Logo und Favicons (beim Start erzeugt, liegen im Storage)
// Fassung 77: Die Seiten binden das Reitersymbol als /favicon-64.png ein. Vorher stand dort
// favicon.png - die 512-px-Fassung, und die war mit 154 kB die schwerste Datei der Startseite,
// fuer ein Bild, das im Browserreiter 16 bis 32 px gross erscheint. favicon.png bleibt
// erreichbar (Lesezeichen auf dem Startbildschirm, geteilte Links), wird aber nicht mehr
// auf jeder Seite mitgeladen.
function sendIcon(res, file) {
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(STORE, file), (err) => { if (err && !res.headersSent) res.status(404).end(); });
}
app.get('/logo.png', (req, res) => sendIcon(res, 'logo.png'));
app.get('/favicon.png', (req, res) => sendIcon(res, 'favicon.png'));
app.get('/favicon.ico', (req, res) => sendIcon(res, 'favicon-32.png'));
app.get('/favicon-64.png', (req, res) => sendIcon(res, 'favicon-64.png'));
app.get('/favicon-32.png', (req, res) => sendIcon(res, 'favicon-32.png'));
app.get('/apple-touch-icon.png', (req, res) => sendIcon(res, 'apple-touch-icon.png'));

// ---------- Ein Cache, der nicht waechst ----------
// 25. Sept., beim Stabilitaets-Durchgang gefunden: vier Caches merken sich Werte mit einer Frist
// ("bis"), raeumen den Eintrag danach aber nie weg. Der Wert wird zwar neu geholt, der SCHLUESSEL
// bleibt fuer immer liegen. Gezaehlt, wovon die Schluessel kommen (die drei Orts-Caches sind am
// 12. Okt. mit der Postkarte gegangen):
//   ZETTEL_CACHE         jede Design-Nummer, die je auf einer Motto-Seite stand
// Das waechst also mit der Zahl der KUNDEN, nicht mit der Zahl der Dateien.
// Das faellt Wochen nicht auf und endet auf einem kleinen Server irgendwann in einem Neustart
// um drei Uhr nachts, den niemand erklaeren kann.
//
// Die Grenze ist grosszuegig: 500 Eintraege sind fuer einen Tag Betrieb weit mehr als genug,
// und was darueber hinausgeht, ist ohnehin kalt. Geworfen wird in dieser Reihenfolge - erst das
// Abgelaufene (das braucht sicher niemand mehr), dann das Aelteste. Eine Map merkt sich die
// Reihenfolge des Einfuegens, deshalb ist der erste Schluessel immer der aelteste.
const CACHE_GRENZE = 500;
function cacheSetzen(map, key, wert, grenze = CACHE_GRENZE) {
  map.delete(key);            // neu einsortieren: zuletzt gesetzt steht hinten
  map.set(key, wert);
  if (map.size > grenze) {
    const jetzt = Date.now();
    for (const [k, v] of map) {
      if (map.size <= grenze) break;
      if (v && typeof v === 'object' && typeof v.bis === 'number' && v.bis <= jetzt) map.delete(k);
    }
    while (map.size > grenze) map.delete(map.keys().next().value);
  }
  return wert;
}

// Preise, Staffel und Versand - dieselbe Datei, die der Server benutzt. So rechnen Seite und Server
// garantiert gleich; es gibt keine zweite Preistabelle im Frontend, die auseinanderlaufen koennte.
// Fassung 77: gelesen und ueber send() geschickt statt sendFile - nur so laeuft die Antwort
// durch die Packschicht oben. 14 kB Skript werden damit rund 4 kB. Einmal gelesen und
// gemerkt, die Datei aendert sich nur beim Deploy.
const SKRIPT_CACHE = new Map();
async function skriptText(datei) {
  let text = SKRIPT_CACHE.get(datei);
  if (text === undefined) { text = await fs.readFile(path.resolve(datei), 'utf8'); SKRIPT_CACHE.set(datei, text); }
  return text;
}
// Eine Datei, die ein Jahr im Speicher liegen darf, lohnt das beste Packen: Brotli auf Stufe 11
// statt der 5, die die Packschicht oben fuer jede Antwort nimmt. Das dauert einmal eine halbe
// Sekunde und wird dann behalten - dafuer ist die Datei rund ein Fuenftel kleiner. Genau das
// braucht der erste Aufruf einer Mottoseite, damit die Auslagerung ihn nicht langsamer macht.
const PACK_CACHE = new Map();
async function festGepackt(datei) {
  let p = PACK_CACHE.get(datei);
  if (p) return p;
  const text = await skriptText(datei);
  p = {
    br: zlib.brotliCompressSync(Buffer.from(text, 'utf8'), {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: text.length }
    }),
    gzip: zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 })
  };
  PACK_CACHE.set(datei, p);
  return p;
}
async function sendSkript(res, datei, sekunden, fest) {
  try {
    res.set('Cache-Control', 'public, max-age=' + sekunden + (fest ? ', immutable' : ''))
      .type('application/javascript');
    if (fest) {
      const nimmt = String(res.req.headers['accept-encoding'] || '');
      const p = await festGepackt(datei);
      const wahl = /\bbr\b/.test(nimmt) ? ['br', p.br] : /\bgzip\b/.test(nimmt) ? ['gzip', p.gzip] : null;
      if (wahl) {
        res.vary('Accept-Encoding');
        res.set('Content-Encoding', wahl[0]);   // die Packschicht oben laesst das dann in Ruhe
        return res.send(wahl[1]);
      }
    }
    res.send(await skriptText(datei));
  } catch (e) { if (!res.headersSent) res.status(404).end(); }
}
app.get('/preise.js', (req, res) => sendSkript(res, 'preise.cjs', 3600));

// ---------- Die zwei Schriften, aus dem eigenen Haus ----------
// Fassung 79: Anton und Archivo kamen von fonts.googleapis.com. Das heisst fuer jeden Besucher:
// Namensaufloesung und Verschluesselung fuer eine zweite, fremde Adresse, dann ein Stylesheet
// holen, DARIN erst die Adresse der Schriftdatei lesen, dann die Schrift holen - drei Wege
// hintereinander, bevor die Ueberschrift richtig aussieht. Im schwachen Netz war das der
// dickste Posten, der noch uebrig war.
// Jetzt liegen beide hier: Anton 15 kB, Archivo 28 kB. Archivo ist eine Variable Font, die
// alle Staerken von 400 bis 900 in EINER Datei traegt - vorher waren das fuenf Schnitte.
// Beide sind auf Latein zugeschnitten (der Rest der Zeichen war nur Gewicht) und tragen ihre
// Fassungsnummer im Dateinamen, damit sie ein Jahr im Speicher liegen duerfen. Wird eine
// Schrift getauscht, heisst sie -v2 und ist damit sofort ueberall neu.
// Lizenz: beide stehen unter der SIL Open Font License, die Lizenztexte liegen daneben.
app.get('/fonts/:file', (req, res) => {
  const name = String(req.params.file);
  if (!/^[a-z0-9-]+\.woff2$/i.test(name)) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=31536000, immutable').type('font/woff2');
  res.sendFile(path.join(path.resolve('fonts'), name), (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// ---------- Die Logik der Mottoseite als eigene Datei ----------
// Fassung 77 (Ladezeit): Das waren 142 kB im Kopf jeder einzelnen Mottoseite - bei sechzehn
// Anlaessen sechzehnmal derselbe Text, und bei jedem Besuch neu. Als eigene Datei wird sie
// einmal geladen und liegt dann im Zwischenspeicher: fuer jede weitere Mottoseite und jeden
// weiteren Besuch. Die Mottoseite selbst schrumpft von 192 auf 46 kB.
// Die Adresse traegt eine Fassungsnummer aus dem Inhalt (?v=). Deshalb darf der Speicher ein
// Jahr halten und "immutable" tragen: nach einem Deploy ist die Adresse eine andere, es kann
// also niemand mit einer alten Datei zu einer neuen Seite sitzen.
// Erst beim ersten Aufruf gerechnet und dann behalten - so steht die Nummer fest, bevor die
// erste Mottoseite rausgeht. Laesst sich die Datei nicht lesen, nimmt die Seite die Startzeit:
// dann ist der Speicher zwar pro Neustart neu, aber nie falsch.
let ASSET_V = null;
async function assetV() {
  if (ASSET_V) return ASSET_V;
  try {
    // Alle drei Skripte der Mottoseite haengen an derselben Versionsnummer - aendert sich eins,
    // holt der Browser alle neu (sie liegen ein Jahr im Zwischenspeicher).
    // Seit 1. Okt. zaehlt auch das Farbblatt marke.css mit: es liegt genauso lange im Speicher.
    const t = (await skriptText('motto-seite.js')) + (await skriptText('abfolge.js')) + (await skriptText('otto-gespraech.js'))
      + (await fs.readFile(path.resolve('marke.css'), 'utf8'));
    ASSET_V = crypto.createHash('sha1').update(t).digest('hex').slice(0, 10);
  } catch (e) {
    console.error('motto-seite.js nicht lesbar:', e && e.message ? e.message : e);
    ASSET_V = 's' + Date.now().toString(36);
  }
  return ASSET_V;
}
app.get('/motto-seite.js', (req, res) => sendSkript(res, 'motto-seite.js', 31536000, true));
// 1. Okt.: das gemeinsame Farbblatt aller Kundenseiten (Logo-Farben, Schriften, Kopf, Knopf).
// Die Seiten haengen ?v=<Fassung> an, deshalb darf es lange im Speicher liegen.
app.get('/marke.css', (req, res) => {
  res.set('Cache-Control', 'public, max-age=' + (req.query.v ? 31536000 : 3600)).type('text/css');
  res.sendFile(path.resolve('marke.css'), (err) => { if (err && !res.headersSent) { console.error('marke.css:', err.message); res.status(404).end(); } });
});
// 27. Sept., Markus, kurz nach einem Deploy: "Warum kann ich immer noch nicht mehr Fotos
// auswaehlen?" und "Und teilen. Fuer Social Media finde ich auch nicht." Live NACHGESTELLT (echte
// Karte im iPhone-Browser): alles da. Sein Handy hatte die Seite noch von VOR dem Deploy offen -
// ein Reiter, der seit gestern auf ist, laeuft mit dem alten Skript, bis jemand neu laedt. Die
// Seite fragt deshalb beim Zurueckkommen hier nach, welche Fassung gilt (siehe fassungPruefen in
// motto-seite.js). Kein Speicher: die Antwort muss immer die von jetzt sein.
app.get('/api/mo/fassung', async (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ v: await assetV() }); });
app.get('/abfolge.js', (req, res) => sendSkript(res, 'abfolge.js', 31536000, true));
// 6. Okt.: Otto im Gespraech - die Schicht ueber der Seite und Ottos Stimme (Markus' Aufnahmen, feste Saetze).
app.get('/otto-gespraech.js', (req, res) => sendSkript(res, 'otto-gespraech.js', req.query.v ? 31536000 : 3600, !!req.query.v));
// 6. Okt., Markus: "Bau mir doch hier einen Aufnahmeknopf" - "so eine kleine Seite, wo wir immer Zugriff haben, wo du die
// Saetze hinschreibst und ich sie im Nachgang anspreche". /admin/stimme: je Satz Text (aenderbar), Aufnahme, Probehoeren.
// Der Server bereitet jede Aufnahme selbst auf (ffmpeg: Trittschall, Rauschen, Stille, gleiche Lautheit) und legt sie als
// otto-stimme/<schluessel>.mp3 in den Speicher - Otto spricht sie sofort. Das Rohe bleibt daneben (roh/), falls nachzuarbeiten ist.
const STIMME_DIR = path.join(STORE, 'otto-stimme');
async function stimmeSaetze() {
  const basis = JSON.parse(await fs.readFile(path.resolve('otto-stimme/saetze.json'), 'utf8')).saetze || {};
  let eigen = {}; try { eigen = JSON.parse(await fs.readFile(path.join(STIMME_DIR, 'texte.json'), 'utf8')) || {}; } catch (e) { eigen = {}; }
  const saetze = {}, stand = {};
  for (const k of Object.keys(basis)) {
    saetze[k] = typeof eigen[k] === 'string' && eigen[k] ? eigen[k] : basis[k];
    for (const ort of [path.join(STIMME_DIR, k + '.mp3'), path.resolve('otto-stimme', k + '.mp3')]) {
      try { const st = await fs.stat(ort); stand[k] = Math.round(st.mtimeMs); break; } catch (e) { /* keine Aufnahme */ }
    }
  }
  return { saetze, stand, basis, eigen };
}
app.get('/otto-stimme/saetze.json', async (req, res) => {
  try { const { saetze, stand } = await stimmeSaetze(); res.set('Cache-Control', 'no-cache').json({ saetze, stand }); }
  catch (e) { console.error('Stimme Saetze:', e.message); res.status(500).json({ saetze: {}, stand: {} }); }
});
app.get('/admin/stimme', (req, res) => res.sendFile(path.resolve('stimme.html')));
app.get('/api/admin/stimme', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const { saetze, stand, basis, eigen } = await stimmeSaetze();
  res.set('Cache-Control', 'no-store').json({ saetze, stand, vorschlag: basis, geaendert: Object.keys(eigen).filter(k => basis[k] != null), ffmpeg: await ffmpegDa() });
});
app.post('/api/admin/stimme/:schluessel/text', (req, res, next) => adminGuard(req, res, next), express.json({ limit: '20kb' }), async (req, res) => {
  const k = String(req.params.schluessel || '');
  const { basis } = await stimmeSaetze();
  if (basis[k] == null) return res.status(404).json({ error: 'unbekannt' });
  const text = cleanValue((req.body || {}).text, 300);
  let eigen = {}; try { eigen = JSON.parse(await fs.readFile(path.join(STIMME_DIR, 'texte.json'), 'utf8')) || {}; } catch (e) { eigen = {}; }
  if (text && text !== basis[k]) eigen[k] = text; else delete eigen[k];
  await fs.mkdir(STIMME_DIR, { recursive: true });
  await fs.writeFile(path.join(STIMME_DIR, 'texte.json'), JSON.stringify(eigen, null, 2));
  console.log('Stimme: Text', k, '->', JSON.stringify(text || basis[k]));
  res.json({ ok: true, text: text || basis[k] });
});
let FFMPEG_DA = null;
async function ffmpegDa() {
  if (FFMPEG_DA !== null) return FFMPEG_DA;
  FFMPEG_DA = await new Promise(r => { try { const p = spawn('ffmpeg', ['-version']); p.on('error', () => r(false)); p.on('close', c => r(c === 0)); } catch (e) { r(false); } });
  return FFMPEG_DA;
}
// 6. Okt., Markus' erste echte Aufnahme (iPhone, 152 KB roh) kam als 2,8 s fast Stille heraus (Mittel -53,5 dB, Spitze -32,6 dB):
// die Aufnahme war leise, und der Stille-Filter (fest -45 dB) hat die Sprache als Stille weggeschnitten. Jetzt: erst MESSEN
// und auf -3 dB Spitze heben, DANN Stille schneiden; kommt trotzdem zu wenig heraus (unter 0,6 s oder Mittel unter -35 dB),
// wird ohne Stille-Schnitt aufbereitet. Das Rohe bleibt liegen - "neu" bereitet es neu auf, ohne neu zu sprechen.
function ffLauf(args) {
  return new Promise(r => {
    const p = spawn('ffmpeg', ['-hide_banner', ...args]);
    let err = ''; p.stderr.on('data', d => { err += d; }); p.on('error', e => r({ code: -1, err: e.message })); p.on('close', c => r({ code: c, err }));
  });
}
async function ffMessen(datei) {
  const { err } = await ffLauf(['-i', datei, '-af', 'volumedetect', '-f', 'null', '-']);
  const zahl = (re) => { const m = re.exec(err); return m ? parseFloat(m[1]) : null; };
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(err);
  return { max: zahl(/max_volume: (-?[\d.]+) dB/), mittel: zahl(/mean_volume: (-?[\d.]+) dB/), dauer: d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : null };
}
async function stimmeAufbereiten(roh, ziel) {
  const vorher = await ffMessen(roh);
  const gain = vorher.max == null ? 0 : Math.max(0, Math.min(40, -3 - vorher.max));
  const tmp = ziel + '.neu.mp3';
  const schnitt = 'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.15,areverse,';
  const filter = (mitSchnitt) => 'volume=' + gain.toFixed(1) + 'dB,highpass=f=80,afftdn=nf=-25,' + (mitSchnitt ? schnitt : '') + 'loudnorm=I=-16:TP=-1.5:LRA=11';
  let weg = 'mit Stille-Schnitt';
  let lauf = await ffLauf(['-loglevel', 'error', '-y', '-i', roh, '-af', filter(true), '-ac', '1', '-ar', '44100', '-b:a', '128k', tmp]);
  let nachher = lauf.code === 0 ? await ffMessen(tmp) : null;
  if (!nachher || nachher.dauer == null || nachher.dauer < 0.6 || nachher.mittel == null || nachher.mittel < -35) {
    weg = 'ohne Stille-Schnitt';
    lauf = await ffLauf(['-loglevel', 'error', '-y', '-i', roh, '-af', filter(false), '-ac', '1', '-ar', '44100', '-b:a', '128k', tmp]);
    nachher = lauf.code === 0 ? await ffMessen(tmp) : null;
  }
  if (lauf.code !== 0) return { fehler: String(lauf.err || '').slice(-300) || 'ffmpeg ' + lauf.code };
  await fs.rename(tmp, ziel);
  return { vorher, nachher, gain, weg };
}
async function stimmeRoh(k) {
  try { const f = (await fs.readdir(path.join(STIMME_DIR, 'roh'))).find(n => n.startsWith(k + '.')); return f ? path.join(STIMME_DIR, 'roh', f) : null; } catch (e) { return null; }
}
async function stimmeFertig(k, roh, res, rohKb) {
  if (!(await ffmpegDa())) { console.error('Stimme: kein ffmpeg - Rohaufnahme liegt unter', roh); return res.status(503).json({ error: 'ffmpeg', hinweis: 'Gespeichert, aber der Server kann sie gerade nicht aufbereiten – ich mache das von Hand.' }); }
  const ziel = path.join(STIMME_DIR, k + '.mp3');
  const e = await stimmeAufbereiten(roh, ziel);
  if (e.fehler) { console.error('Stimme: ffmpeg', k, e.fehler); return res.status(500).json({ error: 'aufbereiten', hinweis: 'Das Aufbereiten hat nicht geklappt – die Rohaufnahme ist gespeichert.' }); }
  const st = await fs.stat(ziel);
  const f = (x) => (x == null ? '?' : x.toFixed(1));
  console.log('Stimme:', k, rohKb != null ? rohKb + ' KB roh' : 'neu aufbereitet', '· vorher Spitze', f(e.vorher.max), 'dB, Mittel', f(e.vorher.mittel), 'dB, ' + f(e.vorher.dauer) + ' s · +' + e.gain.toFixed(1) + ' dB · ' + e.weg + ' · nachher Mittel', f(e.nachher && e.nachher.mittel), 'dB, ' + f(e.nachher && e.nachher.dauer) + ' s');
  const leise = e.nachher && e.nachher.mittel != null && e.nachher.mittel < -35;
  res.json({ ok: true, stand: Math.round(st.mtimeMs), dauer: e.nachher && e.nachher.dauer, leise, hinweis: leise ? 'Die Aufnahme ist sehr leise – bitte etwas näher ans Handy und nochmal.' : '' });
}
app.post('/api/admin/stimme/:schluessel/aufnahme', (req, res, next) => adminGuard(req, res, next), express.raw({ type: () => true, limit: '20mb' }), async (req, res) => {
  const k = String(req.params.schluessel || '');
  const { basis } = await stimmeSaetze();
  if (basis[k] == null) return res.status(404).json({ error: 'unbekannt' });
  const buf = Buffer.isBuffer(req.body) ? req.body : null;
  if (!buf || buf.length < 2000) return res.status(400).json({ error: 'leer', hinweis: 'Die Aufnahme ist leer – bitte noch einmal.' });
  const typ = String(req.headers['content-type'] || '');
  const endung = /mp4|m4a|aac/.test(typ) ? 'm4a' : /ogg/.test(typ) ? 'ogg' : /wav/.test(typ) ? 'wav' : /mpeg|mp3/.test(typ) ? 'mp3' : 'webm';
  await fs.mkdir(path.join(STIMME_DIR, 'roh'), { recursive: true });
  const alt = await stimmeRoh(k); if (alt) await fs.rm(alt, { force: true });
  const roh = path.join(STIMME_DIR, 'roh', k + '.' + endung);
  await fs.writeFile(roh, buf);
  return stimmeFertig(k, roh, res, Math.round(buf.length / 1024));
});
// Neu aufbereiten aus dem Rohen (ohne neu zu sprechen) und das Rohe holen - zum Nachhoeren, wenn etwas komisch klingt
app.post('/api/admin/stimme/:schluessel/neu', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const k = String(req.params.schluessel || '');
  const roh = /^[a-z_]+$/.test(k) ? await stimmeRoh(k) : null;
  if (!roh) return res.status(404).json({ error: 'keine Rohaufnahme' });
  return stimmeFertig(k, roh, res, null);
});
app.get('/api/admin/stimme/:schluessel/roh', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const k = String(req.params.schluessel || '');
  const roh = /^[a-z_]+$/.test(k) ? await stimmeRoh(k) : null;
  if (!roh) return res.status(404).end();
  res.set('Cache-Control', 'no-store').sendFile(roh);
});
app.get('/otto-stimme/:datei', async (req, res) => {
  const d = String(req.params.datei || '');
  if (!/^[a-z_]+\.mp3$/.test(d)) return res.status(404).end();
  for (const ort of [path.join(STORE, 'otto-stimme', d), path.resolve('otto-stimme', d)]) {
    try { await fs.access(ort); res.set('Cache-Control', req.query.v ? 'public, max-age=31536000' : 'no-cache').type('audio/mpeg'); return res.sendFile(ort); } catch (e) { /* weiter */ }
  }
  res.status(404).end();
});
// Was der Kunde sagt -> was auf der Seite zu tun ist. Die Seite schickt, was sichtbar ist (Felder, Kacheln, Knoepfe mit
// kurzer Kennung); das Textmodell waehlt die Aktionen. Nie Bezahlen, nie etwas erfinden, was der Kunde nicht gesagt hat.
const GESPRAECH = 'Du bist Otto, der Design-Assistent des Shops Motto Otto (personalisierte T-Shirts, Hoodies, Kissen ...). Der Kunde bedient die Seite per Sprache. Du bekommst seine Aussage und die SICHTBAREN Elemente der Seite (id, art: feld|auswahl|haken|knopf, text, wert, optionen, gewaehlt, tipp).\n'
  + 'Gib die Aktionen zurueck, die seine Aussage auf DIESER Seite umsetzen:\n'
  + '- {"art":"setzen","ziel":"<id>","wert":"..."} fuer Felder, Auswahlen (wert = Text einer Option) und Haken (true/false). In Textfelder kommt, was der Kunde sagt, sauber geschrieben, nichts weggelassen, nichts dazuerfunden.\n'
  + '- {"art":"klick","ziel":"<id>"} fuer Kacheln und Knoepfe (z. B. einen Stil, eine Farbe, eine Groesse, eine Kaufform, "Weiter zur Kasse").\n'
  + '- {"art":"weiter"} wenn der Kunde fertig ist mit diesem Schritt oder es klar ist, dass es weitergehen soll; {"art":"zurueck"} wenn er zurueck will.\n'
  + 'Regeln: Nur ids aus der Liste. Ja zu einem Foto = den Knopf mit tipp:true klicken. Nein zum Foto, "ohne", "brauch ich nicht" = weiter. "Gefaellt mir" beim fertigen Design = die passende Kaufform bzw. Weiter waehlen. '
  + 'Mengen und Groessen ("zwei Stueck, L") in die passenden Felder. NIE etwas klicken, das bezahlt oder zahlungspflichtig bestellt. Wenn nichts passt oder es unklar ist: keine Aktion, dafuer "sag" mit einer kurzen Rueckfrage.\n'
  + 'Antworte NUR als JSON: {"aktionen":[...],"sag":"kurzer Satz auf Deutsch oder leer"}';
app.post('/api/mo/gespraech', async (req, res) => {
  const aussage = cleanLong((req.body || {}).aussage, 2000);
  const seiteRoh = (req.body || {}).seite || {};
  if (!aussage) return res.status(400).json({ error: 'aussage' });
  const elemente = (Array.isArray(seiteRoh.elemente) ? seiteRoh.elemente : []).slice(0, 80).map(e => ({
    id: String(e.id || '').replace(/[^a-z0-9]/g, '').slice(0, 6), art: String(e.art || '').slice(0, 10), text: String(e.text || '').slice(0, 80),
    ...(e.wert !== undefined ? { wert: typeof e.wert === 'boolean' ? e.wert : String(e.wert).slice(0, 300) } : {}),
    ...(Array.isArray(e.optionen) ? { optionen: e.optionen.slice(0, 40).map(o => String(o).slice(0, 40)) } : {}),
    ...(e.gewaehlt ? { gewaehlt: true } : {}), ...(e.tipp ? { tipp: true } : {}) })).filter(e => e.id);
  if (!openai || !env.QA_MODEL || process.env.ABNAHME) return res.json({ aktionen: [], sag: '' });
  try {
    const r = await openai.chat.completions.create({ model: env.QA_MODEL, ...SCHNELL(), messages: [
      { role: 'system', content: GESPRAECH },
      { role: 'user', content: JSON.stringify({ aussage, schritt: String(seiteRoh.schritt || '').slice(0, 40), frage: String(seiteRoh.frage || '').slice(0, 200), motto: String(seiteRoh.motto || '').slice(0, 60), elemente }) }] });
    const j = JSON.parse(String(r.choices[0].message.content || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    const ids = new Set(elemente.map(e => e.id));
    const aktionen = (Array.isArray(j.aktionen) ? j.aktionen : []).slice(0, 12).filter(a => a && (a.art === 'weiter' || a.art === 'zurueck' || ((a.art === 'setzen' || a.art === 'klick') && ids.has(String(a.ziel)))))
      .map(a => ({ art: a.art, ...(a.ziel ? { ziel: String(a.ziel) } : {}), ...(a.art === 'setzen' ? { wert: typeof a.wert === 'boolean' ? a.wert : String(a.wert == null ? '' : a.wert).slice(0, 5000) } : {}) }));
    // Sicherheit: nichts anklicken, was nach Bezahlen aussieht
    const zahl = new Set(elemente.filter(e => /zahlungspflichtig|jetzt bezahlen|kaufen und bezahlen/i.test(e.text)).map(e => e.id));
    res.json({ aktionen: aktionen.filter(a => !zahl.has(a.ziel)), sag: String(j.sag || '').slice(0, 200) });
  } catch (e) { console.error('Gespraech:', e && e.message ? e.message : e); res.json({ aktionen: [], sag: '' }); }
});

// Aus "Ball-z" wird "ball-z", aus "C.C.E. Sportswear" wird "ccesportswear". EINE Rechnung fuer
// beide Seiten: die Route liest damit den Eintrag, der Auftrag baut damit die Vorlagen-URL.
// Stuenden zwei Fassungen da, liefe das Logo irgendwann ins Leere - und niemand saehe es.
function firmenSlug(name) { return String(name || '').toLowerCase().replace(/[^a-z0-9_-]/g, ''); }
// Das freigegebene Firmenlogo oeffentlich ausliefern - der Bilddienst holt Vorlagen ueber HTTPS
// und kann nicht auf das Volume sehen. Nur Firmen mit Freigabe, nur die hinterlegte Datei, nichts
// anderes: der Name wird nicht aus der Anfrage genommen, sondern aus dem Freigabe-Eintrag.
app.get('/api/mo/firmenlogo/:name.png', async (req, res) => {
  try {
    const gesucht = String(req.params.name || '').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    if (!gesucht) return res.status(400).end();
    const eintrag = (await firmenListe()).find(e => firmenSlug(e.firma) === gesucht);
    if (!eintrag || firmenUmfang(eintrag) !== 'voll') return res.status(404).end();
    const png = await firmenLogoBild(eintrag, STORE);
    if (!png) return res.status(404).end();
    res.type('png').set('Cache-Control', 'public, max-age=3600').send(png);
  } catch (e) { console.error('Firmenlogo ausliefern:', e && e.message ? e.message : e); res.status(500).end(); }
});

// Die gezeichneten Beispiel-Entwuerfe (dieselbe Datei wie im Erklaervideo) - die Startseite zeigt damit
// Schritt 2 und faellt darauf zurueck, wenn ein Mockup fehlt.
app.get('/entwurf.js', (req, res) => sendSkript(res, 'video/entwurf-svg.js', 86400));

// ---------- Kundenseite ----------
// 4. Okt., Markus: "Unter Motto steht Shirt, Tasse und Co. - das hat nichts bei Motto zu suchen."
// Das Motto haus gibt es nur ueber das Tor eines Partners (/bei/<slug>); in keiner Motto-Liste,
// Kachel oder Sitemap. Die Seite /m/haus selbst bleibt (das Tor verlinkt dorthin).
const NUR_UEBER_PARTNER = new Set(['haus']);
function inMottoListe(m) { return !!m && m.active !== false && !NUR_UEBER_PARTNER.has(m.slug); }
app.get('/api/mo/mottos', async (req, res) => {
  const list = (await mottos.all()).filter(inMottoListe).map(m => ({ ...publicView(withBezug(m)), gruppe: istGruppenMotto(m.slug) }));
  res.json({ mottos: list });
});

// ---- Der Wunsch: tippen oder sprechen, Otto fuellt das Motto (Markus, 5. Okt.: "ein absoluten Highlight-Button relativ
// oben ... der Kunde tippt oder spricht seinen Wunsch nur ein und wir bauen daraus ein geiles Design"). Das Textmodell waehlt
// aus dem Katalog das passende Motto, fuellt dessen Felder, Stil und Stoff; die Mottoseite oeffnet mit allem ausgefuellt auf
// "Alles klar?" - ein Tipp auf "Otto starten". Ohne Textmodell (oder bei Unsinn) wird es Dein Freestyle mit dem Wunsch als Motiv.
const WUNSCH_DIR = path.join(STORE, 'wunsch');
const WUNSCH_MAX_MS = 3 * 3600e3;
const WUNSCH_LESEN = 'You turn a customer wish for a personalised print (T-shirt, hoodie and the like) into a filled order form of a German shop. '
  + 'You get the wish and a catalogue of themes (slug, name, fields, allowed styles). Pick the ONE theme that fits best; if none fits well, pick "freestyle" '
  + 'and put a vivid, concrete description of the wished design into its field "motiv" (German, max 280 characters). Fill only fields you can fill from the wish: '
  + 'names, dates, places, numbers and slogans exactly as the customer said them; a short catchy German slogan only where the theme has a slogan field and the '
  + 'wish asks for one or clearly implies the mood. Never invent personal names. For select fields use one of the given options exactly. '
  + 'Style: one key from the allowed list that matches the wished look (if the customer names none, pick the one that suits the theme best). '
  + 'Fabric: "weiss" for light fabric, "schwarz" for dark fabric - follow the wish, otherwise what suits the style. '
  + 'Answer ONLY with JSON: {"slug":"...","values":{"field":"value"},"style":"...","textile":"weiss|schwarz"}';
function wunschKatalog(liste) {
  return liste.filter(m => inMottoListe(m) && !m.hausTextil && !m.artikelFest).map(m => ({
    slug: m.slug, name: m.name,
    fields: (m.fields || []).filter(f => !f.personal && !f.versteckt && f.type !== 'upload' && f.type !== 'checkbox').map(f => ({
      key: f.key, label: f.label, type: f.type, max: f.max || undefined, required: !!f.required,
      options: Array.isArray(f.options) ? f.options.map(o => (o && typeof o === 'object' ? o.key : o)) : undefined })),
    styles: stileFuerMotto(m)
  }));
}
function stileFuerMotto(m) {
  return STYLE_KEYS.filter(k => !STYLES[k].off && (!STYLES[k].nurMotto || STYLES[k].nurMotto.includes(m.slug)));
}
// Antwort des Modells pruefen: nur bekannte Felder, Auswahl nur aus den Optionen, Laenge wie im Motto.
function wunschSauber(roh, liste, text) {
  const m = liste.find(x => x.slug === (roh && roh.slug)) || liste.find(x => x.slug === 'freestyle');
  const values = {};
  for (const f of (m.fields || [])) {
    const v0 = roh && roh.values && roh.values[f.key];
    if (v0 == null || v0 === '') continue;
    if (f.type === 'select' || f.type === 'wahl') {
      const keys = (f.options || []).map(o => (o && typeof o === 'object' ? o.key : o));
      if (keys.includes(String(v0))) values[f.key] = String(v0);
      continue;
    }
    const v = (f.type === 'textarea' ? cleanLong : cleanValue)(v0, f.max || 120);
    if (v) values[f.key] = v;
  }
  // 6. Okt.: bei Freestyle steht im Wunschfeld immer der VOLLE Wunsch - nie eine gekuerzte Fassung des Textmodells.
  if (m.slug === 'freestyle') values.motiv = cleanLong(text, 5000) || values.motiv || '';
  const stile = stileFuerMotto(m);
  const style = stile.includes(roh && roh.style) ? roh.style : (stile[0] || 'standard');
  const textile = TEXTILTOENE.includes(roh && roh.textile) ? roh.textile : 'weiss';
  const daten = { slug: m.slug, at: Date.now(), values, style, textile, wunsch: text };
  if (m.slug === 'freestyle') {
    // 6. Okt., live: "Ein Hoodie mit ..." wurde als T-Shirt eingetragen - der Artikel kommt jetzt aus dem Wunsch (der zuerst
    // genannte zaehlt), sonst T-Shirt. Textil: Mass "Brust gross" (CLAUDE.md 19); sonst die erste Flaeche (Kissen: 40 x 40).
    artikelSetzen(daten, wunschArtikel(text));
  }
  return daten;
}
// Der Artikel am Wunsch: bei Freestyle Artikel, Flaeche und Mass (Textil "Brust gross", sonst die erste Flaeche - Kissen 40 x 40);
// bei einem Motto nur der Artikel - die Mottoseite oeffnet dann mit ?artikel= (keine Textilfragen bei Kissen & Co., Regel 45).
function artikelSetzen(daten, aid) {
  if (!aid || !ARTIKEL[aid]) return;
  if (daten.slug !== 'freestyle') { daten.artikelLink = aid; return; }
  const fl = Object.keys(flaechenVon(aid));
  daten.artikelId = aid; delete daten.flaeche; delete daten.breiteCm; delete daten.hoeheCm;
  if (ARTIKEL[aid].verfahren === 'dtf') { daten.flaeche = fl.includes('vorne') ? 'vorne' : fl[0] || ''; daten.breiteCm = 28; daten.hoeheCm = 20; }
  else if (fl[0]) daten.flaeche = fl[0];
}
const WUNSCH_ARTIKEL = [
  ['hoodie', /\b(hoodies?|hoody|kapuzen\w*|zip-?hoodies?|sweatshirts?|pullis?|pullover)\b/i],
  ['tshirt', /\b(t-?shirts?|shirts?|tees?|trikots?)\b/i],
  ['strandtuch', /\bstrand(hand)?t(u|ü)ch\w*/i],
  ['handtuch', /\bhandt(u|ü)ch\w*/i],
  ['kissen', /\b\w*kissen\b/i],
  ['thermobecher', /\b(thermobecher\w*|tumbler\w*)/i],
  ['tasse', /\b(tassen?|becher|kaffeebecher)\b/i],
  ['trinkflasche', /\b(trinkflaschen?|flaschen?)\b/i],
  ['cap', /\b(caps?|basecaps?|kappen?|m(u|ü)tzen?)\b/i],
  ['shopper', /\b(shopper|jutebeutel|beutel|stoffbeutel|tragetaschen?|taschen?)\b/i],
  ['schuerze', /\bsch(u|ü)rzen?\b/i],
  ['socken', /\bsocken\b/i],
  ['mousepad', /\bmouse-?pads?\b/i],
  ['hundedecke', /\bhundedecken?\b/i],
  ['fussmatte', /\bfu(ss|ß)matten?\b/i],
  ['puzzle', /\bpuzzles?\b/i],
  ['poster', /\bposter\b/i],
  ['sticker', /\b(sticker|aufkleber)\b/i],
];
function wunschArtikel(text) {
  let best = null;
  for (const [id, re] of WUNSCH_ARTIKEL) {
    if (!ARTIKEL[id] || !verkaufsfaehig(id)) continue;
    const t = re.exec(String(text || ''));
    if (t && (!best || t.index < best.index)) best = { id, index: t.index };
  }
  return best ? best.id : 'tshirt';
}
app.post('/api/mo/wunsch', async (req, res) => {
  const text = cleanLong((req.body || {}).text, 5000);   // 6. Okt.: nicht mehr bei 400 Zeichen abschneiden
  if (!text || text.length < 3) return res.status(400).json({ error: 'wunsch fehlt', hinweis: 'Sag Otto kurz, was drauf soll.' });
  const verbotenFest = verboten.pruefeTexte([text]);
  const verbotenKi = verbotenFest ? Promise.resolve([]) : verbotenFinden(text);   // laeuft parallel zum Lesen des Wunsches
  const liste = await mottos.all();
  // 6. Okt., Otto-Weg (/otto): hat der Kunde das Motto schon angetippt, fuellt das Textmodell nur noch dieses aus
  const festSlug = String((req.body || {}).slug || '').replace(/[^a-z0-9-]/g, '');
  const katalogAlle = wunschKatalog(liste);
  const katalog = festSlug && katalogAlle.some(k => k.slug === festSlug) ? katalogAlle.filter(k => k.slug === festSlug) : katalogAlle;
  let roh = null;
  if (openai && env.QA_MODEL && !process.env.ABNAHME) {
    try {
      const antwort = await openai.chat.completions.create({ model: env.QA_MODEL, messages: [
        { role: 'system', content: WUNSCH_LESEN },
        { role: 'user', content: 'WISH: ' + text + '\nCATALOGUE: ' + JSON.stringify(katalog) }] });
      roh = JSON.parse(String(antwort.choices[0].message.content || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch (e) { console.error('Wunsch lesen:', e && e.message ? e.message : e); roh = null; }
  }
  const kandidaten = liste.filter(m => katalog.some(k => k.slug === m.slug));
  if (festSlug && katalog.length === 1) roh = Object.assign({}, roh || {}, { slug: festSlug });
  let daten = wunschSauber(roh, kandidaten, text);
  const festArtikel = String((req.body || {}).artikelId || '').replace(/[^a-z0-9_-]/g, '');
  if (festArtikel && ARTIKEL[festArtikel] && verkaufsfaehig(festArtikel)) artikelSetzen(daten, festArtikel);
  // 6. Okt., Markus: "wenn gesperrte Woerter drin sind, dass wir gar nicht anfangen zu produzieren ... Kunden direkt drauf
  // hinweisen, ganz lieb und nett. Wir koennen das hoechstens im aehnlichen Stil machen. Dann kurze Abfrage, ob ja oder nein."
  // Also: geschuetzter Name (feste Liste oder Text-KI) -> nichts ablegen, nichts malen, die Seite fragt. Erst mit ausweg: true
  // (der Kunde hat Ja gesagt) wird der Wunsch frei nachempfunden - immer als Dein Freestyle, der Artikel bleibt der genannte.
  // Verbotenes zuerst - ohne Ausweg, ohne "im aehnlichen Stil" (feste Liste, dann die Text-KI im Zusammenhang)
  {
    const fest = verbotenFest;
    const ki = await verbotenKi;
    if (fest || ki.length) {
      await verbotenMerken({ quelle: fest ? 'wunsch' : 'wunsch-ki', wort: fest ? fest.wort : ki.join(', '), eingabe: text.slice(0, 200), motto: daten.slug, req });
      return res.status(400).json({ error: 'verboten', hinweis: VERBOTEN_HINWEIS });
    }
  }
  const mWunsch = liste.find(m => m.slug === daten.slug);
  if (!markenFrei(mWunsch)) {
    const fest = marken.checkAll([text], null, markenKontext(mWunsch || {}, daten.values || {}));
    // die feste Liste meldet das Wort normalisiert (ADIDAS) - gezeigt wird es so, wie der Kunde es geschrieben hat
    const wieGeschrieben = (w) => { const m = new RegExp(String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]*'), 'i').exec(text); return m ? m[0] : w; };
    const namen = fest ? [wieGeschrieben(fest.wort)] : await geschuetztFinden(text);
    if (namen.length) {
      const wort = namen.join(', ');
      if (!(req.body || {}).ausweg) {
        await verbotenMerken({ quelle: 'marke-wunsch', wort, eingabe: text.slice(0, 200), motto: daten.slug, req });
        return res.status(409).json({ frage: 'marke', wort, hinweis: markeFrageText(namen[0]) });
      }
      const aus = await markeAuswegBauen(text, wort, cleanValue((req.body || {}).eigen, 60) || '');
      if (!aus) return res.status(422).json({ error: 'kein ausweg', wort, hinweis: 'Dafür finde ich leider keine freie Fassung. Sag mir deinen Wunsch einfach noch einmal ohne „' + namen[0] + '“ – den Look bekommen wir trotzdem hin.' });
      const art = wunschSauber({ slug: 'freestyle' }, kandidaten, text);
      daten = wunschSauber({ slug: 'freestyle', style: roh && roh.style, textile: roh && roh.textile }, kandidaten, aus.wunsch);
      for (const k of ['artikelId', 'flaeche', 'breiteCm', 'hoeheCm']) { if (art[k] != null) daten[k] = art[k]; else delete daten[k]; }
      daten.wunsch = text;
      daten.markeHinweis = { wort, text: aus.text, original: text };
    }
  }
  const id = crypto.randomBytes(12).toString('hex');
  try {
    await fs.mkdir(WUNSCH_DIR, { recursive: true });
    await fs.writeFile(path.join(WUNSCH_DIR, id + '.json'), JSON.stringify(daten));
  } catch (e) { console.error('Wunsch ablegen:', e && e.message ? e.message : e); return res.status(500).json({ error: 'ablage' }); }
  console.log('Wunsch:', id, '·', JSON.stringify(text).slice(0, 160), '->', daten.slug, '·', daten.style, '·', daten.textile, '·', JSON.stringify(daten.values).slice(0, 200), roh ? '' : '(ohne Textmodell)');
  res.json({ slug: daten.slug, ziel: '/m/' + daten.slug + '?wunsch=' + id + (daten.artikelLink ? '&artikel=' + encodeURIComponent(daten.artikelLink) : '') });
});
// ---- Der Otto-Weg (/otto). 6. Okt., Markus: "wenn ich sage mit dem zaubern und der sagt ich moechte ein Hoodie zum Beispiel,
// dann muesste eigentlich die Frage kommen: Magst du das fuer 'ne Gruppe, als Geschenk oder fuer dich selber ... und danach muesste
// es sich logisch aufbauen." Und: "Jeder Weg ... logisch ineinander aufgebaut, so dass es keinen Grund gibt, die Seite zu verlassen."
// Grundregel: Otto fragt nie, was der Kunde schon gesagt hat. Dieses Lesen holt aus dem Gesagten nur die Weichen - Artikel, fuer wen,
// Anlass (Motto) und ob schon eine eigene Idee drinsteckt. Ausgefuellt wird spaeter wie bisher (/api/mo/wunsch, mit dem Motto fest).
const OTTO_LESEN = 'A customer talks to a German print shop assistant. From what the customer said, extract only what is clearly stated. '
  + 'You get the text, the list of products (id: name) and the list of occasions/themes (slug: name). Answer ONLY as JSON: '
  + '{"artikel": product id or null, "fuer": "gruppe" (for a group, team, club, class, crew, several people wearing it) | "geschenk" (a gift for someone) | "selbst" (for themselves) | null, '
  + '"motto": theme slug or null (only if the occasion clearly matches one theme; never "freestyle"), '
  + '"idee": true if the text already describes WHAT should be on the design (a motif, slogan, picture, colours, names) beyond just the product and occasion, else false}. '
  + 'A birthday present for someone = fuer "geschenk", motto "geburtstag". A stag/hen party = "junggesellenabschied" and fuer "gruppe". Do not guess - null when unsure.';
const OTTO_FUER = [
  ['gruppe', /\b(f(ü|ue)r (die|unsere|unseren|meine|meinen|den|das) (gruppe|truppe|crew|team|mannschaft|klasse|verein|stufe|jungs|m(ä|ae)dels|kollegen|firma)|f(ü|ue)r uns alle|f(ü|ue)r alle|gruppe|truppe|crew)\b/i],
  ['geschenk', /\b(geschenk|verschenken|schenken|als (ü|ue)berraschung|f(ü|ue)r (meine|meinen|mein|unsere|unseren) (mama|papa|mutter|vater|oma|opa|schwester|bruder|frau|mann|freundin|freund|tochter|sohn|kind|chef|chefin|kollegin|kollegen|nichte|neffen|enkel\w*|patenkind))\b/i],
  ['selbst', /\b(f(ü|ue)r mich( selbst| selber)?|f(ü|ue)r mich alleine|mir selbst|selber tragen|f(ü|ue)r dich selber|ich selber)\b/i],
];
function ottoLesenFest(text, liste) {
  const t = String(text || '');
  let artikel = null, best = Infinity;
  for (const [id, re] of WUNSCH_ARTIKEL) {
    if (!ARTIKEL[id] || !verkaufsfaehig(id)) continue;
    const m = re.exec(t); if (m && m.index < best) { best = m.index; artikel = id; }
  }
  let fuer = null; for (const [k, re] of OTTO_FUER) if (re.test(t)) { fuer = k; break; }
  let motto = null;
  const flach = (x) => String(x || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const tf = flach(t);
  const NAMEN = { abi: /\babi(tur)?\b/, junggesellenabschied: /\b(jga|junggesell\w*|polterabend)\b/, 'malle-fahrt': /\b(malle|mallorca|ballermann)\b/, geburtstag: /\bgeburtstag\w*|\b\d{1,3}\.? ?geburtstag/, hochzeit: /\bhochzeit\w*/, 'geburt-baby': /\b(geburt|baby|schwanger\w*)\b/, weihnachtsfeier: /\bweihnachtsfeier\b/, firmenausflug: /\bfirmen(ausflug|lauf|event)\b/, kegeltour: /\bkegel\w*/, bowling: /\bbowling\b/, darts: /\bdarts?\b/, karneval: /\b(karneval|fasching|fastnacht)\b/, abschlussfahrt: /\babschlussfahrt\b/, fanclub: /\bfan-?club\b/, vereinsjubilaeum: /\bvereinsjubil\w*/, 'angler-shirt': /\b(angler|angeln)\b/, 'jaeger-shirt': /\b(jaeger|jagd)\b/, 'motorrad-shirt': /\bmotorrad\w*/, 'landwirt-shirt': /\b(landwirt\w*|bauer|trecker|traktor)\b/, 'tier-shirt': /\b(hund|katze|haustier|pferd)\b/ };
  for (const [slug, re] of Object.entries(NAMEN)) if (re.test(tf) && liste.some(m => m.slug === slug)) { motto = slug; break; }
  if (motto && istGruppenMotto(motto) && !fuer && motto !== 'hochzeit') fuer = 'gruppe';
  // eine Idee steckt drin, wenn nach Abzug von Artikel, Anlass und Fuellwoertern noch etwas Eigenes uebrig ist
  const rest = tf.replace(/\b(ich|wir|moechte|mochte|will|wollen|haette|hatte|gern|gerne|bitte|einen?|eine[nmr]?|der|die|das|den|dem|ein|fuer|fur|ue|als|zum|zur|mit|und|oder|mir|uns|mein\w*|unser\w*|so|was|mal|noch|auch|machen|mach|design|motiv|drauf|shirt|t-shirt|tshirt|hoodie|kissen|geschenk|gruppe|selbst|selber)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const idee = rest.split(' ').filter(w => w.length > 2).length >= 3;
  return { artikel, fuer, motto, idee };
}
app.post('/api/mo/otto-lesen', async (req, res) => {
  const text = cleanLong((req.body || {}).text, 2000) || '';
  const liste = (await mottos.all()).filter(m => inMottoListe(m) && !m.hausTextil && !m.artikelFest && !m.freestyle);
  const fest = ottoLesenFest(text, liste);
  if (!text || !openai || !env.QA_MODEL || process.env.ABNAHME) return res.json(fest);
  try {
    const artikelListe = Object.values(artikelAuswahl()).flat().map(a => a.id + ': ' + a.name).join(', ');
    const r = await openai.chat.completions.create({ model: env.QA_MODEL, ...SCHNELL(), messages: [
      { role: 'system', content: OTTO_LESEN },
      { role: 'user', content: 'TEXT: ' + text + '\nPRODUCTS: ' + artikelListe + '\nTHEMES: ' + liste.map(m => m.slug + ': ' + m.name).join(', ') }] });
    const j = JSON.parse(String(r.choices[0].message.content || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    const out = {
      artikel: j.artikel && ARTIKEL[j.artikel] && verkaufsfaehig(j.artikel) ? j.artikel : fest.artikel,
      fuer: ['gruppe', 'geschenk', 'selbst'].includes(j.fuer) ? j.fuer : fest.fuer,
      motto: j.motto && liste.some(m => m.slug === j.motto) ? j.motto : fest.motto,
      idee: typeof j.idee === 'boolean' ? j.idee : fest.idee,
    };
    res.json(out);
  } catch (e) { console.error('Otto lesen:', e && e.message ? e.message : e); res.json(fest); }
});
app.get('/otto', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.resolve('otto.html')); });
// 6. Okt., Markus: "Ich hoffe, du hast auch die Text-KI dazu gemacht, genauso wie beim Trikot-Konfigurator." Eingesprochener
// Text kommt mit Versprechern, ohne Satzzeichen und mit falsch erkannten Woertern an. Die Text-KI zieht ihn glatt - und
// KUERZT NICHTS: jedes Detail, jeder Name, jede Farbe, jede Zahl bleibt. Die Seite zeigt danach "Original" zum Zuruecknehmen.
const TEXT_GLAETTEN = 'Du bekommst einen eingesprochenen Text (Spracherkennung). Es ist der Wunsch eines Kunden fuer ein Design (T-Shirt, Kissen, Tasse ...). Gib den Text sauber zurueck:\n'
  + '- Rechtschreibung, Gross- und Kleinschreibung und Satzzeichen berichtigen.\n'
  + '- Fuellwoerter (aehm, also, halt, sozusagen), Versprecher, doppelt gesagte Woerter und Selbstkorrekturen ("nein, ich meine ...") entfernen - bei einer Selbstkorrektur gilt das Korrigierte.\n'
  + '- Offensichtlich falsch erkannte Woerter nach dem Sinn richtig stellen.\n'
  + '- NICHTS kuerzen, NICHTS zusammenfassen, NICHTS weglassen: jedes Motiv, jedes Detail, jeder Name, jeder Spruch, jede Farbe, jede Zahl, jedes Datum bleibt. Woertlich gemeinte Sprueche und Namen genau so lassen, wie gesagt.\n'
  + '- NICHTS dazuerfinden, keine Vorschlaege, keine Erklaerung. In der Sprache des Originals bleiben.\n'
  + 'Antworte NUR mit dem bereinigten Text.';
app.post('/api/mo/text-glaetten', async (req, res) => {
  const text = cleanLong((req.body || {}).text, 5000);
  if (text === null) return res.status(400).json({ error: 'text' });
  if (!text || text.length < 3 || !openai || !env.QA_MODEL || process.env.ABNAHME) return res.json({ text: text || '', unveraendert: true });
  try {
    const r = await openai.chat.completions.create({ model: env.QA_MODEL, ...SCHNELL(), messages: [{ role: 'system', content: TEXT_GLAETTEN }, { role: 'user', content: text }] });
    let neu = String((r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || '').trim().replace(/^"|"$/g, '');
    // Sicherung gegen Kuerzen: deutlich kuerzer als das Original (unter 60 %) = nicht verwenden
    if (!neu || neu.length < text.length * 0.6) return res.json({ text, unveraendert: true });
    neu = cleanLong(neu, 5000) || text;
    res.json({ text: neu, unveraendert: neu === text });
  } catch (e) { console.error('Text glaetten:', e && e.message ? e.message : e); res.json({ text, unveraendert: true }); }
});
// 6. Okt., Markus (Hoodie per Freestyle eingesprochen, "Blues Brothers" - berechtigt gesperrt): "Jetzt waere es ja schoen,
// dass wir das in dem Stil machen, dass es ansatzweise so aussieht, aber ohne dass es rechtliche Probleme gibt."
// Ausweg statt Sackgasse: die Text-KI schreibt den Wunsch um - geschuetzter Name, Logo, Schriftzug und Figuren raus, der LOOK
// bleibt als allgemeine Beschreibung (Epoche, Musikrichtung, Farben, Schriftart-Typ, typische Requisiten), der Text ist der
// eigene des Kunden. Danach laeuft die Markenpruefung noch einmal; angeboten wird nur, was dort durchkommt.
// Der Satz, den der Kunde liest (und Otto sagt), wenn ein geschuetzter Name drin ist - lieb, ohne Vorwurf, mit dem Angebot.
function markeFrageText(wort) {
  return 'Oh, „' + wort + '“ ist geschützt – das dürfen wir leider nicht drucken. Ich kann dir aber etwas im ähnlichen Stil machen, ganz ohne das. Möchtest du das?';
}
const MARKE_AUSWEG = 'Ein Kunde wuenscht sich ein Design (T-Shirt, Hoodie ...), sein Wunsch nennt aber einen geschuetzten Namen (Marke, Band, Film, Verein, Figur). Schreib den Wunsch so um, dass das Design an den LOOK erinnert, aber rechtlich frei ist:\n'
  + '- Den geschuetzten Namen und alle Namen von Figuren, Schauspielern, Musikern und Firmen komplett weglassen.\n'
  + '- Kein Logo, kein Wappen, kein nachgemachter Original-Schriftzug, keine Figur, die einer echten Person oder einer bekannten Filmfigur aehnelt.\n'
  + '- Auch keine Bildmarke ohne Namen: keine parallelen Streifen, Linien, Paspeln oder Naehte an Aermeln, Seiten oder Schultern - egal wie viele -, kein Swoosh/Haken, keine springende Raubkatze, kein Krokodil, kein Doppel-C, kein Markenmuster. Wir drucken nur das Motiv, Aermel und Schnitt bleiben, wie sie sind. Sportlicher Look geht ueber Farben, Nummern, Schrift und das Motiv selbst.\n'
  + '- Stattdessen den Stil ALLGEMEIN beschreiben: Epoche, Musik- oder Filmgenre, Stimmung, Farben, Art der Schrift (z. B. kraeftige Retro-Blockschrift), typische Requisiten und Kleidung als allgemeine Elemente (z. B. zwei Musiker in schwarzen Anzuegen mit Hut und Sonnenbrille, nur als Silhouetten).\n'
  + '- Als Text auf dem Design steht GENAU der eigene Text des Kunden, wenn er einen nennt; sonst schlag einen eigenen, freien Text vor, der zum Wunsch passt (z. B. mit Ort oder Vornamen), ohne den geschuetzten Namen.\n'
  + '- Alles andere aus dem Wunsch (Artikel, Farben, Anlass, weitere Details) bleibt.\n'
  + 'Antworte NUR als JSON: {"wunsch": "der umgeschriebene Wunsch auf Deutsch", "text": "der Text, der auf dem Design steht"}';
// Geschuetzte Namen im Wunsch finden - nicht nur unsere feste Liste (marken.js), sondern alles, was ein Mensch erkennt:
// Marken, Bands, Filme, Serien, Vereine, Figuren, Prominente. Live am 6. Okt.: "Blues Brothers" stand in keiner Liste, das
// Bild wurde gemalt und erst die Bildpruefung am fertigen Design sperrte - sieben Minuten und drei Bilder umsonst.
// 6. Okt.: Rueckfragen, auf die jemand wartet (Gespraech, Text-KI, Marken-Ausweg), mit minimaler Denk-Tiefe - live dauerte der
// Ausweg sonst ueber 30 Sekunden. Nur fuer Modelle, die das kennen (gpt-5*, o*).
const SCHNELL = () => (/^(gpt-5|o\d)/.test(String(env.QA_MODEL || '')) ? { reasoning_effort: 'minimal' } : {});
// 6. Okt., live: mit minimaler Denk-Tiefe hielt die Pruefung "Hamburger Skyline" und den frei erfundenen Bandnamen
// "Harmstorf Brothers" fuer geschuetzt - jeder Ausweg fiel durch. Darum: nur ECHTE, bekannte Namen, Beispiele fuer das, was
// nicht zaehlt, und hier etwas mehr Denk-Tiefe (eine Sperre darf nicht raten).
const GESCHUETZT_FINDEN = 'Nenne alle geschuetzten Namen in diesem Designwunsch: Marken und Firmen, Bands und Musiker, Filme, Serien, Spiele, Sportvereine und Ligen, Comic- und Filmfiguren, Prominente. Nur Namen, die es WIRKLICH gibt und die bekannt sind. Dazu gehoeren auch BILDMARKEN, die jemand ohne Namen beschreibt: drei parallele Streifen im Sportmarken-Stil (Adidas-Streifen), der Swoosh bzw. Nike-Haken, die springende Raubkatze (Puma), das Krokodil (Lacoste), der Polospieler (Ralph Lauren), das verschlungene Doppel-C (Chanel), das LV-Monogramm, das Burberry-Karo, der angebissene Apfel (Apple) - dann den Namen so nennen, z. B. "Adidas-Streifen" oder "Nike-Swoosh". NICHT dazu: Orte, Staedte, Stadtteile, Sehenswuerdigkeiten und alles, was daraus gebildet ist (z. B. Hamburger Skyline, Kieler Woche, Elbphilharmonie), normale Vor- und Nachnamen, Familien-, Firmen- oder Gruppennamen, die erkennbar selbst erfunden sind (z. B. Harmstorf Brothers, Familie Meier Crew, Schulze Sisters), allgemeine Begriffe, Stile und Genres (z. B. Feuerwehr, Fussball, Brueder, Blues, Retro, Kneipe). Im Zweifel NICHT nennen. Antworte NUR als JSON: {"namen": ["..."]} - leer, wenn keiner vorkommt.';
const GRUENDLICH = () => (/^(gpt-5|o\d)/.test(String(env.QA_MODEL || '')) ? { reasoning_effort: 'low' } : {});
async function geschuetztFinden(text) {
  if (!openai || !env.QA_MODEL || process.env.ABNAHME || !text) return [];
  try {
    const r = await openai.chat.completions.create({ model: env.QA_MODEL, ...GRUENDLICH(), messages: [{ role: 'system', content: GESCHUETZT_FINDEN }, { role: 'user', content: String(text).slice(0, 5000) }] });
    const j = JSON.parse(String(r.choices[0].message.content || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    return (Array.isArray(j.namen) ? j.namen : []).map(n => cleanValue(n, 80)).filter(Boolean).slice(0, 5);
  } catch (e) { console.error('Geschuetzt finden:', e && e.message ? e.message : e); return []; }
}
// 6. Okt., Markus: "Hast du eigentlich auch alle Woerter, die auf dem Index stehen?" - "Ja, aber sie kann natuerlich auch im
// Sport Bezug sein." Die feste Liste (verboten.js) traegt nur Eindeutiges; Codes, die erst im Zusammenhang verboten sind (Zahlen,
// Szene-Kuerzel, indizierte Bands und Lieder, Parolen in Abwandlung - auch aus der Hooligan- und Fanszene), sucht die Text-KI.
// Normale Sportangaben bleiben frei: Rueckennummern, Jahreszahlen, Alter, Gruendungsjahre, "Ultras", "Hooligans", ACAB.
const VERBOTEN_FINDEN = 'Pruefe diesen Text fuer ein bedrucktes Textil in Deutschland. Finde NUR, was strafbar oder jugendgefaehrdend ist: Kennzeichen und Parolen verfassungswidriger oder terroristischer Organisationen (Paragraf 86a StGB) auch in Abwandlung oder als Code, Volksverhetzung (Paragraf 130 StGB), rechtsextreme Zahlen- und Buchstabencodes, Namen verbotener Organisationen, indizierte rechtsextreme Bands und Liedtitel, antisemitische oder rassistische Codes - AUCH aus der Hooligan- und Fussballszene. Achte auf den ZUSAMMENHANG: Eine Zahl allein (88, 18, 14, 28, 444) ist als Rueckennummer, Alter, Jahrgang, Hausnummer, Ergebnis oder Gruendungsjahr harmlos - nur zusammen mit eindeutigem Bezug (Heil, Gruss, Reich, weiss, Kameraden, Rasse, Hakenkreuz u. ae.) ein Treffer. Harmlos sind auch: Ultras, Hooligans, Pyro, ACAB, Fan- und Vereinsnamen, Wikinger, Runen als Deko, Totenkopf, Krieger, Kampf im Sport. Im Zweifel NICHT melden. Antworte NUR als JSON: {"treffer": ["das gefundene Wort oder die Wortfolge"]} - leer, wenn nichts davon vorkommt.';
async function verbotenFinden(text) {
  if (!openai || !env.QA_MODEL || process.env.ABNAHME || !text) return [];
  try {
    const r = await openai.chat.completions.create({ model: env.QA_MODEL, ...GRUENDLICH(), messages: [{ role: 'system', content: VERBOTEN_FINDEN }, { role: 'user', content: String(text).slice(0, 5000) }] });
    const j = JSON.parse(String(r.choices[0].message.content || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    return (Array.isArray(j.treffer) ? j.treffer : []).map(n => cleanValue(n, 80)).filter(Boolean).slice(0, 5);
  } catch (e) { console.error('Verboten finden:', e && e.message ? e.message : e); return []; }
}
const VERBOTEN_HINWEIS = 'Das können wir nicht drucken. Verfassungsfeindliche Zeichen und Parolen sind in Deutschland strafbar – auch auf Kleidung. Bitte nimm einen anderen Text oder ein anderes Motiv.';
async function markeAuswegBauen(text, wort, eigen) {
  if (!openai || !env.QA_MODEL || process.env.ABNAHME) return null;
  for (let versuch = 1; versuch <= 2; versuch++) {
    try {
      const r = await openai.chat.completions.create({ model: env.QA_MODEL, ...SCHNELL(), messages: [
        { role: 'system', content: MARKE_AUSWEG },
        { role: 'user', content: 'WUNSCH: ' + text + '\nGESCHUETZT: ' + (wort || '(siehe Wunsch)') + '\nEIGENER TEXT DES KUNDEN: ' + (eigen || '(keiner)') + (versuch > 1 ? '\nACHTUNG: Der erste Vorschlag enthielt noch einen geschuetzten Namen. Lass ihn diesmal ganz weg.' : '') }] });
      const j = JSON.parse(String(r.choices[0].message.content || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
      const wunsch = cleanLong(j.wunsch, 5000), auf = cleanValue(eigen || j.text, 60) || '';
      if (!wunsch) continue;
      const hit = marken.checkAll([wunsch, auf], null, []);
      if (hit) { console.log('Marke-Ausweg: noch geschuetzt (' + hit.wort + '), Versuch ' + versuch); continue; }
      // die urspruenglich gefundenen Namen duerfen nicht mehr vorkommen - auch nicht ohne Leerzeichen/Bindestrich
      const flach = v => String(v || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '');
      const rest = String(wort || '').split(/\s*,\s*/).map(flach).filter(w => w.length >= 3 && flach(wunsch + ' ' + auf).includes(w));
      if (rest.length) { console.log('Marke-Ausweg: noch drin (' + rest.join(', ') + '), Versuch ' + versuch); continue; }
      // dann die offene Pruefung - was der Kunde selbst als Text vorgibt, zaehlt dort nicht (die feste Liste hat ihn oben schon geprueft)
      const nochmal = (await geschuetztFinden(wunsch + ' ' + auf)).filter(n => !(eigen && flach(eigen).includes(flach(n))));
      if (nochmal.length) { console.log('Marke-Ausweg: Text-KI findet noch', nochmal.join(', ') + ', Versuch ' + versuch); continue; }
      console.log('Marke-Ausweg:', JSON.stringify(wort), '->', JSON.stringify(auf), '·', JSON.stringify(wunsch).slice(0, 160));
      return { wunsch: auf && !wunsch.includes(auf) ? wunsch + ' Text auf dem Design: „' + auf + '“.' : wunsch, text: auf };
    } catch (e) { console.error('Marke-Ausweg:', e && e.message ? e.message : e); }
  }
  return null;
}
app.post('/api/mo/marke-ausweg', async (req, res) => {
  const text = cleanLong((req.body || {}).text, 5000);
  const wort = cleanValue((req.body || {}).wort, 80) || '';
  const eigen = cleanValue((req.body || {}).eigen, 60) || '';
  if (!text) return res.status(400).json({ error: 'text' });
  if (eigen) { const hit0 = marken.checkAll([eigen], null, []); if (hit0) return res.status(400).json({ error: 'marke', wort: hit0.wort, hinweis: '„' + hit0.wort + '" ist auch geschützt – bitte einen anderen eigenen Text.' }); }   // die Text-KI prueft ihn danach mit dem ganzen Vorschlag
  if (!openai || !env.QA_MODEL || process.env.ABNAHME) return res.status(503).json({ error: 'textmodell', hinweis: 'Das geht gerade nicht – bitte den Wunsch ohne den geschützten Namen eintippen.' });
  const aus = await markeAuswegBauen(text, wort, eigen);
  if (aus) return res.json(aus);
  res.status(422).json({ error: 'kein ausweg', hinweis: 'Dafür finde ich keine freie Fassung – bitte den Wunsch ohne den geschützten Namen eintippen.' });
});
app.get('/api/mo/wunsch/:id', async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^[a-f0-9]{24}$/.test(id)) return res.status(404).json({ error: 'unbekannt' });
  try {
    const d = JSON.parse(await fs.readFile(path.join(WUNSCH_DIR, id + '.json'), 'utf8'));
    if (Date.now() - d.at > WUNSCH_MAX_MS) return res.status(410).json({ error: 'abgelaufen' });
    res.set('Cache-Control', 'no-store').json(d);
  } catch (e) { res.status(404).json({ error: 'unbekannt' }); }
});
setTimeout(async function wunschAufraeumen() {
  try { for (const f of await fs.readdir(WUNSCH_DIR)) { const st = await fs.stat(path.join(WUNSCH_DIR, f)); if (Date.now() - st.mtimeMs > WUNSCH_MAX_MS) await fs.rm(path.join(WUNSCH_DIR, f), { force: true }); } }
  catch (e) { if (e && e.code !== 'ENOENT') console.error('Wunsch aufraeumen:', e.message); }
  setTimeout(wunschAufraeumen, 3600e3);
}, 5 * 60e3);

// 5. Okt. abends, Markus: "Wir muessen Freestyle viel, viel einfacher machen ... Stil auswaehlen passt ueberhaupt nicht. Die Leute
// sollen einfach nur einsprechen ... und dann bauen wir ne Bruecke dahinter". Freestyle mit einfach:true fragt nur noch Artikel und
// Wunsch (motiv, eingesprochen oder getippt). Die Bruecke liest den Wunsch und fuellt, was frueher eigene Fragen waren: grosser und
// kleiner Text (nur, was der Kunde wirklich gesagt hat), was nicht drauf soll, wofuer, Stil und Stoff. Ohne Textmodell bleibt der
// Wunsch allein das Motiv, der Stil 'standard', der Stoff weiss. Die Groesse ist auf dem Textil "Brust gross" (28 x 20, CLAUDE.md 19).
const FREESTYLE_LESEN = 'You read a customer wish for a personalised print and fill the remaining order fields of a German shop. '
  + 'You get the wish (German, maybe spoken and unpunctuated), the product, the options for "wofuer" and the allowed styles. '
  + '"text_gross": the main words the customer wants PRINTED, spelled exactly as said (a name, a slogan, a number) - only if the wish asks for words on the print, else "". Max 40 characters. '
  + '"text_klein": a second smaller line exactly as said (e.g. a date or a sub line), else "". Max 60 characters. '
  + '"vermeiden": what the customer explicitly does NOT want, else "". '
  + '"wofuer": one of the given options exactly. '
  + '"style": one key from the allowed styles that matches the wished look; if the wish names no look, the key that suits the subject best. '
  + '"textile": "schwarz" only if the customer asks for a black or dark garment, otherwise "weiss". '
  // 19. Okt. (Markus): ein Foto oder eine Datei zum Wunsch - was damit passieren soll, steht im Wunsch selbst.
  + '"foto": only if PHOTO ATTACHED is yes: "aendern" when the wish describes changing the photo or what is on it (add something, dress it up, put it somewhere else, make it look like ...) or says nothing about how to use it; '
  + '"original" when the customer wants the photo itself, unchanged, on the product; "nachzeichnen" when they ask for a drawing or painting made after the photo. Else "". '
  + 'Never invent names, dates or slogans. Answer ONLY with JSON: {"text_gross":"","text_klein":"","vermeiden":"","wofuer":"","style":"","textile":"","foto":""}';
async function freestyleBruecke(body, motto, mitFoto = false) {
  const v = body.values;
  const feld = (k) => motto.fields.find(f => f.key === k) || {};
  const a = ARTIKEL[String(body.artikelId || '')];
  if (a && a.verfahren === 'dtf' && !body.breiteCm && !body.hoeheCm && !(flaechenVon(String(body.artikelId))[String(body.flaeche || '')])) { body.breiteCm = 28; body.hoeheCm = 20; }
  body.textile = 'weiss';   // die Seite fragt den Stoff nicht mehr - Weiss, ausser der Wunsch sagt Schwarz (unten)
  const stile = stileFuerMotto(motto);
  let roh = null;
  if (openai && env.QA_MODEL && !process.env.ABNAHME) {
    try {
      const antwort = await openai.chat.completions.create({ model: env.QA_MODEL, messages: [
        { role: 'system', content: FREESTYLE_LESEN },
        { role: 'user', content: 'WISH: ' + String(v.motiv || '').slice(0, 5000) + '\nPRODUCT: ' + (a ? a.name : 'T-Shirt') + '\nPHOTO ATTACHED: ' + (mitFoto ? 'yes' : 'no')
          + '\nWOFUER OPTIONS: ' + JSON.stringify(feld('wofuer').options || []) + '\nSTYLES: ' + JSON.stringify(stile.map(k => ({ key: k, label: STYLES[k].label, desc: STYLES[k].desc }))) }] });
      roh = JSON.parse(String(antwort.choices[0].message.content || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch (e) { console.error('Freestyle-Bruecke:', e && e.message ? e.message : e); roh = null; }
  }
  if (roh && typeof roh === 'object') {
    for (const k of ['text_gross', 'text_klein', 'vermeiden']) {
      if (String(v[k] || '').trim() || typeof roh[k] !== 'string' || !roh[k].trim()) continue;
      const c = cleanValue(roh[k], feld(k).max || 60); if (c) v[k] = c;
    }
    if ((feld('wofuer').options || []).includes(roh.wofuer)) v.wofuer = roh.wofuer;
    if ((!body.style || body.style === 'standard') && stile.includes(roh.style)) body.style = roh.style;
    if (roh.textile === 'schwarz') body.textile = 'schwarz';
  }
  // 19. Okt.: Mit Foto entscheidet der Wunsch, was damit passiert; ohne klare Ansage wird es nach dem Wunsch
  // VERAENDERT (Markus: "so dass diese geaendert werden kann"). Ohne Foto bleibt der Weg leer.
  if (mitFoto) {
    const weg = { aendern: 'veraendert', original: 'original', nachzeichnen: 'nachgebaut' }[roh && roh.foto] || 'veraendert';
    v.foto_modus = FOTO_MODUS_TEXT[weg];
    if (!String(v.foto_form || '').trim()) v.foto_form = feld('foto_form').default || 'Abgerundet';
  } else if (fotoModusVon(v.foto_modus)) v.foto_modus = 'Kein Foto';
  console.log('Freestyle-Bruecke:', JSON.stringify(String(v.motiv || '')).slice(0, 120), '->', body.style || 'standard', '·', body.textile, '·', JSON.stringify({ g: v.text_gross || '', k: v.text_klein || '', w: v.wofuer || '' }), roh ? '' : '(ohne Textmodell)');
}

app.post('/api/mo/upload', async (req, res) => {
  const dataUrl = String((req.body && req.body.dataUrl) || '');
  // Bewusst JEDER Datentyp: was wirklich lesbar ist, entscheidet normalizeUpload. Nur so kann
  // ein Kunde, der ein PDF hochlaedt, den Satz "PDF koennen wir nicht direkt lesen" bekommen
  // statt eines nichtssagenden "kein Bild".
  const m = dataUrl.match(/^data:([a-z0-9/+.-]*);base64,(.+)$/i);
  if (!m) return res.status(400).json({ error: 'kein Bild' });
  const raw = Buffer.from(m[2], 'base64');
  if (raw.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'zu gross' });
  try {
    const norm = await normalizeUpload(raw);
    // Ein hochgeladenes Logo geht bei mode 'exact' UNVERAENDERT in die Druckdatei - es kommt
    // nie an der Bild-KI vorbei. Diese Pruefung hier ist also die einzige. Sie laeuft darum
    // fuer JEDES Motto, auch fuer die von der Markensperre ausgenommenen (Fanclub, Handwerker):
    // dort ist das Vereins- oder Firmenlogo erlaubt, ein Hakenkreuz nicht.
    const forMotto = await mottos.get(String((req.body || {}).motto || '').replace(/[^a-z0-9-]/g, ''));
    // Firmenlogo (zweck 'firmenlogo', nur angemeldet): dieselbe Regel wie bei Fanclubs und
    // Handwerkern - ein Betrieb darf sein eigenes Logo drucken, auch wenn es als Marke geschuetzt
    // ist. Es IST seine Marke. Die Pruefung auf verbotene Zeichen bleibt davon unberuehrt.
    // Damit so eine Datei nicht als "Upload" in einem fremden Motto landet, bekommt sie den
    // Praefix fl_ und wird bei /generate nur als das eigene hinterlegte Firmenlogo angenommen.
    const who = await identify(req, res);
    const firmenlogo = String((req.body || {}).zweck || '') === 'firmenlogo' && !!who.user;
    // Fassung 37: ein FOTO als Vorlage (Motorrad, Trecker, Hoftier - upload.mode 'reference') wird
    // nicht gedruckt, sondern nachgezeichnet, und der Prompt verbietet dabei jede Marke. Die
    // Markensperre auf dem Foto selbst hat jedes Motorradfoto abgewiesen (Tank, Emblem) - Markus,
    // 14. Sept.: "Bei Motorrad haben wir gerade versucht, ein Bild hochzuladen, hat nicht funktioniert."
    // Verbotene Zeichen werden weiter geprueft; das fertige Motiv wird ohnehin noch einmal geprueft.
    const fotoVorlage = !!(forMotto && forMotto.upload && forMotto.upload.mode === 'reference');
    const markenPruefen = !firmenlogo && !fotoVorlage && !(forMotto && markenFrei(forMotto));
    let bildschirmWoerter = [];
    if (HAS_LLM) {
      let qa = null, fehler = null;
      const small = await sharp(norm.png).resize({ width: 768, fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
      // Zwei Anlaeufe: ein einzelner Aussetzer beim Pruefdienst darf kein ungeprueftes
      // Logo durchlassen, aber auch keinen Kunden grundlos abweisen.
      for (let versuch = 1; versuch <= 2 && !qa; versuch++) {
        try { qa = await textQA(small, [], { marken: markenPruefen }); }
        catch (e) { fehler = e; }
      }
      if (!qa) {
        // Lieber ein "bitte gleich noch einmal" als ein ungeprueftes Logo im Druck.
        console.error('Upload-Pruefung gescheitert:', fehler && fehler.message ? fehler.message : fehler);
        return res.status(503).json({ error: 'pruefung', hinweis: 'Wir konnten das Bild gerade nicht prüfen. Bitte in einem Moment noch einmal hochladen.' });
      }
      if (qa.verboten) {
        await verbotenMerken({ quelle: 'upload', wort: String(qa.verboten), eingabe: qa.verbotenText || '', motto: forMotto ? forMotto.slug : '', req });
        return res.status(400).json({ error: 'verboten', wort: String(qa.verboten) });
      }
      if (markenPruefen && !qa.pass && qa.marke) { await verbotenMerken({ quelle: 'marke-upload', wort: qa.marke, eingabe: qa.logo || 'hochgeladenes Bild', motto: forMotto ? forMotto.slug : '', req }); return res.status(400).json({ error: 'marke', wort: qa.marke, eingabe: 'Upload', hinweis: qa.logo || '' }); }
      // Fassung 69 (Markus, 16. Sept.): Ein Bildschirmfoto statt der Logodatei - die Adressleiste
      // landete als Schrift im Design. Erkennbar an dem, was die Bild-KI liest: eine Web-Adresse,
      // eine Uhrzeit, ein Prozentwert. Nicht sperren (ein Logo DARF eine Adresse enthalten),
      // sondern melden: die Seite zeigt den Hinweis, der Kunde entscheidet.
      bildschirmWoerter = (Array.isArray(qa.texts) ? qa.texts : [])
        .map(t => String(t).trim()).filter(t => BILDSCHIRM_WORT.test(t)).slice(0, 4);
      if (bildschirmWoerter.length) console.log('Upload sieht nach Bildschirmfoto aus:', bildschirmWoerter.join(' \u00b7 '));
    }
    const id = (firmenlogo ? 'fl_' : 'up_') + crypto.randomBytes(8).toString('hex') + '.png';
    // 6. Okt.: ein LOGO ohne echte Transparenz wird einmal hier freigestellt (logoFreistellen, unklare Loecher per
    // Bildpruefung) - das Original bleibt unveraendert daneben liegen (<id>.original.png). Alle spaeteren Schritte sehen
    // dann ein transparentes Logo und stellen nicht noch einmal frei. Fotos als Vorlage (mode 'reference') nicht.
    const istLogo = firmenlogo || (forMotto && forMotto.upload && forMotto.upload.mode === 'exact') || !forMotto;
    let gespeichert = norm.png;
    if (istLogo && !(await logoHatTransparenz(norm.png))) {
      try {
        const r = await mitBildarbeit('Logo freistellen ' + id, () => logoFreistellen(norm.png, { frage: HAS_LLM ? logoLochFragen : null }));
        if (r.sicher) { await fs.writeFile(path.join(STORE, 'uploads', id.replace(/\.png$/, '.original.png')), norm.png); gespeichert = r.png; }
        else console.warn('Logo freistellen', id + ':', r.grund, '- bleibt beim spaeteren Notnagel');
      } catch (e) { console.error('Logo freistellen', id + ':', e && e.message ? e.message : e); }
    }
    await fs.writeFile(path.join(STORE, 'uploads', id), gespeichert);
    // Fassung 35: Preflight. Die Datei wird trotzdem abgelegt - "Otto zeichnet das Logo sauber
    // nach" (/api/mo/upload/nachzeichnen) braucht sie als Vorlage. Ob ein unbrauchbares Logo
    // ins Design darf, entscheidet die Seite: sie nimmt es nicht an.
    // Preflight nur fuer Logos (mode 'exact' oder Firmenlogo) - ein Foto als Vorlage ist kein Logo.
    let preflight = null;
    if (firmenlogo || (forMotto && forMotto.upload && forMotto.upload.mode === 'exact') || !forMotto) {
      try { preflight = await logoPreflight(norm.png); }
      catch (e) { console.error('Logo-Preflight:', e && e.message ? e.message : e); }
    }
    if (preflight && preflight.stufe !== 'gut') console.log('Logo-Preflight', id, preflight.stufe + ':', preflight.gruende.join(' / '));
    // Bildschirmfoto: als eigener Preflight-Grund, damit der Kunde es sieht und ein anderes Bild
    // waehlen kann. Angenommen wird die Datei trotzdem - vielleicht gehoert die Adresse zum Logo.
    if (bildschirmWoerter.length && preflight) {
      preflight.bildschirmfoto = bildschirmWoerter;
      preflight.gruende = (preflight.gruende || []).concat(
        'Das sieht nach einem Bildschirmfoto aus \u2013 gelesen wurde ' + bildschirmWoerter.map(w => '\u201e' + w + '\u201c').join(', ') + '. Bitte die Logodatei selbst hochladen, sonst zeichnet Otto die Adressleiste mit.');
      if (preflight.stufe === 'gut') preflight.stufe = 'maessig';
    }
    res.json({ uploadId: id, width: norm.width, height: norm.height, preflight, nachzeichnen: !!env.BALLZ_MCP_URL });
  } catch (e) {
    const grund = e && e.message ? String(e.message) : '';
    console.error('Upload gescheitert:', grund || e);
    // Wenn wir wissen, WAS es war (PDF, EPS, ZIP), soll der Kunde das auch lesen.
    res.status(400).json({
      error: 'Bild nicht lesbar',
      hinweis: /koennen wir nicht/.test(grund)
        ? grund.replace('koennen', 'können') + '. Schick uns das Logo bitte als PDF, PNG, JPG, SVG oder TIFF – oder per Mail, wir wandeln es um.'
        : ''
    });
  }
});

// ---------- Fassung 35: "Otto zeichnet das Logo sauber nach" ----------
// Markus: "Jetzt koennten wir zaubern und sagen: okay, wir koennen das Logo aber schoen machen."
// Die hochgeladene Datei geht als Vorlage in die Bildbearbeitung - gleiche Formen, gleicher
// Text, gleiche Farben, aber scharf, flaechig und auf Chromagruen. Danach wie jedes Motiv
// freigestellt, geprueft (Marken, verbotene Zeichen) und als neuer Upload abgelegt. Der Kunde
// sieht das Ergebnis und entscheidet, ob er es nimmt.
const nachzeichnenPrompt = () => [
  'Redraw the logo in the supplied image as a clean, sharp, print-ready version. Keep EXACTLY the same shapes, the same lettering (spell every word exactly as shown, same style of letters), the same layout and the same colours - this is the same logo, only clean.',
  'Flat, evenly filled colour fields with crisp edges: no blur, no pixelation, no noise, no gradients, no shadows, no glow, no 3D. Remove any white box, white plate, checkerboard, border or leftover background patch that is not part of the logo itself.',
  // Fassung 69 (Markus, 16. Sept.): Aus einem nachgezeichneten Bildschirmfoto kam ein "Logo" mit
  // Adressleiste und Uhrzeit - und das steckte danach in jedem Design, das es benutzte.
  'The supplied file may show more than the logo - a screenshot, a website, a document or a photo of a screen. Redraw ONLY the logo itself. Leave out every interface element: window and browser frames, address bars, web addresses, clocks, battery and signal icons, tabs, buttons, scrollbars, cursors, watermarks, captions and page background. Never write a web address, a time of day or a percentage.',
  // Markus, 14. Sept.: "nicht besonders gut" - Ring ungleichmaessig, "ne" fetter als "tics". Das Modell
  // erbt die Unschaerfe der Vorlage; die Ansage muss die Geometrie erzwingen, nicht nur "sauber".
  'Draw it like a professional vector logo: geometrically exact shapes (a circle is a perfect circle, lines are perfectly straight or perfectly curved), one uniform stroke width per element, and every letter of a word in exactly the same weight and size as its neighbours.',
  // Fassung 45 (Markus, 15. Sept., zum "n" in "netics"): Die Vorlage ist unscharf, dadurch wirken
  // einzelne Buchstaben fetter. Das Modell hat das treu uebernommen. Also ausdruecklich ansagen,
  // dass solche Unterschiede Fehler der Vorlage sind und begradigt werden muessen.
  'The supplied image is blurry and low in resolution, so some letters may look heavier, thicker or darker than others. That is a flaw of the source, not part of the logo. Render the whole wordmark in ONE single font weight: every letter of a word has the same stroke thickness, the same height and the same style. Never make single letters bold while their neighbours stay thin.',
  GRUND_MODUS === 'chroma'
    ? 'Place the logo large in the centre on a FLAT PURE CHROMA GREEN background, exact colour #00FF00, perfectly even. The green also fills every enclosed area, including the holes inside letters. Never use pure or near-pure green inside the logo. Nothing else in the picture: no text, no caption, no mockup, no frame.'
    : 'Place the logo large in the centre on a fully TRANSPARENT background - nothing behind it, no plate, no glow, no shadow, no wash. Every enclosed area, including the holes inside letters, is transparent too. Nothing else in the picture: no text, no caption, no mockup, no frame.'
].join('\n');
// Fassung 37: das Nachzeichnen laeuft als AUFTRAG mit Abfrage, nicht als eine lange Anfrage.
// Mit 2048 px, Stufe high und zwei Pruefaufrufen dauert es gut eine Minute - so lange haelt
// nicht jeder Handy-Browser eine einzelne Anfrage offen (Markus, 14. Sept.: "klappt nicht mehr").
// Stand liegt zusaetzlich auf dem Volume (storage/nz): ein Neustart oder eine zweite Instanz
// waehrend der Minute Rechenzeit darf den Auftrag nicht vergessen.
const NZ_AUFTRAEGE = new Map(); // id -> { status, ergebnis, seit }
const NZ_DIR = path.join(STORE, 'nz');
async function nzSchreiben(id, stand) {
  NZ_AUFTRAEGE.set(id, stand);
  try { await fs.mkdir(NZ_DIR, { recursive: true }); await fs.writeFile(path.join(NZ_DIR, id + '.json'), JSON.stringify(stand)); } catch (e) { /* Speicher reicht */ }
}
async function nzLesen(id) {
  if (NZ_AUFTRAEGE.has(id)) return NZ_AUFTRAEGE.get(id);
  try { return JSON.parse(await fs.readFile(path.join(NZ_DIR, id + '.json'), 'utf8')); } catch (e) { return null; }
}
setInterval(async () => {
  const alt = Date.now() - 45 * 60000;
  for (const [k, v] of NZ_AUFTRAEGE) if (v.seit < alt) NZ_AUFTRAEGE.delete(k);
  try { for (const f of await fs.readdir(NZ_DIR)) { const p = path.join(NZ_DIR, f); const st = await fs.stat(p); if (st.mtimeMs < alt) await fs.rm(p, { force: true }); } } catch (e) { /* noch kein Ordner */ }
}, 5 * 60000).unref();
async function logoNachzeichnenAusfuehren(von, mottoSlug, who, textWunsch, korrektur) {
  const quelle = await fs.readFile(path.join(STORE, 'uploads', von));
  // Fassung 56 (Markus, 16. Sept.): "schau mal am Logo auch das und das, Fehler bitte beheben".
  // Der Kunde sieht das nachgezeichnete Logo und sagt, was noch nicht stimmt. Dann ist die
  // Quelle das nachgezeichnete Logo selbst, und der Prompt bekommt genau diese Aenderungen -
  // und die Ansage, sonst NICHTS anzufassen. Jede Korrektur wird eine neue Version (_nz2, _nz3),
  // damit nichts ueberschrieben wird und der Browser keine alte Fassung aus dem Cache zeigt.
  const korrText = String(korrektur || '').replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  const korrZeile = korrText
    ? '\nTHE CUSTOMER HAS REVIEWED THIS DRAWING AND ASKS FOR THESE CORRECTIONS (written in German): "' + korrText.replace(/"/g, "'") + '". Apply exactly these corrections. Change NOTHING else: every shape, every letter, every colour and the layout that are not mentioned stay identical to the supplied image.'
    : '';
  // Vorlage auf ein Quadrat mit Luft bringen - so bleibt das Seitenverhaeltnis, und das Modell
  // hat Platz. Weiss statt Chroma als Grund der Vorlage: die Vorlage soll zeigen, was da ist.
  // Halbdurchsichtige Buchstaben wurden auf dem weissen Grund blassgrau, und das Modell liess sie
  // weg ("yber-tics" statt "Cyber-netics"). Also erst jedes vorhandene Pixel voll deckend machen.
  const dicht = await (async () => {
    const { data, info } = await sharp(quelle).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let p = 3; p < data.length; p += 4) if (data[p] > 20) data[p] = 255;
    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  })();
  const vorlage = await sharp(dicht).resize({ width: 900, height: 900, fit: 'inside', kernel: 'lanczos3' })
    .extend({ top: 62, bottom: 62, left: 62, right: 62, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: '#ffffff' }).png().toBuffer();
  // Der Text des Logos: vom Kunden getippt (massgeblich) oder vorher gelesen. Geht als
  // Pflichttext in den Prompt UND wird hinterher am Ergebnis geprueft. Markus, 14. Sept.:
  // "C" und "ne" fehlten zweimal - beide kleben an der Innenkante des Rings, das Modell hielt
  // sie fuer Reste. Ohne Kontrolle waere das nie aufgefallen.
  let woerter = String(textWunsch || '').replace(/\s+/g, ' ').trim().split(' ').map(w => w.trim()).filter(Boolean).slice(0, 12);
  const vomKunden = woerter.length > 0;
  if (!woerter.length && HAS_LLM) {
    try {
      const lese = await textQA(vorlage, [], { marken: false });
      woerter = Array.isArray(lese && lese.texts) ? lese.texts.map(t => String(t).trim()).filter(Boolean).slice(0, 12) : [];
      // Fassung 69 (Markus, 16. Sept.): Ist die Vorlage ein Bildschirmfoto, liest die Bild-KI auch
      // Adressleiste, Uhrzeit und Akkustand mit. Als Pflichttext landet das im nachgezeichneten
      // Logo - und von dort in jedem Design, das dieses gemerkte Logo benutzt.
      const vorher = woerter.length;
      woerter = woerter.filter(w => !BILDSCHIRM_WORT.test(String(w).trim()));
      if (woerter.length !== vorher) console.warn('Nachzeichnen: ' + (vorher - woerter.length) + ' gelesene Wort/Woerter sahen nach Bildschirmelement aus und wurden verworfen');
    } catch (e) { /* ohne Lesehilfe weiter */ }
  }
  const textZeile = woerter.length
    ? '\nThe lettering in the logo reads exactly: ' + woerter.map(w => '"' + w.replace(/"/g, '') + '"').join(', ') + '. Reproduce every one of these words completely, in full, correctly spelled, in the same style and position as in the image. Letters that touch or overlap the graphic (a ring, a swoosh, a frame) are part of the lettering - keep them. No letter may be missing, cut off or hidden.'
    : '';
  const forMotto = await mottos.get(String(mottoSlug || '').replace(/[^a-z0-9-]/g, ''));
  const markenPruefen = !(von.startsWith('fl_') && who && who.user) && !(forMotto && markenFrei(forMotto));
  const t0 = Date.now();
  let getrimmt = null, qa = null, schriftFehlt = false, zusatz = '';
  for (let versuch = 1; versuch <= 2; versuch++) {
    const gen = await mitBildarbeit('Logo nachzeichnen ' + von, () => editViaBallz(env.BALLZ_MCP_URL, {
      // 2048 statt 1024: ein Logo muss bis zum Ruecken scharf bleiben (Preflight: 700 px = 12 cm)
      // Stufe max: ein Logo ist klein und selten - hier zaehlt jede Kante, die Kosten sind egal.
      prompt: nachzeichnenPrompt() + textZeile + korrZeile + zusatz, size: '2048x2048', quality: 'max', model: bildModell(),
      imageBase64: vorlage.toString('base64'), mimeType: 'image/png'
    }));
    const frei = (await motivFreistellen(gen.png)).png;
    // Auf den belegten Teil beschneiden, mit etwas Luft
    getrimmt = await sharp(frei).trim({ threshold: 10 }).extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    if (!HAS_LLM) break;
    // Dieselbe Pruefung wie beim Upload (verbotene Zeichen, Marken) - und: sind alle Woerter da?
    const small = await sharp(getrimmt).resize({ width: 768, fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
    qa = null;
    for (let v2 = 1; v2 <= 2 && !qa; v2++) { try { qa = await textQA(small, woerter, { marken: markenPruefen }); } catch (e) { /* noch einmal */ } }
    if (!qa) return { ok: false, error: 'pruefung', hinweis: 'Wir konnten das nachgezeichnete Logo gerade nicht prüfen. Bitte gleich noch einmal.' };
    if (qa.verboten) return { ok: false, error: 'verboten', wort: String(qa.verboten) };
    if (markenPruefen && !qa.pass && qa.marke) return { ok: false, error: 'marke', wort: qa.marke };
    schriftFehlt = woerter.length > 0 && qa.pass === false && !qa.skipped;
    if (!schriftFehlt) break;
    console.warn('Logo nachzeichnen: Schrift unvollstaendig in Versuch', versuch, '- gelesen:', JSON.stringify(qa.texts || []), 'erwartet:', JSON.stringify(woerter));
    zusatz = '\nTHE PREVIOUS ATTEMPT DROPPED LETTERS. The lettering must read exactly ' + woerter.map(w => '"' + w.replace(/"/g, '') + '"').join(' ') + ' - every single letter, including the ones that sit inside or against the graphic. Draw the lettering first, complete, then the graphic around it.';
  }
  // Erste Zeichnung: _nz. Jede weitere (Korrektur) zaehlt hoch: _nz2, _nz3 ...
  const vers = von.match(/_nz(\d*)\.png$/);
  const naechste = vers ? (Number(vers[1] || 1) + 1) : '';
  const id = von.replace(/(_nz\d*)?\.png$/, '') + '_nz' + naechste + '.png';
  await fs.writeFile(path.join(STORE, 'uploads', id), getrimmt);
  const meta = await sharp(getrimmt).metadata();
  const preflight = (await logoPreflight(getrimmt).catch(() => null)) || { stufe: 'gut', gruende: [], hinweise: [] };
  if (schriftFehlt) {
    preflight.gruende = (preflight.gruende || []).concat(['Die Schrift ist wahrscheinlich unvollständig – erwartet: „' + woerter.join(' ') + '“, gelesen: „' + ((qa && qa.texts) || []).join(' ') + '“. Bitte genau vergleichen.']);
    if (preflight.stufe === 'gut') preflight.stufe = 'maessig';
  }
  console.log('Logo nachgezeichnet:', von, '->', id, meta.width + 'x' + meta.height, preflight.stufe, 'in', Math.round((Date.now() - t0) / 1000) + ' s', korrText ? '(Korrektur: ' + korrText + ')' : '', woerter.length ? (vomKunden ? '(Text vom Kunden: ' : '(Text gelesen: ') + woerter.join(' ') + ')' : '(ohne Text)', schriftFehlt ? 'SCHRIFT UNVOLLSTAENDIG' : '');
  const thumb = await sharp(getrimmt).resize({ width: 360, height: 360, fit: 'inside' }).png().toBuffer();
  return { ok: true, uploadId: id, quelle: von, korrektur: korrText || '', width: meta.width, height: meta.height, preflight, erwartet: woerter, gelesen: (qa && qa.texts) || [], schriftFehlt, vorschau: 'data:image/png;base64,' + thumb.toString('base64') };
}
app.post('/api/mo/upload/nachzeichnen', async (req, res) => {
  const von = String((req.body || {}).uploadId || '').replace(/[^A-Za-z0-9_.-]/g, '');
  if (!/^(up|fl)_[0-9a-f]{16}(_nz\d*)?\.png$/.test(von)) return res.status(400).json({ error: 'upload unbekannt' });
  if (!env.BALLZ_MCP_URL) return res.status(503).json({ error: 'kein bilddienst', hinweis: 'Das Nachzeichnen ist gerade nicht eingerichtet.' });
  try { await fs.access(path.join(STORE, 'uploads', von)); } catch (e) { return res.status(404).json({ error: 'upload unbekannt' }); }
  const who = await identify(req, res);
  const auftrag = 'nz_' + crypto.randomBytes(8).toString('hex');
  // Fassung 43: Wer zeichnen laesst, wird gemerkt. Startet dieselbe Sitzung waehrenddessen ein
  // Design ohne Logo, weist der Server es ab - sonst laeuft das Design ohne Logo los
  // (Markus, 15. Sept.: "das war noch nicht fertig und dann kommt's einfach ohne Logo").
  const werNz = (who && who.user && who.user.id) || (who && who.guestId) || null;
  await nzSchreiben(auftrag, { status: 'laeuft', seit: Date.now(), wer: werNz });
  console.log('Logo nachzeichnen gestartet:', auftrag, 'von', von, (req.body || {}).korrektur ? '· Korrektur: ' + String((req.body || {}).korrektur).slice(0, 120) : '');
  logoNachzeichnenAusfuehren(von, (req.body || {}).motto, who, String((req.body || {}).text || '').slice(0, 80), String((req.body || {}).korrektur || '').slice(0, 300))
    .then(r => nzSchreiben(auftrag, { status: r.ok ? 'fertig' : 'fehler', ergebnis: r, seit: Date.now(), wer: werNz }))
    .catch(e => {
      console.error('Logo nachzeichnen:', auftrag, e && e.message ? e.message : e);
      return nzSchreiben(auftrag, { status: 'fehler', ergebnis: { ok: false, error: 'nachzeichnen', hinweis: 'Der Bildserver hat das Nachzeichnen abgebrochen: ' + String(e && e.message ? e.message : e).slice(0, 120) }, seit: Date.now(), wer: werNz });
    });
  res.json({ auftrag });
});
app.get('/api/mo/upload/nachzeichnen/:auftrag', async (req, res) => {
  const a = await nzLesen(String(req.params.auftrag).replace(/[^a-z0-9_]/g, ''));
  if (!a) return res.status(404).json({ status: 'unbekannt', error: 'auftrag unbekannt' });
  if (a.status === 'laeuft') return res.json({ status: 'laeuft', seit: a.seit });
  res.json({ status: a.status, ...a.ergebnis });
});

// ---------- Fassung 24-26: Otto Freestyle - Artikel und Kundenfotos ----------
// Wer ein Foto hochgeladen hat, darf es auch benutzen - und sonst niemand. Der RAM-Speicher in
// fotos.js kennt keine Besitzer, darum hier die Zuordnung Sitzung -> Kunde (nur Kennungen).
const FOTO_BESITZ = new Map();
const whoKey = (who) => (who.user ? 'u:' + who.user.id : 'g:' + (who.guestId || ''));
// Fassung 73 (Markus, 17. Sept.): Wer sein Foto als Gast hochlaedt und sich DANACH anmeldet,
// wechselt den Schluessel von 'g:<gast>' auf 'u:<konto>' - das Foto haette ihm dann nicht mehr
// gehoert und der Auftrag waere mit "Bitte lade dein Foto hoch" gescheitert. Genau der Weg, den
// die Seite selbst vorschlaegt ("nach dem Anmelden geht es automatisch weiter"). Das Gast-Cookie
// bleibt beim Anmelden bestehen, also gilt auch der Gast-Schluessel DESSELBEN Browsers - und der
// Eintrag wird dabei auf das Konto umgeschrieben, damit der Besitz danach eindeutig ist.
function fotoGehoert(sid, who) {
  const k = sid ? FOTO_BESITZ.get(sid) : null;
  if (!k) return false;
  if (k === whoKey(who)) return true;
  if (who.user && who.guestId && k === 'g:' + who.guestId) { FOTO_BESITZ.set(sid, whoKey(who)); return true; }
  return false;
}
// 27. Sept.: Auf der Postkarte ist der Foto-Weg eine sichtbare Kachelwahl (Markus: "Foto Original
// statt im Stil sollte auch in der Auswahl stehen") - ihre Schluessel heissen 'nachzeichnen' und
// 'original'. Die Auswahllisten der anderen Mottos sagen weiter "... so einsetzen".
// 19. Okt. (Markus, Freestyle: "ein Foto hochzuladen oder eine Datei, so dass diese geaendert werden kann"):
// dritter Weg 'veraendert' - der Bilddienst aendert das Foto nach dem Wunsch, danach laeuft es wie 'original'.
const fotoModusVon = (v) => /so einsetzen|^original$/i.test(String(v || '').trim()) ? 'original' : (/nachzeichnen/i.test(String(v || '')) ? 'nachgebaut' : (/ver(ä|ae)ndern/i.test(String(v || '')) ? 'veraendert' : null));
const FOTO_MODUS_TEXT = { veraendert: 'Mein Foto nach meinem Wunsch verändern', original: 'Mein Foto so einsetzen', nachgebaut: 'Mein Foto im gewählten Stil nachzeichnen' };
const fotoFormVon = (v) => /kreis/i.test(String(v || '')) ? 'kreis' : (/abgerundet/i.test(String(v || '')) ? 'abgerundet' : 'rechteck');

// Artikelkatalog fuer die Seite: nur verkaufsfaehige Artikel (mit belastbaren Massen), gruppiert.
app.get('/api/mo/freestyle/artikel', (req, res) => {
  const gruppen = artikelAuswahl();
  // Textil (DTF): freie Groesse in Zentimetern statt fester Flaechen; die Platzierungen bleiben als Vorschlaege
  for (const g of Object.values(gruppen)) for (const a of g) a.freieGroesse = ARTIKEL[a.id] && ARTIKEL[a.id].verfahren === 'dtf';
  res.json({ gruppen, texte: FOTO_TEXTE, maxMb: FOTO_MAX_MB, frei: FREI_CM });
});

// Foto hochladen: NUR Arbeitsspeicher. Kein multer.diskStorage, kein STORE, kein Drive.
// Antwort: Sitzungsnummer, Frist und die Aufloesungspruefung fuer den gewaehlten Artikel.
app.post('/api/mo/foto', async (req, res) => {
  const body = req.body || {};
  const m = String(body.dataUrl || '').match(/^data:([a-z0-9/+.-]*);base64,(.+)$/i);
  if (!m) return res.status(400).json({ error: 'kein Bild' });
  let buffer = Buffer.from(m[2], 'base64');
  let mime = m[1] || 'image/jpeg';
  if (buffer.length > FOTO_MAX_BYTES) return res.status(413).json({ error: 'zu gross', hinweis: `Das Foto ist ${(buffer.length / 1048576).toFixed(1)} MB gross, erlaubt sind ${FOTO_MAX_MB} MB.` });
  // 19. Okt. (Markus, Freestyle: "ein Foto ... oder eine Datei"): eine PDF koennen wir hier nicht lesen - das
  // sagen wir so, statt "kein Bild". Eine SVG (Logo, Grafik) wird zu einem PNG gerastert, damit alles Weitere
  // (Pruefung, Bilddienst, Einsetzen) ein normales Bild sieht.
  const kopf = buffer.subarray(0, 512).toString('latin1');
  if (/^application\/pdf/i.test(mime) || kopf.startsWith('%PDF')) return res.status(400).json({ error: 'kein Bild', hinweis: FOTO_TEXTE.pdf });
  if (/svg/i.test(mime) || /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg/i.test(kopf)) {
    try { buffer = await sharp(buffer, { density: 300 }).resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: false }).png().toBuffer(); mime = 'image/png'; }
    catch (e) { console.error('Foto-Upload SVG:', e && e.message ? e.message : e); return res.status(400).json({ error: 'kein Bild', hinweis: 'Die SVG-Datei konnte nicht gelesen werden. Bitte als PNG oder JPG speichern.' }); }
  }
  let meta;
  try { meta = await sharp(buffer).metadata(); } catch (e) { meta = null; }
  if (!meta || !meta.width || !meta.height) return res.status(400).json({ error: 'kein Bild', hinweis: 'Das Foto konnte nicht gelesen werden. Bitte JPG, PNG, HEIC oder SVG.' });
  // 26. Sept., Markus: "Wenn jemand ein Foto hochlaedt, sollten wir schon erkennen koennen, dass
  // auch ein Mensch da drauf ist oder ein Tier." Bis hierher ist nur geprueft, dass die Datei ein
  // LESBARES Bild ist. Jetzt wird hingesehen - aber nur, wenn das Motto es verlangt: bei der
  // Postkarte wird die Person aus dem Foto gemalt, beim Freestyle darf auch eine Landschaft oder
  // ein Auto drauf sein, und ein Logo ist ohnehin kein Foto.
  // Das passiert VOR dem Ablegen: ein Bild, das wir nicht nehmen, soll auch nicht herumliegen.
  const mottoFuerFoto = String(body.slug || '').trim() ? withBezug(await mottos.get(String(body.slug).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60))) : null;
  const braucht = fotoBrauchtVon(mottoFuerFoto);
  // Dasselbe Hinsehen beantwortet beide Fragen: ist ueberhaupt jemand drauf - und WAS ist drauf.
  // Ein Aufruf, zwei Antworten; ein zweiter waere Geld und Zeit fuer nichts.
  const gesehen = (braucht || mottoFuerFoto) ? await fotoZeigtMotiv(buffer) : null;
  if (braucht) {
    const befund = fotoInhaltBefund(gesehen, braucht);
    zaehl('fotoinhalt', befund.geprueft ? (befund.ok ? 'passt' : 'abgelehnt') : 'ohne-modell');
    if (!befund.ok) return res.status(422).json({ error: 'kein motiv', hinweis: befund.hinweis, was: befund.was });
  }
  const who = await identify(req, res);
  // 26. Sept., Markus: "Bis zu fuenf Fotos hochladen, und es wird aus den Fotos was gebaut."
  // Ein WEITERES Foto kommt zur laufenden Sitzung dazu; ein neues Selfie beginnt eine neue.
  // Die Sitzung muss diesem Kunden gehoeren - sonst haengt jemand Bilder in eine fremde Karte.
  const dazuSid = String(body.fotoSitzung || '').replace(/[^a-z0-9_]/g, '');
  const dazu = !!body.dazu && !!dazuSid && FOTO_BESITZ.get(dazuSid) === whoKey(who) && !!fotosHolen(dazuSid);
  if (!dazu) {
    // Ein Selfie je Kunde: die vorige Sitzung dieses Kunden faellt weg (fotoAblegen loescht je
    // Sitzung, die Besitzliste wird hier bereinigt).
    for (const [sid, k] of FOTO_BESITZ) if (k === whoKey(who)) { fotoLoeschen(sid); FOTO_BESITZ.delete(sid); }
  }
  const sitzung = dazu ? dazuSid : 'fs_' + crypto.randomBytes(8).toString('hex');
  // Das erkannte Motiv bleibt beim Bild (nicht das Bild beim Motiv): daraus wird spaeter das
  // Thema der Karte. Gespeichert wird ein Wort, kein Bild und keine Beschreibung.
  const ab = fotoAblegen(sitzung, buffer, { mime, name: 'foto', dazu, motiv: gesehen && gesehen.motiv });
  if (!ab.ok) return res.status(413).json({ error: dazu ? 'zu viele' : 'zu gross', hinweis: ab.grund });
  FOTO_BESITZ.set(sitzung, whoKey(who));
  // Aufloesung gegen den gewaehlten Artikel pruefen - dem Kunden sofort sagen, ob es reicht
  let pruef = null;
  const aid = String(body.artikelId || '').replace(/[^a-z0-9_-]/g, '');
  const fl = String(body.flaeche || '').replace(/[^A-Za-z0-9_.x-]/g, '');
  const a = aid && ARTIKEL[aid];
  const lw = a ? ((a.verfahren === 'dtf' && (body.breiteCm || body.hoeheCm)) ? freieLeinwand(a, body.breiteCm, body.hoeheCm) : artikelLeinwand(aid, fl)) : null;
  // Nachzeichnen: das Foto ist Vorlage, nicht Druckmaterial - dann zaehlen Pixel, nicht dpi.
  // 19. Okt.: beim einfachen Freestyle kennt die Seite den Weg noch nicht (foto_modus setzt erst die Bruecke) -
  // das Foto geht in der Regel durch den Bilddienst, also gilt die Vorlagen-Pruefung.
  const alsVorlage = fotoModusVon(body.fotoModus) === 'nachgebaut' || fotoModusVon(body.fotoModus) === 'veraendert' || !!(mottoFuerFoto && mottoFuerFoto.einfach);
  if (lw) { try { pruef = await pruefeFoto(buffer, lw.netto, alsVorlage ? { vorlage: true } : { anteil: 0.55 }); } catch (e) { pruef = null; } }
  // Fassung 74: Wie oft reicht ein Handyfoto fuer das gewaehlte Mass? Gezaehlt wird nur die
  // Stufe des Befunds (gut / grenzwertig / zu klein) - nie das Foto, nie Masse, nie Pixel.
  zaehl('foto', pruef ? String(pruef.stufe || (pruef.ok ? 'gut' : 'zu-klein')) : 'ohne-artikel');
  res.json({ fotoSitzung: sitzung, laeuftAbUm: ab.laeuftAbUm, px: [meta.width, meta.height], pruef, anzahl: ab.anzahl, platzFrei: ab.platzFrei, hinweis: FOTO_TEXTE.beimHochladen });
});
const FOTO_MAX_BYTES = FOTO_MAX_MB * 1024 * 1024;

// Auftrag zu einer Design-Nummer: erst im Speicher suchen (dort steht die Foto-Sitzung), sonst Datei.
async function jobZuDesign(designId) {
  for (const j of jobs.values()) if (j.designId === designId) return j;
  return null;
}

// Vorschau MIT Foto, nur im Arbeitsspeicher zusammengesetzt - nichts davon wird geschrieben.
app.get('/api/mo/foto/vorschau/:file', async (req, res) => {
  const designId = String(req.params.file).replace(/\.png$/, '').replace(/[^A-Za-z0-9_-]/g, '');
  const { exp, sig } = req.query;
  if (!exp || +exp < Date.now() || signPreview(designId, exp, SIGN_SECRET) !== sig) return res.status(403).end();
  res.set('Cache-Control', 'no-store');
  try {
    const j = await jobZuDesign(designId);
    const f = j && j.foto;
    const e = f && fotoHolen(f.sitzung);
    if (!f || !e) return res.status(410).json({ error: 'foto abgelaufen', hinweis: FOTO_TEXTE.abgelaufen });
    const master = await fs.readFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`));
    const mit = f.modus === 'original' ? await fotoEinsetzen(master, e.buffer, { bereich: f.bereich, form: f.form }) : master;
    res.type('png').send(await makePreview(mit));
  } catch (err) {
    console.error('Foto-Vorschau:', err && err.message ? err.message : err);
    res.status(500).end();
  }
});

// Der Knopf: "Gefaellt dir dein Design?" Ja = Druckdatei fertig bauen, Foto sofort loeschen.
// Nein = Foto bleibt fuer den naechsten Versuch. Nur der Besitzer des Auftrags darf das.
app.post('/api/mo/foto/entscheidung', async (req, res) => {
  const body = req.body || {};
  const designId = String(body.designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const who = await identify(req, res);
  const j = await jobZuDesign(designId);
  if (!j || !meinAuftrag(j, who)) return res.status(404).json({ error: 'auftrag unbekannt' });
  if (!j.foto) return res.status(400).json({ error: 'kein foto' });
  const f = j.foto;
  if (!body.ja) {
    const r = designAblehnen(f.sitzung);
    return res.json({ ok: true, fotoNochDa: r.fotoNochDa, hinweis: r.hinweis, texte: FOTO_TEXTE });
  }
  try {
    if (f.modus === 'original') {
      const master = await fs.readFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`));
      const r = await mitBildarbeit('Foto einsetzen ' + designId, () => designFreigeben(f.sitzung, { motivBuffer: master, bereich: f.bereich, form: f.form }));
      if (!r.ok) return res.status(410).json({ error: 'foto abgelaufen', hinweis: r.grund });
      await fs.writeFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`), r.druckdatei);
      await fs.writeFile(path.join(STORE, 'previews', `${designId}.png`), await makePreview(r.druckdatei));
      // Abgeleitete Bilder wegwerfen, sonst zeigen Mockups weiter die leere Flaeche
      try { for (const x of await fs.readdir(path.join(STORE, 'mockups'))) if (x.includes(designId)) await fs.rm(path.join(STORE, 'mockups', x), { force: true }); } catch (e) { /* kein Cache */ }
      try { await fs.rm(path.join(STORE, 'vectors', `${designId}.svg`), { force: true }); } catch (e) { /* egal */ }
      console.log('Foto eingesetzt und geloescht:', designId, r.protokoll.ereignis);
    } else {
      fotoLoeschen(f.sitzung);
      console.log('Foto nach Freigabe geloescht (nachgezeichnet):', designId);
    }
    FOTO_BESITZ.delete(f.sitzung);
    f.wartet = false; f.freigegeben = true;
    // Ausweis des Designs nachziehen, damit die Druckliste den Stand kennt
    const jf = await readJob(designId);
    if (jf) { jf.foto = { ...(jf.foto || {}), wartet: false, freigegeben: true, sitzung: null }; await fs.writeFile(path.join(STORE, 'jobs', `${designId}.json`), JSON.stringify(jf, null, 2)); }
    res.json({ ok: true, fotoGeloescht: true, hinweis: FOTO_TEXTE.nachDemLoeschen, preview: j.preview, sig: j.sig });
  } catch (err) {
    console.error('Foto-Entscheidung:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'fehler' });
  }
});

// Wer hat ein Design erzeugt? Im Backend ist das nach dem Motiv die wichtigste Frage:
// waren WIR das (eigener Lauf, Test, Galerie) oder ein echter Kunde? Konto bzw. Gast-
// Kennung stehen ohnehin im Ausweis; hier kommt dazu, WORUEBER der Auftrag kam.
// Ein Browser auf motto-otto.de ist ein Kunde, ein Aufruf ohne Browser-Kennung kommt
// von uns (Skript, Bruecke, Werkzeug). Bewusst datensparsam: keine IP, keine volle
// Browserkennung - nur die grobe Art, ein kurzer Name und der Host der Seite.
function quelleVon(req) {
  const ua = String(req.headers['user-agent'] || '');
  const browser = /Mozilla\//.test(ua);
  const geraet = /iPhone|iPad|iPod/.test(ua) ? ' · iPhone/iPad' : /Android/.test(ua) ? ' · Android'
    : /Macintosh|Mac OS X/.test(ua) ? ' · Mac' : /Windows/.test(ua) ? ' · Windows' : /Linux/.test(ua) ? ' · Linux' : '';
  const name = !browser
    ? (ua.split(/[\s\/]/)[0] || 'Server')
    : ((/Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser') + geraet);
  let seite = '';
  try { seite = new URL(String(req.headers.referer || req.headers.origin || '')).host; } catch (e) { seite = ''; }
  return { art: browser ? 'web' : 'api', name: name.slice(0, 40), seite: seite.slice(0, 60) };
}

app.post('/api/mo/generate', async (req, res) => {
  const body = req.body || {};
  const motto = withBezug(await mottos.get(body.motto));
  if (!motto || motto.active === false) return res.status(404).json({ error: 'motto unbekannt' });
  // Freestyle einfach (5. Okt. abends): die Bruecke fuellt aus dem Wunsch, was die Seite nicht mehr fragt.
  if (motto.einfach && body.values && typeof body.values === 'object' && String(body.values.motiv || '').trim()) {
    const fotoSid = String(body.fotoSitzung || '').replace(/[^a-z0-9_]/g, '');
    await freestyleBruecke(body, motto, !!(fotoSid && fotoHolen(fotoSid)));
  }

  const values = {};
  let names = [];
  let people = []; // je Name optional { name, size, garment } fuer die Bestellung
  const bereinigt = []; // was wir stillschweigend geaendert haben (Emojis, Sonderzeichen)
  const personal = motto.fields.find(f => f.personal);
  // 5. Okt.: die schlichte Linie des Partners (bei-machen "Wie im Shop") - nur Spruch, Name, Datum, Sterne; siehe runJob.
  let linie = null;
  if (motto.hausTextil && body.vorlage === 'linie') {
    const l = body.linie || {};
    const t = (x, n) => { const v = cleanValue(x, n); if (v === null) throw new Error('zeichen'); return v || ''; };
    try { linie = { spruch: t(l.spruch, 40), name: t(l.name, 30), datum: t(l.datum, 20), sterne: Math.max(0, Math.min(5, Math.round(+l.sterne || 0))) }; }
    catch (e) { return res.status(400).json({ error: 'zeichen nicht erlaubt', feld: 'Name, Datum oder Spruch' }); }
  }
  for (const f of motto.fields) {
    const raw = (body.values || {})[f.key];
    if (f.personal) {
      // Namensliste: je Zeile "Name, Groesse, Artikel"; wird NICHT von der KI gemalt
      const pp = parsePeople(Array.isArray(body.names) && body.names.length ? body.names : raw, f.max);
      for (const c of pp.changed) bereinigt.push({ feld: f.label, vorher: c.vorher, nachher: c.nachher });
      names = pp.names;
      people = pp.people;
      if (!names.length && f.required) return res.status(400).json({ error: 'feld fehlt', feld: f.label });
      values[f.key] = '';
      continue;
    }
    if (f.type === 'list') {
      // Namensliste (mehrzeilig): saeubern, Zeilen erhalten - kommt spaeter auf die Rueckseite.
      const cn = cleanNames(raw, f.max);
      for (const c of cn.changed) bereinigt.push({ feld: f.label, vorher: c.vorher, nachher: c.nachher });
      if (!cn.names.length && f.required) return res.status(400).json({ error: 'feld fehlt', feld: f.label });
      values[f.key] = cn.names.join('\n');
      continue;
    }
    // Fassung 25: Felder mit zeigeWenn gelten nur, wenn ihre Bedingung erfuellt ist (Foto-Felder)
    if (!zeigeWennErfuellt(f, body.values || {})) { values[f.key] = ''; continue; }
    if (f.type === 'upload') { values[f.key] = ''; continue; } // das Foto selbst kommt ueber /api/mo/foto
    if (f.type === 'checkbox') {
      const an = raw === true || /^(ja|on|true|1)$/i.test(String(raw || ''));
      if (!an && f.required) return res.status(400).json({ error: 'feld fehlt', feld: f.label });
      values[f.key] = an ? 'ja' : '';
      continue;
    }
    if (f.type === 'textarea') {
      const v = linie && f.key === 'motiv' ? 'Schlichte Linie wie im Shop' : cleanLong(raw, f.max);
      if (v === null) return res.status(400).json({ error: 'zeichen nicht erlaubt', feld: f.label });
      if (!v && f.required) return res.status(400).json({ error: 'feld fehlt', feld: f.label });
      values[f.key] = v;
      continue;
    }
    if (f.type === 'select') {
      // Fassung 25: leere Auswahl faellt auf die Vorgabe des Feldes zurueck (z. B. "Kein Foto")
      const v = String(raw || '').trim() || (f.default && f.options.includes(f.default) ? f.default : '');
      if (v && !f.options.includes(v)) return res.status(400).json({ error: 'auswahl ungueltig', feld: f.label });
      if (!v && f.required) return res.status(400).json({ error: 'feld fehlt', feld: f.label });
      values[f.key] = v;
      continue;
    }
    if (f.type === 'wahl') {
      // 20. Sept., Kachelwahl (Postkartenart): es zaehlt das Kuerzel der Kachel, sonst die Vorgabe
      const keys = (f.options || []).map(o => o.key);
      const v = String(raw || '').trim() || (f.default && keys.includes(f.default) ? f.default : '');
      if (v && !keys.includes(v)) return res.status(400).json({ error: 'auswahl ungueltig', feld: f.label });
      if (!v && f.required) return res.status(400).json({ error: 'feld fehlt', feld: f.label });
      values[f.key] = v;
      continue;
    }
    const v = cleanValue(raw, f.max);
    if (v === null) return res.status(400).json({ error: 'zeichen nicht erlaubt', feld: f.label });
    if (!v && f.required) return res.status(400).json({ error: 'feld fehlt', feld: f.label });
    const orig = String(raw || '').replace(/\s+/g, ' ').trim();
    if (orig && v !== orig) bereinigt.push({ feld: f.label, vorher: orig, nachher: v });
    values[f.key] = v;
  }

  // Markensperre: alles, was gedruckt wird (Felder mit printed, inkl. Namensliste), darf kein geschuetztes Wort enthalten.
  // Ausnahme: freigabepflichtige Mottos (Fanclub) - dort ist auch das Original-Logo erlaubt, es zaehlt der Nachweis -
  // und Mottos mit Schalter "markenfrei" (z. B. Handwerker-Shirt mit eigenem Firmenlogo).
  // Verbotene Zeichen und Parolen: gilt fuer JEDES Motto und JEDES Feld - auch fuer die,
  // die von der Markensperre ausgenommen sind, und auch fuer Felder, die nicht gedruckt
  // werden (sie stehen trotzdem im Prompt und koennen ins Bild wandern).
  {
    const alleVals = Object.values(values).filter(v => typeof v === 'string' && v);
    const hit = verboten.pruefeTexte(alleVals);
    if (hit) {
      await verbotenMerken({ quelle: 'eingabe', wort: hit.wort, eingabe: hit.eingabe, motto: motto.slug, req });
      return res.status(400).json({ error: 'verboten', wort: hit.wort });
    }
    // ... und was erst im Zusammenhang verboten ist, findet die Text-KI (auch fuer Fanclubs und markenfreie Mottos)
    const ki = alleVals.length ? await verbotenFinden(alleVals.join(' \n ')) : [];
    if (ki.length) {
      await verbotenMerken({ quelle: 'eingabe-ki', wort: ki.join(', '), eingabe: alleVals.join(' · ').slice(0, 200), motto: motto.slug, req });
      return res.status(400).json({ error: 'verboten', wort: ki[0] });
    }
  }

  if (!markenFrei(motto)) {
    const printedVals = motto.fields.filter(f => f.printed !== false).map(f => values[f.key]).filter(Boolean);
    const hit = marken.checkAll(printedVals, ortsNamen(values), markenKontext(motto, values));
    if (hit) { await verbotenMerken({ quelle: 'marke-eingabe', wort: hit.wort, eingabe: hit.eingabe, motto: motto.slug, req }); return res.status(400).json({ error: 'marke', wort: hit.wort, eingabe: hit.eingabe }); }
    // 6. Okt., Markus: "wenn gesperrte Woerter drin sind, dass wir gar nicht anfangen zu produzieren" - auch was in keiner Liste
    // steht (Band, Film, Figur, Promi in einem Spruch). Nur getippte Texte, keine Namen von Personen; Freestyle prueft unten selbst,
    // Haus nicht (dort steht der Betrieb). Die Seite fragt dann lieb, ob der Name raus soll.
    if (!motto.freestyle && !motto.hausTextil) {
      const texte = motto.fields.filter(f => f.printed !== false && !f.personal && (f.type === 'text' || f.type === 'textarea' || !f.type) && typeof values[f.key] === 'string' && values[f.key]).map(f => values[f.key]);
      const namen = texte.length ? await geschuetztFinden(texte.join(' \n ')) : [];
      if (namen.length) {
        const eingabe = texte.find(t => t.toLowerCase().includes(String(namen[0]).toLowerCase())) || texte[0];
        await verbotenMerken({ quelle: 'marke-eingabe-ki', wort: namen.join(', '), eingabe, motto: motto.slug, req });
        return res.status(400).json({ error: 'marke', wort: namen[0], eingabe });
      }
    }
  }

  // Helles oder dunkles Textil - bestimmt Druckregeln, Namensfarbe und Standard-Mockup
  // 25. Sept.: vier Toene statt zwei. weiss und schwarz sind die REINEN Toene - dort liefert
  // der Stoff die Farbe, und was so aussehen soll, wird gar nicht erst gedruckt. hell und
  // dunkel sind die Buntfarben (sand, graumeliert, navy, flaschengruen), wo unbedruckt eben
  // NICHT weiss bzw. schwarz ergibt und deshalb alles gedruckt wird.
  // Alle vier werden unveraendert genommen. Eine Uebersetzung hell->weiss stand hier kurz
  // drin, damit eine alte, noch im Browser liegende Seite die schaerfere Regel bekommt - sie
  // musste wieder raus: die neue Seite schickt hell und dunkel ABSICHTLICH, wenn der Kunde
  // eine Buntfarbe waehlt, und die Uebersetzung haette genau diese Wahl wieder weggebuegelt.
  // Eine veraltete Seite bekommt damit die Buntfarben-Regel - die druckt mehr als noetig,
  // aber nie zu wenig. Das ist die Richtung, in der ein Irrtum niemandem wehtut.
  let textile = String(body.textile || 'schwarz').toLowerCase();
  // 27. Sept.: Ein gueltiger Ton in der Anfrage ist die Wahl des Kunden - und die gilt (runJob,
  // textilFuerAuftrag). Kam keiner, entscheidet dort der Stil.
  const textilGewaehlt = TEXTILTOENE.includes(textile);
  if (!textilGewaehlt) textile = 'schwarz';

  // Wer ist das? Gast-Cookie oder angemeldeter Kunde. Steht bewusst VOR der Upload-Pruefung:
  // ein Firmenlogo (fl_) darf nur der Betrieb benutzen, an dessen Konto es hinterlegt ist.
  const who = await identify(req, res);

  let uploadFile = null, uploadFile2 = null;
  if (motto.upload.mode !== 'off') {
    const id = String(body.uploadId || '');
    // Fassung 43: Laeuft fuer diese Sitzung gerade ein Nachzeichnen und kommt der Start OHNE Logo,
    // dann hat der Kunde zu frueh getippt. Frueher lief das Design ohne Logo los (Markus,
    // 15. Sept.). Jetzt: abweisen mit klarer Ansage, der Browser haelt den Knopf ohnehin schon zu.
    if (!id && !body.korrekturVon) {
      const wer = (who.user && who.user.id) || who.guestId || null;
      const frisch = Date.now() - 10 * 60000;
      let laeuft = false;
      for (const [, v] of NZ_AUFTRAEGE) if (v && v.status === 'laeuft' && v.wer && v.wer === wer && v.seit > frisch) { laeuft = true; break; }
      if (laeuft) return res.status(409).json({ error: 'logo wird nachgezeichnet', hinweis: 'Otto zeichnet dein Logo gerade noch nach. Sobald es fertig ist und du es bestätigt hast, kannst du starten.' });
    }
    // 1. Okt., Markus: "100 % das EAST-Logo drauf ... bei Luigi Luigi, beim Sportverein das Logo vom
    // Sportverein." fr_<slug>.png ist das Logo eines FREIGEGEBENEN Betriebs (postkarte/logos oder
    // Volume) - es liegt nicht in uploads, bis es hier einmal dorthin kopiert wird. Nur fuer Mottos,
    // die das Haus-Logo tragen (hausTextil), und nur fuer Betriebe mit Freigabe und Logo.
    if (id && /^fr_[a-z0-9]{1,60}\.png$/.test(id)) {
      if (!motto.hausTextil) return res.status(400).json({ error: 'upload ungueltig' });
      const slug = id.slice(3, -4);
      const kernS = (s) => firmenSlug(s).replace(/[-_]/g, '');
      const eintrag = (await firmenListe()).find(e => kernS(e.firma) === kernS(slug) || (e.namen || []).some(n => kernS(n) === kernS(slug)));
      if (!eintrag || !(eintrag.freigabe && eintrag.freigabe.datum)) return res.status(403).json({ error: 'kein freigegebener Betrieb' });
      const png = await firmenLogoBild(eintrag, STORE);
      if (!png) return res.status(404).json({ error: 'der Betrieb hat kein Logo' });
      const datei = 'fr_' + firmenSlug(eintrag.firma) + '.png';
      try { await fs.access(path.join(STORE, 'uploads', datei)); }
      catch (e) { await fs.mkdir(path.join(STORE, 'uploads'), { recursive: true }); await fs.writeFile(path.join(STORE, 'uploads', datei), png); }
      uploadFile = datei;
      console.log('Haus-Logo:', eintrag.firma, '->', datei);
    } else if (id) {
      if (!/^(up|fl)_[a-f0-9]{16}(_nz\d*)?\.png$/.test(id)) return res.status(400).json({ error: 'upload ungueltig' });
      // fl_ = ohne Markenpruefung hochgeladenes Firmenlogo. Das darf nur der Betrieb selbst
      // benutzen, dem es gehoert - und nur als das Logo, das an seinem Konto hinterlegt ist.
      if (id.startsWith('fl_') && !(who.user && who.user.firmaLogo === id)) return res.status(403).json({ error: 'upload gehoert nicht zu diesem Konto' });
      try { await fs.access(path.join(STORE, 'uploads', id)); uploadFile = id; }
      catch (e) { return res.status(400).json({ error: 'upload nicht gefunden' }); }
      // Fassung 36: Preflight auch HIER, nicht nur beim Hochladen. Das am Firmenkonto hinterlegte
      // Logo (fl_) und ein Upload aus einer alten Browser-Sitzung kamen sonst ungeprueft ins
      // Design - genau so passiert (70-Pixel-Logo im "Safety Team", 14. Sept.).
      // Fassung 59: Nur beim Weg "exakt" (Original wird gedruckt) - beim eingearbeiteten Logo
      // zeichnet das Modell ohnehin neu, da ist ein 70-Pixel-Logo eine Vorlage, kein Druckfehler.
      if (motto.upload.mode === 'exact' && String(body.logoArt || '') === 'exakt') {
        try {
          const pf = await logoPreflight(await fs.readFile(path.join(STORE, 'uploads', id)));
          if (pf && pf.stufe === 'unbrauchbar') {
            return res.status(400).json({ error: 'logo unbrauchbar', gruende: pf.gruende, quelle: id.startsWith('fl_') ? 'firma' : 'upload' });
          }
        } catch (e) { console.error('Logo-Preflight bei generate:', e && e.message ? e.message : e); }
      }
    } else if (motto.upload.required) {
      return res.status(400).json({ error: 'upload fehlt' });
    }
    // Co-Branding: optionales zweites Logo, nur wenn das Motto es erlaubt und ein erstes Logo da ist
    const id2 = String(body.uploadId2 || '');
    if (id2 && uploadFile && motto.upload.mode === 'exact' && motto.upload.coBrand) {
      if (!/^up_[a-f0-9]{16}(_nz\d*)?\.png$/.test(id2)) return res.status(400).json({ error: 'upload ungueltig' });
      try { await fs.access(path.join(STORE, 'uploads', id2)); uploadFile2 = id2; }
      catch (e) { return res.status(400).json({ error: 'upload nicht gefunden' }); }
    }
  }

  // Fassung 24-26: Otto Freestyle - Artikel ist Pflicht, das Foto liegt nur im Arbeitsspeicher
  let artikel = null, foto = null;
  if (motto.freestyle) {
    // 19. Sept., "Gruesse aus": der Artikel steht am Motto fest (Postkarte) - dann zaehlt nicht,
    // was die Seite schickt, und die erste Flaeche des Artikels ist die Flaeche.
    const aid = motto.artikelFest ? String(motto.artikelFest) : String(body.artikelId || '').replace(/[^a-z0-9_-]/g, '');
    let fl = String(body.flaeche || '').replace(/[^A-Za-z0-9_.x-]/g, '');
    // 20. Sept., Postkartenart: die gewaehlte Kachel (Hochformat, Panorama) bestimmt die Flaeche
    // des festen Artikels; ohne Kachel bleibt es die erste Flaeche (A6 quer).
    if (motto.artikelFest) fl = wahlFlaeche(motto, values) || Object.keys(flaechenVon(aid))[0] || '';
    if (!ARTIKEL[aid] || !verkaufsfaehig(aid)) return res.status(400).json({ error: 'artikel fehlt' });
    const a = ARTIKEL[aid];
    let lw, flKey = fl, frei = false;
    if (a.verfahren === 'dtf' && (body.breiteCm || body.hoeheCm)) {
      // Textil: der Kunde nennt das Mass selbst
      lw = freieLeinwand(a, body.breiteCm, body.hoeheCm);
      if (!lw) return res.status(400).json({ error: 'groesse ungueltig', hinweis: `Breite und Höhe bitte zwischen ${FREI_CM.min} und ${FREI_CM.max} cm.` });
      flKey = `${lw.netto[0]}x${lw.netto[1]}`; frei = true;
    } else {
      const flaechen = flaechenVon(aid);
      if (!flaechen[fl]) return res.status(400).json({ error: a.verfahren === 'dtf' ? 'groesse ungueltig' : 'flaeche fehlt', hinweis: a.verfahren === 'dtf' ? 'Bitte Breite und Höhe in Zentimetern angeben.' : undefined });
      lw = artikelLeinwand(aid, fl);
      if (!lw) return res.status(400).json({ error: 'flaeche fehlt' });
    }
    // dpiExakt muss MIT: die gerundete Zahl ist zum Anzeigen, gerechnet wird mit der exakten -
    // makeMaster bringt die Datei damit auf genau das bestellte Mass (Fassung 73).
    artikel = { id: aid, flaeche: flKey, frei, seite: frei && body.druckSeite === 'ruecken' ? 'ruecken' : undefined, name: a.name, label: lw.label, motivart: a.motivart, verfahren: a.verfahren, size: lw.size, px: lw.px, dpi: lw.dpi, dpiExakt: lw.dpiExakt || lw.dpi, netto: lw.netto, brutto: lw.brutto, warnung: lw.warnung || null };
    // Sublimation und UV drucken auf weisse bzw. helle Traeger - dort gelten die Regeln fuer
    // helles Textil. Unterschieden nach dem Verfahren (25. Sept.): Sublimation hat GAR KEINE
    // weisse Farbe - das Weiss ist immer der Traeger selbst, eine weisse Flaeche waere dort
    // unbedruckt. Das ist genau der Fall 'weiss'. Beim UV-Druck gibt es sehr wohl Weiss
    // (weisse Grundierung auf Holz oder farbigem Acryl), deshalb bleibt es dort bei 'hell'.
    if (a.verfahren === 'sublimation') textile = 'weiss';
    else if (a.verfahren !== 'dtf') textile = 'hell';
    // Auch der Freitext darf keinen geschuetzten Namen enthalten (er wird nicht "gedruckt", aber gemalt)
    if (!markenFrei(motto)) {
      const hit = marken.checkAll([values.motiv, values.text_gross, values.text_klein].filter(Boolean), ortsNamen(values), markenKontext(motto, values));
      if (hit) { await verbotenMerken({ quelle: 'marke-freitext', wort: hit.wort, eingabe: hit.eingabe, motto: motto.slug, req }); return res.status(400).json({ error: 'marke', wort: hit.wort, eingabe: hit.eingabe, ausweg: !!motto.freestyle }); }
      // 6. Okt.: auch was in keiner Liste steht (Bands, Filme, Figuren ...) VOR dem Malen finden - die Seite bietet dann den Ausweg an
      if (motto.freestyle) {
        const namen = await geschuetztFinden([values.motiv, values.text_gross, values.text_klein].filter(Boolean).join(' \n '));
        if (namen.length) { await verbotenMerken({ quelle: 'marke-wunsch', wort: namen.join(', '), eingabe: String(values.motiv || '').slice(0, 200), motto: motto.slug, req }); return res.status(400).json({ error: 'marke', wort: namen[0], eingabe: namen.join(', '), ausweg: true }); }
      }
    }
    const modus = fotoModusVon(values.foto_modus);
    if (modus) {
      const sid = String(body.fotoSitzung || '').replace(/[^a-z0-9_]/g, '');
      const e = fotoGehoert(sid, who) ? fotoHolen(sid) : null;
      if (!e) return res.status(400).json({ error: 'foto fehlt', hinweis: sid ? FOTO_TEXTE.abgelaufen : 'Bitte lade dein Foto hoch.' });
      // 19. Okt.: Hat das Motto den Haken "Ich darf dieses Foto verwenden" nicht (Freestyle: die Zusage steht am
      // Hochlade-Knopf, wie bei den Gruppen-Mottos), gilt sie mit dem Hochladen als gegeben.
      const rechteHaken = (motto.fields || []).some(f => f.key === 'foto_rechte' && !f.versteckt);
      if (rechteHaken && !values.foto_rechte) return res.status(400).json({ error: 'feld fehlt', feld: 'Ich darf dieses Foto verwenden' });
      let pruef;
      try { pruef = await pruefeFoto(e.buffer, lw.netto, modus === 'original' ? { anteil: 0.55 } : { vorlage: true }); }
      catch (err) { return res.status(400).json({ error: 'foto fehlt', hinweis: 'Das Foto konnte nicht gelesen werden.' }); }
      if (!pruef.ok) return res.status(400).json({ error: 'foto zu klein', hinweis: pruef.text || pruef.grund });
      foto = { sitzung: sid, modus, form: fotoFormVon(values.foto_form), stufe: pruef.stufe, dpi: pruef.dpi, rechte: rechteHaken ? 'Haken gesetzt' : 'beim Hochladen bestaetigt' };
    }
  }

  // 6. Okt., Markus (Kissen gewaehlt, dann "Fuer welches Textil?" und "Brust klein"): "Was sollen denn diese
  // schwachsinnigen Fragen?" Ein normales Motto kannte keinen anderen Artikel als das Shirt. Kommt ein
  // Artikel ohne DTF mit (Kissen, Poster, Tasse ... aus der Artikel-Galerie), wird auf dessen Flaeche
  // gezeichnet - wie bei Freestyle, ohne Foto-Weg und ohne Groessenfrage.
  if (!artikel && !motto.freestyle && body.artikelId) {
    const aid = String(body.artikelId).replace(/[^a-z0-9_-]/g, '');
    const a = ARTIKEL[aid];
    if (!a || !verkaufsfaehig(aid)) return res.status(400).json({ error: 'artikel fehlt' });
    if (a.verfahren !== 'dtf') {
      const flaechen = flaechenVon(aid);
      const fl = flaechen[String(body.flaeche || '')] ? String(body.flaeche) : (Object.keys(flaechen)[0] || '');
      const lw = fl && artikelLeinwand(aid, fl);
      if (!lw) return res.status(400).json({ error: 'flaeche fehlt' });
      artikel = { id: aid, flaeche: fl, frei: false, name: a.name, label: lw.label, motivart: a.motivart, verfahren: a.verfahren, size: lw.size, px: lw.px, dpi: lw.dpi, dpiExakt: lw.dpiExakt || lw.dpi, netto: lw.netto, brutto: lw.brutto, warnung: lw.warnung || null };
      if (a.verfahren === 'sublimation') textile = 'weiss';
      else textile = 'hell';
    }
  }

  // 2. Okt., Gruppen-Mottos (gruppenFoto): ein Foto ist freiwillig. Liegt eins in der Sitzung, werden
  // die Leute davon gezeichnet (Weg "gruppe"); sonst laeuft alles wie bisher.
  if (!foto && motto.gruppenFoto) {
    const sid = String(body.fotoSitzung || '').replace(/[^a-z0-9_]/g, '');
    if (sid) {
      const e = fotoGehoert(sid, who) ? fotoHolen(sid) : null;
      if (!e) return res.status(400).json({ error: 'foto fehlt', hinweis: FOTO_TEXTE.abgelaufen });
      // Die Rechte sind mit dem Hochladen bestaetigt - der Satz steht am Foto (GRUPPENFOTO_FELDER).
      foto = { sitzung: sid, modus: 'gruppe', rechte: 'beim Hochladen bestaetigt' };
    }
  }

  // Fassung 32 (Markus): "Bei aller Designerzeugung ueberall mit angeben, in welcher Groesse die Leute
  // sich das wuenschen." Jedes Motto nimmt Breite x Hoehe in Zentimetern an; die Leinwand kommt dann
  // aus dem Mass, die Druckdatei behaelt genau diese Groesse, und der Artikel-Block (Textil, DTF)
  // steht im Prompt. Leer = wie bisher (Platzierung oder Standardgroesse).
  if (!artikel && (body.breiteCm || body.hoeheCm)) {
    const a = ARTIKEL.tshirt;
    const lw = a && freieLeinwand(a, body.breiteCm, body.hoeheCm);
    if (!lw) return res.status(400).json({ error: 'groesse ungueltig', hinweis: `Breite und Höhe bitte zwischen ${FREI_CM.min} und ${FREI_CM.max} cm.` });
    artikel = { id: 'tshirt', flaeche: `${lw.netto[0]}x${lw.netto[1]}`, frei: true, nurGroesse: true, seite: body.druckSeite === 'ruecken' ? 'ruecken' : undefined, name: 'Textil', label: lw.label, motivart: a.motivart, verfahren: a.verfahren, size: lw.size, px: lw.px, dpi: lw.dpi, dpiExakt: lw.dpiExakt || lw.dpi, netto: lw.netto, brutto: lw.brutto, warnung: lw.warnung || null };
  }

  // Fassung 33 (Markus): "Da steht 'weil wir können' statt 'weil wir das können' - wie bekommen wir
  // das korrigiert, ohne das Design zu verändern?" Korrektur = neuer Auftrag, der das fertige
  // Motiv als Vorlage in die Bildbearbeitung gibt und NUR die geaenderten Texte austauscht.
  // Das Original bleibt unangetastet, die Korrektur bekommt eine eigene Nummer.
  let korrektur = null;
  if (body.korrekturVon) {
    const von = String(body.korrekturVon).replace(/[^A-Za-z0-9_-]/g, '');
    const jf = await readJob(von);
    if (!jf || !(await designGehoert(von, who))) return res.status(400).json({ error: 'korrektur unbekannt' });
    if (jf.motto !== motto.slug) return res.status(400).json({ error: 'korrektur unbekannt' });
    // 19. Okt., Markus: "ein Tool, um an einem Design, das den Kunden gefaellt, nur Teilstuecke zu aendern" - der
    // freie Aenderungswunsch geht mit; die Markensperre gilt fuer ihn wie fuer jeden anderen Text.
    const aenderung = cleanValue(body.aenderung, 300) || '';
    if (aenderung && !markenFrei(motto)) {
      const hit = marken.checkAll([aenderung]);
      if (hit) { await verbotenMerken({ quelle: 'marke-aenderung', wort: hit.wort, eingabe: hit.eingabe, motto: motto.slug, req }); return res.status(400).json({ error: 'marke', wort: hit.wort, eingabe: hit.eingabe }); }
    }
    korrektur = { von, alt: jf.values || {}, aenderung };
  }

  // Stil und Lieblingsfarben - auf jeder Motto-Seite waehlbar, sofern im Motto nicht abgeschaltet
  let style = String(body.style || 'standard');
  if (!STYLE_KEYS.includes(style)) return res.status(400).json({ error: 'stil ungueltig' });
  if (motto.styleChoice === false) style = 'standard';
  let colors = cleanValue(body.colors, 40);
  if (colors === null) colors = '';
  if (motto.colorChoice === false) colors = '';

  // Vom Kunden gewaehlte Schriftart fuer die Namen (Namensband / Rueckseiten-Liste)
  const nameFont = ['rund', 'schmal', 'serif'].includes(body.nameFont) ? body.nameFont : (motto.nameFont || 'rund');

  if (overDailyLimit()) return res.status(429).json({ error: 'tageslimit' });
  // Eine volle Schlange war bisher eine Sackgasse: ab 60 Wartenden bekam jeder weitere ein
  // "gerade ist viel los, probier es spaeter". Gemessen mit 200 gleichzeitigen Kunden: 64
  // kamen rein, 136 wurden weggeschickt. Das sind verlorene Kunden, obwohl der Server nicht
  // am Limit war - die Wartezeit haengt am Bilddienst, nicht an uns. Also: die Schlange darf
  // lang werden, und der Kunde bekommt die Wahrheit plus die Mail, statt der Tuer.
  // Abgewiesen wird erst, wenn die Wartezeit jeden Sinn verliert (GRENZE_WARTEN_SEK).
  const MAX_QUEUE = Math.max(10, +env.MAX_QUEUE || 300);
  const GRENZE_WARTEN_SEK = Math.max(300, +env.MAX_WARTEN_SEK || 3600);
  if (queue.length >= MAX_QUEUE || wartezeitSek(queue.length) > GRENZE_WARTEN_SEK) {
    return res.status(503).json({ error: 'ausgelastet', wartenSek: wartezeitSek(queue.length) });
  }

  // Kontingent greift nur bei ACCOUNTS=on (who kommt von oben, vor der Upload-Pruefung).
  let via = 'guest';
  if (ACCOUNTS_ON) {
    const q = quotaCheck(who.user, who.guest);
    if (!q.ok) {
      if (q.reason === 'login') return res.status(401).json({ error: 'anmelden', frei: GUEST_FREE });
      // Bezahlschranke nur, wenn Bezahlung wirklich eingerichtet ist. Sonst NICHT blocken,
      // sondern kostenlos weiterlaufen lassen (Login/Konto aktiv, aber ohne Sackgasse).
      if (stripeCfg && env.STRIPE_SECRET_KEY) return res.status(402).json({ error: 'bezahlen', konto: accountView(who.user) });
      via = 'frei';
    } else {
      via = q.via;
    }
  }

  // Farbstimmung und Druckplatzierung (Fassung 15). Die Platzierung bestimmt das Format der
  // Druckdatei - darum wird sie nur genommen, wenn das Motto sie ueberhaupt anbietet.
  const mood = MOODS[String(body.mood || '')] ? String(body.mood) : 'standard';
  // Fassung 54: Wie soll der Name erscheinen? Gross unter dem Motiv (wie bisher) oder ins Motiv
  // gesetzt, auf ein Kleidungsstueck einer Figur.
  const nameArt = String(body.nameArt || '') === 'motiv' ? 'motiv' : 'unten';
  // Fassung 59: Wie das Logo ins Design kommt - nachgezeichnet und eingearbeitet (Standard) oder
  // das Original unveraendert auf einer leeren Plakette.
  const logoArt = String(body.logoArt || '') === 'exakt' ? 'exakt' : 'eingearbeitet';
  // Fassung 73: Prompt-Fassung je Auftrag - damit sich alt und schlank am selben Motto
  // vergleichen lassen, ohne den globalen Schalter umzulegen. Leer = die eingestellte Fassung.
  const fassung = ['alt', 'schlank'].includes(String(body.fassung || '')) ? String(body.fassung) : '';
  // Fassung 55: Wie die Leute im Motiv gezeichnet werden.
  // 24. Sept.: Welche Arten ein Motto ueberhaupt anbietet, entscheidet mottos.js (figurenFuer).
  // Bei der Postkarte kommt der Mensch aus einem echten Foto - dort gibt es weder Strichmaennchen
  // (Markus ausdruecklich) noch Maskottchen noch "ohne Menschen". Was die Seite nicht anbietet,
  // darf auch ueber die Schnittstelle nicht hereinkommen.
  const figurenErlaubt = new Set(figurenFuer(motto).map(f => f.key));
  // Ohne Foto gibt es bei den Gruppen-Mottos keine Figurenfrage (Markus, 1. Okt.) - dann gilt die Vorgabe.
  const figuren = (motto.gruppenFoto && !foto) ? 'standard' : (figurenErlaubt.has(String(body.figuren || '')) ? String(body.figuren) : 'standard');
  // Eine freie Groesse ersetzt die Platzierung - sonst staenden zwei Masse im Prompt.
  const placement = !(artikel && artikel.frei) && motto.placementChoice && PRINT_PLACEMENTS[String(body.placement || '')] ? String(body.placement) : '';

  // Fassung 74: Eine Platzierung nennt ein Mass - der Knopf heisst "Brust links (klein) ·
  // 10 x 10 cm". Bisher aenderte die Wahl nur den Prompt: die Druckdatei kam trotzdem in
  // 36 x 46 cm heraus, also in einem anderen Mass, als der Kunde angeklickt hatte.
  // leinwandFuer() rechnet das richtige Mass seit Fassung 22 aus, es war nur nie angeschlossen.
  // Eine ausdrueckliche Groesse (Breite/Hoehe) geht weiterhin vor - sie ist die genauere Angabe.
  if (!artikel && placement) {
    const a = ARTIKEL.tshirt;
    const lw = leinwandFuer(placement, 'shirt');
    const cm = lw && /([\d,.]+)\s*[x×]\s*([\d,.]+)/.exec(PRINT_PLACEMENTS[placement].mass);
    if (lw && cm) {
      const netto = [parseFloat(cm[1].replace(',', '.')), parseFloat(cm[2].replace(',', '.'))];
      artikel = { id: 'tshirt', flaeche: placement, frei: true, nurGroesse: true, name: 'Textil', label: PRINT_PLACEMENTS[placement].label, motivart: a.motivart, verfahren: a.verfahren, size: lw.size, px: lw.px, dpi: lw.dpi, dpiExakt: lw.dpiExakt || lw.dpi, netto, brutto: netto, warnung: null };
    }
  }

  const jobId = 'mo_' + crypto.randomBytes(8).toString('hex');
  // Druck-Aufteilung (Fassung 9): Kaderliste/Brust-Print nur, wenn das Motto es anbietet und Namen da sind
  const aufteilung = motto.kader !== false && names.length && AUFTEILUNGEN.includes(String(body.aufteilung || '')) ? String(body.aufteilung) : 'vorne';
  const job = { jobId, status: 'queued', qa: [], created: new Date().toISOString(), input: { motto, values, uploadFile, uploadFile2, style, colors, names, people, aufteilung, textile, textilGewaehlt: textilGewaehlt || !!(artikel && artikel.verfahren !== 'dtf'), nameFont, mood, nameArt, logoArt, fassung, figuren, placement, artikel, motivart: artikel ? artikel.motivart : undefined, foto, korrektur, ...(linie ? { linie } : {}) }, who: { userId: who.user ? who.user.id : null, guestId: who.guestId, via, quelle: quelleVon(req) } };
  // Die Auftragsnummer wird beim EINGANG vergeben, nicht beim Fertigstellen. Sonst bekommt
  // bei mehreren gleichzeitigen Auftraegen der zuerst fertige die kleinere Nummer - und die
  // Reihenfolge der Nummern passt nicht mehr zur Reihenfolge in der Liste.
  job.lfdNr = await naechsteLaufnummer();
  // Fassung 74: Was bestellen die Leute wirklich? Nur feste Werte aus dem eigenen Katalog,
  // nie ein Wort aus einer Kundeneingabe - siehe Kopf von zaehler.js.
  zaehl('auftrag', motto.slug);
  zaehl('stil', style || 'standard');
  zaehl('konto', who.user ? 'angemeldet' : 'gast');
  if (artikel) {
    zaehl('artikel', artikel.nurGroesse ? 'nur-groesse' : artikel.id);
    // Ein selbst getipptes Mass ist KEIN Schluessel: 3 bis 45 cm in Halbschritten sind
    // siebentausend moegliche Werte, die die Datei zumuellen wuerden, ohne etwas zu sagen.
    // Gezaehlt wird die Katalogflaeche oder die Platzierung - sonst nur "freie Groesse".
    if (PRINT_PLACEMENTS[artikel.flaeche]) zaehl('flaeche', artikel.flaeche);
    else if (artikel.frei) zaehl('flaeche', 'freie-groesse');
    else zaehl('flaeche', String(artikel.flaeche || 'standard'));
  } else {
    zaehl('artikel', 'kein-artikel');
    if (placement) zaehl('flaeche', placement);
  }
  jobs.set(jobId, job);
  enqueue(job);
  // Die Seite darf NICHT frueher aufgeben als der Server arbeitet. Vorher stand im
  // Browser eine feste Grenze von 6 Minuten - als die Stufe 'high' kam, rechnete der
  // Server weiter, das Design landete im Backend, und der Kunde sah "dauert zu lange".
  // Darum sagt der Server, wie lange er sich Zeit nimmt.
  // Wie viele Auftraege muessen vor diesem fertig werden? Steht er schon nicht mehr in der
  // Schlange, hat pump() ihn direkt gestartet - dann ist er sofort dran. Sonst: seine Stelle
  // in der Schlange plus die, die gerade laufen. eta kommt aus gemessenen Laufzeiten.
  const stelle = queue.indexOf(job);
  const vorMir = stelle < 0 ? 0 : stelle + running;
  res.json({ jobId, eta: wartezeitSek(vorMir), position: vorMir + 1, warten: queue.length, bereinigt, names, aufteilung, maxMs: JOB_TIMEOUT_MS,
    // Darf die Seite "sag mir Bescheid, wenn es fertig ist" anbieten? Nur wenn Mail eingerichtet ist -
    // ein Angebot, das ins Leere laeuft, ist schlimmer als gar keins.
    mailAn: !!env.BREVO_API_KEY, meineMail: (who.user && who.user.email) || '' });
});

// ---------- „Sag mir Bescheid, wenn es fertig ist" ----------
// Ein Design dauert Minuten. Wer nicht davor sitzen bleiben will, hinterlegt seine
// E-Mail und macht die Seite zu - wir schreiben, sobald das Bild da ist. Ohne das
// hier ist die einzige Wahl: warten oder das Design verlieren.
const jobHolen = async (id) => {
  if (!/^mo_[a-f0-9]{16}$/.test(String(id || ''))) return null;
  let j = jobs.get(id);
  if (!j) { try { j = JSON.parse(await fs.readFile(path.join(QUEUE_DIR, `${id}.json`), 'utf8')); if (j && j.jobId) jobs.set(j.jobId, j); } catch (e) { j = null; } }
  return j || null;
};
// Gehoert der Auftrag dem, der gerade fragt? Die jobId allein reicht nicht als Nachweis -
// sonst koennte jeder mit geratener Nummer fremde Designs an seine Adresse schicken lassen.
const meinAuftrag = (job, who) =>
  !!(job && job.who && ((who.user && job.who.userId === who.user.id) || (!job.who.userId && who.guestId && job.who.guestId === who.guestId)));

// Welche Wege die Seite anbieten darf (ohne Zugangsdaten: nur ja/nein).
app.get('/api/mo/benachrichtigen/wege', (req, res) => {
  res.json({ email: !!env.BREVO_API_KEY, whatsapp: whatsappAn(env) });
});
app.post('/api/mo/benachrichtigen', async (req, res) => {
  const body = req.body || {};
  const job = await jobHolen(body.jobId);
  if (!job) return res.status(404).json({ error: 'auftrag unbekannt' });
  const who = await identify(req, res);
  if (!meinAuftrag(job, who)) return res.status(403).json({ error: 'nicht dein Auftrag' });
  // 2. Okt., Markus ("WhatsApp und 4"): beim Partner auch per WhatsApp. Kommt eine Nummer, gilt sie;
  // die Adresse aus dem Konto wird dann nicht stillschweigend dazugenommen.
  const nummerRoh = String(body.whatsapp || '').trim();
  if (nummerRoh) {
    const nummer = nummerSauber(nummerRoh);
    if (!nummer) return res.status(400).json({ error: 'nummer ungueltig', hinweis: 'Bitte eine Handynummer eingeben, z. B. 0171 2345678.' });
    if (!whatsappAn(env)) return res.status(503).json({ error: 'whatsapp aus', hinweis: 'WhatsApp ist gerade nicht eingerichtet.' });
    const partnerSlug = /^[a-z0-9]{2,40}$/.test(String(body.partner || '')) ? String(body.partner) : '';
    job.melde = { ...(job.melde || {}), whatsapp: nummer, partner: partnerSlug, at: new Date().toISOString() };
    await saveJob(job);
    if (job.status === 'done' || job.status === 'error' || job.status === 'qa_failed') meldeFertig(job);
    if (job.status === 'done') meldeChef(job);
    return res.json({ ok: true, whatsapp: nummerVerdeckt(nummer) });
  }
  const email = normEmail(body.email) || (who.user && who.user.email) || '';
  if (!email) return res.status(400).json({ error: 'email ungueltig' });
  if (!env.BREVO_API_KEY) return res.status(503).json({ error: 'mail aus', hinweis: 'Der Mailversand ist gerade nicht eingerichtet.' });
  job.melde = { ...(job.melde || {}), email, at: new Date().toISOString() };
  await saveJob(job);
  // Ist der Auftrag in der Zwischenzeit schon fertig geworden, geht die Mail sofort raus.
  if (job.status === 'done' || job.status === 'error' || job.status === 'qa_failed') meldeFertig(job);
  if (job.status === 'done') meldeChef(job);
  res.json({ ok: true, email });
});

// Die Mail selbst. Wird genau einmal je Auftrag verschickt - egal ob er gut ausging
// oder nicht. Auch ein Fehlschlag gehoert gemeldet: sonst wartet jemand auf eine Mail,
// die nie kommt, und haelt uns fuer kaputt.
function fertigMail(job, ziel) {
  const base = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const gut = job.status === 'done';
  const slug = job.input && job.input.motto ? job.input.motto.slug : '';
  const kopf = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#222;max-width:520px"><p style="font-size:22px;font-weight:bold;margin:0 0 14px">Motto Otto</p>`;
  const knopf = (t, href) => `<p style="margin:22px 0"><a href="${href}" style="background:#ffc542;color:#1b1710;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px;display:inline-block">${t}</a></p>`;
  // Der Hinweis auf den Anmelde-Link gehoert nur in die Mail, die auch einen enthaelt -
  // die Fehler-Mail schickt zurueck aufs Motto, nicht ins Konto.
  const anmeldeLink = gut && !(job.who && job.who.userId);
  const fuss = `<p style="color:#999;font-size:12px;margin-top:26px">Design-Nummer: ${escHtml(job.designId || job.jobId)}${anmeldeLink ? ' · Der Knopf meldet dich an und holt dein Design ins Konto. Er gilt 3 Tage.' : ''}</p></div>`;
  // Das Motiv auf dem Teil sieht in der Mail besser aus als die nackte Vorschau.
  // Fassung 74: auf dem BESTELLTEN Teil. Hier stand fest "tee" - wer ein Strandtuch bestellt
  // hatte, bekam ein T-Shirt in die Mail (Markus, 17. Sept.: "Ich habe mir ein Strandtuch
  // ausgesucht, bekomme aber ein Mockup mit T-Shirt"). Gibt es fuer den Artikel kein eigenes
  // Mockup, zeigt die Mail lieber das nackte Motiv als ein fremdes Teil.
  const bestellt = job.input && job.input.artikel ? ansichtVon(job.input.artikel.id) : '';
  const ansicht = bestellt && job.mockups && job.mockups[bestellt] ? bestellt
    : (!bestellt && job.mockups && job.mockups.tee ? 'tee' : '');
  const bildUrl = (ansicht && job.mockups[ansicht][job.input && istHell(job.input.textile) ? 'white' : 'black']) || job.preview || '';
  const bild = gut && bildUrl ? `<p style="margin:18px 0"><img src="${bildUrl}" alt="Dein Design" style="max-width:100%;border-radius:10px"></p>` : '';
  // 2. Okt., Markus: das Motiv soll auch zugeschickt werden - "eine [Datei], die [kleine] Aufloesung
  // hat, und gleichzeitig ein Bild ... in der Aufloesung, so wie das wirklich aussieht". Als Anhang:
  // das Motiv als Vorschau (800 px, Wasserzeichen) und die Ansicht auf dem bestellten Teil (das
  // Mockup in voller Groesse, Wasserzeichen). Die Druckdatei NIE - die ist das, was er kauft.
  const nr = String(job.designId || job.jobId).replace(/[^A-Za-z0-9_-]/g, '');
  const anhang = [];
  if (gut && job.preview) anhang.push({ url: job.preview, name: `Motiv-${nr}.png` });
  const teilUrl = ansicht ? job.mockups[ansicht][job.input && istHell(job.input.textile) ? 'white' : 'black'] : '';
  if (gut && teilUrl) anhang.push({ url: teilUrl, name: `${String((job.mockups[ansicht] && job.mockups[ansicht].label) || ansicht).replace(/[^A-Za-z0-9ÄÖÜäöüß-]/g, '')}-${nr}.jpg` });
  const anhangSatz = anhang.length ? `<p style="color:#555">Im Anhang: dein Motiv${anhang.length > 1 ? ' und wie es auf dem Teil aussieht' : ''}.</p>` : '';
  // Der Satz darunter muss zum Bestellten passen. Wer eine Fußmatte bestellt hat, soll nicht
  // lesen, er koenne sein Motiv auf T-Shirt, Hoodie und Zip-Jacke ansehen.
  //
  // Fassung 74 (Markus, 17. Sept.: "Die Druckdatei kann er sich auch nicht runterladen, weil er
  // nicht bezahlt"): Hier stand "und die Druckdatei herunterladen". Das war schlicht falsch -
  // /api/mo/master/ kommt nur durch masterGuard, also Chef oder Druckerei, nie ein Kunde.
  // Ein Versprechen, das die Seite nicht halten kann, gehoert nicht in die Mail. Was der Kunde
  // wirklich bekommt: sein Motiv auf dem bestellten Teil - und die Groesse, die es haben wird.
  const art = job.input && job.input.artikel;
  const massSatz = art && Array.isArray(art.netto)
    ? ` Die Druckdatei liegt in Echtgröße bereit: ${String(art.netto[0]).replace('.', ',')} × ${String(art.netto[1]).replace('.', ',')} cm.` : '';
  const schauSatz = art && !art.nurGroesse
    ? `Schau es dir in Ruhe an – du siehst dein Motiv auf ${escHtml(art.name)}.${massSatz}`
    : `Schau es dir in Ruhe an – du kannst dein Motiv dort auf T-Shirt, Hoodie und Zip-Jacke in Schwarz und Weiß ansehen.${massSatz}`;
  return {
    subject: gut ? 'Dein Design ist fertig ✓' : 'Dein Design hat leider nicht geklappt',
    anhang,
    html: gut
      ? kopf + `<p><b>Dein Design ist fertig. 🎉</b></p>${bild}<p>${schauSatz}</p>${anhangSatz}` + knopf('Mein Design ansehen', ziel) + fuss
      : kopf + `<p><b>Dein Design ist leider nicht fertig geworden.</b></p><p>${job.hint === 'marke' ? 'Einer der Begriffe ist ein geschützter Name – mit einem anderen Wort klappt es.' : 'Beim Zeichnen ist etwas schiefgegangen.'} Ein neuer Versuch dauert nur ein paar Minuten, und jeder Lauf sieht anders aus.</p>` + knopf('Noch einmal starten', slug ? `${base}/m/${slug}` : base) + fuss
  };
}

// 30. Sept., Markus: "Ich moechte, dass du mir einbaust, dass ich eine Nachricht bekomme, wenn
// jemand ein Design erstellt hat." Eine Mail an ADMIN_EMAIL (oder DESIGN_MAIL_AN) je fertigem
// Kundendesign: Motto, Eingaben, Stil, Textil, Artikel, von wem (Konto-Adresse oder Gast, Geraet),
// das Motiv auf dem bestellten Teil und der Sprung ins Backend. Vorzeige-, Automatik- und
// Pruefstand-Laeufe schweigen - das waeren Dutzende Mails ohne Kunden dahinter. Fehlschlaege
// auch: gewuenscht war "erstellt hat". DESIGN_MAIL=aus schaltet ab.
async function meldeChef(job) {
  try {
    if (!job || job.status !== 'done' || job.chefGemeldet) return;
    if (job.vorzeige || job.auto || job.test || (job.who && job.who.via === 'pruefstand')) return;
    if (String(env.DESIGN_MAIL || 'an').toLowerCase() === 'aus') return;
    const to = env.DESIGN_MAIL_AN || env.ADMIN_EMAIL;
    if (!to) return;
    job.chefGemeldet = true;
    const base = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const inp = job.input || {};
    const motto = inp.motto || {};
    const eingaben = Object.values(inp.values || {}).map(v => String(v || '').trim()).filter(Boolean);
    let von = 'Gast';
    if (job.who && job.who.userId) {
      try { const u = await accounts.byId(job.who.userId); von = (u && u.email) || 'Konto'; } catch (e) { von = 'Konto'; }
    }
    const geraet = (job.who && job.who.quelle) || '';
    const stil = inp.style && STYLES[inp.style] ? STYLES[inp.style].label : 'wie vorgesehen';
    const textil = ({ weiss: 'weißes Textil', hell: 'helles Textil', dunkel: 'dunkles Textil', schwarz: 'schwarzes Textil' })[inp.textile] || inp.textile || '';
    const artikel = inp.artikel ? `${inp.artikel.name}${inp.artikel.label ? ' · ' + inp.artikel.label : ''}` : '';
    const bestellt = inp.artikel ? ansichtVon(inp.artikel.id) : '';
    const ansicht = bestellt && job.mockups && job.mockups[bestellt] ? bestellt : (!bestellt && job.mockups && job.mockups.tee ? 'tee' : '');
    const bildUrl = (ansicht && job.mockups[ansicht][istHell(inp.textile) ? 'white' : 'black']) || job.preview || '';
    const zeile = (k, v) => v ? `<tr><td style="color:#777;padding:3px 10px 3px 0;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:3px 0">${escHtml(v)}</td></tr>` : '';
    const subject = `Neues Design: ${motto.name || motto.slug || '?'}${eingaben[0] ? ' · ' + eingaben[0].slice(0, 40) : ''} (${von === 'Gast' ? 'Gast' : von})`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:560px">`
      + `<p style="font-size:20px;font-weight:bold;margin:0 0 12px">Jemand hat ein Design gemacht</p>`
      + (bildUrl ? `<p style="margin:12px 0"><img src="${bildUrl}" alt="Design" style="max-width:100%;border-radius:10px"></p>` : '')
      + `<table style="border-collapse:collapse;font-size:15px">`
      + zeile('Motto', motto.name || motto.slug) + zeile('Eingaben', eingaben.join(' · ')) + zeile('Stil', stil) + zeile('Textil', textil) + zeile('Artikel', artikel)
      + zeile('Namen', Array.isArray(inp.names) && inp.names.length ? inp.names.length + ' (' + inp.names.slice(0, 5).join(', ') + (inp.names.length > 5 ? ' …' : '') + ')' : '')
      + zeile('Von', von + (geraet ? ' · ' + geraet : '')) + zeile('Nummer', job.designId || job.jobId) + `</table>`
      + `<p style="margin:20px 0"><a href="${base}/admin" style="background:#ffc542;color:#1b1710;text-decoration:none;font-weight:bold;padding:11px 18px;border-radius:8px;display:inline-block">Im Backend ansehen</a></p>`
      + `<p style="color:#999;font-size:12px">Diese Mail kommt bei jedem fertigen Kundendesign. Abschalten: DESIGN_MAIL=aus in Railway.</p></div>`;
    await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to, subject, html });
    console.log('Chef-Mail:', job.designId || job.jobId, '->', to);
  } catch (e) { console.error('Chef-Mail:', e && e.message ? e.message : e); }
}
// WhatsApp "Dein Motiv ist fertig": einmal je Auftrag, nur bei Erfolg (die freigegebene Vorlage sagt
// "fertig"). Der Link fuehrt mit der Auftragsnummer zurueck auf die Partnerseite - er klappt auch im
// Browser von WhatsApp, der den Speicher des Handy-Browsers nicht kennt. Danach ist die Nummer weg.
async function meldeWhatsapp(job) {
  if (!job || !job.melde || !job.melde.whatsapp || job.waGesendet) return;
  job.waGesendet = true;
  const nummer = job.melde.whatsapp;
  try {
    if (job.status === 'done') {
      const base = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
      const slug = job.input && job.input.motto ? job.input.motto.slug : '';
      const art = job.input && job.input.artikel ? `&a=${encodeURIComponent(job.input.artikel.id)}` : '';
      const link = job.melde.partner ? `${base}/bei/${job.melde.partner}/machen?lauf=${job.jobId}&m=${encodeURIComponent(slug)}${art}` : `${base}/m/${slug}`;
      await whatsappSenden(env, nummer, link);
      console.log('Fertig-WhatsApp:', job.jobId, '->', nummerVerdeckt(nummer));
    } else {
      console.log('Fertig-WhatsApp:', job.jobId, 'nicht gesendet, Auftrag', job.status || '?');
    }
  } catch (e) {
    console.error('Fertig-WhatsApp:', job.jobId, e && e.message ? e.message : e);
  }
  job.melde = { ...job.melde, whatsapp: '', whatsappVerdeckt: nummerVerdeckt(nummer) };
  await saveJob(job);
}
// 2. Okt., Markus: "Ich bekomme, wenn ich das selber fertigstelle, keine E-Mail, dass das Design fertig
// ist - allerdings die Nachricht, dass jemand ein Design gemacht hat. Das ist natuerlich doof ...
// Kaufabbruch!" Die Fertig-Mail ging nur raus, wenn der Kunde "Keine Lust zu warten?" angetippt
// hatte. Jetzt bekommt sie JEDER Kunde mit Konto automatisch - auch wer gewartet hat: die Mail mit
// Motiv und Ansicht ist die Erinnerung, die ihn zum Kauf zurueckholt. Gaeste ohne Adresse nur, wenn
// sie eine hinterlegen. Vorzeige-, Automatik- und Pruefstand-Laeufe bekommen keine (wie meldeChef).
async function meldeAdresseAusKonto(job) {
  try {
    if (!job || job.status !== 'done' || (job.melde && job.melde.email)) return;
    if (job.vorzeige || job.auto || job.test || (job.who && job.who.via === 'pruefstand')) return;
    if (!(job.who && job.who.userId) || !env.BREVO_API_KEY) return;
    const u = await accounts.byId(job.who.userId);
    const email = u && normEmail(u.email);
    if (!email) return;
    job.melde = { ...(job.melde || {}), email, at: new Date().toISOString(), ausKonto: true };
  } catch (e) { console.error('Fertig-Mail (Adresse aus dem Konto):', job && job.jobId, e && e.message ? e.message : e); }
}
async function meldeFertig(job) {
  if (job && job.melde && job.melde.whatsapp) await meldeWhatsapp(job);
  if (!job || !job.melde || !job.melde.email || job.meldeGesendet) return;
  job.meldeGesendet = true;
  try {
    const to = job.melde.email;
    const base = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const slug = job.input && job.input.motto ? job.input.motto.slug : '';
    // Angemeldete Kunden finden das Design im Konto. Gaeste bekommen einen Anmelde-Link:
    // damit wandern ihre Gast-Designs beim Klick automatisch ins Konto (adoptGuest) -
    // genau der Weg, den wir ihnen auf der Seite anbieten.
    // Nur fuer die Erfolgs-Mail: die Fehler-Mail schickt zurueck aufs Motto und braucht
    // keinen Anmelde-Link - sonst legten wir bei jedem Fehlschlag einen ungenutzten an.
    let ziel = `${base}/konto`;
    if (job.status === 'done' && !(job.who && job.who.userId)) {
      try { ziel = `${base}/login?t=${await accounts.createLogin(to, '/konto', MELDE_LOGIN_MS)}`; }
      catch (e) { ziel = `${base}/m/${slug}`; }
    }
    const m = fertigMail(job, ziel);
    try {
      await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to, subject: m.subject, html: m.html, anhang: m.anhang });
    } catch (e) {
      // Ein Anhang, den Brevo nicht laden kann, darf die Mail nicht verhindern: dann ohne Anhang.
      if (!(m.anhang && m.anhang.length)) throw e;
      console.error('Fertig-Mail mit Anhang:', job.jobId, e && e.message ? e.message : e, '- noch einmal ohne');
      await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to, subject: m.subject, html: m.html });
    }
    console.log('Fertig-Mail:', job.jobId, '->', to, job.status === 'done' ? '(fertig)' : '(' + (job.status || '?') + ')', job.melde.ausKonto ? 'aus dem Konto' : 'hinterlegt', m.anhang && m.anhang.length ? m.anhang.length + ' Anhaenge' : '');
  } catch (e) {
    // Nicht erneut versuchen: der Kunde soll lieber keine Mail bekommen als dieselbe fuenfmal.
    console.error('Fertig-Mail:', job.jobId, e && e.message ? e.message : e);
  }
  await saveJob(job);
}

// Backend: die Fertig-Mail ansehen, ohne sie zu verschicken. Sonst sieht man erst am
// lebenden Kunden, wie sie aussieht - und Textfehler stehen dann schon im Postfach.
app.get('/api/admin/mail-vorschau', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const job = (await jobHolen(req.query.jobId)) || {
    jobId: 'mo_beispiel', status: req.query.status === 'error' ? 'error' : 'done', designId: 'MO-BEISPIEL',
    preview: `${env.PUBLIC_BASE_URL}/otto/arbeitet.png`, who: { userId: null },
    input: { motto: { slug: 'sprueche-shirt' }, textile: 'schwarz' }
  };
  const m = fertigMail(job, `${String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '')}/login?t=BEISPIEL`);
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>${escHtml(m.subject)}</title><body style="background:#f4f4f6;padding:24px"><p style="font-family:Arial,sans-serif;color:#666;font-size:13px">Betreff: <b>${escHtml(m.subject)}</b></p>${m.html}`);
});

app.get('/api/mo/job/:id', async (req, res) => {
  let j = jobs.get(req.params.id);
  // Nach einem Neustart: gesicherten Auftrag vom Volume nachladen (der Kunde pollt einfach weiter)
  if (!j && /^[A-Za-z0-9_-]{4,64}$/.test(req.params.id)) {
    try { j = JSON.parse(await fs.readFile(path.join(QUEUE_DIR, `${req.params.id}.json`), 'utf8')); if (j && j.jobId) jobs.set(j.jobId, j); } catch (e) { j = null; }
  }
  if (!j) return res.status(404).json({ error: 'auftrag unbekannt' });
  let back;
  // Rueckseite: entweder die KI-Rueckseite (Abi/Schulmotto mit backPrompt) oder die Kaderliste (Aufteilung vorne-kader/brust-kader)
  const kaderBack = j.aufteilung && j.aufteilung !== 'vorne' && j.names && j.names.length;
  if ((j.back || kaderBack) && j.designId && j.sig) {
    const q = `exp=${j.sig.exp}&sig=${j.sig.sig}&side=back`;
    const bm = {};
    for (const g of produkte.enabledFor(j.motto)) {
      bm[g] = { label: GARMENTS[g].label, view: GARMENTS[g].view };
      for (const c of COLORS) bm[g][c] = `${env.PUBLIC_BASE_URL}/api/mo/mockup/${j.designId}/${g}/${c}.jpg?${q}`;
    }
    back = { count: j.back ? j.back.count : j.names.length, kader: !j.back && !!kaderBack, preview: `${env.PUBLIC_BASE_URL}/api/mo/preview/${j.designId}.png?${q}`, mockups: bm };
  }
  // Zustand der Community-Bewertung: die Ergebnisseite zeigt daraus den Schalter
  // ("darf mein Design bewertet werden?") im richtigen Zustand an.
  let bewertung;
  if (j.status === 'done' && j.designId) {
    try {
      const sc = await loadShowcase();
      const e = sc[j.designId];
      bewertung = {
        freigegeben: !!(e && e.approved),
        wunsch: e && typeof e.kundenwunsch === 'boolean' ? e.kundenwunsch : null,
        sperre: j.bewertungSperre || '',
        wartet: !!(j.motto && needsApproval({ slug: j.motto }) && (await approvalStatus(j.designId)) !== 'approved')
      };
    } catch (e) { /* Schalter ist Beiwerk */ }
  }
  // Fassung 24-26: Artikel und Foto-Knopf fuer die Ergebnisseite. Beim Weg "so einsetzen" zeigt
  // die Seite eine Vorschau MIT Foto, die nur im Arbeitsspeicher entsteht (siehe /foto/vorschau).
  const artikelInfo = j.input && j.input.artikel ? { id: j.input.artikel.id, name: j.input.artikel.name, label: j.input.artikel.label, verfahren: j.input.artikel.verfahren, warnung: j.input.artikel.warnung || null, ansicht: ansichtVon(j.input.artikel.id) || null } : undefined;
  const fotoInfo = j.foto ? {
    modus: j.foto.modus, wartet: !!j.foto.wartet, freigegeben: !!j.foto.freigegeben, texte: FOTO_TEXTE,
    vorschau: j.foto.wartet && j.foto.modus === 'original' && j.designId && j.sig ? `${env.PUBLIC_BASE_URL}/api/mo/foto/vorschau/${j.designId}.png?exp=${j.sig.exp}&sig=${j.sig.sig}` : null
  } : undefined;
  // 2. Okt., Markus: der Partner stellt selbst ein, "was die Leute kaufen koennen". Bei einem
  // Motiv mit seinem Logo (kartenart haus) zeigt das Ergebnis nur die Teile seines Shops.
  let mockupsZeigen = j.mockups;
  if (j.kartenart === 'haus' && j.firma && j.mockups) {
    try {
      const e = (await firmenListe()).find(x => x.firma === j.firma.name);
      const erlaubt = e ? angebotVon(e).teile : null;
      if (erlaubt && erlaubt.length) mockupsZeigen = Object.fromEntries(Object.entries(j.mockups).filter(([g]) => erlaubt.includes(g)));
    } catch (err) { console.error('Partner-Angebot im Ergebnis:', j.jobId, err && err.message ? err.message : err); }
  }
  res.json({
    status: j.status, designId: j.designId, preview: j.preview, mockups: mockupsZeigen, error: j.error, hint: j.hint || undefined, stofffarbe: j.stofffarbe || undefined, names: j.names || [], people: j.people || [], aufteilung: j.aufteilung || 'vorne', sig: j.sig || null, textile: j.textile || 'dunkel',
    back, bewertung, artikel: artikelInfo, foto: fotoInfo,
    // Ist Stufe 1 gelaufen - hat Otto das Foto vor dem Design gemalt? Nur ja/nein, nie das Bild selbst.
    fotoGemalt: j.foto ? !!j.fotoGemalt : undefined,
    // Ist schon eine Adresse fuer die Fertig-Mail hinterlegt? (nur ja/nein, nie die Adresse selbst)
    melde: j.melde && j.melde.email ? true : undefined,
    mailAn: !!env.BREVO_API_KEY,
    qa: j.status === 'qa_failed' ? (j.qa.at(-1) || {}).reason : undefined,
    marke: j.markeWort || undefined, markeAusEingabe: j.markeAusEingabe || undefined
  });
});

// Vorschauen und Mockups darf der Browser behalten. Sie aendern sich unter derselben
// Adresse nie (die Signatur haengt an designId + exp), und bei vielen Besuchern gleichzeitig
// macht es den Unterschied: ohne diesen Kopf holt jeder Farb- und Teile-Wechsel das Bild
// erneut vom Server und von der Platte. Nicht laenger als die Signatur gilt - danach
// waere das Bild im Browser noch da, der Link aber schon abgelaufen.
function bildCache(res, exp) {
  const sek = Math.max(0, Math.floor((+exp - Date.now()) / 1000));
  if (sek > 60) res.set('Cache-Control', `public, max-age=${Math.min(sek, 30 * 86400)}, immutable`);
}

// Druckdatei eines Designs, wahlweise mit dem n-ten Namen der Namensliste (Cache in mockups/)
// 4. Okt. (Markus, Bild: ein Strandtuch-Design auf Hoodie und Polo im Band): die GESPEICHERTE Design-Datei traegt den
// Artikel oben (artikel), nur der laufende Auftrag unter input.artikel. Band, Mockup und Artikel-Kacheln lasen nur
// input.artikel - jedes fuer einen Artikel bestellte Design galt dort als Shirt-Design. Immer ueber diese Funktion lesen.
function artikelVon(j) { return (j && (j.artikel || (j.input && j.input.artikel))) || null; }
async function readJob(designId) {
  try { return JSON.parse(await fs.readFile(path.join(STORE, 'jobs', `${designId}.json`), 'utf8')); } catch (e) { return null; }
}
// Wer traegt das Shirt in der Getragen-Ansicht? Der Vorname auf dem Design entscheidet - das
// persoenliche Feld des Mottos ("Anne"), sonst eine Namensliste mit genau EINEM Namen. Ist der
// Name eindeutig (vornamen.js) und liegt die Vorlage <teil>-szene-<wer>_<farbe> da, kommt sie;
// sonst '' und damit die allgemeine Situation. Nie raten, nie ein Foto ohne Vorlage versprechen.
// 7. Okt., Markus (Spruch-Shirt "Ich kann nicht, ich hab Ruecken" mit Maurer, getragen von einer Frau im Strassencafe): "Warum
// ist das ein weibliches Model bei dem Begriff Maurer? ... Hintergrund passt nicht zum Maurer!" Bei Mottos ohne eigenen Anlass
// (Sprueche, Freestyle) entscheidet der INHALT des Designs ueber Szene und Person - Maurer = Handwerker-Szene mit Mann.
const INHALT_MOTTOS = new Set(['sprueche-shirt', 'freestyle']);
const INHALT_SZENEN = [
  ['handwerker-shirt', /\b(maurer\w*|bau(stelle|arbeiter|leiter|helfer)?|handwerk\w*|tischler\w*|schreiner\w*|zimmer(mann|leute|er)|dachdecker\w*|elektriker\w*|klempner\w*|installateur\w*|sanitaer\w*|maler(meister)?|fliesen\w*|polier|geselle|azubi|werkstatt|kelle|ziegel\w*)\b/],
  ['angler-shirt', /\b(angl\w*|angeln|petri|karpfen|hecht|forelle)\b/],
  ['jaeger-shirt', /\b(jaeger\w*|jagd\w*|hochsitz|waidmann\w*)\b/],
  ['motorrad-shirt', /\b(motorrad\w*|biker\w*|harley)\b/],
  ['landwirt-shirt', /\b(landwirt\w*|bauer|bauern|trecker|traktor|kuhstall|melken)\b/],
  ['darts', /\bdarts?\b/], ['bowling', /\bbowling\b/], ['kegeltour', /\bkegel\w*/],
  ['weihnachtsfeier', /\b(weihnacht\w*|xmas|nikolaus|advent\w*)\b/],
  ['fan-shirt', /\b(fussball\w*|stadion|kurve|anpfiff|abseits)\b/],
  ['tier-shirt', /\b(hund\w*|dackel|katze\w*|kater|pferd\w*)\b/],
  ['geburtstag', /\bgeburtstag\w*/],
];
const INHALT_MANN = /\b(maurer|handwerker|bauarbeiter|polier|opa|papa|vater|vati|bruder|onkel|ehemann|ehemaenner|mann|maenner|kerl|jungs|herr|chef|meister|sohn|ruentner|rentner|grossvater)\b/;
const INHALT_FRAU = /\b(oma|mama|mutter|mutti|schwester|tante|ehefrau|frau|frauen|maedels|madels|dame|chefin|meisterin|tochter|rentnerin|grossmutter|braut)\b/;
function designInhalt(j) {
  const v = Object.assign({}, (j && j.input && j.input.values) || {}, (j && j.values) || {});
  return [...Object.values(v), j && j.wunsch, j && j.input && j.input.wunsch].filter(x => typeof x === 'string').join(' ')
    .toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}
function mottoSlugVon(j) { const m = j && (j.motto || (j.input && j.input.motto)); return String((m && typeof m === 'object' ? m.slug : m) || ''); }
function szeneAusInhalt(j) {
  const t = designInhalt(j);
  const tr = t && INHALT_SZENEN.find(([slug, re]) => SZENE_THEMEN[slug] && re.test(t));
  return tr ? tr[0] : '';
}
function werAusInhalt(j) {
  const t = designInhalt(j); if (!t) return '';
  const m = INHALT_MANN.test(t), f = INHALT_FRAU.test(t);
  return m && !f ? 'mann' : f && !m ? 'frau' : '';
}
// 7. Okt., Markus: "Maurer ist doch nicht in einer Tischlerwerkstatt?" - "Das muessen wir schon genau machen, und wenn du den
// Begriff nicht kennst, musst du ihn halt jedes Mal recherchieren." Bei diesen Mottos zuerst die Szene nach Begriff
// (szene-begriff.js: Begriff lesen, nachschlagen, Foto einmal je Begriff); bis sie da ist, die Wahl nach Schlagwort.
const BEGRIFF_MOTTOS = new Set(['sprueche-shirt', 'freestyle', 'handwerker-shirt']);
function designTexte(j) {
  const v = Object.assign({}, (j && j.input && j.input.values) || {}, (j && j.values) || {});
  return Object.values(v).filter(x => typeof x === 'string' && x.trim());
}
async function szeneMottoFuerA(j, designId) {
  if (j && BEGRIFF_MOTTOS.has(mottoSlugVon(j))) { const b = await szenenB.szeneFuer(designId, designTexte(j)); if (b) return b; }
  return szeneMottoFuer(j);
}
// Welche Motto-Szene gilt fuer das Getragen-Bild: das eigene Motto - bei Spruechen und Freestyle zuerst der Inhalt.
function szeneMottoFuer(j) {
  const m = mottoSlugVon(j);
  if (INHALT_MOTTOS.has(m)) { const t = szeneAusInhalt(j); if (t) return t; }
  return m;
}
async function werFuerMockup(j, garment, color) {
  if (!j) return '';
  // 2. Okt., Markus: "Jungs Name ist dann natuerlich kein rosa Zimmer ... wenn's Maedels Name ist,
  // dann rosa Zimmer, da duerfen wir schon gerne klassisch bleiben." Beim Babyshirt ist der Name der
  // des KINDES (nameFeld der Szene) - er waehlt das Zimmer, nicht die Person. Rosa nur, wenn jeder
  // erkannte Name ein Maedchenname ist (Zwillinge "Mia & Ben" bleiben im hellen Zimmer).
  const thema = SZENE_THEMEN[String(j.motto || '')];
  if (thema && thema.nameFeld) {
    const v = j.values || (j.input && j.input.values) || {};
    const leute = String(v[thema.nameFeld] || '').split(/\s*(?:&|\+|,|\/|\bund\b)\s*/i).map(n => werVomNamen(n)).filter(Boolean);
    return leute.length && leute.every(w => w === 'frau') ? 'frau' : (leute.includes('mann') ? 'mann' : '');
  }
  let name = '';
  try {
    const motto = j.motto ? await mottos.get(j.motto) : null;
    const personal = motto && Array.isArray(motto.fields) ? motto.fields.find(f => f.personal) : null;
    const values = j.values || (j.input && j.input.values) || {};
    if (personal && values[personal.key]) name = String(values[personal.key]);
  } catch (e) { name = ''; }
  const names = j.names || (j.input && j.input.names) || [];
  if (!name && names.length === 1) name = String(names[0]);
  const wer = werVomNamen(name) || werAusInhalt(j);   // 7. Okt.: ohne Vornamen sagt der Inhalt, wer es traegt (Maurer = Mann)
  if (!wer) return '';
  return (await szeneVarianteDa(garment, color, wer)) ? wer : '';
}
// ---------- Endgueltig geloescht ----------
// "Geloescht" muss geloescht heissen. Das war es bisher nicht: die Druckdatei liegt auch
// auf Google Drive, und der naechste Zugriff holte sie von dort ganz selbstverstaendlich
// zurueck - das Design war wieder da. Darum eine Liste der endgueltig geloeschten Nummern.
// Sie wird vor jedem Zurueckholen gefragt, vor der Druckliste und vor dem Bewertungs-Pool.
// Was hier drinsteht, taucht nirgends wieder auf, egal was noch wo liegt. Die Liste ist
// winzig (nur Nummer und Zeitpunkt) und wird nie automatisch geleert.
const GELOESCHT_FILE = path.join(STORE, 'geloescht.json');
let geloeschtCache = null;
async function geloeschtLaden() {
  if (!geloeschtCache) { try { geloeschtCache = JSON.parse(await fs.readFile(GELOESCHT_FILE, 'utf8')); } catch (e) { geloeschtCache = {}; } }
  return geloeschtCache;
}
async function istGeloescht(id) { return !!(await geloeschtLaden())[id]; }
async function geloeschtMerken(id, grund) {
  const d = await geloeschtLaden();
  d[id] = { at: new Date().toISOString(), grund: grund || 'von Hand' };
  try { await fs.writeFile(GELOESCHT_FILE, JSON.stringify(d, null, 2)); }
  catch (e) { console.error('Geloescht-Liste speichern:', e && e.message ? e.message : e); }
}

// ---------- Druckdatei lesen, auch wenn sie schon ausgelagert ist ----------
// Nach der Aufbewahrungszeit liegt die Druckdatei nur noch auf Google Drive. Aus ihr werden
// Mockups, Namensvarianten, Brust-Print, Vektor und Kaderliste ERST BEI BEDARF gebaut - also
// muss jeder dieser Wege sie zurueckholen koennen, sonst klickt die Druckerei ins Leere.
// Zurueckgeholtes wird wieder lokal hingelegt: die naechste Farbe und die naechste Groesse
// desselben Designs sollen nicht noch einmal durchs Netz.
async function masterHolen(designId, art = 'PRINT') {
  const name = `${designId}_${art}_MASTER.png`;
  const p = path.join(STORE, 'masters', name);
  // Ein geloeschtes Design wird nicht zurueckgeholt - und eine Datei, die trotzdem wieder
  // aufgetaucht ist (aus einem Backup, von Drive, aus einem alten Auftrag), verschwindet hier gleich mit.
  if (await istGeloescht(designId)) { await fs.rm(p, { force: true }).catch(() => {}); return null; }
  try { return await fs.readFile(p); } catch (e) { /* vielleicht ausgelagert */ }
  let g = null;
  try {
    const j = await readJob(designId);
    g = await drive.fetchFile([(j && j.motto) || 'sonstige', designId], name);
  } catch (e) { console.error('Druckdatei von Drive holen:', name, e && e.message ? e.message : e); }
  if (!g || !g.buffer || !g.buffer.length) return null;
  try { await fs.mkdir(path.join(STORE, 'masters'), { recursive: true }); await fs.writeFile(p, g.buffer); }
  catch (e) { console.error('Zurueckgeholte Druckdatei nicht ablegbar:', name, e && e.message ? e.message : e); }
  console.log('Druckdatei von Drive zurueckgeholt:', name, Math.round(g.buffer.length / 1024) + ' KB');
  return g.buffer;
}
/** Wie masterHolen, wirft aber - fuer alle Stellen, die vorher fs.readFile benutzt haben. */
async function masterLesen(designId, art = 'PRINT') {
  const buf = await masterHolen(designId, art);
  if (buf) return buf;
  // Zwei ganz verschiedene Faelle, die nicht dieselbe Meldung bekommen duerfen: gibt es zu
  // der Nummer gar keinen Auftrag, ist es ein Tippfehler. Gibt es einen, liegt die Datei im
  // Archiv und kommt gerade nicht her - das ist behebbar und nichts ist verloren.
  // Und der dritte Fall: bewusst geloescht. Das ist kein Fehler und keine Panne, das
  // gehoert auch so gesagt - sonst sucht jemand nach einer Datei, die es nicht mehr
  // geben soll.
  if (await istGeloescht(designId)) throw new Error(`Design ${designId} wurde gelöscht`);
  const j = await readJob(designId);
  throw new Error(j
    ? `Druckdatei ${designId}_${art}_MASTER.png ist ausgelagert und aus dem Archiv nicht zu holen`
    : `unbekanntes Design ${designId}`);
}

async function masterWithName(designId, n) {
  const idx = Number.isInteger(+n) && +n >= 0 ? +n : -1;
  if (idx < 0) return { buf: await masterLesen(designId), name: null };
  const j = await readJob(designId);
  const name = j && j.names && j.names[idx];
  if (!name) return { buf: await masterLesen(designId), name: null };
  const cached = path.join(STORE, 'mockups', `named_${designId}_${idx}.png`);
  try { return { buf: await fs.readFile(cached), name }; } catch (e) { /* bauen */ }
  const master = await masterLesen(designId);
  let out;
  if (j.nameArt === 'motiv') {
    const r = await renderNameImMotiv(master, name, { font: j.nameFont }).catch(() => ({ gesetzt: false }));
    out = r.gesetzt ? r.png : await renderName(master, name, { zone: j.nameZone, font: j.nameFont, style: j.style, textile: j.textile });
  } else {
    out = await renderName(master, name, { zone: j.nameZone, font: j.nameFont, style: j.style, textile: j.textile });
  }
  await fs.writeFile(cached, out);
  return { buf: out, name };
}
// Rueckseite (Fassung 9): gibt es eine KI-Rueckseite (Abi/Schulmotto, _BACK_MASTER.png), kommt die. Sonst die Kaderliste:
// Kopf = Frontmotiv verkleinert (vorne-kader) oder in voller Breite (brust-kader), darunter alle Namen (Cache in mockups/).
async function backMaster(designId) {
  { const b = await masterHolen(designId, 'BACK'); if (b) return b; }   // keine KI-Rueckseite: dann die Kaderliste unten
  const j = await readJob(designId);
  if (!j || !j.names || !j.names.length) throw new Error('keine Namensliste');
  const cached = path.join(STORE, 'mockups', `back_${designId}.png`);
  try { return await fs.readFile(cached); } catch (e) { /* bauen */ }
  const base = await masterLesen(designId);
  const out = await renderRoster(base, j.people && j.people.length ? j.people : j.names, { font: j.nameFont, textile: j.textile, kopfPct: KOPF_PCT[j.aufteilung] ?? 45 });
  await fs.writeFile(cached, out);
  return out;
}
// Brust-Print mit dem n-ten Namen (Cache in mockups/)
async function chestMaster(designId, n) {
  const j = await readJob(designId);
  const idx = Number.isInteger(+n) && +n >= 0 ? +n : -1;
  const name = j && j.names && idx >= 0 ? j.names[idx] : null;
  const cached = path.join(STORE, 'mockups', `chest_${designId}_${name ? idx : 'x'}.png`);
  try { return { buf: await fs.readFile(cached), name }; } catch (e) { /* bauen */ }
  const base = await masterLesen(designId);
  const out = await renderChest(base, name, { zone: j && j.nameZone, font: j && j.nameFont, style: j && j.style, textile: j && j.textile });
  await fs.writeFile(cached, out);
  return { buf: out, name };
}
// Vektor-Druckdatei je Design (ohne Namen), einmal gebaut und als storage/vectors/<id>.svg abgelegt
async function masterSvg(designId) {
  if (!(await vectorReady())) return null;
  const dir = path.join(STORE, 'vectors');
  await fs.mkdir(dir, { recursive: true });
  const f = path.join(dir, `${designId}.svg`);
  try { return await fs.readFile(f, 'utf8'); } catch (e) { /* bauen */ }
  const png = await masterLesen(designId);
  let svg = await vectorizeMaster(png);
  // Reale Druckgroesse (cm) auf den SVG-Wurzelknoten setzen, damit ein RIP nicht px als pt liest.
  try {
    const meta = await sharp(png).metadata();
    const dpi = meta.density || 300;
    const wCm = (meta.width / dpi) * 2.54, hCm = (meta.height / dpi) * 2.54;
    svg = svg.replace(/<svg\b[^>]*>/, (tag) => {
      let t = tag.replace(/\s(width|height)="[^"]*"/g, '');
      return t.replace(/<svg\b/, `<svg width="${wCm.toFixed(2)}cm" height="${hCm.toFixed(2)}cm"`);
    });
  } catch (e) { /* Groesse optional */ }
  await fs.writeFile(f, svg);
  return svg;
}

app.get('/api/mo/preview/:file', async (req, res) => {
  const designId = String(req.params.file).replace(/\.png$/, '').replace(/[^A-Za-z0-9_-]/g, '');
  const { exp, sig, n } = req.query;
  if (!exp || +exp < Date.now() || signPreview(designId, exp, SIGN_SECRET) !== sig) return res.status(403).end();
  bildCache(res, exp);
  try {
    if (req.query.side === 'back') {
      try { return res.type('png').send(await fs.readFile(path.join(STORE, 'previews', `${designId}_back.png`))); } catch (e) { /* Kaderliste bauen */ }
      const cachedB = path.join(STORE, 'mockups', `backprev_${designId}.png`);
      try { return res.type('png').send(await fs.readFile(cachedB)); } catch (e) { /* bauen */ }
      const prevB = await makePreview(await backMaster(designId));
      await fs.writeFile(cachedB, prevB);
      return res.type('png').send(prevB);
    }
    if (req.query.side === 'chest') {
      const cachedC = path.join(STORE, 'mockups', `chestprev_${designId}_${n !== undefined ? +n : 'x'}.png`);
      try { return res.type('png').send(await fs.readFile(cachedC)); } catch (e) { /* bauen */ }
      const prevC = await makePreview((await chestMaster(designId, n)).buf);
      await fs.writeFile(cachedC, prevC);
      return res.type('png').send(prevC);
    }
    if (n !== undefined) {
      const cached = path.join(STORE, 'mockups', `namedprev_${designId}_${+n}.png`);
      try { return res.type('png').send(await fs.readFile(cached)); } catch (e) { /* bauen */ }
      const { buf } = await masterWithName(designId, n);
      const prev = await makePreview(buf);
      await fs.writeFile(cached, prev);
      return res.type('png').send(prev);
    }
    res.type('png').send(await fs.readFile(path.join(STORE, 'previews', `${designId}.png`)));
  } catch (e) { res.status(404).end(); }
});

// Namen nachtraeglich aendern - das Design bleibt, nur die Namen werden neu gesetzt
app.post('/api/mo/names', async (req, res) => {
  const designId = String((req.body || {}).designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const j = await readJob(designId);
  if (!j) return res.status(404).json({ error: 'unbekanntes Design' });
  const who = await identify(req, res);
  const mine = (who.user && who.user.designs.includes(designId)) || (who.guest && who.guest.designs.includes(designId));
  if (!mine) return res.status(403).json({ error: 'nicht dein Design' });
  const motto = await mottos.get(j.motto);
  const personal = motto && motto.fields.find(f => f.personal);
  if (!personal) return res.status(400).json({ error: 'motto ohne Namensliste' });
  const pp = parsePeople((req.body || {}).names, personal.max);
  // Verbotene Parolen auch in der Namensliste - sie wird gross auf den Ruecken gedruckt.
  // Ohne Ausnahme: eine Kaderliste ist der bequemste Weg, eine Parole unterzubringen.
  {
    const hit = verboten.pruefeTexte(pp.names);
    if (hit) { await verbotenMerken({ quelle: 'namensliste', wort: hit.wort, eingabe: hit.eingabe, motto: j.motto, req }); return res.status(400).json({ error: 'verboten', wort: hit.wort }); }
  }
  if (!markenFrei(motto)) { const hit = marken.checkAll(pp.names, null, markenKontext(motto, (j.input && j.input.values) || {})); if (hit) { await verbotenMerken({ quelle: 'marke-namen', wort: hit.wort, eingabe: hit.eingabe, motto: motto.slug || '', req }); return res.status(400).json({ error: 'marke', wort: hit.wort, eingabe: hit.eingabe }); } }
  j.names = pp.names;
  j.people = pp.people;
  // Druck-Aufteilung darf mitgeaendert werden (Fassung 9); ohne Namen immer "vorne"
  const wantAuf = String((req.body || {}).aufteilung || '');
  if (AUFTEILUNGEN.includes(wantAuf)) j.aufteilung = motto.kader !== false && pp.names.length ? wantAuf : 'vorne';
  if (!pp.names.length) j.aufteilung = 'vorne';
  await fs.writeFile(path.join(STORE, 'jobs', `${designId}.json`), JSON.stringify(j, null, 2));
  // alte Namens-, Kader- und Brust-Caches wegwerfen
  try { for (const f of await fs.readdir(path.join(STORE, 'mockups'))) if (f.includes(`_${designId}`) && /^(named|namedprev|back|backprev|chest|chestprev)_/.test(f)) await fs.rm(path.join(STORE, 'mockups', f), { force: true }); } catch (e) { /* egal */ }
  const exp = Date.now() + 14 * 86400e3;
  res.json({ names: j.names, people: j.people, aufteilung: j.aufteilung || 'vorne', bereinigt: pp.changed, sig: { exp, sig: signPreview(designId, exp, SIGN_SECRET) } });
});

// Haustier-Szene (tier-szene.js): liegt die Szene mit DIESEM Tier schon da, wird sie genommen. Sonst die Szene
// ohne Tier, und der Bilddienst baut die richtige im Hintergrund - einmal je Design und Farbe; schlaegt es fehl,
// fruehestens nach einer Stunde wieder. Danach werden die Mockups dieses Designs in der Szene neu gebaut
// (alte Dateien weg, gleiche Namen).
const TIER_BAU = new Map();   // <design>_<farbe> -> laufendes Versprechen oder Zeit des Fehlschlags
async function tierSzeneFuer(designId, color, master) {
  const ziel = tierDatei(STORE, designId, color);
  try { return await fs.readFile(ziel); } catch (e) { /* noch nicht gebaut */ }
  const leer = await fs.readFile(leerDatei(color));
  const k = designId + '_' + color;
  const t = TIER_BAU.get(k);
  const darf = !t || (typeof t === 'number' && Date.now() - t > 3600e3);
  if (darf && !process.env.ABNAHME && env.BALLZ_MCP_URL) {
    TIER_BAU.set(k, (async () => {
      try {
        const szene = await fs.readFile(path.join(STORE, 'templates', 'tee-szene-thema-' + TIER_MOTTO + '_' + color + '.png'));
        const png = await tierSzeneBauen({ szene, master, edit: (a) => editViaBallz(env.BALLZ_MCP_URL, { prompt: a.prompt, size: '1024x1024', quality: 'high', model: bildModell(), imageBase64: a.imageBase64, mimeType: 'image/png', referenceImagesBase64: a.referenceImagesBase64, inputFidelity: 'high', background: 'opaque' }) });
        await fs.mkdir(path.dirname(ziel), { recursive: true });
        await fs.writeFile(ziel, png);
        const alt = (await fs.readdir(path.join(STORE, 'mockups')).catch(() => [])).filter(f => f.startsWith(designId + '_') && f.includes('_thema-' + TIER_MOTTO));
        for (const f of alt) await fs.rm(path.join(STORE, 'mockups', f), { force: true });
        console.log('Haustier-Szene: ' + designId + ' ' + color + ' gebaut, ' + alt.length + ' Mockup(s) neu');
        TIER_BAU.delete(k);
      } catch (e) {
        console.error('Haustier-Szene: ' + designId + ' ' + color + ' gescheitert (' + (e && e.message ? e.message : e) + ') - bis dahin ohne Tier');
        TIER_BAU.set(k, Date.now());
      }
    })());
  }
  return leer;
}

// Mockup: Druckdatei auf T-Shirt, Hoodie oder Zip-Jacke gelegt. Wird beim ersten Abruf gebaut und gemerkt.
// Wie ein Mockup heisst und gebaut wird - EINE Rechnung fuer die Route und fuer mockupLiegtDa (4. Okt.: das Band suchte
// Motto-Szenen unter einem anderen Namen, als die Route sie ablegte, und fand sie nie).
// q: { side, n, szene, druck, linie, fassung, farbe } wie die Adresse sie traegt.
async function mockupPlan(designId, garment, color, jobT, q = {}) {
  const szMotto = await szeneMottoFuerA(jobT, designId);
  const side = q.side === 'back' ? 'back' : q.side === 'chest' ? 'chest' : '';
  const back = side === 'back';
  const n = q.n !== undefined && Number.isInteger(+q.n) ? +q.n : -1;
  // Fuer welches Textil das Design gezeichnet wurde, entscheidet ueber den Auftrag: ein Design mit heller Schrift
  // liegt auch auf weissem Stoff deckend auf, sonst wuerde die Schrift verschwinden.
  const print = jobT && istHell(jobT.textile) ? 'hell' : 'dunkel';
  // Fassung 74: Welches Teil hat der Kunde bestellt? Nur auf DEM ist der randlose Druck echt -
  // auf jedem anderen ist das Mockup eine Vorschau, und dort darf nichts beschnitten werden
  // (Markus, 17. Sept.: "Auf dem Kissen ist die Datei abgeschnitten").
  const artJ = artikelVon(jobT);
  const artT = artJ && artJ.id
    ? { ansicht: ansichtVon(artJ.id), motivart: artJ.motivart, netto: artJ.netto || null }
    : null;
  // _v<Stand>: der Stand des Artikels (mockupStandFuer) - aendert sich die Rechnung fuer ein
  // Teil, bekommen nur dessen Dateien einen neuen Namen, alle anderen bleiben gueltig.
  // Fassung 86, Markus: "Wenn der Kunde ein Poster erstellt hat, muss sein Motiv auf der Wand
  // im Wohnzimmer genauso haengen - bei allen anderen Artikeln auch."
  // ?szene=1: das Design in der Situation; ohne Vorlage dafuer stillschweigend die sachliche Ansicht.
  const szeneGewollt = String(q.szene || '') === '1';
  const querMotiv = !!(artT && artT.netto && artT.netto[0] > artT.netto[1] * 1.15);
  // 5. Okt. abends (Markus: "ausgewaehlt ist ... gross auf Hoodie, gekommen ist Hoodie vorne"): ein Design, das auf den
  // Ruecken bestellt ist (artikel.seite), liegt auf dem Foto von hinten (MITGELIEFERT <teil>-ruecken) - ohne Szene,
  // die zeigt nur vorn.
  const hinten = !side && !!(artJ && artJ.seite === 'ruecken') && ['tee', 'hoodie'].includes(garment);
  // 7. Okt., Markus (Abi-Hoodie mit Namen hinten): die Namensliste auf dem Ruecken liegt ebenfalls auf dem Foto von HINTEN
  // (rueckenFoto auch bei side=back) - auf dem Vorderseiten-Foto liefen die Kordeln mitten durch die Namen. '_rf' im Dateinamen.
  let szene = szeneGewollt && !hinten && !back && side !== 'chest' && (await szeneMoeglich(garment, color, querMotiv) || (!querMotiv && !!(await szeneThemaFuer(garment, color, szMotto))));
  // 27. Sept., Markus ("am Namen ist zu erkennen, dass es sich um eine Frau handelt, dann sollte
  // es auch als Frau als Beispiel kommen"): Die Getragen-Vorlage passt zur Person auf dem Design,
  // wenn ihr Vorname eindeutig ist UND die Vorlage dafuer daliegt (<teil>-szene-frau bzw. -mann,
  // im Backend erzeugt). Sonst die allgemeine Situation wie bisher.
  const wer = szene ? await werFuerMockup(jobT, garment, color) : '';
  // 2. Okt., Markus: "Wenn Weihnachtsmotiv drauf ist, dass es ne weihnachtliche Umgebung ist" -
  // die Szene des Mottos, wenn es eine gibt (und sie zur Person auf dem Design passt).
  let thema = szene ? await szeneThemaFuer(garment, color, szMotto, wer) : '';
  // 2. Okt., Markus zum Schaufenster: "mal klein, mal gross, mal was auf dem Ruecken". ?druck= gilt nur
  // in der Szene eines Mottos; Ruecken nur, wenn die Szene von hinten daliegt - sonst die Vorderseite.
  let druck = thema && DRUCK_ARTEN.includes(String(q.druck || '')) ? String(q.druck) : '';
  if (druck === 'ruecken') { const r = await szeneThemaFuer(garment, color, thema + '-ruecken'); if (r) thema = r; else druck = ''; }
  const linie = LINIEN[String(q.linie || '')] ? String(q.linie) : LINIE_STANDARD;   // ?linie=bc|ss: Herstellerfoto der Textil-Linie
  const linieDa = !szene && await linieVorlageDa(linie, garment, color);
  // 4. Okt.: farbiges Textil (TEXTIL_FARBEN) - nur auf weissem Grund, nur T-Shirt und Polo, nicht auf dem Ruecken.
  // Mit Namen und Brust-Print geht es genauso (die Farbe steckt in der Vorlage, nicht in der Druckdatei).
  const farbe = TEXTIL_FARBEN[String(q.farbe || '')] && TEXTIL_FARBEN[String(q.farbe)].name[garment] && color === 'white' && FARB_TEILE.includes(garment) && !back ? String(q.farbe) : '';
  // 7. Okt.: farbiges Getragen-Bild nur, wo sich die Szene einfaerben laesst (dasselbe Foto in Weiss und Schwarz) - sonst das
  // gefaerbte Shirt ohne Szene statt gar keinem Bild.
  if (farbe && szene && !(thema && await faerbMaske(path.join(STORE, 'templates'), garment + '-szene-thema-' + thema))) { szene = false; thema = ''; druck = ''; }
  const cSuffix = (color === 'white' && print === 'dunkel' ? `${color}_deckend` : color) + (szene ? '_szene' : '') + (thema ? themaEndung(thema, druck) : (wer ? '_' + wer : '')) + (linieDa ? '_' + linie : '') + (farbe ? '_f-' + farbe : '') + (hinten ? '_ruecken' : back ? '_rf' : '') + '_v' + mockupStandFuer(garment);
  const cached = path.join(STORE, 'mockups', back ? `back_${designId}_${garment}_${cSuffix}.jpg` : side === 'chest' ? `chest_${designId}_${n}_${garment}_${cSuffix}.jpg` : (n >= 0 ? `named_${designId}_${n}_${garment}_${cSuffix}.jpg` : `${designId}_${garment}_${cSuffix}.jpg`));
  return { side, back, n, print, artT, szene, wer, thema, druck, linie, linieDa, farbe, hinten, cached };
}
app.get('/api/mo/mockup/:designId/:garment/:file', async (req, res) => {
  const designId = String(req.params.designId).replace(/[^A-Za-z0-9_-]/g, '');
  const garment = String(req.params.garment);
  const color = String(req.params.file).replace(/\.jpg$/i, '');
  const { exp, sig } = req.query;
  if (!exp || +exp < Date.now() || signPreview(designId, exp, SIGN_SECRET) !== sig) return res.status(403).end();
  if (!GARMENTS[garment] || !COLORS.includes(color)) return res.status(404).end();
  bildCache(res, exp);
  // side=back: KI-Rueckseite oder Kaderliste auf dem Ruecken; side=chest: kleiner Brust-Print mit dem n-ten Namen (Fassung 9)
  const side = req.query.side === 'back' ? 'back' : req.query.side === 'chest' ? 'chest' : '';
  const back = side === 'back';
  const jobT = await readJob(designId);
  const plan = await mockupPlan(designId, garment, color, jobT, { ...req.query, side });
  const { n, print, artT, szene, wer, thema, druck, linie, farbe, hinten } = plan;
  // 9. Okt., Markus: "Schaufenster und Wand, bitte das Wasserzeichen entfernen und gute Aufloesung" - mit eigener
  // Unterschrift (reinSig, nur Schaufenster und Band bekommen sie) die Fassung ohne Wasserzeichen, eigene Datei _rein.
  const rein = !!req.query.rein && req.query.rein === reinSig(designId, exp);
  const cached = rein ? plan.cached.replace(/\.jpg$/i, '_rein.jpg') : plan.cached;
  // Fassung 74: Welches Teil schaut sich der Kunde ueberhaupt an? Genau diese Frage war bisher
  // unbeantwortbar - und von ihr haengt ab, ob ein zweiter Artikel je verkauft wird.
  // Gezaehlt wird VOR dem Cache-Treffer, sonst zaehlt nur der erste Blick eines Designs.
  zaehl('mockup', garment);
  zaehl('ansicht', side || 'vorne');
  if (await sendBestesBild(req, res, cached)) return;   // liegt schon da (oder als AVIF/WebP)
  if (!(await templateReady(garment, color))) return res.status(503).json({ error: 'vorlage fehlt' });
  try {
    // Ueber die Platzgrenze und nur einmal je Datei (siehe bildEinmal): die Ergebnisseite
    // fordert alle Teile auf einmal an, und jedes liest die Druckdatei in voller Groesse.
    const jpg = await bildEinmal(cached, async () => {
      // 2. Okt., Markus: "beim Abi-Shirt sind hinten die Namen drauf" - auf den Ruecken kommt, was das
      // Design fuer hinten hat (KI-Rueckseite oder Namensliste); nur ohne beides das Motiv selbst.
      const rueckenMaster = druck === 'ruecken' ? await backMaster(designId).catch(e => { console.error('Ruecken ' + designId + ': keine Rueckseite (' + e.message + ') - das Motiv'); return null; }) : null;
      const master = back ? await backMaster(designId)
        : rueckenMaster ? rueckenMaster
        : side === 'chest' ? (await chestMaster(designId, n)).buf
        : (n >= 0 ? (await masterWithName(designId, n)).buf : await masterLesen(designId));
      // 1. Okt., Markus: beim Haus traegt das Tuch die Flagge SEINER Kueche (Luigi: Italien), nicht das
      // Land, in dem der Kunde steht - sonst laege die Luigi-Karte auf Schwarz-Rot-Gold.
      const land = (jobT && jobT.firma && jobT.firma.flaggeLand) || (jobT && jobT.input && jobT.input.values ? jobT.input.values.land : '');
      // 4. Okt. (Markus: "sollte der Hund daneben wenigstens der gleiche Hund sein"): in der Haustier-Szene sitzt
      // das Tier VOM SHIRT daneben - gebaut einmal je Design und Farbe (tierSzeneFuer), bis dahin ohne Tier.
      const szeneVorlage = thema === TIER_MOTTO && garment === 'tee' && !druck && !rueckenMaster ? await tierSzeneFuer(designId, color, master) : undefined;
      const bild = await makeMockup(master, garment, color, !rein, { hochwertig: rein, place: side === 'chest' ? 'chest' : (back || hinten) ? 'back' : 'front', rueckenFoto: hinten || back, print, artikel: artT, ansicht: szene ? 'szene' : undefined, wer: wer || undefined, thema: thema || undefined, druck: druck || undefined, land, linie, szeneVorlage, farbe: farbe || undefined });
      await fs.writeFile(cached, bild);
      return bild;
    }, { hintergrund: req.get('x-mo-hintergrund') === '1' });   // Vorwaermen/Nachbauen: hinten anstellen
    res.type('jpeg').send(jpg);
  } catch (e) {
    console.error('Mockup gescheitert:', e && e.message ? e.message : e);
    res.status(404).end();
  }
});

// ---------- Protokoll der Sperre ----------
// Jeder Treffer wird festgehalten. Nicht zur Bestrafung, sondern weil der Unterschied
// zaehlt: EIN Treffer ist meist ein danebengegangener Scherz, zwanzig Treffer aus einer
// Richtung sind jemand, der die Sperre austestet - und das will man sehen, bevor etwas
// durchrutscht. Gekuerzt auf 500 Eintraege, damit die Datei nicht unbegrenzt waechst.
const VERBOTEN_LOG = path.join(STORE, 'verboten-log.json');
let verbotenLogCache = null;
async function verbotenLog() {
  if (!verbotenLogCache) { try { verbotenLogCache = JSON.parse(await fs.readFile(VERBOTEN_LOG, 'utf8')); } catch (e) { verbotenLogCache = []; } }
  if (!Array.isArray(verbotenLogCache)) verbotenLogCache = [];
  return verbotenLogCache;
}
// 3. Okt., Markus: "Und ich moechte da immer sofort eine Nachricht, wenn ein Versuch gesperrt [wird]."
// Jede Sperre (verbotenes Zeichen, Marke in Eingabe, Namensliste, Freitext oder im fertigen Bild)
// geht sofort als Mail an DESIGN_MAIL_AN bzw. ADMIN_EMAIL - mit Wort, Eingabe und Motto, damit er
// eine falsche Sperre (wie "Hotel Barca") gleich sieht. Dieselbe Sperre vom selben Besucher meldet
// sich nur einmal in 10 Minuten (wer fuenfmal auf "Starten" drueckt, soll keine fuenf Mails ausloesen).
// SPERR_MAIL=aus schaltet ab.
const sperrMailZuletzt = new Map();
async function sperreMelden({ quelle, wort, eingabe, motto, spur, auftrag }) {
  try {
    if (String(env.SPERR_MAIL || 'an').toLowerCase() === 'aus') return;
    const to = env.DESIGN_MAIL_AN || env.ADMIN_EMAIL;
    if (!to || !env.BREVO_API_KEY) return;
    const schluessel = [quelle, wort, spur || auftrag || ''].join('|');
    const jetzt = Date.now();
    if (jetzt - (sperrMailZuletzt.get(schluessel) || 0) < 10 * 60000) return;
    sperrMailZuletzt.set(schluessel, jetzt);
    if (sperrMailZuletzt.size > 500) sperrMailZuletzt.delete(sperrMailZuletzt.keys().next().value);
    const wo = ({ 'marke-eingabe': 'Marke in der Eingabe', 'marke-freitext': 'Marke im Freitext', 'marke-namen': 'Marke in der Namensliste', 'marke-bild': 'Marke im fertigen Bild', 'marke-upload': 'Marke im hochgeladenen Bild', eingabe: 'Verbotenes Wort in der Eingabe', bild: 'Verbotenes Zeichen im fertigen Bild', upload: 'Verbotenes Zeichen im hochgeladenen Bild', namensliste: 'Verbotenes Wort in der Namensliste', 'postkarte-gruss': 'Verbotenes Wort im Kartengruss', 'postkarte-rueckseite': 'Verbotenes Wort auf der Kartenrueckseite' })[quelle] || quelle || 'Sperre';
    const base = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const zeile = (k, v) => v ? `<tr><td style="color:#777;padding:3px 10px 3px 0;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:3px 0">${escHtml(v)}</td></tr>` : '';
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:560px">`
      + `<p style="font-size:20px;font-weight:bold;margin:0 0 12px">Ein Versuch wurde gesperrt</p><table style="border-collapse:collapse;font-size:15px">`
      + zeile('Wo', wo) + zeile('Wort', String(wort || '')) + zeile('Eingabe', String(eingabe || '').replace(/\s+/g, ' ').slice(0, 300)) + zeile('Motto', motto || '') + zeile('Auftrag', auftrag || '') + `</table>`
      + `<p style="margin:16px 0">Falsch gesperrt? Im Backend unter Marken ein Wort freigeben.</p>`
      + `<p style="margin:20px 0"><a href="${base}/admin" style="background:#ffc542;color:#1b1710;text-decoration:none;font-weight:bold;padding:11px 18px;border-radius:8px;display:inline-block">Zum Backend</a></p>`
      + `<p style="color:#999;font-size:12px">Diese Mail kommt bei jeder Sperre. Abschalten: SPERR_MAIL=aus in Railway.</p></div>`;
    await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to, subject: `Gesperrt: ${String(wort || '?').slice(0, 40)} (${wo})`, html });
    console.log('Sperr-Mail:', quelle, '·', wort, '->', to);
  } catch (e) { console.error('Sperr-Mail:', e && e.message ? e.message : e); }
}
// Der Fussball-Bezug eines Designs (marken.js, fussballKontext): alle Eingaben und der Name des Mottos -
// "Barca" allein ist frei, "Barca" auf dem Fan-Shirt oder neben "Fussball" nicht (Markus, 3. Okt.).
function markenKontext(motto, values) {
  const m = motto || {};
  return [m.name, m.slug, ...Object.values(values || {}).filter(v => typeof v === 'string')].filter(Boolean);
}
// Namen von Ort und Betrieb im Design ("Hotel Barca"): fuer die Markensperre frei, siehe marken.js.
function ortsNamen(values) {
  const v = values || {};
  return [v.firma, v.ort].filter(x => typeof x === 'string' && x.trim());
}
async function verbotenMerken({ quelle, wort, eingabe, motto, req, auftrag }) {
  // Fassung 74: Wie oft greift die Sperre, und wo? Nur die STELLE wird gezaehlt (Motiv,
  // Namensliste, Freitext) - nie das Wort und nie die Eingabe. Die stehen im Protokoll
  // darunter, das ohnehin nur der Chef sieht.
  zaehl('sperre', quelle || 'unbekannt');
  try {
    const l = await verbotenLog();
    // Die Eingabe selbst gehoert ins Protokoll - ohne sie kann niemand beurteilen, ob die
    // Sperre richtig lag. Gekuerzt, damit kein ganzer Aufsatz darin landet.
    l.unshift({
      at: new Date().toISOString(), quelle, wort: String(wort || '').slice(0, 120),
      eingabe: String(eingabe || '').replace(/\s+/g, ' ').slice(0, 200), motto: motto || '',
      // Nur zum Wiedererkennen desselben Besuchers, keine Adresse im Klartext
      spur: req ? crypto.createHash('sha256').update(String(req.ip || '') + SIGN_SECRET).digest('hex').slice(0, 12) : ''
    });
    verbotenLogCache = l.slice(0, 500);
    await fs.writeFile(VERBOTEN_LOG, JSON.stringify(verbotenLogCache, null, 2));
    console.warn('Sperre:', quelle, '·', wort, motto ? '· ' + motto : '');
  } catch (e) { console.error('Sperr-Protokoll:', e && e.message ? e.message : e); }
  sperreMelden({ quelle, wort, eingabe, motto, auftrag, spur: req ? crypto.createHash('sha256').update(String(req.ip || '') + SIGN_SECRET).digest('hex').slice(0, 12) : '' });
}

// ---------- Fanclub-Freigabe ----------
// Manche Mottos (Fanclub) duerfen Vereinslogos/-sprueche verwenden. Design + Vorschau sind frei,
// aber der DRUCK wird erst freigegeben, wenn der Fanclub-Vorsitzende einen Nachweis (Fanclub-
// Ausweis o. Ae.) schickt/hochlaedt und der Chef freigibt.
const needsApproval = (m) => !!(m && (m.requiresApproval || m.slug === 'fanclub'));
// Markensperre aus: Fanclub (Nachweis statt Sperre) und Mottos mit Schalter "markenfrei" (z. B. Handwerker-Shirt).
// Gilt fuer alle Pruefstellen: Eingabe, Namensliste, Upload, Bild-QA (Text + Logo). Der Recherche-Scrub bleibt.
// Vereinsjubilaeum: der Verein druckt sein eigenes Wappen - wie beim Fanclub keine Markensperre.
const markenFrei = (m) => !!(m && (m.markenfrei || needsApproval(m) || m.slug === 'vereinsjubilaeum'));

// ---------- Wer darf in die oeffentliche Bewertung? ----------
// Die Community-Bewertung zeigt fremden Leuten ein fertiges Design. Manche Designs gehoeren
// da grundsaetzlich nicht hin, und zwar OHNE dass jemand daran denken muss:
//  - Firmen-/Vereinslogos (B2B): eine Firma bezahlt fuer ihre Arbeitskleidung und will das
//    Motiv nicht im Schaufenster der Konkurrenz sehen. Das war die eigentliche Luecke.
//  - hochgeladene Fotos/Logos: das ist Material des Kunden, nicht unseres.
//  - Namenslisten und Rueckseiten: echte Namen gehoeren nicht ins Netz.
// Zurueck kommt der GRUND im Klartext - der steht dann auch im Backend und auf /druck,
// damit niemand raetselt, warum ein Design nicht im Pool auftaucht.
function bewertungSperrgrund({ motto, uploadFile, uploadFile2, personal, back, firma }) {
  // Ein Firmenkonto ist der klarste Fall von allen: eine Firma bezahlt fuer ihre
  // Arbeitskleidung und will sie nicht im oeffentlichen Schaufenster wiederfinden.
  // Das gilt unabhaengig vom Motto - auch wenn jemand mit dem Firmenkonto ein
  // Geburtstagsshirt macht. Lieber eines zu wenig im Pool als eines zu viel.
  if (firma) return 'Firmenkonto';
  if (uploadFile || uploadFile2) return 'eigenes Logo/Foto hochgeladen';
  if (motto && motto.gewerblich) return 'gewerbliches Motto (B2B)';
  if (motto && motto.nurLogo) return 'reines Logo-Design';
  if (personal) return 'Namensliste';
  if (back) return 'Rueckseite mit Namen';
  return '';
}

// Derselbe Befund, aber fuer ein bereits gespeichertes Design (Job-Datei statt laufendem Auftrag).
async function bewertungSperrgrundFuer(j) {
  if (!j) return 'unbekanntes Design';
  const m = await mottos.get(j.motto);
  return bewertungSperrgrund({
    motto: m,
    uploadFile: j.upload, uploadFile2: j.upload2,
    personal: m && (m.fields || []).some(f => f.personal),
    back: j.back
  });
}

const mottoTextAus = (values, motto) =>
  (values && (values.spruch || values.motto || values.gruppe || values.crew || values.tiername || values.fanclub)) ||
  (motto && motto.name) || '';
const APPROVAL_FILE = path.join(STORE, 'approvals.json');
let approvalsCache = null;
async function loadApprovals() { if (!approvalsCache) { try { approvalsCache = JSON.parse(await fs.readFile(APPROVAL_FILE, 'utf8')); } catch (e) { approvalsCache = {}; } } return approvalsCache; }
let approvalsWrite = Promise.resolve();
function saveApprovals() { const d = approvalsCache || {}; approvalsWrite = approvalsWrite.then(() => fs.writeFile(APPROVAL_FILE, JSON.stringify(d, null, 2))).catch(e => console.error('approvals speichern', e && e.message ? e.message : e)); return approvalsWrite; }
async function approvalStatus(designId) { const ap = await loadApprovals(); return (ap[designId] && ap[designId].status) || null; }

// ---------- Druckdateien ----------
// Drei Stufen: Admin-Token (alles), Master-Token (Druckseite inkl. Loeschen/Freigeben)
// und der Druckerei-Zugang - ein eigener Schluessel zum Weitergeben, der NUR die
// Druckdaten oeffnet: ansehen und herunterladen, sonst nichts. Er liegt auf dem Volume
// und laesst sich im Backend jederzeit neu erzeugen, damit der alte Link ungueltig wird.
const DRUCK_FILE = path.join(STORE, 'druckzugang.json');
let druckCache = null;
async function druckZugang() {
  if (druckCache) return druckCache;
  try { druckCache = JSON.parse(await fs.readFile(DRUCK_FILE, 'utf8')); } catch (e) { druckCache = null; }
  if (!druckCache || !druckCache.token) druckCache = await druckZugangNeu();
  return druckCache;
}
async function druckZugangNeu(wunsch) {
  const d = { token: wunsch || crypto.randomBytes(18).toString('base64url'), erstellt: new Date().toISOString(), eigenes: !!wunsch };
  try { await fs.mkdir(STORE, { recursive: true }); await fs.writeFile(DRUCK_FILE, JSON.stringify(d, null, 2)); }
  catch (e) { console.error('Druckzugang speichern:', e && e.message ? e.message : e); }
  druckCache = d;
  return d;
}
const tokenAus = (req) => req.query.token || req.get('x-master-token') || req.get('x-admin-token') || '';
const istChef = (t) => !!((env.MASTER_TOKEN && t === env.MASTER_TOKEN) || (env.ADMIN_TOKEN && t === env.ADMIN_TOKEN));

// Alles auf der Druckseite: Chef oder Druckerei.
const masterGuard = (req, res) => {
  const t = tokenAus(req);
  if (istChef(t)) return true;
  if (t && druckCache && druckCache.token && t === druckCache.token) return true;
  res.status(403).json({ error: 'kein Zugang' });
  return false;
};
// Nur der Chef: loeschen, freigeben, Pool aufraeumen. Die Druckerei kommt hier nicht durch.
const chefGuard = (req, res) => {
  if (istChef(tokenAus(req))) return true;
  res.status(403).json({ error: 'kein Zugang' });
  return false;
};

app.get('/api/mo/masters', async (req, res) => {
  if (!masterGuard(req, res)) return;
  const dir = path.join(STORE, 'masters');
  try {
    const files = await fs.readdir(dir);
    const out = [];
    for (const f of files) {
      const st = await fs.stat(path.join(dir, f));
      const designId = f.replace('_PRINT_MASTER.png', '');
      const j = await readJob(designId);
      let back = false;
      try { await fs.access(path.join(dir, `${designId}_BACK_MASTER.png`)); back = true; } catch (e) { /* keine Rueckseite */ }
      if (!back && j && j.aufteilung && j.aufteilung !== 'vorne' && j.names && j.names.length) back = true; // Kaderliste
      out.push({ file: f, designId, bytes: st.size, at: st.mtime.toISOString(), names: j && j.names && j.names.length ? j.names : undefined, people: j && j.people && j.people.length ? j.people : undefined, aufteilung: j && j.aufteilung || undefined, back, motto: j && j.motto, values: j && j.values });
    }
    out.sort((a, b) => a.at < b.at ? 1 : -1);
    res.json({ count: out.length, masters: out.slice(0, 300) });
  } catch (e) { res.status(500).json({ error: 'lesen gescheitert' }); }
});

app.get('/api/mo/master/:file', async (req, res) => {
  if (!masterGuard(req, res)) return;
  // Fassung 74: Welches Format holt die Produktion wirklich - PNG, PDF oder SVG?
  zaehl('download', /\.pdf$/i.test(req.params.file) ? 'pdf' : /\.svg$/i.test(req.params.file) ? 'svg' : 'png');
  const wantPdf = /\.pdf$/i.test(req.params.file);
  const wantSvg = /\.svg$/i.test(req.params.file);
  const designId = String(req.params.file).replace(/\.(png|pdf|svg)$/i, '').replace(/[^A-Za-z0-9_-]/g, '');
  // Fanclub-Designs erst nach Freigabe drucken (Nachweis des Vorsitzenden + Chef-Freigabe).
  try {
    const jChk = await readJob(designId);
    if (jChk && needsApproval({ slug: jChk.motto }) && (await approvalStatus(designId)) !== 'approved') {
      return res.status(423).json({ error: 'Fanclub-Freigabe ausstehend – erst nach Bestätigung des Vorsitzenden freigeben.', status: (await approvalStatus(designId)) || 'pending' });
    }
  } catch (e) { /* im Zweifel weiter (Design evtl. ohne Job) */ }
  try {
    if (wantSvg) {
      const svg = await masterSvg(designId);
      if (!svg) return res.status(503).json({ error: 'Vektorisierung nicht verfuegbar (vtracer fehlt im Image)' });
      const jV = await readJob(designId) || { designId };
      return res.type('image/svg+xml').set('content-disposition', `attachment; filename="${druckDateiName(jV, { art: 'VEKTOR', endung: 'svg' })}"`).send(svg);
    }
    // side=back: KI-Rueckseite oder Kaderliste (Ruecken); side=chest&n=i: Brust-Print mit Namen; sonst wie bisher
    let buf, art = 'PRINT';
    if (req.query.side === 'back') { buf = await backMaster(designId); art = 'RUECKSEITE'; }
    else if (req.query.side === 'chest') { ({ buf } = await chestMaster(designId, req.query.n)); art = 'BRUST'; }
    else ({ buf } = await masterWithName(designId, req.query.n));
    // Ein Name, eine Regel - fuer Download und Drive dieselbe Funktion (siehe druckDateiName)
    const jDat = await readJob(designId) || { designId };
    const dateiname = druckDateiName(jDat, { n: req.query.n === undefined ? -1 : +req.query.n, art, endung: wantPdf ? 'pdf' : 'png' });
    if (wantPdf) {
      // Fassung 35: die PDF ist VEKTOR - aus derselben SVG wie die SVG-Druckdatei, mit demselben
      // Mass (rsvg-convert). Nur Varianten mit gesetztem Namen, Ruecken und Brust sind Raster:
      // dort liegt kein Vektor vor, die Seite ist aber exakt so gross wie das PNG bei seinen dpi.
      // Ein ?dpi= von aussen gibt es nicht mehr: das Mass steht in der Datei, nicht im Link.
      let pdf = null;
      if (art === 'PRINT' && !(req.query.n !== undefined && +req.query.n >= 0)) {
        try {
          const svg = await masterSvg(designId);
          if (svg) pdf = await makePdfVonSvg(svg);
        } catch (e) { console.error('Vektor-PDF nicht gebaut, Raster-Rueckfall:', designId, e && e.message ? e.message : e); }
      }
      if (!pdf) pdf = await makePdf(buf);
      return res.type('pdf').set('content-disposition', `attachment; filename="${dateiname}"`).send(pdf);
    }
    res.type('png').set('content-disposition', `attachment; filename="${dateiname}"`).send(buf);
  } catch (e) {
    // Unterscheiden, sonst liest die Druckerei "unbekanntes Design", obwohl die Datei nur
    // im Archiv liegt und Google Drive gerade nicht erreichbar ist. Zwei ganz verschiedene
    // Dinge: das eine ist ein Tippfehler, das andere ein Ausfall, der behoben werden kann.
    const msg = String(e && e.message ? e.message : e);
    if (/ist ausgelagert und aus dem Archiv/.test(msg)) {
      console.error('Druckdatei nicht beschaffbar:', designId, msg);
      return res.status(503).json({ error: 'archiv', hinweis: 'Diese Druckdatei ist ausgelagert und das Archiv (Google Drive) ist gerade nicht erreichbar. Bitte in ein paar Minuten noch einmal – die Datei ist nicht verloren.' });
    }
    // Und der dritte Fall: bewusst geloescht. Wer einen alten Link anklickt, soll wissen,
    // dass hier nichts kaputt ist, sondern jemand das Design absichtlich entfernt hat.
    if (/wurde gelöscht/.test(msg)) return res.status(410).json({ error: 'geloescht', hinweis: 'Dieses Design wurde gelöscht und steht nicht mehr zur Verfügung.' });
    res.status(404).json({ error: 'unbekanntes Design' });
  }
});

// Vorschaubild fuer die Druckseite: direkt aus der Druckdatei gebaut. Bewusst OHNE Mockup-Vorlage -
// die Shirt-Fotos liegen extern und fehlen, wenn der Download beim Start nicht geklappt hat; die
// Druckdatei selbst liegt immer auf dem Volume. Ohne Wasserzeichen, damit man den Druck pruefen kann.
// ?gross=1 liefert dieselbe Ansicht gross zum Pruefen (1600 px) - auch ohne Wasserzeichen. Auf der
// Druckseite will man die echte Druckdatei sehen, nicht die Kundenvorschau.
app.get('/api/mo/druckbild/:file', async (req, res) => {
  if (!masterGuard(req, res)) return;
  const designId = String(req.params.file).replace(/\.jpe?g$/i, '').replace(/[^A-Za-z0-9_-]/g, '');
  const gross = req.query.gross === '1';
  const j0 = await readJob(designId).catch(() => null);
  const textil = j0 && istHell(j0.textile) ? 'hell' : 'dunkel';
  // Der Textilton gehoert in den Dateinamen, sonst zeigt ein alter Zwischenspeicher weiter Schwarz
  const cached = path.join(STORE, 'mockups', `druckbild_${designId}_${textil}${gross ? '_gross' : ''}.jpg`);
  try { return res.type('jpeg').set('cache-control', 'private, max-age=86400').send(await fs.readFile(cached)); } catch (e) { /* bauen */ }
  try {
    const master = await masterLesen(designId);
    const jpg = await druckThumb(master, textil, gross ? 1600 : 360);
    try { await fs.mkdir(path.join(STORE, 'mockups'), { recursive: true }); await fs.writeFile(cached, jpg); } catch (e) { /* Cache ist Kuer */ }
    res.type('jpeg').set('cache-control', 'private, max-age=86400').send(jpg);
  } catch (e) {
    console.error('Druckbild gescheitert:', designId, e && e.message ? e.message : e);
    res.status(404).end();
  }
});

// Fassung 35: Kantenlupe - drei Randstellen der Druckdatei sechsfach, auf Weiss und Schwarz
app.get('/api/mo/kante/:file', async (req, res) => {
  if (!masterGuard(req, res)) return;
  const designId = String(req.params.file).replace(/\.png$/i, '').replace(/[^A-Za-z0-9_-]/g, '');
  try {
    const png = await mitBildarbeit('Kantenlupe ' + designId, async () => kantenLupe(await masterLesen(designId)));
    res.type('png').set('cache-control', 'private, max-age=3600').send(png);
  } catch (e) {
    console.error('Kantenlupe gescheitert:', designId, e && e.message ? e.message : e);
    res.status(404).end();
  }
});

// Bestellliste (Namen + Groessen + Artikel) als CSV - fuer die Produktion (Chef oder Druckerei) und fuer den Kunden (Vorschau-Signatur)
app.get('/api/mo/bestellliste/:file', async (req, res) => {
  const designId = String(req.params.file).replace(/\.csv$/i, '').replace(/[^A-Za-z0-9_-]/g, '');
  const { exp, sig } = req.query;
  const t = tokenAus(req);
  const byToken = istChef(t) || !!(t && druckCache && druckCache.token && t === druckCache.token);
  const bySig = exp && +exp >= Date.now() && signPreview(designId, exp, SIGN_SECRET) === sig;
  if (!byToken && !bySig) return res.status(403).json({ error: 'kein Zugang' });
  const j = await readJob(designId);
  if (!j || !j.names || !j.names.length) return res.status(404).json({ error: 'keine Namensliste' });
  const people = j.people && j.people.length ? j.people : j.names.map(n => ({ name: n }));
  const csv = rosterCsv(people, { motto: j.motto, designId, lfdNr: j.lfdNr || 0, textile: j.textile, aufteilung: j.aufteilung || 'vorne', datei: (i) => druckDateiName(j, { n: i, art: j.aufteilung === 'brust-kader' ? 'BRUST' : 'PRINT' }) });
  res.type('text/csv; charset=utf-8').set('content-disposition', `attachment; filename="${+j.lfdNr > 0 ? String(j.lfdNr).padStart(5, '0') + '_' : ''}${designId}_BESTELLLISTE_${people.length}-Personen.csv"`).send(csv);
});

// Druckdateien-Uebersicht fuer die Produktion: alle Designs, je Name eine Datei
app.get('/druck', async (req, res) => {
  await druckZugang();
  if (!masterGuard(req, res)) return;
  const token = req.query.token;
  // Mit dem Druckerei-Schluessel gibt es nur Ansehen und Herunterladen: keine Freigabe,
  // kein Loeschen, kein Weg ins Backend. Der Chef sieht die Seite unveraendert.
  const chef = istChef(token);
  const dir = path.join(STORE, 'masters');
  let files = [];
  try { files = (await fs.readdir(dir)).filter(f => f.endsWith('_PRINT_MASTER.png')); } catch (e) { /* leer */ }
  // Endgueltig geloeschte Designs erscheinen hier nie wieder. Taucht die Datei doch wieder
  // auf (Drive-Rueckholung, Backup, alter Auftrag), wird sie hier gleich mitgenommen.
  const tot = await geloeschtLaden();
  let items = [];
  for (const f of files) {
    const designId = f.replace('_PRINT_MASTER.png', '');
    if (tot[designId]) { await fs.rm(path.join(dir, f), { force: true }).catch(() => {}); continue; }
    const st = await fs.stat(path.join(dir, f));
    const j = await readJob(designId);
    // Fanclub-Designs sind bis zur Freigabe gesperrt - der Download antwortet dann mit einer
    // Fehlermeldung statt mit der Datei. Das gehoert sichtbar auf die Seite, sonst klickt man ins Leere.
    let sperre = null;
    if (j && needsApproval({ slug: j.motto })) {
      const st2 = await approvalStatus(designId);
      if (st2 !== 'approved') sperre = st2 === 'rejected' ? 'abgelehnt' : 'wartet auf Nachweis';
    }
    // Sortiert wird nach dem ENTSTEHUNGSZEITPUNKT des Designs, nicht nach der Dateizeit.
    // Sonst springt ein altes Design nach oben, sobald seine Druckdatei aus dem Archiv
    // zurueckgeholt wurde - die Datei ist dann neu, das Design nicht. Genau diesen Fehler
    // haette die heute gebaute Auslagerung sonst verursacht.
    const entstanden = j && j.created ? Date.parse(j.created) : 0;
    items.push({ designId, at: st.mtime, zeit: entstanden || st.mtimeMs, echt: !!entstanden, j, sperre });
  }
  items.sort((a, b) => b.zeit - a.zeit);   // Neueste immer zuerst
  // Doppelte kenntlich machen: sortiert wurde nach Entstehungszeit, und genau die gehoert
  // auch angezeigt. Frueher stand hier die DATEIzeit - die aendert sich beim Verschieben
  // des Logos oder beim Zurueckholen aus dem Archiv. Dann sah die Liste unsortiert aus,
  // obwohl sie es nicht war. Zwei verschiedene Zeiten an derselben Stelle: mein Fehler.
  const dop = new Map();
  for (const g of await doppelteFinden()) { for (const a of g.alt) dop.set(a.designId, g.neu.designId); dop.set(g.neu.designId, null); }
  const dopAnzahl = [...dop.values()].filter(x => x).length;
  // Pruefstand-Laeufe gehoeren keinem Kunden. Ungekennzeichnet zwischen echten Auftraegen
  // sind sie schlimmer als nutzlos: man haelt einen Testlauf fuer Kundenarbeit und
  // umgekehrt. Also sichtbar markieren - und auf einen Schlag wegraeumbar machen.
  const istTest = (x) => !!(x.j && x.j.test);
  const istGalerie = (x) => !!(x.j && (x.j.vorzeige || x.j.via === 'vorzeige'));
  const testAnzahl = items.filter(istTest).length;
  const galerieAnzahl = items.filter(istGalerie).length;
  const fremdAnzahl = testAnzahl + galerieAnzahl;
  // Die Druckerei bekommt weder Testdesigns noch Galerie-Beispiele zu sehen. Sie soll
  // drucken, was ein Kunde bestellt hat - alles andere hat auf ihrem Bildschirm nichts
  // verloren und kostet nur Zeit beim Suchen.
  if (!chef && fremdAnzahl) items = items.filter(x => !istTest(x) && !istGalerie(x));
  // Klarnamen der Mottos: "firmenausflug" ist das Kuerzel, "Firmenausflug" der Name.
  // Neben den Kundeneingaben ("Team Buchhaltung") sah das Kuerzel aus wie ein Widerspruch.
  const mottoNamen = {}, listeWorte = {};
  for (const m of await mottos.all()) { mottoNamen[m.slug] = m.name || m.slug; listeWorte[m.slug] = listeWortFuer(m); }
  const sc = await loadShowcase();
  // "Haben wir das selber gemacht oder war es ein Kunde?" - das gehoert an jedes Design.
  // Die Konten werden EINMAL aufgeloest, nicht je Zeile (sonst liest die Seite bei 200
  // Designs 200-mal dieselbe Datei).
  const konten = new Map();
  for (const id of new Set(items.map(x => x.j && x.j.user).filter(Boolean))) {
    try { const u = await accounts.byId(id); if (u) konten.set(id, { mail: u.email || '', firma: u.firma && u.firma.name ? u.firma.name : '' }); }
    catch (e) { /* Konto geloescht - dann bleibt die Kennung stehen */ }
  }
  // Was zaehlt als "wir selbst"? Unsere eigenen Mailadressen, Pruefstand und Galerie -
  // und alles, was nicht aus einem Browser kam (Skript, Bruecke, Werkzeug).
  const INTERNE = String(env.INTERNE_MAILS || '@motto-otto.de,@ball-z.de,@rasando.de')
    .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const interneMail = (mail) => { const m = String(mail || '').toLowerCase(); return !!m && INTERNE.some(x => x.startsWith('@') ? m.endsWith(x) : m === x); };
  const erstellerZeile = (j) => {
    if (!j) return '';
    const k = j.user ? konten.get(j.user) : null;
    const q = j.quelle || null;
    const teile = [];
    if (k) teile.push('Konto ' + k.mail + (k.firma ? ' · Firma ' + k.firma : ''));
    else if (j.user) teile.push('Konto ' + j.user + ' (gelöscht)');
    else if (j.gast) teile.push('Gast ' + String(j.gast).slice(0, 14) + '…');
    else teile.push('ohne Konto');
    if (q) teile.push(q.art === 'web' ? ('Browser ' + q.name + (q.seite ? ' · ' + q.seite : '')) : ('über die Schnittstelle · ' + q.name));
    if (j.via && j.via !== 'guest') teile.push('Weg: ' + j.via);
    const wir = !!(j.test || j.vorzeige || j.via === 'vorzeige' || j.via === 'pruefstand' || j.via === 'konsens' || (q && q.art === 'api') || interneMail(k && k.mail));
    const marke = wir ? '<span class="wer wir">🏠 wir selbst</span>'
      : q ? '<span class="wer kunde">👤 Kunde</span>'
      : '<span class="wer offen">❓ Herkunft nicht gespeichert</span>';
    return `<div class="v"><span class="lab">Erstellt von:</span> ${marke} ${escHtml(teile.join(' · '))}</div>`;
  };
  const tq = encodeURIComponent(String(token || ''));
  const rows = items.map(({ designId, zeit, echt, j, sperre }) => {
    const at = new Date(zeit);
    const se = sc[designId];
    // Woher der Zustand kommt, gehoert dazu: ein "nein" des Kunden ist etwas anderes als
    // eine Automatik-Sperre - das eine darf man nicht ueberstimmen, das andere schon.
    const kw = se && typeof se.kundenwunsch === 'boolean' ? se.kundenwunsch : null;
    const herkunft = kw === false ? ' <small>· vom Kunden gesperrt</small>'
      : kw === true ? ' <small>· vom Kunden freigegeben</small>'
      : (j && j.bewertungSperre) ? ` <small>· nicht im Pool: ${escHtml(j.bewertungSperre)}</small>` : '';
    const appr = chef ? `<div class="appr"><button class="approve${se && se.approved ? ' on' : ''}${kw === false ? ' gesperrt' : ''}" data-id="${designId}" data-on="${se && se.approved ? 1 : 0}"${kw === false ? ' disabled title="Der Kunde hat dieses Design nicht für die Bewertung freigegeben."' : ''}>${se && se.approved ? '★ freigegeben für Bewertung' : '☆ für Bewertung freigeben'}</button>${herkunft}${se && se.count ? ` <small>${se.count} Bewertungen · ⌀ ${(se.sum / se.count).toFixed(1)}</small>` : ''}</div>` : '';
    const vals = j && j.values ? Object.values(j.values).filter(Boolean).join(' · ') : '';
    const names = j && j.names && j.names.length ? j.names : null;
    const auf = (j && j.aufteilung) || 'vorne';
    const kader = !!(names && auf !== 'vorne');
    const link = (n, label, side) => { const q = `token=${tq}${n >= 0 ? '&n=' + n : ''}${side ? '&side=' + side : ''}`; return `${label ? escHtml(label) + ' ' : ''}<a class="knopf" download href="/api/mo/master/${designId}.png?${q}">⬇ PNG</a><a class="knopf" download href="/api/mo/master/${designId}.pdf?${q}">⬇ PDF</a>`; };
    const sizeOf = (i) => { const p = j && j.people && j.people[i]; const x = p ? [p.size, p.garment].filter(Boolean).join(' ') : ''; return x ? ' (' + escHtml(x) + ')' : ''; };
    const nameLinks = names ? '<div class="names">' + names.map((n, i) => `<span>${escHtml(n)}${sizeOf(i)}: ${auf === 'brust-kader' ? link(i, 'Brust', 'chest') : link(i, '')}</span>`).join('') + '</div>' : '';
    const csvLink = `<a class="knopf" download href="/api/mo/bestellliste/${designId}.csv?token=${tq}">⬇ Bestellliste CSV (Namen + Größen)</a>`;
    const kaderLinks = kader
      ? `<div class="dl">Rücken (${escHtml(listeWorte[j && j.motto] || 'Namensliste')}, ${names.length} Namen): ${link(-1, '', 'back')} · ${csvLink} <small>${auf === 'brust-kader' ? 'hinten groß mit allen Namen, vorne Brust-Print mit eigenem Namen' : 'vorne groß, hinten ' + escHtml(listeWorte[j && j.motto] || 'Namensliste')}</small></div>`
      : (j && j.back ? `<div class="dl">Rückseite (${j.back.count} Namen): ${link(-1, '', 'back')}${names ? ' · ' + csvLink : ''}</div>` : (names ? `<div class="dl">${csvLink}</div>` : ''));
    const warnung = sperre ? `<div class="sperre">🔒 Fanclub-Freigabe fehlt (${escHtml(sperre)}) – ${chef ? 'der Download bleibt bis zur Freigabe im Backend gesperrt.' : 'dieses Design darf noch nicht gedruckt werden.'}</div>` : '';
    // Rueckseite aus Zeitmangel ausgelassen: darf nicht stillschweigend fehlen, sonst geht
    // ein Abi-Shirt ohne die Namensliste in den Druck.
    const backWarn = j && j.backOffen ? `<div class="sperre">⚠️ Rückseite fehlt (${j.backOffen} Namen) – beim Erzeugen war die Zeit zu knapp. Design noch einmal laufen lassen.</div>` : '';
    // Logo verschieben - nur bei Designs, die ueberhaupt ein eingesetztes Logo haben.
    // Der Stand wird angezeigt, damit man sieht, ob schon justiert wurde.
    const f = (j && j.fein) || null;
    const fein = j && j.upload ? `<div class="fein" data-id="${designId}" data-dx="${f ? (+f.dxCm || 0) : 0}" data-dy="${f ? (+f.dyCm || 0) : 0}" data-g="${f ? (+f.groesse || 1) : 1}">
      <b>Logo verschieben</b> <small>exakt, ohne KI · Schritt <select class="f-step"><option value="0.5">0,5 cm</option><option value="1" selected>1 cm</option><option value="2">2 cm</option></select></small>
      <div class="f-knoepfe">
        <button class="knopf f-go" data-dx="0" data-dy="-1">▲ hoch</button><button class="knopf f-go" data-dx="0" data-dy="1">▼ runter</button>
        <button class="knopf f-go" data-dx="-1" data-dy="0">◀ links</button><button class="knopf f-go" data-dx="1" data-dy="0">▶ rechts</button>
        <button class="knopf f-gr" data-g="1.1">＋ größer</button><button class="knopf f-gr" data-g="0.9">－ kleiner</button>
        <button class="knopf f-null">↺ zurücksetzen</button>
        <span class="f-stand">${f && (f.dxCm || f.dyCm || (f.groesse && f.groesse !== 1)) ? `verschoben: ${(+f.dxCm || 0).toFixed(1).replace('.', ',')} cm rechts, ${(-(+f.dyCm || 0)).toFixed(1).replace('.', ',')} cm hoch${f.groesse && f.groesse !== 1 ? ` · Größe ${(+f.groesse).toFixed(2).replace('.', ',')}×` : ''}${f.begrenzt ? ' · durch die Druckfläche begrenzt' : ''}` : 'unverändert'}</span>
      </div></div>` : '';
    // Der Befund, der direkt nach dem Bauen der Druckdatei gemessen wurde. Steht hier,
    // damit niemand die Datei herunterladen und selbst nachmessen muss - und damit ein
    // Mangel auffaellt, bevor jemand die Datei zur Druckerei schickt.
    const d = j && j.druck;
    // Womit wurde erzeugt? Beim Vergleichen zweier Modelle weiss man sonst spaeter
    // nicht mehr, welches Design aus welchem Lauf stammt.
    const wieErzeugt = j && (j.modell || j.stufe) ? ` · ${escHtml(j.modell || 'Standardmodell')}${j.stufe ? ', ' + escHtml(j.stufe) : ''}` : '';
    const messung = d ? `<div class="mess ${d.druckfaehig ? 'gut' : 'schlecht'}">${d.druckfaehig ? '✅' : '⚠️'} Gemessen: ${d.breite}×${d.hoehe} px · ${
      d.alpha && d.alphaMin < 250 ? 'freigestellt (' + d.freiProzent + ' % frei)' : 'NICHT freigestellt – druckt als Kasten'
    }${d.weicheKantenProzent > 12 ? ' · ' + d.weicheKantenProzent + ' % halbdurchsichtig' : ''}${
      d.dunkelAuffaellig ? ' · ⚫ ' + d.dunkelGrundProzent + ' % gemalter dunkler Hintergrund (von ' + d.dunkelProzent + ' % dunkler Flaeche insgesamt)'
        : (typeof d.dunkelProzent === 'number' ? ' · dunkel: ' + d.dunkelProzent + ' %' : '')
    }${wieErzeugt}${
      d.gruende && d.gruende.length ? ' · ' + escHtml(d.gruende.join('; ')) : ''
    }</div>` : '';
    // Fassung 38: Logo-als-Vorlage sichtbar machen - wurde die vom Modell gemalte Kopie gefunden
    // (dann sitzt die Stanze richtig) und wie viel Rest musste rundherum getilgt werden?
    const logoZoneZeile = j && j.logoWeg === 'zone' && j.logoTreffer
      ? `<div class="mess gut">✅ Logo in eigener Zone ${j.logoOben === false ? 'unten' : 'oben'} · Breite ${j.logoTreffer.breite} px · das Motiv lief ohne Logo durch den Bilddienst</div>` : '';
    const logoLage = j && (j.logoWeg === 'vorlage' || j.logoWeg === 'platzhalter') && j.logoTreffer ? (j.logoWeg === 'platzhalter'
      ? `<div class="mess ${j.logoTreffer.gefunden ? 'gut' : 'schlecht'}">${j.logoTreffer.gefunden ? '✅ Platzhalter gefunden, Logo genau dort eingesetzt' : '⚠️ Platzhalter vom Modell zerstört, Logo an der Sollposition'} · Breite ${j.logoTreffer.breite} px${typeof j.logoRest === 'number' ? ' · Signalfarbe (' + (j.logoFarbe || '?') + ') entfernt: ' + j.logoRest.toLocaleString('de-DE') + ' px' : ''}</div>`
      : `<div class="mess ${j.logoTreffer.gefunden ? 'gut' : 'schlecht'}">${j.logoTreffer.gefunden ? '✅ Logo-Kopie des Modells gefunden' : '⚠️ Logo-Kopie NICHT gefunden, Stanze an der Sollposition'} (Übereinstimmung ${j.logoTreffer.score}${j.logoTreffer.deckung != null ? ', Deckung ' + j.logoTreffer.deckung : ''}) · Breite ${j.logoTreffer.breite} px${j.logoGaenge ? ' · ' + j.logoGaenge + ' Schälgang' + (j.logoGaenge > 1 ? 'e' : '') : ''}${typeof j.logoRest === 'number' ? ' · Reste getilgt: ' + j.logoRest.toLocaleString('de-DE') + ' px' : ''}</div>`) : '';
    return `<div class="row${j && j.test ? ' istest' : ''}${j && (j.vorzeige || j.via === 'vorzeige') ? ' istest isgalerie' : ''}">
      <a class="vb" href="/api/mo/master/${designId}.png?token=${tq}" download title="Druckdatei herunterladen"><img src="/api/mo/druckbild/${designId}.jpg?token=${tq}" loading="lazy" alt="" onerror="this.remove()"><span>Druckdatei<br>herunterladen</span></a>
      <div class="info">
        ${j && +j.lfdNr > 0 ? `<span class="lfd">Auftrag ${String(j.lfdNr).padStart(5, '0')}</span> ` : ''}<b>${escHtml(j && (mottoNamen[j.motto] || j.motto) || '')}</b>${
          !j ? ' <span class="dop">⚠ Auftragsdaten fehlen – beim Erzeugen abgebrochen</span>' : ''} <span class="id">${escHtml(designId)}</span> <span class="t">${at.toLocaleString('de-DE')}${echt ? '' : ' (geschätzt)'}</span>${
          j && j.test ? ' <span class="pruef">🔧 Prüfstand – kein Kundendesign</span>'
          : j && (j.vorzeige || j.via === 'vorzeige') ? ' <span class="pruef gal">🖼 Galerie-Beispiel – kein Kundendesign</span>' : ''}${
          dop.has(designId) ? (dop.get(designId)
            ? ` <span class="dop">gleiche Eingabe schon vorhanden – neuere: ${escHtml(dop.get(designId))}</span>`
            : ' <span class="dop neu">es gibt ältere Läufe mit derselben Eingabe</span>') : ''}
        <div class="v">${vals ? '<span class="lab">Eingaben:</span> ' : ''}${escHtml(vals)}</div>
        ${j ? `<div class="v"><span class="lab">Gestaltung:</span> ${escHtml([
          'Stil: ' + (j.style && STYLES[j.style] && STYLES[j.style].label ? STYLES[j.style].label : (j.style || 'Wie vorgesehen')),
          j.figuren ? 'Figuren: ' + (FIGUREN[j.figuren] ? FIGUREN[j.figuren].label : j.figuren) : '',
          j.mood && j.mood !== 'standard' ? 'Stimmung: ' + (MOODS[j.mood] && MOODS[j.mood].label ? MOODS[j.mood].label : j.mood) : '',
          j.nameArt ? 'Name: ' + (j.nameArt === 'motiv' ? 'ins Motiv' : 'unter dem Motiv') : '',
          j.logoArt ? 'Logo: ' + (j.logoArt === 'exakt' ? 'Original exakt' : 'eingearbeitet') : '',
          istHell(j.textile) ? 'helles Textil' : 'dunkles Textil',
          j.modell || '', j.stufe ? 'Stufe ' + j.stufe : '', j.fassung ? 'Prompt: ' + j.fassung : ''
        ].filter(Boolean).join(' · '))}</div>` : ''}
        ${chef ? erstellerZeile(j) : ''}
        ${warnung}${backWarn}
        ${messung}${logoZoneZeile}${logoLage}
        <div class="dl">${names ? 'Ohne Namen: ' : ''}${link(-1, 'Druckdatei:')}<a class="knopf" download href="/api/mo/master/${designId}.svg?token=${tq}">⬇ SVG</a><a class="knopf" href="/api/mo/druckbild/${designId}.jpg?gross=1&token=${tq}" target="_blank">groß ansehen</a><a class="knopf" href="/api/mo/kante/${designId}.png?token=${tq}" target="_blank" title="Drei Randstellen sechsfach vergrößert, auf Weiß und auf Schwarz">Kante prüfen</a><br><small>PNG in Echtgröße mit dpi · PDF als Vektor aus der SVG, gleiches Maß · SVG mehrfarbig vektorisiert</small></div>
        ${kaderLinks}
        ${nameLinks}
        ${fein}
        ${appr}
        ${chef ? `<div class="del"><button class="delete" data-id="${designId}">🗑 Design löschen</button></div>` : ''}
      </div></div>`;
  }).join('');
  res.type('html').send(`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motto Otto · Druckdateien</title>
<style>body{margin:0;background:#14131a;color:#f4f2f7;font-family:system-ui,sans-serif;font-size:15px}.wrap{max-width:1000px;margin:0 auto;padding:24px 16px}h1{font-size:22px}h1 span{color:#ffc542}
.row{display:flex;gap:16px;background:#1d1c25;border:1px solid #35323f;border-radius:10px;padding:12px;margin-bottom:12px}
.vb{position:relative;flex:0 0 140px;width:140px;height:140px;border-radius:8px;background:#26242f;border:1px solid #35323f;overflow:hidden;display:block}
.vb img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1;background:#26242f}
.vb span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;font-weight:700;color:#8b8598;padding:8px}
.vb:hover img{opacity:.25}.vb:hover span{color:#ffc542;z-index:2}
.info{flex:1;min-width:0}.id{font-family:ui-monospace,monospace;font-size:12px;color:#ffc542}.t{color:#8b8598;font-size:12px}.v{color:#b6b1c2;margin:4px 0 8px}
.wer{display:inline-block;border-radius:6px;padding:1px 8px;font-size:12.5px;font-weight:700;margin-right:6px}
.wer.wir{background:#2a2438;color:#c9b3ff;border:1px solid #4b3d6b}.wer.kunde{background:#1e2c22;color:#8fe0a6;border:1px solid #2f5a3c}.wer.offen{background:#2b2620;color:#d8c08a;border:1px solid #5a4a2f}
a{color:#ffc542;text-decoration:none;font-weight:700}a:hover{text-decoration:underline}.dl{margin-bottom:6px}.dl small{color:#8b8598;font-weight:400;display:inline-block;margin-top:3px}
.knopf{display:inline-block;background:#26242f;border:1px solid #4a4656;border-radius:6px;padding:3px 10px;font-size:13px;margin:2px 6px 2px 0}.knopf:hover{background:#ffc542;color:#1b1710;border-color:#ffc542;text-decoration:none}
.names{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:13.5px}.names span{background:#26242f;border-radius:6px;padding:4px 8px}
.names .knopf{background:#1d1c25;padding:1px 7px;font-size:12px;margin:0 0 0 4px}
.appr{margin-top:10px}.approve{font:inherit;font-size:13px;font-weight:700;padding:6px 11px;border-radius:7px;border:1px solid #35323f;background:#26242f;color:#b6b1c2;cursor:pointer}.approve.on{background:#ffc542;color:#1b1710;border-color:#ffc542}.appr small{color:#8b8598;font-weight:400;margin-left:8px}
.del{margin-top:8px}.delete{font:inherit;font-size:13px;font-weight:700;padding:6px 11px;border-radius:7px;border:1px solid #5c2b2b;background:#2a1c1c;color:#ff8a8a;cursor:pointer}.delete:hover{background:#3a2020}.row.gone{opacity:.4;pointer-events:none}
.fein{margin-top:10px;border-top:1px solid #35323f;padding-top:9px;font-size:13px}.fein b{font-size:13px}.fein small{color:#8b8598}
.fein .f-step{font:inherit;font-size:12px;background:#26242f;color:#b6b1c2;border:1px solid #35323f;border-radius:5px;padding:2px 4px}
.f-knoepfe{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px}
.f-stand{color:#8b8598;font-size:12.5px}.fein.laeuft{opacity:.5;pointer-events:none}
.kopf{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}.kopf a{font-size:14px}
.nurlesen{font-size:13px;color:#8b8598;border:1px solid #35323f;border-radius:20px;padding:3px 12px}
.sperre{background:#2a2416;border:1px solid #5c4a2b;color:#ffc542;border-radius:7px;padding:6px 10px;margin:0 0 8px;font-size:13px}
.mess{font-size:12.5px;margin:0 0 8px;font-family:ui-monospace,monospace}.mess.gut{color:#8aff9c}.mess.schlecht{color:#ff8a8a}
#suche{font:inherit;width:100%;box-sizing:border-box;margin:0 0 14px;padding:9px 12px;border-radius:8px;border:1px solid #35323f;background:#1d1c25;color:#f4f2f7}
.row.weg{display:none}
.dop{font-size:11.5px;background:#3a2020;border:1px solid #5c2b2b;color:#ff8a8a;border-radius:5px;padding:1px 7px}
.dop.neu{background:#26242f;border-color:#35323f;color:#8b8598}
.pruef{font-size:11.5px;background:#1c2430;border:1px solid #2b4a5c;color:#7fc4e8;border-radius:5px;padding:1px 7px}
.pruef.gal{background:#241c30;border-color:#4a2b5c;color:#c49ae8}
.lab{color:#8b8598}
.lfd{font-family:ui-monospace,monospace;font-size:12px;background:#26242f;border:1px solid #4a4656;border-radius:5px;padding:1px 7px;color:#ffc542}
.dopbar.test{background:#16222a;border-color:#2b4a5c;color:#7fc4e8}
.dopbar label{font-size:13px;margin-left:8px;white-space:nowrap}.dopbar label input{vertical-align:-1px}
/* Pruefstand-Laeufe sind Testdesigns. Die Druckliste ist fuer Kundenarbeit da - also
   standardmaessig weg, aber auf einen Haken wieder sichtbar. */
.row.istest{display:none}
body.testzeigen .row.istest{display:flex;border-color:#2b4a5c}
body.testzeigen .row.istest.weg{display:none}
#dop-liste{font-size:13px;color:#b6b1c2;margin:0 0 14px}
#dop-liste .g{background:#1d1c25;border:1px solid #35323f;border-radius:8px;padding:8px 10px;margin-bottom:6px}
#dop-liste b{color:#f4f2f7}
.dopbar{background:#2a2416;border:1px solid #5c4a2b;color:#ffc542;border-radius:8px;padding:10px 12px;margin:0 0 14px;font-size:13.5px}
.dopbar button{font:inherit;font-size:13px;font-weight:700;padding:6px 11px;border-radius:7px;border:1px solid #5c2b2b;background:#2a1c1c;color:#ff8a8a;cursor:pointer;margin-left:6px}
.dopbar button:hover{background:#3a2020}.dopbar #dop-msg{color:#b6b1c2;margin-left:8px}</style>
<div class="wrap"><div class="kopf"><h1>Motto <span>Otto</span> · Druckdateien (${items.length - (chef ? fremdAnzahl : 0)} von Kunden${chef && fremdAnzahl ? ` + ${fremdAnzahl} eigene` : ''})</h1>${chef ? '<a href="/admin">← Zurück ins Backend</a>' : '<span class="nurlesen">Nur Ansehen und Herunterladen</span>'}</div>
<p style="color:#8b8598">${chef
  ? 'Neueste zuerst – nach Entstehungszeit des Designs. „Für Bewertung freigeben" zeigt ein Design Besuchern während der Generierung zur 5-Sterne-Bewertung; die bestbewerteten erscheinen als „Beliebteste Designs". Gelöschtes ist endgültig weg und kommt auch aus dem Archiv nicht zurück.'
  : 'Neueste zuerst. PNG für DTF/Siebdruck (4096 px breit, transparent), PDF mit 300 dpi in Echtgröße, SVG als Vektor. Bei Namenslisten gibt es je Person eine eigene Datei und eine Bestellliste mit Größen.'}</p>
${chef && fremdAnzahl ? `<div class="dopbar test">🔧 <b>${fremdAnzahl} eigene Designs</b> in der Liste${testAnzahl ? ` · ${testAnzahl} aus dem Prüfstand` : ''}${galerieAnzahl ? ` · ${galerieAnzahl} Galerie-Beispiele` : ''} – die gehören keinem Kunden. <b>Sie sind unten ausgeblendet</b>, damit diese Liste zeigt, was Kunden gemacht haben.
  <label><input type="checkbox" id="test-zeigen"> mit anzeigen</label>
  ${testAnzahl ? `<button id="test-go">${testAnzahl === 1 ? 'Den Prüfstand-Lauf' : 'Alle ' + testAnzahl + ' Prüfstand-Läufe'} löschen</button>` : ''}
  ${galerieAnzahl ? `<button id="gal-go">Verwaiste Galerie-Designs aufräumen</button>` : ''} <span id="test-msg"></span><span id="gal-msg"></span></div>` : ''}
${chef && dopAnzahl ? `<div class="dopbar">⚠️ <b>${dopAnzahl}× dieselbe Eingabe doppelt</b> – gleiches Motto, gleiche Eingaben, gleicher Stil, gleiches Textil. Meist mehrfach gestartete Aufträge oder wiederholte Prüfstand-Läufe.
  <button id="dop-go">Ansehen und löschen (je das neueste bleibt)</button> <span id="dop-msg"></span></div>
  <div id="dop-liste"></div>` : ''}
<input id="suche" type="search" placeholder="Suchen: Auftragsnr, Motto, Design-Nr, Name …" autocomplete="off">${rows}</div>
<script>
var TOKEN=${JSON.stringify(String(token || ''))};
(function(){
  var feld=document.getElementById('suche');
  var reihen=[].slice.call(document.querySelectorAll('.row')).map(function(r){return {el:r,txt:(r.textContent||'').toLowerCase()};});
  feld.addEventListener('input',function(){
    var q=feld.value.trim().toLowerCase();
    reihen.forEach(function(r){r.el.classList.toggle('weg',q!==''&&r.txt.indexOf(q)<0);});
  });
  // Prüfstand-Läufe einblenden. Die Wahl merkt sich der Browser, damit der Haken nicht
  // bei jedem Seitenaufruf neu gesetzt werden muss.
  var haken=document.getElementById('test-zeigen');
  if(haken){
    try{ haken.checked=localStorage.getItem('mo_test_zeigen')==='1'; }catch(e){}
    var an=function(){
      document.body.classList.toggle('testzeigen',haken.checked);
      try{ localStorage.setItem('mo_test_zeigen',haken.checked?'1':'0'); }catch(e){}
    };
    haken.addEventListener('change',an); an();
  }
})();
// Logo verschieben. Die Werte werden AUFADDIERT, damit man sich mit mehreren Klicks
// herantasten kann - jeder Klick schickt den neuen Gesamtstand, nicht nur den Schritt.
document.querySelectorAll('.fein').forEach(function(box){
  var id=box.getAttribute('data-id');
  // Mit dem GESPEICHERTEN Stand anfangen, nicht bei Null: sonst wuerde der erste Klick
  // eine schon vorhandene Justierung stillschweigend wegwerfen.
  var stand={dxCm:parseFloat(box.getAttribute('data-dx'))||0,dyCm:parseFloat(box.getAttribute('data-dy'))||0,groesse:parseFloat(box.getAttribute('data-g'))||1};
  var stelle=box.querySelector('.f-stand');
  function schritt(){return parseFloat(box.querySelector('.f-step').value)||1;}
  function senden(){
    box.classList.add('laeuft');stelle.textContent='wird neu gebaut …';
    fetch('/api/mo/druck/fein?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({designId:id,dxCm:stand.dxCm,dyCm:stand.dyCm,groesse:stand.groesse})})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
    .then(function(a){
      box.classList.remove('laeuft');
      if(!a.ok){stelle.textContent=(a.j&&a.j.hinweis)||'Hat nicht geklappt.';return;}
      var f=a.j.fein;stand=f;
      var nix=!f.dxCm&&!f.dyCm&&f.groesse===1;
      stelle.textContent=nix?'unverändert':('verschoben: '+f.dxCm.toFixed(1).replace('.',',')+' cm rechts, '+(-f.dyCm).toFixed(1).replace('.',',')+' cm hoch'+(f.groesse!==1?' · Größe '+f.groesse.toFixed(2).replace('.',',')+'×':'')+(f.begrenzt?' · durch die Druckfläche begrenzt':''))
        +(a.j.druck&&!a.j.druck.druckfaehig?' ⚠️ Druckdatei mit Mängeln':'');
      // Vorschau und Bilder neu laden - sonst zeigt der Browser das alte Logo
      var r=box.closest('.row');
      if(r) r.querySelectorAll('img').forEach(function(im){var s=im.src.split('#')[0];im.src=s+(s.indexOf('?')<0?'?':'&')+'v='+Date.now();});
    }).catch(function(){box.classList.remove('laeuft');stelle.textContent='Hat nicht geklappt.';});
  }
  box.querySelectorAll('.f-go').forEach(function(b){b.addEventListener('click',function(){
    stand.dxCm=Math.round((stand.dxCm+(+b.getAttribute('data-dx'))*schritt())*10)/10;
    stand.dyCm=Math.round((stand.dyCm+(+b.getAttribute('data-dy'))*schritt())*10)/10;
    senden();});});
  box.querySelectorAll('.f-gr').forEach(function(b){b.addEventListener('click',function(){
    stand.groesse=Math.round(stand.groesse*(+b.getAttribute('data-g'))*100)/100;senden();});});
  box.querySelector('.f-null').addEventListener('click',function(){stand={dxCm:0,dyCm:0,groesse:1};senden();});
});
document.querySelectorAll('.approve').forEach(function(b){
  b.addEventListener('click',function(){
    var on=b.getAttribute('data-on')==='1';b.disabled=true;
    fetch('/api/mo/showcase/approve?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({designId:b.getAttribute('data-id'),approved:!on})})
    .then(function(r){return r.json();}).then(function(j){b.disabled=false;if(j&&j.ok){b.setAttribute('data-on',j.approved?'1':'0');b.classList.toggle('on',!!j.approved);b.textContent=j.approved?'★ freigegeben für Bewertung':'☆ für Bewertung freigeben';}}).catch(function(){b.disabled=false;});
  });
});
document.querySelectorAll('.delete').forEach(function(b){
  b.addEventListener('click',function(){
    var id=b.getAttribute('data-id');
    if(!confirm('Design '+id+' endgültig löschen?\\n\\nAlle Dateien werden entfernt, das Design kommt aus der Bewertung und wird auch auf Google Drive in den Papierkorb gelegt. Die Nummer wird gesperrt – das Design kann nirgends wieder auftauchen. Das lässt sich nicht rückgängig machen.'))return;
    b.disabled=true;b.textContent='lösche …';
    fetch('/api/mo/design/delete?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({designId:id})})
    .then(function(r){return r.json();}).then(function(j){if(j&&j.ok){var row=b.closest('.row');if(row){row.classList.add('gone');}b.textContent='gelöscht ✓';}else{b.disabled=false;b.textContent='🗑 Design löschen';alert((j&&j.error)||'Fehler');}}).catch(function(){b.disabled=false;b.textContent='🗑 Design löschen';});
  });
});
// Aufräumen in zwei Schritten: erst anzeigen, was wegkäme, dann löschen. Die Liste steht
// auf der SEITE, nicht in einem Dialogfenster - mehrere hundert Zeilen in einem confirm()
// kann auf dem Handy niemand lesen, und blind auf "OK" tippen ist beim Löschen die falsche
// Bewegung. Achtung beim Ändern: diese Seite ist in server.js ein Template-String, also
// gehört ein Zeilenumbruch im Text als \\n geschrieben - sonst zerreißt es das Skript und
// KEIN Knopf der Seite funktioniert mehr. Genau das ist mir hier passiert.
function aufraeumen(knopfId,msgId,pfad,wortEinzahl,wortMehrzahl,zeigen){
  var knopf=document.getElementById(knopfId); if(!knopf) return;
  var msg=document.getElementById(msgId);
  knopf.addEventListener('click',function(){
    knopf.disabled=true;msg.textContent='prüfe …';
    fetch(pfad+'?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
    .then(function(r){return r.json();}).then(function(j){
      knopf.disabled=false;
      if(!j||!j.ok||!j.loeschen){msg.textContent='Nichts zu löschen.';return;}
      msg.textContent='';
      if(zeigen) zeigen(j);
      var was=j.loeschen+' '+(j.loeschen===1?wortEinzahl:wortMehrzahl);
      if(!confirm(was+' endgültig löschen? Das lässt sich nicht rückgängig machen.')) return;
      knopf.disabled=true;msg.textContent='lösche … das dauert einen Moment';
      fetch(pfad+'?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({wirklich:true})})
      .then(function(r){return r.json();}).then(function(k){
        msg.textContent=(k&&k.geloescht?k.geloescht:0)+' gelöscht – Seite wird neu geladen …';
        setTimeout(function(){location.reload();},900);
      }).catch(function(){knopf.disabled=false;msg.textContent='Hat nicht geklappt.';});
    }).catch(function(){knopf.disabled=false;msg.textContent='Hat nicht geklappt.';});
  });
}
aufraeumen('dop-go','dop-msg','/api/mo/design/doppelte','doppeltes Design','doppelte Designs',function(j){
  var box=document.getElementById('dop-liste'); if(!box) return;
  box.innerHTML='<div class="g"><b>'+j.loeschen+'</b> Designs würden gelöscht, <b>'+j.gruppen+'</b> bleiben stehen (je das neueste). Nach Motto:</div>'+
    (j.proMotto||[]).map(function(m){return '<div class="g"><b>'+m.motto+'</b>: '+m.n+' weg, '+m.bleibt+' bleiben</div>';}).join('');
  box.scrollIntoView({block:'nearest'});
});
aufraeumen('test-go','test-msg','/api/mo/design/pruefstand-weg','Prüfstand-Lauf','Prüfstand-Läufe');
aufraeumen('gal-go','gal-msg','/api/mo/design/galerie-reste','verwaistes Galerie-Design','verwaiste Galerie-Designs',function(j){
  var box=document.getElementById('dop-liste'); if(!box) return;
  box.innerHTML='<div class="g"><b>'+j.loeschen+'</b> Galerie-Designs werden nicht mehr benutzt und würden gelöscht. <b>'+j.inBenutzung+'</b> aktuelle Beispiele bleiben unberührt. Nach Motto:</div>'+
    (j.proMotto||[]).map(function(m){return '<div class="g"><b>'+m.motto+'</b>: '+m.n+'</div>';}).join('');
  box.scrollIntoView({block:'nearest'});
});
</script></html>`);
});

// ---------- Showcase / Bewertungen ----------
// Vom Chef freigegebene Designs werden waehrend der Generierung zur Bewertung (5 Sterne)
// gezeigt und die bestbewerteten spaeter als "Beliebteste Designs" angezeigt.
const SHOWCASE_FILE = path.join(STORE, 'showcase.json');
let showcaseCache = null;
async function loadShowcase() {
  if (!showcaseCache) {
    try { showcaseCache = JSON.parse(await fs.readFile(SHOWCASE_FILE, 'utf8')); } catch (e) { showcaseCache = {}; }
    // Geloeschtes bleibt geloescht - auch wenn es ueber einen anderen Weg (Vorzeige-Liste,
    // Freigabe, ein alter Auftrag) wieder in den Pool geraten waere. Hier ist die eine
    // Stelle, durch die JEDER Zugriff auf den Pool geht.
    const tot = await geloeschtLaden();
    let weg = 0;
    for (const id of Object.keys(showcaseCache)) if (tot[id]) { delete showcaseCache[id]; weg++; }
    if (weg) { console.log('Bewertungs-Pool: ' + weg + ' geloeschte Designs entfernt'); saveShowcase(); }
  }
  return showcaseCache;
}
let showcaseWrite = Promise.resolve();
function saveShowcase() {
  const data = showcaseCache || {};
  showcaseWrite = showcaseWrite.then(() => fs.writeFile(SHOWCASE_FILE, JSON.stringify(data, null, 2))).catch(e => console.error('showcase speichern', e && e.message ? e.message : e));
  return showcaseWrite;
}
// Ein vergleichbarer Zeitschluessel, egal ob der Eintrag eine Zeit hat oder nur eine
// Design-Nummer. Beides wird zu "YYYY-MM-DD..." - so sortiert ein einfacher Textvergleich
// richtig, ohne dass ein Datum ohne Uhrzeit gegen eine ISO-Zeit verliert.
function zeitSchluessel(x) {
  if (x && x.created) return String(x.created);
  const m = String((x && x.designId) || '').match(/-(\d{8})-/);
  return m ? `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}T00:00:00.000Z` : '0000';
}

// Liegt das fertige Mockup (jpg oder avif/webp) schon da? Dieselbe Namensregel wie die Route.
async function mockupLiegtDa(designId, garment, color, print, { szene = false, back = false, farbe = '', linie = '' } = {}) {
  const jobT = await readJob(designId);
  const { cached } = await mockupPlan(designId, garment, color, jobT, { szene: szene ? '1' : '', side: back ? 'back' : '', farbe, linie });
  for (const end of ['', '.avif', '.webp']) { try { await fs.access(cached + end); return true; } catch (e) { /* weiter */ } }
  return false;
}
// Fehlende Mockups nacheinander im Hintergrund bauen - ueber die eigene Route, damit Cache und
// Regeln dieselben sind. Nie mehr als eins gleichzeitig, sonst frisst es den Speicher.
let nachbauKette = Promise.resolve();
const nachbauOffen = new Set();
function mockupNachbauen(url) {
  if (nachbauOffen.has(url) || process.env.ABNAHME) return;
  nachbauOffen.add(url);
  nachbauKette = nachbauKette.then(async () => {
    try { const r = await fetch(String(url).replace(env.PUBLIC_BASE_URL, 'http://127.0.0.1:' + env.PORT), { signal: AbortSignal.timeout(180000), headers: { 'x-mo-hintergrund': '1' } }); await r.arrayBuffer(); }
    catch (e) { /* beim naechsten Aufruf noch einmal */ }
    finally { nachbauOffen.delete(url); }
  });
}
// 21. Sept. (Markus, Robotic: "Der neue Stil Robotic ist Katastrophe an den Raendern"):
// nachgemessen - seit Fassung 64 (16. Sept.) hat kanteGlaetten jede Druckdatei-Kante auf rund
// 15 px (1,5 mm) verwaschen, weil linear() in der sharp-Kette nicht auf Alpha wirkte (images.js).
// Die Rechnung ist berichtigt; die Druckdateien auf dem Volume tragen die weiche Kante aber
// noch. Ein zweiter Lauf der berichtigten Glaettung zieht sie wieder steil (gemessen: 15 -> 3 px).
// Laeuft einmal nach dem Start, Datei fuer Datei in der Hintergrundspur, und merkt sich den
// Stand in masters/kante-stand.txt. Randlose Dateien (ohne Alphakanal) bleiben unberuehrt.
const KANTE_STAND = 1;
async function druckkantenNachschaerfen() {
  const dir = path.join(STORE, 'masters'), merker = path.join(dir, 'kante-stand.txt');
  try { if (+(await fs.readFile(merker, 'utf8')) >= KANTE_STAND) return { uebersprungen: true }; } catch (e) { /* noch kein Stand */ }
  const t0 = Date.now();
  let dateien = [];
  try { dateien = (await fs.readdir(dir)).filter(f => /_(PRINT|BACK)_MASTER\.png$/.test(f)); } catch (e) { return { fehler: 'masters nicht lesbar' }; }
  let geschaerft = 0, ohneAlpha = 0, schief = 0;
  for (const f of dateien) {
    try {
      await mitBildarbeit('Druckkante ' + f, async () => {
        const p = path.join(dir, f);
        const buf = await fs.readFile(p);
        const m = await sharp(buf).metadata();
        if (!m.hasAlpha) { ohneAlpha++; return; }
        const neu = await kanteGlaetten(buf);
        await fs.writeFile(p + '.tmp', await sharp(neu).withMetadata({ density: m.density || PRINT_DPI }).png({ compressionLevel: 9 }).toBuffer());
        await fs.rename(p + '.tmp', p);
        geschaerft++;
        // das kleine Druckbild dieser Datei ist damit veraltet
        const id = f.replace(/_(PRINT|BACK)_MASTER\.png$/, '');
        try { for (const c of (await fs.readdir(path.join(STORE, 'mockups')))) if (c.startsWith('druckbild_' + id + '_')) await fs.unlink(path.join(STORE, 'mockups', c)).catch(() => {}); } catch (e) { /* kein Cache */ }
      }, { hintergrund: true });
    } catch (e) { schief++; console.error('Druckkante nachschaerfen:', f, e && e.message ? e.message : e); }
  }
  try { await fs.writeFile(merker, String(KANTE_STAND)); } catch (e) { /* dann eben beim naechsten Start noch einmal */ }
  const dauer = Math.round((Date.now() - t0) / 1000);
  console.log(`Druckkanten nachgeschaerft: ${geschaerft} Dateien, ${ohneAlpha} randlos (unveraendert), ${schief} nicht lesbar · ${dauer} s`);
  return { geschaerft, ohneAlpha, schief, dauer };
}
async function stilbeispieleVorwaermen() {
  const t0 = Date.now();
  let gebaut = 0, lagenDa = 0, schief = 0;
  try {
    for (const m of (await mottos.all()).filter(x => x.active !== false && !x.artikelFest)) {
      let beispiele = {};
      try { beispiele = await vorzeige.read(m.slug); } catch (e) { continue; }
      for (const [style, id] of Object.entries(beispiele)) {
        if (!id || style === 'kachel') continue;
        try {
          if (await vorzeige.stilFertig(m.slug, style, 'tee', false)) { lagenDa++; continue; }
          await vorzeige.stilMockup(m.slug, style, 'tee', false, { hintergrund: true });
          gebaut++;
        } catch (e) { schief++; }
      }
    }
  } catch (e) { console.error('Stilbeispiele vorwaermen:', e && e.message ? e.message : e); }
  const dauer = Math.round((Date.now() - t0) / 1000);
  if (gebaut || schief) console.log(`Stilbeispiele vorgewaermt: ${gebaut} gebaut, ${lagenDa} lagen da, ${schief} nicht baubar · ${dauer} s`);
  return { gebaut, lagenDa, schief, dauer };
}
async function showcaseVorwaermen() {
  const t0 = Date.now();
  let gebaut = 0, schief = 0;
  try {
    const basis = 'http://127.0.0.1:' + env.PORT;
    const liste = await (await fetch(basis + '/api/mo/showcase?mode=rate&limit=40&vielfalt=1', { signal: AbortSignal.timeout(60000) })).json();
    for (const x of (liste.designs || [])) {
      const url = String(x.image).replace(env.PUBLIC_BASE_URL, basis);
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { 'x-mo-hintergrund': '1' } });
        if (r.ok) gebaut++; else schief++;
        await r.arrayBuffer();
      } catch (err) { schief++; }
    }
  } catch (e) { console.error('Schaufenster vorwaermen:', e && e.message ? e.message : e); }
  const dauer = Math.round((Date.now() - t0) / 1000);
  console.log(`Schaufenster vorgewaermt: ${gebaut} Bilder da, ${schief} nicht baubar · ${dauer} s`);
  return { gebaut, schief, dauer };
}
// DUNKEL AUF DUNKEL (Markus, 1. Okt.: "ganz oft seh ich Dunkeltextilien mit einem dunklen Design,
// was Horror aussieht ... wir muessen 100 % sein"; 2. Okt., auf die Frage: "Ja, auf hellem Shirt
// zeigen"). Gemessen wird die Druckdatei, auf 48 px verkleinert (duenne Konturen verschwimmen, grosse
// dunkle Fuellungen bleiben): Anteil der Motivflaeche unter 1,6 : 1 Kontrast auf Schwarz. Geeicht am
// 1. Okt. an der Bewertungsliste gegen das Auge: Opa WGK9 69 %, Landwirt NCMU 45 %, ABInauten T6ZV
// 31 % (Grenzfall) - alle anderen unter 26 % und im Bild in Ordnung; am 2. Okt. dazu Steffi 40
// Fotorealistisch 9YAG 29 % (dunkler Kuchen, beim Ansehen fuer das Schaufenster aussortiert). Ueber
// 27 % wird ein Design fuer dunkles Textil beim VORZEIGEN auf hellem Shirt gezeigt. Der
// Kundenauftrag bleibt, wie bestellt.
const DUNKEL_GRENZE = 27;
function anzeigeTextil(e, ersatz) {
  const t = (e && e.textile) || ersatz || 'dunkel';
  return !istHell(t) && e && typeof e.dunkel === 'number' && e.dunkel > DUNKEL_GRENZE ? 'weiss' : t;
}
async function dunkleFlaeche(designId) {
  const buf = await masterLesen(designId);
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const { data } = await sharp(buf).ensureAlpha().resize(48, 48, { fit: 'inside', kernel: 'cubic' }).raw().toBuffer({ resolveWithObject: true });
  let n = 0, dunkel = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] / 255 < 0.6) continue;
    n++;
    const lum = 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
    if ((lum + 0.05) / 0.05 < 1.6) dunkel++;
  }
  return n ? Math.round(dunkel / n * 100) : 0;
}
// Im Hintergrund nachtragen, einmal je Design, nach dem Start und dann halbstuendlich (Regel 6):
// nur freigegebene Designs fuer dunkles Textil, deren Wert noch fehlt.
async function dunkelNachtragen() {
  let neu = 0;
  try {
    const sc = await loadShowcase();
    for (const [id, e] of Object.entries(sc)) {
      if (!e || !e.approved || istHell(e.textile) || typeof e.dunkel === 'number') continue;
      try { e.dunkel = await dunkleFlaeche(id); neu++; }
      catch (err) { console.error('Dunkel-Messung ' + id + ':', err && err.message ? err.message : err); e.dunkel = -1; }
      if (e.dunkel > DUNKEL_GRENZE) console.log('Dunkel auf dunkel: ' + id + ' ' + e.dunkel + ' % - wird auf hellem Shirt gezeigt');
    }
    if (neu) await saveShowcase();
  } catch (err) { console.error('Dunkel-Messung gescheitert:', err && err.message ? err.message : err); }
  return neu;
}
if (!process.env.ABNAHME) {
  setTimeout(() => { dunkelNachtragen().finally(() => setInterval(dunkelNachtragen, 30 * 60e3)); }, 90e3);
}
// 4. Okt., Markus (Band "Shirts und mehr", Kegeltour Japan auf der Zip-Jacke): "Wir hatten das eigentlich so
// gebrummt, dass so grosse Flaechen komplett gedruckt eigentlich nicht mehr vorkommen" - "Die muessen
// Unterbrechung haben. Das Ganze fuehlt sich sonst an wie ein Brett." Gemessen wie am 2. Okt. bei Luigi
// (Anteil voll deckender Zellen im Motivumriss; Druckdatei auf 512 px, Zellen 16 px = rund 3 % der Breite,
// Alpha unter 96 = leer, voll = jede Zelle ab Alpha 230): Kegeltour Japan TF3Z 79, Neon PMQU 77, Angler TUZN
// 72, Abschlussfahrt 3R7S 67 - die Bretter; locker gebaut Abinauten 42, Steffi 37, Dart Devils 33, Landwirt
// 21. Luigi am 2. Okt.: 58 = "Placken", 33-39 gut. Ueber 45 wird ein Textil-Design nicht mehr vorgezeigt.
// Gemessen wird nur, was gerade auf der Platte liegt - ein Holen von Drive schriebe alle Druckdateien
// zurueck (446 x rund 30 MB) auf ein Volume mit 1 GB frei. Was im Band laeuft, liegt fuer seine Mockups ohnehin da.
// 6. Okt.: die Linien im Band (Herstellerfotos) und was darunter steht - "Roly Stafford · Ottos Starter".
const BAND_LINIEN = ['bc', 'ss', 'roly'];
const LINIE_MARKE = { bc: 'bc', ss: 'stanleystella', roly: 'roly' }, LINIE_STUFE = { bc: 'liebling', ss: 'deluxe', roly: 'starter' };
function linieBeschriftung(linie, garment) {
  const e = TEXTIL_LINIE.find(a => a.id === linie + '-' + garment && a.marke === LINIE_MARKE[linie]);
  const m = TEXTIL_MARKEN[LINIE_MARKE[linie]];
  return e && m ? { text: m.name + ' ' + e.name + ' · ' + m.stufe, stufe: LINIE_STUFE[linie] } : null;
}
const FARB_HEX = Object.fromEntries(Object.entries(TEXTIL_FARBEN).map(([k, f]) => [k, f.hex]));
// Gemessen wird auch auf Weiss und Schwarz (zeigbar in brett.js) - besteFarbe waehlt nur aus FARB_HEX.
const MESS_HEX = { weiss: '#FFFFFF', schwarz: '#111111', natur: '#EFE6D2', ...FARB_HEX };
// Stoff-Schluessel fuer zeigbar(): eingefaerbt die Farbe, sonst Weiss oder Schwarz.
const stoffVon = (color, farbe, g) => farbe || (color === 'white' ? (g === 'beutel' ? 'natur' : 'weiss') : 'schwarz');
// Farbige Textilien im Band und automatisch im Schaufenster: aus (siehe Band).
const BAND_FARBIG = false;
// 5. Okt. abends, Markus (Motorrad-Aquarell auf weissem Hoodie): "definitiv nicht fuer weiss ... schreib das bitte auch rein
// das weiss auf weiss verboten ist". Aquarell laeuft weich ins Papierweiss aus (und DTF druckt nur 0 oder 100 % Deckung) -
// die Messung sieht das nicht (8 % weiche Kante wie gute Designs). Angezeigt wird Aquarell darum nie auf Weiss oder Natur.
const NIE_AUF_HELL = ['aquarell'];
const zeigbarAuf = (e, stoff) => !!e && zeigbar(e.farbMessung, stoff) && !((stoff === 'weiss' || stoff === 'natur') && NIE_AUF_HELL.includes(e.style));
// Bestellbare Farben eines Designs fuer ein Teil: gemessen an der Druckdatei (wie im Band), hoechstens vier, die passendste
// zuerst. Die Vorlage des Teils (Linie B&C, sachliche Ansicht) muss sich sauber einfaerben lassen, sonst gar keine Farbe.
async function bestellFarben(designId, g) {
  try {
    const tpl = LINIE_STANDARD + '-' + g;
    if (!(await faerbMaske(path.join(STORE, 'templates'), tpl))) return [];
    const messung = await farbWerte(await masterLesen(designId), FARB_HEX);
    return (besteFarbe(messung, FARB_HEX, undefined, { frei: true }) || []).filter(k => TEXTIL_FARBEN[k] && TEXTIL_FARBEN[k].name[g]);   // nur Farben, die es fuer dieses Teil gibt   // der Kunde waehlt frei (5. Okt.), Band und Schaufenster bleiben streng
  } catch (e) { console.error('Bestell-Farben ' + designId + ' ' + g + ':', e && e.message ? e.message : e); return []; }
}
async function plackenNachtragen() {
  let neu = 0, vonDrive = 0;
  try {
    const sc = await loadShowcase();
    for (const [id, e] of Object.entries(sc)) {
      // 4. Okt.: im selben Gang die Farbmessung (brett.js farbWerte) - welche Textilfarbe das Design traegt.
      if (!e || !e.approved || (typeof e.placken === 'number' && e.farbMessung && e.farbMessung.v === MESS_STAND)) continue;
      let buf;
      try { buf = await fs.readFile(path.join(STORE, 'masters', `${id}_PRINT_MASTER.png`)); }
      catch (err) {
        // 5. Okt.: nach der neuen Messung (MESS_STAND 2) stand das Band leer - fast alle Druckdateien sind auf Drive ausgelagert
        // und wurden nie gemessen. Jetzt holt die Messung sie von Drive, NUR in den Speicher (nichts auf die Platte, die hat
        // wenig frei), hoechstens 150 je Lauf.
        if (vonDrive >= 150) continue;
        try { const j = await readJob(id); const g = await drive.fetchFile([(j && j.motto) || 'sonstige', id], `${id}_PRINT_MASTER.png`); buf = g && g.buffer && g.buffer.length ? g.buffer : null; }
        catch (e2) { buf = null; }
        vonDrive++;
        if (!buf) continue;
      }
      try { buf = await kleinFassung(buf); } catch (e4) { /* dann eben gross */ }
      if (typeof e.placken !== 'number') {
        try { e.placken = await vollDeckend(buf); neu++; }
        catch (err) { console.error('Placken-Messung ' + id + ':', err && err.message ? err.message : err); e.placken = -1; }
        if (e.placken > PLACKEN_GRENZE) console.log('Brett: ' + id + ' ' + e.placken + ' % voll deckend - wird nicht mehr vorgezeigt');
      }
      if (!e.farbMessung || e.farbMessung.v !== MESS_STAND) {
        try { e.farbMessung = await farbWerte(buf, MESS_HEX); neu++; }
        catch (err) { console.error('Farb-Messung ' + id + ':', err && err.message ? err.message : err); e.farbMessung = { werte: {}, ton: null }; }
      }
      if (neu && neu % 10 === 0) { try { await saveShowcase(); } catch (e3) { /* am Ende noch einmal */ } }
    }
    if (neu) await saveShowcase();
    if (neu || vonDrive) console.log('Farb-Messung: ' + neu + ' Werte neu, ' + vonDrive + ' Druckdateien von Drive gelesen (nur im Speicher)');
  } catch (err) { console.error('Placken-Messung gescheitert:', err && err.message ? err.message : err); }
  return neu;
}
function istBrett(e) { return !!e && typeof e.placken === 'number' && e.placken > PLACKEN_GRENZE; }
if (!process.env.ABNAHME) {
  setTimeout(() => { plackenNachtragen().finally(() => setInterval(plackenNachtragen, 10 * 60e3)); }, 100e3);
}
function showcaseImage(id, textile) {
  const exp = Date.now() + 7 * 86400e3;
  const sig = signPreview(id, exp, SIGN_SECRET);
  const color = istHell(textile) ? 'white' : 'black';
  return `${env.PUBLIC_BASE_URL}/api/mo/mockup/${id}/tee/${color}.jpg?exp=${exp}&sig=${sig}`;
}
// 6. Okt., Markus: "Du hast mir eine Auswahl zum Freigeben gegeben, die nicht dem entspricht, was wir abgesprochen haben -
// verschiedene Artikel, verschiedene Groessen, verschiedene Stile, Hoodies, T-Shirts, Strandtuecher, mal von vorne, mal von
// hinten." Freigegeben wird darum das BILD, das im Band laeuft: Design + Teil + Seite + Linie (oder Szene). sc[id].bandBild.
function bandBildPruefen(b) {
  if (!b || typeof b !== 'object' || !GARMENTS[String(b.teil || '')]) return null;
  const linie = BAND_LINIEN.includes(b.linie) ? b.linie : '';
  // Farbig (6. Okt.: Rot, Orange, Creme): eingefaerbt aus der weissen Vorlage, nur wo es die Farbe fuer das Teil gibt; ohne Linie und ohne Szene.
  const farbe = TEXTIL_FARBEN[b.farbe] && TEXTIL_FARBEN[b.farbe].name[String(b.teil)] && FARB_TEILE.includes(String(b.teil)) ? String(b.farbe) : '';
  return { teil: String(b.teil), color: farbe ? 'white' : b.color === 'black' ? 'black' : 'white', seite: b.seite === 'back' && !farbe ? 'back' : '', szene: !!b.szene && !linie && !farbe, linie: farbe ? '' : linie, farbe };
}
// Saubere Fassung fuer Schaufenster und Band (9. Okt.): eigene Unterschrift, damit nicht jede Vorschau-Adresse
// durch Anhaengen von ?rein= ihr Wasserzeichen verliert.
function reinSig(id, exp) { return signPreview(String(id) + ':rein', exp, SIGN_SECRET); }
function reinAdr(url) {
  const m = String(url || '').match(/\/api\/mo\/mockup\/([A-Za-z0-9_-]+)\/[^?]*\?(?:.*&)?exp=(\d+)/);
  return m && !/[?&]rein=/.test(url) ? url + '&rein=' + reinSig(m[1], m[2]) : url;
}
// Die saubere Fassung nur zeigen, wenn sie fertig daliegt (Band und Schaufenster liefern nie ein Bild aus, auf das der
// Browser warten muesste) - sonst wird sie im Hintergrund gebaut und bis dahin laeuft das bisherige Bild.
async function reinWennDa(url) {
  const m = String(url || '').match(/\/api\/mo\/mockup\/([A-Za-z0-9_-]+)\/([a-z0-9-]+)\/([a-z]+)\.jpg\?(.*)$/);
  if (!m) return url;
  try {
    const q = Object.fromEntries(new URLSearchParams(m[4]));
    const side = q.side === 'back' ? 'back' : q.side === 'chest' ? 'chest' : '';
    const { cached } = await mockupPlan(m[1], m[2], m[3], await readJob(m[1]), { ...q, side });
    const ziel = cached.replace(/\.jpg$/i, '_rein.jpg');
    for (const end of ['.jpg', '.avif', '.webp']) { try { await fs.access(ziel.replace(/\.jpg$/i, end)); return reinAdr(url); } catch (e) { /* weiter */ } }
    mockupNachbauen((String(url).startsWith('/') ? env.PUBLIC_BASE_URL : '') + reinAdr(url));
  } catch (e) { console.error('Saubere Fassung ' + m[1] + ': ' + e.message); }
  return url;
}
function bandBildUrl(id, b) {
  const exp = Date.now() + 7 * 86400e3, sig = signPreview(id, exp, SIGN_SECRET);
  return `${env.PUBLIC_BASE_URL}/api/mo/mockup/${id}/${b.teil}/${b.color}.jpg?exp=${exp}&sig=${sig}` + (b.szene ? '&szene=1' : '') + (b.seite ? '&side=back' : '') + (b.linie ? '&linie=' + b.linie : '') + (b.farbe ? '&farbe=' + b.farbe : '');
}

// Automatische Stil-Galerie, wenn kein kuratiertes Manifest da ist: zeigt echte, bereits erzeugte
// Designs dieses Mottos (aus dem Bewertungs-Pool) - je Stil eines. So erscheinen bei neuen Mottos
// sofort Beispielbilder, ohne dass jemand IDs pflegen muss.
// ---------- 21. Sept.: Stil-Kacheln als Schrift im eigenen Stil ----------
// Markus (23:58): "Die Stile sollten wir nicht als Textil zeigen, sondern als Schrift des Stils -
// Neon als Neon im Neon-Stil, die ganze Kachel in Neon. Bei allen Stilen." Die Kacheln liegen im
// Repo (stile/kacheln/<stil>.jpg, je eine je Stil, erzeugt am 21. Sept.); ein Motto mit festem
// Artikel (Postkarte) behaelt seine Beispiele (Paris-Karten). "Du brauchst nicht die
// Motto-Variante in jedem Stil machen."
// 21. Sept., 08:15, Markus: "Warum ist das nicht umgesetzt, dass die Kacheln fuer die Mottos
// keine Textilien, sondern einfach das Motto cool in die Kachel bringen?" Je Motto eine
// gestaltete Schrift-Kachel im Repo (mottos/kacheln/<slug>.jpg, 800 px); die Startseite zeigt
// sie statt des Shirt-Mockups. Fehlt eine, bleibt es beim Mockup - nie eine leere Kachel.
const MOTTO_KACHELN_DIR = path.resolve('mottos', 'kacheln');
let mottoKachelnCache = null;
async function mottoKacheln() {
  if (mottoKachelnCache) return mottoKachelnCache;
  const out = {};
  try {
    for (const f of await fs.readdir(MOTTO_KACHELN_DIR)) {
      if (!f.endsWith('.jpg')) continue;
      const st = await fs.stat(path.join(MOTTO_KACHELN_DIR, f));
      out[f.replace(/\.jpg$/, '')] = `/api/mo/motto-kachel/${f}?v=${Math.round(st.mtimeMs / 1000).toString(36)}`;
    }
  } catch (e) { console.error('Motto-Kacheln:', e && e.message ? e.message : e); }
  mottoKachelnCache = out;
  return out;
}
app.get('/api/mo/motto-kachel/:file', async (req, res) => {
  const f = String(req.params.file).replace(/\.jpg$/i, '').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  res.set('cache-control', 'public, max-age=604800');
  res.sendFile(path.join(MOTTO_KACHELN_DIR, f + '.jpg'), (err) => { if (err && !res.headersSent) res.status(404).end(); });
});
// 21. Sept.: die unbedruckte Vorlage eines Teils, oeffentlich (Produktfotos, nichts Geheimes).
// Gebraucht, um aus dem Foto die Maske der bedruckbaren Flaeche zu machen (Bildmodell malt sie
// magenta - dafuer muss es das Bild unter einer Adresse holen koennen), und zum Nachsehen.
app.get('/api/mo/vorlage/:file', async (req, res) => {
  const f = String(req.params.file).replace(/\.png$/i, '').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
  const key = f.replace(/_(black|white)$/, '');
  if (!GARMENTS[key.replace(/-(szene|quer|quer-szene)$/, '')]) return res.status(404).end();
  res.set('cache-control', 'public, max-age=3600');
  res.sendFile(path.join(STORE, 'templates', f + '.png'), (err) => { if (err && !res.headersSent) res.status(404).end(); });
});
const STIL_KACHELN_DIR = path.resolve('stile', 'kacheln');
let stilKachelnCache = null;
async function stilKacheln() {
  if (stilKachelnCache) return stilKachelnCache;
  const out = {};
  try {
    for (const f of await fs.readdir(STIL_KACHELN_DIR)) {
      if (!f.endsWith('.jpg')) continue;
      const st = await fs.stat(path.join(STIL_KACHELN_DIR, f));
      out[f.replace(/\.jpg$/, '')] = `/api/mo/stil-kachel/${f}?v=${Math.round(st.mtimeMs / 1000).toString(36)}`;
    }
  } catch (e) { console.error('Stil-Kacheln:', e && e.message ? e.message : e); }
  stilKachelnCache = out;
  return out;
}
app.get('/api/mo/stil-kachel/:file', async (req, res) => {
  const f = String(req.params.file).replace(/\.jpg$/i, '').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  res.set('cache-control', 'public, max-age=604800');
  res.sendFile(path.join(STIL_KACHELN_DIR, f + '.jpg'), (err) => { if (err && !res.headersSent) res.status(404).end(); });
});
// 22. Sept., Markus: "Warum muss ich dich auf solche Fehler immer wieder hinweisen?"
// Weil ein gruener Commit nichts darueber sagt, was auf dem Volume liegt. Das Posterfoto war im
// Repo seit 11:18 neu und live weiter das alte - unsichtbar von aussen. Diese Auskunft macht es
// sichtbar: was das Repo will, was wirklich daliegt, und was zurueckhaengt. Keine Geheimnisse,
// nur Versionsnummern von Vorlagen - darum ohne Anmeldung, damit die Abnahme sie lesen kann.
app.get('/api/mo/vorlagen-stand', async (req, res) => {
  try { res.json(await vorlagenStand(STORE)); }
  catch (e) { res.status(500).json({ error: e && e.message ? e.message : String(e) }); }
});
async function autoStyleSamples(slug) {
  const out = {};
  try {
    const sc = await loadShowcase();
    const alle = Object.entries(sc).filter(([, e]) => e && e.approved);
    // Fassung 74 (Markus, 17. Sept.: "Bei den Stilen steht nur drauf, was ist das?"): Bisher wurde
    // nur im EIGENEN Motto gesucht - ein Motto ohne Galerie-Design zeigte darum blanke Knoepfe.
    // Ein Stil sieht aber auf jedem Motto gleich aus. Also: eigene Designs zuerst, danach alle
    // anderen. So ist die Stilwahl ueberall bebildert, sobald es irgendwo ein Beispiel gibt.
    const eigene = alle.filter(([, e]) => e.motto === slug).reverse();
    const fremde = alle.filter(([, e]) => e.motto !== slug).reverse();
    for (const [id, e] of eigene.concat(fremde).slice(0, 150)) {
      const j = await readJob(id);
      const style = (j && j.style) || 'standard';
      if (!out[style]) out[style] = showcaseImage(id, anzeigeTextil(e, j && j.textile));
      if (Object.keys(out).length >= STYLE_KEYS.length) break;
    }
  } catch (e) { /* Galerie ist optional */ }
  return out;
}

// Fassung 68 (Markus, 16. Sept.: "Bei den Figuren auch die Figuren zeigen"): Beispielbild je
// Figurenart, genau wie beim Stil aus den freigegebenen Designs. Gesucht wird ueber ALLE Mottos,
// nicht nur das aktuelle: die Figurenart sieht auf jedem Motto gleich aus, und so ist die Auswahl
// auch bei einem neuen Motto bebildert. Fehlt eine Art, zeichnet die Seite ihre Miniatur.
async function autoFigurenSamples(slug) {
  const out = {};
  try {
    const sc = await loadShowcase();
    const alle = Object.entries(sc).filter(([, e]) => e && e.approved);
    // Erst Designs dieses Mottos, dann der Rest - das eigene Motto sieht vertrauter aus.
    const eigene = alle.filter(([, e]) => e.motto === slug).reverse();
    const fremde = alle.filter(([, e]) => e.motto !== slug).reverse();
    for (const [id, e] of eigene.concat(fremde).slice(0, 120)) {
      const j = await readJob(id);
      const fig = j && j.input && j.input.figuren;
      if (!fig || fig === 'standard' || out[fig]) continue;
      out[fig] = showcaseImage(id, anzeigeTextil(e, j && j.textile));
      if (Object.keys(out).length >= FIGUREN_KEYS.length) break;
    }
  } catch (e) { /* Galerie ist optional - dann zeichnet die Seite die Miniaturen */ }
  return out;
}

// ---------- Der Kunde entscheidet ueber SEIN Design ----------
// Es ist sein Entwurf. Ob fremde Leute ihn in der Community-Bewertung zu sehen bekommen,
// soll er selbst bestimmen koennen - in beide Richtungen: raus aus dem Pool, oder rein,
// obwohl die Automatik ihn draussen gelassen haette (dann ausdruecklich und bewusst).
async function meinDesign(req, res, id) {
  const who = await identify(req, res);
  return !!((who.user && who.user.designs.includes(id)) || (who.guest && who.guest.designs.includes(id)));
}

// Lage eines Designs: darf es automatisch in den Pool, was hat der Kunde gewaehlt, ist es drin?
async function bewertungsLage(id) {
  const j = await readJob(id);
  if (!j) return null;
  const sperre = await bewertungSperrgrundFuer(j);
  const sc = await loadShowcase();
  const e = sc[id];
  const wartet = needsApproval({ slug: j.motto }) && (await approvalStatus(id)) !== 'approved';
  return {
    job: j, sperre, wartet,
    freigegeben: !!(e && e.approved),
    // null = der Kunde hat sich nie geaeussert, es gilt die Automatik
    wunsch: e && typeof e.kundenwunsch === 'boolean' ? e.kundenwunsch : null
  };
}

app.get('/api/mo/showcase/wunsch', async (req, res) => {
  const id = String(req.query.designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!await meinDesign(req, res, id)) return res.status(403).json({ error: 'nicht dein Design' });
  const l = await bewertungsLage(id);
  if (!l) return res.status(404).json({ error: 'unbekanntes Design' });
  res.json({ freigegeben: l.freigegeben, wunsch: l.wunsch, sperre: l.sperre, wartet: l.wartet });
});

app.post('/api/mo/showcase/wunsch', async (req, res) => {
  const id = String((req.body || {}).designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!await meinDesign(req, res, id)) return res.status(403).json({ error: 'nicht dein Design' });
  const l = await bewertungsLage(id);
  if (!l) return res.status(404).json({ error: 'unbekanntes Design' });
  const frei = !!(req.body || {}).freigeben;
  const j = l.job;
  const sc = await loadShowcase();
  // Auch ein "nein" bekommt einen Eintrag: nur so bleibt der Wunsch gespeichert und keine
  // spaetere Automatik (z. B. die Fanclub-Freigabe) schiebt das Design doch noch in den Pool.
  const e = sc[id] || {
    count: 0, sum: 0, motto: j.motto || '', mottoText: mottoTextAus(j.values, { name: j.motto }),
    textile: j.textile || 'dunkel', created: j.created || new Date().toISOString(), style: j.style || 'standard'
  };
  e.kundenwunsch = frei;
  e.auto = false; // ab jetzt hat ein Mensch entschieden, nicht die Regel
  // Fanclub: erst nach unserem Nachweis-Check sichtbar, auch wenn der Kunde schon zugestimmt hat.
  e.approved = frei && !l.wartet;
  sc[id] = e;
  await saveShowcase();
  console.log('Bewertungs-Wunsch:', id, frei ? 'freigegeben' : 'gesperrt', l.sperre ? '(Automatik haette gesperrt: ' + l.sperre + ')' : '');
  res.json({ ok: true, freigegeben: !!e.approved, wunsch: frei, wartet: l.wartet });
});

// Freigeben/Sperren (Chef, Master-Token wie /druck)
app.post('/api/mo/showcase/approve', async (req, res) => {
  if (!chefGuard(req, res)) return;
  const id = String((req.body || {}).designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const approved = !!(req.body || {}).approved;
  const j = await readJob(id);
  if (!j) return res.status(404).json({ error: 'unbekanntes Design' });
  const sc = await loadShowcase();
  const e = sc[id] || { count: 0, sum: 0 };
  // Hat der Kunde selbst "nein" gesagt, wird das nicht per Knopf im Backend ueberstimmt.
  // Sperren darf der Chef immer - nur das Veroeffentlichen gegen den Willen des Kunden nicht.
  if (approved && e.kundenwunsch === false) {
    return res.status(409).json({ error: 'kundenwunsch', hinweis: 'Der Kunde hat dieses Design ausdrücklich nicht für die Bewertung freigegeben.' });
  }
  e.approved = approved;
  e.motto = j.motto || '';
  e.mottoText = (j.values && j.values.motto) || j.motto || '';
  e.textile = j.textile || 'dunkel';
  e.created = j.created || new Date().toISOString();
  sc[id] = e;
  await saveShowcase();
  res.json({ ok: true, approved });
});

// ---------- Logo feinjustieren: exakt, ohne KI ----------
// "Logo 1 cm nach oben, alles andere so lassen" ist keine KI-Aufgabe. Das Logo setzt
// unser eigener Code auf das Motiv - es zu verschieben ist eine Rechnung, nicht eine
// Bitte an ein Orakel: exakt, in Sekunden, kostenlos und jedes Mal gleich. Genau das
// braucht es fuer Trikots, wo Nummer, Name und Sponsor sitzen muessen.
//
// Voraussetzung ist das aufbewahrte Motiv ohne Logo (storage/art/). Designs von vor
// dieser Aenderung haben es nicht - die muessen einmal neu erzeugt werden.
app.post('/api/mo/druck/fein', async (req, res) => {
  if (!masterGuard(req, res)) return;
  const b = req.body || {};
  const designId = String(b.designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const j = await readJob(designId);
  if (!j) return res.status(404).json({ error: 'unbekanntes Design' });
  const motto = await mottos.get(j.motto);
  if (!motto || motto.upload.mode !== 'exact' || !j.upload) {
    return res.status(400).json({ error: 'kein logo', hinweis: 'Dieses Design hat kein eingesetztes Logo – da gibt es nichts zu verschieben.' });
  }
  let art;
  try { art = await fs.readFile(path.join(STORE, 'art', `${designId}_ART.png`)); }
  catch (e) {
    return res.status(409).json({ error: 'kein motiv', hinweis: 'Für dieses Design wurde das Motiv ohne Logo nicht aufbewahrt (vor dem Umbau erzeugt). Einmal neu erzeugen, dann geht es.' });
  }
  // Grenzen mit Sinn: mehr als die halbe Druckflaeche zu verschieben ergibt keinen Fall,
  // und eine Zahl ohne Grenze ist eine Einladung fuer einen Tippfehler.
  const cm = (v) => Math.min(Math.max(+v || 0, -18), 18);
  const fein = { dxCm: cm(b.dxCm), dyCm: cm(b.dyCm), groesse: Math.min(Math.max(+b.groesse || 1, 0.25), 3) };
  try {
    const logo = await fs.readFile(path.join(STORE, 'uploads', j.upload));
    let logoFertig = logo;
    if (j.upload2 && motto.upload.coBrand) {
      try { logoFertig = await combineLogos(logo, await fs.readFile(path.join(STORE, 'uploads', j.upload2))); } catch (e) { /* dann eben einzeln */ }
    }
    const bericht = {};
    const neu = await mitBildarbeit('Feinjustierung ' + designId, () => makeMaster(art, {
      schonFrei: true, targetWidth: env.MASTER_WIDTH,
      logo: logoFertig, logoTreffer: j.logoTreffer || null, place: motto.upload.place, widthPct: j.logoPct || motto.upload.widthPct, fein, bericht,
      ...schwarzOpts(j.input)
    }));
    // Wurde die Groesse von der Druckflaeche begrenzt, den gespeicherten Wert daran
    // anpassen. Sonst steht dort 3x, waehrend 1,5x gedruckt wird - und der naechste
    // Klick auf "groesser" tut sichtbar nichts.
    if (bericht.begrenzt && bericht.faktorEcht) {
      fein.groesse = Math.round(fein.groesse * bericht.faktorEcht * 100) / 100;
      fein.begrenzt = true;
    }
    // 6. Okt., Markus: "Kunden-Dateien duerfen ohne meine Zustimmung nicht ueberschrieben werden." Vor der ersten Feinjustierung
    // bleibt das Original als <nr>_PRINT_MASTER.original.png liegen - nichts geht verloren, alles laesst sich zuruecknehmen.
    { const orig = path.join(STORE, 'masters', `${designId}_PRINT_MASTER.original.png`);
      try { await fs.access(orig); } catch (e) { try { await fs.copyFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`), orig); } catch (e2) { const alt = await masterHolen(designId); if (alt) await fs.writeFile(orig, alt); } } }
    await fs.writeFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`), neu);
    await fs.writeFile(path.join(STORE, 'previews', `${designId}.png`), await makePreview(neu));
    // Alles Abgeleitete wegwerfen - sonst zeigen Mockups und Namensvarianten weiter das
    // alte Logo an der alten Stelle, und niemand versteht, warum sich nichts aendert.
    let weg = 0;
    try {
      for (const f of await fs.readdir(path.join(STORE, 'mockups'))) {
        if (f.includes(designId)) { await fs.rm(path.join(STORE, 'mockups', f), { force: true }); weg++; }
      }
    } catch (e) { /* kein Cache */ }
    try { await fs.rm(path.join(STORE, 'vectors', `${designId}.svg`), { force: true }); } catch (e) { /* egal */ }
    // Der Befund gehoert neu gemessen: es ist eine andere Datei als vorher.
    const befund = await pruefeDruckdatei(neu);
    j.fein = fein; j.druck = befund;
    await fs.writeFile(path.join(STORE, 'jobs', `${designId}.json`), JSON.stringify(j, null, 2));
    console.log('Feinjustierung:', designId, `dx ${fein.dxCm} cm, dy ${fein.dyCm} cm, Groesse ${fein.groesse}x ·`, weg, 'abgeleitete Dateien verworfen');
    res.json({ ok: true, fein, druck: befund });
  } catch (e) {
    console.error('Feinjustierung gescheitert:', designId, e && e.message ? e.message : e);
    res.status(500).json({ error: 'fehlgeschlagen', hinweis: String(e && e.message ? e.message : e).slice(0, 200) });
  }
});

// Design KOMPLETT loeschen: aus der Bewertung nehmen, alle Dateien entfernen, vom Besitzer
// abkoppeln, aus Google Drive nehmen - und die Nummer in die Geloescht-Liste eintragen.
// Der Eintrag ist der eigentliche Punkt: ohne ihn holte der naechste Zugriff die Druckdatei
// von Drive zurueck und das Design stand wieder in der Liste. "Geloescht" heisst ab jetzt
// geloescht, auch wenn irgendwo noch eine Kopie liegt.
async function designWirklichLoeschen(id, grund) {
  const removed = [];
  // 1) Zuerst der Grabstein - er gilt auch dann, wenn weiter unten etwas schiefgeht
  await geloeschtMerken(id, grund);
  // 2) Aus dem Bewertungs-Pool nehmen
  try { const sc = await loadShowcase(); if (sc[id]) { delete sc[id]; await saveShowcase(); removed.push('showcase'); } } catch (e) { /* egal */ }
  // 3) Vom Besitzer abkoppeln (falls angemeldeter Kunde)
  try {
    const j = await readJob(id);
    if (j && j.user) { const u = await accounts.byId(j.user); if (u && Array.isArray(u.designs) && u.designs.includes(id)) { u.designs = u.designs.filter(d => d !== id); await accounts.save(u); removed.push('konto'); } }
  } catch (e) { /* egal */ }
  // 4) Alle Dateien loeschen (Vorschau, Master, Rueckseite, Vektor, Job, Strichzeichnung, Mockups)
  const rm = async (p) => { try { await fs.rm(p, { force: true }); removed.push(path.basename(p)); } catch (e) { /* egal */ } };
  await rm(path.join(STORE, 'previews', `${id}.png`));
  await rm(path.join(STORE, 'previews', `${id}_back.png`));
  await rm(path.join(STORE, 'masters', `${id}_PRINT_MASTER.png`));
  await rm(path.join(STORE, 'masters', `${id}_BACK_MASTER.png`));
  await rm(path.join(STORE, 'vectors', `${id}.svg`));
  await rm(path.join(STORE, 'jobs', `${id}.json`));
  // Das freigestellte Motiv fuer "Logo verschieben" - das wurde bisher vergessen und blieb liegen.
  await rm(path.join(STORE, 'art', `${id}_ART.png`));
  try { for (const f of await fs.readdir(path.join(STORE, 'mockups'))) if (f.startsWith(`named_${id}_`) || f.startsWith(`namedprev_${id}_`) || f.startsWith(`back_${id}`) || f.startsWith(`backprev_${id}`) || f.startsWith(`chest_${id}_`) || f.startsWith(`chestprev_${id}_`) || f.startsWith(`${id}_`) || f.startsWith(`${id}.`)) await rm(path.join(STORE, 'mockups', f)); } catch (e) { /* egal */ }
  // 5) Den gesicherten Auftrag mitnehmen. Ohne das wird er nach einem Neustart wieder
  //    eingelesen - und ein wartender Auftrag baut das Design sogar neu.
  try {
    for (const f of await fs.readdir(QUEUE_DIR)) {
      if (!f.endsWith('.json')) continue;
      let jb = null;
      try { jb = JSON.parse(await fs.readFile(path.join(QUEUE_DIR, f), 'utf8')); } catch (e) { continue; }
      if (jb && jb.designId === id) await rm(path.join(QUEUE_DIR, f));
    }
  } catch (e) { /* egal */ }
  // 6) Aus Google Drive entfernen (Design-Ordner in den Papierkorb legen)
  try { const dr = await drive.removeFolderByName(id); if (dr && dr.trashed) removed.push('drive'); } catch (e) { console.error('Drive-Loeschen:', e && e.message ? e.message : e); }
  // 7) Laufende/gemerkte Auftraege im Speicher markieren und aus der Liste nehmen
  if (jobs) for (const [k, jb] of [...jobs.entries()]) if (jb && jb.designId === id) { jb.deleted = true; jobs.delete(k); }
  console.log('Design geloescht:', id, '·', removed.join(', ') || 'nichts gefunden');
  return removed;
}

app.post('/api/mo/design/delete', async (req, res) => {
  if (!chefGuard(req, res)) return;
  const id = String((req.body || {}).designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) return res.status(400).json({ error: 'designId fehlt' });
  const removed = await designWirklichLoeschen(id, 'einzeln');
  res.json({ ok: true, designId: id, removed });
});

// Doppelte wegraeumen. Der Watchdog-Fehler von heute Mittag hat reihenweise Zwillinge
// erzeugt: derselbe Auftrag lief mehrfach, weil der Kunde nichts sah und es noch einmal
// versuchte. Die von Hand einzeln wegzuklicken ist Arbeit ohne Gegenwert - und man loescht
// dabei leicht das falsche. Darum: gleiche Eingabe = gleiche Gruppe, das NEUESTE bleibt.
app.post('/api/mo/design/doppelte', async (req, res) => {
  if (!chefGuard(req, res)) return;
  const nurZeigen = (req.body || {}).wirklich !== true;
  const gruppen = await doppelteFinden();
  const weg = [];
  for (const g of gruppen) for (const alt of g.alt) weg.push({ designId: alt.designId, bleibt: g.neu.designId, motto: alt.motto, zeit: alt.zeit });
  if (nurZeigen) {
    // Nach Motto zusammengefasst: eine Zahl je Motto sagt mehr als 384 Nummern.
    const proMotto = {}, bleibt = {};
    for (const w of weg) proMotto[w.motto] = (proMotto[w.motto] || 0) + 1;
    for (const g of gruppen) bleibt[g.neu.motto] = (bleibt[g.neu.motto] || 0) + 1;
    return res.json({
      ok: true, vorschau: true, gruppen: gruppen.length, loeschen: weg.length,
      proMotto: Object.entries(proMotto).sort((a, b) => b[1] - a[1]).map(([motto, n]) => ({ motto, n, bleibt: bleibt[motto] || 0 })),
      liste: weg.slice(0, 50)
    });
  }
  for (const w of weg) await designWirklichLoeschen(w.designId, 'doppelt');
  res.json({ ok: true, geloescht: weg.length, gruppen: gruppen.length });
});

// Verwaiste Galerie-Designs wegraeumen. Die Stil-Galerie legt ihre Beispiele als ECHTE
// Designs an (Druckdatei, Vorschau, Auftragsdatei) - deshalb stehen sie mit in der
// Druckliste. Solange je Motto und Stil genau eines aktuell ist, ist das harmlos. Durch den
// Fehler in autoImport (siehe vorzeige.js) wurde bei einem gesperrten Motto aber bei JEDEM
// Serverstart ein kompletter neuer Satz angelegt, und die alten blieben als Karteileichen
// liegen. Angefasst wird nur, was via 'vorzeige' angelegt wurde UND in keiner
// Galerie-Datei mehr steht - das aktuell benutzte Beispiel bleibt immer stehen.
app.post('/api/mo/design/galerie-reste', async (req, res) => {
  if (!chefGuard(req, res)) return;
  const nurZeigen = (req.body || {}).wirklich !== true;
  const inBenutzung = new Set();
  for (const m of await mottos.all()) {
    const roh = await vorzeige.readRoh(m.slug);
    for (const id of Object.values(roh || {})) if (id) inBenutzung.add(String(id));
  }
  let files = [];
  try { files = (await fs.readdir(path.join(STORE, 'masters'))).filter(f => f.endsWith('_PRINT_MASTER.png')); } catch (e) { /* leer */ }
  const tot = await geloeschtLaden();
  const ids = [];
  const proMotto = {};
  for (const f of files) {
    const id = f.replace('_PRINT_MASTER.png', '');
    if (tot[id] || inBenutzung.has(id)) continue;
    const j = await readJob(id);
    if (!j || !(j.vorzeige || j.via === 'vorzeige')) continue;
    ids.push(id);
    proMotto[j.motto || '?'] = (proMotto[j.motto || '?'] || 0) + 1;
  }
  if (nurZeigen) return res.json({
    ok: true, vorschau: true, loeschen: ids.length, inBenutzung: inBenutzung.size,
    proMotto: Object.entries(proMotto).sort((a, b) => b[1] - a[1]).map(([motto, n]) => ({ motto, n, bleibt: 0 })),
    liste: ids.slice(0, 50)
  });
  for (const id of ids) await designWirklichLoeschen(id, 'galerie-rest');
  res.json({ ok: true, geloescht: ids.length });
});

// Alle Pruefstand-Laeufe wegraeumen. Nach einem grossen Durchlauf liegen hunderte
// Testdesigns zwischen der echten Kundenarbeit - die einzeln wegzuklicken ist keine
// zumutbare Aufgabe. Angefasst wird ausschliesslich, was in der eigenen Datei test:true
// stehen hat; ein Kundendesign kann hier gar nicht hineingeraten.
app.post('/api/mo/design/pruefstand-weg', async (req, res) => {
  if (!chefGuard(req, res)) return;
  const nurZeigen = (req.body || {}).wirklich !== true;
  let files = [];
  try { files = (await fs.readdir(path.join(STORE, 'masters'))).filter(f => f.endsWith('_PRINT_MASTER.png')); } catch (e) { /* leer */ }
  const tot = await geloeschtLaden();
  const ids = [];
  for (const f of files) {
    const id = f.replace('_PRINT_MASTER.png', '');
    if (tot[id]) continue;
    const j = await readJob(id);
    if (j && j.test) ids.push(id);
  }
  if (nurZeigen) return res.json({ ok: true, vorschau: true, loeschen: ids.length, liste: ids.slice(0, 50) });
  for (const id of ids) await designWirklichLoeschen(id, 'pruefstand');
  // Die Pruefstand-Liste im Backend gleich mit aufraeumen: ohne Bild und ohne Befund ist
  // ein Eintrag dort nur noch eine Zeile, die nichts mehr zeigt. Kommentierte Laeufe
  // bleiben - das ist die Mangelliste und die soll den Aufraeumknopf ueberleben.
  try {
    const daten = await pruefLaden();
    for (const [k, e] of Object.entries(daten)) if (e && e.designId && !e.kommentar && ids.includes(e.designId)) delete daten[k];
    await pruefSichern();
  } catch (e) { /* egal */ }
  res.json({ ok: true, geloescht: ids.length });
});

// Gruppen gleicher Designs bilden: gleiches Motto, gleiche Eingaben, gleicher Stil, gleiches
// Textil, gleiche Namen - das ist derselbe Auftrag, nicht zufaellig etwas Aehnliches.
// Verschiedene Stile oder geaenderte Texte sind KEINE Doppelten und bleiben unberuehrt.
//
// Drei Dinge, die hier NICHT passieren duerfen und die ich beinahe uebersehen haette:
// 1. Ein Pruefstand-Lauf benutzt die Beispieldaten des Mottos - also GENAU die Werte, mit
//    denen die Galerie arbeitet und mit denen auch mal ein Kunde arbeitet. Waeren Testlauf
//    und Kundendesign in einer Gruppe, koennte hier ein Kundendesign fliegen und ein
//    Testlauf stehenbleiben. Darum steckt "test" mit im Schluessel: die beiden treffen
//    sich nie in derselben Gruppe.
// 2. Die kuratierten Vorzeige-Designs der Galerie werden nie angefasst.
// 3. Ohne Eingaben kann man Designs nicht sicher auseinanderhalten - solche bleiben liegen.
async function doppelteFinden() {
  const dir = path.join(STORE, 'masters');
  let files = [];
  try { files = (await fs.readdir(dir)).filter(f => f.endsWith('_PRINT_MASTER.png')); } catch (e) { return []; }
  const tot = await geloeschtLaden();
  // Alle Design-Nummern der Galerie einsammeln - die sind tabu.
  const galerie = new Set();
  try {
    for (const m of await mottos.all()) {
      const vz = await vorzeige.read(m.slug);
      for (const id of Object.values(vz || {})) if (id) galerie.add(String(id));
    }
  } catch (e) { console.error('Vorzeige lesen (Doppelte):', e && e.message ? e.message : e); }
  const nach = new Map();
  for (const f of files) {
    const designId = f.replace('_PRINT_MASTER.png', '');
    if (tot[designId] || galerie.has(designId)) continue;
    const j = await readJob(designId);
    if (!j) continue;
    const werte = j.values || {};
    if (!Object.values(werte).filter(Boolean).length) continue;
    const key = JSON.stringify([!!j.test, j.motto || '', werte, j.style || '', j.textile || '', j.aufteilung || '', j.names || []]);
    const zeit = j.created ? Date.parse(j.created) : 0;
    if (!nach.has(key)) nach.set(key, []);
    nach.get(key).push({ designId, zeit, motto: j.motto || '', test: !!j.test });
  }
  const out = [];
  for (const liste of nach.values()) {
    if (liste.length < 2) continue;
    liste.sort((a, b) => b.zeit - a.zeit);
    out.push({ neu: liste[0], alt: liste.slice(1) });
  }
  return out;
}

// Alle Designs eines Mottos aus dem Bewertungs-Pool nehmen (Chef, Master-Token).
// Praktisch, um z. B. alle "fan-shirt"-Entwuerfe auf einen Schlag zu entfernen.
// Vorzeige-Designs (kuratiert, lizenzsicher) in den Bewertungs-Pool aufnehmen, falls noch nicht drin.
// Laeuft nach jedem Import, nach einem Purge und einmal nach dem Start - so ist der Pool nie leer.
async function syncVorzeigeShowcase() {
  let n = 0;
  try {
    const sc = await loadShowcase();
    for (const m of await mottos.all()) {
      const vz = await vorzeige.read(m.slug);
      for (const [style, id] of Object.entries(vz || {})) {
        if (!id || sc[id]) continue;
        // Auch ein kuratiertes Vorzeige-Design bleibt weg, wenn es geloescht wurde -
        // sonst holt es diese Automatik beim naechsten Start still wieder zurueck.
        if (await istGeloescht(id)) continue;
        let j = null;
        try { j = JSON.parse(await fs.readFile(path.join(STORE, 'jobs', `${id}.json`), 'utf8')); } catch (e) { continue; }
        const v = j.values || {};
        sc[id] = {
          approved: true, count: 0, sum: 0, motto: m.slug,
          mottoText: v.spruch || v.motto || v.gruppe || v.crew || v.tiername || v.fanclub || v.stadt || v.babyname || m.name || '',
          // Platz "<stil>@<artikel>" (fuer einen Artikel gezeichnet): im Pool zaehlt der Stil allein
          textile: j.textile || 'dunkel', created: j.created || new Date().toISOString(), auto: true, vorzeige: true, style: String(style).split(/[@#]/)[0]
        };
        n++;
      }
    }
    if (n) await saveShowcase();
  } catch (e) { console.error('Vorzeige -> Pool:', e && e.message ? e.message : e); }
  return n;
}
// ABNAHME=1: der Pruefserver der Abnahme baut keine Druckdateien aus dem Netz - das sind
// hunderte Megabyte Bildarbeit, die die Browser-Pruefung in den Timeout treiben (19. Sept.).
if (!process.env.ABNAHME) setTimeout(() => syncVorzeigeShowcase().then(n => { if (n) console.log('Vorzeige -> Pool:', n, 'aufgenommen'); }), 90000);

// Pool leeren: ein Motto ({ motto }) oder alles ({ all: true }) - danach sofort mit Vorzeige-Designs nachfuellen
app.post('/api/mo/showcase/purge', async (req, res) => {
  if (!chefGuard(req, res)) return;
  const b = req.body || {};
  const motto = String(b.motto || '').trim();
  const all = b.all === true;
  if (!motto && !all) return res.status(400).json({ error: 'motto fehlt' });
  const sc = await loadShowcase();
  let n = 0;
  for (const [id, e] of Object.entries(sc)) { if (e && (all || e.motto === motto)) { delete sc[id]; n++; } }
  if (n) await saveShowcase();
  const nachgefuellt = await syncVorzeigeShowcase();
  console.log('Showcase-Purge:', all ? 'alles' : motto, '·', n, 'entfernt ·', nachgefuellt, 'Vorzeige nachgefuellt');
  res.json({ ok: true, motto: all ? '*' : motto, entfernt: n, nachgefuellt });
});

// Fanclub-Nachweis: Kunde meldet, dass der Vorsitzende bestaetigt hat (optional mit hochgeladenem
// Ausweis-Bild als uploadId). Setzt den Status auf "eingereicht" - Freigabe macht danach der Chef.
// Kundenadresse fuer die Rueckmeldung zur Freigabe: Angabe im Nachweis-Formular, sonst Konto des Design-Besitzers
async function approvalCustomerEmail(entry, job) {
  if (entry && entry.email) return entry.email;
  try { if (job && job.user) { const u = await accounts.byId(job.user); if (u && u.email) return u.email; } } catch (e) { /* egal */ }
  return null;
}

app.post('/api/mo/fanclub-nachweis', async (req, res) => {
  const body = req.body || {};
  const designId = String(body.designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const uploadId = String(body.uploadId || '');
  if (!designId) return res.status(400).json({ error: 'designId fehlt' });
  const j = await readJob(designId);
  if (!j || !needsApproval({ slug: j.motto })) return res.status(404).json({ error: 'kein freigabepflichtiges Design' });
  const ap = await loadApprovals();
  const e = ap[designId] || { motto: j.motto, status: 'pending', fanclub: (j.values && j.values.fanclub) || '', proof: null, at: new Date().toISOString() };
  if (uploadId) { if (!/^up_[a-f0-9]{16}\.png$/.test(uploadId)) return res.status(400).json({ error: 'nachweis ungueltig' }); e.proof = uploadId; }
  // Kundenadresse merken (Formular > angemeldetes Konto > Konto des Design-Besitzers), fuer die Rueckmeldung
  const em = String(body.email || '').trim().toLowerCase();
  if (em && em.length <= 120 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(em)) e.email = em;
  if (!e.email) { try { const who = await identify(req, res); if (who && who.user && who.user.email) e.email = who.user.email; } catch (err) { /* egal */ } }
  if (!e.email) e.email = await approvalCustomerEmail(e, j);
  e.status = 'submitted'; e.submittedAt = new Date().toISOString();
  ap[designId] = e; await saveApprovals();
  // Chef benachrichtigen (nicht blockierend)
  if (env.BREVO_API_KEY) {
    const to = env.ADMIN_EMAIL || env.MAIL_FROM;
    const link = `${String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '')}/admin`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222"><p style="font-size:20px;font-weight:bold">Motto Otto</p>` +
      `<p><b>Neuer Fanclub-Nachweis eingegangen.</b></p>` +
      `<p>Fanclub: ${escHtml(e.fanclub || '–')}<br>Design-Nummer: ${escHtml(designId)}<br>Nachweis: ${e.proof ? 'als Bild hochgeladen' : 'per E-Mail angekündigt'}</p>` +
      `<p><a href="${link}" style="background:#ffc542;color:#1b1710;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;display:inline-block">Im Backend prüfen &amp; freigeben</a></p>` +
      `<p style="color:#999;font-size:12px">Bereich „Fanclub-Freigaben"</p></div>`;
    mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to, subject: `Fanclub-Freigabe: Nachweis für ${e.fanclub || designId}`, html })
      .catch(err => console.error('Fanclub-Mail:', err && err.message ? err.message : err));
  }
  res.json({ ok: true, status: e.status });
});

// Chef: Fanclub-Design freigeben / ablehnen (Master- oder Admin-Token).
app.post('/api/mo/approval/set', async (req, res) => {
  if (!chefGuard(req, res)) return;
  const body = req.body || {};
  const designId = String(body.designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const status = ['approved', 'rejected', 'pending'].includes(body.status) ? body.status : null;
  if (!designId || !status) return res.status(400).json({ error: 'designId/status fehlt' });
  const ap = await loadApprovals();
  const e = ap[designId] || { motto: '', status: 'pending', proof: null, at: new Date().toISOString() };
  e.status = status; e.decidedAt = new Date().toISOString();
  ap[designId] = e; await saveApprovals();
  // Erst mit der Freigabe kommt ein Fanclub-Design in den oeffentlichen Bewertungs-Pool - vorher bewusst nicht
  // (Nachweis ist die Bedingung). Wird die Freigabe zurueckgenommen, fliegt es wieder raus.
  try {
    const sc = await loadShowcase();
    if (status === 'approved' && String(env.MO_AUTO_SHOWCASE || 'on') !== 'off') {
      const j = JSON.parse(await fs.readFile(path.join(STORE, 'jobs', `${designId}.json`), 'utf8'));
      const vorhanden = sc[designId];
      // Der Kunde hat vor unserer Freigabe schon "ja" gesagt: jetzt darf es sichtbar werden.
      if (vorhanden && vorhanden.kundenwunsch === true) { vorhanden.approved = true; await saveShowcase(); }
      // Sonst nur automatisch aufnehmen, wenn nichts dagegen spricht - und nie gegen ein "nein".
      else if (!vorhanden && !(await bewertungSperrgrundFuer(j))) {
        sc[designId] = { approved: true, count: 0, sum: 0, motto: j.motto, mottoText: mottoTextAus(j.values, { name: j.motto }), textile: j.textile || 'dunkel', created: j.created || new Date().toISOString(), auto: true, style: j.style || 'standard' };
        await saveShowcase();
      }
    } else if (status !== 'approved' && sc[designId] && !sc[designId].vorzeige) {
      // Ein ausdrueckliches "nein" des Kunden bleibt stehen (nur unsichtbar geschaltet),
      // sonst waere es nach dem naechsten Freigabe-Hin-und-Her vergessen.
      if (sc[designId].kundenwunsch === false) sc[designId].approved = false;
      else delete sc[designId];
      await saveShowcase();
    }
  } catch (err) { /* Pool ist Beiwerk */ }
  // Kunden benachrichtigen: freigegeben oder abgelehnt (mit optionalem Grund). Ohne Adresse: Hinweis ans Backend.
  let mailed = null;
  if (status !== 'pending' && env.BREVO_API_KEY) {
    const job = await readJob(designId);
    const to = await approvalCustomerEmail(e, job);
    if (to) {
      const grund = String(body.grund || '').trim().slice(0, 300);
      const base = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
      const link = job && job.user ? `${base}/konto` : `${base}/m/${e.motto || 'fanclub'}`;
      const head = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:520px"><p style="font-size:20px;font-weight:bold">Motto Otto</p>`;
      const btn = (t) => `<p style="margin:20px 0"><a href="${link}" style="background:#ffc542;color:#1b1710;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;display:inline-block">${t}</a></p>`;
      const foot = `<p style="color:#999;font-size:12px">Design-Nummer: ${escHtml(designId)}${e.fanclub ? ' · Fanclub: ' + escHtml(e.fanclub) : ''}</p></div>`;
      const html = status === 'approved'
        ? head + `<p><b>Euer Fanclub-Design ist freigegeben. ✓</b></p><p>Der Nachweis ist geprüft – das Design ist jetzt zum Druck freigegeben und erscheint auch bei den Community-Designs.</p>` + btn('Zum Design') + foot
        : head + `<p><b>Euer Fanclub-Design konnte noch nicht freigegeben werden.</b></p><p>Der eingereichte Nachweis reicht leider nicht aus${grund ? ': ' + escHtml(grund) : '.'}</p><p>Ihr könnt einen neuen Nachweis (z. B. Foto vom Fanclub-Ausweis oder eine Bestätigung des/der Vorsitzenden) direkt auf der Design-Seite hochladen oder uns an <a href="mailto:${escHtml(env.MAIL_FROM)}">${escHtml(env.MAIL_FROM)}</a> schreiben.</p>` + btn('Neuen Nachweis hochladen') + foot;
      try {
        await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to, subject: status === 'approved' ? 'Euer Fanclub-Design ist freigegeben ✓' : 'Euer Fanclub-Design: Nachweis noch nicht ausreichend', html });
        mailed = to;
      } catch (err) { console.error('Freigabe-Mail:', err && err.message ? err.message : err); }
    }
  }
  console.log('Fanclub-Freigabe:', designId, '->', status, mailed ? '· Mail an ' + mailed : '· keine Kundenadresse');
  res.json({ ok: true, status, mailed });
});

// Admin: Liste der Freigaben (mit Vorschau + Nachweis-Bild), fuer das Backend.
app.get('/api/admin/approvals', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const ap = await loadApprovals();
  const exp = Date.now() + 86400e3;
  const rank = { submitted: 0, pending: 1, approved: 2, rejected: 3 };
  const items = [];
  for (const [id, e] of Object.entries(ap)) {
    const sig = signPreview(id, exp, SIGN_SECRET);
    items.push({
      designId: id, motto: e.motto || '', fanclub: e.fanclub || '', status: e.status || 'pending',
      at: e.at || null, decidedAt: e.decidedAt || null, image: `${env.PUBLIC_BASE_URL}/api/mo/preview/${id}.png?exp=${exp}&sig=${sig}`,
      // signierter Link (24 h) statt Admin-Token in der URL - der Token kommt im Backend als Header, nicht als ?token
      proof: e.proof ? `${env.PUBLIC_BASE_URL}/api/admin/nachweis/${e.proof}?exp=${exp}&sig=${signPreview(e.proof, exp, SIGN_SECRET)}` : null,
      // Kundenadresse fuer die Rueckmeldung (Formular oder Konto des Besitzers) - null, wenn keine bekannt
      email: await approvalCustomerEmail(e, await readJob(id))
    });
  }
  items.sort((a, b) => ((rank[a.status] ?? 9) - (rank[b.status] ?? 9)) || String(b.decidedAt || b.at || '').localeCompare(String(a.decidedAt || a.at || '')));
  res.json({ approvals: items });
});

// Admin: hochgeladenen Fanclub-Nachweis anzeigen.
// Zugang entweder per signiertem Link (exp+sig ueber den Dateinamen, wie bei Vorschaubildern - so liegt kein
// Admin-Token in der URL, wenn das Bild in einem neuen Tab geoeffnet wird) oder klassisch per Admin-Token.
app.get('/api/admin/nachweis/:file', (req, res, next) => {
  const f = String(req.params.file).replace(/[^A-Za-z0-9_.-]/g, '');
  const { exp, sig } = req.query;
  if (exp && +exp > Date.now() && sig && signPreview(f, exp, SIGN_SECRET) === sig) return next();
  return adminGuard(req, res, next);
}, async (req, res) => {
  const f = String(req.params.file).replace(/[^A-Za-z0-9_.-]/g, '');
  if (!/^up_[a-f0-9]{16}(_nz\d*)?\.png$/.test(f)) return res.status(400).end();
  try { res.type('png').send(await fs.readFile(path.join(STORE, 'uploads', f))); }
  catch (e) { res.status(404).end(); }
});

// ---------- Grund-Modus: liefert der Bildserver Transparenz oder nicht? ----------
// Startwert aus Railway, danach im Backend umstellbar. Die Wahl liegt auf dem Volume,
// damit ein Neustart sie nicht vergisst und kein Deployment noetig ist.
const GRUND_FILE = path.join(STORE, 'grundmodus.json');
async function grundModusLaden() {
  let m = env.GRUND_MODUS === 'chroma' ? 'chroma' : 'alpha';
  try { const d = JSON.parse(await fs.readFile(GRUND_FILE, 'utf8')); if (d && d.modus) m = d.modus; } catch (e) { /* noch nichts gewaehlt */ }
  setGrundModus(m);
  // Fassung 73: Welcher Regelapparat haengt an den Prompts? Startwert aus Railway.
  setPromptFassung(env.PROMPT_FASSUNG === 'schlank' ? 'schlank' : 'alt');
  console.log('Prompt-Fassung:', PROMPT_FASSUNG, PROMPT_FASSUNG === 'schlank' ? '(jede Regel einmal, positiv formuliert)' : '(gewachsener Regelapparat)');
  console.log('Grund-Modus:', GRUND_MODUS, GRUND_MODUS === 'chroma' ? '(Motiv kommt auf Chromagruen und wird hier freigestellt)' : '(Bildserver liefert Alphakanal)');
  return GRUND_MODUS;
}
async function grundModusSetzen(m) {
  const neu = setGrundModus(m);
  try { await fs.mkdir(STORE, { recursive: true }); await fs.writeFile(GRUND_FILE, JSON.stringify({ modus: neu, geaendert: new Date().toISOString() }, null, 2)); }
  catch (e) { console.error('Grund-Modus speichern:', e && e.message ? e.message : e); }
  console.log('Grund-Modus umgestellt auf:', neu);
  return neu;
}

// ---------- Probelauf-Einstellung fuer ECHTE Designs ----------
// Das Modellfeld beim Bildserver-Test wirkt nur auf das Probebild. Zum Vergleichen
// braucht man aber ein echtes Design mit dem echten Motto-Prompt. Darum hier eine
// Einstellung, die der Auftragslauf benutzt: leer = alles bleibt wie eingestellt.
// Bewusst als sichtbarer Schalter mit Warnung - eine stille Umstellung, die ALLE
// Kundendesigns betrifft und die man vergisst, waere gefaehrlich.
const BILD_FILE = path.join(STORE, 'bildmodell.json');
let BILD_WAHL = { model: '', quality: '' };
const MODELL_MUSTER = /^gpt-image-[a-z0-9][a-z0-9.\-]*$/i;
async function bildWahlLaden() {
  try {
    const d = JSON.parse(await fs.readFile(BILD_FILE, 'utf8'));
    BILD_WAHL = { model: String(d.model || ''), quality: String(d.quality || '') };
  } catch (e) { BILD_WAHL = { model: '', quality: '' }; }
  if (BILD_WAHL.model || BILD_WAHL.quality) {
    console.log('ACHTUNG: abweichende Bildeinstellung fuer ALLE neuen Designs -',
      'Modell', BILD_WAHL.model || '(Standard)', '· Stufe', BILD_WAHL.quality || '(Standard)');
  }
  return BILD_WAHL;
}
async function bildWahlSetzen(model, quality) {
  const m = String(model || '').trim();
  if (m && !MODELL_MUSTER.test(m)) throw new Error('Modellname sieht nicht nach einem Bildmodell aus (erwartet z. B. gpt-image-2.5-flare).');
  const q = String(quality || '').trim();
  if (q && !QUALI_STUFEN.includes(q)) throw new Error('Stufe muss eine von ' + QUALI_STUFEN.join(', ') + ' sein.');
  BILD_WAHL = { model: m, quality: q };
  try { await fs.mkdir(STORE, { recursive: true }); await fs.writeFile(BILD_FILE, JSON.stringify({ ...BILD_WAHL, geaendert: new Date().toISOString() }, null, 2)); }
  catch (e) { console.error('Bildeinstellung speichern:', e && e.message ? e.message : e); }
  console.log('Bildeinstellung fuer neue Designs:', BILD_WAHL.model || '(Standard)', BILD_WAHL.quality || '(Standard)');
  return BILD_WAHL;
}
const bildModell = () => BILD_WAHL.model || '';
// Fassung 64: Lehnt der Bilddienst die Stufe ab (z. B. 'max' an einem Modell ohne 'max'), gilt ab
// dann 'high' - fuer alle weiteren Laeufe, ohne dass ein Auftrag daran scheitert.
let STUFE_RUECKFALL = '';
// 22. Sept., Markus: "Im Backend kann ich nur immer das Bildmodell einstellen fuer alles, und ich
// moechte nicht, dass wir Qualitaet einbuessen bei allen anderen Sachen. Wenn, muessen wir das so
// bauen, dass es fuer die Postkarten einzeln anwaehlbar ist." Die Vorrang-Rechnung steht als
// reine Funktion in mottos.js (stufeFuer), damit die Abnahme sie ohne Bildlauf pruefen kann:
// Motto-Datei vor Backend-Schalter vor IMAGE_QUALITY, Rueckfall nur fuer 'xhigh' und 'max'.
const bildStufe = (motto) => stufeFuer(motto, BILD_WAHL.quality, env.IMAGE_QUALITY, STUFE_RUECKFALL);

// Welches Modell laeuft am Bildserver? Der sagt es selbst unter /health. Ohne diese
// Abfrage stand im Backend nur "(am Bildserver eingestellt)" - also die Aufforderung,
// in einem zweiten Railway-Service nachzusehen. Genau daran war die Einstellung
// verwirrend: sie liegt an drei Stellen und nirgends stand, welche gewinnt.
let serverModellCache = { wert: '', bis: 0 };
async function bildserverModell() {
  if (Date.now() < serverModellCache.bis) return serverModellCache.wert;
  let wert = '';
  try {
    const u = new URL(env.BALLZ_MCP_URL);
    const r = await fetch(u.origin + '/health', { signal: AbortSignal.timeout(8000) });
    if (r.ok) { const j = await r.json(); wert = String(j.imageModel || ''); }
  } catch (e) { /* nicht erreichbar: dann eben ohne */ }
  serverModellCache = { wert, bis: Date.now() + 60000 };
  return wert;
}

app.get('/api/admin/bildmodell', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const amServer = await bildserverModell();
  // Was gilt WIRKLICH, und woher kommt es. Beides zusammen, damit niemand mehr raten muss.
  const inKraft = {
    modell: BILD_WAHL.model || amServer || '(unbekannt - Bildserver nicht erreichbar)',
    modellQuelle: BILD_WAHL.model
      ? 'hier im Backend gesetzt'
      : (amServer ? 'Bildserver, Variable IMAGE_MODEL im Service ballz-image-mcp' : 'Bildserver antwortet nicht'),
    stufe: bildStufe(),
    stufeQuelle: BILD_WAHL.quality
      ? 'hier im Backend gesetzt'
      : 'Variable IMAGE_QUALITY im Service motto-otto'
  };
  // 22. Sept.: Welche Mottos haben eine EIGENE Stufe? Sonst stuende im Backend "Stufe max",
  // waehrend die Postkarte in Wahrheit mit 'high' laeuft - genau die Art stiller Abweichung,
  // die man sucht, wenn ein Design anders aussieht als erwartet.
  let eigene = [];
  try { eigene = (await mottos.all()).filter(m => m.bildStufe).map(m => ({ slug: m.slug, name: m.name, stufe: m.bildStufe })); }
  catch (e) { console.error('Motto-Stufen lesen:', e && e.message ? e.message : e); }
  res.json({ ...BILD_WAHL, inKraft, amServer, standardStufe: env.IMAGE_QUALITY, stufen: QUALI_STUFEN, eigeneStufen: eigene });
});
app.post('/api/admin/bildmodell', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const b = req.body || {};
  try { res.json(await bildWahlSetzen(b.model, b.quality)); }
  catch (e) { res.status(400).json({ error: e && e.message ? e.message : String(e) }); }
});

app.get('/api/admin/grundmodus', (req, res, next) => adminGuard(req, res, next), (req, res) => {
  res.json({ modus: GRUND_MODUS, start: env.GRUND_MODUS });
});
app.post('/api/admin/grundmodus', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const m = String((req.body || {}).modus || '');
  if (m !== 'alpha' && m !== 'chroma') return res.status(400).json({ error: 'modus muss alpha oder chroma sein' });
  res.json({ modus: await grundModusSetzen(m) });
});

// Bildserver pruefen: ein Probebild erzeugen und MESSEN, was ankommt - Alphakanal und
// Groesse. Im Browser sieht Weiss aus wie Transparenz, darum zaehlen hier nur Zahlen.
// Genau daran hat es gefehlt: ein stiller Rueckfall auf 1024x1024 faellt sonst nicht auf.
// Die Qualitaetsstufe laesst sich fuer den Probelauf mitgeben, ohne den Betrieb
// umzustellen - sonst muesste man zum Vergleichen zweier Stufen jedes Mal eine
// Railway-Variable aendern und neu ausliefern. 'xhigh' und 'max' koennen nur die
// 2.5-Modelle; passt es nicht zum eingestellten Modell, sagt der Bildserver das jetzt.
// Eine Wahrheit: dieselbe Liste prueft die Motto-Datei (sanitizeMotto) und der Backend-Schalter.
const QUALI_STUFEN = BILD_STUFEN;
// Auch das Modell laesst sich fuer den Probelauf mitgeben. Damit vergleicht man zwei
// Modelle am SELBEN Server mit demselben Prompt - und muss nicht zwischendurch eine
// Railway-Variable umstellen und neu ausliefern. Genau dieser Vergleich entscheidet,
// ob eine zweite, aufwendigere Linie ueberhaupt lohnt.
async function bildserverPruefen(wunsch = '2048x3072', stufe, modell) {
  const t0 = Date.now();
  const quality = QUALI_STUFEN.includes(stufe) ? stufe : env.IMAGE_QUALITY;
  const model = /^gpt-image-[a-z0-9][a-z0-9.\-]*$/i.test(String(modell || '').trim()) ? String(modell).trim() : '';
  try {
    const gen = await generateViaBallz(env.BALLZ_MCP_URL, {
      prompt: 'Bold flat vector lettering "OTTO" in heavy rounded letters, closed counters in the O, one simple star next to it. Two colours only.',
      size: wunsch,
      quality,
      model
    });
    const befund = await pruefeDruckdatei(gen.png);
    const alpha = await hatAlpha(gen.png);
    const ist = `${befund.breite}x${befund.hoehe}`;
    const zeilen = [];
    zeilen.push(alpha
      ? '✅ Alphakanal: vorhanden und benutzt (Alpha min ' + befund.alphaMin + ')'
      : '❌ Alphakanal: ' + (befund.alpha ? 'Kanal da, aber überall undurchsichtig (Alpha min ' + befund.alphaMin + ') – das ist kein Alphakanal, nur vier Kanäle' : 'gar keiner'));
    zeilen.push(ist === wunsch
      ? '✅ Größe: ' + ist + ' wie angefordert'
      : '❌ Größe: ' + ist + ' statt ' + wunsch + ' – der Bildserver reicht die Größe nicht durch');
    zeilen.push((befund.chromaRestProzent > 5 ? '🟢 Chromagrund: ' : '⚪️ Chromagrund: ') + befund.chromaRestProzent + ' % des Bildes ist Chromagrün');
    const bereit = alpha && ist === wunsch;
    zeilen.push(bereit
      ? '→ Der Bildserver ist umgestellt. Der Grund-Modus kann auf „alpha" stehen.'
      : '→ Noch nicht umgestellt. Grund-Modus muss auf „chroma" bleiben.');
    zeilen.push('   Modell: ' + (model || 'wie eingestellt') + ' · Stufe: ' + quality + ' · ' + Math.round((Date.now() - t0) / 1000) + ' s');
    return { ok: true, angefordert: wunsch, bekommen: ist, alpha, alphaMin: befund.alphaMin, quality, model: model || null,
      bild: gen.url || null, chromaProzent: befund.chromaRestProzent, dauerMs: Date.now() - t0,
      bereitFuerAlpha: bereit, text: zeilen.join('\n') };
  } catch (e) {
    return { ok: false, angefordert: wunsch, quality, model: model || null, bereitFuerAlpha: false, dauerMs: Date.now() - t0,
      error: 'Bildserver nicht erreichbar oder Fehler: ' + (e && e.message ? e.message : e) };
  }
}

app.get('/api/admin/bildserver-test', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const wunsch = /^\d+x\d+$/.test(String(req.query.size || '')) ? String(req.query.size) : '2048x3072';
  const r = await bildserverPruefen(wunsch, String(req.query.quality || ''), String(req.query.model || ''));
  await wachePruefungMerken(r, 'hand');
  if (!r.ok) return res.status(502).json({ error: r.error, dauerMs: r.dauerMs });
  res.json(r);
});

// ---------- Tägliche Wache über den Bildserver ----------
// Warum automatisch: Der Ausfall heute war monatelang unbemerkt, weil niemand gemessen
// hat. Einmal am Tag ein Probebild kostet ein paar Cent und faengt genau das ab -
// einen stillen Rueckfall auf kleinere Bilder oder einen verlorenen Alphakanal.
// Mail gibt es NUR bei einem Wechsel des Zustands: wenn es kaputtgeht und wenn es sich
// wieder faengt. Eine taegliche "alles gut"-Mail liest nach einer Woche niemand mehr.
const WACHE_FILE = path.join(STORE, 'bildserver-wache.json');
const WACHE_HOUR = Math.min(23, Math.max(0, +env.WACHE_HOUR || 4));
async function wacheLog() { try { return JSON.parse(await fs.readFile(WACHE_FILE, 'utf8')); } catch (e) { return []; } }
async function wachePruefungMerken(r, quelle) {
  const eintrag = {
    at: new Date().toISOString(), quelle, ok: !!r.ok, bereit: !!r.bereitFuerAlpha,
    angefordert: r.angefordert, bekommen: r.bekommen || null, alphaMin: r.alphaMin ?? null,
    dauerMs: r.dauerMs, modus: GRUND_MODUS, fehler: r.error || null
  };
  try { const list = await wacheLog(); list.unshift(eintrag); await fs.writeFile(WACHE_FILE, JSON.stringify(list.slice(0, 60), null, 2)); }
  catch (e) { console.error('Wache speichern:', e && e.message ? e.message : e); }
  return eintrag;
}
// "Gesund" heisst: Bild kam an, Alphakanal echt, Groesse wie angefordert.
const wacheGesund = (e) => !!(e && e.ok && e.bereit);

async function wacheTick() {
  try {
    const now = new Date();
    if (now.getUTCHours() < WACHE_HOUR) return;
    const heute = now.toISOString().slice(0, 10);
    const list = await wacheLog();
    if (list.some(e => e.quelle === 'wache' && String(e.at).slice(0, 10) === heute)) return;
    const vorher = list.find(e => e.quelle === 'wache');
    const r = await bildserverPruefen();
    const jetzt = await wachePruefungMerken(r, 'wache');
    console.log('Bildserver-Wache:', wacheGesund(jetzt) ? 'in Ordnung' : 'PROBLEM', jetzt.bekommen || jetzt.fehler);
    // Nur bei Wechsel melden - und beim allerersten Lauf nur, wenn etwas nicht stimmt.
    const warVorherGesund = vorher ? wacheGesund(vorher) : true;
    if (wacheGesund(jetzt) === warVorherGesund) return;
    const gut = wacheGesund(jetzt);
    const empfaenger = env.ADMIN_EMAIL || env.MAIL_FROM;
    if (!empfaenger) return;
    const text = gut
      ? 'Der Bildserver liefert wieder saubere Druckdateien.\n\n' + (r.text || '')
      : 'Der Bildserver liefert KEINE brauchbaren Druckdateien mehr.\n\n' + (r.error || r.text || '') +
        '\n\nWas das heisst: neue Designs werden zwar erzeugt, aber die Druckdatei taugt nichts - ' +
        'entweder fehlt die Transparenz (druckt als Kasten) oder die Aufloesung ist kleiner als bestellt.' +
        '\n\nIm Backend unter "Druckdatei-Qualitaet" steht der genaue Befund. Notfalls dort auf ' +
        '"Chromagruen" umstellen, dann wird wieder freigestellt statt sich auf den Server zu verlassen.';
    await mailLogged({
      apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: empfaenger,
      subject: (gut ? '✅' : '❌') + ' Motto Otto: Bildserver ' + (gut ? 'wieder in Ordnung' : 'liefert keine Druckdateien'),
      text
    });
  } catch (e) { console.error('Bildserver-Wache:', e && e.message ? e.message : e); }
}
setTimeout(wacheTick, 180000);
setInterval(wacheTick, 30 * 60000);

// ---------- Kachel-Wache: die Startseite prueft sich selbst ----------
// Markus, 18. Sept.: "Ich hab keinen Bock, die ganze Zeit irgendwas fuer dich zu testen."
// Bis hierher musste er hinsehen, ob die Startseite Bilder zeigt - und mir dann sagen, was
// die Lage-Karte meldet. Das macht der Server jetzt selbst, alle 30 Minuten, ohne ein Bild
// zu rechnen (kachelDiagnose prueft nur die Kette). Faellt mehr als die Haelfte der Kacheln
// aus, geht EINE Mail mit den Gruenden raus - und eine zweite, wenn es wieder gut ist.
// Dazwischen nichts: eine Warnung, die jede halbe Stunde kommt, wird nach drei Mal
// weggeklickt.
let kachelWacheWarSchlecht = null;   // null = noch nie geprueft
async function kachelWache() {
  try {
    const kd = await kachelDiagnose();
    const hart = kd.probleme.filter(p => !p.weich);
    const schlecht = kd.gesamt > 0 && hart.length >= kd.gesamt / 2;
    if (kachelWacheWarSchlecht === null) { kachelWacheWarSchlecht = schlecht; if (!schlecht) return; }
    else if (schlecht === kachelWacheWarSchlecht) return;
    kachelWacheWarSchlecht = schlecht;
    console[schlecht ? 'error' : 'log']('Kachel-Wache:', schlecht ? 'PROBLEM' : 'wieder in Ordnung', `${kd.gesamt - hart.length} von ${kd.gesamt} lieferbar`);
    const empfaenger = env.ADMIN_EMAIL || env.MAIL_FROM;
    if (!empfaenger || !env.BREVO_API_KEY) return;
    const gruende = hart.slice(0, 8).map(p => `- ${p.slug}: ${p.grund}`).join('\n');
    await mailLogged({
      apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: empfaenger,
      subject: (schlecht ? '❌' : '✅') + ' Motto Otto: Startseiten-Kacheln ' + (schlecht ? 'ohne Bild' : 'wieder da'),
      text: schlecht
        ? `${hart.length} von ${kd.gesamt} Anlass-Kacheln auf der Startseite zeigen kein Bild.\n\nGruende:\n${gruende}\n\nIm Backend unter Lage steht die Zeile "Startseiten-Kacheln" mit dem aktuellen Stand. Fallen fast alle gleichzeitig aus, zuerst "Archiv (Google Drive)" und die Vorlagen pruefen.`
        : `Die Startseiten-Kacheln zeigen wieder Bilder: ${kd.gesamt - hart.length} von ${kd.gesamt} lieferbar.`
    });
  } catch (e) { console.error('Kachel-Wache:', e && e.message ? e.message : e); }
}
setTimeout(kachelWache, 240000);
setInterval(kachelWache, 30 * 60000);

// ---------- Kaufweg-Wache: alles, was Kunden vom Kauf abhaelt (kaufweg-wache.js) ----------
// Markus, 8. Okt.: "Baue bitte ein, dass regelmaessig auf Fehler, leere Kacheln, alles das, was
// Kunden vom Kauf abhalten koennte, definitiv immer wieder ueberprueft wird." Alle 30 Minuten
// (erstmals 5 min nach dem Start) geht der Server seine eigenen Seiten durch. Ergebnis in der
// Lage-Karte (Zeile "Kaufweg") und unter GET /api/admin/kaufweg (?jetzt=1 prueft sofort).
// Mail nur bei NEUEN Problemen und einmal, wenn alles wieder gut ist - nie dieselbe Meldung zweimal.
const KAUFWEG_FILE = path.join(STORE, 'kaufweg-wache.json');
let kaufwegStand = null;
let kaufwegLaeuft = null;
const kaufwegStile = () => STYLE_KEYS.filter(k => k !== 'standard' && STYLES[k] && !STYLES[k].off && !STYLES[k].nurMotto);
async function kaufwegWache({ mail = true } = {}) {
  if (kaufwegLaeuft) return kaufwegLaeuft;
  kaufwegLaeuft = (async () => {
    let vorher = null;
    try { vorher = JSON.parse(await fs.readFile(KAUFWEG_FILE, 'utf8')); } catch (e) { /* erster Lauf */ }
    const erg = await kaufwegPruefen({
      basis: 'http://127.0.0.1:' + env.PORT,
      preisBekannt: (k) => PREISE.istBekannt(k),
      ansichtVon,
      stilKeys: kaufwegStile()
    });
    kaufwegStand = erg;
    try { await fs.writeFile(KAUFWEG_FILE, JSON.stringify(erg, null, 1)); } catch (e) { console.error('Kaufweg-Wache, Ablage:', e && e.message ? e.message : e); }
    const alt = new Set(((vorher && vorher.probleme) || []).map(problemSchluessel));
    const neu = erg.probleme.filter(p => !alt.has(problemSchluessel(p)));
    const wiederGut = vorher && vorher.probleme && vorher.probleme.length && !erg.probleme.length;
    console[erg.probleme.length ? 'error' : 'log']('Kaufweg-Wache:', erg.probleme.length ? `${erg.probleme.length} Probleme (${neu.length} neu)` : 'alles in Ordnung',
      `· ${erg.geprueft} Abrufe in ${Math.round(erg.dauerMs / 1000)} s`, erg.probleme.slice(0, 5).map(p => `${p.was} ${p.wo}: ${p.grund}`).join(' · '));
    const empfaenger = env.ADMIN_EMAIL || env.MAIL_FROM;
    if (mail && empfaenger && env.BREVO_API_KEY && (neu.length || wiederGut)) {
      const zeilen = (l) => l.slice(0, 25).map(p => `- ${p.was} (${p.wo}): ${p.grund}`).join('\n');
      await mailLogged({
        apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: empfaenger,
        subject: neu.length ? `❌ Motto Otto: ${neu.length} neue${neu.length === 1 ? 's' : ''} Problem${neu.length === 1 ? '' : 'e'} auf dem Weg zum Kauf` : '✅ Motto Otto: Kaufweg wieder in Ordnung',
        text: neu.length
          ? `Die Kaufweg-Wache hat gerade ${erg.geprueft} Seiten, Bilder und Kataloge abgerufen - so, wie ein Kunde sie sieht.\n\nNEU:\n${zeilen(neu)}\n\nInsgesamt offen: ${erg.probleme.length}.\nIm Backend unter Lage steht die Zeile "Kaufweg" mit dem aktuellen Stand.`
          : `Alle ${erg.geprueft} Abrufe in Ordnung - Seiten, Kacheln, Artikelbilder, Preise.`
      });
    }
    return erg;
  })().finally(() => { kaufwegLaeuft = null; });
  return kaufwegLaeuft;
}
setTimeout(() => kaufwegWache().catch(e => console.error('Kaufweg-Wache:', e && e.message ? e.message : e)), 5 * 60000);
setInterval(() => kaufwegWache().catch(e => console.error('Kaufweg-Wache:', e && e.message ? e.message : e)), 30 * 60000);
app.get('/api/admin/kaufweg', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  try {
    if (req.query.jetzt === '1' || !kaufwegStand) await kaufwegWache({ mail: false });
    res.json(kaufwegStand);
  } catch (e) { res.status(500).json({ error: e && e.message ? e.message : String(e) }); }
});

// ---------- Platzwarnung per Mail ----------
// Ein volles Volume ist der Ausfall, den man am leichtesten haette verhindern koennen -
// und der am spaetesten auffaellt. Eine Warnung im Protokoll liest niemand, also geht sie
// per Mail raus, mit genug Vorlauf zum Handeln (Standard 80 %).
//
// Geprueft werden BEIDE Volumes: das eigene (Druckdateien, Vorschauen, Mockups) und das
// des Bildservers ueber dessen /health. Nur das eigene zu ueberwachen hiesse, die halbe
// Anlage im Dunkeln zu lassen - und der Bildserver ist der, der nie etwas loescht.
//
// Hoechstens EINE Mail pro Tag und Volume, und erst wieder, wenn es schlimmer wird oder
// sich entspannt hat. Eine Warnung, die taeglich kommt, wird nach drei Tagen weggeklickt.
const PLATZ_WARN_PROZENT = Math.min(99, Math.max(50, +env.PLATZ_WARN_PROZENT || 80));
const PLATZ_FILE = path.join(STORE, 'platzwarnung.json');
async function platzWarnLaden() { try { return JSON.parse(await fs.readFile(PLATZ_FILE, 'utf8')); } catch (e) { return {}; } }

async function platzWarnung() {
  const empfaenger = env.ADMIN_EMAIL || env.MAIL_FROM;
  if (!empfaenger) return;
  const stand = await platzWarnLaden();
  const heute = new Date().toISOString().slice(0, 10);
  let geaendert = false;

  const orte = [];
  // 1) Das eigene Volume
  try {
    const p = await platzLage();
    if (p.gesamtBytes) {
      const prozent = Math.round((1 - p.freiBytes / p.gesamtBytes) * 100);
      orte.push({ name: 'motto-otto', prozent, freiMB: Math.round(p.freiBytes / 1048576), gesamtMB: Math.round(p.gesamtBytes / 1048576), tipp: 'Im Backend unter „Druckdateien auslagern" die Vorschau ansehen und aufräumen. Die Originale liegen auf Google Drive.' });
    }
  } catch (e) { /* dann eben nur der Bildserver */ }
  // 2) Das Volume des Bildservers
  try {
    const r = await fetch(String(env.BALLZ_MCP_URL || '').replace(/\/mcp.*$/, '') + '/health', { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j && j.platz && j.platz.gesamtMB) {
      orte.push({ name: 'Bildserver', prozent: j.platz.belegtProzent, freiMB: j.platz.freiMB, gesamtMB: j.platz.gesamtMB,
        tipp: `Dort liegen ${(j.ablage && j.ablage.dateien) || '?'} erzeugte Bilder (${(j.ablage && j.ablage.mb) || '?'} MB). Der Bildserver löscht nichts von allein - mit GENERATED_TTL_TAGE (z. B. 30) räumt er alte Bilder weg.` });
    }
  } catch (e) { /* Bildserver nicht erreichbar - dafuer gibt es die Wache */ }

  for (const o of orte) {
    const alt = stand[o.name] || {};
    const eng = o.prozent >= PLATZ_WARN_PROZENT;
    // Entwarnung, wenn es wieder Luft gibt
    if (!eng) {
      if (alt.gewarnt) {
        stand[o.name] = { gewarnt: false, prozent: o.prozent, at: new Date().toISOString() }; geaendert = true;
        await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: empfaenger,
          subject: `✅ Motto Otto: Platz auf ${o.name} wieder in Ordnung (${o.prozent} %)`,
          text: `Das Volume von ${o.name} ist wieder unter der Warnschwelle von ${PLATZ_WARN_PROZENT} %.\n\nBelegt: ${o.prozent} %, frei: ${o.freiMB} MB von ${o.gesamtMB} MB.` });
      }
      continue;
    }
    // Warnen: einmal am Tag, und sofort wieder, wenn es um 5 Punkte schlimmer geworden ist
    const schonHeute = alt.gewarnt && String(alt.at || '').slice(0, 10) === heute;
    const deutlichSchlimmer = alt.gewarnt && o.prozent >= (+alt.prozent || 0) + 5;
    if (schonHeute && !deutlichSchlimmer) continue;
    stand[o.name] = { gewarnt: true, prozent: o.prozent, at: new Date().toISOString() }; geaendert = true;
    await mailLogged({
      apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: empfaenger,
      subject: `⚠️ Motto Otto: Platz wird eng auf ${o.name} (${o.prozent} % belegt)`,
      text: `Das Volume von ${o.name} ist zu ${o.prozent} % belegt.\n\n` +
        `Frei: ${o.freiMB} MB von ${o.gesamtMB} MB.\n` +
        `Warnschwelle: ${PLATZ_WARN_PROZENT} % (PLATZ_WARN_PROZENT).\n\n` +
        `Was zu tun ist:\n${o.tipp}\n\n` +
        `Warum jetzt und nicht spaeter: ein volles Volume heisst, dass keine Druckdatei mehr ` +
        `geschrieben werden kann. Designs schlagen dann fehl, waehrend Kunden warten. Mit diesem ` +
        `Vorlauf laesst sich das in Ruhe erledigen.\n\n` +
        `Diese Mail kommt hoechstens einmal am Tag je Volume - und sofort wieder, wenn es deutlich schlimmer wird.`
    });
    console.warn('Platzwarnung gemailt:', o.name, o.prozent + ' %');
  }
  if (geaendert) { try { await fs.writeFile(PLATZ_FILE, JSON.stringify(stand, null, 2)); } catch (e) { /* egal */ } }
}
setTimeout(() => platzWarnung().catch(e => console.error('Platzwarnung:', e && e.message ? e.message : e)), 240000);
setInterval(() => platzWarnung().catch(e => console.error('Platzwarnung:', e && e.message ? e.message : e)), 6 * 3600e3);

// ---------- Druckdateien auslagern ----------
// Eine Druckdatei ist mehrere MB (4252 x 5433 px). Dazu kommt je Name eine eigene
// Druckdatei in derselben Groesse - eine Abi-Klasse mit 25 Namen belegt also das
// 26-Fache. Bei ein paar hundert Designs am Tag laeuft das Volume in Wochen voll.
//
// Alle Druckdateien liegen ohnehin auf Google Drive (pushToDrive nach jedem Design);
// lokal sind sie nur der schnelle Zugriff. Also nach der Aufbewahrungszeit lokal weg,
// und wer sie danach braucht, holt sie ueber masterHolen zurueck.
//
// Zwei Sorten, und der Unterschied ist der Kern:
//   ORIGINALE  (masters/*_MASTER.png): unersetzlich. Werden NUR geloescht, wenn die
//              identische Datei nachweislich auf Drive liegt - mit verglichener
//              MD5-Summe, nicht "ist wohl da".
//   ABGELEITET (mockups/: Namensvarianten, Brust-Prints, Kaderlisten, Mockup-JPGs):
//              jederzeit aus dem Original neu baubar. Die duerfen ohne Nachweis weg.
//
// Drei Regeln, weil das Produktionsdaten loescht:
//   1. Nie, wenn Drive nicht verbunden ist.
//   2. Nie bei Fanclub-Designs ohne Freigabe - dort ist noch offen, ob je gedruckt wird.
//   3. Standardmaessig AUS (AUSLAGERN=an schaltet ein). Erst die Vorschau ansehen.
const AUSLAGERN_TAGE = Math.max(1, +env.AUSLAGERN_TAGE || 30);
const auslagernAn = () => String(env.AUSLAGERN || 'aus').toLowerCase() === 'an';
// 27. Sept.: So viele Druckdateien je Lauf duerfen nach Drive nachgeladen werden, wenn die Kopie
// dort fehlt oder abweicht (je 20 bis 40 MB). Geloescht wird erst beim naechsten Lauf, wenn die
// Summe stimmt - die Regel "nur mit Nachweis" bleibt.
const AUSLAGERN_NACHLADEN_MAX = Math.max(0, +env.AUSLAGERN_NACHLADEN_MAX || 300);
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

async function auslagern({ wirklich = false } = {}) {
  const st = await drive.status();
  if (!st.connected) return { ok: false, grund: 'Google Drive ist nicht verbunden - ohne Archiv wird nichts geloescht.' };
  const grenze = Date.now() - AUSLAGERN_TAGE * 86400e3;
  const originale = [], abgeleitet = [], uebersprungen = [];
  let bytesOrig = 0, bytesAbgel = 0, nachgeladen = 0;

  // --- Originale: nur mit Nachweis auf Drive ---
  let mFiles = [];
  try { mFiles = await fs.readdir(path.join(STORE, 'masters')); } catch (e) { /* noch nichts da */ }
  for (const f of mFiles) {
    const m = f.match(/^(.+)_(PRINT|BACK)_MASTER\.png$/);
    if (!m) continue;
    const p = path.join(STORE, 'masters', f);
    let s; try { s = await fs.stat(p); } catch (e) { continue; }
    const designId = m[1];
    const j = await readJob(designId);
    // 27. Sept.: Das Alter ist das des DESIGNS, nicht das der Datei. Der Nachschaerf-Lauf vom
    // 21. Sept. (druckkantenNachschaerfen) hat jede Druckdatei neu geschrieben - nach Dateidatum
    // war danach keine aelter als eine Woche, und der erste scharfe Lauf fand 0 Originale.
    const entstanden = j && j.created ? Date.parse(j.created) : NaN;
    const alter = Number.isFinite(entstanden) ? Math.min(entstanden, s.mtimeMs) : s.mtimeMs;
    if (alter > grenze) continue;
    if (j && needsApproval({ slug: j.motto }) && (await approvalStatus(designId)) !== 'approved') {
      uebersprungen.push({ datei: f, grund: 'Fanclub-Freigabe noch offen' });
      continue;
    }
    const parts = [(j && j.motto) || 'sonstige', designId];
    let drin = null;
    try { drin = await drive.find(parts, f); }
    catch (e) { uebersprungen.push({ datei: f, grund: 'Drive-Abfrage fehlgeschlagen' }); continue; }
    // Ist es dieselbe Datei? MD5 vergleichen. Liefert Drive keine Summe: Groesse.
    try {
      const lokal = await fs.readFile(p);
      const gleich = !!drin && (drin.md5 ? md5(lokal) === drin.md5 : drin.size === s.size);
      if (!gleich) {
        // Fehlt die Kopie oder weicht sie ab, ist die LOKALE die richtige (der Nachschaerf-Lauf
        // hat nur lokal geschrieben, Drive traegt noch die weiche Kante). Also nach Drive damit -
        // upload() ersetzt eine vorhandene Datei. Geloescht wird beim naechsten Lauf, wenn die
        // Summe dort stimmt. Ohne diesen Schritt bliebe jede Datei fuer immer "weicht ab".
        const grund = drin ? 'Kopie auf Drive weicht ab' : 'liegt nicht auf Drive';
        // 6. Okt., Markus: "Kunden-Dateien duerfen ohne meine Zustimmung nicht ueberschrieben werden." Eine VORHANDENE Kopie auf
        // Drive wird nie ersetzt - die Datei bleibt lokal liegen und steht auf der Liste fuer Markus. Nur eine fehlende kommt dazu.
        if (drin) { uebersprungen.push({ datei: f, grund: grund + ' - NICHT ueberschrieben, wartet auf Markus' }); continue; }
        if (wirklich && nachgeladen < AUSLAGERN_NACHLADEN_MAX) {
          try { await drive.upload(parts, f, lokal, 'image/png'); nachgeladen++; uebersprungen.push({ datei: f, grund: grund + ' - Drive-Kopie erneuert, Loeschung beim naechsten Lauf' }); }
          catch (e) { uebersprungen.push({ datei: f, grund: grund + ' - Erneuern fehlgeschlagen: ' + String(e && e.message ? e.message : e).slice(0, 80) }); }
        } else uebersprungen.push({ datei: f, grund });
        continue;
      }
    } catch (e) { uebersprungen.push({ datei: f, grund: 'lokal nicht lesbar' }); continue; }
    originale.push({ datei: f, bytes: s.size, designId });
    bytesOrig += s.size;
  }

  // --- Abgeleitetes: darf ohne Nachweis weg, wird bei Bedarf neu gebaut ---
  let cFiles = [];
  try { cFiles = await fs.readdir(path.join(STORE, 'mockups')); } catch (e) { /* noch nichts da */ }
  for (const f of cFiles) {
    // 27. Sept.: Die Vorzeige-Mockups (stil_<motto>_<stil>...) bleiben. Sie gehoeren zu keinem
    // Kundendesign, die Startseite und die Stil-Galerie zeigen sie staendig, und ihr Alter sagt
    // nichts - sie sind so alt wie ihr Stand. Alle auf einmal wegzuwerfen hiesse, hunderte
    // Kacheln gleichzeitig neu zu rechnen (Fassung 84b: genau das hat den Container umgeworfen).
    if (f.startsWith('stil_')) continue;
    const p = path.join(STORE, 'mockups', f);
    let s; try { s = await fs.stat(p); } catch (e) { continue; }
    if (s.mtimeMs > grenze) continue;
    abgeleitet.push({ datei: f, bytes: s.size });
    bytesAbgel += s.size;
  }

  const gruende = {};
  for (const u of uebersprungen) { const g = u.grund.replace(/ - Erneuern fehlgeschlagen: .*$/, ' - Erneuern fehlgeschlagen'); gruende[g] = (gruende[g] || 0) + 1; }
  let geloescht = 0, fehler = 0;
  if (wirklich) {
    for (const x of originale) {
      try { await fs.rm(path.join(STORE, 'masters', x.datei), { force: true }); geloescht++; }
      catch (e) { fehler++; console.error('Auslagern:', x.datei, e && e.message ? e.message : e); }
    }
    for (const x of abgeleitet) {
      try { await fs.rm(path.join(STORE, 'mockups', x.datei), { force: true }); geloescht++; }
      catch (e) { fehler++; }
    }
    console.log('Ausgelagert:', geloescht, 'Dateien,', Math.round((bytesOrig + bytesAbgel) / 1048576), 'MB frei ·',
      originale.length, 'Originale (auf Drive bestaetigt),', abgeleitet.length, 'abgeleitete ·',
      uebersprungen.length, 'uebersprungen', uebersprungen.length ? '(' + Object.entries(gruende).map(([g, n]) => n + 'x ' + g).join('; ') + ')' : '',
      nachgeladen ? '· ' + nachgeladen + ' nach Drive nachgeladen' : '');
  }
  return {
    ok: true, wirklich, tage: AUSLAGERN_TAGE, an: auslagernAn(),
    originale: originale.length, abgeleitet: abgeleitet.length,
    uebersprungen: uebersprungen.slice(0, 20), uebersprungenAnzahl: uebersprungen.length, gruende, nachgeladen,
    mbOriginale: +(bytesOrig / 1048576).toFixed(1), mbAbgeleitet: +(bytesAbgel / 1048576).toFixed(1),
    mbGesamt: +((bytesOrig + bytesAbgel) / 1048576).toFixed(1), geloescht, fehler,
    beispiele: originale.slice(0, 10).map(x => x.datei)
  };
}

// Einmal am Tag, aber nur wenn ausdruecklich eingeschaltet.
async function auslagerTick() {
  if (!auslagernAn()) return;
  try { await auslagern({ wirklich: true }); }
  catch (e) { console.error('Auslagern gescheitert:', e && e.message ? e.message : e); }
}
setTimeout(auslagerTick, 600000);
setInterval(auslagerTick, 24 * 3600000);

// Vorschau (was WUERDE weg) und ein Lauf auf Knopfdruck - beides nur fuer den Chef.
app.get('/api/admin/auslagern', (req, res, next) => adminGuard(req, res, next), async (req, res) => res.json(await auslagern({ wirklich: false })));
app.post('/api/admin/auslagern', (req, res, next) => adminGuard(req, res, next), async (req, res) => res.json(await auslagern({ wirklich: true })));

// Einmal beim Start: Designs, die nach der neuen Regel nicht in die oeffentliche Bewertung
// gehoeren (Firmenlogo, hochgeladenes Foto), aber frueher automatisch hineingerutscht sind,
// still auf unsichtbar schalten. Bewusst NICHT loeschen - abgegebene Bewertungen bleiben
// erhalten, und vom Chef kuratierte Vorzeige-Designs bleiben unangetastet.
async function poolNachziehen() {
  try {
    const sc = await loadShowcase();
    let raus = 0;
    for (const [id, e] of Object.entries(sc)) {
      if (!e || !e.approved || e.vorzeige) continue;
      if (typeof e.kundenwunsch === 'boolean') continue; // der Kunde hat selbst entschieden
      const grund = await bewertungSperrgrundFuer(await readJob(id));
      if (!grund || grund === 'unbekanntes Design') continue;
      e.approved = false;
      e.nachgezogen = grund;
      raus++;
    }
    if (raus) { await saveShowcase(); console.log('Bewertungs-Pool bereinigt:', raus, 'Design(s) nachtraeglich gesperrt (B2B/eigenes Material)'); }
  } catch (e) { console.error('Pool nachziehen:', e && e.message ? e.message : e); }
}
setTimeout(poolNachziehen, 20000);

app.get('/api/admin/bildserver-wache', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const list = await wacheLog();
  const letzte = list.find(e => e.quelle === 'wache') || list[0] || null;
  res.json({ stunde: WACHE_HOUR, empfaenger: env.ADMIN_EMAIL || env.MAIL_FROM || null, letzte, eintraege: list.slice(0, 14) });
});

// ---------- Pruefstand ----------
// Bisher fand man Fehler so: ein Design erzeugen, hinsehen, etwas faellt auf, melden,
// beheben - und die naechste Kombination hat wieder etwas anderes. Das leere Schild gab
// es nur ohne Logo, die gemalte Anweisung nur mit Wunschtext. Solche Faelle findet man
// nicht einzeln, sondern nur, wenn man sie SYSTEMATISCH nebeneinander sieht.
//
// Der Pruefstand faehrt darum ganze Reihen durch, sammelt zu jedem Lauf die automatischen
// Befunde (Druckpruefung, Bild-QA, erkannter Text im Bild, Namensband) und nimmt zu jedem
// einen Kommentar entgegen. Am Ende steht eine Mangelliste statt vieler Einzelmeldungen.
const PRUEF_FILE = path.join(STORE, 'pruefstand.json');
let pruefCache = null;
async function pruefLaden() {
  if (!pruefCache) { try { pruefCache = JSON.parse(await fs.readFile(PRUEF_FILE, 'utf8')); } catch (e) { pruefCache = {}; } }
  return pruefCache;
}
let pruefWrite = Promise.resolve();
function pruefSichern() {
  const d = pruefCache || {};
  pruefWrite = pruefWrite.then(() => fs.writeFile(PRUEF_FILE, JSON.stringify(d, null, 2))).catch(e => console.error('Pruefstand speichern:', e && e.message ? e.message : e));
  return pruefWrite;
}

// Testdaten aus dem Motto selbst: die Platzhalter sind schon die guten Beispiele
// ("z. B. Dachdeckerei Petersen"). Damit sind die Laeufe realistisch, ohne dass jemand
// fuer 18 Mottos Inhalte erfindet - und sie aendern sich automatisch mit den Mottos mit.
function testWerte(motto) {
  const v = {};
  for (const f of motto.fields || []) {
    if (f.type === 'select') { v[f.key] = (f.options && f.options[0]) || ''; continue; }
    const ph = String(f.placeholder || '').replace(/^z\.\s*B\.\s*/i, '').trim();
    if (f.personal) { v[f.key] = ph || 'Lena\nTim\nJonas'; continue; }
    if (ph) { v[f.key] = ph.split('\n')[0]; continue; }
    if (f.required) v[f.key] = 'Test ' + (f.label || f.key);
  }
  return v;
}

// Ein schlichtes Testlogo, einmal erzeugt: klare Kanten, kraeftige Farbe, damit man auf
// dem fertigen Design sofort sieht, ob und wo es gelandet ist.
async function testLogo() {
  const id = 'up_pruefstandlogo.png';
  const p = path.join(STORE, 'uploads', id);
  try { await fs.access(p); return id; } catch (e) { /* bauen */ }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <rect width="600" height="600" rx="60" fill="#c81e1e"/>
    <circle cx="300" cy="230" r="110" fill="#ffffff"/>
    <rect x="90" y="390" width="420" height="90" rx="18" fill="#ffffff"/></svg>`);
  await fs.mkdir(path.join(STORE, 'uploads'), { recursive: true });
  await fs.writeFile(p, await sharp(svg).png().toBuffer());
  return id;
}

app.post('/api/admin/pruefstand/start', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const b = req.body || {};
  const alle = await mottos.all();
  const gewaehlt = Array.isArray(b.mottos) && b.mottos.length
    ? alle.filter(m => b.mottos.includes(m.slug))
    : alle.filter(m => m.active !== false);
  const stile = Array.isArray(b.styles) && b.styles.length ? b.styles : ['standard'];
  const textilien = b.textile === 'beide' ? ['schwarz', 'weiss'] : [TEXTILTOENE.includes(b.textile) ? b.textile : (b.textile === 'hell' ? 'weiss' : 'schwarz')];
  const logoWahl = ['mit', 'ohne', 'beide'].includes(b.logo) ? b.logo : 'ohne';

  const plan = [];
  for (const m of gewaehlt) {
    const kannLogo = m.upload && m.upload.mode === 'exact';
    // "mit Logo" nur, wo das Motto ueberhaupt eins einsetzt - sonst laeuft man Kombinationen,
    // die es gar nicht gibt, und bezahlt Bilder fuer nichts.
    const logos = logoWahl === 'beide' ? (kannLogo ? [false, true] : [false])
      : logoWahl === 'mit' ? (kannLogo ? [true] : [])
      : [false];
    for (const stil of stile) for (const textile of textilien) for (const mitLogo of logos) {
      plan.push({ motto: m.slug, name: m.name, stil, textile, mitLogo });
    }
  }
  if (!plan.length) return res.status(400).json({ error: 'nichts zu tun', hinweis: 'Diese Auswahl ergibt keine einzige Kombination.' });
  if (b.nurZaehlen) {
    return res.json({ geplant: plan.length, dauerSek: wartezeitSek(plan.length + queue.length), plan: plan.slice(0, 12) });
  }
  // Nicht mehr annehmen, als die Schlange vertraegt - sonst blockiert ein Testlauf die Kunden.
  const platz = Math.max(10, +env.MAX_QUEUE || 300) - queue.length;
  if (plan.length > platz) return res.status(503).json({ error: 'zu viel', hinweis: `Gerade ist nur Platz für ${platz} Läufe. Bitte weniger auswählen oder später starten.` });

  const gruppe = 'pr_' + crypto.randomBytes(5).toString('hex');
  const daten = await pruefLaden();
  const logoDatei = plan.some(x => x.mitLogo) ? await testLogo() : null;
  for (const p of plan) {
    const m = alle.find(x => x.slug === p.motto);
    const jobId = 'mo_' + crypto.randomBytes(8).toString('hex');
    const job = {
      jobId, status: 'queued', qa: [], created: new Date().toISOString(),
      // test: der Lauf gehoert niemandem, wird nicht gebucht und kommt NIE in die
      // Community-Bewertung - sonst fuellt ein Pruefdurchlauf das Schaufenster.
      test: true,
      input: {
        motto: m, values: testWerte(m), uploadFile: p.mitLogo ? logoDatei : null, uploadFile2: null,
        style: p.stil, colors: '', names: [], people: [], aufteilung: 'vorne',
        textile: p.textile, nameFont: m.nameFont || 'rund', mood: 'standard', placement: ''
      },
      who: { userId: null, guestId: null, via: 'pruefstand' }
    };
    jobs.set(jobId, job);
    enqueue(job);
    daten[jobId] = { jobId, gruppe, at: new Date().toISOString(), motto: p.motto, name: p.name, stil: p.stil, textile: p.textile, mitLogo: p.mitLogo, kommentar: '' };
  }
  await pruefSichern();
  console.log('Pruefstand gestartet:', plan.length, 'Laeufe, Gruppe', gruppe);
  res.json({ ok: true, gruppe, geplant: plan.length, dauerSek: wartezeitSek(plan.length + queue.length) });
});

app.get('/api/admin/pruefstand', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const daten = await pruefLaden();
  const eintraege = [];
  let geaendert = false;
  for (const e of Object.values(daten)) {
    const j = jobs.get(e.jobId) || null;
    // Auftraege liegen nur zwei Tage im Speicher - die Mangelliste soll laenger halten.
    // Darum wird der Befund EINMAL, sobald der Lauf durch ist, in die Pruefstand-Datei
    // geschrieben. Sonst waere die Liste nach dem naechsten Deploy leer und die
    // durchgesehene Arbeit umsonst.
    if (j && (j.status === 'done' || j.status === 'error' || j.status === 'qa_failed')) {
      e.status = j.status;
      if (j.designId) {
        e.designId = j.designId;
        const b = [];
        if (j.druck && !j.druck.druckfaehig) b.push('Druckdatei: ' + (j.druck.gruende || []).join('; '));
        // Fassung 28: nur Warnung - Punzen und Schlagschatten muessen im Prompt richtig entstehen
        if (j.dunkel && j.dunkel.gefuellteFlaechen) b.push('Dunkle Fuellflaechen (Punzen/Schatten?): ' + j.dunkel.gefuellteFlaechen + ' Flaechen, ' + j.dunkel.davonAnteil + ' % der Leinwand');
        const letzte = (j.qa || []).at(-1);
        if (letzte && letzte.reason) b.push('Bildprüfung: ' + letzte.reason);
        if (j.backOffen) b.push('Rückseite fehlt (' + j.backOffen + ' Namen)');
        e.befund = b;
        // Kein Mangel, sondern die normale Regel - darum getrennt und nicht rot: fast jeder
        // Lauf hat einen Grund, nicht in den Bewertungs-Pool zu kommen. Staende das unter
        // "Befund", waere jede Karte rot und die echten Fehler gingen darin unter.
        e.hinweis = j.bewertungSperre || null;
        e.texte = j.texte || [];
        e.versuche = (j.qa || []).length;
      } else {
        e.befund = ['abgebrochen: ' + (j.error || j.hint || 'ohne Grund')];
      }
      geaendert = true;
    }
    const o = { ...e, status: e.status || (j ? j.status : 'weg') };
    // Das Vorschaubild wird hier frisch unterschrieben: die Adresse aus dem Auftrag
    // laeuft nach zwei Wochen ab, die Mangelliste soll aber laenger benutzbar bleiben.
    if (e.designId) {
      const exp = Date.now() + 7 * 86400e3;
      o.bild = `/api/mo/preview/${e.designId}.png?exp=${exp}&sig=${signPreview(e.designId, exp, SIGN_SECRET)}`;
    }
    eintraege.push(o);
  }
  if (geaendert) await pruefSichern();
  eintraege.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const offen = eintraege.filter(x => x.status === 'queued' || x.status === 'running').length;
  res.json({ eintraege, offen, gesamt: eintraege.length });
});

app.post('/api/admin/pruefstand/kommentar', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const b = req.body || {};
  const daten = await pruefLaden();
  const e = daten[String(b.jobId || '')];
  if (!e) return res.status(404).json({ error: 'unbekannter Lauf' });
  e.kommentar = String(b.kommentar || '').slice(0, 1000);
  await pruefSichern();
  res.json({ ok: true });
});

app.post('/api/admin/pruefstand/leeren', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const nurOhne = !!(req.body || {}).nurOhneKommentar;
  const daten = await pruefLaden();
  let weg = 0;
  for (const [k, e] of Object.entries(daten)) {
    // Laeufe MIT Kommentar sind die Mangelliste - die wirft man nicht versehentlich weg.
    if (nurOhne && e.kommentar) continue;
    delete daten[k]; weg++;
  }
  await pruefSichern();
  res.json({ ok: true, entfernt: weg });
});

// ---------- Lage: alles auf einen Blick ----------
// Bisher musste man fuer die Frage "laeuft alles?" durch fuenf Karten und zwei
// Railway-Services. Das ist die Art Unuebersichtlichkeit, in der Probleme lange
// unentdeckt bleiben - der lügende Watchdog war wochenlang unsichtbar. Hier steht
// jeder Punkt mit Ampel und, wenn etwas klemmt, gleich der naechste Schritt dazu.
const MB = (b) => +(b / 1048576).toFixed(1);
let platzCache = { wert: null, bis: 0 };
async function platzLage() {
  if (Date.now() < platzCache.bis) return platzCache.wert;
  const groesse = async (unter) => {
    let bytes = 0, n = 0;
    try {
      for (const f of await fs.readdir(path.join(STORE, unter))) {
        try { const s = await fs.stat(path.join(STORE, unter, f)); if (s.isFile()) { bytes += s.size; n++; } } catch (e) { /* weg */ }
      }
    } catch (e) { /* Ordner fehlt */ }
    return { bytes, n };
  };
  const wert = { masters: await groesse('masters'), mockups: await groesse('mockups'), previews: await groesse('previews') };
  try {
    const s = await fs.statfs(STORE);
    wert.freiBytes = s.bavail * s.bsize;
    wert.gesamtBytes = s.blocks * s.bsize;
  } catch (e) { wert.freiBytes = null; wert.gesamtBytes = null; }
  platzCache = { wert, bis: Date.now() + 120000 };
  return wert;
}

// Fassung 74: Die Zahlen fuer das Backend. Reine Tagessummen, keine Personendaten -
// darum auch keine Ausnahme im Datenschutztext noetig (siehe Kopf von zaehler.js).
app.get('/api/admin/zaehler', (req, res, next) => adminGuard(req, res, next), (req, res) => {
  const tage = Math.max(1, Math.min(parseInt(req.query.tage, 10) || 14, 180));
  res.json({ ok: true, gruppenNamen: ZAEHLER_GRUPPEN, ...zaehlerBericht({ tage }) });
});

app.get('/api/admin/lage', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const punkte = [];
  const zeile = (name, stand, text, tipp) => punkte.push({ name, stand, text, tipp: tipp || '' });

  // 1) Bildserver - ohne den geht gar nichts
  const amServer = await bildserverModell();
  const wl = (await wacheLog()).find(e => e.quelle === 'wache') || null;
  zeile('Bildserver',
    amServer ? 'ok' : 'schlecht',
    amServer
      ? `erreichbar · Modell ${BILD_WAHL.model || amServer}, Stufe ${bildStufe()}`
      : 'antwortet nicht',
    amServer ? '' : 'Ohne Bildserver kann kein Design entstehen. Service ballz-image-mcp in Railway prüfen.');
  if (wl) zeile('Tägliche Prüfung', wacheGesund(wl) ? 'ok' : 'schlecht',
    `letzte um ${new Date(wl.at).toLocaleString('de-DE')}: ${wacheGesund(wl) ? 'Druckdatei in Ordnung' : (wl.fehler || 'nicht bereit')}`,
    wacheGesund(wl) ? '' : 'Karte „Druckdatei-Qualität" öffnen und „Bildserver prüfen" drücken.');

  // 2) Warteschlange - sagt, ob Kunden warten
  const schnitt = Math.round(dauerSchnitt() / 1000);
  // Ehrlich benennen, woher die Zahl kommt: solange kein Design durchgelaufen ist, ist
  // das ein Startwert und keine Messung. Eine geratene Zahl als Messung auszugeben ist
  // genau die Art Halbwahrheit, die spaeter zu falschen Schluessen fuehrt.
  zeile('Warteschlange',
    queue.length > 40 ? 'warnung' : 'ok',
    `${running} laufen, ${queue.length} warten · ${dauern.length ? `⌀ ${schnitt} s je Design (aus ${dauern.length} Läufen gemessen)` : `noch nichts gemessen, gerechnet wird mit ${schnitt} s`} · höchstens ${env.MAX_PARALLEL_JOBS} Designs gleichzeitig, davon ${MAX_BILDARBEIT} beim Rechnen`,
    queue.length > 40 ? 'Viel Betrieb. Wenn das öfter vorkommt: MAX_PARALLEL_JOBS erhöhen (Limit sind 50 Bilder/Minute bei OpenAI).' : '');

  // 2b) Arbeitsspeicher - die Wand, an der wir am 18. September gestanden haben
  // Am 18. September ist der Container umgekippt, und es gab keine Zahl, an der man das
  // haette kommen sehen. Jetzt steht sie da: was der Container hat, was er gerade braucht und
  // wie weit die Spitze seit dem Start ging. Gemessen wurde: rund 300 MB je gleichzeitigem
  // Rechenlauf, dazu gut 110 MB Grundlast. Mit dieser Zeile laeszt sich MAX_BILDARBEIT
  // einstellen, statt es auszuprobieren.
  const sp = speicherLage();
  if (sp) {
    // 300 MB je gleichzeitigem Rechenlauf sind gemessen (18. Sept., Druckdatei 4096 px).
    // Gerechnet wird ab dem AKTUELLEN Verbrauch und nicht ab einer angenommenen Grundlast:
    // was der Server gerade haelt, hat er wirklich, und nur der Rest steht zur Verfuegung.
    // Mit einer geschaetzten Grundlast stand hier eine zu schoene Zahl.
    const proLauf = 300;
    const passt = sp.grenzeMB ? Math.max(1, Math.floor((sp.grenzeMB * 0.8 - sp.spitzeMB) / proLauf)) : null;
    const knapp = sp.grenzeMB && (sp.spitzeMB / sp.grenzeMB > 0.8);
    zeile('Arbeitsspeicher',
      knapp ? 'warnung' : 'ok',
      `${sp.jetztMB} MB in Gebrauch${sp.grenzeMB ? ` von ${sp.grenzeMB} MB` : ''} · Spitze seit dem Start ${sp.spitzeMB} MB`
      + (passt ? ` · für ${passt} gleichzeitige Rechenläufe reicht es sicher (eingestellt: ${MAX_BILDARBEIT})` : ''),
      knapp ? 'Die Spitze liegt über 80 % der Grenze. MAX_BILDARBEIT in Railway senken oder dem Service mehr Speicher geben.'
        : (passt && passt < MAX_BILDARBEIT ? `MAX_BILDARBEIT steht auf ${MAX_BILDARBEIT}, sicher sind hier ${passt}. In Railway senken.` : ''));
  }

  // 3) Platz - der Grund, warum es das Auslagern gibt
  const p = await platzLage();
  const belegt = p.masters.bytes + p.mockups.bytes + p.previews.bytes;
  const schnittMaster = p.masters.n ? p.masters.bytes / p.masters.n : 0;
  // Hochrechnen nur mit belastbarer Stichprobe. Sonst kommt Unsinn heraus: bei drei
  // winzigen Testdateien stand hier "reicht noch fuer 150 Millionen Designs" - und eine
  // sichtbar absurde Zahl macht die ganze Karte unglaubwuerdig, auch die richtigen Zeilen.
  const belastbar = p.masters.n >= 5 && schnittMaster > 200 * 1024;
  const nochDesigns = belastbar && p.freiBytes ? Math.floor(p.freiBytes / schnittMaster) : null;
  const knapp = p.freiBytes !== null && p.freiBytes < 2 * 1073741824;
  zeile('Platz',
    knapp ? 'schlecht' : (nochDesigns !== null && nochDesigns < 500 ? 'warnung' : 'ok'),
    (p.freiBytes !== null ? `${MB(p.freiBytes)} MB frei` : 'unbekannt') +
    ` · belegt: Druckdateien ${MB(p.masters.bytes)} MB (${p.masters.n}), Abgeleitetes ${MB(p.mockups.bytes)} MB (${p.mockups.n}), Vorschauen ${MB(p.previews.bytes)} MB (${p.previews.n})` +
    (nochDesigns !== null ? ` · reicht noch für etwa ${nochDesigns} Designs` : ''),
    knapp ? 'Karte „Druckdateien auslagern" öffnen, Vorschau ansehen und löschen.' : '');

  // 4) Archiv - Voraussetzung fuers Auslagern
  const ds = await drive.status();
  zeile('Archiv (Google Drive)',
    ds.connected ? 'ok' : (auslagernAn() ? 'schlecht' : 'warnung'),
    ds.connected ? `verbunden als ${ds.email || '?'} · Ordner „${ds.root}"` : 'nicht verbunden',
    ds.connected ? '' : 'Ohne Archiv gibt es keine Sicherung der Druckdateien, und das Auslagern läuft nicht.');
  zeile('Auslagern',
    auslagernAn() ? (ds.connected ? 'ok' : 'schlecht') : 'warnung',
    auslagernAn() ? `an · Druckdateien älter als ${AUSLAGERN_TAGE} Tage werden täglich lokal gelöscht (Drive behält sie)` : `aus · nichts wird gelöscht (AUSLAGERN=an in Railway schaltet ein, Frist ${AUSLAGERN_TAGE} Tage)`,
    auslagernAn() ? '' : 'Vorher einmal von Hand testen: Vorschau, eine Druckdatei laden, löschen, nochmal laden.');

  // 4a) Start-Reparaturen - sind sie gelaufen, oder still abgestuerzt?
  {
    const kaputt = [['Herstellerfotos zurueckholen', startReparaturen.originale], ['Vorlagen nachputzen', startReparaturen.nachputzen]].filter(([, f]) => f);
    zeile('Start-Reparaturen',
      kaputt.length ? 'schlecht' : 'ok',
      kaputt.length ? kaputt.map(([n, f]) => `${n}: ${f}`).join(' · ') : (startReparaturen.wann ? `beide gelaufen (${new Date(startReparaturen.wann).toLocaleTimeString('de-DE')})` : 'laufen kurz nach dem Start'),
      kaputt.length ? 'Ein Fehler hier heisst: Vorlagen auf dem Volume werden NICHT repariert. Das ist ein Programmfehler, kein Bedienfehler.' : '');
  }

  // 4b) Startseiten-Kacheln - das Erste, was jeder Besucher sieht. Fassung 90.
  try {
    const kd = await kachelDiagnose();
    const hart = kd.probleme.filter(p => !p.weich), weich = kd.probleme.filter(p => p.weich);
    const bsp = hart.slice(0, 4).map(p => `${p.slug}: ${p.grund}`).join(' · ');
    const viele = hart.length >= kd.gesamt / 2;
    zeile('Startseiten-Kacheln',
      hart.length ? (viele ? 'schlecht' : 'warnung') : 'ok',
      hart.length
        ? `${kd.gesamt - hart.length} von ${kd.gesamt} lieferbar · ${hart.length} ohne Bild – ${bsp}${hart.length > 4 ? ' · …' : ''}`
        : `alle ${kd.gesamt} lieferbar${weich.length ? ` · ${weich.length} Druckdateien nur im Archiv (werden beim ersten Aufruf geholt)` : ''}`,
      hart.length
        ? (viele ? 'Fallen fast alle gleichzeitig aus, liegt es selten am einzelnen Motto: Archiv (Zeile oben) und Vorlagen prüfen.'
                 : 'Der Grund steht dabei. „kein Vorzeige-Design" heißt: im Backend unter Vorzeige für dieses Motto eines wählen oder erzeugen.')
        : '');
  } catch (e) { zeile('Startseiten-Kacheln', 'warnung', 'Prüfung nicht möglich: ' + (e && e.message ? e.message : e), ''); }

  // 4c) Kaufweg - alles, was Kunden vom Kauf abhaelt (Kaufweg-Wache, alle 30 Minuten)
  if (kaufwegStand) {
    const kp = kaufwegStand.probleme;
    zeile('Kaufweg', kp.length ? (kp.length > 5 ? 'schlecht' : 'warnung') : 'ok',
      kp.length
        ? `${kp.length} Problem${kp.length === 1 ? '' : 'e'} · ${kp.slice(0, 4).map(p => `${p.was}: ${p.grund}`).join(' · ')}${kp.length > 4 ? ' · …' : ''} (geprüft ${new Date(kaufwegStand.at).toLocaleString('de-DE')})`
        : `${kaufwegStand.geprueft} Seiten, Bilder und Kataloge in Ordnung · geprüft ${new Date(kaufwegStand.at).toLocaleString('de-DE')}`,
      kp.length ? 'Alle Befunde: /api/admin/kaufweg (mit ?jetzt=1 sofort neu prüfen).' : '');
  } else zeile('Kaufweg', 'warnung', 'noch nicht geprüft (erster Lauf 5 Minuten nach dem Start)', '');

  // 5) Mail - sonst warten Kunden auf eine Nachricht, die nie kommt
  let letzteMail = null;
  try { const l = JSON.parse(await fs.readFile(MAILLOG_FILE, 'utf8')); letzteMail = Array.isArray(l) ? l[0] : null; } catch (e) { /* noch keine */ }
  zeile('Mail',
    !env.BREVO_API_KEY ? 'schlecht' : (letzteMail && !letzteMail.ok ? 'warnung' : 'ok'),
    !env.BREVO_API_KEY ? 'kein BREVO_API_KEY gesetzt - es wird nichts verschickt'
      : (letzteMail ? `letzte am ${new Date(letzteMail.at).toLocaleString('de-DE')} an ${letzteMail.to}: ${letzteMail.ok ? 'zugestellt' : 'FEHLER - ' + (letzteMail.error || '?')}` : 'eingerichtet, noch nichts verschickt'),
    !env.BREVO_API_KEY ? 'BREVO_API_KEY in Railway setzen, dann „Mail-Test" drücken.'
      : (letzteMail && !letzteMail.ok ? 'Schlüssel prüfen und „Mail-Test" drücken.' : ''));

  // 6) Grund-Modus - entscheidet, wie die Druckdatei freigestellt wird
  zeile('Freistellen', 'ok',
    GRUND_MODUS === 'chroma' ? 'Chromagrün - Motiv kommt auf Grün und wird hier freigestellt (erprobt)' : 'Alphakanal - der Bildserver liefert Transparenz selbst',
    '');

  // 7) Tageskontingent
  const heute = counter.day === today() ? counter.n : 0;
  zeile('Heute erzeugt',
    heute > +env.LIMIT_GLOBAL_DAY * 0.9 ? 'warnung' : 'ok',
    `${heute} von ${env.LIMIT_GLOBAL_DAY} Designs`,
    heute > +env.LIMIT_GLOBAL_DAY * 0.9 ? 'Kontingent fast aufgebraucht. LIMIT_GLOBAL_DAY in Railway erhöhen.' : '');

  // 8) Sperre - viele Treffer heissen, dass jemand testet
  const vl = await verbotenLog();
  const letzte24 = vl.filter(e => Date.now() - Date.parse(e.at) < 86400e3).length;
  zeile('Sperre verbotene Zeichen',
    letzte24 > 10 ? 'warnung' : 'ok',
    `${letzte24} Treffer in 24 Stunden, ${vl.length} im Protokoll`,
    letzte24 > 10 ? 'Auffällig viele. Protokoll unter „Verbotene Zeichen & Parolen" ansehen.' : '');

  // 9) Auftragsnummern - die Zahl, auf die sich die Druckerei bezieht. Eine doppelte
  //    Nummer ist der eine Fehler, den man hier nicht machen darf: zwei verschiedene
  //    Auftraege heissen dann gleich, und niemand merkt es, bevor falsch gedruckt wird.
  //    Darum wird nicht nur der Zaehler angezeigt, sondern wirklich nachgezaehlt.
  try {
    const nummern = [];
    for (const f of await fs.readdir(path.join(STORE, 'jobs'))) {
      if (!f.endsWith('.json')) continue;
      try { const j = JSON.parse(await fs.readFile(path.join(STORE, 'jobs', f), 'utf8')); if (+j.lfdNr > 0) nummern.push({ nr: +j.lfdNr, id: j.designId || f }); } catch (e) { /* egal */ }
    }
    nummern.sort((a, b) => a.nr - b.nr);
    const doppelt = [];
    for (let i = 1; i < nummern.length; i++) if (nummern[i].nr === nummern[i - 1].nr) doppelt.push(nummern[i].nr + ' (' + nummern[i - 1].id + ' / ' + nummern[i].id + ')');
    const stand = await laufnummerStart();
    // Luecken sind normal (abgebrochene Auftraege) und kein Fehler - sie gehoeren nur dazugesagt,
    // damit niemand erschrickt, wenn zwischen 41 und 43 die 42 fehlt.
    const luecken = nummern.length ? (nummern[nummern.length - 1].nr - nummern[0].nr + 1) - nummern.length : 0;
    zeile('Auftragsnummern',
      doppelt.length ? 'schlecht' : 'ok',
      doppelt.length
        ? `${doppelt.length} DOPPELT vergeben: ${doppelt.slice(0, 3).join(', ')}`
        : `nächste ist ${stand + 1} · ${nummern.length} vergeben${luecken ? ` · ${luecken} Lücke${luecken > 1 ? 'n' : ''} (abgebrochene Aufträge, normal)` : ''}`,
      doppelt.length ? 'Sofort melden – zwei Aufträge tragen dieselbe Nummer.' : '');
  } catch (e) { /* ohne Auftraege gibt es nichts zu pruefen */ }

  const schlecht = punkte.filter(x => x.stand === 'schlecht').length;
  const warnung = punkte.filter(x => x.stand === 'warnung').length;
  res.json({ gesamt: schlecht ? 'schlecht' : (warnung ? 'warnung' : 'ok'), schlecht, warnung, punkte, stand: new Date().toISOString() });
});

// Druckerei-Zugang: fertiger Link zum Weitergeben. Der Schluessel oeffnet NUR die Druckdaten -
// kein Backend, kein Loeschen, kein Freigeben. "neu" erzeugt einen neuen Schluessel, der alte
// Link ist damit sofort ungueltig (so nimmt man einer Druckerei den Zugang wieder weg).
// Der Link muss so aussehen, wie ihn die Druckerei im Browser braucht. Steht PUBLIC_BASE_URL
// (noch) auf dem lokalen Standard, nehmen wir die Adresse, unter der das Backend gerade
// aufgerufen wurde - so steht im Feld nie ein localhost-Link, den man nicht weitergeben kann.
function druckLink(req, token) {
  let basis = String(env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (!basis || /^https?:\/\/localhost(:|$)/i.test(basis)) {
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    if (host) basis = `${proto}://${host}`;
  }
  return `${basis}/druck?token=${encodeURIComponent(token)}`;
}
app.get('/api/admin/druckzugang', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const d = await druckZugang();
  res.json({ link: druckLink(req, d.token), erstellt: d.erstellt || null });
});
app.post('/api/admin/druckzugang/neu', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  // Ohne Angabe wuerfelt der Server einen Schluessel. Wer lieber ein eigenes Passwort vergibt,
  // schickt es mit - dann steht es im Link und laesst sich auch muendlich weitergeben.
  const wunsch = String((req.body || {}).passwort || '').trim();
  if (wunsch) {
    if (wunsch.length < 8) return res.status(400).json({ error: 'Das Passwort muss mindestens 8 Zeichen haben.' });
    if (wunsch.length > 60) return res.status(400).json({ error: 'Das Passwort ist zu lang (höchstens 60 Zeichen).' });
    if (!/^[A-Za-z0-9_.\-]+$/.test(wunsch)) return res.status(400).json({ error: 'Erlaubt sind Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich – keine Leerzeichen oder Sonderzeichen.' });
    if (istChef(wunsch)) return res.status(400).json({ error: 'Bitte nicht dasselbe Passwort wie für das Backend nehmen.' });
  }
  const d = await druckZugangNeu(wunsch || null);
  console.log('Druckerei-Zugang neu gesetzt - alter Link ist ungueltig');
  res.json({ link: druckLink(req, d.token), erstellt: d.erstellt });
});

// Mail-Test (Chef): sendet eine Test-Mail ueber Brevo und zeigt die EXAKTE Fehlermeldung,
// falls Brevo ablehnt. Aufruf: /api/admin/mail-test?token=<ADMIN_TOKEN>&to=deine@adresse
app.get('/api/admin/mail-test', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const to = String(req.query.to || env.ADMIN_EMAIL || env.MAIL_FROM || '').trim();
  if (!env.BREVO_API_KEY) return res.json({ ok: false, grund: 'BREVO_API_KEY fehlt in Railway' });
  if (!to) return res.json({ ok: false, grund: 'keine Empfaengeradresse (to=... angeben oder ADMIN_EMAIL setzen)' });
  try {
    const r = await mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to, subject: 'Motto Otto – Test-Mail', html: '<p>Das ist eine Test-Mail von Motto Otto. Wenn du sie siehst, funktioniert der Versand. ✅</p>' });
    res.json({ ok: true, gesendet_an: to, absender: env.MAIL_FROM, messageId: r.messageId || null, hinweis: 'Von Brevo angenommen. Wenn nichts ankommt: Spam pruefen, Absender/Domain in Brevo freigeben.' });
  } catch (e) {
    res.json({ ok: false, gesendet_an: to, absender: env.MAIL_FROM, brevo_fehler: String((e && e.message) || e).slice(0, 400) });
  }
});

// Admin: alle Showcase-Eintraege auflisten (mit Bild), um Designs im Backend zu verwalten/loeschen.
// adminGuard wird erst weiter unten definiert -> hier per Wrapper referenzieren (erst bei Anfrage aufrufen).
app.get('/api/admin/showcase', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const sc = await loadShowcase();
  const items = Object.entries(sc).map(([id, e]) => ({
    designId: id, motto: e.motto || '', mottoText: e.mottoText || '', approved: !!e.approved,
    // null = nie gefragt (Automatik), true/false = der Kunde hat selbst entschieden
    kundenwunsch: typeof e.kundenwunsch === 'boolean' ? e.kundenwunsch : null,
    count: e.count || 0, avg: e.count ? +(e.sum / e.count).toFixed(2) : 0, image: showcaseImage(id, anzeigeTextil(e)), dunkel: typeof e.dunkel === 'number' ? e.dunkel : null,
    created: e.created || ''
    // Neueste zuerst, nicht alphabetisch nach Motto. Man will sehen, was GERADE passiert -
    // nach Motto sortiert versteckt das. Fehlt die Zeit bei alten Eintraegen, steckt das
    // Datum in der Design-Nummer (MO-ABI-20260912-...). Beides wird auf EIN Format
    // gebracht, sonst vergleicht man ISO-Zeit gegen Design-Nummer und sortiert Unsinn.
  })).sort((a, b) => zeitSchluessel(b).localeCompare(zeitSchluessel(a)));
  res.json({ designs: items });
});

// Liste: mode=rate (zufaellig, zum Bewerten) | top (bestbewertet)
app.get('/api/mo/showcase', async (req, res) => {
  const mode = req.query.mode === 'top' ? 'top' : 'rate';
  const limit = Math.min(Math.max(+req.query.limit || (mode === 'top' ? 6 : 24), 1), 40);
  const sc = await loadShowcase();
  // Markensperre auch auf den Pool: alte Eintraege mit geschuetztem Namen werden nie mehr gezeigt -
  // ausser bei freigabepflichtigen Mottos (Fanclub): die kommen nur nach Freigabe in den Pool, dann gelten sie
  const alleMottos = await mottos.all();
  const gated = new Set(alleMottos.filter(markenFrei).map(m => m.slug));
  // 21. Sept., Markus (Band "Das hat Otto gezeichnet"): "Bei den ganzen Beschreibungen muesste ja
  // einmal das Motto stehen und in welchem Stil - zum Beispiel Geburt Neon, Jaeger Tattoo."
  // Darum der Name des Mottos je Design (der Spruch allein sagt nicht, wonach man suchen soll).
  const MOTTO_NAME = {};
  for (const m of alleMottos) MOTTO_NAME[m.slug] = m.name || '';
  // 5. Okt., Markus mit Bild ("Anna & Ben" auf Polo und Hoodie): der Name steht in den Feldern des Designs, nicht im Mottotext.
  // Einmal je Design aus dem Auftrag nachgetragen (e.anna), danach gilt der Merker.
  {
    let annaNeu = 0;
    for (const [id, e] of Object.entries(sc)) {
      if (!e || !e.approved || typeof e.anna === 'boolean') continue;
      const j = await readJob(id);
      e.anna = /\bAnna\b/.test(JSON.stringify((j && j.values) || {}) + ' ' + String(e.mottoText || ''));
      annaNeu++;
    }
    if (annaNeu) { try { await saveShowcase(); } catch (e5) { /* naechstes Mal */ } }
  }
  const gewaehlt = Object.entries(sc)
    .filter(([, e]) => e && e.approved && (gated.has(e.motto) || !marken.check(String(e.mottoText || ''))))
    // 4. Okt.: kein Brett vorzeigen (istBrett) - nur Textil-Designs; ein Design fuer Flachware ist vollflaechig gewollt.
    .filter(([, e]) => !(istBrett(e) && !e.artikel))
    // 5. Okt., Markus mit Bild aus dem Band ("Hochzeit - Anna & Ben"): nie "Anna" in unseren eigenen Beispielen (4. Okt.).
    .filter(([, e]) => !e.anna && !/\bAnna\b/.test(String(e.mottoText || '')))
    // 6. Okt., Markus: "du machst mir immer eine Vorauswahl, und ich gebe das frei - anders wird's nicht funktionieren."
    // Band und Bewertung zeigen NUR, was Markus freigegeben hat (bandFrei, /admin/band). ?kandidaten=1 (nur Chef) zeigt
    // alles, was die Regeln durchlassen - fuer meine Vorauswahl.
    .filter(([, e]) => e.bandFrei === true || (String(req.query.kandidaten || '') === '1' && istChef(tokenAus(req))));
  // Der Stil gehoert dazu: sonst sieht man ein schoenes Design und weiss nicht, wonach man suchen soll.
  // Alte Eintraege kennen ihn noch nicht - der wird einmal aus dem Auftrag nachgetragen und bleibt dann stehen.
  let nachgetragen = 0;
  for (const [id, e] of gewaehlt) {
    if (e.style) continue;
    const j = await readJob(id);
    e.style = (j && j.style) || 'standard';
    nachgetragen++;
  }
  if (nachgetragen) { try { await saveShowcase(); } catch (e) { /* nicht schlimm */ } }
  const STIL_NAME = {};
  for (const st of stylesForAdmin()) STIL_NAME[st.key] = st.label;
  // 21. Sept., Markus: "quer durch alle Artikel ... abwechslungsreich Handtuecher, T-Shirts, Hoodies,
  // auch mal von hinten mit Namensliste." vielfalt=1 (Startseite): das Teil wechselt je Design
  // durch die Artikel des Mottos, in Benutzung, wo es eine Situation gibt; Designs mit Rueckseite
  // jedes dritte Textil von hinten. Ob ein Design eine Rueckseite hat, wird einmal aus dem
  // Auftrag nachgetragen und bleibt dann im Pool stehen.
  const vielfalt = String(req.query.vielfalt || '') === '1';
  if (vielfalt) {
    for (const [id, e] of gewaehlt) {
      if (e.back !== undefined) continue;
      const j = await readJob(id);
      e.back = !!(j && j.back && j.back.count);
      nachgetragen++;
    }
    if (nachgetragen) { try { await saveShowcase(); } catch (e) { /* nicht schlimm */ } }
  }
  // 22. Sept., 07:01, Markus (Screenshot, Band nur mit Beutel, Shirt, Hoodie): "Warum sind hier
  // schon wieder nicht alle Artikel, die wir besprochen haben?" Das Band zog 24 Designs zufaellig
  // aus gut 230 - die paar, die fuer Kissen, Handtuch, Mousepad oder Hundedecke gezeichnet sind,
  // kamen so gut wie nie dran. Jetzt: fuer welchen Artikel ein Design gezeichnet ist, wird einmal
  // aus dem Auftrag nachgetragen und bleibt im Pool stehen; das Band nimmt zuerst je Artikel ein
  // eigenes Design und verteilt sie gleichmaessig zwischen die Shirt-Designs.
  // 5. Okt.: auch fuer die Bewertung (Markus mit Bild: ein Strandtuch-Design auf einem Shirt) - der Artikel muss bekannt sein.
  {
    for (const [id, e] of gewaehlt) {
      // 22. Sept.: dazu, ob das Design QUER gezeichnet wurde (bestelltes Mass) - die Fussmatte
      // liegt seit heute quer, ein hochkant gezeichnetes Design darauf waere gequetscht.
      // artikelV 2 (4. Okt.): alle Eintraege einmal neu lesen - bis dahin stand bei jedem Design aus einer
      // gespeicherten Datei artikel '' (siehe artikelVon), auch beim Strandtuch-Design.
      if (e.artikelV === 2 && e.artikel !== undefined && (e.artikelQuer !== undefined || !e.artikel)) continue;
      const j = await readJob(id);
      const aj = artikelVon(j);
      let g = '';
      try { g = aj && aj.id ? (ansichtVon(aj.id) || '') : ''; } catch (e2) { g = ''; }
      // Textil bleibt Textil (laeuft durch alle Textilien); ein anderer Artikel nur auf sich selbst; ein Artikel
      // ohne Vorlage ('-') wird gar nicht gezeigt - nie ersatzweise auf einem Shirt.
      e.artikel = ['tee', 'hoodie', 'zip', 'polo', 'beutel'].includes(g) ? '' : GARMENTS[g] ? g : (aj && aj.id ? '-' : '');
      e.artikelV = 2;
      const netto = aj && Array.isArray(aj.netto) ? aj.netto : null;
      e.artikelQuer = e.artikel && netto && netto[0] > 0 && netto[1] > 0 ? (netto[0] >= netto[1]) : null;
      nachgetragen++;
    }
    if (nachgetragen) { try { await saveShowcase(); } catch (e) { /* nicht schlimm */ } }
  }
  // Ein Artikel-Design passt nur, wenn sein Format zum Artikel passt (quer zu quer, hoch zu hoch).
  const formatPasst = (g, quer) => { const f = GARMENTS[g] && GARMENTS[g].flaecheCm; return quer === null || quer === undefined || !Array.isArray(f) || (f[0] >= f[1]) === quer; };
  const mischen = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [arr[i], arr[k]] = [arr[k], arr[i]]; } return arr; };
  let items = gewaehlt
    .map(([id, e]) => ({ designId: id, motto: (e.mottoText && e.mottoText !== e.motto) ? e.mottoText : (MOTTO_NAME[e.motto] || e.motto || ''), mottoName: MOTTO_NAME[e.motto] || '', slug: e.motto || '', back: !!e.back, textile: anzeigeTextil(e), bestellt: e.textile, artikel: e.artikel || '', count: e.count || 0, avg: e.count ? +(e.sum / e.count).toFixed(2) : 0, image: showcaseImage(id, anzeigeTextil(e)), stil: STIL_NAME[e.style] || '' }))
    // 22. Sept., Markus: kein Hochzeitsmotiv auf der Hundedecke - ein Artikel-Design wird nur
    // vorgezeigt, wenn das Motto zum Artikel passt (ARTIKEL_MOTTOS in mockups.js).
    .filter(x => bandBildPruefen((sc[x.designId] || {}).bandBild) || (x.artikel !== '-' && (!x.artikel || (passtVorzeige(x.artikel, x.slug) && formatPasst(x.artikel, (sc[x.designId] || {}).artikelQuer)))));
  // 5. Okt., Markus (Bilder der Bewertung: lauter schwarze Shirts, ein Strandtuch-Design auf einem Shirt, "freestyle" klein
  // geschrieben): "Bei den Bewertungen musst du natuerlich dann auch noch mal aufraeumen." Bewertet wird nur, was wir auch zeigen
  // wuerden: Textil-Designs (kein Design fuer Tuch, Kissen ...), sichtbar auf seinem Stoff (brett.js zeigbar), Schwarz hoechstens 10 %.
  if (!vielfalt) {
    items = items.filter(x => !x.artikel && zeigbarAuf(sc[x.designId], istHell(x.textile) ? 'weiss' : 'schwarz'));
    const hell = items.filter(x => istHell(x.textile)), dunkel = items.filter(x => !istHell(x.textile));
    items = hell.concat(mischen(dunkel).slice(0, Math.floor(hell.length / 9)));
  }
  if (mode === 'top') items = items.filter(x => x.count >= 1).sort((a, b) => (b.avg - a.avg) || (b.count - a.count)).slice(0, limit);
  // Je Artikel ein eigenes Design, gleichmaessig zwischen den Shirt-Designs - reine Rechnung in
  // mockups.js (bandAuswahl), die Abnahme misst sie.
  // 5. Okt. nachmittags: seit das Band nicht mehr selbst faerbt, fiel nach der Auswahl der 24 das meiste raus (Designs fuer
  // dunkles Textil, Schwarz hoechstens 10 %; nicht zeigbar) - live standen 5 bis 7 Bilder da. Vorher aussortieren, was auf
  // seinem Stoff nicht zeigbar ist, mehr Kandidaten nehmen und unten aufhoeren, sobald 'limit' Bilder fertig sind.
  else if (vielfalt) {
    // 6. Okt.: was Markus als festes Bild freigegeben hat (bandBild), steht vorn und laeuft genau so - seine Freigabe gilt.
    const istFest = x => !!bandBildPruefen((sc[x.designId] || {}).bandBild);
    const fest = mischen(items.filter(istFest));
    items = items.filter(x => !istFest(x) && (x.artikel || zeigbarAuf(sc[x.designId], istHell(x.textile) ? 'weiss' : 'schwarz') || x.slug === 'karneval'));
    const vorne = bandAuswahl(items, limit);   // Artikel gleichmaessig verteilt wie bisher
    items = fest.concat(vorne, mischen(items.filter(x => !x.artikel && !vorne.includes(x))).slice(0, limit * 3));   // Ersatz, falls vorne etwas wegfaellt
  }
  else items = mischen(items).slice(0, limit);
  if (vielfalt) {
    // 00:36, Markus: "Kacheln leer - das sieht einfach scheisse aus. Kuemmer dich drum, dass
    // Kacheln nie leer sind und ewig brauchen." Regel: das Band bekommt nur Bilder, die FERTIG
    // auf der Platte liegen. Das gewuenschte Teil, sonst dasselbe sachlich, sonst das T-Shirt;
    // was fehlt, wird im Hintergrund gebaut und ist beim naechsten Aufruf da. Nichts wird
    // ausgeliefert, was der Browser erst rechnen lassen muesste.
    const fertige = [];
    // Ein Motto mit festem Artikel (Postkarte) gehoert nicht auf Shirt, Tuerschild oder Tasse -
    // live stand "Gruesse aus" auf einem Tuerschild im Band. Die Postkarte hat ihren Aufmacher.
    const festArtikel = new Set(alleMottos.filter(m => m.artikelFest).map(m => m.slug));
    // 4. Okt., Markus: "den Anteil an schwarzen Textilien auf nur noch 20 % begrenzen und ... andere Farben einsetzen ...
    // so dass es zum Design hervorragend passt". Abends verschaerft: "Ich moechte sie nicht mehr ... nur noch 10 % von mir aus".
    // Hoechstens 10 % der Textil-Bilder schwarz; die Farbe je Design aus der
    // Messung (brett.js besteFarbe: gut sichtbar, Farbton passend), nur auf T-Shirt und Polo, nur wo die Vorlage sich
    // sauber einfaerben laesst. Ein Design fuer dunkles Textil ohne passende Farbe faellt raus, wenn Schwarz voll ist.
    let schwarzN = 0, bandLinieNr = Math.floor(Math.random() * 3);
    const farbZahl = {};
    const streu = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
    // 5. Okt. abends: live dreimal "Steffi 40", dreimal "Hamburg/Lars" - je Motiv-Text nur ein Bild (Ersatz ist genug da).
    const schonText = new Set();
    for (let i = 0; i < items.length && fertige.length < limit; i++) {
      const x = items[i];
      if (festArtikel.has(x.slug)) continue;
      const bb = bandBildPruefen((sc[x.designId] || {}).bandBild);
      if (bb) {
        const printB = istHell(x.bestellt) ? 'hell' : 'dunkel';
        if (!(await mockupLiegtDa(x.designId, bb.teil, bb.color, printB, { szene: bb.szene, back: !!bb.seite, linie: bb.linie, farbe: bb.farbe }))) { mockupNachbauen(bandBildUrl(x.designId, bb)); continue; }
        x.teil = bb.teil; x.seite = bb.seite; x.image = bandBildUrl(x.designId, bb);
        if (bb.farbe) { x.farbe = bb.farbe; x.farbName = TEXTIL_FARBEN[bb.farbe].name[bb.teil] || ''; }
        if (bb.linie) { const lb = linieBeschriftung(bb.linie, bb.teil); if (lb) { x.linieName = lb.text; x.stufe = lb.stufe; } }
        fertige.push(x);
        continue;
      }
      const textSchluessel = String(x.motto || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim();
      if (textSchluessel && schonText.has(textSchluessel)) continue;
      // 5. Okt., Markus (Band: "Abi - Japan auf Shirt", daneben dasselbe auf dem Hoodie): "fuer Abi haben wir doch ganz
      // klar abgesprochen, dass wir eine Frontseite und eine Rueckseite machen ... boring". Beim Abi stehen hinten die
      // Namen (2. Okt.) - das Band zeigt ein Abi-Design darum mit seiner Rueckseite, und eins ohne Namensliste gar nicht.
      const abiRuecken = x.slug === 'abi';
      if (abiRuecken && !x.back) continue;
      // 21. Sept., 19:52, Markus: "Wir muessen alles zeigen, was wir haben. Wir haben noch kein
      // einziges Mauspad drin, da ist kein Handtuch drin - das ist alles sehr halbherzig." Bisher
      // nahm das Band nur die je Motto freigeschalteten Artikel (Jaeger: Shirt, Hoodie, Tasse).
      // Jetzt laeuft jedes Design durch ALLE Artikel, fuer die es eine Vorlage gibt - genau das
      // ist der erste Weg: ein Design, das auf jeden Artikel kommt.
      // 21:00, Markus: "muss auch fuer diesen Artikel 100 % entworfen sein ... nicht einfach ein
      // fertiges Design genommen werden." Ein fuer einen Artikel gezeichnetes Design laeuft auf
      // GENAU diesem Artikel; ein Shirt-Design nur auf Textilien mit Brustdruck.
      let teile = ['tee', 'hoodie', 'zip', 'polo', 'beutel'];
      if (x.artikel && GARMENTS[x.artikel]) teile = [x.artikel];
      // 5. Okt., Markus mit Bild (Fanclub fotorealistisch als Briefmarke auf einem gelben Polo): ein Polo traegt nur ein kleines
      // Brustemblem - dort hat nur ein schlichtes Motiv Platz (Regel 9b.6 Feinheit). Detailreiche Stile nie aufs Polo.
      // Nachgemessen am Live-Band (5. Okt.): auch schlichte Embleme sind auf dem Polo unlesbar klein - das Polo laeuft nicht mehr im Band.
      if (!x.artikel) teile = teile.filter(g => g !== 'polo');
      let color = istHell(x.textile) ? 'white' : 'black';
      const print = istHell(x.bestellt) ? 'hell' : 'dunkel';   // so heisst die Datei (die Route rechnet mit dem Auftrag)
      let farbe = '';
      if (!x.artikel && !abiRuecken) {
        // 5. Okt. nachmittags, Markus: "Die farbigen Sachen gefallen mir ueberhaupt nicht" - das Band zeigt nur noch Weiss
        // (und hoechstens 10 % Schwarz). Bestellen in Farbe bleibt frei (bestellFarben).
        // Ausnahme Karneval (Markus: "Karneval darf farbig sein das Textil").
        const kand = (BAND_FARBIG || x.slug === 'karneval') ? besteFarbe((sc[x.designId] || {}).farbMessung, FARB_HEX) : null;
        const h = streu(x.designId);
        // Abwechslung: unter den gut sichtbaren Farben (Reihenfolge = Passung) die, die im Band noch selten ist.
        const wahl = kand ? kand.map((k, r) => ({ k, p: r + 1.5 * (farbZahl[k] || 0) + (h % 7) / 10 })).sort((a, b) => a.p - b.p)[0].k : '';
        if (color === 'black') {
          // Schwarz nur, solange es danach hoechstens 10 % der GEZEIGTEN Bilder sind (4. Okt. abends, Markus: "nur noch 10 %") (nicht der geplanten - fertig ist anfangs nur ein Teil).
          if ((schwarzN + 1) > 0.1 * (fertige.length + 1) || (wahl && h % 2)) { if (!wahl) continue; farbe = wahl; }
        } else if (wahl && h % 3) farbe = wahl;
        if (farbe) color = 'white';
      }
      const bereit = []; for (const g of teile) if ((!farbe || FARB_TEILE.includes(g)) && await templateReady(g, color)) bereit.push(g);
      const w = schaufensterTeil(bereit.length ? bereit : ['tee'], i, farbe ? false : x.back);
      if (abiRuecken) { if (!['tee', 'hoodie', 'zip', 'polo'].includes(w.garment)) w.garment = 'tee'; w.side = 'back'; }
      // Gefaerbt wird nur, was sauber geht: das T-Shirt in der Szene des Mottos (sonst das Herstellerfoto), das Polo als Herstellerfoto.
      let szeneTh = farbe && w.garment === 'tee' ? await szeneThemaFuer('tee', 'white', x.slug) : '';
      if (szeneTh && !(await faerbMaske(path.join(STORE, 'templates'), 'tee-szene-thema-' + szeneTh))) szeneTh = '';   // Szene nicht sauber faerbbar: Herstellerfoto
      const szene = !w.side && (farbe ? !!szeneTh : await szeneMoeglich(w.garment, color));
      // 6. Okt., Markus: "Mal was von Roly, mal was von Stanley/Stella und das auch dazuschreiben." Jedes zweite Bild ist das
      // Herstellerfoto statt der Szene, die Linie reihum (B&C, Stanley/Stella, Roly - wo es fuer Teil und Farbe ein Foto gibt).
      // Die Szene ist kein Herstellerfoto und bekommt darum keine Marke.
      const linienHier = [];
      if (!farbe && !abiRuecken) for (const l of BAND_LINIEN) if (await linieVorlageDa(l, w.garment, color)) linienHier.push(l);
      const linieW = linienHier.length ? linienHier[bandLinieNr % linienHier.length] : '';
      const flachZuerst = !!linieW && (i % 2 === 0 || !szene);
      const url = (g, sz, side, li) => x.image.replace(/\/tee\/(black|white)\.jpg/, '/' + g + '/' + color + '.jpg') + (sz ? '&szene=1' : '') + (side ? '&side=back' : '') + (farbe ? '&farbe=' + farbe : '') + (li && !sz ? '&linie=' + li : '');
      const kandidaten = farbe ? [[w.garment, szene, ''], [w.garment, false, '']]
        : abiRuecken ? [[w.garment, false, 'back'], ['tee', false, 'back']]
        : (flachZuerst ? [[w.garment, false, w.side, linieW], [w.garment, szene, w.side]] : [[w.garment, szene, w.side], [w.garment, false, w.side, linieW]])
          .concat([['tee', await szeneMoeglich('tee', color), ''], ['tee', false, '']]);
      let gewaehlt = null;
      for (const [g, sz, side, li] of kandidaten) {
        if (await mockupLiegtDa(x.designId, g, color, print, { szene: sz, back: !!side, farbe, linie: li || '' })) { gewaehlt = [g, sz, side, li || '']; break; }
      }
      // Das Gewuenschte fehlt: im Hintergrund bauen lassen (ueber die Route, gleicher Cache).
      if (!gewaehlt || gewaehlt[0] !== w.garment || (flachZuerst && gewaehlt[3] !== linieW)) mockupNachbauen(flachZuerst ? url(w.garment, false, w.side, linieW) : url(w.garment, szene, w.side));
      if (!gewaehlt) continue;   // gar nichts fertig - dann lieber weglassen als leer zeigen
      // 5. Okt., Markus mit drei Bildern aus dem Band ("Das ist nicht dein Ernst, mir sowas anzubieten"): blaues Wappen auf
      // rotem Polo, weisse Schrift auf weisser Zip-Jacke, Bowling-Motiv im gezeichneten Kasten auf dem Beutel. Jedes
      // Textil-Bild muss jetzt durch brett.js zeigbar(): sichtbar (auch feine Schrift), kein Farbbiss, kein Rahmen, Rot nur
      // fuer weisse Motive. Ohne neue Messung wird nicht gezeigt.
      if (!x.artikel && !zeigbarAuf(sc[x.designId], stoffVon(color, farbe, gewaehlt[0]))) continue;
      if (color === 'black' && !x.artikel) schwarzN++;
      x.teil = gewaehlt[0]; x.seite = gewaehlt[2]; x.image = url(gewaehlt[0], gewaehlt[1], gewaehlt[2], gewaehlt[3]);
      // Auch der Ersatzweg (flach ohne linie) zeigt ein Herstellerfoto - das der Vorgabe-Linie (B&C), wo es eins gibt.
      const linieG = gewaehlt[1] || farbe ? '' : (gewaehlt[3] || (await linieVorlageDa(LINIE_STANDARD, gewaehlt[0], color) ? LINIE_STANDARD : ''));
      if (linieG) { const lb = linieBeschriftung(linieG, gewaehlt[0]); if (lb) { x.linieName = lb.text; x.stufe = lb.stufe; if (gewaehlt[3]) bandLinieNr++; } }
      if (farbe) { x.farbe = farbe; x.farbName = TEXTIL_FARBEN[farbe].name[gewaehlt[0]] || ''; farbZahl[farbe] = (farbZahl[farbe] || 0) + 1; }
      fertige.push(x);
      if (textSchluessel) schonText.add(textSchluessel);
    }
    for (const x of fertige) x.image = await reinWennDa(x.image);   // 9. Okt.: ohne Wasserzeichen, sobald die saubere Fassung da ist
    items = fertige;
  }
  // 22. Sept., Markus: "wenn ich auf diese Bilder tippe, die da so lang laufen, dann muesste ich
  // ja sofort auf den Artikel, auf das Motto und auf den Stil kommen. Nicht irgendwohin."
  // Das Band konnte das bisher gar nicht: "motto" ist der TEXT des Designs, nicht der Slug,
  // "stil" das Label, nicht der Schluessel - beides taugt nicht als Adresse, und der Slug wird
  // unten sogar weggeschnitten. Also baut der Server das Ziel fertig, genau wie bei den
  // Anlass-Kacheln: Motto, Stil, Textilfarbe und das gezeigte Teil stehen drin, damit die
  // Mottoseite genau das vorbelegt, was die Kachel versprochen hat.
  for (const x of items) {
    if (!x.slug) { x.ziel = '/mottos'; continue; }
    const stilKey = (sc[x.designId] || {}).style || '';
    const p = new URLSearchParams();
    if (stilKey) p.set('stil', stilKey);
    p.set('textil', istHell(x.textile) ? 'hell' : 'dunkel');
    if (x.artikel) p.set('artikel', x.artikel);
    else if (x.teil) p.set('teil', x.teil);
    if (x.stufe) p.set('stufe', x.stufe);   // 6. Okt.: die Linie des Bildes ist im Motto vorgewaehlt
    x.ziel = '/m/' + encodeURIComponent(x.slug) + '?' + p.toString();
  }
  res.json({ designs: items.map(({ slug, back, textile, bestellt, artikel, ...rest }) => rest) });
});

// Bewerten (1-5 Sterne), eine Bewertung je Besucher und Design
app.post('/api/mo/rate', async (req, res) => {
  const id = String((req.body || {}).designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const stars = Math.round(+(req.body || {}).stars);
  if (!id || !(stars >= 1 && stars <= 5)) return res.status(400).json({ error: 'ungueltig' });
  const sc = await loadShowcase();
  const e = sc[id];
  if (!e || !e.approved) return res.status(404).json({ error: 'unbekannt' });
  const who = await identify(req, res);
  const sid = String((who.user && who.user.id) || who.guestId || 'anon').replace(/[^A-Za-z0-9_-]/g, '');
  await fs.mkdir(path.join(STORE, 'rated'), { recursive: true });
  const ratedFile = path.join(STORE, 'rated', sid + '.json');
  let rated = []; try { rated = JSON.parse(await fs.readFile(ratedFile, 'utf8')); } catch (e2) { rated = []; }
  if (rated.includes(id)) return res.json({ ok: true, already: true, avg: e.count ? +(e.sum / e.count).toFixed(2) : 0, count: e.count || 0 });
  e.count = (e.count || 0) + 1; e.sum = (e.sum || 0) + stars; sc[id] = e; await saveShowcase();
  rated.push(id); await fs.writeFile(ratedFile, JSON.stringify(rated.slice(-500)));
  res.json({ ok: true, avg: +(e.sum / e.count).toFixed(2), count: e.count });
});

// ---------- Backend ----------
const adminGuard = (req, res, next) => {
  const t = req.query.token || req.get('x-admin-token');
  if (!env.ADMIN_TOKEN || t !== env.ADMIN_TOKEN) return res.status(403).json({ error: 'kein Zugang' });
  next();
};

// Ein Vorzeige-Bild im Server selbst zeichnen lassen - derselbe Weg wie bei einem Kundendesign
// (Prompt aus mottos.js, groesste legale Leinwand, eingestellte Stufe und Modell), nur ohne
// Auftrag, ohne Namen und ohne Logo. Das ist der Unterschied zwischen "jemand laesst von Hand
// ein Werkzeug laufen und traegt eine URL nach" und "Knopf im Backend".
async function vorzeigeBildZeichnen({ motto, style, values, textile }) {
  const werte = { ...(values || {}) };
  const variation = pickVariation(motto, { styled: !!(style && style !== 'standard') });
  const prompt = buildPrompt(motto, werte, { style, colors: '', variation, textile: textile || 'schwarz', nameZone: '' });
  const size = grosseLeinwand(motto.size);
  for (let versuch = 1; versuch <= 2; versuch++) {
    try {
      const t = Date.now();
      const gen = await generateViaBallz(env.BALLZ_MCP_URL, { prompt, size, quality: bildStufe(motto), model: bildModell() });
      console.log('Vorzeige-Bild', motto.slug, style, size, bildStufe(motto), Math.round((Date.now() - t) / 1000) + ' s');
      return { png: gen.png, prompt };
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      // Gleiche Regel wie im Auftrag: lehnt der Bilddienst die Stufe ab, gilt ab jetzt 'high'.
      if (versuch === 1 && /quality/i.test(msg) && /(ung[üu]ltig|nur bei|erlaubt|invalid|not supported)/i.test(msg) && bildStufe(motto) !== 'high') {
        console.warn('Bildstufe', bildStufe(motto), 'abgelehnt - ab jetzt "high":', msg.slice(0, 160));
        STUFE_RUECKFALL = 'high';
        continue;
      }
      throw e;
    }
  }
  throw new Error('Bild konnte nicht erzeugt werden');
}

// Vorzeige-Designs (Stil-Galerie je Motto): Routen /api/mo/stilbeispiel/..., /api/admin/vorzeige..., Autoimport aus vorzeige-designs.json
// Die Bildarbeit danach (Master 4096 px) ist speicherhungrig - sie zaehlt in dieselbe kleine
// Schlange wie die Kundendesigns, damit ein Backend-Klick den Container nicht umwirft.
const vorzeige = mountVorzeige(app, {
  STORE, mottos, env, adminGuard, makeMaster, makePreview, makeMockup, pushToDrive, newId, STYLE_KEYS,
  onImported: () => syncVorzeigeShowcase(),
  erzeugeBild: (a) => mitBildarbeit('Vorzeige ' + a.motto.slug, () => vorzeigeBildZeichnen(a)),
  mitBildarbeit, szeneMoeglich
});
const produkte = mountProdukte(app, { STORE, mottos, adminGuard, GARMENTS });
// Textil-Linie: Herstellerfotos holen und ablegen (/api/mo/textil/..., /api/admin/textil-linie)
mountTextilBilder(app, { STORE, adminGuard });

// Mockup-Vorlagen selbst erzeugen (Produktansicht + Situation je Artikel).
// Der Bilddienst liefert bei task 'design' immer einen durchsichtigen Hintergrund. Fuer eine
// freigestellte Flachware ist das genau richtig - daraus wird die Druckflaeche gemessen. Fuer
// eine Situation waere es falsch: dort GEHOERT die Umgebung ins Bild, sonst sieht man das
// Handtuch nicht am Strand liegen. Deshalb hier zwei Wege statt einem.
async function vorlagenBildZeichnen({ prompt, freigestellt }) {
  // 27. Sept., live: "Vorlage beutel-szene_black gescheitert: motto is not defined" - hier gibt es
  // kein Motto, eine Vorlage gehoert zu keinem. bildStufe() ohne Motto nimmt die Backend-Stufe.
  const gen = freigestellt
    ? await generateViaBallz(env.BALLZ_MCP_URL, { prompt, size: '1024x1024', quality: bildStufe(), model: bildModell() })
    : await generateViaBallz(env.BALLZ_MCP_URL, { prompt, size: '1024x1024', quality: bildStufe(), model: bildModell(), task: 'photo' });
  return gen.png;
}
mountVorlagen(app, { STORE, adminGuard, mitBildarbeit, erzeugeVorlagenBild: vorlagenBildZeichnen });
// Leere Namensliste zum Ausfuellen: /api/mo/namensliste/<motto>.xlsx (Kopf, nummerierte Zeilen, Auswahllisten)
mountNamensliste(app, { mottos, produkte, GARMENTS });

// Teile mit Konfektionsgroessen, die dieses Motto anbietet - fuer die Auswahl in der Namensliste
// (auf der Seite wie in der Excel-Vorlage dieselbe Quelle). Zubehoer ohne Groessen bleibt draussen.
// Kaufformen (Druckdatei / DTF-Transfer / fertiges Teil): Preise im Backend, Anfrage per Mail,
// bis der Warenkorb steht.
const kaufformen = mountKaufformen(app, { STORE, mottos, produkte, GARMENTS, adminGuard, readJob, mailLogged, env, identify, accounts });

function artikelFuer(slug) {
  try {
    return produkte.enabledFor(slug).filter(k => GARMENTS[k] && GARMENTS[k].sizes !== false).map(k => GARMENTS[k].label);
  } catch (e) { return Object.keys(GARMENTS).filter(k => GARMENTS[k].sizes !== false).map(k => GARMENTS[k].label); }
}

// Konsens-Design: nach Fristende aus allen Kommentaren einer Abstimmung eine
// gemeinsame "Art Direction" ableiten und daraus automatisch EIN neues Design erzeugen.
// Wird von der Abstimmung beim Schliessen aufgerufen. Standardmaessig aktiv (KONSENS_AUTO!='off').
// ---------- Fassung 90: sieht man das Design auf dem Stoff ueberhaupt? ----------
// Markus, 18. Sept., mit einem Bild: "So ist das neue erzeugte Design gekommen. Das macht
// gerade keinen Spasz. Nichts funktioniert."
// Gemessen: mittlere Helligkeit 27 von 255, null Prozent helle Anteile. Der schwarze Stoff
// selbst liegt bei 25 bis 40. Das Design war also DUNKLER als das Shirt - unsichtbar.
// Der Prompt sagt zwar "all lettering light" auf dunklem Textil, aber eine Konsens-Anweisung
// wie "weniger knallig" (aus dem Gruppen-Feedback) kann das aushebeln. Gegen so etwas hilft
// keine weitere Zeile im Prompt, sondern nur Nachmessen am fertigen Bild.
// Die Regel ist einfach und hat keine Geschmacksfrage: auf dunklem Stoff braucht ein Druck
// helle Flaechen, auf hellem Stoff dunkle. Sonst sieht der Kunde nichts.
async function textilKontrast(png, textile) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, summe = 0, hell = 0, dunkel = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;                       // durchsichtig gehoert nicht zum Druck
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n++; summe += l;
    if (l > 110) hell++;
    if (l < 90) dunkel++;
  }
  if (!n) return { leer: true, ok: false, grund: 'Das Bild ist vollstaendig durchsichtig' };
  const hellAnteil = hell / n, dunkelAnteil = dunkel / n, mittel = summe / n;
  // 8 % sind knapp bemessen und mit Absicht: eine feine helle Kontur reicht, um ein Motiv
  // lesbar zu machen. Es geht nur darum, das voellig Unsichtbare abzufangen.
  const ok = istHell(textile) ? dunkelAnteil >= 0.08 : hellAnteil >= 0.08;
  return {
    ok, mittel: Math.round(mittel),
    hellProzent: +(hellAnteil * 100).toFixed(1), dunkelProzent: +(dunkelAnteil * 100).toFixed(1),
    grund: ok ? '' : (istHell(textile)
      ? `Auf hellem Stoff fast nichts Dunkles: nur ${(dunkelAnteil * 100).toFixed(1)} % dunkle Flaeche (mittlere Helligkeit ${Math.round(mittel)})`
      : `Auf dunklem Stoff fast nichts Helles: nur ${(hellAnteil * 100).toFixed(1)} % helle Flaeche (mittlere Helligkeit ${Math.round(mittel)})`)
  };
}

// Welche Druckflaeche hatte ein fertiges Design? Steht sie nicht im Datensatz (alles vor
// Fassung 90), steht sie trotzdem in der Druckdatei: die liegt in echten Zentimetern bei
// 300 dpi. Pixel durch 300 mal 2,54 ergibt das bestellte Mass, und das steht in
// PRINT_PLACEMENTS. Eine halbe Zentimeter Toleranz reicht - die Masse liegen weit auseinander.
async function flaecheAusDruckdatei(designId) {
  try {
    const m = await sharp(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`)).metadata();
    if (!m.width || !m.height) return '';
    const cmB = m.width / PRINT_DPI * 2.54, cmH = m.height / PRINT_DPI * 2.54;
    // Die Druckdatei wird in die Flaeche EINGEPASST (fit: 'inside' in makeMaster), nicht auf sie
    // aufgefuellt. Sie beruehrt die Flaeche deshalb nur an EINER Seite - die andere ist so breit
    // oder hoch, wie das Motiv eben ist. An Markus' echter Datei: 3630x5433 px sind 30,7 x 46,0 cm.
    // Die Hoehe trifft die 46 cm auf den Millimeter, die Breite trifft nichts.
    // Gesucht ist also die kleinste Flaeche, in die das Motiv hineinpasst und deren eine Seite es
    // ausfuellt. "Beide Seiten muessen passen" waere falsch und haette nie getroffen.
    const T = 0.5;
    let treffer = '', besteFlaeche = Infinity, besteGuete = 1;
    for (const [key, p] of Object.entries(PRINT_PLACEMENTS)) {
      const t = /([\d,.]+)\s*[x×]\s*([\d,.]+)/.exec(p.mass || '');
      if (!t) continue;
      const b = parseFloat(t[1].replace(',', '.')), h = parseFloat(t[2].replace(',', '.'));
      if (cmB > b + T || cmH > h + T) continue;                 // passt gar nicht hinein
      const trifftB = Math.abs(b - cmB) <= T, trifftH = Math.abs(h - cmH) <= T;
      if (!trifftB && !trifftH) continue;                        // fuellt keine Seite aus
      // Treffen beide Seiten, ist es eindeutig - das schlaegt einen Treffer auf nur einer Seite.
      // Sonst gewinnt die kleinste passende Flaeche: ein 10x5-Motiv gehoert in den Nacken
      // (10x5) und nicht auf die Brust (10x10), in die es ebenfalls hineinpasste.
      const guete = trifftB && trifftH ? 0 : 1;
      const flaeche = b * h;
      if (guete < besteGuete || (guete === besteGuete && flaeche < besteFlaeche)) {
        besteGuete = guete; besteFlaeche = flaeche; treffer = key;
      }
    }
    if (treffer) console.log('Druckflaeche aus der Druckdatei erkannt:', designId, '->', treffer,
      `(${cmB.toFixed(1)} x ${cmH.toFixed(1)} cm)`);
    else console.log('Druckflaeche nicht erkannt:', designId, `(${cmB.toFixed(1)} x ${cmH.toFixed(1)} cm)`,
      '- es gilt die Vorgabe des Mottos');
    return treffer;
  } catch (e) { return ''; }
}

async function consensusDesign(poll, tal, opts = {}) {
  if (String(env.KONSENS_AUTO || 'on') === 'off') return null;
  if (poll.konsensDesignId) return null; // nur einmal je Abstimmung
  const motto = withBezug(await mottos.get(poll.motto));
  if (!motto || motto.active === false) return null;

  // Gewinner (bester Sterneschnitt) als Basis; sonst erstes Design
  const winnerId = (tal.winners && tal.winners[0]) || poll.designIds[0];
  const baseJob = await readJob(winnerId);
  if (!baseJob) return null;

  // ---- Auf WELCHEM Textil entsteht das Konsens-Design? ----
  // Markus, 18. Sept.: "Das Design war von vornherein auf helles Textil eingestellt, dann musst
  // du das doch mit uebernehmen."
  // Genommen wird die Einstellung des Gewinner-Designs. Fehlt sie dort - etwa bei einem
  // Design aus einer aelteren Fassung, die das noch nicht mitgeschrieben hat -, wurde bisher
  // stillschweigend 'dunkel' angenommen. Aus "wir wissen es nicht" wurde also "schwarz", und
  // niemand erfuhr davon. Jetzt: erst bei den uebrigen Designs der Abstimmung nachsehen, und
  // was am Ende gilt, steht im Protokoll und im Datensatz der Abstimmung.
  let textilQuelle = 'Gewinner-Design';
  const tonDa = (t) => TEXTILTOENE.includes(String(t || '').toLowerCase());
  let textil = tonDa(baseJob.textile) ? baseJob.textile : '';
  if (!textil) {
    for (const d of poll.designIds) {
      const j = await readJob(d);
      if (j && tonDa(j.textile)) { textil = j.textile; textilQuelle = 'anderes Design der Abstimmung (' + d + ')'; break; }
    }
  }
  if (!textil) { textil = 'schwarz'; textilQuelle = 'Notbehelf - kein Design der Abstimmung hatte eine Textil-Angabe'; }
  // Ausdruecklicher Wunsch beim Neuerzeugen schlaegt alles.
  if (tonDa(opts.textile)) { textil = opts.textile; textilQuelle = 'von Hand gewaehlt'; }
  console.log('Konsens-Design fuer Abstimmung', poll.id, '- Textil:', textil, '(' + textilQuelle + ')');

  // Alle Kommentare einsammeln: je Design + Gesamt
  const lines = [];
  for (let i = 0; i < poll.designIds.length; i++) {
    const d = poll.designIds[i];
    for (const c of (tal.designComments[d] || [])) lines.push(`Zu Design ${i + 1}: ${c.text}`);
  }
  for (const c of (tal.comments || [])) lines.push(c.text);
  if (!lines.length) return null; // ohne Feedback kein Konsens-Design
  const feedback = lines.join('\n').slice(0, 2000);

  // Aus dem Feedback eine knappe, konkrete Art-Direction (englisch) ableiten
  let note = '';
  if (HAS_LLM) {
    try {
      const r = await openai.chat.completions.create({
        model: env.QA_MODEL,
        messages: [{ role: 'user', content: `Das ist Feedback (deutsch) einer Gruppe zu Design-Entwuerfen fuer das Motto "${motto.name}". Fasse den gemeinsamen Nenner in EINER knappen, konkreten Art-Direction-Anweisung auf Englisch zusammen (max. 40 Woerter), die beschreibt, wie eine neue, verbesserte Version aussehen soll. Nur die Anweisung, kein Vorwort, keine Anfuehrungszeichen.
WICHTIG: Sage NICHTS ueber Helligkeit, Dunkelheit oder gedaempfte Farben - der Druck muss auf dem Textil sichtbar bleiben, und darueber entscheidet eine andere Regel. Wenn im Feedback "zu knallig" oder "zu bunt" steht, uebersetze das in eine ruhigere, besser aufeinander abgestimmte Farbwahl - aber IMMER mit mindestens zwei klar unterscheidbaren Farben und deutlichem Kontrast zwischen Schrift und Motiv. Verlange niemals ein einfarbiges Design, duenne Strichzeichnung oder blasse Farben: daraus wird ein billig wirkender Druck.\n\nFeedback:\n${feedback}` }]
      });
      note = String(r.choices[0].message.content || '').replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 400);
    } catch (e) { console.error('Konsens-LLM:', e && e.message ? e.message : e); }
  }
  if (!note) note = 'Incorporate the group feedback: ' + lines.slice(0, 6).join('; ').slice(0, 380);

  // ---- Was das Konsens-Design sonst noch vom Gewinner erbt ----
  // Markus' Satz galt dem Textil, aber er trifft die ganze Familie: uebernommen werden muss
  // alles, was der Kunde eingestellt hat. Hier fehlten bisher drei Dinge.
  //
  // mood und figuren: Stimmung und Figurenstil. Fielen stillschweigend auf 'standard' zurueck -
  // das Konsens-Design sah damit anders aus als die Entwuerfe, ueber die abgestimmt wurde.
  //
  // Das Logo: uploadFile stand fest auf null. Eine Gruppe, die ihr Vereins- oder Firmenlogo
  // eingearbeitet hatte, bekam als "verbesserte Fassung" ein Design OHNE ihr Logo. Das ist der
  // schwerste der drei. Es wird nur uebernommen, wenn die Datei noch auf der Platte liegt -
  // sonst wuerde der Auftrag beim Lesen abbrechen.
  const uploadDa = async (name) => {
    if (!name) return null;
    try { await fs.access(path.join(STORE, 'uploads', name)); return name; }
    catch (e) { console.warn('Konsens-Design: Upload', name, 'liegt nicht mehr vor - Design entsteht ohne Logo'); return null; }
  };
  const logo1 = await uploadDa(baseJob.upload);
  const logo2 = logo1 ? await uploadDa(baseJob.upload2) : null;
  // placement - die gewaehlte Druckflaeche. Sie bestimmt Format und Seitenverhaeltnis: 36x46
  // hochkant, 10x10 quadratisch, 28x20 quer. Wurde sie nicht uebernommen, kam ein
  // querformatiges Brustmotiv als hochkantes Ganzflaechen-Design zurueck.
  // Sie wird seit Fassung 90 mitgeschrieben. Markus dazu: "muss aber doch eigentlich logisch
  // sein, oder?" - und er hat recht. Fuer jedes aeltere Design steht die Antwort in der
  // Druckdatei selbst: die liegt in echten Zentimetern bei 300 dpi, ihre Pixelmasse SIND also
  // das bestellte Mass. Nachtragen muss man dafuer gar nichts.
  let flaeche = baseJob.placement || '';
  if (!flaeche) flaeche = await flaecheAusDruckdatei(winnerId);

  // Neues Design als Auftrag des Abstimmungs-Eigentuemers (kein Kontingent-Verbrauch: via 'konsens')
  const jobId = 'mo_' + crypto.randomBytes(8).toString('hex');
  const job = {
    jobId, status: 'queued', qa: [], created: new Date().toISOString(),
    input: {
      motto, values: baseJob.values || {}, uploadFile: logo1, uploadFile2: logo2,
      style: baseJob.style || 'standard', colors: baseJob.colors || '',
      mood: baseJob.mood || 'standard', figuren: baseJob.figuren || 'standard', placement: flaeche,
      names: [], people: [], textile: textil,
      nameFont: baseJob.nameFont || motto.nameFont || 'rund', consensusNote: note
    },
    who: { userId: (poll.owner && poll.owner.userId) || null, guestId: (poll.owner && poll.owner.guestId) || null, via: 'konsens' },
    konsensOf: poll.id
  };
  enqueue(job);
  console.log('Konsens-Design angelegt:', jobId, 'fuer Abstimmung', poll.id,
    '- Stil:', job.input.style, '· Stimmung:', job.input.mood, '· Figuren:', job.input.figuren,
    '· Flaeche:', flaeche || '(Vorgabe des Mottos)', '· Logo:', logo1 ? 'ja' : 'nein');
  return { designId: jobId, note, textil, textilQuelle, logo: !!logo1 };
}

const abstimmung = mountAbstimmung(app, { STORE, mottos, env, accounts, identify, signPreview, SIGN_SECRET, sendMail: mailLogged, newId, produkte, GARMENTS, consensusDesign, istGruppenMotto });
const fulfillment = mountFulfillment(app, {
  STORE, env, signPreview, SIGN_SECRET, adminGuard,
  // 1. Okt. (Chat 2): nach jeder Bestellung die Lizenz des Hauses - 20 % je Artikel mit seinem Design (lizenzen.js).
  beiBestellung: ({ order }) => lizenzen.beiBestellung(STORE, order, lizenzDeps()),
  // 6. Okt.: die Kasse - Bestellung als bezahlt merken, Verrechnung bezahlter Entwuerfe abbuchen (shopify-kasse.js).
  kasseBestellung: ({ order }) => kaufformen.kasse.bestellungEingang(order)
});

// Markensperre lesen/aendern (Grundstock im Code, eigene Woerter und Ausnahmen auf dem Volume)
app.get('/api/admin/marken', adminGuard, (req, res) => res.json(marken.list()));
app.put('/api/admin/marken', adminGuard, async (req, res) => res.json(await marken.save(req.body || {})));
app.post('/api/admin/marken/pruefen', adminGuard, (req, res) => res.json({ treffer: marken.check(String((req.body || {}).text || '')) }));

// Verbotene Zeichen und Parolen: ansehen, ERGAENZEN, testen, Protokoll lesen.
// Kein Loeschen und kein Freigeben - der Grundstock steht fest, und wer im Backend
// sitzt, soll ein Hakenkreuz auch nicht "versehentlich" freischalten koennen.
app.get('/api/admin/verboten', adminGuard, (req, res) => res.json(verboten.list()));
app.put('/api/admin/verboten', adminGuard, async (req, res) => res.json(await verboten.save(req.body || {})));
app.post('/api/admin/verboten/pruefen', adminGuard, (req, res) => res.json({ treffer: verboten.pruefeText(String((req.body || {}).text || '')) }));
app.get('/api/admin/verboten/log', adminGuard, async (req, res) => res.json({ eintraege: (await verbotenLog()).slice(0, 100) }));
// Bild-Schnelltest: fertiges Design (designId) oder hochgeladenes Bild (pngBase64) durch Text- UND Logo-/Wappen-Pruefung schicken
app.post('/api/admin/marken/bildpruefen', adminGuard, async (req, res) => {
  if (!HAS_LLM) return res.status(503).json({ error: 'kein OPENAI_API_KEY - Bild-QA laeuft nicht' });
  try {
    const b = req.body || {};
    let png;
    if (b.designId) png = (await masterWithName(String(b.designId).replace(/[^A-Za-z0-9_-]/g, ''), -1)).buf;
    else if (b.pngBase64) png = Buffer.from(String(b.pngBase64).replace(/^data:[^,]+,/, ''), 'base64');
    else return res.status(400).json({ error: 'designId oder pngBase64 fehlt' });
    // fuer die Pruefung reicht 1024 px, spart Tokens; weisser Hintergrund, damit transparente Master lesbar sind
    const small = await sharp(png).resize({ width: 1024, fit: 'inside' }).flatten({ background: '#ffffff' }).png().toBuffer();
    const qa = await textQA(small, []);
    res.json({ pass: !!qa.pass, reason: qa.reason || '', marke: qa.marke || null, logo: qa.logo || null, texts: qa.texts || [], logos: qa.logos || [] });
  } catch (e) { res.status(404).json({ error: 'Bild nicht lesbar / unbekanntes Design' }); }
});

// Backup: Stand lesen / jetzt im Hintergrund starten (Antwort sofort, das Backend fragt den Stand nach)
app.get('/api/admin/backup', adminGuard, async (req, res) => res.json({ drive: (await drive.status()).connected, zeiten: BACKUP_ZEITEN, zone: BACKUP_ZONE, faellig: standJetzt(), keep: BACKUP_KEEP, running: backupRunning, entries: await backupLog() }));
app.post('/api/admin/backup', adminGuard, (req, res) => {
  if (backupRunning) return res.json({ started: false, error: 'Backup laeuft bereits' });
  runBackup('manuell').catch(() => { /* steht im Protokoll */ });
  res.json({ started: true });
});

// Mail-Protokoll lesen (letzte 100 Mails) + welche Adresse als Chef-Adresse gilt
app.get('/api/admin/maillog', adminGuard, async (req, res) => {
  let list = [];
  try { list = JSON.parse(await fs.readFile(MAILLOG_FILE, 'utf8')); } catch (e) { list = []; }
  res.json({ chef: env.ADMIN_EMAIL || null, fallback: env.MAIL_FROM, brevo: !!env.BREVO_API_KEY, entries: list });
});

// Stile fuer alle Mottos zentral bearbeiten (Label, Beschreibung, Prompt-Text, aktiv/aus).
app.get('/api/admin/styles', adminGuard, (req, res) => res.json({ styles: stylesForAdmin() }));

app.put('/api/admin/styles', adminGuard, async (req, res) => {
  try {
    const list = Array.isArray(req.body?.styles) ? req.body.styles : [];
    const over = {};
    for (const st of list) {
      if (st && STYLE_KEYS.includes(st.key)) {
        over[st.key] = { label: st.label, desc: st.desc, text: st.text, off: !!st.off };
      }
    }
    applyStyleOverrides(over);
    await fs.writeFile(STYLES_FILE, JSON.stringify(over, null, 2));
    res.json({ styles: stylesForAdmin() });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : 'Fehler' });
  }
});

app.get('/api/admin/mottos', adminGuard, async (req, res) => res.json({ mottos: await mottos.all() }));

app.put('/api/admin/mottos/:slug', adminGuard, async (req, res) => {
  try {
    // Sobald du ein Motto im Admin speicherst, gilt es als von Hand bearbeitet und wird
    // durch spaetere Deploys nicht mehr aus der Vorlage ueberschrieben.
    const saved = await mottos.save({ ...(req.body || {}), slug: req.params.slug, userEdited: true });
    res.json({ motto: saved });
  } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
});

app.post('/api/admin/mottos', adminGuard, async (req, res) => {
  try {
    const saved = await mottos.save(req.body || {});
    res.json({ motto: saved });
  } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
});

app.delete('/api/admin/mottos/:slug', adminGuard, async (req, res) => {
  await mottos.remove(req.params.slug);
  res.json({ ok: true });
});

// Prompt-Vorschau: zeigt, was wirklich beim Bildgenerator ankommt - kostet nichts.
app.post('/api/admin/prompt-vorschau', adminGuard, (req, res) => {
  try {
    const m = sanitizeMotto((req.body || {}).motto);
    const values = {};
    for (const f of m.fields) {
      const given = ((req.body || {}).values || {})[f.key];
      values[f.key] = given !== undefined && given !== '' ? String(given) : (f.type === 'select' ? (f.options[0] || '') : (f.placeholder || f.label).replace(/^z\. ?B\. /, ''));
    }
    const b = req.body || {};
    res.json({ prompt: buildPrompt(m, values, { style: b.style, colors: b.colors, variation: pickVariation(m) }), values });
  } catch (e) { res.status(400).json({ error: String(e.message || e) }); }
});

// ---------- Seiten ----------
const escHtml = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const readTpl = (name) => fs.readFile(path.resolve(name), 'utf8');

// 1. Okt.: das Tor je Betrieb (QR am Tisch) - /bei/<slug>, Aufsteller, QR, Lizenz-Liste (haus-route.js).
// Das Stripe-Konto eines Betriebs steht im Eintrag (stripeKonto) oder im Nachweis auf dem Volume
// (POST /api/admin/firmen/<slug>/stripe legt es an) - dorthin geht die Lizenz.
const lizenzKonto = async (firmaName) => {
  const e = (await firmenListe()).find(x => x.firma === firmaName);
  const nw = await firmenlogoNachweis().catch(() => ({}));
  return (e && e.stripeKonto) || (nw[firmaName] && nw[firmaName].stripeKonto) || '';
};
const lizenzDeps = () => ({ readJob, kontoFuer: lizenzKonto, secretKey: env.STRIPE_SECRET_KEY || '', firmenSlug });
mountHaus(app, { STORE, env, adminGuard, firmenListe, firmenSlug, umfang: firmenUmfang, readTpl, escHtml, preise: PREISE, lizenzen, lizenzDeps, bilderDir: partner.bilderDir, logoBild: (e) => firmenLogoBild(e, STORE),
  nachweisLesen: firmenlogoNachweis,
  nachweisSchreiben: async (nw) => { await fs.mkdir(path.dirname(FIRMENLOGO_NACHWEIS), { recursive: true }); await fs.writeFile(FIRMENLOGO_NACHWEIS, JSON.stringify(nw, null, 2)); } });
// 2. Okt.: Partner finden, Partner werden, Partnerbereich, der einfache Weg (partner-route.js).
mountPartner(app, {
  STORE, env, adminGuard, store: partner, firmenListe, firmenSlug, logoBild: firmenLogoBild, readTpl, escHtml, sharp,
  identify, geocodeRoh, makeMockup, logoHelle, STYLES, preise: PREISE,
  markenPruefen: (texte) => marken.checkAll(texte.filter(Boolean)),
  mailAnUns: (betreff, html) => mailLogged({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: env.ADMIN_EMAIL || env.ADMIN_MAIL || LEGAL.mail, subject: betreff, html }),
  farbenVonLogo: (e) => firmenFarben(e, dominantColors, STORE, []),
  loginLinkSenden: async (email, next) => {
    // Drei Tage gueltig: der Link kommt ungefragt nach der Anmeldung, nicht auf Knopfdruck.
    const token = await accounts.createLogin(email, next, 3 * 86400e3);
    const r = await sendLoginMail({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: email, link: `${env.PUBLIC_BASE_URL}/login?t=${token}`, base: env.PUBLIC_BASE_URL });
    await logMail({ to: email, subject: 'Anmelde-Link (Partner)', ok: !!r.sent, messageId: r.messageId || null, logged: !!r.logged });
    return !!r.sent;
  }
});
// Stuendlich: offene Lizenzen nachholen (Konto nachgereicht, Stripe wieder da) - nach dem Start, nicht davor.
setTimeout(() => {
  const lauf = () => lizenzen.nachholen(STORE, lizenzDeps()).then(n => { if (n) console.log('Lizenzen nachgeholt:', n); }).catch(e => console.error('Lizenzen nachholen:', e && e.message ? e.message : e));
  lauf(); setInterval(lauf, 3600e3);
}, 120e3);

// Uebersicht: eine Kachel je Motto
// Die echten Angaben, aus denen das gezeigte Design entstanden ist. Frueher standen im Kopf
// erfundene Beispielsaetze - die passten zum Bild danebendran ueberhaupt nicht. Jetzt wird der
// Auftrag des Designs gelesen und genau das gezeigt, was der Kunde damals eingetragen hat.
// Gecacht ueber die Design-Nummer: ein Design aendert seine Angaben nie mehr.
const ZETTEL_CACHE = new Map();
async function zettelFuer(m) {
  const id = await heroDesignId(m);
  if (!id) return [];
  if (ZETTEL_CACHE.has(id)) return ZETTEL_CACHE.get(id);
  let zeilen = [];
  try {
    const j = await readJob(id);
    const v = (j && j.values) || {};
    zeilen = (m.fields || [])
      .filter(f => f.printed !== false && !f.personal && (f.type === 'text' || f.type === 'select'))
      .map(f => ({ label: String(f.label || '').replace(/ – optional$/, ''), wert: String(v[f.key] || '').trim() }))
      .filter(z => z.wert && z.wert.length <= 40)
      .slice(0, 3);
  } catch (e) { zeilen = []; }
  cacheSetzen(ZETTEL_CACHE, id, zeilen);
  return zeilen;
}

// Fassung 77: Die sechs Anlaesse der Schnellwahl standen als Liste in home.html. Sie stehen
// jetzt hier, weil der Server sie selbst braucht: aus dem ersten vorhandenen Anlass ergibt
// sich, wie viele Zeilen der Zettel im Kopf bekommt - und damit, wie hoch er von Anfang an
// sein muss, damit beim Schreiben nichts nach unten rutscht. Eine Liste, eine Wahrheit.
const SCHNELL_SLUGS = ['abi', 'junggesellenabschied', 'malle-fahrt', 'fanclub', 'vereinsjubilaeum', 'firmenausflug'];

// ---------- Die Anlaesse als fertiges HTML ----------
// Fassung 78: Diese Gruppen standen in home.html und wurden erst im Browser zu Kacheln. Fuer
// Google heisst das: der Suchroboter muss erst JavaScript ausfuehren, um ueberhaupt zu sehen,
// dass es hier Abi-Motive, JGA-Designs, Vereinsshirts und Handwerker-Motive gibt - und genau
// diese Woerter sind das, wonach Kunden suchen. Google fuehrt JavaScript zwar aus, aber
// seltener, spaeter und nicht verlaesslich. Jetzt baut der Server die Kacheln: sie stehen im
// HTML, sind sofort da und erscheinen mit der Seite, ohne auf ein Skript zu warten.
// Die Reihenfolge und die Gruppennamen sind unveraendert uebernommen.
const ANLASS_GRUPPEN = [
  ['Feiern & Reisen', ['hochzeit', 'junggesellenabschied', 'malle-fahrt', 'geburtstag', 'karneval', 'weihnachtsfeier', 'kegeltour', 'firmenausflug']],
  ['Schule & Abschluss', ['abi', 'schulmotto', 'abschlussfahrt']],
  ['Verein, Fans & Sport', ['meister-shirt', 'fanclub', 'fan-shirt', 'vereinsjubilaeum', 'darts', 'bowling']],
  ['Beruf & Betrieb', ['handwerker-shirt']],
  ['Familie & Kinder', ['geburt-baby', 'familie', 'kinder-tiershirt', 'tier-shirt']],
  ['Hobby & Leidenschaft', ['angler-shirt', 'jaeger-shirt', 'landwirt-shirt', 'motorrad-shirt', 'sprueche-shirt']]
];
// Strukturierte Daten. Grundsatz: nur Angaben, die stimmen. Keine erfundenen Bewertungen,
// keine Preise, solange es keinen Warenkorb gibt - dafuer straft Google ab, und zwar die
// ganze Seite. Product und Offer kommen dazu, wenn Shopify haengt.
function ldJson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');   // sonst schliesst ein "</" das Skript
}
function ldStartseite(basis) {
  return ldJson({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Motto Otto',
    url: basis + '/',
    logo: basis + '/favicon.png',
    description: 'Designs für Gruppen: Anlass sagen, Otto zeichnet, gedruckt in Deutschland.',
    areaServed: 'DE'
  });
}
function ldMottoseite(basis, m) {
  return ldJson({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Motto Otto', item: basis + '/' },
      { '@type': 'ListItem', position: 2, name: 'Mottos', item: basis + '/#mottos' },
      { '@type': 'ListItem', position: 3, name: m.name, item: basis + '/m/' + encodeURIComponent(m.slug) }
    ]
  });
}

// Die Schnellwahl unter der Schlagzeile. Fassung 78: Auch die stand nur im Skript - und war
// damit das, was oben auf der Seite am laengsten fehlte. Jetzt kommt sie fertig mit dem HTML,
// erscheint also sofort, und die geschaetzte Platzreservierung dafuer kann raus.
// Kurze Beschriftungen, sonst brechen die Knoepfe auf dem Handy in fuenf Zeilen um.
const SCHNELL_KURZ = {
  'abi': 'Abi', 'junggesellenabschied': 'JGA', 'malle-fahrt': 'Malle', 'fanclub': 'Fanclub',
  'vereinsjubilaeum': 'Verein', 'firmenausflug': 'Firma', 'abschlussfahrt': 'Abschlussfahrt',
  'sprueche-shirt': 'Sprüche', 'geburt-baby': 'Baby', 'kinder-tiershirt': 'Kinder',
  'geburtstag': 'Geburtstag', 'kegeltour': 'Kegeln', 'handwerker-shirt': 'Handwerk',
  'meister-shirt': 'Meister', 'karneval': 'Karneval'
};
function schnellwahl(liste) {
  const gewaehlt = SCHNELL_SLUGS.map(s => liste.find(m => m.slug === s)).filter(Boolean);
  // Fehlt einer, rueckt das naechste Motto nach - sechs Knoepfe sollen es sein.
  for (const m of liste) { if (gewaehlt.length >= 6) break; if (!gewaehlt.includes(m)) gewaehlt.push(m); }
  return gewaehlt.map(m =>
    `<a href="/m/${encodeURIComponent(m.slug)}" style="--tc:${escHtml(m.accent || '#ffc542')}">`
    + `<i></i>${escHtml(SCHNELL_KURZ[m.slug] || m.name)}</a>`
  ).join('') + `<a class="mehr" href="#mottos">Alle ${liste.length} Mottos ↓</a>`;
}

// ---------- "Ein Design. Und dann?" ----------
// Fassung 78, Markus: "Wir zeigen ueberhaupt nicht, was wir alles koennen. Auf der Startseite
// ist nichts von dem, was wir koennen, zu sehen oder zu lesen." Stimmte: die Seite NANNTE
// Tasse, Kissen und Poster in einem Nebensatz, gezeigt hat sie ausschliesslich Textil.
// Hier laeuft jetzt EIN Motiv durch fuenf verschiedene Sachen. Ein Motiv, nicht fuenf: nur so
// sieht man, dass Otto einmal zeichnet und der Druck sich danach richtet, worauf man will.
// Gezeigt wird nur, wovon es wirklich eine Vorlage gibt (templateReady). Fehlt sie, faellt die
// Kachel weg; bleiben weniger als drei uebrig, faellt der ganze Abschnitt weg - lieber gar
// nichts als eine halbe Reihe mit Loechern.
// Fassung 82, Markus: "Ich finde Tasse, Kissen, Handtuch, Fussmatte und Poster sieht einfach
// nicht gut aus. Zumal wir ja auch anbieten, Designs direkt fuer diese Artikel zu machen, und
// die sehen ja dann definitiv anders aus."
// Er hat in beidem recht, und der zweite Punkt ist der schwerere: Fassung 78 hat EIN
// Shirt-Motiv auf fuenf Artikel gelegt und "dasselbe Motiv, 5-mal anders" darueber
// geschrieben. Genau das machen wir aber NICHT - wir zeichnen fuer den Artikel. Ein Motiv fuer
// eine 36x46 hohe Textilflaeche kann auf einem 70x30 breiten Mousepad nicht dasselbe sein. Die
// Bilder haben also eine falsche Behauptung illustriert, und schlecht ausgesehen haben sie
// obendrein.
// Statt bessere Falschbilder zu bauen (echte Artikel-Designs gibt es nicht zu zeigen: der
// Showcase-Pool weiss nicht, fuer welchen Artikel ein Design war), zeigt der Abschnitt jetzt
// das, was den Unterschied BEWEIST: die echten Druckflaechen, maszstabsgetreu nebeneinander.
// Die Zahlen kommen aus dem Artikelkatalog, sind also immer richtig und koennen nicht
// veralten - und sie argumentieren von selbst. Keine Bilder, keine Herstellerrechte, nichts,
// was schlecht aussehen kann.
const FORMATE = [
  { id: 'tshirt', wofuer: 'hoch' },
  { id: 'kissen', wofuer: 'quadratisch' },
  { id: 'handtuch', wofuer: 'schmal und lang' },
  { id: 'mousepad', wofuer: 'breit' },
  { id: 'fussmatte', wofuer: 'stehend' },
  { id: 'gepaeckanhaenger', wofuer: 'winzig' }
];
function formateKacheln() {
  const da = [];
  for (const f of FORMATE) {
    if (!verkaufsfaehig(f.id)) continue;
    const a = ARTIKEL[f.id];
    const erste = Object.keys(flaechenVon(f.id))[0];
    if (!a || !erste) continue;
    let lw = null;
    try { lw = artikelLeinwand(f.id, erste); } catch (e) { lw = null; }
    if (!lw || !lw.brutto) continue;
    // Netto ist das Mass, das der Kunde bekommt (40 x 40). Brutto traegt den Beschnitt
    // obendrauf (40,6) - das ist eine Zahl fuer die Druckerei und gehoert nicht auf die Seite;
    // gerundet wuerde daraus "41 x 41 cm", und das stimmt einfach nicht.
    const mass = lw.netto && lw.netto.length === 2 ? lw.netto : lw.brutto;
    da.push({ ...f, name: a.name, b: Math.round(mass[0]), h: Math.round(mass[1]) });
  }
  if (da.length < 3) return '';
  // Alles auf die groesste Kante beziehen, dann stimmen die Verhaeltnisse untereinander.
  const gross = Math.max(...da.map(x => Math.max(x.b, x.h)));
  const KANTE = 104;   // Platz in Pixeln fuer die groesste Kante
  const karten = da.map(x => {
    const bw = Math.max(9, Math.round(x.b / gross * KANTE));
    const bh = Math.max(9, Math.round(x.h / gross * KANTE));
    // 19. Sept.: Diese Kacheln waren reine <div>s - nicht anklickbar. Jetzt fuehrt jede zu Otto
    // Freestyle mit genau diesem Artikel vorgewaehlt (motto-seite.js liest ?artikel=).
    return `<a class="fk" href="/m/freestyle?artikel=${encodeURIComponent(x.id)}">`
      + `<div class="fk-buehne"><span class="fk-form" style="width:${bw}px;height:${bh}px"></span></div>`
      + `<div class="fk-text"><b>${escHtml(x.name)}</b>`
      // Mass und Formatwort getrennt: als eine Zeile brach das Trennzeichen ans Zeilenende
      // und sah nach einem Fehler aus.
      + `<em>${x.b} × ${x.h} cm</em><i>${escHtml(x.wofuer)}</i></div></a>`;
  }).join('');
  return `<div class="fk-band">${karten}</div>`;
}

// ---------- Fassung 84: die Reihe zeigt jetzt echte Teile ----------
// Markus, 18. Sept.: "Die Massangabe sieht nicht besonders professionell aus" und "wir sollten
// noch zeigen, dass wir verschiedene Masze koennen. Es sieht alles gleich aus. Den Stil
// dazuschreiben - Clean, bunt knallig. Informationen mit auf das Bild, so dass das einfach cool
// aussieht. Und mal weisze T-Shirts, ein weiszer Hoody - da musz eine Mischung rein, und unsere
// anderen Artikel ebenso."
// Beides trifft zu. Fassung 82 hat die Druckflaechen als nackte Rechtecke gezeichnet: sechs
// Drahtgestelle mit Zahlen daneben. Das beweist zwar den Formatunterschied, sieht aber aus wie
// eine technische Zeichnung - und verkauft nichts.
// Jetzt stehen dort echte Vorzeige-Designs auf echten Teilen, und die Zahl steht AUF dem Bild
// statt darunter. Der Formatunterschied ist dann im Foto zu sehen (Handtuch lang, Kissen
// quadratisch) und nicht nur in einer Bemassung.
// Die Mischung ist keine Deko, sondern eine Rechenregel: ein fuer DUNKLES Textil gezeichnetes
// Motiv ist hell und kann nur auf ein dunkles Teil. Ein fuer HELLES Textil gezeichnetes Motiv
// kommt auf Weisz - und nur dieses darf auf Kissen, Handtuch, Fuszmatte und Strandtuch, weil
// deren Vorlagen hell sind. Weisze Shirts und Hoodies entstehen also aus hell gezeichneten
// Designs, nicht aus einem Umfaerben. Wer mehr Weisz auf der Seite will, laesst im Backend mehr
// helle Designs zeichnen - der Abschnitt nimmt sie von selbst auf.
// Die Reihenfolge ist Absicht: nach dem T-Shirt kommt sofort ein Teil mit einem ANDEREN Format.
// Standen die Shirts zuerst und die Formate hinten, las man sechs Mal "36 x 46 cm" und danach
// erst das Handtuch - "verschiedene Masze" war dann eine Behauptung am Rand statt das, was man
// sieht.
// 21. Sept., 07:32, Markus (Kissen mit Schulmotto-Shirt-Design): "Das ist auch kein eigenes Design
// fuers Kissen gemacht. Schlimm." Die Ueberschrift verspricht ein eigenes Design je Artikel. Ein
// Shirt-Motiv gehoert also nur auf Textilien mit derselben Druckart (Shirt, Hoodie, Zip, Beutel).
// Kissen, Handtuch, Strandtuch, Fussmatte kommen nur mit einem Design, das WIRKLICH dafuer
// entworfen wurde (Auftrag mit diesem Artikel, aus dem freigegebenen Pool) - siehe flachwareKarten.
// 21. Sept., 19:49, Markus: "Es gibt ja zwei Varianten: ein T-Shirt-Design, das wir auch auf
// andere Artikel setzen - oder ihr sucht euch einen Artikel aus und das Design wird genau fuer
// diesen Artikel in dem Mass gemacht. Da muessten auch ein paar andere Artikel zu sehen sein."
// Also zeigt die Reihe BEIDE Wege und sagt es dazu: das Shirt-Design auch auf Tasse, Poster,
// Sticker, Mousepad ("Shirt-Design uebernommen"), und daneben die Artikel mit eigenem Design
// ("Eigenes Design fuer das Kissen"). Kissen, Handtuch, Strandtuch, Fussmatte bleiben dem
// eigenen Design vorbehalten (siehe oben, 07:32).
// 21. Sept., 21:00, Markus: "Wenn wir ein Handtuch oder einen anderen Artikel zeigen, dann muss
// das auch fuer diesen Artikel 100 % entworfen sein, in genau der richtigen Groesse - und nicht
// einfach ein fertiges Design genommen werden. Das ist, womit wir werben." Also: ein Shirt-Design
// nur auf Textilien mit Brustdruck (Shirt, Hoodie, Zip, Beutel); jeder andere Artikel kommt nur
// mit einem Design, das fuer ihn gezeichnet wurde (flachwareKarten).
const SCHAU_TEILE = {
  dunkel: ['tee', 'beutel', 'hoodie', 'zip'],
  hell: ['tee', 'hoodie', 'beutel', 'zip']
};
// "Eigenes Design fuer die Hundedecke" - der Artikel je Teil (21. Sept.: die Startseite sagte
// "das Hundedecke"). Was hier nicht steht, ist saechlich (Kissen, Handtuch, Mousepad, Poster).
const TEIL_ARTIKEL = { 'Fußmatte': 'die', 'Hundedecke': 'die', 'Napfunterlage': 'die', 'Tasse': 'die', 'Gepäckanhänger': 'den', 'Sticker': 'den' };
const fuerTeil = (teil) => (TEIL_ARTIKEL[teil] || 'das') + ' ' + teil;
async function flachwareKarten(max = 8, namen = {}) {
  const karten = [];
  try {
    const sc = await loadShowcase();
    const belegt = new Set();
    for (const [id, e] of Object.entries(sc)) {
      if (!e || !e.approved || karten.length >= max) continue;
      const j = await readJob(id);
      const art = artikelVon(j);
      if (!art || !art.id) continue;
      const g = ansichtVon(art.id);
      if (!g || !GARMENTS[g] || !GARMENTS[g].voll || belegt.has(g)) continue;
      if (!passtVorzeige(g, j.motto)) continue;   // 22. Sept.: Hundedecke nur mit Tiermotiv, Tuerschild nur mit Familie
      // Format muss stimmen: ein hochkant gezeichnetes Design gehoert nicht auf die quer liegende Fussmatte.
      if (Array.isArray(art.netto) && art.netto[0] > 0 && art.netto[1] > 0 && Array.isArray(GARMENTS[g].flaecheCm) && (art.netto[0] >= art.netto[1]) !== (GARMENTS[g].flaecheCm[0] >= GARMENTS[g].flaecheCm[1])) continue;
      const color = istHell(j.textile) ? 'white' : 'black';
      if (!(await templateReady(g, color))) continue;
      const print = istHell(j.textile) ? 'hell' : 'dunkel';
      const szene = await szeneMoeglich(g, color);
      // Nur, was fertig daliegt - sonst im Hintergrund bauen und beim naechsten Mal zeigen.
      const bild = showcaseImage(id, j.textile).replace(/\/tee\/(black|white)\.jpg/, '/' + g + '/' + color + '.jpg') + (szene ? '&szene=1' : '');
      if (!(await mockupLiegtDa(id, g, color, print, { szene }))) { mockupNachbauen(bild); continue; }
      belegt.add(g);
      const teil = GARMENTS[g].label;
      const stilName = (STYLES[j.style] && j.style !== 'standard' && STYLES[j.style].label) || '';
      const mottoName = namen[j.motto] || '';
      // Zwei Zeilen wie bei den Shirt-Kacheln: "Motto · Stil", dann der Weg.
      const zeile2 = [mottoName, stilName].filter(Boolean).join(' · ');
      karten.push(`<a class="sk" href="/m/freestyle?artikel=${encodeURIComponent(art.id)}" style="--tc:#ffc542">`
        + `<span class="sk-bild"><img alt="${escHtml(teil)} – eigenes Design" loading="lazy" decoding="async" src="${escHtml(bild)}" onerror="this.closest('.sk').remove()"></span>`
        + `<span class="sk-cap"><b>${escHtml(teil)}</b>${zeile2 ? `<i>${escHtml(zeile2)}</i>` : ''}<em class="sk-weg">Eigenes Design für ${escHtml(fuerTeil(teil))}</em></span></a>`);
    }
  } catch (e) { console.error('Flachware-Kacheln:', e && e.message ? e.message : e); }
  return karten;
}
// Nur Teile mit GEPRUEFTER Druckflaeche in Zentimetern kommen in die Reihe - die Zahl auf dem
// Bild musz stimmen. Tasse, Poster und Sticker haben keine hinterlegte Flaeche und bleiben
// deshalb in der Zeile darunter, statt mit einer geratenen Angabe dazustehen.
const schauMass = (g) => {
  const f = GARMENTS[g] && GARMENTS[g].flaecheCm;
  return f && f.length === 2 ? `${f[0]} × ${f[1]} cm` : '';
};
// Die Reihe wird NIE waehrend eines Seitenaufrufs gebaut. Einmal Bauen heiszt: jedes
// Vorzeige-Design nachschlagen und seinen Auftragszettel lesen - bei 230 Beispielen sind das 230
// Dateizugriffe auf dem Volume. Der erste Besucher nach einem Deploy haette sie bezahlt.
// Also: der Aufruf bekommt sofort, was fertig daliegt, und stoeszt im Hintergrund den Neubau an.
// Beim Start laeuft er einmal von selbst, damit schon der erste Besucher die echte Reihe sieht.
let schauCache = { html: '', bis: 0, laeuft: false };
function schauKacheln(liste) {
  // ABNAHME=1 (Pruefserver der Abnahme): nichts bauen, was Druckdateien aus dem Netz holt.
  if (!process.env.ABNAHME && !schauCache.laeuft && Date.now() >= schauCache.bis) {
    schauCache.laeuft = true;
    schauBauen(liste)
      .then(h => { schauCache = { html: h, bis: Date.now() + 600000, laeuft: false }; })
      .catch(e => {
        console.error('Schau-Reihe:', e && e.message ? e.message : e);
        schauCache.laeuft = false; schauCache.bis = Date.now() + 60000;
      });
  }
  return schauCache.html;
}
async function schauBauen(liste) {
  // Alles einsammeln, was ein Vorzeige-Design hat. Der Auftragszettel sagt, fuer welches Textil
  // gezeichnet wurde - daran haengt alles Weitere.
  const kandidaten = [];
  for (const m of liste) {
    if (vorzeige.komplettGesperrt(m.slug)) continue;
    // 20. Sept.: Mottos mit festem Artikel (Postkarte) gehoeren nicht auf Shirt, Hoodie oder Kissen.
    if (m.artikelFest) continue;
    const s = await vorzeige.read(m.slug);
    for (const [style, id] of Object.entries(s)) {
      if (!id) continue;
      // "<stil>@<artikel>": fuer einen Artikel gezeichnet - das zeigt flachwareKarten, nicht diese Reihe.
      if (style.includes('@')) continue;
      const j = await readJob(id);
      if (!j) continue;
      // 'kachel' ist der Aufmacher und hat keinen eigenen Kunststil - der Zettel weisz, welcher es war.
      const stil = (style === 'kachel' ? (j.style || 'standard') : style);
      kandidaten.push({ slug: m.slug, name: m.name, style, id, stil, hell: istHell(j.textile) });
    }
  }
  if (!kandidaten.length) return '';
  // Die Reihenfolge ist der halbe Abschnitt. Erst hatte ich einfach alle hellen nach vorn
  // sortiert - dann standen vier Mal "Aquarell" nebeneinander, weil Aquarell der einzige helle
  // Stil ist. Das ist genau der Vorwurf ("es sieht alles gleich aus"), nur in Weisz.
  // Also wird jede Kachel einzeln gewaehlt: was am wenigsten nach der vorigen aussieht, kommt
  // als naechstes. Anderes Textil als eben, ein Stil, der noch nicht dastand, ein Anlass, der
  // noch nicht dran war - in dieser Gewichtung.
  const MAX = 10;
  const karten = [], proMotto = {}, belegt = new Set(), teilZaehler = { hell: 0, dunkel: 0 };
  const teilDa = new Set();   // welches TEIL schon in der Reihe steht - farbunabhaengig
  const stileDa = new Set();
  let vorigHell = null, vorigTeil = '';
  const offen = kandidaten.slice();
  while (karten.length < MAX && offen.length) {
    let best = 0, bestWert = -1;
    for (let i = 0; i < offen.length; i++) {
      const c = offen[i];
      let wert = 0;
      if (vorigHell === null || c.hell !== vorigHell) wert += 4;
      if (!stileDa.has(c.stil)) wert += 3;
      if (!proMotto[c.slug]) wert += 2;
      if (wert > bestWert) { bestWert = wert; best = i; }
    }
    const k = offen.splice(best, 1)[0];
    if ((proMotto[k.slug] || 0) >= 2) continue;
    const farbe = k.hell ? 'white' : 'black';
    const moeglich = SCHAU_TEILE[k.hell ? 'hell' : 'dunkel'];
    // 20. Sept., Markus: unter "Fuer jeden Artikel ein eigenes Design" standen am Handy zwei
    // T-Shirts nebeneinander (schwarz, dann weisz - beide Listen beginnen mit "tee"). Die
    // Ueberschrift verspricht verschiedene Teile, also bekommt keine Kachel dasselbe Teil wie
    // die davor, solange es ein anderes gibt.
    let gewaehlt = '';
    for (let runde = 0; runde < 2 && !gewaehlt; runde++) {
      for (let i = 0; i < moeglich.length; i++) {
        const g = moeglich[(teilZaehler[k.hell ? 'hell' : 'dunkel'] + i) % moeglich.length];
        if (runde === 0 && g === vorigTeil) continue;
        if (belegt.has(g + '_' + farbe)) continue;
        // 23. Sept., Markus: "nicht irgendwelche Beispiele, die auch noch doppelt sind."
        // Die Sperre oben gilt je FARBE - dasselbe Teil durfte also einmal in Weiss und einmal
        // in Schwarz kommen, und genau so standen zwei Strandtuecher in der Reihe. Ein Teil
        // kommt jetzt hoechstens EINMAL vor, egal in welcher Farbe.
        if (teilDa.has(g)) continue;
        // (Das Mass steht seit dem 20. Sept. nicht mehr auf der Kachel - darum duerfen jetzt auch
        // Tasse, Poster und Sticker ohne hinterlegte Flaeche in die Reihe.)
        if (!(await templateReady(g, farbe))) continue;
        gewaehlt = g; break;
      }
    }
    if (!gewaehlt) continue;
    vorigTeil = gewaehlt;
    teilDa.add(gewaehlt);
    // Fassung 84b, die Lehre aus dem Ausfall: das Bild wird HIER gebaut, im Hintergrund, eines
    // nach dem anderen - nicht erst dann, wenn ein Browser es anfordert. Vorher lieferte die
    // Seite acht Adressen aus, zu denen es noch kein Bild gab; der erste Besucher liesz damit
    // acht Mockups gleichzeitig rechnen, jedes mit einem 4096 x 5433 grossen Master im
    // Arbeitsspeicher. Das hat den Container umgeworfen. Jetzt gilt: keine Kachel ohne fertiges
    // Bild. Geht das Bauen schief, faellt die Kachel weg statt kaputt dazustehen.
    // Fassung 86: hier die SITUATION, nicht die sachliche Ansicht. Diese Reihe soll anregen -
    // das Poster an der Wand, das Handtuch am Strand, das Shirt getragen. Fehlt die Vorlage
    // dafuer, kommt die sachliche Ansicht zurueck; die Reihe wird also von selbst lebendiger,
    // sobald eine Situation erzeugt ist.
    // In der Stil-Galerie auf der Mottoseite bleibt es bei der sachlichen Ansicht: dort
    // vergleicht man Stile, und eine Wohnzimmerwand lenkt davon ab.
    try { await vorzeige.stilMockup(k.slug, k.style, gewaehlt, true); }
    catch (e) { console.warn('Schau-Reihe: kein Mockup fuer', k.slug, k.style, gewaehlt, '-', e && e.message ? e.message : e); continue; }
    teilZaehler[k.hell ? 'hell' : 'dunkel']++;
    belegt.add(gewaehlt + '_' + farbe);
    proMotto[k.slug] = (proMotto[k.slug] || 0) + 1;
    stileDa.add(k.stil);
    vorigHell = k.hell;
    const st = STYLES[k.stil] || {};
    const teil = (GARMENTS[gewaehlt] && GARMENTS[gewaehlt].label) || gewaehlt;
    const farbwort = ['tee', 'hoodie', 'zip'].includes(gewaehlt) ? (k.hell ? ', weiß' : ', schwarz') : '';
    // 19. Sept., Markus: "Wenn da jemand drauf klickt, muss er natuerlich auch genau auf dieses
    // Produkt kommen." Bisher fuehrte die Kachel "Kissen · Aquarell · Abi" auf /m/abi - ohne
    // Stil, ohne Teil, ohne Farbe. Jetzt traegt die Adresse alle drei, und die Mottoseite belegt
    // das Formular damit (motto-seite.js liest stil, textil, teil).
    const ziel = `/m/${encodeURIComponent(k.slug)}?stil=${encodeURIComponent(k.stil)}&textil=${k.hell ? 'hell' : 'dunkel'}&teil=${encodeURIComponent(gewaehlt)}`;
    karten.push(`<a class="sk" href="${ziel}" style="--tc:${escHtml(kandidatenAkzent(liste, k.slug))}">`
      + `<span class="sk-bild">`
      + `<img alt="${escHtml(k.name)} – ${escHtml(st.label || k.stil)} auf ${escHtml(teil)}" loading="lazy" decoding="async"`
      + ` src="/api/mo/stilbeispiel/${encodeURIComponent(k.slug)}/${encodeURIComponent(k.style)}.jpg?a=${gewaehlt}&amp;szene=1&amp;v=${encodeURIComponent(k.id)}"`
      + ` onerror="this.closest('.sk').remove()">`
      // 20. Sept., Markus zu "Wie vorges..." und "36 x 46 cm" auf jeder Kachel: "Wer soll das
      // verstehen?" Das Masz war eine Angabe fuer uns, nicht fuer den Kunden.
      // 21. Sept., 20:54, Markus: "Da steht jetzt nur der Stil und leider Gottes komplett uebers
      // Motiv" / "Ist das dein Ernst?" - die Stil-Plakette lag am Handy riesig ueber dem Bild
      // ("Minimalisti..."). Nichts mehr auf dem Bild. Unter dem Bild drei Zeilen: Teil, dann
      // "Motto · Stil", dann der Weg ("Shirt-Design übernommen" oder "Eigenes Design für ...").
      + `</span>`
      + `<span class="sk-cap"><b>${escHtml(teil)}${farbwort}</b><i>${escHtml(k.name)}${k.stil !== 'standard' && st.label ? ' · ' + escHtml(st.label) : ''}</i>`
      + (['tee', 'hoodie', 'zip', 'polo'].includes(gewaehlt) ? '' : `<em class="sk-weg">Shirt-Design übernommen</em>`) + `</span></a>`);
  }
  // Dazu die Artikel, fuer die es ein eigenes Design gibt (Kissen, Handtuch, Strandtuch ...).
  const namen = {}; for (const m of liste) namen[m.slug] = m.name;
  const flach = await flachwareKarten(8, namen);
  for (let i = 0; i < flach.length; i++) karten.splice(Math.min(karten.length, 1 + i * 2), 0, flach[i]);
  // Weniger als vier Kacheln sind keine Reihe - dann lieber die maszstabsgetreuen Flaechen.
  return karten.length >= 4 ? `<div class="sk-band">${karten.join('')}</div>` : '';
}
const kandidatenAkzent = (liste, slug) => (liste.find(m => m.slug === slug) || {}).accent || '#ffc542';
// 25 s nach dem Start einmal vorbauen - nach den Vorlagen (20 s), damit templateReady stimmt.
if (!process.env.ABNAHME) setTimeout(async () => {
  try {
    const l = (await mottos.all()).filter(m => m.active !== false).map(m => ({ slug: m.slug, name: m.name, accent: m.accent || '#ffc542', artikelFest: m.artikelFest || '' }));
    schauKacheln(l);
  } catch (e) { console.error('Schau-Reihe vorbauen:', e && e.message ? e.message : e); }
}, 25000);

function woraufAbschnitt(liste) {
  const echt = schauKacheln(liste);
  const band = echt || formateKacheln();
  if (!band) return '';
  return `<div class="wrap"><section class="worauf" id="worauf">`
    // 20. Sept., Markus: "Wer soll das verstehen?" - vier Zeilen Erklaerung ueber Druckflaechen
    // sind fuer uns interessant, nicht fuer den Kunden. Ein Satz, der sagt, was er sieht.
    // 21. Sept., 19:49, Markus: "Es gibt ja zwei Varianten: wir machen ein T-Shirt-Design, was wir
    // dann auch auf andere Artikel setzen - oder ihr sucht euch einen Artikel aus und das Design
    // wird genau fuer diesen Artikel in dem Mass gemacht. Diese Informationen muessen rueberkommen."
    + `<h2>Für jeden Artikel ein eigenes Design</h2>`
    + `<p class="lead">Zwei Wege: Ihr lasst ein Shirt-Design zeichnen, und Otto setzt es danach auf jeden anderen Artikel – Hoodie, Tasse, Beutel, Poster. Oder ihr wählt zuerst den Artikel, und Otto zeichnet das Design genau für dieses Maß: Kissen quadratisch, Handtuch lang, Mousepad breit${echt ? '' : ' – hier maßstabsgetreu'}. Tippt eine Kachel an, dann seht ihr es auf genau diesem Produkt.</p>`
    + band
    + alleArtikelListe()
    + `</section></div>`;
}

// 23. Sept., Markus zur Reihe unter "Fuer jeden Artikel": "Ihr muesst natuerlich alle Artikel
// aufgezaehlt sein, klein, uebersichtlich, was wir alles anbieten - und nicht irgendwelche
// Beispiele, die auch noch doppelt sind." Beides stimmte: die Reihe zeigte ACHT Beispiele, davon
// zwei Strandtuecher (die Sperre galt je Farbe, also durfte dasselbe Teil in Weiss UND in Schwarz
// kommen), und darunter stand ein Satz, der mit "und mehr" endete.
// Die Liste wird deshalb NICHT von Hand gepflegt, sondern aus den Preisen gebaut - dort steht,
// was wir wirklich verkaufen. Ein Artikel ohne Preis taucht nicht auf, ein neuer Preis erscheint
// von selbst, und doppelt kann nichts sein, weil jeder Schluessel nur einmal existiert.
// 24. Sept., Markus: "Wir muessen die Artikel anklickbar machen ... auch da wo steht alle
// Artikel alle Preise kannst du auch nicht draufklicken."
// Zwei Fehler, beide bestaetigt:
// 1. "alle Preise und Staffeln" zeigte auf #preise. Den Anker GIBT es - er steht nur in
//    .nur-sogehts, und auf der Startseite blendet body.seite-start .nur-sogehts ihn aus.
//    Der Sprung ging also auf ein unsichtbares Element und tat nichts. Jetzt /so-gehts#preise.
// 2. Die Artikel waren nackter Text. Jeder ist jetzt ein Link - und zwar dorthin, wo man ihn
//    wirklich gestalten kann: 16 der 20 gibt es im Freestyle-Katalog, die fuehren direkt in
//    /m/freestyle?artikel=<id> mit vorgewaehltem Artikel. Polo, Zip-Jacke und Tasse gibt es dort
//    NICHT (Tasse traegt druckflaecheOffen, Polo und Zip sind reine Motto-Textilien) - die
//    fuehren zur Mottoliste, weil sie aus einem Motto-Design entstehen. Ein Link, der ins Leere
//    zeigt, waere schlimmer als gar keiner.
const ARTIKEL_ZU_FREESTYLE = {
  tee: 'tshirt', hoodie: 'hoodie',
  strandtuch: 'strandtuch', kissen: 'kissen', poster: 'poster', sticker: 'sticker',
  beutel: 'shopper', handtuch: 'handtuch', fussmatte: 'fussmatte', mousepad: 'mousepad',
  hundedecke: 'hundedecke', brett: 'brett', acrylbild: 'acrylbild', tuerschild: 'tuerschild',
  napfunterlage: 'napfunterlage', brotdose: 'brotdose', gepaeckanhaenger: 'gepaeckanhaenger'
};
function alleArtikelListe() {
  const ab = (t) => `ab ${PREISE.euro(t.starter)}`;
  const teile = [
    ...Object.entries(PREISE.TEXTIL).map(([k, t]) => ({ key: k, name: t.label, preis: ab(t) })),
    ...Object.entries(PREISE.MERCH).map(([k, m]) => ({ key: k, name: m.label, preis: PREISE.euro(m.preis) }))
  ];
  const ziel = (k) => {
    const fid = ARTIKEL_ZU_FREESTYLE[k];
    return fid && verkaufsfaehig(fid) ? `/m/freestyle?artikel=${encodeURIComponent(fid)}` : '/mottos';
  };
  return `<h3 class="wf-alle-h">Das sind alle ${teile.length} Artikel</h3>`
    + `<ul class="wf-alle">`
    + teile.map(t => `<li><a href="${ziel(t.key)}"><span class="n">${escHtml(t.name)}</span>`
        + `<span class="p">${escHtml(t.preis)}</span></a></li>`).join('')
    + `</ul>`
    + `<p class="wf-rest">Jeder davon mit eurem Design – <a href="/so-gehts#preise">alle Preise und Staffeln</a>.</p>`;   // 7. Okt.: Druckdatei allein raus
}

function anlassKacheln(liste, kacheln = {}) {
  const benutzt = new Set();
  // Der Buchstabe im Kasten ist da, bis das Bild geladen ist - fehlt das Bild, bleibt er
  // stehen. Genau wie vorher im Browser, nur schon fertig.
  // 21. Sept.: die Kachel ist der Mottoname als gestaltete Schrift (mottos/kacheln), kein
  // Textil mehr; nur wo keine Kachel liegt, bleibt das Shirt-Mockup.
  const karte = (m) => {
    benutzt.add(m.slug);
    const bild = kacheln[m.slug] || `/api/mo/sample/${encodeURIComponent(m.slug)}.jpg`;
    return `<a class="mc" href="/m/${encodeURIComponent(m.slug)}" style="--tc:${escHtml(m.accent || '#ffc542')}">`
      + `<div class="im"><span class="glyph">${escHtml(String(m.name || '').slice(0, 1))}</span>`
      + `<img alt="${escHtml(m.name)}${kacheln[m.slug] ? '' : ' – Design von Otto'}" loading="lazy" decoding="async"`
      + ` src="${escHtml(bild)}"`
      + ` onload="var g=this.parentNode.querySelector(&quot;.glyph&quot;);if(g)g.remove();" onerror="this.remove()">`
      + `<span class="los">Otto starten →</span></div>`
      + `<div class="cap">${escHtml(m.name)}</div></a>`;
  };
  // Fassung 81, Uebersichtlichkeit: Eine Gruppe mit EINER Kachel ist keine Gruppe. Sie kostet
  // eine Ueberschrift, eine Trennlinie und zwei Abstaende fuer ein einziges Motto - und liest
  // sich wie ein abgearbeitetes Schema statt wie eine Ordnung. "Beruf & Betrieb" war genau so
  // ein Fall. Solche Einzelstuecke wandern nach hinten zu "Weitere Anlaesse"; waechst die
  // Gruppe spaeter auf zwei oder mehr Mottos, bekommt sie ihre Ueberschrift von selbst zurueck.
  // Die Gruppennamen bleiben unveraendert - hier entscheidet nur, ob sie sich lohnen.
  const MINDESTENS = 2;
  let html = '';
  const nachhinten = [];
  for (const [titel, slugs] of ANLASS_GRUPPEN) {
    const teil = slugs.map(s => liste.find(m => m.slug === s)).filter(Boolean);
    if (!teil.length) continue;
    if (teil.length < MINDESTENS) { teil.forEach(m => { benutzt.add(m.slug); nachhinten.push(m); }); continue; }
    html += `<div class="grp"><h3>${escHtml(titel)}</h3><div class="grid">${teil.map(karte).join('')}</div></div>`;
  }
  const rest = [...nachhinten, ...liste.filter(m => !benutzt.has(m.slug))];
  if (rest.length) html += `<div class="grp"><h3>Weitere Mottos</h3><div class="grid">${rest.map(karte).join('')}</div></div>`;
  return html;
}
// Gemessen (und breitenunabhaengig): Rahmen mit Ueberschrift 55 px, jede Zeile 49 px.
const zettelHoehe = (zeilen) => 55 + Math.max(1, Math.min(3, zeilen)) * 49;

// 20. Sept., Markus: "'So geht's' als einzelner Knopf oben, das von der Startseite loeschen, so
// dass die Leute direkt die Beispiele sehen und sofort aufs Motto tippen koennen." Startseite
// und /so-gehts kommen aus derselben Vorlage; die Klasse am body entscheidet, was im Fluss steht.
// 1. Okt., Markus: "uebernehmen" - die neue Startseite (home-neu.html) ist ab jetzt /. Die alte
// Fassung bleibt unter /startseite-alt (noindex) zum Vergleichen; home.html selbst traegt weiter
// /so-gehts, /mottos und /stile.
app.get('/', async (req, res) => res.type('html').send(await startseiteNeuHtml()));
app.get('/startseite-alt', async (req, res) => {
  res.set('X-Robots-Tag', 'noindex');
  res.type('html').send((await startseiteHtml('start')).replace('<head>', '<head>\n<meta name="robots" content="noindex">'));
});
app.get('/so-gehts', async (req, res) => res.type('html').send(await startseiteHtml('sogehts')));
// 22. Sept., Markus: "oben noch einen Reiter, mit allen Mottos, wo dann einfach nur alle Mottos
// aufgehen, schoen uebersichtlich." Dieselbe Vorlage, nur die Anlass-Kacheln im Fluss.
app.get('/mottos', async (req, res) => res.type('html').send(await startseiteHtml('mottos')));
// 22. Sept., Markus: "das Menue Mottos noch mal unterteilen in Motto und Stile - unter Motto die
// Mottos zeigen, das wird ja wachsen, und ein weiteres Untermenue Stil, dort zeigen wir alle Stile."
// Der Anlass sagt, WAS draufsteht; der Stil sagt, WIE es aussieht. Beides ist eine eigene Liste.
app.get('/stile', async (req, res) => res.type('html').send(await startseiteHtml('stile')));
// Reiter "Event" (Markus, 20. Sept.): "... fuer spezielle Events. Der kann auch erst mal leer
// bleiben oder wir schreiben eine Erklaerung drauf."
const EVENT_SEITE = seitenHuelle('Event', `
  <h1>Motto Otto für euer <span style="color:var(--beere)">Event</span></h1>
  <p>Das hier ist in Arbeit. Die Idee: Otto zeichnet für eure Veranstaltung – Festival, Stadtfest, Turnier, Weihnachtsfeier, Hochzeit.</p>
  <div class="box">
    <h2>So soll es laufen</h2>
    <ul>
      <li>Auf dem Gelände hängen QR-Codes. Ein Scan, und ihr seid bei Otto.</li>
      <li>Selfie machen, Otto zeichnet euer Motiv – mit dem Namen des Events drauf.</li>
      <li>Das Shirt gibt es direkt vor Ort oder nach Hause, je nachdem, was der Veranstalter anbietet.</li>
      <li>Der Veranstalter oder ein Sponsor kann einen Teil des Preises übernehmen – mit einem festen Budget, das nicht überschritten wird.</li>
      <li>Zeitlich begrenzt: Das Angebot gilt nur während der Veranstaltung, danach ist der Link zu.</li>
      <li>An den Ort gebunden: Per Standortbestimmung geht es nur auf dem Gelände – nicht von zu Hause.</li>
    </ul>
  </div>
  <div class="box">
    <h2>Für jede Feier: eure Erinnerung als Collage</h2>
    <p>Weihnachtsfeier, Hochzeit, Geburtstag, Vereinsfest – jede Feier, die ihr euch vorstellen könnt. Die Gäste machen mit dem Handy Fotos, zum Beispiel ein Vorher-Foto beim Ankommen und ein Nachher-Foto am Ende des Abends. Otto macht daraus, was ihr mögt: Karikaturen, gezeichnete Porträts, kleine Szenen im Stil eurer Feier.</p>
    <p>Aus allen Bildern entsteht danach eine schöne Collage der ganzen Veranstaltung. Die geht an alle Gäste – und wer mag, bestellt sich seine Erinnerung daraus: als Poster, Tasse oder Shirt.</p>
  </div>
  <div class="box">
    <h2>Ihr veranstaltet etwas?</h2>
    <p>Schreibt uns, was ihr vorhabt und wann: <a href="mailto:otto@motto-otto.de">otto@motto-otto.de</a>. Wir melden uns am selben Tag.</p>
  </div>
  <p><a href="/">← Zu den Mottos</a></p>
`);
app.get('/event', (req, res) => res.type('html').send(EVENT_SEITE));

// Der Aufmacher der alten Startseite (/startseite-alt): der Anlass der Saison als grosse Karte
// ueber dem Kopf.
function aufmacherAbschnitt(saison, kacheln = {}) {
  if (!saison) return '';
  let so = '';
  if (saison && saison.motto) {
    const sm = saison.motto;
    const bild = kacheln[sm.slug] || `/api/mo/sample/${encodeURIComponent(sm.slug)}.jpg`;
    so = `<a class="au-k au-saison" href="/m/${encodeURIComponent(sm.slug)}" style="--tc:${escHtml(sm.accent || '#ffc542')}">`
      + `<span class="au-bild"><img src="${escHtml(bild)}" alt="${escHtml(sm.name)} – Design von Otto" loading="eager" decoding="async" onerror="this.remove()"></span>`
      + `<span class="au-txt"><b>${escHtml(sm.name)}</b>`
      + (saison.zeile ? `<small>${escHtml(saison.zeile)}</small>` : '<small>Dein Anlass, dein Design</small>')
      + `<span class="au-los">Los geht’s →</span></span></a>`;
  }

  const badge = saison && saison.badge ? `<span class="au-badge">${escHtml(saison.badge)}</span>` : '';
  return `<div class="wrap nur-start"><section class="aufmacher" id="aufmacher">`
    + `<div class="au-kopf">${badge}`
    + `<h1>Sag <span>Otto</span>, dein Motto.</h1>`
    + `<p>Otto zeichnet euer Design – für Shirt, Tasse und Co. Der erste Entwurf ist kostenlos und braucht kein Konto.</p>`
    + `</div>`
    + `<div class="au-karten">${so}</div>`
    + `<a class="au-alle" href="#mottos">Alle 28 Anlässe ansehen ↓</a>`
    + `</section></div>`;
}
// 22. Sept., Markus: "ein weiteres Untermenue unter Motto sollte sein Stil, und dort zeigen wir
// alle Stile." Je Stil EIN Beispielbild - genommen aus den Vorzeige-Designs, quer ueber die
// Mottos: erst jedes Motto einmal, damit die Seite nicht fuenfzehnmal dasselbe Motiv in
// verschiedenen Anstrichen zeigt, sondern was der Stil aus verschiedenen Anlaessen macht.
// 22. Sept., Markus: "Auf der Seite mit Stil sind jetzt die Postkarten mit drin, die haben da
// natuerlich nichts zu suchen." Stimmt - Ansichtskarte und Retro-Reiseposter (nurMotto) sind
// keine Stile fuer ein Shirt, sondern Kartenarten der Postkarte. Sie stehen dort, wo sie
// waehlbar sind, und nicht in der allgemeinen Stil-Liste.
async function stilUebersicht() {
  const aktive = (await mottos.all()).filter(m => m.active !== false);
  // Stil -> Liste von { bild, motto, name }
  const proStil = {};
  for (const m of aktive) {
    let s = {};
    try { s = await vorzeige.publicSamples(m.slug); } catch (e) { s = {}; }
    for (const [stil, bild] of Object.entries(s)) (proStil[stil] ||= []).push({ bild, motto: m.slug, name: m.name });
  }
  // Reihum statt "schon dran gewesen": ein blosses Set ist voll, sobald jedes Motto einmal
  // gezogen wurde, und danach faellt alles auf dasselbe Motto zurueck. Gezaehlt wird, wie oft
  // ein Motto schon herhalten musste - genommen wird immer das seltenste.
  const wieOft = new Map();
  const out = [];
  for (const st of stylesForAdmin()) {
    if (st.off) continue;
    // 9. Okt. (Rundgang): "Wie vorgesehen" ist kein Stil zum Zeigen - die Kachel dafuer ist seit dem 21. Sept. raus.
    if (st.key === 'standard') continue;
    // Ein Stil, der nur zu EINEM Motto gehoert (nurMotto, eine Liste), ist kein Stil der Liste,
    // sondern eine Kartenart der Postkarte - er steht dort, wo er waehlbar ist.
    const nurRoh = (STYLES[st.key] && STYLES[st.key].nurMotto) || '';
    const nur = Array.isArray(nurRoh) ? nurRoh : (nurRoh ? [nurRoh] : []);
    if (nur.length) continue;
    const kandidaten = proStil[st.key] || [];
    let wahl = null;
    for (const k of kandidaten) if (!wahl || (wieOft.get(k.motto) || 0) < (wieOft.get(wahl.motto) || 0)) wahl = k;
    if (wahl) wieOft.set(wahl.motto, (wieOft.get(wahl.motto) || 0) + 1);
    // Der Hinweis nennt das Motto beim Namen ("nur für Grüße aus") - "nur für Postkarten"
    // waere geraten, sobald ein zweites Motto einen eigenen Stil bekommt.
    const nurName = nur.length
      ? nur.map(s => (aktive.find(m => m.slug === s) || {}).name || s).join(', ')
      : '';
    // 9. Okt. (Rundgang): Graffiti, Bleistift, Glitzer und Disco standen ohne Bild da, und Aquarell lag auf
    // einem weissen Shirt (verboten seit 5. Okt., NIE_AUF_HELL). Ohne Beispiel - oder bei einem Stil, der
    // nie auf hellem Stoff gezeigt wird - kommt die Schrift-Kachel des Stils (stile/kacheln), nie eine leere Flaeche.
    const kachel = (await stilKacheln())[st.key] || '';
    const nimmKachel = !wahl || NIE_AUF_HELL.includes(st.key);
    out.push({
      key: st.key, label: st.label, desc: st.desc || '',
      bild: nimmKachel ? kachel : wahl.bild, ersatz: kachel, motto: wahl ? wahl.motto : '', mottoName: wahl ? wahl.name : '',
      nurMotto: nurName
    });
  }
  return out;
}
// Die Stil-Seite: eine Kachel je Stil, mit Bild, Name und einem Satz dazu. Ein Klick fuehrt
// dorthin, wo der Stil etwas nuetzt - auf das Motto, aus dem das Beispiel stammt.
function stilKachelnHtml(stile) {
  if (!stile.length) return '';
  return `<div class="wrap nur-stile"><section id="stile">`
    + `<h1 class="seitentitel">Alle <span>Stile</span></h1>`
    + `<p class="lead">Das Motto sagt, was draufsteht. Der Stil sagt, wie es aussieht – dasselbe Motto sieht in jedem Stil anders aus. ${stile.length} zur Auswahl, bei jedem Motto.</p>`
    + `<div class="stilgitter">`
    + stile.map(s => {
      const ziel = s.motto ? '/m/' + encodeURIComponent(s.motto) : '/mottos';
      const bild = s.bild
        ? `<img src="${escHtml(s.bild)}" alt="Beispiel im Stil ${escHtml(s.label)}" loading="lazy" decoding="async"${s.ersatz && s.ersatz !== s.bild ? ` data-ersatz="${escHtml(s.ersatz)}"` : ''} onerror="if(this.dataset.ersatz){this.src=this.dataset.ersatz;this.removeAttribute('data-ersatz');}else{this.closest('.stilkachel').classList.add('ohnebild');this.remove()}">`
        : '';
      const herkunft = s.nurMotto
        ? `<span class="stil-nur">nur für ${escHtml(s.nurMotto)}</span>`
        : (s.mottoName ? `<span class="stil-her">Beispiel: ${escHtml(s.mottoName)}</span>` : '');
      return `<a class="stilkachel${bild ? '' : ' ohnebild'}" href="${escHtml(ziel)}">`
        + `<span class="stil-bild">${bild}</span>`
        + `<b>${escHtml(s.label)}</b><small>${escHtml(s.desc)}</small>${herkunft}</a>`;
    }).join('')
    + `</div></section></div>`;
}
// Das Schaufenster der Startseite (Markus, 1. Okt.: "Irgendwo noch ein Fleckchen, wo wir rotierende
// Bilder auf der gleichen Stelle haben. Mit wirklich schoenen Designs"). Die Bewertungen taugen
// dafuer nicht (gemessen am 1. Okt.: 40 von 40 der "besten" stehen bei 5 Sternen, fast alle mit
// EINER Stimme), also ist die Auswahl von Hand: startseite/schaufenster.json, jedes Design vorher
// auf seiner Textilfarbe angesehen. Gezeigt wird das Design getragen (szene=1, das Design gross),
// sonst das flache Shirt - und nur, was fertig auf der Platte liegt; das Fehlende wird im
// Hintergrund gebaut und ist beim naechsten Aufruf da. Zurueckgezogene Designs fallen raus.
// Die getragene Ansicht heisst je nach Person auf dem Design _szene, _szene_frau oder _szene_mann
// (werFuerMockup) - mockupLiegtDa kennt nur die erste.
// 2. Okt.: teil (tee | hoodie) und druck (brust | gross | ruecken) aus schaufenster.json.
async function szeneLiegtDa(id, color, print, motto = '', nurThema = false, teil = 'tee', druck = '') {
  const c = (color === 'white' && print === 'dunkel' ? color + '_deckend' : color) + '_szene';
  const themaSlug = druck === 'ruecken' ? motto + '-ruecken' : motto;
  for (const wer of (nurThema ? [] : ['', '_frau', '_mann']).concat(motto ? [themaEndung(themaSlug, druck)] : [])) {
    const name = id + '_' + teil + '_' + c + wer + '_v' + mockupStandFuer(teil) + '.jpg';
    for (const end of ['', '.avif', '.webp']) { try { await fs.access(path.join(STORE, 'mockups', name + end)); return true; } catch (e) { /* weiter */ } }
  }
  return false;
}
let schaufensterStand = { zeit: 0, html: '' };
async function schaufensterHtml() {
  if (Date.now() - schaufensterStand.zeit < 10 * 60e3) return schaufensterStand.html;
  let liste = [];
  try { liste = JSON.parse(await fs.readFile(path.resolve('startseite', 'schaufenster.json'), 'utf8')).designs || []; }
  catch (e) { console.error('Schaufenster: Liste nicht lesbar:', e.message); }
  const sc = await loadShowcase();
  const alleMottos = await mottos.all();
  const STIL_NAME = {};
  for (const st of stylesForAdmin()) STIL_NAME[st.key] = st.label;
  // Ein Tag Rundung: dieselbe Adresse den ganzen Tag, sonst laedt jeder Besuch die Bilder neu.
  const exp = Math.ceil((Date.now() + 7 * 86400e3) / 86400e3) * 86400e3;
  const teile = [];
  for (const eintrag of liste) {
    // 3. Okt.: ein Eintrag kann statt einer Nummer auf ein Schaufenster-Design im Repo zeigen
    // ({ vorzeige: <motto>, stil: <stil> } - angelegt beim Start aus vorzeige-designs.json).
    let id = String(eintrag.id || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!id && eintrag.vorzeige) {
      try { id = String((await vorzeige.read(String(eintrag.vorzeige)))[String(eintrag.stil) + '#schaufenster'] || ''); } catch (e) { id = ''; }
      if (!id) { console.error('Schaufenster: ' + eintrag.vorzeige + '/' + eintrag.stil + ' ist noch nicht angelegt - faellt raus'); continue; }
    }
    const e = sc[id];
    if (!e || !e.approved) { console.error('Schaufenster: ' + id + ' ist nicht (mehr) freigegeben - faellt raus'); continue; }
    if (istBrett(e)) { console.error('Schaufenster: ' + id + ' ist ein Brett (' + e.placken + ' % voll deckend) - faellt raus'); continue; }
    const m = alleMottos.find(x => x.slug === e.motto);
    if (!m || m.active === false) continue;
    if (e.artikel && !['tee', 'hoodie', 'zip', 'polo', 'beutel'].includes(e.artikel)) continue;   // fuer Tasse, Poster ... gezeichnet: gehoert nicht aufs Shirt
    if (!markenFrei(m) && marken.check(String(e.mottoText || ''))) continue;
    let color = istHell(anzeigeTextil(e)) ? 'white' : 'black';
    const print = istHell(e.textile) ? 'hell' : 'dunkel';
    // 2. Okt., Markus: "warum immer ein T-Shirt und immer die gleiche Groesse ... mal Hoodie, mal
    // T-Shirt, mal klein, mal gross, mal was auf dem Ruecken". Je Eintrag in der Liste: teil und druck.
    const teil = eintrag.teil === 'hoodie' ? 'hoodie' : 'tee';
    const druck = DRUCK_ARTEN.includes(eintrag.druck) ? eintrag.druck : '';
    // 4. Okt. abends, Markus: "die ganzen schwarzen Textilien ... Ich moechte sie nicht mehr ... nur noch 10 %".
    // Ein Design fuer dunkles Textil kommt auf die passende Farbe (wie im Band: brett.js besteFarbe), wenn
    // die Szene des Mottos sich sauber einfaerben laesst (nur T-Shirt); sonst bleibt es schwarz und zaehlt
    // unten gegen die 10 %.
    let farbe = '';
    // 5. Okt., Markus: "Gerade Karneval sollte ziemlich bunt und grell sein" - ein Eintrag kann seine Farbe fest
    // mitbringen (schaufenster.json farbe); laesst sich die Szene nicht sauber faerben, traegt das Herstellerfoto sie.
    let farbeOhneSzene = false;
    if (teil === 'tee' && TEXTIL_FARBEN[eintrag.farbe]) {
      farbe = eintrag.farbe; color = 'white';
      const th = await szeneThemaFuer('tee', 'white', e.motto);
      farbeOhneSzene = !(th && await faerbMaske(path.join(STORE, 'templates'), 'tee-szene-thema-' + th));
    } else if (BAND_FARBIG && color === 'black' && teil === 'tee') {
      const kand = besteFarbe(e.farbMessung, FARB_HEX);
      const th = kand ? await szeneThemaFuer('tee', 'white', e.motto) : '';
      if (th && await faerbMaske(path.join(STORE, 'templates'), 'tee-szene-thema-' + th)) { farbe = kand[0]; color = 'white'; }
    }
    if (!zeigbarAuf(e, stoffVon(color, farbe))) { console.error('Schaufenster: ' + id + ' auf ' + stoffVon(color, farbe) + ' nicht zeigbar (Sichtbarkeit, Farbbiss oder Rahmen) - faellt raus'); continue; }
    const basis = `/api/mo/mockup/${id}/${teil}/${color}.jpg?exp=${exp}&sig=${signPreview(id, exp, SIGN_SECRET)}`;
    const szeneAdr = farbeOhneSzene ? basis + '&farbe=' + farbe : basis + '&szene=1' + (druck ? '&druck=' + druck : '') + (farbe ? '&farbe=' + farbe : '');
    let bild = '';
    if (farbe) {
      // Gefaerbt gibt es nur die Szene; fehlt sie noch, wird sie gebaut und das Design faellt bis dahin raus.
      const jobT = await readJob(id);
      const { cached } = await mockupPlan(id, 'tee', 'white', jobT, farbeOhneSzene ? { farbe } : { szene: '1', druck, farbe });
      let da = false;
      for (const end of ['', '.avif', '.webp']) { try { await fs.access(cached + end); da = true; break; } catch (err) { /* weiter */ } }
      if (da) bild = szeneAdr; else { mockupNachbauen(env.PUBLIC_BASE_URL + szeneAdr); continue; }
    } else {
      // Hat das Motto eine eigene Szene (SZENE_THEMEN), wird sie im Hintergrund gebaut, solange sie
      // fehlt - die Adresse bleibt dieselbe, die Route waehlt die Szene selbst.
      if (SZENE_THEMEN[e.motto] && !(await szeneLiegtDa(id, color, print, e.motto, true, teil, druck))) mockupNachbauen(env.PUBLIC_BASE_URL + szeneAdr);
      if (await szeneLiegtDa(id, color, print, e.motto, !!druck, teil, druck)) bild = szeneAdr;
      else {
        mockupNachbauen(env.PUBLIC_BASE_URL + szeneAdr);
        if (!druck && await mockupLiegtDa(id, teil, color, print)) bild = basis;
      }
    }
    if (!bild) { mockupNachbauen(env.PUBLIC_BASE_URL + basis); continue; }
    bild = await reinWennDa(bild);   // 9. Okt.: ohne Wasserzeichen, sobald die saubere Fassung da ist
    const p = new URLSearchParams();
    if (e.style) p.set('stil', e.style);
    p.set('textil', istHell(anzeigeTextil(e)) ? 'hell' : 'dunkel');
    p.set('teil', teil);
    // Markus, 1. Okt.: "Wenn wir den Design-Stil mit aufs Shirt packen, muss der natuerlich auch der
    // richtige sein." Der Stil kommt aus dem Auftrag; ein Design ohne festgehaltenen Stil (z. B. eine
    // Motto-Kachel, style "kachel") wird nicht gezeigt, statt einen geratenen Namen zu tragen.
    const stil = STIL_NAME[e.style] || '';
    if (!stil) { console.error('Schaufenster: ' + id + ' hat keinen bekannten Stil (' + (e.style || 'leer') + ') - faellt raus'); continue; }
    const wie = (teil === 'hoodie' ? 'Hoodie' : 'T-Shirt') + (farbe ? ' in ' + (TEXTIL_FARBEN[farbe].name.tee || farbe) : '') + (druck ? ', ' + DRUCK_MASSE[druck].label : '');
    const alt = `Design „${String(e.mottoText || m.name)}“ zum Motto ${m.name}, Stil ${stil}, getragen: ${wie}`;
    teile.push({ schwarz: color === 'black', html: (erstes) => `<li class="sf-bild${erstes ? ' an' : ''}"${erstes ? '' : ' aria-hidden="true"'}>`
      + `<a href="/m/${encodeURIComponent(m.slug)}?${escHtml(p.toString())}"${erstes ? '' : ' tabindex="-1"'}>`
      + `<img ${erstes ? 'src' : 'data-src'}="${escHtml(bild)}" alt="${escHtml(alt)}" width="1024" height="1024" decoding="async"${erstes ? ' loading="lazy"' : ''}>`
      + `<span class="sf-unter"><b>${escHtml(m.name)}</b><span>Stil ${escHtml(stil)} · ${escHtml(wie)}</span></span></a></li>` });
  }
  // Schwarz hoechstens 10 % der gezeigten Bilder (wie im Band): ueberzaehlige schwarze fallen von hinten weg.
  let schwarzErlaubt = Math.floor(teile.filter(t => !t.schwarz).length / 9);
  const gezeigt = teile.filter(t => !t.schwarz || schwarzErlaubt-- > 0);
  schaufensterStand = { zeit: Date.now(), html: gezeigt.map((t, i) => t.html(i === 0)).join('') };
  return schaufensterStand.html;
}
// Die neue Startseite (home-neu.html, seit 1. Okt.). Was home.html fuer Google mitbringt, bekommt
// sie hier auch: canonical, strukturierte Daten und die Motto-Kacheln als fertiges HTML - das
// Skript der Seite baut das Raster dann nicht noch einmal, sondern nur Bilder und Tueren.
async function startseiteNeuHtml() {
  const alle = (await mottos.all()).filter(inMottoListe);
  // Wie im Skript der Seite: die ERSTE Freestyle-Kachel kommt ans Ende, alles andere bleibt
  // (Gruesse aus traegt auch freestyle und ist eine normale Kachel - gemessen am 1. Okt.).
  const frei = alle.find(m => m.freestyle || m.slug === 'freestyle') || null;
  const normal = alle.filter(m => m !== frei);
  const kacheln = await mottoKacheln();
  const farbe = (c) => /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : '#F9D9A7';
  const kachel = (m, extra) => {
    const bild = kacheln[m.slug] || (m.sample ? '/api/mo/sample/' + encodeURIComponent(m.slug) + '.jpg' : '');
    const img = bild ? `<img src="${escHtml(bild)}" alt="" loading="lazy" decoding="async" width="400" height="400" onload="var g=this.parentNode.querySelector('.glyph');if(g)g.remove()" onerror="this.remove()">` : '';
    // 2. Okt.: Filter ueber den Kacheln (Gruppe / Geschenk) und der Hinweis auf eine Freigabe schon an
    // der Kachel - beim Fanclub erfuhr man sonst erst im Ablauf, dass der Verein zustimmen muss.
    const hinweis = needsApproval(m) ? '<span class="frei-hinweis">Braucht die Freigabe des Vereins</span>' : '';
    return `<li data-art="${istGruppenMotto(m.slug) ? 'gruppe' : 'einzeln'}"><a class="motto${extra ? ' ' + extra : ''}" href="/m/${encodeURIComponent(m.slug)}" style="--tc:${farbe(m.accent)}">`
      + `<div class="bild"><span class="glyph">${escHtml((m.name || '?').charAt(0))}</span>${img}</div>`
      + `<span class="name"><span class="punkt" style="background:${farbe(m.accent)}" aria-hidden="true"></span>${escHtml(m.name || m.slug)}</span>${hinweis}</a></li>`;
  };
  const html = normal.map(m => kachel(m)).join('') + (frei ? kachel(frei, 'frei-kachel') : '');
  let schaufenster = '';
  try { schaufenster = await schaufensterHtml(); } catch (e) { console.error('Schaufenster gescheitert:', e.message); }
  return (await readTpl('home-neu.html'))
    .replace(/__CANONICAL__/g, escHtml(basisUrl() + '/'))
    .replace('__LD_JSON__', ldStartseite(basisUrl()))
    .replace(/__MOTTO_ZAHL__/g, String(normal.length))
    .replace('__MOTTO_KACHELN__', () => html)   // als Funktion: ein "$" im Namen bleibt ein "$"
    .replace('__SCHAUFENSTER__', () => schaufenster)
    .replace('__SCHAUFENSTER_AUS__', schaufenster ? '' : ' hidden');
}
async function startseiteHtml(seite) {
  const alle = (await mottos.all()).filter(inMottoListe);
  const list = alle;
  const mottosJson = await Promise.all(list.map(async m => ({
    slug: m.slug, name: m.name, intro: m.intro || '', artikelFest: m.artikelFest || '',
    accent: m.accent || '#ffc542', sample: m.sample || '',
    zettel: await zettelFuer(m)
  })));
  const stylesJson = stylesForAdmin().filter(s => !s.off).map(s => ({ key: s.key, label: s.label, desc: s.desc }));
  const vergleich = await vergleichFertig().catch(() => []);
  // Der Held im Kopf ist der erste Anlass der Schnellwahl, den es wirklich gibt - genau so
  // waehlt ihn die Seite auch aus. Sein Zettel bestimmt die reservierte Hoehe.
  const held = SCHNELL_SLUGS.map(s => mottosJson.find(m => m.slug === s)).find(Boolean) || mottosJson[0];
  const woraufHtml = woraufAbschnitt(mottosJson);
  const kacheln = await mottoKacheln();
  // Welcher Anlass ist gerade dran? Kalender aus saison.js, von Hand uebersteuerbar.
  let saisonSatz = null;
  try {
    let von_hand = null;
    try { von_hand = JSON.parse(await fs.readFile(path.join(STORE, 'saison.json'), 'utf8')); } catch (e) { /* keiner gesetzt */ }
    saisonSatz = saisonJetzt(alle, { uebersteuert: von_hand });
  } catch (e) { console.error('Saison:', e && e.message ? e.message : e); }
  // Die Stil-Liste nur bauen, wenn sie auch gezeigt wird - sie liest alle Vorzeige-Faecher.
  const stileHtml = seite === 'stile' ? stilKachelnHtml(await stilUebersicht().catch(() => [])) : '';
  const html = (await readTpl('home.html'))
    .replace('__SEITE__', ['sogehts', 'mottos', 'stile'].includes(seite) ? seite : 'start')
    .replace('__HIGHLIGHT_HTML__', seite === 'start' ? aufmacherAbschnitt(saisonSatz, kacheln) : '')
    .replace('__STILE_HTML__', stileHtml)
    .replace('__WORAUF_HTML__', woraufHtml)
    .replace(/__CANONICAL__/g, escHtml(basisUrl() + (seite === 'mottos' ? '/mottos' : seite === 'stile' ? '/stile' : seite === 'sogehts' ? '/so-gehts' : '/')))
    .replace(/<title>[^<]*<\/title>/, seite === 'mottos' ? `<title>Alle Mottos – Motto Otto</title>` : seite === 'stile' ? `<title>Alle Stile – Motto Otto</title>` : '$&')
    .replace('__LD_JSON__', ldStartseite(basisUrl()))
    .replace('__GRUPPEN_HTML__', anlassKacheln(mottosJson, kacheln))
    .replace('__SCHNELL_HTML__', schnellwahl(mottosJson))
    .replace(/__ANLASS_ZAHL__/g, String(mottosJson.length))
    .replace('__ZETTEL_MIN__', String(zettelHoehe(((held && held.zettel) || []).length)))
    .replace('__SCHNELL_JSON__', JSON.stringify(SCHNELL_SLUGS))
    .replace('__MOTTOS_JSON__', JSON.stringify(mottosJson).replace(/</g, '\\u003c'))
    .replace('__STYLES_JSON__', JSON.stringify(stylesJson).replace(/</g, '\\u003c'))
    .replace('__VERGLEICH_JSON__', JSON.stringify(vergleich).replace(/</g, '\\u003c'));
  // Fassung 77b: Hier stand "max-age=0, must-revalidate" - gedacht als Sparmassnahme fuer den
  // zweiten Besuch (304 statt 26 kB). Das war ein Fehlschluss: es zwingt JEDEN Aufruf, erst
  // beim Server nachzufragen, bevor irgendetwas erscheint. Der Besucher zahlt damit immer den
  // Weg nach Railway, auch wenn er die Seite eben noch offen hatte. 26 kB sind schnell
  // geladen, ein Weg um die halbe Welt nicht. Also kein Header mehr: der Browser entscheidet
  // selbst, und wer die Seite gerade gesehen hat, sieht sie sofort wieder.
  return html;
}

// ---------- Bilder der Figur Otto ----------
// Der Entwicklungsrechner kommt nicht ans offene Netz, Railway schon - genau wie bei den
// Mockup-Vorlagen holt der Server die Bilder deshalb selbst und legt sie aufs Volume.
// Eintragen in otto-bilder.json, Rest passiert beim naechsten Start von allein.
const OTTO_DIR = path.join(STORE, 'otto');
async function ottoBilderHolen() {
  let cfg = {};
  try { cfg = JSON.parse(await fs.readFile(path.resolve('otto-bilder.json'), 'utf8')); }
  catch (e) { return; }
  await fs.mkdir(OTTO_DIR, { recursive: true });
  for (const [name, e] of Object.entries(cfg)) {
    if (name.startsWith('_') || !e || !e.url) continue;
    const ziel = path.join(OTTO_DIR, name.replace(/[^a-z0-9-]/gi, '') + '.png');
    try { await fs.access(ziel); continue; } catch (e2) { /* fehlt noch */ }
    try {
      const r = await fetch(e.url, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      await fs.writeFile(ziel, Buffer.from(await r.arrayBuffer()));
      console.log('Otto-Bild geholt:', name);
    } catch (err) { console.error('Otto-Bild', name, 'nicht geladen:', err && err.message ? err.message : err); }
  }
}
// Erst das Volume (ein spaeter nachgelegtes Bild gewinnt), dann der Ordner otto/ im Repo -
// dort liegt Otto am Schreibtisch fest mit drin, damit die Startseite ihn ohne Umweg hat.
app.get('/api/mo/otto/:file', async (req, res) => {
  const name = String(req.params.file).replace(/\.png$/i, '').replace(/[^a-z0-9-]/gi, '');
  if (!name) return res.status(404).end();
  for (const ort of [path.join(OTTO_DIR, name + '.png'), path.resolve('otto', name + '.png')]) {
    try {
      const png = await fs.readFile(ort);
      return res.type('png').set('cache-control', 'public, max-age=86400').send(png);
    } catch (e) { /* naechster Ort */ }
  }
  res.status(404).end();
});
// Nach dem Start, damit der Server sofort antwortet
setTimeout(() => ottoBilderHolen().catch(e => console.error('Otto-Bilder:', e)), 8000);

// ---------- Fassung 35: Vergleich Standard-KI gegen Motto Otto (Startseite) ----------
// Gleiche Mechanik wie die Otto-Bilder: Rohbilder stehen als URL in vergleich-bilder.json, der
// Server holt sie beim Start aufs Volume und leitet A / B / Lupe ab (images.vergleichAbleiten).
// Eine geaenderte URL baut das Beispiel neu; ohne fertige Dateien fehlt der Abschnitt.
const VERGLEICH_DIR = path.join(STORE, 'vergleich');
const VERGLEICH_TEILE = ['standard-a', 'standard-b', 'standard-lupe', 'otto-a', 'otto-b', 'otto-lupe'];
async function vergleichLesen() {
  try { return JSON.parse(await fs.readFile(path.resolve('vergleich-bilder.json'), 'utf8')); }
  catch (e) { return null; }
}
async function vergleichBauen() {
  const cfg = await vergleichLesen();
  if (!cfg || !Array.isArray(cfg.beispiele)) return;
  await fs.mkdir(VERGLEICH_DIR, { recursive: true });
  for (const b of cfg.beispiele) {
    const id = String(b.id || '').replace(/[^a-z0-9-]/gi, '');
    if (!id || !b.standard || !b.otto || !b.standard.url || !b.otto.url) continue;
    const quelleDatei = path.join(VERGLEICH_DIR, id + '.quelle.json');
    let quelle = null;
    try { quelle = JSON.parse(await fs.readFile(quelleDatei, 'utf8')); } catch (e) { /* noch nie gebaut */ }
    const fertig = await Promise.all(VERGLEICH_TEILE.map(t => fs.access(path.join(VERGLEICH_DIR, `${id}-${t}.png`)).then(() => true, () => false)));
    if (quelle && quelle.standard === b.standard.url && quelle.otto === b.otto.url && fertig.every(Boolean)) continue;
    try {
      for (const art of ['standard', 'otto']) {
        const r = await fetch(b[art].url, { signal: AbortSignal.timeout(60000) });
        if (!r.ok) throw new Error(art + ': HTTP ' + r.status);
        const roh = Buffer.from(await r.arrayBuffer());
        await fs.writeFile(path.join(VERGLEICH_DIR, `${id}-${art}-roh.png`), roh);
        const teile = await mitBildarbeit('Vergleich ' + id + ' ' + art, () => vergleichAbleiten(art, roh));
        await fs.writeFile(path.join(VERGLEICH_DIR, `${id}-${art}-a.png`), teile.a);
        await fs.writeFile(path.join(VERGLEICH_DIR, `${id}-${art}-b.png`), teile.b);
        await fs.writeFile(path.join(VERGLEICH_DIR, `${id}-${art}-lupe.png`), teile.lupe);
      }
      await fs.writeFile(quelleDatei, JSON.stringify({ standard: b.standard.url, otto: b.otto.url, gebaut: new Date().toISOString() }));
      console.log('Vergleich gebaut:', id);
    } catch (err) { console.error('Vergleich', id, 'nicht gebaut:', err && err.message ? err.message : err); }
  }
}
// Welche Beispiele sind komplett da? Fuer die Startseite.
async function vergleichFertig() {
  const cfg = await vergleichLesen();
  if (!cfg || !Array.isArray(cfg.beispiele)) return [];
  const out = [];
  for (const b of cfg.beispiele) {
    const id = String(b.id || '').replace(/[^a-z0-9-]/gi, '');
    if (!id) continue;
    const da = await Promise.all(VERGLEICH_TEILE.map(t => fs.access(path.join(VERGLEICH_DIR, `${id}-${t}.png`)).then(() => true, () => false)));
    if (da.every(Boolean)) out.push({ id, titel: String(b.titel || ''), auftrag: String(b.auftrag || '') });
  }
  return out;
}
app.get('/api/mo/vergleich/:file', async (req, res) => {
  const name = String(req.params.file).replace(/\.png$/i, '').replace(/[^a-z0-9-]/gi, '');
  if (!name || name.endsWith('-roh')) return res.status(404).end();
  try {
    const png = await fs.readFile(path.join(VERGLEICH_DIR, name + '.png'));
    res.type('png').set('cache-control', 'public, max-age=86400').send(png);
  } catch (e) { res.status(404).end(); }
});
setTimeout(() => vergleichBauen().catch(e => console.error('Vergleich:', e)), 15000);

// Hauptbild je Motto: bevorzugt das kuratierte Vorzeige-Design "Wie vorgesehen" (lizenzsicher, identisch mit
// der Galerie-Kachel), sonst das im Backend gesetzte Beispiel. So zeigt kein Motto mehr ein altes Design.
async function heroDesignId(m) {
  // Komplett gesperrte Mottos liefern gar kein Bild - sonst rutscht hier der Rueckfall auf
  // m.sample durch und das aussortierte Design steht wieder im Kopf. Genau das ist passiert.
  if (vorzeige.komplettGesperrt(m.slug)) return null;
  // 'kachel' ist der eigene Aufmacher des Mottos (kann fuer helles Textil gezeichnet sein), sonst der Standard-Stil
  try { const vz = await vorzeige.read(m.slug); if (vz && (vz.kachel || vz.standard)) return vz.kachel || vz.standard; } catch (e) { /* kein Vorzeige */ }
  return m.sample || null;
}

// Eigene Seite je Motto
app.get('/m/:slug', async (req, res) => {
  const m = await mottos.get(req.params.slug);
  if (!m || m.active === false) return res.redirect('/');
  // Fassung 74: Welches Motto wird ueberhaupt aufgerufen - und wie viele davon werden zu einem
  // Auftrag? Erst das Verhaeltnis 'seite' zu 'auftrag' sagt, ob ein Motto zieht.
  zaehl('seite', m.slug);
  const title = `${m.name} – Motto Otto`;
  const desc = m.intro || `${m.name}-Shirt in ein paar Minuten gestaltet.`;
  const heroId = await heroDesignId(m);
  const sample = heroId ? `/api/mo/sample/${m.slug}.jpg?v=${encodeURIComponent(heroId)}` : '';
  const html = (await readTpl('motto.html'))
    .replace(/__TITLE__/g, escHtml(title))
    .replace(/__DESC__/g, escHtml(desc))
    .replace(/__OG__/g, escHtml(sample ? env.PUBLIC_BASE_URL + sample : ''))
    .replace(/__ACCENT__/g, escHtml(m.accent || '#ffc542'))
    .replace(/__HEADLINE__/g, escHtml(m.headline || m.name))
    .replace(/__TEXT__/g, escHtml(m.text || m.intro || ''))
    .replace(/__SAMPLE__/g, escHtml(sample))
    .replace(/__CANONICAL__/g, escHtml(basisUrl() + '/m/' + encodeURIComponent(m.slug)))
    .replace('__LD_JSON__', ldMottoseite(basisUrl(), m))
    .replace(/__ASSET_V__/g, await assetV());   // zweimal drin: Vorabruf im Kopf und das Skript selbst
  let styleSamples = await vorzeige.publicSamples(m.slug);
  if (!styleSamples || !Object.keys(styleSamples).length) styleSamples = await autoStyleSamples(m.slug);
  // Stil-Kacheln (Schrift im eigenen Stil) fuer alle Mottos ausser denen mit festem Artikel
  if (!m.artikelFest) { const k = await stilKacheln(); for (const [st, url] of Object.entries(k)) styleSamples[st] = url; }
  // Fassung 68: dasselbe fuer die Figurenwahl - wer waehlen soll, muss sehen koennen.
  const figurenSamples = await autoFigurenSamples(m.slug);
  const html2 = html.replace('__MOTTO_JSON__', JSON.stringify({
    ...publicView(withBezug(m)), gruppe: istGruppenMotto(m.slug), styleSamples, figurenSamples, sizes: SIZES, artikel: artikelFuer(m.slug),
    kaufformen: kaufformen.publicView()
  }).replace(/</g, '\\u003c'));
  // 27. Sept.: die Seite selbst darf nicht aus dem Speicher kommen, ohne beim Server nachzufragen
  // (ETag). Sonst haengt an einer alten Seite die alte Skriptadresse - und der Deploy kommt nie an.
  res.set('Cache-Control', 'no-cache').type('html').send(html2);
});

// Uebersichts-Kacheln: nicht ueberall dasselbe T-Shirt. Je Motto ein festes Teil aus T-Shirt, Hoodie und
// Zip-Jacke - damit die Startseite abwechslungsreich aussieht und die Kachel sich trotzdem nie aendert.
// Wo ein Teil zum Anlass gehoert, steht es fest (Abi-Hoodie, Vereins-Jacke); alles andere kommt aus dem Namen.
const SAMPLE_GARMENTS = ['tee', 'hoodie', 'zip'];
// 7. Okt., Markus (ABIrama Neon fuer "So geht's"): "Mach mal bitte Neon auf einen weissen Hoody" - "Weiss". Die Stofffarbe der
// Startseiten-Kachel, wo Markus sie festgelegt hat; sonst folgt sie dem Design (hell gezeichnet -> weiss, sonst schwarz).
const SAMPLE_FARBE = { 'abi': 'white' };
const SAMPLE_FIXED = {
  'abi': 'hoodie', 'abschlussfahrt': 'hoodie', 'schulmotto': 'hoodie', 'fan-shirt': 'hoodie',
  'landwirt-shirt': 'hoodie', 'motorrad-shirt': 'hoodie', 'handwerker-shirt': 'hoodie',
  'fanclub': 'zip', 'vereinsjubilaeum': 'zip', 'firmenausflug': 'zip', 'meister-shirt': 'zip',
  'angler-shirt': 'zip', 'jaeger-shirt': 'zip',
  'junggesellenabschied': 'tee', 'malle-fahrt': 'tee', 'geburtstag': 'tee', 'kegeltour': 'tee',
  'tier-shirt': 'tee', 'kinder-tiershirt': 'tee', 'sprueche-shirt': 'tee', 'karneval': 'tee',
  'familie': 'tee', 'geburt-baby': 'tee', 'weihnachtsfeier': 'tee', 'hochzeit': 'tee',
  'darts': 'tee', 'bowling': 'polo'
};
function sampleGarment(slug) {
  if (SAMPLE_FIXED[slug]) return SAMPLE_FIXED[slug];
  let n = 0;
  for (const c of String(slug)) n = (n * 33 + c.charCodeAt(0)) % 100003;
  return SAMPLE_GARMENTS[n % SAMPLE_GARMENTS.length];
}

// ---------- Fassung 90: Warum zeigt eine Startseiten-Kachel kein Bild? ----------
// Markus, 18. Sept., 20:53, mit Bildschirmfoto: "Keine Bilder werden angezeigt." Die Route
// darunter fing bis dahin JEDEN Fehler und antwortete mit einem nackten 404 - ohne eine Zeile
// im Protokoll. Die Kachel zeigte dann still ihren Buchstaben. Von auszen war nicht zu sagen,
// welches Glied der Kette gerissen war: Vorzeige-Design, Druckdatei, Archiv oder Vorlage.
// Jetzt merkt sich der Server je Motto den letzten Grund, und die Lage-Karte prueft alle
// Glieder der Kette, ohne ein einziges Bild zu rechnen.
const kachelFehler = new Map();   // slug -> { heroId, grund, wann }

async function kachelDiagnose() {
  const liste = (await mottos.all()).filter(m => m.active !== false);
  const probleme = [];
  let ok = 0;
  for (const m of liste) {
    const heroId = await heroDesignId(m);
    if (!heroId) { probleme.push({ slug: m.slug, grund: 'kein Vorzeige-Design' }); continue; }
    const j = await readJob(heroId);
    const color = j && istHell(j.textile) ? 'white' : 'black';
    const garment = sampleGarment(m.slug);
    // 1) Fertiges Mockup im Zwischenspeicher? Dann liefert die Kachel sofort.
    try { await fs.access(path.join(STORE, 'mockups', `sample_${m.slug}_${heroId}_${garment}_${color}.jpg`)); ok++; continue; }
    catch (e) { /* muss gerechnet werden - also weiter pruefen */ }
    // 2) Druckdatei lokal? Sonst muesste sie aus dem Archiv kommen. Das ist der langsame,
    //    stoeranfaellige Weg - und bei einem Drive-Problem fallen ALLE Kacheln gleichzeitig.
    let masterLokal = true;
    try { await fs.access(path.join(STORE, 'masters', `${heroId}_PRINT_MASTER.png`)); } catch (e) { masterLokal = false; }
    if (!masterLokal && await istGeloescht(heroId)) { probleme.push({ slug: m.slug, grund: `Vorzeige-Design ${heroId} ist gelöscht` }); continue; }
    // 3) Vorlage fuer das Teil da?
    if (!(await templateReady(garment, color))) { probleme.push({ slug: m.slug, grund: `Vorlage ${garment}_${color} fehlt` }); continue; }
    // 4) Ist die Kachel zuletzt an genau diesem Design gescheitert? Dann den echten Grund zeigen.
    const f = kachelFehler.get(m.slug);
    if (f && f.heroId === heroId) { probleme.push({ slug: m.slug, grund: f.grund + (masterLokal ? '' : ' (Druckdatei nur im Archiv)') }); continue; }
    if (!masterLokal) { probleme.push({ slug: m.slug, grund: `Druckdatei ${heroId} nur im Archiv – wird beim ersten Aufruf geholt`, weich: true }); continue; }
    ok++;
  }
  return { gesamt: liste.length, ok, probleme };
}

// Beispielbild je Motto: das Mockup eines gespeicherten Designs, ohne Wasserzeichen
app.get('/api/mo/sample/:file', async (req, res) => {
  const slug = String(req.params.file).replace(/\.jpg$/i, '');
  const m = await mottos.get(slug);
  const heroId = m ? await heroDesignId(m) : null;
  if (!m || !heroId) return res.status(404).end();
  // Die Farbe folgt dem Design: fuer helles Textil gezeichnete Designs (dunkle Schrift) kommen auf ein weisses
  // Teil, alle anderen auf ein schwarzes. Andersherum waere die helle Schrift auf hellem Stoff unsichtbar.
  const j = await readJob(heroId);
  const print = j && istHell(j.textile) ? 'hell' : 'dunkel';
  const color = SAMPLE_FARBE[m.slug] || (print === 'hell' ? 'white' : 'black');
  // Fassung 78: Mit ?a=kissen laesst sich dasselbe Design auf einem anderen Artikel zeigen -
  // dafuer braucht die Startseite den Abschnitt "Ein Design, und dann?". Ohne ?a bleibt alles
  // wie vorher: das Teil, das zum Anlass passt.
  const gewuenscht = String(req.query.a || '');
  // Fassung 79, Markus: "Das, was auf dem Eingabefeld ist, ist das Design, was entsteht - am
  // besten ohne Textil - und das auf dem Textil sollte natuerlich das Gleiche sein. Wir haben
  // jetzt drei unterschiedliche Sachen da drauf." Mit ?a=motiv kommt GENAU DASSELBE Design wie
  // ohne Parameter, nur nackt: kein Teil drumherum, nur das Motiv auf ruhigem Grund. Damit
  // zeigen Schritt 2 und Schritt 3 der Startseite dieselbe Arbeit, einmal blank und einmal
  // gedruckt - statt zweier Designs, die nichts miteinander zu tun haben.
  // 20. Sept.: ein Motto mit festem Artikel (Postkarte) zeigt immer das reine Motiv - kein Textil.
  const nurMotiv = gewuenscht === 'motiv' || !!m.artikelFest;
  const garment = GARMENTS[gewuenscht] ? gewuenscht : sampleGarment(m.slug);
  const hinten = req.query.seite === 'hinten' && !nurMotiv && ['tee', 'hoodie'].includes(garment);
  const cached = path.join(STORE, 'mockups',
    nurMotiv ? `sample_${m.slug}_${heroId}_motiv_${color}.jpg`
             : `sample_${m.slug}_${heroId}_${garment}_${color}${hinten ? '_hinten' : ''}_v${mockupStandFuer(garment)}.jpg`);   // 7. Okt.: mit Stand, sonst bleibt eine alte Platzierung (Hoodie-Kordeln) liegen
  res.set('cache-control', 'public, max-age=3600');
  if (await sendBestesBild(req, res, cached)) return;
  try {
    const jpg = await kachelBauen({ slug: m.slug, heroId, print, color, garment, nurMotiv, cached, hinten });
    res.type('jpeg').set('cache-control', 'public, max-age=3600').send(jpg);
  } catch (e) {
    res.status(404).end();
  }
});

// Eine Kachel der Startseite rechnen - ueber die Platzgrenze, nur einmal je Datei, und mit
// dem Grund in Protokoll und Lage-Karte, wenn es scheitert. Gemeinsamer Weg fuer den Aufruf
// von der Seite und fuer das Vorwaermen beim Start.
async function kachelBauen({ slug, heroId, print, color, garment, nurMotiv, cached, hintergrund = false, hinten = false }) {
  try {
    return await bildEinmal(cached, async () => {
      // 7. Okt., Markus: "auch zu sehen sein, wie das Ganze von hinten aussehen kann mit Namen" - ?seite=hinten: die Rueckseite
      // des Designs (KI-Rueckseite oder Namensliste) auf dem Foto von hinten.
      const master = hinten ? await backMaster(heroId) : await masterLesen(heroId);
      let jpg;
      if (nurMotiv) {
        // Der Grund folgt dem Druck: ein fuer dunkles Textil gezeichnetes Motiv ist hell und
        // waere auf Weiss unsichtbar. Etwas Luft ringsum, damit es nicht am Rand klebt.
        const grund = print === 'hell' ? { r: 242, g: 240, b: 236 } : { r: 23, g: 22, b: 29 };
        const motiv = await sharp(master).resize(820, 820, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
        jpg = await sharp({ create: { width: 900, height: 900, channels: 3, background: grund } })
          .composite([{ input: motiv, gravity: 'centre' }])
          .jpeg({ quality: 86 }).toBuffer();
      } else {
        jpg = await makeMockup(master, garment, color, false, hinten ? { print, linie: LINIE_STANDARD, place: 'back', rueckenFoto: true } : { print, linie: LINIE_STANDARD });
      }
      await fs.writeFile(cached, jpg);
      return jpg;
    }, { hintergrund });
  } catch (e) {
    // Nie wieder stumm. Der Grund geht ins Protokoll UND in die Lage-Karte.
    const grund = e && e.message ? e.message : String(e);
    console.error('Kachel ohne Bild:', slug, '· Design', heroId, '·', grund);
    kachelFehler.set(slug, { heroId, grund: grund.slice(0, 160), wann: new Date().toISOString() });
    throw e;
  }
}

// 19. Sept., 13:30: nach einem Start mit leerem Zwischenspeicher hat der ERSTE Besucher alle
// Kacheln auf einmal ausgeloest und den Server minutenlang lahmgelegt (siehe bildEinmal).
// Deshalb baut der Server die Kacheln jetzt selbst vor, gleich nach dem Aufraeumen beim
// Start - eine nach der anderen, im Hintergrund. Wer danach kommt, bekommt fertige Bilder.
// Nur die Anlass-Kacheln (eine je Motto); die Reihe "Fuer jeden Artikel" laeuft ohnehin
// ueber die Platzgrenze in vorzeige.js.
async function kachelnVorwaermen() {
  const t0 = Date.now();
  let gebaut = 0, lagenDa = 0, schief = 0;
  for (const m of (await mottos.all()).filter(x => x.active !== false)) {
    try {
      const heroId = await heroDesignId(m);
      if (!heroId) continue;
      const j = await readJob(heroId);
      const print = j && istHell(j.textile) ? 'hell' : 'dunkel';
      const color = SAMPLE_FARBE[m.slug] || (print === 'hell' ? 'white' : 'black');
      const garment = sampleGarment(m.slug);
      const cached = path.join(STORE, 'mockups', `sample_${m.slug}_${heroId}_${garment}_${color}_v${mockupStandFuer(garment)}.jpg`);   // derselbe Name wie die Route
      try { await fs.access(cached); lagenDa++; continue; } catch (e) { /* bauen */ }
      if (!(await templateReady(garment, color))) { schief++; continue; }
      await kachelBauen({ slug: m.slug, heroId, print, color, garment, nurMotiv: false, cached, hintergrund: true });
      gebaut++;
    } catch (e) { schief++; }
  }
  const dauer = Math.round((Date.now() - t0) / 1000);
  if (gebaut || schief) console.log(`Kacheln vorgewaermt: ${gebaut} gebaut, ${lagenDa} lagen da, ${schief} nicht baubar · ${dauer} s`);
  return { gebaut, lagenDa, schief, dauer };
}

// Beispielbild je Motto UND Stil (falls vorhanden). Dateiname: stylesample_<slug>_<stil>.jpg
// Wird spaeter durch generierte Galerie-Bilder gefuellt; fehlt es, kommt 404 -> Platzhalter.
app.get('/api/mo/style-sample/:slug/:style', async (req, res) => {
  const slug = String(req.params.slug).replace(/[^a-z0-9-]/gi, '');
  const style = String(req.params.style).replace(/\.jpg$/i, '').replace(/[^a-z0-9-]/gi, '');
  const file = path.join(STORE, 'mockups', `stylesample_${slug}_${style}.jpg`);
  res.set('cache-control', 'public, max-age=3600');
  if (!(await sendBestesBild(req, res, file))) res.status(404).end();
});

app.get('/alle', (req, res) => res.sendFile(path.resolve('index.html')));
app.get('/admin', (req, res) => res.sendFile(path.resolve('admin.html')));
// 6. Okt.: die Band-Freigabe (CLAUDE.md 44). Meine Vorauswahl (bandVorschlag), Markus' Ja/Nein (bandFrei).
app.get('/admin/band', (req, res) => res.sendFile(path.resolve('band-freigabe.html')));
app.get('/api/admin/band-freigabe', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const sc = await loadShowcase();
  const designs = [];
  const STIL_LABEL = {}; for (const st of stylesForAdmin()) STIL_LABEL[st.key] = st.label;
  for (const [id, e] of Object.entries(sc)) {
    if (!e || !e.approved || !(e.bandVorschlag || typeof e.bandFrei === 'boolean')) continue;
    const exp = Date.now() + 7 * 86400e3, sig = signPreview(id, exp, SIGN_SECRET);
    const farbe = istHell(anzeigeTextil(e)) ? 'white' : 'black';
    const teil = e.bandTeil && GARMENTS[e.bandTeil] ? e.bandTeil : 'tee';
    const bb = bandBildPruefen(e.bandBild);
    // Was genau zu sehen ist: Teil, Seite, Linie bzw. Szene, Groesse, Stil.
    let groesse = '';
    try { const aj = artikelVon(await readJob(id)); groesse = aj && aj.label ? String(aj.label) : 'Standardgröße'; } catch (e2) { groesse = ''; }
    const lb = bb && bb.linie ? linieBeschriftung(bb.linie, bb.teil) : null;
    const darstellung = bb ? [GARMENTS[bb.teil].label, bb.farbe ? TEXTIL_FARBEN[bb.farbe].label : bb.color === 'black' ? 'schwarz' : 'weiß', bb.seite ? 'von hinten' : 'von vorne', lb ? lb.text : bb.szene ? 'in Szene' : 'Herstellerfoto', groesse, STIL_LABEL[e.style] || e.style || ''].filter(Boolean).join(' · ') : '';
    designs.push({ designId: id, motto: e.motto || '', mottoText: e.mottoText || '', stil: STIL_LABEL[e.style] || e.style || '', frei: typeof e.bandFrei === 'boolean' ? e.bandFrei : null,
      vorschlag: !!e.bandVorschlag, notiz: e.bandNotiz || '', darstellung,
      bild: bb ? bandBildUrl(id, bb) : `${env.PUBLIC_BASE_URL}/api/mo/mockup/${id}/${teil}/${farbe}.jpg?exp=${exp}&sig=${sig}`,
      motiv: `${env.PUBLIC_BASE_URL}/api/mo/preview/${id}.png?exp=${exp}&sig=${sig}` });
  }
  designs.sort((a, b) => (a.frei === null ? 0 : 1) - (b.frei === null ? 0 : 1) || a.designId.localeCompare(b.designId));
  res.json({ designs });
});
// Fuer meine Vorauswahl (6. Okt.): alle freigegebenen Designs mit dem, was fuer die Mischung zaehlt - Artikel, Rueckseite, Groesse, Stil.
app.get('/api/admin/band-kandidaten', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const sc = await loadShowcase();
  const liste = [];
  for (const [id, e] of Object.entries(sc)) {
    if (!e || !e.approved || e.anna) continue;
    let aj = null, j = null;
    try { j = await readJob(id); aj = artikelVon(j); } catch (e2) { aj = null; }
    liste.push({ designId: id, slug: e.motto || '', mottoText: e.mottoText || '', stil: e.style || (j && j.style) || '', textile: anzeigeTextil(e), bestellt: e.textile || '',
      artikel: e.artikel || '', quer: e.artikelQuer ?? null, back: !!(e.back || (j && j.back && j.back.count)), seite: aj && aj.seite ? aj.seite : '',
      groesse: aj && aj.label ? String(aj.label) : '', netto: aj && aj.netto ? aj.netto : null, artikelId: aj && aj.id ? aj.id : '',
      zeigbarWeiss: zeigbarAuf(e, 'weiss'), zeigbarSchwarz: zeigbarAuf(e, 'schwarz'), created: (j && j.created) || e.created || '',
      bandFrei: typeof e.bandFrei === 'boolean' ? e.bandFrei : null, vorschlag: !!e.bandVorschlag });
  }
  res.json({ designs: liste });
});
app.post('/api/admin/band-freigabe', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const id = String((req.body || {}).designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const frei = (req.body || {}).frei;
  const sc = await loadShowcase();
  if (!sc[id]) return res.status(404).json({ error: 'unbekanntes Design' });
  if (frei === true || frei === false) sc[id].bandFrei = frei; else delete sc[id].bandFrei;
  sc[id].bandFreiAm = new Date().toISOString();
  await saveShowcase();
  console.log('Band-Freigabe:', id, frei === true ? 'ja' : frei === false ? 'nein' : 'offen');
  res.json({ ok: true, frei: sc[id].bandFrei ?? null });
});
// Meine Vorauswahl: { ids: [...], notiz?: {id: text}, teil?: {id: garment}, bild?: {id: {teil, color, seite, linie, szene}} } - setzt
// bandVorschlag; aendert Markus' Entscheidung nur, wenn das Bild ein anderes ist (dann ist sie wieder offen).
// { zurueck: [...] } nimmt offene Vorschlaege wieder heraus (nie eine Entscheidung von Markus).
app.post('/api/admin/band-vorschlag', (req, res, next) => adminGuard(req, res, next), async (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map(x => String(x).replace(/[^A-Za-z0-9_-]/g, '')) : [];
  const notiz = (req.body || {}).notiz || {}, teil = (req.body || {}).teil || {}, bild = (req.body || {}).bild || {};
  const sc = await loadShowcase();
  let n = 0;
  for (const id of ids) {
    if (!sc[id]) continue;
    sc[id].bandVorschlag = true;
    if (notiz[id]) sc[id].bandNotiz = String(notiz[id]).slice(0, 200);
    if (teil[id] && GARMENTS[teil[id]]) sc[id].bandTeil = teil[id];
    const bb = bandBildPruefen(bild[id]);
    // Ein anderes Bild ist eine neue Frage an Markus - seine alte Antwort galt dem alten Bild.
    if (bb && JSON.stringify(bb) !== JSON.stringify(bandBildPruefen(sc[id].bandBild))) { sc[id].bandBild = bb; delete sc[id].bandFrei; }
    n++;
  }
  let zurueck = 0;
  for (const id of (Array.isArray((req.body || {}).zurueck) ? req.body.zurueck : []).map(x => String(x).replace(/[^A-Za-z0-9_-]/g, ''))) {
    const e = sc[id];
    if (!e || typeof e.bandFrei === 'boolean' || !e.bandVorschlag) continue;
    delete e.bandVorschlag; delete e.bandNotiz; delete e.bandTeil; delete e.bandBild; zurueck++;
  }
  await saveShowcase();
  res.json({ ok: true, vorgeschlagen: n, zurueck });
});

// Letzte Entwuerfe fuers Backend
// 21. Sept., Markus: "Warum sind im Backend einige Designs, die ich erstellt hab, nicht mehr
// vorhanden?" Sie waren da - die Liste zeigte nur die 60 juengsten Auftraege, und die beim Start
// angelegten Vorzeige-Designs (31 allein fuer die Postkarte) hatten seine eigenen verdraengt.
// Jetzt: Vorzeige- und Automatik-Auftraege bleiben draussen (?alle=1 zeigt sie), und es werden
// die 200 juengsten Kundenauftraege gezeigt.
app.get('/api/admin/jobs', adminGuard, async (req, res) => {
  const dir = path.join(STORE, 'jobs');
  const alle = String(req.query.alle || '') === '1';
  try {
    const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'));
    const withTime = [];
    for (const f of files) { const st = await fs.stat(path.join(dir, f)); withTime.push({ f, t: st.mtimeMs }); }
    withTime.sort((a, b) => b.t - a.t);
    const out = [];
    let ausgeblendet = 0;
    // 28. Sept., Markus: "Warum sehe ich im Backend nur Designs, die ich oder du erstellt haben?"
    // Die Liste hat nie gesagt, VON WEM ein Design ist - Konto, Gast, Vorzeige sahen gleich aus.
    // Jetzt steht es dran: die E-Mail des Kontos, sonst "Gast" (ohne Anmeldung), und ob es die
    // Seite, ein Firmenkonto oder der Pruefstand war (via). Gastdesigns landen hier genauso wie
    // Kontodesigns - es gibt keinen Filter nach Person.
    const mails = new Map();
    const wer = async (j) => {
      if (j.test) return 'Pruefstand';
      if (j.vorzeige || j.auto) return 'Vorzeige';
      if (!j.user) return 'Gast';
      if (!mails.has(j.user)) { try { const u = await accounts.byId(j.user); mails.set(j.user, (u && u.email) || 'Konto'); } catch (e) { mails.set(j.user, 'Konto'); } }
      return mails.get(j.user);
    };
    for (const { f } of withTime) {
      if (out.length >= 200) break;
      try {
        const j = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
        if (!alle && (j.vorzeige || j.auto)) { ausgeblendet++; continue; }
        const exp = Date.now() + 86400e3;
        out.push({ designId: j.designId, motto: j.motto, values: j.values, von: await wer(j), quelle: j.quelle || '', firma: j.firma || '', hinweis: (j.artikel && j.artikel.warnung) || '', style: j.style || 'standard', colors: j.colors || '', variation: j.variation || '', names: j.names || [], people: j.people || [], aufteilung: j.aufteilung || 'vorne', textile: j.textile || 'dunkel', research: j.research ? { pun_source: j.research.pun_source, theme: j.research.theme } : null, created: j.created, qa: (j.qa || []).at(-1), rueckseite: j.rueckseite ? { an: j.rueckseite.adresse && j.rueckseite.adresse.name, ort: j.rueckseite.adresse && j.rueckseite.adresse.ort } : null,
          preview: `/api/mo/preview/${j.designId}.png?exp=${exp}&sig=${signPreview(j.designId, exp, SIGN_SECRET)}`,
          mockup: `/api/mo/mockup/${j.designId}/tee/${istHell(j.textile) ? 'white' : 'black'}.jpg?exp=${exp}&sig=${signPreview(j.designId, exp, SIGN_SECRET)}` });
      } catch (e) { /* ueberspringen */ }
    }
    res.json({ jobs: out, ausgeblendet, gesamt: files.length });
  } catch (e) { res.json({ jobs: [] }); }
});
// Google Drive: verbinden (OAuth, der Chef klickt selbst), Status, alles nachladen
app.get('/api/admin/gdrive/status', adminGuard, async (req, res) => res.json(await drive.status()));
app.get('/api/admin/gdrive/connect', adminGuard, (req, res) => {
  if (!drive.enabled()) return res.status(503).send('GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET fehlen in Railway');
  res.redirect(drive.authUrl());
});
app.get('/api/admin/gdrive/callback', async (req, res) => {
  try { const st = await drive.connect(String(req.query.code || '')); res.redirect('/admin?gdrive=' + encodeURIComponent(st.email || 'ok')); }
  catch (e) { res.status(400).send('Google Drive konnte nicht verbunden werden: ' + escHtml(String(e.message || e))); }
});
app.post('/api/admin/gdrive/disconnect', adminGuard, async (req, res) => { await drive.disconnect(); res.json({ ok: true }); });
app.post('/api/admin/gdrive/push', adminGuard, async (req, res) => {
  const one = String((req.body || {}).designId || '').replace(/[^A-Za-z0-9_-]/g, '');
  let ids = [];
  if (one) ids = [one];
  else {
    try { ids = (await fs.readdir(path.join(STORE, 'masters'))).filter(f => f.endsWith('_PRINT_MASTER.png')).map(f => f.replace('_PRINT_MASTER.png', '')); } catch (e) { ids = []; }
    if (!(req.body || {}).all) { const out = []; for (const id of ids) { const j = await readJob(id); if (!(j && j.drive)) out.push(id); } ids = out; }
  }
  res.json({ queued: ids.length });
  (async () => { for (const id of ids) { try { await pushToDrive(id); } catch (e) { console.error('Drive nachladen', id, e && e.message ? e.message : e); } } })();
});

app.get('/api/admin/users', adminGuard, async (req, res) => {
  const list = await accounts.all();
  res.json({ users: list.map(u => ({ id: u.id, email: u.email, created: u.created, lastLogin: u.lastLogin, designs: u.designs.length, freeUsed: u.freeUsed, credits: u.credits, plan: u.plan, planUsed: u.planUsed, planPeriodEnd: u.planPeriodEnd ? new Date(u.planPeriodEnd).toISOString() : null })) });
});
app.post('/api/admin/users/:id/credits', adminGuard, async (req, res) => {
  const u = await accounts.byId(req.params.id);
  if (!u) return res.status(404).json({ error: 'unbekannt' });
  u.credits = Math.max(0, u.credits + (+(req.body || {}).delta || 0));
  res.json({ user: await accounts.save(u) });
});

// Fassung 37: welcher Stand laeuft? Railway setzt RAILWAY_GIT_COMMIT_SHA - so sieht Markus auf
// motto-otto.de/health, ob der letzte Push schon deployt ist, ohne im Railway-Log zu suchen.
const GESTARTET = new Date().toISOString();
// Fassung 55: Musterbogen der Figurenstile zum Anschauen auf dem Handy. Die Bilder liegen beim
// Bilddienst; beim ersten Aufruf holt der Server sie einmal und legt sie auf das Volume, danach
// kommen sie von hier. Eine kurze, tippbare Adresse: motto-otto.de/figuren
const FIGUREN_BOGEN = [
  { datei: 'figuren-1.png', url: 'https://ballz-image-mcp-production.up.railway.app/generated/31602bed-db4f-45f9-8426-e319520be444.png', titel: 'Otto-Strichmännchen · Karikaturen · Helden-Pose · Silhouetten' },
  { datei: 'figuren-2.png', url: 'https://ballz-image-mcp-production.up.railway.app/generated/beeb6814-13d9-4697-995f-6689c119a87a.png', titel: 'Strichfiguren · Comic · Silhouetten · Maskottchen · Karikatur · Helden' }
];
app.get('/figuren/:datei', async (req, res) => {
  const name = String(req.params.datei).replace(/[^a-z0-9.-]/gi, '');
  const bogen = FIGUREN_BOGEN.find(b => b.datei === name);
  if (!bogen) return res.status(404).end();
  const ziel = path.join(STORE, 'figuren', name);
  try { return res.type('png').set('cache-control', 'public, max-age=86400').send(await fs.readFile(ziel)); } catch (e) { /* holen */ }
  try {
    // 25. Sept., Stabilitaets-Durchgang: ohne Zeitgrenze haelt ein stummer Bilddienst diese
    // Kundenanfrage fuer immer offen. Der Bogen ist Beiwerk - lieber schnell nichts als ewig warten.
    const r = await fetch(bogen.url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('Bilddienst ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    try { await fs.mkdir(path.join(STORE, 'figuren'), { recursive: true }); await fs.writeFile(ziel, buf); } catch (e) { /* Zwischenspeicher ist Kuer */ }
    res.type('png').set('cache-control', 'public, max-age=86400').send(buf);
  } catch (e) {
    console.error('Figurenbogen:', name, e && e.message ? e.message : e);
    res.status(502).end();
  }
});
app.get('/figuren', (req, res) => {
  res.type('html').send(`<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Figuren im Motiv – Motto Otto</title>
<style>body{margin:0;background:#12161c;color:#eee;font:16px/1.5 system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:18px}h1{font-size:22px;margin:.2em 0}
h2{font-size:16px;font-weight:600;color:#b9c2cc;margin:22px 0 8px}
img{width:100%;height:auto;border-radius:12px;background:#fff;display:block}
p{color:#b9c2cc}</style></head><body><main>
<h1>Wie sollen die Leute im Motiv aussehen?</h1>
<p>Musterbögen zur neuen Auswahl im Konfigurator. Die Otto-Strichmännchen sind der Hausstil aus deinem Motivkatalog: schwarzer Spray, X als Augen, Cap quer.</p>
${FIGUREN_BOGEN.map(b => `<h2>${escHtml(b.titel)}</h2><img src="/figuren/${b.datei}" alt="">`).join('')}
</main></body></html>`);
});

// Ist der Bilddienst von HIER aus erreichbar, und welcher Stand laeuft dort? Ohne das war
// "Bilddienst nicht erreichbar" nur eine Vermutung - jetzt steht es in /health.
async function bilddienstStand() {
  if (!env.BALLZ_MCP_URL) return { erreichbar: false, fehler: 'BALLZ_MCP_URL fehlt' };
  try {
    const u = new URL(env.BALLZ_MCP_URL); u.pathname = '/health'; u.search = '';
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { erreichbar: false, fehler: 'HTTP ' + r.status };
    const j = await r.json().catch(() => ({}));
    return { erreichbar: true, stand: j.stand || null, gestartet: j.gestartet || null, version: j.version || null, modell: j.imageModel || null };
  } catch (e) { return { erreichbar: false, fehler: String(e && e.message ? e.message : e).slice(0, 120) }; }
}
// 'laufend': Auftraege in Arbeit - vor einem Deploy nachsehen, denn ein Neustart wirft sie zurueck.
app.get('/health', async (req, res) => res.json({ ok: true, stand: String(process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || null, gestartet: GESTARTET, laufend: [...jobs.values()].filter(j => j.status === 'queued' || j.status === 'running').length, llm: HAS_LLM, mottos: (await mottos.all()).length, heute: counter.n, konten: ACCOUNTS_ON, stripe: !!stripeCfg, mail: !!env.BREVO_API_KEY, drive: (await drive.status()).connected, vektor: await vectorReady(), bilddienst: await bilddienstStand() }));

// ---------- Aufraeumen, nur wenn eine Frist gesetzt ist ----------
if (+env.PREVIEW_TTL_DAYS > 0) {
  setInterval(async () => {
    const ttl = +env.PREVIEW_TTL_DAYS * 86400e3;
    try {
      for (const f of await fs.readdir(path.join(STORE, 'previews'))) {
        const p = path.join(STORE, 'previews', f);
        const st = await fs.stat(p);
        if (Date.now() - st.mtimeMs > ttl) {
          await fs.rm(p, { force: true });
          await fs.rm(path.join(STORE, 'masters', `${f.replace('.png', '')}_PRINT_MASTER.png`), { force: true });
        }
      }
    } catch (e) { console.error('Aufraeumen:', e && e.message ? e.message : e); }
  }, 6 * 3600e3);
}

// Nach einem Neustart: gesicherte Auftraege wieder aufnehmen (wartende/unterbrochene neu einreihen)
await restoreJobs();
// Druckerei-Schluessel vom Volume laden (oder beim allerersten Start anlegen), damit auch ein
// direkt aufgerufener Datei-Link sofort funktioniert und nicht erst nach dem Oeffnen von /druck.
await druckZugang();
// Grund-Modus laden, BEVOR der erste Auftrag laeuft - sonst baute der erste Prompt des Tages
// noch mit der falschen Hintergrund-Anweisung.
await grundModusLaden();
await bildWahlLaden();
// Zaehler (Fassung 74): reine Tageszahlen, keine Personendaten - siehe Kopf von zaehler.js.
await initZaehler(STORE);

// Fassung 26: Kundenfotos liegen nur im Arbeitsspeicher (fotos.js). Alle fuenf Minuten
// fegen, was ueber der Stundenfrist liegt - unabhaengig davon, ob jemand geantwortet hat.
setInterval(() => { const weg = fotoAufraeumen(); if (weg) console.log('Kundenfotos abgelaufen und geloescht:', weg); }, 5 * 60 * 1000).unref();

// 19. Sept., Besucher-Durchlauf: eine falsche Adresse lieferte Express' nacktes "Cannot GET" -
// keine Kopfzeile, kein Weg zurueck. Jetzt eine Seite in Ottos Farben mit den drei Wegen, die
// ein Verirrter braucht. Fuer /api bleibt es JSON, damit kein Skript HTML als Antwort bekommt.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'nicht gefunden' });
  res.status(404).type('html').send(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seite nicht gefunden – Motto Otto</title>
<style>body{margin:0;background:#141319;color:#f3f1f6;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.w{max-width:560px;margin:0 auto;padding:56px 20px}h1{font-size:30px;margin:0 0 10px}p{color:#b9b4c6;margin:0 0 22px}a.b{display:inline-block;margin:0 10px 10px 0;padding:12px 18px;border-radius:999px;font-weight:800;text-decoration:none;color:#1b1710;background:#ffc542}a.s{background:transparent;color:#f3f1f6;border:1px solid #3a3746}</style></head>
<body><div class="w"><h1>Die Seite gibt es nicht.</h1><p>Die Adresse <code>${escHtml(req.path).slice(0, 80)}</code> führt ins Leere – vielleicht ein Tippfehler oder ein alter Link.</p>
<a class="b" href="/">Zur Startseite</a><a class="b s" href="/#mottos">Alle Mottos</a><a class="b s" href="/konto">Mein Konto</a></div></body></html>`);
});

const httpServer = app.listen(+env.PORT, () => console.log(`motto-otto auf :${env.PORT} - Backend: /admin - LLM: ${HAS_LLM ? 'an' : 'aus'}`));

// Sauber verabschieden statt abgeschossen werden.
//
// Die Plattform schickt beim Herunterfahren SIGTERM. Ohne Behandlung beendet Node
// sofort per Signal, npm meldet das als Fehler (Rueckgabewert 143), und Railway
// verschickt eine "Deploy Crashed"-Mail - obwohl nur ein normaler Neustart lief.
// Gemessen: ohne Behandlung 143, mit Behandlung 0.
//
// Wichtig fuer diesen Dienst: laufende Auftraege liegen als Datei in storage/queue
// und werden nach dem Neustart wieder aufgenommen (restoreJobs). Es geht also nichts
// verloren, wenn ein Design mitten in der Arbeit unterbrochen wird - es laeuft neu.
let gehtSchlafen = false;
function verabschieden(signal) {
  if (gehtSchlafen) return;
  gehtSchlafen = true;
  console.log(`${signal} erhalten - keine neuen Anfragen mehr. ${running} Auftraege laufen noch, sie werden nach dem Neustart wieder aufgenommen.`);
  // Die Plattform wartet nicht ewig. Lieber selbst mit Code 0 gehen, als nach Ablauf
  // der Frist abgeschossen zu werden - das waere wieder ein falscher "Absturz".
  const notausgang = setTimeout(() => { console.log('Beende jetzt.'); process.exit(0); }, 12000);
  notausgang.unref();
  // Fassung 74: Der Zaehler sammelt im Arbeitsspeicher und schreibt nur alle 20 Sekunden.
  // Bei einem Deploy waeren die letzten Klicks sonst weg - also hier einmal sicher raus.
  zaehlerSichern().catch(() => {});
  httpServer.close(() => { console.log('Auf Wiedersehen.'); process.exit(0); });
}
process.on('SIGTERM', () => verabschieden('SIGTERM'));
process.on('SIGINT', () => verabschieden('SIGINT'));
